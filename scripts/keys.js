// Lists every translation key used in the code (static t('key') calls + known dynamic ones).
const fs = require('fs');
const files = fs.readdirSync('js').filter(f => f.endsWith('.js') && f !== 'i18n.js' && f !== 'i18n-dict.js');
const keys = new Set();
for (const f of files) {
  const src = fs.readFileSync('js/' + f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/'((?:wx|nav)\.[a-zA-Z]+)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\bL\.t\(\s*'([a-zA-Z0-9_.]+)'/g)) keys.add(m[1]);
}
['unit.day','unit.days','unit.week','unit.weeks','unit.month','unit.months','unit.year','unit.years',
 'wx.clear','wx.mostlyClear','wx.partly','wx.cloudy','wx.fog','wx.drizzle','wx.rain','wx.showers','wx.snow','wx.storm',
 'err.login','err.exists','err.code','err.confirm','err.password','err.network','err.email','err.generic','err.start','err.save','nav.home','nav.calendar','nav.chores','nav.lists','nav.settings','rel.today','rel.tomorrow','rel.yesterday'].forEach(k => keys.add(k));
const sorted = [...keys].filter(k => !k.endsWith('.')).sort();
if (process.argv[2] === 'check') {
  const dict = require('../js/i18n-dict.js');
  let bad = 0;
  for (const k of sorted) for (const l of ['en', 'sq']) if (!dict[l][k]) { console.log('MISSING', l, k); bad++; }
  for (const l of ['en', 'sq']) for (const k of Object.keys(dict[l])) if (!keys.has(k)) console.log('unused', l, k);
  // placeholders must match between languages
  for (const k of Object.keys(dict.en)) {
    const a = (dict.en[k].match(/\{\w+\}/g) || []).sort().join(), b = ((dict.sq[k] || '').match(/\{\w+\}/g) || []).sort().join();
    if (a !== b) { console.log('PLACEHOLDER MISMATCH', k, a, '|', b); bad++; }
  }
  console.log(bad ? bad + ' problems' : 'all ' + sorted.length + ' keys present in en + sq');
  process.exit(bad ? 1 : 0);
}
console.log(sorted.join('\n'));
