/* Lists screen: shopping list and the family note board. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, L = FB.logic, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  FB.views = FB.views || {};

  function me() { return FB.state.me || null; }

  /* ---- what this family usually buys (learned on each device from the list itself) ---- */
  var HIST = 'fb.shopHist.v1';
  var DEFAULTS = { sq: ['Bukë', 'Qumësht', 'Vezë', 'Ujë', 'Djathë', 'Fruta', 'Perime', 'Kafe'], en: ['Bread', 'Milk', 'Eggs', 'Water', 'Cheese', 'Fruit', 'Vegetables', 'Coffee'] };
  function norm(x) { return String(x || '').trim().toLowerCase(); }
  function loadHist() { try { return JSON.parse(localStorage.getItem(HIST) || '') || { c: {}, seen: [] }; } catch (e) { return { c: {}, seen: [] }; } }
  function learn(items) {
    var hs = loadHist(), seen = {}, changed = false;
    hs.seen.forEach(function (id) { seen[id] = 1; });
    items.forEach(function (x) {
      if (seen[x.id]) return;
      seen[x.id] = 1; hs.seen.push(x.id); changed = true;
      var k = norm(x.title); if (!k) return;
      var e = hs.c[k] || (hs.c[k] = { t: x.title, n: 0 }); e.n++; e.t = x.title;
    });
    if (!changed) return hs;
    if (hs.seen.length > 600) hs.seen = hs.seen.slice(-400);
    try { localStorage.setItem(HIST, JSON.stringify(hs)); } catch (e) { /* ignore */ }
    return hs;
  }
  function suggestions(items) {
    var hs = learn(items), open = {};
    items.forEach(function (x) { if (!x.done) open[norm(x.title)] = 1; });
    var list = Object.keys(hs.c).map(function (k) { return hs.c[k]; }).filter(function (e) { return e.n >= 2; })
      .sort(function (a, b) { return b.n - a.n; }).map(function (e) { return e.t; });
    (DEFAULTS[FB.i18n.L] || DEFAULTS.en).forEach(function (d) { if (list.length < 8 && list.map(norm).indexOf(norm(d)) === -1) list.push(d); });
    return list.filter(function (x) { return !open[norm(x)]; }).slice(0, 8);
  }

  var boughtOpen = false;

  function shopping(after) {
    after = after || function () {};
    var input = h('input', { type: 'text', 'data-fid': 'shop-add', placeholder: t('shop.addPh'), maxlength: '80', enterkeyhint: 'done' });
    var items = L.shoppingSorted();
    function addTitle(v, keepFocus) {
      var old = items.filter(function (x) { return x.done && norm(x.title) === norm(v); })[0];
      var p = old ? FB.data.edit('shopping_items', old.id, { done: false, done_at: null })
        : FB.data.add('shopping_items', { title: v, done: false, added_by: me(), created_at: new Date().toISOString(), done_at: null });
      return p.then(function () {
        after();
        if (keepFocus) { var again = document.querySelector('[data-fid="shop-add"]'); if (again) again.focus(); }
      });
    }
    function add() { var v = input.value.trim(); if (!v) return; input.value = ''; addTitle(v, true); }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    var open = items.filter(function (x) { return !x.done; });
    var bought = items.filter(function (x) { return x.done; }).sort(function (a, b) { return (b.done_at || '').localeCompare(a.done_at || ''); });

    function row(s) {
      var m = L.member(s.added_by);
      function toggle() { FB.data.edit('shopping_items', s.id, { done: !s.done, done_at: s.done ? null : new Date().toISOString() }).then(after); }
      var when = s.done && s.done_at ? FB.i18n.relDay(U.ymd(new Date(s.done_at))) : s.created_at ? FB.i18n.relDay(U.ymd(new Date(s.created_at))) : '';
      return h('div', { class: 'shop shop-row' + (s.done ? ' done' : ''), role: 'button', tabindex: '0', 'aria-pressed': s.done ? 'true' : 'false', style: { '--c': m ? m.color : 'var(--ink-3)' }, onclick: toggle,
        onkeydown: function (e) { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } } },
        h('span', { class: 'shop-tick', 'aria-hidden': 'true' }, s.done ? ui.icon('check', 20) : null),
        h('span', { class: 'shop-main' },
          h('span', { class: 'shop-title' }, s.title),
          h('span', { class: 'shop-sub' }, (m ? m.name : '') + (m && when ? ' · ' : '') + when)),
        s.done ? h('span', { class: 'shop-again' }, ui.icon('plus', 16), ' ', t('shop.again')) :
          h('button', { type: 'button', class: 'shop-x', 'aria-label': t('common.delete') + ': ' + s.title, onclick: function (e) { e.stopPropagation(); FB.data.del('shopping_items', s.id).then(after); } }, ui.icon('x', 16)));
    }

    var list;
    if (!open.length) list = h('p', { class: 'muted pad' }, t('shop.empty'));
    else if (open.some(function (x) { return x.category; })) {
      var order = FB.ai ? FB.ai.cats : [], seen = {}, groups = [];
      open.forEach(function (x) { var k = x.category || 'other'; (seen[k] = seen[k] || []).push(x); });
      Object.keys(seen).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); }).forEach(function (k) {
        groups.push(h('h3', { class: 'shop-cat' }, FB.ai ? FB.ai.catLabel(k) : k), h('div', { class: 'shop-grid' }, seen[k].map(row)));
      });
      list = h('div', { class: 'shop-groups' }, groups);
    } else list = h('div', { class: 'shop-grid' }, open.map(row));

    var chips = suggestions(items);
    var chipRow = chips.length ? h('div', { class: 'quick-chips' }, chips.map(function (c) {
      return h('button', { type: 'button', class: 'qchip', onclick: function () { addTitle(c, false); } }, ui.icon('plus', 14), ' ', c);
    })) : null;

    var boughtSec = null;
    if (bought.length) {
      boughtSec = h('div', { class: 'bought' + (boughtOpen ? ' open' : '') },
        h('div', { class: 'bought-head' },
          h('button', { type: 'button', class: 'link-btn bought-tog', onclick: function () { boughtOpen = !boughtOpen; after(); FB.app.render(); } },
            ui.icon(boughtOpen ? 'down' : 'right', 16), ' ', t('shop.bought', { n: bought.length })),
          h('span', { class: 'grow' }),
          h('button', { type: 'button', class: 'link-btn', onclick: function () {
            Promise.all(bought.map(function (x) { return FB.data.del('shopping_items', x.id); })).then(after);
          } }, t('shop.clearBought'))),
        boughtOpen ? h('div', { class: 'shop-grid' }, bought.slice(0, 30).map(row)) : null);
    }

    return h('section', { class: 'pane pane-shop' },
      h('div', { class: 'pane-head' }, h('span', { class: 'pane-ico' }, ui.icon('cart', 22)), h('h2', null, t('shop.title')),
        open.length ? h('span', { class: 'pane-n' }, String(open.length)) : null,
        FB.ai && FB.ai.enabled() && open.length > 1 ? h('button', { class: 'link-btn ai-tidy', onclick: function () { FB.ai.tidy(); } }, ui.icon('sparkle', 16), ' ', t('ai.tidy')) : null),
      h('div', { class: 'add-row' }, input, h('button', { class: 'btn', onclick: add }, ui.icon('plus', 20), ' ', t('common.add'))),
      chipRow,
      h('div', { class: 'shop-scroll' }, list, boughtSec));
  }

  function notesPane() {
    var ta = h('textarea', { rows: '2', 'data-fid': 'note-add', placeholder: t('notes.addPh'), maxlength: '400' });
    function add() {
      var v = ta.value.trim(); if (!v) return;
      ta.value = '';
      FB.data.add('notes', { body: v, author: me(), pinned: false, created_at: new Date().toISOString() });
    }
    var list = h('div', { class: 'note-grid' }, L.notesSorted().map(function (n, i) {
      var m = L.member(n.author);
      return h('article', { class: 'note note-sq' + (n.pinned ? ' pinned' : ''), style: { '--paper': m ? U.tint(m.color, .16) : 'transparent', '--tilt': ((i % 3) - 1) * 1.2 + 'deg' } },
        n.pinned ? h('span', { class: 'note-pin', 'aria-hidden': 'true' }, ui.icon('pin', 16)) : null,
        h('p', null, n.body),
        h('footer', null,
          h('span', { class: 'note-by' }, (m ? m.name + ' · ' : '') + FB.i18n.relDay(U.ymd(new Date(n.created_at))) + ' ' + FB.i18n.timeOf(n.created_at)),
          h('span', { class: 'grow' }),
          h('button', { type: 'button', class: 'note-btn' + (n.pinned ? ' on' : ''), 'aria-label': n.pinned ? t('notes.unpin') : t('notes.pin'), 'aria-pressed': n.pinned ? 'true' : 'false',
            onclick: function () { FB.data.edit('notes', n.id, { pinned: !n.pinned }); } }, ui.icon('pin', 16)),
          h('button', { type: 'button', class: 'note-btn', 'aria-label': t('common.delete'), onclick: function () { FB.data.del('notes', n.id); } }, ui.icon('trash', 16))));
    }));
    if (!FB.state.notes.length) list = h('p', { class: 'muted pad' }, t('notes.empty'));
    return h('section', { class: 'pane pane-notes' },
      h('div', { class: 'pane-head' }, h('span', { class: 'pane-ico' }, ui.icon('edit', 22)), h('h2', null, t('notes.title'))),
      h('div', { class: 'add-row note-add' }, ta, h('button', { class: 'btn', onclick: add }, ui.icon('plus', 20), ' ', t('notes.post'))),
      list);
  }

  /* the shopping list in a popup (opened from the home screen) */
  FB.actions = FB.actions || {};
  FB.actions.openShopping = function () {
    var holder = h('div', { class: 'shop-pop' }), modal, timer;
    function draw() {
      var f = document.activeElement;
      if (f && f.getAttribute && f.getAttribute('data-fid') === 'shop-add' && f.value) return; /* don't wipe what is being typed */
      U.clear(holder); var pane = shopping(draw); pane.classList.add('bare'); var hd = pane.querySelector('.pane-head h2'); if (hd) hd.remove(); holder.appendChild(pane);
    }
    draw();
    modal = ui.modal({ title: t('shop.title'), size: 'wide', body: holder, focus: false, onClose: function () { clearInterval(timer); } });
    timer = setInterval(function () { if (!document.body.contains(holder)) { clearInterval(timer); return; } draw(); }, 2000);
  };

  var phoneTab = 'shop';
  FB.views.lists = function () {
    var phone = !!(root.matchMedia && root.matchMedia('(max-width: 699px)').matches);
    if (!phone) return h('div', { class: 'page lists', 'data-scroll': 'page-lists' }, shopping(), notesPane());
    return h('div', { class: 'page lists lists-phone', 'data-scroll': 'page-lists' },
      ui.seg([{ v: 'shop', label: t('shop.title') }, { v: 'notes', label: t('notes.title') }], phoneTab, function (v) { phoneTab = v; FB.app.render(); }),
      phoneTab === 'shop' ? shopping() : notesPane());
  };
})(typeof window !== 'undefined' ? window : globalThis);
