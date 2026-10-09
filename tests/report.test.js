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

  // ── 한 줄 요약 (문턱: MIN_SUM 15 · 칸 5개/45% · 방향 65% · 유형 70% · 내야안타 제외) ─────────────────────────
  // 타구를 [방향, 유형] 칸 수로 만든다. 키 = 방향(0 좌 30° · 1 중 90° · 2 우 150°) + 유형(땅 = 땅볼 아웃 · 뜬 = 플라이 아웃 · 안 = 안타, 유형 모름)
  var DEG3 = [30, 90, 150], RES3 = { 땅: '땅볼 아웃', 뜬: '플라이 아웃', 안: '안타' };
  function mix(spec) {
    var out = [];
    Object.keys(spec).forEach(function (k) { for (var i = 0; i < spec[k]; i++) out.push(ab(DEG3[+k.charAt(0)], RES3[k.charAt(1)])); });
    return out;
  }
  function rng(seed) {   // 시드 고정 난수 (mulberry32) — 외부 요청 없음
    return function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function sum(m, spec) { return m.ruleSummary(mix(spec)); }

  test('요약 규칙 0: 내야안타를 뺀 타구가 15개 미만이면 판단 보류 (14개 → 보류 · 15개 → 보류 아님)', async function () {
    var m = await import(MOD);
    var r = sum(m, { '0안': 5, '1안': 5, '2안': 4 });
    eq(r.rule, 0, '14개');
    ok(r.text.indexOf('경향 판단 보류') >= 0 && r.text.indexOf('(14개)') >= 0, r.text);
    eq(r.detail, '내야안타 제외', 'detail');
    eq(sum(m, { '0안': 5, '1안': 5, '2안': 5 }).rule, 4, '15개는 보류가 아니다');
    eq(m.ruleSummary([]).rule, 0, '빈 목록');
    ok(m.ruleSummary(null).text.indexOf('(0개)') >= 0, 'null');
  });

  test('요약 규칙 1: 방향×유형 한 칸이 유형을 아는 타구의 45% 이상 — 경계 직전(안 걸림)과 경계(걸림), 유형을 아는 타구 15개 문턱', async function () {
    var m = await import(MOD);
    // 유형을 아는 타구 15개: 우측 땅볼 6개(40%) → 안 걸림, 7개(46.7%) → 걸림
    var below = sum(m, { '2땅': 6, '0땅': 2, '0뜬': 2, '1땅': 2, '1뜬': 3 });
    eq(below.rule, 4, '6/15 = 40%');
    var at = sum(m, { '2땅': 7, '0땅': 1, '0뜬': 2, '1땅': 2, '1뜬': 3 });
    eq([at.rule, at.text], [1, '우측 땅볼 비중 높음'], '7/15');
    ok(at.detail.indexOf('15개 중 7개') >= 0, 'detail: ' + at.detail);
    // 정확히 45%: 20개 중 9개는 걸리고 8개(40%)는 안 걸린다
    eq(sum(m, { '2땅': 9, '0뜬': 4, '0땅': 1, '1뜬': 4, '1땅': 1, '2뜬': 1 }).rule, 1, '9/20 = 45%');
    eq(sum(m, { '2땅': 8, '0뜬': 4, '0땅': 1, '1뜬': 4, '1땅': 1, '2뜬': 2 }).rule, 4, '8/20 = 40%');
    // 유형을 아는 타구가 14개면 (방향 있는 타구는 15개여도) 칸 규칙은 아직 쓰지 않는다 — 7/14 = 50% 인데도
    var g14 = sum(m, { '2땅': 7, '0땅': 1, '0뜬': 2, '1땅': 2, '1뜬': 2, '1안': 1 });
    eq(g14.rule, 4, '유형 14개');
  });

  test('요약 규칙 2: 한 방향이 내야안타 제외 타구의 65% 이상 — 12/20(60%)는 안 걸림, 13/20(65%)는 걸림. 유형은 말하지 않는다', async function () {
    var m = await import(MOD);
    var below = sum(m, { '2안': 12, '0안': 4, '1안': 4 });
    eq([below.rule, below.detail], [4, '내야안타 제외 20개 기준'], '12/20');
    var at = sum(m, { '2안': 13, '0안': 4, '1안': 3 });
    eq([at.rule, at.text, at.detail], [2, '우측 타구 비중 높음', '내야안타 제외 20개 중 13개'], '13/20');
    eq(sum(m, { '1안': 13, '0안': 4, '2안': 3 }).text, '중앙 타구 비중 높음', '중앙');
    eq(sum(m, { '0안': 13, '1안': 4, '2안': 3 }).text, '좌측 타구 비중 높음', '좌측');
    ok(at.text.indexOf('땅볼') < 0 && at.text.indexOf('뜬공') < 0, '유형을 짐작해 말함');
  });

  test('요약 규칙 3: 한 유형이 유형을 아는 타구의 70% 이상 — 13/20(65%)는 안 걸림, 14/20(70%)는 걸림, 유형을 아는 타구 15개 문턱', async function () {
    var m = await import(MOD);
    var below = sum(m, { '0땅': 5, '1땅': 4, '2땅': 4, '0뜬': 2, '1뜬': 2, '2뜬': 3 });
    eq(below.rule, 4, '13/20');
    var at = sum(m, { '0땅': 5, '1땅': 5, '2땅': 4, '0뜬': 2, '1뜬': 2, '2뜬': 2 });
    eq([at.rule, at.text], [3, '땅볼 비중 높음'], '14/20');
    eq(sum(m, { '0뜬': 5, '1뜬': 5, '2뜬': 4, '0땅': 2, '1땅': 2, '2땅': 2 }).text, '뜬공 비중 높음', '뜬공');
    // 유형을 아는 타구가 14개면(나머지 6개는 안타) 유형 규칙은 쓰지 않는다 — 전부 땅볼이어도. 15개가 되면 걸린다
    eq(sum(m, { '0땅': 5, '1땅': 5, '2땅': 4, '0안': 2, '1안': 2, '2안': 2 }).rule, 4, '유형 14개');
    eq(sum(m, { '0땅': 5, '1땅': 5, '2땅': 5, '0안': 2, '1안': 2, '2안': 1 }).rule, 3, '유형 15개');
  });

  test('요약 규칙 4와 우선순위: 쏠림이 없으면 "쏠림이 뚜렷하지 않음" · 규칙은 1 → 2 → 3 순서로 먼저 맞는 것 하나', async function () {
    var m = await import(MOD);
    var none = sum(m, { '0땅': 3, '0뜬': 2, '1땅': 2, '1뜬': 3, '2땅': 3, '2뜬': 2 });
    eq([none.rule, none.text, none.detail], [4, '방향·유형 쏠림이 뚜렷하지 않음', '내야안타 제외 15개 기준'], '골고루');
    eq(sum(m, { '2땅': 12, '0뜬': 2, '1뜬': 1 }).rule, 1, '칸·방향·유형이 모두 맞으면 1');
    // 방향 13/20(65%)은 맞지만 가장 큰 칸이 8/20(40%) → 2. 유형 땅볼 15/20(75%)도 맞지만 방향이 먼저
    var r = sum(m, { '2땅': 8, '2뜬': 5, '0땅': 4, '1땅': 3 });
    eq([r.rule, r.text], [2, '우측 타구 비중 높음'], '2 가 3 보다 먼저');
  });

  test('요약은 같은 입력에 항상 같은 문구 — 두 칸이 동률로 문턱을 넘어도 정해진 순서(좌 → 중 → 우)로 하나만', async function () {
    var m = await import(MOD);
    var abs = mix({ '0땅': 7, '2땅': 7, '1뜬': 1 });   // 좌측 땅볼 7 · 우측 땅볼 7 → 둘 다 46.7%
    var first = m.ruleSummary(abs).text;
    eq(first, '좌측 땅볼 비중 높음', '동률은 좌측이 먼저');
    var rot = abs.slice();
    for (var i = 0; i < 15; i++) { rot.push(rot.shift()); eq(m.ruleSummary(rot).text, first, '회전 ' + i); }
    eq(m.ruleSummary(abs.slice().reverse()).text, first, '뒤집어도');
  });

  test('요약에서 내야안타는 뺀다: 내야안타 20개 + 일반 타구 10개는 판단 보류 (내야안타가 개수에 안 들어간다)', async function () {
    var m = await import(MOD);
    var abs = many(20, function () { return ab(90, '내야안타'); }).concat(mix({ '0안': 4, '1안': 3, '2안': 3 }));
    var r = m.ruleSummary(abs);
    eq(r.rule, 0, '규칙');
    ok(r.text.indexOf('(10개)') >= 0 && r.text.indexOf('30') < 0, r.text);
    eq(r.detail, '내야안타 제외', 'detail');
    eq(m.dirSplit(abs).n, 30, '단, dirSplit(좌·중·우 막대)은 내야안타를 그대로 센다');
  });

  test('요약에서 내야안타는 뺀다: 내야안타만 중앙(기본 방향)에 몰린 기록에서 "중앙 비중 높음"이 나오지 않는다 · 유형이 적힌 내야안타도 유형 계산에서 뺀다', async function () {
    var m = await import(MOD);
    var spread = mix({ '0땅': 3, '0뜬': 2, '1땅': 2, '1뜬': 3, '2땅': 3, '2뜬': 2 });   // 일반 타구 15개, 쏠림 없음
    var abs = many(25, function () { return ab(90, '내야안타'); }).concat(spread);
    var d = m.dirSplit(abs);
    ok(d.center / d.n > 0.65, '전제: 내야안타까지 세면 중앙이 ' + d.center + '/' + d.n);   // 예전 방식이면 "중앙 타구 비중 높음"이 나왔을 기록
    var r = m.ruleSummary(abs);
    eq([r.rule, r.text], [4, '방향·유형 쏠림이 뚜렷하지 않음'], '요약');
    var typedIh = many(12, function () { return ab(90, '내야안타', '땅볼'); }).concat(spread);   // 땅볼로 적힌 내야안타 12개 + 쏠림 없는 15개
    var r2 = m.ruleSummary(typedIh);
    ok(r2.text.indexOf('중앙') < 0, '중앙 땅볼 주장: ' + r2.text);
    eq(r2.rule, 4, '유형 계산에서도 뺀다');
  });

  test('요약 오탐: 쏠림이 전혀 없는 무작위 기록 2,000개(시드 고정 · 방향 1/3 · 땅볼:뜬공 50:50 · 안타 30% 유형 없음)에서 "비중 높음" 비율은 타구 20개일 때 15% 미만 (15·25·30개도, 10개 이하는 0%)', async function () {
    var m = await import(MOD);
    function claimRate(n, trials, hit, probs) {
      var R = rng(900 + n), c = 0;
      for (var t = 0; t < trials; t++) {
        var abs = [];
        for (var i = 0; i < n; i++) {
          var u = R(), side = u < probs[0] ? 0 : u < probs[0] + probs[1] ? 1 : 2;
          abs.push(ab(DEG3[side], R() < hit ? '안타' : (R() < 0.5 ? '땅볼 아웃' : '플라이 아웃')));
        }
        var r = m.ruleSummary(abs).rule;
        if (r >= 1 && r <= 3) c++;
      }
      return c / trials;
    }
    var U = [1 / 3, 1 / 3, 1 / 3];
    eq(claimRate(14, 300, 0.3, U), 0, '14개는 전부 보류');
    [15, 20, 25, 30].forEach(function (n) {
      var rate = claimRate(n, 2000, 0.3, U);
      ok(rate < 0.15, '타구 ' + n + '개에서 오탐 ' + (rate * 100).toFixed(1) + '%');
    });
  });

  test('요약 과보정 방지: 우측 70% 쏠림(좌15·중15·우70)은 타구 20개에서 절반 넘게 "비중 높음"으로 말한다 (시드 고정 2,000개)', async function () {
    var m = await import(MOD), R = rng(4242), c = 0, trials = 2000;
    for (var t = 0; t < trials; t++) {
      var abs = [];
      for (var i = 0; i < 20; i++) { var u = R(); abs.push(ab(DEG3[u < 0.15 ? 0 : u < 0.3 ? 1 : 2], R() < 0.3 ? '안타' : (R() < 0.5 ? '땅볼 아웃' : '플라이 아웃'))); }
      var r = m.ruleSummary(abs).rule;
      if (r >= 1 && r <= 3) c++;
    }
    ok(c / trials > 0.5, '검출 ' + (c / trials * 100).toFixed(1) + '%');
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
