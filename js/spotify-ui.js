/* Spotify sheets: the player (seek, shuffle, repeat, like, volume, device), "Play on" (device picker) and "Choose music" (playlists + search).
   The Web API calls and the tile are in spotify.js. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  var SP = FB.spotify, X = SP.x, glyph = X.glyph, st = X.st;

  function clock(ms) { var s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function row(img, title, sub, onclick, extra) {
    return h('div', { class: 'sp-row' },
      h('button', { type: 'button', class: 'sp-row-main', onclick: onclick }, img, h('span', { class: 'sp-row-txt' }, h('b', null, title), sub ? h('small', null, sub) : null)),
      extra || null);
  }
  function thumb(images) {
    var url = ''; (images || []).forEach(function (i) { if (i && i.url) url = i.url; });   /* the smallest is last */
    return url ? X.cover(url, 'sp-thumb') : h('span', { class: 'sp-thumb sp-thumb-empty' }, glyph('note', 20));
  }
  function note(text) { return h('p', { class: 'sp-note' }, text); }
  function reconnect() {
    return h('div', { class: 'sp-reconnect' }, note(t('sp.reconnectHint')), h('button', { type: 'button', class: 'btn', onclick: function () { SP.connect(); } }, t('sp.reconnect')));
  }

  /* ---------- Play on: pick a device ---------- */
  SP.pickDevice = function (pick) {
    var box = h('div', { class: 'sp-list' }, note('…')), modal;
    modal = ui.modal({ title: t('sp.playOn'), body: box, focus: false });
    SP.devices().then(function (list) {
      U.clear(box);
      if (!list.length) { box.appendChild(note(t('sp.noDevices'))); return; }
      list.forEach(function (d) {
        var on = !!d.is_active;
        box.appendChild(h('div', { class: 'sp-row' + (on ? ' on' : '') },
          h('button', { type: 'button', class: 'sp-row-main', disabled: !!d.is_restricted, onclick: function () {
            modal.close();
            if (pick) pick(d); else if (!on) SP.transfer(d.id);
          } }, h('span', { class: 'sp-thumb sp-thumb-empty' }, glyph('device', 22)), h('span', { class: 'sp-row-txt' }, h('b', null, d.name), h('small', null, d.type || '')),
          on ? h('span', { class: 'sp-check', 'aria-label': t('sp.active') }, glyph('check', 22)) : null)));
      });
    });
  };

  /* ---------- Choose music: playlists and search ---------- */
  SP.browse = function () {
    var body = h('div', { class: 'sp-browse' }), pane = h('div', { class: 'sp-pane' }), modal, tab = 'playlists';
    function played(ok) { if (ok) modal.close(); }

    function playlists() {
      U.clear(pane);
      if (!SP.has('playlist-read-private')) { pane.appendChild(reconnect()); return; }
      var list = h('div', { class: 'sp-list' }, note('…')); pane.appendChild(list);
      SP.playlists().then(function (r) {
        U.clear(list);
        if (!r.ok) { list.appendChild(r.status === 403 ? reconnect() : note(t('sp.failed'))); return; }
        if (!r.items.length) { list.appendChild(note(t('sp.noPlaylists'))); return; }
        r.items.forEach(function (p) {
          list.appendChild(row(thumb(p.images), p.name, p.owner && p.owner.display_name ? p.owner.display_name : '', function () { SP.play({ context_uri: p.uri }).then(played); }));
        });
      });
    }

    function search() {
      U.clear(pane);
      var input = h('input', { type: 'search', class: 'sp-q', placeholder: t('sp.searchPh'), 'aria-label': t('sp.search'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      var out = h('div', { class: 'sp-list' }), timer = null, seq = 0;
      pane.appendChild(input); pane.appendChild(out);
      function go() {
        var text = input.value.trim(), my = ++seq;
        U.clear(out); if (text.length < 2) return;
        out.appendChild(note('…'));
        SP.search(text).then(function (r) {
          if (my !== seq) return;
          U.clear(out);
          if (!r.ok) { out.appendChild(note(t('sp.searchFailed'))); return; }
          if (!r.tracks.length && !r.albums.length) { out.appendChild(note(t('sp.noResults'))); return; }
          if (r.tracks.length) out.appendChild(h('h4', { class: 'sp-h' }, t('sp.songs')));
          r.tracks.forEach(function (x) {
            out.appendChild(row(thumb(x.album && x.album.images), x.name, (x.artists || []).map(function (a) { return a.name; }).join(', '),
              function () { SP.play({ uris: [x.uri] }).then(played); },
              h('button', { type: 'button', class: 'sp-btn', 'aria-label': t('sp.addQueue'), onclick: function () { SP.queue(x.uri); } }, glyph('plus', 22))));
          });
          if (r.albums.length) out.appendChild(h('h4', { class: 'sp-h' }, t('sp.albums')));
          r.albums.forEach(function (a) {
            out.appendChild(row(thumb(a.images), a.name, (a.artists || []).map(function (x) { return x.name; }).join(', '), function () { SP.play({ context_uri: a.uri }).then(played); }));
          });
        });
      }
      input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(go, 400); });
      setTimeout(function () { if (!root.matchMedia || !root.matchMedia('(pointer: coarse)').matches) input.focus(); }, 50);
    }

    function show() { if (tab === 'playlists') playlists(); else search(); }
    body.appendChild(ui.seg([{ v: 'playlists', label: t('sp.playlists') }, { v: 'search', label: t('sp.search') }], tab, function (v) { tab = v; show(); }));
    body.appendChild(pane);
    modal = ui.modal({ title: t('sp.music'), body: body, focus: false, size: 'wide' });
    show();
  };

  /* ---------- the player ---------- */
  SP.open = function () {
    if (!st.s) { SP.browse(); return; }
    var img = h('img', { class: 'sp-big', alt: '' }), title = h('h3', { class: 'sp-m-title' }), artist = h('p', { class: 'sp-m-artist' });
    var heart = h('button', { type: 'button', class: 'sp-btn sp-heart', hidden: true, 'aria-pressed': 'false', onclick: function () {
      var s = st.s; if (s && s.uri) SP.like(s.uri, !SP.likeState(s.uri));
    } });
    var seek = h('input', { type: 'range', class: 'sp-seek', min: '0', max: '1000', step: '1000', value: '0', 'aria-label': t('sp.seek') });
    var dragging = false, tl = h('span', null, '0:00'), tr = h('span', null, '0:00');
    seek.addEventListener('input', function () { dragging = true; tl.textContent = clock(Number(seek.value)); });
    seek.addEventListener('change', function () { dragging = false; SP.seek(Number(seek.value)); });
    var pb = X.playBtn();
    var shuffle = X.btn('shuffle', t('sp.shuffle'), SP.shuffle), repeat = X.btn('repeat', t('sp.repeat'), SP.repeat), one = h('small', { class: 'sp-one', hidden: true }, '1');
    repeat.appendChild(one);
    var vol = h('input', { type: 'range', min: '0', max: '100', step: '5', 'aria-label': t('sp.volume'), oninput: function () { SP.volume(Number(vol.value)); } });
    var volRow = h('div', { class: 'sp-vol' }, h('span', { class: 'sp-vol-l' }, t('sp.volume')), vol);
    var devTxt = h('span', null, ''), dev = h('button', { type: 'button', class: 'sp-device', onclick: function () { SP.pickDevice(); } }, glyph('device', 22), devTxt, glyph('chevron', 18));
    var more = h('button', { type: 'button', class: 'btn ghost sp-more', onclick: function () { SP.browse(); } }, glyph('note', 20), ' ', t('sp.chooseMusic'));

    var body = h('div', { class: 'sp-modal' },
      img,
      h('div', { class: 'sp-m-head' }, h('div', { class: 'sp-m-txt' }, title, artist), heart),
      h('div', { class: 'sp-seekbox' }, seek, h('div', { class: 'sp-times' }, tl, tr)),
      h('div', { class: 'sp-ctl' }, shuffle, X.btn('prev', t('sp.prev'), SP.prev), pb, X.btn('next', t('sp.next'), SP.next), repeat),
      volRow, dev, more);
    ui.modal({ title: 'Spotify', body: body, focus: false });

    var lastUri = '';
    X.listen(body, function () {
      var s = st.s; if (!s) return;
      title.textContent = s.title; artist.textContent = s.artist;
      if (img.getAttribute('src') !== s.cover) { if (s.cover) img.setAttribute('src', s.cover); else img.removeAttribute('src'); }
      pb.paint(s.playing);
      seek.max = String(s.duration || 1000);
      if (!dragging && root.document.activeElement !== seek) { seek.value = String(X.now()); tl.textContent = clock(X.now()); }
      tr.textContent = clock(s.duration);
      shuffle.classList.toggle('on', s.shuffle); shuffle.setAttribute('aria-pressed', String(s.shuffle));
      repeat.classList.toggle('on', s.repeat !== 'off'); repeat.setAttribute('aria-pressed', String(s.repeat !== 'off')); one.hidden = s.repeat !== 'track';
      volRow.hidden = !s.canVol || s.vol == null;
      if (root.document.activeElement !== vol && s.vol != null) vol.value = String(s.vol);
      devTxt.textContent = s.device ? t('sp.on', { device: s.device }) : t('sp.playOn');
      /* the heart: only for songs, and only when the login allows it */
      var can = s.track && SP.has('user-library-modify');
      if (s.uri !== lastUri) { lastUri = s.uri; if (can) SP.liked(s.uri).then(function () { X.changed(); }); }
      var liked = can ? SP.likeState(s.uri) : null;
      heart.hidden = liked == null;
      if (liked != null) {
        heart.setAttribute('aria-pressed', String(!!liked)); heart.setAttribute('aria-label', liked ? t('sp.unlike') : t('sp.like')); heart.classList.toggle('on', !!liked);
        if (heart.getAttribute('data-l') !== String(!!liked)) { heart.setAttribute('data-l', String(!!liked)); U.clear(heart); heart.appendChild(glyph('heart', 24, !!liked)); }
      }
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
