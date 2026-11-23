// 동작 분석 — 사용 기록 (js/motion/usage.js): 배포 주소에서만 · 자동화 브라우저에서는 보내지 않는다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  test('사용 기록: github.io 에서만, 시험 · 봇 브라우저에서는 끈다 · 시험 페이지에서는 아무것도 보내지 않는다', async function () {
    var U = await import('/js/motion/usage.js?v=1');
    eq([U.usageAllowed('kimjeongcheol13.github.io', false), U.usageAllowed('kimjeongcheol13.github.io', true), U.usageAllowed('127.0.0.1', false), U.usageAllowed('evil-github.io.example.com', false)], [true, false, false, false], 'usageAllowed');
    // 시험 페이지(앱 화면)에는 앱의 GA 가 이미 있을 수 있다 → 이 모듈이 더 붙이지 않는지만 본다
    var count = function () { return document.querySelectorAll('script[src*="googletagmanager"]').length; }, before = count(), layer = (window.dataLayer || []).length;
    U.startUsage(); U.track('motion_test', { a: 1 });
    eq(count(), before, '시험 페이지에서는 GA 스크립트를 더 붙이지 않는다');
    eq((window.dataLayer || []).length, layer, '보내는 것도 없다');
  });
})();
