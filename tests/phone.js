/* Phone home: "+N more" opens all chores to tick, tiles open read-only details, no "Sot" strip. */
const { chromium } = require('playwright');
const stub = require('./layout/stub.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ ...(require('fs').existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {}), args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'sq-AL', timezoneId: 'Europe/Tirane' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    window.__profile = { chores: 10, done: 0 };
    localStorage.setItem('fb.device.v1', JSON.stringify({ lang: 'sq', kind: 'phone', kindAsked: true, nightOn: false, homeIdle: false, calm: false, nativeEmoji: true,
      show: { weather: true, ac: true, news: true, summary: true, events: true, countdown: true, shopping: true, notes: true } }));
    localStorage.removeItem('stubdb');
  });
  await p.addInitScript(stub);
  await p.route(/fonts\.g|jsdelivr|open-meteo/, r => r.abort());
  await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"k"};' }));
  await p.goto('http://localhost:8123/'); await p.waitForSelector('.list-grid .chore', { timeout: 8000 }).catch(() => console.log('ERRS', errs.join(' / '))); await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  ok((await p.locator('.today-strip').count()) === 0, 'no "Sot" strip on phones');
  ok((await p.locator('.more-chip').count()) === 1, 'hidden chores show a "+N" chip');
  await p.click('.more-chip'); await p.waitForSelector('.pop-chores .chore');
  ok((await p.locator('.pop-chores .chore').count()) === 10, 'the popup lists all 10 chores');
  const before = await p.evaluate(() => FB.state.completions ? FB.state.completions.length : FB.state.chore_completions.length);
  await p.locator('.pop-chores .chore:not(.done)').last().click(); await p.waitForTimeout(700);
  const who = p.locator('.who-grid .who'); if (await who.count()) { await who.first().click(); await p.waitForTimeout(700); }
  ok((await p.locator('.pop-chores .chore.done').count()) === 1, 'a chore can be ticked inside the popup');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelectorAll('#layer .scrim').forEach(s => s.remove()));
  await p.click('.ptile.pt-ev'); await p.waitForSelector('.evi');
  ok((await p.locator('.sheet input, .sheet textarea').count()) === 0 && (await p.locator('.evi-title').count()) === 1, 'event tile opens read-only details, not the edit form');
  if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/phone-event.png' });
  ok(!errs.length, 'no page errors ' + errs.join(' / '));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
