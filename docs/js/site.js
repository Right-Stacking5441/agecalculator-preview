(function () {
  "use strict";
  var M = window.AgeMath;
  if (!M) return;

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  function fillDateInput(id, dateObj) {
    var el = $(id);
    if (el && dateObj) el.value = M.toISO(dateObj);
  }

  function readDate(id) {
    var el = $(id);
    if (!el || !el.value) return null;
    return M.fromISO(el.value);
  }

  function readNumber(id) {
    var el = $(id);
    if (!el || el.value === "") return null;
    var n = Number(el.value);
    return Number.isFinite(n) ? n : null;
  }

  function show(el, on) {
    if (!el) return;
    if (on) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  }

  function formatInt(n) {
    return Number(n).toLocaleString("en-GB");
  }

  function stampToday() {
    var today = M.todayLocal();
    var zone = M.timeZoneName();
    var el = $("today-stamp");
    if (el) el.textContent = M.formatDate(today) + ", " + zone;
    return { today: today, zone: zone };
  }

  function countdownPhrase(next) {
    if (next.isToday) return "Today is the birthday.";
    if (next.days === 1) return "The next birthday is tomorrow, " + M.formatDate(next.date) + ".";
    if (next.months === 0) {
      return "The next birthday is " + M.formatDate(next.date) + ", in " + M.plural(next.days, "day") + ".";
    }
    return (
      "The next birthday is " +
      M.formatDate(next.date) +
      ", in " +
      M.plural(next.months, "month") +
      " and " +
      M.plural(next.leftoverDays, "day") +
      " (" +
      formatInt(next.days) +
      " days)."
    );
  }

  function fillFigures(t, opts) {
    setText("fig-ymd", M.formatYMD(t));
    setText("fig-chrono", M.formatChrono(t));
    setText("fig-months", formatInt(t.totalMonths) + " complete months, plus " + M.plural(t.days, "day"));
    setText("fig-weeks", formatInt(t.totalWeeks) + " weeks and " + M.plural(t.weekRemainder, "day"));
    setText("fig-days", formatInt(t.totalDays) + " days");
    setText("fig-hours", formatInt(t.totalHours) + " hours");
    if (opts && opts.nextFrom && opts.to) {
      var next = M.nextBirthday(opts.nextFrom, opts.to);
      if (!next.error) setText("fig-next", countdownPhrase(next));
    }
  }

  function renderAge(opts) {
    var result = $("result");
    var error = $("error");
    var from = opts.from;
    var to = opts.to;
    if (!from || !to) {
      show(result, false);
      show(error, false);
      return null;
    }
    var t = M.totals(from, to);
    if (t.error) {
      setText("error", t.error);
      show(error, true);
      show(result, false);
      return null;
    }
    show(error, false);
    setText("record", opts.sentence(t));
    fillFigures(t, opts);
    show(result, true);
    return t;
  }

  function onSubmit(form, fn) {
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      fn();
    });
  }

  function bindDates(ids, fn) {
    ids.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("change", fn);
      el.addEventListener("input", fn);
    });
  }

  function bindHome() {
    var stamp = stampToday();
    fillDateInput("asof", stamp.today);
    var natural = $("natural");

    function applyNatural() {
      if (!natural || !natural.value.trim()) return;
      var parsed = M.parseFlexibleDate(natural.value);
      var hint = $("natural-status");
      if (parsed) {
        fillDateInput("birth", parsed);
        if (hint) hint.textContent = "Read as " + M.formatDate(parsed) + ".";
        update();
      } else if (hint) {
        hint.textContent = "Could not read that date. Try 15 March 1995, 3/15/95, or 1995-03-15.";
      }
    }

    function updateKorean(from, to) {
      var box = $("korean-box");
      var toggle = $("korean-toggle");
      if (!box || !toggle) return;
      if (!toggle.checked || !from || !to) {
        show(box, false);
        return;
      }
      var k = M.koreanAge(from, to);
      if (k.error) {
        show(box, false);
        return;
      }
      setText(
        "korean-line",
        "International age: " +
          k.international +
          ". Year age: " +
          k.yearAge +
          ". Traditional Korean age (se): " +
          k.se +
          "."
      );
      show(box, true);
    }

    function update() {
      var from = readDate("birth");
      var to = readDate("asof");
      var t = renderAge({
        from: from,
        to: to,
        nextFrom: from,
        sentence: function (tot) {
          return (
            "Born " +
            M.formatDate(from) +
            ". On " +
            M.formatDate(to) +
            " this person is " +
            M.formatYMD(tot) +
            " old."
          );
        }
      });
      updateKorean(from, to);
      return t;
    }

    if (natural) {
      natural.addEventListener("change", applyNatural);
      natural.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          applyNatural();
        }
      });
    }
    bindDates(["birth", "asof"], update);
    if ($("korean-toggle")) $("korean-toggle").addEventListener("change", update);
    onSubmit($("age-form"), function () {
      applyNatural();
      update();
    });
  }

  function yearFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var raw = params.get("year");
    if (!raw) return null;
    var year = Number(raw);
    if (!Number.isInteger(year) || year < 1 || year > 9999) return null;
    return year;
  }

  function bindPast() {
    stampToday();
    var year = yearFromQuery();
    var today = M.todayLocal();
    if (year) {
      var heading = $("page-title");
      if (heading) heading.textContent = "How old was I in " + year + "?";
      if (year === today.y) fillDateInput("asof", today);
      else fillDateInput("asof", M.date(year, 1, 1));
      var def = $("year-default");
      if (def) {
        def.textContent =
          year === today.y
            ? "The date is set to today, because " + year + " is the current year. You can change it."
            : "The date is set to 1 January " + year + ", because “in " + year + "” is not a single day. You can change it.";
      }
    }
    function update() {
      var from = readDate("birth");
      var to = readDate("asof");
      renderAge({
        from: from,
        to: to,
        sentence: function (t) {
          return (
            "On " +
            M.formatDate(to) +
            " a person born on " +
            M.formatDate(from) +
            " was " +
            M.formatYMD(t) +
            " old."
          );
        }
      });
    }
    bindDates(["birth", "asof"], update);
    onSubmit($("age-form"), update);
  }

  function bindDifference() {
    stampToday();
    function update() {
      var a = readDate("first");
      var b = readDate("second");
      if (!a || !b) {
        show($("result"), false);
        show($("error"), false);
        return;
      }
      var from = a;
      var to = b;
      var swapped = false;
      if (M.compare(b, a) < 0) {
        from = b;
        to = a;
        swapped = true;
      }
      renderAge({
        from: from,
        to: to,
        sentence: function (t) {
          if (M.equal(a, b)) {
            return "The two dates are the same day. The difference is 0 years, 0 months and 0 days.";
          }
          return (
            M.formatDate(to) +
            " is " +
            M.formatYMD(t) +
            " after " +
            M.formatDate(from) +
            "." +
            (swapped ? " The dates were placed in chronological order." : "")
          );
        }
      });
    }
    bindDates(["first", "second"], update);
    onSubmit($("age-form"), update);
  }

  function bindDays() {
    stampToday();
    function update() {
      var a = readDate("first");
      var b = readDate("second");
      if (!a || !b) {
        show($("result"), false);
        show($("error"), false);
        return;
      }
      var from = M.compare(a, b) <= 0 ? a : b;
      var to = M.compare(a, b) <= 0 ? b : a;
      renderAge({
        from: from,
        to: to,
        sentence: function (t) {
          if (M.equal(from, to)) return "The two dates are the same calendar day: 0 days sit between them.";
          return (
            "There are " +
            formatInt(t.totalDays) +
            " days between " +
            M.formatDate(from) +
            " and " +
            M.formatDate(to) +
            " — " +
            M.formatYMD(t) +
            "."
          );
        }
      });
    }
    bindDates(["first", "second"], update);
    onSubmit($("age-form"), update);
  }

  function bindChrono() {
    stampToday();
    function update() {
      var from = readDate("birth");
      var to = readDate("asof");
      var t = renderAge({
        from: from,
        to: to,
        sentence: function (tot) {
          return (
            "Chronological age on " +
            M.formatDate(to) +
            ": " +
            M.formatChrono(tot) +
            " (" +
            M.formatYMD(tot) +
            ")."
          );
        }
      });
      if (t && $("slip-body")) {
        setText(
          "slip-body",
          "Date of birth: " +
            M.formatDate(from) +
            "\nTest date: " +
            M.formatDate(to) +
            "\nChronological age: " +
            M.formatChrono(t) +
            " (" +
            M.formatYMD(t) +
            ")"
        );
      }
    }
    var copyBtn = $("copy-result");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = $("slip-body") && $("slip-body").textContent;
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            copyBtn.textContent = "Copied";
            setTimeout(function () { copyBtn.textContent = "Copy result"; }, 1500);
          });
        }
      });
    }
    bindDates(["birth", "asof"], update);
    onSubmit($("age-form"), update);
  }

  function bindCountdown() {
    stampToday();
    fillDateInput("asof", M.todayLocal());
    function update() {
      var birth = readDate("birth");
      var asOf = readDate("asof") || M.todayLocal();
      var result = $("result");
      var error = $("error");
      if (!birth) {
        show(result, false);
        show(error, false);
        return;
      }
      var next = M.nextBirthday(birth, asOf);
      if (next.error) {
        setText("error", next.error);
        show(error, true);
        show(result, false);
        return;
      }
      show(error, false);
      setText("record", countdownPhrase(next));
      setText("fig-ymd", next.isToday ? "0 days" : formatInt(next.days) + " days");
      setText(
        "fig-months",
        next.isToday ? "Today" : M.plural(next.months, "month") + " and " + M.plural(next.leftoverDays, "day")
      );
      show(result, true);
    }
    bindDates(["birth", "asof"], update);
    onSubmit($("age-form"), update);
  }

  function bindFuture() {
    var stamp = stampToday();
    fillDateInput("asof", M.date(2050, 1, 1));
    function update() {
      var from = readDate("birth");
      var to = readDate("asof");
      renderAge({
        from: from,
        to: to,
        nextFrom: from,
        sentence: function (t) {
          return (
            "On " +
            M.formatDate(to) +
            " a person born on " +
            M.formatDate(from) +
            " will be " +
            M.formatYMD(t) +
            " old."
          );
        }
      });
    }
    bindDates(["birth", "asof"], update);
    onSubmit($("age-form"), update);
  }

  function bindKorean() {
    stampToday();
    fillDateInput("asof", M.todayLocal());
    function update() {
      var from = readDate("birth");
      var to = readDate("asof");
      var result = $("result");
      var error = $("error");
      if (!from || !to) {
        show(result, false);
        show(error, false);
        return;
      }
      var k = M.koreanAge(from, to);
      if (k.error) {
        setText("error", k.error);
        show(error, true);
        show(result, false);
        return;
      }
      show(error, false);
      setText(
        "record",
        "On " +
          M.formatDate(to) +
          " a person born on " +
          M.formatDate(from) +
          " has an international age of " +
          k.international +
          ", a year age of " +
          k.yearAge +
          ", and a traditional Korean age (se) of " +
          k.se +
          "."
      );
      setText("fig-ymd", M.formatYMD(k.ymd));
      setText("fig-intl", String(k.international));
      setText("fig-year-age", String(k.yearAge));
      setText("fig-se", String(k.se));
      show(result, true);
    }
    bindDates(["birth", "asof"], update);
    onSubmit($("age-form"), update);
  }

  function bindDog() {
    function size() {
      var el = document.querySelector('input[name="size"]:checked');
      return el ? el.value : "medium";
    }
    function update() {
      var years = readNumber("pet-years");
      var months = readNumber("pet-months") || 0;
      var result = $("result");
      var error = $("error");
      if (years == null) {
        show(result, false);
        show(error, false);
        return;
      }
      var total = years + months / 12;
      var got = M.dogHumanYears(total, size());
      if (got.error) {
        setText("error", got.error);
        show(error, true);
        show(result, false);
        return;
      }
      show(error, false);
      setText(
        "record",
        "A " +
          size() +
          " dog of " +
          years +
          " years" +
          (months ? " and " + months + " months" : "") +
          " is about " +
          got.humanYears +
          " human years on this size table — not " +
          Math.round(total * 7 * 10) / 10 +
          ", which is the old times-seven figure."
      );
      setText("fig-ymd", got.humanYears + " human years (estimate)");
      show(result, true);
    }
    ["pet-years", "pet-months"].forEach(function (id) {
      if ($(id)) {
        $(id).addEventListener("input", update);
        $(id).addEventListener("change", update);
      }
    });
    document.querySelectorAll('input[name="size"]').forEach(function (el) {
      el.addEventListener("change", update);
    });
    onSubmit($("age-form"), update);
  }

  function bindCat() {
    function update() {
      var years = readNumber("pet-years");
      var months = readNumber("pet-months") || 0;
      var result = $("result");
      var error = $("error");
      if (years == null) {
        show(result, false);
        show(error, false);
        return;
      }
      var total = years + months / 12;
      var got = M.catHumanYears(total);
      if (got.error) {
        setText("error", got.error);
        show(error, true);
        show(result, false);
        return;
      }
      show(error, false);
      setText(
        "record",
        "A cat of " +
          years +
          " years" +
          (months ? " and " + months + " months" : "") +
          " is about " +
          got.humanYears +
          " human years on the usual 15 / 24 / plus-four curve."
      );
      setText("fig-ymd", got.humanYears + " human years (estimate)");
      show(result, true);
    }
    ["pet-years", "pet-months"].forEach(function (id) {
      if ($(id)) {
        $(id).addEventListener("input", update);
        $(id).addEventListener("change", update);
      }
    });
    onSubmit($("age-form"), update);
  }

  function bindBorn() {
    var stamp = stampToday();
    fillDateInput("asof", stamp.today);
    function update() {
      var age = readNumber("age-years");
      var asOf = readDate("asof");
      var result = $("result");
      var error = $("error");
      if (age == null || !asOf) {
        show(result, false);
        show(error, false);
        return;
      }
      var w = M.birthWindowFromAge(Math.trunc(age), asOf);
      if (w.error) {
        setText("error", w.error);
        show(error, true);
        show(result, false);
        return;
      }
      show(error, false);
      setText(
        "record",
        "Someone who is " +
          Math.trunc(age) +
          " years old on " +
          M.formatDate(asOf) +
          " was born on or after " +
          M.formatDate(w.earliest) +
          " and on or before " +
          M.formatDate(w.latest) +
          " — so in " +
          w.years.join(" or ") +
          "."
      );
      setText("fig-ymd", w.years.join(" or "));
      show(result, true);
    }
    if ($("age-years")) {
      $("age-years").addEventListener("input", update);
      $("age-years").addEventListener("change", update);
    }
    bindDates(["asof"], update);
    onSubmit($("age-form"), update);
  }

  var page = document.body.getAttribute("data-page");
  if (page === "home") bindHome();
  if (page === "past") bindPast();
  if (page === "difference") bindDifference();
  if (page === "days") bindDays();
  if (page === "chrono") bindChrono();
  if (page === "countdown") bindCountdown();
  if (page === "future") bindFuture();
  if (page === "korean") bindKorean();
  if (page === "dog") bindDog();
  if (page === "cat") bindCat();
  if (page === "born") bindBorn();
})();
