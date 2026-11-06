// 상세 필터 「주자 상황」 (filter.js _sitOk) — 6-4-3 Charts 상황별 스프레이
//  · 득점권 = 2루 · 3루에 주자 / 주자 있음 / 주자 없음 — 경기 운영 모드로 적은 타석(gfPre)만 안다
//  · 2아웃 = gfPre 의 아웃, 없으면 볼카운트로 적은 아웃(count.o)
//  · 공유 링크엔 싣지 않는다 (링크의 타석에 gfPre 가 없어 받는 쪽에서 점이 다 사라진다)
// @window 390,844
// @pointer coarse
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  function chip(v) { return document.querySelector('#sfPanel .sfc[data-key="sit"][data-val="' + v + '"]'); }
  function pre(bases, outs) { return { gfPre: { inning: 1, half: 'top', outs: outs || 0, bases: bases } }; }
  var AB = {
    '빈': pre([null, null, null]),
    '1루': pre([{}, null, null]),
    '2루': pre([null, {}, null]),
    '3루2아웃': pre([null, null, {}], 2),
    '기록없음': {},
    '볼카운트2아웃': { count: { b: 0, s: 0, o: 2 } },
  };
  function passing() { return Object.keys(AB).filter(function (k) { return window._sfPass(AB[k]); }).join(' '); }
  function snap() { return { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, p: AS.pitchers, zh: AS.zoneHistory, hs: AS.hs, as: AS.as, ap: $('app-page').style.display, th: $('tHome').value, ta: $('tAway').value, sp: window._sharedPayload, push: window.pushSharedLink, sl: window._shareLinks }; }
  function back(S) {
    AS.abs = S.abs; AS.home_lineup = S.hl; AS.away_lineup = S.al; AS.pitchers = S.p; AS.zoneHistory = S.zh; AS.hs = S.hs; AS.as = S.as;
    $('tHome').value = S.th; $('tAway').value = S.ta; $('app-page').style.display = S.ap; window._sharedPayload = S.sp; window.pushSharedLink = S.push; window._shareLinks = S.sl;
    try { closeShareQR(); } catch (e) {}
    try { dismissSharedBanner(); } catch (e) {}
    window._sfReset();
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await sleep(2500);
    ok(window._sfPass && chip('risp') && chip('on') && chip('empty') && chip('two'), '칩 4개');
  });

  test('칩을 누르면 그 상황의 타석만 — 한 번에 하나, 다시 누르면 꺼진다', function () {
    try {
      chip('risp').click();
      eq(passing(), '2루 3루2아웃', '득점권');
      ok(chip('risp').classList.contains('sfc-on'), '칩 켜짐');
      eq(window._sfCount(), 1, '필터 수');
      chip('on').click();
      eq(passing(), '1루 2루 3루2아웃', '주자 있음');
      ok(!chip('risp').classList.contains('sfc-on'), '앞 칩 꺼짐');
      chip('empty').click();
      eq(passing(), '빈', '주자 없음 — 기록 없는 타석은 들어가지 않는다');
      chip('two').click();
      eq(passing(), '3루2아웃 볼카운트2아웃', '2아웃');
      chip('two').click();
      eq(window._sfCount(), 0, '다시 누르면 꺼짐');
      eq(passing(), Object.keys(AB).join(' '), '필터 없음 = 전부');
    } finally { window._sfReset(); }
  });

  test('샘플 경기처럼 주자가 true/false 로 적힌 타석도 같게 판정한다', function () {
    try {
      chip('risp').click();
      ok(window._sfPass(pre([false, true, false])), '2루 = 득점권');
      ok(!window._sfPass(pre([true, false, false])), '1루 = 득점권 아님');
      chip('empty').click();
      ok(window._sfPass(pre([false, false, false])), '빈 베이스 = 주자 없음');
    } finally { window._sfReset(); }
  });

  test('다른 조건과 함께 걸린다', function () {
    try {
      window._sfSetState({ hand: 'L' });
      chip('risp').click();
      eq(window._sfCount(), 2, '손 + 주자');
      ok(!window._sfPass({ hand: 'R', gfPre: { bases: [null, {}, null] } }), '우투수 = 탈락');
      ok(window._sfPass({ hand: 'L', gfPre: { bases: [null, {}, null] } }), '좌투수 + 득점권 = 통과');
      ok(!window._sfPass({ hand: 'L', gfPre: { bases: [{}, null, null] } }), '좌투수 + 1루 = 탈락');
    } finally { window._sfReset(); }
  });

  test('받은 필터 · 초기화가 주자 상황을 끈다', function () {
    try {
      chip('risp').click();
      eq(window._sfState(), null, '주자 상황만 = 실을 조건 없음');
      eq(window._sfLabel(), '', '공유 창 안내 없음');
      window._sfSetState({ hand: 'L' });
      eq(window._sfState(), { pt: [], res: [], hand: 'L', count: null }, '받은 필터');
      eq(window._sfCount(), 1, '주자 상황은 꺼짐');
      ok(!chip('risp').classList.contains('sfc-on'), '칩도 꺼짐');
      window._sfSetState({});
      chip('two').click();
      window._sfReset();
      eq(window._sfCount(), 0, '초기화');
      ok(!chip('two').classList.contains('sfc-on'), '칩 꺼짐');
    } finally { window._sfReset(); }
  });

  test('보내기: 주자 상황은 링크에 싣지 않고 다른 조건만 싣는다', function () {
    var S = snap(), got = null;
    try {
      AS.abs = [Object.assign({ bid: 'b1', bname: '김타자', bnum: 7, team: 'home', res: '안타', pt: '직구', x: 0.4, y: 0.4, deg: 80, inn: '1회초', hand: 'L' }, pre([null, {}, null]))];
      window.pushSharedLink = function (p, done) { got = p; done('t1'); };
      chip('risp').click();
      window._shareLinks = {};
      window._shareGameBuild(false);
      ok(got && !('sf' in got), '주자 상황만 켰는데 sf 가 실림');
      eq($('shareFilterNote').style.display, 'none', '공유 창 안내 숨김');
      ok(!('gfPre' in got.abs[0]), '타석에 gfPre 가 실림');

      window._sfSetState({ hand: 'L' });
      chip('risp').click();
      window._shareLinks = {};
      window._shareGameBuild(false);
      eq(got.sf, { pt: [], res: [], hand: 'L', count: null }, '손만 실린다');
      eq($('shareFilterNote').textContent, '지금 필터도 같이 보내요 · 좌투수 상대', '공유 창 안내');
    } finally { back(S); }
  });

  test('받기: 필터 없는 링크를 열어도 주자 상황이 꺼져 타구가 다 보인다', async function () {
    var S = snap();
    var payload = { v: 3, ht: '홈팀A', at: '원정B', hs: 1, as: 0, hl: [], al: [], pitchers: [],
      abs: [{ bid: 'b1', bn: '김타자', bno: 7, t: 'home', r: '안타', p: '직구', x: 0.4, y: 0.4, d: 80, i: '1회초' },
            { bid: 'b2', bn: '이타자', bno: 8, t: 'home', r: '땅볼 아웃', p: '커브', x: 0.6, y: 0.6, d: 100, i: '1회초' }] };
    try {
      chip('risp').click();
      eq(window._sfCount(), 1, '연 사람이 켜 둔 주자 상황');
      window._sharedPayload = payload;
      loadSharedGame(); await sleep(700);
      eq(window._sfCount(), 0, '주자 상황 꺼짐');
      ok(!chip('risp').classList.contains('sfc-on'), '칩 꺼짐');
      eq(AS.abs.filter(window._sfPass).length, 2, '링크의 타구가 다 보인다');
    } finally { back(S); }
  });

  test('휴대폰: 상세 필터 칩 · 버튼이 44px 이상이다', function () {
    try {
      window._sfOpen();
      var small = [].slice.call(document.querySelectorAll('#sfPanel .sfc, #sfPanel .sfp-x, #sfPanel .sfp-reset, #sfPanel .sfp-apply')).filter(function (el) {
        var r = el.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      }).map(function (el) { return el.textContent; });
      eq(small, [], '44px 보다 작은 칸');
    } finally { window._sfClose(); }
  });

  test('(정리) 공유 테스트가 남긴 자동저장 예약 · 스냅샷을 비운다', async function () {
    try { storageManager.cancelPendingAutosave(); } catch (e) {}
    await sleep(3500);
    for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && (k === 'sl_autosave' || k.indexOf('sl_auto_') === 0)) localStorage.removeItem(k); }
    ok(true);
  });
})();
