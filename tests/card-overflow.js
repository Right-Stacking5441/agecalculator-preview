/* Cards must not overflow at 320/360/390 with extreme values, and Copy
   button accessible names must start with the visible label (not "Copied").
   Run: PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 NODE_PATH=... node tests/card-overflow.js
*/
'use strict';

const { startServer } = require('./static_server');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    throw new Error('playwright is not installed. Add it or set NODE_PATH to a playwright install.');
  }
}

function assert(cond, msg, extra) {
  if (!cond) {
    const detail = extra ? ' ' + JSON.stringify(extra) : '';
    throw new Error(msg + detail);
  }
}

async function typeQuick(page, name, text) {
  const loc = page.locator('[data-datefield="' + name + '"] .quick');
  await loc.click();
  await loc.fill('');
  await loc.type(text, { delay: 10 });
}

async function blurQuick(page, name) {
  await page.locator('[data-datefield="' + name + '"] .quick').evaluate((el) => el.blur());
}

async function fillDate(page, name, text) {
  const box = page.locator('[data-datefield="' + name + '"] .quick');
  if (!(await box.isVisible())) {
    const toggle = page.locator('#on-toggle, [data-datefield="' + name + '"] .parts-toggle, button[aria-controls="on-box"]');
    if (await toggle.count()) {
      await toggle.first().click();
      await page.waitForTimeout(50);
    }
  }
  await typeQuick(page, name, text);
  await blurQuick(page, name);
  await page.waitForTimeout(80);
}

async function openMore(page) {
  const more = page.locator('#leaf details.more, details.more').first();
  if (await more.count()) {
    const open = await more.evaluate((el) => el.open);
    if (!open) {
      await more.locator('summary').click();
      await page.waitForTimeout(50);
    }
  }
}

async function overflowPx(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const leaf = document.getElementById('leaf');
    const pageOverflow = Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
    const leafOverflow = leaf ? Math.max(0, Math.ceil(leaf.getBoundingClientRect().right - root.clientWidth)) : 0;
    return Math.max(pageOverflow, leafOverflow);
  });
}

async function fillCase(page, c) {
  if (c.fields) {
    for (const [name, text] of c.fields) await fillDate(page, name, text);
  }
  if (c.petYears) {
    const y = page.locator('#pet-y');
    await y.click();
    await y.fill('');
    await y.type(c.petYears, { delay: 10 });
    await y.evaluate((el) => el.blur());
    await page.waitForTimeout(80);
  }
  if (c.age) {
    const a = page.locator('#age-now');
    await a.click();
    await a.fill('');
    await a.type(c.age, { delay: 10 });
    await a.evaluate((el) => el.blur());
    await page.waitForTimeout(80);
  }
  await page.waitForSelector('#leaf[data-state="result"]', { timeout: 5000 });
  await openMore(page);
}

const CASES = [
  { name: 'home 4-digit age', path: '/', fields: [['dob', '1 January 1000']] },
  { name: 'korean 3-digit age', path: '/korean-age/', fields: [['dob', '1 January 1900']] },
  { name: 'korean normal dob', path: '/korean-age/', fields: [['dob', '5 May 1990']] },
  { name: 'korean 4-digit age', path: '/korean-age/', fields: [['dob', '1 January 1000']] },
  { name: 'countdown far birthday', path: '/birthday-countdown/', fields: [['dob', '1 January 1000']] },
  { name: 'how-old-will-i-be far date', path: '/how-old-will-i-be/', fields: [['dob', '1 January 1000'], ['on', '1 January 2999']] },
  { name: 'past 4-digit age', path: '/past/', fields: [['dob', '1 January 1000'], ['on', '16 November 2026']] },
  { name: 'difference huge gap', path: '/difference/', fields: [['a', '1 January 1000'], ['b', '16 November 2026']] },
  { name: 'days-between huge count', path: '/days-between-dates/', fields: [['start', '1 January 1000'], ['end', '16 November 2026']] },
  { name: 'chronological 4-digit age', path: '/chronological-age/', fields: [['dob', '1 January 1000'], ['test', '16 November 2026']] },
  { name: 'what-year 3-digit age', path: '/what-year-was-i-born/', age: '120' },
  { name: 'dog age 20', path: '/dog-age/', petYears: '20' },
  { name: 'cat age 21', path: '/cat-age/', petYears: '21' },
];

