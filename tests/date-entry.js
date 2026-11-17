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
      live: (document.getElementById('live') || {}).textContent || '',
      leafTop: (function () { const el = document.querySelector('#leaf, .result'); return el ? el.getBoundingClientRect().top : null; })(),
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

async function layoutProbes(page) {
  return page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().top : null;
    };
    return {
      leaf: pick('#leaf, .result'),
      b: pick('[data-datefield="b"]'),
      shared: pick('.parts-shared'),
    };
  });
}


async function fieldAreaProbes(page) {
  return page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: b.top, height: b.height, bottom: b.bottom };
    };
    const field = box('[data-datefield="dob"]');
    const foot = box('[data-datefield="dob"] .df-foot');
    const leaf = box('#leaf, .result');
    const yearIn = box('.year-in');
    return {
      fieldHeight: field ? field.height : null,
      fieldBottom: field ? field.bottom : null,
      footHeight: foot ? foot.height : null,
      yearInTop: yearIn ? yearIn.top : null,
      leafTop: leaf ? leaf.top : null,
    };
  });
}

async function clearByBackspace(page, loc) {
  await loc.click();
  await loc.press('End');
  for (let i = 0; i < 6; i++) await loc.press('Backspace');
}

async function typePartsDMY(page, name, d, m, y) {
  const day = page.locator('[data-datefield="' + name + '"] .p-d');
  await clearByBackspace(page, day);
  if (d) await day.type(d, { delay: 20 });
  const month = page.locator('[data-datefield="' + name + '"] .p-m');
  await month.click();
  await clearByBackspace(page, month);
  if (m) await month.type(m, { delay: 20 });
  const year = page.locator('[data-datefield="' + name + '"] .p-y');
  await year.click();
  await clearByBackspace(page, year);
  if (y) await year.type(y, { delay: 20 });
}

async function type18Blank1999(page, name) {
  const day = page.locator('[data-datefield="' + name + '"] .p-d');
  await clearByBackspace(page, day);
  await day.type('18', { delay: 20 });
  const year = page.locator('[data-datefield="' + name + '"] .p-y');
  await year.click();
  await clearByBackspace(page, year);
  await year.type('1999', { delay: 20 });
}

const INVALID_ERRORS = {
  '31 April 2000': 'April only has 30 days.',
  '18 May': 'Add the year.',
  'abc': 'That doesn’t look like a date. Try something like 18 May 1995.',
};

function assertNoJump(before, after, label) {
  for (const key of Object.keys(before)) {
    if (before[key] == null || after[key] == null) continue;
    assert(Math.abs(after[key] - before[key]) <= 2,
      'layout jumped ' + (after[key] - before[key]) + 'px on ' + key + ' for ' + label,
      { before, after });
  }
}

