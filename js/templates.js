/* Ready-made chores: pick the usual ones and add them all at once. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var T = (FB.templates = {});

  function rule(over) { return Object.assign(FB.recur.defaultRule(FB.util.today()), over); }
  var daily = function (n) { return rule({ freq: 'daily', interval: n || 1 }); };
  var weekly = function (days) { return rule({ freq: 'weekly', interval: 1, weekdays: days }); };
  var monthly = function (dom) { return rule({ freq: 'monthly', interval: 1, monthMode: 'dom', dom: dom }); };

  var weekdays = function () { return weekly([1, 2, 3, 4, 5]); };
  var every2w = function (d) { return rule({ freq: 'weekly', interval: 2, weekdays: [d] }); };

  /* The permanent list of common household chores: always there, in both languages, with a usual repeat and time.
     s: 1 marks the small starter set a family can copy into its own templates. time is an optional "by" time. */
  T.catalog = function () {
    return [
      { key: 'tpl.g.kitchen', items: [
        { s: 1, emoji: '🍽️', en: 'Wash the dishes', sq: 'Laj enët', rule: daily(), time: '21:00' },
        { emoji: '🍽️', en: 'Load the dishwasher', sq: 'Mbush pjatalarësen', rule: daily(), time: '21:00' },
        { emoji: '🍽️', en: 'Empty the dishwasher', sq: 'Shkarko pjatalarësen', rule: daily(), time: '09:00' },
        { emoji: '🍳', en: 'Make breakfast', sq: 'Bëj mëngjesin', rule: daily(), time: '08:00' },
        { s: 1, emoji: '🍳', en: 'Cook dinner', sq: 'Gatuaj darkën', rule: daily(), time: '19:00' },
        { emoji: '🍽️', en: 'Set the table', sq: 'Shtro tryezën', rule: daily(), time: '19:00' },
        { emoji: '🍽️', en: 'Clear the table', sq: 'Ngri tryezën', rule: daily() },
        { s: 1, emoji: '🧽', en: 'Wipe the kitchen', sq: 'Pastro kuzhinën', rule: weekly([6]) },
        { emoji: '🧽', en: 'Clean the stove', sq: 'Pastro sobën', rule: weekly([6]) },
        { emoji: '🧊', en: 'Clean the fridge', sq: 'Pastro frigoriferin', rule: monthly(1) },
        { emoji: '🧽', en: 'Clean the oven', sq: 'Pastro furrën', rule: monthly(15) },
        { s: 1, emoji: '🗑️', en: 'Take out the trash', sq: 'Hidh plehrat', rule: daily(), time: '20:00' },
        { emoji: '♻️', en: 'Take out the recycling', sq: 'Hidh riciklimin', rule: weekly([3]) }
      ] },
      { key: 'tpl.g.home', items: [
        { s: 1, emoji: '🧹', en: 'Vacuum the floors', sq: 'Fshij me fshesë elektrike', rule: weekly([1, 4]) },
        { emoji: '🧹', en: 'Sweep the floors', sq: 'Fshij dyshemenë', rule: daily() },
        { emoji: '🧽', en: 'Mop the floors', sq: 'Lan dyshemenë', rule: weekly([6]) },
        { emoji: '🧽', en: 'Dust the furniture', sq: 'Fshi pluhurat', rule: weekly([5]) },
        { emoji: '🛋️', en: 'Tidy the living room', sq: 'Rregullo dhomën e ndenjes', rule: daily(), time: '21:00' },
        { s: 1, emoji: '🪟', en: 'Clean the windows', sq: 'Pastro dritaret', rule: monthly(1) },
        { emoji: '🪞', en: 'Clean the mirrors', sq: 'Pastro pasqyrat', rule: weekly([6]) },
        { emoji: '🧹', en: 'Shake out the rugs', sq: 'Shkund qilimat', rule: monthly(10) },
        { emoji: '🧹', en: 'Sweep the balcony', sq: 'Fshi ballkonin', rule: weekly([6]) }
      ] },
      { key: 'tpl.g.bath', items: [
        { s: 1, emoji: '🚿', en: 'Clean the bathroom', sq: 'Pastro banjën', rule: weekly([6]) },
        { emoji: '🚽', en: 'Clean the toilet', sq: 'Pastro tualetin', rule: weekly([3, 6]) },
        { emoji: '🧺', en: 'Change the towels', sq: 'Ndërro peshqirët', rule: weekly([0]) },
        { emoji: '🧻', en: 'Refill toilet paper and soap', sq: 'Vendos letër higjienike dhe sapun', rule: weekly([1]) },
        { emoji: '🔥', en: 'Turn on the water heater', sq: 'Ndiz bojlerin', rule: daily(), time: '18:00' }
      ] },
      { key: 'tpl.g.laundry', items: [
        { s: 1, emoji: '🧺', en: 'Do the laundry', sq: 'Lani rrobat', rule: weekly([2, 5]) },
        { emoji: '🧺', en: 'Hang the laundry', sq: 'Var rrobat', rule: weekly([2, 5]) },
        { s: 1, emoji: '👕', en: 'Fold and put away laundry', sq: 'Paloso dhe vendos rrobat', rule: weekly([3, 6]) },
        { emoji: '👕', en: 'Iron the clothes', sq: 'Hekuros rrobat', rule: weekly([0]) },
        { emoji: '🛏️', en: 'Make the bed', sq: 'Rregullo shtratin', rule: daily(), time: '09:00' },
        { s: 1, emoji: '🛏️', en: 'Change the bed sheets', sq: 'Ndërro çarçafët', rule: every2w(0) },
        { emoji: '🧸', en: 'Tidy your room', sq: 'Rregullo dhomën', rule: daily(), time: '20:00' }
      ] },
      { key: 'tpl.g.kids', items: [
        { emoji: '📚', en: 'Do homework', sq: 'Bëj detyrat e shtëpisë', rule: weekdays(), time: '18:00' },
        { emoji: '📚', en: 'Pack the school bag', sq: 'Përgatit çantën e shkollës', rule: rule({ freq: 'weekly', interval: 1, weekdays: [0, 1, 2, 3, 4] }), time: '20:00' },
        { emoji: '🧸', en: 'Put away the toys', sq: 'Mblidh lodrat', rule: daily(), time: '20:00' },
        { emoji: '📚', en: 'Read for 20 minutes', sq: 'Lexo 20 minuta', rule: daily(), time: '21:00' }
      ] },
      { key: 'tpl.g.pets', items: [
        { s: 1, emoji: '🪴', en: 'Water the plants', sq: 'Ujit lulet', rule: weekly([0, 3]) },
        { s: 1, emoji: '🐈', en: 'Feed the cat', sq: 'Ushqe macen', rule: daily() },
        { emoji: '🐈', en: 'Clean the litter box', sq: 'Pastro rërën e maces', rule: weekly([1, 4]) },
        { emoji: '🐕', en: 'Feed the dog', sq: 'Ushqe qenin', rule: daily() },
        { s: 1, emoji: '🐕', en: 'Walk the dog', sq: 'Shëtit qenin', rule: daily(), time: '18:00' },
        { emoji: '💧', en: 'Fill the water bowls', sq: 'Mbush enët e ujit', rule: daily() },
        { emoji: '🌱', en: 'Water the garden', sq: 'Ujit kopshtin', rule: daily(), time: '20:00' }
      ] },
      { key: 'tpl.g.errands', items: [
        { s: 1, emoji: '🛒', en: 'Grocery shopping', sq: 'Bli ushqimet', rule: weekly([6]) },
        { emoji: '🥖', en: 'Buy bread', sq: 'Bli bukë', rule: daily(), time: '08:00' },
        { s: 1, emoji: '💳', en: 'Pay the bills', sq: 'Paguaj faturat', rule: monthly(5) },
        { emoji: '🏠', en: 'Pay the rent', sq: 'Paguaj qiranë', rule: monthly(1) },
        { s: 1, emoji: '📦', en: 'Check the mail', sq: 'Kontrollo postën', rule: weekly([1, 3, 5]) },
        { emoji: '💊', en: 'Take the medicine', sq: 'Merr ilaçet', rule: daily(), time: '09:00' },
        { s: 1, emoji: '🚗', en: 'Wash the car', sq: 'Lani makinën', rule: monthly(15) },
        { emoji: '⛽', en: 'Fill up the car', sq: 'Mbush makinën me karburant', rule: weekly([5]) }
      ] },
      { key: 'tpl.g.upkeep', items: [
        { emoji: '❄️', en: 'Clean the AC filter', sq: 'Pastro filtrin e kondicionerit', rule: monthly(1) },
        { emoji: '🔧', en: 'Check the smoke alarm', sq: 'Kontrollo alarmin e tymit', rule: monthly(1) },
        { emoji: '🧊', en: 'Defrost the freezer', sq: 'Shkri ngrirësin', rule: rule({ freq: 'monthly', interval: 3, monthMode: 'dom', dom: 1 }) },
        { emoji: '🗑️', en: 'Clean the bins', sq: 'Lani koshat e plehrave', rule: monthly(20) }
      ] }
    ];
  };
  T.groups = T.catalog;
  /* every common chore in one flat list */
  T.all = function () { var out = []; T.catalog().forEach(function (g) { g.items.forEach(function (it) { out.push(Object.assign({ group: g.key }, it)); }); }); return out; };
  /* the starter set as rows ready to save as the family's own templates */
  T.starter = function () {
    return T.all().filter(function (it) { return it.s; }).map(function (it) { return { title: it.en, title_sq: it.sq, emoji: it.emoji, rule: it.rule, due_time: it.time || null }; });
  };
  /* a saved template's name in the current language (falls back to the other one) */
  T.label = function (it) { return FB.i18n.lang === 'sq' && it.title_sq ? it.title_sq : it.title; };
  T.name = function (it) { return FB.i18n.lang === 'sq' ? it.sq : it.en; };
})(typeof window !== 'undefined' ? window : globalThis);
