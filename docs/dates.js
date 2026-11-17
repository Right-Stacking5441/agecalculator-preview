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
     following month. This matches the Scottish statutory rule for 29 February birthdays (Age of Legal Capacity (Scotland) Act 1991 s6(2)); England & Wales and NI statutes don't name a date (you turn a year
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
    if (!/^\d{1,2}$/.test(s[0])) return { ok: false, code: s[0] ? 'day' : 'incomplete', field: 'day', message: s[0] ? 'Day should be a number from 1 to 31.' : 'Add the day.' };
    if (!/^\d{1,2}$/.test(s[1])) return { ok: false, code: s[1] ? 'month' : 'incomplete', field: 'month', message: s[1] ? 'Month should be a number from 1 to 12.' : 'Add the month.' };
    if (!/^\d{1,4}$/.test(s[2])) return { ok: false, code: s[2] ? 'year' : 'incomplete', field: 'year', message: s[2] ? 'Year should be four digits, like 1988.' : 'Add the year.' };
    var dn = +s[0], mn = +s[1], yn = +s[2];
    if (s[2].length < 4) return { ok: false, code: 'incomplete', field: 'year', message: s[2].length ? 'Year should be four digits, like 1988.' : '' };
    if (mn < 1 || mn > 12) return { ok: false, code: 'month', field: 'month', message: 'Month should be a number from 1 to 12.' };
    if (yn < MIN_YEAR || yn > MAX_YEAR) return { ok: false, code: 'year', field: 'year', message: 'Use a year between ' + MIN_YEAR + ' and ' + MAX_YEAR + '.' };
    if (dn < 1) return { ok: false, code: 'day', field: 'day', message: 'There’s no day 0. Check the day.' };
    var dim = daysInMonth(yn, mn);
    if (dn > dim) {
      var msg = (mn === 2 && dn === 29)
        ? yn + ' wasn’t a leap year, so it had no 29 February.'
        : MONTHS[mn - 1] + ' only has ' + dim + ' days.';
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

  /* Korean counting systems, as used socially in South Korea. International age is the default in Korean law from 28 June 2023. */
  function koreanAges(b, at) {
    var r = age(b, at);
    if (!r.ok) return r;
    return { ok: true, international: r.years, counting: at.y - b.y + 1, yearAge: at.y - b.y, r: r };
  }

  /* Pet ages from the AAHA-hosted Zoetis poster (2019):
     https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/canine-life-stage-2019/canine_and_feline_age_chart_poster.pdf
     Every human-year figure is taken from the printed chart. Between two neighbouring
     chart ages we interpolate linearly. Ages below the first chart point, above the
     last, or on a dash (giant dogs after 16) are refused, not invented. */
  var DOG_SIZES = {
    small:  { label: 'small',  lbs: '21 lb',        kg: 'up to 9.5 kg',      band: 'up to 9.5 kg (21 lb)' },
    medium: { label: 'medium', lbs: '21 to 51 lb',  kg: '9.5 to 23.1 kg',    band: '9.5 to 23.1 kg (21 to 51 lb)' },
    large:  { label: 'large',  lbs: '51 to 90 lb',  kg: '23.1 to 40.8 kg',   band: '23.1 to 40.8 kg (51 to 90 lb)' },
    giant:  { label: 'giant',  lbs: 'over 90 lb',   kg: 'over 40.8 kg',      band: 'over 40.8 kg (over 90 lb)' }
  };
  var DOG_CHART = {
    small:  [[1,15],[2,24],[3,28],[4,32],[5,36],[6,40],[7,44],[8,48],[9,52],[10,56],[11,60],[12,64],[13,68],[14,72],[15,76],[16,80],[17,84],[18,88],[19,92],[20,96]],
    medium: [[1,15],[2,24],[3,28],[4,33],[5,37],[6,42],[7,47],[8,51],[9,56],[10,60],[11,65],[12,69],[13,74],[14,78],[15,83],[16,87],[17,92],[18,96],[19,101],[20,105]],
    large:  [[1,15],[2,24],[3,30],[4,35],[5,40],[6,45],[7,50],[8,55],[9,61],[10,66],[11,72],[12,77],[13,82],[14,88],[15,93],[16,99],[17,104],[18,109],[19,115],[20,120]],
    giant:  [[1,15],[2,24],[3,32],[4,37],[5,42],[6,49],[7,56],[8,64],[9,71],[10,78],[11,86],[12,93],[13,101],[14,108],[15,115],[16,123]]
  };
  var CAT_CHART = [[0.5,10],[1,15],[2,24],[3,28],[4,32],[5,36],[6,40],[7,44],[8,48],[9,52],[10,56],[11,60],[12,64],[13,68],[14,72],[15,76],[16,80],[17,84],[18,88],[19,92],[20,96],[21,100]];

  function lookupChart(points, ageYears) {
    if (ageYears == null || isNaN(ageYears) || ageYears < 0) return { ok: false, code: 'invalid' };
    var first = points[0], last = points[points.length - 1];
    if (ageYears < first[0] - 1e-9) return { ok: false, code: 'below-chart', min: first[0], max: last[0] };
    if (ageYears > last[0] + 1e-9) return { ok: false, code: 'above-chart', min: first[0], max: last[0] };
    for (var i = 0; i < points.length; i++) {
      if (Math.abs(points[i][0] - ageYears) < 1e-9) return { ok: true, human: points[i][1], interpolated: false };
      if (i + 1 < points.length && ageYears > points[i][0] && ageYears < points[i + 1][0]) {
        var a0 = points[i][0], h0 = points[i][1], a1 = points[i + 1][0], h1 = points[i + 1][1];
        return { ok: true, human: h0 + (h1 - h0) * (ageYears - a0) / (a1 - a0), interpolated: true, from: a0, to: a1 };
      }
    }
    return { ok: false, code: 'no-value' };
  }
  function dogAge(ageYears, size) {
    size = DOG_CHART[size] ? size : 'medium';
    var r = lookupChart(DOG_CHART[size], ageYears);
    r.size = size;
    return r;
  }
  function catAge(ageYears) { return lookupChart(CAT_CHART, ageYears); }
  /* Wang, T., et al. 2020, Cell Systems: human_age = 16 × ln(dog_age) + 31, natural log.
     Not shown under 1 year (a log of a number below 1 is not meaningful here). */
  function dogAgeEpigenetic(ageYears) { return ageYears >= 1 ? 16 * Math.log(ageYears) + 31 : null; }
  /* 2021 AAHA/AAFP Feline Life Stage Guidelines: kitten birth–1, young adult 1–6,
     mature adult 7–10, senior over 10. */
  function catStage(ageYears) {
    if (ageYears < 1) return 'Kitten';
    if (ageYears < 7) return 'Young adult';
    if (ageYears <= 10) return 'Mature adult';
    return 'Senior';
  }

  /* Birth year from an age on a given date. hadBirthday: true, false, or null for "not sure". */
  function birthYear(ageNow, at, hadBirthday) {
    var y = at.y - ageNow;
    if (hadBirthday === true) return { years: [y] };
    if (hadBirthday === false) return { years: [y - 1] };
    return { years: [y - 1, y] };
  }

  /* Natural-language date entry: "15 March 1995", "March 15, 1995", "15th mar 95", "3/15/95", "15.03.1995",
     "1995-03-15", "15031995". order: 'DMY' or 'MDY' decides only genuinely ambiguous all-number dates.
     Two-digit years: yearMode 'past' (default) is the most recent year that isn't after
     today (opts.today). If the completed date would be
     later than today, it falls back to the previous century (17/11/26 on 16 Nov 2026
     is 1926). yearMode 'nearest' picks the closer of this century and the last
     (target / future dates). A one-digit year is incomplete, not silently 2000. */
  var MONTH_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/;
  var MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december'];
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
    var month = null, nums = [], words = 0, monthPrefix = false;
    tok.forEach(function (w) {
      if (/^\d+$/.test(w)) nums.push(w);
      else {
        var mm = w.match(MONTH_RE);
        if (mm && month === null) month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(mm[1]) + 1;
        else if (MONTH_NAMES.some(function (name) { return name.indexOf(w) === 0; })) monthPrefix = true;
        else words++;
      }
    });
    if (words) return { ok: false, code: 'unreadable', message: 'That doesn’t look like a date. Try something like 18 May 1995.' };
    if (monthPrefix && month === null) return { ok: false, code: 'incomplete', message: '' };
    var d, m, y, ambiguous = false, alt = null;
    if (month !== null) {
      m = month;
      if (nums.length < 2) return { ok: false, code: 'incomplete', message: nums.length ? 'Add the ' + (nums[0].length > 2 ? 'day' : 'year') + '.' : '' };
      if (nums.length > 2) return { ok: false, code: 'unreadable', message: 'That doesn’t look like a date. Try something like 18 May 1995.' };
      if (nums[0].length > 2) { y = nums[0]; d = nums[1]; } else { d = nums[0]; y = nums[1]; }
    } else {
      if (nums.length < 3) return { ok: false, code: 'incomplete', message: nums.length === 2 ? (nums[1].length >= 3 ? 'Add the month.' : 'Add the year.') : '' };
      if (nums.length > 3) return { ok: false, code: 'unreadable', message: 'That doesn’t look like a date. Try something like 18 May 1995.' };
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
    if (/^\d$/.test(String(y)) || String(y).length === 3) {
      return { ok: false, code: 'incomplete', field: 'year', message: 'Year should be four digits, like 1988.' };
    }
    var twoDigitLast = null;
    if (/^\d{2}$/.test(String(y))) {
      var yy = +y, century = Math.floor(pivot / 100) * 100;
      var thisCent = century + yy, lastCent = century - 100 + yy;
      if (opts.yearMode === 'nearest') {
        var dThis = Math.abs(thisCent - pivot), dLast = Math.abs(lastCent - pivot);
        y = (dThis < dLast || (dThis === dLast && thisCent >= pivot)) ? thisCent : lastCent;
      } else {
        y = thisCent > pivot ? lastCent : thisCent;
        if (y === thisCent && lastCent >= MIN_YEAR) twoDigitLast = lastCent;
      }
    }
    var v = validate(d, m, y);
    if (!v.ok) {
      v.parts = { d: d, m: m, y: y };
      return v;
    }
    var today = opts.today;
    if (twoDigitLast != null && today && cmp(v.date, today) > 0) {
      var vLast = validate(d, m, twoDigitLast);
      if (vLast.ok) { v = vLast; y = twoDigitLast; }
    }
    if (ambiguous) { var vAlt = validate(m, d, y); if (vAlt.ok) alt = vAlt.date; }
    return { ok: true, date: v.date, ambiguous: ambiguous && !!alt, alt: alt };
  }


  /* Instant of a wall-clock time in a named zone, and seconds until the next
     midnight there (handles 23- and 25-hour DST days). */
  function zoneParts(date, tz) {
    var p = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23'
    }).formatToParts(date);
    var g = function (k) { return +p.filter(function (x) { return x.type === k; })[0].value; };
    return { y: g('year'), m: g('month'), d: g('day'), hour: g('hour'), minute: g('minute'), second: g('second') };
  }
  function instantInZone(tz, y, m, d, hour, minute, second) {
    var guess = Date.UTC(y, m - 1, d, hour, minute, second);
    for (var i = 0; i < 8; i++) {
      var p = zoneParts(new Date(guess), tz);
      var asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute, p.second);
      var target = Date.UTC(y, m - 1, d, hour, minute, second);
      var diff = target - asUtc;
      if (diff === 0) break;
      guess += diff;
    }
    return guess;
  }
  function nextMidnight(tz, now) {
    now = now instanceof Date ? now : new Date(now);
    var p = zoneParts(now, tz);
    var nxt = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
    return instantInZone(tz, nxt.getUTCFullYear(), nxt.getUTCMonth() + 1, nxt.getUTCDate(), 0, 0, 0);
  }
  function secondsUntilMidnight(tz, now) {
    now = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    var ms = nextMidnight(tz, now) - now.getTime();
    var s = Math.ceil(ms / 1000);
    return s < 0 ? 0 : s;
  }
  /* Real elapsed milliseconds / whole hours to a local-time midnight
     `daysAhead` calendar days from `now` in `tz` (handles 23- and 25-hour DST days). */
  function msUntilLocalMidnight(tz, now, daysAhead) {
    now = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    daysAhead = +daysAhead || 0;
    if (daysAhead <= 0) return 0;
    var p = zoneParts(now, tz);
    var day = new Date(Date.UTC(p.y, p.m - 1, p.d + daysAhead));
    var target = instantInZone(tz, day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), 0, 0, 0);
    var ms = target - now.getTime();
    return ms < 0 ? 0 : ms;
  }
  function hoursUntilLocalMidnight(tz, now, daysAhead) {
    return Math.floor(msUntilLocalMidnight(tz, now, daysAhead) / 3600000);
  }


  /* Last and next birthday around `at`. On a birthday the two would otherwise
     be the same date (age().next is that day). In that case "next" is the
     following year's birthday, and the label marks the day itself. */
  function birthdayBounds(b, at) {
    var r = age(b, at);
    if (!r.ok) return r;
    var onBirthday = r.next.isToday;
    var last = onBirthday ? { y: r.next.y, m: r.next.m, d: r.next.d } : addMonths(b, 12 * r.years);
    var next;
    if (onBirthday) {
      var n = addMonths(b, 12 * (r.years + 1));
      next = {
        y: n.y, m: n.m, d: n.d,
        weekday: weekday(n.y, n.m, n.d),
        daysUntil: cmp(n, at),
        turning: r.years + 1,
        isToday: false,
        shifted: n.d !== b.d || n.m !== b.m
      };
    } else {
      next = r.next;
    }
    return {
      ok: true,
      onBirthday: onBirthday,
      bornDay: onBirthday && r.years === 0,
      last: last,
      next: next,
      lastLabel: onBirthday ? 'Birthday on that date' : (r.years === 0 ? 'Born' : 'Birthday before'),
      nextLabel: 'Birthday after',
      years: r.years,
      months: r.months,
      days: r.days,
      r: r
    };
  }


  /* Age just before and after the birthday in a given calendar year.
     1 January of the birth year is "not born yet" when the birthday is later. */
  function ageInCalendarYear(b, yr) {
    yr = +yr;
    if (!yr || yr < MIN_YEAR || yr > MAX_YEAR) return { ok: false, code: 'year' };
    if (yr < b.y) return { ok: false, code: 'before-birth' };
    var first = addMonths(b, 12);
    if (yr === b.y) {
      var jan = { y: yr, m: 1, d: 1 };
      var dec = { y: yr, m: 12, d: 31 };
      return {
        ok: true,
        bornYear: true,
        after: 0,
        before: 0,
        firstBirthday: first,
        birthday: first,
        jan1: cmp(jan, b) < 0 ? null : age(b, jan),
        dec31: age(b, dec)
      };
    }
    var after = yr - b.y;
    return {
      ok: true,
      bornYear: false,
      after: after,
      before: after - 1,
      birthday: addMonths(b, 12 * after),
      firstBirthday: first,
      jan1: age(b, { y: yr, m: 1, d: 1 }),
      dec31: age(b, { y: yr, m: 12, d: 31 })
    };
  }

  /* When international (만) age next goes up, as a sentence. r.next.isToday means
     the chosen date is a birthday, not that it is calendar today. On the day of
     birth, international age is still 0 and goes up on the first birthday. */
  function koreanIntlUpSentence(r, at, today, formatDate) {
    if (r.next.isToday && r.years > 0) {
      if (cmp(at, today) === 0) return 'International age went up today.';
      if (cmp(at, today) > 0) return 'International age goes up on that day.';
      return 'International age went up on that day.';
    }
    var next = r.next;
    if (r.next.isToday && r.years === 0) next = addMonths({ y: next.y, m: next.m, d: next.d }, 12);
    return 'International age goes up on ' + formatDate(next) + '.';
  }

  /* When Korean age and year age (세는 / 연) next go up — every 1 January.
     If the chosen date is itself 1 January, say they already went up that day
     (or will, if that 1 January is still in the future). Born on 1 January:
     year age is still 0, so both go up on the next New Year. */
  function koreanCountingUpSentence(r, at, today, formatDate) {
    if (at.m === 1 && at.d === 1) {
      if (r.years === 0 && r.months === 0 && r.days === 0) {
        return 'Korean age and year age go up on ' + formatDate({ y: at.y + 1, m: 1, d: 1 }) + '.';
      }
      if (cmp(at, today) === 0) return 'Korean age and year age went up today.';
      if (cmp(at, today) > 0) return 'Korean age and year age go up on that day.';
      return 'Korean age and year age went up on that day.';
    }
    var ny = { y: at.y + 1, m: 1, d: 1 };
    var days = cmp(ny, at);
    return 'Korean age and year age go up on ' + formatDate(ny) + ', in ' + days + ' ' + (days === 1 ? 'day' : 'days') + '.';
  }

  function yearsOldUnit(n) { return n === 1 ? 'year old' : 'years old'; }

  /* Non-zero years, months and days, with correct plurals, e.g. "1 month and 2 days". */
  function partsWords(years, months, days) {
    function part(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
    var parts = [];
    if (years) parts.push(part(years, 'year'));
    if (months) parts.push(part(months, 'month'));
    if (days) parts.push(part(days, 'day'));
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] + ' and ' + parts[1];
    return parts[0] + ', ' + parts[1] + ' and ' + parts[2];
  }

  /* Whole years and months only. Rejects ".", "abc", "1e1", negatives. */
  function parsePetAge(yStr, mStr) {
    yStr = String(yStr == null ? '' : yStr).trim();
    mStr = String(mStr == null ? '' : mStr).trim();
    if (!yStr && !mStr) return { ok: false, code: 'empty', message: '' };
    if ((yStr && !/^\d+$/.test(yStr)) || (mStr && !/^\d+$/.test(mStr))) {
      return { ok: false, code: 'invalid', message: 'Type the age in whole years and months, like 3 and 6. Fractions and words aren’t read.' };
    }
    var y = yStr ? +yStr : 0, mo = mStr ? +mStr : 0;
    if (mo > 11) return { ok: false, code: 'months', message: 'Months go from 0 to 11. Over a year? Put the years in the first box.' };
    return { ok: true, years: y, months: mo, age: y + mo / 12 };
  }


  /* Plain text for the one-box field, given the day/month/year box values.
     Invalid or incomplete boxes still return a raw d/m/y string so typed values are not wiped. */
  function textFromParts(d, m, y) {
    var r = validate(d, m, y);
    if (!r.ok) {
      var raw = [d, m, y].map(function (v) { return String(v == null ? '' : v).trim(); }).filter(Boolean).join('/');
      return { ok: false, text: raw, code: r.code, message: r.message || '', field: r.field || null };
    }
    return { ok: true, text: r.date.d + ' ' + MONTHS[r.date.m - 1] + ' ' + r.date.y, date: r.date };
  }

  var api = { MONTHS: MONTHS, WEEKDAYS: WEEKDAYS, MIN_YEAR: MIN_YEAR, MAX_YEAR: MAX_YEAR,
    isLeap: isLeap, daysInMonth: daysInMonth, dayNumber: dayNumber, weekday: weekday,
    dayOfYear: dayOfYear, addMonths: addMonths, validate: validate, age: age, cmp: cmp, birthdayBounds: birthdayBounds,
    between: between, koreanAges: koreanAges, dogAge: dogAge, dogAgeEpigenetic: dogAgeEpigenetic,
    DOG_CHART: DOG_CHART, CAT_CHART: CAT_CHART, DOG_SIZES: DOG_SIZES,
    catAge: catAge, catStage: catStage, birthYear: birthYear, parseDate: parseDate, textFromParts: textFromParts,
    ageInCalendarYear: ageInCalendarYear, yearsOldUnit: yearsOldUnit, partsWords: partsWords, parsePetAge: parsePetAge,
    koreanIntlUpSentence: koreanIntlUpSentence, koreanCountingUpSentence: koreanCountingUpSentence,
    secondsUntilMidnight: secondsUntilMidnight, nextMidnight: nextMidnight, instantInZone: instantInZone,
    msUntilLocalMidnight: msUntilLocalMidnight, hoursUntilLocalMidnight: hoursUntilLocalMidnight };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.AgeMaths = api;
})(this);
