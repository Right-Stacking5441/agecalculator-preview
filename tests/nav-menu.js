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
    const menu = document.querySelector('.nav-menu');
    const btn = menu && menu.querySelector('button');
    const list = menu && menu.querySelector('ul');
    const back = document.querySelector('.nav-menu-back');
    const cs = list ? getComputedStyle(list) : null;
    const mast = document.querySelector('header.mast');
    const open = !!(btn && list && btn.getAttribute('aria-expanded') === 'true' && !list.hasAttribute('hidden'));
    return {
      exists: !!menu,
      hasButton: !!btn,
      open,
      aria: btn ? btn.getAttribute('aria-expanded') : null,
      visible: !!(cs && !list.hasAttribute('hidden') && cs.display !== 'none' && cs.visibility !== 'hidden'),
      backOpen: !!(back && !back.hasAttribute('hidden')),
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
  assert(s.hasButton, label + ': menu button missing (enhancement did not run)', s);
  assert(s.open === open, label + ': open=' + s.open + ' expected ' + open, s);
  assert(s.visible === open, label + ': visible=' + s.visible + ' expected ' + open, s);
  assert(s.aria === (open ? 'true' : 'false'), label + ': aria-expanded=' + s.aria, s);
  assert(s.backOpen === open, label + ': backdrop open=' + s.backOpen + ' expected ' + open, s);
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
  const summary = page.locator('.nav-menu button');
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
    const s = document.querySelector('.nav-menu button');
    return document.activeElement === s;
  });
  assert(focused, label + ': Escape did not return focus to the toggle');
}

async function hrefsOf(page) {
  return page.locator('.nav-menu ul a').evaluateAll(as =>
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
    const summary = page.locator('.nav-menu button');
    await tapLocator(page, summary, useTouch);
    await expectOpen(page, true, label + ' before ' + link.text);
    const loc = page.locator('.nav-menu ul a', { hasText: new RegExp('^' + link.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') });
    await loc.scrollIntoViewIfNeeded();
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
      await tapLocator(page, page.locator('.nav-menu button'), useTouch);
      await expectOpen(page, true, label + ' re-open on ' + link.text);
      await tapLocator(page, page.locator('.nav-menu button'), useTouch);
      await expectOpen(page, false, label + ' re-close on ' + link.text);
    }
  }
}

async function desktopKeyboard(page, base) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  const summary = page.locator('.nav-menu button');
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
    return !!(a && a.closest && a.closest('.nav-menu'));
  });
  assert(tag === 'A' && inMenu, 'Tab from the toggle did not land on a menu link', { tag, inMenu });
}


async function assertButtonAbovePanel(page, useTouch, label) {
  const summary = page.locator('.nav-menu button');
  await tapLocator(page, summary, useTouch);
  await expectOpen(page, true, label + ' open for hit-test');
  const hit = await page.evaluate(() => {
    const btn = document.querySelector('.nav-menu button');
    const list = document.querySelector('.nav-menu ul');
    const back = document.querySelector('.nav-menu-back');
    const r = btn.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      tag: el ? el.tagName : null,
      className: el ? el.className : null,
      isSummary: !!(el && (el === btn || btn.contains(el))),
      isList: !!(el && list && (el === list || list.contains(el))),
      isBack: !!(el && back && (el === back || (back.contains && back.contains(el)))),
      bodyPos: getComputedStyle(document.body).position,
      summaryZ: getComputedStyle(btn).zIndex,
      listZ: list ? getComputedStyle(list).zIndex : null,
      backZ: back ? getComputedStyle(back).zIndex : null,
    };
  });
  assert(hit.isSummary && !hit.isList && !hit.isBack, label + ': a tap on the button hit the panel or backdrop, not the button', hit);
  assert(parseInt(hit.summaryZ, 10) > parseInt(hit.listZ, 10), label + ': button z-index is not above the panel', hit);
  assert(parseInt(hit.summaryZ, 10) > parseInt(hit.backZ, 10), label + ': button z-index is not above the backdrop', hit);
  assert(hit.bodyPos !== 'fixed', label + ': body was position:fixed while the menu was open (scroll lock)', hit);
  await tapLocator(page, summary, useTouch);
  await expectOpen(page, false, label + ' closed by a second tap after hit-test');
}

async function assertDuplicateEventLeavesStateCorrect(page, label) {
  await expectOpen(page, false, label + ' start');
  const result = await page.evaluate(() => {
    const menu = document.querySelector('.nav-menu');
    const btn = menu.querySelector('button');
    const list = menu.querySelector('ul');
    const isOpen = () => !list.hasAttribute('hidden');
    const start = isOpen();
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' }));
    menu.dispatchEvent(new Event('toggle', { bubbles: true }));
    const afterGhost = isOpen();
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    return { start, afterGhost, afterClick: isOpen(), aria: btn.getAttribute('aria-expanded') };
  });
  assert(result.start === false, label + ': menu was already open', result);
  assert(result.afterGhost === false, label + ': pointerdown or a toggle event opened the menu on its own', result);
  assert(result.afterClick === true && result.aria === 'true', label + ': a single click did not open the menu after the extra events', result);
}

