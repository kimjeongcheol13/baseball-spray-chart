// 경기 중복 읽기 통일(P0.5) 검증 — 같은 경기를 여러 번 저장한 사본을 경기 하나로 묶고 마지막 저장본만 쓰는지, 모든 화면이 같은 값을 내는지.
//  · 가상 데이터만 쓴다 (실제 백업 구조를 본뜬 8경기: 저장 항목 24개 → 경기 8개 · 전체 타석 94 · 홈팀 기준 2승 2패 4무)
//  · 대상 화면: 불러오기 목록 · 분석 탭(buildData) · 팀 탭 승패 · 시즌 선수별 성적 · 전체 엑셀 · 시즌 카드가 읽는 목록 · 삭제(경기 단위)
// 저장 데이터는 고치지 않는다 — 읽을 때만 정리한다.
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var G = function () { return window.SLGames; };
  var BASE = 1780200000000;   // 2026-05-31 경 — 진짜 시각 id 범위(≥ 1e11)
  var NAMES = ['가', '나', '다', '라', '마', '바'];

  // ── 데이터 만들기 ──
  function ab(id, name, res, o) { return Object.assign({ id: id, bid: 'p-' + name, bname: name, bnum: 1, team: 'home', res: res, inn: '1회초', x: 0.3 + (id % 7) / 20, y: 0.4, rbi: 0 }, o || {}); }
  function mkAbs(base, n, who, step) {
    var out = [], w = who || NAMES;
    for (var i = 0; i < n; i++) out.push(ab(base + i * (step || 20000), w[i % w.length], i % 3 === 0 ? '안타' : i % 3 === 1 ? '삼진' : '땅볼 아웃'));
    return out;
  }
  function game(o) { return Object.assign({ th: '홈', ta: '원정', hs: 0, as: 0, abs: [], d: '2026. 5. 31.', ts: BASE, home_lineup: [], away_lineup: [], pitchers: [] }, o); }
  var saves, mods;
  function reset() { localStorage.clear(); saves = []; mods = {}; AS.abs = []; AS.pitchers = []; AS.hs = 0; AS.as = 0; }
  function put(key, data, mod) {
    localStorage.setItem(key, JSON.stringify(data));
    saves.push({ key: key, label: (data.th || '') + ' vs ' + (data.ta || '') + ' ' + data.hs + ':' + data.as, ts: data.ts });
    if (mod) mods[key] = mod;
  }
  function commit() { localStorage.setItem('sl_saves', JSON.stringify(saves)); localStorage.setItem('sl_cloud_mod', JSON.stringify(mods)); }
  function rows() { return G().loadGames({ withCurrent: false }); }
  function paOf(arr) { return arr.reduce(function (s, g) { return s + g.abs.length; }, 0); }

  // 실제 백업 구조: 8경기 · 24개 저장 항목
  //  A 3벌(29타석 6:7) · B 2벌(6타석 · 사본 사이에 팀 이름이 바뀌고 타석 하나가 다른 타석으로 바뀜) · C 1벌(1타석) ·
  //  D 14벌(40타석 ×11 → 42타석 ×3, 점수 5:6 → 6:5) · E 가져온 10타석 6:0 · F 가져온 5타석 3:6 · G 1타석 · H 타석 없음
  function backupLike() {
    reset();
    var A = mkAbs(BASE, 29, ['가', '나', '다']);
    for (var k = 0; k < 3; k++) put('sl_A' + k, game({ th: '홈팀', ta: '원정팀', hs: 6, as: 7, abs: A, d: ['2026. 5. 17.', '2026. 5. 25.', '2026. 6. 1.'][k], ts: BASE + 100 + k }));
    var B = mkAbs(BASE + 1e7, 6, ['라', '마']);
    put('sl_B0', game({ th: '홈팀', ta: '원정팀', abs: B, ts: BASE + 200 }));
    put('sl_B1', game({ th: '하하', ta: '스톤', abs: B.slice(0, 5).concat([ab(BASE + 1e7 + 999, '바', '안타')]), ts: BASE + 201 }));   // 마지막 사본: 이름이 바뀌고 한 타석이 다른 타석으로 바뀜
    put('sl_C0', game({ th: '홈팀', ta: '원정팀', abs: [ab(BASE + 2e7, '가', '안타')], ts: BASE + 300 }));
    var D = mkAbs(BASE + 3e7, 40, NAMES), D2 = D.concat([ab(BASE + 3e7 + 5e6, '나', '안타'), ab(BASE + 3e7 + 6e6, '나', '안타')]);
    for (var i = 0; i < 14; i++) put('sl_D' + i, game({ th: '스톤', ta: '하하', hs: i < 5 ? 5 : 6, as: i < 5 ? 6 : 5, abs: i < 11 ? D : D2, ts: BASE + 400 + i * 1000 }));
    var T0 = BASE + 9e8;   // 엑셀을 한꺼번에 가져온 경기들: id = Date.now() + n (1초 간격)
    put('sl_E0', game({ th: 'S', ta: 'K', hs: 6, as: 0, abs: mkAbs(T0, 10, ['사', '아'], 1), ts: T0 + 20 }));
    put('sl_F0', game({ th: 'S', ta: 'K', hs: 3, as: 6, abs: mkAbs(T0 + 1000, 5, ['자', '차'], 1), ts: T0 + 21 }));
    put('sl_G0', game({ th: 'S', ta: 'K', abs: [ab(BASE + 5e8, '카', '안타')], ts: BASE + 500 }));
    put('sl_H0', game({ th: '홈팀', ta: '원정팀', abs: [], ts: BASE + 600 }));
    commit();
  }
  function lastKeys() { return rows().map(function (g) { return g.key; }).sort(); }

  // 앱이 시작할 때 도는 처리(이전 세션 자동 복구 · 첫 동기화)가 끝난 뒤에 저장 경기를 심는다 — 먼저 심으면 "이전 경기 열기"가 가상 경기를 열어
  // 자동저장 업로드 타이머가 남고, 뒤의 클라우드 테스트에 끼어든다 (다른 테스트 파일들의 boot() 와 같은 이유)
  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () { await T.sleep(2500); eq(typeof G().loadGames, 'function', 'SLGames'); });

  // ═══ 이번 백업 구조 ═══
  test('불러오기: 저장 항목 24개 → 경기 8개, 사본이 있는 경기에만 "저장본 N개"', function () {
    backupLike(); eq(saves.length, 24, '저장 항목'); eq(rows().length, 8, '실제 경기');
    openLoad();
    var cards = Array.prototype.slice.call(document.querySelectorAll('#saveList .load-card'));
    eq(cards.length, 8, '목록 줄 수');
    var txt = cards.map(function (c) { return c.textContent; });
    eq(txt.filter(function (t) { return /저장본 14개/.test(t); }).length, 1, '14벌 경기');
    eq(txt.filter(function (t) { return /저장본 3개/.test(t); }).length, 1, '3벌 경기');
    eq(txt.filter(function (t) { return /저장본 2개/.test(t); }).length, 1, '2벌 경기');
    eq(txt.filter(function (t) { return /저장본/.test(t); }).length, 3, '사본이 없는 경기에는 표시하지 않는다');
    closeOverlay('loadOverlay');
  });
  test('전체 타석 94 — 분석 탭(buildData) · 공통 목록 · 시즌 카드가 읽는 목록이 모두 같다', function () {
    backupLike();
    eq(paOf(rows()), 94, '공통 목록');
    var bd = window.buildData ? window.buildData() : null;
    return import('/js/features/batdata.js?v=6').then(function (B) {
      var d = B.buildData();
      eq(d.games.filter(function (g) { return !g.current; }).length, 8, '분석 탭 저장 경기 수');
      eq(d.games.reduce(function (s, g) { return s + g.abs.length; }, 0), 94, '분석 탭 전체 타석');
      eq(d.pool.pa, 94, '분석 탭 풀 타석');
      var sc = _readSavedGames(); eq(sc.length, 8, '시즌 카드가 읽는 경기'); eq(paOf(sc), 94, '시즌 카드가 읽는 타석');
    });
  });
  test('팀 탭 승패: 마지막 저장본 기준 2승 2패 4무 (예전에는 24경기를 전부 세어 10승 9패 5무)', function () {
    backupLike();
    openTeamView(); setTeamScope('season');
    var rec = ($('teamContent').querySelector('.tm-rec-main') || {}).textContent || '';
    ok(/2승\s*2패\s*4무/.test(rec), '팀 탭 승패: ' + rec);
  });
  test('시즌 선수별 성적: 선수별 타석 = 경기마다 마지막 저장본만 센 값 (현재 경기가 저장본과 같으면 두 번 세지 않는다)', function () {
    backupLike();
    var want = {}; rows().forEach(function (g) { g.abs.forEach(function (a) { want[a.bname] = (want[a.bname] || 0) + 1; }); });
    function got() { var o = {}; Array.prototype.forEach.call($('playerProfileContent').querySelectorAll('tbody tr'), function (tr) { var td = tr.querySelectorAll('td'); o[td[0].textContent.replace(/^#\d+\s*/, '')] = +td[1].textContent; }); return sorted(o); }
    function sorted(o) { var r = {}; Object.keys(o).sort().forEach(function (k) { r[k] = o[k]; }); return r; }
    want = sorted(want); openPlayerProfile(); eq(got(), want, '선수별 타석');
    var tot = Object.keys(want).reduce(function (s, k) { return s + want[k]; }, 0); eq(tot, 94, '합계');
    // 현재 화면이 저장본(D 경기)을 연 상태 — 예전에는 현재 경기 + 저장본이 겹쳐 두 번 세어졌다
    var last = rows().filter(function (g) { return g.copyCount === 14; })[0];
    AS.abs = JSON.parse(JSON.stringify(last.abs)); openPlayerProfile(); eq(got(), want, '현재 경기가 저장본과 같을 때 선수별 타석'); closeOverlay('playerProfileOverlay');
  });
  test('전체 엑셀: 경기 목록 8줄 · 전체 타석기록 94줄', function () {
    backupLike();
    var hadX = 'XLSX' in window, oldX = window.XLSX, cap = {};
    window.XLSX = { utils: { book_new: function () { return {}; }, aoa_to_sheet: function (r) { return { _rows: r }; }, book_append_sheet: function (wb, ws, name) { cap[name] = ws._rows; }, encode_cell: function () { return 'A1'; }, sheet_to_json: function () { return []; } }, writeFile: function () {} };
    try { exportAllGamesToExcel(); } finally { if (hadX) window.XLSX = oldX; else delete window.XLSX; }
    eq(cap['경기목록'].length - 1, 8, '경기 목록'); eq(cap['전체타석기록'].length - 1, 94, '전체 타석기록');
  });

  // ═══ 식별 ═══
  test('같은 날 같은 팀끼리 한 더블헤더 2경기는 합쳐지지 않는다', function () {
    reset();
    put('sl_dh1', game({ th: '홈', ta: '원정', d: '2026. 6. 7.', abs: mkAbs(BASE, 20), ts: BASE + 1 }));
    put('sl_dh2', game({ th: '홈', ta: '원정', d: '2026. 6. 7.', abs: mkAbs(BASE + 3 * 3600e3, 20), ts: BASE + 2 }));
    commit(); eq(rows().length, 2, '경기 수'); eq(paOf(rows()), 40, '타석');
  });
  test('공유 링크로 저장한 서로 다른 경기 2개(둘 다 id 가 0부터)는 합쳐지지 않는다 · 같은 공유를 두 번 저장한 것은 합쳐진다', function () {
    reset();
    function shared(th, who) { return game({ th: th, ta: 'X', abs: who.map(function (n, i) { return ab(i, n, i % 2 ? '삼진' : '안타'); }), ts: BASE }); }
    put('sl_s1', shared('팀1', ['가', '나', '다', '라']));
    put('sl_s2', shared('팀2', ['마', '바', '사', '아']));
    put('sl_s3', shared('팀1', ['가', '나', '다', '라']));   // sl_s1 과 같은 공유를 한 번 더 저장
    commit();
    var r = rows(); eq(r.length, 2, '경기 수'); eq(r.map(function (g) { return g.copyCount; }).sort(), [1, 2], '사본 수');
    reset();   // 타석 2개짜리는 같은 내용이어도 합치지 않는다 (우연히 같을 수 있다)
    put('sl_t1', shared('팀1', ['가', '나'])); put('sl_t2', shared('팀1', ['가', '나'])); commit();
    eq(rows().length, 2, '2타석짜리는 합치지 않음');
  });
  test('엑셀을 한꺼번에 가져와 id 가 1ms 단위로 겹쳐도(다른 타자) 합쳐지지 않는다 · id 하나만 같은 큰 경기도 합쳐지지 않는다', function () {
    reset();
    put('sl_x1', game({ abs: mkAbs(BASE, 10, ['가', '나'], 1), ts: BASE + 1 }));
    put('sl_x2', game({ abs: mkAbs(BASE + 3, 10, ['사', '아'], 1), ts: BASE + 2 }));   // id 7개가 겹치지만 타자가 다르다
    var big1 = mkAbs(BASE + 1e7, 20, NAMES), big2 = mkAbs(BASE + 2e7, 20, NAMES); big2[0] = Object.assign({}, big1[5]);   // id 하나만 같다
    put('sl_y1', game({ abs: big1, ts: BASE + 3 })); put('sl_y2', game({ abs: big2, ts: BASE + 4 }));
    commit(); eq(rows().length, 4, '경기 수');
  });
  test('투구 id 는 식별에 쓰지 않는다: 타석이 다른 두 경기가 같은 투구를 갖고 있어도 합치지 않고, 투구는 먼저 나온 경기에서 한 번만 센다', function () {
    reset();
    var pit = function () { return [{ id: 7, name: '투수', pitches: [1, 2, 3, 4, 5].map(function (i) { return { id: BASE + 7e7 + i, result: '볼', batter: '가' }; }) }]; };
    put('sl_p1', game({ abs: mkAbs(BASE, 12), pitchers: pit(), ts: BASE + 1 }));
    put('sl_p2', game({ abs: mkAbs(BASE + 1e7, 12), pitchers: pit(), ts: BASE + 2 }));   // clearAll 뒤에 새로 기록한 경기에 투구가 남아 저장된 모양
    commit(); eq(rows().length, 2, '경기 수');
    var n = rows().reduce(function (s, g) { return s + g.pitchers.reduce(function (t, p) { return t + p.pitches.length; }, 0); }, 0); eq(n, 5, '투구가 두 번 세어지지 않음');
    eq(JSON.parse(localStorage.getItem('sl_p2')).pitchers[0].pitches.length, 5, '저장 데이터는 그대로');
  });
  test('타석이 하나도 없는 투구 전용 항목끼리는 투구 id 로 묶는다 (같은 경기를 여러 번 저장한 경우)', function () {
    reset();
    var pit = function () { return [{ id: 7, name: '투수', pitches: [1, 2, 3, 4, 5].map(function (i) { return { id: BASE + 8e7 + i, result: '볼', batter: '가' }; }) }]; };
    put('sl_q1', game({ abs: [], pitchers: pit(), ts: BASE + 1 })); put('sl_q2', game({ abs: [], pitchers: pit(), ts: BASE + 2 })); commit();
    var r = rows(); eq(r.length, 1, '경기 수'); eq(r[0].copyCount, 2, '사본 수');
  });

  // ═══ 마지막 저장본 ═══
  test('사본 사이에 점수가 바뀌고 타석이 추가·삭제되면 마지막 저장본의 값이 나온다 (지운 타석은 되살아나지 않는다)', function () {
    reset();
    var a = mkAbs(BASE, 10);
    put('sl_c1', game({ hs: 5, as: 6, abs: a, ts: BASE + 1 }));
    put('sl_c2', game({ hs: 6, as: 5, abs: a.slice(0, 8).concat([ab(BASE + 5e6, '나', '안타')]), ts: BASE + 2 }));   // 점수 변경 · 2타석 삭제 · 1타석 추가
    put('sl_c3', game({ hs: 7, as: 5, abs: a.slice(0, 8).concat([ab(BASE + 5e6, '나', '안타'), ab(BASE + 6e6, '다', '삼진')]), ts: BASE + 3 }));
    commit();
    var g = rows(); eq(g.length, 1, '경기'); eq([g[0].key, g[0].copyCount, g[0].abs.length, g[0].data.hs, g[0].data.as], ['sl_c3', 3, 10, 7, 5], '마지막 저장본');
    return import('/js/features/batdata.js?v=6').then(function (B) {
      var d = B.buildData().games.filter(function (x) { return !x.current; });
      eq([d.length, d[0].abs.length, d[0].hs, d[0].as], [1, 10, 7, 5], '분석 탭도 같은 값');
      ok(!d[0].abs.some(function (x) { return x.id === a[9].id; }), '삭제한 타석이 되살아남');
    });
  });
  test('마지막 저장본은 sl_saves 순서가 아니라 수정 시각으로 정한다 (순서를 섞고 수정 시각 기록을 지워도 같은 경기 목록)', function () {
    backupLike();
    var before = lastKeys(), pa = paOf(rows());
    saves.reverse(); mods = {}; commit();
    eq(lastKeys(), before, '마지막 저장본 키'); eq(paOf(rows()), pa, '전체 타석');
    saves.sort(function (x, y) { return x.key < y.key ? 1 : -1; }); commit(); eq(lastKeys(), before, '다른 순서');
  });
  test('수정 시각: sl_cloud_mod 가 더 새로우면 ts 가 옛것이어도 마지막 저장본이다 · ts 가 로케일 문자열이어도 읽는다 · 같으면 키 순', function () {
    reset();
    var a = mkAbs(BASE, 6), b = a.slice(0, 5);
    put('sl_m1', game({ abs: a, ts: BASE + 1 })); put('sl_m2', game({ abs: b, ts: BASE + 9 }), 0);
    mods['sl_m1'] = BASE + 50; commit();   // m1 은 ts 가 옛것이지만 나중에 수정됨
    eq(rows()[0].key, 'sl_m1', 'sl_cloud_mod 가 새로운 사본');
    reset();
    put('sl_n1', game({ abs: a, ts: '2026. 5. 17. 오후 4:28:31' })); put('sl_n2', game({ abs: b, ts: BASE + 1 })); commit();   // 문자열 ts(2026-05-17)는 숫자 ts(2026-05-31 경)보다 옛것
    eq(rows()[0].key, 'sl_n2', '문자열 ts');
    reset();
    put('sl_o1', game({ abs: a, ts: BASE + 5 })); put('sl_o2', game({ abs: b, ts: BASE + 5 })); commit();
    eq(rows()[0].key, 'sl_o2', '시각이 같으면 키가 큰 것');
  });

  // ═══ 현재 경기 ═══
  test('현재 화면의 경기가 저장본과 같으면 그 경기의 가장 새 사본으로 쓴다 — 두 번 세지 않고 · 현재 화면에서 지운 타석이 되살아나지 않고 · 저장 안 된 새 경기는 따로', function () {
    backupLike();
    var d = rows().filter(function (g) { return g.copyCount === 14; })[0];
    AS.abs = JSON.parse(JSON.stringify(d.abs));
    var all = G().loadGames(); eq(all.length, 8, '경기 수 (현재 경기가 저장 경기와 같으면 늘지 않는다)');
    var row = all.filter(function (g) { return g.copies.length === 14; })[0]; eq([row.live, row.current, row.abs.length], [true, false, 42], '저장 경기로 합쳐짐');
    AS.abs = JSON.parse(JSON.stringify(d.abs)).slice(0, 39);   // 현재 화면에서 3타석 지움
    row = G().loadGames().filter(function (g) { return g.copies.length === 14; })[0]; eq(row.abs.length, 39, '지운 타석이 되살아나지 않음');
    AS.abs = mkAbs(BASE + 7e8, 3, ['가', '나', '다']);   // 저장 안 된 새 경기
    var cur = G().loadGames().filter(function (g) { return g.current; }); eq(cur.length, 1, '저장 안 된 현재 경기'); eq(cur[0].abs.length, 3, '현재 경기 타석');
    eq(paOf(G().loadGames({ withCurrent: false })), 94, '저장 경기만 세면 그대로');
  });

  // ═══ 삭제 ═══
  test('삭제는 경기 단위: 확인 문구에 저장본 수 · 경기 요약, 사본까지 전부 지운다 · 취소하면 아무것도 안 지운다', function () {
    backupLike();
    var oldConfirm = window.confirm, oldCD = window.cloudDelete, msgs = [], gone = [], answer = false;
    window.confirm = function (m) { msgs.push(m); return answer; }; window.cloudDelete = function (k) { gone.push(k); };
    try {
      var d = rows().filter(function (g) { return g.copyCount === 14; })[0];
      deleteGame(d.key);   // 취소
      eq(rows().length, 8, '취소하면 그대로'); eq(JSON.parse(localStorage.getItem('sl_saves')).length, 24, '저장 항목'); eq(gone.length, 0, '서버 삭제 호출 없음');
      ok(/저장본 14개를 모두 지워요/.test(msgs[0]), '문구: ' + msgs[0]); ok(msgs[0].indexOf(d.entry.label) >= 0, '경기 요약(팀 · 점수)'); ok(/타석 42개/.test(msgs[0]), '타석 수');
      answer = true; deleteGame(d.key);
      eq(rows().length, 7, '경기 단위로 지움'); eq(JSON.parse(localStorage.getItem('sl_saves')).length, 10, '남은 저장 항목 (24 − 14)');
      eq(gone.sort(), d.copies.slice().sort(), '사본 14개 모두 삭제 호출'); eq(Object.keys(localStorage).filter(function (k) { return /^sl_D\d+$/.test(k); }), [], '저장 데이터도 모두 지움');
      var one = rows().filter(function (g) { return g.copyCount === 1; })[0]; msgs.length = 0; deleteGame(one.key);
      ok(/저장본 1개를 지워요/.test(msgs[0]) && !/모두/.test(msgs[0]), '사본이 하나면: ' + msgs[0]);
      eq(rows().length, 6, '다른 경기는 그대로');
    } finally { window.confirm = oldConfirm; window.cloudDelete = oldCD; }
  });

  test('(정리) 이 파일이 만든 저장 상태를 비운다', function () { reset(); closeOverlay('loadOverlay'); eq(rows().length, 0, '저장 경기'); });
})();
