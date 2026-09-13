import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'http://localhost:4173/';

const clickByText = (page, re) => page.evaluate((src) => {
  const r = new RegExp(src);
  const veil = document.querySelector('.modal-veil');
  const scope = veil || document;
  const b = [...scope.querySelectorAll('button')].find((x) => r.test((x.textContent || '').replace(/\s/g, '')));
  if (b) { b.click(); return true; }
  return false;
}, re.source);

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1672, height: 941 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1500);
  for (let i = 0; i < 12; i++) { if (!await clickByText(page, /(同意|接受|我已了解|开始使用|下一步|下一页|开始体验|跳过|进入|确认|稍后再说|了解)/)) break; await sleep(600); }

  // Go to glossary
  await page.evaluate(() => {
    const all = [...document.querySelectorAll('button, [role="button"], a, [tabindex]')];
    const term = all.find((el) => (el.textContent || '').includes('术语'));
    if (term) term.click();
  });
  await sleep(1200);

  // Sample key elements' backgrounds in BOTH themes
  const sample = (label) => page.evaluate((label) => {
    const theme = document.documentElement.getAttribute('data-theme');
    const targets = ['.gl-page', '.gl-hero', '.gl-syscards', '.gl-syscard', '.gl-side', '.gl-main',
      '.gl-term-card', 'body', 'header', 'main', '[class*="app"]', '[class*="container"]',
      '.modal-veil', '.consent-modal'];
    const result = { label, theme };
    for (const sel of targets) {
      const el = document.querySelector(sel);
      if (!el) { result[sel] = null; continue; }
      const cs = getComputedStyle(el);
      result[sel] = {
        bg: cs.backgroundColor,
        bgImage: cs.backgroundImage.slice(0, 80),
        opacity: cs.opacity,
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
      };
    }
    // Also sample first syscard specifically
    const card = document.querySelector('.gl-syscard');
    if (card) {
      const ccs = getComputedStyle(card);
      result._firstCard = {
        bg: ccs.backgroundColor,
        border: ccs.borderColor,
        boxShadow: ccs.boxShadow?.slice(0, 60),
      };
    }
    return result;
  }, label);

  // Light mode
  await page.evaluate(() => { if (document.documentElement.getAttribute('data-theme') !== 'light') document.querySelector('.theme-toggle')?.click(); });
  await sleep(500);
  const light = sample('glossary-light');

  // Dark mode
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(500);
  const dark = sample('glossary-dark');

  console.log('=== LIGHT MODE ===');
  for (const [k, v] of Object.entries(light)) if (v && typeof v === 'object') console.log(`  ${k}:`, JSON.stringify(v).slice(0, 120));

  console.log('\n=== DARK MODE ===');
  for (const [k, v] of Object.entries(dark)) if (v && typeof v === 'object') console.log(`  ${k}:`, JSON.stringify(v).slice(0, 120));

  console.log('\n=== DIFF (elements where light bg === dark bg) ===');
  for (const key of Object.keys(light)) {
    if (key === 'label' || key === 'theme') continue;
    const l = light[key], d = dark[key];
    if (!l || !d || typeof l !== 'object') continue;
    if (l.bg === d.bg) console.log(`  SAME bg: ${key} → ${l.bg}`);
  }

  await browser.close();
})();
