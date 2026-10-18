// 자동저장 복구도 평소 저장처럼 바로 계정 클라우드(user_games)에 올라가는지 — 실제 js/cloud.js · js/core.js 를 가짜 서버에 붙여 돌린다 (후속 12번).
// 배경: 복구 배너(archRecoverAutosave)와 저장 목록의 숨은 자동저장 「복구」(recoverHiddenAutosave)는 _archQuietSave 로 로컬에만 저장하고
//       수정 시각(sl_cloud_mod)만 남겨, 로그인 중이어도 다음 시작 동기화 때(다음에 앱을 열거나 다시 로그인할 때)야 올라갔다.
//       앱을 열 때의 자동 복구와 ?import= 링크 복구는 같은 페이지의 시작 동기화(DOMContentLoaded 1.5초 뒤)가 바로 올리므로 대상이 아니다.
// 파일 이름순으로 뒤쪽에 돈다(로그인 상태를 쓰고, 끝에서 비운다).
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, ls = T.ls, test = T.test, sleep = T.sleep;
  var BASE = 1780700000000, K1 = 'sl_' + (BASE + 1), TS = BASE + 1;
  var F = ['abs', 'home_lineup', 'away_lineup', 'hs', 'as', 'zoneHistory', 'pitchers', 'info', 'curGame'];
  function abs(n) { var a = []; for (var i = 0; i < n; i++) a.push({ id: BASE + 100 + i, bid: 'a', bname: '가', bnum: 1, res: '안타', inn: '1회초', team: 'home' }); return a; }
  function game(n) { return { key: K1, th: '홈', ta: '원정', hs: n, as: 0, abs: abs(n), home_lineup: [], away_lineup: [], zoneHistory: {}, pitchers: [], d: '2026. 10. 18.', ts: TS }; }
  function rec(n, saveKey) { return { abs: abs(n), home_lineup: [], away_lineup: [], hs: n, as: 0, zoneHistory: {}, pitchers: [], th: '홈', ta: '원정', saveKey: saveKey }; }
  function upserts(key) { return srv.log.filter(function (x) { return x.table === 'user_games' && x.op === 'upsert' && (x.rows || []).some(function (r) { return r.game_key === key; }); }); }
  function settle() {   // 시작 동기화가 끝날 때까지 (서버 요청이 1초 동안 더 없을 때까지)
    return new Promise(function (resolve) {
      var n = 0, last = -1, quiet = 0;
      (function poll() {
        var len = srv.log.length;
        if (len > 0 && len === last) quiet++; else { quiet = 0; last = len; }
        if (quiet >= 100 || ++n > 800) resolve(); else setTimeout(poll, 10);
      })();
    });
  }
  var booted = null;
  // 로그인한 상태에서 시작: withK1 이면 저장 경기 K1 이 로컬 · 서버에 같은 내용(같은 수정 시각)으로 있다 → 시작 동기화는 아무것도 안 올린다
  async function loggedIn(withK1) {
    if (!booted) booted = sleep(2000);
    await booted; srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear();
    var saves = [];
    if (withK1) {
      localStorage.setItem(K1, JSON.stringify(game(1))); saves.push({ key: K1, label: '저장한 경기', ts: TS });
      srv.user_games.push({ user_id: 'TEST-USER', game_key: K1, team_name: '홈 vs 원정', date: null, data: game(1), updated_at: new Date(TS).toISOString() });
    }
    localStorage.setItem('sl_saves', JSON.stringify(saves));
    srv.signIn(); await settle(); srv.log.length = 0;
  }
  // AS · 현재 저장 키 · confirm 을 되돌리고, 복구가 부른 updateAll 의 타이머(실시간 동기화 · 로컬 자동저장)를 끊는다
  async function isolated(fn) {
    var a = {}, ck = window._curSaveKey, gs = window._gameSaved, cf = window.confirm, cs = window.cloudAutoSyncRecord;
    F.forEach(function (k) { a[k] = AS[k]; });
    window.cloudAutoSyncRecord = null;
    try { await fn(); }
    finally {
      storageManager.cancelPendingAutosave(); clearTimeout(_autoTimer);
      F.forEach(function (k) { AS[k] = a[k]; });
      window._curSaveKey = ck; window._gameSaved = gs; window.confirm = cf; window.cloudAutoSyncRecord = cs;
    }
  }

  test('복구 배너: 새 경기 자동저장을 복구하면 복구 항목(sl_rec_…)이 3초 뒤 user_games 에 올라간다', async function () {
    await isolated(async function () {
      await loggedIn(false);
      localStorage.setItem('sl_autosave', JSON.stringify({ _v: 1, _ts: Date.now(), data: rec(2, null) }));
      archRecoverAutosave();
      var RK = T.ls('sl_saves').map(function (s) { return s.key; }).filter(function (k) { return /^sl_rec_/.test(k); })[0];
      ok(RK, '복구 항목이 생기지 않음(전제)');
      eq(upserts(RK).length, 0, '3초 디바운스 전에는 안 올라감(전제)');
      await sleep(3500);
      eq(upserts(RK).length, 1, '복구한 경기가 올라감');
      eq(srv.user_games.filter(function (r) { return r.game_key === RK; }).map(function (r) { return r.data.abs.length; }), [2], '서버의 그 경기');
    });
  });
  test('복구 배너: 저장한 경기의 자동저장을 복구하면 그 경기(K1)가 복구한 내용으로 올라간다', async function () {
    await isolated(async function () {
      await loggedIn(true);
      localStorage.setItem('sl_autosave', JSON.stringify({ _v: 1, _ts: Date.now(), data: rec(3, K1) }));
      archRecoverAutosave();
      eq(ls(K1).abs.length, 3, '로컬 K1 을 복구본으로 덮음(전제)');
      await sleep(3500);
      eq(upserts(K1).length, 1, 'K1 이 올라감');
      eq(srv.user_games.filter(function (r) { return r.game_key === K1; }).map(function (r) { return r.data.abs.length; }), [3], '서버의 K1');
    });
  });
  test('저장 목록의 숨은 자동저장(sl_auto_*) 「복구」도 그 경기(K1)를 바로 올린다', async function () {
    await isolated(async function () {
      await loggedIn(true);
      localStorage.setItem('sl_auto_' + (BASE + 77), JSON.stringify(rec(4, K1)));
      window.confirm = function () { return true; };   // "저장된 경기를 이 임시저장으로 덮어쓸까요?"
      recoverHiddenAutosave('sl_auto_' + (BASE + 77));
      eq(ls(K1).abs.length, 4, '로컬 K1 을 복구본으로 덮음(전제)');
      await sleep(3500);
      eq(upserts(K1).length, 1, 'K1 이 올라감');
      eq(srv.user_games.filter(function (r) { return r.game_key === K1; }).map(function (r) { return r.data.abs.length; }), [4], '서버의 K1');
    });
  });
  test('복구할 기록이 없으면(타석 0 · 투구 0) 아무것도 올리지 않는다 — 열려 있던 경기(K1)도', async function () {
    await isolated(async function () {
      await loggedIn(true);
      window._curSaveKey = K1;   // 지금 열려 있는 경기
      localStorage.setItem('sl_autosave', JSON.stringify({ _v: 1, _ts: Date.now(), data: rec(0, null) }));
      archRecoverAutosave();
      await sleep(3500);
      eq(srv.log.filter(function (x) { return x.table === 'user_games' && x.op === 'upsert'; }).length, 0, 'user_games 업로드');
    });
  });
  test('(정리) 로그아웃하고 이 파일이 만든 상태를 비운다', async function () {
    srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear(); eq(srv.user, null, '로그아웃');
  });
})();
