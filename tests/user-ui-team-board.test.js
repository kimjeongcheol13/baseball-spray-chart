// 코치용 "팀 대시보드" 검증 — 실제 js/cloud.js + js/features/teamgames.js + js/features/coachdash.js 를 가짜 서버에 붙여 돌린다(외부 요청 0건은 하네스가 마지막에 확인).
//  · 선수 묶기(B): 이름 기준, 같은 경기 안에 같은 이름의 다른 타자가 있을 때만 번호로 나눈다 · 임시 이름("타자 1" · "이름" · 빈 이름)은 선수 집계에서 빼고 "이름 미입력 N타석"
//  · 표본 적음(PA 10 미만) · 좌우(bh 입력된 선수만 당겨치기/밀어치기, 나머지는 좌·중·우) · 코치 노트(PA 10 미만 제외 · 최대 3줄)
//  · 기록자 표(팀장은 "나(팀장)", 7일 이상은 빨강) · 팀장 본인의 팀 경기는 집계에 포함하고 목록에는 안 나온다 · 같은 경기의 자동저장본 + 저장본은 한 경기
//  · 읽기 전용(localStorage 쓰기 0회 · 서버 쓰기 0건 · AS 그대로) · 이름은 전부 이스케이프 · 1024px 이상이면 대시보드가 기본
// 팀장 로그인은 한 번만 하고(가상 시간 절약) 테스트마다 서버 행만 바꿔 연다. 파일 이름순으로 맨 마지막에 돈다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;
  var OWNER = 'TEST-USER', A = 'user-aaaa-1111', B = 'user-bbbb-2222', NOW = Date.now(), DAY = 86400000, seq = 0, MM0 = window.matchMedia;

  function id() { return 1790000000000 + (++seq); }                       // 타석 id = 기록 시각(큰 정수)
  function tap(name, res, o) { return Object.assign({ id: id(), bid: 'b-' + name, bname: name, bnum: '7', team: 'home', res: res, x: 0.5, y: 0.5, deg: 90, inn: '1회초', rbi: 0 }, o || {}); }
  function taps(name, n, res, o) { var out = []; for (var i = 0; i < n; i++) out.push(tap(name, res || '안타', o)); return out; }
  // 서버의 user_games 한 행. o.days = 수정한 지 며칠 전(소수 가능)
  function game(uid, n, abs, o) {
    o = o || {};
    var at = NOW - (o.days == null ? 1 : o.days) * DAY, ds = new Date(at).toLocaleDateString('ko-KR');
    return { id: 'id-' + uid + '-' + n, user_id: uid, game_key: o.key || 'sl_17900000' + String(100000 + n), team_id: o.team_id || 'T1', team_name: '우리팀 vs 상대', date: ds,
      data: { th: '우리팀', ta: o.ta || '상대A', hs: 3, as: 1, d: ds, ts: at, abs: abs, home_lineup: o.lineup || [] }, updated_at: new Date(at).toISOString() };
  }
  var logged = false;
  async function owner(rows, members) {
    if (!logged) {
      await sleep(2000); srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear();
      srv.teams = [{ id: 'T1', name: '테스트팀', code: 'ABC234', owner_id: OWNER }];
      srv.signIn(); await sleep(1500); logged = true;
    }
    srv.user_games = rows; srv.team_members = (members || []).map(function (m) { return Object.assign({ team_id: 'T1' }, m); }); srv.log.length = 0;
  }
  function media(wide) { window.matchMedia = function (q) { return { matches: wide, media: q, addEventListener: function () {}, removeEventListener: function () {}, addListener: function () {}, removeListener: function () {} }; }; }
  function teamButton() {
    return Array.prototype.filter.call(T.$('teamSection').querySelectorAll('button'), function (b) { return b.textContent.trim() === '팀 경기'; })[0] || null;
  }
  async function open(wide) { media(wide !== false); var b = teamButton(); ok(b, '"팀 경기" 버튼이 없음'); b.click(); await sleep(400); }
  function close() { var x = document.querySelector('#teamGamesModal .tg-x'); if (x) x.click(); window.matchMedia = MM0; }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll('#teamGamesModal ' + sel)); }
  function text(sel) { var e = document.querySelector('#teamGamesModal ' + sel); return e ? e.textContent : ''; }
  function players() {
    return $$('.cd-main .cd-tbl tbody tr').map(function (tr) {
      var sm = tr.querySelector('th small');
      return { name: tr.querySelector('th b').textContent, num: sm ? sm.textContent : '', c: Array.prototype.map.call(tr.querySelectorAll('td'), function (td) { return td.textContent.trim(); }), tr: tr };
    });
  }                                                                      // c = [G, PA, AVG(+표본 적음), OBP, K%, 최근 3경기]
  function recorders() { return $$('.cd-small .cd-tbl tbody tr').map(function (tr) { return { name: tr.querySelector('th').textContent, c: Array.prototype.map.call(tr.querySelectorAll('td'), function (td) { return td.textContent.trim(); }), tr: tr }; }); }
  function summary() { var o = {}; $$('.cd-cell').forEach(function (c) { o[c.querySelector('span').textContent] = c.querySelector('b').textContent; }); return o; }
  function pickWho(v) { var s = document.querySelector('#teamGamesModal [data-act="who"]'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }
  async function run(rows, members, fn, wide) {
    await owner(rows, members);
    try { await open(wide); await fn(); } finally { close(); }
  }

  test('같은 이름은 경기 · 기록자가 달라도 한 선수로 묶인다(같은 이름+번호, 번호가 달라도 동명이인 근거가 없으면 한 선수)', async function () {
    await run([
      game(A, 1, taps('김민수', 3).concat(taps('이영호', 2)), { days: 9 }),
      game(A, 2, taps('김민수', 2, '삼진'), { days: 6 }),
      game(B, 3, taps('김민수', 4, '안타', { bnum: '11' }), { days: 2 }),
    ], [], async function () {
      var p = players();
      eq(p.map(function (x) { return x.name; }), ['김민수', '이영호'], '선수 행(타석 많은 순)');
      eq(p[0].c.slice(0, 2), ['3', '9'], '김민수 G · PA(세 경기 합산)');
      eq(p[0].num, '#11', '번호는 가장 최근 경기의 값');
      eq(p[1].c.slice(0, 2), ['1', '2'], '이영호 G · PA');
    });
  });
  test('한 경기 안에 같은 이름의 다른 타자가 있으면 그 이름만 번호로 나눈다', async function () {
    await run([
      game(A, 1, taps('김민수', 3, '안타', { bid: 101, bnum: '7' }).concat(taps('김민수', 2, '안타', { bid: 102, bnum: '11' }), taps('이영호', 2)),
        { days: 5, lineup: [{ id: 101, name: '김민수', num: '7' }, { id: 102, name: '김민수', num: '11' }] }),
      game(A, 2, taps('김민수', 2, '안타', { bid: 201, bnum: '7' }), { days: 2 }),
    ], [], async function () {
      var p = players(), kim = p.filter(function (x) { return x.name === '김민수'; });
      eq(kim.map(function (x) { return x.num + ':' + x.c.slice(0, 2).join('/'); }).sort(), ['#11:1/2', '#7:2/5'], '김민수는 번호별로 두 선수(G/PA)');
      eq(p.filter(function (x) { return x.name === '이영호'; }).length, 1, '동명이인이 아닌 이름은 그대로 한 선수');
    });
  });
  test('PA 10 미만이면 수치 옆에 "표본 적음"이 붙고, 10 이상이면 안 붙는다', async function () {
    await run([game(A, 1, taps('아홉', 9).concat(taps('열', 10)))], [], async function () {
      var p = players(), by = function (n) { return p.filter(function (x) { return x.name === n; })[0]; };
      ok(/표본 적음/.test(by('아홉').c[2]), 'PA 9 인데 "표본 적음"이 없음: ' + by('아홉').c[2]);
      ok(!/표본 적음/.test(by('열').c[2]), 'PA 10 인데 "표본 적음"이 있음: ' + by('열').c[2]);
    });
  });
  test('임시 이름("타자 N" · "이름" · 빈 이름)은 선수 집계에서 빼고 "이름 미입력 N타석"으로 따로 보인다', async function () {
    await run([game(A, 1, taps('타자 1', 2).concat(taps('이름', 1), taps('', 1), taps('타자3', 1), taps('김민수', 10)))], [], async function () {
      eq(players().map(function (x) { return x.name; }), ['김민수'], '선수 행에는 이름이 입력된 타자만');
      ok(/이름 미입력 5타석/.test(text('.cd-main')), '"이름 미입력 5타석" 안내가 없음: ' + text('.cd-main'));
    });
  });
  test('화면에 "이름이 같으면 한 선수로 봅니다 · 최근 50경기 기준"이 보이고, 요약 4칸이 맞다', async function () {
    await run([
      game(A, 1, taps('가', 4).concat(taps('나', 6, '땅볼 아웃')), { days: 1 / 1440 }),      // 방금 기록한 경기: AB 10 · H 4
      game(B, 2, taps('가', 2).concat(taps('나', 8, '땅볼 아웃')), { days: 30 }),            // 30일 전: AB 10 · H 2
    ], [], async function () {
      ok(text('.cd-meta').indexOf('이름이 같으면 한 선수로 봅니다 · 최근 50경기 기준') >= 0, '안내 문구: ' + text('.cd-meta'));
      eq(summary(), { '기록자': '2명', '모인 경기': '2', '이번 주 기록된 경기': '1', '팀 AVG': '.300타석 20' }, '요약 4칸');
    });
  });
  test('좌우 타석(bh)이 입력되지 않았으면 좌 · 중 · 우만 보이고, 입력된 선수만 당겨치기 · 밀어치기가 보인다', async function () {
    var dirs = function (n, o) { return [30, 90, 150].map(function (deg) { return tap(n, '안타', Object.assign({ deg: deg }, o)); }); };   // 좌 · 중 · 우 한 개씩(같은 선수라 bid 도 같다)
    await run([game(A, 1, dirs('좌우없음'))], [], async function () {
      var t0 = text('.cd-side');
      ok(/좌 33%/.test(t0) && /중 33%/.test(t0) && /우 33%/.test(t0), '좌 · 중 · 우 비율: ' + t0);
      ok(t0.indexOf('당겨치기') < 0 && t0.indexOf('밀어치기') < 0, 'bh 가 없는데 당겨치기 · 밀어치기가 보임');
    });
    await run([game(A, 2, dirs('우타자', { bid: 1 }).concat(dirs('입력없음', { bid: 2 })), { lineup: [{ id: 1, name: '우타자', num: '7', bh: 'R' }, { id: 2, name: '입력없음', num: '8' }] })], [], async function () {
      var t1 = text('.cd-side');
      ok(/당겨치기 33%/.test(t1) && /밀어치기 33%/.test(t1), 'bh 가 입력된 타자는 당겨치기 · 밀어치기가 보여야 함: ' + t1);
      ok(/타구 3개 기준/.test(t1), '당겨치기 · 밀어치기의 기준 타구 수(우타자 3개)가 보여야 함: ' + t1);
      pickWho('입력없음');
      var t2 = text('.cd-side');
      ok(/좌 33%/.test(t2) && t2.indexOf('당겨치기') < 0, 'bh 가 없는 선수를 고르면 좌 · 중 · 우만: ' + t2);
    });
    await run([game(A, 3, dirs('스위치', { bid: 3 }), { lineup: [{ id: 3, name: '스위치', num: '9', bh: 'S' }] })], [], async function () {
      ok(text('.cd-side').indexOf('당겨치기') < 0, '스위치 타자는 당겨치기 · 밀어치기를 정할 수 없어 좌 · 중 · 우만');
    });
  });
  test('코치 노트: PA 10 미만 선수는 빠지고, 사실 문장만, 최대 3줄이다', async function () {
    var g = function (n, days, x, y, z) { return game(A, n, taps('X타자', x[0], x[1]).concat(taps('Y타자', y, '삼진'), taps('Z타자', z[0], z[1])), { days: days }); };
    var g4 = g(4, 2, [1, '삼진'], 2, [2, '안타']);
    g4.data.abs = g4.data.abs.concat(taps('X타자', 1, '안타'));      // X 최근 6타석 중 삼진 5개(83%) — Y(8타석 · 최근 삼진 6개 = 100%)가 더 높아서 PA 필터가 없으면 Y 가 먼저 뽑힌다
    await run([
      g(1, 12, [6, '안타'], 0, [6, '삼진']), g(2, 4, [2, '삼진'], 2, [2, '안타']), g(3, 3, [2, '삼진'], 2, [2, '안타']), g4,
      game(B, 9, taps('기타선수', 3), { days: 9 }),
    ], [{ user_id: A, display_name: '기록자A' }, { user_id: B, display_name: '기록자B' }], async function () {
      var notes = $$('.cd-notes li').map(function (l) { return l.textContent; }), all = notes.join('\n');
      ok(notes.length >= 1 && notes.length <= 3, '노트는 1~3줄이어야 함: ' + notes.length);
      eq(notes.length, 3, '후보가 3개를 넘으면(삼진률 · 기록자 · 타율 ▲▼) 3줄로 자른다');
      ok(/X타자 최근 3경기 삼진률 83% \(팀 \d+%\)/.test(all), '삼진률 문장: ' + all);
      ok(/기록자 기록자B · 마지막 기록 9일 전/.test(all), '기록자 문장: ' + all);
      ok(all.indexOf('Y타자') < 0, 'PA 10 미만인 Y타자(8타석, 삼진 8개)가 노트에 들어감: ' + all);
      ok(players().some(function (p) { return p.name === 'Y타자' && /표본 적음/.test(p.c[2]); }), '표에는 Y타자가 표본 적음으로 보여야 함');
    });
  });
  test('최근 3경기 추세: 이전보다 .050 이상 오르면 ▲, 내리면 ▼, 비교할 경기가 부족하면 –', async function () {
    await run([
      game(A, 1, taps('상승', 6, '삼진').concat(taps('하락', 6, '안타'), taps('부족', 12, '안타')), { days: 12 }),
      game(A, 2, taps('상승', 2).concat(taps('하락', 2, '삼진')), { days: 4 }), game(A, 3, taps('상승', 2).concat(taps('하락', 2, '삼진')), { days: 3 }),
      game(A, 4, taps('상승', 2).concat(taps('하락', 2, '삼진')), { days: 2 }),
    ], [], async function () {
      var p = players(), by = function (n) { return p.filter(function (x) { return x.name === n; })[0]; };
      eq(by('상승').c[5], '▲', '상승'); ok(/cd-up/.test(by('상승').tr.innerHTML), '▲ 색');
      eq(by('하락').c[5], '▼', '하락'); ok(/cd-down/.test(by('하락').tr.innerHTML), '▼ 색');
      eq(by('부족').c[5], '–', '한 경기뿐이라 비교 불가');
    });
  });
  test('기록자 표: 팀원은 저장된 이름 · 올린 경기 수 · 마지막 기록(상대 시간), 7일 이상이면 빨강, 팀장은 "나(팀장)"', async function () {
    await run([
      game(OWNER, 1, taps('김', 2), { days: 1 }), game(OWNER, 9, taps('다른팀', 2), { days: 1, team_id: 'T9' }),   // 다른 팀 경기는 제외
      game(A, 2, taps('김', 2), { days: 2 }), game(A, 3, taps('김', 2), { days: 4 }), game(B, 4, taps('김', 2), { days: 9 }),
    ], [{ user_id: A, display_name: '최민준' }, { user_id: B, display_name: '박서준' }], async function () {
      var r = recorders();
      eq(r.map(function (x) { return x.name + ':' + x.c.join('/'); }), ['나(팀장):1/1일 전', '최민준:2/2일 전', '박서준:1/9일 전'], '기록자 표(마지막 기록 최신순)');
      eq(r.map(function (x) { return /cd-stale/.test(x.tr.innerHTML); }), [false, false, true], '7일 이상(9일 전)만 빨강');
      eq(summary()['기록자'], '3명', '기록자 수');
    });
  });
  test('팀장 본인의 팀 경기는 대시보드 집계에 들어가고 목록에는 나오지 않는다(조회는 team_id + user_id)', async function () {
    var rows = [game(OWNER, 1, taps('김', 2), { days: 1 }), game(A, 2, taps('김', 2), { days: 2 }), game(B, 3, taps('김', 2), { days: 3 })];
    await run(rows, [], async function () {
      eq(summary()['모인 경기'], '3', '대시보드의 모인 경기(팀장 본인 1 + 팀원 2)');
      var q = srv.log.filter(function (x) { return x.table === 'user_games' && x.op === 'select'; }).map(function (x) { return x.query; });
      ok(q.some(function (x) { return x.eq.team_id === 'T1' && x.eq.user_id === OWNER && !Object.keys(x.neq).length; }), '팀장 본인 경기 조회(team_id = 우리 팀 · user_id = 나)가 없음: ' + JSON.stringify(q));
      ok(q.some(function (x) { return x.neq.user_id === OWNER; }), '팀원 경기 조회는 그대로(neq user_id)');
    });
    await run(rows, [], async function () {
      eq($$('.tg-row').length, 2, '목록에는 팀원 경기만(팀장 본인 경기 제외)');
    }, false);
  });
  test('같은 경기가 자동저장본(sl_auto_) · 저장본으로 두 행에 올라와도 한 경기, 타석은 한 번만 센다', async function () {
    var shared = taps('김민수', 2), more = taps('김민수', 1);
    await run([
      game(A, 1, shared, { key: 'sl_auto_1790000000001', days: 2 }),
      game(A, 2, shared.concat(more), { key: 'sl_17900000100002', days: 1 }),
    ], [], async function () {
      eq(summary()['모인 경기'], '1', '같은 경기(타석 id 공유)는 한 경기');
      eq(players()[0].c.slice(0, 2), ['1', '3'], '김민수 G · PA — 더 많이 담긴 저장본 기준, 이중 집계 없음');
    });
  });
  test('경기가 없으면 안내만 보이고, 팀장 본인 경기 조회에 실패하면 팀원 경기만으로 집계하며 그 사실을 알린다', async function () {
    await run([], [], async function () { ok(/대시보드에 쓸 경기가 없어요/.test(text('.tg-msg')), '빈 상태 안내: ' + text('.tg-body') + text('.tg-modal')); });
    await owner([game(A, 1, taps('김민수', 3)), game(OWNER, 2, taps('이영호', 3))], []);
    srv.failRead = function (rows, table, q) { return table === 'user_games' && q.f.user_id === OWNER ? { status: 500, code: 'XX000', message: 'internal error' } : null; };
    try {
      await open(true);
      ok(/팀원 경기만으로 집계/.test(text('.cd-warn')), '조회 실패 안내가 없음: ' + text('.cd-warn'));
      eq(players().map(function (x) { return x.name; }), ['김민수'], '팀원 경기로는 집계됨(팀장 본인 경기는 빠짐)');
    } finally { srv.failRead = null; close(); }
  });
  test('최근 50경기까지만 집계하고(팀원 + 팀장 본인 합쳐서 수정 시각 최신순), 목록 모드에서는 팀장 본인 경기를 조회하지 않는다', async function () {
    var rows = [], i;
    for (i = 1; i <= 55; i++) rows.push(game(A, i, taps('김민수', 1), { days: 2 + i / 100 }));         // 팀원 55경기(서버는 최신 50개만 준다)
    for (i = 1; i <= 5; i++) rows.push(game(OWNER, 100 + i, taps('이영호', 1), { days: 1 + i / 100 })); // 팀장 본인 5경기(모두 더 최신)
    await run(rows, [], async function () {
      eq(summary()['모인 경기'], '50', '합쳐서 최근 50경기');
      ok(recorders().some(function (r) { return r.name === '나(팀장)' && r.c[0] === '5'; }), '더 최신인 팀장 본인 5경기는 모두 들어감');
    });
    await run(rows, [], async function () {
      var own = function () { return srv.log.filter(function (x) { return x.table === 'user_games' && x.query && x.query.eq.user_id === OWNER; }).length; };
      eq(own(), 0, '목록 모드에서는 팀장 본인 경기를 조회하지 않음');
      document.querySelector('#teamGamesModal .tg-tab[data-m="board"]').click(); await sleep(300);
      eq(own(), 1, '대시보드로 처음 전환할 때 한 번 조회');
    }, false);
  });
  test('1024px 이상이면 대시보드가 기본, 좁으면 목록이 기본이고 둘은 전환할 수 있다', async function () {
    var rows = [game(A, 1, taps('김민수', 3))];
    await run(rows, [], async function () {
      eq(text('.tg-tab[aria-selected="true"]'), '대시보드', '넓은 화면의 기본');
      ok(document.querySelector('#teamGamesModal .cd-sum'), '대시보드가 안 보임');
      document.querySelector('#teamGamesModal .tg-tab[data-m="list"]').click(); await sleep(50);
      ok(document.querySelector('#teamGamesModal .tg-row') && !document.querySelector('#teamGamesModal .cd-sum'), '목록으로 전환되지 않음');
    });
    await run(rows, [], async function () {
      eq(text('.tg-tab[aria-selected="true"]'), '목록', '좁은 화면의 기본');
      ok(document.querySelector('#teamGamesModal .tg-row'), '목록이 안 보임');
      document.querySelector('#teamGamesModal .tg-tab[data-m="board"]').click(); await sleep(300);
      ok(document.querySelector('#teamGamesModal .cd-sum'), '대시보드로 전환되지 않음');
    }, false);
  });
  test('읽기 전용: 열기 · 전환 · 선수 선택에서 localStorage 쓰기 0회 · 서버 쓰기 0건 · 앱의 현재 경기(AS) 그대로', async function () {
    var proto = Storage.prototype, orig = { s: proto.setItem, r: proto.removeItem, c: proto.clear }, writes = [];
    var abs0 = AS.abs, len0 = abs0.length, key0 = window._curSaveKey;
    try {
      await owner([game(A, 1, taps('김민수', 4)), game(OWNER, 2, taps('이영호', 4))], []);
      proto.setItem = function (k) { writes.push('set ' + k); return orig.s.apply(this, arguments); };
      proto.removeItem = function (k) { writes.push('remove ' + k); return orig.r.apply(this, arguments); };
      proto.clear = function () { writes.push('clear'); return orig.c.apply(this, arguments); };
      await open(true);
      pickWho('김민수'); pickWho('');
      document.querySelector('#teamGamesModal .tg-tab[data-m="list"]').click(); await sleep(50);
      document.querySelector('#teamGamesModal .tg-tab[data-m="board"]').click(); await sleep(100);
      eq(writes, [], 'localStorage 쓰기');
      eq(srv.log.filter(function (x) { return x.op !== 'select'; }), [], '서버 쓰기 · rpc');
      ok(AS.abs === abs0 && AS.abs.length === len0 && window._curSaveKey === key0, '앱의 현재 경기(AS)가 바뀜');
    } finally { proto.setItem = orig.s; proto.removeItem = orig.r; proto.clear = orig.c; close(); }
  });
  test('이름에 <script> · <img onerror> 가 있어도(선수 · 기록자 · 상대) 실행되지 않고 글자 그대로 보인다', async function () {
    var IMG = '<img src=x onerror="window.__xss=1">', SCR = '<script>window.__xss=1</script>';
    delete window.__xss;
    await run([game(A, 1, taps(IMG + '김', 10).concat(taps(SCR, 3)), { ta: SCR })], [{ user_id: A, display_name: SCR + '민준' }], async function () {
      await sleep(100);
      eq(window.__xss, undefined, '태그가 실행됨');
      eq(document.querySelectorAll('#teamGamesModal script, #teamGamesModal img').length, 0, '창 안에 script · img 요소가 생김');
      ok(text('.cd-main').indexOf(IMG) >= 0, '선수 이름이 글자 그대로 보여야 함');
      ok(text('.cd-small').indexOf(SCR) >= 0, '기록자 이름이 글자 그대로 보여야 함');
      pickWho(IMG + '김'); await sleep(50);
      eq(window.__xss, undefined, '선수를 고른 뒤에도 태그가 실행되면 안 됨');
    });
  });
})();
