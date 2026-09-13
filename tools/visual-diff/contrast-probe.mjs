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
      out.push({ r: Math.round(ratio * 100) / 100, tag: el.tagName, cls: (el.getAttribute('class') || '').slice(0, 34), fs: cs.fontSize, fg: `rgb(${fg.join(',')})`, bg: `rgb(${bg.join(',')})`, t: t.slice(0, 18) });
    }
  }
  return { theme: document.documentElement.getAttribute('data-theme'), list: out.sort((a, b) => a.r - b.r).slice(0, 20) };
});

for (const t of ['dark', 'light']) {
  const cur = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (cur !== t) { await p.evaluate(() => document.querySelector('.theme-toggle')?.click()); await sleep(900); }
  await p.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  const res = await probe();
  console.log(`\n=== ${res.theme} 模式：对比度 <3.0 的文本（共 ${res.list.length} 处）===`);
  for (const x of res.list) console.log(`  ${String(x.r).padStart(5)}  <${x.tag} class="${x.cls}"> ${x.fs}/${x.fw} fg=${x.fg} bg=${x.bg}  "${x.t}"`);
}
await b.close();
