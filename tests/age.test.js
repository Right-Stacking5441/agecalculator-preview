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

test('Korean page: international age sentence when the chosen date is a birthday', () => {
  const fmt = t => t.d + ' ' + A.MONTHS[t.m - 1] + ' ' + t.y;
  const today = D(2026, 11, 16);
  const sent = (b, at) => A.koreanIntlUpSentence(A.age(b, at), at, today, fmt);

  // (a) today is the birthday
  assert.equal(sent(D(1990, 11, 16), today), 'International age went up today.');

  // (b) the chosen date is a birthday, but it is not today
  assert.equal(sent(D(1990, 11, 16), D(2025, 11, 16)), 'International age went up on that day.');
  assert.equal(sent(D(1990, 11, 16), D(2027, 11, 16)), 'International age goes up on that day.');

  // Not a birthday: still names the next one
  assert.equal(sent(D(1990, 3, 14), today), 'International age goes up on 14 March 2027.');

  // Born on the chosen date: international age is 0 and goes up on the first birthday
  assert.equal(sent(today, today), 'International age goes up on 16 November 2027.');
  assert.equal(sent(D(2020, 6, 1), D(2020, 6, 1)), 'International age goes up on 1 June 2021.');
  assert.equal(sent(D(2024, 2, 29), D(2024, 2, 29)), 'International age goes up on 1 March 2025.');
});

test('Korean page: counting and year age sentence when the chosen date is 1 January', () => {
  const fmt = t => '1 January ' + t.y;
  const today = D(2026, 11, 16);
  const sent = (b, at) => A.koreanCountingUpSentence(A.age(b, at), at, today, fmt);

  // Not 1 January: still names the next New Year and the days remaining
  assert.equal(sent(D(1995, 3, 15), today), 'Korean age and year age go up on 1 January 2027, in 46 days.');

  // (a) today is 1 January
  const newYear = D(2026, 1, 1);
  assert.equal(
    A.koreanCountingUpSentence(A.age(D(1995, 3, 15), newYear), newYear, newYear, fmt),
    'Korean age and year age went up today.'
  );

  // (b) the chosen date is 1 January, but it is not today
  assert.equal(sent(D(1995, 3, 15), D(2025, 1, 1)), 'Korean age and year age went up on that day.');
  assert.equal(sent(D(1995, 3, 15), D(2027, 1, 1)), 'Korean age and year age go up on that day.');

  // Born on 1 January: year age is still 0 and both go up on the next New Year
  assert.equal(sent(D(2020, 1, 1), D(2020, 1, 1)), 'Korean age and year age go up on 1 January 2021.');
  assert.equal(
    A.koreanCountingUpSentence(A.age(D(2026, 1, 1), D(2026, 1, 1)), D(2026, 1, 1), D(2026, 1, 1), fmt),
    'Korean age and year age go up on 1 January 2027.'
  );
});

test('AAHA chart: every printed dog and cat value', () => {
  const dogs = {
    small:  { 1:15, 2:24, 3:28, 4:32, 5:36, 6:40, 7:44, 8:48, 9:52, 10:56, 11:60, 12:64, 13:68, 14:72, 15:76, 16:80, 17:84, 18:88, 19:92, 20:96 },
    medium: { 1:15, 2:24, 3:28, 4:33, 5:37, 6:42, 7:47, 8:51, 9:56, 10:60, 11:65, 12:69, 13:74, 14:78, 15:83, 16:87, 17:92, 18:96, 19:101, 20:105 },
    large:  { 1:15, 2:24, 3:30, 4:35, 5:40, 6:45, 7:50, 8:55, 9:61, 10:66, 11:72, 12:77, 13:82, 14:88, 15:93, 16:99, 17:104, 18:109, 19:115, 20:120 },
    giant:  { 1:15, 2:24, 3:32, 4:37, 5:42, 6:49, 7:56, 8:64, 9:71, 10:78, 11:86, 12:93, 13:101, 14:108, 15:115, 16:123 },
  };
  for (const [size, pts] of Object.entries(dogs)) {
    for (const [age, human] of Object.entries(pts)) {
      const r = A.dogAge(+age, size);
      assert.equal(r.ok, true, `${size} ${age}`);
      assert.equal(r.human, human, `${size} ${age}`);
      assert.equal(r.interpolated, false);
    }
  }
  assert.deepEqual([A.dogAge(10, 'medium').human, A.dogAge(10, 'large').human, A.dogAge(10, 'giant').human], [60, 66, 78]);
  const cats = { 0.5:10, 1:15, 2:24, 3:28, 4:32, 5:36, 6:40, 7:44, 8:48, 9:52, 10:56, 11:60, 12:64, 13:68, 14:72, 15:76, 16:80, 17:84, 18:88, 19:92, 20:96, 21:100 };
  for (const [age, human] of Object.entries(cats)) {
    const r = A.catAge(+age);
    assert.equal(r.ok, true, `cat ${age}`);
    assert.equal(r.human, human, `cat ${age}`);
  }
});

