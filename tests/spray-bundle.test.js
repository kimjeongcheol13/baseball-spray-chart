// 분석 › 타자 › 시즌 전체 「상황별 타구 방향」 (batter.js _situCard) — 6-4-3 Charts 상황별 스프레이 묶음
//  · 칸 = 2스트라이크 · 초구 · 득점권 · 좌투 · 우투 · 최근 5경기 · 안타만 · 아웃만 — 타구 점이 없는 상황은 뺀다
//  · 득점권 = 경기 운영 모드 타석(gfPre)만 · 최근 5경기는 6경기 이상일 때만 (아니면 시즌 전체와 같다)
//  · 안타만 · 아웃만은 타율 줄이 없다 · 이번 경기(시즌 전체가 아닐 때)엔 카드가 없다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var t0 = 1790201000000, NM = '묶음타자', id = 0;
  function ab(res, extra) { return Object.assign({ id: t0 + (++id) * 1000, bname: NM, team: 'home', inn: '1회말', res: res, x: 0.5, y: 0.5, pitches: [] }, extra || {}); }
  function tiles() {
    return [].map.call(document.querySelectorAll('.bt-situ-tile'), function (t) {
      var st = t.querySelector('.bt-situ-st');
      return t.querySelector('figcaption').firstChild.textContent + ' ' + t.querySelector('figcaption span').textContent + (st ? ' ' + st.textContent : '');
    });
  }
  function seed(list, newestFirst) {
    var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
    list.forEach(function (abs, i) {
      var d = { key: 'sl_sb_t' + i, th: '한빛', ta: '청솔', hs: 1, as: 0, ts: t0 + (newestFirst ? list.length - i : i) * 86400000, d: '2026. 11. ' + (i + 1) + '.', abs: abs, pitchers: [], home_lineup: [], away_lineup: [] };
      localStorage.setItem(d.key, JSON.stringify(d));
      saves.push({ key: d.key, label: '청솔 vs 한빛', ts: d.ts });
    });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
  }
  function clean() {
    Object.keys(localStorage).filter(function (k) { return /^sl_sb_t/.test(k); }).forEach(function (k) { localStorage.removeItem(k); });
    localStorage.setItem('sl_saves', JSON.stringify(JSON.parse(localStorage.getItem('sl_saves') || '[]').filter(function (s) { return !/^sl_sb_t/.test(s.key); })));
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.setBatterView && window.shellOpenAnalysis, '타자 탭 로드');
    window.AS.abs = [];
  });

  test('상황마다 칸 하나 · 타구 점 수 · 타석 · 타율 · 점 없는 상황은 뺀다', async function () {
    seed([[
      ab('2루타', { count: { b: 1, s: 2 }, hand: 'R' }),
      ab('땅볼 아웃', { count: { b: 0, s: 2 }, hand: 'L' }),
      ab('안타', { count: { b: 0, s: 0 }, hand: 'R', gfPre: { outs: 0, bases: [false, true, false] } }),
      ab('플라이 아웃', { count: { b: 2, s: 1 }, gfPre: { outs: 1, bases: [true, false, false] } }),   // 1루만 = 득점권 아님 · 손 없음
      ab('삼진', { count: { b: 0, s: 2 }, hand: 'R', x: null, y: null }),                               // 점은 없고 타석으로만 센다
    ]]);
    try {
      shellOpenAnalysis('batter');
      await T.sleep(50);
      setBatterView('scope', 'season'); setBatterView('sel', NM);
      eq(document.querySelector('.bt-situ-card h3').textContent, '상황별 타구 방향', '제목');
      eq(tiles(), [
        '2스트라이크 타구 2개 3타석 · 타율 .333',
        '초구 타구 1개 1타석 · 타율 1.000',
        '득점권 타구 1개 1타석 · 타율 1.000',
        '좌투 상대 타구 1개 1타석 · 타율 .000',
        '우투 상대 타구 2개 3타석 · 타율 .667',
        '안타만 타구 2개',
        '아웃만 타구 2개',
      ], '최근 5경기는 경기가 적어 없음 · 안타만 · 아웃만은 타율 줄 없음');
      await T.sleep(50);   // ana3d 가 MutationObserver 로 2D·3D 버튼을 붙인다
      ok(document.querySelector('#anaBody .ana-sec.on .an-3d-seg'), '위 타구 방향 카드엔 2D·3D 버튼이 있다');
      ok(!document.querySelector('.bt-situ-card .an-3d-seg'), '묶음 카드엔 없다 — 칸마다 WebGL 을 만들지 않는다');
    } finally { clean(); }
  });

  test('6경기 이상이면 최근 5경기 칸 — 저장 순서가 아니라 경기 시각으로 가장 오래된 경기가 빠진다', async function () {
    var list = [];
    for (var i = 0; i < 6; i++) list.push([ab(i < 5 ? '안타' : '땅볼 아웃', { hand: 'R' })]);
    seed(list, true);   // 맨 나중에 저장한 땅볼 아웃 경기가 가장 오래된 경기
    try {
      setBatterView('scope', 'season'); setBatterView('sel', NM);
      await T.sleep(50);
      var row = tiles().filter(function (x) { return /^최근/.test(x); });
      eq(row, ['최근 5경기 타구 5개 5타석 · 타율 1.000'], '가장 오래된 경기의 땅볼 아웃은 빠짐');
    } finally { clean(); }
  });

  test('타구 점이 하나도 없으면 카드가 없고, 이번 경기 보기에도 없다', async function () {
    seed([[ab('삼진', { x: null, y: null }), ab('볼넷', { x: null, y: null })]]);
    try {
      setBatterView('scope', 'season'); setBatterView('sel', NM);
      await T.sleep(50);
      ok(!document.querySelector('.bt-situ-card'), '점 없음 = 카드 없음');
    } finally { clean(); }
    seed([[ab('안타')]]);
    try {
      setBatterView('scope', 'season'); setBatterView('sel', NM);
      await T.sleep(50);
      ok(document.querySelector('.bt-situ-card'), '시즌 전체엔 있음');
      window.AS.abs = [ab('안타')];
      setBatterView('scope', 'game'); setBatterView('sel', NM);
      await T.sleep(50);
      ok(!document.querySelector('.bt-situ-card'), '이번 경기엔 없음');
    } finally { window.AS.abs = []; clean(); }
  });
})();
