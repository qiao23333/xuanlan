import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'http://localhost:4173/';

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1672, height: 941 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1500);

  // Dismiss onboarding/consent
  for (let i = 0; i < 15; i++) {
    const clicked = await page.evaluate(() => {
      const veil = document.querySelector('.modal-veil');
      const scope = veil || document;
      const btns = [...scope.querySelectorAll('button, [role="button"]')];
      const b = btns.find((x) => /同意|接受|我已了解|开始使用|下一步|下一页|开始体验|跳过|进入|确认|稍后再说|了解/.test((x.textContent || '').replace(/\s/g, '')));
      if (b) { b.click(); return b.textContent?.trim(); }
      return null;
    });
    if (!clicked) break;
    await sleep(600);
  }

  // Try to navigate to glossary - find ANY element with "术语"
  const navResult = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')];
    const matches = all.filter((el) => (el.textContent || '').includes('术语')).slice(0, 10);
    return matches.map((el) => ({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), text: (el.textContent || '').trim().slice(0, 30), id: el.id }));
  });
  console.log('Elements containing "术语":', JSON.stringify(navResult).slice(0, 500));

  // Click the first one that looks like a nav item
  await page.evaluate(() => {
    const all = [...document.querySelectorAll('button, [role="button"], a, [tabindex], li, span, div')];
    const term = all.find((el) => {
      const t = (el.textContent || '').trim();
      return t === '术语' || t === '术语百科' || (t.includes('术语') && t.length < 10);
    });
    if (term) { term.click(); return `clicked: ${term.tagName}.${term.className}`; }
    return 'not found';
  }).then(console.log);
  await sleep(1500);

  // Now sample backgrounds
  const sample = () => page.evaluate(() => {
    const theme = document.documentElement.getAttribute('data-theme');
    const url = window.location.hash;
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
    // Get ALL elements with visible background
    const results = [];
    for (const el of document.querySelectorAll('*')) {
      if (!el.offsetParent) continue;
      const cs = getComputedStyle(el);
      const bg = cs.backgroundColor;
      if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) continue;
      results.push({
        sel: `${el.tagName}.${(el.className || '').toString().slice(0, 30)}`.replace(/\s+/g, '.'),
        bg,
        opacity: cs.opacity,
        size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
      });
    }
    return { theme, url, bodyBg, htmlBg, topResults: results.slice(0, 20) };
  });

  // Light
  await page.evaluate(() => { if (document.documentElement.getAttribute('data-theme') !== 'light') document.querySelector('.theme-toggle')?.click(); });
  await sleep(500);
  const l = sample();

  // Dark
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(500);
  const d = sample();

  console.log('\n=== LIGHT ===');
  console.log('theme:', l.theme, 'url:', l.url);
  console.log('bodyBg:', l.bodyBg, 'htmlBg:', l.htmlBg);
  l.topResults.forEach((r) => console.log(`  ${r.sel} bg=${r.bg} op=${r.opacity} ${r.size}`));

  console.log('\n=== DARK ===');
  console.log('theme:', d.theme, 'url:', d.url);
  console.log('bodyBg:', d.bodyBg, 'htmlBg:', d.htmlBg);
  d.topResults.forEach((r) => console.log(`  ${r.sel} bg=${r.bg} op=${r.opacity} ${r.size}`));

  await browser.close();
})();
