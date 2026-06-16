// SprayLab Service Worker - 자동 업데이트 지원
const CACHE_NAME = 'spraylab-v20';
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

// index.html에 주입할 코드 (스크롤 시 탭바 숨김)
const INJECT = '<style>@media(max-width:720px){#app-page.ch .tab-mode-bar{display:none!important}#app-page.ch .pnl-right>.tabs{display:none!important}}</style><script>(function(){var ap=document.getElementById("app-page");var pr=document.querySelector(".pnl-right");if(!ap||!pr)return;var sy=0;pr.addEventListener("touchstart",function(e){sy=e.touches[0].clientY;},{passive:true});pr.addEventListener("touchmove",function(e){if(window.innerWidth>720)return;var dy=sy-e.touches[0].clientY;if(dy>40)ap.classList.add("ch");else if(dy<-40)ap.classList.remove("ch");},{passive:true});setInterval(function(){if(window.innerWidth>720){ap.classList.remove("ch");return;}var s=false;document.querySelectorAll(".tab-pnl").forEach(function(p){if(p.scrollTop>30)s=true;});if(s)ap.classList.add("ch");},200);})();<\/script>';

// 설치: 새 캐시 생성 + 즉시 활성화
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS).catch(function(){});
    })
  );
  self.skipWaiting();
});

// 활성화: 구버전 캐시 삭제
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

// fetch: HTML은 캐시에서 가져온 후 INJECT 코드 삽입
self.addEventListener('fetch', function(e) {
  var req = e.request;
  var url = req.url;
  var isHtml = url.endsWith('/') || url.includes('index.html') ||
               (url.includes('baseball-spray-chart') && !url.includes('.') && !url.includes('?'));

  if (isHtml) {
    e.respondWith(
      caches.match(req).then(function(cached) {
        var src = cached ? Promise.resolve(cached) : fetch(req);
        return src.then(function(res) {
          return res.text().then(function(html) {
            if (html.indexOf('id="app-page"') !== -1 && html.indexOf('SWINJECTED') === -1) {
              html = html.replace('</body>', '<!-- SWINJECTED -->' + INJECT + '</body>');
            }
            return new Response(html, {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(cached) {
      var net = fetch(req).then(function(res) {
        if (res && res.status === 200 && req.method === 'GET') {
          caches.open(CACHE_NAME).then(function(c) { c.put(req, res.clone()); });
        }
        return res;
      }).catch(function() { return cached; });
      return cached || net;
    })
  );
});

// SKIP_WAITING 메시지 처리
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
