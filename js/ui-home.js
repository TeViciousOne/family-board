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
      h('span', { class: 'wx-hn' }, first ? t('wx.now') : FB.i18n.hour(x.time.slice(11, 13))),
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

  /* wide screens: the current weather sits in the "Today" header; tap = hourly and daily forecast */
  function headWeather() {
    var w = FB.app.weather || {};
    if (!FB.showW('weather') || !w.data) return null;
    var place = FB.device.place || FB.weather.DEFAULT_PLACE, cur = w.data.current, today = w.data.days[0] || {};
    var rainAt = FB.weather.hoursFrom(w.data, 14).filter(function (x, i) { return i > 0 && (x.rain >= 50 || /rain|storm|snow|drizzle/.test(FB.weather.kindOf(x.code, 1))); })[0];
    var second = rainAt ? '☔ ' + t('wx.rainAt', { time: FB.i18n.hm(rainAt.time.slice(11, 16)) }) : (today.max != null ? t('wx.hiLo', { hi: Math.round(today.max), lo: Math.round(today.min) }) : '');
    return h('button', { type: 'button', class: 'hh-wx', onclick: openWeather },
      h('span', { class: 'hh-wx-ico', html: FB.weather.icon(FB.weather.kindOf(cur.code, cur.isDay), 56) }),
      h('span', { class: 'hh-wx-t wx-temp' }, Math.round(cur.temp) + '°'),
      h('span', { class: 'hh-wx-txt' },
        h('span', null, t(FB.weather.labelKey(cur.code)) + ' · ' + place.name),
        second ? h('small', null, second) : null),
      w.stale ? h('small', { class: 'hh-wx-stale' }, t('wx.stale')) : null);
  }

  /* wide screens: the next hours sit right beside the current weather (one place for the weather) */
  function headHours() {
    var w = FB.app.weather || {};
    if (!FB.showW('weather') || !w.data) return null;
    var hrs = FB.weather.hoursFrom(w.data, 6).slice(1);
    if (!hrs.length) return null;
    return h('button', { type: 'button', class: 'hh-hours', 'aria-label': t('wx.hourly'), onclick: openWeather },
      hrs.map(function (x) { return hourCell(x, false); }));
  }

  function weatherBlock(compact) {
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
    var rainAt = FB.weather.hoursFrom(w.data, 14).filter(function (x, i) { return i > 0 && (x.rain >= 50 || /rain|storm|snow|drizzle/.test(FB.weather.kindOf(x.code, 1))); })[0];
    var next = h('div', { class: 'wx-next' }, rainAt ? '☔ ' + t('wx.rainAt', { time: FB.i18n.hm(rainAt.time.slice(11, 16)) }) : (today.max != null ? t('wx.hiLo', { hi: Math.round(today.max), lo: Math.round(today.min) }) : ''));
    var hourly = hrs.length ? h('div', { class: 'wx-hours' }, hrs.map(function (x, i) { return hourCell(x, i === 0); })) : null;
    if (compact) {
      return h('div', { class: 'wx wx-compact', role: 'button', tabindex: '0', 'aria-label': t('wx.hourly'), onclick: openWeather, onkeydown: function (e) { if (e.key === 'Enter') openWeather(); } }, hourly);
    }
    return h('div', { class: 'wx', role: 'button', tabindex: '0', onclick: openWeather, onkeydown: function (e) { if (e.key === 'Enter') openWeather(); } },
      nowEl,
      h('div', { class: 'wx-desc' }, t(FB.weather.labelKey(cur.code)) + ' · ' + place.name),
      h('div', { class: 'wx-meta' }, meta.map(function (m) { return h('div', null, m); })),
      next,
      hourly,
      strip,
      w.stale ? h('p', { class: 'wx-stale' }, t('wx.stale')) : null);
  }

  /* ---------- one chore row ---------- */
  function choreRow(entry, color) {
    var c = entry.chore, done = entry.done;
    var meta = [], lateTxt = '';
    if (done) {
      var by = L.member(done.done_by);
      meta.push(t('chore.doneBy', { name: by ? by.name : t('chore.someone'), time: FB.i18n.timeOf(done.done_at) }));
    } else {
      lateTxt = entry.carried ? t('chore.overdueSince', { when: FB.i18n.relDay(c.rule.start) }) : entry.overdue ? t('chore.overdue') : '';
      if (c.due_time && !entry.carried) meta.push(t('chore.by', { time: FB.i18n.hm(c.due_time) }));
      if (entry.last) {
        var lm = L.member(entry.last.done_by);
        meta.push(t('chore.last', { name: lm ? lm.name : t('chore.someone'), when: FB.i18n.relDay(entry.last.on_date) }));
      }
    }
    var who = L.member(c.member_id);
    color = who ? who.color : null;
    var pop = done && FB.justDone && Date.now() - (FB.justDone[c.id] || 0) < 2500;
    var row = h('button', {
      type: 'button', class: 'chore' + (done ? ' done' : '') + (entry.overdue ? ' overdue' : '') + (pop ? ' pop' : ''),
      'data-flip': c.id,
      style: { '--c': color || 'var(--brand)' },
      'aria-label': (done ? t('chore.markUndo') : t('chore.markDone')) + ': ' + c.title,
      onclick: function () { FB.actions.tapChore(entry, row); }
    },
      h('span', { class: 'tick' }, done ? ui.icon('check', 22) : null),
      h('span', { class: 'chore-txt' },
        h('span', { class: 'chore-title' }, (c.emoji ? c.emoji + ' ' : '') + c.title),
        /* overdue: a red label with an icon, on the same line as the due time */
        !done && lateTxt
          ? h('span', { class: 'chore-meta late-line' }, h('span', { class: 'late-tag' }, ui.icon('clock', 14), h('span', null, lateTxt)), meta.length ? h('span', null, ' · ' + meta.join(' · ')) : null)
          : meta.map(function (m) { return h('span', { class: 'chore-meta' }, m); })),
      who ? h('span', { class: 'chore-who-av' }, ui.avatar(who, 44), h('small', null, who.name)) : null);
    return row;
  }

  FB.actions = FB.actions || {};
  /* all of today's chores in a popup ("+N more"): tick them right there */
  FB.actions.openTodayChores = function () {
    var box = h('div', { class: 'list-grid pop-chores' }), modal, sig = '';
    function draw() {
      var items = L.choresDue(U.today(), U.hhmm(new Date()));
      var s = items.map(function (x) { return x.chore.id + (x.done ? '1' : '0'); }).join();
      if (s === sig) return;
      sig = s;
      U.clear(box);
      items.slice().sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); }).forEach(function (x) { box.appendChild(choreRow(x)); });
      ui.emojify(box);
    }
    draw();
    var poll = setInterval(draw, 400);
    modal = ui.modal({ title: t('nav.chores'), body: box, size: 'wide', focus: false, onClose: function () { clearInterval(poll); } });
  };

  /* read-only details of an event (tiles on phones): full info, editing is one extra tap */
  FB.actions.showEvent = function (e, date) {
    var m = L.member(e.member_id), today = U.today(), modal;
    var d = date || e.on_date;
    var rows = [];
    function row(ico, txt) { rows.push(h('div', { class: 'evi-row' }, h('span', { class: 'evi-ico' }, ico), h('span', null, txt))); }
    var title = e.title;
    if (e.kind === 'birthday') {
      var age = Number(d.slice(0, 4)) - Number(e.on_date.slice(0, 4));
      title = '🎂 ' + (age > 0 ? t('event.turns', { name: e.title, n: age }) : e.title);
    }
    row('📅', FB.i18n.relDay(d) + (d !== today ? ' · ' + FB.i18n.dateLong(d) : ''));
    row('🕒', e.all_day || !e.start_time ? t('event.allDay') : FB.i18n.hm(e.start_time) + (e.end_time ? ' – ' + FB.i18n.hm(e.end_time) : ''));
    if (e.kind === 'countdown') { var n = U.daysBetween(today, d); row('⏳', n + ' ' + (n === 1 ? t('unit.day') : t('unit.days'))); }
    if (e.rule && e.rule.freq && e.rule.freq !== 'once') row('🔁', FB.recur.describe(e.rule, FB.i18n.L));
    if (m) rows.push(h('div', { class: 'evi-row' }, ui.avatar(m, 28), h('span', null, m.name)));
    if (e.notes) row('📝', e.notes);
    var body = h('div', { class: 'evi' }, h('h3', { class: 'evi-title' }, title), rows);
    modal = ui.modal({ title: '', body: body, focus: false, actions: [
      h('button', { class: 'btn ghost', onclick: function () { modal.close(); FB.actions.openEvent(e); } }, ui.icon('edit', 18), ' ', t('common.edit')),
      h('button', { class: 'btn', onclick: function () { modal.close(); } }, t('common.close'))] });
  };

  /* progress ring: fills as chores get done */
  function ring(done, total) {
    var r = 22, c = 2 * Math.PI * r, f = total ? done / total : 0;
    var svg = '<svg viewBox="0 0 52 52" width="52" height="52"><circle cx="26" cy="26" r="' + r + '" class="ring-bg"/>' +
      '<circle cx="26" cy="26" r="' + r + '" class="ring-fg" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - f)).toFixed(1) + '"/></svg>';
    return h('div', { class: 'col-count ring' + (done === total ? ' full' : ''), 'aria-label': done + '/' + total },
      h('span', { class: 'ring-svg', html: svg }), h('span', { class: 'ring-txt' }, done + '/' + total));
  }

  /* everything done: say so, and show what is coming tomorrow */
  function allDone(count) {
    var tm = U.addDays(U.today(), 1);
    var next = L.choresDue(tm, '00:00').filter(function (x) { return !x.done; }).slice(0, 5);
    /* deliberately plain markup (grid + paragraphs, no animation): iPad Safari left the old flex version blank */
    return h('div', { class: 'done-card' },
      h('div', { class: 'dc-ico' }, ui.icon('check', 30)),
      h('p', { class: 'dc-title' }, t('board.allDone')),
      next.length && (isPhone() || count > 6 || !tomorrowCard(U.today(), count)) ? h('p', { class: 'dc-next' }, t('home.tomorrow') + ': ' + next.map(function (x) { return (x.chore.emoji ? x.chore.emoji + ' ' : '') + x.chore.title; }).join(' · ')) : null);
  }

  /* a quiet day leaves room under the chores: show tomorrow there, so the wall is never half empty */
  function tomorrowCard(today, count) {
    var ph = isPhone(); /* phones: only on a short day (up to 3 chores), and fewer lines */
    if (count > (ph ? 3 : 6)) return null;
    var tm = U.addDays(today, 1);
    var chores = L.choresDue(tm, '00:00').filter(function (x) { return !x.done; }).slice(0, ph ? 3 : 6);
    var evs = L.upcoming(today, 2).filter(function (x) { return x.date === tm; }).slice(0, ph ? 2 : 3);
    if (!chores.length && !evs.length) return null;
    return h('section', { class: 'tmr-card', 'data-fit-skip': '1', 'aria-label': t('home.tomorrow') },
      h('h3', { class: 'tmr-head' }, t('home.tomorrow')),
      h('div', { class: 'tmr-grid' },
        evs.map(function (x) {
          var e = x.event, when = e.all_day || !e.start_time ? t('event.allDay') : FB.i18n.hm(e.start_time);
          return h('button', { type: 'button', class: 'tmr-item tmr-ev', onclick: function () { FB.actions.openEvent(e); } },
            h('span', { class: 'tmr-ico' }, ui.icon('calendar', 20)),
            h('span', { class: 'tmr-txt' }, h('b', null, e.title), h('small', null, when)));
        }),
        chores.map(function (x) {
          var c = x.chore, who = L.member(c.member_id);
          return h('div', { class: 'tmr-item' },
            who ? ui.avatar(who, 32) : h('span', { class: 'tmr-ico' }, ui.icon('check', 20)),
            h('span', { class: 'tmr-txt' }, h('b', null, (c.emoji ? c.emoji + ' ' : '') + c.title), who ? h('small', null, who.name) : null));
        })));
  }

  /* today's events as a strip above the chores */
  function todayStrip(today) {
    var evs = []; /* today's events live in "Coming up" / the event tile: one place only */
    var sp = L.special(today);
    if (!sp.length) return null;
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
          e.all_day || !e.start_time ? null : h('b', null, FB.i18n.hm(e.start_time)), h('span', null, title));
      }));
  }

  /* wide header: "Tuesday" over "17 November" (the "Today" card) */
  function dateTwoLines(date) {
    var p = U.parts(date), wd = U.weekday(date), n = FB.i18n.dayLong(wd);
    return [n.charAt(0).toUpperCase() + n.slice(1), p.d + ' ' + FB.i18n.monthLong(p.m - 1).toLowerCase()];
  }
  /* who filter on the chores row (wide screens): everyone, or one person. Lives in memory only. */
  var whoSel = null;
  function whoPills(items) {
    var ms = L.membersSorted();
    if (ms.length < 2) return null;
    if (whoSel && !L.member(whoSel)) whoSel = null;
    function pill(id, label, color) {
      var on = (whoSel || null) === id;
      return h('button', { type: 'button', class: 'who-chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () { whoSel = id; FB.app.render(); } },
        color ? h('span', { class: 'who-dot', style: { background: color } }) : null, h('span', { class: 'who-name' }, label));
    }
    return h('div', { class: 'who-row', role: 'group', 'aria-label': t('home.who') },
      pill(null, t(isPhone() ? 'home.all' : 'home.everyone')), ms.map(function (m) { return pill(m.id, m.name, m.color); }));
  }

  function addBtn() {
    return h('button', { type: 'button', class: 'btn add-pill', onclick: function () { FB.actions.openTemplates(); } }, ui.icon('plus', 18), h('span', null, isPhone() ? t('common.add') : t('board.addChores')));
  }
  /* phone header: two cards of the same size and the same build, a big line over two small ones (clock | weather) */
  function phoneCards(today, clk) {
    var dl = dateTwoLines(today);
    var clockCard = h('div', { class: 'ph-card ph-clock' },
      h('div', { class: 'ph-big clock' }, clk.t, clk.ap ? h('small', { class: 'ampm' }, clk.ap) : null),
      h('span', { class: 'ph-l1' }, dl[0]), h('span', { class: 'ph-l2' }, dl[1]));
    var w = FB.app.weather || {}, wxCard;
    if (!FB.showW('weather')) return h('div', { class: 'ph-cards solo' }, clockCard);
    if (!w.data) {
      wxCard = h('div', { class: 'ph-card ph-wx' }, h('span', { class: 'ph-l1' }, w.loading ? t('wx.loading') : t('wx.unavailable')));
    } else {
      var cur = w.data.current, day = w.data.days[0] || {}, place = FB.device.place || FB.weather.DEFAULT_PLACE;
      var rainAt = FB.weather.hoursFrom(w.data, 14).filter(function (x, i) { return i > 0 && (x.rain >= 50 || /rain|storm|snow|drizzle/.test(FB.weather.kindOf(x.code, 1))); })[0];
      var l2 = rainAt ? t('wx.rainAt', { time: FB.i18n.hm(rainAt.time.slice(11, 16)) }) : (place.name || '');
      wxCard = h('button', { type: 'button', class: 'ph-card ph-wx', 'aria-label': t('wx.hourly'), onclick: openWeather },
        h('div', { class: 'ph-big' }, h('span', { class: 'ph-ico', html: FB.weather.icon(FB.weather.kindOf(cur.code, cur.isDay), 32) }), h('b', null, Math.round(cur.temp) + '°')),
        h('span', { class: 'ph-l1' }, t(FB.weather.labelKey(cur.code)) + (day.max != null ? ' · ' + t('wx.hl', { hi: Math.round(day.max), lo: Math.round(day.min) }) : '')),
        h('span', { class: 'ph-l2' }, l2));
    }
    return h('div', { class: 'ph-cards' }, clockCard, wxCard);
  }

  /* wide screens: page header with the day, the date and week, today's progress and the add button */
  function homeHead(today) {
    return h('header', { class: 'home-head', 'data-fit-skip': '1' },
      h('div', { class: 'hh-txt' },
        h('h1', null, t('rel.today')),
        h('p', { class: 'hh-date' }, dateTwoLines(today).map(function (x) { return h('span', null, x); }))),
      headWeather(),
      headHours(),
      h('span', { class: 'hh-gap' }),
      /* kiosk mode hides the side rail on this screen: these two keep sleep and settings in reach (shown by look.css) */
      h('button', { type: 'button', class: 'icon-btn kiosk-btn', 'aria-label': t('home.sleep'), onclick: function () { FB.night.sleepNow(); } }, ui.icon('moon')),
      h('button', { type: 'button', class: 'icon-btn kiosk-btn', 'aria-label': t('nav.settings'), onclick: function () { FB.app.go('settings'); } }, ui.icon('gear')));
  }
  /* a row of small counts above the chores: left to do, overdue, to buy, the next event (Settings > Look) */
  function statChips(today, due) {
    var open = due.filter(function (x) { return !x.done; });
    var late = open.filter(function (x) { return x.overdue || x.carried; }).length;
    var now = U.hhmm(new Date());
    var nx = null;
    var row = h('div', { class: 'chips-row', 'data-fit-skip': '1' });
    function chip(big, small, cls, fn) {
      row.appendChild(h('button', { type: 'button', class: 'stat-chip' + (cls ? ' ' + cls : ''), onclick: fn }, h('b', null, big), h('span', null, small)));
    }
    /* only what is not already on this screen: the ring shows progress and overdue chores sort first,
       so a chip appears only for a block that is switched off here (shopping, events) */
    var toBuy = FB.state.shopping.filter(function (x) { return !x.done; }).length;
    if (!FB.showW('shopping') && toBuy) chip(String(toBuy), t('chip.buy'), '', function () { FB.actions.openShopping(); });
    if (FB.showW('events')) nx = null;
    else nx = L.upcoming(today, 14).filter(function (x) { var e = x.event; return x.date > today || e.all_day || !e.start_time || e.start_time >= now; })[0];
    if (nx) {
      var e = nx.event;
      chip(nx.date === today ? (e.start_time && !e.all_day ? FB.i18n.hm(e.start_time) : t('rel.today')) : FB.i18n.relDay(nx.date), e.title, '', function () { FB.actions.showEvent(e, nx.date); });
    }
    return row.children.length ? row : null;
  }

  /* one shared list: to-do first, finished at the bottom; the person shows as a small coloured tag */
  function list(items) {
    var all = items, wideNow = isWide() || isPhone();
    if (wideNow && whoSel) items = items.filter(function (x) { return x.chore.member_id === whoSel; });
    var sorted = items.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
      var da = a.x.done ? 1 : 0, db = b.x.done ? 1 : 0;
      var la = !a.x.done && (a.x.overdue || a.x.carried) ? 0 : 1, lb = !b.x.done && (b.x.overdue || b.x.carried) ? 0 : 1;
      return da - db || la - lb || a.i - b.i; /* overdue first, so it is never hidden under "+N" */
    }).map(function (o) { return o.x; });
    var doneN = all.filter(function (x) { return x.done; }).length;
    /* progress is shown once, by the ring */
    var wide = isWide();
    var head = wide
      ? h('div', { class: 'list-head lh-wide' },
          h('div', { class: 'list-title' }, t('nav.chores')),
          whoPills(all) || h('span', { class: 'lh-gap' }),
          all.length ? ring(doneN, all.length) : null,
          h('div', { class: 'list-actions' }, addBtn()))
      : h('div', { class: 'list-head' },
          h('div', { class: 'list-title' }, t('nav.chores')),
          items.length ? ring(doneN, items.length) : null,
          h('div', { class: 'list-actions' }, addBtn()));
    var body = h('div', { class: 'list-body', 'data-scroll': 'chores-list' });
    if (!all.length) body.appendChild(ui.empty('🌤️', t('board.nothingToday'), t('empty.choresHint')));
    else if (!items.length) body.appendChild(ui.empty('🌤️', t('home.nothingFor', { name: (L.member(whoSel) || {}).name || '' }), ''));
    else {
      if (!whoSel && doneN === all.length) body.appendChild(allDone(all.length));
      var size = sorted.length <= 6 ? ' few' : sorted.length <= 8 ? ' mid' : '';
      body.appendChild(h('div', { class: 'list-grid' + size, 'data-fit': '1', 'data-fit-min': '0.86', 'data-fit-max': '1', 'data-cap': '1' }, sorted.map(function (x) { return choreRow(x); })));
      var tmr = tomorrowCard(U.today(), all.length);
      if (tmr) body.appendChild(tmr);
    }
    return h('section', { class: 'col' }, head, isPhone() ? whoPills(all) : null, body);
  }

  /* a small filled icon before a section title (Settings-style), one system colour per section */
  function secIco(name, tone) { return h('span', { class: 'sec-ico tone-' + tone, 'aria-hidden': 'true' }, ui.icon(name, 14)); }
  /* each countdown keeps its own colour: picked from its id, so it never changes between renders */
  var CD_TONES = ['orange', 'pink', 'purple', 'indigo', 'teal', 'green', 'red'];
  function cdTone(ev) { var s = String(ev.id || ev.title || ''), n = 0; for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0; return CD_TONES[n % CD_TONES.length]; }

  /* countdown tiles tick every second (days big, hours:minutes:seconds under the title); one timer for all of them */
  var cdLive = [], cdTimer = null;
  function cdTick() {
    var now = Date.now(), alive = false;
    cdLive.forEach(function (x) {
      if (!x.el.isConnected) return;
      alive = true;
      var ms = Math.max(0, x.at - now), sec = Math.floor(ms / 1000), d = Math.floor(sec / 86400), r = sec % 86400;
      var hh = Math.floor(r / 3600), mm = Math.floor(r % 3600 / 60), ss = r % 60, two = function (n) { return (n < 10 ? '0' : '') + n; };
      var txt = two(hh) + ':' + two(mm) + ':' + two(ss);
      if (x.b.textContent !== String(d)) { x.b.textContent = String(d); x.s.textContent = d === 1 ? t('unit.day') : t('unit.days'); }
      if (x.t.textContent !== txt) { x.t.textContent = txt; x.el.setAttribute('aria-label', x.t.previousSibling.textContent + ': ' + d + ' ' + (d === 1 ? t('unit.day') : t('unit.days')) + ' ' + txt); }
    });
    if (!alive) { clearInterval(cdTimer); cdTimer = null; cdLive = []; }
  }
  function cdStart() { cdTick(); if (!cdTimer) cdTimer = setInterval(cdTick, 1000); }

  /* tap a countdown: a big live clock (days, hours, minutes, seconds); editing is one tap away */
  function cdParts(ms) {
    var sec = Math.floor(Math.max(0, ms) / 1000);
    return [Math.floor(sec / 86400), Math.floor(sec % 86400 / 3600), Math.floor(sec % 3600 / 60), sec % 60];
  }
  function openCountdown(ev, at) {
    var names = [t('unit.days'), t('cd.hours'), t('cd.minutes'), t('cd.seconds')], nums = [], cells = names.map(function (n) {
      var b = h('b', null, '0'); nums.push(b);
      return h('div', { class: 'cdk-cell' }, b, h('span', null, n));
    });
    var done = h('p', { class: 'cdk-done', hidden: true }, t('cd.now'));
    var body = h('div', { class: 'cdk tone-' + cdTone(ev) },
      h('p', { class: 'cdk-when' }, FB.i18n.dateLong(ev.on_date) + (ev.start_time && !ev.all_day ? ' · ' + FB.i18n.hm(ev.start_time) : '')),
      h('div', { class: 'cdk-grid', role: 'timer', 'aria-label': ev.title }, cells), done);
    var m = ui.modal({ title: ev.title, body: body, focus: false,
      actions: [h('button', { type: 'button', class: 'btn ghost', onclick: function () { m.close(); FB.actions.openEvent(ev); } }, t('common.edit'))] });
    var last = [];
    function paint() {
      if (!body.isConnected) { clearInterval(timer); return; }
      var ms = at - Date.now(), v = cdParts(ms);
      v.forEach(function (x, i) {
        if (last[i] === x) return;
        last[i] = x; nums[i].textContent = i === 0 ? String(x) : (x < 10 ? '0' : '') + x;
      });
      done.hidden = ms > 0;
    }
    var timer = setInterval(paint, 1000); paint();
  }

  /* ---------- right rail ---------- */
  function eventLine(x) {
    var e = x.event, m = L.member(e.member_id);
    var when = e.all_day || !e.start_time ? t('event.allDay') : FB.i18n.hm(e.start_time);
    var title = e.title;
    if (e.kind === 'birthday') title = '🎂 ' + (x.age && x.age > 0 ? t('event.turns', { name: e.title, n: x.age }) : e.title);
    return h('button', { type: 'button', class: 'ev', onclick: function () { FB.actions.openEvent(e); } },
      h('span', { class: 'ev-dot', style: { background: m ? m.color : 'var(--ink-3)' } }),
      h('span', { class: 'ev-when' }, when),
      h('span', { class: 'ev-title' }, title));
  }

  /* wide landscape (iPad / wall tablet): events and countdown live in the left column, shopping at the top right */
  function isPhone() { return !!(root.matchMedia && root.matchMedia('(max-width: 699px) and (orientation: portrait)').matches); }
  /* wide = landscape and at least 900 px after the interface size is applied (see FB.app.applySize) */
  function isWide() { return FB.app.layout ? !!FB.app.layout.wide : !!(root.matchMedia && root.matchMedia('(orientation: landscape) and (min-width: 900px)').matches); }

  /* phones: one row of small tiles under the chores instead of the right column (tap = full view) */
  function phoneTiles(today) {
    var tiles = [];
    function tile(cls, ico, big, small, fn) {
      tiles.push(h('button', { type: 'button', class: 'ptile ' + cls, onclick: fn }, h('span', { class: 'pt-ico' }, ico), h('b', { class: String(big).length > 6 ? 'long' : null }, big), h('small', null, small)));
    }
    if (FB.showW('shopping')) {
      var n = FB.state.shopping.filter(function (x) { return !x.done; }).length;
      tile('pt-shop', ui.icon('cart', 20), String(n), n ? t('pt.toBuy') : t('pt.listEmpty'), function () { FB.actions.openShopping(); });
    }
    if (FB.showW('events')) {
      var now = U.hhmm(new Date());
      var nx = L.upcoming(today, 14).filter(function (x) { var e = x.event; return x.date > today || e.all_day || !e.start_time || e.start_time >= now; })[0];
      if (nx) {
        var e = nx.event, when = nx.date === today ? (e.start_time && !e.all_day ? FB.i18n.hm(e.start_time) : t('rel.today')) : nx.date === U.addDays(today, 1) ? t('rel.tomorrow') : FB.i18n.dayShort(U.weekday(nx.date)) + ' ' + U.parts(nx.date).d;
        tile('pt-ev', e.kind === 'birthday' ? '🎂' : ui.icon('calendar', 20), when, e.title, function () { FB.actions.showEvent(e, nx.date); });
      } else tile('pt-ev', ui.icon('calendar', 20), '—', t('pt.noEvents'), function () { FB.app.go('calendar'); });
    }
    if (FB.ac && FB.showW('ac') && FB.ac.mini) { var ac = FB.ac.mini(); if (ac) tiles.push(ac); }
    if (FB.spotify && FB.showW('spotify') && FB.spotify.mini) { var spm = FB.spotify.mini(); if (spm) tiles.push(spm); }
    if (FB.showW('countdown')) {
      var cd = L.countdowns(today)[0];
      if (cd) tile('pt-cd', ui.icon('hourglass', 20), cd.days + ' ' + (cd.days === 1 ? t('unit.day') : t('unit.days')), cd.event.title, function () { FB.actions.showEvent(cd.event, cd.date); });
    }
    if (!tiles.length) return null;
    /* equal columns for whatever is visible (the Spotify tile appears and disappears by itself) */
    return h('nav', { class: 'ptiles', style: { gridTemplateColumns: 'none', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)' } }, tiles);
  }

  function rightRail(today, leftIn) {
    var wide = isWide() && leftIn, phone = isPhone();
    if (phone) return phoneTiles(today) || h('span');
    var rail = h('aside', { class: 'rail rail-right', 'data-scroll': 'rail-right' });
    var inner = h('div', { class: 'rail-in', 'data-fit': '1', 'data-fit-min': '0.9', 'data-cap': 'soft' });
    rail.appendChild(inner);

    var ups = L.upcoming(today, 8);
    var shown = ups.slice(0, 7);
    /* the first day sits on the heading line, to its right */
    var head = h('h3', { class: 'ups-head' }, h('span', { class: 'sec-t' }, secIco('calendar', 'red'), t('home.comingUp')));
    var secUps = h('section', { class: 'rr rr-ups' }, head);
    if (!shown.length) secUps.appendChild(h('p', { class: 'muted empty-mini' }, '📭 ' + t('home.noEvents')));
    var lastDate = null, group = null;
    shown.forEach(function (x, i) {
      if (x.date !== lastDate) {
        lastDate = x.date;
        if (i === 0) { head.appendChild(h('span', { class: 'ev-day ev-day-head' }, FB.i18n.relDay(x.date))); group = h('div', { class: 'ev-group' }); }
        else group = h('div', { class: 'ev-group' }, h('div', { class: 'ev-day' }, FB.i18n.relDay(x.date)));
        secUps.appendChild(group);
      }
      group.appendChild(eventLine(x));
    });
    secUps.appendChild(h('button', { type: 'button', class: 'link-btn', onclick: function () { FB.app.go('calendar'); } }, t('home.openCalendar')));
    if (FB.showW('events')) (wide ? leftIn : inner).appendChild(secUps);

    var cds = FB.showW('countdown') ? L.countdowns(today).slice(0, 3) : [];
    cdLive = [];
    if (cds.length) {
      var secCd = h('section', { class: 'rr rr-cd' }, h('h3', { class: 'sec-t' }, secIco('clock', 'orange'), t('home.countdowns')));
      cds.forEach(function (c) {
        var tm = (c.event.start_time && !c.event.all_day ? c.event.start_time : '00:00').split(':');
        var dp = c.event.on_date.split('-');
        var at = new Date(+dp[0], +dp[1] - 1, +dp[2], +tm[0] || 0, +tm[1] || 0, 0).getTime();
        var cdB = h('b', null, String(c.days)), cdS = h('small', null, c.days === 1 ? t('unit.day') : t('unit.days')), cdT = h('small', { class: 'cd-hms' }, '');
        var cdBtn = h('button', { type: 'button', class: 'cd cd-card tone-' + cdTone(c.event), onclick: function () { openCountdown(c.event, at); } },
          h('span', { class: 'cd-num' }, cdB, cdS),
          h('span', { class: 'cd-title' }, c.event.title, cdT));
        cdLive.push({ el: cdBtn, at: at, b: cdB, s: cdS, t: cdT });
        secCd.appendChild(cdBtn);
      });
      inner.appendChild(secCd);
      setTimeout(cdStart, 0);   /* after the tiles are in the page */
    }

    if ((wide || phone) && FB.ac && FB.showW('ac')) { var act = FB.ac.tile(); if (act) inner.appendChild(act); }
    if (FB.spotify && FB.showW('spotify')) { var spt = FB.spotify.tile(); if (spt) inner.appendChild(spt); }
    var notes = FB.showW('notes') ? L.notesSorted().slice(0, wide ? 1 : 2) : [];
    if (notes.length) {
      var secN = h('section', { class: 'rr rr-notes' }, h('h3', { class: 'sec-t' }, secIco('edit', 'yellow'), t('home.notes')));
      notes.forEach(function (n) {
        var m = L.member(n.author);
        secN.appendChild(h('button', { type: 'button', class: 'note-mini', onclick: function () { FB.app.go('lists'); } },
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
      var secS = h('section', { class: 'rr rr-shop' }, h('h3', { class: 'sec-t' }, secIco('cart', 'green'), t('shop.title')));
      openItems.slice(0, 4).forEach(function (it) {
        var m = L.member(it.added_by);
        secS.appendChild(h('button', { type: 'button', class: 'note-mini shop-mini', onclick: function () { FB.actions.openShopping(); } },
          h('span', null, it.title), m ? h('small', null, m.name) : null));
      });
      if (open > 4) secS.appendChild(h('button', { type: 'button', class: 'link-btn', onclick: function () { FB.actions.openShopping(); } }, t('home.shopMore', { n: open - 4 })));
      if (wide && notesEl) inner.insertBefore(secS, notesEl); /* wide: air conditioner, Spotify, shopping, notes */
      else if (phone) inner.insertBefore(secS, inner.firstChild); else inner.appendChild(secS);
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
    var clk = FB.i18n.clock(ctx.now), phone = isPhone();

    var left = h('aside', { class: 'rail rail-left', 'data-scroll': 'rail-left' },
      h('div', { class: 'rail-in', 'data-fit': '1', 'data-fit-min': '0.9', 'data-cap': 'soft' },
        phone ? phoneCards(today, clk) : null,
        phone ? null : h('div', { class: 'clock-row' },
          h('div', { class: 'clock' }, clk.t, clk.ap ? h('small', { class: 'ampm' }, clk.ap) : null),
          h('button', { type: 'button', class: 'icon-btn sleep-btn', 'aria-label': t('home.sleep'), onclick: function () { FB.night.sleepNow(); } }, ui.icon('moon'))),
        isWide() || phone ? null : h('div', { class: 'dateline' }, FB.i18n.dateLong(today)), /* wide: the date is in the "Today" header */
        FB.showW('weather') && !isWide() && !phone ? weatherBlock(false) : null, /* wide: the weather lives in the "Today" header */
        FB.ac && FB.showW('ac') && !isWide() && !isPhone() ? FB.ac.tile() : null));

    var board = h('main', { class: 'board' });
    if (!FB.state.chores.length) {
      board.appendChild(h('div', { class: 'board-hint' }, h('p', null, t('board.noChores')),
        h('button', { class: 'btn', onclick: function () { FB.actions.openTemplates(); } }, t('board.addChores'))));
    } else {
      board.appendChild(list(due));
      var chipsEl = FB.device.chips !== false && due.length && !isPhone() ? statChips(today, due) : null;
      if (chipsEl) { board.classList.add('has-news'); board.insertBefore(chipsEl, board.firstChild); }
    }
    var sum = FB.ai && FB.ai.enabled() && FB.showW('summary') ? FB.ai.summary() : '', aiEl = null;
    var nw = FB.news && FB.showW('news') ? FB.news.strip() : null;
    var ts = FB.showW('events') && !isPhone() ? todayStrip(today) : null;
    var tsSide = null;
    if (ts && isWide()) { ts.classList.add('today-side'); tsSide = ts; ts = null; }
    if (ts) { board.classList.add('has-news'); board.insertBefore(ts, board.firstChild); }
    if (nw) { board.classList.add('has-news'); board.insertBefore(nw, board.firstChild); }
    if (sum) {
      board.classList.add('has-sum');
      aiEl = h('button', { type: 'button', class: 'ai-sum' + (sum.length < 90 ? ' short' : ''), 'data-fit-skip': '1', onclick: function () {
        ui.modal({ title: t('ai.summaryTitle'), body: h('p', { class: 'lead' }, sum), focus: false });
      } }, h('span', { class: 'ai-sum-ico' }, ui.icon('sparkle', 18)), h('p', null, sum));
      board.insertBefore(aiEl, board.firstChild);
    }
    /* wide: the chores come right under the header; the summary and the news close the page */
    if (isWide()) { if (aiEl) board.appendChild(aiEl); if (nw) board.appendChild(nw); }

    if (isWide()) { board.classList.add('has-news'); board.insertBefore(homeHead(today), board.firstChild); }

    var rr = rightRail(today, left.firstChild);
    if (tsSide) left.firstChild.appendChild(tsSide); /* below "coming up" on wide screens */
    var cdSec = isWide() ? rr.querySelector('.rr-cd') : null;
    if (cdSec) left.firstChild.appendChild(cdSec); /* wide: the countdown closes the clock panel */
    return h('div', { class: 'home' + (isWide() ? ' wide' : '') + (isPhone() ? ' phone' : '') }, left, board, rr);
  };
})(typeof window !== 'undefined' ? window : globalThis);
