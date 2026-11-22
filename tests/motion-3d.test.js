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
    V = await import('/js/motion/skeleton3d.js?v=6');
    O = await import('/js/motion/overlay.js?v=7');
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

  test('관절 33개가 모두 선으로 이어진다 · 얼굴은 흰색, 손 · 발은 팔다리와 같은 쪽 색', async function () {
    var used = {}, i;
    O.FULL_BONES.concat([[11, 12], [23, 24]]).forEach(function (b) { used[b[0]] = used[b[1]] = true; });
    for (i = 0; i <= 32; i++) ok(used[i], '선이 없는 관절 ' + i);
    eq(O.boneColor(0, 1, 'R'), O.COLOR.bone, '얼굴');
    eq([O.boneColor(15, 17, 'R'), O.boneColor(16, 18, 'R'), O.boneColor(27, 29, 'R'), O.boneColor(28, 30, 'R')], [O.COLOR.lead, O.COLOR.rear, O.COLOR.lead, O.COLOR.rear], '우타 손 · 발');
    eq(O.boneColor(15, 17, 'L'), O.COLOR.rear, '좌타 왼손 = 뒤');
    eq([O.isSmallJoint(0), O.isSmallJoint(13), O.isSmallJoint(19), O.isSmallJoint(27), O.isSmallJoint(31)], [true, false, true, false, true], '작은 부위');
  });

  test('동작 다시 보기: 반복 구간은 임팩트 앞 1.2초 ~ 뒤 0.5초(영상 범위 안) · 선수 주변 네모는 여유를 두고 원하는 비율로', async function () {
    var W = await import('/js/motion/view.js?v=3');
    eq(W.loopRange({ events: { main: 100 }, fps: 30 }, 300), { from: 64, to: 115 }, '가운데');
    eq(W.loopRange({ events: { main: 10 }, fps: 30 }, 20), { from: 0, to: 19 }, '영상 끝에서 자름');
    eq(W.loopRange({ events: { main: 480 }, fps: 240 }, 2000), { from: 192, to: 600 }, '슬로모션(초당 240장)');
    var fr = function (x0, x1, y0, y1) { return { image: [{ x: x0, y: y0, visibility: 1 }, { x: x1, y: y1, visibility: 1 }, { x: 0.01, y: 0.01, visibility: 0.2 }] }; };
    var frames = [fr(0.5, 0.6, 0.2, 0.8), { image: null }, fr(0.55, 0.7, 0.25, 0.9), fr(0.1, 0.2, 0.1, 0.2)];
    var b = W.cropBox(frames, 0, 2, 0.5, 0.1);
    near(b.h, 0.7 * 1.2, 1e-9, '높이 = 관절 범위 + 여유'); near(b.w, b.h * 0.5, 1e-9, '폭 = 높이 × 비율');
    near(b.x + b.w / 2, 0.6, 1e-9, '가로 가운데'); ok(b.y >= 0 && b.y + b.h <= 1 + 1e-9, '세로는 화면 안');
    ok(b.x > 0.3, '범위 밖 프레임(3번)과 흐린 관절은 넣지 않는다: ' + b.x);
    var wide = W.cropBox([fr(0.05, 0.95, 0.4, 0.6)], 0, 0, 0.5, 0.1);
    eq([wide.w, wide.x], [1, 0], '화면보다 넓어질 수 없다');
    eq(W.cropBox([{ image: null }], 0, 0, 1), { x: 0, y: 0, w: 1, h: 1 }, '사람이 없으면 화면 전체');
  });

  test('나란히 보기: 임팩트 기준 같은 실제 시간에 두 기록이 각자의 프레임을 보여 준다 · 사람이 없는 프레임은 가까운 프레임으로', async function () {
    var W = await import('/js/motion/view.js?v=3'), U = await import('/js/motion/duel.js?v=6');
    var mk = function (n, holes) { var f = [], i; for (i = 0; i < n; i++) f.push(holes.indexOf(i) >= 0 ? { world: null, image: null } : { world: [1], image: [1] }); return f; };
    var slow = { frames: mk(120, []), main: 60, fps: 30, hand: 'R' }, fast = { frames: mk(900, []), main: 480, fps: 240, hand: 'L' };
    eq([U.duelIndex(slow, 0), U.duelIndex(fast, 0)], [60, 480], '임팩트 순간');
    eq([U.duelIndex(slow, -0.5), U.duelIndex(fast, -0.5)], [45, 360], '0.5초 전(촬영 속도가 달라도 같은 실제 시간)');
    eq([U.duelIndex(slow, 0.5), U.duelIndex(slow, 9), U.duelIndex(slow, -9)], [75, 119, 0], '영상 범위 안으로');
    eq([W.nearestPose(mk(10, [4]), 4), W.nearestPose(mk(10, [4, 3, 5]), 4), W.nearestPose(mk(10, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), 4)], [3, 2, null], '가까운 프레임');
    eq(U.duelIndex({ frames: mk(20, [10]), main: 10, fps: 30, hand: 'R' }, 0), 9, '빈 프레임이면 가까운 프레임');
    eq([W.LOOP_BEFORE_S, W.LOOP_AFTER_S], [1.2, 0.5], '되풀이 구간');
    var clip = { frames: mk(120, []), main: 60, fps: 120, hz: 30, start: 10, slow: 4, hand: 'R' };   // 4배 슬로모션: 영상 1초 = 30장 = 실제 0.25초
    eq([U.videoIndex(clip, 10), U.videoIndex(clip, 12.01), U.videoIndex(clip, 99), U.videoIndex(clip, 0)], [0, 60, 119, 0], '영상 시각 → 프레임');
    near(U.videoTime(clip, 0), 10 + 60.5 / 30, 1e-9, '임팩트 순간의 영상 시각');
    near(U.videoTime(clip, -0.25), 10 + 30.5 / 30, 1e-9, '실제 0.25초 전 = 영상 1초 전');
    eq([U.playRate(0.25, 1), U.playRate(0.25, 4), U.playRate(1, 8), U.playRate(1, 32), U.playRate(0.01, 1)], [0.25, 1, 8, 16, 0.0625], '영상 재생 속도(슬로모션은 그만큼 빨리 틀어 실제 속도를 맞춘다)');
  });

  test('분석할 선수 고르기: 끌어 그린 네모에 여유를 더하고, 그냥 누르면 화면 높이 절반짜리 네모 · 화면 밖으로 안 나감 · 좌표 되돌리기', async function () {
    var W = await import('/js/motion/view.js?v=3');
    var r = W.pickRegion({ x: 0.6, y: 0.3 }, { x: 0.8, y: 0.7 }, 16 / 9, 0.1);
    near(r.w, 0.24, 1e-9, '폭 + 여유'); near(r.h, 0.48, 1e-9, '높이 + 여유'); near(r.x, 0.58, 1e-9, 'x'); near(r.y, 0.26, 1e-9, 'y');
    var back = W.pickRegion({ x: 0.8, y: 0.7 }, { x: 0.6, y: 0.3 }, 16 / 9, 0.1);
    eq([back.x, back.y, back.w, back.h].map(function (v) { return +v.toFixed(6); }), [0.58, 0.26, 0.24, 0.48], '반대로 끌어도 같다');
    var tap = W.pickRegion({ x: 0.5, y: 0.5 }, { x: 0.505, y: 0.5 }, 16 / 9);
    near(tap.h, 0.5, 1e-9, '누르기: 높이'); near(tap.w, 0.5 / (16 / 9), 1e-9, '누르기: 폭(픽셀로 정사각형)'); near(tap.x + tap.w / 2, 0.5025, 1e-9, '누른 자리가 가운데');
    var edge = W.pickRegion({ x: 0.97, y: 0.95 }, { x: 0.97, y: 0.95 }, 16 / 9);
    ok(edge.x + edge.w <= 1 + 1e-9 && edge.y + edge.h <= 1 + 1e-9 && edge.x >= 0 && edge.y >= 0, '화면 안');
    near(W.pickRegion({ x: 0.5, y: 0.5 }, { x: 0.54, y: 0.5 }, 1, 0).w, 0.08, 1e-9, '너무 작게 끌면 최소 크기');
    var m = W.mapToFrame([{ x: 0, y: 0, z: 0.5, visibility: 0.9 }, { x: 1, y: 0.5, z: 0, visibility: 1 }], { x: 0.5, y: 0.1, w: 0.3, h: 0.8 });
    near(m[0].x, 0.5, 1e-9, '왼쪽 위 x'); near(m[0].y, 0.1, 1e-9, '왼쪽 위 y'); near(m[1].x, 0.8, 1e-9, '오른쪽 x'); near(m[1].y, 0.5, 1e-9, '가운데 y');
    eq([m[0].visibility, W.mapToFrame(null, { x: 0, y: 0, w: 1, h: 1 })], [0.9, null], 'visibility 유지 · 사람 없음');
    var same = [{ x: 0.2, y: 0.3 }];
    ok(W.mapToFrame(same, null) === same, '영역이 없으면 그대로');
  });

  test('엉뚱한 곳에 잡힌 뼈대: 선수 자리에서 갑자기 튀거나 크기가 딴판인 프레임은 「못 찾음」으로 바꾸고, 천천히 움직이는 선수는 그대로 둔다', async function () {
    var K = await import('/js/motion/track.js?v=2');
    // 몸통 길이 0.1 인 사람: 골반 중심 (x, y), 어깨는 그 위 size 만큼
    var person = function (x, y, size) { var p = [], i; for (i = 0; i < 33; i++) p.push({ x: x, y: y, visibility: 1 }); p[23] = { x: x - 0.01, y: y, visibility: 1 }; p[24] = { x: x + 0.01, y: y, visibility: 1 }; p[11] = { x: x - 0.01, y: y - size, visibility: 1 }; p[12] = { x: x + 0.01, y: y - size, visibility: 1 }; return { world: p, image: p }; };
    var none = { world: null, image: null }, frames = [], i;
    for (i = 0; i < 20; i++) frames.push(person(0.4 + i * 0.004, 0.5, 0.1));   // 천천히 옆으로 움직이는 선수
    frames[5] = none; frames[6] = none;                                        // 잠깐 못 찾음
    frames[10] = person(0.1, 0.15, 0.1);                                       // 관중석으로 튐
    frames[15] = person(0.46, 0.5, 0.3);                                       // 같은 자리지만 3배 큰 다른 사람
    frames.push(person(0.12, 0.16, 0.1), person(0.12, 0.16, 0.1));             // 선수가 빠진 뒤 관중석에 계속 잡힘
    var r = K.dropStrays(frames, 1);
    eq(r.dropped, 4, '뺀 수');
    eq([10, 15, 20, 21].map(function (k) { return r.frames[k].image; }), [null, null, null, null], '엉뚱한 프레임');
    ok(r.frames[9].image && r.frames[11].image && r.frames[19].image && r.frames[0].image, '선수 프레임은 그대로');
    eq(r.frames[5], none, '원래 못 찾은 프레임은 그대로');
    var few = [person(0.4, 0.5, 0.1), person(0.9, 0.1, 0.1)];
    eq(K.dropStrays(few, 1).dropped, 0, '찾은 프레임이 너무 적으면 건드리지 않는다');
    var walk = []; for (i = 0; i < 30; i++) walk.push(person(0.2 + i * 0.0103, 0.5, 0.1));   // 내딛으며 몸통 3배 거리를 움직이는 선수(투수)
    eq(K.dropStrays(walk, 1).dropped, 0, '제자리에서 내딛는 정도의 움직임은 빼지 않는다');
    var slide = []; for (i = 0; i < 20; i++) slide.push(person(0.4, 0.5, 0.1)); for (i = 0; i < 12; i++) slide.push(person(0.4, 0.5 - (i + 1) * 0.03, 0.1));   // 조금씩 미끄러져 위(관중석)로 올라감
    var sl = K.dropStrays(slide, 1);
    ok(sl.frames[19].image && sl.frames[23].image, '머문 자리 근처는 그대로');
    var real = []; for (i = 0; i < 40; i++) real.push(person(0.41, 0.47, 0.13)); real.push(person(0.41, 0.19, 0.13));   // 실제 중계 영상의 값: 타자 위 관중석
    eq(K.dropStrays(real, 1982 / 1124).frames[40].image, null, '타자 바로 위 관중석에 잡힌 뼈대');
    eq([sl.frames[29].image, sl.frames[31].image], [null, null], '조금씩 미끄러져 멀리 벗어난 프레임');
    var wide = []; for (i = 0; i < 10; i++) wide.push(person(0.4, 0.5, 0.1)); wide[4] = person(0.4 + 0.5 / (16 / 9), 0.5, 0.1);
    eq(K.dropStrays(wide, 16 / 9).dropped, 1, '가로로 긴 영상에서도 거리를 같은 단위로 잰다');
  });

  test('영상 위 안내: 사람을 못 찾은 프레임에만 「이 프레임은 사람을 찾지 못했어요」를 그린다', async function () {
    var msg = '이 프레임은 사람을 찾지 못했어요', a = fakeCtx(), b = fakeCtx(), c = fakeCtx();
    O.drawOverlay(a.ctx, 360, 640, { missing: true });
    ok(a.texts.indexOf(msg) >= 0, '못 찾은 프레임에 안내가 없다: ' + JSON.stringify(a.texts));
    O.drawOverlay(b.ctx, 360, 640, {});
    eq(b.texts, [], '기본값으로는 아무 글자도 그리지 않는다');
    O.drawOverlay(c.ctx, 360, 640, { missing: true, hud: { title: '타격 분석 · 신뢰도 낮음', rows: [], footer: '' } });
    ok(c.texts.indexOf('타격 분석 · 신뢰도 낮음') >= 0, '요약 패널 제목');
    var pose = { image: [], world: [] }, i;
    for (i = 0; i < 33; i++) { pose.image.push({ x: 0.3 + 0.01 * i, y: 0.2 + 0.02 * i, visibility: 1 }); pose.world.push({ x: 0.01 * i, y: 0.02 * i, z: 0.01 * (i % 3), visibility: 1 }); }
    var withLabels = fakeCtx(), noLabels = fakeCtx();
    O.drawOverlay(withLabels.ctx, 360, 640, { frame: pose });
    O.drawOverlay(noLabels.ctx, 360, 640, { frame: pose, labels: false });
    ok(withLabels.texts.some(function (t) { return t.indexOf('앞무릎') === 0; }), '각도 표가 없다: ' + JSON.stringify(withLabels.texts));
    var jl = O.jointLabels(pose, 'R');
    eq(jl.map(function (l) { return [l.key, l.joint]; }), [['leadElbow', 13], ['rearElbow', 14], ['leadKnee', 25], ['rearKnee', 26]], '각도 표의 관절 번호(우타: 앞 = 왼쪽)');
    var moved = fakeCtx();
    O.drawLabels(moved.ctx, 200, 300, jl.map(function (l) { return Object.assign({}, l, { x: 0.5, y: 0.5 }); }), 1);
    eq(moved.texts.length, 4, '좌표만 바꿔 다른 화면에 그릴 수 있다');
    eq(noLabels.texts, [], 'labels: false 면 글자를 그리지 않는다');
  });

  test('화면 틀(orbit.js): 위아래 기울기는 ±90 으로 막는다 · 골반 위치와 배율은 FRAME 한 곳에서 정한다', async function () {
    var B = await import('/js/motion/orbit.js?v=1');
    eq([B.clampPitch(120), B.clampPitch(-200), B.clampPitch(15)], [90, -90, 15], 'clampPitch');
    var pts = V.projectPose(world(), 0, 0, 300, 400);
    near((pts[23].y + pts[24].y) / 2, 400 * B.FRAME.centerY, 1e-9, '골반 세로 위치');
    near(pts[23].x - pts[24].x, 0.3 * 400 / B.FRAME.heightM, 1e-9, '배율(골반 폭 0.3m)');
  });

  test('영상 위 선: 선수 크기에 맞춰 굵기를 정하고, 작게 보이면 세부(얼굴 · 손가락 · 발끝)를 줄인다', async function () {
    // 몸통 길이가 화면 짧은 변의 10% · 25% · 60% 인 사람
    var person = function (torso) { var p = []; for (var i = 0; i < 33; i++) p.push({ x: 0.5, y: 0.5, visibility: 1 }); p[11] = { x: 0.45, y: 0.3, visibility: 1 }; p[12] = { x: 0.55, y: 0.3, visibility: 1 }; p[23] = { x: 0.47, y: 0.3 + torso, visibility: 1 }; p[24] = { x: 0.53, y: 0.3 + torso, visibility: 1 }; return p; };
    var small = O.bodyScale(person(0.10), 400, 400), ref = O.bodyScale(person(0.25), 400, 400), big = O.bodyScale(person(0.60), 400, 400);
    near(ref.k, 1, 1e-9, '기준 크기는 1 배');
    ok(small.k < ref.k && small.k >= 0.7 && big.k <= 1.5 && big.k > ref.k, '작으면 가늘게 · 크면 굵게(상한 · 하한 안): ' + [small.k, big.k]);
    eq([small.detail, ref.detail, big.detail], [false, true, true], '작으면 세부를 줄인다');
    eq(O.bodyScale(person(0.10), 400, 400, 3).detail, true, '잘라 키워 보여 줄 때(zoom 3)는 세부를 그린다');
    var none = person(0.25); none[11] = undefined;
    eq(O.bodyScale(none, 400, 400), { k: 1, detail: true, face: true }, '어깨를 못 찾으면 기본값');
    var wide = person(0.60); wide[7] = { x: 0.56, y: 0.2, visibility: 1 }; wide[8] = { x: 0.44, y: 0.2, visibility: 1 };
    eq([O.bodyScale(wide, 400, 400).face, big.face], [true, false], '얼굴 점은 두 귀 사이가 충분히 넓을 때만(옆얼굴은 원 하나)');
  });

  test('각도 표: 몸 바깥에 놓고, 같은 쪽끼리 겹치지 않게 아래로 민다 · 자리가 없으면 반대쪽', async function () {
    var width = function () { return 60; }, body = { left: 0.4, right: 0.6 };
    var labels = [{ text: 'a', x: 0.42, y: 0.50 }, { text: 'b', x: 0.58, y: 0.50 }, { text: 'c', x: 0.43, y: 0.51 }];
    var p = O.placeLabels(labels, 1000, 600, 1, width, body);
    ok(p[0].bx + p[0].bw <= 400 && p[2].bx + p[2].bw <= 400, '몸 왼쪽 관절의 표는 몸 왼쪽 바깥: ' + [p[0].bx, p[2].bx]);
    ok(p[1].bx >= 600, '몸 오른쪽 관절의 표는 몸 오른쪽 바깥: ' + p[1].bx);
    ok(Math.abs(p[0].by - p[2].by) >= p[0].bh, '같은 쪽 표는 겹치지 않는다: ' + [p[0].by, p[2].by]);
    var edge = O.placeLabels([{ text: 'a', x: 0.03, y: 0.5 }], 1000, 600, 1, width, { left: 0.02, right: 0.2 });
    ok(edge[0].bx >= 200, '왼쪽에 자리가 없으면 오른쪽 바깥: ' + edge[0].bx);
    eq(O.placeLabels([], 100, 100, 1, width, body), [], '표가 없으면 빈 목록');
    eq(O.bodySpan([]), null, '관절이 없으면 범위도 없다');
  });

  test('요약 패널 자리: 선수가 화면 오른쪽에 있으면 왼쪽 위, 아니면 오른쪽 위', async function () {
    var frame = function (x) { var p = []; for (var i = 0; i < 33; i++) p.push({ x: x, y: 0.5 }); return { image: p }; };
    eq([O.hudSideFor([frame(0.8), frame(0.7), { image: null }]), O.hudSideFor([frame(0.3)]), O.hudSideFor([frame(0.5)]), O.hudSideFor([])], ['left', 'right', 'right', 'right'], 'hudSideFor');
  });

  test('네모 안의 여러 사람: 가운데에 크게 있는 사람을 고르고, 한 번 고른 사람을 따라간다', async function () {
    var K = await import('/js/motion/track.js?v=2');
    // 네모 안의 사람(가운데 cx · cy, 키 hgt) — 코 · 어깨 · 골반 · 무릎 · 발목만 채운다
    var person = function (cx, cy, hgt) { var p = [], set = function (i, dx, dy) { p[i] = { x: cx + dx, y: cy + dy * hgt }; };
      set(0, 0, -0.5); set(11, 0.03, -0.35); set(12, -0.03, -0.35); set(23, 0.02, 0); set(24, -0.02, 0); set(25, 0.02, 0.25); set(26, -0.02, 0.25); set(27, 0.02, 0.5); set(28, -0.02, 0.5); return p; };
    var pitcher = person(0.45, 0.55, 0.7), catcher = person(0.85, 0.3, 0.3), umpire = person(0.9, 0.25, 0.35);
    eq(K.chooseInRegion([catcher, pitcher, umpire], 1), 1, '엔진이 포수를 먼저 줘도 가운데의 큰 사람(투수)을 고른다');
    eq(K.chooseInRegion([catcher], 1), 0, '한 사람뿐이면 그 사람');
    eq(K.chooseInRegion([], 1), -1, '아무도 없으면 -1');
    var e = K.extentOf(pitcher, 1);
    near(e.x, 0.45, 1e-9, '가운데 x'); near(e.y, 0.55, 1e-9, '가운데 y'); near(e.height, 0.7, 1e-9, '키');
    near(K.extentOf(pitcher, 2).x, 0.9, 1e-9, '가로가 긴 네모는 x 를 그만큼 늘려 잰다');
    // 투수가 숙여서 작아지고(키 0.4) 옆으로 움직여도 계속 투수를 고른다
    var bent = person(0.52, 0.62, 0.4), batter = person(0.75, 0.35, 0.5);
    eq(K.chooseInRegion([batter, bent], 1, e), 1, '직전 자리에서 가까운 사람을 따라간다');
    eq(K.chooseInRegion([batter, bent], 1, K.extentOf(batter, 1)), 0, '직전에 고른 사람이 타자였다면 타자를 따라간다(한 번 고른 사람을 쉽게 바꾸지 않는다)');
  });
})();
