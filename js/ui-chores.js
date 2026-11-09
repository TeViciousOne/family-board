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

  function choreList() {
    var wrap = h('div', { class: 'list' });
    var members = L.membersSorted();
    var groups = members.map(function (m) { return { m: m, items: [] }; });
    var shared = { m: null, items: [] };
    FB.state.chores.slice().sort(function (a, b) { return a.title.localeCompare(b.title); }).forEach(function (c) {
      var g = groups.filter(function (x) { return x.m.id === c.member_id; })[0] || shared;
      g.items.push(c);
    });
    groups.push(shared);
    var any = false;
    groups.forEach(function (g) {
      if (!g.items.length) return;
      any = true;
      wrap.appendChild(h('h3', { class: 'grp' }, g.m ? ui.avatar(g.m, 26) : null, ' ', g.m ? g.m.name : t('board.everyone')));
      g.items.forEach(function (c) {
        wrap.appendChild(h('button', { type: 'button', class: 'row' + (c.active ? '' : ' paused'), onclick: function () { FB.actions.openChore(c); } },
          h('span', { class: 'row-emoji' }, c.emoji || '•'),
          h('span', { class: 'row-main' },
            h('span', { class: 'row-title' }, c.title + (c.active ? '' : ' · ' + t('chores.paused'))),
            h('span', { class: 'row-sub' }, FB.recur.describe(c.rule, FB.i18n.L) + (c.due_time ? ' · ' + t('chore.by', { time: c.due_time }) : ''))),
          ui.icon('right', 20)));
      });
    });
    if (!any) wrap.appendChild(h('div', { class: 'pad' }, h('p', { class: 'muted' }, t('chores.empty')),
      h('button', { class: 'btn', onclick: function () { FB.actions.openTemplates(); } }, ui.icon('list', 20), ' ', t('tpl.open'))));
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
      tab === 'chores' ? h('button', { class: 'btn ghost', onclick: function () { FB.actions.openTemplates(); } }, ui.icon('list', 20), ' ', t('tpl.open')) : null,
      tab === 'chores' ? h('button', { class: 'btn', onclick: function () { FB.actions.openChore(null); } }, ui.icon('plus', 20), ' ', t('chores.add')) : null);
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

    var quick = null;
    if (isNew && FB.state.templates.length) {
      var owned = {}; FB.state.chores.forEach(function (x) { owned[x.title.trim().toLowerCase()] = true; });
      quick = ui.field(t('tpl.quick'), h('div', { class: 'chips quick' },
        FB.state.templates.filter(function (x) { return !owned[x.title.trim().toLowerCase()]; }).map(function (x) {
          return h('button', { type: 'button', class: 'chip' + (title.value.trim() === x.title ? ' on' : ''), onclick: function () {
            modal.close(); FB.actions.openChore(null, { title: x.title, emoji: x.emoji, rule: x.rule, due_time: x.due_time });
          } }, (x.emoji ? x.emoji + ' ' : '') + x.title);
        }).concat([h('button', { type: 'button', class: 'chip ghost', onclick: function () { modal.close(); FB.actions.openTemplates(); } }, ui.icon('edit', 16), ' ', t('tpl.manage'))])));
    }
    var body = h('form', { class: 'form', onsubmit: function (ev) { ev.preventDefault(); save(); } },
      quick,
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
    var modal, picked = {};
    var who = h('select', null,
      h('option', { value: '' }, t('chore.anyone')),
      L.membersSorted().map(function (m) { return h('option', { value: m.id }, m.name); }));
    var addBtn = h('button', { class: 'btn', onclick: add }, '');
    var body = h('div', { class: 'tpl' });
    function have() { var o = {}; FB.state.chores.forEach(function (c) { o[c.title.trim().toLowerCase()] = true; }); return o; }
    function refresh() {
      var n = Object.keys(picked).length;
      addBtn.textContent = t('tpl.add', { n: n }); addBtn.disabled = !n;
    }
    function draw() {
      U.clear(body);
      var list = FB.state.templates.slice().sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
      Object.keys(picked).forEach(function (id) { if (!list.some(function (x) { return x.id === id; })) delete picked[id]; });
      if (!list.length) {
        body.appendChild(h('p', { class: 'lead' }, t('tpl.empty')));
        body.appendChild(h('button', { class: 'btn', onclick: function () {
          Promise.all(FB.templates.starter().map(function (it) { return FB.data.add('chore_templates', it); })).then(draw);
        } }, t('tpl.starter')));
      }
      var owned = have();
      list.forEach(function (it) {
        var exists = owned[it.title.trim().toLowerCase()];
        var cb = h('input', { type: 'checkbox', disabled: !!exists, checked: !!picked[it.id], onchange: function () { if (cb.checked) picked[it.id] = it; else delete picked[it.id]; refresh(); } });
        body.appendChild(h('div', { class: 'row tpl-row' + (exists ? ' paused' : '') },
          h('label', { class: 'tpl-pick' },
            h('span', { class: 'row-emoji' }, it.emoji),
            h('span', { class: 'row-main' },
              h('span', { class: 'row-title' }, it.title),
              h('span', { class: 'row-sub' }, exists ? t('tpl.have') : FB.recur.describe(it.rule, FB.i18n.L) + (it.due_time ? ' · ' + t('chore.by', { time: it.due_time }) : ''))),
            cb),
          h('button', { class: 'btn ghost icon-btn', 'aria-label': t('common.edit'), onclick: function () { FB.actions.editTemplate(it, draw); } }, ui.icon('edit', 20))));
      });
      refresh();
    }
    function add() {
      var items = Object.keys(picked).map(function (k) { return picked[k]; });
      if (!items.length) return;
      addBtn.disabled = true;
      Promise.all(items.map(function (it) {
        return FB.data.add('chores', { title: it.title, emoji: it.emoji, member_id: who.value || null, rule: it.rule, due_time: it.due_time || null, active: true });
      })).then(function () { modal.close(); ui.toast(t('tpl.added', { n: items.length })); });
    }
    draw();
    modal = ui.modal({
      title: t('tpl.title'), size: 'wide', focus: false,
      body: h('div', null, h('p', { class: 'lead' }, t('tpl.hint')), ui.field(t('tpl.assign'), who), body),
      actions: [
        h('button', { class: 'btn ghost', onclick: function () { FB.actions.editTemplate(null, draw); } }, ui.icon('plus', 20), ' ', t('tpl.new')),
        h('span', { class: 'grow' }), h('button', { class: 'btn ghost', onclick: function () { modal.close(); } }, t('common.cancel')), addBtn]
    });
  };

  FB.actions.editTemplate = function (existing, done) {
    var isNew = !existing;
    var c = existing ? Object.assign({}, existing) : { title: '', emoji: '🧹', rule: Object.assign(FB.recur.defaultRule(U.today()), { freq: 'daily' }), due_time: null };
    var modal, emoji = c.emoji;
    var title = h('input', { type: 'text', value: c.title, placeholder: t('chore.titlePh'), maxlength: '80' });
    var grid = ui.emojiGrid(ui.CHORE_EMOJI, emoji, function (v) { emoji = v; }, true);
    var hasTime = h('input', { type: 'checkbox', checked: !!c.due_time, onchange: function () { timeIn.style.display = hasTime.checked ? '' : 'none'; } });
    var timeIn = h('input', { type: 'time', value: c.due_time || '18:00', style: { display: c.due_time ? '' : 'none' } });
    var rec = ui.recurEditor(c.rule, { onceLabel: t('rule.f.once') });
    var err = h('p', { class: 'form-err', role: 'alert' });
    function finish(r) { if (r) { modal.close(); if (done) done(); } }
    function save() {
      var name = title.value.trim();
      if (!name) { err.textContent = t('chore.needTitle'); title.focus(); return; }
      var row = { title: name, emoji: emoji || '', rule: rec.get(), due_time: hasTime.checked && timeIn.value ? timeIn.value : null };
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
