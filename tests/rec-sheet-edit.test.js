// 휴대폰에서 「최근 기록」 시트(shell.js shellRecSheet)의 「수정」을 누르면 시트가 닫히고 수정 창이 보여야 한다.
// 배경: 시트(z-index 470)가 수정 창(.overlay 395)보다 위라, 수정 창이 시트 뒤에 열려 보이지도 눌리지도 않았다(시트를 ✕ 로 닫아야 보임).
// 테스트 브라우저 창은 휴대폰보다 넓으므로 휴대폰 폭 판단(matchMedia '(max-width: 720px)')만 바꿔 끼운다. 화면 배치(CSS)는 실제 그대로다.
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var ID = 1782000000101;

  function phoneWidth(on) {   // 휴대폰 폭이라고 답하게 바꾼다. 돌려주는 함수가 되돌린다
    var orig = window.matchMedia;
    window.matchMedia = function (q) {
      if (/max-width:\s*720px/.test(q)) return { matches: !!on, media: q, onchange: null, addListener: function () {}, removeListener: function () {}, addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return false; } };
      return orig.call(window, q);
    };
    return function () { window.matchMedia = orig; };
  }
  function keepApp() {
    var a = window.AS, s = { abs: a.abs, gs: window._gameSaved, sk: window._curSaveKey };
    return function () {
      a.abs = s.abs; window._gameSaved = s.gs; window._curSaveKey = s.sk;
      try { closeOverlay('editRecOverlay'); } catch (e) {}
      try { shellRecSheet(false); } catch (e) {}
      try { updateAll(); } catch (e) {}
    };
  }
  // 앱이 그린 기록 목록(시트 안)의 그 타석 「수정」 버튼
  function editBtn() { return document.querySelector('.pnl-right .rec-edit[onclick="openEditRec(' + ID + ')"]'); }
  // 수정 창의 버튼이 실제로 맨 위에 있어 눌리는지(다른 것이 덮고 있지 않은지)
  function onTop(sel) {
    var b = document.querySelector(sel); if (!b) return 'no-button';
    var r = b.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top && (top === b || b.contains(top)) ? 'ok' : 'covered by #' + (top && top.closest('[id]') ? top.closest('[id]').id : '?');
  }
  var sheetOpen = function () { return document.body.classList.contains('rec-sheet-open'); };
  var dialogOpen = function () { return $('editRecOverlay').classList.contains('show'); };
  async function setup() {
    await sleep(2500);   // 앱 시작 작업(마지막 경기 열기 등)이 끝난 뒤
    localStorage.removeItem('sl_saves');
    AS.abs = [{ id: ID, bid: 'p1', bname: '시트타자', bnum: 9, res: '안타', inn: '1회초', team: 'home', rbi: 0, x: 0.5, y: 0.4, deg: 90, dir: 'CF' }];
    window._curSaveKey = null; updateAll();
    shellRecSheet(true); await sleep(100);
  }

  test('휴대폰: 시트가 열린 채 「수정」 → 시트가 닫히고 수정 창이 보이며 눌린다 · 취소 · 저장 뒤 시트를 다시 열지 않는다', async function () {
    var restore = keepApp(), undo = phoneWidth(true);
    try {
      await setup();
      ok(sheetOpen() && editBtn(), '전제: 시트가 열려 있고 그 안에 「수정」 버튼이 있어야 함');
      editBtn().click(); await sleep(100);
      eq(sheetOpen(), false, '시트가 닫혀야 함');
      eq($('recSheetBackdrop').classList.contains('open'), false, '시트 배경도 닫혀야 함');
      eq(dialogOpen(), true, '수정 창이 열려야 함');
      eq(onTop('#editRecOverlay [onclick="saveEditRec()"]'), 'ok', '수정 창의 「저장」 버튼이 맨 위에서 눌려야 함');
      eq($('editRes').value, '안타', '수정 창에 그 타석 값이 채워져야 함');
      document.querySelector('#editRecOverlay [onclick="closeOverlay(\'editRecOverlay\')"]').click(); await sleep(100);
      eq([dialogOpen(), sheetOpen()], [false, false], '취소 뒤: 수정 창 닫힘 · 시트 다시 안 열림');
      shellRecSheet(true); await sleep(100); editBtn().click(); await sleep(100);
      $('editRes').value = '2루타'; document.querySelector('#editRecOverlay [onclick="saveEditRec()"]').click(); await sleep(800);
      eq(AS.abs[0].res, '2루타', '저장이 반영돼야 함');
      eq([dialogOpen(), sheetOpen()], [false, false], '저장 뒤: 수정 창 닫힘 · 시트 다시 안 열림');
    } finally { undo(); restore(); }
  });

  test('데스크톱(>720px): 「수정」을 눌러도 시트는 그대로다(동작 변경 없음)', async function () {
    var restore = keepApp(), undo = phoneWidth(false);
    try {
      await setup();
      editBtn().click(); await sleep(100);
      eq(sheetOpen(), true, '데스크톱에서는 시트를 건드리지 않음');
      eq(dialogOpen(), true, '수정 창은 지금처럼 열림');
    } finally { undo(); restore(); }
  });
})();
