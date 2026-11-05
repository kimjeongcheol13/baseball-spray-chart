// 앱 「의견 보내기」(fieldFeedbackSubmit) — 실제로 받는 곳(Formspree · Supabase feedback 표)으로만 보낸다
//  · 설정된 적 없는 Google Forms 주소(docs.google.com/forms/.../REPLACE_FORM_ID)로 사용자 글을 보내지 않는다
(function () {
  var T = window.__T, eq = T.eq, test = T.test, sleep = T.sleep;

  test('의견 보내기: Formspree · Supabase 로만 보내고 docs.google.com 으로는 아무것도 안 보낸다', async function () {
    var urls = [], db = [], f0 = window.fetch, c0 = window.supabase.createClient;
    window.fetch = function (url) {
      urls.push(String(url));
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
    };
    window.supabase.createClient = function () {
      return { from: function (t) { return { insert: function (rows) { db.push(t); return Promise.resolve({ error: null }); } }; } };
    };
    try {
      localStorage.removeItem('sl_fb_sent');   // 봇 경비(#350)의 "방금 보냄" 기록 — 없으면 아무 일 없음
      fieldFeedbackOpen();
      document.getElementById('ffmText').value = '타구 점이 안 찍혀요';
      _ffmOpenedAt = Date.now() - 60000;        // 봇 경비의 "너무 빠름" 검사를 넘긴다 — 봇 경비가 없으면 쓰이지 않는 값
      fieldFeedbackSubmit();
      var m = document.getElementById('fieldFeedbackModal');
      for (var i = 0; i < 40 && m.classList.contains('show'); i++) await sleep(25);
      eq(urls.filter(function (u) { return u.indexOf('formspree.io') >= 0; }).length, 1, 'Formspree 한 번');
      eq(db, ['feedback'], 'Supabase feedback 표 한 번');
      eq(urls.filter(function (u) { return u.indexOf('docs.google.com') >= 0; }), [], 'Google Forms 로 간 요청');
    } finally {
      window.fetch = f0; window.supabase.createClient = c0;
      fieldFeedbackClose(); localStorage.removeItem('sl_fb_sent');
    }
  });
})();
