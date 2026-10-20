// 랜딩 숫자 모션(assets/landing/js/motion.js) — 히어로 "타석 1개 추가" 틱 배열이 샘플 김민준 1~15타석의 실제 누적값인지.
// js/sample.js 의 생성 코드를 그대로 돌리고 앱의 calcStats 로 다시 계산해 motion.js 의 PA 줄과 비교한다. 마지막 타석은 랜딩 마크업 숫자와도 같아야 한다.
(function () {
  var T = window.__T;
  async function text(url) { return (await fetch(url)).text(); }

  T.test('랜딩 모션: 히어로 틱 배열 = 샘플 김민준 누적 AVG · OPS · 당김/센터/밀어', async function () {
    var src = await text('/js/sample.js');
    var a = src.indexOf('/* ── 샘플 데이터'), b = src.indexOf('// 지금 화면(메모리)');
    T.ok(a > 0 && b > a, 'sample.js 생성 코드 구간을 찾지 못함');
    var games = new Function(src.slice(a, b) + '; return buildGames();')();
    var abs = [].concat.apply([], games.map(function (g) { return g.abs.filter(function (x) { return x.bname === '김민준'; }); }));
    T.eq(abs.length, 15, '김민준 타석 수');

    var B = await import('/js/features/batdata.js');
    var want = abs.map(function (_, i) {
      var s = B.calcStats(abs.slice(0, i + 1)), p = function (v) { return Math.round(v / s.dn * 100); };
      return [B.f3(s.avg), B.f3(s.ops), p(s.pull), p(s.center), p(s.oppo)];
    });
    var m = /var PA = (\[.*\]);/.exec(await text('/assets/landing/js/motion.js'));
    T.ok(m, 'motion.js 에서 PA 줄을 찾지 못함');
    T.eq(JSON.parse(m[1]), want, 'PA 배열');

    var doc = new DOMParser().parseFromString(await text('/landing.html'), 'text/html');
    var chips = [].map.call(doc.querySelectorAll('.hero .chip > b'), function (e) { return e.textContent; });
    var w = want[want.length - 1];
    T.eq(chips, [w[0], w[1], w[2] + ' · ' + w[3] + ' · ' + w[4] + '%'], '히어로 마크업 = 15타석 누적');
  });
})();
