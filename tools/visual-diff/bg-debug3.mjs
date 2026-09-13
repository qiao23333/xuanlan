import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = 'http://localhost:4173/';

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1672, height: 941 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await sleep(2000);

  // Dismiss modals
  for (let i = 0; i < 15; i++) {
    const ok = await page.evaluate(() => {
      const v = document.querySelector('.modal-veil');
      const s = v || document;
      const b = [...s.querySelectorAll('button')].find((x) => /同意|接受|我已了解|开始使用|下一步|下一页|开始体验|跳过|进入|确认|稍后再说|了解/.test((x.textContent || '').replace(/\s/g, '')));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!ok) break;
    await sleep(500);
  }

  // Use Puppeteer's native click() on the 术语百科 button
  console.log('Attempting native click on 术语百科...');
  try {
    // Find the button containing "术语百科" text
    const btnHandle = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button.nav-item, [class*="nav"]')]
        .find((x) => (x.textContent || '').includes('术语百科'))
    );
    if (btnHandle) {
      await btnHandle.click();
      console.log('Clicked via handle.click()');
    } else {
      console.log('Button not found via handle, trying selector...');
      await page.click('button.nav-item', { timeout: 3000 }).catch(() => console.log('selector click failed'));
    }
  } catch (e) {
    console.log('Click error:', e.message?.slice(0, 100));
  }

  await sleep(2000);

  // Check state
  const state = await page.evaluate(() => ({
    url: location.href,
    hasGlPage: !!document.querySelector('.gl-page'),
    cardCount: document.querySelectorAll('.gl-syscard').length,
    bodyText: document.body?.innerText?.slice(0, 200),
  }));
  console.log('After click:', JSON.stringify(state).slice(0, 300));

  if (!state.hasGlPage && state.cardCount === 0) {
    // Try direct navigation via URL or React internals
    console.log('\nGlossary still not loaded. Trying alternative approaches...');
    // Try navigating to #glossary hash
    await page.goto(URL + '#glossary', { waitUntil: 'networkidle2' });
    await sleep(1500);
    const s2 = await page.evaluate(() => ({
      hash: location.hash,
      hasGlPage: !!document.querySelector('.gl-page'),
      cardCount: document.querySelectorAll('.gl-syscard').length,
    }));
    console.log('After hash nav:', JSON.stringify(s2));

    // Last resort: use __REACT_DEVTOOLS_GLOBAL_HOOK__ or dispatch custom event
    if (!s2.hasGlPage) {
      console.log('\nTrying window.dispatchEvent hack...');
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('xuanlan-navigate', { detail: 'glossary' }));
      });
      await sleep(1000);
      const s3 = await page.evaluate(() => ({
        hasGlPage: !!document.querySelector('.gl-page'),
        cardCount: document.querySelectorAll('.gl-syscard').length,
      }));
      console.log('After custom event:', JSON.stringify(s3));
    }
  }

  // If we finally got the glossary page, do the theme audit
  const finalCheck = await page.evaluate(() => ({
    hasGlPage: !!document.querySelector('.gl-page'),
    cardCount: document.querySelectorAll('.gl-syscard').length,
  }));

  if (finalCheck.hasGlPage) {
    console.log('\n=== GLOSSARY PAGE LOADED! Running theme audit ===');
    // Light mode
    await page.evaluate(() => { if (document.documentElement.getAttribute('data-theme') !== 'light') document.querySelector('.theme-toggle')?.click(); });
    await sleep(500);
    const lightBg = await page.evaluate(() => {
      const c = document.querySelector('.gl-syscard');
      if (!c) return null;
      const cs = getComputedStyle(c);
      return { bg: cs.backgroundColor, theme: document.documentElement.getAttribute('data-theme') };
    });
    console.log('LIGHT card bg:', JSON.stringify(lightBg));
    await page.screenshot({ path: '.tmp-gl-final-light.png', fullPage: true });

    // Dark mode
    await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
    await sleep(500);
    const darkBg = await page.evaluate(() => {
      const c = document.querySelector('.gl-syscard');
      if (!c) return null;
      const cs = getComputedStyle(c);
      return { bg: cs.backgroundColor, theme: document.documentElement.getAttribute('data-theme') };
    });
    console.log('DARK card bg:', JSON.stringify(darkBg));
    await page.screenshot({ path: '.tmp-gl-final-dark.png', fullPage: true });

    console.log('\nCard backgrounds DO switch:', lightBg?.bg !== darkBg?.bg ? 'YES ✓' : 'NO ✗ (same value!)');
    if (lightBg?.bg === darkBg?.bg) {
      console.log('⚠️ PROBLEM FOUND: Card background does NOT change between themes!');
    }
  } else {
    console.log('\n❌ Could not load glossary page through any navigation method.');
    await page.screenshot({ path: '.tmp-gl-fail.png', fullPage: true });
  }

  await browser.close();
})();
