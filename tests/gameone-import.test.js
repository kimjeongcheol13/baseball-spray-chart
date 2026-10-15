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
    ok(t.indexOf('0으로 저장') >= 0 && t.indexOf('타점 합계 11') >= 0, '타점 안내 — ' + t);
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
    ok(g.abs.every(function (a) { return a.rbi === 0 && a.pt === null && Array.isArray(a.pitches); }), '타석 타점 0 · 구종 없음');
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
})();
