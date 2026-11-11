/* Air conditioner (Tuya / Smart Life) from the home screen. All the talking happens in the `ac` edge function. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  var AC = (FB.ac = {});
  var st = { loaded: false, online: true, at: 0, s: {} }, busy = false, listeners = [];

  AC.enabled = function () { return !!(FB.store && FB.store.mode === 'cloud' && FB.store.ac); };
  AC.state = function () { return st; };
  AC.on = function () { return !!st.s.switch; };

  function toMap(list) { var m = {}; (list || []).forEach(function (x) { m[x.code] = x.value; }); return m; }
  function changed() { listeners.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); }

  AC.refresh = function (force) {
    if (!AC.enabled() || busy || (!force && Date.now() - st.at < 20000)) return Promise.resolve();
    busy = true;
    return FB.store.ac({ action: 'status' }).then(function (d) {
      st.loaded = true; st.online = d.online !== false; st.s = toMap(d.status); st.at = Date.now(); busy = false; changed();
    }, function () { busy = false; st.at = Date.now() - 10000; });
  };

  var pending = {}, timer = null;
  /* optimistic: show the change at once, send it shortly after (so +/+/+ is one request) */
  AC.set = function (code, value) {
    st.s[code] = value; pending[code] = value; changed();
    clearTimeout(timer);
    timer = setTimeout(function () {
      var cmds = Object.keys(pending).map(function (c) { return { code: c, value: pending[c] }; });
      pending = {};
      FB.store.ac({ action: 'set', commands: cmds }).then(function () {
        setTimeout(function () { AC.refresh(true); }, 2500);
      }, function () { ui.toast(t('ac.failed')); AC.refresh(true); });
    }, 450);
  };

  var MODES = ['cold', 'hot', 'wet', 'wind', 'auto'], FANS = ['auto', 'mute', 'low', 'middle', 'high', 'strong'];
  function modeLabel(m) { return t('ac.m.' + m); }

  /* the card on the home screen, under the weather */
  AC.tile = function () {
    if (!AC.enabled()) return null;
    /* [icon  name      status]
       [ room temp | set temp ]  two equal halves */
    var state = h('span', { class: 'ac-pill' }, ''), room = h('b', null, ''), set = h('b', null, '');
    var btn = h('button', { type: 'button', class: 'ac-tile', onclick: function () { AC.open(); } },
      h('span', { class: 'ac-head' }, h('span', { class: 'ac-ico' }, ui.icon('snow', 24)), h('b', { class: 'ac-name' }, t('ac.title'))),
      h('span', { class: 'ac-cols' },
        h('span', { class: 'ac-col' }, room, h('small', null, t('ac.roomShort'))),
        h('span', { class: 'ac-col ac-col-set' }, set, h('small', null, t('ac.setShort')))),
      state);
    function paint() {
      var s = st.s, on = AC.on() && st.online;
      btn.style.display = st.loaded ? '' : 'none';
      btn.classList.toggle('on', on);
      if (!st.loaded) return;
      if (!st.online) { state.textContent = t('ac.offline'); room.textContent = '–'; set.textContent = '–'; return; }
      state.textContent = on ? t('ac.on') + ' · ' + modeLabel(s.mode) : t('ac.off');
      room.textContent = s.temp_current != null ? s.temp_current + '°' : '–';
      set.textContent = s.temp_set != null ? s.temp_set + '°' : '–';
    }
    var fn = function () { if (!document.body.contains(btn)) { listeners = listeners.filter(function (x) { return x !== fn; }); return; } paint(); };
    listeners.push(fn); paint(); AC.refresh();
    return btn;
  };

  /* small tile for phones: "20° · Fikur" */
  AC.mini = function () {
    if (!AC.enabled()) return null;
    var big = h('b', null, '–'), small = h('small', null, t('ac.title'));
    var btn = h('button', { type: 'button', class: 'ptile pt-ac', onclick: function () { AC.open(); } }, h('span', { class: 'pt-ico' }, '❄️'), big, small);
    function paint() {
      var s = st.s, on = AC.on() && st.online;
      btn.classList.toggle('on', on);
      if (!st.loaded) return;
      big.textContent = s.temp_current != null ? s.temp_current + '°' : '–';
      small.textContent = !st.online ? t('ac.offline') : on ? t('ac.on') + ' · ' + (s.temp_set != null ? s.temp_set + '°' : '') : t('ac.off');
    }
    var fn = function () { if (!document.body.contains(btn)) { listeners = listeners.filter(function (x) { return x !== fn; }); return; } paint(); };
    listeners.push(fn); paint(); AC.refresh();
    return btn;
  };

  /* ---- schedules: turn on / off at set times ---- */
  var DOTS = [1, 2, 3, 4, 5, 6, 0];
  function schedules() {
    var box = h('section', { class: 'ac-sched' }), list = [], editing = null, loaded = false;
    function load() {
      return FB.store.ac({ action: 'schedules' }).then(function (d) { list = d.schedules || []; loaded = true; draw(); }, function () { loaded = true; draw(); });
    }
    function save(x) {
      return FB.store.ac({ action: 'schedule_save', schedule: x }).then(function (d) { list = d.schedules || []; editing = null; draw(); }, function () { ui.toast(t('ac.failed')); });
    }
    function del(x) {
      FB.store.ac({ action: 'schedule_delete', id: x.id }).then(function (d) { list = d.schedules || []; editing = null; draw(); }, function () { ui.toast(t('ac.failed')); });
    }
    function what(x) {
      if (x.action === 'off') return t('ac.s.turnOff');
      return t('ac.s.turnOn') + (x.mode ? ' · ' + modeLabel(x.mode) : '') + (x.temp ? ' · ' + x.temp + '°' : '');
    }
    function dots(days) {
      return h('span', { class: 'mini-dots' }, DOTS.map(function (d) { return h('i', { class: days.indexOf(d) !== -1 ? 'on' : '' }, FB.i18n.dayShort(d).charAt(0)); }));
    }
    function form(x) {
      var f = Object.assign({ at: '07:00', days: [1, 2, 3, 4, 5], action: 'on', mode: st.s.mode || 'hot', temp: Number(st.s.temp_set || 23), enabled: true }, x || {});
      f.days = f.days.slice();
      var el = h('div', { class: 'ac-form' });
      function paint() {
        U.clear(el);
        var tIn = h('input', { type: 'time', value: f.at, onchange: function () { if (tIn.value) f.at = tIn.value; } });
        el.appendChild(h('div', { class: 'ac-form-row' }, tIn,
          ui.seg([{ v: 'on', label: t('ac.s.turnOn') }, { v: 'off', label: t('ac.s.turnOff') }], f.action, function (v) { f.action = v; paint(); })));
        el.appendChild(h('div', { class: 'day-dots' }, DOTS.map(function (d) {
          var on = f.days.indexOf(d) !== -1;
          return h('button', { type: 'button', class: 'day-dot' + (on ? ' on' : ''), onclick: function () {
            var i = f.days.indexOf(d); if (i === -1) f.days.push(d); else if (f.days.length > 1) f.days.splice(i, 1); paint();
          } }, FB.i18n.dayShort(d));
        })));
        if (f.action === 'on') {
          el.appendChild(ui.seg(MODES.map(function (m) { return { v: m, label: modeLabel(m) }; }), f.mode, function (v) { f.mode = v; paint(); }));
          el.appendChild(h('div', { class: 'recur-row' }, h('span', { class: 'recur-lbl' }, t('ac.s.temp')),
            ui.stepper(f.temp || 23, 16, 30, function (n) { f.temp = n; }), h('span', { class: 'recur-lbl' }, '°C')));
        }
        el.appendChild(h('div', { class: 'ac-form-actions' },
          x && x.id ? h('button', { type: 'button', class: 'btn danger ghost', onclick: function () { del(x); } }, ui.icon('trash', 18), ' ', t('common.delete')) : null,
          h('span', { class: 'grow' }),
          h('button', { type: 'button', class: 'btn ghost', onclick: function () { editing = null; draw(); } }, t('common.cancel')),
          h('button', { type: 'button', class: 'btn', onclick: function () { save(f); } }, t('common.save'))));
      }
      paint();
      return el;
    }
    function draw() {
      U.clear(box);
      box.appendChild(h('div', { class: 'ac-sched-head' }, h('h3', null, t('ac.s.title')), h('span', { class: 'grow' }),
        editing ? null : h('button', { type: 'button', class: 'link-btn', onclick: function () { editing = 'new'; draw(); } }, ui.icon('plus', 16), ' ', t('ac.s.add'))));
      if (editing === 'new') box.appendChild(form(null));
      if (!loaded) { box.appendChild(h('p', { class: 'muted' }, '…')); return; }
      if (!list.length && editing !== 'new') box.appendChild(h('p', { class: 'muted' }, t('ac.s.empty')));
      list.forEach(function (x) {
        if (editing === x.id) { box.appendChild(form(x)); return; }
        var sw = h('button', { type: 'button', class: 'mini-sw' + (x.enabled ? ' on' : ''), role: 'switch', 'aria-checked': x.enabled ? 'true' : 'false', 'aria-label': t('ac.s.title'),
          onclick: function (e) { e.stopPropagation(); save(Object.assign({}, x, { enabled: !x.enabled })); } }, h('i'));
        box.appendChild(h('div', { class: 'ac-s-row' + (x.enabled ? '' : ' paused'), role: 'button', tabindex: '0', onclick: function () { editing = x.id; draw(); } },
          h('b', { class: 'ac-s-at' }, x.at), h('span', { class: 'ac-s-main' }, h('span', null, what(x)), dots(x.days)), sw));
      });
    }
    draw(); load();
    return box;
  }

  AC.open = function () {
    var body = h('div', { class: 'ac-pop' }), modal, poll;
    function draw() {
      U.clear(body);
      var s = st.s, on = !!s.switch;
      var power = h('button', { type: 'button', class: 'ac-power' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', 'aria-label': on ? t('ac.off') : t('ac.on'),
        onclick: function () { AC.set('switch', !on); } }, ui.icon('power', 34));
      body.appendChild(h('div', { class: 'ac-top' }, power, h('div', { class: 'ac-state' },
        h('b', null, on ? t('ac.on') : t('ac.off')), h('span', null, s.temp_current != null ? t('ac.room', { n: s.temp_current }) : ''))));
      if (!st.online) body.appendChild(h('p', { class: 'form-err', role: 'alert' }, t('ac.offline')));
      var temp = Number(s.temp_set || 24);
      function step(d) { var n = Math.max(16, Math.min(30, temp + d)); if (n !== temp) AC.set('temp_set', n); }
      body.appendChild(h('div', { class: 'ac-temp' },
        h('button', { type: 'button', class: 'ac-step', 'aria-label': '−', onclick: function () { step(-1); } }, ui.icon('minus', 26)),
        h('div', { class: 'ac-big' }, String(temp), h('small', null, '°C')),
        h('button', { type: 'button', class: 'ac-step', 'aria-label': '+', onclick: function () { step(1); } }, ui.icon('plus', 26))));
      body.appendChild(ui.field(t('ac.mode'), ui.seg(MODES.map(function (m) { return { v: m, label: modeLabel(m) }; }), s.mode, function (v) { AC.set('mode', v); })));
      body.appendChild(ui.field(t('ac.fan'), ui.seg(FANS.map(function (f) { return { v: f, label: t('ac.f.' + f) }; }), s.fan_speed_enum, function (v) { AC.set('fan_speed_enum', v); })));
      body.appendChild(ui.field(t('ac.sleep'), ui.seg([{ v: false, label: t('ac.off') }, { v: true, label: t('ac.on') }], !!s.sleep, function (v) { AC.set('sleep', v); })));
    }
    var fn = function () {
      if (!document.body.contains(body)) { listeners = listeners.filter(function (x) { return x !== fn; }); return; }
      var f = document.activeElement;
      if (f && body.contains(f) && f.tagName !== 'BUTTON') return;
      draw();
    };
    listeners.push(fn); draw();
    var wrap = h('div', { class: 'ac-wrap' }, body, schedules());
    modal = ui.modal({ title: t('ac.title'), body: wrap, focus: false, onClose: function () { clearInterval(poll); } });
    AC.refresh(true);
    poll = setInterval(function () { if (!document.body.contains(body)) { clearInterval(poll); return; } AC.refresh(true); }, 6000);
  };
})(typeof window !== 'undefined' ? window : globalThis);
