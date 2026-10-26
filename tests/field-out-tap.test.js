// 기록 탭 2D: 부채꼴 밖(외야석 · 파울 지역)도 누르면 기록하고 그 자리에 그린다 (core _coneToSemiAll · _fieldPx · #fldOut)
//  · 저장 x,y,deg,dist 는 파울라인 사이 · 펜스까지(통계 그대로) + fa(라인 밖 각도°) · ov(펜스 뒤 m)
//  · 정사각형 필드(#cwrap) 밖 칸 빈 곳은 #fldOut 캔버스가 받고 그린다 — 넓은 칸이 필요해서 큰 창으로 돈다(아래 @window)
// @window 1600,900
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var near = function (p, q, d) { return Math.abs(p[0] - q[0]) < d && Math.abs(p[1] - q[1]) < d; };
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  // 필드 크기(FS)가 몇 번 연달아 같을 때까지 — 타자 선택 · 기록 뒤 필드 칸이 다시 계산된다
  async function settle() {
    for (var i = 0, last = -1, same = 0; i < 40 && same < 3; i++) { same = FS === last ? same + 1 : 0; last = FS; await T.sleep(150); }
    _outRender();   // safeRender 는 requestAnimationFrame 안에서 그리는데 하네스(가상 시간)에서는 제때 안 돌 때가 있다
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    if (window.shellNav) window.shellNav('record');
    if (window.sbFieldView) window.sbFieldView('2d');
    await T.sleep(300);
    ok(typeof _coneToSemiAll === 'function' && window.AS && $('cwrap'), '기록 화면');
  });

  test('_coneToSemiAll: 부채꼴 안 = _coneToSemi 그대로 · 펜스 뒤 = 펜스 위 + ov(m) · 파울 = 라인 위 + fa · 둘 다 · 홈 뒤 = null · real 로 다시 그리면 누른 자리', function () {
    var g = _fieldGeo(1000), Q = Math.PI / 4, F = function (p) { return _fenceR(g, p); }, P = function (p, r) { return _conePt(g, p, r); };
    var a = P(1.1, 0.6 * F(1.1)), s = _coneToSemiAll(g, a[0], a[1]), o = _coneToSemi(g, a[0], a[1]);
    eq([s.x, s.y, s.deg, s.dist, 'fa' in s, 'ov' in s], [o.x, o.y, o.deg, o.dist, false, false], '부채꼴 안');
    var b = P(2 * Q, F(2 * Q) + 10 * g.m), sb = _coneToSemiAll(g, b[0], b[1]);
    eq([r1(sb.x * 100) / 100, r1(sb.y * 100) / 100, sb.deg, sb.ov, 'fa' in sb], [0.5, 0.03, 90, 10, false], '중견 펜스 뒤 10m');
    var c = P(Q - 20 * Math.PI / 180, 0.5 * F(Q)), sc = _coneToSemiAll(g, c[0], c[1]);
    eq([sc.deg, sc.fa, 'ov' in sc, Math.round(sc.dist * 1000) / 1000], [0, 20, false, 0.485], '3루 쪽 파울 20°');
    var d = P(3 * Q + 10 * Math.PI / 180, F(3 * Q) + 15 * g.m), sd = _coneToSemiAll(g, d[0], d[1]);
    eq([sd.deg, sd.fa, sd.ov, sd.dist], [180, 10, 15, 0.97], '1루 쪽 폴 너머 파울(라인 밖 10° · 펜스 거리보다 15m)');
    eq(_coneToSemiAll(g, g.cx + 30, g.cy + 5), null, '홈 뒤');
    [[a, s], [b, sb], [c, sc], [d, sd]].forEach(function (t, i) {
      var q = _semiToCone(g, t[1].x, t[1].y, t[1].fa, t[1].ov, 1);
      ok(near(q, t[0], 0.6), '다시 그린 자리 ' + i + ' ' + q.map(Math.round) + ' / ' + t[0].map(Math.round));
    });
    // 분석 그림(real 아님)은 예전처럼 펜스 밖 6% 안
    var q2 = _semiToCone(g, sb.x, sb.y, 0, 200);
    ok(Math.hypot(q2[0] - g.cx, q2[1] - g.cy) / F(2 * Q) <= 1.0601, '분석 그림 = 6% 띠');
  });

  test('#fldOut: 필드 칸 전체를 덮는 캔버스가 #cwrap 아래(앞 형제)에 깔린다 · 칸이 정사각형보다 넓다', function () {
    var o = $('fldOut'), w = $('cwrap'), fw = w.parentElement;
    ok(o && o.parentNode === fw && o.nextElementSibling === w, '#fldOut 자리');
    var ro = o.getBoundingClientRect(), rf = fw.getBoundingClientRect(), rw = w.getBoundingClientRect();
    ok(Math.abs(ro.width - fw.clientWidth) < 1 && Math.abs(ro.height - fw.clientHeight) < 1, '칸 크기 ' + ro.width + '×' + ro.height + ' / ' + fw.clientWidth + '×' + fw.clientHeight);
    ok(rw.left - rf.left > 60, '전제: 정사각형 왼쪽에 빈 곳 — 창 ' + innerWidth + '×' + innerHeight + ' · 칸 ' + Math.round(rf.width) + ' · 필드 ' + Math.round(rw.width));
    eq(document.elementFromPoint(rf.left + 20, rw.top + rw.height * 0.4), o, '빈 곳을 누르면 #fldOut');
  });

  test('정사각형 밖 파울 지역(3루 쪽 위)을 누르면 → 결과 팝업 · 라인 위 + fa (+ ov) → 기록 → 누른 자리에 그린다(#fldOut)', async function () {
    var o = $('fldOut'), w = $('cwrap'), pop = $('tapPop'), n = window.AS.abs.length;
    window.AS.batter = { id: 'p1', name: '가' };
    window.AS.pending = null;
    await settle();
    var rw = w.getBoundingClientRect(), k = rw.width / FS, g = _fieldGeo(FS), FS0 = FS;
    var px = -40, py = g.cy - 0.3 * g.R;   // 정사각형 왼쪽 40px · 3루 쪽 파울 지역(라인에서 20° 남짓 밖)
    o.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rw.left + px * k, clientY: rw.top + py * k }));
    ok(window._tp && !pop.hidden, '결과 팝업이 안 열림');
    var pd = window.AS.pending;
    eq([pd.deg, pd.dir, pd.fa > 0, pd.x < 0.5 && Math.abs(pd.y - 1) < 1e-9], [0, 'LF', true, true], '대기 좌표(3루 라인 위) ' + JSON.stringify(pd));
    await T.sleep(800);   // core 연타 가드(_guard 700ms)
    pop.querySelector('[data-res="플라이 아웃"]').click();
    await T.sleep(100);
    var r = window.AS.abs[window.AS.abs.length - 1];
    eq([window.AS.abs.length - n, r.res, r.fa, r.ov], [1, '플라이 아웃', pd.fa, pd.ov], '기록');
    await settle();   // 기록 뒤 필드 크기가 다시 계산될 수 있다 → 비율로 비교하고 픽셀은 지금 크기로 다시 잰다
    var q = _fieldPx(r);
    ok(near([q[0] / FS, q[1] / FS], [px / FS0, py / FS0], 0.003), '그릴 자리(필드 비율) ' + [q[0] / FS, q[1] / FS].map(r1) + ' / ' + [px / FS0, py / FS0].map(r1));
    px = q[0]; py = q[1]; rw = w.getBoundingClientRect(); k = rw.width / FS;
    var rf = o.getBoundingClientRect(), ctx = o.getContext('2d'), sc = o.width / rf.width, fw = w.parentElement;
    eq(_outB.map(Math.round), [14 - (rw.left - rf.left), 14 - (rw.top - rf.top), fw.clientWidth - 14 - (rw.left - rf.left), fw.clientHeight - 14 - (rw.top - rf.top)].map(function (v) { return Math.round(v / k); }), '칸 경계(_outB) = 지금 배치');
    var dx = Math.round((rw.left - rf.left + px * k) * sc), dy = Math.round((rw.top - rf.top + py * k) * sc), px4 = ctx.getImageData(dx - 6, dy - 6, 13, 13).data, on = 0;
    for (var i = 3; i < px4.length; i += 4) if (px4[i] > 0) on++;
    ok(on > 10, '#fldOut 에 그려짐 (칠한 화소 ' + on + ')');
  });

  test('정사각형 안 중견 펜스 뒤를 누르면 → 펜스 위 + ov(m) → 홈런 → 누른 자리 · 3D 의 깊은 외야석(29.5m)은 칸 안쪽 끝에', async function () {
    await settle();
    var w = $('cwrap'), pop = $('tapPop'), n = window.AS.abs.length, g = _fieldGeo(FS);
    window.AS.pending = null;
    var rw = w.getBoundingClientRect(), k = rw.width / FS, F = _fenceR(g, Math.PI / 2), back = Math.min(8, (g.cy - F - 20) / g.m);
    ok(back > 2, '전제: 중견 펜스 위 빈 곳 ' + back);
    var py = g.cy - F - back * g.m;
    $('fldCanvas').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rw.left + g.cx * k, clientY: rw.top + py * k }));
    ok(window._tp && !pop.hidden, '결과 팝업이 안 열림 ' + JSON.stringify({ ov: (document.querySelector('.overlay.show') || {}).id, pk: !!document.querySelector('.fr-pk:not([hidden])'), q: window.AS.pendingQuickRes, p: window.AS.pending, bat: window.AS.batter }));
    eq([window.AS.pending.dir, Math.abs(window.AS.pending.ov - back) < 0.5, 'fa' in window.AS.pending], ['CF', true, false], '대기 좌표 ' + JSON.stringify(window.AS.pending) + ' / ' + back);
    await T.sleep(800);
    pop.querySelector('[data-act="xbh"]').click();
    pop.querySelector('[data-res="홈런"]').click();
    await T.sleep(100);
    var r = window.AS.abs[window.AS.abs.length - 1];
    eq([window.AS.abs.length - n, r.res, r.ov, r.dir], [1, '홈런', window.AS.abs[window.AS.abs.length - 1].ov, 'CF'], '기록');
    ok(r.ov > 2, 'ov ' + r.ov);
    ok(near(_fieldPx(r), [g.cx, py], 1), '그릴 자리 ' + _fieldPx(r).map(Math.round) + ' / ' + [g.cx, py].map(Math.round));
    var deep = _fieldPx({ x: 0.5, y: 0.03, ov: 29.5 });
    ok(deep[1] >= _outB[1] - 0.01 && Math.abs(deep[0] - g.cx) < 0.5, '깊은 외야석은 칸 위 끝 ' + deep.map(Math.round) + ' / ' + _outB.map(Math.round));
  });

  test('팝업이 열린 채 빈 곳(#fldOut)을 누르면 = 취소(필드 탭과 같음) · 공유 링크 ov 는 0~200m 숫자만', async function () {
    await settle();
    var o = $('fldOut'), w = $('cwrap'), pop = $('tapPop'), g = _fieldGeo(FS), rw = w.getBoundingClientRect(), k = rw.width / FS;
    window.AS.pending = null;
    var at = { bubbles: true, clientX: rw.left - 30, clientY: rw.top + (g.cy - 0.7 * g.R) * k };
    o.dispatchEvent(new MouseEvent('click', at));
    ok(window._tp && !pop.hidden, '열림 ' + JSON.stringify({ ov: (document.querySelector('.overlay.show') || {}).id, p: window.AS.pending, top: (document.elementFromPoint(at.clientX, at.clientY) || {}).id }));
    await T.sleep(500);   // 막 열린 팝업은 _TP_HOLD(400ms) 동안 필드 탭을 무시한다
    o.dispatchEvent(new PointerEvent('pointerdown', at));
    o.dispatchEvent(new MouseEvent('click', at));
    eq([!!window._tp, pop.hidden, window.AS.pending], [false, true, null], '취소');
    var back = _restoreAbsFromPayload([{ r: '홈런', x: 0.5, y: 0.03, d: 90, ov: 120 }, { ov: '<b>' }, { ov: 999 }, { ov: -3 }]);
    eq(back.map(function (a) { return a.ov; }), [120, null, null, null], '공유 링크 ov');
  });
})();
