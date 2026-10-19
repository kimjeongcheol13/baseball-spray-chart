// 게임원 박스스코어 가져오기(js/features/gameoneimport.js) — 데이터 관리 › 가져오기 › 게임원
//  · 타일 → 입력창 · 미리보기(점수 · 타석 수 · 모르는 기록 · 타점 안내) · 새 경기로 저장(sl_saves · 경기 데이터 · 저장 형식 검증)
//  · 기록 중인 경기(AS.abs)는 그대로 · 원정 = 초 / 홈 = 말 · 홈런은 펜스 밖 그대로 · 타석 타점 0 · 타석 순서(타순이 돌아가는 순서) 복원
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  // 원정: 사용자 예시 3행 그대로 (득점 3 + 4 + 1 = 8, 타점 7 + 3 + 0 = 10)
  var AWAY = [
    '5\t二\t배성웅(15)\t좌중3\t우중홈\t우안\t중월2\t \t \t \t \t \t4\t4\t7\t3\t0\t1.000\t0.690',
    '8\t중\t이현준(24)\t\t좌월홈\t좌안\t2내안/좌중2\t \t \t \t \t \t4\t4\t3\t4\t0\t1.000\t0.800',
    '1\t유\t김수찬(5)\t사구,도루,주자아웃\t\t유땅R\t\t \t \t \t \t \t1\t0\t0\t1\t1\t0.000\t0.538'
  ].join('\n');
  // 홈: 머리글 줄 + 1명 (득점 1, 타점 1) — 4회 '번트'는 모르는 기록이라 저장하지 않는다
  var HOME = '타순\t위치\t선수명\t1\t2\t3\t4\t5\t6\t7\t8\t9\t타수\t안타\t타점\t득점\t도루\t타율\t시즌\n'
    + '1\t포\t마동석(7)\t3플\t \t우중홈/삼진\t번트\t \t \t \t \t \t3\t1\t1\t1\t0\t.333\t.250';

  function saves() { try { return JSON.parse(localStorage.getItem('sl_saves') || '[]'); } catch (e) { return []; } }
  function type(id, v) { var el = $(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
  function seq(g) { return g.abs.map(function (a) { return a.inn + ' ' + a.bname + ' ' + a.res; }); }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.SLGameOne && window.SLGameOneImport, '파서(js/gameone.js) · 가져오기 모듈 로드');
  });

  test('데이터 관리 › 게임원 타일 → 입력창이 열리고 데이터 관리 창은 닫힌다', function () {
    openOverlay('dataSettingsOverlay');
    var tile = document.querySelector('#dataSettingsOverlay .go-tile');
    ok(tile, '게임원 타일');
    tile.click();
    ok($('goOverlay').classList.contains('show'), '입력창 열림');
    ok(!$('dataSettingsOverlay').classList.contains('show'), '데이터 관리 닫힘');
    ok(/^\d{4}-\d{2}-\d{2}$/.test($('goDate').value), '경기 날짜 기본값(오늘)');
    ok($('goSave').disabled, '비어 있으면 저장 버튼 꺼짐');
  });

  test('선수 행이 없는 글 → 안내만, 저장 버튼 꺼짐', async function () {
    type('goAway', '아무 글이나 붙여넣음\n두 번째 줄');
    await T.sleep(300);
    ok($('goPrev').textContent.indexOf('선수 행을 찾지 못했습니다') >= 0, '안내: ' + $('goPrev').textContent);
    ok($('goSave').disabled, '저장 버튼 꺼짐');
  });

  test('미리보기: 점수(득점 합계) · 타석 수 · 모르는 기록 · 타점 안내', async function () {
    type('goTa', '상대'); type('goTh', '우리'); type('goDate', '2026-10-11');
    type('goAway', AWAY); type('goHome', HOME);
    await T.sleep(300);
    var t = $('goPrev').textContent;
    ok(t.indexOf('상대 8 : 1 우리') >= 0, '점수 — ' + t);
    ok(t.indexOf("저장 안 함 1타석") >= 0 && t.indexOf("마동석 4회 '번트'") >= 0, '모르는 기록 — ' + t);
    ok(t.indexOf('0으로 저장') >= 0 && t.indexOf('타점 합계 11') >= 0 && t.indexOf('기록 없는 홈런은 최소 1타점') >= 0 && t.indexOf('홈런으로 넣은 타점 3') >= 0, '타점 안내 — ' + t);
    ok(!$('goSave').disabled, '저장 버튼 켜짐');
    eq($('goSave').textContent, '새 경기로 저장 (13타석)', '버튼 글자');
  });

  test('새 경기로 저장 → sl_saves · 경기 데이터 · 불러오기 목록, 기록 중인 경기는 그대로', async function () {
    var before = saves().length, cur = JSON.stringify(AS.abs);
    $('goSave').click();
    var s = saves();
    eq(s.length, before + 1, '저장 항목 1개 추가');
    var e = s[s.length - 1], g = JSON.parse(localStorage.getItem(e.key));
    ok(_isSaveKey(e.key), '앱의 경기 저장 키 형식: ' + e.key);
    ok(_gameDataOk(g), '다른 가져오기와 같은 저장 형식 검증 통과');
    eq([g.th, g.ta, g.hs, g.as, g.d], ['우리', '상대', 1, 8, new Date(2026, 9, 11).toLocaleDateString('ko-KR')], '팀 · 점수 · 날짜');
    eq(g.info, { date: '2026-10-11' }, '경기 정보 날짜');
    eq(e.label, '우리 1:8 상대 (' + g.d + ')', '목록 이름');
    eq(g.away_lineup.map(function (p) { return p.name + '#' + p.num + '/' + p.pos; }), ['배성웅#15/2루', '이현준#24/중견', '김수찬#5/유격'], '원정 라인업');
    eq(g.home_lineup.map(function (p) { return p.name + '/' + p.pos; }), ['마동석/포수'], '홈 라인업');
    eq(g.abs.length, 13, '타석 13개 (번트 제외)');
    ok(g.abs.every(function (a) { return a.rbi === (a.res === '홈런' ? 1 : 0) && a.pt === null && Array.isArray(a.pitches); }), '타석 타점: 홈런 1(최소) · 나머지 0 · 구종 없음');
    ok(g.abs.every(function (a) { return a.team === (a.bname === '마동석' ? 'home' : 'away'); }), '팀');
    eq(JSON.stringify(AS.abs), cur, '기록 중인 경기는 그대로');
    ok($('loadOverlay').classList.contains('show') && !$('goOverlay').classList.contains('show'), '입력창 닫고 불러오기 목록 열림');
    ok($('saveList').textContent.indexOf('우리') >= 0, '불러오기 목록에 새 경기');
    ok(window.SLGames.loadGames({ withCurrent: false }).some(function (x) { return x.copies.indexOf(e.key) >= 0; }), '경기 읽기(분석 탭 등)에 포함');
    ok($('toastTxt').textContent.indexOf('게임원 13타석 → 새 경기로 저장됨 (모르는 기록 1타석 제외)') >= 0, '토스트: ' + $('toastTxt').textContent);
    eq([$('goAway').value, $('goHome').value], ['', ''], '저장 뒤 붙여넣기 칸 비움');
    closeOverlay('loadOverlay');
  });

  test('저장된 타석: 이닝 초/말 · 위치(기록 탭과 같은 좌표) · 홈런은 펜스 밖 · 타석이 아닌 칸 제외', function () {
    var s = saves(), g = JSON.parse(localStorage.getItem(s[s.length - 1].key));
    // 원정은 앞 이닝 마지막 타자 다음 타순부터: 1회 1번(김수찬) → 5번(배성웅) · 2회 8번 → 5번 · 3회 8 → 1 → 5 · 4회 8 → 5 → 8('/' 두 번째)
    eq(seq(g), [
      '1회초 김수찬 사구', '1회초 배성웅 3루타', '1회말 마동석 플라이 아웃',
      '2회초 이현준 홈런', '2회초 배성웅 홈런',
      '3회초 이현준 안타', '3회초 김수찬 땅볼 아웃', '3회초 배성웅 안타', '3회말 마동석 홈런', '3회말 마동석 삼진',
      '4회초 이현준 내야안타', '4회초 배성웅 2루타', '4회초 이현준 2루타'
    ], '타석 순서');
    var b3 = g.abs[1];   // 배성웅 좌중3: 매핑표 −17° · 0.85 → 저장 deg 67.33 · 반지름 0.8245
    ok(Math.abs(b3.deg - 67.3333) < 1e-3 && b3.dir === 'LC', 'deg · dir: ' + b3.deg + ' ' + b3.dir);
    ok(Math.abs(Math.hypot(b3.x - 0.5, b3.y - 1) - 0.8245) < 1e-3, '반지름');
    ok(b3.ft > 0, '추정 거리(ft)');
    var hr = g.abs[3];   // 이현준 좌월홈: 반지름 1.0185 (펜스 0.97 밖 그대로)
    ok(Math.abs(Math.hypot(hr.x - 0.5, hr.y - 1) - 1.0185) < 1e-3, '홈런 펜스 밖: ' + Math.hypot(hr.x - 0.5, hr.y - 1));
    var bb = g.abs[0];   // 사구 → 위치 없음
    eq([bb.x, bb.y, bb.deg, bb.dir, bb.ft], [null, null, null, null, null], '비타구는 위치 없음');
    ok(g.abs.every(function (a) { return a.res !== null; }), '결과 없는 칸(교체 · 주루 사건뿐)은 저장하지 않음');
  });

  // 이닝별 점수표: 원정(위) 2 1 0 5 0 0 0 0 0 = 8 · 홈(아래) 0 0 1 0 0 0 0 0 0 = 1 → 위 타자 표의 득점 합계(8 · 1)와 같다
  var SB = 'Team\t\t1\t2\t3\t4\t5\t6\t7\t8\t9\tR\tH\tE\tB\n'
    + '상대팀\t2\t1\t0\t5\t0\t0\t0\t0\t0\t8\t9\t1\t2\n'
    + '우리팀\t0\t0\t1\t0\t0\t0\t0\t0\t0\t1\t1\t2\t3';
  function lsCells(i) {   // 기록 화면 라인스코어 i번째 줄: [팀, 이닝 칸…, R]
    var tr = document.querySelectorAll('#sbHdrMid .sb-ls tbody tr')[i], td = tr ? tr.querySelectorAll('td') : [];
    var inn = Array.prototype.slice.call(td, 0, td.length - 3).map(function (c) { return c.textContent; });
    return [tr ? tr.querySelector('th').textContent : null].concat(inn, [td.length ? td[td.length - 3].textContent : null]);
  }
  // 기록 화면 라인스코어는 requestAnimationFrame(실제 화면 프레임)으로 다시 그린다. 이 하네스는 가상 시간으로 돌아 T.sleep 동안 실제 시간이 거의 흐르지 않고
  // 프레임도 오지 않는다(측정: 가상 3초 대기 40번 중 40번 rAF 0회 · 프레임을 직접 기다리면 그 사이 앱 타이머가 가상 시간 예산을 수백 초 쓴다)
  // → 경기를 연 뒤 바로 그리기(sbRenderNow)로 그린 표를 읽는다
  async function openSaved(key) {
    var want = JSON.stringify((JSON.parse(localStorage.getItem(key)).info || {}).ls || null);
    restoreGame(key);
    eq(JSON.stringify(window.gameInfo().ls || null), want, '경기 열기: 경기 정보(info.ls) — ' + key);
    window.sbRenderNow();
  }
  function eqCells(i, want, msg) {
    eq(lsCells(i), want, msg + ' [curSaveKey=' + _curSaveKey + ' · info.ls=' + JSON.stringify(window.gameInfo().ls) + ']');
  }

  test('이닝별 점수표: 미리보기 미니 표 · 팀 이름이 비면 표의 이름 · 점수 = R', async function () {
    openGameOneImport();
    type('goTa', ''); type('goTh', ''); type('goDate', '2026-10-12');
    type('goScore', SB); type('goAway', AWAY); type('goHome', HOME);
    await T.sleep(300);
    var t = $('goPrev').textContent;
    ok(t.indexOf('상대팀 8 : 1 우리팀') >= 0, '점수 · 팀 이름 — ' + t);
    eq($('goPrev').querySelectorAll('.go-ls tbody tr').length, 2, '미니 표 2줄');
    eq(Array.prototype.map.call($('goPrev').querySelectorAll('.go-ls tbody tr:first-child td'), function (c) { return c.textContent; }),
      ['2', '1', '0', '5', '0', '0', '0', '0', '0', '8'], '미니 표 원정 줄');
    ok(t.indexOf('이닝별 점수표 R') < 0, '타자 표 득점 합계와 같으면 경고 없음 — ' + t);
  });

  test('이닝별 점수표 저장 → info.ls, 경기를 열면 기록 화면 라인스코어 이닝 칸에 표시', async function () {
    $('goSave').click();
    var s = saves(), key = s[s.length - 1].key, g = JSON.parse(localStorage.getItem(key));
    eq([g.ta, g.th, g.as, g.hs], ['상대팀', '우리팀', 8, 1], '팀 · 점수');
    eq(g.info, { date: '2026-10-12', ls: { away: [2, 1, 0, 5, 0, 0, 0, 0, 0], home: [0, 0, 1, 0, 0, 0, 0, 0, 0] } }, '경기 정보');
    ok(_gameDataOk(g), '저장 형식 검증 통과');
    closeOverlay('loadOverlay');
    await openSaved(key);
    eqCells(0, ['상대팀', '2', '1', '0', '5', '0', '0', '0', '0', '0', '8'], '라인스코어 윗줄(원정 · 초)');
    eqCells(1, ['우리팀', '0', '0', '1', '0', '0', '0', '0', '0', '0', '1'], '라인스코어 아랫줄(홈 · 말)');
  });

  test('이닝별 점수표 없이 가져온 경기는 이닝 칸이 그대로 비어 있다', async function () {
    var s = saves(), first = s.filter(function (e) { var d = JSON.parse(localStorage.getItem(e.key) || 'null'); return d && d.th === '우리' && d.ta === '상대'; })[0];
    ok(first, '앞에서 저장한 경기(점수표 없음)');
    await openSaved(first.key);
    var top = lsCells(0);
    eq([top[0], top[top.length - 1]], ['상대', '8'], '팀 · R');
    ok(top.slice(1, -1).every(function (c) { return c === ''; }), '이닝 칸 비어 있음: ' + JSON.stringify(top));
  });

  test('이닝별 점수표 이닝 수: 10회 이상 연장 · 9회말 X 도 칸이 늘어나고 X 표시', async function () {
    var sb = 'A\t0\t0\t0\t0\t0\t0\t0\t1\t0\t0\t1\t1\t5\t0\t1\nB\t0\t0\t0\t0\t0\t0\t0\t1\t0\t0\t2\t3\t6\t0\t2';
    var tbl = 'Team\t1\t2\t3\t4\t5\t6\t7\t8\t9\t10\t11\tR\tH\tE\tB\n' + sb;
    var g = window.SLGameOneImport.buildGameOneGame({ scoreText: tbl, homeText: HOME, now: 1790000000001 }).game;
    eq(g.info.ls, { away: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], home: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2] }, '11회까지');
    function put(d, label) { localStorage.setItem(d.key, JSON.stringify(d)); var sv = saves(); sv.push({ key: d.key, label: label, ts: d.ts }); localStorage.setItem('sl_saves', JSON.stringify(sv)); }
    put(g, '연장 경기');
    await openSaved(g.key);
    eqCells(1, ['B', '0', '0', '0', '0', '0', '0', '0', '1', '0', '0', '2', '3'], '라인스코어 11칸 (팀 이름 칸이 비면 점수표의 이름)');
    var x = window.SLGameOneImport.buildGameOneGame({ scoreText: 'A\t0\t0\t0\t0\t0\t0\t0\t0\t1\t1\t3\t0\t1\nB\t1\t0\t0\t1\t0\t0\t0\t0\tX\t2\t5\t0\t2', homeText: HOME, now: 1790000100000 }).game;
    eq(x.info.ls.home[8], 'X', '9회말 X');
    put(x, 'X 경기');
    await openSaved(x.key);
    eqCells(1, ['B', '1', '0', '0', '1', '0', '0', '0', '0', 'X', '2'], '라인스코어 X');
  });

  test('타석 순서 복원: 타자일순 이닝 — 행 순서가 아니라 타순이 돌아가는 순서로', function () {
    var rows = [], cells = { 1: ['삼진', '삼진', '삼진'], 2: [] };
    for (var k = 1; k <= 9; k++) {
      var c = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
      if (k <= 3) c[0] = '삼진';                       // 1회: 1~3번
      c[1] = k === 4 ? '좌안/우플' : '4구';            // 2회: 4~9번 → 1~3번 → 4번 다시('/')
      if (k >= 5 && k <= 7) c[2] = '삼진';             // 3회: 5~7번
      rows.push([k, '좌', '타자' + k + '(' + (10 + k) + ')'].concat(c, ['0', '0', '0', '0', '0', '.000', '.000']).join('\t'));
    }
    var g = window.SLGameOneImport.buildGameOneGame({ awayText: rows.join('\n'), now: 1790000000000 }).game;
    eq(g.abs.map(function (a) { return a.inn.replace('회초', '') + ':' + a.bname.replace('타자', ''); }), [
      '1:1', '1:2', '1:3',
      '2:4', '2:5', '2:6', '2:7', '2:8', '2:9', '2:1', '2:2', '2:3', '2:4',
      '3:5', '3:6', '3:7'
    ], '순서');
    eq([g.abs[3].res, g.abs[12].res], ['안타', '플라이 아웃'], "4번의 '/' 첫 타석 · 두 번째 타석");
    eq(new Set(g.abs.map(function (a) { return a.id; })).size, g.abs.length, '타석 id 중복 없음');
  });

  // 같은 경기 다시 가져오기: 게임원 가져오기는 저장할 때마다 타석 id 를 새로 만들어 저장 경기 읽기가 같은 경기로 묶지 못한다(시즌 기록에 두 번 들어간다)
  test('같은 경기 판단(findSameGames): 경기 정보 날짜 → 없으면 저장일 · 팀 이름 앞뒤 공백 무시 · 홈/원정이 바뀐 것도 · 점수까지 같아야', function () {
    var F = window.SLGameOneImport.findSameGames;
    var game = { th: '우리', ta: '상대', hs: 1, as: 8, d: '2026. 10. 11.', info: { date: '2026-10-11' } };
    var S = [
      { key: 'a', g: { th: ' 우리 ', ta: '상대', hs: 1, as: 8, d: '2026. 10. 20.', info: { date: '2026-10-11' } } },   // 저장일은 다르고 경기 날짜가 같다
      { key: 'b', g: { th: '우리', ta: '상대', hs: 1, as: 8, d: '2026. 10. 11.' } },                                 // 경기 정보 없음 → 저장일
      { key: 'c', g: { th: '상대', ta: '우리', hs: 8, as: 1, d: '2026. 10. 11.' } },                                 // 홈/원정 · 점수가 같이 바뀜
      { key: 'x1', g: { th: '우리', ta: '상대', hs: 2, as: 8, d: '2026. 10. 11.' } },                                // 점수 다름
      { key: 'x2', g: { th: '상대', ta: '우리', hs: 1, as: 8, d: '2026. 10. 11.' } },                                // 팀만 바뀌고 점수는 그대로 = 다른 결과
      { key: 'x3', g: { th: '우리', ta: '상대', hs: 1, as: 8, d: '2026. 10. 12.' } },                                // 날짜 다름
      { key: 'x4', g: { th: '우리', ta: '상대', hs: 1, as: 8, d: '2026. 10. 11.', info: { date: '2026-10-12' } } },   // 저장일은 같지만 경기 날짜가 다름
      { key: 'x5', g: { th: '우리팀', ta: '상대', hs: 1, as: 8, d: '2026. 10. 11.' } }                               // 팀 이름 다름
    ];
    eq(F(game, S).map(function (x) { return x.key; }), ['a', 'b', 'c'], '같은 경기');
    eq(F({ th: '우리', ta: '상대', hs: 1, as: 8, d: '2026. 10. 11.' }, S).map(function (x) { return x.key; }), ['a', 'b', 'c'], '가져올 경기도 저장일로');
    eq(F({ th: '우리', ta: '상대', hs: 1, as: 8, d: '' }, S), [], '날짜를 모르면 찾지 않음');
  });

  test('같은 경기를 다시 붙여넣으면 미리보기 경고 · 버튼 "그래도" · 저장 전 확인(취소하면 그대로, 확인하면 저장)', async function () {
    var first = saves().filter(function (e) { var d = JSON.parse(localStorage.getItem(e.key) || 'null'); return d && d.th === '우리' && d.ta === '상대'; })[0];
    ok(first, '앞에서 저장한 경기(우리 1:8 상대 · 2026-10-11)');
    openGameOneImport();
    type('goScore', ''); type('goTa', '상대'); type('goTh', '우리'); type('goDate', '2026-10-11');
    type('goAway', AWAY); type('goHome', HOME);
    await T.sleep(300);
    var w = $('goPrev').querySelector('.go-dup');
    ok(w && w.textContent.indexOf(first.label) >= 0 && w.textContent.indexOf('두 번') >= 0, '미리보기 경고 — ' + (w ? w.textContent : $('goPrev').textContent));
    eq($('goSave').textContent, '그래도 새 경기로 저장 (13타석)', '버튼 글자');
    var msgs = [], c0 = window.confirm, before = saves().length;
    try {
      window.confirm = function (m) { msgs.push(m); return false; };
      $('goSave').click();
      eq(saves().length, before, '취소하면 저장 안 함');
      ok($('goOverlay').classList.contains('show'), '입력창 그대로');
      eq($('goAway').value, AWAY, '붙여넣은 글 그대로');
      ok(msgs.length === 1 && msgs[0].indexOf(first.label) >= 0 && msgs[0].indexOf('그래도 새 경기로 저장할까요?') >= 0, '확인창 — ' + JSON.stringify(msgs));
      window.confirm = function (m) { msgs.push(m); return true; };
      $('goSave').click();
      eq(saves().length, before + 1, '확인하면 저장');
    } finally { window.confirm = c0; }
    closeOverlay('loadOverlay');
  });

  test('날짜가 다르면 같은 경기로 보지 않는다 — 경고 · 확인창 없이 저장', async function () {
    openGameOneImport();
    type('goTa', '상대'); type('goTh', '우리'); type('goDate', '2026-10-13');
    type('goAway', AWAY); type('goHome', HOME);
    await T.sleep(300);
    ok(!$('goPrev').querySelector('.go-dup'), '경고 없음 — ' + $('goPrev').textContent);
    eq($('goSave').textContent, '새 경기로 저장 (13타석)', '버튼 글자');
    var n = 0, c0 = window.confirm, before = saves().length;
    try { window.confirm = function () { n++; return false; }; $('goSave').click(); } finally { window.confirm = c0; }
    eq([n, saves().length], [0, before + 1], '확인창 없이 저장');
    closeOverlay('loadOverlay');
  });

  // 붙여넣기 실수: 한 칸에 표 두 개 · 두 칸에 같은 표. 게임원이 교체 선수를 어디에 두는지(제 타순 아래 · 표 맨 아래) 몰라도 맞는 신호만 쓴다
  function bat(order, name, num, cell) {
    var c = ['', '', '', '', '', '', '', '', ''];
    c[0] = cell || '삼진';
    return [order, '좌', name + '(' + num + ')'].concat(c, ['1', '0', '0', '0', '0', '.000', '.000']).join('\t');
  }
  function team(prefix, orders) { return orders.map(function (o, i) { return bat(o, prefix + (i + 1), 10 + i); }); }
  var NINE = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var HDR = '타순\t위치\t선수명\t1\t2\t3\t4\t5\t6\t7\t8\t9\t타수\t안타\t타점\t득점\t도루\t타율\t시즌';
  var SUM = '합계\t\t\t\t\t\t\t\t\t\t\t\t9\t0\t0\t0\t0\t\t';
  function split(text) { return window.SLGameOneImport.buildGameOneGame({ awayText: text, now: 1790000200000 }).report.away.split; }

  test('한 칸에 표 두 개: 합계 · 머리글 줄 다음에 선수 행이 또 오면(sep) · 타순이 1번부터 통째로 다시 돌면(restart)', function () {
    var A = team('가', NINE), B = team('나', NINE);
    eq(split([HDR].concat(A, [SUM, '', HDR], B, [SUM]).join('\n')), { name: '나1', number: '10', line: 14, why: 'sep' }, '합계 · 머리글 줄 다음 표');
    eq(split(A.concat(B).join('\n')), { name: '나1', number: '10', line: 10, why: 'restart' }, '줄 없이 바로 이어 붙인 두 표');
    eq(split(team('가', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).concat(team('나', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).join('\n')).why, 'restart', '11번 타순까지 치는 리그');
  });

  test('한 칸에 표 두 개 — 잘못 잡지 않는다: 교체 선수가 제 타순 아래 · 표 맨 아래(6자리까지) · 일부 행만 · 표 하나', function () {
    eq(split([HDR].concat(team('가', NINE), [SUM]).join('\n')), null, '표 하나(머리글 · 합계 포함)');
    eq(split(team('가', [1, 2, 2, 3, 4, 4, 5, 6, 7, 7, 8, 9, 9]).join('\n')), null, '교체 선수가 제 타순 바로 아래');
    eq(split(team('가', NINE.concat([3, 5, 7])).join('\n')), null, '교체 선수 3명이 표 맨 아래');
    eq(split(team('가', NINE.concat([1, 2, 3, 4, 5, 6])).join('\n')), null, '교체 선수 6명이 표 맨 아래');
    eq(split(AWAY), null, '일부 행만(5 · 8 · 1번)');
  });

  // 실제 PC 웹 복사 형식(2026-10-19 확인, 이름은 가명): 첫 칸 = 타순 + 위치 + 이름(번호) · 머리글 '선수 …' · 합계 '합 계 …' · 교체 선수는 같은 타순으로 아래 줄
  var RH = '선수\t1\t2\t3\t4\t5\t6\t7\t8\t9\t타수\t안타\t타점\t득점\t도루\t타율\t시즌';
  function real(head, cells) {
    var c = ['', '', '', '', '', '', '', '', ''];
    Object.keys(cells).forEach(function (k) { c[k - 1] = cells[k]; });
    return [head].concat(c, ['2', '1', '0', '0', '0', '0.500', '0.500']).join('\t');
  }
  function realTable(rows) { return ['', RH].concat(rows, ['합 계\t9\t4\t0\t0\t0\t0.444\t0.444', '']).join('\n'); }
  var REAL_A = realTable([
    real('1지가일(1)', { 1: '유플', 2: '좌안' }),
    real('2三가이(2)', { 1: '삼진', 2: '4구' }),
    real('3一가삼(3)', { 1: '3땅' }),
    real('4유가사(4)', { 2: '중안' }),
    real('4미가오(5)', { 3: '대타,좌중2' })
  ]);

  test('실제 PC 웹 복사 형식: 붙은 첫 칸 → 타순 · 위치 · 이름 · 미 = 위치 없음 · 교체 선수 · 타석 순서 복원', function () {
    var out = window.SLGameOneImport.buildGameOneGame({ awayText: REAL_A, now: 1790000400000 }), g = out.game;
    eq(g.away_lineup.map(function (p) { return p.name + '#' + p.num + '/' + p.pos + (p.isStarter ? '' : '(교체)'); }),
      ['가일#1/DH', '가이#2/3루', '가삼#3/1루', '가사#4/유격', '가오#5/(교체)'], '라인업');
    eq(seq(g), ['1회초 가일 플라이 아웃', '1회초 가이 삼진', '1회초 가삼 땅볼 아웃',
      '2회초 가사 안타', '2회초 가일 안타', '2회초 가이 볼넷', '3회초 가오 2루타'], '타석 순서(2회는 4번부터)');
    eq([out.report.away.split, out.report.away.skipped.length], [null, 0], '머리글 · 합 계 줄은 표 두 개로 보지 않음 · 모르는 기록 없음');
  });

  test('홈런 [2R 97M] → 그 타석 타점 2 · 비거리 97m(318ft) · 괄호 없는 홈런은 최소 1타점 · 다른 타석은 0', function () {
    var out = window.SLGameOneImport.buildGameOneGame({ awayText: realTable([real('1지가일(1)', { 1: '좌월홈[2R 97M]', 2: '좌중홈', 3: '좌안' })]), now: 1790000500000 });
    eq(out.game.abs.map(function (a) { return a.res + ':' + a.rbi + ':' + a.ft; }).slice(0, 2), ['홈런:2:318', '홈런:1:' + out.game.abs[1].ft], '홈런 타점 · 비거리');
    ok(out.game.abs[1].ft > 0 && out.game.abs[1].ft !== 318, '괄호 없는 홈런은 펜스 거리로 추정한 ft');
    eq([out.game.abs[2].rbi, out.report.away.hrRbi], [0, 2], '다른 타석 타점 0 · 홈런으로 넣은 타점 합');
  });

  test('실제 형식에서 한 칸에 표 두 개: 합 계 · 팀 이름 · 선수 머리글 줄 다음 표(sep) · 줄 없이 이어 붙인 두 표(restart)', function () {
    var B = realTable(['1우나일(11)\t삼진', '2좌나이(12)\t삼진', '3중나삼(13)\t삼진'].map(function (r) { return r + '\t\t\t\t\t\t\t\t\t1\t0\t0\t0\t0\t0.000\t0.000'; }));
    var both = REAL_A + '\n나팀\n' + B;
    var s = split(both);
    eq([s && s.why, s && s.name], ['sep', '나일'], '합 계 · 선수 머리글 다음 표: ' + JSON.stringify(s));
    var nine = function (pre, n) { return NINE.map(function (o) { return real(o + '중' + pre + o + '(' + (n + o) + ')', { 1: '삼진' }); }); };
    var r = split(nine('가', 10).concat(nine('나', 30)).join('\n'));
    eq([r && r.why, r && r.name, r && r.line], ['restart', '나1', 10], '이어 붙인 두 표: ' + JSON.stringify(r));
  });

  // 휴대폰 '전체 선택 → 복사': 메뉴 · 점수표 · 요약 · 타자 표 2개 · 투수 표 2개가 한 덩어리로 온다(실제 페이지 구조, 이름은 가명)
  var PH = '선수\t결과\t이닝\t타자\t타수\t피안타\t피홈런\t희타\t희비\t볼넷\t사구\t삼진\t폭투\t보크\t실점\t자책점\t투구수\t방어율\t시즌';
  var REAL_B = realTable([real('1우나일(11)', { 1: '삼진', 2: '좌선2' }), real('2좌나이(12)', { 1: '중직' }), real('3중나삼(13)', { 1: '유땅' })]);
  var PAGE = ['', '다른팀 2 vs 15 또다른팀 (10.18)', '이전', '다음', '가팀', '', '승', '1', '나팀', '', '패', '0',
    '(후)일요리그 / 10.18(10:20) / 가상구장', 'Team\t1\t2\t3\t4\t5\t6\t7\t8\t9\tR\tH\tE\tB',
    '가팀\t0\t0\t1\t\t\t\t\t\t\t1\t4\t0\t1', '나팀\t0\t0\t\t\t\t\t\t\t\t0\t1\t0\t0', '게임결과', '게임요약', '[2루타]가오(3회)', '',
    ' 가팀', REAL_A.trim(), ' 나팀', REAL_B.trim(),
    // 투수 표: 가투수가 나팀 4타석 전부 · 나팀은 나투수(가팀 앞 4타석) → 나계투(뒤 3타석). 상대 타자 수 합 = 상대 팀 타석 수
    ' 가팀', PH, '가투수(9)\t승\t2\t4\t4\t1\t0\t0\t0\t0\t0\t1\t0\t0\t0\t0\t0\t0.00\t0.00',
    ' 나팀', PH, '나투수(8)\t-\t1 ⅓\t4\t4\t1\t0\t0\t0\t0\t0\t1\t0\t0\t0\t0\t0\t0.00\t0.00',
    '나계투(7)\t패\t1 ⅔\t3\t2\t2\t0\t0\t0\t1\t0\t0\t0\t0\t1\t1\t0\t5.40\t5.40', '등록된 사진 및 코멘트는', '답글입력'].join('\n');

  test('페이지 통째 붙여넣기(휴대폰 전체 선택): 어느 칸에 넣어도 점수표 · 원정 · 홈 · 투수 표 칸으로 나눠 채우고, 상대 타석에 투수를 붙인다', async function () {
    var ids = ['goScore', 'goAway'];
    for (var i = 0; i < ids.length; i++) {
      openGameOneImport();
      ['goScore', 'goAway', 'goHome', 'goPitch', 'goTa', 'goTh'].forEach(function (id) { type(id, ''); });
      type('goDate', '2026-10-15');
      type(ids[i], PAGE);
      await T.sleep(300);
      ok($('goScore').value.indexOf('Team\t1\t2') === 0 && $('goScore').value.split('\n').length === 3, ids[i] + ': 점수표 칸 — ' + JSON.stringify($('goScore').value));
      eq([$('goAway').value.split('\n')[1], $('goHome').value.split('\n')[1]], ['1지가일(1)\t유플\t좌안\t\t\t\t\t\t\t\t2\t1\t0\t0\t0\t0.500\t0.500', real('1우나일(11)', { 1: '삼진', 2: '좌선2' })], ids[i] + ': 원정 · 홈 칸 첫 선수');
      ok($('goHome').value.indexOf('나투수') < 0 && $('goAway').value.indexOf('가투수') < 0, ids[i] + ': 타자 칸에 투수 표는 없음');
      ok($('goPitch').value.indexOf('가투수(9)') >= 0 && $('goPitch').value.indexOf('나계투(7)') >= 0 && $('goPitch').value.indexOf('등록된') < 0, ids[i] + ': 투수 표 칸 — ' + JSON.stringify($('goPitch').value));
      var note = $('goPrev').querySelector('.go-split');
      ok(note && note.textContent.indexOf('이닝별 점수표 · 원정(가팀) · 홈(나팀) 타자 표 · 투수 표로 나눴습니다') >= 0, ids[i] + ': 안내 — ' + (note ? note.textContent : $('goPrev').textContent));
      var pt = $('goPrev').querySelector('.go-pt');
      ok(pt && pt.textContent.indexOf('원정 가팀 · 상대 타석에 연결') >= 0 && pt.textContent.indexOf('홈 나팀 · 상대 타석에 연결') >= 0 && pt.textContent.indexOf('1 ⅔') >= 0, ids[i] + ': 투수 기록 표 — ' + (pt ? pt.textContent : '없음'));
      ok($('goPrev').textContent.indexOf('가팀 1 : 0 나팀') >= 0 && !$('goPrev').querySelector('.go-two'), ids[i] + ': 점수 · 표 두 개 경고 없음 — ' + $('goPrev').textContent);
      eq($('goSave').textContent, '새 경기로 저장 (11타석)', ids[i] + ': 버튼 (가팀 7 + 나팀 4타석)');
    }
    var before = saves().length;
    $('goSave').click();
    var s = saves(), g = JSON.parse(localStorage.getItem(s[s.length - 1].key));
    eq([s.length, g.ta, g.th, g.as, g.hs, g.abs.length], [before + 1, '가팀', '나팀', 1, 0, 11], '저장: 팀 · 점수 · 타석');
    eq(g.info.ls, { away: [0, 0, 1], home: [0, 0] }, '이닝 점수');
    eq(g.abs.filter(function (a) { return a.team === 'away'; }).map(function (a) { return a.bname + ':' + a.pitcher; }),
      ['가일:나투수', '가이:나투수', '가삼:나투수', '가사:나투수', '가일:나계투', '가이:나계투', '가오:나계투'], '원정 타석의 투수(나투수 4 → 나계투 3)');
    ok(g.abs.filter(function (a) { return a.team === 'home'; }).every(function (a) { return a.pitcher === '가투수'; }), '홈 타석의 투수 = 가투수');
    eq($('goPitch').value, '', '저장 뒤 투수 표 칸 비움');
    eq({ away: g.pitchLines.away.map(function (p) { return p.name + ':' + p.result + ':' + p.outs + ':' + p.tbf; }), home: g.pitchLines.home.map(function (p) { return p.name + ':' + p.result + ':' + p.outs + ':' + p.tbf; }) },
      { away: ['가투수:승:6:4'], home: ['나투수:-:4:4', '나계투:패:5:3'] }, '투수 성적 저장(pitchLines) — 분석 탭 투수 시즌 기록이 모은다');
    closeOverlay('loadOverlay');
  });

  test('타격방해 타석은 저장하지 않아도 투수의 상대 타자 수에는 든다 — 그 뒤 타석이 다음 투수에게 맞게 붙는다', function () {
    var away = realTable([real('1지가일(1)', { 1: '삼진' }), real('2三가이(2)', { 1: '타격방해' }), real('3一가삼(3)', { 1: '좌안' })]);
    var pitch = [' 가팀', PH, ' 나팀', PH, '나일투(1)\t-\t0 ⅓\t2\t1\t0\t0\t0\t0\t0\t0\t1\t0\t0\t0\t0\t0\t0.00\t0.00', '나이투(2)\t-\t0\t1\t1\t1\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0.00\t0.00'].join('\n');
    var out = window.SLGameOneImport.buildGameOneGame({ awayText: away, pitchText: pitch, now: 1790000700000 });
    eq(out.game.abs.map(function (a) { return a.bname + ':' + a.res + ':' + a.pitcher; }), ['가일:삼진:나일투', '가삼:안타:나이투'], '타격방해는 저장 안 함 · 가삼은 두 번째 투수');
    eq(out.report.pitch.linked.home, true, '홈 투수 연결');
  });

  test('투수 표의 상대 타자 수 합이 상대 팀 타석 수와 다르면 그 팀 타석에는 투수를 붙이지 않고 알린다', function () {
    var bad = PAGE.replace('가투수(9)\t승\t2\t4', '가투수(9)\t승\t2\t5');
    var sp = window.SLGameOne.splitGameOnePage(bad);
    var out = window.SLGameOneImport.buildGameOneGame({ awayText: sp.tables[0].text, homeText: sp.tables[1].text, pitchText: sp.pitch, now: 1790000600000 });
    ok(out.report.pitchWarnings.some(function (w) { return w.indexOf('원정 투수 표의 상대 타자 합 5 ≠ 홈 타석 4') === 0; }), '경고 — ' + JSON.stringify(out.report.pitchWarnings));
    eq([out.report.pitch.linked.away, out.report.pitch.linked.home], [false, true], '원정 투수만 연결 안 함');
    ok(out.game.abs.filter(function (a) { return a.team === 'home'; }).every(function (a) { return !('pitcher' in a); }), '홈 타석에 pitcher 없음');
    ok(out.game.abs.filter(function (a) { return a.team === 'away'; }).every(function (a) { return a.pitcher; }), '원정 타석은 그대로 연결');
  });

  test('복사 방법 안내: 접힌 채 시작 · 표를 한 번 누른 뒤 전체 선택 · 표를 못 찾으면 같은 힌트', async function () {
    openGameOneImport();
    var how = document.querySelector('#goOverlay details.go-how');
    ok(how && !how.open, '접힌 안내');
    ok(how.textContent.indexOf('표를 한 번 누른 뒤') >= 0 && how.textContent.indexOf('아무 칸에나') >= 0, '안내 내용 — ' + how.textContent);
    // 게임원 앱은 글자 복사가 막혀 있다 — 휴대폰은 브라우저(크롬 · 사파리)로 열라는 안내가 접힌 안내 안 · 늘 보이는 첫 줄 둘 다에 있다
    ok(/크롬 · 사파리/.test(how.textContent) && /앱/.test(how.textContent), '브라우저 안내 — ' + how.textContent);
    ok(/앱.*크롬 · 사파리/.test(document.querySelector('#goOverlay .modal-sub').textContent), '첫 줄 브라우저 안내');
    ['goScore', 'goHome'].forEach(function (id) { type(id, ''); });
    type('goAway', '게임결과\n플레이원\n게임영상\n이전\n다음');   // 리그 페이지에서 표를 누르지 않고 전체 선택한 글(바깥 페이지 메뉴뿐)
    await T.sleep(300);
    ok($('goPrev').textContent.indexOf('표를 한 번 누른 뒤') >= 0, '표 못 찾음 힌트 — ' + $('goPrev').textContent);
    type('goAway', '');
    closeOverlay('goOverlay');
  });

  test('원정 · 홈 칸에 같은 표: 같은 선수(이름 + 등번호) 2명 이상이면 알림 · 동명이인 1명은 넘어감', function () {
    var B = window.SLGameOneImport.buildGameOneGame;
    eq(B({ awayText: AWAY, homeText: AWAY, now: 1790000300000 }).report.shared, ['배성웅(15)', '이현준(24)', '김수찬(5)'], '같은 표');
    eq(B({ awayText: AWAY, homeText: HOME, now: 1790000300001 }).report.shared, [], '다른 표');
    var one = bat(1, '배성웅', 15) + '\n' + bat(2, '다른사람', 99);
    eq(B({ awayText: AWAY, homeText: one, now: 1790000300002 }).report.shared, [], '같은 이름 · 등번호 1명뿐(홈 2명)');
  });

  test('붙여넣기 실수 → 미리보기 경고 · 버튼 "그래도" · 저장 전 확인(취소하면 저장 안 함)', async function () {
    openGameOneImport();
    type('goScore', ''); type('goTa', '가팀'); type('goTh', '나팀'); type('goDate', '2026-10-14');
    type('goAway', team('가', NINE).concat(team('나', NINE)).join('\n')); type('goHome', HOME);
    await T.sleep(300);
    var w = Array.prototype.map.call($('goPrev').querySelectorAll('.go-two'), function (e) { return e.textContent; });
    eq(w.length, 1, '경고 1개 — ' + JSON.stringify(w));
    ok(w[0].indexOf('원정 칸에 표가 두 개') >= 0 && w[0].indexOf('10번째 줄 나1(10)부터 타순이 처음부터 다시 돕니다') >= 0, '한 칸에 표 두 개 — ' + w[0]);
    eq($('goSave').textContent, '그래도 새 경기로 저장 (21타석)', '버튼 글자');
    var msgs = [], c0 = window.confirm, before = saves().length;
    try { window.confirm = function (m) { msgs.push(m); return false; }; $('goSave').click(); } finally { window.confirm = c0; }
    eq(saves().length, before, '취소하면 저장 안 함');
    ok(msgs.length === 1 && msgs[0].indexOf('원정 칸에 표가 두 개') >= 0 && msgs[0].indexOf('그래도 새 경기로 저장할까요?') >= 0, '확인창 — ' + JSON.stringify(msgs));
    type('goHome', AWAY); type('goAway', AWAY);
    await T.sleep(300);
    w = Array.prototype.map.call($('goPrev').querySelectorAll('.go-two'), function (e) { return e.textContent; });
    ok(w.length === 1 && w[0].indexOf('원정 · 홈 칸에 같은 선수가 있습니다: 배성웅(15) · 이현준(24) · 김수찬(5)') >= 0, '두 칸에 같은 표 — ' + JSON.stringify(w));
    closeOverlay('goOverlay');
  });

  test('사용 기록(GA4): 입력창 열기 · 저장마다 이벤트 1개 — 타석 수 · 붙여넣기 방식 · 점수표 · 투수 연결 · 모르는 기록 수만, 이름은 싣지 않는다', async function () {
    var ev = [], g0 = window.gtag;
    window.gtag = function (k, n, p) { if (k === 'event' && /^gameone_/.test(n)) ev.push([n, p]); };
    try {
      openGameOneImport();   // ① 통째 붙여넣기(점수표 · 타자 표 2 · 투수 표 2)
      ['goScore', 'goAway', 'goHome', 'goPitch', 'goTa', 'goTh'].forEach(function (id) { type(id, ''); });
      type('goDate', '2026-10-16');
      type('goAway', PAGE);
      await T.sleep(300);
      $('goSave').click();
      closeOverlay('loadOverlay');
      openGameOneImport();   // ② 표 따로 붙여넣기(점수표 · 투수 표 없음, 모르는 기록 1타석) — ①의 '통째' 표시가 남지 않는다
      type('goTa', '다팀'); type('goTh', '라팀'); type('goDate', '2026-10-17');
      type('goAway', AWAY); type('goHome', HOME);
      await T.sleep(300);
      $('goSave').click();
      closeOverlay('loadOverlay');
    } finally { window.gtag = g0; }
    eq(ev, [
      ['gameone_import_open', { from: 'tile' }],
      ['gameone_import', { pa: 11, paste: 'page', scoreboard: 1, pitch: 'linked', skipped: 0, warned: 0 }],
      ['gameone_import_open', { from: 'tile' }],
      ['gameone_import', { pa: 13, paste: 'tables', scoreboard: 0, pitch: 'none', skipped: 1, warned: 0 }]
    ], '이벤트');
    ok(!/[가-힣]/.test(JSON.stringify(ev.map(function (e) { return e[1]; }))), '값에 한글(선수 · 팀 이름 · 기록) 없음 — ' + JSON.stringify(ev));
  });
})();
