/* Calculators nav: iPhone-style touch (WebKit), Android touch, desktop
   click/keyboard (Chromium), and a bfcache restore.
   Run: PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 node tests/nav-menu.js
   Serves docs/ unless BASE_URL is set. */
'use strict';

const { startServer } = require('./static_server');

function bootServer() {
  if (process.env.BASE_URL) return Promise.resolve({ url: process.env.BASE_URL, close() {} });
  return startServer();
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    throw new Error('playwright is not installed. Add it or set NODE_PATH to a playwright install.');
  }
}

async function state(page) {
  return page.evaluate(() => {
    const menu = document.querySelector('details.nav-menu');
    const summary = menu && menu.querySelector('summary');
    const list = menu && menu.querySelector('ul');
    const cs = list ? getComputedStyle(list) : null;
    const mast = document.querySelector('header.mast');
    return {
      exists: !!menu,
      open: !!(menu && menu.open),
      aria: summary ? summary.getAttribute('aria-expanded') : null,
      visible: !!(cs && cs.display !== 'none' && cs.visibility !== 'hidden'),
      mastHeight: mast ? Math.round(mast.getBoundingClientRect().height) : 0,
      bandTop: (document.querySelector('.band, main, #main') || document.body).getBoundingClientRect().top,
    };
  });
}

function assert(cond, msg, extra) {
  if (!cond) {
    const detail = extra ? ' ' + JSON.stringify(extra) : '';
    throw new Error(msg + detail);
  }
}

async function expectOpen(page, open, label) {
  const s = await state(page);
  assert(s.exists, label + ': menu missing', s);
  assert(s.open === open, label + ': open=' + s.open + ' expected ' + open, s);
  assert(s.visible === open, label + ': visible=' + s.visible + ' expected ' + open, s);
  assert(s.aria === (open ? 'true' : 'false'), label + ': aria-expanded=' + s.aria, s);
  return s;
}

async function tapLocator(page, locator, useTouch) {
  if (useTouch) {
    const box = await locator.boundingBox();
    assert(box && box.width > 0 && box.height > 0, 'no bounding box for tap');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await locator.click();
  }
}

async function tapOutside(page, useTouch) {
  // A point well below the mast, away from the dropdown (dropdown is top-right).
  const pt = await page.evaluate(() => {
    const mast = document.querySelector('header.mast');
    const y = (mast ? mast.getBoundingClientRect().bottom : 56) + 80;
    return { x: 24, y: Math.min(y, 400) };
  });
  if (useTouch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
}

async function cycleOpenClose(page, useTouch, label) {
  const summary = page.locator('details.nav-menu summary');
  const before = await expectOpen(page, false, label + ' start');
  await tapLocator(page, summary, useTouch);
  const opened = await expectOpen(page, true, label + ' opened');
  assert(opened.mastHeight === before.mastHeight, label + ': mast height changed (CLS)', { before, opened });
  assert(Math.abs(opened.bandTop - before.bandTop) < 1, label + ': content shifted (CLS)', { before, opened });

  await tapLocator(page, summary, useTouch);
  await expectOpen(page, false, label + ' closed by toggle');

  await tapLocator(page, summary, useTouch);
  await expectOpen(page, true, label + ' opened again');
  await tapOutside(page, useTouch);
  await expectOpen(page, false, label + ' closed outside');

  await tapLocator(page, summary, useTouch);
  await expectOpen(page, true, label + ' opened for Esc');
  await page.keyboard.press('Escape');
  await expectOpen(page, false, label + ' closed by Esc');
  const focused = await page.evaluate(() => {
    const s = document.querySelector('details.nav-menu summary');
    return document.activeElement === s;
  });
  assert(focused, label + ': Escape did not return focus to the toggle');
}

async function hrefsOf(page) {
  return page.locator('details.nav-menu ul a').evaluateAll(as =>
    as.map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() }))
  );
}

