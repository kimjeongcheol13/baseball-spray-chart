// 예전 /docs/ 사본의 서비스 워커를 해제하는 용도 (앱은 루트에서 서비스됨)
// 캐시는 루트 앱과 공유되므로 지우지 않음 — 옛 캐시는 루트 sw.js가 정리함
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) {
  e.waitUntil(
    self.registration.unregister()
      .then(function() { return self.clients.matchAll({ type: 'window' }); })
      .then(function(cs) { cs.forEach(function(c) { c.navigate('../'); }); })
  );
});
