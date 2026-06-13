// SprayLab Service Worker - 자동 업데이트 지원
const CACHE_NAME = 'spraylab-v11';
const ASSETS = [
  '/baseball-spray-chart/',
  '/baseball-spray-chart/index.html',
  '/baseball-spray-chart/manifest.json',
  '/baseball-spray-chart/icon.svg',
  '/baseball-spray-chart/css/styles.css',
  '/baseball-spray-chart/css/features.css',
  '/baseball-spray-chart/js/core.js',
  '/baseball-spray-chart/js/app.js',
  '/baseball-spray-chart/js/features/profile.js',
  '/baseball-spray-chart/js/features/compare.js',
  '/baseball-spray-chart/js/features/scouting.js',
  '/baseball-spray-chart/js/features/heatmap.js',
  '/baseball-spray-chart/js/features/filter.js',
  '/baseball-spray-chart/js/features/insights.js',
  '/baseball-spray-chart/js/features/perf.js'
];

// 설치: 새 캐시 생성
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function(){});
    })
  );
  // SKIP_WAITING 메시지 받으면 즉시 활성화
  // (index.html에서 postMessage로 요청)
});

// 활성화: 구버전 캐시 삭제 (localStorage는 건드리지 않음)
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// fetch: 캐시 우선, 없으면 네트워크
self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetchPromise = fetch(e.request).then(function(response) {
        if(response && response.status === 200 && e.request.method === 'GET') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});

// SKIP_WAITING 메시지 처리 → 즉시 새 SW 활성화
self.addEventListener('message', function(e) {
  if(e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
