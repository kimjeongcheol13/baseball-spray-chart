// 동작 분석 — AI 훈련 코치 (js/motion/coach.js 순수 함수 · assets/motion/drills_*.json)
//  · 1단계 측정 점검 · 2단계 비교 · 후보 카드 · 4단계 검사(글자 수 · 금지 표현 · 후보 밖 카드) · 규칙 결과 · AI 되돌림 → 규칙으로 바꾸기 · 90초 초과
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var C, X, bat, pitch;
  var metric = function (key, value, o) { return Object.assign({ key: key, label: key, value: value, unit: 'deg/s', uncertainty: 10, phase: null, ref_range: null, ref_source: null }, o); };
  var session = function (o) {
    return Object.assign({ session_id: 's1', recorded_at: '2026-11-20T01:00:00.000Z', motion_type: 'batting', quality: 'mid', video: { fps: 120, view: null },
      phases: [{ name: 'foot_strike', time_s: 1 }, { name: 'contact', time_s: 1.3 }, { name: 'pelvis_peak', time_s: 1.1 }, { name: 'trunk_peak', time_s: 1.15 }, { name: 'hand_peak', time_s: 1.25 }],
      metrics: [metric('pelvis_peak_velocity', 500, { ref_range: [593, 693] }), metric('trunk_peak_velocity', 900, { ref_range: [726, 1222] }),
        metric('max_hip_shoulder_separation', 33, { unit: 'deg', uncertainty: 3, ref_range: [29, 38] }), metric('head_displacement', 10, { unit: 'pct_leg_length', uncertainty: 1 }),
        metric('pelvis_to_trunk_peak_gap', 50, { unit: 'ms', uncertainty: 5 })],
      sequence: { order: ['pelvis', 'trunk', 'hand'], estimated: true } }, o);
  };

  test('(준비) 코치 모듈 · 카드 파일을 불러온다', async function () {
    C = await import('/js/motion/coach.js?v=1');
    X = await import('/js/motion/export.js?v=1');
    bat = (await (await fetch('/assets/motion/drills_batting.json?v=1')).json()).cards;
    pitch = (await (await fetch('/assets/motion/drills_pitching.json?v=1')).json()).cards;
    ok(C.runCoach && bat.length >= 5 && pitch.length >= 5, '모듈 · 카드 로드');
  });

  test('카드: 앱이 재는 숫자만 · 투구는 팔 · 손목 지표 없음 · 전부 초안 · 2~4단계 · 근거 문구', function () {
    var keys = Object.values(X.EXPORT_KEYS).concat([C.SEQUENCE_KEY]), IS = ['below_ref', 'above_ref', 'lower_than_last', 'higher_than_last', 'sequence_off'];
    bat.concat(pitch).forEach(function (c) {
      ok(c.id && c.title && c.why && c.caution && Array.isArray(c.when) && c.when.length, c.id + ' 칸');
      c.when.forEach(function (w) { ok(keys.indexOf(w.metric) >= 0 && IS.indexOf(w.is) >= 0, c.id + ' 조건 ' + w.metric + ' ' + w.is); });
      ok(c.how.length >= 2 && c.how.length <= 4, c.id + ' 단계 수');
      eq(c.evidence.status, 'draft', c.id + ' 초안');
      ok(c.evidence.source === '근거 확인 필요' || /^참고 범위: .+ https:\/\//.test(c.evidence.source), c.id + ' 근거');
      ok(!C.FORBIDDEN.test(c.why + c.title + c.how.join('')), c.id + ' 금지 표현 없음');
    });
    pitch.forEach(function (c) { c.when.forEach(function (w) { ok(!/elbow|arm|wrist/.test(w.metric), c.id + ' 팔 지표 금지'); }); });
    eq(C.usableCards(bat, false).length, 0, '승인 카드 없으면 일반 모드는 0장');
    eq(C.usableCards(bat, true).length, bat.length, '검증 모드는 초안까지');
  });

  test('1단계: 낮은 fps · 큰 흔들림 · 못 찾은 순간은 빼고, 숫자가 모자라면 멈춘다', function () {
    var ch = C.checkMeasurements(session());
    eq(ch.stop, null, '좋은 영상은 진행');
    ok(ch.usable.indexOf('rotation_sequence') >= 0 && ch.usable.length === 6, '6개 사용');
    ch = C.checkMeasurements(session({ video: { fps: 30, view: null } }));
    ok(ch.usable.indexOf('pelvis_peak_velocity') < 0 && ch.usable.indexOf('pelvis_to_trunk_peak_gap') < 0, '30fps → 회전 속도 제외');
    ch = C.checkMeasurements(session({ metrics: [metric('pelvis_peak_velocity', 100, { uncertainty: 40 })] }));
    ok(ch.excluded.some(function (x) { return x.key === 'pelvis_peak_velocity'; }), '흔들림 40% 제외');
    ch = C.checkMeasurements(session({ phases: [{ name: 'contact', time_s: null }, { name: 'pelvis_peak', time_s: 1 }, { name: 'trunk_peak', time_s: 1 }, { name: 'hand_peak', time_s: 1 }],
      metrics: [metric('lead_knee_angle', 150, { unit: 'deg', phase: 'contact' }), metric('pelvis_peak_velocity', 600)] }));
    ok(ch.excluded.some(function (x) { return x.key === 'lead_knee_angle'; }), '임팩트 못 찾음 → 무릎 제외');
    ok(ch.stop && /2개/.test(ch.stop), '2개뿐이면 멈춤');
    ok(C.checkMeasurements(session({ quality: 'low' })).stop, '신뢰도 낮음 → 멈춤');
  });

  test('2단계: 참고 범위 · 지난 기록(흔들림 합 · 5% 넘게) · 회전 순서 → 후보 카드 정렬', function () {
    var cur = session(), use = C.checkMeasurements(cur).usable;
    var f = C.compareSession(cur, null, use);
    eq(f.map(function (x) { return x.key + ':' + x.is; }), ['pelvis_peak_velocity:below_ref'], '참고 범위만');
    var prev = session({ metrics: [metric('trunk_peak_velocity', 1000), metric('max_hip_shoulder_separation', 34, { unit: 'deg', uncertainty: 3 }), metric('head_displacement', 7, { unit: 'pct_leg_length', uncertainty: 1 })] });
    f = C.compareSession(cur, prev, use);
    ok(f.some(function (x) { return x.key === 'trunk_peak_velocity' && x.is === 'lower_than_last' && x.last === 1000; }), '몸통 1000 → 900 낮아짐');
    ok(!f.some(function (x) { return x.key === 'max_hip_shoulder_separation'; }), '34 → 33 은 흔들림 안');
    ok(f.some(function (x) { return x.key === 'head_displacement' && x.is === 'higher_than_last'; }), '머리 7 → 10');
    var off = session({ sequence: { order: ['trunk', 'pelvis', 'hand'], estimated: true } });
    ok(C.compareSession(off, null, C.checkMeasurements(off).usable).some(function (x) { return x.is === 'sequence_off'; }), '순서 어긋남');
    var cand = C.candidatesFor(f, bat);
    eq(cand[0].card.id, 'bat_hip_turn', '차이 큰 카드가 먼저');
    ok(cand.some(function (c) { return c.card.id === 'bat_head_still'; }) && cand.some(function (c) { return c.card.id === 'bat_trunk_turn'; }), '머리 · 몸통 카드 후보');
  });

  test('4단계 검사: 후보 밖 카드 · 숫자 · 글자 수 · 금지 표현을 잡는다', function () {
    var cand = [{ card: { id: 'a' }, findings: [] }, { card: { id: 'b' }, findings: [] }], use = ['pelvis_peak_velocity'];
    var good = { picked: [{ card_id: 'a', reason: '골반 회전이 낮게 나와 골랐어요.', numbers_used: ['pelvis_peak_velocity'] }], summary: '골반 회전을 먼저 연습해요.' };
    eq(C.validatePick(good, cand, use), [], '통과');
    var bad = function (o) { return C.validatePick(Object.assign({}, good, o), cand, use).length > 0; };
    ok(bad({ picked: [{ card_id: 'z', reason: '이유', numbers_used: ['pelvis_peak_velocity'] }] }), '후보 밖 카드');
    ok(bad({ picked: [{ card_id: 'a', reason: '이유', numbers_used: ['trunk_tilt'] }] }), '못 쓰는 숫자');
    ok(bad({ picked: [{ card_id: 'a', reason: new Array(62).join('가'), numbers_used: ['pelvis_peak_velocity'] }] }), '이유 61자');
    ok(bad({ summary: new Array(82).join('가') }), '요약 81자');
    ['부상 예방에 좋아요', '정확하게 나왔어요', '프로 선수처럼', '국가대표 수준', '치료가 필요해요'].forEach(function (t) { ok(bad({ summary: t }), '금지: ' + t); });
    ok(!bad({ summary: '이 프로그램대로 연습해요' }), '「프로그램」은 괜찮음');
    ok(bad({ summary: '골반 회전을 먼저 연습하면 도움이 될 수' }), '잘린 요약');
    ok(bad({ summary: '골반 회전을 먼저 연습하는 것이 중요하다.' }), '「~다」체');
    ok(bad({ summary: '골반 피크 velocity 가 낮아요.' }), '영어 낱말');
    ok(!bad({ summary: '골반 회전이 430°/s 로 낮아요.' }), '단위 °/s 는 괜찮음');
    ok(bad({ picked: [{ card_id: 'a', reason: '어깨를 잠깐닫', numbers_used: ['pelvis_peak_velocity'] }] }), '잘린 이유');
    ok(bad({ picked: [good.picked[0], good.picked[0], good.picked[0]] }), '3장');
    ok(C.validatePick(null, cand, use).length === 1, 'JSON 아님');
  });

  test('규칙 결과 · AI 되돌림 2번 뒤 규칙 · 90초 초과 · 다시 찍기', async function () {
    var snap = { player: { id: 'P-1' }, sessions: [session()] };
    var r = await C.runCoach({ snapshot: snap, cards: bat });
    eq([r.status, r.source, r.picked[0].card.id], ['ok', 'rules', 'bat_hip_turn'], 'AI 없이');
    eq(r.picked[0].reason, r.picked[0].card.why, '설명 = 카드 why');
    eq(r.steps.map(function (s) { return s.n; }), [1, 2, 3, 4], '과정 4단계');

    var calls = 0, aiGood = async function () { calls++; return '```json\n{"picked":[{"card_id":"bat_hip_turn","reason":"골반 회전이 참고 범위보다 낮아 골랐어요.","numbers_used":["pelvis_peak_velocity"]}],"summary":"골반부터 돌리는 연습을 해 봐요."}\n```'; };
    r = await C.runCoach({ snapshot: snap, cards: bat, llm: aiGood });
    eq([r.source, calls, r.picked[0].reason], ['ai', 1, '골반 회전이 참고 범위보다 낮아 골랐어요.'], 'AI 통과');

    calls = 0;
    var msgs = [], aiBad = async function (m) { calls++; msgs.push(m); return '{"picked":[{"card_id":"bat_hip_turn","reason":"부상 예방에 좋아요","numbers_used":["pelvis_peak_velocity"]}],"summary":"좋아요"}'; };
    r = await C.runCoach({ snapshot: snap, cards: bat, llm: aiBad });
    eq([r.source, calls], ['rules', 3], '처음 + 다시 2번 → 규칙');
    ok(/부상/.test(msgs[1][msgs[1].length - 1].content), '되돌린 이유를 AI 에 알려 준다');
    ok(r.steps.find(function (s) { return s.n === 4; }).lines.some(function (l) { return /규칙 결과로/.test(l); }), '과정에 남김');

    var never = function () { return new Promise(function () {}); };
    r = await C.runCoach({ snapshot: snap, cards: bat, llm: never, timeout: function () { return Promise.resolve(); } });
    ok(r.source === 'rules' && r.steps.find(function (s) { return s.n === 3; }).lines.some(function (l) { return /90초/.test(l); }), '90초 → 규칙');

    r = await C.runCoach({ snapshot: { player: { id: 'P-1' }, sessions: [session({ quality: 'low' })] }, cards: bat, llm: aiGood });
    ok(r.status === 'retake' && /다시 찍어/.test(r.summary) && !r.picked.length, '다시 찍기 안내');
    r = await C.runCoach({ snapshot: { player: { id: 'P-1' }, sessions: [session({ metrics: session().metrics.map(function (m) { return m.key === 'pelvis_peak_velocity' ? metric(m.key, 650, { ref_range: [593, 693] }) : m; }) })] }, cards: bat });
    eq(r.status, 'none', '맞는 카드 없음');
  });
})();
