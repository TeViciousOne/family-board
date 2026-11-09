/* Sounds are generated with the Web Audio API, so there are no audio files to download. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var S = (FB.sound = {});
  var ctx = null;
  S.enabled = true;
  S.volume = 0.6;

  function ensure() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  /* Browsers only allow sound after a touch. The first tap anywhere unlocks it. */
  S.unlock = function () {
    var c = ensure();
    if (c && c.state === 'suspended') c.resume();
  };
  S.isReady = function () { return !!ctx && ctx.state === 'running'; };

  function tone(freq, start, dur, type, gain) {
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + start;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    var peak = Math.max(0.0001, (gain || 0.25) * S.volume);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function play(fn) {
    if (!S.enabled) return;
    var c = ensure(); if (!c) return;
    if (c.state === 'suspended') { c.resume().then(fn).catch(function () { /* still locked */ }); return; }
    fn();
  }

  /* a chore was ticked off: short bright pop */
  S.done = function () { play(function () { tone(660, 0, 0.12, 'sine', 0.3); tone(990, 0.07, 0.18, 'sine', 0.28); }); };
  /* a chore was un-ticked: soft low note */
  S.undo = function () { play(function () { tone(330, 0, 0.16, 'triangle', 0.22); }); };
  /* a chore is overdue: two gentle notes */
  S.overdue = function () { play(function () { tone(523, 0, 0.35, 'sine', 0.3); tone(392, 0.28, 0.5, 'sine', 0.3); }); };
  /* an event is about to start: three rising notes */
  S.event = function () { play(function () { tone(523, 0, 0.3, 'sine', 0.3); tone(659, 0.22, 0.3, 'sine', 0.3); tone(784, 0.44, 0.6, 'sine', 0.3); }); };
  /* a note or shopping item arrived from someone else */
  S.ping = function () { play(function () { tone(880, 0, 0.18, 'sine', 0.2); }); };
  /* settings test button, always plays even when "enabled" is off */
  S.test = function () { var was = S.enabled; S.enabled = true; S.event(); S.enabled = was; };
})(typeof window !== 'undefined' ? window : globalThis);
