/* Date-entry regressions for H1 / M1 / M2 / M3, High 1 stale boxes,
   mid-typing auto-close, incomplete-month message, and zoom clipping.
   Run: PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 node tests/date-entry.js
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

async function fieldState(page, name) {
  return page.evaluate((n) => {
    const el = document.querySelector('[data-datefield="' + n + '"]');
    if (!el) return null;
    const quick = el.querySelector('.quick');
    const parts = [el.querySelector('.p-d'), el.querySelector('.p-m'), el.querySelector('.p-y')];
    const pbox = el.querySelector('.parts');
    const label = el.querySelector('.df-label');
    const read = el.querySelector('.readback');
    const qcs = quick ? getComputedStyle(quick) : null;
    const lcs = label ? getComputedStyle(label) : null;
    return {
      quickValue: quick ? quick.value : '',
      quickHidden: !!(qcs && (qcs.display === 'none' || qcs.visibility === 'hidden')),
      labelText: label ? label.textContent.trim() : '',
      labelVisible: !!(label && lcs && lcs.display !== 'none' && lcs.visibility !== 'hidden' && label.getBoundingClientRect().height > 0),
      partsOpen: !!(pbox && !pbox.hidden),
      parts: parts.map(p => p ? p.value : ''),
      ariaInvalid: quick ? quick.getAttribute('aria-invalid') : null,
      readback: read ? read.textContent.trim() : '',
      readbackErr: !!(read && read.classList.contains('err')),
      focus: document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : '',
      focusIsBody: document.activeElement === document.body,
      focusIsQuick: !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('quick')),
      focusIsPart: !!(document.activeElement && document.activeElement.classList && (
        document.activeElement.classList.contains('p-d') ||
        document.activeElement.classList.contains('p-m') ||
        document.activeElement.classList.contains('p-y')
      )),
    };
  }, name);
}

async function typeQuick(page, name, text) {
  const loc = page.locator('[data-datefield="' + name + '"] .quick');
  await loc.click();
  await loc.fill('');
  await loc.type(text, { delay: 10 });
}

async function blurQuick(page, name) {
  await page.locator('[data-datefield="' + name + '"] .quick').evaluate(el => el.blur());
}

async function clickToggle(page, name) {
  const loc = page.locator('[data-datefield="' + name + '"] .parts-toggle, .parts-toggle.shared').first();
  await loc.click();
}

async function openInvalidBoxes(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await typeQuick(page, 'dob', '31 April 2000');
  await blurQuick(page, 'dob');
  let st = await fieldState(page, 'dob');
  if (!st.partsOpen) {
    await clickToggle(page, 'dob');
    st = await fieldState(page, 'dob');
  }
  assert(st.partsOpen, 'boxes should be open so the date can be fixed', st);
  return st;
}

/* High 2: correct the day by backspacing, then type the next digit, with a delay. */
async function typeDayByBackspace(page) {
  const day = page.locator('[data-datefield="dob"] .p-d');
  await day.click();
  await day.press('End');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(80);
  let st = await fieldState(page, 'dob');
  assert(st.partsOpen, 'boxes closed after backspacing a valid first digit', st);
  assert(st.focusIsPart, 'focus left the day box after backspace', st);
  assert(!st.focusIsQuick && st.quickHidden, 'the text field took over after backspace', st);
  await page.keyboard.type('0', { delay: 80 });
  st = await fieldState(page, 'dob');
  assert(st.partsOpen, 'boxes closed after typing the second digit', st);
  assert(st.parts[0] === '30' || st.parts[0] === '3', 'day should still be in the boxes, got ' + st.parts[0], st);
  // If auto-advance moved to month after "30", boxes must still be open.
  if (st.parts[0] === '30') {
    assert(st.partsOpen, 'boxes closed once 30 was valid', st);
  }
  return st;
}

/* High 2: type 3 then 0 one key at a time into a cleared day box. */
async function type30KeyByKey(page) {
  const day = page.locator('[data-datefield="dob"] .p-d');
  await day.click();
  await day.fill('');
  await page.keyboard.type('3', { delay: 80 });
  let st = await fieldState(page, 'dob');
  assert(st.partsOpen, 'boxes closed after typing the first valid digit 3', st);
  assert(st.parts[0] === '3', 'day should be 3 after the first key', st);
  assert(st.focusIsPart, 'focus left the boxes after typing 3', st);
  assert(!st.focusIsQuick, 'the next key would go into the text field after typing 3', st);
  await page.keyboard.type('0', { delay: 80 });
  st = await fieldState(page, 'dob');
  assert(st.partsOpen, 'boxes closed after typing 0 to make 30', st);
  assert(st.parts[0] === '30', 'day should be 30 after typing 3 then 0', st);
  assert(!st.focusIsQuick, 'focus jumped to the text field after 30', st);
  return st;
}

