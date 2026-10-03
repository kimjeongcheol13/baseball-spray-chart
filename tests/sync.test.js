// cloudSyncSmart(팀 코드 games 동기화) 동작 검증 — 실제 js/core.js 를 가짜 서버(stub-supabase.js)에 붙여 돌린다.
// 실행: node tests/run.mjs   (러너가 이 파일을 index.html 끝에 끼워 넣고 헤드리스 Chrome 에서 load 후 실행)
(function () {
  var srv = window.__srv;
  var TC = 'TEST-ONLY-TEAM';                                    // 가짜 팀 코드 — 운영 데이터와 무관
  var LEGACY_TS = '2026. 5. 17. 오후 4:28:31';                  // 예전 버전이 저장한 ko-KR 문자열 ts
  var T0 = new Date(2026, 4, 17, 16, 28, 31).getTime();         // 위 문자열의 올바른 값(실행 환경 시간대 기준)
  var K1 = 'sl_1779002911000', K2 = 'sl_1779002911001', K3 = 'sl_1779002911002';
  var KU = 'sl_homevsaway_260517_abc';                          // 키에 에폭이 없는 형식(ts 불명 케이스용)

  function $(id) { return document.getElementById(id); }
  function ok(c, m) { if (!c) throw new Error(m); }
  function eq(a, b, m) { var x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(m + ' — 기대 ' + y + ', 실제 ' + x); }
  function ls(k) { return JSON.parse(localStorage.getItem(k)); }
  // 상태줄의 ❌/✅/⚠️ 아이콘은 scorebook.js 가 cloudOverlay 안 새 글자의 이모지를 화면에서 걸러내(다음 프레임) 타이밍에 따라 있다/없다 한다.
  // → 아이콘은 검사하지 않고 문구(앞의 기호 제거)와 색으로 판정한다.
  function txt(s) { return s.status.replace(/^[^\p{L}\p{N}]+/u, ''); }

  // 로컬 경기 {key, ts(항목), data}. 서버 행 {team_code, game_key, game_data, label, ts}
  function G(key, ts, extra) { return { key: key, entryTs: ts, data: Object.assign({ th: '홈', ta: '원정', hs: 1, as: 0, abs: [], d: '2026. 5. 17.', ts: ts }, extra || {}) }; }
  function R(key, ts, extra) { return { team_code: TC, game_key: key, game_data: Object.assign({ th: '홈', ta: '원정', hs: 9, as: 0, abs: [], d: '2026. 5. 17.', ts: ts }, extra || {}), label: 'srv-' + key, ts: ts }; }
  function seed(list) {
    srv.reset(); localStorage.clear(); localStorage.setItem('sl_team_code', TC);
    var saves = [];
    list.forEach(function (g) {
      localStorage.setItem(g.key, JSON.stringify(g.data));
      var e = { key: g.key, label: g.key }; if (g.entryTs != null) e.ts = g.entryTs; saves.push(e);
    });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
  }
  function ups(s) { return s.log.filter(function (x) { return x.op === 'upsert'; }); }
  function reads(s) { return s.log.filter(function (x) { return x.op === 'select'; }).map(function (x) { return x.cols; }); }

  // 동기화 버튼을 눌러 끝날 때까지(버튼이 다시 켜질 때까지) 기다린 뒤 화면·요청 상태를 돌려준다
  function runSync() {
    return new Promise(function (resolve) {
      var btn = $('cloudSyncBtn'), n = 0;
      window.cloudSyncSmart();
      (function poll() {
        if (!btn.disabled || ++n > 1000) {
          var st = $('cloudConnStatus');
          resolve({ status: st.textContent, color: st.style.color, btnEnabled: !btn.disabled, log: srv.log.slice(), timedOut: n > 1000 });
        } else setTimeout(poll, 10);
      })();
    });
  }

  var tests = [];
  function test(name, fn) { tests.push({ name: name, fn: fn }); }

  // ── 1. 서버 game_key,ts 를 먼저 읽는 단계가 실패하면: 업로드 중단 + 실패 표시 (예전처럼 무조건 올리면 안 됨) ──
  [
    ['HTTP 500', { status: 500, code: 'XX000', message: 'internal error' }],
    ['권한 거부 42501', { status: 403, code: '42501', message: 'permission denied for table games' }],
    ['네트워크 오류', { status: 0, code: '', message: 'TypeError: Failed to fetch' }],
    ['요청 자체가 reject', 'reject']
  ].forEach(function (c) {
    test('조회 실패(' + c[0] + ') → 업로드 0건 · 내려받기 없음 · 실패 표시', async function () {
      seed([G(K1, T0, { ts: LEGACY_TS }), G(K2, T0 + 1)]);
      srv.failRead = c[1];
      var s = await runSync();
      ok(!s.timedOut, '동기화가 끝나지 않음');
      eq(ups(s).length, 0, '업로드 요청 수');
      eq(reads(s), ['game_key,ts'], '조회는 game_key,ts 한 번뿐(내려받기 select * 없음)');
      ok(/^오류:/.test(txt(s)), '실패 문구(오류: …)여야 함: ' + s.status);
      eq(s.color, 'var(--sl-hit-red)', '실패 색(Hit Red)');
      ok(s.btnEnabled, '버튼 복구');
      eq(ls(K1).ts, LEGACY_TS, '로컬 원본(ts 문자열)은 건드리지 않음');
    });
  });

  // ── 2. 대조군: 조회가 성공하면 실제로 올라간다(위 테스트가 "업로드 감지 가능"함을 보증) + ts 정규화 ──
  test('대조군: 조회 성공 → 업로드, 예전 문자열 ts 는 숫자로 전송 · 로컬 원본은 그대로 · ✅', async function () {
    seed([G(K1, LEGACY_TS), G(K2, T0 + 1)]);
    var s = await runSync();
    var u = ups(s);
    eq(u.length, 1, '업로드 요청 수(2행은 한 청크)');
    eq(u[0].rows.length, 2, '업로드 행 수');
    ok(u[0].rows.every(function (r) { return Number.isInteger(r.ts); }), '전송 ts 는 모두 정수여야 함');
    eq(u[0].rows.filter(function (r) { return r.game_key === K1; })[0].ts, T0, '문자열 ts → 올바른 숫자');
    eq(ls(K1).ts, LEGACY_TS, '로컬 원본은 그대로');
    ok(/^동기화 완료/.test(txt(s)) && s.color === 'var(--green)', '완료 표시(초록): ' + s.status + ' / ' + s.color);
  });

  // ── 3. 서버 최신본 보호 / 병합 규칙 ──
  test('서버가 더 새로우면 올리지 않고 서버본이 로컬로 내려온다', async function () {
    seed([G(K1, T0)]); srv.games = [R(K1, T0 + 60000)];
    var s = await runSync();
    eq(ups(s).length, 0, '업로드 요청 수');
    eq(ls(K1).hs, 9, '로컬이 서버본으로 갱신');
    ok(/^동기화 완료/.test(txt(s)), s.status);
  });
  test('로컬이 더 새로우면 올린다', async function () {
    seed([G(K1, T0 + 60000)]); srv.games = [R(K1, T0)];
    var s = await runSync();
    eq(ups(s).length, 1, '업로드 요청 수');
    eq(srv.games[0].ts, T0 + 60000, '서버 ts 갱신');
    eq(srv.games[0].game_data.hs, 1, '서버 데이터가 로컬본으로 갱신');
  });
  test('같은 ts 면 올리지도 내려받지도 않는다(최신 상태)', async function () {
    seed([G(K1, T0)]); srv.games = [R(K1, T0)];
    var s = await runSync();
    eq(ups(s).length, 0, '업로드 요청 수');
    eq(ls(K1).hs, 1, '로컬 불변');
    ok(s.status.indexOf('최신 상태') > -1, s.status);
  });
  test('로컬 ts 를 못 읽는 경기가 서버에 있으면 양쪽 모두 건드리지 않고 ⚠️ 일부만', async function () {
    seed([{ key: KU, data: { th: '홈', ta: '원정', hs: 1, as: 0, abs: [], d: '?' } }]); srv.games = [R(KU, T0 + 60000)];
    var s = await runSync();
    eq(ups(s).length, 0, '업로드 요청 수');
    eq(ls(KU).hs, 1, '로컬 불변(서버본으로 덮지 않음)');
    eq(srv.games[0].game_data.hs, 9, '서버 불변');
    ok(/^일부만 동기화됨/.test(txt(s)) && s.color === 'var(--sl-amber)', 'Amber 일부만: ' + s.status + ' / ' + s.color);
  });

  // ── 4. 업로드 단계 실패 ──
  test('업로드 권한 오류 → 요청 1번에서 중단 · ❌ 표시 · 내려받기는 계속', async function () {
    seed([G(K1, T0), G(K2, T0 + 1)]);
    srv.failWrite = { status: 403, code: '42501', message: 'permission denied' };
    var s = await runSync();
    eq(ups(s).length, 1, '권한 오류는 행 단위 재시도 없이 즉시 중단');
    ok(reads(s).indexOf('*') > -1, '내려받기(select *)는 계속');
    ok(/^동기화 실패/.test(txt(s)) && s.color === 'var(--sl-hit-red)', '실패 표시(Hit Red): ' + s.status + ' / ' + s.color);
  });
  test('불량 행 1개 → 그 행만 가려내고 나머지는 올라간다 · ⚠️ 일부만', async function () {
    seed([G(K1, T0), G(K2, T0 + 1), G(K3, T0 + 2)]);
    srv.failWrite = function (rows) {
      return rows.some(function (r) { return r.game_key === K2; }) ? { status: 400, code: '22P02', message: 'invalid input syntax' } : null;
    };
    var s = await runSync();
    eq(srv.games.map(function (r) { return r.game_key; }).sort(), [K1, K3], '정상 행만 서버에 저장');
    ok(/^일부만 동기화됨/.test(txt(s)) && s.color === 'var(--sl-amber)', 'Amber 일부만: ' + s.status + ' / ' + s.color);
  });

  // ── 5. 하네스 자체: 외부 요청 차단 장치 점검 → 마지막에 시도 0건 확인 ──
  test('차단 장치 점검: 외부 fetch/XHR 는 거부되고 기록된다', async function () {
    window.__netAttempts.length = 0;
    var rejected = false;
    try { await fetch('https://example.invalid/x'); } catch (e) { rejected = true; }
    ok(rejected, '외부 fetch 가 거부되지 않음');
    var threw = false;
    try { new XMLHttpRequest().open('GET', 'https://example.invalid/y'); } catch (e) { threw = true; }
    ok(threw, '외부 XHR 이 거부되지 않음');
    eq(window.__netAttempts.length, 2, '시도 기록');
    window.__netAttempts.length = 0;   // 점검용 시도는 지운다
  });
  test('(마지막) 테스트 전체에서 외부로 나가려던 요청 0건', async function () {
    eq(window.__netAttempts, [], '외부 요청 시도');
  });

  async function main() {
    ok(typeof window.cloudSyncSmart === 'function', 'core.js 가 로드되지 않음(cloudSyncSmart 없음)');
    var results = [];
    for (var i = 0; i < tests.length; i++) {
      try { await tests[i].fn(); results.push({ name: tests[i].name, ok: true }); }
      catch (e) { results.push({ name: tests[i].name, ok: false, err: String(e && e.message || e) }); }
    }
    return results;
  }
  function publish(payload) {   // 러너가 dump-dom 에서 읽어 간다(base64 — 이스케이프 문제 회피)
    var bytes = new TextEncoder().encode(JSON.stringify(payload)), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var el = document.createElement('pre'); el.id = 't-result'; el.setAttribute('data-b64', btoa(bin)); document.body.appendChild(el);
  }
  window.addEventListener('load', function () {
    main().then(function (r) { publish({ results: r }); }, function (e) { publish({ fatal: String(e && e.message || e) }); });
  });
})();
