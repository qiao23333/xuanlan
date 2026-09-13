import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'http://localhost:4173/';

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1672, height: 941 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(2000);

  // Dismiss all modals
  for (let i = 0; i < 15; i++) {
    const ok = await page.evaluate(() => {
      const v = document.querySelector('.modal-veil');
      const s = v || document;
      const b = [...s.querySelectorAll('button')].find((x) => /同意|接受|我已了解|开始使用|下一步|下一页|开始体验|跳过|进入|确认|稍后再说|了解/.test((x.textContent || '').replace(/\s/g, '')));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!ok) break;
    await sleep(500);
  }

  // Click 术语百科 nav button
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button.nav-item, [class*="nav"]')].find((x) => (x.textContent || '').includes('术语'));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('nav clicked:', clicked);
  await sleep(2000); // wait for SPA route + render

  // Check current page state
  const state = await page.evaluate(() => ({
    url: location.href,
    hash: location.hash,
    theme: document.documentElement.getAttribute('data-theme'),
    hasGlPage: !!document.querySelector('.gl-page'),
    hasGlCards: document.querySelectorAll('.gl-syscard').length,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
  }));
  console.log('state:', JSON.stringify(state));

  if (!state.hasGlPage) {
    console.log('WARNING: glossary page not loaded! Taking full screenshot to diagnose...');
    await page.screenshot({ path: '.tmp-nav-debug.png', fullPage: true });
  }

  // Sample gl-syscard backgrounds specifically
  const cardSample = await page.evaluate(() => {
    const cards = document.querySelectorAll('.gl-syscard');
    if (!cards.length) return { error: 'no cards found' };
    const first = cards[0];
    const cs = getComputedStyle(first);
    return {
      count: cards.length,
      bg: cs.backgroundColor,
      border: cs.borderColor,
      opacity: cs.opacity,
      backdropFilter: cs.backdropFilter,
      // Also check parent chain
      parentBgs: (() => {
        let el = first.parentElement;
        const bgs = [];
        while (el && bgs.length < 5) {
          bgs.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 30), bg: getComputedStyle(el).backgroundColor });
          el = el.parentElement;
        }
        return bgs;
      })(),
    };
  });
  console.log('\ncard sample:', JSON.stringify(cardSample));

  // Now toggle theme and re-sample
  console.log('\n--- switching to light ---');
  await page.evaluate(() => { if (document.documentElement.getAttribute('data-theme') !== 'light') document.querySelector('.theme-toggle')?.click(); });
  await sleep(600);
  const lightCards = await page.evaluate(() => {
    const c = document.querySelector('.gl-syscard');
    if (!c) return null;
    const cs = getComputedStyle(c);
    return { bg: cs.backgroundColor, theme: document.documentElement.getAttribute('data-theme') };
  });
  console.log('light cards:', JSON.stringify(lightCards));

  console.log('\n--- switching to dark ---');
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(600);
  const darkCards = await page.evaluate(() => {
    const c = document.querySelector('.gl-syscard');
    if (!c) return null;
    const cs = getComputedStyle(c);
    return { bg: cs.backgroundColor, theme: document.documentElement.getAttribute('data-theme') };
  });
  console.log('dark cards:', JSON.stringify(darkCards));

  // Take comparison screenshots
  await page.screenshot({ path: '.tmp-gl-cards-light.png' });
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(500);
  await page.screenshot({ path: '.tmp-gl-cards-dark.png' });

  await browser.close();
})();
