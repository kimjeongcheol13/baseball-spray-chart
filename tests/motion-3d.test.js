// 동작 분석 3D 뼈대 뷰어 (js/motion/skeleton3d.js) + 영상 위 「사람을 못 찾음」 안내 (overlay.js drawOverlay)
//  · 순수 함수만 본다: 회전(rotatePoint) · 투영(projectPose). 캔버스 그리기는 가짜 ctx 에 기록된 글자로만 확인한다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var V, O;
  var near = function (v, want, tol, m) { ok(typeof v === 'number' && Math.abs(v - want) <= tol, m + ' — 기대 ' + want + ' ± ' + tol + ', 실제 ' + v); };
  var len = function (p) { return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z); };

  // 골반 중심이 원점인 가짜 골격 33칸 (좌우 대칭이 아닌 점을 일부러 섞는다)
  function world() {
    var w = [], i;
    for (i = 0; i < 33; i++) w.push({ x: 0.01 * i, y: -0.02 * i, z: 0.005 * i, visibility: 1 });
    w[23] = { x: 0.15, y: 0, z: 0, visibility: 1 };
    w[24] = { x: -0.15, y: 0, z: 0, visibility: 1 };
    return w;
  }
  // 모든 관절 x 의 평균을 가운데 기준으로 (회전 확인용)
  var mid = function (pts, a, b) { return (pts[a].x + pts[b].x) / 2; };

  // drawOverlay 가 그린 글자만 모으는 가짜 ctx (그리기 호출은 전부 받아 넘긴다)
  function fakeCtx() {
    var texts = [], ctx = new Proxy({}, {
      get: function (t, k) {
        if (k === 'fillText') return function (s) { texts.push(s); };
        if (k === 'measureText') return function () { return { width: 10 }; };
        return typeof t[k] === 'undefined' ? function () {} : t[k];
      },
      set: function (t, k, v) { t[k] = v; return true; }
    });
    return { ctx: ctx, texts: texts };
  }

  test('(준비) 3D 뷰어 · 오버레이 모듈을 불러온다', async function () {
    V = await import('/js/motion/skeleton3d.js?v=1');
    O = await import('/js/motion/overlay.js?v=3');
    ok(V.rotatePoint && V.projectPose && V.createSkeleton3D && O.drawOverlay, '모듈 로드');
  });

  test('회전: yaw 90 이면 (1,0,0) 의 x 가 0 · yaw 360 은 원래대로 · pitch 만 주면 x 불변 · 길이 보존', async function () {
    var p = { x: 1, y: 0, z: 0 }, r = V.rotatePoint(p, 90, 0);
    near(r.x, 0, 1e-9, 'yaw 90 의 x');
    near(Math.abs(r.z), 1, 1e-9, 'yaw 90 의 |z|');
    var full = V.rotatePoint({ x: 0.3, y: -0.5, z: 0.2 }, 360, 0);
    near(full.x, 0.3, 1e-9, 'yaw 360 x'); near(full.y, -0.5, 1e-9, 'yaw 360 y'); near(full.z, 0.2, 1e-9, 'yaw 360 z');
    near(V.rotatePoint({ x: 0.7, y: -0.4, z: 0.2 }, 0, 40).x, 0.7, 1e-9, 'pitch 만 줄 때 x');
    var q = { x: 0.3, y: -0.8, z: 0.45 };
    near(len(V.rotatePoint(q, 123, -37)), len(q), 1e-9, '길이 보존');
  });

  test('투영: null 이면 null · 33개 · 골반 중점은 가로 가운데(어느 각도에서도)', async function () {
    eq(V.projectPose(null, 0, 0, 300, 400), null, 'world 없음');
    var pts = V.projectPose(world(), 0, 0, 300, 400);
    eq(pts.length, 33, '관절 수');
    near(mid(pts, 23, 24), 150, 1e-9, 'yaw 0');
    near(mid(V.projectPose(world(), 37, 12, 300, 400), 23, 24), 150, 1e-9, 'yaw 37 · pitch 12');
    ok(pts.every(function (p) { return isFinite(p.x) && isFinite(p.y) && isFinite(p.depth); }), '유한한 값');
  });

  test('투영: yaw 180 이면 좌우가 가운데 기준으로 뒤집히고 높이는 그대로', async function () {
    var a = V.projectPose(world(), 0, 0, 300, 400), b = V.projectPose(world(), 180, 0, 300, 400);
    a.forEach(function (p, i) {
      near(b[i].x - 150, -(p.x - 150), 1e-6, '관절 ' + i + ' x');
      near(b[i].y, p.y, 1e-6, '관절 ' + i + ' y');
    });
  });

  test('투영: 캔버스 크기에 비례(프레임 · 크기가 바뀌어도 배율이 일정)', async function () {
    var a = V.projectPose(world(), 25, 10, 200, 300), b = V.projectPose(world(), 25, 10, 400, 600);
    a.forEach(function (p, i) { near(b[i].x, p.x * 2, 1e-6, 'x ' + i); near(b[i].y, p.y * 2, 1e-6, 'y ' + i); });
  });

  test('영상 위 안내: 사람을 못 찾은 프레임에만 「이 프레임은 사람을 찾지 못했어요」를 그린다', async function () {
    var msg = '이 프레임은 사람을 찾지 못했어요', a = fakeCtx(), b = fakeCtx(), c = fakeCtx();
    O.drawOverlay(a.ctx, 360, 640, { missing: true });
    ok(a.texts.indexOf(msg) >= 0, '못 찾은 프레임에 안내가 없다: ' + JSON.stringify(a.texts));
    O.drawOverlay(b.ctx, 360, 640, {});
    eq(b.texts, [], '기본값으로는 아무 글자도 그리지 않는다');
    O.drawOverlay(c.ctx, 360, 640, { missing: true, hud: { title: '타격 분석 · 신뢰도 낮음', rows: [], footer: '' } });
    ok(c.texts.indexOf('타격 분석 · 신뢰도 낮음') >= 0, '요약 패널 제목');
  });
})();
