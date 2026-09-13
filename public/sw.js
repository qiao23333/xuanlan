// 玄览 Service Worker —— 让「全本地计算」的产品真正可离线、可安装。
// 策略：
//   - 导航请求（HTML）：network-first，离线时回退到已缓存的 app shell
//   - 静态资源（JS/CSS/图片）：cache-first（含懒加载的算法内核，首次拉取后离线可用）
// 版本号变更即清旧缓存，避免脏缓存。
// v2(2026-09-13)：背景山水图已改走 src/assets 内容哈希（换图必换 URL），这里再 bump 一次版本，
// 清掉老浏览器里那份被 cache-first 钉死的旧 bg-scene-dark.jpg 条目。

const VERSION = 'xuanlan-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
const RUNTIME = `${VERSION}-runtime`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== VERSION && k !== RUNTIME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
