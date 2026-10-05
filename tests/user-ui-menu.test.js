// 메뉴 정리 검증 — 실제 index.html · js 를 가짜 서버에 붙여 돌린다(외부 요청 0건).
//  · "팀 만들기"(그 밖의 기능 타일 · 경기설정 탭 버튼)는 이 기기 전용 로컬 팀(openTeamCreate)이 아니라 클라우드 팀(내 계정 → 팀)으로 간다
// 파일 이름순으로 user-teams 뒤에 돈다. 각 테스트는 로그아웃부터 시작해 앞선 로그인·팀 상태와 열린 창을 지운다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;

  async function fresh(loggedIn) {
    await sleep(2000);
    srv.signOut(); await sleep(1000);
    srv.reset(); localStorage.clear();
    if (loggedIn) { srv.signIn(); await sleep(1500); }
    srv.log.length = 0;
    ['profileModal', 'loginModal'].forEach(function (id) { T.$(id).classList.remove('show'); });
    T.$('teamCreateModal').classList.remove('on');
  }
  function visible(el) { return !!el && el.offsetWidth > 0 && el.offsetHeight > 0; }
  // 같은 기능의 두 진입점: 그 밖의 기능 타일(#stMore · setup.js) / 경기설정 탭의 옛 버튼(index.html, body.sb 에서는 숨김이지만 DOM 에 있다)
  function entry(which, fn) {
    if (!T.$('stMore') || !T.$('stMore').innerHTML) window.renderSetup();
    var el = document.querySelector(which === 'tile' ? '#stMore .st-more-b[onclick*="' + fn + '"]' : '#settingsView .set-btn[onclick*="' + fn + '"]');
    ok(el, (which === 'tile' ? '그 밖의 기능 타일' : '경기설정 탭 버튼') + ' 없음: ' + fn);
    return el;
  }

  // ── [1] 팀 만들기 → 클라우드 팀 ──
  test('팀 만들기(로그인): 두 진입점 모두 내 계정 창의 팀 영역을 열고 teamCreateModal 은 열지 않는다', async function () {
    var calls = 0, orig = window.openTeamCreate;
    window.openTeamCreate = function () { calls++; return orig.apply(this, arguments); };
    try {
      for (var w of ['tile', 'old']) {
        await fresh(true);
        entry(w, 'openTeamShare').click(); await sleep(100);
        ok(T.$('profileModal').classList.contains('show'), w + ': 내 계정 창이 안 열림');
        ok(T.$('teamSection').querySelector('.team-actions'), w + ': 팀 영역(팀 만들기 · 코드로 참가 버튼)이 안 그려짐');
        ok(!T.$('teamCreateModal').classList.contains('on'), w + ': 로컬 팀 만들기 창이 열림');
        ok(!T.$('loginModal').classList.contains('show'), w + ': 로그인 창이 열림');
      }
      eq(calls, 0, 'openTeamCreate 호출');
    } finally { window.openTeamCreate = orig; }
  });
  test('팀 만들기(비로그인): 두 진입점 모두 "팀 공유는 로그인이 필요해요" 안내와 로그인 버튼을 보여주고 서버 요청은 0건', async function () {
    for (var w of ['tile', 'old']) {
      await fresh(false);
      var net0 = window.__netAttempts.length;
      entry(w, 'openTeamShare').click(); await sleep(300);
      ok(T.$('loginModal').classList.contains('show'), w + ': 로그인 창이 안 열림');
      ok(visible(T.$('loginTeamHint')), w + ': 안내가 안 보임');
      eq(T.$('loginTeamHint').textContent, '팀 공유는 로그인이 필요해요', w + ': 안내 문구');
      ok(visible(T.$('loginModal').querySelector('.btn-google')), w + ': 로그인 버튼이 안 보임');
      ok(!T.$('profileModal').classList.contains('show'), w + ': 내 계정 창이 열림');
      ok(!T.$('teamCreateModal').classList.contains('on'), w + ': 로컬 팀 만들기 창이 열림');
      eq(srv.log, [], w + ': 서버 요청');
      eq(window.__netAttempts.length, net0, w + ': 외부 요청 시도');
    }
  });
  test('로그인 창을 일반 경로(openLoginModal)로 열면 팀 공유 안내는 숨는다', async function () {
    await fresh(false);
    entry('tile', 'openTeamShare').click(); await sleep(100);
    ok(visible(T.$('loginTeamHint')), '팀 공유 진입에서는 안내가 보여야 함');
    T.$('loginModal').classList.remove('show');
    openLoginModal(); await sleep(100);
    ok(T.$('loginModal').classList.contains('show'), '로그인 창이 안 열림');
    ok(!visible(T.$('loginTeamHint')), '일반 로그인에 팀 안내가 남아 있음');
  });
  test('팀 만들기 문구: 타일은 "팀원과 기록 공유 · 로그인 필요", 두 진입점 어디서도 openTeamCreate 를 부르지 않는다', async function () {
    var tile = entry('tile', 'openTeamShare');
    eq(tile.querySelector('small').textContent, '팀원과 기록 공유 · 로그인 필요', '타일 설명');
    eq(document.querySelectorAll('#stMore [onclick*="openTeamCreate"], #settingsView [onclick*="openTeamCreate"]').length, 0, 'openTeamCreate 를 부르는 진입점');
  });
  test('이 기기 팀 기록: 로컬 팀(_TD) 데이터는 그대로 두고, 진입점(분석 → 팀)은 공유를 약속하지 않는 이름으로 남는다', async function () {
    await fresh(true);
    var tds = JSON.stringify({ teams: [{ id: 't1', name: '기존팀', color: '#4b8cf5', stadium: '', createdAt: '2026. 5. 1.', games: [] }], activeTeamId: 't1' });
    localStorage.setItem('sl_teams', tds);
    entry('tile', 'openTeamShare').click(); await sleep(100);
    entry('old', 'openTeamShare').click(); await sleep(100);
    eq(localStorage.getItem('sl_teams'), tds, 'sl_teams');
    window.openTeamView(); await sleep(300);
    var b = document.querySelector('#teamContent .tm-act[onclick="openTeamCreate()"]');
    ok(b, '분석 → 팀의 로컬 팀 진입 버튼이 없음');
    ok(/이 기기/.test(b.textContent) && !/공유/.test(b.textContent), '버튼 이름이 "이 기기"가 아님/공유를 약속함: ' + b.textContent);
    ok(/이 기기/.test(document.querySelector('#teamCreateModal .tcm-title').textContent), '로컬 팀 만들기 창 제목');
  });
  test('id 중복 0: 이번에 추가한 요소의 id 는 문서 전체에서 유일하다', async function () {
    ['loginTeamHint'].forEach(function (id) { eq(document.querySelectorAll('[id="' + id + '"]').length, 1, 'id 중복: ' + id); });
  });
})();
