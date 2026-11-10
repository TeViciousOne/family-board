/* Home screen: clock + weather on the left, one column per person in the middle, what's coming on the right. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var U = FB.util, L = FB.logic, ui = FB.ui, h = U.h;
  var t = function (k, v) { return FB.i18n.t(k, v); };
  FB.views = FB.views || {};

  /* ---------- weather block ---------- */
  function hourCell(x, first) {
    return h('div', { class: 'wx-h' },
      h('span', { class: 'wx-hn' }, first ? t('wx.now') : x.time.slice(11, 13) + ':00'),
      h('span', { html: FB.weather.icon(FB.weather.kindOf(x.code, x.isDay), 30) }),
      h('span', { class: 'wx-ht' }, Math.round(x.temp) + '°'),
      h('span', { class: 'wx-hr' }, x.rain >= 20 ? x.rain + '%' : ''));
  }

  /* tap the weather: next 24 hours and the days ahead */
  function openWeather() {
    var w = FB.app.weather || {};
    if (!w.data) return;
    var hrs = FB.weather.hoursFrom(w.data, 24);
    var body = h('div', { class: 'wx-sheet' },
      h('h3', { class: 'wx-sh' }, t('wx.hourly')),
      h('div', { class: 'wx-hscroll' }, hrs.map(function (x, i) { return hourCell(x, i === 0); })),
      h('h3', { class: 'wx-sh' }, t('wx.daily')),
      h('div', { class: 'wx-dlist' }, w.data.days.map(function (d, i) {
        return h('div', { class: 'wx-drow' },
          h('span', { class: 'wx-dn2' }, i === 0 ? t('wx.today') : FB.i18n.dayShort(U.weekday(d.date))),
          h('span', { html: FB.weather.icon(FB.weather.kindOf(d.code, 1), 32) }),
          h('span', { class: 'wx-dr' }, d.rain >= 20 ? d.rain + '%' : ''),
          h('span', { class: 'wx-lo' }, Math.round(d.min) + '°'),
          h('span', { class: 'wx-hi' }, Math.round(d.max) + '°'));
      })));
    ui.modal({ title: (FB.device.place || FB.weather.DEFAULT_PLACE).name, body: body, size: 'wide', focus: false });
  }

  function weatherBlock() {
    var w = FB.app.weather || {};
    var place = FB.device.place || FB.weather.DEFAULT_PLACE;
    if (!w.data) {
      return h('div', { class: 'wx wx-empty' },
        h('p', null, w.loading ? t('wx.loading') : t('wx.unavailable')),
        w.loading ? null : h('button', { class: 'link-btn', onclick: function () { FB.app.loadWeather(true); } }, t('wx.retry')));
    }
    var cur = w.data.current, today = w.data.days[0] || {};
    var kind = FB.weather.kindOf(cur.code, cur.isDay);
    var nowEl = h('div', { class: 'wx-now' },
      h('span', { html: FB.weather.icon(kind, 72) }),
      h('div', { class: 'wx-temp' }, Math.round(cur.temp) + '°'));
    var meta = [];
    var line1 = [t('wx.feels', { n: Math.round(cur.feels) })];
    if (today.rain) line1.push(t('wx.chance', { p: today.rain }));
    meta.push(line1.join(' · '));
    if (today.max != null) meta.push(t('wx.hiLo', { hi: Math.round(today.max), lo: Math.round(today.min) }));
    var strip = h('div', { class: 'wx-strip' }, w.data.days.slice(1, 6).map(function (d) {
      return h('div', { class: 'wx-day' },
        h('span', { class: 'wx-dn' }, FB.i18n.dayShort(U.weekday(d.date))),
        h('span', { html: FB.weather.icon(FB.weather.kindOf(d.code, 1), 34) }),
        h('span', { class: 'wx-hi' }, Math.round(d.max) + '°'),
        h('span', { class: 'wx-lo' }, Math.round(d.min) + '°'));
    }));
    var hrs = FB.weather.hoursFrom(w.data, 6);
    var hourly = hrs.length ? h('div', { class: 'wx-hours' }, hrs.map(function (x, i) { return hourCell(x, i === 0); })) : null;
    return h('div', { class: 'wx', role: 'button', tabindex: '0', onclick: openWeather, onkeydown: function (e) { if (e.key === 'Enter') openWeather(); } },
      nowEl,
      h('div', { class: 'wx-desc' }, t(FB.weather.labelKey(cur.code)) + ' · ' + place.name),
      h('div', { class: 'wx-meta' }, meta.map(function (m) { return h('div', null, m); })),
      hourly,
      strip,
      w.stale ? h('p', { class: 'wx-stale' }, t('wx.stale')) : null);
  }

  /* ---------- one chore row ---------- */
  function choreRow(entry, color) {
    var c = entry.chore, done = entry.done;
    var meta = [];
    if (done) {
      var by = L.member(done.done_by);
      meta.push(t('chore.doneBy', { name: by ? by.name : t('chore.someone'), time: FB.i18n.timeOf(done.done_at) }));
    } else {
      if (entry.carried) meta.push(t('chore.overdueSince', { when: FB.i18n.relDay(c.rule.start) }));
      else if (entry.overdue) meta.push(t('chore.overdue'));
      if (c.due_time && !entry.carried) meta.push(t('chore.by', { time: c.due_time }));
      if (entry.last) {
        var lm = L.member(entry.last.done_by);
        meta.push(t('chore.last', { name: lm ? lm.name : t('chore.someone'), when: FB.i18n.relDay(entry.last.on_date) }));
      }
    }
    var who = L.member(c.member_id);
    color = who ? who.color : null;
    var row = h('button', {
      type: 'button', class: 'chore' + (done ? ' done' : '') + (entry.overdue ? ' overdue' : ''),
      style: { '--c': color || 'var(--brand)' },
      'aria-label': (done ? t('chore.markUndo') : t('chore.markDone')) + ': ' + c.title,
      onclick: function () { FB.actions.tapChore(entry, row); }
    },
      h('span', { class: 'tick' }, done ? ui.icon('check', 22) : null),
      h('span', { class: 'chore-txt' },
        h('span', { class: 'chore-title' }, (c.emoji ? c.emoji + ' ' : '') + c.title),
        meta.map(function (m) { return h('span', { class: 'chore-meta' }, m); })),
      who ? h('span', { class: 'chore-who', style: { background: who.color, color: U.textOn(who.color) } }, who.emoji || who.name) : null);
    return row;
  }

  /* progress ring: fills as chores get done */
  function ring(done, total) {
    var r = 22, c = 2 * Math.PI * r, f = total ? done / total : 0;
    var svg = '<svg viewBox="0 0 52 52" width="52" height="52"><circle cx="26" cy="26" r="' + r + '" class="ring-bg"/>' +
      '<circle cx="26" cy="26" r="' + r + '" class="ring-fg" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - f)).toFixed(1) + '"/></svg>';
    return h('div', { class: 'col-count ring' + (done === total ? ' full' : ''), 'aria-label': done + '/' + total },
      h('span', { class: 'ring-svg', html: svg }), h('span', { class: 'ring-txt' }, done + '/' + total));
  }

  /* everything done: say so, and show what is coming tomorrow */
  function allDone() {
    var tm = U.addDays(U.today(), 1);
    var next = L.choresDue(tm, '00:00').filter(function (x) { return !x.done; }).slice(0, 5);
    return h('div', { class: 'col-allDone all-done' },
      h('span', { class: 'ad-ico' }, ui.icon('check', 30)),
      h('div', { class: 'ad-txt' },
        h('b', null, t('board.allDone')),
        next.length ? h('span', null, t('home.tomorrow') + ': ' + next.map(function (x) { return (x.chore.emoji ? x.chore.emoji + ' ' : '') + x.chore.title; }).join(' · ')) : null));
  }

  /* today's events as a strip above the chores */
  function todayStrip(today) {
    var evs = L.eventsOn(today).filter(function (x) { return x.event.kind !== 'countdown'; });
    var sp = L.special(today);
    if (!evs.length && !sp.length) return null;
    return h('div', { class: 'today-strip', 'data-fit-skip': '1' },
      h('span', { class: 'ts-lbl' }, t('rel.today')),
      sp.slice(0, 3).map(function (x) {
        var txt = x.type === 'celebrant' ? t('hol.congrats', { name: x.label }) : x.type === 'nameday' ? t('hol.nameday') + ': ' + x.names.slice(0, 3).join(', ') : x.label;
        return h('button', { type: 'button', class: 'ts-ev ts-hol t-' + x.type, onclick: function () { FB.app.go('calendar'); } }, h('span', null, x.icon + ' ' + txt));
      }),
      evs.slice(0, 6).map(function (x) {
        var e = x.event, m = L.member(e.member_id);
        var title = e.kind === 'birthday' ? '🎂 ' + (x.age && x.age > 0 ? t('event.turns', { name: e.title, n: x.age }) : e.title) : e.title;
        return h('button', { type: 'button', class: 'ts-ev', style: { '--c': m ? m.color : 'var(--ink-3)' }, onclick: function () { FB.actions.openEvent(e); } },
          e.all_day || !e.start_time ? null : h('b', null, e.start_time), h('span', null, title));
      }));
  }

  /* one shared list: to-do first, finished at the bottom; the person shows as a small coloured tag */
  function list(items) {
    var sorted = items.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      var da = a.x.done ? 1 : 0, db = b.x.done ? 1 : 0;
      return da - db || a.i - b.i;
    }).map(function (o) { return o.x; });
    var doneN = items.filter(function (x) { return x.done; }).length;
    var pct = items.length ? Math.round((doneN / items.length) * 100) : 0;
    var head = h('div', { class: 'list-head' },
      h('div', { class: 'list-title' }, t('nav.chores')),
      items.length ? ring(doneN, items.length) : null,
      h('div', { class: 'list-actions' },
        h('button', { type: 'button', class: 'btn add-pill', onclick: function () { FB.actions.openTemplates(); } }, ui.icon('plus', 18), h('span', null, t('board.addChores')))));
    var bar = h('div', { class: 'list-bar' }, h('i', { style: { width: pct + '%' } }));
    var body = h('div', { class: 'list-body', 'data-scroll': 'chores-list' });
    if (!items.length) body.appendChild(h('p', { class: 'col-empty' }, t('board.nothingToday')));
    else {
      if (doneN === items.length) body.appendChild(allDone());
      var size = sorted.length <= 4 ? ' few' : sorted.length <= 8 ? ' mid' : '';
      body.appendChild(h('div', { class: 'list-grid' + size, 'data-fit': '1', 'data-fit-min': '0.62', 'data-fit-max': '1' }, sorted.map(function (x) { return choreRow(x); })));
    }
    return h('section', { class: 'col' }, head, bar, body);
  }

  /* ---------- right rail ---------- */
  function eventLine(x) {
    var e = x.event, m = L.member(e.member_id);
    var when = e.all_day || !e.start_time ? t('event.allDay') : e.start_time;
    var title = e.title;
    if (e.kind === 'birthday') title = '🎂 ' + (x.age && x.age > 0 ? t('event.turns', { name: e.title, n: x.age }) : e.title);
    return h('button', { type: 'button', class: 'ev', onclick: function () { FB.actions.openEvent(e); } },
      h('span', { class: 'ev-dot', style: { background: m ? m.color : 'var(--ink-3)' } }),
      h('span', { class: 'ev-when' }, when),
      h('span', { class: 'ev-title' }, title));
  }

  /* wide landscape (iPad / wall tablet): events and countdown live in the left column, shopping at the top right */
  function isWide() { return !!(root.matchMedia && root.matchMedia('(orientation: landscape) and (min-width: 900px)').matches); }

  function rightRail(today, leftIn) {
    var wide = isWide() && leftIn;
    var rail = h('aside', { class: 'rail rail-right', 'data-scroll': 'rail-right' });
    var inner = h('div', { class: 'rail-in', 'data-fit': '1', 'data-fit-min': '0.6' });
    rail.appendChild(inner);

    var ups = L.upcoming(today, 8);
    var shown = ups.slice(0, 7);
    var secUps = h('section', { class: 'rr rr-ups' }, h('h3', null, t('home.comingUp')));
    if (!shown.length) secUps.appendChild(h('p', { class: 'muted' }, t('home.noEvents')));
    var lastDate = null, group = null;
    shown.forEach(function (x) {
      if (x.date !== lastDate) {
        lastDate = x.date;
        group = h('div', { class: 'ev-group' }, h('div', { class: 'ev-day' }, FB.i18n.relDay(x.date)));
        secUps.appendChild(group);
      }
      group.appendChild(eventLine(x));
    });
    secUps.appendChild(h('button', { type: 'button', class: 'link-btn', onclick: function () { FB.app.go('calendar'); } }, t('home.openCalendar')));
    if (FB.showW('events')) (wide ? leftIn : inner).appendChild(secUps);

    var cds = FB.showW('countdown') ? L.countdowns(today).slice(0, 3) : [];
    if (cds.length) {
      var secCd = h('section', { class: 'rr rr-cd' }, h('h3', null, t('home.countdowns')));
      cds.forEach(function (c) {
        secCd.appendChild(h('button', { type: 'button', class: 'cd', onclick: function () { FB.actions.openEvent(c.event); } },
          h('b', null, String(c.days)), h('span', null, (c.days === 1 ? t('unit.day') : t('unit.days')) + ' · ' + c.event.title)));
      });
      inner.appendChild(secCd);
    }

    if (wide && FB.ac && FB.showW('ac')) { var act = FB.ac.tile(); if (act) inner.appendChild(act); }
    var notes = FB.showW('notes') ? L.notesSorted().slice(0, 2) : [];
    if (notes.length) {
      var secN = h('section', { class: 'rr rr-notes' }, h('h3', null, t('home.notes')));
      notes.forEach(function (n) {
        var m = L.member(n.author);
        secN.appendChild(h('button', { type: 'button', class: 'note-mini', style: { borderColor: m ? m.color : 'var(--ink-3)' }, onclick: function () { FB.app.go('lists'); } },
          h('span', null, n.body), m ? h('small', null, m.name) : null));
      });
      inner.appendChild(secN);
      var notesEl = secN;
    }

    var openItems = L.shoppingSorted().filter(function (s) { return !s.done; });
    var open = openItems.length;
    var showShop = FB.showW('shopping');
    if (open && showShop) {
      rail.classList.add('has-shop');
      var secS = h('section', { class: 'rr rr-shop' }, h('h3', null, t('shop.title')));
      openItems.slice(0, 4).forEach(function (it) {
        var m = L.member(it.added_by);
        secS.appendChild(h('button', { type: 'button', class: 'note-mini shop-mini', style: { borderColor: m ? m.color : 'var(--ink-3)' }, onclick: function () { FB.actions.openShopping(); } },
          h('span', null, it.title), m ? h('small', null, m.name) : null));
      });
      if (open > 4) secS.appendChild(h('button', { type: 'button', class: 'link-btn', onclick: function () { FB.actions.openShopping(); } }, t('home.shopMore', { n: open - 4 })));
      if (wide) inner.insertBefore(secS, inner.firstChild); else inner.appendChild(secS);
      if (wide) rail.classList.add('wide-shop');
    }
    if (showShop) inner.appendChild(h('button', { type: 'button', class: 'shop-tile', onclick: function () { FB.actions.openShopping(); } },
      ui.icon('cart', 26),
      h('span', null, open ? t('home.shoppingCount', { n: open }) : t('home.shoppingEmpty'))));
    return rail;
  }

  /* ---------- the view ---------- */
  FB.views.home = function (ctx) {
    var today = ctx.today;
    var due = L.choresDue(today, ctx.nowHHMM);

    var left = h('aside', { class: 'rail rail-left', 'data-scroll': 'rail-left' },
      h('div', { class: 'rail-in', 'data-fit': '1', 'data-fit-min': '0.6' },
        h('div', { class: 'clock-row' },
          h('div', { class: 'clock' }, U.hhmm(ctx.now)),
          h('button', { type: 'button', class: 'icon-btn sleep-btn', 'aria-label': t('home.sleep'), onclick: function () { FB.night.sleepNow(); } }, ui.icon('moon'))),
        h('div', { class: 'dateline' }, FB.i18n.dateLong(today)),
        FB.showW('weather') ? weatherBlock() : null,
        FB.ac && FB.showW('ac') && !isWide() ? FB.ac.tile() : null));

    var board = h('main', { class: 'board' });
    if (!FB.state.chores.length) {
      board.appendChild(h('div', { class: 'board-hint' }, h('p', null, t('board.noChores')),
        h('button', { class: 'btn', onclick: function () { FB.actions.openTemplates(); } }, t('board.addChores'))));
    } else board.appendChild(list(due));
    var sum = FB.ai && FB.ai.enabled() && FB.showW('summary') ? FB.ai.summary() : '';
    var nw = FB.news && FB.showW('news') ? FB.news.strip() : null;
    var ts = FB.showW('events') ? todayStrip(today) : null;
    if (ts) { board.classList.add('has-news'); board.insertBefore(ts, board.firstChild); }
    if (nw) { board.classList.add('has-news'); board.insertBefore(nw, board.firstChild); }
    if (sum) { board.classList.add('has-sum'); board.insertBefore(h('div', { class: 'ai-sum', 'data-fit-skip': '1' }, h('span', { class: 'ai-sum-ico' }, ui.icon('sparkle', 18)), h('p', null, sum)), board.firstChild); }

    return h('div', { class: 'home' }, left, board, rightRail(today, left.firstChild));
  };
})(typeof window !== 'undefined' ? window : globalThis);
