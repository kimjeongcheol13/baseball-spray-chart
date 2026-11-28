// 동작 분석 — AI 훈련 코치 (js/motion/coach.js 순수 함수 · assets/motion/drills_*.json · evidence.json · evidence.js)
//  · 카드 · 근거 목록 짝 맞춤 · 1단계 측정 점검(회전 순서 120fps · 피크 시각) · 2단계 비교(참고 범위로는 고르지 않음 · 2프레임 기준) · 후보 카드
//  · 4단계 검사(글자 수 · 금지 표현 · 후보 밖 카드) · 규칙 결과 · AI 되돌림 → 규칙으로 바꾸기 · 90초 초과 · 근거 화면
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var C, X, E, bat, pitch, ev;
  var metric = function (key, value, o) { return Object.assign({ key: key, label: key, value: value, unit: 'deg/s', uncertainty: 10, phase: null, ref_range: null, ref_source: null }, o); };
  var phases = function (pelvis, trunk, hand) { return [{ name: 'foot_strike', time_s: 1 }, { name: 'contact', time_s: 1.3 }, { name: 'pelvis_peak', time_s: pelvis }, { name: 'trunk_peak', time_s: trunk }, { name: 'hand_peak', time_s: hand }]; };
  var session = function (o) {
    return Object.assign({ session_id: 's1', recorded_at: '2026-11-20T01:00:00.000Z', motion_type: 'batting', quality: 'mid', video: { fps: 120, view: null },
      phases: phases(1.1, 1.15, 1.25),
      metrics: [metric('pelvis_peak_velocity', 500, { ref_range: [593, 693] }), metric('trunk_peak_velocity', 900, { ref_range: [726, 1222] }),
        metric('max_hip_shoulder_separation', 33, { unit: 'deg', uncertainty: 3 }), metric('head_displacement', 10, { unit: 'pct_leg_length', uncertainty: 1 }),
        metric('pelvis_to_trunk_peak_gap', 50, { unit: 'ms', uncertainty: 5 })],
      sequence: { order: ['pelvis', 'trunk', 'hand'], estimated: true } }, o);
  };
  var prevSession = function (o) { return session(Object.assign({ session_id: 's0', recorded_at: '2026-11-10T01:00:00.000Z', metrics: [metric('pelvis_peak_velocity', 600)] }, o)); };
  var ENDS = /요\.(\s*\([^)]*\))?$|요\s*\([^)]*\)\.$/; // 「~요.」 · 끝에 괄호 덧붙임 허용(「~요(…).」 · 「~요. (…)」)

  test('(준비) 코치 모듈 · 카드 파일 · 근거 목록을 불러온다', async function () {
    C = await import('/js/motion/coach.js?v=2');
    X = await import('/js/motion/export.js?v=2');
    E = await import('/js/motion/evidence.js?v=1');
    bat = (await (await fetch('/assets/motion/drills_batting.json?v=2')).json()).cards;
    pitch = (await (await fetch('/assets/motion/drills_pitching.json?v=2')).json()).cards;
    ev = await E.loadEvidence();
    ok(C.runCoach && bat.length === 5 && pitch.length === 5 && ev.papers.length > 0, '모듈 · 카드 · 근거 로드');
  });

  test('카드: 앱이 재는 숫자만 · 지난 기록 · 순서 조건만 · 전부 초안 · 근거 수준 · refs 가 근거 목록과 맞음', function () {
    var keys = Object.values(X.EXPORT_KEYS).concat([C.SEQUENCE_KEY]), IS = ['lower_than_last', 'higher_than_last', 'sequence_off'];
    var byId = {}; ev.papers.forEach(function (p) { byId[p.id] = p; });
    bat.concat(pitch).forEach(function (c) {
      ok(c.id && c.title && c.why && c.caution && Array.isArray(c.when) && c.when.length, c.id + ' 칸');
      c.when.forEach(function (w) { ok(keys.indexOf(w.metric) >= 0 && IS.indexOf(w.is) >= 0, c.id + ' 조건 ' + w.metric + ' ' + w.is); });
      ok(c.how.length >= 2 && c.how.length <= 4, c.id + ' 단계 수');
      eq(c.evidence.status, 'draft', c.id + ' 초안');
      ok(Object.keys(C.EVIDENCE_LEVEL).indexOf(c.evidence.level) >= 0, c.id + ' 근거 수준 ' + c.evidence.level);
      ok(ENDS.test(c.evidence.summary), c.id + ' 요약은 「요.」로 끝남');
      ok(Array.isArray(c.evidence.refs) && c.evidence.refs.length >= 1, c.id + ' refs 1개 이상');
      c.evidence.refs.forEach(function (id) { ok(byId[id] && byId[id].cards.indexOf(c.id) >= 0, c.id + ' ↔ ' + id); });
      ok(!C.FORBIDDEN.test(c.why + c.title + c.how.join('')), c.id + ' 금지 표현 없음');
    });
    var cards = {}; bat.concat(pitch).forEach(function (c) { cards[c.id] = c; });
    ev.papers.forEach(function (p) { p.cards.forEach(function (id) { ok(cards[id] && cards[id].evidence.refs.indexOf(p.id) >= 0, p.id + ' → ' + id + ' 카드 refs 에도 있음'); }); });
    eq(C.EVIDENCE_LEVEL, ev.levels, 'EVIDENCE_LEVEL 글자 = evidence.json levels');
    pitch.forEach(function (c) { c.when.forEach(function (w) { ok(!/elbow|arm|wrist/.test(w.metric), c.id + ' 팔 지표 금지'); }); });
    eq(C.usableCards(bat, false).length, 0, '승인 카드 없으면 일반 모드는 0장');
    eq(C.usableCards(bat, true).length, bat.length, '검증 모드는 초안까지');
  });

  test('evidence.json: id 겹침 없음 · 필수 칸 · 라벨 표 · https 주소', function () {
    var ids = ev.papers.map(function (p) { return p.id; });
    eq(ids.length, new Set(ids).size, 'id 겹침 없음');
    ev.papers.forEach(function (p) {
      ['short', 'citation', 'url', 'kind', 'type', 'direction', 'finding', 'limits'].forEach(function (k) { ok(typeof p[k] === 'string' && p[k].length > 0, p.id + ' ' + k); });
      ok(ev.kinds[p.kind] && ev.types[p.type] && ev.directions[p.direction] && ev.sports[p.sport], p.id + ' 라벨');
      ok(/^https:\/\//.test(p.url), p.id + ' https');
      ok(Array.isArray(p.cards), p.id + ' cards');
    });
    ok(ev.measurement_notes.can_say.length && ev.measurement_notes.cannot_say.length, '말해도 되는 것 · 안 되는 것');
  });

  test('evidenceText: 승인 · 논문 검토 초안 · 근거 없음', function () {
    eq(C.evidenceText({ evidence: { status: 'draft', level: 'mixed', refs: ['a'] } }), '논문 검토 초안 · 연구 결과 엇갈림', 'draft + refs');
    eq(C.evidenceText({ evidence: { status: 'coach_approved', level: 'supported', refs: ['a'] } }), '코치 확인 · 뒷받침하는 연구 있음', '승인');
    eq(C.evidenceText({ evidence: { status: 'draft', level: 'weak', refs: [] } }), '초안 · 근거 확인 필요', 'refs 없음');
    eq(C.evidenceText({ evidence: { status: 'draft', source: '참고 범위: 옛날 문구' } }), '초안 · 근거 확인 필요', 'source 는 더 읽지 않는다');
  });

  test('1단계: 낮은 fps · 큰 흔들림 · 못 찾은 순간 · 순서는 120fps · 피크 시각이 있어야, 숫자가 모자라면 멈춘다', function () {
    var ch = C.checkMeasurements(session());
    eq(ch.stop, null, '좋은 영상은 진행');
    ok(ch.usable.indexOf('rotation_sequence') >= 0 && ch.usable.length === 6, 'fps 120 · 순서 정상 → 6개 사용');
    ch = C.checkMeasurements(session({ video: { fps: 30, view: null } }));
    ok(ch.usable.indexOf('pelvis_peak_velocity') < 0 && ch.usable.indexOf('pelvis_to_trunk_peak_gap') < 0, '30fps → 회전 속도 제외');
    var seqWhy = function (c) { var x = c.excluded.filter(function (e) { return e.key === 'rotation_sequence'; })[0]; return x ? x.why : null; };
    ch = C.checkMeasurements(session({ video: { fps: 60, view: null } }));
    ok(ch.usable.indexOf('rotation_sequence') < 0 && /120/.test(seqWhy(ch)), 'fps 60 → 순서 제외: ' + seqWhy(ch));
    ok(ch.usable.indexOf('pelvis_peak_velocity') >= 0, 'fps 60 이면 회전 속도는 그대로');
    ch = C.checkMeasurements(session({ video: { fps: null, view: null } }));
    ok(/몰라/.test(seqWhy(ch)), 'fps 모름 → 순서 제외: ' + seqWhy(ch));
    ch = C.checkMeasurements(session({ phases: [] }));
    ok(ch.usable.indexOf('rotation_sequence') < 0 && /시각이 없어/.test(seqWhy(ch)), 'phases: [] → 순서 제외: ' + seqWhy(ch));
    ch = C.checkMeasurements(session({ metrics: [metric('pelvis_peak_velocity', 100, { uncertainty: 40 })] }));
    ok(ch.excluded.some(function (x) { return x.key === 'pelvis_peak_velocity'; }), '흔들림 40% 제외');
    ch = C.checkMeasurements(session({ phases: [{ name: 'contact', time_s: null }, { name: 'pelvis_peak', time_s: 1 }, { name: 'trunk_peak', time_s: 1 }, { name: 'hand_peak', time_s: 1 }],
      metrics: [metric('lead_knee_angle', 150, { unit: 'deg', phase: 'contact' }), metric('pelvis_peak_velocity', 600)] }));
    ok(ch.excluded.some(function (x) { return x.key === 'lead_knee_angle'; }), '임팩트 못 찾음 → 무릎 제외');
    ok(ch.stop && /2개/.test(ch.stop), '2개뿐이면 멈춤');
    ok(C.checkMeasurements(session({ quality: 'low' })).stop, '신뢰도 낮음 → 멈춤');
  });

  test('2단계: 참고 범위로는 고르지 않음 · 지난 기록(흔들림 합 · 5% 넘게) · 회전 순서는 2프레임 이상 → 후보 카드 정렬', function () {
    var cur = session(), use = C.checkMeasurements(cur).usable;
    eq(C.compareSession(cur, null, use), [], '참고 범위 밖(500 < 593)이어도 지난 기록 없으면 findings 0');
    var prev = session({ metrics: [metric('pelvis_peak_velocity', 600), metric('trunk_peak_velocity', 1000), metric('max_hip_shoulder_separation', 34, { unit: 'deg', uncertainty: 3 }), metric('head_displacement', 7, { unit: 'pct_leg_length', uncertainty: 1 })] });
    var f = C.compareSession(cur, prev, use);
    ok(f.every(function (x) { return x.is !== 'below_ref' && x.is !== 'above_ref'; }), '참고 범위 판정 없음');
    ok(f.some(function (x) { return x.key === 'trunk_peak_velocity' && x.is === 'lower_than_last' && x.last === 1000; }), '몸통 1000 → 900 낮아짐');
    ok(!f.some(function (x) { return x.key === 'max_hip_shoulder_separation'; }), '34 → 33 은 흔들림 안');
    ok(f.some(function (x) { return x.key === 'head_displacement' && x.is === 'higher_than_last'; }), '머리 7 → 10');
    var seqOff = function (s) { return C.compareSession(s, null, C.checkMeasurements(s).usable).some(function (x) { return x.is === 'sequence_off'; }); };
    var order = { order: ['trunk', 'pelvis', 'hand'], estimated: true };
    ok(!seqOff(session({ sequence: order, phases: phases(1.1, 1.1 - 1 / 120, 1.25) })), '몸통이 1프레임 먼저 → 어긋남 아님(재는 오차)');
    ok(seqOff(session({ sequence: order, phases: phases(1.1, 1.1 - 2 / 120, 1.25) })), '2프레임 먼저 → 어긋남');
    ok(seqOff(session({ sequence: order, phases: phases(1.1, 1.1 - 3 / 120, 1.25) })), '3프레임 먼저 → 어긋남');
    ok(seqOff(session({ phases: phases(1.1, 1.15, 1.15 - 3 / 120) })), '손이 몸통보다 3프레임 먼저 → 어긋남');
    ok(!seqOff(session({ sequence: order, video: { fps: 60, view: null }, phases: phases(1.1, 1.0, 1.25) })), 'fps 60 은 순서를 보지 않는다');
    var cand = C.candidatesFor(f, bat);
    eq(cand[0].card.id, 'bat_head_still', '차이 큰 카드가 먼저(머리 7 → 10 = 43% > 골반 600 → 500 = 17%)');
    ok(cand.some(function (c) { return c.card.id === 'bat_head_still'; }) && cand.some(function (c) { return c.card.id === 'bat_trunk_turn'; }), '머리 · 몸통 카드 후보');
    var sys = C.buildMessages(f, cand, use)[0].content;
    ok(/근거는 앱이 카드 아래에/.test(sys) && /지난 기록보다 낮아져서 골랐어요/.test(sys) && !/참고 범위/.test(sys), 'AI 지시: 근거 말 금지 · 예시는 지난 기록');
  });

  test('4단계 검사: 후보 밖 카드 · 숫자 · 글자 수 · 금지 표현(근거 주장 포함)을 잡는다', function () {
    var cand = [{ card: { id: 'a' }, findings: [] }, { card: { id: 'b' }, findings: [] }], use = ['pelvis_peak_velocity'];
    var good = { picked: [{ card_id: 'a', reason: '골반 회전이 낮게 나와 골랐어요.', numbers_used: ['pelvis_peak_velocity'] }], summary: '골반 회전을 먼저 연습해요.' };
    eq(C.validatePick(good, cand, use), [], '통과');
    var bad = function (o) { return C.validatePick(Object.assign({}, good, o), cand, use).length > 0; };
    var reason = function (t) { return { picked: [{ card_id: 'a', reason: t, numbers_used: ['pelvis_peak_velocity'] }] }; };
    ok(bad({ picked: [{ card_id: 'z', reason: '이유', numbers_used: ['pelvis_peak_velocity'] }] }), '후보 밖 카드');
    ok(bad({ picked: [{ card_id: 'a', reason: '이유', numbers_used: ['trunk_tilt'] }] }), '못 쓰는 숫자');
    ok(bad(reason(new Array(62).join('가'))), '이유 61자');
    ok(bad({ summary: new Array(82).join('가') }), '요약 81자');
    ['부상 예방에 좋아요', '정확하게 나왔어요', '프로 선수처럼', '국가대표 수준', '치료가 필요해요'].forEach(function (t) { ok(bad({ summary: t }), '금지: ' + t); });
    ok(bad(reason('연구에서 좋다고 나와 골랐어요.')), '이유에 「연구」');
    ok(bad(reason('구속이 오르는 연습이라 골랐어요.')), '이유에 「구속」');
    ['논문대로 연습해요.', '효과가 있는 연습이에요.', '배트 속도가 빨라져요.', '타구속도가 올라가요.'].forEach(function (t) { ok(bad({ summary: t }), '금지: ' + t); });
    ok(!bad({ summary: '이 프로그램대로 연습해요' }), '「프로그램」은 괜찮음');
    ok(bad({ summary: '골반 회전을 먼저 연습하면 도움이 될 수' }), '잘린 요약');
    ok(bad({ summary: '골반 회전을 먼저 연습하는 것이 중요하다.' }), '「~다」체');
    ok(bad({ summary: '골반 피크 velocity 가 낮아요.' }), '영어 낱말');
    ok(!bad({ summary: '골반 회전이 430°/s 로 낮아요.' }), '단위 °/s 는 괜찮음');
    ok(bad(reason('어깨를 잠깐닫')), '잘린 이유');
    ok(bad({ picked: [good.picked[0], good.picked[0], good.picked[0]] }), '3장');
    ok(C.validatePick(null, cand, use).length === 1, 'JSON 아님');
  });

  test('규칙 결과 · AI 되돌림 2번 뒤 규칙 · 90초 초과 · 다시 찍기 · 지난 기록 없음', async function () {
    var snap = { player: { id: 'P-1' }, sessions: [prevSession(), session()] };
    var r = await C.runCoach({ snapshot: snap, cards: bat });
    eq([r.status, r.source, r.picked[0].card.id], ['ok', 'rules', 'bat_hip_turn'], 'AI 없이(골반 600 → 500)');
    eq(r.picked[0].reason, r.picked[0].card.why, '설명 = 카드 why');
    eq(r.steps.map(function (s) { return s.n; }), [1, 2, 3, 4], '과정 4단계');
    eq(r.steps[1].lines[0], '지난 기록(2026-11-10)과 견줬어요. 연구실 참고 범위로는 고르지 않아요.', '2단계 첫 줄');

    var calls = 0, aiGood = async function () { calls++; return '```json\n{"picked":[{"card_id":"bat_hip_turn","reason":"골반 회전이 지난 기록보다 낮아 골랐어요.","numbers_used":["pelvis_peak_velocity"]}],"summary":"골반부터 돌리는 연습을 해 봐요."}\n```'; };
    r = await C.runCoach({ snapshot: snap, cards: bat, llm: aiGood });
    eq([r.source, calls, r.picked[0].reason], ['ai', 1, '골반 회전이 지난 기록보다 낮아 골랐어요.'], 'AI 통과');

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

    calls = 0;
    r = await C.runCoach({ snapshot: { player: { id: 'P-1' }, sessions: [session()] }, cards: bat, llm: aiGood });
    ok(r.status === 'none' && /지난 기록이 있어야/.test(r.summary) && !r.findings.length && calls === 0, '참고 범위 밖 값만 · 지난 기록 없음 → none: ' + r.summary);
    eq(r.steps[1].lines.slice(0, 2), ['지난 기록이 없어 회전 순서만 봤어요.', '지난 기록과 흔들림 폭(±)보다 크게, 5% 넘게 달라진 숫자가 없어요.'], '2단계 문장');
    r = await C.runCoach({ snapshot: { player: { id: 'P-1' }, sessions: [prevSession({ metrics: [metric('pelvis_peak_velocity', 505)] }), session()] }, cards: bat });
    ok(r.status === 'none' && /권할 훈련이 없어요/.test(r.summary), '지난 기록 있고 차이 없음 → 기존 문장');
  });

  test('근거 화면: 「근거 자세히」 refs 수만큼 링크 · 「이 앱이 참고한 연구」 타격 / 투구 묶음', function () {
    var card = bat[0], d = E.evidenceDetails(card, ev), links = d.querySelectorAll('a');
    ok(d.tagName === 'DETAILS' && d.classList.contains('mo-evidence') && d.querySelector('summary').textContent === '근거 자세히', 'details · summary');
    eq(links.length, card.evidence.refs.length, '논문 링크 = refs 수');
    ok([].every.call(links, function (a) { return a.target === '_blank' && a.rel === 'noopener noreferrer' && /^https:/.test(a.href); }), '새 창 · noopener noreferrer');
    ok(d.textContent.indexOf(card.evidence.summary) >= 0, '카드 요약');
    ok(/학회 발표/.test(d.textContent), '학술지 논문이 아니면 종류 배지(sinclair2017)');
    eq(E.evidenceDetails(card, { papers: [] }).querySelectorAll('a').length, 0, '근거 목록을 못 읽으면 링크 없이 요약만');
    var count = function (s) { return ev.papers.filter(function (p) { return p.sport === s; }).length; };
    var b = E.referenceList('bat', ev), p = E.referenceList('pitch', ev);
    eq(b.querySelector('summary').textContent, '이 앱이 참고한 연구 (' + (count('batting') + count('measurement')) + '편 · ' + ev.version + ' 기준)', '타격 = 타격 + 측정 정확도');
    eq(p.querySelectorAll('a').length, count('pitching') + count('measurement'), '투구 = 투구 + 측정 정확도');
    ok(b.textContent.indexOf(ev.measurement_notes.can_say[0]) >= 0 && b.textContent.indexOf(ev.measurement_notes.cannot_say[0]) >= 0, '말해도 되는 것 · 안 되는 것');
    eq(E.referenceList('bat', { papers: [] }), null, '빈 목록이면 그리지 않는다');
  });
})();
