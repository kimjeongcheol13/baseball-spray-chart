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

  // 경기 1 을 기록하는 동안엔 그 저장본이 "지금 경기"로 묶여 빠진다 → 새 경기를 시작하면(sl_saves 는 그대로) 다시 읽어야 지난 경기 투구 수가 들어온다
  test('투구 수 관리: 같은 앱에서 새 경기를 시작해도 지난 경기 투구 수가 휴식에 들어간다', function () {
    var S = save(), abs = AS.abs, saves = localStorage.getItem('sl_saves'), K1 = 'sl_t_pl_g1';
    try {
      localStorage.setItem(KEY, JSON.stringify({ on: true }));
      var p50 = pitches(50).map(function (x) { return Object.assign({}, x, { id: 1.7e12 + x.id }); });
      localStorage.setItem(K1, JSON.stringify({ info: { date: '2026-11-02' }, abs: [], pitchers: [{ name: '한계투', num: '9', pitches: p50 }] }));
      localStorage.setItem('sl_saves', JSON.stringify([{ key: K1, ts: 1 }]));
      AS.abs = []; AS.info = Object.assign({}, AS.info || {}, { date: '2026-11-02' });
      var P = { id: 'pl1', name: '한계투', num: '9', role: null, pitches: p50.slice() };
      AS.pitchers = [P]; AS.currentPitcher = P;
      renderPitchCount();
      eq($('pitchCountBar').querySelector('.pcnt-limit').textContent, '오늘 50구 / 최대 105 · 휴식 1일 → 11-04(수)부터', '경기 1: 저장본과 같은 공은 한 번만');
      // 새 경기 (저장 목록은 그대로)
      AS.info = Object.assign({}, AS.info, { date: '2026-11-03' });
      P = { id: 'pl2', name: '한계투', num: '9', role: null, pitches: [] };
      AS.pitchers = [P]; AS.currentPitcher = P;
      renderPitchCount();
      eq($('pitchCountBar').querySelector('.pcnt-limit').textContent, '⚠ 휴식 중 — 11-04(수)부터 등판 가능 (11-02(월) 50구)', '새 경기: 어제 50구 → 휴식 중');
    } finally {
      localStorage.removeItem(K1);
      if (saves == null) localStorage.removeItem('sl_saves'); else localStorage.setItem('sl_saves', saves);
      AS.abs = abs;
      restore(S);
    }
  });

  // 상대 투수 =우리 타자에게 던진 공(bteam 'home')이 상대 타자에게 던진 공('away')보다 많은 투수 (recap.js 와 같은 규칙) · 타자 팀 모르는 공은 우리 투수
  var bt = function (n, team, base) { return pitches(n).map(function (x) { return Object.assign({}, x, { id: (base || 0) + x.id, bteam: team }); }); };
  test('투구 수 관리: 상대 투수는 투구 수 · 휴식일에서 뺀다 (타자 팀 모르는 공만 있으면 우리 투수)', function () {
    var h = PL().history([{ date: '2026-11-02', pitchers: [
      { name: '상대투', num: '1', pitches: bt(30, 'home').concat(bt(5, 'away', 100)) },
      { name: '우리투', num: '2', pitches: bt(30, 'away').concat(bt(5, 'home', 100)) },
      { name: '옛투수', num: '3', pitches: pitches(46) },
      { name: '빈타자', num: '4', pitches: bt(10, null) },
      { name: '동점투', num: '5', pitches: bt(3, 'home').concat(bt(3, 'away', 100)) }
    ] }]);
    eq(h.map(function (x) { return x.name; }), ['우리투', '옛투수', '빈타자', '동점투'], '상대 투수만 빠짐');
    eq(h[0].days, { '2026-11-02': 35 }, '우리 투수는 상대 타자 공이 섞여도 전부 셈');
  });

  test('투구 수 관리: 상대 투수를 기록할 땐 투구 수 줄 · 알림이 없고 휴식 현황에도 안 나온다', function () {
    var S = save();
    try {
      localStorage.setItem(KEY, JSON.stringify({ on: true }));
      AS.info = Object.assign({}, AS.info || {}, { date: '2026-11-02' });
      var O = { id: 'plo', name: '상대투', num: '1', role: null, pitches: bt(46, 'home', 300) };
      var M = { id: 'plm', name: '우리투', num: '2', role: null, pitches: bt(46, 'away', 400) };
      AS.pitchers = [O, M]; AS.currentPitcher = O;
      renderPitchCount();
      eq($('pitchCountBar').querySelector('.pcnt-limit'), null, '상대 투수 → 투구 수 줄 없음');
      $('toastTxt').textContent = '';
      PL().onPitch();
      eq($('toastTxt').textContent, '', '상대 투수 46구 → 알림 없음');
      window.renderSetup();
      var st = $('plStatus').textContent;
      ok(st.indexOf('우리투') >= 0 && st.indexOf('상대투') < 0, '휴식 현황엔 우리 투수만 — ' + st);
      AS.currentPitcher = M;
      renderPitchCount();
      eq($('pitchCountBar').querySelector('.pcnt-limit').textContent, '오늘 46구 / 최대 105 · 휴식 1일 → 11-04(수)부터', '우리 투수는 그대로');
      PL().onPitch();
      eq($('toastTxt').textContent, '#2 우리투 오늘 46구 — 이제 휴식 1일 (11-04(수)부터 등판)', '우리 투수 알림은 그대로');
    } finally { restore(S); }
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

  // 중학 · 리틀 = Little League 본부 규정(littleleague.org pitch-count, 14세 이하 휴식표). 고교는 그대로
  test('투구 수 관리: 기본값 고르기 — 고교 · 중학 · 리틀 11~12세 · 리틀 9~10세', function () {
    var S = save();
    try {
      localStorage.removeItem(KEY); window.plOn(true);
      var btns = function () { return Array.prototype.slice.call($('stPitch').querySelectorAll('.pl-pre button')); };
      eq(btns().map(function (b) { return b.textContent; }), ['고교', '중학', '리틀 11~12세', '리틀 9~10세'], '버튼 4개');
      eq(btns().map(function (b) { return b.getAttribute('aria-pressed'); }), ['true', 'false', 'false', 'false'], '처음엔 고교가 골라져 있음');
      var rf = function (n) { return PL().restFor(n, PL().getRule()); };
      var at = [1, 20, 21, 35, 36, 50, 51, 65, 66, 100];
      btns()[2].click();
      eq(T.ls(KEY).max, 85, '리틀 11~12세 하루 최대');
      eq(at.map(rf), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4], '리틀 휴식: 1~20 0일 · 21~35 1 · 36~50 2 · 51~65 3 · 66 이상 4');
      eq(btns().map(function (b) { return b.getAttribute('aria-pressed'); }), ['false', 'false', 'true', 'false'], '고른 버튼 표시');
      btns()[3].click(); eq(T.ls(KEY).max, 75, '리틀 9~10세 하루 최대'); eq(at.map(rf), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4], '휴식 구간은 같음');
      btns()[1].click(); eq(T.ls(KEY).max, 95, '중학 하루 최대'); eq(at.map(rf), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4], '중학 휴식 = 14세 이하 표');
      eq(T.ls(KEY).on, true, '기본값을 바꿔도 켜짐은 그대로');
      window.plTier(0, 0, '25');
      eq(btns().filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).length, 0, '구간을 고치면 어느 기본값도 아님');
      btns()[0].click(); eq([T.ls(KEY).max, T.ls(KEY).tiers], [105, [[45, 0], [60, 1], [75, 2], [90, 3], [105, 4]]], '고교로 되돌리기');
      btns().forEach(function (b) { ok(b.getBoundingClientRect().height >= 44 || b.offsetParent === null, b.textContent + ' 버튼 높이 44px 이상'); });
    } finally { restore(S); }
  });

  // Little League 본부 규정 NOTE 1 "Under no circumstance shall a player pitch in three (3) consecutive days" — 1~20구(휴식 0일)여도
  test('투구 수 관리: 3일 연속 등판 금지 — 켜면 이틀 연속 던진 투수는 다음 날 쉰다', function () {
    var base = PL().norm({ max: 85, tiers: [[20, 0], [35, 1], [50, 2], [65, 3], [85, 4]] });
    var r = PL().norm(Object.assign({}, base, { c3: true }));
    eq([base.c3, r.c3, PL().norm({ c3: 'yes' }).c3], [false, true, false], 'c3 는 true 일 때만 · 기본 꺼짐');
    var h = PL().history([
      { date: '2026-11-02', pitchers: [{ name: '연투', num: '1', pitches: pitches(15) }] },
      { date: '2026-11-03', pitchers: [{ name: '연투', num: '1', pitches: pitches(10) }] }
    ])[0];
    var s = PL().status(h, '2026-11-04', base);
    eq([s.block, s.next, s.c3], [null, null, false], '꺼져 있으면 수요일 등판 가능');
    s = PL().status(h, '2026-11-04', r);
    eq([s.block, s.next, s.c3], ['2026-11-05', '2026-11-05', true], '월 · 화 던졌으면 수요일은 못 던지고 목요일부터');
    s = PL().status(h, '2026-11-03', r);
    eq([s.today, s.rest, s.next, s.n3, s.c3], [10, 0, '2026-11-05', true, false], '화요일(월요일도 던짐) 10구 → 휴식 0일이어도 목요일부터');
    s = PL().status(h, '2026-11-02', r);
    eq([s.next, s.n3], ['2026-11-03', false], '월요일 하루만이면 다음 날 가능');
    s = PL().status(h, '2026-11-05', r);
    eq([s.block, s.next], [null, null], '목요일엔 등판 가능');
    var h2 = PL().history([
      { date: '2026-11-02', pitchers: [{ name: '긴휴식', num: '2', pitches: pitches(10) }] },
      { date: '2026-11-03', pitchers: [{ name: '긴휴식', num: '2', pitches: pitches(70) }] }
    ])[0];
    s = PL().status(h2, '2026-11-04', r);
    eq([s.block, s.c3], ['2026-11-08', false], '화요일 70구 → 휴식 4일이 더 길면 휴식일로');
    var h3 = PL().history([
      { date: '2026-11-01', pitchers: [{ name: '격일', num: '3', pitches: pitches(10) }] },
      { date: '2026-11-03', pitchers: [{ name: '격일', num: '3', pitches: pitches(10) }] }
    ])[0];
    s = PL().status(h3, '2026-11-04', r);
    eq([s.block, s.next], [null, null], '일 · 화 던졌으면(월요일 쉼) 수요일 가능');
  });

  test('투구 수 관리: 3일 연속 — 투구 기록 화면 줄 · 첫 공 알림 · 경기설정 칸', function () {
    var S = save(), saves = localStorage.getItem('sl_saves'), K1 = 'sl_t_pl_c3a', K2 = 'sl_t_pl_c3b';
    var mk = function (n, base) { return pitches(n).map(function (x) { return Object.assign({}, x, { id: base + x.id }); }); };
    try {
      localStorage.setItem(KEY, JSON.stringify({ on: true, max: 85, tiers: [[20, 0], [35, 1], [50, 2], [65, 3], [85, 4]], c3: true }));
      localStorage.setItem(K1, JSON.stringify({ info: { date: '2026-11-02' }, abs: [], pitchers: [{ name: '연투', num: '9', pitches: mk(15, 700) }] }));
      localStorage.setItem(K2, JSON.stringify({ info: { date: '2026-11-03' }, abs: [], pitchers: [{ name: '연투', num: '9', pitches: mk(10, 800) }] }));
      localStorage.setItem('sl_saves', JSON.stringify([{ key: K1, ts: 1 }, { key: K2, ts: 2 }]));
      AS.info = Object.assign({}, AS.info || {}, { date: '2026-11-04' });
      var P = { id: 'plc3', name: '연투', num: '9', role: null, pitches: [] };
      AS.pitchers = [P]; AS.currentPitcher = P;
      renderPitchCount();
      var line = function () { return $('pitchCountBar').querySelector('.pcnt-limit'); };
      eq(line().textContent, '⚠ 3일 연속 등판 금지 — 어제 · 그제 던졌어요 · 11-05(목)부터 등판 가능', '던지기 전: 오늘은 못 던짐');
      ok(line().classList.contains('warn'), '경고 색');
      P.pitches = mk(1, 900); $('toastTxt').textContent = '';
      PL().onPitch(); renderPitchCount();
      eq($('toastTxt').textContent, '⚠ #9 연투 어제 · 그제도 던졌어요 — 3일 연속 등판 금지 (오늘은 쉬어야 해요)', '첫 공 알림');
      eq(line().textContent, '⚠ 3일 연속 등판 · 오늘 1구 / 최대 85 · 휴식 0일 → 11-06(금)부터', '던진 뒤: 모레부터');
      // 그제는 안 던지고 어제만 던졌으면: 오늘 던질 수 있지만 내일은 못 던짐
      localStorage.setItem(K1, JSON.stringify({ info: { date: '2026-11-01' }, abs: [], pitchers: [{ name: '연투', num: '9', pitches: mk(15, 700) }] }));
      localStorage.setItem('sl_saves', JSON.stringify([{ key: K1, ts: 3 }, { key: K2, ts: 4 }]));
      $('toastTxt').textContent = '';
      PL().onPitch(); renderPitchCount();
      eq($('toastTxt').textContent, '#9 연투 어제도 던졌어요 — 내일은 쉬어야 해요 (3일 연속 등판 금지) · 11-06(금)부터', '첫 공: 내일은 쉬어야');
      eq(line().textContent, '오늘 1구 / 최대 85 · 휴식 0일 → 11-06(금)부터 (3일 연속 금지)', '줄: 모레부터 (3일 연속 금지)');
      ok(!line().classList.contains('warn'), '오늘 던지는 건 괜찮아 경고 색 아님');
      window.renderSetup();
      var li = $('plStatus').querySelector('li');
      eq([li.querySelector('em').textContent, li.querySelector('em').className], ['11-06(금)부터', 'no'], '휴식 현황: 모레부터');
      // 경기설정 칸 · 기본값
      var c3 = function () { return $('stPitch').querySelector('.pl-c3 input'); };
      var pressed = function () { return Array.prototype.slice.call($('stPitch').querySelectorAll('.pl-pre button')).map(function (b) { return b.getAttribute('aria-pressed'); }); };
      ok(c3() && c3().checked, '3일 연속 칸 켜짐');
      ok(c3().closest('label').getBoundingClientRect().height >= 44 || c3().offsetParent === null, '3일 연속 칸 높이 44px 이상');
      eq(pressed(), ['false', 'false', 'true', 'false'], '리틀 11~12세 (3일 연속 포함)');
      window.plC3(false);
      eq([T.ls(KEY).c3, c3().checked], [false, false], '끄면 저장');
      eq(pressed(), ['false', 'false', 'false', 'false'], '3일 연속을 끄면 리틀 기본값이 아님');
      $('stPitch').querySelectorAll('.pl-pre button')[0].click();
      eq(T.ls(KEY).c3, false, '고교 = 3일 연속 꺼짐');
      $('stPitch').querySelectorAll('.pl-pre button')[3].click();
      eq([T.ls(KEY).c3, c3().checked, T.ls(KEY).max], [true, true, 75], '리틀 9~10세 = 3일 연속 켜짐');
      $('stPitch').querySelectorAll('.pl-pre button')[1].click();
      eq(T.ls(KEY).c3, true, '중학 = 3일 연속 켜짐');
    } finally {
      [K1, K2].forEach(function (k) { localStorage.removeItem(k); });
      if (saves == null) localStorage.removeItem('sl_saves'); else localStorage.setItem('sl_saves', saves);
      restore(S);
    }
  });
})();