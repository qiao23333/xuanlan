import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1672, height: 941 });
p.on('pageerror', (e) => console.log('[err]', String(e).slice(0, 160)));
await p.goto('http://localhost:4173/', { waitUntil: 'networkidle2' });
await sleep(1800);

async function dismissVeils() {
  for (let i = 0; i < 8; i++) {
    const has = await p.evaluate(() => !!document.querySelector('.modal-veil'));
    if (!has) break;
    await p.evaluate(() => {
      const btns = [...document.querySelectorAll('.modal-veil button')];
      const hit = btns.find((x) => /我已了解|同意|接受|跳过|开始体验|完成|我知道了/.test(x.textContent || '')) || btns[btns.length - 1];
      if (hit) hit.click();
    });
    await sleep(700);
  }
}
await dismissVeils();
const setTheme = async (t) => { await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t); await sleep(400); };

// 首页：页脚高度 / 三栏是否同一基线 / 天是否可见
const home = await p.evaluate(() => {
  const f = document.querySelector('.l2-footer');
  const fb = f.getBoundingClientRect();
  const kids = [...f.children].map((c) => { const r = c.getBoundingClientRect(); return { cls: c.className, cy: Math.round(r.y + r.height / 2), h: Math.round(r.height) }; });
  const t = document.querySelector('.l2-label-top');
  const tb = t && t.getBoundingClientRect();
  const w = document.querySelector('.l2-wheel-wrap').getBoundingClientRect();
  const svg = document.querySelector('.l2-wheel-wrap svg');
  const sb = svg && svg.getBoundingClientRect();
  return {
    footerH: Math.round(fb.height),
    footerKids: kids,
    footerBaseSpread: Math.max(...kids.map((k) => k.cy)) - Math.min(...kids.map((k) => k.cy)),
    tianCy: tb ? Math.round(tb.y + tb.height / 2) : null,
    wheelTop: Math.round(w.y), svgTop: sb ? Math.round(sb.y) : null,
    tianAboveWheel: tb && sb ? Math.round(sb.y - (tb.y + tb.height)) : null,
    scroll: document.documentElement.scrollHeight, client: document.documentElement.clientHeight,
  };
});
console.log('HOME', JSON.stringify(home));

await p.evaluate(() => { const e = document.querySelector('.l2-enter-btn'); if (e) e.click(); });
await sleep(1800); await dismissVeils();

async function form(theme) {
  await setTheme(theme);
  return p.evaluate(() => {
    const g = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), cy: Math.round(r.y + r.height / 2) }; };
    const tg = document.querySelector('.f2-calendar-toggle');
    const tb = tg && tg.getBoundingClientRect();
    const btns = tg ? [...tg.querySelectorAll('.f2-toggle-btn')].map((x) => { const r = x.getBoundingClientRect(); return Math.round(r.width); }) : [];
    const sub = document.querySelector('.f2-submit');
    const scs = sub && getComputedStyle(sub);
    return {
      capsuleW: tb ? Math.round(tb.width) : null,
      capsuleH: tb ? Math.round(tb.height) : null,
      btnWidths: btns,
      capsuleFitsButtons: tb ? Math.round(tb.width - btns.reduce((a, c) => a + c, 0)) : null,
      submitBg: scs ? scs.backgroundImage.slice(0, 90) : null,
      submitColor: scs ? scs.color : null,
      dateInputH: (g('.f2-input-sm') || {}).h,
    };
  });
}
console.log('FORM dark ', JSON.stringify(await form('dark')));
console.log('FORM light', JSON.stringify(await form('light')));

await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((n) => (n.textContent || '').includes('下一步')); if (x) x.click(); });
await sleep(1000);
await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((n) => (n.textContent || '').includes('开始推演')); if (x) x.click(); });
await sleep(7000); await dismissVeils();

async function res(theme) {
  await setTheme(theme);
  return p.evaluate(() => {
    const c = document.querySelector('.so-card');
    const icon = c && c.querySelector('.so-icon');
    const im = c && c.querySelector('.so-icon img');
    const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    const pg = document.querySelector('.pillar-gan');
    const tn = document.querySelector('.tc-name');
    return {
      card: R(c), icon: R(icon),
      visibleIcon: (() => { if (!c) return null; const vis = [...c.querySelectorAll('.so-icon img')].filter((x) => getComputedStyle(x).display !== 'none'); const r = vis[0] && vis[0].getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; })(),
      pillarGanColor: pg ? getComputedStyle(pg).color : null,
      tarotNameColor: tn ? getComputedStyle(tn).color : null,
    };
  });
}
console.log('RESULT dark ', JSON.stringify(await res('dark')));
console.log('RESULT light', JSON.stringify(await res('light')));
await b.close();
