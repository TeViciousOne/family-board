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

  /* password box with a show/hide eye */
  var pwField = A.pwField = function (placeholder, autocomplete) {
    var input = h('input', { type: 'password', autocomplete: autocomplete, placeholder: placeholder, autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' });
    var eye = h('button', { type: 'button', class: 'pw-eye', 'aria-label': t('auth.show') }, ui.icon('eye', 22));
    eye.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      U.clear(eye); eye.appendChild(ui.icon(show ? 'eyeOff' : 'eye', 22));
      eye.setAttribute('aria-label', show ? t('auth.hide') : t('auth.show'));
    });
    return { input: input, el: h('div', { class: 'pw-wrap' }, input, eye) };
  };

  function signIn() {
    var mode = 'in';
    var user = h('input', { type: 'text', autocomplete: 'username', placeholder: t('auth.username'), autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', maxlength: '20' });
    var pw = pwField(t('auth.password'), 'current-password');
    var pw2 = pwField(t('auth.repeat'), 'new-password');
    pw2.el.style.display = 'none';
    var err = h('p', { class: 'form-err', role: 'alert' });
    var info = h('p', { class: 'hint' });
    var go = h('button', { type: 'submit', class: 'btn big' }, t('auth.signIn'));
    var seg = ui.seg([{ v: 'in', label: t('auth.signIn') }, { v: 'up', label: t('auth.signUp') }], mode, function (v) {
      mode = v; go.textContent = v === 'in' ? t('auth.signIn') : t('auth.signUp');
      pw.input.setAttribute('autocomplete', v === 'in' ? 'current-password' : 'new-password');
      pw2.el.style.display = v === 'up' ? '' : 'none'; pw2.input.value = '';
      err.textContent = ''; info.textContent = v === 'up' ? t('auth.userHint') : '';
    });
    var form = h('form', { class: 'form', onsubmit: function (ev) {
      ev.preventDefault(); err.textContent = '';
      var e = FB.storeLib.cleanUsername(user.value), p = pw.input.value;
      if (!e || !p) { err.textContent = t('auth.needBoth'); return; }
      if (mode === 'up') {
        if (!FB.storeLib.validUsername(e)) { err.textContent = t('auth.badUser'); return; }
        if (p.length < 6) { err.textContent = t('err.password'); return; }
        if (p !== pw2.input.value) { err.textContent = t('auth.mismatch'); return; }
      }
      var op = mode === 'in' ? FB.store.signIn(e, p).then(function () { return 'ok'; }) : FB.store.signUp(e, p).then(function (r) {
        return r.needsConfirm ? FB.store.signIn(e, p).then(function () { return 'ok'; }) : 'ok';
      });
      busy(go, op).then(function () { return FB.app.afterAuth(); })
        .catch(function (x) { err.textContent = t(FB.storeLib.errorKey(x)); });
    } }, seg, user, pw.el, pw2.el, info, err, go);
    var forgot = h('button', { type: 'button', class: 'link-btn', onclick: forgotView }, t('pw.forgot'));
    shell([form, forgot, langSwitch()]);
  }

  /* forgot password: username + recovery code -> new password */
  function forgotView() {
    var user = h('input', { type: 'text', autocomplete: 'username', placeholder: t('auth.username'), autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', maxlength: '20' });
    var code = h('input', { type: 'text', placeholder: t('pw.code'), autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false', maxlength: '24', style: { textTransform: 'uppercase', letterSpacing: '.08em' } });
    var pw = pwField(t('pw.new'), 'new-password');
    var pw2 = pwField(t('auth.repeat'), 'new-password');
    var err = h('p', { class: 'form-err', role: 'alert' });
    var go = h('button', { type: 'submit', class: 'btn big' }, t('pw.reset'));
    var form = h('form', { class: 'form', onsubmit: function (ev) {
      ev.preventDefault(); err.textContent = '';
      var u = FB.storeLib.cleanUsername(user.value), c = code.value.trim(), p = pw.input.value;
      if (!u || !c || !p) { err.textContent = t('pw.needAll'); return; }
      if (p.length < 6) { err.textContent = t('err.password'); return; }
      if (p !== pw2.input.value) { err.textContent = t('auth.mismatch'); return; }
      busy(go, FB.store.resetWithCode(u, c, p).then(function (ok) {
        if (!ok) throw new Error('bad_code');
        return FB.store.signIn(u, p);
      })).then(function () { return FB.app.afterAuth(); })
        .then(function () { ui.toast(t('pw.resetDone')); })
        .catch(function (x) { err.textContent = String(x && x.message).indexOf('bad_code') !== -1 ? t('pw.badCode') : t(FB.storeLib.errorKey(x)); });
    } }, h('h2', null, t('pw.resetTitle')), h('p', { class: 'lead' }, t('pw.resetHint')), user, code, pw.el, pw2.el, err, go);
    shell([form, h('button', { type: 'button', class: 'link-btn', onclick: signIn }, t('pw.back')), langSwitch()]);
  }

  /* ---------- password tools used from Settings ---------- */
  function pwForm(o) {
    var cur = o.current ? pwField(t('pw.current'), 'current-password') : null;
    var pw = pwField(t('pw.new'), 'new-password');
    var pw2 = pwField(t('auth.repeat'), 'new-password');
    var err = h('p', { class: 'form-err', role: 'alert' });
    var modal;
    function save() {
      err.textContent = '';
      var p = pw.input.value;
      if ((cur && !cur.input.value) || !p) { err.textContent = t('pw.needAll'); return; }
      if (p.length < 6) { err.textContent = t('err.password'); return; }
      if (p !== pw2.input.value) { err.textContent = t('auth.mismatch'); return; }
      o.run(cur && cur.input.value, p).then(function () { modal.close(); ui.toast(o.done); })
        .catch(function (x) { var k = FB.storeLib.errorKey(x); err.textContent = k === 'err.login' ? t('pw.wrongCurrent') : t(k); });
    }
    modal = ui.modal({
      title: o.title, focus: false,
      body: h('form', { class: 'form', onsubmit: function (ev) { ev.preventDefault(); save(); } },
        o.hint ? h('p', { class: 'lead' }, o.hint) : null,
        cur ? ui.field(t('pw.current'), cur.el) : null, ui.field(t('pw.new'), pw.el), ui.field(t('auth.repeat'), pw2.el), err),
      actions: [h('span', { class: 'grow' }), h('button', { class: 'btn ghost', onclick: function () { modal.close(); } }, t('common.cancel')), h('button', { class: 'btn', onclick: save }, t('common.save'))]
    });
  }
  A.openChangePassword = function () {
    pwForm({ title: t('pw.change'), current: true, done: t('pw.changed'), run: function (c, n) { return FB.store.changePassword(c, n); } });
  };
  A.openMemberPassword = function (m) {
    pwForm({ title: t('mp.set'), hint: t('mp.hint', { name: m.name }), current: false, done: t('mp.done', { name: m.name }), run: function (c, n) { return FB.store.resetMemberPassword(m.id, n); } });
  };

  /* recovery code: shown once */
  A.showRecovery = function (code) {
    var modal = ui.modal({
      title: t('rc.title'), focus: false,
      body: h('div', null, h('p', { class: 'lead' }, t('rc.hint')), h('div', { class: 'invite' }, h('div', { class: 'code rc-code' }, code),
        h('button', { class: 'btn ghost', onclick: function () {
          var done = function () { ui.toast(t('set.copied')); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, done); else done();
        } }, ui.icon('copy', 20), ' ', t('set.copy')))),
      actions: [h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: function () { modal.close(); } }, t('rc.saved'))]
    });
  };
  A.makeRecovery = function (ask) {
    var go = function () { return FB.store.makeRecoveryCode().then(A.showRecovery).catch(function () { ui.toast(t('err.generic'), { kind: 'error' }); }); };
    if (!ask) return go();
    return ui.confirm({ title: t('rc.regenQ'), text: t('rc.regenHint'), yes: t('rc.regen') }).then(function (ok) { if (ok) go(); });
  };

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
      busy(go, op).then(function () { FB.app.enter(); return A.makeRecovery(false); }).catch(function (x) { err.textContent = t(FB.storeLib.errorKey(x)); });
    } }, h('p', { class: 'lead' }, t('auth.welcome')), seg,
      ui.field(t('auth.yourName'), name), ui.field(t('member.color'), ui.swatches(ui.COLORS, color, function (c) { color = c; })),
      createBox, joinBox, err, go);
    shell([form, langSwitch(), h('button', { class: 'link-btn', onclick: function () { FB.app.signOut(); } }, t('set.signOut'))]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
