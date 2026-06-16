// SprayLab Service Worker - 자동 업데이트 지원
const CACHE_NAME = 'spraylab-v19';
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

// 설치: 새 캐시 생성 + 즉시 활성화
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function(){});
    })
  );
  self.skipWaiting(); // 구버전 기다리지 않고 즉시 활성화
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

// fetch: HTML은 네트워크 우선(항상 최신), 나머지는 캐시 우선
self.addEventListener('fetch', function(e) {
  var req = e.request;
  var url = req.url;
  var isHtml = url.endsWith('/') || url.includes('index.html') || (!url.includes('.') && !url.includes('?'));
  if(isHtml){
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.status===200){
          caches.open(CACHE_NAME).then(function(c){c.put(req,res.clone());});
        }
        return res;
      }).catch(function(){ return caches.match(req); })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function(cached){
      var net=fetch(req).then(function(res){
        if(res&&res.status===200&&req.method==='GET'){
          caches.open(CACHE_NAME).then(function(c){c.put(req,res.clone());});
        }
        return res;
      }).catch(function(){return cached;});
      return cached||net;
    })
  );
});

// SKIP_WAITING 메시지 처리 → 즉시 새 SW 활성화
self.addEventListener('message', function(e) {
  if(e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
