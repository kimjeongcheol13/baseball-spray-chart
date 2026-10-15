// 공유 링크의 경기 정보 — 날짜 · 구장(이름) · 홈/원정 · 이닝 수 · 이닝별 득점(info.ls, 게임원 가져오기 · 기록 화면 라인스코어)
//  · 보내는 쪽(core.js _shareGameBuild)은 경기 정보 중 이 다섯만 싣는다(구장 크기는 싣지 않음) — 서버 링크(?gid=) · 서버 저장이 안 될 때의 URL 링크(?game=) 둘 다
//  · 다섯 다 없는 경기는 예전과 같은 모양(payload 에 info 키 없음)
//  · 받는 쪽(_restoreInfoFromPayload · _restoreLsFromPayload)은 걸러 받는다 — 이닝 칸은 0~99 정수 · 'X' 만 (링크는 누가 만들었는지 모른다)
//  · 받은 경기를 열면 분석 탭 경기 요약에 그 날짜 · 구장이(예전엔 연 날의 날짜), 기록 화면 라인스코어 이닝 칸에 이닝별 득점이 보이고,
//    라인스코어 줄 순서(내 팀이 원정이면 내 팀이 위) · 칸 수(5 · 7 · 9회)가 보낸 쪽과 같다
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
  function setUp(info) {
    saved = { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, p: AS.pitchers, zh: AS.zoneHistory, hs: AS.hs, as: AS.as, info: AS.info, ap: $('app-page').style.display,
      th: $('tHome').value, ta: $('tAway').value, url: location.pathname + location.search + location.hash, sp: window._sharedPayload };
    AS.abs = [{ id: 1790000000000, bid: 'h1', bname: '김민수', bnum: '7', team: 'home', res: '안타', pt: null, zone: null, rbi: 0,
      x: 0.3, y: 0.5, deg: 60, dir: 'LC', ft: 200, inn: '1회말', ts: '', pitches: [] }];
    AS.home_lineup = [{ id: 'h1', name: '김민수', num: '7', pos: '', bh: '' }]; AS.away_lineup = []; AS.pitchers = []; AS.zoneHistory = {};
    AS.hs = 1; AS.as = 8; AS.info = info;
    $('tHome').value = '우리팀'; $('tAway').value = '상대팀';
    srv.shared_links = [];
  }
  function tearDown() {
    try { closeShareQR(); } catch (e) {}
    AS.abs = saved.abs; AS.home_lineup = saved.hl; AS.away_lineup = saved.al; AS.pitchers = saved.p; AS.zoneHistory = saved.zh; AS.hs = saved.hs; AS.as = saved.as; AS.info = saved.info;
    $('tHome').value = saved.th; $('tAway').value = saved.ta; $('app-page').style.display = saved.ap;
    window._sharedPayload = saved.sp; history.replaceState(null, '', saved.url);
    try { dismissSharedBanner(); } catch (e) {}
    srv.shared_links = [];
  }
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

  test('경기 정보 중 다섯 가지만 싣는다 — 구장 크기는 빼고, 구장 이름은 다듬고, 쓸 수 없는 홈/원정 · 이닝 수는 빼고', async function () {
    setUp({ date: '2026-10-07', venue: '  안성맞춤야구장  ', side: 'away', innings: 7, stadium: 'jamsil' });
    try {
      await share();
      eq(srv.shared_links[0].payload.info, { date: '2026-10-07', venue: '안성맞춤야구장', side: 'away', innings: 7 }, '구장 크기 제외 · 구장 이름 앞뒤 공백 정리');
    } finally { tearDown(); }
    setUp({ venue: new Array(31).join('가'), side: 'zzz', innings: 8 });
    try {
      await share();
      eq(srv.shared_links[0].payload.info, { venue: new Array(21).join('가') }, '구장 이름 20자까지 · 홈/원정은 home/away 만 · 이닝 수는 5 · 7 · 9 만 (경기설정 탭 입력 제약과 같음)');
    } finally { tearDown(); }
  });

  test('다섯 다 없는 경기는 예전과 같은 모양 — payload 에 info 키가 없다', async function () {
    setUp({ venue: '   ', side: 'zzz', innings: 8, stadium: 'jamsil' });
    try {
      await share();
      ok(!('info' in srv.shared_links[0].payload), '빈 구장 · 쓸 수 없는 값 · 구장 크기만 있으면 싣지 않음: ' + JSON.stringify(srv.shared_links[0].payload.info));
    } finally { tearDown(); }
    setUp(null);
    try {
      await share();
      ok(!('info' in srv.shared_links[0].payload), '경기 정보가 없으면 싣지 않음');
    } finally { tearDown(); }
  });
})();
