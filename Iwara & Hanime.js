// ==UserScript==
// @name         iwara & hanime1 视频比对
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  标题词干匹配 + 时长精确过滤 + 可调节秒数容差 + iwara池排序
// @author       bydbot+trae，mimo 2 pro
// @match        https://www.iwara.tv/*
// @include      https://*.hanime*.*/search?*
// @include      https://hanime*.*/search?*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @license      GPL-3.0
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        #matcher-menu-btn {
            position: fixed; right: 20px; bottom: 20px;
            background: linear-gradient(135deg, #00ccff, #0066ff);
            color: #fff; width: 50px; height: 50px; border-radius: 50%;
            cursor: pointer; z-index: 99999; font-size: 24px; font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,102,255,0.4);
            display: flex; align-items: center; justify-content: center;
            transition: all 0.3s; user-select: none;
            border: 2px solid rgba(255,255,255,0.2);
        }
        #matcher-menu-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0,102,255,0.6);
            background: linear-gradient(135deg, #0066ff, #00ccff);
        }
        #matcher-dropdown {
            position: fixed; right: 20px; bottom: 80px;
            background: #1e1e1e; border: 1px solid #444; border-radius: 8px;
            z-index: 99998; display: none; overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6); min-width: 180px;
        }
        #matcher-dropdown.show { display: block; }
        .dropdown-item {
            padding: 12px 18px; cursor: pointer; font-size: 13px;
            color: #eee; transition: background 0.2s; white-space: nowrap;
            border-bottom: 1px solid #2a2a2a; font-family: sans-serif;
        }
        .dropdown-item:last-child { border-bottom: none; }
        .dropdown-item:hover { background: #2a2a2a; color: #00ccff; }
        #matcher-panel, #sort-panel {
            position: fixed; display: none; flex-direction: column;
            background: #1a1a1a; color: #eee; z-index: 10000;
            padding: 12px; border-radius: 10px; font-family: sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.7); border: 1px solid #333;
            overflow: hidden; resize: both;
        }
        #matcher-panel {
            min-width: 900px; max-width: 95vw; min-height: 500px; max-height: 90vh;
        }
        #sort-panel {
            min-width: 900px; max-width: 95vw; min-height: 500px; max-height: 90vh;
        }
        .panel-header {
            border-bottom: 1px solid #333; padding: 8px 8px 8px 12px;
            margin: -12px -12px 10px -12px; background: #222;
            border-radius: 10px 10px 0 0; display: flex;
            justify-content: space-between; align-items: center;
        }
        .panel-header h3 { margin: 0; font-size: 14px; color: #00ccff; }
        .close-btn { cursor: pointer; color: #888; font-size: 18px; padding: 0 8px; }
        .close-btn:hover { color: #ff4444; }
        .stat-banner {
            display: flex; justify-content: space-around;
            background: #252525; padding: 6px; border-radius: 6px;
            margin-bottom: 10px; font-size: 11px; border: 1px solid #333;
        }
        .stat-item b { color: #00ffcc; }
        .progress-container {
            width: 100%; height: 4px; background: #333; border-radius: 2px;
            margin-bottom: 10px; overflow: hidden; display: none;
        }
        #progress-bar {
            width: 0%; height: 100%;
            background: linear-gradient(90deg, #00ccff, #00ffcc);
            transition: width 0.1s;
        }
        .filter-controls {
            background: #252525; border-radius: 6px; padding: 10px;
            margin-bottom: 10px; border: 1px solid #333;
            display: flex; justify-content: space-between; align-items: center;
        }
        .filter-item { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .filter-item label { width: 80px; font-size: 11px; color: #aaa; }
        .filter-item input[type=number] {
            width: 70px; background: #333; color: #fff;
            border: 1px solid #555; border-radius: 4px; padding: 4px 6px; font-size: 11px;
        }
        .filter-item span { font-size: 10px; color: #666; }
        .filter-hint { font-size: 10px; color: #ffaa00; text-align: center; margin-top: 5px; }
        .swap-mode-btn {
            background: #3a3a3a; color: #fff; border: 1px solid #444;
            padding: 6px 12px; border-radius: 5px; font-size: 11px;
            cursor: pointer; transition: 0.2s; white-space: nowrap; margin-left: 10px;
        }
        .swap-mode-btn:hover { background: #4a4a4a; border-color: #00ccff; }
        .swap-mode-btn.active {
            background: #00ccff; color: #000; border-color: #00ccff;
            box-shadow: 0 0 10px rgba(0,204,255,0.5);
        }
        .column-swap-ready { cursor: pointer; box-shadow: 0 0 15px rgba(0,204,255,0.6); border-color: #00ccff !important; }
        .column-swap-selected { cursor: pointer; box-shadow: 0 0 20px rgba(255,170,0,0.8); border-color: #ffaa00 !important; background: rgba(255,170,0,0.1); }
        .threshold-wrap { display: flex; align-items: center; gap: 10px; font-size: 12px; margin-bottom: 10px; color: #aaa; }
        input[type=range] { flex: 1; cursor: pointer; }
        .compare-container {
            display: flex; gap: 10px; margin-top: 10px; flex: 1;
            min-height: 200px; overflow: hidden;
        }
        .compare-column {
            flex: 1; display: flex; flex-direction: column;
            background: #000; border-radius: 6px; padding: 6px;
            border: 1px solid #222; overflow: hidden; min-width: 0; position: relative;
        }
        .compare-column-placeholder {
            flex: 1; min-height: 200px; background: #000;
            border-radius: 6px; border: 1px solid #222;
        }
        #matched-column { background: #0a1a1a; border: 1px solid #00ff88; }
        .column-header {
            font-size: 11px; font-weight: bold; color: #888;
            border-bottom: 1px solid #333; margin-bottom: 8px; padding: 4px;
            display: flex; justify-content: space-between; flex-shrink: 0;
            user-select: none; cursor: pointer;
        }
        .column-header:hover { color: #00ccff; background: rgba(0,204,255,0.1); border-radius: 4px; }
        .diff-count { color: #ff4444; font-size: 12px; }
        .list-content {
            flex: 1; overflow-y: auto; overflow-x: hidden; font-size: 11px; min-height: 100px;
            scrollbar-width: thin; scrollbar-color: #444 #1a1a1a;
        }
        .list-content::-webkit-scrollbar { width: 6px; }
        .list-content::-webkit-scrollbar-track { background: #1a1a1a; }
        .list-content::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        .list-content::-webkit-scrollbar-thumb:hover { background: #666; }
        .diff-item {
            border-bottom: 1px solid #1a1a1a; padding: 8px 5px; transition: 0.2s;
            display: flex; align-items: center; justify-content: space-between;
        }
        .diff-item:hover { background: #222; }
        .item-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .item-title a { color: #5cafff; text-decoration: none; }
        .duration-badge {
            font-size: 10px; margin-left: 10px; flex-shrink: 0; font-family: monospace;
            background: #333; padding: 2px 6px; border-radius: 12px;
        }
        .duration-iwara { color: #ffaa00; border-left: 2px solid #ffaa00; }
        .duration-hanime { color: #00ffaa; border-left: 2px solid #00ffaa; }
        .btn-row { display: flex; gap: 6px; margin-bottom: 10px; }
        button {
            flex: 1; cursor: pointer; background: #2a2a2a; color: #fff;
            border: 1px solid #444; padding: 8px; border-radius: 5px;
            font-size: 11px; transition: 0.2s;
        }
        button:hover { background: #3a3a3a; border-color: #00ccff; }
        .btn-capture { background: #004a80 !important; font-weight: bold; }
        .similarity-badge {
            display: inline-block; background: #333; color: #ffaa00;
            font-size: 10px; padding: 2px 5px; border-radius: 10px; margin-left: 5px;
        }
        #similarity-tooltip {
            position: fixed; background: #252525; border: 1px solid #444;
            border-radius: 6px; padding: 8px; z-index: 10001;
            min-width: 250px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); pointer-events: none;
        }
        /* 排序面板样式 */
        .sort-controls {
            display: flex; gap: 10px; margin-bottom: 10px; align-items: center;
        }
        .sort-controls select, .sort-controls button {
            background: #333; color: #fff; border: 1px solid #555;
            border-radius: 4px; padding: 6px 10px; font-size: 12px; cursor: pointer;
        }
        .sort-controls select:focus { border-color: #00ccff; outline: none; }
        .sort-list { flex: 1; overflow-y: auto; min-height: 200px; }
        .sort-item {
            border-bottom: 1px solid #1a1a1a; padding: 8px 6px;
            display: flex; align-items: center; gap: 8px; font-size: 11px;
            transition: 0.2s;
        }
        .sort-item:hover { background: #222; }
        .sort-rank {
            width: 28px; height: 28px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: bold; flex-shrink: 0;
        }
        .sort-rank.top1 { background: #ffd700; color: #000; }
        .sort-rank.top2 { background: #c0c0c0; color: #000; }
        .sort-rank.top3 { background: #cd7f32; color: #fff; }
        .sort-rank.normal { background: #333; color: #888; }
        .sort-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sort-title a { color: #5cafff; text-decoration: none; }
        .sort-meta { display: flex; gap: 8px; flex-shrink: 0; align-items: center; }
        .sort-badge {
            font-size: 10px; padding: 2px 6px; border-radius: 10px;
            font-family: monospace; white-space: nowrap;
        }
        .sort-badge.view { background: #1a3a2a; color: #00ff88; }
        .sort-badge.like { background: #3a1a2a; color: #ff6b9d; }
        .sort-badge.ratio { background: #2a2a1a; color: #ffcc00; }
        .sort-badge.date { background: #1a2a3a; color: #6bc5ff; }
        .sort-level-row {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 8px; background: #2a2a2a; border-radius: 4px;
            font-size: 11px;
        }
        .sort-level-row select {
            background: #333; color: #fff; border: 1px solid #555;
            border-radius: 3px; padding: 4px 6px; font-size: 11px;
        }
        .sort-level-row label { color: #888; font-size: 10px; white-space: nowrap; }
        .sort-levels { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
        .sort-levels .level-label { font-size: 11px; color: #aaa; margin-bottom: 2px; font-weight: bold; }
        .sort-body {
            display: flex; gap: 12px; flex: 1; min-height: 0; overflow: hidden;
        }
        .sort-left {
            width: 320px; flex-shrink: 0; display: flex; flex-direction: column;
            overflow-y: auto;
        }
        .sort-right {
            flex: 1; display: none; flex-direction: column; min-width: 0;
            border-left: 1px solid #333; padding-left: 12px; overflow: hidden;
        }
        .sort-right.show { display: flex; }
        .sort-right-header {
            font-size: 12px; font-weight: bold; color: #00ccff;
            padding: 6px 0; border-bottom: 1px solid #333; margin-bottom: 6px;
            display: flex; justify-content: space-between; flex-shrink: 0;
        }
        .sort-col-toggles {
            display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; flex-shrink: 0;
        }
        .sort-col-toggle {
            font-size: 10px; padding: 3px 8px; border-radius: 10px;
            cursor: pointer; user-select: none; border: 1px solid #555;
            background: #2a2a2a; color: #888; transition: 0.2s;
        }
        .sort-col-toggle.on { color: #fff; }
        .sort-col-toggle.on.view { background: #1a3a2a; border-color: #00ff88; color: #00ff88; }
        .sort-col-toggle.on.like { background: #3a1a2a; border-color: #ff6b9d; color: #ff6b9d; }
        .sort-col-toggle.on.ratio { background: #2a2a1a; border-color: #ffcc00; color: #ffcc00; }
        .sort-col-toggle.on.date { background: #1a2a3a; border-color: #6bc5ff; color: #6bc5ff; }
        .sort-col-toggle.on.duration { background: #3a2a1a; border-color: #ffaa00; color: #ffaa00; }
    `);

    // --- 工具函数 ---
    function parseDuration(s) {
        if (!s) return null;
        const m = s.match(/(\d+):(\d+)(?::(\d+))?/);
        if (!m) return null;
        const a = parseInt(m[1]), b = parseInt(m[2]), c = m[3] ? parseInt(m[3]) : 0;
        return c > 0 ? c * 3600 + a * 60 + b : a * 60 + b;
    }

    function formatDuration(sec) {
        if (sec == null) return '无时长';
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        const pad = n => String(n).padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }

    function parseCompactNumber(s) {
        if (!s) return 0;
        s = s.trim().replace(/,/g, '');
        const m = s.match(/^([\d.]+)\s*([KkMmBb]?)$/);
        if (!m) return parseInt(s) || 0;
        const n = parseFloat(m[1]);
        const suf = m[2].toUpperCase();
        if (suf === 'K') return Math.round(n * 1000);
        if (suf === 'M') return Math.round(n * 1000000);
        if (suf === 'B') return Math.round(n * 1000000000);
        return Math.round(n);
    }

    function formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    function parseDate(s) {
        if (!s) return 0;
        const d = new Date(s);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }

    function getPoolSize() {
        const iwara = JSON.stringify(GM_getValue('iwara_pool', []) || []);
        const hanime = JSON.stringify(GM_getValue('hanime1me_pool', []) || []);
        return iwara.length + hanime.length;
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    function stemWord(w) {
        if (/^\d+$/.test(w)) return w;
        return w.toLowerCase().replace(/(ing|ed|s|es|ies|ly|er|est|tion|ive|able|ible|al|y)$/, '').replace(/[^\w\u4e00-\u9fa5]/g, '');
    }

    function cleanTitle(t) {
        return (t || '').replace(/\[.*?\]|\(.*?\)|【.*?】/g, '').replace(/[:：]/g, ' ')
            .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\u200d|\uFE0F/g, '')
            .replace(/[^\w\s\u4e00-\u9fa5]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function editDist(a, b) {
        const c = [];
        for (let i = 0; i <= a.length; i++) {
            let last = i;
            for (let j = 0; j <= b.length; j++) {
                if (i === 0) c[j] = j;
                else if (j > 0) {
                    let nv = c[j - 1];
                    if (a[i - 1] !== b[j - 1]) nv = Math.min(nv, last, c[j]) + 1;
                    c[j - 1] = last; last = nv;
                }
            }
            if (i > 0) c[b.length] = last;
        }
        return c[b.length];
    }

    function charSim(a, b) {
        if (a.length < b.length) [a, b] = [b, a];
        return a.length === 0 ? 1 : (a.length - editDist(a, b)) / a.length;
    }

    function titleSim(s1, s2) {
        const w1 = s1.split(/\s+/).filter(Boolean).map(stemWord);
        const w2 = s2.split(/\s+/).filter(Boolean).map(stemWord);
        if (!w1.length || !w2.length) return charSim(s1, s2);
        const set1 = new Set(w1), set2 = new Set(w2);
        let inter = 0;
        for (const w of set1) if (set2.has(w)) inter++;
        const union = set1.size + set2.size - inter;
        const jaccard = union > 0 ? inter / union : 0;
        const cov1 = set1.size > 0 ? inter / set1.size : 0;
        const cov2 = set2.size > 0 ? inter / set2.size : 0;
        return jaccard * 0.4 + (cov1 + cov2) / 2 * 0.6;
    }

    function findTopSimilar(item, pool, thres, maxN = 3) {
        return pool.map(op => ({
            title: op.title, url: op.url, duration: op.duration, seconds: op.seconds,
            titleSim: titleSim(cleanTitle(item.title), cleanTitle(op.title)),
            durationDiff: Math.abs(item.seconds - op.seconds)
        })).filter(s => s.titleSim >= thres * 0.6).sort((a, b) => b.titleSim - a.titleSim).slice(0, maxN);
    }

    // --- UI ---
    let menuBtn, dropdown, panel, sortPanel, progressBar, progressContainer, thresholdInput, thresholdVal, toleranceInput;

    function createMenuButton() {
        menuBtn = document.createElement('div');
        menuBtn.id = 'matcher-menu-btn';
        menuBtn.innerHTML = '\u26A1';
        menuBtn.title = '打开菜单';
        document.body.appendChild(menuBtn);

        dropdown = document.createElement('div');
        dropdown.id = 'matcher-dropdown';
        dropdown.innerHTML = `
            <div class="dropdown-item" id="menu-save">\uD83D\uDCBE 保存当前页</div>
            <div class="dropdown-item" id="menu-clear" style="color:#ff6b6b">\uD83D\uDDD1\uFE0F 清除池</div>
            <div style="border-top:1px solid #333;margin:2px 0"></div>
            <div class="dropdown-item" id="menu-compare">\uD83D\uDD0D 对比器</div>
            <div class="dropdown-item" id="menu-sort">\uD83D\uDCCB iwara 池排序</div>
            <div style="border-top:1px solid #333;margin:2px 0"></div>
            <div class="dropdown-item" id="menu-size" style="font-size:11px;color:#888;cursor:default">\uD83D\uDCBE 存储占用: <span id="dropdown-size">-</span></div>`;
        document.body.appendChild(dropdown);

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
            if (dropdown.classList.contains('show')) {
                document.getElementById('dropdown-size').textContent = formatSize(getPoolSize());
            }
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== menuBtn) dropdown.classList.remove('show');
        });

        document.getElementById('menu-save').addEventListener('click', () => {
            dropdown.classList.remove('show');
            capturePage();
            updateStats();
            if (sortPanel?.style.display === 'flex') updateSortStats();
        });
        document.getElementById('menu-clear').addEventListener('click', () => {
            dropdown.classList.remove('show');
            clearPools();
        });
        document.getElementById('menu-compare').addEventListener('click', () => {
            dropdown.classList.remove('show');
            showComparePanel();
        });
        document.getElementById('menu-sort').addEventListener('click', () => {
            dropdown.classList.remove('show');
            showSortPanel();
            updateSortStats();
        });
    }

    function showComparePanel() {
        if (sortPanel) sortPanel.style.display = 'none';
        if (!panel) initPanel();
        const visible = panel.style.display === 'flex';
        panel.style.display = visible ? 'none' : 'flex';
        if (!visible) { setTimeout(() => centerEl(panel), 10); updateStats(); }
    }

    function showSortPanel() {
        if (panel) panel.style.display = 'none';
        if (!sortPanel) initSortPanel();
        const visible = sortPanel.style.display === 'flex';
        sortPanel.style.display = visible ? 'none' : 'flex';
        if (!visible) setTimeout(() => centerEl(sortPanel), 10);
    }

    function centerEl(el) {
        if (!el) return;
        const pw = el.offsetWidth || 600, ph = el.offsetHeight || 500;
        let left = (window.innerWidth - pw) / 2, top = (window.innerHeight - ph) / 2;
        left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - ph - 10));
        Object.assign(el.style, { left: left + 'px', top: top + 'px', right: 'auto', bottom: 'auto' });
        if (ph > window.innerHeight - 20) { el.style.height = (window.innerHeight - 20) + 'px'; el.style.top = '10px'; }
    }

    function getColumnWidth() {
        const container = document.getElementById('compare-container');
        const vis = Array.from(container.querySelectorAll('.compare-column')).filter(c => c.style.display !== 'none');
        return (container.offsetWidth - (vis.length - 1) * 10) / vis.length;
    }

    function toggleColumnExpand(colId, listId) {
        const col = document.getElementById(colId);
        if (!col) return;
        if (col.classList.contains('expanded')) {
            col.classList.remove('expanded');
            document.getElementById(colId + '-placeholder')?.remove();
            col.style.cssText = '';
        } else {
            const w = getColumnWidth();
            const ph = document.createElement('div');
            ph.id = colId + '-placeholder';
            ph.className = 'compare-column-placeholder';
            ph.style.width = ph.style.minWidth = ph.style.maxWidth = w + 'px';
            col.parentNode.insertBefore(ph, col.nextSibling);
            col.classList.add('expanded');
        }
        updateColumnPositions();
    }

    function updateColumnPositions() {
        const container = document.getElementById('compare-container');
        const vis = Array.from(container.querySelectorAll('.compare-column')).filter(c => c.style.display !== 'none');
        const cw = getColumnWidth();
        const cwPercent = (cw / container.offsetWidth) * 100;
        vis.forEach(col => {
            const ph = document.getElementById(col.id + '-placeholder');
            if (ph) ph.style.width = ph.style.minWidth = ph.style.maxWidth = cw + 'px';
        });
        vis.forEach(col => {
            if (!col.classList.contains('expanded')) {
                col.style.position = col.style.left = col.style.right = col.style.top = col.style.height = col.style.zIndex = col.style.background = col.style.boxShadow = col.style.border = col.style.width = '';
            }
        });
        const borders = { 'iwara-column': '#ffffffff', 'hanime1me-column': '#ff0000ff', 'matched-column': '#00ff88' };
        vis.forEach((col, i) => {
            if (col.classList.contains('expanded')) {
                const leftPct = i * (cwPercent + (10 / container.offsetWidth) * 100);
                Object.assign(col.style, {
                    position: 'absolute', top: '45px', height: 'calc(100% - 57px)',
                    zIndex: '10', background: 'rgba(0,0,0,0.95)',
                    boxShadow: '0 0 30px rgba(0,204,255,0.3)',
                    border: '2px solid ' + (borders[col.id] || '#fff'),
                    left: leftPct + '%', width: cwPercent + '%'
                });
            }
        });
    }

    // --- 初始化对比面板 ---
    function initPanel() {
        panel = document.createElement('div');
        panel.id = 'matcher-panel';
        const th = GM_getValue('match_threshold', 0.5);
        const tol = GM_getValue('duration_tolerance', 10);

        panel.innerHTML = `
            <div class="panel-header" id="panel-header">
                <h3>iwara/hanime1 \u6BD4\u5BF9\u5668</h3>
                <div class="close-btn" id="close-panel">\u00D7</div>
            </div>
            <div class="stat-banner">
                <div class="stat-item">iwara \u6C60\uFF1A<b id="total-i">0</b></div>
                <div class="stat-item">hanime1 \u6C60\uFF1A<b id="total-h">0</b></div>
            </div>
            <div class="progress-container" id="p-container"><div id="progress-bar"></div></div>
            <div class="filter-controls">
                <div class="filter-item" style="margin-bottom:0">
                    <label>\u65F6\u957F\u5BB9\u5DEE:</label>
                    <input type="number" id="tolerance" min="0" max="300" step="5" value="${tol}">
                    <span>\u79D2</span>
                    <button class="swap-mode-btn" id="btn-swap-mode">\uD83D\uDD04 \u4EA4\u6362\u5217</button>
                </div>
                <div class="filter-hint" style="margin-top:5px;margin-left:10px">\u23F1\uFE0F \u81EA\u52A8\u820D\u5F03\u65E0\u65F6\u957F\u7684\u89C6\u9891\uFF0C\u65F6\u957F\u5DEE\u5F02 \u2264 \u5BB9\u5DEE\u79D2\u6570\u624D\u5339\u914D</div>
            </div>
            <div class="threshold-wrap">
                <span>\u6807\u9898\u5339\u914D\u9608\u503C:</span>
                <input type="range" id="threshold-range" min="0.1" max="1.0" step="0.05" value="${th}">
                <span id="threshold-val">${th}</span>
            </div>
            <div class="btn-row">
                <button id="btn-cap" class="btn-capture">\uD83D\uDCBE \u4FDD\u5B58\u5F53\u524D\u9875</button>
                <button id="btn-comp">\uD83D\uDD0D \u5F00\u59CB\u6BD4\u5BF9</button>
                <button id="btn-clr">\uD83D\uDDD1\uFE0F \u6E05\u7A7A\u6570\u636E</button>
                <button id="btn-toggle-matched">\uD83D\uDCCB \u663E\u793A\u5339\u914D\u6210\u529F\u5217</button>
            </div>
            <div class="compare-container" id="compare-container">
                <div class="compare-column" id="iwara-column" data-column="0">
                    <div class="column-header" id="iwara-header">iwara \u72EC\u6709 <span id="diff-i" class="diff-count">0</span></div>
                    <div id="iwara-only" class="list-content"></div>
                </div>
                <div class="compare-column" id="hanime1me-column" data-column="1">
                    <div class="column-header" id="hanime1me-header">hanime1 \u72EC\u6709 <span id="diff-h" class="diff-count">0</span></div>
                    <div id="hanime1me-only" class="list-content"></div>
                </div>
                <div class="compare-column" id="matched-column" data-column="2" style="display:none">
                    <div class="column-header" id="matched-header">\u5339\u914D\u6210\u529F <span id="diff-matched" class="diff-count" style="color:#00ff88">0</span></div>
                    <div id="matched-list" class="list-content"></div>
                </div>
            </div>`;

        document.body.appendChild(panel);
        progressBar = document.getElementById('progress-bar');
        progressContainer = document.getElementById('p-container');
        thresholdInput = document.getElementById('threshold-range');
        thresholdVal = document.getElementById('threshold-val');
        toleranceInput = document.getElementById('tolerance');

        let swapMode = false, selectedColumn = null;

        document.getElementById('btn-cap').onclick = () => capturePage();
        document.getElementById('btn-comp').onclick = performCompare;
        document.getElementById('btn-clr').onclick = clearPools;
        document.getElementById('btn-toggle-matched').onclick = () => {
            const mc = document.getElementById('matched-column');
            const btn = document.getElementById('btn-toggle-matched');
            const hidden = mc.style.display === 'none' || mc.style.display === '' || getComputedStyle(mc).display === 'none';
            mc.style.display = hidden ? 'flex' : 'none';
            btn.innerText = hidden ? '\uD83D\uDCCB \u9690\u85CF\u6210\u529F\u5217' : '\uD83D\uDCCB \u663E\u793A\u5339\u914D\u6210\u529F\u5217';
            if (hidden && swapMode) mc.classList.add('column-swap-ready');
            if (!hidden && selectedColumn?.id === 'matched-column') { mc.classList.remove('column-swap-selected'); selectedColumn = null; }
            centerEl(panel);
            setTimeout(updateColumnPositions, 100);
        };

        document.getElementById('btn-swap-mode').onclick = () => {
            swapMode = !swapMode;
            const btn = document.getElementById('btn-swap-mode');
            btn.classList.toggle('active', swapMode);
            btn.innerText = swapMode ? '\u2705 \u70B9\u51FB\u5217\u4EA4\u6362' : '\uD83D\uDD04 \u4EA4\u6362\u5217';
            if (swapMode) panel.querySelectorAll('.compare-column.expanded').forEach(c => {
                const ids = { 'iwara-column': 'iwara-only', 'hanime1me-column': 'hanime1me-only', 'matched-column': 'matched-list' };
                if (ids[c.id]) toggleColumnExpand(c.id, ids[c.id]);
            });
            panel.querySelectorAll('.compare-column').forEach(c => {
                if (c.style.display !== 'none') c.classList.toggle('column-swap-ready', swapMode);
                if (!swapMode) c.classList.remove('column-swap-selected');
            });
            if (!swapMode && selectedColumn) { selectedColumn.classList.remove('column-swap-selected'); selectedColumn = null; }
        };

        document.getElementById('close-panel').onclick = () => { panel.style.display = 'none'; };

        ['iwara', 'hanime1me', 'matched'].forEach(name => {
            const colId = name + '-column', listId = name === 'hanime1me' ? 'hanime1me-only' : name === 'matched' ? 'matched-list' : 'iwara-only';
            document.getElementById(name + '-header').onclick = (e) => {
                if (swapMode) { e.stopPropagation(); handleColumnSwap(colId); }
                else toggleColumnExpand(colId, listId);
            };
        });

        function handleColumnSwap(colId) {
            const clicked = document.getElementById(colId);
            if (!clicked || clicked.style.display === 'none') return;
            if (!selectedColumn) { selectedColumn = clicked; clicked.classList.add('column-swap-selected'); }
            else if (selectedColumn.id !== colId) {
                const container = document.getElementById('compare-container');
                const ph = document.createElement('div'); ph.style.display = 'none';
                container.insertBefore(ph, selectedColumn);
                container.insertBefore(selectedColumn, clicked);
                container.insertBefore(clicked, ph);
                container.removeChild(ph);
                const tmp = selectedColumn.getAttribute('data-column');
                selectedColumn.setAttribute('data-column', clicked.getAttribute('data-column'));
                clicked.setAttribute('data-column', tmp);
                selectedColumn.classList.remove('column-swap-selected');
                clicked.classList.remove('column-swap-selected');
                selectedColumn = null;
                centerEl(panel);
            } else { selectedColumn.classList.remove('column-swap-selected'); selectedColumn = null; }
        }

        thresholdInput.oninput = (e) => { thresholdVal.innerText = parseFloat(e.target.value).toFixed(2); GM_setValue('match_threshold', e.target.value); };
        toleranceInput.onchange = (e) => { GM_setValue('duration_tolerance', parseInt(e.target.value) || 30); };
        const ro = new ResizeObserver(() => { if (panel.style.display === 'flex') { centerEl(panel); updateColumnPositions(); } });
        ro.observe(panel);
        window.addEventListener('resize', () => { if (panel.style.display === 'flex') updateColumnPositions(); });
    }

    // --- 初始化排序面板 ---
    function initSortPanel() {
        sortPanel = document.createElement('div');
        sortPanel.id = 'sort-panel';
        sortPanel.innerHTML = `
            <div class="panel-header">
                <h3>\uD83D\uDCCB iwara \u6C60\u89C6\u9891\u6392\u5E8F</h3>
                <div class="close-btn" id="close-sort">\u00D7</div>
            </div>
            <div class="stat-banner" style="margin-bottom:8px">
                <div class="stat-item">\u6C60\u5185\u89C6\u9891\uFF1A<b id="sort-pool-count">0</b></div>
                <div class="stat-item">\u6709 views/likes\uFF1A<b id="sort-meta-count">0</b></div>
                <div class="stat-item">\u8FC7\u6EE4\u7ED3\u679C\uFF1A<b id="sort-filtered-count">0</b></div>
            </div>
            <div class="sort-body">
                <div class="sort-left">
                    <div class="btn-row" style="margin-bottom:8px">
                        <button id="sort-btn-cap" class="btn-capture">\uD83D\uDCBE \u4FDD\u5B58\u5F53\u524D\u9875</button>
                        <button id="sort-btn-clr" style="background:#6b2020">\uD83D\uDDD1\uFE0F \u6E05\u7A7A\u6C60</button>
                    </div>
                    <div class="sort-levels">
                        <div class="level-label">\u6392\u5E8F\u4F18\u5148\u7EA7\uFF08\u4ECE\u4E0A\u5230\u4E0B\uFF09</div>
                        <div class="sort-level-row">
                            <label>1\u7EA7:</label>
                            <select id="sort-field-1"><option value="views">\u64AD\u653E\u91CF</option><option value="likes">\u70B9\u8D5E</option><option value="ratio">\u70B9\u8D5E\u7387</option><option value="date">\u65E5\u671F</option></select>
                            <select id="sort-dir-1"><option value="desc">\u964D\u5E8F</option><option value="asc">\u5347\u5E8F</option></select>
                        </div>
                        <div class="sort-level-row">
                            <label>2\u7EA7:</label>
                            <select id="sort-field-2"><option value="">\u65E0</option><option value="views">\u64AD\u653E\u91CF</option><option value="likes">\u70B9\u8D5E</option><option value="ratio">\u70B9\u8D5E\u7387</option><option value="date">\u65E5\u671F</option></select>
                            <select id="sort-dir-2"><option value="desc">\u964D\u5E8F</option><option value="asc">\u5347\u5E8F</option></select>
                        </div>
                        <div class="sort-level-row">
                            <label>3\u7EA7:</label>
                            <select id="sort-field-3"><option value="">\u65E0</option><option value="views">\u64AD\u653E\u91CF</option><option value="likes">\u70B9\u8D5E</option><option value="ratio">\u70B9\u8D5E\u7387</option><option value="date">\u65E5\u671F</option></select>
                            <select id="sort-dir-3"><option value="desc">\u964D\u5E8F</option><option value="asc">\u5347\u5E8F</option></select>
                        </div>
                    </div>
                    <button id="btn-sort-run" style="background:#004a80;font-weight:bold;width:100%;margin-bottom:8px">\u5F00\u59CB\u6392\u5E8F</button>
                    <div style="background:#252525;border-radius:6px;padding:8px 10px;border:1px solid #333">
                        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
                            <label style="font-size:11px;color:#aaa;flex-shrink:0">\u5173\u952E\u5B57:</label>
                            <input type="text" id="sort-keyword" placeholder="\u6807\u988C\u5173\u952E\u5B57\u8FC7\u6EE4..." style="flex:1;background:#333;color:#fff;border:1px solid #555;border-radius:4px;padding:4px 8px;font-size:11px">
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                            <div>
                                <div style="font-size:10px;color:#00ff88;margin-bottom:4px">\uD83D\uDC41 Views \u533A\u95F4</div>
                                <div style="display:flex;gap:4px">
                                    <input type="number" id="filter-view-min" placeholder="\u6700\u5C0F" min="0" style="width:100%;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:4px 5px;font-size:11px">
                                    <input type="number" id="filter-view-max" placeholder="\u6700\u5927" min="0" style="width:100%;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:4px 5px;font-size:11px">
                                </div>
                            </div>
                            <div>
                                <div style="font-size:10px;color:#ff6b9d;margin-bottom:4px">\u2764\uFE0F Likes \u533A\u95F4</div>
                                <div style="display:flex;gap:4px">
                                    <input type="number" id="filter-like-min" placeholder="\u6700\u5C0F" min="0" style="width:100%;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:4px 5px;font-size:11px">
                                    <input type="number" id="filter-like-max" placeholder="\u6700\u5927" min="0" style="width:100%;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:4px 5px;font-size:11px">
                                </div>
                            </div>
                            <div>
                                <div style="font-size:10px;color:#ffcc00;margin-bottom:4px">\uD83D\uDCCA \u8D5E\u7387(%)</div>
                                <div style="display:flex;gap:4px">
                                    <input type="number" id="filter-ratio-min" placeholder="\u6700\u5C0F" min="0" max="100" step="0.1" style="width:100%;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:4px 5px;font-size:11px">
                                    <input type="number" id="filter-ratio-max" placeholder="\u6700\u5927" min="0" max="100" step="0.1" style="width:100%;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:4px 5px;font-size:11px">
                                </div>
                            </div>
                            <div>
                                <div style="font-size:10px;color:#6bc5ff;margin-bottom:4px">\uD83D\uDCC5 \u65E5\u671F\u8303\u56F4</div>
                                <div style="display:flex;gap:4px">
                                    <input type="date" id="filter-date-from" style="width:100%;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:4px 5px;font-size:11px">
                                    <input type="date" id="filter-date-to" style="width:100%;background:#333;color:#fff;border:1px solid #555;border-radius:3px;padding:4px 5px;font-size:11px">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="sort-right" id="sort-right">
                    <div class="sort-right-header">
                        <span>\u6392\u5E8F\u7ED3\u679C</span>
                        <span id="sort-result-info" style="font-size:11px;color:#888;font-weight:normal"></span>
                    </div>
                    <div class="sort-col-toggles" id="sort-col-toggles">
                        <span class="sort-col-toggle on view" data-col="view">\uD83D\uDC41 Views</span>
                        <span class="sort-col-toggle on like" data-col="like">\u2764\uFE0F Likes</span>
                        <span class="sort-col-toggle on ratio" data-col="ratio">\uD83D\uDCCA \u8D5E\u7387</span>
                        <span class="sort-col-toggle on date" data-col="date">\uD83D\uDCC5 \u65E5\u671F</span>
                        <span class="sort-col-toggle on duration" data-col="duration">\u23F1\uFE0F \u65F6\u957F</span>
                    </div>
                    <div class="sort-list" id="sort-list"></div>
                </div>`;
        document.body.appendChild(sortPanel);

        document.getElementById('close-sort').onclick = () => { sortPanel.style.display = 'none'; };
        document.getElementById('btn-sort-run').onclick = runSort;
        document.getElementById('sort-btn-cap').onclick = () => { capturePage(); updateSortStats(); };

        // 列显示切换
        document.getElementById('sort-col-toggles').addEventListener('click', (e) => {
            const t = e.target.closest('.sort-col-toggle');
            if (t) { t.classList.toggle('on'); runSort(); }
        });
        document.getElementById('sort-btn-clr').onclick = () => {
            if (confirm('\u6E05\u7A7A iwara \u6C60\u6240\u6709\u6570\u636E\uFF1F')) {
                GM_setValue('iwara_pool', []);
                updateStats(); updateSortStats();
                document.getElementById('sort-right').classList.remove('show');
            }
        };

        const ro = new ResizeObserver(() => { if (sortPanel.style.display === 'flex') centerEl(sortPanel); });
        ro.observe(sortPanel);
    }

    function updateSortStats() {
        const pool = GM_getValue('iwara_pool', []) || [];
        document.getElementById('sort-pool-count').innerText = pool.length;
        document.getElementById('sort-meta-count').innerText = pool.filter(v => v.views != null || v.likes != null).length;
    }

    function runSort() {
        const pool = GM_getValue('iwara_pool', []) || [];
        const list = document.getElementById('sort-list');
        const keyword = document.getElementById('sort-keyword').value.trim().toLowerCase();

        const viewMin = parseFloat(document.getElementById('filter-view-min').value);
        const viewMax = parseFloat(document.getElementById('filter-view-max').value);
        const likeMin = parseFloat(document.getElementById('filter-like-min').value);
        const likeMax = parseFloat(document.getElementById('filter-like-max').value);
        const ratioMin = parseFloat(document.getElementById('filter-ratio-min').value);
        const ratioMax = parseFloat(document.getElementById('filter-ratio-max').value);
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;
        const dateFromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
        const dateToTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Infinity;

        const levels = [1, 2, 3].map(i => ({
            field: document.getElementById(`sort-field-${i}`).value,
            dir: document.getElementById(`sort-dir-${i}`).value
        })).filter(l => l.field);

        updateSortStats();
        if (!pool.length) { list.innerHTML = '<div style="padding:30px;text-align:center;color:#666">\u6C60\u4E3A\u7A7A</div>'; document.getElementById('sort-right').classList.add('show'); return; }

        const filtered = pool.map(v => {
            const views = v.views || 0, likes = v.likes || 0;
            const ratio = views > 0 ? likes / views : 0;
            const dateTs = parseDate(v.date);
            return { ...v, views, likes, ratio, dateTs };
        }).filter(v => {
            if (keyword && !v.title.toLowerCase().includes(keyword)) return false;
            if (!isNaN(viewMin) && v.views < viewMin) return false;
            if (!isNaN(viewMax) && v.views > viewMax) return false;
            if (!isNaN(likeMin) && v.likes < likeMin) return false;
            if (!isNaN(likeMax) && v.likes > likeMax) return false;
            const pct = v.ratio * 100;
            if (!isNaN(ratioMin) && pct < ratioMin) return false;
            if (!isNaN(ratioMax) && pct > ratioMax) return false;
            if (dateFromTs > 0 && v.dateTs > 0 && v.dateTs < dateFromTs) return false;
            if (dateToTs < Infinity && v.dateTs > 0 && v.dateTs > dateToTs) return false;
            return true;
        }).sort((a, b) => {
            for (const lv of levels) {
                const va = lv.field === 'date' ? a.dateTs : a[lv.field];
                const vb = lv.field === 'date' ? b.dateTs : b[lv.field];
                const diff = (vb || 0) - (va || 0);
                if (diff !== 0) return lv.dir === 'desc' ? diff : -diff;
            }
            return 0;
        });

        document.getElementById('sort-filtered-count').innerText = filtered.length;
        document.getElementById('sort-result-info').textContent = `${filtered.length} \u6761`;
        document.getElementById('sort-right').classList.add('show');

        // 读取列显示状态
        const showCol = {};
        document.querySelectorAll('#sort-col-toggles .sort-col-toggle').forEach(el => {
            showCol[el.dataset.col] = el.classList.contains('on');
        });

        list.innerHTML = '';
        if (!filtered.length) { list.innerHTML = '<div style="padding:30px;text-align:center;color:#666">\u65E0\u7B26\u5408\u6761\u4EF6</div>'; return; }

        filtered.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'sort-item';
            const rankCls = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : 'normal';
            let badges = '';
            if (showCol.view) badges += `<span class="sort-badge view">\uD83D\uDC41 ${formatNumber(item.views)}</span>`;
            if (showCol.like) badges += `<span class="sort-badge like">\u2764\uFE0F ${formatNumber(item.likes)}</span>`;
            if (showCol.ratio) badges += `<span class="sort-badge ratio">${(item.ratio * 100).toFixed(1)}%</span>`;
            if (showCol.date && item.date) badges += `<span class="sort-badge date">\uD83D\uDCC5 ${item.date}</span>`;
            if (showCol.duration) badges += `<span class="duration-badge duration-iwara">${formatDuration(item.seconds)}</span>`;
            div.innerHTML = `
                <div class="sort-rank ${rankCls}">${idx + 1}</div>
                <div class="sort-title"><a href="${item.url}" target="_blank">${item.title}</a></div>
                ${badges ? `<div class="sort-meta">${badges}</div>` : ''}`;
            list.appendChild(div);
        });
    }

    // --- 捕获数据 ---
    function captureiwara() {
        return [...document.querySelectorAll('.videoTeaser')].map(el => {
            try {
                const title = el.querySelector('.videoTeaser__title')?.innerText.trim() || '';
                const href = el.querySelector('.videoTeaser__thumbnail')?.getAttribute('href');
                const url = href ? 'https://www.iwara.tv' + href : '';
                const duration = el.querySelector('.duration .text')?.innerText.trim() || '';
                const viewsText = el.querySelector('.views .text')?.innerText.trim() || '';
                const likesText = el.querySelector('.likes .text')?.innerText.trim() || '';
                const dateText = el.querySelector('.byline .text')?.innerText.trim() || '';
                const views = viewsText ? parseCompactNumber(viewsText) : null;
                const likes = likesText ? parseCompactNumber(likesText) : null;
                return title && url ? { title, url, duration, seconds: parseDuration(duration), views, likes, date: dateText || null } : null;
            } catch { return null; }
        }).filter(Boolean);
    }

    function capturehanime1() {
        return [...document.querySelectorAll('.video-item-container')].map(el => {
            try {
                const title = el.getAttribute('title') || el.querySelector('.title')?.innerText.trim() || '';
                const url = el.querySelector('.video-link')?.getAttribute('href') || '';
                const duration = el.querySelector('.duration')?.innerText.trim() || '';
                return title && url ? { title, url, duration, seconds: parseDuration(duration) } : null;
            } catch { return null; }
        }).filter(Boolean);
    }

    function capturePage() {
        const host = window.location.host;
        let poolKey, videos;
        if (host.includes('iwara.tv')) { poolKey = 'iwara_pool'; videos = captureiwara(); }
        else if (host.includes('hanime')) { poolKey = 'hanime1me_pool'; videos = capturehanime1(); }
        else { showPanelMsg('\u26A0\uFE0F \u5F53\u524D\u9875\u9762\u4E0D\u652F\u6301', '#ff6b6b'); return; }

        let pool = GM_getValue(poolKey, []) || [];
        let added = 0, skipped = 0, duplicated = 0;
        videos.forEach(v => {
            if (!v.seconds) { skipped++; return; }
            if (pool.some(p => p.url === v.url)) { duplicated++; return; }
            pool.push(v); added++;
        });
        GM_setValue(poolKey, pool);
        updateStats();

        const msg = added === 0 && duplicated > 0
            ? `\u26A0\uFE0F \u5F53\u524D\u9875\u5168\u90E8 ${duplicated} \u6761\u5DF2\u5B58\u5728`
            : `\u2705 \u65B0\u589E ${added} \u6761\uFF0C\u603B\u8BA1 ${pool.length}\uFF08\u91CD\u590D ${duplicated}\uFF0C\u65E0\u65F6\u957F ${skipped}\uFF09`;
        const color = added === 0 && duplicated > 0 ? '#ffaa00' : '#00ff88';
        showPanelMsg(msg, color);
    }

    function showPanelMsg(msg, color = '#00ff88') {
        document.getElementById('_capToast')?.remove();
        const t = document.createElement('div');
        t.id = '_capToast';
        t.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1e1e1e;color:${color};padding:10px 24px;border-radius:8px;z-index:999999;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.6);border:1px solid #444;white-space:nowrap;transition:opacity 0.3s`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
    }

    // --- 核心比对 ---
    async function performCompare() {
        const iwara = GM_getValue('iwara_pool', []) || [];
        const hanime = GM_getValue('hanime1me_pool', []) || [];
        const thres = parseFloat(thresholdInput.value);
        const tolerance = parseInt(toleranceInput.value) || 30;
        const iDur = iwara.filter(v => v.seconds !== null);
        const hDur = hanime.filter(v => v.seconds !== null);

        const $i = document.getElementById('iwara-only');
        const $h = document.getElementById('hanime1me-only');
        const $m = document.getElementById('matched-list');
        $i.innerHTML = $h.innerHTML = $m.innerHTML = '<div style="padding:20px;text-align:center;color:#666">\u6BD4\u5BF9\u4E2D...</div>';

        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';

        const total = iDur.length + hDur.length;
        const matchedPairs = [], iOnly = [], hOnly = [];
        const hMatched = new Set(), iMatched = new Set();

        for (let i = 0; i < iDur.length; i++) {
            const item = iDur[i];
            let maxSim = 0, best = null;
            for (const h of hDur) {
                if (Math.abs(item.seconds - h.seconds) > tolerance) continue;
                const s = titleSim(cleanTitle(item.title), cleanTitle(h.title));
                if (s > maxSim) { maxSim = s; best = h; }
            }
            if (maxSim >= thres && best) {
                matchedPairs.push({ iwara: item, hanime: best, similarity: maxSim });
                hMatched.add(best.url);
                iMatched.add(item.url);
            }
            if (i % 5 === 0) { progressBar.style.width = (i / total * 100) + '%'; await new Promise(r => setTimeout(r, 0)); }
        }

        for (const item of iDur) if (!iMatched.has(item.url)) {
            let maxSim = 0;
            for (const h of hDur) { if (Math.abs(item.seconds - h.seconds) > tolerance) continue; maxSim = Math.max(maxSim, titleSim(cleanTitle(item.title), cleanTitle(h.title))); }
            iOnly.push({ ...item, maxSimilarity: maxSim });
        }
        for (const item of hDur) if (!hMatched.has(item.url)) {
            let maxSim = 0;
            for (const i of iDur) { if (Math.abs(item.seconds - i.seconds) > tolerance) continue; maxSim = Math.max(maxSim, titleSim(cleanTitle(item.title), cleanTitle(i.title))); }
            hOnly.push({ ...item, maxSimilarity: maxSim });
        }

        progressBar.style.width = '100%';
        setTimeout(() => progressContainer.style.display = 'none', 500);
        renderResults(iOnly, hOnly, matchedPairs, iDur, hDur, thres, tolerance);
    }

    function renderResults(iOnly, hOnly, matchedPairs, iDur, hDur, thres, tolerance) {
        const $i = document.getElementById('iwara-only');
        const $h = document.getElementById('hanime1me-only');
        const $m = document.getElementById('matched-list');
        $i.innerHTML = $h.innerHTML = $m.innerHTML = '';
        matchedPairs.sort((a, b) => b.similarity - a.similarity);

        function renderDiffItem(item, pool, container, durClass) {
            const sims = findTopSimilar(item, pool, thres, 3);
            const maxSim = sims.length > 0 ? sims[0].titleSim : 0;
            const div = document.createElement('div');
            div.className = 'diff-item';
            div.innerHTML = `
                <div class="item-title">
                    <a href="${item.url}" target="_blank">${item.title}</a>
                    ${maxSim > 0 ? `<span class="similarity-badge">${(maxSim * 100).toFixed(0)}%</span>` : ''}
                </div>
                <div class="duration-badge ${durClass}">${formatDuration(item.seconds)}</div>`;
            div._similarities = sims;
            if (sims.length > 0) bindTooltip(div, sims, thres);
            container.appendChild(div);
        }

        iOnly.forEach(item => renderDiffItem(item, hDur, $i, 'duration-iwara'));
        hOnly.forEach(item => renderDiffItem(item, iDur, $h, 'duration-hanime'));

        matchedPairs.forEach(pair => {
            const div = document.createElement('div');
            div.className = 'diff-item';
            div.style.background = '#1a2a2a';
            const otherSim = [
                ...hDur.filter(h => h.url !== pair.hanime.url).map(h => ({ title: h.title, url: h.url, duration: h.duration, seconds: h.seconds, titleSim: titleSim(cleanTitle(pair.iwara.title), cleanTitle(h.title)), durationDiff: Math.abs(pair.iwara.seconds - h.seconds), type: 'hanime' })),
                ...iDur.filter(i => i.url !== pair.iwara.url).map(i => ({ title: i.title, url: i.url, duration: i.duration, seconds: i.seconds, titleSim: titleSim(cleanTitle(pair.hanime.title), cleanTitle(i.title)), durationDiff: Math.abs(pair.hanime.seconds - i.seconds), type: 'iwara' }))
            ].filter(s => s.titleSim >= thres * 0.6).sort((a, b) => b.titleSim - a.titleSim).slice(0, 4);

            div.innerHTML = `
                <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                        <a href="${pair.iwara.url}" target="_blank" style="color:#00ccff;font-size:11px;flex:1">${pair.iwara.title}</a>
                        <span class="duration-badge duration-iwara">${formatDuration(pair.iwara.seconds)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                        <a href="${pair.hanime.url}" target="_blank" style="color:#00ffaa;font-size:11px;flex:1">${pair.hanime.title}</a>
                        <span class="duration-badge duration-hanime">${formatDuration(pair.hanime.seconds)}</span>
                    </div>
                </div>
                <span class="similarity-badge" style="background:#00ff88;color:#000;font-weight:bold">${(pair.similarity * 100).toFixed(1)}%</span>`;
            if (otherSim.length > 0) { div._similarities = otherSim; bindTooltip(div, otherSim, thres); }
            $m.appendChild(div);
        });

        document.getElementById('diff-i').innerText = iOnly.length;
        document.getElementById('diff-h').innerText = hOnly.length;
        document.getElementById('diff-matched').innerText = matchedPairs.length;

        const iFilt = iDur.length, hFilt = hDur.length;
        const iTot = (GM_getValue('iwara_pool', []) || []).length;
        const hTot = (GM_getValue('hanime1me_pool', []) || []).length;
        if (iFilt < iTot || hFilt < hTot) {
            const n = document.createElement('div');
            n.style.cssText = 'text-align:center;font-size:10px;color:#ffaa00;margin-top:5px';
            n.innerHTML = `\u23F1\uFE0F \u5DF2\u8FC7\u6EE4\u65E0\u65F6\u957F\u89C6\u9891: iwara ${iTot - iFilt}\u6761, hanime1 ${hTot - hFilt}\u6761`;
            panel.querySelector('.compare-container').before(n);
            setTimeout(() => n.remove(), 5000);
        }

        if (!iOnly.length) $i.innerHTML = '<div style="padding:20px;text-align:center;color:#666">\u6CA1\u6709\u72EC\u6709\u9879</div>';
        if (!hOnly.length) $h.innerHTML = '<div style="padding:20px;text-align:center;color:#666">\u6CA1\u6709\u72EC\u6709\u9879</div>';
    }

    function bindTooltip(div, sims, thres) {
        div.addEventListener('mouseenter', () => {
            const tip = document.createElement('div');
            tip.id = 'similarity-tooltip';
            tip.innerHTML = `
                <div style="font-size:10px;color:#888;margin-bottom:4px">\u76F8\u4F3C\u9879\uFF1A</div>
                ${sims.map(s => `
                    <div style="margin:3px 0;padding:3px;background:#1a1a1a;border-radius:3px">
                        <a href="${s.url}" target="_blank" style="color:${s.type === 'iwara' ? '#00ccff' : s.type === 'hanime' ? '#00ffaa' : '#5cafff'};font-size:11px">${s.title}</a>
                        <span style="color:${s.titleSim >= thres ? '#00ff88' : '#ffaa00'};font-size:10px;float:right">${(s.titleSim * 100).toFixed(1)}%</span>
                        <div style="font-size:9px;color:#888;margin-top:2px">\u23F1\uFE0F ${s.duration} | \u76F8\u5DEE ${s.durationDiff}\u79D2</div>
                    </div>`).join('')}`;
            document.body.appendChild(tip);
            const r = div.getBoundingClientRect();
            let left = r.right + 10, top = r.top;
            if (r.right + 260 > window.innerWidth) left = r.left - 260;
            if (r.top + tip.offsetHeight + 10 > window.innerHeight) top = window.innerHeight - tip.offsetHeight - 10;
            tip.style.left = Math.max(10, left) + 'px';
            tip.style.top = Math.max(10, top) + 'px';
        });
        div.addEventListener('mouseleave', () => document.getElementById('similarity-tooltip')?.remove());
    }

    function clearPools() {
        if (confirm('\u6E05\u7A7A\u6240\u6709\u5B58\u50A8\u7684\u6570\u636E\uFF1F')) {
            GM_setValue('iwara_pool', []);
            GM_setValue('hanime1me_pool', []);
            updateStats();
            showPanelMsg('\u2705 \u6C60\u5DF2\u6E05\u7A7A');
            if (panel?.style.display === 'flex') performCompare();
            if (sortPanel?.style.display === 'flex') {
                updateSortStats();
                document.getElementById('sort-right')?.classList.remove('show');
            }
        }
    }

    function updateStats() {
        const ti = document.getElementById('total-i');
        const th = document.getElementById('total-h');
        if (ti) ti.innerText = (GM_getValue('iwara_pool', []) || []).length;
        if (th) th.innerText = (GM_getValue('hanime1me_pool', []) || []).length;
    }

    createMenuButton();
})();