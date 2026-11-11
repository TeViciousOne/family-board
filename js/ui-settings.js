/* Settings: family members, weather place, language, sound, night screen, this device, account. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, L = FB.logic, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  FB.views = FB.views || {};
  FB.actions = FB.actions || {};

  function section(title, hint) {
    var s = h('section', { class: 'set' }, h('h2', null, title));
    if (hint) s.appendChild(h('p', { class: 'hint' }, hint));
    return s;
  }
  function toggle(label, value, onChange, hint) {
    var cb = h('input', { type: 'checkbox', checked: !!value, onchange: function () { onChange(cb.checked); } });
    return h('div', { class: 'toggle' }, h('label', { class: 'check' }, cb, h('span', null, label)), hint ? h('p', { class: 'hint' }, hint) : null);
  }
  function saveDevice() { FB.saveDevice(); FB.app.applyDevice(); }

  /* ---------- members ---------- */
  FB.actions.openMember = function (existing) {
    var isNew = !existing;
    var m = existing ? Object.assign({}, existing) : { name: '', color: ui.COLORS[FB.state.members.length % ui.COLORS.length], emoji: '' };
    var modal, color = m.color, emoji = m.emoji || '';
    var name = h('input', { type: 'text', value: m.name, placeholder: t('member.namePh'), maxlength: '30' });
    var err = h('p', { class: 'form-err', role: 'alert' });
    function save() {
      var n = name.value.trim();
      if (!n) { err.textContent = t('member.needName'); name.focus(); return; }
      var row = { name: n, color: color, emoji: emoji };
      var p = isNew ? FB.data.add('members', row) : FB.data.edit('members', existing.id, row);
      p.then(function (r) { if (r) modal.close(); });
    }
    var actions = [];
    if (!isNew) {
      actions.push(h('button', { class: 'btn danger ghost', onclick: function () {
        ui.confirm({ title: t('member.deleteQ', { name: existing.name }), text: t('member.deleteHint'), yes: t('common.delete'), danger: true }).then(function (ok) {
          if (ok) FB.data.del('members', existing.id).then(function (r) { if (r) modal.close(); });
        });
      } }, ui.icon('trash', 20), ' ', t('common.delete')));
    }
    actions.push(h('span', { class: 'grow' }));
    actions.push(h('button', { class: 'btn ghost', onclick: function () { modal.close(); } }, t('common.cancel')));
    actions.push(h('button', { class: 'btn', onclick: save }, t('common.save')));
    var body = h('form', { class: 'form', onsubmit: function (ev) { ev.preventDefault(); save(); } },
      ui.field(t('member.name'), name),
      ui.field(t('member.color'), ui.swatches(ui.COLORS, color, function (c) { color = c; })),
      ui.field(t('member.emoji'), ui.emojiGrid(ui.MEMBER_EMOJI, emoji, function (e) { emoji = e; }, true)),
      !isNew && existing.user_id ? h('p', { class: 'hint' }, t('member.hasLogin')) : null,
      !isNew && existing.user_id && existing.id !== FB.state.me ? h('button', { type: 'button', class: 'btn ghost', onclick: function () { FB.auth.openMemberPassword(existing); } }, ui.icon('edit', 20), ' ', t('mp.set')) : null,
      err);
    modal = ui.modal({ title: isNew ? t('member.new') : t('member.edit'), body: body, actions: actions });
  };

  function familySection() {
    var s = section(t('set.family'), t('set.familyHint'));
    var list = h('div', { class: 'list tight' });
    L.membersSorted().forEach(function (m) {
      list.appendChild(h('button', { type: 'button', class: 'row', onclick: function () { FB.actions.openMember(m); } },
        ui.avatar(m, 40),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, m.name),
          m.user_id ? h('span', { class: 'row-sub' }, m.id === FB.state.me ? t('member.you') : t('member.login')) : null),
        ui.icon('edit', 20)));
    });
    s.appendChild(list);
    s.appendChild(h('button', { class: 'btn', onclick: function () { FB.actions.openMember(null); } }, ui.icon('plus', 20), ' ', t('member.add')));
    var hh = FB.state.household || {};
    if (FB.store.mode !== 'demo') {
      var nameIn = h('input', { type: 'text', value: hh.name || '', maxlength: '40', onchange: function () {
        var v = nameIn.value.trim(); if (v) FB.data.updateHousehold({ name: v });
      } });
      s.appendChild(ui.field(t('set.household'), nameIn));
      s.appendChild(h('div', { class: 'invite' },
        h('div', null, h('div', { class: 'hint' }, t('set.inviteCode')), h('div', { class: 'code' }, hh.code || '—')),
        h('button', { class: 'btn ghost', onclick: function () {
          var done = function () { ui.toast(t('set.copied')); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(hh.code || '').then(done, done); else done();
        } }, ui.icon('copy', 20), ' ', t('set.copy'))));
      s.appendChild(h('p', { class: 'hint' }, t('set.inviteHint')));
    }
    return s;
  }

  /* ---------- weather ---------- */
  function weatherSection() {
    var place = FB.device.place || FB.weather.DEFAULT_PLACE;
    var s = section(t('set.weather'));
    s.appendChild(h('p', { class: 'lead' }, t('set.weatherNow', { place: place.name + (place.country ? ', ' + place.country : '') })));
    var results = h('div', { class: 'list tight' });
    var input = h('input', { type: 'text', 'data-fid': 'city', placeholder: t('set.cityPh'), enterkeyhint: 'search' });
    function search() {
      U.clear(results);
      results.appendChild(h('p', { class: 'muted' }, t('wx.loading')));
      FB.weather.searchCity(input.value, FB.device.lang).then(function (rs) {
        U.clear(results);
        if (!rs.length) { results.appendChild(h('p', { class: 'muted' }, t('set.cityNone'))); return; }
        rs.forEach(function (r) {
          results.appendChild(h('button', { type: 'button', class: 'row', onclick: function () {
            FB.device.place = { name: r.name, country: r.country, lat: r.lat, lon: r.lon };
            saveDevice(); FB.app.loadWeather(true); FB.app.render(); if (FB.push && FB.push.resave) FB.push.resave();
          } }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, r.name), h('span', { class: 'row-sub' }, [r.region, r.country].filter(Boolean).join(', ')))));
        });
      });
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    s.appendChild(h('div', { class: 'add-row' }, input, h('button', { class: 'btn', onclick: search }, t('set.citySearch'))));
    s.appendChild(results);
    return s;
  }

  /* ---------- sound ---------- */
  function soundSection() {
    var s = section(t('set.sound'), t('set.soundHint'));
    s.appendChild(toggle(t('set.soundOn'), FB.device.sound, function (v) { FB.device.sound = v; saveDevice(); }));
    var vol = h('input', { type: 'range', min: '10', max: '100', value: String(Math.round(FB.device.volume * 100)), 'aria-label': t('set.volume'),
      oninput: function () { FB.device.volume = Number(vol.value) / 100; FB.sound.volume = FB.device.volume; }, onchange: function () { saveDevice(); } });
    s.appendChild(ui.field(t('set.volume'), vol));
    s.appendChild(h('button', { class: 'btn ghost', onclick: function () { FB.sound.unlock(); FB.sound.test(); } }, ui.icon('bell', 20), ' ', t('set.soundTest')));
    return s;
  }

  /* ---------- phone notifications ---------- */
  function pushSection() {
    var s = section(t('push.title'), t('push.hint'));
    var cb = h('input', { type: 'checkbox', disabled: true, onchange: function () {
      cb.disabled = true;
      (cb.checked ? FB.push.enable() : FB.push.disable()).then(function () { cb.disabled = false; }, function (e) {
        cb.checked = !cb.checked; cb.disabled = false; report('error: ' + (e && (e.name + ' ' + e.message)));
        ui.toast(t(e && e.message === 'denied' ? 'push.denied' : 'push.failed'), { kind: 'error' });
      });
    } });
    s.appendChild(h('div', { class: 'toggle' }, h('label', { class: 'check' }, cb, h('span', null, t('push.on')))));
    s.appendChild(toggle(t('push.wx'), FB.device.wxAlert !== false, function (v) { FB.device.wxAlert = v; FB.saveDevice(); FB.push.resave(); }, t('push.wxHint')));
    var dbg = h('p', { class: 'muted', style: { fontSize: '12px' } }, '…');
    s.appendChild(dbg);
    function report(extra) {
      FB.push.current().then(function (sub) {
        dbg.textContent = 'permission: ' + Notification.permission + ' · subscription: ' + (sub ? 'yes' : 'no') + ' · remembered: ' + (FB.push.wanted() ? 'yes' : 'no') + (extra ? ' · ' + extra : '');
      }, function (e) { dbg.textContent = 'subscription check failed: ' + (e && e.message); });
    }
    FB.push.status().then(function (on) { cb.checked = !!on; cb.disabled = false; report(); }, function (e) { cb.disabled = false; report('error: ' + (e && e.message)); });
    return s;
  }

  /* ---------- night ---------- */
  function nightSection() {
    var s = section(t('set.night'), t('set.nightHint'));
    s.appendChild(toggle(t('set.nightOn'), FB.device.nightOn, function (v) { FB.device.nightOn = v; saveDevice(); }));
    var from = h('input', { type: 'time', value: FB.device.nightFrom, onchange: function () { if (from.value) { FB.device.nightFrom = from.value; saveDevice(); } } });
    var to = h('input', { type: 'time', value: FB.device.nightTo, onchange: function () { if (to.value) { FB.device.nightTo = to.value; saveDevice(); } } });
    s.appendChild(h('div', { class: 'row2' }, ui.field(t('set.nightFrom'), from), ui.field(t('set.nightTo'), to)));
    s.appendChild(h('button', { class: 'btn ghost', onclick: function () { FB.night.sleepNow(); } }, ui.icon('moon', 20), ' ', t('set.sleepNow')));
    return s;
  }

  /* ---------- home screen ---------- */
  function homeSection() {
    var s = section(t('set.homeTitle'), t('home.showHint'));
    FB.widgets.forEach(function (w) {
      if (w === 'ac' && !(FB.ac && FB.ac.enabled())) return;
      s.appendChild(toggle(t('w.' + w), FB.showW(w), function (v) { FB.device.show[w] = v; saveDevice(); }));
    });
    s.appendChild(h('h3', { class: 'set-sub' }, t('set.homeMore')));
    s.appendChild(toggle(t('set.namedays'), FB.device.namedays !== false, function (v) { FB.device.namedays = v; saveDevice(); }, t('set.namedaysHint')));
    s.appendChild(toggle(t('set.calm'), FB.device.calm, function (v) { FB.device.calm = v; saveDevice(); }, t('set.calmHint')));
    s.appendChild(toggle(t('set.homeIdle'), FB.device.homeIdle, function (v) { FB.device.homeIdle = v; saveDevice(); }, t('set.homeIdleHint')));
    return s;
  }

  /* ---------- look ---------- */
  function lookSection() {
    var s = section(t('set.look'));
    s.appendChild(ui.field(t('set.language'), ui.seg([{ v: 'en', label: 'English' }, { v: 'sq', label: 'Shqip' }], FB.device.lang, function (v) {
      FB.device.lang = v; saveDevice(); FB.app.render();
    })));
    s.appendChild(toggle(t('set.lite'), !!FB.device.lite, function (v) { FB.device.lite = v; saveDevice(); FB.app.ambience(new Date()); }, t('set.liteHint')));
    s.appendChild(toggle(t('set.twemoji'), !FB.device.nativeEmoji, function (v) { FB.device.nativeEmoji = !v; saveDevice(); location.reload(); }, t('set.twemojiHint')));
    return s;
  }

  /* ---------- this device ---------- */
  function deviceSection() {
    var s = section(t('set.device'));
    s.appendChild(ui.field(t('dev.kind'), ui.seg([
      { v: 'phone', label: t('dev.phone') }, { v: 'tablet', label: t('dev.tablet') }, { v: 'wall', label: t('dev.wall') }
    ], FB.device.kind, function (v) {
      FB.setKind(v); if (FB.app.applyDevice) FB.app.applyDevice(); FB.app.render();
    }), t('dev.kindHint')));
    s.appendChild(ui.field(t('set.askWho'), ui.seg([
      { v: 'always', label: t('set.ask.always') }, { v: 'unassigned', label: t('set.ask.unassigned') }, { v: 'never', label: t('set.ask.never') }
    ], FB.device.askWho, function (v) { FB.device.askWho = v; saveDevice(); }), t('set.askWhoHint')));
    s.appendChild(toggle(t('set.reload4'), FB.device.reload4, function (v) { FB.device.reload4 = v; saveDevice(); }, t('set.reload4Hint')));
    /* PIN lock for the settings on this device */
    s.appendChild(h('h3', { class: 'set-sub' }, t('pin.title')));
    s.appendChild(h('p', { class: 'hint' }, t('pin.hint')));
    s.appendChild(FB.device.pin
      ? h('div', { class: 'btn-row' },
          h('button', { class: 'btn ghost', onclick: function () { setPin(); } }, t('pin.change')),
          h('button', { class: 'btn ghost danger', onclick: function () { delete FB.device.pin; saveDevice(); FB.app.render(); ui.toast(t('pin.removed')); } }, t('pin.remove')))
      : h('button', { class: 'btn', onclick: function () { setPin(); } }, ui.icon('lock', 20), ' ', t('pin.set')));
    return s;
  }

  /* ---------- connections: weather, air conditioner, AI ---------- */
  function connectionsSection() {
    var s = weatherSection();
    s.querySelector('h2').textContent = t('set.connections');
    s.insertBefore(h('h3', { class: 'set-sub' }, '🌤️ ' + t('set.weather')), s.children[1]);
    if (FB.ac && FB.ac.enabled()) {
      var st = FB.ac.state();
      s.appendChild(h('h3', { class: 'set-sub' }, '❄️ ' + t('ac.title')));
      s.appendChild(h('p', { class: 'lead' }, st.err ? '⚠️ ' + t('about.acErr') : !st.loaded ? '…' : st.online ? '✅ ' + t('about.acOk') : '⚠️ ' + t('ac.offline')));
      s.appendChild(h('button', { class: 'btn ghost', onclick: function () { FB.ac.open(); } }, ui.icon('snow', 20), ' ', t('about.acOpen')));
    }
    if (FB.ai) {
      s.appendChild(h('h3', { class: 'set-sub' }, '✨ ' + t('about.ai')));
      s.appendChild(h('p', { class: 'lead' }, FB.ai.enabled() ? '✅ ' + t('about.aiOk') : t('about.aiOff')));
    }
    return s;
  }

  /* ---------- about ---------- */
  function aboutSection() {
    var s = section(t('about.title'));
    var w = FB.app.weather || {}, st = FB.ac && FB.ac.enabled() ? FB.ac.state() : null;
    var warn = [];
    if (st && (st.err || (st.loaded && !st.online))) warn.push(t('about.acWarn'));
    if (w.stale || (w.fetchedAt && Date.now() - w.fetchedAt > 3 * 3600e3)) warn.push(t('about.wxWarn'));
    if (FB.store.sync && FB.store.sync().dropped) warn.push(t('sync.dropped'));
    warn.forEach(function (x) { s.appendChild(h('p', { class: 'about-warn' }, '⚠️ ' + x)); });
    if (!warn.length) s.appendChild(h('p', { class: 'about-ok' }, '✅ ' + t('about.allOk')));
    function line(k, v) { s.appendChild(h('div', { class: 'about-row' }, h('span', null, k), h('b', null, v))); }
    line(t('about.version'), FB.VERSION || '2026.11');
    line(t('about.sync'), FB.app.syncedAt ? FB.i18n.timeOf(new Date(FB.app.syncedAt).toISOString()) : (FB.store.mode === 'demo' ? t('about.demo') : '—'));
    line(t('about.weather'), w.fetchedAt ? FB.i18n.timeOf(new Date(w.fetchedAt).toISOString()) : '—');
    line(t('about.device'), t('dev.' + (FB.device.kind || 'tablet')));
    return s;
  }

  /* ---------- PIN ---------- */
  var unlockedUntil = 0;
  FB.actions.lockSettings = function () { unlockedUntil = 0; };
  function pinPad(title, onDone, extra) {
    var val = '', dots = h('div', { class: 'pin-dots' }), err = h('p', { class: 'form-err', role: 'alert' });
    function paint() { U.clear(dots); for (var i = 0; i < 4; i++) dots.appendChild(h('i', { class: i < val.length ? 'on' : '' })); }
    function press(d) {
      if (d === 'del') val = val.slice(0, -1); else if (val.length < 4) val += d;
      paint();
      if (val.length === 4) { var v = val; setTimeout(function () { var bad = onDone(v); if (bad) { err.textContent = bad; val = ''; paint(); } }, 120); }
    }
    paint();
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(function (k) {
      return k === '' ? h('span') : h('button', { type: 'button', class: 'pin-key', onclick: function () { press(k); } }, k === 'del' ? ui.icon('left', 22) : k);
    });
    return h('div', { class: 'pin-pad' }, h('h2', null, title), dots, err, h('div', { class: 'pin-keys' }, keys), extra || null);
  }
  function setPin() {
    var first = null, modal;
    var holder = h('div');
    function step() {
      U.clear(holder);
      holder.appendChild(pinPad(first ? t('pin.again') : t('pin.new'), function (v) {
        if (!first) { first = v; step(); return null; }
        if (v !== first) { first = null; step(); return t('pin.mismatch'); }
        FB.device.pin = v; saveDevice(); unlockedUntil = Date.now() + 10 * 60e3; modal.close(); FB.app.render(); ui.toast(t('pin.saved'));
        return null;
      }));
    }
    step();
    modal = ui.modal({ title: t('pin.title'), body: holder, focus: false });
  }
  function lockedView() {
    var forgot = h('button', { type: 'button', class: 'link-btn', onclick: function () {
      var hh = FB.state.household || {};
      var input = h('input', { type: 'text', placeholder: t('set.inviteCode'), maxlength: '12', autocapitalize: 'characters' });
      var m = ui.modal({ title: t('pin.forgot'), body: h('div', { class: 'form' }, h('p', { class: 'hint' }, t('pin.forgotHint')), input), actions: [
        h('button', { class: 'btn ghost', onclick: function () { m.close(); } }, t('common.cancel')),
        h('button', { class: 'btn', onclick: function () {
          if (input.value.trim().toUpperCase() === String(hh.code || 'DEMO').toUpperCase()) { delete FB.device.pin; saveDevice(); m.close(); FB.app.render(); ui.toast(t('pin.removed')); }
          else ui.toast(t('pin.wrongCode'), { kind: 'error' });
        } }, t('pin.unlock'))] });
    } }, t('pin.forgot'));
    return h('div', { class: 'page settings pin-page' }, pinPad(t('pin.enter'), function (v) {
      if (v !== FB.device.pin) return t('pin.wrong');
      unlockedUntil = Date.now() + 10 * 60e3; FB.app.render(); return null;
    }, forgot));
  }

  /* ---------- account ---------- */
  function accountSection() {
    var s = section(t('set.account'));
    var hh = FB.state.household || {};
    if (FB.store.mode === 'demo') {
      s.appendChild(h('p', { class: 'lead' }, t('set.demoInfo')));
      s.appendChild(h('button', { class: 'btn ghost', onclick: function () {
        ui.confirm({ title: t('set.resetQ'), text: t('set.resetHint'), yes: t('set.reset'), danger: true }).then(function (ok) { if (ok) FB.app.resetDemo(); });
      } }, t('set.reset')));
      return s;
    }
    s.appendChild(h('p', { class: 'lead' }, t('set.signedInAs', { email: FB.store.userEmail() })));
    s.appendChild(h('div', { class: 'btn-row' },
      h('button', { class: 'btn ghost', onclick: function () { FB.auth.openChangePassword(); } }, t('pw.change')),
      h('button', { class: 'btn ghost', onclick: function () { FB.auth.makeRecovery(true); } }, t('rc.open'))));
    s.appendChild(h('p', { class: 'hint' }, t('rc.settingsHint')));
    s.appendChild(h('button', { class: 'btn ghost', onclick: function () { FB.app.signOut(); } }, ui.icon('logout', 20), ' ', t('set.signOut')));
    return s;
  }

  /* settings: grouped topics with their current value; tablets show list + detail side by side */
  var page = null;
  function topics() {
    var d = FB.device, place = d.place || FB.weather.DEFAULT_PLACE;
    var shown = FB.widgets.filter(function (w) { return FB.showW(w) && (w !== 'ac' || (FB.ac && FB.ac.enabled())); }).length;
    var total = FB.widgets.filter(function (w) { return w !== 'ac' || (FB.ac && FB.ac.enabled()); }).length;
    var out = [
      ['family', 'home', t('set.family'), familySection, t('set.nMembers', { n: FB.state.members.length })],
      ['home', 'grid', t('set.homeTitle'), homeSection, t('set.nBlocks', { n: shown, total: total })],
      ['notify', 'bell', t('set.notify'), function () {
        var box = h('div');
        if (FB.push && FB.push.supported()) box.appendChild(pushSection());
        box.appendChild(soundSection());
        return box;
      }, [FB.push && FB.push.supported() ? (FB.push.wanted() ? t('set.on') : t('set.off')) : null, t('set.sound') + ': ' + (d.sound ? t('set.on') : t('set.off'))].filter(Boolean).join(' · ')],
      ['night', 'moon', t('set.night'), nightSection, d.nightOn ? d.nightFrom + '–' + d.nightTo : t('set.off')],
      ['look', 'sparkle', t('set.look'), lookSection, (d.lang === 'sq' ? 'Shqip' : 'English') + (d.lite ? ' · ' + t('set.liteShort') : '')],
      ['device', 'phone', t('set.device'), deviceSection, t('dev.' + (d.kind || 'tablet')) + (d.pin ? ' · 🔒' : '')],
      ['connections', 'sun', t('set.connections'), connectionsSection, place.name + (FB.ac && FB.ac.enabled() ? ' · ' + t('ac.title') : '')],
      ['account', 'user', t('set.account'), accountSection, FB.store.mode === 'demo' ? t('about.demo') : (FB.store.userEmail() || '')],
      ['about', 'info', t('about.title'), aboutSection, '']
    ];
    return out;
  }
  function wideNow() { return !!(root.matchMedia && root.matchMedia('(min-width: 900px)').matches); }
  function menu(list, cur) {
    return h('div', { class: 'list set-menu' }, list.map(function (x) {
      return h('button', { type: 'button', class: 'row' + (cur && cur[0] === x[0] ? ' sel' : ''), 'data-topic': x[0], onclick: function () { page = x[0]; FB.app.render(); } },
        h('span', { class: 'row-ico' }, ui.icon(x[1], 24)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, x[2]), x[4] ? h('span', { class: 'row-sub' }, x[4]) : null),
        ui.icon('right', 20));
    }));
  }
  FB.views.settings = function () {
    if (FB.device.pin && Date.now() > unlockedUntil) return lockedView();
    var list = topics(), wide = wideNow();
    var cur = list.filter(function (x) { return x[0] === page; })[0] || (wide ? list[0] : null);
    if (wide) {
      return h('div', { class: 'page settings set-split', 'data-scroll': 'page-settings' },
        h('div', { class: 'set-left' }, h('div', { class: 'page-head' }, h('h1', null, t('nav.settings'))), menu(list, cur)),
        h('div', { class: 'set-right', 'data-scroll': 'page-settings-' + cur[0] }, h('h1', { class: 'set-right-title' }, cur[2]), h('div', { class: 'set-one' }, cur[3]())));
    }
    if (cur) {
      return h('div', { class: 'page settings set-page', 'data-scroll': 'page-settings-' + cur[0] },
        h('div', { class: 'page-head' },
          h('button', { type: 'button', class: 'btn ghost', onclick: function () { page = null; FB.app.render(); } }, ui.icon('left', 20), ' ', t('nav.settings')),
          h('h1', null, cur[2])),
        h('div', { class: 'set-one' }, cur[3]()));
    }
    return h('div', { class: 'page settings', 'data-scroll': 'page-settings' },
      h('div', { class: 'page-head' }, h('h1', null, t('nav.settings'))), menu(list, null));
  };
})(typeof window !== 'undefined' ? window : globalThis);
