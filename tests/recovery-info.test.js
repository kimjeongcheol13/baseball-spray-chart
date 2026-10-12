// 자동저장 복구가 경기 정보(AS.info — 날짜·구장·홈/원정·이닝, 경기설정 탭)를 잃지 않는지 — core 의 복구 함수를 직접 부른다.
// 배경: 모바일은 core.js 실행 중에 showApp → setTimeout(_openLastGame) 이 걸려, setup.js 가 archRecoverAutosave 를 감싸기 전에 복구가 끝난다.
//       복구는 sl_autosave 를 지우고 _archQuietSave 로 저장 항목을 만드는데, 그 항목에 info 가 없어 새로고침하면 경기 정보가 사라졌다.
//       감싸기(setup.js)는 core 복구가 끝난 뒤에 info 를 넣으므로, 저장 항목에 info 가 있으면 core 가 직접 되살렸다는 뜻이다.
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, ls = T.ls, test = T.test;
  var K1 = 'sl_1779002911000';
  var OLD = { date: '2026-05-01', venue: '잠실', side: 'away', innings: 7 };
  var NEW = { date: '2026-05-17', venue: '목동구장', side: 'home', innings: 9, stadium: 'little' };
  var AB = [{ id: 1, res: '안타', bname: '김', team: 'home', inn: '1회초', x: 0.4, y: 0.4 }];
  var F = ['abs', 'home_lineup', 'away_lineup', 'hs', 'as', 'zoneHistory', 'pitchers', 'info', 'curGame'];

  // 앞뒤 테스트에 영향이 없게 localStorage · AS · 현재 저장 키를 되돌린다.
  // 복구가 부르는 updateAll 의 타이머(실시간 동기화 3초 · 로컬 자동저장 10초)가 뒤 테스트의 가짜 서버 · 저장소에 늦게 닿지 않게 막는다
  async function isolated(fn) {
    var store = {}, a = {}, ck = window._curSaveKey, gs = window._gameSaved, cf = window.confirm, cs = window.cloudAutoSyncRecord;
    for (var i = 0; i < localStorage.length; i++) store[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    F.forEach(function (k) { a[k] = AS[k]; });
    window.cloudAutoSyncRecord = null;
    try { await fn(); }
    finally {
      storageManager.cancelPendingAutosave(); clearTimeout(_autoTimer); localStorage.clear();
      Object.keys(store).forEach(function (k) { localStorage.setItem(k, store[k]); });
      F.forEach(function (k) { AS[k] = a[k]; });
      window._curSaveKey = ck; window._gameSaved = gs; window.confirm = cf; window.cloudAutoSyncRecord = cs;
    }
  }
  function seed(autosave, games) {
    localStorage.clear();
    var saves = [];
    (games || []).forEach(function (g) { localStorage.setItem(g.key, JSON.stringify(g)); saves.push({ key: g.key, label: g.key, ts: 1 }); });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
    if (autosave) localStorage.setItem('sl_autosave', JSON.stringify({ _v: 1, _ts: Date.now(), data: autosave }));
    AS.abs = []; AS.home_lineup = []; AS.away_lineup = []; AS.info = undefined;   // 앱을 막 연 상태
  }
  function game(key, info) { return { key: key, th: '홈', ta: '원정', hs: 0, as: 0, abs: [], home_lineup: [], away_lineup: [], zoneHistory: {}, pitchers: [], d: '2026. 5. 17.', ts: 1, info: info }; }
  function recEntry() { return ls('sl_saves').filter(function (e) { return /^sl_rec_/.test(e.key); }).map(function (e) { return ls(e.key); })[0]; }

  test('자동저장 복구: 새 경기 — 경기 정보가 AS.info 와 복구 저장 항목(sl_rec_…)에 남는다', async function () {
    await isolated(function () {
      seed({ abs: AB, home_lineup: [], away_lineup: [], hs: 1, as: 0, zoneHistory: {}, pitchers: [], info: NEW, saveKey: null });
      archRecoverAutosave();
      eq(AS.info, NEW, 'AS.info');
      ok(!localStorage.getItem('sl_autosave'), '복구 뒤 sl_autosave 는 지워지는 게 전제');
      var r = recEntry();
      ok(r, '복구 저장 항목이 없음');
      eq(r.info, NEW, '복구 저장 항목의 info (새로고침 뒤 restoreGame 이 읽는 값)');
    });
  });
  test('자동저장 복구: 저장한 경기 — 그 경기 항목의 info 를 복구본 값으로 갱신', async function () {
    await isolated(function () {
      seed({ abs: AB, home_lineup: [], away_lineup: [], hs: 1, as: 0, zoneHistory: {}, pitchers: [], info: NEW, saveKey: K1 }, [game(K1, OLD)]);
      archRecoverAutosave();
      eq(AS.info, NEW, 'AS.info');
      eq(ls(K1).info, NEW, '저장 경기의 info');
      eq(ls(K1).abs.length, 1, '기록도 덮어씀(전제)');
    });
  });
  test('자동저장 복구: 복구본에 info 가 없으면(예전 자동저장) 그 경기에 저장된 info 를 유지 · AS.info 도 그 값', async function () {
    await isolated(function () {
      seed({ abs: AB, home_lineup: [], away_lineup: [], hs: 1, as: 0, zoneHistory: {}, pitchers: [], saveKey: K1 }, [game(K1, OLD)]);
      archRecoverAutosave();
      eq(ls(K1).info, OLD, '저장 경기의 info');
      eq(AS.info, OLD, 'AS.info');
    });
  });
  test('숨겨진 자동저장 복구(sl_auto_*): 열려 있던 다른 경기의 info 가 복구한 경기에 적히지 않는다', async function () {
    await isolated(function () {
      seed(null, [game(K1, OLD)]);
      localStorage.setItem('sl_auto_77', JSON.stringify({ abs: AB, hs: 1, as: 0, th: '홈', ta: '원정', home_lineup: [], away_lineup: [], zoneHistory: {}, pitchers: [], saveKey: K1 }));
      AS.info = NEW;   // 지금 열려 있는 다른 경기
      window.confirm = function () { return true; };
      recoverHiddenAutosave('sl_auto_77');
      eq(ls(K1).info, OLD, '저장 경기의 info');
      eq(AS.info, OLD, 'AS.info');
    });
  });
})();
