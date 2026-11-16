"use strict";

var assert = require("assert");
var path = require("path");
var age = require(path.join(__dirname, "../docs/js/age.js"));

var passed = 0;
var failed = 0;
var failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("ok  " + name);
  } catch (err) {
    failed += 1;
    failures.push({ name: name, message: err && err.message, stack: err && err.stack });
    console.error("FAIL  " + name);
    console.error("      " + (err && err.message));
  }
}

function d(y, m, day) {
  return age.date(y, m, day);
}

function ymd(from, to) {
  return age.diffYMD(from, to);
}

function expectYMD(from, to, years, months, days) {
  var got = ymd(from, to);
  assert.ok(!got.error, "unexpected error: " + got.error);
  assert.deepStrictEqual(
    { years: got.years, months: got.months, days: got.days },
    { years: years, months: months, days: days }
  );
}

// --- leap years ---
test("400-divisible years are leap years (2000, 1600)", function () {
  assert.strictEqual(age.isLeap(2000), true);
  assert.strictEqual(age.isLeap(1600), true);
});

test("100-divisible years that are not 400-divisible are common (1900, 2100)", function () {
  assert.strictEqual(age.isLeap(1900), false);
  assert.strictEqual(age.isLeap(2100), false);
});

test("ordinary 4-divisible years are leap years (2024, 1996, 1896)", function () {
  assert.strictEqual(age.isLeap(2024), true);
  assert.strictEqual(age.isLeap(1996), true);
  assert.strictEqual(age.isLeap(1896), true);
});

test("other years are common (2023, 2025, 1999)", function () {
  assert.strictEqual(age.isLeap(2023), false);
  assert.strictEqual(age.isLeap(2025), false);
  assert.strictEqual(age.isLeap(1999), false);
});

test("February has 29 days in a leap year and 28 otherwise", function () {
  assert.strictEqual(age.daysInMonth(2024, 2), 29);
  assert.strictEqual(age.daysInMonth(2023, 2), 28);
  assert.strictEqual(age.daysInMonth(2000, 2), 29);
  assert.strictEqual(age.daysInMonth(1900, 2), 28);
  assert.strictEqual(age.daysInMonth(2024, 1), 31);
  assert.strictEqual(age.daysInMonth(2024, 4), 30);
});

test("29 February is valid only in a leap year", function () {
  assert.strictEqual(age.isValidDate(d(2024, 2, 29)), true);
  assert.strictEqual(age.isValidDate(d(2023, 2, 29)), false);
  assert.strictEqual(age.isValidDate(d(1900, 2, 29)), false);
  assert.strictEqual(age.isValidDate(d(2000, 2, 29)), true);
  assert.strictEqual(age.isValidDate(d(2024, 4, 31)), false);
  assert.strictEqual(age.isValidDate(d(2024, 0, 1)), false);
  assert.strictEqual(age.isValidDate(d(2024, 13, 1)), false);
});

// --- month-end addition ---
test("31 January plus one month is 28 February in a common year", function () {
  assert.deepStrictEqual(age.addMonths(d(2023, 1, 31), 1), d(2023, 2, 28));
});

test("31 January plus one month is 29 February in a leap year", function () {
  assert.deepStrictEqual(age.addMonths(d(2024, 1, 31), 1), d(2024, 2, 29));
});

test("31 January plus two months is 31 March, not a date in early March", function () {
  assert.deepStrictEqual(age.addMonths(d(2023, 1, 31), 2), d(2023, 3, 31));
  assert.deepStrictEqual(age.addMonths(d(2024, 1, 31), 2), d(2024, 3, 31));
});

test("31 May plus one month is 30 June", function () {
  assert.deepStrictEqual(age.addMonths(d(2024, 5, 31), 1), d(2024, 6, 30));
});

test("31 May plus two months is 31 July", function () {
  assert.deepStrictEqual(age.addMonths(d(2024, 5, 31), 2), d(2024, 7, 31));
});

