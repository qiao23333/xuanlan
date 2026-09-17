/**
 * 量「这个应用实际用到了哪些 Web 字体组合」。
 *
 * 为什么需要它：index.html 里向 Google Fonts 请求的是
 *   Noto Serif SC（500;600;700）+ Noto Sans SC（400;500;700）
 * 六个组合 —— 这份清单是**手写的**，没人量过页面到底渲染了哪几个。
 * 代价不小：每个（字族, 字重）组合都会在 CSS 里展开成上百个 unicode-range 的
 * @font-face。实测同一份 URL：
 *   6 个组合 = 659.3KB 原始 / 181.2KB gzip   ← 现状，整份在首屏下载路径上（2.4s @ Fast 3G）
 *   3 个组合 = 331.1KB 原始 /  90.7KB gzip
 *   1 个组合 = 111.8KB 原始 /  30.2KB gzip
 * 所以「多请求了用不到的字重」是纯亏。
 *
 * ⚠️⚠️ 两个必须做对的地方，否则会得出"这个字重没人用、可以删"的错误结论：
 *
 * ① **断点必须走全**。踩过：第一版只跑 1440×900，报告 `Noto Sans SC 700` 一次都没渲染到，
 *    看起来是白下载。但唯一用到它的规则长这样：
 *        @media (max-width: 760px) { .dg-num { font-weight: 700; font-family: var(--font-sans); } }
 *    —— 它只在窄屏存在。照第一版的结论删掉，窄屏的数字就会掉到系统字体。
 *    所以宽度列表**从实际 CSS 文本推导**（扫 @media 里的 max-width/min-width），不手写。
 *    换宽度很便宜：不用重新导航，改 viewport 再扫一遍 DOM 即可。
 *
 * ② **界面必须走全**。字重是跟着界面出现的；没走到结果页就下结论，等于把盲区当"没问题"。
 *    本工具在表单页/结果页没走到时会**以非 0 退出**，并拒绝输出"可删哪些字重"。
 *
 * 用法：
 *   BASE=http://localhost:4173/ node tools/font-usage.mjs
 *   BASE=https://qiao23333.github.io/xuanlan/ node tools/font-usage.mjs
 *   WIDTHS=390,1440 ...   # 覆盖推导出来的宽度（调试用）
 */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** index.html 里当前请求的组合（改 index.html 时同步这里，否则对照失去意义） */
const REQUESTED = [
  ['Noto Serif SC', '500'],
  ['Noto Serif SC', '600'],
  ['Noto Serif SC', '700'],
  ['Noto Sans SC', '400'],
  ['Noto Sans SC', '500'],
  ['Noto Sans SC', '700'],
];

