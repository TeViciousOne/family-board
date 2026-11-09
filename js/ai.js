/* AI helpers: quick add (typed or spoken), a daily summary line, and a shopping-list tidy-up.
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

  /* ---------------- quick add ---------------- */
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function nowInfo() {
    var d = new Date();
    return { today: U.today(), weekday: WEEKDAYS[d.getDay()], time: U.hhmm(d) };
  }
  function memberId(name) {
    if (!name) return null;
    var n = String(name).trim().toLowerCase(), ms = FB.state.members;
    for (var i = 0; i < ms.length; i++) if (ms[i].name.trim().toLowerCase() === n) return ms[i].id;
    return null;
  }
  function ruleFor(repeat, date, weekdays) {
    var r = Object.assign(FB.recur.defaultRule(date), { freq: repeat && repeat !== 'none' ? repeat : 'once', interval: 1 });
    if (r.freq === 'weekly') r.weekdays = weekdays && weekdays.length ? weekdays : [U.weekday(date)];
    if (r.freq === 'monthly') { r.monthMode = 'dom'; r.dom = U.parts(date).d; }
    return r;
  }

  /* turns the AI answer into rows, each with a label, a detail line and a function that saves it */
  function proposals(data) {
    var out = [];
    (data.events || []).forEach(function (e) {
      if (!e.title || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) return;
      var st = /^\d{1,2}:\d{2}$/.test(e.start_time || '') ? e.start_time : null;
      var et = st && /^\d{1,2}:\d{2}$/.test(e.end_time || '') ? e.end_time : null;
      var kind = e.kind === 'birthday' || e.kind === 'countdown' ? e.kind : 'event';
      var rule = kind === 'event' && e.repeat && e.repeat !== 'none' ? ruleFor(e.repeat, e.date, e.weekdays) : null;
      var who = memberId(e.person);
      var detail = [FB.i18n.relDay ? FB.i18n.relDay(e.date) : e.date, st ? st + (et ? '–' + et : '') : null,
        rule ? FB.recur.describe(rule, FB.i18n.L) : null, e.remind_minutes != null ? t('ai.remind', { n: e.remind_minutes }) : null, who ? FB.logic.member(who).name : null].filter(Boolean).join(' · ');
      out.push({ icon: kind === 'birthday' ? '🎂' : kind === 'countdown' ? '⏳' : '📅', title: e.title, detail: detail, save: function () {
        return FB.data.add('events', { title: e.title, kind: kind, on_date: e.date, end_date: null, all_day: !st, start_time: st, end_time: et,
          member_id: who, rule: rule, remind_minutes: kind === 'event' && st && e.remind_minutes != null ? Number(e.remind_minutes) : null, birth_year: null, notes: '' });
      } });
    });
    (data.shopping || []).forEach(function (s) {
      if (!s.title) return;
      out.push({ icon: '🛒', title: s.title, detail: t('ai.toShop') + (CATS[s.category] ? ' · ' + A.catLabel(s.category) : ''), save: function () {
        return FB.data.add('shopping_items', { title: s.title, done: false, added_by: FB.state.me || null, created_at: new Date().toISOString(), done_at: null, category: CATS[s.category] ? s.category : null });
      } });
    });
    (data.chores || []).forEach(function (c) {
      if (!c.title) return;
      var who = memberId(c.person), rule = ruleFor(c.repeat, U.today(), c.weekdays);
      var due = /^\d{1,2}:\d{2}$/.test(c.due_time || '') ? c.due_time : null;
      out.push({ icon: c.emoji || '🧹', title: c.title, detail: t('ai.chore') + ' · ' + FB.recur.describe(rule, FB.i18n.L) + (due ? ' · ' + t('chore.by', { time: due }) : '') + (who ? ' · ' + FB.logic.member(who).name : ''), save: function () {
        return FB.data.add('chores', { title: c.title, emoji: c.emoji || '', member_id: who, rule: rule, due_time: due, active: true });
      } });
    });
    (data.notes || []).forEach(function (n) {
      if (!n.body) return;
      out.push({ icon: '📝', title: n.body, detail: t('ai.note'), save: function () {
        return FB.data.add('notes', { body: n.body, author: FB.state.me || null, pinned: false, created_at: new Date().toISOString() });
      } });
    });
    return out;
  }

  var canRecord = function () { return !!(root.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); };

  FB.actions.openQuick = function () {
    var modal, rec = null, stream = null, chunks = [], recTimer = null;
    var ta = h('textarea', { rows: '3', maxlength: '500', 'data-fid': 'ai-text', placeholder: t('ai.ph') });
    var body = h('div', { class: 'ai-q' });
    var msg = h('p', { class: 'form-err', role: 'alert' });
    var go = h('button', { class: 'btn', onclick: function () { run({ text: ta.value.trim() }); } }, ui.icon('sparkle', 18), ' ', t('ai.go'));
    var mic = canRecord() ? h('button', { type: 'button', class: 'btn ghost ai-mic', 'aria-label': t('ai.mic'), onclick: toggleMic }, ui.icon('mic', 20), ' ', t('ai.mic')) : null;

    function stopStream() { if (stream) { stream.getTracks().forEach(function (x) { x.stop(); }); stream = null; } clearTimeout(recTimer); }
    function toggleMic() {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      msg.textContent = '';
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s; chunks = [];
        rec = new root.MediaRecorder(s);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          var type = rec.mimeType || 'audio/webm', blob = new Blob(chunks, { type: type });
          stopStream(); mic.classList.remove('rec'); mic.lastChild.textContent = t('ai.mic');
          if (blob.size < 1500) { msg.textContent = t('ai.tooShort'); return; }
          var fr = new FileReader();
          fr.onload = function () { run({ audio: { mime: type.split(';')[0], data: String(fr.result).split(',')[1] } }); };
          fr.readAsDataURL(blob);
        };
        rec.start(); mic.classList.add('rec'); mic.lastChild.textContent = t('ai.stop');
        recTimer = setTimeout(function () { if (rec && rec.state === 'recording') rec.stop(); }, 30000);
      }, function () { msg.textContent = t('ai.micDenied'); });
    }

    function input() {
      U.clear(body);
      body.appendChild(h('p', { class: 'hint' }, t('ai.hint')));
      body.appendChild(ta);
      body.appendChild(h('div', { class: 'ai-row' }, mic, h('span', { class: 'grow' }), go));
      body.appendChild(msg);
    }
    function busy() { U.clear(body); body.appendChild(h('div', { class: 'ai-wait' }, h('span', { class: 'ai-spin' }), h('p', null, t('ai.thinking')))); }
    function review(list) {
      U.clear(body);
      var on = list.map(function () { return true; });
      var addBtn = h('button', { class: 'btn' }, '');
      function count() { var n = on.filter(Boolean).length; addBtn.textContent = t('ai.add', { n: n }); addBtn.disabled = !n; }
      var rows = list.map(function (p, i) {
        var cb = h('input', { type: 'checkbox', checked: true, onchange: function () { on[i] = cb.checked; count(); } });
        return h('label', { class: 'row ai-prop' }, h('span', { class: 'row-emoji' }, p.icon), h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, p.title), h('span', { class: 'row-sub' }, p.detail)), cb);
      });
      body.appendChild(h('p', { class: 'hint' }, t('ai.review')));
      body.appendChild(h('div', { class: 'ai-list' }, rows));
      addBtn.onclick = function () {
        addBtn.disabled = true;
        Promise.all(list.filter(function (p, i) { return on[i]; }).map(function (p) { return p.save(); })).then(function () {
          modal.close(); ui.toast(t('ai.added'));
        });
      };
      body.appendChild(h('div', { class: 'ai-row' }, h('button', { class: 'btn ghost', onclick: input }, t('common.back')), h('span', { class: 'grow' }), addBtn));
      count();
    }
    function run(src) {
      if (!src.text && !src.audio) { msg.textContent = t('ai.empty'); return; }
      busy();
      var n = nowInfo();
      var payload = { action: 'quick', lang: FB.i18n.lang, today: n.today, weekday: n.weekday, time: n.time,
        members: FB.state.members.map(function (m) { return m.name; }), text: src.text || null, audio: src.audio || null };
      FB.store.ai(payload).then(function (data) {
        var list = proposals(data);
        if (!list.length) { input(); msg.textContent = data.reply || t('ai.nothing'); return; }
        review(list);
      }, function (e) { input(); msg.textContent = t(A.errKey(e)); });
    }
    input();
    modal = ui.modal({ title: t('ai.title'), size: 'wide', body: body, focus: false, onClose: function () { if (rec && rec.state === 'recording') { try { rec.onstop = null; rec.stop(); } catch (e) { /* ignore */ } } stopStream(); } });
    setTimeout(function () { ta.focus(); }, 50);
  };

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
    var recent = cur && Date.now() - cur.at < 20 * 60 * 1000 && cur.date === ctx.date;
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
