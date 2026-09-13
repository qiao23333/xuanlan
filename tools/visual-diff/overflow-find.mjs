/**
 * 揪出「谁把页面撑宽了」：列出所有 rect 越界元素（含被裁剪的），按越界距离排序。
 * 用 390 纯视口（isMobile=false），此时 innerWidth 就是 390，scrollWidth 超出即真实溢出。
 */
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:4173/';

const offenders = (page) =>
  page.evaluate(() => {
    const vw = window.innerWidth;
    const de = document.documentElement;
    const path = (el) => {
      const bits = [];
      let n = el;
      for (let i = 0; i < 3 && n && n.nodeType === 1; i++) {
        let s = n.tagName.toLowerCase();
        if (n.id) s += '#' + n.id;
        const c = (n.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
        if (c.length) s += '.' + c.join('.');
        bits.unshift(s);
        n = n.parentElement;
      }
      return bits.join('>');
    };
    const clipped = (el) => {
      let n = el.parentElement;
      while (n && n !== de) {
        const cs = getComputedStyle(n);
        if (cs.overflowX !== 'visible') return true;
        n = n.parentElement;
      }
      return false;
    };
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const over = Math.round(r.right) - vw;
      if (over > 1) out.push({ over, l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), clip: clipped(el), sel: path(el), bg: cs.overflowX });
    }
    return {
      vw,
      scrollWidth: de.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      top: out.sort((a, b) => b.over - a.over).slice(0, 12),
      count: out.length,
    };
  });

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => (/\/(sw\.js|manifest\.webmanifest)(\?|$)/.test(r.url()) ? r.abort() : r.continue()));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1800);
  await page.evaluate(() => {
    for (let i = 0; i < 8; i++) {
      const v = document.querySelector('.modal-veil');
      if (!v) break;
      const b = [...v.querySelectorAll('button')].find((x) => /(同意|接受|我已了解|开始|进入|确认|跳过|下一步|了解)/.test((x.textContent || '').replace(/\s/g, '')));
      if (b) b.click();
    }
  });
  await sleep(1800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
  const r = await offenders(page);
  console.log(`vw=${r.vw} scrollWidth=${r.scrollWidth} bodyScrollWidth=${r.bodyScrollWidth} 越界元素=${r.count}`);
  for (const o of r.top) console.log(`  超出${o.over}px  [${o.l}→${o.r}] w=${o.w} 被裁=${o.clip ? 'Y' : 'N'} ovfX=${o.bg}  ${o.sel}`);
  await browser.close();
})();
