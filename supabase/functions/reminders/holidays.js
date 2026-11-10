/*
 * Albanian calendar: official holidays (with the "next working day off" rule), other national days,
 * and traditional name days. Works in the browser and in the edge functions (no DOM).
 *
 *   FB.holidays.on('2026-11-28') -> [{ type: 'holiday', sq, en, icon }, ...]
 *   types: 'holiday' (official, day off), 'off' (day off moved from a weekend holiday),
 *          'observance' (national / popular day, working day), 'nameday' (names: [...])
 */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var H = (FB.holidays = {});

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m, d) { var t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }
  function addDays(s, n) { var t = new Date(s + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function weekday(s) { return new Date(s + 'T12:00:00Z').getUTCDay(); }

  /* Western (Catholic) Easter: anonymous Gregorian algorithm */
  function easterWest(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return ymd(y, month, day);
  }
  /* Orthodox Easter: Julian computus (Meeus) + 13 days (valid 1900-2099) */
  function easterOrthodox(y) {
    var a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7,
      month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
    return addDays(ymd(y, month, day), 13);
  }

  /* Bajram dates follow the moon; the Muslim Community of Albania confirms them each year (may move by a day) */
  var BAJRAM = {
    2025: ['2025-03-30', '2025-06-06'],
    2026: ['2026-03-20', '2026-05-27'],
    2027: ['2027-03-09', '2027-05-16'],
    2028: ['2028-02-26', '2028-05-05'],
    2029: ['2029-02-14', '2029-04-24'],
    2030: ['2030-02-04', '2030-04-13'],
    2031: ['2031-01-24', '2031-04-02']
  };

  /* official holidays (Law on public holidays, as published in the Bank of Albania calendar) */
  var FIXED = [
    ['01-01', '🎆', 'Viti i Ri', "New Year's Day"],
    ['01-02', '🎆', 'Viti i Ri (dita e dytë)', "New Year's Day (second day)"],
    ['03-14', '🌸', 'Dita e Verës', 'Summer Day'],
    ['03-22', '🌱', 'Dita e Nevruzit', 'Nevruz Day'],
    ['05-01', '🛠️', 'Dita Ndërkombëtare e Punëtorëve', "International Workers' Day"],
    ['09-05', '🕊️', 'Dita e Shën Nënë Terezës', 'Mother Teresa Day'],
    ['11-22', '🔤', 'Dita e Alfabetit', 'Alphabet Day'],
    ['11-28', '🇦🇱', 'Dita e Flamurit dhe e Pavarësisë', 'Flag and Independence Day'],
    ['11-29', '🇦🇱', 'Dita e Çlirimit', 'Liberation Day'],
    ['12-08', '🎓', 'Dita Kombëtare e Rinisë', 'National Youth Day'],
    ['12-25', '🎄', 'Krishtlindjet', 'Christmas Day']
  ];

  /* national and popular days that are working days */
  var OBS = [
    ['01-06', '💧', 'Ujët e Bekuar (Teofania)', 'Epiphany (Orthodox)'],
    ['02-14', '❤️', 'Shën Valentini', "Valentine's Day"],
    ['03-02', '🛡️', 'Lidhja e Lezhës', 'League of Lezhë'],
    ['03-07', '📚', 'Dita e Mësuesit', "Teachers' Day"],
    ['03-08', '💐', 'Dita e Gruas', "Women's Day"],
    ['05-05', '🕯️', 'Dita e Dëshmorëve', "Martyrs' Day"],
    ['06-01', '🧒', 'Dita e Fëmijëve', "Children's Day"],
    ['10-19', '🕊️', 'Lumturimi i Nënë Terezës', 'Beatification of Mother Teresa'],
    ['11-28', '📜', 'Dita e Kushtetutës', 'Constitution Day'],
    ['12-24', '🎄', 'Nata e Krishtlindjes', 'Christmas Eve'],
    ['12-31', '🥂', 'Nata e Vitit të Ri', "New Year's Eve"]
  ];

  /* traditional name days (Catholic and Orthodox saints most celebrated in Albania) */
  var NAMES = [
    ['01-01', 'Shën Vasili', ['Vasil', 'Vasilika', 'Vaso']],
    ['01-07', 'Shën Joan Pagëzori', ['Jani', 'Joan', 'Jovan', 'Joana']],
    ['01-17', 'Shën Antoni', ['Andon', 'Ndon', 'Antoneta']],
    ['01-18', 'Shën Athanasi', ['Thanas', 'Athanas', 'Thanasi']],
    ['02-14', 'Shën Valentini', ['Valentin', 'Valentina']],
    ['03-19', 'Shën Jozefi', ['Zef', 'Jozef', 'Jozefina', 'Zefina']],
    ['04-25', 'Shën Marku', ['Mark', 'Marko', 'Marku']],
    ['05-06', 'Shëngjergji', ['Gjergj', 'Gjergji', 'Gjergjina', 'Jorgo', 'Gjergjana']],
    ['05-21', 'Shën Kostandini dhe Elena', ['Kostandin', 'Kosta', 'Koço', 'Elena', 'Lena', 'Eleni']],
    ['06-13', 'Shën Ndou', ['Ndue', 'Ndoc', 'Anton', 'Antonio', 'Antonela']],
    ['06-24', 'Shën Gjon Pagëzori', ['Gjon', 'Gjoni', 'Gjovalin']],
    ['06-29', 'Shën Pjetri dhe Pali', ['Pjetër', 'Pjetri', 'Pal', 'Pali', 'Palok']],
    ['07-20', 'Shën Ilia', ['Ilia', 'Ilo']],
    ['07-26', 'Shën Ana dhe Shën Paraskevia', ['Ana', 'Anila', 'Paraskevi', 'Vevi']],
    ['08-15', 'Shën Mëria', ['Mari', 'Maria', 'Marie', 'Marjana', 'Mariana', 'Mira', 'Mrika', 'Marjeta']],
    ['09-05', 'Shën Nënë Tereza', ['Tereza', 'Terezina']],
    ['09-17', 'Shën Sofia', ['Sofia', 'Sofie', 'Sonila']],
    ['09-29', 'Shën Mëhilli', ['Mikel', 'Mëhill', 'Mikaela', 'Mihal']],
    ['10-04', 'Shën Françesku', ['Françesk', 'Frano', 'Franc', 'Françeska']],
    ['10-18', 'Shën Luka', ['Luka', 'Luk', 'Lukë']],
    ['10-26', 'Shën Mitri', ['Dhimitër', 'Dhimitri', 'Mitro', 'Dhimitra', 'Miti']],
    ['11-08', 'Shën Mihali', ['Mihal', 'Mihallaq', 'Mikel', 'Gavril']],
    ['11-11', 'Shën Martini', ['Martin', 'Martina']],
    ['11-25', 'Shën Katerina', ['Katerina', 'Katrina', 'Kate']],
    ['11-30', 'Shën Andrea', ['Andrea', 'Ndrea', 'Ndreu', 'Andi', 'Andrra']],
    ['12-04', 'Shën Barbara', ['Barbara']],
    ['12-06', 'Shën Nikolla', ['Nikolla', 'Nikoll', 'Kolë', 'Niko', 'Nikolin', 'Nikoleta']],
    ['12-12', 'Shën Spiridhoni', ['Spiro', 'Spiridon']],
    ['12-13', 'Shën Luçia', ['Luçie', 'Luçia', 'Lucia']],
    ['12-26', 'Shën Shtjefni', ['Shtjefën', 'Stefan', 'Stefani', 'Stefania']]
  ];

  var cache = {};
  function year(y) {
    if (cache[y]) return cache[y];
    var map = {};
    function put(d, item) { (map[d] = map[d] || []).push(item); }
    var official = [];
    FIXED.forEach(function (f) { official.push({ date: y + '-' + f[0], icon: f[1], sq: f[2], en: f[3] }); });
    var cw = easterWest(y), co = easterOrthodox(y);
    if (cw === co) official.push({ date: cw, icon: '🐣', sq: 'Pashkët (Katolike dhe Ortodokse)', en: 'Easter (Catholic and Orthodox)' });
    else {
      official.push({ date: cw, icon: '🐣', sq: 'Pashkët Katolike', en: 'Catholic Easter' });
      official.push({ date: co, icon: '🐣', sq: 'Pashkët Ortodokse', en: 'Orthodox Easter' });
    }
    var bj = BAJRAM[y];
    if (bj) {
      official.push({ date: bj[0], icon: '🌙', sq: 'Bajrami i Madh (Fitër Bajrami)', en: 'Eid al-Fitr' });
      official.push({ date: bj[1], icon: '🌙', sq: 'Kurban Bajrami', en: 'Eid al-Adha' });
    }
    official.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var isOff = {};
    official.forEach(function (o) { isOff[o.date] = true; put(o.date, { type: 'holiday', icon: o.icon, sq: o.sq, en: o.en }); });
    /* a holiday on Saturday or Sunday gives the first free working day after it */
    official.forEach(function (o) {
      var wd = weekday(o.date);
      if (wd !== 0 && wd !== 6) return;
      var d = addDays(o.date, 1);
      while (weekday(d) === 0 || weekday(d) === 6 || isOff[d]) d = addDays(d, 1);
      isOff[d] = true;
      put(d, { type: 'off', icon: '🏖️', sq: 'Ditë pushimi (' + o.sq + ')', en: 'Day off (' + o.en + ')' });
    });
    OBS.forEach(function (f) { put(y + '-' + f[0], { type: 'observance', icon: f[1], sq: f[2], en: f[3] }); });
    put(addDays(cw, -2), { type: 'observance', icon: '✝️', sq: 'E Premtja e Madhe (Katolike)', en: 'Good Friday (Catholic)' });
    if (co !== cw) put(addDays(co, -2), { type: 'observance', icon: '✝️', sq: 'E Premtja e Madhe (Ortodokse)', en: 'Good Friday (Orthodox)' });
    NAMES.forEach(function (n) { put(y + '-' + n[0], { type: 'nameday', icon: '🎉', sq: n[1], en: n[1], names: n[2] }); });
    cache[y] = map;
    return map;
  }

  H.on = function (date) { return (year(Number(date.slice(0, 4)))[date] || []).slice(); };
  H.isOff = function (date) { return H.on(date).some(function (x) { return x.type === 'holiday' || x.type === 'off'; }); };
  H.label = function (x, lang) { return lang === 'sq' ? x.sq : x.en; };

  function norm(s) { return String(s || '').toLowerCase().replace(/ë/g, 'e').replace(/ç/g, 'c').trim(); }
  /* family members who have their name day on `date` (first name, accents ignored) */
  H.celebrants = function (date, members) {
    var names = [];
    H.on(date).forEach(function (x) { if (x.type === 'nameday') names = names.concat(x.names); });
    if (!names.length) return [];
    var set = {}; names.forEach(function (n) { set[norm(n)] = true; });
    return (members || []).filter(function (m) { return set[norm(String(m.name || '').split(/\s+/)[0])]; });
  };
  H._easter = { west: easterWest, orthodox: easterOrthodox };
})(typeof window !== 'undefined' ? window : globalThis);
