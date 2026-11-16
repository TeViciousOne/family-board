/* Language helpers: text lookup, weekday and month names, friendly dates. English and Albanian. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util;
  var I = (FB.i18n = { lang: 'en' });

  var NAMES = {
    en: {
      dayShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      dayLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      dayDef: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      monthLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      monthShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      ord: { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', '-1': 'last' }
    },
    sq: {
      dayShort: ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'],
      dayLong: ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë'],
      dayDef: ['e diela', 'e hëna', 'e marta', 'e mërkura', 'e enjtja', 'e premtja', 'e shtuna'],
      monthLong: ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'],
      monthShort: ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'],
      ord: { 1: 'e parë', 2: 'e dytë', 3: 'e tretë', 4: 'e katërt', '-1': 'e fundit' }
    }
  };
  function N() { return NAMES[I.lang] || NAMES.en; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  I.set = function (lang) { I.lang = lang === 'sq' ? 'sq' : 'en'; };

  I.t = function (key, vars) {
    var d = FB.dict;
    var s = (d[I.lang] && d[I.lang][key]) || (d.en && d.en[key]) || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  };

  I.dayShort = function (i) { return N().dayShort[i]; };
  I.dayLong = function (i) { return N().dayLong[i]; };
  I.monthLong = function (i) { return cap(N().monthLong[i]); };
  I.monthShort = function (i) { return N().monthShort[i]; };
  I.ord = function (n) { return N().ord[String(n)] || String(n); };

  /* "Monday 9 November" / "E hënë, 9 nëntor" */
  I.dateLong = function (date) {
    var p = U.parts(date), wd = U.weekday(date), n = N();
    return I.lang === 'sq'
      ? cap(n.dayLong[wd]) + ', ' + p.d + ' ' + n.monthLong[p.m - 1]
      : n.dayLong[wd] + ' ' + p.d + ' ' + n.monthLong[p.m - 1];
  };

  /* Today / Tomorrow / Yesterday, otherwise "Wed 11 Nov" (or the long form when `long` is true) */
  I.relDay = function (date, long) {
    var diff = U.daysBetween(U.today(), date);
    if (diff === 0) return I.t('rel.today');
    if (diff === 1) return I.t('rel.tomorrow');
    if (diff === -1) return I.t('rel.yesterday');
    if (long) return I.dateLong(date);
    var p = U.parts(date);
    return I.dayShort(U.weekday(date)) + ' ' + p.d + ' ' + I.monthShort(p.m - 1);
  };

  /* local HH:MM of an ISO timestamp */
  I.timeOf = function (iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : I.hm(U.hhmm(d));
  };
  /* show a stored "HH:MM" the way this device wants it (24-hour, or 12-hour with AM / PM) */
  function t12() { return !!(FB.device && FB.device.time12); }
  I.hm = function (s) {
    if (!s || !t12()) return s || '';
    var p = String(s).split(':'), hh = Number(p[0]);
    return ((hh + 11) % 12 + 1) + ':' + p[1] + (hh < 12 ? ' AM' : ' PM');
  };
  /* a whole hour for narrow places: "15:00" or "3 PM" */
  I.hour = function (hh) { hh = Number(hh); return t12() ? ((hh + 11) % 12 + 1) + (hh < 12 ? ' AM' : ' PM') : U.pad(hh) + ':00'; };
  /* the big clocks: digits and, in 12-hour mode, the AM / PM mark separately */
  I.clock = function (d) {
    if (!t12()) return { t: U.hhmm(d), ap: '' };
    var hh = d.getHours();
    return { t: ((hh + 11) % 12 + 1) + ':' + U.pad(d.getMinutes()), ap: hh < 12 ? 'AM' : 'PM' };
  };

  /* what recur.describe() needs */
  I.L = {
    t: function (k, v) { return I.t(k, v); },
    dayShort: function (i) { return N().dayShort[i]; },
    dayLong: function (i) { return N().dayDef[i]; },
    ord: function (n) { return I.ord(n); }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = I;
})(typeof window !== 'undefined' ? window : globalThis);