async function assertBackdropTapCloses(page, useTouch, label) {
  const btn = page.locator('.nav-menu button');
  await tapLocator(page, btn, useTouch);
  await expectOpen(page, true, label + ' open before backdrop tap');
  const back = page.locator('.nav-menu-back');
  await back.waitFor({ state: 'visible' });
  const pt = await page.evaluate(() => {
    const list = document.querySelector('.nav-menu ul');
    const button = document.querySelector('.nav-menu button');
    const lr = list.getBoundingClientRect();
    const br = button.getBoundingClientRect();
    const x = 24;
    const y = Math.min(Math.max(lr.bottom, br.bottom) + 48, window.innerHeight - 24);
    const el = document.elementFromPoint(x, y);
    return { x, y, isBack: !!(el && el.classList && el.classList.contains('nav-menu-back')) };
  });
  assert(pt.isBack, label + ': chosen tap point is not the backdrop', pt);
  if (useTouch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
  await expectOpen(page, false, label + ' backdrop tap should close the menu');
}

async function assertPointerdownOnButtonDoesNotToggle(page, label) {
  const btnLoc = page.locator('.nav-menu button');
  await tapLocator(page, btnLoc, true);
  await expectOpen(page, true, label + ' open before pointerdown');
  const open = await page.evaluate(() => {
    const btn = document.querySelector('.nav-menu button');
    const list = document.querySelector('.nav-menu ul');
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' }));
    return !list.hasAttribute('hidden');
  });
  assert(open, label + ': pointerdown on the button toggled the menu');
  await expectOpen(page, true, label + ' still open after pointerdown');
}

async function assertOutsideOrdinaryText(page, useTouch, label) {
  const summary = page.locator('.nav-menu button');
  await tapLocator(page, summary, useTouch);
  await expectOpen(page, true, label + ' open before ordinary-text tap');
  const pt = await page.evaluate(() => {
    const list = document.querySelector('.nav-menu ul');
    const lr = list ? list.getBoundingClientRect() : { left: 9999, top: 0, bottom: 0, right: 0 };
    const nodes = [...document.querySelectorAll('h1, .lede, p, main')];
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 10) continue;
      const x = r.left + Math.min(24, r.width / 2);
      const y = r.top + Math.min(16, r.height / 2);
      if (x >= lr.left && x <= lr.right && y >= lr.top && y <= lr.bottom) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit.classList && hit.classList.contains('nav-menu-back')) return { x, y };
      if (hit && hit.closest && hit.closest('a, button, summary, input, .nav-menu')) continue;
      return { x, y };
    }
    const mast = document.querySelector('header.mast');
    return { x: 24, y: (mast ? mast.getBoundingClientRect().bottom : 56) + 80 };
  });
  if (useTouch) await page.touchscreen.tap(pt.x, pt.y);
  else await page.mouse.click(pt.x, pt.y);
  await expectOpen(page, false, label + ' a tap on ordinary text should close the menu');
}

