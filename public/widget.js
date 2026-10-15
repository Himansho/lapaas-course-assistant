/*!
 * Lapaas course assistant: embeddable "Is this course right for me?" chat widget.
 * Prototype by Himanshu Bartwal for the Lapaas internship assignment.
 * Not an official Lapaas product.
 *
 * Embed:  <script src="https://<app>.vercel.app/widget.js" defer></script>
 * Options (data attributes on the script tag):
 *   data-position="right|left"   launcher position (default right)
 *   data-open="true"             open on page load
 *   data-mode="inline"           render inside data-target instead of floating
 *   data-target="#selector"      container for inline mode
 *   data-label="..."             launcher text
 *   data-theme="dark|light"      starting theme if the page has none (default dark)
 * API:  window.LapaasAssistant.open() / .close() / .toggle() / .restart()
 * Theme: set CSS custom properties on the page, e.g. --lca-accent, --lca-font.
 */
(function () {
  'use strict';
  if (window.LapaasAssistant) return;

  var script = document.currentScript || document.querySelector('script[src*="widget.js"]');
  var base = new URL('.', (script && script.src) || window.location.href).href;
  var API = base + 'api/chat';
  var EVENT_API = base + 'api/event';
  var opt = (script && script.dataset) || {};
  var INLINE = opt.mode === 'inline';
  var POSITION = opt.position === 'left' ? 'left' : 'right';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var FALLBACK_LINKS = {
    course: 'https://cohort.lapaas.com/?utm_source=course_assistant&utm_medium=chat&utm_campaign=fit_check',
    whatsapp: 'https://wa.me/919540065704',
  };
  var MAX_LEN = 400;

  // Calm, neutral chat UI. One accent green (lime) for primary actions; a deeper
  // green for the visitor's own messages so white text stays readable.
  var CSS = [
    ':host{all:initial;--_text:var(--lca-ink,#1f1f1c);--_soft:#5c5d57;--_bg:#ffffff;--_bot:#f2f2ee;--_line:#e4e4dc;',
    '--_accent:var(--lca-accent,#b9f24b);--_accent-hover:#a6e035;--_accent-ink:#11110f;--_user:var(--lca-user,#3a7413);',
    '--_focus:#2f6fed;--_warn:#8f2b21;--_ok:#3a5a10;',
    '--_font:var(--lca-font,Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif);',
    'font-family:var(--_font);color:var(--_text);font-size:15px;line-height:1.5}',
    '*{box-sizing:border-box}',
    'button{font:inherit;color:inherit;cursor:pointer}',
    'a{color:inherit}',
    ':focus-visible{outline:3px solid var(--_focus);outline-offset:2px;border-radius:8px}',
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '@keyframes lca-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '@keyframes lca-dot{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}',
    /* Launcher */
    '.launcher{position:fixed;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:10px;min-height:52px;padding:0 20px 0 16px;',
    'border:0;border-radius:999px;background:var(--_accent);color:var(--_accent-ink);font-weight:600;font-size:15px;',
    'box-shadow:0 8px 24px rgba(17,17,15,.18);transition:background .15s ease,box-shadow .15s ease}',
    '.launcher:hover{background:var(--_accent-hover);box-shadow:0 0 0 4px rgba(185,242,75,.35),0 8px 24px rgba(17,17,15,.18)}',
    '.launcher svg{width:20px;height:20px}',
    '.launcher.right{right:20px}.launcher.left{left:20px}',
    '.launcher[hidden]{display:none}',
    /* Panel */
    '.panel{position:fixed;bottom:20px;z-index:2147483001;width:min(400px,calc(100vw - 32px));height:min(680px,calc(100vh - 40px));',
    'display:flex;flex-direction:column;background:var(--_bg);border:1px solid var(--_line);border-radius:16px;overflow:hidden;',
    'box-shadow:0 24px 64px rgba(17,17,15,.18)}',
    '.panel.right{right:20px}.panel.left{left:20px}',
    '.panel[hidden]{display:none}',
    '.panel.inline{position:relative;inset:auto;width:100%;height:100%;max-width:none;box-shadow:none;z-index:auto}',
    '@media (max-width:520px){.panel:not(.inline){inset:0;width:100%;height:100%;height:100dvh;border-radius:0;border:0}}',
    /* Header */
    '.head{display:flex;align-items:center;gap:10px;padding:10px 8px 10px 14px;border-bottom:1px solid var(--_line)}',
    '.avatar{width:32px;height:32px;flex:none;border-radius:50%;background:var(--_accent);color:var(--_accent-ink);display:grid;place-items:center;font-weight:700;font-size:15px}',
    '.avatar.sm{width:26px;height:26px;font-size:13px;align-self:flex-end}',
    '.head .name{flex:1;min-width:0;font-weight:600;font-size:15px;display:flex;align-items:center;gap:8px;white-space:nowrap}',
    '.head .name .nm{overflow:hidden;text-overflow:ellipsis}',
    '@media (max-width:420px){.hbtn .lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}',
    '.panel:not(.inline) .hbtn .lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
    '.tag-proto{font-weight:500;font-size:11px;color:var(--_soft);border:1px solid var(--_line);border-radius:999px;padding:1px 8px}',
    '.hbtn{border:0;background:transparent;min-width:44px;height:44px;padding:0 10px;border-radius:10px;color:var(--_soft);font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:6px}',
    '.hbtn:hover{background:var(--_bot);color:var(--_text)}',
    '.hbtn svg{width:18px;height:18px}',
    /* Messages */
    '.log{flex:1;overflow-y:auto;padding:18px 14px 10px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain;scroll-behavior:smooth}',
    '.log>*{flex-shrink:0;animation:lca-in .25s ease both}',
    '.row{display:flex;gap:8px;align-items:flex-end;max-width:100%}',
    '.row.user{justify-content:flex-end}',
    '.bubble{max-width:82%;padding:10px 14px;border-radius:18px;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.row.bot .bubble{background:var(--_bot);border-bottom-left-radius:6px}',
    '.row.user .bubble{background:var(--_user);color:#fff;border-bottom-right-radius:6px}',
    '.step{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--_soft);margin-bottom:4px}',
    '.bar{width:72px;height:4px;border-radius:4px;background:#e2e2da;overflow:hidden}',
    '.bar i{display:block;height:100%;background:var(--_user);transition:width .3s ease}',
    '.under{margin:4px 0 0 34px;display:flex;flex-direction:column;align-items:flex-start;gap:8px}',
    '.src{font-size:12px;color:var(--_soft)}',
    '.src.warn{color:var(--_warn)}',
    '.simple{font-size:13px;color:var(--_soft);max-width:82%}',
    '.simple summary{cursor:pointer;text-decoration:underline;text-underline-offset:3px;min-height:28px;display:inline-flex;align-items:center}',
    '.simple summary::-webkit-details-marker{display:none}',
    '.simple dl{margin:6px 0 0}.simple dt{font-weight:600;color:var(--_text)}.simple dd{margin:0 0 6px}',
    '.simple small{display:block;font-size:11.5px}',
    /* Option buttons (the 5 questions) */
    '.options{display:flex;flex-direction:column;gap:8px;margin-left:34px;max-width:calc(100% - 34px)}',
    '.opt{min-height:44px;padding:10px 14px;border:1px solid #cfcfc6;border-radius:12px;background:#fff;text-align:left;font-size:15px;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease}',
    '.opt:not([disabled]):hover{border-color:var(--_text);box-shadow:0 0 0 3px rgba(185,242,75,.45)}',
    '.opt[disabled]{cursor:default;opacity:.45}',
    '.opt.selected,.opt.selected[disabled]{opacity:1;background:var(--_accent);border-color:var(--_accent);color:var(--_accent-ink);font-weight:600}',
    '.opt.selected::before{content:"✓ "}',
    /* Chips (starters and follow-ups) */
    '.chips{display:flex;flex-wrap:wrap;gap:8px;margin-left:34px}',
    '.chips-label{font-size:12px;color:var(--_soft);margin:2px 0 -4px 34px}',
    '.chip{min-height:40px;padding:8px 14px;border:1px solid #cfcfc6;border-radius:999px;background:#fff;font-size:14px;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease}',
    '.chip:hover{border-color:var(--_text);box-shadow:0 0 0 3px rgba(185,242,75,.45)}',
    '.chip.main{background:var(--_accent);border-color:var(--_accent);color:var(--_accent-ink);font-weight:600}',
    '.chip.main:hover{background:var(--_accent-hover)}',
    '.chip[disabled]{opacity:.45;cursor:default;box-shadow:none}',
    /* Result card */
    '.card{margin-left:34px;border:1px solid var(--_line);border-radius:16px;padding:16px;background:#fff}',
    '.card:focus{outline:none}',
    '.verdict{font-weight:700;font-size:17px;line-height:1.3;margin:0 0 10px}',
    '.card ul{margin:0 0 12px;padding:0;list-style:none}',
    '.card li{padding:6px 0;border-top:1px solid var(--_line)}',
    '.card li:first-child{border-top:0}',
    '.card li details summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:8px;align-items:center;min-height:32px;font-weight:500}',
    '.card li details summary::-webkit-details-marker{display:none}',
    '.card li details summary::after{content:"+";color:var(--_soft);font-weight:400;font-size:18px}',
    '.card li details[open] summary::after{content:"−"}',
    '.card li p{margin:4px 0 6px;font-size:14px;color:var(--_soft)}',
    '.card li.caution summary span::before{content:"Plan for this: ";color:var(--_warn);font-weight:600}',
    '.actions{display:flex;flex-direction:column;gap:8px;margin-top:4px}',
    '.btn{display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:12px;font-weight:600;font-size:14.5px;text-decoration:none;text-align:center;transition:background .15s ease,box-shadow .15s ease}',
    '.btn.primary{background:var(--_accent);color:var(--_accent-ink)}',
    '.btn.primary:hover{background:var(--_accent-hover);box-shadow:0 0 0 3px rgba(185,242,75,.4)}',
    '.btn.secondary{border:1px solid #cfcfc6;color:var(--_text);background:#fff}',
    '.btn.secondary:hover{border-color:var(--_text);background:var(--_bot)}',
    '.btn:active{transform:translateY(1px)}',
    /* Typing */
    '.typing{display:inline-flex;gap:4px;padding:4px 2px}',
    '.typing i{width:7px;height:7px;border-radius:50%;background:var(--_soft);animation:lca-dot 1s infinite ease-in-out}',
    '.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}',
    /* Composer */
    '.compose{display:flex;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid var(--_line);background:#fff}',
    '.compose label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
    '.compose input{flex:1;min-width:0;min-height:44px;border:1px solid #cfcfc6;border-radius:22px;padding:0 16px;font:inherit;color:var(--_text);background:#fff}',
    '.compose input:focus{outline:none;border-color:var(--_text);box-shadow:0 0 0 3px rgba(47,111,237,.25)}',
    '.send{flex:none;width:44px;height:44px;border:0;border-radius:50%;background:var(--_accent);color:var(--_accent-ink);display:grid;place-items:center;transition:background .15s ease}',
    '.send:hover:not([disabled]){background:var(--_accent-hover)}',
    '.send[disabled]{opacity:.5;cursor:default}',
    '.send svg{width:20px;height:20px}',
    '.foot{margin:0;padding:0 14px 10px;font-size:11.5px;color:var(--_soft);background:#fff;padding-bottom:max(10px,env(safe-area-inset-bottom))}',
    '.foot a{text-underline-offset:2px}',
    /* Dark theme (default). Same lime accent; light text on near-black. */
    ':host([data-theme=dark]){--_text:#edede7;--_soft:#a9aaa2;--_bg:#161614;--_bot:#262622;--_line:#30302b;--_focus:#7fa8ff;--_warn:#ff9f8f;color-scheme:dark}',
    ':host([data-theme=dark]) .opt:not(.selected),:host([data-theme=dark]) .chip:not(.main),:host([data-theme=dark]) .card,:host([data-theme=dark]) .btn.secondary,:host([data-theme=dark]) .compose input{background:#1d1d1a;border-color:#3d3d37}',
    ':host([data-theme=dark]) .opt:not([disabled]):not(.selected):hover,:host([data-theme=dark]) .chip:not(.main):not([disabled]):hover,:host([data-theme=dark]) .compose input:focus{border-color:var(--_text)}',
    ':host([data-theme=dark]) .btn.secondary:hover{border-color:var(--_text);background:var(--_bot)}',
    ':host([data-theme=dark]) .compose,:host([data-theme=dark]) .foot{background:var(--_bg)}',
    ':host([data-theme=dark]) .bar{background:#34342e}',
    ':host([data-theme=dark]) .panel{box-shadow:0 24px 64px rgba(0,0,0,.55)}',
    '@media (prefers-reduced-motion:reduce){*,*::before{animation:none!important;transition:none!important}.log{scroll-behavior:auto}}',
  ].join('');

  var ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z"/></svg>';
  var ICON_RESTART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6l.1 6.5L15 12 3.5 13.9z"/></svg>';
  var ICON_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  var ICON_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';

  // ---------- state ----------
  var state;
  function freshState() {
    return {
      config: state && state.config,
      phase: 'welcome', // welcome | intake | chat
      qIndex: 0,
      profile: {},
      profileSummary: '',
      history: [],
      asked: {},
      suggestions: [],
      lastUnverified: '',
      busy: false,
    };
  }
  state = freshState();

  // ---------- DOM ----------
  var host = document.createElement('div');
  host.id = 'lapaas-course-assistant';
  var root = host.attachShadow({ mode: 'open' });
  var style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'class') node.className = attrs[k];
        else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      }
    }
    (children || []).forEach(function (c) {
      if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function links() {
    return (state.config && state.config.links) || FALLBACK_LINKS;
  }

  function whatsappHref() {
    var text = 'Hi, I have a question about the AI Product Engineering course.';
    if (state.profileSummary) text += '\nAbout me: ' + state.profileSummary;
    if (state.lastUnverified) text += '\nMy question: ' + state.lastUnverified;
    return links().whatsapp + '?text=' + encodeURIComponent(text);
  }

  var launcher = el('button', {
    class: 'launcher ' + POSITION,
    type: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    onclick: function () { open('launcher'); },
  }, [el('span', { html: ICON_CHAT }), el('span', { text: opt.label || 'Is this course right for me?' })]);

  var log = el('div', { class: 'log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
  var input = el('input', { id: 'lca-input', type: 'text', maxlength: String(MAX_LEN), autocomplete: 'off', placeholder: 'Type your question…', enterkeyhint: 'send' });
  var sendBtn = el('button', { class: 'send', type: 'submit', 'aria-label': 'Send', html: ICON_SEND });
  var form = el('form', { class: 'compose', onsubmit: onSubmit }, [el('label', { for: 'lca-input', text: 'Your question' }), input, sendBtn]);
  var courseFootLink = el('a', { href: FALLBACK_LINKS.course, target: '_blank', rel: 'noopener', onclick: function () { track('cta_course', { where: 'footer' }); } }, ['View course ↗']);
  var foot = el('p', { class: 'foot' }, ['Prototype by Himanshu Bartwal, not an official Lapaas page. Please don’t share personal details. ', courseFootLink]);

  var titleId = 'lca-title';
  var restartBtn = el('button', { class: 'hbtn', type: 'button', title: 'Start over', onclick: function () { restart(); } }, [el('span', { html: ICON_RESTART }), el('span', { class: 'lbl', text: 'Start over' })]);
  var themeBtn = el('button', { class: 'hbtn', type: 'button', onclick: function () { setTheme(theme === 'dark' ? 'light' : 'dark', true); } });
  var closeBtn = INLINE ? null : el('button', { class: 'hbtn', type: 'button', 'aria-label': 'Close', html: ICON_CLOSE, onclick: function () { close(); } });
  var head = el('div', { class: 'head' }, [
    el('div', { class: 'avatar', 'aria-hidden': 'true', text: '?' }),
    el('div', { class: 'name', id: titleId }, [el('span', { class: 'nm', text: 'Lapaas course assistant' }), el('span', { class: 'tag-proto', text: 'Prototype' })]),
    restartBtn,
    themeBtn,
    closeBtn,
  ]);

  var panel = el('section', {
    class: 'panel ' + (INLINE ? 'inline' : POSITION),
    role: INLINE ? 'region' : 'dialog',
    'aria-modal': INLINE ? null : 'false',
    'aria-labelledby': titleId,
    hidden: INLINE ? null : true,
  }, [head, log, form, foot]);

  if (!INLINE) root.appendChild(launcher);
  root.appendChild(panel);

  // ---------- theme: dark by default; follows the page's data-theme and remembers the choice ----------
  var THEME_KEY = 'lca-theme';
  function pageTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : null;
  }
  function savedTheme() {
    try { var t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : null; } catch (e) { return null; }
  }
  var theme = pageTheme() || savedTheme() || (opt.theme === 'light' ? 'light' : 'dark');
  function setTheme(t, fromUser) {
    theme = t;
    host.setAttribute('data-theme', t);
    var label = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    themeBtn.setAttribute('aria-label', label);
    themeBtn.title = label;
    themeBtn.innerHTML = t === 'dark' ? ICON_SUN : ICON_MOON;
    if (fromUser) {
      try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* private mode */ }
      if (pageTheme() && pageTheme() !== t) document.documentElement.setAttribute('data-theme', t);
    }
  }
  setTheme(theme);
  if (window.MutationObserver) {
    new MutationObserver(function () {
      var t = pageTheme();
      if (t && t !== theme) setTheme(t);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // ---------- helpers ----------
  function scrollDown() { log.scrollTop = log.scrollHeight; }
  function add(node) { log.appendChild(node); scrollDown(); return node; }

  function track(event, data) {
    try {
      var body = JSON.stringify({ event: event, data: data || {} });
      if (navigator.sendBeacon) navigator.sendBeacon(EVENT_API, new Blob([body], { type: 'text/plain' }));
      else fetch(EVENT_API, { method: 'POST', body: body, keepalive: true, headers: { 'content-type': 'text/plain' } });
    } catch (e) { /* never break the chat */ }
  }

  function api(body) {
    return fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j && j.error ? j.error : 'http_' + r.status);
        return j;
      });
    });
  }

  function loadConfig() {
    if (state.config) return Promise.resolve(state.config);
    return fetch(API).then(function (r) { return r.json(); }).then(function (cfg) {
      state.config = cfg;
      courseFootLink.href = links().course;
      return cfg;
    });
  }

  function setBusy(b) { state.busy = b; sendBtn.disabled = b; }

  function userSays(text) {
    return add(el('div', { class: 'row user' }, [el('div', { class: 'bubble', text: text })]));
  }

  function botRow(children) {
    return add(el('div', { class: 'row bot' }, [el('div', { class: 'avatar sm', 'aria-hidden': 'true', text: '?' }), el('div', { class: 'bubble' }, children)]));
  }

  function typing() {
    return botRow([el('span', { class: 'typing', 'aria-label': 'Assistant is typing', html: '<i></i><i></i><i></i>' })]);
  }

  // Bot text appears word by word (skipped when reduced motion is on).
  // Screen readers get the full text at once via a hidden copy.
  function botSays(text, done) {
    var visible = el('span', { 'aria-hidden': 'true' });
    var row = botRow([el('span', { class: 'sr', text: text }), visible]);
    var words = String(text).split(/(\s+)/);
    if (REDUCED || words.length < 3) {
      visible.textContent = text;
      scrollDown();
      if (done) done(row);
      return row;
    }
    var i = 0;
    var perTick = Math.max(1, Math.ceil(words.length / 60));
    var timer = setInterval(function () {
      i += perTick * 2;
      visible.textContent = words.slice(0, i).join('');
      scrollDown();
      if (i >= words.length) {
        clearInterval(timer);
        visible.textContent = text;
        if (done) done(row);
      }
    }, 28);
    return row;
  }

  // Answered choices leave the chat (the visitor's pick is shown as their own bubble).
  function clearChoices() {
    var nodes = log.querySelectorAll('.chips, .chips-label, .options');
    for (var i = 0; i < nodes.length; i++) nodes[i].parentNode.removeChild(nodes[i]);
  }

  function disableAll(selector) {
    var nodes = log.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) nodes[i].disabled = true;
  }

  function focusFirst(container) {
    var b = container && container.querySelector('button:not([disabled])');
    (b || input).focus({ preventScroll: true });
  }

  function chipRow(chips, onPick, label) {
    if (!chips.length) return null;
    if (label) add(el('div', { class: 'chips-label', text: label }));
    var row = el('div', { class: 'chips', role: 'group' });
    chips.forEach(function (c) {
      row.appendChild(el('button', {
        class: 'chip' + (c.main ? ' main' : ''),
        type: 'button',
        onclick: function () { if (state.busy) return; clearChoices(); onPick(c); },
      }, [c.label]));
    });
    return add(row);
  }

  // ---------- welcome ----------
  var STARTERS = [
    { id: 'start', label: 'Find out if it suits me (5 questions)', main: true },
    { id: 'what-is', label: 'Tell me about the course' },
    { id: 'price-and-emi', label: 'What’s the price?' },
    { id: 'coding-needed', label: 'Do I need coding?' },
  ];

  function welcome() {
    botSays('Hi! I can help you decide if this course fits you. Pick an option or type your question.', function () {
      var row = chipRow(STARTERS, function (c) {
        if (c.id === 'start') {
          userSays('Find out if it suits me');
          track('intake_start');
          state.phase = 'intake';
          askIntake();
        } else {
          if (state.phase === 'welcome') state.phase = 'chat';
          askChip(c);
        }
      });
      if (!INLINE || opt.open === 'true') focusFirst(row);
    });
  }

  // ---------- the 5 questions ----------
  function askIntake() {
    disableAll('.opt');
    var q = state.config.intake[state.qIndex];
    var total = state.config.intake.length;
    var from = Math.round((state.qIndex / total) * 100);
    var to = Math.round(((state.qIndex + 1) / total) * 100);
    var bar = el('span', { class: 'bar', 'aria-hidden': 'true' }, [el('i', { style: 'width:' + from + '%' })]);
    botRow([el('span', { class: 'step' }, ['Question ' + (state.qIndex + 1) + ' of ' + total, bar]), q.question]);
    setTimeout(function () { bar.firstChild.style.width = to + '%'; }, 60);
    var row = el('div', { class: 'options', role: 'group', 'aria-label': q.question });
    q.options.forEach(function (o) {
      row.appendChild(el('button', {
        class: 'opt',
        type: 'button',
        onclick: function (e) {
          if (state.busy) return;
          e.currentTarget.classList.add('selected');
          e.currentTarget.setAttribute('aria-pressed', 'true');
          disableAll('.opt');
          state.profile[q.key] = o.id;
          state.qIndex += 1;
          setTimeout(function () {
            clearChoices();
            userSays(o.label);
            if (state.qIndex < total) askIntake();
            else finishIntake();
          }, REDUCED ? 0 : 220);
        },
      }, [o.label]));
    });
    add(row);
    focusFirst(row);
  }

  function finishIntake() {
    state.phase = 'chat';
    setBusy(true);
    var t = typing();
    api({ type: 'fit', profile: state.profile })
      .then(function (fit) {
        t.remove();
        state.profileSummary = fit.profile_summary || '';
        var card = renderResult(fit);
        track('intake_complete', { verdict: fit.verdict && fit.verdict.level, role: state.profile.role, goal: state.profile.goal });
        state.suggestions = fit.chips || [];
        followUps([]);
        log.scrollTop = card.offsetTop - log.offsetTop - 12;
        card.focus({ preventScroll: true });
      })
      .catch(function () { t.remove(); failMessage(); })
      .then(function () { setBusy(false); });
  }

  function renderResult(fit) {
    var list = el('ul');
    (fit.points || []).forEach(function (p) {
      list.appendChild(el('li', { class: p.kind || 'point' }, [
        el('details', null, [el('summary', null, [el('span', { text: p.title })]), el('p', { text: p.text })]),
      ]));
    });
    var simple = simpleBox(fit.simple);
    var card = el('div', { class: 'card', role: 'group', tabindex: '-1', 'aria-label': 'Your result' }, [
      el('p', { class: 'verdict', text: (fit.verdict && fit.verdict.label) || 'Your result' }),
      list,
      el('p', { class: 'src', text: '✓ From the official course page · tap a point for details' }),
      simple,
      el('div', { class: 'actions' }, [
        el('a', { class: 'btn primary', href: links().course, target: '_blank', rel: 'noopener', onclick: function () { track('cta_course', { where: 'result' }); } }, ['View course & price ↗']),
        el('a', { class: 'btn secondary', href: whatsappHref(), target: '_blank', rel: 'noopener', onclick: function () { track('cta_whatsapp', { where: 'result' }); } }, ['Ask the Lapaas team on WhatsApp ↗']),
      ]),
    ]);
    return add(card);
  }

  // ---------- answers ----------
  function askChip(chip) {
    state.asked[chip.id] = true;
    userSays(chip.label);
    setBusy(true);
    var t = typing();
    track('chip', { id: chip.id });
    api({ type: 'faq', id: chip.id })
      .then(function (ans) { t.remove(); renderAnswer(ans, chip.label, function () { followUps(ans.related || []); setBusy(false); }); })
      .catch(function () { t.remove(); failMessage(); setBusy(false); });
  }

  function askFree(text) {
    userSays(text);
    setBusy(true);
    var t = typing();
    var body = { type: 'ask', message: text, history: state.history.slice(-6) };
    if (Object.keys(state.profile).length) body.profile = state.profile;
    api(body)
      .then(function (ans) {
        t.remove();
        state.history.push({ role: 'user', text: text }, { role: 'assistant', text: ans.answer || '' });
        track('ask', { mode: ans.mode, status: ans.status });
        renderAnswer(ans, text, function () {
          setBusy(false);
          if (state.phase === 'intake') {
            botSays('Let’s continue with your 5 questions.', function () { clearChoices(); askIntake(); });
          } else {
            followUps(ans.related || []);
          }
        });
      })
      .catch(function (err) {
        t.remove();
        failMessage(err && err.message === 'empty_message' ? 'Please type a question first.' : null);
        setBusy(false);
      });
  }

  // Plain meanings for jargon (general meanings, not course facts).
  function simpleBox(terms) {
    if (!terms || !terms.length) return null;
    var dl = el('dl');
    terms.forEach(function (t) {
      dl.appendChild(el('dt', { text: t.term }));
      dl.appendChild(el('dd', { text: t.simple }));
    });
    var label = (state.config && state.config.simple_label) || 'Simple words (general meanings, not from the course page)';
    return el('details', { class: 'simple' }, [el('summary', { text: 'Confusing words? See simple meanings' }), dl, el('small', { text: label })]);
  }

  function renderAnswer(ans, question, done) {
    var unverified = ans.status === 'not_stated' || ans.status === 'not_in_kb';
    if (unverified) state.lastUnverified = String(question).slice(0, 200);
    botSays(ans.answer || '', function () {
      var under = el('div', { class: 'under' });
      if (ans.status !== 'off_topic') {
        under.appendChild(el('span', {
          class: 'src' + (unverified ? ' warn' : ''),
          text: unverified
            ? (ans.partial ? 'Part of this isn’t on the official course page' : 'Not on the official course page')
            : '✓ From the official course page',
        }));
      }
      if (unverified) {
        under.appendChild(el('a', { class: 'btn secondary', href: whatsappHref(), target: '_blank', rel: 'noopener', onclick: function () { track('cta_whatsapp', { where: 'answer' }); } }, ['Ask the Lapaas team on WhatsApp ↗']));
      }
      var simple = simpleBox(ans.simple);
      if (simple) under.appendChild(simple);
      if (under.childNodes.length) add(under);
      if (done) done();
    });
  }

  function followUps(related) {
    var pool = (related || []).concat(state.suggestions);
    var seen = {};
    var chips = pool.filter(function (c) {
      if (!c || seen[c.id] || state.asked[c.id]) return false;
      seen[c.id] = true;
      return true;
    }).slice(0, 3);
    chipRow(chips, function (c) { askChip(c); }, chips.length ? 'You might also ask:' : null);
  }

  function failMessage(text) {
    botSays(text || 'Sorry, I couldn’t reach the assistant just now. You can still view the course page or ask the Lapaas team on WhatsApp.');
  }

  function onSubmit(e) {
    e.preventDefault();
    var text = input.value.replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    if (!text || state.busy) return;
    input.value = '';
    if (state.phase === 'welcome') state.phase = 'chat';
    if (state.phase !== 'intake') clearChoices();
    askFree(text);
  }

  // ---------- open / close ----------
  var started = false;
  var lastFocus = null;

  function start() {
    if (started) return;
    started = true;
    loadConfig().then(welcome).catch(function () { started = false; failMessage(); });
  }

  function open(source) {
    if (INLINE) { start(); return; }
    if (!panel.hidden) return;
    lastFocus = document.activeElement;
    panel.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    track('open', { where: source || 'api' });
    if (!started) start();
    else focusFirst(log.querySelector('.options:last-of-type, .chips:last-of-type'));
  }

  function close() {
    if (INLINE || panel.hidden) return;
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false');
    track('close');
    var target = lastFocus && document.contains(lastFocus) && lastFocus !== document.body ? lastFocus : launcher;
    target.focus();
  }

  function restart() {
    state = freshState();
    log.innerHTML = '';
    setBusy(false);
    started = false;
    start();
  }

  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !INLINE) { e.stopPropagation(); close(); }
  });

  function mount() {
    if (INLINE) {
      var target = (opt.target && document.querySelector(opt.target)) || document.body;
      target.appendChild(host);
      start();
    } else {
      document.body.appendChild(host);
      if (opt.open === 'true') open('autoopen');
    }
  }

  window.LapaasAssistant = {
    open: function () { open('api'); },
    close: close,
    toggle: function () { panel.hidden ? open('api') : close(); },
    restart: restart,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
