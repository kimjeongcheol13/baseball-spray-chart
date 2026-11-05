// 타순 추천 (js/features/lineupsuggest.js) — 우리 팀(홈) 주전을 지난 기록으로 현대식(The Book) 순서로
//  · wOBA 상위 3명 중 출루율 최고 = 1번, 나머지 둘 중 장타력(ISO) 높은 쪽 = 4번 · 다른 쪽 = 2번, 4위 = 3번, 5위부터 5번~
//  · 10타석 미만 주전은 뒤로(지금 순서) · 후보는 맨 뒤 · 상대 팀(away) 타석은 세지 않는다
//  · 「적용」을 눌러야 바뀌고(같은 배열 제자리) · 「되돌리기」로 원래 순서
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var id = 0;
  // 이름 · 결과 목록 → 우리 팀 타석들
  function pas(p, list, team) { return list.map(function (res) { return { id: ++id, bid: p.id, bname: p.name, bnum: p.num, team: team || 'home', res: res, pitches: [] }; }); }
  function rep(res, n) { var a = []; for (var i = 0; i < n; i++) a.push(res); return a; }
  function P(k, starter) { return { id: 'ls' + k, name: '추천' + k, num: String(k.charCodeAt(0) - 60), pos: '', bh: '', isStarter: starter !== false }; }
  var A = P('A'), B = P('B'), C = P('C'), D = P('D'), E = P('E'), F = P('F'), G = P('G'), H = P('H'), I = P('I', false);
  function abs() {
    return [].concat(
      pas(A, rep('안타', 4).concat(rep('볼넷', 4), rep('삼진', 4))),            // 출루 .667 · 장타력 0 · wOBA .527
      pas(B, rep('홈런', 2).concat(rep('2루타', 2), rep('삼진', 8))),           // 출루 .333 · ISO .667 · wOBA .562
      pas(C, rep('2루타', 3).concat(['안타'], rep('볼넷', 2), rep('삼진', 6))), // 출루 .500 · ISO .300 · wOBA .507
      pas(D, rep('안타', 3).concat(['볼넷'], rep('삼진', 8))),
      pas(E, rep('안타', 2).concat(rep('삼진', 10))),
      pas(F, ['안타'].concat(rep('삼진', 11))),
      pas(G, rep('삼진', 12)),
      pas(H, rep('홈런', 3)),                                                    // 3타석 → 기록 부족
      pas(I, rep('홈런', 12))                                                    // 후보는 그대로 뒤
    );
  }
  var names = function (l) { return l.map(function (p) { return p.name.slice(2); }).join(''); };

  test('타순 추천: 상위 3명 → 1 · 2 · 4번, 4위 → 3번, 나머지 wOBA 순 · 기록 부족 · 후보는 뒤', function () {
    var LS = window.LineupSuggest;
    ok(LS && LS.suggest, 'window.LineupSuggest 없음');
    var r = LS.suggest([G, F, E, D, C, B, A, I, H], abs());
    eq(names(r.rows.map(function (x) { return x.p; })), 'ACDBEFGH', '현대식 순서');
    eq(r.rows[0].why, '상위 3명 중 출루율 최고', '1번 이유');
    eq(r.rows[3].why, '상위 3명 중 장타력 최고', '4번 이유');
    eq(r.rows[7].why, '기록 부족 (3타석) · 지금 순서', '10타석 미만');
    eq(names(r.bench), 'I', '후보');
    r = LS.suggest([C, A, B], abs());
    eq(names(r.rows.map(function (x) { return x.p; })), 'ACB', '3명뿐이면 1 · 2 · 3번');
  });

  test('타순 추천: 라인업 창 버튼 → 적용하면 홈 라인업 순서만 바뀌고 · 되돌리기로 원래대로 · 상대 타석은 빼고 센다', function () {
    var keep = { h: AS.home_lineup, a: AS.abs, t: AS.curTeam };
    try {
      var L = [G, F, E, D, C, B, A, I, H].map(function (p) { return Object.assign({}, p); });
      AS.home_lineup = L; AS.curTeam = 'home';
      // 상대 팀에 같은 이름(추천A)이 삼진만 12번 — 우리 팀 기록만 세면 A는 그대로 1번
      AS.abs = abs().concat(pas({ id: 'x', name: '추천A', num: '' }, rep('삼진', 12), 'away'));
      renderLP();
      var btn = document.querySelector('.ls-btn');
      ok(btn, '라인업 창에 「타순 추천」 버튼');
      btn.click();
      var ov = document.getElementById('lsSheet');
      ok(ov, '추천 창');
      eq(ov.querySelectorAll('.ls-list li').length, 8, '주전 8명');
      eq(ov.querySelector('.ls-list li b').textContent, '#5 추천A', '1번 = 추천A');
      eq(names(AS.home_lineup), 'GFEDCBAIH', '누르기 전에는 그대로');
      ov.querySelector('[data-act=apply]').click();
      ok(AS.home_lineup === L, '같은 배열 제자리');
      eq(names(AS.home_lineup), 'ACDBEFGHI', '적용 → 추천 순서 + 후보 뒤');
      eq(document.querySelector('#lpList .player-row .p-name').textContent.indexOf('추천A'), 0, '라인업 목록도 다시 그림');
      ov.querySelector('[data-act=undo]').click();
      eq(names(AS.home_lineup), 'GFEDCBAIH', '되돌리기 → 원래 순서');
      ov.querySelector('[data-act=close]').click();
      eq(document.getElementById('lsSheet'), null, '닫기');
      var r = btn.getBoundingClientRect();
      ok(r.height >= 44 || btn.offsetParent === null, '버튼 높이 44px 이상 — ' + r.height);
      // 기록이 모자라면 「현대식으로 놓았어요」라고 하지 않는다 (흐름 점검 ⑥)
      var sub = function () { var t = document.querySelector('#lsSheet .pes-sub').textContent; document.getElementById('lsSheet').remove(); return t; };
      AS.abs = pas(A, rep('안타', 12)).concat(pas(B, rep('삼진', 12)));
      btn.click();
      ok(/주전 2명을 wOBA 순으로/.test(sub()), '2명 = wOBA 순');
      AS.abs = pas(A, rep('안타', 12));
      btn.click();
      eq(sub(), '우리 팀 지난 기록(저장 경기 + 지금 경기)으로 순서를 정해요. 지금은 기록 10타석 이상인 주전이 1명뿐이라 지금 순서 그대로예요.', '1명');
      AS.abs = [];
      btn.click();
      ok(/주전이 아직 없어서 지금 순서 그대로/.test(sub()), '0명');
    } finally {
      var s = document.getElementById('lsSheet'); if (s) s.remove();
      AS.home_lineup = keep.h; AS.abs = keep.a; AS.curTeam = keep.t; renderLP();
    }
  });
})();
