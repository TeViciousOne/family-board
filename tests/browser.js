// End-to-end smoke test in a real (headless) Chrome. Run: NODE_PATH=<playwright> node tests/browser.js
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOTS || '/tmp/shots';
require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8123/';

function fakeWeather() {
  const days = [], d0 = new Date();
  for (let i = 0; i < 7; i++) { const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i); days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); }
  return {
    current: { temperature_2m: 14.6, apparent_temperature: 12.8, weather_code: 2, is_day: 1, wind_speed_10m: 9 },
    daily: { time: days, weather_code: [2, 61, 3, 0, 1, 95, 71], temperature_2m_max: [17, 15, 14, 18, 19, 16, 3], temperature_2m_min: [8, 9, 7, 6, 8, 10, -1], precipitation_probability_max: [20, 80, 40, 0, 5, 70, 60] }
  };
}

let failures = 0;
function ok(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; }

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  async function newPage(w, h, opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, locale: 'en-GB', timezoneId: 'Europe/Tirane', hasTouch: false }, opts || {}));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.route('**/api.open-meteo.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeWeather()) }));
    await page.route('**/geocoding-api.open-meteo.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [{ name: 'Durrës', country: 'Albania', admin1: 'Durrës', latitude: 41.3246, longitude: 19.4565 }] }) }));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"",SUPABASE_ANON_KEY:""};' }));
    return { page, ctx, errors };
  }

  /* ---------------- tablet landscape ---------------- */
  const T = await newPage(1280, 800);
  const p = T.page;
  await p.goto(BASE); await p.waitForSelector('.home .col');
  await p.waitForSelector('.wx-temp');
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/01-home.png' });
  ok((await p.locator('.list-grid .chore').count()) === 5 && (await p.locator('.col').count()) === 1, 'home shows one shared chore list with person tags');
  ok((await p.locator('.wx-temp').innerText()).startsWith('15'), 'weather shows rounded current temperature');
  ok((await p.locator('.wx-day').count()) === 5, 'weather shows 5 forecast days');

  // complete a chore (wall device asks who did it)
  const before = await p.locator('.chore.done').count();
  await p.locator('.chore:not(.done)').first().click();
  await p.waitForSelector('.who-grid');
  await p.screenshot({ path: OUT + '/02-who.png' });
  await p.locator('.who').nth(1).click();
  await p.waitForTimeout(200);
  ok((await p.locator('.chore.done').count()) === before + 1, 'tapping a chore + picking a person marks it done');
  ok(await p.locator('.toast-act').count() === 1, 'undo toast appears');
  await p.locator('.toast-act').click();
  await p.waitForTimeout(150);
  ok((await p.locator('.chore.done').count()) === before, 'undo from toast reverses it');

  // done chore info + undo
  await p.locator('.chore.done').first().click();
  await p.waitForSelector('.sheet');
  ok((await p.locator('.sheet .lead').innerText()).includes('Done by'), 'tapping a done chore shows who did it');
  await p.keyboard.press('Escape');

  /* ---------------- calendar ---------------- */
  await p.locator('#nav button[data-route=calendar]').click();
  await p.waitForSelector('.cal-grid');
  await p.waitForTimeout(150);
  await p.screenshot({ path: OUT + '/03-calendar.png' });
  ok((await p.locator('.day').count()) >= 35, 'calendar month grid renders');
  ok((await p.locator('.day.today').count()) === 1, 'today is highlighted');
  await p.locator('.day-panel .btn').click();
  await p.waitForSelector('.sheet form');
  await p.fill('.sheet input[type=text]', 'Piano lesson');
  await p.uncheck('.sheet input[type=checkbox]');
  await p.screenshot({ path: OUT + '/04-event-form.png' });
  await p.locator('.sheet .seg').nth(1).locator('.seg-b', { hasText: 'Weekly' }).click();
  await p.screenshot({ path: OUT + '/05-event-weekly.png' });
  await p.locator('.sheet-actions .btn', { hasText: 'Save' }).click();
  await p.waitForTimeout(250);
  ok((await p.locator('.day-panel .ev.big', { hasText: 'Piano lesson' }).count()) === 1, 'new event appears in the day panel');

  /* ---------------- chores ---------------- */
  await p.locator('#nav button[data-route=chores]').click();
  await p.waitForSelector('.page .row');
  await p.screenshot({ path: OUT + '/06-chores.png' });
  await p.locator('.page-head .btn').click();
  await p.waitForSelector('.sheet form');
  await p.fill('.sheet input[type=text]', 'Mop the kitchen');
  await p.locator('.sheet .seg-b', { hasText: 'Monthly' }).click();
  await p.locator('.sheet .seg-b', { hasText: 'Weekday' }).click();
  await p.screenshot({ path: OUT + '/07-chore-form-monthly.png' });
  const sum = await p.locator('.recur-sum').innerText();
  ok(/Every month, on the .* /.test(sum + ' '), 'repeat summary reads naturally: "' + sum + '"');
  await p.locator('.sheet-actions .btn', { hasText: 'Save' }).click();
  await p.waitForTimeout(250);
  ok((await p.locator('.row', { hasText: 'Mop the kitchen' }).count()) === 1, 'new chore listed');
  await p.locator('.seg-b', { hasText: 'History' }).click();
  await p.waitForTimeout(150);
  await p.screenshot({ path: OUT + '/08-history.png' });
  ok((await p.locator('.row.static').count()) >= 3, 'history lists who completed what');

  /* ---------------- lists ---------------- */
  await p.locator('#nav button[data-route=lists]').click();
  await p.waitForSelector('.lists');
  await p.fill('[data-fid=shop-add]', 'Olive oil');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  ok((await p.locator('.shop', { hasText: 'Olive oil' }).count()) === 1, 'shopping item added with Enter');
  ok((await p.locator('[data-fid=shop-add]').evaluate(e => e === document.activeElement)), 'input keeps focus for the next item');
  await p.fill('[data-fid=note-add]', 'Gas bottle arrives at 5');
  await p.locator('.pane .btn', { hasText: 'Post note' }).click();
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/09-lists.png' });
  ok((await p.locator('.note', { hasText: 'Gas bottle' }).count()) === 1, 'note posted');

  /* ---------------- settings ---------------- */
  await p.locator('#nav button[data-route=settings]').click();
  await p.waitForSelector('.settings');
  await p.screenshot({ path: OUT + '/10-settings.png', fullPage: false });
  await p.locator('.set .btn', { hasText: 'Add family member' }).click();
  await p.fill('.sheet input[type=text]', 'Dritan');
  await p.locator('.sheet-actions .btn', { hasText: 'Save' }).click();
  await p.waitForTimeout(200);
  ok((await p.locator('.set .row', { hasText: 'Dritan' }).count()) === 1, 'family member added in settings');

  /* ---------------- language ---------------- */
  await p.locator('.seg-b', { hasText: 'Shqip' }).click();
  await p.waitForTimeout(200);
  await p.locator('#nav button[data-route=home]').click();
  await p.waitForSelector('.home .col');
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/11-home-sq.png' });
  ok((await p.locator('#nav').innerText()).includes('Kryefaqja'), 'switching to Albanian translates the app');
  await p.locator('#nav button[data-route=calendar]').click();
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/12-calendar-sq.png' });

  /* ---------------- night screen ---------------- */
  await p.locator('#nav button[data-route=home]').click();
  await p.locator('.sleep-btn').click();
  await p.waitForTimeout(250);
  ok(await p.locator('#night.on').count() === 1, 'sleep screen shows');
  await p.screenshot({ path: OUT + '/13-night.png' });
  await p.locator('#night').click();
  await p.waitForTimeout(150);
  ok(await p.locator('#night.on').count() === 0, 'touch wakes the sleep screen');
  ok(T.errors.length === 0, 'no JavaScript errors on tablet' + (T.errors.length ? ': ' + T.errors.join(' | ') : ''));
  await T.ctx.close();

  /* ---------------- phone ---------------- */
  const P = await newPage(390, 844, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const q = P.page;
  await q.goto(BASE); await q.waitForSelector('.home .col'); await q.waitForSelector('.wx-temp');
  await q.waitForTimeout(250);
  await q.screenshot({ path: OUT + '/20-phone-home.png' });
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'phone: no horizontal overflow on home');
  await q.locator('#nav button[data-route=calendar]').tap();
  await q.waitForTimeout(200);
  await q.screenshot({ path: OUT + '/21-phone-calendar.png' });
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'phone: no horizontal overflow on calendar');
  await q.locator('#nav button[data-route=chores]').tap();
  await q.waitForTimeout(200);
  await q.locator('.page-head .btn').tap();
  await q.waitForSelector('.sheet form');
  await q.screenshot({ path: OUT + '/22-phone-chore-form.png' });
  await q.keyboard.press('Escape');
  await q.locator('#nav button[data-route=lists]').tap();
  await q.waitForTimeout(200);
  await q.screenshot({ path: OUT + '/23-phone-lists.png' });
  await q.locator('#nav button[data-route=settings]').tap();
  await q.waitForTimeout(200);
  await q.screenshot({ path: OUT + '/24-phone-settings.png' });
  ok(P.errors.length === 0, 'no JavaScript errors on phone' + (P.errors.length ? ': ' + P.errors.join(' | ') : ''));
  await P.ctx.close();

  /* ---------------- tablet portrait ---------------- */
  const V = await newPage(800, 1280);
  await V.page.goto(BASE); await V.page.waitForSelector('.home .col'); await V.page.waitForSelector('.wx-temp');
  await V.page.waitForTimeout(250);
  await V.page.screenshot({ path: OUT + '/30-portrait-home.png' });
  ok(V.errors.length === 0, 'no JavaScript errors in portrait' + (V.errors.length ? ': ' + V.errors.join(' | ') : ''));
  await V.ctx.close();

  await browser.close();
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
