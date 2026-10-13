// 마우스 데스크톱에서는 타석 기록 수정 창 배치가 그대로여야 한다 — 가로로 든 폰 수정(shell.css 의 터치 기기 조건)이 데스크톱 스타일로 새지 않는지
// (CLAUDE.md: 데스크톱 스타일은 건드리지 않는다). edit-dialog-landscape.test.js 와 같은 창 크기에서 입력 장치만 마우스다(아래 @window · @pointer 줄).
// @window 844,480
// @pointer fine
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var ID = 1782000000202;

  test('마우스 데스크톱(폭 > 720px): 수정 창 영역 · 높이 제한은 그대로다', async function () {
    var a = window.AS, keep = { abs: a.abs, sk: window._curSaveKey };
    try {
      await sleep(2500);   // 앱 시작 작업(마지막 경기 열기 등)이 끝난 뒤
      ok(innerWidth > 720 && !matchMedia('(any-pointer: coarse)').matches, '전제: 폭 720px 초과 · 마우스만 있는 창이어야 함(@window · @pointer) — 창 ' + innerWidth + '×' + innerHeight);
      AS.abs = [{ id: ID, bid: 'p1', bname: '마우스타자', bnum: 9, res: '안타', inn: '1회초', team: 'home', rbi: 0, x: 0.5, y: 0.4, deg: 90, dir: 'CF' }];
      window._curSaveKey = null; updateAll();
      openEditRec(ID); await sleep(100);
      eq($('editRecOverlay').classList.contains('show'), true, '수정 창이 열려야 함');
      var ov = getComputedStyle($('editRecOverlay')), md = getComputedStyle($('editRecOverlay').querySelector('.modal'));
      eq([ov.bottom, md.maxHeight, md.overflowY], ['0px', 'none', 'visible'], '수정 창은 화면 전체 기준 · 높이 제한 없음(지금과 같음)');
    } finally {
      a.abs = keep.abs; window._curSaveKey = keep.sk;
      try { closeOverlay('editRecOverlay'); } catch (e) {}
      try { updateAll(); } catch (e) {}
    }
  });
})();
