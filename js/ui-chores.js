/* Chores screen: manage the list of chores, and see who did what (history). */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, L = FB.logic, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  FB.views = FB.views || {};
  FB.actions = FB.actions || {};

  var tab = 'chores';

  function tabs() {
    return ui.seg([{ v: 'chores', label: t('chores.tabChores') }, { v: 'history', label: t('chores.tabHistory') }], tab, function (v) { tab = v; FB.app.render(); });
  }

  var DOTS = [1, 2, 3, 4, 5, 6, 0];
  /* mini day dots for daily / weekly rules, plain text for the rest */
  function ruleView(r) {
    if (r && (r.interval || 1) === 1 && r.freq === 'weekly') {
      var on = r.weekdays && r.weekdays.length ? r.weekdays : [U.weekday(r.start)];
      return h('span', { class: 'mini-dots', 'aria-label': FB.recur.describe(r, FB.i18n.L) }, DOTS.map(function (d) {
        return h('i', { class: on.indexOf(d) !== -1 ? 'on' : '' }, FB.i18n.dayShort(d).charAt(0));
      }));
    }
    if (r && r.freq === 'once') return h('span', { class: 'meta-txt' }, FB.i18n.relDay(r.start));
    return h('span', { class: 'meta-txt' }, FB.recur.describe(r, FB.i18n.L));
  }

  function choreRow(c, today, finished) {
    var m = L.member(c.member_id), last = L.lastDone(c.id), lm = last ? L.member(last.done_by) : null;
    var next = c.active && c.rule && c.rule.freq !== 'once' ? FB.recur.nextOccurrence(c.rule, today, 400) : null;
    var meta = h('span', { class: 'row-meta' },
      h('span', { class: 'who-pill', style: { '--c': m ? m.color : 'var(--ink-3)' } }, m ? ui.avatar(m, 22) : null, m ? m.name : t('board.everyone')),
      ruleView(c.rule),
      c.due_time ? h('span', { class: 'meta-txt' }, t('chore.by', { time: FB.i18n.hm(c.due_time) })) : null,
      next && next !== today ? h('span', { class: 'meta-txt' }, '→ ' + FB.i18n.relDay(next)) : null);
    var sw = h('button', { type: 'button', class: 'mini-sw' + (c.active ? ' on' : ''), role: 'switch', 'aria-checked': c.active ? 'true' : 'false', 'aria-label': t('chore.active'),
      onclick: function (e) { e.stopPropagation(); FB.data.edit('chores', c.id, { active: !c.active }); } }, h('i'));
    if (finished) {
      var on = L.onceDoneOn(c);
      meta = h('span', { class: 'row-meta' }, h('span', { class: 'meta-txt' }, t('chores.doneOn', { when: on ? FB.i18n.relDay(on) : '' })));
      sw = h('button', { type: 'button', class: 'btn small again-btn', onclick: function (e) { e.stopPropagation(); FB.actions.doAgain(c); } }, ui.icon('repeat', 18), ' ', t('chores.again'));
      last = null;
    }
    return h('div', { role: 'button', tabindex: '0', class: 'row chore-row' + (c.active ? '' : ' paused') + (finished ? ' finished' : ''), onclick: function () { FB.actions.openChore(c); },
      onkeydown: function (e) { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); FB.actions.openChore(c); } } },
      h('span', { class: 'row-emoji' }, c.emoji || '•'),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, c.title),
        meta,
        last ? h('span', { class: 'row-sub' }, t('chore.last', { name: lm ? lm.name : t('chore.someone'), when: FB.i18n.relDay(last.on_date) })) : null),
      sw);
  }

  var showDone = false;
  function choreList() {
    var wrap = h('div', { class: 'list chore-groups' });
    var today = U.today();
    var g = { today: [], repeat: [], once: [], paused: [], done: [] };
    FB.state.chores.forEach(function (c) {
      if (L.onceFinished(c)) g.done.push(c);
      else if (!c.active) g.paused.push(c);
      else if (FB.recur.occursOn(c.rule, today)) g.today.push(c);
      else if (c.rule && c.rule.freq === 'once') g.once.push(c);
      else g.repeat.push(c);
    });
    function byTime(a, b) { return (a.due_time || '99').localeCompare(b.due_time || '99') || a.title.localeCompare(b.title); }
    g.once.sort(function (a, b) { return (a.rule.start || '').localeCompare(b.rule.start || '') || a.title.localeCompare(b.title); });
    g.done.sort(function (a, b) { return (L.onceDoneOn(b) || '').localeCompare(L.onceDoneOn(a) || ''); });
    var any = false;
    [['today', 'chores.g.today'], ['repeat', 'chores.g.repeat'], ['once', 'chores.g.once'], ['paused', 'chores.g.paused']].forEach(function (x) {
      var items = g[x[0]];
      if (!items.length) return;
      any = true;
      if (x[0] !== 'once') items.sort(byTime);
      wrap.appendChild(h('h3', { class: 'grp' }, t(x[1]), h('span', { class: 'grp-n' }, String(items.length))));
      wrap.appendChild(h('div', { class: 'chore-grid' }, items.map(function (c) { return choreRow(c, today); })));
    });
    if (g.done.length) {
      any = true;
      /* finished one-time chores: out of the way, one tap to bring any of them back */
      wrap.appendChild(h('button', { type: 'button', class: 'grp grp-btn', 'aria-expanded': showDone ? 'true' : 'false', onclick: function () { showDone = !showDone; FB.app.render(); } },
        t('chores.g.done'), h('span', { class: 'grp-n' }, String(g.done.length)), ui.icon(showDone ? 'down' : 'right', 16)));
      if (showDone) wrap.appendChild(h('div', { class: 'chore-grid' }, g.done.map(function (c) { return choreRow(c, today, true); })));
    }
    if (!any) wrap.appendChild(ui.empty('🧹', t('chores.empty'), t('empty.choresAll')));
    return wrap;
  }

  function historyList() {
    var wrap = h('div', { class: 'list' });
    var counts = L.weekCounts();
    var members = L.choreMembers();
    wrap.appendChild(h('h3', { class: 'grp' }, t('hist.week')));
    wrap.appendChild(h('div', { class: 'week-counts' }, members.map(function (m) {
      return h('div', { class: 'wc', style: { '--c': m.color } }, ui.avatar(m, 36), h('b', null, String(counts[m.id] || 0)), h('span', null, m.name));
    })));
    var items = L.recentCompletions(150);
    if (!items.length) { wrap.appendChild(ui.empty('📜', t('hist.empty'))); return wrap; }
    var lastDay = null;
    items.forEach(function (c) {
      var day = c.done_at.slice(0, 10);
      var local = new Date(c.done_at); var dayLocal = U.ymd(local);
      if (dayLocal !== lastDay) { lastDay = dayLocal; wrap.appendChild(h('h3', { class: 'grp' }, FB.i18n.relDay(dayLocal, true))); }
      var ch = L.chore(c.chore_id), m = L.member(c.done_by);
      wrap.appendChild(h('div', { class: 'row static' },
        ui.avatar(m, 34),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, (ch ? (ch.emoji ? ch.emoji + ' ' : '') + ch.title : t('hist.removed'))),
          h('span', { class: 'row-sub' }, (m ? m.name : t('chore.someone')) + ' · ' + FB.i18n.timeOf(c.done_at)))));
      void day;
    });
    return wrap;
  }

  FB.views.chores = function () {
    var head = h('div', { class: 'page-head' },
      h('h1', null, t('nav.chores')),
      tabs(),
      h('span', { class: 'grow' }),
      tab === 'chores' ? h('button', { class: 'btn', onclick: function () { FB.actions.openChore(null); } }, ui.icon('plus', 20), ' ', t('chores.add')) : null);
    return h('div', { class: 'page', 'data-scroll': 'page-chores' }, head, tab === 'chores' ? choreList() : historyList());
  };

  /* ---------------------------------------------------------------- */
  /*  Chore form                                                        */
  /* ---------------------------------------------------------------- */
  /* ---------- pieces shared by the chore sheet and "Do it again" ---------- */
  /* one tap per person; "Anyone" first */
  function whoPicker(value, onChange) {
    var el = h('div', { class: 'who-pick', role: 'radiogroup', 'aria-label': t('chore.who') });
    function draw() {
      U.clear(el);
      [null].concat(L.choreMembers(value)).forEach(function (m) {
        var id = m ? m.id : null, on = (value || null) === id;
        el.appendChild(h('button', { type: 'button', class: 'wp' + (on ? ' on' : ''), role: 'radio', 'aria-checked': on ? 'true' : 'false', style: { '--c': m ? m.color : 'var(--label-3)' },
          onclick: function () { value = id; draw(); onChange(id); } },
          m ? ui.avatar(m, 40) : h('span', { class: 'wp-any' }, ui.icon('user', 20)), h('span', { class: 'wp-n' }, m ? m.name : t('chore.anyone'))));
      });
    }
    draw();
    return el;
  }
  /* when: Today / Tomorrow / a date (+ Every day / Every week for a chore's sheet) */
  function whenKey(r, today) {
    if (!r) return 'today';
    if (r.freq === 'once') return r.start === today ? 'today' : r.start === U.addDays(today, 1) ? 'tomorrow' : 'date';
    if ((r.interval || 1) === 1 && r.freq === 'daily' && !r.until) return 'daily';
    if ((r.interval || 1) === 1 && r.freq === 'weekly' && !r.until && (!r.weekdays || r.weekdays.length <= 1)) return 'weekly';
    return 'custom';
  }
  function whenPicker(rule, withRepeat, onChange) {
    var today = U.today(), key = whenKey(rule, today), date = rule && rule.freq === 'once' ? rule.start : today;
    var el = h('div', { class: 'when-pick' });
    var dateIn = h('input', { type: 'date', value: date, min: today, 'aria-label': t('rule.date'), onchange: function () { if (dateIn.value) { date = dateIn.value; pick('date'); } } });
    function ruleFor(k) {
      if (k === 'today') return Object.assign(FB.recur.defaultRule(today), { freq: 'once' });
      if (k === 'tomorrow') return Object.assign(FB.recur.defaultRule(U.addDays(today, 1)), { freq: 'once' });
      if (k === 'date') return Object.assign(FB.recur.defaultRule(date), { freq: 'once' });
      if (k === 'daily') return Object.assign(FB.recur.defaultRule(today), { freq: 'daily' });
      if (k === 'weekly') return Object.assign(FB.recur.defaultRule(today), { freq: 'weekly', weekdays: [U.weekday(today)] });
      return rule;
    }
    function pick(k) { key = k; draw(); onChange(ruleFor(k), k); }
    function draw() {
      U.clear(el);
      var keys = ['today', 'tomorrow'].concat(withRepeat ? ['daily', 'weekly'] : []);
      keys.forEach(function (k) {
        el.appendChild(h('button', { type: 'button', class: 'chip' + (key === k ? ' on' : ''), 'aria-pressed': key === k ? 'true' : 'false', onclick: function () { pick(k); } }, t('when.' + k)));
      });
      if (key === 'custom') el.appendChild(h('button', { type: 'button', class: 'chip on', 'aria-pressed': 'true' }, FB.recur.describe(rule, FB.i18n.L)));
      el.appendChild(h('label', { class: 'chip chip-date' + (key === 'date' ? ' on' : '') }, ui.icon('calendar', 16), h('span', null, key === 'date' ? FB.i18n.relDay(date) : t('when.date')), dateIn));
    }
    draw();
    return { el: el, set: function (r) { rule = r; key = whenKey(r, today); if (r && r.freq === 'once') date = r.start; draw(); } };
  }

  /* the icon a name suggests (English and Albanian words); used until someone picks an icon by hand */
  var ICON_WORDS = [
    ['🍽️', 'dish|plate|enë|enet|pjat'], ['🗑️', 'trash|rubbish|garbage|bin|pleh|mbeturin'], ['🧺', 'laundry|wash clothes|rroba|lan'], ['👕', 'iron|hekur|palos|fold'],
    ['🧹', 'vacuum|sweep|broom|fshes|fshij|shtup'], ['🍳', 'cook|dinner|lunch|breakfast|gatu|darkë|darke|drekë|dreke|mëngjes'], ['🛒', 'shop|grocer|buy|blej|pazar|market'],
    ['🪴', 'plant|water the|lule|ujit'], ['🐕', 'dog|walk|qen'], ['🐈', 'cat|litter|mace'], ['🛏️', 'bed|sheets|shtrat|çarçaf|carcaf'], ['🚿', 'bath|shower|toilet|banjo|dush|tualet'],
    ['🪟', 'window|glass|dritar|xham'], ['🚗', 'car|makin'], ['💳', 'bill|pay|fatur|pages'], ['📚', 'homework|study|read|detyr|mësim|mesim|libr'], ['🧸', 'toy|lodr'],
    ['💊', 'medicine|pill|ilaç|ilac'], ['🧽', 'clean|mop|wipe|pastro|fshi'], ['🌱', 'garden|kopsht|bar'], ['🔧', 'fix|repair|rregullo|ndreq'], ['☕', 'coffee|kafe'], ['📦', 'box|parcel|pako|kuti']
  ];
  function iconFor(name) {
    var n = (name || '').toLowerCase();
    for (var i = 0; i < ICON_WORDS.length; i++) if (new RegExp(ICON_WORDS[i][1]).test(n)) return ICON_WORDS[i][0];
    return null;
  }
  /* names to pick from: the family's templates, then chores you have had before */
  /* names to pick from while typing: the family's own chores and templates first, then the common chores (both languages) */
  function suggestions(typed) {
    var q = (typed || '').trim().toLowerCase(), seen = {}, out = [];
    FB.state.chores.forEach(function (c) { out.push({ title: c.title, emoji: c.emoji, due_time: c.due_time || null, chore: c }); });
    FB.state.templates.forEach(function (it) { out.push({ title: FB.templates.label(it), emoji: it.emoji, due_time: it.due_time || null, rule: it.rule && it.rule.freq !== 'once' ? it.rule : null }); });
    FB.templates.all().forEach(function (it) { out.push({ title: FB.templates.name(it), alt: FB.i18n.lang === 'sq' ? it.en : it.sq, emoji: it.emoji, due_time: it.time || null, rule: it.rule }); });
    return out.filter(function (x) {
      var k = x.title.trim().toLowerCase(), a = (x.alt || '').toLowerCase();
      if (!k || seen[k] || k === q || (q && k.indexOf(q) < 0 && a.indexOf(q) < 0)) return false;
      seen[k] = true; return true;
    }).slice(0, 8);
  }
  /* a finished one-time chore with this name (to bring back instead of making a copy) */
  function finishedNamed(name) {
    var k = (name || '').trim().toLowerCase();
    return FB.state.chores.filter(function (c) { return c.title.trim().toLowerCase() === k && L.onceFinished(c); })[0] || null;
  }

  /* ---------- when: day chips + the week's days in one row, no menus ---------- */
  function planPicker(rule, onChange) {
    var today = U.today(), mode, days = [], date = today, custom = null;
    function read(r) {
      custom = null; days = [];
      if (!r || r.freq === 'once') { date = r ? r.start : today; mode = date === today ? 'today' : date === U.addDays(today, 1) ? 'tomorrow' : 'date'; return; }
      var plain = (r.interval || 1) === 1 && !r.until;
      if (plain && r.freq === 'daily') { mode = 'daily'; return; }
      if (plain && r.freq === 'weekly') { mode = 'days'; days = (r.weekdays && r.weekdays.length ? r.weekdays : [U.weekday(r.start)]).slice(); return; }
      mode = 'custom'; custom = r;
    }
    function build() {
      if (mode === 'today') return Object.assign(FB.recur.defaultRule(today), { freq: 'once' });
      if (mode === 'tomorrow') return Object.assign(FB.recur.defaultRule(U.addDays(today, 1)), { freq: 'once' });
      if (mode === 'date') return Object.assign(FB.recur.defaultRule(date), { freq: 'once' });
      if (mode === 'daily') return Object.assign(FB.recur.defaultRule(today), { freq: 'daily' });
      if (mode === 'days') return Object.assign(FB.recur.defaultRule(today), { freq: 'weekly', weekdays: DOTS.filter(function (d) { return days.indexOf(d) >= 0; }) });
      return custom;
    }
    read(rule);
    var el = h('div', { class: 'plan' });
    var dateIn = h('input', { type: 'date', min: today, 'aria-label': t('rule.date'), onchange: function () { if (dateIn.value) { date = dateIn.value; set('date'); } } });
    function set(m) { mode = m; if (m !== 'days') days = []; draw(); onChange(build()); }
    function chip(k, label, on, fn) { return h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: fn || function () { set(k); } }, label); }
    function draw() {
      U.clear(el);
      dateIn.value = date;
      el.appendChild(h('div', { class: 'when-pick' },
        chip('today', t('when.today'), mode === 'today'),
        chip('tomorrow', t('when.tomorrow'), mode === 'tomorrow'),
        chip('daily', t('when.daily'), mode === 'daily'),
        mode === 'custom' ? chip('custom', FB.recur.describe(custom, FB.i18n.L), true, function () {}) : null,
        h('label', { class: 'chip chip-date' + (mode === 'date' ? ' on' : '') }, ui.icon('calendar', 16), h('span', null, mode === 'date' ? FB.i18n.relDay(date) : t('when.date')), dateIn)));
      /* the week's days: tap one or more to repeat on them */
      el.appendChild(h('div', { class: 'dow-row', role: 'group', 'aria-label': t('when.repeatOn') },
        h('span', { class: 'dow-l' }, t('when.repeatOn')),
        DOTS.map(function (d) {
          var on = mode === 'days' && days.indexOf(d) >= 0;
          return h('button', { type: 'button', class: 'dow' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', 'aria-label': FB.i18n.dayLong ? FB.i18n.dayLong(d) : FB.i18n.dayShort(d),
            onclick: function () {
              if (mode !== 'days') days = [];
              var i = days.indexOf(d); if (i >= 0) days.splice(i, 1); else days.push(d);
              if (days.length === 7) { set('daily'); return; }
              if (!days.length) { set('today'); return; }
              mode = 'days'; draw(); onChange(build());
            } }, FB.i18n.dayShort(d).charAt(0));
        })));
    }
    draw();
    return { el: el, set: function (r) { read(r); draw(); onChange(build()); }, get: build };
  }

  /* ---------- by when: a few usual times as chips; Other opens the hour picker in place ---------- */
  var TIMES = ['09:00', '15:00', '19:00'];
  function timePicker(value, onChange) {
    var v = value || null, other = !!(v && TIMES.indexOf(v) < 0);
    var el = h('div', { class: 'when-pick time-pick' });
    var tf = ui.timeField({ value: v || '18:00', onchange: function () { v = tf.value; onChange(v); } });
    function set(x, o) { v = x; other = !!o; draw(); onChange(v); }
    function draw() {
      U.clear(el);
      el.appendChild(h('button', { type: 'button', class: 'chip' + (!v ? ' on' : ''), 'aria-pressed': !v ? 'true' : 'false', onclick: function () { set(null); } }, t('when.noTime')));
      TIMES.forEach(function (x) { var on = v === x && !other; el.appendChild(h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () { set(x); } }, FB.i18n.hm(x))); });
      el.appendChild(h('button', { type: 'button', class: 'chip' + (other ? ' on' : ''), 'aria-pressed': other ? 'true' : 'false', onclick: function () { set(tf.value || '18:00', true); } }, t('when.otherTime')));
      if (other) el.appendChild(tf);
    }
    draw();
    return { el: el, set: function (x) { v = x; other = !!(x && TIMES.indexOf(x) < 0); if (x) tf.value = x; draw(); onChange(v); }, get: function () { return v; } };
  }

  /* ---------- one typed line: "Lori laj enët çdo ditë 19:00" -> who, days, time and the name ---------- */
  var DAY_WORDS = [
    [0, 'sunday|sun|e diel|diel|dielën|dielen'], [1, 'monday|mon|e hënë|hënë|hene|hënën|henen'], [2, 'tuesday|tue|tues|e martë|martë|marte|martën|marten'],
    [3, 'wednesday|wed|e mërkurë|mërkurë|merkure|mërkurën|merkuren'], [4, 'thursday|thu|thur|thurs|e enjte|enjte|enjten'], [5, 'friday|fri|e premte|premte|premten'], [6, 'saturday|sat|e shtunë|shtunë|shtune|shtunën|shtunen']
  ];
  function esc(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function parseLine(text) {
    var s = ' ' + text + ' ', out = {}, B = '(^|[\\s,.;])', E = '(?=$|[\\s,.;])';
    function take(re) { var m = re.exec(s); if (!m) return null; s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); return m; }
    /* who: a family member's name */
    L.choreMembers().forEach(function (m) { if (!out.who && take(new RegExp(B + esc(m.name) + E, 'i'))) out.who = m.id; });
    /* time: 19:00, 7.30, 7pm, "ora 19", "at 7" (a bare number is not a time) */
    var tre = /(^|\s)((?:(?:at|by|në|ne|deri|ora|orën|oren)\s+)*)(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?(?=$|[\s,.;])/gi, tm;
    while ((tm = tre.exec(s))) {
      if (!(tm[4] || tm[5] || tm[2])) continue;
      var hh = +tm[3], mm = tm[4] ? +tm[4] : 0;
      if (tm[5] && /pm/i.test(tm[5]) && hh < 12) hh += 12;
      if (tm[5] && /am/i.test(tm[5]) && hh === 12) hh = 0;
      if (hh > 23 || mm > 59) continue;
      out.time = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      s = s.slice(0, tm.index) + ' ' + s.slice(tm.index + tm[0].length);
      break;
    }
    /* days */
    if (take(new RegExp(B + '(every\\s*day|daily|each day|çdo ditë|cdo dite|çdo dite|për ditë|perdite|përditë)' + E, 'i'))) out.mode = 'daily';
    else if (take(new RegExp(B + '(weekdays|work\\s*days|ditët e punës|ditet e punes|ditë pune)' + E, 'i'))) { out.mode = 'days'; out.days = [1, 2, 3, 4, 5]; }
    else if (take(new RegExp(B + '(weekends?|fundjavë|fundjave|në fundjavë)' + E, 'i'))) { out.mode = 'days'; out.days = [6, 0]; }
    else if (take(new RegExp(B + '(every\\s*week|weekly|çdo javë|cdo jave|javore)' + E, 'i'))) { out.mode = 'days'; out.days = [U.weekday(U.today())]; }
    else if (take(new RegExp(B + '(today|sot)' + E, 'i'))) out.mode = 'today';
    else if (take(new RegExp(B + '(tomorrow|nesër|neser)' + E, 'i'))) out.mode = 'tomorrow';
    else {
      var every = !!take(new RegExp(B + '(every|each|çdo|cdo)' + E, 'i')), found = [];
      DAY_WORDS.forEach(function (d) { if (take(new RegExp(B + '(' + d[1] + ')' + E, 'i'))) found.push(d[0]); });
      if (found.length) while (take(new RegExp(B + '(and|dhe|,)' + E, 'i'))) { /* joiners between days */ }
      if (found.length && (every || found.length > 1)) { out.mode = 'days'; out.days = found; }
      else if (found.length) { var dd = U.today(); for (var i = 0; i < 7 && U.weekday(dd) !== found[0]; i++) dd = U.addDays(dd, 1); out.mode = 'date'; out.date = dd; }
    }
    var name = s.replace(/\s+/g, ' ').trim().replace(/^[,.;-]+|[,.;-]+$/g, '').trim();
    out.title = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
    return out;
  }

  /* ---------- the chore sheet: name, who, when, Save. Everything else under "More options" ---------- */
  FB.actions.openChore = function (existing, prefill) {
    var isNew = !existing, today = U.today();
    var c = existing ? Object.assign({}, existing) : { title: '', emoji: '', member_id: null, rule: Object.assign(FB.recur.defaultRule(today), { freq: 'once' }), due_time: null, active: true };
    if (prefill) c = Object.assign(c, prefill);
    var modal, emoji = c.emoji || '', iconByHand = !isNew, rule = c.rule, who = c.member_id || null, more = false;

    var err = h('p', { class: 'form-err', role: 'alert' });
    var sug = h('div', { class: 'sug-row' });
    var title = h('input', { type: 'text', value: c.title, placeholder: t('chore.titlePh'), maxlength: '80', enterkeyhint: 'done',
      oninput: function () { autoIcon(); drawSug(); understand(); } });
    var iconBox = h('div'), iconPrev = h('span', { class: 'name-ico', 'aria-hidden': 'true' });
    var time = timePicker(c.due_time || null, function () {});
    var active = h('input', { type: 'checkbox', checked: c.active !== false });
    var rec = null, recBox = h('div');
    var plan = planPicker(rule, function (r) { rule = r; if (rec) drawRec(); });
    var whoEl = whoPicker(who, function (v) { who = v; });

    function drawIcon() {
      U.clear(iconBox);
      iconBox.appendChild(ui.emojiGrid(ui.CHORE_EMOJI, emoji, function (v) { emoji = v; iconByHand = true; iconPrev.textContent = v; iconPrev.classList.remove('empty'); }, true));
      iconPrev.textContent = emoji || '🧹'; iconPrev.classList.toggle('empty', !emoji); /* no icon yet: a faint broom, the default */
    }
    function autoIcon() {
      if (iconByHand) return;
      var e = iconFor(title.value);
      if (e && e !== emoji) { emoji = e; drawIcon(); }
    }
    /* empty name: the common chores by room, one tap fills name, icon, usual days and time.
       typing: matching names from your chores, your templates and the common list */
    var sugCat = 0;
    function pickSug(x) {
      title.value = x.title; emoji = x.emoji || iconFor(x.title) || emoji; iconByHand = !!x.emoji; drawIcon();
      if (x.rule) plan.set(Object.assign({}, x.rule, { start: U.today() }));
      time.set(x.due_time || null);
      if (x.chore && x.chore.member_id && !who) { who = x.chore.member_id; var nw = whoPicker(who, function (v) { who = v; }); whoEl.replaceWith(nw); whoEl = nw; }
      drawSug(); title.focus();
    }
    function sugChip(x) { return h('button', { type: 'button', class: 'chip sug', onclick: function () { pickSug(x); } }, x.emoji ? h('span', { class: 'sug-e' }, x.emoji) : null, x.title); }
    function drawSug() {
      U.clear(sug);
      if (!isNew) return;
      if (title.value.trim()) { suggestions(title.value).forEach(function (x) { sug.appendChild(sugChip(x)); }); return; }
      var groups = FB.templates.catalog();
      sug.appendChild(h('div', { class: 'cat-tabs', role: 'tablist', 'aria-label': t('chore.common') }, groups.map(function (g, i) {
        return h('button', { type: 'button', role: 'tab', class: 'cat-tab' + (i === sugCat ? ' on' : ''), 'aria-selected': i === sugCat ? 'true' : 'false', onclick: function () { sugCat = i; drawSug(); } }, t(g.key));
      })));
      sug.appendChild(h('div', { class: 'cat-items' }, groups[sugCat].items.map(function (it) {
        return sugChip({ title: FB.templates.name(it), emoji: it.emoji, due_time: it.time || null, rule: it.rule });
      })));
    }
    /* what the typed line says (a name, days, a time) shows straight away in the chips below */
    function understand() {
      var o = parseLine(title.value);
      if (o.who && o.who !== who) { who = o.who; var nw = whoPicker(who, function (v) { who = v; }); whoEl.replaceWith(nw); whoEl = nw; }
      if (o.mode) {
        var td = U.today(), r = o.mode === 'today' ? Object.assign(FB.recur.defaultRule(td), { freq: 'once' })
          : o.mode === 'tomorrow' ? Object.assign(FB.recur.defaultRule(U.addDays(td, 1)), { freq: 'once' })
          : o.mode === 'date' ? Object.assign(FB.recur.defaultRule(o.date), { freq: 'once' })
          : o.mode === 'daily' ? Object.assign(FB.recur.defaultRule(td), { freq: 'daily' })
          : Object.assign(FB.recur.defaultRule(td), { freq: 'weekly', weekdays: o.days });
        if (JSON.stringify(r) !== JSON.stringify(rule)) plan.set(r);
      }
      if (o.time && o.time !== time.get()) time.set(o.time);
      var e = iconFor(o.title); if (!iconByHand && e && e !== emoji) { emoji = e; drawIcon(); }
    }
    function drawRec() {
      U.clear(recBox);
      rec = ui.recurEditor(rule, { onceLabel: t('rule.f.once'), advanced: true }); /* only the rarer repeats: the days are already above */
      recBox.appendChild(rec.el);
    }

    function save() {
      var raw = title.value.trim(), name = (raw && parseLine(raw).title) || raw; /* "Lori laj enët 19:00" is saved as "Laj enët" */
      if (!name) { err.textContent = t('chore.needTitle'); title.focus(); return; }
      var r = more && rec ? rec.get() : plan.get();
      var row = {
        title: name, emoji: emoji || iconFor(name) || '🧹', member_id: who || null, rule: r,
        due_time: time.get() || null, active: active.checked
      };
      /* the same one-time chore again: bring the finished one back rather than making a copy */
      var again = isNew && r.freq === 'once' ? finishedNamed(name) : null;
      var p = again ? FB.data.edit('chores', again.id, row) : isNew ? FB.data.add('chores', row) : FB.data.edit('chores', existing.id, row);
      p.then(function (res) { if (res) modal.close(); });
    }

    var moreBody = h('div', { class: 'more-body', hidden: true },
      ui.field(t('chore.icon'), iconBox),
      ui.field(t('chore.repeatMore'), recBox, t('chore.repeatMoreHint')),
      h('label', { class: 'check' }, active, h('span', null, t('chore.active'))),
      isNew ? h('button', { type: 'button', class: 'btn ghost', onclick: function () { modal.close(); FB.actions.openTemplates(); } }, ui.icon('list', 18), ' ', t('chore.fromTemplates')) : null);
    var moreBtn = h('button', { type: 'button', class: 'more-btn', 'aria-expanded': 'false', onclick: function () {
      more = !more; moreBody.hidden = !more; moreBtn.setAttribute('aria-expanded', more ? 'true' : 'false');
      moreBtn.lastChild.replaceWith(ui.icon(more ? 'down' : 'right', 16));
      if (more) drawRec(); else rec = null;
    } }, h('span', null, t('chore.more')), ui.icon('right', 16));

    var actions = [];
    if (!isNew) {
      actions.push(h('button', { class: 'btn danger ghost', onclick: function () {
        ui.confirm({ title: t('chore.deleteQ', { name: existing.title }), text: t('chore.deleteHint'), yes: t('common.delete'), danger: true }).then(function (ok) {
          if (ok) FB.data.del('chores', existing.id).then(function (r) { if (r) modal.close(); });
        });
      } }, ui.icon('trash', 20), ' ', t('common.delete')));
    }
    actions.push(h('span', { class: 'grow' }));
    actions.push(h('button', { class: 'btn ghost', onclick: function () { modal.close(); } }, t('common.cancel')));
    actions.push(h('button', { class: 'btn', onclick: save }, isNew ? t('chore.addOne') : t('common.save')));

    drawIcon(); drawSug();
    var body = h('form', { class: 'form chore-sheet', onsubmit: function (ev) { ev.preventDefault(); save(); } },
      h('div', { class: 'field' }, h('label', null, t('chore.title')), h('div', { class: 'name-row' }, iconPrev, title), isNew ? h('p', { class: 'hint' }, t('chore.typeHint')) : null, sug),
      ui.field(t('chore.who'), whoEl),
      ui.field(t('chore.when'), plan.el),
      ui.field(t('chore.byTime'), time.el, t('chore.timeHint')),
      err, moreBtn, moreBody);
    modal = ui.modal({ title: isNew ? t('chore.new') : t('chore.edit'), body: body, actions: actions, size: 'wide' });
  };

  /* "Do it again": a finished one-time chore, back for a new day in two taps */
  FB.actions.doAgain = function (c) {
    var modal, who = c.member_id || null, today = U.today(), rule = Object.assign(FB.recur.defaultRule(today), { freq: 'once' });
    var when = whenPicker(rule, false, function (r) { rule = r; });
    function go() {
      var r = Object.assign({}, rule); delete r.done;
      FB.data.edit('chores', c.id, { rule: r, member_id: who, active: true }).then(function (res) {
        if (!res) return;
        modal.close(); ui.toast(t('chores.againToast', { title: c.title, when: FB.i18n.relDay(r.start) }));
      });
    }
    modal = ui.modal({
      title: (c.emoji ? c.emoji + ' ' : '') + c.title, focus: false,
      body: h('div', { class: 'form chore-sheet' }, ui.field(t('chore.who'), whoPicker(who, function (v) { who = v; })), ui.field(t('chore.when'), when.el)),
      actions: [h('span', { class: 'grow' }), h('button', { class: 'btn ghost', onclick: function () { modal.close(); } }, t('common.cancel')),
        h('button', { class: 'btn', onclick: go }, ui.icon('repeat', 18), ' ', t('chores.again'))]
    });
  };

  /* ---------------------------------------------------------------- */
  /*  Templates: tick the usual chores and add them in one go           */
  /* ---------------------------------------------------------------- */
  FB.actions.openTemplates = function () {
    var modal, picked = {}, repeat = {};
    var who = h('select', { 'aria-label': t('tpl.assign') },
      h('option', { value: '' }, t('tpl.assign') + ': ' + t('chore.anyone')),
      L.choreMembers().map(function (m) { return h('option', { value: m.id }, t('tpl.assign') + ': ' + m.name); }));
    var addBtn = h('button', { class: 'btn', onclick: add }, '');
    var body = h('div', { class: 'tpl' });
    function have() { var o = {}; FB.state.chores.forEach(function (c) { if (!L.onceFinished(c)) o[c.title.trim().toLowerCase()] = true; }); return o; }
    function refresh() {
      var n = Object.keys(picked).length;
      addBtn.textContent = t('tpl.add', { n: n }); addBtn.disabled = !n;
    }
    function suggested(it) { return it.rule && it.rule.freq !== 'once' ? it.rule : Object.assign(FB.recur.defaultRule(U.today()), { freq: 'daily' }); }
    function draw() {
      U.clear(body);
      var list = FB.state.templates.slice().sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
      Object.keys(picked).forEach(function (id) { if (!list.some(function (x) { return x.id === id; })) { delete picked[id]; delete repeat[id]; } });
      if (!list.length) {
        body.appendChild(h('p', { class: 'lead' }, t('tpl.empty')));
        body.appendChild(h('button', { class: 'btn', onclick: function () {
          Promise.all(FB.templates.starter().map(function (it) { return FB.data.add('chore_templates', it); })).then(draw);
        } }, t('tpl.starter')));
      }
      var owned = have(), grid = h('div', { class: 'tpl-grid' });
      list.forEach(function (it) {
        var exists = owned[it.title.trim().toLowerCase()] || (it.title_sq && owned[it.title_sq.trim().toLowerCase()]) || owned[FB.templates.label(it).trim().toLowerCase()], on = !!picked[it.id];
        var tile = h('div', { class: 'tpl-tile' + (on ? ' on' : '') + (exists ? ' have' : ''), role: 'button', tabindex: exists ? '-1' : '0',
          'aria-pressed': on ? 'true' : 'false', title: exists ? t('tpl.have') : '',
          onclick: function () { if (exists) return; if (picked[it.id]) { delete picked[it.id]; delete repeat[it.id]; } else picked[it.id] = it; draw(); },
          onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click(); } } },
          h('span', { class: 'tpl-emoji' }, it.emoji || '•'),
          h('span', { class: 'tpl-name' }, FB.templates.label(it)),
          h('span', { class: 'tpl-sub' }, exists ? t('tpl.have') : !on && finishedNamed(FB.templates.label(it)) ? t('tpl.again') : (repeat[it.id] ? FB.recur.describe(suggested(it), FB.i18n.L) : t('rule.f.once')) + (it.due_time ? ' · ' + FB.i18n.hm(it.due_time) : '')),
          on ? h('span', { class: 'tpl-check' }, ui.icon('check', 14)) : null,
          on ? h('button', { type: 'button', class: 'tpl-rep' + (repeat[it.id] ? ' on' : ''), 'aria-label': t('tpl.repeat'), 'aria-pressed': repeat[it.id] ? 'true' : 'false',
            onclick: function (e) { e.stopPropagation(); repeat[it.id] = !repeat[it.id]; draw(); } }, ui.icon('repeat', 16)) : null,
          h('button', { type: 'button', class: 'tpl-edit', 'aria-label': t('common.edit'), onclick: function (e) { e.stopPropagation(); FB.actions.editTemplate(it, draw); } }, ui.icon('edit', 14)));
        grid.appendChild(tile);
      });
      if (list.length) body.appendChild(grid);
      refresh();
    }
    function add() {
      var items = Object.keys(picked).map(function (k) { return picked[k]; });
      if (!items.length) return;
      addBtn.disabled = true;
      Promise.all(items.map(function (it) {
        var rule = repeat[it.id] ? Object.assign({}, suggested(it), { start: U.today() }) : Object.assign(FB.recur.defaultRule(U.today()), { freq: 'once' });
        var row = { title: FB.templates.label(it), emoji: it.emoji, member_id: who.value || null, rule: rule, due_time: it.due_time || null, active: true };
        var again = finishedNamed(row.title); /* done before: bring that one back, keeping its history */
        return again ? FB.data.edit('chores', again.id, row) : FB.data.add('chores', row);
      })).then(function () { modal.close(); ui.toast(t('tpl.added', { n: items.length })); });
    }
    draw();
    modal = ui.modal({
      title: t('tpl.title'), size: 'wide tplwin', focus: false,
      body: h('div', null, h('div', { class: 'tpl-top' }, who, h('p', { class: 'hint' }, t('tpl.hint'))), body),
      actions: [
        h('button', { class: 'btn ghost', onclick: function () { modal.close(); FB.actions.openChore(null); } }, ui.icon('plus', 18), ' ', t('tpl.custom')),
        h('button', { class: 'btn ghost', onclick: function () { FB.actions.editTemplate(null, draw); } }, ui.icon('list', 18), ' ', t('tpl.new')),
        h('span', { class: 'grow' }), addBtn]
    });
  };

  FB.actions.editTemplate = function (existing, done) {
    var isNew = !existing;
    var c = existing ? Object.assign({}, existing) : { title: '', emoji: '🧹', rule: Object.assign(FB.recur.defaultRule(U.today()), { freq: 'once' }), due_time: null };
    var modal, emoji = c.emoji;
    var sq = FB.i18n.lang === 'sq';
    var title = h('input', { type: 'text', value: existing ? FB.templates.label(existing) : '', placeholder: t('chore.titlePh'), maxlength: '80' });
    var grid = ui.emojiGrid(ui.CHORE_EMOJI, emoji, function (v) { emoji = v; }, true);
    var hasTime = h('input', { type: 'checkbox', checked: !!c.due_time, onchange: function () { timeIn.style.display = hasTime.checked ? '' : 'none'; } });
    var timeIn = ui.timeField({ value: c.due_time || '18:00', style: { display: c.due_time ? '' : 'none' } });
    var rec = ui.recurEditor(c.rule, { onceLabel: t('rule.f.once') });
    var err = h('p', { class: 'form-err', role: 'alert' });
    function finish(r) { if (r) { modal.close(); if (done) done(); } }
    function save() {
      var name = title.value.trim();
      if (!name) { err.textContent = t('chore.needTitle'); title.focus(); return; }
      var row = { emoji: emoji || '', rule: rec.get(), due_time: hasTime.checked && timeIn.value ? timeIn.value : null };
      if (sq) { row.title_sq = name; if (isNew || !existing.title) row.title = name; } else { row.title = name; if (isNew) row.title_sq = name; }
      (isNew ? FB.data.add('chore_templates', row) : FB.data.edit('chore_templates', existing.id, row)).then(finish);
    }
    var actions = [];
    if (!isNew) actions.push(h('button', { class: 'btn danger ghost', onclick: function () {
      ui.confirm({ title: t('tpl.deleteQ', { name: existing.title }), text: t('tpl.deleteHint'), yes: t('common.delete'), danger: true }).then(function (ok) {
        if (ok) FB.data.del('chore_templates', existing.id).then(finish);
      });
    } }, ui.icon('trash', 20), ' ', t('common.delete')));
    actions.push(h('span', { class: 'grow' }), h('button', { class: 'btn ghost', onclick: function () { modal.close(); } }, t('common.cancel')), h('button', { class: 'btn', onclick: save }, t('common.save')));
    modal = ui.modal({
      title: isNew ? t('tpl.newTitle') : t('tpl.editTitle'), size: 'wide', actions: actions,
      body: h('form', { class: 'form', onsubmit: function (ev) { ev.preventDefault(); save(); } },
        ui.field(t('chore.title'), title), ui.field(t('chore.icon'), grid),
        h('div', { class: 'field' }, h('label', { class: 'check' }, hasTime, h('span', null, t('chore.hasTime'))), timeIn),
        ui.field(t('chore.repeat'), rec.el), err)
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