test('AAHA chart: interpolation, refusals and life stages', () => {
  // 4 years 6 months is halfway between 4 (32) and 5 (36) on the cat chart = 34, as the copy says.
  const mid = A.catAge(4.5);
  assert.equal(mid.ok, true);
  assert.equal(mid.interpolated, true);
  assert.equal(mid.human, 34);
  // Linear interpolation for a medium dog between 10 (60) and 11 (65).
  const d = A.dogAge(10.5, 'medium');
  assert.equal(d.ok, true);
  assert.equal(d.interpolated, true);
  assert.equal(d.human, 62.5);
  assert.equal(A.dogAge(0.5, 'large').ok, false);
  assert.equal(A.dogAge(0.5, 'large').code, 'below-chart');
  assert.equal(A.catAge(0.4).ok, false);
  assert.equal(A.dogAge(17, 'giant').ok, false);
  assert.equal(A.dogAge(21, 'small').ok, false);
  assert.equal(A.catAge(22).ok, false);
  assert.equal(A.catStage(0.4), 'Kitten');
  assert.equal(A.catStage(1), 'Young adult');
  assert.equal(A.catStage(6.9), 'Young adult');
  assert.equal(A.catStage(7), 'Mature adult');
  assert.equal(A.catStage(10), 'Mature adult');
  assert.equal(A.catStage(10.1), 'Senior');
  assert.equal(A.catStage(12), 'Senior');
});

