/* AI features with a stubbed Supabase client and stubbed AI answers. */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const stub = () => {
  const KEY = 'stubdb';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (Math.random() * 16 | 0).toString(16));
  let db = load();
  if (!db) {
    const hh = 'h1', me = 'm1', today = new Date().toISOString().slice(0, 10);
    db = { households: [{ id: hh, name: 'Home', code: 'ABC123' }], members: [{ id: me, household_id: hh, user_id: 'u1', name: 'Andi', color: '#2F86D0', emoji: '', created_at: new Date().toISOString() }],
      chores: [{ id: 'c1', household_id: hh, title: 'Dishes', emoji: '🍽️', member_id: me, rule: { freq: 'daily', interval: 1, weekdays: [], monthMode: 'dom', dom: 1, nth: 1, nthDay: 1, start: '2026-01-01', until: null }, due_time: null, active: true, created_at: new Date().toISOString() }],
      chore_completions: [], events: [], shopping_items: [], notes: [] };
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
    functions: { invoke: async (name, o) => { window.__calls.push(o.body); const a = o.body.action; if (a === 'quick') return { data: { ok: true, data: window.__quick }, error: null }; if (a === 'summary') return { data: { ok: true, data: { text: 'Dentist at 16:30 and two chores left.' } }, error: null }; if (a === 'tidy') return { data: { ok: true, data: window.__tidy(o.body.items) }, error: null }; return { data: null, error: { message: 'x' } }; } },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}
  }) };
};
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.g|open-meteo/, r => r.abort());
  await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"k"};' }));
  await p.addInitScript(stub);
  await p.addInitScript(() => {
    window.__quick = { events: [{ title: 'Dentisti', kind: 'event', date: '2026-11-12', start_time: '16:30', end_time: null, remind_minutes: 60, person: 'Andi', repeat: 'none', weekdays: null }],
      shopping: [{ title: 'Qumësht', category: 'dairy' }, { title: 'Bukë', category: 'bakery' }], chores: [], notes: [], reply: '' };
    window.__tidy = (items) => ({ items: items.map(i => ({ id: i.id, title: i.title.charAt(0).toUpperCase() + i.title.slice(1), category: /milk|qum/i.test(i.title) ? 'dairy' : 'other' })), merge: [[items[0].id, items[1].id]] });
  });
  await p.goto('http://localhost:8123/'); await p.waitForSelector('.list-grid .chore');
  ok(await p.locator('.ai-pill').count() === 1, 'AI button shows in cloud mode');
  await p.waitForSelector('.ai-sum', { timeout: 8000 });
  ok((await p.locator('.ai-sum').innerText()).includes('Dentist at 16:30'), 'daily summary line shows');
  await p.click('.ai-pill'); await p.waitForSelector('.ai-q textarea');
  await p.fill('.ai-q textarea', 'dentisti të enjten në 16:30 dhe blej qumësht e bukë');
  await p.click('.ai-q .btn:not(.ghost)'); await p.waitForSelector('.ai-prop');
  ok(await p.locator('.ai-prop').count() === 3, 'review shows 3 proposals');
  await p.locator('.ai-prop input').nth(1).uncheck();
  await p.click('.ai-q .ai-row .btn:not(.ghost)'); await p.waitForTimeout(800);
  const db = await p.evaluate(() => JSON.parse(localStorage.getItem('stubdb')));
  ok(db.events.some(e => e.title === 'Dentisti' && e.on_date === '2026-11-12' && e.start_time === '16:30' && e.remind_minutes === 60 && e.member_id === 'm1'), 'event saved with date, time, reminder and person');
  ok(db.shopping_items.length === 1 && db.shopping_items[0].title === 'Bukë' && db.shopping_items[0].category === 'bakery', 'only the ticked shopping item saved, with category');
  /* tidy */
  await p.evaluate(async () => { for (const t of ['milk', 'Milk 1L', 'eggs']) await FB.data.add('shopping_items', { title: t, done: false, added_by: null, created_at: new Date().toISOString(), done_at: null }); });
  await p.evaluate(() => location.hash = '#/lists'); await p.waitForSelector('.ai-tidy');
  await p.click('.ai-tidy'); await p.waitForTimeout(1200);
  const db2 = await p.evaluate(() => JSON.parse(localStorage.getItem('stubdb')));
  ok(db2.shopping_items.length === 3 && db2.shopping_items.every(x => x.category), 'tidy merged a duplicate and sorted the rest (' + db2.shopping_items.map(x => x.title + ':' + x.category).join(', ') + ')');
  ok(await p.locator('.shop-cat').count() >= 2, 'shopping list shows category headings');
  const calls = await p.evaluate(() => window.__calls.map(c => c.action));
  ok(calls.includes('quick') && calls.includes('summary') && calls.includes('tidy'), 'all three AI calls were made');
  ok(errs.length === 0, 'no JS errors ' + errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
