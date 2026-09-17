/**
 * 首屏瀑布 + 核心性能指标（FCP / LCP / TTFB / 渲染阻塞资源）
 *
 * 为什么需要它：前面几轮的审计全是"**渲染结果对不对**"（溢出、字号、对比度、像素差），
 * 却没有任何一个能回答"**慢了没有**"。于是资源瘦身（图片转 WebP）只能靠"体积小了 41%"这种
 * 间接理由，说不出"首屏早了 300ms"——而后者才是用户真正感受到的东西。
 *
 * 两个必须做对的地方，否则量出来的数字没有意义：
 *
 * ① **关掉 Service Worker 缓存**。本项目的 sw.js 对静态资源是 cache-first，
 *    第二次访问时 CSS/JS/图片全从缓存出，瀑布图变成一排 0ms —— 看起来"极快"，
 *    实际上只证明"缓存有效"，对首屏优化毫无指导意义。
 *    用 CDP 的 `Network.setBypassServiceWorker(true)` + `setCacheDisabled(true)`。
 *
 * ② **默认限速**。"本机直连 CDN"速度下所有资源都是几十毫秒，优化什么都看不出差别。
 *    默认按 Fast 3G（1.6Mbps / 150ms RTT）模拟，接近国内移动端真实处境；
 *    FAST=1 可关掉，看局域网理想值。
 *
 * 用法：
 *   BASE=http://localhost:4173/ node tools/visual-diff/waterfall.mjs
 *   BASE=https://qiao23333.github.io/xuanlan/ node tools/visual-diff/waterfall.mjs
 *   FAST=1 ...   # 不限速
 *   BLOCK=fonts.googleapis.com,fonts.gstatic.com ...   # 模拟某域名被墙（看首屏是否被拖死）
 *   DELAY=fonts.googleapis.com:6000   # 模拟"连得上但很慢/被丢包"（更接近真实墙的行为）
 */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE || 'http://localhost:4173/';
const SLOW = process.env.FAST !== '1';
const BLOCKED = (process.env.BLOCK || '').split(',').map((s) => s.trim()).filter(Boolean);
/**
 * 「被墙」到底该模拟成什么？
 *   BLOCK= 是**瞬间失败**（ERR_FAILED）。真实情况里，被墙常见的是**黑洞**：
 *   SYN 丢包 / 连接建立不起来，浏览器要干等到自己的连接超时（可达数十秒）。
 *   这两者对首屏的影响完全不同 —— 瞬间失败下即便渲染阻塞也只是晚几十毫秒，
 *   黑洞下渲染阻塞会让页面**一直空白**。
 *   所以两种都要能模拟：DELAY=<host>:<ms> 把该 host 的请求按住房几秒再放行/放弃，
 *   这才看得出"阻塞 vs 非阻塞"的真正差别。
 */
