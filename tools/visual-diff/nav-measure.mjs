import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setRequestInterception(true);
p.on('request', (r) => (r.url().endsWith('sw.js') ? r.abort() : r.continue()));
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE, { waitUntil: 'networkidle2' });
await sleep(1800);
for (let i = 0; i < 8; i++) { const c = await p.evaluate(() => { const v = document.querySelector('.modal-veil'); if (!v) return false; const x = [...v.querySelectorAll('button')].find((y) => y.offsetParent !== null); if (x) { x.click(); return true; } return false; }); if (!c) break; await sleep(700); }
for (const label of ['landing', 'form']) {
  if (label === 'form') { await p.evaluate(() => document.querySelector('.l2-enter-btn')?.click()); await sleep(1600); }
  const m = await p.evaluate(() => {
    const nav = document.querySelector('.nav');
    const kids = [...nav.children].map((el) => ({ cls: el.className, w: Math.round(el.getBoundingClientRect().width), vis: getComputedStyle(el).display !== 'none' }));
    return { navW: Math.round(nav.getBoundingClientRect().width), scrollW: nav.scrollWidth, clientW: nav.clientWidth, kids };
  });
  console.log(`--- ${label} --- navW=${m.navW} scrollW=${m.scrollW} clientW=${m.clientW} 需要横滑=${m.scrollW > m.clientW + 1}`);
  let sum = 0;
  for (const k of m.kids) { console.log(`   ${k.vis ? '+' : '-'} w=${String(k.w).padStart(4)}  ${k.cls}`); if (k.vis) sum += k.w; }
  console.log(`   可见子元素合计=${sum}px  (还有 gap 与 padding 12*2=24)`);
}
await b.close();