test('DNA-clock estimate is 16 × ln(dog age) + 31 (Wang et al. 2020)', () => {
  assert.equal(A.dogAgeEpigenetic(0.5), null);
  assert.ok(Math.abs(A.dogAgeEpigenetic(1) - 31) < 1e-9);
  // Copy's worked example: 16 × ln(7) + 31 ≈ 62.
  assert.equal(Math.round(A.dogAgeEpigenetic(7)), 62);
  assert.ok(Math.abs(A.dogAgeEpigenetic(7) - (16 * Math.log(7) + 31)) < 1e-12);
  assert.equal(Math.round(A.dogAgeEpigenetic(10)), 68);
  assert.equal(Math.round(A.dogAgeEpigenetic(4)), 53);
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
  // Birth fields: two-digit years stay in the past (default yearMode).
  assert.deepEqual(P('1/1/30', { pivotYear: 2026 }), [1930, 1, 1]);
  // A two-digit year whose completed date is after today falls back a century.
  assert.deepEqual(P('17/11/26', { pivotYear: 2026, today: D(2026, 11, 16) }), [1926, 11, 17]);
  assert.deepEqual(P('17 November 26', { pivotYear: 2026, today: D(2026, 11, 16) }), [1926, 11, 17]);
  assert.deepEqual(P('16/11/26', { pivotYear: 2026, today: D(2026, 11, 16) }), [2026, 11, 16]);
  assert.deepEqual(P('15/11/26', { pivotYear: 2026, today: D(2026, 11, 16) }), [2026, 11, 15]);
  // Target fields do not fall back; 17/11/26 can be tomorrow.
  assert.deepEqual(P('17/11/26', { pivotYear: 2026, today: D(2026, 11, 16), yearMode: 'nearest' }), [2026, 11, 17]);
  // Target / future fields: nearest of this century and the last.
  assert.deepEqual(P('1/1/30', { pivotYear: 2026, yearMode: 'nearest' }), [2030, 1, 1]);
  assert.deepEqual(P('1/1/26', { pivotYear: 2026, yearMode: 'nearest' }), [2026, 1, 1]);
  assert.deepEqual(P('1/1/99', { pivotYear: 2026, yearMode: 'nearest' }), [1999, 1, 1]);
  assert.deepEqual(P('15 March 30', { pivotYear: 2026, yearMode: 'nearest' }), [2030, 3, 15]);
  // A one-digit year is incomplete, not silently 2000.
  assert.equal(P('1/1/0', { pivotYear: 2026 }), 'incomplete');
  assert.equal(P('15 March 5', { pivotYear: 2026 }), 'incomplete');
  assert.equal(P('15 march'), 'incomplete');
  // Partial month names are unfinished, not invalid ("18 M", "18 Ma").
  assert.equal(P('18 M'), 'incomplete');
  assert.equal(P('18 Ma'), 'incomplete');
  assert.equal(P('18 Mar'), 'incomplete');
  assert.equal(P('18 xyz'), 'unreadable');
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


test('last and next birthday when the chosen date is a birthday', () => {
  const a = A.birthdayBounds(D(1995, 3, 15), D(2026, 3, 15));
  assert.equal(a.onBirthday, true);
  assert.equal(a.lastLabel, 'Birthday on that date');
  assert.equal(a.nextLabel, 'Birthday after');
  assert.deepEqual([a.last.y, a.last.m, a.last.d], [2026, 3, 15]);
  assert.deepEqual([a.next.y, a.next.m, a.next.d], [2027, 3, 15]);
  assert.equal(a.next.turning, 32);
  assert.notDeepEqual([a.last.y, a.last.m, a.last.d], [a.next.y, a.next.m, a.next.d]);
  assert.equal(a.months, 0);
  assert.equal(a.days, 0);
  assert.deepEqual(ymd(a.r), [31, 0, 0]);

  const b = A.birthdayBounds(D(1996, 2, 29), D(2001, 3, 1));
  assert.equal(b.onBirthday, true);
  assert.equal(b.lastLabel, 'Birthday on that date');
  assert.equal(b.nextLabel, 'Birthday after');
  assert.deepEqual([b.last.y, b.last.m, b.last.d], [2001, 3, 1]);
  assert.deepEqual([b.next.y, b.next.m, b.next.d], [2002, 3, 1]);
  assert.equal(b.next.turning, 6);
  assert.notDeepEqual([b.last.y, b.last.m, b.last.d], [b.next.y, b.next.m, b.next.d]);
  assert.equal(b.months, 0);
  assert.equal(b.days, 0);
  assert.deepEqual(ymd(b.r), [5, 0, 0]);

  const c = A.birthdayBounds(D(1995, 3, 15), D(1995, 3, 15));
  assert.equal(c.bornDay, true);
  assert.equal(c.lastLabel, 'Birthday on that date');
  assert.deepEqual([c.last.y, c.last.m, c.last.d], [1995, 3, 15]);
  assert.deepEqual([c.next.y, c.next.m, c.next.d], [1996, 3, 15]);
  assert.equal(c.next.turning, 1);
  assert.notEqual(c.next.turning, 0);
  assert.equal(c.months, 0);
  assert.equal(c.days, 0);
  assert.deepEqual(ymd(c.r), [0, 0, 0]);

  // Under 1, and not on the birth date itself: the earlier bound is the birth date, labelled "Born".
  const baby = A.birthdayBounds(D(2026, 6, 1), D(2026, 11, 16));
  assert.equal(baby.years, 0);
  assert.equal(baby.onBirthday, false);
  assert.equal(baby.lastLabel, 'Born');
  assert.deepEqual([baby.last.y, baby.last.m, baby.last.d], [2026, 6, 1]);
  assert.equal(baby.nextLabel, 'Birthday after');
  assert.deepEqual([baby.next.y, baby.next.m, baby.next.d], [2027, 6, 1]);
  assert.equal(baby.next.turning, 1);

  const mid = A.birthdayBounds(D(1995, 3, 15), D(2026, 11, 16));
  assert.equal(mid.onBirthday, false);
  assert.equal(mid.lastLabel, 'Birthday before');
  assert.equal(mid.nextLabel, 'Birthday after');
  assert.deepEqual([mid.last.y, mid.last.m, mid.last.d], [2026, 3, 15]);
  assert.deepEqual([mid.next.y, mid.next.m, mid.next.d], [2027, 3, 15]);
  assert.equal(mid.next.turning, 32);
});

test('seconds until midnight uses the next midnight in the zone, including DST days in Europe/London and America/New_York', () => {
  const at = (tz, y, m, d, hh, mm, ss) => new Date(A.instantInZone(tz, y, m, d, hh, mm, ss));
  const sec = (tz, date) => A.secondsUntilMidnight(tz, date);

  // A common 24-hour day: 16 November 2026, Europe/London (GMT).
  assert.equal(sec('Europe/London', at('Europe/London', 2026, 11, 16, 0, 0, 0)), 24 * 3600);
  assert.equal(sec('Europe/London', at('Europe/London', 2026, 11, 16, 12, 0, 0)), 12 * 3600);
  assert.equal(sec('Europe/London', at('Europe/London', 2026, 11, 16, 23, 59, 59)), 1);

  // Europe/London springs forward at 01:00 on Sunday 29 March 2026: a 23-hour day.
  assert.equal(sec('Europe/London', at('Europe/London', 2026, 3, 29, 0, 0, 0)), 23 * 3600);
  // After the gap, 12:00 to midnight is still 12 hours.
  assert.equal(sec('Europe/London', at('Europe/London', 2026, 3, 29, 12, 0, 0)), 12 * 3600);

  // Europe/London falls back at 02:00 on Sunday 25 October 2026: a 25-hour day.
  assert.equal(sec('Europe/London', at('Europe/London', 2026, 10, 25, 0, 0, 0)), 25 * 3600);
  assert.equal(sec('Europe/London', at('Europe/London', 2026, 10, 25, 12, 0, 0)), 12 * 3600);

  // America/New_York springs forward at 02:00 on Sunday 8 March 2026: a 23-hour day.
  assert.equal(sec('America/New_York', at('America/New_York', 2026, 3, 8, 0, 0, 0)), 23 * 3600);
  assert.equal(sec('America/New_York', at('America/New_York', 2026, 3, 8, 12, 0, 0)), 12 * 3600);

  // America/New_York falls back at 02:00 on Sunday 1 November 2026: a 25-hour day.
  assert.equal(sec('America/New_York', at('America/New_York', 2026, 11, 1, 0, 0, 0)), 25 * 3600);
  assert.equal(sec('America/New_York', at('America/New_York', 2026, 11, 1, 12, 0, 0)), 12 * 3600);
});

test('validate: a 1–3 digit year box is incomplete, with a message once digits are typed', () => {
  const short = A.validate('15', '3', '0');
  assert.equal(short.ok, false);
  assert.equal(short.code, 'incomplete');
  assert.equal(short.field, 'year');
  assert.match(short.message, /four digits/);
  const emptyYear = A.validate('15', '3', '');
  assert.equal(emptyYear.ok, false);
  assert.equal(emptyYear.code, 'incomplete');
  assert.equal(emptyYear.message, '');
  const ok = A.validate('15', '3', '1995');
  assert.equal(ok.ok, true);
});

test('age in a calendar year: birth year is 0, January 1 is safe, and 1996 is 1 year old', () => {
  const b = D(1995, 3, 15);
  const born = A.ageInCalendarYear(b, 1995);
  assert.equal(born.ok, true);
  assert.equal(born.bornYear, true);
  assert.equal(born.after, 0);
  assert.equal(born.jan1, null); // 1 January 1995 is before the birth date — not NaN
  assert.equal(born.dec31.ok, true);
  assert.equal(born.dec31.years, 0);
  assert.deepEqual([born.firstBirthday.y, born.firstBirthday.m, born.firstBirthday.d], [1996, 3, 15]);

  const next = A.ageInCalendarYear(b, 1996);
  assert.equal(next.ok, true);
  assert.equal(next.bornYear, false);
  assert.equal(next.after, 1);
  assert.equal(next.before, 0);
  assert.equal(next.jan1.ok, true);
  assert.equal(next.jan1.years, 0);
  assert.equal(next.dec31.years, 1);
  assert.equal(A.yearsOldUnit(next.after), 'year old');
  assert.equal(A.yearsOldUnit(0), 'years old');
  assert.equal(A.yearsOldUnit(2), 'years old');

  const later = A.ageInCalendarYear(b, 2026);
  assert.equal(later.after, 31);
  assert.equal(later.before, 30);
  assert.equal(later.jan1.years, 30);
  assert.equal(later.dec31.years, 31);
  assert.equal(A.yearsOldUnit(later.after), 'years old');

  const before = A.ageInCalendarYear(b, 1994);
  assert.equal(before.ok, false);
  assert.equal(before.code, 'before-birth');

  // Born on 1 January: 1 January of the birth year is already 0 years, not "not born yet".
  const nye = A.ageInCalendarYear(D(1995, 1, 1), 1995);
  assert.equal(nye.jan1.ok, true);
  assert.equal(nye.jan1.years, 0);
});

test('parsePetAge rejects non-whole ages and accepts years plus months', () => {
  assert.equal(A.parsePetAge('', '').code, 'empty');
  assert.equal(A.parsePetAge('.5', '').ok, false);
  assert.equal(A.parsePetAge('.5', '').code, 'invalid');
  assert.equal(A.parsePetAge('-1', '').ok, false);
  assert.equal(A.parsePetAge('abc', '').ok, false);
  assert.equal(A.parsePetAge('1e1', '').ok, false);
  assert.equal(A.parsePetAge('3', '12').code, 'months');
  const ok = A.parsePetAge('3', '6');
  assert.equal(ok.ok, true);
  assert.equal(ok.years, 3);
  assert.equal(ok.months, 6);
  assert.equal(ok.age, 3.5);
  const monthsOnly = A.parsePetAge('', '6');
  assert.equal(monthsOnly.ok, true);
  assert.equal(monthsOnly.years, 0);
  assert.equal(monthsOnly.months, 6);
  const yearsOnly = A.parsePetAge('2', '');
  assert.equal(yearsOnly.ok, true);
  assert.equal(yearsOnly.age, 2);
});

test('plural-style counts: 1 is singular for days, weeks, months and years', () => {
  // Mirrors UI labels that append a unit to a number (days-between, difference strip, how long ago).
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const unit = (n, one, many) => n + (n === 1 ? one : many);
  assert.equal(plural(Math.floor(8 / 7), 'week') + ' and ' + plural(8 % 7, 'day'), '1 week and 1 day');
  assert.equal(plural(Math.floor(7 / 7), 'week'), '1 week');
  assert.equal(plural(Math.floor(1 / 7), 'week'), '0 weeks');
  assert.equal(plural(Math.floor(14 / 7), 'week'), '2 weeks');
  assert.equal(unit(1, ' day', ' days'), '1 day');
  assert.equal(unit(0, ' day', ' days'), '0 days');
  assert.equal(unit(2, ' day', ' days'), '2 days');
  assert.equal(plural(0, 'year'), '0 years');
  assert.equal(plural(1, 'year'), '1 year');
  assert.equal(plural(2, 'year'), '2 years');
  assert.equal(plural(1, 'month'), '1 month');
  assert.equal(plural(2, 'month'), '2 months');
});

test('partsWords shows every non-zero part with correct plurals', () => {
  assert.equal(A.partsWords(0, 1, 2), '1 month and 2 days');
  assert.equal(A.partsWords(0, 1, 0), '1 month');
  assert.equal(A.partsWords(1, 0, 0), '1 year');
  assert.equal(A.partsWords(2, 0, 1), '2 years and 1 day');
  assert.equal(A.partsWords(1, 2, 3), '1 year, 2 months and 3 days');
  assert.equal(A.partsWords(0, 0, 1), '1 day');
  assert.equal(A.partsWords(0, 0, 0), '');
  // 14 October to 16 November is 1 month and 2 days, 33 days in all.
  const r = A.age(D(2026, 10, 14), D(2026, 11, 16));
  assert.deepEqual(ymd(r), [0, 1, 2]);
  assert.equal(r.totalDays, 33);
  assert.equal(A.partsWords(r.years, r.months, r.days), '1 month and 2 days');
});

test('textFromParts writes a valid date back, and clears incomplete or invalid boxes', () => {
  const ok = A.textFromParts('18', '5', '1999');
  assert.equal(ok.ok, true);
  assert.equal(ok.text, '18 May 1999');
  const clearedMonth = A.textFromParts('18', '', '1999');
  assert.equal(clearedMonth.ok, false);
  assert.equal(clearedMonth.text, '');
  const invalid = A.textFromParts('31', '4', '1999');
  assert.equal(invalid.ok, false);
  assert.equal(invalid.text, '');
  const empty = A.textFromParts('', '', '');
  assert.equal(empty.ok, false);
  assert.equal(empty.text, '');
});