test("adding months does not use JavaScript Date overflow (no 3 March)", function () {
  // new Date(2023, 0, 31); setMonth(+1) => 3 March 2023. We must not do that.
  var js = new Date(2023, 0, 31);
  js.setMonth(js.getMonth() + 1);
  assert.strictEqual(js.getDate(), 3);
  assert.deepStrictEqual(age.addMonths(d(2023, 1, 31), 1), d(2023, 2, 28));
});

test("29 February plus one year in a common year clamps to 28 February", function () {
  assert.deepStrictEqual(age.addYears(d(2000, 2, 29), 1), d(2001, 2, 28));
  assert.deepStrictEqual(age.addYears(d(2000, 2, 29), 3), d(2003, 2, 28));
});

test("29 February plus four years lands on 29 February", function () {
  assert.deepStrictEqual(age.addYears(d(2000, 2, 29), 4), d(2004, 2, 29));
});

// --- same-day and short spans ---
test("the same date is 0 years, 0 months and 0 days", function () {
  expectYMD(d(2000, 1, 15), d(2000, 1, 15), 0, 0, 0);
});

test("one day later is 0 years, 0 months and 1 day", function () {
  expectYMD(d(2000, 1, 15), d(2000, 1, 16), 0, 0, 1);
});

test("exactly one year later is 1 year, 0 months and 0 days", function () {
  expectYMD(d(2000, 1, 15), d(2001, 1, 15), 1, 0, 0);
});

test("the day before a birthday is 11 months and the leftover days", function () {
  // 15 Jan 2000 to 14 Jan 2001: last monthiversary is 15 Dec 2000, then 30 days
  expectYMD(d(2000, 1, 15), d(2001, 1, 14), 0, 11, 30);
});

test("month rollover across the year boundary", function () {
  expectYMD(d(1999, 12, 31), d(2000, 1, 1), 0, 0, 1);
  expectYMD(d(1999, 12, 31), d(2000, 12, 31), 1, 0, 0);
});

// --- 31 January age spans ---
test("31 January to 28 February in a common year is exactly one month", function () {
  expectYMD(d(2023, 1, 31), d(2023, 2, 28), 0, 1, 0);
});

test("31 January to 29 February in a leap year is exactly one month", function () {
  expectYMD(d(2024, 1, 31), d(2024, 2, 29), 0, 1, 0);
});

test("31 January to 1 March is one month and one day (anniversary was last day of February)", function () {
  expectYMD(d(2023, 1, 31), d(2023, 3, 1), 0, 1, 1);
  expectYMD(d(2024, 1, 31), d(2024, 3, 1), 0, 1, 1);
});

test("31 January to 31 March is exactly two months", function () {
  expectYMD(d(2023, 1, 31), d(2023, 3, 31), 0, 2, 0);
  expectYMD(d(2024, 1, 31), d(2024, 3, 31), 0, 2, 0);
});

test("31 May to 30 June is exactly one month; to 1 July is one month and one day", function () {
  expectYMD(d(2024, 5, 31), d(2024, 6, 30), 0, 1, 0);
  expectYMD(d(2024, 5, 31), d(2024, 7, 1), 0, 1, 1);
  expectYMD(d(2024, 5, 31), d(2024, 7, 31), 0, 2, 0);
});

// --- 29 February birthdays (civil anniversary is 1 March in a common year) ---
test("born 29 February 2000, on 28 February 2001 is not yet one year (anniversary is 1 March)", function () {
  expectYMD(d(2000, 2, 29), d(2001, 2, 28), 0, 11, 30);
});

test("born 29 February 2000, on 1 March 2001 is exactly one year", function () {
  expectYMD(d(2000, 2, 29), d(2001, 3, 1), 1, 0, 0);
});

test("born 29 February 2000, on 27 February 2001 is 11 months and 29 days", function () {
  expectYMD(d(2000, 2, 29), d(2001, 2, 27), 0, 11, 29);
});

