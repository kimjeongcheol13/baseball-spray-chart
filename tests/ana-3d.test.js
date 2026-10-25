// 분석 그림 3D 보기 (js/features/ana3d.js · spray3d.js <pitch-zone-3d>)
//  · 타구 방향(sprayFigure) · 코스(svg.pc-plot) 카드 머리에 2D | 3D · 3D 면 SVG 대신 3D 요소 · 고른 값은 sl_ana_3d
//  · 3D 에 넘기는 점 = 그려진 SVG 에서 읽은 것: 타구는 저장 좌표로 되돌려 2D 와 같은 자리(홈런은 펜스 밖) · 코스는 그림 좌표 + 2D 색
//  · 하네스 크롬은 GPU 를 끈다 — 그림이 아니라 넘긴 데이터만 본다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var ABS = [
    { bname: '가', bnum: 1, team: 'home', inning: 1, res: '안타', x: 0.5, y: 0.3 },
    { bname: '가', bnum: 1, team: 'home', inning: 2, res: '홈런', x: 0.5, y: -0.02 },
    { bname: '가', bnum: 1, team: 'home', inning: 3, res: '2루타', x: 0.2, y: 0.5 },
    { bname: '가', bnum: 1, team: 'home', inning: 4, res: '땅볼 아웃', x: 0.6, y: 0.8 }
  ];
  var ZONE = '<svg class="pc-plot" viewBox="0 0 100 120"><rect class="pz-box" x="22" y="18" width="56" height="84"/>'
    + '<path class="pz-grid" d="M40.7 18v84"/><path class="pz-plate" d="M42 114h16l-2 4h-12z"/>'
    + '<circle class="pz-strike" cx="50" cy="60" r="2.8"/><circle class="pz-ball" cx="10" cy="20" r="2.4"/>'
    + '<path class="pz-hit" d="M30 56.4l3.6 3.6-3.6 3.6-3.6-3.6z"/></svg>';
  var bd, m3;
  function $$(s) { return document.querySelector(s); }
  function pressed(id) { return [].map.call(document.querySelectorAll('#' + id + ' .an-3d-seg button'), function (b) { return b.textContent + ':' + b.getAttribute('aria-pressed'); }); }
  async function el3d(sel, prop) {
    for (var i = 0; i < 50; i++) { var e = $$(sel); if (e && e[prop]) return e; await T.sleep(100); }
    return null;
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    bd = await import('/js/features/batdata.js?v=9');
    ok(window.ana3dView && bd.sprayFigure && window._fieldPos && window.shellNav, '모듈 로드');
  });

  test('타구 · 코스 카드 머리에 2D | 3D — 처음엔 2D', async function () {
    try { localStorage.removeItem('sl_ana_3d'); } catch (e) {}
    window.ana3dView('2d');
    shellNav('analysis', 'batter');
    await T.sleep(50);
    var sec = $$('#anaBody .ana-sec.on');
    sec.insertAdjacentHTML('beforeend',
      '<section class="an-card" id="tA3"><header class="an-hd"><h3>타구</h3></header>' + bd.sprayFigure({ name: '가', abs: ABS, st: bd.calcStats(ABS) }) + '</section>'
      + '<section class="an-card" id="tZ3"><header class="an-hd"><h3>코스</h3></header>' + ZONE + '</section>');
    await T.sleep(0);
    eq([pressed('tA3'), pressed('tZ3')], [['2D:true', '3D:false'], ['2D:true', '3D:false']], '머리 버튼');
    ok(!$$('#tA3 spray-field-3d') && getComputedStyle($$('#tA3 figure > svg')).display !== 'none', '2D 그림');
  });

  test('3D → 타구는 같은 자리(홈런은 펜스 밖) · 코스는 그림 좌표 + 2D 색 · 고른 값 기억', async function () {
    window.ana3dView('3d');
    var s = await el3d('#tA3 spray-field-3d', '_balls'), z = await el3d('#tZ3 pitch-zone-3d', '_pts');
    ok(s && z, '3D 요소 없음');
    m3 = await import('/js/features/spray3d.js?v=2');
    eq(s._balls.map(function (b) { return b.k; }), ['out', 'hit', 'xbh', 'hr'], '타구 종류');
    var want = { out: ABS[3], hit: ABS[0], xbh: ABS[2] };
    s._balls.forEach(function (b) {
      if (b.k === 'hr') { ok(Math.hypot(b.p[0], b.p[1]) > 105, '홈런이 펜스 안 — ' + b.p); return; }
      var w = m3.toField(want[b.k].x, want[b.k].y, false);
      ok(Math.hypot(b.p[0] - w[0], b.p[1] - w[1]) < 0.5, b.k + ' 자리 ' + b.p + ' / ' + w);
    });
    eq(s._board, ['가', '안타 3 · 타구 4'], '전광판');
    eq(z._pts, [{ x: 50, y: 60, k: 'strike' }, { x: 10, y: 20, k: 'ball' }, { x: 30, y: 60, k: 'hit' }], '코스 점');
    ok(z._cols.strike && z._cols.ball && z._cols.hit, '코스 색 ' + JSON.stringify(z._cols));
    eq(getComputedStyle($$('#tA3 figure > svg')).display, 'none', '2D 숨김');
    eq(pressed('tZ3'), ['2D:false', '3D:true'], '머리 버튼');
    eq(localStorage.getItem('sl_ana_3d'), '1', '기억');
  });

  test('카드를 다시 그려도 같은 3D 요소를 다시 쓴다 · 2D 로 돌아가면 떼어 낸다', async function () {
    var first = $$('#tA3 spray-field-3d');
    var c = $$('#tA3');
    c.innerHTML = '<header class="an-hd"><h3>타구</h3></header>' + bd.sprayFigure({ name: '가', abs: ABS.slice(0, 1), st: bd.calcStats(ABS.slice(0, 1)) });
    await T.sleep(0);
    var s = $$('#tA3 spray-field-3d');
    ok(s === first, '요소를 새로 만듦');
    eq(s._board[1], '안타 1 · 타구 1', '새 데이터');
    window.ana3dView('2d');
    ok(!first.isConnected && !$$('#tZ3 pitch-zone-3d'), '3D 요소가 남음');
    ok(getComputedStyle($$('#tA3 figure > svg')).display !== 'none', '2D 그림');
    eq(localStorage.getItem('sl_ana_3d'), '0', '기억');
    $$('#tA3').remove(); $$('#tZ3').remove();
    try { localStorage.removeItem('sl_ana_3d'); } catch (e) {}
  });
})();
