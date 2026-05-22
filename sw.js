const CACHE='spraylab-v6';
const CDN_URLS=[
  'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// 설치: CDN 파일만 미리 캐시 (index.html은 캐시 안 함 → 항상 최신)
// 개별 캐시 — 하나 실패해도 SW 설치 전체가 중단되지 않음
self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>{
      return Promise.allSettled(CDN_URLS.map(url=>c.add(url).catch(()=>{})));
    }).then(()=>self.skipWaiting())
  );
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;

  // HTML 페이지: 항상 네트워크에서 최신 버전 로드 (오프라인 시에만 캐시)
  if(e.request.mode==='navigate'){
    e.respondWith(
      fetch(e.request)
        .catch(()=>caches.match('/baseball-spray-chart/index.html'))
    );
    return;
  }

  // CDN/기타: 캐시 우선 (없으면 네트워크 → 캐시에 저장)
  e.respondWith(
    caches.match(e.request).then(r=>{
      if(r)return r;
      return fetch(e.request).then(res=>{
        if(!res||res.status!==200)return res;
        var clone=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,clone));
        return res;
      }).catch(()=>caches.match('/baseball-spray-chart/index.html'));
    })
  );
});
