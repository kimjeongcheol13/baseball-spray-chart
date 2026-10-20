// 경기 저장(cloudSave) 업로드가 다른 업로드에 취소되지 않는지 — 실제 js/cloud.js 를 가짜 서버에 붙여 돌린다.
// 배경: ① core.js 가 같은 이름(window.cloudSave)으로 옛 팀 코드용 함수를 다시 정의하면서 cloud.js 의 user_games 업로드를 버려,
//          로그인 사용자가 저장해도 그 경기가 바로 올라가지 않았다 (다음 시작 동기화 때야 올라감).
//       ② 그 업로드는 타구 기록 실시간 동기화(cloudAutoSyncRecord)와 디바운스 타이머(_debTimer) 하나를 같이 써서, ①을 고치면
//          저장 직후 3초 안에 타구가 기록될 때 그 경기 업로드가 취소된다 → 경기마다 따로 기다리게 했다.
// 파일 이름순으로 맨 뒤에 돈다 (앞선 테스트가 남긴 로그인 상태를 먼저 비운다).
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;
  var BASE = 1780600000000;
  function game(n, hs) { return { th: '홈' + n, ta: '원정', hs: hs, as: 0, d: '2026. 10. 11.', ts: Date.now() - 1000,
    abs: [{ id: BASE + n * 1000 + 1, bid: 'a', bname: '가', bnum: 1, res: '안타', inn: '1회초', team: 'home' }], home_lineup: [], away_lineup: [], pitchers: [] }; }
  function seed(list) {
    localStorage.clear();
    var saves = [];
    list.forEach(function (x) { localStorage.setItem(x.key, JSON.stringify(x.data)); saves.push({ key: x.key, label: x.key, ts: x.data.ts }); });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
  }
  function upserts(key) { return srv.log.filter(function (x) { return x.table === 'user_games' && x.op === 'upsert' && (x.rows || []).some(function (r) { return r.game_key === key; }); }); }
  function loginAndSettle(id) {   // 시작 동기화가 끝날 때까지 (서버 요청이 1초 동안 더 없을 때까지). id = 계정(생략하면 TEST-USER)
    return new Promise(function (resolve) {
      srv.signIn(id);
      var n = 0, last = -1, quiet = 0;
      (function poll() {
        var len = srv.log.length;
        if (len > 0 && len === last) quiet++; else { quiet = 0; last = len; }
        if (quiet >= 100 || ++n > 800) resolve(); else setTimeout(poll, 10);
      })();
    });
  }
  var booted = null;
  async function start() { if (!booted) booted = sleep(2000); await booted; srv.signOut(); await sleep(1000); srv.reset(); }

  test('저장 직후 3초 안에 타구 기록 동기화가 와도, 저장한 경기의 업로드는 취소되지 않는다', async function () {
    await start(); seed([]); await loginAndSettle(); srv.log.length = 0;
    var K = 'sl_' + (BASE + 1), d = game(1, 3);
    seed([{ key: K, data: d }]);
    cloudSave(K, d);
    await sleep(500);
    var abs0 = AS.abs, cg0 = AS.curGame;
    AS.abs = [{ id: BASE + 9001, bid: 'b', bname: '나', bnum: 2, res: '2루타', inn: '1회초', team: 'home' }]; AS.curGame = BASE + 999;
    try {
      cloudAutoSyncRecord();
      await sleep(4500);
      eq(upserts(K).length, 1, '저장한 경기가 올라감');
      ok(upserts('sl_auto_' + (BASE + 999)).length >= 1, '타구 기록 동기화도 올라감');
      eq(srv.user_games.filter(function (r) { return r.game_key === K; }).map(function (r) { return r.data.hs; }), [3], '서버의 그 경기');
    } finally { AS.abs = abs0; AS.curGame = cg0; }
  });
  test('두 경기를 연달아 저장하면 둘 다 올라가고, 같은 경기를 연달아 저장하면 마지막 것만 한 번 올라간다', async function () {
    await start(); seed([]); await loginAndSettle(); srv.log.length = 0;
    var K1 = 'sl_' + (BASE + 11), K2 = 'sl_' + (BASE + 12), a = game(11, 1), b = game(12, 2), b2 = game(12, 5);
    seed([{ key: K1, data: a }, { key: K2, data: b2 }]);
    cloudSave(K1, a); cloudSave(K2, b); await sleep(300); cloudSave(K2, b2);
    await sleep(4000);
    eq([upserts(K1).length, upserts(K2).length], [1, 1], '경기마다 한 번씩');
    eq(srv.user_games.filter(function (r) { return r.game_key === K2; }).map(function (r) { return r.data.hs; }), [5], '같은 경기는 마지막 저장본');
  });
  test('올리기 전에 오프라인이 되면, 연결되는 대로 시작 동기화가 그 경기를 올린다', async function () {
    await start(); seed([]); await loginAndSettle(); srv.log.length = 0;
    var K = 'sl_' + (BASE + 21), d = game(21, 7);
    seed([{ key: K, data: d }]);
    cloudSave(K, d); await sleep(300);
    window.dispatchEvent(new Event('offline')); await sleep(3500);
    eq(upserts(K).length, 0, '오프라인 동안 안 올라감');
    window.dispatchEvent(new Event('online')); await sleep(3000);
    eq(srv.user_games.filter(function (r) { return r.game_key === K; }).map(function (r) { return r.data.hs; }), [7], '연결 뒤 올라감');
  });
  // 후속 13번: 시작 동기화(cloud.js _startupSync)는 시작할 때 읽은 sl_saves 를, 서버 경기를 내려받아 목록에 넣을 때 끝에서 그대로 다시 써서
  // 그 사이(네트워크 왕복 동안) 새로 저장한 경기의 목록 항목이 빠졌다(경기 데이터 키는 남았다). 지금은 내려받기 응답을 받은 뒤 목록을 다시 읽는다.
  // 내려받기 응답(두 번째 user_games select)만 늦춰 그 사이에 실제 saveGame() 을 부른다. 늦추지 않으면(저장이 동기화 뒤) 고치기 전에도 남았다
  test('(후속 13번) 시작 동기화가 서버 경기를 내려받는 도중에 새 경기를 저장해도, 그 경기는 목록(sl_saves)에 남는다', async function () {
    await start(); seed([]);
    var RK = 'sl_' + (BASE + 31);   // 서버에만 있는 경기 → 시작 동기화가 내려받아 목록에 넣는다(sl_saves 를 다시 쓰는 경로)
    srv.user_games.push({ user_id: 'TEST-USER', game_key: RK, team_name: '홈31 vs 원정', date: null, data: game(31, 4), updated_at: new Date(Date.now() - 60000).toISOString() });
    var held = false;
    srv.delayRead = function (t, q) { if (t === 'user_games' && q.cols === 'game_key,data,updated_at') { held = true; return 2000; } return 0; };
    var abs0 = AS.abs;
    try {
      srv.signIn();
      for (var i = 0; i < 400 && !held; i++) await sleep(10);   // 시작 동기화가 내려받기 요청을 보낼 때까지
      ok(held, '시작 동기화가 내려받기 요청을 보내지 않음(이 테스트의 전제)');
      window._curSaveKey = null;
      AS.abs = [{ id: BASE + 9301, bid: 'c', bname: '다', bnum: 3, res: '안타', inn: '1회초', team: 'home' }];
      saveGame(); await sleep(500);
      var NK = window._curSaveKey;
      ok(NK && T.ls('sl_saves').some(function (s) { return s.key === NK; }), '저장 직후 목록에 있음(전제)');
      await sleep(2500);   // 내려받기 응답 → 시작 동기화가 끝난다
      var keys = T.ls('sl_saves').map(function (s) { return s.key; });
      ok(keys.indexOf(RK) >= 0, '서버 경기가 내려와 목록에 추가됨(sl_saves 를 다시 쓰는 경로를 탔다는 전제)');
      ok(localStorage.getItem(NK) !== null, '저장한 경기의 데이터 키는 남음');
      ok(keys.indexOf(NK) >= 0, '동기화 도중 저장한 경기가 목록에서 빠짐: ' + NK + ' / 목록 ' + JSON.stringify(keys));
    } finally { AS.abs = abs0; srv.delayRead = null; }
  });
  // 같은 경합(후속 13번)의 다른 경우 — 이름 바꾸기 · 삭제 · 같은 경기 정리. local = 이 기기 목록, rows = 서버 행.
  // 로그인 → 시작 동기화가 내려받기 요청(두 번째 user_games select)을 보낼 때까지 기다린다. 그 응답은 2초 늦게 온다(내용은 요청을 받은 때의 서버 상태)
  function row(key, d) { return { user_id: 'TEST-USER', game_key: key, team_name: d.th + ' vs ' + d.ta, date: d.d, data: d, updated_at: new Date(d.ts).toISOString() }; }
  async function signInHeldDownload(local, rows) {
    await start(); seed(local); srv.user_games = rows;
    var held = false;
    srv.delayRead = function (t, q) { if (t === 'user_games' && q.cols === 'game_key,data,updated_at') { held = true; return 2000; } return 0; };
    srv.signIn();
    for (var i = 0; i < 400 && !held; i++) await sleep(10);
    ok(held, '시작 동기화가 내려받기 요청을 보내지 않음(이 테스트의 전제)');
  }
  function listKeys() { return T.ls('sl_saves').map(function (s) { return s.key; }); }
  test('(후속 13번) 시작 동기화가 서버 경기를 내려받는 도중에 이름을 바꾸면, 바꾼 이름이 남는다', async function () {
    var G = 'sl_' + (BASE + 41), g = game(41, 1), RK = 'sl_' + (BASE + 42);
    var p0 = window.prompt;
    try {
      await signInHeldDownload([{ key: G, data: g }], [row(G, g), row(RK, game(42, 2))]);   // RK: 서버에만 있다 → 내려받아 목록에 넣는다(sl_saves 를 다시 쓰는 경로)
      window.prompt = function () { return '바꾼 이름'; };
      renameGame(G); await sleep(300);
      eq(T.ls('sl_saves').filter(function (s) { return s.key === G; }).map(function (s) { return s.label; }), ['바꾼 이름'], '바꾼 직후(전제)');
      await sleep(2500);
      ok(listKeys().indexOf(RK) >= 0, '서버 경기가 내려와 목록에 추가됨(전제)');
      eq(T.ls('sl_saves').filter(function (s) { return s.key === G; }).map(function (s) { return s.label; }), ['바꾼 이름'], '동기화가 끝난 뒤 이름');
    } finally { window.prompt = p0; srv.delayRead = null; }
  });
  test('(후속 13번) 시작 동기화가 서버 경기를 내려받는 도중에 경기를 지우면, 목록 · 데이터 · 서버 모두 지워진 채로 남는다', async function () {
    var D = 'sl_' + (BASE + 51), d = game(51, 1), RK = 'sl_' + (BASE + 52);
    var c0 = window.confirm;
    try {
      await signInHeldDownload([{ key: D, data: d }], [row(D, d), row(RK, game(52, 2))]);
      window.confirm = function () { return true; };
      deleteGame(D); await sleep(300);   // 서버 삭제(cloudDeleteGame)는 늦어진 내려받기 응답보다 먼저 끝난다 — 그 응답에는 아직 D 가 실려 있다
      ok(listKeys().indexOf(D) < 0 && localStorage.getItem(D) === null, '지운 직후 목록 · 데이터에 없음(전제)');
      await sleep(2500);
      ok(listKeys().indexOf(RK) >= 0, '서버 경기가 내려와 목록에 추가됨(전제)');
      ok(listKeys().indexOf(D) < 0, '지운 경기가 목록에 되살아남: ' + JSON.stringify(listKeys()));
      ok(localStorage.getItem(D) === null, '지운 경기의 데이터가 되살아남');
      ok(!srv.user_games.some(function (r) { return r.game_key === D; }), '서버에도 없음');
    } finally { window.confirm = c0; srv.delayRead = null; }
  });
  test('(후속 13번) 같은 경기 정리가 도는 시작 동기화 도중에 새 경기를 저장해도, 정리는 그대로 되고 저장한 경기도 남는다', async function () {
    function snap(n) {   // 같은 경기의 스냅샷: 타석이 1 ⊂ 2 ⊂ 3 개(실제 기록 시각 id · 같은 타자)
      var abs = []; for (var i = 0; i < n; i++) abs.push({ id: BASE + 50000 + i, bid: 'z', bname: '자', bnum: 9, res: '안타', inn: '1회초', team: 'home' });
      return { th: '스냅', ta: '원정', hs: 0, as: 0, d: '2026. 10. 11.', ts: BASE + 60000 + n, abs: abs, home_lineup: [], away_lineup: [], pitchers: [] };
    }
    var abs0 = AS.abs;
    try {
      await signInHeldDownload([], [1, 2, 3].map(function (n) { return row('sl_auto_' + (BASE + 70000 + n), snap(n)); }));   // 서버에만 있는 스냅샷 3개 → 정리(cleaned > 0)
      window._curSaveKey = null;
      AS.abs = [{ id: BASE + 9401, bid: 'd', bname: '라', bnum: 4, res: '2루타', inn: '1회초', team: 'home' }];
      saveGame(); await sleep(500);
      var NK = window._curSaveKey;
      ok(NK && listKeys().indexOf(NK) >= 0, '저장 직후 목록에 있음(전제)');
      await sleep(2500);
      var k = listKeys(), proper = k.filter(function (x) { return /^sl_\d+$/.test(x); });
      ok(!k.some(function (x) { return x.indexOf('sl_auto_') === 0; }), '스냅샷은 목록에 없음: ' + JSON.stringify(k));
      eq(proper.map(function (x) { return T.ls(x).abs.length; }), [3], '스냅샷 3개 → 타석 최다 1개가 정식 키로');
      ok(k.indexOf(NK) >= 0, '정리 도중 저장한 경기가 목록에서 빠짐: ' + JSON.stringify(k));
    } finally { AS.abs = abs0; srv.delayRead = null; }
  });
  // 후속 11번 테스트 계획 T1~T5 (design/sync-11-cloudsave.md 5.2절) — 호출부(saveGame 등) → core.js 래퍼 → cloud.js 업로드까지 지금 동작을 지킨다.
  // 실제 saveGame() 으로 새 경기를 저장한다: 300ms 뒤 저장되고 그 자리에서 cloudSave 를 부른다(업로드 타이머는 그때부터 3초). 새 경기 키를 돌려준다
  async function saveNew(n) {
    var abs0 = AS.abs;
    window._curSaveKey = null;
    AS.abs = [{ id: BASE + 9500 + n, bid: 'e', bname: '마', bnum: 5, res: '안타', inn: '1회초', team: 'home' }];
    try { saveGame(); await sleep(500); } finally { AS.abs = abs0; }
    return window._curSaveKey;
  }
  function inList(k) { return !!k && T.ls('sl_saves').some(function (s) { return s.key === k; }); }
  function modOf(k) { return (T.ls('sl_cloud_mod') || {})[k]; }
  function serverMod(k) { return srv.user_games.filter(function (r) { return r.game_key === k; }).map(function (r) { return r.updated_at; }); }
  test('(11번 T1) 실제 saveGame · _doImportText · renameGame → 3.5초 뒤 그 경기의 user_games 업로드가 1 · 1 · 0건', async function () {
    var R = 'sl_' + (BASE + 81), I = 'sl_' + (BASE + 82), im = game(82, 2), p0 = window.prompt;
    try {
      await start(); seed([{ key: R, data: game(81, 1) }]); await loginAndSettle(); srv.log.length = 0;   // R: 이름을 바꿀 경기(시작 동기화가 이미 올렸다)
      var S = await saveNew(1);
      var data = {}; data[I] = im;
      _doImportText(JSON.stringify({ saves: [{ key: I, label: '가져온 경기', ts: im.ts }], data: data }));
      window.prompt = function () { return '바꾼 이름'; };
      renameGame(R);
      ok(inList(S) && inList(I), '저장 · 가져오기가 목록에 있음(전제)');
      eq(T.ls('sl_saves').filter(function (s) { return s.key === R; }).map(function (s) { return s.label; }), ['바꾼 이름'], '이름이 바뀜(전제)');
      await sleep(3500);
      eq([upserts(S).length, upserts(I).length, upserts(R).length], [1, 1, 0], '저장 · 가져오기 · 이름 바꾸기의 user_games 업로드');
    } finally { window.prompt = p0; }
  });
  test('(11번 T2) 로그인 전에 저장하면 저장은 끝까지 되고 user_games 요청은 없다 → 로그인하면 시작 동기화가 올린다(updated_at = 수정 시각)', async function () {
    await start(); seed([]);
    window._gameSaved = false;
    var S = await saveNew(2);
    eq(window._gameSaved, true, '저장이 끝까지 됨(cloudSave 뒤의 저장 완료 처리까지)');
    ok(inList(S) && localStorage.getItem(S) !== null, '목록 · 데이터에 있음');
    await sleep(3500);
    eq(srv.log.filter(function (x) { return x.table === 'user_games'; }).length, 0, '로그인 전 user_games 요청');
    await loginAndSettle();
    eq(upserts(S).length, 1, '로그인 뒤 시작 동기화가 올림');
    ok(modOf(S) > 0, 'sl_cloud_mod 에 수정 시각이 있음');
    eq(serverMod(S), [new Date(modOf(S)).toISOString()], '서버 updated_at = sl_cloud_mod');
  });
  // 업로드 타이머가 도는 때 로그아웃돼 있으면 막는 장치가 두 겹이다: 타이머의 `_user.id !== uid` 확인, _upsertGame 의 _ensureAuth(세션 없음 → 안 보냄).
  // 하나만 빼면 다른 하나가 막아 이 테스트는 통과한다 — 둘 다 빠져야 실패한다
  test('(11번 T3) 저장하고 업로드 전에 로그아웃하면 그동안 올라가지 않고, 다시 로그인하면 시작 동기화가 올린다', async function () {
    await start(); seed([]); await loginAndSettle(); srv.log.length = 0;
    var S = await saveNew(3);
    await sleep(500);   // 저장 1초 뒤(업로드 타이머가 돌기 전)
    srv.signOut(); await sleep(3000);
    eq(upserts(S).length, 0, '로그아웃 동안 user_games 업로드');
    ok(localStorage.getItem(S) !== null, '로컬 경기는 남음');
    await loginAndSettle();
    eq(upserts(S).length, 1, '다시 로그인하면 올라감');
    eq(serverMod(S).length, 1, '서버에 그 경기');
  });
  // T3 의 다른 경우: 다른 계정으로 바뀌면 _ensureAuth 는 새 계정의 세션을 돌려주므로 막지 못한다 — 타이머의 계정 확인 하나만 막는다.
  // 이 기기의 경기는 새 계정의 시작 동기화가 그 계정에 올린다(지금 동작). 옛 타이머가 같은 경기를 한 번 더 보내지 않는지 본다
  test('(11번 T3b) 저장하고 업로드 전에 다른 계정으로 바뀌면, 옛 타이머는 올리지 않고 새 계정의 시작 동기화가 한 번 올린다', async function () {
    await start(); seed([]); await loginAndSettle(); srv.log.length = 0;
    var S = await saveNew(6);
    await sleep(500);   // 저장 1초 뒤(업로드 타이머가 돌기 전)
    srv.signOut(); await loginAndSettle('OTHER-USER');   // supabase-js 처럼 SIGNED_OUT → SIGNED_IN
    await sleep(2500);   // 옛 타이머(저장 3초 뒤)가 지나도록
    function by(uid) { return upserts(S).filter(function (x) { return x.rows.some(function (r) { return r.game_key === S && r.user_id === uid; }); }).length; }
    eq([by('TEST-USER'), by('OTHER-USER')], [0, 1], '옛 계정 · 새 계정으로 그 경기를 올린 요청');
  });
  test('(11번 T4) 팀 코드를 설정하고 로그인한 상태에서 한 번 저장하면 games · user_games 에 한 번씩 올라간다', async function () {
    await start(); seed([]); await loginAndSettle(); srv.log.length = 0;
    localStorage.setItem('sl_team_code', 'TEST-ONLY-TEAM');   // 가짜 팀 코드 — 운영 데이터와 무관
    try {
      var S = await saveNew(4);
      await sleep(3500);
      var g = srv.log.filter(function (x) { return x.table === 'games' && x.op === 'upsert' && (x.rows || []).some(function (r) { return r.game_key === S; }); });
      eq([g.length, upserts(S).length], [1, 1], 'games · user_games 업로드');
    } finally { localStorage.removeItem('sl_team_code'); }
  });
  test('(11번 T5) 저장해서 올라간 경기는 다음 시작 동기화에서 올리지도 내려받지도 않는다', async function () {
    await start(); seed([]); await loginAndSettle(); srv.log.length = 0;
    var S = await saveNew(5);
    await sleep(3500);
    eq(upserts(S).length, 1, '저장한 경기가 올라감(전제)');
    var mod = modOf(S), data = localStorage.getItem(S);
    ok(mod > 0, 'sl_cloud_mod 에 수정 시각이 찍힘');
    srv.log.length = 0; srv.signOut(); await sleep(1000);
    await loginAndSettle();   // 시작 동기화 한 번 더
    ok(srv.log.some(function (x) { return x.table === 'user_games' && x.op === 'select' && x.cols === 'game_key,data,updated_at'; }), '두 번째 시작 동기화가 내려받기 단계까지 돎(전제)');
    eq(upserts(S).length, 0, '다시 올리지 않음');
    eq(modOf(S), mod, 'sl_cloud_mod 그대로(내려받지 않음)');
    eq(localStorage.getItem(S), data, '로컬 데이터 그대로');
    eq(serverMod(S), [new Date(mod).toISOString()], '서버 updated_at = sl_cloud_mod');
  });
  test('(정리) 로그아웃하고 이 파일이 만든 상태를 비운다', async function () {
    srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear(); eq(srv.user, null, '로그아웃');
  });
})();
