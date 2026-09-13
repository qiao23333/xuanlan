/**
 * 移动端响应式实拍审计（全流程版）
 *  入口 → 表单① → 表单② → 结果页 → 浅色结果页 → 术语百科
 * 测量用纯视口（innerWidth 就是设定值），避免 Chrome 移动模拟的 shrink-to-fit
 * 把「真横向溢出」伪装成「整页缩小」而漏报。
 *
 * 用法：BASE=http://localhost:4173/ [DEVICE=phone] node tools/visual-diff/mobile-audit.mjs
 */
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = process.env.BASE || 'http://localhost:4173/';
const OUT = '.tmp-mobile';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEVICES = {
  phone: { width: 390, height: 844, deviceScaleFactor: 2 },
  small: { width: 360, height: 780, deviceScaleFactor: 2 },
  tablet: { width: 834, height: 1112, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};
fs.mkdirSync(OUT, { recursive: true });

const probe = (page) =>
  page.evaluate(() => {
    const vw = window.innerWidth;
    const de = document.documentElement;
    const vis = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
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
    const clipper = (el) => {
      let n = el.parentElement;
      while (n && n !== de) {
        if (getComputedStyle(n).overflowX !== 'visible') return true;
        n = n.parentElement;
      }
      return false;
    };
    const over = [], smallText = [], smallTap = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!vis(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') continue; // 固定层单独看
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        const k = path(el);
        if (!seen.has(k)) {
          seen.add(k);
          over.push({ sel: k, over: Math.round(r.right - vw), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), clip: clipper(el) });
        }
      }
      const txt = (el.textContent || '').trim();
      if (el.children.length === 0 && txt && parseFloat(cs.fontSize) < 12) smallText.push({ sel: path(el), fs: +parseFloat(cs.fontSize).toFixed(1), text: txt.slice(0, 20) });
      if (el.matches('button, a, [role="button"], input, select') && r.height < 40) smallTap.push({ sel: path(el), h: Math.round(r.height), w: Math.round(r.width), text: (txt || el.getAttribute('aria-label') || '').slice(0, 16) });
    }
    const fixed = [...document.querySelectorAll('body *')]
      .filter((el) => vis(el) && ['fixed', 'sticky'].includes(getComputedStyle(el).position))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { sel: path(el), pos: getComputedStyle(el).position, top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), bg: getComputedStyle(el).backgroundColor };
      });
    return {
      vw,
      hScroll: de.scrollWidth > vw + 1,
      docScrollW: de.scrollWidth,
      dirty: over.filter((o) => !o.clip).sort((a, b) => b.over - a.over).slice(0, 8),
      clipped: over.filter((o) => o.clip).sort((a, b) => b.over - a.over).slice(0, 5),
      smallText: smallText.slice(0, 8),
      smallTap: smallTap.slice(0, 8),
      fixed: fixed.slice(0, 6),
    };
  });

function report(label, p) {
  console.log(`\n===== ${label} ===== vw=${p.vw} scrollWidth=${p.docScrollW} ${p.hScroll ? '❌ 横向溢出' : '✅ 无横向溢出'}`);
  if (p.dirty.length) {
    console.log(`  ❌ 真溢出（无祖先裁剪）${p.dirty.length} 处：`);
    p.dirty.forEach((o) => console.log(`     +${o.over}px [${o.l}→${o.r}] w=${o.w}  ${o.sel}`));
  }
  if (p.clipped.length) {
    console.log(`  ⚠️ 被裁剪的溢出 ${p.clipped.length} 处（贴着边被切，视觉断裂）：`);
    p.clipped.forEach((o) => console.log(`     +${o.over}px [${o.l}→${o.r}] w=${o.w}  ${o.sel}`));
  }
  if (p.fixed.length) {
    console.log('  📌 固定/吸附层（top<0 代表被推出视口上方）：');
    p.fixed.forEach((f) => console.log(`     ${f.pos} top=${f.top} h=${f.h} w=${f.w}  ${f.sel}`));
  }
  if (p.smallText.length) {
    console.log('  ⚠️ <12px 文字：');
    p.smallText.forEach((s) => console.log(`     ${s.fs}px "${s.text}"  ${s.sel}`));
  }
  if (p.smallTap.length) {
    console.log('  ⚠️ 触控区高<40px：');
    p.smallTap.forEach((s) => console.log(`     h=${s.h} w=${s.w} "${s.text}"  ${s.sel}`));
  }
}

