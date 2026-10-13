// 가로로 든 휴대폰(터치 · 폭 720px 초과 · 낮은 화면)에서 타석 기록 수정 창의 「저장」이 하단 탭(z 400)에 가리지 않아야 한다.
// 배경: #141 은 폭 720px 이하만 고쳤다. 가로로 든 폰은 대개 폭이 그보다 넓어(예: 844×390) 데스크톱 CSS 를 받아 「저장」이 하단 탭 뒤 · 화면 아래로 나갔다.
// 이 파일은 가로 폰 크기의 터치 기기로 돈다(아래 @window · @pointer 줄 — 러너가 읽는다. 윈도우 818×324 · 리눅스 844×480).
// @window 844,480
// @pointer coarse
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var ID = 1782000000201;

  // rec-sheet-edit.test.js 와 같은 확인: 수정 창 안을 스크롤해 버튼을 보이게 한 뒤 위 · 가운데 · 아래가 모두 맨 위인지(다른 것이 덮고 있지 않은지)
  function onTop(sel) {
    var b = document.querySelector(sel); if (!b) return 'no-button';
    b.scrollIntoView({ block: 'nearest' });
    var r = b.getBoundingClientRect(), x = r.left + r.width / 2, ys = [r.top + 2, r.top + r.height / 2, r.bottom - 2];
    for (var i = 0; i < ys.length; i++) {
      if (x < 0 || ys[i] < 0 || x >= innerWidth || ys[i] >= innerHeight) return 'off-screen (창 ' + innerWidth + '×' + innerHeight + ', 점 ' + Math.round(x) + ',' + Math.round(ys[i]) + ')';
      var top = document.elementFromPoint(x, ys[i]);
      if (!top || !(top === b || b.contains(top))) return 'covered by #' + (top && top.closest('[id]') ? top.closest('[id]').id : '?');
    }
    return 'ok';
  }
  // 수정 창이 열리는 전환(opacity · translateY 180ms)을 끝 상태로 — 가상 시간(--virtual-time-budget)에서는 전환이 시작점에 멈춰 있다
  function settle() { $('editRecOverlay').getAnimations({ subtree: true }).forEach(function (a) { a.finish(); }); }

  test('가로로 든 폰(터치 · 폭 > 720px · 낮은 화면): 수정 창의 「저장」이 하단 탭에 가리지 않고 눌린다', async function () {
    var a = window.AS, keep = { abs: a.abs, sk: window._curSaveKey };
    try {
      await sleep(2500);   // 앱 시작 작업(마지막 경기 열기 등)이 끝난 뒤
      ok(innerWidth > 720 && innerWidth < 1024 && matchMedia('(any-pointer: coarse)').matches, '전제: 폭 720~1024px 의 터치 기기 창이어야 함(@window · @pointer) — 창 ' + innerWidth + '×' + innerHeight);
      ok(innerHeight < 520, '전제: 「저장」이 하단 탭에 가리던 낮은 화면이어야 함 — 창 높이 ' + innerHeight);
      AS.abs = [{ id: ID, bid: 'p1', bname: '가로타자', bnum: 9, res: '안타', inn: '1회초', team: 'home', rbi: 0, x: 0.5, y: 0.4, deg: 90, dir: 'CF' }];
      window._curSaveKey = null; updateAll();
      openEditRec(ID); await sleep(100); settle();
      eq($('editRecOverlay').classList.contains('show'), true, '수정 창이 열려야 함');
      eq(onTop('#editRecOverlay [onclick="saveEditRec()"]'), 'ok', '수정 창의 「저장」 버튼이 맨 위에서 눌려야 함');
    } finally {
      a.abs = keep.abs; window._curSaveKey = keep.sk;
      try { closeOverlay('editRecOverlay'); } catch (e) {}
      try { updateAll(); } catch (e) {}
    }
  });
})();
