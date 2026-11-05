// 포지션별 수비 이닝 (js/features/fieldinn.js) — 선발 수비 위치 + 경기 운영 모드 교체(runEv SUB)로 선수 · 자리마다 아웃 수를 센다
//  · 저장 라인업은 경기 끝 모습 → 교체(sw)를 되돌려 선발을 찾는다 · 수비 중 교체는 그때 아웃(pre.outs)에서 나눈다 · 공격 중 교체는 다음 수비 이닝부터
//  · 지명타자(DH)와 그 대타는 수비 이닝이 없다 · 수비 위치를 하나도 안 적은 경기는 세지 않는다(null)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var P = function (id, name, pos, st) { return { id: id, name: name, num: String(id), pos: pos, bh: '', isStarter: st }; };
  var ab = function (inn, team) { return { id: Math.random(), bname: 'x', team: team, res: '땅볼 아웃', inn: inn, pitches: [] }; };
  var sub = function (k, inP, out, pre, sw, team) { return { t: 'SUB', k: k, id: inP.id, name: inP.name, num: inP.num, out: out ? { id: out.id, name: out.name, num: out.num } : null, inn: pre.inning + '회' + (pre.half === 'top' ? '초' : '말'), team: team || 'home', scored: false, pre: pre, sw: sw }; };

  // 우리(홈) 후공: 초에 수비. 상대 1~3회초 · 우리 1~3회말
  function game() {
    var A = P(1, 'A', '투수', false), B = P(2, 'B', '포수', true), G = P(7, 'G', '좌익', false), J = P(10, 'J', 'DH', false),
      K = P(11, 'K', '좌익', true), L = P(12, 'L', '투수', true), M = P(13, 'M', 'DH', true);
    var lu = [L, B, P(3, 'C', '1루', true), P(4, 'D', '2루', true), P(5, 'E', '3루', true), P(6, 'F', '유격', true), K, P(8, 'H', '중견', true), P(9, 'I', '우익', true), M, A, G, J];
    var abs = ['1회초', '1회말', '2회초', '2회말', '3회초', '3회말'].map(function (s) { return ab(s, /초/.test(s) ? 'away' : 'home'); });
    // 2회초 2아웃 대수비 K → G 자리(좌익) · 2회말(우리 공격) 투수 교체 L → A · 3회말 대타 M → J(DH)
    abs[2].runEv = [sub('DEF', K, G, { inning: 2, half: 'top', outs: 2 }, { o: 6, i: 11, os: true, is: false, pos: '' })];
    abs[3].runEv = [sub('P', L, A, { inning: 2, half: 'bottom', outs: 1 }, { o: 0, i: 10, os: true, is: false, pos: '' })];
    abs[5].runEv = [sub('PH', M, J, { inning: 3, half: 'bottom', outs: 0 }, { o: 9, i: 12, os: true, is: false, pos: '' })];
    return { abs: abs, lu: lu };
  }
  var outs = function (r) { var o = {}; Object.keys(r).sort().forEach(function (n) { o[n] = r[n].outs; }); return o; };

  test('수비 이닝: 수비 중 교체는 그 아웃에서 나누고, 공격 중 교체는 다음 수비 이닝부터 · DH는 없다', function () {
    var g = game(), r = window.slFieldInnings(g.abs, g.lu, 'home');
    eq(r.A.outs, { P: 6 }, '선발 투수 A = 1 · 2회 (2회말에 바뀜 → 3회초부터 L)');
    eq(r.L.outs, { P: 3 }, '바뀐 투수 L = 3회');
    eq(r.G.outs, { LF: 5 }, '좌익 G = 1회 + 2회 2아웃까지 = 1⅔');
    eq(r.K.outs, { LF: 4 }, '대수비 K = 2회 1아웃 + 3회 = 1⅓');
    eq(r.B.outs, { C: 9 }, '끝까지 뛴 포수 = 3이닝');
    ok(!r.J && !r.M, '지명타자와 그 대타는 수비 이닝이 없다');
    eq(Object.keys(r).length, 11, '수비한 선수 = 선발 9 + 교체 2');
  });

  test('수비 이닝: 위치를 안 적은 경기는 null · 상대 타석이 없으면 나온 마지막 이닝까지 · 원정(말에 수비) · 타순에 없는 투수', function () {
    eq(window.slFieldInnings([ab('1회초', 'away')], [P(1, 'A', '', true), P(2, 'B', '', true)], 'home'), null, '수비 위치를 하나도 안 적음');
    // 우리 = 원정 선공(초에 공격 · 말에 수비) · 상대(홈) 타석은 안 적음 → 1~3회 수비로 본다
    var lu = [P(1, 'A', '유격', true), P(2, 'B', '', true), P(3, 'C', 'DH', true)], L = P(12, 'L', '', false), M = P(13, 'M', '', false);
    var abs = [ab('1회초', 'away'), ab('2회초', 'away'), ab('3회초', 'away')];
    // 지명타자 경기의 투수 교체(out 없음 · sw 없음): 2회초(우리 공격) L → 2회말부터 · 3회말 1아웃 M
    abs[1].runEv = [sub('P', L, null, { inning: 2, half: 'top', outs: 0 }, undefined, 'away')];
    abs[2].runEv = [sub('P', M, null, { inning: 3, half: 'bottom', outs: 1 }, undefined, 'away')];
    var r = window.slFieldInnings(abs, lu, 'away');
    eq(outs(r), { A: { SS: 9 }, B: { ETC: 9 }, L: { P: 4 }, M: { P: 2 } }, '유격 3이닝 · 위치 없는 선발 = 기타 · 투수 L 1⅓ · M ⅔');
    eq(['-', '⅓', '⅔', '1', '4⅔'].join(), [0, 1, 2, 3, 14].map(window.slFieldInnings.ip).join(), '이닝 표기');
  });

  test('수비 이닝: 수비 위치 바꾸기(SUB k = POS) — 그때부터 두 선수 자리를 맞바꾸고, 선발 위치는 되돌려 찾는다', function () {
    // 경기 끝 라인업: X 포수 · Y 투수 · Z 유격 (선발은 X 투수 · Y 유격 · Z 포수)
    var X = P(1, 'X', '포수', true), Y = P(2, 'Y', '투수', true), Z = P(3, 'Z', '유격', true);
    var pos = function (a, b, pa, pb, pre) { return { t: 'SUB', k: 'POS', id: a.id, name: a.name, num: a.num, with: { id: b.id, name: b.name, num: b.num }, pa: pa, pb: pb, out: null, from: null,
      inn: pre.inning + '회' + (pre.half === 'top' ? '초' : '말'), team: 'home', scored: false, pre: pre }; };
    var abs = ['1회초', '1회말', '2회초', '2회말', '3회초'].map(function (s) { return ab(s, /초/.test(s) ? 'away' : 'home'); });
    abs[2].runEv = [pos(X, Y, '투수', '유격', { inning: 2, half: 'top', outs: 1 })];      // 2회초 1아웃 X ↔ Y
    abs[3].runEv = [pos(X, Z, '유격', '포수', { inning: 2, half: 'bottom', outs: 2 })];   // 2회말(우리 공격) X ↔ Z → 3회초부터
    eq(outs(window.slFieldInnings(abs, [X, Y, Z], 'home')),
      { X: { P: 4, SS: 2, C: 3 }, Y: { SS: 4, P: 5 }, Z: { C: 6, SS: 3 } }, 'X 투수 1⅓ · 유격 ⅔ · 포수 1 / Y 유격 1⅓ · 투수 1⅔ / Z 포수 2 · 유격 1');
    // 원정(말에 수비) 1회말 0아웃에 유격(일번) ↔ 투수(이번) — 경기 끝 라인업은 바꾼 뒤 값(일번 투수 · 이번 유격). 바꾸기 전 이닝이 없으니 0
    var A1 = P(1, '일번', '투수', true), B2 = P(2, '이번', '유격', true);
    var abs2 = ['1회초', '1회말', '2회초', '2회말', '3회초', '3회말'].map(function (s) { return ab(s, /초/.test(s) ? 'away' : 'home'); });
    var e = pos(A1, B2, '유격', '투수', { inning: 1, half: 'bottom', outs: 0 }); e.team = 'away'; e.inn = '1회말';
    abs2[1].runEv = [e];
    eq(outs(window.slFieldInnings(abs2, [A1, B2], 'away')), { 이번: { SS: 9 }, 일번: { P: 9 } }, '일번 투수 3이닝 · 이번 유격 3이닝');
  });

  test('수비 이닝: 팀 대시보드(이번 경기)에 표가 나온다', function () {
    var g = game();
    window.AS.home_lineup = g.lu; window.AS.abs = g.abs;
    window.setTeamScope('scope', 'game');
    window.openTeamView();
    var tb = document.querySelector('#teamContent .tm-fieldinn');
    ok(tb, '포지션별 수비 이닝 표');
    var head = [].map.call(tb.querySelectorAll('thead th'), function (x) { return x.textContent; });
    eq(head, ['선수', '합계', '경기', '투수', '포수', '1루', '2루', '3루', '유격', '좌익', '중견', '우익'], '열 — 합계 · 경기가 앞, 기타 없음');
    var row = [].find.call(tb.querySelectorAll('tbody tr'), function (tr) { return tr.querySelector('th b').textContent === 'G'; });
    eq([].map.call(row.querySelectorAll('td'), function (x) { return x.textContent; }), ['1⅔', '1', '-', '-', '-', '-', '-', '-', '1⅔', '-', '-'], 'G 줄');
    eq(tb.querySelector('tbody tr th b').textContent, 'B', '많이 뛴 선수부터');
  });
})();
