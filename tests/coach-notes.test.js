// 경기 후 코치 메모 (js/features/coachnotes.js) — GAME REPORT 인사이트 칸에 기록된 숫자만으로 최대 3줄
//  · 득점권(경기 운영 모드 gfPre 의 2 · 3루) · 2스트라이크(볼카운트 count.s) · 선두타자 출루(이닝마다 첫 타석) · 2아웃 타점 · 우리 투수(상대 타석: 선두타자 출루 · 볼넷 · 사구 · 2스트라이크 뒤 피안타) 순서
//  · 표본이 적거나(득점권 3 · 2스트라이크 4 · 이닝 3 미만) 그 기록을 안 적었으면 줄을 만들지 않는다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var id = 0;
  // 타석 하나: 이닝 번호 · 팀 · 결과 · 덧붙일 것(gfPre · count · rbi)
  function ab(inn, team, res, more) {
    var a = { id: ++id, bid: 'b' + id, bname: '선수' + id, bnum: String(id), team: team, res: res, rbi: 0, inn: inn + '회' + (team === 'away' ? '초' : '말'), pitches: [] };
    return Object.assign(a, more || {});
  }
  var pre = function (bases, outs) { return { gfPre: { inning: 0, half: 'x', outs: outs, bases: bases } }; };
  var vals = function (l) { return l.map(function (n) { return n.lbl + ' ' + n.val; }); };

  test('코치 메모: 득점권 · 2스트라이크 · 선두타자 — 3줄까지, 숫자는 기록 그대로', function () {
    var abs = [
      // 득점권 3타석: 2안타 · 타점 3 (경기 운영 모드 직전 주자)
      ab(1, 'home', '안타', Object.assign(pre([0, 1, 0], 0), { rbi: 1 })),
      ab(2, 'home', '2루타', Object.assign(pre([1, 0, 1], 1), { rbi: 2 })),
      ab(3, 'home', '삼진', pre([0, 0, 1], 2)),
      // 2스트라이크 4타석: 1안타 · 삼진 2
      ab(4, 'home', '삼진', { count: { b: 1, s: 2, o: 0 } }), ab(4, 'home', '삼진', { count: { b: 0, s: 2, o: 1 } }),
      ab(5, 'home', '안타', { count: { b: 2, s: 2, o: 0 } }), ab(5, 'home', '땅볼 아웃', { count: { b: 3, s: 2, o: 1 } }),
      ab(6, 'home', '볼넷'), ab(6, 'home', '플라이 아웃'),
    ];
    // gfPre 의 이닝 키가 모두 같으면(0-x) 선두타자는 그 이닝 하나 — 이닝 칸으로 세게 지운다
    abs.slice(0, 3).forEach(function (a, i) { a.gfPre.inning = i + 1; });
    var n = window.slCoachNotes(abs);
    eq(vals(n), ['📋 득점권 3타석 2안타 · 타점 3', '📋 2스트라이크 뒤 4타석 1안타 · 삼진 2', '📋 선두타자 출루 4 / 6이닝'], '세 줄');
    ok(n.every(function (x) { return x.cls === 'coach'; }), '칸 모양은 coach');
  });

  test('코치 메모: 표본이 적거나 기록을 안 적었으면 줄이 없다 · 2아웃 타점 · 우리 투수 줄', function () {
    // 득점권 2타석뿐 · 볼카운트 안 적음 · 이닝 칸이 하나(바꾸지 않고 적음) → 아무 줄도 없다
    var few = [ab(1, 'home', '안타', pre([0, 1, 0], 0)), ab(1, 'home', '홈런', pre([0, 0, 1], 1)), ab(1, 'home', '삼진'), ab(1, 'home', '볼넷')];
    eq(window.slCoachNotes(few), [], '조건 미달이면 빈 목록');
    eq(window.slCoachNotes(null), [], '타석이 없어도 오류 없음');
    var noRbi = [ab(1, 'home', '안타', pre([0, 1, 0], 0)), ab(2, 'home', '안타', pre([0, 0, 1], 1)), ab(3, 'home', '삼진', pre([1, 1, 0], 2))];
    noRbi.forEach(function (a, i) { a.gfPre.inning = i + 1; });
    eq(vals(window.slCoachNotes(noRbi))[0], '📋 득점권 3타석 2안타', '타점을 하나도 안 적은 경기는 타점을 쓰지 않는다');
    // 2아웃 타점(gfPre 없으면 count.o) · 상대 선두타자 출루 · 볼넷 · 사구 허용
    var abs = [
      ab(1, 'home', '안타', { rbi: 2, count: { b: 0, s: 0, o: 2 } }), ab(2, 'home', '삼진', { count: { b: 0, s: 0, o: 0 } }),
      ab(1, 'away', '볼넷'), ab(1, 'away', '삼진'), ab(2, 'away', '사구'), ab(3, 'away', '땅볼 아웃'), ab(3, 'away', '볼넷'),
    ];
    eq(vals(window.slCoachNotes(abs)), ['📋 2아웃 뒤 타점 2 (전체 2)', '📋 투수 · 상대 선두타자 출루 2 / 3이닝', '📋 투수 · 볼넷 · 사구 허용 3개'], '2아웃 · 투수 줄');
    // 상대 팀만 적은 경기 = 전부 우리 팀으로 (경기 리포트 _pgAbs 와 같은 기준) → 투수 줄은 없다
    var only = abs.filter(function (a) { return a.team === 'away'; });
    eq(vals(window.slCoachNotes(only)), ['📋 선두타자 출루 2 / 3이닝'], '상대만 적은 경기');
    // 우리 투수 · 2스트라이크 뒤 피안타 (상대 타석 count.s ≥ 2, 4타석부터) — 한 이닝이라 선두타자 줄은 없다
    var s2 = function (res) { return ab(1, 'away', res, { count: { b: 1, s: 2, o: 0 } }); };
    var p2 = [ab(1, 'home', '삼진'), s2('안타'), s2('삼진'), s2('삼진'), s2('땅볼 아웃'), ab(1, 'away', '안타', { count: { b: 0, s: 1, o: 0 } })];
    eq(vals(window.slCoachNotes(p2)), ['📋 투수 · 2스트라이크 뒤 4타석 피안타 1 · 삼진 2'], '2스트라이크 전에 맞은 안타는 세지 않는다');
    eq(window.slCoachNotes(p2.slice(0, 4)), [], '3타석이면 줄이 없다');
  });

  // scorebook.js 가 _pgBuild · showToast 를 감싸 화면 글자의 이모지(⚠ · 📋 …)를 지운다. 감싸는 때가 setTimeout 0 이라 테스트 시작과 겨뤄
  //   어떤 때는 지워지고 어떤 때는 안 지워진다 → 같은 규칙(scorebook.js _noEmoji)으로 빼고 비교
  var noEmo = function (t) { return String(t).replace(/\p{Extended_Pictographic}\uFE0F?\s?|\uFE0F/gu, '').replace(/^\s+/, ''); };
  test('코치 메모: 경기 리포트(GAME REPORT) 인사이트 칸에 나온다', function () {
    var keep = { abs: AS.abs, hs: AS.hs, as: AS.as };
    try {
      AS.abs = [
        ab(1, 'home', '안타', Object.assign(pre([0, 1, 0], 0), { rbi: 1 })), ab(2, 'home', '삼진', pre([0, 0, 1], 1)),
        ab(3, 'home', '플라이 아웃', pre([1, 1, 0], 2)), ab(3, 'home', '홈런', { rbi: 1 }),
      ];
      AS.abs.forEach(function (a, i) { if (a.gfPre) a.gfPre.inning = i + 1; });
      AS.hs = 2; AS.as = 1;
      _pgBuild();
      var rows = $('pgInsights').querySelectorAll('.pg-ins.coach');
      eq(Array.prototype.map.call(rows, function (r) { return noEmo(r.textContent); }), ['득점권3타석 1안타 · 타점 1', '선두타자 출루2 / 4이닝'], '조건이 맞는 줄만 (득점권 3타석 · 이닝 4개)');
      ok(/오늘의 선수/.test($('pgInsights').textContent), '원래 줄(오늘의 선수)은 그대로');
    } finally { AS.abs = keep.abs; AS.hs = keep.hs; AS.as = keep.as; }
  });
})();
