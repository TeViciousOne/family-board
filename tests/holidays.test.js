const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/holidays.js');
const H = globalThis.FB.holidays;

const offDays = (y) => {
  const out = [];
  for (let d = new Date(Date.UTC(y, 0, 1, 12)); d.getUTCFullYear() === y; d.setUTCDate(d.getUTCDate() + 1)) {
    const s = d.toISOString().slice(0, 10);
    if (H.isOff(s)) out.push(s);
  }
  return out;
};

test('2026 days off match the Bank of Albania calendar', () => {
  assert.deepEqual(offDays(2026), [
    '2026-01-01', '2026-01-02', '2026-03-14', '2026-03-16', '2026-03-20', '2026-03-22', '2026-03-23',
    '2026-04-05', '2026-04-06', '2026-04-12', '2026-04-13', '2026-05-01', '2026-05-27', '2026-09-05', '2026-09-07',
    '2026-11-22', '2026-11-23', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-08', '2026-12-25']);
});

test('Easter dates', () => {
  assert.equal(H._easter.west(2027), '2027-03-28');
  assert.equal(H._easter.orthodox(2027), '2027-05-02');
  assert.equal(H._easter.west(2028), H._easter.orthodox(2028));
});

test('name days find family members by first name, ignoring accents', () => {
  assert.deepEqual(H.celebrants('2026-12-06', [{ name: 'Kole Gjoni' }, { name: 'Ana' }]).map((m) => m.name), ['Kole Gjoni']);
  assert.deepEqual(H.celebrants('2026-11-30', [{ name: 'Andi' }]).map((m) => m.name), ['Andi']);
  assert.equal(H.celebrants('2026-11-30', [{ name: 'Ledia' }]).length, 0);
});
