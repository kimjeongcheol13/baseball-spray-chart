// 같은 경기 판단 규칙은 하나 — 로그인 때 중복 정리(cloud.js)도 저장 경기 읽기(js/features/games.js groupGames)와 같은 함수로 묶는다.
//  · 정리가 지우는 항목은 불러오기 목록이 "같은 경기"로 묶은 항목들 안에서만 나온다 (그 안에서 다른 사본의 부분집합인 것)
//  · 목록이 다른 경기로 보는 것(더블헤더 · 같은 시각 id 를 쓴 다른 타자 · 서로 다른 공유 링크 경기)은 하나도 지우지 않는다
//  · 같은 경기 판단 함수를 아직 못 읽었으면 이번에는 정리하지 않는다 (마침 표시도 남기지 않아 다음 시작 때 다시 센다)
// 파일 이름순으로 맨 뒤 쪽에서 돈다 (앞선 테스트의 로그인 상태를 먼저 비운다).
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;
  var B0 = 1781000000000;
  function abs(ids, names) { return ids.map(function (id, i) { return { id: id, bid: null, bname: names[i % names.length], bnum: (i % 9) + 1, res: '안타', inn: '1회초', team: 'home', x: 0.4, y: 0.4 }; }); }
  function range(a, n, step) { var r = []; for (var i = 0; i < n; i++) r.push(a + i * (step || 1)); return r; }
  function g(th, ta, list, ts) { return { th: th, ta: ta, hs: 1, as: 0, d: '2026. 9. 2.', ts: ts || B0, abs: list, pitchers: [], home_lineup: [], away_lineup: [] }; }
  // 자동저장 사본(sl_auto_*)은 실제처럼 서버(user_games)에만 둔다 — 목록에 넣지 않고, 실시간 동기화가 올린 행이다
  function seed(list) {
    localStorage.clear();
    srv.user_games = list.filter(function (x) { return x.key.indexOf('sl_auto_') === 0; }).map(function (x) {
      return { user_id: 'TEST-USER', game_key: x.key, team_name: x.data.th + ' vs ' + x.data.ta, date: x.data.d, data: x.data, updated_at: new Date(B0).toISOString() };
    });
    list.forEach(function (x) { if (x.key.indexOf('sl_auto_') !== 0) localStorage.setItem(x.key, JSON.stringify(x.data)); });
    localStorage.setItem('sl_saves', JSON.stringify(list.filter(function (x) { return x.key.indexOf('sl_auto_') !== 0; }).map(function (x, i) { return { key: x.key, label: x.data.th + ' vs ' + x.data.ta, ts: i + 1 }; })));
  }
  function loginAndSettle() {
    return new Promise(function (resolve) {
      srv.signIn();
      var n = 0, last = -1, quiet = 0;
      (function poll() { var len = srv.log.length; if (len > 0 && len === last) quiet++; else { quiet = 0; last = len; } if (quiet >= 100 || ++n > 800) resolve(); else setTimeout(poll, 10); })();
    });
  }
  var booted = null;
  async function start() { if (!booted) booted = sleep(2000); await booted; srv.signOut(); await sleep(1000); srv.reset(); }
  var present = function (k) { return localStorage.getItem(k) != null || srv.user_games.some(function (r) { return r.game_key === k; }); };   // 이 기기 또는 서버

  test('정리가 지우는 항목은 불러오기 목록이 같은 경기로 묶은 것 안에서만 — 다른 경기는 하나도 지우지 않는다', async function () {
    await start();
    var A = abs(range(B0, 8, 60000), ['가', '나', '다']);                       // 경기 A (실제 시각 id)
    var DH = abs(range(B0 + 5e6, 6, 60000), ['가', '나', '다']);                // 같은 팀 · 같은 날 두 번째 경기(더블헤더)
    var X1 = abs(range(B0 + 9e6, 5), ['라', '마']), X2 = abs(range(B0 + 9e6, 4), ['바', '사']);   // 엑셀 가져오기: 같은 시각 id · 다른 타자
    var S1 = abs(range(0, 10), ['아', '자']), S2 = abs(range(0, 7), ['차', '카']);                  // 서로 다른 공유 링크 경기 (id 0..n)
    var list = [
      { key: 'sl_' + (B0 + 1), data: g('홈', '원정', A) },
      { key: 'sl_auto_' + (B0 + 2), data: g('홈', '원정', A.slice(0, 5)) },      // A 의 사본 (부분집합) → 지워져야 함
      { key: 'sl_' + (B0 + 3), data: g('홈', '원정', DH) },
      { key: 'sl_' + (B0 + 4), data: g('엑셀', '팀', X1) }, { key: 'sl_' + (B0 + 5), data: g('엑셀', '팀', X2) },
      { key: 'sl_shared_1', data: g('공유', '하나', S1) }, { key: 'sl_shared_2', data: g('공유', '둘', S2) },
    ];
    seed(list);
    // 로그인 전, 목록(저장 경기 읽기)이 보는 경기 묶음
    var groups = SLGames.groupGames(list.map(function (x) { return { key: x.key, g: x.data, ms: 0 }; }));
    var groupOf = {}; groups.forEach(function (gr, i) { gr.members.forEach(function (m) { groupOf[m.key] = i; }); });
    eq(groups.length, 6, '목록 기준 경기 수 (A 와 사본 = 1, 나머지 각자)');
    await loginAndSettle();
    var gone = list.map(function (x) { return x.key; }).filter(function (k) { return !present(k); });
    eq(gone, ['sl_auto_' + (B0 + 2)], '지워진 것 = A 의 사본 하나');
    gone.forEach(function (k) { ok(groups[groupOf[k]].members.length > 1, k + ' 는 목록 기준으로 혼자인 경기였다'); });
    ['sl_' + (B0 + 3), 'sl_' + (B0 + 4), 'sl_' + (B0 + 5), 'sl_shared_1', 'sl_shared_2'].forEach(function (k) { ok(present(k), k + ' 가 지워짐'); });
  });
  test('같은 경기 판단 함수를 아직 못 읽었으면 정리하지 않고 마침 표시도 남기지 않는다 → 다음 로그인 때 정리', async function () {
    await start();
    var A = abs(range(B0 + 2e7, 6, 60000), ['가', '나']);
    seed([{ key: 'sl_' + (B0 + 2e7), data: g('홈', '원정', A) }, { key: 'sl_auto_' + (B0 + 2e7 + 1), data: g('홈', '원정', A.slice(0, 3)) }]);
    var fn = SLGames.groupGames; SLGames.groupGames = undefined;
    try { await loginAndSettle(); } finally { SLGames.groupGames = fn; }
    ok(present('sl_auto_' + (B0 + 2e7 + 1)), '정리하지 않음'); eq(localStorage.getItem('sl_cloud_auto_fixed'), null, '마침 표시 없음');
    srv.signOut(); await sleep(1000); await loginAndSettle();
    ok(!present('sl_auto_' + (B0 + 2e7 + 1)), '다음 로그인 때 정리'); ok(/TEST-USER/.test(localStorage.getItem('sl_cloud_auto_fixed') || ''), '마침 표시');
  });
  test('(정리) 로그아웃하고 이 파일이 만든 상태를 비운다', async function () { srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear(); eq(srv.user, null, '로그아웃'); });
})();