const clickRe = (page, src) =>
  page.evaluate((s) => {
    const r = new RegExp(s);
    const b = [...document.querySelectorAll('button, [role="button"]')].find(
      (el) => r.test((el.textContent || '').replace(/\s/g, '')) && el.getBoundingClientRect().width > 0
    );
    if (b) { b.click(); return (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22); }
    return null;
  }, src);

const shoot = async (page, name, scroll) => {
  if (scroll !== undefined) {
    await page.evaluate((y) => window.scrollTo(0, y), scroll);
    await sleep(500);
  }
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

(async () => {
  const dev = process.env.DEVICE || 'phone';
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => (/\/(sw\.js|manifest\.webmanifest)(\?|$)/.test(r.url()) ? r.abort() : r.continue()));
  await page.setViewport(DEVICES[dev]);
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1800);
  for (let i = 0; i < 10; i++) {
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
  await sleep(800);

  // ① 入口
  await shoot(page, `${dev}-01-landing`, 0);
  report(`${dev} ① 入口页`, await probe(page));

  // ② 表单①  —— 必须点 Landing 内的 CTA：全局导航里那个 .nav-cta 在 landing 视图下是空操作
  console.log('\n进入表单 ->', await page.evaluate(() => {
    const b = document.querySelector('.l2-enter-btn');
    if (b) { b.click(); return 'l2-enter-btn'; }
    return 'NOT FOUND';
  }));
  await sleep(1600);
  await shoot(page, `${dev}-02-form1-top`, 0);
  report(`${dev} ② 表单①（首屏）`, await probe(page));
  await shoot(page, `${dev}-03-form1-bottom`, 99999);

  // ③ 表单②
  // ⚠️ 桌面 / 平板宽度下表单页顶部有 .f2-nav-link「探索/推演/认识自己」，
  // 用文本正则匹配「推演」会命中这个锚点而不是提交按钮 → 必须按类名精确点击。
  console.log('下一步 ->', await page.evaluate(() => { const b = document.querySelector('.f2-submit'); if (b) { b.click(); return (b.textContent || '').replace(/\s+/g, ' ').trim(); } return null; }));
  await sleep(1600);
  await shoot(page, `${dev}-04-form2`, 0);
  report(`${dev} ③ 表单②（所问之事）`, await probe(page));

  // ④ 结果页
  console.log('提交 ->', await page.evaluate(() => { const b = document.querySelector('.f2-submit-primary'); if (b) { b.click(); return (b.textContent || '').replace(/\s+/g, ' ').trim(); } return null; }));
  await sleep(9000);
  await shoot(page, `${dev}-05-result-top`, 0);
  report(`${dev} ④ 结果页（顶部）`, await probe(page));
  await shoot(page, `${dev}-06-result-mid`, 1500);
  await shoot(page, `${dev}-07-result-deep`, 3600);
  report(`${dev} ④ 结果页（中段）`, await probe(page));

  // ⑤ 浅色结果页
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
  await shoot(page, `${dev}-08-result-light`, 0);
  console.log('主题 =', await page.evaluate(() => document.documentElement.getAttribute('data-theme')));
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(700);

  // ⑥ 术语百科
  console.log('术语百科 ->', await clickRe(page, '术语百科'));
  await sleep(1800);
  await shoot(page, `${dev}-09-glossary`, 0);
  report(`${dev} ⑥ 术语百科`, await probe(page));
  await shoot(page, `${dev}-10-glossary-deep`, 1200);

  await browser.close();
  console.log(`\n截图 → ${OUT}/`);
})();
