// 라인업 줄의 ✕(선수 삭제)가 '주전/후보' 버튼을 덮지 않는다 — 마우스(데스크톱) 화면
//  · 예전엔 ✕ 가 행 오른쪽에 떠 있어(absolute · 평소 투명) '주전' 버튼 자리에 있었고, '주전'을 누르면 선수가 확인 없이 지워졌다 (터치는 paper.css pointer: coarse 에서 이미 고침)
// @window 1280,860
// @pointer fine
(function () {
  var T = window.__T, ok = T.ok, test = T.test, $ = T.$;

  test('데스크톱 라인업 줄: ✕ 는 주전 버튼 오른쪽에 따로 있다 (겹치지 않는다)', async function () {
    var keep = { home: AS.home_lineup, cur: AS.curTeam };
    try {
      AS.curTeam = 'home';
      AS.home_lineup = [{ id: 'ov1', name: '김투수', num: '11', pos: '투수', bh: '', isStarter: true }, { id: 'ov2', name: '박포수', num: '22', pos: '', bh: '', isStarter: false }];
      renderLP();
      shellDrawer(true);
      await T.sleep(400);
      var rows = [].filter.call($('lpList').querySelectorAll('.player-row'), function (r) { return r.getBoundingClientRect().width > 0; });
      ok(rows.length === 2, '라인업 줄 2개가 그려져야 한다: ' + rows.length);
      rows.forEach(function (r, i) {
        var s = r.querySelector('.starter-btn').getBoundingClientRect(), d = r.querySelector('.p-del').getBoundingClientRect();
        ok(d.left >= s.right, (i + 1) + '번 줄: ✕(' + Math.round(d.left) + '~' + Math.round(d.right) + ')가 주전 버튼(' + Math.round(s.left) + '~' + Math.round(s.right) + ')을 덮는다');
      });
    } finally {
      try { shellDrawer(false); } catch (e) {}
      AS.home_lineup = keep.home; AS.curTeam = keep.cur;
      renderLP();
    }
  });
})();
