// 경기 기사 (js/features/recap.js) — 기록된 숫자만으로 쓰는 학부모 · 단톡방용 기사
//  · 제목 = 승리 · 패배 · 무승부 + 점수, 부제 = 수훈 타자(2안타 · 홈런 · 2타점 이상, 루타 + 타점 순)
//  · 흐름 문단은 이닝별 득점 합이 최종 점수와 같을 때만 · 결승점 = 이긴 팀이 마지막으로 앞서기 시작한 반 이닝
//  · 경기 운영 모드 득점 기록(scored · runEv) 합 = 점수면 역전승 · 결승타(희생플라이 · 적시타 …) · 폭투 결승점, 상대 0점이면 영봉승
//  · 마운드 = 상대 타자(bteam 'away')에게 던진 투수만 (우리 타자에게 던진 상대 투수는 빼기)
//  · GAME REPORT 공유 줄 「📰 경기 기사」 → 카드 아래 기사 · 복사 / 리포트를 다시 열면 지난 기사는 지움
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var R = function () { return window.SLRecap; };
  var id = 1e12;
  var pa = function (name, res, o) { return Object.assign({ id: ++id, bid: 'b-' + name, bname: name, team: 'home', res: res, rbi: 0, inn: '1회말' }, o || {}); };
  var P = function (name, n, bteam) { var a = []; for (var i = 0; i < n; i++) a.push({ id: ++id, bteam: bteam, result: '볼' }); return { id: name, name: name, num: '', pitches: a }; };
  function game() {
    return {
      th: '불꽃', ta: '번개', hs: 5, as: 3, info: { date: '2026-11-01', venue: '목동', side: 'home' },
      abs: [
        pa('김타자', '홈런', { rbi: 2 }), pa('김타자', '2루타', { rbi: 1 }), pa('김타자', '삼진'),
        pa('이타자', '안타'), pa('이타자', '안타', { rbi: 1 }), pa('이타자', '땅볼 아웃'),
        pa('박타자', '볼넷'), pa('박타자', '플라이 아웃'),
        pa('상대1', '안타', { team: 'away' }), pa('상대2', '삼진', { team: 'away' }), pa('상대3', '삼진', { team: 'away' })
      ],
      pitchers: [P('최선발', 70, 'away'), P('상대투수', 90, 'home'), P('정계투', 21, 'away')],
      ls: { away: [0, 2, 0, 1, 0], home: [0, 0, 2, 0, 3] }
    };
  }

  test('경기 기사: 제목 · 리드 · 흐름 · 수훈 타자 · 마운드 (기록된 숫자만)', function () {
    ok(R(), 'window.SLRecap 없음');
    var r = R().buildRecap(game());
    eq(r.title, '불꽃, 번개에 5-3 승리', '제목');
    eq(r.sub, '김타자 3타수 2안타 3타점 · 홈런 1개', '부제 = 루타 + 타점이 가장 많은 타자');
    eq(r.paras[0], '11월 1일 목동에서 열린 경기에서 불꽃이 번개를 5-3으로 이겼다. 불꽃 타선은 안타 4개(홈런 · 2루타)와 볼넷·사구 1개를 묶었다.', '리드 (3 → 으로)');
    // 초: 번개 0 2 0 1 0 · 말: 불꽃 0 0 2 0 3 → 4회초 1-3, 5회말 5-3 역전 → 결승점 5회말
    eq(r.paras[1], '불꽃은 3회 2점, 5회 3점을 뽑았다. 결승점은 5회말에 나왔다.', '흐름 · 결승점');
    eq(r.paras[2], '공격에서는 김타자가 홈런과 2루타를 포함해 3타수 2안타 3타점을 기록했다. 이타자가 3타수 2안타 1타점을 기록했다.', '수훈 타자');
    eq(r.paras[3], '마운드에서는 최선발 70구, 정계투 21구로 2명이 이어 던졌다. 번개 타선은 안타 1개, 삼진 2개를 기록했다.', '마운드 = 우리 투수만');
    ok(!/상대투수/.test(JSON.stringify(r)), '우리 타자에게 던진 상대 투수는 기사에 없음');
    eq(r.note, 'SprayLab 기록 기준 — 우리 팀 8타석 · 상대 3타석. 기록하지 않은 플레이는 기사에 들어가지 않아요.', '출처');
    var txt = R().recapText(r);
    ok(txt.indexOf('■ 불꽃, 번개에 5-3 승리\n— 김타자') === 0 && /SprayLab · YOUR SWING, VISUALIZED$/.test(txt), '복사 글: 제목으로 시작 · 서명으로 끝');
  });

  test('경기 기사: 패배 · 무승부 · 이닝별 득점이 점수와 다르면 흐름 문단을 뺀다', function () {
    var g = game(); g.hs = 1; g.as = 0; g.ls = { away: [0, 0], home: [1, 0] };
    var r = R().buildRecap(g);
    ok(/1-0으로 이겼다/.test(r.paras[0]), '0 → 으로 — ' + r.paras[0]);
    eq(r.paras[1], '불꽃은 1회 1점을 뽑았다. 결승점은 1회말에 나왔다.', '한 이닝');
    g = game(); g.hs = 2; g.as = 6; g.ls = null; g.info = {};
    r = R().buildRecap(g);
    eq(r.title, '불꽃, 번개에 2-6 패배', '패배 제목');
    ok(r.paras[0].indexOf('불꽃은 번개에 2-6으로 졌다.') === 0, '날짜 · 장소가 없으면 바로 결과 — ' + r.paras[0]);
    ok(!r.paras.some(function (p) { return /결승점|점을 뽑았다/.test(p); }), '이닝별 득점이 없으면 흐름 없음');
    g = game(); g.hs = 3; g.as = 3; g.ls = { away: [1, 1], home: [0, 1] };   // 합이 3-3 이 아님
    r = R().buildRecap(g);
    eq(r.title, '불꽃·번개, 3-3 무승부', '무승부 제목');
    ok(/불꽃과 번개는 3-3으로 비겼다/.test(r.paras[0]), '무승부 리드');
    ok(!r.paras.some(function (p) { return /점을 뽑았다/.test(p); }), '합이 점수와 다르면 흐름 문단을 뺀다');
    eq(R().buildRecap({ abs: [] }), null, '타석이 없으면 기사 없음');
  });

  // 경기 운영 모드로 적은 경기 (scored · runEv · gfPre) — 1회초 0-3 → 2회 1점 · 4회 2점(3-3) · 5회 희생플라이로 앞섬(결승) · 6회 솔로 홈런, 5-3
  var S = function (pid, name) { return { id: pid, name: name }; };
  var gp = function (pid, name, num, team, inn, res, rbi, more) { return Object.assign({ id: ++id, bid: pid, bname: name, bnum: num, team: team, inn: inn, res: res, rbi: rbi, gfPre: {}, scored: [] }, more || {}); };
  function gfGame() {
    return {
      th: '서울 리틀', ta: '부산 유소년', hs: 5, as: 3, info: { date: '2026-11-05', venue: '목동 보조구장', side: 'home' },
      hl: [{ id: 1, name: '김민준', num: '7' }, { id: 2, name: '이서준', num: '' }, { id: 3, name: '박도윤', num: '12' }, { id: 4, name: '최하준', num: '3' }],
      abs: [
        gp(9, '상대', '7', 'away', '1회초', '홈런', 3, { scored: [S(8, 'a'), S(7, 'b'), S(9, '상대')] }),
        gp(1, '김민준', '7', 'home', '1회말', '안타', 0),
        gp(2, '이서준', '', 'home', '2회말', '2루타', 1, { scored: [S(1, '김민준')] }),
        gp(3, '박도윤', '12', 'home', '4회말', '안타', 2, { scored: [S(2, '이서준'), S(1, '김민준')] }),
        gp(4, '최하준', '3', 'home', '5회말', '희비', 1, { scored: [S(3, '박도윤')] }),
        gp(1, '김민준', '7', 'home', '5회말', '2루타', 0),
        gp(4, '최하준', '3', 'home', '6회말', '홈런', 1, { scored: [S(4, '최하준')] }),
      ],
      pitchers: [], ls: { away: [3, 0, 0, 0, 0, 0], home: [0, 1, 0, 2, 1, 1] },
    };
  }

  test('경기 기사: 경기 운영 모드 득점 기록 — 역전승 · 결승타 · 폭투 결승점 · 영봉승, 점수가 안 맞으면 쓰지 않는다', function () {
    var r = R().buildRecap(gfGame());
    eq(r.title, '서울 리틀, 부산 유소년에 5-3 역전승', '제목');
    eq(r.paras[0], '11월 5일 목동 보조구장에서 열린 경기에서 서울 리틀이 부산 유소년에 최대 3점 차로 끌려가다 5-3으로 역전승했다. 서울 리틀 타선은 안타 5개(홈런 · 2루타 2개)를 쳤다.', '리드');
    eq(r.paras[1], '서울 리틀은 2회 1점, 4회 2점, 5회 1점, 6회 1점을 뽑았다. 결승타는 5회 최하준의 희생플라이였다.', '흐름 — 결승점 반 이닝 대신 결승타');
    var g = gfGame(); g.anon = true;
    ok(R().buildRecap(g).paras[1].indexOf('결승타는 5회 #3 선수의 희생플라이였다.') > 0, '이름 가리기: ' + R().buildRecap(g).paras[1]);
    // 결승점이 폭투로 들어오면 결승타 대신 결승점 문장 (포일 = ㄹ 받침 → 로)
    g = gfGame(); g.abs[4] = gp(4, '최하준', '3', 'home', '5회말', '삼진', 0, { runEv: [{ t: 'WP', id: 3, name: '박도윤', team: 'home', inn: '5회말', scored: true }] });
    eq(R().buildRecap(g).paras[1].split('. ')[1], '결승점은 5회 상대 폭투로 들어왔다.', '폭투 결승점');
    g.abs[4].runEv[0].t = 'PB';
    ok(/결승점은 5회 상대 포일로 들어왔다\./.test(R().buildRecap(g).paras[1]), '포일로');
    // 이닝별 점수표가 없어도 결승타 문장은 쓴다
    g = gfGame(); g.ls = null;
    eq(R().buildRecap(g).paras[1], '결승타는 5회 최하준의 희생플라이였다.', '점수표 없이 결승타');
    // 영봉승: 상대 0점 (상대 홈런을 빼고 5-0) — 결승타 = 첫 득점(2회 적시 2루타)
    g = gfGame(); g.abs.shift(); g.as = 0; g.ls = null;
    r = R().buildRecap(g);
    eq(r.title, '서울 리틀, 부산 유소년에 5-0 영봉승', '영봉승 제목');
    ok(/서울 리틀이 부산 유소년을 5-0으로 이겼다/.test(r.paras[0]) && r.paras[1] === '결승타는 2회 이서준의 적시 2루타였다.', '영봉승 리드 · 결승타: ' + r.paras[1]);
    // 점수판을 손으로 바꿔 득점 기록 합과 다르면 역전 · 결승타를 쓰지 않는다
    g = gfGame(); g.hs = 6;
    r = R().buildRecap(g);
    eq(r.title, '서울 리틀, 부산 유소년에 6-3 승리', '합이 다르면 그냥 승리');
    ok(!/역전|결승타|결승점/.test(JSON.stringify(r)), '역전 · 결승 문장 없음');
    // 운영 모드 기록이 없는 경기(기존 경기)는 그대로
    eq(R().buildRecap(game()).title, '불꽃, 번개에 5-3 승리', '득점 기록이 없으면 승리');
  });

  test('경기 기사: 수훈 타자가 없으면 안타 친 선수만 · 투구 기록이 없으면 마운드 문단 없음', function () {
    var r = R().buildRecap({ th: '불꽃', ta: '번개', hs: 1, as: 4, abs: [pa('가', '안타'), pa('나', '삼진'), pa('다', '안타', { rbi: 1 })], pitchers: [] });
    eq(r.sub, '팀 안타 2개', '부제');
    eq(r.paras[1], '안타는 가와 다가 쳤다.', '안타 친 선수');
    eq(r.paras.length, 2, '마운드 문단 없음');
  });

  test('경기 기사: 이름 가리기(anon) = 공유 링크 규칙 — 등번호 있으면 #번호, 없으면 성OO, 투수도', function () {
    var g = game(); g.anon = true;
    g.abs.forEach(function (a) { if (a.bname === '김타자') a.bnum = '7'; });
    g.hl = [{ id: 'b-김타자', name: '김타자', num: '7' }];
    var r = R().buildRecap(g);
    eq(r.sub, '#7 선수 3타수 2안타 3타점 · 홈런 1개', '부제');
    eq(r.paras[2], '공격에서는 #7 선수가 홈런과 2루타를 포함해 3타수 2안타 3타점을 기록했다. 이OO 선수가 3타수 2안타 1타점을 기록했다.', '수훈 타자');
    eq(r.paras[3], '마운드에서는 최OO 선수 70구, 정OO 선수 21구로 2명이 이어 던졌다. 번개 타선은 안타 1개, 삼진 2개를 기록했다.', '투수');
    ok(!/김타자|이타자|박타자|최선발|정계투/.test(JSON.stringify(r) + R().recapText(r)), '실명이 기사 · 복사 글 어디에도 없음');
    eq(R().buildRecap(game()).sub.indexOf('김타자'), 0, 'anon 이 없으면 실명 (순수 함수 기본)');
    var a = [pa('김가', '안타'), pa('김나', '안타')];
    eq(R().buildRecap({ th: '불꽃', ta: '번개', hs: 1, as: 0, abs: a, anon: true }).paras[1], '안타는 김OO 선수와 김OO 홈 선수가 쳤다.', '같은 성이 겹치면 공유 링크처럼 구분 (_anonSharePayload: 홈 팀 → " 홈")');
  });

  test('경기 기사: GAME REPORT 「📰 경기 기사」 → 카드 아래 기사 · 실명 체크 · 다시 열면 지움 · ☰ 메뉴', async function () {
    var keep = { abs: AS.abs, hs: AS.hs, as: AS.as, p: AS.pitchers, th: $('tHome').value, ta: $('tAway').value, hl: AS.home_lineup, al: AS.away_lineup };
    try {
      var g = game();
      AS.abs = g.abs; AS.hs = 5; AS.as = 3; AS.pitchers = g.pitchers; $('tHome').value = '불꽃'; $('tAway').value = '번개';
      AS.home_lineup = []; AS.away_lineup = [];
      showPostGameReport();
      var btn = $('pgRecapBtn');
      ok(btn && btn.closest('.pg-share-row'), '공유 줄에 경기 기사 버튼');
      btn.click();
      var box = $('pgRecap');
      ok(box && box.closest('#pgCard'), '카드 안에 기사');
      eq(box.querySelector('.pg-rc-t').textContent, '불꽃, 번개에 5-3 승리', '화면 제목');
      var nm = $('pgRecapNames');
      ok(nm && !nm.checked, '「선수 실명 포함」 기본 꺼짐');
      ok(/김OO 선수가 홈런과 2루타를 포함해/.test(box.textContent) && !/김타자/.test(box.textContent), '기본은 이름 가리기 — ' + box.textContent.slice(0, 200));
      ok(nm.closest('label').getBoundingClientRect().height >= 44, '실명 체크 줄 44px 이상');
      nm.click();
      ok($('pgRecapNames').checked && /김타자가 홈런과 2루타를 포함해/.test($('pgRecap').textContent), '체크하면 실명');
      var copy = $('pgRecapCopy');
      ok(copy && copy.getBoundingClientRect().height >= 44, '복사 버튼 44px 이상 — ' + (copy && copy.getBoundingClientRect().height));
      ok(btn.getBoundingClientRect().height >= 44, '경기 기사 버튼 44px 이상');
      $('pgRecapBtn').click();
      ok(!$('pgRecapNames').checked && !/김타자/.test($('pgRecap').textContent), '다시 열면 실명 체크는 꺼진 채로');
      closePgReport();
      showPostGameReport();
      eq($('pgRecap'), null, '리포트를 다시 열면 지난 기사는 지움');
      closePgReport();
      var mi = document.querySelector('.slm-item[onclick^="openRecap"]');
      ok(mi && /경기 기사/.test(mi.textContent), '☰ 메뉴에 경기 기사');
      mi.click();
      ok($('pgCard').classList.contains('up') && $('pgRecap') && /김OO 선수/.test($('pgRecap').textContent), '☰ 메뉴 → 리포트를 띄우고 기사');
      AS.abs = [];
      $('pgRecapBtn').click();
      ok(/타석을 기록하면/.test($('pgRecap').textContent), '타석이 없으면 안내');
    } finally {
      AS.abs = keep.abs; AS.hs = keep.hs; AS.as = keep.as; AS.pitchers = keep.p; $('tHome').value = keep.th; $('tAway').value = keep.ta;
      AS.home_lineup = keep.hl; AS.away_lineup = keep.al;
      var b = $('pgRecap'); if (b) b.remove();
      $('pgReport').style.display = 'none'; $('pgCard').classList.remove('up');
    }
  });
})();
