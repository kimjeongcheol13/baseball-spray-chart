// 동작 분석 — 긴 영상에서 스윙 · 투구 순간 찾기 (js/motion/scan.js): 움직임 봉우리 찾기 · 사람 확인 · 구간 잡기
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var S;
  var near = function (v, want, tol, m) { ok(typeof v === 'number' && Math.abs(v - want) <= tol, m + ' — 기대 ' + want + ' ± ' + tol + ', 실제 ' + v); };
  // 30초 영상을 0.1초 간격으로: 평소 움직임 0.001, bursts = [[시각, 높이, 몰림]], cuts = 화면이 바뀐 시각
  function samples(bursts, cuts, focus) {
    var out = [], i;
    for (i = 1; i <= 300; i++) {
      var t = i / 10, level = 0.001, f = focus || 0.7;
      bursts.forEach(function (b) { var d = Math.abs(t - b[0]); if (d < 0.3) { level += b[1] * (1 - d / 0.3); if (b[2] !== undefined) f = b[2]; } });
      out.push({ t: t, level: level, focus: f, cut: (cuts || []).some(function (c) { return Math.abs(c - t) < 0.05; }) });
    }
    return out;
  }

  test('(준비) 순간 찾기 모듈을 불러온다', async function () {
    S = await import('/js/motion/scan.js?v=1');
    ok(S.findMoments && S.focusOf && S.verifyMoment && S.probeWindow && S.rangeAround, '모듈 로드');
  });

  test('몰림: 한 곳만 바뀌면 1 에 가깝고, 화면 전체가 고르게 바뀌면 0.1 쯤 · 같으면 0', async function () {
    var n = 100 * 4, a = new Uint8ClampedArray(n), b = new Uint8ClampedArray(n), c = new Uint8ClampedArray(n), i;
    for (i = 0; i < n; i += 4) { c[i] = c[i + 1] = c[i + 2] = 50; }
    b[0] = b[1] = b[2] = 200;
    near(S.focusOf(a, b), 1, 1e-9, '한 칸만');
    near(S.focusOf(a, c), 0.1, 1e-9, '전체가 고르게');
    eq([S.focusOf(a, a), S.focusOf(null, a)], [0, 0], '같은 화면 · 견줄 수 없음');
  });

  test('봉우리: 평소보다 솟은 곳을 찾고, 가까운 것은 하나로, 시각 순으로', async function () {
    var m = S.findMoments(samples([[5, 0.01], [12, 0.006], [12.8, 0.004], [25, 0.02]]), 30);
    eq(m.map(function (x) { return Math.round(x.peak); }), [5, 12, 25], '세 곳(12.8 은 12 와 2초 안이라 하나로)');
    var a = m[0];
    near(a.start, a.peak - 1.6, 1e-9, '구간 시작 = 봉우리 1.6초 전'); near(a.end, a.peak + 1.0, 1e-9, '구간 끝 = 1초 뒤');
    eq(S.findMoments(samples([]), 30), [], '솟은 곳이 없으면 없음');
  });

  test('봉우리: 화면이 바뀐 곳은 건너뛰고 구간이 장면 밖으로 나가지 않는다 · 퍼진 움직임(카메라 이동)은 거의 버린다', async function () {
    var m = S.findMoments(samples([[10.5, 0.01]], [10]), 30);
    eq(m.length, 1, '하나');
    ok(m[0].start >= 10, '장면 시작(10초) 앞으로 나가지 않는다: ' + m[0].start);
    eq([m[0].shotFrom > 10, m[0].shotTo], [true, 30], '장면 경계');
    eq(S.findMoments(samples([[15, 0.02, 0.32]]), 30), [], '몰림 0.32 (화면 전체가 움직임) → 버림');
    eq(S.findMoments(samples([[15, 0.02, 0.8]]), 30).length, 1, '같은 크기라도 한 곳에 몰리면 후보');
  });

  test('사람 확인: 몸통이 보이고 손이 빠르면 통과 · 몸이 너무 크거나(클로즈업) 몸통이 안 보이면 탈락 · 가장 빠른 시각', async function () {
    // 몸통 길이 size(화면 높이 대비), 손목이 0.1초마다 dx 씩 움직이는 사람
    var frames = function (size, dx, seenEvery) { var out = [], k, i; for (k = 0; k < 8; k++) { var p = []; for (i = 0; i < 33; i++) p.push({ x: 0.5, y: 0.5, visibility: 1 });
      p[11] = { x: 0.48, y: 0.5 - size, visibility: 1 }; p[12] = { x: 0.52, y: 0.5 - size, visibility: 1 }; p[23] = { x: 0.48, y: 0.5, visibility: 1 }; p[24] = { x: 0.52, y: 0.5, visibility: 1 };
      p[15] = { x: 0.5 + dx * k * (k === 5 ? 1.5 : 1), y: 0.4, visibility: 1 }; p[16] = { x: 0.5, y: 0.4, visibility: 1 };
      out.push({ t: k * 0.1, image: seenEvery && k % seenEvery ? null : p }); } return out; };
    var swing = S.verifyMoment(frames(0.15, 0.08), 1);
    ok(swing.ok && swing.seen === 8 && Math.abs(swing.size - 0.15) < 1e-9, '스윙: ' + JSON.stringify(swing));
    near(swing.at, 0.45, 1e-9, '손이 가장 빨랐던 시각(4 → 5 장면 사이)');
    eq(S.verifyMoment(frames(0.15, 0.002), 1).ok, false, '손이 느리면 탈락');
    eq(S.verifyMoment(frames(0.35, 0.2), 1).ok, false, '클로즈업(몸통 0.35)은 탈락');
    eq(S.verifyMoment(frames(0.15, 0.08, 4), 1), { ok: false, speed: 0, seen: 2, size: 0, at: null }, '몸통이 2장면만 보이면 탈락');
  });

  test('확인 구간 · 분석 구간: 봉우리 앞을 넓게 보고, 분석 구간은 가장 빠른 순간 앞 1.6초 · 뒤 1초를 장면 안에서', async function () {
    var m = { peak: 15.6, shotFrom: 12.6, shotTo: 15.9 };
    var w = S.probeWindow(m);
    near(w.from, 14.4, 1e-9, '봉우리 1.2초 전부터'); near(w.to, 15.9, 1e-9, '장면 끝까지');
    var r = S.rangeAround(m, 14.3);
    near(r.start, 12.7, 1e-9, '시작'); near(r.end, 15.3, 1e-9, '끝');
    eq(S.rangeAround(m, 13.0).start, 12.6, '장면 앞으로는 나가지 않는다');
  });

  test('확인 순서: 움직임이 몰린 후보부터, 같은 무리 안에서는 크게 솟은 것부터', async function () {
    var m = [{ peak: 1, score: 8, focus: 0.38 }, { peak: 2, score: 2.8, focus: 0.86 }, { peak: 3, score: 5, focus: 0.7 }, { peak: 4, score: 9, focus: 0.4 }];
    eq(S.checkOrder(m).map(function (x) { return x.peak; }), [3, 2, 4, 1], 'checkOrder');
    var f = S.findMoments(samples([[5, 0.01]]), 30)[0];
    ok(f.focus > 0.6 && f.focus <= 0.7 + 1e-9, '후보에 몰림이 붙는다: ' + f.focus);
  });
})();
