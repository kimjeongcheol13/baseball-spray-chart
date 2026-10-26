// 키보드(Tab 포커스 → 방향키 · Enter)로도 부채꼴 밖(파울 지역 · 펜스 뒤)에 타구를 넣는다 (core _kbInit: _coneToSemiAll)
//  · 전에는 방향키가 부채꼴 끝에서 "필드 끝입니다"로 멈추고, Enter 는 "필드 안쪽 위치를 선택하세요"였다
//  · 마우스 탭(onFClick · _coneToSemiAll)과 같은 자리 · 같은 저장값(fa · ov). 홈 뒤만 막는다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  function key(k, shift) { $('fldCanvas').dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: !!shift, bubbles: true, cancelable: true })); }
  function press(k, n, shift) { for (var i = 0; i < n; i++) key(k, shift); }
  async function said() { await T.sleep(60); return $('fldKbLive') ? $('fldKbLive').textContent : ''; }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    if (window.shellNav) window.shellNav('record');
    if (window.sbFieldView) window.sbFieldView('2d');
    await T.sleep(300);
    ok(typeof _coneToSemiAll === 'function' && window._kb && $('fldCanvas') && FS > 0, '기록 화면');
    window.AS.batter = { id: 'p1', name: '가' }; window.AS.pending = null; window.AS.pendingQuickRes = null;
    if (window._tp) _tpCancel();
  });

  test('방향키: 왼쪽 아래 구석(3루 쪽 파울 지역)까지 간다 · Enter → 결과 팝업 · 라인 밖 각도(fa)', async function () {
    _kb.set = false;                      // 첫 키에서 중견 60% 자리로 시작
    press('ArrowLeft', 12, true);         // Shift = FS×0.1 씩 → 왼쪽 끝(x=0)
    press('ArrowDown', 12, true);         // 아래로 → 홈 높이 바로 위에서 멈춘다(홈 뒤는 막힘)
    eq(_kb.x, 0, '왼쪽 끝');
    ok(_kb.y > 0.9 * FS && _kb.y < 0.965 * FS, '홈 높이 바로 위 ' + Math.round(_kb.y) + ' / ' + FS);
    ok(_kb.on && $('fldKbCur').classList.contains('show'), '커서 표시');
    key('ArrowUp');                       // 막히지 않은 이동 한 번 → 그 자리 안내(마지막 Down 은 홈 뒤라 "필드 끝입니다")
    var s = await said();
    ok(s.indexOf('파울 지역') === 0 && s.indexOf('좌익수') > 0, '안내: ' + s);
    var want = _coneToSemiAll(_fieldGeo(FS), _kb.x, _kb.y);
    key('Enter');
    await T.sleep(100);
    ok(window._tp && !$('tapPop').hidden, '결과 팝업이 안 열림');
    var p = window.AS.pending;
    ok(p && p.fa > 20 && p.fa <= 45 && !p.ov, '대기 좌표 fa ' + JSON.stringify(p));
    eq([p.deg, p.fa, Math.round(p.x * 1000), Math.round(p.y * 1000)], [want.deg, want.fa, Math.round(want.x * 1000), Math.round(want.y * 1000)], '마우스 탭(_coneToSemiAll)과 같은 저장 좌표');
    eq(document.activeElement, document.querySelector('#tapPop .tp-btn'), '포커스가 결과 첫 버튼으로');
    _tpCancel();
  });

  test('방향키: 왼쪽 위 구석(펜스 뒤)까지 간다 · Enter → 펜스 뒤 m(ov)', async function () {
    var g = _fieldGeo(FS), trail = [];
    _kb.x = g.cx; _kb.y = g.cy - 0.5 * g.R;   // 중견 쪽 중간 깊이에서 시작
    for (var i = 0; i < 12; i++) { key('ArrowUp', true); trail.push('y' + Math.round(_kb.y)); }     // 위쪽 끝(y=0)
    for (var j = 0; j < 12; j++) { key('ArrowLeft', true); trail.push('x' + Math.round(_kb.x)); }   // 왼쪽 끝(x=0)
    eq([_kb.x, _kb.y], [0, 0], '왼쪽 위 구석 (FS ' + FS + ') ' + trail.join(' '));
    var s = await said();
    ok(s.indexOf('펜스 뒤') > 0, '안내: ' + s);
    key('ArrowRight', true);              // 구석 (0,0) 에서 다음 키가 가운데 시작 자리로 되돌아가면 안 된다 (_kb.set)
    ok(Math.abs(_kb.x - 0.1 * FS) < 1 && _kb.y === 0, '구석에서 한 칸 오른쪽 ' + [_kb.x, _kb.y]);
    key('ArrowLeft', true);
    key(' ');
    await T.sleep(100);
    ok(window._tp && window.AS.pending && window.AS.pending.ov > 0, '펜스 뒤 ov ' + JSON.stringify(window.AS.pending));
    _tpCancel();
  });

  test('홈 뒤로는 못 간다(필드 끝) · 부채꼴 안은 예전 안내 그대로', async function () {
    _kb.set = false;
    key('ArrowRight');                    // 시작 자리(중견 60%)에서 한 칸
    var s = await said();
    ok(s.indexOf('중견수') === 0 && s.indexOf('파울') < 0, '안내: ' + s);
    var g = _fieldGeo(FS);
    _kb.x = g.cx; _kb.y = g.cy - 0.1;     // 홈 바로 위. Shift 한 칸(FS×0.1)이면 필드가 아주 작아도(CI 창) 홈 뒤로 넘어간다
    key('ArrowDown', true);
    eq(_kb.y, g.cy - 0.1, '홈 뒤로 안 움직임');
    s = await said();
    eq(s, '필드 끝입니다', '안내');
    if (window._tp) _tpCancel();
  });
})();
