// Calm screen: the waking tap must not press what is underneath; photos upload and show. Run: NODE_PATH=<playwright> node tests/calm.js
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.SHOTS || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8123/';
let failures = 0;
function ok(c, m) { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; }

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const touch of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, locale: 'en-GB', timezoneId: 'Europe/Tirane', hasTouch: touch, isMobile: false });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(() => { const k = 'fb.device.v1'; const d = JSON.parse(localStorage.getItem(k) || '{}'); d.nightOn = false; d.homeIdle = false; d.calm = true; d.kind = 'tablet'; d.kindAsked = true; localStorage.setItem(k, JSON.stringify(d)); });
    await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"",SUPABASE_ANON_KEY:""};' }));
    await p.route(/fonts\.(googleapis|gstatic)\.com|open-meteo|\/functions\//, r => r.abort());
    await p.goto(BASE); await p.waitForSelector('.home .col');
    const tag = touch ? '[touch] ' : '[mouse] ';

    /* 1. tap-through: put the calm screen up, then tap exactly where the Settings nav button is */
    await p.evaluate(() => FB.calm.preview());
    await p.waitForSelector('#calm.on');
    const box = await p.locator('#nav button[data-route=settings]').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
    await p.waitForTimeout(400);
    ok(!(await p.locator('#calm.on').count()), tag + 'tapping the calm screen closes it');
    ok(await p.evaluate(() => location.hash.indexOf('settings') === -1 && !document.querySelector('.settings')), tag + 'the waking tap does not press the button underneath');
    if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
    await p.waitForTimeout(400);
    ok(await p.locator('.settings').count() > 0, tag + 'the next tap works normally');

    if (!touch) {
      /* 2. photos: upload from Settings → Home screen, then preview */
      const jpg = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 2400; c.height = 1600; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 2400, 1600); gr.addColorStop(0, '#f6a35b'); gr.addColorStop(1, '#2b5876'); g.fillStyle = gr; g.fillRect(0, 0, 2400, 1600); g.fillStyle = '#fff3'; g.beginPath(); g.arc(1700, 500, 260, 0, 7); g.fill(); return c.toDataURL('image/jpeg', 0.9); });
      const f = OUT + '/calm-test.jpg'; fs.writeFileSync(f, Buffer.from(jpg.split(',')[1], 'base64'));
      await p.locator('.set-menu .row[data-topic=home]').click(); await p.waitForTimeout(200);
      ok(await p.locator('.ph-block').count() === 1, 'settings → home screen has a photos block');
      await p.locator('.ph-block input[type=file]').setInputFiles([f, f]);
      await p.waitForFunction(() => document.querySelectorAll('.ph-item').length === 2, null, { timeout: 8000 }).catch(() => {});
      ok(await p.locator('.ph-item').count() === 2, 'two photos uploaded and shown as thumbnails');
      const w = await p.evaluate(() => new Promise(r => { const i = new Image(); i.onload = () => r(Math.max(i.naturalWidth, i.naturalHeight)); i.src = FB.photos.items[0].url; }));
      ok(w === 1920, 'photos are shrunk to 1920 px on upload (got ' + w + ')');
      await p.screenshot({ path: OUT + '/calm-settings.png' });
      await p.locator('.ph-block .btn', { hasText: 'Preview' }).click();
      await p.waitForSelector('#calm.on.photos');
      await p.waitForTimeout(2600);
      ok(await p.locator('#calm .calm-photo.show').count() === 1, 'calm screen shows a photo behind the clock');
      await p.screenshot({ path: OUT + '/calm-photo.png' });
      await p.mouse.click(600, 400); await p.waitForTimeout(600);
      ok(await p.locator('.settings').count() > 0, 'closing the preview stays in settings');
      p.once('dialog', d => d.accept());
      await p.locator('.ph-del').first().click(); await p.waitForTimeout(200);
      const yes = p.locator('.sheet .btn.danger, .modal .btn.danger').first();
      if (await yes.count()) await yes.click();
      await p.waitForTimeout(300);
      ok(await p.locator('.ph-item').count() === 1, 'a photo can be deleted');
      await p.evaluate(() => { FB.device.calmPhotos = false; });
      await p.evaluate(() => FB.calm.preview()); await p.waitForTimeout(300);
      ok(await p.locator('#calm.on:not(.photos)').count() === 1, 'photos can be switched off');
      await p.mouse.click(600, 400);
    }
    ok(!errors.length, tag + 'no JS errors ' + errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
