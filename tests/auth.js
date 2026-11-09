/* Sign-in / sign-up form test with a stubbed Supabase client. Run: NODE_PATH=<playwright> node tests/auth.js */
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 420, height: 800 } })).newPage();
  await p.addInitScript(() => { try { const k = 'fb.device.v1'; const d = JSON.parse(localStorage.getItem(k) || '{}'); d.nightOn = false; d.homeIdle = false; localStorage.setItem(k, JSON.stringify(d)); } catch (e) {} });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.g/, r => r.abort());
  await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"k"};' }));
  await p.addInitScript(() => {
    window.__calls = [];
    window.supabase = { createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: null } }),
        signUp: async a => { window.__calls.push(['signUp', a.email]); return { data: { user: { id: 'u', email: a.email }, session: { } }, error: null }; },
        signInWithPassword: async a => { window.__calls.push(['signIn', a.email]); return { data: { user: { id: 'u', email: a.email } }, error: null }; },
        signOut: async () => ({}),
        updateUser: async a => { window.__calls.push(['updateUser', a.password]); return { data: {}, error: null }; }
      },
      rpc: async (n, a) => { window.__calls.push(['rpc', n, a]); return { data: n === 'reset_with_code' ? true : 'AAAA-BBBB-CCCC-DDDD', error: null }; },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}
    }) };
  });
  await p.goto('http://localhost:8123/'); await p.waitForSelector('.auth-form form');
  ok(await p.locator('input[type=email]').count() === 0, 'no email field');
  ok(await p.locator('.pw-wrap').count() === 2 && !(await p.locator('.pw-wrap').nth(1).isVisible()), 'repeat box hidden when signing in');
  await p.click('.seg-b:nth-child(2)');
  ok(await p.locator('.pw-wrap').nth(1).isVisible(), 'repeat box shown when creating account');
  const inputs = () => p.locator('.auth-form input');
  await p.locator('input[autocomplete=username]').fill('Andi');
  await p.locator('.pw-wrap input').nth(0).fill('secret123');
  await p.locator('.pw-wrap input').nth(1).fill('secret124');
  await p.click('button[type=submit]');
  ok((await p.locator('.form-err').innerText()).toLowerCase().includes('match'), 'mismatch is caught');
  await p.locator('.pw-wrap input').nth(1).fill('secret123');
  await p.locator('input[autocomplete=username]').fill('a b');
  await p.click('button[type=submit]');
  ok((await p.locator('.form-err').innerText()).toLowerCase().includes('username'), 'bad username is caught');
  await p.click('.pw-eye');
  ok(await p.locator('.pw-wrap input').nth(0).getAttribute('type') === 'text', 'eye shows password');
  await p.click('.pw-eye');
  ok(await p.locator('.pw-wrap input').nth(0).getAttribute('type') === 'password', 'eye hides password again');
  await p.locator('input[autocomplete=username]').fill('  Andi.Nokaj ');
  await p.click('button[type=submit]'); await p.waitForTimeout(400);
  const calls = await p.evaluate(() => window.__calls);
  ok(calls.length && calls[0][0] === 'signUp' && calls[0][1] === 'andi.nokaj@familyboard.app', 'sign-up sends lowercase username as internal id: ' + JSON.stringify(calls[0]));
  /* forgot password */
  await p.goto('http://localhost:8123/'); await p.waitForSelector('.auth-form form');
  await p.click('text=Forgot password?'); await p.waitForSelector('text=Reset your password');
  await p.locator('input[autocomplete=username]').fill('Andi');
  await p.locator('input[placeholder="Recovery code"]').fill('aaaa-bbbb-cccc-dddd');
  await p.locator('.pw-wrap input').nth(0).fill('newpass1'); await p.locator('.pw-wrap input').nth(1).fill('newpass2');
  await p.click('button[type=submit]');
  ok((await p.locator('.form-err').innerText()).toLowerCase().includes('match'), 'forgot: mismatch is caught');
  await p.locator('.pw-wrap input').nth(1).fill('newpass1'); await p.click('button[type=submit]'); await p.waitForTimeout(400);
  const c2 = await p.evaluate(() => window.__calls);
  const rc = c2.filter(c => c[0] === 'rpc' && c[1] === 'reset_with_code')[0];
  ok(rc && rc[2].p_username === 'andi' && rc[2].p_code === 'aaaa-bbbb-cccc-dddd' && rc[2].p_new === 'newpass1', 'forgot: sends username, code and new password: ' + JSON.stringify(rc && rc[2]));
  ok(c2.some(c => c[0] === 'signIn' && c[1] === 'andi@familyboard.app'), 'forgot: signs in afterwards');
  ok(errs.length === 0, 'no JS errors ' + errs.join('|'));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
