(function(){
  var GA_ID = 'G-M0XVPN7YC1';

  // 익명 UUID — 첫 방문 시 생성, 재방문 시 재사용
  var userId;
  try {
    userId = localStorage.getItem('spraylab_uid');
    if (!userId) {
      userId = (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      }));
      localStorage.setItem('spraylab_uid', userId);
    }
  } catch(e) { userId = null; }

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, userId ? { user_id: userId } : {});

  // landing_view — 랜딩 진입 시 1회, UTM 파라미터가 있으면 함께 전송
  try {
    var qs = new URLSearchParams(window.location.search);
    var evParams = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function(k) {
      var v = qs.get(k);
      if (v) evParams[k] = v;
    });
    if (typeof gtag === 'function') gtag('event', 'landing_view', evParams);
  } catch(e) {}

  // 방문 수 (GA4 없이 셀 수 있게) — 이 기기에서 하루 한 번 익명 ID 만 Supabase log_visit 로 (sql/17_log_visit.sql)
  //  · 보내는 것: 위 익명 ID · 앱(a)/소개 페이지(l) · 폰(m)/컴퓨터(d). 이름 · 기록은 안 보낸다
  //  · 배포 주소(github.io)에서만, 자동화 브라우저(시험 · 봇)는 빼고. 실패하면 다음에 열 때 다시
  try {
    var day = new Date().toLocaleDateString('sv');   // 기기 시간대의 YYYY-MM-DD
    if (userId && /\.github\.io$/.test(location.hostname) && !navigator.webdriver
        && localStorage.getItem('sl_visit_day') !== day) {
      var SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWJybmdrcHNkbWJ3b3FjcnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTE1OTcsImV4cCI6MjA5NDk4NzU5N30.kVkKSvrXMtVOEtTNEELr8_9bQret60pTngFRsHgY5nk';
      var kind = (/landing\.html$/.test(location.pathname) ? 'l' : 'a') + (matchMedia('(pointer: coarse)').matches ? 'm' : 'd');
      fetch('https://bsmbrngkpsdmbwoqcrps.supabase.co/rest/v1/rpc/log_visit', {
        method: 'POST', keepalive: true,
        headers: { apikey: SKEY, Authorization: 'Bearer ' + SKEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_uid: userId, p_kind: kind })
      }).then(function(r) { if (r.ok) localStorage.setItem('sl_visit_day', day); }).catch(function() {});
    }
  } catch(e) {}
})();
