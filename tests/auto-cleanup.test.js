// 자동저장 스냅샷(sl_auto_*) 정리 · 목록 제외 · 삭제의 클라우드 반영 검증 — 실제 js/cloud.js · js/core.js 를 가짜 서버(stub-supabase.js)에 붙여 돌린다.
// 배경: 새 경기는 AS.curGame 이 비어 타석마다 sl_auto_<시각> 행이 user_games 에 쌓였고, 시작 동기화가 그 행을 전부 목록(sl_saves)에 넣어
// 같은 경기가 수십 개로 보였다. 목록에서 지워도 user_games 는 안 지워져 다음 시작 동기화 때 되살아났다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, ls = T.ls, test = T.test, sleep = T.sleep;
  var T0 = new Date(2026, 9, 10, 14, 0, 0).getTime();
  var D = '2026. 10. 10.', D2 = '2026. 10. 11.';
  var FIXED = 'sl_cloud_auto_fixed', DEL = 'sl_cloud_del';
  var K1 = 'sl_1779002911000';                                   // 정식 저장 키
  function A(i) { return 'sl_auto_' + (T0 + i * 1000); }          // 예전 클라이언트가 타석마다 만들던 스냅샷 키

  function abs(n) { var a = []; for (var i = 0; i < n; i++) a.push({ id: 'a' + i, res: '안타', team: 'home' }); return a; }
  function game(n, extra) { return Object.assign({ th: '하하', ta: '스톤', hs: 0, as: 0, abs: abs(n), d: D, ts: T0 + n * 1000 }, extra || {}); }
  function row(key, data) { return { user_id: 'TEST-USER', game_key: key, team_name: data.th + ' vs ' + data.ta, date: data.d, data: data, updated_at: new Date(data.ts || T0).toISOString() }; }
  function saves() { return ls('sl_saves') || []; }
  function keys() { return saves().map(function (s) { return s.key; }); }
  function srvKeys() { return srv.user_games.map(function (r) { return r.game_key; }).sort(); }
  function srvProper() { return srvKeys().filter(isProper); }   // 열린 경기의 실시간 스냅샷(sl_auto_, 3초 디바운스로 뒤늦게 도착)은 제외
  function isProper(k) { return /^sl_\d{6,20}$/.test(k); }
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

  // ── 1. 한 번 정리: 같은 경기의 스냅샷은 하나만, 정식 키로 ──
  test('정리: 같은 경기 스냅샷 5개 → 타석 최다 1개만 정식 키로 남고 나머지는 서버·로컬·목록에서 지운다', async function () {
    await boot();
    reset([{ key: A(2), data: game(2) }, { key: A(3) }, { key: A(5), data: game(5), label: '내가 바꾼 이름' }]);   // A(3) 은 데이터 없는 항목(예전 내려받기 뒤 로컬 정리로 지워짐)
    srv.user_games = [1, 2, 3, 4, 5].map(function (n) { return row(A(n), game(n)); }).concat([row(A(9), game(2, { d: D2 }))]);   // 다른 날 경기 1개
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
    eq(ls(b.key).abs.length, 2, '다른 날 경기도 하나로');
    eq(b.label, '하하 vs 스톤 ' + D2, '이름이 없던 항목은 기본 이름');
    eq(lsAutoKeys(), [], '로컬 sl_auto_ 데이터는 모두 삭제');
    eq(srvKeys(), [a.key, b.key].sort(), '서버에는 변환본만');
    eq(deletedKeys(s), [A(1), A(2), A(3), A(4), A(5), A(9)].sort(), '서버 삭제 요청에 스냅샷 전부');
    eq(localStorage.getItem(FIXED), 'TEST-USER', '정리 마침 표시(계정 id)');
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

  test('정리: 스냅샷이 정식 저장보다 타석이 많으면 변환해 둘 다 남긴다(기록을 잃지 않는다)', async function () {
    await boot();
    reset([{ key: K1, data: game(2, { ts: T0 }) }]);
    srv.user_games = [row(K1, game(2, { ts: T0 })), row(A(4), game(4))];
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    var k = keys();
    eq(k.length, 2, '목록 항목 수: ' + JSON.stringify(k));
    var conv = k.filter(function (x) { return x !== K1; })[0];
    ok(conv && isProper(conv), '변환본은 정식 키: ' + conv);
    eq(ls(conv).abs.length, 4, '변환본 = 스냅샷 내용');
    eq(srvKeys(), [K1, conv].sort(), '서버: 정식 저장 + 변환본, 스냅샷은 삭제');
  });

  test('정리 뒤: 스냅샷 행은 목록에 넣지 않고 로컬에만 둔다(⏱ 임시저장 복구용) · 지우지도 않는다', async function () {
    await boot();
    reset([]); localStorage.setItem(FIXED, 'TEST-USER');
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

  test('열린 경기가 정리한 스냅샷인데 남긴 쪽이 다른 스냅샷이면: 바꾼 게 없을 때 남긴 항목(타석 더 많음)을 다시 연다', async function () {
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
  test('삭제: 목록에서 지우면 user_games 에서도 지운다 → 다음 동기화에 되살아나지 않는다', async function () {
    await boot();
    reset([{ key: K1, data: game(1, { ts: T0 }) }]); localStorage.setItem(FIXED, 'TEST-USER');
    srv.user_games = [row(K1, game(1, { ts: T0 }))];
    await runLogin();
    var c0 = window.confirm; window.confirm = function () { return true; };
    try { deleteGame(K1); await quiet(); } finally { window.confirm = c0; }
    eq(srvProper(), [], '서버에서 삭제');
    eq(ls(DEL), null, '삭제 대기 목록 비움');
    var s = await runLogin();
    ok(!s.timedOut, '동기화가 끝나지 않음');
    eq(keys(), [], '다시 동기화해도 되살아나지 않음');
  });

  test('삭제: 오프라인이면 대기 목록에 남겼다가 온라인이 되면 지운다 · 그 사이 내려받지 않는다', async function () {
    await boot();
    reset([{ key: K1, data: game(1, { ts: T0 }) }]); localStorage.setItem(FIXED, 'TEST-USER');
    srv.user_games = [row(K1, game(1, { ts: T0 }))];
    await runLogin();
    var c0 = window.confirm; window.confirm = function () { return true; };
    try {
      window.dispatchEvent(new Event('offline'));
      deleteGame(K1); await sleep(300);
      ok((ls(DEL) || {})[K1], '오프라인 삭제 → 대기 목록에 기록');
      eq(srvProper(), [K1], '오프라인이라 서버는 아직 그대로');
      window.dispatchEvent(new Event('online'));
      var s = await quiet();
      ok(!s.timedOut, '동기화가 끝나지 않음');
    } finally { window.confirm = c0; }
    eq(srvProper(), [], '온라인 복귀 뒤 서버에서 삭제');
    eq(ls(DEL), null, '대기 목록 비움');
    eq(keys(), [], '지운 경기가 되살아나지 않음');
  });

  // ── 4. 재발 방지: 경기마다 자동 동기화 키 하나 ──
  test('새 경기: 타석을 여러 번 기록해도 자동 동기화 행은 sl_auto_<AS.curGame> 하나', async function () {
    await boot();
    reset([]); localStorage.setItem(FIXED, 'TEST-USER');
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
})();
