// 동작 분석 결과 풀이 (js/motion/insight.js) · 참고 범위 (reference.js) · 영상 끌어다 놓기 (drop.js)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var I, R, D;
  var has = function (lines, part) { return lines.some(function (l) { return l.text.indexOf(part) >= 0; }); };
  var tones = function (lines) { return lines.map(function (l) { return l.tone; }); };
  // 결과 한 건: 골반 → 몸통 순서, 몸통이 1.5배 빠름, 분리각 25°
  function result(over) {
    var base = { mode: 'bat', hand: 'R', quality: { level: 'mid', notes: [] },
      metrics: { pelvisPeak: 400, trunkPeak: 600, maxSeparation: 25, sequence: { order: ['pelvis', 'trunk', 'hand'], proximalToDistal: true, pelvisToTrunkMs: 33, resolutionMs: 33.3 } } };
    var r = JSON.parse(JSON.stringify(base)), k;
    for (k in (over || {})) {
      if (k === 'metrics' || k === 'quality') Object.assign(r[k], over[k]); else r[k] = over[k];
    }
    return r;
  }

  test('(준비) 풀이 · 참고 범위 · 끌어다 놓기 모듈을 불러온다', async function () {
    I = await import('/js/motion/insight.js?v=1');
    R = await import('/js/motion/reference.js?v=1');
    D = await import('/js/motion/drop.js?v=1');
    ok(I.summaryLines && I.readText && I.referenceLine && I.positionIn && R.REFERENCE && D.videoFrom && D.attachDrop, '모듈 로드');
  });

  test('한눈에 보기: 골반 먼저 · 몸통이 더 빠름 · 분리각 · 지난 기록 없음을 차례로 말한다', async function () {
    var lines = I.summaryLines(result(), null);
    eq(lines.length, 4, '문장 수: ' + JSON.stringify(lines));
    ok(lines[0].text.indexOf('골반이 먼저') === 0 && lines[0].text.indexOf('33ms') > 0, '순서: ' + lines[0].text);
    ok(has(lines, '1.5배 빠르게'), '속도비'); ok(has(lines, '분리각 25°'), '분리각'); ok(has(lines, '저장해 두면'), '지난 기록 없음');
    eq(tones(lines), ['good', 'good', 'info', 'info'], '어조');
  });

  test('한눈에 보기: 몸통이 먼저 · 같은 프레임 · 피크 없음을 구분한다', async function () {
    var early = I.summaryLines(result({ metrics: { sequence: { order: ['trunk', 'pelvis'], proximalToDistal: false, pelvisToTrunkMs: -67, resolutionMs: 33.3 } } }), null)[0];
    eq(early.tone, 'warn', '몸통 먼저는 주의'); ok(early.text.indexOf('67ms 먼저') > 0, early.text);
    var handFirst = I.summaryLines(result({ metrics: { sequence: { order: ['pelvis', 'hand', 'trunk'], proximalToDistal: false, pelvisToTrunkMs: 33, resolutionMs: 33.3 } } }), null)[0];
    ok(handFirst.tone === 'info' && handFirst.text.indexOf('손(추정)이 몸통보다 먼저') > 0, '손이 몸통보다 먼저: ' + handFirst.text);
    var same = I.summaryLines(result({ metrics: { sequence: { order: [], proximalToDistal: true, pelvisToTrunkMs: 0, resolutionMs: 33.3 } } }), null)[0];
    ok(same.text.indexOf('같은 프레임') > 0 && same.text.indexOf('33ms') > 0, same.text);
    var none = I.summaryLines(result({ metrics: { sequence: { order: [], proximalToDistal: null, pelvisToTrunkMs: null, resolutionMs: 33.3 } } }), null)[0];
    ok(none.text.indexOf('찾지 못해') > 0, none.text);
  });

  test('한눈에 보기: 몸통이 더 느리면 그 숫자를 말하고, 분리각은 작음 · 큼을 구분한다', async function () {
    ok(has(I.summaryLines(result({ metrics: { pelvisPeak: 500, trunkPeak: 400 } }), null), '몸통 회전(400°/s)이 골반(500°/s)보다 느렸어요'), '느린 몸통');
    ok(has(I.summaryLines(result({ metrics: { pelvisPeak: 500, trunkPeak: 510 } }), null), '비슷했어요'), '비슷');
    ok(has(I.summaryLines(result({ metrics: { maxSeparation: 8 } }), null), '한 덩어리로'), '작은 분리각');
    ok(has(I.summaryLines(result({ metrics: { maxSeparation: 48 } }), null), '크게 먼저'), '큰 분리각');
    ok(!has(I.summaryLines(result({ metrics: { maxSeparation: null } }), null), '분리각'), '값이 없으면 말하지 않는다');
  });

  test('한눈에 보기: 지난 기록과 가장 크게 달라진 것 하나만 말한다 · 거의 같으면 같다고 한다', async function () {
    var prev = { metrics: { pelvisPeak: 380, trunkPeak: 500, maxSeparation: 24 } };
    var lines = I.summaryLines(result(), prev);
    ok(has(lines, '몸통 회전이 20% 빨라졌어요(500 → 600°/s)'), JSON.stringify(lines));
    ok(!has(lines, '골반 회전이'), '작은 변화는 말하지 않는다');
    ok(has(I.summaryLines(result(), { metrics: { pelvisPeak: 400, trunkPeak: 610, maxSeparation: 26 } }), '거의 같아요'), '거의 같음');
    ok(has(I.summaryLines(result({ metrics: { trunkPeak: 450 } }), { metrics: { pelvisPeak: 400, trunkPeak: 600, maxSeparation: 25 } }), '25% 느려졌어요'), '느려짐');
    ok(has(I.summaryLines(result({ metrics: { maxSeparation: 34 } }), { metrics: { pelvisPeak: 400, trunkPeak: 600, maxSeparation: 25 } }), '분리각이 9° 커졌어요(25° → 34°)'), '분리각 변화');
  });

  test('한눈에 보기: 회전을 못 찾으면 풀이하지 않고, 신뢰도가 낮으면 맨 앞에 알린다', async function () {
    var none = I.summaryLines(result({ quality: { level: 'low', notes: ['noRotation'] } }), null);
    eq(none.length, 1, '문장 하나'); ok(none[0].text.indexOf('풀이하지 않았어요') > 0, none[0].text);
    var low = I.summaryLines(result({ quality: { level: 'low', notes: ['jumpy'] } }), null);
    ok(low[0].tone === 'warn' && low[0].text.indexOf('신뢰도가 낮아요') === 0, low[0].text);
  });

  test('숫자마다 읽는 법: 화면에 나오는 지표 모두에 한 줄이 있다', async function () {
    var M = await import('/js/motion/metrics.js?v=2');
    ['bat', 'pitch'].forEach(function (mode) {
      M.metricList(mode).forEach(function (m) { ok(I.readText(m.key).length > 10, mode + ' · ' + m.key + ' 설명 없음'); });
    });
    eq(I.readText('없는키'), '', '모르는 지표는 빈 글자');
  });

  test('참고 범위: 값이 낮음 · 안 · 높음을 가르고, 신뢰도가 낮으면 위치를 말하지 않는다', async function () {
    var ref = { low: 600, high: 800, unit: '°/s' };
    eq([I.positionIn(ref, 599), I.positionIn(ref, 600), I.positionIn(ref, 800), I.positionIn(ref, 801), I.positionIn(ref, null), I.positionIn(null, 700)], ['below', 'within', 'within', 'above', null, null], 'positionIn');
    eq(I.referenceLine('bat', 'stride', 50, 'high'), null, '참고 범위가 없는 지표');
    ['bat', 'pitch'].forEach(function (mode) {
      Object.keys(R.REFERENCE[mode]).forEach(function (key) {
        var ref2 = R.REFERENCE[mode][key];
        ok(ref2.low < ref2.high && ref2.unit && ref2.source, mode + ' · ' + key + ': ' + JSON.stringify(ref2));
        var mid = I.referenceLine(mode, key, (ref2.low + ref2.high) / 2, 'high'), low = I.referenceLine(mode, key, ref2.low - 1, 'mid'), poor = I.referenceLine(mode, key, ref2.low - 1, 'low');
        eq([mid.position, low.position, poor.position], ['within', 'below', null], mode + ' · ' + key + ' 위치');
        ok(mid.text.indexOf('참고 범위 ' + ref2.low + '~' + ref2.high) === 0 && mid.text.indexOf('범위 안') > 0, mid.text);
        ok(poor.text.indexOf('범위보다') < 0, '신뢰도 낮음: ' + poor.text);
      });
      ok(R.REFERENCE_SOURCES[mode].length > 0 && R.REFERENCE_SOURCES[mode].every(function (s) { return /^https:\/\//.test(s.url) && s.label; }), mode + ' 출처');
    });
    ok(R.REFERENCE_NOTE.bat.indexOf('참고로만') > 0 && R.REFERENCE_NOTE.pitch.indexOf('참고로만') > 0, '주의 문구');
    eq([R.REFERENCE.bat.pelvisPeak.low, R.REFERENCE.bat.pelvisPeak.high, R.REFERENCE.bat.maxSeparation.low, R.REFERENCE.bat.maxSeparation.high], [593, 693, 29, 38], '평균 ± 표준편차를 반올림한 범위');
    eq(Object.keys(R.REFERENCE.pitch), ['pelvisPeak'], '투구는 골반만(나머지는 근거가 모자라 넣지 않는다)');
  });

  test('끌어다 놓기: 영상 파일만 고른다 (종류 표시가 없으면 확장자로)', async function () {
    var f = function (name, type) { return { name: name, type: type }; };
    eq(D.videoFrom([f('a.png', 'image/png'), f('swing.mp4', 'video/mp4')]).name, 'swing.mp4', '영상을 고른다');
    eq(D.videoFrom([f('clip.MOV', '')]).name, 'clip.MOV', '확장자로 판단');
    eq(D.videoFrom([f('a.png', 'image/png'), f('memo.txt', 'text/plain')]), null, '영상이 없으면 null');
    eq(D.videoFrom(null), null, '빈 입력');
  });

  test('끌어다 놓기: 파일을 끌 때만 반응하고, 놓으면 영상은 열고 아니면 거절한다', async function () {
    var box = document.createElement('div'), log = [];
    var detach = D.attachDrop(box, { onFile: function (f) { log.push('file:' + f.name); }, onReject: function () { log.push('reject'); }, onHover: function (on) { log.push('hover:' + on); } });
    var fire = function (name, types, files) {
      var e = new Event(name, { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'dataTransfer', { value: { types: types, files: files || [] } });
      box.dispatchEvent(e); return e.defaultPrevented;
    };
    eq(fire('dragenter', ['text/plain']), false, '글자를 끄는 것은 건드리지 않는다');
    eq(log, [], '반응 없음');
    ok(fire('dragenter', ['Files']) && fire('dragover', ['Files']), '파일이면 기본 동작을 막는다');
    fire('dragenter', ['Files']); fire('dragleave', ['Files']);
    eq(log, ['hover:true', 'hover:true'], '안쪽 요소를 드나들어도 안내가 꺼지지 않는다');
    fire('dragleave', ['Files']);
    eq(log[log.length - 1], 'hover:false', '완전히 나가면 꺼진다');
    log.length = 0;
    fire('dragenter', ['Files']); fire('drop', ['Files'], [{ name: 'swing.mp4', type: 'video/mp4' }]);
    eq(log, ['hover:true', 'hover:false', 'file:swing.mp4'], '영상을 놓음');
    log.length = 0;
    fire('drop', ['Files'], [{ name: 'a.png', type: 'image/png' }]);
    eq(log, ['hover:false', 'reject'], '영상이 아닌 파일');
    detach(); log.length = 0;
    fire('drop', ['Files'], [{ name: 'swing.mp4', type: 'video/mp4' }]);
    eq(log, [], '떼면 반응하지 않는다');
  });
})();
