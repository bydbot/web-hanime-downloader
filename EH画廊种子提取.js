// ==UserScript==
// @name         EH画廊种子提取
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  提取EH风格画廊的标题、链接和种子信息，并直接下载种子文件打包
// @author       You
// @include      https://ex.fangliding.eu.org/
// @include      https://*.nmbyd*.top/*
// @include      https://e-hentai.org/*
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

    // ==================== 全局变量 ====================
    let selectionMode = false;
    let isDragging = false;
    let startX, startY, currentX, currentY;
    let lastSelectedIndex = -1;
    let ctrlPressed = false;
    let shiftPressed = false;
    let toastTimer = null;

    // 配置
    const CONFIG = {
        concurrency: 2,
        timeout: 15000,
        maxRetries: 2
    };

    // 存储结果
    let results = [];
    let isProcessing = false;
    let processedCount = 0;
    let successCount = 0;
    let failCount = 0;
    let downloadedTorrents = [];
    let noTorrentGalleries = [];

    // ==================== 工具函数 ====================
    // 显示底部提示
    function showToast(message, type = 'info') {
        // 移除现有的toast
        const existingToast = document.getElementById('exToastMessage');
        if (existingToast) {
            existingToast.remove();
        }

        // 清除之前的定时器
        if (toastTimer) {
            clearTimeout(toastTimer);
        }

        // 创建新的toast元素
        const toast = document.createElement('div');
        toast.id = 'exToastMessage';

        // 根据类型设置样式
        const typeStyles = {
            info: 'background: rgba(23, 162, 184, 0.95);',
            success: 'background: rgba(40, 167, 69, 0.95);',
            error: 'background: rgba(220, 53, 69, 0.95);',
            warning: 'background: rgba(255, 193, 7, 0.95); color: #222;'
        };

        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            ${typeStyles[type] || typeStyles.info}
            color: white;
            padding: 12px 30px;
            border-radius: 40px;
            z-index: 10001;
            font-size: 15px;
            font-weight: bold;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.2);
            backdrop-filter: blur(5px);
            white-space: nowrap;
            animation: toastFadeIn 0.3s ease;
        `;

        toast.textContent = message;

        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes toastFadeIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, 20px);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
            }
            @keyframes toastFadeOut {
                from {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
                to {
                    opacity: 0;
                    transform: translate(-50%, 20px);
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(toast);

        // 设置定时器，1.5秒后消失
        toastTimer = setTimeout(() => {
            toast.style.animation = 'toastFadeOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
            toastTimer = null;
        }, 1500);

        addLog(message, type);
    }

    // 获取当前页面的基础域名
    function getCurrentBaseDomain() {
        return window.location.origin;
    }

    // 智能拼接URL：自动识别链接是否已包含完整域名，如果没有则使用当前域名拼接
    function buildFullUrl(url) {
        if (!url) return null;

        // 如果已经是完整的URL（包含http://或https://），直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // 获取当前页面的域名
        const currentDomain = getCurrentBaseDomain();

        // 清理URL，去除开头的斜杠
        url = url.replace(/^\//, '');

        // 返回拼接后的完整URL
        return `${currentDomain}/${url}`;
    }

    function addLog(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        if (!logContainer) return;

        const logItem = document.createElement('div');
        logItem.className = `log-item ${type}`;
        logItem.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContainer.appendChild(logItem);
        logContainer.scrollTop = logContainer.scrollHeight;
        console.log(`[ExHentai下载器] ${message}`);
    }

    function updateProgress(current, total) {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        const progressFill = document.getElementById('progressFill');
        const progressStats = document.getElementById('progressStats');
        const successCountEl = document.getElementById('successCount');
        const failCountEl = document.getElementById('failCount');
        const downloadedCountEl = document.getElementById('downloadedCount');
        const downloadStats = document.getElementById('downloadStats');

        if (progressFill) {
            progressFill.style.width = percent + '%';
            progressFill.textContent = percent + '%';
        }
        if (progressStats) progressStats.textContent = `${current}/${total}`;
        if (successCountEl) successCountEl.textContent = successCount;
        if (failCountEl) failCountEl.textContent = failCount;
        if (downloadedCountEl) downloadedCountEl.textContent = downloadedTorrents.length;

        if (downloadStats) {
            downloadStats.innerHTML = `📊 种子下载进度: ${downloadedTorrents.length}/${successCount}`;
        }
    }

    // 获取所有画廊条目
    function getGalleryItems() {
        return Array.from(document.querySelectorAll('.gl1t'));
    }

    function updateSelectableState(enable) {
        const items = getGalleryItems();
        items.forEach(item => {
            if (enable) {
                item.classList.add('selectable');
            } else {
                item.classList.remove('selectable', 'selected');
            }
        });
    }

    function updateSelectedCount() {
        const count = document.querySelectorAll('.gl1t.selected').length;
        const selectedCount = document.getElementById('selectedCount');
        if (selectedCount) selectedCount.textContent = count;
    }

    function isElementInBox(element, boxLeft, boxTop, boxRight, boxBottom) {
        const rect = element.getBoundingClientRect();
        return rect.left < boxRight && rect.right > boxLeft &&
               rect.top < boxBottom && rect.bottom > boxTop;
    }

    function handleDragSelect() {
        const items = getGalleryItems();
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const right = Math.max(startX, currentX);
        const bottom = Math.max(startY, currentY);

        items.forEach(item => {
            const isInBox = isElementInBox(item, left, top, right, bottom);
            if (isInBox) {
                if (ctrlPressed) {
                    item.classList.toggle('selected');
                } else {
                    item.classList.add('selected');
                }
            }
        });
        updateSelectedCount();
    }

    function getElementIndex(element) {
        const items = getGalleryItems();
        return items.indexOf(element);
    }

    function handleShiftClick(currentElement) {
        const items = getGalleryItems();
        const currentIndex = getElementIndex(currentElement);

        if (currentIndex === -1) return;

        if (lastSelectedIndex !== -1 && lastSelectedIndex !== currentIndex) {
            const start = Math.min(lastSelectedIndex, currentIndex);
            const end = Math.max(lastSelectedIndex, currentIndex);

            for (let i = start; i <= end; i++) {
                items[i].classList.add('selected');
            }
        } else {
            currentElement.classList.add('selected');
        }

        lastSelectedIndex = currentIndex;
        updateSelectedCount();
    }

    // 获取选中的画廊信息
    function getSelectedGalleries() {
        const selectedItems = document.querySelectorAll('.gl1t.selected');
        const galleries = [];

        selectedItems.forEach(item => {
            const linkElement = item.querySelector('a[href*="/g/"]');
            if (!linkElement) return;

            const href = linkElement.getAttribute('href');
            const titleElement = item.querySelector('.gl4t, .glink');
            const title = titleElement ? titleElement.innerText.trim() : '未知标题';

            // 获取标题中的有效文件名（去除非法字符）
            const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);

            // 检查是否有种子链接
            const torrentLinkElement = item.querySelector('.gldown a[href*="gallerytorrents.php"]');
            let torrentPageUrl = null;
            if (torrentLinkElement) {
                torrentPageUrl = torrentLinkElement.getAttribute('href');
            }

            // 提取gid和t参数
            const gidMatch = href.match(/\/g\/(\d+)\/([a-f0-9]+)\//) || href.match(/gid=(\d+)/);
            const tokenMatch = href.match(/t=([a-f0-9]+)/) || href.match(/\/g\/\d+\/([a-f0-9]+)\//);

            const gid = gidMatch ? (gidMatch[1] || gidMatch[2]) : null;
            const token = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;

            galleries.push({
                title: title,
                safeTitle: safeTitle,
                originalUrl: href,
                galleryUrl: null,
                torrentPageUrl: torrentPageUrl,
                gid: gid,
                token: token,
                hasTorrent: !!torrentPageUrl
            });
        });

        return galleries;
    }

    // 从种子页面提取下载链接
    function extractTorrentDownloadLink(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const torrentLinks = [];

        // 查找种子下载链接
        doc.querySelectorAll('a[href*=".torrent"]').forEach(link => {
            let href = link.getAttribute('href');
            href = buildFullUrl(href);

            // 获取链接文本作为种子文件名参考
            let linkText = link.innerText.trim() || 'torrent';
            // 清理文件名
            linkText = linkText.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);

            torrentLinks.push({
                url: href,
                text: linkText,
                isTorrent: true
            });
        });

        // 去重
        const uniqueLinks = [];
        const seen = new Set();
        torrentLinks.forEach(link => {
            if (!seen.has(link.url)) {
                seen.add(link.url);
                uniqueLinks.push(link);
            }
        });

        return uniqueLinks;
    }

    // 下载种子文件
    async function downloadTorrentFile(url, galleryTitle, index) {
        try {
            addLog(`开始下载种子: ${galleryTitle}`, 'info');

            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    responseType: 'arraybuffer',
                    timeout: CONFIG.timeout,
                    onload: resolve,
                    onerror: reject,
                    ontimeout: () => reject(new Error('下载超时'))
                });
            });

            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}`);
            }

            // 获取文件名
            let fileName = '';
            const contentDisposition = response.responseHeaders?.['content-disposition'] || '';
            const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (match && match[1]) {
                fileName = match[1].replace(/['"]/g, '');
            } else {
                // 从URL中提取文件名
                const urlParts = url.split('/');
                fileName = urlParts[urlParts.length - 1];
                if (!fileName.includes('.torrent')) {
                    fileName = `gallery_${galleryTitle.substring(0, 30)}.torrent`;
                }
            }

            // 清理文件名
            fileName = fileName.replace(/[\\/:*?"<>|]/g, '_');

            // 添加画廊标题前缀以便识别
            const prefix = galleryTitle.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
            fileName = `${prefix}_${fileName}`;

            const fileData = {
                name: fileName,
                data: response.response,
                galleryTitle: galleryTitle,
                url: url
            };

            downloadedTorrents.push(fileData);

            addLog(`✅ 下载成功: ${fileName}`, 'success');

            return fileData;

        } catch (error) {
            addLog(`下载失败 ${galleryTitle}: ${error.message}`, 'error');
            throw error;
        }
    }

    // 获取种子页面信息并下载
    async function fetchAndDownloadTorrent(gallery, retryCount = CONFIG.maxRetries) {
        if (!gallery.torrentPageUrl) {
            return {
                ...gallery,
                torrentLinks: [],
                torrentFiles: [],
                error: '无种子页面'
            };
        }

        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                if (attempt > 0) {
                    addLog(`重试 (${attempt}/${retryCount}): ${gallery.title}`, 'warning');
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }

                const fullUrl = buildFullUrl(gallery.torrentPageUrl);

                // 获取种子页面
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: fullUrl,
                        timeout: CONFIG.timeout,
                        onload: resolve,
                        onerror: reject,
                        ontimeout: () => reject(new Error('请求超时'))
                    });
                });

                if (response.status !== 200) {
                    throw new Error(`HTTP ${response.status}`);
                }

                // 提取种子下载链接
                const torrentLinks = extractTorrentDownloadLink(response.responseText);

                if (torrentLinks.length === 0) {
                    addLog(`未找到种子链接: ${gallery.title}`, 'warning');
                    return {
                        ...gallery,
                        torrentLinks: [],
                        torrentFiles: [],
                        error: '未找到种子链接'
                    };
                }

                addLog(`找到 ${torrentLinks.length} 个种子链接: ${gallery.title}`, 'success');

                // 下载种子文件
                const torrentFiles = [];
                for (let i = 0; i < torrentLinks.length; i++) {
                    try {
                        const fileData = await downloadTorrentFile(
                            torrentLinks[i].url,
                            `${gallery.safeTitle}_${i + 1}`,
                            i
                        );
                        torrentFiles.push(fileData);
                    } catch (error) {
                        addLog(`种子文件下载失败: ${error.message}`, 'error');
                    }

                    // 下载间隔，避免请求过快
                    if (i < torrentLinks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                return {
                    ...gallery,
                    torrentLinks: torrentLinks,
                    torrentFiles: torrentFiles,
                    torrentPageContent: response.responseText.substring(0, 500) + '...'
                };

            } catch (error) {
                addLog(`获取种子页面失败 (${attempt + 1}/${retryCount + 1}): ${gallery.title} - ${error.message}`, 'error');

                if (attempt === retryCount) {
                    return {
                        ...gallery,
                        torrentLinks: [],
                        torrentFiles: [],
                        error: error.message
                    };
                }
            }
        }
        return null;
    }

    // 批量处理
    async function batchProcessGalleries(galleries) {
        const results = [];
        const total = galleries.length;
        let completed = 0;

        updateProgress(0, total);
        addLog(`开始处理 ${total} 个画廊...`);

        // 重置下载列表和无种子列表
        downloadedTorrents = [];
        noTorrentGalleries = [];

        // 并发控制
        for (let i = 0; i < galleries.length; i += CONFIG.concurrency) {
            if (!isProcessing) break;

            const batch = galleries.slice(i, i + CONFIG.concurrency);
            const promises = batch.map(async gallery => {
                // 拼接完整URL
                const fullGalleryUrl = buildFullUrl(gallery.originalUrl);

                let result = {
                    title: gallery.title,
                    galleryUrl: fullGalleryUrl,
                    gid: gallery.gid,
                    token: gallery.token,
                    hasTorrent: gallery.hasTorrent
                };

                if (gallery.hasTorrent) {
                    const torrentResult = await fetchAndDownloadTorrent(gallery);
                    result.torrentLinks = torrentResult.torrentLinks || [];
                    result.torrentFiles = torrentResult.torrentFiles || [];
                    result.torrentError = torrentResult.error;

                    if (torrentResult.torrentFiles && torrentResult.torrentFiles.length > 0) {
                        successCount++;
                    } else {
                        failCount++;
                        // 添加到无种子列表
                        noTorrentGalleries.push({
                            title: gallery.title,
                            galleryUrl: fullGalleryUrl,
                            gid: gallery.gid,
                            token: gallery.token,
                            torrentPageUrl: gallery.torrentPageUrl,
                            error: torrentResult.error || '未找到种子文件'
                        });
                    }
                } else {
                    result.torrentLinks = [];
                    result.torrentFiles = [];
                    successCount++;
                    // 添加到无种子列表
                    noTorrentGalleries.push({
                        title: gallery.title,
                        galleryUrl: fullGalleryUrl,
                        gid: gallery.gid,
                        token: gallery.token,
                        torrentPageUrl: null,
                        error: '画廊没有种子页面'
                    });
                }

                return result;
            });

            const batchResults = await Promise.all(promises);

            batchResults.forEach(result => {
                results.push(result);
            });

            completed += batch.length;
            updateProgress(completed, total);

            // 更新下载统计
            const downloadedCountEl = document.getElementById('downloadedCount');
            if (downloadedCountEl) downloadedCountEl.textContent = downloadedTorrents.length;

            // 批次间延时
            if (i + CONFIG.concurrency < galleries.length && isProcessing) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }

        addLog(`处理完成: 成功 ${successCount}/${total}, 下载种子: ${downloadedTorrents.length} 个`, 'success');
        addLog(`无种子的画廊: ${noTorrentGalleries.length} 个`, 'warning');

        // 显示下载按钮
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        if (downloadAllBtn && downloadedTorrents.length > 0) {
            downloadAllBtn.style.display = 'block';
        }

        return results;
    }

    // 创建ZIP文件
    async function createZipWithTorrents() {
        if (downloadedTorrents.length === 0 && noTorrentGalleries.length === 0) {
            showToast('⚠️ 没有可打包的数据', 'warning');
            return null;
        }

        try {
            addLog(`开始创建ZIP包，包含 ${downloadedTorrents.length} 个种子文件...`, 'info');

            const JSZip = window.JSZip;
            const zip = new JSZip();

            // 添加种子文件到ZIP
            downloadedTorrents.forEach((file, index) => {
                zip.file(file.name, file.data, { binary: true });
            });

            // 添加有种子文件的JSON信息
            const exportJsonCheck = document.getElementById('exportJsonCheck');
            if (exportJsonCheck && exportJsonCheck.checked) {
                const torrentJsonData = {
                    totalTorrents: downloadedTorrents.length,
                    timestamp: new Date().toISOString(),
                    files: downloadedTorrents.map(f => ({
                        name: f.name,
                        galleryTitle: f.galleryTitle,
                        url: f.url
                    }))
                };
                zip.file('torrents_info.json', JSON.stringify(torrentJsonData, null, 2));
            }

            // 添加无种子文件的JSON信息
            if (noTorrentGalleries && noTorrentGalleries.length > 0) {
                const noTorrentJsonData = {
                    totalCount: noTorrentGalleries.length,
                    timestamp: new Date().toISOString(),
                    galleries: noTorrentGalleries.map(g => ({
                        title: g.title,
                        galleryUrl: g.galleryUrl,
                        gid: g.gid,
                        token: g.token,
                        torrentPageUrl: g.torrentPageUrl,
                        reason: g.error || '未知原因'
                    }))
                };
                zip.file('no_torrent_galleries.json', JSON.stringify(noTorrentJsonData, null, 2));
            }

            // 添加汇总信息文件
            const summaryData = {
                totalGalleries: (downloadedTorrents.length + (noTorrentGalleries ? noTorrentGalleries.length : 0)),
                withTorrent: downloadedTorrents.length,
                withoutTorrent: noTorrentGalleries ? noTorrentGalleries.length : 0,
                timestamp: new Date().toISOString()
            };
            zip.file('summary.json', JSON.stringify(summaryData, null, 2));

            // 生成ZIP文件
            addLog('正在生成ZIP文件，请稍候...', 'info');

            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            const filename = `torrents_${timestamp}.zip`;

            // 下载ZIP文件
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            addLog(`✅ ZIP包已保存: ${filename} (${(content.size / 1024 / 1024).toFixed(2)} MB)`, 'success');
            addLog(`📊 包含 ${downloadedTorrents.length} 个种子文件，${noTorrentGalleries ? noTorrentGalleries.length : 0} 个无种子画廊信息`, 'info');
            showToast(`✅ 已保存 ${downloadedTorrents.length} 个种子到 ${filename}`, 'success');

            return filename;

        } catch (error) {
            addLog(`创建ZIP失败: ${error.message}`, 'error');
            showToast('❌ 创建ZIP失败', 'error');
            return null;
        }
    }

    // 开始提取和下载
    async function startExtraction() {
        const selectedGalleries = getSelectedGalleries();

        if (selectedGalleries.length === 0) {
            showToast('⚠️ 请先选择画廊', 'warning');
            return;
        }

        // 重置状态
        isProcessing = true;
        processedCount = 0;
        successCount = 0;
        failCount = 0;
        downloadedTorrents = [];
        results = [];
        noTorrentGalleries = [];

        // 更新UI
        const startExtractBtn = document.getElementById('startExtractBtn');
        const stopExtractBtn = document.getElementById('stopExtractBtn');
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        const logContainer = document.getElementById('logContainer');

        if (startExtractBtn) startExtractBtn.style.display = 'none';
        if (stopExtractBtn) stopExtractBtn.style.display = 'block';
        if (downloadAllBtn) downloadAllBtn.style.display = 'none';
        if (logContainer) logContainer.innerHTML = '';

        addLog(`开始处理，共 ${selectedGalleries.length} 个画廊`, 'info');
        addLog(`当前页面域名: ${getCurrentBaseDomain()}`, 'info');

        // 统计有种子的数量
        const withTorrent = selectedGalleries.filter(g => g.hasTorrent).length;
        addLog(`其中 ${withTorrent} 个画廊有种子页面`, 'info');

        // 批量处理
        results = await batchProcessGalleries(selectedGalleries);

        // 处理完成
        isProcessing = false;
        if (startExtractBtn) startExtractBtn.style.display = 'block';
        if (stopExtractBtn) stopExtractBtn.style.display = 'none';

        addLog(`批量处理完成！成功: ${successCount}, 失败: ${failCount}, 下载种子: ${downloadedTorrents.length}`, 'info');

        // 显示无种子列表统计
        if (noTorrentGalleries.length > 0) {
            addLog(`无种子画廊: ${noTorrentGalleries.length} 个`, 'warning');
        }

        if (downloadedTorrents.length > 0) {
            showToast(`✅ 已完成，下载了 ${downloadedTorrents.length} 个种子文件`, 'success');
        } else {
            showToast(`✅ 处理完成，但没有下载到种子文件`, 'info');
        }
    }

    // 停止处理
    function stopProcessing() {
        isProcessing = false;
        const startExtractBtn = document.getElementById('startExtractBtn');
        const stopExtractBtn = document.getElementById('stopExtractBtn');

        if (startExtractBtn) startExtractBtn.style.display = 'block';
        if (stopExtractBtn) stopExtractBtn.style.display = 'none';

        addLog('⏹️ 已手动停止处理', 'warning');
        showToast('⏹️ 已手动停止处理', 'warning');
    }

    // 导出JSON结果
    function exportResults() {
        if (results.length === 0) {
            showToast('⚠️ 没有可导出的数据', 'warning');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const filename = `exhentai_galleries_${timestamp}.json`;

        const exportData = {
            totalCount: results.length,
            successCount: successCount,
            failCount: failCount,
            downloadedCount: downloadedTorrents.length,
            timestamp: new Date().toISOString(),
            results: results
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        addLog(`✅ 已导出 ${results.length} 条结果到 ${filename}`, 'success');
        showToast(`✅ 已保存到 ${filename}`, 'success');
    }

    // ==================== 创建UI元素 ====================
    const style = document.createElement('style');
    style.textContent = `
        /* 主按钮样式 */
        #exSelectorToggleBtn {
            position: fixed;
            top: 70px;
            right: 20px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #e63946;
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(230, 57, 70, 0.5);
            z-index: 10000;
            font-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        }
        #exSelectorToggleBtn:hover {
            transform: scale(1.1);
            background: #ff4d5a;
        }
        #exSelectorToggleBtn.active {
            background: #333;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }

        /* 展开面板 */
        #exSelectorPanel {
            position: fixed;
            top: 130px;
            right: 20px;
            background: #222;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 10001;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
            font-family: Arial, sans-serif;
            min-width: 350px;
            max-width: 400px;
            transform: translateX(450px);
            transition: transform 0.3s ease;
            border-left: 3px solid #e63946;
            max-height: 80vh;
            overflow-y: auto;
            pointer-events: auto;
        }
        #exSelectorPanel.show {
            transform: translateX(0);
        }

        /* 面板内部样式 */
        #exSelectorPanel * {
            pointer-events: auto;
        }

        #exSelectorPanel button {
            background: #444;
            color: white;
            border: none;
            padding: 8px 15px;
            margin: 5px 2px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
            width: calc(50% - 6px);
        }
        #exSelectorPanel button:hover {
            background: #666;
        }
        #exSelectorPanel button.primary {
            background: #e63946;
            width: 100%;
            margin: 5px 0;
        }
        #exSelectorPanel button.primary:hover {
            background: #ff4d5a;
        }
        #exSelectorPanel button.full-width {
            width: 100%;
            margin: 5px 0;
        }
        #exSelectorPanel button.success {
            background: #28a745;
        }
        #exSelectorPanel button.warning {
            background: #ffc107;
            color: #222;
        }
        #exSelectorPanel .status {
            margin: 15px 0 10px;
            font-size: 14px;
            color: #aaa;
            text-align: center;
            padding: 8px;
            background: #333;
            border-radius: 4px;
        }
        #exSelectorPanel .selected-count {
            color: #e63946;
            font-weight: bold;
            font-size: 24px;
            display: block;
        }
        #exSelectorPanel .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 1px solid #444;
            padding-bottom: 8px;
        }
        #exSelectorPanel .panel-header span {
            font-weight: bold;
            color: #e63946;
        }
        #exSelectorPanel .close-btn {
            background: transparent;
            border: none;
            color: #999;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            width: auto;
            margin: 0;
        }
        #exSelectorPanel .close-btn:hover {
            color: white;
        }

        /* 输入区域 - 隐藏或显示提示信息 */
        .form-group {
            margin-bottom: 10px;
            display: none; /* 隐藏输入框，因为不再需要用户输入 */
        }
        .domain-hint {
            font-size: 11px;
            color: #888;
            margin: 5px 0 10px;
            padding: 5px;
            background: #333;
            border-radius: 4px;
            text-align: center;
        }

        /* 进度条 */
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #333;
            border-radius: 10px;
            margin: 10px 0;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background: #e63946;
            width: 0%;
            transition: width 0.3s;
            text-align: center;
            line-height: 20px;
            font-size: 11px;
            color: white;
        }
        .stats {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #aaa;
            margin: 5px 0;
        }
        .stats span {
            color: #e63946;
            font-weight: bold;
        }
        .log-container {
            max-height: 150px;
            overflow-y: auto;
            background: #1a1a1a;
            border-radius: 4px;
            padding: 8px;
            font-size: 11px;
            font-family: monospace;
            margin-top: 10px;
            border: 1px solid #444;
            word-break: break-all;
        }
        .log-item {
            padding: 2px 0;
            border-bottom: 1px solid #333;
            color: #0f0;
            word-break: break-all;
        }
        .log-item.success { color: #51cf66; }
        .log-item.error { color: #ff6b6b; }
        .log-item.warning { color: #ffd93d; }
        .log-item.info { color: #17a2b8; }

        /* 画廊条目选择样式 */
        .gl1t.selectable {
            position: relative;
            cursor: pointer !important;
            transition: all 0.2s;
            user-select: none;
        }
        .gl1t.selectable:hover {
            opacity: 0.9;
            transform: scale(1.01);
            box-shadow: 0 0 0 2px #e63946;
            z-index: 100;
        }
        .gl1t.selected {
            opacity: 0.8;
            box-shadow: 0 0 0 3px #e63946, 0 0 15px rgba(230, 57, 70, 0.7);
            border-radius: 4px;
        }
        .gl1t.selected::after {
            content: "✓";
            position: absolute;
            top: 10px;
            left: 10px;
            background: #e63946;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
            z-index: 1000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }

        /* 拖动选框 */
        #exDragSelectBox {
            position: fixed;
            background: rgba(230, 57, 70, 0.2);
            border: 2px solid #e63946;
            border-radius: 2px;
            pointer-events: none;
            z-index: 10002;
            display: none;
        }
        #exDragSelectBox.show {
            display: block;
        }

        /* 模式提示 */
        .selection-mode-hint {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(230, 57, 70, 0.95);
            color: white;
            padding: 12px 30px;
            border-radius: 40px;
            z-index: 10001;
            font-size: 15px;
            font-weight: bold;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            pointer-events: none;
            border: 1px solid rgba(255,255,255,0.2);
            backdrop-filter: blur(5px);
            white-space: nowrap;
        }

        /* 遮罩层 */
        #exDragOverlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: transparent;
            z-index: 9997;
            display: none;
            cursor: crosshair;
        }
        #exDragOverlay.active {
            display: block;
        }

        /* 下载进度条 */
        .torrent-download-item {
            background: #333;
            padding: 5px;
            margin: 3px 0;
            border-radius: 3px;
            font-size: 11px;
            border-left: 2px solid #e63946;
        }
        .torrent-download-item.success {
            border-left-color: #28a745;
        }
        .torrent-download-item.error {
            border-left-color: #dc3545;
        }
        .download-stats {
            font-size: 11px;
            color: #aaa;
            margin: 5px 0;
        }
    `;
    document.head.appendChild(style);

    // ==================== UI元素创建 ====================
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'exSelectorToggleBtn';
    toggleBtn.innerHTML = '📥';
    document.body.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.id = 'exSelectorPanel';
    panel.innerHTML = `
        <div class="panel-header">
            <span>📥 ExHentai 种子下载器 v2.2</span>
            <button class="close-btn" id="closePanelBtn">✕</button>
        </div>

        <button id="enterSelectionMode" class="primary">🔍 开始选择画廊</button>
        <button id="exitSelectionMode" class="full-width" style="display: none; background: #555;">✕ 退出选择模式</button>

        <div class="status">
            已选中 <span class="selected-count" id="selectedCount">0</span> 个画廊
        </div>

        <button id="selectAllBtn" class="full-width">全选当前页</button>
        <button id="unselectAllBtn" class="full-width">取消全选</button>

        <!-- 域名提示信息，不再需要输入框 -->
        <div class="domain-hint" id="domainHint">
            🌐 当前域名: <span id="currentDomainDisplay"></span>
        </div>

        <div class="form-group">
            <label>下载选项:</label>
            <div style="display: flex; gap: 10px; margin-top: 5px;">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="downloadTorrentsCheck" checked> 下载种子文件
                </label>
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="exportJsonCheck" checked> 导出JSON信息
                </label>
            </div>
        </div>

        <button id="startExtractBtn" class="primary full-width">🚀 开始获取种子并下载</button>
        <button id="stopExtractBtn" class="full-width" style="background: #dc3545; display: none;">⏹️ 停止处理</button>

        <div class="stats">
            <span>进度:</span> <span id="progressStats">0/0</span>
        </div>
        <div class="stats">
            <span>成功:</span> <span id="successCount" style="color:#28a745;">0</span>
            <span>失败:</span> <span id="failCount" style="color:#e63946;">0</span>
            <span>已下载:</span> <span id="downloadedCount" style="color:#17a2b8;">0</span>
        </div>

        <div class="progress-bar">
            <div class="progress-fill" id="progressFill" style="width: 0%;">0%</div>
        </div>

        <div class="download-stats" id="downloadStats">
            📊 种子下载进度: 0/0
        </div>

        <div class="log-container" id="logContainer">
            <div class="log-item info">准备就绪，请选择画廊后开始下载</div>
        </div>

        <button id="downloadAllBtn" class="full-width success" style="display: none;">📦 下载所有种子 (ZIP打包)</button>
        <button id="exportResultsBtn" class="full-width warning">📥 导出JSON结果</button>

        <div style="font-size: 12px; color: #888; margin-top: 8px; padding-top: 8px; border-top: 1px solid #333; text-align: center;">
            <span>拖动</span> 框选 · <span>Ctrl+拖动</span> 范围反选 · <span>Shift+点击</span> 区间 · <span>ESC</span> 退出
        </div>
    `;
    document.body.appendChild(panel);

    const dragBox = document.createElement('div');
    dragBox.id = 'exDragSelectBox';
    document.body.appendChild(dragBox);

    const overlay = document.createElement('div');
    overlay.id = 'exDragOverlay';
    document.body.appendChild(overlay);

    // 更新当前域名显示
    const domainDisplay = document.getElementById('currentDomainDisplay');
    if (domainDisplay) {
        domainDisplay.textContent = getCurrentBaseDomain();
    }

    const hint = document.createElement('div');
    hint.className = 'selection-mode-hint';
    hint.style.display = 'none';
    hint.innerHTML = `
        🖱️ <span style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:4px;">拖动</span> 框选 ·
        <span style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:4px;">Ctrl+拖动</span> 范围反选 ·
        <span style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:4px;">Shift+点击</span> 区间 ·
        <span style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:4px;">ESC</span> 退出
    `;
    document.body.appendChild(hint);

    // ==================== 事件绑定 ====================
    // 为画廊添加点击事件
    function addClickHandlers() {
        const items = getGalleryItems();
        items.forEach((item, index) => {
            item.addEventListener('click', function(e) {
                if (e.target.tagName === 'A' || e.target.closest('a')) {
                    if (selectionMode) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }

                if (selectionMode && !isDragging) {
                    if (shiftPressed) {
                        handleShiftClick(this);
                    } else if (ctrlPressed) {
                        this.classList.toggle('selected');
                        if (this.classList.contains('selected')) {
                            lastSelectedIndex = index;
                        }
                    } else {
                        if (this.classList.contains('selected')) {
                            this.classList.remove('selected');
                            if (lastSelectedIndex === index) {
                                const selectedItems = items.filter(item => item.classList.contains('selected'));
                                if (selectedItems.length > 0) {
                                    lastSelectedIndex = items.indexOf(selectedItems[0]);
                                } else {
                                    lastSelectedIndex = -1;
                                }
                            }
                        } else {
                            this.classList.add('selected');
                            lastSelectedIndex = index;
                        }
                    }
                    updateSelectedCount();
                }
            });

            item.dataset.index = index;
        });
    }

    // 初始化点击事件
    setTimeout(addClickHandlers, 1000);

    // 键盘事件
    document.addEventListener('keydown', (e) => {
        ctrlPressed = e.ctrlKey;
        shiftPressed = e.shiftKey;

        if (e.key === 'Escape') {
            if (selectionMode) {
                const exitBtn = document.getElementById('exitSelectionMode');
                if (exitBtn) exitBtn.click();
            }
            if (panel.classList.contains('show')) {
                panel.classList.remove('show');
                toggleBtn.classList.remove('active');
            }
            if (isProcessing) {
                stopProcessing();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        ctrlPressed = e.ctrlKey;
        shiftPressed = e.shiftKey;
    });

    window.addEventListener('blur', () => {
        ctrlPressed = false;
        shiftPressed = false;
    });

    // 鼠标拖动事件
    document.addEventListener('mousedown', (e) => {
        if (!selectionMode) return;
        if (e.target.closest('#exSelectorToggleBtn') || e.target.closest('#exSelectorPanel')) return;
        if (e.target.closest('.gl1t')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        currentX = startX;
        currentY = startY;

        dragBox.style.left = startX + 'px';
        dragBox.style.top = startY + 'px';
        dragBox.style.width = '0px';
        dragBox.style.height = '0px';
        dragBox.classList.add('show');

        overlay.classList.add('active');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !selectionMode) return;

        currentX = e.clientX;
        currentY = e.clientY;

        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        dragBox.style.left = left + 'px';
        dragBox.style.top = top + 'px';
        dragBox.style.width = width + 'px';
        dragBox.style.height = height + 'px';
    });

    document.addEventListener('mouseup', (e) => {
        if (isDragging && selectionMode) {
            handleDragSelect();
        }

        isDragging = false;
        dragBox.classList.remove('show');
        overlay.classList.remove('active');
    });

    // 面板事件
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('mouseup', (e) => e.stopPropagation());
    panel.addEventListener('click', (e) => e.stopPropagation());

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('show');
        toggleBtn.classList.toggle('active');
    });

    const closePanelBtn = document.getElementById('closePanelBtn');
    if (closePanelBtn) {
        closePanelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.remove('show');
            toggleBtn.classList.remove('active');
        });
    }

    const enterSelectionModeBtn = document.getElementById('enterSelectionMode');
    if (enterSelectionModeBtn) {
        enterSelectionModeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectionMode = true;
            lastSelectedIndex = -1;
            updateSelectableState(true);
            enterSelectionModeBtn.style.display = 'none';
            const exitBtn = document.getElementById('exitSelectionMode');
            if (exitBtn) exitBtn.style.display = 'block';
            hint.style.display = 'block';
            updateSelectedCount();
            showToast('✨ 选择模式已开启', 'success');

            setTimeout(() => {
                panel.classList.remove('show');
                toggleBtn.classList.remove('active');
            }, 500);
        });
    }

    const exitSelectionModeBtn = document.getElementById('exitSelectionMode');
    if (exitSelectionModeBtn) {
        exitSelectionModeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectionMode = false;
            lastSelectedIndex = -1;
            isDragging = false;
            dragBox.classList.remove('show');
            overlay.classList.remove('active');
            updateSelectableState(false);
            const enterBtn = document.getElementById('enterSelectionMode');
            if (enterBtn) enterBtn.style.display = 'block';
            exitSelectionModeBtn.style.display = 'none';
            hint.style.display = 'none';
            showToast('选择模式已关闭', 'info');
        });
    }

    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!selectionMode) {
                showToast('⚠️ 请先进入选择模式', 'warning');
                return;
            }
            const items = getGalleryItems();
            items.forEach(item => item.classList.add('selected'));
            if (items.length > 0) {
                lastSelectedIndex = items.length - 1;
            }
            updateSelectedCount();
            showToast(`✅ 已全选 ${items.length} 个画廊`, 'success');
        });
    }

    const unselectAllBtn = document.getElementById('unselectAllBtn');
    if (unselectAllBtn) {
        unselectAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!selectionMode) {
                showToast('⚠️ 请先进入选择模式', 'warning');
                return;
            }
            getGalleryItems().forEach(item => item.classList.remove('selected'));
            lastSelectedIndex = -1;
            updateSelectedCount();
            showToast('已取消全选', 'info');
        });
    }

    const startExtractBtn = document.getElementById('startExtractBtn');
    if (startExtractBtn) {
        startExtractBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startExtraction();
        });
    }

    const stopExtractBtn = document.getElementById('stopExtractBtn');
    if (stopExtractBtn) {
        stopExtractBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            stopProcessing();
        });
    }

    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            createZipWithTorrents();
        });
    }

    const exportResultsBtn = document.getElementById('exportResultsBtn');
    if (exportResultsBtn) {
        exportResultsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportResults();
        });
    }

    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !toggleBtn.contains(e.target) && panel.classList.contains('show')) {
            panel.classList.remove('show');
            toggleBtn.classList.remove('active');
        }
    });

    console.log('ExHentai种子下载器 v2.2 已加载 - 自动使用当前页面域名拼接');
})();