// SprayLab Service Worker v12 — 항상 네트워크 우선, 캐시 없음
// 캐시 우선 전략이 구버전 index.html을 계속 반환하는 문제를 영구 제거
const CACHE_NAME = 'spraylab-v12';

// 설치: 기존 캐시 제거 후 즉시 활성화
self.addEventListener('install', function(e) {
  self.skipWaiting();
});

// 활성화: 모든 구버전 캐시 삭제 후 즉시 페이지 제어 획득
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// fetch: 항상 네트워크에서 가져옴 (캐시 사용 안 함)
// 데이터는 localStorage에 보관되므로 오프라인 캐시 불필요
self.addEventListener('fetch', function(e) {
  e.respondWith(
    fetch(e.request).catch(function() {
      // 네트워크 오류 시에만 캐시 폴백 (오프라인 대비)
      return caches.match(e.request);
    })
  );
});
