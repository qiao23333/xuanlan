/** 找出指定视口下把页面撑宽的元凶元素 */
import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:4173/';
const W = Number(process.env.W || 768);
const H = Number(process.env.H || 1024);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on('request', (r) => (r.url().endsWith('sw.js') ? r.abort() : r.continue()));
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto(BASE, { waitUntil: 'networkidle2' });
await sleep(1800);

const res = await page.evaluate((vw) => {
  const docW = document.documentElement.clientWidth;
  const hits = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const right = r.right + window.scrollX;
    const over = Math.round(right - docW);
    if (over > 1) {
      hits.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute('class') || '').slice(0, 60),
        right: Math.round(right),
        width: Math.round(r.width),
        over,
      });
    }
  }
  hits.sort((a, b) => b.over - a.over);
  return { docW, scrollW: document.documentElement.scrollWidth, top: hits.slice(0, 12) };
}, W);

console.log(`视口 ${W}x${H}  clientWidth=${res.docW}  scrollWidth=${res.scrollW}  溢出=${res.scrollW - res.docW}px`);
console.log('越界元素（按超出量排序）：');
for (const h of res.top) console.log(`  over=${String(h.over).padStart(4)}px  right=${String(h.right).padStart(5)}  w=${String(h.width).padStart(5)}  <${h.tag} class="${h.cls}">`);
await browser.close();