function pathOf(url) {
  const u = new URL(url);
  let p = u.pathname;
  if (p.endsWith('/index.html')) p = p.slice(0, -10) || '/';
  if (p.endsWith('.html')) p = p.slice(0, -5);
  if (p === '') p = '/';
  return p;
}

function expectedPath(fromUrl, href) {
  return pathOf(new URL(href, fromUrl).href);
}

async function tapEveryLink(page, base, useTouch, label) {
  const start = base + '/';
  await page.goto(start, { waitUntil: 'domcontentloaded' });
  const links = await hrefsOf(page);
  assert(links.length >= 10, label + ': expected a full calculators list', links);
  for (const link of links) {
    await page.goto(start, { waitUntil: 'domcontentloaded' });
    const summary = page.locator('details.nav-menu summary');
    await tapLocator(page, summary, useTouch);
    await expectOpen(page, true, label + ' before ' + link.text);
    const loc = page.locator('details.nav-menu ul a', { hasText: new RegExp('^' + link.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') });
    const dest = expectedPath(start, link.href);
    const already = pathOf(page.url()) === dest;
    const hrefOf = (url) => pathOf(typeof url === 'string' ? url : url.href || String(url));
    if (already) {
      await tapLocator(page, loc, useTouch);
      await page.waitForTimeout(50);
    } else {
      try {
        await Promise.all([
          page.waitForURL((url) => hrefOf(url) === dest, { timeout: 5000 }),
          tapLocator(page, loc, useTouch),
        ]);
      } catch (e) {
        throw new Error(label + ' link "' + link.text + '" did not navigate: ' + String(e.message || e).split('\n')[0] + ' now=' + page.url());
      }
    }
    assert(pathOf(page.url()) === dest, label + ' landed wrong for ' + link.text, { url: page.url(), href: link.href });
    // Menu on the new page must start closed and still toggle.
    if (pathOf(page.url()) !== '/widget') {
      await expectOpen(page, false, label + ' arrived ' + link.text);
      await tapLocator(page, page.locator('details.nav-menu summary'), useTouch);
      await expectOpen(page, true, label + ' re-open on ' + link.text);
      await tapLocator(page, page.locator('details.nav-menu summary'), useTouch);
      await expectOpen(page, false, label + ' re-close on ' + link.text);
    }
  }
}

async function desktopKeyboard(page, base) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  const summary = page.locator('details.nav-menu summary');
  await summary.focus();
  await page.keyboard.press(' ');
  await expectOpen(page, true, 'keyboard Space open');
  await page.keyboard.press('Escape');
  await expectOpen(page, false, 'keyboard Esc close');
  await page.keyboard.press('Enter');
  await expectOpen(page, true, 'keyboard Enter open');
  await page.keyboard.press('Escape');
  await expectOpen(page, false, 'keyboard Esc again');
  // Tab from the toggle into the first link once open, then Enter to follow it.
  await page.keyboard.press('Enter');
  await expectOpen(page, true, 'keyboard open for Tab');
  await page.keyboard.press('Tab');
  const tag = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
  const inMenu = await page.evaluate(() => {
    const a = document.activeElement;
    return !!(a && a.closest && a.closest('details.nav-menu'));
  });
  assert(tag === 'A' && inMenu, 'Tab from the toggle did not land on a menu link', { tag, inMenu });
}

async function run() {
  const { webkit, chromium, devices } = loadPlaywright();
  const server = await bootServer();
  const failures = [];
  const log = [];
  const say = (m) => { log.push(m); console.log(m); };

  async function check(name, fn) {
    try {
      const result = await fn();
      if (result === 'skip') say('SKIP  ' + name + ' (not asserted)');
      else say('PASS  ' + name);
    } catch (e) {
      failures.push(name + ': ' + e.message);
      say('FAIL  ' + name + '\n  ' + e.message);
    }
  }

  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS || '1';

  const iPhones = [
    { name: 'iPhone 13', device: { ...devices['iPhone 13'], hasTouch: true } },
    { name: 'iPhone SE', device: { ...devices['iPhone SE'], hasTouch: true } },
  ];

  const wk = await webkit.launch({ headless: true });
  for (const phone of iPhones) {
    const ctx = await wk.newContext(phone.device);
    const page = await ctx.newPage();
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    await check('WebKit ' + phone.name + ' 10 open/close cycles', async () => {
      for (let i = 1; i <= 10; i++) {
        await cycleOpenClose(page, true, phone.name + ' cycle ' + i);
      }
    });
    await check('WebKit ' + phone.name + ' every menu link', async () => {
      await tapEveryLink(page, server.url, true, phone.name);
    });
    await ctx.close();
  }
  // embed page, one phone
  {
    const ctx = await wk.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(server.url + '/embed', { waitUntil: 'domcontentloaded' });
    await check('WebKit iPhone 13 embed page toggle', async () => {
      await cycleOpenClose(page, true, 'embed');
    });
    await ctx.close();
  }
  // widget has no menu: the script must not throw
  {
    const ctx = await wk.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(server.url + '/widget', { waitUntil: 'domcontentloaded' });
    await check('WebKit widget has no menu and no page error', async () => {
      const exists = await page.locator('details.nav-menu').count();
      assert(exists === 0, 'widget unexpectedly has a nav menu');
      assert(errs.length === 0, 'widget page errors', errs);
    });
    await ctx.close();
  }

  const chrome = await chromium.launch({ headless: true });
  {
    const ctx = await chrome.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    await check('Chromium desktop 10 click cycles', async () => {
      for (let i = 1; i <= 10; i++) {
        await cycleOpenClose(page, false, 'desktop cycle ' + i);
      }
    });
    await check('Chromium desktop every menu link', async () => {
      await tapEveryLink(page, server.url, false, 'desktop');
    });
    await check('Chromium desktop keyboard', async () => {
      await desktopKeyboard(page, server.url);
    });
    await ctx.close();
  }

  const MENU_PAGES = [
    '/', '/difference/', '/past/', '/days-between-dates/', '/chronological-age/',
    '/dog-age/', '/cat-age/', '/korean-age/', '/birthday-countdown/',
    '/how-old-will-i-be/', '/what-year-was-i-born/', '/privacy/', '/contact/', '/embed/',
  ];

  // One open/close/outside/Esc cycle on every page (WebKit touch + Chromium desktop).
  {
    const ctx = await wk.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const page = await ctx.newPage();
    await check('WebKit iPhone 13 every page toggle', async () => {
      for (const path of MENU_PAGES) {
        await page.goto(server.url + path, { waitUntil: 'domcontentloaded' });
        await cycleOpenClose(page, true, 'iPhone 13 ' + path);
      }
    });
    await ctx.close();
  }
  await wk.close();
  {
    const ctx = await chrome.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await check('Chromium desktop every page toggle', async () => {
      for (const path of MENU_PAGES) {
        await page.goto(server.url + path, { waitUntil: 'domcontentloaded' });
        await cycleOpenClose(page, false, 'desktop ' + path);
      }
    });
    await ctx.close();
  }

  // Android / Chrome touch (Pixel 7).
  {
    const pixel = { ...devices['Pixel 7'], hasTouch: true, isMobile: true };
    const ctx = await chrome.newContext(pixel);
    const page = await ctx.newPage();
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    await check('Chromium Pixel 7 touch 3 open/close cycles', async () => {
      for (let i = 1; i <= 3; i++) {
        await cycleOpenClose(page, true, 'Pixel 7 cycle ' + i);
      }
    });
    await check('Chromium Pixel 7 genuine outside tap', async () => {
      const summary = page.locator('details.nav-menu summary');
      await tapLocator(page, summary, true);
      await expectOpen(page, true, 'Pixel 7 before outside');
      await tapOutside(page, true);
      await expectOpen(page, false, 'Pixel 7 after outside');
      const url = page.url();
      assert(url.replace(/\/+$/, '') === (server.url + '/').replace(/\/+$/, '') || url.endsWith('/'), 'outside tap navigated', { url });
    });
    await check('Chromium Pixel 7 every menu link', async () => {
      await tapEveryLink(page, server.url, true, 'Pixel 7');
    });
    await ctx.close();
  }

  // Back/forward bfcache: leave the menu open, go Back, then Forward.
  const chromeBf = await chromium.launch({
    headless: true,
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
    args: ['--enable-features=BackForwardCache'],
  });
  {
    const ctx = await chromeBf.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await check('pageshow closes the menu only when event.persisted is true', async () => {
      await page.goto(server.url + '/', { waitUntil: 'load' });
      const summary = page.locator('details.nav-menu summary');
      await tapLocator(page, summary, false);
      await expectOpen(page, true, 'menu open before pageshow');
      // A regular pageshow (reload / first load) must not close the menu.
      const stayed = await page.evaluate(() => {
        const ev = new PageTransitionEvent('pageshow', { persisted: false, bubbles: true });
        window.dispatchEvent(ev);
        const menu = document.querySelector('details.nav-menu');
        return !!(menu && menu.open);
      });
      assert(stayed, 'pageshow with persisted=false closed the menu');
      await expectOpen(page, true, 'menu still open after persisted=false');
      // A bfcache restore is a pageshow with event.persisted === true.
      const closed = await page.evaluate(() => {
        const ev = new PageTransitionEvent('pageshow', { persisted: true, bubbles: true });
        window.dispatchEvent(ev);
        const menu = document.querySelector('details.nav-menu');
        return !!(menu && !menu.open);
      });
      assert(closed, 'pageshow with persisted=true left the menu open');
      await expectOpen(page, false, 'menu closed after persisted=true');
      await tapLocator(page, summary, false);
      await expectOpen(page, true, 'menu can reopen after a persisted pageshow');
      await tapLocator(page, summary, false);
      await expectOpen(page, false, 'menu can reclose');
    });

    await check('Chromium back/forward: close the menu if a real bfcache restore happens', async () => {
      await page.goto(server.url + '/difference/', { waitUntil: 'load' });
      await page.goto(server.url + '/', { waitUntil: 'load' });
      await page.evaluate(() => {
        window.__ps = null;
        window.addEventListener('pageshow', function (e) { window.__ps = e.persisted; });
      });
      const summary = page.locator('details.nav-menu summary');
      await tapLocator(page, summary, false);
      await expectOpen(page, true, 'bfcache menu open before leaving');
      await page.goBack();
      await page.waitForTimeout(200);
      await page.goForward();
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0];
        let reasons = null;
        try { reasons = n && n.notRestoredReasons ? n.notRestoredReasons : null; } catch (e) { reasons = String(e); }
        return { persisted: window.__ps, navType: n && n.type, reasons: reasons && (reasons.toJSON ? reasons.toJSON() : reasons) };
      });
      if (info.persisted !== true) {
        // Playwright's Chromium usually blocks a genuine restore
        // (notRestoredReasons: masked). Do not treat that as a pass.
        say('  not asserted: no genuine bfcache restore (persisted=' + info.persisted + ', navType=' + info.navType + ')');
        return 'skip';
      }
      await expectOpen(page, false, 'bfcache menu after real restore (persisted=true)');
      await tapLocator(page, page.locator('details.nav-menu summary'), false);
      await expectOpen(page, true, 'bfcache can reopen');
      await tapLocator(page, page.locator('details.nav-menu summary'), false);
      await expectOpen(page, false, 'bfcache can reclose');
    });
    await ctx.close();
  }
  await chromeBf.close();
  await chrome.close();
  server.close();

  if (failures.length) {
    console.error('\n' + failures.length + ' failed');
    process.exit(1);
  }
  say('\nAll nav-menu checks passed.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
