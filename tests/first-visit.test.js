// 첫 방문 → landing.html (index.html <head> 맨 앞 스크립트). 이 페이지에 들어 있는 그 스크립트를 떼어 가짜 주소 · 저장소로 돌려 본다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;

  // 경우마다 [이름, 주소 ?, 주소 #, localStorage, sessionStorage, 설치 앱(display-mode) , iOS 설치 앱, 기대 이동 주소(null = 그대로 앱)]
  var CASES = [
    ['첫 방문', '', '', {}, {}, false, false, 'landing.html'],
    ['utm_ 만 붙은 홍보 링크 → utm 그대로 넘김', '?utm_source=ig&utm_medium=bio', '', {}, {}, false, false, 'landing.html?utm_source=ig&utm_medium=bio'],
    ['저장 경기 목록이 비어 있으면 첫 방문', '', '', { sl_saves: '[]' }, {}, false, false, 'landing.html'],
    ['?go=1 (랜딩 버튼)', '?go=1', '', {}, {}, false, false, null],
    ['utm_ + 다른 ?', '?utm_source=ig&game=x', '', {}, {}, false, false, null],
    ['# 공유 링크', '', '#share=abc', {}, {}, false, false, null],
    ['저장 경기 있음', '', '', { sl_saves: '[{"key":"sl_1"}]' }, {}, false, false, null],
    ['첫 기록을 한 적 있음', '', '', { sl_ftu_done: '1' }, {}, false, false, null],
    ['진행 중 자동저장 있음', '', '', { sl_autosave: '{}' }, {}, false, false, null],
    ['로그인함', '', '', { sl_cloud_session: '{}' }, {}, false, false, null],
    ['이 탭에서 앱을 연 적 있음 (?go=1 이 지워진 뒤 새로고침)', '', '', {}, { sl_in_app: '1' }, false, false, null],
    ['홈 화면 앱', '', '', {}, {}, true, false, null],
    ['홈 화면 앱 (iOS)', '', '', {}, {}, false, true, null]
  ];

  test('첫 방문 이동: 조건마다 landing.html 로 보내거나 앱에 남는다', async function () {
    var src = [].map.call(document.head.querySelectorAll('script:not([src])'), function (s) { return s.textContent; })
      .filter(function (t) { return t.indexOf("location.replace('landing.html'") >= 0; });
    eq(src.length, 1, 'index.html 에서 첫 방문 이동 스크립트를 찾음');
    var run = new Function('location', 'sessionStorage', 'localStorage', 'matchMedia', 'navigator', 'document', src[0]);
    CASES.forEach(function (c) {
      var to = null, wrote = [], ss = Object.assign({}, c[4]);
      run({ search: c[1], hash: c[2], replace: function (u) { to = u; } }, ss, Object.assign({}, c[3]),
        function (q) { return { matches: c[5] && q.indexOf('standalone') >= 0 }; }, { standalone: c[6] }, { write: function (h) { wrote.push(h); } });
      eq(to, c[7], c[0] + ': 이동 주소');
      if (to) eq(wrote, ['<plaintext hidden>'], c[0] + ': 아래 스크립트(GA · 앱)를 막음');
      else ok(ss.sl_in_app, c[0] + ': 이 탭에서 앱을 열었다고 표시');
    });
  });

  test('첫 방문 이동: 이 테스트 페이지(?f=)는 앱에 남고, 탭에 표시가 남는다', async function () {
    eq(sessionStorage.getItem('sl_in_app'), '1', 'sessionStorage sl_in_app');
  });
})();
