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
    functions: { invoke: async (name, o) => {
      if (name === 'ac') {
        window.__ac = window.__ac || { switch: false, temp_set: 24, temp_current: 21, mode: 'hot', fan_speed_enum: 'auto', sleep: false }; window.__acCalls = window.__acCalls || [];
        window.__acCalls.push(o.body);
        if (o.body.action === 'status') return { data: { ok: true, data: { online: true, status: Object.keys(window.__ac).map(k => ({ code: k, value: window.__ac[k] })) } }, error: null };
        if (o.body.action === 'set') { o.body.commands.forEach(c => { window.__ac[c.code] = c.value; }); return { data: { ok: true }, error: null }; }
      }
      window.__calls.push(o.body); const a = o.body.action; if (a === 'summary') return { data: { ok: true, data: { text: 'Dentist at 16:30 and two chores left.' } }, error: null }; if (a === 'tidy') return { data: { ok: true, data: window.__tidy(o.body.items) }, error: null }; return { data: null, error: { message: 'x' } }; } },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}
  }) };
};
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { const k = 'fb.device.v1'; const d = JSON.parse(localStorage.getItem(k) || '{}'); d.nightOn = false; d.homeIdle = false; localStorage.setItem(k, JSON.stringify(d)); } catch (e) {} });
  await p.route(/fonts\.g|open-meteo/, r => r.abort());
  await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"k"};' }));
  await p.addInitScript(stub);
  await p.addInitScript(() => {
    window.__tidy = (items) => ({ items: items.map(i => ({ id: i.id, title: i.title.charAt(0).toUpperCase() + i.title.slice(1), category: /milk|qum/i.test(i.title) ? 'dairy' : 'other' })), merge: [[items[0].id, items[1].id]] });
  });
  await p.goto('http://localhost:8123/'); await p.waitForSelector('.list-grid .chore');
  ok(await p.locator('.ai-pill').count() === 0, 'no quick-add button on the home screen');
  await p.waitForSelector('.ai-sum', { timeout: 8000 });
  ok((await p.locator('.ai-sum').innerText()).includes('Dentist at 16:30'), 'daily summary line shows');
  /* air conditioner */
  await p.waitForSelector('.ac-tile', { state: 'visible', timeout: 8000 });
  ok((await p.locator('.ac-tile .ac-st').innerText()) === 'Off' && (await p.locator('.ac-tile .ac-deg').innerText()) === '21°', 'AC tile shows off and the room temperature');
  if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/ac-home.png' });
  await p.click('.ac-tile'); await p.waitForSelector('.ac-pop .ac-power');
  await p.click('.ac-pop .ac-power'); await p.click('.ac-pop .ac-step >> nth=1'); await p.click('.ac-pop .ac-step >> nth=1'); await p.waitForTimeout(900);
  const ac1 = await p.evaluate(() => window.__ac);
  ok(ac1.switch === true && ac1.temp_set === 26, 'AC power on and temperature raised to 26 (' + JSON.stringify(ac1) + ')');
  await p.locator('.ac-pop .seg-b', { hasText: 'Cool' }).click(); await p.waitForTimeout(900);
  ok((await p.evaluate(() => window.__ac.mode)) === 'cold', 'AC mode set to cool');
  ok((await p.evaluate(() => window.__acCalls.filter(c => c.action === 'set').length)) === 2, 'quick taps were sent as one request');
  if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/ac-pop.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  /* tidy */
  await p.evaluate(async () => { for (const t of ['milk', 'Milk 1L', 'eggs']) await FB.data.add('shopping_items', { title: t, done: false, added_by: null, created_at: new Date().toISOString(), done_at: null }); });
  await p.evaluate(() => location.hash = '#/lists'); await p.waitForSelector('.ai-tidy');
  await p.click('.ai-tidy'); await p.waitForTimeout(1200);
  const db2 = await p.evaluate(() => JSON.parse(localStorage.getItem('stubdb')));
  ok(db2.shopping_items.length === 2 && db2.shopping_items.every(x => x.category), 'tidy merged a duplicate and sorted the rest (' + db2.shopping_items.map(x => x.title + ':' + x.category).join(', ') + ')');
  ok(await p.locator('.shop-cat').count() >= 2, 'shopping list shows category headings');
  const calls = await p.evaluate(() => window.__calls.map(c => c.action));
  ok(calls.includes('summary') && calls.includes('tidy') && !calls.includes('quick'), 'summary and tidy calls were made, no quick add');
  ok(errs.length === 0, 'no JS errors ' + errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
