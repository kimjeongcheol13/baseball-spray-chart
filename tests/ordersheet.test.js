// 오더지 (js/features/ordersheet.js) — 주전 타순 · 후보 · 빈 줄 · 수비 위치 번호 · 팀 이름 · 창(팀 고르기 · 이미지 · 인쇄 · 닫기) · 진입 버튼
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var MOD = '/js/features/ordersheet.js?v=1';   // js/app.js 가 import 하는 것과 같은 주소여야 같은 인스턴스다
  var P = function (id, name, num, pos, bench) { return { id: id, name: name, num: num, pos: pos || '', bh: '', isStarter: !bench }; };

  async function isolated(fn) {
    var a = { home: AS.home_lineup, away: AS.away_lineup, info: AS.info, cur: AS.curTeam }, th = $('tHome').value, ta = $('tAway').value;
    try { await fn(); }
    finally {
      closeOrderSheet();
      AS.home_lineup = a.home; AS.away_lineup = a.away; AS.info = a.info; AS.curTeam = a.cur;
      $('tHome').value = th; $('tAway').value = ta;
      try { shellNav('record'); } catch (e) {}
    }
  }
  async function waitImg() {
    for (var i = 0; i < 80 && !($('osImg').src || '').startsWith('data:'); i++) await T.sleep(50);
    ok(($('osImg').src || '').startsWith('data:'), '오더지 그림이 그려지지 않음');
    for (var j = 0; j < 40 && !$('osImg').naturalWidth; j++) await T.sleep(25);
  }

  test('오더지: 주전 = 지금 순서대로 타순 · 후보는 아래 · 9줄 / 5줄이 안 되면 빈 줄 · 수비 위치 번호 · 팀 이름', async function () {
    var m = await import(MOD);
    var home = [P(1, '일번', '7', '유격'), P(2, '후보맨', '', '', true), P(3, '이번', 12, 'DH'), P(4, '삼번', '', '')];
    var d = m.orderData({ team: 'home', home_lineup: home, away_lineup: [P(9, '원정일', '1', '투수')], th: '우리팀', ta: '상대팀', date: '2026.10.28', venue: '목동' });
    eq([d.side, d.name, d.opp, d.date, d.venue], ['홈', '우리팀', '상대팀', '2026.10.28', '목동'], '머리');
    eq(d.starters.slice(0, 3), [{ name: '일번', num: '7', pos: '유격 (6)' }, { name: '이번', num: '12', pos: 'DH' }, { name: '삼번', num: '', pos: '' }], '주전 (DH 는 번호 없이)');
    eq([d.starters.length, d.starters[3].name, d.bench.length, d.bench[0].name, d.bench[1].name], [9, '', 5, '후보맨', ''], '빈 줄');
    var a = m.orderData({ team: 'away', home_lineup: home, away_lineup: [P(9, '원정일', '1', '투수')], th: '우리팀', ta: '' });
    eq([a.side, a.name, a.opp, a.starters[0].pos], ['원정', '', '우리팀', '투수 (1)'], '원정 · 이름 없으면 빈칸');
    var many = Array.from({ length: 11 }, function (_, i) { return P(i, 'p' + i, String(i)); });
    eq(m.orderData({ team: 'home', home_lineup: many }).starters.length, 11, '10명 넘는 주전은 그대로');
    var e = m.orderData({ team: 'home', home_lineup: null });
    eq([e.starters.length, e.bench.length, e.name], [9, 5, ''], '라인업이 비어도 빈 양식');
  });

  test('오더지 창: 처음엔 보고 있던 팀 · 홈/원정 고르기 · A4 그림 · 이미지 저장 · 인쇄(그림 한 장만) · 닫기 · Esc', async function () {
    await isolated(async function () {
      AS.home_lineup = [P('h1', '일번', '1', '중견')]; AS.away_lineup = [P('a1', '원정일', '11', '포수')];
      AS.info = { date: '2026-10-28', venue: '목동' }; AS.curTeam = 'away';
      $('tHome').value = '홈팀'; $('tAway').value = '원정팀';
      openOrderSheet();
      ok(!$('osView').hidden && document.documentElement.classList.contains('rp-open'), '창 열림 · 뒤 화면 스크롤 잠금');
      await waitImg();
      eq([].map.call($('osTeam').querySelectorAll('button.on'), function (b) { return b.dataset.team; }), ['away'], '라인업 탭에서 보던 원정이 먼저');
      eq([$('osImg').naturalWidth, $('osImg').naturalHeight], [1588, 2246], 'A4 세로 2배 (794 × 1123)');
      var first = $('osImg').src;
      $('osTeam').querySelector('[data-team="home"]').click();
      for (var i = 0; i < 80 && $('osImg').src === first; i++) await T.sleep(50);
      ok($('osImg').src !== first && $('osTeam').querySelector('[data-team="home"]').classList.contains('on'), '홈으로 바꾸면 다시 그린다');
      for (var j = 0; j < 40 && $('osSave').disabled; j++) await T.sleep(25);
      var dl = window._downloadCanvas, got = null;
      window._downloadCanvas = function (cv, name) { got = [cv.width, cv.height, name]; };
      try { $('osSave').click(); } finally { window._downloadCanvas = dl; }
      ok(got && got[0] === 1588 && got[1] === 2246 && /^spraylab_order_\d+\.png$/.test(got[2]), '이미지 저장: ' + JSON.stringify(got));
      var pr = window.print, printed = false;
      window.print = function () { printed = document.body.classList.contains('os-printing'); };
      try { $('osPrint').click(); } finally { window.print = pr; }
      ok(printed, '인쇄하는 동안 body.os-printing');
      window.dispatchEvent(new Event('afterprint'));
      ok(!document.body.classList.contains('os-printing'), '인쇄 뒤 원래대로');
      $('osClose').click();
      ok($('osView').hidden && !document.documentElement.classList.contains('rp-open'), '닫기');
      AS.home_lineup = []; AS.away_lineup = []; AS.curTeam = 'home';
      openOrderSheet();
      await waitImg();
      ok(!$('osSave').disabled, '라인업이 비어도 빈 양식을 그린다');
      $('osView').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      ok($('osView').hidden, 'Esc 로 닫기');
    });
  });

  test('오더지 진입: ☰ 메뉴 내보내기 · 그 밖의 기능 라인업 · 팀 · 버튼 높이 44px 이상', async function () {
    await isolated(async function () {
      ok(document.querySelector('.slm-item[onclick^="openOrderSheet"]'), '☰ 메뉴 내보내기');
      shellNav('settings');
      for (var i = 0; i < 20 && !document.querySelector('#stMore [onclick^="openOrderSheet"]'); i++) await T.sleep(50);
      var b = document.querySelector('#stMore [onclick^="openOrderSheet"]');
      ok(b, '그 밖의 기능 · 라인업 · 팀');
      b.click();
      ok(!$('osView').hidden, '누르면 창이 열린다');
      await waitImg();
      [].forEach.call(document.querySelectorAll('#osView button'), function (x) { ok(x.getBoundingClientRect().height >= 44, '터치 높이 44px 미만: ' + x.id + ' ' + x.textContent.trim()); });
    });
  });
})();
