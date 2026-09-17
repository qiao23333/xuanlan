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

  /* 网络巡检：布局审计看不出「资源 404」——图片裂了照样不溢出、字号照样达标，
     于是子路径部署最典型的故障（--base 写错、public/ 下文件被删、SW 缓存旧路径）
     能在四视口全绿的情况下线上真实存在。删掉旧 PNG 换 WebP 时就是这种。
     排除项：sw.js / manifest 是被主动 abort 的（见上），不算失败。

     ⚠️ 采集方式必须走 CDP，不能用 page.on('response') / ('requestfinished')。
     实测（本机 Chrome + puppeteer-core）：一旦开了 setRequestInterception(true)，
     这两个高层事件对**图片**请求一条都收不到 —— 而拦截 sw.js 恰恰要靠它。
     症状是"网络巡检永远 ✅"，看着像没问题，其实什么都没采到（0 条）。
     同一次运行里对照：requestfinished 收到 0 条，CDP responseReceived 收到 8 条。 */
  const netIssues = [];
  const reqUrl = new Map();                       // requestId → url（loadingFailed 不带 url）
  const isAuditAbort = (u) => /\/(sw\.js|manifest\.webmanifest)(\?|$)/.test(u);
  /* 只查 status ≥ 400 还不够 —— 实测 vite preview 对不存在的资源不返回 404：
     它走 SPA 回退，把 index.html 用 **200** 发回来。于是"图标文件被删了"在本地
     表现成"200 拿到一坨 HTML"，状态码门禁一声不响；图片裂了但几何审计全绿。
     所以同时校验 Content-Type 与被请求的扩展名（HTML 顶包 = 真缺失）。 */
  const WANT = {
    webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    svg: 'image/svg+xml', css: 'text/css', js: 'javascript',
    woff2: 'font/woff2', woff: 'font/woff', json: 'json', ico: 'image/',
  };
  const cdp = await page.target().createCDPSession();
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', (e) => reqUrl.set(e.requestId, e.request.url));
  cdp.on('Network.loadingFailed', (e) => {
    if (e.canceled) return;                        // 主动 abort（sw.js）会带 canceled
    const u = reqUrl.get(e.requestId) || '(未知)';
    if (isAuditAbort(u)) return;
    netIssues.push({ s: 'FAIL', u, err: e.errorText || '' });
  });
  cdp.on('Network.responseReceived', ({ response }) => {
    const u = response.url;
    if (isAuditAbort(u)) return;
    const s = response.status;
    if (process.env.NETDEBUG && /\.(webp|png|svg|ico)$/.test(new URL(u).pathname)) {
      console.log('  [net]', s, response.mimeType, u);
    }
    if (s >= 400) { netIssues.push({ s, u }); return; }
    const ext = (new URL(u).pathname.split('.').pop() || '').toLowerCase();
    const want = WANT[ext];
    if (!want) return;
    const ct = (response.mimeType || '').toLowerCase();
    if (!ct.includes(want)) netIssues.push({ s: `顶包(${ct || '无类型'})`, u });
  });

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

  if (process.env.NETDEBUG) {
    const info = await page.evaluate(() => ({
      imgs: document.querySelectorAll('img').length,
      sysCards: document.querySelectorAll('.gl-syscard').length,
      firstSrcs: [...document.querySelectorAll('img')].slice(0, 4).map((i) => i.currentSrc || i.src || '(空)'),
      h: document.documentElement.scrollHeight,
    }));
    console.log('  [dbg] 术语页状态:', JSON.stringify(info));
  }

  /* 收尾：把最后这一页整页滚一遍。
     ⚠️ 不滚就抓不到 404 —— 术语页的图标是 loading="lazy" 的，没进过视口就根本不发请求，
     于是"图标文件被删了"在审计里毫无痕迹（本机实测：删掉 bazi.webp 后整轮仍然全绿）。
     懒加载资源必须"滚到了"才会暴露，网络巡检才有意义。 */
  await page.evaluate(async () => {
    const H = () => document.documentElement.scrollHeight;
    for (let y = 0; y < H(); y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  await sleep(1200);

  await browser.close();
  /* 网络巡检结果：按 URL 去重后打印。任何一条非空都意味着"页面看起来正常但资源缺了"
     —— 图片会裂、字体回退、图标空白，而四视口几何审计全都是绿的。 */
  const uniq = new Map();
  for (const i of netIssues) uniq.set(`${i.s} ${i.u}`, i);
  if (uniq.size) {
    console.log(`\n❌ 网络巡检：${uniq.size} 个资源未正常返回（可能是 --base 写错 / public 下文件被删 / CDN 拦截）`);
    for (const i of uniq.values()) console.log(`   ${i.s}  ${i.u}${i.err ? '  ' + i.err : ''}`);
  } else {
    console.log('\n✅ 网络巡检：本次走查所有资源均 < 400，无 404 / 请求失败');
  }
  console.log(`\n截图 → ${OUT}/`);
})();
