/* News strip on the home screen: Euronews + Top Channel headlines and the crude oil price, rotating. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  var N = (FB.news = {});
  var data = null, at = 0, busy = false, seq = [], idx = 0, started = false;

  N.enabled = function () { return !!(FB.store && FB.store.mode === 'cloud' && FB.store.news); };

  function build() {
    var e = [], tp = [], out = [];
    ((data && data.items) || []).forEach(function (x) { (x.s === 'top' ? tp : e).push(x); });
    var o = data && data.oil, hasOil = o && (o.wti || o.brent);
    var n = Math.max(e.length, tp.length), k = 0;
    for (var i = 0; i < n; i++) {
      if (e[i]) out.push(e[i]);
      if (tp[i]) out.push(tp[i]);
      if (hasOil && ++k % 2 === 1) out.push({ s: 'oil' });
    }
    if (hasOil && !out.length) out.push({ s: 'oil' });
    return out;
  }

  function pct(c) { return c == null ? '' : (c > 0 ? '▲ ' : c < 0 ? '▼ ' : '') + Math.abs(c).toFixed(1) + '%'; }
  function oilNode() {
    var o = data.oil, parts = [];
    [['WTI', o.wti], ['Brent', o.brent]].forEach(function (p) {
      if (!p[1]) return;
      parts.push(h('span', { class: 'news-oil' }, h('b', null, p[0] + ' $' + p[1].p.toFixed(2)),
        h('i', { class: p[1].c > 0 ? 'up' : p[1].c < 0 ? 'down' : '' }, pct(p[1].c))));
    });
    return parts;
  }

  function fill(el, item) {
    el.className = 'news-strip src-' + item.s;
    var body = el.querySelector('.news-body');
    el.querySelector('.news-src').textContent = t(item.s === 'oil' ? 'news.oil' : 'news.src.' + item.s);
    body.textContent = '';
    if (item.s === 'oil') oilNode().forEach(function (n) { body.appendChild(n); });
    else body.textContent = item.t;
  }

  function show(el, animate) {
    if (!seq.length) return;
    var item = seq[idx % seq.length];
    if (!animate) return fill(el, item);
    el.classList.add('swap');
    setTimeout(function () { fill(el, item); el.classList.remove('swap'); }, 260);
  }

  function all() { return Array.prototype.slice.call(document.querySelectorAll('.news-strip')); }

  function tick() {
    if (!seq.length || document.hidden) return;
    idx = (idx + 1) % seq.length;
    all().forEach(function (el) { show(el, true); });
  }

  function list() {
    var body = h('div', { class: 'news-list' });
    if (data.oil && (data.oil.wti || data.oil.brent)) body.appendChild(h('div', { class: 'news-row src-oil' }, h('span', { class: 'news-src' }, t('news.oil')), h('div', { class: 'news-body' }, oilNode())));
    data.items.forEach(function (x) {
      body.appendChild(h('a', { class: 'news-row src-' + x.s, href: x.l, target: '_blank', rel: 'noopener' },
        h('span', { class: 'news-src' }, t('news.src.' + x.s)), h('div', { class: 'news-body' }, x.t)));
    });
    ui.modal({ title: t('news.title'), body: body, size: 'wide', focus: false });
  }

  N.refresh = function (force) {
    if (!N.enabled() || busy || (!force && Date.now() - at < 9 * 60 * 1000)) return;
    busy = true;
    FB.store.news({}).then(function (d) {
      data = d; at = Date.now(); busy = false;
      var had = seq.length;
      seq = build(); idx = 0;
      all().forEach(function (el) { show(el, false); });
      if (!had && seq.length && FB.app && FB.app.render) FB.app.render();
    }, function () { busy = false; at = Date.now() - 7 * 60 * 1000; });
  };

  N.strip = function () {
    if (!N.enabled()) return null;
    if (!started) { started = true; setInterval(tick, 8000); setInterval(function () { N.refresh(false); }, 60000); }
    N.refresh(false);
    if (!seq.length) return null;
    var el = h('button', { type: 'button', class: 'news-strip', 'data-fit-skip': '1', onclick: function () { if (data) list(); } },
      h('span', { class: 'news-src' }), h('div', { class: 'news-body' }));
    show(el, false);
    return el;
  };
})(typeof window !== 'undefined' ? window : globalThis);