const WIDTHS = [320, 360, 375, 390, 391, 393, 400, 414, 430, 431, 768];

const AXE_PAGES = [
  { path: '/', fields: [['dob', '15 March 1995']] },
  { path: '/past/', fields: [['dob', '15 March 1995'], ['on', '16 November 2026']] },
  { path: '/korean-age/', fields: [['dob', '15 March 1995']] },
  { path: '/birthday-countdown/', fields: [['dob', '15 March 1995']] },
  { path: '/how-old-will-i-be/', fields: [['dob', '15 March 1995'], ['on', '1 January 2050']] },
  { path: '/difference/', fields: [['a', '2 June 1990'], ['b', '20 September 1993']] },
  { path: '/days-between-dates/', fields: [['start', '5 November 2026'], ['end', '25 December 2026']] },
  { path: '/chronological-age/', fields: [['dob', '4 July 2018'], ['test', '16 November 2026']] },
  { path: '/what-year-was-i-born/', age: '31' },
  { path: '/dog-age/', petYears: '10' },
  { path: '/cat-age/', petYears: '12' },
];

(async () => {
  const { chromium } = loadPlaywright();
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let failed = 0;

  async function check(label, fn) {
    try {
      await fn();
      console.log('PASS  ' + label);
    } catch (e) {
      failed += 1;
      console.log('FAIL  ' + label);
      console.log('      ' + e.message);
    }
  }

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    for (const c of CASES) {
      // 4-digit Korean ages only have to fit in the stacked layout (<=430).
      // Above that the three-column card is restored, which is the agreed breakpoint.
      if (c.name === 'korean 4-digit age' && width > 430) continue;
      await check(c.name + ' at ' + width, async () => {
        await page.goto(server.url + c.path + '?today=16%20November%202026', { waitUntil: 'domcontentloaded' });
        await fillCase(page, c);
        const px = await overflowPx(page);
        assert(px === 0, 'horizontal overflow ' + px + 'px', { path: c.path, width, px });
      });
    }
  }

  await page.setViewportSize({ width: 390, height: 800 });
  const axeSource = require('axe-core').source;
  for (const c of AXE_PAGES) {
    await check('Copy name + axe on ' + c.path, async () => {
      await page.goto(server.url + c.path + '?today=16%20November%202026', { waitUntil: 'domcontentloaded' });
      await fillCase(page, c);
      const names = await page.evaluate(() => {
        const btn = document.querySelector('[data-act="age"]');
        if (!btn) return { skipped: true };
        const vis = ((btn.querySelector('.l-a') || {}).textContent || '').trim();
        return { vis, aria: btn.getAttribute('aria-label') || '', act: (btn.querySelector('.act-l') || {}).textContent || '' };
      });
      if (!names.skipped) {
        assert(names && names.vis, 'no visible Copy label', names);
        assert(names.aria, 'missing aria-label', names);
        assert(names.aria.startsWith(names.vis + ':'), 'aria-label must start with the visible label', names);
        assert(!/^Copy \w+Copied/.test(names.aria) && !names.aria.startsWith(names.vis + 'Copied'), 'aria-label includes hidden Copied text', names);
      }

      await page.evaluate(axeSource);
      const results = await page.evaluate(async () => await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
      const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious' || v.id === 'label-content-name-mismatch');
      assert(serious.length === 0, 'axe violations: ' + serious.map((v) => v.id + ' (' + v.impact + ')').join(', '), serious.map((v) => v.id));
    });
  }

  await browser.close();
  await server.close();
  if (failed) {
    console.log('\n' + failed + ' checks failed.');
    process.exit(1);
  }
  console.log('\nAll card-overflow and Copy-name checks passed.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
