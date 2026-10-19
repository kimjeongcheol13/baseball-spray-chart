// 게임원 투수 시즌 기록(js/features/gopitchseason.js) — 게임원 가져오기가 저장한 투수 표(pitchLines)를 저장 경기 전체에서 팀별 · 투수별로 모아
// 분석 탭 › 투수 화면 아래 카드로 보여 준다. 평균자책 = 자책 × 7 ÷ 이닝(게임원과 같은 7이닝 기준) · WHIP · 삼진% · 볼넷% · 피안타율
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  function L(name, num, result, outs, tbf, ab, h, bb, k, r, er) {
    return { name: name, number: num, result: result, outs: outs, tbf: tbf, ab: ab, h: h, hr: 0, sh: 0, sf: 0, bb: bb, hbp: 0, k: k, wp: 0, bk: 0, r: r, er: er, np: 0 };
  }
  function game(key, ta, th, away, home) {
    return { key: key, ta: ta, th: th, hs: 0, as: 0, abs: [], home_lineup: [], away_lineup: [], zoneHistory: {}, d: '2026. 10. 1.', ts: 1790000000000, pitchLines: { away: away, home: home } };
  }
  // 가팀: 1경기는 원정 · 2경기는 홈. 가투수는 2경기에서 내려갔다 다시 등판(같은 경기 두 줄) — 경기 수는 1
  var G1 = game('sl_1790000900001', '가팀', '나팀',
    [L('가투수', '9', '승', 9, 12, 11, 3, 1, 4, 2, 1), L('가계투', '5', '세', 3, 4, 4, 1, 0, 1, 0, 0)],
    [L('나투수', '8', '패', 12, 20, 18, 6, 2, 2, 5, 4)]);
  var G2 = game('sl_1790000900002', '다팀', '가팀',
    [L('다투수', '1', '-', 12, 18, 16, 4, 2, 3, 3, 3)],
    [L('가투수', '9', '-', 6, 10, 9, 2, 1, 2, 2, 2), L('가계투', '5', '-', 2, 3, 3, 1, 0, 0, 0, 0), L('가투수', '9', '승', 4, 5, 5, 1, 0, 1, 0, 0)]);
  var KEYS = [G1.key, G2.key];

  function put(list) {
    var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
    list.forEach(function (d) { localStorage.setItem(d.key, JSON.stringify(d)); saves.push({ key: d.key, label: d.ta + ' vs ' + d.th, ts: d.ts }); });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
  }
  function rows() {
    return Array.prototype.map.call(document.querySelectorAll('#goPitchSeason tbody tr'), function (tr) {
      return Array.prototype.map.call(tr.children, function (c) { return c.textContent.trim(); }).join(' | ');
    });
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.SLGoPitch && typeof window.openPitcherView === 'function', '모듈 로드');
  });

  test('합계: 팀별 · 투수별 · 경기 수(다시 등판해도 1) · 승-패-세 · 팀 순서 = 경기 수 많은 순 · 투수 순서 = 이닝 많은 순', function () {
    var t = window.SLGoPitch.collectGoPitching([{ data: G1 }, { data: G2 }]);
    eq(t.map(function (x) { return x.name + ':' + x.games; }), ['가팀:2', '나팀:1', '다팀:1'], '팀');
    eq(t[0].pitchers.map(function (p) { return [p.name, p.number, p.g, p.w + '-' + p.l + '-' + p.sv, p.outs, p.tbf, p.ab, p.h, p.bb, p.k, p.er].join(' '); }),
      ['가투수 9 2 2-0-0 19 27 25 6 2 7 3', '가계투 5 2 0-0-1 5 7 7 2 0 1 0'], '가팀 투수');
    var R = window.SLGoPitch.goPitchRates(t[0].pitchers[0]);
    eq([R.era.toFixed(2), R.whip.toFixed(2), Math.round(R.kPct * 100), Math.round(R.bbPct * 100), R.avg.toFixed(3)], ['3.32', '1.26', 26, 7, '0.240'],
      '평균자책 3×7÷(19/3) · WHIP (6+2)÷(19/3) · 삼진 7/27 · 볼넷 2/27 · 피안타율 6/25');
    eq(window.SLGoPitch.goPitchRates({ outs: 0, tbf: 0, ab: 0, h: 0, bb: 0, k: 0, er: 0 }), { era: null, whip: null, kPct: null, bbPct: null, avg: null }, '분모 0 → null');
  });

  test('저장된 값은 믿지 않는다: 문자열 숫자 · 음수 · 배열 아닌 값 · 이름 없는 줄은 빼고, __proto__ 이름도 객체를 오염시키지 않는다', function () {
    var bad = [
      { data: null }, { data: { ta: 'X', th: 'Y', pitchLines: null } }, { data: { ta: 'X', th: 'Y', pitchLines: { away: 'nope', home: {} } } },
      { data: { ta: '가팀', th: '', pitchLines: { away: [null, 7, { name: '', outs: 3 }, { name: '__proto__', number: '1', outs: '9', er: -1, tbf: 3 }], home: [L('무시', '0', '승', 3, 3, 3, 0, 0, 0, 0, 0)] } } }
    ];
    var t = window.SLGoPitch.collectGoPitching(bad);
    eq(t.map(function (x) { return x.name + ':' + x.games + ':' + x.pitchers.map(function (p) { return p.name + '/' + p.outs + '/' + p.er + '/' + p.tbf; }).join(','); }), ['가팀:1:__proto__/0/0/3'], '남는 것');
    eq([({}).outs, ({}).g], [undefined, undefined], 'Object.prototype 오염 없음');
  });

  test('카드: 가져온 투수 표가 없으면 숨김 → 저장 경기 2개 → 분석 탭 › 투수 아래에 팀 선택 · 투수별 줄 · 팀 합계', function () {
    openPitcherView();
    var box = $('goPitchSeason');
    ok(box && box.hidden && !box.innerHTML, '투수 표를 가져온 경기가 없으면 숨김');
    put([G1, G2]);
    openPitcherView();
    ok(!box.hidden && box.querySelector('.an-card h3').textContent === '게임원 투수 시즌 기록', '카드 — ' + box.textContent.slice(0, 80));
    ok(box.parentElement.id === 'anaSecPitcher' && box.previousElementSibling, '투수 화면(#anaSecPitcher) 안 · 투수 분석 아래');
    eq(Array.prototype.map.call(box.querySelectorAll('select option'), function (o) { return o.textContent; }), ['가팀 · 2경기', '나팀 · 1경기', '다팀 · 1경기'], '팀 선택(기본 = 가장 많이 나온 팀)');
    eq(rows(), [
      '가투수 #9 | 2 | 2-0-0 | 6 1/3 | 3.32 | 1.26 | 26% | 7% | .240 | 27',
      '가계투 #5 | 2 | 0-0-1 | 1 2/3 | 0.00 | 1.20 | 14% | 0% | .286 | 7',   // WHIP (1+1)×3÷5
      '팀 합계 | 2 | 2-0-1 | 8 | 2.63 | 1.25 | 24% | 6% | .250 | 34'   // 평균자책 3×7÷8 · WHIP (8+2)×3÷24
    ], '가팀 줄');
  });

  test('팀을 바꾸면 그 팀 투수로 다시 그리고, 고른 팀을 기억한다(sl_go_pteam) · 투수 1명이면 합계 줄 없음 · 안내 모드 설명', async function () {
    var sel = document.querySelector('#goPitchSeason select');
    sel.value = '나팀'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    eq(rows(), ['나투수 #8 | 1 | 0-1-0 | 4 | 7.00 | 2.00 | 10% | 10% | .333 | 20'], '나팀 줄');
    eq(localStorage.getItem('sl_go_pteam'), '나팀', '고른 팀 기억');
    openPitcherView();
    eq(document.querySelector('#goPitchSeason select').value, '나팀', '다시 열어도 그 팀');
    await T.sleep(100);
    var card = document.querySelector('#goPitchSeason .an-card');
    ok(card.getAttribute('data-help') && card.getAttribute('data-help').indexOf('7이닝 기준') >= 0, '안내 모드 설명 — ' + card.getAttribute('data-help'));
  });

  test('(정리) 이 파일이 만든 저장 경기 · 설정을 지운다', function () {
    KEYS.forEach(function (k) { localStorage.removeItem(k); });
    localStorage.setItem('sl_saves', JSON.stringify(JSON.parse(localStorage.getItem('sl_saves') || '[]').filter(function (s) { return KEYS.indexOf(s.key) < 0; })));
    localStorage.removeItem('sl_go_pteam');
    openPitcherView();
    ok($('goPitchSeason').hidden, '다시 숨김');
  });
})();
