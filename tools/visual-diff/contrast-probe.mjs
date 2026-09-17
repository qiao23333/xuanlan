/** 量取指定元素在浅色/深色下的文字色、底色与对比度，找低对比度文本 */
import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:4173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setRequestInterception(true);
p.on('request', (r) => (r.url().endsWith('sw.js') ? r.abort() : r.continue()));
await p.setViewport({ width: 1440, height: 900 });
await p.goto(BASE, { waitUntil: 'networkidle2' });
await sleep(1800);
for (let i = 0; i < 8; i++) { const c = await p.evaluate(() => { const v = document.querySelector('.modal-veil'); if (!v) return false; const x = [...v.querySelectorAll('button')].find((y) => y.offsetParent !== null); if (x) { x.click(); return true; } return false; }); if (!c) break; await sleep(700); }
await p.evaluate(() => document.querySelector('.l2-enter-btn')?.click());
await sleep(1800);
await p.evaluate(() => document.querySelector('.f2-submit')?.click());
await sleep(1800);
await p.evaluate(() => document.querySelector('.f2-submit-primary')?.click());
await sleep(10000);

const probe = () => p.evaluate(() => {
  const lum = (rgb) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };
  // ⚠️ Chrome 会把 color-mix() 的结果序列化成 `color(srgb 0.96 0.94 0.90)`（0–1 浮点），
  // 和 `rgb(245,241,232)`（0–255 整数）两种格式。只按数字抓会把 0.96 当成 0.96/255 → 全判成黑，
  // 于是"深色字 vs 浅色底"被算成对比度 1.4 的假阳性。必须分别解析。
  const parse = (s) => {
    if (!s) return null;
    const m = s.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/);
    if (m) {
      const a = m[4] === undefined ? 1 : Number(m[4]);
      if (a < 0.6) return null;
      return [m[1], m[2], m[3]].map((v) => Math.round(Number(v) * 255));
    }
    const n = s.match(/[\d.]+/g);
    if (!n) return null;
    const a = n[3] === undefined ? 1 : Number(n[3]);
    if (a < 0.6) return null;
    return n.slice(0, 3).map(Number);
  };
  const out = [];
  const sel = 'h1,h2,h3,p,span,a,button,summary,label,li,td,th';
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    // ⚠️ 只量「自己直接持有文本」的元素。
    // 否则 <button class="gl-syscard"><span class="gl-sysname">…</span>…</button> 这类容器
    // 会被按按钮自身的 color 量 —— 那是浏览器 UA 默认的 rgb(0,0,0)（#121a30 底上对比度 1.22），
    // 可它一个字都不直接渲染，文字全在子元素的 color 里。这是量法造成的假阳性，
    // 会一直挂在榜首把真问题挤下去（实测术语页 8 条全是它）。
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) continue;   // color: transparent 且走 background-clip:text 渐变文字的，跳过
    // 向上找第一个不透明底色。注意顺序：底色优先于背景图 ——
    // 否则一路走到 body（body 同时有底色和背景图）就会把整页都判成"渐变底"而全部跳过。
    // 只有当某节点底色透明、却画了渐变/图片时，才认为真实底不是纯色 → 该条结果不可信，跳过。
    let node = el, bg = null, grad = false;
    while (node && node !== document.documentElement) {
      const s2 = getComputedStyle(node);
      const cand = parse(s2.backgroundColor);
      if (cand) { bg = cand; break; }
      if (s2.backgroundImage && s2.backgroundImage !== 'none') { grad = true; break; }
      node = node.parentElement;
    }
    if (grad || !bg) continue;
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 3.0) {
      out.push({ r: Math.round(ratio * 100) / 100, tag: el.tagName, cls: (el.getAttribute('class') || '').slice(0, 34), fs: cs.fontSize, fw: cs.fontWeight, fg: `rgb(${fg.join(',')})`, bg: `rgb(${bg.join(',')})`, t: t.slice(0, 18) });
    }
  }
  // 返回全部命中，不再在页面内 slice —— 早期版本在这里截断，导致「共 20 处」
  // 被误读成一共有 20 处，把问题规模藏住了。截断只发生在打印阶段。
  return out;
});

/* 展开所有折叠区 + 滚一遍。
   折叠的 <details> 内容高度为 0，会被 probe 里「r.height < 8 就跳过」整批漏掉 ——
   而八套体系卡（紫微/奇门/六壬/小六壬/占星/塔罗…）多数默认收起。
   早先只量「当前这一屏」时，报出来的 20 处其实只覆盖了八字和梅花，
   剩下的体系是没量过的盲区，不是「没问题」。 */
