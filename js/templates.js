/* Ready-made chores: pick the usual ones and add them all at once. */
(function (root) {
  'use strict';
  var FB = (root.FB = root.FB || {});
  var T = (FB.templates = {});

  function rule(over) { return Object.assign(FB.recur.defaultRule(FB.util.today()), over); }
  var daily = function (n) { return rule({ freq: 'daily', interval: n || 1 }); };
  var weekly = function (days) { return rule({ freq: 'weekly', interval: 1, weekdays: days }); };
  var monthly = function (dom) { return rule({ freq: 'monthly', interval: 1, monthMode: 'dom', dom: dom }); };

  /* groups -> items. time is an optional "by" time. */
  T.groups = function () {
    return [
      { key: 'tpl.g.kitchen', items: [
        { emoji: '🍽️', en: 'Wash the dishes', sq: 'Laj enët', rule: daily(), time: '21:00' },
        { emoji: '🍳', en: 'Cook dinner', sq: 'Gatuaj darkën', rule: daily() },
        { emoji: '🗑️', en: 'Take out the trash', sq: 'Hidh plehrat', rule: daily(2), time: '19:00' },
        { emoji: '🧽', en: 'Wipe the kitchen', sq: 'Pastro kuzhinën', rule: weekly([6]) }
      ] },
      { key: 'tpl.g.home', items: [
        { emoji: '🧹', en: 'Vacuum the floors', sq: 'Fshij me fshesë elektrike', rule: weekly([1, 4]) },
        { emoji: '🚿', en: 'Clean the bathroom', sq: 'Pastro banjën', rule: weekly([6]) },
        { emoji: '🧺', en: 'Do the laundry', sq: 'Lani rrobat', rule: weekly([2, 5]) },
        { emoji: '👕', en: 'Fold and put away laundry', sq: 'Paloso dhe vendos rrobat', rule: weekly([3, 6]) },
        { emoji: '🛏️', en: 'Change the bed sheets', sq: 'Ndërro çarçafët', rule: rule({ freq: 'weekly', interval: 2, weekdays: [0] }) },
        { emoji: '🪟', en: 'Clean the windows', sq: 'Pastro dritaret', rule: monthly(1) }
      ] },
      { key: 'tpl.g.pets', items: [
        { emoji: '🪴', en: 'Water the plants', sq: 'Ujit lulet', rule: weekly([0, 3]) },
        { emoji: '🐈', en: 'Feed the cat', sq: 'Ushqe macen', rule: daily() },
        { emoji: '🐕', en: 'Walk the dog', sq: 'Shëtit qenin', rule: daily(), time: '18:00' }
      ] },
      { key: 'tpl.g.errands', items: [
        { emoji: '🛒', en: 'Grocery shopping', sq: 'Bli ushqimet', rule: weekly([6]) },
        { emoji: '💳', en: 'Pay the bills', sq: 'Paguaj faturat', rule: monthly(5) },
        { emoji: '🚗', en: 'Wash the car', sq: 'Lani makinën', rule: monthly(15) },
        { emoji: '📦', en: 'Check the mail', sq: 'Kontrollo postën', rule: weekly([1, 3, 5]) }
      ] }
    ];
  };
  T.name = function (it) { return FB.i18n.lang === 'sq' ? it.sq : it.en; };
})(typeof window !== 'undefined' ? window : globalThis);
