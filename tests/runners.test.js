// 주자 이름 · 득점 · 도루 (js/features/runners.js) — 경기 운영 모드에서 실제 recHit · recOther · recSB · undoLast 를 그대로 돌린다
//  · 타석 결과대로 주자 이름이 베이스를 따라가고, 홈인한 주자가 그 타석의 scored 에 남는다
//  · 도루 · 도루 실패는 마지막 타석의 runEv 에 남고, 되돌리기는 도루부터 (점수 · 주자 · 아웃 · 끝난 이닝까지)
//  · 이닝별 득점(slLineScore) · 선수별 득점 · 도루(slRunnerStats) · 새로고침 뒤 주자 이름 복구
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var F = ['abs', 'home_lineup', 'away_lineup', 'hs', 'as', 'zoneHistory', 'pitchers', 'currentPitcher', 'pitchLog', 'currentPitches', 'info', 'curGame', 'batter', 'balls', 'strikes', 'outs', 'curTeam', 'pendingQuickRes'];
  var GK = ['active', 'inning', 'half', 'outs', 'batterIdx', 'bases', 'runners'];

  async function isolated(fn) {
    var store = {}, a = {}, g = {}, ck = window._curSaveKey, gs = window._gameSaved, ak = window._autoKey, cs = window.cloudAutoSyncRecord;
    for (var i = 0; i < localStorage.length; i++) store[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    F.forEach(function (k) { a[k] = AS[k]; });
    GK.forEach(function (k) { g[k] = GF[k]; });
    window.cloudAutoSyncRecord = function () {};
    try { await fn(); }
    finally {
      gfDeactivate();
      GK.forEach(function (k) { GF[k] = g[k]; });
      storageManager.cancelPendingAutosave(); clearTimeout(_autoTimer); localStorage.clear();
      Object.keys(store).forEach(function (k) { localStorage.setItem(k, store[k]); });
      F.forEach(function (k) { AS[k] = a[k]; });
      $('scH').textContent = AS.hs; $('scA').textContent = AS.as;
      window._curSaveKey = ck; window._gameSaved = gs; window._autoKey = ak; window.cloudAutoSyncRecord = cs;
      var p = $('slRunPick'); if (p) p.remove();
      var b = $('archRecoveryBanner'); if (b) { b.style.display = 'none'; b.classList.add('arch-rec-hidden'); }
      try { renderLP(); renderRecs(); renderCount(); shellNav('record'); } catch (e) {}
    }
  }
  function fresh() {
    AS.abs = []; AS.hs = 0; AS.as = 0; AS.zoneHistory = {}; AS.info = null;
    AS.pitchers = []; AS.currentPitcher = null; AS.pitchLog = []; AS.currentPitches = []; AS.batter = null; AS.balls = 0; AS.strikes = 0; AS.outs = 0; AS.pendingQuickRes = null;
    AS.curGame = null; window._curSaveKey = null; window._autoKey = null; window._gameSaved = true;
    $('app-page').style.display = 'flex';
    $('innSel').selectedIndex = 0;
    $('scH').textContent = '0'; $('scA').textContent = '0';
  }
  function start() {
    fresh();
    AS.curTeam = 'home';
    AS.home_lineup = ['일번', '이번', '삼번', '사번'].map(function (n, i) { return { id: 'rn' + (i + 1), name: n, num: String(i + 1), pos: '', bh: '', isStarter: true }; });
    AS.away_lineup = [{ id: 'ra1', name: '원정일', num: '11', pos: '', bh: '', isStarter: true }];
    renderLP();
    gfActivate();
  }
  var gap = function () { return T.sleep(750); };   // recHit · recOther 연타 방지(0.7초)
  async function hit(res) { await gap(); AS.pending = { x: 0.45, y: 0.35, deg: 85, dir: 'CF', ft: 250 }; AS.rbi = 0; recHit(res); }
  async function other(res) { await gap(); recOther(res); }
  var names = function () { return GF.runners.map(function (r) { return r && r.name; }); };
  var who = function (list) { return (list || []).map(function (r) { return r.name; }); };

  test('안타 · 볼넷 · 2루타: 주자 이름이 베이스를 따라가고 홈인한 주자가 그 타석에 남는다', async function () {
    await isolated(async function () {
      start();
      await hit('안타');
      eq(names(), ['일번', null, null], '안타 → 1루 일번'); eq(AS.abs[0].scored, [], '득점 없음(경기 운영 모드 타석 표시)');
      await other('볼넷');
      eq(names(), ['이번', '일번', null], '볼넷 → 밀어내기');
      await hit('2루타');
      eq(who(AS.abs[2].scored), ['일번'], '2루 주자 홈인'); eq(names(), [null, '삼번', '이번'], '1루 → 3루 · 타자 2루');
      eq(AS.hs, 1, '점수');
      ok(/홈인 일번/.test($('toastTxt').textContent), '알림에 홈인 주자: ' + $('toastTxt').textContent);
      await T.sleep(50);   // 경기 운영 바는 다음 프레임에 그린다 (core.js gfAfterRecord)
      ok($('gfbRunners'), '경기 운영 바에 주자 칸');
      eq($('gfbRunners').textContent, '2루 삼번 · 3루 이번', '주자 표시');
      eq($('gfbB3').title, '3루 주자 이번', '베이스 설명');
      await hit('홈런');
      eq(who(AS.abs[3].scored), ['이번', '삼번', '사번'], '홈런: 앞 주자부터 · 타자 포함'); eq(names(), [null, null, null], '베이스 비움'); eq(AS.hs, 4, '점수');
    });
  });

  test('도루 · 도루 실패 · 되돌리기 · 이닝별 득점 · 선수별 득점 · 도루', async function () {
    await isolated(async function () {
      start();
      await hit('안타'); await other('볼넷'); await hit('2루타');   // 1점 · 2루 삼번 · 3루 이번
      recSB(true);   // 다음 베이스가 빈 주자는 3루 이번뿐 → 바로 홈스틸
      eq(names(), [null, '삼번', null], '3루 주자 홈인'); eq(AS.hs, 2, '홈스틸 득점');
      var ev = AS.abs[2].runEv;
      eq(ev.length, 1, '마지막 타석 뒤 도루'); eq([ev[0].t, ev[0].name, ev[0].from, ev[0].scored, ev[0].team, ev[0].inn], ['SB', '이번', 2, true, 'home', '1회초'], '도루 기록');
      undoLast();
      eq(AS.abs.length, 3, '타석은 그대로'); ok(!AS.abs[2].runEv, '도루만 취소'); eq(names(), [null, '삼번', '이번'], '주자 되돌림'); eq(AS.hs, 1, '점수 되돌림');
      recSB(true);   // 다시 홈스틸
      recSB(false);  // 2루 삼번 3루 도루 실패
      eq(names(), [null, null, null], '주자 지움'); eq(GF.outs, 1, '1아웃');
      eq(slLineScore(AS.abs), { away: [], home: [2] }, '이닝별 득점: 2루타 득점 + 홈스틸');
      eq(slRunnerStats(AS.abs, AS.home_lineup[0]), { r: 1, sb: 0, cs: 0 }, '일번');
      eq(slRunnerStats(AS.abs, AS.home_lineup[1]), { r: 1, sb: 1, cs: 0 }, '이번');
      eq(slRunnerStats(AS.abs, AS.home_lineup[2]), { r: 0, sb: 0, cs: 1 }, '삼번');
      renderPsTable();
      ok(/1득점 1도루/.test($('psTable').textContent), '선수별 통계에 득점 · 도루: ' + $('psTable').textContent);
    });
  });

  test('도루할 주자가 둘이면 고르기 · 도루 실패로 끝난 이닝도 되돌린다', async function () {
    await isolated(async function () {
      start();
      await hit('안타'); await hit('3루타');   // 1점 · 3루 이번 → 1루는 비었음
      await hit('안타');   // 3루 이번 홈인 · 1루 삼번
      eq(names(), ['삼번', null, null], '전제');
      GF.bases[2] = true; gfUpdateBar();   // 손으로 3루에 주자 (이름 모름)
      recSB(true);
      var box = $('slRunPick');
      ok(box, '주자 고르기'); eq(Array.prototype.map.call(box.querySelectorAll('button'), function (b) { return b.textContent; }), ['1루 삼번 → 2루', '3루 주자 → 홈', '취소'], '고를 수 있는 주자');
      box.querySelectorAll('button')[0].click();
      ok(!$('slRunPick'), '닫힘'); eq(names(), [null, '삼번', null], '1루 → 2루'); eq(GF.bases, [false, true, true], '3루 주자는 그대로');
      GF.outs = 2;
      recSB(false);   // 다음 베이스가 빈 주자: 3루(이름 모름) 하나 → 바로 도루 실패 = 3아웃
      eq([GF.half, GF.outs, GF.bases], ['bottom', 0, [false, false, false]], '3아웃 → 말 공격');
      undoLast();
      eq([GF.half, GF.outs, GF.bases, names()], ['top', 2, [false, true, true], [null, '삼번', null]], '끝난 이닝을 되돌림');
      eq(AS.batter && AS.batter.name, '사번', '그 타순 타자');
    });
  });

  test('새로고침 뒤에도 주자 이름이 그대로', async function () {
    await isolated(async function () {
      localStorage.clear(); start();
      await hit('안타'); await other('볼넷');
      eq(names(), ['이번', '일번', null], '전제');
      _scheduleRecoverySave(0);
      await T.sleep(50);
      gfDeactivate(); GF.inning = 1; GF.half = 'top'; GF.outs = 0; GF.batterIdx = 0; GF.bases = [false, false, false]; GF.runners = [null, null, null];
      fresh(); AS.home_lineup = []; AS.away_lineup = []; AS.curTeam = 'home'; _openLastGame();   // 앱을 막 연 상태 (명단도 비어 있어야 복구한다)
      await T.sleep(400);   // 경기 운영 모드 복구는 200ms 뒤
      eq([GF.active, GF.bases, names()], [true, [true, true, false], ['이번', '일번', null]], '주자 이름 복구');
      await hit('안타');
      eq(names(), ['삼번', '이번', '일번'], '이어서 진루');
    });
  });

  test('경기 운영 모드가 아니면 도루는 예전처럼 안내만 · 이닝별 득점 없음', async function () {
    await isolated(async function () {
      fresh(); gfDeactivate();
      AS.curTeam = 'home'; AS.home_lineup = [{ id: 'rx1', name: '보통', num: '1', pos: '', bh: '', isStarter: true }]; renderLP(); selBatter('rx1');
      await hit('안타');
      ok(!('scored' in AS.abs[0]), '득점 항목 없음');
      recSB(true);
      ok(!AS.abs[0].runEv, '도루 기록 없음'); eq($('toastTxt').textContent, '도루 성공', '안내');
      eq(slLineScore(AS.abs), null, '이닝별 득점 없음');
    });
  });
})();