async function assertCurrentPageLinkCloses(page, useTouch, label) {
  const summary = page.locator('.nav-menu button');
  await tapLocator(page, summary, useTouch);
  await expectOpen(page, true, label + ' open before current-page link');
  const loc = page.locator('.nav-menu ul a[aria-current]').first();
  await loc.waitFor({ state: 'visible' });
  await tapLocator(page, loc, useTouch);
  await page.waitForTimeout(80);
  await expectOpen(page, false, label + ' a tap on the current-page link should close the menu');
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
    { name: 'iPhone 15', device: { ...(devices['iPhone 15'] || devices['iPhone 13']), hasTouch: true, isMobile: true } },
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
    await check('WebKit ' + phone.name + ' button stays above the panel and a second tap closes', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await assertButtonAbovePanel(page, true, phone.name);
    });
    await check('WebKit ' + phone.name + ' extra toggle or pointerdown does not fight the click', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await assertDuplicateEventLeavesStateCorrect(page, phone.name);
    });
    await check('WebKit ' + phone.name + ' pointerdown on the button does not toggle', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await assertPointerdownOnButtonDoesNotToggle(page, phone.name);
    });
    await check('WebKit ' + phone.name + ' tap on ordinary text closes the menu', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await assertOutsideOrdinaryText(page, true, phone.name);
    });
    await check('WebKit ' + phone.name + ' current-page link closes the menu', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await assertCurrentPageLinkCloses(page, true, phone.name);
    });
    await check('WebKit ' + phone.name + ' backdrop tap closes the menu', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await assertBackdropTapCloses(page, true, phone.name);
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
      const exists = await page.locator('.nav-menu').count();
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
  // JS off: the list must stay visible and inline; no button, no hidden list.
  {
    const ctx = await wk.newContext({ ...devices['iPhone 13'], hasTouch: true, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await check('WebKit JS-off: the calculators list is shown inline', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      const info = await page.evaluate(() => {
        const menu = document.querySelector('.nav-menu');
        const btn = menu && menu.querySelector('button');
        const list = menu && menu.querySelector('ul');
        const cs = list ? getComputedStyle(list) : null;
        return {
          hasMenu: !!menu,
          hasButton: !!btn,
          hidden: !!(list && list.hasAttribute('hidden')),
          display: cs ? cs.display : null,
          links: list ? list.querySelectorAll('a').length : 0,
          enhanced: !!(menu && menu.classList.contains('is-enhanced')),
        };
      });
      assert(info.hasMenu, 'JS-off: nav.nav-menu missing', info);
      assert(!info.hasButton, 'JS-off: a button was in the server HTML', info);
      assert(!info.hidden && info.display !== 'none', 'JS-off: the list is hidden', info);
      assert(info.links >= 10, 'JS-off: expected the full calculators list', info);
      assert(!info.enhanced, 'JS-off: is-enhanced was in the server HTML', info);
    });
    await ctx.close();
  }

  await check('debug=1 is inert unless requested, and logs when present', async () => {
    const ctx = await wk.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    assert((await page.locator('#nav-menu-debug').count()) === 0, 'debug log appeared without ?debug=1');
    await page.goto(server.url + '/?debug=1', { waitUntil: 'domcontentloaded' });
    const log = page.locator('#nav-menu-debug');
    await log.waitFor({ state: 'attached' });
    const pe = await log.evaluate((el) => getComputedStyle(el).pointerEvents);
    assert(pe === 'none', 'debug log is not pointer-events: none', { pe });
    const btn = page.locator('.nav-menu button');
    await tapLocator(page, btn, true);
    await expectOpen(page, true, 'debug-on opened');
    await page.waitForTimeout(30);
    const text = await log.innerText();
    assert(/click/i.test(text), 'debug log did not record a click: ' + text);
    assert(/open=true/.test(text), 'debug log did not record open=true: ' + text);
    await tapLocator(page, btn, true);
    await expectOpen(page, false, 'debug-on closed');
    await page.waitForTimeout(30);
    const text2 = await log.innerText();
    assert(/open=false/.test(text2), 'debug log did not record open=false: ' + text2);
    const lines = text2.trim().split('\n');
    assert(lines.length <= 15, 'debug log grew past 15 lines', { n: lines.length });
    await ctx.close();
  });

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
      const summary = page.locator('.nav-menu button');
      await tapLocator(page, summary, true);
      await expectOpen(page, true, 'Pixel 7 before outside');
      await tapOutside(page, true);
      await expectOpen(page, false, 'Pixel 7 after outside');
      const url = page.url();
      assert(url.replace(/\/+$/, '') === (server.url + '/').replace(/\/+$/, '') || url.endsWith('/'), 'outside tap navigated', { url });
    });
    await check('Chromium Pixel 7 button stays above the panel and a second tap closes', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await assertButtonAbovePanel(page, true, 'Pixel 7');
    });
    await check('Chromium Pixel 7 tap on ordinary text closes the menu', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await assertOutsideOrdinaryText(page, true, 'Pixel 7');
    });
    await check('Chromium Pixel 7 current-page link closes the menu', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await assertCurrentPageLinkCloses(page, true, 'Pixel 7');
    });
    await check('Chromium Pixel 7 backdrop tap closes the menu', async () => {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await assertBackdropTapCloses(page, true, 'Pixel 7');
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
      const summary = page.locator('.nav-menu button');
      await tapLocator(page, summary, false);
      await expectOpen(page, true, 'menu open before pageshow');
      // A regular pageshow (reload / first load) must not close the menu.
      const stayed = await page.evaluate(() => {
        const ev = new PageTransitionEvent('pageshow', { persisted: false, bubbles: true });
        window.dispatchEvent(ev);
        const list = document.querySelector('.nav-menu ul');
        return !!(list && !list.hasAttribute('hidden'));
      });
      assert(stayed, 'pageshow with persisted=false closed the menu');
      await expectOpen(page, true, 'menu still open after persisted=false');
      // A bfcache restore is a pageshow with event.persisted === true.
      const closed = await page.evaluate(() => {
        const ev = new PageTransitionEvent('pageshow', { persisted: true, bubbles: true });
        window.dispatchEvent(ev);
        const list = document.querySelector('.nav-menu ul');
        return !!(list && list.hasAttribute('hidden'));
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
      const summary = page.locator('.nav-menu button');
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
      await tapLocator(page, page.locator('.nav-menu button'), false);
      await expectOpen(page, true, 'bfcache can reopen');
      await tapLocator(page, page.locator('.nav-menu button'), false);
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
