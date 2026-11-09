/* Trimmed copy of js/util.js (dates) and js/recur.js (occursOn) for the edge function. */
/* Small helpers shared by every module. Classic script, no build step. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = (FB.util = {});

  U.pad = function (n) { return String(n).padStart(2, '0'); };

  /* ---------- dates (all dates are 'YYYY-MM-DD' strings in local time) ---------- */
  U.ymd = function (d) { return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); };
  U.parse = function (s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  U.today = function () { return U.ymd(new Date()); };
  U.addDays = function (s, n) { var d = U.parse(s); d.setDate(d.getDate() + n); return U.ymd(d); };
  /* whole days since 1970-01-01, immune to daylight saving shifts */
  U.dayNum = function (s) { var p = s.split('-').map(Number); return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); };
  U.daysBetween = function (a, b) { return U.dayNum(b) - U.dayNum(a); };
  U.weekday = function (s) { var p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }; /* 0 = Sunday */
  U.daysInMonth = function (y, m1) { return new Date(Date.UTC(y, m1, 0)).getUTCDate(); }; /* m1 = 1..12 */
  U.parts = function (s) { var p = s.split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; };
  /* Monday-based start of week, returned as a day number */
  U.weekStartNum = function (s) { return U.dayNum(s) - ((U.weekday(s) + 6) % 7); };
  U.monthStart = function (s) { var p = U.parts(s); return p.y + '-' + U.pad(p.m) + '-01'; };
  U.hhmm = function (d) { return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); };
  U.minutesOf = function (hhmm) { var p = hhmm.split(':').map(Number); return p[0] * 60 + p[1]; };
  if (typeof module !== 'undefined' && module.exports) module.exports = U;
})(typeof window !== 'undefined' ? window : globalThis);
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = root.FB && root.FB.util ? root.FB.util : (typeof require !== 'undefined' ? require('./util.js') : null);
  var R = (FB.recur = {});

  R.defaultRule = function (start) {
    return { freq: 'daily', interval: 1, weekdays: [], monthMode: 'dom', dom: 1, nth: 1, nthDay: 1, start: start || '', until: null };
  };

  function monthIndex(s) { var p = U.parts(s); return p.y * 12 + (p.m - 1); }

  /* which occurrence of its weekday this date is within its month: 1..5 */
  function nthOfMonth(s) { return Math.floor((U.parts(s).d - 1) / 7) + 1; }
  function isLastOfWeekdayInMonth(s) { var p = U.parts(s); return p.d + 7 > U.daysInMonth(p.y, p.m); }

  R.occursOn = function (rule, date) {
    if (!rule || !rule.start) return false;
    if (date < rule.start) return false;
    if (rule.until && date > rule.until) return false;
    var n = Math.max(1, parseInt(rule.interval, 10) || 1);
    var sp = U.parts(rule.start), dp = U.parts(date);

    switch (rule.freq) {
      case 'once':
        return date === rule.start;

      case 'daily':
        return U.daysBetween(rule.start, date) % n === 0;

      case 'weekly': {
        var days = rule.weekdays && rule.weekdays.length ? rule.weekdays : [U.weekday(rule.start)];
        if (days.indexOf(U.weekday(date)) === -1) return false;
        var weeks = Math.round((U.weekStartNum(date) - U.weekStartNum(rule.start)) / 7);
        return weeks % n === 0;
      }

      case 'monthly': {
        if ((monthIndex(date) - monthIndex(rule.start)) % n !== 0) return false;
        var dim = U.daysInMonth(dp.y, dp.m);
        var mode = rule.monthMode || 'dom';
        if (mode === 'last') return dp.d === dim;
        if (mode === 'nth') {
          if (U.weekday(date) !== rule.nthDay) return false;
          return rule.nth === -1 ? isLastOfWeekdayInMonth(date) : nthOfMonth(date) === rule.nth;
        }
        var want = rule.dom || sp.d;
        return dp.d === Math.min(want, dim);
      }

      case 'yearly': {
        if ((dp.y - sp.y) % n !== 0) return false;
        if (dp.m !== sp.m) return false;
        /* 29 February falls back to 28 February in years without one */
        var target = Math.min(sp.d, U.daysInMonth(dp.y, sp.m));
        return dp.d === target;
      }
    }
    return false;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
