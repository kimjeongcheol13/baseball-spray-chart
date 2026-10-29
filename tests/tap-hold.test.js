// 팝업이 열리자마자 들어온 두 번째 필드 탭은 무시 (core _TP_HOLD · _tpFresh)
//  · 느린 기기에서 반응이 없어 한 번 더 누르면, 그 탭이 막 열린 결과 팝업을 닫아 "눌러도 기록이 안 되는" 것처럼 보였다
//  · 2D 필드 탭(onFClick) · 3D 칸 누름(pointerdown → _f3pop) · 타자 선택 팝업(firstrun) 모두 같은 규칙
//  · _TP_HOLD 가 지나면 예전처럼 필드 탭 = 취소. 필드 밖(다른 화면)을 누르면 막 열렸어도 바로 취소
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  function ev() { return { clientX: FS / 2, clientY: FS * 0.35, rect: { left: 0, top: 0, width: FS, height: FS }, sx: 1, sy: 1 }; }
  function down(el) { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true })); }
  async function el3d() {
    for (var i = 0; i < 50; i++) { var e = document.querySelector('#sbField3d spray-field-3d'); if (e && e._balls) return e; await T.sleep(100); }
    return null;
  }
  var HOLD = 400;
  // 막 열린 팝업의 기준 시각(_tp.t · firstrun _pk.t)은 열 때 찍고, 그려진 뒤 rAF 에서 다시 찍는다. 하네스(가상 시간)에서는 rAF 가
  // 거의 안 돌다가 가끔 T.sleep(HOLD + 100) 사이에 늦게 돌아, 그 뒤 취소 탭이 "막 열린" 것으로 무시됐다(CI 에서 가끔 '시간이 지난 탭 = 취소')
  // → field-out-tap 과 같은 방법: 이 테스트들 동안만 rAF 를 16ms 타이머로. 그러면 기준 시각은 늘 열고 16ms 뒤에 확정된다
  function held(fn) {
    return async function () {
      var raf = window.requestAnimationFrame;
      window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); };
      try { await fn(); } finally { window.requestAnimationFrame = raf; }
    };
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(typeof _tpFresh === 'function' && window.sbFieldView && FS > 0, '_tpFresh · 기록 화면');
    eq(_TP_HOLD, HOLD, '_TP_HOLD');
  });

  test('2D: 열리자마자 다시 누르면 무시 · 시간이 지나면 누르면 취소', held(async function () {
    window.AS.abs = []; window.AS.batter = { id: 'p1', name: '가' }; window.AS.pending = null; window.AS.pendingQuickRes = null;
    onFClick(ev());
    ok(window._tp && !$('tapPop').hidden, '결과 팝업이 안 열림');
    var pend = JSON.stringify(window.AS.pending);
    onFClick(ev());
    ok(window._tp && !$('tapPop').hidden, '두 번째 탭이 막 열린 팝업을 닫음');
    eq(JSON.stringify(window.AS.pending), pend, '대기 좌표 그대로');
    await T.sleep(HOLD + 100);
    onFClick(ev());
    eq([!!window._tp, $('tapPop').hidden, window.AS.pending], [false, true, null], '시간이 지난 탭 = 취소');
  }));

  test('바깥 누름: 막 열렸을 때 필드 안은 무시 · 필드 밖은 바로 취소', held(async function () {
    onFClick(ev());
    ok(window._tp, '결과 팝업이 안 열림');
    down($('cwrap'));
    ok(window._tp, '필드 안 누름이 막 열린 팝업을 닫음');
    down(document.body);
    ok(!window._tp, '필드 밖 누름은 바로 취소');
    onFClick(ev());
    await T.sleep(HOLD + 100);
    down($('cwrap'));
    ok(!window._tp, '시간이 지난 필드 누름 = 취소');
  }));

  test('3D: 열리자마자 3D 칸을 다시 누르면 무시(팝업 · 대기 좌표 그대로) · 시간이 지나면 취소', held(async function () {
    sbFieldView('3d');
    var e = await el3d();
    ok(e, '3D 요소 없음');
    window.AS.pending = null;
    e.dispatchEvent(new CustomEvent('fieldtap', { detail: { x: 0.4, y: 0.5, px: 10, py: 200 } }));
    ok(window._tp && !$('tapPop').hidden, '결과 팝업이 안 열림');
    eq($('tapPop').parentNode, $('sbField3d'), '팝업이 3D 칸에');
    // 실제 두 번째 탭 = pointerdown(여기서 바깥 누름 취소 검사) → pointerup 에서 fieldtap
    down(e);
    e.dispatchEvent(new CustomEvent('fieldtap', { detail: { x: 0.6, y: 0.3, px: 300, py: 100 } }));
    ok(window._tp && !$('tapPop').hidden, '두 번째 탭이 막 열린 팝업을 닫음');
    ok(Math.abs(window.AS.pending.x - 0.4) < 0.01, '대기 좌표가 두 번째 탭으로 바뀜 ' + JSON.stringify(window.AS.pending));
    await T.sleep(HOLD + 100);
    down(e);
    ok(!window._tp && $('tapPop').hidden, '시간이 지난 3D 누름 = 취소');
    sbFieldView('2d');
  }));

  test('타자 선택 팝업(firstrun): 열리자마자 다시 누르면 무시 · 시간이 지나면 취소', held(async function () {
    window.AS.batter = null; window.AS.pending = null;
    onFClick(ev());
    var pk = $('batPick');
    ok(pk && !pk.hidden, '타자 선택 팝업이 안 열림');
    onFClick(ev());
    ok(!pk.hidden, '두 번째 탭이 막 열린 타자 선택 팝업을 닫음');
    down($('cwrap'));
    ok(!pk.hidden, '필드 안 누름이 막 열린 타자 선택 팝업을 닫음');
    await T.sleep(HOLD + 100);
    onFClick(ev());
    ok(pk.hidden, '시간이 지난 탭 = 취소');
    window.AS.abs = [];
  }));
})();