test("born 29 February 2000, on 29 February 2004 is exactly four years", function () {
  expectYMD(d(2000, 2, 29), d(2004, 2, 29), 4, 0, 0);
});

test("born 29 February 2000, on 28 February 2004 is three years, 11 months and 27 days", function () {
  // Last anniversary is 1 March 2003; 1 March 2003 + 11 months = 1 February 2004;
  // 1 February 2004 to 28 February 2004 is 27 days. Turns 4 on 29 February 2004.
  expectYMD(d(2000, 2, 29), d(2004, 2, 28), 3, 11, 27);
});

test("born 29 February 2000, on 28 February 2005 is not yet five years (turns 5 on 1 March 2005)", function () {
  expectYMD(d(2000, 2, 29), d(2005, 2, 28), 4, 11, 30);
  expectYMD(d(2000, 2, 29), d(2005, 3, 1), 5, 0, 0);
});

// --- century leap edge ---
test("28 February 1900 to 1 March 1900 is one day (1900 is not a leap year)", function () {
  assert.strictEqual(age.isValidDate(d(1900, 2, 29)), false);
  expectYMD(d(1900, 2, 28), d(1900, 3, 1), 0, 0, 1);
  assert.strictEqual(age.totalDays(d(1900, 2, 28), d(1900, 3, 1)), 1);
});

test("28 February 2000 to 1 March 2000 is two days (2000 is a leap year)", function () {
  assert.strictEqual(age.totalDays(d(2000, 2, 28), d(2000, 3, 1)), 2);
  expectYMD(d(2000, 2, 28), d(2000, 3, 1), 0, 0, 2);
});

// --- totals ---
test("total days, weeks, months and hours for a known span", function () {
  var t = age.totals(d(2020, 1, 1), d(2021, 1, 1));
  assert.strictEqual(t.years, 1);
  assert.strictEqual(t.months, 0);
  assert.strictEqual(t.days, 0);
  assert.strictEqual(t.totalMonths, 12);
  assert.strictEqual(t.totalDays, 366); // 2020 is a leap year
  assert.strictEqual(t.totalWeeks, 52);
  assert.strictEqual(t.weekRemainder, 2); // 366 = 52*7 + 2
  assert.strictEqual(t.totalHours, 366 * 24);
  assert.strictEqual(t.totalMinutes, 366 * 24 * 60);
  assert.strictEqual(t.totalSeconds, 366 * 24 * 60 * 60);
});

test("total days from 1 January 2000 to 16 November 2026 is a Julian-day difference", function () {
  var days = age.totalDays(d(2000, 1, 1), d(2026, 11, 16));
  // Independent check via Date UTC
  var a = Date.UTC(2000, 0, 1);
  var b = Date.UTC(2026, 10, 16);
  assert.strictEqual(days, Math.round((b - a) / 86400000));
  var t = age.totals(d(2000, 1, 1), d(2026, 11, 16));
  assert.strictEqual(t.totalDays, days);
  assert.strictEqual(t.totalWeeks, Math.floor(days / 7));
  assert.strictEqual(t.totalHours, days * 24);
});

test("a common year is 365 days; a leap year is 366", function () {
  assert.strictEqual(age.totalDays(d(2023, 1, 1), d(2024, 1, 1)), 365);
  assert.strictEqual(age.totalDays(d(2024, 1, 1), d(2025, 1, 1)), 366);
});

// --- next birthday ---
test("next birthday is later this year if it has not occurred yet", function () {
  var n = age.nextBirthday(d(1990, 3, 15), d(2026, 11, 16));
  // 15 March 2026 has passed, so next is 15 March 2027
  assert.deepStrictEqual(n.date, d(2027, 3, 15));
  assert.strictEqual(n.isToday, false);
  assert.strictEqual(n.days, age.totalDays(d(2026, 11, 16), d(2027, 3, 15)));
});

test("next birthday is later this year if it is still ahead", function () {
  var n = age.nextBirthday(d(1990, 12, 25), d(2026, 11, 16));
  assert.deepStrictEqual(n.date, d(2026, 12, 25));
  assert.strictEqual(n.days, age.totalDays(d(2026, 11, 16), d(2026, 12, 25)));
});

