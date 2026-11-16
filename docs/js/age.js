/**
 * Civil-date age arithmetic for the agecalculator.com preview.
 * All functions use calendar dates { y, m, d } (month is 1–12).
 * They do not use the JavaScript Date month-overflow rules.
 *
 * Month-end rule: a date that does not exist is clamped to the last
 * day of that month. So 31 January plus one month is 28 February
 * (or 29 February in a leap year), not 3 March.
 *
 * 29 February birthdays: in a common year the civil anniversary is
 * 1 March (UK/US usual convention), not 28 February. This is the
 * rule implemented below, as specified for agecalculator.com.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AgeMath = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  var MONTH_SHORT = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"
  ];

  function isLeap(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  function daysInMonth(year, month) {
    if (month === 2) return isLeap(year) ? 29 : 28;
    return [0, 31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
  }

  function isValidDate(date) {
    if (!date || typeof date.y !== "number" || typeof date.m !== "number" || typeof date.d !== "number") {
      return false;
    }
    if (!Number.isInteger(date.y) || !Number.isInteger(date.m) || !Number.isInteger(date.d)) {
      return false;
    }
    if (date.y < 1 || date.y > 9999) return false;
    if (date.m < 1 || date.m > 12) return false;
    if (date.d < 1) return false;
    return date.d <= daysInMonth(date.y, date.m);
  }

  function date(y, m, d) {
    return { y: y, m: m, d: d };
  }

  function clampDay(year, month, day) {
    var dim = daysInMonth(year, month);
    return date(year, month, day > dim ? dim : day);
  }

  function compare(a, b) {
    if (a.y !== b.y) return a.y - b.y;
    if (a.m !== b.m) return a.m - b.m;
    return a.d - b.d;
  }

  function equal(a, b) {
    return a.y === b.y && a.m === b.m && a.d === b.d;
  }

  function addMonths(start, months) {
    var total = (start.y * 12 + (start.m - 1)) + months;
    var year = Math.floor(total / 12);
    var month = (total % 12) + 1;
    if (month <= 0) {
      year -= 1;
      month += 12;
    }
    return clampDay(year, month, start.d);
  }

  function addYears(start, years) {
    return clampDay(start.y + years, start.m, start.d);
  }

  /**
   * The civil anniversary of a date in a given year.
   * A 29 February birthday falls on 1 March in a common year.
   */
  function anniversaryInYear(birth, year) {
    if (birth.m === 2 && birth.d === 29 && !isLeap(year)) {
      return date(year, 3, 1);
    }
    return date(year, birth.m, birth.d);
  }

  /**
   * Add months from a start date, using the January 31 clamp,
   * except that a 29 February start plus a whole number of years
   * in a common year lands on 1 March, not 28 February.
   */
  function addMonthsForAge(start, months) {
    var result = addMonths(start, months);
    if (start.m === 2 && start.d === 29 && result.m === 2 && result.d === 28 && !isLeap(result.y)) {
      return date(result.y, 3, 1);
    }
    return result;
  }

  function toJulian(dateObj) {
    var y = dateObj.y;
    var m = dateObj.m;
    var d = dateObj.d;
    var a = Math.floor((14 - m) / 12);
    var y2 = y + 4800 - a;
    var m2 = m + 12 * a - 3;
    return (
      d +
      Math.floor((153 * m2 + 2) / 5) +
      365 * y2 +
      Math.floor(y2 / 4) -
      Math.floor(y2 / 100) +
      Math.floor(y2 / 400) -
      32045
    );
  }

  function totalDays(from, to) {
    return toJulian(to) - toJulian(from);
  }

  function addDays(start, days) {
    var j = toJulian(start) + days;
    // Inverse of the JDN formula used above (Fliegel / Van Flandern style).
    var l = j + 68569;
    var n = Math.floor((4 * l) / 146097);
    l = l - Math.floor((146097 * n + 3) / 4);
    var i = Math.floor((4000 * (l + 1)) / 1461001);
    l = l - Math.floor((1461 * i) / 4) + 31;
    var j2 = Math.floor((80 * l) / 2447);
    var d = l - Math.floor((2447 * j2) / 80);
    l = Math.floor(j2 / 11);
    var m = j2 + 2 - 12 * l;
    var y = 100 * (n - 49) + i + l;
    return date(y, m, d);
  }

  /**
   * Exact age as complete years, months and leftover days.
   * Years use the 1 March convention for 29 February birthdays.
   * Months after the last anniversary use the January 31 clamp.
   */
  function diffYMDFromStart(from, to) {
    if (!isValidDate(from) || !isValidDate(to)) {
      return { error: "Enter a valid calendar date." };
    }
    if (compare(to, from) < 0) {
      return { error: "The as-of date is before the start date." };
    }
    var years = 0;
    while (compare(anniversaryInYear(from, from.y + years + 1), to) <= 0) {
      years += 1;
    }
    var last = years === 0 ? from : anniversaryInYear(from, from.y + years);
    var months = 0;
    while (compare(addMonthsForAge(last, months + 1), to) <= 0) {
      months += 1;
    }
    var afterMonths = addMonthsForAge(last, months);
    var days = totalDays(afterMonths, to);
    return { years: years, months: months, days: days };
  }

  function totals(from, to) {
    var ymd = diffYMDFromStart(from, to);
    if (ymd.error) return ymd;
    var days = totalDays(from, to);
    var weeksWhole = Math.floor(days / 7);
    var weekRemainder = days % 7;
    return {
      years: ymd.years,
      months: ymd.months,
      days: ymd.days,
      totalMonths: ymd.years * 12 + ymd.months,
      totalWeeks: weeksWhole,
      weekRemainder: weekRemainder,
      totalDays: days,
      totalHours: days * 24,
      totalMinutes: days * 24 * 60,
      totalSeconds: days * 24 * 60 * 60
    };
  }

  function nextBirthday(birth, asOf) {
    if (!isValidDate(birth) || !isValidDate(asOf)) {
      return { error: "Enter a valid calendar date." };
    }
    if (compare(asOf, birth) < 0) {
      return { error: "The as-of date is before the date of birth." };
    }
    var thisYear = anniversaryInYear(birth, asOf.y);
    var upcoming = compare(thisYear, asOf) >= 0 ? thisYear : anniversaryInYear(birth, asOf.y + 1);
    var days = totalDays(asOf, upcoming);
    var ymd = diffYMDFromStart(asOf, upcoming);
    return {
      date: upcoming,
      days: days,
      months: ymd.months,
      leftoverDays: ymd.days,
      isToday: days === 0
    };
  }

  function todayLocal() {
    var now = new Date();
    return date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function timeZoneName() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
    } catch (e) {
      return "local time";
    }
  }

  function fromISO(iso) {
    if (!iso || typeof iso !== "string") return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
    if (!m) return null;
    var d = date(Number(m[1]), Number(m[2]), Number(m[3]));
    return isValidDate(d) ? d : null;
  }

  function toISO(dateObj) {
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    return dateObj.y + "-" + pad(dateObj.m) + "-" + pad(dateObj.d);
  }

  function formatDate(dateObj) {
    if (!isValidDate(dateObj)) return "";
    return dateObj.d + " " + MONTH_NAMES[dateObj.m - 1] + " " + dateObj.y;
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function formatYMD(ymd) {
    return plural(ymd.years, "year") + ", " + plural(ymd.months, "month") + " and " + plural(ymd.days, "day");
  }

  function formatChrono(ymd) {
    return ymd.years + ";" + ymd.months + ";" + ymd.days;
  }

  function monthIndex(name) {
    var key = name.toLowerCase().slice(0, 3);
    var i = MONTH_SHORT.indexOf(key);
    return i === -1 ? 0 : i + 1;
  }

  function expandYear(year) {
    if (year < 100) return year <= 26 ? 2000 + year : 1900 + year;
    return year;
  }

  function parseFlexibleDate(input) {
    if (input == null) return null;
    var s = String(input).trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
    if (!s) return null;

    var iso = fromISO(s);
    if (iso) return iso;

    var slash = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(s);
    if (slash) {
      var first = Number(slash[1]);
      var second = Number(slash[2]);
      var year = expandYear(Number(slash[3]));
      var parsed;
      if (first > 12 && second <= 12) parsed = date(year, second, first);
      else if (second > 12 && first <= 12) parsed = date(year, first, second);
      else parsed = date(year, second, first);
      return isValidDate(parsed) ? parsed : null;
    }

    var dMonthY = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/.exec(s);
    if (dMonthY) {
      var month = monthIndex(dMonthY[2]);
      if (!month) return null;
      parsed = date(Number(dMonthY[3]), month, Number(dMonthY[1]));
      return isValidDate(parsed) ? parsed : null;
    }

    var monthDY = /^([a-z]+)\s+(\d{1,2})\s+(\d{4})$/.exec(s);
    if (monthDY) {
      month = monthIndex(monthDY[1]);
      if (!month) return null;
      parsed = date(Number(monthDY[3]), month, Number(monthDY[2]));
      return isValidDate(parsed) ? parsed : null;
    }

    return null;
  }

  function koreanAge(birth, asOf) {
    var t = totals(birth, asOf);
    if (t.error) return t;
    var yearAge = asOf.y - birth.y;
    return {
      international: t.years,
      yearAge: yearAge,
      se: yearAge + 1,
      ymd: t
    };
  }

  function birthWindowFromAge(age, asOf) {
    if (!Number.isInteger(age) || age < 0 || age > 120 || !isValidDate(asOf)) {
      return { error: "Enter a whole age in years, and a valid date." };
    }
    var latest = anniversaryInYear(date(asOf.y, asOf.m, asOf.d), asOf.y - age);
    var before = anniversaryInYear(date(asOf.y, asOf.m, asOf.d), asOf.y - age - 1);
    var earliest = addDays(before, 1);
    var years = [];
    var y;
    for (y = earliest.y; y <= latest.y; y += 1) years.push(y);
    return { earliest: earliest, latest: latest, years: years, age: age, asOf: asOf };
  }

  function dogHumanYears(dogYears, size) {
    var later = { small: 4, medium: 5, large: 6, giant: 7 }[size];
    if (later == null || typeof dogYears !== "number" || dogYears < 0 || dogYears > 40) {
      return { error: "Enter a dog age and a size group." };
    }
    var human;
    if (dogYears <= 1) human = 15 * dogYears;
    else if (dogYears <= 2) human = 15 + 9 * (dogYears - 1);
    else human = 24 + later * (dogYears - 2);
    return { dogYears: dogYears, size: size, humanYears: Math.round(human * 10) / 10 };
  }

  function catHumanYears(catYears) {
    if (typeof catYears !== "number" || catYears < 0 || catYears > 40) {
      return { error: "Enter a cat age in years." };
    }
    var human;
    if (catYears <= 1) human = 15 * catYears;
    else if (catYears <= 2) human = 15 + 9 * (catYears - 1);
    else human = 24 + 4 * (catYears - 2);
    return { catYears: catYears, humanYears: Math.round(human * 10) / 10 };
  }

  return {
    isLeap: isLeap,
    daysInMonth: daysInMonth,
    isValidDate: isValidDate,
    date: date,
    clampDay: clampDay,
    compare: compare,
    equal: equal,
    addMonths: addMonths,
    addYears: addYears,
    addDays: addDays,
    anniversaryInYear: anniversaryInYear,
    addMonthsForAge: addMonthsForAge,
    toJulian: toJulian,
    totalDays: totalDays,
    diffYMD: diffYMDFromStart,
    totals: totals,
    nextBirthday: nextBirthday,
    todayUTC: todayLocal,
    todayLocal: todayLocal,
    timeZoneName: timeZoneName,
    fromISO: fromISO,
    toISO: toISO,
    formatDate: formatDate,
    formatYMD: formatYMD,
    formatChrono: formatChrono,
    plural: plural,
    parseFlexibleDate: parseFlexibleDate,
    expandYear: expandYear,
    koreanAge: koreanAge,
    birthWindowFromAge: birthWindowFromAge,
    dogHumanYears: dogHumanYears,
    catHumanYears: catHumanYears,
    MONTH_NAMES: MONTH_NAMES
  };
});
