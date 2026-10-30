// 분석 › 팀 '팀 타구 방향' — 구역별 내야 · 외야 타구 수 표(dashboard.js _zoneDepth → team.js _dirCard)
//  · 내야 = 필드 그림의 내야 흙 안 · 펜스 너머 홈런 · 깊은 뜬공은 외야 · 두 줄의 합 = 구역별 타구 수
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var ABS = [
    { bname: '가', bnum: 1, team: 'home', inning: 1, res: '땅볼 아웃', x: 0.5, y: 0.75 },   // 중 · 흙
    { bname: '나', bnum: 2, team: 'home', inning: 1, res: '홈런', x: 0.5, y: 0.0 },        // 중 · 펜스 너머
    { bname: '가', bnum: 1, team: 'home', inning: 3, res: '뜬공 아웃', x: 0.3, y: 0.5 },   // 좌중 · 외야
    { bname: '라', bnum: 4, team: 'home', inning: 2, res: '안타', x: 0.35, y: 0.8 },       // 좌 · 흙
    { bname: '마', bnum: 5, team: 'home', inning: 2, res: '2루타', x: 0.8, y: 0.4 },       // 우중 · 외야
    { bname: '바', bnum: 6, team: 'home', inning: 2, res: '삼진' }                         // 위치 없음
  ];
  function cells(sel) { return [].map.call(document.querySelectorAll(sel), function (c) { return c.textContent.trim(); }); }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.setTeamScope && window.shellOpenAnalysis && window.slDash && window.slDash.zoneDepth, '팀 탭 · zoneDepth 로드');
  });

  test('zoneDepth: 흙 안 = 내야 · 홈런 · 깊은 타구 = 외야 · 합 = zoneCounts', function () {
    var d = window.slDash.zoneDepth(ABS), c = window.slDash.zoneCounts(ABS);
    eq(d.map(function (z) { return [z.inf, z.of]; }), [[1, 0], [0, 1], [1, 1], [0, 1], [0, 0]], '구역별 [내야, 외야]');
    eq(d.map(function (z) { return z.inf + z.of; }), c, '두 줄의 합');
  });

  test('팀 타구 방향 카드: 비율 띠 아래 표 · 빈 칸은 흐리게', async function () {
    window.AS.abs = ABS.slice();
    shellOpenAnalysis('team');
    await T.sleep(50);
    setTeamScope('scope', 'game'); setTeamScope('side', 'home'); setTeamScope('fv', '2d');
    await T.sleep(50);
    var t = document.querySelector('.tm-dir .ad-depth');
    ok(t, '표 없음');
    ok(t.previousElementSibling && t.previousElementSibling.classList.contains('ad-band'), '비율 띠 바로 아래');
    eq(cells('.tm-dir .ad-depth thead th'), ['깊이', '좌', '좌중', '중', '우중', '우'], '머리줄');
    eq(cells('.tm-dir .ad-depth tbody tr:first-child > *'), ['내야', '1', '0', '1', '0', '0'], '내야 줄');
    eq(cells('.tm-dir .ad-depth tbody tr:last-child > *'), ['외야', '0', '1', '1', '1', '0'], '외야 줄');
    eq(document.querySelectorAll('.tm-dir .ad-depth td.z').length, 5, '0 칸 흐리게');
  });

  test('타자 탭 타구 방향 카드: 그 타자 타구만 같은 표 · 방향 막대 아래', async function () {
    shellOpenAnalysis('batter');
    await T.sleep(50);
    setBatterView('side', 'home'); setBatterView('scope', 'game'); setBatterView('sel', '가');
    await T.sleep(50);
    var t = document.querySelector('#batterView .ad-depth');
    ok(t, '표 없음');
    ok(t.previousElementSibling && t.previousElementSibling.classList.contains('bt-spray'), '스프레이 그림 바로 아래');
    eq(cells('#batterView .ad-depth tbody tr:first-child > *'), ['내야', '0', '0', '1', '0', '0'], '내야 줄');
    eq(cells('#batterView .ad-depth tbody tr:last-child > *'), ['외야', '0', '1', '0', '0', '0'], '외야 줄');
    setBatterView('sel', '바');
    await T.sleep(50);
    ok(!document.querySelector('#batterView .ad-depth'), '방향 없는 타자인데 표가 남음');
    shellOpenAnalysis('team');
    await T.sleep(50);
  });

  test('방향 있는 타구가 없으면 표도 없음', async function () {
    window.AS.abs = [ABS[5]];
    setTeamScope('side', 'home');
    await T.sleep(50);
    ok(document.querySelector('.tm-dir .ad-none'), '빈 안내');
    ok(!document.querySelector('.tm-dir .ad-depth'), '표가 남음');
    window.AS.abs = [];
  });
})();
