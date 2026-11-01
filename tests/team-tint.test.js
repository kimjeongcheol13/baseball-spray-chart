// 분석 › 팀 '선수별 기록' 팀 평균 대비 색 (team.js _rosterCard tint)
//  · 비율 지표만 · 기준 = 팀 합계 줄 · 폭 = 5타석+ 선수들의 표준편차 → 0.5σ+ 연하게(hi1/lo1) · 1σ+ 진하게(hi2/lo2)
//  · 삼진%는 낮을수록 좋음(거꾸로) · 5타석 미만 선수와 누적 지표(경기 · 타석 · 안타 …)는 칠하지 않음
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  function pa(name, num, list) { return list.map(function (res) { return { bname: name, bnum: num, team: 'home', inning: 1, res: res }; }); }
  var rep = function (res, n) { return Array(n).fill(res); };
  var ABS = [].concat(
    pa('강', 1, rep('안타', 6)),                               // 1.000 · 삼진 0%
    pa('중', 2, rep('안타', 3).concat(rep('땅볼 아웃', 3))),   // .500 = 팀 타율
    pa('보', 3, rep('안타', 2).concat(rep('플라이 아웃', 4))),
    pa('약', 4, rep('삼진', 6)),                               // .000 · 삼진 100%
    pa('적', 5, rep('안타', 2))                                // 2타석 — 칠하지 않음
  );
  // 열 순서: 경기 타석 타율 출루율 장타율 OPS wOBA 안타 홈런 타점 볼넷% 삼진%
  function cell(name, i) {
    var row = [].find.call(document.querySelectorAll('.tm-roster tbody tr'), function (r) { return r.querySelector('th b').textContent === name; });
    var c = row.cells[i + 1].className.split(' ').filter(function (x) { return /^(hi|lo)\d$/.test(x); });
    return c[0] || '';
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.setTeamScope && window.shellOpenAnalysis, '팀 탭 로드');
  });

  test('타율: 팀보다 1σ 넘게 좋으면 hi2, 나쁘면 lo2, 팀과 같으면 칠하지 않음 · 5타석 미만 · 누적 지표는 안 칠함', async function () {
    window.AS.abs = ABS.slice();
    shellOpenAnalysis('team');
    await T.sleep(50);
    setTeamScope('scope', 'game'); setTeamScope('side', 'home');
    eq([cell('강', 2), cell('중', 2), cell('약', 2)], ['hi2', '', 'lo2'], '타율');
    eq([cell('적', 2), cell('강', 1), cell('강', 7)], ['', '', ''], '적은 타석 · 타석 · 안타');
    ok(document.querySelector('.tm-roster').closest('.an-card').querySelector('.tm-tint-lg'), '설명(범례)');
  });

  test('삼진%는 낮을수록 좋음: 삼진 100% = lo2, 0% = hi1', function () {
    eq([cell('약', 11), cell('강', 11)], ['lo2', 'hi1'], '삼진%');
  });

  test('5타석+ 선수가 3명 미만이면 아무 칸도 칠하지 않음', async function () {
    window.AS.abs = ABS.filter(function (a) { return a.bname === '강' || a.bname === '약' || a.bname === '적'; });
    setTeamScope('scope', 'game');
    await T.sleep(50);
    eq(document.querySelectorAll('.tm-roster td[class*="hi"], .tm-roster td[class*="lo"]').length, 0, '칠한 칸');
    window.AS.abs = [];
  });
})();
