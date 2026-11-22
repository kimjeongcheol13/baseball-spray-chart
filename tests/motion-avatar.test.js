// 동작 분석 「사람 모형」 화면 (js/motion/avatar.js) 의 계산 + 두 3D 화면이 같이 쓰는 틀 (js/motion/orbit.js)
//  · three.js 와 모형 파일은 바깥에서 내려받는 것이라 여기서는 부르지 않는다. 뼈에 줄 목표 방향 계산만 본다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var A, B, V;
  var near = function (v, want, tol, m) { ok(typeof v === 'number' && Math.abs(v - want) <= tol, m + ' — 기대 ' + want + ' ± ' + tol + ', 실제 ' + v); };
  var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var vec = function (v, want, m) { for (var i = 0; i < 3; i++) near(v[i], want[i], 1e-9, m + ' [' + i + ']'); };

  // 카메라를 보고 똑바로 선 사람 (MediaPipe 좌표: x 화면 오른쪽 · y 아래 · z 카메라에서 멀어짐). 왼쪽 관절은 화면 오른쪽(+x)
  function standing() {
    var w = [], i;
    for (i = 0; i < 33; i++) w.push({ x: 0, y: 0, z: 0, visibility: 1 });
    var set = function (i, x, y, z) { w[i] = { x: x, y: y, z: z, visibility: 1 }; };
    set(0, 0, -0.65, -0.1); set(7, 0.08, -0.65, 0); set(8, -0.08, -0.65, 0);
    set(11, 0.2, -0.5, 0); set(12, -0.2, -0.5, 0); set(13, 0.2, -0.2, 0); set(14, -0.2, -0.2, 0);
    set(15, 0.2, 0.1, 0); set(16, -0.2, 0.1, 0); set(19, 0.2, 0.2, 0); set(20, -0.2, 0.2, 0);
    set(23, 0.1, 0, 0); set(24, -0.1, 0, 0); set(25, 0.1, 0.4, 0); set(26, -0.1, 0.4, 0);
    set(27, 0.1, 0.8, 0); set(28, -0.1, 0.8, 0); set(31, 0.1, 0.85, -0.15); set(32, -0.1, 0.85, -0.15);
    return w;
  }
  // 세로축 둘레로 deg 만큼 돈 사람 (선 화면의 rotatePoint 와 같은 회전)
  var turned = function (deg) { return standing().map(function (p) { var r = V.rotatePoint(p, deg, 0); return { x: r.x, y: r.y, z: r.z, visibility: 1 }; }); };
  var limb = function (t, bone) { return t.limbs.filter(function (l) { return l.bone === bone; })[0].dir; };

  test('(준비) 사람 모형 계산 · 화면 틀 모듈을 불러온다 (바깥 요청 없이)', async function () {
    A = await import('/js/motion/avatar.js?v=1');
    B = await import('/js/motion/orbit.js?v=1');
    V = await import('/js/motion/skeleton3d.js?v=5');
    ok(A.poseTargets && A.bodyAxes && A.toScene && A.viewRotation && A.createAvatar && B.attachOrbit, '모듈 로드');
  });

  test('좌표 바꾸기: y 와 z 의 부호만 뒤집는다', async function () {
    vec(A.toScene({ x: 0.3, y: -0.5, z: 0.2 }), [0.3, 0.5, -0.2], 'toScene');
  });

  test('몸 축: 세 축이 서로 직각 · 길이 1 · 위 방향 힌트가 기울어도 왼쪽 축은 그대로', async function () {
    var ax = A.bodyAxes([2, 0, 0], [0.3, 1, 0.1]);
    vec(ax.left, [1, 0, 0], '왼쪽');
    near(dot(ax.left, ax.up), 0, 1e-9, '왼쪽 ⟂ 위'); near(dot(ax.up, ax.forward), 0, 1e-9, '위 ⟂ 앞'); near(dot(ax.left, ax.forward), 0, 1e-9, '왼쪽 ⟂ 앞');
    near(dot(ax.up, ax.up), 1, 1e-9, '위 길이'); near(dot(ax.forward, ax.forward), 1, 1e-9, '앞 길이');
    ok(ax.up[1] > 0.9, '위 축은 힌트 쪽: ' + JSON.stringify(ax.up));
  });

  test('똑바로 선 자세: 몸 · 머리가 카메라(+z)를 보고, 팔다리는 아래로, 발은 앞으로', async function () {
    var t = A.poseTargets(standing());
    vec(t.hips.left, [1, 0, 0], '골반 왼쪽'); vec(t.hips.up, [0, 1, 0], '골반 위'); vec(t.hips.forward, [0, 0, 1], '골반 앞');
    vec(t.chest.forward, [0, 0, 1], '가슴 앞');
    vec(t.head.forward, [0, 0, 1], '머리 앞'); vec(t.head.up, [0, 1, 0], '머리 위');
    eq(t.limbs.length, 12, '팔다리 뼈 수');
    vec(limb(t, 'LeftArm'), [0, -1, 0], '왼팔'); vec(limb(t, 'RightLeg'), [0, -1, 0], '오른 정강이');
    ok(limb(t, 'LeftFoot')[2] > 0.9, '발끝은 앞(+z): ' + JSON.stringify(limb(t, 'LeftFoot')));
    eq(t.limbs.map(function (l) { return l.bone; }).slice(0, 3), ['LeftArm', 'LeftForeArm', 'LeftHand'], '부모 뼈부터 차례로');
  });

  test('돌아선 자세: 사람이 돈 만큼 몸의 앞 방향도 돈다 · 어깨만 돌리면 가슴만 돈다(분리)', async function () {
    var t = A.poseTargets(turned(90));
    near(Math.abs(t.hips.forward[0]), 1, 1e-9, '90도 돌면 앞 방향이 옆(x)');
    near(t.hips.forward[2], 0, 1e-9, '카메라 쪽 성분 없음');
    var w = standing(), r = function (i) { var p = V.rotatePoint(w[i], 40, 0); w[i] = { x: p.x, y: p.y, z: p.z, visibility: 1 }; };
    r(11); r(12);
    var s = A.poseTargets(w), angle = Math.acos(Math.max(-1, Math.min(1, dot(s.hips.forward, s.chest.forward)))) * 180 / Math.PI;
    vec(s.hips.forward, [0, 0, 1], '골반은 그대로');
    near(angle, 40, 1e-6, '골반과 가슴이 벌어진 각');
  });

  test('보는 방향: 선 화면과 같은 쪽으로 돈다 (yaw 는 부호 반대의 y 회전 · pitch 는 x 회전)', async function () {
    var r = A.viewRotation(90, 30);
    near(r.y, -Math.PI / 2, 1e-12, 'y'); near(r.x, Math.PI / 6, 1e-12, 'x');
    // 장면 좌표의 점을 Rx(pitch)·Ry(-yaw) 로 돌린 결과가 rotatePoint 를 장면 좌표로 옮긴 것과 같아야 한다
    var p = { x: 0.3, y: -0.5, z: 0.2 }, yaw = 37, pitch = -22, q = A.viewRotation(yaw, pitch), s = A.toScene(p);
    var x1 = s[0] * Math.cos(q.y) + s[2] * Math.sin(q.y), z1 = -s[0] * Math.sin(q.y) + s[2] * Math.cos(q.y);
    var y2 = s[1] * Math.cos(q.x) - z1 * Math.sin(q.x), z2 = s[1] * Math.sin(q.x) + z1 * Math.cos(q.x);
    vec([x1, y2, z2], A.toScene(V.rotatePoint(p, yaw, pitch)), '같은 회전');
  });

  test('화면 틀: 위아래 기울기는 ±90 으로 막는다 · 골반 위치와 배율은 한 곳에서 정한다', async function () {
    eq([B.clampPitch(120), B.clampPitch(-200), B.clampPitch(15)], [90, -90, 15], 'clampPitch');
    ok(B.FRAME.heightM > 2 && B.FRAME.centerY > 0 && B.FRAME.centerY < 1, 'FRAME: ' + JSON.stringify(B.FRAME));
    var pts = V.projectPose(standing(), 0, 0, 300, 400);
    near((pts[23].y + pts[24].y) / 2, 400 * B.FRAME.centerY, 1e-9, '선 화면의 골반 세로 위치');
    near(pts[25].y - pts[23].y, 0.4 * 400 / B.FRAME.heightM, 1e-9, '선 화면의 배율(0.4m)');
  });
})();
