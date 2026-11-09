/* App core: boot, data operations, routing, rendering, alerts, night screen, weather refresh. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, L = FB.logic, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  var app = (FB.app = { weather: { data: null, loading: false, stale: false, fetchedAt: 0 } });
  FB.actions = FB.actions || {};
  var ROUTES = ['home', 'calendar', 'chores', 'lists', 'settings'];
  var NAV = [['home', 'home', 'nav.home'], ['calendar', 'calendar', 'nav.calendar'], ['chores', 'check', 'nav.chores'], ['lists', 'cart', 'nav.lists'], ['settings', 'gear', 'nav.settings']];

  /* ================================================================ */
  /*  Rendering                                                         */
  /* ================================================================ */
  function route() {
    var r = (root.location.hash || '').replace(/^#\/?/, '').split('/')[0];
    return ROUTES.indexOf(r) === -1 ? 'home' : r;
  }
  app.go = function (name) { if (root.location.hash === '#/' + name) app.render(); else root.location.hash = '#/' + name; };

  var pending = null;
  app.render = function () {
    if (pending) return;
    pending = setTimeout(function () { pending = null; doRender(); }, 0);
  };

  function doRender() {
    var st = FB.state;
    var view = document.getElementById('view');
    if (!st.ready || !view) return;

    var scrolls = {};
    [].forEach.call(view.querySelectorAll('[data-scroll]'), function (el) { scrolls[el.getAttribute('data-scroll')] = el.scrollTop; });
    var ae = document.activeElement, focus = null;
    if (ae && ae.getAttribute && ae.getAttribute('data-fid') && view.contains(ae)) {
      focus = { id: ae.getAttribute('data-fid'), value: ae.value, s: ae.selectionStart, e: ae.selectionEnd };
    }

    var now = new Date();
    var ctx = { now: now, today: U.ymd(now), nowHHMM: U.hhmm(now) };
    var name = route(), node;
    try { node = FB.views[name](ctx); }
    catch (err) {
      if (root.console) console.error(err);
      node = h('pre', { class: 'fatal' }, 'Something went wrong drawing this screen:\n' + (err && err.stack || err));
    }
    U.clear(view);
    view.appendChild(node);
    view.className = 'view view-' + name;

    [].forEach.call(view.querySelectorAll('[data-scroll]'), function (el) {
      var k = el.getAttribute('data-scroll');
      if (scrolls[k] != null) el.scrollTop = scrolls[k];
    });
    if (focus) {
      var el = view.querySelector('[data-fid="' + focus.id + '"]');
      if (el) { el.value = focus.value; el.focus(); try { el.setSelectionRange(focus.s, focus.e); } catch (e) { /* not a text field */ } }
    }
    [].forEach.call(document.querySelectorAll('#nav button'), function (b) {
      var on = b.getAttribute('data-route') === name;
      b.lastChild.textContent = t(b.getAttribute('data-label'));
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.documentElement.setAttribute('data-route', name);
  }

  /* ================================================================ */
  /*  Data operations (optimistic, with rollback)                       */
  /* ================================================================ */
  var TABLES = FB.storeLib.TABLES;
  function arr(table) { return FB.state[TABLES[table]]; }
  function touch() { L.touch(); app.render(); }
  function fail(table, err) {
    if (root.console) console.error(err);
    ui.toast(t(FB.storeLib.errorKey(err) === 'err.generic' ? 'err.save' : FB.storeLib.errorKey(err)), { kind: 'error' });
    return FB.store.loadTable(table).then(function (rows) { FB.state[TABLES[table]] = rows; touch(); }, function () { /* offline */ });
  }

  FB.data = {
    add: function (table, row) {
      row = Object.assign({ id: U.uid() }, row);
      if (table === 'members' && !row.created_at) row.created_at = new Date().toISOString();
      arr(table).push(row); touch();
      return FB.store.insert(table, row).then(function (srv) {
        var a = arr(table);
        for (var i = 0; i < a.length; i++) if (a[i].id === row.id) { a[i] = srv; break; }
        touch(); return srv;
      }).catch(function (e) { return fail(table, e).then(function () { return null; }); });
    },
    edit: function (table, id, patch) {
      var a = arr(table), row = a.filter(function (x) { return x.id === id; })[0];
      if (row) { Object.assign(row, patch); touch(); }
      return FB.store.update(table, id, patch).then(function (srv) {
        var b = arr(table);
        for (var i = 0; i < b.length; i++) if (b[i].id === id) { b[i] = srv; break; }
        touch(); return srv;
      }).catch(function (e) { return fail(table, e).then(function () { return null; }); });
    },
    del: function (table, id) {
      var st = FB.state;
      st[TABLES[table]] = arr(table).filter(function (x) { return x.id !== id; });
      if (table === 'chores') st.completions = st.completions.filter(function (c) { return c.chore_id !== id; });
      if (table === 'members') {
        st.chores.forEach(function (c) { if (c.member_id === id) c.member_id = null; });
        st.completions.forEach(function (c) { if (c.done_by === id) c.done_by = null; });
        st.events.forEach(function (e) { if (e.member_id === id) e.member_id = null; });
      }
      touch();
      return FB.store.remove(table, id).then(function () { return true; })
        .catch(function (e) { return fail(table, e).then(function () { return null; }); });
    },
    updateHousehold: function (patch) {
      Object.assign(FB.state.household, patch); touch();
      return FB.store.updateHousehold(patch).then(function (h2) { FB.state.household = h2; touch(); return h2; })
        .catch(function (e) { if (root.console) console.error(e); ui.toast(t('err.save'), { kind: 'error' }); return null; });
    }
  };

  /* ================================================================ */
  /*  Chore actions                                                     */
  /* ================================================================ */
  function whoFor(chore) {
    var ask = FB.device.askWho;
    if (ask === 'unassigned' && chore.member_id) return chore.member_id;
    return FB.state.me || chore.member_id || null;
  }

  function complete(entry, who, anchor) {
    var c = entry.chore, today = U.today();
    if (anchor) { var m = L.member(who || c.member_id); ui.confetti(anchor, m ? m.color : '#17707A'); }
    FB.sound.done();
    var row = { chore_id: c.id, on_date: today, done_by: who || null, done_at: new Date().toISOString() };
    return FB.data.add('chore_completions', row).then(function (srv) {
      if (!srv) return;
      ui.toast(t('chore.doneToast', { title: c.title }), { action: { label: t('common.undo'), fn: function () { FB.sound.undo(); FB.data.del('chore_completions', srv.id); } } });
    });
  }

  function pickWho(entry, anchor) {
    var c = entry.chore, modal;
    var grid = h('div', { class: 'who-grid' }, L.membersSorted().map(function (m) {
      return h('button', { type: 'button', class: 'who' + (m.id === c.member_id ? ' suggested' : ''), style: { '--c': m.color }, onclick: function () { modal.close(); complete(entry, m.id, anchor); } },
        ui.avatar(m, 64), h('span', null, m.name));
    }));
    if (!FB.state.members.length) { complete(entry, null, anchor); return; }
    modal = ui.modal({
      title: t('chore.whoDid', { title: (c.emoji ? c.emoji + ' ' : '') + c.title }), body: grid, focus: false,
      actions: [h('button', { class: 'btn ghost', onclick: function () { modal.close(); } }, t('common.cancel'))]
    });
  }

  FB.actions.tapChore = function (entry, anchor) {
    FB.sound.unlock();
    var c = entry.chore;
    if (entry.done) {
      var by = L.member(entry.done.done_by), modal;
      modal = ui.modal({
        title: (c.emoji ? c.emoji + ' ' : '') + c.title, focus: false,
        body: h('p', { class: 'lead' }, t('chore.doneBy', { name: by ? by.name : t('chore.someone'), time: FB.i18n.timeOf(entry.done.done_at) })),
        actions: [h('button', { class: 'btn ghost', onclick: function () { modal.close(); } }, t('common.close')),
          h('button', { class: 'btn', onclick: function () { modal.close(); FB.sound.undo(); FB.data.del('chore_completions', entry.done.id); } }, ui.icon('undo', 20), ' ', t('chore.markUndo'))]
      });
      return;
    }
    var ask = FB.device.askWho;
    if (ask === 'always' || (ask === 'unassigned' && !c.member_id)) { pickWho(entry, anchor); return; }
    complete(entry, whoFor(c), anchor);
  };

  /* ================================================================ */
  /*  Weather                                                           */
  /* ================================================================ */
  app.loadWeather = function (force) {
    var place = FB.device.place || FB.weather.DEFAULT_PLACE;
    app.weather.loading = !app.weather.data;
    if (force) app.render();
    return FB.weather.load(place, force).then(function (res) {
      app.weather = { data: res.data, stale: res.stale, fetchedAt: res.fetchedAt, loading: false };
      app.render();
    });
  };

  /* ================================================================ */
  /*  Night screen                                                      */
  /* ================================================================ */
  var night = (FB.night = { awakeUntil: 0, forced: false, el: null });
  night.isNight = function (now) {
    var d = FB.device;
    if (!d.nightOn) return false;
    var m = now.getHours() * 60 + now.getMinutes(), a = U.minutesOf(d.nightFrom), b = U.minutesOf(d.nightTo);
    return a > b ? (m >= a || m < b) : (m >= a && m < b);
  };
  night.sleepNow = function () { night.forced = true; night.update(); };
  night.wake = function () {
    night.forced = false;
    night.awakeUntil = Date.now() + 60000;
    night.update();
  };
  night.update = function () {
    var el = night.el; if (!el) return;
    var now = new Date();
    var sleeping = night.forced || (night.isNight(now) && Date.now() > night.awakeUntil);
    el.classList.toggle('on', sleeping);
    if (!sleeping) return;
    var mins = now.getHours() * 60 + now.getMinutes();
    var clock = el.querySelector('.night-clock');
    clock.textContent = U.hhmm(now);
    clock.style.transform = 'translate(' + ((mins * 37) % 80 - 40) + 'px,' + ((mins * 53) % 60 - 30) + 'px)';
    var w = app.weather.data;
    el.querySelector('.night-sub').textContent = FB.i18n.dateLong(U.ymd(now)) + (w ? ' · ' + Math.round(w.current.temp) + '°' : '');
  };

  /* ================================================================ */
  /*  Alerts: overdue chores and event reminders                        */
  /* ================================================================ */
  var ALERT_KEY = 'fb.alerted.v1';
  function alertState(today) {
    var o; try { o = JSON.parse(localStorage.getItem(ALERT_KEY) || 'null'); } catch (e) { o = null; }
    if (!o || o.day !== today) o = { day: today, keys: {} };
    return o;
  }
  function checkAlerts(now) {
    var st = FB.state; if (!st.ready) return;
    var today = U.ymd(now), nowMin = now.getHours() * 60 + now.getMinutes();
    var o = alertState(today), dirty = false, ring = null;

    L.choresDue(today, U.hhmm(now)).forEach(function (x) {
      if (x.done || x.carried || !x.chore.due_time) return;
      var due = U.minutesOf(x.chore.due_time), k = 'c:' + x.chore.id;
      if (nowMin >= due && !o.keys[k]) {
        o.keys[k] = 1; dirty = true;
        if (nowMin - due <= 30 && !night.isNight(now)) ring = ring || 'overdue';
      }
    });
    L.reminders(today).forEach(function (r) {
      var k = 'e:' + r.event.id;
      if (o.keys[k] || nowMin < r.at) return;
      o.keys[k] = 1; dirty = true;
      if (nowMin < r.start + 5) {
        ring = 'event';
        ui.toast(t('alert.event', { title: r.event.title, when: r.event.start_time }), { ms: 20000, kind: 'alert' });
      }
    });
    if (dirty) { try { localStorage.setItem(ALERT_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } app.render(); }
    if (ring === 'event') FB.sound.event(); else if (ring === 'overdue') FB.sound.overdue();
  }

  /* ================================================================ */
  /*  Device behaviour                                                  */
  /* ================================================================ */
  var wakeLock = null;
  function requestWake() {
    if (!FB.device.wall) { if (wakeLock) { try { wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; } return; }
    if (!root.navigator.wakeLock || wakeLock || document.visibilityState !== 'visible') return;
    root.navigator.wakeLock.request('screen').then(function (l) {
      wakeLock = l; l.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () { /* not allowed right now */ });
  }
  app.applyDevice = function () {
    FB.i18n.set(FB.device.lang);
    FB.sound.enabled = !!FB.device.sound;
    FB.sound.volume = FB.device.volume;
    document.documentElement.lang = FB.device.lang;
    document.title = t('app.name');
    requestWake();
    night.update();
    app.render();
  };

  /* ================================================================ */
  /*  Sync, lifecycle                                                   */
  /* ================================================================ */
  var reloadTables = {}, reloadTimer = null;
  function onRemote(table) {
    reloadTables[table] = 1;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(function () {
      var tables = Object.keys(reloadTables); reloadTables = {};
      tables.forEach(function (tb) {
        if (tb === 'households') {
          FB.store.loadAll().then(function (d) { FB.state.household = d.household; touch(); }, function () {});
          return;
        }
        if (!TABLES[tb]) return;
        var before = tb === 'notes' ? FB.state.notes.map(function (n) { return n.id; }) : null;
        FB.store.loadTable(tb).then(function (rows) {
          FB.state[TABLES[tb]] = rows; touch();
          if (before) {
            rows.filter(function (n) { return before.indexOf(n.id) === -1 && n.author !== FB.state.me; }).slice(0, 1).forEach(function (n) {
              var m = L.member(n.author);
              FB.sound.ping();
              ui.toast((m ? m.name + ': ' : '') + n.body, { ms: 8000, kind: 'info' });
            });
          }
        }, function () { /* offline: keep what we have */ });
      });
    }, 200);
  }

  function showFatal(err) {
    var a = document.getElementById('app');
    U.clear(a); a.className = 'auth-shell';
    if (root.console) console.error(err);
    a.appendChild(h('div', { class: 'auth' }, h('div', { class: 'auth-brand' }, h('h1', null, t('app.name'))),
      h('div', { class: 'auth-form' }, h('p', { class: 'lead' }, t(FB.storeLib.errorKey(err) === 'err.network' ? 'err.network' : 'err.start')),
        h('button', { class: 'btn big', onclick: function () { root.location.reload(); } }, t('common.retry')))));
  }

  var timersStarted = false, lastMinute = -1;
  function startTimers() {
    if (timersStarted) return; timersStarted = true;
    setInterval(function () {
      var now = new Date();
      night.update();
      checkAlerts(now);
      var m = now.getHours() * 60 + now.getMinutes();
      if (m !== lastMinute) {
        lastMinute = m;
        var typing = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-fid');
        if (!typing) app.render();
        if (FB.device.wall && FB.device.reload4 && now.getHours() === 4 && now.getMinutes() < 2) {
          var key = 'fb.reloaded'; var day = U.ymd(now);
          if (sessionStorage.getItem(key) !== day) { sessionStorage.setItem(key, day); root.location.reload(); }
        }
        if (Date.now() - app.weather.fetchedAt > 30 * 60 * 1000) app.loadWeather(false);
      }
    }, 1000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { requestWake(); app.render(); night.update(); } });
    root.addEventListener('online', function () { app.refreshAll(); app.loadWeather(true); });
    document.addEventListener('pointerdown', function () {
      FB.sound.unlock();
      if (night.isNight(new Date()) && !night.el.classList.contains('on')) night.awakeUntil = Math.max(night.awakeUntil, Date.now() + 60000);
    }, true);
    root.addEventListener('hashchange', function () { app.render(); });
  }

  app.refreshAll = function () {
    return FB.store.loadAll().then(function (d) {
      var st = FB.state;
      st.household = d.household;
      Object.keys(TABLES).forEach(function (tb) { st[TABLES[tb]] = d[TABLES[tb]]; });
      touch();
    }, function () { /* offline */ });
  };

  /* enter the app once the store is signed in and has a household */
  app.enter = function () {
    var a = document.getElementById('app');
    return FB.store.loadAll().then(function (d) {
      var st = FB.state;
      st.household = d.household;
      Object.keys(TABLES).forEach(function (tb) { st[TABLES[tb]] = d[TABLES[tb]]; });
      st.me = FB.store.me();
      st.ready = true; L.touch();

      U.clear(a); a.className = '';
      var nav = h('nav', { id: 'nav', 'aria-label': 'Main' }, NAV.map(function (n) {
        return h('button', { type: 'button', 'data-route': n[0], 'data-label': n[2], onclick: function () { app.go(n[0]); } }, ui.icon(n[1], 28), h('span', null, t(n[2])));
      }));
      a.appendChild(h('div', { id: 'view', class: 'view' }));
      a.appendChild(nav);

      FB.store.subscribe(onRemote);
      app.applyDevice();
      app.render();
      app.loadWeather(false);
      startTimers();
      if (FB.store.mode === 'demo' && !localStorage.getItem('fb.demoNote')) {
        try { localStorage.setItem('fb.demoNote', '1'); } catch (e) { /* ignore */ }
        ui.toast(t('app.demoNote'), { ms: 9000, kind: 'info' });
      }
    });
  };

  app.afterAuth = function () {
    return FB.store.afterAuth().then(function (st) {
      if (st === 'ready') return app.enter();
      FB.auth.show('onboard');
    });
  };

  app.signOut = function () {
    FB.store.signOut().then(function () { root.location.reload(); }, function () { root.location.reload(); });
  };
  app.resetDemo = function () { FB.store.reset().then(function () { return app.refreshAll(); }); };

  app.boot = function () {
    FB.i18n.set(FB.device.lang);
    FB.sound.enabled = !!FB.device.sound; FB.sound.volume = FB.device.volume;
    night.el = document.getElementById('night');
    night.el.appendChild(h('div', { class: 'night-clock' }));
    night.el.appendChild(h('div', { class: 'night-sub' }));
    night.el.addEventListener('pointerdown', function (e) { e.stopPropagation(); night.wake(); });
    FB.store = FB.storeLib.create(root.FB_CONFIG || {});
    FB.store.init().then(function (status) {
      if (status === 'ready') return app.enter();
      FB.auth.show(status);
    }).catch(showFatal);
  };

  if ('serviceWorker' in navigator && /^https?:$/.test(root.location.protocol)) {
    root.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ }); });
  }
  document.addEventListener('DOMContentLoaded', function () { app.boot(); });
})(typeof window !== 'undefined' ? window : globalThis);
