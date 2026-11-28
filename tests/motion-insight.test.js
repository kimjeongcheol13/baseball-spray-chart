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
    I = await import('/js/motion/insight.js?v=4');
    R = await import('/js/motion/reference.js?v=2');
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
    var zero = I.summaryLines(result({ metrics: { maxSeparation: 0 } }), null).filter(function (l) { return l.text.indexOf('분리각 0°') >= 0; })[0];
    ok(zero && zero.tone === 'warn' && zero.text.indexOf('참고만') > 0 && zero.text.indexOf('한 덩어리') < 0, '0° 는 확정해서 말하지 않는다: ' + JSON.stringify(zero));
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
    eq([R.REFERENCE.bat.pelvisPeak.low, R.REFERENCE.bat.pelvisPeak.high, R.REFERENCE.pitch.pelvisPeak.low, R.REFERENCE.pitch.pelvisPeak.high], [593, 693, 580, 766], '평균 ± 표준편차를 반올림한 범위(투구 = 157명 합친 값)');
    ok(!R.REFERENCE.bat.maxSeparation, '타격 분리각은 정의가 달라 뺐다(taguchi2023)');
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

  test('영상 주소 읽기: 유튜브 주소는 시작 시간까지 살려 보는 주소로 바꾸고, 주소가 아니면 null', async function () {
    var L = await import('/js/motion/link.js?v=1');
    eq(L.parseLink('https://youtu.be/dQw4w9WgXcQ?t=75'), { kind: 'youtube', id: 'dQw4w9WgXcQ', start: 75, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=75s' }, 'youtu.be + t');
    eq(L.parseLink('  https://www.youtube.com/watch?list=x&v=dQw4w9WgXcQ&t=1m30s ').url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s', 'watch + 1m30s · 앞뒤 공백');
    eq(L.parseLink('https://m.youtube.com/shorts/dQw4w9WgXcQ').url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'shorts · 시작 시간 없음');
    eq(L.parseLink('https://www.youtube.com/live/dQw4w9WgXcQ?si=abc').id, 'dQw4w9WgXcQ', 'live');
    eq(L.parseLink('https://example.com/clip.mp4'), { kind: 'web', url: 'https://example.com/clip.mp4' }, '다른 사이트는 그대로');
    eq([L.parseLink('youtu.be/abc'), L.parseLink('javascript:alert(1)'), L.parseLink(''), L.parseLink('https://a.com/x y')], [null, null, null, null], '주소가 아닌 것');
    eq([L.secondsOf('90'), L.secondsOf('90s'), L.secondsOf('1m30s'), L.secondsOf('1h2m3s'), L.secondsOf('abc')], [90, 90, 90, 3723, 0], 'secondsOf');
  });

  test('흔들림 폭(±): 지난 기록과의 차이가 두 폭을 더한 것보다 작으면 달라졌다고 말하지 않는다', async function () {
    var prev = { metrics: { pelvisPeak: 380, trunkPeak: 500, maxSeparation: 24 } };
    ok(has(I.summaryLines(result(), prev, { pelvisPeak: 10, trunkPeak: 30, maxSeparation: 2 }), '20% 빨라졌어요'), '차이(100) > 폭(30) → 말한다');
    var inside = I.summaryLines(result(), prev, { pelvisPeak: 30, trunkPeak: 120, maxSeparation: 2 });
    ok(!has(inside, '몸통 회전이') && !has(inside, '골반 회전이') && has(inside, '흔들림 폭(±) 안'), '골반 차이(20) < 폭(30) · 몸통 차이(100) < 폭(120) → 말하지 않고 폭 안이라고 한다: ' + JSON.stringify(inside));
    var one = I.summaryLines(result(), prev, { pelvisPeak: 10, trunkPeak: 120, maxSeparation: 2 });
    ok(has(one, '골반 회전이 5% 빨라졌어요') && !has(one, '몸통 회전이'), '폭을 넘은 것(골반)만 말한다');
    var both = I.summaryLines(result(), { metrics: prev.metrics, spread: { pelvisPeak: 15, trunkPeak: 60 } }, { pelvisPeak: 10, trunkPeak: 50 });
    ok(has(both, '흔들림 폭(±) 안'), '지난 기록의 폭도 더한다(50 + 60 > 100)');
    ok(has(I.summaryLines(result(), prev), '20% 빨라졌어요'), '폭을 모르면 예전처럼');
  });

  test('흔들림 폭(±)과 참고 범위: 폭까지 범위 밖이어야 낮음 · 높음, 걸치면 「걸침」', async function () {
    var ref = { low: 600, high: 800, unit: '°/s' };
    eq([I.positionIn(ref, 550, 20), I.positionIn(ref, 550, 60), I.positionIn(ref, 700, 50), I.positionIn(ref, 780, 50), I.positionIn(ref, 850, 30), I.positionIn(ref, 850, 60)], ['below', 'overlap', 'within', 'overlap', 'above', 'overlap'], 'positionIn');
    var r = I.referenceLine('bat', 'pelvisPeak', 560, 'mid', 40);
    ok(r.position === 'overlap' && r.text.indexOf('걸침') > 0, '걸침 문구: ' + r.text);
  });

  test('주의 문장: 후보가 둘이면 두 시각을, 분리각이 그대로면 그 범위를 말하고 분리각 풀이는 하지 않는다', async function () {
    var lines = I.summaryLines(result(), null, {}, { rivals: [0.93, 2.6], still: { from: 26, to: 28, offset: 27 } });
    ok(lines[0].tone === 'warn' && lines[0].text.indexOf('0.93초 · 2.60초') > 0, '후보 시각: ' + lines[0].text);
    ok(lines[1].tone === 'warn' && lines[1].text.indexOf('26°~28°') > 0, '그대로인 범위: ' + lines[1].text);
    ok(!has(lines, '분리각 25°'), '분리각 풀이는 빠진다');
    ok(has(I.summaryLines(result(), null, {}, {}), '분리각 25°'), '주의가 없으면 그대로');
  });
})();
