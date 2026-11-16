/* agecalculator.com — date maths. Pure functions, no Date objects in the arithmetic.
   Works in the browser (window.AgeMaths) and in Node (require). */
(function (root) {
  'use strict';
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var MIN_YEAR = 1000, MAX_YEAR = 2999;

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(y, m) { return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }

  /* Days since 1970-01-01 for a proleptic Gregorian date (Howard Hinnant's days_from_civil). */
  function dayNumber(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    var era = Math.floor(y / 400);
    var yoe = y - era * 400;
    var mp = (m + 9) % 12;
    var doy = Math.floor((153 * mp + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  /* 0 = Monday … 6 = Sunday. 1970-01-01 was a Thursday (3). */
  function weekday(y, m, d) { return (((dayNumber(y, m, d) + 3) % 7) + 7) % 7; }
  function dayOfYear(y, m, d) { return dayNumber(y, m, d) - dayNumber(y, 1, 1) + 1; }
  function cmp(a, b) { return dayNumber(a.y, a.m, a.d) - dayNumber(b.y, b.m, b.d); }

  /* Add n whole months. If that day doesn't exist in the target month, the anniversary is the 1st of the
     following month. This is the usual UK/US civil convention for 29 February birthdays (you turn a year
     older on 1 March in a common year), applied the same way to month-ends (31 Jan + 1 month = 1 Mar). */
  function addMonths(date, n) {
    var t = date.m - 1 + n;
    var y = date.y + Math.floor(t / 12);
    var m = (((t % 12) + 12) % 12) + 1;
    if (date.d <= daysInMonth(y, m)) return { y: y, m: m, d: date.d };
    return m === 12 ? { y: y + 1, m: 1, d: 1 } : { y: y, m: m + 1, d: 1 };
  }

  /* Validate raw field values (strings or numbers). Returns {ok, date} or {ok:false, field, code, message}. */
  function validate(d, m, y) {
    var s = [d, m, y].map(function (v) { return String(v == null ? '' : v).trim(); });
    if (!s[0] && !s[1] && !s[2]) return { ok: false, code: 'empty', field: null, message: '' };
    if (!/^\d{1,2}$/.test(s[0])) return { ok: false, code: s[0] ? 'day' : 'incomplete', field: 'day', message: s[0] ? 'Day should be a number from 1 to 31.' : '' };
    if (!/^\d{1,2}$/.test(s[1])) return { ok: false, code: s[1] ? 'month' : 'incomplete', field: 'month', message: s[1] ? 'Month should be a number from 1 to 12.' : '' };
    if (!/^\d{1,4}$/.test(s[2])) return { ok: false, code: s[2] ? 'year' : 'incomplete', field: 'year', message: s[2] ? 'Year should be four digits, like 1988.' : '' };
    var dn = +s[0], mn = +s[1], yn = +s[2];
    if (s[2].length < 4) return { ok: false, code: 'incomplete', field: 'year', message: '' };
    if (mn < 1 || mn > 12) return { ok: false, code: 'month', field: 'month', message: 'Month should be a number from 1 to 12.' };
    if (yn < MIN_YEAR || yn > MAX_YEAR) return { ok: false, code: 'year', field: 'year', message: 'Use a year between ' + MIN_YEAR + ' and ' + MAX_YEAR + '.' };
    if (dn < 1) return { ok: false, code: 'day', field: 'day', message: 'Day should be a number from 1 to 31.' };
    var dim = daysInMonth(yn, mn);
    if (dn > dim) {
      var msg = (mn === 2 && dn === 29)
        ? yn + ' wasn’t a leap year, so February had 28 days.'
        : MONTHS[mn - 1] + (mn === 2 ? ' ' + yn : '') + ' has ' + dim + ' days.';
      return { ok: false, code: 'day', field: 'day', message: msg };
    }
    return { ok: true, date: { y: yn, m: mn, d: dn } };
  }

  /* Exact age of someone born on `b`, measured on `at`. */
  function age(b, at) {
    var diff = cmp(at, b);
    if (diff < 0) return { ok: false, code: 'future', daysUntil: -diff };
    // Whole months: largest n with addMonths(b, n) <= at. Estimate, then correct.
    var n = (at.y - b.y) * 12 + (at.m - b.m);
    if (n < 0) n = 0;
    while (n > 0 && cmp(addMonths(b, n), at) > 0) n--;
    while (cmp(addMonths(b, n + 1), at) <= 0) n++;
    var anchor = addMonths(b, n);
    var years = Math.floor(n / 12);
    var next = addMonths(b, 12 * years);
    var isBirthday = cmp(next, at) === 0 && n % 12 === 0;
    if (!isBirthday) next = addMonths(b, 12 * (years + 1));
    var totalDays = diff;
    return {
      ok: true,
      years: years,
      months: n % 12,
      days: cmp(at, anchor),
      totalMonths: n,
      totalDays: totalDays,
      weeks: Math.floor(totalDays / 7),
      weekRemainder: totalDays % 7,
      hours: totalDays * 24,
      bornWeekday: weekday(b.y, b.m, b.d),
      next: {
        y: next.y, m: next.m, d: next.d,
        weekday: weekday(next.y, next.m, next.d),
        daysUntil: cmp(next, at),
        turning: isBirthday ? years : years + 1,
        isToday: isBirthday,
        shifted: next.d !== b.d || next.m !== b.m   // 29 Feb birthday moved to 1 Mar in a common year
      }
    };
  }


  /* Gap between two dates in either order: same parts as age(), plus weekday counts. */
  function between(a, b) {
    var sign = cmp(b, a) < 0 ? -1 : 1;
    var lo = sign < 0 ? b : a, hi = sign < 0 ? a : b;
    var r = age(lo, hi);
    var total = r.totalDays, full = Math.floor(total / 7), rem = total % 7, wd = full * 5;
    var start = weekday(lo.y, lo.m, lo.d);
    for (var i = 0; i < rem; i++) if ((start + i) % 7 < 5) wd++;
    r.sign = sign; r.weekdays = wd; r.weekendDays = total - wd;  // counts lo inclusive, hi exclusive
    return r;
  }

  /* Korean counting systems, as used socially in South Korea. International age is the legal one from 28 June 2023. */
  function koreanAges(b, at) {
    var r = age(b, at);
    if (!r.ok) return r;
    return { ok: true, international: r.years, counting: at.y - b.y + 1, yearAge: at.y - b.y, r: r };
  }

  /* Pet ages. Rule of thumb: year one = 15 human years, year two = +9, then a fixed amount per year.
     Dogs: the per-year amount rises with adult size. Cats: +4 per year. ageYears may be fractional. */
  var DOG_STEP = { small: 4, medium: 5, large: 6, giant: 7 };
  function petHumanYears(ageYears, step) {
    if (ageYears <= 1) return 15 * ageYears;
    if (ageYears <= 2) return 15 + 9 * (ageYears - 1);
    return 24 + step * (ageYears - 2);
  }
  function dogAge(ageYears, size) { return petHumanYears(ageYears, DOG_STEP[size] || 5); }
  /* Wang et al. 2020 (Cell Systems), epigenetic clock fitted on Labrador retrievers: 16 ln(dog age) + 31. Not meaningful under 1 year. */
  function dogAgeEpigenetic(ageYears) { return ageYears >= 1 ? 16 * Math.log(ageYears) + 31 : null; }
  function catAge(ageYears) { return petHumanYears(ageYears, 4); }
  /* AAHA/AAFP 2021 feline life stages. */
  function catStage(ageYears) { return ageYears < 1 ? 'Kitten' : ageYears < 7 ? 'Young adult' : ageYears < 11 ? 'Mature adult' : 'Senior'; }

  /* Birth year from an age on a given date. hadBirthday: true, false, or null for "not sure". */
  function birthYear(ageNow, at, hadBirthday) {
    var y = at.y - ageNow;
    if (hadBirthday === true) return { years: [y] };
    if (hadBirthday === false) return { years: [y - 1] };
    return { years: [y - 1, y] };
  }

  /* Natural-language date entry: "15 March 1995", "March 15, 1995", "15th mar 95", "3/15/95", "15.03.1995",
     "1995-03-15", "15031995". order: 'DMY' or 'MDY' decides only genuinely ambiguous all-number dates.
     Two-digit years resolve to the most recent year that isn't after pivotYear. */
  var MONTH_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/;
  function parseDate(text, opts) {
    opts = opts || {};
    var order = opts.order || 'DMY', pivot = opts.pivotYear || 2026;
    var t = String(text || '').toLowerCase()
      .replace(/(\d)(st|nd|rd|th)\b/g, '$1')
      .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/g, ' ')
      .replace(/\bof\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ').trim();
    if (!t) return { ok: false, code: 'empty', message: '' };
    var tok = t.split(' ');
    if (tok.length === 1 && /^\d{8}$/.test(tok[0])) {
      var s8 = tok[0];
      if (/^(1|2)\d{3}/.test(s8) && validate(s8.slice(6), s8.slice(4, 6), s8.slice(0, 4)).ok) tok = [s8.slice(0, 4), s8.slice(4, 6), s8.slice(6)];
      else tok = [s8.slice(0, 2), s8.slice(2, 4), s8.slice(4)];
    }
    var month = null, nums = [], words = 0;
    tok.forEach(function (w) {
      if (/^\d+$/.test(w)) nums.push(w);
      else { var mm = w.match(MONTH_RE); if (mm && month === null) month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(mm[1]) + 1; else words++; }
    });
    if (words) return { ok: false, code: 'unreadable', message: 'Try a date like 15 March 1995 or 15/03/1995.' };
    var d, m, y, ambiguous = false, alt = null;
    if (month !== null) {
      m = month;
      if (nums.length < 2) return { ok: false, code: 'incomplete', message: nums.length ? 'Add the ' + (nums[0].length > 2 ? 'day' : 'year') + '.' : '' };
      if (nums.length > 2) return { ok: false, code: 'unreadable', message: 'Try a date like 15 March 1995.' };
      if (nums[0].length > 2) { y = nums[0]; d = nums[1]; } else { d = nums[0]; y = nums[1]; }
    } else {
      if (nums.length < 3) return { ok: false, code: 'incomplete', message: '' };
      if (nums.length > 3) return { ok: false, code: 'unreadable', message: 'Try a date like 15/03/1995.' };
      if (nums[0].length > 2) { y = nums[0]; m = nums[1]; d = nums[2]; }
      else {
        y = nums[2];
        var a = +nums[0], b = +nums[1];
        if (a > 12 && b <= 12) { d = a; m = b; }
        else if (b > 12 && a <= 12) { m = a; d = b; }
        else if (order === 'MDY') { m = a; d = b; ambiguous = a !== b; }
        else { d = a; m = b; ambiguous = a !== b; }
      }
    }
    if (/^\d{1,2}$/.test(String(y))) {
      var yy = +y, century = Math.floor(pivot / 100) * 100;
      y = century + yy > pivot ? century - 100 + yy : century + yy;
    } else if (String(y).length === 3) return { ok: false, code: 'incomplete', message: '' };
    var v = validate(d, m, y);
    if (!v.ok) return v;
    if (ambiguous) { var vAlt = validate(m, d, y); if (vAlt.ok) alt = vAlt.date; }
    return { ok: true, date: v.date, ambiguous: ambiguous && !!alt, alt: alt };
  }

  var api = { MONTHS: MONTHS, WEEKDAYS: WEEKDAYS, MIN_YEAR: MIN_YEAR, MAX_YEAR: MAX_YEAR,
    isLeap: isLeap, daysInMonth: daysInMonth, dayNumber: dayNumber, weekday: weekday,
    dayOfYear: dayOfYear, addMonths: addMonths, validate: validate, age: age, cmp: cmp,
    between: between, koreanAges: koreanAges, dogAge: dogAge, dogAgeEpigenetic: dogAgeEpigenetic, DOG_STEP: DOG_STEP,
    catAge: catAge, catStage: catStage, birthYear: birthYear, parseDate: parseDate };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.AgeMaths = api;
})(this);
