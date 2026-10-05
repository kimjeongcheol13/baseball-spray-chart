// 팀장용 "팀 경기" 화면 검증 — 실제 js/cloud.js + js/features/teamgames.js 를 가짜 서버에 붙여 돌린다(외부 요청 0건은 하네스가 마지막에 확인).
//  · 목록: 팀원 경기만(내 경기 · 다른 팀 제외) · 수정 시각 최신순 · 최대 50개 · 팀원 이름 · 날짜 · 상대 · 타석 수 · AVG
//  · 버튼: 팀장에게만 / 실시간: 팀장만 INSERT 구독, 새 경기는 맨 위에 NEW
//  · 보기: 읽기 전용 — localStorage 쓰기 0회, 서버 요청 0건, 앱의 현재 경기(AS)를 건드리지 않는다
//  · XSS: 팀원 · 팀 · 상대 · 타자 이름에 태그가 있어도 실행되지 않는다
// 로그인 상태(팀장/팀원)가 남으므로 매 테스트가 로그아웃부터 시작한다. user-teams.test.js 보다 먼저 돈다(파일 이름순).
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;
  var T0 = Date.now() - 3 * 86400000;            // 3일 전(경기 시각은 미래일 수 없다)
  var OWNER = 'TEST-USER';                        // srv.signIn() 이 만드는 사용자 id

  function key(n) { return 'sl_17900000' + String(100000 + n); }   // 경기 저장 키 형식(sl_숫자)
  function ab(name, res, team, extra) { return Object.assign({ id: name + res + Math.random(), bid: 1, bname: name, bnum: 7, team: team, res: res, x: 0.5, y: 0.5, deg: 90, inn: '1회초', rbi: 0 }, extra || {}); }
  // 팀원 경기 한 행(서버의 user_games). min = 수정 시각(분)
  function row(uid, n, o) {
    o = o || {};
    return { id: 'id-' + uid + '-' + n, user_id: uid, game_key: o.game_key || key(n), team_id: o.team_id || 'T1', team_name: '우리팀 vs 상대', date: o.date || '2026. 10. 3.',
      data: { th: o.th || '우리팀', ta: o.ta || '상대A', hs: 3, as: 1, d: o.date || '2026. 10. 3.', ts: T0, abs: o.abs || [ab('김타자', '안타', 'home')] },
      updated_at: new Date(T0 + (o.min || 0) * 60000).toISOString() };
  }
  // 로그아웃으로 앞선 테스트의 상태를 지우고, 팀장(owner) 또는 팀원(member)으로 로그인한다
  // members(팀장일 때): 서버 team_members 행 — {user_id, display_name}. 가입할 때 정한 "팀에서 쓸 이름"(sql/12)
  async function login(role, userGames, teamName, members) {
    await sleep(2000);
    srv.signOut(); await sleep(1000);
    srv.reset(); localStorage.clear();
    var name = teamName || '테스트팀';
    if (role === 'owner') {
      srv.teams = [{ id: 'T1', name: name, code: 'ABC234', owner_id: OWNER }];
      srv.team_members = (members || []).map(function (m) { return Object.assign({ team_id: 'T1' }, m); });
    }
    else { srv.teams = [{ id: 'T1', name: name, code: 'ABC234', owner_id: 'COACH' }]; srv.team_members = [{ team_id: 'T1', user_id: OWNER }]; }
    srv.user_games = userGames || [];
    srv.signIn(); await sleep(1500);
  }
  function teamButton() {
    return Array.prototype.filter.call(T.$('teamSection').querySelectorAll('button'), function (b) { return b.textContent.trim() === '팀 경기'; })[0] || null;
  }
  async function openList() {
    var b = teamButton(); ok(b, '"팀 경기" 버튼이 없음');
    b.click(); await sleep(300);
  }
  function modal() { return T.$('teamGamesModal'); }
  function rows() { return Array.prototype.map.call(document.querySelectorAll('#teamGamesModal .tg-row'), function (r) { return r.textContent; }); }
  function insertCb() {
    var c = srv.channels.filter(function (x) { return x.filter && x.filter.table === 'user_games' && x.filter.event === 'INSERT'; }).pop();
    ok(c, 'user_games INSERT 구독이 걸리지 않음');
    return c;
  }
  function inked(c) { var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (var i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }

  // 내 팀(home) 타석 5개(안타·삼진·볼넷·홈런·땅볼 아웃 → AB 4 · H 2 → .500) + 상대(away) 타석 1개(세지 않는다)
  var A_ABS = [ab('김타자', '안타', 'home'), ab('김타자', '삼진', 'home'), ab('이타자', '볼넷', 'home'), ab('박타자', '홈런', 'home', { rbi: 2, inn: '3회초' }),
    ab('최타자', '땅볼 아웃', 'home'), ab('상대타자', '안타', 'away')];

  // ── 목록 ──
  test('팀장: "팀 경기" 버튼이 있고, 열면 팀원 경기만(내 경기 · 다른 팀 제외) 최신순으로 이름 · 날짜 · 상대 · 타석 수 · AVG 와 함께 보인다', async function () {
    await login('owner', [
      row(OWNER, 1, { min: 50 }),                                              // 내 경기 → 제외
      row('user-aaaa-1111', 2, { min: 10, ta: '상대A', abs: A_ABS }),
      row('user-bbbb-2222', 3, { min: 30, ta: '상대B', date: '2026. 10. 4.' }),
      row('user-cccc-3333', 4, { min: 40, team_id: 'T2' })                     // 다른 팀 → 제외
    ]);
    await openList();
    var r = rows();
    eq(r.length, 2, '목록 행 수(팀원 경기 2개)');
    ok(r[0].indexOf('팀원 2222') >= 0 && r[0].indexOf('상대B') >= 0 && r[0].indexOf('2026. 10. 4.') >= 0 && r[0].indexOf('1타석') >= 0 && r[0].indexOf('AVG .000') < 0, '첫 행(최신): ' + r[0]);
    ok(r[1].indexOf('팀원 1111') >= 0 && r[1].indexOf('상대A') >= 0 && r[1].indexOf('5타석') >= 0 && r[1].indexOf('AVG .500') >= 0, '둘째 행: ' + r[1]);
    ok(r.every(function (x) { return x.indexOf('팀원 USER') < 0 && x.indexOf('3333') < 0; }), '내 경기나 다른 팀 경기가 보임: ' + r.join(' | '));
    var q = srv.log.filter(function (x) { return x.table === 'user_games' && x.op === 'select' && x.query && x.query.eq.team_id; });
    eq(q.length, 1, '팀 경기 조회 요청 수');
    eq(q[0].query, { eq: { team_id: 'T1' }, neq: { user_id: OWNER }, order: { col: 'updated_at', asc: false }, limit: 50 }, '조회 조건');
    ok(T.$('teamGamesModal').textContent.indexOf('테스트팀') >= 0, '창 제목에 팀 이름');
  });
  test('팀장: 경기가 많아도 최대 50개만 보인다(최신 50개)', async function () {
    var many = [];
    for (var i = 0; i < 60; i++) many.push(row('user-m-' + String(1000 + i), i, { min: i }));
    await login('owner', many);
    await openList();
    var r = rows();
    eq(r.length, 50, '목록 행 수');
    ok(r[0].indexOf('팀원 1059') >= 0, '맨 위는 가장 최근: ' + r[0]);
    ok(r[49].indexOf('팀원 1010') >= 0, '50번째: ' + r[49]);
  });
  test('저장된 이름(team_members.display_name)이 목록 · 상세에 표시되고, 이름이 없는 팀원은 임시 표시가 남는다', async function () {
    await login('owner', [
      row('user-aaaa-1111', 2, { min: 10 }),
      row('user-bbbb-2222', 3, { min: 30 })
    ], null, [{ user_id: 'user-aaaa-1111', display_name: '#7 김OO' }, { user_id: 'user-bbbb-2222', display_name: null }]);
    await openList();
    var r = rows();
    eq(r.length, 2, '행 수');
    ok(r[0].indexOf('팀원 2222') >= 0, '이름 없는 팀원은 임시 표시: ' + r[0]);
    ok(r[1].indexOf('#7 김OO') >= 0 && r[1].indexOf('팀원 1111') < 0, '저장된 이름: ' + r[1]);
    var q = srv.log.filter(function (x) { return x.table === 'team_members' && x.op === 'select' && x.query && x.query.eq.team_id; });
    eq(q.length, 1, '팀원 이름 조회 요청 수');
    eq(q[0].cols, 'user_id,display_name', '이름 조회 컬럼(그 밖의 팀원 정보는 읽지 않는다)');
    document.querySelectorAll('#teamGamesModal .tg-row')[1].click(); await sleep(300);
    ok(modal().querySelector('.tg-sub').textContent.indexOf('#7 김OO') === 0, '상세의 이름: ' + modal().querySelector('.tg-sub').textContent);
  });
  test('이름 조회가 실패해도(sql/12 적용 전 등) 목록은 임시 표시로 보인다', async function () {
    await login('owner', [row('user-aaaa-1111', 2)], null, [{ user_id: 'user-aaaa-1111', display_name: '#7 김OO' }]);
    srv.failRead = function (r, table) { return table === 'team_members' ? { status: 400, code: '42703', message: 'column team_members.display_name does not exist' } : null; };
    await openList();
    eq(rows().length, 1, '행 수');
    ok(rows()[0].indexOf('팀원 1111') >= 0 && rows()[0].indexOf('#7 김OO') < 0, '임시 표시: ' + rows()[0]);
    srv.failRead = null;
  });
  test('팀장: 팀원 경기가 없거나 불러오지 못하면 안내 문구가 보인다', async function () {
    await login('owner', [row(OWNER, 1)]);                                      // 내 경기뿐 → 빈 목록(sql/11 이 없을 때도 이렇게 보인다)
    await openList();
    ok(modal().textContent.indexOf('아직 팀원이 올린 경기가 없어요') >= 0, '빈 목록 문구');
    modal().querySelector('.tg-x').click();
    srv.failRead = function (r, table) { return table === 'user_games' ? { status: 500, code: 'XX000', message: 'internal error' } : null; };
    await openList();
    ok(modal().textContent.indexOf('목록을 불러오지 못했어요') >= 0, '오류 문구');
    srv.failRead = null;
  });

  // ── 버튼 · 구독 ──
  test('팀원(비팀장)에게는 "팀 경기" 버튼이 없고 INSERT 구독도 걸지 않는다(UPDATE 구독은 그대로)', async function () {
    await login('member', [row('user-aaaa-1111', 2)]);
    eq(T.$('teamBadge').textContent, '팀원 · 테스트팀', '팀원으로 로그인됨');
    eq(teamButton(), null, '팀원에게 "팀 경기" 버튼이 있음');
    eq(srv.channels.filter(function (c) { return c.filter && c.filter.event === 'INSERT'; }).length, 0, '팀원이 INSERT 를 구독함');
    eq(srv.channels.filter(function (c) { return c.filter && c.filter.event === 'UPDATE' && c.filter.filter === 'team_id=eq.T1'; }).length, 1, 'UPDATE 구독(기존 동작)');
  });
  test('팀장: user_games INSERT 를 team_id 로 구독한다', async function () {
    await login('owner', []);
    eq(insertCb().filter, { event: 'INSERT', schema: 'public', table: 'user_games', filter: 'team_id=eq.T1' }, '구독 조건');
  });

  // ── 실시간 ──
  test('INSERT 이벤트 → 목록 맨 위에 NEW 로 추가된다(내 경기 · 설정 키 · 같은 경기 중복은 무시, localStorage 에는 쓰지 않는다)', async function () {
    await login('owner', [row('user-aaaa-1111', 2, { min: 10 })]);
    await openList();
    eq(rows().length, 1, '처음 행 수');
    var cb = insertCb().cb, fresh = row('user-zzzz-9999', 5, { min: 20, ta: '새상대' });
    cb({ new: fresh }); await sleep(50);
    var r = rows();
    eq(r.length, 2, 'INSERT 뒤 행 수');
    ok(r[0].indexOf('NEW') >= 0 && r[0].indexOf('팀원 9999') >= 0 && r[0].indexOf('새상대') >= 0, '맨 위가 NEW: ' + r[0]);
    ok(r[1].indexOf('NEW') < 0, '기존 행에는 NEW 가 없다: ' + r[1]);
    cb({ new: row(OWNER, 6, { min: 21 }) }); cb({ new: row('user-zzzz-9999', 7, { min: 22, game_key: 'sl_cloud_session' }) }); cb({ new: fresh });
    await sleep(50);
    eq(rows().length, 2, '내 경기 · 설정 키 · 중복 INSERT 는 행을 늘리지 않는다');
    eq(localStorage.getItem(fresh.game_key), null, '팀원 경기가 localStorage 에 저장됨');
    eq(localStorage.getItem('sl_cloud_session'), null, '설정 키가 localStorage 에 저장됨');
    // 창을 닫았다 열면 NEW 는 사라진다(서버에는 이제 그 경기가 있다)
    modal().querySelector('.tg-x').click();
    srv.user_games.push(fresh);
    await openList();
    r = rows();
    eq(r.length, 2, '다시 연 뒤 행 수');
    ok(r.every(function (x) { return x.indexOf('NEW') < 0; }), '다시 열면 NEW 가 없다: ' + r.join(' | '));
    // 창이 닫혀 있는 동안 온 새 경기는 다음에 열 때 NEW 로 보인다
    modal().querySelector('.tg-x').click();
    var later = row('user-yyyy-8888', 9, { min: 40 });
    srv.user_games.push(later); insertCb().cb({ new: later });
    await openList();
    r = rows();
    ok(r[0].indexOf('NEW') >= 0 && r[0].indexOf('팀원 8888') >= 0, '닫혀 있는 동안 온 경기: ' + r[0]);
  });

  test('INSERT 이벤트의 이름: 알려진 팀원은 저장된 이름, 목록을 연 뒤 가입한 팀원은 이름을 다시 조회해서 보인다(조회 실패면 임시 표시)', async function () {
    await login('owner', [row('user-aaaa-1111', 2, { min: 10 })], null, [{ user_id: 'user-aaaa-1111', display_name: '#7 김OO' }]);
    await openList();
    var cb = insertCb().cb;
    cb({ new: row('user-aaaa-1111', 5, { min: 20 }) }); await sleep(100);
    ok(rows()[0].indexOf('NEW') >= 0 && rows()[0].indexOf('#7 김OO') >= 0, '알려진 팀원: ' + rows()[0]);
    srv.team_members.push({ team_id: 'T1', user_id: 'user-nnnn-3333', display_name: '#10 박OO' });   // 목록을 연 뒤에 가입
    cb({ new: row('user-nnnn-3333', 6, { min: 30 }) }); await sleep(100);
    ok(rows()[0].indexOf('NEW') >= 0 && rows()[0].indexOf('#10 박OO') >= 0, '새 팀원(이름 재조회): ' + rows()[0]);
    srv.failRead = function (r, table) { return table === 'team_members' ? 'reject' : null; };
    cb({ new: row('user-mmmm-4444', 7, { min: 40 }) }); await sleep(100);
    ok(rows()[0].indexOf('NEW') >= 0 && rows()[0].indexOf('팀원 4444') >= 0, '조회 실패: ' + rows()[0]);
    srv.failRead = null;
    eq(rows().length, 4, '행 수');
  });

  // ── 실시간 UPDATE: 열린 목록의 같은 경기만, 수치(타석 수 · AVG)만 ──
  function updateCb() {
    var c = srv.channels.filter(function (x) { return x.filter && x.filter.table === 'user_games' && x.filter.event === 'UPDATE'; }).pop();
    ok(c, 'user_games UPDATE 구독이 걸리지 않음');
    return c.cb;
  }
  test('UPDATE 이벤트 → 목록의 같은 경기 행만 타석 수 · AVG 가 갱신된다(다른 행 · 이름 · 날짜 · 상대 · 순서는 그대로, 목록에 없는 경기 · 내 경기 · 잘못된 행은 무시)', async function () {
    await login('owner', [
      row('user-aaaa-1111', 2, { min: 10, ta: '상대A', abs: [ab('김타자', '안타', 'home')] }),
      row('user-bbbb-2222', 3, { min: 30, ta: '상대B', abs: [ab('이타자', '삼진', 'home'), ab('이타자', '안타', 'home')] })
    ], null, [{ user_id: 'user-aaaa-1111', display_name: '#7 김OO' }]);
    await openList();
    var before = rows();
    ok(before[0].indexOf('팀원 2222') >= 0 && before[0].indexOf('2타석') >= 0 && before[0].indexOf('AVG .500') >= 0, '갱신 전 B: ' + before[0]);
    ok(before[1].indexOf('#7 김OO') >= 0 && before[1].indexOf('1타석') >= 0 && before[1].indexOf('AVG 1.000') >= 0, '갱신 전 A: ' + before[1]);
    var cb = updateCb(), upd = row('user-aaaa-1111', 2, { min: 99, ta: '바뀐상대', date: '2026. 10. 9.',
      abs: [ab('김타자', '안타', 'home'), ab('김타자', '삼진', 'home'), ab('김타자', '안타', 'home'), ab('김타자', '땅볼 아웃', 'home')] });
    cb({ new: upd }); await sleep(50);
    var r = rows();
    eq(r.length, 2, '행 수');
    eq(r[0], before[0], 'B 행은 그대로');
    ok(r[1].indexOf('4타석') >= 0 && r[1].indexOf('AVG .500') >= 0, 'A 행의 수치가 갱신됨: ' + r[1]);
    ok(r[1].indexOf('#7 김OO') >= 0 && r[1].indexOf('상대A') >= 0 && r[1].indexOf('2026. 10. 3.') >= 0 && r[1].indexOf('바뀐상대') < 0 && r[1].indexOf('10. 9.') < 0, '이름 · 날짜 · 상대는 그대로: ' + r[1]);
    // 무시되는 이벤트: 목록에 없는 경기 · 내 경기 · 검증에 실패한 행(경기 데이터가 아님)
    cb({ new: row('user-zzzz-9999', 9, { min: 120, abs: [ab('새타자', '안타', 'home')] }) });
    cb({ new: row(OWNER, 8, { min: 121 }) });
    cb({ new: Object.assign(row('user-bbbb-2222', 3, { min: 122 }), { data: [] }) });
    await sleep(50);
    eq(rows(), r, '무시되어야 하는 UPDATE 로 목록이 바뀜');
    eq(localStorage.getItem(upd.game_key), null, '팀원 경기가 localStorage 에 저장됨(기존 가드)');
  });
  test('UPDATE 이벤트 → INSERT 로 들어온 NEW 행도 수치가 갱신되고 NEW 표시는 유지된다', async function () {
    await login('owner', [row('user-aaaa-1111', 2, { min: 10 })]);
    await openList();
    var first = row('user-zzzz-9999', 5, { min: 20, abs: [ab('새타자', '삼진', 'home')] });
    insertCb().cb({ new: first }); await sleep(100);
    ok(rows()[0].indexOf('NEW') >= 0 && rows()[0].indexOf('1타석') >= 0 && rows()[0].indexOf('AVG .000') >= 0, 'INSERT 직후: ' + rows()[0]);
    updateCb()({ new: row('user-zzzz-9999', 5, { min: 21, abs: [ab('새타자', '삼진', 'home'), ab('새타자', '안타', 'home'), ab('새타자', '안타', 'home')] }) }); await sleep(50);
    ok(rows()[0].indexOf('NEW') >= 0 && rows()[0].indexOf('3타석') >= 0 && rows()[0].indexOf('AVG .667') >= 0, 'UPDATE 뒤: ' + rows()[0]);
    eq(rows().length, 2, '행 수');
  });
  test('UPDATE 이벤트: 팀원(비팀장)의 클라이언트는 팀장 화면 목록을 건드리지 않는다', async function () {
    await login('member', [row('user-aaaa-1111', 2)]);
    var calls = 0, orig = window._slTeamGameUpdate;
    window._slTeamGameUpdate = function () { calls++; };
    try { updateCb()({ new: row('user-aaaa-1111', 2, { min: 50 }) }); await sleep(50); } finally { window._slTeamGameUpdate = orig; }
    eq(calls, 0, '팀원 쪽에서 목록 갱신이 불림');
  });

  // ── 읽기 전용 보기 ──
  test('경기 열기 → 스프레이 차트와 기록이 보이고, localStorage 쓰기 0회 · 서버 요청 0건 · 앱의 현재 경기(AS)는 그대로', async function () {
    await login('owner', [row('user-aaaa-1111', 2, { ta: '상대A', abs: A_ABS })]);
    await openList();
    var snap = JSON.stringify(Object.keys(localStorage).sort().map(function (k) { return [k, localStorage.getItem(k)]; }));
    var writes = [], P = Storage.prototype, o = { s: P.setItem, r: P.removeItem, c: P.clear };
    P.setItem = function (k) { writes.push('set ' + k); return o.s.apply(this, arguments); };
    P.removeItem = function (k) { writes.push('remove ' + k); return o.r.apply(this, arguments); };
    P.clear = function () { writes.push('clear'); return o.c.apply(this, arguments); };
    var abs0 = AS.abs, len0 = AS.abs.length, home0 = (T.$('tHome') || {}).value, upd0 = window.updateAll, updated = 0, reqs0 = srv.log.length;
    window.updateAll = function () { updated++; return upd0.apply(this, arguments); };
    try {
      document.querySelector('#teamGamesModal .tg-row').click();
      await sleep(400);
      var m = modal(), c = m.querySelector('.tg-spray');
      ok(c && c.width > 0 && inked(c), '스프레이 차트가 그려지지 않음');
      ok(m.textContent.indexOf('우리팀 vs 상대A') >= 0 && m.textContent.indexOf('읽기 전용') >= 0, '제목 · 읽기 전용 표시');
      var trs = m.querySelectorAll('.tg-tbl tbody tr');
      eq(trs.length, 5, '기록 행 수(내 팀 타석만)');
      ok(trs[3].textContent.indexOf('박타자') >= 0 && trs[3].textContent.indexOf('3회초') >= 0 && trs[3].textContent.indexOf('홈런') >= 0, '기록 내용: ' + trs[3].textContent);
      ok(m.textContent.indexOf('상대타자') < 0, '상대 타석이 섞임');
      eq(writes, [], 'localStorage 쓰기');
      eq(updated, 0, 'updateAll(자동저장 · 클라우드 업로드를 부르는 길) 호출');
      eq(srv.log.length, reqs0, '경기를 여는 동안 서버 요청');
      m.querySelector('.tg-back').click(); await sleep(50);
      eq(rows().length, 1, '← 목록으로 돌아옴');
    } finally { P.setItem = o.s; P.removeItem = o.r; P.clear = o.c; window.updateAll = upd0; }
    eq(JSON.stringify(Object.keys(localStorage).sort().map(function (k) { return [k, localStorage.getItem(k)]; })), snap, 'localStorage 내용이 바뀜');
    ok(AS.abs === abs0 && AS.abs.length === len0, '앱의 현재 경기(AS.abs)가 바뀜');
    eq((T.$('tHome') || {}).value, home0, '앱의 팀 이름 입력칸이 바뀜');
  });

  // ── 보안 ──
  test('이름 · 팀 · 상대 · 타자에 <script> · <img onerror> 가 있어도 실행되지 않고 글자 그대로 보인다', async function () {
    var IMG = '<img src=x onerror="window.__xss=1">', SCR = '<script>window.__xss=1</script>', SVG = '<svg onload="window.__xss=1">';
    delete window.__xss;
    var evil = row('user-' + IMG, 2, {
      th: SCR, ta: IMG, date: SCR,
      abs: [ab(SVG, IMG, 'home', { inn: SCR, bnum: IMG })]
    });
    await login('owner', [evil], IMG, [{ user_id: 'user-' + IMG, display_name: IMG + SCR }]);   // 팀 이름 · 팀원 이름도 같은 값
    await openList();
    await sleep(100);
    var m = modal();
    ok(m.textContent.indexOf('<img src=x') >= 0, '목록에 글자 그대로 보여야 함: ' + m.textContent);
    document.querySelector('#teamGamesModal .tg-row').click(); await sleep(300);
    ok(m.textContent.indexOf('<svg onload') >= 0 && m.textContent.indexOf('<script>') >= 0, '기록에 글자 그대로 보여야 함');
    ok(m.querySelector('.tg-sub').textContent.indexOf('<img src=x') === 0, '상세의 팀원 이름이 글자 그대로 보여야 함: ' + m.querySelector('.tg-sub').textContent);
    // 실시간으로 들어온 행도 같은 길로 그린다 — 이름을 새로 조회하는 경로(목록을 연 뒤 가입한 팀원)도 포함
    m.querySelector('.tg-back').click();
    srv.team_members.push({ team_id: 'T1', user_id: 'user-late', display_name: SVG + SCR });
    insertCb().cb({ new: row('user-' + IMG, 3, { th: SCR, ta: IMG }) });
    insertCb().cb({ new: row('user-late', 4, { th: SCR, ta: IMG }) }); await sleep(100);
    ok(m.textContent.indexOf('<svg onload') >= 0, '재조회한 이름이 글자 그대로 보여야 함');
    eq(m.querySelectorAll('img, script, svg, iframe, [onerror], [onload]').length, 0, '창 안에 태그가 만들어짐');
    eq(window.__xss, undefined, '스크립트가 실행됨');
    delete window.__xss;
  });

  // ── 정리 ──
  test('로그아웃하면 팀 경기 창이 닫히고, 다시 로그인해 열면 서버에서 새로 가져온 목록만 보인다', async function () {
    await login('owner', [row('user-aaaa-1111', 2)]);
    await openList();
    insertCb().cb({ new: row('user-zzzz-9999', 5, { min: 20 }) }); await sleep(50);
    eq(rows().length, 2, '로그아웃 전 행 수');
    srv.signOut(); await sleep(600);
    ok(!modal().classList.contains('show'), '로그아웃 뒤에도 창이 열려 있음');
    srv.user_games = [row('user-aaaa-1111', 2)]; srv.signIn(); await sleep(1500);
    await openList();
    eq(rows().length, 1, '다시 연 뒤 행 수(옛 NEW 가 남지 않음)');
    ok(rows()[0].indexOf('NEW') < 0, 'NEW 가 남아 있음');
    modal().querySelector('.tg-x').click();
  });
})();
