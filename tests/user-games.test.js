// 로그인 계정 클라우드(user_games) 시작 동기화 + 로컬 수정 시각(sl_cloud_mod) 검증 — 실제 js/cloud.js · js/core.js 를 가짜 서버에 붙여 돌린다.
// 배경: 경기 ts 는 생성 시각이라(saveGame 은 다시 저장해도 유지) ts 만으로는 오프라인 수정이 서버본보다 새로운지 알 수 없다 → sl_cloud_mod 에 수정한 시각을 기록한다.
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, ls = T.ls, test = T.test, sleep = T.sleep;
  var T0 = new Date(2026, 4, 17, 16, 28, 31).getTime();          // 경기 생성 시각(ts)
  var K1 = 'sl_1779002911000', K2 = 'sl_1779002911001';
  var KU = 'sl_homevsaway_260517_abc';                           // 키에 에폭이 없는 형식(수정 시각 불명 케이스용)
  var MOD = 'sl_cloud_mod';

  function iso(ms) { return new Date(ms).toISOString(); }
  function G(key, ts, extra) { return { key: key, data: Object.assign({ th: '홈', ta: '원정', hs: 1, as: 0, abs: [], d: '2026. 5. 17.', ts: ts }, extra || {}) }; }
  function UR(key, ms, extra) {   // 서버 user_games 행(updated_at = ms)
    return { user_id: 'TEST-USER', game_key: key, team_name: '홈 vs 원정', date: '2026. 5. 17.',
      data: Object.assign({ th: '홈', ta: '원정', hs: 9, as: 0, abs: [], d: '2026. 5. 17.', ts: T0 }, extra || {}), updated_at: iso(ms) };
  }
  function seed(list, mods) {   // mods = { 저장키: 로컬 수정 시각 } → sl_cloud_mod (항상 존재하게 둬서 전환 처리가 끼지 않게 한다)
    srv.reset(); localStorage.clear();
    var saves = [];
    list.forEach(function (g) { localStorage.setItem(g.key, JSON.stringify(g.data)); var e = { key: g.key, label: g.key }; if (g.data.ts != null) e.ts = g.data.ts; saves.push(e); });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
    localStorage.setItem(MOD, JSON.stringify(mods || {}));
  }
  function mod(k) { return (ls(MOD) || {})[k]; }
  function ups(s) { return s.log.filter(function (x) { return x.table === 'user_games' && x.op === 'upsert'; }); }
  function sels(s) { return s.log.filter(function (x) { return x.table === 'user_games' && x.op === 'select'; }).map(function (x) { return x.cols; }); }

  // 앱 시작 때 도는 첫 동기화(DOMContentLoaded 1.5초 뒤, 로그인 전이라 서버 전송 없음)가 끝난 뒤에 시작한다
  var booted = null;
  function boot() { return booted || (booted = sleep(2000)); }

  // 로그인(SIGNED_IN) → 시작 동기화가 끝날 때까지(서버 요청이 1초 동안 더 없을 때까지) 기다린 뒤 요청 기록과 실패 알림 여부를 돌려준다
  function runLogin() {
    return new Promise(function (resolve) {
      var ind = T.$('saveInd'), sawFail = false;
      var mo = new MutationObserver(function () { if (/클라우드 실패/.test(ind.textContent)) sawFail = true; });
      if (ind) mo.observe(ind, { childList: true, characterData: true, attributes: true, subtree: true });
      srv.signIn();
      var n = 0, last = -1, quiet = 0;
      (function poll() {
        var len = srv.log.length;
        if (len > 0 && len === last) quiet++; else { quiet = 0; last = len; }
        if (quiet >= 100 || ++n > 800) { mo.disconnect(); resolve({ log: srv.log.slice(), sawFail: sawFail, timedOut: n > 800 }); }
        else setTimeout(poll, 10);
      })();
    });
  }

  // ── 1. 서버 game_key,updated_at 를 먼저 읽는 단계가 실패하면: 업로드 중단 + 실패 알림 ──
  [['HTTP 500', { status: 500, code: 'XX000', message: 'internal error' }], ['요청 자체가 reject', 'reject']].forEach(function (c) {
    test('시작 동기화: 서버 조회 실패(' + c[0] + ') → 업로드 0건 · 내려받기 없음 · 실패 알림', async function () {
      await boot();
      seed([G(K1, T0)], { [K1]: T0 + 60000 }); srv.failRead = c[1];
      var s = await runLogin();
      ok(!s.timedOut, '동기화가 끝나지 않음');
      eq(ups(s).length, 0, '업로드 요청 수');
      eq(sels(s), ['game_key,updated_at'], '조회는 한 번뿐(내려받기 select 없음)');
      ok(s.sawFail, '실패 알림(클라우드 실패)이 표시되어야 함');
      eq(ls(K1).hs, 1, '로컬 불변');
    });
  });

  // ── 2. 올릴지 · 받을지: 로컬 "수정 시각"(sl_cloud_mod, 없으면 ts) vs 서버 updated_at ──
  test('서버에 없는 경기는 올린다 · updated_at 은 업로드 시각이 아니라 로컬 수정 시각', async function () {
    await boot();
    seed([G(K1, T0), G(K2, T0 + 1)], { [K1]: T0 + 5000 });   // K2 는 기록 없음 → ts
    var s = await runLogin();
    var u = ups(s);
    eq(u.length, 1, '업로드 요청 수'); eq(u[0].rows.length, 2, '업로드 행 수');
    eq(u[0].rows.filter(function (r) { return r.game_key === K1; })[0].updated_at, iso(T0 + 5000), 'K1 = 수정 시각');
    eq(u[0].rows.filter(function (r) { return r.game_key === K2; })[0].updated_at, iso(T0 + 1), 'K2 = ts');
  });
  test('서버가 더 새로우면 올리지 않고 서버본이 로컬로 내려온다 · 로컬 수정 시각 = 서버 시각', async function () {
    await boot();
    seed([G(K1, T0)], { [K1]: T0 + 1000 }); srv.user_games = [UR(K1, T0 + 60000)];
    var s = await runLogin();
    eq(ups(s).length, 0, '업로드 요청 수');
    eq(ls(K1).hs, 9, '로컬이 서버본으로 갱신');
    eq(mod(K1), T0 + 60000, '받은 뒤 로컬 수정 시각 = 서버 시각');
  });
  test('(핵심) 서버 시각이 생성 시각(ts)보다 새롭더라도 로컬 수정 시각이 더 새로우면 올린다 — 오프라인 수정 보존', async function () {
    await boot();
    // 생성 T0 → 업로드(서버 T0+3000) → 오프라인 수정(T0+60000, 아직 못 올림). ts 만 보면 서버가 늘 더 새로워 보여 수정이 사라진다
    seed([G(K1, T0, { hs: 5 })], { [K1]: T0 + 60000 }); srv.user_games = [UR(K1, T0 + 3000)];
    var s = await runLogin();
    eq(ups(s).length, 1, '업로드 요청 수');
    eq(srv.user_games[0].data.hs, 5, '서버가 로컬 수정본으로 갱신');
    eq(srv.user_games[0].updated_at, iso(T0 + 60000), '서버 updated_at = 수정 시각');
    eq(ls(K1).hs, 5, '로컬 수정이 서버본에 덮이지 않음');
  });
  test('같은 시각이면 올리지도 내려받지도 않는다', async function () {
    await boot();
    seed([G(K1, T0)], { [K1]: T0 + 60000 }); srv.user_games = [UR(K1, T0 + 60000)];
    var s = await runLogin();
    eq(ups(s).length, 0, '업로드 요청 수'); eq(ls(K1).hs, 1, '로컬 불변'); eq(srv.user_games[0].data.hs, 9, '서버 불변');
  });
  test('로컬 수정 시각을 알 수 없는 경기가 서버에 있으면 양쪽 모두 건드리지 않는다', async function () {
    await boot();
    seed([{ key: KU, data: { th: '홈', ta: '원정', hs: 1, as: 0, abs: [], d: '?' } }], {}); srv.user_games = [UR(KU, T0 + 60000)];
    var s = await runLogin();
    eq(ups(s).length, 0, '업로드 요청 수'); eq(ls(KU).hs, 1, '로컬 불변'); eq(srv.user_games[0].data.hs, 9, '서버 불변');
  });
  test('로컬에 없는 서버 경기는 내려받고 목록에 추가한다', async function () {
    await boot();
    seed([], {}); srv.user_games = [UR(K2, T0 + 9000)];
    await runLogin();
    eq(ls(K2).hs, 9, '내려받음');
    ok(ls('sl_saves').some(function (e) { return e.key === K2; }), '목록(sl_saves)에 추가');
    eq(mod(K2), T0 + 9000, '로컬 수정 시각 = 서버 시각');
  });
  test('업로드 오류(권한) → 내려받기는 계속 · 실패 알림', async function () {
    await boot();
    seed([G(K1, T0)], {}); srv.failWrite = { status: 403, code: '42501', message: 'permission denied' };
    var s = await runLogin();
    eq(ups(s).length, 1, '업로드 요청 수'); eq(sels(s).length, 2, '조회 2번(시각 조회 + 내려받기)');
    ok(s.sawFail, '실패 알림이 표시되어야 함');
  });

  // ── 3. 모든 로컬 수정 경로가 sl_cloud_mod 를 갱신하는가 (앱의 실제 함수를 호출) ──
  function setGame() { window.AS.abs = [{ id: 1, res: '안타', ts: '1' }]; }
  test('경로: cloudSave(저장·가져오기·타석 수정이 지나는 길) → 수정 시각 기록', async function () {
    seed([], {});
    var t0 = Date.now(); cloudSave(K1, { ts: T0 }, 'x', T0);
    ok(mod(K1) >= t0 && mod(K1) <= Date.now(), '기록 안 됨: ' + mod(K1));
  });
  test('경로: 저장 — 다시 저장하면 ts(생성 시각)는 그대로, 수정 시각만 앞으로 간다', async function () {
    seed([], {}); window._curSaveKey = null; setGame();
    saveGame(); await sleep(500);
    var k = ls('sl_saves')[0].key, ts1 = ls(k).ts, m1 = mod(k);
    ok(m1 > 0, '새 경기 저장 시 기록 안 됨');
    await sleep(100); saveGame(); await sleep(500);
    eq(ls(k).ts, ts1, '재저장해도 ts 는 생성 시각 그대로(이 테스트의 전제)');
    ok(mod(k) > m1, '재저장 시 수정 시각이 앞으로 가야 함: ' + m1 + ' → ' + mod(k));
  });
  test('경로: 타석 수정 저장 → 수정 시각 기록', async function () {
    seed([G(K1, T0)], {}); setGame();
    var t0 = Date.now(); _saveEditImmediate();
    ok(mod(K1) >= t0, '기록 안 됨: ' + mod(K1));
  });
  test('경로: 가져오기(_doImportText) → 수정 시각 기록', async function () {
    seed([], {});
    var d = {}; d[K1] = { th: '홈', ta: '원정', hs: 3, as: 1, abs: [], d: '2026. 5. 17.', ts: T0 };
    var t0 = Date.now(); _doImportText(JSON.stringify({ saves: [{ key: K1, label: '가져옴', ts: T0 }], data: d }));
    ok(ls(K1) && ls(K1).hs === 3, '가져오기 자체가 안 됨');
    ok(mod(K1) >= t0, '기록 안 됨: ' + mod(K1));
  });
  test('경로: 자동저장 복구(_archQuietSave) — 기존 경기 덮어쓰기 · 새 항목 생성 모두 기록', async function () {
    seed([G(K1, T0)], { [K1]: 1 }); setGame();
    var t0 = Date.now(); _archQuietSave(K1);
    ok(mod(K1) >= t0, '기존 경기 복구 시 기록 안 됨: ' + mod(K1));
    _archQuietSave('sl_9999999999999');   // 어느 경기인지 모르면 새 항목(sl_rec_…)
    var rec = ls('sl_saves').filter(function (e) { return /^sl_rec_/.test(e.key); })[0];
    ok(rec, '복구용 새 항목이 만들어지지 않음');
    ok(mod(rec.key) >= t0, '새 복구 항목 기록 안 됨: ' + mod(rec.key));
  });
  test('경로: 이름 변경은 내용이 안 바뀌므로 수정 시각을 갱신하지 않는다(오래된 기기에서 이름만 바꿔도 낡은 내용이 서버를 덮지 않게)', async function () {
    seed([G(K1, T0)], { [K1]: 777000000000 });
    window.prompt = function () { return '새 이름'; };
    renameGame(K1);
    eq(ls('sl_saves')[0].label, '새 이름', '이름이 바뀌지 않음');
    eq(mod(K1), 777000000000, '이름 변경이 수정 시각을 건드림');
  });

  // ── 4. 전환(맨 처음 한 번): 기록이 없던 기존 경기는 "지금"으로 기록해 예전처럼 로컬이 이긴다 ──
  test('전환: sl_cloud_mod 가 없으면 기존 경기에 지금을 기록 · 두 번째 로드는 건드리지 않음 · 첫 동기화는 로컬이 이긴다', async function () {
    await boot();
    seed([G(K1, T0), G(K2, T0 + 1)], {}); localStorage.removeItem(MOD);
    function loadCloud() {   // cloud.js 를 한 번 더 로드 = 앱 시작 때 전환 처리가 도는 것과 같다(첫 인스턴스의 시작 동기화는 그대로 쓴다)
      return new Promise(function (res, rej) {
        var sc = document.createElement('script'); sc.src = 'js/cloud.js?again=' + Date.now(); sc.onload = res; sc.onerror = function () { rej(new Error('cloud.js 로드 실패')); }; document.body.appendChild(sc);
      });
    }
    // 한 번 더 로드하면 cloud.js 가 window.cloudSave 등 전역 함수를 자기 것으로 덮어쓴다 → 로드 전 것을 저장해 두었다가 되돌려, 이 뒤에 도는 테스트를 오염시키지 않는다
    var keep = {}; Object.keys(window).forEach(function (k) { try { if (typeof window[k] === 'function') keep[k] = window[k]; } catch (e) { /* 접근 불가 속성 */ } });
    function restoreGlobals() { Object.keys(keep).forEach(function (k) { try { if (window[k] !== keep[k]) window[k] = keep[k]; } catch (e) { /* 읽기 전용 */ } }); }
    var t0 = Date.now(); await loadCloud();
    var m = ls(MOD);
    ok(m && m[K1] >= t0 && m[K2] >= t0, '기존 경기에 지금이 기록되지 않음: ' + JSON.stringify(m));
    var snap = JSON.stringify(m); await sleep(50); await loadCloud();
    restoreGlobals();
    eq(JSON.stringify(ls(MOD)), snap, '두 번째 로드가 기록을 바꿈');
    srv.user_games = [UR(K1, T0 + 60000)];   // 서버가 로컬보다 오래된 시각이어도(= 전환 직후) 로컬이 이긴다 — 지금까지와 같은 동작
    var s = await runLogin();
    eq(ups(s).length, 1, '업로드 요청 수');
    eq(srv.user_games.filter(function (r) { return r.game_key === K1; })[0].data.hs, 1, '로컬이 서버를 덮음(전환 직후 한 번)');
  });
})();
