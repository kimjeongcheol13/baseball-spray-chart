// "경기 저장" 흐름이 로그인 상태에서 user_games 에도 바로 올라가는지 + cloud.js 와 다른 스크립트의 전역 이름 충돌 검사.
// 배경: core.js 의 전역 cloudSave(팀 코드/games 용)가 defer 로 나중에 실행되며 cloud.js 의 window.cloudSave(user_games 용)를 덮어써서,
//       저장 버튼은 user_games 로 올리지 않았다(다음 앱 실행의 시작 동기화로만 올라갔다). 실제 js/core.js · js/cloud.js 를 가짜 서버에 붙여 돌린다.
// 파일 이름순으로 user-games 뒤, user-teams 앞에서 돈다. 각 테스트는 로그아웃부터 시작해 앞선 로그인·팀 상태를 지운다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, ls = T.ls, test = T.test, sleep = T.sleep;
  var T0 = new Date(2026, 4, 17, 16, 28, 31).getTime();
  var K1 = 'sl_1779002911000', K2 = 'sl_1779002911001';

  function gameData(extra) { return Object.assign({ th: '홈', ta: '원정', hs: 3, as: 1, abs: [], d: '2026. 5. 17.', ts: T0 }, extra || {}); }
  // 로그인 여부 · 팀 코드를 정해 놓고 시작한다. 이후 서버 요청 기록(srv.log)은 저장 흐름 것만 남는다
  async function fresh(loggedIn, teamCode) {
    await sleep(2000);                        // 앱 시작 때 도는 첫 동기화(로그인 전, 서버 전송 없음)가 끝나길 기다린다
    srv.signOut(); await sleep(1000);
    srv.reset(); localStorage.clear();
    localStorage.setItem('sl_saves', '[]');
    if (teamCode) localStorage.setItem('sl_team_code', teamCode);
    if (loggedIn) { srv.signIn(); await sleep(1500); }
    srv.log.length = 0;
  }
  // 실제 "경기 저장"(saveGame) → 저장 디바운스 300ms + user_games 업로드 디바운스 3초
  async function pressSave() {
    var abs0 = window.AS.abs;
    try { window._curSaveKey = null; window.AS.abs = [{ id: 1, res: '안타', ts: '1' }]; saveGame(); await sleep(4500); }
    finally { window.AS.abs = abs0; }
    return ls('sl_saves')[0];
  }
  function upserts(table) { return srv.log.filter(function (x) { return x.table === table && x.op === 'upsert'; }); }
  function rowsOf(table, key) { return upserts(table).reduce(function (a, x) { return a.concat(x.rows); }, []).filter(function (r) { return r.game_key === key; }); }

  // ── 경기 저장 → user_games ──
  test('로그인 상태에서 "경기 저장" → 그 경기가 user_games 로 1회 올라간다', async function () {
    await fresh(true);
    var saved = await pressSave();
    ok(saved && saved.key, '경기가 저장되지 않음');
    var rows = rowsOf('user_games', saved.key);
    eq(rows.length, 1, 'user_games upsert 행 수');
    eq(rows[0].user_id, 'TEST-USER', 'user_id');
    eq(rows[0].data.hs, ls(saved.key).hs, '올라간 내용');
    eq(rowsOf('user_games', saved.key).length, srv.user_games.filter(function (r) { return r.game_key === saved.key; }).length, '서버에 반영');
    eq(upserts('games').length, 0, '팀 코드가 없으면 games 로는 안 올라간다');
  });
  test('비로그인 "경기 저장" → 서버로 아무것도 보내지 않는다', async function () {
    await fresh(false);
    var saved = await pressSave();
    ok(saved && saved.key, '경기가 저장되지 않음(로컬 저장은 되어야 함)');
    eq(srv.log, [], '서버 요청');
  });
  test('로그인 상태에서 여러 경기를 연달아 저장(가져오기처럼)해도 각각 user_games 로 올라간다', async function () {
    await fresh(true);
    cloudSave(K1, gameData({ hs: 1 }), 'a', T0); cloudSave(K2, gameData({ hs: 2 }), 'b', T0 + 1);
    await sleep(4500);
    eq(rowsOf('user_games', K1).length, 1, 'K1 업로드'); eq(rowsOf('user_games', K2).length, 1, 'K2 업로드');
  });
  test('이름만 바꾼 저장(labelOnly)은 user_games 로 올리지 않는다', async function () {
    await fresh(true);
    cloudSave(K1, gameData(), '새 이름', T0, true);
    await sleep(4500);
    eq(upserts('user_games').length, 0, 'user_games upsert 수');
  });

  // ── 팀 코드(games) 저장은 기존과 같다 ──
  test('팀 코드 games 저장은 기존과 같다 — 비로그인이면 games 1회 · user_games 0회', async function () {
    await fresh(false, 'MYTEAM12');
    var saved = await pressSave();
    var g = rowsOf('games', saved.key);
    eq(g.length, 1, 'games upsert 행 수');
    eq(g[0].team_code, 'MYTEAM12', 'team_code'); eq(g[0].label, saved.label, 'label'); eq(g[0].game_data.hs, ls(saved.key).hs, 'game_data');
    eq(upserts('user_games').length, 0, 'user_games upsert 수');
  });
  test('팀 코드 games 저장은 기존과 같다 — 로그인 상태면 games 1회 + user_games 1회', async function () {
    await fresh(true, 'MYTEAM12');
    var saved = await pressSave();
    eq(rowsOf('games', saved.key).length, 1, 'games upsert 행 수');
    eq(rowsOf('games', saved.key)[0].team_code, 'MYTEAM12', 'team_code');
    eq(rowsOf('user_games', saved.key).length, 1, 'user_games upsert 행 수');
  });

  // ── 전역 이름 충돌 검사 ──
  // cloud.js 가 window 에 거는 이름이 다른 스크립트의 전역(window.X = … 또는 클래식 스크립트의 최상위 function/var/let/const)과 겹치면 나중에 로드된 쪽이 덮어쓴다
  // (core.js 는 defer 라 cloud.js 보다 늦다). 페이지가 실제로 불러온 같은 출처의 js 파일 + index.html 인라인 스크립트를 문자열로 훑는다.
  test('cloud.js 와 다른 스크립트 사이에 전역 이름 충돌이 없다', async function () {
    var text = function (u) { return fetch(u).then(function (r) { return r.text(); }); };
    var cloud = await text('js/cloud.js');
    var names = [], re = /(?:^|[^\w.$])window\.([A-Za-z_$][\w$]*)\s*=[^=]/g, m;
    while ((m = re.exec(cloud))) if (names.indexOf(m[1]) < 0) names.push(m[1]);
    ok(names.length >= 10, 'cloud.js 의 window 대입을 못 찾음(검사가 비어 있다): ' + names.length);

    var paths = [];
    performance.getEntriesByType('resource').forEach(function (e) {
      var u = new URL(e.name);
      if (u.origin === location.origin && /^\/js\/.+\.js$/.test(u.pathname) && u.pathname !== '/js/cloud.js' && paths.indexOf(u.pathname) < 0) paths.push(u.pathname);
    });
    ['/js/core.js', '/js/ocr.js', '/js/analytics.js'].forEach(function (p) { ok(paths.indexOf(p) >= 0, p + ' 를 불러온 기록이 없다(검사 범위가 비어 있다)'); });
    var classic = ['/js/core.js', '/js/ocr.js', '/js/analytics.js'];

    var srcs = await Promise.all(paths.map(function (p) { return text(p).then(function (s) { return { file: p, src: s, classic: classic.indexOf(p) >= 0 }; }); }));
    var html = await text('index.html');
    var inline = ''; html.replace(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g, function (_, s) { inline += s + '\n'; });
    srcs.push({ file: 'index.html(인라인)', src: inline, classic: true });

    var hits = [];
    names.forEach(function (n) {
      var e = n.replace(/\$/g, '\\$');
      var assign = new RegExp('(^|[^\\w.$])window\\.' + e + '\\s*=[^=]');
      var decl = new RegExp('^(?:async\\s+)?function\\s+' + e + '\\b|^(?:var|let|const)\\s+' + e + '\\b', 'm');
      srcs.forEach(function (s) {
        if (assign.test(s.src)) hits.push(n + ' ← ' + s.file + ' (window.' + n + ' =)');
        if (s.classic && decl.test(s.src)) hits.push(n + ' ← ' + s.file + ' (최상위 선언)');
      });
    });
    eq(hits, [], '전역 이름 충돌');
  });
})();
