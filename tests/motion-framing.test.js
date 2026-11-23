// 동작 분석 — 촬영 상태 점검 (js/motion/framing.js): 초당 프레임 · 화질 · 선수 크기 · 잘린 부위 · 지난 기록과 같은 자리
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var F;
  var near = function (v, want, tol, m) { ok(typeof v === 'number' && Math.abs(v - want) <= tol, m + ' — 기대 ' + want + ' ± ' + tol + ', 실제 ' + v); };
  var has = function (lines, part) { return lines.some(function (l) { return l.text.indexOf(part) >= 0; }); };
  // 몸통 길이 size · 골반 (cx, cy) 인 사람. footY 로 발 높이를 바꾼다
  function frame(size, cx, cy, footY) { var p = [], i; for (i = 0; i < 33; i++) p.push({ x: cx, y: cy, visibility: 1 });
    p[11] = { x: cx + 0.03, y: cy - size, visibility: 1 }; p[12] = { x: cx - 0.03, y: cy - size, visibility: 1 }; p[23] = { x: cx + 0.02, y: cy, visibility: 1 }; p[24] = { x: cx - 0.02, y: cy, visibility: 1 };
    p[0] = { x: cx, y: cy - size * 1.6, visibility: 1 }; p[27] = { x: cx + 0.02, y: footY, visibility: 1 }; p[28] = { x: cx - 0.02, y: footY, visibility: 1 };
    p[15] = { x: cx + 0.05, y: cy - size * 0.5, visibility: 1 }; p[16] = { x: cx - 0.05, y: cy - size * 0.5, visibility: 1 }; return { image: p, world: p }; }

  test('(준비) 촬영 점검 모듈을 불러온다', async function () {
    F = await import('/js/motion/framing.js?v=1');
    ok(F.framingOf && F.framingChecks && F.openChecks && F.roundFraming, '모듈 로드');
  });

  test('열 때: 초당 30프레임 · 낮은 화질은 알려 주고, 60프레임 · 720p 는 조용히', async function () {
    var low = F.openChecks({ fps: 30, width: 640, height: 360 });
    ok(has(low, '초당 30프레임') && has(low, '640×360'), JSON.stringify(low));
    eq(F.openChecks({ fps: 59.9, width: 1280, height: 720 }), [], '괜찮으면 아무 말 없음');
    eq(F.openChecks({ fps: 240, width: 1920, height: 1080 }), [], '슬로모션');
  });

  test('크기 · 위치: 몸통 길이와 골반 위치의 가운데 값 · 몸통이 안 보이면 null', async function () {
    var f = F.framingOf([frame(0.15, 0.5, 0.6, 0.9), frame(0.16, 0.52, 0.6, 0.9), frame(0.17, 0.54, 0.6, 0.9)], 1);
    near(f.size, 0.16, 1e-9, 'size'); near(f.cx, 0.52, 1e-9, 'cx'); near(f.cy, 0.6, 1e-9, 'cy');
    eq(f.cut, [], '잘린 곳 없음');
    eq(F.framingOf([{ image: null }], 1), null, '몸통 없음');
    eq(F.roundFraming({ size: 0.12345, cx: 0.5, cy: 0.66666, cut: [] }), { size: 0.123, cx: 0.5, cy: 0.667 }, '저장용');
  });

  test('분석 뒤: 작거나 너무 큼 · 발이 화면 밖 · 괜찮으면 괜찮다고', async function () {
    var small = F.framingChecks(F.framingOf([frame(0.06, 0.5, 0.6, 0.8)], 1), null);
    ok(small.length === 1 && has(small, '작게 찍혔어요'), JSON.stringify(small));
    ok(has(F.framingChecks(F.framingOf([frame(0.35, 0.5, 0.5, 0.95)], 1), null), '꽉 차요'), '너무 큼');
    var feet = F.framingChecks(F.framingOf([frame(0.15, 0.5, 0.6, 1.02), frame(0.15, 0.5, 0.6, 1.02), frame(0.15, 0.5, 0.6, 0.9)], 1), null);
    ok(has(feet, '발이 화면 밖') && has(feet, '67%'), JSON.stringify(feet));
    var hidden = frame(0.15, 0.5, 0.6, 0.9); hidden.image[15] = Object.assign({}, hidden.image[15], { visibility: 0.05 });
    eq(F.framingOf([hidden], 1).cut, [], '몸에 가려진 손(화면 안)은 세지 않는다');
    var good = F.framingChecks(F.framingOf([frame(0.15, 0.5, 0.6, 0.9)], 1), null);
    eq(good.map(function (l) { return l.tone; }), ['good'], '괜찮음');
    eq(F.framingChecks(null, null), [], '몸통 없음');
  });

  test('지난 기록과: 거리(크기)가 20% 넘게 다르거나 자리가 다르면 알려 주고, 비슷하면 좋다고', async function () {
    var now = F.framingOf([frame(0.15, 0.5, 0.6, 0.9)], 1);
    ok(has(F.framingChecks(now, { size: 0.1, cx: 0.5, cy: 0.6 }), '50% 크게'), '가까이서 찍음');
    ok(has(F.framingChecks(now, { size: 0.2, cx: 0.5, cy: 0.6 }), '25% 작게'), '멀리서 찍음');
    ok(has(F.framingChecks(now, { size: 0.15, cx: 0.3, cy: 0.6 }), '다른 자리'), '자리가 다름');
    var same = F.framingChecks(now, { size: 0.16, cx: 0.52, cy: 0.6 });
    eq(same.map(function (l) { return l.tone; }), ['good'], '비슷함'); ok(has(same, '비슷한 거리'), '문구');
  });
})();
