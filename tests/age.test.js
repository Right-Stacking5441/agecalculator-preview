const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../docs/dates.js');
const D = (y, m, d) => ({ y, m, d });
const ymd = r => [r.years, r.months, r.days];

// Independent oracle using JS Date in UTC, for totals.
const utcDays = (a, b) => (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 864e5;

test('leap years', () => {
  assert.equal(A.isLeap(2000), true);
  assert.equal(A.isLeap(1900), false);
  assert.equal(A.isLeap(2024), true);
  assert.equal(A.isLeap(2026), false);
  assert.equal(A.daysInMonth(2024, 2), 29);
  assert.equal(A.daysInMonth(2100, 2), 28);
});

test('weekday and day numbers match JS Date', () => {
  assert.equal(A.dayNumber(1970, 1, 1), 0);
  assert.equal(A.WEEKDAYS[A.weekday(2026, 11, 16)], 'Monday');
  assert.equal(A.WEEKDAYS[A.weekday(1988, 3, 14)], 'Monday');
  assert.equal(A.WEEKDAYS[A.weekday(2027, 3, 14)], 'Sunday');
  assert.equal(A.WEEKDAYS[A.weekday(1900, 1, 1)], 'Monday');
  for (let y = 1890; y <= 2110; y += 7) for (let m = 1; m <= 12; m++) {
    const d = Math.min(28, m * 2);
    const js = new Date(Date.UTC(y, m - 1, d));
    assert.equal(A.dayNumber(y, m, d), js.getTime() / 864e5);
    assert.equal(A.weekday(y, m, d), (js.getUTCDay() + 6) % 7);
  }
});

test('reference case: born 14 Mar 1988, on 16 Nov 2026', () => {
  const r = A.age(D(1988, 3, 14), D(2026, 11, 16));
  assert.deepEqual(ymd(r), [38, 8, 2]);
  assert.equal(r.totalDays, utcDays(D(1988, 3, 14), D(2026, 11, 16)));
  assert.equal(r.totalDays, 14126);
  assert.equal(r.weeks, 2018);
  assert.equal(r.weekRemainder, 0);
  assert.equal(r.hours, 14126 * 24);
  assert.deepEqual([r.next.y, r.next.m, r.next.d], [2027, 3, 14]);
  assert.equal(A.WEEKDAYS[r.next.weekday], 'Sunday');
  assert.equal(r.next.daysUntil, 118);
  assert.equal(r.next.turning, 39);
  assert.equal(r.next.isToday, false);
});

test('birthday today', () => {
  const r = A.age(D(1990, 11, 16), D(2026, 11, 16));
  assert.deepEqual(ymd(r), [36, 0, 0]);
  assert.equal(r.next.isToday, true);
  assert.equal(r.next.daysUntil, 0);
  assert.equal(r.next.turning, 36);
});

test('day before and after birthday', () => {
  assert.deepEqual(ymd(A.age(D(1990, 11, 17), D(2026, 11, 16))), [35, 11, 30]);
  const after = A.age(D(1990, 11, 15), D(2026, 11, 16));
  assert.deepEqual(ymd(after), [36, 0, 1]);
  assert.equal(after.next.daysUntil, 364);
});

test('born today', () => {
  const r = A.age(D(2026, 11, 16), D(2026, 11, 16));
  assert.deepEqual(ymd(r), [0, 0, 0]);
  assert.equal(r.totalDays, 0);
  assert.equal(r.next.isToday, true);
  assert.equal(r.next.turning, 0);
});

test('29 February birthdays: 1 March in common years', () => {
  const b = D(2000, 2, 29);
  const r1 = A.age(b, D(2001, 3, 1));
  assert.deepEqual(ymd(r1), [1, 0, 0]);
  assert.equal(r1.next.isToday, true);
  assert.equal(r1.next.shifted, true);
  assert.deepEqual(ymd(A.age(b, D(2001, 2, 28))), [0, 11, 30]);
  assert.equal(A.age(b, D(2001, 2, 28)).next.daysUntil, 1);
  assert.deepEqual(ymd(A.age(b, D(2001, 3, 2))), [1, 0, 1]);
  const r4 = A.age(b, D(2004, 2, 29));
  assert.deepEqual(ymd(r4), [4, 0, 0]);
  assert.equal(r4.next.shifted, false);
  assert.deepEqual(ymd(A.age(b, D(2004, 2, 28))), [3, 11, 30]);
  // Spec worked example: on 16 Nov 2026.
  const r = A.age(b, D(2026, 11, 16));
  assert.deepEqual(ymd(r), [26, 8, 18]);
  assert.deepEqual([r.next.y, r.next.m, r.next.d, r.next.turning, r.next.daysUntil], [2027, 3, 1, 27, 105]);
  assert.equal(A.WEEKDAYS[r.next.weekday], 'Monday');
  const n2 = A.age(b, D(2027, 3, 2)).next;
  assert.deepEqual([n2.y, n2.m, n2.d, n2.shifted], [2028, 2, 29, false]);
  assert.deepEqual(A.addMonths(b, 1200), D(2100, 3, 1)); // 2100 is not a leap year
});

test('spec homepage example: 15 Mar 1995 on 16 Nov 2026', () => {
  const r = A.age(D(1995, 3, 15), D(2026, 11, 16));
  assert.deepEqual(ymd(r), [31, 8, 1]);
  assert.equal(r.totalDays, utcDays(D(1995, 3, 15), D(2026, 11, 16)));
});

test('month-end edge cases (roll to the 1st when the day is missing)', () => {
  assert.deepEqual(ymd(A.age(D(2000, 1, 31), D(2000, 2, 29))), [0, 0, 29]);
  assert.deepEqual(ymd(A.age(D(2000, 1, 31), D(2000, 3, 1))), [0, 1, 0]);
  assert.deepEqual(ymd(A.age(D(2001, 1, 31), D(2001, 2, 28))), [0, 0, 28]);
  assert.deepEqual(ymd(A.age(D(2001, 1, 31), D(2001, 3, 1))), [0, 1, 0]);
  assert.deepEqual(ymd(A.age(D(2001, 1, 31), D(2001, 3, 31))), [0, 2, 0]);
  assert.deepEqual(ymd(A.age(D(2020, 3, 31), D(2020, 4, 30))), [0, 0, 30]);
  assert.deepEqual(ymd(A.age(D(2020, 3, 31), D(2020, 5, 1))), [0, 1, 0]);
  assert.deepEqual(ymd(A.age(D(2020, 3, 30), D(2020, 4, 30))), [0, 1, 0]);
  assert.deepEqual(ymd(A.age(D(2019, 12, 31), D(2020, 12, 30))), [0, 11, 29]);
  assert.deepEqual(ymd(A.age(D(2019, 12, 31), D(2020, 12, 31))), [1, 0, 0]);
  assert.deepEqual(A.addMonths(D(2019, 12, 31), 2), D(2020, 3, 1));
  assert.deepEqual(A.addMonths(D(2020, 11, 31 - 1), 1), D(2020, 12, 30));
});

test('total days agree with a Date oracle over many pairs', () => {
  let seed = 7;
  const rnd = n => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
  for (let i = 0; i < 3000; i++) {
    const b = D(1900 + rnd(150), 1 + rnd(12), 1);
    b.d = 1 + rnd(A.daysInMonth(b.y, b.m));
    const at = D(b.y + rnd(90), 1 + rnd(12), 1);
    at.d = 1 + rnd(A.daysInMonth(at.y, at.m));
    const r = A.age(b, at);
    if (A.cmp(at, b) < 0) { assert.equal(r.ok, false); continue; }
    assert.equal(r.totalDays, utcDays(b, at));
    // Re-adding the parts lands exactly on `at`.
    const back = A.addMonths(b, r.years * 12 + r.months);
    assert.equal(A.dayNumber(back.y, back.m, back.d) + r.days, A.dayNumber(at.y, at.m, at.d));
    assert.ok(r.months >= 0 && r.months < 12 && r.days >= 0 && r.days <= 31);
    assert.ok(r.next.daysUntil >= 0 && r.next.daysUntil <= 366);
  }
});

test('future date of birth', () => {
  const r = A.age(D(2027, 1, 1), D(2026, 11, 16));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'future');
  assert.equal(r.daysUntil, 46);
});

