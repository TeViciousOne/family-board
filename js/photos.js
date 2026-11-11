/* Photos for the calm screen: shrink on upload, list with short-lived links, cached for 50 minutes. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var P = (FB.photos = { items: [], at: 0, loading: null });
  var TTL = 50 * 60 * 1000;

  function api() { return FB.store && FB.store.photos; }

  P.list = function (force) {
    if (!api()) return Promise.resolve([]);
    if (!force && P.at && Date.now() - P.at < TTL) return Promise.resolve(P.items);
    if (P.loading) return P.loading;
    P.loading = api().list().then(function (items) {
      P.items = items || []; P.at = Date.now(); P.loading = null; return P.items;
    }, function (e) { P.loading = null; console.warn('photos', e); return P.items; });
    return P.loading;
  };

  /* longest side 1920 px, JPEG 85 % — a phone photo of 4 MB becomes roughly 300–600 KB */
  P.shrink = function (file, max) {
    max = max || 1920;
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('encode')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('image')); };
      img.src = url;
    });
  };

  P.add = function (files) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name); });
    var chain = Promise.resolve(), done = 0, failed = 0;
    list.forEach(function (f) {
      chain = chain.then(function () { return P.shrink(f); })
        .then(function (b) { return api().upload(b); })
        .then(function () { done++; }, function (e) { failed++; console.warn('photo upload', e); });
    });
    return chain.then(function () { return P.list(true); }).then(function () {
      if (FB.app && FB.app.render) FB.app.render();
      return { done: done, failed: failed };
    });
  };

  P.remove = function (name) {
    return api().remove(name).then(function () {
      P.items = P.items.filter(function (x) { return x.name !== name; });
      if (FB.app && FB.app.render) FB.app.render();
      return P.list(true);
    });
  };
})(window);
