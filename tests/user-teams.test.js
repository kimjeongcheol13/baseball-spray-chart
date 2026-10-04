// 팀 가입 흐름 검증 — 실제 js/cloud.js 의 joinTeam 을 가짜 서버에 붙여 돌린다.
// 배경: team_members 에 클라이언트가 직접 insert 하면 team_members_insert 정책을 닫을 수 없다(sql/08 · 09) → 가입은 RPC(join_team_by_code)로만 한다.
// 파일 이름순으로 user-games 뒤에 돈다: 가입에 성공하면 cloud.js 의 팀 상태가 남으므로 마지막에 둔다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;

  // 로그인 → 시작 동기화가 끝나고 팀 영역(#teamFormArea)이 그려질 때까지 기다린 뒤, 팀 한 개를 서버에 둔다
  async function loginWithTeam(team) {
    await sleep(2000);                       // 앱 시작 때 도는 첫 동기화(로그인 전, 서버 전송 없음)가 끝나길 기다린다
    srv.reset(); localStorage.clear();
    srv.signIn(); await sleep(1500);
    srv.teams = [team];
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
})();
