// 분석 › 팀 '팀 타구 방향' 3D 보기(js/features/spray3d.js) — 2D | 3D 토글
//  · 3D 를 누를 때만 spray3d.js 를 불러와 <spray-field-3d> 를 붙인다 · 위치 있는 hit/xbh/hr/out 만 · 전광판 = 범위 · 팀 / 안타 · 타구 수
//  · 다시 그려도(범위 · 팀 바꾸기) 같은 요소를 새 상자로 옮긴다(WebGL 장면 1개) · 2D 로 돌아가면 캔버스 방향도
//  · 하네스 크롬은 GPU 를 끈다 — WebGL 이 없어도 통과하도록 그림이 아니라 넘긴 데이터만 본다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var ABS = [
    { bname: '가', bnum: 1, team: 'home', inning: 1, res: '안타', x: 0.5, y: 0.3 },
    { bname: '나', bnum: 2, team: 'home', inning: 1, res: '홈런', x: 0.5, y: 0.0 },
    { bname: '다', bnum: 3, team: 'home', inning: 1, res: '뜬공 아웃', x: 0.3, y: 0.5 },
    { bname: '라', bnum: 4, team: 'home', inning: 2, res: '삼진' },
    { bname: '마', bnum: 1, team: 'away', inning: 1, res: '2루타', x: 0.8, y: 0.4 }
  ];
  async function el3d() {
    for (var i = 0; i < 50; i++) { var e = document.querySelector('#tmField3d spray-field-3d'); if (e && e._balls) return e; await T.sleep(100); }
    return null;
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.setTeamScope && window.shellOpenAnalysis && window.slDash && window.sbPaint, '팀 탭 · 방향도 · 기호 로드');
  });

  test('3D 누르기 → 모듈을 불러와 요소 1개 · 위치 있는 hit/hr/out 3개만 · 전광판 · 토글 상태', async function () {
    window.AS.abs = ABS.slice();
    shellOpenAnalysis('team');
    await T.sleep(50);
    setTeamScope('scope', 'game'); setTeamScope('side', 'home');
    ok(document.getElementById('tmField') && !customElements.get('spray-field-3d'), '처음엔 2D · 3D 모듈 안 불러옴');
    setTeamScope('fv', '3d');
    var e = await el3d();
    ok(e, '3D 요소 없음');
    ok(!document.getElementById('tmField'), '3D 일 때 2D 캔버스 없음');
    eq(e._balls.map(function (b) { return b.k; }), ['hit', 'hr', 'out'], '그릴 타구(삼진 · 원정 2루타 제외)');
    eq(e._board, ['이번 경기 · 홈(우리)', '안타 2 · 타구 3'], '전광판');
    eq([].map.call(document.querySelectorAll('.tm-dir .an-seg button'), function (b) { return b.textContent + ':' + b.getAttribute('aria-pressed'); }), ['2D:false', '3D:true'], '토글');
  });

  test('다시 그려도 같은 요소 · 팀 바꾸면 그 팀 타구', async function () {
    var first = await el3d();
    setTeamScope('side', 'away');
    var e = await el3d();
    ok(e === first, '요소를 새로 만듦');
    eq(e._balls.map(function (b) { return b.k; }), ['xbh'], '원정 타구');
    eq(e._board[0], '이번 경기 · 원정', '전광판 윗줄');
    eq(document.querySelectorAll('spray-field-3d').length, 1, '요소 수');
  });

  test('위치 규칙: 가운데 → 중견 방향(x≈0, z<0) · 펜스 너머 홈런은 펜스(105) 밖', async function () {
    var m = await import('/js/features/spray3d.js?v=4');
    var cf = m.toField(0.5, 0.3, false), hr = m.toField(0.5, 0.0, true);
    ok(Math.abs(cf[0]) < 1e-6 && cf[1] < 0, '중견 — ' + cf);
    ok(Math.hypot(hr[0], hr[1]) > 105, '홈런 — ' + hr);
  });

  test('2D 로 돌아가면 캔버스 방향도 · 3D 요소는 화면에서 빠짐', async function () {
    setTeamScope('fv', '2d');
    await T.sleep(50);
    ok(document.getElementById('tmField'), '2D 캔버스');
    eq(document.querySelectorAll('spray-field-3d').length, 0, '3D 요소');
    window.AS.abs = [];
  });
})();
