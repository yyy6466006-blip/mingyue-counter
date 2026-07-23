const CACHE_NAME = 'myt-counter-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 安裝：預先快取所有資源
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 啟動：清除舊版快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 快取優先 + 背景更新
// 有快取 → 立即回傳（離線也能用），同時背景靜默更新快取
// 無快取 → 等網路
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // 背景更新快取（不影響回應速度）
      const networkUpdate = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, res.clone()));
          // 通知頁面有新版本可用
          if (e.request.url.includes('index.html') || e.request.url.endsWith('/')) {
            self.clients.matchAll({includeUncontrolled: true}).then(clients => {
              clients.forEach(client => client.postMessage({type: 'SW_UPDATED'}));
            });
          }
        }
        return res;
      }).catch(() => null);

      if (cached) {
        // 有快取：立即回傳，背景更新不阻塞
        networkUpdate.catch(() => {});
        return cached;
      }
      // 無快取：等網路，失敗則 fallback
      return networkUpdate.then(res => res || caches.match('./index.html'));
    })
  );
});
