// 게임원 박스스코어 주소로 가져오기 — 중계(netlify/functions/gameone.mjs ?game=)의 추출(netlify/gameone_extract.mjs boxText) → 평문 → 가져오기 칸
//  · 주소 칸 → 「가져오기」 → 그때 중계에서 받아 점수표 칸에 넣으면 통째 붙여넣기와 같은 길로 점수표 · 원정 · 홈 · 투수 표 · 팀 이름 · 날짜를 채운다
//  · 저장은 사용자가 누른다 · 숨긴 10~12회 칸도 읽는다(연장) · 주소 모양이 틀리면 부르지 않는다 · 404 · 연결 실패 안내
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  // 실제 게임원 박스스코어 HTML 모양(2026-10-30, 팀 · 리그 박스스코어 4경기로 확인)을 줄인 것, 이름은 가명:
  // 주석 · 스크립트 · <caption> 경기 정보 · Team 머리 › 버튼 span · 숨긴 10~12회 칸(class="round hide") · 첫 칸 span 3개 · '/' 두 타석 · 합 계 tfoot · 투수 표
  function td(v, cls) { return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</td>'; }
  function rounds(cells) {   // { 이닝: 글 } → 12칸(10~12 숨김)
    var h = '';
    for (var i = 1; i <= 12; i++) h += '\n      ' + td(cells[i] || '', i > 9 ? 'round hide' : 'round');
    return h;
  }
  function head(first, tail) {
    var h = '<thead>\n    <tr>\n      <th>' + first + '<span class="btn"></span></th>';
    for (var i = 1; i <= 12; i++) h += '\n      <th class="round' + (i > 9 ? ' hide' : '') + '">' + i + '</th>';
    return h + tail.map(function (t) { return '\n      <th>' + t + '</th>'; }).join('') + '\n    </tr>\n  </thead>';
  }
  function team(name) { return '<h3 style="background:url(\'\');padding-left:0"><img src="//file.gameone.kr/x.png" style="width:30px;"/> ' + name + '</h3>'; }
  function bat(num, pos, name, no, cells, stats) {
    return '<tr>\n      <th>\n        <span class="num">' + num + '</span>\n        <span class="position">' + pos + '</span>\n        <span class="name"><strong>' + name + '</strong>(' + no + ')</span>\n      </th>'
      + rounds(cells) + stats.map(function (v, i) { return '\n      ' + td(i === 5 ? '<strong>' + v + '</strong>' : v); }).join('') + '\n    </tr>';
  }
  function batTable(name, rows, sum) {
    return team(name) + '\n<table class="record_table inc_round" summary="타자기록">\n  <colgroup><col span="1" width="120" /></colgroup>\n  '
      + head('선수', ['타수', '안타', '타점', '득점', '도루', '타율', '시즌']) + '\n  <tbody>\n    ' + rows.join('\n    ') + '\n  </tbody>\n  <tfoot>\n    <tr>\n      <th colspan="10">합 계</th>'
      + sum.map(function (v, i) { return td(i === 6 ? '<span class="norm">' + v + '</span>' : v); }).join('') + '\n    </tr>\n  </tfoot>\n</table>';
  }
  var PH = ['선수', '결과', '이닝', '타자', '타수', '피안타', '피홈런', '희타', '희비', '볼넷', '사구', '삼진', '폭투', '보크', '실점', '자책점', '투구수', '방어율', '시즌'];
  function pitTable(name, rows) {
    return team(name) + '\n<table class="record_table" summary="투수기록">\n  <thead><tr>' + PH.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>\n  <tbody>\n'
      + rows.map(function (r) { return '    <tr> <th><strong>' + r[0] + '</strong>(' + r[1] + ')</span></th> ' + r.slice(2).map(function (v, i) { return td(i === 15 ? '<strong>' + v + '</strong>' : v); }).join(' ') + ' </tr>'; }).join('\n')
      + '\n  </tbody>\n</table>';
  }
  function scoreRow(name, inn, rheb) {
    var h = '<tr>\n      <th>' + name + '</th>';
    for (var i = 1; i <= 12; i++) h += '\n      ' + td(inn[i] == null ? '' : inn[i], i > 9 ? 'round hide' : 'round ');
    return h + rheb.map(function (v, i) { return '\n      ' + td(v, i ? '' : 'r'); }).join('') + '\n    </tr>';
  }
  // 가팀(원정 · 윗줄) 4 : 3 나팀 — 1회 1 · 3회 2 · (숨긴) 10회 1. 원정 타석 6개(가일 4 · 가이 2) · 홈 타석 3개
  var HTML = '<html><head><title>게임원</title><script>var x = "<tr><td>가짜</td></tr>";</script></head><body>\n'
    + '<div class="menu"><table><tr><td>메뉴 표</td></tr></table></div>\n<!-- <div class="scon_boxscore">주석 안</div> -->\n'
    + '<div class="scon_boxscore">\n<div class="section_score">\n<dl class="team left"><dt>가팀</dt><dd class="score">4</dd></dl>\n'
    + '<table class="score_teble" summary="게임결과 박스스코어표">\n  <caption><strong>가상리그</strong> / 10.25(11:00) / 가상구장</caption>\n  '
    + head('Team ', ['R', 'H', 'E', 'B']) + '\n  <tbody>\n    '
    + scoreRow('가팀', { 1: 1, 2: 0, 3: 2, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 1 }, [4, 4, 0, 1]) + '\n    '
    + scoreRow('나팀', { 1: 0, 2: 3, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 }, [3, 2, 1, 0]) + '\n  </tbody>\n</table>\n</div>\n'
    + '<div class="article"><h3 class="underline">게임요약</h3><dl><dt>안타</dt><dd>4</dd></dl></div>\n<div class="record">\n'
    + batTable('가팀', [
      bat(1, '二', '가일', 1, { 1: '좌안', 3: '좌중2/1플', 10: '우월홈' }, ['4', '3', '1', '1', '0', '0.750', '0.500']),
      bat(2, '유', '가이', 2, { 1: '삼진', 3: '4구' }, ['1', '0', '0', '0', '0', '0.000', '0.250'])
    ], ['5', '3', '1', '1', '0', '0.600', '0.400']) + '\n'
    + batTable('나팀', [
      bat(1, '중', '나일', 11, { 1: '유땅', 2: '중안' }, ['2', '1', '0', '1', '0', '0.500', '0.300']),
      bat(2, '포', '나이', 12, { 2: '우중2' }, ['1', '1', '2', '0', '0', '1.000', '0.350'])
    ], ['3', '2', '2', '1', '0', '0.667', '0.320']) + '\n'
    + pitTable('가팀', [['가투수', 9, '승', '3', '3', '3', '2', '0', '0', '0', '0', '0', '0', '0', '0', '3', '3', '40', '9.00', '4.00']]) + '\n'
    + pitTable('나팀', [['나투수', 8, '패', '3 ⅔', '6', '5', '3', '1', '0', '0', '1', '0', '1', '0', '0', '4', '4', '70', '9.82', '5.10']]) + '\n'
    + '</div>\n<h3>사진·영상 <span class="gray">(0)</span></h3>\n</div>\n</body></html>';

  var X, TEXT, calls = [], reply, realFetch = window.fetch, events = [], realGtag = window.gtag;
  function fakeFetch(u) { calls.push(String(u)); return reply(); }
  function json(o, st) { return function () { return Promise.resolve(new Response(JSON.stringify(o), { status: st || 200 })); }; }
  function type(id, v) { var el = $(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
  function msg() { return $('goUrlMsg').textContent; }
  function saves() { try { return JSON.parse(localStorage.getItem('sl_saves') || '[]'); } catch (e) { return []; } }
  function expYmd(m, d) {   // 정보 줄 날짜의 기대값: 올해, 오늘보다 뒤면 작년
    var t = new Date(), y = t.getFullYear();
    if (new Date(y, m - 1, d) > new Date(y, t.getMonth(), t.getDate())) y--;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function fresh() {
    openGameOneImport();
    ['goUrl', 'goScore', 'goAway', 'goHome', 'goPitch', 'goTa', 'goTh', 'goDate'].forEach(function (id) { type(id, ''); });
    closeOverlay('goOverlay'); openGameOneImport();
    $('goUrlMsg').textContent = '';
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    X = await import('/netlify/gameone_extract.mjs');
    ok(window.SLGameOne && window.SLGameOneImport && typeof window.fetchGameOneBox === 'function' && typeof X.boxText === 'function', '파서 · 가져오기 모듈 · 중계 추출');
  });

  test('서버 추출(boxText): 정보 줄 · 점수표(숨긴 10~12회 포함) · 팀 이름 · 붙은 첫 칸 · 합 계 · 투수 표 — 메뉴 표 · 주석 · 스크립트는 뺀다', function () {
    TEXT = X.boxText(HTML);
    var L = TEXT.split('\n');
    eq(L.slice(0, 4), ['가상리그 / 10.25(11:00) / 가상구장', 'Team\t1\t2\t3\t4\t5\t6\t7\t8\t9\t10\t11\t12\tR\tH\tE\tB',
      '가팀\t1\t0\t2\t0\t0\t0\t0\t0\t0\t1\t\t\t4\t4\t0\t1', '나팀\t0\t3\t0\t0\t0\t0\t0\t0\t0\t0\t\t\t3\t2\t1\t0'], '정보 줄 · 점수표');
    ok(L.indexOf('1二가일(1)\t좌안\t\t좌중2/1플\t\t\t\t\t\t\t우월홈\t\t\t4\t3\t1\t1\t0\t0.750\t0.500') > 0, '첫 칸 span 3개를 붙임 · 숨긴 10회 칸 · 굵은 타율');
    ok(L.indexOf('합 계\t5\t3\t1\t1\t0\t0.600\t0.400') > 0 && L.indexOf('나투수(8)\t패\t3 ⅔\t6\t5\t3\t1\t0\t0\t1\t0\t1\t0\t0\t4\t4\t70\t9.82\t5.10') > 0, '합 계 · 투수 줄');
    ok(!/메뉴 표|가짜|주석 안/.test(TEXT), '박스스코어 밖 표 · 스크립트 · 주석은 없음');
    eq([X.boxText('<html><table><tr><td>1</td></tr></table></html>'), X.boxText('')], ['', ''], '박스스코어가 없는 페이지 → 빈 글(중계가 404)');
    var sp = window.SLGameOne.splitGameOnePage(TEXT);
    eq([sp.tables.map(function (t) { return t.name; }), sp.score.split('\n').length, window.SLGameOne.parseGameOnePitchers(sp.pitch).tables.map(function (t) { return t.name + ':' + t.pitchers.length; })],
      [['가팀', '나팀'], 3, ['가팀:1', '나팀:1']], '통째 붙여넣기와 같은 길로 나뉨');
    var g = window.SLGameOneImport.buildGameOneGame({ scoreText: sp.score, awayText: sp.tables[0].text, homeText: sp.tables[1].text, pitchText: sp.pitch, now: 1790000900000 }).game;
    eq(g.abs.filter(function (a) { return a.bname === '가일'; }).map(function (a) { return a.inn + ' ' + a.res; }), ['1회초 안타', '3회초 2루타', '3회초 플라이 아웃', '연장 홈런'],
      '같은 이닝 두 타석(/) · 숨긴 10회 칸 = 연장');
    eq([g.abs.length, g.as, g.hs, g.info.ls.away.length], [9, 4, 3, 10], '타석 9 · 점수 · 이닝별 점수 10회까지');
  });

  test('주소 → 중계 질의: 팀 박스스코어 · 리그 박스스코어(안쪽 · 바깥 주소) · game_idx 나 팀 · 리그 번호가 없으면 빈 값', function () {
    var Q = window.SLGameOneImport.gameOneBoxQuery;
    eq([Q('https://www.gameone.kr/club/info/schedule/boxscore?club_idx=14797&game_idx=1722796'),
      Q('https://www.gameone.kr/league/schedule/content/boxscore?lig_idx=10875&game_idx=1693698&group_code=0&outside='),
      Q('gameone.kr/league/schedule/boxscore?game_idx=1693698&lig_idx=10875')],
      ['game=1722796&club=14797', 'game=1693698&lig=10875', 'game=1693698&lig=10875'], '팀 · 리그');
    eq([Q('https://www.gameone.kr/club/?club_idx=14797'), Q('https://www.gameone.kr/x?game_idx=1722796'), Q('1722796'), Q(''), Q(null), Q('?club_idx=14797&game_idx=1234567890')],
      ['', '', '', '', '', ''], '팀 페이지 · 번호 하나뿐 · 숫자만 · 빈 값 · 너무 긴 번호');
  });

  test('주소 칸 → 「가져오기」 → 그때 받아 점수표 · 원정 · 홈 · 투수 표 · 팀 이름 · 날짜 채움 → 저장은 사용자가 → paste = link', async function () {
    window.fetch = fakeFetch;
    window.gtag = function () { events.push(Array.prototype.slice.call(arguments)); };
    try {
      fresh();
      var before = saves().length;
      eq(calls.length, 0, '입력창을 열기만 하면 부르지 않음');
      var done;
      reply = function () { return new Promise(function (res) { done = function () { res(new Response(JSON.stringify({ v: 1, text: TEXT }))); }; }); };
      type('goUrl', 'https://www.gameone.kr/club/info/schedule/boxscore?club_idx=14797&game_idx=1722796');
      $('goUrlBtn').click();
      ok(/^https:\/\/spraylab-gameone\.netlify\.app\/api\/gameone\?game=1722796&club=14797&t=\d+$/.test(calls[calls.length - 1]), '중계 주소 — ' + calls[calls.length - 1]);
      ok(/가져오는 중/.test(msg()) && $('goUrlBtn').disabled, '받는 동안 안내 · 버튼 잠금');
      done();
      await T.sleep(400);
      ok(!$('goUrlBtn').disabled && /가져왔어요/.test(msg()) && !$('goUrlMsg').classList.contains('bad'), '안내 — ' + msg());
      ok($('goScore').value.indexOf('Team\t1\t2') === 0 && $('goScore').value.split('\n').length === 3, '점수표 칸 — ' + JSON.stringify($('goScore').value));
      eq([$('goAway').value.split('\n')[1].split('\t')[0], $('goHome').value.split('\n')[1].split('\t')[0], $('goPitch').value.indexOf('나투수(8)') >= 0], ['1二가일(1)', '1중나일(11)', true], '원정 · 홈 · 투수 칸');
      eq([$('goTa').value, $('goTh').value, $('goDate').value], ['가팀', '나팀', expYmd(10, 25)], '팀 이름 · 날짜(정보 줄)');
      var note = $('goPrev').querySelector('.go-split');
      ok(note && /^게임원 주소에서 가져온 박스스코어를 이닝별 점수표 · 원정\(가팀\) · 홈\(나팀\) 타자 표 · 투수 표로 나눴습니다/.test(note.textContent), '미리보기 안내 — ' + (note ? note.textContent : $('goPrev').textContent));
      ok($('goPrev').textContent.indexOf('가팀 4 : 3 나팀') >= 0, '미리보기 점수');
      eq([$('goSave').textContent, saves().length], ['새 경기로 저장 (9타석)', before], '저장 버튼 — 받기만 하고 아직 저장하지 않음');
      $('goSave').click();
      var s = saves(), g = JSON.parse(localStorage.getItem(s[s.length - 1].key));
      eq([s.length, g.ta, g.th, g.as, g.hs, g.abs.length, g.info.venue], [before + 1, '가팀', '나팀', 4, 3, 9, '가상구장'], '저장: 팀 · 점수 · 타석 · 구장');
      var ev = events.filter(function (e) { return e[0] === 'event' && e[1] === 'gameone_import'; }).pop();
      eq(ev && ev[2].paste, 'link', '사용 기록 paste = link');
      eq([$('goUrl').value, msg(), $('goScore').value], ['', '', ''], '저장 뒤 주소 칸 · 안내 · 칸 비움');
      closeOverlay('loadOverlay');
    } finally { window.fetch = realFetch; window.gtag = realGtag; }
  });

  test('주소가 틀리면 부르지 않고 안내 · 404 = 기록 없음 · 연결 실패 = 다시 · 칸은 그대로', async function () {
    window.fetch = fakeFetch;
    try {
      fresh();
      calls.length = 0;
      type('goUrl', 'https://www.gameone.kr/club/info/schedule/boxscore?game_idx=1722796');   // 팀 주소(club_idx 만)는 시즌 목록 — gameone-season.test.js
      $('goUrlBtn').click();
      ok(calls.length === 0 && /game_idx=/.test(msg()) && $('goUrlMsg').classList.contains('bad'), '팀 · 리그 번호 없는 주소 — ' + msg());
      type('goUrl', 'https://www.gameone.kr/club/info/schedule/boxscore?club_idx=14797&game_idx=1718831');
      reply = json({ error: 'empty' }, 404);
      $('goUrlBtn').click();
      await T.sleep(200);
      ok(calls.length === 1 && /타자 기록이 없어요/.test(msg()) && $('goUrlMsg').classList.contains('bad') && !$('goUrlBtn').disabled, '404 — ' + msg());
      reply = function () { return Promise.reject(new TypeError('Failed to fetch')); };
      $('goUrlBtn').click();
      await T.sleep(200);
      ok(/가져오지 못했어요/.test(msg()), '연결 실패 — ' + msg());
      reply = json({ v: 2 });
      $('goUrlBtn').click();
      await T.sleep(200);
      ok(/가져오지 못했어요/.test(msg()) && $('goScore').value === '' && $('goSave').disabled, '모르는 답 · 칸 그대로 · 저장 꺼짐');
      closeOverlay('goOverlay');
    } finally { window.fetch = realFetch; }
  });

  test('박스스코어 주소 → 한 경기 뒤 미리보기로 내려감 · 그 밑 「이 팀 시즌 경기 목록 보기」 → 주소 칸으로 올라가 그 팀 시즌 목록 · 기록 없는 경기는 안내 밑 · 리그 박스스코어는 없음', async function () {
    window.fetch = fakeFetch;
    var seen = [], realSiv = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (o) { seen.push(this.id); return realSiv.call(this, o); };
    try {
      fresh();
      calls.length = 0;
      reply = json({ v: 1, text: TEXT });
      type('goUrl', 'https://www.gameone.kr/club/info/schedule/boxscore?club_idx=14797&game_idx=1722796');
      $('goUrlBtn').click();
      await T.sleep(400);
      var b = $('goPrevMore').querySelector('.go-season-open');
      ok(b && b.textContent === '이 팀 시즌 경기 목록 보기' && b.offsetHeight >= 44 && /가져왔어요/.test(msg()) && !$('goUrlMsg').querySelector('.go-season-open'), '한 경기 받은 뒤 버튼 = 미리보기 밑 — ' + msg());
      eq([seen.slice(-1)[0], $('goPrev').textContent.indexOf('가팀 4 : 3 나팀') >= 0, !$('goSave').disabled], ['goPrev', true, true], '그린 미리보기로 내려감 · 저장 버튼 켜짐');
      ok(b.compareDocumentPosition($('goSave')) & Node.DOCUMENT_POSITION_PRECEDING, '버튼은 「새 경기로 저장」 밑');
      reply = json({ v: 1, team: '가팀', season: 2026, more: false, games: [{ game: 101, md: '10-24', time: '11:00', lig: '가상리그', venue: '가상구장', away: '가팀', as: 9, home: '다팀', hs: 3, note: '' }] });
      b.click();
      await T.sleep(400);
      ok(/\?list=1&club=14797&t=\d+$/.test(calls[calls.length - 1]), '목록 질의 — ' + calls[calls.length - 1]);
      ok(!$('goSeason').hidden && /가팀 2026시즌 · 1경기/.test($('goSeason').textContent) && $('goSeason').querySelectorAll('.go-season-yb').length === 4, '시즌 목록 · 시즌 버튼 — ' + $('goSeason').textContent.slice(0, 40));
      eq([msg(), $('goPrevMore').textContent, seen.indexOf('goUrl') >= 0, $('goScore').value.indexOf('Team') === 0], ['', '', true, true], '주소 칸으로 올라감 · 안내 줄 · 미리보기 밑 버튼 비움 · 받은 한 경기는 칸에 그대로');
      reply = json({ error: 'empty' }, 404);
      type('goUrl', 'https://www.gameone.kr/club/info/schedule/boxscore?club_idx=14797&game_idx=1718831');
      $('goUrlBtn').click();
      await T.sleep(200);
      ok(/타자 기록이 없어요/.test(msg()) && !!$('goUrlMsg').querySelector('.go-season-open') && !$('goPrevMore').querySelector('.go-season-open'), '기록 없는 경기 — 버튼은 안내 밑 — ' + msg());
      reply = function () { return Promise.reject(new TypeError('Failed to fetch')); };
      $('goUrlBtn').click();
      await T.sleep(200);
      ok(/가져오지 못했어요/.test(msg()) && !$('goUrlMsg').querySelector('.go-season-open') && !$('goPrevMore').querySelector('.go-season-open'), '연결 실패면 버튼 없음');
      reply = json({ v: 1, text: TEXT });
      type('goUrl', 'https://www.gameone.kr/league/schedule/boxscore?lig_idx=10875&game_idx=1693698');
      $('goUrlBtn').click();
      await T.sleep(400);
      ok(/가져왔어요/.test(msg()) && !$('goUrlMsg').querySelector('.go-season-open') && !$('goPrevMore').querySelector('.go-season-open') && seen.slice(-1)[0] === 'goPrev', '리그 박스스코어(팀 번호 없음) — 버튼 없음 · 그래도 미리보기로 내려감');
      closeOverlay('goOverlay');
    } finally { window.fetch = realFetch; Element.prototype.scrollIntoView = realSiv; }
  });
})();
