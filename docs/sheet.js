/* Class sheet on /chronological-age: one test date, many children, printed on one A4 page. Nothing leaves the tab. */
(function () {
  'use strict';
  var A = window.AgeMaths, rows = document.getElementById('sheet-rows');
  if (!rows) return;
  var dateIn = document.getElementById('sheet-date');
  var n = new Date(); dateIn.value = n.getDate() + ' ' + A.MONTHS[n.getMonth()] + ' ' + n.getFullYear();
  function addRow(name, dob) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td><input type="text" aria-label="Name" placeholder="Name"></td><td><input type="text" aria-label="Date of birth" placeholder="e.g. 4/7/2018"></td><td class="out"></td><td class="out m"></td>';
    var i = tr.querySelectorAll('input'); i[0].value = name || ''; i[1].value = dob || '';
    rows.appendChild(tr); calc();
    return i[0];
  }
  function calc() {
    var t = A.parseDate(dateIn.value);
    rows.querySelectorAll('tr').forEach(function (tr) {
      var b = A.parseDate(tr.querySelectorAll('input')[1].value), out = tr.querySelector('.out'), m = tr.querySelector('.m');
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
