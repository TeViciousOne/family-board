const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../js/util.js');
const R = require('../js/recur.js');

const rule = (o) => Object.assign(R.defaultRule('2026-11-09'), o);
const days = (r, from, to) => R.between(r, from, to);

test('once only fires on its start date', () => {
  const r = rule({ freq: 'once', start: '2026-11-20' });
  assert.deepEqual(days(r, '2026-11-01', '2026-12-31'), ['2026-11-20']);
});

test('daily and every-N-days', () => {
  assert.equal(days(rule({ freq: 'daily' }), '2026-11-09', '2026-11-15').length, 7);
  assert.deepEqual(days(rule({ freq: 'daily', interval: 3 }), '2026-11-09', '2026-11-20'),
    ['2026-11-09', '2026-11-12', '2026-11-15', '2026-11-18']);
});

test('nothing before start, nothing after until', () => {
  const r = rule({ freq: 'daily', until: '2026-11-11' });
  assert.equal(R.occursOn(r, '2026-11-08'), false);
  assert.deepEqual(days(r, '2026-11-08', '2026-11-14'), ['2026-11-09', '2026-11-10', '2026-11-11']);
});

test('weekly on chosen weekdays (Mon/Wed/Fri)', () => {
  const r = rule({ freq: 'weekly', weekdays: [1, 3, 5] }); // 2026-11-09 is a Monday
  assert.deepEqual(days(r, '2026-11-09', '2026-11-15'), ['2026-11-09', '2026-11-11', '2026-11-13']);
});

test('weekly with no weekdays falls back to the start weekday', () => {
  const r = rule({ freq: 'weekly', weekdays: [] });
  assert.deepEqual(days(r, '2026-11-09', '2026-11-30'), ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
});

test('every 2 weeks: Sunday belongs to the week that started on the Monday before', () => {
  const r = rule({ freq: 'weekly', interval: 2, weekdays: [0, 1] }); // start Monday 9 Nov
  assert.deepEqual(days(r, '2026-11-09', '2026-12-07'),
    ['2026-11-09', '2026-11-15', '2026-11-23', '2026-11-29', '2026-12-07']);
});

test('monthly on a day of month; 31st clamps to the last day of short months', () => {
  const r = rule({ freq: 'monthly', monthMode: 'dom', dom: 31, start: '2026-01-31' });
  assert.deepEqual(days(r, '2026-01-01', '2026-04-30'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

test('monthly on the last day', () => {
  const r = rule({ freq: 'monthly', monthMode: 'last', start: '2026-01-01' });
  assert.deepEqual(days(r, '2026-02-01', '2026-03-31'), ['2026-02-28', '2026-03-31']);
  assert.deepEqual(days(r, '2028-02-01', '2028-02-29'), ['2028-02-29']); // leap year
});

test('monthly on the 2nd Saturday', () => {
  const r = rule({ freq: 'monthly', monthMode: 'nth', nth: 2, nthDay: 6, start: '2026-11-01' });
  assert.deepEqual(days(r, '2026-11-01', '2027-01-31'), ['2026-11-14', '2026-12-12', '2027-01-09']);
});

test('monthly on the last Friday (4th or 5th)', () => {
  const r = rule({ freq: 'monthly', monthMode: 'nth', nth: -1, nthDay: 5, start: '2026-11-01' });
  assert.deepEqual(days(r, '2026-11-01', '2027-01-31'), ['2026-11-27', '2026-12-25', '2027-01-29']);
});

test('every 3 months', () => {
  const r = rule({ freq: 'monthly', interval: 3, monthMode: 'dom', dom: 5, start: '2026-01-05' });
  assert.deepEqual(days(r, '2026-01-01', '2026-12-31'), ['2026-01-05', '2026-04-05', '2026-07-05', '2026-10-05']);
});

test('yearly (birthday) incl. 29 February fallback', () => {
  const r = rule({ freq: 'yearly', start: '2000-02-29' });
  assert.equal(R.occursOn(r, '2027-02-28'), true);
  assert.equal(R.occursOn(r, '2027-03-01'), false);
  assert.equal(R.occursOn(r, '2028-02-29'), true);
  assert.equal(R.occursOn(r, '2028-02-28'), false);
});

test('every 2 years', () => {
  const r = rule({ freq: 'yearly', interval: 2, start: '2026-06-01' });
  assert.equal(R.occursOn(r, '2027-06-01'), false);
  assert.equal(R.occursOn(r, '2028-06-01'), true);
});

test('daylight-saving change does not skip or duplicate a day', () => {
  // EU clocks change on 2026-03-29 and 2026-10-25
  const r = rule({ freq: 'daily', start: '2026-03-25' });
  assert.equal(days(r, '2026-03-25', '2026-04-02').length, 9);
  const r2 = rule({ freq: 'daily', start: '2026-10-22' });
  assert.equal(days(r2, '2026-10-22', '2026-10-28').length, 7);
});

test('nextOccurrence', () => {
  const r = rule({ freq: 'weekly', weekdays: [6] });
  assert.equal(R.nextOccurrence(r, '2026-11-09'), '2026-11-14');
  assert.equal(R.nextOccurrence(rule({ freq: 'once', start: '2026-01-01' }), '2026-11-09'), null);
});

test('describe produces words from the supplied dictionary', () => {
  const L = {
    t: (k, v) => k + (v ? JSON.stringify(v) : ''),
    dayShort: (i) => 'd' + i, dayLong: (i) => 'D' + i, ord: (n) => 'o' + n,
  };
  assert.equal(R.describe(rule({ freq: 'weekly', weekdays: [1, 2, 3, 4, 5] }), L), 'rule.weekdays');
  assert.equal(R.describe(rule({ freq: 'weekly', weekdays: [6, 0] }), L), 'rule.weekends');
  assert.match(R.describe(rule({ freq: 'monthly', monthMode: 'nth', nth: 2, nthDay: 6 }), L), /rule\.monthly/);
  assert.match(R.describe(rule({ freq: 'daily', until: '2027-01-01' }), L), /rule\.until/);
});

test('util date helpers', () => {
  assert.equal(U.addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(U.weekday('2026-11-09'), 1);
  assert.equal(U.daysInMonth(2028, 2), 29);
  assert.equal(U.textOn('#F0A818'), '#10302F');
  assert.equal(U.textOn('#2F86D0'), '#FFFFFF');
});
