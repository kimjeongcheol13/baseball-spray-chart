// 종이 기록지 옮기기(js/features/scoresheetentry.js) — 데이터 관리 › 가져오기 › 종이 기록지 옮기기
//  · 타일 → 가져오기 창이 기록지 모드로: 제목 · 게임원 주소 · 스크린샷 · 붙여넣기 칸 숨김 · 타순 9줄 × 이닝 7칸 표(원정 · 홈 탭)
//  · 손으로 친 표 → 게임원 타자 표와 같은 탭 구분 글 → 기존 파서 · 미리보기 · 저장: 타석 수 · 결과 · 이닝 · 점수(득점 줄) · 타점(타점 칸)
//  · + 줄 추가(교체 선수 = 같은 타순 번호) · + 이닝 추가 · 적던 표 보관(sl_sheet_draft) · 사용 기록 scoresheet_entry_open / _save (숫자만)
//  · 게임원 가져오기는 그대로 — 모드가 섞이지 않는다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  function saves() { try { return JSON.parse(localStorage.getItem('sl_saves') || '[]'); } catch (e) { return []; } }
  function grid(team) { return document.querySelector('#goSheetGrid table[data-team="' + team + '"]'); }
  function set(el, v) { el.value = v; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }
  // o = { o 타순, pos 위치(게임원 표기), name, cells: { 이닝: 값 }, rbi }
  function fill(team, i, o) {
    var tr = grid(team).tBodies[0].rows[i];
    if (o.o != null) set(tr.querySelector('.go-sh-o'), o.o);
    if (o.pos != null) set(tr.querySelector('.go-sh-p'), o.pos);
    if (o.name != null) set(tr.querySelector('.go-sh-n'), o.name);
    Object.keys(o.cells || {}).forEach(function (k) { set(tr.querySelectorAll('.go-sh-c')[k - 1], o.cells[k]); });
    if (o.rbi != null) set(tr.querySelector('.go-sh-r'), o.rbi);
  }
  function runs(team, arr) { arr.forEach(function (v, j) { if (v !== '') set(grid(team).querySelectorAll('.go-sh-s')[j], v); }); }
  function shown(el) { return !!el && el.offsetParent !== null; }
  function seq(g) { return g.abs.map(function (a) { return a.inn + ' ' + a.bname + ' ' + a.res; }); }
  async function spy(fn) {
    var ev = [], g0 = window.gtag;
    window.gtag = function (k, n, p) { if (k === 'event' && /^(gameone|scoresheet)_/.test(n)) ev.push([n, p]); };
    try { await fn(); } finally { window.gtag = g0; }
    return ev;
  }
  var TAB = '\t';

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.SLGameOne && window.SLGameOneImport && window.SLSheetEntry, '파서 · 가져오기 · 기록지 입력 모듈 로드');
  });

  test('표 → 글: 타순 ⇥ 위치 ⇥ 이름(번호) ⇥ 이닝 칸 ⇥ 성적 7칸 — 파서가 그대로 읽는다', function () {
    var S = window.SLSheetEntry, side = { rows: [
      { o: '1', pos: '유', name: '김민준(7)', cells: ['좌안', '', '유땅', '', '4구'], rbi: '' },
      { o: '2', pos: '포', name: '이도윤', cells: ['중플', '', ' 좌중2 / 삼진 ', '', '', '', '-'], rbi: '2' },
      { o: '3', pos: '', name: '', cells: [], rbi: '' },                                    // 빈 줄 → 뺀다
      { o: '4', pos: '', name: '', cells: ['', '', '', '', '', '', '4'], rbi: '' },         // 이름 없이 칸만 → '4번' · 잘못 적은 숫자
      { o: '1', pos: '', name: '박서준', cells: ['', '', '', '', '', '삼진'], rbi: '' }    // 교체 선수: 같은 타순 → 선발 바로 아래
    ] };
    var text = S.sheetToText(side, 7, 3);
    eq(text.split('\n'), [
      ['1', '유', '김민준(7)', '좌안', '', '유땅', '', '4구', '', '', '-', '-', '-', '3', '-', '-', '-'].join(TAB),
      ['1', '', '박서준()', '', '', '', '', '', '삼진', '', '-', '-', '-', '-', '-', '-', '-'].join(TAB),
      ['2', '포', '이도윤()', '중플', '', '좌중2 / 삼진', '', '', '', '', '-', '-', '2', '-', '-', '-', '-'].join(TAB),
      ['4', '', '4번()', '', '', '', '', '', '', '4', '-', '-', '-', '-', '-', '-', '-'].join(TAB)
    ], '글 형식 (득점 합계 3 은 첫 줄 득점 칸)');
    var P = window.SLGameOne.parseGameOne(text);
    eq(P.players.map(function (p) { return p.order + ' ' + p.position + ' ' + p.name + '#' + p.number + ' ' + p.atBats.map(function (a) { return a.inning + ':' + a.result; }).join(','); }),
      ['1 유 김민준#7 1:안타,3:땅볼 아웃,5:볼넷', '1  박서준# 6:삼진', '2 포 이도윤# 1:플라이 아웃,3:2루타,3:삼진', '4  4번# 7:null'], '파서가 읽은 타순 · 위치 · 이름 · 이닝 · 결과');
    eq(P.players.map(function (p) { return [p.stats.rbi, p.stats.r]; }), [[null, 3], [null, null], [2, null], [null, null]], '타점 · 득점 칸');
    eq(P.unknownTokens, ['4'], '이닝 칸에 적은 숫자는 성적 칸으로 읽히지 않고 모르는 기록으로 남는다');
    eq(S.sheetToText({ rows: [{ o: '', pos: '', name: '', cells: [], rbi: '' }] }, 7), '', '빈 표 → 빈 글');

    var sc = S.sheetScoreText({ n: 7, away: { runs: ['0', '2', '', '1'] }, home: { runs: [] } });
    eq(sc.split('\n'), [['Team', 1, 2, 3, 4, 5, 6, 7, 'R'].join(TAB), ['원정팀', 0, 2, '', 1, '', '', '', 3].join(TAB), ['홈팀', '', '', '', '', '', '', '', 0].join(TAB)], '득점 줄 → 이닝별 점수표 글');
    var B = window.SLGameOne.parseGameOneScoreboard(sc);
    eq([B.teams.map(function (t) { return [t.innings, t.r]; }), B.warnings], [[[[0, 2, null, 1], 3], [[], 0]], []], '점수표 파서가 읽은 이닝 · 합계');
    eq(S.sheetScoreText({ n: 7, away: { runs: [] }, home: { runs: ['', 'x'] } }), '', '득점 줄이 비면 점수표 없음');
  });

  test('데이터 관리 › 종이 기록지 타일 → 가져오기 창이 기록지 모드로 열린다', async function () {
    openOverlay('dataSettingsOverlay');
    var tile = document.querySelector('#dataSettingsOverlay .sh-tile');
    ok(tile && tile.previousElementSibling === document.querySelector('#dataSettingsOverlay .go-tile'), '게임원 타일 옆');
    var ev = await spy(function () { tile.click(); });
    ok($('goOverlay').classList.contains('show') && !$('dataSettingsOverlay').classList.contains('show'), '입력창 열림 · 데이터 관리 닫힘');
    eq($('goTitle').textContent, '종이 기록지 옮기기', '제목');
    eq(['.go-link', '.go-shot', '#goScore', '#goAway', '#goHome', '#goPitch'].filter(function (s) { return shown(document.querySelector('#goOverlay ' + s)); }), [], '게임원 주소 · 스크린샷 · 붙여넣기 칸 숨김');
    ok(shown($('goSheet')) && shown($('goTa')) && shown($('goDate')) && shown($('goSave')), '입력 표 · 팀 이름 · 날짜 · 저장 버튼 보임');
    eq([grid('away').tBodies[0].rows.length, grid('away').tBodies[0].rows[0].querySelectorAll('.go-sh-c').length, grid('away').querySelectorAll('.go-sh-s').length], [9, 7, 7], '타순 9줄 × 이닝 7칸 + 득점 7칸');
    eq([].map.call(grid('away').querySelectorAll('.go-sh-o'), function (i) { return i.value; }).join(''), '123456789', '타순 번호 1~9');
    ok(shown(grid('away')) && !shown(grid('home')), '원정 탭부터');
    var small = [].filter.call(grid('away').querySelectorAll('input, select'), function (el) { var r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
    eq(small.length, 0, '칸 터치 크기 44px 이상');
    ok($('goSave').disabled, '비어 있으면 저장 버튼 꺼짐');
    eq(ev, [['scoresheet_entry_open', {}]], '사용 기록: 열기 (게임원 열기 이벤트는 보내지 않는다)');
  });

  test('표를 채우고 미리보기 → 기존 미리보기에 점수 · 타석 수 · 모르는 기록', async function () {
    set($('goTa'), '상대'); set($('goTh'), '우리'); set($('goDate'), '2026-11-01');
    fill('away', 0, { pos: '유', name: '김민준(7)', cells: { 1: '좌안', 3: '유땅', 5: '4구' } });
    fill('away', 1, { pos: '포', name: '이도윤', cells: { 1: '중플', 3: '좌중2/삼진' }, rbi: '2' });
    fill('away', 2, { pos: '1', name: '최하준', cells: { 1: '좌홈', 3: '번트' }, rbi: '1' });
    document.querySelector('#goSheet [onclick="scoresheetAdd(\'row\')"]').click();
    eq([grid('away').tBodies[0].rows.length, grid('home').tBodies[0].rows.length, grid('away').tBodies[0].rows[9].querySelector('.go-sh-o').value], [10, 9, '10'], '+ 줄 추가: 보고 있는 팀에 한 줄 · 다음 타순 번호');
    eq(grid('away').tBodies[0].rows[0].querySelector('.go-sh-n').value, '김민준(7)', '줄을 추가해도 적은 내용은 그대로');
    fill('away', 9, { o: '1', name: '박서준', cells: { 6: '삼진' } });   // 1번 타순 교체 선수
    runs('away', ['1', '', '2']);
    document.querySelector('#goSheet [data-sheet-tab="home"]').click();
    ok(shown(grid('home')) && !shown(grid('away')), '홈 탭');
    fill('home', 0, { name: '정우진', cells: { 2: '삼진' } });
    runs('home', ['', '0']);
    document.querySelector('#goSheet [onclick="scoresheetPreview()"]').click();
    await T.sleep(300);
    var t = $('goPrev').textContent;
    ok(t.indexOf('상대 3 : 0 우리') >= 0, '점수 = 득점 줄 합계 — ' + t);
    ok(t.indexOf('저장 안 함 1타석') >= 0 && t.indexOf("최하준 3회 '번트'") >= 0, '모르는 기록 — ' + t);
    ok(t.indexOf('타자 표 합계') < 0, '점수표 · 타자 표 득점이 다르다는 경고 없음 — ' + t);
    ok(t.indexOf('타점 칸에는 선수별 타점 합계만 있어') >= 0, '타점 안내 — ' + t);
    eq([$('goSave').disabled, $('goSave').textContent], [false, '새 경기로 저장 (9타석)'], '저장 버튼');
    eq($('goSheetMsg').textContent, '', '득점 줄을 적었으면 0 : 0 안내 없음');
    ok(JSON.parse(localStorage.getItem('sl_sheet_draft')).away.rows[0].name === '김민준(7)', '적던 표 보관');
  });

  test('새 경기로 저장 → 타석 수 · 결과 · 이닝 · 점수 · 타점 · 라인업, 기록 중인 경기는 그대로', async function () {
    var before = saves().length, cur = JSON.stringify(AS.abs);
    var ev = await spy(function () { $('goSave').click(); });
    var s = saves();
    eq(s.length, before + 1, '저장 항목 1개 추가');
    var e = s[s.length - 1], g = JSON.parse(localStorage.getItem(e.key));
    ok(_isSaveKey(e.key) && _gameDataOk(g), '앱의 경기 저장 키 · 저장 형식 검증 통과');
    eq([g.th, g.ta, g.hs, g.as, g.info.date], ['우리', '상대', 0, 3, '2026-11-01'], '팀 · 점수 · 날짜');
    eq(g.info.ls, { away: [1, null, 2], home: [null, 0] }, '이닝별 점수(득점 줄)');
    eq(seq(g), ['1회초 김민준 안타', '1회초 이도윤 플라이 아웃', '1회초 최하준 홈런', '2회말 정우진 삼진', '3회초 김민준 땅볼 아웃', '3회초 이도윤 2루타', '3회초 이도윤 삼진',
      '5회초 김민준 볼넷', '6회초 박서준 삼진'], '타석 9개 — 이닝 · 타자 · 결과 (번트 제외)');
    eq(g.abs.filter(function (a) { return a.rbi; }).map(function (a) { return a.bname + ' ' + a.res + ':' + a.rbi; }), ['최하준 홈런:1', '이도윤 2루타:2'], '타점 칸 → 그 선수 타석에');
    eq(g.away_lineup.map(function (p) { return p.name + '#' + p.num + '/' + p.pos + '/' + (p.isStarter ? '선발' : '교체'); }),
      ['김민준#7/유격/선발', '박서준#//교체', '이도윤#/포수/선발', '최하준#/1루/선발'], '원정 라인업 — 같은 타순 둘째 줄 = 교체');
    eq(g.home_lineup.map(function (p) { return p.name; }), ['정우진'], '홈 라인업');
    ok(g.abs.filter(function (a) { return a.x != null; }).length === 5 && g.abs.every(function (a) { return a.team === (a.bname === '정우진' ? 'home' : 'away'); }), '타구 위치 5개 · 팀');
    eq(JSON.stringify(AS.abs), cur, '기록 중인 경기는 그대로');
    ok($('loadOverlay').classList.contains('show') && !$('goOverlay').classList.contains('show'), '입력창 닫고 불러오기 목록 열림');
    ok($('toastTxt').textContent.indexOf('기록지 9타석 → 새 경기로 저장됨 (모르는 기록 1타석 제외)') >= 0, '토스트: ' + $('toastTxt').textContent);
    eq(ev, [['scoresheet_entry_save', { pa: 9, skipped: 1, warned: 0 }]], '사용 기록: 저장 — 숫자만 (게임원 저장 이벤트는 보내지 않는다)');
    eq([$('goAway').value, $('goSheetGrid').children.length, localStorage.getItem('sl_sheet_draft')], ['', 0, null], '저장 뒤 숨은 칸 · 표 · 보관본 비움');
    if (window.gameOneFixClose) window.gameOneFixClose();
    closeOverlay('goFixOverlay'); closeOverlay('loadOverlay');
  });

  test('다시 열면 빈 표 · + 이닝 추가 · 득점 줄이 비면 0 : 0 안내 · 적던 표는 새로 고쳐도 남는다', async function () {
    openScoresheetEntry();
    eq([grid('away').tBodies[0].rows.length, grid('away').querySelector('.go-sh-n').value, shown(grid('away'))], [9, '', true], '빈 표 · 원정 탭');
    fill('away', 0, { name: '한지호', cells: { 7: '우안' } });
    document.querySelector('#goSheet [onclick="scoresheetAdd(\'inn\')"]').click();
    eq([grid('away').tBodies[0].rows[0].querySelectorAll('.go-sh-c').length, grid('home').tBodies[0].rows[0].querySelectorAll('.go-sh-c').length, grid('home').querySelectorAll('.go-sh-s').length], [8, 8, 8], '+ 이닝 추가: 두 팀 다 8칸');
    eq(grid('away').tBodies[0].rows[0].querySelectorAll('.go-sh-c')[6].value, '우안', '적은 칸은 그대로');
    fill('away', 0, { cells: { 8: '중2' } });
    await T.sleep(300);
    ok($('goSheetMsg').textContent.indexOf('0 : 0') >= 0, '득점 줄 안내: ' + $('goSheetMsg').textContent);
    eq($('goSave').textContent, '새 경기로 저장 (2타석)', '칸을 고치면 미리보기 · 저장 버튼이 따라온다');
    // 새로 고침 흉내: 표를 비우고 다시 연다 → 보관본에서 되살린다
    $('goSheetGrid').innerHTML = '';
    openScoresheetEntry();
    eq([grid('away').tBodies[0].rows[0].querySelector('.go-sh-n').value, grid('away').tBodies[0].rows[0].querySelectorAll('.go-sh-c')[7].value], ['한지호', '중2'], '보관본에서 되살림(8회 칸 포함)');
    await T.sleep(300);
    var g = window.SLGameOneImport.buildGameOneGame({ awayText: $('goAway').value }).game;
    eq(seq(g), ['7회초 한지호 안타', '8회초 한지호 2루타'], '숨은 칸의 글 → 7 · 8회 타석');
  });

  test('게임원 가져오기는 그대로 — 기록지에서 적던 글이 섞이지 않고, 기록지로 돌아오면 표는 남아 있다', async function () {
    closeOverlay('goOverlay');
    var ev = await spy(function () { openGameOneImport(); });
    eq([$('goTitle').textContent, shown(document.querySelector('#goOverlay .go-link')), shown($('goAway')), shown($('goSheet'))], ['게임원 기록 가져오기', true, true, false], '게임원 모드: 제목 · 주소 칸 · 붙여넣기 칸 보임 · 입력 표 숨김');
    eq([$('goAway').value, $('goHome').value, $('goScore').value], ['', '', ''], '붙여넣기 칸은 비어 있다');
    ok($('goSave').disabled, '저장 버튼 꺼짐');
    eq(ev, [['gameone_import_open', { from: 'tile' }]], '게임원 열기 이벤트');
    // 표 칸에 커서를 둔 채 창을 닫았다 게임원 모드로 열면 그 칸의 change 가 늦게 온다 — 붙여넣기 칸을 채우면 안 된다
    grid('away').querySelector('.go-sh-c').dispatchEvent(new Event('change', { bubbles: true }));
    eq([$('goAway').value, $('goScore').value], ['', ''], '게임원 모드에서는 표가 붙여넣기 칸을 건드리지 않는다');
    closeOverlay('goOverlay');
    openScoresheetEntry();
    await T.sleep(300);
    eq([$('goTitle').textContent, grid('away').tBodies[0].rows[0].querySelector('.go-sh-n').value, $('goSave').textContent], ['종이 기록지 옮기기', '한지호', '새 경기로 저장 (2타석)'], '기록지 모드로 돌아오면 표 · 미리보기 그대로');
    // 칸에 글자를 치고 커서를 둔 채 표가 지워지면(저장 뒤 정리) 그 칸의 change 가 한 번 더 온다 — 보관본이 되살아나면 안 된다
    var c = grid('away').tBodies[0].rows[1].querySelector('.go-sh-c');
    c.focus(); document.execCommand('insertText', false, '좌안');
    eq(c.value, '좌안', '(준비) 직접 친 글자');
    $('goAway').value = '';   // 저장이 숨은 칸을 비운 뒤(_resetInputs) 표를 정리하는 순서 그대로
    clearScoresheetEntry();
    eq([localStorage.getItem('sl_sheet_draft'), $('goSheetGrid').children.length, $('goAway').value], [null, 0, ''], '정리 뒤 보관본 · 표 없음 · 숨은 칸도 그대로 비어 있다');
    closeOverlay('goOverlay');
  });
})();