test('validation', () => {
  assert.equal(A.validate('', '', '').code, 'empty');
  assert.equal(A.validate('14', '', '').code, 'incomplete');
  assert.equal(A.validate('14', '3', '19').code, 'incomplete');
  assert.deepEqual(A.validate('14', '03', '1988').date, D(1988, 3, 14));
  assert.equal(A.validate('31', '4', '1990').message, 'April has 30 days.');
  assert.equal(A.validate('29', '2', '2001').message, '2001 wasn’t a leap year, so February had 28 days.');
  assert.equal(A.validate('30', '2', '2000').message, 'February 2000 has 29 days.');
  assert.equal(A.validate('29', '2', '2000').ok, true);
  assert.equal(A.validate('0', '5', '1990').field, 'day');
  assert.equal(A.validate('5', '13', '1990').field, 'month');
  assert.equal(A.validate('5', '0', '1990').field, 'month');
  assert.equal(A.validate('5', '5', '0999').code, 'year');
  assert.equal(A.validate('a', '5', '1990').field, 'day');
  assert.equal(A.validate(' 7 ', ' 7 ', ' 1977 ').ok, true);
});

test('days between dates and weekday counts', () => {
  const r = A.between(D(2026, 11, 16), D(2026, 11, 23));
  assert.equal(r.totalDays, 7); assert.equal(r.weekdays, 5); assert.equal(r.weekendDays, 2);
  const r2 = A.between(D(2026, 11, 20), D(2026, 11, 23)); // Fri -> Mon
  assert.equal(r2.totalDays, 3); assert.equal(r2.weekdays, 1);
  const back = A.between(D(2026, 12, 25), D(2026, 11, 16));
  assert.equal(back.sign, -1); assert.equal(back.totalDays, 39);
  assert.equal(A.between(D(2024, 1, 1), D(2025, 1, 1)).totalDays, 366);
  // brute-force weekday check
  for (let k = 0; k < 60; k++) {
    const a = D(2026, 1, 1 + (k % 28)), b = D(2026, 3 + (k % 9), 1 + ((k * 7) % 28));
    const r3 = A.between(a, b);
    let wd = 0; for (let i = 0; i < r3.totalDays; i++) if ((A.weekday(a.y, a.m, a.d) + i) % 7 < 5) wd++;
    assert.equal(r3.weekdays, wd);
  }
});

