/* Offline mode test with a stubbed Supabase client. Run: NODE_PATH=<playwright> node tests/offline.js */
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
  window.__log = [];
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
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}
  }) };
};
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'allow' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.g|open-meteo/, r => r.abort());
  await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"k"};' }));
  await p.addInitScript(stub);
  await p.goto('http://localhost:8123/'); await p.waitForSelector('.list-grid .chore');
  await p.waitForTimeout(1500); await p.reload(); await p.waitForSelector('.list-grid .chore'); await p.waitForTimeout(1500); /* second load goes through the service worker so it is cached; let the snapshot be saved and the service worker cache the files */
  ok(await p.evaluate(() => !!localStorage.getItem('fb.cache.v1')), 'a snapshot is saved for offline use');

  /* go offline, complete the chore */
  await p.evaluate(() => { window.__net = false; });
  await ctx.setOffline(true);
  await p.click('.list-grid .chore'); await p.waitForTimeout(600);
  const who = p.locator('.who'); if (await who.count()) await who.first().click();
  await p.waitForTimeout(500);
  ok(await p.locator('.list-grid .chore.done').count() === 1, 'chore shows as done while offline');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('fb.outbox.v1') || '[]').length) === 1, 'the change is queued');
  ok((await p.locator('#sync').innerText()).toLowerCase().includes('offline'), 'banner says offline: ' + (await p.locator('#sync').innerText()));
  ok(await p.evaluate(() => window.__log.length) === 0, 'nothing reached the server yet');

  /* reload while offline: opens from the saved copy */
  await p.reload(); await p.waitForSelector('.list-grid .chore', { timeout: 8000 });
  ok(await p.locator('.list-grid .chore').count() === 1, 'app opens offline from saved data');

  /* back online: queue uploads */
  await p.evaluate(() => { window.__net = true; });
  await ctx.setOffline(false);
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('fb.outbox.v1') || '[]').length === 0, null, { timeout: 8000 });
  const server = await p.evaluate(() => JSON.parse(localStorage.getItem('stubdb')).chore_completions.length);
  ok(server === 1, 'queued change reached the server once (' + server + ')');
  ok(await p.locator('.list-grid .chore.done').count() === 1, 'chore still done after sync');
  ok(errs.length === 0, 'no JS errors ' + errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
