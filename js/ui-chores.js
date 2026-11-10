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
    if (r && (r.interval || 1) === 1 && (r.freq === 'daily' || r.freq === 'weekly')) {
      var on = r.freq === 'daily' ? DOTS : (r.weekdays && r.weekdays.length ? r.weekdays : [U.weekday(r.start)]);
      return h('span', { class: 'mini-dots', 'aria-label': FB.recur.describe(r, FB.i18n.L) }, DOTS.map(function (d) {
        return h('i', { class: on.indexOf(d) !== -1 ? 'on' : '' }, FB.i18n.dayShort(d).charAt(0));
      }));
    }
    if (r && r.freq === 'once') return h('span', { class: 'meta-txt' }, FB.i18n.relDay(r.start));
    return h('span', { class: 'meta-txt' }, FB.recur.describe(r, FB.i18n.L));
  }

  function choreRow(c, today) {
    var m = L.member(c.member_id), last = L.lastDone(c.id), lm = last ? L.member(last.done_by) : null;
    var next = c.active && c.rule && c.rule.freq !== 'once' ? FB.recur.nextOccurrence(c.rule, today, 400) : null;
    var meta = h('span', { class: 'row-meta' },
      h('span', { class: 'who-pill', style: { '--c': m ? m.color : 'var(--ink-3)' } }, m ? m.name : t('board.everyone')),
      ruleView(c.rule),
      c.due_time ? h('span', { class: 'meta-txt' }, t('chore.by', { time: c.due_time })) : null,
      next && next !== today ? h('span', { class: 'meta-txt' }, '→ ' + FB.i18n.relDay(next)) : null);
    var sw = h('button', { type: 'button', class: 'mini-sw' + (c.active ? ' on' : ''), role: 'switch', 'aria-checked': c.active ? 'true' : 'false', 'aria-label': t('chore.active'),
      onclick: function (e) { e.stopPropagation(); FB.data.edit('chores', c.id, { active: !c.active }); } }, h('i'));
    return h('div', { role: 'button', tabindex: '0', class: 'row chore-row' + (c.active ? '' : ' paused'), onclick: function () { FB.actions.openChore(c); },
      onkeydown: function (e) { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); FB.actions.openChore(c); } } },
      h('span', { class: 'row-emoji' }, c.emoji || '•'),
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title' }, c.title),
        meta,
        last ? h('span', { class: 'row-sub' }, t('chore.last', { name: lm ? lm.name : t('chore.someone'), when: FB.i18n.relDay(last.on_date) })) : null),
      sw);
  }

  function choreList() {
    var wrap = h('div', { class: 'list chore-groups' });
    var today = U.today();
    var g = { today: [], repeat: [], once: [], paused: [] };
    FB.state.chores.forEach(function (c) {
      if (!c.active) g.paused.push(c);
      else if (FB.recur.occursOn(c.rule, today)) g.today.push(c);
      else if (c.rule && c.rule.freq === 'once') g.once.push(c);
      else g.repeat.push(c);
    });
    function byTime(a, b) { return (a.due_time || '99').localeCompare(b.due_time || '99') || a.title.localeCompare(b.title); }
    g.once.sort(function (a, b) { return (a.rule.start || '').localeCompare(b.rule.start || '') || a.title.localeCompare(b.title); });
    var any = false;
    [['today', 'chores.g.today'], ['repeat', 'chores.g.repeat'], ['once', 'chores.g.once'], ['paused', 'chores.g.paused']].forEach(function (x) {
      var items = g[x[0]];
      if (!items.length) return;
      any = true;
      if (x[0] !== 'once') items.sort(byTime);
      wrap.appendChild(h('h3', { class: 'grp' }, t(x[1]), h('span', { class: 'grp-n' }, String(items.length))));
      wrap.appendChild(h('div', { class: 'chore-grid' }, items.map(function (c) { return choreRow(c, today); })));
    });
    if (!any) wrap.appendChild(h('div', { class: 'pad' }, h('p', { class: 'muted' }, t('chores.empty'))));
    return wrap;
  }

  function historyList() {
    var wrap = h('div', { class: 'list' });
    var counts = L.weekCounts();
    var members = L.membersSorted();
    wrap.appendChild(h('h3', { class: 'grp' }, t('hist.week')));
    wrap.appendChild(h('div', { class: 'week-counts' }, members.map(function (m) {
      return h('div', { class: 'wc', style: { '--c': m.color } }, ui.avatar(m, 36), h('b', null, String(counts[m.id] || 0)), h('span', null, m.name));
    })));
    var items = L.recentCompletions(150);
    if (!items.length) { wrap.appendChild(h('p', { class: 'muted pad' }, t('hist.empty'))); return wrap; }
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
      tab === 'chores' ? h('button', { class: 'btn', onclick: function () { FB.actions.openTemplates(); } }, ui.icon('plus', 20), ' ', t('chores.add')) : null);
    return h('div', { class: 'page', 'data-scroll': 'page-chores' }, head, tab === 'chores' ? choreList() : historyList());
  };

  /* ---------------------------------------------------------------- */
  /*  Chore form                                                        */
  /* ---------------------------------------------------------------- */
  FB.actions.openChore = function (existing, prefill) {
    var isNew = !existing;
    var c = existing ? Object.assign({}, existing) : { title: '', emoji: '🧹', member_id: null, rule: Object.assign(FB.recur.defaultRule(U.today()), { freq: 'daily' }), due_time: null, active: true };
    if (prefill) c = Object.assign(c, prefill);
    var modal, emoji = c.emoji;

    var title = h('input', { type: 'text', value: c.title, placeholder: t('chore.titlePh'), maxlength: '80' });
    var grid = ui.emojiGrid(ui.CHORE_EMOJI, emoji, function (v) { emoji = v; }, true);
    var who = h('select', null,
      h('option', { value: '', selected: !c.member_id }, t('chore.anyone')),
      L.membersSorted().map(function (m) { return h('option', { value: m.id, selected: c.member_id === m.id }, m.name); }));
    var hasTime = h('input', { type: 'checkbox', checked: !!c.due_time, onchange: function () { timeIn.style.display = hasTime.checked ? '' : 'none'; } });
    var timeIn = h('input', { type: 'time', value: c.due_time || '18:00', style: { display: c.due_time ? '' : 'none' } });
    var active = h('input', { type: 'checkbox', checked: c.active !== false });
    var rec = ui.recurEditor(c.rule, { onceLabel: t('rule.f.once') });
    var err = h('p', { class: 'form-err', role: 'alert' });

    function save() {
      var name = title.value.trim();
      if (!name) { err.textContent = t('chore.needTitle'); title.focus(); return; }
      var row = {
        title: name, emoji: emoji || '', member_id: who.value || null, rule: rec.get(),
        due_time: hasTime.checked && timeIn.value ? timeIn.value : null, active: active.checked
      };
      var p = isNew ? FB.data.add('chores', row) : FB.data.edit('chores', existing.id, row);
      p.then(function (r) { if (r) modal.close(); });
    }

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
    actions.push(h('button', { class: 'btn', onclick: save }, t('common.save')));

    var body = h('form', { class: 'form', onsubmit: function (ev) { ev.preventDefault(); save(); } },
      ui.field(t('chore.title'), title),
      ui.field(t('chore.icon'), grid),
      ui.field(t('chore.who'), who),
      h('div', { class: 'field' }, h('label', { class: 'check' }, hasTime, h('span', null, t('chore.hasTime'))), timeIn, h('p', { class: 'hint' }, t('chore.timeHint'))),
      ui.field(t('chore.repeat'), rec.el),
      h('label', { class: 'check' }, active, h('span', null, t('chore.active'))),
      err);
    modal = ui.modal({ title: isNew ? t('chore.new') : t('chore.edit'), body: body, actions: actions, size: 'wide' });
  };

  /* ---------------------------------------------------------------- */
  /*  Templates: tick the usual chores and add them in one go           */
  /* ---------------------------------------------------------------- */
  FB.actions.openTemplates = function () {
    var modal, picked = {}, repeat = {};
    var who = h('select', { 'aria-label': t('tpl.assign') },
      h('option', { value: '' }, t('tpl.assign') + ': ' + t('chore.anyone')),
      L.membersSorted().map(function (m) { return h('option', { value: m.id }, t('tpl.assign') + ': ' + m.name); }));
    var addBtn = h('button', { class: 'btn', onclick: add }, '');
    var body = h('div', { class: 'tpl' });
    function have() { var o = {}; FB.state.chores.forEach(function (c) { o[c.title.trim().toLowerCase()] = true; }); return o; }
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
          h('span', { class: 'tpl-sub' }, exists ? t('tpl.have') : (repeat[it.id] ? FB.recur.describe(suggested(it), FB.i18n.L) : t('rule.f.once')) + (it.due_time ? ' · ' + it.due_time : '')),
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
        return FB.data.add('chores', { title: FB.templates.label(it), emoji: it.emoji, member_id: who.value || null, rule: rule, due_time: it.due_time || null, active: true });
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
    var timeIn = h('input', { type: 'time', value: c.due_time || '18:00', style: { display: c.due_time ? '' : 'none' } });
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
