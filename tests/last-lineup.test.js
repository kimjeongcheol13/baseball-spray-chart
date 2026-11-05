// 새 경기 「👥 이전 라인업」(core.js applyLastLineup) — 지난 경기의 끝난 모습이 아니라 선발 라인업을 불러온다 (흐름 점검 ⑤)
//  · 경기 운영 모드 교체(runEv SUB · sw)와 수비 위치 바꾸기(k POS)를 뒤에서부터 되돌린다 (runners.js undoSub 와 같은 규칙)
//  · 상대 팀 교체는 우리 팀 라인업에 손대지 않는다
(function () {
  var T = window.__T, eq = T.eq, test = T.test;

  test('이전 라인업: 교체 · 수비 위치 바꾸기를 되돌려 선발 라인업으로', function () {
    var P = function (id, name, pos, st) { return { id: id, name: name, num: '', pos: pos, bh: '', isStarter: st }; };
    // 끝난 모습: A ↔ B 위치를 바꾼 뒤(투수 ↔ 유격) 포수 C 를 후보 D 로 대수비 → [A 유격, B 투수, D 포수, C 후보]
    var end = [P(1, '선발A', '유격', true), P(2, '선발B', '투수', true), P(4, '후보D', '포수', true), P(3, '선발C', '포수', false)];
    var away = [P(9, '상대X', '포수', true), P(8, '상대Y', '', false)];
    var ref = function (p) { return { id: p.id, name: p.name, num: '' }; };
    var abs = [
      { id: 1, team: 'away', res: '삼진', pitches: [], runEv: [{ t: 'SUB', k: 'POS', id: 1, name: '선발A', num: '', with: { id: 2, name: '선발B', num: '' }, pa: '투수', pb: '유격', team: 'home' }] },
      { id: 2, team: 'home', res: '안타', pitches: [], runEv: [
        { t: 'SUB', k: 'DEF', id: 4, name: '후보D', num: '', out: ref(end[3]), team: 'home', sw: { o: 2, i: 3, os: true, is: false, pos: '' } },
        { t: 'SUB', k: 'DEF', id: 99, name: '모르는선수', num: '', out: ref(away[0]), team: 'away', sw: { o: 0, i: 1, os: true, is: false, pos: '' } },
      ] },
    ];
    var key = 'sl_test_last_lineup', keepSaves = localStorage.getItem('sl_saves');
    try {
      localStorage.setItem(key, JSON.stringify({ key: key, home_lineup: end, away_lineup: away, abs: abs }));
      localStorage.setItem('sl_saves', JSON.stringify(JSON.parse(keepSaves || '[]').concat([{ key: key }])));
      applyLastLineup();
      var show = function (l) { return l.map(function (p) { return p.name + ':' + p.pos + ':' + (p.isStarter ? '주전' : '후보'); }).join(' '); };
      eq(show(AS._pendingHomeLineup), '선발A:투수:주전 선발B:유격:주전 선발C:포수:주전 후보D::후보', '선발 라인업 · 원래 위치 · 후보는 후보로');
      eq(show(AS._pendingAwayLineup), '상대X:포수:주전 상대Y::후보', '없는 선수가 들어온 상대 교체는 건너뛴다');
    } finally {
      delete AS._pendingHomeLineup; delete AS._pendingAwayLineup;
      localStorage.removeItem(key);
      if (keepSaves == null) localStorage.removeItem('sl_saves'); else localStorage.setItem('sl_saves', keepSaves);
    }
  });
})();
