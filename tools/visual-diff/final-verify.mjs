// 终验脚本：确认三件事都修好了
//   ① 深浅主题确实换不同的背景图（不是同一张）
//   ② 结果页太极已按约定镜像（鱼眼方位）
//   ③ 手机端无横向溢出（多视口）
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getTheme = (page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const setTheme = async (page, want) => {
  const cur = await getTheme(page);
  if (cur !== want) {
    await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
    await sleep(500);
  } else {
    await sleep(200);
  }
  return getTheme(page);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
});

const outDir = '.tmp-final';
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// ---------- ① 深浅背景图 ----------
{
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.url().endsWith('sw.js') || r.url().includes('serviceWorker') ? r.abort() : r.continue()));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1200);

  const read = () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        bgImage: (cs.backgroundImage.match(/url\("([^"]+)"\)/) || [null, 'none'])[1].split('/').pop(),
        bgColor: cs.backgroundColor,
      };
    });

  const rows = [];
  for (const t of ['dark', 'light']) {
    await setTheme(page, t);
    rows.push(await read());
    await page.screenshot({ path: path.join(outDir, `desktop-${t}.png`) });
  }
  console.log('=== ① 深浅背景图 ===');
  for (const r of rows) console.log(`  ${r.theme.padEnd(6)} 背景图=${r.bgImage}  底色=${r.bgColor}`);
  console.log(
    rows[0].bgImage !== rows[1].bgImage
      ? '  ✅ 深浅主题用的是不同背景图（修复生效）'
      : '  ❌ 深浅主题背景图仍相同（未修复）'
  );
  await page.close();
}

// ---------- ② 结果页太极 ----------
{
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.url().endsWith('sw.js') ? r.abort() : r.continue()));
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1500);

  // 先关掉「使用前须知」弹层（首访强制，会挡住后续点击）
  for (let i = 0; i < 8; i++) {
    const c = await page.evaluate(() => {
      const v = document.querySelector('.modal-veil');
      if (!v) return false;
      const b = [...v.querySelectorAll('button')].find((x) => x.offsetParent !== null);
      if (b) { b.click(); return true; }
      return false;
    });
    if (!c) break;
    await sleep(700);
  }

  // 进表单 → 两步提交 → 结果页
  // 注意：桌面端表单页顶部有 .f2-nav-link「探索/推演/认识自己」，
  // 用文本正则匹配「推演」会命中这个锚点而非提交按钮 → 必须用类名精确点击。
  console.log('  进入表单 ->', await page.evaluate(() => (document.querySelector('.l2-enter-btn')?.click(), 'l2-enter-btn')));
  await sleep(1800);
  console.log('  下一步 ->', await page.evaluate(() => { const b = document.querySelector('.f2-submit'); if (b) { b.click(); return (b.textContent || '').replace(/\s+/g, ' ').trim(); } return null; }));
  await sleep(1800);
  console.log('  提交   ->', await page.evaluate(() => { const b = document.querySelector('.f2-submit-primary'); if (b) { b.click(); return (b.textContent || '').replace(/\s+/g, ' ').trim(); } return null; }));
  await sleep(11000);

  const info = await page.evaluate(() => {
    const wrap = document.querySelector('.rs-taiji-wrap');
    if (!wrap) return { found: false };
    const vis = (sel) => {
      const el = wrap.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { display: cs.display, src: (el.getAttribute('src') || '').split('/').pop() };
    };
    return { theme: document.documentElement.getAttribute('data-theme'), darkImg: vis('.ic-dark'), lightImg: vis('.ic-light') };
  });
  console.log('\n=== ② 结果页太极（是否按主题换图）===');
  console.log('  ' + JSON.stringify(info));
  if (info.found === false) {
    console.log('  ⚠ 未定位到 .rs-taiji-wrap（未进到结果页）');
  } else {
    const clipOf = () =>
      page.evaluate(() => {
        const el = document.querySelector('.rs-taiji-wrap');
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) };
      });
    for (const t of ['dark', 'light']) {
      await setTheme(page, t);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(900);
      const c = await clipOf();
      if (c.width > 0 && c.height > 0) {
        await page.screenshot({ path: path.join(outDir, `taiji-${t}.png`), clip: c });
        console.log(`  ${t.padEnd(6)} 截图 ${c.width}x${c.height}`);
      } else {
        await page.screenshot({ path: path.join(outDir, `taiji-${t}.png`) });
      }
    }
    const cur = await setTheme(page, 'dark');
    const shown = cur === 'light' ? info.lightImg : info.darkImg;
    console.log(`  当前主题=${cur} 显示的图=${shown?.src}`);
  }
  await page.close();
}

// ---------- ③ 多视口横向溢出 ----------
{
  console.log('\n=== ③ 横向溢出复检 ===');
  const VIEWS = [
    ['small  360x780', 360, 780],
    ['phone  390x844', 390, 844],
    ['tablet 768x1024', 768, 1024],
    ['desktop 1440x900', 1440, 900],
  ];
  for (const [label, w, h] of VIEWS) {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().endsWith('sw.js') ? r.abort() : r.continue()));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768 });
    if (w < 768) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await sleep(1400);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const ok = m.sw <= m.cw;
    console.log(`  ${label.padEnd(18)} scrollWidth=${m.sw} clientWidth=${m.cw}  ${ok ? '✅ 无横向溢出' : '❌ 溢出 ' + (m.sw - m.cw) + 'px'}`);
    await page.screenshot({ path: path.join(outDir, `view-${w}-landing.png`) });
    await page.close();
  }
}

await browser.close();
console.log('\n截图目录：' + outDir);
