// 선수 리포트(js/features/report.js) — 좌·중·우 · 타구 유형 · 규칙 기반 한 줄 요약 · PNG 생성.
// 순수 함수는 모듈에서 바로 불러 쓰고(앱이 이미 올린 같은 모듈 인스턴스), 그림은 앱의 openPlayerReport({ sample: true }) 로 실제로 그려 크기를 확인한다.
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;
  var MOD = '/js/features/report.js?v=2';   // js/app.js 가 import 하는 것과 같은 주소여야 같은 인스턴스다
  var BAT = '/js/features/batdata.js?v=5';

  // 타구 한 개: deg(방향) · res · launchType
  function ab(deg, res, lt, bats) { return { id: Math.random(), deg: deg, res: res || '안타', launchType: lt || null, bats: bats || 'R' }; }
  function many(n, f) { var o = []; for (var i = 0; i < n; i++) o.push(f(i)); return o; }

  test('리포트: 좌·중·우 — 앱의 당김·센터·밀어와 같은 경계(72°·108°), 좌·우타와 무관, 방향 없는 타석은 제외', async function () {
    var m = await import(MOD);
    var r = m.dirSplit([ab(0), ab(71.9), ab(72), ab(90), ab(108), ab(108.1), ab(180), ab(null, '볼넷'), { res: '삼진' }]);
    eq(r, { n: 7, left: 2, center: 3, right: 2 }, '경계값');
    var L = m.dirSplit([ab(30, '안타', null, 'L'), ab(150, '안타', null, 'L')]);
    eq([L.left, L.right], [1, 1], '좌타자도 필드 기준(좌 = 3루 쪽)');
    eq(m.dirSplit([]), { n: 0, left: 0, center: 0, right: 0 }, '빈 목록');
    eq(m.dirSplit(null).n, 0, 'null');
  });

  test('리포트: 좌·중·우의 모집단은 기존 "타구 N개" · 당김/센터/밀어(calcStats)와 같다 (우타자 기준 당김 = 좌)', async function () {
    var m = await import(MOD), b = await import(BAT);
    var abs = many(30, function (i) { return ab((i * 37) % 181, i % 4 ? '플라이 아웃' : '안타', null, 'R'); }).concat([ab(null, '볼넷')]);
    var st = b.calcStats(abs), d = m.dirSplit(abs);
    eq(d.n, st.dn, '개수');
    eq([d.left, d.center, d.right], [st.pull, st.center, st.oppo], '우타자: 좌 = 당김 · 중 = 센터 · 우 = 밀어');
  });

  test('리포트: 타구 유형 — 입력한 유형이 5개 이상이면 그것으로 센다 (뜬공 = 플라이볼)', async function () {
    var m = await import(MOD);
    var abs = [ab(50, '땅볼 아웃', '땅볼'), ab(60, '안타', '땅볼'), ab(70, '안타', '라인드라이브'), ab(80, '2루타', '라인드라이브'), ab(90, '홈런', '플라이볼'), ab(100, '플라이 아웃', '플라이볼'), ab(110, '플라이 아웃', '플라이볼')];
    eq(m.typeMix(abs), { basis: 'launch', n: 7, ground: 2, line: 2, fly: 3 }, '입력 기준');
  });

  test('리포트: 타구 유형 — 입력이 5개 미만이면 아웃 타구(땅볼 · 플라이)만 센다. 안타는 유형을 짐작해 넣지 않고, 라인드라이브는 알 수 없음(null)', async function () {
    var m = await import(MOD);
    var abs = [ab(50, '땅볼 아웃'), ab(60, '땅볼 아웃'), ab(70, '플라이 아웃'), ab(80, '안타'), ab(90, '안타'), ab(100, '2루타'), ab(110, '홈런'), ab(120, '내야안타'),
      ab(130, '안타', '라인드라이브'), ab(140, '안타', '땅볼')];   // 입력은 2개뿐 → 쓰지 않는다
    eq(m.typeMix(abs), { basis: 'out', n: 3, ground: 2, line: null, fly: 1 }, '아웃 기준');
    eq(m.typeMix(many(10, function (i) { return ab(60 + i, '안타'); })), { basis: 'out', n: 0, ground: 0, line: null, fly: 0 }, '안타만 10개 → 유형 0개');
    eq(m.typeMix(null).n, 0, 'null');
  });

  test('요약 규칙 0: 방향 있는 타구가 8개 미만이면 판단을 보류한다 (개수를 말해 준다)', async function () {
    var m = await import(MOD);
    var r = m.ruleSummary(many(7, function () { return ab(150, '땅볼 아웃'); }));
    eq(r.rule, 0, '규칙');
    ok(r.text.indexOf('판단 보류') >= 0 && r.text.indexOf('7') >= 0, r.text);
    eq(m.ruleSummary([]).rule, 0, '빈 목록');
  });

  test('요약 규칙 1: 방향 × 유형 한 칸이 유형을 아는 타구의 30% 이상(3개 이상)이면 "우측 땅볼 비중 높음"', async function () {
    var m = await import(MOD);
    // 유형을 아는 타구 12개: 우측 땅볼 5(42%) + 나머지는 흩어짐
    var abs = many(5, function () { return ab(150, '땅볼 아웃'); })
      .concat([ab(30, '플라이 아웃'), ab(40, '땅볼 아웃'), ab(90, '플라이 아웃'), ab(95, '땅볼 아웃'), ab(100, '플라이 아웃'), ab(20, '땅볼 아웃'), ab(85, '플라이 아웃')]);
    var r = m.ruleSummary(abs);
    eq(r.text, '우측 땅볼 비중 높음', '문구');
    eq(r.rule, 1, '규칙');
    ok(r.detail.indexOf('12') >= 0 && r.detail.indexOf('5') >= 0, '근거: ' + r.detail);
  });

  test('요약 규칙 2: 유형을 모르는 타구(안타 등)가 많아도 방향이 절반 이상 쏠리면 "○측 타구 비중 높음" — 유형을 짐작하지 않는다', async function () {
    var m = await import(MOD);
    var abs = many(8, function (i) { return ab(20 + i, '안타'); }).concat(many(4, function (i) { return ab(90 + i * 10, '안타'); }));   // 좌 8 · 중 4, 유형 입력 없음
    var r = m.ruleSummary(abs);
    eq([r.text, r.rule], ['좌측 타구 비중 높음', 2], '방향만');
    ok(r.text.indexOf('땅볼') < 0 && r.text.indexOf('뜬공') < 0, '유형을 말함');
  });

  test('요약 규칙 3: 방향은 고르게 흩어졌고 한 유형이 55% 이상이면 "뜬공 비중 높음"', async function () {
    var m = await import(MOD);
    var degs = [20, 40, 60, 80, 90, 100, 120, 140, 160, 30, 150, 85];   // 좌 4 · 중 4(80~100 포함 + 85…) · 우 4 에 가깝게
    var abs = degs.map(function (d, i) { return ab(d, '플라이 아웃', i < 8 ? '플라이볼' : '땅볼'); });   // 뜬공 8/12 = 67%, 어느 한 칸도 30%를 못 넘김
    var r = m.ruleSummary(abs);
    eq([r.text, r.rule], ['뜬공 비중 높음', 3], '유형');
  });

  test('요약 규칙 4: 쏠림이 없으면 "방향·유형 쏠림이 뚜렷하지 않음"', async function () {
    var m = await import(MOD);
    var types = ['땅볼', '라인드라이브', '플라이볼'];
    var abs = many(12, function (i) { return ab([20, 90, 150][i % 3] + (i % 4) * 3, '안타', types[(i + Math.floor(i / 3)) % 3]); });
    var r = m.ruleSummary(abs);
    eq([r.text, r.rule], ['방향·유형 쏠림이 뚜렷하지 않음', 4], '쏠림 없음');
  });

  test('요약은 같은 입력에 항상 같은 문구 (동률도 정해진 순서로)', async function () {
    var m = await import(MOD);
    var abs = [].concat(many(4, function () { return ab(30, '땅볼 아웃'); }), many(4, function () { return ab(150, '땅볼 아웃'); }), many(4, function () { return ab(90, '땅볼 아웃'); }));
    var first = m.ruleSummary(abs).text;
    for (var i = 0; i < 20; i++) eq(m.ruleSummary(abs.slice().reverse()).text, first, '순서를 바꿔도 같아야 함');
  });

  test('리포트 그림: 샘플 선수 리포트가 실제로 1080×1920 PNG 로 그려진다 (표본 적음 문구 · 새 블록 포함 상태로 예외 없이)', async function () {
    var errs = [], onerr = function (e) { errs.push(String(e.message || e)); };
    window.addEventListener('error', onerr);
    try {
      window.openPlayerReport({ sample: true });
      var img = document.getElementById('rpImg'), ready = false;
      for (var i = 0; i < 60 && !ready; i++) { await sleep(250); ready = !document.getElementById('rpSave').disabled && /^data:image\/png/.test(img.src); }
      ok(ready, '리포트가 그려지지 않음');
      await new Promise(function (r) { if (img.complete) r(); else img.onload = r; });
      eq([img.naturalWidth, img.naturalHeight], [1080, 1920], 'PNG 크기');
      ok(/타율/.test(img.alt), 'alt: ' + img.alt);
      eq(errs, [], '그리는 중 오류');
    } finally { window.removeEventListener('error', onerr); window.closePlayerReport(); }
  });

  test('인쇄 CSS: 샘플 모드 배지가 body 에 준 48px 위 패딩을 인쇄할 때 0 으로 되돌린다 (남아 있으면 이미지가 밀려 2쪽이 된다) — 규칙 존재 확인', async function () {
    var css = await (await fetch('/css/report.css?v=2')).text();
    var print = css.slice(css.indexOf('@media print'));
    ok(/body\.rp-printing[^{]*\{[^}]*padding-top:\s*0\s*!important/.test(print), '@media print 안에 body.rp-printing { padding-top: 0 !important } 가 없음');
    var sample = await (await fetch('/css/sample.css?v=1')).text();
    ok(/body\.sl-sample-on\s*\{[^}]*padding-top:\s*48px/.test(sample), '전제(샘플 배지의 body 패딩)가 바뀜 — 위 규칙을 다시 확인');
  });
})();
