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
    var deg = h('span', { class: 'ac-deg' }, ''), state = h('b', { class: 'ac-st' }, ''), cap = h('span', { class: 'ac-cap' }, '');
    var btn = h('button', { type: 'button', class: 'ac-tile', onclick: function () { AC.open(); } },
      h('span', { class: 'ac-head' }, h('span', { class: 'ac-ico' }, ui.icon('snow', 26)), h('b', { class: 'ac-name' }, t('ac.title'))),
      h('span', { class: 'ac-body' }, deg, h('span', { class: 'ac-meta' }, state, cap)));
    function paint() {
      var s = st.s, on = AC.on() && st.online;
      btn.style.display = st.loaded ? '' : 'none';
      btn.classList.toggle('on', on);
      if (!st.loaded) return;
      if (!st.online) { deg.textContent = ''; state.textContent = t('ac.offline'); cap.textContent = ''; return; }
      deg.textContent = (on ? s.temp_set : s.temp_current) != null ? (on ? s.temp_set : s.temp_current) + '°' : '';
      state.textContent = on ? t('ac.on') + ' · ' + modeLabel(s.mode) : t('ac.off');
      cap.textContent = on ? t('ac.room', { n: s.temp_current }) : t('ac.roomTemp');
    }
    var fn = function () { if (!document.body.contains(btn)) { listeners = listeners.filter(function (x) { return x !== fn; }); return; } paint(); };
    listeners.push(fn); paint(); AC.refresh();
    return btn;
  };

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
    modal = ui.modal({ title: t('ac.title'), body: body, focus: false, onClose: function () { clearInterval(poll); } });
    AC.refresh(true);
    poll = setInterval(function () { if (!document.body.contains(body)) { clearInterval(poll); return; } AC.refresh(true); }, 6000);
  };
})(typeof window !== 'undefined' ? window : globalThis);
