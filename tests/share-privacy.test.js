// 공유 링크(?gid= · ?game=)의 선수 실명 보호 — 기본은 실명을 "#등번호" / "성OO" 로 치환해서 내보내고,
// 공유 모달의 "선수 실명 포함" 체크박스를 켜야만 실명 그대로 나간다. 받는 쪽은 치환된 데이터로도 같은 통계 · 스프레이 데이터를 만든다.
// 서버는 tests/stub-supabase.js 의 메모리 shared_links 표 + get_shared_link RPC (실제 SQL 은 sql/05)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var srv = window.__srv;
  var NAMES = ['김민수', '박지훈', '김도윤', '김서준', '이강인', '최민준', '정우영', '한동민'];

  function ab(i, bid, bn, bno, team, res, x, y, deg, inn) {
    return { id: 1000 + i, bid: bid, bname: bn, bnum: bno, bats: 'R', team: team, res: res, pt: '직구', zone: '중앙 중간', rbi: res === '홈런' ? 1 : 0,
      x: x, y: y, deg: deg, dir: null, ft: null, inn: inn || '1회초', ts: '10:0' + i, count: { b: 1, s: 2, o: 0 }, pitches: [] };
  }
  function fixture() {
    return {
      home: [{ id: 101, name: '김민수', num: '7', pos: '', bh: 'R', isStarter: true }, { id: 102, name: '박지훈', num: '', pos: '', bh: 'R', isStarter: true },
        { id: 103, name: '김도윤', num: '', pos: '', bh: 'R', isStarter: true }, { id: 104, name: '김서준', num: '', pos: '', bh: 'R', isStarter: true }],
      away: [{ id: 201, name: '이강인', num: '7', pos: '', bh: 'R', isStarter: true }, { id: 202, name: '최민준', num: '10', pos: '', bh: 'R', isStarter: true }],
      pitchers: [{ id: 301, name: '정우영', num: '18', hand: 'R', role: '선발', pitches: [{ pt: '직구', result: '스트라이크', zone: '중앙 중간', inn: '1회초' }] },
        { id: 302, name: '한동민', num: '', hand: 'L', role: '구원', pitches: [] }],
      abs: [ab(1, 101, '김민수', '7', 'home', '안타', 0.31, 0.52, 70), ab(2, 101, '김민수', '7', 'home', '삼진', null, null, null),
        ab(3, 102, '박지훈', '', 'home', '홈런', 0.5, 0.9, 90), ab(4, 103, '김도윤', '', 'home', '땅볼 아웃', 0.2, 0.3, 40),
        ab(5, 104, '김서준', '', 'home', '2루타', 0.7, 0.6, 120), ab(6, 201, '이강인', '7', 'away', '안타', 0.45, 0.4, 100, '1회말'),
        ab(7, 202, '최민준', '10', 'away', '볼넷', null, null, null, '1회말'), ab(8, 202, '최민준', '10', 'away', '플라이 아웃', 0.6, 0.7, 60, '1회말')]
    };
  }
  var HITS = ['안타', '내야안타', '2루타', '3루타', '홈런'], NOAB = ['볼넷', '사구', '희타', '희비'];
  function byBid(abs) {   // 타자별 타석 · 안타 · 타구 좌표 — 이름이 바뀌어도 같아야 하는 값
    var m = {};
    abs.forEach(function (a) {
      var o = m[a.bid] = m[a.bid] || { pa: 0, ab: 0, h: 0, spray: [] };
      o.pa++; if (NOAB.indexOf(a.res) < 0) o.ab++; if (HITS.indexOf(a.res) >= 0) o.h++;
      if (a.x != null) o.spray.push([a.x, a.y, a.deg]);
    });
    return m;
  }
  async function waitFor(cond, ms, what) {
    for (var t = 0; t < (ms || 2000); t += 20) { if (cond()) return; await sleep(20); }
    throw new Error('시간 안에 되지 않음: ' + (what || ''));
  }
  async function openLink(url) {   // 링크를 연 새 탭처럼: ?gid= / ?game= 을 읽어 _sharedPayload 를 돌려준다
    // 하네스는 CDN 을 막아 LZString 이 없다 → 앱이 쓰는 base64 폴백(+ / = 포함)을 퍼센트 인코딩해서 연다 (운영에서는 LZString 의 URL-safe 인코딩)
    url = url.replace(/\?game=(.*)$/, function (m, v) { return '?game=' + encodeURIComponent(v); });
    var u = new URL(url);
    history.replaceState(null, '', u.pathname + u.search);
    window._sharedPayload = undefined;
    _loadSharedGame();
    await waitFor(function () { return window._sharedPayload; }, 2000, '공유 payload 로딩');
    return window._sharedPayload;
  }
  var saved = null;
  function setUp() {
    saved = { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, p: AS.pitchers, zh: AS.zoneHistory, hs: AS.hs, as: AS.as, ap: $('app-page').style.display,
      th: $('tHome').value, ta: $('tAway').value, url: location.pathname + location.search + location.hash, sp: window._sharedPayload, cp: AS.currentPitcher };
    var f = fixture();
    AS.abs = f.abs; AS.home_lineup = f.home; AS.away_lineup = f.away; AS.pitchers = f.pitchers; AS.zoneHistory = {}; AS.hs = 3; AS.as = 1;
    $('tHome').value = '남서울대'; $('tAway').value = '상대팀';
    srv.shared_links = [];
    return f;
  }
  function tearDown() {
    try { closeShareQR(); } catch (e) {}
    AS.abs = saved.abs; AS.home_lineup = saved.hl; AS.away_lineup = saved.al; AS.pitchers = saved.p; AS.zoneHistory = saved.zh; AS.hs = saved.hs; AS.as = saved.as; AS.currentPitcher = saved.cp;
    $('tHome').value = saved.th; $('tAway').value = saved.ta; $('app-page').style.display = saved.ap;
    window._sharedPayload = saved.sp; history.replaceState(null, '', saved.url);
    try { dismissSharedBanner(); } catch (e) {}
    srv.shared_links = [];
  }
  function leaks(obj) { var s = JSON.stringify(obj); return NAMES.filter(function (n) { return s.indexOf(n) >= 0; }); }

  test('실명 치환 규칙: 등번호가 있으면 #번호, 없으면 성OO — 겹치면 구분하고, 원본은 건드리지 않는다', function () {
    var p = { v: 3, ht: '남서울대', at: '상대팀', hs: 3, as: 1, zh: {},
      hl: [{ n: '김민수', no: '7', id: 101 }, { n: '박지훈', no: '', id: 102 }, { n: '김도윤', no: '', id: 103 }, { n: '김서준', no: '', id: 104 }],
      al: [{ n: '이강인', no: '7', id: 201 }, { n: '최민준', no: '10', id: 202 }],
      pitchers: [{ id: 301, nm: '정우영', no: '18', hand: 'R', role: '선발', pitches: [] }, { id: 302, nm: '한동민', no: '', hand: 'L', role: '구원', pitches: [] }],
      abs: [{ bid: 101, bn: '김민수', bno: '7', t: 'home', r: '안타' }, { bid: 104, bn: '김서준', bno: 0, t: 'home', r: '삼진' }, { bid: 201, bn: '이강인', bno: '7', t: 'away', r: '안타' },
        { bid: 999, bn: '오승환', bno: 0, t: 'away', r: '볼넷' }] };
    var before = JSON.stringify(p), o = _anonSharePayload(p);
    eq(JSON.stringify(p), before, '원본 payload 는 그대로');
    eq(o.hl.map(function (e) { return e.n; }), ['#7', '박OO', '김OO', '김OO 홈'], '홈 라인업: 번호 있으면 #7 · 없으면 성OO · 같은 성끼리는 구분');
    eq(o.al.map(function (e) { return e.n; }), ['#7 원정', '#10'], '원정 라인업: 홈과 겹친 #7 은 구분');
    eq(o.pitchers.map(function (e) { return e.nm; }), ['#18', '한OO'], '투수');
    eq(o.abs.map(function (e) { return e.bn; }), ['#7', '김OO 홈', '#7 원정', '오OO'], '타석의 타자 표기는 라인업과 같은 선수끼리 같다');
    eq(o.hl.map(function (e) { return [e.id, e.no]; }), p.hl.map(function (e) { return [e.id, e.no]; }), 'id · 등번호는 그대로');
    eq(o.abs.map(function (e) { return [e.bid, e.r, e.t]; }), p.abs.map(function (e) { return [e.bid, e.r, e.t]; }), '타석의 나머지 필드는 그대로');
    eq(leaks(o), [], '치환 결과에 실명이 남지 않음');
    // compact(id 없음): 라인업의 번호가 비어 있고 타석은 0 으로 채워져 와도 같은 선수로 본다
    var c = _anonSharePayload({ hl: [{ n: '박지훈', no: '' }], al: [], pitchers: [], abs: [{ bn: '박지훈', bno: 0, t: 'home' }, { bn: '김민수', bno: '7', t: 'home' }] });
    eq([c.hl[0].n, c.abs[0].bn, c.abs[1].bn], ['박OO', '박OO', '#7'], 'compact 형식');
    eq([_anonLabel('', ''), _anonLabel('', '0'), _anonLabel('홍길동', 0), _anonLabel('Smith', null)], ['선수', '#0', '홍OO', 'SOO'], '이름 · 번호가 비었거나 0 일 때');
  });

  test('경기 공유: 모달은 기본 "선수 실명 포함" 해제 + 안내 문구, 서버(shared_links)에는 치환된 payload 가 저장된다', async function () {
    setUp();
    try {
      shareGameLink();
      await waitFor(function () { return $('shareQROv').classList.contains('show'); }, 2000, '공유 모달');
      eq(srv.shared_links.length, 1, 'shared_links 에 1건');
      eq(leaks(srv.shared_links[0].payload), [], '서버에 저장된 payload 에 실명이 없음');
      var p = srv.shared_links[0].payload;
      eq(p.hl.map(function (e) { return e.n; }), ['#7', '박OO', '김OO', '김OO 홈'], '홈 라인업');
      eq(p.pitchers.map(function (e) { return e.nm; }), ['#18', '한OO'], '투수');
      ok(/\?gid=[a-z0-9]{8}$/.test($('shareQRUrl').textContent), '링크는 ?gid=<id>: ' + $('shareQRUrl').textContent);
      var chk = $('shareNameChk');
      ok(chk && chk.type === 'checkbox' && chk.checked === false, '체크박스 기본 해제');
      eq(chk.parentElement.textContent.trim(), '선수 실명 포함', '체크박스 라벨');
      ok($('shareNameOpt').style.display !== 'none', '경기 공유에서는 옵션이 보임');
      var note = chk.closest('#shareNameOpt').querySelector('.share-qr-note');
      eq(note.textContent.trim(), '링크를 아는 사람은 누구나 열 수 있습니다.', '안내 문구');
      ok(chk.parentElement.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING, '안내는 체크박스 아래');
      ok(chk.parentElement.getBoundingClientRect().height >= 44, '체크박스 줄 터치 영역 44px 이상');
    } finally { tearDown(); }
  });

  test('"선수 실명 포함" 을 켜면 실명 링크, 다시 끄면 방금 만든 치환 링크를 재사용한다 (행이 늘지 않음)', async function () {
    setUp();
    try {
      shareGameLink();
      await waitFor(function () { return $('shareQROv').classList.contains('show') && srv.shared_links.length === 1; }, 2000, '첫 링크');
      var anonUrl = $('shareQRUrl').textContent;
      var chk = $('shareNameChk');
      chk.checked = true; chk.dispatchEvent(new Event('change'));
      ok($('shareQRCopyBtn').disabled && $('kakaoShareBtn').disabled, '만드는 동안 복사 · 카카오 버튼은 막힌다(체크 상태와 다른 링크가 복사되지 않게)');
      eq(_shareURL, '', '만드는 동안 이전 링크는 비워진다');
      await waitFor(function () { return srv.shared_links.length === 2; }, 2000, '실명 링크');
      await waitFor(function () { return !$('shareQRCopyBtn').disabled; }, 2000, '버튼 복귀');
      var realUrl = $('shareQRUrl').textContent;
      ok(realUrl !== anonUrl && /\?gid=/.test(realUrl), '실명 링크는 다른 gid');
      eq(srv.shared_links[1].payload.hl.map(function (e) { return e.n; }), ['김민수', '박지훈', '김도윤', '김서준'], '체크하면 실명 그대로');
      eq(srv.shared_links[1].payload.abs[0].bn, '김민수', '타석의 이름도 실명');
      ok($('shareNameChk').checked === true, '체크 상태 유지');
      eq(_shareURL, realUrl, '복사될 링크 = 화면의 링크');
      chk.checked = false; chk.dispatchEvent(new Event('change'));
      await sleep(100);
      eq(srv.shared_links.length, 2, '다시 끄면 새 행을 만들지 않고 기존 치환 링크를 재사용');
      eq([$('shareQRUrl').textContent, _shareURL], [anonUrl, anonUrl], '치환 링크로 복귀');
      // 모달을 닫았다 다시 열면 기본(해제)부터
      closeShareQR(); shareGameLink();
      await waitFor(function () { return $('shareQROv').classList.contains('show') && srv.shared_links.length === 3; }, 2000, '재오픈');
      ok($('shareNameChk').checked === false, '다시 열면 기본 해제');
      eq(leaks(srv.shared_links[2].payload), [], '다시 열어도 치환');
    } finally { tearDown(); }
  });

  test('받는 쪽: 치환된 ?gid= 링크를 열어도 타자별 타석 · 안타 · 스프레이 좌표 · 팀 타율이 같고, 선수가 합쳐지지 않는다', async function () {
    var f = setUp(), want = byBid(f.abs);
    try {
      shareGameLink();
      await waitFor(function () { return $('shareQROv').classList.contains('show'); }, 2000, '공유 모달');
      var url = $('shareQRUrl').textContent;
      closeShareQR();
      // 보내는 쪽 상태를 비우고, 링크만으로 열기
      AS.abs = []; AS.home_lineup = []; AS.away_lineup = []; AS.pitchers = [];
      var payload = await openLink(url);
      ok($('sharedBanner').classList.contains('show'), '공유 배너 표시');
      ok(/남서울대 vs 상대팀 · 8타석/.test($('sharedBannerDesc').textContent), '배너 문구: ' + $('sharedBannerDesc').textContent);
      eq(leaks(payload), [], '받은 payload 에 실명이 없음');
      loadSharedGame(); await sleep(700);
      eq(leaks({ a: AS.abs, h: AS.home_lineup, v: AS.away_lineup, p: AS.pitchers }), [], '열린 경기의 모든 이름이 치환됨');
      eq(AS.home_lineup.map(function (p) { return p.name; }), ['#7', '박OO', '김OO', '김OO 홈'], '라인업 이름');
      eq(AS.pitchers.map(function (p) { return p.name; }), ['#18', '한OO'], '투수 이름');
      var got = byBid(AS.abs);
      eq(got, want, 'bid 별 타석 · 안타 · 스프레이 좌표(x, y, 각도)');
      eq(new Set(AS.abs.map(function (a) { return a.bname; })).size, new Set(AS.abs.map(function (a) { return a.bid; })).size, '이름으로 집계해도 선수 수가 같다(#7 이 양 팀에서 합쳐지지 않음)');
      AS.home_lineup.concat(AS.away_lineup).forEach(function (p) {
        ok(AS.abs.filter(function (a) { return a.bid === p.id; }).every(function (a) { return a.bname === p.name; }), p.name + ': 타석의 이름이 라인업과 같다');
      });
      var team = function (abs) { var h = 0, n = 0; abs.forEach(function (a) { if (NOAB.indexOf(a.res) < 0) n++; if (HITS.indexOf(a.res) >= 0) h++; }); return [h, n]; };
      eq(team(AS.abs), team(f.abs), '팀 안타 / 타수');
      // 화면 갱신 · 이름으로 집계하는 선수 프로필도 예외 없이 그려진다
      updateAll();
      openPlayerProfile();
      var prof = ($('playerProfileContent') || { textContent: '' }).textContent;
      ok(prof.indexOf('#7') >= 0 && prof.indexOf('김OO') >= 0, '선수 프로필에 치환된 이름으로 나옴');
      // 「저장」도 같은 데이터로 로컬에 남는다
      window._sharedPayload = payload;
      var n0 = (T.ls('sl_saves') || []).length;
      saveSharedGameLocal();
      var saves = T.ls('sl_saves') || [];
      eq(saves.length, n0 + 1, '저장 항목이 1개 늘어남');
      var d = T.ls(saves[saves.length - 1].key);
      eq(byBid(d.abs), want, '저장된 경기의 통계도 같다');
      eq(leaks(d), [], '저장본에도 실명이 없음');
      localStorage.removeItem(saves[saves.length - 1].key); saves.pop(); localStorage.setItem('sl_saves', JSON.stringify(saves));
    } finally { tearDown(); }
  });

  test('기존 공유 링크 호환: 예전 형식(실명 · v1/v3, ?gid= · ?game=)을 그대로 열 수 있다', async function () {
    setUp();
    try {
      var old = { v: 1, ht: '홈팀A', at: '원정B', hs: 3, as: 1, hl: [{ id: 'b1', n: '김타자', no: 7 }], al: [], pitchers: [],
        abs: [{ bid: 'b1', bn: '김타자', bno: 7, t: 'home', r: '안타', p: '직구', z: '중앙 중간', x: 0.4, y: 0.4, d: 80, i: '1회초' }] };
      srv.shared_links.push({ id: 'oldlink1', payload: old });
      var p1 = await openLink(location.origin + location.pathname + '?gid=oldlink1');
      eq(p1.hl[0].n, '김타자', '?gid= 예전 링크: 서버에 저장된 실명 payload 를 그대로 읽는다');
      loadSharedGame(); await sleep(700);
      eq([AS.abs.map(function (a) { return a.bname; }), AS.home_lineup[0].name, $('tHome').value], [['김타자'], '김타자', '홈팀A'], '예전 링크로 연 경기');
      var p2 = await openLink(location.origin + location.pathname + '?game=b' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(old))))));
      eq(p2.abs[0].bn, '김타자', '?game= 예전 링크');
      eq(srv.shared_links.length, 1, '링크를 열기만 해서는 새 행이 생기지 않는다');
    } finally { tearDown(); }
  });

  test('서버 저장이 안 될 때 만드는 ?game= 링크(URL에 데이터가 담김)도 기본은 치환, 체크하면 실명', async function () {
    setUp();
    var push = window.pushSharedLink;
    try {
      window.pushSharedLink = function (payload, okCb, failCb) { failCb('offline'); };   // 서버 저장 실패 → 레거시 폴백
      shareGameLink();
      await waitFor(function () { return $('shareQROv').classList.contains('show'); }, 2000, '공유 모달');
      eq(srv.shared_links.length, 0, '서버에는 아무것도 저장하지 않음');
      var url1 = $('shareQRUrl').textContent;
      ok(/\?game=/.test(url1), '?game= 링크: ' + url1.slice(0, 60));
      var p1 = await openLink(url1);
      eq(leaks(p1), [], '링크 안의 데이터에 실명이 없음');
      eq(p1.hl.map(function (e) { return e.n; }), ['#7', '박OO', '김OO', '김OO 홈'], '라인업');
      eq(p1.abs.map(function (e) { return e.bn; }), ['#7', '#7', '박OO', '김OO', '김OO 홈', '#7 원정', '#10', '#10'], '타석 이름은 라인업과 같은 선수끼리 같다');
      var chk = $('shareNameChk'); chk.checked = true; chk.dispatchEvent(new Event('change'));
      await waitFor(function () { return $('shareQRUrl').textContent !== url1 && !$('shareQRCopyBtn').disabled; }, 2000, '실명 링크');
      var p2 = await openLink($('shareQRUrl').textContent);
      eq(p2.hl.map(function (e) { return e.n; }), ['김민수', '박지훈', '김도윤', '김서준'], '체크하면 실명');
      // 열기 → 통계도 정상
      loadSharedGame(); await sleep(700);
      eq(AS.abs.length, 8, '타석 수');
    } finally { window.pushSharedLink = push; tearDown(); }
  });

  test('공유 모달을 옵션 없이 열면(인자 없는 showShareQR) "선수 실명 포함" 옵션은 숨겨진다', function () {
    try {
      showShareQR('https://example.invalid/?x=1');
      eq($('shareNameOpt').style.display, 'none', '옵션 숨김');
      showShareQR('https://example.invalid/?gid=abcd1234', true);
      ok($('shareNameOpt').style.display !== 'none', '경기 · 팀 공유에서는 보임');
    } finally { closeShareQR(); }
  });

  // ── 팀 공유(?team=) — MVP 이름을 경기 공유와 같은 규칙(_anonSharePayload)으로 치환, 받는 쪽 코드는 그대로 ──
  var TEAM_NAMES = ['김민수', '박지훈', '김도윤', '이강인'];
  function teamLeaks(obj) { var s = JSON.stringify(obj); return TEAM_NAMES.filter(function (n) { return s.indexOf(n) >= 0; }); }
  function teamFixture() {
    var g = function (k, mvp) { return { key: 'sl_10' + k, date: '2026.10.0' + k, th: '남서울대', ta: '상대' + k, hs: 5, as: 3, result: 'W', mvp: mvp }; };
    return { id: 'tTEST', name: '남서울대', color: '#4b8cf5', stadium: '교내구장', createdAt: '2026.10.01',
      games: [g(1, { name: '김민수', num: '7', h: 2, ab: 3, rbi: 1 }), g(2, { name: '박지훈', num: '', h: 1, ab: 2, rbi: 0 }), g(3, { name: '김민수', num: '7', h: 3, ab: 4, rbi: 2 }),
        g(4, null), g(5, { name: '김도윤', h: 1, ab: 3, rbi: 0 }), g(6, { name: '이강인', num: '7', h: 2, ab: 2, rbi: 1 })] };
  }
  var TEAM_ANON = ['#7', '박OO', '#7', null, '김OO', '#7 2'], TEAM_REAL = ['김민수', '박지훈', '김민수', null, '김도윤', '이강인'];
  function mvps(p) { return p.games.map(function (g) { return g.mvpName; }); }
  function decodeTeamUrl(url) {   // shareTeamURL 이 만든 링크의 데이터 (하네스는 CDN 을 막아 LZString 이 없다 → 'b'+base64)
    var enc = url.split('?team=')[1];
    var json = enc[0] === 'z' && typeof LZString !== 'undefined' ? LZString.decompressFromEncodedURIComponent(enc.slice(1)) : decodeURIComponent(escape(atob(enc[0] === 'b' ? enc.slice(1) : enc)));
    return JSON.parse(json);
  }
  async function openTeamLink(url) {   // 받는 쪽 코드(core.js 의 _loadTeamFromURL — 페이지 로드 때 한 번 도는 IIFE)를 수정 없이 소스 그대로 다시 실행한다
    var src = await (await fetch('/js/core.js')).text();
    var a = src.indexOf('(function _loadTeamFromURL(){'), b = src.indexOf('})();', a);
    ok(a > 0 && b > a, 'core.js 에서 _loadTeamFromURL 을 찾지 못함 — 테스트 갱신 필요');
    url = url.replace(/\?team=(.*)$/, function (m, v) { return '?team=' + encodeURIComponent(v); });   // base64 폴백(+ / =)을 퍼센트 인코딩 (운영은 LZString 의 URL-safe 인코딩)
    var u = new URL(url);
    history.replaceState(null, '', u.pathname + u.search);
    window._sharedTeamPayload = undefined;
    (0, eval)(src.slice(a, b + 5));
    return window._sharedTeamPayload;
  }
  var teamSaved = null;
  function teamSetUp() {
    teamSaved = { raw: localStorage.getItem('sl_teams'), url: location.pathname + location.search + location.hash, tp: window._sharedTeamPayload, rows: srv.shared_links.length };
    localStorage.setItem('sl_teams', JSON.stringify({ teams: [teamFixture()], activeTeamId: 'tTEST' }));
    tdLoad();
  }
  function teamTearDown() {
    try { closeShareQR(); } catch (e) {}
    if (teamSaved.raw == null) localStorage.removeItem('sl_teams'); else localStorage.setItem('sl_teams', teamSaved.raw);
    _TD = { teams: [], activeTeamId: null }; tdLoad();
    window._sharedTeamPayload = teamSaved.tp; history.replaceState(null, '', teamSaved.url);
    var b = $('teamSharedBanner'); if (b) b.style.display = 'none';
  }

  test('팀 공유: 기본은 MVP 이름을 "#등번호" / "성OO" 로 치환 — 같은 선수는 같은 표기, 나머지 필드는 그대로, 모달에 "선수 실명 포함"(기본 해제)', function () {
    teamSetUp();
    try {
      shareTeamURL();
      ok($('shareQROv').classList.contains('show'), '공유 모달');
      var chk = $('shareNameChk');
      ok($('shareNameOpt').style.display !== 'none' && chk.checked === false, '팀 공유에도 "선수 실명 포함" 체크박스(기본 해제)');
      eq(document.querySelector('#shareNameOpt .share-qr-note').textContent.trim(), '링크를 아는 사람은 누구나 열 수 있습니다.', '안내 문구');
      var url = $('shareQRUrl').textContent;
      ok(/\?team=/.test(url), '?team= 링크: ' + url.slice(0, 50));
      eq(_shareURL, url, '복사될 링크 = 화면의 링크');
      var p = decodeTeamUrl(url), f = teamFixture();
      eq(mvps(p), TEAM_ANON, 'MVP: 번호 있으면 #번호 · 없으면 성OO · 같은 선수(김민수 #7)는 두 경기 모두 #7 · 번호가 겹친 다른 선수는 "#7 2" · MVP 없는 경기는 null');
      eq(teamLeaks(p), [], '링크 안에 선수 실명이 없다');
      eq([p.v, p.type, p.name, p.color, p.stadium], [1, 'team', f.name, f.color, f.stadium], '팀 정보는 그대로');
      eq(p.games.map(function (g) { return [g.date, g.th, g.ta, g.hs, g.as, g.result]; }), f.games.map(function (g) { return [g.date, g.th, g.ta, g.hs, g.as, g.result]; }), '경기 정보는 그대로');
      eq(Object.keys(p.games[0]).sort(), ['as', 'date', 'hs', 'mvpName', 'result', 'ta', 'th'], '경기 항목의 필드 구성은 예전 링크와 같다(받는 쪽 호환)');
      eq(tdGetActive().games.map(function (g) { return g.mvp ? g.mvp.name : null; }), TEAM_REAL, '내 기기의 팀 데이터(원본)는 실명 그대로 — 치환은 링크에만');
    } finally { teamTearDown(); }
  });

  test('팀 공유: "선수 실명 포함" 을 켜면 실명, 끄면 다시 치환 — 서버(shared_links)에는 아무것도 저장하지 않는다', function () {
    teamSetUp();
    try {
      shareTeamURL();
      var url1 = $('shareQRUrl').textContent, chk = $('shareNameChk');
      chk.checked = true; chk.dispatchEvent(new Event('change'));
      var url2 = $('shareQRUrl').textContent;
      ok(url2 !== url1 && /\?team=/.test(url2), '체크하면 새 팀 링크');
      eq(mvps(decodeTeamUrl(url2)), TEAM_REAL, '체크하면 MVP 실명 그대로');
      ok($('shareNameChk').checked, '체크 상태 유지');
      eq(_shareURL, url2, '복사될 링크 = 실명 링크');
      chk.checked = false; chk.dispatchEvent(new Event('change'));
      eq([$('shareQRUrl').textContent, _shareURL], [url1, url1], '끄면 치환 링크로 복귀');
      eq(srv.shared_links.length, teamSaved.rows, '팀 링크는 URL 에 담긴다 — 서버 행이 생기지 않는다');
    } finally { teamTearDown(); }
  });

  test('팀 공유 받는 쪽: 치환된 ?team= 링크도, 예전(실명) ?team= 링크도 그대로 읽고 가져온다 (받는 쪽 코드 수정 없음)', async function () {
    teamSetUp();
    try {
      shareTeamURL();
      var url = $('shareQRUrl').textContent;
      closeShareQR();
      var p = await openTeamLink(url);
      ok(p && p.type === 'team', '받는 쪽이 치환된 링크를 읽음');
      ok($('teamSharedBanner').style.display === 'block' && $('tsbTeamName').textContent === '남서울대' && /6경기/.test($('tsbTeamGames').textContent), '팀 공유 배너: ' + $('tsbTeamGames').textContent);
      importSharedTeam();
      var t = tdGetActive();
      ok(t.id !== 'tTEST' && t.name === '남서울대', '새 팀으로 가져옴');
      eq(mvps(t), TEAM_ANON, '가져온 팀에는 치환된 표기로 저장');
      eq(teamLeaks(t), [], '가져온 팀 데이터에 실명이 없다');
      // 예전 링크(실명 · 이 PR 이전 형식)
      var old = { v: 1, type: 'team', name: '옛팀', color: '#ff0000', stadium: '', games: [{ date: '2026.06.01', th: '옛팀', ta: '상대', hs: 3, as: 1, result: 'W', mvpName: '김민수' }] };
      var p2 = await openTeamLink(location.origin + location.pathname + '?team=b' + btoa(unescape(encodeURIComponent(JSON.stringify(old)))));
      eq(p2 && p2.games[0].mvpName, '김민수', '예전 실명 링크도 그대로 읽힌다');
      importSharedTeam();
      eq([tdGetActive().name, tdGetActive().games[0].mvpName], ['옛팀', '김민수'], '예전 링크 가져오기');
    } finally { teamTearDown(); }
  });

  test('팀 공유 ↔ 경기 공유를 오가도 체크박스는 지금 열린 공유의 링크만 다시 만든다 (경기 링크가 늦게 와도 팀 링크를 덮지 않음)', async function () {
    teamSetUp(); setUp();
    try {
      shareTeamURL();
      var chk = $('shareNameChk'); chk.checked = true; chk.dispatchEvent(new Event('change'));
      ok(/\?team=/.test($('shareQRUrl').textContent), '팀 실명 링크');
      shareGameLink();
      await waitFor(function () { return /\?gid=/.test($('shareQRUrl').textContent) && srv.shared_links.length === 1; }, 2000, '경기 링크');
      ok(!$('shareNameChk').checked, '경기 공유를 열면 다시 기본(해제)');
      eq(leaks(srv.shared_links[0].payload), [], '경기 기본 링크는 치환');
      chk.checked = true; chk.dispatchEvent(new Event('change'));
      await waitFor(function () { return srv.shared_links.length === 2 && !$('shareQRCopyBtn').disabled; }, 2000, '경기 실명 링크');
      ok(/\?gid=/.test($('shareQRUrl').textContent), '경기 공유에서 체크하면 경기 링크(gid)를 만든다');
      eq(srv.shared_links[1].payload.hl[0].n, '김민수', '경기 실명 링크');
      shareTeamURL();
      ok(!$('shareNameChk').checked && /\?team=/.test($('shareQRUrl').textContent), '팀 공유를 다시 열면 기본(해제) · 팀 링크');
      chk.checked = true; chk.dispatchEvent(new Event('change'));
      ok(/\?team=/.test($('shareQRUrl').textContent) && srv.shared_links.length === 2, '팀 공유에서 체크하면 팀 링크 — 경기 행은 늘지 않는다');
      // 경기 링크를 만드는 중에 팀 공유를 연다 → 늦게 도착한 경기 응답이 팀 링크를 덮지 않는다
      closeShareQR(); shareGameLink(); shareTeamURL();
      await sleep(300);
      ok(/\?team=/.test($('shareQRUrl').textContent) && !$('shareQRCopyBtn').disabled, '늦게 도착한 경기 링크가 팀 링크를 덮지 않고, 버튼도 막혀 있지 않다');
    } finally { teamTearDown(); tearDown(); }
  });

  // 경기를 열면 자동저장 · 실시간 동기화가 몇 초 뒤로 예약된다 — 끝나기를 기다렸다가 지워, 뒤 테스트(동기화 요청 수를 세는)에 섞이지 않게
  test('(정리) 공유 실명 보호 테스트가 남긴 자동저장 예약 · 스냅샷을 비운다', async function () {
    try { storageManager.cancelPendingAutosave(); } catch (e) {}
    await sleep(3500);
    for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && (k === 'sl_autosave' || k.indexOf('sl_auto_') === 0)) localStorage.removeItem(k); }
    srv.shared_links = [];
    ok(true);
  });
})();
