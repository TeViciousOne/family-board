// Spotify remote with a mocked Spotify: sign-in (PKCE), the tile, controls, errors, refresh, phone tile, disconnect.
// Run: NODE_PATH=<playwright> node tests/spotify.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123/';
let failures = 0;
function ok(c, m) { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const track = (o) => Object.assign({ is_playing: true, progress_ms: 30000, item: { name: 'Ndarja', duration_ms: 200000, artists: [{ name: 'Alban Skenderaj' }, { name: 'Ledi' }], album: { images: [{ url: 'https://i.scdn.co/big.jpg', width: 640 }, { url: 'https://i.scdn.co/small.jpg', width: 64 }] } }, device: { name: 'Pixel', volume_percent: 40, supports_volume: true } }, o || {});

(async () => {
  const browser = await chromium.launch({ ...(require('fs').existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {}), args: ['--no-sandbox'] });
  for (const phone of [false, true]) {
    const tag = phone ? '[phone] ' : '[wall] ';
    const ctx = await browser.newContext(phone ? { colorScheme: process.env.SCHEME || 'light', serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-GB' } : { colorScheme: process.env.SCHEME || 'light', serviceWorkers: 'block', viewport: { width: 1280, height: 800 }, locale: 'en-GB', timezoneId: 'Europe/Tirane' });
    const p = await ctx.newPage(); const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(([ph]) => { if (sessionStorage.getItem('sp.init')) return; sessionStorage.setItem('sp.init', '1'); localStorage.setItem('fb.device.v1', JSON.stringify({ lang: 'en', kind: ph ? 'phone' : 'wall', kindAsked: true, nightOn: false, homeIdle: false, calm: false, wall: !ph, nativeEmoji: true })); }, [phone]);
    await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"",SUPABASE_ANON_KEY:""};' }));
    await p.route(/fonts\.(googleapis|gstatic)\.com|open-meteo|\/functions\//, r => r.abort());
    await p.route(/i\.scdn\.co/, r => r.fulfill({ contentType: 'image/png', body: PNG }));
    const calls = []; let player = { status: 200, body: track() }, cmdStatus = 204, tokenBodies = [], force401 = 0;
    let authUrl = null;
    await p.route(/accounts\.spotify\.com\/authorize/, r => { const u = new URL(r.request().url()); authUrl = u; r.fulfill({ status: 302, headers: { location: BASE + '?code=abc123&state=' + u.searchParams.get('state') } }); });
    await p.route(/accounts\.spotify\.com\/api\/token/, r => { const b = new URLSearchParams(r.request().postData()); tokenBodies.push(Object.fromEntries(b)); const refresh = b.get('grant_type') === 'refresh_token'; r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(Object.assign({ access_token: refresh ? 'AT2' : 'AT1', expires_in: 3600, scope: 'x' }, refresh ? {} : { refresh_token: 'RT1' })) }); });
    await p.route(/api\.spotify\.com\/v1\//, r => {
      const req = r.request(), u = new URL(req.url()), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      calls.push(req.method() + ' ' + u.pathname + u.search + ' [' + (req.headers().authorization || '') + ']');
      if (u.pathname === '/v1/me/player' && req.method() === 'GET') {
        if (force401 > 0) { force401--; return r.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{"error":{"status":401,"message":"expired"}}' }); }
        return player.status === 204 ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(player.body) });
      }
      return cmdStatus === 204 ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ status: cmdStatus, headers: cors, contentType: 'application/json', body: '{"error":{"message":"x"}}' });
    });
    await p.goto(BASE); await p.waitForSelector('.home .col');

    /* 1. not connected: no tile; Settings shows the setup block */
    ok(!(await p.locator('.sp-tile, .pt-sp').count()), tag + 'no tile before connecting');
    await p.evaluate(() => FB.app.go('settings')); await p.waitForSelector('.settings');
    const row = p.locator('.set-menu .row[data-topic=home]');
    if (await row.count()) await row.click();
    await p.waitForSelector('.sp-set', { timeout: 4000 }).catch(() => {});
    ok(await p.locator('.sp-set input').count() === 1 && /connect spotify/i.test(await p.locator('.sp-set .btn').first().innerText()), tag + 'settings shows Client ID + Connect');
    ok((await p.locator('.sp-uri').innerText()).startsWith(BASE.replace(/\/$/, '')), tag + 'settings shows the redirect address to register');

    /* 2. connect: PKCE redirect, code exchange */
    await p.locator('.sp-set input').fill('CLIENTID123');
    await Promise.all([p.waitForURL(/\/#|\/$|\/\?/).catch(() => {}), p.locator('.sp-set .btn').first().click()]);
    await p.waitForSelector('.home .col', { timeout: 8000 });
    await p.waitForTimeout(900);
    ok(authUrl && authUrl.searchParams.get('code_challenge_method') === 'S256' && authUrl.searchParams.get('client_id') === 'CLIENTID123' && /user-modify-playback-state/.test(authUrl.searchParams.get('scope')) && authUrl.searchParams.get('redirect_uri') === BASE, tag + 'authorize request is PKCE with the right client, scope and redirect');
    ok(tokenBodies[0] && tokenBodies[0].grant_type === 'authorization_code' && tokenBodies[0].code === 'abc123' && tokenBodies[0].code_verifier && tokenBodies[0].code_verifier.length >= 43 && !tokenBodies[0].client_secret, tag + 'code is exchanged with a verifier and no secret');
    ok(await p.evaluate(() => location.search === ''), tag + 'the code is removed from the address bar');

    /* 3. the tile shows what is playing */
    const sel = phone ? '.pt-sp' : '.sp-tile';
    await p.waitForSelector(sel, { timeout: 6000 }).catch(() => {});
    ok(await p.locator(sel).count() === 1, tag + 'tile appears when something is playing');
    const shot = (n) => process.env.SHOTS ? p.screenshot({ path: process.env.SHOTS + '/spotify-' + (phone ? 'phone' : 'wall') + '-' + n + '.png' }) : null;
    await p.waitForTimeout(500); await shot('home');
    const txt = await p.locator(sel).innerText();
    ok(/Ndarja/.test(txt) && /Alban Skenderaj, Ledi/.test(txt), tag + 'title and artists are shown');
    ok(calls.some(c => /GET \/v1\/me\/player \[Bearer AT1\]/.test(c)), tag + 'player is read with the access token');

    /* 4. controls (open the player sheet on the phone) */
    if (phone) { await p.locator(sel).tap(); await p.waitForSelector('.sp-modal'); }
    const scope = phone ? '.sp-modal' : '.sp-tile';
    const mainBtn = p.locator(scope + ' .sp-btn.main');
    ok((await mainBtn.getAttribute('aria-label')) === 'Pause', tag + 'play/pause button says Pause while playing');
    await mainBtn.click(); await p.waitForTimeout(150);
    ok((await mainBtn.getAttribute('aria-label')) === 'Play', tag + 'button flips at once (optimistic)');
    ok(calls.some(c => /PUT \/v1\/me\/player\/pause/.test(c)), tag + 'pause is sent');
    player = { status: 200, body: track({ is_playing: false }) };
    await p.locator(scope + ' .sp-btn[aria-label="Next song"]').click(); await p.waitForTimeout(150);
    ok(calls.some(c => /POST \/v1\/me\/player\/next/.test(c)), tag + 'next is sent');
    await p.locator(scope + ' .sp-btn[aria-label="Previous song"]').click(); await p.waitForTimeout(150);
    ok(calls.some(c => /POST \/v1\/me\/player\/previous/.test(c)), tag + 'previous is sent');
    const rect = await p.locator(scope + ' .sp-btn.main').boundingBox();
    ok(rect.width >= 44 && rect.height >= 44, tag + 'main button is at least 44 px');

    /* 5. the sheet: volume */
    if (!phone) { await p.locator('.sp-tile .sp-info').click(); await p.waitForSelector('.sp-modal'); }
    await p.locator('.sp-modal input[type=range]').fill('70'); await p.waitForTimeout(500);
    ok(calls.some(c => /PUT \/v1\/me\/player\/volume\?volume_percent=70/.test(c)), tag + 'volume is sent');
    ok(/Pixel/.test(await p.locator('.sp-dev').innerText()), tag + 'sheet says where it plays');
    await shot('sheet');
    await p.evaluate(() => { if (FB.ui.closeAllModals) FB.ui.closeAllModals(); });

    /* 6. an error from Spotify is explained, not silent */
    cmdStatus = 404; player = { status: 200, body: track() };
    await p.evaluate(() => FB.spotify.next()); await p.waitForTimeout(400);
    ok(/open spotify on a device/i.test(await p.locator('.toast').last().innerText().catch(() => '')), tag + 'no device: friendly message');
    cmdStatus = 204;

    /* 7. expired access token: refreshed once, then it carries on */
    await p.evaluate(() => { const k = 'fb.sp.v1', d = JSON.parse(localStorage.getItem(k)); d.tok.exp = 0; localStorage.setItem(k, JSON.stringify(d)); });
    await p.reload(); await p.waitForSelector('.home .col'); await p.waitForTimeout(1200);
    ok(tokenBodies.some(b => b.grant_type === 'refresh_token' && b.refresh_token === 'RT1' && b.client_id === 'CLIENTID123'), tag + 'expired token is refreshed with the refresh token');
    ok(calls.some(c => /\[Bearer AT2\]/.test(c)), tag + 'the new token is used');
    force401 = 1; const before = tokenBodies.length;
    await p.evaluate(() => FB.spotify.refresh(true)); await p.waitForTimeout(700);
    ok(tokenBodies.length === before + 1, tag + 'a 401 triggers one refresh and a retry');

    /* 8. nothing playing: the tile goes away */
    player = { status: 204 };
    await p.evaluate(() => FB.spotify.refresh(true)); await p.waitForTimeout(500);
    ok(await p.locator(sel).count() === 0 || await p.locator(sel).first().isHidden(), tag + 'tile hides when nothing is playing');

    /* 9. disconnect */
    player = { status: 200, body: track() };
    await p.evaluate(() => FB.app.go('settings')); await p.waitForSelector('.settings');
    const row2 = p.locator('.set-menu .row[data-topic=home]'); if (await row2.count()) await row2.click();
    await p.waitForSelector('.sp-set');
    ok(/spotify is connected/i.test(await p.locator('.sp-set .hint').first().innerText()), tag + 'settings shows connected');
    await p.locator('.sp-set .btn.ghost').click(); await p.waitForTimeout(200);
    ok(await p.locator('.sp-set input').count() === 1, tag + 'disconnect returns to setup');
    ok(await p.evaluate(() => !JSON.parse(localStorage.getItem('fb.sp.v1') || '{}').tok), tag + 'login is forgotten');

    /* 10. a redirect with the wrong state is ignored */
    await p.goto(BASE + '?code=evil&state=nope'); await p.waitForSelector('.home .col'); await p.waitForTimeout(500);
    ok(!(await p.evaluate(() => FB.spotify.connected())), tag + 'a code with a wrong state is not accepted');
    ok(!errors.length, tag + 'no JS errors' + (errors.length ? ': ' + errors[0] : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
