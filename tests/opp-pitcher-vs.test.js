// 분석 › 팀 「상대 투수 맞대결」 (team.js _vsCard) — 투수 한 명 ↔ 타자 전원 (6-4-3 Charts Player vs Player)
//  · 타석의 투수 = 엑셀 「투구 기록」과 같은 연결(xlsxreport abPitcher): 직접 적힌 투수 → 공에 적힌 투수 → 그 타자에게 던진 가장 가까운 공
//  · 같은 이름 + 같은 팀 = 같은 투수(경기를 넘어 합침) · 이름이 같아도 팀이 다르면 다른 투수
//  · 홈(우리) = 상대 투수 vs 우리 타자 · 원정 = 우리 투수 vs 상대 타자 · 양 팀 = 카드 없음
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var t0 = 1790001000000;
  function ab(i, name, res, extra) { return Object.assign({ id: t0 + i * 1000, bname: name, team: 'home', inn: '1회말', res: res, pitches: [] }, extra || {}); }
  function rows() {
    return [].map.call(document.querySelectorAll('.tm-vs tbody tr'), function (tr) {
      return [].map.call(tr.children, function (c) { return c.textContent.trim(); }).join(' ');
    });
  }
  function opts() { return [].map.call(document.querySelectorAll('.tm-vs-sel option'), function (o) { return o.textContent; }); }
  function title() { var h = document.querySelector('.tm-vs h3'); return h ? h.textContent : null; }
  function names(h, a) { document.getElementById('tHome').value = h; document.getElementById('tAway').value = a; }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.setTeamScope && window.shellOpenAnalysis, '팀 탭 로드');
  });

  test('이번 경기: 직접 적힌 투수 · 공에 적힌 투수 · 시간순 공으로 투수를 찾고, 타석이 많은 투수가 먼저 · 타자별 줄 + 합계', async function () {
    names('한빛', '청솔');
    window.AS.abs = [
      ab(1, '강', '2루타', { pitcher: '박투수' }),                             // 직접 적힌 투수
      ab(2, '중', '삼진', { pitches: [{ pt: '직구', pitcher: '박투수' }] }),   // 공에 적힌 투수
      ab(3, '강', '볼넷'),                                                     // 시간순: 바로 전 강에게 던진 공 = 박투수
      ab(4, '약', '땅볼 아웃', { pitcher: '이계투' }),
      ab(5, '상', '안타', { team: 'away', pitcher: '우리투' }),                // 상대 타석 — 홈(우리) 표에는 없다
      ab(6, '무', '안타'),                                                     // 투수를 알 수 없는 타석 — 세지 않는다
    ];
    window.AS.pitchers = [{ id: 1, name: '박투수', pitches: [{ id: t0 + 2500, batter: '강' }] }];
    shellOpenAnalysis('team');
    await T.sleep(50);
    setTeamScope('scope', 'game'); setTeamScope('side', 'home');
    eq(title(), '상대 투수 맞대결', '제목');
    eq(opts(), ['박투수 · 청솔 · 3타석', '이계투 · 청솔 · 1타석'], '투수 목록 = 타석 많은 순 · 팀 = 상대 팀 이름');
    eq(rows(), ['강 2 1 1 1 1 0 1.000 1.000 .980', '중 1 1 0 0 0 1 .000 .000 .000', '합계 3 2 1 1 1 1 .500 .667 .653'],
      '박투수 — 타석 · 타수 · 안타 · 장타 · 볼넷 · 삼진 · 타율 · 출루율 · wOBA (wOBA = (0.69 볼넷 + 1.27 2루타) ÷ (타수+볼넷))');
  });

  test('다른 투수를 고르면 그 투수와 붙은 타자만', function () {
    setTeamScope('vs', '이계투|청솔');
    eq(document.querySelector('.tm-vs-sel').value, '이계투|청솔', '고른 투수');
    eq(rows(), ['약 1 1 0 0 0 0 .000 .000 .000', '합계 1 1 0 0 0 0 .000 .000 .000'], '이계투');
  });

  test('원정 = 우리 투수 vs 상대 타자 · 양 팀이면 카드 없음', function () {
    setTeamScope('side', 'away');
    eq(title(), '우리 투수 맞대결', '제목');
    eq(opts(), ['우리투 · 한빛 · 1타석'], '팀 = 우리 팀 이름');
    setTeamScope('side', 'all');
    ok(!document.querySelector('.tm-vs'), '양 팀이면 없음');
    setTeamScope('side', 'home');
  });

  test('투수가 이어진 타석이 없으면 어떻게 이어지는지 안내', async function () {
    window.AS.abs = [ab(1, '강', '안타')];
    window.AS.pitchers = [];
    setTeamScope('scope', 'game');
    ok(/투수가 이어진 타석이 없어요/.test(document.querySelector('.tm-vs').textContent), '안내 문구');
    ok(!document.querySelector('.tm-vs-sel'), '고르기 없음');
  });

  test('시간순 연결은 같은 반 이닝의 공만 — 앞 이닝에 던진 투수 · 5분 안에 다음 이닝에 던진 투수를 붙이지 않고, 뺀 타석 수를 알려 준다', function () {
    window.AS.abs = [ab(1, '강', '안타'), ab(2, '강', '볼넷', { inn: '3회말' }), ab(3, '중', '안타')];
    window.AS.pitchers = [
      { id: 1, name: '선발', pitches: [{ id: t0 + 500, batter: '강', inning: '1회말' }] },
      { id: 2, name: '계투', pitches: [{ id: t0 + 3500, batter: '중', inning: '2회말' }] },
    ];
    setTeamScope('scope', 'game');
    eq(opts(), ['선발 · 청솔 · 1타석'], '같은 반 이닝의 공만 이어진다');
    ok(/투수를 모르는 2타석은 뺐어요/.test(document.querySelector('.tm-vs').textContent), '뺀 타석 수: ' + document.querySelector('.tm-vs').textContent);
  });

  test('시즌: 같은 이름 + 같은 팀은 여러 경기를 합치고, 팀이 다르면 다른 투수', async function () {
    var G = [['sl_vs_t1', '청솔'], ['sl_vs_t2', '청솔'], ['sl_vs_t3', '솔빛']].map(function (x, i) {
      return { key: x[0], th: '한빛', ta: x[1], hs: 1, as: 0, ts: t0 + i * 86400000, d: '2026. 11. ' + (i + 1) + '.',
        abs: [ab(10 + i, '강', i ? '삼진' : '안타', { pitcher: '박투수' })], pitchers: [], home_lineup: [], away_lineup: [] };
    });
    var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
    G.forEach(function (d) { localStorage.setItem(d.key, JSON.stringify(d)); saves.push({ key: d.key, label: d.ta + ' vs ' + d.th, ts: d.ts }); });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
    window.AS.abs = [];
    try {
      setTeamScope('scope', 'season');
      await T.sleep(50);
      var mine = opts().filter(function (o) { return /박투수/.test(o); });
      eq(mine, ['박투수 · 청솔 · 2타석', '박투수 · 솔빛 · 1타석'], '청솔 박투수 2경기 합침 · 솔빛 박투수는 따로');
      setTeamScope('vs', '박투수|청솔');
      eq(rows(), ['강 2 2 1 0 0 1 .500 .500 .445', '합계 2 2 1 0 0 1 .500 .500 .445'], '두 경기 합친 줄');
    } finally {
      G.forEach(function (d) { localStorage.removeItem(d.key); });
      localStorage.setItem('sl_saves', JSON.stringify(JSON.parse(localStorage.getItem('sl_saves') || '[]').filter(function (s) { return !/^sl_vs_t/.test(s.key); })));
      setTeamScope('scope', 'game');
    }
  });
})();
