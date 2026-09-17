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
 *   SETTLE=12000                      # 快照窗口（DCL 后固定等待毫秒）；A/B 必须同值
 *   WATCH=bg-scene,css2               # 点名盯某条资源（默认视图只留最晚开始的 16 条）
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
/* 快照窗口：DOMContentLoaded 之后固定等这么久再取数。
   ⚠️ 千万别改回 waitUntil:'networkidle2' —— "网络静默"本身就是**被测量的结果**，
   于是两个变体会在**不同长度**的窗口里统计（实测 V2 的字体排到 2.0s 才开始、
   窗口被拉到 ~10s → 报"首屏 1876KB"；基线只有 477KB —— 不是基线更轻，
   是它的窗口在字体下完之前就截断了，未完成的请求 size=0 被静默丢掉）。
   固定窗口后，"首屏多少 KB"才是变体之间可以横向比的东西。 */
const SETTLE = Number(process.env.SETTLE || 12000);
/* 点名要盯的资源 URL 子串（逗号分隔）。见下方 shown 的注释：默认视图会把它们藏起来。 */
const WATCH = (process.env.WATCH || '').split(',').map((s) => s.trim()).filter(Boolean);
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
    /* Chrome 给这条请求定的初始优先级（VeryLow/Low/Medium/High/VeryHigh）。
       用途：判断"某个资源在抢带宽"这件事该靠**优先级**解决还是靠**减字节/换时机**解决。
       如果它本来就是 Low 却仍占住管道（实测：149KB 的 CSS 背景图占用约 745ms，
       期间把字体样式表从 1.73s 拖到 2.47s），那优先级已经没什么可降的了，只能动字节或时机。 */
    prio: e.request.initialPriority || '',
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
  /* 只留"最后一条"是不够的：LCP 是一串**候选**，最终值取其中最大/最晚的那次绘制。
     首屏常见形态是「系统字体先画一次 → Web 字体到了再把同一段标题重画一次」，
     此时 LCP 会被后推到**字体到达时刻** —— 但只看最终数字，会误判成"标题渲染太慢"。
     所以把每条候选都留下（时间 + 元素），才分得清「一次绘制」和「二次重画」。 */
  window.__lcpHistory = [];
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
      for (const e of es) window.__lcpHistory.push(pick(e));
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
});

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
// LCP 需要在 load 之后仍在观测，等一会让 LCP 定稿；顺带让限速下的字体下载跑完
await sleep(SETTLE);

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
    lcpHistory: window.__lcpHistory || [],
  };
});

/**
 * ⚠️ 体积**不能**只看上面的 performance 条目。
 * 跨域资源如果没有 `Timing-Allow-Origin`，`transferSize` 一律是 **0** ——
 * 于是 fonts.gstatic.com 上的字体文件（CJK 站点里往往是**首屏最大的那几笔**）
 * 在表里显示成 0KB、连"总字节"都不计入，报告会得出"首屏共 463KB，很轻"的结论，
 * 而真相是漏掉了最大的一块。**又一个"工具自己在骗人"**。
 * 所以改用 CDP 的 `encodedDataLength`（它如实报告编码后字节，不受 TAO 影响），
 * 并以 CDP 的记录为准重建时间线；性能条目只用来取 FCP/LCP/渲染阻塞标记。
 */
const cdpRows = [...reqs.values()].filter((r) => r.start != null);
const docReq = cdpRows.find((r) => r.doc) || cdpRows[0];
const t0 = docReq ? docReq.start : 0;
const timeline = cdpRows.map((r) => ({
  url: r.url,
  type: r.type,
  status: r.status,
  start: (r.start - t0) * 1000,
  dur: r.end != null ? (r.end - r.start) * 1000 : null,
  size: r.bytes || 0,
  cross: !r.url.startsWith(BASE),
  prio: r.prio || '',
  // 渲染阻塞标记只在 performance 条目里有，按 URL 关联回来
  blocking: metrics.res.find((m) => m.name === r.url)?.blocking || '',
}));
const transferred = timeline.reduce((a, r) => a + r.size, 0);
const crossBytes = timeline.filter((r) => r.cross).reduce((a, r) => a + r.size, 0);
const hiddenFromPerf = metrics.res.reduce((a, r) => a + r.size, 0);

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

/* LCP 是一串候选，末次才算数。把它摊开，"晚"就有了解释：
   同元素出现两次且间隔明显 = 首屏被**重画**过一次（典型是 Web 字体迟到后回填）。 */
const hist = metrics.lcpHistory || [];
if (hist.length > 1) {
  console.log(`  └ 候选 ${hist.length} 次绘制：`);
  hist.forEach((h, i) => {
    const gap = i === 0 ? '' : `  +${Math.round(h.t - hist[i - 1].t)}ms`;
    console.log(`      ${String(i + 1).padStart(2)}. ${String(h.t).padStart(6)}ms${gap.padEnd(10)} ${h.tag}${h.sel} ${h.size || ''}`);
  });
  const a = hist[0], z = hist[hist.length - 1];
  if (z.t - a.t > 150) {
    console.log(`  ⚠️ 首屏被重画过：LCP 由 ${a.t}ms 推到 ${z.t}ms（+${Math.round(z.t - a.t)}ms），元素都是 ${z.tag}${z.sel}`);
  }
}
if (metrics.fcp != null && l && l.t - metrics.fcp > 300) {
  console.log(`  ℹ FCP→LCP 空档 ${Math.round(l.t - metrics.fcp)}ms：首屏"有东西了"到"画完最大的那块"之间的等待`);
}
console.log(`DOMContentLoaded  ${ms(metrics.domContentLoaded)}`);
console.log(`Load              ${ms(metrics.load)}`);

