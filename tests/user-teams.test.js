// 팀 관련 클라우드 동작 검증 — 실제 js/cloud.js 를 가짜 서버에 붙여 돌린다.
//  · user_games upsert 의 team_id: 팀이 없으면 null 을 명시(탈퇴·강퇴·해산 뒤 옛 팀 id 가 남아 sql/08 WITH CHECK 에 걸리지 않게), 모르면 싣지 않는다
//  · 가입: team_members 에 클라이언트가 직접 insert 하면 team_members_insert 정책을 닫을 수 없다(sql/09) → 가입은 RPC(join_team_by_code)로만 한다
// 파일 이름순으로 user-games 뒤에 돈다. 가입에 성공하거나 팀장이 되면 cloud.js 의 팀 상태가 남으므로 그런 테스트는 뒤쪽에 둔다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;
  var K = 'sl_1779002911000', T0 = new Date(2026, 4, 17, 16, 28, 31).getTime();

  // ── user_games upsert 의 team_id ──
  // 로컬에 경기 1개를 두고 로그인 → 시작 동기화가 서버에 올린 user_games 행들을 돌려준다
  async function startupRows(setup) {
    await sleep(2000);                       // 앱 시작 때 도는 첫 동기화(로그인 전, 서버 전송 없음)가 끝나길 기다린다
    srv.signOut(); await sleep(1000);        // 앞선 테스트가 남긴 팀 상태를 지운다(SIGNED_OUT)
    srv.reset(); localStorage.clear();
    localStorage.setItem(K, JSON.stringify({ th: '홈', ta: '원정', hs: 1, as: 0, abs: [], d: '2026. 5. 17.', ts: T0 }));
    localStorage.setItem('sl_saves', JSON.stringify([{ key: K, label: K, ts: T0 }]));
    localStorage.setItem('sl_cloud_mod', '{}');
    if (setup) setup();
    srv.signIn(); await sleep(1500);
    var u = srv.log.filter(function (x) { return x.table === 'user_games' && x.op === 'upsert'; });
    eq(u.length, 1, '시작 동기화 업로드 요청 수');
    return u[0].rows;
  }
  test('upsert: 팀이 없을 때 본문에 team_id: null 이 들어간다(생략하지 않는다)', async function () {
    var rows = await startupRows();
    eq(rows.length, 1, '업로드 행 수');
    ok('team_id' in rows[0], 'team_id 키가 없음 — 옛 팀 id 가 서버에 남는다');
    eq(rows[0].team_id, null, 'team_id');
  });
  test('upsert: 팀 조회가 실패해 모르면 team_id 를 싣지 않는다(null 로 덮어 팀원의 팀 태그를 지우지 않는다)', async function () {
    var rows = await startupRows(function () {
      srv.failRead = function (r, table) { return table === 'teams' ? { status: 500, code: 'XX000', message: 'internal error' } : null; };
    });
    eq(rows.length, 1, '업로드 행 수');
    ok(!('team_id' in rows[0]), 'team_id 가 실렸음: ' + JSON.stringify(rows[0].team_id));
  });

  // ── 가입 ──
  // 로그인 → 시작 동기화가 끝나고 팀 영역(#teamFormArea)이 그려질 때까지 기다린 뒤, 팀 한 개를 서버에 둔다
  async function loginWithTeam(teams) {      // teams: 팀 하나 또는 배열
    await sleep(2000);
    srv.signOut(); await sleep(1000);        // 앞선 테스트가 남긴 팀 상태를 지운다(SIGNED_OUT)
    srv.reset(); localStorage.clear();
    srv.signIn(); await sleep(1500);
    srv.teams = [].concat(teams);
    srv.log.length = 0;                      // 이후 기록은 가입 흐름 것만
  }
  async function join(code) {
    openJoinTeam();
    ok(T.$('teamCodeInput'), '가입 폼이 그려지지 않음');
    T.$('teamCodeInput').value = code;
    joinTeam();
    await sleep(500);
  }
  function directInserts() { return srv.log.filter(function (x) { return x.table === 'team_members' && x.op === 'insert'; }); }
  function rpcs() { return srv.log.filter(function (x) { return x.op === 'rpc'; }); }
  function msg() { return T.$('teamFormMsg') ? T.$('teamFormMsg').textContent : ''; }

  test('가입: 없는 코드는 "찾을 수 없어요", team_members 에 아무것도 넣지 않는다', async function () {
    await loginWithTeam({ id: 'T1', name: '테스트팀', code: 'ABC234', owner_id: 'OTHER-USER' });
    await join('ZZZZZZ');
    eq(msg(), '팀 코드를 찾을 수 없어요', '안내 문구');
    eq(directInserts().length, 0, 'team_members 직접 insert');
    eq(srv.team_members, [], '서버 team_members');
  });
  test('가입: 내가 만든 팀의 코드는 "내가 만든 팀이에요", team_members 에 넣지 않는다', async function () {
    await loginWithTeam({ id: 'T1', name: '테스트팀', code: 'ABC234', owner_id: 'TEST-USER' });
    await join('ABC234');
    eq(msg(), '내가 만든 팀이에요', '안내 문구');
    eq(directInserts().length, 0, 'team_members 직접 insert');
    eq(srv.team_members, [], '서버 team_members');
  });
  test('가입 시 team_members 직접 insert 없이 RPC(join_team_by_code)를 호출한다', async function () {
    await loginWithTeam({ id: 'T1', name: '테스트팀', code: 'ABC234', owner_id: 'OTHER-USER' });
    await join('ABC234');
    eq(directInserts().length, 0, 'team_members 직접 insert');
    eq(rpcs().map(function (x) { return x.fn; }), ['join_team_by_code'], '호출한 RPC');
    eq(rpcs()[0].args, { p_code: 'ABC234' }, 'RPC 인자');
    eq(T.$('teamBadge').textContent, '팀원 · 테스트팀', '가입 후 팀 배지');
  });

  // ── 한 사람당 팀 하나(sql/10): 서버가 거부하면 그 문구를 사람이 읽을 수 있게 보여준다 ──
  [['다른 팀의 팀원', function () { srv.team_members = [{ team_id: 'T2', user_id: 'TEST-USER' }]; }],
   ['다른 팀의 팀장', function () { srv.teams.push({ id: 'T2', name: '내 팀', code: 'DEF567', owner_id: 'TEST-USER' }); }]].forEach(function (c) {
    test('가입: ' + c[0] + '이면 서버의 한국어 메시지를 그대로 보여주고 가입하지 않는다', async function () {
      await loginWithTeam({ id: 'T1', name: '테스트팀', code: 'ABC234', owner_id: 'OTHER-USER' });
      c[1]();
      await join('ABC234');
      eq(msg(), '이미 다른 팀에 속해 있어요. 탈퇴 후 다시 시도해 주세요', '안내 문구(앞에 "오류:" 가 붙지 않는다)');
      eq(directInserts().length, 0, 'team_members 직접 insert');
      eq(srv.team_members.filter(function (m) { return m.team_id === 'T1'; }), [], 'T1 에 가입된 행');
      eq(T.$('teamBadge').style.display, 'none', '팀 배지가 보이면 안 됨');
    });
  });
  [['이미 소유한 팀(23505, owner_id)', { status: 409, code: '23505', message: 'duplicate key value violates unique constraint "teams_owner_id_uniq"', details: 'Key (owner_id)=(TEST-USER) already exists.' },
    '이미 만든 팀이 있어요. 팀은 한 사람당 하나만 만들 수 있어요'],
   ['다른 팀의 팀원(42501)', { status: 403, code: '42501', message: 'new row violates row-level security policy for table "teams"' },
    '이미 다른 팀에 속해 있어서 팀을 만들 수 없어요. 탈퇴 후 다시 시도해 주세요'],
   ['팀 코드 충돌(23505, code)은 owner 문구를 쓰지 않는다', { status: 409, code: '23505', message: 'duplicate key value violates unique constraint "teams_code_key"', details: 'Key (code)=(ABC234) already exists.' },
    '오류: duplicate key value violates unique constraint "teams_code_key"']].forEach(function (c) {
    test('팀 만들기: ' + c[0] + ' → 문구 표시', async function () {
      await loginWithTeam([]);
      srv.failWrite = c[1];
      openCreateTeam();
      ok(T.$('teamNameInput'), '팀 만들기 폼이 그려지지 않음');
      T.$('teamNameInput').value = '새 팀';
      // 폼의 실제 "팀 생성" 버튼을 누른다. core.js 의 전역 createTeam()(로컬 팀 대시보드용)이 cloud.js 의 함수를 덮어쓰면 서버 요청이 나가지 않는다
      T.$('teamFormArea').querySelector('button').click();
      await sleep(500);
      eq(msg(), c[2], '안내 문구');
      eq(T.$('teamBadge').style.display, 'none', '팀 배지가 보이면 안 됨');
    });
  });

  // ── 팀이 있을 때의 team_id (팀장이 되면 cloud.js 의 팀 상태가 남으므로 마지막) ──
  test('upsert: 팀장이면 본문에 그 팀의 id 가 들어간다', async function () {
    var rows = await startupRows(function () { srv.teams = [{ id: 'T1', name: '테스트팀', code: 'ABC234', owner_id: 'TEST-USER' }]; });
    eq(rows.length, 1, '업로드 행 수');
    eq(rows[0].team_id, 'T1', 'team_id');
  });
  test('upsert: 팀이 있던 상태에서 재조회 결과가 "팀 없음"이면 이후 upsert 본문에 team_id: null 이 들어간다', async function () {
    var first = await startupRows(function () { srv.teams = [{ id: 'T1', name: '테스트팀', code: 'ABC234', owner_id: 'TEST-USER' }]; });
    eq(first[0].team_id, 'T1', '팀이 있을 때 team_id');
    srv.teams = []; srv.user_games = []; srv.log.length = 0;   // 팀이 사라졌다(해산·강퇴). 서버에 경기가 없으니 다시 올라간다
    srv.signIn(); await sleep(1500);                           // 같은 페이지에서 재조회
    var u = srv.log.filter(function (x) { return x.table === 'user_games' && x.op === 'upsert'; });
    eq(u.length, 1, '재조회 뒤 업로드 요청 수');
    ok('team_id' in u[0].rows[0], 'team_id 키가 없음');
    eq(u[0].rows[0].team_id, null, '옛 팀 id 가 실렸음');
  });
  test('upsert: 로그아웃 → 재로그인 직후(팀 조회 전) upsert 본문에는 team_id 가 없다', async function () {
    await sleep(2000);
    srv.signOut(); await sleep(1000);
    srv.reset(); localStorage.clear();
    srv.signIn(); await sleep(1500);                           // 첫 계정: 팀 조회가 끝나 "팀 없음"이 확정된 상태
    var abs0 = AS.abs;
    try {
      AS.abs = [{ id: 'x1' }]; srv.log.length = 0;
      cloudAutoSyncRecord();                                   // 3초 디바운스 뒤 user_games upsert 예약(t=0)
      srv.signOut(); await sleep(2700);
      srv.signIn(); await sleep(1500);                         // t=2.7초 재로그인 → 시작 동기화(팀 조회)는 500ms 뒤(t=3.2초)라서 t=3초의 upsert 가 먼저 나간다
    } finally { AS.abs = abs0; }
    var rows = srv.log.filter(function (x) { return x.table === 'user_games' && x.op === 'upsert'; })
      .reduce(function (a, x) { return a.concat(x.rows); }, []).filter(function (r) { return /^sl_auto_/.test(r.game_key); });
    eq(rows.length, 1, '팀 조회 전에 나간 upsert 행 수');
    ok(!('team_id' in rows[0]), '팀을 모르는데 team_id 가 실렸음: ' + JSON.stringify(rows[0].team_id));
  });

  // ── 실시간 구독 콜백(_onTeamGameUpdate) 가드 ──
  // 팀장이 되어 구독을 건 뒤, 서버가 보내는 user_games UPDATE 이벤트를 흉내 낸다(스텁이 구독 콜백을 기억한다)
  async function teamChannelCb() {
    await sleep(2000);
    srv.signOut(); await sleep(1000);
    srv.reset(); localStorage.clear();
    srv.teams = [{ id: 'T1', name: '테스트팀', code: 'ABC234', owner_id: 'TEST-USER' }];
    srv.signIn(); await sleep(1500);
    var ch = srv.channels.filter(function (c) { return c.filter && c.filter.table === 'user_games'; }).pop();
    ok(ch, 'user_games 구독이 걸리지 않음');
    return ch.cb;
  }
  function teamRow(userId, abs) {
    return { user_id: userId, game_key: K, team_id: 'T1', team_name: '홈 vs 원정', date: '2026. 5. 17.',
      data: { th: '홈', ta: '원정', hs: 3, as: 1, abs: abs || [], d: '2026. 5. 17.', ts: T0 }, updated_at: new Date(T0 + 60000).toISOString() };
  }
  function modOf(k) { return (T.ls('sl_cloud_mod') || {})[k]; }
  // 콜백이 throw 하면 그 예외를, 아니면 null 을 돌려준다
  function call(cb, row) { try { cb({ new: row }); return null; } catch (e) { return e; } }

  test('실시간: 다른 사용자(팀원)의 행은 localStorage 에 쓰지 않는다', async function () {
    var cb = await teamChannelCb();
    var threw = call(cb, teamRow('MEMBER-USER'));
    ok(!threw, '콜백이 throw 함: ' + threw);
    eq(localStorage.getItem(K), null, '팀원 경기가 localStorage 에 저장됨');
    eq(modOf(K), undefined, '수정 시각이 기록됨');
  });
  test('실시간: 내 행(다른 기기에서 올린 것)은 지금처럼 localStorage 에 저장한다', async function () {
    var cb = await teamChannelCb();
    var threw = call(cb, teamRow('TEST-USER'));
    ok(!threw, '콜백이 throw 함: ' + threw);
    eq(T.ls(K).hs, 3, '저장된 경기');
    eq(modOf(K), T0 + 60000, '로컬 수정 시각 = 서버 시각');
  });
  test('실시간: 열린 경기와 key 가 같으면 팀원의 타구는 그대로 합쳐진다(localStorage 에는 쓰지 않는다)', async function () {
    var cb = await teamChannelCb();
    var abs0 = AS.abs, key0 = window._autoKey, upd0 = window.updateAll, updated = 0;
    try {
      window._autoKey = K; AS.abs = [{ id: 'a1' }]; window.updateAll = function () { updated++; };
      var threw = call(cb, teamRow('MEMBER-USER', [{ id: 'a1' }, { id: 'b2' }]));
      ok(!threw, '콜백이 throw 함: ' + threw);
      eq(AS.abs.map(function (a) { return a.id; }), ['a1', 'b2'], '합쳐진 타구');
      eq(updated, 1, 'updateAll 호출');
      eq(localStorage.getItem(K), null, '팀원 경기가 localStorage 에 저장됨');
    } finally { AS.abs = abs0; window._autoKey = key0; window.updateAll = upd0; }
  });
  test('실시간: setItem 이 예외를 던져도 콜백은 throw 하지 않고 내 저장은 그대로다', async function () {
    var cb = await teamChannelCb();
    localStorage.setItem('sl_saves', '[]');
    var orig = Storage.prototype.setItem, threw;
    Storage.prototype.setItem = function (k) { if (k === K) throw new DOMException('quota', 'QuotaExceededError'); return orig.apply(this, arguments); };
    try { threw = call(cb, teamRow('TEST-USER')); } finally { Storage.prototype.setItem = orig; }
    ok(!threw, '콜백이 throw 함: ' + threw);
    eq(localStorage.getItem('sl_saves'), '[]', '내 저장 목록이 바뀜');
    localStorage.setItem('sl_probe', '1');
    eq(localStorage.getItem('sl_probe'), '1', '이후 localStorage 쓰기');
  });
  test('실시간: 로컬 값이 깨진 JSON 이어도 콜백은 throw 하지 않고 그 값을 건드리지 않는다', async function () {
    var cb = await teamChannelCb();
    localStorage.setItem(K, '{깨진 json');
    var threw = call(cb, teamRow('TEST-USER'));
    ok(!threw, '콜백이 throw 함: ' + threw);
    eq(localStorage.getItem(K), '{깨진 json', '깨진 로컬 값');
  });
})();
