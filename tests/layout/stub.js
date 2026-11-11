module.exports = () => {
  const KEY = 'stubdb';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (Math.random() * 16 | 0).toString(16));
  let db = load();
  if (!db) {
    const hh = 'h1', me = 'm1', today = new Date().toISOString().slice(0, 10);
    const P = window.__profile || {};
    const R = (s) => ({ freq: 'daily', interval: 1, weekdays: [], monthMode: 'dom', dom: 1, nth: 1, nthDay: 1, start: s || '2026-01-01', until: null });
    const M = [['m1','Andi','#2F86D0','🦥'],['m2','Ledia','#E8573F','🦋'],['m3','Lori','#8B54B0','🥸'],['m4','Shpia','#F0A818','🏠']].map(x => ({ id: x[0], household_id: hh, user_id: x[0] === 'm1' ? 'u1' : null, name: x[1], color: x[2], emoji: x[3], created_at: new Date().toISOString() }));
    const CH = [['Fshij me fshesë elektrike','🧹','m2','09:00'],['Shtupa','🧹','m3',null],['Gatuaj darkën','🍳','m1','19:00'],['Hekuros rrobat e javës','👕','m2',null],['Laj enët','🍽️','m3','21:00'],['Lani rrobat','🧺','m2',null],['Nxirr plehrat','🗑️','m1','20:00'],['Ujit lulet në ballkon','🪴',null,null],['Pastro banjën','🛁','m4',null],['Ushqe macen','🐈','m3','08:00']].slice(0, P.chores == null ? 6 : P.chores);
    const ymd = (d) => d.toISOString().slice(0, 10), add = (n) => ymd(new Date(Date.now() + n * 864e5));
    db = { households: [{ id: hh, name: 'Home', code: 'ABC123' }], members: M,
      chores: CH.map((c, i) => ({ id: 'c' + i, household_id: hh, title: c[0], emoji: c[1], member_id: c[2], rule: R(), due_time: c[3], active: true, created_at: new Date().toISOString() })),
      chore_completions: (P.done ? CH.slice(0, P.done) : []).map((c, i) => ({ id: 'cc' + i, household_id: hh, chore_id: 'c' + i, on_date: today, done_by: 'm2', done_at: new Date().toISOString() })),
      events: P.noEvents ? [] : [
        { id: 'e1', household_id: hh, kind: 'event', title: 'Takim me prindërit në shkollë', on_date: add(2), start_time: '16:30', all_day: false, member_id: 'm2', rule: null, remind_minutes: null, created_at: '' },
        { id: 'e2', household_id: hh, kind: 'birthday', title: 'Alan', on_date: '2023-' + add(7).slice(5), start_time: null, all_day: true, member_id: null, rule: null, remind_minutes: null, created_at: '' },
        { id: 'e3', household_id: hh, kind: 'event', title: 'Dentisti', on_date: add(0), start_time: '23:30', all_day: false, member_id: 'm1', rule: null, remind_minutes: null, created_at: '' },
        { id: 'e4', household_id: hh, kind: 'countdown', title: 'GTA 6', on_date: add(8), start_time: null, all_day: true, member_id: null, rule: null, remind_minutes: null, created_at: '' },
        { id: 'e5', household_id: hh, kind: 'event', title: 'Darka familjare te gjyshja', on_date: add(4), start_time: '19:30', all_day: false, member_id: 'm4', rule: null, remind_minutes: null, created_at: '' }],
      shopping_items: (P.shop == null ? ['Shapka leshi','Qumësht','Bukë','Vezë','Detergjent për rroba'] : P.shop).map((t, i) => ({ id: 's' + i, household_id: hh, title: t, done: false, added_by: 'm2', created_at: new Date().toISOString(), done_at: null })),
      notes: P.notes === 0 ? [] : [{ id: 'n1', household_id: hh, body: 'Kthehem në 18:00, darka është në furrë.', author: 'm2', pinned: false, created_at: new Date().toISOString() }, { id: 'n2', household_id: hh, body: 'Hidraulikun e presim të enjten në mëngjes.', author: 'm1', pinned: false, created_at: new Date().toISOString() }] };
    localStorage.setItem(KEY, JSON.stringify(db));
  }
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  window.__log = []; window.__calls = [];
  const netErr = () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } });
  function from(t) {
    const q = { t, op: 'select', f: [], row: null, patch: null, single: false };
    const b = {
      select() { return b; }, order() { return b; }, limit() { return b; }, gte() { return b; },
      eq(c, v) { q.f.push([c, v]); return b; },
      insert(r) { q.op = 'insert'; q.row = r; return b; }, update(p) { q.op = 'update'; q.patch = p; return b; }, delete() { q.op = 'delete'; return b; },
      single() { q.single = true; return b; }, maybeSingle() { q.single = true; return b; },
      then(res, rej) {
        return Promise.resolve().then(() => {
          if (window.__net === false) return netErr();
          const rows = (db[t] || []).filter(r => q.f.every(([c, v]) => r[c] === v));
          if (q.op === 'insert') {
            if ((db[t] || []).some(r => r.id === q.row.id)) return { data: null, error: { code: '23505', message: 'duplicate' } };
            db[t].push(q.row); save(); window.__log.push(['insert', t, q.row.id]); return { data: q.row, error: null };
          }
          if (q.op === 'update') { rows.forEach(r => Object.assign(r, q.patch)); save(); window.__log.push(['update', t]); return { data: q.single ? rows[0] : rows, error: null }; }
          if (q.op === 'delete') { db[t] = db[t].filter(r => !rows.includes(r)); save(); window.__log.push(['delete', t]); return { data: null, error: null }; }
          return { data: q.single ? (rows[0] || null) : rows, error: null };
        }).then(res, rej);
      }
    };
    return b;
  }
  const user = { id: 'u1', email: 'andi@familyboard.app' };
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => window.__net === false ? { data: { session: null }, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } } : { data: { session: { user } }, error: null }, signOut: async () => ({}) },
    from, rpc: async () => ({ data: null, error: null }),
    functions: { invoke: async (name, o) => {
      if (name === 'news') return { data: { ok: true, data: { items: [{ s: 'euronews', t: 'UEFA Nations League, Kombëtarja mbyll përgatitjet në stadiumin Air Albania, gati për sfidën ndaj Finlandës', l: 'https://euronews.al/a', ts: 1 }, { s: 'top', t: 'Top Channel headline one that is long enough', l: 'https://top-channel.tv/2026/11/09/x/', ts: 1 }], oil: { wti: { p: 61.2, c: 1.4 }, brent: { p: 65.05, c: -0.3 } } } }, error: null };
      if (name === 'ac') {
        window.__ac = window.__ac || { switch: false, temp_set: 24, temp_current: 21, mode: 'hot', fan_speed_enum: 'auto', sleep: false }; window.__acCalls = window.__acCalls || [];
        window.__acCalls.push(o.body);
        window.__sched = window.__sched || [];
        if (o.body.action === 'schedules') return { data: { ok: true, data: { schedules: window.__sched } }, error: null };
        if (o.body.action === 'schedule_save') { const x = Object.assign({ id: 's' + (window.__sched.length + 1) }, o.body.schedule); window.__sched = window.__sched.filter(y => y.id !== x.id).concat([x]); return { data: { ok: true, data: { schedules: window.__sched } }, error: null }; }
        if (o.body.action === 'status') return { data: { ok: true, data: { online: true, status: Object.keys(window.__ac).map(k => ({ code: k, value: window.__ac[k] })) } }, error: null };
        if (o.body.action === 'set') { o.body.commands.forEach(c => { window.__ac[c.code] = c.value; }); return { data: { ok: true }, error: null }; }
      }
      window.__calls.push(o.body); const a = o.body.action; if (a === 'summary') return { data: { ok: true, data: { text: 'Sot pasdite pritet shi, ndaj kujdesuni të fshini e pastroni shtëpinë, të gatuani darkën, të lani enët e rrobat dhe të bëni pazar.' } }, error: null }; if (a === 'tidy') return { data: { ok: true, data: window.__tidy(o.body.items) }, error: null }; return { data: null, error: { message: 'x' } }; } },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}
  }) };
};
