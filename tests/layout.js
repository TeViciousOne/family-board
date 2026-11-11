/* Layout audit: every screen size × every home-screen option set. Usage: node tests/layout.js [devices] [profiles] [routes] */
const { chromium } = require('playwright');
const stub = require('./layout/stub.js');
const OUT = process.env.SHOTS || require('os').tmpdir() + '/fb-layout';
require('fs').mkdirSync(OUT, { recursive: true });
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const wx = (() => {
  const t0 = new Date(); t0.setMinutes(0, 0, 0);
  const hourly = { time: [], temperature_2m: [], weather_code: [], precipitation_probability: [], is_day: [] };
  for (let i = -2; i < 48; i++) { const d = new Date(t0.getTime() + i * 36e5); hourly.time.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`); hourly.temperature_2m.push(14 + (i % 6)); hourly.weather_code.push([61, 3, 2, 1, 80, 95][i % 6]); hourly.precipitation_probability.push((i * 13) % 90); hourly.is_day.push(d.getHours() > 6 && d.getHours() < 18 ? 1 : 0); }
  const daily = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [] };
  for (let i = 0; i < 7; i++) { const d = new Date(Date.now() + i * 864e5); daily.time.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`); daily.weather_code.push([61, 3, 95, 2, 1, 80, 71][i]); daily.temperature_2m_max.push(19 + i % 3); daily.temperature_2m_min.push(10 + i % 4); daily.precipitation_probability_max.push(30 + i * 9); }
  return { current: { time: hourly.time[2], temperature_2m: 18.6, apparent_temperature: 17.1, weather_code: 61, is_day: 1, wind_speed_10m: 12 }, hourly, daily, timezone: 'Europe/Tirane' };
})();

const DEV = {
  'iphone-x': { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, kind: 'phone' },
  'iphone-se': { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, kind: 'phone' },
  'android-s25u': { viewport: { width: 412, height: 891 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, kind: 'phone' },
  'android-small': { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, kind: 'phone' },
  'ipad-land': { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, kind: 'tablet' },
  'ipad-port': { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, kind: 'tablet' },
  'taba-land': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, kind: 'wall' },
  'taba-port': { viewport: { width: 800, height: 1280 }, deviceScaleFactor: 1, kind: 'wall' },
  'laptop': { viewport: { width: 1126, height: 642 }, deviceScaleFactor: 1, kind: 'tablet' },
};
const ALL = { weather: true, ac: true, news: true, summary: true, events: true, countdown: true, shopping: true, notes: true };
const NONE = Object.fromEntries(Object.keys(ALL).map(k => [k, false]));
const PROFILES = {
  full: { show: ALL, data: {} },
  busy: { show: ALL, data: { chores: 10, done: 2 } },
  minimal: { show: NONE, data: {} },
  alldone: { show: ALL, data: { chores: 6, done: 6 } },
  empty: { show: ALL, data: { chores: 0, shop: [], noEvents: true, notes: 0 } },
  defaults: { show: null, data: {} },
};

