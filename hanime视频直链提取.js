// ==UserScript==
// @name         视频选择器+直链批量提取器
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  视频选择 + 批量提取指定分辨率直链，支持时长统计和大小估算
// @author       bydbot
// @include      https://*.hanime*.*/search*
// @include      https://hanime*.*/search*
// @grant        GM_xmlhttpRequest
// @connect      hanime1.me
// @connect      hanime2.top
// @connect      www.hanime2.vip
// @connect      www.hanime2.cc
// @connect      www.hanime163.top/
// @connect      www.hanime365.top
// @connect      www.hanime1-me.top
// @connect      www.hanime1.sbs
// @connect      www.hanime2.top
// @connect      www.hanime1-me.top
// @connect      www.hanime1-me.cc
// ==/UserScript==

(function() {
    'use strict';

    let selectionMode = false, isDragging = false;
    let startX, startY, currentX, currentY, lastSelectedIndex = -1;
    let ctrlPressed = false, shiftPressed = false;
    let isBatchProcessing = false, successCount = 0, failCount = 0;
    let currentResolution = '1080p', targetDomain = 'hanime2.top', results = [];

    const RES_PRIORITY = ['2160p', '1080p', '720p', '480p'];
    const CONCURRENCY = 2, TIMEOUT = 15000;

    const style = document.createElement('style');
    style.textContent = `
        #selectorToggleBtn {
            position: fixed; top: 70px; right: 20px; width: 48px; height: 48px;
            border-radius: 50%; background: #e63946; color: #fff; border: none;
            cursor: pointer; box-shadow: 0 2px 10px rgba(230,57,70,0.5);
            z-index: 10000; font-size: 24px;
            display: flex; align-items: center; justify-content: center; transition: all 0.3s;
        }
        #selectorToggleBtn:hover { transform: scale(1.1); background: #ff4d5a; }
        #selectorToggleBtn.active { background: #333; box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
        #selectorPanel {
            position: fixed; top: 130px; right: 20px; background: #222; color: #fff;
            padding: 15px; border-radius: 8px; z-index: 10001;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5); font-family: Arial, sans-serif;
            min-width: 320px; max-width: 380px; transform: translateX(400px);
            transition: transform 0.3s; border-left: 3px solid #e63946;
            max-height: 80vh; overflow-y: auto; overflow-x: hidden;
            pointer-events: auto; word-break: break-word;
        }
        #selectorPanel.show { transform: translateX(0); }
        #selectorPanel * { pointer-events: auto; }
        #selectorPanel button {
            background: #444; color: #fff; border: none; padding: 8px 15px;
            margin: 5px 2px; border-radius: 4px; cursor: pointer; font-size: 14px;
            transition: background 0.2s; width: calc(50% - 6px);
        }
        #selectorPanel button:hover { background: #666; }
        #selectorPanel button.primary { background: #e63946; width: 100%; margin: 5px 0; }
        #selectorPanel button.primary:hover { background: #ff4d5a; }
        #selectorPanel button.full-width { width: 100%; margin: 5px 0; }
        #selectorPanel button.success { background: #28a745; }
        #selectorPanel button.success:hover { background: #34ce57; }
        #selectorPanel .status {
            margin: 15px 0 10px; font-size: 14px; color: #aaa; text-align: center;
            padding: 8px; background: #333; border-radius: 4px;
        }
        #selectorPanel .selected-count { color: #e63946; font-weight: bold; font-size: 24px; display: block; }
        #selectorPanel .panel-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 8px;
        }
        #selectorPanel .panel-header span { font-weight: bold; color: #e63946; }
        #selectorPanel .close-btn {
            background: transparent; border: none; color: #999; font-size: 20px;
            cursor: pointer; padding: 0; width: auto; margin: 0;
        }
        #selectorPanel .close-btn:hover { color: #fff; background: transparent; }
        .stats-section {
            margin: 10px 0; padding: 10px; background: #2a2a2a;
            border-radius: 6px; border-left: 3px solid #e63946;
        }
        .stats-row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 13px; }
        .stats-row .label { color: #aaa; }
        .stats-row .value { color: #e63946; font-weight: bold; }
        .stats-row .value.success { color: #28a745; }
        .extractor-section { margin-top: 15px; border-top: 1px solid #444; padding-top: 15px; }
        .extractor-section h3 { color: #e63946; font-size: 14px; margin: 0 0 10px; }
        .form-group { margin-bottom: 10px; }
        .form-group label { display: block; font-size: 12px; color: #aaa; margin-bottom: 3px; }
        .form-group input, .form-group select {
            width: 100%; padding: 8px; background: #333; border: 1px solid #444;
            color: #fff; border-radius: 4px; box-sizing: border-box;
        }
        .form-group input:focus, .form-group select:focus { outline: none; border-color: #e63946; }
        .progress-bar { width: 100%; height: 20px; background: #333; border-radius: 10px; margin: 10px 0; overflow: hidden; }
        .progress-fill {
            height: 100%; background: #e63946; width: 0%; transition: width 0.3s;
            text-align: center; line-height: 20px; font-size: 11px; color: #fff;
        }
        .stats { display: flex; justify-content: space-between; font-size: 12px; color: #aaa; margin: 5px 0; }
        .stats span { color: #e63946; font-weight: bold; }
        .log-container {
            max-height: 100px; overflow-y: auto; overflow-x: hidden;
            background: #1a1a1a; border-radius: 4px; padding: 8px;
            font-size: 11px; font-family: monospace; margin-top: 10px;
            border: 1px solid #444; word-break: break-all; white-space: pre-wrap;
            width: 100%; box-sizing: border-box;
        }
        .log-item { padding: 2px 0; border-bottom: 1px solid #333; color: #0f0; word-break: break-all; white-space: pre-wrap; max-width: 100%; overflow-wrap: break-word; }
        .log-item.success { color: #51cf66; }
        .log-item.error { color: #ff6b6b; }
        .log-item.warning { color: #ffd93d; }
        .log-item.info { color: #17a2b8; }
        .video-item-container.selectable {
            position: relative; cursor: crosshair !important; transition: all 0.2s; user-select: none;
        }
        .video-item-container.selectable:hover { opacity: 0.9; transform: scale(1.01); box-shadow: 0 0 0 2px #e63946; z-index: 100; }
        .video-item-container.selected { opacity: 0.8; box-shadow: 0 0 0 3px #e63946, 0 0 15px rgba(230,57,70,0.7); border-radius: 4px; }
        .video-item-container.selected::after {
            content: "\u2713"; position: absolute; top: 10px; left: 10px;
            background: #e63946; color: #fff; width: 28px; height: 28px;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            font-weight: bold; font-size: 18px; z-index: 1000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3); animation: popIn 0.2s ease;
        }
        @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
        #dragSelectBox {
            position: fixed; background: rgba(230,57,70,0.2); border: 2px solid #e63946;
            border-radius: 2px; pointer-events: none; z-index: 10002;
            box-shadow: 0 0 0 1px rgba(255,255,255,0.3); display: none;
        }
        #dragSelectBox.show { display: block; }
        .selection-mode-hint {
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(230,57,70,0.95); color: #fff; padding: 12px 30px;
            border-radius: 40px; z-index: 10001; font-size: 15px; font-weight: bold;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5); pointer-events: none;
            animation: slideDown 0.3s ease; border: 1px solid rgba(255,255,255,0.2); white-space: nowrap;
        }
        .selection-mode-hint .key-highlight {
            background: rgba(255,255,255,0.2); padding: 2px 8px;
            border-radius: 4px; margin: 0 5px; border: 1px solid rgba(255,255,255,0.3);
        }
        @keyframes slideDown { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .tooltip {
            position: fixed; bottom: 20px; right: 20px; background: rgba(0,0,0,0.9);
            color: #e63946; padding: 10px 20px; border-radius: 30px; font-size: 14px;
            z-index: 10002; animation: fadeInOut 3s ease;
            border: 1px solid #e63946; box-shadow: 0 2px 10px rgba(0,0,0,0.3); pointer-events: none;
        }
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(10px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
        }
        #dragOverlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: transparent; z-index: 9997; display: none; cursor: crosshair;
        }
        #dragOverlay.active { display: block; }
    `;
    document.head.appendChild(style);

    // --- UI 元素创建 ---
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'selectorToggleBtn';
    toggleBtn.innerHTML = '\uD83C\uDFAC';
    document.body.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.id = 'selectorPanel';
    panel.innerHTML = `
        <div class="panel-header">
            <span>\uD83D\uDCCB 视频选择器 + 直链提取</span>
            <button class="close-btn" id="closePanelBtn">\u2715</button>
        </div>
        <button id="enterSelectionMode" class="primary">\uD83D\uDD0D 开始选择视频</button>
        <button id="exitSelectionMode" class="full-width" style="display:none;background:#555">\u2715 退出选择模式</button>
        <div class="status">已选中 <span class="selected-count" id="selectedCount">0</span> 个视频</div>
        <div class="stats-section" id="durationStats">
            <div class="stats-row"><span class="label">\u23F1\uFE0F 总时长:</span><span class="value" id="totalDuration">00:00:00</span></div>
            <div class="stats-row"><span class="label">\u2699\uFE0F 码率设置:</span><span class="value"><input type="number" id="bitrateInput" value="3000" min="100" max="10000" step="100" style="width:70px;background:#333;color:#fff;border:1px solid #444;border-radius:3px;padding:2px 5px"> kbps</span></div>
            <div class="stats-row"><span class="label">\uD83D\uDCBE 估算大小:</span><span class="value success" id="estimatedSize">0 MB</span></div>
            <div class="stats-row"><span class="label">\uD83D\uDCCA 平均每集:</span><span class="value" id="avgSizePerVideo">0 MB</span></div>
        </div>
        <button id="selectAllBtn" class="full-width">全选当前页</button>
        <button id="unselectAllBtn" class="full-width">取消全选</button>
        <div class="extractor-section">
            <h3>\uD83C\uDFA5 批量直链提取</h3>
            <div class="form-group"><label>替换域名:</label><input type="text" id="targetDomain" value="hanime2.top" placeholder="例如: hanime2.top"></div>
            <div class="form-group"><label>目标分辨率:</label><select id="resolutionSelect"><option value="2160p">4K (2160p)</option><option value="1080p" selected>1080p</option><option value="720p">720p</option><option value="480p">480p</option></select></div>
            <button id="startBatchExtract" class="primary full-width">\uD83D\uDE80 开始批量提取直链</button>
            <button id="stopBatchExtract" class="full-width" style="background:#dc3545;display:none">\u23F9\uFE0F 停止提取</button>
            <div class="stats"><span>进度:</span> <span id="progressStats">0/0</span></div>
            <div class="stats"><span>成功:</span> <span id="successCount" style="color:#28a745">0</span> <span>失败:</span> <span id="failCount" style="color:#e63946">0</span></div>
            <div class="progress-bar"><div class="progress-fill" id="progressFill">0%</div></div>
            <div class="log-container" id="logContainer"><div class="log-item info">准备就绪，请选择视频后开始提取</div></div>
            <div style="display:flex;gap:4px">
                <button id="exportResultsBtn" class="success" style="flex:1;margin:5px 0">\uD83D\uDCE5 导出 JSON</button>
                <button id="exportTxtBtn" style="flex:1;margin:5px 0;background:#17a2b8">\uD83D\uDCE5 导出 TXT</button>
            </div>
        </div>
        <div style="font-size:12px;color:#888;margin-top:8px;padding-top:8px;border-top:1px solid #333;text-align:center">
            <span>拖动</span> 框选 · <span>Ctrl+拖动</span> 范围反选 · <span>Shift+点击</span> 区间 · <span>ESC</span> 退出
        </div>`;
    document.body.appendChild(panel);

    const dragBox = document.createElement('div');
    dragBox.id = 'dragSelectBox';
    document.body.appendChild(dragBox);

    const overlay = document.createElement('div');
    overlay.id = 'dragOverlay';
    document.body.appendChild(overlay);

    const hint = document.createElement('div');
    hint.className = 'selection-mode-hint';
    hint.style.display = 'none';
    hint.innerHTML = '\uD83D\uDDB1\uFE0F <span class="key-highlight">拖动</span> 框选 · <span class="key-highlight">Ctrl+拖动</span> 范围反选 · <span class="key-highlight">Shift+点击</span> 区间 · <span class="key-highlight">ESC</span> 退出';
    document.body.appendChild(hint);

    // --- 工具函数 ---
    function addLog(msg, type = 'info') {
        const el = document.getElementById('logContainer');
        const item = document.createElement('div');
        item.className = `log-item ${type}`;
        item.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        el.appendChild(item);
        el.scrollTop = el.scrollHeight;
    }

    function showTooltip(msg, dur = 3000) {
        const t = document.createElement('div');
        t.className = 'tooltip';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), dur);
    }

    function updateProgress(cur, total) {
        const pct = total > 0 ? Math.round(cur / total * 100) : 0;
        const fill = document.getElementById('progressFill');
        fill.style.width = pct + '%';
        fill.textContent = pct + '%';
        document.getElementById('progressStats').textContent = `${cur}/${total}`;
        document.getElementById('successCount').textContent = successCount;
        document.getElementById('failCount').textContent = failCount;
    }

    function parseDuration(s) {
        if (!s) return 0;
        const p = s.trim().split(':').map(Number);
        return p.length === 2 ? p[0] * 60 + p[1] : p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : 0;
    }

    function formatDuration(sec) {
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        const pad = n => String(n).padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    }

    function extractVideoId(url) { const m = url.match(/[?&]v=(\d+)/); return m ? m[1] : ''; }

    function replaceDomain(url, domain) {
        try { const u = new URL(url); u.hostname = domain; return u.toString(); }
        catch { return url.replace(/https?:\/\/[^\/]+/, `https://${domain}`); }
    }

    function getVideoItems() {
        return Array.from(document.querySelectorAll('.video-item-container')).sort((a, b) => {
            const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            return Math.abs(ra.top - rb.top) < 20 ? ra.left - rb.left : ra.top - rb.top;
        });
    }

    function updateSelectedCount() {
        const count = document.querySelectorAll('.video-item-container.selected').length;
        document.getElementById('selectedCount').textContent = count;
        updateDurationStats();
    }

    function updateDurationStats() {
        const selected = document.querySelectorAll('.video-item-container.selected');
        let totalSec = 0;
        selected.forEach(item => {
            const dur = item.querySelector('.duration');
            if (dur) totalSec += parseDuration(dur.textContent);
        });
        document.getElementById('totalDuration').textContent = formatDuration(totalSec);
        const bitrate = parseInt(document.getElementById('bitrateInput').value) || 3000;
        const totalBytes = totalSec * bitrate * 1000 / 8;
        document.getElementById('estimatedSize').textContent = formatFileSize(totalBytes);
        document.getElementById('avgSizePerVideo').textContent = selected.length > 0 ? formatFileSize(totalBytes / selected.length) : '0 MB';
    }

    function updateSelectableState(enable) {
        getVideoItems().forEach(item => {
            if (enable) item.classList.add('selectable');
            else item.classList.remove('selectable', 'selected');
        });
    }

    function getSelectedVideoLinks() {
        return [...document.querySelectorAll('.video-item-container.selected')].map(item => {
            const link = item.querySelector('a.video-link');
            if (!link) return null;
            return {
                originalUrl: link.href,
                title: item.querySelector('.title')?.innerText.trim() || '未知标题',
                author: item.querySelector('.subtitle a')?.innerText.trim() || '未知作者',
                videoId: extractVideoId(link.href),
                duration: item.querySelector('.duration')?.textContent.trim() || '00:00'
            };
        }).filter(Boolean);
    }

    function isElementInBox(el, l, t, r, b) {
        const rect = el.getBoundingClientRect();
        return rect.left < r && rect.right > l && rect.top < b && rect.bottom > t;
    }

    function handleDragSelect() {
        const items = getVideoItems();
        const l = Math.min(startX, currentX), t = Math.min(startY, currentY);
        const r = Math.max(startX, currentX), b = Math.max(startY, currentY);
        items.forEach(item => {
            if (isElementInBox(item, l, t, r, b)) {
                if (ctrlPressed) item.classList.toggle('selected');
                else item.classList.add('selected');
            }
        });
        updateSelectedCount();
    }

    function handleShiftClick(el) {
        const items = getVideoItems();
        const idx = items.indexOf(el);
        if (idx === -1) return;
        if (lastSelectedIndex !== -1 && lastSelectedIndex !== idx) {
            const [s, e] = [Math.min(lastSelectedIndex, idx), Math.max(lastSelectedIndex, idx)];
            for (let i = s; i <= e; i++) items[i].classList.add('selected');
        } else {
            el.classList.add('selected');
        }
        lastSelectedIndex = idx;
        updateSelectedCount();
    }

    // 事件委托：点击视频卡片
    document.addEventListener('click', (e) => {
        const item = e.target.closest('.video-item-container');
        if (!item || !selectionMode || isDragging) return;
        if (e.target.tagName === 'A' || e.target.closest('a')) { e.preventDefault(); e.stopPropagation(); }
        const items = getVideoItems();
        const idx = items.indexOf(item);
        if (shiftPressed) handleShiftClick(item);
        else if (ctrlPressed) { item.classList.toggle('selected'); if (item.classList.contains('selected')) lastSelectedIndex = idx; }
        else if (item.classList.contains('selected')) { item.classList.remove('selected'); if (lastSelectedIndex === idx) lastSelectedIndex = items.findIndex(i => i.classList.contains('selected')); }
        else { item.classList.add('selected'); lastSelectedIndex = idx; }
        updateSelectedCount();
    }, true);

    // 为视频容器添加可选标记
    function addSelectableMarkers() {
        getVideoItems().forEach((item, i) => { item.dataset.index = i; });
    }

    // --- 直链提取 ---
    function extractVideoLinksFromHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const links = [];
        const resMap = { '2160': '2160p', '1080': '1080p', '720': '720p', '480': '480p' };

        doc.querySelectorAll('video source[src], video[src]').forEach(el => {
            const src = el.src || el.getAttribute('src');
            if (!src) return;
            let res = el.getAttribute('size') || '未知';
            for (const [k, v] of Object.entries(resMap)) {
                if (res.includes(k) || res.includes(v)) { res = v; break; }
            }
            if (res === '未知') res = el.tagName === 'SOURCE' ? el.getAttribute('size') || '未知' : '未知';
            links.push({ src, resolution: res });
        });
        return links;
    }

    function selectBestResolution(links, preferred) {
        if (!links.length) return null;
        // 精确匹配
        const exact = links.find(l => l.resolution.includes(preferred) || (preferred === '2160p' && l.resolution.includes('4K')));
        if (exact) return exact;
        // 降级查找
        for (const res of RES_PRIORITY.slice(RES_PRIORITY.indexOf(preferred) + 1)) {
            const match = links.find(l => l.resolution.includes(res));
            if (match) return match;
        }
        return links[0];
    }

    async function fetchVideoLinks(item, preferred, retries = 2) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (attempt > 0) { addLog(`重试 (${attempt}/${retries}): ${item.title}`, 'warning'); await new Promise(r => setTimeout(r, 1000 * attempt)); }

                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET', url: item.newUrl, timeout: TIMEOUT,
                        onload: resolve,
                        onerror: err => reject(new Error(err.error === 'NOT_ALLOWED' || err.responseText?.includes('not allowed')
                            ? `\u26D4 域名 ${new URL(item.newUrl).hostname} 未授权，请在Tampermonkey中允许`
                            : err.status === 0 ? `跨域被阻止，请确保 ${new URL(item.newUrl).hostname} 已添加到 @connect`
                            : '网络错误，请检查连接')),
                        ontimeout: () => reject(new Error(`请求超时 (${TIMEOUT}ms)`))
                    });
                });

                if (response.status !== 200) throw new Error(`HTTP ${response.status}`);

                const links = extractVideoLinksFromHtml(response.responseText);
                if (links.length) {
                    const best = selectBestResolution(links, preferred);
                    if (best) { addLog(`\u2705 ${item.title} [${best.resolution}]`, 'success'); return { ...item, videoUrl: best.src, resolution: best.resolution, allLinks: links }; }
                }
                addLog(`\u26A0\uFE0F 未找到视频流: ${item.title}`, 'warning');
                return { ...item, videoUrl: null, resolution: null, error: '未找到视频流', allLinks: [] };
            } catch (err) {
                addLog(`\u274C ${item.title} - ${err.message}`, 'error');
                if (attempt === retries) return { ...item, videoUrl: null, resolution: null, error: err.message, allLinks: [] };
            }
        }
    }

    async function batchFetchVideoLinks(items, preferred) {
        const out = [];
        let completed = 0;
        const total = items.length;
        updateProgress(0, total);
        addLog(`开始批量提取 ${total} 个视频...`);

        for (let i = 0; i < items.length && isBatchProcessing; i += CONCURRENCY) {
            const batch = items.slice(i, i + CONCURRENCY);
            const batchResults = await Promise.all(batch.map(item => fetchVideoLinks(item, preferred)));
            batchResults.forEach(r => { out.push(r); r.videoUrl ? successCount++ : failCount++; });
            completed += batch.length;
            updateProgress(completed, total);
            if (i + CONCURRENCY < items.length && isBatchProcessing) await new Promise(r => setTimeout(r, 800));
        }
        addLog(`提取完成: 成功 ${successCount}/${total}`, 'success');
        return out;
    }

    async function startBatchProcessing() {
        const links = getSelectedVideoLinks();
        if (!links.length) { showTooltip('\u26A0\uFE0F 请先选择视频'); return; }
        targetDomain = document.getElementById('targetDomain').value.trim();
        currentResolution = document.getElementById('resolutionSelect').value;
        if (!targetDomain) { showTooltip('\u26A0\uFE0F 请输入替换域名'); return; }

        isBatchProcessing = true; successCount = 0; failCount = 0; results = [];
        document.getElementById('startBatchExtract').style.display = 'none';
        document.getElementById('stopBatchExtract').style.display = 'block';
        document.getElementById('logContainer').innerHTML = '';
        addLog(`目标: ${targetDomain} | 分辨率: ${currentResolution} | ${links.length}个视频`, 'info');

        results = await batchFetchVideoLinks(links.map(l => ({ ...l, newUrl: replaceDomain(l.originalUrl, targetDomain) })), currentResolution);
        isBatchProcessing = false;
        document.getElementById('startBatchExtract').style.display = 'block';
        document.getElementById('stopBatchExtract').style.display = 'none';
        addLog(`完成！成功: ${successCount}, 失败: ${failCount}`, 'info');
        showTooltip(`\u2705 完成，成功: ${successCount}, 失败: ${failCount}`);
    }

    function stopBatchProcessing() {
        isBatchProcessing = false;
        document.getElementById('startBatchExtract').style.display = 'block';
        document.getElementById('stopBatchExtract').style.display = 'none';
        addLog('\u23F9\uFE0F 已手动停止', 'warning');
    }

    function exportResults() {
        if (!results.length) { showTooltip('\u26A0\uFE0F 没有可导出的数据'); return; }
        const query = new URLSearchParams(location.search).get('query') || 'video';
        const filename = `${query}_${currentResolution}_${results.length}.json`;
        const blob = new Blob([JSON.stringify({
            query, resolution: currentResolution, targetDomain,
            totalCount: results.length, successCount, failCount,
            timestamp: new Date().toISOString(),
            results: results.map(r => ({ title: r.title, author: r.author, videoId: r.videoId, duration: r.duration, originalUrl: r.originalUrl, convertedUrl: r.newUrl, videoUrl: r.videoUrl, resolution: r.resolution, error: r.error }))
        }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        addLog(`\u2705 已导出 ${results.length} 条到 ${filename}`, 'success');
        showTooltip(`\u2705 已保存到 ${filename}`);
    }

    function exportTxt() {
        if (!results.length) { showTooltip('\u26A0\uFE0F 没有可导出的数据'); return; }
        const urls = results.filter(r => r.videoUrl).map(r => r.videoUrl);
        if (!urls.length) { showTooltip('\u26A0\uFE0F 没有成功的视频链接'); return; }
        const query = new URLSearchParams(location.search).get('query') || 'video';
        const filename = `${query}_${currentResolution}_${urls.length}.txt`;
        const blob = new Blob([urls.join('\n')], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        addLog(`\u2705 已导出 ${urls.length} 条直链到 ${filename}`, 'success');
        showTooltip(`\u2705 已保存到 ${filename}`);
    }

    // --- 事件绑定 ---
    // 阻止冒泡辅助
    const stop = fn => e => { e.stopPropagation(); fn(e); };

    addSelectableMarkers();

    // 键盘
    document.addEventListener('keydown', e => {
        ctrlPressed = e.ctrlKey; shiftPressed = e.shiftKey;
        if (e.key === 'Escape') {
            if (selectionMode) document.getElementById('exitSelectionMode').click();
            if (panel.classList.contains('show')) { panel.classList.remove('show'); toggleBtn.classList.remove('active'); }
            if (isBatchProcessing) stopBatchProcessing();
        }
    });
    document.addEventListener('keyup', e => { ctrlPressed = e.ctrlKey; shiftPressed = e.shiftKey; });
    window.addEventListener('blur', () => { ctrlPressed = false; shiftPressed = false; });

    // 拖动选择
    document.addEventListener('mousedown', e => {
        if (!selectionMode || e.target.closest('#selectorToggleBtn,#selectorPanel,.video-item-container')) return;
        isDragging = true; startX = currentX = e.clientX; startY = currentY = e.clientY;
        Object.assign(dragBox.style, { left: startX + 'px', top: startY + 'px', width: '0px', height: '0px' });
        dragBox.classList.add('show'); overlay.classList.add('active');
    });
    document.addEventListener('mousemove', e => {
        if (!isDragging || !selectionMode) return;
        currentX = e.clientX; currentY = e.clientY;
        Object.assign(dragBox.style, {
            left: Math.min(startX, currentX) + 'px', top: Math.min(startY, currentY) + 'px',
            width: Math.abs(currentX - startX) + 'px', height: Math.abs(currentY - startY) + 'px'
        });
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
        hint.style.display = 'block'; updateSelectedCount(); showTooltip('\u2728 选择模式已开启');
        setTimeout(() => { panel.classList.remove('show'); toggleBtn.classList.remove('active'); }, 500);
    }));

    document.getElementById('exitSelectionMode').addEventListener('click', stop(() => {
        selectionMode = false; lastSelectedIndex = -1; isDragging = false;
        dragBox.classList.remove('show'); overlay.classList.remove('active');
        updateSelectableState(false);
        document.getElementById('enterSelectionMode').style.display = 'block';
        document.getElementById('exitSelectionMode').style.display = 'none';
        hint.style.display = 'none'; showTooltip('选择模式已关闭');
    }));

    document.getElementById('selectAllBtn').addEventListener('click', stop(() => {
        if (!selectionMode) { showTooltip('\u26A0\uFE0F 请先进入选择模式'); return; }
        const items = getVideoItems(); items.forEach(i => i.classList.add('selected'));
        lastSelectedIndex = items.length - 1; updateSelectedCount();
        showTooltip(`\u2705 已全选 ${items.length} 个视频`);
    }));

    document.getElementById('unselectAllBtn').addEventListener('click', stop(() => {
        if (!selectionMode) { showTooltip('\u26A0\uFE0F 请先进入选择模式'); return; }
        getVideoItems().forEach(i => i.classList.remove('selected'));
        lastSelectedIndex = -1; updateSelectedCount(); showTooltip('已取消全选');
    }));

    document.getElementById('startBatchExtract').addEventListener('click', stop(() => startBatchProcessing()));
    document.getElementById('stopBatchExtract').addEventListener('click', stop(() => stopBatchProcessing()));
    document.getElementById('exportResultsBtn').addEventListener('click', stop(() => exportResults()));
    document.getElementById('exportTxtBtn').addEventListener('click', stop(() => exportTxt()));
    document.getElementById('bitrateInput').addEventListener('input', stop(() => updateDurationStats()));

    document.addEventListener('click', e => {
        if (!panel.contains(e.target) && !toggleBtn.contains(e.target) && panel.classList.contains('show')) {
            panel.classList.remove('show'); toggleBtn.classList.remove('active');
        }
    });
})();