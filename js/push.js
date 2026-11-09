/* Phone notifications (Web Push). The server side is the `reminders` edge function. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var P = (FB.push = {});

  function b64(s) {
    var pad = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  P.key = function () { return root.FB_CONFIG && root.FB_CONFIG.VAPID_PUBLIC_KEY; };
  P.supported = function () {
    return !!(FB.store && FB.store.mode === 'cloud' && P.key() && 'serviceWorker' in navigator && 'PushManager' in root && 'Notification' in root && FB.store.pushSave);
  };
  P.current = function () {
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); });
  };
  P.enable = function () {
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('denied');
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(P.key()) });
      });
    }).then(function (sub) { return FB.store.pushSave(sub, FB.device.lang || 'en'); }).then(function () { P.wanted(true); });
  };
  /* remembered per device, so the switch stays on even if the browser drops the subscription */
  P.wanted = function (v) {
    try { if (v === undefined) return localStorage.getItem('fb.push.on') === '1'; localStorage.setItem('fb.push.on', v ? '1' : '0'); } catch (e) { return false; }
  };
  /* what the switch shows: re-creates a lost subscription and re-saves it on the server */
  P.status = function () {
    if (Notification.permission !== 'granted') return Promise.resolve(false);
    return P.current().then(function (sub) {
      if (sub) { if (P.wanted()) FB.store.pushSave(sub, FB.device.lang || 'en').catch(function () {}); return true; }
      return P.wanted() ? P.enable().then(function () { return true; }, function () { return false; }) : false;
    });
  };
  P.disable = function () {
    P.wanted(false);
    return P.current().then(function (sub) {
      if (!sub) return;
      var ep = sub.endpoint;
      return sub.unsubscribe().then(function () { return FB.store.pushRemove(ep); });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
