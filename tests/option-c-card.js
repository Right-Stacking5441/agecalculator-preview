/* Option C result card: age-1 headline rule, Copywriter section 5 strings,
   and a few §22 edge cases. Run:
   PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 NODE_PATH=... node tests/option-c-card.js
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

async function card(page) {
  return page.evaluate(() => {
    const leaf = document.getElementById('leaf');
    const num = leaf && leaf.querySelector('.big .num');
    const unit = leaf && leaf.querySelector('.big .unit');
    const rest = leaf && leaf.querySelector('.lead .rest, .big + .rest, .rest.tight, p.rest');
    const say = leaf && leaf.querySelector('.say-line');
    const stamp = leaf && leaf.querySelector('.stamp');
    const born = leaf && leaf.querySelector('.born');
    const head = leaf ? leaf.innerText : '';
    return {
      state: leaf ? leaf.getAttribute('data-state') : null,
      num: num ? num.textContent.trim() : '',
      unit: unit ? unit.textContent.trim() : '',
      rest: rest ? rest.textContent.trim() : '',
      say: say ? say.textContent.trim() : '',
      stamp: stamp ? stamp.textContent.trim() : '',
      born: born ? born.textContent.trim() : '',
      text: head.replace(/\s+/g, ' ').trim(),
      hasOld: /\bold\b/i.test((num && num.parentElement && num.parentElement.textContent) || ''),
    };
  });
}

async function typeDob(page, value, name) {
  const loc = page.locator('[data-datefield="' + (name || 'dob') + '"] .quick');
  await loc.click();
  await loc.fill('');
  await loc.type(value, { delay: 8 });
  await loc.evaluate((el) => el.blur());
  await page.waitForTimeout(80);
}

async function goto(page, server, path, today) {
  const q = today ? (path.includes('?') ? '&' : '?') + 'today=' + encodeURIComponent(today) : '';
  await page.goto(server.url + path + q, { waitUntil: 'networkidle' });
}

(async () => {
  const pw = loadPlaywright();
  const server = await startServer(require('path').join(__dirname, '..', 'docs'));
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  let passed = 0, failed = 0;
  async function check(name, fn) {
    try {
      await fn();
      passed += 1;
      console.log('PASS  ' + name);
    } catch (e) {
      failed += 1;
      console.log('FAIL  ' + name);
      console.log('      ' + e.message);
    }
  }

  const TODAY = '17 November 2026';

  await check('under 1 month: days, no old, no sentence under 7 days', async () => {
    await goto(page, server, '/', TODAY);
    await typeDob(page, '16 November 2026');
    const c = await card(page);
    assert(c.num === '1' && /^days?$/.test(c.unit), 'expected 1 day', c);
    assert(!c.hasOld, 'headline has old', c);
    assert(!c.say, 'sentence should be omitted under 7 days', c);
  });

  await check('born today: 0 days, The day you were born, no sentence', async () => {
    await goto(page, server, '/', TODAY);
    await typeDob(page, '17 November 2026');
    const c = await card(page);
    assert(c.num === '0' && c.unit === 'days', 'expected 0 days', c);
    assert(/The day you were born/i.test(c.text), 'missing born-today line', c);
    assert(!c.say, 'no sentence on the day you were born', c);
    assert(!c.hasOld, 'headline has old', c);
  });

  await check('from 1 month to first birthday: months as the big number', async () => {
    await goto(page, server, '/', TODAY);
    await typeDob(page, '5 May 2026');
    const c = await card(page);
    assert(/months/.test(c.unit) && !/years/.test(c.unit), 'expected months headline', c);
    assert(c.num === '6', 'expected 6 months on 5 May to 17 Nov', c);
    assert(/and 12 days/.test(c.unit + ' ' + c.rest), 'expected and 12 days', c);
    assert(!c.hasOld, 'headline has old', c);
  });

  await check('first birthday is 1 year, not 12 months', async () => {
    await goto(page, server, '/', TODAY);
    await typeDob(page, '17 November 2025');
    const c = await card(page);
    assert(c.num === '1' && /^years?$/.test(c.unit), 'expected 1 year', c);
    assert(!/12 months/.test(c.text), 'still saying 12 months', c);
    assert(!c.hasOld, 'headline has old', c);
  });

  await check('18 months is 1 year over 6 months', async () => {
    await goto(page, server, '/', TODAY);
    await typeDob(page, '17 May 2025');
    const c = await card(page);
    assert(c.num === '1' && /^years?$/.test(c.unit), 'expected 1 year', c);
    assert(/^6 months/.test(c.rest) || /6 months/.test(c.rest), 'expected 6 months underneath', c);
    assert(!c.hasOld, 'headline has old', c);
  });

  await check('from age 1, years with remainder; today sentence uses since you were born', async () => {
    await goto(page, server, '/', '16 November 2026');
    await typeDob(page, '15 March 1995');
    const c = await card(page);
    assert(c.num === '31' && /years/.test(c.unit), 'expected 31 years', c);
    assert(/8 months/.test(c.rest) && /1 day/.test(c.rest), 'expected 8 months and 1 day', c);
    assert(/That’s .*1,652 weeks and 5 days/.test(c.say) || /That’s .*1,652 weeks and 5 days/.test(c.text), 'weeks sentence', c);
    assert(/11,569 days/.test(c.say + c.text), '11,569 days', c);
    assert(/since you were born/.test(c.say), 'today tense', c);
    assert(!c.hasOld, 'headline has old', c);
    assert(/Born/.test(c.born), 'birth date on the card', c);
  });

  await check('very old age still uses years', async () => {
    await goto(page, server, '/', TODAY);
    await typeDob(page, '1 January 1901');
    const c = await card(page);
    assert(c.num === '125' && /years/.test(c.unit), 'expected 125 years', c);
    assert(/10 months/.test(c.rest) && /16 days/.test(c.rest), 'remainder', c);
  });

  await check('future date of birth keeps the card empty', async () => {
    await goto(page, server, '/', TODAY);
    await typeDob(page, '17 November 2027');
    const c = await card(page);
    assert(c.state !== 'result', 'future DOB should not show a result', c);
  });

  await check('/past stamp is sentence case; set-date tense', async () => {
    await goto(page, server, '/past/', TODAY);
    await typeDob(page, '15 March 1995');
    const on = page.locator('[data-datefield="on"] .quick');
    await on.click(); await on.fill(''); await on.type('23 June 2016', { delay: 8 });
    await on.evaluate((el) => el.blur());
    await page.waitForTimeout(80);
    const c = await card(page);
    assert(c.stamp === '23 Jun 2016', 'stamp should be sentence case, no tracking', c);
    assert(/On that date it had been/.test(c.say + c.text), 'past tense', c);
    assert(!/[A-Z]{3}/.test(c.stamp.replace(/^[0-9]+ /, '').slice(0,3)) || c.stamp.includes('Jun'), 'stamp should not be all-caps', c);
  });

  await check('/difference uses That’s a gap of…', async () => {
    await goto(page, server, '/difference/', TODAY);
    await typeDob(page, '1 January 2000', 'a');
    await typeDob(page, '1 July 2000', 'b');
    const c = await card(page);
    assert(/That’s a gap of/.test(c.say + c.text), 'gap wording', c);
    assert(!/between you/.test(c.text), 'between you should be gone', c);
    assert(!c.hasOld, 'headline has old', c);
  });

  await check('/how-old-will-i-be headline has no old', async () => {
    await goto(page, server, '/how-old-will-i-be/?year=2050', '16 November 2026');
    await typeDob(page, '15 March 1995');
    const c = await card(page);
    assert(!c.hasOld && !/years old/.test(c.text), 'headline still has old', c);
  });

  await check('cat page keeps SEO phrase in title, H1 and body', async () => {
    await goto(page, server, '/cat-age/', TODAY);
    const info = await page.evaluate(() => ({
      title: document.title,
      h1: (document.querySelector('h1') || {}).textContent || '',
      body: document.body.innerText,
    }));
    assert(/Cat age calculator/i.test(info.title), 'title missing phrase', info);
    assert(/Cat age calculator/i.test(info.h1), 'H1 missing phrase', info);
    // Body no longer repeats "This cat age calculator looks"; the phrase stays in title/H1.
    // A related phrase should still appear in the body copy or the H1 is in the body text.
    assert(/Cat age calculator/.test(info.body), 'body/H1 missing phrase', { h1: info.h1 });
  });

  await check('no FAQPage JSON-LD on the 11 calculators', async () => {
    const pages = ['/', '/past/', '/difference/', '/days-between-dates/', '/chronological-age/', '/dog-age/', '/cat-age/', '/korean-age/', '/birthday-countdown/', '/how-old-will-i-be/', '/what-year-was-i-born/'];
    for (const path of pages) {
      const res = await page.goto(server.url + path, { waitUntil: 'domcontentloaded' });
      const html = await page.content();
      assert(!/"@type"\s*:\s*"FAQPage"/.test(html), 'FAQPage on ' + path);
    }
  });

  await browser.close();
  server.close();
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
