// ==UserScript==
// @name         视频选择器+直链批量提取器
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  视频选择 + 批量提取指定分辨率直链，修复面板穿透，支持实时进度显示
// @author       You
// @include      https://hanime*.*/search?*
// @grant        GM_xmlhttpRequest
// @connect      www.hanime2.cc
// @connect      hanime1.me
// @connect      hanime2.top
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

    // 直链获取相关变量
    let isBatchProcessing = false;
    let processedCount = 0;
    let successCount = 0;
    let failCount = 0;
    let currentResolution = '1080p';
    let targetDomain = 'hanime2.top';
    let results = [];
    let abortController = null;

    // 配置
    const CONFIG = {
        resolutionPriority: ['2160p', '1080p', '720p', '480p', '360p'],
        concurrency: 2,
        timeout: 15000
    };

    // ==================== 样式定义 ====================
    const style = document.createElement('style');
    style.textContent = `
        /* 主按钮样式 */
        #selectorToggleBtn {
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
        #selectorToggleBtn:hover {
            transform: scale(1.1);
            background: #ff4d5a;
        }
        #selectorToggleBtn.active {
            background: #333;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }

        /* 展开面板样式 - 修复鼠标事件穿透 */
        #selectorPanel {
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
            min-width: 300px;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            border-left: 3px solid #e63946;
            max-height: 80vh;
            overflow-y: auto;
            pointer-events: auto;
        }
        #selectorPanel.show {
            transform: translateX(0);
        }

        /* 面板内部所有元素都要接收鼠标事件 */
        #selectorPanel * {
            pointer-events: auto;
        }

        /* 面板内部样式 */
        #selectorPanel button {
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
            z-index: 10002;
        }
        #selectorPanel button:hover {
            background: #666;
        }
        #selectorPanel button.primary {
            background: #e63946;
            width: 100%;
            margin: 5px 0;
        }
        #selectorPanel button.primary:hover {
            background: #ff4d5a;
        }
        #selectorPanel button.full-width {
            width: 100%;
            margin: 5px 0;
        }
        #selectorPanel button.success {
            background: #28a745;
        }
        #selectorPanel button.success:hover {
            background: #34ce57;
        }
        #selectorPanel .status {
            margin: 15px 0 10px;
            font-size: 14px;
            color: #aaa;
            text-align: center;
            padding: 8px;
            background: #333;
            border-radius: 4px;
        }
        #selectorPanel .selected-count {
            color: #e63946;
            font-weight: bold;
            font-size: 24px;
            display: block;
        }
        #selectorPanel .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 1px solid #444;
            padding-bottom: 8px;
        }
        #selectorPanel .panel-header span {
            font-weight: bold;
            color: #e63946;
        }
        #selectorPanel .close-btn {
            background: transparent;
            border: none;
            color: #999;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            width: auto;
            margin: 0;
        }
        #selectorPanel .close-btn:hover {
            color: white;
            background: transparent;
        }

        /* 直链提取区域样式 */
        .extractor-section {
            margin-top: 15px;
            border-top: 1px solid #444;
            padding-top: 15px;
        }
        .extractor-section h3 {
            color: #e63946;
            font-size: 14px;
            margin: 0 0 10px 0;
        }
        .form-group {
            margin-bottom: 10px;
        }
        .form-group label {
            display: block;
            font-size: 12px;
            color: #aaa;
            margin-bottom: 3px;
        }
        .form-group input, .form-group select {
            width: 100%;
            padding: 8px;
            background: #333;
            border: 1px solid #444;
            color: white;
            border-radius: 4px;
            box-sizing: border-box;
        }
        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: #e63946;
        }
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
        }
        .log-item {
            padding: 2px 0;
            border-bottom: 1px solid #333;
            color: #0f0;
        }
        .log-item.success { color: #51cf66; }
        .log-item.error { color: #ff6b6b; }
        .log-item.warning { color: #ffd93d; }
        .log-item.info { color: #17a2b8; }

        /* 视频卡片选择样式 */
        .video-item-container.selectable {
            position: relative;
            cursor: crosshair !important;
            transition: all 0.2s;
            user-select: none;
        }
        .video-item-container.selectable:hover {
            opacity: 0.9;
            transform: scale(1.01);
            box-shadow: 0 0 0 2px #e63946;
            z-index: 100;
        }
        .video-item-container.selected {
            opacity: 0.8;
            box-shadow: 0 0 0 3px #e63946, 0 0 15px rgba(230, 57, 70, 0.7);
            border-radius: 4px;
        }
        .video-item-container.selected::after {
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
            animation: popIn 0.2s ease;
        }
        @keyframes popIn {
            from { transform: scale(0); }
            to { transform: scale(1); }
        }

        /* 拖动选框 */
        #dragSelectBox {
            position: fixed;
            background: rgba(230, 57, 70, 0.2);
            border: 2px solid #e63946;
            border-radius: 2px;
            pointer-events: none;
            z-index: 10002;
            box-shadow: 0 0 0 1px rgba(255,255,255,0.3);
            display: none;
        }
        #dragSelectBox.show {
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
            animation: slideDown 0.3s ease;
            border: 1px solid rgba(255,255,255,0.2);
            backdrop-filter: blur(5px);
            white-space: nowrap;
        }
        .selection-mode-hint .key-highlight {
            background: rgba(255,255,255,0.2);
            padding: 2px 8px;
            border-radius: 4px;
            margin: 0 5px;
            border: 1px solid rgba(255,255,255,0.3);
        }
        @keyframes slideDown {
            from { transform: translate(-50%, -100%); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }

        /* 提示气泡 */
        .tooltip {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.9);
            color: #e63946;
            padding: 10px 20px;
            border-radius: 30px;
            font-size: 14px;
            z-index: 10002;
            animation: fadeInOut 3s ease;
            border: 1px solid #e63946;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            pointer-events: none;
        }
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(10px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
        }

        /* 遮罩层 */
        #dragOverlay {
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
        #dragOverlay.active {
            display: block;
        }
    `;
    document.head.appendChild(style);

    // ==================== UI元素创建 ====================

    // 创建主按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'selectorToggleBtn';
    toggleBtn.innerHTML = '🎬';
    document.body.appendChild(toggleBtn);

    // 创建展开面板（增强版）
    const panel = document.createElement('div');
    panel.id = 'selectorPanel';
    panel.innerHTML = `
        <div class="panel-header">
            <span>📋 视频选择器 + 直链提取</span>
            <button class="close-btn" id="closePanelBtn">✕</button>
        </div>

        <!-- 选择模式控制 -->
        <button id="enterSelectionMode" class="primary">🔍 开始选择视频</button>
        <button id="exitSelectionMode" class="full-width" style="display: none; background: #555;">✕ 退出选择模式</button>

        <div class="status">
            已选中 <span class="selected-count" id="selectedCount">0</span> 个视频
        </div>

        <button id="selectAllBtn" class="full-width">全选当前页</button>
        <button id="unselectAllBtn" class="full-width">取消全选</button>

        <!-- 直链提取区域 -->
        <div class="extractor-section">
            <h3>🎥 批量直链提取</h3>

            <div class="form-group">
                <label>替换域名:</label>
                <input type="text" id="targetDomain" value="hanime2.top" placeholder="例如: hanime2.top">
            </div>

            <div class="form-group">
                <label>目标分辨率:</label>
                <select id="resolutionSelect">
                    <option value="2160p">4K (2160p)</option>
                    <option value="1080p" selected>1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="360p">360p</option>
                </select>
            </div>

            <button id="startBatchExtract" class="primary full-width">🚀 开始批量提取直链</button>
            <button id="stopBatchExtract" class="full-width" style="background: #dc3545; display: none;">⏹️ 停止提取</button>

            <div class="stats">
                <span>进度:</span> <span id="progressStats">0/0</span>
            </div>
            <div class="stats">
                <span>成功:</span> <span id="successCount" style="color:#28a745;">0</span>
                <span>失败:</span> <span id="failCount" style="color:#e63946;">0</span>
            </div>

            <div class="progress-bar">
                <div class="progress-fill" id="progressFill" style="width: 0%;">0%</div>
            </div>

            <div class="log-container" id="logContainer">
                <div class="log-item info">准备就绪，请选择视频后开始提取</div>
            </div>

            <button id="exportResultsBtn" class="full-width success">📥 导出结果 (JSON)</button>
        </div>

        <div class="key-hint" style="font-size: 12px; color: #888; margin-top: 8px; padding-top: 8px; border-top: 1px solid #333; text-align: center;">
            <span>拖动</span> 框选 · <span>Ctrl+拖动</span> 追加 · <span>Shift+点击</span> 区间 · <span>ESC</span> 退出
        </div>
    `;
    document.body.appendChild(panel);

    // 创建拖动选框、遮罩层、提示条
    const dragBox = document.createElement('div');
    dragBox.id = 'dragSelectBox';
    document.body.appendChild(dragBox);

    const overlay = document.createElement('div');
    overlay.id = 'dragOverlay';
    document.body.appendChild(overlay);

    const hint = document.createElement('div');
    hint.className = 'selection-mode-hint';
    hint.style.display = 'none';
    hint.innerHTML = `
        🖱️ <span class="key-highlight">拖动</span> 框选 ·
        <span class="key-highlight">Ctrl+拖动</span> 追加 ·
        <span class="key-highlight">Shift+点击</span> 区间 ·
        <span class="key-highlight">ESC</span> 退出
    `;
    document.body.appendChild(hint);

    // ==================== 工具函数 ====================

    // 添加日志
    function addLog(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        const logItem = document.createElement('div');
        logItem.className = `log-item ${type}`;
        logItem.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContainer.appendChild(logItem);
        logContainer.scrollTop = logContainer.scrollHeight;
        console.log(`[视频提取器] ${message}`);
    }

    // 显示提示气泡
    function showTooltip(message, duration = 3000) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = message;
        document.body.appendChild(tooltip);
        setTimeout(() => tooltip.remove(), duration);
    }

    // 更新进度
    function updateProgress(current, total) {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('progressFill').textContent = percent + '%';
        document.getElementById('progressStats').textContent = `${current}/${total}`;
        document.getElementById('successCount').textContent = successCount;
        document.getElementById('failCount').textContent = failCount;
    }

    // 获取所有视频元素并排序
    function getVideoItems() {
        const items = Array.from(document.querySelectorAll('.video-item-container'));
        return items.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            if (Math.abs(rectA.top - rectB.top) < 20) {
                return rectA.left - rectB.left;
            }
            return rectA.top - rectB.top;
        });
    }

    // 更新所有视频的可选状态
    function updateSelectableState(enable) {
        const items = getVideoItems();
        items.forEach(item => {
            if (enable) {
                item.classList.add('selectable');
            } else {
                item.classList.remove('selectable', 'selected');
            }
        });
    }

    // 更新选择计数
    function updateSelectedCount() {
        const count = document.querySelectorAll('.video-item-container.selected').length;
        document.getElementById('selectedCount').textContent = count;
    }

    // 获取选中的视频链接
    function getSelectedVideoLinks() {
        const selectedItems = document.querySelectorAll('.video-item-container.selected');
        const links = [];

        selectedItems.forEach(item => {
            const linkElement = item.querySelector('a.video-link');
            const titleElement = item.querySelector('.title');
            const subtitleElement = item.querySelector('.subtitle a');

            if (linkElement) {
                links.push({
                    originalUrl: linkElement.href,
                    title: titleElement ? titleElement.innerText.trim() : '未知标题',
                    author: subtitleElement ? subtitleElement.innerText.trim() : '未知作者',
                    videoId: extractVideoId(linkElement.href)
                });
            }
        });

        return links;
    }

    // 提取视频ID
    function extractVideoId(url) {
        const match = url.match(/[?&]v=(\d+)/);
        return match ? match[1] : '';
    }

    // 替换域名
    function replaceDomain(url, newDomain) {
        try {
            const urlObj = new URL(url);
            urlObj.hostname = newDomain;
            return urlObj.toString();
        } catch (e) {
            return url.replace(/https?:\/\/[^\/]+/, `https://${newDomain}`);
        }
    }

    // 检查元素是否在选框内
    function isElementInBox(element, boxLeft, boxTop, boxRight, boxBottom) {
        const rect = element.getBoundingClientRect();
        return rect.left < boxRight && rect.right > boxLeft &&
               rect.top < boxBottom && rect.bottom > boxTop;
    }

    // 处理拖动选择
    function handleDragSelect() {
        const items = getVideoItems();
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

    // 获取元素索引
    function getElementIndex(element) {
        const items = getVideoItems();
        return items.indexOf(element);
    }

    // 处理Shift+点击区间选择
    function handleShiftClick(currentElement) {
        const items = getVideoItems();
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

    // 为所有视频添加点击事件
    function addClickHandlers() {
        const items = getVideoItems();
        items.forEach((item, index) => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);

            newItem.addEventListener('click', function(e) {
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
                                    lastSelectedIndex = getElementIndex(selectedItems[0]);
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

            newItem.dataset.index = index;
        });
    }

    // ==================== 直链提取功能 (基于1.0的工作逻辑) ====================

    // 从HTML中提取视频链接
    function extractVideoLinksFromHtml(html, url) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const videoLinks = [];

        // 查找video标签下的source
        const videos = doc.querySelectorAll('video');
        videos.forEach((video, videoIndex) => {
            const sources = video.querySelectorAll('source[src]');
            sources.forEach((source, sourceIndex) => {
                const src = source.src;
                if (!src) return;

                let resolution = source.getAttribute('size') || '未知';
                if (resolution === '未知' && video.videoWidth && video.videoHeight) {
                    resolution = `${video.videoWidth}x${video.videoHeight}`;
                }

                // 标准化分辨率格式
                if (resolution.includes('2160') || resolution.includes('4K')) resolution = '2160p';
                else if (resolution.includes('1080') || resolution.includes('1920x1080')) resolution = '1080p';
                else if (resolution.includes('720') || resolution.includes('1280x720')) resolution = '720p';
                else if (resolution.includes('480') || resolution.includes('854x480')) resolution = '480p';
                else if (resolution.includes('360') || resolution.includes('640x360')) resolution = '360p';

                videoLinks.push({
                    src: src,
                    resolution: resolution,
                    index: videoLinks.length
                });
            });
        });

        // 如果没找到，尝试查找直接的video src
        if (videoLinks.length === 0) {
            const videoElements = doc.querySelectorAll('video[src]');
            videoElements.forEach(video => {
                videoLinks.push({
                    src: video.src,
                    resolution: '未知',
                    index: videoLinks.length
                });
            });
        }

        return videoLinks;
    }

    // 根据优先级选择最佳分辨率
    function selectBestResolution(links, preferredResolution) {
        if (!links || links.length === 0) return null;

        // 先找首选分辨率
        const exactMatch = links.find(link =>
            link.resolution.includes(preferredResolution) ||
            (preferredResolution === '2160p' && link.resolution.includes('4K'))
        );
        if (exactMatch) return exactMatch;

        // 按优先级降级查找
        const priority = CONFIG.resolutionPriority;
        const preferredIndex = priority.indexOf(preferredResolution);

        for (let i = preferredIndex + 1; i < priority.length; i++) {
            const res = priority[i];
            const match = links.find(link =>
                link.resolution.includes(res) ||
                (res === '2160p' && link.resolution.includes('4K'))
            );
            if (match) return match;
        }

        // 如果都没有，返回第一个
        return links[0];
    }

    // 获取单个视频的链接（带重试）
    async function fetchVideoLinks(item, preferredResolution, retryCount = 2) {
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                if (attempt > 0) {
                    addLog(`重试 (${attempt}/${retryCount}): ${item.title}`, 'warning');
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }

                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: item.newUrl,
                        timeout: CONFIG.timeout,
                        onload: resolve,
                        onerror: reject,
                        ontimeout: reject
                    });
                });

                if (response.status !== 200) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const links = extractVideoLinksFromHtml(response.responseText, item.newUrl);

                if (links.length > 0) {
                    addLog(`找到 ${links.length} 个视频流: ${item.title}`, 'info');
                    const bestLink = selectBestResolution(links, preferredResolution);

                    if (bestLink) {
                        addLog(`选择分辨率: ${bestLink.resolution}`, 'success');
                        return {
                            ...item,
                            videoUrl: bestLink.src,
                            resolution: bestLink.resolution,
                            allLinks: links
                        };
                    }
                }

                addLog(`未找到视频流: ${item.title}`, 'warning');
                return {
                    ...item,
                    videoUrl: null,
                    resolution: null,
                    error: '未找到视频流',
                    allLinks: []
                };

            } catch (error) {
                addLog(`请求失败 (${attempt + 1}/${retryCount + 1}): ${item.title} - ${error.message}`, 'error');
                if (attempt === retryCount) {
                    return {
                        ...item,
                        videoUrl: null,
                        resolution: null,
                        error: error.message,
                        allLinks: []
                    };
                }
            }
        }
        return null;
    }

    // 批量获取视频链接（带并发控制）
    async function batchFetchVideoLinks(items, preferredResolution) {
        const results = [];
        const total = items.length;
        let completed = 0;

        updateProgress(0, total);
        addLog(`开始批量提取 ${total} 个视频...`);

        // 并发控制
        for (let i = 0; i < items.length; i += CONFIG.concurrency) {
            if (!isBatchProcessing) break;

            const batch = items.slice(i, i + CONFIG.concurrency);
            const promises = batch.map(item => fetchVideoLinks(item, preferredResolution));

            const batchResults = await Promise.all(promises);

            batchResults.forEach(result => {
                results.push(result);
                if (result.videoUrl) {
                    successCount++;
                } else {
                    failCount++;
                }
            });

            completed += batch.length;
            updateProgress(completed, total);

            // 批次间延时
            if (i + CONFIG.concurrency < items.length && isBatchProcessing) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }

        addLog(`提取完成: 成功 ${successCount}/${total}`, 'success');
        return results;
    }

    // 开始批量处理
    async function startBatchProcessing() {
        const selectedLinks = getSelectedVideoLinks();

        if (selectedLinks.length === 0) {
            showTooltip('⚠️ 请先选择视频');
            return;
        }

        // 获取配置
        targetDomain = document.getElementById('targetDomain').value.trim();
        currentResolution = document.getElementById('resolutionSelect').value;

        if (!targetDomain) {
            showTooltip('⚠️ 请输入替换域名');
            return;
        }

        // 重置状态
        isBatchProcessing = true;
        processedCount = 0;
        successCount = 0;
        failCount = 0;
        results = [];
        abortController = new AbortController();

        // 更新UI
        document.getElementById('startBatchExtract').style.display = 'none';
        document.getElementById('stopBatchExtract').style.display = 'block';
        document.getElementById('logContainer').innerHTML = '';

        addLog(`开始批量提取，共 ${selectedLinks.length} 个视频`, 'info');
        addLog(`目标域名: ${targetDomain}`, 'info');
        addLog(`目标分辨率: ${currentResolution}`, 'info');

        // 准备处理项
        const items = selectedLinks.map(item => ({
            ...item,
            newUrl: replaceDomain(item.originalUrl, targetDomain)
        }));

        // 批量处理
        results = await batchFetchVideoLinks(items, currentResolution);

        // 处理完成
        isBatchProcessing = false;
        document.getElementById('startBatchExtract').style.display = 'block';
        document.getElementById('stopBatchExtract').style.display = 'none';

        addLog(`批量处理完成！成功: ${successCount}, 失败: ${failCount}`, 'info');
        showTooltip(`✅ 批量处理完成，成功: ${successCount}, 失败: ${failCount}`);
    }

    // 停止批量处理
    function stopBatchProcessing() {
        isBatchProcessing = false;
        if (abortController) {
            abortController.abort();
        }
        document.getElementById('startBatchExtract').style.display = 'block';
        document.getElementById('stopBatchExtract').style.display = 'none';
        addLog('⏹️ 已手动停止提取', 'warning');
    }

    // 导出结果
    function exportResults() {
        if (results.length === 0) {
            showTooltip('⚠️ 没有可导出的数据');
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('query') || 'video';
        const filename = `${query}_${currentResolution}_${results.length}.json`;

        // 构建导出数据结构
        const exportData = {
            query: query,
            resolution: currentResolution,
            targetDomain: targetDomain,
            totalCount: results.length,
            successCount: successCount,
            failCount: failCount,
            timestamp: new Date().toISOString(),
            results: results.map(item => ({
                title: item.title,
                author: item.author,
                videoId: item.videoId,
                originalUrl: item.originalUrl,
                convertedUrl: item.newUrl,
                videoUrl: item.videoUrl,
                resolution: item.resolution,
                error: item.error
            }))
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
        showTooltip(`✅ 已保存到 ${filename}`);
    }

    // ==================== 事件绑定 ====================

    // 初始化点击事件
    addClickHandlers();

    // 键盘事件
    document.addEventListener('keydown', (e) => {
        ctrlPressed = e.ctrlKey;
        shiftPressed = e.shiftKey;

        if (e.key === 'Escape') {
            if (selectionMode) {
                document.getElementById('exitSelectionMode').click();
            }
            if (panel.classList.contains('show')) {
                panel.classList.remove('show');
                toggleBtn.classList.remove('active');
            }
            if (isBatchProcessing) {
                stopBatchProcessing();
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
        if (e.target.closest('#selectorToggleBtn') || e.target.closest('#selectorPanel')) return;
        if (e.target.closest('.video-item-container')) return;

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

    // 面板上的鼠标事件处理 - 阻止事件传播
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('mouseup', (e) => e.stopPropagation());
    panel.addEventListener('click', (e) => e.stopPropagation());

    // 切换面板显示
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('show');
        toggleBtn.classList.toggle('active');
    });

    // 关闭面板
    document.getElementById('closePanelBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.remove('show');
        toggleBtn.classList.remove('active');
    });

    // 进入选择模式
    document.getElementById('enterSelectionMode').addEventListener('click', (e) => {
        e.stopPropagation();
        selectionMode = true;
        lastSelectedIndex = -1;
        updateSelectableState(true);
        document.getElementById('enterSelectionMode').style.display = 'none';
        document.getElementById('exitSelectionMode').style.display = 'block';
        hint.style.display = 'block';
        updateSelectedCount();
        showTooltip('✨ 选择模式已开启');

        setTimeout(() => {
            panel.classList.remove('show');
            toggleBtn.classList.remove('active');
        }, 500);
    });

    // 退出选择模式
    document.getElementById('exitSelectionMode').addEventListener('click', (e) => {
        e.stopPropagation();
        selectionMode = false;
        lastSelectedIndex = -1;
        isDragging = false;
        dragBox.classList.remove('show');
        overlay.classList.remove('active');
        updateSelectableState(false);
        document.getElementById('enterSelectionMode').style.display = 'block';
        document.getElementById('exitSelectionMode').style.display = 'none';
        hint.style.display = 'none';
        showTooltip('选择模式已关闭');
    });

    // 全选
    document.getElementById('selectAllBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!selectionMode) {
            showTooltip('⚠️ 请先进入选择模式');
            return;
        }
        const items = getVideoItems();
        items.forEach(item => item.classList.add('selected'));
        if (items.length > 0) {
            lastSelectedIndex = items.length - 1;
        }
        updateSelectedCount();
        showTooltip(`✅ 已全选 ${items.length} 个视频`);
    });

    // 取消全选
    document.getElementById('unselectAllBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!selectionMode) {
            showTooltip('⚠️ 请先进入选择模式');
            return;
        }
        getVideoItems().forEach(item => item.classList.remove('selected'));
        lastSelectedIndex = -1;
        updateSelectedCount();
        showTooltip('已取消全选');
    });

    // 开始批量提取
    document.getElementById('startBatchExtract').addEventListener('click', (e) => {
        e.stopPropagation();
        startBatchProcessing();
    });

    // 停止批量提取
    document.getElementById('stopBatchExtract').addEventListener('click', (e) => {
        e.stopPropagation();
        stopBatchProcessing();
    });

    // 导出结果
    document.getElementById('exportResultsBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        exportResults();
    });

    // 点击页面其他地方关闭面板
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !toggleBtn.contains(e.target) && panel.classList.contains('show')) {
            panel.classList.remove('show');
            toggleBtn.classList.remove('active');
        }
    });

    console.log('修复版视频选择器+直链提取器 v3.0 已加载');
})();