// 동작 분석 계산 (js/motion/ — motion.html 이 쓰는 순수 함수. 앱 index.html 과는 무관하고 여기서는 모듈만 불러 계산을 본다)
//  · 가짜 골격: 골반이 0.50초에 최고 675°/s, 어깨가 0.54초에 최고 1031°/s 로 돌고 손이 0.60초에 가장 빠르다 → 피크 값 · 순서 · 분리각이 그대로 나오는지
//  · 좌타 · 반대 방향 회전 · 사람이 안 잡힌 프레임 · 30fps 에서도 같은 결론인지, 저장(sl_motion_log)은 가짜 저장소로 확인한다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var A, G, S, M, ST;
  var near = function (v, want, tol, m) { ok(typeof v === 'number' && Math.abs(v - want) <= tol, m + ' — 기대 ' + want + ' ± ' + tol + ', 실제 ' + v); };
  var step = function (t, mid, len) { var u = Math.max(0, Math.min(1, (t - (mid - len / 2)) / len)); return u * u * (3 - 2 * u); };
  var rad = function (d) { return d * Math.PI / 180; };
  var P = { pelvis: { deg: 90, mid: 0.50, len: 0.20 }, trunk: { deg: 110, mid: 0.54, len: 0.16 }, hand: { mid: 0.60, len: 0.12 } };

  // t 초의 골격(33칸). hand = 앞 다리 · 던지는 팔을 정한다, turn = 회전 방향(+1 | -1)
  function pose(t, hand, turn) {
    var w = [], i;
    for (i = 0; i < 33; i++) w.push({ x: 0, y: 0, z: 0, visibility: 1 });
    var put = function (k, x, y, z) { w[k] = { x: x, y: y, z: z, visibility: 1 }; };
    var th = rad(turn * P.pelvis.deg * step(t, P.pelvis.mid, P.pelvis.len)), ts = rad(turn * P.trunk.deg * step(t, P.trunk.mid, P.trunk.len));
    var L = hand === 'L' ? { lead: [12, 14, 16, 24, 26, 28], rear: [11, 13, 15, 23, 25, 27] } : { lead: [11, 13, 15, 23, 25, 27], rear: [12, 14, 16, 24, 26, 28] };
    put(23, 0.15 * Math.cos(th), 0, 0.15 * Math.sin(th)); put(24, -0.15 * Math.cos(th), 0, -0.15 * Math.sin(th));
    put(11, 0.2 * Math.cos(ts), -0.5, 0.2 * Math.sin(ts)); put(12, -0.2 * Math.cos(ts), -0.5, -0.2 * Math.sin(ts));
    put(0, 0.02 * step(t, 0.4, 0.2), -0.7, 0);
    var stride = 0.2 + 0.5 * step(t, 0.30, 0.20);                       // 앞발이 0.2~0.4초에 내딛고 멈춘다
    put(L.lead[5], stride, 0.9, 0); put(L.lead[4], stride / 2, 0.45, 0);
    put(L.rear[5], -0.2, 0.9, 0); put(L.rear[4], -0.15, 0.45, 0);
    var ph = rad(180 * step(t, P.hand.mid, P.hand.len));                 // 던지는 손이 0.60초에 가장 빠르다
    put(L.rear[2], 0.6 * Math.cos(ph), -0.5 - 0.6 * Math.sin(ph), 0.1); put(L.rear[1], 0.3 * Math.cos(ph), -0.5 - 0.3 * Math.sin(ph), 0.05);
    put(L.lead[2], 0.3, -0.3, 0); put(L.lead[1], 0.25, -0.4, 0);
    return { world: w, image: w.map(function (p) { return { x: 0.5 + p.x * 0.3, y: 0.6 + p.y * 0.3, z: 0, visibility: 1 }; }) };
  }
  function clip(fps, hand, turn) {
    var out = [], n = Math.round(fps), i;
    for (i = 0; i < n; i++) out.push(pose((i + 0.5) / fps, hand || 'R', turn || 1));
    return out;
  }
  var run = function (o) { return A.analyzeMotion(Object.assign({ frames: clip(o.fps, o.hand, o.turn), mode: 'pitch', hand: 'R', fps: o.fps, aspect: 1 }, o)); };

  test('(준비) 동작 분석 모듈을 불러온다', async function () {
    A = await import('/js/motion/analyze.js?v=3'); G = await import('/js/motion/geometry.js?v=1'); S = await import('/js/motion/signal.js?v=1');
    M = await import('/js/motion/metrics.js?v=2'); ST = await import('/js/motion/store.js?v=1');
    ok(A.analyzeMotion && G.jointAngle && S.smooth && M.metricList && ST.loadLog, '모듈 로드');
  });

  test('각도: 팔꿈치 직각 90° · 편 팔 180° · ±180 접기 · 수직 기울기 · 팔 높이', async function () {
    near(G.jointAngle({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), 90, 1e-9, '직각');
    near(G.jointAngle({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }), 180, 1e-6, '편 팔');
    eq(G.jointAngle({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), null, '길이 0');
    eq([G.wrapDeg(190), G.wrapDeg(-190), G.wrapDeg(-180), G.wrapDeg(540)], [-170, 170, 180, 180], '접기');
    near(G.tiltFromVertical({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }), 45, 1e-9, '기울기');
    near(G.elevationDeg({ x: 0, y: 0, z: 0 }, { x: 1, y: -1, z: 0 }), 45, 1e-9, '팔 높이');
  });

  test('시계열: 빈 프레임 잇기 · 각도 이어 붙이기 · 평활은 합을 지키고 피크 자리를 옮기지 않는다 · fps 추정', async function () {
    eq(S.fillGaps([null, 1, null, 3, null]), [1, 1, 2, 3, 3], '잇기');
    eq(S.fillGaps([null, null]), null, '값 없음');
    eq(S.unwrapDeg([170, -170, -150]), [170, 190, 210], '이어 붙이기');
    var sm = S.smooth([0, 0, 0, 10, 0, 0, 0], 1);
    near(sm.reduce(function (a, b) { return a + b; }, 0), 10, 0.2, '합');
    eq(S.argMax(sm), 3, '피크 자리');
    eq(S.derivative([0, 1, 2, 3], 0.5), [2, 2, 2, 2], '미분');
    var times = function (f) { var a = [], i; for (i = 0; i < 12; i++) a.push(i / f); return a; };
    eq([S.fpsFromMediaTimes(times(30)), S.fpsFromMediaTimes(times(29.97)), S.fpsFromMediaTimes(times(60)), S.fpsFromMediaTimes(times(240)), S.fpsFromMediaTimes([0, 0])], [30, 30, 60, 60, 30], 'fps');
  });

  test('120fps: 골반 675 · 몸통 1031°/s 가 ±10% 안, 순서는 골반 › 몸통 › 손, 간격 40ms', async function () {
    var r = run({ fps: 120 });
    ok(r.ok, '분석 실패 ' + r.reason);
    near(r.metrics.pelvisPeak, 675, 67, '골반 피크');
    near(r.metrics.trunkPeak, 1031, 103, '몸통 피크');
    ok(r.metrics.pelvisPeak <= 675 && r.metrics.trunkPeak <= 1031, '평활은 피크를 키우지 않는다');
    eq(r.metrics.sequence.order, ['pelvis', 'trunk', 'hand'], '순서');
    eq(r.metrics.sequence.proximalToDistal, true, '몸 중심 → 바깥');
    near(r.metrics.sequence.pelvisToTrunkMs, 40, 9, '골반 → 몸통 간격');
    near(r.events.main / 120, 0.60, 0.02, '릴리스(손 최고 속도) 시점');
    near(r.events.plant / 120, 0.40, 0.04, '앞발 착지 시점');
    eq(r.quality.level, 'high', '신뢰도');
  });

  test('분리각 · 자세: 골격에서 직접 잰 값과 같다', async function () {
    var r = run({ fps: 120 }), best = 0, t, d;
    for (t = 0; t <= 0.6; t += 0.001) { d = P.pelvis.deg * step(t, P.pelvis.mid, P.pelvis.len) - P.trunk.deg * step(t, P.trunk.mid, P.trunk.len); if (d > best) best = d; }
    near(r.metrics.maxSeparation, best, 3, '최대 분리각');
    near(r.metrics.stride, 0.7 / 0.9 * 100, 6, '스트라이드(다리 길이 대비 %)');
    near(r.metrics.trunkTilt, 0, 1, '몸통 기울기');
    ok(r.metrics.leadKnee > 150 && r.metrics.leadKnee <= 180, '앞무릎 ' + r.metrics.leadKnee);
    ok(r.metrics.armAngle > 30, '릴리스 팔 높이 ' + r.metrics.armAngle);
    ok(typeof r.metrics.elbowAtPlant === 'number', '착지 팔꿈치');
    eq('headMove' in r.metrics, false, '투구에는 머리 이동이 없다');
    ok(typeof run({ fps: 120, mode: 'bat' }).metrics.headMove === 'number', '타격에는 머리 이동이 있다');
  });

  test('좌투 · 반대 방향으로 돌아도 값과 순서가 같다 (타깃 쪽 회전이 +)', async function () {
    var a = run({ fps: 120 }), b = run({ fps: 120, hand: 'L', turn: -1 });
    ok(b.ok, '분석 실패');
    near(b.metrics.pelvisPeak, a.metrics.pelvisPeak, 1, '골반 피크');
    near(b.metrics.maxSeparation, a.metrics.maxSeparation, 1, '분리각');
    eq(b.metrics.sequence.order, ['pelvis', 'trunk', 'hand'], '순서');
    ok(Math.min.apply(null, b.series.pelvisVel) > -30, '타깃 쪽 회전이 + 여야 한다');
  });

  test('30fps: 값은 낮게 나오지만(절반 이상) 순서는 유지 · 「느린 영상」 안내가 붙는다', async function () {
    var r = run({ fps: 30 });
    ok(r.ok, '분석 실패');
    ok(r.metrics.pelvisPeak > 337 && r.metrics.pelvisPeak < 675, '골반 피크 ' + r.metrics.pelvisPeak);
    ok(r.events.pelvisPeak <= r.events.trunkPeak && r.events.trunkPeak <= r.events.handPeak, '순서');
    eq([r.quality.level, r.quality.notes], ['mid', ['lowFps']], '신뢰도');
    near(r.metrics.sequence.resolutionMs, 33.3, 0.1, '한 프레임 간격');
  });

  test('사람이 안 잡힌 프레임 몇 개는 이어서 계산하고, 절반 넘게 없으면 분석하지 않는다', async function () {
    var f = clip(120), full = run({ fps: 120 });
    [40, 41, 55, 70].forEach(function (i) { f[i] = { world: null, image: null }; });
    var r = A.analyzeMotion({ frames: f, mode: 'pitch', hand: 'R', fps: 120 });
    ok(r.ok, '분석 실패');
    near(r.metrics.pelvisPeak, full.metrics.pelvisPeak, 40, '골반 피크');
    eq(r.metrics.sequence.order, ['pelvis', 'trunk', 'hand'], '순서');
    var gone = clip(120).map(function (x, i) { return i % 3 ? { world: null, image: null } : x; });
    eq(A.analyzeMotion({ frames: gone, mode: 'pitch', hand: 'R', fps: 120 }).reason, 'noPose', '사람 없음');
    eq(A.analyzeMotion({ frames: clip(120).slice(0, 5), mode: 'pitch', hand: 'R', fps: 120 }).reason, 'short', '너무 짧음');
  });

  test('가만히 선 영상: 회전이 없다고 알리고 신뢰도를 낮춘다 (순서를 믿으라고 하지 않는다)', async function () {
    var still = [], i;
    for (i = 0; i < 60; i++) still.push(pose(0, 'R', 1));
    var r = A.analyzeMotion({ frames: still, mode: 'bat', hand: 'R', fps: 60 });
    ok(r.ok, '분석 실패');
    eq([r.quality.level, r.quality.notes], ['low', ['noRotation']], '신뢰도');
    ok(M.NOTE_TEXT.noRotation, '안내 문구');
  });

  test('관절이 순간 뒤집힌 프레임(좌우 엉덩이 · 어깨가 바뀜)은 빼고 계산해 피크가 부풀지 않는다', async function () {
    var f = clip(120), clean = run({ fps: 120 }), swap = function (w, a, b) { var t = w[a]; w[a] = w[b]; w[b] = t; };
    [50, 58, 59, 66].forEach(function (i) { swap(f[i].world, 23, 24); swap(f[i].world, 11, 12); });
    var r = A.analyzeMotion({ frames: f, mode: 'pitch', hand: 'R', fps: 120 });
    ok(r.ok, '분석 실패');
    near(r.metrics.pelvisPeak, clean.metrics.pelvisPeak, clean.metrics.pelvisPeak * 0.1, '골반 피크');
    near(r.metrics.trunkPeak, clean.metrics.trunkPeak, clean.metrics.trunkPeak * 0.1, '몸통 피크');
    ok(r.metrics.trunkPeak < 2500, '한계를 넘는 피크 ' + r.metrics.trunkPeak);
    eq(clean.quality.jumpRatio, 0, '깨끗한 영상은 뺀 프레임이 없다');
    ok(r.quality.jumpRatio > 0 && r.quality.jumpRatio < 0.1, '뺀 비율 ' + r.quality.jumpRatio);
    var d = A.dropJumps([0, 2, 181, 4, null, 6], 1 / 120);
    eq([d.values, d.jump], [[0, 2, null, 4, null, 6], [false, false, true, false, false, false]], 'dropJumps');
    var many = A.dropJumps([0, 180, 180, 180, 180, 180, 180, 180], 1 / 120);
    eq(many.values[6], 180, '연달아 튀면 실제 자세로 받아들인다');
    ok(M.noteText('jumpy', { jumpRatio: 0.2, windowValid: 1 }).indexOf('20%') >= 0, '안내 문구');
  });

  test('회전 속도가 사람 몸으로 나오기 어려운 값이면 신뢰도를 낮추고 알린다', async function () {
    var keep = P.pelvis.len, keepT = P.trunk.len;
    P.pelvis.len = 0.03; P.trunk.len = 0.03;
    var r;
    try { r = run({ fps: 240 }); } finally { P.pelvis.len = keep; P.trunk.len = keepT; }
    ok(r.ok, '분석 실패');
    eq(r.quality.level, 'low', '신뢰도 (골반 ' + Math.round(r.metrics.pelvisPeak) + ' · 몸통 ' + Math.round(r.metrics.trunkPeak) + ')');
    ok(r.quality.notes.indexOf('tooFast') >= 0 || r.quality.notes.indexOf('jumpy') >= 0, '안내 ' + JSON.stringify(r.quality.notes));
    ok(M.NOTE_TEXT.tooFast, '안내 문구');
    eq(run({ fps: 120 }).quality.notes.indexOf('tooFast'), -1, '정상 속도에는 붙지 않는다');
  });

  test('자동 임팩트 · 릴리스는 사람을 못 찾은 프레임을 고르지 않는다', async function () {
    var f = clip(120), full = run({ fps: 120 }), m = full.events.main;
    f[m] = { world: null, image: null };
    var r = A.analyzeMotion({ frames: f, mode: 'pitch', hand: 'R', fps: 120 });
    ok(r.ok, '분석 실패');
    ok(r.events.main !== m && f[r.events.main].world, '빈 프레임(' + m + ')을 골랐다: ' + r.events.main);
    ok(Math.abs(r.events.main - m) <= 2, '원래 자리 근처여야 한다: ' + r.events.main + ' vs ' + m);
  });

  test('임팩트 · 릴리스를 직접 정하면 그 프레임 기준으로 다시 잰다', async function () {
    var r = run({ fps: 120, eventIndex: 66 });
    eq([r.events.main, r.events.auto], [66, false], '직접 정한 프레임');
    eq(r.metrics.sequence.order, ['pelvis', 'trunk', 'hand'], '순서');
    eq(run({ fps: 120, eventIndex: 9999 }).events.main, 119, '범위를 넘으면 마지막 프레임');
  });

  test('지표 정의: 타격 7개 · 투구 8개, 저장용 요약은 반올림한 숫자만', async function () {
    eq([M.metricList('bat').length, M.metricList('pitch').length], [7, 8], '지표 수');
    eq(M.sequenceText(['pelvis', 'trunk', 'hand']), '골반 › 몸통 › 손(추정)', '순서 문구');
    eq([M.formatValue(785.6), M.formatValue(null), M.formatValue(NaN)], ['786', '–', '–'], '값 표시');
    var s = M.summarize(run({ fps: 120 }));
    eq(Object.keys(s), M.metricList('pitch').map(function (m) { return m.key; }), '요약 키');
    ok(Object.keys(s).every(function (k) { return s[k] === null || Number.isInteger(s[k]); }), '정수 아님');
  });

  test('뼈대 선: 앞 팔다리 Teal · 뒤 Amber · 몸통 옆선 흰색, 반쯤 가려지면 점선, 거의 안 보이면 그리지 않는다', async function () {
    var O = await import('/js/motion/overlay.js?v=4'), lm = pose(0.5, 'R', 1).image;
    eq(O.boneStyle(11, 13, 'R', lm), { color: O.COLOR.lead, dashed: false }, '우타 왼팔 = 앞');
    eq(O.boneStyle(12, 14, 'R', lm), { color: O.COLOR.rear, dashed: false }, '우타 오른팔 = 뒤');
    eq(O.boneStyle(11, 13, 'L', lm).color, O.COLOR.rear, '좌타 왼팔 = 뒤');
    eq(O.boneStyle(25, 27, 'R', lm).color, O.COLOR.lead, '우타 왼다리 = 앞');
    eq(O.boneStyle(11, 23, 'R', lm).color, O.COLOR.bone, '몸통 옆선');
    lm[13] = Object.assign({}, lm[13], { visibility: 0.4 });
    eq(O.boneStyle(11, 13, 'R', lm).dashed, true, '반쯤 가려진 팔꿈치 → 점선');
    lm[13] = Object.assign({}, lm[13], { visibility: 0.1 });
    eq(O.boneStyle(11, 13, 'R', lm), null, '거의 안 보이는 팔꿈치 → 그리지 않는다');
    ok(O.COLOR.casing && O.COLOR.bone === '#ffffff', '선 아래 어두운 테두리 색');
  });

  test('신뢰도 안내: 사람을 놓친 비율을 실제 숫자로 알려 준다', async function () {
    var t = M.noteText('lowVisibility', { windowValid: 0.62 });
    ok(t.indexOf('38%') >= 0, '비율이 없다: ' + t);
    eq(M.noteText('lowFps', { windowValid: 1 }), M.NOTE_TEXT.lowFps, '다른 안내는 그대로');
  });

  test('저장: 최신이 앞 · 30개까지 · 지우기 · 같은 종류의 앞 기록 찾기 · 깨진 값은 빈 목록', async function () {
    var mem = {}, box = { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = v; } }, i;
    var e = function (id, mode) { return { id: id, at: id, mode: mode, hand: 'R', metrics: { pelvisPeak: id } }; };
    eq(ST.loadLog(box), [], '처음엔 비어 있다');
    for (i = 1; i <= 32; i++) ok(ST.addEntry(e(i, i % 2 ? 'bat' : 'pitch'), box), '저장 실패');
    eq(Object.keys(mem), ['sl_motion_log'], '쓰는 키');
    var list = ST.loadLog(box);
    eq([list.length, list[0].id, list[29].id], [30, 32, 3], '30개 · 최신이 앞');
    eq(ST.previousEntry(list, list[0]).id, 30, '같은 종류의 앞 기록');
    ST.removeEntry(32, box);
    eq(ST.loadLog(box)[0].id, 31, '지우기');
    mem.sl_motion_log = '{깨짐';
    eq(ST.loadLog(box), [], '깨진 값');
    eq(ST.addEntry(e(1, 'bat'), { getItem: function () { return null; }, setItem: function () { throw new Error('quota'); } }), false, '저장 실패는 false');
  });
})();
