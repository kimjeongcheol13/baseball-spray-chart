// 동작 분석 — 측정 숫자 JSON 내보내기 (js/motion/export.js 순수 함수)
//  · 같은 선수만 · 시간순 · key/단위/잰 순간 · 흔들림 폭 · 참고 범위 · 단계 시각 · 이름이 파일에 들어가지 않는지
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var X;
  var entry = function (o) {
    return Object.assign({ id: 1, at: '2026-11-20T01:00:00.000Z', name: '김타자', mode: 'bat', hand: 'R', fps: 120, quality: 'mid', order: ['pelvis', 'trunk', 'hand'],
      metrics: { pelvisPeak: 610, trunkPeak: 820, maxSeparation: 31, stride: 88, leadKnee: 160, trunkTilt: 25, headMove: 12 },
      spread: { pelvisPeak: 40, trunkPeak: 55, maxSeparation: 6 }, range: { start: 1, end: 3 } }, o);
  };
  var store = function () { var m = {}; return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); } }; };

  test('(준비) 내보내기 모듈을 불러온다', async function () {
    X = await import('/js/motion/export.js?v=1');
    ok(X.buildExport && X.samePlayer && X.savedMatch && X.playerIdFor && X.exportFileName, '모듈 로드');
  });

  test('내보내기: 같은 선수 기록만 시간순 · key · 단위 · 흔들림 폭 · 참고 범위 · 단계 시각 · 이름은 빠진다', async function () {
    var pitch = entry({ id: 2, at: '2026-11-10T01:00:00.000Z', mode: 'pitch', hand: 'L', spread: null,
      metrics: { pelvisPeak: 650, trunkPeak: 900, maxSeparation: null, stride: 80, leadKnee: 150, trunkTilt: 30, elbowAtPlant: 95, armAngle: 40 } });
    var list = [entry({}), pitch, entry({ id: 3, name: '박투수' }), entry({ id: 4, name: ' 김타자 ', at: '2026-11-25T01:00:00.000Z' })];
    var mine = X.samePlayer(list, '김타자');
    eq(mine.map(function (e) { return e.id; }), [1, 2, 4], '같은 이름(앞뒤 공백 무시)만');
    // 투구 기록에는 다시 찾은 순간이 있다: fps 120 · 착지 60 · 릴리스 84 프레임 · 전체 144 프레임
    var detail = { result: { ok: true, fps: 120, events: { plant: 60, main: 84, pelvisPeak: 70, trunkPeak: 76, handPeak: 84 }, metrics: { sequence: { pelvisToTrunkMs: 50 } } }, n: 144, width: 1920, height: 1080 };
    var out = X.buildExport({ entries: mine, details: { 2: detail }, playerId: 'p0000abcd', version: '31', now: new Date('2026-11-28T03:04:00Z') });
    eq([out.schema_version, out.exported_at, out.app, out.player], ['1.0', '2026-11-28T03:04:00.000Z', { name: 'SprayLab Motion', version: '31' }, { id: 'p0000abcd', bats: 'R', throws: 'L' }], '머리 부분');
    eq(out.sessions.map(function (s) { return [s.session_id, s.motion_type]; }), [['2', 'pitching'], ['1', 'batting'], ['4', 'batting']], '시간순 · 종류');
    ok(JSON.stringify(out).indexOf('김타자') < 0, '선수 이름이 파일에 없다');
    var p = out.sessions[0], key = function (s, k) { return s.metrics.find(function (m) { return m.key === k; }); };
    eq(p.phases, [{ name: 'foot_strike', time_s: 0.5 }, { name: 'ball_release', time_s: 0.7 }, { name: 'pelvis_peak', time_s: 0.583 }, { name: 'trunk_peak', time_s: 0.633 }, { name: 'hand_peak', time_s: 0.7 }], '투구 단계 시각(실제 초)');
    eq(p.video, { fps: 120, width: 1920, height: 1080, duration_s: 1.2, view: 'unknown' }, '영상 정보');
    eq(p.metrics.map(function (m) { return m.key; }), ['pelvis_peak_velocity', 'trunk_peak_velocity', 'max_hip_shoulder_separation', 'stride_length', 'lead_knee_angle', 'trunk_tilt', 'throwing_elbow_angle', 'arm_slot_angle', 'pelvis_to_trunk_peak_gap'], '투구 key');
    eq(key(p, 'pelvis_peak_velocity'), { key: 'pelvis_peak_velocity', label: '골반 회전 피크', value: 650, unit: 'deg/s', uncertainty: null, phase: null, ref_range: [587, 773], ref_source: 'Dowling 외 2022 (Orthop J Sports Med) https://pmc.ncbi.nlm.nih.gov/articles/PMC9720809/' }, '투구 골반 · 참고 범위');
    eq([key(p, 'throwing_elbow_angle').phase, key(p, 'arm_slot_angle').phase, key(p, 'lead_knee_angle').phase, key(p, 'max_hip_shoulder_separation').value, key(p, 'trunk_peak_velocity').ref_range, key(p, 'pelvis_to_trunk_peak_gap').value], ['foot_strike', 'ball_release', 'ball_release', null, null, 50], '잰 순간 · 없는 값 null');
    var b = out.sessions[1];
    eq(b.metrics.map(function (m) { return m.key; }), ['pelvis_peak_velocity', 'trunk_peak_velocity', 'max_hip_shoulder_separation', 'stride_length', 'lead_knee_angle', 'trunk_tilt', 'head_displacement', 'pelvis_to_trunk_peak_gap'], '타격 key');
    eq([key(b, 'pelvis_peak_velocity').uncertainty, key(b, 'max_hip_shoulder_separation').ref_range, key(b, 'lead_knee_angle').phase, key(b, 'stride_length').unit], [40, [29, 38], 'contact', 'pct_leg_length'], '타격 흔들림 폭 · 참고 범위 · 잰 순간');
    eq([b.phases, b.video, b.sequence, key(b, 'pelvis_to_trunk_peak_gap').value], [[], { fps: 120, width: null, height: null, duration_s: null, view: 'unknown' }, { order: ['pelvis', 'trunk', 'hand'], estimated: true }, null], '좌표가 없는 기록은 단계 · 길이를 비운다');
  });

  test('지금 분석이 저장한 기록과 같은지 · 익명 ID 는 이름마다 한 번 만들고 다시 쓴다 · 파일 이름', async function () {
    var saved = [entry({})];
    ok(X.savedMatch(saved, entry({ id: 'unsaved' })) === saved[0], '같은 구간 · 같은 숫자 = 저장된 것');
    eq([X.savedMatch(saved, entry({ id: 'unsaved', metrics: Object.assign({}, saved[0].metrics, { leadKnee: 161 }) })), X.savedMatch(saved, entry({ id: 'unsaved', range: { start: 1, end: 4 } }))], [null, null], '숫자나 구간이 다르면 새 기록');
    var s = store(), n = 0, rnd = function () { n += 1; return 0xabc0 + n; };
    var a = X.playerIdFor('김타자', s, rnd), a2 = X.playerIdFor(' 김타자 ', s, rnd), c = X.playerIdFor('박투수', s, rnd);
    eq([a, a2, c], ['p0000abc1', 'p0000abc1', 'p0000abc2'], '같은 이름은 같은 ID');
    ok(s.getItem('sl_motion_export_ids').indexOf('p0000abc1') > 0, '이 기기에 저장(sl_ 키)');
    eq(X.exportFileName('p0000abc1', new Date(2026, 10, 28, 9, 5)), 'spraylab-motion_p0000abc1_20261128-0905.json', '파일 이름');
  });
})();
