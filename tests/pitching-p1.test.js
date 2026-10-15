// 투구 기록 P1 — 실제 index.html 의 recordPitch · 결과 시트 · 이닝(#innSel) · 수정 화면 · 분석 엑셀을 그대로 돌린다.
//  · 헛스윙 / 루킹: pr 에 그대로, 옛 클라이언트용 result 는 '스트라이크'. P1 전 '스트라이크'는 '스트라이크(구분 없음)'. 스트라이크%는 셋 다
//  · 이닝: 경기 첫 공에서 한 번 묻는다(기본 = 지금 이닝). 3아웃이면 다음 회의 같은 초/말(1회초 → 2회초). 되돌리기 · 낫아웃이면 원래 이닝
//  · 결과 미기록 채우기: 이번 경기 + 저장된 경기(마지막 저장본에만 쓴다). 고르면 지표가 다시 계산된다
//  · 이 앱보다 새 버전이 만든 기록(v 3 이상 · 모르는 값) → 경고 문구
// 가상 데이터만 쓴다.
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$, sleep = T.sleep;
  var PC = function () { return window.PitchCalc; };
  var REAL = 1780300000000;   // 실제 시각 같은 타석 id (경기 식별에 쓰인다)

  function inn(v) { if (v != null) { $('innSel').value = v; } return $('innSel').value; }
  function fresh(opts) {   // 새 경기처럼: 투수 목록이 새 배열 → 첫 공에서 이닝을 묻는다
    AS.pitchers = []; AS.currentPitcher = null; AS.pitchLog = []; AS.batter = null; AS.pitchNewPA = false; AS._pitchInnAuto = null;
    AS.pitcherZone = null; AS.pitcherZoneX = null; AS.pitcherZoneY = null; AS.pitcherPt = null;
    ['pitchEndSheet', 'pitchInnSheet', 'pitchFixSheet'].forEach(function (id) { var e = $(id); if (e) e.remove(); });
    if (window.GF) GF.active = false;
    inn((opts && opts.inn) || '1회초');
    if (!(opts && opts.ask)) window._pitchInnAskedFor = AS.pitchers;
  }
  function pitcher(id, name) { var p = { id: id, name: name, num: '1', role: 'SP', pitches: [] }; AS.pitchers.push(p); AS.currentPitcher = p; return p; }
  function batter(id, name) { AS.batter = { id: id, name: name, num: '9' }; }
  function rec() { for (var i = 0; i < arguments.length; i++) recordPitch(arguments[i]); }
  function last(p) { return p.pitches[p.pitches.length - 1]; }
  function stubDownload() {
    var oc = URL.createObjectURL, ok_ = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function () { return 'blob:stub'; }; HTMLAnchorElement.prototype.click = function () {};
    return function () { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok_; };
  }

  test('(준비) 앱 시작 작업이 끝날 때까지 기다린다', async function () { await sleep(2500); ok(true); });

  // ═══ 헛스윙 / 루킹 ═══
  test('헛스윙 · 루킹: pr 에 그대로 남고 옛 클라이언트용 result 는 스트라이크 · 세 번째는 삼진 · 2스트라이크 파울은 카운트 유지', function () {
    fresh(); var p = pitcher(1, '투수'); batter('a', '가');
    rec('헛스윙', '루킹');
    eq(p.pitches.map(function (x) { return [x.pr, x.result, x.end || null]; }), [['헛스윙', '스트라이크', null], ['루킹', '스트라이크', null]], '저장값');
    rec('파울'); eq(PC().countOf(p.pitches), { b: 0, s: 2 }, '2스트라이크 파울');
    rec('헛스윙'); eq([last(p).pr, last(p).result, last(p).end], ['헛스윙', '삼진', '삼진'], '세 번째 스트라이크 → 삼진 (옛 클라이언트도 삼진으로 읽는다)');
    var S = PC().calcPitching([{ pitches: p.pitches }]); eq([S.sPct, S.k, S.pa], [1, 1, 1], '스트라이크% · 삼진');
  });
  test('P1 전 "스트라이크"는 "스트라이크(구분 없음)"으로 읽히고, 스트라이크%에서는 헛스윙 · 루킹 · 구분 없음이 모두 스트라이크', function () {
    eq(PC().prLabel({ id: 1, result: '스트라이크', batter: 'A' }), '스트라이크(구분 없음)', '옛 기록(v1)');
    eq(PC().prLabel({ v: 2, pr: '스트라이크', result: '스트라이크' }), '스트라이크(구분 없음)', 'P0 기록(v2)');
    eq([PC().prLabel({ v: 2, pr: '헛스윙', result: '스트라이크' }), PC().prLabel({ v: 2, pr: '루킹', result: '스트라이크' })], ['헛스윙', '루킹'], 'P1 기록');
    var mix = [{ id: 1, result: '스트라이크', batter: 'A' }, { id: 2, v: 2, pa: 2, pr: '헛스윙', result: '스트라이크' }, { id: 3, v: 2, pa: 2, pr: '루킹', result: '스트라이크' }, { id: 4, v: 2, pa: 2, pr: '볼', result: '볼' }];
    eq(PC().calcPitching([{ pitches: mix }]).strikes, 3, '스트라이크 3 · 볼 1');
  });
  test('입력 버튼: 폰 하단 줄과 넓은 화면 모두 스트라이크 대신 헛스윙 · 루킹', function () {
    var q = Array.prototype.map.call(document.querySelectorAll('.mobile-pitch-quick-bar .mobile-pitch-qbtn'), function (b) { return b.textContent.replace(/[A-Z▼\s]/g, ''); });
    eq(q, ['헛스윙', '루킹', '볼', '파울', '타격결과'], '폰 하단 줄');
    var d = Array.prototype.filter.call(document.querySelectorAll('#mobile-pitch-collapse .ptr-btn'), function (b) { return /recordPitch\('(볼|스트라이크|헛스윙|루킹|파울)'\)/.test(b.getAttribute('onclick') || ''); }).map(function (b) { return b.textContent.trim(); });
    eq(d, ['볼', '헛스윙', '루킹', '파울'], '넓은 화면 투구 칩');
  });
  test('분석 엑셀 "투구 기록" 시트: 결과 열에 헛스윙 · 루킹 · 스트라이크(구분 없음), 빈 이닝은 "미기록"', async function () {
    var X = await import('/js/features/xlsxreport.js?v=8');
    var ps = [{ id: 11, inning: '', result: '스트라이크', batter: 'A', pt: '직구' }, { id: 12, inning: '2회초', v: 2, pa: 12, pr: '헛스윙', result: '스트라이크', batter: 'B' },
      { id: 13, inning: '2회초', v: 2, pa: 12, pr: '루킹', result: '스트라이크', batter: 'B' }];
    var P = { name: '투수', num: '1', role: 'SP', apps: [{ label: '현재 경기', current: true, pitches: ps }] };
    var restore = stubDownload(), sheets;
    try { sheets = X.exportPitcherXlsx(P, PC().calcPitching(P.apps), PC().calcPitching); } finally { restore(); }
    var sh = sheets.find(function (s) { return s.name === '투구 기록'; }); ok(sh, '투구 기록 시트');
    var row = function (r) { var x = sh.rows.get(r); return [x.get(2).v, x.get(8).v]; };   // 이닝 · 결과 (이닝 뒤 아웃 · 주자 열 — main #108)
    eq([row(1), row(2), row(3)], [['미기록', '스트라이크(구분 없음)'], ['2회초', '헛스윙'], ['2회초', '루킹']], '이닝 · 결과');
  });

  // ═══ 이닝 ═══
  test('경기 첫 공: 몇 회부터인지 묻고(기본 = 지금 이닝), 고른 이닝으로 기록한 뒤에는 다시 묻지 않는다 · 새 경기면 다시 묻는다', function () {
    fresh({ ask: true }); var p = pitcher(1, '투수'); batter('a', '가');
    rec('볼');
    var sh = $('pitchInnSheet'); ok(sh, '이닝 시트가 안 뜸'); eq(p.pitches.length, 0, '고르기 전에는 기록 안 함');
    eq($('pitchInnPick').value, '1회초', '기본값 = 지금 이닝(새 경기는 1회초)');
    $('pitchInnPick').value = '3회초'; sh.querySelector('[data-ok]').click();
    ok(!$('pitchInnSheet'), '시트 닫힘'); eq([inn(), p.pitches.length, last(p).inning], ['3회초', 1, '3회초'], '고른 이닝으로 첫 공 기록');
    rec('볼'); ok(!$('pitchInnSheet'), '두 번째 공부터는 묻지 않음'); eq(last(p).inning, '3회초', '직전 이닝 유지');
    fresh({ ask: true, inn: '3회초' }); pitcher(2, '투수2'); batter('a', '가'); rec('볼');
    ok($('pitchInnSheet'), '새 경기 첫 공이면 다시 물음'); eq($('pitchInnPick').value, '3회초', '기본값은 지금 이닝');
    $('pitchInnSheet').remove();
  });
  test('3아웃 → 다음 회의 같은 초/말 (1회초 → 2회초) · 투수가 바뀌어도 아웃은 이어서 센다 · 다음 공은 새 이닝으로', function () {
    fresh(); var p = pitcher(1, 'A'); batter('a', '가'); rec('헛스윙', '헛스윙', '헛스윙');
    batter('b', '나'); rec('땅볼 아웃');
    eq(inn(), '1회초', '2아웃까지는 그대로');
    ok(/아웃 2/.test($('pitchCountBar').querySelector('.pcnt-dots').getAttribute('aria-label')), '카운트 줄에 아웃 2: ' + $('pitchCountBar').querySelector('.pcnt-dots').getAttribute('aria-label'));
    var q = pitcher(2, 'B'); batter('c', '다'); rec('플라이 아웃');   // 투수 교체 후 세 번째 아웃
    eq(inn(), '2회초', '3아웃 → 2회초'); ok(/2회초로 넘겼어요/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
    batter('a', '가'); rec('볼'); eq(last(q).inning, '2회초', '다음 공은 2회초');
    eq($('pitchInnSel').value, '2회초', '하단 이닝 고르기도 따라옴');
  });
  test('3아웃을 만든 공을 되돌리거나 낫아웃으로 바꾸면 원래 이닝으로 돌아가고, 다시 삼진으로 바꾸면 다시 넘어간다 · 병살은 2아웃', function () {
    fresh({ inn: '4회말' }); var p = pitcher(1, 'A'); batter('a', '가'); rec('병살');
    batter('b', '나'); rec('루킹', '루킹', '헛스윙'); eq(inn(), '5회말', '병살(2) + 삼진(1) → 5회말');
    undoPitch(); eq(inn(), '4회말', '되돌리기 → 4회말'); rec('헛스윙'); eq(inn(), '5회말', '다시 삼진 → 5회말');
    togglePitchNK(); eq(inn(), '4회말', '낫아웃 출루는 아웃이 아님 → 4회말');
    togglePitchNK(); eq(inn(), '5회말', '다시 삼진 → 5회말');
  });
  test('이닝 끝: 9회 다음은 연장 · 경기 흐름 모드(GF)가 켜져 있으면 넘기지 않는다 · 결과 시트로 낸 아웃도 센다', function () {
    eq([_pitchNextInning('8회말'), _pitchNextInning('9회초'), _pitchNextInning('9회말'), _pitchNextInning('연장')], ['9회말', '연장', '연장', null], '다음 이닝');
    var threeK = function () { ['가', '나', '다'].forEach(function (n, i) { batter('k' + i, n); rec('삼진'); }); };   // 타자마다 삼진 하나
    fresh({ inn: '9회초' }); pitcher(1, 'A'); threeK(); eq(inn(), '연장', '9회초 3아웃 → 연장');
    fresh(); var g = pitcher(1, 'A'); GF.active = true; threeK(); eq([inn(), PC().calcPitching([{ pitches: g.pitches }]).outs], ['1회초', 3], 'GF 켜짐 → 3아웃이어도 그대로'); GF.active = false;
    fresh(); var p = pitcher(1, 'A'); AS.curTeam = 'home'; AS.home_lineup = [{ id: 'a', name: '가', num: '1' }, { id: 'b', name: '나', num: '2' }];
    selBatter('a'); rec('삼진'); selBatter('b'); rec('삼진'); selBatter('a'); rec('볼');   // 2아웃, 다음 타석 진행 중
    selBatter('b'); $('pitchEndSheet').querySelector('[data-end="땅볼 아웃"]').click();   // 타자를 바꾸며 시트에서 땅볼 아웃
    eq(inn(), '2회초', '시트에서 고른 아웃으로 3아웃 → 2회초');
  });
  test('하단 이닝 고르기 = 기록 탭 이닝(#innSel): 한쪽을 바꾸면 다른 쪽도 바뀐다', function () {
    fresh(); pitcher(1, 'A'); renderPitchCount();
    var is = $('pitchInnSel'); eq(is.options.length, $('innSel').options.length, '같은 선택지'); eq(is.value, '1회초');
    is.value = '6회말'; is.dispatchEvent(new Event('change', { bubbles: true })); eq(inn(), '6회말', '하단에서 바꾸면 기록 탭 이닝도');
    recStepInning(1); eq(is.value, '7회초', '기록 탭 ▶ 로 바꾸면 하단도');
  });

  // ═══ 결과 미기록 채우기 ═══
  function openFix() { openPitchFix(); return $('pitchFixSheet'); }
  function items() { return Array.prototype.map.call($('pitchFixSheet').querySelectorAll('.pf-item'), function (b) { return b.textContent.replace(/\s+/g, ' ').trim(); }); }
  test('채우기(이번 경기): 결과 없이 넘어간 타석 · 모름 타석이 목록에 나오고, 고르면 그 타석 마지막 공에 결과가 붙어 지표가 다시 계산된다 · 지금 기록 중인 타석은 없다', function () {
    fresh(); AS.abs = []; var p = pitcher(1, 'A'); AS.curTeam = 'home'; AS.home_lineup = [{ id: 'a', name: '가', num: '1' }, { id: 'b', name: '나', num: '2' }, { id: 'c', name: '다', num: '3' }];
    selBatter('a'); rec('볼', '헛스윙');
    selBatter('b'); $('pitchEndSheet').querySelector('[data-end="미상"]').click();   // 가: 모름
    rec('볼');                                                                          // 나: 진행 중
    var S0 = PC().calcPitching([{ pitches: p.pitches, current: true }]); eq([S0.unrec.length, S0.h], [1, 0], '고치기 전');
    var sh = openFix(); var L = items(); eq(L.length, 1, '진행 중인 타석은 목록에 없음: ' + L.join(' | '));
    ok(/지금 경기/.test(L[0]) && /가/.test(L[0]) && /1회초/.test(L[0]) && /2구/.test(L[0]), '목록 내용: ' + L[0]);
    sh.querySelector('.pf-item').click(); sh.querySelector('[data-end="2루타"]').click();
    var first = p.pitches[1]; eq([first.pr, first.end, first.result], ['헛스윙', '2루타', '2루타'], '그 타석 마지막 공에 결과 (pr 그대로, 옛 호환 result)');
    var S1 = PC().calcPitching([{ pitches: p.pitches, current: true }]); eq([S1.unrec.length, S1.h, S1.pa], [0, 1, 1], '다시 계산');
    eq(items().length, 0, '목록이 비었음'); sh.querySelector('[data-close]').click(); ok(!$('pitchFixSheet'), '닫힘');
  });
  test('채우기(저장된 경기): 같은 경기의 마지막 저장본에만 쓰고 · 옛 기록(v1)의 공 종류는 그대로 · 수정 시각 기록 · 지표 다시 계산', async function () {
    fresh(); AS.abs = []; AS.home_lineup = []; AS.away_lineup = [];
    var abs = [0, 1, 2].map(function (i) { return { id: REAL + i * 60000, bid: 'p' + i, bname: '타자' + i, bnum: i + 1, team: 'home', res: '안타', inn: '1회초' }; });
    var v1 = function () { return [{ id: 51, inning: '', result: '볼', batter: '가', pt: '직구' }, { id: 52, inning: '', result: '스트라이크', batter: '가', pt: '직구' }, { id: 53, inning: '', result: '볼', batter: '가', pt: '직구' }, { id: 54, inning: '', result: '안타', batter: '나', pt: '직구' }]; };
    var K1 = 'sl_p1fix_old', K2 = 'sl_p1fix_new', t0 = Date.now() - 86400000;
    var g = function (ts) { return { th: '홈', ta: '원정', hs: 1, as: 0, d: '2026. 5. 31.', ts: ts, abs: abs, home_lineup: [], away_lineup: [], pitchers: [{ id: 9, name: '옛투수', num: '7', pitches: v1() }] }; };
    var saves0 = localStorage.getItem('sl_saves'), mods0 = localStorage.getItem('sl_cloud_mod');
    localStorage.setItem(K1, JSON.stringify(g(t0))); localStorage.setItem(K2, JSON.stringify(g(t0 + 1000)));
    localStorage.setItem('sl_saves', JSON.stringify([{ key: K1, label: K1, ts: t0 }, { key: K2, label: K2, ts: t0 + 1000 }]));
    localStorage.removeItem('sl_cloud_mod');
    try {
      var sh = openFix(); var L = items(); eq(L.length, 1, '두 사본이어도 한 경기 · 한 타석: ' + L.join(' | '));
      ok(/2026\. 5\. 31\./.test(L[0]) && /옛투수/.test(L[0]) && /미기록/.test(L[0]) && /3구/.test(L[0]), '목록 내용(빈 이닝은 미기록): ' + L[0]);
      sh.querySelector('.pf-item').click(); sh.querySelector('[data-end="볼넷"]').click();
      var n = JSON.parse(localStorage.getItem(K2)).pitchers[0].pitches[2], o = JSON.parse(localStorage.getItem(K1)).pitchers[0].pitches[2];
      eq([n.pr, n.result, n.end], ['볼', '볼넷', '볼넷'], '마지막 저장본: 공 종류(볼)는 pr 로 남고 결과가 붙음');
      eq([o.pr, o.result, o.end], [undefined, '볼', undefined], '앞 사본은 그대로');
      ok(Number(JSON.parse(localStorage.getItem('sl_cloud_mod') || '{}')[K2]) > 0, '수정 시각(sl_cloud_mod) 기록 → 동기화 · 마지막 사본 판단에 반영');
      var row = SLGames.loadGames({ withCurrent: false }).find(function (x) { return x.copies.indexOf(K2) >= 0; });
      var S = PC().calcPitching([{ pitches: row.pitchers[0].pitches }]);
      eq([S.unrec.length, S.bb, S.pa, S.strikes], [0, 1, 2, 2], '다시 읽으면: 미기록 0 · 볼넷 1 · 타석 2 · 스트라이크 수는 그대로(2)');
      sh.querySelector('[data-close]').click();
    } finally {
      [K1, K2].forEach(function (k) { localStorage.removeItem(k); });
      if (saves0 == null) localStorage.removeItem('sl_saves'); else localStorage.setItem('sl_saves', saves0);
      if (mods0 == null) localStorage.removeItem('sl_cloud_mod'); else localStorage.setItem('sl_cloud_mod', mods0);
    }
  });
  test('투수 분석 경고 카드에 "결과 미기록 타석 채우기" 버튼 → 수정 화면', function () {
    fresh(); AS.abs = []; var p = pitcher(1, '카드투수'); AS.curTeam = 'home'; AS.home_lineup = [{ id: 'a', name: '가', num: '1' }, { id: 'b', name: '나', num: '2' }];
    selBatter('a'); rec('볼'); selBatter('b'); $('pitchEndSheet').querySelector('[data-end="미상"]').click(); rec('볼', '볼', '볼', '볼');
    setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '카드투수');
    var b = document.querySelector('#pitcherView .pc-fix-btn'); ok(b, '버튼이 없음'); b.click(); ok($('pitchFixSheet'), '수정 화면이 열림');
    $('pitchFixSheet').querySelector('[data-close]').click(); setPitcherView('scope', 'season');
  });

  // ═══ 새 버전 기록 ═══
  test('이 앱보다 새 버전이 만든 기록(v 3 이상 · 모르는 결과값)이 있으면 경고 문구 — 지금 형식만 있으면 없다', function () {
    var base = [{ id: 1, v: 2, pa: 1, pr: '헛스윙', result: '스트라이크' }, { id: 2, v: 2, pa: 1, pr: '볼', result: '볼' }];
    eq(PC().calcPitching([{ pitches: base }]).newer, false, 'v2 만');
    [{ id: 3, v: 3, pa: 3, pr: '볼', result: '볼' }, { id: 4, v: 2, pa: 4, pr: '볼', result: '볼', end: '투수 강습' }, { id: 5, v: 2, pa: 5, pr: '반쯤 스윙', result: '스트라이크' }].forEach(function (x) {
      var S = PC().calcPitching([{ pitches: base.concat([x]) }]);
      ok(S.newer && /새 버전/.test(PC().warnLines(S)[0]), '경고: ' + JSON.stringify(x));
    });
    eq(PC().calcPitching([{ pitches: [{ id: 6, result: '볼', batter: 'A' }] }]).newer, false, '옛 기록(v1)은 새 버전이 아님');
  });

  // ═══ 이닝 × 기록 탭 연동 (main #102 흡수) ═══
  // 투수 탭 공으로 끝난 타석은 기록 탭 타석도 된다 → 3아웃으로 이닝을 넘겨도 그 타석은 그 공의 이닝에 적혀야 하고,
  // 기록 탭 O 버튼(3아웃 → 다음 이닝)이 같은 반 이닝을 한 번 더 넘기면 안 된다
  async function withRecordTab(fn) {   // 기록 탭 타석 · 실시간 동기화를 이 테스트 안에서만
    var abs0 = AS.abs, sync0 = window.cloudAutoSyncRecord, outs0 = AS.outs;
    AS.abs = []; AS.currentPitches = []; AS.outs = 0; window.cloudAutoSyncRecord = function () {};
    await sleep(750);   // 앞 테스트의 기록이 건 연타 방지 잠금(0.7초)이 풀리길 기다린다
    try { await fn(); } finally {
      AS.abs = abs0; window.cloudAutoSyncRecord = sync0; AS.outs = outs0; AS.balls = 0; AS.strikes = 0; AS.currentPitches = []; AS._pitchEndInn = null;
      try { _clearFieldTapPrompt(); renderCount(); shellNav('analysis', 'pitcher'); } catch (e) {}
    }
  }
  async function twoKs() {   // 1회초 2아웃 (두 타자 삼진) — 기록 탭 타석 2개, 연타 방지 가드(0.7초)를 비켜 간다
    batter('a', '가'); rec('헛스윙', '헛스윙', '헛스윙'); await sleep(750);
    batter('b', '나'); rec('헛스윙', '헛스윙', '헛스윙'); await sleep(750);
  }
  test('기록 탭 연동: 투수 탭 삼진으로 3아웃 → 기록 탭 타석은 1회초에 적히고 이닝은 2회초 · O 점은 0 · O 버튼을 눌러도 한 번 더 넘어가지 않는다', async function () {
    await withRecordTab(async function () {
      fresh(); pitcher(1, '투수'); await twoKs();
      eq(AS.abs.map(function (a) { return a.res + '@' + a.inn; }), ['삼진@1회초', '삼진@1회초'], '기록 탭 타석 2개');
      eq(AS.outs, 2, '기록 탭 O 점 = 투구 기록의 2아웃 (아웃 카운트는 하나 · 사용자 결정 2026-10-11)');
      chCount('o'); eq([inn(), AS.outs], ['1회초', 2], '투구 기록이 세는 이닝에서는 O 버튼이 따로 세지 않음');
      batter('c', '다'); rec('헛스윙', '헛스윙', '헛스윙');
      eq(AS.abs.length, 3, '세 번째 삼진도 기록 탭 타석'); eq(AS.abs[2].inn, '1회초', '그 타석은 1회초'); eq(inn(), '2회초', '이닝은 다음 회');
      eq(AS.outs, 0, '반 이닝이 끝나 O 점 0');
      chCount('o');
      eq([inn(), AS.outs], ['2회초', 1], 'O 를 눌러도 2회초 1아웃 (다시 넘어가지 않음)');
      undoPitch();
      eq([inn(), AS.outs], ['1회초', 2], '되돌리면 1회초 · O 점도 그 전(2)으로'); eq(AS.abs.length, 2, '자동으로 만든 타석도 지움');
    });
  });
  test('기록 탭 연동: 투수 탭 땅볼 아웃으로 3아웃 → 이닝은 바로 2회초, 기록 탭 필드를 찍은 타석은 1회초 · 그다음 타석은 2회초', async function () {
    await withRecordTab(async function () {
      fresh(); pitcher(1, '투수'); await twoKs();
      batter('c', '다'); rec('볼', '땅볼 아웃'); $('pitchLinkSheet').querySelector('[data-act="field"]').click();   // P2: 연결 시트 → 필드에서 위치 찍기
      eq(AS.pendingQuickRes, '땅볼 아웃', '필드 탭 대기'); eq(inn(), '2회초', '이닝은 다음 회'); eq(AS.abs.length, 2, '위치를 찍기 전엔 타석 없음');
      AS.pending = { x: 0.45, y: 0.6, deg: 80, dir: 'SS', ft: 120 }; var res = AS.pendingQuickRes; _clearFieldTapPrompt(); AS.rbi = 0; recHit(res);
      eq(AS.abs.length, 3, '필드 탭으로 타석 기록'); eq([AS.abs[2].res, AS.abs[2].inn], ['땅볼 아웃', '1회초'], '그 타석은 1회초');
      await sleep(750);
      batter('d', '라'); recOther('볼넷');
      eq(AS.abs[3].inn, '2회초', '그다음 기록 탭 타석은 지금 이닝');
    });
  });
  test('기록 탭 연동: 투수 탭 인플레이로 끝난 뒤 필드를 안 찍고 다음 공을 던지면, 그 뒤 기록 탭 타석은 지금 이닝', async function () {
    await withRecordTab(async function () {
      fresh(); pitcher(1, '투수'); await twoKs();
      batter('c', '다'); rec('플라이 아웃');
      $('pitchLinkSheet').querySelector('[data-act="skip"]').click();   // P2: 연결 시트 → 건너뛰기 eq(inn(), '2회초', '이닝은 다음 회');
      batter('d', '라'); rec('볼');   // 필드는 건너뛰고 다음 타자 공
      await sleep(750); recOther('사구');
      eq(AS.abs[AS.abs.length - 1].inn, '2회초', '지난 공의 이닝이 남아 있지 않다');
    });
  });

  test('(정리) 이 파일이 만든 상태를 비운다', function () {
    fresh(); AS.abs = []; AS.home_lineup = []; AS.away_lineup = []; renderPitchCount(); ok(true);
  });
})();
