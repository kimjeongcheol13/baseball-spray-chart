// 공유 링크에 상세 필터 싣기 — 보내는 쪽: 켜진 필터(sf) · 타석의 투수 손(hd)을 payload 에, 받는 쪽: 「보기」가 같은 필터를 켠다 (core.js · features/filter.js)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var ABS = [
    { bid: 'b1', bname: '김타자', bnum: 7, team: 'home', res: '안타', pt: '직구', x: 0.4, y: 0.4, deg: 80, inn: '1회초', hand: 'L', count: { b: 0, s: 0, o: 0 } },
    { bid: 'b2', bname: '이타자', bnum: 8, team: 'home', res: '땅볼 아웃', pt: '커브', x: 0.6, y: 0.6, deg: 100, inn: '1회초', hand: 'R', count: { b: 1, s: 2, o: 1 } }
  ];
  function snap() { return { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, p: AS.pitchers, zh: AS.zoneHistory, hs: AS.hs, as: AS.as, ap: $('app-page').style.display, th: $('tHome').value, ta: $('tAway').value, sp: window._sharedPayload, push: window.pushSharedLink }; }
  function back(S) {
    AS.abs = S.abs; AS.home_lineup = S.hl; AS.away_lineup = S.al; AS.pitchers = S.p; AS.zoneHistory = S.zh; AS.hs = S.hs; AS.as = S.as;
    $('tHome').value = S.th; $('tAway').value = S.ta; $('app-page').style.display = S.ap; window._sharedPayload = S.sp; window.pushSharedLink = S.push;
    try { closeShareQR(); } catch (e) {}
    try { dismissSharedBanner(); } catch (e) {}
    window._sfSetState({});
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window._sfState && window._sfSetState && window._sfLabel && window._shareGameBuild && window.loadSharedGame, '필터 · 공유 함수 로드');
  });

  test('받은 필터는 형식이 맞는 것만 켠다', function () {
    try {
      eq(window._sfSetState(null), '', '필터 객체가 아님');
      eq(window._sfSetState({ pt: ['직구', 3, 'x'.repeat(30)], hand: '__proto__', count: 'toString' }), '직구', '라벨');
      eq(window._sfState(), { pt: ['직구'], res: [], hand: null, count: null }, '걸러진 상태');
    } finally { window._sfSetState({}); }
  });

  test('보내기: 필터가 켜져 있으면 링크 payload 에 sf · 타석마다 hd, 공유 창에 조건 표시 — URL 폴백은 카운트 조건을 뺀다', async function () {
    var S = snap(), got = null;
    try {
      AS.abs = ABS.slice();
      window._sfSetState({ hand: 'L', count: 'first' });
      window.pushSharedLink = function (p, done) { got = p; done('t1'); };
      window._shareGameBuild(false);
      ok(got, 'pushSharedLink 호출 안 됨');
      eq(got.sf, { pt: [], res: [], hand: 'L', count: 'first' }, 'payload.sf');
      eq(got.abs.map(function (a) { return a.hd; }), ['L', 'R'], 'payload.abs[].hd');
      eq($('shareFilterNote').textContent, '지금 필터도 같이 보내요 · 좌투수 상대 · 초구', '공유 창 안내');
      ok($('shareFilterNote').style.display !== 'none', '안내가 숨어 있음');

      window.pushSharedLink = function (p, done, fail) { fail('offline'); };
      window._shareLinks = {};
      window._shareGameBuild(true);
      var url = $('shareQRUrl').textContent, enc = new URL(url).searchParams.get('game');
      var c = JSON.parse(enc.charAt(0) === 'z' ? LZString.decompressFromEncodedURIComponent(enc.slice(1)) : decodeURIComponent(escape(atob(enc.slice(1)))));   // 테스트엔 LZString(CDN)이 없어 'b' + base64
      eq([c.sf.hand, c.sf.count, c.abs[0].hd], ['L', null, 'L'], 'URL 폴백 payload');

      window._sfSetState({});
      window.pushSharedLink = function (p, done) { got = p; done('t2'); };
      window._shareLinks = {};
      window._shareGameBuild(false);
      ok(!('sf' in got), '필터를 껐는데 sf 가 실림');
      eq($('shareFilterNote').style.display, 'none', '필터 없으면 안내 숨김');
    } finally { back(S); }
  });

  test('받기: 「보기」가 보낸 사람의 필터를 켜고 알린다 · 타석의 투수 손을 되살린다', async function () {
    var S = snap();
    var payload = { v: 3, ht: '홈팀A', at: '원정B', hs: 1, as: 0, hl: [], al: [], pitchers: [], sf: { pt: [], res: ['안타'], hand: 'L', count: null },
      abs: [{ bid: 'b1', bn: '김타자', bno: 7, t: 'home', r: '안타', p: '직구', x: 0.4, y: 0.4, d: 80, i: '1회초', hd: 'L' },
            { bid: 'b2', bn: '이타자', bno: 8, t: 'home', r: '땅볼 아웃', p: '커브', x: 0.6, y: 0.6, d: 100, i: '1회초', hd: 'Z' }] };
    try {
      window._sharedPayload = payload;
      loadSharedGame(); await sleep(700);
      eq(AS.abs.map(function (a) { return a.hand; }), ['L', undefined], '투수 손 (형식 밖 값은 버림)');
      eq(window._sfLabel(), '안타 · 좌투수 상대', '켜진 필터');
      eq(AS.abs.filter(window._sfPass).length, 1, '필터를 통과한 타석');
      ok(/보낸 사람이 건 필터로 열었어요 · 안타 · 좌투수 상대/.test($('toastTxt').textContent) || /필터 안타 · 좌투수 상대/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
    } finally { back(S); }
  });

  test('(정리) 공유 테스트가 남긴 자동저장 예약 · 스냅샷을 비운다', async function () {
    try { storageManager.cancelPendingAutosave(); } catch (e) {}
    await sleep(3500);
    for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && (k === 'sl_autosave' || k.indexOf('sl_auto_') === 0)) localStorage.removeItem(k); }
    ok(true);
  });
})();
