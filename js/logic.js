/* Pure "what is due / what is on" calculations over FB.state. No DOM in here. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, R = FB.recur;
  var L = (FB.logic = {});

  /* ---------- state ---------- */
  FB.state = FB.state || { rev: 0, ready: false, household: null, members: [], chores: [], templates: [], completions: [], events: [], shopping: [], notes: [], me: null };
  L.touch = function () { FB.state.rev++; };

  var memo = { rev: -1, byChoreDate: null, byChore: null };
  function index() {
    var st = FB.state;
    if (memo.rev === st.rev) return memo;
    var byChoreDate = {}, byChore = {};
    st.completions.forEach(function (c) {
      byChoreDate[c.chore_id + '|' + c.on_date] = c;
      (byChore[c.chore_id] = byChore[c.chore_id] || []).push(c);
    });
    Object.keys(byChore).forEach(function (k) { byChore[k].sort(function (a, b) { return a.done_at < b.done_at ? 1 : -1; }); });
    memo = { rev: st.rev, byChoreDate: byChoreDate, byChore: byChore };
    return memo;
  }

  L.member = function (id) {
    var ms = FB.state.members;
    for (var i = 0; i < ms.length; i++) if (ms[i].id === id) return ms[i];
    return null;
  };
  L.membersSorted = function () {
    return FB.state.members.slice().sort(function (a, b) { return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0; });
  };
  L.chore = function (id) {
    var cs = FB.state.chores;
    for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
    return null;
  };

  /* ---------- chores ---------- */
  /* Chores shown for `date`. `nowHHMM` is only used when date is today. */
  L.choresDue = function (date, nowHHMM) {
    var idx = index(), today = U.today(), out = [];
    FB.state.chores.forEach(function (c) {
      if (!c.active) return;
      var rule = c.rule, done = null, carried = false;
      var hist = idx.byChore[c.id] || [];
      if (rule.freq === 'once') {
        var any = hist[0] || null;
        if (any) { if (any.on_date !== date) return; done = any; }
        else if (rule.start === date) { /* due exactly today */ }
        else if (date === today && rule.start < date) { carried = true; }
        else return;
      } else {
        if (!R.occursOn(rule, date)) return;
        done = idx.byChoreDate[c.id + '|' + date] || null;
      }
      var last = null;
      for (var i = 0; i < hist.length; i++) { if (hist[i].on_date !== date && hist[i] !== done) { last = hist[i]; break; } }
      var overdue = !done && (carried || (date === today && !!c.due_time && !!nowHHMM && nowHHMM > c.due_time));
      out.push({ chore: c, done: done, carried: carried, overdue: overdue, last: last });
    });
    out.sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      var ta = a.chore.due_time || '99:99', tb = b.chore.due_time || '99:99';
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.chore.title.localeCompare(b.chore.title);
    });
    return out;
  };

  L.lastDone = function (choreId) { return (index().byChore[choreId] || [])[0] || null; };

  /* completions for the History tab: newest first */
  L.recentCompletions = function (limit) {
    return FB.state.completions.slice().sort(function (a, b) { return a.done_at < b.done_at ? 1 : -1; }).slice(0, limit || 200);
  };

  /* how many chores each member finished in the last 7 days (including today) */
  L.weekCounts = function () {
    var from = U.addDays(U.today(), -6), counts = {};
    FB.state.completions.forEach(function (c) {
      if (c.on_date >= from && c.done_by) counts[c.done_by] = (counts[c.done_by] || 0) + 1;
    });
    return counts;
  };

  /* ---------- events ---------- */
  function eventRule(e) { return e.rule ? Object.assign({}, e.rule, { start: e.on_date }) : null; }

  L.eventOccursOn = function (e, date) {
    var rule = eventRule(e);
    if (rule && rule.freq !== 'once') return R.occursOn(rule, date);
    var end = e.end_date && e.end_date >= e.on_date ? e.end_date : e.on_date;
    return date >= e.on_date && date <= end;
  };

  L.eventsOn = function (date) {
    var out = [];
    FB.state.events.forEach(function (e) {
      if (!L.eventOccursOn(e, date)) return;
      var age = null;
      if (e.kind === 'birthday' && e.birth_year) age = U.parts(date).y - e.birth_year;
      out.push({ event: e, date: date, age: age });
    });
    out.sort(function (a, b) {
      var ta = a.event.all_day || !a.event.start_time ? '' : a.event.start_time;
      var tb = b.event.all_day || !b.event.start_time ? '' : b.event.start_time;
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.event.title.localeCompare(b.event.title);
    });
    return out;
  };

  /* events and birthdays for the next `days` days, flattened and ordered; countdowns are separate */
  L.upcoming = function (fromDate, days) {
    var out = [];
    for (var i = 0; i < days; i++) {
      var d = U.addDays(fromDate, i);
      L.eventsOn(d).forEach(function (x) { if (x.event.kind !== 'countdown') out.push(x); });
    }
    return out;
  };

  /* countdown events that have not passed yet, nearest first */
  L.countdowns = function (fromDate) {
    return FB.state.events
      .filter(function (e) { return e.kind === 'countdown' && e.on_date >= fromDate; })
      .map(function (e) { return { event: e, days: U.daysBetween(fromDate, e.on_date) }; })
      .sort(function (a, b) { return a.days - b.days; });
  };

  /* events at `date` that have a start time and a reminder, with the minute-of-day they should chime */
  L.reminders = function (date) {
    var out = [];
    L.eventsOn(date).forEach(function (x) {
      var e = x.event;
      if (e.start_time && e.remind_minutes != null && e.remind_minutes !== '') {
        out.push({ event: e, at: U.minutesOf(e.start_time) - Number(e.remind_minutes), start: U.minutesOf(e.start_time) });
      }
    });
    return out;
  };

  /* ---------- lists ---------- */
  L.shoppingSorted = function () {
    return FB.state.shopping.slice().sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return a.created_at < b.created_at ? -1 : 1;
    });
  };
  L.notesSorted = function () {
    return FB.state.notes.slice().sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return a.created_at < b.created_at ? 1 : -1;
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
})(typeof window !== 'undefined' ? window : globalThis);
