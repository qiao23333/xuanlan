import puppeteer from 'puppeteer-core';
import fs from 'fs';
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

/** Audit: find stuck-dark bg (lum<0.14 in light mode), stuck-light (lum>0.9 in dark mode), low contrast */
const audit = (page, label) => page.evaluate((label) => {
  const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const parse = (s) => { const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const theme = document.documentElement.getAttribute('data-theme');
  const out = { label, theme, stuckDark: [], stuckLight: [], lowContrast: [] };
  for (const el of document.querySelectorAll('*')) {
    if (!el.offsetParent) continue;
    const cs = getComputedStyle(el);
    const bg = parse(cs.backgroundColor);
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    if (bg && bg[3] > 0.5) {
      const L = lum(bg[0], bg[1], bg[2]);
      // In light mode, dark bg is wrong; in dark mode, bright bg is wrong
      if (theme === 'light' && L < 0.16) out.stuckDark.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), id: el.id || '', L: +L.toFixed(3), rgb: `${bg[0]},${bg[1]},${bg[2]}`, w: Math.round(rect.width), h: Math.round(rect.height), t: (el.textContent || '').trim().slice(0, 20) });
      else if (theme === 'dark' && L > 0.88) out.stuckLight.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), L: +L.toFixed(3), w: Math.round(rect.width), h: Math.round(rect.height) });
    }
  }
  // Text contrast check
  for (const el of document.querySelectorAll('*')) {
    if (!el.offsetParent) continue;
    const cs = getComputedStyle(el);
    const txt = (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) ? el.textContent.trim() : '';
    if (!txt || txt.length < 2) continue;
    const fg = parse(cs.color); const bg = parse(cs.backgroundColor);
    if (!fg || !bg || bg[3] < 0.5) continue;
    const Lf = lum(fg[0], fg[1], fg[2]); const Lb = lum(bg[0], bg[1], bg[2]);
    const ratio = (Math.max(Lf, Lb) + 0.05) / (Math.min(Lf, Lb) + 0.05);
    if (ratio < 1.8) out.lowContrast.push({ cls: (el.className || '').toString().slice(0, 50), ratio: +ratio.toFixed(2), t: txt.slice(0, 20) });
  }
  out.stuckDark = out.stuckDark.slice(0, 30);
  out.stuckLight = out.stuckLight.slice(0, 15);
  out.lowContrast = out.lowContrast.slice(0, 20);
  return out;
}, label);

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1672, height: 941 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1500);
  for (let i = 0; i < 12; i++) { if (!await clickByText(page, /(同意|接受|我已了解|开始使用|下一步|下一页|开始体验|跳过|进入|确认|稍后再说|了解)/)) break; await sleep(600); }

  // Navigate to glossary page
  await page.evaluate(() => {
    const all = [...document.querySelectorAll('button, [role="button"], a, [tabindex]')];
    const term = all.find((el) => (el.textContent || '').includes('术语'));
    if (term) term.click();
  });
  await sleep(1200);

  // Audit glossary in LIGHT mode (primary concern)
  await page.evaluate(() => { if (document.documentElement.getAttribute('data-theme') !== 'light') document.querySelector('.theme-toggle')?.click(); });
  await sleep(500);
  const glLight = await audit(page, 'glossary-light');
  await page.screenshot({ path: '.tmp-gl-audit-light.png', fullPage: true });

  // Audit glossary in DARK mode
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(500);
  const glDark = await audit(page, 'glossary-dark');
  await page.screenshot({ path: '.tmp-gl-audit-dark.png', fullPage: true });

  // Also audit RESULT page in both themes (navigate back, go through form flow)
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1000);
  for (let i = 0; i < 12; i++) { if (!await clickByText(page, /(同意|接受|我已了解|开始使用|下一步|下一页|开始体验|跳过|进入|确认|稍后再说|了解)/)) break; await sleep(600); }
  await page.evaluate(() => { const el = document.querySelector('.l2-enter-btn'); if (el) el.click(); });
  await sleep(1000);
  await clickByText(page, /下一步/); await sleep(900);
  await clickByText(page, /开始推演|推演中/); await sleep(2500);

  await page.evaluate(() => { if (document.documentElement.getAttribute('data-theme') !== 'light') document.querySelector('.theme-toggle')?.click(); });
  await sleep(500);
  const resLight = await audit(page, 'results-light');

  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(500);
  const resDark = await audit(page, 'results-dark');

  const report = { glLight, glDark, resLight, resDark };
  fs.writeFileSync('.tmp-audit-v033.json', JSON.stringify(report, null, 1));

  console.log('=== GLOSSARY LIGHT MODE (main concern) ===');
  console.log('stuckDark (dark bg in light mode):', glLight.stuckDark.length);
  glLight.stuckDark.forEach((x) => console.log(`  ${x.tag}.${x.cls} L=${x.L} rgb=(${x.rgb}) ${x.w}x${x.h} "${x.t}"`));
  console.log('lowContrast:', glLight.lowContrast.length);
  glLight.lowContrast.forEach((x) => console.log(`  ${x.cls} ratio=${x.ratio} "${x.t}"`));

  console.log('\n=== GLOSSARY DARK MODE ===');
  console.log('stuckLight (light bg in dark mode):', glDark.stuckLight.length);
  glDark.stuckLight.forEach((x) => console.log(`  ${x.tag}.${x.cls} L=${x.L}`));

  console.log('\n=== RESULTS LIGHT MODE ===');
  console.log('stuckDark:', resLight.stuckDark.length);
  resLight.stuckDark.forEach((x) => console.log(`  ${x.tag}.${x.cls} L=${x.L} rgb=(${x.rgb})`));
  console.log('lowContrast:', resLight.lowContrast.length);

  console.log('\n=== RESULTS DARK MODE ===');
  console.log('stuckLight:', resDark.stuckLight.length);

  await browser.close();
})();
