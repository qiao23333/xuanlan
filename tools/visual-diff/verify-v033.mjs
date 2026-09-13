import puppeteer from 'puppeteer-core';
import fs from 'fs';
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

  // Navigate to glossary page
  const glossaryBtn = await page.evaluate(() => {
    const btn = document.querySelector('[aria-label*="术语"], .nav-term, button');
    const all = [...document.querySelectorAll('button, [role="button"], a')];
    const term = all.find((el) => (el.textContent || '').includes('术语'));
    if (term) { term.click(); return true; }
    return false;
  });
  console.log('clicked glossary:', glossaryBtn);
  await sleep(1200);

  // Screenshot glossary cards in dark mode
  await page.evaluate(() => { if (document.documentElement.getAttribute('data-theme') !== 'dark') document.querySelector('.theme-toggle')?.click(); });
  await sleep(500);
  await page.screenshot({ path: '.tmp-gl-dark.png', fullPage: true });
  const darkTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

  // Switch to light mode and screenshot
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(500);
  await page.screenshot({ path: '.tmp-gl-light.png', fullPage: true });
  const lightTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

  // Also screenshot consent modal area (go back to landing, trigger consent)
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1000);
  // Clear consent to re-trigger modal
  await page.evaluate(() => localStorage.removeItem('xuanlan.consent.v1'));
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.screenshot({ path: '.tmp-consent.png' });

  console.log('dark=', darkTheme, 'light=', lightTheme);
  console.log('Screenshots saved: gl-dark, gl-light, consent');
  await browser.close();
})();