const blocking = timeline.filter((r) => r.blocking === 'blocking');
console.log(`\n渲染阻塞资源 ${blocking.length} 个：`);
for (const b of blocking.sort((a, z) => z.dur - a.dur)) {
  console.log(`  ${String(Math.round(b.start)).padStart(5)}ms  +${String(Math.round(b.dur)).padStart(5)}ms  ${(b.size / 1024).toFixed(1).padStart(7)}KB  ${b.url.replace(BASE, '')}`);
}

/* 归因：阻塞资源全部下载完的时刻，就是首屏能开始绘制的时刻。
   把「最后一个阻塞资源的结束时间」和 FCP 摆在一起，才看得出时间花在哪 ——
   否则 FCP 只是一个孤零零的数字，没法指导优化。 */
if (blocking.length && metrics.fcp != null) {
  const lastEnd = Math.max(...blocking.map((b) => b.start + b.dur));
  const worst = blocking.slice().sort((a, z) => z.dur - a.dur)[0];
  console.log(`\nFCP 归因：阻塞资源最晚 ${Math.round(lastEnd)}ms 才下完，FCP ${Math.round(metrics.fcp)}ms`
    + `（占 ${Math.round((lastEnd / metrics.fcp) * 100)}%）`);
  console.log(`  其中最慢的一个占 ${Math.round((worst.dur / lastEnd) * 100)}%：${worst.url.replace(BASE, '')}`);
}

const shown = [...new Map(
  [
    /* WATCH=bg-scene,css2 —— 点名要盯的资源，不管它排第几都列出来。
       为什么需要：把窗口固定成 DCL+12s 之后，最晚开始的 16 条全被那 24 个字体文件占满，
       而"真正在争带宽、真正值得看"的两条（148KB 背景图、182KB 字体样式表）反而从默认视图里消失了
       —— 工具把要看的东西藏起来，比不显示更坏。 */
    ...timeline.filter((r) => WATCH.some((w) => r.url.includes(w))).map((r) => ({ ...r, watched: true })),
    ...timeline
      .filter((r) => r.size > 0 || (r.dur || 0) > 30 || r.dur == null) // 未完成的也要列，别静默藏掉
      .sort((a, z) => z.start - a.start)
      .slice(0, 16),
  ].map((r) => [r.url, r]),
).values()].sort((a, z) => a.start - z.start);
if (WATCH.length) {
  const missing = WATCH.filter((w) => !timeline.some((r) => r.url.includes(w)));
  if (missing.length) console.log(`\n⚠️ WATCH 指定的 ${missing.join('、')} 在本次请求里**一条都没出现**（是不是没被加载？）`);
}
console.log(`\n关键请求时间线（按开始时间，共 ${timeline.length} 条${WATCH.length ? `；★ = WATCH 点名` : ''}；体积来自 CDP，跨域也算得准）：`);
console.log('   开始      耗时     体积     优先级      来源       类型       资源');
for (const r of shown) {
  const dur = r.dur == null ? '  (未完成)' : `${String(Math.round(r.dur)).padStart(6)}ms`;
  const prio = String(r.prio || '—').replace('Very', 'V').replace('High', 'H').replace('Medium', 'M').replace('Low', 'L');
  console.log(
    `  ${String(Math.round(r.start)).padStart(6)}ms  ${dur.padStart(9)}  `
    + `${(r.size / 1024).toFixed(0).padStart(6)}KB  ${prio.padStart(6)}  ${(r.cross ? '第三方' : '本站  ')}  `
    + `${(r.blocking || r.type).toString().toLowerCase().padEnd(9)}  ${r.watched ? '★ ' : ''}${r.url.replace(BASE, '')}`,
  );
}

console.log(`\n首屏共 ${(transferred / 1024).toFixed(0)}KB（${timeline.length} 个请求，窗口 = DCL + ${SETTLE}ms）`
  + `，其中第三方 ${(crossBytes / 1024).toFixed(0)}KB（占 ${Math.round((crossBytes / transferred) * 100)}%）`);
/* 未完成的请求 size=0：不把这件事说出来，"首屏多少 KB"就会被读成"已经全部下完" */
const pending = timeline.filter((r) => r.dur == null);
if (pending.length) {
  const names = pending.slice(0, 4).map((r) => r.url.replace(BASE, '').split('/').pop());
  console.log(`  ⚠️ 快照时还有 ${pending.length} 个请求**没下完**（体积按 0 计）：${names.join('、')}`
    + (pending.length > 4 ? ' 等' : ''));
  console.log(`     窗口内没下完 ≠ 不存在。要缩短窗口就调 SETTLE=，但**变体之间必须用同一个值**。`);
}
if (hiddenFromPerf < transferred) {
  console.log(`  ⓘ performance API 只看得见 ${(hiddenFromPerf / 1024).toFixed(0)}KB ——`
    + ` 差额 ${((transferred - hiddenFromPerf) / 1024).toFixed(0)}KB 是跨域资源（无 Timing-Allow-Origin`
    + ` 时 transferSize=0）。**只看它会把首屏体积低估这么多**，别用那个数下结论。`);
}

if (failed.length) {
  console.log(`\n❌ 失败请求 ${failed.length} 个：`);
  for (const f of failed.slice(0, 6)) console.log(`  ${f.err}  ${f.url.replace(BASE, '')}`);
}

await browser.close();
