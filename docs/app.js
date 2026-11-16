/* agecalculator.com — page behaviour for every tool. Needs dates.js first.
   One file, no framework. Each page sets data-tool on [data-calc]; the matching function below renders the leaf. */
(function () {
  'use strict';
  var A = window.AgeMaths, M = A.MONTHS, W = A.WEEKDAYS;
  var root = document.querySelector('[data-calc]');
  if (!root) return;
  var tool = root.getAttribute('data-tool') || 'age', ready = false;
  var leaf = document.getElementById('leaf'), live = document.getElementById('live');
  var q = new URLSearchParams(location.search);
  var lang = (navigator.language || 'en-GB');
  var ORDER = /^en-(US|PH)|^en$/.test(lang) && !/GB/.test(lang) ? 'MDY' : 'DMY';
  var zone = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Europe/London';
  if (q.get('tz')) zone = q.get('tz');

  /* ---------- small helpers ---------- */
  var fmt = function (x) { return Math.round(x).toLocaleString('en-GB'); };
  var plural = function (k, w) { return fmt(k) + ' ' + w + (k === 1 ? '' : 's'); };
  var long = function (t) { return W[A.weekday(t.y, t.m, t.d)] + ' ' + t.d + ' ' + M[t.m - 1] + ' ' + t.y; };
  var plain = function (t) { return t.d + ' ' + M[t.m - 1] + ' ' + t.y; };
  var short = function (t) { return W[A.weekday(t.y, t.m, t.d)].slice(0, 3) + ' ' + t.d + ' ' + M[t.m - 1].slice(0, 3) + ' ' + t.y; };
  var same = function (a, b) { return a && b && a.y === b.y && a.m === b.m && a.d === b.d; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ymdWords = function (r) { return plural(r.years, 'year') + ', ' + plural(r.months, 'month') + ' and ' + plural(r.days, 'day'); };
  function ordinal(k) { var s = ['th', 'st', 'nd', 'rd'], v = k % 100; return k + (s[(v - 20) % 10] || s[v] || s[0]); }

  function todayIn(tz) {
    try {
      var p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
      var g = function (k) { return +p.filter(function (x) { return x.type === k; })[0].value; };
      return { y: g('year'), m: g('month'), d: g('day') };
    } catch (e) { var n = new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }; }
  }
  var today = todayIn(zone);
  if (q.get('today')) { var tq = A.parseDate(q.get('today')); if (tq.ok) today = tq.date; }  // for screenshots and tests

  /* A slightly uneven loop, like a biro ring round a date. */
  var RING = '<svg class="ring" viewBox="0 0 40 34" aria-hidden="true"><path d="M23 3.5C31 3.6 37.6 9 37 17.2 36.4 25.6 28.4 31 19.6 30.6 10.6 30.2 3 24.6 3.4 16.4 3.8 8.6 11 3.2 19.8 3.2c3.4 0 6.2.8 8.6 2.2"/></svg>';

  function monthGrid(y, m, hitDay, label) {
    var first = A.weekday(y, m, 1), dim = A.daysInMonth(y, m);
    var h = '<div class="month"><p class="month-name">' + M[m - 1] + ' <span>' + y + '</span></p><table><caption class="sr-only">' + esc(label) + '</caption><thead><tr>';
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(function (c, i) { h += '<th scope="col" abbr="' + W[i] + '">' + c + '</th>'; });
    h += '</tr></thead><tbody><tr>';
    for (var i = 0; i < first; i++) h += '<td></td>';
    for (var d = 1; d <= dim; d++) {
      var c = d === hitDay ? 'hit' : (y === today.y && m === today.m && d === today.d ? 'today' : '');
      h += '<td' + (c ? ' class="' + c + '"' : '') + '>' + d + (d === hitDay ? RING : '') + '</td>';
      if ((first + d) % 7 === 0 && d < dim) h += '</tr><tr>';
    }
    for (i = 0; i < (7 - ((first + dim) % 7)) % 7; i++) h += '<td></td>';
    return h + '</tr></tbody></table></div>';
  }
  function ledger(rows) {
    return '<dl class="ledger">' + rows.filter(Boolean).map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>';
  }
  var small = function (s) { return ' <small>' + s + '</small>'; };
  function head(s) { return '<div class="leaf-head"><span>' + s + '</span></div>'; }
  function big(num, unit, extraCls) {
    var cls = 'num' + (String(num).length > 4 ? ' long' : '') + (extraCls ? ' ' + extraCls : '');
    return '<p class="big"><span class="' + cls + '">' + num + '</span>' + (unit ? '<span class="unit">' + unit + '</span>' : '') + '</p>';
  }
  function body(leadHtml, sideHtml) { return '<div class="leaf-body"><div class="lead">' + leadHtml + '</div>' + (sideHtml ? '<div class="bday">' + sideHtml + '</div>' : '') + '</div>'; }
  function notice(title, msg, side) { return { state: 'notice', html: head(title) + body('<p class="msg">' + msg + '</p>', side) }; }

  /* ---------- date fields: a quick box that reads plain English, plus day / month / year boxes ---------- */
  var fields = {};
  document.querySelectorAll('[data-datefield]').forEach(function (el) {
    var name = el.getAttribute('data-datefield');
    var quick = el.querySelector('.quick'), parts = [el.querySelector('.p-d'), el.querySelector('.p-m'), el.querySelector('.p-y')];
    var read = el.querySelector('.readback');
    var f = { el: el, value: null, status: 'empty', message: '', alt: null };
    fields[name] = f;
    function show(text, kind, swap) {
      read.innerHTML = text + (swap ? ' <button type="button" class="textbtn swap">I meant ' + plain(swap) + '</button>' : '');
      read.className = 'readback' + (kind ? ' ' + kind : '');
      var sb = read.querySelector('.swap');
      if (sb) sb.addEventListener('click', function () { setDate(swap, true); quick.value = plain(swap); f.alt = null; show('Reading this as <b>' + long(swap) + '</b>.', 'ok'); go(); });
    }
    function setDate(d, fillParts) {
      f.value = d; f.status = d ? 'ok' : f.status;
      if (fillParts && d) { parts[0].value = String(d.d).padStart(2, '0'); parts[1].value = String(d.m).padStart(2, '0'); parts[2].value = d.y; }
    }
    function invalid(on) { quick.setAttribute('aria-invalid', String(!!on)); }
    quick.addEventListener('input', function () {
      var r = A.parseDate(quick.value, { order: ORDER, pivotYear: today.y });
      if (r.ok) {
        setDate(r.date, true); invalid(false);
        show('Reading this as <b>' + long(r.date) + '</b>.', 'ok', r.ambiguous ? r.alt : null);
      } else {
        f.value = null; f.status = r.code; f.message = r.message;
        invalid(r.code !== 'incomplete' && r.code !== 'empty');
        show(r.code === 'empty' ? '' : (r.message || 'Keep going…'), r.code === 'incomplete' || r.code === 'empty' ? '' : 'err');
      }
      go();
    });
    quick.addEventListener('blur', function () {
      if (f.status === 'incomplete' && quick.value.trim()) { invalid(true); show(f.message || 'That date isn’t finished. Try 15 March 1995.', 'err'); }
    });
    parts.forEach(function (p, i) {
      p.addEventListener('input', function () {
        p.value = p.value.replace(/\D/g, '').slice(0, i === 2 ? 4 : 2);
        var v = p.value, next = parts[i + 1];
        if (next && (v.length === 2 || (i === 0 && +v > 3) || (i === 1 && +v > 1))) { next.focus(); next.select(); }
        var r = A.validate(parts[0].value, parts[1].value, parts[2].value);
        parts.forEach(function (x, j) { x.setAttribute('aria-invalid', String(!r.ok && !!r.message && ['day', 'month', 'year'][j] === r.field)); });
        if (r.ok) { setDate(r.date); quick.value = plain(r.date); invalid(false); show('Reading this as <b>' + long(r.date) + '</b>.', 'ok'); }
        else { f.value = null; f.status = r.code; show(r.message, r.message ? 'err' : ''); }
        go();
      });
      p.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !p.value && i > 0) { e.preventDefault(); parts[i - 1].focus(); } });
    });
    f.set = function (d) { setDate(d, true); if (d) { quick.value = plain(d); show('Reading this as <b>' + long(d) + '</b>.', 'ok'); } };
    f.clearToToday = function () { f.set(today); };
    var pre = q.get(name);
    if (pre) { quick.value = pre; quick.dispatchEvent(new Event('input')); }
  });

  /* "Age on" date that defaults to today in a named time zone */
  var on = fields.on, onBox = document.getElementById('on-box'), onBtn = document.getElementById('on-toggle'), onLabel = document.getElementById('on-label');
  var zoneSel = document.getElementById('zone');
  function onDate() { return on && on.value ? on.value : today; }
  function refreshOnLabel() {
    if (!onLabel) return;
    var d = onDate(), idle = onLabel.getAttribute('data-idle');
    if (idle && onBox.hidden) { onLabel.textContent = idle; return; }
    onLabel.innerHTML = same(d, today) ? 'today, <b>' + plain(d) + '</b> <span class="zone">' + esc(zone) + '</span>' : '<b>' + long(d) + '</b>';
  }
  if (onBtn) onBtn.addEventListener('click', function () {
    var open = onBox.hidden;
    onBox.hidden = !open; onBtn.setAttribute('aria-expanded', String(open)); onBtn.textContent = open ? 'Use today' : 'Change';
    if (open) {
      if (!on.value) on.set(today);
      if (zoneSel && zoneSel.options.length < 3 && Intl.supportedValuesOf) {
        Intl.supportedValuesOf('timeZone').forEach(function (z) { if (z !== zone) { var o = document.createElement('option'); o.textContent = z; zoneSel.appendChild(o); } });
      }
      on.el.querySelector('.quick').focus();
    } else { on.value = null; }
    refreshOnLabel(); go();
  });
  if (zoneSel) {
    zoneSel.options[0].textContent = zone; zoneSel.value = zone;
    zoneSel.addEventListener('change', function () { var wasToday = !on.value || same(on.value, today); zone = zoneSel.value; today = todayIn(zone); if (wasToday) on.set(today); refreshOnLabel(); fillBirthYearTable(); go(); });
  }
  if (on && q.get('on')) { onBox.hidden = false; onBtn.setAttribute('aria-expanded', 'true'); onBtn.textContent = 'Use today'; }

  var $v = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var checked = function (n) { var e = document.querySelector('input[name="' + n + '"]:checked'); return e ? e.value : null; };

  /* ---------- tools ---------- */
  function ageCore(b, at, opts) {
    opts = opts || {};
    var r = A.age(b, at);
    if (!r.ok) return notice('Not born yet', long(b) + ' is ' + plural(r.daysUntil, 'day') + ' after ' + long(at) + '. Check the year, or change the “age on” date.', monthGrid(b.y, b.m, b.d, 'Date entered'));
    var nx = r.next, verb = A.cmp(at, today) > 0 ? 'will be' : A.cmp(at, today) < 0 ? 'were' : 'are';
    var bdayLine = nx.isToday
      ? '<span class="k">Birthday</span><strong>Today, ' + long(nx) + '</strong><br>Happy ' + ordinal(nx.turning) + ' birthday.'
      : '<span class="k">Next birthday</span><strong>' + long(nx) + '</strong><br>' + (verb === 'are' ? 'You’ll be ' : 'Turning ') + nx.turning + '. <em class="count">' + plural(nx.daysUntil, 'day') + '</em> to go.';
    var note = nx.shifted ? '<p class="bday-note">No 29 February in ' + nx.y + ', so the birthday counts on 1 March.</p>' : '';
    var lead = big(r.years, r.years === 1 ? 'year' : 'years') + '<p class="rest">' + plural(r.months, 'month') + ' and ' + plural(r.days, 'day') + '</p>';
    var kor = opts.korean ? A.koreanAges(b, at) : null;
    var rows = [
      ['Months', fmt(r.totalMonths) + (r.days ? small('and ' + plural(r.days, 'day')) : '')],
      ['Weeks', fmt(r.weeks) + (r.weekRemainder ? small('and ' + plural(r.weekRemainder, 'day')) : '')],
      ['Days', fmt(r.totalDays)],
      ['Hours', fmt(r.hours) + small('from midnight')],
      opts.chrono !== false ? ['Chronological age', r.years + ';' + r.months + ';' + r.days + small('<a href="chronological-age">for test forms</a>')] : null,
      ['Born on a', W[r.bornWeekday]],
      kor ? ['Korean age', kor.counting + small('year age ' + kor.yearAge + ', <a href="korean-age">why</a>')] : null
    ];
    var say = 'On ' + long(at) + ' you ' + verb + ' ' + ymdWords(r) + ' old. Next birthday ' + long(nx) + ', in ' + plural(nx.daysUntil, 'day') + '.';
    return { state: 'result', say: say, html: head('Age on <b>' + short(at) + '</b>') + body(lead, monthGrid(nx.y, nx.m, nx.d, 'Next birthday') + '<div><p class="bday-text">' + bdayLine + '</p>' + note + '</div>') + ledger(rows) };
  }
  function emptyToday(hint) {
    var at = onDate(), doy = A.dayOfYear(at.y, at.m, at.d);
    return { state: 'empty', html: head(same(at, today) ? 'Today' : 'Chosen date') + body(big(at.d, M[at.m - 1]) + '<p class="rest">' + W[A.weekday(at.y, at.m, at.d)] + ', day ' + doy + ' of ' + (A.isLeap(at.y) ? 366 : 365) + '</p><p class="hint">' + hint + '</p>', monthGrid(at.y, at.m, at.d, M[at.m - 1] + ' ' + at.y)) };
  }
  function needs(f) { return !f || !f.value; }
  function errOf(f, label) { return f && f.el.querySelector('.readback.err') ? notice('Check the ' + label, f.el.querySelector('.readback.err').textContent.replace(/I meant.*/, '')) : null; }

  var TOOLS = {
    age: function () {
      var b = fields.dob;
      if (needs(b)) return errOf(b, 'date') || emptyToday(document.body.classList.contains('widget')
        ? 'Type a date of birth to see your age in years, months and days.'
        : 'Type your date of birth. Your age, next birthday and the same figure in months, weeks and days appear here as you type.');
      return ageCore(b.value, onDate(), { korean: document.getElementById('show-korean') && document.getElementById('show-korean').checked });
    },
    past: function () {
      var b = fields.dob;
      if (needs(b)) return errOf(b, 'date') || emptyToday('Type a date of birth, then the date you want to look back to.');
      return ageCore(b.value, onDate());
    },
    future: function () {
      var b = fields.dob, yr = +$v('in-year');
      if (needs(b)) return errOf(b, 'date') || emptyToday('Type a date of birth, then a year or an exact date in the future.');
      if (on && on.value) return ageCore(b.value, on.value);
      if (!yr || String(yr).length !== 4 || yr < A.MIN_YEAR || yr > A.MAX_YEAR) return notice('Which year?', 'Type a year between ' + A.MIN_YEAR + ' and ' + A.MAX_YEAR + ', like 2050, or pick an exact date.');
      var bd = A.addMonths(b.value, 12 * (yr - b.value.y));
      if (yr < b.value.y) return notice('Before you were born', yr + ' is before ' + b.value.y + '.');
      var after = yr - b.value.y, before = Math.max(0, after - 1), at = { y: yr, m: 12, d: 31 };
      var html = head('In <b>' + yr + '</b>') + body(big(after, 'years old') + '<p class="rest">from ' + long(bd) + '. Before that, ' + before + '.</p>', monthGrid(bd.y, bd.m, bd.d, 'Birthday in ' + yr)) +
        ledger([['On 1 January ' + yr, plural(A.age(b.value, { y: yr, m: 1, d: 1 }).years, 'year')], ['On 31 December ' + yr, plural(A.age(b.value, at).years, 'year')], ['Days from today to that birthday', A.cmp(bd, today) > 0 ? fmt(A.cmp(bd, today)) : 'already passed'], ['Birthday falls on a', W[A.weekday(bd.y, bd.m, bd.d)]]]);
      return { state: 'result', html: html, say: 'In ' + yr + ' you turn ' + after + ' on ' + long(bd) + '.' };
    },
    countdown: function () {
      var b = fields.dob;
      if (needs(b)) return errOf(b, 'date') || emptyToday('Type a date of birth (yours, or someone you’re buying a card for).');
      var r = A.age(b.value, today);
      if (!r.ok) return notice('Not born yet', 'That date is after today.');
      var nx = r.next, n = nx.daysUntil;
      var lead = nx.isToday ? big('Today', '') + '<p class="rest">Happy ' + ordinal(nx.turning) + ' birthday.</p>'
        : big(fmt(n), n === 1 ? 'day to go' : 'days to go') + '<p class="rest">until ' + long(nx) + ', when ' + (fields.dob.el.querySelector('.who') ? '' : 'you turn ') + nx.turning + '.</p>';
      var rows = [['Weeks', fmt(Math.floor(n / 7)) + (n % 7 ? small('and ' + plural(n % 7, 'day')) : '')], ['Until midnight tonight', '<span data-clock>–</span>'], ['Weekend birthday?', (nx.weekday >= 5 ? 'Yes, a ' : 'No, a ') + W[nx.weekday]], ['Birthdays so far', fmt(r.years)]];
      var note = nx.shifted ? '<p class="bday-note">No 29 February in ' + nx.y + ', so we count down to 1 March.</p>' : '';
      return { state: 'result', say: n + ' days until ' + long(nx) + '.', html: head('Counting from <b>' + short(today) + '</b>') + body(lead, monthGrid(nx.y, nx.m, nx.d, 'Birthday') + note) + ledger(rows) };
    },
    difference: function () {
      var a = fields.a, b = fields.b, na = $v('name-a') || 'Person A', nb = $v('name-b') || 'Person B';
      if (needs(a) || needs(b)) return errOf(a, 'first date') || errOf(b, 'second date') || { state: 'empty', html: head('Age gap') + body('<p class="msg">Two birthdays in, one gap out.</p><p class="hint">Type both dates of birth. Names are optional and stay on this page.</p>') };
      var r = A.between(a.value, b.value);
      if (r.totalDays === 0) return notice('Same day', esc(na) + ' and ' + esc(nb) + ' were born on the same day.');
      var older = r.sign > 0 ? na : nb, younger = r.sign > 0 ? nb : na;
      var lead = big(r.years, r.years === 1 ? 'year' : 'years') + '<p class="rest">' + plural(r.months, 'month') + ' and ' + plural(r.days, 'day') + '</p>';
      var side = '<p class="bday-text"><span class="k">Older</span><strong>' + esc(older) + '</strong><br>by ' + plural(r.totalDays, 'day') + '.</p>';
      var rows = [['Days', fmt(r.totalDays)], ['Weeks', fmt(r.weeks) + (r.weekRemainder ? small('and ' + plural(r.weekRemainder, 'day')) : '')], ['Months', fmt(r.totalMonths) + (r.days ? small('and ' + plural(r.days, 'day')) : '')],
        ['Ages differ by', (r.months || r.days) ? r.years + ' or ' + (r.years + 1) + small('depending on the time of year') : r.years + small('all year')]];
      return { state: 'result', say: older + ' is older by ' + ymdWords(r) + '.', html: head('Age gap') + body(lead, side) + ledger(rows) };
    },
    between: function () {
      var a = fields.start, b = fields.end, inc = document.getElementById('inc-end').checked;
      if (needs(a) || needs(b)) return errOf(a, 'start date') || errOf(b, 'end date') || emptyToday('Type a start date and an end date. Words or numbers both work.');
      var r = A.between(a.value, b.value), days = r.totalDays + (inc ? 1 : 0);
      var lo = r.sign > 0 ? a.value : b.value, hi = r.sign > 0 ? b.value : a.value;
      var lead = big(fmt(days), days === 1 ? 'day' : 'days') + '<p class="rest">' + (r.years ? plural(r.years, 'year') + ', ' : '') + plural(r.months, 'month') + ' and ' + plural(r.days, 'day') + (inc ? ', plus the end day' : '') + '</p>';
      var rows = [['Weeks', fmt(Math.floor(days / 7)) + (days % 7 ? small('and ' + plural(days % 7, 'day')) : '')], ['Weekdays, Mon–Fri', fmt(r.weekdays + (inc && A.weekday(hi.y, hi.m, hi.d) < 5 ? 1 : 0)) + small('no bank holidays removed')],
        ['Weekend days', fmt(r.weekendDays + (inc && A.weekday(hi.y, hi.m, hi.d) >= 5 ? 1 : 0))], ['Months', fmt(r.totalMonths) + (r.days ? small('and ' + plural(r.days, 'day')) : '')], r.sign < 0 ? ['Order', 'End is before start; counted backwards'] : null];
      return { state: 'result', say: days + ' days between ' + plain(lo) + ' and ' + plain(hi) + '.', html: head('<b>' + short(lo) + '</b> to <b>' + short(hi) + '</b>') + body(lead, monthGrid(hi.y, hi.m, hi.d, 'End date')) + ledger(rows) };
    },
    chrono: function () {
      var b = fields.dob, t = fields.test, nm = $v('pupil');
      if (needs(b) || needs(t)) return errOf(b, 'date of birth') || errOf(t, 'test date') || { state: 'empty', html: head('Chronological age') + body('<p class="msg">Years; months; days on the test date.</p><p class="hint">Type the date of birth and the test date. The result is written the way most score forms ask for it, like 8;4;12.</p>') };
      var r = A.age(b.value, t.value);
      if (!r.ok) return notice('Check the dates', 'The test date is before the date of birth.');
      var code = r.years + ';' + r.months + ';' + r.days;
      var rounded = r.totalMonths + (r.days >= 15 ? 1 : 0);
      var lead = big(code, '', 'code') + '<p class="rest">' + ymdWords(r) + '</p>';
      var side = '<div class="slip-actions"><button type="button" class="btn" data-copy="' + code + '">Copy ' + code + '</button><button type="button" class="btn btn-quiet" data-print="slip">Print slip</button></div>';
      var rows = [['Pupil', nm ? esc(nm) : '<span class="muted">not given</span>'], ['Date of birth', plain(b.value)], ['Test date', plain(t.value)], ['Age in months', fmt(r.totalMonths) + small('and ' + plural(r.days, 'day'))], ['Months, rounding 15+ days up', fmt(rounded) + small('check your manual')]];
      return { state: 'result', say: 'Chronological age ' + ymdWords(r) + '.', html: head('Chronological age on <b>' + short(t.value) + '</b>') + body(lead, side) + ledger(rows) };
    },
    korean: function () {
      var b = fields.dob, at = onDate();
      if (needs(b)) return errOf(b, 'date') || emptyToday('Type a date of birth to see all three Korean ways of counting age side by side.');
      var k = A.koreanAges(b.value, at);
      if (!k.ok) return notice('Not born yet', 'That date is after ' + long(at) + '.');
      var lead = big(k.international, 'years') + '<p class="rest">international age, the legal one in Korea since 28 June 2023</p>';
      var side = '<p class="bday-text"><span class="k">Korean age (세는 나이)</span><strong class="mid">' + k.counting + '</strong></p><p class="bday-text"><span class="k">Year age (연 나이)</span><strong class="mid">' + k.yearAge + '</strong></p>';
      var rows = [['International', k.international + small('goes up on your birthday')], ['Korean counting age', k.counting + small('1 at birth, +1 every 1 January')], ['Year age', k.yearAge + small(at.y + ' − ' + b.value.y)], ['Next birthday', long(k.r.next)]];
      return { state: 'result', say: 'International age ' + k.international + ', Korean age ' + k.counting + ', year age ' + k.yearAge + '.', html: head('On <b>' + short(at) + '</b>') + body(lead, side) + ledger(rows) };
    },
    dog: function () { return pet('dog'); },
    cat: function () { return pet('cat'); },
    birthyear: function () {
      var a = $v('age-now'), had = checked('had'), at = onDate();
      if (!a) return { state: 'empty', html: head('Birth year') + body('<p class="msg">Your age in, your birth year out.</p><p class="hint">Type an age. If you’re not sure whether the birthday has happened yet, you get both possible years.</p>') };
      if (!/^\d{1,3}$/.test(a) || +a > 130) return notice('Check the age', 'Type an age in whole years, from 0 to 130.');
      var r = A.birthYear(+a, at, had === 'yes' ? true : had === 'no' ? false : null);
      var lead = big(r.years.join(' or '), '') + '<p class="rest">' + (r.years.length > 1 ? 'The first if your birthday is still to come in ' + at.y + ', the second if it has passed.' : 'If you are ' + a + ' on ' + plain(at) + '.') + '</p>';
      return { state: 'result', say: 'Born in ' + r.years.join(' or ') + '.', html: head('Age ' + esc(a) + ' on <b>' + short(at) + '</b>') + body(lead) };
    }
  };

  var CHART_SRC = 'https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/canine-life-stage-2019/canine_and_feline_age_chart_poster.pdf';
  function petChartNote(kind, r, size) {
    if (r.ok) return null;
    if (kind === 'dog' && r.code === 'below-chart') return 'The AAHA chart starts at 1 year for dogs, so this page doesn’t give an estimate under a year.';
    if (kind === 'cat' && r.code === 'below-chart') return 'The AAHA chart starts at 6 months for cats, so this page doesn’t give an estimate under that.';
    if (kind === 'dog' && size === 'giant') return 'The AAHA chart has no giant-breed figures beyond 16 years.';
    if (kind === 'dog') return 'The AAHA chart for this size goes up to ' + r.max + ' years, and this page doesn’t invent figures past that.';
    return 'The AAHA chart for cats goes up to 21 years, and this page doesn’t invent figures past that.';
  }
  function pet(kind) {
    var y = +$v('pet-y') || 0, mo = +$v('pet-m') || 0, size = checked('size') || 'medium';
    if (!$v('pet-y') && !$v('pet-m')) {
      var ages = [1, 2, 3, 5, 7, 10, 12, 15], tbl;
      if (kind === 'dog') tbl = '<tr><th scope="col">Dog</th><th scope="col">Small</th><th scope="col">Medium</th><th scope="col">Large</th><th scope="col">Giant</th></tr>' + ages.map(function (x) { return '<tr><td>' + x + '</td>' + ['small', 'medium', 'large', 'giant'].map(function (z) { var r = A.dogAge(x, z); return '<td>' + (r.ok ? fmt(r.human) : '–') + '</td>'; }).join('') + '</tr>'; }).join('');
      else tbl = '<tr><th scope="col">Cat</th><th scope="col">Human</th><th scope="col">Stage</th></tr>' + ages.map(function (x) { var r = A.catAge(x); return '<tr><td>' + x + '</td><td>' + (r.ok ? fmt(r.human) : '–') + '</td><td>' + A.catStage(x) + '</td></tr>'; }).join('');
      return { state: 'empty', html: head(kind === 'dog' ? 'Dog years at a glance' : 'Cat years at a glance') + '<table class="chart"><caption class="sr-only">Human years by age, from the AAHA-published chart</caption>' + tbl + '</table><p class="hint">Type your ' + kind + '’s age for an exact figure' + (kind === 'dog' ? ', and pick their adult size.' : '.') + ' Figures are from the <a href="' + CHART_SRC + '">AAHA-published pet age chart</a>.</p>' };
    }
    if (mo > 11) return notice('Check the age', 'Months go from 0 to 11. Over a year? Put the years in the first box.');
    var age = y + mo / 12, r = kind === 'dog' ? A.dogAge(age, size) : A.catAge(age);
    if (!r.ok) return notice('Not on the chart', petChartNote(kind, r, size));
    var aged = (y ? plural(y, 'year') : '') + (y && mo ? ' and ' : '') + (mo ? plural(mo, 'month') : '');
    var lead = big(fmt(r.human), 'in human years') + '<p class="rest">for a ' + (kind === 'dog' ? size + ' dog' : 'cat') + ' aged ' + aged + (r.interpolated ? small('interpolated between ' + r.from + ' and ' + r.to) : '') + '</p>';
    var src = '<a href="' + CHART_SRC + '">AAHA-published chart</a>';
    var rows = kind === 'dog'
      ? [['Source', src], r.interpolated ? ['Between chart ages', r.from + ' and ' + r.to + ' years'] : null, ['DNA-clock estimate', age >= 1 ? fmt(A.dogAgeEpigenetic(age)) + small('16 × ln(age) + 31, Wang et al. 2020') : '<span class="muted">not for under-ones</span>'], ['The old “× 7” rule', fmt(age * 7)]]
      : [['Source', src], ['Life stage', A.catStage(age) + small('AAHA/AAFP 2021')], ['The old “× 7” rule', fmt(age * 7)]];
    return { state: 'result', say: 'About ' + fmt(r.human) + ' in human years.', html: head(kind === 'dog' ? 'Dog years' : 'Cat years') + body(lead) + ledger(rows) };
  }

  /* ---------- render loop ---------- */
  var lastHtml = '', liveTimer;
  function go() {
    if (!ready) return;
    refreshOnLabel();
    var out = (TOOLS[tool] || TOOLS.age)();
    if (!out) return;
    if (out.html === lastHtml) return;
    var drew = out.state === 'result' && leaf.getAttribute('data-state') !== 'result';
    lastHtml = out.html;
    leaf.innerHTML = out.html;
    leaf.setAttribute('data-state', out.state);
    if (drew) { var ring = leaf.querySelector('.ring'); if (ring) ring.classList.add('draw'); }
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { live.textContent = out.say || ''; }, 700);
    tick();
    if (document.body.classList.contains('widget') && window.parent !== window) window.parent.postMessage({ agecalcHeight: document.documentElement.scrollHeight }, '*');
  }
  document.querySelectorAll('[data-calc] input:not(.quick):not(.p-d):not(.p-m):not(.p-y), [data-calc] select:not(#zone)').forEach(function (i) { i.addEventListener(i.type === 'checkbox' || i.type === 'radio' ? 'change' : 'input', go); });
  root.querySelectorAll('form').forEach(function (f) { f.addEventListener('submit', function (e) { e.preventDefault(); go(); }); });

  /* Countdown clock: the only thing on the site that ticks. */
  var clockTimer;
  function tick() {
    var c = leaf.querySelector('[data-clock]');
    clearTimeout(clockTimer);
    if (!c) return;
    var s, parts;
    try {
      parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      var g = function (k) { return +parts.filter(function (x) { return x.type === k; })[0].value; };
      s = 86400 - (g('hour') * 3600 + g('minute') * 60 + g('second'));
    } catch (e) {
      var now = new Date();
      s = 86400 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
    }
    if (s <= 0) s += 86400;
    var hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    c.textContent = hh + ' h ' + String(mm).padStart(2, '0') + ' m ' + String(ss).padStart(2, '0') + ' s';
    clockTimer = setTimeout(tick, 1000);
  }

  /* Copy and print for the chronological-age slip */
  leaf.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'), p = e.target.closest('[data-print]');
    if (c && navigator.clipboard) navigator.clipboard.writeText(c.getAttribute('data-copy')).then(function () { c.textContent = 'Copied'; setTimeout(function () { c.textContent = 'Copy ' + c.getAttribute('data-copy'); }, 1600); });
    if (p) { document.body.setAttribute('data-print', 'slip'); window.print(); }
  });
  window.addEventListener('afterprint', function () { document.body.removeAttribute('data-print'); });

  /* /past?year=1990 prefill: 1 January of that year, said out loud in the UI */
  if (tool === 'past' && q.get('year') && on) {
    var yy = +q.get('year');
    if (yy > 1000 && yy < 3000) { onBox.hidden = false; onBtn.setAttribute('aria-expanded', 'true'); onBtn.textContent = 'Use today'; on.set({ y: yy, m: 1, d: 1 }); var yn = document.getElementById('year-note'); if (yn) { yn.hidden = false; yn.textContent = 'You came here from a ' + yy + ' link, so the date is set to 1 January ' + yy + '. Change it to any day you like.'; } }
  }


  function fillBirthYearTable() {
    var box = document.querySelector('.years[data-years]');
    if (!box) return;
    var y = today.y;
    box.setAttribute('data-years', String(y));
    var heading = document.getElementById('birth-year-heading');
    if (heading) heading.textContent = 'Age and birth year in ' + y;
var blocks = [[1, 25], [26, 50], [51, 75], [76, 100]];
    box.innerHTML = blocks.map(function (r) {
      var rows = [];
      for (var a = r[0]; a <= r[1]; a++) rows.push('<tr' + (a === 31 ? ' class="this"' : '') + '><td>' + a + '</td><td>' + (y - a - 1) + ' or ' + (y - a) + '</td></tr>');
      return '<table><caption>Ages ' + r[0] + '–' + r[1] + '</caption><tbody>' + rows.join('') + '</tbody></table>';
    }).join('');
  }
  fillBirthYearTable();
  window.AgeCalcPage = { go: go, fields: fields, setToday: function (d) { today = d; fillBirthYearTable(); go(); } };
  ready = true;
  go();
})();
