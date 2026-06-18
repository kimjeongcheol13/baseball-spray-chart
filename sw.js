// SprayLab Service Worker v20
// 전략: HTML = 네트워크 우선 + 캐시 저장(오프라인 폴백용)
//        CSS/JS/이미지 = stale-while-revalidate (캐시 즉시 반환 + 백그라운드 갱신)
const CACHE_NAME = 'spraylab-v28';

// 설치 시 사전 캐싱할 핵심 로컬 파일 목록
// (버전 쿼리 없는 경로 — 런타임에 ?v= 버전드 요청이 들어오면 stale-while-revalidate로 추가 캐싱됨)
const CACHE_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './css/features.css',
  './js/core.js',
  './js/app.js',
  './js/ocr.js',
  './js/constants.js',
  './js/analytics.js',
  './player-logo.png',
  './manifest.json',
];

// 페이지에서 SKIP_WAITING 메시지 수신 시 즉시 활성화
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // allSettled: 일부 실패(예: CDN 리소스)해도 설치 중단하지 않음
      return Promise.allSettled(
        CACHE_FILES.map(function(url) { return cache.add(url); })
      );
    })
  );
});

self.addEventListener('activate', function(e) {
  // 구버전 캐시 삭제, 현재 캐시 유지
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
      .then(function() {
        // 새 SW가 활성화되면 열려 있는 모든 페이지에 알림 → 페이지가 깨끗하게 새로고침
        return self.clients.matchAll({ type: 'window' }).then(function(clients) {
          clients.forEach(function(client) {
            client.postMessage({ type: 'SW_ACTIVATED' });
          });
        });
      })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;

  // GET 요청만 처리 — Supabase POST/WebSocket 등은 SW 통과 (silent pass-through)
  if (req.method !== 'GET') return;

  // HTML 네비게이션: 네트워크 우선, 성공 시 캐시에도 저장, 실패 시 캐시 폴백
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(new Request(req, { cache: 'no-cache' }))
        .then(function(res) {
          if (res && res.status === 200) {
            return res.text().then(function(html) {
              // SVG 로고를 이미지로 강제 교체
              html = html.replace(
                /<svg class="nav-logo"[\s\S]*?<\/svg>/,
                '<img class="nav-logo" src="player-logo.png" alt="SprayLab">'
              );
              html = html.replace(
                /<svg class="aw-logo-icon"[\s\S]*?<\/svg>/,
                '<img class="aw-logo-icon" src="player-logo.png" alt="SprayLab">'
              );
              var newRes = new Response(html, {
                status: res.status,
                statusText: res.statusText,
                headers: {'Content-Type': 'text/html; charset=utf-8'}
              });
              caches.open(CACHE_NAME).then(function(cache) { cache.put(req, newRes.clone()); });
              return newRes;
            });
          }
          return res;
        })
        .catch(function() {
          // 오프라인 폴백: 정확한 URL → index.html → 루트 순서로 탐색
          return caches.match(req)
            .then(function(r) { return r || caches.match('./index.html'); })
            .then(function(r) { return r || caches.match('./'); });
        })
    );
    return;
  }

  // CSS / JS / 이미지: stale-while-revalidate
  // 캐시에 있으면 즉시 반환 + 백그라운드에서 최신 버전 갱신
  e.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(req).then(function(cached) {
        var fetchPromise = fetch(req).then(function(res) {
          if (res && res.status === 200) {
            cache.put(req, res.clone());
            // ?v= 버전드 에셋: 동일 pathname의 구버전 항목 자동 정리
            var url = new URL(req.url);
            if (url.search) {
              cache.keys().then(function(entries) {
                entries.forEach(function(entry) {
                  var eu = new URL(entry.url);
                  if (eu.pathname === url.pathname && eu.search !== url.search) {
                    cache.delete(entry);
                  }
                });
              });
            }
          }
          return res;
        }).catch(function() { return cached; }); // 오프라인 시 캐시 반환

        return cached || fetchPromise;
      });
    })
  );
});
