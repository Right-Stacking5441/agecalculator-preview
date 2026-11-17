/* agecalculator.com - page behaviour for every tool. Needs dates.js first.
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
  var zoneName = function (z) { return z === 'Asia/Calcutta' ? 'Asia/Kolkata' : z; };
  var zone = zoneName((Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Europe/London');
  if (q.get('tz')) zone = zoneName(q.get('tz'));

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

  /* Pen-line icons, drawn for this site (see ux/icons.py). Always paired with visible text or an aria-label. */
  var IC = {"tick": "<svg class=\"ic ic-tick\" viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4.6 12.8c1.5 1.3 2.9 2.7 4.1 4.3 3.1-4.2 6.5-8 10.6-11.2\"/></svg>", "cake": "<svg class=\"ic ic-cake\" viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4.2 20.6c5.3.3 10.4.2 15.6-.1M5.3 20.3l.2-7.3c4.4-.6 8.7-.5 13.1.1l.1 7.1M5.4 15.5c1.2 1.1 2.3 1.1 3.3.1 1.1-1 2.2-1 3.2 0 1.1 1 2.2.9 3.3-.1 1.1-1 2.1-.9 3.3.2M12 12.5V8.6M12 6.7c-1-.9-.9-2.2.1-3.3.9 1.2 1 2.4-.1 3.3z\"/></svg>", "chev": "<svg class=\"ic ic-chev\" viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M6.5 9.4c1.9 1.7 3.7 3.4 5.5 5.2 1.8-1.8 3.6-3.6 5.5-5.3\"/></svg>", "copy": "<svg class=\"ic ic-copy\" viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M8.7 8.4l10.4.1-.1 12H8.6zM15.3 8.3V4.2L4.9 4.3l-.1 12.1h3.7\"/></svg>", "printer": "<svg class=\"ic ic-printer\" viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M7.1 9V3.9h9.7V9M5.8 17.3H4.4c-.6 0-1.1-.4-1.1-1V10.1c0-.6.5-1.1 1.1-1.1h15.3c.6 0 1 .5 1 1.1v6.2c0 .6-.4 1-1 1h-1.5M7.1 14.1l9.9.1-.1 6.3H7.2z\"/></svg>"};
  var rb = function (d) { return '<span class="sr-only">Reading this as </span><b>' + short(d) + '</b>' + IC.tick; };
  function more(inner, title) { if (document.body.classList.contains('widget')) return ''; return '<details class="more"><summary>' + (title || 'More') + IC.chev + '</summary><div class="more-body">' + inner + '</div></details>'; }
  function nextb(html) { return '<div class="nextb">' + IC.cake + '<p>' + html + '</p></div>'; }
  function ph(unit, msg) { var t = document.getElementById('empty-tpl'); return t ? t.innerHTML : '<p class="ph-msg es-say">' + msg + '</p>'; }
  /* ---- Option C: adaptive headline and one plain sentence ---- */
  function wk(n) { var w = Math.floor(n / 7), d = n % 7; return (w ? plural(w, 'week') : '') + (w && d ? ' and ' : '') + (d ? plural(d, 'day') : ''); }
  function cn(s) { return '<span class="cn">' + s + '</span>'; }
  function cw(s) { return '<span class="cw">' + cn(s) + ',</span>'; }
  function sayLine(s) { return s ? '<p class="say-line">' + s + '</p>' : ''; }
  function bornSpan(d) { return '<span class="born">Born <b>' + short(d) + '</b></span>'; }
  /* Copywriter, 17 Nov: today "That's …", a past date "On that date it had been …", a future date "On that date it will be …" */
  function tense(at, what) { var c = A.cmp(at, today); return c > 0 ? 'On that ' + (what || 'date') + ' it will be ' : c < 0 ? 'On that ' + (what || 'date') + ' it had been ' : 'That’s '; }
  /* Age-1 rule: days under 1 month; months and days from 1 month until the first birthday; years from age 1. */
  function adaptive(r, extra) {
    var tail = extra ? '<p class="rest tight">' + extra + '</p>' : '';
    if (r.years === 0 && r.months === 0) return { lead: big(fmt(r.totalDays), (r.totalDays === 1 ? 'day' : 'days')) + tail, unit: 'd' };
    if (r.years === 0) return { lead: big(fmt(r.totalMonths), (r.totalMonths === 1 ? 'month' : 'months') + (r.days ? ' <span class="unit-and">and ' + plural(r.days, 'day') + '</span>' : '')) + tail, unit: 'm' };
    var rest = A.partsWords(0, r.months, r.days);
    rest = rest && extra ? rest + '. ' + extra : (rest || extra || '');
    return { lead: big(r.years, r.years === 1 ? 'year' : 'years') + (rest ? '<p class="rest tight">' + rest + '</p>' : ''), unit: 'y' };
  }
  function ageLine(r, at, unit) {
    var t = tense(at), tail = ' since you were born.';
    if (unit === 'd') return r.totalDays >= 7 ? t + cn(wk(r.totalDays)) + tail : '';
    return t + cw(wk(r.totalDays)) + ' or ' + cw(plural(r.totalDays, 'day')) + tail;
  }
  function ess(rows) { return '<dl class="ledger ess">' + rows.filter(Boolean).map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>'; }
  function sameAs(title, rows, join, note) { return '<div class="same' + (join ? ' join-' + join : '') + '"><p class="same-h">' + title + '</p><dl class="ledger same-l">' + rows.filter(Boolean).map(function (x) { return '<div><dt class="sr-only">' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>' + (note ? '<p class="same-note">' + note + '</p>' : '') + '</div>'; }
  function agePhrase(r) {
    if (r.years === 0 && r.months === 0) return plural(r.totalDays, 'day');
    if (r.years === 0) return plural(r.totalMonths, 'month') + (r.days ? ' and ' + plural(r.days, 'day') : '');
    var rest = A.partsWords(0, r.months, r.days);
    return plural(r.years, 'year') + (rest ? ', ' + rest : '');
  }
  function monthGrid(y, m, hitDay, label) {
    var first = A.weekday(y, m, 1), dim = A.daysInMonth(y, m);
    var h = '<div class="month">' + (label ? '<p class="month-cap">' + esc(label) + '</p>' : '') + '<p class="month-name">' + M[m - 1] + ' <span>' + y + '</span></p><table><caption class="sr-only">' + esc(label) + '</caption><thead><tr>';
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
  function notice(title, msg, side) {
    var plainMsg = String(msg || '').replace(/<[^>]+>/g, '');
    var sep = /[.?!]$/.test(title) ? ' ' : '. ';
    return { state: 'notice', say: title + (plainMsg ? sep + plainMsg : ''), html: head(title) + body('<p class="msg">' + msg + '</p>', side) };
  }

  /* ---------- date fields: a quick box that reads plain English, plus day / month / year boxes ---------- */
  var fields = {};
  var MSG_UNREADABLE = 'That doesn’t look like a date. Try something like 18 May 1995.';
  var MSG_INCOMPLETE = 'That date isn’t finished. Try 15 March 1995.';
  var MSG_FUTURE_DOB = 'That date hasn’t happened yet. Check the year.';
  function isDobField(n) { return n === 'dob'; }
  function parseMessage(r) {
    return r.message || (r.code === 'incomplete' ? MSG_INCOMPLETE : MSG_UNREADABLE);
  }
  function sharedToggle() { return document.querySelector('.parts-toggle.shared'); }
  function groupOf(fld) {
    var sh = sharedToggle();
    if (!sh || !fld) return fld ? [fld] : [];
    var out = [];
    (sh.getAttribute('aria-controls') || '').split(/\s+/).forEach(function (id) {
      if (!id) return;
      var box = document.getElementById(id);
      var df = box && box.closest('[data-datefield]');
      var name = df && df.getAttribute('data-datefield');
      if (name && fields[name]) out.push(fields[name]);
    });
    return out.length ? out : [fld];
  }
  function focusInDateGroup(group, a) {
    if (!a) return false;
    if (a.closest && a.closest('.parts-toggle')) return true;
    return group.some(function (fld) { return fld.el && fld.el.contains(a); });
  }
  function setGroupOpen(group, o) {
    group.forEach(function (fld) { if (fld.partsOpen) fld.partsOpen(o); });
  }
  document.querySelectorAll('[data-datefield]').forEach(function (el) {
    var name = el.getAttribute('data-datefield');
    var quick = el.querySelector('.quick'), parts = [el.querySelector('.p-d'), el.querySelector('.p-m'), el.querySelector('.p-y')];
    var read = el.querySelector('.readback');
    if (read && read.id) parts.forEach(function (box) { if (box) box.setAttribute('aria-describedby', read.id); });
    var f = { el: el, value: null, status: 'empty', message: '', alt: null };
    var pt = el.querySelector('.parts-toggle'), pbox = el.querySelector('.parts');
    var ptLab = pt && pt.querySelector('span');
    function labelToggles(o) {
      if (pt) pt.setAttribute('aria-expanded', String(o));
      if (ptLab) ptLab.textContent = o ? 'Use one box' : 'Type day, month and year separately';
      var sh = document.querySelector('.parts-toggle.shared');
      if (sh) {
        sh.setAttribute('aria-expanded', String(o));
        var shLab = sh.querySelector('span');
        if (shLab) shLab.textContent = o ? 'Use one box' : 'Type day, month and year separately';
      }
    }
    var savedParts = null;
    var quickFromParts = false;
    function clearParts() {
      parts[0].value = '';
      parts[1].value = '';
      parts[2].value = '';
    }
    function rememberParts(text) {
      savedParts = { d: parts[0].value, m: parts[1].value, y: parts[2].value, text: text };
    }
    function fillPartsFromQuick() {
      /* Clear leftover values when the text is empty or unparseable, but keep
         day/month/year the user typed in the boxes (e.g. 18//1999) across close/reopen. */
      var r = A.parseDate(quick.value, dateOpts());
      if (r.ok) {
        savedParts = null;
        clearParts();
        setDate(r.date, true);
      } else if (r.parts && (r.parts.d || r.parts.m || r.parts.y)) {
        savedParts = null;
        clearParts();
        if (r.parts.d != null && String(r.parts.d) !== '') parts[0].value = String(r.parts.d);
        if (r.parts.m != null && String(r.parts.m) !== '') parts[1].value = String(r.parts.m);
        if (r.parts.y != null && String(r.parts.y) !== '') parts[2].value = String(r.parts.y);
      } else if (savedParts && savedParts.text === quick.value) {
        parts[0].value = savedParts.d;
        parts[1].value = savedParts.m;
        parts[2].value = savedParts.y;
      } else {
        savedParts = null;
        clearParts();
      }
    }
    function writeQuickFromParts(asClose) {
      var r = A.textFromParts(parts[0].value, parts[1].value, parts[2].value);
      var hasParts = !!(parts[0].value || parts[1].value || parts[2].value);
      if (r.ok) {
        savedParts = null;
        parts.forEach(function (x) { x.setAttribute('aria-invalid', 'false'); });
        quick.value = r.text; quickFromParts = true; applyCompleteDate({ date: r.date, ambiguous: false, alt: null }, false, asClose);
      } else {
        markPartValidity((r.message && (r.code !== 'incomplete' || asClose)) ? r : { ok: false });
        f.value = null; f.status = r.code; f.message = r.message;
        if (hasParts && r.text) { quick.value = r.text; quickFromParts = true; }
        if (asClose) {
          if (hasParts) rememberParts(quick.value);
          else savedParts = null;
        }
        if (!hasParts) {
          /* If the text was written from the boxes, clearing them clears it too.
             Never wipe text the user typed in the one box. */
          if (quickFromParts) {
            quick.value = '';
            savedParts = null;
            quickFromParts = false;
            invalid(false); show('', '');
          } else if (!quick.value.trim()) { invalid(false); show('', ''); }
          else {
            var q = A.parseDate(quick.value, dateOpts());
            if (q.ok) { setDate(q.date, true); invalid(false); show(rb(q.date), 'ok'); }
            else { invalid(!!(q.message || q.code !== 'empty')); show(q.message || parseMessage(q), q.message || q.code !== 'empty' ? 'err' : ''); }
          }
        } else if (r.message && (r.code !== 'incomplete' || asClose)) {
          /* Show a missing-field message as soon as the boxes close, not only on blur. */
          invalid(true); show(r.message, 'err');
        } else if (r.message) {
          invalid(false); show(r.message, '');
        } else {
          invalid(false); show('', '');
        }
      }
    }
    function partsOpen(o) {
      if (!pbox) return;
      if (o) fillPartsFromQuick();
      else writeQuickFromParts(true);
      pbox.hidden = !o;
      if (o) el.classList.add('boxes-open');
      else el.classList.remove('boxes-open');
      labelToggles(o);
    }
    if (pt) {
      pt.addEventListener('mousedown', function (e) { e.preventDefault(); });
      pt.addEventListener('click', function () {
        var o = pbox.hidden;
        partsOpen(o);
        if (o) parts[0].focus({ preventScroll: true });
        else quick.focus({ preventScroll: true });
        go();
      });
    }
    fields[name] = f;
    f.partsOpen = partsOpen;
    f.isPartsOpen = function () { return !!(pbox && !pbox.hidden); };
    f.parts = parts;
    f.quick = quick;
    var dateOpts = function () { return { order: ORDER, pivotYear: today.y, today: today, yearMode: /^(on|start|end|test)$/.test(name) ? 'nearest' : 'past' }; };
    var shownKey = '';
    function show(text, kind, swap) {
      var html = text + (swap ? ' <button type="button" class="textbtn swap">I meant ' + plain(swap) + '</button>' : '');
      var cls = 'readback' + (kind ? ' ' + kind : '');
      var key = cls + '\n' + html;
      if (key === shownKey) return;
      shownKey = key;
      read.innerHTML = html;
      read.className = cls;
      var sb = read.querySelector('.swap');
      if (sb) {
        var press = null, fieldWasFocused = false, touchAt = 0;
        var keepFocus = function (e) {
          if (e.button != null && e.button !== 0) return;
          /* On touch, a compatibility mousedown is often fired just before click,
             which would wipe the real press time and make a long press look like a tap. */
          if (e.type === 'mousedown' && (press || touchAt)) {
            if (e.pointerType && e.pointerType !== 'touch') e.preventDefault();
            return;
          }
          fieldWasFocused = document.activeElement === quick;
          if (e.pointerType === 'touch') touchAt = Date.now();
          else touchAt = 0;
          press = {
            t: Date.now(),
            x: e.clientX,
            y: e.clientY,
            pointerType: e.pointerType || ''
          };
          /* Don't preventDefault on touch: that blocks scrolling. Mouse/pen only,
             so a click can land without pulling focus out of the field. */
          if (e.pointerType && e.pointerType !== 'touch') e.preventDefault();
        };
        var dropPress = function () { press = null; };
        sb.addEventListener('pointerdown', keepFocus);
        sb.addEventListener('mousedown', keepFocus);
        /* Clear press so a later keyboard / AT click is not judged against a
           stale point. Do not swallow that later click. */
        sb.addEventListener('pointercancel', dropPress);
        sb.addEventListener('lostpointercapture', dropPress);
        sb.addEventListener('pointerleave', dropPress);
        sb.addEventListener('pointerup', function (e) {
          var r = sb.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) press = null;
        });
        sb.addEventListener('click', function (e) {
          if (e.button != null && e.button !== 0) return;
          var fromKeyboard = e.detail === 0;
          var wasFocused = fieldWasFocused;
          var heldTouch = !fromKeyboard && touchAt && (Date.now() - touchAt > 500);
          var moved = !fromKeyboard && press && (Math.abs((e.clientX || 0) - press.x) > 10 || Math.abs((e.clientY || 0) - press.y) > 10);
          press = null;
          touchAt = 0;
          fieldWasFocused = false;
          if (heldTouch || moved) return;
          setDate(swap, true);
          quick.value = plain(swap);
          f.alt = null;
          show(rb(swap), 'ok');
          go();
          /* Don't steal focus (and open the phone keyboard) on a tap that
             started with the field unfocused. Keyboard / AT clicks use detail 0. */
          if (fromKeyboard || wasFocused) quick.focus({ preventScroll: true });
        });
      }
    }
    function markPartValidity(r) {
      parts.forEach(function (x, j) {
        var bad = !!(r && r.ok === false && r.field && ['day', 'month', 'year'][j] === r.field);
        x.setAttribute('aria-invalid', String(bad));
      });
    }
    function setDate(d, fillParts) {
      f.value = d; f.status = d ? 'ok' : f.status;
      if (fillParts && d) { parts[0].value = String(d.d).padStart(2, '0'); parts[1].value = String(d.m).padStart(2, '0'); parts[2].value = d.y; }
    }
    function invalid(on) { quick.setAttribute('aria-invalid', String(!!on)); }
    function applyCompleteDate(r, fillParts, showErr) {
      if (isDobField(name) && A.cmp(r.date, today) > 0) {
        f.status = 'future';
        f.message = MSG_FUTURE_DOB;
        invalid(true);
        markPartValidity({ ok: false, field: 'year' });
        if (showErr) {
          setDate(r.date, fillParts);
          show(MSG_FUTURE_DOB, 'err');
        } else {
          f.value = null;
          show('', '');
        }
        return;
      }
      setDate(r.date, fillParts);
      invalid(false);
      markPartValidity({ ok: true });
      show(rb(r.date), 'ok', r.ambiguous ? r.alt : null);
    }
    quick.addEventListener('input', function () {
      var r = A.parseDate(quick.value, dateOpts());
      if (r.ok) {
        applyCompleteDate(r, true);
      } else {
        f.value = null; f.status = r.code; f.message = r.message;
        invalid(false);
        savedParts = null;
        quickFromParts = false;
        if (r.code === 'empty' || !(r.parts && (r.parts.d || r.parts.m || r.parts.y))) clearParts();
        else {
          /* Keep the boxes in step with whatever we could extract, after a clear. */
          parts[0].value = r.parts.d != null && String(r.parts.d) !== '' ? String(r.parts.d) : '';
          parts[1].value = r.parts.m != null && String(r.parts.m) !== '' ? String(r.parts.m) : '';
          parts[2].value = r.parts.y != null && String(r.parts.y) !== '' ? String(r.parts.y) : '';
        }
        if (r.code === 'empty') show('', '');
        else if (r.code === 'incomplete') show(r.message || '', '');
        else show('', '');
      }
      go();
    });
    quick.addEventListener('blur', function (e) {
      /* Invalid text stays in the text field. Boxes open only from the toggle.
         Use relatedTarget (during blur, activeElement is the body). */
      var next = e.relatedTarget;
      if (!quick.value.trim()) { invalid(false); savedParts = null; clearParts(); return; }
      var r = A.parseDate(quick.value, dateOpts());
      if (r.ok) {
        /* Blur must not rebuild unchanged UI. Filling hidden boxes here can
           fire input on some engines and rewrite the text, which drops "I meant". */
        var sameDate = f.value && A.cmp(f.value, r.date) === 0;
        if (!sameDate) applyCompleteDate(r, !!(pbox && !pbox.hidden), true);
        go();
        return;
      }
      f.value = null; f.status = r.code; f.message = r.message;
      invalid(true);
      show(parseMessage(r), 'err');
      go();
    });
    parts.forEach(function (p, i) {
      p.addEventListener('input', function () {
        p.value = p.value.replace(/\D/g, '').slice(0, i === 2 ? 4 : 2);
        var v = p.value, next = parts[i + 1];
        if (next && (v.length === 2 || (i === 0 && +v > 3) || (i === 1 && +v > 1))) { next.focus({ preventScroll: true }); next.select(); }
        writeQuickFromParts();
        go();
      });
      p.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !p.value && i > 0) {
          e.preventDefault();
          parts[i - 1].focus({ preventScroll: true });
          return;
        }
        /* A digit typed into a already-full box should land in the next box
           (WebKit otherwise drops it because of maxlength). */
        var max = i === 2 ? 4 : 2;
        var nxt = parts[i + 1];
        if (nxt && /^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          var start = p.selectionStart, end = p.selectionEnd;
          var replacing = start !== end;
          var atEnd = !replacing && (start == null || start >= p.value.length);
          if (atEnd && p.value.length >= max) {
            e.preventDefault();
            nxt.focus({ preventScroll: true });
            var nmax = i + 1 === 2 ? 4 : 2;
            if (nxt.selectionStart !== nxt.selectionEnd || !nxt.value) nxt.value = e.key;
            else if (nxt.value.length < nmax) nxt.value += e.key;
            else return;
            nxt.dispatchEvent(new Event('input'));
          }
        }
      });
      p.addEventListener('blur', function (e) {
        if (e.relatedTarget && parts.indexOf(e.relatedTarget) !== -1) return;
        var r = A.validate(parts[0].value, parts[1].value, parts[2].value);
        if (r.ok || !(parts[0].value || parts[1].value || parts[2].value)) return;
        markPartValidity(r);
        if (r.message) { f.value = null; f.status = r.code; invalid(true); show(r.message, 'err'); go(); }
      });
      p.addEventListener('blur', function () {
        if (i === 2 && p.value && p.value.length < 4) {
          var r = A.validate(parts[0].value, parts[1].value, parts[2].value);
          f.value = null; f.status = 'incomplete'; f.message = r.message || 'Year should be four digits, like 1988.';
          invalid(true); show(f.message, 'err'); go();
        }
      });
    });
    /* Close the boxes only on an explicit toggle or when focus leaves the
       field group and the shared toggle. A valid mid-keystroke must not
       auto-close them. Never pull focus back into the text field. */
    el.addEventListener('focusout', function (e) {
      setTimeout(function () {
        if (!pbox || pbox.hidden) return;
        var group = groupOf(f);
        var a = document.activeElement;
        if (focusInDateGroup(group, a)) return;
        if (e.relatedTarget && focusInDateGroup(group, e.relatedTarget) && (!a || a === document.body)) return;
        setGroupOpen(group, false);
        go();
      }, 0);
    });
    f.markError = function (msg) {
      f.message = msg;
      invalid(true);
      show(msg, 'err');
    };
    f.clearSemanticError = function () {
      if (f.value) { invalid(false); show(rb(f.value), 'ok'); f.message = ''; }
    };
    f.set = function (d) { setDate(d, true); if (d) { quick.value = plain(d); show(rb(d), 'ok'); } };
    f.clearToToday = function () { f.set(today); };
    var pre = q.get(name);
    if (pre) { quick.value = pre; quick.dispatchEvent(new Event('input')); }
  });

  /* "Age on" date that defaults to today in a named time zone */
  var on = fields.on, onBox = document.getElementById('on-box'), onBtn = document.getElementById('on-toggle'), onLabel = document.getElementById('on-label');
  var zoneSel = document.getElementById('zone');
  function fillZones() {
    if (!zoneSel || !Intl.supportedValuesOf || zoneSel.options.length >= 3) return;
    var seen = {};
    seen[zone] = true;
    Intl.supportedValuesOf('timeZone').forEach(function (z) {
      z = zoneName(z);
      if (seen[z]) return;
      seen[z] = true;
      var o = document.createElement('option');
      o.textContent = z;
      o.value = z;
      zoneSel.appendChild(o);
    });
  }
  function onDate() { return on && on.value ? on.value : today; }
  function invalidOn() {
    if (!on || !onBox || onBox.hidden) return null;
    return errOf(on, 'date');
  }
  function groupFromToggle(b) {
    var group = [];
    (b.getAttribute('aria-controls') || '').split(/\s+/).forEach(function (id) {
      if (!id) return;
      var box = document.getElementById(id);
      var df = box && box.closest('[data-datefield]');
      var nm = df && df.getAttribute('data-datefield');
      if (nm && fields[nm]) group.push(fields[nm]);
    });
    return group;
  }
  document.querySelectorAll('.parts-toggle.shared').forEach(function (b) {
    /* Keep focus off the button so a tap can move it into the boxes. */
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function () {
      var group = groupFromToggle(b);
      var anyOpen = group.some(function (fld) { return fld.isPartsOpen && fld.isPartsOpen(); });
      var o = !anyOpen;
      setGroupOpen(group, o);
      var first = group[0];
      /* Focus now, not in a timeout, so a keystroke on the same tap is not lost. */
      if (o) {
        if (first && first.parts && first.parts[0]) first.parts[0].focus({ preventScroll: true });
      } else if (first && first.quick) {
        first.quick.focus({ preventScroll: true });
      }
      go();
    });
    /* The toggle sits outside both date fields, so their focusout does not
       run when Tab moves from the toggle to the next control. Close then. */
    b.addEventListener('focusout', function (e) {
      var group = groupFromToggle(b);
      setTimeout(function () {
        var anyOpen = group.some(function (fld) { return fld.isPartsOpen && fld.isPartsOpen(); });
        if (!anyOpen) return;
        var a = document.activeElement;
        if (focusInDateGroup(group, a)) return;
        if (e.relatedTarget && focusInDateGroup(group, e.relatedTarget) && (!a || a === document.body)) return;
        setGroupOpen(group, false);
        go();
      }, 0);
    });
  });
  function refreshOnLabel() {
    if (!onLabel) return;
    var d = onDate(), idle = onLabel.getAttribute('data-idle'), zn = document.getElementById('zone-now');
    if (zn) zn.textContent = zone;
    if (idle && onBox.hidden) { onLabel.textContent = idle; return; }
    if (same(d, today)) onLabel.innerHTML = 'Age today<span class="on-date">, <b>' + short(d) + '</b></span>';
    else onLabel.innerHTML = 'Age on <span class="on-date"><b>' + short(d) + '</b></span>';
  }
  if (onBtn) onBtn.addEventListener('click', function () {
    var open = onBox.hidden;
    onBox.hidden = !open; onBtn.setAttribute('aria-expanded', String(open)); onBtn.textContent = open ? "Use today" : (onBtn.getAttribute('data-label') || 'Change');
    if (open) {
      if (!on.value) on.set(today);
      fillZones();
      on.el.querySelector('.quick').focus({ preventScroll: true });
    } else { on.value = null; }
    refreshOnLabel(); go();
  });
  if (zoneSel) zoneSel.addEventListener('focus', function () {
    fillZones();
  });
  if (zoneSel) {
    zoneSel.options[0].textContent = zoneName(zone); zoneSel.options[0].value = zone; zoneSel.value = zone;
    zoneSel.addEventListener('change', function () { var wasToday = !on.value || same(on.value, today); zone = zoneName(zoneSel.value); today = todayIn(zone); if (wasToday) on.set(today); refreshOnLabel(); fillBirthYearTable(); setDateline(); go(); });
  }
  if (on && q.get('on')) { onBox.hidden = false; onBtn.setAttribute('aria-expanded', 'true'); onBtn.textContent = 'Use today'; }

  var $v = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var checked = function (n) { var e = document.querySelector('input[name="' + n + '"]:checked'); return e ? e.value : null; };

  /* ---------- tools ---------- */
  function ageCore(b, at, opts) {
    opts = opts || {};
    var r = A.age(b, at);
    if (!r.ok) return notice('Not born yet', long(b) + ' is ' + plural(r.daysUntil, 'day') + ' after ' + long(at) + '. Check the year, or change the “age on” date.', monthGrid(b.y, b.m, b.d, 'Date entered'));
    var bounds = A.birthdayBounds(b, at);
    var nx = r.next, verb = A.cmp(at, today) > 0 ? 'will be' : A.cmp(at, today) < 0 ? 'were' : 'are';
    var bline, gridLabel = 'Next birthday';
    if (bounds.bornDay) {
      nx = bounds.next;
      bline = 'The day you were born. Next birthday: <b>' + short(nx) + '</b>, in ' + plural(nx.daysUntil, 'day') + ', turning 1';
    } else if (nx.isToday) {
      gridLabel = 'Birthday';
      bline = '<b>Birthday today.</b> Happy ' + ordinal(nx.turning) + ' birthday.';
    } else {
      bline = 'Next birthday: <b>' + short(nx) + '</b>, in <span class="count">' + plural(nx.daysUntil, 'day') + '</span>, turning ' + nx.turning;
    }
    var note = nx.shifted ? '<p class="bday-note">No 29 February in ' + nx.y + ', so the birthday counts on 1 March.</p>' : '';
    var kor = opts.korean === false ? null : A.koreanAges(b, at);
    var extra = [
      ['Same age in hours', fmt(r.hours) + small('days × 24, from midnight')],
      opts.chrono !== false ? ['Chronological age', r.years + ';' + r.months + ';' + r.days + small('years;months;days, <a href="chronological-age/">the form tests use</a>')] : null,
      ['Born on a', W[r.bornWeekday]],
      kor ? ['Korean age', kor.counting + small('Year age ' + kor.yearAge + '. <a href="korean-age/">Why they differ</a>')] : null
    ];
    var say = 'On ' + long(at) + ' you ' + verb + ' ' + agePhrase(r) + '.';
    if (bounds.bornDay) say += ' The day you were born. Next birthday ' + long(nx) + ', turning 1, in ' + plural(nx.daysUntil, 'day') + '.';
    else if (nx.isToday) say += ' Today. Happy ' + ordinal(nx.turning) + ' birthday.';
    else say += ' Next birthday ' + long(nx) + ', in ' + plural(nx.daysUntil, 'day') + '.';
    var ad = adaptive(r);
    return { state: 'result', say: say, html: '<div class="leaf-head">' + bornSpan(b) + ' <span>Age on <b>' + short(at) + '</b></span></div>' + body(ad.lead + sayLine(ageLine(r, at, ad.unit))) + nextb(bline) + note + more(ledger(extra) + monthGrid(nx.y, nx.m, nx.d, gridLabel)) };
  }
  /* Empty state: an invitation, never somebody's data. Same shape as a result so nothing jumps. */
  function emptyToday(msg, unit, title) {
    var page = document.body.getAttribute('data-page') || '';
    var rest = (page === 'home') ? '<div class="es es-today"><div class="es-main"><p class="es-k">Today</p><p class="es-date" data-today="long"></p><p class="es-day" data-today="dayof"></p></div><div class="month today-grid" data-today-grid></div></div>' : '';
    return { state: 'empty', html: body(ph('', msg) + rest) };
  }
  function needs(f) { return !f || !f.value; }
  function errOf(f, label) {
    var el = f && f.el.querySelector('.readback.err');
    if (!el) return null;
    var msg = el.textContent.replace(/I meant.*/, '').trim();
    var n = notice('Check the ' + label, msg);
    if (f.status === 'future' || msg === MSG_FUTURE_DOB) n.say = MSG_FUTURE_DOB;
    return n;
  }
  /* Error wins, no result: any field error, including a future date of birth, blocks the result. */
  function blockOnErrors(pairs, emptyOut) {
    var i, err;
    for (i = 0; i < pairs.length; i++) {
      err = errOf(pairs[i][0], pairs[i][1]);
      if (err) return err;
    }
    for (i = 0; i < pairs.length; i++) if (needs(pairs[i][0])) return emptyOut;
    return null;
  }

  /* ---------- per-tool objects (see SPEC.md "Polish v3") ---------- */
  var MON3 = M.map(function (x) { return x.slice(0, 3); });
  function miniLeaf(d, label, cls) {
    return '<div class="mini-leaf' + (cls ? ' ' + cls : '') + '"><p class="ml-name">' + esc(label) + '</p><p class="ml-day">' + d.d + '</p><p class="ml-my">' + MON3[d.m - 1] + ' ' + d.y + '</p><p class="ml-wd">' + W[A.weekday(d.y, d.m, d.d)].slice(0, 3) + '</p></div>';
  }
  function stamp(d) { return '<span class="stamp">' + d.d + ' ' + MON3[d.m - 1] + ' ' + d.y + '</span>'; }

  var TOOLS = {
    age: function () {
      var b = fields.dob;
      var empty = emptyToday(document.body.classList.contains('widget') ? 'Type a date of birth to see your age in years, months and days.' : 'Type a date of birth, like 15 March 1995.');
      return errOf(b, 'date') || invalidOn() || (needs(b) ? empty : ageCore(b.value, onDate()));
    },
    /* An old leaf: aged paper, brown binding, the date rubber-stamped, that day ringed in its month. */
    past: function () {
      var b = fields.dob, at = onDate();
      var empty = withCls(emptyToday('Add both dates to see how old you were then.'), 'leaf-old');
      var blocked = errOf(b, 'date') || invalidOn();
      if (blocked) return withCls(blocked, 'leaf-old');
      if (needs(b)) return empty;
      var r = A.age(b.value, at);
      if (!r.ok) return withCls(notice('Not born yet', long(b.value) + ' is after ' + long(at) + '.'), 'leaf-old');
      var bounds = A.birthdayBounds(b.value, at);
      var ad = adaptive(r, bounds.bornDay ? 'The day you were born.' : ''), lead = ad.lead + sayLine(ageLine(r, at, ad.unit));
      var prev = bounds.last, nx = bounds.next;
      var agoN = A.cmp(today, at), ago = 'that’s in the future';
      if (same(at, today)) ago = 'today';
      else if (agoN >= 0) {
        var agoR = A.age(at, today);
        var agoDays = fmt(agoN) + (agoN === 1 ? ' day' : ' days');
        var agoMain = (agoR.ok && (agoR.years || agoR.months)) ? A.partsWords(agoR.years, agoR.months, agoR.days) : '';
        ago = agoMain ? agoMain + small('(' + agoDays + ' in all)') : agoDays;
      }
      var verb = same(at, today) ? 'are' : (A.cmp(at, today) > 0 ? 'will be' : 'were');
      var bl = 'Next birthday: <b>' + short(nx) + '</b> (' + nx.turning + ')';
      var html = '<div class="leaf-head">' + bornSpan(b.value) + ' <span class="on-at">On ' + stamp(at) + '</span></div>' + body(lead) + nextb(bl) +
        ess([['How long ago', ago]]) +
        more(ledger([[bounds.lastLabel, plain(prev)], ['That day was a', W[A.weekday(at.y, at.m, at.d)]]]) + monthGrid(at.y, at.m, at.d, 'The date you chose'));
      return { state: 'result', cls: 'leaf-old', say: 'On ' + long(at) + ' you ' + verb + ' ' + agePhrase(r) + '.', html: html };
    },
    /* A countdown is a tear-off pad: one sheet per day still to go (drawn up to a point). */
    countdown: function () {
      var b = fields.dob;
      var empty = withCls(emptyToday('Whose birthday? Type the date of birth to start counting.'), 'leaf-stack');
      if (errOf(b, 'date')) return errOf(b, 'date');
      if (needs(b)) return empty;
      var r = A.age(b.value, today);
      if (!r.ok) return notice('Not born yet', 'That date is after today.');
      var bounds = A.birthdayBounds(b.value, today);
      var nx = bounds.bornDay ? bounds.next : r.next, n = nx.daysUntil;
      var lead = bounds.bornDay
        ? big(fmt(n), n === 1 ? 'day to go' : 'days to go') + '<p class="rest">You were born today. Next birthday is ' + long(nx) + ', when you turn 1.</p>'
        : nx.isToday ? big('Today', '') + '<p class="rest">Happy ' + ordinal(nx.turning) + ' birthday.</p>'
        : big(fmt(n), n === 1 ? 'day to go' : 'days to go') + '<p class="rest">until ' + long(nx) + ', when you turn ' + nx.turning + '.</p>';
      var rows = [['Weekend birthday?', (nx.weekday >= 5 ? 'Yes, a ' : 'No, a ') + W[nx.weekday]], n > 0 ? ['Hours to go', '<span data-clock data-days="' + n + '">' + fmt(n * 24) + ' hours</span>'] : null, ['Birthdays so far', fmt(r.years)]].filter(Boolean);
      if (!nx.isToday && n >= 7) lead += sayLine('That’s ' + cn(wk(n)) + ' to go.');
      var note = nx.shifted ? '<p class="bday-note">No 29 February in ' + nx.y + ', so we count down to 1 March.</p>' : '';
      var depth = Math.max(1, Math.min(16, Math.ceil(n / 10)));
      var say = bounds.bornDay
        ? 'You were born today. Next birthday is ' + long(nx) + ', when you turn 1, in ' + plural(n, 'day') + '.'
        : nx.isToday ? 'Today. Happy ' + ordinal(nx.turning) + ' birthday.'
        : plural(n, 'day') + ' until ' + long(nx) + '.';
      return { state: 'result', cls: 'leaf-stack', depth: depth, say: say, html: '<div class="leaf-head">' + bornSpan(b.value) + ' <span>Counting from <b>' + short(today) + '</b></span></div>' + body(lead) + note + ess(rows.slice(0, 1)) + more(ledger(rows.slice(1)) + monthGrid(nx.y, nx.m, nx.d, 'Birthday')) };
    },
    future: function () {
      var b = fields.dob, yr = +$v('in-year');
      var empty = { state: 'empty', cls: 'obj obj-planner', html: ph('', 'Type your date of birth to see your age in ' + ((yr && String(yr).length === 4) ? yr : 'that year') + '.') };
      if (errOf(b, 'date')) return errOf(b, 'date');
      if (invalidOn()) return invalidOn();
      if (needs(b)) return empty;
      if (on && on.value) return ageCore(b.value, on.value);
      if (!yr || String(yr).length !== 4 || yr < A.MIN_YEAR || yr > A.MAX_YEAR) return notice('Which year?', 'Type a year between ' + A.MIN_YEAR + ' and ' + A.MAX_YEAR + ', like 2050, or pick an exact date.');
      if (yr < b.value.y) return notice('Before you were born', yr + ' is before ' + b.value.y + '.');
      var plan = A.ageInCalendarYear(b.value, yr);
      function daysTo(d) {
        var n = A.cmp(d, today);
        return n > 0 ? fmt(n) : (n === 0 ? 'Today' : 'already passed');
      }
      function janLabel(part) { return part && part.ok ? plural(part.years, 'year') : 'not born yet'; }
      if (plan.bornYear) {
        var first = plan.firstBirthday;
        var html0 = '<div class="leaf-head">' + bornSpan(b.value) + '</div><div class="planner-say">' + big(0, 'years') + '<p class="rest">' + yr + ' is the year you were born (' + long(b.value) + '). You turn 1 on ' + long(first) + '.</p></div>' + planner(yr, b.value, null) +
          ess([['On 1 January ' + yr, janLabel(plan.jan1)], ['On 31 December ' + yr, janLabel(plan.dec31)]]) + more(ledger([['Days from today to the first birthday', daysTo(first)], ['First birthday is a', W[A.weekday(first.y, first.m, first.d)]]]));
        return { state: 'result', cls: 'obj obj-planner', html: html0, say: yr + ' is the year you were born. You turn 1 on ' + long(first) + '.' };
      }
      var bd = plan.birthday, after = plan.after, before = plan.before;
      var bdN = A.between(b.value, bd).totalDays;
      var html = '<div class="leaf-head">' + bornSpan(b.value) + '</div><div class="planner-say">' + big(after, after === 1 ? 'year' : 'years') + '<p class="rest tight">from ' + short(bd) + '. Until then, ' + before + '.</p>' + sayLine(tense(bd, 'birthday') + cw(wk(bdN)) + ' or ' + cw(plural(bdN, 'day')) + ' since you were born.') + '</div>' + planner(yr, bd, [before, after]) +
        ess([['On 1 January ' + yr, janLabel(plan.jan1)], ['On 31 December ' + yr, janLabel(plan.dec31)]]) + more(ledger([['Days from today to that birthday', daysTo(bd)], ['That birthday is a', W[A.weekday(bd.y, bd.m, bd.d)]]]));
      return { state: 'result', cls: 'obj obj-planner', html: html, say: 'In ' + yr + ' you turn ' + after + ' on ' + long(bd) + '.' };
    },
    /* Two leaves side by side, the gap between them measured like a drawing dimension. */
    difference: function () {
      var a = fields.a, b = fields.b, na = $v('name-a') || 'Person A', nb = $v('name-b') || 'Person B';
      var empty = { state: 'empty', cls: 'obj obj-pair', html: ph('', 'Two dates of birth, and the gap shows up here.') };
      if (errOf(a, 'first date')) return errOf(a, 'first date');
      if (errOf(b, 'second date')) return errOf(b, 'second date');
      if (needs(a) || needs(b)) return empty;
      var r = A.between(a.value, b.value);
      if (r.totalDays === 0) return notice('Same day', esc(na) + ' and ' + esc(nb) + ' were born on the same day.');
      var first = r.sign > 0 ? [a.value, na] : [b.value, nb], second = r.sign > 0 ? [b.value, nb] : [a.value, na];
      var ad = adaptive(r, esc(first[1]) + ' is older.');
      var gapLine = ad.unit === 'd' ? (r.totalDays >= 7 ? 'That’s a gap of ' + cn(wk(r.totalDays)) + '.' : '') : 'That’s a gap of ' + cw(wk(r.totalDays)) + ' or ' + cn(plural(r.totalDays, 'day')) + '.';
      var html = '<div class="pair-say">' + ad.lead + sayLine(gapLine) + '</div>' +
        '<div class="pair-leaves">' + miniLeaf(first[0], first[1], 'elder') +
        '<div class="gap-measure"><span class="gm-label">' + fmt(r.totalDays) + (r.totalDays === 1 ? ' day' : ' days') + '</span><span class="gm-line" aria-hidden="true"></span></div>' +
        miniLeaf(second[0], second[1]) + '</div>' +
        ess([['Ages differ by', (r.months || r.days) ? r.years + ' or ' + (r.years + 1) + small('depending on the time of year') : r.years + small('all year')]]);
      return { state: 'result', cls: 'obj obj-pair', say: first[1] + ' is older by ' + ymdWords(r) + '.', html: html };
    },
    /* Two leaves joined by a ruler, the span bracketed and labelled. */
    between: function () {
      var a = fields.start, b = fields.end, inc = document.getElementById('inc-end').checked;
      var empty = { state: 'empty', cls: 'obj obj-span', html: ph('', 'Pick a start and an end date to count the days.') };
      if (errOf(a, 'start date')) return errOf(a, 'start date');
      if (errOf(b, 'end date')) return errOf(b, 'end date');
      if (needs(a) || needs(b)) return empty;
      var r = A.between(a.value, b.value), days = r.totalDays + (inc ? 1 : 0);
      var lo = r.sign > 0 ? a.value : b.value, hi = r.sign > 0 ? b.value : a.value;
      var weeksMarked = Math.min(Math.floor(days / 7), 52);
      var spanW = days >= 7 ? wk(days) : '', spanYM = !inc && (r.years || r.months) ? A.partsWords(r.years, r.months, r.days) : '';
      var spanLine = spanW && spanYM ? 'That’s ' + cw(spanW) + ' or ' + cn(spanYM) + '.' : spanW ? 'That’s ' + cn(spanW) + '.' : '';
      var html = '<div class="span-say">' + big(fmt(days), days === 1 ? 'day' : 'days') + (inc ? '<p class="rest tight">End day counted.</p>' : '') + sayLine(spanLine) + '</div>' +
        '<div class="span-row">' + miniLeaf(lo, r.sign > 0 ? 'Start' : 'End') +
        '<div class="gap-measure"><span class="gm-label">' + plural(days, 'day') + '</span><span class="gm-line" aria-hidden="true"></span></div>' +
        miniLeaf(hi, r.sign > 0 ? 'End' : 'Start') + '</div>' +
        sameAs('Made up of', [['Weekdays', plural(r.weekdays + (inc && A.weekday(hi.y, hi.m, hi.d) < 5 ? 1 : 0), 'weekday')], ['Weekend days', plural(r.weekendDays + (inc && A.weekday(hi.y, hi.m, hi.d) >= 5 ? 1 : 0), 'weekend day')]], 'and', 'Weekdays are Monday to Friday. Bank holidays count as weekdays.') + ess([ r.sign < 0 ? ['Order', 'End is before start; counted backwards'] : null]);
      return { state: 'result', cls: 'obj obj-span', say: plural(days, 'day') + ' between ' + plain(lo) + ' and ' + plain(hi) + '.', html: html };
    },
    /* A school record slip: the subtraction written the way it is on score forms. */
    chrono: function () {
      var b = fields.dob, t = fields.test, nm = $v('pupil');
      var slipHead = '<div class="slip-head"><b>Chronological age</b><span>Record slip</span></div>';
      function grid(tv, bv, r) {
        var c = function (v, n) { return v == null ? '<td class="blank"></td>' : '<td>' + String(v).padStart(n, '0') + '</td>'; };
        return '<table class="slip-sum"><thead><tr><th scope="col"><span class="sr-only">Item</span></th><th scope="col">Year</th><th scope="col">Month</th><th scope="col">Day</th></tr></thead><tbody>' +
          '<tr><th scope="row">Test date</th>' + c(tv && tv.y, 4) + c(tv && tv.m, 2) + c(tv && tv.d, 2) + '</tr>' +
          '<tr><th scope="row">Date of birth</th>' + c(bv && bv.y, 4) + c(bv && bv.m, 2) + c(bv && bv.d, 2) + '</tr>' +
          '<tr class="ans"><th scope="row">Age</th>' + (r ? '<td>' + r.years + '</td><td>' + r.months + '</td><td>' + r.days + '</td>' : '<td class="blank"></td><td class="blank"></td><td class="blank"></td>') + '</tr></tbody></table>';
      }
      var who = '<p class="slip-name"><span>Name</span> ' + (nm ? esc(nm) : '<i class="muted">not given</i>') + '</p>';
      var empty = { state: 'empty', cls: 'obj obj-slip', html: ph('', 'Add the date of birth and test date for the y;m;d.') };
      if (errOf(b, 'date of birth')) return errOf(b, 'date of birth');
      if (errOf(t, 'test date')) return errOf(t, 'test date');
      if (needs(b) || needs(t)) return { state: 'empty', cls: 'obj obj-slip', html: ph('', 'Add the date of birth and test date for the y;m;d.') + who + '<div class="slip">' + slipHead + grid(t && t.value, b && b.value, null) + '</div>' };
      var r = A.age(b.value, t.value);
      if (!r.ok) return notice('Check the dates', 'The test date is before the date of birth.');
      var code = r.years + ';' + r.months + ';' + r.days, rounded = r.totalMonths + (r.days >= 15 ? 1 : 0);
      var borrow = t.value.d < b.value.d
        ? '<p class="slip-borrow">Days are counted from the real length of the borrowed month, not 30 days, so a by-hand 30-day sum can come out up to two days different.</p>'
        : '';
      var html = '<div class="slip-answer"><p class="big"><span class="num code">' + code + '</span></p><p class="rest">' + ymdWords(r) + '</p>' +
        '<div class="slip-actions"><button type="button" class="btn icbtn" data-copy="' + code + '" aria-label="Copy ' + code + '">' + IC.copy + '<span>Copy</span></button><button type="button" class="btn btn-quiet icbtn" data-print="slip">' + IC.printer + '<span>Print slip</span></button></div></div>' +
        ess([['Age in months', fmt(r.totalMonths) + small('and ' + plural(r.days, 'day'))], ['Rounded to the month', fmt(rounded) + small('15+ days round up')]]) +
        '<div class="slip">' + slipHead + who + grid(t.value, b.value, r) + borrow + '</div>';
      return { state: 'result', cls: 'obj obj-slip', say: 'Chronological age ' + ymdWords(r) + '.', html: html };
    },
    /* Korean wall calendars: three counts in columns, the 1 January rollover marked. */
    korean: function () {
      var b = fields.dob, at = onDate(), onErr = invalidOn();
      if (onErr) return withCls(onErr, 'leaf-lunar');
      var empty = withCls(emptyToday('Type a date of birth to see all three ages.'), 'leaf-lunar');
      if (errOf(b, 'date')) return withCls(errOf(b, 'date'), 'leaf-lunar');
      if (needs(b)) return empty;
      var k = A.koreanAges(b.value, at);
      if (!k.ok) return withCls(notice('Not born yet', 'That date is after ' + long(at) + '.'), 'leaf-lunar');
      var jan = function (d) { return '<b>1 January ' + d.y + '</b>'; };
      var hows = [], col = function (n, en, ko, how, cls) { hows.push(['<span lang="ko">' + ko + '</span> ' + en, how]); return '<div class="kcol' + (cls ? ' ' + cls : '') + '"><p class="k-ko" lang="ko">' + ko + '</p><p class="k-n">' + n + '</p><p class="k-en">' + en + '</p></div>'; };
      var html = '<div class="leaf-head">' + bornSpan(b.value) + ' <span>On <b>' + short(at) + '</b></span></div><div class="kcols">' +
        col(k.international, 'International age', '만 나이', 'Up on your birthday. The default in Korean law since 28 June 2023.', 'main') +
        col(k.counting, 'Korean age', '세는 나이', '1 at birth, plus one every 1 January.') +
        col(k.yearAge, 'Year age', '연 나이', at.y + ' minus ' + b.value.y + '.') + '</div>' +
        '<p class="k-ny">' + A.koreanCountingUpSentence(k.r, at, today, jan) + ' ' + A.koreanIntlUpSentence(k.r, at, today, short) + '</p>' + more(ledger(hows), 'How each is counted');
      return { state: 'result', cls: 'leaf-lunar', say: 'International age ' + k.international + ', Korean age ' + k.counting + ', year age ' + k.yearAge + '.', html: html };
    },
    dog: function () { return pet('dog'); },
    cat: function () { return pet('cat'); },
    /* Birth year: file-divider tabs, one per possible year. */
    birthyear: function () {
      var a = $v('age-now'), had = checked('had'), at = onDate(), onErr = invalidOn();
      if (onErr) return onErr;
      if (!a) return { state: 'empty', cls: 'obj obj-tabs', html: ph('', 'Type an age, then say if the birthday’s been yet.') };
      if (!/^\d{1,3}$/.test(a) || +a > 130) return notice('Check the age', 'Type an age in whole years, from 0 to 130.');
      var r = A.birthYear(+a, at, had === 'yes' ? true : had === 'no' ? false : null);
      var caps = r.years.length > 1 ? ['if your birthday is still to come in ' + at.y, 'if you’ve had it already'] : [had === 'yes' ? 'you’ve had your birthday this year' : 'your birthday is still to come'];
      var html = '<div class="ytabs">' + r.years.map(function (y, i) { return '<div class="ytab' + (i ? ' second' : '') + '"><span class="yt-tab">Born in</span><p class="yt-year">' + y + '</p><p class="yt-cap">' + caps[i] + '</p></div>'; }).join(r.years.length > 1 ? '<p class="yt-or">or</p>' : '') + '</div>' +
        '<p class="rest">Age ' + esc(a) + ' on ' + long(at) + '.</p>';
      return { state: 'result', cls: 'obj obj-tabs', say: 'Born in ' + r.years.join(' or ') + '.', html: html };
    }
  };
  function withCls(o, c) { if (o) o.cls = c; return o; }

  /* Year planner strip: twelve months, the birthday month ringed, the age either side. */
  function planner(yr, bd, ages) {
    var h = '<div class="planner"><p class="pl-year">' + yr + '</p><ol class="pl-months">';
    for (var m = 1; m <= 12; m++) {
      var after = bd && (m > bd.m), isB = bd && m === bd.m;
      h += '<li class="' + (isB ? 'pl-b' : after ? 'pl-after' : 'pl-before') + '"><span class="pl-m">' + MON3[m - 1] + '</span>' + (isB ? '<span class="pl-d">' + bd.d + RING + '</span>' : '') + '</li>';
    }
    h += '</ol>';
    if (ages) h += '<p class="pl-ages"><span style="--w:' + (((bd.m - 1) + (bd.d - 1) / 31) / 12 * 100).toFixed(1) + '%">' + ages[0] + '</span><span>' + ages[1] + '</span></p>';
    return h + '</div>';
  }

  /* Vet record card for dog and cat years. */
  var CHART_SRC = 'https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/canine-life-stage-2019/canine_and_feline_age_chart_poster.pdf';
  function petChartNote(kind, r, size) {
    if (r.ok) return null;
    if (kind === 'dog' && r.code === 'below-chart') return 'The AAHA-published chart starts at 1 year for dogs, so this page doesn’t give an estimate under a year.';
    if (kind === 'cat' && r.code === 'below-chart') return 'The AAHA-published chart starts at 6 months for cats, so this page doesn’t give an estimate under that.';
    if (kind === 'dog' && size === 'giant') return 'The AAHA-published chart has no giant-breed figures beyond 16 years.';
    if (kind === 'dog') return 'The AAHA-published chart for this size goes up to ' + r.max + ' years, and this page doesn’t invent figures past that.';
    return 'The AAHA-published chart for cats goes up to 21 years, and this page doesn’t invent figures past that.';
  }
  function sizeLabel(z) {
    var s = A.DOG_SIZES[z] || A.DOG_SIZES.medium;
    return s.label.charAt(0).toUpperCase() + s.label.slice(1) + ', ' + s.kg + ' (' + s.lbs + ')';
  }
  function pet(kind) {
    var parsed = A.parsePetAge($v('pet-y'), $v('pet-m')), size = checked('size') || 'medium';
    if (parsed.code === 'empty') {
      var ages = [1, 2, 3, 5, 7, 8, 10, 12, 15], t;
      if (kind === 'dog') t = '<tr><th scope="col">Age</th><th scope="col">Small</th><th scope="col">Medium</th><th scope="col">Large</th><th scope="col">Giant</th></tr>' + ages.map(function (x) { return '<tr><td>' + x + '</td>' + ['small', 'medium', 'large', 'giant'].map(function (z) { var r = A.dogAge(x, z); return '<td>' + (r.ok ? fmt(r.human) : 'n/a') + '</td>'; }).join('') + '</tr>'; }).join('');
      else t = '<tr><th scope="col">Age</th><th scope="col">Human</th><th scope="col">Stage</th></tr>' + ages.map(function (x) { var r = A.catAge(x); return '<tr><td>' + x + '</td><td>' + (r.ok ? fmt(r.human) : 'n/a') + '</td><td>' + A.catStage(x) + '</td></tr>'; }).join('');
      return { state: 'empty', cls: 'obj obj-record', html: '<div class="record">' + ph('', kind === 'dog' ? 'Type your dog’s age and pick their adult size.' : 'Your cat’s age in years and months, please.') + more('<table class="chart"><caption class="sr-only">Human years by age, from the AAHA-published chart</caption>' + t + '</table><p class="rest">From the <a href="' + CHART_SRC + '">AAHA-published pet age chart</a>.</p>', (kind === 'dog' ? 'Dog' : 'Cat') + ' age chart') + '</div>' };
    }
    if (!parsed.ok) return notice('Check the age', parsed.message);
    var y = parsed.years, mo = parsed.months, age = parsed.age;
    var r = kind === 'dog' ? A.dogAge(age, size) : A.catAge(age);
    if (!r.ok) return notice('Not on the chart', petChartNote(kind, r, size));
    var aged = (y ? plural(y, 'year') : '') + (y && mo ? ' and ' : '') + (mo ? plural(mo, 'month') : '');
    var src = '<a href="' + CHART_SRC + '">AAHA-published chart</a>';
    var rows = kind === 'dog'
      ? [['DNA-clock estimate', age >= 1 ? fmt(A.dogAgeEpigenetic(age)) + small('16 × ln(age) + 31, Wang et al. 2020') : '<span class="muted">not for under-ones</span>'], ['The old “× 7” rule', fmt(age * 7)]]
      : [['The old “× 7” rule', fmt(age * 7)]];
    var html = '<div class="record"><div class="rec-result"><p class="big"><span class="num">' + fmt(r.human) + '</span><span class="unit">in human years</span></p><p class="rest">' + (r.interpolated ? 'Between the chart’s figures for ages ' + r.from + ' and ' + r.to + '. ' : '') + (kind === 'cat' ? 'Life stage: ' + A.catStage(age) + '. ' : '') + 'From the ' + src + '</p></div>' + more(ledger(rows)) + '</div>';
    return { state: 'result', cls: 'obj obj-record', say: 'About ' + fmt(r.human) + ' in human years.', html: html };
  }

  /* ---------- render loop ---------- */
  function yearIsStable(f) {
    if (!f) return true;
    if (!f.el || !f.el.contains(document.activeElement)) return true;
    if (f.isPartsOpen && f.isPartsOpen() && f.parts && f.parts[2]) {
      return String(f.parts[2].value || '').replace(/\D/g, '').length >= 4;
    }
    var t = f.quick ? String(f.quick.value || '') : '';
    var nums = t.replace(/(\d)(st|nd|rd|th)\b/gi, '$1').match(/\d+/g);
    if (!nums || !nums.length) return true;
    return nums[nums.length - 1].length >= 4;
  }
  function anyUnstableYear() {
    var n, f, yb, digits;
    for (n in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, n)) continue;
      f = fields[n];
      if (f && f.el && f.el.contains(document.activeElement) && !yearIsStable(f)) return true;
    }
    yb = document.getElementById('in-year');
    if (yb && document.activeElement === yb) {
      digits = String(yb.value || '').replace(/\D/g, '');
      if (digits.length < 4) return true;
    }
    return false;
  }
  var lastHtml = '', liveTimer, moreOpen = false;
  function setLive(text) {
    var next = text || '';
    if (live.textContent === next) return;
    live.textContent = next;
  }
  leaf.addEventListener('toggle', function (e) { if (e.target.classList && e.target.classList.contains('more')) moreOpen = e.target.open;
    if (document.body.classList.contains('widget') && window.parent !== window) window.parent.postMessage({ agecalcHeight: document.documentElement.scrollHeight }, '*'); }, true);
  function go() {
    if (!ready) return;
    refreshOnLabel();
    var out = (TOOLS[tool] || TOOLS.age)();
    if (!out) return;
    var yb = document.getElementById('in-year');
    if (yb) yb.setAttribute('aria-invalid', (out.state === 'notice' && /Which year\?/.test((out.html || '') + ' ' + (out.say || ''))) ? 'true' : 'false');
    var holdNotice = out.state === 'notice' && anyUnstableYear();
    var say = holdNotice ? '' : (out.say || '');
    if (out.html === lastHtml) {
      /* Same leaf: don't rebuild DOM, and don't cancel a pending result announcement. */
      if (out.state === 'result' && out.say) return;
      if (out.state === 'notice' && say) { if (!liveTimer) setLive(say); return; }
      if (!say && !liveTimer) setLive('');
      return;
    }
    var drew = out.state === 'result' && leaf.getAttribute('data-state') !== 'result';
    lastHtml = out.html;
    leaf.innerHTML = out.html;
    leaf.className = 'leaf' + (out.cls ? ' ' + out.cls : '');
    if (moreOpen && out.state === 'result') leaf.querySelectorAll('details.more').forEach(function (d) { d.open = true; });
    var sh = '';
    for (var i = 1; i <= (out.depth || 0); i++) sh += (sh ? ', ' : '') + '0 ' + (i * 3) + 'px 0 -1px #fff, 0 ' + (i * 3) + 'px 0 0 ' + (i % 4 ? '#8f8e86' : '#1c1c1a');
    leaf.style.boxShadow = sh;
    leaf.style.marginBottom = out.depth ? (out.depth * 3 + 6) + 'px' : '';
    leaf.setAttribute('data-state', out.state);
    if (drew) { var ring = leaf.querySelector('.ring'); if (ring) ring.classList.add('draw'); }
    clearTimeout(liveTimer);
    liveTimer = null;
    if (!say) setLive('');
    else if (out.state === 'notice') setLive(say);
    else {
      if (live.textContent) setLive('');
      liveTimer = setTimeout(function () { setLive(out.say || ''); liveTimer = null; }, 700);
    }
    tick();
    if (document.body.classList.contains('widget') && window.parent !== window) window.parent.postMessage({ agecalcHeight: document.documentElement.scrollHeight }, '*');
  }
  document.querySelectorAll('[data-calc] input:not(.quick):not(.p-d):not(.p-m):not(.p-y), [data-calc] select:not(#zone)').forEach(function (i) { i.addEventListener(i.type === 'checkbox' || i.type === 'radio' ? 'change' : 'input', go); });
  var yearBox = document.getElementById('in-year');
  if (yearBox) {
    yearBox.addEventListener('blur', go);
    yearBox.addEventListener('change', go);
  }
  root.querySelectorAll('form').forEach(function (f) { f.addEventListener('submit', function (e) { e.preventDefault(); go(); }); });

  /* Refresh "today" if a tab is left open past midnight in the chosen zone.
     Honour ?today= so screenshots and tests stay pinned. */
  function refreshToday() {
    if (q.get('today')) return false;
    var next = todayIn(zone);
    if (same(next, today)) return false;
    today = next;
    fillBirthYearTable();
    setDateline();
    lastHtml = '';
    if (ready) go();
    return true;
  }

  /* Countdown clock: the only thing on the site that ticks. Seconds left are
     measured to the next midnight in the chosen zone, not a flat 86400s, so
     23- and 25-hour DST days come out right. */
  var clockTimer;
  function tick() {
    var rolled = refreshToday();
    if (rolled) return;
    var c = leaf && leaf.querySelector('[data-clock]');
    clearTimeout(clockTimer);
    var s;
    try {
      s = A.secondsUntilMidnight(zone, new Date());
    } catch (e) {
      var now = new Date();
      s = 86400 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
      if (s <= 0) s += 86400;
    }
    if (c) {
      var hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
      var dd = +c.getAttribute('data-days') || 0;
      if (dd) {
        var now = new Date();
        var left = A.msUntilLocalMidnight(zone, now, dd);
        var hrs = Math.floor(left / 3600000);
        c.textContent = fmt(hrs) + (hrs === 1 ? ' hour' : ' hours');
        var toNextHour = left % 3600000 || 3600000;
        clockTimer = setTimeout(tick, Math.min(Math.max(toNextHour, 1), 2147483647));
      }
      else { c.textContent = hh + ' h ' + String(mm).padStart(2, '0') + ' m ' + String(ss).padStart(2, '0') + ' s'; clockTimer = setTimeout(tick, 1000); }
    } else {
      clockTimer = setTimeout(tick, Math.min(Math.max(s, 1) * 1000, 2147483647));
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') tick();
  });

  /* Copy and print for the chronological-age slip */
  leaf.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'), p = e.target.closest('[data-print]');
    if (c && navigator.clipboard) navigator.clipboard.writeText(c.getAttribute('data-copy')).then(function () { var cl = c.querySelector('span') || c; cl.textContent = 'Copied'; setTimeout(function () { cl.textContent = 'Copy'; }, 1600); });
    if (p) { document.body.setAttribute('data-print', 'slip'); window.print(); }
  });
  window.addEventListener('afterprint', function () { document.body.removeAttribute('data-print'); });

  /* /past/1990/ or /past?year=1990 prefill: 1 January of that year, said out loud in the UI */
  var yearFromPath = (function () {
    var root = document.documentElement;
    if (root && root.getAttribute('data-past-year')) return root.getAttribute('data-past-year');
    var m = (location.pathname || '').match(/\/past\/(\d{4})\/?$/);
    return m ? m[1] : '';
  })();
  if (tool === 'past' && (q.get('year') || yearFromPath) && on) {
    var ys = String(q.get('year') || yearFromPath || '');
    if (/^\d{4}$/.test(ys)) {
      var yy = +ys;
      if (yy >= A.MIN_YEAR && yy <= A.MAX_YEAR) {
        onBox.hidden = false; onBtn.setAttribute('aria-expanded', 'true'); onBtn.textContent = 'Use today';
        on.set({ y: yy, m: 1, d: 1 });
        var yn = document.getElementById('year-note');
        if (yn) { yn.hidden = false; yn.textContent = 'You came here from a ' + yy + ' link, so the date is set to 1 January ' + yy + '. Change it to any day you like.'; }
      }
    }
  }

  function setDateline() {
    var dl = document.getElementById('dateline');
    if (dl) {
      var mon = M[today.m - 1];
      dl.innerHTML = '<b><span class="dl-wd">' + W[A.weekday(today.y, today.m, today.d)] + ' </span><span class="dl-long">' + today.d + ' ' + mon + ' ' + today.y + '</span><span class="dl-short">' + today.d + ' ' + mon.slice(0, 3) + ' ' + today.y + '</span></b> <span class="dl-doy">day ' + A.dayOfYear(today.y, today.m, today.d) + ' of the year</span>';
    }
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
      return '<table><caption>Ages ' + r[0] + ' to ' + r[1] + '</caption><tbody>' + rows.join('') + '</tbody></table>';
    }).join('');
  }
  window.AgeCalcPage = { go: go, fields: fields, setToday: function (d) { today = d; fillBirthYearTable(); setDateline(); go(); } };
  setDateline();
  fillBirthYearTable();
  ready = true;
  go();
})();
