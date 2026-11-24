/* agecalculator.com Google Consent Mode v2. Analytics is off until the
   visitor accepts. Never loads or fires GA on localhost, previews, or any
   host other than agecalculator.com and www.agecalculator.com. */
(function () {
  var KEY = 'agecalculator.analyticsConsent';
  var GA_MEASUREMENT_ID = 'G-DQQ5G4H336';
  var host = location.hostname;
  var isProd = host === 'agecalculator.com' || host === 'www.agecalculator.com';
  var gaTransportBlocked = false;
  var cookieSettingsOpener = null;
  var rejectedThisPage = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  function siteRoot() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      var m = src.match(/^(.*)\/consent\.js(?:\?|$)/);
      if (m) {
        return m[1].replace(/\/$/, '') + '/';
      }
    }
    return '/';
  }

  function siteRootPath() {
    try {
      return new URL(siteRoot()).pathname.replace(/\/$/, '') || '';
    } catch (e) {
      return '';
    }
  }

  function pathWithinSite(pathname) {
    var p = pathname || location.pathname;
    var root = siteRootPath();
    if (root && (p === root || p.indexOf(root + '/') === 0)) {
      p = p.slice(root.length) || '/';
    }
    p = p.replace(/\/index\.html$/i, '/');
    if (p && p.charAt(0) !== '/') {
      p = '/' + p;
    }
    return p || '/';
  }

  function isEmbedOrWidget(pathname) {
    var p = pathWithinSite(pathname).replace(/\/$/, '') || '/';
    return p === '/embed' || p === '/widget';
  }

  /* Drop the query string (dob, tz, today, on, year, a, b, start, end,
     test, in, age, months, size, had, inc, demo, and any later date or
     name parameter) and collapse /past/1990/ to /past/. */
  function sanitizeAnalyticsUrl(raw) {
    if (!raw) {
      return '';
    }
    try {
      var u = new URL(raw, location.href);
      u.search = '';
      u.hash = '';
      u.pathname = u.pathname
        .replace(/(\/past)\/\d{4}\/index\.html$/i, '$1/')
        .replace(/(\/past)\/\d{4}\/?$/, '$1/');
      return u.toString();
    } catch (e) {
      return '';
    }
  }

  function sanitizedTitle(pathname, title) {
    var p = pathWithinSite(pathname || location.pathname);
    if (/^\/past\/\d{4}\/?$/.test(p)) {
      return 'How old was I? Age on any past date';
    }
    return title || document.title || '';
  }

  function analyticsPageFields() {
    var loc = sanitizeAnalyticsUrl(location.href);
    var ref = sanitizeAnalyticsUrl(document.referrer);
    var fields = {
      page_location: loc,
      page_title: sanitizedTitle(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    };
    if (ref) {
      fields.page_referrer = ref;
    }
    return fields;
  }

  function scrubCollectUrlString(url) {
    if (!url) {
      return url;
    }
    try {
      var u = new URL(url, location.href);
      if (!/google-analytics\.com$|\.google-analytics\.com$|analytics\.google\.com$/.test(u.hostname)) {
        return url;
      }
      if (u.searchParams.has('dl')) {
        u.searchParams.set('dl', sanitizeAnalyticsUrl(u.searchParams.get('dl')));
      }
      if (u.searchParams.has('dr')) {
        var cleanedDr = sanitizeAnalyticsUrl(u.searchParams.get('dr'));
        if (cleanedDr) {
          u.searchParams.set('dr', cleanedDr);
        } else {
          u.searchParams.delete('dr');
        }
      }
      if (u.searchParams.has('dt')) {
        u.searchParams.set('dt', sanitizedTitle(undefined, u.searchParams.get('dt')));
      }
      var keys = [];
      u.searchParams.forEach(function (_, k) { keys.push(k); });
      keys.forEach(function (k) {
        if (k === 'ep.search_term') {
          u.searchParams.delete(k);
          return;
        }
        var v = u.searchParams.get(k);
        if (!v) {
          return;
        }
        if (/^https?:\/\//i.test(v) || v.charAt(0) === '/' || /[?&](dob|tz|today|on|year)=/.test(v) || /\/past\/\d{4}/.test(v)) {
          var cleaned = sanitizeAnalyticsUrl(v);
          if (cleaned) {
            u.searchParams.set(k, cleaned);
          }
        }
      });
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function scrubCollectBody(body) {
    if (typeof body !== 'string' || body.indexOf('=') === -1) {
      return body;
    }
    return body.split('\n').map(function (line) {
      if (line.indexOf('=') === -1) {
        return line;
      }
      try {
        var u = new URL(scrubCollectUrlString('https://region1.google-analytics.com/g/collect?' + line));
        return u.search.slice(1);
      } catch (e) {
        return line;
      }
    }).join('\n');
  }

  function isGaCollectUrl(url) {
    if (!url) {
      return false;
    }
    try {
      var u = new URL(typeof url === 'string' ? url : String(url), location.href);
      if (!/google-analytics\.com$|\.google-analytics\.com$|analytics\.google\.com$/.test(u.hostname)) {
        return false;
      }
      return /\/(?:g|j)\/collect(?:\?|$)|\/collect(?:\?|$)/.test(u.pathname);
    } catch (e) {
      return false;
    }
  }

  function eventNameIsForm(name) {
    return !!name && name.indexOf('form_') === 0;
  }

  function lineIsFormEvent(qs) {
    if (!qs) {
      return false;
    }
    try {
      var sp = new URLSearchParams(qs.charAt(0) === '?' ? qs.slice(1) : qs);
      return eventNameIsForm(sp.get('en'));
    } catch (e) {
      return /(?:^|[?&])en=form_/.test(qs);
    }
  }

  function urlHasFormEvent(url) {
    if (!url) {
      return false;
    }
    try {
      var u = new URL(typeof url === 'string' ? url : String(url), location.href);
      return lineIsFormEvent(u.search);
    } catch (e) {
      return false;
    }
  }

  function collectBodyText(data) {
    if (data == null) {
      return undefined;
    }
    if (typeof data === 'string') {
      return data;
    }
    try {
      if (typeof Uint8Array !== 'undefined' && data instanceof Uint8Array) {
        return new TextDecoder().decode(data);
      }
      if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) {
        return new TextDecoder().decode(data);
      }
    } catch (e) { /* ignore */ }
    return undefined;
  }

  function stripFormEventLines(body) {
    if (typeof body !== 'string' || !body) {
      return { body: body, removed: 0, kept: 0 };
    }
    var lines = body.split('\n');
    var kept = [];
    var removed = 0;
    for (var i = 0; i < lines.length; i++) {
      if (lineIsFormEvent(lines[i])) {
        removed++;
      } else {
        kept.push(lines[i]);
      }
    }
    return { body: kept.join('\n'), removed: removed, kept: kept.length };
  }

  function stripFormEventFromUrl(url) {
    try {
      var u = new URL(typeof url === 'string' ? url : String(url), location.href);
      if (eventNameIsForm(u.searchParams.get('en'))) {
        u.searchParams.delete('en');
        return u.toString();
      }
    } catch (e) { /* ignore */ }
    return url;
  }

  /* Form_* events must not be sent, but a batched /g/collect body may
     also carry ordinary events. Strip only the form_* lines and send
     the rest. Drop the request if nothing but form_* remains (including
     a single event in the URL query). */
  function prepareCollect(url, body) {
    if (!isGaCollectUrl(url)) {
      return { drop: false, url: url, body: body };
    }
    if (gaTransportBlocked || storedChoice() === 'denied') {
      return { drop: true };
    }
    var text = typeof body === 'string' ? body : collectBodyText(body);
    var stripped = stripFormEventLines(text);
    var urlForm = urlHasFormEvent(url);
    var bodyHasOther = stripped.kept > 0;
    if (urlForm && !bodyHasOther) {
      return { drop: true };
    }
    if (stripped.removed > 0 && !bodyHasOther) {
      return { drop: true };
    }
    var nextUrl = scrubCollectUrlString(urlForm ? stripFormEventFromUrl(url) : url);
    var nextBody = body;
    if (typeof text === 'string') {
      nextBody = scrubCollectBody(stripped.removed > 0 ? stripped.body : text);
    }
    return { drop: false, url: nextUrl, body: nextBody };
  }

  function shouldDropCollect(url, body) {
    return prepareCollect(url, body).drop === true;
  }

  /* Enhanced measurement can send later events (scroll, outbound click,
     form_start, form_submit) that do not always go through our config
     call. Scrub dl/dr/dt and any URL-like event parameter on the way out.
     After Reject, drop collect requests so a queued event cannot leave
     the browser. */
  function installCollectScrubber() {
    if (window.__AGECALC_GA_SCRUB) {
      return;
    }
    window.__AGECALC_GA_SCRUB = true;
    if (navigator.sendBeacon) {
      var beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        var prepared = prepareCollect(url, data);
        if (prepared.drop) {
          return true;
        }
        return beacon(prepared.url, prepared.body);
      };
    }
    if (window.fetch) {
      var origFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var fetchUrl = typeof input === 'string' ? input : (input && input.url);
        var fetchBody = init && init.body;
        if (fetchBody == null && input && typeof input !== 'string' && input.body) {
          fetchBody = input.body;
        }
        var prepared = prepareCollect(fetchUrl, typeof fetchBody === 'string' ? fetchBody : collectBodyText(fetchBody));
        if (prepared.drop) {
          return Promise.resolve(new Response(null, { status: 204, statusText: 'No Content' }));
        }
        if (typeof input === 'string') {
          input = prepared.url;
        } else if (input && input.url) {
          try {
            input = new Request(prepared.url, input);
          } catch (e) { /* keep original */ }
        }
        if (init) {
          init = Object.assign({}, init);
          if (prepared.body !== undefined) {
            init.body = prepared.body;
          }
        }
        return origFetch(input, init);
      };
    }
    if (window.XMLHttpRequest) {
      var open = XMLHttpRequest.prototype.open;
      var send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__agecalcGaUrl = url;
        if (typeof url === 'string') {
          if (isGaCollectUrl(url) && (gaTransportBlocked || storedChoice() === 'denied')) {
            this.__agecalcGaDrop = true;
            arguments[1] = 'about:blank';
          } else if (isGaCollectUrl(url)) {
            arguments[1] = scrubCollectUrlString(urlHasFormEvent(url) ? stripFormEventFromUrl(url) : url);
          }
        }
        return open.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function (body) {
        if (this.__agecalcGaDrop) {
          return;
        }
        var prepared = prepareCollect(this.__agecalcGaUrl, body);
        if (prepared.drop) {
          return;
        }
        arguments[0] = prepared.body;
        return send.apply(this, arguments);
      };
    }
    var imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (imgDesc && imgDesc.set && imgDesc.get) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true,
        enumerable: imgDesc.enumerable,
        get: function () {
          return imgDesc.get.call(this);
        },
        set: function (value) {
          if (shouldDropCollect(value)) {
            return;
          }
          if (isGaCollectUrl(value)) {
            value = scrubCollectUrlString(value);
          }
          imgDesc.set.call(this, value);
        }
      });
    }
  }
  installCollectScrubber();

  function loadGa() {
    if (!isProd || isEmbedOrWidget() || window.__AGECALC_GA_LOADED) {
      return;
    }
    if (!GA_MEASUREMENT_ID || /PLACEHOLDER|XXXXXXXX/i.test(GA_MEASUREMENT_ID)) {
      return;
    }
    window.__AGECALC_GA_LOADED = true;
    var fields = analyticsPageFields();
    window.gtag('set', {
      page_location: fields.page_location,
      page_referrer: fields.page_referrer || '',
      page_title: fields.page_title
    });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, fields);
  }

  function applyConsent(choice) {
    if (choice === 'granted') {
      gaTransportBlocked = false;
      window['ga-disable-' + GA_MEASUREMENT_ID] = false;
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      loadGa();
    } else {
      /* Order matters: tell gtag first, then disable, then drop any
         collect that was already queued (scroll and similar). Cookies
         are cleared by the Reject handler after this returns. */
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      window['ga-disable-' + GA_MEASUREMENT_ID] = true;
      gaTransportBlocked = true;
    }
  }

  function store(choice) {
    try {
      localStorage.setItem(KEY, choice);
    } catch (e) { /* ignore */ }
  }

  function clearStoredChoice() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) { /* ignore */ }
  }

  function clearGaCookies() {
    var names = [];
    var raw = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < raw.length; i++) {
      var name = raw[i].split('=')[0].trim();
      if (name === '_ga' || name === '_gid' || name === '_gat' ||
          name.indexOf('_ga_') === 0 || name.indexOf('_gat_') === 0) {
        names.push(name);
      }
    }
    var hostName = location.hostname;
    var domains = ['', hostName];
    if (hostName.indexOf('.') !== -1) {
      domains.push('.' + hostName);
      var parts = hostName.split('.');
      if (parts.length > 2) {
        domains.push('.' + parts.slice(-2).join('.'));
      }
    }
    var paths = ['/'];
    var pathName = location.pathname || '/';
    if (pathName && paths.indexOf(pathName) === -1) {
      paths.push(pathName);
    }
    if (pathName.length > 1 && pathName.charAt(pathName.length - 1) === '/') {
      var trimmed = pathName.slice(0, -1);
      if (trimmed && paths.indexOf(trimmed) === -1) {
        paths.push(trimmed);
      }
    } else if (pathName !== '/') {
      paths.push(pathName + '/');
    }
    names.forEach(function (name) {
      paths.forEach(function (path) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + path;
        domains.forEach(function (domain) {
          if (!domain) {
            return;
          }
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + path + '; domain=' + domain;
        });
      });
    });
  }

  function restoreFocus() {
    var target = cookieSettingsOpener;
    cookieSettingsOpener = null;
    if (target && document.contains(target) && typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
      } catch (e) {
        try { target.focus(); } catch (e2) { /* ignore */ }
      }
      return;
    }
    var heading = document.querySelector('main h1, [role="main"] h1, h1, main, [role="main"]');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) {
        heading.setAttribute('tabindex', '-1');
      }
      try {
        heading.focus({ preventScroll: true });
      } catch (e) {
        try { heading.focus(); } catch (e2) { /* ignore */ }
      }
    }
  }

  function hideBanner(opts) {
    var el = document.getElementById('consent-banner');
    if (el) {
      el.hidden = true;
    }
    document.documentElement.classList.remove('has-consent-banner');
    document.documentElement.classList.add('consent-chosen');
    document.body.classList.remove('has-consent-banner');
    syncBannerHeight();
    if (opts && opts.silent) {
      cookieSettingsOpener = null;
    } else {
      restoreFocus();
    }
  }

  /* Pad the page by the banner height while it is open (CSS reads
     --consent-h). The banner itself is a max-height flex container:
     the copy scrolls, and Accept/Reject stay in view. On first visit
     the copy has a two-line minimum that wins over keeping #dob-q
     clear (covering the field is acceptable until the visitor chooses).
     Prefer the full copy when it fits below the header. */
  function readSafeAreaBottom() {
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;padding-bottom:env(safe-area-inset-bottom, 0px);';
    document.body.appendChild(probe);
    var v = parseFloat(window.getComputedStyle(probe).paddingBottom) || 0;
    document.body.removeChild(probe);
    return v;
  }

  function viewHeight() {
    var vv = window.visualViewport;
    return (vv && vv.height) ? vv.height : window.innerHeight;
  }

  function fieldIsOnScreen(field) {
    if (!field) {
      return false;
    }
    var box = field.getBoundingClientRect();
    if (!box.height) {
      return false;
    }
    return box.bottom > 0 && box.top < viewHeight();
  }

  function syncCopyKeyboard(p) {
    if (!p || p.classList.contains('is-visually-hidden')) {
      if (p) {
        p.removeAttribute('tabindex');
        p.removeAttribute('role');
        p.removeAttribute('aria-label');
      }
      return;
    }
    if (p.scrollHeight > p.clientHeight + 1) {
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'region');
      p.setAttribute('aria-label', 'Cookie information');
    } else {
      p.removeAttribute('tabindex');
      p.removeAttribute('role');
      p.removeAttribute('aria-label');
    }
  }

  function syncButtonLayout(el) {
    var actions = el && el.querySelector('.consent-actions');
    var accept = document.getElementById('consent-accept');
    var reject = document.getElementById('consent-reject');
    if (!actions || !accept || !reject) {
      return;
    }
    actions.classList.remove('is-stacked');
    var clips = accept.scrollWidth > accept.clientWidth + 0.5 ||
      reject.scrollWidth > reject.clientWidth + 0.5;
    if (clips) {
      actions.classList.add('is-stacked');
    }
  }

  var bannerHeightLock = null;

  function shrinkBannerIfFieldCovered(el, p) {
    var field = document.getElementById('dob-q');
    if (!fieldIsOnScreen(field)) {
      return false;
    }
    var gap = 8;
    var fieldBottom = field.getBoundingClientRect().bottom;
    var bannerTop = el.getBoundingClientRect().top;
    if (bannerTop + 0.5 >= fieldBottom + gap) {
      return false;
    }
    var root = document.documentElement;
    var vh = viewHeight();
    var header = document.querySelector('.mast');
    var headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    var headerHardMax = Math.max(0, Math.floor(vh - headerBottom));
    var safeBottom = readSafeAreaBottom();
    var padBottom = parseFloat(window.getComputedStyle(el).paddingBottom) || 0;
    if (safeBottom > padBottom) {
      headerHardMax = Math.max(0, headerHardMax - Math.ceil(safeBottom - padBottom));
    }
    var chrome = el.offsetHeight;
    if (p) {
      var wasHidden = p.classList.contains('is-visually-hidden');
      if (!wasHidden) {
        p.classList.add('is-visually-hidden');
        chrome = el.offsetHeight;
        p.classList.remove('is-visually-hidden');
      }
    }
    var shrunk = Math.floor(vh - (fieldBottom + gap));
    if (shrunk < chrome) {
      shrunk = chrome;
    }
    if (shrunk > headerHardMax) {
      shrunk = headerHardMax;
    }
    if (bannerHeightLock != null && shrunk > bannerHeightLock) {
      shrunk = bannerHeightLock;
    }
    root.style.setProperty('--consent-banner-max', shrunk + 'px');
    var line = 22;
    if (p) {
      line = parseFloat(window.getComputedStyle(p).lineHeight);
      if (!isFinite(line) || line <= 0) {
        line = 22;
      }
    }
    var room = el.offsetHeight - chrome;
    if (p && room < line * 2) {
      p.classList.add('is-visually-hidden');
      var hiddenMax = chrome;
      if (hiddenMax > headerHardMax) {
        hiddenMax = headerHardMax;
      }
      if (bannerHeightLock != null && hiddenMax > bannerHeightLock) {
        hiddenMax = bannerHeightLock;
      }
      root.style.setProperty('--consent-banner-max', hiddenMax + 'px');
    }
    bannerHeightLock = el.offsetHeight;
    root.style.setProperty('--consent-h', bannerHeightLock + 'px');
    return true;
  }

  function syncBannerHeight(reason) {
    var el = document.getElementById('consent-banner');
    var root = document.documentElement;
    var open = el && !el.hidden && !root.classList.contains('consent-chosen');
    if (!open) {
      bannerHeightLock = null;
      root.style.removeProperty('--consent-banner-max');
      root.style.removeProperty('--consent-copy-min');
      root.style.setProperty('--consent-h', '0px');
      return;
    }
    var p = el.querySelector('.consent-copy');
    /* Scroll must not grow the reserved banner height (CLS). If a
       reopened banner now covers #dob-q, shrink it to keep the field
       clear, including any safe-area inset already in the banner box. */
    if (reason === 'scroll' && bannerHeightLock != null) {
      shrinkBannerIfFieldCovered(el, p);
      syncCopyKeyboard(p);
      return;
    }
    var header = document.querySelector('.mast');
    var field = document.getElementById('dob-q');
    var status = el.querySelector('.consent-status');
    var statusShowing = !!(status && !status.hidden && (status.textContent || '').trim());
    var firstVisit = !statusShowing;
    if (p) {
      p.classList.remove('is-visually-hidden');
    }
    el.classList.remove('is-compact');
    root.style.removeProperty('--consent-banner-max');
    root.style.removeProperty('--consent-copy-min');
    syncButtonLayout(el);

    var vh = viewHeight();
    var rem = parseFloat(window.getComputedStyle(root).fontSize) || 16;
    var cssCap = Math.min(vh * 0.5, vh - 4.5 * rem);
    if (!(cssCap > 0)) {
      cssCap = vh;
    }
    var headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    var headerHardMax = Math.max(0, Math.floor(vh - headerBottom));
    var headerCeiling = vh - headerBottom - 8;
    var fieldCeiling = headerCeiling;
    if (fieldIsOnScreen(field)) {
      var clearField = vh - field.getBoundingClientRect().bottom - 8;
      if (clearField < fieldCeiling) {
        fieldCeiling = clearField;
      }
    }
    var safeBottom = readSafeAreaBottom();
    var padBottom = parseFloat(window.getComputedStyle(el).paddingBottom) || 0;
    if (safeBottom > padBottom) {
      headerCeiling -= (safeBottom - padBottom);
      fieldCeiling -= (safeBottom - padBottom);
      headerHardMax = Math.max(0, headerHardMax - Math.ceil(safeBottom - padBottom));
    }

    function measureChrome() {
      var h = el.offsetHeight;
      if (p) {
        p.classList.add('is-visually-hidden');
        h = el.offsetHeight;
        p.classList.remove('is-visually-hidden');
      }
      return h;
    }
    var chrome = measureChrome();

    var line = 22;
    if (p) {
      line = parseFloat(window.getComputedStyle(p).lineHeight);
      if (!isFinite(line) || line <= 0) {
        line = (parseFloat(window.getComputedStyle(p).fontSize) || 15) * 1.45;
      }
    }
    var twoLines = line * 2;
    var threeLines = line * 3;

    /* Tight viewports: shrink padding so two lines of copy fit
       under the header instead of overlapping it. */
    if (firstVisit && p && chrome + twoLines > headerHardMax && !el.classList.contains('is-compact')) {
      el.classList.add('is-compact');
      chrome = measureChrome();
    }

    var maxBanner;
    if (firstVisit && p) {
      var fullCopy = p.scrollHeight;
      var minBanner = chrome + twoLines;
      var preferred = chrome + Math.max(twoLines, fullCopy);
      if (preferred < chrome + threeLines) {
        preferred = chrome + threeLines;
      }
      if (preferred <= headerCeiling) {
        maxBanner = preferred;
      } else if (minBanner <= headerCeiling) {
        maxBanner = headerCeiling;
      } else {
        maxBanner = minBanner;
      }
    } else {
      maxBanner = cssCap;
      if (fieldCeiling < maxBanner) {
        maxBanner = fieldCeiling;
      }
      if (maxBanner < chrome) {
        maxBanner = chrome;
      }
    }
    if (maxBanner < 0) {
      maxBanner = 0;
    }
    /* Never overlap the header, even by a few pixels. */
    if (maxBanner > headerHardMax) {
      maxBanner = headerHardMax;
    }
    if (maxBanner < chrome && chrome <= headerHardMax) {
      maxBanner = chrome;
    }

    if (firstVisit && p) {
      var copyMin = maxBanner - chrome;
      if (copyMin < 0) {
        copyMin = 0;
      }
      root.style.setProperty('--consent-copy-min', copyMin + 'px');
    } else {
      root.style.removeProperty('--consent-copy-min');
    }
    root.style.setProperty('--consent-banner-max', maxBanner + 'px');

    if (p && statusShowing) {
      var room = el.offsetHeight - chrome;
      if (room < twoLines) {
        p.classList.add('is-visually-hidden');
        var hiddenMax = chrome;
        if (hiddenMax > headerHardMax) {
          hiddenMax = headerHardMax;
        }
        root.style.setProperty('--consent-banner-max', hiddenMax + 'px');
      }
    }

    if (p && !firstVisit && fieldIsOnScreen(field)) {
      var overlap = field.getBoundingClientRect().bottom + 8 - el.getBoundingClientRect().top;
      if (overlap > 0) {
        var shrunk = el.offsetHeight - overlap;
        if (shrunk < chrome) {
          shrunk = chrome;
        }
        if (shrunk > headerHardMax) {
          shrunk = headerHardMax;
        }
        root.style.setProperty('--consent-banner-max', shrunk + 'px');
        room = el.offsetHeight - chrome;
        if (room < twoLines) {
          p.classList.add('is-visually-hidden');
          hiddenMax = chrome;
          if (hiddenMax > headerHardMax) {
            hiddenMax = headerHardMax;
          }
          root.style.setProperty('--consent-banner-max', hiddenMax + 'px');
        } else {
          p.classList.remove('is-visually-hidden');
        }
      }
    }
    syncButtonLayout(el);
    bannerHeightLock = el.offsetHeight;
    root.style.setProperty('--consent-h', bannerHeightLock + 'px');
    syncCopyKeyboard(p);
  }

  var syncRaf = 0;
  var syncReason = 'layout';
  function requestSyncBannerHeight(reason) {
    if (reason === 'layout' || reason === 'resize' || reason === 'orientation') {
      syncReason = 'layout';
      bannerHeightLock = null;
    } else if (syncReason !== 'layout') {
      syncReason = reason || 'scroll';
    }
    if (syncRaf) {
      return;
    }
    syncRaf = window.requestAnimationFrame(function () {
      syncRaf = 0;
      var why = syncReason;
      syncReason = 'scroll';
      syncBannerHeight(why);
    });
  }
  window.addEventListener('resize', function () { requestSyncBannerHeight('layout'); });
  window.addEventListener('orientationchange', function () { requestSyncBannerHeight('layout'); });
  window.addEventListener('scroll', function () { requestSyncBannerHeight('scroll'); }, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () { requestSyncBannerHeight('layout'); });
    window.visualViewport.addEventListener('scroll', function () { requestSyncBannerHeight('scroll'); });
  }

  var STASH_KEY = 'agecalculator.consentReloadStash';

  function stashPageForReload() {
    var data = {
      path: location.pathname,
      search: location.search,
      scrollX: window.scrollX || 0,
      scrollY: window.scrollY || 0,
      fields: {}
    };
    var nodes = document.querySelectorAll('input, textarea, select');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.type === 'hidden' || el.type === 'password' || el.type === 'file') {
        continue;
      }
      var key = el.id || el.name;
      if (!key) {
        continue;
      }
      if (el.type === 'checkbox' || el.type === 'radio') {
        data.fields[key] = { type: el.type, checked: !!el.checked, value: el.value, name: el.name || '' };
      } else {
        data.fields[key] = { type: el.type || el.tagName.toLowerCase(), value: el.value, name: el.name || '' };
      }
    }
    try {
      sessionStorage.setItem(STASH_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function restoreReloadStash() {
    var raw;
    try {
      raw = sessionStorage.getItem(STASH_KEY);
      sessionStorage.removeItem(STASH_KEY);
    } catch (e) {
      return;
    }
    if (!raw) {
      return;
    }
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (data.path && data.path !== location.pathname) {
      return;
    }
    var fields = data.fields || {};
    Object.keys(fields).forEach(function (key) {
      var f = fields[key];
      var el = document.getElementById(key);
      if (!el && f.name) {
        if (f.type === 'radio') {
          el = document.querySelector('input[type="radio"][name="' + f.name + '"][value="' + String(f.value).replace(/"/g, '') + '"]');
        } else {
          el = document.querySelector('[name="' + f.name + '"]');
        }
      }
      if (!el) {
        return;
      }
      if (f.type === 'checkbox' || f.type === 'radio') {
        el.checked = !!f.checked;
      } else if (typeof f.value === 'string') {
        el.value = f.value;
      }
      try {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (err) { /* ignore */ }
    });
    if (typeof data.scrollY === 'number') {
      window.scrollTo(data.scrollX || 0, data.scrollY);
    }
    window.setTimeout(function () {
      var link = document.querySelector('footer a[href="#cookie-settings"]');
      var status = document.querySelector('#consent-banner .consent-status');
      var target = link || (status && !status.hidden ? status : null);
      if (!target) {
        return;
      }
      if (target === status && !status.hasAttribute('tabindex')) {
        status.setAttribute('tabindex', '-1');
      }
      try {
        target.focus({ preventScroll: true });
      } catch (err) {
        try { target.focus(); } catch (err2) { /* ignore */ }
      }
    }, 0);
  }

  function applyChoiceFromOtherContext() {
    var choice = storedChoice();
    if (choice === 'denied') {
      rejectedThisPage = true;
      applyConsent('denied');
      clearGaCookies();
      var el = document.getElementById('consent-banner');
      if (el && !el.hidden) {
        updateBannerChoiceState(el);
      }
      hideBanner({ silent: true });
    } else if (choice === 'granted') {
      /* Another tab accepted. Don't start gtag here if this tab has
         never loaded it (or had withdrawn): a reload or navigation
         will start a fresh client. Just hide an open first-visit banner. */
      var banner = document.getElementById('consent-banner');
      if (banner && !banner.hidden &&
          !document.documentElement.classList.contains('consent-chosen')) {
        hideBanner({ silent: true });
      } else if (banner && !banner.hidden) {
        updateBannerChoiceState(banner);
      }
    }
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== KEY && event.key !== null) {
      return;
    }
    applyChoiceFromOtherContext();
  });
  window.addEventListener('pageshow', function () {
    applyChoiceFromOtherContext();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      applyChoiceFromOtherContext();
    }
  });

  function placeBanner(el) {
    var skip = document.querySelector('.skip');
    if (skip && skip.parentNode) {
      skip.insertAdjacentElement('afterend', el);
    } else if (document.body.firstChild) {
      document.body.insertBefore(el, document.body.firstChild);
    } else {
      document.body.appendChild(el);
    }
  }

  function bindBannerButtons(el) {
    if (el.getAttribute('data-bound') === '1') {
      return;
    }
    el.setAttribute('data-bound', '1');
    var accept = document.getElementById('consent-accept');
    var reject = document.getElementById('consent-reject');
    if (accept) {
      accept.addEventListener('click', function () {
        store('granted');
        /* A re-Accept after Reject on the same page would otherwise
           revive the withdrawn client id. Reload so gtag starts fresh. */
        if (rejectedThisPage) {
          stashPageForReload();
          location.reload();
          return;
        }
        applyConsent('granted');
        hideBanner();
      });
    }
    if (reject) {
      reject.addEventListener('click', function () {
        rejectedThisPage = true;
        store('denied');
        applyConsent('denied');
        clearGaCookies();
        hideBanner();
      });
    }
    var copy = el.querySelector('.consent-copy');
    if (copy && copy.getAttribute('data-scroll-bound') !== '1') {
      copy.setAttribute('data-scroll-bound', '1');
      var privacyLink = copy.querySelector('a');
      if (privacyLink) {
        privacyLink.addEventListener('focus', function () {
          try {
            privacyLink.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          } catch (e) { /* ignore */ }
        });
      }
      copy.addEventListener('keydown', function (event) {
        if (copy.scrollHeight <= copy.clientHeight + 1) {
          return;
        }
        var step = parseFloat(window.getComputedStyle(copy).lineHeight) || 22;
        var max = copy.scrollHeight - copy.clientHeight;
        var top = copy.scrollTop;
        if (event.key === 'ArrowDown') {
          copy.scrollTop = Math.min(max, top + step);
          event.preventDefault();
        } else if (event.key === 'ArrowUp') {
          copy.scrollTop = Math.max(0, top - step);
          event.preventDefault();
        } else if (event.key === 'PageDown' || event.key === ' ') {
          copy.scrollTop = Math.min(max, top + copy.clientHeight);
          event.preventDefault();
        } else if (event.key === 'PageUp') {
          copy.scrollTop = Math.max(0, top - copy.clientHeight);
          event.preventDefault();
        } else if (event.key === 'Home') {
          copy.scrollTop = 0;
          event.preventDefault();
        } else if (event.key === 'End') {
          copy.scrollTop = max;
          event.preventDefault();
        }
      });
    }
  }

  function bannerStrings() {
    var root = siteRoot();
    return {
      aria_label: 'Analytics cookies',
      text: 'This site uses Google Analytics only if you accept. If you don’t, no analytics cookies are set. The dates you type are never sent. See the <a href="' + root + 'privacy/">privacy page</a>.',
      accept: 'Accept',
      reject: 'Reject',
      on: 'Analytics is currently on.',
      off: 'Analytics is currently off.'
    };
  }

  function storedChoice() {
    try {
      var c = localStorage.getItem(KEY);
      if (c === 'granted' || c === 'denied') {
        return c;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function updateBannerChoiceState(el) {
    if (!el) {
      return;
    }
    var choice = storedChoice();
    var t = bannerStrings();
    var accept = document.getElementById('consent-accept');
    var reject = document.getElementById('consent-reject');
    var status = el.querySelector('.consent-status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'consent-status';
      var copy = el.querySelector('.consent-copy');
      if (copy && copy.parentNode) {
        copy.insertAdjacentElement('afterend', status);
      } else {
        el.insertBefore(status, el.querySelector('.consent-actions'));
      }
    }
    if (choice === 'granted') {
      status.hidden = false;
      status.textContent = t.on;
      if (accept) {
        accept.setAttribute('aria-pressed', 'true');
        accept.classList.add('is-selected');
      }
      if (reject) {
        reject.setAttribute('aria-pressed', 'false');
        reject.classList.remove('is-selected');
      }
    } else if (choice === 'denied') {
      status.hidden = false;
      status.textContent = t.off;
      if (reject) {
        reject.setAttribute('aria-pressed', 'true');
        reject.classList.add('is-selected');
      }
      if (accept) {
        accept.setAttribute('aria-pressed', 'false');
        accept.classList.remove('is-selected');
      }
    } else {
      status.hidden = true;
      status.textContent = '';
      if (accept) {
        accept.removeAttribute('aria-pressed');
        accept.classList.remove('is-selected');
      }
      if (reject) {
        reject.removeAttribute('aria-pressed');
        reject.classList.remove('is-selected');
      }
    }
  }

  function showBanner() {
    if (isEmbedOrWidget() && pathWithinSite().replace(/\/$/, '') === '/widget') {
      return;
    }
    var el = document.getElementById('consent-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'consent-banner';
      el.setAttribute('role', 'region');
      var t = bannerStrings();
      el.setAttribute('aria-label', t.aria_label);
      el.setAttribute('tabindex', '-1');
      el.innerHTML =
        '<div class="consent-text">' +
        '<p class="consent-copy">' + t.text + '</p>' +
        '<p class="consent-status" hidden></p>' +
        '</div>' +
        '<div class="consent-actions">' +
        '<button type="button" id="consent-accept">' + t.accept + '</button>' +
        '<button type="button" id="consent-reject">' + t.reject + '</button>' +
        '</div>';
      placeBanner(el);
    }
    el.hidden = false;
    document.documentElement.classList.add('has-consent-banner');
    document.documentElement.classList.remove('consent-chosen');
    document.body.classList.add('has-consent-banner');
    updateBannerChoiceState(el);
    bannerHeightLock = null;
    syncBannerHeight('layout');
    bindBannerButtons(el);
  }

  function focusBanner() {
    var banner = document.getElementById('consent-banner');
    if (!banner) {
      return;
    }
    if (!banner.hasAttribute('tabindex')) {
      banner.setAttribute('tabindex', '-1');
    }
    try {
      banner.focus({ preventScroll: true });
    } catch (err) {
      banner.focus();
    }
  }

  /* Never stores a choice of its own. Withdrawal happens only when the
     visitor presses Reject. If the first-visit banner is already open
     and nothing is stored, this just focuses the banner. */
  function openCookieSettings(event) {
    if (event) {
      event.preventDefault();
      var link = event.target && event.target.closest &&
          event.target.closest('a[href="#cookie-settings"]');
      if (link) {
        cookieSettingsOpener = link;
      }
    }
    var el = document.getElementById('consent-banner');
    var alreadyOpen = !!(el && !el.hidden &&
      !document.documentElement.classList.contains('consent-chosen'));
    if (alreadyOpen) {
      updateBannerChoiceState(el);
      focusBanner();
      return;
    }
    showBanner();
    focusBanner();
  }

  window.agecalcOpenCookieSettings = openCookieSettings;

  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest &&
        event.target.closest('a[href="#cookie-settings"]');
    if (link) {
      openCookieSettings(event);
    }
  });

  var choice = null;
  try {
    choice = localStorage.getItem(KEY);
  } catch (e) {
    choice = null;
  }

  function init() {
    if (isEmbedOrWidget() && pathWithinSite().replace(/\/$/, '') === '/widget') {
      return;
    }
    if (choice === 'granted' || choice === 'denied') {
      applyConsent(choice);
      hideBanner({ silent: true });
    } else {
      showBanner();
    }
    restoreReloadStash();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
