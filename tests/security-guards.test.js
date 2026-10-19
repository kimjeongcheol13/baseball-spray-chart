// 보안 감사(#111 · #112) 회귀 테스트 — 프로토타입 오염 · 팀 색상 CSS 주입 · 가져온 임시저장 saveKey · 엑셀 가져오기 · zoneHistory · 워크플로 셸 인젝션 ·
// HTML 주입(되돌리기로 복원되는 볼 · 스트라이크 카운트) · 날씨별 집계 키.
// 배경: 데이터 문자열(선수 이름 · 구종 · 결과 …)을 일반 객체({})의 키로 쓰면 '__proto__' · 'constructor' 같은 값에서
//       분석 탭이 예외로 멈추거나 'function Object() { [native code] }' 가 화면에 나왔다. 입구(가져오기 · 공유 링크 · 클라우드)는
//       _gameDataOk 로 막고, 집계 객체 · 상수 표는 프로토타입 없는 객체로 바꿔 예전에 저장된 데이터도 견디게 했다.
// 새로 {} 집계 맵이나 상수 표를 데이터 값으로 조회하게 추가하면 아래 "예전에 저장된 오염 데이터" 테스트가 잡는다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, ls = T.ls, $ = T.$;
  var P = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];   // Object.prototype 속성 이름

  var booted = null;
  async function start() {   // 앞선 테스트가 남긴 로그인 상태를 지운다 — 로그인 중이면 가져오기가 가짜 서버로 올라가 뒤 테스트에 섞인다
    if (!booted) booted = sleep(2000);
    await booted; srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear();
  }
  function saveAS() { return { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, p: AS.pitchers, zh: AS.zoneHistory, cg: AS.curGame, ap: $('app-page').style.display }; }
  function loadAS(S) { AS.abs = S.abs; AS.home_lineup = S.hl; AS.away_lineup = S.al; AS.pitchers = S.p; AS.zoneHistory = S.zh; AS.curGame = S.cg; $('app-page').style.display = S.ap; }
  function toast() { return $('toastTxt').textContent; }
  function keys() { return (ls('sl_saves') || []).map(function (s) { return s.key; }); }

  // ── 1. 입구 검증 (_gameDataOk) ──
  test('보안: _gameDataOk — 정상 · 예전 형식 데이터는 통과', function () {
    var good = { abs: [{ id: 1, bname: '김타자', bid: 3, pt: '직구', zone: '내각 높음', res: '안타', dir: 'CF', pitches: [{ pt: '직구', result: '볼', zone: '볼 위', pitcher: '박투수', batter: '김타자' }] }],
      home_lineup: [{ id: 3, name: '김타자' }], away_lineup: [], pitchers: [{ id: 1, name: '박투수', pitches: [{ pt: '커브', result: '스트라이크' }] }],
      zoneHistory: { '내각 높음': [{ pt: '직구', symbol: 'Ｆ' }], '볼 위': [] } };
    ok(_gameDataOk(good), '정상 경기');
    ok(_gameDataOk({}), '빈 경기');
    ok(_gameDataOk({ abs: null, pitchers: undefined, zoneHistory: '' }), '없는 목록 · 빈 zoneHistory(예전 형식, ||{} 로 읽힘)');
  });

  test('보안: _gameDataOk — 집계 키로 쓰이는 값이 Object.prototype 속성 이름이면 거부', function () {
    var bad = [];
    P.forEach(function (v) {
      ['bname', 'bid', 'pt', 'zone', 'res', 'dir'].forEach(function (f) { var a = { id: 1 }; a[f] = v; bad.push(['abs.' + f + '=' + v, { abs: [a] }]); });
      ['pt', 'zone', 'result', 'res', 'pitcher', 'batter'].forEach(function (f) {
        var e = {}; e[f] = v; bad.push(['abs.pitches.' + f + '=' + v, { abs: [{ id: 1, pitches: [e] }] }]);
        var e2 = {}; e2[f] = v; bad.push(['pitchers.pitches.' + f + '=' + v, { pitchers: [{ name: '투수', pitches: [e2] }] }]);
      });
      bad.push(['home_lineup.name=' + v, { home_lineup: [{ id: 1, name: v }] }]);
      bad.push(['away_lineup.id=' + v, { away_lineup: [{ id: v, name: '선수' }] }]);
      bad.push(['pitchers.name=' + v, { pitchers: [{ id: 1, name: v }] }]);
    });
    var passed = bad.filter(function (c) { return _gameDataOk(c[1]); }).map(function (c) { return c[0]; });
    eq(passed, [], '거부해야 하는데 통과한 경우');
  });

  test('보안: _gameDataOk — 목록 · zoneHistory 모양이 틀리면 거부', function () {
    var bad = [
      ['abs 가 객체', { abs: { 0: {} } }], ['abs 원소 null', { abs: [null] }], ['abs 원소 배열', { abs: [[]] }],
      ['pitches 가 문자열', { abs: [{ pitches: 'x' }] }], ['라인업이 객체', { home_lineup: {} }], ['투수 목록이 문자열', { pitchers: 'x' }],
      ['zoneHistory 문자열', { zoneHistory: 'abc' }], ['zoneHistory 배열', { zoneHistory: [[]] }],
      ['zoneHistory 값이 문자열', { zoneHistory: { '내각 높음': 'x' } }], ['zoneHistory 값이 객체', { zoneHistory: { '내각 높음': {} } }],
      ['zoneHistory 항목 null', { zoneHistory: { '내각 높음': [null] } }]
    ];
    var passed = bad.filter(function (c) { return _gameDataOk(c[1]); }).map(function (c) { return c[0]; });
    eq(passed, [], '거부해야 하는데 통과한 경우');
  });

  // ── 2. 가져오기 경로 ──
  test('보안: 데이터 가져오기 — 오염 경기만 건너뛰고, 밖에서 온 임시저장(sl_auto_*)의 saveKey 는 지운다', async function () {
    await start();
    var good = { key: 'sl_1790000000101', th: 'A', ta: 'B', abs: [{ id: 1, bname: '김타자', bid: 1, res: '안타' }] };
    var bad = { key: 'sl_1790000000102', th: 'A', ta: 'B', abs: [{ id: 1, bname: '__proto__', bid: 1, res: '안타' }] };
    var badZh = { key: 'sl_1790000000103', th: 'A', ta: 'B', abs: [], zoneHistory: { '내각 높음': 'x' } };
    var auto = { key: 'sl_auto_x1', saveKey: good.key, abs: [{ id: 2, bname: '이타자', res: '삼진' }] };
    var data = {}; [good, bad, badZh, auto].forEach(function (d) { data[d.key] = d; });
    _doImportText(JSON.stringify({ saves: [good, bad, badZh, auto].map(function (d) { return { key: d.key, label: d.key }; }), data: data }));
    try {
      eq(keys(), [good.key, auto.key], '가져온 경기');
      eq(localStorage.getItem(bad.key), null, '오염 경기는 저장 안 함');
      eq(localStorage.getItem(badZh.key), null, 'zoneHistory 가 틀린 경기는 저장 안 함');
      ok(!('saveKey' in ls(auto.key)), '임시저장의 saveKey 삭제');
      ok(/건너뜀/.test(toast()), '건너뛴 개수 안내: ' + toast());
    } finally { try { closeOverlay('loadOverlay'); } catch (e) {} }
  });

  test('보안: 공유 링크 — 오염 · zoneHistory 가 틀린 payload 는 AS 와 저장소를 건드리지 않고, 정상 payload 는 그대로 연다', async function () {
    var S = saveAS(), sp = window._sharedPayload;
    try {
      var cases = [
        ['선수 이름', { abs: [{ bn: '__proto__', r: '안타' }], hl: [], al: [], pitchers: [] }],
        ['라인업', { abs: [], hl: [{ n: 'constructor', no: 1 }], al: [], pitchers: [] }],
        ['투수 · 투구', { abs: [], hl: [], al: [], pitchers: [{ nm: '투수', pitches: [{ pt: '__proto__', res: '볼' }] }] }],
        ['zoneHistory', { abs: [{ bn: '김타자', r: '안타' }], hl: [], al: [], pitchers: [], zh: 'abc' }]
      ];
      for (var i = 0; i < cases.length; i++) {
        AS.abs = [{ id: 9, bname: '원래', res: '안타' }]; var n0 = keys().length;
        window._sharedPayload = cases[i][1];
        loadSharedGame();
        eq(AS.abs.map(function (a) { return a.bname; }), ['원래'], cases[i][0] + ': 불러오기가 AS 를 바꾸지 않음');
        eq(toast(), '공유 데이터 형식이 올바르지 않습니다', cases[i][0] + ': 안내');
        saveSharedGameLocal();
        eq(keys().length, n0, cases[i][0] + ': 내 기기에 저장하지 않음');
      }
      window._sharedPayload = { abs: [{ bn: '김타자', r: '안타' }], hl: [{ n: '김타자', no: 7 }], al: [], pitchers: [], zh: { '중앙 중간': [{ pt: '커브', symbol: 'Ｃ' }] } };
      loadSharedGame();
      eq(AS.abs.map(function (a) { return a.bname; }), ['김타자'], '정상 payload 는 열림');
      await sleep(700);   // loadSharedGame 의 지연 렌더가 끝난 뒤 되돌린다
    } finally { window._sharedPayload = sp; loadAS(S); }
  });

  test('보안: 엑셀/CSV 가져오기 3경로 — 선수 이름 · 구종 · 결과 · 날짜가 프로토타입 이름인 행만 건너뛴다', async function () {
    var S = saveAS(), X = window.XLSX, FR = window.FileReader;
    // 파일 읽기(FileReader)는 실제 시간이 걸리는데 이 하네스는 가상 시간이라 sleep 동안 실제 시간이 거의 흐르지 않는다
    // → 느린 CI 에서 읽기가 끝나기 전에 기다림이 끝났다(PR #182 CI). 파일 내용은 run 안의 XLSX 가짜가 정하므로 읽기도 가짜로 바꿔 가상 시간 안에서 끝낸다
    function FakeReader() {}
    FakeReader.prototype.readAsArrayBuffer = function () { var r = this; setTimeout(function () { r.onload({ target: { result: new ArrayBuffer(1) } }); }, 0); };
    async function run(rows, call) {
      window.XLSX = { read: function () { return { SheetNames: ['타석기록'], Sheets: { '타석기록': {} } }; }, utils: { sheet_to_json: function () { return rows; } } };
      window.FileReader = FakeReader;
      var input = { files: [new Blob(['x'])], value: 'f' };
      $('toastTxt').textContent = '';
      if (call === 'single') importSingleTableGames(rows, 0, input); else window[call](input);
      for (var i = 0; i < 400 && !toast(); i++) await sleep(25);
      ok(toast(), call + ': 가져오기 결과 안내가 뜨지 않음');
    }
    function games() { return keys().map(function (k) { var d = ls(k); return d.abs.map(function (a) { return a.bname + '/' + (a.pt || '') + '/' + a.res; }); }); }
    try {
      localStorage.setItem('sl_saves', '[]');
      await run([['이닝', '팀', '선수', '결과', '구종'], ['1회초', '홈', '김타자', '안타', '직구'], ['1회초', '홈', '__proto__', '안타', '직구'],
        ['1회말', '홈', '이타자', '삼진', 'constructor'], ['1회말', '홈', '박타자', 'constructor', '직구']], 'importExcelAsGame');
      eq(games(), [['김타자/직구/안타']], '새 경기로 가져오기');
      ok(/건너뜀 3개/.test(toast()), '건너뛴 개수: ' + toast());

      localStorage.setItem('sl_saves', '[]');
      await run([['날짜', '타자', '결과', '타격팀', '이닝'], ['2026-09-01', '김타자', '안타', 'A팀', '1회초'], ['2026-09-01', 'hasOwnProperty', '안타', 'A팀', '1회초'],
        ['constructor', '이타자', '삼진', 'A팀', '1회말']], 'single');
      eq(games(), [['김타자//안타'], ['이타자//삼진']], '날짜별 여러 경기 가져오기 (날짜 칸이 constructor 여도 멈추지 않음)');

      AS.abs = []; AS.home_lineup = []; AS.away_lineup = [];
      await run([['이닝', '팀', '선수이름', '결과'], ['1회초', '홈', '김타자', '안타'], ['1회초', '홈', 'constructor', '안타'], ['1회초', '홈', '최타자', 'toString']], 'importExcel');
      eq(AS.abs.map(function (a) { return a.bname + '/' + a.res; }), ['김타자/안타'], '현재 경기에 가져오기 (안내: ' + toast() + ')');
      eq(AS.home_lineup.map(function (p) { return p.name; }), ['김타자'], '라인업에도 정상 선수만');
    } finally {
      if (X === undefined) delete window.XLSX; else window.XLSX = X;
      window.FileReader = FR;
      loadAS(S); try { closeOverlay('loadOverlay'); } catch (e) {}
    }
  });

  // ── 3. 예전에 저장된 오염 데이터 (입구 검증을 거치지 않은 경우) ──
  test('보안: 예전에 저장된 오염 데이터 — 기록 탭 · 분석 탭이 멈추지 않고, 깨진 값(function Object · NaN)을 보여주지 않는다', async function () {
    var S = saveAS(), errs = [];
    function onerr(e) { errs.push(e.message); }
    // 화면 전체 글자에서 깨진 값 표시 개수 (index.html 의 인라인 스크립트 글자는 기준선으로 빼고 센다)
    function marks() { var t = document.body.textContent; return { obj: (t.match(/native code/g) || []).length, nan: (t.match(/NaN/g) || []).length, oo: (t.match(/\[object Object\]/g) || []).length }; }
    var t0 = 1790000000000, K1 = 'sl_1790000000301', K2 = 'sl_1790000000302';
    var abs = ['안타', 'constructor', '2루타', 'toString', '삼진', '홈런', '안타'].map(function (r, i) {
      return { id: t0 + i, bid: i < 5 ? 7 : 'constructor', bname: i < 5 ? '김타자' : P[i % P.length], bnum: 7, bats: i % 2 ? 'hasOwnProperty' : 'R', team: i % 3 ? 'home' : 'away',
        res: r, pt: i % 2 ? P[i % P.length] : '직구', zone: i % 2 ? 'toString' : '중앙 중간', launchType: i % 2 ? 'constructor' : '라인드라이브', dir: i % 2 ? 'constructor' : 'CF',
        inn: '1회초', deg: 90, x: 0.5, y: 0.4, rbi: 0, count: { b: 1, s: 1 },
        pitches: [{ pt: i % 2 ? '__proto__' : '직구', result: i % 2 ? 'valueOf' : '스트라이크', zone: '중앙 중간', pitcher: i % 2 ? '__proto__' : '투수A', batter: i % 2 ? '__proto__' : '김타자', x: 0.5, y: 0.5 }] };
    });
    var polluted = { key: K1, th: '__proto__', ta: 'constructor', hs: 3, as: 1, d: '2026. 10. 1.', ts: t0, abs: abs,
      home_lineup: [{ id: 7, name: '김타자', num: 7, bh: 'constructor', pos: 'constructor' }, { id: 'constructor', name: '__proto__', num: 8 }], away_lineup: [],
      pitchers: [{ id: 1, name: '투수A', role: 'constructor', pitches: [{ pt: '직구', result: 'constructor', zone: '중앙 중간', batter: '김타자', x: 0.5, y: 0.5 }] },
        { id: 2, name: '__proto__', role: 'SP', pitches: [{ pt: 'constructor', result: '볼', zone: 'toString', batter: 'constructor' }] }],
      zoneHistory: {} };
    var normal = { key: K2, th: '우리팀', ta: '상대', hs: 2, as: 2, d: '2026. 10. 2.', ts: t0 + 9, zoneHistory: {}, away_lineup: [], pitchers: [],
      home_lineup: [{ id: 8, name: '이타자', num: 8 }], abs: ['안타', '삼진', '홈런'].map(function (r, i) { return { id: t0 + 100 + i, bid: 8, bname: '이타자', bnum: 8, team: 'home', res: r, pt: '커브', zone: '내각 낮음', dir: 'LF', deg: 40, x: 0.3, y: 0.4, inn: '2회초', rbi: 1 }; }) };
    var base = marks();
    window.addEventListener('error', onerr);
    try {
      localStorage.setItem(K1, JSON.stringify(polluted)); localStorage.setItem(K2, JSON.stringify(normal));   // 검증을 거치지 않고 직접 — 예전 버전이 저장한 데이터
      localStorage.setItem('sl_saves', JSON.stringify([{ key: K1, label: '오염 경기', ts: t0 }, { key: K2, label: '정상 경기', ts: t0 + 9 }]));
      restoreGame(K1); await sleep(600);
      var res = { '기록 탭': 'ok' };
      ['openProfileView', 'openCompareView', 'openScoutView', 'openTeamView', 'openPitcherView', 'openBatterView', 'openSprayView', 'openPlayerReport', 'openPlayerProfile'].forEach(function (v) {
        try { window[v](); res[v] = 'ok'; } catch (e) { res[v] = '예외: ' + e.message; }
      });
      await sleep(800);
      var bad = Object.keys(res).filter(function (k) { return res[k] !== 'ok'; }).map(function (k) { return k + ' ' + res[k]; });
      eq(bad, [], '예외로 멈춘 화면');
      eq(errs, [], '처리되지 않은 예외');
      var m = marks();
      eq({ obj: m.obj - base.obj, nan: m.nan - base.nan, oo: m.oo - base.oo }, { obj: 0, nan: 0, oo: 0 }, '화면에 새로 나온 깨진 값 (native code · NaN · [object Object])');
    } finally {
      window.removeEventListener('error', onerr);
      try { window.closePlayerReport(); } catch (e) {}
      try { closeOverlay('playerProfileOverlay'); } catch (e) {}
      try { shellNav('record'); } catch (e) {}
      loadAS(S);
    }
  });

  // ── 4. 팀 색상 · 임시저장 복구 ──
  test('보안: 팀 색상 — #RGB~#RRGGBBAA 만 통과하고, 공유 팀 가져오기는 색 · 이름 · 구장 · 경기 목록을 정리한다', function () {
    eq(['#fff', '#4b8cf5', '#4b8cf5cc'].map(_tmColor), ['#fff', '#4b8cf5', '#4b8cf5cc'], '정상 색');
    eq(['red', '#fff;background:url(x)', '#fff\n', '#12', null, {}, 'url(javascript:1)'].map(_tmColor), Array(7).fill('#4b8cf5'), '그 밖은 기본색');
    tdLoad();
    var n0 = _TD.teams.length, act = _TD.activeTeamId, sp = window._sharedTeamPayload;
    try {
      window._sharedTeamPayload = { name: '팀'.repeat(60), color: 'red;background:url(//evil)', stadium: '구'.repeat(60), games: 'nope' };
      importSharedTeam();
      var t = _TD.teams[_TD.teams.length - 1];
      eq([t.color, t.name.length, t.stadium.length, t.games], ['#4b8cf5', 40, 40, []], '가져온 팀');
    } finally {
      _TD.teams.length = n0; _TD.activeTeamId = act; tdSave(); window._sharedTeamPayload = sp;
      var b = $('teamSharedBanner'); if (b) b.style.display = 'none';
    }
  });

  test('보안: 임시저장 복구 — saveKey 가 저장된 경기를 가리키면 덮어쓰기 전에 묻고, 취소하면 아무것도 바꾸지 않는다', function () {
    var S = saveAS(), cf = window.confirm, asked = [];
    try {
      localStorage.setItem('sl_1790000000501', JSON.stringify({ key: 'sl_1790000000501', abs: [{ id: 1, bname: '저장', res: '안타' }] }));
      localStorage.setItem('sl_saves', JSON.stringify([{ key: 'sl_1790000000501', label: '저장된 경기', ts: 1 }]));
      localStorage.setItem('sl_auto_x2', JSON.stringify({ saveKey: 'sl_1790000000501', abs: [{ id: 2, bname: '복구', res: '삼진' }] }));
      window.confirm = function (m) { asked.push(m); return false; };
      AS.abs = [{ id: 9, bname: '원래', res: '안타' }];
      recoverHiddenAutosave('sl_auto_x2');
      eq(asked, ['저장된 경기 "저장된 경기"을(를) 이 임시저장으로 덮어쓸까요?'], '확인 문구');
      eq(AS.abs.map(function (a) { return a.bname; }), ['원래'], '취소하면 AS 그대로');
      eq(ls('sl_1790000000501').abs[0].bname, '저장', '저장된 경기 그대로');
    } finally { window.confirm = cf; loadAS(S); }
  });

  // ── 5. 워크플로 (이슈 제목 셸 인젝션) ──
  test('보안: claude-auto-fix 워크플로 — run: 스크립트에 ${{ }} 직접 보간이 없고, 토큰 보관 · 실행 대상이 제한돼 있다', async function () {
    var y = await (await fetch('/.github/workflows/claude-auto-fix.yml')).text(), L = y.split('\n'), hits = [];
    for (var i = 0; i < L.length; i++) {
      var m = L[i].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
      if (!m) continue;
      var ind = m[1].length, body = [m[2]];
      for (var j = i + 1; j < L.length && (L[j].trim() === '' || L[j].match(/^\s*/)[0].length > ind); j++) body.push(L[j]);
      if (/\$\{\{/.test(body.join('\n'))) hits.push(i + 1);
    }
    eq(hits, [], '${{ }} 를 셸에 직접 넣는 run: (줄 번호) — env 로 넘겨 "$변수" 로 써야 한다');
    ok(/persist-credentials:\s*false/.test(y), 'checkout persist-credentials: false');
    ok(/author_association/.test(y) && /"OWNER","MEMBER","COLLABORATOR"/.test(y), '이슈 작성자 OWNER/MEMBER/COLLABORATOR 게이트');
    ok(/@anthropic-ai\/claude-code@\d+\.\d+\.\d+/.test(y), 'claude-code 버전 고정');
  });

  // ── 6. HTML 주입(XSS) — 가져온 경기의 카운트 · 날씨 ──
  // 실행 코드 없이 표식 태그만 넣고, 그 태그가 실제 요소로 생기면(= HTML 로 해석되면) 실패로 본다
  var PROBE = '"><b data-xss-probe="1">x</b><i data-xss-probe="2">';
  function probes() { return document.querySelectorAll('[data-xss-probe]').length; }

  test('보안: 되돌리기 — 가져온 경기의 볼 · 스트라이크가 문자열이어도 숫자로만 복원되고, 카운트 버튼 · 투구 기록에 HTML 이 섞이지 않는다', async function () {
    var S = saveAS(), cp = AS.currentPitches, z = AS.zone, pt = AS.pt, K = 'sl_1790000000601';
    try {
      eq(probes(), 0, '시작 전 표식 없음');
      localStorage.setItem(K, JSON.stringify({ key: K, th: 'A', ta: 'B', abs: [
        { id: 1790000000601, bid: 1, bname: '김타자', res: '안타', count: { b: 1, s: 1 } },
        { id: 1790000000602, bid: 1, bname: '김타자', res: '삼진', count: { b: PROBE, s: PROBE } }] }));   // 검증을 거치지 않은 예전 데이터 가정
      localStorage.setItem('sl_saves', JSON.stringify([{ key: K, label: '카운트 경기', ts: 1 }]));
      restoreGame(K); await sleep(300);
      undoLast(); await sleep(300);
      eq([typeof AS.balls, typeof AS.strikes], ['number', 'number'], '되돌리기 후 카운트는 숫자');
      ok(AS.balls >= 0 && AS.balls <= 3 && AS.strikes >= 0 && AS.strikes <= 2, '카운트 범위: ' + AS.balls + '-' + AS.strikes);
      AS.currentPitches = []; AS.zone = '중앙 중간'; AS.pt = '직구';
      logPitchAction(); await sleep(200);   // 모바일 투구 기록(mobPitchLogList)을 그린다
      eq(probes(), 0, '되돌리기 · 투구 기록 뒤 표식이 HTML 로 해석됨');

      // 표시하는 쪽도 숫자로만 쓰는지 (다른 경로로 문자열이 들어와도) — 카운트 버튼 · 모바일 투구 기록을 직접 다시 그린다
      AS.balls = PROBE; AS.strikes = PROBE; AS.outs = PROBE;
      renderCount(); updateAll(); await sleep(300);
      AS.currentPitches = [{ pt: '직구', zone: '중앙 중간', balls: PROBE, strikes: PROBE, outs: PROBE, ts: PROBE }];
      _renderMobPitchLog();
      eq(probes(), 0, '카운트 · 투구 기록 표시에 HTML 이 섞임');
      var labels = Array.prototype.map.call(document.querySelectorAll('[aria-label^="볼 "]'), function (el) { return el.getAttribute('aria-label'); });
      ok(labels.length > 0 && labels.every(function (l) { return /^볼 0,/.test(l); }), '카운트 버튼 이름은 숫자: ' + JSON.stringify(labels));
    } finally {
      AS.balls = 0; AS.strikes = 0; AS.outs = 0; AS.currentPitches = cp || []; AS.zone = z; AS.pt = pt;
      loadAS(S); try { renderCount(); _renderMobPitchLog(); } catch (e) {}
      Array.prototype.forEach.call(document.querySelectorAll('[data-xss-probe]'), function (el) { el.remove(); });
    }
  });

  test('보안: 날씨별 집계 — cond.weather 가 프로토타입 이름이면 입구에서 거부하고, 예전 데이터여도 Object.prototype 을 오염시키지 않는다', function () {
    ok(!_gameDataOk({ cond: { weather: '__proto__' } }), '입구 검증이 거부');
    ok(_gameDataOk({ cond: { weather: '맑음' } }) && _gameDataOk({ cond: null }), '정상 날씨 · 없음은 통과');
    var K = 'sl_1790000000701';
    try {
      localStorage.setItem(K, JSON.stringify({ key: K, ts: 1790000000000, cond: { weather: '__proto__' }, abs: [{ id: 1, bid: 1, bname: '김타자', res: '안타' }] }));
      localStorage.setItem('sl_saves', JSON.stringify([{ key: K, label: '날씨 경기', ts: 1 }]));
      renderSeasonStats();
      eq([({}).ab, ({}).h], [undefined, undefined], 'Object.prototype 오염');
    } finally { delete Object.prototype.ab; delete Object.prototype.h; localStorage.removeItem(K); }
  });

  test('(정리) 보안 테스트가 만든 상태를 비운다', async function () { srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear(); eq(srv.user, null, '로그아웃'); });
})();
