/**
 * 视口/溢出聚焦诊断：确认 390 宽下到底是「真横向溢出」还是 Chrome 移动模拟
 * 的 shrink-to-fit（把整页缩放，用户看到的是「字变小」而非「能左右滑」）。
 */
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:4173/';

const metrics = (page) =>
  page.evaluate(() => {
    const de = document.documentElement;
    const nav = document.querySelector('.nav');
    const widest = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        let n = el.parentElement;
        while (n && n !== de) {
          if (getComputedStyle(n).overflowX !== 'visible') return false;
          n = n.parentElement;
        }
        return true;
      })
      .map((el) => ({ w: Math.round(el.getBoundingClientRect().width), cls: (el.getAttribute('class') || '').slice(0, 40) }))
      .sort((a, b) => b.w - a.w)
      .slice(0, 5);
    return {
      innerWidth: window.innerWidth,
      clientWidth: de.clientWidth,
      scrollWidth: de.scrollWidth,
      visualWidth: window.visualViewport ? Math.round(window.visualViewport.width) : null,
      scale: window.visualViewport ? +window.visualViewport.scale.toFixed(3) : null,
      dpr: window.devicePixelRatio,
      scrollY: Math.round(window.scrollY),
      navClient: nav ? nav.clientWidth : null,
      navScroll: nav ? nav.scrollWidth : null,
      widest,
    };
  });

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => (/\/(sw\.js|manifest\.webmanifest)(\?|$)/.test(r.url()) ? r.abort() : r.continue()));

  for (const isMobile of [true, false]) {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile, hasTouch: isMobile });
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
    await sleep(1600);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    console.log(`\n--- isMobile=${isMobile} ---`);
    console.log(JSON.stringify(await metrics(page), null, 1));
  }
  await browser.close();
})();
