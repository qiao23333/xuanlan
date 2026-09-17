/**
 * CSS「改前/改后」定点截图（用于证明某次 CSS 清理没有改变渲染结果）
 *
 * 为什么需要它：删「死规则」是唯一一类**改了代码但视觉必须完全不变**的改动。
 * 只跑「有没有横向溢出 / 字号够不够大」的审计是证明不了这一点的 —— 那些指标
 * 对背景遮罩强度、渐变层次这一类变化完全不敏感（遮罩加深 10% 照样全绿）。
 * 所以这里不比指标，比**像素**：同页面同视口同主题，改前改后逐像素作差。
 *
 * 用法：
 *   BASE=http://localhost:4173/xuanlan/ DIR=.tmp-ab/before node tools/visual-diff/ab-shot.mjs
 *   BASE=http://localhost:4173/xuanlan/ DIR=.tmp-ab/after  node tools/visual-diff/ab-shot.mjs
 *   python tools/visual-diff/ab-diff.py .tmp-ab/before .tmp-ab/after
 */
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = process.env.BASE || 'http://localhost:4173/';
const DIR = process.env.DIR || '.tmp-ab/shot';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
fs.mkdirSync(DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});

/** 关掉首访同意弹层 + 新手引导（同一个 .modal-veil，会连着弹） */
async function dismissVeils(page) {
  for (let i = 0; i < 8; i++) {
    const has = await page.evaluate(() => !!document.querySelector('.modal-veil'));
    if (!has) break;
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.modal-veil button, .modal-veil .btn-gold')];
      const hit = btns.find((b) => /我已了解|同意|接受|跳过|开始体验|完成|我知道了/.test(b.textContent || ''))
        || btns[btns.length - 1];
      if (hit) hit.click();
    });
    await sleep(700);
  }
}

const setTheme = async (page, t) => {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
};

/**
 * 背景是 `background-attachment: fixed` 的大图，主题一换要重新下另一张 WebP。
 * 只 sleep 固定毫秒会在冷启动那次截到「图还没到、只剩渐变」的半成品，
 * 于是"改前/改后"差出整片背景 —— 看着像我把背景改坏了，其实是网速。
 * 所以显式等两张图 decode 完成。
 *
 * ⚠️ **还要等字体**。这轮把 Google Fonts 改成非阻塞加载之后，页面会先在系统字体下
 * 渲染、字体到了再 swap。不等 `document.fonts.ready` 就截图，拍到的可能是**换字前的样子**，
 * 于是"改前 vs 改后"差出一整套字形 —— 那不是渲染回归，是**加载时序**差异。
 * 凡是"资源到达时刻变了"的改动，验收前都必须把资源等齐，否则比的是时间不是结果。
 */
async function waitBg(page) {
  // 先确认字体样式表**已经被应用**（非阻塞加载靠 onload 把 media 从 print 换成 all），
  // 再等 fonts.ready —— 顺序反了的话 fonts.ready 会在样式表生效前就提前 resolve。
  await page
    .waitForFunction(() => {
      const l = document.querySelector('link[href*="fonts.googleapis.com"][rel="stylesheet"]');
      return !l || l.media === 'all';
    }, { timeout: 20000 })
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.evaluate(() => Promise.all(
    [...document.getElementsByTagName('img')].map((i) => i.decode?.().catch(() => {}) ?? Promise.resolve()),
  ));
  await page.evaluate(() => new Promise((r) => {
    const probe = () => {
      const cs = getComputedStyle(document.body).backgroundImage
        + getComputedStyle(document.documentElement).getPropertyValue('--app-bg-dark')
        + getComputedStyle(document.documentElement).getPropertyValue('--app-bg-light');
      const urls = [...cs.matchAll(/url\("?([^")]+)"?\)/g)].map((m) => m[1]);
      if (!urls.length) return r();
      let left = urls.length;
      urls.forEach((u) => {
        const im = new Image();
        const done = () => { if (--left === 0) r(); };
        im.onload = done;
        im.onerror = done;
        im.src = u;
      });
      setTimeout(r, 4000);
    };
    probe();
  }));
  await sleep(300);
}

/**
 * 收尾：把「动的东西」按下去，否则像素比对比的是动画进度，不是 CSS。
 *
 * 这个坑很隐蔽：首页有一个**持续旋转的太极轮** + 云雾漂移 + 飞鸟，
 * 结果页还有 reveal-on-scroll。同一份代码连拍两次，差异也有 0.5% 像素 /
 * 平均差 0.6/255 —— 而真实的 CSS 清理（删死规则）理论差值是 **0**。
 * 也就是说：不冻结动画的话，"有没有视觉变化"这个问题永远答"有"，
 * 门禁变成噪音源，比没有门禁更糟（它还会吓你）。
 *
 * 双保险：emulateMediaFeatures 走站点自带的 prefers-reduced-motion 分支，
 * 再补一条全局 animation/transition 归零（覆盖站点没写到的元素）。
 */
const freeze = async (page) => {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
      scroll-behavior: auto !important;
    }`,
  });
  await sleep(300);
};

const shootAt = async (label, viewport, jobs) => {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport(viewport);
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await freeze(page);
  await sleep(1500);
  await dismissVeils(page);
  await freeze(page);
  await waitBg(page);
  await jobs(page, label);
  await page.close();
};

// —— 首页 ——
await shootAt('landing', { width: 1440, height: 900, deviceScaleFactor: 1 }, async (page, label) => {
  for (const t of ['light', 'dark']) {
    await setTheme(page, t);
    await waitBg(page);
    await page.screenshot({ path: `${DIR}/landing-${t}-1440.png` });
  }
});

// —— 表单页（侧卡只在 >860px 出现，故必须桌面宽度） ——
const toForm = async (page) => {
  await page.evaluate(() => document.querySelector('.l2-enter-btn')?.click());
  await sleep(1800);
  await dismissVeils(page);
};

await shootAt('form-1440', { width: 1440, height: 900, deviceScaleFactor: 1 }, async (page, label) => {
  await toForm(page);
  for (const t of ['light', 'dark']) {
    await setTheme(page, t);
    await waitBg(page);
    await page.screenshot({ path: `${DIR}/form-${t}-1440.png` });
  }
});

// —— 表单页 手机宽度（侧卡被 display:none 隐藏，验证的是 .f2-bg 那条） ——
await shootAt('form-390', { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, async (page) => {
  await toForm(page);
  for (const t of ['light', 'dark']) {
    await setTheme(page, t);
    await waitBg(page);
    await page.screenshot({ path: `${DIR}/form-${t}-390.png` });
  }
});

console.log(`shots -> ${DIR}`);
await browser.close();
