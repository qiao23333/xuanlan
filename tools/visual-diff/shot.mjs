// 按参考图同分辨率(1672x941)截图，供与 资料/新参考 做像素级比对。
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = 'http://localhost:4173/';
const W = 1672, H = 941;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));

await page.goto(APP, { waitUntil: 'networkidle2' });
await sleep(2000);

const setTheme = async (t) => {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t);
  // 结果页推演完会自动滚到中段，不回顶的话截出来的是页面中部，跟参考图对不上
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
};

// 关掉所有全屏遮罩：首访同意弹层 -> 新手引导（同一个 .modal-veil，会连着弹）。
// 只要遮罩还在就继续点，否则截出来的图隔着一层 0.72 的黑纱，
// 浅色模式会被误判成深色（实测全图均值能从 87 拉回 233）。
async function dismissVeils() {
  for (let i = 0; i < 8; i++) {
    const has = await page.evaluate(() => !!document.querySelector('.modal-veil'));
    if (!has) break;
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.modal-veil button, .modal-veil .btn-gold')];
      const hit = btns.find((b) => /我已了解|同意|接受|跳过|开始体验|完成|我知道了/.test(b.textContent || ''))
        || btns[btns.length - 1];
      if (hit) hit.click();
    });
    await sleep(700);
  }
}
await dismissVeils();

await setTheme('dark');
await page.screenshot({ path: 'shots/mine-home-dark.png' });
await setTheme('light');
await page.screenshot({ path: 'shots/mine-home-light.png' });

// 进表单
await page.evaluate(() => {
  const b = document.querySelector('.l2-enter-btn');
  if (b) b.click();
});
await sleep(1800);
await dismissVeils();
await setTheme('light');
await page.screenshot({ path: 'shots/mine-form-light.png' });
await setTheme('dark');
await page.screenshot({ path: 'shots/mine-form-dark.png' });

// 推演到结果页
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('下一步'));
  if (b) b.click();
});
await sleep(1000);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('开始推演'));
  if (b) b.click();
});
await sleep(7000);
await setTheme('dark');
await page.screenshot({ path: 'shots/mine-result-dark.png' });
await setTheme('light');
await page.screenshot({ path: 'shots/mine-result-light.png' });

console.log('shots done');
await browser.close();
