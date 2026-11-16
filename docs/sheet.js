/* Class sheet on /chronological-age: one test date, many children, printed on one A4 page. Nothing leaves the tab. */
(function () {
  'use strict';
  var A = window.AgeMaths, rows = document.getElementById('sheet-rows');
  if (!rows) return;
  var dateIn = document.getElementById('sheet-date');
  var lang = (navigator.language || 'en-GB');
  var ORDER = /^en-(US|PH)|^en$/.test(lang) && !/GB/.test(lang) ? 'MDY' : 'DMY';
  var zone = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Europe/London';
  var q = new URLSearchParams(location.search);
  if (q.get('tz')) zone = q.get('tz');
  function todayIn(tz) {
    try {
      var p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
      var g = function (k) { return +p.filter(function (x) { return x.type === k; })[0].value; };
      return { y: g('year'), m: g('month'), d: g('day') };
    } catch (e) { var n = new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }; }
  }
  function plain(t) { return t.d + ' ' + A.MONTHS[t.m - 1] + ' ' + t.y; }
  var today = todayIn(zone);
  if (q.get('today')) { var tq = A.parseDate(q.get('today'), { order: ORDER, pivotYear: today.y }); if (tq.ok) today = tq.date; }
  dateIn.value = plain(today);

  var formatHint = ORDER === 'MDY' ? 'month/day/year' : 'day/month/year';
  var formatExample = ORDER === 'MDY' ? 'e.g. 7/4/2018 or 4 July 2018' : 'e.g. 4/7/2018 or 4 July 2018';
  var dateLabel = document.querySelector('label[for="sheet-date"], .sheet-top label');
  /* Label the test date and the date-of-birth column so numeric dates are not ambiguous. */
  var testLab = document.querySelector('.sheet-top label:first-child');
  if (testLab && testLab.firstChild && testLab.firstChild.nodeType === 3) {
    testLab.firstChild.textContent = 'Test date (' + formatHint + ') ';
  }
  dateIn.setAttribute('placeholder', formatExample);
  var dobHead = document.querySelector('.sheet-table thead th:nth-child(2)');
  if (dobHead) dobHead.textContent = 'Date of birth (' + formatHint + ')';

  function addRow(name, dob) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><input type="text" aria-label="Name" placeholder="Name"></td><td><input type="text" aria-label="Date of birth, ' + formatHint + '" placeholder="' + formatExample + '"></td><td class="out"></td><td class="out m"></td>';
    var i = tr.querySelectorAll('input'); i[0].value = name || ''; i[1].value = dob || '';
    rows.appendChild(tr); calc();
    return i[0];
  }
  function calc() {
    var t = A.parseDate(dateIn.value, { order: ORDER, pivotYear: today.y, yearMode: 'nearest' });
    rows.querySelectorAll('tr').forEach(function (tr) {
      var b = A.parseDate(tr.querySelectorAll('input')[1].value, { order: ORDER, pivotYear: today.y, today: today, yearMode: 'past' }), out = tr.querySelector('.out'), m = tr.querySelector('.m');
      if (!t.ok || !b.ok) { out.textContent = b.code === 'empty' ? '' : (b.ok ? '' : '?'); m.textContent = ''; return; }
      var r = A.age(b.date, t.date);
      out.textContent = r.ok ? r.years + ';' + r.months + ';' + r.days : 'after test';
      m.textContent = r.ok ? r.totalMonths : '';
    });
  }
  document.querySelector('[data-sheet]').addEventListener('input', calc);
  document.getElementById('sheet-add').addEventListener('click', function () { addRow().focus(); });
  document.getElementById('sheet-print').addEventListener('click', function () { document.body.setAttribute('data-print', 'sheet'); window.print(); });
  window.addEventListener('afterprint', function () { document.body.removeAttribute('data-print'); });
  var demo = new URLSearchParams(location.search).get('demo');
  if (demo) {
    dateIn.value = '16 November 2026'; document.getElementById('sheet-group').value = 'Year 3, Oak class';
    [['Amira Hassan', '4 July 2018'], ['Ben Clarke', '29 February 2020'], ['Chloe Davies', '12/9/2017'], ['Dylan Murphy', '31 January 2018'], ['Ellie Novak', '2 November 2017'], ['Finn O’Neill', '18 May 2018']].forEach(function (r) { addRow(r[0], r[1]); });
  } else { for (var k = 0; k < 4; k++) addRow(); }
})();
