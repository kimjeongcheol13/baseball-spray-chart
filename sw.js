// SprayLab Service Worker v13
// 새로고침만으로 최신 파일 반영 — HTML은 항상 no-cache, 나머지는 stale-while-revalidate
const CACHE_NAME = 'spraylab-v13';

self.addEventListener('install', function(e) {
  self.skipWaiting(); // 즉시 활성화
});

self.addEventListener('activate', function(e) {
  // 구버전 캐시 전체 삭제
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  // GET 요청만 처리
  if (req.method !== 'GET') return;

  // HTML(네비게이션) 요청: 항상 네트워크에서 no-cache로 가져옴
  // → 새로고침 한 번으로 최신 index.html 반영
  if (req.mode === 'navigate' || req.headers.get('accept').includes('text/html')) {
    e.respondWith(
      fetch(new Request(req, {cache: 'no-cache'}))
        .catch(function() { return caches.match(req); })
    );
    return;
  }

  // CSS/JS/이미지: stale-while-revalidate (캐시 즉시 반환 + 백그라운드 갱신)
  e.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(req).then(function(cached) {
        var fetchPromise = fetch(req).then(function(res) {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(function() { return cached; });
        return cached || fetchPromise;
      });
    })
  );
});
