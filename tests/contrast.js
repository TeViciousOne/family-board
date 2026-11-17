/* Contrast audit: measures the real rendered contrast of every visible piece of text, light and dark.
   How: collect each text run (its colour, size, weight and tight box), switch all text transparent, take a
   screenshot, and read the pixels where the text was. That gives the true background, glass blur and wallpaper included.
   WCAG AA: 4.5:1 for normal text, 3:1 for large text (24 px, or 18.66 px bold). Primary text is held to AAA (7:1) as a note.
   Usage: node tests/contrast.js [devices] [routes] [schemes]   e.g. node tests/contrast.js taba-land home,chores light,dark */
const { chromium } = require('playwright');
const stub = require('./layout/stub.js');
const DEV = {
  'taba-land': { viewport: { width: 1280, height: 800 }, kind: 'wall' },
  'ipad-land': { viewport: { width: 1180, height: 820 }, kind: 'tablet' },
  'iphone-x': { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, kind: 'phone' },
};
const devs = (process.argv[2] || 'taba-land,iphone-x').split(',');
const routes = (process.argv[3] || 'home,chores,lists,calendar,settings').split(',');
const schemes = (process.argv[4] || 'light,dark').split(',');
const WANT_AAA = !process.env.NO_AAA;

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const bad = {}; let checked = 0, aaaMiss = {};
  for (const dn of devs) for (const scheme of schemes) {
    const d = DEV[dn];
    const ctx = await b.newContext({ viewport: d.viewport, deviceScaleFactor: d.deviceScaleFactor || 1, isMobile: !!d.isMobile, hasTouch: !!d.hasTouch, colorScheme: scheme, locale: 'sq-AL', timezoneId: 'Europe/Tirane' });
    const p = await ctx.newPage();
    await p.addInitScript(([kind]) => {
      window.__profile = { chores: 8, done: 2 };
      try { localStorage.setItem('fb.device.v1', JSON.stringify({ lang: 'sq', kind, kindAsked: true, nightOn: false, homeIdle: false, calm: false, wall: kind === 'wall', nativeEmoji: true })); localStorage.removeItem('stubdb'); } catch (e) {}
    }, [d.kind]);
    await p.addInitScript(stub);
    if (process.env.SPOTIFY) { await p.addInitScript(() => { try { localStorage.setItem('fb.sp.v1', JSON.stringify({ cid: 'x', tok: { access: 'a', refresh: 'r', exp: Date.now() + 3.6e6 } })); } catch (e) {} });
      await p.route(/api\.spotify\.com\/v1\/me\/player/, r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify({ is_playing: true, progress_ms: 60000, item: { name: 'Ndarja', duration_ms: 240000, artists: [{ name: 'Alban Skenderaj' }], album: { images: [] } }, device: { name: 'Samsung Tab A', volume_percent: 40, supports_volume: true } }) })); }
    await p.route(/fonts\.g|jsdelivr|open-meteo/, r => r.abort());
    await p.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.FB_CONFIG={SUPABASE_URL:"https://x.supabase.co",SUPABASE_ANON_KEY:"k"};' }));
    await p.goto('http://localhost:8123/');
    await p.waitForSelector('#view .page, #view .home', { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2000);
    for (const route of routes) {
      if (route !== 'home') { await p.evaluate(r => { location.hash = '#/' + r; }, route); await p.waitForTimeout(1600); }
      await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
      /* 1. every text run: colour, size, weight, tight box */
      const runs = await p.evaluate(() => {
        const out = [], vw = innerWidth, vh = innerHeight;
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const nm = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase());
        for (let n; (n = w.nextNode());) {
          if (!n.data.trim() || !/[\p{L}\p{N}]/u.test(n.data.replace(/\p{Extended_Pictographic}/gu, ''))) continue; /* emoji carry their own colours */
          const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || el.closest('#night, #calm, [aria-hidden="true"]')) continue;
          const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          let op = 1; for (let a = el; a; a = a.parentElement) op *= +getComputedStyle(a).opacity;
          if (op < 0.2) continue;
          const rg = document.createRange(); rg.selectNodeContents(n);
          const r = rg.getBoundingClientRect(); if (r.width < 3 || r.height < 3 || r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue;
          /* clipped by an overflow parent? skip the hidden part */
          let hidden = false;
          for (let a = el; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a); if (/(hidden|clip|auto|scroll)/.test(c.overflowX + c.overflowY)) { const q = a.getBoundingClientRect(); if (r.bottom < q.top + 2 || r.top > q.bottom - 2 || r.right < q.left + 2 || r.left > q.right - 2) { hidden = true; break; } } }
          if (hidden) continue;
          const m = cs.color.match(/[\d.]+/g).map(Number);
          out.push({ x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(vw, r.right) - Math.max(0, r.left), h: Math.min(vh, r.bottom) - Math.max(0, r.top),
            c: [m[0], m[1], m[2], (m[3] === undefined ? 1 : m[3]) * op], fs: parseFloat(cs.fontSize), fw: +cs.fontWeight, name: nm(el) + ' "' + n.data.trim().slice(0, 22) + '"', dis: !!el.closest('button:disabled, [disabled], .muted-off') });
        }
        return out;
      });
      /* 2. text off, photograph the real background */
      const off = await p.addStyleTag({ content: '*{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important;caret-color:transparent !important} svg text{fill:transparent !important}' });
      await p.waitForTimeout(150);
      const shot = await p.screenshot(); if (process.env.DUMP) require('fs').writeFileSync(process.env.DUMP + '-' + dn + '-' + scheme + '-' + route + '.png', shot); const png = shot.toString('base64');
      await off.evaluate(e => e.remove());
      /* 3. read the pixels under each run and measure */
      const res = await p.evaluate(async ({ png, runs, dpr }) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        return runs.map((r) => {
          const x = Math.round(r.x * dpr), y = Math.round(r.y * dpr), w = Math.max(1, Math.round(r.w * dpr)), h = Math.max(1, Math.round(r.h * dpr));
          const d = cx.getImageData(x, y, Math.min(w, img.width - x), Math.min(h, img.height - y)).data;
          const ls = [], sum = [0, 0, 0]; let cnt = 0;
          for (let i = 0; i < d.length; i += 4) { ls.push(lum(d[i], d[i + 1], d[i + 2])); sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; cnt++; }
          if (!cnt) return null;
          ls.sort((a, b) => a - b);
          const mean = sum.map(v => v / cnt), a = r.c[3];
          const tc = [0, 1, 2].map(k => r.c[k] * a + mean[k] * (1 - a)); /* text colour as it really appears over this background */
          const lt = lum(tc[0], tc[1], tc[2]);
          /* the worst background pixel for this text colour: the lightest for light text, the darkest for dark text */
          const lb = lt > lum(mean[0], mean[1], mean[2]) ? ls[Math.floor(ls.length * 0.9)] : ls[Math.floor(ls.length * 0.1)];
          const ratio = (Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05);
          return { ratio, name: r.name, fs: r.fs, fw: r.fw, dis: r.dis, a };
        });
      }, { png, runs, dpr: d.deviceScaleFactor || 1 });
      res.forEach((r) => {
        if (!r || r.dis) return; checked++;
        const large = r.fs >= 24 || (r.fs >= 18.66 && r.fw >= 700);
        const need = large ? 3 : 4.5;
        const key = `${dn}|${scheme}|${route}`;
        if (r.ratio < need - 0.05) (bad[key] = bad[key] || new Map()).set(r.name, `${r.ratio.toFixed(2)}:1 (needs ${need}) ${r.fs}px`);
        else if (WANT_AAA && r.ratio < 7 && !large && r.fs >= 15 && r.a > 0.9) (aaaMiss[key] = aaaMiss[key] || new Map()).set(r.name, r.ratio.toFixed(2));
      });
    }
    await ctx.close();
  }
  await b.close();
  let fails = 0;
  for (const k of Object.keys(bad)) { fails += bad[k].size; console.log('FAIL ' + k); [...bad[k]].slice(0, 25).forEach(([n, v]) => console.log('   ' + v + '  ' + n)); }
  const aaa = Object.values(aaaMiss).reduce((s, m) => s + m.size, 0);
  console.log(`checked ${checked} text runs; AA failures: ${fails}; below AAA (full-strength text >= 15px): ${aaa}`);
  if (process.env.AAA) for (const k of Object.keys(aaaMiss)) { console.log('AAA ' + k); [...aaaMiss[k]].slice(0, 15).forEach(([n, v]) => console.log('   ' + v + '  ' + n)); }
  process.exit(fails ? 1 : 0);
})();
