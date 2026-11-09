/*
 * Repeat rules.  One rule object covers chores and calendar events.
 *
 *   { freq: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly',
 *     interval: 1,                 every N days / weeks / months / years
 *     weekdays: [1,3,5],           weekly only, 0 = Sunday .. 6 = Saturday
 *     monthMode: 'dom' | 'nth' | 'last',   monthly only
 *     dom: 15,                     monthMode 'dom': day of month (31 in a short month = last day)
 *     nth: 2,                      monthMode 'nth': 1..4, or -1 for the last one
 *     nthDay: 6,                   monthMode 'nth': weekday (0 = Sunday)
 *     start: 'YYYY-MM-DD',         first possible day, also the anchor for intervals
 *     until: 'YYYY-MM-DD' | null } last possible day
 */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = root.FB && root.FB.util ? root.FB.util : (typeof require !== 'undefined' ? require('./util.js') : null);
  var R = (FB.recur = {});

  R.defaultRule = function (start) {
    return { freq: 'daily', interval: 1, weekdays: [], monthMode: 'dom', dom: 1, nth: 1, nthDay: 1, start: start || U.today(), until: null };
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

  /* first occurrence on or after `from` (searching up to `limit` days), or null */
  R.nextOccurrence = function (rule, from, limit) {
    var max = limit || 800;
    for (var i = 0; i <= max; i++) {
      var d = U.addDays(from, i);
      if (rule.until && d > rule.until) return null;
      if (R.occursOn(rule, d)) return d;
    }
    return null;
  };

  /* every occurrence from `from` to `to` inclusive */
  R.between = function (rule, from, to) {
    var out = [];
    for (var d = from; d <= to; d = U.addDays(d, 1)) if (R.occursOn(rule, d)) out.push(d);
    return out;
  };

  /*
   * Plain-language summary.  `L` supplies the words so this works in any language:
   *   L.t(key, vars), L.dayShort(i), L.dayLong(i)  (0 = Sunday), L.ord(n) for n in 1..4 or -1
   */
  R.describe = function (rule, L) {
    if (!rule) return '';
    var n = Math.max(1, parseInt(rule.interval, 10) || 1);
    var s;
    switch (rule.freq) {
      case 'once': s = L.t('rule.once'); break;
      case 'daily': s = n === 1 ? L.t('rule.daily') : L.t('rule.everyNDays', { n: n }); break;
      case 'weekly': {
        var days = (rule.weekdays && rule.weekdays.length ? rule.weekdays : [U.weekday(rule.start)]).slice();
        days.sort(function (a, b) { return ((a + 6) % 7) - ((b + 6) % 7); });
        var key = days.join(',');
        if (n === 1 && key === '1,2,3,4,5') { s = L.t('rule.weekdays'); break; }
        if (n === 1 && key === '6,0') { s = L.t('rule.weekends'); break; }
        if (n === 1 && days.length === 7) { s = L.t('rule.daily'); break; }
        var list = days.map(L.dayShort).join(', ');
        s = n === 1 ? L.t('rule.weeklyOn', { days: list }) : L.t('rule.everyNWeeksOn', { n: n, days: list });
        break;
      }
      case 'monthly': {
        var mode = rule.monthMode || 'dom';
        var base;
        if (mode === 'last') base = L.t('rule.lastDay');
        else if (mode === 'nth') base = L.t('rule.nthWeekday', { ord: L.ord(rule.nth), day: L.dayLong(rule.nthDay) });
        else base = L.t('rule.dayOfMonth', { d: rule.dom || U.parts(rule.start).d });
        s = n === 1 ? L.t('rule.monthly', { what: base }) : L.t('rule.everyNMonths', { n: n, what: base });
        break;
      }
      case 'yearly': s = n === 1 ? L.t('rule.yearly') : L.t('rule.everyNYears', { n: n }); break;
      default: s = '';
    }
    if (rule.until) s += ' · ' + L.t('rule.until', { date: rule.until });
    return s;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
