/**
 * CSS 用量体检：哪些规则真的匹配到了元素、哪些从来没有。
 *
 * 为什么需要它：把字体挪出渲染路径之后，**唯一还在阻塞首屏的就是我们自己这张样式表**
 * （实测 159.4KB raw / 30.4KB gzip，占 FCP 的 84%）。要动它只有一个正当理由 ——
 * "里面有多少是白带的"。图片有体积门禁（img-weight.mjs），CSS 没有；
 * 而"看着有点冗余"不是理由，必须先有数字。
 *
 * ⚠️ 五个踩过的坑（前四个都让第一版报出过假结论）：
 *
 * ① **别用 CDP `CSS.stopRuleUsageTracking` 的 `used` 字段判"用没用"。**
 *    实测（本轮 Chrome）：返回的条目**全部 `used: true`** —— "从未匹配"的规则压根
 *    不出现在返回里，而且相邻已用规则会被**合并成一段**。拿它做分界会得到
 *    "100% 全部在用"。改用 puppeteer 的 `page.coverage.startCSSCoverage()`：
 *    同一套底层数据，但已整理成 `{url, text, ranges}`，ranges 是**逐条规则**的
 *    已用区间（实测 .nav-item.active 这类单条规则各占一段），未用 = text 减 ranges。
 *
 * ② **Google Fonts 那张表也在覆盖范围里**（实测 675153 字符、ranges=0）。
 *    它的规则是 @font-face，**永远不会"匹配元素"**，覆盖率必然显示 100% 未用 ——
 *    那是口径错配，不是死代码。必须按同源过滤，否则它会以 4 倍体量淹没结论。
 *
 * ③ **必须两个主题都走。** 本项目双主题靠 `[data-theme=light]` 覆盖实现，
 *    只走深色的话，**每一条浅色规则都会被报成"未匹配"** —— 第一版就是这么把
 *    `[data-theme=light]`（917B）类的一大批规则推上"可删"榜首的。
 *
 * ④ **必须覆盖全部断点。** 断点是从**实际 CSS 文本**里扫出来的，不是手写常量：
 *    本项目样式分布在 styles.css + mobile.css 两个文件（Vite 会拼成一个 bundle），
 *    只 grep 其中一个会漏掉 `max-width: 767.98px`、`min-width: 1600px`、
 *    `(min-width:768px) and (max-width:1023.98px)` 这些只存在于 mobile.css 的条件。
 *    规则：`max-width: N` 取 floor(N)、`min-width: N` 取 ceil(N) 各测一遍 ——
 *    每个媒体条件都由"它自己的断点值"满足，这样既不漏也不冗余。
 *    `prefers-reduced-motion` 单独用 emulateMediaFeatures 覆盖（本项目只有 reduce、
 *    没有 no-preference，所以整体模拟 reduce 是无损的）。
 *
 * ⑤ **"匹配过"≠"生效过"。** 一条规则匹配到了元素、但每条声明都被后面的规则覆盖，
 *    照样算已用。所以本工具量出的未用是**死代码的下界**。真正的重复/覆盖问题
 *    （同选择器重复声明、被更高特异性压死 —— 本项目已栽过三次：
 *    .l2-title / .f2-bg / .f2-side-card）得靠静态扫描，两类问题互补。
 *    交互态（:hover/:focus/::selection）在无头浏览器里不会因为我们"走一遍页面"
 *    就命中，单独归一类并从可删里排除。
 *
 * 两个阶段回答两个不同的问题：
 *   ① 落地页 × 主题 × 断点 → **首屏关键集**；"没用到的" = 可以推迟加载的（拆分空间）
 *   ② 全站走遍 × 主题 × 断点 → **真死代码**；走遍了还没匹配到的，才谈得上删
 *
 * 用法：
 *   BASE=http://localhost:4173/ node tools/visual-diff/css-coverage.mjs
 *   OUT=.probe/css-coverage.json   # 落原始数据便于前后对比
 *   STABLE=1                       # 全站那一阶段跑两遍，比对数字是否可复现
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:4173/';
const OUT = process.env.OUT || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kb = (b) => `${(b / 1024).toFixed(1)}KB`;
const pct = (a, b) => `${((a / b) * 100).toFixed(1)}%`;

/* ---------- 从实际 CSS 文本推导要测哪些视口宽度 ---------- */
const deriveWidths = (cssText) => {
  const want = new Set([360, 390, 768, 1440, 1920]); // 基线：常见真机/桌面
  for (const m of cssText.matchAll(/@media([^{]*)\{/g)) {
    const pre = m[1];
    for (const mm of pre.matchAll(/max-width:\s*([\d.]+)px/g)) want.add(Math.floor(Number(mm[1])));
    for (const mm of pre.matchAll(/min-width:\s*([\d.]+)px/g)) want.add(Math.ceil(Number(mm[1])));
  }
  return [...want].filter((w) => w >= 320 && w <= 1920).sort((a, b) => a - b);
};
const heightFor = (w) => (w <= 480 ? 844 : w <= 1024 ? 1024 : 900);

/* ---------- 把样式表切成规则边界（只做结构切分，不解析声明） ---------- */
// 扫描器跳过注释时不推进 segStart，所以"规则前的注释"会被连进选择器里
// （形如"注释紧贴在 .l2-bg-mist 选择器前面"）。构建产物已被压掉注释，但对着 dev server
// 跑时注释都在 —— 不剥会把注释里的字混进选择器，影响展示与交互态判定。
const clean = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();
const scanRules = (text) => {
  const rules = [];
  const stack = [];
  let segStart = 0;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") { const q = c; i++; while (i < n && text[i] !== q) { if (text[i] === '\\') i++; i++; } i++; continue; }
    if (c === '{') {
      const seg = text.slice(segStart, i);
      const lead = (seg.match(/^[\s;]*/) || [''])[0].length;
      const selStart = segStart + lead;
      const sel = text.slice(selStart, i).trim();
      stack.push({ sel, selStart, isAt: sel.startsWith('@') });
      segStart = i + 1; i++; continue;
    }
    if (c === '}') {
      const open = stack.pop();
      if (open && !open.isAt) rules.push({ selStart: open.selStart, end: i + 1, sel: open.sel, parents: stack.map((s) => s.sel) });
      segStart = i + 1; i++; continue;
    }
    i++;
  }
  return rules;
};

const INTERACTIVE = /:(hover|focus|focus-visible|focus-within|active|visited|target|checked|disabled|placeholder-shown|autofill|user-invalid|user-valid)|::(selection|placeholder|marker|first-line|first-letter|backdrop)/;
const namespace = (sel) => (sel.match(/\.([A-Za-z][\w-]*)/g) || ['（无类名：元素/全局）'])[0];

/* ---------- 浏览器 ---------- */
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});