async function run() {
  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS || '1';
  const { chromium, webkit, devices } = loadPlaywright();
  const server = await startServer();
  const failures = [];
  const say = (m) => console.log(m);

  async function check(name, fn) {
    try {
      await fn();
      say('PASS  ' + name);
    } catch (e) {
      failures.push(name + ': ' + e.message);
      say('FAIL  ' + name + '\n  ' + e.message);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await check('H1: invalid text on blur is not lost (birthday-countdown)', async () => {
    await page.goto(server.url + '/birthday-countdown/', { waitUntil: 'domcontentloaded' });
    await typeQuick(page, 'dob', '31 April 2000');
    await blurQuick(page, 'dob');
    const st = await fieldState(page, 'dob');
    const inQuick = /31/.test(st.quickValue) && /2000/.test(st.quickValue);
    const inParts = st.parts[0] === '31' && String(st.parts[1]) === '4' && st.parts[2] === '2000';
    assert(inQuick || inParts, 'typed date vanished after blur', st);
    if (st.partsOpen) {
      await clickToggle(page, 'dob');
      const after = await fieldState(page, 'dob');
      assert(/31/.test(after.quickValue) && /2000/.test(after.quickValue), '"Use one box" wiped the typed date', after);
      assert(after.readbackErr || after.ariaInvalid === 'true', 'expected an error after returning to the text field', after);
    } else {
      assert(st.readbackErr || st.ariaInvalid === 'true', 'expected an inline error in the text field', st);
      assert(!st.quickHidden, 'text field should stay visible when boxes do not open', st);
    }
  });

  await check('M3: closing boxes on 31/4/2000 keeps the text and shows an error', async () => {
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    const st0 = await fieldState(page, 'dob');
    if (!st0.partsOpen) await clickToggle(page, 'dob');
    await page.locator('[data-datefield="dob"] .p-d').fill('31');
    await page.locator('[data-datefield="dob"] .p-m').fill('4');
    await page.locator('[data-datefield="dob"] .p-y').fill('2000');
    await clickToggle(page, 'dob');
    const st = await fieldState(page, 'dob');
    assert(!st.partsOpen, 'boxes should have closed', st);
    assert(/31/.test(st.quickValue) && /2000/.test(st.quickValue), 'closing the boxes wiped the invalid date', st);
    assert(st.readbackErr || st.ariaInvalid === 'true', 'expected an error message after closing invalid boxes', st);
    assert(st.readback.length > 0, 'no message shown after closing invalid boxes', st);
  });

  await check('M1: field labels stay visible while boxes are open (days-between-dates)', async () => {
    await page.goto(server.url + '/days-between-dates/', { waitUntil: 'domcontentloaded' });
    const shared = page.locator('.parts-toggle.shared, [data-datefield="start"] .parts-toggle').first();
    await shared.click();
    const info = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-datefield] .df-label')).map(l => {
        const cs = getComputedStyle(l);
        const r = l.getBoundingClientRect();
        return {
          text: l.textContent.trim(),
          display: cs.display,
          visibility: cs.visibility,
          height: r.height,
          width: r.width,
        };
      });
    });
    assert(info.length >= 2, 'expected two field labels', info);
    for (const lab of info) {
      assert(lab.display !== 'none' && lab.visibility !== 'hidden' && lab.height > 0, 'label hidden while boxes are open', lab);
    }
  });

  await check('High 1: clearing the text also clears the boxes', async () => {
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    await typeQuick(page, 'dob', '18 May 1999');
    await blurQuick(page, 'dob');
    let st = await fieldState(page, 'dob');
    if (!st.partsOpen) await clickToggle(page, 'dob');
    st = await fieldState(page, 'dob');
    assert(st.partsOpen, 'boxes should open', st);
    assert(st.parts[0] !== '' && st.parts[2] === '1999', 'boxes should show 18 May 1999', st);
    await clickToggle(page, 'dob'); // close
    const quick = page.locator('[data-datefield="dob"] .quick');
    await quick.click();
    await quick.fill('');
    await quick.dispatchEvent('input');
    st = await fieldState(page, 'dob');
    if (!st.partsOpen) await clickToggle(page, 'dob');
    st = await fieldState(page, 'dob');
    assert(st.partsOpen, 'boxes should reopen', st);
    assert(st.parts[0] === '' && st.parts[1] === '' && st.parts[2] === '', 'stale date left in the boxes after the text was cleared', st);
  });

  await check('Incomplete month: closing boxes on 18/1999 shows an error at once', async () => {
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    const st0 = await fieldState(page, 'dob');
    if (!st0.partsOpen) await clickToggle(page, 'dob');
    await page.locator('[data-datefield="dob"] .p-d').fill('18');
    await page.locator('[data-datefield="dob"] .p-m').fill('');
    await page.locator('[data-datefield="dob"] .p-y').fill('1999');
    await clickToggle(page, 'dob');
    const st = await fieldState(page, 'dob');
    assert(!st.partsOpen, 'boxes should have closed', st);
    assert(/18/.test(st.quickValue) && /1999/.test(st.quickValue), 'closing the boxes wiped the incomplete date', st);
    assert(st.readbackErr || st.ariaInvalid === 'true', 'expected an error as soon as the boxes closed', st);
    assert(/month/i.test(st.readback) || st.readback.length > 0, 'no message shown after closing with an empty month', st);
  });

  await check('Zoom 360px at 200%: 18 May 1999 is not clipped (home)', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await typeQuick(page, 'dob', '18 May 1999');
    const clip = await page.evaluate(() => {
      const q = document.querySelector('[data-datefield="dob"] .quick');
      const cs = getComputedStyle(q);
      return {
        value: q.value,
        scroll: q.scrollWidth,
        client: q.clientWidth,
        fontSize: cs.fontSize,
        overflow: cs.overflow + '/' + cs.overflowX,
      };
    });
    assert(clip.value === '18 May 1999', 'expected the typed date to stay in the field', clip);
    assert(clip.scroll <= clip.client + 1, 'input text is clipped at 360px and 200% zoom', clip);
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('Zoom 360px at 200%: 18 May 1999 is not clipped (widget)', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(server.url + '/widget/?dob=18%20May%201999', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    const clip = await page.evaluate(() => {
      const q = document.querySelector('.quick');
      if (!q) return { missing: true };
      const cs = getComputedStyle(q);
      return {
        value: q.value,
        scroll: q.scrollWidth,
        client: q.clientWidth,
        fontSize: cs.fontSize,
      };
    });
    assert(!clip.missing, 'widget has no date field', clip);
    assert(/1999/.test(clip.value), 'widget field missing the prefilled date', clip);
    assert(clip.scroll <= clip.client + 1, 'widget input text is clipped at 360px and 200% zoom', clip);
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await ctx.close();

  // High 2: real typing on WebKit (iPhone) and Chromium mobile (Pixel 7).
  const wk = await webkit.launch({ headless: true });
  {
    const wctx = await wk.newContext({ ...devices['iPhone 13'], hasTouch: true });
    const wpage = await wctx.newPage();
    await check('High 2 WebKit: backspace then type keeps the boxes open', async () => {
      await openInvalidBoxes(wpage, server.url + '/');
      await typeDayByBackspace(wpage);
    });
    await check('High 2 WebKit: typing 3 then 0 one key at a time keeps the boxes open', async () => {
      await openInvalidBoxes(wpage, server.url + '/');
      await type30KeyByKey(wpage);
    });
    await wctx.close();
  }
  await wk.close();

  {
    const pixel = { ...devices['Pixel 7'], hasTouch: true, isMobile: true };
    const pctx = await browser.newContext(pixel);
    const ppage = await pctx.newPage();
    await check('High 2 Chromium mobile: backspace then type keeps the boxes open', async () => {
      await openInvalidBoxes(ppage, server.url + '/');
      await typeDayByBackspace(ppage);
    });
    await check('High 2 Chromium mobile: typing 3 then 0 one key at a time keeps the boxes open', async () => {
      await openInvalidBoxes(ppage, server.url + '/');
      await type30KeyByKey(ppage);
    });
    await pctx.close();
  }

  await browser.close();
  server.close();

  if (failures.length) {
    console.error('\n' + failures.length + ' failed');
    process.exit(1);
  }
  say('\nAll date-entry checks passed.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
