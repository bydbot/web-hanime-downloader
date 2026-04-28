// ==UserScript==
// @name         EH画廊种子提取
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  提取EH风格画廊的标题、链接和种子信息，并直接下载种子文件打包
// @author       bydbot
// @include      https://ex.fangliding.eu.org/
// @include      https://*.nmbyd*.top/*
// @include      https://e-hentai.org/*
// @include      https://ex.moonchan.xyz/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setClipboard
// @connect      *.nmbyd*.top
// @connect      ehtracker.org
// @connect      ex.fangliding.eu.org
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js
// ==/UserScript==

(function() {
    'use strict';

    let selectionMode = false, isDragging = false;
    let startX, startY, currentX, currentY, lastSelectedIndex = -1;
    let ctrlPressed = false, shiftPressed = false, toastTimer = null;

    const CONCURRENCY = 2, TIMEOUT = 15000, MAX_RETRIES = 2;
    let results = [], isProcessing = false;
    let successCount = 0, failCount = 0;
    let downloadedTorrents = [], noTorrentGalleries = [];

    // 注入 toast 动画样式（只创建一次）
    const toastStyle = document.createElement('style');
    toastStyle.textContent = `
        @keyframes toastFadeIn { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes toastFadeOut { from { opacity: 1; transform: translate(-50%, 0); } to { opacity: 0; transform: translate(-50%, 20px); } }
    `;
    document.head.appendChild(toastStyle);

    // --- 工具函数 ---
    function showToast(msg, type = 'info') {
        document.getElementById('exToastMessage')?.remove();
        if (toastTimer) clearTimeout(toastTimer);
        const toast = document.createElement('div');
        toast.id = 'exToastMessage';
        const bg = { info: 'rgba(23,162,184,0.95)', success: 'rgba(40,167,69,0.95)', error: 'rgba(220,53,69,0.95)', warning: 'rgba(255,193,7,0.95)' };
        toast.style.cssText = `position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:${bg[type]||bg.info};color:${type==='warning'?'#222':'#fff'};padding:12px 30px;border-radius:40px;z-index:10001;font-size:15px;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);white-space:nowrap;animation:toastFadeIn 0.3s ease`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        toastTimer = setTimeout(() => { toast.style.animation = 'toastFadeOut 0.3s ease'; setTimeout(() => toast.remove(), 300); toastTimer = null; }, 1500);
        addLog(msg, type);
    }

    function addLog(msg, type = 'info') {
        const el = document.getElementById('logContainer');
        if (!el) return;
        const item = document.createElement('div');
        item.className = `log-item ${type}`;
        item.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        el.appendChild(item);
        el.scrollTop = el.scrollHeight;
    }

    function updateProgress(cur, total) {
        const pct = total > 0 ? Math.round(cur / total * 100) : 0;
        const fill = document.getElementById('progressFill');
        if (fill) { fill.style.width = pct + '%'; fill.textContent = pct + '%'; }
        const $ = id => document.getElementById(id);
        if ($('progressStats')) $('progressStats').textContent = `${cur}/${total}`;
        if ($('successCount')) $('successCount').textContent = successCount;
        if ($('failCount')) $('failCount').textContent = failCount;
        if ($('downloadedCount')) $('downloadedCount').textContent = downloadedTorrents.length;
        if ($('downloadStats')) $('downloadStats').innerHTML = `\uD83D\uDCCA 种子下载进度: ${downloadedTorrents.length}/${successCount}`;
    }

    function buildFullUrl(url) {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `${location.origin}/${url.replace(/^\//, '')}`;
    }

    function getGalleryItems() { return Array.from(document.querySelectorAll('.gl1t')); }

    function updateSelectableState(enable) {
        getGalleryItems().forEach(item => enable ? item.classList.add('selectable') : item.classList.remove('selectable', 'selected'));
    }

    function updateSelectedCount() {
        const el = document.getElementById('selectedCount');
        if (el) el.textContent = document.querySelectorAll('.gl1t.selected').length;
    }

    function isElementInBox(el, l, t, r, b) {
        const rect = el.getBoundingClientRect();
        return rect.left < r && rect.right > l && rect.top < b && rect.bottom > t;
    }

    function handleDragSelect() {
        const items = getGalleryItems();
        const l = Math.min(startX, currentX), t = Math.min(startY, currentY);
        const r = Math.max(startX, currentX), b = Math.max(startY, currentY);
        items.forEach(item => { if (isElementInBox(item, l, t, r, b)) { ctrlPressed ? item.classList.toggle('selected') : item.classList.add('selected'); } });
        updateSelectedCount();
    }

    function handleShiftClick(el) {
        const items = getGalleryItems();
        const idx = items.indexOf(el);
        if (idx === -1) return;
        if (lastSelectedIndex !== -1 && lastSelectedIndex !== idx) {
            const [s, e] = [Math.min(lastSelectedIndex, idx), Math.max(lastSelectedIndex, idx)];
            for (let i = s; i <= e; i++) items[i].classList.add('selected');
        } else el.classList.add('selected');
        lastSelectedIndex = idx;
        updateSelectedCount();
    }

    function getSelectedGalleries() {
        return [...document.querySelectorAll('.gl1t.selected')].map(item => {
            const link = item.querySelector('a[href*="/g/"]');
            if (!link) return null;
            const href = link.getAttribute('href');
            const title = item.querySelector('.gl4t, .glink')?.innerText.trim() || '未知标题';
            const torrentLink = item.querySelector('.gldown a[href*="gallerytorrents.php"]');
            const gidMatch = href.match(/\/g\/(\d+)\/([a-f0-9]+)\//) || href.match(/gid=(\d+)/);
            const tokenMatch = href.match(/t=([a-f0-9]+)/) || href.match(/\/g\/\d+\/([a-f0-9]+)\//);
            return {
                title, safeTitle: title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100),
                originalUrl: href, galleryUrl: null,
                torrentPageUrl: torrentLink?.getAttribute('href') || null,
                gid: gidMatch ? (gidMatch[1] || gidMatch[2]) : null,
                token: tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null,
                hasTorrent: !!torrentLink
            };
        }).filter(Boolean);
    }

    // --- 种子提取与下载 ---
    function extractTorrentDownloadLink(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const seen = new Set();
        const links = [];
        doc.querySelectorAll('a[href*=".torrent"]').forEach(link => {
            const href = buildFullUrl(link.getAttribute('href'));
            if (!href || seen.has(href)) return;
            seen.add(href);
            links.push({ url: href, text: (link.innerText.trim() || 'torrent').replace(/[\\/:*?"<>|]/g, '_').substring(0, 50) });
        });
        return links;
    }

    async function downloadTorrentFile(url, galleryTitle) {
        const response = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({ method: 'GET', url, responseType: 'arraybuffer', timeout: TIMEOUT, onload: resolve, onerror: reject, ontimeout: () => reject(new Error('下载超时')) });
        });
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
        let fileName = url.split('/').pop();
        if (!fileName.includes('.torrent')) fileName = `gallery_${galleryTitle.substring(0, 30)}.torrent`;
        fileName = fileName.replace(/[\\/:*?"<>|]/g, '_');
        const prefix = galleryTitle.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
        fileName = `${prefix}_${fileName}`;
        const fileData = { name: fileName, data: response.response, galleryTitle, url };
        downloadedTorrents.push(fileData);
        addLog(`\u2705 下载成功: ${fileName}`, 'success');
        return fileData;
    }

    async function fetchAndDownloadTorrent(gallery) {
        if (!gallery.torrentPageUrl) return { ...gallery, torrentLinks: [], torrentFiles: [], error: '无种子页面' };

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 0) { addLog(`重试 (${attempt}/${MAX_RETRIES}): ${gallery.title}`, 'warning'); await new Promise(r => setTimeout(r, 1000 * attempt)); }

                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({ method: 'GET', url: buildFullUrl(gallery.torrentPageUrl), timeout: TIMEOUT, onload: resolve, onerror: reject, ontimeout: () => reject(new Error('请求超时')) });
                });
                if (response.status !== 200) throw new Error(`HTTP ${response.status}`);

                const torrentLinks = extractTorrentDownloadLink(response.responseText);
                if (!torrentLinks.length) { addLog(`未找到种子链接: ${gallery.title}`, 'warning'); return { ...gallery, torrentLinks: [], torrentFiles: [], error: '未找到种子链接' }; }

                addLog(`找到 ${torrentLinks.length} 个种子: ${gallery.title}`, 'success');
                const torrentFiles = [];
                for (let i = 0; i < torrentLinks.length; i++) {
                    try { torrentFiles.push(await downloadTorrentFile(torrentLinks[i].url, `${gallery.safeTitle}_${i + 1}`)); }
                    catch (err) { addLog(`下载失败: ${err.message}`, 'error'); }
                    if (i < torrentLinks.length - 1) await new Promise(r => setTimeout(r, 500));
                }
                return { ...gallery, torrentLinks, torrentFiles };
            } catch (err) {
                addLog(`获取失败 (${attempt + 1}/${MAX_RETRIES + 1}): ${gallery.title} - ${err.message}`, 'error');
                if (attempt === MAX_RETRIES) return { ...gallery, torrentLinks: [], torrentFiles: [], error: err.message };
            }
        }
    }

    async function batchProcessGalleries(galleries) {
        const out = [];
        let completed = 0;
        updateProgress(0, galleries.length);
        addLog(`开始处理 ${galleries.length} 个画廊...`);
        downloadedTorrents = [];
        noTorrentGalleries = [];

        for (let i = 0; i < galleries.length && isProcessing; i += CONCURRENCY) {
            const batch = galleries.slice(i, i + CONCURRENCY);
            const batchResults = await Promise.all(batch.map(async g => {
                const fullUrl = buildFullUrl(g.originalUrl);
                const result = { title: g.title, galleryUrl: fullUrl, gid: g.gid, token: g.token, hasTorrent: g.hasTorrent };
                if (g.hasTorrent) {
                    const t = await fetchAndDownloadTorrent(g);
                    result.torrentLinks = t.torrentLinks || [];
                    result.torrentFiles = t.torrentFiles || [];
                    result.torrentError = t.error;
                    if (t.torrentFiles?.length) successCount++;
                    else { failCount++; noTorrentGalleries.push({ title: g.title, galleryUrl: fullUrl, gid: g.gid, token: g.token, torrentPageUrl: g.torrentPageUrl, error: t.error || '未找到种子文件' }); }
                } else {
                    result.torrentLinks = result.torrentFiles = [];
                    successCount++;
                    noTorrentGalleries.push({ title: g.title, galleryUrl: fullUrl, gid: g.gid, token: g.token, torrentPageUrl: null, error: '画廊没有种子页面' });
                }
                return result;
            }));
            batchResults.forEach(r => out.push(r));
            completed += batch.length;
            updateProgress(completed, galleries.length);
            if (i + CONCURRENCY < galleries.length && isProcessing) await new Promise(r => setTimeout(r, 800));
        }

        addLog(`完成: 成功 ${successCount}/${galleries.length}, 下载 ${downloadedTorrents.length} 个种子`, 'success');
        if (noTorrentGalleries.length) addLog(`无种子: ${noTorrentGalleries.length} 个`, 'warning');
        if (downloadedTorrents.length) document.getElementById('downloadAllBtn').style.display = 'block';
        return out;
    }

    async function createZipWithTorrents() {
        if (!downloadedTorrents.length && !noTorrentGalleries.length) { showToast('\u26A0\uFE0F 没有可打包的数据', 'warning'); return; }
        try {
            addLog(`创建ZIP包 (${downloadedTorrents.length} 个种子)...`, 'info');
            const zip = new window.JSZip();
            downloadedTorrents.forEach(f => zip.file(f.name, f.data, { binary: true }));

            const exportJson = document.getElementById('exportJsonCheck')?.checked;
            if (exportJson) zip.file('torrents_info.json', JSON.stringify({ totalTorrents: downloadedTorrents.length, timestamp: new Date().toISOString(), files: downloadedTorrents.map(f => ({ name: f.name, galleryTitle: f.galleryTitle, url: f.url })) }, null, 2));

            if (noTorrentGalleries.length) zip.file('no_torrent_galleries.json', JSON.stringify({ totalCount: noTorrentGalleries.length, timestamp: new Date().toISOString(), galleries: noTorrentGalleries.map(g => ({ title: g.title, galleryUrl: g.galleryUrl, gid: g.gid, token: g.token, torrentPageUrl: g.torrentPageUrl, reason: g.error || '未知原因' })) }, null, 2));

            zip.file('summary.json', JSON.stringify({ totalGalleries: downloadedTorrents.length + noTorrentGalleries.length, withTorrent: downloadedTorrents.length, withoutTorrent: noTorrentGalleries.length, timestamp: new Date().toISOString() }, null, 2));

            addLog('正在生成ZIP...', 'info');
            const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const filename = `torrents_${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.zip`;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(content);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
            addLog(`\u2705 ZIP已保存: ${filename} (${(content.size / 1048576).toFixed(2)} MB)`, 'success');
            showToast(`\u2705 已保存 ${downloadedTorrents.length} 个种子到 ${filename}`, 'success');
        } catch (err) {
            addLog(`ZIP失败: ${err.message}`, 'error');
            showToast('\u274C 创建ZIP失败', 'error');
        }
    }

    async function startExtraction() {
        const galleries = getSelectedGalleries();
        if (!galleries.length) { showToast('\u26A0\uFE0F 请先选择画廊', 'warning'); return; }

        isProcessing = true; successCount = 0; failCount = 0;
        downloadedTorrents = []; results = []; noTorrentGalleries = [];
        document.getElementById('startExtractBtn').style.display = 'none';
        document.getElementById('stopExtractBtn').style.display = 'block';
        document.getElementById('downloadAllBtn').style.display = 'none';
        document.getElementById('logContainer').innerHTML = '';
        addLog(`开始处理 ${galleries.length} 个画廊 (域名: ${location.origin})`, 'info');

        results = await batchProcessGalleries(galleries);
        isProcessing = false;
        document.getElementById('startExtractBtn').style.display = 'block';
        document.getElementById('stopExtractBtn').style.display = 'none';
        showToast(downloadedTorrents.length ? `\u2705 完成，下载了 ${downloadedTorrents.length} 个种子` : '\u2705 完成，但没有下载到种子', downloadedTorrents.length ? 'success' : 'info');
    }

    function stopProcessing() {
        isProcessing = false;
        document.getElementById('startExtractBtn').style.display = 'block';
        document.getElementById('stopExtractBtn').style.display = 'none';
        addLog('\u23F9\uFE0F 已停止', 'warning');
        showToast('\u23F9\uFE0F 已停止', 'warning');
    }

    function exportResults() {
        if (!results.length) { showToast('\u26A0\uFE0F 没有可导出的数据', 'warning'); return; }
        const filename = `exhentai_galleries_${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.json`;
        const blob = new Blob([JSON.stringify({ totalCount: results.length, successCount, failCount, downloadedCount: downloadedTorrents.length, timestamp: new Date().toISOString(), results }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        addLog(`\u2705 已导出 ${results.length} 条到 ${filename}`, 'success');
        showToast(`\u2705 已保存到 ${filename}`, 'success');
    }

    // --- CSS ---
    const style = document.createElement('style');
    style.textContent = `
        #exSelectorToggleBtn {
            position: fixed; top: 70px; right: 20px; width: 48px; height: 48px;
            border-radius: 50%; background: #e63946; color: #fff; border: none;
            cursor: pointer; box-shadow: 0 2px 10px rgba(230,57,70,0.5);
            z-index: 10000; font-size: 24px;
            display: flex; align-items: center; justify-content: center; transition: all 0.3s;
        }
        #exSelectorToggleBtn:hover { transform: scale(1.1); background: #ff4d5a; }
        #exSelectorToggleBtn.active { background: #333; box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
        #exSelectorPanel {
            position: fixed; top: 130px; right: 20px; background: #222; color: #fff;
            padding: 15px; border-radius: 8px; z-index: 10001;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5); font-family: Arial, sans-serif;
            min-width: 350px; max-width: 400px; transform: translateX(450px);
            transition: transform 0.3s; border-left: 3px solid #e63946;
            max-height: 80vh; overflow-y: auto; pointer-events: auto;
        }
        #exSelectorPanel.show { transform: translateX(0); }
        #exSelectorPanel * { pointer-events: auto; }
        #exSelectorPanel button {
            background: #444; color: #fff; border: none; padding: 8px 15px;
            margin: 5px 2px; border-radius: 4px; cursor: pointer; font-size: 14px;
            transition: background 0.2s; width: calc(50% - 6px);
        }
        #exSelectorPanel button:hover { background: #666; }
        #exSelectorPanel button.primary { background: #e63946; width: 100%; margin: 5px 0; }
        #exSelectorPanel button.primary:hover { background: #ff4d5a; }
        #exSelectorPanel button.full-width { width: 100%; margin: 5px 0; }
        #exSelectorPanel button.success { background: #28a745; }
        #exSelectorPanel button.warning { background: #ffc107; color: #222; }
        #exSelectorPanel .status { margin: 15px 0 10px; font-size: 14px; color: #aaa; text-align: center; padding: 8px; background: #333; border-radius: 4px; }
        #exSelectorPanel .selected-count { color: #e63946; font-weight: bold; font-size: 24px; display: block; }
        #exSelectorPanel .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 8px; }
        #exSelectorPanel .panel-header span { font-weight: bold; color: #e63946; }
        #exSelectorPanel .close-btn { background: transparent; border: none; color: #999; font-size: 20px; cursor: pointer; padding: 0; width: auto; margin: 0; }
        #exSelectorPanel .close-btn:hover { color: #fff; }
        .domain-hint { font-size: 11px; color: #888; margin: 5px 0 10px; padding: 5px; background: #333; border-radius: 4px; text-align: center; }
        .progress-bar { width: 100%; height: 20px; background: #333; border-radius: 10px; margin: 10px 0; overflow: hidden; }
        .progress-fill { height: 100%; background: #e63946; width: 0%; transition: width 0.3s; text-align: center; line-height: 20px; font-size: 11px; color: #fff; }
        .stats { display: flex; justify-content: space-between; font-size: 12px; color: #aaa; margin: 5px 0; }
        .stats span { color: #e63946; font-weight: bold; }
        .log-container { max-height: 150px; overflow-y: auto; background: #1a1a1a; border-radius: 4px; padding: 8px; font-size: 11px; font-family: monospace; margin-top: 10px; border: 1px solid #444; word-break: break-all; }
        .log-item { padding: 2px 0; border-bottom: 1px solid #333; color: #0f0; word-break: break-all; }
        .log-item.success { color: #51cf66; }
        .log-item.error { color: #ff6b6b; }
        .log-item.warning { color: #ffd93d; }
        .log-item.info { color: #17a2b8; }
        .gl1t.selectable { position: relative; cursor: pointer !important; transition: all 0.2s; user-select: none; }
        .gl1t.selectable:hover { opacity: 0.9; transform: scale(1.01); box-shadow: 0 0 0 2px #e63946; z-index: 100; }
        .gl1t.selected { opacity: 0.8; box-shadow: 0 0 0 3px #e63946, 0 0 15px rgba(230,57,70,0.7); border-radius: 4px; }
        .gl1t.selected::after {
            content: "\u2713"; position: absolute; top: 10px; left: 10px;
            background: #e63946; color: #fff; width: 28px; height: 28px;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            font-weight: bold; font-size: 18px; z-index: 1000; box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        #exDragSelectBox { position: fixed; background: rgba(230,57,70,0.2); border: 2px solid #e63946; border-radius: 2px; pointer-events: none; z-index: 10002; display: none; }
        #exDragSelectBox.show { display: block; }
        .selection-mode-hint {
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(230,57,70,0.95); color: #fff; padding: 12px 30px;
            border-radius: 40px; z-index: 10001; font-size: 15px; font-weight: bold;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5); pointer-events: none;
            border: 1px solid rgba(255,255,255,0.2); white-space: nowrap;
        }
        #exDragOverlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: transparent; z-index: 9997; display: none; cursor: crosshair; }
        #exDragOverlay.active { display: block; }
        .download-stats { font-size: 11px; color: #aaa; margin: 5px 0; }
    `;
    document.head.appendChild(style);

    // --- UI 元素 ---
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'exSelectorToggleBtn';
    toggleBtn.innerHTML = '\uD83D\uDCE5';
    document.body.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.id = 'exSelectorPanel';
    panel.innerHTML = `
        <div class="panel-header">
            <span>\uD83D\uDCE5 ExHentai 种子下载器 v2.3</span>
            <button class="close-btn" id="closePanelBtn">\u2715</button>
        </div>
        <button id="enterSelectionMode" class="primary">\uD83D\uDD0D 开始选择画廊</button>
        <button id="exitSelectionMode" class="full-width" style="display:none;background:#555">\u2715 退出选择模式</button>
        <div class="status">已选中 <span class="selected-count" id="selectedCount">0</span> 个画廊</div>
        <button id="selectAllBtn" class="full-width">全选当前页</button>
        <button id="unselectAllBtn" class="full-width">取消全选</button>
        <div class="domain-hint">\uD83C\uDF10 当前域名: <span id="currentDomainDisplay">${location.origin}</span></div>
        <div style="margin:5px 0;display:none">
            <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="downloadTorrentsCheck" checked> 下载种子</label>
            <label style="display:flex;align-items:center;gap:5px"><input type="checkbox" id="exportJsonCheck" checked> 导出JSON</label>
        </div>
        <button id="startExtractBtn" class="primary full-width">\uD83D\uDE80 开始获取种子并下载</button>
        <button id="stopExtractBtn" class="full-width" style="background:#dc3545;display:none">\u23F9\uFE0F 停止处理</button>
        <div class="stats"><span>进度:</span> <span id="progressStats">0/0</span></div>
        <div class="stats"><span>成功:</span> <span id="successCount" style="color:#28a745">0</span> <span>失败:</span> <span id="failCount" style="color:#e63946">0</span> <span>已下载:</span> <span id="downloadedCount" style="color:#17a2b8">0</span></div>
        <div class="progress-bar"><div class="progress-fill" id="progressFill">0%</div></div>
        <div class="download-stats" id="downloadStats">\uD83D\uDCCA 种子下载进度: 0/0</div>
        <div class="log-container" id="logContainer"><div class="log-item info">准备就绪，请选择画廊后开始下载</div></div>
        <button id="downloadAllBtn" class="full-width success" style="display:none">\uD83D\uDCE6 下载所有种子 (ZIP打包)</button>
        <button id="exportResultsBtn" class="full-width warning">\uD83D\uDCE5 导出JSON结果</button>
        <div style="font-size:12px;color:#888;margin-top:8px;padding-top:8px;border-top:1px solid #333;text-align:center">
            <span>拖动</span> 框选 · <span>Ctrl+拖动</span> 范围反选 · <span>Shift+点击</span> 区间 · <span>ESC</span> 退出
        </div>`;
    document.body.appendChild(panel);

    const dragBox = document.createElement('div');
    dragBox.id = 'exDragSelectBox';
    document.body.appendChild(dragBox);

    const overlay = document.createElement('div');
    overlay.id = 'exDragOverlay';
    document.body.appendChild(overlay);

    const hint = document.createElement('div');
    hint.className = 'selection-mode-hint';
    hint.style.display = 'none';
    hint.innerHTML = '\uD83D\uDDB1\uFE0F <span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px">拖动</span> 框选 · <span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px">Ctrl+拖动</span> 反选 · <span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px">Shift+点击</span> 区间 · <span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px">ESC</span> 退出';
    document.body.appendChild(hint);

    // --- 事件绑定 ---
    const stop = fn => e => { e.stopPropagation(); fn(e); };

    // 事件委托：画廊点击
    document.addEventListener('click', (e) => {
        const item = e.target.closest('.gl1t');
        if (!item || !selectionMode || isDragging) return;
        if (e.target.tagName === 'A' || e.target.closest('a')) { e.preventDefault(); e.stopPropagation(); }
        const items = getGalleryItems();
        const idx = items.indexOf(item);
        if (shiftPressed) handleShiftClick(item);
        else if (ctrlPressed) { item.classList.toggle('selected'); if (item.classList.contains('selected')) lastSelectedIndex = idx; }
        else if (item.classList.contains('selected')) { item.classList.remove('selected'); if (lastSelectedIndex === idx) lastSelectedIndex = items.findIndex(i => i.classList.contains('selected')); }
        else { item.classList.add('selected'); lastSelectedIndex = idx; }
        updateSelectedCount();
    }, true);

    // 键盘
    document.addEventListener('keydown', e => {
        ctrlPressed = e.ctrlKey; shiftPressed = e.shiftKey;
        if (e.key === 'Escape') {
            if (selectionMode) document.getElementById('exitSelectionMode')?.click();
            if (panel.classList.contains('show')) { panel.classList.remove('show'); toggleBtn.classList.remove('active'); }
            if (isProcessing) stopProcessing();
        }
    });
    document.addEventListener('keyup', e => { ctrlPressed = e.ctrlKey; shiftPressed = e.shiftKey; });
    window.addEventListener('blur', () => { ctrlPressed = false; shiftPressed = false; });

    // 拖动选择
    document.addEventListener('mousedown', e => {
        if (!selectionMode || e.target.closest('#exSelectorToggleBtn,#exSelectorPanel,.gl1t')) return;
        isDragging = true; startX = currentX = e.clientX; startY = currentY = e.clientY;
        Object.assign(dragBox.style, { left: startX + 'px', top: startY + 'px', width: '0px', height: '0px' });
        dragBox.classList.add('show'); overlay.classList.add('active');
    });
    document.addEventListener('mousemove', e => {
        if (!isDragging || !selectionMode) return;
        currentX = e.clientX; currentY = e.clientY;
        Object.assign(dragBox.style, { left: Math.min(startX, currentX) + 'px', top: Math.min(startY, currentY) + 'px', width: Math.abs(currentX - startX) + 'px', height: Math.abs(currentY - startY) + 'px' });
    });
    document.addEventListener('mouseup', () => {
        if (isDragging && selectionMode) handleDragSelect();
        isDragging = false; dragBox.classList.remove('show'); overlay.classList.remove('active');
    });

    // 面板阻止冒泡
    ['mousedown', 'mouseup', 'click'].forEach(evt => panel.addEventListener(evt, e => e.stopPropagation()));

    // 按钮事件
    toggleBtn.addEventListener('click', stop(() => { panel.classList.toggle('show'); toggleBtn.classList.toggle('active'); }));
    document.getElementById('closePanelBtn').addEventListener('click', stop(() => { panel.classList.remove('show'); toggleBtn.classList.remove('active'); }));

    document.getElementById('enterSelectionMode').addEventListener('click', stop(() => {
        selectionMode = true; lastSelectedIndex = -1; updateSelectableState(true);
        document.getElementById('enterSelectionMode').style.display = 'none';
        document.getElementById('exitSelectionMode').style.display = 'block';
        hint.style.display = 'block'; updateSelectedCount(); showToast('\u2728 选择模式已开启', 'success');
        setTimeout(() => { panel.classList.remove('show'); toggleBtn.classList.remove('active'); }, 500);
    }));

    document.getElementById('exitSelectionMode').addEventListener('click', stop(() => {
        selectionMode = false; lastSelectedIndex = -1; isDragging = false;
        dragBox.classList.remove('show'); overlay.classList.remove('active');
        updateSelectableState(false);
        document.getElementById('enterSelectionMode').style.display = 'block';
        document.getElementById('exitSelectionMode').style.display = 'none';
        hint.style.display = 'none'; showToast('选择模式已关闭', 'info');
    }));

    document.getElementById('selectAllBtn').addEventListener('click', stop(() => {
        if (!selectionMode) { showToast('\u26A0\uFE0F 请先进入选择模式', 'warning'); return; }
        const items = getGalleryItems(); items.forEach(i => i.classList.add('selected'));
        lastSelectedIndex = items.length - 1; updateSelectedCount();
        showToast(`\u2705 已全选 ${items.length} 个画廊`, 'success');
    }));

    document.getElementById('unselectAllBtn').addEventListener('click', stop(() => {
        if (!selectionMode) { showToast('\u26A0\uFE0F 请先进入选择模式', 'warning'); return; }
        getGalleryItems().forEach(i => i.classList.remove('selected'));
        lastSelectedIndex = -1; updateSelectedCount(); showToast('已取消全选', 'info');
    }));

    document.getElementById('startExtractBtn').addEventListener('click', stop(() => startExtraction()));
    document.getElementById('stopExtractBtn').addEventListener('click', stop(() => stopProcessing()));
    document.getElementById('downloadAllBtn').addEventListener('click', stop(() => createZipWithTorrents()));
    document.getElementById('exportResultsBtn').addEventListener('click', stop(() => exportResults()));

    document.addEventListener('click', e => {
        if (!panel.contains(e.target) && !toggleBtn.contains(e.target) && panel.classList.contains('show')) {
            panel.classList.remove('show'); toggleBtn.classList.remove('active');
        }
    });
})();