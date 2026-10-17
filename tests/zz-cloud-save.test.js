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
  function loginAndSettle() {   // 시작 동기화가 끝날 때까지 (서버 요청이 1초 동안 더 없을 때까지)
    return new Promise(function (resolve) {
      srv.signIn();
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
  // 후속 13번(알려진 문제 · 아직 안 고침): 시작 동기화(cloud.js _startupSync)는 시작할 때 읽은 sl_saves 를, 서버 경기를 내려받아 목록에 넣을 때 끝에서
  // 그대로 다시 쓴다 → 그 사이(네트워크 왕복 동안) 새로 저장한 경기의 목록 항목이 빠진다(경기 데이터 키는 남는다).
  // 내려받기 응답(두 번째 user_games select)만 늦춰 그 사이에 실제 saveGame() 을 부른다. 늦추지 않으면(저장이 동기화 뒤) 항목은 남는다.
  // 지금 동작을 단언한다 — 13번을 고치면 마지막 단언을 "남는다"(keys.indexOf(NK) >= 0)로 뒤집는다
  test('(알려진 문제 · 후속 13번) 시작 동기화가 서버 경기를 내려받는 도중에 새 경기를 저장하면, 지금은 그 경기가 목록(sl_saves)에서 빠진다', async function () {
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
      ok(keys.indexOf(NK) < 0, '동기화 도중 저장한 경기가 목록에 남음 — 13번이 고쳐졌다면 이 단언을 뒤집는다: ' + JSON.stringify(keys));
    } finally { AS.abs = abs0; srv.delayRead = null; }
  });
  test('(정리) 로그아웃하고 이 파일이 만든 상태를 비운다', async function () {
    srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear(); eq(srv.user, null, '로그아웃');
  });
})();
