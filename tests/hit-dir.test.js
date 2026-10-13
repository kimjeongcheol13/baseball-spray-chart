// 데이터 정합성 3단계 검증 (core.js hit-dir · schema-migrate v3, batdata.js, xlsxreport.js)
//  · 방향 = 좌표에서만 계산한 필드 5구역(좌 <54 · 좌중 54~72 · 중 72~108 · 우중 108~126 · 우) · 당겨/센터/밀어는 구역 + 라인업 bh 로 계산
//  · 좌/우타 = 라인업 bh 하나(빈 값 = 우타 가정) · 스위치는 당겨/밀어 분류 안 함(필드 기준 좌/중/우)
//  · 시간순(경기 날짜 · 이닝) · 경기 경고 2종(초/말 섞임 · 같은 이닝 3타석) · 추정 거리(m) · 마이그레이션 v3(sl_migr_v3 백업)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;

  function snapLS() { var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }
  function restoreLS(o) {
    var now = []; for (var i = 0; i < localStorage.length; i++) now.push(localStorage.key(i));
    now.forEach(function (k) { if (!(k in o)) localStorage.removeItem(k); });
    Object.keys(o).forEach(function (k) { if (localStorage.getItem(k) !== o[k]) localStorage.setItem(k, o[k]); });
  }
  // 앱 상태를 비우고 돌린 뒤 통째로 되돌린다 (localStorage 포함)
  function run(name, fn) {
    test(name, async function () {
      var S = { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, team: AS.curTeam, batter: AS.batter, cps: AS.currentPitches, sk: window._curSaveKey,
        inn: $('innSel') ? $('innSel').selectedIndex : 0, ls: snapLS() };
      var sync0 = window.cloudAutoSyncRecord, cs0 = window.cloudSave;
      window.cloudAutoSyncRecord = function () {}; window.cloudSave = function () {};
      try {
        AS.abs = []; AS.home_lineup = []; AS.away_lineup = []; AS.curTeam = 'home'; AS.batter = null; AS.currentPitches = []; window._curSaveKey = null;
        await fn();
      } finally {
        clearTimeout(window._autoTimer);
        AS.abs = S.abs; AS.home_lineup = S.hl; AS.away_lineup = S.al; AS.curTeam = S.team; AS.batter = S.batter; AS.currentPitches = S.cps; window._curSaveKey = S.sk;
        if ($('innSel')) $('innSel').selectedIndex = S.inn;
        restoreLS(S.ls);
        window.cloudAutoSyncRecord = sync0; window.cloudSave = cs0;
        try { closeOverlay('editRecOverlay'); } catch (e) {}
        try { renderLP(); renderRecs(); renderCount(); } catch (e) {}
      }
    });
  }
  // 필드 탭과 같은 저장 좌표(각도 deg, 홈에서 거리 dist) — core _coneToSemi 와 같은 식
  function xy(deg, dist) { var ang = deg * Math.PI / 180 - Math.PI; dist = dist || 0.6; return { x: 0.5 + Math.cos(ang) * dist, y: 1 + Math.sin(ang) * dist }; }
  var id0 = 88000;
  function ab(bid, bname, res, deg, inn, extra) {
    var p = deg == null ? { x: null, y: null } : xy(deg);
    return Object.assign({ id: ++id0, bid: bid, bname: bname, bnum: '', team: 'home', res: res, pt: null, zone: null, rbi: 0,
      x: p.x, y: p.y, deg: deg, dir: null, ft: deg == null ? null : 300, inn: inn || '1회말', ts: '10:00', count: { b: 0, s: 0, o: 0 }, pitches: [] }, extra || {});
  }

  test('방향 5구역 경계(54 · 72 · 108 · 126)와 라벨 — 좌표 왕복(필드 탭과 같은 식)에도 경계가 뒤집히지 않는다', function () {
    eq([53.9, 54, 71.99, 72, 90, 108, 108.01, 125.99, 126, 170].map(_dirCode), ['LF', 'LC', 'LC', 'CF', 'CF', 'CF', 'RC', 'RC', 'RF', 'RF'], '경계');
    eq(['LF', 'LC', 'CF', 'RC', 'RF', null].map(function (d) { return _dirLbl(d); }), ['좌', '좌중', '중', '우중', '우', ''], '라벨');
    [0.5, 10, 53.999, 54, 71.999, 72, 90, 108, 108.001, 126, 179].forEach(function (d) {
      eq(_dirCode(_hitDeg(xy(d))), _dirCode(d), d + '° 좌표 왕복');
    });
    eq(_hitDeg({ x: 0.5, y: 0.55 }), 90, '내야안타 기본 좌표 = 중앙');
    eq([_hitDeg({ x: null, y: 0.3 }), _hitDeg({}), _hitDeg({ x: '', y: '' })], [null, null, null], '좌표 없으면 null');
  });

  test('당겨/센터/밀어 = 구역 + 좌/우타: 우타·미지정 당김 = 좌·좌중 · 좌타 당김 = 우중·우 · 스위치는 분류 안 함(필드 기준 좌/중/우)', function () {
    var A = function (deg, b) { return { deg: deg, bats: b }; };
    eq([A(71.9, 'R'), A(72, 'R'), A(108, 'R'), A(108.1, 'R')].map(_pullLbl), ['당김', '센터', '센터', '밀어'], '우타 경계(예전 _isPull 과 같음)');
    eq([A(40, null), A(140, null)].map(_pullLbl), ['당김', '밀어'], '미지정 = 우타 가정');
    eq([A(40, 'L'), A(90, 'L'), A(140, 'L')].map(_pullLbl), ['밀어', '센터', '당김'], '좌타 = 우측이 당김');
    eq([A(40, 'S'), A(90, 'S'), A(140, 'S')].map(_pullLbl), ['좌', '중', '우'], '스위치 = 필드 기준');
    ok(!_isPull(A(40, 'S')) && !_isOppo(A(140, 'S')) && !_isCtr(A(90, 'S')) && !_dirClassified(A(90, 'S')), '스위치는 당겨/센터/밀어 모집단에서 빠짐');
    eq(_pullLbl({ deg: null, bats: 'R' }), '', '방향 없음');
  });

  test('당겨/센터/밀어 비율이 예전 집계(deg<72 · deg>108, 좌타 반대)와 같다 — 무작위 타구 500개(시드 고정)', async function () {
    var B = await import('/js/features/batdata.js?v=10');
    var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var abs = [];
    for (var i = 0; i < 500; i++) {
      var d = rnd() * 180, b = rnd() < 0.3 ? 'L' : rnd() < 0.5 ? 'R' : null, p = xy(d, 0.2 + rnd() * 0.75);
      var a = { res: '안타', x: p.x, y: p.y, bats: b };
      _hitSyncAb(a, []);   // 좌표 → deg · dir (라인업 없음: bats 그대로)
      abs.push(a);
    }
    var old = { pull: 0, center: 0, oppo: 0 };
    abs.forEach(function (a) { var L = a.bats === 'L', d = a.deg; if (L ? d > 108 : d < 72) old.pull++; else if (L ? d < 72 : d > 108) old.oppo++; else old.center++; });
    var s = B.calcStats(abs);
    eq([s.dn, s.pull, s.center, s.oppo], [500, old.pull, old.center, old.oppo], '같은 개수');
  });

  run('저장할 때 맞춤(updateAll): 좌표 → 방향 · 각도, 좌표 없는 옛 수정값은 null, 라인업 bh → 타석 좌/우타(빈 값 = null) · 수정 창 방향은 읽기 전용', async function () {
    AS.home_lineup = [{ id: 'h1', name: '우타자', num: '1', pos: '', bh: 'R', isStarter: true }, { id: 'h2', name: '모름', num: '2', pos: '', bh: '', isStarter: true },
      { id: 'h3', name: '좌타자', num: '3', pos: '', bh: 'L', isStarter: true }, { id: 'h4', name: '스위치', num: '4', pos: '', bh: 'S', isStarter: true }];
    var a1 = ab('h1', '우타자', '안타', 75), a2 = ab('h2', '모름', '병살', null), a3 = ab('h3', '좌타자', '2루타', 130), a4 = ab('h4', '스위치', '안타', 30);
    a1.dir = 'LC'; a1.deg = 75; a1.bats = 'R';   // 옛 라벨(54~78 = LC)
    a2.dir = 'LF'; a2.deg = 36; a2.bats = 'R';   // 즉시 기록 버튼 타석에 수정 창에서 방향만 골랐던 옛 값(좌표 없음)
    a3.bats = 'R'; a4.bats = 'R';                // 예전엔 기본값 'R' 로 저장됐다
    AS.abs = [a1, a2, a3, a4];
    updateAll();
    eq([a1.dir, Math.round(a1.deg)], ['CF', 75], '좌표 기준 중(72~108)');
    eq([a2.dir, a2.deg], [null, null], '좌표 없으면 방향 null');
    eq([a1.bats, a2.bats, a3.bats, a4.bats], ['R', null, 'L', 'S'], '타석 좌/우타 = 라인업 bh');
    eq([_pullLbl(a1), _pullLbl(a3), _pullLbl(a4)], ['센터', '당김', '좌'], '당김/센터/밀어 · 스위치 필드 기준');
    openEditRec(a3.id);
    ok($('editDir').disabled, '수정 창 방향 읽기 전용');
    eq($('editDir').value, 'RF', '좌표에서 계산한 구역 표시');
    eq($('editDir').selectedOptions[0].textContent, '우', '라벨 우');
    closeOverlay('editRecOverlay');
    // 경기설정에서 bh 를 바꾸면 그 선수 타석도 바로 바뀐다
    AS.home_lineup[1].bh = 'L'; updateAll();
    eq(a2.bats, 'L', 'bh 변경 → 타석 bats');
  });

  // 구버전 저장 경기(v2): 옛 방향 라벨 · 좌표 없는 각도 · 타석에만 남은 좌타 정보
  function legacyV2() {
    var g = {
      th: '정합', ta: '상대', hs: 0, as: 0, d: '2026. 6. 1.', ts: 1790000000000,
      home_lineup: [{ id: 'm1', name: '공유좌타', num: '1', bh: 'R' }, { id: 'm2', name: '진짜우타', num: '2', bh: 'R' }, { id: 'm3', name: '모름', num: '3', bh: '' }],
      away_lineup: [], pitchers: [],
      abs: [ab('m1', '공유좌타', '안타', 75, '1회말', { dir: 'LC', bats: 'L' }), ab('m1', '공유좌타', '땅볼 아웃', 140, '3회말', { dir: 'RF', bats: 'L' }),
        ab('m2', '진짜우타', '안타', 100, '1회말', { dir: 'CF', bats: 'R' }), ab('m3', '모름', '병살', null, '2회말', { dir: 'LF', deg: 36, bats: 'R' }),
        ab('m3', '모름', '삼진', null, '4회말', { bats: 'R' })],
    };
    return g;
  }
  test('마이그레이션 v3: 좌표에서 방향 다시 계산(없으면 null) · 옛 라벨 sl_migr_v3 백업 · 타석에만 있던 좌타를 bh 로 · 한 번만(멱등)', function () {
    var ls = snapLS();
    try {
      localStorage.setItem('sl_900000000020', JSON.stringify(legacyV2()));
      localStorage.setItem('sl_saves', JSON.stringify((JSON.parse(ls.sl_saves || '[]')).concat([{ key: 'sl_900000000020', label: '정합 vs 상대', ts: 1790000000000 }])));
      localStorage.setItem('sl_schema_ver', '2'); localStorage.removeItem('sl_migr_v3');
      var r = _hitMigrateStored();
      ok(r && r.games >= 1 && !r.fail, '변환 ' + JSON.stringify(r));
      eq(localStorage.getItem('sl_schema_ver'), '3', '스키마 버전 3');
      var d = JSON.parse(localStorage.getItem('sl_900000000020')), A = d.abs;
      eq(d.home_lineup.map(function (p) { return p.bh; }), ['L', 'R', ''], 'bh: 타석이 모두 L → L, 진짜 R 유지, 빈 값 유지');
      eq(A.map(function (a) { return a.dir; }), ['CF', 'RF', 'CF', null, null], '방향: 좌표 기준 · 좌표 없으면 null');
      eq(A.map(function (a) { return a.bats; }), ['L', 'L', 'R', null, null], '타석 좌/우타 = bh');
      var bak = JSON.parse(localStorage.getItem('sl_migr_v3')).list.filter(function (x) { return x.k === 'sl_900000000020'; });
      eq(bak.map(function (x) { return [x.dir, x.deg == null ? null : Math.round(x.deg)]; }), [['LC', 75], ['LF', 36]], '바뀐 옛 라벨만 백업(같은 값 · 둘 다 없음은 제외)');
      eq(_hitMigrateStored(), null, '두 번째는 버전으로 건너뜀');
      localStorage.setItem('sl_schema_ver', '2');
      var r2 = _hitMigrateStored();
      eq([r2.overwritten], [0], '다시 돌려도 방향이 바뀌는 타석 없음(멱등)');
    } finally { restoreLS(ls); }
  });

  test('경기 경고 2종: 같은 선수 타석에 초/말 섞임(적은 쪽 표시, 같으면 모두) · 같은 선수 같은 이닝 3타석 이상(모두 표시)', function () {
    var a = [ab('w1', '갑', '안타', 90, '1회초'), ab('w1', '갑', '안타', 90, '2회말'), ab('w1', '갑', '안타', 90, '2회말'), ab('w1', '갑', '안타', 90, '2회말'),
      ab('w2', '을', '안타', 90, '1회초'), ab('w2', '을', '안타', 90, '1회말'), ab('w3', '병', '안타', 90, '3회말'), ab('w3', '병', '안타', 90, '5회말')];
    var m = _gameWarnMap(a);
    eq(m[a[0].id], ['같은 경기 이 선수 타석에 초/말이 섞임 (초 1 · 말 3)'], '갑: 적은 쪽(초) 표시');
    eq(m[a[1].id], ['2회말에 이 선수 타석 3개'], '갑: 같은 이닝 3타석');
    eq([!!m[a[4].id], !!m[a[5].id]], [true, true], '을: 초 1 · 말 1 → 둘 다');
    eq([m[a[6].id], m[a[7].id]], [undefined, undefined], '병: 정상');
    eq(_abWarn(a[1], m), ['2회말에 이 선수 타석 3개'], '_abWarn = 타석 경고 + 경기 경고');
  });

  run('기록 화면: 경기 경고도 「확인 필요」로 표시 (저장은 그대로)', async function () {
    AS.home_lineup = [{ id: 'r1', name: '경고타자', num: '9', pos: '', bh: 'R', isStarter: true }];
    AS.abs = [ab('r1', '경고타자', '안타', 80, '1회초'), ab('r1', '경고타자', '안타', 80, '3회말'), ab('r1', '경고타자', '안타', 80, '5회말')];
    updateAll(); renderRecs();
    var t = $('recList').textContent;
    ok(/확인 필요 · 같은 경기 이 선수 타석에 초\/말이 섞임 \(초 1 · 말 2\)/.test(t), '타석 목록 — ' + t);
    eq(AS.abs.length, 3, '저장은 그대로');
  });

  // 무압축(STORE) xlsx → { 시트 이름: [[셀 값…]…] }
  async function readXlsx(blob) {
    var u8 = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(u8.buffer), files = {}, i = 0, dec = new TextDecoder();
    while (i + 30 <= u8.length && dv.getUint32(i, true) === 0x04034b50) {
      var size = dv.getUint32(i + 18, true), nl = dv.getUint16(i + 26, true), xl = dv.getUint16(i + 28, true);
      files[dec.decode(u8.subarray(i + 30, i + 30 + nl))] = u8.subarray(i + 30 + nl + xl, i + 30 + nl + xl + size);
      i += 30 + nl + xl + size;
    }
    var P = new DOMParser(), out = {};
    var wb = P.parseFromString(dec.decode(files['xl/workbook.xml']), 'application/xml');
    [].forEach.call(wb.getElementsByTagName('sheet'), function (sh, k) {
      var x = P.parseFromString(dec.decode(files['xl/worksheets/sheet' + (k + 1) + '.xml']), 'application/xml');
      out[sh.getAttribute('name')] = [].map.call(x.getElementsByTagName('row'), function (row) {
        var r = [];
        [].forEach.call(row.getElementsByTagName('c'), function (c) {
          var col = c.getAttribute('r').replace(/\d+/g, ''), ci = 0;
          for (var j = 0; j < col.length; j++) ci = ci * 26 + col.charCodeAt(j) - 64;
          var t = c.getElementsByTagName('t')[0], v = c.getElementsByTagName('v')[0];
          r[ci - 1] = t ? t.textContent : v ? +v.textContent : '';
        });
        return r;
      });
    });
    return out;
  }
  async function exportOf(name) {
    var B = await import('/js/features/batdata.js?v=10'), X = await import('/js/features/xlsxreport.js?v=14');
    var blob = null, u0 = URL.createObjectURL;
    URL.createObjectURL = function (b) { blob = b; return u0.call(URL, b); };
    try { X.exportBatterXlsx(B.playerData(B.buildData(), name)); } finally { URL.createObjectURL = u0; }
    return readXlsx(blob);
  }
  function stored(key, g) {
    localStorage.setItem(key, JSON.stringify(g));
    localStorage.setItem('sl_saves', JSON.stringify((JSON.parse(localStorage.getItem('sl_saves') || '[]')).concat([{ key: key, label: g.th + ' vs ' + g.ta, ts: g.ts }])));
  }

  run('시간순: 경기는 경기 날짜(경기 정보 날짜 → 저장 날짜) 오래된 순 · 경기 안 타석은 이닝 → 기록 순 · 엑셀 기간 · 경기별 표 · 누적 타율 · 타석/투구 시트도', async function () {
    var L = [{ id: 't1', name: '시간타자', num: '5', bh: '' }];
    // 저장 시각(ts)은 6.7 경기가 먼저지만 경기 날짜는 5.17 이 먼저
    stored('sl_900000000031', { th: '나중', ta: 'B', d: '2026. 6. 7.', ts: 1790000000000, home_lineup: L, away_lineup: [], pitchers: [],
      abs: [ab('t1', '시간타자', '삼진', null, '1회말'), ab('t1', '시간타자', '삼진', null, '3회말')] });
    stored('sl_900000000032', { th: '먼저', ta: 'A', d: '2026. 10. 13.', info: { date: '2026-05-17' }, ts: 1790500000000, home_lineup: L, away_lineup: [], pitchers: [],
      abs: [ab('t1', '시간타자', '안타', 90, '5회말', { pitches: [{ seq: 1, pt: '직구', zone: '중앙 중간', result: 'in_play' }] }), ab('t1', '시간타자', '안타', 40, '1회말', { pt: '직구' }), ab('t1', '시간타자', '2루타', 140, '3회말', { pt: '커브' })] });   // 구종이 있어야 투구 기록 시트에 결정구 1행
    var B = await import('/js/features/batdata.js?v=10');
    var P = B.playerData(B.buildData(), '시간타자');
    eq(P.gameList.map(function (g) { return g.label; }), ['2026. 5. 17. 먼저 vs A', '2026. 6. 7. 나중 vs B'], '경기 순서 · 이름은 경기 날짜');
    eq(P.gameList[0].abs.map(function (a) { return a.inn; }), ['1회말', '3회말', '5회말'], '경기 안 이닝 순');
    eq(P.trend.map(function (t) { return Math.round(t.avg * 1000); }), [1000, 600], '누적 타율 시간순(3/3 → 3/5)');
    var wb = await exportOf('시간타자');
    ok(String(wb['리포트'][1][0]).indexOf('2026. 5. 17. 먼저 vs A ~ 2026. 6. 7. 나중 vs B') >= 0, '기간: 오래된 → 최신 — ' + wb['리포트'][1][0]);
    var rec = wb['타석 기록'].slice(1);
    eq(rec.map(function (r) { return r[2]; }), ['1회말', '3회말', '5회말', '1회말', '3회말'], '타석 기록 시트: 경기 → 이닝 순');
    var gt = wb['리포트'].filter(function (r) { return /먼저 vs A|나중 vs B/.test(String(r[0])) && typeof r[3] === 'number'; });   // 표 행만(부제목 줄 제외)
    eq(gt.map(function (r) { return [String(r[0]).slice(0, 13), r[11]]; }), [['2026. 5. 17. ', 1], ['2026. 6. 7. 나', 0.6]], '경기별 기록 표 · 누적 타율');
    eq(wb['투구 기록'].slice(1).map(function (r) { return r[3]; }), ['1회말', '3회말', '5회말'], '투구 기록 시트도 이닝 순');
  });

  run('엑셀: 방향 = 5구역 라벨 · 추정 거리(m) = ft × 0.3048 반올림 · 우타 가정 배지(부제목 · 타구 분포 · 핫/콜드 제목) · 스위치는 좌/중/우', async function () {
    stored('sl_900000000041', { th: '거리', ta: 'C', d: '2026. 7. 1.', ts: 1790000000000, pitchers: [], away_lineup: [],
      home_lineup: [{ id: 'e1', name: '가정타자', num: '1', bh: '' }, { id: 'e2', name: '스위치타', num: '2', bh: 'S' }],
      abs: [ab('e1', '가정타자', '안타', 30, '1회말', { ft: 328 }), ab('e1', '가정타자', '안타', 100, '2회말', { ft: 250 }), ab('e2', '스위치타', '안타', 30, '1회말'), ab('e2', '스위치타', '안타', 150, '3회말')] });
    var wb = await exportOf('가정타자');
    var rec = wb['타석 기록'];
    eq(rec[0][6] + '|' + rec[0][7], '방향|추정 거리(m)', '머리글');
    eq(rec.slice(1).map(function (r) { return [r[6], r[7]]; }), [['좌', 100], ['중', 76]], '방향 라벨 · 거리 m');
    ok(/우타 가정/.test(wb['리포트'][1][0]), '리포트 부제목 — ' + wb['리포트'][1][0]);
    ok(/우타 가정/.test(wb['타구 차트'][1][0]), '타구 분포 제목 줄 — ' + wb['타구 차트'][1][0]);
    ok(/우타 가정/.test(wb['핫콜드존'][1][0]), '핫/콜드 제목 줄 — ' + wb['핫콜드존'][1][0]);
    var sw = await exportOf('스위치타');
    ok(/스위치 · 방향 미분류/.test(sw['리포트'][1][0]), '스위치 배지');
    var hdr = sw['리포트'].find(function (r) { return r[0] === '삼진%'; });
    eq(hdr.slice(4, 8), ['좌%', '중%', '우%', '방향 기록'], '스위치: 필드 기준 좌/중/우');
    eq(_ftM(328), 100, '_ftM'); eq(_ftM(null), '', '거리 없음');
  });

  test('공유 링크 좌/우타: 새 링크는 h(bh) · 예전 링크는 그 선수 타석 ba 가 모두 L(또는 S)일 때만 · R 은 모름', function () {
    eq(_shareBh({ id: 1, h: 'L' }, []), 'L', 'h');
    eq(_shareBh({ id: 5, n: '갑' }, [{ bid: 5, ba: 'L' }, { bid: 5, ba: 'L' }]), 'L', '예전 링크 · 모두 L');
    eq(_shareBh({ id: 5, n: '갑' }, [{ bid: 5, ba: 'L' }, { bid: 5, ba: 'R' }]), '', '섞이면 모름');
    eq(_shareBh({ id: 6, n: '을' }, [{ bid: 6, ba: 'R' }]), '', "R 은 기본값이라 모름(예전엔 'R' 고정)");
  });
})();
