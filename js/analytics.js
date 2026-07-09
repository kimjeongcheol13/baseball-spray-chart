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
})();
