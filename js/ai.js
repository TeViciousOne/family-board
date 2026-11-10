/* AI helpers: a daily summary line and a shopping-list tidy-up.
   The work happens in the `ai` edge function; the key never reaches the browser. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, ui = FB.ui, h = U.h, L = FB.logic;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  var A = (FB.ai = {});
  FB.actions = FB.actions || {};

  A.enabled = function () { return !!(FB.store && FB.store.mode === 'cloud' && FB.store.ai); };

  var CATS = { produce: '🥬', dairy: '🥛', bakery: '🥖', meat: '🥩', pantry: '🥫', frozen: '🧊', drinks: '🥤', household: '🧻', personal: '🧴', other: '🛒' };
  A.cats = Object.keys(CATS);
  A.catLabel = function (k) { return (CATS[k] || CATS.other) + ' ' + t('cat.' + (CATS[k] ? k : 'other')); };

  A.errKey = function (e) {
    var m = String((e && e.message) || e);
    if (m === 'busy') return 'ai.busy';
    if (m === 'limit') return 'ai.limit';
    if (/fetch|network/i.test(m)) return 'err.network';
    return 'ai.failed';
  };

  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ---------------- daily summary ---------------- */
  var SUM_KEY = 'fb.ai.sum', sumBusy = false, sumFail = 0;
  function sumContext() {
    var d = new Date(), today = U.today(), tomorrow = U.addDays(today, 1);
    function evs(date) {
      return L.eventsOn(date).filter(function (x) { return x.event.kind !== 'countdown'; }).slice(0, 6).map(function (x) {
        return { title: x.event.title, time: x.event.all_day || !x.event.start_time ? null : x.event.start_time };
      });
    }
    var left = L.choresDue(today, U.hhmm(d)).filter(function (x) { return !x.done; }).slice(0, 8).map(function (x) {
      var who = x.chore.member_id ? L.member(x.chore.member_id) : null;
      return { title: x.chore.title, by: x.chore.due_time || null, who: who ? who.name : null };
    });
    var ctx = { date: today, weekday: WEEKDAYS[d.getDay()], part: d.getHours() < 12 ? 'morning' : d.getHours() < 18 ? 'afternoon' : 'evening',
      eventsToday: evs(today), eventsTomorrow: evs(tomorrow), choresLeft: left, shoppingOpen: FB.state.shopping.filter(function (s) { return !s.done; }).length };
    var w = FB.app && FB.app.weather && FB.app.weather.data;
    if (w && w.days && w.days[0]) {
      ctx.weather = { now: w.current ? Math.round(w.current.temp) : null, summary: w.current ? t(FB.weather.labelKey(w.current.code)) : null,
        high: Math.round(w.days[0].max), low: Math.round(w.days[0].min), rainChance: w.days[0].rain != null ? Math.round(w.days[0].rain) : null };
    }
    return ctx;
  }
  function hashOf(s) { var x = 0; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return String(x); }
  function readSum() { try { return JSON.parse(localStorage.getItem(SUM_KEY) || 'null'); } catch (e) { return null; } }

  /* returns the cached text now and, if things changed, refreshes it in the background */
  A.summary = function () {
    if (!A.enabled() || !FB.state.ready) return '';
    var ctx = sumContext(), key = FB.i18n.lang + '|' + hashOf(JSON.stringify(ctx)), cur = readSum();
    var fresh = cur && cur.key === key;
    var recent = cur && Date.now() - cur.at < 60 * 60 * 1000 && cur.date === ctx.date;
    if (!fresh && !recent && !sumBusy && Date.now() - sumFail > 5 * 60 * 1000 && navigator.onLine !== false && document.visibilityState === 'visible') {
      sumBusy = true;
      FB.store.ai({ action: 'summary', lang: FB.i18n.lang, context: ctx }).then(function (d) {
        try { localStorage.setItem(SUM_KEY, JSON.stringify({ key: key, at: Date.now(), date: ctx.date, text: d.text })); } catch (e) { /* ignore */ }
        sumBusy = false; if (FB.app && FB.app.render) FB.app.render();
      }, function () { sumBusy = false; sumFail = Date.now(); });
    }
    return cur && cur.date === ctx.date ? cur.text : '';
  };

  /* ---------------- shopping list tidy-up ---------------- */
  A.tidy = function () {
    var items = FB.state.shopping.filter(function (s) { return !s.done; });
    if (items.length < 2) { ui.toast(t('ai.tidyFew')); return Promise.resolve(); }
    ui.toast(t('ai.thinking'));
    return FB.store.ai({ action: 'tidy', lang: FB.i18n.lang, items: items.map(function (s) { return { id: s.id, title: s.title }; }) }).then(function (d) {
      var byId = {}; items.forEach(function (s) { byId[s.id] = s; });
      var gone = {}, merged = 0, jobs = [];
      (d.merge || []).forEach(function (g) {
        var ids = (g || []).filter(function (id) { return byId[id]; });
        ids.slice(1).forEach(function (id) { if (!gone[id] && id !== ids[0]) { gone[id] = 1; merged++; jobs.push(FB.data.del('shopping_items', id)); } });
      });
      var sorted = 0;
      (d.items || []).forEach(function (x) {
        var s = byId[x.id]; if (!s || gone[x.id]) return;
        var patch = {};
        if (x.title && String(x.title).trim() && String(x.title).trim() !== s.title) patch.title = String(x.title).trim().slice(0, 80);
        var cat = CATS[x.category] ? x.category : null;
        if (cat && cat !== s.category) patch.category = cat;
        if (Object.keys(patch).length) { sorted++; jobs.push(FB.data.edit('shopping_items', s.id, patch)); }
      });
      return Promise.all(jobs).then(function () { ui.toast(t('ai.tidied', { m: merged, s: sorted })); });
    }, function (e) { ui.toast(t(A.errKey(e)), { kind: 'error' }); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
