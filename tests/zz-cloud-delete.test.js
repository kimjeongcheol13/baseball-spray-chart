// 경기 삭제가 클라우드(user_games)에 반영되는지 — 실제 js/cloud.js · js/core.js 를 가짜 서버에 붙여 돌린다.
// 배경: cloudDelete 는 예전 팀 코드 테이블(games)만 지워서, 로그인 사용자가 경기를 지워도 user_games 행이 남았다 → 다음 시작 동기화가 "로컬에 없는 경기"로 다시 받아 왔다.
//  · 지울 때는 본인 행(user_id)의 해당 키만 지운다 · 지운 행 수를 확인한다(RLS 는 에러 없이 0행 삭제로 끝날 수 있다)
//  · 서버에서 못 지웠거나 오프라인 · 로그아웃이면 지운 키(sl_cloud_del)를 남겨 두고, 시작 동기화가 다시 지우며 그 키는 내려받지 않는다
// 파일 이름순으로 맨 뒤에 돈다 (앞선 테스트가 남긴 로그인 · 팀 상태를 먼저 비운다).
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, ls = T.ls, test = T.test, sleep = T.sleep, $ = T.$;
  var BASE = 1780200000000;
  var K1 = 'sl_1779002911000', K2 = 'sl_1779002911001', K3 = 'sl_1779002911002', K9 = 'sl_1779002911009';
  var DEL = 'sl_cloud_del', MOD = 'sl_cloud_mod', ME = 'TEST-USER';

  function iso(ms) { return new Date(ms).toISOString(); }
  function ab(id, n) { return { id: id, bid: 'p-' + n, bname: n, bnum: 1, team: 'home', res: '안타', inn: '1회초' }; }
  function absOf(base) { return ['가', '나', '다', '라'].map(function (n, i) { return ab(base + i * 20000, n); }); }
  function gdata(extra) { return Object.assign({ th: '홈', ta: '원정', hs: 1, as: 0, d: '2026. 5. 31.', ts: BASE }, extra || {}); }
  function row(key, user, extra) { return { user_id: user || ME, game_key: key, team_name: '홈 vs 원정', date: '2026. 5. 31.', data: gdata(extra), updated_at: iso(BASE - 5000) }; }   // 서버본이 더 옛것 → 시작 동기화가 로컬을 서버본으로 덮지 않는다
  var A = absOf(BASE), B = absOf(BASE + 5e6);   // A = 한 경기(K1 · K2 두 사본), B = 다른 경기(K3)
  function seed(locals, serverRows, del) {
    srv.reset(); localStorage.clear();
    var saves = [], mods = {};
    locals.forEach(function (l) { localStorage.setItem(l.key, JSON.stringify(gdata({ abs: l.abs, ts: l.ts }))); saves.push({ key: l.key, label: l.key + ' 1:0', ts: l.ts }); mods[l.key] = l.ts; });
    localStorage.setItem('sl_saves', JSON.stringify(saves)); localStorage.setItem(MOD, JSON.stringify(mods));
    if (del) localStorage.setItem(DEL, JSON.stringify(del));
    srv.user_games = serverRows || [];
  }
  function deletes() { return srv.log.filter(function (x) { return x.table === 'user_games' && x.op === 'delete'; }); }
  function serverKeys(user) { return srv.user_games.filter(function (r) { return !user || r.user_id === user; }).map(function (r) { return r.game_key; }).sort(); }
  function localKeys() { return JSON.parse(localStorage.getItem('sl_saves') || '[]').map(function (s) { return s.key; }).sort(); }
  function loginAndSettle() {   // user-games.test.js 와 같은 방식: 서버 요청이 1초 동안 더 없을 때까지
    return new Promise(function (resolve) {
      var ind = $('saveInd'), sawFail = false;
      var mo = new MutationObserver(function () { if (/클라우드 실패/.test(ind.textContent)) sawFail = true; });
      if (ind) mo.observe(ind, { childList: true, characterData: true, attributes: true, subtree: true });
      srv.signIn();
      var n = 0, last = -1, quiet = 0;
      (function poll() {
        var len = srv.log.length;
        if (len > 0 && len === last) quiet++; else { quiet = 0; last = len; }
        if (quiet >= 100 || ++n > 800) { mo.disconnect(); resolve({ log: srv.log.slice(), sawFail: sawFail }); }
        else setTimeout(poll, 10);
      })();
    });
  }
  var booted = null;
  async function start() {   // 앞선 테스트의 로그인 · 팀 상태를 지운다 (user-teams.test.js 와 같은 방식)
    if (!booted) booted = sleep(2000);
    await booted;
    srv.signOut(); await sleep(1000);
  }
  function withConfirm(fn) { var old = window.confirm; window.confirm = function () { return true; }; try { return fn(); } finally { window.confirm = old; } }
  var toast = function () { return ($('toastTxt') || {}).textContent || ''; };

  test('로그인한 사용자가 경기를 지우면(불러오기 목록 삭제) 서버에서 본인 행의 그 경기 사본들만 지워진다 — 다른 경기 · 다른 사용자의 같은 키는 그대로', async function () {
    await start();
    seed([{ key: K1, abs: A, ts: BASE }, { key: K2, abs: A, ts: BASE + 10 }, { key: K3, abs: B, ts: BASE + 20 }],
      [row(K1), row(K2), row(K3), row(K1, 'OTHER-USER'), row(K2, 'OTHER-USER')]);
    await loginAndSettle(); srv.log.length = 0;
    withConfirm(function () { deleteGame(K2); });   // 같은 경기의 사본 K1 · K2 를 한꺼번에
    await sleep(500);
    var d = deletes(); eq(d.length, 1, '삭제 요청 수');
    eq([d[0].f, d[0].inF.game_key.slice().sort()], [{ user_id: ME }, [K1, K2]], '본인 행(user_id) · 해당 키만');
    eq(serverKeys(ME), [K3], '서버: 내 행은 다른 경기만 남음'); eq(serverKeys('OTHER-USER'), [K1, K2], '서버: 다른 사용자의 행은 그대로');
    eq(localKeys(), [K3], '로컬'); eq(localStorage.getItem(DEL), null, '확인되면 지운 목록에서 뺀다');
  });
  test('서버에 올라간 적 없는 사본은 지울 것이 없다 — 있는 키만 지우고 목록을 비운다', async function () {
    await start();
    seed([{ key: K1, abs: A, ts: BASE }], [row(K1)]);
    await loginAndSettle(); srv.log.length = 0;
    withConfirm(function () { deleteGame(K1); });   // 로컬에서 지움
    var res = await cloudDeleteGames([K9]);         // 오프라인에서 만들어져 서버에 올라간 적 없는 사본(K9)도 같은 경기였다고 하자
    await sleep(500);
    eq(deletes().map(function (x) { return x.inF.game_key; }), [[K1]], '서버에 있는 키만 지움 (K9 는 서버에 없다)');
    eq(localStorage.getItem(DEL), null, '목록 비움'); eq(serverKeys(ME), [], '서버'); eq(res.ok, true, '결과');
  });
  test('RLS 가 막아 에러 없이 0행이 지워지면 실패로 처리한다 — 사용자에게 알리고, 지운 목록에 남겨 다음 동기화 때 다시 지운다', async function () {
    await start();
    seed([{ key: K3, abs: B, ts: BASE + 20 }], [row(K1), row(K3)], [K1]);   // K1 은 이 기기에서 이미 지운 경기
    srv.rlsDelete = true;   // 정책이 막는다: 에러 없이 0행 삭제
    var s = await loginAndSettle();   // 시작 동기화가 지우려 하지만 0행
    ok(s.sawFail, '시작 동기화의 실패 알림'); eq(ls(DEL), [K1], '지운 목록에 남음'); eq(serverKeys(ME), [K1, K3], '서버는 그대로'); eq(localKeys(), [K3], '지운 경기는 로컬에서 되살아나지 않는다');
    srv.log.length = 0;
    var res = await cloudDeleteGames([K1]);   // 사용자가 직접 지움
    eq([res.ok, res.failed], [false, [K1]], '실패로 돌려줌'); ok(/지우지 못했어요/.test(toast()), '사용자에게 알림: ' + toast());
    eq(deletes().length, 1, '삭제를 시도했다'); eq(ls(DEL), [K1], '여전히 목록에 남음');
    srv.rlsDelete = false;   // 권한이 풀린 뒤 다음 시작 동기화
    srv.signOut(); await sleep(1000); await loginAndSettle();
    eq(serverKeys(ME), [K3], '다시 지워짐'); eq(localStorage.getItem(DEL), null, '목록 비움'); eq(localKeys(), [K3], '로컬');
  });
  test('(원래 버그) 지운 경기는 시작 동기화가 서버 행을 다시 받아 와도 되살아나지 않는다 — 서버에서 못 지웠을 때도', async function () {
    await start();
    seed([{ key: K3, abs: B, ts: BASE + 20 }], [row(K1), row(K3), row(K9)], [K1]);
    srv.failWrite = { status: 500, code: 'XX000', message: 'internal error' };   // 삭제 요청이 서버 오류로 실패
    var s = await loginAndSettle();
    eq(localKeys(), [K3, K9], '지운 K1 은 받지 않고, 지운 적 없는 K9(다른 기기에서 올린 경기)는 받는다');
    eq(ls(DEL), [K1], '지운 목록은 그대로(다음에 다시 시도)'); ok(s.sawFail, '실패 알림');
    srv.failWrite = null; srv.signOut(); await sleep(1000); await loginAndSettle();
    eq(serverKeys(ME), [K3, K9], '서버 장애가 풀리면 지워진다'); eq(localStorage.getItem(DEL), null, '목록 비움');
  });
  test('로그아웃 상태에서 지우면 서버로는 아무것도 안 나가고, 지운 목록에 남았다가 로그인하면 서버에서 지워진다', async function () {
    await start();
    seed([{ key: K1, abs: A, ts: BASE }, { key: K3, abs: B, ts: BASE + 20 }], [row(K1), row(K3)]);
    withConfirm(function () { deleteGame(K1); }); await sleep(300);
    eq(srv.log.length, 0, '로그인 전: 서버 요청 없음'); eq(ls(DEL), [K1], '목록에 남음'); eq(localKeys(), [K3], '로컬에서는 지워짐');
    await loginAndSettle();
    eq(serverKeys(ME), [K3], '로그인 뒤 서버에서 지워짐'); eq(localKeys(), [K3], '되살아나지 않음'); eq(localStorage.getItem(DEL), null, '목록 비움');
  });
  test('오프라인에서 지우면 연결되는 대로 서버에서 지운다', async function () {
    await start();
    seed([{ key: K1, abs: A, ts: BASE }, { key: K3, abs: B, ts: BASE + 20 }], [row(K1), row(K3)]);
    await loginAndSettle(); srv.log.length = 0;
    window.dispatchEvent(new Event('offline'));
    withConfirm(function () { deleteGame(K1); }); await sleep(300);
    eq(srv.log.length, 0, '오프라인: 서버 요청 없음'); eq(ls(DEL), [K1], '목록');
    window.dispatchEvent(new Event('online')); await sleep(2500);
    eq(serverKeys(ME), [K3], '연결된 뒤 서버에서 지워짐'); eq(localKeys(), [K3], '로컬'); eq(localStorage.getItem(DEL), null, '목록 비움');
  });
  test('지운 키가 로컬에 다시 쓰이면(저장 · 가져오기 · 복구) 지운 목록에서 빠진다 — 새로 저장한 경기를 서버에서 지우지 않는다', async function () {
    await start();
    seed([], [], [K1, K2]);
    window._slMarkMod(K1);
    eq(ls(DEL), [K2], 'K1 만 빠짐'); window._slMarkMod(K2); eq(localStorage.getItem(DEL), null, '둘 다 빠지면 비움');
  });
  test('(정리) 로그아웃하고 이 파일이 만든 상태를 비운다', async function () {
    srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear(); eq(srv.user, null, '로그아웃');
  });
})();
