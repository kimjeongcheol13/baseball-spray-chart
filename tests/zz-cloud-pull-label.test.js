// 휴대폰 · PC 경기 목록 맞추기 — 실제 js/cloud.js · js/core.js 를 가짜 서버에 붙여 돌린다.
// 배경: ① 시작 동기화는 앱을 열 때 · 로그인할 때만 돌아, 켜 둔 PC 탭에는 휴대폰에서 저장한 경기가 들어오지 않았다
//       ② 경기 이름(sl_saves label)은 클라우드에 올라가지 않아, 같은 경기가 기기마다 다른 이름(내려받은 쪽은 "홈 vs 원정 날짜")으로 보였다
//   → 「경기 불러오기」를 열면 다시 맞추고(cloudSyncNow, 20초에 한 번), 이름은 user_games data.saveLabel 로 함께 오간다(로컬 경기 데이터에는 남기지 않는다).
// 파일 이름순으로 뒤쪽에 돈다(로그인 상태를 쓰고, 끝에서 비운다).
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, ls = T.ls, test = T.test, sleep = T.sleep;
  var BASE = 1780800000000, K1 = 'sl_' + (BASE + 1), K2 = 'sl_' + (BASE + 2), TS = BASE + 1;
  function abs(n, from) { var a = []; for (var i = 0; i < n; i++) a.push({ id: from + i, bid: 'a', bname: '가', bnum: 1, res: '안타', inn: '1회초', team: 'home' }); return a; }
  function game(key, n) { return { key: key, th: '홈', ta: '원정', hs: n, as: 0, abs: abs(n, key === K1 ? BASE + 100 : BASE + 500), home_lineup: [], away_lineup: [], zoneHistory: {}, pitchers: [], d: '2026. 10. 20.', ts: TS }; }
  function iso(ms) { return new Date(ms).toISOString(); }
  function row(key, data, ms) { return { user_id: 'TEST-USER', game_key: key, team_name: '홈 vs 원정', date: null, data: data, updated_at: iso(ms) }; }
  function label(key) { var s = (ls('sl_saves') || []).filter(function (x) { return x.key === key; })[0]; return s ? s.label : null; }
  function reqs(op) { return srv.log.filter(function (x) { return x.table === 'user_games' && x.op === op; }); }
  function settle() {   // 동기화가 끝날 때까지 (서버 요청이 1초 동안 더 없을 때까지)
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
  // 로그인한 상태에서 시작: K1 이 로컬 · 서버에 같은 내용(같은 수정 시각)으로 있다 → 시작 동기화는 아무것도 안 올린다
  async function loggedIn() {
    if (!booted) booted = sleep(2000);
    await booted; srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear();
    localStorage.setItem(K1, JSON.stringify(game(K1, 1)));
    localStorage.setItem('sl_saves', JSON.stringify([{ key: K1, label: 'PC 이름', ts: TS }]));
    srv.user_games.push(row(K1, game(K1, 1), TS));
    srv.signIn(); await settle(); srv.log.length = 0;
    await sleep(21000);   // 방금 돈 시작 동기화 뒤 20초 안에는 「경기 불러오기」가 다시 맞추지 않는다
  }
  // 토스트 · 이름 입력창 · 열린 경기 키를 되돌린다
  async function isolated(fn) {
    var st = window.showToast, pr = window.prompt, ck = window._curSaveKey, toasts = [];
    window.showToast = function (m) { toasts.push(String(m)); };
    try { await fn(toasts); }
    finally { window.showToast = st; window.prompt = pr; window._curSaveKey = ck; closeOverlay('loadOverlay'); }
  }

  test('켜 둔 PC: 휴대폰에서 고친 경기 · 새 경기가 「경기 불러오기」를 열면 휴대폰 이름으로 들어오고 열린 목록이 다시 그려진다', async function () {
    await isolated(async function () {
      await loggedIn();
      srv.user_games[0] = row(K1, Object.assign(game(K1, 3), { saveLabel: '휴대폰 이름' }), TS + 60000);   // 휴대폰이 K1 을 더 기록하고 이름을 바꿨다
      srv.user_games.push(row(K2, Object.assign(game(K2, 2), { saveLabel: '휴대폰 새 경기' }), TS + 60000));
      openLoad(); await settle();
      eq(ls(K1).abs.length, 3, 'K1 을 서버본(3타석)으로');
      eq('saveLabel' in ls(K1) || 'saveLabel' in ls(K2), false, '로컬 경기 데이터에 이름 필드가 남음');
      eq(label(K1), '휴대폰 이름', 'K1 이름');
      eq(label(K2), '휴대폰 새 경기', '새 경기 K2 이름');
      ok(T.$('saveList').textContent.indexOf('휴대폰 새 경기') >= 0, '열린 목록을 다시 그리지 않음');
      srv.log.length = 0;
      openLoad(); await sleep(1500);
      eq(reqs('select').length, 0, '20초 안에 다시 열면 서버를 다시 읽지 않음');
    });
  });
  test('이름을 싣지 않은 예전 행이 더 새로우면 내용만 받고 이 기기 이름은 그대로', async function () {
    await isolated(async function () {
      await loggedIn();
      srv.user_games[0] = row(K1, game(K1, 4), TS + 60000);
      openLoad(); await settle();
      eq(ls(K1).abs.length, 4, 'K1 을 서버본으로');
      eq(label(K1), 'PC 이름', 'K1 이름');
    });
  });
  test('지금 열린 경기가 다른 기기에서 더 새로 저장됐으면 다시 열라고 알린다', async function (){
    await isolated(async function (toasts) {
      await loggedIn();
      window._curSaveKey = K1;
      srv.user_games[0] = row(K1, game(K1, 2), TS + 60000);
      openLoad(); await settle();
      ok(toasts.some(function (m) { return m.indexOf('다른 기기에서 바뀌었어요') >= 0; }), '알림 없음: ' + JSON.stringify(toasts));
    });
  });
  test('올릴 때 이름(saveLabel)을 함께 싣는다 — 다시 맞추기(불러오기) · 저장 업로드 모두, 로컬 경기 데이터는 그대로', async function () {
    await isolated(async function () {
      await loggedIn();
      localStorage.setItem(K1, JSON.stringify(game(K1, 2))); window._slMarkMod(K1, TS + 60000);   // 이 기기에서 더 기록했다(오프라인 등으로 아직 안 올라감)
      openLoad(); await settle();
      var r = srv.user_games.filter(function (x) { return x.game_key === K1; })[0];
      eq([r.data.abs.length, r.data.saveLabel], [2, 'PC 이름'], '다시 맞추기가 올린 K1');
      var sl = ls('sl_saves'); sl[0].label = '저장한 이름'; localStorage.setItem('sl_saves', JSON.stringify(sl));
      window._cloudSaveUser(K1, ls(K1));   // saveGame → core.js cloudSave → 이 함수 (3초 디바운스)
      await sleep(3500); await settle();
      r = srv.user_games.filter(function (x) { return x.game_key === K1; })[0];
      eq(r.data.saveLabel, '저장한 이름', '저장 업로드가 올린 K1 이름');
      eq('saveLabel' in ls(K1), false, '로컬 K1 데이터에 이름 필드');
    });
  });
  test('로그인 전: 「경기 불러오기」에 이 기기만의 목록이라고 알리고 서버에는 요청하지 않는다', async function () {
    await isolated(async function () {
      if (!booted) booted = sleep(2000);
      await booted; srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear();
      openLoad(); await sleep(1500);
      ok(document.querySelector('#saveList .load-sync-hint'), '안내 없음');
      eq(reqs('select').length + reqs('upsert').length, 0, 'user_games 요청');
    });
  });
  test('(정리) 로그아웃하고 이 파일이 만든 상태를 비운다', async function () {
    srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear(); eq(srv.user, null, '로그아웃');
  });
})();
