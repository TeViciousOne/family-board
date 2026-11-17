/* Spotify remote: shows what is playing and controls it (play, pause, skip, volume).
   The music itself plays in the Spotify app on a phone, the tablet or a speaker; this board is only the remote.
   Sign-in is "Authorization Code with PKCE": no secret, only the public Client ID of the family's own Spotify developer app.
   The login lives on this device (localStorage), like the household session. Needs Spotify Premium. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  var SP = (FB.spotify = {});
  var KEY = 'fb.sp.v1', API = 'https://api.spotify.com/v1', ACC = 'https://accounts.spotify.com';
  var SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';

  var cfg = load();                                   /* { cid, tok: { access, refresh, exp }, ver, st } */
  var st = { s: null, at: 0, busy: false, wait: 0 };  /* s = what is playing now, or null when there is no session */
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

  function rand(n) { var a = new Uint8Array(n); root.crypto.getRandomValues(a); return b64(a); }
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

  SP.connect = function () {
    var cid = SP.clientId(); if (!cid) return Promise.resolve();
    cfg.ver = rand(64); cfg.st = rand(16); save();
    return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(cfg.ver)).then(function (hash) {
      root.location.href = ACC + '/authorize?' + new URLSearchParams({ response_type: 'code', client_id: cid, scope: SCOPES, redirect_uri: SP.redirectUri(), state: cfg.st, code_challenge_method: 'S256', code_challenge: b64(hash) });
    });
  };
  SP.disconnect = function () { cfg.tok = null; cfg.ver = cfg.st = null; st.s = null; save(); changed(); };

  function tokenReq(params) {
    return root.fetch(ACC + '/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j || {} }; }); });
  }
  function keep(j, old) { cfg.tok = { access: j.access_token, refresh: j.refresh_token || old, exp: Date.now() + (j.expires_in || 3600) * 1000 }; save(); }

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
  function api(method, path, retried) {
    return access().then(function (at) {
      return root.fetch(API + path, { method: method, headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' } });
    }).then(function (r) {
      if (r.status === 401 && !retried && cfg.tok) { cfg.tok.exp = 0; return api(method, path, true); }
      if (r.status === 429) st.wait = Date.now() + (Number(r.headers.get('Retry-After')) || 5) * 1000;
      return r.text().then(function (txt) { var j = null; try { j = JSON.parse(txt); } catch (e) { /* no body */ } return { status: r.status, json: j }; });
    });
  }

  /* ---------- what is playing ---------- */
  function read(j) {
    var it = j && j.item; if (!it) return null;
    var imgs = (it.album && it.album.images) || it.images || [];
    var cover = ''; imgs.forEach(function (i) { if (i && i.url && (!cover || (i.width || 0) >= 120)) cover = i.url; });
    var d = j.device || {};
    return {
      playing: !!j.is_playing, title: it.name || '', cover: cover, duration: it.duration_ms || 0, progress: j.progress_ms || 0, at: Date.now(),
      artist: it.type === 'episode' ? ((it.show && it.show.name) || '') : (it.artists || []).map(function (a) { return a.name; }).join(', '),
      device: d.name || '', vol: d.volume_percent == null ? null : d.volume_percent, canVol: d.supports_volume !== false
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
  function cmd(method, path, optimistic) {
    if (optimistic) { optimistic(); changed(); }
    return api(method, path).then(function (r) {
      if (r.status >= 200 && r.status < 300) setTimeout(function () { SP.refresh(true); }, 500);
      else {
        ui.toast(t(r.status === 404 ? 'sp.noDevice' : r.status === 403 ? 'sp.forbidden' : 'sp.failed'));
        SP.refresh(true);
      }
    }, function () { ui.toast(t('sp.failed')); SP.refresh(true); });
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

  /* ---------- drawing ---------- */
  var G = {
    play: '<path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l11-6.8a1 1 0 0 0 0-1.7l-11-6.8A1 1 0 0 0 8 5.2z"/>',
    pause: '<rect x="6" y="4.5" width="4.2" height="15" rx="1.2"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2"/>',
    next: '<path d="M5 6.2v11.6a.9.9 0 0 0 1.4.8l8.2-5.8a.9.9 0 0 0 0-1.5L6.4 5.4A.9.9 0 0 0 5 6.2z"/><rect x="16.5" y="5" width="2.8" height="14" rx="1.2"/>'
  };
  function glyph(name, size) {
    var el = h('span', { class: 'ico', 'aria-hidden': 'true' }), flip = name === 'prev';
    el.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor"' + (flip ? ' style="transform:scaleX(-1)"' : '') + '>' + G[flip ? 'next' : name] + '</svg>';
    return el;
  }
  function btn(name, label, fn, main) {
    var b = h('button', { type: 'button', class: 'sp-btn' + (main ? ' main' : ''), 'aria-label': label, onclick: fn }, glyph(name, main ? 26 : 22));
    return b;
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

  /* the tile in the right column: only when Spotify has something playing or paused */
  SP.tile = function () {
    if (!SP.connected()) return null;
    var cover = h('img', { class: 'sp-cover', alt: '', width: 56, height: 56 }), title = h('b', { class: 'sp-title' }), artist = h('span', { class: 'sp-artist' });
    var bar = h('i'), pb = playBtn();
    var el = h('section', { class: 'sp-tile', 'aria-label': t('sp.nowPlaying') },
      h('button', { type: 'button', class: 'sp-info', onclick: SP.open }, cover, h('span', { class: 'sp-txt' }, title, artist)),
      h('div', { class: 'sp-ctl' }, btn('prev', t('sp.prev'), SP.prev), pb, btn('next', t('sp.next'), SP.next)),
      h('span', { class: 'sp-bar', 'aria-hidden': 'true' }, bar));
    listen(el, function () {
      var s = st.s; el.hidden = !s; if (!s) return;
      if (title.textContent !== s.title) title.textContent = s.title;
      if (artist.textContent !== s.artist) artist.textContent = s.artist;
      if (cover.getAttribute('src') !== s.cover) { if (s.cover) cover.setAttribute('src', s.cover); else cover.removeAttribute('src'); }
      pb.paint(s.playing);
      bar.style.transform = 'scaleX(' + (s.duration ? now() / s.duration : 0).toFixed(4) + ')';
    });
    return el;
  };

  /* small tile for phones */
  SP.mini = function () {
    if (!SP.connected()) return null;
    var ico = h('span', { class: 'pt-ico' }), big = h('b', null, ''), small = h('small', null, '');
    var el = h('button', { type: 'button', class: 'ptile pt-sp', onclick: SP.open }, ico, big, small);
    listen(el, function () {
      var s = st.s; el.hidden = !s; if (!s) return;
      big.textContent = s.title; small.textContent = s.artist;
      var want = s.playing ? 'play' : 'pause';
      if (ico.getAttribute('data-g') !== want) { ico.setAttribute('data-g', want); U.clear(ico); ico.appendChild(glyph(s.playing ? 'play' : 'pause', 22)); }
    });
    return el;
  };

  /* the full player in a sheet: big cover, controls, volume, and where it plays */
  SP.open = function () {
    if (!st.s) return;
    var cover = h('img', { class: 'sp-big', alt: '' }), title = h('h3', { class: 'sp-m-title' }), artist = h('p', { class: 'sp-m-artist' });
    var bar = h('i'), pb = playBtn(), dev = h('p', { class: 'sp-dev' });
    var vol = h('input', { type: 'range', min: '0', max: '100', step: '5', 'aria-label': t('sp.volume'), oninput: function () { SP.volume(Number(vol.value)); } });
    var volRow = h('div', { class: 'sp-vol' }, h('span', { class: 'sp-vol-l' }, t('sp.volume')), vol);
    var body = h('div', { class: 'sp-modal' }, cover, title, artist, h('span', { class: 'sp-bar', 'aria-hidden': 'true' }, bar),
      h('div', { class: 'sp-ctl' }, btn('prev', t('sp.prev'), SP.prev), pb, btn('next', t('sp.next'), SP.next)), volRow, dev);
    ui.modal({ title: 'Spotify', body: body, focus: false });
    listen(body, function () {
      var s = st.s; if (!s) return;
      title.textContent = s.title; artist.textContent = s.artist;
      if (cover.getAttribute('src') !== s.cover) { if (s.cover) cover.setAttribute('src', s.cover); else cover.removeAttribute('src'); }
      pb.paint(s.playing);
      bar.style.transform = 'scaleX(' + (s.duration ? now() / s.duration : 0).toFixed(4) + ')';
      volRow.hidden = !s.canVol || s.vol == null;
      if (root.document.activeElement !== vol && s.vol != null) vol.value = String(s.vol);
      dev.textContent = s.device ? t('sp.on', { device: s.device }) : '';
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
