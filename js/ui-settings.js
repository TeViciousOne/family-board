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
            saveDevice(); FB.app.loadWeather(true); FB.app.render();
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
        cb.checked = !cb.checked; cb.disabled = false;
        ui.toast(t(e && e.message === 'denied' ? 'push.denied' : 'push.failed'), { kind: 'error' });
      });
    } });
    s.appendChild(h('div', { class: 'toggle' }, h('label', { class: 'check' }, cb, h('span', null, t('push.on')))));
    FB.push.status().then(function (on) { cb.checked = !!on; cb.disabled = false; }, function () { cb.disabled = false; });
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

  /* ---------- this device ---------- */
  function deviceSection() {
    var s = section(t('set.device'));
    s.appendChild(toggle(t('set.wall'), FB.device.wall, function (v) {
      FB.device.wall = v; if (v && FB.device.askWho === 'never') FB.device.askWho = 'always'; saveDevice(); FB.app.render();
    }, t('set.wallHint')));
    s.appendChild(ui.field(t('set.askWho'), ui.seg([
      { v: 'always', label: t('set.ask.always') }, { v: 'unassigned', label: t('set.ask.unassigned') }, { v: 'never', label: t('set.ask.never') }
    ], FB.device.askWho, function (v) { FB.device.askWho = v; saveDevice(); }), t('set.askWhoHint')));
    s.appendChild(toggle(t('set.reload4'), FB.device.reload4, function (v) { FB.device.reload4 = v; saveDevice(); }, t('set.reload4Hint')));
    s.appendChild(ui.field(t('set.language'), ui.seg([{ v: 'en', label: 'English' }, { v: 'sq', label: 'Shqip' }], FB.device.lang, function (v) {
      FB.device.lang = v; saveDevice(); FB.app.render();
    })));
    return s;
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
    s.appendChild(h('p', { class: 'lead' }, t('set.signedInAs', { email: FB.store.userEmail() })));
    s.appendChild(h('div', { class: 'btn-row' },
      h('button', { class: 'btn ghost', onclick: function () { FB.auth.openChangePassword(); } }, t('pw.change')),
      h('button', { class: 'btn ghost', onclick: function () { FB.auth.makeRecovery(true); } }, t('rc.open'))));
    s.appendChild(h('p', { class: 'hint' }, t('rc.settingsHint')));
    s.appendChild(h('button', { class: 'btn ghost', onclick: function () { FB.app.signOut(); } }, ui.icon('logout', 20), ' ', t('set.signOut')));
    return s;
  }

  /* settings: a menu of topics; each opens on its own page */
  var page = null;
  function topics() {
    var out = [
      ['family', 'home', t('set.family'), familySection],
      ['account', 'user', t('set.account'), accountSection],
      ['weather', 'sun', t('set.weather'), weatherSection]
    ];
    if (FB.push && FB.push.supported()) out.push(['push', 'bell', t('push.title'), pushSection]);
    out.push(['sound', 'sound', t('set.sound'), soundSection], ['night', 'moon', t('set.night'), nightSection], ['device', 'phone', t('set.device'), deviceSection]);
    return out;
  }
  FB.views.settings = function () {
    var list = topics(), cur = list.filter(function (x) { return x[0] === page; })[0];
    if (cur) {
      return h('div', { class: 'page settings set-page', 'data-scroll': 'page-settings-' + cur[0] },
        h('div', { class: 'page-head' },
          h('button', { type: 'button', class: 'btn ghost', onclick: function () { page = null; FB.app.render(); } }, ui.icon('left', 20), ' ', t('nav.settings')),
          h('h1', null, cur[2])),
        h('div', { class: 'set-one' }, cur[3]()));
    }
    return h('div', { class: 'page settings', 'data-scroll': 'page-settings' },
      h('div', { class: 'page-head' }, h('h1', null, t('nav.settings'))),
      h('div', { class: 'list set-menu' }, list.map(function (x) {
        return h('button', { type: 'button', class: 'row', onclick: function () { page = x[0]; FB.app.render(); } },
          h('span', { class: 'row-ico' }, ui.icon(x[1], 24)),
          h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, x[2])),
          ui.icon('right', 20));
      })));
  };
})(typeof window !== 'undefined' ? window : globalThis);
