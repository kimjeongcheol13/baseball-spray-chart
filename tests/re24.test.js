// RE24 — 타석 하나가 바꾼 기대득점 (runners.js re24, MLB 기대득점표) · 분석 › 팀 선수별 표 RE24 칸 · 타자 카드 한 줄
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var E = [false, false, false];
  function pa(name, res, outs, bases, extra) {
    return Object.assign({ bname: name, bnum: 1, team: 'home', res: res, inn: '1회초', gfPre: { inning: 1, half: 'top', outs: outs, batterIdx: 0, bases: bases } }, extra || {});
  }
  var r3 = function (v) { return v == null ? v : Math.round(v * 1000) / 1000; };
  // 가 = 홈런(+1.0) + 삼진(−0.218) · 나 = 1루 1아웃 병살(−0.489) · 다 = 경기 운영 모드가 아닌 타석뿐
  var ABS = [pa('가', '홈런', 0, E), pa('가', '삼진', 0, E), pa('나', '병살', 1, [true, false, false]), { bname: '다', bnum: 3, team: 'home', res: '안타', inn: '2회초' }];

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.gfRe24 && window.gfRe24Sum && window.gfRe24Txt && window.setTeamScope && window.setBatterView, 'RE24 · 분석 함수 로드');
  });

  test('타석 하나의 RE24 = 끝난 뒤 기대득점 − 직전 기대득점 + 득점', function () {
    eq(r3(gfRe24(pa('a', '홈런', 0, E))), 1, '빈 베이스 0아웃 홈런 = 1점');
    eq(r3(gfRe24(pa('a', '안타', 0, [true, false, false]))), r3(1.373 - 0.831), '1루 0아웃 안타 → 1 · 2루');
    eq(r3(gfRe24(pa('a', '삼진', 0, E))), r3(0.243 - 0.461), '빈 베이스 0아웃 삼진');
    eq(r3(gfRe24(pa('a', '병살', 1, [true, false, false]))), -0.489, '1루 1아웃 병살 = 이닝 끝 (0)');
    eq(r3(gfRe24(pa('a', '희비', 1, [false, false, true]))), r3(0.095 - 0.865 + 1), '3루 1아웃 희생플라이');
    eq(r3(gfRe24(pa('a', '야수선택', 0, [true, false, false], { fco: 0 }))), r3(0.489 - 0.831), '1루 주자 아웃 야수선택 → 타자 1루 1아웃');
    eq(r3(gfRe24(pa('a', '볼넷', 2, [true, true, true]))), r3(0.736 - 0.736 + 1), '만루 볼넷 = 밀어내기 1점');
    eq(gfRe24({ res: '안타' }), null, '경기 운영 모드가 아닌 타석');
    eq(gfRe24Sum([{ res: '안타' }]), null, '합계: 계산할 타석이 없으면 null');
    eq([1.234, -0.46, 0.02, null].map(gfRe24Txt), ['+1.2', '−0.5', '0.0', '-'], '표시');
  });

  test('팀 선수별 표: 마지막 칸 RE24 = 선수별 합 · 팀 합계 · 경기 운영 타석이 없으면 -', async function () {
    var keep = window.AS.abs;
    try {
      window.AS.abs = ABS.slice();
      shellOpenAnalysis('team');
      await T.sleep(50);
      setTeamScope('scope', 'game'); setTeamScope('side', 'home');
      await T.sleep(50);
      var head = [].map.call(document.querySelectorAll('.tm-roster thead th'), function (th) { return th.textContent.replace(/[▼▲]/g, '').trim(); });
      eq(head[head.length - 1], 'RE24', '마지막 머리 칸');
      ok(document.querySelector('.tm-roster thead th:last-child button').title.indexOf('경기 운영 모드') >= 0, '설명(title)');
      var got = {};
      [].forEach.call(document.querySelectorAll('.tm-roster tbody tr'), function (r) { got[r.querySelector('th b').textContent] = r.cells[r.cells.length - 1].textContent; });
      eq(got, { '가': '+0.8', '나': '−0.5', '다': '-' }, '선수별 RE24');
      var foot = document.querySelector('.tm-roster tfoot tr');
      eq(foot.cells[foot.cells.length - 1].textContent, '+0.3', '팀 합계');
    } finally { window.AS.abs = keep; }
  });

  test('타자 카드: 시즌 칸에 RE24 한 줄 · 경기 운영 타석이 없는 타자는 없음', async function () {
    var keep = window.AS.abs;
    try {
      window.AS.abs = ABS.slice();
      shellOpenAnalysis('batter');
      await T.sleep(50);
      setBatterView('side', 'home'); setBatterView('scope', 'game'); setBatterView('sel', '가');
      await T.sleep(50);
      var em = document.querySelector('#batterView .bt-season .bt-re24');
      ok(em, 'RE24 줄 없음');
      eq(em.textContent, 'RE24 +0.8 · 2타석', 'RE24 줄');
      setBatterView('sel', '다');
      await T.sleep(50);
      ok(!document.querySelector('#batterView .bt-re24'), '경기 운영 타석이 없는데 RE24 줄이 있음');
      shellOpenAnalysis('team');
      await T.sleep(50);
    } finally { window.AS.abs = keep; }
  });
})();
