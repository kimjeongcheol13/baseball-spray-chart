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
    // 투수 탭 화면도 막 연 상태(index.html 그대로)로 — 앞에서 그린 목록이 남아 있으면 복구 뒤 다시 그리지 않아도 검사가 통과해 버린다
    $('pitchLog').innerHTML = '<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">투구를 기록하면 여기에 표시됩니다</div>';
    $('pitcherRoster').innerHTML = '<div style="font-size:11px;color:var(--text3)">투수를 등록하세요</div>';
    $('innSel').selectedIndex = 0;   // 이닝도 처음(1회초)
  }
  function recEntry() { return ls('sl_saves').filter(function (e) { return /^sl_rec_/.test(e.key); }).map(function (e) { return { e: e, d: ls(e.key) }; })[0]; }
  function autoKeys() { var r = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('sl_auto_') === 0) r.push(k); } return r; }

  test('투구만 기록한 경기: 자동저장 → 앱 다시 열기 → 복구 안내 · 투구 그대로 · 저장 목록에 복구 항목', async function () {
    await isolated(async function () {
      localStorage.clear(); fresh();
      AS.pitchers = [{ id: 'po1', name: '투구만', num: '9', role: 'SP', pitches: [] }];
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
      eq(AS.pitchLog.map(function (p) { return p.result; }), ['삼진', '스트라이크', '볼', '스트라이크'], '복구: 전체 투구 로그도 다시 만든다(최근 공부터)');
      eq($('pitchLog').querySelectorAll('.pitch-entry').length, 4, '복구 직후 최근 투구 로그 4줄 (투수 선택 전)');
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

  // 기록 탭의 이번 타석 투구(AS.currentPitches) · 볼카운트는 저장되지 않는다 → 새로고침하면 「현재 타자 · 0구째」였다. 투수 탭 공으로 되살린다
  test('새로고침 뒤에도 아직 안 끝난 타석이 이어진다 — 타자 · 볼카운트 · 이번 타석 투구 (복구 슬롯 · 저장 목록 두 경로)', async function () {
    await isolated(async function () {
      var b0 = AS.batter, f0 = AS.batterFilter, t0 = AS.curTeam, cs0 = window.cloudAutoSyncRecord;
      try {
        localStorage.clear(); fresh();
        AS.curTeam = 'home';
        AS.home_lineup = [{ id: 'rl1', name: '첫타자', num: '1', pos: '', bh: '', isStarter: true }, { id: 'rl2', name: '둘째타자', num: '2', pos: '', bh: '', isStarter: true }];
        renderLP(); selBatter('rl1');
        AS.pitchers = [{ id: 'rp1', name: '이어던지기', num: '18', role: null, pitches: [] }];
        selectPitcher('rp1'); AS.pitcherPt = '직구'; AS.pitcherZone = '중앙 중간';
        recordPitch('스트라이크'); recordPitch('스트라이크'); recordPitch('스트라이크');   // 첫타자 삼진 → 둘째타자
        eq(AS.batter && AS.batter.id, 'rl2', '다음 타자(전제)');
        await T.sleep(750);
        recordPitch('볼'); recordPitch('스트라이크'); recordPitch('파울');   // 둘째타자 1-2, 안 끝남
        eq([AS.balls, AS.strikes, AS.currentPitches.length], [1, 2, 3], '1-2 · 3구째(전제)');
        await T.sleep(3100);   // 복구 슬롯(3초 디바운스)
        ok(localStorage.getItem('sl_autosave'), '복구 슬롯(전제)');
        var check = async function (how) {
          eq(AS.batter && AS.batter.name, '둘째타자', how + ': 그 타자');
          eq(AS.currentPitches.map(function (x) { return x.result; }), ['볼', '스트라이크', '파울'], how + ': 이번 타석 투구');
          eq(AS.currentPitches.map(function (x) { return [x.balls, x.strikes]; }), [[0, 0], [1, 0], [1, 1]], how + ': 던지기 직전 카운트');
          eq([AS.balls, AS.strikes], [1, 2], how + ': 볼카운트');
          eq(AS.currentPitcher && AS.currentPitcher.name, '이어던지기', how + ': 투수');
          eq(AS.batterFilter, false, how + ': 필드를 그 타자로 거르지 않음');
          await T.sleep(50);
          eq($('linkBadgePitchCount').textContent, '3', how + ': 현재 타자 N구째');
        };
        fresh(); _openLastGame();   // 새로고침 1 — 복구 슬롯
        await check('복구 슬롯');
        ok(!localStorage.getItem('sl_autosave'), '복구 뒤 복구 슬롯은 비운다(전제)');
        fresh(); _openLastGame();   // 새로고침 2 — 저장 목록의 [복구] 항목
        await check('저장 목록');
        await T.sleep(750);
        recordPitch('스트라이크');   // 이어서 던지면 같은 타석이 끝난다
        eq(AS.abs.length, 2, '타석 2'); eq(AS.abs[1].res, '삼진', '삼진'); eq(AS.abs[1].bname, '둘째타자', '그 타자');
        eq(AS.abs[1].pitches.length, 4, '타석에 4구'); eq(AS.pitchers[0].pitches.length, 7, '투수 쪽 7구 (중복 없음)');
        // 끝난 타석뿐이면 되살릴 것이 없다
        await T.sleep(3100);
        fresh(); _openLastGame();
        eq(AS.currentPitches.length, 0, '안 끝난 타석 없음'); eq([AS.balls, AS.strikes], [0, 0], '0-0'); eq(AS.batter && AS.batter.name, '첫타자', '다음 타자(타순이 돌아 첫타자)는 진행 상태로 남는다');
      } finally { AS.batter = b0; AS.batterFilter = f0; AS.curTeam = t0; window.cloudAutoSyncRecord = cs0; renderLP(); }
    });
  });

  // 기록 탭만 쓴 경기: B·S·O 버튼 · 이닝 · 고른 타자 · 코스로 넣은 공(이번 타석 투구)도 새로고침 뒤에 남는다 (복구 슬롯 · 저장 항목의 live)
  test('기록 탭 진행 상태(이닝 · 볼카운트 · 아웃 · 타자 · 이번 타석 투구)가 새로고침 뒤에도 남는다 — 복구 슬롯 · 저장 목록', async function () {
    await isolated(async function () {
      var b0 = AS.batter, f0 = AS.batterFilter, t0 = AS.curTeam, z0 = [AS.zone, AS.pt];
      try {
        localStorage.clear(); fresh();
        AS.curTeam = 'home';
        AS.home_lineup = [{ id: 'lv1', name: '첫타자', num: '1', pos: '', bh: '', isStarter: true }, { id: 'lv2', name: '둘째타자', num: '2', pos: '', bh: '', isStarter: true }];
        renderLP(); selBatter('lv1');
        recOther('삼진');   // 기록이 하나는 있어야 저장 · 복구한다 → 둘째타자로
        eq(AS.batter && AS.batter.id, 'lv2', '다음 타자(전제)');
        recStepInning(5);   // 3회말
        chCount('o'); chCount('o'); chCount('b'); chCount('s');
        AS.zone = '내각 낮음'; AS.pt = '커브'; logPitchAction();   // 기록 탭 코스 · 구종으로 넣은 공
        eq([$('innSel').value, AS.balls, AS.strikes, AS.outs, AS.currentPitches.length], ['3회말', 1, 1, 2, 1], '진행 상태(전제)');
        _scheduleRecoverySave(0);   // 페이지 숨김 · 새로고침 직전 — 지금 바로 적는다
        var live = (ls('sl_autosave') || {}).data;
        ok(live && live.live, '복구 슬롯에 진행 상태 (지연 0 = 바로 기록)');
        eq([live.live.inn, live.live.b, live.live.s, live.live.o, live.live.bid, live.live.pitches.length], ['3회말', 1, 1, 2, 'lv2', 1], '슬롯 내용');
        var check = function (how) {
          eq($('innSel').value, '3회말', how + ': 이닝');
          eq([AS.balls, AS.strikes, AS.outs], [1, 1, 2], how + ': 볼카운트 · 아웃');
          eq(AS.batter && AS.batter.name, '둘째타자', how + ': 타자'); eq(AS.batterFilter, false, how + ': 필드는 거르지 않음');
          eq(AS.currentPitches.map(function (x) { return [x.zone, x.pt]; }), [['내각 낮음', '커브']], how + ': 이번 타석 투구');
          ok(Array.prototype.filter.call(document.querySelectorAll('#cntOuts .cnt-dot'), function (d) { return d.classList.contains('lit-o'); }).length === 2, how + ': 아웃 표시');
        };
        fresh(); _openLastGame();   // 새로고침 1 — 복구 슬롯
        check('복구 슬롯');
        ok(!localStorage.getItem('sl_autosave'), '복구 뒤 복구 슬롯은 비운다(전제)');
        fresh(); _openLastGame();   // 새로고침 2 — 저장 목록의 [복구] 항목
        check('저장 목록');
        // 이어서: 볼카운트가 그대로 이어져 3번째 스트라이크에서 삼진
        chCount('s'); await T.sleep(750); chCount('s');
        eq(AS.abs.length, 2, '이어서 기록'); eq(AS.abs[1].res, '삼진', '삼진'); eq(AS.abs[1].count, { b: 1, s: 2, o: 2 }, '기록 시점 카운트');
        // 목록에서 직접 연 경기는 예전처럼 처음 상태
        var key = window._curSaveKey;
        saveGame(true);
        fresh(); restoreGame(key);
        eq([AS.balls, AS.strikes, AS.outs, AS.batter], [0, 0, 0, null], '목록에서 연 경기는 처음 상태');
      } finally { AS.batter = b0; AS.batterFilter = f0; AS.curTeam = t0; AS.zone = z0[0]; AS.pt = z0[1]; $('innSel').selectedIndex = 0; renderLP(); renderCount(); }
    });
  });

  test('저장된 진행 상태 값 거르기: 범위 밖 숫자 · 없는 이닝 · 명단에 없는 타자 · 이상한 공은 쓰지 않는다', async function () {
    await isolated(async function () {
      var b0 = AS.batter, t0 = AS.curTeam;
      try {
        fresh();
        AS.home_lineup = [{ id: 'lz1', name: '가', num: '1', pos: '', bh: '', isStarter: true }];
        _applyLive({ inn: '<b>x</b>', b: 99, s: -3, o: '2', team: 'home', bid: 'nobody', pit: 'nobody',
          pitches: [null, 5, { zone: '<img src=x onerror=alert(1)>', pt: 7, x: 'a', y: 0.5, balls: 9, strikes: 9, outs: 9, ts: {}, result: ['볼'], pid: 'p' }] });
        eq($('innSel').value, '1회초', '없는 이닝은 무시');
        eq([AS.balls, AS.strikes, AS.outs], [3, 0, 2], '범위 안으로');
        eq(AS.batter, null, '명단에 없는 타자는 고르지 않음'); eq(AS.currentPitcher, null, '없는 투수는 고르지 않음');
        eq(AS.currentPitches, [{ zone: '<img src=x onerror=alert(1)>', pt: null, x: null, y: 0.5, balls: 3, strikes: 2, outs: 2, pitcher: '', ts: '', result: null, pid: null }], '객체만 · 필드 모양 고정');
        ok(!document.querySelector('#mobPitchLogList img'), '모바일 투구 목록에 태그로 들어가지 않음');
      } finally { AS.batter = b0; AS.curTeam = t0; AS.balls = 0; AS.strikes = 0; AS.outs = 0; AS.currentPitches = []; renderCount(); }
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