async function assertInvalidStaysInText(page, name, text, partner) {
  const st = await fieldState(page, name);
  assert(!st.partsOpen, 'boxes opened on invalid blur for "' + text + '"', st);
  assert(!st.quickHidden, 'text field was hidden after invalid blur for "' + text + '"', st);
  assert(st.quickValue === text, 'typed text changed after blur of "' + text + '"', st);
  assert(st.ariaInvalid === 'true', 'aria-invalid was not set for "' + text + '"', st);
  assert(st.readbackErr, 'readback was not marked as an error for "' + text + '"', st);
  const expected = INVALID_ERRORS[text];
  if (expected) assert(st.readback === expected, 'wrong error for "' + text + '": ' + st.readback, st);
  assert(!st.focusIsQuick, 'focus was pulled back to the text field for "' + text + '"', st);
  if (partner) {
    const p = await fieldState(page, partner);
    assert(!p.partsOpen, 'the other field opened after invalid blur of "' + text + '"', p);
    assert(!p.quickHidden, 'the other field left text mode after "' + text + '"', p);
  }
  await page.waitForTimeout(80);
  const live = await page.evaluate(() => (document.getElementById('live') || {}).textContent || '');
  assert(live.length > 0, 'no aria-live announcement for "' + text + '"', { live, st });
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
    await typePartsDMY(page, 'dob', '31', '4', '2000');
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
    await type18Blank1999(page, 'dob');
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

  await check('Leave the field: invalid dates stay in text mode with an error', async () => {
    for (const text of ['31 April 2000', '18 May', 'abc']) {
      await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await typeQuick(page, 'dob', text);
      const before = await layoutProbes(page);
      await page.locator('[data-datefield="dob"] .quick').evaluate(el => el.blur());
      await page.waitForTimeout(80);
      await assertInvalidStaysInText(page, 'dob', text);
      assertNoJump(before, await layoutProbes(page), '"' + text + '" blur');
      await page.locator('h1').click({ force: true });
      await page.waitForTimeout(80);
      const st = await fieldState(page, 'dob');
      assert(!st.focusIsQuick, 'a delayed close pulled focus back for "' + text + '"', st);
      assert(!st.partsOpen, 'boxes opened after clicking away from "' + text + '"', st);
      assert(st.quickValue === text, 'text was changed after leaving "' + text + '"', st);
    }
  });


  await check('Field area height stays stable at 360, 393, 412 and 1280', async () => {
    const widths = [320, 360, 393, 412, 768, 1280];
    const paths = ['/', '/korean-age/', '/how-old-will-i-be/', '/birthday-countdown/'];
    const longError = 'abc';
    const longMessage = INVALID_ERRORS[longError];
    const valid = '15 March 1995';
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of paths) {
        await page.goto(server.url + path, { waitUntil: 'domcontentloaded' });
        const empty = await fieldAreaProbes(page);
        await typeQuick(page, 'dob', longError);
        await blurQuick(page, 'dob');
        await page.waitForTimeout(80);
        let st = await fieldState(page, 'dob');
        assert(st.readback === longMessage, 'wrong long error on ' + path + ' at ' + width + ': ' + st.readback, st);
        assert(st.readbackErr, 'long error was not marked as an error on ' + path + ' at ' + width, st);
        assertNoJump(empty, await fieldAreaProbes(page), 'long error on ' + path + ' at ' + width + 'px');
        await typeQuick(page, 'dob', valid);
        await blurQuick(page, 'dob');
        await page.waitForTimeout(80);
        st = await fieldState(page, 'dob');
        assert(/Reading this as/.test(st.readback) && !st.readbackErr, 'expected a readback on ' + path + ' at ' + width + ': ' + st.readback, st);
        assertNoJump(empty, await fieldAreaProbes(page), 'readback on ' + path + ' at ' + width + 'px');
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    for (const path of paths) {
      await page.goto(server.url + path, { waitUntil: 'domcontentloaded' });
      const empty = await fieldAreaProbes(page);
      await typeQuick(page, 'dob', longError);
      await blurQuick(page, 'dob');
      await page.waitForTimeout(80);
      assertNoJump(empty, await fieldAreaProbes(page), 'long error on ' + path + ' at 1280px and 200% zoom');
      await typeQuick(page, 'dob', valid);
      await blurQuick(page, 'dob');
      await page.waitForTimeout(80);
      assertNoJump(empty, await fieldAreaProbes(page), 'readback on ' + path + ' at 1280px and 200% zoom');
    }
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  });

  await check('Partial box input (18//1999) survives close and reopen', async () => {
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    const st0 = await fieldState(page, 'dob');
    if (!st0.partsOpen) await clickToggle(page, 'dob');
    await type18Blank1999(page, 'dob');
    await clickToggle(page, 'dob');
    let st = await fieldState(page, 'dob');
    assert(!st.partsOpen, 'boxes should have closed', st);
    assert(/18/.test(st.quickValue) && /1999/.test(st.quickValue), 'closing wiped the partial date', st);
    await clickToggle(page, 'dob');
    st = await fieldState(page, 'dob');
    assert(st.partsOpen, 'boxes should reopen', st);
    assert(st.parts[0] === '18', 'day 18 was lost on reopen', st);
    assert(!st.parts[1], 'month should still be empty on reopen', st);
    assert(st.parts[2] === '1999', 'year 1999 was lost on reopen', st);
  });

  await check('Clearing all three boxes after a stash also clears the text', async () => {
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    const st0 = await fieldState(page, 'dob');
    if (!st0.partsOpen) await clickToggle(page, 'dob');
    await type18Blank1999(page, 'dob');
    await clickToggle(page, 'dob');
    await clickToggle(page, 'dob');
    await typePartsDMY(page, 'dob', '', '', '');
    let st = await fieldState(page, 'dob');
    assert(!st.quickValue.trim(), 'clearing the boxes left "' + st.quickValue + '" in the text field', st);
    await clickToggle(page, 'dob');
    await clickToggle(page, 'dob');
    st = await fieldState(page, 'dob');
    assert(st.partsOpen, 'boxes should reopen after a clear', st);
    assert(st.parts[0] === '' && st.parts[1] === '' && st.parts[2] === '', 'cleared boxes came back on reopen', st);
  });

  await check('Shared toggle on /difference opens and closes both fields together', async () => {
    await page.goto(server.url + '/difference/', { waitUntil: 'domcontentloaded' });
    const toggle = page.locator('.parts-toggle.shared').first();
    const state = () => page.evaluate(() => {
      const fields = Array.from(document.querySelectorAll('[data-datefield]')).map(el => ({
        name: el.getAttribute('data-datefield'),
        open: !!(el.querySelector('.parts') && !el.querySelector('.parts').hidden),
      }));
      const t = document.querySelector('.parts-toggle.shared');
      return {
        fields,
        expanded: t ? t.getAttribute('aria-expanded') : null,
        label: t && t.querySelector('span') ? t.querySelector('span').textContent.trim() : '',
        focus: document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : '',
        focusIsToggle: !!(document.activeElement && document.activeElement.classList.contains('parts-toggle')),
        focusClass: document.activeElement ? document.activeElement.className : '',
        focusIsBody: document.activeElement === document.body,
      };
    });
    await toggle.click();
    await page.waitForTimeout(50);
    let st = await state();
    assert(st.fields.length >= 2, 'expected two date fields', st);
    assert(st.fields.every(f => f.open), 'first toggle tap did not open both fields', st);
    assert(st.expanded === 'true', 'aria-expanded should be true when both are open', st);
    assert(/Use one box/i.test(st.label), 'toggle label should say Use one box', st);
    assert(!st.focusIsToggle, 'focus was left on the toggle after open', st);
    await typePartsDMY(page, 'a', '30', '', '');
    await toggle.click();
    await page.waitForTimeout(80);
    st = await state();
    assert(st.fields.every(f => !f.open), 'toggle did not close both fields', st);
    assert(st.expanded === 'false', 'aria-expanded should be false when both are closed', st);
    await toggle.click();
    await page.waitForTimeout(80);
    st = await state();
    assert(st.fields.every(f => f.open), 'second toggle tap did not reopen both fields', st);
    assert(st.expanded === 'true', 'aria-expanded should be true after reopen', st);
    assert(/Use one box/i.test(st.label), 'toggle label out of sync after reopen', st);
    assert(!st.focusIsToggle, 'focus was left on the toggle after reopen', st);
    await page.locator('[data-datefield="a"] .p-y').click();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(80);
    st = await state();
    assert(st.fields.every(f => f.open), 'tabbing between fields left mixed modes', st);
    assert(st.expanded === 'true', 'toggle aria-expanded went false after tabbing between fields', st);
  });

  await check('Tab and Shift+Tab between invalid fields keep focus and the next key', async () => {
    await page.goto(server.url + '/difference/', { waitUntil: 'domcontentloaded' });
    await typeQuick(page, 'a', 'abc');
    const before = await layoutProbes(page);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(80);
    let a = await fieldState(page, 'a');
    let b = await fieldState(page, 'b');
    assert(!a.partsOpen && !b.partsOpen, 'boxes opened when Tabbing from A to B', { a, b });
    assert(a.quickValue === 'abc', 'A lost its text after Tab', a);
    assert(a.readback === INVALID_ERRORS['abc'], 'A did not show the unreadable error after Tab', a);
    assert(b.focusIsQuick, 'Tab from invalid A did not land in B’s text field', { a, b });
    assert(!b.focusIsBody && !a.focusIsBody, 'Tab from A to B dropped focus to the body', { a, b });
    await page.keyboard.type('3', { delay: 20 });
    b = await fieldState(page, 'b');
    assert(b.quickValue === '3', 'the keystroke after Tab was lost; B has "' + b.quickValue + '"', b);
    assertNoJump(before, await layoutProbes(page), 'Tab A to B');

    await typeQuick(page, 'b', '18 May');
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(80);
    a = await fieldState(page, 'a');
    b = await fieldState(page, 'b');
    assert(!a.partsOpen && !b.partsOpen, 'boxes opened when Shift+Tabbing from B to A', { a, b });
    assert(b.quickValue === '18 May', 'B lost its text after Shift+Tab', b);
    assert(b.readback === INVALID_ERRORS['18 May'], 'B did not show “Add the year.” after leaving', b);
    assert(a.focusIsQuick, 'Shift+Tab from invalid B did not land in A’s text field', { a, b });
    await page.keyboard.type('x', { delay: 20 });
    a = await fieldState(page, 'a');
    assert(/x/.test(a.quickValue), 'the keystroke after Shift+Tab was lost; A has "' + a.quickValue + '"', a);
  });

  await check('Tab onto the shared toggle with invalid text leaves both fields in text mode', async () => {
    await page.goto(server.url + '/difference/', { waitUntil: 'domcontentloaded' });
    await typeQuick(page, 'a', '31 April 2000');
    await page.keyboard.press('Tab'); // to B
    await page.keyboard.press('Tab'); // to shared toggle
    await page.waitForTimeout(80);
    const info = await page.evaluate(() => {
      const t = document.querySelector('.parts-toggle.shared');
      const fields = Array.from(document.querySelectorAll('[data-datefield]')).map(el => ({
        name: el.getAttribute('data-datefield'),
        open: !!(el.querySelector('.parts') && !el.querySelector('.parts').hidden),
        text: el.querySelector('.quick') ? el.querySelector('.quick').value : '',
      }));
      return {
        fields,
        expanded: t ? t.getAttribute('aria-expanded') : null,
        label: t && t.querySelector('span') ? t.querySelector('span').textContent.trim() : '',
        focusIsToggle: !!(document.activeElement && document.activeElement.classList.contains('parts-toggle')),
      };
    });
    assert(info.fields.every(f => !f.open), 'Tab onto the toggle opened the boxes', info);
    assert(info.expanded === 'false', 'toggle aria-expanded should stay false', info);
    assert(/Type day, month and year separately/i.test(info.label), 'toggle label flipped on Tab', info);
    assert(info.focusIsToggle, 'focus should be on the toggle', info);
    assert(info.fields[0].text === '31 April 2000', 'A’s text was changed', info);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => {
      const t = document.querySelector('.parts-toggle.shared');
      return {
        open: Array.from(document.querySelectorAll('[data-datefield]')).map(el => !!(el.querySelector('.parts') && !el.querySelector('.parts').hidden)),
        expanded: t ? t.getAttribute('aria-expanded') : null,
        focusClass: document.activeElement ? document.activeElement.className : '',
      };
    });
    assert(after.open.every(Boolean), 'Enter on the toggle did not open both fields', after);
    assert(after.expanded === 'true', 'aria-expanded should be true after Enter', after);
    assert(/p-d/.test(after.focusClass), 'Enter on the toggle should focus the first Day box', after);
  });

  await check('Tabbing past the shared toggle closes both fields’ boxes', async () => {
    await page.goto(server.url + '/difference/', { waitUntil: 'domcontentloaded' });
    const toggle = page.locator('.parts-toggle.shared').first();
    await toggle.click();
    await page.waitForTimeout(50);
    await page.locator('[data-datefield="a"] .p-d').click();
    for (let i = 0; i < 7; i++) await page.keyboard.press('Tab');
    await page.waitForTimeout(80);
    const info = await page.evaluate(() => {
      const t = document.querySelector('.parts-toggle.shared');
      const fields = Array.from(document.querySelectorAll('[data-datefield]')).map(el => ({
        name: el.getAttribute('data-datefield'),
        open: !!(el.querySelector('.parts') && !el.querySelector('.parts').hidden),
      }));
      const a = document.activeElement;
      const inGroup = !!(a && (
        (a.closest && a.closest('[data-datefield]')) ||
        (a.closest && a.closest('.parts-toggle'))
      ));
      return {
        fields,
        expanded: t ? t.getAttribute('aria-expanded') : null,
        label: t && t.querySelector('span') ? t.querySelector('span').textContent.trim() : '',
        inGroup,
        focus: a ? (a.className || a.tagName) : '',
      };
    });
    assert(!info.inGroup, 'focus never left the group after tabbing past the toggle; last focus was ' + info.focus, info);
    assert(info.fields.every(f => !f.open), 'boxes were still open after tabbing past the toggle', info);
    assert(info.expanded === 'false', 'aria-expanded should be false after leaving the group', info);
    assert(/Type day, month and year separately/i.test(info.label), 'toggle label still said the boxes were open', info);
  });

  const TODAY_Q = '?today=16%20November%202026';

  await check('Future date of birth: field error, no result, error announced', async () => {
    const MSG = 'That date hasn’t happened yet. Check the year.';
    for (const path of ['/', '/how-old-will-i-be/', '/past/', '/korean-age/', '/birthday-countdown/']) {
      await page.goto(server.url + path + TODAY_Q, { waitUntil: 'domcontentloaded' });
      await typeQuick(page, 'dob', '1 January 2030');
      await blurQuick(page, 'dob');
      await page.waitForTimeout(800);
      const st = await fieldState(page, 'dob');
      assert(!st.partsOpen, 'boxes opened for a future DOB on ' + path, st);
      assert(st.quickValue === '1 January 2030', 'future DOB text was changed on ' + path, st);
      assert(st.ariaInvalid === 'true', 'future DOB was not marked invalid on ' + path, st);
      assert(st.readback === MSG, 'wrong future DOB error on ' + path + ': ' + st.readback, st);
      const leaf = await page.evaluate(() => {
        const el = document.getElementById('leaf');
        const live = document.getElementById('live');
        return {
          state: el ? el.getAttribute('data-state') : null,
          text: el ? el.innerText.replace(/\s+/g, ' ').trim() : '',
          live: live ? live.textContent.trim() : '',
        };
      });
      assert(leaf.state !== 'result', 'a future DOB still produced a result on ' + path, leaf);
      assert(!/\d+\s+years?\s+old/i.test(leaf.text) && !/\b\d+\s+years\b/i.test(leaf.text),
        'a future DOB still showed an age on ' + path, leaf);
      assert(!/Type (your|a) date of birth/i.test(leaf.text), 'the empty prompt was still showing for a future DOB on ' + path, leaf);
      assert(/hasn.t happened yet/i.test(leaf.live) && /Check the (date|year)/i.test(leaf.live),
        'the future DOB error was not announced on ' + path + ': "' + leaf.live + '"', leaf);
    }
  });

  await check('Future date on /difference is allowed and shows a result', async () => {
    await page.goto(server.url + '/difference/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    await typeQuick(page, 'a', '1 January 2030');
    await blurQuick(page, 'a');
    await typeQuick(page, 'b', '2 June 1990');
    await blurQuick(page, 'b');
    await page.waitForTimeout(80);
    const a = await fieldState(page, 'a');
    const b = await fieldState(page, 'b');
    assert(a.ariaInvalid !== 'true' && !a.readbackErr, 'future date on /difference was flagged as an error', a);
    assert(b.ariaInvalid !== 'true' && !b.readbackErr, 'the second date was flagged as an error', b);
    const leaf = await page.evaluate(() => {
      const el = document.getElementById('leaf');
      return {
        state: el ? el.getAttribute('data-state') : null,
        text: el ? el.innerText.replace(/\s+/g, ' ').trim() : '',
      };
    });
    assert(leaf.state === 'result', 'future dates on /difference did not produce a result', leaf);
    assert(/elder/i.test(leaf.text) || /\d+\s+years/i.test(leaf.text), 'expected an age-gap result on /difference', leaf);
  });

  await check('Typing a DOB character by character on /past and /past/1999/ still gives a result', async () => {
    async function typeDobSlowly(page, text) {
      const loc = page.locator('[data-datefield="dob"] .quick');
      await loc.click();
      await loc.fill('');
      await loc.type(text, { delay: 40 });
      await blurQuick(page, 'dob');
      await page.waitForTimeout(80);
    }
    // Year page: age-on is pre-filled to 1 January 1999.
    await page.goto(server.url + '/past/1999/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    await typeDobSlowly(page, '18 May 1990');
    let dob = await fieldState(page, 'dob');
    let on = await fieldState(page, 'on');
    assert(/18 May 1990/i.test(dob.quickValue), 'DOB was not kept on /past/1999/', dob);
    assert(dob.ariaInvalid !== 'true' && !dob.readbackErr, 'valid DOB marked invalid on /past/1999/', dob);
    assert(!on || (on.ariaInvalid !== 'true' && !on.readbackErr), 'age-on was marked invalid after typing a earlier DOB on /past/1999/', on);
    let leaf = await page.evaluate(() => {
      const el = document.getElementById('leaf');
      return { state: el ? el.getAttribute('data-state') : null, text: el ? el.innerText.replace(/\s+/g, ' ').trim() : '' };
    });
    assert(leaf.state === 'result', 'no age shown on /past/1999/ after typing the DOB', leaf);
    assert(/years?/i.test(leaf.text), 'expected an age result on /past/1999/', leaf);

    // /past with age-on set first, then a character-by-character DOB before that date.
    await page.goto(server.url + '/past/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    const onToggle = page.locator('#on-toggle, [data-datefield="on"] .quick').first();
    // Reveal the on field if needed, then type the age-on date.
    const onVisible = await page.locator('[data-datefield="on"] .quick').isVisible();
    if (!onVisible) {
      const btn = page.locator('#on-toggle');
      if (await btn.count()) await btn.click();
    }
    await typeQuick(page, 'on', '1 January 2010');
    await blurQuick(page, 'on');
    await typeDobSlowly(page, '18 May 1999');
    dob = await fieldState(page, 'dob');
    on = await fieldState(page, 'on');
    assert(/18 May 1999/i.test(dob.quickValue), 'DOB was not kept on /past/', dob);
    assert(dob.ariaInvalid !== 'true' && !dob.readbackErr, 'valid DOB marked invalid on /past/', dob);
    assert(on.ariaInvalid !== 'true' && !on.readbackErr, 'age-on was marked invalid after typing a earlier DOB on /past/', on);
    leaf = await page.evaluate(() => {
      const el = document.getElementById('leaf');
      return { state: el ? el.getAttribute('data-state') : null, text: el ? el.innerText.replace(/\s+/g, ' ').trim() : '' };
    });
    assert(leaf.state === 'result', 'no age shown on /past/ after typing the DOB', leaf);
    assert(/years?/i.test(leaf.text), 'expected an age result on /past/', leaf);
  });

  await check('Typing a DOB on /past/1999/ does not announce a wrong Not born yet mid-way', async () => {
    await page.goto(server.url + '/past/1999/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    const loc = page.locator('[data-datefield="dob"] .quick');
    await loc.click();
    await loc.fill('');
    const lives = [];
    for (const ch of '18 May 19') {
      await loc.type(ch, { delay: 0 });
      await page.waitForTimeout(40);
      lives.push(await page.evaluate(() => (document.getElementById('live') || {}).textContent || ''));
    }
    const wrong = lives.filter((s) => /Not born yet/i.test(s));
    assert(wrong.length === 0, 'a mid-typing "Not born yet" was announced on /past/1999/', { lives, wrong });
    await loc.type('90', { delay: 40 });
    await blurQuick(page, 'dob');
    await page.waitForTimeout(80);
    const leaf = await page.evaluate(() => {
      const el = document.getElementById('leaf');
      return { state: el ? el.getAttribute('data-state') : null, live: (document.getElementById('live') || {}).textContent || '' };
    });
    assert(leaf.state === 'result', 'no age shown after finishing the DOB on /past/1999/', leaf);
    assert(!/Not born yet/i.test(leaf.live), 'Not born yet stayed in the live region after a valid earlier DOB', leaf);
  });

  async function assertAnnouncedResult(page, label) {
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() => {
      const el = document.getElementById('leaf');
      const live = document.getElementById('live');
      return {
        state: el ? el.getAttribute('data-state') : null,
        live: live ? live.textContent.trim() : '',
        text: el ? el.innerText.replace(/\s+/g, ' ').trim() : '',
      };
    });
    assert(info.state === 'result', 'no result after a quick blur on ' + label, info);
    assert(info.live.length > 0, 'the result was not announced after a quick blur on ' + label, info);
    return info;
  }

  await check('A result is announced if the field is left within 100-300ms of typing', async () => {
    const cases = [
      { path: '/', name: 'dob', text: '18 May 1990', hint: /year|old|birthday/i },
      { path: '/past/1999/', name: 'dob', text: '18 May 1990', hint: /year|old/i },
      { path: '/korean-age/', name: 'dob', text: '18 May 1990', hint: /age/i },
      { path: '/birthday-countdown/', name: 'dob', text: '18 May 1990', hint: /day|birthday/i },
      { path: '/how-old-will-i-be/', name: 'dob', text: '18 May 1990', hint: /turn|year|old/i },
    ];
    for (const c of cases) {
      await page.goto(server.url + c.path + TODAY_Q, { waitUntil: 'domcontentloaded' });
      const loc = page.locator('[data-datefield="' + c.name + '"] .quick');
      await loc.click();
      await loc.fill('');
      await loc.type(c.text, { delay: 15 });
      await page.waitForTimeout(150);
      await loc.evaluate((el) => el.blur());
      const info = await assertAnnouncedResult(page, c.path);
      assert(c.hint.test(info.live), 'unexpected announcement on ' + c.path + ': "' + info.live + '"', info);
    }

    // /difference: blur the second date promptly
    await page.goto(server.url + '/difference/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    await typeQuick(page, 'a', '15 March 1995');
    await blurQuick(page, 'a');
    const bLoc = page.locator('[data-datefield="b"] .quick');
    await bLoc.click();
    await bLoc.fill('');
    await bLoc.type('20 September 1993', { delay: 15 });
    await page.waitForTimeout(150);
    await bLoc.evaluate((el) => el.blur());
    let info = await assertAnnouncedResult(page, '/difference/');
    assert(/year|elder|older|month|day/i.test(info.live), 'unexpected announcement on /difference/: "' + info.live + '"', info);

    // /days-between-dates
    await page.goto(server.url + '/days-between-dates/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    await typeQuick(page, 'start', '1 January 2020');
    await blurQuick(page, 'start');
    const endLoc = page.locator('[data-datefield="end"] .quick');
    await endLoc.click();
    await endLoc.fill('');
    await endLoc.type('25 December 2020', { delay: 15 });
    await page.waitForTimeout(150);
    await endLoc.evaluate((el) => el.blur());
    info = await assertAnnouncedResult(page, '/days-between-dates/');
    assert(/day/i.test(info.live), 'unexpected announcement on /days-between-dates/: "' + info.live + '"', info);

    // /chronological-age
    await page.goto(server.url + '/chronological-age/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    await typeQuick(page, 'dob', '4 July 2018');
    await blurQuick(page, 'dob');
    const testLoc = page.locator('[data-datefield="test"] .quick');
    await testLoc.click();
    await testLoc.fill('');
    await testLoc.type('16 November 2026', { delay: 15 });
    await page.waitForTimeout(150);
    await testLoc.evaluate((el) => el.blur());
    info = await assertAnnouncedResult(page, '/chronological-age/');
    assert(/age|year|month/i.test(info.live), 'unexpected announcement on /chronological-age/: "' + info.live + '"', info);

    // Dog age: years box
    await page.goto(server.url + '/dog-age/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    const pet = page.locator('#pet-y');
    await pet.click();
    await pet.fill('');
    await pet.type('7', { delay: 20 });
    await page.waitForTimeout(150);
    await pet.evaluate((el) => el.blur());
    info = await assertAnnouncedResult(page, '/dog-age/');
    assert(/human years/i.test(info.live), 'unexpected announcement on /dog-age/: "' + info.live + '"', info);

    // How-old year box, with a DOB already in
    await page.goto(server.url + '/how-old-will-i-be/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    await typeQuick(page, 'dob', '18 May 1990');
    await blurQuick(page, 'dob');
    const year = page.locator('#in-year');
    await year.click();
    await year.fill('');
    await year.type('2040', { delay: 20 });
    await page.waitForTimeout(150);
    await year.evaluate((el) => el.blur());
    info = await assertAnnouncedResult(page, 'year box on /how-old-will-i-be/');
    assert(/2040|turn|year|old/i.test(info.live), 'unexpected announcement from the year box: "' + info.live + '"', info);

    // Time-zone menu: opening it blurs the date field promptly
    await page.goto(server.url + '/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    const dob = page.locator('[data-datefield="dob"] .quick');
    await dob.click();
    await dob.fill('');
    await dob.type('18 May 1990', { delay: 15 });
    await page.waitForTimeout(150);
    const tog = page.locator('#on-toggle');
    await tog.click();
    const zone = page.locator('#zone');
    await zone.waitFor({ state: 'visible' });
    await zone.focus();
    const opt = await zone.evaluate(() => {
      const s = document.getElementById('zone');
      const found = Array.from(s.options).find((o) => /Tokyo|New_York|Paris/.test(o.value || o.text));
      return found ? found.value : (s.options[1] && s.options[1].value);
    });
    assert(opt, 'no other time zone to pick', { opt });
    await zone.selectOption(opt);
    await zone.evaluate((el) => el.blur());
    info = await assertAnnouncedResult(page, 'time-zone menu');
    assert(/year|old|birthday/i.test(info.live), 'unexpected announcement after changing the time zone: "' + info.live + '"', info);
  });

  await ctx.close();
  await ctx.close();


  async function tapIMeantWhileFocused(page, label) {
    await page.goto(server.url + '/' + TODAY_Q, { waitUntil: 'domcontentloaded' });
    const loc = page.locator('[data-datefield="dob"] .quick');
    await loc.click();
    await loc.fill('');
    await loc.type('05/06/1999', { delay: 15 });
    const swap = page.locator('.readback .swap');
    await swap.waitFor({ state: 'visible' });
    const before = await loc.inputValue();
    const meant = (await swap.innerText()).replace(/^I meant\s+/i, '').trim();
    assert(/May|June/i.test(meant), 'no swap offered for 05/06/1999 on ' + label + ': "' + meant + '"');
    const focused = await loc.evaluate((el) => document.activeElement === el);
    assert(focused, 'the date field was not focused before the I meant tap on ' + label);
    await swap.tap();
    await page.waitForTimeout(120);
    const st = await fieldState(page, 'dob');
    assert(st.quickValue !== before, 'a single tap on I meant did not change the date on ' + label + ': still "' + st.quickValue + '"', st);
    const meantRe = new RegExp(meant.replace(/\s+/g, '\\s+'), 'i');
    assert(meantRe.test(st.quickValue), 'a single tap on I meant did not switch to ' + meant + ' on ' + label + ': "' + st.quickValue + '"', st);
    assert(!/I meant/i.test(st.readback), 'I meant was still offered after the tap on ' + label, st);
  }

  async function assertFieldAreaStableOn(page, label) {
    const longError = 'abc';
    const longMessage = INVALID_ERRORS[longError];
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    const empty = await fieldAreaProbes(page);
    await typeQuick(page, 'dob', longError);
    await blurQuick(page, 'dob');
    await page.waitForTimeout(80);
    let st = await fieldState(page, 'dob');
    assert(st.readback === longMessage, 'wrong long error on ' + label + ': ' + st.readback, st);
    assertNoJump(empty, await fieldAreaProbes(page), 'long error on ' + label);
    await typeQuick(page, 'dob', '15 March 1995');
    await blurQuick(page, 'dob');
    await page.waitForTimeout(80);
    st = await fieldState(page, 'dob');
    assert(/Reading this as/.test(st.readback) && !st.readbackErr, 'expected a readback on ' + label + ': ' + st.readback, st);
    assertNoJump(empty, await fieldAreaProbes(page), 'readback on ' + label);
  }

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

    await check('Leave the field on WebKit: invalid date stays in text mode', async () => {
      await wpage.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await typeQuick(wpage, 'dob', '31 April 2000');
      await wpage.locator('[data-datefield="dob"] .quick').evaluate(el => el.blur());
      await wpage.waitForTimeout(80);
      await assertInvalidStaysInText(wpage, 'dob', '31 April 2000');
    });
    await check('Field area height stays stable on WebKit iPhone', async () => {
      await assertFieldAreaStableOn(wpage, 'WebKit iPhone');
    });
    await check('A single tap on I meant while the field is focused (WebKit)', async () => {
      await tapIMeantWhileFocused(wpage, 'WebKit iPhone');
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
    await check('Leave the field on Chromium mobile: invalid date stays in text mode', async () => {
      await ppage.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
      await typeQuick(ppage, 'dob', '31 April 2000');
      await ppage.locator('[data-datefield="dob"] .quick').evaluate(el => el.blur());
      await ppage.waitForTimeout(80);
      await assertInvalidStaysInText(ppage, 'dob', '31 April 2000');
    });
    await check('Field area height stays stable on Pixel 7', async () => {
      await assertFieldAreaStableOn(ppage, 'Pixel 7');
    });
    await check('A single tap on I meant while the field is focused (Pixel 7)', async () => {
      await tapIMeantWhileFocused(ppage, 'Pixel 7');
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
