// 게임원 시즌 한 번에 — 팀 주소(club_idx=, game_idx 없음) → 중계 ?list=1(netlify/gameone_extract.mjs schedule) → 경기 목록에서 골라 차례로 ?game= → 새 경기로 저장
//  · 이미 저장된 경기 · 몰수 · 박스스코어 없는 경기는 꺼 둔다 · 날짜 = 목록 월일 + 시즌 · 404 = 기록 없음 · 부르는 사이 6.5초(호출 제한) · 창을 닫으면 멈춘다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  // 실제 경기결과 페이지 모양(2026-10-30, club/info/schedule/result)을 줄인 것, 이름은 가명:
  // 머리 줄 · 날짜 칸 <strong> · 분류 · 구장 · team1(원정) / team2(홈) · 링크로 감싼 상대 팀 · 콜드승(exp_win) · BOX SCORE 링크 · 쪽 번호
  function row(md, time, lig, venue, away, as, home, hs, note, game) {
    var side = function (cls, name, r, n) {
      return '<div class="' + cls + ' ' + (n ? 'exp' : '') + '">\n<span class="emblem"><img src="//file.gameone.kr/x.png" alt="' + name + '"/></span>\n<span class="team_name">' + name + '</span>\n'
        + (n ? '<span class="exp_win">' + n + '</span> ' : '') + '<span class="score">' + r + '</span>\n</div>';
    };
    return '<tr>\n<td><strong>' + md + '</strong>(일) ' + time + '</td>\n<td style="overflow:hidden;">' + lig + '</td>\n<td>' + venue + '</td>\n'
      + '<td><div class="game team1"><!--이긴쪽이 클래스 team1, team2 로선택-->\n' + side('team1', away, as, '') + '\n<a href="/club/?club_idx=1" target="_blank">' + side('team2', home, hs, note) + '</a></div></td>\n'
      + '<td>' + (game ? '<a href="/club/info/schedule/boxscore?club_idx=14797&game_idx=' + game + '" class="simbtn boxscore">BOX SCORE</a>' : '') + '</td>\n</tr>';
  }
  var PAGE = '<html><head><title>가팀</title></head><body>\n<select id="season" name="season"><option value="2027" >2027시즌</option><option value="2026" selected>2026시즌</option></select>\n'
    + '<a href="/club/info/schedule/boxscore?club_idx=14797">박스스코어</a>\n<table class="game_table">\n<tr><th>일시</th><th>분류</th><th>구장</th><th>게임</th><th>결과</th></tr>\n'
    + row('10월25일', '13:30', '가상리그', '가상구장', '가팀', 8, '나팀', 4, '', 1722851) + '\n'
    + row('09월13일', '08:00', '가상리그 ', '나구장', '다팀', '0', '가팀', '7', '몰수승', 1718831) + '\n'
    + row('09월06일', '', '가상대회', '나구장', '가팀', '', '라팀', '', '', 0) + '\n'
    + '</table>\n<ul><li><a href="?season=2026&club_idx=14797&game_type=0&page=1" class="cur">1</a></li><li><a href="?season=2026&club_idx=14797&game_type=0&page=2">2</a></li>'
    + '<li><a href="?season=2026&club_idx=14797&game_type=0&page=2" class="next">다음</a></li></ul>\n</body></html>';

  // 박스스코어 평문(중계 ?game= 의 답) — 가팀(원정) 4 : 3 나팀(홈), 원정 타석 2 · 홈 타석 1
  var R12 = function (o) { var a = []; for (var i = 1; i <= 12; i++) a.push(o[i] == null ? '' : o[i]); return a.join('\t'); };
  var HEAD = '선수\t' + R12({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12 }) + '\t타수\t안타\t타점\t득점\t도루\t타율\t시즌';
  var BOX = ['가상리그 / 10.25(13:30) / 가상구장', 'Team\t' + R12({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12 }) + '\tR\tH\tE\tB',
    '가팀\t' + R12({ 1: 4, 2: 0, 3: 0, 4: 0, 5: 0 }) + '\t4\t2\t0\t1', '나팀\t' + R12({ 1: 0, 2: 3, 3: 0, 4: 0, 5: 0 }) + '\t3\t1\t1\t0',
    '가팀', HEAD, '1二가일(1)\t' + R12({ 1: '좌안', 3: '우중2' }) + '\t2\t2\t1\t1\t0\t1.000\t0.500', '합 계\t2\t2\t1\t1\t0\t1.000\t0.500',
    '나팀', HEAD, '1중나일(11)\t' + R12({ 2: '유땅' }) + '\t1\t0\t0\t0\t0\t0.000\t0.300', '합 계\t1\t0\t0\t0\t0\t0.000\t0.300'].join('\n');

  // 중계 목록 답: 101 새 경기 · 102 이미 저장된 경기(다팀 1 : 2 가팀) · 103 몰수 · 박스스코어 없음 · 105 받으면 404
  var LIST = { v: 1, team: '가팀', season: 2026, more: false, games: [
    { game: 101, md: '10-25', time: '13:30', lig: '가상리그', venue: '가상구장', away: '가팀', as: 4, home: '나팀', hs: 3, note: '' },
    { game: 102, md: '10-18', time: '11:00', lig: '가상리그', venue: '가상구장', away: '다팀', as: 1, home: '가팀', hs: 2, note: '' },
    { game: 103, md: '10-11', time: '08:00', lig: '가상리그', venue: '나구장', away: '가팀', as: 7, home: '라팀', hs: 0, note: '몰수승' },
    { game: null, md: '10-04', time: '', lig: '가상대회', venue: '나구장', away: '가팀', as: null, home: '마팀', hs: null, note: '' },
    { game: 105, md: '09-27', time: '16:00', lig: '가상리그', venue: '나구장', away: '가팀', as: 5, home: '바팀', hs: 1, note: '콜드승' }
  ] };
  // 2025시즌 목록: 202 는 저장된 경기(2026-10-18 다팀 1 : 2 가팀)와 월일 · 팀 · 점수가 같지만 해가 달라 다른 경기
  var LIST25 = { v: 1, team: '가팀', season: 2025, more: false, games: [
    { game: 201, md: '08-10', time: '09:00', lig: '가상리그', venue: '가상구장', away: '가팀', as: 3, home: '사팀', hs: 2, note: '' },
    { game: 202, md: '10-18', time: '11:00', lig: '가상리그', venue: '가상구장', away: '다팀', as: 1, home: '가팀', hs: 2, note: '' }
  ] };
  var calls = [], realFetch = window.fetch, OLD = 'sl_test_season_old', KEEP = null, fail105 = 0;
  function fakeFetch(u) {
    u = String(u); calls.push({ u: u, t: Date.now() });
    var q = u.split('?')[1] || '';
    if (/^game=105&/.test(q) && fail105-- > 0) return Promise.reject(new TypeError('Failed to fetch'));   // Netlify 429(CORS 머리 없음)는 브라우저에서 이렇게 보인다
    var y = /^list=1&club=\d+&season=(\d{4})&/.exec(q);   // 2025 = 목록 · 2019 = 게임원이 다른 시즌(2026)을 돌려줌 · 그 밖(2026 빼고) = 경기 없음(404)
    if (y && y[1] === '2025') return Promise.resolve(new Response(JSON.stringify(LIST25)));
    if (y && y[1] !== '2026' && y[1] !== '2019') return Promise.resolve(new Response(JSON.stringify({ error: 'empty' }), { status: 404 }));
    if (/^list=1/.test(q)) return Promise.resolve(new Response(JSON.stringify(LIST)));
    if (/^game=101&/.test(q)) return Promise.resolve(new Response(JSON.stringify({ v: 1, text: BOX })));
    return Promise.resolve(new Response(JSON.stringify({ error: 'empty' }), { status: 404 }));
  }
  function type(id, v) { var el = $(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
  function saves() { try { return JSON.parse(localStorage.getItem('sl_saves') || '[]'); } catch (e) { return []; } }
  function rows() { return [].map.call(document.querySelectorAll('#goSeason .go-season-list li'), function (li) { var c = li.querySelector('input'); return (c.checked ? '☑' : '☐') + (c.disabled ? '-' : '') + (li.querySelector('.go-season-st') || { textContent: '' }).textContent; }); }
  function gameCalls() { return calls.filter(function (c) { return /\?game=/.test(c.u); }); }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.SLGameOneImport && window.SLGameOneImport.gameOneSeasonQuery && typeof window.saveGameOneSeason === 'function', '시즌 한 번에 모듈');
  });

  test('서버 추출(schedule): 날짜 · 시각 · 분류 · 구장 · 원정(team1) · 홈(team2) · 점수 · 콜드 · 몰수 · 경기 번호 · 쪽 수 · 시즌', async function () {
    var X = await import('/netlify/gameone_extract.mjs');
    var s = X.schedule(PAGE);
    eq([s.season, s.pages, s.games.length], [2026, 2, 3], '시즌 · 쪽 · 경기 수');
    eq(s.games[0], { game: 1722851, md: '10-25', time: '13:30', lig: '가상리그', venue: '가상구장', away: '가팀', as: 8, home: '나팀', hs: 4, note: '' }, '보통 경기');
    eq([s.games[1].note, s.games[1].as, s.games[1].hs, s.games[1].lig, s.games[1].game], ['몰수승', 0, 7, '가상리그', 1718831], '몰수 · 링크로 감싼 홈 팀 · 칸 공백');
    eq([s.games[2].game, s.games[2].as, s.games[2].hs, s.games[2].time], [null, null, null, ''], '박스스코어 · 점수 · 시각 없음');
    eq(X.schedule('<html><table><tr><td>1</td></tr></table></html>'), { season: null, pages: 1, games: [] }, '경기결과가 아닌 페이지');
  });

  test('주소 → 목록 질의: 팀 주소(club_idx) · 시즌(season=) · 박스스코어 주소(game_idx)는 한 경기 쪽', function () {
    var Q = window.SLGameOneImport.gameOneSeasonQuery;
    eq([Q('https://www.gameone.kr/club/info/schedule/result?club_idx=14797'), Q('https://www.gameone.kr/club/?club_idx=14797'),
      Q('https://www.gameone.kr/club/info/schedule/result?season=2025&club_idx=14797&game_type=0&page=2')],
      ['list=1&club=14797', 'list=1&club=14797', 'list=1&club=14797&season=2025'], '팀 주소');
    eq([Q('https://www.gameone.kr/club/info/schedule/boxscore?club_idx=14797&game_idx=1722796'), Q('https://www.gameone.kr/league/?lig_idx=10875'), Q('14797'), Q(''), Q(null)],
      ['', '', '', '', ''], '박스스코어 · 리그 · 숫자만 · 빈 값');
  });

  test('팀 주소 → 시즌 목록: 이미 저장 · 몰수 · 박스스코어 없음은 꺼 둠 · 고른 수 · 그때만 부름', async function () {
    KEEP = saves().map(function (x) { return x.key; });
    localStorage.setItem(OLD, JSON.stringify({ key: OLD, th: '가팀', ta: '다팀', hs: 2, as: 1, info: { date: '2026-10-18' }, abs: [], d: '2026. 10. 18.' }));
    localStorage.setItem('sl_saves', JSON.stringify(saves().concat([{ key: OLD, label: '가팀 2:1 다팀', ts: 1 }])));
    window.fetch = fakeFetch;
    openGameOneImport();
    ok($('goSeason').hidden, '처음엔 목록 숨김');
    eq(calls.length, 0, '열기만 하면 부르지 않음');
    type('goUrl', 'https://www.gameone.kr/club/info/schedule/result?season=2026&club_idx=14797');
    $('goUrlBtn').click();
    await T.sleep(300);
    ok(/\?list=1&club=14797&season=2026&t=\d+$/.test(calls[0].u), '목록 질의 — ' + calls[0].u);
    ok(!$('goSeason').hidden && /가팀 2026시즌 · 5경기/.test($('goSeason').querySelector('.go-season-h').textContent) && /이미 저장된 1경기/.test($('goSeason').textContent), '머리 — ' + $('goSeason').querySelector('.go-season-h').textContent);
    eq(rows(), ['☑', '☐저장됨', '☐몰수', '☐-박스스코어 없음', '☑'], '줄마다 체크 · 상태');
    eq($('goSeasonGo').textContent, '고른 2경기 저장', '버튼');
    var li = document.querySelectorAll('#goSeason .go-season-list li');
    eq([li[0].querySelector('.go-season-d').textContent, li[0].querySelector('.go-season-t').firstChild.textContent.trim()], ['10.25', '가팀'], '날짜 · 원정 팀');
    var c = li[4].querySelector('input'); c.checked = false; c.dispatchEvent(new Event('change'));
    eq($('goSeasonGo').textContent, '고른 1경기 저장', '하나 끄면');
    c.checked = true; c.dispatchEvent(new Event('change'));
    eq($('goSeasonGo').textContent, '고른 2경기 저장', '다시 켜면');
    ok([].every.call(document.querySelectorAll('#goSeason .go-season-list label'), function (l) { return l.offsetHeight >= 44; }), '줄 높이 44px');
  });

  test('저장: 한 경기씩 6.5초 띄워 받음 · 받은 경기 = 새 경기(날짜 = 목록) · 404 = 기록 없음 · 다른 칸은 그대로', async function () {
    var before = saves().length, n0 = calls.length;
    $('goSeasonGo').click();
    ok($('goSeasonGo').disabled && /받는 중/.test($('goSeasonGo').textContent) && document.querySelector('#goSeason input').disabled, '받는 동안 잠금');
    await T.sleep(20000);
    var gc = gameCalls();
    eq(gc.map(function (c) { return c.u.split('?')[1].replace(/&t=\d+$/, ''); }), ['game=101&club=14797', 'game=105&club=14797'], '고른 경기만 차례로');
    ok(gc[0].t - calls[n0 - 1].t >= 6400 && gc[1].t - gc[0].t >= 6400, '부르는 사이 6.5초 — ' + (gc[0].t - calls[n0 - 1].t) + ' / ' + (gc[1].t - gc[0].t));
    eq(rows(), ['☐-저장함', '☐저장됨', '☐몰수', '☐-박스스코어 없음', '☐기록 없음'], '줄 상태');
    var s = saves(), g = JSON.parse(localStorage.getItem(s[s.length - 1].key));
    eq([s.length, g.ta, g.th, g.as, g.hs, g.info.date, g.info.venue, g.abs.length, g.d], [before + 1, '가팀', '나팀', 4, 3, '2026-10-25', '가상구장', 3, new Date(2026, 9, 25).toLocaleDateString('ko-KR')], '저장한 경기');
    ok(/^1경기를 새 경기로 저장했어요 · 건너뜀 1/.test($('goSeasonMsg').textContent), '안내 — ' + $('goSeasonMsg').textContent);
    eq([$('goScore').value, $('goAway').value, $('goSave').disabled], ['', '', true], '한 경기 칸은 그대로(비어 있음)');
    ok($('goSeasonGo').disabled, '고를 경기가 없으면 버튼 꺼짐');
  });

  test('받는 중에 창을 닫으면 멈춘다 · 다시 열면 목록은 접힘', async function () {
    type('goUrl', 'https://www.gameone.kr/club/?club_idx=14797');
    $('goUrlBtn').click();
    await T.sleep(300);
    eq(rows(), ['☐저장됨', '☐저장됨', '☐몰수', '☐-박스스코어 없음', '☑'], '방금 저장한 경기도 저장됨');
    var n = gameCalls().length;
    $('goSeasonGo').click();
    closeOverlay('goOverlay');
    await T.sleep(10000);
    eq(gameCalls().length, n, '닫은 뒤 부르지 않음');
    ok(/창을 닫아 멈췄어요/.test($('goSeasonMsg').textContent), '안내 — ' + $('goSeasonMsg').textContent);
    openGameOneImport();
    ok($('goSeason').hidden, '다시 열면 접힘');
    closeOverlay('goOverlay');
  });

  test('호출 제한(연결 오류로 보임) → 1분 쉬고 한 번 더', async function () {
    openGameOneImport();
    type('goUrl', 'https://www.gameone.kr/club/?club_idx=14797');
    $('goUrlBtn').click();
    await T.sleep(300);
    fail105 = 1;
    var n = gameCalls().length;
    $('goSeasonGo').click();
    await T.sleep(75000);
    var gc = gameCalls().slice(n);
    eq(gc.map(function (c) { return /game=105&/.test(c.u); }), [true, true], '같은 경기 두 번');
    ok(gc[1].t - gc[0].t >= 60000, '사이 1분 — ' + (gc[1].t - gc[0].t));
    eq(rows()[4], '☐기록 없음', '다시 받은 답(404)으로 표시 — 못 받음 아님');
    closeOverlay('goOverlay');
  });

  test('시즌 버튼: 올해부터 세 시즌 + 「이전」 · 누르면 그 시즌 목록 · 경기 없는 시즌은 목록을 두고 알림', async function () {
    openGameOneImport();
    type('goUrl', 'https://www.gameone.kr/club/?club_idx=14797');
    $('goUrlBtn').click();
    await T.sleep(300);
    var box = $('goSeason'), Y = Math.max(2026, new Date().getFullYear());
    var yb = function () { return [].map.call(box.querySelectorAll('button.go-season-yb'), function (b) { return b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : ''); }); };
    var btn = function (y) { return [].filter.call(box.querySelectorAll('button.go-season-yb'), function (b) { return b.textContent === String(y); })[0]; };
    var head = function () { return box.querySelector('.go-season-h').firstChild.textContent + box.querySelector('.go-season-h').childNodes[1].textContent; };
    var sel = box.querySelector('select.go-season-yb');
    eq(yb(), [Y, Y - 1, Y - 2].map(function (y) { return y + (y === 2026 ? '*' : ''); }), '버튼 — 지금 시즌 눌림');
    eq([sel.value, sel.options[1].value, sel.options[sel.options.length - 1].value], ['', String(Y - 3), '2003'], '「이전」 = 그 앞 시즌부터 2003');
    ok([].every.call(box.querySelectorAll('.go-season-yb'), function (b) { return b.offsetHeight >= 44; }), '높이 44px');
    var n = calls.length;
    btn(2025).click();
    eq([btn(2025).getAttribute('aria-pressed'), btn(2025).disabled, box.querySelector('select.go-season-yb').disabled, $('goSeasonGo').disabled, box.querySelector('.go-season-ymsg').textContent],
      ['true', true, true, true, '2025시즌 경기 목록을 가져오는 중…'], '받는 동안 — 누른 시즌 표시 · 잠금');
    await T.sleep(300);
    ok(/\?list=1&club=14797&season=2025&t=\d+$/.test(calls[n].u), '질의 — ' + calls[n].u);
    eq([head(), yb().filter(function (s) { return /\*$/.test(s); }), rows(), $('goSeasonGo').textContent, !!box.querySelector('.go-season-ymsg')],
      ['가팀 2025시즌 · 2경기', ['2025*'], ['☑', '☑'], '고른 2경기 저장', false], '2025시즌 목록 — 날짜 해가 달라 저장된 경기와 다름');
    btn(2024).click();
    await T.sleep(300);
    eq([head(), yb().filter(function (s) { return /\*$/.test(s); }), rows(), box.querySelector('.go-season-ymsg').textContent, $('goSeasonGo').disabled],
      ['가팀 2025시즌 · 2경기', ['2025*'], ['☑', '☑'], '2024시즌에는 게임원 경기 결과가 없어요', false], '경기 없는 시즌(404) — 목록 그대로');
    sel = box.querySelector('select.go-season-yb'); sel.value = '2019'; sel.dispatchEvent(new Event('change'));
    await T.sleep(300);
    eq([head(), box.querySelector('select.go-season-yb').value, box.querySelector('.go-season-ymsg').textContent], ['가팀 2025시즌 · 2경기', '', '2019시즌에는 게임원 경기 결과가 없어요'], '게임원이 다른 시즌을 돌려주면 — 없음');
    btn(2026).click();
    await T.sleep(300);
    eq([head(), rows()[1]], ['가팀 2026시즌 · 5경기', '☐저장됨'], '다시 2026');
    closeOverlay('goOverlay');
  });

  test('(정리) 테스트 경기 지우기', function () {
    window.fetch = realFetch;
    var s = saves().filter(function (x) { if (KEEP && KEEP.indexOf(x.key) < 0) { localStorage.removeItem(x.key); return false; } return true; });
    localStorage.setItem('sl_saves', JSON.stringify(s));
    ok(!localStorage.getItem(OLD), '지움');
  });
})();
