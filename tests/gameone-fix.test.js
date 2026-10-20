// 게임원 가져오기 보정(js/features/gameonefix.js) — 저장 직후 「타구 위치 확인」
//  · 가져오기가 타구 점마다 estimated(파서 confidence 'low')를 남긴다 · 타석 결과만(삼진 등)은 estimated 없음
//  · 저장하면 불러오기 목록 위에 위치 확인 화면 · 타자별(이전/다음) · 전체 보기(겹친 점은 화면에서만 벌림)
//  · 점을 끌면 x · y · deg · dir · ft 를 기록 탭 필드 탭과 같은 식으로 다시 정하고 estimated = false, 바로 저장 · 안 건드린 점은 그대로
//  · 파울 지역으로 끌면 마지막 자리 · 탭만 하면 그대로 · 나중에 할게 = 닫기(옮긴 점은 이미 저장, cloudSave 한 번)
//  · 분석 탭: 팀 방향도(점선 테두리 + 범례 '위치 확인') · 타자 스프레이 차트(점선 + 안내) · 지금 열린 경기면 AS 를 고쳐 저장
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  function row(o, pos, name, cells, ab, h) {   // 처음 받은 형식(탭 3칸 + 1~9회 + 타수 안타 타점 득점 도루 타율 시즌)
    var inn = []; for (var i = 1; i <= 9; i++) inn.push(cells[i] || ' ');
    return [o, pos, name].concat(inn, [ab, h, '0', '0', '0', '.000', '.000']).join('\t');
  }
  // 가선수: 좌안(대략) · 좌중2(방향 좁음) / 나선수: 3땅(대략) · 삼진(타구 없음) / 다선수: 좌안(대략, 가선수 좌안과 같은 대표 지점)
  var AWAY = [row('1', '중', '가선수(1)', { 1: '좌안', 3: '좌중2' }, '2', '2'), row('2', '유', '나선수(2)', { 1: '3땅', 3: '삼진' }, '2', '0'),
    row('3', '좌', '다선수(3)', { 1: '좌안' }, '1', '1')].join('\n');
  var KEY = null;

  function type(id, v) { var el = $(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
  function F() { return window.SLGameOneFix; }
  function shown() { return $('goFixOverlay').classList.contains('show'); }
  function saved() { return JSON.parse(localStorage.getItem(KEY)); }
  function ab(g, name, res) { return g.abs.filter(function (a) { return a.bname === name && a.res === res; })[0]; }
  function vOf(name, res) { return F().view().filter(function (v) { return v.a.bname === name && v.a.res === res; })[0]; }
  function client(x, y) { var r = $('gfCanvas').getBoundingClientRect(), k = r.width / F().state().geo.W; return { x: r.left + x * k, y: r.top + y * k }; }
  function fire(type, p) { $('gfCanvas').dispatchEvent(new PointerEvent(type, { clientX: p.x, clientY: p.y, pointerId: 7, pointerType: 'touch', bubbles: true, cancelable: true })); }
  // 캔버스 좌표(from) → 여러 걸음으로 (to) 끌기
  function drag(from, path) {
    fire('pointerdown', client(from.x, from.y));
    path.forEach(function (q) { fire('pointermove', client(q[0], q[1])); });
    fire('pointerup', client(path.length ? path[path.length - 1][0] : from.x, path.length ? path[path.length - 1][1] : from.y));
  }
  function spy(fn) {
    var ev = [], cs = [], g0 = window.gtag, c0 = window.cloudSave;
    window.gtag = function (k, n, p) { if (k === 'event' && n === 'gameone_fix') ev.push(p); };
    window.cloudSave = function (key) { cs.push(key); };
    try { fn(); } finally { window.gtag = g0; window.cloudSave = c0; }
    return { ev: ev, cs: cs };
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(F() && window.openGameOneFix && window.sbPaint, '보정 모듈 · 필드 그림(sbPaint) 로드');
  });

  test('가져오기: 타구 점마다 estimated = 파서 confidence low (좌안 · 3땅 true · 좌중2 false) · 삼진은 estimated 없음', function () {
    var g = window.SLGameOneImport.buildGameOneGame({ awayText: AWAY, now: 1790000800000 }).game;
    eq([ab(g, '가선수', '안타').estimated, ab(g, '가선수', '2루타').estimated, ab(g, '나선수', '땅볼 아웃').estimated, ab(g, '다선수', '안타').estimated], [true, false, true, true], 'estimated');
    ok(!('estimated' in ab(g, '나선수', '삼진')), '타구 없는 타석은 estimated 없음');
  });

  test('저장 → 불러오기 목록 위에 위치 확인 화면 · 첫 타자 · 대략 개수 · 목록(대략 표시)', async function () {
    openGameOneImport();
    type('goTa', '가팀'); type('goTh', '나팀'); type('goDate', '2026-10-17'); type('goAway', AWAY);
    await T.sleep(300);
    $('goSave').click();
    var s = JSON.parse(localStorage.getItem('sl_saves')); KEY = s[s.length - 1].key;
    ok(shown() && $('loadOverlay').classList.contains('show'), '위치 확인 화면 + 불러오기 목록');
    eq([F().state().key, F().state().pts.length, F().state().batters.length], [KEY, 4, 3], '타구 4개 · 타자 3명(삼진은 점 없음)');
    eq($('gfWho').textContent, '가선수 #1가팀 · 1/3명 · 대략 1', '첫 타자');
    ok($('gfPrev').disabled && !$('gfNext').disabled, '처음이면 이전 꺼짐');
    eq(Array.prototype.map.call($('gfList').children, function (li) { return li.textContent; }), ['11회초 · 안타대략', '23회초 · 2루타'], '목록');
    eq(F().view().map(function (v) { return v.a.res + ':' + v.n; }), ['안타:1', '2루타:2'], '그린 점 = 이 타자');
    eq(saved().abs.filter(function (a) { return a.estimated === true; }).length, 3, '저장 값에 estimated');
  });

  test('이전 / 다음 타자 · 전체 보기(같은 대표 지점에 겹친 점은 화면에서만 벌림, 저장 좌표는 그대로)', function () {
    gameOneFixStep(1);
    ok($('gfWho').textContent.indexOf('나선수 #2가팀 · 2/3명 · 대략 1') === 0, '다음 — ' + $('gfWho').textContent);
    gameOneFixStep(1);
    ok($('gfWho').textContent.indexOf('다선수') === 0 && $('gfNext').disabled, '마지막이면 다음 꺼짐');
    gameOneFixStep(1);
    ok($('gfWho').textContent.indexOf('다선수') === 0, '마지막에서 다음 = 그대로');
    gameOneFixStep(-1);
    ok($('gfWho').textContent.indexOf('나선수') === 0, '이전');
    $('gfModeAll').click();
    eq([$('gfModeAll').getAttribute('aria-pressed'), $('gfList').hidden, $('gfPrev').disabled && $('gfNext').disabled, $('gfWho').textContent], ['true', true, true, '전체 4개대략 3 · 옮김 0'], '전체 보기');
    var a = vOf('가선수', '안타'), b = vOf('다선수', '안타');
    eq([a.a.x === b.a.x && a.a.y === b.a.y, Math.round(Math.hypot(a.x - b.x, a.y - b.y)) > 10], [true, true], '같은 저장 좌표 · 화면에서는 벌어짐');
    $('gfModeOne').click();
    gameOneFixStep(-1);
    ok($('gfWho').textContent.indexOf('가선수') === 0 && !$('gfList').hidden, '타자별로 돌아옴');
  });

  test('끌기: 좌안 점을 중견 깊숙이 → x · y · deg · dir · ft 다시 계산 · estimated false · 바로 저장 · 다른 점은 그대로', function () {
    var before = saved(), v = vOf('가선수', '안타'), W = F().state().geo.W, g = _fieldGeo(W);
    var to = [W * 0.5, W * 0.3], want = _coneToSemi(g, to[0], to[1]);
    drag(v, [[v.x + 5, v.y - 5], [W * 0.5, W * 0.45], to]);
    var a = ab(saved(), '가선수', '안타');
    eq([a.estimated, +a.x.toFixed(4), +a.y.toFixed(4), +a.deg.toFixed(2), a.dir], [false, +want.x.toFixed(4), +want.y.toFixed(4), +want.deg.toFixed(2), 'CF'], '옮긴 점');
    var st = window.STADIUMS.standard, cf = Math.round(st.cfDist * 3.281);
    eq(a.ft, Math.round(want.dist * cf), '거리(ft) = 펜스 비율 × 중견 담장');
    eq([ab(saved(), '가선수', '2루타'), ab(saved(), '나선수', '땅볼 아웃'), ab(saved(), '다선수', '안타')],
      [ab(before, '가선수', '2루타'), ab(before, '나선수', '땅볼 아웃'), ab(before, '다선수', '안타')], '안 건드린 점은 그대로(estimated 포함)');
    eq(Array.prototype.map.call($('gfList').children, function (li) { return li.textContent; }), ['11회초 · 안타옮김', '23회초 · 2루타'], '목록에 옮김');
    eq([F().state().moved.size, $('gfWho').textContent.indexOf('대략 0') > 0], [1, true], '옮긴 수 · 대략 개수');
  });

  test('파울 지역 · 펜스 밖으로만 끌면 그대로 · 끌다가 파울로 나가면 마지막 자리 · 탭만 하면 그대로', function () {
    gameOneFixStep(1);   // 나선수 3땅
    var W = F().state().geo.W, v = vOf('나선수', '땅볼 아웃'), b0 = ab(saved(), '나선수', '땅볼 아웃');
    drag(v, [[2, 2], [W - 2, 4]]);
    eq(ab(saved(), '나선수', '땅볼 아웃'), b0, '파울 지역으로만 → 그대로');
    drag(v, []);
    eq(ab(saved(), '나선수', '땅볼 아웃'), b0, '탭만 → 그대로(estimated 유지)');
    var mid = [W * 0.62, W * 0.62], want = _coneToSemi(_fieldGeo(W), mid[0], mid[1]);
    drag(vOf('나선수', '땅볼 아웃'), [mid, [W - 2, 2]]);
    var a = ab(saved(), '나선수', '땅볼 아웃');
    eq([a.estimated, +a.x.toFixed(4), +a.y.toFixed(4)], [false, +want.x.toFixed(4), +want.y.toFixed(4)], '파울로 나가기 전 마지막 자리');
  });

  test('나중에 할게 → 닫힘 · 옮긴 점은 이미 저장 · cloudSave 한 번 · GA4 gameone_fix(숫자만)', function () {
    var r = spy(function () { $('gfLater').click(); });
    ok(!shown(), '닫힘');
    eq(r.cs, [KEY], 'cloudSave');
    eq(r.ev, [{ action: 'later', pts: 4, est: 3, moved: 2, left: 1, tap: 0 }], 'GA4');
    eq(saved().abs.filter(function (a) { return a.estimated === true; }).map(function (a) { return a.bname + ':' + a.res; }), ['다선수:안타'], '남은 대략 = 안 건드린 점');
    closeOverlay('loadOverlay');
  });

  test('분석 탭 팀 방향도(시즌 · 원정): 대략 위치만 점선 테두리 · 구역 수는 그대로 · 범례 대략 위치 N + 위치 확인 → 그 경기 보정 화면', async function () {
    shellOpenAnalysis('team');
    await T.sleep(50);   // shellSub 은 다음 태스크에 그린다
    setTeamScope('scope', 'season'); setTeamScope('side', 'away');
    var li = document.querySelector('.tm-dir .ad-legend-est');
    ok(li && li.textContent.indexOf('대략 위치 1') === 0, '범례 — ' + (li && li.textContent));
    // 그림(dashboard.js drawDashField — 팀 방향도가 쓴다): estimated 만 다르게 그려지고(점선 테두리) 구역별 수는 같다
    var list = saved().abs.filter(function (a) { return a.x != null; }), plain = list.map(function (a) { var b = Object.assign({}, a); delete b.estimated; return b; });
    function png(l) { var c = document.createElement('canvas'); c.width = c.height = 300; window.slDash.drawField(c.getContext('2d'), 300, l); return c.toDataURL(); }
    ok(png(list) !== png(plain), '점선 테두리가 그려짐');
    eq(window.slDash.zoneCounts(list), window.slDash.zoneCounts(plain), '구역별 타구 수는 같다');
    eq(window.slDash.estKey(plain, 'season'), '', '대략 위치가 없으면 범례도 없음');
    li.querySelector('button').click();
    ok(shown() && F().state().key === KEY && !F().state().live, '저장된 경기 보정 화면(지금 열린 경기엔 대략 위치 없음 → 최근 저장 경기)');
    var r = spy(function () { gameOneFixClose('done'); });
    eq(r.ev[0].action, 'done', '다 봤어요');
    eq(r.cs, [], '안 옮겼으면 cloudSave 없음');
  });

  test('분석 탭 타자(시즌 · 원정) 스프레이 차트: 그 타자의 대략 위치만 점선(d-est) · 안내 + 위치 확인 · 옮긴 타자는 점선 없음', async function () {
    shellOpenAnalysis('batter');
    await T.sleep(50);
    setBatterView('side', 'away'); setBatterView('scope', 'season'); setBatterView('sel', '다선수');
    var fig = document.querySelector('#batterView .an-spray'), est = fig.querySelectorAll('svg .d-est');
    eq([est.length, fig.querySelectorAll('svg [class^="d-"]').length], [1, 1], '다선수: 점선 1 / 1');
    ok(est[0].querySelector('title').textContent.indexOf('대략 위치') > 0, '툴팁');
    var note = fig.querySelector('.an-est-note');
    ok(note && note.textContent.indexOf('대략 찍은 위치 1개') >= 0 && note.querySelector('button'), '안내 — ' + (note && note.textContent));
    setBatterView('sel', '가선수');
    fig = document.querySelector('#batterView .an-spray');
    eq([fig.querySelectorAll('svg .d-est').length, fig.querySelectorAll('svg [class^="d-"]').length, !!fig.querySelector('.an-est-note')], [0, 2, false], '가선수: 옮긴 점 · 원래 확실한 점 → 점선 없음');
  });

  test('sprayFigure(칼럼 글용 fixBtn=false): 대략 위치 안내는 남기고 위치 확인 버튼은 뺀다 · 예전 기록(estimated 없음)은 안내 없음', async function () {
    var B = await import('/js/features/batdata.js?v=9');   // 앱과 같은 주소 = 같은 모듈
    var est = [{ res: '안타', x: 0.3, y: 0.5, deg: 40, estimated: true }], P = function (abs) { return { name: '가', abs: abs, st: B.calcStats(abs) }; };
    var d = document.createElement('div');
    d.innerHTML = B.sprayFigure(P(est), '', false);
    ok(d.querySelector('.an-est-note') && !d.querySelector('.an-est-note button') && d.querySelectorAll('.d-est').length === 1, '안내만 — ' + d.innerHTML.slice(0, 120));
    d.innerHTML = B.sprayFigure(P(est));
    ok(d.querySelector('.an-est-note button'), '기본은 버튼 있음');
    d.innerHTML = B.sprayFigure(P([{ res: '안타', x: 0.3, y: 0.5, deg: 40 }]));
    ok(!d.querySelector('.an-est-note') && !d.querySelector('.d-est'), '예전 기록 = 직접 입력');
  });

  test('지금 열린 경기: 팀(이번 경기) 위치 확인 → AS 를 고치고 기록 수정과 같은 저장(_saveEditImmediate) → 닫으면 분석 탭을 다시 그려 범례 사라짐', async function () {
    restoreGame(KEY);
    await T.sleep(300);
    eq(_curSaveKey, KEY, '경기 열림');
    shellOpenAnalysis('team');
    await T.sleep(50);
    setTeamScope('scope', 'game'); setTeamScope('side', 'away');
    var li = document.querySelector('.tm-dir .ad-legend-est');
    ok(li && li.textContent.indexOf('대략 위치 1') === 0, '이번 경기 범례');
    li.querySelector('button').click();
    ok(shown() && F().state().live && F().state().game === AS, 'AS 로 열림');
    gameOneFixStep(2);
    var W = F().state().geo.W, to = [W * 0.3, W * 0.5], want = _coneToSemi(_fieldGeo(W), to[0], to[1]);
    drag(vOf('다선수', '안타'), [to]);
    var live = AS.abs.filter(function (a) { return a.bname === '다선수'; })[0];
    eq([live.estimated, +live.x.toFixed(4)], [false, +want.x.toFixed(4)], 'AS 바로 고침');
    eq([ab(saved(), '다선수', '안타').estimated, +ab(saved(), '다선수', '안타').x.toFixed(4)], [false, +want.x.toFixed(4)], '저장도 됨');
    gameOneFixClose('done');
    await T.sleep(50);
    ok(document.querySelector('.tm-dir') && !document.querySelector('.tm-dir .ad-legend-est'), '분석 탭(팀)을 다시 그려 범례 사라짐');
  });

  test('estimated 없는 예전 기록 · 직접 찍은 기록 = 직접 입력: 점선 없음 · 타구 점이 없으면 화면을 열지 않는다', function () {
    var k = 'sl_1790000800101';
    localStorage.setItem(k, JSON.stringify({ key: k, th: 'A', ta: 'B', abs: [{ id: 1, bid: 1, bname: '옛타자', res: '안타', x: 0.3, y: 0.5, deg: 40, dir: 'LF' }], home_lineup: [], away_lineup: [], zoneHistory: {} }));
    ok(openGameOneFix(k) && F().view().length === 1 && F().view()[0].a.estimated === undefined, '열리지만 대략 아님');
    eq($('gfList').textContent, '1 · 안타', '대략 표시 없음');
    gameOneFixClose('later');
    localStorage.setItem(k, JSON.stringify({ key: k, abs: [{ id: 1, bname: '옛타자', res: '삼진' }] }));
    ok(openGameOneFix(k) === false && !shown(), '타구 점이 없으면 안 엶');
    ok(openGameOneFix('sl_없음') === false && openGameOneFix(null) === false, '없는 키');
    localStorage.removeItem(k);
  });

  // 탭으로 찍기(2026-10-20): 게임원 기록에는 떨어진 자리가 없어 정확한 위치는 사람이 찍어야 한다 — 끌기보다 탭 한 번
  function tapAt(x, y) { var c = client(x, y); fire('pointerdown', c); fire('pointerup', c); }
  function far(W) {   // 어느 점에서도 HIT(24px) 넘게 떨어진 페어 지역 자리
    var g = _fieldGeo(W), cand = [[0.5, 0.25], [0.35, 0.4], [0.65, 0.4], [0.5, 0.5], [0.42, 0.62], [0.58, 0.62]].map(function (q) { return [W * q[0], W * q[1]]; });
    return cand.filter(function (q) { return _coneToSemi(g, q[0], q[1]) && F().view().every(function (v) { return Math.hypot(v.x - q[0], v.y - q[1]) > 30; }); })[0];
  }
  test('탭으로 찍기: 지금 찍을 공(노란 테두리 · 안내) → 필드 탭 = 그 자리로 + 다음 대략 공(다음 타자로) · 파울 지역은 그대로 · 건너뛰기 · 점 탭 = 고르기 · 다 찍으면 안내 · GA4 tap', async function () {
    openGameOneImport();
    type('goTa', '다팀'); type('goTh', '라팀'); type('goDate', '2026-10-16'); type('goAway', AWAY);
    await T.sleep(300);
    $('goSave').click();
    var s = JSON.parse(localStorage.getItem('sl_saves')), K2 = s[s.length - 1].key, st = F().state();
    function sv() { return JSON.parse(localStorage.getItem(K2)); }
    ok(shown() && st.key === K2, '새 경기 위치 확인');
    eq([st.target.bname, st.target.res, st.i], ['가선수', '안타', 0], '처음 = 경기 순서로 첫 대략 공');
    ok(/지금 찍을 공 가선수 · 1회초 · 안타 · 좌익 쪽/.test($('gfTarget').textContent) && /남은 대략 3개/.test($('gfTarget').textContent), '안내 — ' + $('gfTarget').textContent);
    ok($('gfList').children[0].classList.contains('gf-now') && !$('gfSkip').disabled, '목록에 지금 공 · 건너뛰기 켜짐');
    ok($('gfSkip').getBoundingClientRect().height >= 44, '건너뛰기 44px');
    var W = st.geo.W, q = far(W), want = _coneToSemi(_fieldGeo(W), q[0], q[1]);
    tapAt(q[0], q[1]);
    var a = ab(sv(), '가선수', '안타');
    eq([a.estimated, +a.x.toFixed(4), +a.y.toFixed(4)], [false, +want.x.toFixed(4), +want.y.toFixed(4)], '탭한 자리로 · estimated false · 바로 저장');
    eq([F().state().target.bname, F().state().i, $('gfWho').textContent.indexOf('나선수') === 0], ['나선수', 1, true], '다음 대략 공 = 다음 타자(나선수 3땅)');
    tapAt(2, 2);
    eq(ab(sv(), '나선수', '땅볼 아웃').estimated, true, '파울 지역 탭 → 그대로');
    ok(/파울 지역이에요/.test($('gfTarget').textContent), '파울 안내');
    gameOneFixSkip();
    eq([F().state().target.bname, F().state().i], ['다선수', 2], '건너뛰기 → 다음 대략 공(다선수)');
    var v = vOf('다선수', '안타');
    tapAt(v.x, v.y);
    eq([F().state().target.bname, ab(sv(), '다선수', '안타').estimated], ['다선수', true], '점 탭 = 고르기만(옮기지 않음)');
    q = far(W); tapAt(q[0], q[1]);
    eq([ab(sv(), '다선수', '안타').estimated, F().state().target && F().state().target.bname], [false, '나선수'], '다선수 찍고 → 남은 나선수로(처음으로 돌아감)');
    q = far(W); tapAt(q[0], q[1]);
    eq([ab(sv(), '나선수', '땅볼 아웃').estimated, F().state().target], [false, null], '다 찍음');
    ok(/대략 위치를 모두 찍었어요/.test($('gfTarget').textContent) && $('gfSkip').disabled, '다 찍은 안내 · 건너뛰기 꺼짐');
    var r = spy(function () { $('gfDone').click(); });
    eq(r.ev, [{ action: 'done', pts: 4, est: 3, moved: 3, left: 0, tap: 3 }], 'GA4 tap 3');
    closeOverlay('loadOverlay');
  });
})();
