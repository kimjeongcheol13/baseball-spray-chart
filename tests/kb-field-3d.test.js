// 3D 보기에서도 키보드로 타구를 넣는다: Tab → <spray-field-3d> → 방향키(Shift = 크게) → Enter (scorebook _kb3d)
//  · 커서 = core _kb(2D 와 같은 FS 좌표) · 저장 좌표 = _coneToSemiAll · 커서 표시 = mark(찍은 자리 고리, el._pin) · Enter = _tap3d 와 같은 길
//  · 타자가 없으면(경기 중) 타자 고르기가 3D 칸에 뜨고 첫 타자에 포커스(firstrun _kbFocus) → 고르면 결과 팝업 첫 버튼으로
//  · 하네스: 팝업 · 배치가 rAF 를 기다리므로 테스트 동안 rAF 를 타이머로 (field-out-tap · runners 와 같은 방법)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var raf;
  function key(el, k, shift) { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: !!shift, bubbles: true, cancelable: true })); }
  function press(el, k, n, shift) { for (var i = 0; i < n; i++) key(el, k, shift); }
  function el3() { return document.querySelector('#sbField3d spray-field-3d'); }
  async function wait3d() { for (var i = 0; i < 60; i++) { var e = el3(); if (e && e.tabIndex === 0) return e; await T.sleep(100); } return null; }
  async function said() { await T.sleep(60); return $('sbKbLive') ? $('sbKbLive').textContent : ''; }

  test('(준비) 3D 보기 · 필드에 Tab 으로 갈 수 있다(tabindex · 설명)', async function () {
    await T.sleep(2500);
    if (window.shellNav) window.shellNav('record');
    raf = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); };
    window.sbFieldView('3d');
    var e = await wait3d();
    ok(e, '3D 요소 없음');
    ok(typeof _coneToSemiAll === 'function' && window._kb && FS > 0, '기록 화면');
    eq([e.tabIndex, /방향키/.test(e.getAttribute('aria-label') || '')], [0, true], 'tabindex · 설명');
    window.AS.batter = { id: 'p1', name: '가' }; window.AS.pending = null; window.AS.pendingQuickRes = null;
    if (window._tp) _tpCancel();
  });

  test('방향키: 왼쪽 아래 구석(3루 쪽 파울 지역)까지 · 커서 고리 = 저장 좌표 · 안내 "파울 지역"', async function () {
    var e = el3();
    e.focus();
    _kb.set = false;                      // 첫 키에서 중견 60% 자리로 시작 (core 와 같음)
    press(e, 'ArrowLeft', 12, true);      // Shift = FS×0.1 씩 → 왼쪽 끝
    press(e, 'ArrowDown', 12, true);      // 홈 높이 바로 위에서 멈춘다(홈 뒤는 막힘)
    eq(_kb.x, 0, '왼쪽 끝');
    ok(_kb.y > 0.9 * FS && _kb.y < 0.965 * FS, '홈 높이 바로 위 ' + Math.round(_kb.y) + ' / ' + FS);
    key(e, 'ArrowUp');                    // 막히지 않은 이동 한 번 → 그 자리 안내
    var want = _coneToSemiAll(_fieldGeo(FS), _kb.x, _kb.y);
    ok(e._pin && Math.abs(e._pin.x - want.x) < 1e-9 && e._pin.fa === want.fa, '커서 고리 ' + JSON.stringify(e._pin));
    var s = await said();
    ok(s.indexOf('파울 지역') === 0 && s.indexOf('좌익수') > 0, '안내: ' + s);
  });

  test('Enter → 결과 팝업이 3D 칸에 · 저장 좌표 fa(마우스 탭과 같음) · 첫 버튼에 포커스 · Esc 로 닫으면 3D 필드로 돌아온다', async function () {
    var e = el3(), want = _coneToSemiAll(_fieldGeo(FS), _kb.x, _kb.y);
    e.focus();
    key(e, 'Enter');
    await T.sleep(100);
    ok(window._tp && !$('tapPop').hidden, '결과 팝업이 안 열림');
    eq($('tapPop').parentNode, $('sbField3d'), '팝업이 3D 칸에');
    var p = window.AS.pending;
    eq([p.deg, p.fa, Math.round(p.x * 1000), Math.round(p.y * 1000)], [want.deg, want.fa, Math.round(want.x * 1000), Math.round(want.y * 1000)], '저장 좌표 ' + JSON.stringify(p));
    eq(document.activeElement, document.querySelector('#tapPop .tp-btn'), '포커스가 결과 첫 버튼으로');
    ok(e._pin, '팝업 동안 고리 유지');
    key(e, 'ArrowLeft', true);
    eq(_kb.x, 0, '팝업이 열린 동안 방향키는 커서를 옮기지 않는다');
    // 결과 버튼에서 Esc: 팝업이 닫히면(_tpCancel) 포커스가 3D 필드로
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    _tpCancel();
    await T.sleep(20);
    eq(document.activeElement, e, '포커스가 3D 필드로');
    ok(e._pin, '커서 고리 다시 보임');
  });

  test('타자가 없으면: Enter → 타자 고르기(3D 칸) · 첫 타자에 포커스 → 고르면 결과 팝업 첫 버튼으로', async function () {
    var e = el3(), lu = getActiveLineup();
    if (!lu.some(function (p) { return p.id === 'q1'; })) { lu.push({ id: 'q1', name: '나', num: '1', pos: '', bh: '', isStarter: true }); renderLP(); }
    window.AS.batter = null; window.AS.pending = null;
    e.focus();
    key(e, 'Enter');
    await T.sleep(100);
    var pk = $('batPick');
    ok(pk && !pk.hidden && pk.parentNode === $('sbField3d'), '타자 고르기 3D 칸에 ' + JSON.stringify({ pk: !!pk, hidden: pk && pk.hidden, parent: pk && pk.parentNode && pk.parentNode.id, toast: ($('toastTxt') || {}).textContent }));
    eq(document.activeElement, pk.querySelector('.bp-b'), '첫 타자에 포커스');
    pk.querySelector('.bp-b[data-id="q1"]').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));   // 키보드로 누른 클릭(detail 0)
    for (var i = 0; i < 30 && !window._tp; i++) await T.sleep(100);
    ok(window._tp && window.AS.batter && window.AS.batter.id === 'q1', '결과 팝업 · 고른 타자');
    eq(document.activeElement, document.querySelector('#tapPop .tp-btn'), '포커스가 결과 첫 버튼으로');
    _tpCancel();
  });

  test('화면 밖 자리는 카메라가 따라간다(follow): 보는 점이 옮겨지고, 미끄러져 간 뒤에는 화면 안', async function () {
    var e = el3();
    if (!e._ready) { ok(true, '(WebGL 없음 — 카메라 검사 건너뜀)'); return; }
    e._resetCam(); await T.sleep(1500);         // 앞 테스트의 방향키가 이미 카메라를 옮겼다 → 처음 시점으로 돌리고 미끄러져 갈 때까지
    var far = { x: 0.5 - 0.97, y: 1, deg: 0, dist: 0.97, fa: 60 };   // 3루 쪽 깊은 파울 관중석: 처음 시점에서 화면 밖
    var before = e._tgtTo.clone();
    eq(e.follow({ x: 0.5, y: 0.5, deg: 90, dist: 0.5 }), false, '화면 안(중견 쪽)이면 안 움직임');
    eq(e.follow(far), true, '화면 밖이면 보는 점을 옮긴다');
    ok(e._tgtTo.distanceTo(before) > 1, '보는 점 ' + e._tgtTo.toArray().map(Math.round));
    await T.sleep(1500);                        // 카메라가 보는 점으로 미끄러져 간다(_loop, rAF → 타이머)
    eq(e.follow(far), false, '따라간 뒤에는 화면 안');
    var at = e.screenAt(far), r = e.getBoundingClientRect();
    if (r.height) ok(at && at.px > 0 && at.px < r.width && at.py > 0 && at.py < r.height, '그 자리가 화면 안 ' + JSON.stringify(at) + ' / ' + Math.round(r.width) + '×' + Math.round(r.height));
    else ok(true, '(3D 칸 높이 0 — 하네스 배치, 화면 px 검사는 건너뜀 · 위 follow 검사가 투영을 본다)');
    // 방향키 길: 커서를 옮길 때마다 _kb3d 가 follow 를 부른다
    e.focus(); _kb.set = false; key(e, 'ArrowLeft');
    eq(e.follow(_coneToSemiAll(_fieldGeo(FS), _kb.x, _kb.y)), false, '방향키 뒤 커서는 화면 안');
    key(e, 'Escape');
    e._resetCam();
  });

  test('Esc = 커서 숨김 · 2D 로 돌아가면 그대로', async function () {
    var e = el3();
    e.focus();
    key(e, 'ArrowRight');
    ok(e._pin, '고리');
    key(e, 'Escape');
    eq(e._pin, null, 'Esc 로 숨김');
    window.sbFieldView('2d');
    await T.sleep(50);
    ok(!window._tp, '팝업 없음');
    window.requestAnimationFrame = raf;
  });
})();
