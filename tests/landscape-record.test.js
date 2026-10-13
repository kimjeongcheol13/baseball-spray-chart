// 가로로 든 휴대폰(터치 · 폭 721~1023px · 낮은 화면)의 기록 화면:
//  · 필드는 열 폭의 정사각형으로 온전히 보여야 한다(화면은 세로 스크롤). 배경: 한 화면 고정 2열 배치라 필드 칸이 수십 px 로 눌려 캔버스가 위아래 잘린 띠로 보였다
//  · 「최근 기록」 시트의 「수정」은 시트가 닫히고 수정 창이 보여야 한다. 배경: 폰 폭(≤720px)에서만 시트를 닫아, 가로 폰에서는 수정 창이 시트(z 470) 뒤에 열렸다
// 이 파일은 가로 폰 크기의 터치 기기로 돈다(아래 @window · @pointer 줄 — 러너가 읽는다. 윈도우 818×384 · 리눅스 844×540)
// @window 844,540
// @pointer coarse
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var ID = 1782000000301;

  function R(el) { var r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }
  function keepApp() {
    var a = window.AS, s = { abs: a.abs, gs: window._gameSaved, sk: window._curSaveKey };
    return function () {
      a.abs = s.abs; window._gameSaved = s.gs; window._curSaveKey = s.sk;
      try { closeOverlay('editRecOverlay'); } catch (e) {}
      try { shellRecSheet(false); } catch (e) {}
      try { document.querySelector('.app-layout').scrollTop = 0; } catch (e) {}
      try { updateAll(); } catch (e) {}
    };
  }
  async function setup() {
    await sleep(2500);   // 앱 시작 작업(마지막 경기 열기 등)이 끝난 뒤
    // 랜딩 건너뛰기는 터치 지점(maxTouchPoints)으로 판단한다 — 리눅스 헤드리스(CI)는 0 이라 @pointer coarse 여도 랜딩이 남는다(필드 0×0)
    if ($('landing-page').style.display !== 'none') { showApp(); await sleep(300); }
    ok(innerWidth > 720 && innerWidth < 1024 && innerHeight <= 560 && matchMedia('(any-pointer: coarse)').matches,
      '전제: 폭 721~1023px · 높이 560px 이하 · 터치 기기 창이어야 함(@window · @pointer) — 창 ' + innerWidth + '×' + innerHeight);
    localStorage.removeItem('sl_saves');
    AS.abs = [{ id: ID, bid: 'p1', bname: '가로타자', bnum: 9, res: '안타', inn: '1회초', team: 'home', rbi: 0, x: 0.5, y: 0.4, deg: 90, dir: 'CF' }];
    window._curSaveKey = null; updateAll(); await sleep(300);   // 필드 크기 재계산(ResizeObserver · rAF)까지
  }
  // rec-sheet-edit.test.js 와 같은 확인: 수정 창 안을 스크롤해 버튼을 보이게 한 뒤 위 · 가운데 · 아래가 모두 맨 위인지
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
  function settle() { $('editRecOverlay').getAnimations({ subtree: true }).forEach(function (a) { a.finish(); }); }

  test('가로 폰: 필드가 정사각형으로 잘리지 않고 보이며, 기록 화면은 세로로 스크롤된다', async function () {
    var restore = keepApp();
    try {
      await setup();
      var card = $('sbField'); ok(card, '전제: 스코어북 필드 카드(#sbField)가 있어야 함');
      var fw = card.querySelector('.field-wrap'), cw = $('cwrap'), f = R(fw), c = R(cw);
      ok(cw.clientWidth >= 240 && cw.clientWidth === cw.clientHeight, '필드는 240px 이상의 정사각형이어야 함 — ' + cw.clientWidth + '×' + cw.clientHeight);
      eq($('fldCanvas').style.width, cw.clientWidth + 'px', '캔버스가 그 크기로 그려져야 함');
      ok(c.top >= f.top - 1 && c.bottom <= f.bottom + 1, '필드가 칸 밖으로 잘리지 않아야 함 — 칸 ' + [f.top, f.bottom].map(Math.round) + ' · 필드 ' + [c.top, c.bottom].map(Math.round));
      var al = document.querySelector('.app-layout'), ov = getComputedStyle(al).overflowY;
      ok(ov === 'auto' && al.scrollHeight > al.clientHeight, '기록 화면이 세로로 스크롤돼야 함 — overflow-y ' + ov + ' · scrollHeight ' + al.scrollHeight + ' / clientHeight ' + al.clientHeight);
      al.scrollTop = al.scrollHeight;
      ok(R($('sbFieldFt')).bottom <= R($('savantNav')).top + 1, '끝까지 내리면 필드 아래 범례가 하단 탭 위에 보여야 함 — 범례 ' + Math.round(R($('sbFieldFt')).bottom) + ' · 탭 ' + Math.round(R($('savantNav')).top));
    } finally { restore(); }
  });

  test('가로 폰: 시트가 열린 채 「수정」 → 시트가 닫히고 수정 창의 「저장」이 맨 위에서 눌린다', async function () {
    var restore = keepApp();
    try {
      await setup();
      shellRecSheet(true); await sleep(100);
      var eb = document.querySelector('.pnl-right .rec-edit[onclick="openEditRec(' + ID + ')"]');
      ok(document.body.classList.contains('rec-sheet-open') && eb, '전제: 시트가 열려 있고 그 안에 「수정」 버튼이 있어야 함');
      eb.click(); await sleep(100);
      eq(document.body.classList.contains('rec-sheet-open'), false, '시트가 닫혀야 함');
      eq($('recSheetBackdrop').classList.contains('open'), false, '시트 배경도 닫혀야 함');
      eq($('editRecOverlay').classList.contains('show'), true, '수정 창이 열려야 함');
      settle();
      eq(onTop('#editRecOverlay [onclick="saveEditRec()"]'), 'ok', '수정 창의 「저장」 버튼이 맨 위에서 눌려야 함');
    } finally { restore(); }
  });
})();
