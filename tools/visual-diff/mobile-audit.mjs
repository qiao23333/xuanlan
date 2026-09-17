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
  phone: { width: 390, height: 844, deviceScaleFactor: 2, touch: true },
  small: { width: 360, height: 780, deviceScaleFactor: 2, touch: true },
  tablet: { width: 834, height: 1112, deviceScaleFactor: 2, touch: true },
  // 桌面是鼠标输入，40px 是「手指命中区」标准，对鼠标不适用 ——
  // 故 desktop 关掉触控项检查，否则导航条这类 27px 的鼠标目标会被一直误报。
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, touch: false },
};
fs.mkdirSync(OUT, { recursive: true });

/** 当前设备是否按触屏评估（在 main 里按 DEVICES[dev].touch 赋值） */
let CHECK_TOUCH = true;
/** 每类问题最多列几条。默认 8 条够看；要看全量用 LIMIT=999 ——
    注意「列出的条数」不等于「总数」，报告里会分别打印，别再把截断当成规模。 */
const LIMIT = Number(process.env.LIMIT || 8);
const probe = (page, checkTouch = CHECK_TOUCH) =>
  page.evaluate(({ checkTouch, limit }) => {
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
    const over = [], smallTextRead = [], smallTextMicro = [], smallTap = [];
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
      // 「<12px」是给「中文密集 UI 里要读的字」定的下限。但结果页里有大量 10px 的图表
      // 单字标记（「底」「当」「吉」「凶」「↔」）和 10px 的英文 eyebrow（· EIGHT SYSTEMS）
      // —— 它们是密度取舍，和 11.5px 的中文句子不是一回事，混在一个数里数出 300+ 条，
      // 真问题会被埋掉。所以分桶：含中文且（≥4 汉字 或 总长 ≥8）才算阅读文本。
      // 纯拉丁串一律归微标（西文在 10px 下的 x-height 仍可辨识，中文方块字不行）。
      if (el.children.length === 0 && txt && parseFloat(cs.fontSize) < 12) {
        const cjk = (txt.match(/[\u4e00-\u9fff]/g) || []).length;
        const row = { sel: path(el), fs: +parseFloat(cs.fontSize).toFixed(1), text: txt.slice(0, 20) };
        (cjk >= 4 || (cjk >= 1 && txt.length >= 8) ? smallTextRead : smallTextMicro).push(row);
      }
      // 命中区按「真实可点区域」算：<label> 会把点击转发给内部可标注控件
      // （button/input 都是 labelable）。iOS 开关就是这种——button 本体仅 46×28，
      // 但整行 label 57px 高都可点。不折算 label 的话，所有「标签+控件」都会误报。
      // 仅在触屏设备上评估（桌面鼠标不需要 40px 手指命中区）。
      if (checkTouch && el.matches('button, a, [role="button"], input, select')) {
        const lab = el.closest('label');
        const hEff = lab ? lab.getBoundingClientRect().height : r.height;
        // 保留一位小数：早先四舍五入后再显示，39.6px 会被印成「h=40」，
        // 看着像审计自己报错了（明明 40 却挂在「<40px」下面）。判定用原值，显示也照原值。
        if (hEff < 40) smallTap.push({ sel: path(el), h: +hEff.toFixed(1), w: Math.round(r.width), text: (txt || el.getAttribute('aria-label') || '').slice(0, 16) });
      }
    }
    const fixed = [...document.querySelectorAll('body *')]
      .filter((el) => vis(el) && ['fixed', 'sticky'].includes(getComputedStyle(el).position))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { sel: path(el), pos: getComputedStyle(el).position, top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), bg: getComputedStyle(el).backgroundColor };
      });
    return {
      vw,
      checkTouch,
      hScroll: de.scrollWidth > vw + 1,
      docScrollW: de.scrollWidth,
      // 每类都同时给「总数」和「截断后的列表」——只给列表会让「共 8 处」被读成「一共就 8 处」。
      total: { dirty: over.filter((o) => !o.clip).length, clipped: over.filter((o) => o.clip).length, text: smallTextRead.length, micro: smallTextMicro.length, tap: smallTap.length },
      dirty: over.filter((o) => !o.clip).sort((a, b) => b.over - a.over).slice(0, limit),
      clipped: over.filter((o) => o.clip).sort((a, b) => b.over - a.over).slice(0, limit),
      smallText: smallTextRead.slice(0, limit),
      smallMicro: smallTextMicro.slice(0, limit),
      smallTap: smallTap.slice(0, limit),
      fixed: fixed.slice(0, limit),
    };
  }, { checkTouch, limit: LIMIT });

function report(label, p) {
  console.log(`\n===== ${label} ===== vw=${p.vw} scrollWidth=${p.docScrollW} ${p.hScroll ? '❌ 横向溢出' : '✅ 无横向溢出'}`);
  if (p.dirty.length) {
    console.log(`  ❌ 真溢出（无祖先裁剪）共 ${p.total.dirty} 处，下面列 ${p.dirty.length} 条：`);
    p.dirty.forEach((o) => console.log(`     +${o.over}px [${o.l}→${o.r}] w=${o.w}  ${o.sel}`));
  }
  if (p.clipped.length) {
    console.log(`  ⚠️ 被裁剪的溢出 共 ${p.total.clipped} 处（贴着边被切，视觉断裂），下面列 ${p.clipped.length} 条：`);
    p.clipped.forEach((o) => console.log(`     +${o.over}px [${o.l}→${o.r}] w=${o.w}  ${o.sel}`));
  }
  if (p.fixed.length) {
    console.log('  📌 固定/吸附层（top<0 代表被推出视口上方）：');
    p.fixed.forEach((f) => console.log(`     ${f.pos} top=${f.top} h=${f.h} w=${f.w}  ${f.sel}`));
  }
  if (p.smallText.length) {
    console.log(`  ⚠️ <12px 且成阅读单位（≥8 字符或 ≥4 汉字）共 ${p.total.text} 处，下面列 ${p.smallText.length} 条：`);
    p.smallText.forEach((s) => console.log(`     ${s.fs}px "${s.text}"  ${s.sel}`));
  } else if (p.checkTouch) {
    console.log('  ✅ 无 <12px 的阅读文本（单字标记/英文 eyebrow 另计）');
  }
  if (p.total.micro) console.log(`  ℹ️ 另有 ${p.total.micro} 处 <12px 图表单字标记（「底/吉/↔」之类，属密度取舍，不计入告警）`);
  if (p.smallTap.length) {
    console.log(`  ⚠️ 触控区高<40px 共 ${p.total.tap} 处，下面列 ${p.smallTap.length} 条：`);
    p.smallTap.forEach((s) => console.log(`     h=${s.h} w=${s.w} "${s.text}"  ${s.sel}`));
  } else if (!p.checkTouch) {
    console.log('  （鼠标输入，跳过触控命中区检查）');
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
  CHECK_TOUCH = DEVICES[dev].touch;
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