const reveal = async () => {
  await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await p.evaluate(async () => {
    const H = () => document.documentElement.scrollHeight;
    for (let y = 0; y < H(); y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
    window.scrollTo(0, 0);
  });
  await sleep(600);
};

/* 优先点可见元素；找不到可见的就退回第一个（哪怕它是 display:none）。
   ⚠️ 必须留这条退路：桌面宽度下移动标签栏是 display:none，offsetParent 为 null，
   早先的「只点可见项」会让「回到推演视图」静默失败 —— 于是切主题后量的其实是
   上一个视图（术语页），浅色那轮的失败项被整批漏掉，看起来像"已经修好了"。 */
const clickText = (sel, re) => p.evaluate((s, r) => {
  const cands = [...document.querySelectorAll(s)].filter((el) => new RegExp(r).test((el.textContent || '').trim()));
  if (!cands.length) return false;
  (cands.find((el) => el.offsetParent !== null) || cands[0]).click();
  return true;
}, sel, re);

const surfaces = [];
const shot = async (name) => {
  const out = await probe();
  surfaces.push({ name, out });
  console.log(`  · ${name.padEnd(22)} ${String(out.length).padStart(3)} 处`);
  return out.length;
};

for (const t of ['dark', 'light']) {
  const cur = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (cur !== t) { await p.evaluate(() => document.querySelector('.theme-toggle')?.click()); await sleep(900); }

  // ① 结果页（含全部展开的体系卡）
  await reveal();
  await shot(`${t} / 结果页`);

  // ② 各个模态：页脚按钮 → 打开 → 量 → 关掉
  for (const [name, re] of [['更新日志', '更新日志'], ['隐私与数据说明', '隐私与数据说明']]) {
    const ok = await clickText('.app-foot button, .app-foot a, footer button, .l2-footer button', `^${re}$`);
    if (ok) { await sleep(700); await shot(`${t} / ${name}`); await p.evaluate(() => { const v = document.querySelector('.modal-veil'); v?.click(); }); await sleep(500); }
  }

  // ③ 其他视图：术语 / 故事 / 探索页
  for (const [name, re] of [['术语词典', '术语'], ['项目故事', '^故事$']]) {
    const ok = await clickText('.mtb-item, .nav-item, .nav-link, .l2-nav button', re);
    if (!ok) continue;
    await sleep(900); await reveal();
    await shot(`${t} / ${name}`);
  }

  /* ④ 探索页放最后：它没有移动标签栏（App 里 `view !== 'landing' && <MobileTabBar/>`），
     一旦落上去就没有 tab 可点回来了。回程只能走页内的 CTA —— onEnter 只 setView，
     不清 result，所以点完正好回到刚才那张结果页。 */
  if (await clickText('.mtb-item', '^探索$')) {
    await sleep(900); await reveal();
    await shot(`${t} / 探索页`);
    for (const [name, re] of [['更新日志', '更新日志'], ['隐私与数据说明', '隐私']]) {
      const ok = await clickText('.l2-footer button, .l2-footer a', re);
      if (ok) { await sleep(700); await shot(`${t} / 探索页·${name}`); await p.evaluate(() => document.querySelector('.modal-veil')?.click()); await sleep(500); }
    }
    const entered = await clickText('.l2-enter-btn', '开始探索');
    if (!entered) console.log('  ⚠️ 探索页找不到入口 CTA，回不去结果页');
    await sleep(900);
  }
  await clickText('.mtb-item', '^推演$');
  await sleep(700);
  // 自检：回不去就明说，别让下一轮把别的页面当成结果页量了还报 0 处。
  const onResult = await p.evaluate(() => !!document.querySelector('div.sys'));
  if (!onResult) console.log('  ⚠️ 未能回到结果页视图，下一轮「结果页」测量结果不可信');
}

// 跨表面合并：同一「类名+前景色+底色」只留最低那条，避免同一元素在多个视图里重复刷屏。
const merged = new Map();
for (const s of surfaces) {
  for (const x of s.out) {
    const k = `${x.cls}|${x.fg}|${x.bg}`;
    const prev = merged.get(k);
    if (!prev || x.r < prev.r) merged.set(k, { ...x, where: s.name });
  }
}
const all = [...merged.values()].sort((a, b) => a.r - b.r);
const shown = all.slice(0, 25);
console.log(`\n共扫 ${surfaces.length} 个表面（${surfaces.map((s) => s.name).join('、')}）`);
console.log(`合并去重后，对比度 <3.0 的文本共 ${all.length} 处，下面列最低的 ${shown.length} 条：`);
for (const x of shown) console.log(`  ${String(x.r).padStart(5)}  [${x.where}] <${x.tag} class="${x.cls}"> ${x.fs}/${x.fw} fg=${x.fg} bg=${x.bg}  "${x.t}"`);
if (!all.length) console.log('  （无）');
await b.close();
