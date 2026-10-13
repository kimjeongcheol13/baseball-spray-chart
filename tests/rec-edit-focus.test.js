// 최근 기록 목록의 「수정」(.rec-edit)은 마우스를 올려야 보인다(opacity 0). 키보드 Tab 으로 그 버튼(또는 같은 줄 ✕)에 오면 보여야 한다
// 배경: Tab 은 「수정」에 들르는데 버튼이 투명이라 포커스가 사라진 것처럼 보였다 → styles.css 에 .rec-item:focus-within .rec-edit
// @window 1280,800
// @pointer fine
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var ID = 1782000000201;

  test('최근 기록 시트: 「수정」 또는 같은 줄 ✕ 에 포커스가 있으면 「수정」이 보인다', async function () {
    await sleep(2500);   // 앱 시작 작업(마지막 경기 열기 등)이 끝난 뒤
    if ($('landing-page').style.display !== 'none') showApp();
    shellNav('record');
    AS.abs = [{ id: ID, bid: 'p1', bname: '포커스타자', bnum: 9, res: '안타', inn: '1회초', team: 'home', rbi: 0, x: 0.5, y: 0.4, deg: 90, dir: 'CF' }];
    updateAll();
    shellRecSheet(true); await sleep(100);
    // 러너(가상 시간)에서는 CSS 전환이 진행되지 않아 opacity 가 시작값에 멈춘다 → 이 버튼만 전환 없이
    var st = document.createElement('style');
    st.textContent = '.rec-edit{transition:none!important}';
    document.head.appendChild(st);
    try {
      var edit = document.querySelector('.pnl-right .rec-edit[onclick="openEditRec(' + ID + ')"]'), del = edit && edit.parentNode.querySelector('.rec-del');
      ok(edit && del, '전제: 시트 안에 그 타석의 「수정」 · ✕ 버튼이 있어야 함');
      var op = function () { return getComputedStyle(edit).opacity; };
      eq(op(), '0', '전제: 포커스가 없으면 「수정」은 투명');
      edit.focus();
      eq(document.activeElement, edit, '전제: 「수정」에 포커스');
      eq(op(), '1', '「수정」에 포커스가 있으면 보여야 함');
      del.focus();
      eq(op(), '1', '같은 줄 ✕ 에 포커스가 있어도 「수정」이 보여야 함');
      del.blur();
      eq(op(), '0', '포커스가 줄을 떠나면 다시 투명');
    } finally { st.remove(); shellRecSheet(false); }
  });
})();
