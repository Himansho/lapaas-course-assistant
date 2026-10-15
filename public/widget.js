/*!
 * "Is this course right for me?" assistant: embeddable widget.
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

  var FALLBACK_LINKS = {
    course: 'https://cohort.lapaas.com/?utm_source=course_assistant&utm_medium=chat&utm_campaign=fit_check',
    whatsapp: 'https://wa.me/919540065704',
    whatsapp_number: '+91 95400 65704',
  };
  var MAX_LEN = 400;

  // Theme follows the official course page (Inter + Plus Jakarta Sans, ink / paper / acid lime),
  // so the widget feels native when embedded there. Hosts can override any --lca-* variable.
  var CSS = [
    ':host{all:initial;--_ink:var(--lca-ink,#11110f);--_ink-soft:#1d1d19;--_paper:var(--lca-paper,#f5f5ef);--_surface:var(--lca-surface,#ffffff);',
    '--_warm:#ece9df;--_accent:var(--lca-accent,#11110f);--_accent-ink:var(--lca-accent-ink,#ffffff);--_mark:var(--lca-mark,#b9f24b);',
    '--_mark-dark:#96cf25;--_coral:#ff6b5e;--_blue:#4f72ff;--_muted:var(--lca-muted,#696a64);--_line:var(--lca-line,rgba(17,17,15,.16));',
    '--_ok-bg:#eef9d6;--_ok-ink:#2f4a00;--_warn-bg:#ffe9e6;--_warn-ink:#8f2b21;',
    '--_font:var(--lca-font,Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif);',
    '--_display:var(--lca-display,"Plus Jakarta Sans",var(--_font));font-family:var(--_font);color:var(--_ink);font-size:15px;line-height:1.55}',
    '*{box-sizing:border-box}',
    'button{font:inherit;color:inherit;cursor:pointer}',
    ':focus-visible{outline:3px solid var(--_blue);outline-offset:2px}',
    '@keyframes lca-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '@keyframes lca-pop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}',
    '@keyframes lca-ring{0%,100%{box-shadow:0 0 0 0 rgba(185,242,75,.55)}60%{box-shadow:0 0 0 9px rgba(185,242,75,0)}}',
    '@keyframes lca-dot{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}',
    '.launcher{position:fixed;bottom:20px;z-index:2147483000;display:flex;align-items:center;gap:10px;padding:13px 18px 13px 15px;',
    'border:1px solid rgba(255,255,255,.14);border-radius:999px;background:var(--_ink);color:#fff;font:700 15px/1.2 var(--_display);',
    'box-shadow:0 14px 34px rgba(17,17,15,.28);transition:transform .18s ease;animation:lca-pop .4s ease both}',
    '.launcher:hover{transform:translateY(-2px)}',
    '.launcher .dot{width:11px;height:11px;border-radius:50%;background:var(--_mark);animation:lca-ring 2.2s ease-in-out infinite}',
    '.launcher.right{right:20px}.launcher.left{left:20px}',
    '.launcher[hidden]{display:none}',
    '.panel{position:fixed;bottom:20px;z-index:2147483001;width:min(410px,calc(100vw - 32px));height:min(700px,calc(100vh - 40px));',
    'display:flex;flex-direction:column;background:var(--_paper);border:1px solid var(--_line);border-radius:14px;overflow:hidden;',
    'box-shadow:0 30px 70px rgba(17,17,15,.30);animation:lca-pop .28s ease both}',
    '.panel.right{right:20px}.panel.left{left:20px}',
    '.panel[hidden]{display:none}',
    '.panel.inline{position:relative;inset:auto;width:100%;height:100%;max-width:none;border-radius:12px;box-shadow:none;z-index:auto}',
    '@media (max-width:520px){.panel:not(.inline){inset:0;width:100%;height:100%;height:100dvh;border-radius:0;border:0}}',
    '.head{display:flex;align-items:center;gap:10px;padding:14px 12px 13px 16px;background:var(--_ink);color:#fff}',
    '.head .mark{width:30px;height:30px;flex:none;border-radius:8px;background:var(--_mark);display:grid;place-items:center;color:var(--_ink);font:800 16px/1 var(--_display)}',
    '.head .titles{flex:1;min-width:0}',
    '.head h2{margin:0;font:800 16px/1.2 var(--_display);letter-spacing:-.01em}',
    '.head p{margin:3px 0 0;font-size:12.5px;color:rgba(255,255,255,.72)}',
    '.head p b{color:var(--_mark);font-weight:700}',
    '.iconbtn{border:0;background:transparent;color:#fff;width:36px;height:36px;border-radius:8px;display:grid;place-items:center}',
    '.iconbtn:hover{background:rgba(255,255,255,.12)}',
    '.iconbtn svg{width:18px;height:18px}',
    '.log{flex:1;overflow-y:auto;padding:16px 14px 8px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}',
    '.log>*{flex-shrink:0;animation:lca-in .3s ease both}',
    '.msg{max-width:92%;padding:10px 13px;border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.bot{align-self:flex-start;background:var(--_surface);border:1px solid var(--_line);border-top-left-radius:3px}',
    '.user{align-self:flex-end;background:var(--_accent);color:var(--_accent-ink);border-top-right-radius:3px}',
    '.step{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--_muted);margin-bottom:4px;font-weight:700;letter-spacing:.02em}',
    '.bar{flex:1;max-width:90px;height:4px;border-radius:4px;background:var(--_warm);overflow:hidden}',
    '.bar i{display:block;height:100%;background:var(--_mark-dark);transition:width .4s ease}',
    '.options{display:flex;flex-wrap:wrap;gap:8px;align-self:stretch}',
    '.opt{border:1px solid var(--_ink);background:var(--_surface);color:var(--_ink);border-radius:999px;padding:8px 14px;font-weight:600;font-size:14px;text-align:left;transition:background .15s ease,transform .15s ease}',
    '.opt:hover{background:var(--_mark);transform:translateY(-1px)}',
    '.opt.ghost{border-color:var(--_line);color:var(--_muted)}',
    '.opt.ghost:hover{background:var(--_warm);color:var(--_ink)}',
    '.opt[disabled]{opacity:.4;cursor:default;background:var(--_surface);transform:none}',
    '.tag{display:flex;width:fit-content;align-items:center;gap:6px;margin-top:10px;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700;background:var(--_ok-bg);color:var(--_ok-ink)}',
    '.tag.warn{background:var(--_warn-bg);color:var(--_warn-ink)}',
    '.meta{display:block;margin-top:6px;font-size:12px;color:var(--_muted)}',
    '.simple{display:block;margin-top:10px;border-left:3px solid var(--_mark-dark);background:#f7faef;border-radius:0 8px 8px 0;font-size:13.5px;white-space:normal}',
    '.simple summary{cursor:pointer;padding:7px 10px;font-weight:700;color:var(--_ok-ink);list-style:none}',
    '.simple summary::-webkit-details-marker{display:none}',
    '.simple summary::before{content:"+ ";font-weight:800}',
    '.simple[open] summary::before{content:"− "}',
    '.simple dl{margin:0;padding:0 10px 6px}',
    '.simple dt{font-weight:700;margin-top:6px}',
    '.simple dd{margin:1px 0 0}',
    '.simple small{display:block;padding:0 10px 8px;color:var(--_muted);font-size:11.5px}',
    '.fit{align-self:stretch;max-width:100%;background:var(--_surface);border:1px solid var(--_line);border-radius:12px;overflow:hidden}',
    '.fit:focus{outline:none}',
    '.fit .verdict{padding:14px 14px 12px;background:var(--_ink);color:#fff;font:800 18px/1.25 var(--_display)}',
    '.fit .verdict small{display:block;font:400 13px/1.45 var(--_font);color:rgba(255,255,255,.72);margin-top:5px}',
    '.fit .verdict.strong .badge{background:var(--_mark)}',
    '.fit .verdict .badge{display:inline-block;width:11px;height:11px;border-radius:50%;background:#ffd166;margin-right:9px;vertical-align:1px;animation:lca-ring 2.2s ease-in-out infinite}',
    '.fit ul{list-style:none;margin:0;padding:4px 14px 2px}',
    '.fit li{padding:11px 0;border-bottom:1px solid var(--_line);animation:lca-in .4s ease both}',
    '.fit li:nth-child(2){animation-delay:.12s}.fit li:nth-child(3){animation-delay:.24s}.fit li:nth-child(4){animation-delay:.36s}.fit li:nth-child(5){animation-delay:.48s}',
    '.fit li:last-child{border-bottom:0}',
    '.fit li strong{display:block;font:700 15px/1.3 var(--_display);margin-bottom:3px}',
    '.fit li.caution strong::before{content:"Plan for this: ";color:#b2382d}',
    '.fit li.note strong::after{content:" (my guidance)";font-weight:400;color:var(--_muted);font-size:13px}',
    '.fit li p{margin:0;font-size:14px}',
    '.fit .simple{margin:4px 14px 12px}',
    '.fit .foot{padding:10px 14px 12px;font-size:12.5px;color:var(--_muted);background:var(--_paper);border-top:1px solid var(--_line)}',
    '.typing{display:inline-flex;gap:4px}',
    '.typing i{width:7px;height:7px;border-radius:50%;background:var(--_ink);opacity:.5;animation:lca-dot 1s infinite ease-in-out}',
    '.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}',
    '.compose{display:flex;gap:8px;padding:10px 12px 8px;border-top:1px solid var(--_line);background:var(--_surface)}',
    '.compose label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}',
    '.compose input{flex:1;min-width:0;border:1px solid var(--_line);border-radius:6px;padding:11px 12px;font:inherit;color:var(--_ink);background:#fff}',
    '.compose input:focus{border-color:var(--_ink);outline:none;box-shadow:0 0 0 3px rgba(185,242,75,.6)}',
    '.send{border:0;border-radius:6px;padding:0 16px;background:var(--_accent);color:var(--_accent-ink);font-weight:700}',
    '.send[disabled]{opacity:.5;cursor:default}',
    '.next{display:flex;gap:8px;padding:0 12px 8px;background:var(--_surface)}',
    '.cta{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;gap:6px;min-height:44px;padding:8px;border-radius:6px;font-weight:700;font-size:13.5px;text-decoration:none;line-height:1.2;transition:transform .18s ease}',
    '.cta:hover{transform:translateY(-1px)}',
    '.cta.primary{background:var(--_mark);color:var(--_ink)}',
    '.cta.secondary{border:1px solid var(--_ink);color:var(--_ink);background:transparent}',
    '.legal{margin:0;padding:0 12px 10px;font-size:11.5px;color:var(--_muted);background:var(--_surface);padding-bottom:max(10px,env(safe-area-inset-bottom))}',
    '@media (prefers-reduced-motion:reduce){*,*::before{animation:none!important;transition:none!important}.launcher:hover,.opt:hover,.cta:hover{transform:none}}',
  ].join('');

  var ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z"/></svg>';
  var ICON_RESTART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>';

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

  var launcher = el('button', {
    class: 'launcher ' + POSITION,
    type: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    onclick: function () { open('launcher'); },
  }, [el('span', { class: 'dot', 'aria-hidden': 'true' }), el('span', { text: opt.label || 'Is this course right for me?' })]);

  var log = el('div', { class: 'log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Conversation' });
  var input = el('input', {
    id: 'lca-input',
    type: 'text',
    maxlength: String(MAX_LEN),
    autocomplete: 'off',
    placeholder: 'Ask anything about the course…',
    enterkeyhint: 'send',
  });
  var sendBtn = el('button', { class: 'send', type: 'submit' }, ['Send']);
  var form = el('form', { class: 'compose', onsubmit: onSubmit }, [el('label', { for: 'lca-input', text: 'Your question' }), input, sendBtn]);
  var courseLink = el('a', { class: 'cta primary', target: '_blank', rel: 'noopener', href: FALLBACK_LINKS.course, onclick: function () { track('cta_course', { where: state.phase }); } }, ['View course & price ↗']);
  var waLink = el('a', { class: 'cta secondary', target: '_blank', rel: 'noopener', href: FALLBACK_LINKS.whatsapp, onclick: function () { track('cta_whatsapp', { where: state.phase }); } }, ['Ask the team on WhatsApp ↗']);
  var next = el('div', { class: 'next' }, [courseLink, waLink]);
  var legal = el('p', { class: 'legal', text: 'Prototype by Himanshu Bartwal for the Lapaas internship assignment. Not an official Lapaas page. Please don’t share personal details.' });

  var headTitleId = 'lca-title';
  var closeBtn = INLINE ? null : el('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close assistant', html: ICON_CLOSE, onclick: function () { close(); } });
  var restartBtn = el('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Start over', title: 'Start over', html: ICON_RESTART, onclick: function () { restart(); } });
  var head = el('div', { class: 'head' }, [
    el('div', { class: 'mark', 'aria-hidden': 'true', text: '?' }),
    el('div', { class: 'titles' }, [
      el('h2', { id: headTitleId, text: 'Is this course right for me?' }),
      el('p', { html: 'Honest answers, <b>only from the official course page</b>' }),
    ]),
    restartBtn,
    closeBtn,
  ]);

  var panel = el('section', {
    class: 'panel ' + (INLINE ? 'inline' : POSITION),
    role: INLINE ? 'region' : 'dialog',
    'aria-modal': INLINE ? null : 'false',
    'aria-labelledby': headTitleId,
    hidden: INLINE ? null : true,
  }, [head, log, form, next, legal]);

  if (!INLINE) root.appendChild(launcher);
  root.appendChild(panel);

  // ---------- helpers ----------
  function scrollDown() {
    log.scrollTop = log.scrollHeight;
  }

  function add(node) {
    log.appendChild(node);
    scrollDown();
    return node;
  }

  function botText(text, extra) {
    return add(el('div', { class: 'msg bot' }, [text].concat(extra || [])));
  }

  function userText(text) {
    return add(el('div', { class: 'msg user', text: text }));
  }

  function typing() {
    return add(el('div', { class: 'msg bot', 'aria-label': 'Assistant is typing' }, [el('span', { class: 'typing', 'aria-hidden': 'true', html: '<i></i><i></i><i></i>' })]));
  }

  function setBusy(b) {
    state.busy = b;
    sendBtn.disabled = b;
  }

  function track(event, data) {
    try {
      var body = JSON.stringify({ event: event, data: data || {} });
      if (navigator.sendBeacon) navigator.sendBeacon(EVENT_API, new Blob([body], { type: 'text/plain' }));
      else fetch(EVENT_API, { method: 'POST', body: body, keepalive: true, headers: { 'content-type': 'text/plain' } });
    } catch (e) { /* analytics must never break the chat */ }
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
      if (cfg.links) {
        courseLink.href = cfg.links.course || FALLBACK_LINKS.course;
      }
      updateWhatsApp();
      return cfg;
    });
  }

  function updateWhatsApp() {
    var links = (state.config && state.config.links) || FALLBACK_LINKS;
    var text = 'Hi, I have a question about the AI Product Engineering course.';
    if (state.profileSummary) text += '\nAbout me: ' + state.profileSummary;
    if (state.lastUnverified) text += '\nMy question: ' + state.lastUnverified;
    waLink.href = links.whatsapp + '?text=' + encodeURIComponent(text);
  }

  function disableOptions(container) {
    var btns = container.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
  }

  function optionRow(items, onPick, extraClass) {
    var row = el('div', { class: 'options', role: 'group' });
    items.forEach(function (it) {
      row.appendChild(el('button', {
        class: 'opt' + (it.ghost ? ' ghost' : '') + (extraClass ? ' ' + extraClass : ''),
        type: 'button',
        onclick: function () {
          if (state.busy) return;
          disableOptions(row);
          onPick(it);
        },
      }, [it.label]));
    });
    return add(row);
  }

  function focusFirst(container) {
    var b = container && container.querySelector('button:not([disabled])');
    (b || input).focus({ preventScroll: true });
  }

  // ---------- flow ----------
  function welcome() {
    botText('Hi! 👋 Not sure if the Lapaas AI Product Engineering course is right for you? I can help.\n\nAnswer 5 quick questions (just tap), and I’ll give you an honest fit check. Or ask me anything. I only use facts from the official course page, and I’ll tell you clearly when something isn’t written there.');
    var row = optionRow(
      [{ id: 'start', label: 'Start the fit check' }, { id: 'skip', label: 'Skip, I just have a question', ghost: true }],
      function (it) {
        if (it.id === 'start') {
          userText('Start the fit check');
          track('intake_start');
          state.phase = 'intake';
          focusFirst(askIntake());
        } else {
          userText('Skip, I just have a question');
          track('intake_skip');
          state.phase = 'chat';
          showSuggestions(defaultChips(), 'Here are some common questions. Tap one, or type your own:');
        }
      },
    );
    return row;
  }

  function defaultChips() {
    return (state.config && state.config.default_chips) || [];
  }

  function askIntake() {
    disableOptions(log); // only the current question's buttons stay active
    var q = state.config.intake[state.qIndex];
    var total = state.config.intake.length;
    var from = Math.round((state.qIndex / total) * 100);
    var to = Math.round(((state.qIndex + 1) / total) * 100);
    var bar = el('span', { class: 'bar', 'aria-hidden': 'true' }, [el('i', { style: 'width:' + from + '%' })]);
    botText('', [el('span', { class: 'step' }, ['Question ' + (state.qIndex + 1) + ' of ' + total, bar]), q.question]);
    setTimeout(function () { bar.firstChild.style.width = to + '%'; }, 60);
    var row = optionRow(q.options, function (o) {
      userText(o.label);
      state.profile[q.key] = o.id;
      state.qIndex += 1;
      if (state.qIndex < state.config.intake.length) {
        focusFirst(askIntake());
      } else {
        finishIntake();
      }
    });
    return row;
  }

  function finishIntake() {
    state.phase = 'chat';
    setBusy(true);
    var t = typing();
    api({ type: 'fit', profile: state.profile })
      .then(function (fit) {
        t.remove();
        state.profileSummary = fit.profile_summary || '';
        updateWhatsApp();
        var card = renderFit(fit);
        track('intake_complete', { verdict: fit.verdict && fit.verdict.level, role: state.profile.role, goal: state.profile.goal });
        showSuggestions(fit.chips || [], 'Questions people like you often ask. Tap one, or type your own:');
        log.scrollTop = card.offsetTop - log.offsetTop - 12; // show the summary from its top
        card.focus({ preventScroll: true });
      })
      .catch(function () {
        t.remove();
        failMessage();
      })
      .then(function () { setBusy(false); });
  }

  function renderFit(fit) {
    var list = el('ul');
    (fit.points || []).forEach(function (p) {
      list.appendChild(el('li', { class: p.kind || 'point' }, [el('strong', { text: p.title }), el('p', { text: p.text })]));
    });
    return add(el('div', { class: 'fit', role: 'group', tabindex: '-1', 'aria-label': 'Your fit check' }, [
      el('div', { class: 'verdict ' + ((fit.verdict && fit.verdict.level) || '') }, [
        el('span', { class: 'badge', 'aria-hidden': 'true' }),
        (fit.verdict && fit.verdict.label) || 'Your fit check',
        el('small', { text: fit.intro || '' }),
      ]),
      list,
      simpleBox(fit.simple),
      el('div', { class: 'foot', text: 'Quotes are from the official course page (checked ' + ((state.config && state.config.kb_checked) || '') + '). This is guidance, not a promise of results.' }),
    ]));
  }

  function showSuggestions(chips, lead) {
    state.suggestions = chips.slice();
    var remaining = chips.filter(function (c) { return c && !state.asked[c.id]; }).slice(0, 4);
    if (!remaining.length) return null;
    if (lead) botText(lead);
    var row = optionRow(remaining, function (c) { askChip(c); });
    return row;
  }

  function askChip(chip) {
    state.asked[chip.id] = true;
    userText(chip.label);
    setBusy(true);
    var t = typing();
    track('chip', { id: chip.id });
    api({ type: 'faq', id: chip.id })
      .then(function (ans) {
        t.remove();
        renderAnswer(ans, chip.label);
        followUps(ans);
      })
      .catch(function () {
        t.remove();
        failMessage();
      })
      .then(function () { setBusy(false); });
  }

  function askFree(text) {
    userText(text);
    setBusy(true);
    var t = typing();
    var body = { type: 'ask', message: text, history: state.history.slice(-6) };
    if (Object.keys(state.profile).length) body.profile = state.profile;
    api(body)
      .then(function (ans) {
        t.remove();
        state.history.push({ role: 'user', text: text }, { role: 'assistant', text: ans.answer || '' });
        track('ask', { mode: ans.mode, status: ans.status });
        renderAnswer(ans, text);
        if (state.phase === 'intake') {
          botText('Let’s continue with your fit check.');
          focusFirst(askIntake());
        } else {
          followUps(ans);
        }
      })
      .catch(function (err) {
        t.remove();
        failMessage(err && err.message === 'empty_message' ? 'Please type a question first.' : null);
      })
      .then(function () { setBusy(false); });
  }

  function sourceLine(ans) {
    var nodes = [];
    var unverified = ans.status === 'not_stated' || ans.status === 'not_in_kb';
    if (ans.status === 'off_topic') return nodes;
    if (unverified) {
      var warn = ans.status === 'not_in_kb' ? '⚠ Can’t verify from the official page'
        : ans.partial ? '⚠ Part of this isn’t stated on the official page'
        : '⚠ Not stated on the official page';
      nodes.push(el('span', { class: 'tag warn', text: warn }));
    } else if (ans.mode === 'ai') {
      nodes.push(el('span', { class: 'tag', text: '✓ AI answer, checked against the official page' }));
    } else {
      nodes.push(el('span', { class: 'tag', text: '✓ From the official course page' }));
    }
    var srcs = (ans.sources || []).map(function (s) { return s.question; });
    var metaText = [];
    if (srcs.length) metaText.push('Source: ' + srcs.join(' · '));
    if (ans.mode === 'fallback' && !unverified) metaText.push('AI is offline, so this is the verified FAQ answer.');
    if (ans.mode === 'guard') metaText.push('An AI draft failed the fact check, so you see the verified answer instead.');
    if (unverified) metaText.push('Tap “Ask the team on WhatsApp” below and your question is pre-filled.');
    if (metaText.length) nodes.push(el('span', { class: 'meta', text: metaText.join(' ') }));
    return nodes;
  }

  // Plain meanings for jargon in an answer. General meanings, not course facts.
  function simpleBox(terms) {
    if (!terms || !terms.length) return null;
    var dl = el('dl');
    terms.forEach(function (t) {
      dl.appendChild(el('dt', { text: t.term }));
      dl.appendChild(el('dd', { text: t.simple }));
    });
    var label = (state.config && state.config.simple_label) || 'Simple words (general meanings, not from the course page)';
    return el('details', { class: 'simple' }, [
      el('summary', { text: 'Confusing words? Tap for simple meanings (' + terms.length + ')' }),
      dl,
      el('small', { text: label }),
    ]);
  }

  function renderAnswer(ans, question) {
    if (ans.status === 'not_stated' || ans.status === 'not_in_kb') {
      state.lastUnverified = String(question).slice(0, 200);
      updateWhatsApp();
    }
    botText(ans.answer || '', sourceLine(ans).concat([simpleBox(ans.simple)]));
  }

  function followUps(ans) {
    var pool = (ans.related || []).concat(state.suggestions);
    var seen = {};
    var chips = pool.filter(function (c) {
      if (!c || seen[c.id] || state.asked[c.id]) return false;
      seen[c.id] = true;
      return true;
    });
    if (chips.length) {
      var row = optionRow(chips.slice(0, 4), function (c) { askChip(c); });
      state.suggestions = chips;
      return row;
    }
    return null;
  }

  function failMessage(text) {
    botText(text || 'Sorry, I couldn’t reach the assistant just now. You can still view the official course page or ask the Lapaas team on WhatsApp using the buttons below.');
  }

  function onSubmit(e) {
    e.preventDefault();
    var text = input.value.replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    if (!text || state.busy) return;
    input.value = '';
    if (state.phase === 'welcome') state.phase = 'chat';
    askFree(text);
  }

  // ---------- open / close ----------
  var started = false;
  var lastFocus = null;

  function start() {
    if (started) return;
    started = true;
    loadConfig()
      .then(function () {
        var row = welcome();
        if (!INLINE || opt.open === 'true') focusFirst(row);
      })
      .catch(function () {
        started = false;
        failMessage();
      });
  }

  function open(source) {
    if (INLINE) {
      start();
      return;
    }
    if (!panel.hidden) return;
    lastFocus = document.activeElement;
    panel.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    track('open', { where: source || 'api' });
    if (!started) start();
    else focusFirst(log.lastElementChild && log.lastElementChild.classList.contains('options') ? log.lastElementChild : null);
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
    updateWhatsApp();
    started = false;
    start();
  }

  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !INLINE) {
      e.stopPropagation();
      close();
    }
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
