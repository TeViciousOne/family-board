/* Shared interface pieces: device settings, dialogs, toasts, form controls, the repeat editor. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, R = FB.recur, h = U.h;
  var ui = (FB.ui = {});
  var t = function (k, v) { return FB.i18n.t(k, v); };

  /* ---------------------------------------------------------------- */
  /*  Per-device settings (stored only on this tablet / phone)          */
  /* ---------------------------------------------------------------- */
  var DEV_KEY = 'fb.device.v1';
  function guessLang() { return /^sq/i.test(navigator.language || '') ? 'sq' : 'en'; }
  function guessWall() { return root.innerWidth >= 900 && root.innerHeight >= 600 && root.innerWidth > root.innerHeight; }
  var stored = {};
  try { stored = JSON.parse(localStorage.getItem(DEV_KEY) || '{}') || {}; } catch (e) { stored = {}; }
  var wallGuess = guessWall();
  FB.device = Object.assign({
    lang: guessLang(), wall: wallGuess, askWho: wallGuess ? 'always' : 'never',
    sound: true, volume: 0.6,
    nightOn: true, nightFrom: '22:30', nightTo: '06:30',
    place: FB.weather.DEFAULT_PLACE, reload4: true, homeIdle: wallGuess
  }, stored);
  /* device type + which home-screen blocks this device shows */
  FB.widgets = ['weather', 'ac', 'news', 'summary', 'events', 'countdown', 'shopping', 'notes'];
  FB.kindDefaults = function (k) {
    var m = {}; FB.widgets.forEach(function (w) { m[w] = true; });
    if (k === 'phone') { m.news = false; m.weather = false; m.notes = false; }
    return m;
  };
  if (!FB.device.kind) FB.device.kind = FB.device.wall ? 'wall' : (root.innerWidth < 700 ? 'phone' : 'tablet');
  if (!FB.device.show) FB.device.show = FB.kindDefaults(FB.device.kind);
  FB.showW = function (w) { return !FB.device.show || FB.device.show[w] !== false; };
  FB.setKind = function (k) {
    var d = FB.device;
    d.kind = k; d.wall = k === 'wall'; d.homeIdle = k === 'wall';
    d.askWho = k === 'wall' ? 'always' : 'never';
    d.show = FB.kindDefaults(k); d.kindAsked = true;
    FB.saveDevice();
  };
  FB.saveDevice = function () { try { localStorage.setItem(DEV_KEY, JSON.stringify(FB.device)); } catch (e) { /* ignore */ } };

  /* ---------------------------------------------------------------- */
  /*  Constants                                                         */
  /* ---------------------------------------------------------------- */
  ui.COLORS = ['#E8573F', '#F0A818', '#4FA36B', '#2F86D0', '#8B54B0', '#D9477B', '#1C9C94', '#5A6B8C'];
  ui.CHORE_EMOJI = ['🧹', '🍽️', '🗑️', '🧺', '🪴', '🐈', '🐕', '🚿', '🛏️', '🍳', '🛒', '💳', '📚', '🚗', '🧽', '🪟', '👕', '🌱', '🔧', '🧸', '📦', '💊', '🍎', '☕'];
  ui.MEMBER_EMOJI = ['', '🦊', '🐼', '🐯', '🐸', '🦁', '🐙', '🦄', '🌻', '⚽', '🎸', '🚀'];

  /* ---------------------------------------------------------------- */
  /*  Icons                                                             */
  /* ---------------------------------------------------------------- */
  var ICONS = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    list: '<path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11"/>',
    cart: '<path d="M3 4h2.5l2 11h10.5l2-8H7"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    power: '<path d="M12 3v8"/><path d="M7.2 6.6a7.5 7.5 0 1 0 9.6 0"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
    pin: '<path d="M9 3h6l-1 6 3 3H7l3-3-1-6zM12 12v9"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M14.5 5l-7 7 7 7"/>',
    right: '<path d="M9.5 5l7 7-7 7"/>',
    down: '<path d="M5 9.5l7 7 7-7"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16zM10 20.5h4"/>',
    undo: '<path d="M9 6L4 11l5 5"/><path d="M4 11h10a6 6 0 0 1 0 12"/>',
    repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    edit: '<path d="M4 20l1-4L16.5 4.5l3 3L8 19l-4 1z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 4-.8M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    logout: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.6-5.9L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4.5l3 1.5"/>'
  };
  ui.icon = function (name, size) {
    var s = size || 24;
    var el = h('span', { class: 'ico', 'aria-hidden': 'true' });
    el.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
    return el;
  };

  ui.avatar = function (m, size) {
    var s = size || 40;
    var label = m ? (m.emoji || (m.name || '?').trim().charAt(0).toUpperCase()) : '?';
    return h('span', {
      class: 'avatar', style: {
        width: s + 'px', height: s + 'px', fontSize: Math.round(s * (m && m.emoji ? 0.52 : 0.48)) + 'px',
        background: m ? m.color : '#9DB0AC', color: m ? U.textOn(m.color) : '#fff'
      }
    }, label);
  };

  /* ---------------------------------------------------------------- */
  /*  Toast                                                             */
  /* ---------------------------------------------------------------- */
  ui.toast = function (text, opts) {
    opts = opts || {};
    var box = document.getElementById('toast');
    var el = h('div', { class: 'toast' + (opts.kind ? ' ' + opts.kind : ''), role: 'status' }, h('span', null, text));
    var timer;
    function gone() { clearTimeout(timer); if (el.parentNode) el.parentNode.removeChild(el); }
    if (opts.action) {
      el.appendChild(h('button', { class: 'toast-act', onclick: function () { gone(); opts.action.fn(); } }, opts.action.label));
    }
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    timer = setTimeout(gone, opts.ms || (opts.action ? 6000 : 3500));
    return gone;
  };

  /* ---------------------------------------------------------------- */
  /*  Modal                                                             */
  /* ---------------------------------------------------------------- */
  var stack = [];
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
  });

  ui.modal = function (opts) {
    var layer = document.getElementById('layer');
    var closed = false;
    var scrim = h('div', { class: 'scrim', onmousedown: function (e) { if (e.target === scrim) api.close(); } });
    var head = h('div', { class: 'sheet-head' },
      h('h2', null, opts.title || ''),
      h('button', { class: 'icon-btn', 'aria-label': t('common.close'), onclick: function () { api.close(); } }, ui.icon('x')));
    var sheet = h('div', { class: 'sheet' + (opts.size ? ' ' + opts.size : ''), role: 'dialog', 'aria-modal': 'true' },
      head, h('div', { class: 'sheet-body' }, opts.body), opts.actions ? h('div', { class: 'sheet-actions' }, opts.actions) : null);
    scrim.appendChild(sheet);
    layer.appendChild(scrim);
    var api = {
      el: sheet,
      close: function () {
        if (closed) return; closed = true;
        stack = stack.filter(function (m) { return m !== api; });
        if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
        if (opts.onClose) opts.onClose();
      }
    };
    stack.push(api);
    var first = sheet.querySelector('input[type=text],input[type=email],textarea');
    if (first && opts.focus !== false && root.innerWidth >= 700) setTimeout(function () { first.focus(); }, 30);
    return api;
  };
  ui.closeAllModals = function () { stack.slice().forEach(function (m) { m.close(); }); };

  ui.confirm = function (o) {
    return new Promise(function (resolve) {
      var m;
      var yes = h('button', { class: 'btn ' + (o.danger ? 'danger' : ''), onclick: function () { resolve(true); m.close(); } }, o.yes || t('common.yes'));
      var no = h('button', { class: 'btn ghost', onclick: function () { m.close(); } }, o.no || t('common.cancel'));
      var settled = false;
      m = ui.modal({
        title: o.title, body: o.text ? h('p', { class: 'lead' }, o.text) : null, actions: [no, yes], focus: false,
        onClose: function () { if (!settled) { settled = true; resolve(false); } }
      });
      yes.addEventListener('click', function () { settled = true; });
    });
  };

  /* ---------------------------------------------------------------- */
  /*  Form controls                                                     */
  /* ---------------------------------------------------------------- */
  ui.field = function (label, control, hint) {
    return h('div', { class: 'field' }, h('label', null, label), control, hint ? h('p', { class: 'hint' }, hint) : null);
  };

  /* segmented control: options = [{v, label}] */
  ui.seg = function (options, value, onChange) {
    var el = h('div', { class: 'seg' + (options.reduce(function (n, o) { return n + String(o.label).length; }, 0) > 24 ? ' stack' : ''), role: 'group' });
    var btns = options.map(function (o) {
      var b = h('button', {
        type: 'button', class: 'seg-b' + (o.v === value ? ' on' : ''), 'aria-pressed': o.v === value ? 'true' : 'false',
        onclick: function () { el.set(o.v); onChange(o.v); }
      }, o.label);
      b.dataset.v = String(o.v);
      return b;
    });
    btns.forEach(function (b) { el.appendChild(b); });
    el.set = function (v) {
      btns.forEach(function (b) { var on = b.dataset.v === String(v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    };
    return el;
  };

  ui.swatches = function (colors, value, onChange) {
    var el = h('div', { class: 'swatches' });
    function draw(v) {
      U.clear(el);
      colors.forEach(function (c) {
        el.appendChild(h('button', {
          type: 'button', class: 'swatch' + (c === v ? ' on' : ''), style: { background: c, color: U.textOn(c) }, 'aria-label': c, 'aria-pressed': c === v ? 'true' : 'false',
          onclick: function () { draw(c); onChange(c); }
        }, c === v ? ui.icon('check', 22) : null));
      });
    }
    draw(value);
    return el;
  };

  ui.emojiGrid = function (list, value, onChange, allowCustom) {
    var el = h('div', { class: 'emoji-grid' });
    var custom = null;
    function draw(v) {
      U.clear(el);
      list.forEach(function (e) {
        el.appendChild(h('button', {
          type: 'button', class: 'emoji-b' + (e === v ? ' on' : ''), 'aria-pressed': e === v ? 'true' : 'false',
          onclick: function () { draw(e); onChange(e); }
        }, e || t('member.initial')));
      });
      if (allowCustom) {
        custom = h('input', {
          type: 'text', class: 'emoji-custom', maxlength: '4', placeholder: '…', 'aria-label': t('common.otherEmoji'),
          value: list.indexOf(v) === -1 ? v : '',
          onchange: function () { var val = custom.value.trim(); if (val) { onChange(val); draw(val); } }
        });
        el.appendChild(custom);
      }
    }
    draw(value);
    return el;
  };

  ui.stepper = function (value, min, max, onChange) {
    var v = value;
    var out = h('span', { class: 'stepper-v' }, String(v));
    function set(n) { v = Math.max(min, Math.min(max, n)); out.textContent = String(v); onChange(v); }
    return h('div', { class: 'stepper' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '−', onclick: function () { set(v - 1); } }, '−'),
      out,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '+', onclick: function () { set(v + 1); } }, '+'));
  };

  ui.confetti = function (anchor, color) {
    if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var r = anchor.getBoundingClientRect(), cx = r.left + 24, cy = r.top + r.height / 2;
    var colors = [color, '#F0A818', '#2F86D0', '#4FA36B', '#D9477B'];
    for (var i = 0; i < 14; i++) {
      var a = (Math.PI * 2 * i) / 14 + Math.random() * 0.5, d = 34 + Math.random() * 40;
      var p = h('i', { class: 'confetti', style: { left: cx + 'px', top: cy + 'px', background: colors[i % colors.length] } });
      p.style.setProperty('--dx', Math.cos(a) * d + 'px');
      p.style.setProperty('--dy', Math.sin(a) * d - 14 + 'px');
      p.style.setProperty('--rot', Math.round(Math.random() * 360) + 'deg');
      document.body.appendChild(p);
      (function (n) { setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 900); })(p);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Repeat editor (used by chores and events)                          */
  /* ---------------------------------------------------------------- */
  ui.recurEditor = function (initial, opts) {
    opts = opts || {};
    var r = Object.assign(R.defaultRule(), initial || {});
    r.weekdays = (r.weekdays || []).slice();
    var rootEl = h('div', { class: 'recur' });
    var changed = opts.onChange || function () {};

    function nthOfStart() { return Math.min(4, Math.floor((U.parts(r.start).d - 1) / 7) + 1); }
    function commit() { draw(); changed(); }

    var dayOrder = [1, 2, 3, 4, 5, 6, 0];

    var adv = !!opts.advanced;
    function allDays() { return [0, 1, 2, 3, 4, 5, 6]; }
    function curDays() { return r.freq === 'daily' && (r.interval || 1) === 1 ? allDays() : r.freq === 'weekly' ? r.weekdays : []; }
    /* alarm-clock style: the day circles decide the rule (none = once, all seven = daily) */
    function setDays(days) {
      days = days.slice();
      if (!days.length) r.freq = 'once';
      else if (days.length === 7 && (r.interval || 1) === 1) { r.freq = 'daily'; r.weekdays = []; }
      else { r.freq = 'weekly'; r.weekdays = days; }
      commit();
    }
    function same(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) !== -1; }); }

    function draw() {
      U.clear(rootEl);
      if (r.freq === 'monthly' || r.freq === 'yearly' || (r.interval || 1) > 1) adv = true;
      var cd = curDays();
      var quick = h('div', { class: 'chips alarm-quick' });
      [
        { l: opts.onceLabel || t('rule.f.once'), on: r.freq === 'once', f: function () { r.freq = 'once'; commit(); } },
        { l: t('rule.f.daily'), on: r.freq === 'daily' && (r.interval || 1) === 1, f: function () { setDays(allDays()); } },
        { l: t('rule.weekdays'), on: r.freq === 'weekly' && same(cd, [1, 2, 3, 4, 5]), f: function () { setDays([1, 2, 3, 4, 5]); } },
        { l: t('rule.weekends'), on: r.freq === 'weekly' && same(cd, [6, 0]), f: function () { setDays([6, 0]); } }
      ].forEach(function (q) {
        quick.appendChild(h('button', { type: 'button', class: 'chip' + (q.on ? ' on' : ''), 'aria-pressed': q.on ? 'true' : 'false', onclick: q.f }, q.l));
      });
      rootEl.appendChild(quick);
      var dots = h('div', { class: 'day-dots' });
      dayOrder.forEach(function (d) {
        var on = cd.indexOf(d) !== -1;
        dots.appendChild(h('button', {
          type: 'button', class: 'day-dot' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false',
          onclick: function () {
            var days = (r.freq === 'daily' || r.freq === 'weekly') ? curDays().slice() : [];
            var i = days.indexOf(d);
            if (i === -1) days.push(d); else days.splice(i, 1);
            setDays(days);
          }
        }, FB.i18n.dayShort(d)));
      });
      rootEl.appendChild(dots);
      rootEl.appendChild(h('button', { type: 'button', class: 'link-btn recur-more', onclick: function () { adv = !adv; draw(); changed(); } }, adv ? t('rule.fewer') : t('rule.more')));

      if (adv) {
        rootEl.appendChild(ui.seg([
          { v: 'once', label: opts.onceLabel || t('rule.f.once') },
          { v: 'daily', label: t('rule.f.daily') }, { v: 'weekly', label: t('rule.f.weekly') },
          { v: 'monthly', label: t('rule.f.monthly') }, { v: 'yearly', label: t('rule.f.yearly') }
        ], r.freq, function (v) {
          r.freq = v;
          if (v === 'weekly' && !r.weekdays.length) r.weekdays = [U.weekday(r.start)];
          if (v === 'monthly') { r.dom = U.parts(r.start).d; r.nth = nthOfStart(); r.nthDay = U.weekday(r.start); }
          commit();
        }));
        if (r.freq !== 'once') {
          var unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.freq];
          rootEl.appendChild(h('div', { class: 'recur-row' },
            h('span', { class: 'recur-lbl' }, t('rule.every')),
            ui.stepper(r.interval || 1, 1, 99, function (n) { r.interval = n; drawSummary(); changed(); }),
            h('span', { class: 'recur-lbl' }, t('unit.' + unit + (r.interval === 1 ? '' : 's')))));
        }
      }

      if (r.freq === 'monthly') {
        rootEl.appendChild(ui.seg([
          { v: 'dom', label: t('rule.m.dom') }, { v: 'nth', label: t('rule.m.nth') }, { v: 'last', label: t('rule.m.last') }
        ], r.monthMode || 'dom', function (v) { r.monthMode = v; commit(); }));
        if ((r.monthMode || 'dom') === 'dom') {
          rootEl.appendChild(h('div', { class: 'recur-row' }, h('span', { class: 'recur-lbl' }, t('rule.m.dayN')),
            ui.stepper(r.dom || 1, 1, 31, function (n) { r.dom = n; drawSummary(); changed(); })));
        }
        if (r.monthMode === 'nth') {
          var ordSel = h('select', { onchange: function () { r.nth = Number(ordSel.value); drawSummary(); changed(); } },
            [1, 2, 3, 4, -1].map(function (n) { return h('option', { value: String(n), selected: r.nth === n }, FB.i18n.ord(n)); }));
          var daySel = h('select', { onchange: function () { r.nthDay = Number(daySel.value); drawSummary(); changed(); } },
            dayOrder.map(function (d) { return h('option', { value: String(d), selected: r.nthDay === d }, FB.i18n.dayLong(d)); }));
          rootEl.appendChild(h('div', { class: 'recur-row' }, ordSel, daySel));
        }
      }

      if (opts.showStart !== false) {
        var startIn = h('input', { type: 'date', value: r.start, onchange: function () { if (startIn.value) { r.start = startIn.value; drawSummary(); changed(); } } });
        rootEl.appendChild(ui.field(r.freq === 'once' ? t('rule.date') : t('rule.starts'), startIn));
      }

      if (r.freq !== 'once') {
        var untilIn = h('input', { type: 'date', value: r.until || '', min: r.start, onchange: function () { r.until = untilIn.value || null; drawSummary(); changed(); } });
        var untilWrap = h('div', { class: 'recur-row', style: { display: r.until ? '' : 'none' } }, untilIn);
        rootEl.appendChild(h('div', { class: 'field' }, h('label', null, t('rule.ends')),
          ui.seg([{ v: 'never', label: t('rule.endNever') }, { v: 'on', label: t('rule.endOn') }], r.until ? 'on' : 'never', function (v) {
            if (v === 'never') { r.until = null; untilWrap.style.display = 'none'; }
            else { r.until = r.until || U.addDays(r.start, 90); untilIn.value = r.until; untilWrap.style.display = ''; }
            drawSummary(); changed();
          }), untilWrap));
      }

      rootEl.appendChild(h('p', { class: 'recur-sum', 'data-sum': '1' }));
      drawSummary();
    }

    function drawSummary() {
      var el = rootEl.querySelector('[data-sum]');
      if (el) el.textContent = FB.recur.describe(api.get(), FB.i18n.L);
    }

    var api = {
      el: rootEl,
      setStart: function (date) { if (date) { r.start = date; if (r.freq === 'monthly' && (r.monthMode || 'dom') === 'dom' && !opts.keepDom) r.dom = U.parts(date).d; draw(); } },
      get: function () {
        var out = { freq: r.freq, interval: Math.max(1, r.interval || 1), start: r.start, until: r.freq === 'once' ? null : (r.until || null) };
        if (r.freq === 'once') out.interval = 1;
        if (r.freq === 'weekly') out.weekdays = r.weekdays.slice().sort(function (a, b) { return a - b; });
        if (r.freq === 'monthly') {
          out.monthMode = r.monthMode || 'dom';
          if (out.monthMode === 'dom') out.dom = r.dom || U.parts(r.start).d;
          if (out.monthMode === 'nth') { out.nth = r.nth || 1; out.nthDay = r.nthDay == null ? 1 : r.nthDay; }
        }
        return out;
      }
    };
    draw();
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
