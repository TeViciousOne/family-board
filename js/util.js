/* Small helpers shared by every module. Classic script, no build step. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = (FB.util = {});

  U.pad = function (n) { return String(n).padStart(2, '0'); };

  /* ---------- dates (all dates are 'YYYY-MM-DD' strings in local time) ---------- */
  U.ymd = function (d) { return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); };
  U.parse = function (s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  U.today = function () { return U.ymd(new Date()); };
  U.addDays = function (s, n) { var d = U.parse(s); d.setDate(d.getDate() + n); return U.ymd(d); };
  /* whole days since 1970-01-01, immune to daylight saving shifts */
  U.dayNum = function (s) { var p = s.split('-').map(Number); return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); };
  U.daysBetween = function (a, b) { return U.dayNum(b) - U.dayNum(a); };
  U.weekday = function (s) { var p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); }; /* 0 = Sunday */
  U.daysInMonth = function (y, m1) { return new Date(Date.UTC(y, m1, 0)).getUTCDate(); }; /* m1 = 1..12 */
  U.parts = function (s) { var p = s.split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; };
  /* Monday-based start of week, returned as a day number */
  U.weekStartNum = function (s) { return U.dayNum(s) - ((U.weekday(s) + 6) % 7); };
  U.monthStart = function (s) { var p = U.parts(s); return p.y + '-' + U.pad(p.m) + '-01'; };
  U.hhmm = function (d) { return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); };
  U.minutesOf = function (hhmm) { var p = hhmm.split(':').map(Number); return p[0] * 60 + p[1]; };

  /* ---------- colours ---------- */
  U.textOn = function (hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    function lin(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.36 ? '#10302F' : '#FFFFFF';
  };

  /* '#E8573F' + 0.1 -> 'rgba(232,87,63,0.1)' (used for soft tints without color-mix) */
  U.tint = function (hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
  };

  /* ---------- ids ---------- */
  U.uid = function () {
    if (root.crypto && root.crypto.randomUUID) { try { return root.crypto.randomUUID(); } catch (e) { /* insecure context */ } }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  };

  /* ---------- tiny DOM builder: h('div', {class:'a', onclick:fn}, 'text', child) ---------- */
  var PROPS = { value: 1, checked: 1, disabled: 1, selected: 1, indeterminate: 1 };
  U.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') {
          Object.keys(v).forEach(function (sk) {
            if (sk.slice(0, 2) === '--') el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk];
          });
        }
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (PROPS[k]) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) U.append(el, arguments[i]);
    return el;
  };
  U.append = function (el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { U.append(el, k); }); return; }
    el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  };
  U.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  U.debounce = function (fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = U;
})(typeof window !== 'undefined' ? window : globalThis);
