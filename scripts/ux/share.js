/* agecalculator.com: copy, share and print for every result, plus each tool's resting view (ux-share proposal, 16 Nov 2026).
   Runs after app.js. Reads the rendered result card; never changes the maths.
   - Tap any figure in the card to copy just that figure.
   - The quiet row under the card: Copy (the answer), Copy all (plain text), Share link (Web Share on touch, copy link elsewhere), Print.
   - Share links restore the inputs (ISO dates; names never go in the URL). */
(function () {
  'use strict';
  var A = window.AgeMaths, leaf = document.getElementById('leaf'), acts = document.querySelector('.acts');
  if (!A || !leaf || !acts) return;
  var M = A.MONTHS, W = A.WEEKDAYS;
  var page = document.body.getAttribute('data-page') || 'home';
  var canon = (document.querySelector('link[rel=canonical]') || {}).href || location.href.split('?')[0];
  var say = document.getElementById('copy-live');
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var canShare = touch && typeof navigator.share === 'function';
  var qs = new URLSearchParams(location.search);
  var COPY = '<svg class="ic ic-copy" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8.7 8.4l10.4.1-.1 12H8.6zM15.3 8.3V4.2L4.9 4.3l-.1 12.1h3.7"/></svg>';
  var TICK = '<svg class="ic ic-tick" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M4.6 12.8c1.5 1.3 2.9 2.7 4.1 4.3 3.1-4.2 6.5-8 10.6-11.2"/></svg>';
  var RING = '<svg class="ring" viewBox="0 0 40 34" aria-hidden="true"><path d="M23 3.5C31 3.6 37.6 9 37 17.2 36.4 25.6 28.4 31 19.6 30.6 10.6 30.2 3 24.6 3.4 16.4 3.8 8.6 11 3.2 19.8 3.2c3.4 0 6.2.8 8.6 2.2"/></svg>';
  var txt = function (el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  var iso = function (d) { return d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0'); };
  var shortD = function (d) { return W[A.weekday(d.y, d.m, d.d)].slice(0, 3) + ' ' + d.d + ' ' + M[d.m - 1].slice(0, 3) + ' ' + d.y; };
  var ORDER = /^en-(US|PH)|^en$/.test(navigator.language || '') && !/GB/.test(navigator.language || '') ? 'MDY' : 'DMY';
  var today = (function () { var t = qs.get('today') && A.parseDate(qs.get('today'), { order: ORDER }); if (t && t.ok) return t.date; var n = new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }; })();

  /* ---- what each page takes, for the share link and the copied text ---- */
  var CFG = {
    home: { dates: [['dob', 'Date of birth']] }, past: { dates: [['dob', 'Date of birth'], ['on', 'On']] },
    difference: { dates: [['a', 'First date of birth'], ['b', 'Second date of birth']] },
    'days-between-dates': { dates: [['start', 'From'], ['end', 'To']], checks: [['inc-end', 'inc']] },
    'chronological-age': { dates: [['dob', 'Date of birth'], ['test', 'Test date']] },
    'dog-age': { vals: [['pet-y', 'age', 'Age in years'], ['pet-m', 'months', 'Months']], radios: [['size', 'size', 'Adult size']] },
    'cat-age': { vals: [['pet-y', 'age', 'Age in years'], ['pet-m', 'months', 'Months']] },
    'korean-age': { dates: [['dob', 'Date of birth']] }, 'birthday-countdown': { dates: [['dob', 'Date of birth']] },
    'how-old-will-i-be': { dates: [['dob', 'Date of birth']], vals: [['in-year', 'in', 'In the year']] },
    'what-year-was-i-born': { vals: [['age-now', 'age', 'Age']], radios: [['had', 'had', 'Birthday been yet this year?']] }
  }[page] || { dates: [['dob', 'Date of birth']] };
  CFG.dates = CFG.dates || []; CFG.vals = CFG.vals || []; CFG.radios = CFG.radios || []; CFG.checks = CFG.checks || [];
  function fieldDate(name) {
    var box = document.querySelector('[data-datefield="' + name + '"] .quick');
    if (!box || !box.value.trim()) return null;
    var r = A.parseDate(box.value, { order: ORDER, pivotYear: today.y, today: today, yearMode: /^(on|start|end|test)$/.test(name) ? 'nearest' : 'past' });
    return r.ok ? r.date : null;
  }
  var val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var radio = function (n) { var e = document.querySelector('input[name="' + n + '"]:checked'); return e ? e.value : ''; };
  function shareUrl() {
    var p = new URLSearchParams();
    CFG.dates.forEach(function (f) { if (f[0] === 'on' && page === 'home') return; var d = fieldDate(f[0]); if (d) p.set(f[0], iso(d)); });
    var onBox = document.getElementById('on-box'), on = fieldDate('on');
    if (page === 'home' && on && onBox && !onBox.hidden) p.set('on', iso(on));
    CFG.vals.forEach(function (v) { if (val(v[0])) p.set(v[1], val(v[0])); });
    CFG.radios.forEach(function (r) { if (radio(r[0])) p.set(r[1], radio(r[0])); });
    CFG.checks.forEach(function (c) { var e = document.getElementById(c[0]); if (e && e.checked) p.set(c[1], '1'); });
    var z = document.getElementById('zone'), def = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (z && z.value && z.value !== def) p.set('tz', z.value);
    var s = p.toString();
    return canon + (s ? '?' + s : '');
  }
  /* restore what app.js doesn't read itself, and show ISO dates the way people write them */
  CFG.dates.concat([['on']]).forEach(function (f) {
    var v = qs.get(f[0]), box = document.querySelector('[data-datefield="' + f[0] + '"] .quick'), m = v && /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m && box) box.value = (+m[3]) + ' ' + M[+m[2] - 1] + ' ' + m[1];
  });
  var changed = null;
  CFG.vals.forEach(function (v) { var e = document.getElementById(v[0]), q = qs.get(v[1]); if (e && q && /^\d{1,4}$/.test(q)) { e.value = q; changed = e; } });
  CFG.radios.forEach(function (r) { var q = qs.get(r[1]), e = q && document.querySelector('input[name="' + r[0] + '"][value="' + q.replace(/[^a-z]/g, '') + '"]'); if (e) { e.checked = true; changed = e; } });
  CFG.checks.forEach(function (c) { var e = document.getElementById(c[0]); if (e && qs.get(c[1]) === '1') { e.checked = true; changed = e; } });
  if (changed) { changed.dispatchEvent(new Event('input', { bubbles: true })); changed.dispatchEvent(new Event('change', { bubbles: true })); }

  /* ---- the answer and the whole card as plain text ---- */
  var unitOf = function () { var u = leaf.querySelector('.big .unit'); return u ? ' ' + txt(u) : ''; };
  var numOf = function () { var n = leaf.querySelector('.big .num'); return n ? (n.getAttribute('data-n') || txt(n)) : ''; };
  var restOf = function () { return txt(leaf.querySelector('.big ~ .rest, .lead .rest, .slip-answer .rest, .pair-say .rest, .span-say .rest, .rec-result .rest')).replace(/\.$/, ''); };
  function headline() {
    var n = numOf() + unitOf(), r = restOf();
    switch (page) {
      case 'home': case 'past': return n + (r ? ', ' + r : '');
      case 'birthday-countdown': return n + (r ? ' ' + r : '');
      case 'difference': return numOf() + unitOf() + ', ' + r.replace(/\. /, '. ');
      case 'chronological-age': return numOf() + ' (' + r + ')';
      case 'korean-age': return Array.prototype.map.call(leaf.querySelectorAll('.kcol'), function (c) { return txt(c.querySelector('.k-en')) + ' ' + txt(c.querySelector('.k-n')); }).join(', ');
      case 'what-year-was-i-born': var ys = Array.prototype.map.call(leaf.querySelectorAll('.yt-year'), txt).filter(Boolean); return 'Born in ' + ys.join(' or ');
      case 'how-old-will-i-be': case 'dog-age': case 'cat-age': return n;
      default: return n + (r ? ' (' + r + ')' : '');
    }
  }
  function ddText(dd) {
    var c = dd.cloneNode(true);
    c.querySelectorAll('small').forEach(function (s) { if (!/^and /.test(txt(s))) s.remove(); });
    c.querySelectorAll('.fig-tag, .fig-ic').forEach(function (s) { s.remove(); });
    return txt(c);
  }
  function plain() {
    var L = [], title = txt(document.querySelector('h1'));
    var head = txt(leaf.querySelector('.leaf-head > span:not(.born)'));
    L.push((head ? head + ': ' : title + ': ') + headline());
    var sl = leaf.querySelector('.say-line'); if (sl) L.push(txt(sl));
    CFG.dates.forEach(function (f) { var d = fieldDate(f[0]); if (d && !(f[0] === 'on' && page === 'home')) L.push(f[1] + ': ' + shortD(d)); });
    CFG.vals.forEach(function (v) { if (val(v[0])) L.push(v[2] + ': ' + val(v[0])); });
    CFG.radios.forEach(function (r) { var e = document.querySelector('input[name="' + r[0] + '"]:checked'); if (e) L.push(r[2] + (/\?$/.test(r[2]) ? ' ' : ': ') + txt(e.closest('label')).replace(/\s*\(.*$/, '')); });
    var nb = leaf.querySelector('.nextb p');
    if (nb) L.push(txt(nb).replace(/^(Next birthday|Birthday after) /, '$1: ').replace(/ · (\d[\d,]* days?)/, ', in $1').replace(/ · /g, ', '));
    var bn = leaf.querySelector('.bday-note'); if (bn) L.push(txt(bn));
    var nm = leaf.querySelector('.slip-name'); if (nm && !nm.querySelector('.muted')) L.push('Name: ' + txt(nm).replace(/^Name /, ''));
    leaf.querySelectorAll('dl.ledger > div').forEach(function (row) { L.push(txt(row.querySelector('dt')).replace(/:$/, '') + ': ' + ddText(row.querySelector('dd'))); });
    CFG.checks.forEach(function (c) { var e = document.getElementById(c[0]); if (e) L.push(e.checked ? 'End day counted' : 'End day not counted'); });
    L.push(shareUrl());
    return L.join('\n');
  }

  /* ---- clipboard and the quiet "Copied" note ---- */
  function write(s) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(s);
    var t = document.createElement('textarea'); t.value = s; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); return Promise.resolve();
  }
  function announce(m) { if (say) { say.textContent = ''; setTimeout(function () { say.textContent = m; }, 30); } }
  function tag(el) {
    var old = el.querySelector('.fig-tag'); if (old) old.remove();
    var t = document.createElement('span'); t.className = 'fig-tag'; t.setAttribute('aria-hidden', 'true'); t.innerHTML = TICK + 'Copied';
    el.appendChild(t); requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 260); }, 1500);
  }
  function flip(btn) { btn.classList.add('done'); clearTimeout(btn._t); btn._t = setTimeout(function () { btn.classList.remove('done'); }, 1600); }
  function setLabel(btn, a, b) { var l = btn.querySelector('.act-l'); if (l) l.innerHTML = '<span class="l-a">' + a + '</span><span class="l-b" aria-hidden="true">' + b + '</span>'; }

  /* ---- resting view helpers: today's date and this month's grid ---- */
  function monthGrid(y, m, hit, isToday) {
    var first = A.weekday(y, m, 1), dim = A.daysInMonth(y, m);
    var h = '<p class="month-name">' + M[m - 1] + ' <span>' + y + '</span></p><table><caption class="sr-only">' + (isToday ? 'This month. Today is ' + hit + ' ' + M[m - 1] + '.' : 'Birthday') + '</caption><thead><tr>';
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(function (c, i) { h += '<th scope="col" abbr="' + W[i] + '">' + c + '</th>'; });
    h += '</tr></thead><tbody><tr>';
    for (var i = 0; i < first; i++) h += '<td></td>';
    for (var d = 1; d <= dim; d++) {
      h += '<td' + (d === hit ? ' class="hit"' : '') + '>' + d + (d === hit ? RING : '') + '</td>';
      if ((first + d) % 7 === 0 && d < dim) h += '</tr><tr>';
    }
    for (i = 0; i < (7 - ((first + dim) % 7)) % 7; i++) h += '<td></td>';
    return h + '</tr></tbody></table>';
  }
  function dayOfYear(t) { var n = 0; for (var k = 1; k < t.m; k++) n += A.daysInMonth(t.y, k); return n + t.d; }
  function resting() {
    leaf.querySelectorAll('[data-today="long"]').forEach(function (e) { e.textContent = W[A.weekday(today.y, today.m, today.d)] + ' ' + today.d + ' ' + M[today.m - 1] + ' ' + today.y; });
    var len = A.daysInMonth(today.y, 2) === 29 ? 366 : 365;
    leaf.querySelectorAll('[data-today="dayof"]').forEach(function (e) { e.textContent = 'Day ' + dayOfYear(today) + ' of ' + len; });
    leaf.querySelectorAll('[data-today-grid]').forEach(function (e) { e.innerHTML = monthGrid(today.y, today.m, today.d, true); });
    var yr = leaf.querySelector('[data-es-year]'); if (yr && val('in-year')) yr.textContent = val('in-year');
  }
  leaf.addEventListener('click', function (e) {
    var b = e.target.closest('.pick'); if (!b) return;
    var box = document.querySelector('[data-datefield="' + b.getAttribute('data-fill') + '"] .quick'); if (!box) return;
    var v = b.getAttribute('data-v');
    if (!/\d{4}/.test(v)) { var p = A.parseDate(v + ' ' + today.y, { order: ORDER }); if (p.ok && A.cmp(p.date, today) < 0) v += ' ' + (today.y + 1); else v += ' ' + today.y; }
    box.value = v; box.dispatchEvent(new Event('input', { bubbles: true }));
    if (!fieldDate('dob') && document.getElementById('dob-q') && page === 'past') document.getElementById('dob-q').focus();
  });

  /* ---- figures in the card become copy buttons; tidy the card ---- */
  function figure(el, value, label) {
    if (!el || el.closest('.fig') || !value) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'fig'; b.setAttribute('data-fig', value); b.setAttribute('aria-label', 'Copy ' + label);
    el.parentNode.insertBefore(b, el); b.appendChild(el);
    b.insertAdjacentHTML('beforeend', '<span class="fig-ic" aria-hidden="true">' + COPY + '</span>');
  }
  var wide = window.matchMedia('(min-width: 761px)');
  function decorate() {
    var st = leaf.getAttribute('data-state');
    if (st !== 'result') { resting(); return; }
    if (!leaf.querySelector('.copy-hint')) { var mo = leaf.querySelector('details.more'), hp = '<p class="copy-hint">' + (touch ? 'Tap' : 'Click') + ' a number to copy it</p>'; if (mo) mo.insertAdjacentHTML('beforebegin', hp); else leaf.insertAdjacentHTML('beforeend', hp); }
    if (leaf.querySelector('.fig')) return;
    /* "and 1 day" sits at the figure's own size, lighter: one size per row */
    leaf.querySelectorAll('dl.ledger dd small').forEach(function (s) { if (/^and /.test(txt(s))) s.classList.add('rem'); });
    /* the month grid sits beside the answer on wide screens; on phones it stays under More */
    if ((page === 'home' || page === 'birthday-countdown') && wide.matches) {
      var mg = leaf.querySelector('.more-body .month'), lb = leaf.querySelector('.leaf-body');
      if (mg && lb && !lb.querySelector('.bday')) { var side = document.createElement('div'); side.className = 'bday card-side'; side.appendChild(mg); lb.appendChild(side); }
    }
    /* option C: each figure in the plain sentence copies on its own */
    leaf.querySelectorAll('.say-line .cn').forEach(function (e) { figure(e, txt(e), txt(e)); });
    var num = leaf.querySelector('.big .num');
    if (num) figure(num, page === 'home' || page === 'past' || page === 'birthday-countdown' || page === 'difference' ? headline() : txt(num) + unitOf(), headline());
    leaf.querySelectorAll('dl.ledger dd').forEach(function (dd) {
      var first = dd.firstChild; if (!first || first.nodeType !== 3 || !first.textContent.trim()) return;
      var s = document.createElement('span'); s.textContent = first.textContent.trim(); dd.replaceChild(s, first);
      if (s.nextSibling && s.nextSibling.nodeType === 1) dd.insertBefore(document.createTextNode(' '), s.nextSibling);
      var dt = dd.parentNode.querySelector('dt'); figure(s, s.textContent, (dt ? txt(dt) + ' ' : '') + s.textContent);
    });
    var cnt = leaf.querySelector('.nextb .count'); if (cnt) figure(cnt, txt(cnt), 'days to next birthday, ' + txt(cnt));
    var nbd = leaf.querySelector('.nextb b'); if (nbd) figure(nbd, txt(nbd), 'birthday, ' + txt(nbd));
    leaf.querySelectorAll('.kcol .k-n, .yt-year, .gm-label').forEach(function (e) { figure(e, txt(e), txt(e)); });
    var ab = acts.querySelector('[data-act="age"]'); if (ab) { var vis = ((ab.querySelector('.l-a') || {}).textContent || 'Copy age').trim(); ab.setAttribute('aria-label', vis + ': ' + headline()); }
  }
  /* ---- the row under the card ---- */
  acts.querySelectorAll('[data-act]').forEach(function (b) {
    var k = b.getAttribute('data-act'), l = b.querySelector('.act-l').textContent;
    if (k === 'link' && canShare) { b.classList.add('native'); l = 'Share'; }
    if (k !== 'print') setLabel(b, l, k === 'link' ? 'Link copied' : 'Copied');
  });
  var hint = acts.querySelector('.acts-hint'); if (hint && touch) hint.textContent = 'Tap a number to copy it';

  new MutationObserver(decorate).observe(leaf, { childList: true });
  decorate();
  leaf.addEventListener('click', function (e) {
    var b = e.target.closest('.fig'); if (!b || e.target.closest('a')) return;
    var v = b.getAttribute('data-fig');
    write(v).then(function () { tag(b); announce('Copied ' + v); });
  });

  /* "Share" only where the share sheet opens (navigator.share); everywhere else the button copies, so it stays "Copy link" / "Link copied" */
  acts.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || leaf.getAttribute('data-state') !== 'result') return;
    var k = b.getAttribute('data-act');
    if (k === 'age') { var v = headline(); write(v).then(function () { flip(b); announce('Copied ' + v); }); }
    if (k === 'all') write(plain()).then(function () { flip(b); announce('Copied the full result as text'); });
    if (k === 'link') {
      var u = shareUrl();
      if (canShare) navigator.share({ title: document.title, text: headline(), url: u }).catch(function () {});
      else write(u).then(function () { flip(b); announce('Link copied'); });
    }
    if (k === 'print') window.print();
  });

  /* ---- print: open More, add what was entered and where it came from ---- */
  var pmTop = document.querySelector('.print-meta.pm-top'), foot = document.querySelector('.print-meta.pm-bottom');
  function beforePrint() {
    if (!document.body.getAttribute('data-print')) document.body.setAttribute('data-print', 'page');
    leaf.querySelectorAll('details.more').forEach(function (d) { d.setAttribute('data-was', d.open ? '1' : ''); d.open = true; });
    var ins = CFG.dates.map(function (f) { var d = fieldDate(f[0]); return d ? f[1] + ' <b>' + d.d + ' ' + M[d.m - 1] + ' ' + d.y + '</b>' : ''; })
      .concat(CFG.vals.map(function (v) { return val(v[0]) ? v[2] + ' <b>' + val(v[0]) + '</b>' : ''; })).filter(Boolean).join('<span> · </span>');
    if (pmTop) pmTop.innerHTML = '<p>' + ins + '</p>';
    var n = new Date();
    if (foot) foot.innerHTML = '<p class="pm-src">Worked out on ' + n.getDate() + ' ' + M[n.getMonth()] + ' ' + n.getFullYear() + ' at ' + shareUrl().replace(/^https?:\/\//, '') + '</p>';
  }
  function afterPrint() {
    leaf.querySelectorAll('details.more').forEach(function (d) { d.open = d.getAttribute('data-was') === '1'; });
    if (document.body.getAttribute('data-print') === 'page') document.body.removeAttribute('data-print');
  }
  window.addEventListener('beforeprint', beforePrint); window.addEventListener('afterprint', afterPrint);
  window.__agecalcShare = { plain: plain, shareUrl: shareUrl, headline: headline, beforePrint: beforePrint, afterPrint: afterPrint };
})();

/* Links like ./#born-on-29-february open the section they point at. */
(function () {
  function openHash() {
    var id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    var el = document.getElementById(id);
    if (el && el.tagName === 'DETAILS' && !el.open) { el.open = true; el.scrollIntoView(); }
  }
  window.addEventListener('hashchange', openHash);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openHash); else openHash();
})();
