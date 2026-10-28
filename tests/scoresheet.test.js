// 리그 기록지 (js/features/scoresheet.js) — 칸 약어 · 타순(교체 포함) · 득점한 타석 · 이닝 수 · R H E · 창(이미지 · 인쇄 · 닫기 · Esc) · 진입 버튼(경기종료 → GAME REPORT 포함)
//  · 순수 함수는 앱이 올린 같은 모듈 인스턴스로 부르고, 경기 운영 모드 득점은 실제 recOther 로 적어 확인한다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var MOD = '/js/features/scoresheet.js?v=5';   // js/app.js 가 import 하는 것과 같은 주소여야 같은 인스턴스다
  var F = ['abs', 'home_lineup', 'away_lineup', 'hs', 'as', 'zoneHistory', 'pitchers', 'currentPitcher', 'pitchLog', 'currentPitches', 'info', 'curGame', 'batter', 'balls', 'strikes', 'outs', 'curTeam', 'pendingQuickRes'];
  var GK = ['active', 'inning', 'half', 'first', 'outs', 'batterIdx', 'bases', 'runners'];

  async function isolated(fn) {
    var store = {}, a = {}, g = {}, ck = window._curSaveKey, gs = window._gameSaved, ak = window._autoKey, cs = window.cloudAutoSyncRecord, raf = window.requestAnimationFrame,
      th = $('tHome').value, ta = $('tAway').value;
    for (var i = 0; i < localStorage.length; i++) store[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    F.forEach(function (k) { a[k] = AS[k]; });
    GK.forEach(function (k) { g[k] = GF[k]; });
    window.cloudAutoSyncRecord = function () {};
    window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); };
    try { await fn(); }
    finally {
      window.requestAnimationFrame = raf;
      closeScoresheet();
      gfDeactivate();
      GK.forEach(function (k) { GF[k] = g[k]; });
      storageManager.cancelPendingAutosave(); clearTimeout(_autoTimer); localStorage.clear();
      Object.keys(store).forEach(function (k) { localStorage.setItem(k, store[k]); });
      F.forEach(function (k) { AS[k] = a[k]; });
      $('tHome').value = th; $('tAway').value = ta;
      $('scH').textContent = AS.hs; $('scA').textContent = AS.as;
      window._curSaveKey = ck; window._gameSaved = gs; window._autoKey = ak; window.cloudAutoSyncRecord = cs;
      var p = $('slRunPick'); if (p) p.remove();
      $('gfEndOv').classList.remove('show'); $('pgReport').style.display = 'none'; $('pgCard').classList.remove('up');
      try { renderLP(); renderRecs(); renderCount(); shellNav('record'); } catch (e) {}
    }
  }
  function fresh() {
    AS.abs = []; AS.hs = 0; AS.as = 0; AS.zoneHistory = {}; AS.info = null;
    AS.pitchers = []; AS.currentPitcher = null; AS.pitchLog = []; AS.currentPitches = []; AS.batter = null; AS.balls = 0; AS.strikes = 0; AS.outs = 0; AS.pendingQuickRes = null;
    AS.curGame = null; window._curSaveKey = null; window._autoKey = null; window._gameSaved = true;
  }
  var P = function (id, name, num, bench) { return { id: id, name: name, num: num, pos: '', bh: '', isStarter: !bench }; };
  var pa = function (bid, bname, team, inn, res, more) { return Object.assign({ id: Math.random(), bid: bid, bname: bname, bnum: '', team: team, inn: inn, res: res, rbi: 0, x: null, dir: null }, more || {}); };
  async function waitImg() {
    for (var i = 0; i < 80 && !($('ssImg').src || '').startsWith('data:'); i++) await T.sleep(50);
    ok(($('ssImg').src || '').startsWith('data:'), '기록지 그림이 그려지지 않음');
    for (var j = 0; j < 40 && !$('ssImg').naturalWidth; j++) await T.sleep(25);
  }

  test('기록지: 칸 약어 — 방향은 필드를 탭한 타구만 · 내야안타는 방향 없이 · 그 밖의 결과는 중계 약어 · 모르는 결과는 그대로', async function () {
    var m = await import(MOD), c = m.cellCode;
    var t = function (res, dir) { return c({ res: res, dir: dir || null, x: dir ? 0.3 : null }); };
    eq([t('안타', 'LF'), t('안타', 'LC'), t('안타', 'CF'), t('안타', 'RC'), t('안타', 'RF'), t('안타')], ['좌안', '좌중안', '중안', '우중안', '우안', '안타'], '안타');
    eq([t('2루타', 'RC'), t('3루타', 'RF'), t('홈런', 'LC'), t('2루타'), t('3루타'), t('홈런')], ['우중2', '우3', '좌중홈', '2루타', '3루타', '홈런'], '장타');
    eq([t('플라이 아웃', 'CF'), t('플라이 아웃'), t('땅볼 아웃', 'LF')], ['중비', '뜬공', '땅볼'], '아웃 (땅볼은 수비수를 몰라 방향 없이)');
    eq(c({ res: '내야안타', dir: 'CF', x: 0.5 }), '내야안', '내야안타 버튼의 중견 기본값은 방향으로 쓰지 않는다');
    eq(c({ res: '안타', dir: 'LF', x: null }), '안타', '방향만 있고 탭 좌표가 없으면 방향 없이');
    eq(['삼진', '볼넷', '사구', '희타', '희비', '병살', '실책', '야수선택'].map(function (r) { return t(r); }), ['삼진', '4구', '사구', '희번', '희플', '병살', '실책', '야선'], '그 밖의 결과');
    eq([t('타격방해'), c(null), c({})], ['타격방해', '', ''], '모르는 결과 · 빈 값');
  });

  test('기록지: 타순 — 지금 주전 순서 · 교체(대타)는 나간 선수 아래 · 라인업에 없는 타자는 맨 아래 · 타석 없는 후보와 상대 팀은 빠진다', async function () {
    var m = await import(MOD);
    var lu = [P('h1', '일번', '1'), P('h9', '대타맨', '9'), P('h3', '삼번', '3'), P('h2', '이번', '2', true), P('h8', '후보', '8', true)];   // 교체 뒤 라인업 (이번 → 후보)
    var abs = [
      pa('h1', '일번', 'home', '1회초', '안타'),
      pa('h2', '이번', 'home', '1회초', '삼진', { runEv: [{ t: 'SUB', k: 'PH', id: 'h9', name: '대타맨', num: '9', out: { id: 'h2', name: '이번', num: '2' }, team: 'home', inn: '1회초' },
        { t: 'SUB', k: 'P', id: 'h8', name: '후보', num: '8', out: { id: 'h3', name: '삼번', num: '3' }, team: 'home', inn: '1회초' }] }),
      pa('h3', '삼번', 'home', '1회초', '볼넷'),
      pa('a1', '원정일', 'away', '1회말', '안타'),
      pa('x1', '손님', 'home', '2회초', '땅볼 아웃'),
      pa('h9', '대타맨', 'home', '3회초', '홈런', { x: 0.3, dir: 'RF' }),
    ];
    var rows = m.sheetRows(abs, lu, 'home');
    eq(rows.map(function (r) { return [r.slot, r.p.name, r.tag, r.abs.length]; }),
      [[1, '일번', '', 1], [2, '이번', '', 1], [null, '대타맨', '대타', 1], [3, '삼번', '', 1], [null, '손님', '', 1]], '줄 (투수 교체는 타순과 무관)');
    eq(m.sheetRows(abs, [], 'away').map(function (r) { return [r.slot, r.p.name, r.abs.length]; }), [[null, '원정일', 1]], '라인업이 없으면 타석 순');
    eq(m.sheetRows(null, null, 'home'), [], '빈 경기');
  });

  test('기록지: 득점한 타석 — 홈인한 주자의 그 전 마지막 타석 (홈런 타자 · 폭투 홈인 포함) · 이름 없는 주자 · 다른 팀은 표시하지 않는다', async function () {
    var m = await import(MOD);
    var A = pa('h1', '일번', 'home', '1회초', '안타', { scored: [] }),
      B = pa('h2', '이번', 'home', '1회초', '2루타', { scored: [{ id: 'h1', name: '일번' }] }),
      C = pa('a1', '원정일', 'away', '1회말', '홈런', { scored: [{ id: 'a1', name: '원정일' }, { id: null, name: null }] }),
      D = pa('h3', '삼번', 'home', '2회초', '안타', { scored: [], runEv: [{ t: 'WP', id: 'h2', name: '이번', team: 'home', scored: true }, { t: 'SB', id: 'h3', name: '삼번', team: 'home', scored: false }] }),
      E = pa('h1', '일번', 'away', '2회말', '삼진', { scored: [] });   // 같은 id 의 상대 팀 타자
    var s = m.scoredSet([A, B, C, D, E]);
    eq([A, B, C, D, E].map(function (x) { return s.has(x); }), [true, true, true, false, false], '득점 표시');
  });

  test('기록지: 이닝 수 · R H E · 선공 팀이 위 · 경기 운영 모드가 아니면 득점 · 도루 빈칸 · 게임원 가져오기 점수표(info.ls) 우선', async function () {
    var m = await import(MOD);
    var g = { abs: [pa('h1', '일번', 'home', '1회초', '안타'), pa('h2', '이번', 'home', '1회초', '실책'), pa('h1', '일번', 'home', '11회초', '삼진')],
      home_lineup: [P('h1', '일번', '1'), P('h2', '이번', '2')], away_lineup: [], info: { innings: 9 }, hs: 3, as: 1, th: '우리팀', ta: '' };
    var d = m.sheetData(g);
    eq(d.n, 11, '경기 정보 9이닝보다 긴 연장 11회까지');
    eq(d.teams.map(function (t) { return [t.team, t.side, t.name, t.first]; }), [['home', '홈', '우리팀', true], ['away', '원정', '원정', false]], '1회 첫 타석 팀이 위 · 이름 없으면 원정');
    var h = d.teams[0], a = d.teams[1];
    eq([h.r, h.h, h.e, a.r, a.h, a.e], [3, 1, '', 1, '', 1], 'R = 점수 · H = 안타 · E = 상대 타자 실책 출루 (상대 타석이 없으면 빈칸)');
    eq(h.rows[0].tot, [2, 1, 0, '', 0, 0, 1, ''], '일번: 타수 안타 타점 득점 4구 사구 삼진 도루 — 득점 · 도루는 모름');
    eq(h.tot, [3, 1, 0, '', 0, 0, 1, ''], '합계');
    eq(h.rows[0].cells[0].map(function (p) { return p.code; }), ['안타'], '1회 칸'); eq(h.rows[0].cells[10].map(function (p) { return p.code; }), ['삼진'], '11회 칸');
    eq(h.line, ['', '', '', '', '', '', '', '', '', '', ''], '이닝별 득점을 모르면 빈칸 (손으로 적는다)');
    eq(a.rows, [], '원정 기록 없음');
    eq(m.sheetData({ abs: [], info: null }).n, 7, '기본 7이닝');
    eq(m.sheetData({ abs: g.abs, info: { innings: 5, ls: { away: [1, 0], home: [0, 2] } } }).teams.map(function (t) { return t.line.slice(0, 3); }), [['0', '2', ''], ['1', '0', '']], '게임원 점수표 (홈이 위)');
  });

  test('기록지: 경기 운영 모드로 적은 경기 — 밀어내기 볼넷 득점이 이닝 점수 · 득점한 타석 · 선수 득점 · 타점 칸에 나온다', async function () {
    await isolated(async function () {
      var m = await import(MOD);
      fresh();
      AS.curTeam = 'home';
      AS.home_lineup = ['일번', '이번', '삼번', '사번'].map(function (n, i) { return P('sh' + (i + 1), n, String(i + 1)); });
      AS.away_lineup = [P('sa1', '원정일', '11')];
      renderLP();
      GF.first = 'home';
      gfActivate();
      for (var i = 0; i < 4; i++) { await T.sleep(750); recOther('볼넷'); }   // recOther 연타 방지(0.7초)
      eq(AS.hs, 1, '밀어내기 1점');
      AS.abs[3].rbi = 1;
      var d = m.sheetData({ abs: AS.abs, home_lineup: AS.home_lineup, away_lineup: AS.away_lineup, info: AS.info, hs: AS.hs, as: AS.as, th: '홈팀', ta: '원정팀' });
      var h = d.teams[0];
      eq(h.team, 'home', '홈 선공이 위');
      eq(h.line.slice(0, 2), ['1', ''], '1회 1점');
      eq(h.rows.map(function (r) { return [r.p.name, r.tot[3], r.cells[0][0].scored, r.cells[0][0].rbi]; }),
        [['일번', 1, true, 0], ['이번', 0, false, 0], ['삼번', 0, false, 0], ['사번', 0, false, 1]], '득점 · 득점한 타석 · 타점');
      eq(h.tot[3], 1, '합계 득점'); eq(h.rows[0].tot[7], 0, '도루 0 (경기 운영 모드라 아는 값)');
    });
  });

  test('기록지 창: A4 그림 · 이미지 저장 · 인쇄(그림 한 장만) · 닫기 · 타석이 없으면 안내', async function () {
    await isolated(async function () {
      fresh();
      AS.home_lineup = [P('h1', '일번', '1')]; AS.away_lineup = [P('a1', '원정일', '11')];
      AS.abs = [pa('a1', '원정일', 'away', '1회초', '안타', { x: 0.3, dir: 'LF' }), pa('h1', '일번', 'home', '1회말', '삼진')];
      AS.info = { date: '2026-10-25', venue: '목동', innings: 7 };
      $('tHome').value = '홈팀'; $('tAway').value = '원정팀';
      openScoresheet();
      ok(!$('ssView').hidden, '창 열림'); ok(document.documentElement.classList.contains('rp-open'), '뒤 화면 스크롤 잠금');
      ok($('ssEmpty').hidden && !$('ssAct').hidden && !$('ssView').classList.contains('ss-none'), '안내 숨김 · 버튼 보임');
      await waitImg();
      eq([$('ssImg').naturalWidth, $('ssImg').naturalHeight], [1588, 2246], 'A4 세로 2배 (794 × 1123)');
      ok(!$('ssSave').disabled && !$('ssPrint').disabled, '그린 뒤 버튼 켜짐');
      $('ssImg').click(); if (document.activeElement) document.activeElement.blur();   // 이미지를 누르면 포커스가 창 밖(body)으로
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      ok($('ssView').hidden, '창 안을 누른 뒤에도 Esc 로 닫힌다');
      openScoresheet(); await waitImg();
      var dl = window._downloadCanvas, got = null;
      window._downloadCanvas = function (cv, name) { got = [cv.width, cv.height, name]; };
      try { $('ssSave').click(); } finally { window._downloadCanvas = dl; }
      ok(got && got[0] === 1588 && got[1] === 2246 && /^spraylab_scoresheet_\d+\.png$/.test(got[2]), '이미지 저장: ' + JSON.stringify(got));
      var pr = window.print, printed = false;
      window.print = function () { printed = document.body.classList.contains('ss-printing'); };
      try { $('ssPrint').click(); } finally { window.print = pr; }
      ok(printed, '인쇄하는 동안 body.ss-printing');
      window.dispatchEvent(new Event('afterprint'));
      ok(!document.body.classList.contains('ss-printing'), '인쇄 뒤 원래대로');
      $('ssClose').click();
      ok($('ssView').hidden && !document.documentElement.classList.contains('rp-open'), '닫기');
      AS.abs = [];
      openScoresheet();
      ok(!$('ssEmpty').hidden && $('ssAct').hidden && $('ssPrev').hidden, '타석이 없으면 안내만');
      var pr2 = $('ssView').querySelector('.rp-panel').getBoundingClientRect();
      ok($('ssView').classList.contains('ss-none') && pr2.height < innerHeight * 0.8, '안내만 있을 때 창은 안내 크기 (빈 큰 판 아님): ' + Math.round(pr2.height) + ' / ' + innerHeight);
      $('ssView').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      ok($('ssView').hidden, 'Esc 로 닫기');
    });
  });

  test('기록지 진입: ☰ 메뉴 내보내기 · 그 밖의 기능 · 경기종료 버튼 → 확인 → GAME REPORT 공유 줄 [리그 기록지] (리포트 위에 열고 닫으면 리포트로)', async function () {
    await isolated(async function () {
      ok(document.querySelector('.slm-item[onclick^="openScoresheet"]'), '☰ 메뉴 내보내기');
      shellNav('settings');
      for (var i = 0; i < 20 && !document.querySelector('#stMore [onclick^="openScoresheet"]'); i++) await T.sleep(50);
      ok(document.querySelector('#stMore [onclick^="openScoresheet"]'), '그 밖의 기능 · 내보내기');
      shellNav('record');
      fresh();
      AS.curTeam = 'home';
      AS.home_lineup = [P('eh1', '일번', '1'), P('eh2', '이번', '2')]; AS.away_lineup = [P('ea1', '원정일', '11')];
      renderLP();
      GF.first = 'home';
      gfActivate();
      await T.sleep(750); recOther('볼넷');
      var cf = window.confirm, asked = '';
      window.confirm = function (m) { asked = m; return true; };
      try { document.querySelector('.gfb-end').click(); } finally { window.confirm = cf; }   // 경기 운영 바의 실제 경기종료 버튼
      ok(/경기를 종료/.test(asked), '종료 확인을 묻는다: ' + asked);
      for (var j = 0; j < 40 && $('pgReport').style.display !== 'flex'; j++) await T.sleep(50);
      eq($('pgReport').style.display, 'flex', '경기종료 → GAME REPORT');
      eq([].map.call(document.querySelectorAll('#pgReport .pg-share-row button'), function (b) { return b.textContent.replace(/\p{Extended_Pictographic}️?\s?/gu, '').trim(); }), ['스토리 9:16', '피드 1:1', '리그 기록지'], 'GAME REPORT 공유 줄');
      eq(document.querySelectorAll('#pgSheetBtn').length, 1, '버튼은 하나만');
      $('pgSheetBtn').click();
      ok(!$('ssView').hidden, '기록지가 열린다');
      await waitImg();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      ok($('ssView').hidden && $('pgReport').style.display === 'flex', '기록지를 닫으면 GAME REPORT 가 그대로 있다');
    });
  });
})();
