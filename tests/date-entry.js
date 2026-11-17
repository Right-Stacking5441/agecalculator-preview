/* Date-entry regressions for H1 / M1 / M2 / M3.
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

async function run() {
  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS || '1';
  const { chromium } = loadPlaywright();
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

  await check('M2: fixing the date in the boxes keeps focus off body', async () => {
    await page.goto(server.url + '/', { waitUntil: 'domcontentloaded' });
    await typeQuick(page, 'dob', '31 April 2000');
    await blurQuick(page, 'dob');
    let st = await fieldState(page, 'dob');
    if (!st.partsOpen) {
      await clickToggle(page, 'dob');
      st = await fieldState(page, 'dob');
    }
    assert(st.partsOpen, 'boxes should be open so the date can be fixed', st);
    const day = page.locator('[data-datefield="dob"] .p-d');
    await day.fill('30');
    await day.press('Tab');
    // Let auto-close run if it will.
    await page.waitForTimeout(50);
    const after = await fieldState(page, 'dob');
    assert(!after.focusIsBody, 'focus dropped to body after the date was fixed', after);
    const focusOk = await page.evaluate(() => {
      const a = document.activeElement;
      const el = document.querySelector('[data-datefield="dob"]');
      return !!(a && el && (el.contains(a) || a.classList.contains('parts-toggle') || a.classList.contains('quick')));
    });
    assert(focusOk, 'focus should stay on the date field or its toggle', after);
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

  await ctx.close();
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
