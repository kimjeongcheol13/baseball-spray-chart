// 투수 탭에서만 기록한 경기(타석 0 · 투구 N)가 앱을 다시 열어도 남는지 — core.js _hasAnyRecord 를 쓰는 자동저장(sl_auto_*) · 복구 슬롯(sl_autosave) · 복구 · 복구 저장(_archQuietSave)
//  · 새로고침은 하네스가 막으므로(페이지 재로드 = fatal) 앱을 막 연 상태(AS 비움)를 만들고, 시작할 때 부르는 _checkRecovery(배너) · _openLastGame(자동 복구)을 직접 부른다
//  · 복구된 타석 0 경기가 저장 목록 · 분석 탭(타자 · 투수 · 비교 · 스카우트 · 팀)에서 0 나누기 등으로 깨지지 않는지(오류 0건 · 화면에 NaN/Infinity 없음)도 본다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, ls = T.ls, test = T.test, $ = T.$;
  var F = ['abs', 'home_lineup', 'away_lineup', 'hs', 'as', 'zoneHistory', 'pitchers', 'currentPitcher', 'pitchLog', 'currentPitches', 'info', 'curGame', 'batter', 'balls', 'strikes', 'outs', 'pitcherPt', 'pitcherZone', 'pendingQuickRes'];

  // 앞뒤 테스트에 영향이 없게 localStorage · AS · 저장 키 · 타이머를 되돌린다 (recovery-info.test.js 와 같은 방식)
  async function isolated(fn) {
    var store = {}, a = {}, ck = window._curSaveKey, gs = window._gameSaved, ak = window._autoKey, cs = window.cloudAutoSyncRecord, ap = $('app-page').style.display;
    for (var i = 0; i < localStorage.length; i++) store[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    F.forEach(function (k) { a[k] = AS[k]; });
    window.cloudAutoSyncRecord = null;
    try { await fn(); }
    finally {
      storageManager.cancelPendingAutosave(); clearTimeout(_autoTimer); localStorage.clear();
      Object.keys(store).forEach(function (k) { localStorage.setItem(k, store[k]); });
      F.forEach(function (k) { AS[k] = a[k]; });
      window._curSaveKey = ck; window._gameSaved = gs; window._autoKey = ak; window.cloudAutoSyncRecord = cs;
      var b = $('archRecoveryBanner'); if (b) { b.style.display = 'none'; b.classList.add('arch-rec-hidden'); }
      closeOverlay('loadOverlay'); setPitcherView('mode', 'stats'); shellNav('record');
      $('app-page').style.display = ap;
      renderPitcherRoster();
    }
  }
  // 앱을 막 연 상태: 기록 없음 · 저장 키 없음
  function fresh() {
    AS.abs = []; AS.home_lineup = []; AS.away_lineup = []; AS.hs = 0; AS.as = 0; AS.zoneHistory = {}; AS.info = null;
    AS.pitchers = []; AS.currentPitcher = null; AS.pitchLog = []; AS.currentPitches = []; AS.batter = null; AS.balls = 0; AS.strikes = 0; AS.outs = 0; AS.pendingQuickRes = null;
    AS.curGame = null; window._curSaveKey = null; window._autoKey = null; window._gameSaved = true;
    $('app-page').style.display = 'flex';
  }
  function recEntry() { return ls('sl_saves').filter(function (e) { return /^sl_rec_/.test(e.key); }).map(function (e) { return { e: e, d: ls(e.key) }; })[0]; }
  function autoKeys() { var r = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('sl_auto_') === 0) r.push(k); } return r; }

  test('투구만 기록한 경기: 자동저장 → 앱 다시 열기 → 복구 안내 · 투구 그대로 · 저장 목록에 복구 항목', async function () {
    await isolated(async function () {
      localStorage.clear(); fresh();
      AS.pitchers = [{ id: 'po1', name: '투구만', num: '9', role: 'SP', pitches: [] }];
      window._pitchInnAskedFor = AS.pitchers;   // P1: 경기 첫 공의 이닝 묻기는 tests/pitching-p1.test.js 에서 따로 본다
      selectPitcher('po1'); AS.pitcherPt = '직구'; AS.pitcherZone = '중앙 중간';
      recordPitch('스트라이크'); recordPitch('볼'); recordPitch('스트라이크'); recordPitch('스트라이크');   // 3번째 스트라이크 = 삼진, 타자가 없으니 타석은 안 생긴다
      eq(AS.abs.length, 0, '타석 0 (전제)');
      eq(AS.pitchers[0].pitches.map(function (p) { return p.result; }), ['스트라이크', '볼', '스트라이크', '삼진'], '투구 4구');
      ok(_hasAnyRecord(), '투구만 있어도 기록이 있다');
      eq(_recordCountTxt(), '투구 4구', '기록 수 문구');
      var expected = JSON.stringify(AS.pitchers);

      await T.sleep(3100);   // 복구 슬롯(3초 디바운스)
      var slot = ls('sl_autosave');
      ok(slot && slot.data, '복구 슬롯(sl_autosave)이 적혔다');
      eq(slot.data.abs.length, 0, '복구 슬롯: 타석 0');
      eq(JSON.stringify(slot.data.pitchers), expected, '복구 슬롯: 투수 · 투구 그대로');
      await T.sleep(10100);   // 자동저장(10초)
      var ak = autoKeys();
      eq(ak.length, 1, '자동저장 sl_auto_* 하나');
      eq(JSON.stringify(ls(ak[0]).pitchers), expected, '자동저장: 투수 · 투구 그대로');

      // ── 앱 다시 열기 ──
      fresh();
      _checkRecovery();
      eq($('archRecoveryBanner').style.display, 'block', '복구 배너');
      ok(/투구 4구/.test($('archRecoveryCount').textContent), '배너 문구 — 실제 ' + $('archRecoveryCount').textContent);
      _openLastGame();   // 시작할 때 부르는 자동 복구
      eq(AS.abs.length, 0, '복구: 타석 0');
      eq(JSON.stringify(AS.pitchers), expected, '복구: 투수 · 투구 그대로');
      ok(/복구/.test($('toastTxt').textContent), '복구 안내 토스트 — 실제 ' + $('toastTxt').textContent);
      ok(!localStorage.getItem('sl_autosave'), '복구 뒤 복구 슬롯은 비운다(전제)');
      var r = recEntry();
      ok(r, '저장 목록에 복구 항목');
      ok(/^\[복구\]/.test(r.e.label), '복구 항목 이름 — 실제 ' + r.e.label);
      eq(JSON.stringify(r.d.pitchers), expected, '복구 항목: 투수 · 투구 그대로');
      eq(window._curSaveKey, r.e.key, '그 항목이 지금 경기');
      eq(window._gameSaved, true, '저장된 상태');

      // 투수 탭: 자동 선택 · 투구 수
      shellNav('analysis', 'pitcher'); setPitcherView('mode', 'input');
      eq(AS.currentPitcher && AS.currentPitcher.name, '투구만', '투수 자동 선택');
      ok(/\(4구\)/.test($('pitcherRoster').textContent), '투수 버튼 4구 — 실제 ' + $('pitcherRoster').textContent.trim());
      eq($('pitchLog').querySelectorAll('.pitch-entry').length, 4, '최근 투구 로그 4줄');
    });
  });

  test('복구된 타석 0 경기: 저장 목록 · 분석 탭이 오류 없이 열리고 NaN/Infinity 가 없다', async function () {
    await isolated(async function () {
      localStorage.clear(); fresh();
      var errs = [], onErr = function (e) { errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e)); };
      window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);
      try {
        seedSlot();
        _openLastGame();
        eq(AS.abs.length, 0, '타석 0 복구(전제)'); eq(AS.pitchers[0].pitches.length, 5, '투구 5구 복구(전제)');
        updateAll();
        openLoad();
        ok(/\[복구\]/.test($('loadOverlay').textContent), '저장 목록에 복구 항목이 보인다');
        closeOverlay('loadOverlay');
        var subs = ['batter', 'pitcher', 'compare', 'scout', 'team'], bad = [];
        subs.forEach(function (s) {
          shellNav('analysis', s);
          if (s === 'pitcher') { setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '투구만'); }
          var txt = $('anaBody').textContent;
          if (/NaN|Infinity/.test(txt)) bad.push(s);
        });
        eq(bad, [], '화면에 NaN/Infinity 가 있는 분석 탭');
        ok(/투구만/.test($('anaSecPitcher').textContent), '투수 분석에 그 투수');
        shellNav('record');
        await T.sleep(50);
        eq(errs, [], '오류');
      } finally { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr); }
    });
  });
  function seedSlot() {
    var pz = function (id, result) { return { id: id, inning: '1회초', zone: '중앙 중간', zoneX: 0.5, zoneY: 0.5, pt: '직구', result: result, batter: null, ts: '' }; };
    localStorage.setItem('sl_saves', '[]');
    localStorage.setItem('sl_autosave', JSON.stringify({ _v: 1, _ts: Date.now(), data: {
      abs: [], home_lineup: [], away_lineup: [], hs: 0, as: 0, zoneHistory: {}, th: '내팀', ta: '상대',
      pitchers: [{ id: 'po2', name: '투구만', num: '21', role: 'RP', pitches: [pz(1, '스트라이크'), pz(2, '볼'), pz(3, '파울'), pz(4, '안타'), pz(5, '삼진')] }], saveKey: null
    } }));
  }

  test('기록이 전혀 없으면 전처럼 저장도 복구도 하지 않는다 · 다른 경기 열기 전엔 투구만 있는 경기도 저장한다', async function () {
    await isolated(async function () {
      localStorage.clear(); fresh();
      ok(!_hasAnyRecord(), '빈 경기');
      _scheduleRecoverySave(0); _doAutoSave();
      await T.sleep(50);
      ok(!localStorage.getItem('sl_autosave'), '빈 경기는 복구 슬롯에 안 적는다');
      eq(autoKeys(), [], '빈 경기는 자동저장 안 함');
      localStorage.setItem('sl_autosave', JSON.stringify({ _v: 1, _ts: Date.now(), data: { abs: [], pitchers: [{ id: 'x', name: '빈', pitches: [] }], home_lineup: [], away_lineup: [] } }));
      _checkRecovery();
      ok(!localStorage.getItem('sl_autosave'), '투구 0 · 타석 0 복구본은 버린다');
      ok($('archRecoveryBanner').style.display !== 'block', '배너 없음');

      // 다른 경기를 열기 전 저장(_saveWorkBeforeReplace): 투구만 있어도 저장한다
      AS.pitchers = [{ id: 'po3', name: '투구만', num: '5', role: null, pitches: [{ id: 1, result: '볼', pt: '직구' }] }];
      window._gameSaved = false;
      eq(_saveWorkBeforeReplace(), true, '저장함');
      var r = recEntry();
      ok(r && r.d.pitchers[0].pitches.length === 1, '저장 항목에 투구');
      eq(window._gameSaved, true, '저장된 상태');
    });
  });
})();
