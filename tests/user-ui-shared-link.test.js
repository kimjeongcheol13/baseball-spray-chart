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
  function openShared() {            // 배너의 "불러오기" — showApp 은 이 테스트의 관심사가 아니라 막아 둔다
    window._sharedPayload = sharedPayload(); window.showApp = function () {}; loadSharedGame();
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
})();
