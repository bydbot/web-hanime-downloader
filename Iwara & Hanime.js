// ==UserScript==
// @name         iwara & hanime1 视频比对
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  标题词干匹配 + 时长精确过滤 + 可调节秒数容差
// @author       bydbot+trae
// @match        https://www.iwara.tv/*
// @match        https://hanime1.me/*
// @match        https://hanime2.top/*
// @match        https://www.hanime2.top/*
// @match        https://www.hanime2.vip/*
// @match        https://www.hanime2.cc/*
// @match        https://www.hanime163.top/*
// @match        https://www.hanime365.top/*
// @match        https://www.hanime1-me.top/*
// @match        https://www.hanime1.sbs/*
// @match        https://www.hanime1-me.cc/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- 样式定义 (添加新样式) ---
    GM_addStyle(`
        #matcher-toggle-btn {
            position: fixed;
            background: linear-gradient(135deg, #00ccff, #0066ff);
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            cursor: pointer;
            z-index: 99999;
            box-shadow: 0 4px 15px rgba(0,102,255,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            transition: all 0.3s ease;
            user-select: none;
            border: 2px solid rgba(255,255,255,0.2);
        }
        #matcher-toggle-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0,102,255,0.6);
            background: linear-gradient(135deg, #0066ff, #00ccff);
        }

        #matcher-panel {
            position: fixed;
            background: #1a1a1a;
            color: #eee;
            z-index: 10000;
            padding: 12px;
            border-radius: 10px;
            font-family: sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.7);
            border: 1px solid #333;
            display: none;
            flex-direction: column;
            min-width: 900px;
            max-width: 95vw;
            min-height: 500px;
            max-height: 90vh;
            overflow: hidden;
            backdrop-filter: blur(5px);
            resize: both;
        }
        .panel-header {
            border-bottom: 1px solid #333;
            padding: 8px 8px 8px 12px;
            margin: -12px -12px 10px -12px;
            background: #222;
            border-radius: 10px 10px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .panel-header h3 {
            margin: 0;
            font-size: 14px;
            color: #00ccff;
        }
        .close-btn {
            cursor: pointer;
            color: #888;
            font-size: 18px;
            line-height: 1;
            padding: 0 8px;
        }
        .close-btn:hover {
            color: #ff4444;
        }

        .stat-banner {
            display: flex;
            justify-content: space-around;
            background: #252525;
            padding: 6px;
            border-radius: 6px;
            margin-bottom: 10px;
            font-size: 11px;
            border: 1px solid #333;
        }
        .stat-item b {
            color: #00ffcc;
        }

        .progress-container {
            width: 100%;
            height: 4px;
            background: #333;
            border-radius: 2px;
            margin-bottom: 10px;
            overflow: hidden;
            display: none;
        }
        #progress-bar {
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #00ccff, #00ffcc);
            transition: width 0.1s;
        }

        .filter-controls {
            background: #252525;
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 10px;
            border: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .filter-item {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        .filter-item label {
            width: 80px;
            font-size: 11px;
            color: #aaa;
        }
        .filter-item input[type=number] {
            width: 70px;
            background: #333;
            color: #fff;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px 6px;
            font-size: 11px;
        }
        .filter-item span {
            font-size: 10px;
            color: #666;
        }
        .filter-hint {
            font-size: 10px;
            color: #ffaa00;
            text-align: center;
            margin-top: 5px;
        }
        .swap-mode-btn {
            background: #3a3a3a;
            color: #fff;
            border: 1px solid #444;
            padding: 6px 12px;
            border-radius: 5px;
            font-size: 11px;
            cursor: pointer;
            transition: 0.2s;
            white-space: nowrap;
            flex-shrink: 0;
            margin-left: 10px;
        }
        .swap-mode-btn:hover {
            background: #4a4a4a;
            border-color: #00ccff;
        }
        .swap-mode-btn.active {
            background: #00ccff;
            color: #000;
            border-color: #00ccff;
            box-shadow: 0 0 10px rgba(0, 204, 255, 0.5);
        }
        .column-swap-ready {
            cursor: pointer;
            box-shadow: 0 0 15px rgba(0, 204, 255, 0.6);
            border-color: #00ccff !important;
        }
        .column-swap-selected {
            cursor: pointer;
            box-shadow: 0 0 20px rgba(255, 170, 0, 0.8);
            border-color: #ffaa00 !important;
            background: rgba(255, 170, 0, 0.1);
        }

        .threshold-wrap {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 12px;
            margin-bottom: 10px;
            color: #aaa;
        }
        input[type=range] {
            flex: 1;
            cursor: pointer;
        }

        .compare-container {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            flex: 1;
            min-height: 200px;
            overflow: hidden;
        }
        .compare-column {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #000;
            border-radius: 6px;
            padding: 6px;
            border: 1px solid #222;
            overflow: hidden;
            min-width: 0;
            transition: none;
            position: relative;
        }
        .compare-column-placeholder {
            flex: 1;
            min-height: 200px;
            background: #000;
            border-radius: 6px;
            border: 1px solid #222;
        }
        #matched-column {
            background: #0a1a1a;
            border: 1px solid #00ff88;
        }
        .column-header {
            font-size: 11px;
            font-weight: bold;
            color: #888;
            border-bottom: 1px solid #333;
            margin-bottom: 8px;
            padding: 4px;
            display: flex;
            justify-content: space-between;
            flex-shrink: 0;
            user-select: none;
        }
        .column-header:hover {
            color: #00ccff;
            background: rgba(0, 204, 255, 0.1);
            border-radius: 4px;
        }
        .diff-count {
            color: #ff4444;
            font-size: 12px;
        }
        .list-content {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            font-size: 11px;
            min-height: 100px;
            scrollbar-width: thin;
            scrollbar-color: #444 #1a1a1a;
        }

        .diff-item {
            border-bottom: 1px solid #1a1a1a;
            padding: 8px 5px;
            transition: 0.2s;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .diff-item:hover {
            background: #222;
        }
        .item-title {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .item-title a {
            color: #5cafff;
            text-decoration: none;
        }
        .item-duration-iwara {
            color: #ffaa00;
            font-size: 10px;
            margin-left: 10px;
            flex-shrink: 0;
            font-family: monospace;
            background: #333;
            padding: 2px 6px;
            border-radius: 12px;
            border-left: 2px solid #ffaa00;
        }
        .item-duration-hanime1 {
            color: #00ffaa;
            font-size: 10px;
            margin-left: 10px;
            flex-shrink: 0;
            font-family: monospace;
            background: #333;
            padding: 2px 6px;
            border-radius: 12px;
            border-left: 2px solid #00ffaa;
        }

        .btn-row {
            display: flex;
            gap: 6px;
            margin-bottom: 10px;
        }
        button {
            flex: 1;
            cursor: pointer;
            background: #2a2a2a;
            color: #fff;
            border: 1px solid #444;
            padding: 8px;
            border-radius: 5px;
            font-size: 11px;
            transition: 0.2s;
        }
        button:hover {
            background: #3a3a3a;
            border-color: #00ccff;
        }
        .btn-capture {
            background: #004a80 !important;
            font-weight: bold;
        }

        .similarity-badge {
            display: inline-block;
            background: #333;
            color: #ffaa00;
            font-size: 10px;
            padding: 2px 5px;
            border-radius: 10px;
            margin-left: 5px;
        }

        /* 滚动条样式 */
        .list-content::-webkit-scrollbar {
            width: 6px;
        }
        .list-content::-webkit-scrollbar-track {
            background: #1a1a1a;
        }
        .list-content::-webkit-scrollbar-thumb {
            background: #444;
            border-radius: 3px;
        }
        .list-content::-webkit-scrollbar-thumb:hover {
            background: #666;
        }
    `);

    // --- 工具函数：解析时长字符串为秒数 ---
    function parseDuration(durationStr) {
        if (!durationStr) return null;

        const timeMatch = durationStr.match(/(\d+):(\d+)(?::(\d+))?/);
        if (timeMatch) {
            const minutes = parseInt(timeMatch[1]);
            const seconds = parseInt(timeMatch[2]);
            const hours = timeMatch[3] ? parseInt(timeMatch[3]) : 0;

            if (hours > 0) {
                return hours * 3600 + minutes * 60 + seconds;
            } else {
                return minutes * 60 + seconds;
            }
        }

        return null;
    }

    // --- 格式化时长显示 ---
    function formatDuration(seconds) {
        if (seconds === null || seconds === undefined) return '无时长';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // --- 检查时长是否匹配 ---
    function isDurationMatch(dur1, dur2, tolerance) {
        if (dur1 === null || dur2 === null) return false;
        return Math.abs(dur1 - dur2) <= tolerance;
    }

    // --- 词干提取 ---
    function stemWord(word) {
        if (/^\d+$/.test(word)) {
            return word;
        }
        return word
            .toLowerCase()
            .replace(/(ing|ed|s|es|ies|ly|er|est|tion|ive|able|ible|al|y)$/, '')
            .replace(/[^\w\u4e00-\u9fa5]/g, '');
    }

    // --- 清洗标题 ---
    function cleanTitle(title) {
        if (!title) return "";
        return title
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/【.*?】/g, '')
            .replace(/[:：]/g, ' ')
            .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\u200d|\uFE0F/g, '')
            .replace(/[^\w\s\u4e00-\u9fa5]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    // --- 标题相似度 (词干匹配) ---
    function titleSimilarity(s1, s2) {
        const words1 = s1.split(/\s+/).filter(w => w.length > 0).map(stemWord);
        const words2 = s2.split(/\s+/).filter(w => w.length > 0).map(stemWord);

        if (words1.length === 0 || words2.length === 0) {
            return charSimilarity(s1, s2);
        }

        const set1 = new Set(words1);
        const set2 = new Set(words2);

        let intersection = 0;
        for (const word of set1) {
            if (set2.has(word)) intersection++;
        }

        const union = set1.size + set2.size - intersection;
        const jaccard = union > 0 ? intersection / union : 0;

        const coverage1 = set1.size > 0 ? intersection / set1.size : 0;
        const coverage2 = set2.size > 0 ? intersection / set2.size : 0;

        return jaccard * 0.4 + (coverage1 + coverage2) / 2 * 0.6;
    }

    // --- 字符级相似度 ---
    function charSimilarity(s1, s2) {
        let longer = s1, shorter = s2;
        if (s1.length < s2.length) [longer, shorter] = [shorter, longer];
        if (longer.length === 0) return 1.0;

        const distance = editDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    function editDistance(s1, s2) {
        let costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) costs[j] = j;
                else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }

    // --- UI 元素 ---
    let toggleBtn, panel, progressBar, progressContainer;
    let thresholdInput, thresholdVal;
    let toleranceInput;

    // --- 创建唤出按钮 ---
    function createToggleButton() {
        console.log('[iwara & hanime1me] 开始创建按钮...');

        toggleBtn = document.createElement('div');
        toggleBtn.id = 'matcher-toggle-btn';
        toggleBtn.innerHTML = '⚡';
        toggleBtn.title = '打开比对面板';

        toggleBtn.style.position = 'fixed';
        toggleBtn.style.zIndex = '99999';
        toggleBtn.style.right = '20px';
        toggleBtn.style.bottom = '20px';

        console.log('[iwara & hanime1me] 按钮元素已创建，准备添加到页面');
        document.body.appendChild(toggleBtn);
        console.log('[iwara & hanime1me] 按钮已添加到页面');

        toggleBtn.addEventListener('click', (e) => {
            console.log('[iwara & hanime1me] 按钮被点击');
            showPanel();
        });

        console.log('[iwara & hanime1me] 按钮创建完成');
    }

    // --- 显示面板 ---
    function showPanel() {
        if (!panel) {
            initPanel();
        }

        if (panel.style.display === 'flex') {
            // 隐藏面板
            panel.style.display = 'none';
            toggleBtn.innerHTML = '⚡';
            toggleBtn.title = '打开比对面板';
        } else {
            // 显示面板
            panel.style.display = 'flex';
            toggleBtn.innerHTML = '×';
            toggleBtn.title = '关闭比对面板';

            // 强制浏览器计算尺寸
            setTimeout(() => {
                centerPanel();
            }, 10);

            updateStats();
        }
    }

    // --- 切换列扩展 ---
    function toggleColumnExpand(columnId, listId) {
        const column = document.getElementById(columnId);
        const listContent = document.getElementById(listId);

        if (!column || !listContent) return;

        const placeholderId = columnId + '-placeholder';

        // 获取所有可见列
        const container = document.getElementById('compare-container');
        const allColumns = Array.from(container.querySelectorAll('.compare-column'));
        const visibleColumns = allColumns.filter(col => col.style.display !== 'none');
        const columnCount = visibleColumns.length;

        // 获取容器实际宽度
        const containerWidth = container.offsetWidth;
        // 总间距 = (列数 - 1) * 10px
        const totalGap = (columnCount - 1) * 10;
        // 每列的实际宽度（像素）
        const columnPixelWidth = (containerWidth - totalGap) / columnCount;

        if (column.classList.contains('expanded')) {
            // 收缩：移除占位元素
            column.classList.remove('expanded', 'iwara-expanded', 'hanime-expanded', 'matched-expanded');
            const placeholder = document.getElementById(placeholderId);
            if (placeholder) placeholder.remove();

            // 清除展开时设置的样式
            column.style.position = '';
            column.style.left = '';
            column.style.right = '';
            column.style.width = '';
            column.style.top = '';
            column.style.height = '';
            column.style.zIndex = '';
            column.style.background = '';
            column.style.boxShadow = '';
            column.style.border = '';

            // 重新布局所有列
            updateColumnPositions();
        } else {
            // 每个展开的列都需要有自己的占位符
            // 检查当前列是否已经有占位符
            const existingPlaceholder = document.getElementById(placeholderId);
            if (!existingPlaceholder) {
                // 创建占位元素 - 精确设置宽度以保持布局
                const placeholder = document.createElement('div');
                placeholder.id = placeholderId;
                placeholder.className = 'compare-column-placeholder';
                // 使用精确的像素宽度而不是 flex: 1
                placeholder.style.width = columnPixelWidth + 'px';
                placeholder.style.minWidth = columnPixelWidth + 'px';
                placeholder.style.maxWidth = columnPixelWidth + 'px';
                placeholder.style.minHeight = '200px';
                placeholder.style.background = '#000';
                placeholder.style.borderRadius = '6px';
                placeholder.style.border = '1px solid #222';
                placeholder.style.flexShrink = '0'; // 防止被压缩
                column.parentNode.insertBefore(placeholder, column.nextSibling);
            }

            // 扩展当前列
            column.classList.add('expanded');

            // 根据列的类型添加不同的样式
            if (columnId === 'iwara-column') {
                column.classList.add('iwara-expanded');
            } else if (columnId === 'hanime1me-column') {
                column.classList.add('hanime-expanded');
            } else if (columnId === 'matched-column') {
                column.classList.add('matched-expanded');
            }

            // 更新所有列的位置
            updateColumnPositions();
        }
    }

    // --- 更新列位置 ---
    function updateColumnPositions() {
        const container = document.getElementById('compare-container');
        const allColumns = Array.from(container.querySelectorAll('.compare-column'));
        const visibleColumns = allColumns.filter(col => col.style.display !== 'none');
        const columnCount = visibleColumns.length;

        // 获取容器实际宽度
        const containerWidth = container.offsetWidth;
        // 总间距 = (列数 - 1) * 10px
        const totalGap = (columnCount - 1) * 10;
        // 每列的实际宽度（像素）
        const columnPixelWidth = (containerWidth - totalGap) / columnCount;
        // 列宽度百分比
        const columnWidthPercent = (columnPixelWidth / containerWidth) * 100;

        // 更新所有占位符的宽度（确保响应式）
        visibleColumns.forEach((col, index) => {
            const placeholderId = col.id + '-placeholder';
            const placeholder = document.getElementById(placeholderId);
            if (placeholder) {
                placeholder.style.width = columnPixelWidth + 'px';
                placeholder.style.minWidth = columnPixelWidth + 'px';
                placeholder.style.maxWidth = columnPixelWidth + 'px';
            }
        });

        // 重置所有列的定位样式
        visibleColumns.forEach(col => {
            if (!col.classList.contains('expanded')) {
                col.style.position = '';
                col.style.left = '';
                col.style.right = '';
                col.style.width = '';
                col.style.top = '';
                col.style.height = '';
                col.style.zIndex = '';
            }
        });

        // 为扩展的列设置定位
        visibleColumns.forEach(col => {
            if (col.classList.contains('expanded')) {
                const colIndex = visibleColumns.indexOf(col);

                col.style.position = 'absolute';
                col.style.top = '45px';
                col.style.height = 'calc(100% - 57px)';
                col.style.zIndex = '10';
                col.style.background = 'rgba(0, 0, 0, 0.95)';
                col.style.boxShadow = '0 0 30px rgba(0, 204, 255, 0.3)';

                // 根据列的类型设置不同的颜色
                if (col.id === 'iwara-column') {
                    col.style.border = '2px solid #ffffffff';
                } else if (col.id === 'hanime1me-column') {
                    col.style.border = '2px solid #ff0000ff';
                } else if (col.id === 'matched-column') {
                    col.style.border = '2px solid #00ff88';
                }

                // 计算左侧位置：列索引 * (列宽 + 间距)
                const leftPercent = colIndex * (columnWidthPercent + (10 / containerWidth) * 100);
                col.style.left = leftPercent + '%';
                col.style.width = columnWidthPercent + '%';
            }
        });
    }

    // --- 居中面板 (优化版) ---
    function centerPanel() {
        if (!panel) return;

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // 获取面板尺寸
        const panelWidth = panel.offsetWidth || 700;
        const panelHeight = panel.offsetHeight || 600;

        // 计算居中位置
        let left = (windowWidth - panelWidth) / 2;
        let top = (windowHeight - panelHeight) / 2;

        // 确保面板不会超出屏幕边界
        left = Math.max(10, Math.min(left, windowWidth - panelWidth - 10));
        top = Math.max(10, Math.min(top, windowHeight - panelHeight - 10));

        // 应用位置
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        // 确保面板在可视区域内
        if (panelHeight > windowHeight - 20) {
            panel.style.height = (windowHeight - 20) + 'px';
            panel.style.top = '10px';
        }
    }

    // --- 初始化面板 ---
    function initPanel() {
        panel = document.createElement('div');
        panel.id = 'matcher-panel';

        const savedThreshold = GM_getValue('match_threshold', 0.5);
        const savedTolerance = GM_getValue('duration_tolerance', 10);

        panel.innerHTML = `
            <div class="panel-header" id="panel-header">
                <h3>iwara/hanime1 比对器</h3>
                <div class="close-btn" id="close-panel">×</div>
            </div>

            <div class="stat-banner">
                <div class="stat-item">iwara 池：<b id="total-i">0</b></div>
                <div class="stat-item">hanime1 池：<b id="total-h">0</b></div>
            </div>

            <div class="progress-container" id="p-container"><div id="progress-bar"></div></div>

            <div class="filter-controls">
                <div class="filter-item" style="margin-bottom: 0;">
                    <label>时长容差:</label>
                    <input type="number" id="tolerance" min="0" max="300" step="5" value="${savedTolerance}">
                    <span>秒</span>
                    <button class="swap-mode-btn" id="btn-swap-mode">🔄 交换列</button>
                </div>
                <div class="filter-hint" style="margin-top: 5px; margin-left: 10px;">⏱️ 自动舍弃无时长的视频，时长差异 ≤ 容差秒数才匹配</div>
            </div>

            <div class="threshold-wrap">
                <span>标题匹配阈值:</span>
                <input type="range" id="threshold-range" min="0.1" max="1.0" step="0.05" value="${savedThreshold}">
                <span id="threshold-val">${savedThreshold}</span>
            </div>

            <div class="btn-row">
                <button id="btn-cap" class="btn-capture">💾 保存当前页</button>
                <button id="btn-comp">🔍 开始比对</button>
                <button id="btn-clr">🗑️ 清空数据</button>
                <button id="btn-toggle-matched">📋 显示匹配成功列</button>
            </div>

            <div class="compare-container" id="compare-container">
                <div class="compare-column" id="iwara-column" data-column="0">
                    <div class="column-header" style="cursor: pointer;" id="iwara-header">iwara 独有 <span id="diff-i" class="diff-count">0</span></div>
                    <div id="iwara-only" class="list-content"></div>
                </div>
                <div class="compare-column" id="hanime1me-column" data-column="1">
                    <div class="column-header" style="cursor: pointer;" id="hanime1me-header">hanime1 独有 <span id="diff-h" class="diff-count">0</span></div>
                    <div id="hanime1me-only" class="list-content"></div>
                </div>
                <div class="compare-column" id="matched-column" data-column="2" style="display: none;">
                    <div class="column-header" style="cursor: pointer;" id="matched-header">匹配成功 <span id="diff-matched" class="diff-count" style="color: #00ff88;">0</span></div>
                    <div id="matched-list" class="list-content"></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // 初始化元素引用
        progressBar = document.getElementById('progress-bar');
        progressContainer = document.getElementById('p-container');
        thresholdInput = document.getElementById('threshold-range');
        thresholdVal = document.getElementById('threshold-val');
        toleranceInput = document.getElementById('tolerance');

        // 交换列模式变量
        let swapMode = false;
        let selectedColumn = null;

        // 绑定事件
        document.getElementById('btn-cap').onclick = capturePage;
        document.getElementById('btn-comp').onclick = performCompare;
        document.getElementById('btn-clr').onclick = clearPools;
        document.getElementById('btn-toggle-matched').onclick = () => {
            const matchedColumn = document.getElementById('matched-column');
            const btn = document.getElementById('btn-toggle-matched');
            if (matchedColumn.style.display === 'none' || matchedColumn.style.display === '') {
                matchedColumn.style.display = 'flex';
                btn.innerText = '📋 隐藏成功列';

                // 如果在交换模式下，为新显示的匹配列添加蓝色边框
                if (swapMode) {
                    matchedColumn.classList.add('column-swap-ready');
                }
            } else {
                matchedColumn.style.display = 'none';
                btn.innerText = '📋 显示匹配成功列';

                // 如果在交换模式下且匹配列被选中，清除选中状态
                if (selectedColumn && selectedColumn.id === 'matched-column') {
                    selectedColumn.classList.remove('column-swap-selected');
                    selectedColumn = null;
                }
            }
            centerPanel();
            // 更新列位置
            setTimeout(updateColumnPositions, 100);
        };

        // 交换列模式按钮
        const swapModeBtn = document.getElementById('btn-swap-mode');
        swapModeBtn.onclick = () => {
            swapMode = !swapMode;
            swapModeBtn.classList.toggle('active', swapMode);
            swapModeBtn.innerText = swapMode ? '✅ 点击列交换' : '🔄 交换列';

            // 进入交换模式时，自动收缩所有展开的列
            if (swapMode) {
                const columns = panel.querySelectorAll('.compare-column');
                columns.forEach(col => {
                    if (col.classList.contains('expanded')) {
                        // 获取列对应的列表 ID
                        let listId;
                        if (col.id === 'iwara-column') {
                            listId = 'iwara-only';
                        } else if (col.id === 'hanime1me-column') {
                            listId = 'hanime1me-only';
                        } else if (col.id === 'matched-column') {
                            listId = 'matched-list';
                        }
                        
                        // 调用收缩逻辑
                        if (listId) {
                            toggleColumnExpand(col.id, listId);
                        }
                    }
                });
            }

            const columns = panel.querySelectorAll('.compare-column');
            columns.forEach(col => {
                if (col.style.display !== 'none') {
                    if (swapMode) {
                        col.classList.add('column-swap-ready');
                    } else {
                        col.classList.remove('column-swap-ready', 'column-swap-selected');
                    }
                }
            });

            // 退出交换模式时清除选中状态
            if (!swapMode && selectedColumn) {
                selectedColumn.classList.remove('column-swap-selected');
                selectedColumn = null;
            }
        };

        document.getElementById('close-panel').onclick = () => {
            panel.style.display = 'none';
            toggleBtn.innerHTML = '⚡';
            toggleBtn.title = '打开比对面板';
        };

        // 列标题点击事件 - 动态扩展
        document.getElementById('iwara-header').onclick = (e) => {
            if (swapMode) {
                e.stopPropagation();
                handleColumnSwap('iwara-column');
            } else {
                toggleColumnExpand('iwara-column', 'iwara-only');
            }
        };
        document.getElementById('hanime1me-header').onclick = (e) => {
            if (swapMode) {
                e.stopPropagation();
                handleColumnSwap('hanime1me-column');
            } else {
                toggleColumnExpand('hanime1me-column', 'hanime1me-only');
            }
        };
        document.getElementById('matched-header').onclick = (e) => {
            if (swapMode) {
                e.stopPropagation();
                handleColumnSwap('matched-column');
            } else {
                toggleColumnExpand('matched-column', 'matched-list');
            }
        };

        // 处理列交换
        function handleColumnSwap(columnId) {
            const clickedColumn = document.getElementById(columnId);
            if (!clickedColumn || clickedColumn.style.display === 'none') return;

            if (!selectedColumn) {
                // 第一次点击，选中该列
                selectedColumn = clickedColumn;
                clickedColumn.classList.add('column-swap-selected');
                // 保持蓝色边框，不移除 column-swap-ready
            } else {
                // 第二次点击，交换两列
                if (selectedColumn.id !== columnId) {
                    // 交换两列的位置
                    const container = document.getElementById('compare-container');
                    const placeholder = document.createElement('div');
                    placeholder.style.display = 'none';

                    // 使用占位符交换位置
                    container.insertBefore(placeholder, selectedColumn);
                    container.insertBefore(selectedColumn, clickedColumn);
                    container.insertBefore(clickedColumn, placeholder);
                    container.removeChild(placeholder);

                    // 更新列的 data-column 属性
                    const col1 = selectedColumn;
                    const col2 = clickedColumn;
                    const tempData = col1.getAttribute('data-column');
                    col1.setAttribute('data-column', col2.getAttribute('data-column'));
                    col2.setAttribute('data-column', tempData);

                    // 清除选中状态，但保持蓝色边框
                    selectedColumn.classList.remove('column-swap-selected');
                    clickedColumn.classList.remove('column-swap-selected');
                    selectedColumn = null;

                    // 重新居中面板
                    centerPanel();
                } else {
                    // 点击同一列，取消选择
                    selectedColumn.classList.remove('column-swap-selected');
                    selectedColumn = null;
                }
            }
        }

        // 阈值事件
        thresholdInput.oninput = (e) => {
            thresholdVal.innerText = parseFloat(e.target.value).toFixed(2);
            GM_setValue('match_threshold', e.target.value);
        };

        // 容差事件
        toleranceInput.onchange = (e) => {
            GM_setValue('duration_tolerance', parseInt(e.target.value) || 30);
        };

        // 面板大小调整时自动居中
        const resizeObserver = new ResizeObserver(() => {
            if (panel && panel.style.display === 'flex') {
                centerPanel();
                // 同时更新列位置（包括占位符宽度）
                updateColumnPositions();
            }
        });
        resizeObserver.observe(panel);

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            if (panel && panel.style.display === 'flex') {
                updateColumnPositions();
            }
        });
    }

    // --- 捕获 iwara.tv 页面数据 ---
    function captureiwara() {
        const videos = [];
        const teasers = document.querySelectorAll('.videoTeaser');

        teasers.forEach(el => {
            try {
                const titleEl = el.querySelector('.videoTeaser__title');
                const title = titleEl?.innerText.trim() || '';

                const linkEl = el.querySelector('.videoTeaser__thumbnail');
                const link = linkEl?.getAttribute('href');
                const url = link ? 'https://www.iwara.tv' + link : '';

                const durationEl = el.querySelector('.duration .text');
                const duration = durationEl?.innerText.trim() || '';

                if (title && url) {
                    videos.push({
                        title,
                        url,
                        duration,
                        seconds: parseDuration(duration)
                    });
                }
            } catch (e) {
                console.error('Error parsing iwara video:', e);
            }
        });

        return videos;
    }

    // --- 捕获 hanime1.me 页面数据 ---
    function capturehanime1() {
        const videos = [];
        const containers = document.querySelectorAll('.video-item-container');

        containers.forEach(el => {
            try {
                const title = el.getAttribute('title') ||
                             el.querySelector('.title')?.innerText.trim() ||
                             '';

                const linkEl = el.querySelector('.video-link');
                const url = linkEl?.getAttribute('href') || '';

                const durationEl = el.querySelector('.duration');
                const duration = durationEl?.innerText.trim() || '';

                if (title && url) {
                    videos.push({
                        title,
                        url,
                        duration,
                        seconds: parseDuration(duration)
                    });
                }
            } catch (e) {
                console.error('Error parsing hanime1 video:', e);
            }
        });

        return videos;
    }

    // --- 捕获页面数据 ---
    function capturePage() {
        const host = window.location.host;
        let poolKey, videos;

        if (host.includes('iwara.tv')) {
            poolKey = 'iwara_pool';
            videos = captureiwara();
        } else if (host.includes('hanime')) {
            // 所有 Hanime 网站共享同一个数据池
            poolKey = 'hanime1me_pool';
            videos = capturehanime1();
        } else {
            return;
        }

        let pool = GM_getValue(poolKey, []) || [];
        let added = 0;
        let skipped = 0;

        videos.forEach(v => {
            // 只保存包含时长信息的视频
            if (v.seconds === null || v.seconds === 0) {
                skipped++;
                return;
            }
            
            if (!pool.some(p => p.url === v.url)) {
                pool.push(v);
                added++;
            }
        });

        GM_setValue(poolKey, pool);
        updateStats();

        alert(`新增 ${added} 条，总计 ${pool.length}\n本次捕获：${videos.length} 条\n已保存：${added} 条 (有时长)\n已舍弃：${skipped} 条 (无时长)`);
    }

    // --- 核心比对业务 ---
    async function performCompare() {
        const iwara = GM_getValue('iwara_pool', []) || [];
        const hanime1me = GM_getValue('hanime1me_pool', []) || [];
        const thres = parseFloat(thresholdInput.value);
        const tolerance = parseInt(toleranceInput.value) || 30;

        const iwaraWithDuration = iwara.filter(v => v.seconds !== null);
        const hanime1meWithDuration = hanime1me.filter(v => v.seconds !== null);

        const iOnlyDiv = document.getElementById('iwara-only');
        const hOnlyDiv = document.getElementById('hanime1me-only');
        const matchedListDiv = document.getElementById('matched-list');

        iOnlyDiv.innerHTML = hOnlyDiv.innerHTML = matchedListDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">比对中...</div>';

        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';

        let iOnly = [];
        let hOnly = [];
        let matchedPairs = [];

        // 计算 iwara 独有，并记录最高相似度
        for (let i = 0; i < iwaraWithDuration.length; i++) {
            const iItem = iwaraWithDuration[i];
            let maxSimilarity = 0;
            let bestMatch = null;

            for (const hItem of hanime1meWithDuration) {
                if (!isDurationMatch(iItem.seconds, hItem.seconds, tolerance)) {
                    continue;
                }

                const titleSim = titleSimilarity(
                    cleanTitle(iItem.title),
                    cleanTitle(hItem.title)
                );

                if (titleSim > maxSimilarity) {
                    maxSimilarity = titleSim;
                    bestMatch = hItem;
                }
            }

            // 只添加低于阈值的项
            if (maxSimilarity < thres) {
                iOnly.push({
                    ...iItem,
                    maxSimilarity
                });
            } else if (bestMatch) {
                // 记录匹配成功的项
                matchedPairs.push({
                    iwara: iItem,
                    hanime1me: bestMatch,
                    similarity: maxSimilarity
                });
            }

            if (i % 5 === 0) {
                const percent = (i / iwaraWithDuration.length) * 50;
                progressBar.style.width = percent + '%';
                await new Promise(r => setTimeout(r, 0));
            }
        }

        // 计算 hanime1 独有，并记录最高相似度
        for (let i = 0; i < hanime1meWithDuration.length; i++) {
            const hItem = hanime1meWithDuration[i];
            let maxSimilarity = 0;

            for (const iItem of iwaraWithDuration) {
                if (!isDurationMatch(hItem.seconds, iItem.seconds, tolerance)) {
                    continue;
                }

                const titleSim = titleSimilarity(
                    cleanTitle(hItem.title),
                    cleanTitle(iItem.title)
                );

                maxSimilarity = Math.max(maxSimilarity, titleSim);
            }

            // 只添加低于阈值的项
            if (maxSimilarity < thres) {
                hOnly.push({
                    ...hItem,
                    maxSimilarity
                });
            }

            if (i % 5 === 0) {
                const percent = 50 + (i / hanime1meWithDuration.length) * 50;
                progressBar.style.width = percent + '%';
                await new Promise(r => setTimeout(r, 0));
            }
        }

        progressBar.style.width = '100%';
        setTimeout(() => progressContainer.style.display = 'none', 500);

        renderResults(iOnly, hOnly, matchedPairs, iwaraWithDuration, hanime1meWithDuration, thres, tolerance);
    }

    // --- 渲染结果 (添加最高相似度显示) ---
    function renderResults(iOnly, hOnly, matchedPairs, iwaraWithDuration, hanime1meWithDuration, thres, tolerance) {
        const iOnlyDiv = document.getElementById('iwara-only');
        const hOnlyDiv = document.getElementById('hanime1me-only');
        const matchedListDiv = document.getElementById('matched-list');

        iOnlyDiv.innerHTML = '';
        hOnlyDiv.innerHTML = '';
        matchedListDiv.innerHTML = '';

        // 按相似度降序排列匹配成功的项
        matchedPairs.sort((a, b) => b.similarity - a.similarity);

        // 渲染 iwara 独有
        iOnly.forEach(item => {
            const div = document.createElement('div');
            div.className = 'diff-item';

            // 计算相似项（最多 3 个）
            const similarities = hanime1meWithDuration
                .map(op => {
                    const titleSim = titleSimilarity(
                        cleanTitle(item.title),
                        cleanTitle(op.title)
                    );
                    return {
                        title: op.title,
                        url: op.url,
                        duration: op.duration,
                        seconds: op.seconds,
                        titleSim,
                        durationDiff: Math.abs(item.seconds - op.seconds)
                    };
                })
                .filter(s => s.titleSim >= thres * 0.6)
                .sort((a, b) => b.titleSim - a.titleSim)
                .slice(0, 3);

            // 只有有相似项才显示相似度徽章
            const hasSimilar = similarities.length > 0;
            const maxSim = hasSimilar ? similarities[0].titleSim : 0;

            const titleHtml = `
                <div class="item-title">
                    <a href="${item.url}" target="_blank">${item.title}</a>
                    ${hasSimilar ?
                        `<span class="similarity-badge" data-has-hover="true">
                            ${(maxSim * 100).toFixed(0)}%
                        </span>` : ''
                    }
                </div>
                <div class="item-duration-iwara">${formatDuration(item.seconds)}</div>
            `;

            div.innerHTML = titleHtml;
            // 将相似项附加到元素上供悬浮提示使用
            div._similarities = similarities;
            addHoverSimilarity(div, item, hanime1meWithDuration, thres, tolerance, 'iwara');
            iOnlyDiv.appendChild(div);
        });

        // 渲染 hanime1 独有
        hOnly.forEach(item => {
            const div = document.createElement('div');
            div.className = 'diff-item';

            // 计算相似项（最多 3 个）
            const similarities = iwaraWithDuration
                .map(op => {
                    const titleSim = titleSimilarity(
                        cleanTitle(item.title),
                        cleanTitle(op.title)
                    );
                    return {
                        title: op.title,
                        url: op.url,
                        duration: op.duration,
                        seconds: op.seconds,
                        titleSim,
                        durationDiff: Math.abs(item.seconds - op.seconds)
                    };
                })
                .filter(s => s.titleSim >= thres * 0.6)
                .sort((a, b) => b.titleSim - a.titleSim)
                .slice(0, 3);

            // 只有有相似项才显示相似度徽章
            const hasSimilar = similarities.length > 0;
            const maxSim = hasSimilar ? similarities[0].titleSim : 0;

            const titleHtml = `
                <div class="item-title">
                    <a href="${item.url}" target="_blank">${item.title}</a>
                    ${hasSimilar ?
                        `<span class="similarity-badge" data-has-hover="true">
                            ${(maxSim * 100).toFixed(0)}%
                        </span>` : ''
                    }
                </div>
                <div class="item-duration-hanime1">${formatDuration(item.seconds)}</div>
            `;

            div.innerHTML = titleHtml;
            // 将相似项附加到元素上供悬浮提示使用
            div._similarities = similarities;
            addHoverSimilarity(div, item, iwaraWithDuration, thres, tolerance, 'hanime1');
            hOnlyDiv.appendChild(div);
        });

        // 渲染匹配成功的项
        matchedPairs.forEach(pair => {
            const div = document.createElement('div');
            div.className = 'diff-item';
            div.style.background = '#1a2a2a';

            const titleHtml = `
                <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <a href="${pair.iwara.url}" target="_blank" style="color: #00ccff; font-size: 11px; flex: 1;">${pair.iwara.title}</a>
                        <span class="item-duration-iwara">${formatDuration(pair.iwara.seconds)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <a href="${pair.hanime1me.url}" target="_blank" style="color: #00ffaa; font-size: 11px; flex: 1;">${pair.hanime1me.title}</a>
                        <span class="item-duration-hanime1">${formatDuration(pair.hanime1me.seconds)}</span>
                    </div>
                </div>
                <span class="similarity-badge" style="background: #00ff88; color: #000; font-weight: bold;" data-has-hover="true">
                    ${(pair.similarity * 100).toFixed(1)}%
                </span>
            `;

            div.innerHTML = titleHtml;
            // 为匹配成功的项添加悬浮提示，显示其他可能的匹配项
            addHoverSimilarityForMatched(div, pair, iwaraWithDuration, hanime1meWithDuration, thres, tolerance);
            matchedListDiv.appendChild(div);
        });

        document.getElementById('diff-i').innerText = iOnly.length;
        document.getElementById('diff-h').innerText = hOnly.length;
        document.getElementById('diff-matched').innerText = matchedPairs.length;

        // 显示过滤统计
        const iFiltered = iwaraWithDuration.length;
        const hFiltered = hanime1meWithDuration.length;
        const iTotal = GM_getValue('iwara_pool', []).length;
        const hTotal = GM_getValue('hanime1me_pool', []).length;

        if (iFiltered < iTotal || hFiltered < hTotal) {
            const filterNotice = document.createElement('div');
            filterNotice.style.cssText = 'text-align: center; font-size: 10px; color: #ffaa00; margin-top: 5px;';
            filterNotice.innerHTML = `⏱️ 已过滤无时长视频: iwara ${iTotal - iFiltered}条, hanime1 ${hTotal - hFiltered}条`;
            panel.querySelector('.compare-container').before(filterNotice);
            setTimeout(() => filterNotice.remove(), 5000);
        }

        if (iOnly.length === 0) {
            iOnlyDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">没有独有项</div>';
        }
        if (hOnly.length === 0) {
            hOnlyDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">没有独有项</div>';
        }
    }

    // --- 添加悬浮提示 ---
    function addHoverSimilarity(div, item, oppositePool, thres, tolerance, source) {
        // 使用预先计算并附加在元素上的相似项
        const similarities = div._similarities || [];

        if (similarities.length === 0) return;

        div.addEventListener('mouseenter', (e) => {
            const tooltip = document.createElement('div');
            tooltip.id = 'similarity-tooltip';

            tooltip.innerHTML = `
                <div style="font-size: 10px; color: #888; margin-bottom: 4px;">
                    最相似的${similarities.length}项：
                </div>
                ${similarities.map(s => `
                    <div style="margin: 3px 0; padding: 3px; background: #1a1a1a; border-radius: 3px;">
                        <a href="${s.url}" target="_blank" style="color: #5cafff; font-size: 11px;">${s.title}</a>
                        <span style="color: ${s.titleSim >= thres ? '#00ff88' : '#ffaa00'}; font-size: 10px; float: right;">
                            ${(s.titleSim * 100).toFixed(1)}%
                        </span>
                        <div style="font-size: 9px; color: #888; margin-top: 2px;">
                            ⏱️ ${s.duration} | 相差 ${s.durationDiff}秒
                        </div>
                    </div>
                `).join('')}
            `;

            tooltip.style.cssText = `
                position: fixed;
                background: #252525;
                border: 1px solid #444;
                border-radius: 6px;
                padding: 8px;
                z-index: 10001;
                min-width: 250px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                pointer-events: none;
            `;

            document.body.appendChild(tooltip);

            const rect = div.getBoundingClientRect();
            let left = source === 'iwara' ? rect.right + 10 : rect.left - 260;
            let top = rect.top;

            if (source === 'iwara' && rect.right + 260 > window.innerWidth) {
                left = rect.left - 260;
            } else if (source === 'hanime1' && rect.left - 260 < 0) {
                left = rect.right + 10;
            }

            if (rect.top + tooltip.offsetHeight + 10 > window.innerHeight) {
                top = window.innerHeight - tooltip.offsetHeight - 10;
            }

            tooltip.style.left = Math.max(10, left) + 'px';
            tooltip.style.top = Math.max(10, Math.min(top, window.innerHeight - tooltip.offsetHeight - 10)) + 'px';
        });

        div.addEventListener('mouseleave', () => {
            const tooltip = document.getElementById('similarity-tooltip');
            if (tooltip) tooltip.remove();
        });
    }

    // --- 为匹配成功的项添加悬浮提示 ---
    function addHoverSimilarityForMatched(div, pair, iwaraPool, hanimePool, thres, tolerance) {
        // 查找 iwara 的其他相似项
        const otherIwaraSimilar = hanimePool
            .filter(op => op.url !== pair.hanime1me.url)
            .map(op => {
                const titleSim = titleSimilarity(
                    cleanTitle(pair.iwara.title),
                    cleanTitle(op.title)
                );
                return {
                    title: op.title,
                    url: op.url,
                    duration: op.duration,
                    seconds: op.seconds,
                    titleSim,
                    durationDiff: Math.abs(pair.iwara.seconds - op.seconds),
                    type: 'hanime'
                };
            })
            .filter(s => s.titleSim >= thres * 0.6)
            .sort((a, b) => b.titleSim - a.titleSim)
            .slice(0, 2);

        // 查找 hanime 的其他相似项
        const otherHanimeSimilar = iwaraPool
            .filter(op => op.url !== pair.iwara.url)
            .map(op => {
                const titleSim = titleSimilarity(
                    cleanTitle(pair.hanime1me.title),
                    cleanTitle(op.title)
                );
                return {
                    title: op.title,
                    url: op.url,
                    duration: op.duration,
                    seconds: op.seconds,
                    titleSim,
                    durationDiff: Math.abs(pair.hanime1me.seconds - op.seconds),
                    type: 'iwara'
                };
            })
            .filter(s => s.titleSim >= thres * 0.6)
            .sort((a, b) => b.titleSim - a.titleSim)
            .slice(0, 2);

        const allSimilar = [...otherIwaraSimilar, ...otherHanimeSimilar];

        if (allSimilar.length === 0) return;

        div.addEventListener('mouseenter', (e) => {
            const tooltip = document.createElement('div');
            tooltip.id = 'similarity-tooltip';

            tooltip.innerHTML = `
                <div style="font-size: 10px; color: #888; margin-bottom: 4px;">
                    其他可能的匹配项：
                </div>
                ${allSimilar.map(s => `
                    <div style="margin: 3px 0; padding: 3px; background: #1a1a1a; border-radius: 3px;">
                        <a href="${s.url}" target="_blank" style="color: ${s.type === 'iwara' ? '#00ccff' : '#00ffaa'}; font-size: 11px;">${s.title}</a>
                        <span style="color: #ffaa00; font-size: 10px; float: right;">
                            ${(s.titleSim * 100).toFixed(1)}%
                        </span>
                        <div style="font-size: 9px; color: #888; margin-top: 2px;">
                            ⏱️ ${s.duration} | 相差 ${s.durationDiff}秒
                        </div>
                    </div>
                `).join('')}
            `;

            tooltip.style.cssText = `
                position: fixed;
                background: #252525;
                border: 1px solid #444;
                border-radius: 6px;
                padding: 8px;
                z-index: 10001;
                min-width: 250px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                pointer-events: none;
            `;

            document.body.appendChild(tooltip);

            const rect = div.getBoundingClientRect();
            let left = rect.right + 10;
            let top = rect.top;

            if (rect.right + 260 > window.innerWidth) {
                left = rect.left - 260;
            }

            if (rect.top + tooltip.offsetHeight + 10 > window.innerHeight) {
                top = window.innerHeight - tooltip.offsetHeight - 10;
            }

            tooltip.style.left = Math.max(10, left) + 'px';
            tooltip.style.top = Math.max(10, Math.min(top, window.innerHeight - tooltip.offsetHeight - 10)) + 'px';
        });

        div.addEventListener('mouseleave', () => {
            const tooltip = document.getElementById('similarity-tooltip');
            if (tooltip) tooltip.remove();
        });
    }

    // --- 清空数据 ---
    function clearPools() {
        if (confirm('清空所有存储的数据？')) {
            GM_setValue('iwara_pool', []);
            GM_setValue('hanime1me_pool', []);
            updateStats();
            if (panel && panel.style.display === 'flex') {
                performCompare();
            }
        }
    }

    // --- 更新统计 ---
    function updateStats() {
        const iwaraPool = GM_getValue('iwara_pool', []) || [];
        const hanime1mePool = GM_getValue('hanime1me_pool', []) || [];
        document.getElementById('total-i').innerText = iwaraPool.length;
        document.getElementById('total-h').innerText = hanime1mePool.length;
    }

    // --- 初始化 ---
    function init() {
        console.log('[iwara & hanime1me] 初始化插件...');
        createToggleButton();
    }

    // 立即初始化插件
    console.log('[iwara & hanime1me] 脚本执行，立即初始化');
    init();
})();