/* Sign-in and first-time setup (only used when Supabase is configured). */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  var A = (FB.auth = {});

  function shell(inner) {
    var app = document.getElementById('app');
    U.clear(app);
    app.className = 'auth-shell';
    app.appendChild(h('div', { class: 'auth' },
      h('div', { class: 'auth-brand' }, h('h1', null, t('app.name')), h('p', null, t('auth.tagline'))),
      h('div', { class: 'auth-form' }, inner)));
  }

  function langSwitch() {
    return h('div', { class: 'auth-lang' }, ui.seg([{ v: 'en', label: 'English' }, { v: 'sq', label: 'Shqip' }], FB.device.lang, function (v) {
      FB.device.lang = v; FB.saveDevice(); FB.i18n.set(v); A.show(A.current);
    }));
  }

  function busy(btn, p) {
    btn.disabled = true;
    return p.then(function (r) { btn.disabled = false; return r; }, function (e) { btn.disabled = false; throw e; });
  }

  /* status: 'auth' | 'onboard' */
  A.show = function (status) {
    A.current = status;
    if (status === 'onboard') return onboard();
    signIn();
  };

  function signIn() {
    var mode = 'in';
    var email = h('input', { type: 'email', autocomplete: 'email', placeholder: t('auth.email'), inputmode: 'email' });
    var pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: t('auth.password') });
    var err = h('p', { class: 'form-err', role: 'alert' });
    var info = h('p', { class: 'hint' });
    var go = h('button', { type: 'submit', class: 'btn big' }, t('auth.signIn'));
    var seg = ui.seg([{ v: 'in', label: t('auth.signIn') }, { v: 'up', label: t('auth.signUp') }], mode, function (v) {
      mode = v; go.textContent = v === 'in' ? t('auth.signIn') : t('auth.signUp');
      pw.setAttribute('autocomplete', v === 'in' ? 'current-password' : 'new-password'); err.textContent = ''; info.textContent = v === 'up' ? t('auth.pwHint') : '';
    });
    var form = h('form', { class: 'form', onsubmit: function (ev) {
      ev.preventDefault(); err.textContent = '';
      var e = email.value.trim(), p = pw.value;
      if (!e || !p) { err.textContent = t('auth.needBoth'); return; }
      var op = mode === 'in' ? FB.store.signIn(e, p).then(function () { return 'ok'; }) : FB.store.signUp(e, p).then(function (r) { return r.needsConfirm ? 'confirm' : 'ok'; });
      busy(go, op).then(function (r) {
        if (r === 'confirm') { info.textContent = t('auth.checkEmail'); return null; }
        return FB.app.afterAuth();
      }).catch(function (x) { err.textContent = t(FB.storeLib.errorKey(x)); });
    } }, seg, email, pw, info, err, go);
    shell([form, langSwitch()]);
  }

  function onboard() {
    var mode = 'create', color = ui.COLORS[0];
    var name = h('input', { type: 'text', placeholder: t('auth.yourName'), maxlength: '30' });
    var hname = h('input', { type: 'text', placeholder: t('auth.householdName'), value: t('auth.householdDefault'), maxlength: '40' });
    var code = h('input', { type: 'text', placeholder: t('auth.code'), maxlength: '10', style: { textTransform: 'uppercase' }, autocapitalize: 'characters' });
    var err = h('p', { class: 'form-err', role: 'alert' });
    var go = h('button', { type: 'submit', class: 'btn big' }, t('auth.create'));
    var createBox = h('div', null, ui.field(t('auth.householdName'), hname));
    var joinBox = h('div', { style: { display: 'none' } }, ui.field(t('auth.code'), code, t('auth.codeHint')));
    var seg = ui.seg([{ v: 'create', label: t('auth.modeCreate') }, { v: 'join', label: t('auth.modeJoin') }], mode, function (v) {
      mode = v; createBox.style.display = v === 'create' ? '' : 'none'; joinBox.style.display = v === 'join' ? '' : 'none';
      go.textContent = v === 'create' ? t('auth.create') : t('auth.join'); err.textContent = '';
    });
    var form = h('form', { class: 'form', onsubmit: function (ev) {
      ev.preventDefault(); err.textContent = '';
      var n = name.value.trim();
      if (!n) { err.textContent = t('member.needName'); return; }
      var op;
      if (mode === 'create') op = FB.store.createHousehold({ householdName: hname.value.trim() || t('auth.householdDefault'), name: n, color: color, emoji: '' });
      else { if (!code.value.trim()) { err.textContent = t('err.code'); return; } op = FB.store.joinHousehold({ code: code.value, name: n, color: color, emoji: '' }); }
      busy(go, op).then(function () { FB.app.enter(); }).catch(function (x) { err.textContent = t(FB.storeLib.errorKey(x)); });
    } }, h('p', { class: 'lead' }, t('auth.welcome')), seg,
      ui.field(t('auth.yourName'), name), ui.field(t('member.color'), ui.swatches(ui.COLORS, color, function (c) { color = c; })),
      createBox, joinBox, err, go);
    shell([form, langSwitch(), h('button', { class: 'link-btn', onclick: function () { FB.app.signOut(); } }, t('set.signOut'))]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
