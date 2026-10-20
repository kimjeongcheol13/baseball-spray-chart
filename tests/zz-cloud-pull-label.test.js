// 휴대폰 · PC 경기 목록 맞추기 — 실제 js/cloud.js · js/core.js 를 가짜 서버에 붙여 돌린다.
// 배경: ① 시작 동기화는 앱을 열 때 · 로그인할 때만 돌아, 켜 둔 PC 탭에는 휴대폰에서 저장한 경기가 들어오지 않았다
//       ② 경기 이름(sl_saves label)은 클라우드에 올라가지 않아, 같은 경기가 기기마다 다른 이름(내려받은 쪽은 "홈 vs 원정 날짜")으로 보였다
//   → 「경기 불러오기」를 열면 다시 맞추고(cloudSyncNow, 20초에 한 번), 이름은 user_games data.saveLabel 로 함께 오간다(로컬 경기 데이터에는 남기지 않는다).
//       ③ 이름 바꾸기(renameGame)는 경기 내용을 올리지 않아(오래된 기기가 서버를 덮지 않게) 바꾼 이름이 그 기기에만 남았다
//   → 이름과 바꾼 시각만 user_games.label · label_at(sql/14)에 update 하고, 다시 맞출 때 label_at 이 더 새로운 쪽 이름을 쓴다.
// 기기 전환 = localStorage 를 그 기기의 것으로 바꾼다(서버 srv.user_games 는 공유). 파일 이름순으로 뒤쪽에 돈다(로그인 상태를 쓰고, 끝에서 비운다).
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
  // 로그인한 상태에서 시작: K1 이 로컬 · 서버에 같은 내용(같은 수정 시각)으로 있다 → 시작 동기화는 아무것도 안 올린다.
  // prep = 로그인 전에 서버 · 로컬을 더 꾸민다. noWait = 20초를 기다리지 않는다(그동안 「경기 불러오기」는 다시 맞추지 않는다)
  async function loggedIn(noWait, prep) {
    if (!booted) booted = sleep(2000);
    await booted; srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear();
    localStorage.setItem(K1, JSON.stringify(game(K1, 1)));
    localStorage.setItem('sl_saves', JSON.stringify([{ key: K1, label: 'PC 이름', ts: TS }]));
    srv.user_games.push(row(K1, game(K1, 1), TS));
    if (prep) prep();
    srv.signIn(); await settle(); srv.log.length = 0;
    if (!noWait) await sleep(21000);   // 방금 돈 시작 동기화 뒤 20초 안에는 「경기 불러오기」가 다시 맞추지 않는다
  }
  function srvRow(key) { return srv.user_games.filter(function (x) { return x.game_key === key; })[0]; }
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
  test('휴대폰(내용이 오래된 기기)에서 이름을 바꾸면 이름만 올라가고, PC 가 「경기 불러오기」를 열면 그 이름이 된다 — 서버 · PC 의 기록과 수정 시각은 그대로', async function () {
    await isolated(async function () {
      await loggedIn(true);   // 지금 기기 = 휴대폰: K1 1타석
      var later = TS + 60000;
      srv.user_games[0] = row(K1, Object.assign(game(K1, 3), { saveLabel: 'PC 이름' }), later);   // PC 가 K1 을 3타석까지 기록해 올렸다
      var pc = {}; pc[K1] = JSON.stringify(game(K1, 3)); pc.sl_saves = JSON.stringify([{ key: K1, label: 'PC 이름', ts: TS }]); pc.sl_cloud_mod = JSON.stringify({ [K1]: later });
      window.prompt = function () { return '휴대폰 이름'; };
      renameGame(K1); await settle();
      eq(reqs('upsert').length, 0, '이름 바꾸기가 경기 내용을 올림');
      eq(reqs('update').map(function (x) { return [x.f.game_key, Object.keys(x.rows[0]).sort()]; }), [[K1, ['label', 'label_at']]], '이름 바꾸기가 고친 열');
      var r = srvRow(K1);
      eq([r.data.abs.length, r.updated_at, r.label], [3, iso(later), '휴대폰 이름'], '서버 K1: PC 기록 · 수정 시각 그대로, 이름만');
      localStorage.clear(); Object.keys(pc).forEach(function (k) { localStorage.setItem(k, pc[k]); });   // PC 로 바꾼다
      srv.log.length = 0;
      await sleep(21000);
      openLoad(); await settle();
      ok(reqs('select').length > 0, '「경기 불러오기」가 다시 맞추지 않음(전제)');
      eq(label(K1), '휴대폰 이름', 'PC 의 K1 이름');
      eq(ls(K1).abs.length, 3, 'PC 의 K1 기록');
      eq(reqs('upsert').length + reqs('update').length, 0, 'PC 가 다시 올림');
      eq([srvRow(K1).data.abs.length, srvRow(K1).updated_at], [3, iso(later)], '서버 K1');
      ok(T.$('saveList').textContent.indexOf('휴대폰 이름') >= 0, '열린 목록을 다시 그리지 않음');
    });
  });
  test('오프라인에서 바꾼 이름은 연결되면 올라간다(경기 내용은 안 올림)', async function () {
    await isolated(async function () {
      await loggedIn(true);
      window.dispatchEvent(new Event('offline'));
      window.prompt = function () { return '오프라인 이름'; };
      renameGame(K1); await sleep(500);
      eq(reqs('update').length, 0, '오프라인 동안 요청');
      window.dispatchEvent(new Event('online')); await settle();
      eq(reqs('upsert').length, 0, '경기 내용을 올림');
      eq([srvRow(K1).label, srvRow(K1).updated_at, srvRow(K1).data.abs.length], ['오프라인 이름', iso(TS), 1], '서버 K1');
    });
  });
  test('바꾼 이름이 있는 경기는, 내용만 더 새로 고친 기기가 실어 온 예전 이름(saveLabel)으로 돌아가지 않는다', async function () {
    await isolated(async function () {
      var at = TS + 30000;
      await loggedIn(false, function () {
        localStorage.setItem('sl_saves', JSON.stringify([{ key: K1, label: '바꾼 이름', ts: TS, labelAt: at }]));
        srv.user_games[0].label = '바꾼 이름'; srv.user_games[0].label_at = iso(at);
      });
      srv.user_games[0] = Object.assign(row(K1, Object.assign(game(K1, 2), { saveLabel: '예전 이름' }), TS + 60000), { label: '바꾼 이름', label_at: iso(at) });   // 이름을 못 받은 기기가 더 기록해 올렸다
      openLoad(); await settle();
      eq(ls(K1).abs.length, 2, 'K1 을 서버본으로');
      eq(label(K1), '바꾼 이름', 'K1 이름');
    });
  });
  test('sql/14 적용 전(열 없음): 경기 동기화는 그대로 되고, 바꾼 이름은 이 기기에 남고 클라우드 실패로 알린다', async function () {
    await isolated(async function (toasts) {
      await loggedIn(true, function () { srv.noLabelCols = true; srv.user_games.push(row(K2, game(K2, 2), TS + 60000)); });
      eq(ls(K2) && ls(K2).abs.length, 2, '서버에만 있던 K2 를 내려받음');
      ok(!toasts.some(function (m) { return m.indexOf('클라우드 저장 실패') >= 0; }), '시작 동기화가 실패로 알림: ' + JSON.stringify(toasts));
      window.prompt = function () { return '바꾼 이름'; };
      renameGame(K1); await settle();
      eq(label(K1), '바꾼 이름', '이 기기의 이름');
      eq(reqs('upsert').length, 0, '경기 내용을 올림');
      ok(toasts.some(function (m) { return m.indexOf('클라우드 저장 실패') >= 0; }), '이름을 못 올렸다고 알리지 않음: ' + JSON.stringify(toasts));
    });
  });
  test('(정리) 로그아웃하고 이 파일이 만든 상태를 비운다', async function () {
    srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear(); eq(srv.user, null, '로그아웃');
  });
})();
