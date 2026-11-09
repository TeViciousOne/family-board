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
      h('div', { class: 'col-count' }, items.length ? doneN + '/' + items.length : ''));
    var bar = h('div', { class: 'list-bar' }, h('i', { style: { width: pct + '%' } }));
    var body = h('div', { class: 'list-body', 'data-scroll': 'chores-list' });
    if (!items.length) body.appendChild(h('p', { class: 'col-empty' }, t('board.nothingToday')));
    else {
      if (doneN === items.length) body.appendChild(h('p', { class: 'col-allDone' }, t('board.allDone')));
      body.appendChild(h('div', { class: 'list-grid' }, sorted.map(function (x) { return choreRow(x); })));
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

  function rightRail(today) {
    var rail = h('aside', { class: 'rail rail-right', 'data-scroll': 'rail-right' });
    var ups = L.upcoming(today, 8);
    var shown = ups.slice(0, 7);
    rail.appendChild(h('h3', null, t('home.comingUp')));
    if (!shown.length) rail.appendChild(h('p', { class: 'muted' }, t('home.noEvents')));
    var lastDate = null, group = null;
    shown.forEach(function (x) {
      if (x.date !== lastDate) {
        lastDate = x.date;
        group = h('div', { class: 'ev-group' }, h('div', { class: 'ev-day' }, FB.i18n.relDay(x.date)));
        rail.appendChild(group);
      }
      group.appendChild(eventLine(x));
    });
    rail.appendChild(h('button', { type: 'button', class: 'link-btn', onclick: function () { FB.app.go('calendar'); } }, t('home.openCalendar')));

    var cds = L.countdowns(today).slice(0, 3);
    if (cds.length) {
      rail.appendChild(h('h3', null, t('home.countdowns')));
      cds.forEach(function (c) {
        rail.appendChild(h('button', { type: 'button', class: 'cd', onclick: function () { FB.actions.openEvent(c.event); } },
          h('b', null, String(c.days)), h('span', null, (c.days === 1 ? t('unit.day') : t('unit.days')) + ' · ' + c.event.title)));
      });
    }

    var notes = L.notesSorted().slice(0, 2);
    if (notes.length) {
      rail.appendChild(h('h3', null, t('home.notes')));
      notes.forEach(function (n) {
        var m = L.member(n.author);
        rail.appendChild(h('button', { type: 'button', class: 'note-mini', style: { borderColor: m ? m.color : 'var(--ink-3)' }, onclick: function () { FB.app.go('lists'); } },
          h('span', null, n.body), m ? h('small', null, m.name) : null));
      });
    }

    var open = FB.state.shopping.filter(function (s) { return !s.done; }).length;
    rail.appendChild(h('button', { type: 'button', class: 'shop-tile', onclick: function () { FB.app.go('lists'); } },
      ui.icon('cart', 26),
      h('span', null, open ? t('home.shoppingCount', { n: open }) : t('home.shoppingEmpty'))));
    return rail;
  }

  /* ---------- the view ---------- */
  FB.views.home = function (ctx) {
    var today = ctx.today;
    var due = L.choresDue(today, ctx.nowHHMM);

    var left = h('aside', { class: 'rail rail-left', 'data-scroll': 'rail-left' },
      h('div', { class: 'clock-row' },
        h('div', { class: 'clock' }, U.hhmm(ctx.now)),
        h('button', { type: 'button', class: 'icon-btn sleep-btn', 'aria-label': t('home.sleep'), onclick: function () { FB.night.sleepNow(); } }, ui.icon('moon'))),
      h('div', { class: 'dateline' }, FB.i18n.dateLong(today)),
      weatherBlock());

    var board = h('main', { class: 'board' });
    if (!FB.state.chores.length) {
      board.appendChild(h('div', { class: 'board-hint' }, h('p', null, t('board.noChores')),
        h('button', { class: 'btn', onclick: function () { FB.app.go('chores'); } }, t('board.addChores'))));
    } else board.appendChild(list(due));

    return h('div', { class: 'home' }, left, board, rightRail(today));
  };
})(typeof window !== 'undefined' ? window : globalThis);