test('Korean ages', () => {
  const k = A.koreanAges(D(1995, 3, 15), D(2026, 11, 16));
  assert.deepEqual([k.international, k.counting, k.yearAge], [31, 32, 31]);
  const k2 = A.koreanAges(D(2026, 12, 31), D(2027, 1, 1)); // one day old
  assert.deepEqual([k2.international, k2.counting, k2.yearAge], [0, 2, 1]);
});

test('pet ages', () => {
  assert.equal(A.dogAge(1, 'medium'), 15);
  assert.equal(A.dogAge(2, 'small'), 24);
  assert.equal(A.dogAge(7, 'small'), 44);
  assert.equal(A.dogAge(7, 'giant'), 59);
  assert.equal(A.dogAge(0.5, 'large'), 7.5);
  assert.equal(Math.round(A.dogAgeEpigenetic(7)), 62);
  assert.equal(A.dogAgeEpigenetic(0.5), null);
  assert.equal(A.catAge(3), 28);
  assert.equal(A.catStage(12), 'Senior');
  assert.equal(A.catStage(0.4), 'Kitten');
});

test('birth year from age', () => {
  assert.deepEqual(A.birthYear(31, D(2026, 11, 16), true).years, [1995]);
  assert.deepEqual(A.birthYear(31, D(2026, 11, 16), false).years, [1994]);
  assert.deepEqual(A.birthYear(31, D(2026, 11, 16), null).years, [1994, 1995]);
});

test('natural-language date parsing', () => {
  const P = (s, o) => { const r = A.parseDate(s, o); return r.ok ? [r.date.y, r.date.m, r.date.d] : r.code; };
  assert.deepEqual(P('15 March 1995'), [1995, 3, 15]);
  assert.deepEqual(P('/15 march 1995'), [1995, 3, 15]);
  assert.deepEqual(P('March 15, 1995'), [1995, 3, 15]);
  assert.deepEqual(P('15th of Mar 95'), [1995, 3, 15]);
  assert.deepEqual(P('14 march 1988'), [1988, 3, 14]);
  assert.deepEqual(P('3/14/88'), [1988, 3, 14]);
  assert.deepEqual(P('3/15/95'), [1995, 3, 15]);
  assert.deepEqual(P('15.03.1995'), [1995, 3, 15]);
  assert.deepEqual(P('1995-03-15'), [1995, 3, 15]);
  assert.deepEqual(P('15031995'), [1995, 3, 15]);
  assert.deepEqual(P('19950315'), [1995, 3, 15]);
  assert.deepEqual(P('Wednesday 15 March 1995'), [1995, 3, 15]);
  assert.deepEqual(P('sept 9 2001'), [2001, 9, 9]);
  assert.deepEqual(P('1/2/2000'), [2000, 2, 1]);
  assert.deepEqual(P('1/2/2000', { order: 'MDY' }), [2000, 1, 2]);
  assert.equal(A.parseDate('1/2/2000').ambiguous, true);
  assert.equal(A.parseDate('5/5/2000').ambiguous, false);
  assert.deepEqual(P('1/1/26', { pivotYear: 2026 }), [2026, 1, 1]);
  assert.deepEqual(P('1/1/27', { pivotYear: 2026 }), [1927, 1, 1]);
  assert.equal(P('15 march'), 'incomplete');
  assert.equal(P('15 3'), 'incomplete');
  assert.equal(P(''), 'empty');
  assert.equal(P('next tuesday'), 'unreadable');
  assert.equal(P('31 april 1990'), 'day');
  assert.equal(P('29 feb 2001'), 'day');
});


test('addMonths: 31 January plus one month is 1 March, 31 May plus one month is 1 July', () => {
  assert.deepEqual(A.addMonths(D(2026, 1, 31), 1), D(2026, 3, 1));
  assert.deepEqual(A.addMonths(D(2024, 1, 31), 1), D(2024, 3, 1));
  assert.deepEqual(A.addMonths(D(2026, 5, 31), 1), D(2026, 7, 1));
  assert.deepEqual(A.addMonths(D(2024, 2, 29), 12), D(2025, 3, 1));
  assert.deepEqual(A.addMonths(D(2024, 2, 29), 48), D(2028, 2, 29));
});