test("on the birthday, the next birthday countdown is 0 days (today)", function () {
  var n = age.nextBirthday(d(1990, 11, 16), d(2026, 11, 16));
  assert.deepStrictEqual(n.date, d(2026, 11, 16));
  assert.strictEqual(n.days, 0);
  assert.strictEqual(n.isToday, true);
});

test("29 February birthday: next anniversary in a common year is 1 March", function () {
  var n = age.nextBirthday(d(2000, 2, 29), d(2001, 1, 1));
  assert.deepStrictEqual(n.date, d(2001, 3, 1));
  assert.strictEqual(n.days, age.totalDays(d(2001, 1, 1), d(2001, 3, 1)));
});

test("29 February birthday: on 1 March in a common year the countdown is 0; after that, next is 1 March or 29 February in a leap year", function () {
  var onDay = age.nextBirthday(d(2000, 2, 29), d(2001, 3, 1));
  assert.deepStrictEqual(onDay.date, d(2001, 3, 1));
  assert.strictEqual(onDay.isToday, true);
  var after = age.nextBirthday(d(2000, 2, 29), d(2001, 3, 2));
  assert.deepStrictEqual(after.date, d(2002, 3, 1));
  var inLeap = age.nextBirthday(d(2000, 2, 29), d(2003, 3, 2));
  assert.deepStrictEqual(inLeap.date, d(2004, 2, 29));
});

test("29 February birthday on 28 February of a common year is one day before the anniversary", function () {
  var n = age.nextBirthday(d(2000, 2, 29), d(2001, 2, 28));
  assert.deepStrictEqual(n.date, d(2001, 3, 1));
  assert.strictEqual(n.days, 1);
  assert.strictEqual(n.isToday, false);
});

// --- errors ---
test("as-of date before the start date returns an error", function () {
  var got = age.diffYMD(d(2000, 1, 1), d(1999, 12, 31));
  assert.ok(got.error);
  var t = age.totals(d(2000, 1, 1), d(1999, 12, 31));
  assert.ok(t.error);
  var n = age.nextBirthday(d(2000, 1, 1), d(1999, 12, 31));
  assert.ok(n.error);
});

test("invalid dates return an error", function () {
  var got = age.diffYMD(d(2023, 2, 29), d(2023, 3, 1));
  assert.ok(got.error);
});

// --- parser ---
test("flexible parser accepts ISO, day month year, month day year, day/month/year, and 3/15/95", function () {
  assert.deepStrictEqual(age.parseFlexibleDate("1995-03-15"), d(1995, 3, 15));
  assert.deepStrictEqual(age.parseFlexibleDate("15 March 1995"), d(1995, 3, 15));
  assert.deepStrictEqual(age.parseFlexibleDate("March 15, 1995"), d(1995, 3, 15));
  assert.deepStrictEqual(age.parseFlexibleDate("15/03/1995"), d(1995, 3, 15));
  assert.deepStrictEqual(age.parseFlexibleDate("15 Mar 1995"), d(1995, 3, 15));
  assert.deepStrictEqual(age.parseFlexibleDate("3/15/95"), d(1995, 3, 15));
  assert.deepStrictEqual(age.parseFlexibleDate("3/15/1995"), d(1995, 3, 15));
  assert.strictEqual(age.parseFlexibleDate("31 February 1995"), null);
  assert.strictEqual(age.parseFlexibleDate("not a date"), null);
  assert.strictEqual(age.parseFlexibleDate("29 February 2023"), null);
  assert.deepStrictEqual(age.parseFlexibleDate("29 February 2024"), d(2024, 2, 29));
});

