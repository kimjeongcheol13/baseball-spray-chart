// 동작 분석 — 내 기록 추이 (js/motion/trend.js): 묶기 · 날짜순 점 · 처음 → 최근 요약 · 그래프
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var R;
  var entry = function (o) { return Object.assign({ id: Math.random(), at: '2026-11-01T00:00:00Z', name: '김타자', mode: 'bat', hand: 'R', quality: 'mid', metrics: { pelvisPeak: 500, trunkPeak: 700, maxSeparation: 20 } }, o); };

  test('(준비) 추이 모듈을 불러온다', async function () {
    R = await import('/js/motion/trend.js?v=1');
    ok(R.trendGroups && R.trendPoints && R.trendSummary && R.drawTrend && R.TREND_METRICS.length === 3, '모듈 로드');
  });

  test('묶기: 같은 선수 · 종류 · 좌우끼리, 2개 이상인 묶음만, 많은 순', async function () {
    var list = [entry({}), entry({ at: '2026-11-05T00:00:00Z' }), entry({ name: ' 김타자 ' }), entry({ hand: 'L' }), entry({ mode: 'pitch' }), entry({ name: '' }), entry({ name: '' })];
    var g = R.trendGroups(list);
    eq(g.map(function (x) { return [x.name, x.mode, x.hand, x.count]; }), [['김타자', 'bat', 'R', 3], ['이름 없음', 'bat', 'R', 2]], '묶음(이름 앞뒤 공백은 같은 이름)');
    eq(R.trendGroups([entry({})]), [], '1개뿐이면 없음');
  });

  test('점: 날짜순 · 값이 없는 기록은 빼고 · 흔들림 폭이 있으면 함께', async function () {
    var key = 'bat|R|김타자';
    var list = [entry({ at: '2026-11-09T00:00:00Z', metrics: { pelvisPeak: 560 }, spread: { pelvisPeak: 30 } }), entry({ at: '2026-11-01T00:00:00Z' }), entry({ at: '2026-11-05T00:00:00Z', metrics: { pelvisPeak: null } }), entry({ hand: 'L' })];
    eq(R.trendPoints(list, key, 'pelvisPeak').map(function (p) { return [p.at.slice(5, 10), p.value, p.spread]; }), [['11-01', 500, null], ['11-09', 560, 30]], 'trendPoints');
  });

  test('요약: 차이가 두 기록의 폭을 넘을 때만 달라졌다고 하고, 신뢰도 낮은 기록은 빼고, 폭을 모르면 판단하지 않는다', async function () {
    var p = function (at, v, s, q) { return { at: at, value: v, spread: s, quality: q || 'mid' }; };
    ok(R.trendSummary([p('a', 500, 20), p('b', 600, 30)], '°/s').indexOf('+100') > 0 && R.trendSummary([p('a', 500, 20), p('b', 600, 30)], '°/s').indexOf('달라졌다고 볼 수 있어요') > 0, '100 > 50');
    ok(R.trendSummary([p('a', 500, 40), p('b', 540, 30)], '°/s').indexOf('보기 어려워요') > 0, '40 < 70');
    ok(R.trendSummary([p('a', 500, null), p('b', 600, null)], '°/s').indexOf('판단하지 않았어요') > 0, '폭이 없는 예전 기록');
    ok(R.trendSummary([p('a', 500, 10, 'low'), p('b', 600, 10)], '°/s').indexOf('2개 이상') > 0, '신뢰도 낮은 것을 빼면 하나뿐');
    ok(R.trendSummary([p('a', 900, 10, 'low'), p('b', 500, 10), p('c', 600, 10)], '°/s').indexOf('처음 500') === 0, '처음은 신뢰도 낮은 기록을 건너뛴다');
  });

  test('그래프: 점마다 동그라미 · 폭이 있으면 막대 · 세로 범위는 폭까지 담는다', async function () {
    var pts = [{ at: '2026-11-01T00:00:00Z', value: 500, spread: 40, quality: 'mid' }, { at: '2026-11-08T00:00:00Z', value: 560, spread: null, quality: 'low' }];
    var svg = R.drawTrend(pts, R.TREND_METRICS[0]);
    eq(svg.querySelectorAll('circle').length, 2, '점 2개');
    eq(svg.querySelectorAll('g line').length, 1, '폭 막대는 폭이 있는 점에만');
    ok(svg.querySelector('polyline').getAttribute('points').split(' ').length === 2, '선');
    var r = R.valueRange(pts);
    ok(r.lo <= 460 && r.hi >= 560, '세로 범위가 폭(460)까지 담는다: ' + JSON.stringify(r));
    eq(R.drawTrend([], R.TREND_METRICS[0]).childNodes.length, 0, '점이 없으면 빈 그림');
    eq([R.drawTrend(pts, R.TREND_METRICS[0], 350).getAttribute('viewBox'), R.drawTrend(pts, R.TREND_METRICS[0], 100).getAttribute('width'), R.drawTrend(pts, R.TREND_METRICS[0], 0).getAttribute('width')], ['0 0 350 200', '280', '640'], '보이는 폭 그대로(최소 280 · 모르면 640)');
  });
})();
