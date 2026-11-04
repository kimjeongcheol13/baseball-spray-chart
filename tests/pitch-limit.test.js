// 투구 수 관리 검증 (js/features/pitchlimit.js — 하루 투구 수 · 의무 휴식일 · 다음 등판 가능일)
//  · 기본 규정(고교 2025 보도): 1~45 휴식 없음 · 46~60 1일 · 61~75 2일 · 76~90 3일 · 91~105 4일 · 하루 최대 105
//  · 휴식 N일 = 던진 다음 날부터 N일 쉬고 그다음 날 등판 (월요일 95구 → 토요일)
//  · 같은 날 두 경기는 합친다 · 같은 투수 = 이름이 같고 번호가 같거나 한쪽이 비어 있음
//  · 기본 꺼짐: 꺼져 있으면 투구 기록 화면 · 알림에 아무것도 안 나온다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var KEY = 'sl_pitch_rule';
  var PL = function () { return window.PitchLimit; };
  var pitches = function (n) { var a = []; for (var i = 0; i < n; i++) a.push({ id: i + 1, inning: '1회초', pt: '직구', result: '볼', pr: '볼', v: 2 }); return a; };

  function save() {
    return { rule: localStorage.getItem(KEY), info: AS.info, p: AS.pitchers, cp: AS.currentPitcher, toast: $('toastTxt').textContent };
  }
  function restore(S) {
    if (S.rule == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, S.rule);
    AS.info = S.info; AS.pitchers = S.p; AS.currentPitcher = S.cp; $('toastTxt').textContent = S.toast;
    if (window.renderSetup) window.renderSetup();
    renderPitchCount();
  }

  test('투구 수 관리: 휴식일 구간 · 날짜 계산 · 규정 정리', function () {
    ok(PL(), 'window.PitchLimit 없음');
    var r = PL().norm(null), rf = function (n) { return PL().restFor(n, r); };
    eq(r.on, false, '기본은 꺼짐');
    eq(r.max, 105, '하루 최대');
    eq([0, 1, 45, 46, 60, 61, 75, 76, 90, 91, 105, 130].map(rf), [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4], '구간별 휴식일');
    eq(PL().addDays('2026-11-02', 5), '2026-11-07', '날짜 더하기');
    eq(PL().addDays('2026-11-30', 1), '2026-12-01', '달 넘김');
    eq(PL().fmt('2026-11-07'), '11-07(토)', '표시');
    var bad = PL().norm({ on: 'yes', max: -3, tiers: [[60, 1], ['x', 2], [45, 0], [60, 9]] });
    eq(bad.on, false, 'on 은 true 일 때만');
    eq(bad.max, 105, '잘못된 최대 → 기본');
    eq(bad.tiers, [[45, 0], [60, 1]], '구간: 잘못된 값 빼고 · 정렬 · 같은 구간은 앞의 것');
    eq(PL().norm({ tiers: [] }).tiers, r.tiers, '구간이 비면 기본');
  });

  test('투구 수 관리: 같은 날 합치기 · 같은 투수 묶기 · 다음 등판 가능일', function () {
    var r = PL().norm(null);
    var h = PL().history([
      { date: '2026-11-02', pitchers: [{ name: '김투수', num: '18', pitches: pitches(95) }, { name: '박계투', num: '', pitches: pitches(30) }] },
      { date: '2026-11-04', pitchers: [{ name: '박계투', num: '31', pitches: pitches(40) }] },
      { date: '2026-11-04', pitchers: [{ name: '박계투', num: '', pitches: pitches(30) }, { name: '김투수', num: '7', pitches: pitches(10) }] },
      { date: null, pitchers: [{ name: '김투수', num: '18', pitches: pitches(50) }] }
    ]);
    eq(h.map(function (x) { return x.name + '#' + x.num; }), ['김투수#18', '박계투#31', '김투수#7'], '번호가 다르면 다른 투수 · 빈 번호는 합침');
    eq(h[1].days, { '2026-11-02': 30, '2026-11-04': 70 }, '같은 날 두 경기 합침 · 날짜 없는 경기는 뺌');
    var s = PL().status(h[0], '2026-11-05', r);
    eq([s.today, s.block, s.next, s.last, s.lastN], [0, '2026-11-07', '2026-11-07', '2026-11-02', 95], '월요일 95구 → 토요일부터 (목요일엔 휴식 중)');
    s = PL().status(h[0], '2026-11-07', r);
    eq([s.block, s.next], [null, null], '토요일엔 등판 가능');
    s = PL().status(h[1], '2026-11-04', r);
    eq([s.today, s.rest, s.next, s.left], [70, 2, '2026-11-07', 35], '오늘 70구 → 휴식 2일 · 35구 남음');
    s = PL().status(h[0], '2026-11-01', r);
    eq([s.last, s.today, s.next], [null, 0, null], '앞으로의 날짜는 무시');
  });

  test('투구 수 관리: 꺼져 있으면 투구 기록 화면 · 알림에 아무것도 없다', function () {
    var S = save();
    try {
      localStorage.removeItem(KEY);
      AS.info = Object.assign({}, AS.info || {}, { date: '2026-11-02' });
      var P = { id: 'pl1', name: '한계투', num: '9', role: null, pitches: pitches(46) };
      AS.pitchers = [P]; AS.currentPitcher = P;
      renderPitchCount();
      eq($('pitchCountBar').querySelector('.pcnt-limit'), null, '카운트 줄에 투구 수 줄 없음');
      $('toastTxt').textContent = '';
      PL().onPitch();
      eq($('toastTxt').textContent, '', '알림 없음');
    } finally { restore(S); }
  });

  test('투구 수 관리: 켜면 오늘 투구 수 · 휴식일이 나오고 구간이 바뀔 때 알린다', function () {
    var S = save();
    try {
      localStorage.setItem(KEY, JSON.stringify({ on: true }));
      AS.info = Object.assign({}, AS.info || {}, { date: '2026-11-02' });
      var P = { id: 'pl1', name: '한계투', num: '9', role: null, pitches: pitches(46) };
      AS.pitchers = [P]; AS.currentPitcher = P;
      renderPitchCount();
      var line = $('pitchCountBar').querySelector('.pcnt-limit');
      ok(line, '카운트 줄 아래 투구 수 줄');
      eq(line.textContent, '오늘 46구 / 최대 105 · 휴식 1일 → 11-04(수)부터', '46구 → 1일 휴식 → 수요일');
      $('toastTxt').textContent = '';
      PL().onPitch();
      eq($('toastTxt').textContent, '#9 한계투 오늘 46구 — 이제 휴식 1일 (11-04(수)부터 등판)', '구간이 바뀐 공 → 알림');
      P.pitches = pitches(47); $('toastTxt').textContent = '';
      PL().onPitch();
      eq($('toastTxt').textContent, '', '같은 구간 안에서는 알림 없음');
      P.pitches = pitches(95); PL().onPitch();
      eq($('toastTxt').textContent, '#9 한계투 오늘 95구 — 하루 최대까지 10구 남았어요', '최대 10구 전');
      P.pitches = pitches(106); PL().onPitch(); renderPitchCount();
      eq($('toastTxt').textContent, '⚠ #9 한계투 오늘 106구 — 하루 최대 105구를 넘었어요', '최대를 넘은 첫 공');
      ok($('pitchCountBar').querySelector('.pcnt-limit.warn'), '넘으면 경고 색');
    } finally { restore(S); }
  });

  test('투구 수 관리: 저장 경기를 불러와 이어 던져도 두 번 세지 않는다 · 다른 날 경기는 휴식에 들어간다', function () {
    var S = save(), saves = localStorage.getItem('sl_saves'), K1 = 'sl_t_pl_same', K2 = 'sl_t_pl_prev';
    try {
      localStorage.setItem(KEY, JSON.stringify({ on: true }));
      var p40 = pitches(40);
      localStorage.setItem(K1, JSON.stringify({ info: { date: '2026-11-02' }, abs: [], pitchers: [{ name: '한계투', num: '9', pitches: p40 }] }));
      localStorage.setItem(K2, JSON.stringify({ info: { date: '2026-10-31' }, abs: [], pitchers: [{ name: '한계투', num: '9', pitches: pitches(20).map(function (x) { return Object.assign({}, x, { id: 900 + x.id }); }) }] }));
      localStorage.setItem('sl_saves', JSON.stringify([{ key: K1, ts: 1 }, { key: K2, ts: 2 }]));
      AS.info = Object.assign({}, AS.info || {}, { date: '2026-11-02' });
      var P = { id: 'pl1', name: '한계투', num: '9', role: null, pitches: p40.concat(pitches(46).slice(40).map(function (x) { return Object.assign({}, x, { id: 500 + x.id }); })) };
      AS.pitchers = [P]; AS.currentPitcher = P;
      renderPitchCount();
      eq($('pitchCountBar').querySelector('.pcnt-limit').textContent, '오늘 46구 / 최대 105 · 휴식 1일 → 11-04(수)부터', '저장본의 같은 공 40개는 한 번만');
      window.renderSetup();
      var li = $('plStatus').querySelector('li');
      eq([li.querySelector('span').textContent, li.querySelector('em').textContent, li.querySelector('em').className], ['11-02(월) 46구', '11-04(수)부터', 'no'], '휴식 현황: 오늘 46구 → 수요일부터');
      P.pitches = P.pitches.slice(0, 45); window.renderSetup();
      li = $('plStatus').querySelector('li');
      eq([li.querySelector('em').textContent, li.querySelector('em').className], ['오늘 60구 더', 'ok'], '오늘 45구(휴식 0일)는 쉬는 투수가 아님');
    } finally {
      [K1, K2].forEach(function (k) { localStorage.removeItem(k); });
      if (saves == null) localStorage.removeItem('sl_saves'); else localStorage.setItem('sl_saves', saves);
      restore(S);
    }
  });

  test('투구 수 관리: 경기설정 카드 — 켜기 · 구간 고치기 · 기본값', function () {
    var S = save();
    try {
      localStorage.removeItem(KEY);
      window.renderSetup();
      var c = $('stPitch');
      ok(c, '경기설정에 투구 수 관리 카드');
      var box = c.querySelector('.pl-on input');
      ok(box && !box.checked, '처음엔 꺼짐');
      eq(c.querySelectorAll('.pl-tiers tr').length, 0, '꺼져 있으면 구간 표 없음');
      window.plOn(true);
      eq(T.ls(KEY).on, true, '켜면 저장');
      eq($('stPitch').querySelectorAll('.pl-tiers tbody tr').length, 5, '구간 5줄');
      window.plTier(0, 0, '40');
      eq(T.ls(KEY).tiers[0], [40, 0], '구간 고치기');
      window.plSet('95');
      eq(T.ls(KEY).max, 95, '최대 고치기');
      window.plSet('abc');
      eq(T.ls(KEY).max, 95, '숫자가 아니면 그대로');
      window.plReset();
      eq([T.ls(KEY).max, T.ls(KEY).tiers[0], T.ls(KEY).on], [105, [45, 0], true], '기본값으로 (켜짐은 그대로)');
      ok($('stPitch').querySelector('#plStatus'), '투수 휴식 현황');
      var inputs = $('stPitch').querySelectorAll('input[type=number]');
      ok(inputs.length === 11, '숫자 칸 11개 (최대 1 + 구간 10) — ' + inputs.length);
      Array.prototype.forEach.call(inputs, function (el) { ok(el.getBoundingClientRect().height >= 44 || el.offsetParent === null, '입력칸 높이 44px 이상'); });
    } finally { restore(S); }
  });
})();