test("format helpers", function () {
  assert.strictEqual(age.toISO(d(1995, 3, 15)), "1995-03-15");
  assert.strictEqual(age.formatDate(d(1995, 3, 15)), "15 March 1995");
  assert.strictEqual(age.formatYMD({ years: 1, months: 0, days: 1 }), "1 year, 0 months and 1 day");
  assert.strictEqual(age.formatYMD({ years: 0, months: 1, days: 0 }), "0 years, 1 month and 0 days");
});

// --- a worked long example ---
test("15 March 1995 to 16 November 2026 is 31 years, 8 months and 1 day", function () {
  // 15 March 1995 + 31 years = 15 March 2026
  // 15 March 2026 + 8 months = 15 November 2026
  // 15 November 2026 to 16 November 2026 = 1 day
  expectYMD(d(1995, 3, 15), d(2026, 11, 16), 31, 8, 1);
});


test("anniversary of 29 February is 1 March in a common year and 29 February in a leap year", function () {
  assert.deepStrictEqual(age.anniversaryInYear(d(2000, 2, 29), 2001), d(2001, 3, 1));
  assert.deepStrictEqual(age.anniversaryInYear(d(2000, 2, 29), 2004), d(2004, 2, 29));
  assert.deepStrictEqual(age.anniversaryInYear(d(1995, 3, 15), 2026), d(2026, 3, 15));
});

test("born 29 February 2000, on 16 November 2026 is 26 years, 8 months and 15 days", function () {
  expectYMD(d(2000, 2, 29), d(2026, 11, 16), 26, 8, 15);
});

test("chronological form is years;months;days", function () {
  var t = age.diffYMD(d(1995, 3, 15), d(2026, 11, 16));
  assert.strictEqual(age.formatChrono(t), "31;8;1");
});

test("Korean age: international years, year age, and se (plus one at New Year)", function () {
  var k = age.koreanAge(d(1995, 3, 15), d(2026, 11, 16));
  assert.strictEqual(k.international, 31);
  assert.strictEqual(k.yearAge, 31);
  assert.strictEqual(k.se, 32);
  var winter = age.koreanAge(d(1995, 12, 15), d(2026, 11, 16));
  assert.strictEqual(winter.international, 30);
  assert.strictEqual(winter.yearAge, 31);
  assert.strictEqual(winter.se, 32);
});

test("birth year window for someone aged 31 on 16 November 2026 is 17 Nov 1994 to 16 Nov 1995", function () {
  var w = age.birthWindowFromAge(31, d(2026, 11, 16));
  assert.deepStrictEqual(w.earliest, d(1994, 11, 17));
  assert.deepStrictEqual(w.latest, d(1995, 11, 16));
  assert.deepStrictEqual(w.years, [1994, 1995]);
});

test("dog years use size groups, not times seven", function () {
  assert.strictEqual(age.dogHumanYears(1, "medium").humanYears, 15);
  assert.strictEqual(age.dogHumanYears(2, "medium").humanYears, 24);
  assert.strictEqual(age.dogHumanYears(5, "small").humanYears, 36);
  assert.strictEqual(age.dogHumanYears(5, "medium").humanYears, 39);
  assert.strictEqual(age.dogHumanYears(5, "large").humanYears, 42);
  assert.strictEqual(age.dogHumanYears(5, "giant").humanYears, 45);
  assert.notStrictEqual(age.dogHumanYears(5, "medium").humanYears, 35);
});

test("cat years: 15 in year one, 24 in year two, then plus four", function () {
  assert.strictEqual(age.catHumanYears(1).humanYears, 15);
  assert.strictEqual(age.catHumanYears(2).humanYears, 24);
  assert.strictEqual(age.catHumanYears(6).humanYears, 40);
});

test("addDays inverse matches Julian day arithmetic", function () {
  assert.deepStrictEqual(age.addDays(d(2000, 2, 28), 1), d(2000, 2, 29));
  assert.deepStrictEqual(age.addDays(d(1900, 2, 28), 1), d(1900, 3, 1));
  assert.deepStrictEqual(age.addDays(d(2026, 11, 16), -31), d(2026, 10, 16));
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed) {
  process.exit(1);
}
