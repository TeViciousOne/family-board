/* Spotify remote: shows what is playing and controls it (play, pause, skip, volume, shuffle, repeat, seek, device, playlists, search, like).
   The music itself plays in the Spotify app on a phone, the tablet or a speaker; this board is only the remote.
   Sign-in is "Authorization Code with PKCE": no secret, only the public Client ID of the family's own Spotify developer app.
   The login lives on this device (localStorage), like the household session. Needs Spotify Premium.
   This file: sign-in, the Web API, what is playing, the commands and the tile. The sheets (player, devices, music) are in spotify-ui.js. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  var SP = (FB.spotify = {});
  var KEY = 'fb.sp.v1', API = 'https://api.spotify.com/v1', ACC = 'https://accounts.spotify.com';
  /* the first group is enough for the tile; the second adds playlists and likes (a device connected before needs "Reconnect") */
  var SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative user-library-read user-library-modify';

  var cfg = load();                                   /* { cid, tok: { access, refresh, exp, scope }, ver, st } */
  var st = { s: null, at: 0, busy: false, wait: 0, likes: {} };  /* s = what is playing now, or null when there is no session */
  var listeners = [], timer = null, refreshing = null, volTimer = null;

  function load() { try { return JSON.parse(root.localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { root.localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* private window: stays in memory */ } }
  function changed() { listeners.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); }

  /* ---------- setup ---------- */
  SP.clientId = function () { return cfg.cid || (root.FB_CONFIG && root.FB_CONFIG.SPOTIFY_CLIENT_ID) || ''; };
  SP.setClientId = function (id) { cfg.cid = String(id || '').trim(); save(); };
  SP.redirectUri = function () { return root.location.origin + root.location.pathname; };
  SP.connected = function () { return !!(cfg.tok && cfg.tok.refresh); };
  SP.state = function () { return st.s; };
  /* did the person allow this? (a login made before playlists and likes existed lacks those) */
  SP.has = function (scope) { return !cfg.tok || !cfg.tok.scope ? false : (' ' + cfg.tok.scope + ' ').indexOf(' ' + scope + ' ') !== -1; };

  function rand(n) { var a = new Uint8Array(n); root.crypto.getRandomValues(a); return b64(a); }
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

  SP.connect = function () {
    var cid = SP.clientId(); if (!cid) return Promise.resolve();
    cfg.ver = rand(64); cfg.st = rand(16); save();
    return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(cfg.ver)).then(function (hash) {
      root.location.href = ACC + '/authorize?' + new URLSearchParams({ response_type: 'code', client_id: cid, scope: SCOPES, redirect_uri: SP.redirectUri(), state: cfg.st, code_challenge_method: 'S256', code_challenge: b64(hash) });
    });
  };
  SP.disconnect = function () { cfg.tok = null; cfg.ver = cfg.st = null; st.s = null; st.likes = {}; save(); changed(); };

  function tokenReq(params) {
    return root.fetch(ACC + '/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j || {} }; }); });
  }
  function keep(j, old) {
    cfg.tok = { access: j.access_token, refresh: j.refresh_token || old, exp: Date.now() + (j.expires_in || 3600) * 1000, scope: j.scope || (cfg.tok && cfg.tok.scope) || '' };
    save();
  }

  /* back from Spotify's login page: ?code=…&state=… */
  (function () {
    var q = new URLSearchParams(root.location.search), code = q.get('code'), state = q.get('state');
    if (!code && !q.get('error')) return;
    if (!cfg.st || state !== cfg.st) return;           /* not our redirect */
    root.history.replaceState(null, '', root.location.pathname + root.location.hash);
    var ver = cfg.ver; cfg.ver = cfg.st = null; save();
    function say(k) { setTimeout(function () { if (FB.ui && FB.ui.toast) FB.ui.toast(t(k)); if (FB.app && FB.app.render) FB.app.render(); }, 900); }
    if (!code) { say('sp.authFailed'); return; }
    tokenReq({ grant_type: 'authorization_code', code: code, redirect_uri: SP.redirectUri(), client_id: SP.clientId(), code_verifier: ver }).then(function (x) {
      if (x.ok && x.j.access_token) { keep(x.j, ''); say('sp.connected'); } else say('sp.authFailed');
    }, function () { say('sp.authFailed'); });
  })();

  function access() {
    if (!SP.connected()) return Promise.reject(new Error('signed out'));
    if (Date.now() < cfg.tok.exp - 60000) return Promise.resolve(cfg.tok.access);
    if (refreshing) return refreshing;
    var old = cfg.tok.refresh;
    refreshing = tokenReq({ grant_type: 'refresh_token', refresh_token: old, client_id: SP.clientId() }).then(function (x) {
      refreshing = null;
      if (x.ok && x.j.access_token) { keep(x.j, old); return cfg.tok.access; }
      if (x.j.error === 'invalid_grant') { SP.disconnect(); if (ui && ui.toast) ui.toast(t('sp.expired')); }
      throw new Error('auth');
    }, function (e) { refreshing = null; throw e; });
    return refreshing;
  }

  /* one call to the Web API: { status, json } (never throws on an HTTP error; rejects only when offline or signed out) */
  function api(method, path, body, retried) {
    return access().then(function (at) {
      return root.fetch(API + path, { method: method, headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    }).then(function (r) {
      if (r.status === 401 && !retried && cfg.tok) { cfg.tok.exp = 0; return api(method, path, body, true); }
      if (r.status === 429) st.wait = Date.now() + (Number(r.headers.get('Retry-After')) || 5) * 1000;
      return r.text().then(function (txt) { var j = null; try { j = JSON.parse(txt); } catch (e) { /* no body */ } return { status: r.status, json: j }; });
    });
  }
  function good(r) { return r.status >= 200 && r.status < 300; }
  function q(s) { return encodeURIComponent(s); }

  /* ---------- what is playing ---------- */
  function read(j) {
    var it = j && j.item; if (!it) return null;
    var imgs = (it.album && it.album.images) || it.images || [];
    var cover = ''; imgs.forEach(function (i) { if (i && i.url && (!cover || (i.width || 0) >= 120)) cover = i.url; });
    var d = j.device || {};
    return {
      playing: !!j.is_playing, title: it.name || '', cover: cover, duration: it.duration_ms || 0, progress: j.progress_ms || 0, at: Date.now(),
      artist: it.type === 'episode' ? ((it.show && it.show.name) || '') : (it.artists || []).map(function (a) { return a.name; }).join(', '),
      device: d.name || '', deviceId: d.id || '', vol: d.volume_percent == null ? null : d.volume_percent, canVol: d.supports_volume !== false,
      shuffle: !!j.shuffle_state, repeat: j.repeat_state || 'off', uri: it.uri || '', track: it.type === 'track'
    };
  }
  function asleep() {
    var c = root.document.getElementById('calm'), n = root.document.getElementById('night');
    return (c && c.classList.contains('on')) || (n && n.classList.contains('on'));
  }
  SP.refresh = function (force) {
    if (!SP.connected() || st.busy || root.document.hidden || asleep() || Date.now() < st.wait) return Promise.resolve();
    if (!force && Date.now() - st.at < (st.s && st.s.playing ? 4000 : 12000)) return Promise.resolve();
    st.busy = true;
    return api('GET', '/me/player').then(function (r) {
      st.busy = false; st.at = Date.now();
      if (r.status === 200) st.s = read(r.json); else if (r.status === 204) st.s = null;
      changed();
    }, function () { st.busy = false; st.at = Date.now(); /* offline: keep what is shown */ });
  };
  function now() { var s = st.s; return s ? Math.min(s.duration || 0, s.progress + (s.playing ? Date.now() - s.at : 0)) : 0; }

  /* one timer while any tile is on screen: repaints the progress bar every second and re-reads Spotify every few seconds */
  function ensureTimer() {
    if (timer) return;
    timer = setInterval(function () {
      listeners = listeners.filter(function (f) { return f.alive(); });
      if (!listeners.length) { clearInterval(timer); timer = null; return; }
      SP.refresh(false); changed();
    }, 1000);
  }
  function listen(el, paint) {
    var f = function () { paint(); }; f.alive = function () { return root.document.body.contains(el); };
    listeners.push(f); ensureTimer(); paint(); SP.refresh(false);
  }

  /* ---------- controls ---------- */
  function fail(r) {
    var scopeIssue = r.status === 403 && r.json && r.json.error && /scope/i.test(r.json.error.message || '');
    ui.toast(t(scopeIssue ? 'sp.needScope' : r.status === 404 ? 'sp.noDevice' : r.status === 403 ? 'sp.forbidden' : 'sp.failed'));
  }
  function cmd(method, path, optimistic, body) {
    if (optimistic) { optimistic(); changed(); }
    return api(method, path, body).then(function (r) {
      if (good(r)) setTimeout(function () { SP.refresh(true); }, 500);
      else { fail(r); SP.refresh(true); }
      return good(r);
    }, function () { ui.toast(t('sp.failed')); SP.refresh(true); return false; });
  }
  SP.toggle = function () {
    var s = st.s; if (!s) return;
    return cmd('PUT', s.playing ? '/me/player/pause' : '/me/player/play', function () { s.progress = now(); s.at = Date.now(); s.playing = !s.playing; });
  };
  SP.next = function () { return cmd('POST', '/me/player/next'); };
  SP.prev = function () { return cmd('POST', '/me/player/previous'); };
  SP.volume = function (v) {
    var s = st.s; if (!s) return;
    s.vol = v; clearTimeout(volTimer);
    volTimer = setTimeout(function () { cmd('PUT', '/me/player/volume?volume_percent=' + v); }, 250);
  };
  SP.shuffle = function () { var s = st.s; if (!s) return; return cmd('PUT', '/me/player/shuffle?state=' + (!s.shuffle), function () { s.shuffle = !s.shuffle; }); };
  SP.repeat = function () {
    var s = st.s; if (!s) return;
    var nx = s.repeat === 'off' ? 'context' : s.repeat === 'context' ? 'track' : 'off';
    return cmd('PUT', '/me/player/repeat?state=' + nx, function () { s.repeat = nx; });
  };
  SP.seek = function (ms) {
    var s = st.s; if (!s) return;
    ms = Math.max(0, Math.min(s.duration, Math.round(ms)));
    return cmd('PUT', '/me/player/seek?position_ms=' + ms, function () { s.progress = ms; s.at = Date.now(); });
  };

  /* where it plays */
  SP.devices = function () { return api('GET', '/me/player/devices').then(function (r) { return good(r) && r.json ? (r.json.devices || []) : []; }, function () { return []; }); };
  SP.transfer = function (id) { return cmd('PUT', '/me/player', null, { device_ids: [id], play: true }); };

  /* start something: a playlist or an album (context) or one song. With no active device Spotify answers 404: then ask where to play. */
  SP.play = function (body, deviceId) {
    return api('PUT', '/me/player/play' + (deviceId ? '?device_id=' + q(deviceId) : ''), body).then(function (r) {
      if (good(r)) { setTimeout(function () { SP.refresh(true); }, 700); return true; }
      if (r.status === 404 && !deviceId && SP.pickDevice) { SP.pickDevice(function (d) { return SP.play(body, d.id); }); return false; }
      fail(r); return false;
    }, function () { ui.toast(t('sp.failed')); return false; });
  };
  SP.queue = function (uri) { return api('POST', '/me/player/queue?uri=' + q(uri)).then(function (r) { if (good(r)) ui.toast(t('sp.queued')); else fail(r); return good(r); }, function () { ui.toast(t('sp.failed')); return false; }); };

  /* playlists, search, likes */
  SP.playlists = function () {
    return api('GET', '/me/playlists?limit=50').then(function (r) {
      if (!good(r)) return { ok: false, status: r.status, items: [] };
      return { ok: true, items: ((r.json && r.json.items) || []).filter(Boolean) };
    }, function () { return { ok: false, status: 0, items: [] }; });
  };
  SP.search = function (text) {
    return api('GET', '/search?type=track,album&limit=5&q=' + q(text)).then(function (r) {
      if (!good(r) || !r.json) return { ok: false, tracks: [], albums: [] };
      return { ok: true, tracks: ((r.json.tracks && r.json.tracks.items) || []).filter(Boolean), albums: ((r.json.albums && r.json.albums.items) || []).filter(Boolean) };
    }, function () { return { ok: false, tracks: [], albums: [] }; });
  };
  SP.liked = function (uri) {
    if (!uri || !SP.has('user-library-read')) return Promise.resolve(null);
    if (uri in st.likes) return Promise.resolve(st.likes[uri]);
    return api('GET', '/me/library/contains?uris=' + q(uri)).then(function (r) {
      if (good(r) && r.json && r.json.length) { st.likes[uri] = !!r.json[0]; return st.likes[uri]; }
      return null;
    }, function () { return null; });
  };
  SP.like = function (uri, on) {
    st.likes[uri] = on; changed();
    return api(on ? 'PUT' : 'DELETE', '/me/library?uris=' + q(uri)).then(function (r) {
      if (!good(r)) { st.likes[uri] = !on; changed(); fail(r); }
      return good(r);
    }, function () { st.likes[uri] = !on; changed(); ui.toast(t('sp.failed')); return false; });
  };
  SP.likeState = function (uri) { return st.likes[uri]; };

  /* ---------- drawing ---------- */
  /* filled glyphs for the transport; stroke glyphs (s: 1) for the rest: one weight, matched to the app's icons */
  var G = {
    play: '<path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l11-6.8a1 1 0 0 0 0-1.7l-11-6.8A1 1 0 0 0 8 5.2z"/>',
    pause: '<rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/>',
    next: '<path d="M5 6.2v11.6a.9.9 0 0 0 1.4.8l8.2-5.8a.9.9 0 0 0 0-1.5L6.4 5.4A.9.9 0 0 0 5 6.2z"/><rect x="16.5" y="5" width="2.8" height="14" rx="1.2"/>',
    note: { s: 1, d: '<path d="M9 17.2V5.6a1 1 0 0 1 .8-1l8.4-1.8a1 1 0 0 1 1.2 1v11.2"/><circle cx="6.4" cy="17.2" r="2.6"/><circle cx="16.6" cy="15" r="2.6"/>' },
    shuffle: { s: 1, d: '<path d="M3 7h3.5c2 0 3 1 4 2.5l2 3c1 1.5 2 2.5 4 2.5H21"/><path d="M18 12.5l3 2.5-3 2.5"/><path d="M3 17h3.5c1.5 0 2.5-.5 3.3-1.6"/><path d="M13.5 9c.8-1.1 1.8-2 3.5-2H21"/><path d="M18 4.5L21 7l-3 2.5"/>' },
    repeat: { s: 1, d: '<path d="M4 11V9.5a3 3 0 0 1 3-3h12"/><path d="M16 3.5l3 3-3 3"/><path d="M20 13v1.5a3 3 0 0 1-3 3H5"/><path d="M8 20.5l-3-3 3-3"/>' },
    heart: { s: 1, d: '<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10C19.5 15.5 12 20 12 20z"/>' },
    chevron: { s: 1, d: '<path d="M9 6l6 6-6 6"/>' },
    device: { s: 1, d: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><circle cx="12" cy="14.5" r="3"/><circle cx="12" cy="7" r="1"/>' },
    plus: { s: 1, d: '<path d="M12 5v14M5 12h14"/>' },
    check: { s: 1, d: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' },
    search: { s: 1, d: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>' }
  };
  function glyph(name, size, filled) {
    var el = h('span', { class: 'ico', 'aria-hidden': 'true' }), flip = name === 'prev', g = G[flip ? 'next' : name];
    var stroke = g && g.s;
    el.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (stroke && !filled ? 'none' : 'currentColor') + '"' +
      (stroke ? ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : '') + (flip ? ' style="transform:scaleX(-1)"' : '') + '>' + (stroke ? g.d : g) + '</svg>';
    return el;
  }
  function btn(name, label, fn, main) {
    return h('button', { type: 'button', class: 'sp-btn' + (main ? ' main' : ''), 'aria-label': label, onclick: fn }, glyph(name, main ? 26 : 22));
  }
  /* play / pause button that swaps its icon */
  function playBtn() {
    var b = btn('play', t('sp.play'), SP.toggle, true);
    b.paint = function (playing) {
      b.setAttribute('aria-label', playing ? t('sp.pause') : t('sp.play'));
      if (b.getAttribute('data-p') !== (playing ? '1' : '0')) { b.setAttribute('data-p', playing ? '1' : '0'); U.clear(b); b.appendChild(glyph(playing ? 'pause' : 'play', 26)); }
    };
    return b;
  }
  function cover(url, cls) { var i = h('img', { class: cls, alt: '' }); if (url) i.setAttribute('src', url); return i; }

  /* what the sheets (spotify-ui.js) need from here */
  SP.x = { st: st, api: api, listen: listen, glyph: glyph, btn: btn, playBtn: playBtn, now: now, cover: cover, good: good, fail: fail, changed: changed };

  /* the tile in the right column: the song, or (when nothing is playing) a quiet "Choose music" row */
  SP.tile = function () {
    if (!SP.connected()) return null;
    var icon = h('span', { class: 'sp-cover sp-idle-ico' }, glyph('note', 26)), img = h('img', { class: 'sp-cover', alt: '', width: 56, height: 56 });
    var title = h('b', { class: 'sp-title' }), artist = h('span', { class: 'sp-artist' });
    var bar = h('i'), pb = playBtn();
    var ctl = h('div', { class: 'sp-ctl' }, btn('prev', t('sp.prev'), SP.prev), pb, btn('next', t('sp.next'), SP.next));
    var barBox = h('span', { class: 'sp-bar', 'aria-hidden': 'true' }, bar);
    var info = h('button', { type: 'button', class: 'sp-info', onclick: function () { if (st.s) SP.open(); else SP.browse(); } }, img, icon, h('span', { class: 'sp-txt' }, title, artist));
    var el = h('section', { class: 'sp-tile', 'aria-label': 'Spotify' }, info, ctl, barBox);
    listen(el, function () {
      var s = st.s;
      el.classList.toggle('idle', !s); ctl.hidden = barBox.hidden = !s; img.hidden = !s; icon.hidden = !!s;
      if (!s) { title.textContent = 'Spotify'; artist.textContent = t('sp.chooseMusic'); return; }
      if (title.textContent !== s.title) title.textContent = s.title;
      if (artist.textContent !== s.artist) artist.textContent = s.artist;
      if (img.getAttribute('src') !== s.cover) { if (s.cover) img.setAttribute('src', s.cover); else img.removeAttribute('src'); }
      pb.paint(s.playing);
      bar.style.transform = 'scaleX(' + (s.duration ? now() / s.duration : 0).toFixed(4) + ')';
    });
    return el;
  };

  /* small tile for phones */
  SP.mini = function () {
    if (!SP.connected()) return null;
    var ico = h('span', { class: 'pt-ico' }), big = h('b', null, ''), small = h('small', null, '');
    var el = h('button', { type: 'button', class: 'ptile pt-sp', onclick: function () { if (st.s) SP.open(); else SP.browse(); } }, ico, big, small);
    listen(el, function () {
      var s = st.s, want = !s ? 'note' : s.playing ? 'play' : 'pause';
      big.textContent = s ? s.title : 'Spotify'; small.textContent = s ? s.artist : t('sp.chooseMusic');
      if (ico.getAttribute('data-g') !== want) { ico.setAttribute('data-g', want); U.clear(ico); ico.appendChild(glyph(want, 22)); }
    });
    return el;
  };
})(typeof window !== 'undefined' ? window : globalThis);
