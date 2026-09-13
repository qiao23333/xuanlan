import puppeteer from 'puppeteer-core';
import fs from 'fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'http://localhost:4173/';

const clickByText = (page, re) => page.evaluate((src) => {
  const r = new RegExp(src);
  const veil = document.querySelector('.modal-veil');
  const scope = veil || document;
  const b = [...scope.querySelectorAll('button')].find((x) => r.test((x.textContent || '').replace(/\s/g, '')));
  if (b) { b.click(); return (b.textContent || '').trim(); }
  return null;
}, re.source);

const audit = (page) => page.evaluate(() => {
  const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const parse = (s) => { const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const out = { theme: document.documentElement.getAttribute('data-theme'), stuckDark: [], stuckLight: [], lowContrast: [] };
  for (const el of document.querySelectorAll('*')) {
    if (!el.offsetParent) continue;
    const cs = getComputedStyle(el);
    const bg = parse(cs.backgroundColor);
    const rect = el.getBoundingClientRect();
    if (rect.width < 6 || rect.height < 6) continue;
    if (bg && bg[3] > 0.55) {
      const L = lum(bg[0], bg[1], bg[2]);
      if (L < 0.14) out.stuckDark.push({ cls: (el.className || '').toString().slice(0, 50), L: +L.toFixed(3), w: Math.round(rect.width), h: Math.round(rect.height), t: (el.textContent || '').trim().slice(0, 16) });
      else if (L > 0.9) out.stuckLight.push({ cls: (el.className || '').toString().slice(0, 50), L: +L.toFixed(3), w: Math.round(rect.width), h: Math.round(rect.height) });
    }
  }
  // 文本对比度（仅取自身有非透明背景的）
  for (const el of document.querySelectorAll('*')) {
    if (!el.offsetParent) continue;
    const cs = getComputedStyle(el);
    const txt = (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) ? el.textContent.trim() : '';
    if (!txt) continue;
    const fg = parse(cs.color); const bg = parse(cs.backgroundColor);
    if (!fg || !bg || bg[3] < 0.55) continue;
    const Lf = lum(fg[0], fg[1], fg[2]); const Lb = lum(bg[0], bg[1], bg[2]);
    const ratio = (Math.max(Lf, Lb) + 0.05) / (Math.min(Lf, Lb) + 0.05);
    if (ratio < 1.8) out.lowContrast.push({ cls: (el.className || '').toString().slice(0, 40), ratio: +ratio.toFixed(2), t: txt.slice(0, 16), Lf: +Lf.toFixed(2), Lb: +Lb.toFixed(2) });
  }
  out.stuckDark = out.stuckDark.slice(0, 25);
  out.stuckLight = out.stuckLight.slice(0, 25);
  out.lowContrast = out.lowContrast.slice(0, 25);
  return out;
});

const setTheme = (page, t) => page.evaluate((t) => {
  const cur = document.documentElement.getAttribute('data-theme');
  if (cur !== t) { const b = document.querySelector('.theme-toggle'); if (b) b.click(); }
}, t);

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1672, height: 941 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1500);
  const report = {};
  for (let i = 0; i < 12; i++) {
    const t = await clickByText(page, /(同意|接受|我知道了|我已了解|开始使用|下一步|下一页|开始体验|跳过|进入|确认|稍后再说|了解)/);
    if (!t) break;
    await sleep(600);
  }
  await sleep(400);

  // 首页（默认深色）
  await setTheme(page, 'dark'); await sleep(400);
  report.landing_dark = await audit(page);
  await setTheme(page, 'light'); await sleep(400);
  report.landing_light = await audit(page);
  await page.screenshot({ path: 'shots/audit-landing-light.png' });
  await setTheme(page, 'dark'); await sleep(400);

  // 进表单
  await page.evaluate(() => { const el = document.querySelector('.l2-enter-btn'); if (el) el.click(); });
  await sleep(1000);
  await setTheme(page, 'dark'); await sleep(300);
  report.form_dark = await audit(page);
  await setTheme(page, 'light'); await sleep(400);
  report.form_light = await audit(page);
  await page.screenshot({ path: 'shots/audit-form-light.png' });
  await setTheme(page, 'dark'); await sleep(400);

  // 提交到结果页
  await clickByText(page, /下一步/); await sleep(900);
  await clickByText(page, /开始推演|推演中/); await sleep(2500);
  await setTheme(page, 'dark'); await sleep(400);
  report.results_dark = await audit(page);
  await setTheme(page, 'light'); await sleep(400);
  report.results_light = await audit(page);
  await page.screenshot({ path: 'shots/audit-results-light.png' });
  await setTheme(page, 'dark'); await sleep(400);
  await page.screenshot({ path: 'shots/audit-results-dark.png' });

  fs.writeFileSync('.tmp-audit.json', JSON.stringify(report, null, 1));
  // 精简打印
  for (const [k, v] of Object.entries(report)) {
    console.log(`\n## ${k} (theme=${v.theme})`);
    console.log('  stuckDark:', v.stuckDark.length, v.stuckDark.slice(0, 6).map((x) => `${x.cls}:${x.L}`).join(', '));
    console.log('  stuckLight:', v.stuckLight.length, v.stuckLight.slice(0, 6).map((x) => x.cls).join(', '));
    console.log('  lowContrast:', v.lowContrast.length, v.lowContrast.slice(0, 8).map((x) => `${x.cls}(${x.ratio})`).join(', '));
  }
  await browser.close();
})();