const REQUESTS = (process.env.REQ || '').split(',').map((s) => s.trim()).filter(Boolean);
const DELAYS = (process.env.DELAY || '')
  .split(',')
  .map((s) => s.split(':'))
  .filter((p) => p[0])
  .map(([host, ms]) => ({ host: host.trim(), ms: Number(ms) || 3000 }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

/* 拦掉 sw.js：不然 SW 装上后本轮测量就被缓存污染（我们只量一次冷启动，
   但 SW 的 install 会在首访时抓一批 SHELL，混进瀑布里干扰判断）。
   被我们主动 abort 的请求要记进 selfAborted —— 否则它们会以 net::ERR_FAILED
   出现在"失败请求"里（实测 manifest.webmanifest 被报两次），把真正的问题
   （404 / 连不上）淹掉。**自己制造的噪音要自己消掉。** */
await page.setRequestInterception(true);
page.on('request', async (r) => {
  const u = r.url();
  if (/\/(sw\.js|manifest\.webmanifest)(\?|$)/.test(u) || BLOCKED.some((d) => u.includes(d))) {
    selfAborted.add(u);
    return r.abort();
  }
  const hit = DELAYS.find((d) => u.includes(d.host));
  if (hit) {
    selfAborted.add(u);
    await sleep(hit.ms);            // 按住不放 = 模拟黑洞丢包，而不是干脆地失败
    return r.abort().catch(() => {});
  }
  r.continue();
});

const cdp = await page.target().createCDPSession();
await cdp.send('Network.enable');
await cdp.send('Network.setBypassServiceWorker', { bypass: true });
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

if (SLOW) {
  // Fast 3G：1.6 Mbps 下行 / 750 Kbps 上行 / 150ms RTT —— 国内移动端量级
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
}

const reqs = new Map();      // requestId -> {url,type,start,status,ct,bytes,end}
const failed = [];
const selfAborted = new Set();
cdp.on('Network.requestWillBeSent', (e) => {
  reqs.set(e.requestId, {
    url: e.request.url,
    type: e.type,
    start: e.timestamp,
    doc: e.request.url === page.url() || e.type === 'Document',
  });
});
cdp.on('Network.responseReceived', (e) => {
  const r = reqs.get(e.requestId);
  if (!r) return;
  r.status = e.response.status;
  r.ct = (e.response.mimeType || '').toLowerCase();
});
cdp.on('Network.loadingFinished', (e) => {
  const r = reqs.get(e.requestId);
  if (!r) return;
  r.end = e.timestamp;
  r.bytes = e.encodedDataLength || 0;
});
cdp.on('Network.loadingFailed', (e) => {
  const r = reqs.get(e.requestId);
  if (e.canceled) return;
  if (r && selfAborted.has(r.url)) return;   // 我们自己 abort 的，不算失败
  failed.push({ url: r?.url || '(未知)', err: e.errorText || '' });
});

/** 主题：站点把主题存在 localStorage 的 xuanlan.theme，且在 HTML 里的防闪脚本里读；
    必须在**任何页面脚本之前**写进去，否则量到的是默认（深色）。
    用途：验证「两个主题背景变量都声明、但只下载被用到的那张」这句注释是否真成立
    —— 注释里断言的行为，要么能当场量出来，要么就别写。 */
if (process.env.THEME) {
  const t = process.env.THEME;
  await page.evaluateOnNewDocument((theme) => {
    try { localStorage.setItem('xuanlan.theme', theme); } catch (e) {}
  }, t);
}

/** LCP 不会出现在 getEntriesByType 里，必须自己挂 PerformanceObserver。    而且要在**导航前**注入 —— 页面脚本跑起来再挂就晚了。
    光拿到"时间"没用：得知道**是哪个元素**在拖 LCP。`entry.element` 是活的 DOM 引用，
    没法直接跨进程传，所以就地序列化成 tag/class/尺寸/图片 URL 再带回来。
    （踩过：只报 "LCP 2864ms" 时会去猜是标题字太大，实际 LCP 是 body 上的背景大图，
      优化方向完全相反。） */
await page.evaluateOnNewDocument(() => {
  window.__lcp = null;
  const pick = (entry) => {
    const el = entry.element;
    if (!el) return { t: Math.round(entry.startTime), tag: '(无元素)', sel: '' };
    const cls = typeof el.className === 'string' ? el.className : '';
    const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      t: Math.round(entry.startTime),
      tag: el.tagName,
      sel: cls ? `.${cls.trim().split(/\s+/).join('.')}` : '',
      size: `${Math.round(r.width)}×${Math.round(r.height)}`,
      url: entry.url ? String(entry.url).split('/').pop() : '',
      kind: entry.url ? '图片' : '文本/背景',
    };
  };
  try {
    new PerformanceObserver((list) => {
      const es = list.getEntries();
      window.__lcp = pick(es[es.length - 1]);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
});

await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
// LCP 需要在 load 之后仍在观测，等一会让 LCP 定稿
await sleep(2500);

const metrics = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  const res = performance.getEntriesByType('resource').map((r) => ({
    name: r.name,
    initiator: r.initiatorType,
    start: r.startTime,
    dur: r.duration,
    size: r.transferSize || 0,
    blocking: r.renderBlockingStatus || '',
  }));
  return {
    ttfb: nav.responseStart,
    domContentLoaded: nav.domContentLoadedEventEnd,
    load: nav.loadEventEnd,
    fcp: fcp ? fcp.startTime : null,
    res,
    lcp: window.__lcp,
  };
});

const ms = (t) => (t == null ? '—' : `${Math.round(t)}ms`);

console.log(`\n目标 ${BASE}`);
console.log(`限速 ${SLOW ? 'Fast 3G (1.6Mbps / 150ms RTT)' : '无（本机直连）'}`
  + (BLOCKED.length ? `  屏蔽 ${BLOCKED.join(', ')}` : '')
  + (DELAYS.length ? `  拖延 ${DELAYS.map((d) => `${d.host} ${d.ms}ms`).join(', ')}` : ''));
console.log('─'.repeat(74));
console.log(`TTFB              ${ms(metrics.ttfb)}`);
console.log(`FCP 首次内容绘制   ${ms(metrics.fcp)}`);
const l = metrics.lcp;
console.log(`LCP 最大内容绘制   ${ms(l && l.t)}${l ? `   ← ${l.tag}${l.sel} ${l.size || ''} ${l.kind} ${l.url || ''}` : ''}`);
console.log(`DOMContentLoaded  ${ms(metrics.domContentLoaded)}`);
console.log(`Load              ${ms(metrics.load)}`);

const blocking = metrics.res.filter((r) => r.blocking === 'blocking');
console.log(`\n渲染阻塞资源 ${blocking.length} 个：`);
for (const b of blocking.sort((a, z) => z.dur - a.dur)) {
  console.log(`  ${String(Math.round(b.start)).padStart(5)}ms  +${String(Math.round(b.dur)).padStart(5)}ms  ${(b.size / 1024).toFixed(1).padStart(7)}KB  ${b.name.replace(BASE, '')}`);
}

/* 归因：阻塞资源全部下载完的时刻，就是首屏能开始绘制的时刻。
   把「最后一个阻塞资源的结束时间」和 FCP 摆在一起，才看得出时间花在哪 ——
   否则 FCP 只是一个孤零零的数字，没法指导优化。 */
if (blocking.length && metrics.fcp != null) {
  const lastEnd = Math.max(...blocking.map((b) => b.start + b.dur));
  const top = blocking.slice().sort((a, z) => z.dur - a.dur)[0];
  console.log(`\nFCP 归因：阻塞资源最晚 ${Math.round(lastEnd)}ms 才下完，FCP ${Math.round(metrics.fcp)}ms`
    + `（占 ${Math.round((lastEnd / metrics.fcp) * 100)}%）`);
  console.log(`  其中最慢的一个占 ${Math.round((top.dur / lastEnd) * 100)}%：${top.name.replace(BASE, '')}`);
}

const top = metrics.res
  .filter((r) => r.size > 0 || r.dur > 30)
  .sort((a, z) => z.start - a.start)
  .slice(0, 16);
console.log(`\n关键请求时间线（按开始时间，共 ${metrics.res.length} 条）：`);
console.log('   开始      耗时     体积      类型        资源');
for (const r of top.reverse()) {
  console.log(
    `  ${String(Math.round(r.start)).padStart(6)}ms  ${String(Math.round(r.dur)).padStart(6)}ms  `
    + `${(r.size / 1024).toFixed(0).padStart(6)}KB  ${(r.blocking || r.initiator).padEnd(10)}  ${r.name.replace(BASE, '')}`,
  );
}

const total = metrics.res.reduce((a, r) => a + r.size, 0);
console.log(`\n首屏共 ${(total / 1024).toFixed(0)}KB（${metrics.res.length} 个请求）`);
if (failed.length) {
  console.log(`\n❌ 失败请求 ${failed.length} 个：`);
  for (const f of failed.slice(0, 6)) console.log(`  ${f.err}  ${f.url.replace(BASE, '')}`);
}

await browser.close();
