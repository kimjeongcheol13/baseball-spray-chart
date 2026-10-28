// 휴대폰(터치 · 좁은 화면)에서 라인업 창을 연 채 선수 ✕ → 토스트 '되돌리기'가 눌린다 — 맨 위 요소가 버튼이어야 한다
//  · 예전엔 토스트(z 396)가 라인업 창(.ld 450 · 배경 440) 아래에 깔려, 되돌리기를 누르면 배경이 받아 창만 닫혔다 (데스크톱은 lineup-del-overlap.test.js)
// @window 390,844
// @pointer coarse
(function () {
  var T = window.__T, ok = T.ok, test = T.test, $ = T.$;

  test('휴대폰 라인업 창: ✕ 뒤 되돌리기 자리의 맨 위 요소가 버튼이고, 누르면 선수가 돌아온다', async function () {
    var keep = { home: AS.home_lineup, cur: AS.curTeam, b: AS.batter };
    try {
      AS.curTeam = 'home';
      AS.home_lineup = [{ id: 'm1', name: '김일번', num: '1', pos: '', bh: '' }, { id: 'm2', name: '박이번', num: '2', pos: '', bh: '' }];
      shellDrawer(true);
      await T.sleep(400);
      delPlayer('m1', { stopPropagation: function () {} });
      await T.sleep(400);   // 토스트가 올라오는 동안(280ms) 기다린다
      var r = $('toastUndo').getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      ok(r.width > 0, '되돌리기 버튼이 그려져야 한다');
      ok(top === $('toastUndo'), '되돌리기 자리의 맨 위 요소가 버튼이어야 한다: ' + (top && (top.id || top.className)));
      if (top) top.click();
      ok(AS.home_lineup.map(function (p) { return p.id; }).join() === 'm1,m2', '선수가 1번 자리로 돌아와야 한다: ' + AS.home_lineup.map(function (p) { return p.id; }));
      ok($('lineupDrawer').classList.contains('open'), '라인업 창은 열린 채로 있어야 한다');
    } finally {
      hideToast();
      try { shellDrawer(false); } catch (e) {}
      AS.home_lineup = keep.home; AS.curTeam = keep.cur; AS.batter = keep.b;
      renderLP();
    }
  });
})();
