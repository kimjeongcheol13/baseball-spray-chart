// 게임원 앱 스크린샷으로 채우기(js/features/gameoneocr.js) — 사진 → 글줄 · 글 덩어리 → 머리글 칸 → 원정 · 홈 타자 표 칸
//  · CI 에서는 실제 Tesseract 를 못 받는다 → 앱 화면을 닮은 그림을 canvas 로 그리고, '글자 읽기'는 그린 글자를 위치로 돌려주는 가짜로 바꾼다
//    (실제 앱 캡처 5장 · 실제 Tesseract 로는 9명 · 30칸 · 타자 표 대조 모두 맞음 — 2026-10-19 로컬 확인, 캡처는 실명이라 저장소에 두지 않음)
//  · 머리글(1회 · 타수)로 칸 위치 → 머리글 없는 장(아래로 내려 찍은 장)은 같은 폭 사진의 머리글 · 겹쳐 찍힌 줄은 한 번 · 타순 순서
//  · 타자 표가 있으면 타수 · 안타 · 사사구 · 삼진으로 읽은 칸을 맞춰 보고, 다르거나 빠진 줄을 알린다
//  · 화면: 원정 · 홈 버튼 → 사진 고르기 → 그 팀 칸에 글로 채우고 미리보기 → 저장은 붙여넣기와 같은 길 · Tesseract 는 누를 때만 불러온다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var W = 1200, INN = [400, 520, 640, 760], STAT = [400, 480, 560, 640, 720, 800, 880, 960, 1060];
  function O() { return window.SLGameOneOcr; }

  // 앱 화면을 닮은 그림: 줄마다 [x 가운데, 글] — 회색 구분선 · 위쪽 상태 표시줄도 그린다
  function draw(lines, px) {
    var c = document.createElement('canvas'); c.width = W; c.height = 80 + lines.length * 90;
    var g = c.getContext('2d'), items = [];
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.font = (px || 24) + 'px sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = '#222'; g.fillText('9:35', 60, 24);
    items.push({ x0: 60 - g.measureText('9:35').width / 2, x1: 60 + g.measureText('9:35').width / 2, y: 24, text: '9:35' });
    lines.forEach(function (ln, i) {
      var y = 90 + i * 90;
      g.fillStyle = '#e5e5e5'; g.fillRect(40, y + 40, W - 80, 2);
      ln.forEach(function (it) {
        if (!it[1]) return;
        g.fillStyle = it[2] || '#222'; g.fillText(it[1], it[0], y);
        var w = g.measureText(it[1]).width; items.push({ x0: it[0] - w / 2, x1: it[0] + w / 2, y: y, text: it[1] });
      });
    });
    var d = g.getImageData(0, 0, c.width, c.height);
    // 가짜 글자 읽기: 덩어리 안에 가운데가 들어오는 글자들을 x 순서로
    function rec(x0, y0, x1, y1) {
      return Promise.resolve(items.filter(function (t) { var cx = (t.x0 + t.x1) / 2; return cx >= x0 - 2 && cx <= x1 + 2 && t.y >= y0 - 4 && t.y <= y1 + 4; })
        .sort(function (a, b) { return a.x0 - b.x0; }).map(function (t) { return t.text; }).join(''));
    }
    return { img: { width: d.width, height: d.height, data: d.data }, rec: rec };
  }
  function innHead() { return [[60, '타순'], [170, '타자명'], [290, '포지션']].concat(INN.map(function (x, i) { return [x, (i + 1) + '회']; })); }
  function innRow(o, name, pos, cells) { return [[60, String(o)], [170, name], [290, pos, '#888']].concat(INN.map(function (x, i) { return [x, cells[i + 1] || '']; })); }
  function statHead() { return [[60, '타순'], [170, '타자명'], [290, '포지션']].concat(['타수', '안타', '타점', '홈런', '사사구', '도루', '득점', '삼진', '타율'].map(function (h, i) { return [STAT[i], h]; })); }
  function statRow(o, name, pos, v) { return [[60, String(o)], [170, name], [290, pos, '#888']].concat(v.map(function (s, i) { return [STAT[i], String(s)]; })); }

  // 원정 한 팀: 경기기록 2장(둘째 장은 머리글 없음 · 나선수 줄이 겹침) + 타자 표 1장(나선수 타수 일부러 틀림 · 라선수는 경기기록에 없음)
  var A = function () { return draw([innHead(), innRow(1, '가선수(11)', 'P', { 1: '중플', 3: '좌안,도루' }), innRow(2, '나선수(22)', 'RF', { 2: '4구', 4: '유땅' })]); };
  var B = function () { return draw([innRow(2, '나선수(22)', 'RF', { 2: '4구', 4: '유땅' }), innRow(3, '다선수(33)', 'SS', { 1: '삼진', 4: '우월3' })]); };
  var S = function () {
    return draw([statHead(), statRow(1, '가선수(11)', 'P', [2, 1, 0, 0, 0, 1, 1, 0, '.500']), statRow(2, '나선수(22)', 'RF', [2, 0, 0, 0, 1, 0, 0, 0, '.000']),
      statRow(3, '다선수(33)', 'SS', [2, 1, 1, 0, 0, 0, 1, 1, '.500']), statRow(4, '라선수(44)', 'C', [1, 0, 0, 0, 0, 0, 0, 1, '.000'])]);
  };
  async function pipeline(shots) {
    var read = [];
    for (var i = 0; i < shots.length; i++) read.push(await O().readShot(shots[i].img, shots[i].rec));
    var heads = read.filter(function (s) { return s.head; }), placed = read.map(function (s) { return O().placeShot(s, heads); }).filter(function (s) { return s.kind; });
    var m = O().mergeShots(placed);
    var sc = read.map(function (s) { return s.score; }).filter(Boolean)[0];
    return { text: O().toText(m), rows: m.rows, statsOnly: m.statsOnly, checks: O().checkStats(m), gaps: O().orderGaps(m.rows), scoreText: sc ? O().toScoreText(sc) : '', shots: placed.length, files: shots.length, read: read };
  }
  // 앱 맨 위 점수판: 1 … 7 · R H E B · 선공 / 후공 줄 · 진행 안 한 회는 '-' (위아래로 제목 · 게임 요약 줄)
  var BX = [200, 265, 330, 395, 460, 525, 590], BS = [675, 732, 789, 846];
  function board() {
    function row(lab, inn, sum) { return [[128, lab]].concat(BX.map(function (x, i) { return [x, inn[i] == null ? '-' : String(inn[i])]; }), BS.map(function (x, i) { return [x, String(sum[i])]; })); }
    return draw([[[180, '박스 스코어']], BX.map(function (x, i) { return [x, String(i + 1)]; }).concat(BS.map(function (x, i) { return [x, 'RHEB'[i]]; })),
      row('선공', [1, 1, 4, 0, 2], [8, 10, 0, 5]), row('후공', [2, 3, 1, 5], [11, 8, 0, 8]), [[300, '게임 요약']]]);
  }
  var SCORE = 'Team\t1\t2\t3\t4\t5\t6\t7\tR\tH\tE\tB\n원정팀\t1\t1\t4\t0\t2\t-\t-\t8\t10\t0\t5\n홈팀\t2\t3\t1\t5\t-\t-\t-\t11\t8\t0\t8';

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다 · Tesseract 는 아직 안 불러옴', async function () {
    await T.sleep(2500);
    ok(O() && window.gameOneShotPick && window.gameOneShotFiles, '모듈 로드');
    ok(!document.querySelector('script[src*="tesseract"]') && !window.Tesseract, '페이지 열 때는 글자 읽기 도구를 받지 않는다');
    ok(/^assets\/ocr\/$/.test(O().TESS.lang) && /tesseract\.js@5\.1\.1\//.test(O().TESS.src), '모델은 저장소(assets/ocr) · 엔진은 버전 고정');
  });

  test('한 장: 글줄 · 덩어리 → 머리글(타순 · 타자명 · 1회 …) → 줄마다 타순 · 이름(번호) · 회별 칸 · 상태 표시줄 · 구분선은 무시', async function () {
    var a = A(), s = await O().readShot(a.img, a.rec);
    ok(s.head && s.head.kind === 'inning', '경기기록 머리글');
    eq(s.head.cols.map(function (c) { return c.key; }), ['order', 'name', 'pos', 'inn1', 'inn2', 'inn3', 'inn4'], '칸 이름');
    var p = O().placeShot(s, []);
    eq(p.rows.map(function (r) { return [r.order, r.name, r.number, r.pos, r.inn]; }),
      [[1, '가선수', '11', 'P', { 1: '중플', 3: '좌안,도루' }], [2, '나선수', '22', 'RF', { 2: '4구', 4: '유땅' }]], '줄');
  });

  test('머리글: 못 읽은 회는 같은 간격으로 채움(3회 → 직선) · 회를 외로 읽어도 · 이름은 머리글보다 넓어도 이름 칸', function () {
    var h = O().readHeader([{ cx: 60, text: '타순' }, { cx: 170, text: '타 자 명' }, { cx: 400, text: '1회' }, { cx: 520, text: '2외' }, { cx: 640, text: '@@' }, { cx: 760, text: '4회' }]);
    eq(h.cols.filter(function (c) { return /^inn/.test(c.key); }).map(function (c) { return [c.key, Math.round(c.cx)]; }), [['inn1', 400], ['inn2', 520], ['inn3', 640], ['inn4', 760]], '회 칸');
    eq(O().assignRow([{ cx: 60, text: '7' }, { cx: 236, text: '마선수(50)' }, { cx: 520, text: '삼진' }], h.cols), { order: '7', name: '마선수(50)', inn2: '삼진' }, '이름 · 칸');
    ok(O().readHeader([{ cx: 60, text: '게임 요약' }, { cx: 400, text: '안타' }]) === null, '이름 칸 없는 줄은 머리글 아님');
  });

  test('여러 장: 머리글 없는 장은 같은 폭 머리글 · 겹친 줄 한 번 · 고른 순서와 상관없이 타순 · 타자 표 붙임 · 글은 웹 복사 꼴', async function () {
    var r = await pipeline([S(), B(), A()]);   // 일부러 섞은 순서
    eq(r.shots, 3, '3장 모두 읽음');
    eq(r.rows.map(function (x) { return x.order + ' ' + x.name; }), ['1 가선수', '2 나선수', '3 다선수'], '타순 · 겹친 줄 한 번');
    eq(r.text.split('\n'), [
      '1\t투\t가선수(11)\t중플\t\t좌안,도루\t\t2\t1\t0\t1\t1\t.500',
      '2\t우\t나선수(22)\t\t4구\t\t유땅\t2\t0\t0\t0\t0\t.000',
      '3\t유\t다선수(33)\t삼진\t\t\t우월3\t2\t1\t1\t1\t0\t.500'], '타순 · 위치(투 · 우 · 유) · 이름(번호) · 1~4회 · 타수 안타 타점 득점 도루 타율');
    var P = window.SLGameOne.parseGameOne(r.text).players;
    eq(P.map(function (p) { return [p.order, p.position, p.name, p.number, p.atBats.map(function (a) { return a.inning + a.result; }).join(' ')]; }),
      [[1, '투', '가선수', '11', '1플라이 아웃 3안타'], [2, '우', '나선수', '22', '2볼넷 4땅볼 아웃'], [3, '유', '다선수', '33', '1삼진 43루타']], '기존 파서로 그대로 읽힘');
    eq(P.map(function (p) { return [p.stats.ab, p.stats.h]; }), [[2, 1], [2, 0], [2, 1]], '타수 · 안타 칸');
  });

  test('타자 표 대조: 읽은 칸으로 센 타수 · 안타 · 사사구 · 삼진이 다르면 알림 · 경기기록에 없는 선수 · 빠진 타순', async function () {
    var r = await pipeline([A(), B(), S()]);
    eq(r.checks, [{ order: 2, name: '나선수', number: '22', diff: [{ key: 'ab', read: 1, table: 2 }] }], '나선수 타수: 4구 · 유땅 → 1 (표 2)');
    eq(r.statsOnly.map(function (s) { return s.name + s.number; }), ['라선수44'], '타자 표에만 있는 선수');
    eq(r.gaps, [], '타순 1~3 이어짐');
    var g = await pipeline([A(), draw([innRow(4, '라선수(44)', 'C', { 1: '삼진' })])]);
    eq(g.gaps, [3], '1 · 2 · 4 → 3번 줄 빠짐');
    var none = await pipeline([B()]);
    eq([none.shots, none.rows.length], [0, 0], '머리글 있는 장이 하나도 없으면 읽지 않는다');
    var big = await O().readShot(A().img, A().rec), tiny = draw([innHead(), innRow(1, '가선수(11)', 'P', { 1: '중플' })], 8);
    var t = await O().readShot(tiny.img, tiny.rec);
    ok(big.lh >= 16 && t.lh > 0 && t.lh < 16, '글줄 높이 — 보통 ' + big.lh + 'px · 모아 찍은 화면처럼 작은 글 ' + t.lh + 'px(안내용)');
  });

  test('글자 보정: 매핑표에 없는 기록만 헷갈리는 글자(낮 → 낫 · 우 → 웃)를 바꿔 매핑표에 있게 되면 · 마침표 → 쉼표 · 맞는 기록은 그대로', function () {
    eq(['낮아웃-', '4구.도루.주자아우', '우안,도루', '좌중홈[3R100M]', '3땅', '알수없음'].map(O().fixCell),
      ['낫아웃-', '4구,도루,주자아웃', '우안,도루', '좌중홈[3R100M]', '3땅', '알수없음'], '보정');
    eq(['4구,도루', '4구.도루', '낮아웃-', ''].map(O().cellKnown), [true, false, false, true], '매핑표에 있는 칸인지');
  });

  test('겹쳐 찍힌 줄: 먼저 읽은 칸이 매핑표에 없고(아래가 잘린 줄) 나중 칸이 맞으면 나중 칸 · 투수 표는 알아보고 건너뜀(머리글 없는 장도)', async function () {
    var cut = { kind: 'inning', rows: [{ order: 8, name: '가', number: '23', pos: '', inn: { 2: '4구.도루.주자아우', 3: '우안' }, stats: null }] };
    var full = { kind: 'inning', rows: [{ order: 8, name: '가', number: '23', pos: '', inn: { 2: '4구,도루,주자아웃', 3: '우잉', 4: '투땅' }, stats: null }] };
    eq(O().mergeShots([cut, full]).rows[0].inn, { 2: '4구,도루,주자아웃', 3: '우안', 4: '투땅' }, '잘린 줄의 틀린 칸만 바꾸고, 맞는 칸(우안)은 그대로 · 빈 칸은 채움');
    var PH = [[170, '투수명'], [345, '이닝'], [455, '피안타'], [560, '실점'], [650, '자책'], [760, '사사구'], [880, '탈삼진'], [1005, '방어율']];
    function prow(name, v) { return [[170, name]].concat(v.map(function (x, i) { return [PH[i + 1][0], String(x)]; })); }
    var p1 = draw([PH, prow('가투수(16)', [3, 7, 6, 5, 2, 2, '11.67'])]), p2 = draw([prow('나투수(11)', [2, 3, 2, 1, 3, 1, '3.50'])]);
    var r = await pipeline([A(), S(), p1, p2]);
    eq(r.read.filter(function (x) { return x.head; }).map(function (x) { return x.head.kind; }), ['inning', 'stats', 'pitch'], '머리글 3종');
    eq([r.rows.length, r.statsOnly.map(function (x) { return x.name; })], [2, ['다선수', '라선수']], '투수는 못 찾은 선수로 안 셈(다 · 라선수는 이 묶음에 경기기록이 없어서)');
  });

  test('점수판: 1 2 3 … 숫자 머리글 자리 + 뒤 4칸(R H E B) · 선공 = 원정 / 후공 = 홈 · 빈 회는 - · 이닝별 점수표 글 → 기존 점수표 파서로 그대로', async function () {
    var b = board(), s = await O().readShot(b.img, b.rec);
    eq([s.head, s.score && s.score.inn.length], [null, 7], '타자 표 머리글 아님 · 회 7개');
    eq([s.score.away, s.score.home], [{ inn: ['1', '1', '4', '0', '2', '-', '-'], sum: ['8', '10', '0', '5'] }, { inn: ['2', '3', '1', '5', '-', '-', '-'], sum: ['11', '8', '0', '8'] }], '선공 · 후공 줄');
    eq(O().toScoreText(s.score), SCORE, '이닝별 점수표 칸 글');
    var sb = window.SLGameOne.parseGameOneScoreboard(SCORE);
    eq(sb.teams.map(function (t) { return [t.name, t.innings.join(''), t.r, t.h, t.e, t.b]; }), [['원정팀', '11402', 8, 10, 0, 5], ['홈팀', '2315', 11, 8, 0, 8]], '파서: 이닝 합 = R');
    eq(sb.warnings, [], '경고 없음');
    eq(O().readScoreRow([{ cx: 200, text: '1' }, { cx: 265, text: '뼈' }, { cx: 675, text: '8' }, { cx: 732, text: '1O' }], { inn: BX, sums: BS }),
      { inn: ['1', '-', '-', '-', '-', '-', '-'], sum: ['8', null, null, null] }, '숫자가 아니면 회는 - · 합계는 비움(파서가 그 줄을 안 씀)');
    var r = await pipeline([A(), board(), B(), S()]);
    eq([r.scoreText, r.rows.length], [SCORE, 3], '경기기록 · 타자 표와 같이 골라도');
  });

  test('화면: 홈팀 사진 → 고르기 → 홈 칸에 채우고 미리보기 · 안내(틀릴 수 있음 · 타자 표와 다름 · 못 찾은 선수) · GA4 · 저장', async function () {
    var r = await pipeline([A(), B(), S(), board()]), r0 = O().readFiles, ev = [], g0 = window.gtag, clicked = 0;
    O().readFiles = function (files, prog) { prog(0, files.length, 1, 2); return Promise.resolve(Object.assign({}, r, { files: files.length })); };
    window.gtag = function (k, n, p) { if (k === 'event' && n === 'gameone_shot') ev.push(p); };
    try {
      openGameOneImport();
      $('goShotFile').click = function () { clicked++; };
      ok(document.querySelectorAll('.go-shot-b').length === 2 && Array.prototype.every.call(document.querySelectorAll('.go-shot-b'), function (b) { return b.getBoundingClientRect().height >= 44; }), '원정 · 홈 버튼 44px');
      gameOneShotPick('home');
      eq(clicked, 1, '사진 고르기 창');
      await gameOneShotFiles({ files: [new File(['x'], 'a.png'), new File(['y'], 'b.png'), new File(['z'], 'c.png')] });
      eq($('goHome').value, r.text, '홈 칸에 글');
      eq($('goAway').value, '', '원정 칸은 그대로');
      var msg = $('goShotMsg').textContent;
      ok(/3장에서 3명 · 6칸/.test(msg) && /사진에서 읽은 글자는 틀릴 수 있어요/.test(msg), '읽은 양 · 확인 안내 — ' + msg);
      ok(/나선수\(22\): 타수 읽음 1 · 표 2/.test(msg) && /라선수\(44\)/.test(msg), '타자 표와 다름 · 못 찾은 선수');
      eq(ev, [{ side: 'home', files: 3, rows: 3, pa: 6, stats: 3, mismatch: 2, gaps: 0, score: 1, ms: ev[0] && ev[0].ms }], 'GA4 gameone_shot');
      eq($('goScore').value, SCORE, '점수판 → 이닝별 점수표 칸');
      ok(/점수판도 읽어/.test(msg), '점수판 안내');
      ok(Array.prototype.every.call(document.querySelectorAll('.go-shot-b'), function (b) { return !b.disabled; }), '다 읽으면 버튼 다시 켜짐');
      await T.sleep(400);
      ok(/홈 · 선수 3명/.test($('goPrev').textContent), '미리보기 — ' + $('goPrev').textContent.slice(0, 80));
      ['goTa', 'goTh', 'goDate'].forEach(function (id, i) { var el = $(id); el.value = ['가팀', '나팀', '2026-10-18'][i]; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await T.sleep(400);
      $('goSave').click();
      var s = JSON.parse(localStorage.getItem('sl_saves')), g = JSON.parse(localStorage.getItem(s[s.length - 1].key));
      eq(g.abs.filter(function (a) { return a.team === 'home'; }).map(function (a) { return a.inn + ' ' + a.bname + ' ' + a.res; }).sort(),
        ['1회말 가선수 플라이 아웃', '1회말 다선수 삼진', '2회말 나선수 볼넷', '3회말 가선수 안타', '4회말 나선수 땅볼 아웃', '4회말 다선수 3루타'], '저장 — 홈 타석 6개(회말 · 선수 · 결과)');
      eq([g.as, g.hs], [8, 11], '점수는 점수판(선공 8 · 후공 11) — 한 팀만 가져와도 맞는 점수');
    } finally { O().readFiles = r0; window.gtag = g0; $('goScore').value = ''; ['goFixOverlay', 'loadOverlay', 'goOverlay'].forEach(function (id) { if ($(id)) closeOverlay(id); }); }
  });

  test('화면: 표를 못 찾음(머리글 없음 · 타자 표만 · 글자가 너무 작음) · 읽기 실패 → 빨간 안내, 칸은 그대로 · 버튼 다시 켜짐', async function () {
    var r0 = O().readFiles;
    try {
      openGameOneImport();
      $('goAway').value = 'X';
      gameOneShotPick('away');
      O().readFiles = function () { return Promise.resolve({ text: '', rows: [], statsOnly: [], checks: [], gaps: [], shots: 0, files: 1 }); };
      await gameOneShotFiles({ files: [new File(['x'], 'a.png')] });
      ok($('goShotMsg').classList.contains('bad') && /머리글/.test($('goShotMsg').textContent), '표 못 찾음 — ' + $('goShotMsg').textContent);
      O().readFiles = function () { return Promise.resolve({ text: '', rows: [], statsOnly: [{ name: '가', number: '1' }], checks: [], gaps: [], shots: 1, files: 1 }); };
      await gameOneShotFiles({ files: [new File(['x'], 'a.png')] });
      ok(/「타자」 표.*만 찾았습니다.*「경기기록」/.test($('goShotMsg').textContent), '타자 표만 고름 — ' + $('goShotMsg').textContent);
      O().readFiles = function () { return Promise.resolve({ text: '', rows: [], statsOnly: [], checks: [], gaps: [], small: true, shots: 0, files: 1 }); };
      await gameOneShotFiles({ files: [new File(['x'], 'a.png')] });
      ok(/너무 작게.*원본 스크린샷/.test($('goShotMsg').textContent), '글자가 작은 사진 — ' + $('goShotMsg').textContent);
      var ev = [], g0 = window.gtag; window.gtag = function (k, n, p) { if (k === 'event' && n === 'gameone_shot') ev.push(p); };
      O().readFiles = function () { return Promise.resolve({ text: '', rows: [], statsOnly: [], checks: [], gaps: [], scoreText: SCORE, shots: 0, files: 1 }); };
      try { await gameOneShotFiles({ files: [new File(['x'], 'a.png')] }); } finally { window.gtag = g0; }
      ok($('goShotMsg').classList.contains('warn') && /점수판만 읽어 「이닝별 점수표」.*「경기기록」/.test($('goShotMsg').textContent), '점수판만 — ' + $('goShotMsg').textContent);
      eq([$('goScore').value, ev.length && ev[0].why, $('goAway').value], [SCORE, 'score_only', 'X'], '점수판 칸만 채움 · 타자 칸 그대로');
      $('goScore').value = '';
      O().readFiles = function () { return Promise.reject(new Error('글자 읽기 도구를 불러오지 못했습니다 — 인터넷 연결을 확인해 주세요')); };
      await gameOneShotFiles({ files: [new File(['x'], 'a.png')] });
      ok($('goShotMsg').classList.contains('bad') && /인터넷 연결/.test($('goShotMsg').textContent), '읽기 실패');
      eq($('goAway').value, 'X', '칸은 그대로');
      O().readFiles = function () { return Promise.resolve({ text: '1\t\t가(1)\t삼진', rows: [{ order: 1, name: '가', number: '1', inn: { 1: '삼진' }, stats: { ab: 1 } }], statsOnly: [{ name: '<img src=x>', number: '9' }],
        checks: [{ order: 1, name: '<img src=y>', number: '1', diff: [{ key: 'ab', read: 1, table: 2 }] }], gaps: [], shots: 1, files: 1 }); };
      await gameOneShotFiles({ files: [new File(['x'], 'a.png')] });
      ok(!$('goShotMsg').querySelector('img') && /<img src=y>/.test($('goShotMsg').textContent), '사진에서 읽은 이름은 글자로만(태그로 안 그림)');
      $('goAway').value = 'X';
      ok(Array.prototype.every.call(document.querySelectorAll('.go-shot-b'), function (b) { return !b.disabled; }), '버튼 켜짐');
    } finally { O().readFiles = r0; $('goAway').value = ''; closeOverlay('goOverlay'); }
  });
})();
