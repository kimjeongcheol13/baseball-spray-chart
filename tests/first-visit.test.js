// 루트 첫 화면 → landing.html (index.html <head> 맨 앞 스크립트). 이 페이지에 들어 있는 그 스크립트를 떼어 가짜 주소 · 저장소로 돌려 본다
// 규칙: 모든 기기 · 설치 앱, 기록이 있어도 랜딩. 앱 링크 파라미터 · # · 이 탭에서 앱을 연 적 있음(sl_in_app)이면 앱
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;

  // 경우마다 [이름, 주소 ?, 주소 #, sessionStorage, 기대 이동 주소(null = 그대로 앱)]
  var CASES = [
    ['맨 주소', '', '', {}, 'landing.html'],
    ['utm_ 홍보 링크 → 그대로 넘김', '?utm_source=ig&utm_medium=bio', '', {}, 'landing.html?utm_source=ig&utm_medium=bio'],
    ['인스타 · 페북이 붙이는 fbclid → 그대로 넘김', '?fbclid=abc', '', {}, 'landing.html?fbclid=abc'],
    ['랜딩 버튼: 게임원 기록 가져오기 (?go=1)', '?go=1', '', {}, null],
    ['랜딩 버튼: 앱 바로 열기 (?app=1)', '?app=1', '', {}, null],
    ['공유 경기 링크 ?game=', '?game=bxyz', '', {}, null],
    ['공유 짧은 링크 ?gid=', '?gid=abc', '', {}, null],
    ['팀 링크 ?team=', '?team=z123', '', {}, null],
    ['가져오기 링크 ?import=', '?import=abc', '', {}, null],
    ['구글 로그인 복귀 ?code=', '?code=abc', '', {}, null],
    ['로그인 실패 복귀 ?error=', '?error=access_denied&error_description=x', '', {}, null],
    ['디버그 ?debug=1', '?debug=1', '', {}, null],
    ['utm_ + 공유 링크', '?utm_source=ig&game=x', '', {}, null],
    ['# 공유 링크', '', '#share=abc', {}, null],
    ['# 로그인 토큰', '', '#access_token=abc', {}, null],
    ['이 탭에서 앱을 연 적 있음 (?go=1 이 지워진 뒤 새로고침)', '', '', { sl_in_app: '1' }, null]
  ];

  test('루트 첫 화면: 주소 · 탭 상태마다 landing.html 로 보내거나 앱에 남는다', async function () {
    var src = [].map.call(document.head.querySelectorAll('script:not([src])'), function (s) { return s.textContent; })
      .filter(function (t) { return t.indexOf("location.replace('landing.html'") >= 0; });
    eq(src.length, 1, 'index.html 에서 첫 화면 이동 스크립트를 찾음');
    ok(src[0].indexOf('localStorage') < 0, '기록(localStorage)은 보지 않는다 — 기록이 있어도 랜딩');
    var run = new Function('location', 'sessionStorage', 'document', src[0]);
    CASES.forEach(function (c) {
      var to = null, wrote = [], ss = Object.assign({}, c[3]);
      run({ search: c[1], hash: c[2], replace: function (u) { to = u; } }, ss, { write: function (h) { wrote.push(h); } });
      eq(to, c[4], c[0] + ': 이동 주소');
      if (to) eq(wrote, ['<plaintext hidden>'], c[0] + ': 아래 스크립트(GA · 앱)를 막음');
      else ok(ss.sl_in_app, c[0] + ': 이 탭에서 앱을 열었다고 표시');
    });
  });

  test('루트 첫 화면: index.html 이 그려지면 기기와 상관없이 옛 랜딩 없이 바로 앱 (core.js autoSkipLanding)', async function () {
    eq($('landing-page').style.display, 'none', '옛 랜딩 #landing-page 숨김');
    ok($('app-page').style.display !== 'none', '앱 화면 표시');
    var src = await (await fetch('/js/core.js')).text();
    ok(/function goLanding\(\)\{location\.href='landing\.html';\}/.test(src), '처음 화면으로(goLanding) = 새 소개 페이지 landing.html');
  });
})();
