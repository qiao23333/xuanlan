import puppeteer from 'puppeteer-core';
import fs from 'fs';
import cp from 'child_process';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'http://localhost:4173/';
const clickByText = (page, re) => page.evaluate((src) => {
  const r = new RegExp(src);
  const v = document.querySelector('.modal-veil');
  const s = v || document;
  const b = [...s.querySelectorAll('button')].find((x) => r.test((x.textContent || '').replace(/\s/g, '')));
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
  await page.evaluate(() => { const e = document.querySelector('.l2-enter-btn'); if (e) e.click(); });
  await sleep(1000);
  await clickByText(page, /下一步/); await sleep(900);
  await clickByText(page, /开始推演|推演中/); await sleep(2500);

  const sample = async (tag) => {
    const rect = await page.evaluate(() => {
      const el = document.querySelector('.rs-taiji-wrap');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (!rect) { console.log('WARN: .rs-taiji-wrap not found, falling back to full-page shot'); const buf = await page.screenshot(); fs.writeFileSync(`.tmp-wheel-${tag}.png`, buf); return { full: true }; }
    const buf = await page.screenshot({ clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } });
    fs.writeFileSync(`.tmp-wheel-${tag}.png`, buf);
    return rect;
  };

  await page.evaluate(() => { if (document.documentElement.getAttribute('data-theme') !== 'dark') document.querySelector('.theme-toggle')?.click(); });
  await sleep(400);
  const r1 = await sample('1');
  const t1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const vis1 = await page.evaluate(() => {
    const d = document.querySelector('.rs-taiji-wrap .ic-dark');
    const l = document.querySelector('.rs-taiji-wrap .ic-light');
    const cs = (e) => e ? getComputedStyle(e).display : 'MISSING';
    return { icDark: cs(d), icLight: cs(l) };
  });
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(400);
  const r2 = await sample('2');
  const t2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const vis2 = await page.evaluate(() => {
    const d = document.querySelector('.rs-taiji-wrap .ic-dark');
    const l = document.querySelector('.rs-taiji-wrap .ic-light');
    const cs = (e) => e ? getComputedStyle(e).display : 'MISSING';
    return { icDark: cs(d), icLight: cs(l) };
  });

  const PY = 'C:\\Users\\11623\\.workbuddy\\binaries\\python\\envs\\default\\Scripts\\python.exe';
  const meanOf = (f) => cp.execSync(`"${PY}" -c "from PIL import Image;a=list(Image.open('${f}').convert('RGB').getdata());n=len(a);print(round(sum(p[0] for p in a)/n),round(sum(p[1] for p in a)/n),round(sum(p[2] for p in a)/n))"`).toString().trim();
  console.log('theme1=', t1, 'rect=', r1, 'visible=', JSON.stringify(vis1));
  console.log('theme2=', t2, 'rect=', r2, 'visible=', JSON.stringify(vis2));
  console.log('mean-dark=', meanOf('.tmp-wheel-1.png'), 'mean-light=', meanOf('.tmp-wheel-2.png'));
  await browser.close();
})();
