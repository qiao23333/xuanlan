import puppeteer from 'puppeteer-core';
import fs from 'fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'http://localhost:4173/';

const clickByText = async (page, re) => {
  return page.evaluate((src) => {
    const r = new RegExp(src);
    const veil = document.querySelector('.modal-veil');
    const scope = veil || document;
    const btns = [...scope.querySelectorAll('button, a.btn, .l2-enter-btn')];
    const b = btns.find((x) => r.test((x.textContent || '').replace(/\s/g, '')));
    if (b) { b.click(); return (b.textContent || '').trim(); }
    return null;
  }, re.source);
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('PAGEERR ' + String(e).slice(0, 160)));

  await page.setViewport({ width: 1672, height: 941, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(1500);

  fs.mkdirSync('shots', { recursive: true });

  // 1) 关闭首访同意弹层
  let log = [];
  for (let i = 0; i < 14; i++) {
    const t = await clickByText(page, /^(同意|接受|我知道了|我已了解|开始使用|下一步|下一页|开始体验|跳过|进入|确认|稍后再说)$/);
    if (t) { log.push('click:' + t); await sleep(600); continue; }
    const veil = await page.evaluate(() => !!document.querySelector('.modal-veil'));
    if (!veil) break;
    // 强制兜底：点 veil 内最后一个按钮
    const fb = await page.evaluate(() => {
      const v = document.querySelector('.modal-veil');
      const b = v && [...v.querySelectorAll('button')].pop();
      if (b) { b.click(); return true; }
      return false;
    });
    if (!fb) break;
    log.push('fallback-click'); await sleep(600);
  }

  // 2) 进表单（用确定选择器点真正的 CTA；导航里另有同名按钮）
  await page.evaluate(() => { const el = document.querySelector('.l2-enter-btn'); if (el) el.click(); });
  await sleep(1200);

  // 3) 表单两步：下一步 → 开始推演
  const s1 = await clickByText(page, /下一步/);
  log.push('step1:' + (s1 || 'none'));
  await sleep(1000);
  const s2 = await clickByText(page, /开始推演|推演中/);
  log.push('step2:' + (s2 || 'none'));

  // 4) 等结果页
  let reached = false;
  try {
    await page.waitForSelector('.result-summary', { timeout: 20000 });
    reached = true;
  } catch (e) { reached = false; }
  log.push('reached-results:' + reached);
  await sleep(1500);

  // 5) 截图（当前=深色）
  await page.screenshot({ path: 'shots/res-dark.png' });

  // 6) 诊断：深色下整体亮度 + 主导背景
  const diagDark = await page.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    return { theme: document.documentElement.getAttribute('data-theme'), bodyBg: bg };
  });

  // 7) 切浅色
  await page.evaluate(() => {
    const t = document.querySelector('.theme-toggle');
    if (t) t.click();
  });
  await sleep(900);
  await page.screenshot({ path: 'shots/res-light.png' });

  // 8) 浅色诊断 + 揪出仍发黑的元素
  const diagLight = await page.evaluate(() => {
    const out = { theme: document.documentElement.getAttribute('data-theme'), stuck: [] };
    for (const el of document.querySelectorAll('*')) {
      if (!el.offsetParent) continue;
      const cs = getComputedStyle(el);
      const m = cs.backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (!m) continue;
      const r = +m[1], g = +m[2], b = +m[3], a = m[4] === undefined ? 1 : +m[4];
      if (a < 0.55) continue;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (lum < 0.13) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 6 || rect.height < 6) continue;
        out.stuck.push({
          tag: el.tagName,
          cls: (el.className && el.className.toString().slice(0, 70)) || '',
          lum: +lum.toFixed(3),
          w: Math.round(rect.width), h: Math.round(rect.height),
          txt: (el.textContent || '').trim().slice(0, 24),
        });
      }
    }
    out.stuck = out.stuck.slice(0, 50);
    return out;
  });

  const result = { log, diagDark, diagLight, errors: errors.slice(0, 20) };
  fs.writeFileSync('.tmp-restheme.json', JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
})();
