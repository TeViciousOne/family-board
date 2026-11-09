/* Calendar screen: month grid, a day panel, and the event form (events, birthdays, countdowns). */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, L = FB.logic, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  FB.views = FB.views || {};

  var cal = { month: null, sel: null };

  function ensure(today) {
    if (!cal.month) { cal.month = U.monthStart(today); cal.sel = today; }
  }
  function shiftMonth(n) {
    var p = U.parts(cal.month), d = new Date(p.y, p.m - 1 + n, 1);
    cal.month = U.ymd(d);
    cal.sel = cal.month;
    FB.app.render();
  }

  function eventChipLabel(x) {
    var e = x.event;
    var pre = e.kind === 'birthday' ? '🎂 ' : e.kind === 'countdown' ? '⏳ ' : '';
    return pre + (e.all_day || !e.start_time ? '' : e.start_time + ' ') + e.title;
  }

  function dayCell(date, inMonth, today) {
    var evs = L.eventsOn(date);
    var cls = 'day' + (inMonth ? '' : ' out') + (date === today ? ' today' : '') + (date === cal.sel ? ' sel' : '');
    var labels = h('span', { class: 'day-evs' }, evs.slice(0, 3).map(function (x) {
      var m = L.member(x.event.member_id);
      return h('span', { class: 'day-ev', style: { '--c': m ? m.color : '#5A6B8C' } }, eventChipLabel(x));
    }));
    var dots = h('span', { class: 'day-dots' }, evs.slice(0, 4).map(function (x) {
      var m = L.member(x.event.member_id);
      return h('i', { style: { background: m ? m.color : '#5A6B8C' } });
    }));
    return h('button', {
      type: 'button', class: cls, 'aria-label': FB.i18n.dateLong(date) + (evs.length ? ', ' + evs.length : ''),
      onclick: function () { cal.sel = date; FB.app.render(); }
    },
      h('span', { class: 'day-n' }, String(U.parts(date).d)),
      labels, dots,
      evs.length > 3 ? h('span', { class: 'day-more' }, '+' + (evs.length - 3)) : null);
  }

  function dayPanel(today) {
    var date = cal.sel;
    var evs = L.eventsOn(date);
    var panel = h('div', { 'data-fit': '1', 'data-fit-min': '0.6' },
      h('div', { class: 'day-panel-head' },
        h('h2', null, FB.i18n.dateLong(date)),
        h('button', { class: 'btn', onclick: function () { FB.actions.openEvent(null, { on_date: date }); } }, ui.icon('plus', 20), ' ', t('event.add'))));
    if (!evs.length) panel.appendChild(h('p', { class: 'muted' }, t('cal.nothing')));
    evs.forEach(function (x) {
      var e = x.event, m = L.member(e.member_id);
      var when = e.all_day || !e.start_time ? t('event.allDay') : e.start_time + (e.end_time ? '–' + e.end_time : '');
      var title = e.kind === 'birthday' ? '🎂 ' + (x.age && x.age > 0 ? t('event.turns', { name: e.title, n: x.age }) : e.title) : e.title;
      panel.appendChild(h('button', { type: 'button', class: 'ev big', onclick: function () { FB.actions.openEvent(e); } },
        h('span', { class: 'ev-dot', style: { background: m ? m.color : 'var(--ink-3)' } }),
        h('span', { class: 'ev-when' }, when),
        h('span', { class: 'ev-title' }, title)));
    });
    var chores = L.choresDue(date, date === today ? U.hhmm(new Date()) : '');
    if (chores.length) {
      panel.appendChild(h('h3', null, t('cal.choresThatDay')));
      chores.forEach(function (x) {
        var m = L.member(x.chore.member_id);
        panel.appendChild(h('div', { class: 'ev small' + (x.done ? ' is-done' : '') },
          h('span', { class: 'ev-dot', style: { background: m ? m.color : 'var(--ink-3)' } }),
          h('span', { class: 'ev-title' }, (x.chore.emoji || '') + ' ' + x.chore.title),
          m ? h('span', { class: 'muted' }, m.name) : null));
      });
    }
    return h('aside', { class: 'day-panel', 'data-scroll': 'day-panel' }, panel);
  }

  FB.views.calendar = function (ctx) {
    var today = ctx.today;
    ensure(today);
    var p = U.parts(cal.month);
    var gridStart = U.addDays(cal.month, -((U.weekday(cal.month) + 6) % 7));
    var head = h('div', { class: 'cal-head' },
      h('button', { class: 'icon-btn', 'aria-label': t('cal.prev'), onclick: function () { shiftMonth(-1); } }, ui.icon('left')),
      h('h1', null, FB.i18n.monthLong(p.m - 1) + ' ' + p.y),
      h('button', { class: 'icon-btn', 'aria-label': t('cal.next'), onclick: function () { shiftMonth(1); } }, ui.icon('right')),
      h('button', { class: 'btn ghost', onclick: function () { cal.month = U.monthStart(today); cal.sel = today; FB.app.render(); } }, t('cal.today')));
    var weekdays = h('div', { class: 'cal-wd' }, [1, 2, 3, 4, 5, 6, 0].map(function (d) { return h('span', null, FB.i18n.dayShort(d)); }));
    var rows = [];
    for (var i = 0; i < 42; i++) {
      var d = U.addDays(gridStart, i);
      if (i >= 35 && U.parts(d).m !== p.m) break; /* skip a sixth row that is entirely next month */
      rows.push(dayCell(d, U.parts(d).m === p.m, today));
    }
    var grid = h('div', { class: 'cal-grid cal-rows-' + rows.length / 7 }, rows);
    return h('div', { class: 'cal', 'data-scroll': 'page-cal' }, h('div', { class: 'cal-main' }, head, weekdays, grid), dayPanel(today));
  };

  /* ---------------------------------------------------------------- */
  /*  Event form                                                        */
  /* ---------------------------------------------------------------- */
  FB.actions = FB.actions || {};
  FB.actions.openEvent = function (existing, defaults) {
    var e = existing ? Object.assign({}, existing) : Object.assign({
      title: '', kind: 'event', on_date: U.today(), end_date: null, all_day: true, start_time: null, end_time: null,
      member_id: null, rule: null, remind_minutes: null, birth_year: null, notes: ''
    }, defaults || {});
    var isNew = !existing;
    var modal;

    var title = h('input', { type: 'text', value: e.title, placeholder: t('event.titlePh'), maxlength: '80' });
    var kind = e.kind || 'event';
    var kindSeg = ui.seg([{ v: 'event', label: t('event.k.event') }, { v: 'birthday', label: t('event.k.birthday') }, { v: 'countdown', label: t('event.k.countdown') }], kind, function (v) { kind = v; sync(); });

    var dateIn = h('input', { type: 'date', value: e.on_date, onchange: function () { if (dateIn.value) { rec.setStart(dateIn.value); } } });
    var endIn = h('input', { type: 'date', value: e.end_date || '', min: e.on_date });
    var allDay = h('input', { type: 'checkbox', checked: !!e.all_day, onchange: function () { sync(); } });
    var startT = h('input', { type: 'time', value: e.start_time || '09:00' });
    var endT = h('input', { type: 'time', value: e.end_time || '' });
    var personSel = h('select', null,
      h('option', { value: '', selected: !e.member_id }, t('event.everyone')),
      L.membersSorted().map(function (m) { return h('option', { value: m.id, selected: e.member_id === m.id }, m.name); }));
    var birthYear = h('input', { type: 'number', min: '1900', max: '2100', value: e.birth_year || '', placeholder: t('event.birthYearPh'), inputmode: 'numeric' });
    var remind = h('select', null, [['', t('event.r.none')], ['0', t('event.r.atStart')], ['5', t('event.r.min', { n: 5 })], ['15', t('event.r.min', { n: 15 })],
      ['30', t('event.r.min', { n: 30 })], ['60', t('event.r.hour', { n: 1 })], ['120', t('event.r.hour', { n: 2 })], ['180', t('event.r.hour', { n: 3 })]]
      .map(function (o) { return h('option', { value: o[0], selected: String(e.remind_minutes == null ? '' : e.remind_minutes) === o[0] }, o[1]); }));
    var notes = h('textarea', { rows: '2', placeholder: t('event.notesPh') }, e.notes || '');
    notes.value = e.notes || '';

    var initialRule = e.rule && kind === 'event' ? Object.assign({}, e.rule, { start: e.on_date }) : Object.assign(FB.recur.defaultRule(e.on_date), { freq: 'once' });
    var rec = ui.recurEditor(initialRule, { showStart: false, onceLabel: t('rule.noRepeat') });

    var wTime = h('div', { class: 'row2' }, ui.field(t('event.from'), startT), ui.field(t('event.to'), endT));
    var wAllDay = h('label', { class: 'check' }, allDay, h('span', null, t('event.allDayLbl')));
    var wEnd = ui.field(t('event.lastDay'), endIn, t('event.lastDayHint'));
    var wBirth = ui.field(t('event.birthYear'), birthYear, t('event.birthYearHint'));
    var wRemind = ui.field(t('event.remind'), remind, t('event.remindHint'));
    var wRepeat = ui.field(t('event.repeat'), rec.el);
    var dateField = ui.field(t('event.date'), dateIn);
    var dateLabel = dateField.querySelector('label');

    function sync() {
      var ev = kind === 'event';
      wAllDay.style.display = ev ? '' : 'none';
      wTime.style.display = ev && !allDay.checked ? '' : 'none';
      wRemind.style.display = ev && !allDay.checked ? '' : 'none';
      wEnd.style.display = ev ? '' : 'none';
      wRepeat.style.display = ev ? '' : 'none';
      wBirth.style.display = kind === 'birthday' ? '' : 'none';
      dateLabel.textContent = kind === 'birthday' ? t('event.birthdayDate') : kind === 'countdown' ? t('event.countdownDate') : t('event.date');
      kindSeg.set(kind);
    }

    var err = h('p', { class: 'form-err', role: 'alert' });
    function save() {
      var name = title.value.trim();
      if (!name) { err.textContent = t('event.needTitle'); title.focus(); return; }
      if (!dateIn.value) { err.textContent = t('event.needDate'); return; }
      var row = {
        title: name, kind: kind, on_date: dateIn.value, member_id: personSel.value || null, notes: notes.value.trim(),
        all_day: true, start_time: null, end_time: null, end_date: null, rule: null, remind_minutes: null, birth_year: null
      };
      if (kind === 'event') {
        row.all_day = allDay.checked;
        if (!row.all_day) {
          row.start_time = startT.value || '09:00';
          row.end_time = endT.value || null;
          row.remind_minutes = remind.value === '' ? null : Number(remind.value);
        }
        var rule = rec.get();
        if (rule.freq === 'once') { if (endIn.value && endIn.value > row.on_date) row.end_date = endIn.value; }
        else { rule.start = row.on_date; row.rule = rule; }
      } else if (kind === 'birthday') {
        row.rule = { freq: 'yearly', interval: 1, start: row.on_date, until: null };
        var by = parseInt(birthYear.value, 10);
        row.birth_year = by > 1899 && by < 2101 ? by : null;
      }
      var p = isNew ? FB.data.add('events', row) : FB.data.edit('events', existing.id, row);
      p.then(function (r) { if (r) modal.close(); });
    }

    var actions = [];
    if (!isNew) {
      actions.push(h('button', { class: 'btn danger ghost', onclick: function () {
        ui.confirm({ title: t('event.deleteQ', { name: existing.title }), yes: t('common.delete'), danger: true }).then(function (ok) {
          if (ok) FB.data.del('events', existing.id).then(function (r) { if (r) modal.close(); });
        });
      } }, ui.icon('trash', 20), ' ', t('common.delete')));
    }
    actions.push(h('span', { class: 'grow' }));
    actions.push(h('button', { class: 'btn ghost', onclick: function () { modal.close(); } }, t('common.cancel')));
    actions.push(h('button', { class: 'btn', onclick: save }, t('common.save')));

    var body = h('form', { class: 'form', onsubmit: function (ev) { ev.preventDefault(); save(); } },
      ui.field(t('event.title'), title),
      ui.field(t('event.type'), kindSeg),
      dateField, wAllDay, wTime, wEnd, wBirth,
      ui.field(t('event.who'), personSel),
      wRemind, wRepeat,
      ui.field(t('event.notes'), notes),
      err);
    modal = ui.modal({ title: isNew ? t('event.new') : t('event.edit'), body: body, actions: actions, size: 'wide' });
    sync();
  };
})(typeof window !== 'undefined' ? window : globalThis);
