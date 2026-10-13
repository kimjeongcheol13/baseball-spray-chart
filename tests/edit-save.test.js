// 타석 기록 수정(saveEditRec → _saveEditImmediate)이 지금 열린 경기의 저장 항목에만 반영되는지 — 실제 core.js · cloud.js 를 가짜 서버에 붙여 돌린다.
// 배경: 예전 _saveEditImmediate 는 저장 목록(sl_saves)의 "마지막 항목"을 덮어써서, 다른 경기를 열어 한 타석만 고쳐도
//       마지막 경기가 이 경기 기록으로 바뀌었고 그대로 user_games 에도 올라갔다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var KA = 'sl_1781000000001', KB = 'sl_1781000000002', TA = 1781000000001, TB = 1781000000002;
  function ab(id, name, res) { return { id: id, bid: 'p' + id, bname: name, bnum: 7, res: res, inn: '1회초', team: 'home', rbi: 0, x: 0.5, y: 0.4, deg: 90 }; }
  function gameA() { return { key: KA, th: '에이팀', ta: '상대A', hs: 1, as: 0, d: '2026. 5. 1.', ts: TA, abs: [ab(1781000000101, '에이타자', '안타')], home_lineup: [], away_lineup: [], pitchers: [], zoneHistory: {} }; }
  function gameB() { return { key: KB, th: '비팀', ta: '상대B', hs: 3, as: 2, d: '2026. 6. 1.', ts: TB, abs: [ab(1781000000201, '비타자', '홈런'), ab(1781000000202, '비타자2', '삼진')], home_lineup: [], away_lineup: [], pitchers: [], zoneHistory: {} }; }
  // 저장 목록: A(오래된 경기) 다음에 B(마지막 항목)
  function seed() {
    localStorage.setItem(KA, JSON.stringify(gameA()));
    localStorage.setItem(KB, JSON.stringify(gameB()));
    localStorage.setItem('sl_saves', JSON.stringify([{ key: KA, label: '에이팀 vs 상대A 1:0', ts: TA }, { key: KB, label: '비팀 vs 상대B 3:2', ts: TB }]));
    localStorage.setItem('sl_cloud_mod', '{}');
  }
  // 시나리오가 건드리는 앱 전역 상태를 되돌릴 함수
  function keepApp() {
    var a = window.AS, s = { abs: a.abs, hs: a.hs, as: a.as, hl: a.home_lineup, al: a.away_lineup, p: a.pitchers, z: a.zoneHistory, cur: a.curGame, info: a.info,
      sk: window._curSaveKey, gs: window._gameSaved, th: $('tHome').value, ta: $('tAway').value };
    return function () {
      a.abs = s.abs; a.hs = s.hs; a.as = s.as; a.home_lineup = s.hl; a.away_lineup = s.al; a.pitchers = s.p; a.zoneHistory = s.z; a.curGame = s.cur; a.info = s.info;
      window._curSaveKey = s.sk; window._gameSaved = s.gs; $('tHome').value = s.th; $('tAway').value = s.ta;
      try { closeOverlay('editRecOverlay'); } catch (e) {}
      try { closeGameSummary(); } catch (e) {}
    };
  }
  function edit(id, res) { openEditRec(id); $('editRes').value = res; saveEditRec(); }   // 앱의 "타석 기록 수정" 창에서 결과를 바꾸고 저장
  function upsertKeys() {
    var out = [];
    srv.log.forEach(function (x) { if (x.table === 'user_games' && x.op === 'upsert') (x.rows || []).forEach(function (r) { if (out.indexOf(r.game_key) < 0) out.push(r.game_key); }); });
    return out;
  }
  var booted = null;
  async function fresh(loggedIn) {   // 앱 시작 작업(마지막 경기 열기 등)이 끝난 뒤, 로그아웃 · 서버 · 저장소를 비우고 시작
    if (!booted) booted = sleep(2500); await booted;
    srv.signOut(); await sleep(500); srv.reset(); localStorage.clear();
    if (loggedIn) { srv.signIn(); await sleep(1500); }
    srv.log.length = 0;
  }

  test('오래된 경기를 열어 타석을 고치면 그 경기에만 반영되고, 목록의 마지막 경기는 그대로다', async function () {
    var restore = keepApp();
    try {
      await fresh(false); seed();
      var beforeB = localStorage.getItem(KB), beforeList = localStorage.getItem('sl_saves');
      restoreGame(KA);
      edit(1781000000101, '2루타'); await sleep(500);
      eq(localStorage.getItem(KB), beforeB, '마지막 경기(B)의 저장 데이터가 바뀜');
      var a = JSON.parse(localStorage.getItem(KA));
      eq(a.abs.map(function (x) { return x.res; }), ['2루타'], '열린 경기(A)에 수정이 들어가야 함');
      eq(a.ts, TA, '열린 경기(A)의 경기 날짜(ts)는 그대로');
      eq(localStorage.getItem('sl_saves'), beforeList, '저장 목록(순서 · 날짜 · 이름)은 그대로');
      ok(/수정 완료/.test($('toastTxt').textContent), '안내 문구: ' + $('toastTxt').textContent);
    } finally { restore(); }
  });

  test('로그인 상태면 고친 경기(A)만 user_games 에 올라가고, 마지막 경기(B)는 올라가지 않는다', async function () {
    var restore = keepApp();
    try {
      await fresh(true); seed();
      restoreGame(KA); await sleep(3500); srv.log.length = 0;   // 여는 동안 생긴 업로드(실시간 스냅샷 등)는 빼고 본다
      edit(1781000000101, '3루타'); await sleep(4000);            // user_games 업로드 디바운스 3초
      var keys = upsertKeys();
      ok(keys.indexOf(KA) >= 0, '고친 경기(A)가 올라가지 않음: ' + JSON.stringify(keys));
      ok(keys.indexOf(KB) < 0, '고치지 않은 마지막 경기(B)가 올라감: ' + JSON.stringify(keys));
      var row = srv.user_games.filter(function (r) { return r.game_key === KA; })[0];
      eq(row && row.data.abs.map(function (x) { return x.res; }), ['3루타'], '서버의 A');
    } finally { restore(); }
  });

  test('저장 항목이 없는 경기(새 경기)에서 고치면 새 항목으로 저장되고, 기존 경기는 건드리지 않는다', async function () {
    var restore = keepApp();
    try {
      await fresh(false); seed();
      var beforeA = localStorage.getItem(KA), beforeB = localStorage.getItem(KB);
      AS.abs = [ab(1781000000301, '새타자', '안타')]; AS.hs = 0; AS.as = 0; AS.pitchers = []; AS.home_lineup = []; AS.away_lineup = [];
      window._curSaveKey = null; $('tHome').value = '새팀'; $('tAway').value = '새상대';
      edit(1781000000301, '홈런'); await sleep(1000);              // saveGame 디바운스 0.3초
      eq(localStorage.getItem(KA), beforeA, '기존 경기 A 가 바뀜');
      eq(localStorage.getItem(KB), beforeB, '기존 경기 B 가 바뀜');
      var list = JSON.parse(localStorage.getItem('sl_saves'));
      eq(list.length, 3, '저장 목록에 새 항목 하나가 늘어야 함');
      var added = list.filter(function (e) { return e.key !== KA && e.key !== KB; })[0];
      eq(added && JSON.parse(localStorage.getItem(added.key)).abs.map(function (x) { return x.res; }), ['홈런'], '새 항목의 기록');
      eq(window._curSaveKey, added && added.key, '이후 수정은 새 항목에 들어가도록 저장 대상이 바뀜');
    } finally { restore(); }
  });

  test('저장 항목이 지워진 경기에서 고쳐도 마지막 경기를 덮지 않는다', async function () {
    var restore = keepApp();
    try {
      await fresh(false); seed();
      restoreGame(KA);
      localStorage.removeItem(KA); localStorage.setItem('sl_saves', JSON.stringify([{ key: KB, label: '비팀 vs 상대B 3:2', ts: TB }]));   // 다른 탭 · 정리로 A 항목이 사라짐
      var beforeB = localStorage.getItem(KB);
      edit(1781000000101, '볼넷'); await sleep(1000);
      eq(localStorage.getItem(KB), beforeB, '마지막 경기(B)의 저장 데이터가 바뀜');
      ok(JSON.parse(localStorage.getItem('sl_saves')).some(function (e) { return e.key !== KB; }), '고친 경기가 새 항목으로 저장되지 않음');
    } finally { restore(); }
  });
})();
