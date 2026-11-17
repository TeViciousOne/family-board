/* Computed-style snapshot of the elements refine.css styles: used to prove a CSS cleanup changes nothing visible.
   Usage: node tests/styles-snapshot.js out.json   then diff two files with: node tests/styles-snapshot.js diff a.json b.json */
const fs = require('fs');
if (process.argv[2] === 'diff') {
  const a = JSON.parse(fs.readFileSync(process.argv[3])), b = JSON.parse(fs.readFileSync(process.argv[4]));
  let n = 0; const seen = new Set();
  for (const k of Object.keys(a)) for (let i = 0; i < a[k].length; i++) {
    const x = a[k][i], y = (b[k] || [])[i]; if (!y) { console.log('MISSING', k, i); n++; continue; }
    for (const p of Object.keys(x)) if (x[p] !== y[p] && p !== 'n') { const key = x.n + '|' + p + '|' + x[p] + '→' + y[p]; if (seen.has(key)) continue; seen.add(key); console.log(`${k.split('|').slice(1).join('|')}  ${x.n}  ${p}: ${x[p]}  →  ${y[p]}`); n++; }
  }
  console.log(n ? 'DIFFERENCES: ' + n : 'IDENTICAL'); process.exit(n ? 1 : 0);
}
const { chromium } = require('playwright'); const stub = require('./layout/stub.js');
const SEL = '.rr > h3, .rail h3, .ups-head, .ts-lbl, .shop-cat, .wx-sh, .grp, .field > label, .chore-meta, .chore-who-av small, .shop-mini small, .note-mini small, .ev-when, .shop-sub, .row-sub, .meta-txt, .nc-who small, .hh-txt p, .hh-wx-txt small, .ev-day, .cd-title small, .hol-txt small, .pane-notes, .pane-shop, .shop-tick, .note-mini, .note-card, .chore, .rail-in > *, .day-ev, #nav button span:last-child, .more-chip, .late-tag';
const PROPS = ['fontSize', 'fontWeight', 'letterSpacing', 'textTransform', 'color', 'marginTop', 'marginBottom', 'borderLeftWidth', 'borderLeftColor', 'backgroundColor', 'boxShadow', 'borderTopColor', 'display'];
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] }); const out = {};
  for (const [dn, vp, kind] of [['taba', { width: 1280, height: 800 }, 'wall'], ['phone', { width: 375, height: 812 }, 'phone']]) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, isMobile: kind === 'phone', hasTouch: kind === 'phone', locale: 'sq-AL', timezoneId: 'Europe/Tirane' }); const p = await ctx.newPage();
    await p.addInitScript(([k]) => { window.__profile = { chores: 8, done: 2 }; localStorage.setItem('fb.device.v1', JSON.stringify({ lang: 'sq', kind: k, kindAsked: true, nightOn: false, homeIdle: false, calm: false, wall: k === 'wall', nativeEmoji: true })); localStorage.removeItem('stubdb'); }, [kind]);
    await p.addInitScript(stub); await p.route(/fonts\.g|jsdelivr|open-meteo/, r => r.abort());
    await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"k"};' }));
    await p.goto('http://localhost:8123/'); await p.waitForSelector('#view .page, #view .home', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(2000);
    for (const route of ['home', 'chores', 'lists', 'calendar', 'settings']) {
      if (route !== 'home') { await p.evaluate(r => { location.hash = '#/' + r; }, route); await p.waitForTimeout(1600); }
      out[`${dn}|${scheme}|${route}`] = await p.evaluate(([sel, props]) => [...document.querySelectorAll(sel)].map(el => { const cs = getComputedStyle(el), o = { n: (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase()) }; props.forEach(q => { o[q] = cs[q]; }); return o; }), [SEL, PROPS]);
    }
    await ctx.close();
  }
  await b.close(); fs.writeFileSync(process.argv[2], JSON.stringify(out)); console.log('saved', Object.values(out).reduce((s, a) => s + a.length, 0), 'elements');
})();
