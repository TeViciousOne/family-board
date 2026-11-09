/* Lists screen: shopping list and the family note board. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, L = FB.logic, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  FB.views = FB.views || {};

  function me() { return FB.state.me || null; }

  function shopping(after) {
    after = after || function () {};
    var input = h('input', { type: 'text', 'data-fid': 'shop-add', placeholder: t('shop.addPh'), maxlength: '80', enterkeyhint: 'done' });
    function add() {
      var v = input.value.trim(); if (!v) return;
      input.value = '';
      FB.data.add('shopping_items', { title: v, done: false, added_by: me(), created_at: new Date().toISOString(), done_at: null }).then(function () {
        after();
        var again = document.querySelector('[data-fid="shop-add"]'); if (again) again.focus();
      });
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    var items = L.shoppingSorted();
    var doneN = items.filter(function (x) { return x.done; }).length;
    function tile(s) {
      var m = L.member(s.added_by);
      function toggle() { FB.data.edit('shopping_items', s.id, { done: !s.done, done_at: s.done ? null : new Date().toISOString() }).then(after); }
      return h('div', { class: 'shop shop-sq' + (s.done ? ' done' : ''), role: 'button', tabindex: '0', 'aria-pressed': s.done ? 'true' : 'false', onclick: toggle,
        onkeydown: function (e) { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); } } },
        h('span', { class: 'shop-tick', 'aria-hidden': 'true' }, s.done ? ui.icon('check', 22) : null),
        h('span', { class: 'shop-title' }, s.title),
        m ? h('i', { class: 'ev-dot shop-by', style: { background: m.color }, title: m.name }) : null,
        h('button', { type: 'button', class: 'shop-x', 'aria-label': t('common.delete') + ': ' + s.title, onclick: function (e) { e.stopPropagation(); FB.data.del('shopping_items', s.id).then(after); } }, ui.icon('x', 16)));
    }
    var list;
    if (items.some(function (x) { return x.category; })) {
      var order = FB.ai ? FB.ai.cats : [], seen = {}, groups = [];
      items.forEach(function (x) { var k = x.category || 'other'; (seen[k] = seen[k] || []).push(x); });
      Object.keys(seen).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); }).forEach(function (k) {
        groups.push(h('h3', { class: 'shop-cat' }, FB.ai ? FB.ai.catLabel(k) : k), h('div', { class: 'shop-grid' }, seen[k].map(tile)));
      });
      list = h('div', { class: 'shop-groups' }, groups);
    } else list = h('div', { class: 'shop-grid' }, items.map(tile));
    if (!items.length) list = h('p', { class: 'muted pad' }, t('shop.empty'));
    return h('section', { class: 'pane pane-shop' },
      h('div', { class: 'pane-head' }, h('span', { class: 'pane-ico' }, ui.icon('cart', 22)), h('h2', null, t('shop.title')),
        FB.ai && FB.ai.enabled() && items.length > 1 ? h('button', { class: 'link-btn ai-tidy', onclick: function () { FB.ai.tidy(); } }, ui.icon('sparkle', 16), ' ', t('ai.tidy')) : null,
        doneN ? h('button', { class: 'link-btn', onclick: function () {
          Promise.all(items.filter(function (x) { return x.done; }).map(function (x) { return FB.data.del('shopping_items', x.id); })).then(after);
        } }, t('shop.clearDone', { n: doneN })) : null),
      h('div', { class: 'add-row' }, input, h('button', { class: 'btn', onclick: add }, ui.icon('plus', 20), ' ', t('common.add'))),
      list);
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
      h('div', { class: 'add-col' }, ta, h('button', { class: 'btn', onclick: add }, ui.icon('plus', 20), ' ', t('notes.post'))),
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

  FB.views.lists = function () {
    return h('div', { class: 'page lists', 'data-scroll': 'page-lists' }, shopping(), notesPane());
  };
})(typeof window !== 'undefined' ? window : globalThis);
