// 공유 경기 링크(?game=) — Supabase 짧은 링크(?gid=)를 못 만들 때(오프라인 · 샘플 모드 등) 앱이 대신 만드는 링크.
// 배경: 페이지 로드 중 _loadSharedGame() 이 payload 를 _sharedPayload 에 넣은 뒤, 더 아래의 `var _sharedPayload=null;` 이
//       실행되며 값을 지워 배너의 「보기」 · 「저장」이 아무 일도 하지 않았다.
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;

  test('공유 링크: 페이지 로드 중 채운 payload 를 뒤에서 다시 비우지 않는다 (core.js 실행 순서)', async function () {
    var src = await (await fetch('/js/core.js')).text();
    var call = src.search(/^_loadSharedGame\(\);/m);
    ok(call > 0, '페이지 로드 중 _loadSharedGame() 호출을 찾지 못함 — 테스트 갱신 필요');
    var after = src.slice(call);
    ok(!/^\s*(?:var\s+)?_sharedPayload\s*=\s*null\b/m.test(after), '_loadSharedGame() 호출 뒤에서 _sharedPayload 를 null 로 초기화하면 ?game= 링크의 보기 · 저장이 동작하지 않는다');
  });

  test('공유 링크: ?game= 링크를 읽으면 배너가 뜨고, 보기를 누르면 그 경기를 연다', async function () {
    var url = location.pathname + location.search + location.hash, sp = window._sharedPayload;
    var S = { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, p: AS.pitchers, zh: AS.zoneHistory, hs: AS.hs, as: AS.as, ap: $('app-page').style.display, th: $('tHome').value, ta: $('tAway').value };
    var payload = { v: 1, ht: '홈팀A', at: '원정B', hs: 3, as: 1, hl: [{ id: 'b1', n: '김타자', no: 7 }], al: [], pitchers: [],
      abs: [{ bid: 'b1', bn: '김타자', bno: 7, t: 'home', r: '안타', p: '직구', z: '중앙 중간', x: 0.4, y: 0.4, d: 80, i: '1회초' }] };
    try {
      window._sharedPayload = undefined;
      history.replaceState(null, '', location.pathname + '?game=b' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload))))));
      _loadSharedGame();
      ok(window._sharedPayload && window._sharedPayload.ht === '홈팀A', '링크의 payload 를 읽음');
      ok($('sharedBanner').classList.contains('show'), '공유 배너 표시');
      loadSharedGame(); await sleep(700);
      eq(AS.abs.map(function (a) { return a.bname; }), ['김타자'], '보기: 공유받은 경기의 타석');
      eq([$('tHome').value, $('tAway').value, AS.hs, AS.as], ['홈팀A', '원정B', 3, 1], '보기: 팀명 · 점수');
    } finally {
      window._sharedPayload = sp; history.replaceState(null, '', url);
      try { dismissSharedBanner(); } catch (e) {}
      AS.abs = S.abs; AS.home_lineup = S.hl; AS.away_lineup = S.al; AS.pitchers = S.p; AS.zoneHistory = S.zh; AS.hs = S.hs; AS.as = S.as;
      $('tHome').value = S.th; $('tAway').value = S.ta; $('app-page').style.display = S.ap;
    }
  });

  // 경기를 열면 자동저장 · 실시간 동기화가 몇 초 뒤로 예약된다 — 끝나기를 기다렸다가 지워, 뒤 테스트(동기화 요청 수를 세는)에 섞이지 않게
  test('(정리) 공유 링크 테스트가 남긴 자동저장 예약 · 스냅샷을 비운다', async function () {
    try { storageManager.cancelPendingAutosave(); } catch (e) {}
    await sleep(3500);
    for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && (k === 'sl_autosave' || k.indexOf('sl_auto_') === 0)) localStorage.removeItem(k); }
    ok(true);
  });
})();
