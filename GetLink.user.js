// ==UserScript==
// @name         GetLink - 网页链接识别助手
// @namespace    https://github.com/ZERONE2077/GetLink
// @version      2.6
// @description  识别网页上的 magnet/http 链接并进行后续操作，支持网盘/离线下载扩展、状态记忆、右键增强、深色模式
// @match        http://*/*
// @match        https://*/*
// @exclude      https://115.com/*
// @exclude      http://115.com/*
// @exclude      https://www.douyin.com/*
// @exclude      https://www.tiktok.com/*
// @connect      115.com
// @connect      webapi.115.com
// @run-at       document-end
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @updateURL    https://raw.githubusercontent.com/ZERONE2077/GetLink/main/GetLink.user.js
// @downloadURL  https://raw.githubusercontent.com/ZERONE2077/GetLink/main/GetLink.user.js
// ==/UserScript==

(function () {
  'use strict';

  var API = {
    sign: 'https://115.com/?ct=offline&ac=space&_=' + Date.now(),
    downPath: 'https://webapi.115.com/offine/downpath',
    addOne: 'https://115.com/web/lixian/?ct=lixian&ac=add_task_url',
    addMany: 'https://115.com/web/lixian/?ct=lixian&ac=add_task_urls'
  };

  var THEME_KEY = 'tm_115_theme';
  var STATUS_KEY = 'tm_115_hash_status_v2';
  var SAVE_CID_KEY = 'tm_115_save_cid';
  var THEME_MQ = window.matchMedia('(prefers-color-scheme: dark)');
  var BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  var TITLE_SELECTORS = [
    'h1','h2','h3','.title','.subject','[class*="title"]','strong',
    '.post-title','.entry-title','.article-title','.torrent-name','.file-name',
    '.filename','[class*="name"]','[class*="heading"]'
  ];

  var state = {
    items: [],
    panelOpen: false,
    busy: false,
    saveCid: localStorage.getItem(SAVE_CID_KEY) || '',
    filterText: '',
    theme: localStorage.getItem(THEME_KEY) || 'auto',
    statusMap: loadStatusMap()
  };

  function loadStatusMap() {
    try { return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }
  function saveStatusMap() {
    try {
      var now = Date.now(), kept = {}, keys = Object.keys(state.statusMap || {});
      keys.forEach(function (k) {
        var v = state.statusMap[k];
        if (v && (!v.time || now - v.time < 1000 * 60 * 60 * 24 * 180)) kept[k] = v;
      });
      state.statusMap = kept;
      localStorage.setItem(STATUS_KEY, JSON.stringify(kept));
    } catch (_) {}
  }
  function setHashStatus(hash, status, text) {
    if (!hash) return;
    state.statusMap[hash] = { status: status, text: text || status, time: Date.now() };
    saveStatusMap();
  }
  function getHashStatus(hash) { return hash ? state.statusMap[hash] : null; }
  function statusText(st) {
    if (!st) return '';
    if (st.status === 'added') return '已添加';
    if (st.status === 'exists') return '已存在';
    if (st.status === 'invalid') return '无效链接';
    if (st.status === 'verify') return '需验证';
    if (st.status === 'error') return st.text || '失败';
    return st.text || '';
  }
  function statusClass(st) {
    if (!st) return '';
    if (st.status === 'added') return 'tm115_status_ok';
    if (st.status === 'exists') return 'tm115_status_dup';
    return 'tm115_status_err';
  }

  function resolveTheme() {
    if (state.theme === 'dark') return 'dark';
    if (state.theme === 'light') return 'light';
    return THEME_MQ.matches ? 'dark' : 'light';
  }
  function applyTheme() { document.documentElement.setAttribute('data-tm115-theme', resolveTheme()); }
  function setTheme(m) { state.theme = m; localStorage.setItem(THEME_KEY, m); applyTheme(); if (state.panelOpen) renderPanel(); }
  function cycleTheme() { setTheme(state.theme === 'auto' ? 'dark' : state.theme === 'dark' ? 'light' : 'auto'); }
  function themeIcon() { return resolveTheme() === 'dark' ? '\u263E' : '\u2600'; }
  function themeLabel() { return state.theme === 'auto' ? '跟随系统' : state.theme === 'dark' ? '深色' : '浅色'; }
  applyTheme();
  THEME_MQ.addEventListener('change', function () { if (state.theme === 'auto') applyTheme(); });

  GM_addStyle(''
    + ':root,[data-tm115-theme="light"]{--tm-bg-panel:#fff;--tm-bg-head:#fafafa;--tm-bg-item-hover:#f8f9fa;--tm-bg-input:#fff;--tm-bg-tag-blue:#e8f4fd;--tm-bg-tag-green:#e6f4ea;--tm-text-primary:#222;--tm-text-secondary:#666;--tm-text-muted:#999;--tm-text-dim:#777;--tm-border:#ddd;--tm-border-light:#eee;--tm-border-item:#f0f0f0;--tm-btn-bg:#fff;--tm-btn-border:#ddd;--tm-btn-text:#222;--tm-primary:#e1251b;--tm-primary-text:#fff;--tm-tag-blue-text:#1a73e8;--tm-tag-green-text:#137333;--tm-shadow:0 12px 34px rgba(0,0,0,.24);--tm-btn-shadow:0 6px 18px rgba(0,0,0,.22);--tm-scrollbar-thumb:#c1c1c1;--tm-scrollbar-track:#f1f1f1;--tm-input-text:#222;--tm-close-color:#666;--tm-close-hover:#222}'
    + '[data-tm115-theme="dark"]{--tm-bg-panel:#1e1e1e;--tm-bg-head:#252525;--tm-bg-item-hover:#2a2a2a;--tm-bg-input:#2d2d2d;--tm-bg-tag-blue:#1a3a5c;--tm-bg-tag-green:#1a3a2c;--tm-text-primary:#e0e0e0;--tm-text-secondary:#a0a0a0;--tm-text-muted:#777;--tm-text-dim:#666;--tm-border:#3a3a3a;--tm-border-light:#333;--tm-border-item:#2a2a2a;--tm-btn-bg:#2d2d2d;--tm-btn-border:#444;--tm-btn-text:#ccc;--tm-primary:#e1251b;--tm-primary-text:#fff;--tm-tag-blue-text:#7eb8f4;--tm-tag-green-text:#6ec98a;--tm-shadow:0 12px 34px rgba(0,0,0,.5);--tm-btn-shadow:0 6px 18px rgba(0,0,0,.5);--tm-scrollbar-thumb:#555;--tm-scrollbar-track:#2a2a2a;--tm-input-text:#e0e0e0;--tm-close-color:#888;--tm-close-hover:#e0e0e0}'
    + '#tm115_btn{position:fixed;right:18px;bottom:18px;z-index:2147483647;height:38px;min-width:92px;padding:0 13px;border:0;border-radius:8px;background:var(--tm-primary);color:var(--tm-primary-text);font-size:14px;cursor:pointer;box-shadow:var(--tm-btn-shadow)}#tm115_btn:hover{filter:brightness(1.1)}'
    + '#tm115_panel{position:fixed;right:18px;bottom:66px;z-index:2147483647;width:min(720px,calc(100vw - 36px));max-height:min(720px,calc(100vh - 92px));background:var(--tm-bg-panel);color:var(--tm-text-primary);border:1px solid var(--tm-border);border-radius:8px;box-shadow:var(--tm-shadow);overflow:hidden;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}#tm115_panel *{box-sizing:border-box}'
    + '.tm115_head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--tm-border-light);background:var(--tm-bg-head)}.tm115_title{font-weight:700;white-space:nowrap}.tm115_head_right{display:flex;align-items:center;gap:6px;margin-left:auto}.tm115_filter{flex:1;margin:0 8px;min-width:0}.tm115_filter input{width:100%;border:1px solid var(--tm-border);border-radius:6px;padding:5px 10px;font-size:13px;outline:none;background:var(--tm-bg-input);color:var(--tm-input-text)}.tm115_filter input::placeholder{color:var(--tm-text-muted)}.tm115_filter input:focus{border-color:var(--tm-primary)}'
    + '.tm115_actions{display:flex;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--tm-border-light);align-items:center}.tm115_list{max-height:470px;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--tm-scrollbar-thumb) var(--tm-scrollbar-track)}.tm115_list::-webkit-scrollbar{width:6px}.tm115_list::-webkit-scrollbar-track{background:var(--tm-scrollbar-track)}.tm115_list::-webkit-scrollbar-thumb{background:var(--tm-scrollbar-thumb);border-radius:3px}'
    + '.tm115_item{padding:10px 14px;border-bottom:1px solid var(--tm-border-item);transition:background .15s}.tm115_item:hover{background:var(--tm-bg-item-hover)}.tm115_name{font-weight:600;color:var(--tm-text-primary);margin-bottom:4px;word-break:break-word}.tm115_name .tm115_dup{color:var(--tm-text-muted);font-weight:400;font-size:12px}.tm115_url{word-break:break-all;color:var(--tm-text-muted);font-size:11px;margin-bottom:4px}.tm115_meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tm115_tag{display:inline-block;background:var(--tm-bg-tag-blue);color:var(--tm-tag-blue-text);padding:2px 7px;border-radius:4px;font-size:11px}.tm115_tag_green{background:var(--tm-bg-tag-green);color:var(--tm-tag-green-text)}'
    + '.tm115_row{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:6px}.tm115_status{color:var(--tm-text-secondary);font-size:12px;white-space:nowrap}.tm115_status_ok{color:var(--tm-tag-green-text);font-weight:600}.tm115_status_err{color:#ff6b6b;font-weight:600}.tm115_status_dup{color:#fbbc04;font-weight:600}.tm115_btn2{border:1px solid var(--tm-btn-border);background:var(--tm-btn-bg);color:var(--tm-btn-text);border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px}.tm115_btn2:hover:not(:disabled){filter:brightness(1.15)}.tm115_primary{background:var(--tm-primary);color:var(--tm-primary-text);border-color:var(--tm-primary)}.tm115_btn2:disabled{opacity:.55;cursor:not-allowed}.tm115_empty{padding:28px 14px;text-align:center;color:var(--tm-text-dim)}'
    + '.tm115_close,.tm115_theme_btn,.tm115_open115{border:0;background:transparent;font-size:18px;cursor:pointer;line-height:1;padding:2px 4px;border-radius:4px;color:var(--tm-close-color);text-decoration:none}.tm115_close:hover,.tm115_theme_btn:hover,.tm115_open115:hover{color:var(--tm-close-hover);background:var(--tm-bg-item-hover)}.tm115_open115{font-size:16px}.tm115_info{font-size:12px;color:var(--tm-text-muted)}'
    + '.tm115_cmenu{position:fixed;z-index:2147483647;background:var(--tm-bg-panel);border:1px solid var(--tm-border);border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,.3);padding:4px 0;min-width:190px;max-width:min(520px,calc(100vw - 30px));font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.tm115_cmenu_item{display:block;width:100%;padding:7px 14px;border:0;background:transparent;color:var(--tm-text-primary);text-align:left;cursor:pointer;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm115_cmenu_item:hover{background:var(--tm-bg-item-hover)}.tm115_cmenu_sep{height:1px;background:var(--tm-border-light);margin:3px 0}'
    + '.tm115_toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483648;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.3);animation:tm115_fadeIn .3s ease;pointer-events:none;white-space:nowrap}.tm115_toast_ok{background:#137333}.tm115_toast_err{background:#c5221f}@keyframes tm115_fadeIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'
  );

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function formatSize(bytes) { if (!bytes || bytes <= 0) return ''; var units=['B','KB','MB','GB','TB'], i=0, v=Number(bytes); while (v>=1024 && i<units.length-1) { v/=1024; i++; } return v.toFixed(i===0?0:1)+' '+units[i]; }
  function showToast(msg, isErr) { var t=document.createElement('div'); t.className='tm115_toast '+(isErr?'tm115_toast_err':'tm115_toast_ok'); t.textContent=msg; document.body.appendChild(t); setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },300); },2000); }
  function setStatus(text, isErr) { var el=document.getElementById('tm115_global_status'); if(el)el.textContent=text||''; if(text && (text.indexOf('成功')!==-1 || text.indexOf('已存在')!==-1)) showToast(text,false); if(isErr || (text && /失败|超时|无法|无效|验证码/.test(text))) showToast(text,true); }

  function base32ToHex(s) {
    s = String(s || '').toUpperCase().replace(/=+$/,'');
    if (!/^[A-Z2-7]{32}$/.test(s)) return '';
    var bits = '', hex = '';
    for (var i=0;i<s.length;i++) { var v=BASE32.indexOf(s[i]); if(v<0)return''; bits += v.toString(2).padStart(5,'0'); }
    for (var j=0;j+4<=bits.length;j+=4) hex += parseInt(bits.substr(j,4),2).toString(16);
    return hex.length >= 40 ? hex.substr(0,40).toLowerCase() : '';
  }
  function normalizeHash(h) {
    h = String(h || '').trim();
    if (/^[a-f0-9]{40}$/i.test(h)) return h.toLowerCase();
    if (/^[A-Z2-7]{32}$/i.test(h)) return base32ToHex(h);
    return '';
  }
  function cleanupName(name) {
    name = String(name || '').replace(/\s+/g,' ').trim();
    name = name.replace(/^(磁力链接|磁力|下载|复制|详情|查看|资源名称|名称)[:：\s-]*/i,'');
    name = name.replace(/(磁力链接|磁力下载|复制链接|立即下载|点击下载|下载地址|详情|在线观看)$/i,'').trim();
    name = name.replace(/^[-_\s|]+|[-_\s|]+$/g,'').trim();
    if (/^magnet:/i.test(name) || /^https?:\/\//i.test(name)) return '';
    return name.length > 220 ? name.substr(0,220) : name;
  }
  function buildSafeMagnet(hash, name, size) {
    var m = 'magnet:?xt=urn:btih:' + hash;
    name = cleanupName(name);
    if (name) m += '&dn=' + encodeURIComponent(name);
    if (size) m += '&xl=' + size;
    return m;
  }
  function parseMagnet(rawUrl) {
    if (!rawUrl) return null;
    var url = String(rawUrl).replace(/&amp;/g,'&').trim();
    try { if (/magnet%3A%3F/i.test(url) || /^magnet%3A/i.test(url)) url = decodeURIComponent(url); } catch (_) {}
    url = url.replace(/[\s\)\]\}\>,，。；;"'`]+$/g,'').replace(/(?:\.{3}|…)+$/g,'');
    var m = url.match(/magnet:\?xt=urn:btih:([a-z0-9]{32,40})([^\s<>"'\uFF0C\u3002\uFF1B\u3001]*)/i);
    if (!m) return null;
    var hash = normalizeHash(m[1]);
    if (!hash) return null;
    var rest = m[2] || '', name = '', size = 0;
    var dnMatch = rest.match(/[&;]dn=([^&;\s"'>]+)/i);
    if (dnMatch) { try { name = decodeURIComponent(dnMatch[1].replace(/\+/g,'%20')); } catch (_) { name = dnMatch[1]; } }
    var xlMatch = rest.match(/[&;]xl=(\d+)/i);
    if (xlMatch) size = parseInt(xlMatch[1],10) || 0;
    name = cleanupName(name);
    return { hash: hash, magnet: buildSafeMagnet(hash, name, size), name: name, size: size };
  }
  function collectMagnetsFromText(text) {
    var out = [], seen = {}, re = /magnet:\?xt=urn:btih:[a-z0-9]{32,40}(?:[^\s<>"'`\uFF0C\u3002\uFF1B\u3001]*)/ig, m;
    while ((m = re.exec(text || '')) !== null) { var p = parseMagnet(m[0]); if (p && !seen[p.hash]) { seen[p.hash] = 1; out.push(p); } }
    return out;
  }
  function collectUrlsFromText(text) {
    var out = [], seen = {}, re = /https?:\/\/[^\s<>"'`\uFF0C\u3002\uFF1B\u3001]{10,}/ig, m;
    while ((m = re.exec(text || '')) !== null) { var u = m[0].replace(/[\)\]\}\>,，。；;"'`]+$/g,'').replace(/(?:\.{3}|…)+$/g,''); if (!seen[u]) { seen[u]=1; out.push(u); } }
    return out;
  }
  function safeBodyText(limit) {
    if (!document.body) return '';
    var skip = {SCRIPT:1,STYLE:1,NOSCRIPT:1,VIDEO:1,AUDIO:1,CANVAS:1,SVG:1,IFRAME:1};
    var out = '', max = limit || 300000;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n) {
        var p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (skip[p.tagName]) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('#tm115_btn,#tm115_panel,.tm115_cmenu,.tm115_toast')) return NodeFilter.FILTER_REJECT;
        var v = n.nodeValue;
        if (!v || v.indexOf('magnet:') === -1 && v.indexOf('magnet%3A') === -1) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      out += '\n' + node.nodeValue;
      if (out.length > max) break;
    }
    return out;
  }
  function isUnsafeScanPage() {
    var host = location.hostname || '';
    return /(^|\.)(douyin\.com|tiktok\.com|youtube\.com|bilibili\.com|kuaishou\.com|twitch\.tv|netflix\.com)$/i.test(host);
  }
  function scheduleInitialScan() {
    var run = function(){
      try { extractMagnets({initial:true}); }
      catch(e) { console.warn('[tm115] initial scan skipped:', e); }
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, {timeout: 3000});
    else setTimeout(run, 1200);
  }  function extractCandidateNames(text, maxLen) {
    text = String(text || '');
    var names = [], patterns = [
      /([^\s<>"':*?|/\\]{4,}\.(?:mp4|mkv|avi|mov|wmv|flv|rmvb|ts|m2ts|iso|rar|zip|7z|torrent|txt|pdf|epub|mobi|ass|srt|sub|idx|m4v|webm))(?:[\s\n\r,，。；;]|$)/gi,
      /《([^》]{2,100})》/g,
      /([^\s<>"':*?|/\\]{2,}\.(?:S\d{1,2}E\d{1,2}|EP?\d{1,3})[^\s<>"':*?|/\\]*)/gi,
      /([^\s<>"':*?|/\\]{2,}\.(?:19|20)\d{2}[^\s<>"':*?|/\\]{0,80})/gi
    ];
    patterns.forEach(function (p) { p.lastIndex=0; var m; while((m=p.exec(text))!==null){ var c=cleanupName(m[1]||m[0]); if(c && c.length>=3 && c.length <= (maxLen||220)) names.push(c); } });
    return Array.from(new Set(names));
  }
  function findContextName(anchorEl, magnetInfo) {
    if (magnetInfo && magnetInfo.name) return magnetInfo.name;
    if (!anchorEl) return '';
    var attrs = ['title','aria-label','data-title','data-name'];
    for (var a=0;a<attrs.length;a++) { var av = cleanupName(anchorEl.getAttribute(attrs[a]) || ''); if (av) return av; }
    var lt = cleanupName(anchorEl.textContent || '');
    if (lt && lt.length <= 220) return lt;
    var parent = anchorEl.parentElement, depth = 0;
    while (parent && depth < 6) {
      for (var s=0;s<TITLE_SELECTORS.length;s++) {
        try { var te = parent.matches(TITLE_SELECTORS[s]) ? parent : parent.querySelector(TITLE_SELECTORS[s]); var tv = te ? cleanupName(te.textContent || '') : ''; if(tv && tv.length <= 220) return tv; } catch (_) {}
      }
      var names = extractCandidateNames(parent.textContent || '', 220);
      if (names.length) return names[0];
      parent = parent.parentElement; depth++;
    }
    return '';
  }
  function qualityTags(name) {
    var t = [], s = String(name || '');
    ['2160p','1080p','720p','BluRay','WEB-DL','WEBRip','HDRip','HEVC','x265','x264','DV','HDR','中字','中文字幕'].forEach(function(k){ if(new RegExp(k,'i').test(s)) t.push(k); });
    return Array.from(new Set(t));
  }

  function request(method, url, data) {
    return new Promise(function(resolve, reject) {
      GM_xmlhttpRequest({
        method: method, url: url, data: data,
        headers: data ? {'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Accept':'application/json, text/javascript, */*; q=0.01','Origin':'https://115.com','X-Requested-With':'XMLHttpRequest'} : {'Accept':'application/json, text/javascript, */*; q=0.01'},
        timeout: 20000,
        onload: function(res){ try { resolve(JSON.parse(res.responseText)); } catch(e) { reject(new Error('115返回内容无法解析，可能未登录或接口变更')); } },
        onerror: function(){ reject(new Error('请求115失败')); },
        ontimeout: function(){ reject(new Error('请求115超时')); }
      });
    });
  }
  async function get115Auth() {
    var sign = await request('GET', API.sign);
    if (!sign || !sign.state || !sign.sign || !sign.time) throw new Error('获取115签名失败，请确认已经登录115');
    var path = await request('GET', API.downPath);
    var first = path && path.state && path.data && path.data[0] ? path.data[0] : {};
    var uid = first.user_id || '', defaultCid = first.file_id || '';
    if (!uid) throw new Error('获取115用户信息失败，请确认已经登录115');
    return { sign: sign.sign, time: sign.time, uid: uid, wpPathId: state.saveCid || defaultCid || '' };
  }
  function classifyError(msg) {
    msg = String(msg || '');
    if (/已存在|存在|重复|任务已存在|already|exist|duplicate/i.test(msg)) return 'exists';
    if (/验证码|911|验证/.test(msg)) return 'verify';
    if (/无效|错误|invalid/i.test(msg)) return 'invalid';
    return 'error';
  }
  async function addTo115(urls) {
    if (!urls.length) return { state:true };
    var auth = await get115Auth();
    var sp = new URLSearchParams();
    sp.set('savepath',''); sp.set('wp_path_id',auth.wpPathId); sp.set('uid',auth.uid); sp.set('sign',auth.sign); sp.set('time',auth.time);
    if (urls.length === 1) sp.set('url', urls[0]); else urls.forEach(function(url,i){ sp.set('url['+i+']', url); });
    var result = await request('POST', urls.length === 1 ? API.addOne : API.addMany, sp.toString());
    if (result && result.state) return result;
    var msg = result && (result.error_msg || result.error || result.message) || '添加到115失败';
    if (result && result.errcode === 911) msg = '115要求验证码。请先打开115离线任务页面完成验证后再试';
    var err = new Error(msg); err.kind = classifyError(msg); throw err;
  }

  function addRawItem(rawItems, parsed, name, sourceLabel) {
    if (!parsed || !parsed.hash) return;
    name = cleanupName(name || parsed.name || '');
    rawItems.push({ hash: parsed.hash, magnet: buildSafeMagnet(parsed.hash, name || parsed.name, parsed.size), name: name || parsed.name || '', size: parsed.size || 0, sourceLabel: cleanupName(sourceLabel || name) || document.title || location.hostname, count: 1, storedStatus: getHashStatus(parsed.hash) });
  }
  function extractMagnets(opts) { opts = opts || {}; if (opts.initial && isUnsafeScanPage()) return;
    var rawItems = [];
    Array.prototype.slice.call(document.querySelectorAll('a[href]'),0,2500).forEach(function(a) {
      if (a.closest && a.closest('#tm115_panel,.tm115_cmenu')) return;
      var href = a.href || a.getAttribute('href') || '';
      var parsed = parseMagnet(href);
      if (parsed) addRawItem(rawItems, parsed, findContextName(a, parsed), a.textContent || a.getAttribute('title') || '');
    });
    if (document.body) {
      var bodyText = safeBodyText(300000);
      var textMagnets = collectMagnetsFromText(bodyText), existing = new Set(rawItems.map(function(it){ return it.hash; }));
      textMagnets.forEach(function(parsed) {
        if (existing.has(parsed.hash)) return;
        var idx = bodyText.indexOf(parsed.magnet), context = idx >= 0 ? bodyText.substring(Math.max(0, idx-260), Math.min(bodyText.length, idx+parsed.magnet.length+260)) : bodyText;
        var names = extractCandidateNames(context, 220);
        addRawItem(rawItems, parsed, names[0] || parsed.name, names[0] || parsed.name || '');
      });
    }
    var merged = new Map();
    rawItems.forEach(function(item) {
      var ex = merged.get(item.hash);
      if (ex) {
        ex.count++;
        if (item.name && (!ex.name || item.name.length > ex.name.length)) ex.name = item.name;
        if (item.size > ex.size) ex.size = item.size;
        if (item.sourceLabel && ex.sourceLabel.indexOf(item.sourceLabel) === -1 && ex.sourceLabel.length < 120) ex.sourceLabel += ' | ' + item.sourceLabel;
        ex.magnet = buildSafeMagnet(ex.hash, ex.name, ex.size);
      } else merged.set(item.hash, item);
    });
    state.items = Array.from(merged.values()).sort(function(a,b){
      var sa = getHashStatus(a.hash), sb = getHashStatus(b.hash);
      if (!!sa !== !!sb) return sa ? 1 : -1;
      if (a.name && !b.name) return -1; if (!a.name && b.name) return 1;
      return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });
    updateButton();
  }

  function updateButton() {
    var btn = document.getElementById('tm115_btn');
    if (!btn) { btn = document.createElement('button'); btn.id = 'tm115_btn'; btn.onclick = togglePanel; document.documentElement.appendChild(btn); }
    var total = state.items.length, done = state.items.filter(function(i){ return !!getHashStatus(i.hash); }).length;
    btn.textContent = done ? '磁力 ' + total + '｜已 ' + done : '磁力 ' + total;
    btn.style.display = total ? 'block' : 'none';
    if (state.panelOpen) renderPanel();
  }
  function renderPanel() {
    var panel = document.getElementById('tm115_panel');
    if (!panel) { panel = document.createElement('div'); panel.id = 'tm115_panel'; document.documentElement.appendChild(panel); }
    applyTheme();
    var filter = state.filterText.toLowerCase();
    var filtered = filter ? state.items.filter(function(it){ return (it.name + ' ' + it.hash + ' ' + it.sourceLabel + ' ' + it.magnet).toLowerCase().indexOf(filter) !== -1; }) : state.items;
    var itemsHtml = filtered.map(function(item, i) {
      var st = getHashStatus(item.hash), tags = qualityTags(item.name).map(function(t){ return '<span class="tm115_tag">'+escapeHtml(t)+'</span>'; }).join('');
      var dup = item.count > 1 ? ' <span class="tm115_dup">('+item.count+'条重复)</span>' : '';
      var source = item.sourceLabel && item.sourceLabel !== item.name ? '<span class="tm115_tag">'+escapeHtml(item.sourceLabel.substring(0,60))+'</span>' : '';
      var size = item.size ? '<span class="tm115_tag tm115_tag_green">'+formatSize(item.size)+'</span>' : '';
      return '<div class="tm115_item"><div class="tm115_name">'+escapeHtml(item.name || '[未识别名称]')+dup+'</div><div class="tm115_meta">'+source+tags+size+'<span class="tm115_info">'+escapeHtml(item.hash.substring(0,12))+'…</span></div><div class="tm115_url">'+escapeHtml(item.magnet)+'</div><div class="tm115_row"><span class="tm115_status '+statusClass(st)+'" id="tm115_status_'+i+'">'+escapeHtml(statusText(st))+'</span><span><button class="tm115_btn2" data-copy="'+i+'">复制</button><button class="tm115_btn2 tm115_primary" data-add="'+i+'">添加到115</button></span></div></div>';
    }).join('');
    var totalInfo = filter ? ' (筛选自 '+state.items.length+' 条，显示 '+filtered.length+' 条)' : '';
    panel.innerHTML = '<div class="tm115_head"><div class="tm115_title">识别到 '+state.items.length+' 个磁力链接'+totalInfo+'</div><div class="tm115_filter"><input id="tm115_filter_input" type="text" placeholder="筛选名称/hash/来源…" value="'+escapeHtml(state.filterText)+'" /></div><div class="tm115_head_right"><button class="tm115_theme_btn" id="tm115_theme_toggle" title="主题: '+themeLabel()+' (点击切换)">'+themeIcon()+'</button><a class="tm115_open115" title="打开115云下载" href="https://115.com/?cid=0&amp;offset=0&amp;tab=download&amp;mode=wangpan" target="_blank">&#x1F4C2;</a><button class="tm115_close" id="tm115_close">×</button></div></div><div class="tm115_actions"><button class="tm115_btn2 tm115_primary" id="tm115_add_all">全部添加到115</button><button class="tm115_btn2 tm115_primary" id="tm115_add_visible" style="display:'+(filter?'':'none')+'">添加筛选结果</button><button class="tm115_btn2" id="tm115_refresh">重新扫描</button><button class="tm115_btn2" id="tm115_set_cid">保存目录CID</button><button class="tm115_btn2" id="tm115_clear_filter" style="display:'+(filter?'':'none')+'">清除筛选</button><span class="tm115_status" id="tm115_global_status"></span></div><div class="tm115_list">'+(filtered.length ? itemsHtml : '<div class="tm115_empty">'+(state.items.length?'无匹配结果':'没有识别到磁力链接')+'</div>')+'</div>';
    panel.querySelector('#tm115_close').onclick = closePanel;
    panel.querySelector('#tm115_theme_toggle').onclick = function(){ cycleTheme(); setStatus('已切换为'+themeLabel()+'模式'); };
    panel.querySelector('#tm115_refresh').onclick = function(){ extractMagnets(); setStatus('已重新扫描'); };
    panel.querySelector('#tm115_set_cid').onclick = function(){ var cid=prompt('输入115保存目录CID。留空则使用115默认云下载目录。', state.saveCid); if(cid===null)return; if(cid&&!/^\d+$/.test(cid)){ setStatus('CID只能是数字', true); return; } state.saveCid=cid; localStorage.setItem(SAVE_CID_KEY,cid); setStatus(cid?'保存目录已设为 '+cid:'已恢复默认保存目录'); };
    panel.querySelector('#tm115_add_all').onclick = async function(){ await runAdd(state.items.map(function(it){return it.magnet;}), '批量'); };
    var avb = panel.querySelector('#tm115_add_visible'); if (avb) avb.onclick = async function(){ await runAdd(filtered.map(function(it){return it.magnet;}), '筛选结果'); };
    var cfb = panel.querySelector('#tm115_clear_filter'); if (cfb) cfb.onclick = function(){ state.filterText=''; renderPanel(); };
    var fi = panel.querySelector('#tm115_filter_input'); if (fi) fi.oninput = function(){ state.filterText=fi.value; renderPanel(); };
    panel.querySelectorAll('[data-copy]').forEach(function(btn){ btn.onclick=function(){ GM_setClipboard(filtered[Number(btn.dataset.copy)].magnet); setStatus('已复制'); }; });
    panel.querySelectorAll('[data-add]').forEach(function(btn){ btn.onclick=async function(){ var idx=Number(btn.dataset.add), item=filtered[idx], orig=state.items.findIndex(function(it){return it.hash===item.hash;}); await runAdd([item.magnet], '单个', orig>=0?orig:idx); }; });
  }
  async function runAdd(urls, label, statusIndex) {
    if (state.busy) return;
    state.busy = true;
    setStatus(label + '添加中…');
    function rowStatus(text, cls) { if (typeof statusIndex === 'number') { var rs=document.getElementById('tm115_status_'+statusIndex); if(rs){ rs.textContent=text; rs.className='tm115_status '+(cls||''); } } }
    try {
      await addTo115(urls);
      urls.forEach(function(u){ var p=parseMagnet(u); if(p)setHashStatus(p.hash,'added','已添加'); });
      rowStatus('已添加','tm115_status_ok'); setStatus(label+'添加成功'); renderPanel();
    } catch(e) {
      var msg=(e&&e.message)||'添加失败', kind=e.kind || classifyError(msg);
      urls.forEach(function(u){ var p=parseMagnet(u); if(p)setHashStatus(p.hash, kind==='exists'?'exists':kind, kind==='exists'?'已存在':msg); });
      if (kind === 'exists') { rowStatus('已存在','tm115_status_dup'); setStatus(label+'：已存在'); }
      else { rowStatus(msg.length>18?msg.substring(0,18)+'…':msg,'tm115_status_err'); setStatus(msg, true); }
      renderPanel(); console.warn('115 add failed:', e);
    } finally { state.busy = false; }
  }

  function togglePanel(){ state.panelOpen ? closePanel() : openPanel(); }
  function openPanel(){ state.panelOpen = true; renderPanel(); }
  function closePanel(){ state.panelOpen = false; var p=document.getElementById('tm115_panel'); if(p)p.remove(); }

  var ctxMenu = null;
  function hideCtxMenu(){ if(ctxMenu){ ctxMenu.remove(); ctxMenu=null; } }
  document.addEventListener('click', hideCtxMenu);
  function collectContextTargets(e) {
    var texts = [];
    var sel = window.getSelection(); var st = sel ? String(sel).trim() : '';
    if (st) texts.push(st);
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a) texts.push(a.href || '', a.getAttribute('href') || '', a.textContent || '', a.title || '');
    var node = e.target;
    var depth = 0;
    while (node && node !== document.body && depth < 4) { texts.push(node.textContent || ''); node = node.parentElement; depth++; }
    var magnets = [], urls = [], seenM = {}, seenU = {};
    texts.forEach(function(t){ collectMagnetsFromText(t).forEach(function(p){ if(!seenM[p.hash]){ seenM[p.hash]=1; magnets.push(p); } }); collectUrlsFromText(t).forEach(function(u){ if(!seenU[u]){ seenU[u]=1; urls.push(u); } }); });
    return { magnets: magnets, urls: urls };
  }
  document.addEventListener('contextmenu', function(e){
    hideCtxMenu();
    var found = collectContextTargets(e);
    if (!found.magnets.length && !found.urls.length) return;
    e.preventDefault();
    ctxMenu = document.createElement('div'); ctxMenu.className='tm115_cmenu'; ctxMenu.style.left=Math.min(e.clientX, window.innerWidth-210)+'px'; ctxMenu.style.top=Math.min(e.clientY, window.innerHeight-240)+'px';
    var html = '';
    found.magnets.forEach(function(p,i){ var label=(p.name || p.magnet); if(label.length>68)label=label.substring(0,65)+'...'; var st=getHashStatus(p.hash); html += '<button class="tm115_cmenu_item" data-magnet="'+i+'">'+(st?'已处理: ':'添加: ')+escapeHtml(label)+'</button>'; });
    found.urls.forEach(function(u,i){ var label=u.length>68?u.substring(0,65)+'...':u; html += '<button class="tm115_cmenu_item" data-url="'+i+'">添加链接: '+escapeHtml(label)+'</button>'; });
    if (found.magnets.length + found.urls.length > 1) html += '<div class="tm115_cmenu_sep"></div><button class="tm115_cmenu_item" id="tm115_cmenu_all" style="color:var(--tm-primary);font-weight:600">全部添加 ('+(found.magnets.length+found.urls.length)+'条)</button>';
    ctxMenu.innerHTML = html; document.body.appendChild(ctxMenu);
    ctxMenu.querySelectorAll('[data-magnet]').forEach(function(b){ b.onclick=async function(){ await runAdd([found.magnets[Number(b.dataset.magnet)].magnet], '右键添加'); hideCtxMenu(); }; });
    ctxMenu.querySelectorAll('[data-url]').forEach(function(b){ b.onclick=async function(){ await runAdd([found.urls[Number(b.dataset.url)]], '右键添加'); hideCtxMenu(); }; });
    var allBtn = ctxMenu.querySelector('#tm115_cmenu_all'); if(allBtn)allBtn.onclick=async function(){ await runAdd(found.magnets.map(function(p){return p.magnet;}).concat(found.urls), '右键批量'); hideCtxMenu(); };
  });

  // 克制启动：不常驻 MutationObserver，不持续扫描 DOM。
  // 只在页面空闲后做一次轻量扫描；动态内容请用面板“重新扫描”或右键附近查找。
  scheduleInitialScan();
})();