const openPage = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', (r) => (/\/sw\.js(\?|$)/.test(r.url()) ? r.abort() : r.continue()));
  // 本项目 CSS 里的 prefers-reduced-motion 块只有 reduce 一种写法（无 no-preference），
  // 所以整体模拟 reduce 是无损的：reduce 块被覆盖到，无条件动画规则照样匹配。
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  return page;
};

/* 主题切换：优先点按钮（走 React 的真实路径），切不动就直接改属性兜底并计数。
   直接改属性对"CSS 匹配"这个用途是等价的 —— ThemeToggle 本身也只是设这个属性。 */
let forcedSwitches = 0;
const setTheme = async (page, t) => {
  const cur = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if ((await cur()) === t) return;
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(350);
  if ((await cur()) !== t) {
    await page.evaluate((x) => document.documentElement.setAttribute('data-theme', x), t);
    forcedSwitches++;
    await sleep(250);
  }
};

const openDetails = (page) => page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
const scrollThrough = async (page) => {
  await page.evaluate(async () => {
    const H = () => document.documentElement.scrollHeight;
    for (let y = 0; y < H(); y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
  });
  await sleep(300);
};

/* 主题 × 断点的二维扫描。`deep` 为真时额外滚一遍（触发懒揭示的元素挂载）——
   只在每个表面滚一次，宽度扫描时不必重复滚（内容已挂载，coverage 会累积）。 */
const visitMatrix = async (page, WIDTHS, { deep = false } = {}) => {
  for (const t of ['dark', 'light']) {
    await setTheme(page, t);
    for (const w of WIDTHS) {
      await page.setViewport({ width: w, height: heightFor(w) });
      await sleep(180);
      await openDetails(page);
      if (deep) { await scrollThrough(page); deep = false; }
      await sleep(130);
    }
  }
};

const clickText = (page, sel, re) => page.evaluate((s, r) => {
  const c = [...document.querySelectorAll(s)].filter((el) => new RegExp(r).test((el.textContent || '').trim()));
  if (!c.length) return false;
  (c.find((el) => el.offsetParent !== null) || c[0]).click();   // 退路：桌面下移动标签栏 display:none
  return true;
}, sel, re);

const dismissVeils = async (page) => {
  for (let i = 0; i < 8; i++) {
    const c = await page.evaluate(() => {
      const v = document.querySelector('.modal-veil');
      if (!v) return false;
      const x = [...v.querySelectorAll('button')].find((y) => y.offsetParent !== null);
      if (x) { x.click(); return true; }
      return false;
    });
    if (!c) break;
    await sleep(450);
  }
};

/* ---------- 单阶段 ---------- */
const runPhase = async (label, walk) => {
  const page = await openPage();
  await page.coverage.startCSSCoverage({ resetOnNavigation: false });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(2200);

  // 断点从实际产物里扫 —— 不手写常量，改了断点也不用同步改工具
  const href = await page.evaluate(() => {
    const s = [...document.styleSheets].find((x) => x.href && new URL(x.href).host === location.host);
    return s ? s.href : null;
  });
  if (!href) throw new Error('找不到同源样式表');
  const cssText = await (await fetch(href)).text();
  const WIDTHS = deriveWidths(cssText);

  await walk(page, WIDTHS);
  const entries = await page.coverage.stopCSSCoverage();
  await page.close();

  // ⚠️ 只留同源：Google Fonts 那张（@font-face 恒不匹配）必须排除，否则 675KB 的
  //    100% 未用会淹没结论。
  const host = new URL(BASE).host;
  const ours = entries.filter((e) => { try { return new URL(e.url).host === host && e.text.length > 0; } catch { return false; } });
  const mine = ours.sort((a, b) => b.text.length - a.text.length)[0];
  if (!mine) throw new Error(`没抓到同源样式表（entries: ${entries.map((e) => e.url).join(', ')}）`);

  const totalBytes = Buffer.byteLength(mine.text, 'utf8');
  const all = scanRules(mine.text);
  const isUsed = (r) => mine.ranges.some((g) => (g.start <= r.selStart && r.end <= g.end) || g.start === r.selStart);
  const bucket = { used: [], interactive: [], media: [], other: [] };
  for (const r of all) {
    const sel = clean(r.sel);
    const item = {
      sel: sel.slice(0, 96),
      bytes: Buffer.byteLength(mine.text.slice(r.selStart, r.end), 'utf8'),
      ns: namespace(sel),
      media: r.parents.some((p) => clean(p).startsWith('@media')),
      supports: r.parents.some((p) => clean(p).startsWith('@supports')),
    };
    if (isUsed(r)) bucket.used.push(item);
    else if (INTERACTIVE.test(sel)) bucket.interactive.push(item);
    else if (item.supports) bucket.interactive.push(item);   // @supports 未命中当"环境未覆盖"，不主张删
    else if (item.media) bucket.media.push(item);
    else bucket.other.push(item);
  }
  const sum = (a) => a.reduce((s, x) => s + x.bytes, 0);
  const dead = [...bucket.media, ...bucket.other];

  console.log(`\n${'═'.repeat(76)}`);
  console.log(`【${label}】${mine.url.split('/').pop()}  ${kb(totalBytes)}（未压缩）· ${all.length} 条规则 · 断点 ${WIDTHS.length} 档 × 2 主题`);
  console.log(`  已匹配        ${String(bucket.used.length).padStart(4)} 条 ${kb(sum(bucket.used)).padStart(9)}  ${pct(sum(bucket.used), totalBytes).padStart(6)}`);
  console.log(`  环境/交互态未覆盖 ${String(bucket.interactive.length).padStart(4)} 条 ${kb(sum(bucket.interactive)).padStart(9)}  ${pct(sum(bucket.interactive), totalBytes).padStart(6)}   ← 无头环境测不到，不算死代码`);
  console.log(`  未匹配·媒体查询内  ${String(bucket.media.length).padStart(4)} 条 ${kb(sum(bucket.media)).padStart(9)}  ${pct(sum(bucket.media), totalBytes).padStart(6)}`);
  console.log(`  未匹配·其他     ${String(bucket.other.length).padStart(4)} 条 ${kb(sum(bucket.other)).padStart(9)}  ${pct(sum(bucket.other), totalBytes).padStart(6)}`);
  console.log(`  ⇒ 未匹配合计 ${kb(sum(dead))}（${pct(sum(dead), totalBytes)}）—— 死代码**下界**`);

  const byNs = new Map();
  for (const x of dead) {
    const v = byNs.get(x.ns) || { bytes: 0, n: 0, sample: x.sel };
    v.bytes += x.bytes; v.n += 1; byNs.set(x.ns, v);
  }
  console.log(`\n  未匹配体量最大的 12 个命名空间：`);
  for (const [ns, v] of [...byNs.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 12)) {
    console.log(`    ${kb(v.bytes).padStart(8)}  ${String(v.n).padStart(3)} 条   ${ns.padEnd(20)} 例：${v.sample.slice(0, 54)}`);
  }
  console.log(`\n  未匹配的单条最大 12 条：`);
  for (const x of [...dead].sort((a, b) => b.bytes - a.bytes).slice(0, 12)) {
    console.log(`    ${String(x.bytes).padStart(6)}B  ${x.media ? '[media] ' : ''}${x.sel}`);
  }

  return { label, url: mine.url, widths: WIDTHS, totalBytes, ruleCount: all.length, used: sum(bucket.used), interactive: sum(bucket.interactive), unmatched: sum(dead), dead };
};

/* ---------- 两个阶段 ---------- */
const walkLanding = async (page, WIDTHS) => {
  await dismissVeils(page);
  await visitMatrix(page, WIDTHS, { deep: true });
};

const walkEverything = async (page, WIDTHS) => {
  await dismissVeils(page);
  await visitMatrix(page, WIDTHS, { deep: true });

  // 进推演 → 出结果页（八套体系卡此时才挂到 DOM 上），在结果页上再扫一遍主题 × 断点
  await setTheme(page, 'dark');
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluate(() => document.querySelector('.l2-enter-btn')?.click());
  await sleep(1400);
  await page.evaluate(() => document.querySelector('.f2-submit')?.click());
  await sleep(1400);
  await page.evaluate(() => document.querySelector('.f2-submit-primary')?.click());
  await sleep(9000);
  await visitMatrix(page, WIDTHS, { deep: true });

  // 其他视图（术语 / 故事 / 探索）+ 页脚模态，每个表面都各扫一遍主题 × 断点
  for (const re of ['术语', '^故事$', '^探索$']) {
    if (!(await clickText(page, '.mtb-item, .nav-item, .nav-link, .l2-nav button', re))) continue;
    await sleep(900);
    await visitMatrix(page, WIDTHS, { deep: true });
  }
  for (const re of ['更新日志', '隐私']) {
    if (!(await clickText(page, '.app-foot button, .app-foot a, footer button, .l2-footer button, .l2-footer a', re))) continue;
    await sleep(700);
    await visitMatrix(page, WIDTHS, { deep: true });
    await page.evaluate(() => document.querySelector('.modal-veil')?.click());
    await sleep(400);
  }
};

console.log(`目标 ${BASE}`);
const rLanding = await runPhase('① 落地页（首屏关键集）', walkLanding);
const rAll = await runPhase('② 全站走遍（判死代码）', walkEverything);

if (process.env.STABLE === '1') {
  const r2 = await runPhase('② 全站走遍 · 复测（稳定性）', walkEverything);
  const same = r2.totalBytes === rAll.totalBytes && r2.ruleCount === rAll.ruleCount
    && r2.unmatched === rAll.unmatched && r2.used === rAll.used && r2.interactive === rAll.interactive;
  console.log(`\n${'═'.repeat(76)}`);
  if (same) console.log(`稳定性：两次全站测量完全一致 ✅（used ${rAll.used} / unmatched ${rAll.unmatched} / ${rAll.ruleCount} 条）`);
  else {
    console.log(`稳定性：两次全站测量**不一致** ❌ —— 数字不可信，先查明原因再引用`);
    console.log(`  第一次 used=${rLanding.used === 0 ? '-' : rAll.used} unmatched=${rAll.unmatched} interactive=${rAll.interactive} rules=${rAll.ruleCount} bytes=${rAll.totalBytes}`);
    console.log(`  第二次 used=${r2.used} unmatched=${r2.unmatched} interactive=${r2.interactive} rules=${r2.ruleCount} bytes=${r2.totalBytes}`);
  }
}

console.log(`\n${'═'.repeat(76)}`);
console.log(`两阶段对照（同一张样式表，${kb(rAll.totalBytes)}）：`);
const deferred = rAll.used - rLanding.used;
console.log(`  · 首屏就用不到：${kb(rLanding.unmatched)}（${pct(rLanding.unmatched, rAll.totalBytes)}）  ← 可推迟/拆分的是这一块`);
console.log(`  · 其中进应用后会用到：${kb(deferred)}  ← 不能删，但不必挡在首屏前面`);
console.log(`  · 全站走遍仍未匹配：${kb(rAll.unmatched)}（${pct(rAll.unmatched, rAll.totalBytes)}）  ← 死代码下界，候选删除`);
if (forcedSwitches) console.log(`  ⓘ 主题切换有 ${forcedSwitches} 次走了"直改属性"兜底（按钮没生效），不影响 CSS 匹配结论`);
console.log(`\n口径边界（务必连着数字一起读）：`);
console.log(`  · "匹配过"≠"生效过"：被后续规则覆盖的声明照样算已匹配 → 「未匹配」是下界，不是全部冗余。`);
console.log(`  · 交互态（:hover/:focus/::selection）与 @supports 未命中，在无头环境下测不到，已单独归类，未计入未匹配。`);
console.log(`  · 只统计同源样式表；Google Fonts 那张（@font-face 恒不匹配）已排除。`);
console.log(`  · 首屏关键集 = 落地页 × 全部断点 × 双主题（含滚动后才出现的元素），比严格 FCP 关键 CSS 略宽。`);

if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ base: BASE, landing: rLanding, all: rAll }, null, 1));
  console.log(`\n原始数据已写入 ${OUT}`);
}
await browser.close();