/** 从真实 CSS 文本推导要走的宽度：每个 @media 边界的两侧各取一点 */
const deriveWidths = (cssText) => {
  if (process.env.WIDTHS) return process.env.WIDTHS.split(',').map(Number).filter(Boolean);
  const want = new Set([390, 1440]);
  for (const m of cssText.matchAll(/@media([^{]*)\{/g)) {
    for (const mm of m[1].matchAll(/max-width:\s*([\d.]+)px/g)) want.add(Math.floor(Number(mm[1])));
    for (const mm of m[1].matchAll(/min-width:\s*([\d.]+)px/g)) want.add(Math.ceil(Number(mm[1])));
  }
  return [...want].filter((w) => w >= 320 && w <= 1920).sort((a, b) => a - b);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const p = await browser.newPage();
await p.setRequestInterception(true);
p.on('request', (r) => (/\/(sw\.js|manifest\.webmanifest)$/.test(new URL(r.url()).pathname) ? r.abort() : r.continue()));
await p.setViewport({ width: 1440, height: 900 });
await p.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
await sleep(1800);

const cssHref = await p.evaluate(() => {
  const s = [...document.styleSheets].find((x) => x.href && new URL(x.href).host === location.host);
  return s ? s.href : null;
});
if (!cssHref) { console.error('✖ 找不到本站样式表，无法推导断点'); await browser.close(); process.exit(1); }
const cssText = await (await fetch(cssHref)).text();
const WIDTHS = deriveWidths(cssText);

/* 收集器：只看**自己直接持有文本**的元素。
   容器（祖先）不渲染自己的字，把它们算进来会把 body 的 400 记成"用到了 400"。
   ⚠️ 必须带上 SVG 的 text/tspan：踩过 —— 第一版只列 HTML 标签，于是
      <text className="dg-num">（DimensionGauges 里的分数）被整类漏掉，
      而 `Noto Sans SC 700` **只**出现在这条 SVG 文本上（窄屏 @media 里换成 sans 700）。
      结果是工具非常自信地报"这个字重从未渲染、可以删"，删了窄屏数字就掉字体。
      漏一类元素不会报错，只会静默少报 —— 这类"安静的漏"最难发现。 */
const collect = () =>
  p.evaluate(() => {
    const rows = [];
    for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,a,button,summary,label,li,td,th,strong,em,small,div,text,tspan')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const cs = getComputedStyle(el);
      const first = (cs.fontFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
      rows.push({ family: first, weight: String(cs.fontWeight), svg: el.namespaceURI !== 'http://www.w3.org/1999/xhtml' });
    }
    return rows;
  });

const seen = new Map();   // "family|weight" -> { n, where:Set }
const surfaces = [];
/** 在同一个界面上把所有宽度扫一遍（改 viewport 即可，无需重新导航） */
const scan = async (name) => {
  let total = 0;
  for (const w of WIDTHS) {
    await p.setViewport({ width: w, height: 900 });
    await sleep(220);
    const rows = await collect();
    total = Math.max(total, rows.length);
    for (const r of rows) {
      const k = `${r.family}|${r.weight}`;
      if (!seen.has(k)) seen.set(k, { n: 0, bySurface: new Set(), widths: new Set(), svg: 0 });
      const e = seen.get(k);
      e.n += 1;
      e.bySurface.add(name);
      e.widths.add(w);
      if (r.svg) e.svg += 1;
    }
  }
  surfaces.push({ name, n: total });
  console.log(`  · ${name.padEnd(14)} ${String(total).padStart(4)} 个持文本元素 × ${WIDTHS.length} 个宽度`);
};

const dismissModals = async () => {
  for (let i = 0; i < 8; i++) {
    const c = await p.evaluate(() => {
      const v = document.querySelector('.modal-veil');
      if (!v) return false;
      const x = [...v.querySelectorAll('button')].find((y) => y.offsetParent !== null);
      if (x) { x.click(); return true; }
      return false;
    });
    if (!c) break;
    await sleep(700);
  }
};

const setTheme = async (t) => {
  const cur = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (cur === t) return;
  await p.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(800);
};

const reveal = async () => {
  await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await p.evaluate(async () => {
    const H = () => document.documentElement.scrollHeight;
    for (let y = 0; y < H(); y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  });
  await sleep(300);
};

const clickText = (sel, re) => p.evaluate((s, r) => {
  const cands = [...document.querySelectorAll(s)].filter((el) => new RegExp(r).test((el.textContent || '').trim()));
  if (!cands.length) return false;
  (cands.find((el) => el.offsetParent !== null) || cands[0]).click();
  return true;
}, sel, re);

console.log(`\n目标 ${BASE}`);
console.log(`从 CSS 推导出的宽度：${WIDTHS.join(', ')}`);
console.log('─'.repeat(78));

await dismissModals();
await setTheme('dark');
await scan('入场页·深');
await setTheme('light');
await scan('入场页·浅');

await p.evaluate(() => document.querySelector('.l2-enter-btn')?.click());
await sleep(2000);
const reachedForm = await p.evaluate(() => !!document.querySelector('.f2-submit'));
if (reachedForm) await scan('表单页');
else console.log('  ⚠️ 未进入表单页（找不到 .f2-submit）');

await p.evaluate(() => document.querySelector('.f2-submit')?.click());
await sleep(1800);
await p.evaluate(() => document.querySelector('.f2-submit-primary')?.click());
await sleep(12000);

const reachedResult = await p.evaluate(() => !!document.querySelector('div.sys, .results'));
if (reachedResult) {
  for (const t of ['dark', 'light']) {
    await setTheme(t);
    await reveal();
    await scan(`结果页·${t === 'dark' ? '深' : '浅'}`);
  }
} else {
  console.log('  ⚠️ 未进入结果页 —— 结果页是全站最大的字重来源，缺了它结论不成立');
}

if (await clickText('.mtb-item, .nav-item, .nav-link, .l2-nav button', '术语')) {
  await sleep(1200);
  await reveal();
  await scan('术语页');
}

/* ───────── 汇总 ───────── */
const web = [...seen.entries()]
  .map(([k, v]) => { const [family, weight] = k.split('|'); return { family, weight, ...v }; })
  .filter((x) => /^Noto (Serif|Sans) SC$/.test(x.family))
  .sort((a, b) => (a.family === b.family ? Number(a.weight) - Number(b.weight) : a.family.localeCompare(b.family)));

const reqSet = new Set(REQUESTED.map(([f, w]) => `${f}|${w}`));

console.log('\n' + '─'.repeat(78));
console.log(`实际渲染到的 Web 字体组合（共 ${web.length} 个）：`);
for (const x of web) {
  const key = `${x.family}|${x.weight}`;
  const tag = reqSet.has(key) ? '已请求' : '⚠️ 未请求 → 退到别的字重';
  const ws = [...x.widths].sort((a, b) => a - b);
  const span = ws.length === WIDTHS.length ? `${WIDTHS.length} 个宽度全覆盖` : `只在 ${ws[0]}–${ws[ws.length - 1]}px（${ws.length}/${WIDTHS.length} 个宽度）`;
  console.log(`  ${x.family.padEnd(14)} ${x.weight.padStart(3)}  ${String(x.n).padStart(6)} 处  ${tag}`);
  console.log(`      出现于 ${[...x.bySurface].join('、')}；${span}${x.svg ? `；其中 SVG 文本 ${x.svg} 处` : ''}`);
}

const unused = REQUESTED.filter(([f, w]) => !seen.has(`${f}|${w}`));
const missing = web.filter((x) => !reqSet.has(`${x.family}|${x.weight}`));

console.log(`\n请求了但一次都没渲染到（候选"白下载"）：${unused.length ? '' : '（无）'}`);
for (const [f, w] of unused) console.log(`  ${f} ${w}`);
console.log(`\n渲染到了但没请求（浏览器在替：例如 400 会被 500 顶替）：${missing.length ? '' : '（无）'}`);
for (const x of missing) console.log(`  ${x.family} ${x.weight}（${x.n} 处）`);

const complete = reachedForm && reachedResult;
if (!complete) {
  console.error('\n✖ 有界面没走到（表单页/结果页），本次清单不完整 —— 不要据此删字重。');
} else if (unused.length) {
  const keep = REQUESTED.filter(([f, w]) => seen.has(`${f}|${w}`));
  const byFamily = new Map();
  for (const [f, w] of keep) { if (!byFamily.has(f)) byFamily.set(f, []); byFamily.get(f).push(w); }
  console.log(`\n按实测可收窄为：`);
  console.log(`  https://fonts.googleapis.com/css2?${[...byFamily].map(([f, ws]) => `family=${f.replace(/ /g, '+')}:wght@${ws.join(';')}`).join('&')}&display=swap`);
  console.log(`  已走宽度：${WIDTHS.join(', ')}；已走界面：${surfaces.map((s) => s.name).join('、')}`);
  console.log(`  ⚠️ 只覆盖这一次走到的范围；改界面或改断点后要重跑，别把这份清单当永久结论。`);
}

await browser.close();
process.exit(complete ? 0 : 1);
