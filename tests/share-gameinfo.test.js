// 공유 링크의 경기 정보 — 날짜 · 구장(이름) · 홈/원정 · 이닝 수 · 구장 크기 · 이닝별 득점(info.ls, 게임원 가져오기 · 기록 화면 라인스코어)
//  · 보내는 쪽(core.js _shareGameBuild)은 경기 정보 중 이 여섯만 싣는다 — 서버 링크(?gid=) · 서버 저장이 안 될 때의 URL 링크(?game=) 둘 다
//    구장 크기는 경기별 구장(info.stadium), 없으면 지금 보는 구장(AS.stadium) — 직접 입력(custom)이면 지금 직접 입력 거리(info.dist)를 함께 싣는다
//  · 여섯 다 없는 경기는 예전과 같은 모양(payload 에 info 키 없음)
//  · 받는 쪽(_restoreInfoFromPayload · _restoreLsFromPayload)은 걸러 받는다 — 이닝 칸은 0~99 정수 · 'X' 만 (링크는 누가 만들었는지 모른다)
//  · 받은 경기를 열면 분석 탭 경기 요약에 그 날짜 · 구장이(예전엔 연 날의 날짜), 기록 화면 라인스코어 이닝 칸에 이닝별 득점이 보이고,
//    라인스코어 줄 순서(내 팀이 원정이면 내 팀이 위) · 칸 수(5 · 7 · 9회)가 보낸 쪽과 같고, 구장 크기는 내 경기를 열 때처럼 그 구장으로 바뀐다(setup.js)
//    직접 입력이면 받는 기기의 직접 입력 거리를 보낸 값으로 바꾸고 알린다(기기마다 하나뿐이라 덮어씀)
// 서버는 tests/stub-supabase.js 의 메모리 shared_links 표
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var srv = window.__srv;
  var LS = { away: [2, 1, 0, 5, 0, 0, 0, 0, 0], home: [0, 0, 1, 0, 0, 0, 0, 0, 'X'] };

  async function waitFor(cond, ms, what) {
    for (var t = 0; t < (ms || 2000); t += 20) { if (cond()) return; await sleep(20); }
    throw new Error('시간 안에 되지 않음: ' + (what || ''));
  }
  async function openLink(url) {   // share-privacy.test.js 와 같은 방식: 링크를 연 새 탭처럼 ?gid= / ?game= 을 읽어 _sharedPayload 를 돌려준다
    url = url.replace(/\?game=(.*)$/, function (m, v) { return '?game=' + encodeURIComponent(v); });
    var u = new URL(url);
    history.replaceState(null, '', u.pathname + u.search);
    window._sharedPayload = undefined;
    _loadSharedGame();
    await waitFor(function () { return window._sharedPayload; }, 2000, '공유 payload 로딩');
    return window._sharedPayload;
  }
  var saved = null;
  function setUp(info, stadium) {
    var cs = STADIUMS.custom;
    saved = { st: AS.stadium, sls: localStorage.getItem('sl_stadium'), csl: localStorage.getItem('sl_stadium_custom'), cs: [cs.lfDist, cs.cfDist, cs.rfDist], abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, p: AS.pitchers, zh: AS.zoneHistory, hs: AS.hs, as: AS.as, info: AS.info, ap: $('app-page').style.display,
      th: $('tHome').value, ta: $('tAway').value, url: location.pathname + location.search + location.hash, sp: window._sharedPayload };
    AS.abs = [{ id: 1790000000000, bid: 'h1', bname: '김민수', bnum: '7', team: 'home', res: '안타', pt: null, zone: null, rbi: 0,
      x: 0.3, y: 0.5, deg: 60, dir: 'LC', ft: 200, inn: '1회말', ts: '', pitches: [] }];
    AS.home_lineup = [{ id: 'h1', name: '김민수', num: '7', pos: '', bh: '' }]; AS.away_lineup = []; AS.pitchers = []; AS.zoneHistory = {};
    AS.hs = 1; AS.as = 8; AS.info = info; AS.stadium = stadium || '';   // 기본: 어떤 구장도 싣지 않는 값 — 구장 크기를 보지 않는 테스트의 기대값은 구장 없이
    localStorage.setItem('sl_stadium', AS.stadium);   // 지금 구장 설정도 같게 (새 사용자로 뜬 하네스는 시작할 때 리틀로 저장해 둔다 — setup.js _defaultStadium)
    $('tHome').value = '우리팀'; $('tAway').value = '상대팀';
    srv.shared_links = [];
  }
  function tearDown() {
    try { closeShareQR(); } catch (e) {}
    AS.abs = saved.abs; AS.home_lineup = saved.hl; AS.away_lineup = saved.al; AS.pitchers = saved.p; AS.zoneHistory = saved.zh; AS.hs = saved.hs; AS.as = saved.as; AS.info = saved.info;
    AS.stadium = saved.st; if (saved.sls == null) localStorage.removeItem('sl_stadium'); else localStorage.setItem('sl_stadium', saved.sls);
    if (saved.csl == null) localStorage.removeItem('sl_stadium_custom'); else localStorage.setItem('sl_stadium_custom', saved.csl);
    setCustom(saved.cs[0], saved.cs[1], saved.cs[2]);
    $('tHome').value = saved.th; $('tAway').value = saved.ta; $('app-page').style.display = saved.ap;
    window._sharedPayload = saved.sp; history.replaceState(null, '', saved.url);
    try { dismissSharedBanner(); } catch (e) {}
    srv.shared_links = [];
  }
  function setCustom(lf, cf, rf) { var c = STADIUMS.custom; c.lfDist = lf; c.cfDist = cf; c.rfDist = rf; }   // 이 기기의 직접 입력 거리(화면) — 저장값은 sl_stadium_custom
  async function share() { shareGameLink(); await waitFor(function () { return $('shareQROv').classList.contains('show') && /\?(gid|game)=/.test($('shareQRUrl').textContent); }, 2000, '공유 모달 · 링크'); }
  function lsCells(i) {   // 기록 화면 라인스코어 i번째 줄: [팀, 이닝 칸…, R]
    var tr = document.querySelectorAll('#sbHdrMid .sb-ls tbody tr')[i], td = tr ? tr.querySelectorAll('td') : [];
    var inn = Array.prototype.slice.call(td, 0, td.length - 3).map(function (c) { return c.textContent; });
    return [tr ? tr.querySelector('th').textContent : null].concat(inn, [td.length ? td[td.length - 3].textContent : null]);
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () { await sleep(2500); eq(typeof _restoreLsFromPayload, 'function', '받는 쪽 거르기 함수'); });

  test('받는 쪽: 이닝 칸은 0~99 정수 · X 만, 나머지는 빈칸 · 30이닝까지 · 끝 빈칸 자름 · 두 팀 다 비면 버림', function () {
    eq(_restoreInfoFromPayload({ ls: LS }), { ls: LS }, '정상 값 그대로');
    eq(_restoreInfoFromPayload({ ls: { away: [2, '<img src=x onerror=1>', -1, 1.5, 100, '3', { a: 1 }, 4, null, null], home: ['X', 'x', 0] } }),
      { ls: { away: [2, null, null, null, null, null, null, 4], home: ['X', null, 0] } }, '쓸 수 없는 값은 빈칸, 끝 빈칸은 자름');
    var many = []; for (var i = 0; i < 40; i++) many.push(1);
    eq(_restoreInfoFromPayload({ ls: { away: many, home: [] } }).ls.away.length, 30, '30이닝까지');
    eq(_restoreInfoFromPayload({ ls: { away: 'x', home: { 0: 1 } } }), null, '배열이 아니면 그 팀은 빈칸 → 둘 다 비면 버림');
    eq(_restoreInfoFromPayload({ ls: [[1], [2]] }), null, '객체가 아닌 ls');
    eq(_restoreInfoFromPayload({ ls: { away: [null, null], home: [] } }), null, '빈칸뿐');
    eq(_restoreInfoFromPayload({ innings: 7, ls: { away: [1], home: [] } }), { innings: 7, ls: { away: [1], home: [] } }, '다른 경기 정보와 함께');
  });

  test('받는 쪽: 구장 크기는 고정 구장(표준 · 고척 · 잠실 · 지방 · 리틀)만 — 직접 입력 · 모르는 값은 버림', function () {
    eq(['standard', 'gochuk', 'jamsil', 'local', 'little'].map(function (id) { return _restoreInfoFromPayload({ stadium: id }); }),
      ['standard', 'gochuk', 'jamsil', 'local', 'little'].map(function (id) { return { stadium: id }; }), '고정 구장');
    eq([_restoreInfoFromPayload({ stadium: '__proto__' }), _restoreInfoFromPayload({ stadium: ['jamsil'] }), _restoreInfoFromPayload({ stadium: 'toString' })],
      [null, null, null], '객체 속성 이름 · 배열 · 모르는 값');
  });

  test('받는 쪽: 직접 입력은 거리(30~200m 정수, 좌 · 중 · 우 셋 다)가 맞을 때만 받는다', function () {
    eq(_restoreInfoFromPayload({ stadium: 'custom', dist: { lf: 85, cf: 110, rf: 85, x: 1 } }), { stadium: 'custom', dist: { lf: 85, cf: 110, rf: 85 } }, '정상 거리(다른 키는 버림)');
    eq([_restoreInfoFromPayload({ stadium: 'custom' }), _restoreInfoFromPayload({ stadium: 'custom', dist: { lf: 85, cf: 110 } }),
      _restoreInfoFromPayload({ stadium: 'custom', dist: { lf: 29, cf: 110, rf: 85 } }), _restoreInfoFromPayload({ stadium: 'custom', dist: { lf: 85, cf: 201, rf: 85 } }),
      _restoreInfoFromPayload({ stadium: 'custom', dist: { lf: 85.5, cf: 110, rf: 85 } }), _restoreInfoFromPayload({ stadium: 'custom', dist: { lf: '85', cf: 110, rf: 85 } }),
      _restoreInfoFromPayload({ stadium: 'custom', dist: [85, 110, 85] })], [null, null, null, null, null, null, null], '거리 없음 · 하나 빠짐 · 범위 밖 · 소수 · 문자열 · 배열 → 구장 크기를 받지 않음');
    eq(_restoreInfoFromPayload({ stadium: 'jamsil', dist: { lf: 85, cf: 110, rf: 85 } }), { stadium: 'jamsil' }, '고정 구장에 붙은 거리는 버림');
  });

  test('서버 링크(?gid=): 날짜 · 구장 · 홈/원정 · 이닝 수 · 이닝별 득점이 실려 가고, 받아서 열면 분석 탭 요약 · 라인스코어에 보인다', async function () {
    var INFO = { date: '2026-10-07', venue: '안성맞춤야구장', side: 'home', innings: 9, ls: LS };
    setUp(INFO);
    try {
      await share();
      eq(srv.shared_links.length, 1, 'shared_links 에 1건');
      eq(srv.shared_links[0].payload.info, INFO, '서버에 저장된 payload 의 경기 정보');
      var url = $('shareQRUrl').textContent;
      ok(/\?gid=/.test(url), '서버 링크: ' + url);
      var p = await openLink(url);
      eq(p.info, INFO, '링크로 받은 payload');
      loadSharedGame();
      await waitFor(function () { return AS.info && AS.info.ls; }, 2000, '공유 경기 열기');
      eq(AS.info, INFO, '연 경기의 경기 정보');
      eq([gameInfo().date, gameInfo().venue, gameInfo().side, gameInfo().innings], ['2026-10-07', '안성맞춤야구장', 'home', 9], '경기설정 탭에 보이는 날짜 · 구장 · 홈/원정 · 이닝 수');
      window.openAnaDash();
      var meta = document.querySelector('.ad-meta');
      ok(meta && meta.textContent.indexOf('2026. 10. 7. · 안성맞춤야구장 · 우리팀 vs 상대팀') === 0, '분석 탭 경기 요약: ' + (meta && meta.textContent));
      window.sbRenderNow();   // 라인스코어는 rAF 로 다시 그린다 — 가상 시간 하네스에서는 바로 그리기로 (gameone-import.test.js 와 같은 이유)
      eq(lsCells(0), ['상대팀', '2', '1', '0', '5', '0', '0', '0', '0', '0', '8'], '라인스코어 윗줄(원정)');
      eq(lsCells(1), ['우리팀', '0', '0', '1', '0', '0', '0', '0', '0', 'X', '1'], '라인스코어 아랫줄(홈) · 9회말 X');
    } finally { tearDown(); }
  });

  test('서버 저장이 안 될 때의 URL 링크(?game=)에도 날짜 · 구장 · 홈/원정 · 이닝 수 · 이닝별 득점이 실린다', async function () {
    var INFO = { date: '2026-10-07', venue: '안성맞춤야구장', side: 'away', innings: 7, ls: LS };
    setUp(INFO);
    var push = window.pushSharedLink;
    try {
      window.pushSharedLink = function (payload, okCb, failCb) { failCb('offline'); };
      await share();
      var url = $('shareQRUrl').textContent;
      ok(/\?game=/.test(url), 'URL 링크: ' + url.slice(0, 60));
      eq((await openLink(url)).info, INFO, '링크 안의 데이터');
    } finally { window.pushSharedLink = push; tearDown(); }
  });

  test('내 팀이 원정 · 7회 경기: 받은 경기의 라인스코어도 내 팀이 위 · 7칸 (예전엔 상대가 위 · 9칸)', async function () {
    setUp({ side: 'away', innings: 7 });
    try {
      await share();
      eq(srv.shared_links[0].payload.info, { side: 'away', innings: 7 }, '서버에 저장된 경기 정보');
      await openLink($('shareQRUrl').textContent);
      loadSharedGame();
      await waitFor(function () { return AS.info && AS.info.side === 'away'; }, 2000, '공유 경기 열기');
      eq([gameInfo().side, gameInfo().innings], ['away', 7], '경기설정 탭에 보이는 홈/원정 · 이닝 수');
      window.sbRenderNow();
      var top = lsCells(0), bottom = lsCells(1);
      eq([top[0], top[top.length - 1], bottom[0], bottom[bottom.length - 1]], ['우리팀', '1', '상대팀', '8'], '라인스코어 줄 순서: 내 팀(원정)이 위');
      eq(top.length - 2, 7, '라인스코어 이닝 칸 7개');
    } finally { tearDown(); }
  });

  test('구장 크기: 경기별 구장(잠실)이 실려 가고, 받아서 열면 내 경기를 열 때처럼 그 구장으로 — 지금 구장 설정도 바뀐다', async function () {
    setUp({ stadium: 'jamsil' }, 'standard');
    try {
      await share();
      eq(srv.shared_links[0].payload.info, { stadium: 'jamsil' }, '서버에 저장된 경기 정보');
      await openLink($('shareQRUrl').textContent);
      eq([AS.stadium, localStorage.getItem('sl_stadium')], ['standard', 'standard'], '전제: 받는 쪽은 지금 표준 구장');
      loadSharedGame();
      await waitFor(function () { return AS.info && AS.info.stadium === 'jamsil'; }, 2000, '공유 경기 열기');
      eq([AS.stadium, localStorage.getItem('sl_stadium')], ['jamsil', 'jamsil'], '받는 쪽 구장(필드 펜스 · 추정 비거리)과 지금 구장 설정');
    } finally { tearDown(); }
  });

  test('구장 크기: 경기별 구장이 없으면(이 기능 전 경기) 지금 보는 구장을 싣는다', async function () {
    setUp({ date: '2026-10-07' }, 'little');
    try {
      await share();
      eq(srv.shared_links[0].payload.info, { date: '2026-10-07', stadium: 'little' }, '리틀');
    } finally { tearDown(); }
  });

  test('직접 입력: 거리까지 실려 가고, 받으면 받는 기기의 직접 입력 거리를 그 값으로 바꾸고 알린다(공유 경기를 연 안내 뒤에 이어서)', async function () {
    setUp({ date: '2026-10-07', stadium: 'custom' }, 'custom');
    setCustom(85, 110, 85);   // 보내는 기기의 직접 입력 거리
    try {
      await share();
      eq(srv.shared_links[0].payload.info, { date: '2026-10-07', stadium: 'custom', dist: { lf: 85, cf: 110, rf: 85 } }, '서버에 저장된 경기 정보');
      await openLink($('shareQRUrl').textContent);
      // 받는 기기: 고척 구장 · 직접 입력 거리 100 · 130 · 100
      AS.stadium = 'gochuk'; localStorage.setItem('sl_stadium', 'gochuk');
      localStorage.setItem('sl_stadium_custom', JSON.stringify({ lf: 100, cf: 130, rf: 100 })); setCustom(100, 130, 100);
      loadSharedGame();
      await waitFor(function () { return AS.info && AS.info.stadium === 'custom'; }, 2000, '공유 경기 열기');
      eq([AS.stadium, localStorage.getItem('sl_stadium')], ['custom', 'custom'], '받는 쪽 구장 · 구장 설정 = 직접 입력');
      eq(JSON.parse(localStorage.getItem('sl_stadium_custom')), { lf: 85, cf: 110, rf: 85 }, '받는 기기의 직접 입력 거리(저장값)');
      eq([STADIUMS.custom.lfDist, STADIUMS.custom.cfDist, STADIUMS.custom.rfDist], [85, 110, 85], '필드 펜스 · 추정 비거리에 쓰는 거리');
      // 공유 경기를 연 안내는 loadSharedGame 이 500ms 뒤에 띄운다 — 거리 알림은 그 뒤에 이어 붙어야 한다(먼저 띄우면 그 안내에 덮여 사라진다)
      await waitFor(function () { return $('toastTxt').textContent.indexOf('직접 입력 구장 거리') >= 0; }, 2000, '거리 알림');
      await sleep(300);   // 알림 뒤에 다른 안내가 덮어쓰지 않는지
      var msg = $('toastTxt').textContent;
      ok(/^공유받은 경기를 열었어요|^공유 데이터 v/.test(msg), '공유 경기를 연 안내가 앞에 남음: ' + msg);
      ok(msg.indexOf('직접 입력 구장 거리를 좌 85 · 중 110 · 우 85m로 바꿨어요') > 0, '거리를 바꾼 알림: ' + msg);
    } finally { tearDown(); }
  });

  test('직접 입력: 받는 기기가 이미 같은 거리면 바꾸지도 알리지도 않는다', async function () {
    setUp({ stadium: 'custom' }, 'custom');
    setCustom(85, 110, 85);
    try {
      await share();
      await openLink($('shareQRUrl').textContent);
      localStorage.setItem('sl_stadium_custom', JSON.stringify({ lf: 85, cf: 110, rf: 85 }));
      loadSharedGame();
      await waitFor(function () { return AS.info && AS.info.stadium === 'custom'; }, 2000, '공유 경기 열기');
      eq(AS.stadium, 'custom', '구장');
      await sleep(900);   // 공유 경기 안내(500ms) · 거리 알림(600ms)이 뜰 시간이 지난 뒤
      ok($('toastTxt').textContent.indexOf('직접 입력 구장 거리') < 0, '알림 없음: ' + $('toastTxt').textContent);
    } finally { tearDown(); }
  });

  test('구장 크기가 없는 링크(예전 링크 · 쓸 수 없는 값)는 받는 쪽 구장 · 직접 입력 거리 그대로', async function () {
    setUp({ date: '2026-10-07' });
    try {
      await share();
      eq(srv.shared_links[0].payload.info, { date: '2026-10-07' }, '구장 크기 없음');
      await openLink($('shareQRUrl').textContent);
      AS.stadium = 'gochuk'; localStorage.setItem('sl_stadium', 'gochuk');
      localStorage.setItem('sl_stadium_custom', JSON.stringify({ lf: 100, cf: 130, rf: 100 }));
      loadSharedGame();
      await waitFor(function () { return AS.info && AS.info.date === '2026-10-07'; }, 2000, '공유 경기 열기');
      eq([AS.stadium, localStorage.getItem('sl_stadium'), localStorage.getItem('sl_stadium_custom')], ['gochuk', 'gochuk', JSON.stringify({ lf: 100, cf: 130, rf: 100 })], '그대로');
    } finally { tearDown(); }
  });

  test('쓸 수 있는 값만 싣는다 — 구장 이름은 다듬고, 쓸 수 없는 홈/원정 · 이닝 수 · 구장 크기는 빼고', async function () {
    setUp({ date: '2026-10-07', venue: '  안성맞춤야구장  ', side: 'away', innings: 7, stadium: 'jamsil' });
    try {
      await share();
      eq(srv.shared_links[0].payload.info, { date: '2026-10-07', venue: '안성맞춤야구장', side: 'away', innings: 7, stadium: 'jamsil' }, '구장 이름 앞뒤 공백 정리');
    } finally { tearDown(); }
    setUp({ venue: new Array(31).join('가'), side: 'zzz', innings: 8, stadium: 'zzz' });
    try {
      await share();
      eq(srv.shared_links[0].payload.info, { venue: new Array(21).join('가') }, '구장 이름 20자까지 · 홈/원정은 home/away 만 · 이닝 수는 5 · 7 · 9 만 · 구장 크기는 고정 구장만 (경기설정 탭 입력 제약과 같음)');
    } finally { tearDown(); }
  });

  test('여섯 다 없는 경기는 예전과 같은 모양 — payload 에 info 키가 없다', async function () {
    setUp({ venue: '   ', side: 'zzz', innings: 8, stadium: 'zzz' });
    try {
      await share();
      ok(!('info' in srv.shared_links[0].payload), '빈 구장 이름 · 쓸 수 없는 값만 있으면 싣지 않음: ' + JSON.stringify(srv.shared_links[0].payload.info));
    } finally { tearDown(); }
    setUp({ stadium: 'custom' }, 'custom');
    setCustom(10, 110, 85);   // 직접 입력 거리가 범위 밖(경기설정 탭에서는 못 만드는 값)이면 직접 입력도 싣지 않음
    try {
      await share();
      ok(!('info' in srv.shared_links[0].payload), '쓸 수 없는 직접 입력 거리: ' + JSON.stringify(srv.shared_links[0].payload.info));
    } finally { tearDown(); }
    setUp(null);
    try {
      await share();
      ok(!('info' in srv.shared_links[0].payload), '경기 정보도 구장도 없으면 싣지 않음');
    } finally { tearDown(); }
  });
})();
