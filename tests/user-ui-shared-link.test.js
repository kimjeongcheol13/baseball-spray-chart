// 공유 링크(?gid= · ?game=)로 받은 경기를 "불러오기"(loadSharedGame)할 때 내 경기 보호 — 실제 core.js · cloud.js 를 가짜 서버에 붙여 돌린다(외부 요청 0건).
//  · 작업 중인 경기(타구 1개 이상)는 공유 경기를 열기 전에 저장되고, "공유받은 경기를 열었어요 · 내 경기는 저장됨" 안내가 뜬다
//  · 공유 경기는 보기만 해서는 자동저장(sl_auto_* · sl_autosave)도 user_games 업로드도 되지 않는다. 사용자가 저장을 눌렀을 때만 저장된다
// 시나리오는 한 번씩만 돌리고(가상 시간 절약) 각 테스트가 그 결과의 다른 부분을 검사한다. 파일 이름순으로 user-ui-menu 뒤, 맨 마지막에 돈다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;
  var KEY = 'sl_1779002911000', T0 = new Date(2026, 4, 17, 16, 28, 31).getTime();
  var MINE = '미저장타자', SHARED = '공유타자', EDIT = '편집타자';

  // 앱이 쓰는 타구 객체(_restoreAbsFromPayload) — 이름(bname)으로 그 타구가 어디에 남았는지 찾는다
  function taps(name, n) {
    var raw = []; for (var i = 0; i < n; i++) raw.push({ r: '안타', d: 20, p: '직구', z: 5, i: '1회초', b: 0, x: 0.5, y: 0.4, bn: name, bno: 7, t: 'home', ba: 'R' });
    return _restoreAbsFromPayload(raw).map(function (a, i) { return Object.assign(a, { id: name + i }); });
  }
  function sharedPayload() {
    return { v: 3, hs: 5, as: 2, ht: '공유홈', at: '공유원정', hl: [{ n: '공유홈1', no: 1 }], al: [], pitchers: [],
      abs: [{ r: '안타', d: 20, p: '직구', z: 5, i: '1회초', b: 0, x: 0.5, y: 0.4, bn: SHARED, bno: 3, t: 'home', ba: 'R' },
            { r: '삼진', d: 20, p: '직구', z: 5, i: '1회초', b: 0, x: 0.5, y: 0.4, bn: SHARED, bno: 3, t: 'home', ba: 'R' }] };
  }
  // localStorage 전체 + 서버 user_games 를 복사해 둔다
  function snap() {
    var ls = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
    return { ls: ls, rows: JSON.parse(JSON.stringify(srv.user_games)),
      upserts: srv.log.filter(function (x) { return x.table === 'user_games' && x.op === 'upsert'; }).length };
  }
  // marker 가 들어 있는 곳: localStorage 키 · 서버 user_games 의 game_key
  function where(s, marker) {
    var w = Object.keys(s.ls).filter(function (k) { return s.ls[k].indexOf(marker) >= 0; }).map(function (k) { return 'ls:' + k; });
    s.rows.forEach(function (r) { if (JSON.stringify(r.data).indexOf(marker) >= 0) w.push('server:' + r.game_key); });
    return w;
  }
  // 내 저장 목록(sl_saves)에 있는 경기 중 marker 가 들어 있는 항목의 키
  function savedWith(s, marker) {
    var list = []; try { list = JSON.parse(s.ls.sl_saves || '[]'); } catch (e) {}
    return list.map(function (e) { return e.key; }).filter(function (k) { return s.ls[k] && s.ls[k].indexOf(marker) >= 0; });
  }
  async function fresh(loggedIn) {
    await sleep(2000);
    srv.signOut(); await sleep(1000);
    srv.reset(); localStorage.clear();
    if (loggedIn) { srv.signIn(); await sleep(1500); }
    srv.log.length = 0;
  }
  // 시나리오가 건드리는 앱 전역 상태를 되돌릴 함수를 돌려준다
  function keepApp() {
    var a = window.AS, s = { abs: a.abs, hs: a.hs, as: a.as, hl: a.home_lineup, al: a.away_lineup, p: a.pitchers, z: a.zoneHistory, cur: a.curGame, info: a.info,
      sk: window._curSaveKey, ak: window._autoKey, gs: window._gameSaved, sp: window._sharedPayload, showApp: window.showApp,
      th: T.$('tHome').value, ta: T.$('tAway').value, sv: window._sharedView };
    return function () {
      a.abs = s.abs; a.hs = s.hs; a.as = s.as; a.home_lineup = s.hl; a.away_lineup = s.al; a.pitchers = s.p; a.zoneHistory = s.z; a.curGame = s.cur; a.info = s.info;
      window._curSaveKey = s.sk; window._autoKey = s.ak; window._gameSaved = s.gs; window._sharedPayload = s.sp; window.showApp = s.showApp; window._sharedView = s.sv;
      T.$('tHome').value = s.th; T.$('tAway').value = s.ta;
      if (typeof closeGameSummary === 'function') try { closeGameSummary(); } catch (e) {}
    };
  }
  function blankApp() {
    var a = window.AS; a.abs = []; a.hs = 0; a.as = 0; a.home_lineup = []; a.away_lineup = []; a.pitchers = []; a.zoneHistory = {}; a.curGame = null; a.info = null;
    window._curSaveKey = null; window._autoKey = null; window._gameSaved = true; window._sharedView = null;
  }
  function openShared(extra) {       // 배너의 "불러오기" — showApp 은 이 테스트의 관심사가 아니라 막아 둔다. extra = 공유 데이터에 덧붙일 필드
    window._sharedPayload = Object.assign(sharedPayload(), extra || {}); window.showApp = function () {}; loadSharedGame();
  }
  var memo = {};
  function once(name, fn) { if (!memo[name]) memo[name] = fn(); return memo[name]; }

  // 시나리오 1: 저장해 둔 경기 G 를 불러와 타구를 2개 더 기록했다(경기 저장은 아직 안 눌렀다 = 자동저장에만 있음) → 공유 링크의 "불러오기"
  async function scenarioInProgress() {
    var restore = keepApp();
    try {
      await fresh(true); blankApp();
      localStorage.setItem(KEY, JSON.stringify({ th: '우리팀', ta: '상대팀', hs: 1, as: 0, abs: taps('저장된타자', 1), d: '2026. 5. 17.', ts: T0 }));
      localStorage.setItem('sl_saves', JSON.stringify([{ key: KEY, label: KEY, ts: T0 }]));
      localStorage.setItem('sl_cloud_mod', '{}');
      restoreGame(KEY);                                   // 앱의 "불러오기" — _curSaveKey · AS.curGame 이 이 경기로 맞춰진다
      AS.abs = AS.abs.concat(taps(MINE, 2)); updateAll();  // 기록(저장은 안 함)
      await sleep(10500);                                 // 자동저장(10초) · 복구 슬롯(3초) · 클라우드 자동 동기화(3초)
      var before = snap();
      srv.log.length = 0;
      openShared(); await sleep(700);
      var toast = T.$('toastTxt').textContent;
      await sleep(10500);
      var after = snap();
      // 다음에 앱을 열면(시작 때 _openLastGame → archRecoverAutosave) 복구 슬롯에서 무엇이 되살아나는가
      archRecoverAutosave();
      var restored = AS.abs.map(function (a) { return a.bname; });
      return { before: before, after: after, toast: toast, restored: restored, afterRecover: snap() };
    } finally { restore(); }
  }
  // 시나리오 2: 작업 중인 경기가 없다(빈 필드) → 공유 경기를 보기만 한다
  async function scenarioViewOnly() {
    var restore = keepApp();
    try {
      await fresh(true); blankApp();
      openShared(); await sleep(700);
      var toast = T.$('toastTxt').textContent;
      await sleep(10500);
      return { after: snap(), toast: toast };
    } finally { restore(); }
  }
  // 시나리오 3: 공유 경기를 본 뒤 사용자가 "경기 저장"을 누른다 → 그 뒤 타구를 하나 더 기록한다
  async function scenarioSave() {
    var restore = keepApp();
    try {
      await fresh(true); blankApp();
      openShared(); await sleep(700);
      saveGame(); await sleep(5000);                      // 저장 디바운스 0.3초 + user_games 업로드 디바운스 3초
      var saved = snap();
      AS.abs = AS.abs.concat(taps(EDIT, 1)); updateAll();
      await sleep(10500);
      return { saved: saved, after: snap() };
    } finally { restore(); }
  }

  test('전제(작업 중 경기): 저장 안 한 타구가 복구 슬롯 · 자동저장 · 서버 자동 동기화본에 있다', async function () {
    var r = await once('inProgress', scenarioInProgress), w = where(r.before, MINE);
    ['ls:sl_autosave', 'ls:sl_auto_' + T0, 'server:sl_auto_' + T0].forEach(function (x) { ok(w.indexOf(x) >= 0, '시나리오 전제가 안 맞음(이 테스트가 의미 없다): ' + x + ' 에 없음 — ' + JSON.stringify(w)); });
    eq(savedWith(r.before, MINE), [], '아직 저장 목록에는 없어야 함');
  });
  test('공유 경기를 열면 작업 중이던 타구가 내 저장 목록에 먼저 저장된다(손실 없음)', async function () {
    var r = await once('inProgress', scenarioInProgress);
    ok(savedWith(r.after, MINE).length > 0, '작업 중이던 타구(' + MINE + ' 2개)가 저장 목록 어디에도 없음 — 남은 곳: ' + JSON.stringify(where(r.after, MINE)) +
      ' / 공유 경기가 차지한 곳: ' + JSON.stringify(where(r.after, SHARED)));
  });
  test('저장한 내 경기는 로그인 상태면 user_games 에도 올라간다', async function () {
    var r = await once('inProgress', scenarioInProgress);
    ok(r.after.rows.some(function (x) { return x.game_key === KEY && JSON.stringify(x.data).indexOf(MINE) >= 0; }), 'user_games 의 ' + KEY + ' 에 작업 중이던 타구가 없음');
  });
  test('저장했다면 "공유받은 경기를 열었어요 · 내 경기는 저장됨" 안내가 뜬다', async function () {
    var r = await once('inProgress', scenarioInProgress);
    eq(r.toast, '공유받은 경기를 열었어요 · 내 경기는 저장됨', '안내 문구');
  });
  test('공유 경기는 보기만 해서는 자동저장 · 복구 슬롯 · user_games 에 들어가지 않는다(작업 중이던 경기가 있을 때)', async function () {
    var r = await once('inProgress', scenarioInProgress);
    eq(where(r.after, SHARED), [], '공유 경기가 자동으로 저장·업로드된 곳');
  });
  test('다음에 앱을 열면 복구되는 것은 내 경기다(공유 경기가 내 저장 목록에 자동으로 끼어들지 않는다)', async function () {
    var r = await once('inProgress', scenarioInProgress);
    ok(r.restored.indexOf(MINE) >= 0, '복구된 타구에 내 경기(' + MINE + ')가 없음: ' + JSON.stringify(r.restored.filter(function (n, i, a) { return a.indexOf(n) === i; })));
    eq(savedWith(r.afterRecover, SHARED), [], '복구하면서 공유 경기가 저장 목록에 들어간 항목');
  });
  test('보기만 하면(작업 중인 경기 없음) 아무것도 저장 · 업로드하지 않고, 저장했다는 안내도 없다', async function () {
    var r = await once('viewOnly', scenarioViewOnly);
    eq(where(r.after, SHARED), [], '공유 경기가 자동으로 저장·업로드된 곳');
    eq(r.after.upserts, 0, 'user_games upsert 요청 수');
    ok(!/내 경기는 저장됨/.test(r.toast), '저장한 게 없는데 "저장됨" 안내가 뜸: ' + r.toast);
  });
  test('내 경기를 저장하지 못하면(저장 공간 부족) 공유 경기를 열지 않고 내 경기는 그대로다', async function () {
    var restore = keepApp(), orig = Storage.prototype.setItem;
    try {
      await fresh(false); blankApp();
      AS.abs = taps(MINE, 2);
      Storage.prototype.setItem = function (k) { if (k === 'sl_saves') throw new DOMException('quota', 'QuotaExceededError'); return orig.apply(this, arguments); };
      openShared(); await sleep(700);
      Storage.prototype.setItem = orig;
      eq(AS.abs.map(function (a) { return a.bname; }), [MINE, MINE], '내 경기의 타구');
      ok(/열지 않았어요/.test(T.$('toastTxt').textContent), '안내 문구: ' + T.$('toastTxt').textContent);
    } finally { Storage.prototype.setItem = orig; restore(); }
  });
  test('사용자가 "경기 저장"을 누르면 그때 저장되고(저장 목록 · user_games), 이후 기록은 다시 자동저장된다', async function () {
    var r = await once('save', scenarioSave), keys = savedWith(r.saved, SHARED);
    eq(keys.length, 1, '저장 목록에서 공유 경기가 든 항목 수');
    ok(r.saved.rows.some(function (x) { return x.game_key === keys[0] && JSON.stringify(x.data).indexOf(SHARED) >= 0; }), 'user_games 에 저장한 경기가 없음');
    ok(where(r.after, EDIT).some(function (x) { return /^ls:sl_auto_/.test(x); }), '저장한 뒤의 기록(' + EDIT + ')이 자동저장되지 않음 — ' + JSON.stringify(where(r.after, EDIT)));
  });

  // ── 저장 목록에서 경기 열기(목록 카드 onclick="_lpClick(키)" → restoreGame) — 공유 링크와 같은 보호 ──
  var KEY2 = 'sl_1779002911111', OTHER = '다른경기타자', INFO = { date: '2026-05-17', venue: '목동', side: 'away', innings: 7 };
  function seedTwoGames() {          // 저장 목록에 경기 G(KEY) · H(KEY2)
    localStorage.setItem(KEY, JSON.stringify({ th: '우리팀', ta: '상대팀', hs: 1, as: 0, abs: taps('저장된타자', 1), d: '2026. 5. 17.', ts: T0 }));
    localStorage.setItem(KEY2, JSON.stringify({ th: '다른팀', ta: '상대2', hs: 2, as: 2, abs: taps(OTHER, 1), d: '2026. 5. 18.', ts: T0 + 1000 }));
    localStorage.setItem('sl_saves', JSON.stringify([{ key: KEY, label: KEY, ts: T0 }, { key: KEY2, label: KEY2, ts: T0 + 1000 }]));
    localStorage.setItem('sl_cloud_mod', '{}');
  }
  function openFromList(key) { window._lpFired = false; _lpClick(key); }   // 목록 카드를 누르는 것과 같다
  function names() { return AS.abs.map(function (a) { return a.bname; }); }
  // 시나리오: G 를 불러와 타구 2개를 더 기록했다(경기 저장 안 함) → 목록에서 다른 경기(H) 또는 같은 경기(G)를 연다
  async function scenarioOpen(same) {
    var restore = keepApp();
    try {
      await fresh(true); blankApp(); seedTwoGames();
      restoreGame(KEY);
      AS.abs = AS.abs.concat(taps(MINE, 2)); updateAll();
      await sleep(10500);
      var before = snap();
      srv.log.length = 0;
      openFromList(same ? KEY : KEY2); await sleep(700);
      var toast = T.$('toastTxt').textContent, opened = names();
      await sleep(10500);
      return { before: before, after: snap(), toast: toast, opened: opened };
    } finally { restore(); }
  }
  test('전제(목록에서 열기): 저장 안 한 타구가 복구 슬롯 · 자동저장 · 서버 자동 동기화본에 있다', async function () {
    var r = await once('openOther', function () { return scenarioOpen(false); }), w = where(r.before, MINE);
    ['ls:sl_autosave', 'ls:sl_auto_' + T0, 'server:sl_auto_' + T0].forEach(function (x) { ok(w.indexOf(x) >= 0, '시나리오 전제가 안 맞음: ' + x + ' 에 없음 — ' + JSON.stringify(w)); });
    eq(savedWith(r.before, MINE), [], '아직 저장 목록에는 없어야 함');
  });
  test('목록에서 다른 경기를 열면 작업 중이던 타구가 내 저장 목록에 먼저 저장되고, 안내가 뜬다', async function () {
    var r = await once('openOther', function () { return scenarioOpen(false); });
    ok(savedWith(r.after, MINE).length > 0, '작업 중이던 타구(' + MINE + ')가 저장 목록에 없음 — 남은 곳: ' + JSON.stringify(where(r.after, MINE)) + ' (복구 슬롯 sl_autosave 는 열린 경기로 바뀜)');
    ok(r.opened.indexOf(OTHER) >= 0, '다른 경기가 열리지 않음: ' + JSON.stringify(r.opened));
    ok(/이전 경기는 저장됨/.test(r.toast), '안내 문구: ' + r.toast);
  });
  test('목록에서 다른 경기를 열어도 이전 경기의 서버 자동저장본(sl_auto_<이전 경기>)을 새 경기가 덮어쓰지 않는다', async function () {
    var r = await once('openOther', function () { return scenarioOpen(false); });
    var row = r.after.rows.filter(function (x) { return x.game_key === 'sl_auto_' + T0; })[0];
    ok(row && JSON.stringify(row.data).indexOf(MINE) >= 0, '이전 경기의 서버 자동저장본이 새 경기 데이터로 바뀜: ' + (row ? JSON.stringify(row.data.abs.map(function (a) { return a.bname; })) : '행이 없음'));
  });
  test('목록에서 같은 경기를 다시 열어도 저장 안 한 타구는 사라지지 않는다', async function () {
    var r = await once('openSame', function () { return scenarioOpen(true); });
    ok(savedWith(r.after, MINE).length > 0, '저장 안 한 타구(' + MINE + ')가 어디에도 남지 않음 — 남은 곳: ' + JSON.stringify(where(r.after, MINE)));
    ok(r.opened.indexOf(MINE) >= 0, '다시 연 경기에 방금 기록한 타구가 없음: ' + JSON.stringify(r.opened.filter(function (n, i, a) { return a.indexOf(n) === i; })));
  });
  test('작업 중인 경기가 없으면 목록에서 열어도 저장하지 않고 안내도 없다', async function () {
    var restore = keepApp();
    try {
      await fresh(false); blankApp(); seedTwoGames();
      openFromList(KEY2); await sleep(300);
      var list = JSON.parse(localStorage.getItem('sl_saves'));
      eq(list.map(function (e) { return e.key; }), [KEY, KEY2], '저장 목록');
      ok(!/이전 경기는 저장됨/.test(T.$('toastTxt').textContent), '저장한 게 없는데 안내가 뜸: ' + T.$('toastTxt').textContent);
      ok(names().indexOf(OTHER) >= 0, '경기가 열리지 않음');
    } finally { restore(); }
  });
  test('내 경기를 저장하지 못하면(저장 공간 부족) 목록에서 열지 않고 내 경기는 그대로다', async function () {
    var restore = keepApp(), orig = Storage.prototype.setItem;
    try {
      await fresh(false); blankApp(); seedTwoGames();
      AS.abs = taps(MINE, 2);
      Storage.prototype.setItem = function (k) { if (k === 'sl_saves') throw new DOMException('quota', 'QuotaExceededError'); return orig.apply(this, arguments); };
      openFromList(KEY2); await sleep(300);
      Storage.prototype.setItem = orig;
      eq(names(), [MINE, MINE], '내 경기의 타구');
      ok(/열지 않았어요/.test(T.$('toastTxt').textContent), '안내 문구: ' + T.$('toastTxt').textContent);
    } finally { Storage.prototype.setItem = orig; restore(); }
  });
  test('공유 경기를 보기만 하다가 목록에서 경기를 열어도 공유 경기가 내 저장 목록에 들어가지 않는다', async function () {
    var restore = keepApp();
    try {
      await fresh(false); blankApp(); seedTwoGames();
      openShared(); await sleep(700);
      openFromList(KEY2); await sleep(300);
      eq(savedWith(snap(), SHARED), [], '공유 경기가 든 저장 항목');
      ok(names().indexOf(OTHER) >= 0, '경기가 열리지 않음');
    } finally { restore(); }
  });
  test('열기 전에 저장한 경기에 경기 정보(AS.info) · 바꾼 팀명이 들어 있다(기존 항목 · 새 항목 모두)', async function () {
    var restore = keepApp();
    try {
      await fresh(false); blankApp(); seedTwoGames();
      restoreGame(KEY);                                     // 기존 항목(KEY)에 이어서 기록
      AS.info = INFO; T.$('tHome').value = '바뀐팀'; AS.abs = AS.abs.concat(taps(MINE, 1));
      openFromList(KEY2); await sleep(300);
      var g = JSON.parse(localStorage.getItem(KEY));
      eq(g.info, INFO, '기존 항목의 경기 정보'); eq(g.th, '바뀐팀', '기존 항목의 홈팀 이름');
      blankApp(); seedTwoGames();                           // 저장한 적 없는 새 경기
      AS.info = INFO; AS.abs = taps(MINE, 1); T.$('tHome').value = '새경기팀';
      openFromList(KEY2); await sleep(300);
      var s = snap(), key = savedWith(s, MINE)[0];
      ok(key, '새 경기가 저장 목록에 없음'); eq(JSON.parse(s.ls[key]).info, INFO, '새 항목의 경기 정보');
    } finally { restore(); }
  });

  // ── 공유 경기를 열 때의 경기 정보(AS.info) ──
  function quick() { var r = keepApp(); blankApp(); localStorage.clear(); return r; }   // 시간 안 쓰는 검사용: 앱 상태 · 저장소만 비우고 시작
  test('공유 데이터에 경기 정보가 없으면 AS.info 를 비운다(이전 경기의 날짜·구장이 남지 않는다)', async function () {
    var restore = quick();
    try {
      AS.info = INFO;
      openShared();
      eq(AS.info, null, '공유 경기를 연 뒤의 AS.info');
      eq(gameInfo().venue, '', '경기설정 탭에 보이는 구장');
    } finally { restore(); }
  });
  test('공유 데이터에 경기 정보가 있으면 그 값으로 채운다', async function () {
    var restore = quick();
    try {
      AS.info = INFO;
      openShared({ info: { date: '2026-06-01', venue: '공유구장', side: 'home', innings: 5 } });
      eq(AS.info, { date: '2026-06-01', venue: '공유구장', side: 'home', innings: 5 }, 'AS.info');
      eq(gameInfo().innings, 5, '경기설정 탭에 보이는 이닝 수');
    } finally { restore(); }
  });
  test('공유 데이터의 경기 정보는 경기설정 탭의 입력 제약대로 걸러서 넣는다(링크는 누가 만들었는지 모른다)', async function () {
    var restore = quick(), long = new Array(51).join('가');
    try {
      openShared({ info: { date: '<img src=x onerror=1>', venue: long, side: 'zzz', innings: 99 } });
      eq(AS.info, { venue: long.slice(0, 20) }, '쓸 수 없는 값은 버리고 구장은 20자까지');
      openShared({ info: '문자열' }); eq(AS.info, null, '객체가 아닌 info');
      openShared({ info: { date: 'x', venue: '  ', side: 1, innings: '7' } }); eq(AS.info, { innings: 7 }, '숫자 문자열 이닝만 통과');
    } finally { restore(); }
  });
  test('공유 경기를 열기 전에 저장하는 내 경기에는 내 경기 정보(AS.info)가 남는다', async function () {
    var restore = quick();
    try {
      AS.info = INFO; AS.abs = taps(MINE, 1);
      openShared({ info: { venue: '공유구장' } });
      var s = snap(), key = savedWith(s, MINE)[0];
      ok(key, '내 경기가 저장 목록에 없음'); eq(JSON.parse(s.ls[key]).info, INFO, '저장된 내 경기의 경기 정보');
      eq(AS.info, { venue: '공유구장' }, '열린 공유 경기의 경기 정보');
    } finally { restore(); }
  });

  // ── 공유 경기를 보기만 할 때는 "저장되지 않은 기록" 경고가 뜨지 않고, 고친 순간부터 뜬다 ──
  function leaveWarns() { var ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; }   // 페이지를 떠날 때 경고(core.js 의 beforeunload 핸들러)
  async function viewShared(extra) {   // 6타구짜리 공유 경기를 열고, 0.5초 뒤 updateAll 까지 지난 뒤에 본다(타구 5개 이상이면 "지금 저장하세요" 알림 대상)
    var raw = []; for (var i = 0; i < 6; i++) raw.push({ r: '안타', d: 20, p: '직구', z: 5, i: '1회초', b: 0, x: 0.5, y: 0.4, bn: SHARED, bno: 3, t: 'home', ba: 'R' });
    window._saveReminderShown = false;
    openShared(Object.assign({ abs: raw }, extra || {})); await sleep(700);
  }
  test('공유 경기를 보기만 하면 "저장되지 않은 기록" 경고(페이지 이탈 · 새 경기 확인 · 저장 알림)가 뜨지 않는다', async function () {
    var restore = quick();
    try {
      await viewShared();
      eq(window._gameSaved, false, '전제: updateAll 이 "저장 안 됨"으로 바꿔 둔 상태여야 이 테스트가 의미 있다');
      eq(_unsavedCounts().any, false, '저장 안 한 기록이 있다는 판단(페이지 이탈 경고 · 새 경기 확인이 이걸 본다)');
      ok(!leaveWarns(), '페이지를 떠날 때 경고가 뜸');
      eq(window._saveReminderShown, false, '"지금 저장하세요" 알림이 떴음');
    } finally { restore(); }
  });
  test('공유 경기를 보다가 기록(타구 · 점수 · 투구)을 고친 순간부터는 지금처럼 경고가 뜬다', async function () {
    var restore = quick();
    try {
      await viewShared(); AS.abs = AS.abs.concat(taps(EDIT, 1)); updateAll();
      ok(_unsavedCounts().any && leaveWarns(), '타구를 추가했는데 경고가 안 뜸');
      await viewShared(); AS.hs = AS.hs + 1; updateAll();
      ok(_unsavedCounts().any && leaveWarns(), '점수를 고쳤는데 경고가 안 뜸');
      await viewShared({ pitchers: [{ nm: '투수1', no: '1', hand: 'R', role: '', pitches: [] }] });
      ok(!_unsavedCounts().any, '전제: 투구를 고치기 전에는 경고가 없어야 함');
      AS.pitchers[0].pitches.push({ pt: '직구', result: '스트라이크', zone: 5 }); updateAll();
      ok(_unsavedCounts().any && leaveWarns(), '투구를 추가했는데 경고가 안 뜸');
    } finally { restore(); }
  });
})();