async function audit(page) {
  return page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, issues = [];
    const nav = document.querySelector('#nav'); const navTop = nav ? nav.getBoundingClientRect().top : vh;
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
    const name = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName) + ' "' + (el.innerText || '').trim().slice(0, 28).replace(/\s+/g, ' ') + '"';
    const SEL = '.clock-row, .dateline, .wx-now, .wx-desc, .wx-hours, .wx-strip, .ai-sum, .news-strip, .today-strip, .list-head, .chore, .done-card, .empty-state, .rr > h3, .ev, .ev-day, .cd-card, .shop-mini, .note-mini, .shop-tile, .ac-tile, .ptile, .rr .link-btn';
    const els = [...document.querySelectorAll('#view ' + SEL.split(', ').join(', #view '))].filter(vis);
    // 1. overlaps between unrelated blocks
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue;
      const r = a.getBoundingClientRect(), s = b.getBoundingClientRect();
      const ox = Math.min(r.right, s.right) - Math.max(r.left, s.left), oy = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
      if (ox > 4 && oy > 4) issues.push(`OVERLAP ${name(a)} × ${name(b)} (${Math.round(ox)}x${Math.round(oy)})`);
    }
    // 2. outside the screen / under the tab bar / cut by its column
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) issues.push(`OFFSCREEN-X ${name(el)} (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`);
      if (r.top < navTop && r.bottom > navTop + 2 && !document.querySelector('.home')?.scrollHeight) issues.push(`UNDER-NAV ${name(el)}`);
      if (document.querySelector('#view .home') && r.top >= navTop - 2) issues.push(`BELOW-FOLD ${name(el)} (top ${Math.round(r.top)} ≥ nav ${Math.round(navTop)})`);
      let p = el.parentElement;
      while (p && p.id !== 'view') { const cs = getComputedStyle(p); if (/(hidden|clip)/.test(cs.overflow + cs.overflowY)) { const q = p.getBoundingClientRect(); if (r.bottom > q.bottom + 2 && r.top < q.bottom) { issues.push(`CUT ${name(el)} by ${name(p).split(' ')[0]} (${Math.round(r.bottom - q.bottom)}px)`); } if (r.top >= q.bottom - 1) { issues.push(`HIDDEN ${name(el)} inside ${name(p).split(' ')[0]}`); } break; } p = p.parentElement; }
    });
    // 3. clipped text (ellipsis / clamp) and too small text
    document.querySelectorAll('#view *').forEach(el => {
      if (!vis(el) || !el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.data.trim())) return;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const scale = el.offsetWidth ? r.width / el.offsetWidth : 1, fs = parseFloat(cs.fontSize) * scale;
      if (fs < 11.5) issues.push(`TINY ${Math.round(fs * 10) / 10}px ${name(el)}`);
      if ((el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 3) && /(hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY))
        issues.push(`CLIPPED ${name(el)}`);
    });
    if (document.documentElement.scrollWidth > vw + 1) issues.push(`PAGE-SCROLL-X ${document.documentElement.scrollWidth}>${vw}`);
    const home = document.querySelector('.home'); if (home && home.scrollHeight > home.clientHeight + 4) issues.push(`HOME-SCROLLS ${home.scrollHeight}>${home.clientHeight}`);
    const zooms = [...document.querySelectorAll('[data-fit]')].map(e => { const r = e.getBoundingClientRect(); return e.offsetWidth ? Math.round(r.width / e.offsetWidth * 100) / 100 : 1; }).filter(z => z < 0.99);
    if (zooms.length) issues.push(`SHRUNK-TO-FIT ${zooms.join(',')}`);
    return [...new Set(issues)];
  });
}

(async () => {
  const only = process.argv[2] ? process.argv[2].split(',') : Object.keys(DEV);
  const profs = process.argv[3] ? process.argv[3].split(',') : Object.keys(PROFILES);
  const routes = process.argv[4] ? process.argv[4].split(',') : ['home'];
  const b = await chromium.launch({ ...(require('fs').existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {}), args: ['--no-sandbox'] });
  const report = {};
  for (const dn of only) for (const pn of profs) {
    const d = DEV[dn], pr = PROFILES[pn];
    const ctx = await b.newContext({ viewport: d.viewport, deviceScaleFactor: d.deviceScaleFactor, isMobile: !!d.isMobile, hasTouch: !!d.hasTouch, colorScheme: 'dark', locale: 'sq-AL', timezoneId: 'Europe/Tirane' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([kind, show, data]) => {
      window.__profile = data;
      const dev = { lang: 'sq', kind, kindAsked: true, nightOn: false, homeIdle: false, calm: false, wall: kind === 'wall', nativeEmoji: true };
      if (show) dev.show = show;
      try { localStorage.setItem('fb.device.v1', JSON.stringify(dev)); localStorage.removeItem('stubdb'); } catch (e) {}
    }, [d.kind, pr.show, pr.data]);
    await p.addInitScript(stub);
    await p.route(/fonts\.g|jsdelivr/, r => r.abort());
    await p.route(/api\.open-meteo\.com/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(wx) }));
    await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"k"};' }));
    await p.goto('http://localhost:8123/');
    await p.waitForSelector('#view .page, #view .home', { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
    for (const route of routes) {
      if (route !== 'home') { await p.evaluate(r => { location.hash = '#/' + r; }, route); await p.waitForTimeout(900); }
      const key = `${dn}|${pn}|${route}`;
      report[key] = await audit(p);
      if (errs.length) report[key].push('JS-ERROR ' + errs.join(' / '));
      await p.screenshot({ path: `${OUT}/${dn}-${pn}-${route}.png` });
    }
    await ctx.close();
  }
  await b.close();
  /* serious = blocks covering each other, things off screen or under the tab bar, chores hidden without a "+N" */
  const SERIOUS = /^(OVERLAP|OFFSCREEN|PAGE-SCROLL-X|JS-ERROR|BELOW-FOLD|CUT \.chore)/;
  let bad = 0;
  for (const k of Object.keys(report)) {
    const s = report[k].filter(x => SERIOUS.test(x));
    bad += s.length;
    console.log((s.length ? 'FAIL ' : 'PASS ') + k + (s.length ? '\n  - ' + s.slice(0, 12).join('\n  - ') : ''));
    if (process.env.VERBOSE) report[k].filter(x => !SERIOUS.test(x)).forEach(x => console.log('    · ' + x));
  }
  console.log(bad ? 'LAYOUT ISSUES: ' + bad : 'ALL PASSED');
  process.exit(bad ? 1 : 0);
})();
