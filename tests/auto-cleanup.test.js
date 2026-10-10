// 같은 경기 중복(자동저장 스냅샷 sl_auto_* · 정식 저장) 정리 · 스냅샷 목록 제외 · 삭제의 클라우드 반영 검증 — 실제 js/cloud.js · js/core.js 를 가짜 서버(stub-supabase.js)에 붙여 돌린다.
// 배경: 새 경기는 AS.curGame 이 비어 타석마다 sl_auto_<시각> 행이 user_games 에 쌓였고(d 는 올린 날짜), 시작 동기화가 그 행을 전부 목록(sl_saves)에 넣어
// 같은 경기가 수십 개로 보였다. 목록에서 지워도 user_games 는 안 지워져 다음 시작 동기화 때 되살아났다. 같은 경기인지는 타석 id 가 겹치는지로 가린다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, ls = T.ls, test = T.test, sleep = T.sleep;
  var T0 = new Date(2026, 9, 10, 14, 0, 0).getTime();
  var D = '2026. 10. 10.', D2 = '2026. 10. 11.';
  var FIXED = 'sl_cloud_auto_fixed', DONE = 'TEST-USER:3', DEL = 'sl_cloud_del';
  var K1 = 'sl_1779002911000', K2 = 'sl_1779002911001';          // 정식 저장 키
  function A(i) { return 'sl_auto_' + (T0 + i * 1000); }          // 예전 클라이언트가 타석마다 만들던 스냅샷 키

  // 타석 id = 실제 앱처럼 기록 시각(Date.now()) 숫자. 같은 접두사 = 같은 경기 (정리는 1e11 이상인 실제 기록 id 만 같은 경기 판단에 쓴다)
  function idOf(p, i) { return 1780900000000 + (String(p).charCodeAt(0) - 97) * 100000 + i; }
  function abs(n, p) { var a = []; for (var i = 0; i < n; i++) a.push({ id: idOf(p || 'a', i), res: '안타', team: 'home' }); return a; }   // 같은 접두사 = 같은 경기의 타석
  function game(n, extra) { return Object.assign({ th: '하하', ta: '스톤', hs: 0, as: 0, abs: abs(n), d: D, ts: T0 + n * 1000 }, extra || {}); }
  function row(key, data) { return { user_id: 'TEST-USER', game_key: key, team_name: data.th + ' vs ' + data.ta, date: data.d, data: data, updated_at: new Date(data.ts || T0).toISOString() }; }
  function saves() { return ls('sl_saves') || []; }
  function keys() { return saves().map(function (s) { return s.key; }).sort(); }
  function srvKeys() { return srv.user_games.map(function (r) { return r.game_key; }).sort(); }
  function isProper(k) { return /^sl_\d{6,20}$/.test(k); }
  function srvProper() { return srvKeys().filter(function (k) { return !/^sl_auto_/.test(k); }); }   // 열린 경기의 실시간 스냅샷(sl_auto_, 3초 디바운스로 뒤늦게 도착)은 제외
  function lsAutoKeys() { var o = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('sl_auto_') === 0) o.push(k); } return o.sort(); }
  function deletedKeys(s) {   // delete 요청들이 지운 game_key 합집합
    var o = {}; s.log.forEach(function (x) { if (x.table === 'user_games' && x.op === 'delete') (x.fi.game_key || []).forEach(function (k) { o[k] = true; }); }); return Object.keys(o).sort();
  }
  // 로컬 상태 만들기: list = [{ key, data?, label? }] → sl_saves(+데이터). 서버·정리 표시는 비운다
  function reset(list) {
    srv.reset(); localStorage.clear();
    var sv = [];
    (list || []).forEach(function (g) { if (g.data) localStorage.setItem(g.key, JSON.stringify(g.data)); sv.push({ key: g.key, label: g.label || g.key, ts: (g.data && g.data.ts) || 0 }); });
    localStorage.setItem('sl_saves', JSON.stringify(sv));
  }
  var booted = null;
  function boot() { return booted || (booted = sleep(2000)); }   // 앱 시작 동기화(DOMContentLoaded 1.5초 뒤) 가 끝난 뒤 시작
  // 서버 요청이 1초 동안 더 없을 때까지 기다린다
  function quiet() {
    return new Promise(function (resolve) {
      var n = 0, last = -1, q = 0;
      (function poll() {
        var len = srv.log.length;
        if (len > 0 && len === last) q++; else { q = 0; last = len; }
        if (q >= 100 || ++n > 800) resolve({ log: srv.log.slice(), timedOut: n > 800 }); else setTimeout(poll, 10);
      })();
    });
  }
  function runLogin() { srv.signIn(); return quiet(); }

  // ── 1. 한 번 정리: 같은 경기는 하나만 ──
  test('정리: 같은 경기 스냅샷 5개 → 타석 최다 1개만 정식 키로 남고 나머지는 서버·로컬·목록에서 지운다', async function () {
    await boot();
    reset([{ key: A(2), data: game(2) }, { key: A(3) }, { key: A(5), data: game(5), label: '내가 바꾼 이름' }]);   // A(3) 은 데이터 없는 항목(예전 내려받기 뒤 로컬 정리로 지워짐)
    srv.user_games = [1, 2, 3, 4, 5].map(function (n) { return row(A(n), game(n)); }).concat([row(A(9), game(2, { d: D2, abs: abs(2, 'b') }))]);   // 다른 경기(타석 id 다름) 1개
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    var k = keys();
    eq(k.length, 2, '목록 항목 수(경기당 1개): ' + JSON.stringify(k));
    ok(k.every(isProper), '남긴 항목은 정식 키여야 함: ' + JSON.stringify(k));
    var a = saves().filter(function (e) { return ls(e.key).d === D; })[0], b = saves().filter(function (e) { return ls(e.key).d === D2; })[0];
    ok(a && b, '두 경기 모두 남아야 함');
    eq(ls(a.key).abs.length, 5, '남긴 스냅샷 = 타석 최다');
    eq(a.label, '내가 바꾼 이름', '남긴 항목의 이름은 그대로');
    eq(ls(a.key).key, a.key, '데이터의 key 도 새 키');
    eq(ls(b.key).abs.length, 2, '다른 경기도 하나로');
    eq(b.label, '하하 vs 스톤 ' + D2, '이름이 없던 항목은 기본 이름');
    eq(lsAutoKeys(), [], '로컬 sl_auto_ 데이터는 모두 삭제');
    eq(srvKeys(), [a.key, b.key].sort(), '서버에는 변환본만');
    eq(deletedKeys(s), [A(1), A(2), A(3), A(4), A(5), A(9)].sort(), '서버 삭제 요청에 스냅샷 전부');
    eq(localStorage.getItem(FIXED), DONE, '정리 마침 표시(계정 id + 판)');
  });

  test('정리: 정식 저장이 그만큼 이상의 타석을 가지면 스냅샷은 전부 지우고 변환하지 않는다', async function () {
    await boot();
    reset([{ key: K1, data: game(5, { ts: T0 }) }]);
    srv.user_games = [row(K1, game(5, { ts: T0 })), row(A(3), game(3)), row(A(5), game(5))];
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    eq(keys(), [K1], '목록은 정식 저장만');
    eq(srvKeys(), [K1], '서버도 정식 저장만');
    eq(deletedKeys(s), [A(3), A(5)], '스냅샷 2개 삭제');
    eq(ls(K1).abs.length, 5, '정식 저장은 그대로');
  });

  test('정리: 스냅샷이 정식 저장을 포함하고 타석이 더 많으면 변환본만 남긴다(정식 저장은 부분집합이라 삭제 · 이름은 이어받음)', async function () {
    await boot();
    reset([{ key: K1, data: game(2, { ts: T0 }), label: '원래 이름' }]);
    srv.user_games = [row(K1, game(2, { ts: T0 })), row(A(4), game(4))];
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    var k = keys();
    eq(k.length, 1, '목록 항목 수: ' + JSON.stringify(k));
    ok(k[0] !== K1 && isProper(k[0]), '변환본은 새 정식 키: ' + k[0]);
    eq(ls(k[0]).abs.length, 4, '변환본 = 스냅샷 내용');
    eq(saves()[0].label, '원래 이름', '지운 정식 저장의 이름을 이어받음');
    eq(srvKeys(), [k[0]], '서버: 변환본만');
    eq(deletedKeys(s), [K1, A(4)].sort(), '정식 저장(부분집합)과 스냅샷 삭제');
  });

  test('정리: 날짜만 다른 같은 경기(정식 저장·복구·스냅샷 섞임)는 먼저 만든 정식 저장 하나로 합친다', async function () {
    await boot();
    var orig = 'sl_1779530694260', rec = 'sl_rec_1791140441318', c1 = 'sl_1791277863849', c2 = 'sl_1791472322221';   // 실제 사례와 같은 모양
    var same = function (d, ts) { return game(6, { d: d, ts: ts }); };
    reset([{ key: orig, data: same('2026. 5. 23.', T0 + 900000), label: '진짜 경기' }, { key: rec, data: same('2026. 10. 5.', T0 + 1) }, { key: c1, data: same('2026. 10. 6.', T0 + 2) }, { key: c2, data: same('2026. 10. 8.', T0 + 3) }]);
    srv.user_games = [row(orig, same('2026. 5. 23.', T0 + 900000)), row(rec, same('2026. 10. 5.', T0 + 1)), row(c1, same('2026. 10. 6.', T0 + 2)), row(c2, same('2026. 10. 8.', T0 + 3)),
      row(A(7), same(D2, T0 + 7000)), row(A(8), same(D2, T0 + 8000))];
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    eq(keys(), [orig], '목록 = 먼저 만든 정식 저장 하나(ts 가 바뀌어도 키 에폭이 가장 이름)');
    eq(saves()[0].label, '진짜 경기', '이름 그대로');
    eq(srvProper(), [orig], '서버도 하나');
    eq(deletedKeys(s), [rec, c1, c2, A(7), A(8)].sort(), '나머지 전부 삭제');
  });

  test('정리: 타석 id 가 겹치지 않으면 팀·날짜가 같아도 합치지 않는다', async function () {
    await boot();
    reset([{ key: K1, data: game(3, { ts: T0 }) }, { key: K2, data: game(3, { ts: T0 + 1, abs: abs(3, 'b') }) }]);
    srv.user_games = [row(K1, game(3, { ts: T0 })), row(K2, game(3, { ts: T0 + 1, abs: abs(3, 'b') }))];
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    eq(keys(), [K1, K2].sort(), '둘 다 남음');
    eq(deletedKeys(s), [], '삭제 없음');
  });

  test('정리: 갈라진 기록(서로 부분집합이 아님)은 둘 다 남긴다', async function () {
    await boot();
    var forked = game(5, { ts: T0 + 1, abs: abs(4).concat([{ id: idOf('c', 9), res: '안타', team: 'home' }]) });   // a0..a3 + c9
    reset([{ key: K1, data: game(5, { ts: T0 }) }, { key: K2, data: forked }]);
    srv.user_games = [row(K1, game(5, { ts: T0 })), row(K2, forked)];
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    eq(keys(), [K1, K2].sort(), '둘 다 남음');
    eq(deletedKeys(s), [], '삭제 없음');
  });

  test('정리: 갈래(같은 타석 5개 + 다른 1개)가 묶음에 있어도 똑같은 행들은 하나로 합치고 갈래는 남긴다 (실제 사례)', async function () {
    await boot();
    var five = abs(5);
    var fork = { th: '홈팀', ta: '원정팀', hs: 0, as: 0, d: '2026. 5. 22.', ts: T0 - 100, abs: five.concat([{ id: idOf('x', 1), res: '안타', team: 'home' }]) };   // 먼저 만든 갈래
    var haha = function (d, ts) { return game(6, { d: d, ts: ts, abs: five.concat([{ id: idOf('y', 1), res: '안타', team: 'home' }]) }); };          // 같은 경기(갈래와 5개 공유)
    var FK = 'sl_1779445138008', H1 = 'sl_1779530694260', H2 = 'sl_1790934977265', HR = 'sl_rec_1791140441318';
    reset([{ key: FK, data: fork }, { key: H1, data: haha('2026. 5. 23.', T0) }, { key: H2, data: haha('2026. 10. 2.', T0 + 2) }, { key: HR, data: haha('2026. 10. 5.', T0 + 3) }]);
    srv.user_games = [row(FK, fork), row(H1, haha('2026. 5. 23.', T0)), row(H2, haha('2026. 10. 2.', T0 + 2)), row(HR, haha('2026. 10. 5.', T0 + 3)), row(A(7), haha(D2, T0 + 7000)), row(A(8), haha(D2, T0 + 8000))];
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    eq(keys(), [FK, H1].sort(), '갈래 1개 + 같은 경기 1개(먼저 만든 정식 저장)');
    eq(srvProper(), [FK, H1].sort(), '서버도 둘');
    eq(deletedKeys(s), [H2, HR, A(7), A(8)].sort(), '똑같은 행들만 삭제');
  });

  test('정리: 1차(v1) 마침 표시가 있는 기기에서도 2차는 한 번 돈다', async function () {
    await boot();
    reset([{ key: K1, data: game(4, { ts: T0 }) }, { key: K2, data: game(4, { ts: T0 + 1, d: D2 }) }]); localStorage.setItem(FIXED, 'TEST-USER');
    srv.user_games = [row(K1, game(4, { ts: T0 })), row(K2, game(4, { ts: T0 + 1, d: D2 }))];
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    eq(keys(), [K1], '같은 경기(타석 id 같음)는 하나로');
    eq(deletedKeys(s), [K2], '나중 것 삭제');
    eq(localStorage.getItem(FIXED), DONE, '2차 마침 표시');
  });

  test('정리 뒤: 스냅샷 행은 목록에 넣지 않고 로컬에만 둔다(⏱ 임시저장 복구용) · 지우지도 않는다', async function () {
    await boot();
    reset([]); localStorage.setItem(FIXED, DONE);
    srv.user_games = [row(K1, game(1, { ts: T0 })), row('sl_auto_777', game(3))];
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    eq(keys(), [K1], '목록에는 정식 저장만');
    eq(ls('sl_auto_777').abs.length, 3, '스냅샷은 로컬에 저장(복구용)');
    eq(deletedKeys(s), [], '삭제 요청 없음');
    eq(srvKeys(), [K1, 'sl_auto_777'], '서버 불변');
  });

  // ── 2. 열려 있는 경기와의 연결 ──
  test('열린 경기가 정리한 스냅샷이면 저장 대상(_curSaveKey)이 변환본으로 이어진다', async function () {
    await boot();
    reset([{ key: A(4), data: game(4) }, { key: A(5), data: game(5) }]);
    srv.user_games = [1, 2, 3, 4, 5].map(function (n) { return row(A(n), game(n)); });
    restoreGame(A(5));
    eq(window._curSaveKey, A(5), '열린 경기 = 스냅샷');
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    var cur = window._curSaveKey;
    ok(cur && isProper(cur), '저장 대상이 변환본이어야 함: ' + cur);
    eq(keys(), [cur], '목록 = 변환본 하나');
    eq(ls(cur).abs.length, 5, '변환본 내용');
    eq(AS.abs.length, 5, '화면의 경기는 그대로');
  });

  test('열린 경기가 정리한 항목인데 남긴 쪽이 다른 항목이면: 바꾼 게 없을 때 남긴 항목(내용 더 많음)을 다시 연다', async function () {
    await boot();
    reset([{ key: A(3), data: game(3) }, { key: A(5), data: game(5) }]);
    srv.user_games = [3, 5].map(function (n) { return row(A(n), game(n)); });
    restoreGame(A(3));
    eq(AS.abs.length, 3, '열린 경기 = 타석 3');
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    var cur = window._curSaveKey;
    ok(cur && isProper(cur), '저장 대상이 변환본이어야 함: ' + cur);
    eq(AS.abs.length, 5, '남긴 항목으로 다시 열림');
    eq(keys(), [cur], '목록 = 변환본 하나');
  });

  // ── 3. 삭제가 클라우드에도 반영 ──
  var K1A = 'sl_auto_' + K1.slice(3);   // K1 을 열어 둔 동안 cloudAutoSyncRecord 가 올린 실시간 스냅샷 행(restoreGame: AS.curGame = 키 뒷부분)
  test('삭제: 목록에서 지우면 user_games 에서도 지운다(열어 둔 동안 쌓인 스냅샷 행 sl_auto_<뒷부분>까지) → 다음 동기화에 되살아나지 않는다', async function () {
    await boot();
    reset([{ key: K1, data: game(1, { ts: T0 }) }]); localStorage.setItem(FIXED, DONE);
    localStorage.setItem(K1A, JSON.stringify(game(1, { ts: T0 })));
    srv.user_games = [row(K1, game(1, { ts: T0 })), row(K1A, game(1, { ts: T0 }))];
    await runLogin();
    var c0 = window.confirm; window.confirm = function () { return true; };
    try { deleteGame(K1); await quiet(); } finally { window.confirm = c0; }
    eq(srvProper(), [], '서버에서 삭제');
    ok(srvKeys().indexOf(K1A) < 0, '서버의 스냅샷 행(sl_auto_<뒷부분>)도 삭제: ' + JSON.stringify(srvKeys()));
    eq(ls(K1A), null, '로컬 스냅샷도 삭제');
    eq(ls(DEL), null, '삭제 대기 목록 비움');
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    eq(keys(), [], '다시 동기화해도 되살아나지 않음');
  });

  test('삭제: 오프라인이면 대기 목록에 남겼다가 온라인이 되면 지운다 · 그 사이 내려받지 않는다', async function () {
    await boot();
    reset([{ key: K1, data: game(1, { ts: T0 }) }]); localStorage.setItem(FIXED, DONE);
    srv.user_games = [row(K1, game(1, { ts: T0 })), row(K1A, game(1, { ts: T0 }))];
    await runLogin();
    var c0 = window.confirm; window.confirm = function () { return true; };
    try {
      window.dispatchEvent(new Event('offline'));
      deleteGame(K1); await sleep(300);
      ok((ls(DEL) || {})[K1], '오프라인 삭제 → 대기 목록에 기록');
      ok((ls(DEL) || {})[K1A], '스냅샷 키도 대기 목록에 기록');
      eq(srvProper(), [K1], '오프라인이라 서버는 아직 그대로');
      ok(srvKeys().indexOf(K1A) >= 0, '스냅샷 행도 아직 그대로');
    } finally { window.confirm = c0; window.dispatchEvent(new Event('online')); }   // 단언이 실패해도 온라인으로 되돌린다 — 안 그러면 뒤의 테스트가 전부 오프라인으로 깨진다
    var s = await quiet();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    eq(srvProper(), [], '온라인 복귀 뒤 서버에서 삭제');
    ok(srvKeys().indexOf(K1A) < 0, '온라인 복귀 뒤 스냅샷 행도 삭제: ' + JSON.stringify(srvKeys()));
    eq(ls(DEL), null, '대기 목록 비움');
    eq(keys(), [], '지운 경기가 되살아나지 않음');
  });

  // ── 4. 재발 방지: 경기마다 자동 동기화 키 하나 ──
  test('새 경기: 타석을 여러 번 기록해도 자동 동기화 행은 sl_auto_<AS.curGame> 하나', async function () {
    await boot();
    reset([]); localStorage.setItem(FIXED, DONE);
    await runLogin();
    var abs0 = AS.abs, cur0 = AS.curGame;
    try {
      AS.curGame = null; AS.abs = [{ id: 'x1' }];
      cloudAutoSyncRecord(); await sleep(3500);
      AS.abs = [{ id: 'x1' }, { id: 'x2' }];
      cloudAutoSyncRecord(); await sleep(3500);
      var rows = srv.user_games.filter(function (r) { return /^sl_auto_/.test(r.game_key); });
      eq(rows.length, 1, '자동 동기화 행 수');
      eq(rows[0].game_key, 'sl_auto_' + AS.curGame, '키 = sl_auto_<curGame>');
      eq(rows[0].data.abs.length, 2, '마지막 상태');
    } finally { AS.abs = abs0; AS.curGame = cur0; }
  });

  test('새 경기: 로컬 자동저장(_doAutoSave)도 키 하나를 계속 쓴다', async function () {
    await boot();
    var abs0 = AS.abs, cur0 = AS.curGame;
    try {
      AS.curGame = null; AS.abs = [{ id: 'y1' }];
      _doAutoSave(); var k1 = window._autoKey;
      ok(/^sl_auto_\d+$/.test(k1), '첫 자동저장 키: ' + k1);
      AS.abs = [{ id: 'y1' }, { id: 'y2' }];
      _doAutoSave();
      eq(window._autoKey, k1, '두 번째 자동저장도 같은 키');
      eq(ls(k1).abs.length, 2, '같은 키에 마지막 상태');
    } finally { AS.abs = abs0; AS.curGame = cur0; }
  });

  test('불러온 경기의 자동저장 키는 저장 키 기준(d.ts 가 바뀌어도 그대로)', async function () {
    await boot();
    reset([{ key: K1, data: game(2, { ts: T0 }) }]);
    restoreGame(K1);
    eq(AS.curGame, '1779002911000', '키 = 저장 키의 뒷부분');
    var d = ls(K1); d.ts = T0 + 999; localStorage.setItem(K1, JSON.stringify(d));   // 복구(_archQuietSave)가 ts 를 바꾼 상황
    restoreGame(K1);
    eq(AS.curGame, '1779002911000', '다시 열어도 같은 키');
    await sleep(3500);   // restoreGame → updateAll 이 예약한 자동 동기화(3초 디바운스)가 다음 테스트로 새지 않게 여기서 끝낸다
  });
})();
