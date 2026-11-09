/*
 * Data layer. Two interchangeable stores with the same methods:
 *   DemoStore   keeps everything in this browser's localStorage (used until Supabase is configured)
 *   CloudStore  talks to Supabase: accounts, shared database, live sync
 */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util;
  var S = (FB.storeLib = {});

  /* table name -> key in FB.state */
  S.TABLES = {
    members: 'members',
    chores: 'chores',
    chore_completions: 'completions',
    events: 'events',
    shopping_items: 'shopping',
    notes: 'notes'
  };
  var TABLE_NAMES = Object.keys(S.TABLES);
  var HISTORY_DAYS = 90;

  /* map a technical error to a translation key the UI can show */
  S.errorKey = function (err) {
    var m = String((err && (err.message || err.error_description || err)) || '').toLowerCase();
    if (m.indexOf('invalid login') !== -1) return 'err.login';
    if (m.indexOf('already registered') !== -1 || m.indexOf('already been registered') !== -1) return 'err.exists';
    if (m.indexOf('invalid_code') !== -1) return 'err.code';
    if (m.indexOf('not confirmed') !== -1) return 'err.confirm';
    if (m.indexOf('password') !== -1 && (m.indexOf('least') !== -1 || m.indexOf('short') !== -1 || m.indexOf('weak') !== -1)) return 'err.password';
    if (m.indexOf('failed to fetch') !== -1 || m.indexOf('network') !== -1 || m.indexOf('load failed') !== -1) return 'err.network';
    if (m.indexOf('valid email') !== -1 || m.indexOf('invalid email') !== -1 || m.indexOf('unable to validate email') !== -1) return 'err.email';
    return 'err.generic';
  };

  /* ====================================================================== */
  /*  Demo store                                                            */
  /* ====================================================================== */
  function DemoStore() {
    var KEY = 'fb.demo.v1';
    var listeners = [];
    var db = null;

    function seed() {
      var t = U.today();
      var d = function (n) { return U.addDays(t, n); };
      var now = new Date();
      var ago = function (days, hh, mm) { var x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hh, mm); return x.toISOString(); };
      var A = U.uid(), B = U.uid(), C = U.uid();
      var chore = function (title, emoji, member, rule, time) {
        return { id: U.uid(), household_id: 'demo', title: title, emoji: emoji, member_id: member, rule: Object.assign(FB.recur.defaultRule(d(-30)), rule), due_time: time || null, active: true, created_at: new Date().toISOString() };
      };
      var chores = [
        chore('Feed the cat', '🐈', null, { freq: 'daily' }, '08:00'),
        chore('Take out the trash', '🗑️', B, { freq: 'daily' }, '19:00'),
        chore('Wash the dishes', '🍽️', C, { freq: 'daily' }, '21:00'),
        chore('Vacuum the living room', '🧹', A, { freq: 'weekly', weekdays: [1, 4] }),
        chore('Water the plants', '🪴', C, { freq: 'daily', interval: 3 }),
        chore('Laundry', '🧺', null, { freq: 'weekly', weekdays: [6] }),
        chore('Clean the bathroom', '🚿', B, { freq: 'monthly', monthMode: 'nth', nth: 2, nthDay: 6 }),
        chore('Pay the internet bill', '💳', A, { freq: 'monthly', monthMode: 'dom', dom: 5 })
      ];
      var done = function (c, daysAgo, who, hh, mm) {
        return { id: U.uid(), household_id: 'demo', chore_id: c.id, on_date: d(-daysAgo), done_by: who, done_at: ago(daysAgo, hh, mm) };
      };
      var comps = [
        done(chores[0], 0, A, 7, 52), done(chores[1], 1, B, 19, 20), done(chores[2], 1, C, 21, 40),
        done(chores[0], 1, B, 8, 10), done(chores[3], 3, A, 18, 5), done(chores[5], 2, C, 11, 30)
      ];
      var ev = function (title, kind, date, st, member, rule, extra) {
        return Object.assign({ id: U.uid(), household_id: 'demo', title: title, kind: kind, on_date: date, end_date: null, all_day: !st, start_time: st || null, end_time: null, member_id: member || null, rule: rule || null, remind_minutes: null, birth_year: null, notes: '' }, extra || {});
      };
      var events = [
        ev('Dentist', 'event', d(2), '16:30', A, null, { remind_minutes: 30, end_time: '17:15' }),
        ev('Family dinner', 'event', d((7 - U.weekday(t)) % 7 || 7), '19:30', null, { freq: 'weekly', weekdays: [0], interval: 1, start: d(-60), until: null }),
        ev('Cara\'s birthday', 'birthday', d(9), null, C, { freq: 'yearly', interval: 1, start: d(9) }, { birth_year: 2014 }),
        ev('Sea holiday', 'countdown', d(41), null, null, null),
        ev('Parent meeting', 'event', d(5), '18:00', B, null, { remind_minutes: 60 })
      ];
      var shop = ['Milk', 'Bread', 'Tomatoes', 'Coffee'].map(function (s, i) {
        return { id: U.uid(), household_id: 'demo', title: s, done: i === 3, added_by: i % 2 ? A : B, created_at: new Date(now - i * 60000).toISOString(), done_at: null };
      });
      var notes = [
        { id: U.uid(), household_id: 'demo', body: 'Back at 6. Dinner is in the oven.', author: B, pinned: true, created_at: ago(0, 9, 5) },
        { id: U.uid(), household_id: 'demo', body: 'Plumber comes Thursday morning.', author: A, pinned: false, created_at: ago(1, 20, 15) }
      ];
      return {
        household: { id: 'demo', name: 'Home', code: 'DEMO42' },
        members: [
          { id: A, household_id: 'demo', user_id: null, name: 'Ana', color: '#E8573F', emoji: '', created_at: new Date(now - 3000).toISOString() },
          { id: B, household_id: 'demo', user_id: null, name: 'Ben', color: '#2F86D0', emoji: '', created_at: new Date(now - 2000).toISOString() },
          { id: C, household_id: 'demo', user_id: null, name: 'Cara', color: '#4FA36B', emoji: '', created_at: new Date(now - 1000).toISOString() }
        ],
        me: A,
        chores: chores, chore_completions: comps, events: events, shopping_items: shop, notes: notes
      };
    }

    function load() {
      try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
      if (!db) { db = seed(); save(); }
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage full */ } }
    function emit(table) { listeners.forEach(function (fn) { fn(table); }); }

    root.addEventListener('storage', function (e) {
      if (e.key === KEY) { load(); TABLE_NAMES.forEach(emit); }
    });

    return {
      mode: 'demo',
      init: function () { load(); return Promise.resolve('ready'); },
      me: function () { return db.me; },
      userEmail: function () { return ''; },
      signIn: function () { return Promise.resolve(); },
      signUp: function () { return Promise.resolve({ needsConfirm: false }); },
      signOut: function () { return Promise.resolve(); },
      createHousehold: function () { return Promise.resolve(); },
      joinHousehold: function () { return Promise.resolve(); },
      loadAll: function () {
        var out = { household: db.household };
        TABLE_NAMES.forEach(function (t) { out[S.TABLES[t]] = JSON.parse(JSON.stringify(db[t] || [])); });
        return Promise.resolve(out);
      },
      loadTable: function (t) { return Promise.resolve(JSON.parse(JSON.stringify(db[t] || []))); },
      insert: function (t, row) {
        var r = Object.assign({ household_id: 'demo' }, row);
        if (t === 'chore_completions') {
          var dup = db[t].some(function (c) { return c.chore_id === r.chore_id && c.on_date === r.on_date; });
          if (dup) return Promise.reject(new Error('duplicate key'));
        }
        db[t].push(r); save(); return Promise.resolve(r);
      },
      update: function (t, id, patch) {
        var row = db[t].filter(function (x) { return x.id === id; })[0];
        if (!row) return Promise.reject(new Error('not found'));
        Object.assign(row, patch); save(); return Promise.resolve(row);
      },
      remove: function (t, id) {
        db[t] = db[t].filter(function (x) { return x.id !== id; });
        if (t === 'chores') db.chore_completions = db.chore_completions.filter(function (c) { return c.chore_id !== id; });
        if (t === 'members') {
          ['chores'].forEach(function (k) { db[k].forEach(function (x) { if (x.member_id === id) x.member_id = null; }); });
          db.chore_completions.forEach(function (x) { if (x.done_by === id) x.done_by = null; });
          db.events.forEach(function (x) { if (x.member_id === id) x.member_id = null; });
        }
        save(); return Promise.resolve();
      },
      updateHousehold: function (patch) { Object.assign(db.household, patch); save(); return Promise.resolve(db.household); },
      subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
      reset: function () { db = seed(); save(); TABLE_NAMES.forEach(emit); return Promise.resolve(); }
    };
  }

  /* ====================================================================== */
  /*  Cloud store (Supabase)                                                */
  /* ====================================================================== */
  function CloudStore(cfg) {
    var sb = null, hid = null, meId = null, user = null, listeners = [], channel = null;

    function loadLib() {
      if (root.supabase && root.supabase.createClient) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload = resolve;
        s.onerror = function () { reject(new Error('Failed to fetch supabase library')); };
        document.head.appendChild(s);
      });
    }
    function check(res) { if (res.error) throw res.error; return res.data; }

    function findMe() {
      return sb.from('members').select('*').eq('user_id', user.id).maybeSingle().then(check).then(function (m) {
        if (!m) return 'onboard';
        hid = m.household_id; meId = m.id; return 'ready';
      });
    }

    function startRealtime() {
      if (channel) return;
      channel = sb.channel('family-board')
        .on('postgres_changes', { event: '*', schema: 'public' }, function (payload) {
          listeners.forEach(function (fn) { fn(payload.table); });
        })
        .subscribe();
    }

    return {
      mode: 'cloud',
      init: function () {
        return loadLib().then(function () {
          sb = root.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
          return sb.auth.getSession();
        }).then(function (res) {
          var session = res.data && res.data.session;
          if (!session) return 'auth';
          user = session.user;
          return findMe().then(function (st) { if (st === 'ready') startRealtime(); return st; });
        });
      },
      me: function () { return meId; },
      userEmail: function () { return user ? user.email : ''; },

      signIn: function (email, password) {
        return sb.auth.signInWithPassword({ email: email, password: password }).then(check).then(function (d) { user = d.user; });
      },
      signUp: function (email, password) {
        return sb.auth.signUp({ email: email, password: password }).then(check).then(function (d) {
          if (!d.session) return { needsConfirm: true };
          user = d.user; return { needsConfirm: false };
        });
      },
      signOut: function () {
        if (channel) { sb.removeChannel(channel); channel = null; }
        user = null; hid = null; meId = null;
        return sb.auth.signOut();
      },
      /* after sign-in: returns 'ready' or 'onboard' */
      afterAuth: function () { return findMe().then(function (st) { if (st === 'ready') startRealtime(); return st; }); },

      createHousehold: function (o) {
        return sb.rpc('create_household', { h_name: o.householdName, m_name: o.name, m_color: o.color, m_emoji: o.emoji || '' })
          .then(check).then(function () { return findMe(); }).then(function (st) { startRealtime(); return st; });
      },
      joinHousehold: function (o) {
        return sb.rpc('join_household', { h_code: String(o.code).trim().toUpperCase(), m_name: o.name, m_color: o.color, m_emoji: o.emoji || '' })
          .then(check).then(function () { return findMe(); }).then(function (st) { startRealtime(); return st; });
      },

      loadAll: function () {
        var since = U.addDays(U.today(), -HISTORY_DAYS);
        var q = function (t) {
          var b = sb.from(t).select('*');
          if (t === 'chore_completions') b = b.gte('on_date', since);
          if (t === 'notes') b = b.order('created_at', { ascending: false }).limit(60);
          else b = b.order(t === 'chore_completions' ? 'done_at' : 'created_at', { ascending: true });
          return b.then(check);
        };
        return Promise.all([
          sb.from('households').select('*').eq('id', hid).single().then(check),
          Promise.all(TABLE_NAMES.map(q))
        ]).then(function (r) {
          var out = { household: r[0] };
          TABLE_NAMES.forEach(function (t, i) { out[S.TABLES[t]] = r[1][i]; });
          return out;
        });
      },
      loadTable: function (t) {
        var b = sb.from(t).select('*');
        if (t === 'chore_completions') b = b.gte('on_date', U.addDays(U.today(), -HISTORY_DAYS));
        if (t === 'notes') b = b.order('created_at', { ascending: false }).limit(60);
        else b = b.order(t === 'chore_completions' ? 'done_at' : 'created_at', { ascending: true });
        return b.then(check);
      },
      insert: function (t, row) {
        return sb.from(t).insert(Object.assign({}, row, { household_id: hid })).select().single().then(check);
      },
      update: function (t, id, patch) {
        return sb.from(t).update(patch).eq('id', id).select().single().then(check);
      },
      remove: function (t, id) { return sb.from(t).delete().eq('id', id).then(check); },
      updateHousehold: function (patch) { return sb.from('households').update(patch).eq('id', hid).select().single().then(check); },
      subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
      reset: function () { return Promise.resolve(); }
    };
  }

  S.create = function (cfg) {
    cfg = cfg || {};
    if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) return CloudStore(cfg);
    return DemoStore();
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
