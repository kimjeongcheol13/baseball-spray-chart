// 분석 그림 3D 보기 (js/features/ana3d.js · spray3d.js <pitch-zone-3d>)
//  · 타구 방향(sprayFigure) · 코스(svg.pc-plot) · 분포 · 피안타(.sc-zone) · 경기설정 구장 규격 카드 머리에 2D | 3D · 3D 면 2D 대신 3D 요소 · 고른 값은 sl_ana_3d
//  · 3D 에 넘기는 점 = 그려진 SVG 에서 읽은 것: 타구는 저장 좌표로 되돌려 2D 와 같은 자리(홈런은 펜스 밖) · 코스는 그림 좌표 + 2D 색 + 고른 구역
//  · 코스 3D 에서 끌어 고르면(zonepick) 2D 와 같은 setPitchPick 으로 · 3D 필드 펜스는 구장 거리(좌 · 중 · 우)대로
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
  var CELLS = [[3, 1], [0, 0], [5, 2], [1, 0], [7, 3], [2, 1], [0, 0], [4, 0], [6, 2]];
  var GRID = '<div class="sc-zone" data-view="count"><div class="sc-zone-grid">' + CELLS.map(function (c) {
    return '<div class="sc-zc" data-n="' + c[0] + '" data-h="' + c[1] + '"><b>' + c[0] + '</b><small>구</small></div>';
  }).join('') + '</div></div>';
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
      + '<section class="an-card" id="tZ3"><header class="an-hd"><h3>코스</h3></header>' + ZONE + '</section>'
      + '<section class="an-card" id="tG3"><header class="an-hd"><h3>분포</h3></header>' + GRID + '</section>');
    await T.sleep(0);
    eq([pressed('tA3'), pressed('tZ3'), pressed('tG3')], [['2D:true', '3D:false'], ['2D:true', '3D:false'], ['2D:true', '3D:false']], '머리 버튼');
    ok(!$$('#tA3 spray-field-3d') && getComputedStyle($$('#tA3 figure > svg')).display !== 'none', '2D 그림');
  });

  test('3D → 타구는 같은 자리(홈런은 펜스 밖) · 코스는 그림 좌표 + 2D 색 · 고른 값 기억', async function () {
    window.ana3dView('3d');
    var s = await el3d('#tA3 spray-field-3d', '_balls'), z = await el3d('#tZ3 pitch-zone-3d', '_pts'), g = await el3d('#tG3 pitch-zone-3d', '_grid');
    ok(s && z && g, '3D 요소 없음');
    m3 = await import('/js/features/spray3d.js?v=7');
    eq(s._balls.map(function (b) { return b.k; }), ['out', 'hit', 'xbh', 'hr'], '타구 종류');
    var want = { out: ABS[3], hit: ABS[0], xbh: ABS[2] };
    s._balls.forEach(function (b) {
      if (b.k === 'hr') { ok(Math.hypot(b.p[0], b.p[1]) > m3.fenceFn(s._dist)(Math.atan2(-b.p[1], -b.p[0])), '홈런이 펜스 안 — ' + b.p + ' · 구장 ' + s._dist); return; }
      var w = m3.toField(want[b.k].x, want[b.k].y, false, m3.fenceFn(s._dist));
      ok(Math.hypot(b.p[0] - w[0], b.p[1] - w[1]) < 0.5, b.k + ' 자리 ' + b.p + ' / ' + w);
    });
    eq(s._board, ['가', '안타 3 · 타구 4'], '전광판');
    eq(z._pts, [{ x: 50, y: 60, k: 'strike', on: false }, { x: 10, y: 20, k: 'ball', on: false }, { x: 30, y: 60, k: 'hit', on: false }], '코스 점');
    ok(z._cols.strike && z._cols.ball && z._cols.hit, '코스 색 ' + JSON.stringify(z._cols));
    eq([z._pick, z._sel], [false, null], '고르기 없는 코스');
    eq(g._grid, { view: 'count', cells: CELLS.map(function (c) { return { n: c[0], h: c[1], t: String(c[0]) }; }) }, '분포 9칸');
    eq(s._dist, s._dist.map(Number).filter(function (v) { return v > 0; }), '구장 거리 ' + s._dist);
    eq([s._dist.length, getComputedStyle($$('#tA3 figure > svg')).display, getComputedStyle($$('#tG3 .sc-zone')).display], [3, 'none', 'none'], '2D 숨김');
    eq(pressed('tZ3'), ['2D:false', '3D:true'], '머리 버튼');
    eq(localStorage.getItem('sl_ana_3d'), '1', '기억');
  });

  test('펜스 = 구장 거리(좌 · 중 · 우) · 땅 → 저장 좌표(파울 지역 = 파울라인 위 + fa · 관중석 = 펜스 위 · 홈 뒤 = null)', function () {
    var R = m3.fenceFn([98, 122, 95]), Q = Math.PI / 4;
    eq([R(Q), R(2 * Q), R(3 * Q)].map(Math.round), [98, 122, 95], '좌 · 중 · 우');
    [[0.5, 0.3], [0.2, 0.6], [0.75, 0.5], [0.5, 0.9]].forEach(function (p) {
      var f = m3.toField(p[0], p[1], false, R), b = m3.fromField(f[0], f[1], R);
      ok(b && Math.abs(b.x - p[0]) < 0.01 && Math.abs(b.y - p[1]) < 0.01, '왕복 ' + p + ' → ' + JSON.stringify(b));
    });
    eq(m3.fromField(-50, 10, R), null, '홈 뒤');
    var near = function (b, x, y) { return b && Math.abs(b.x - x) < 0.01 && Math.abs(b.y - y) < 0.01; };
    var far = m3.fromField(0, -200, R), f3 = m3.fromField(-50, -5, R), f1 = m3.fromField(60, -5, R);
    ok(near(far, 0.5, 0.03) && !far.fa, '중견 관중석 → 중앙 펜스 ' + JSON.stringify(far));
    ok(near(f3, 0.5 - 0.97 * Math.hypot(50, 5) / 98, 1) && f3.deg === 0 && f3.fa === 39.3, '3루 쪽 파울 → 좌측 파울라인 + fa ' + JSON.stringify(f3));
    ok(near(f1, 0.5 + 0.97 * Math.hypot(60, 5) / 95, 1) && f1.deg === 180 && f1.fa === 40.2, '1루 쪽 파울 → 우측 파울라인 + fa ' + JSON.stringify(f1));
    // 파울 잔디는 누른 자리 그대로 다시 그린다 — 홈 가까운 3루 쪽 파울은 y 가 반올림으로 정확히 1(예전엔 1루 쪽으로 그려졌다)
    var s3 = m3.fromField(-15, -10, R);
    eq(s3.y, 1, '가까운 3루 쪽 파울 y');
    [[-30, -20], [40, -30], [-15, -10]].forEach(function (c) {
      var s = m3.fromField(c[0], c[1], R), p = m3.toField(s.x, s.y, false, R, s.fa);
      ok(Math.abs(p[0] - c[0]) < 0.3 && Math.abs(p[1] - c[1]) < 0.3, '파울 왕복 ' + c + ' → ' + p.map(Math.round));
    });
    // 내야 관중석(라인에서 9m 부터 3.2m 씩 계단) 위 파울: 라인 따라 거리는 그대로, 라인에서 거리는 그 줄 한가운데(15 → 2번째 줄 9 + 3.2 × 1.5)
    var sx = m3.fromField(-45 * Math.SQRT1_2, -15 * Math.SQRT1_2, R), q = m3.toField(sx.x, sx.y, false, R, sx.fa);
    eq([Math.SQRT1_2 * -(q[0] + q[1]), Math.SQRT1_2 * (q[1] - q[0])].map(function (v) { return Math.round(v * 10) / 10; }), [30, 13.8], '관중석 파울 (라인 따라, 라인에서)');
    // 외야석: 저장 x · y 는 펜스 위 그대로 + ov(펜스 뒤 m, 최대 29.5) → 누른 줄 한가운데(펜스 + 2.5 + 4.5 × (줄 + .5))에 다시 그린다
    var st = m3.fromField(0, -(122 + 10), R), d3 = function (p) { return Math.round(Math.hypot(p[0], p[1]) * 100) / 100; };
    ok(near(st, 0.5, 0.03) && st.ov === 10 && !st.fa, '중견 외야석 10m → 펜스 위 + ov ' + JSON.stringify(st));
    eq(far.ov, 29.5, '외야석 끝 너머 → ov 최대');
    eq([d3(m3.toField(st.x, st.y, false, R, 0, st.ov)), d3(m3.toField(st.x, st.y, true, R)), d3(m3.toField(st.x, st.y, false, R))], [131.25, 126.75, 120], '외야석 2번째 줄 · ov 없는 펜스 홈런 = 첫 줄 · 홈런 아님 = 펜스 앞');
  });

  test('코스 3D: 2D 에서 고른 구역 · 점을 읽고, 3D 에서 끌어 고르면 setPitchPick({ a, b }) 로 넘긴다', async function () {
    var z = $$('#tZ3 pitch-zone-3d'), svg = $$('#tZ3 svg.pc-plot');
    svg.id = 'pcPlot'; svg.classList.add('picking');
    svg.querySelector('.pz-strike').classList.add('on');
    svg.insertAdjacentHTML('beforeend', '<rect class="pz-sel" x="30" y="40" width="20" height="10" rx="0"/>');
    await T.sleep(0);
    eq([z._pick, z._picking, z._sel, z._pts.map(function (p) { return p.on; })],
      [true, true, { x0: 30, y0: 40, x1: 50, y1: 50, tap: false }, [true, false, false]], '고른 상태');
    var got = null, orig = window.setPitchPick;
    window.setPitchPick = function (c) { got = c; };
    try { z.dispatchEvent(new CustomEvent('zonepick', { detail: { a: [30, 40], b: [60, 80] } })); } finally { window.setPitchPick = orig; }
    eq(got, { a: [30, 40], b: [60, 80] }, 'setPitchPick 인자');
  });

  test('경기설정 구장 규격도 3D — 공 없이 구장 · 전광판 = 구장 이름 · 거리', async function () {
    shellNav('settings');
    var s = await el3d('#stStad spray-field-3d', '_board');
    ok(s, '구장 3D 없음');
    var d = s._dist;
    eq([s._balls.length, s._board[1]], [0, '좌 ' + d[0] + ' · 중 ' + d[1] + ' · 우 ' + d[2] + 'm'], '구장');
    eq(getComputedStyle($$('#stStad .st-prev > svg')).display, 'none', '2D 미리보기 숨김');
    eq(pressed('stStad'), ['2D:false', '3D:true'], '머리 버튼');
    shellNav('analysis', 'batter');
    await T.sleep(50);
    ok(!$$('#stStad spray-field-3d'), '경기설정을 떠나면 떼어 냄');
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
    $$('#tA3').remove(); $$('#tZ3').remove(); $$('#tG3').remove();
    try { localStorage.removeItem('sl_ana_3d'); } catch (e) {}
  });
})();
