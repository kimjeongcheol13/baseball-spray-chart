// 주자 이름 · 득점 · 도루 (js/features/runners.js) — 경기 운영 모드에서 실제 recHit · recOther · recSB · undoLast 를 그대로 돌린다
//  · 타석 결과대로 주자 이름이 베이스를 따라가고, 홈인한 주자가 그 타석의 scored 에 남는다
//  · 도루 · 도루 실패는 마지막 타석의 runEv 에 남고, 되돌리기는 도루부터 (점수 · 주자 · 아웃 · 끝난 이닝까지)
//  · 이닝별 득점(slLineScore) · 선수별 득점 · 도루(slRunnerStats) · 새로고침 뒤 주자 이름 복구
//  · 이름 없는 주자(이 기능 전에 시작한 경기)는 이번 이닝 타석 기록으로 채운다
//  · 이닝이 바뀌면 타순을 이어 가고, 지우개는 주자 · 아웃 · 점수 · 타자까지 되돌린다 · 병살 · 폭투 · 포일 · 견제사
//  · 실책 · 야수선택은 타자 1루(야수선택은 아웃된 주자를 고른다) · 병살은 0아웃이면 나머지 주자 진루(3루 주자 득점) · 폭투 · 포일은 진루한 주자를 고른다 · 교체(대타 · 대주자 · 대수비 · 투수) · 타순은 주전만
//  · 저장 목록에서 다시 열면 이어서 기록할지 묻는다(저장 항목 live.gf)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var F = ['abs', 'home_lineup', 'away_lineup', 'hs', 'as', 'zoneHistory', 'pitchers', 'currentPitcher', 'pitchLog', 'currentPitches', 'info', 'curGame', 'batter', 'balls', 'strikes', 'outs', 'curTeam', 'pendingQuickRes'];
  var GK = ['active', 'inning', 'half', 'first', 'outs', 'batterIdx', 'bases', 'runners'];

  // 경기 운영 바(주자 칸 · 베이스 설명)는 타석 기록 뒤 다음 프레임에 그린다(core.js gfAfterRecord → requestAnimationFrame → gfUpdateBar → paint).
  // 하네스(가상 시간 · CI 는 크롬 두 개를 같이 돌린다)에서는 그 프레임이 테스트의 50ms 대기보다 늦을 때가 있어 "주자 표시"가 직전 타석 글자로 남았다
  // (rAF 를 300ms 늦추면 CI 와 같은 실패가 그대로 난다) → 테스트 동안만 rAF 를 16ms 타이머로 (field-out-tap 테스트와 같은 방법)
  async function isolated(fn) {
    var store = {}, a = {}, g = {}, ck = window._curSaveKey, gs = window._gameSaved, ak = window._autoKey, cs = window.cloudAutoSyncRecord, raf = window.requestAnimationFrame;
    for (var i = 0; i < localStorage.length; i++) store[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    F.forEach(function (k) { a[k] = AS[k]; });
    GK.forEach(function (k) { g[k] = GF[k]; });
    window.cloudAutoSyncRecord = function () {};
    window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); };
    try { await fn(); }
    finally {
      window.requestAnimationFrame = raf;
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
    GF.first = 'home';   // 아래 테스트들은 우리 팀(홈) 선공 — 1회초에 일번부터 (기본 원정 선공은 따로 본다)
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
      // 경기 운영 바는 다음 프레임(rAF)에 그린다 (core.js gfAfterRecord). 이 하네스는 가상 시간이라 프레임이 제때 안 올 때가 있다
      // (CI에서 50ms 뒤에도 볼넷 때 글자 "1루 이번 · 2루 일번"이 남아 두 번 실패) → 바로 그려서 읽는다 (gameone-import 의 sbRenderNow 와 같은 방식)
      gfUpdateBar();
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

  test('경기 운영 모드를 켤 때 선공 팀을 고른다 — 기본은 원정 선공(1회초 = 원정 공격) · 득점 · 이닝 전환 · 새로고침', async function () {
    var th = $('tHome').value, ta = $('tAway').value;
    await isolated(async function () {
      localStorage.clear(); fresh(); gfDeactivate();
      AS.curTeam = 'home'; $('tHome').value = '우리팀'; $('tAway').value = '상대팀';
      AS.home_lineup = ['일번', '이번'].map(function (n, i) { return { id: 'rn' + (i + 1), name: n, num: String(i + 1), pos: '', bh: '', isStarter: true }; });
      AS.away_lineup = ['원정일', '원정이', '원정삼'].map(function (n, i) { return { id: 'ra' + (i + 1), name: n, num: String(11 + i), pos: '', bh: '', isStarter: true }; });
      renderLP();
      var txt = function () { return Array.prototype.map.call($('slRunPick').querySelectorAll('button'), function (b) { return b.textContent; }); };
      gfToggle();
      eq(txt(), ['상대팀 먼저 — 우리 팀 후공 (기본)', '우리팀 먼저 — 우리 팀 선공', '취소'], '선공 고르기');
      $('slRunPick').querySelector('.x').click();
      ok(!GF.active && !$('slRunPick'), '취소하면 켜지 않는다');
      gfToggle(); $('slRunPick').querySelector('button').click();
      eq([GF.active, GF.first, gfInnStr(), AS.curTeam, AS.batter && AS.batter.name], [true, 'away', '1회초', 'away', '원정일'], '1회초 = 원정 공격');
      await hit('안타'); await hit('홈런');
      eq([AS.as, AS.hs, AS.abs[1].team, $('scA').textContent], [2, 0, 'away', '2'], '원정 득점');
      await other('삼진'); await other('삼진'); await other('삼진');
      eq([gfInnStr(), AS.curTeam, AS.batter && AS.batter.name], ['1회말', 'home', '일번'], '1회말 = 우리 팀 공격');
      gfScoreAtk(1);
      eq([AS.hs, AS.as], [1, 2], '공격 팀 득점 + 는 우리 팀');
      eq(slLineScore(AS.abs).away, [2], '이닝별 득점: 원정 1회');
      _scheduleRecoverySave(0);
      await T.sleep(50);
      gfDeactivate(); GF.first = 'home'; GF.inning = 1; GF.half = 'top'; GF.outs = 0; GF.batterIdx = 0; GF.bases = [false, false, false];
      fresh(); AS.home_lineup = []; AS.away_lineup = []; AS.curTeam = 'away'; _openLastGame();   // 앱을 막 연 상태
      await T.sleep(400);   // 경기 운영 모드 복구는 200ms 뒤
      eq([GF.active, GF.first, gfInnStr(), AS.curTeam, AS.batter && AS.batter.name], [true, 'away', '1회말', 'home', '일번'], '새로고침 뒤에도 선공 팀 그대로');
      await other('삼진'); await other('삼진'); await other('삼진');
      eq([gfInnStr(), AS.curTeam, AS.batter && AS.batter.name], ['2회초', 'away', '원정삼'], '2회초 = 원정 · 1회초 마지막 타자 다음');
    });
    $('tHome').value = th; $('tAway').value = ta;
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

  test('이 기능 전에 시작한 경기(베이스만 있고 이름 없음): 이번 이닝 타석으로 이름을 채운다 · 손으로 켠 베이스는 그대로 주자', async function () {
    await isolated(async function () {
      start();
      await hit('안타'); await other('볼넷');
      GF.runners = [null, null, null];   // 예전 버전이 남긴 상태
      gfUpdateBar();
      eq(names(), ['이번', '일번', null], '이번 이닝 타석으로 채움');
      eq($('gfbRunners').textContent, '1루 이번 · 2루 일번', '막대 글자');
      await gap();
      GF.runners = [null, null, null];   // 막대를 다시 그리기 전에 쳐도 진루 · 홈인에 이름이 쓰인다
      AS.pending = { x: 0.45, y: 0.35, deg: 85, dir: 'CF', ft: 250 }; AS.rbi = 0; recHit('2루타');
      eq(who(AS.abs[2].scored), ['일번'], '홈인 이름'); eq(names(), [null, '삼번', '이번'], '진루');
      gfToggleBase(0); gfUpdateBar();   // 손으로 켠 1루 — 기록과 베이스 모양이 달라 채우지 않는다 · 누군지 묻는 창은 취소
      $('slRunPick').querySelector('.x').click();
      eq(names(), [null, '삼번', '이번'], '손으로 켠 베이스는 이름 없음');
      eq($('gfbRunners').textContent, '1루 주자 · 2루 삼번 · 3루 이번', '막대 글자');
    });
  });

  function txt() { return Array.prototype.map.call($('slRunPick').querySelectorAll('button'), function (b) { return b.textContent; }); }
  function tap(t) { Array.prototype.find.call($('slRunPick').querySelectorAll('button'), function (b) { return b.textContent === t; }).click(); }

  test('손으로 켠 베이스는 누가 나갔는지 고른다 — 진루타로 옮긴 주자 · 마지막 타자 · 취소하면 이름 없는 주자', async function () {
    await isolated(async function () {
      start();
      await hit('안타'); await other('실책');   // 이번 실책 — 타자 1루 · 1루 주자 2루
      eq([GF.bases, names()], [[true, true, false], ['이번', '일번', null]], '실책 = 타자 1루 · 밀려난 주자 한 베이스');
      await other('땅볼 아웃');   // 삼번 진루타 — core.js 는 땅볼 아웃에 주자를 옮기지 않아 손으로 옮긴다
      gfToggleBase(2);
      eq(txt(), ['2루 일번 → 3루', '1루 이번 → 3루', '타자 삼번 (땅볼 아웃)', '4번 사번', '취소'], '3루 후보: 아래 주자 · 마지막 타자 · 베이스에 없는 주전');
      tap('2루 일번 → 3루');
      ok(!$('slRunPick'), '닫힘'); eq([GF.bases, names()], [[true, false, true], ['이번', null, '일번']], '2루 주자가 3루로');
      gfToggleBase(1); tap('1루 이번 → 2루');
      eq([GF.bases, names(), $('gfbRunners').textContent], [[false, true, true], [null, '이번', '일번'], '2루 이번 · 3루 일번'], '진루타로 한 베이스씩');
      gfToggleBase(0); $('slRunPick').querySelector('.x').click(); gfUpdateBar();   // 막대는 다음 프레임에 그린다 — 여기서는 바로
      eq([GF.bases[0], names()[0], $('gfbRunners').textContent], [true, null, '1루 주자 · 2루 이번 · 3루 일번'], '취소하면 이름 없는 주자');
      gfToggleBase(0);
      ok(!$('slRunPick') && !GF.bases[0], '끌 때는 묻지 않는다');
    });
  });

  test('희타: 주자 모두 한 베이스씩 (3루 주자는 홈 · 타점) · 알림 · 다음 타석 상황 · 2아웃이면 이닝 끝', async function () {
    await isolated(async function () {
      start();
      await hit('안타');   // 일번 1루
      await other('희타');   // 이번
      eq([GF.outs, GF.bases, names()], [1, [false, true, false], [null, '일번', null]], '1루 주자 → 2루 · 1아웃');
      ok(/주자 한 칸씩 진루 — 다르면 베이스를 눌러 고치세요/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      await hit('안타');   // 삼번 — 2루 일번 → 3루
      eq([AS.abs[2].gfPre.outs, AS.abs[2].gfPre.bases], [1, [false, true, false]], '다음 타석 직전 = 2루 1사 (예전엔 1루 1사)');
      eq(names(), ['삼번', null, '일번'], '1 · 3루');
      await other('희타');   // 사번 스퀴즈
      eq([GF.outs, GF.bases, names(), AS.hs], [2, [false, true, false], [null, '삼번', null], 1], '3루 주자 홈 · 1루 주자 2루 · 2아웃');
      eq([who(AS.abs[3].scored), AS.abs[3].rbi], [['일번'], 1], '홈인 · 1타점');
      ok(/홈인 일번 \(1타점\) · 주자 한 칸씩 진루/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      await other('희타');   // 일번 — 2아웃이라 타자 아웃으로 이닝 끝
      eq([AS.hs, who(AS.abs[4].scored), AS.abs[4].rbi, GF.half, GF.outs, GF.bases], [1, [], 0, 'bottom', 0, [false, false, false]], '득점 없이 3아웃 · 공수 교대');
    });
  });

  test('실책 · 야수선택: 타자 1루 — 야수선택은 누가 아웃됐는지 고른다 · 3아웃이면 이닝 끝 · 지우개로 되돌린다', async function () {
    await isolated(async function () {
      start();
      await other('실책');   // 일번 — 주자 없음
      eq([GF.outs, GF.bases, names()], [0, [true, false, false], ['일번', null, null]], '실책: 타자 1루');
      ok(!$('slRunPick'), '실책은 묻지 않는다');
      await other('야수선택');   // 이번
      eq(txt(), ['1루 주자 일번 아웃', '아웃 없음 — 모두 세이프', '취소'], '누가 아웃됐나요');
      eq([GF.outs, names()], [0, ['이번', '일번', null]], '고르기 전 = 모두 세이프');
      tap('1루 주자 일번 아웃'); gfUpdateBar();
      eq([GF.outs, GF.bases, names(), AS.abs[1].fco, $('gfbRunners').textContent], [1, [true, false, false], ['이번', null, null], 0, '1루 이번'], '1루 주자 아웃 · 1아웃');
      ok(/일번 아웃/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      GF.runners = [null, null, null]; gfUpdateBar();   // 이름 없는 주자 → 이번 이닝 기록(fco 포함)으로 다시 채운다
      eq(names(), ['이번', null, null], 'backfill 도 아웃된 주자를 뺀다');
      await other('삼진');   // 삼번 — 2아웃
      await other('야수선택');   // 사번
      tap('1루 주자 이번 아웃');
      eq([GF.half, GF.outs, GF.bases, AS.curTeam], ['bottom', 0, [false, false, false], 'away'], '3아웃 — 1회말');
      undoLast();
      eq([GF.half, GF.outs, names(), AS.abs.length, AS.batter && AS.batter.name], ['top', 2, ['이번', null, null], 3, '사번'], '되돌림 — 1회초 2아웃 1루 이번 · 사번 타석');
    });
  });

  test('만루 야수선택: 고르기 전엔 밀어내기 득점 · 홈 포스 아웃을 고르면 그 점수를 뺀다 · 실책도 밀어내기 · 그사이 다른 기록이 있으면 적지 않는다', async function () {
    await isolated(async function () {
      start();
      await other('볼넷'); await other('볼넷'); await other('실책');   // 일번 · 이번 · 삼번 — 만루
      eq(names(), ['삼번', '이번', '일번'], '만루');
      await other('실책');   // 사번 — 밀어내기
      eq([AS.hs, who(AS.abs[3].scored), names()], [1, ['일번'], ['사번', '삼번', '이번']], '실책 밀어내기 득점');
      await other('야수선택');   // 일번
      eq([AS.hs, who(AS.abs[4].scored)], [2, ['이번']], '고르기 전 = 모두 세이프 → 3루 주자 득점');
      tap('3루 주자 이번 아웃');
      eq([GF.outs, names(), AS.hs, who(AS.abs[4].scored), AS.abs[4].gfPre.hs], [1, ['일번', '사번', '삼번'], 1, [], undefined], '홈 포스 아웃 — 득점 취소 · 1아웃');
      eq(slLineScore(AS.abs), { away: [], home: [1] }, '이닝별 득점');
      undoLast();
      eq([AS.abs.length, GF.outs, names(), AS.hs, AS.batter && AS.batter.name], [4, 0, ['사번', '삼번', '이번'], 1, '일번'], '되돌림 — 만루 0아웃');
      await other('야수선택');   // 일번 다시
      tap('아웃 없음 — 모두 세이프');
      eq([GF.outs, names(), AS.hs, who(AS.abs[4].scored)], [0, ['일번', '사번', '삼번'], 2, ['이번']], '모두 세이프 — 밀어내기 1점');
      await other('야수선택');   // 이번 — 고르지 않고 다음 타석
      await other('삼진');   // 삼번
      tap('1루 주자 일번 아웃');
      eq([GF.outs, AS.hs, AS.abs[5].fco], [1, 3, undefined], '지난 야수선택 창은 적지 않는다');
      ok(/다른 기록/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
    });
  });

  test('기록 화면 그 밖의 결과에 실책 · 야수선택 버튼 — 누르면 바로 기록 · 타석 기록에 E · FC', async function () {
    await isolated(async function () {
      start();
      shellNav('record'); window.sbRenderNow();
      var b = function (l) { return document.querySelector('.sb-aux button[aria-label="' + l + ' 기록"]'); };
      eq([b('실책 출루') && b('실책 출루').textContent, b('야수선택') && b('야수선택').textContent], ['E실책 출루', 'FC야수선택'], '버튼');
      await gap(); b('실책 출루').click();   // 일번
      eq([AS.abs[0].res, names()], ['실책', ['일번', null, null]], '실책 출루 → 1루');
      window.sbRenderNow();
      await gap(); b('야수선택').click();   // 이번 — 1루 일번
      tap('1루 주자 일번 아웃');
      eq([AS.abs[1].res, GF.outs, names()], ['야수선택', 1, ['이번', null, null]], '야수선택 → 1아웃 · 1루 이번');
      window.sbRenderNow();
      eq([].map.call(document.querySelectorAll('.sb-pa-list .rs'), function (e) { return e.textContent; }), ['FC', 'E'], '타석 기록 약어 (최근 먼저)');
    });
  });

  test('다른 경기를 열면 이전 경기의 경기 운영 상태(이닝 · 아웃 · 주자)를 넘기지 않는다 — 같은 경기를 다시 열면 그대로 · 새 경기도 끈다', async function () {
    await isolated(async function () {
      start();
      await hit('안타'); await other('삼진'); await other('삼진'); await other('삼진');   // 1회말
      await hit('안타'); await other('삼진');
      eq([GF.active, GF.inning + GF.half, GF.outs, GF.bases], [true, '1bottom', 1, [true, false, false]], '1회말 1아웃 1루');
      localStorage.setItem('sl_gfsw', JSON.stringify({ th: '다른홈', ta: '다른원정', hs: 3, as: 1, home_lineup: [], away_lineup: [],
        abs: [{ id: 777, bid: 'x1', bname: '남', bnum: '9', team: 'away', res: '안타', inn: '1회초', rbi: 0 }] }));
      window._gameSaved = true;   // 지금 경기를 먼저 저장하는 건 이 테스트와 상관없다
      restoreGame('sl_gfsw');
      eq([GF.active, GF.inning + GF.half, GF.outs, GF.bases, names()], [false, '1top', 0, [false, false, false], [null, null, null]], '경기 운영 모드 꺼짐 · 상태 비움');
      ok(!$('gfBar').classList.contains('active') && !$('gfbRunners').textContent, '경기 운영 막대 숨김 · 주자 글자 비움');
      gfActivate(); gfToggleBase(0); $('slRunPick').querySelector('.x').click();
      window._gameSaved = true;
      restoreGame('sl_gfsw');   // 같은 경기(클라우드 정리가 남긴 항목으로 다시 열 때도 첫 타석이 같다)
      eq([GF.active, GF.bases[0]], [true, true], '같은 경기는 그대로');
      startFromWizard();
      eq([GF.active, GF.bases[0], $('gfBar').classList.contains('active')], [false, false, false], '새 경기');
      await T.sleep(3500);   // 경기를 열 때 예약된 자동 동기화(3초)가 다음 테스트로 새지 않게
    });
  });

  test('저장 목록에서 다시 열면 이어서 기록할지 묻는다 — 그 이닝 · 아웃 · 주자 · 타순 그대로 · 저장 뒤 바꾼 주자도 · 취소 · 경기종료 · 그 뒤 타석이 늘었으면 묻지 않는다', async function () {
    await isolated(async function () {
      localStorage.clear(); start();
      await hit('안타'); await other('볼넷'); await other('삼진');
      eq([gfInnStr(), GF.outs, names(), AS.batter && AS.batter.name], ['1회초', 1, ['이번', '일번', null], '사번'], '전제: 1회초 1아웃 1 · 2루');
      saveGame(true);
      var key = window._curSaveKey;
      localStorage.setItem('sl_gfother', JSON.stringify({ th: '다른홈', ta: '다른원정', hs: 0, as: 0, home_lineup: [], away_lineup: [],
        abs: [{ id: 778, bid: 'x1', bname: '남', bnum: '9', team: 'away', res: '안타', inn: '1회초', rbi: 0 }] }));
      var txt = function () { var b = $('slRunPick'); return b ? [b.querySelector('p').textContent].concat(Array.prototype.map.call(b.querySelectorAll('button'), function (x) { return x.textContent; })) : null; };
      var reopen = function () { _lpClick('sl_gfother'); ok(!GF.active && !$('slRunPick'), '다른 경기 — 묻지 않는다'); _lpClick(key); };   // 저장 목록에서 누르기
      reopen(); $('slRunPick').querySelector('.x').click();
      restoreGame('sl_gfother'); restoreGame(key);
      ok(!GF.active && !$('slRunPick'), '목록 누르기가 아닌 열기(로그인 정리 등)는 묻지 않는다');
      reopen();
      eq([GF.active, txt()], [false, ['경기 운영 모드로 기록하던 경기예요 — 1회초 1아웃 · 1루 이번 · 2루 일번', '이어서 기록 — 4번 사번 타석부터', '취소']], '이어서 기록할지 묻는다');
      $('slRunPick').querySelector('.x').click();
      ok(!GF.active && !$('slRunPick'), '취소 — 켜지 않는다');
      reopen();
      $('slRunPick').querySelector('button').click();
      eq([GF.active, GF.first, gfInnStr(), GF.outs, GF.bases, names(), AS.curTeam, AS.batter && AS.batter.name, $('gfbRunners').textContent],
        [true, 'home', '1회초', 1, [true, true, false], ['이번', '일번', null], 'home', '사번', '1루 이번 · 2루 일번'], '이어서 기록');
      await hit('안타');
      eq([names(), AS.hs], [['사번', '이번', '일번'], 0], '이어서 진루');
      saveGame(true); gfToggleBase(0);   // 저장 뒤 1루 주자만 지움(타석 기록 없음 → 저장 안 됨 표시도 없다) — 다른 경기를 열기 전에 다시 저장해야 남는다
      reopen();
      eq(txt()[0], '경기 운영 모드로 기록하던 경기예요 — 1회초 1아웃 · 2루 이번 · 3루 일번', '저장 뒤 바꾼 주자도');
      $('slRunPick').querySelector('button').click();
      gfEndGame(); await T.sleep(400); closePgReport();
      reopen();
      ok(!GF.active && !$('slRunPick'), '경기종료한 경기는 묻지 않는다');
      var d = JSON.parse(localStorage.getItem(key)), put = function () { localStorage.setItem(key, JSON.stringify(d)); window._gameSaved = true; };
      d.live = Object.assign({}, d.live, { gf: { n: d.abs.length, first: 'home', inning: 2, half: 'top', outs: 0, batterIdx: 0, bases: [false, false, false], runners: [null, null, null] } });
      put(); reopen();
      eq(txt() && txt()[0], '경기 운영 모드로 기록하던 경기예요 — 2회초 0아웃 · 주자 없음', '대조: 타석 수가 같으면 묻는다');
      $('slRunPick').querySelector('.x').click();
      d.abs = d.abs.concat({ id: 779, bid: 'rn1', bname: '일번', bnum: '1', team: 'home', res: '삼진', inn: '2회초', rbi: 0 });
      put(); reopen();
      ok(!GF.active && !$('slRunPick'), '저장한 경기 운영 상태 뒤로 타석이 늘었으면 묻지 않는다');
      await T.sleep(3500);   // 경기를 열 때 예약된 자동 동기화(3초)가 다음 테스트로 새지 않게
    });
  });

  test('이닝이 바뀌면 그 팀 마지막 타석의 다음 타자부터 — 타자가 3아웃이면 그다음, 도루 실패로 끝나면 그때 타석에 있던 타자', async function () {
    await isolated(async function () {
      start();
      AS.away_lineup = ['원정일', '원정이'].map(function (n, i) { return { id: 'ra' + (i + 1), name: n, num: String(11 + i), pos: '', bh: '', isStarter: true }; });
      await other('삼진'); await other('삼진'); await other('삼진');   // 일번 · 이번 · 삼번
      eq([GF.half, AS.batter && AS.batter.name], ['bottom', '원정일'], '1회말 원정은 처음이라 1번부터');
      await other('삼진'); await other('삼진'); await other('삼진');   // 원정일 · 원정이 · 원정일
      eq([GF.inning, GF.half, GF.batterIdx, AS.batter && AS.batter.name], [2, 'top', 3, '사번'], '2회초는 1번이 아니라 사번부터');
      await hit('안타'); await other('삼진'); await other('삼진');   // 사번 1루 · 일번 · 이번 아웃
      eq(AS.batter && AS.batter.name, '삼번', '전제: 삼번 타석');
      recSB(false);   // 1루 사번 도루 실패 = 3아웃 — 삼번은 타석을 마치지 못했다
      eq([GF.half, AS.batter && AS.batter.name], ['bottom', '원정이'], '2회말은 원정이부터');
      await other('삼진'); await other('삼진'); await other('삼진');
      eq([GF.inning, GF.half, GF.batterIdx, AS.batter && AS.batter.name], [3, 'top', 2, '삼번'], '3회초는 그때 타석에 있던 삼번부터');
    });
  });

  test('지우개: 타석을 지우면 주자 · 아웃 · 점수 · 타자까지 그 전으로 — 3아웃으로 끝난 이닝도', async function () {
    await isolated(async function () {
      start();
      await hit('안타'); await other('볼넷'); await hit('2루타');   // 1점 · 2루 삼번 · 3루 이번
      eq([AS.hs, GF.outs, AS.batter && AS.batter.name], [1, 0, '사번'], '전제');
      chSc('h', 5);   // 그사이 손으로 바꾼 점수는 그대로 둔다
      undoLast();
      eq([AS.abs.length, AS.hs, $('scH').textContent], [2, 5, '5'], '2루타로 오른 1점만 뺀다');
      eq([GF.bases, names(), GF.batterIdx, AS.batter && AS.batter.name], [[true, true, false], ['이번', '일번', null], 2, '삼번'], '주자 · 타순 · 그 타자');
      ok(/주자 · 아웃 · 점수도/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      await other('삼진'); await other('삼진'); await other('삼진');   // 삼번 · 사번 · 일번
      eq([GF.half, GF.bases, AS.curTeam], ['bottom', [false, false, false], 'away'], '3아웃 → 말 공격');
      undoLast();
      eq([GF.inning, GF.half, GF.outs, GF.bases, names()], [1, 'top', 2, [true, true, false], ['이번', '일번', null]], '끝난 이닝을 되돌림');
      eq([AS.curTeam, AS.batter && AS.batter.name, $('innSel').value], ['home', '일번', '1회초'], '공격 팀 · 그 타자 · 이닝');
      await other('삼진');
      eq([GF.half, AS.batter && AS.batter.name], ['bottom', '원정일'], '이어서 기록하면 다시 3아웃');
    });
  });

  test('병살은 1루 주자를 지우고 · 폭투 · 포일은 주자 한 베이스씩(3루 주자 득점) · 견제사는 아웃 — 지우개로 하나씩 되돌린다', async function () {
    await isolated(async function () {
      start();
      await hit('안타'); await other('볼넷');   // 1루 이번 · 2루 일번
      await other('병살');   // 삼번 — 0아웃 병살: 1루 이번 아웃 · 2루 일번은 3루로
      eq([GF.outs, GF.bases, names(), AS.hs], [2, [false, false, true], [null, null, '일번'], 0], '병살: 1루 주자 지움 · 2아웃 · 나머지 주자 진루');
      slRunPlay('WP');   // 주자 하나 → 바로
      eq([GF.bases, names(), AS.hs], [[false, false, false], [null, null, null], 1], '폭투: 3루 주자 득점');
      ok(/^폭투 · 주자 한 베이스씩 · 홈인 일번/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      await hit('안타');   // 사번 1루
      slRunPlay('PB');
      eq([GF.bases, names(), AS.hs], [[false, true, false], [null, '사번', null], 1], '포일: 1루 → 2루');
      eq(AS.abs[2].runEv.map(function (e) { return [e.t, e.name, e.from, e.scored, e.adv]; }), [['WP', '일번', null, true, [2]]], '병살 타석 뒤 주루 기록');
      eq(AS.abs[3].runEv.map(function (e) { return [e.t, e.name, e.scored, e.adv]; }), [['PB', null, false, [0]]], '안타 타석 뒤 주루 기록');
      eq(slLineScore(AS.abs), { away: [], home: [1] }, '이닝별 득점에 폭투 득점');
      eq(slRunnerStats(AS.abs, AS.home_lineup[0]).r, 1, '일번 득점');
      undoLast();
      eq([GF.bases, names(), AS.hs], [[true, false, false], ['사번', null, null], 1], '포일 되돌림');
      ok(/직전 포일 기록을 취소/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      slRunPlay('PB');   // 사번 2루
      slRunPlay('PO');   // 주자 하나 → 바로 견제사 = 3아웃
      eq([GF.half, GF.outs], ['bottom', 0], '견제사로 3아웃');
      undoLast();
      eq([GF.half, GF.outs, GF.bases, names(), AS.batter && AS.batter.name], ['top', 2, [false, true, false], [null, '사번', null], '일번'], '견제사 되돌림');
      await other('볼넷');   // 일번 1루 · 사번 2루
      slRunPlay('PO');
      var box = $('slRunPick');
      ok(box, '주자 고르기'); eq(Array.prototype.map.call(box.querySelectorAll('button'), function (b) { return b.textContent; }), ['1루 일번', '2루 사번', '취소'], '견제사 후보');
      box.querySelectorAll('button')[1].click();
      eq([GF.half, AS.abs[4].runEv[0].name], ['bottom', '사번'], '2루 사번 견제사 = 3아웃');
      for (var k = 0; k < 6; k++) undoLast();   // 견제사 · 볼넷 · 포일 · 안타 · 폭투 · 병살
      eq([AS.abs.length, GF.outs, GF.bases, names(), AS.hs, AS.batter && AS.batter.name], [2, 0, [true, true, false], ['이번', '일번', null], 0, '삼번'], '병살 전으로');
    });
  });

  test('병살: 0아웃이면 나머지 주자가 한 베이스씩(3루 주자 득점) · 1아웃이면 3아웃이라 득점 없음', async function () {
    await isolated(async function () {
      start();
      await hit('3루타'); await other('볼넷');   // 3루 일번 · 1루 이번
      await other('병살');   // 삼번 (0아웃)
      eq([GF.outs, GF.bases, AS.hs, who(AS.abs[2].scored)], [2, [false, false, false], 1, ['일번']], '1루 아웃 · 3루 주자 득점');
      ok(/홈인 일번/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      eq(slLineScore(AS.abs), { away: [], home: [1] }, '이닝별 득점');
      undoLast();
      eq([GF.outs, GF.bases, names(), AS.hs, AS.batter && AS.batter.name], [0, [true, false, true], ['이번', null, '일번'], 0, '삼번'], '되돌림');
      await other('삼진');   // 삼번 (1아웃)
      await other('병살');   // 사번 — 3아웃
      eq([GF.half, AS.hs, who(AS.abs[3].scored)], ['bottom', 0, []], '1아웃 병살은 득점 없이 이닝 끝');
    });
  });

  test('폭투 · 포일: 주자가 둘 이상이면 진루한 주자를 고른다 — 앞 주자가 남으면 바로 뒤 주자는 못 간다', async function () {
    await isolated(async function () {
      start();
      await hit('안타'); await other('볼넷');   // 1루 이번 · 2루 일번
      slRunPlay('WP');
      var box = $('slRunPick'), bs = function () { return Array.prototype.slice.call($('slRunPick').querySelectorAll('button')); };
      var st = function () { return bs().map(function (b) { return b.textContent + (b.disabled ? '(막힘)' : '') + (b.getAttribute('aria-pressed') === 'false' ? '(안 감)' : ''); }); };
      ok(box, '진루 주자 고르기');
      eq(st(), ['2루 일번 → 3루', '1루 이번 → 2루', '확인', '취소'], '모두 고른 채로 열림');
      bs()[0].click();   // 2루 주자가 남으면
      eq(st(), ['2루 일번 → 3루(안 감)', '1루 이번 → 2루(막힘)(안 감)', '확인(막힘)', '취소'], '1루 주자는 못 감');
      bs()[0].click();   // 다시 고름 — 1루 주자는 따로 골라야
      eq(st(), ['2루 일번 → 3루', '1루 이번 → 2루(안 감)', '확인', '취소'], '2루만');
      bs()[2].click();
      eq([GF.bases, names(), AS.abs[1].runEv[0].adv], [[true, false, true], ['이번', null, '일번'], [1]], '2루 주자만 3루로');
      ok(/^폭투 · 2루 일번 → 3루$/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      slRunPlay('PB');
      eq(st(), ['3루 일번 → 홈', '1루 이번 → 2루', '확인', '취소'], '1 · 3루');
      bs()[0].click();   // 3루 주자는 그대로 — 2루가 비어 1루 주자는 갈 수 있다
      eq(st(), ['3루 일번 → 홈(안 감)', '1루 이번 → 2루', '확인', '취소'], '1루 주자만');
      bs()[2].click();
      eq([GF.bases, names(), AS.hs], [[false, true, true], [null, '이번', '일번'], 0], '1루 주자만 2루로');
      undoLast(); undoLast();
      eq([GF.bases, names()], [[true, true, false], ['이번', '일번', null]], '둘 다 되돌림');
    });
  });

  test('교체: 들어온 선수가 그 타순을 잇고 나간 선수는 후보 · 후보는 타순에 안 든다 · 다음 이닝도 그 자리부터 · 지우개로 되돌린다', async function () {
    await isolated(async function () {
      start();
      AS.home_lineup.push({ id: 'rb1', name: '후보일', num: '21', pos: '', bh: '', isStarter: false });
      renderLP();
      var lu = function () { return AS.home_lineup.map(function (p) { return p.name + (p.isStarter === false ? '*' : ''); }); };
      var txt = function () { return Array.prototype.map.call($('slRunPick').querySelectorAll('button'), function (b) { return b.textContent; }); };
      var tap = function (t) { var b = Array.prototype.find.call($('slRunPick').querySelectorAll('button'), function (x) { return x.textContent === t; }); ok(b, '버튼 ' + t); b.click(); };
      var put = function (n) { $('slRunPick').querySelector('input').value = n; tap('넣기'); };
      await other('삼진'); await other('삼진');   // 일번 · 이번
      slSub();
      eq(txt(), ['대타 — 지금 타자 대신', '대주자 — 베이스 주자 대신', '대수비 — 수비 선수 바꾸기', '투수 교체', '수비 위치 바꾸기 — 주전끼리', '취소'], '교체 종류');
      tap('대타 — 지금 타자 대신');
      eq([$('slRunPick').getAttribute('aria-label'), txt()], ['대타 — 삼번 대신 누가 들어오나요?', ['#21 후보일', '넣기', '취소']], '후보 · 새 이름');
      tap('#21 후보일');
      eq([AS.batter && AS.batter.name, lu(), GF.batterIdx], ['후보일', ['일번', '이번', '후보일', '사번', '삼번*'], 2], '대타가 3번 자리 · 삼번은 후보');
      ok(/^대타 · 1회초 후보일 \(삼번 대신\)/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      await hit('안타');   // 후보일 1루
      eq([names()[0], AS.batter && AS.batter.name], ['후보일', '사번'], '대타가 쳐서 1루 · 다음은 사번(후보 건너뜀 없음)');
      slSub(); tap('대주자 — 베이스 주자 대신');   // 주자 하나 → 바로 들어올 선수
      eq(txt(), ['#3 삼번', '넣기', '취소'], '후보 = 나간 삼번');
      put('발빠른');
      eq([names()[0], lu()], ['발빠른', ['일번', '이번', '발빠른', '사번', '삼번*', '후보일*']], '대주자가 1루 · 3번 자리');
      recSB(false);   // 발빠른 도루 실패 = 3아웃
      eq([GF.half, AS.batter && AS.batter.name], ['bottom', '원정일'], '1회말');
      slSub(); tap('대수비 — 수비 선수 바꾸기');
      eq(txt(), ['1번 일번', '2번 이번', '3번 발빠른', '4번 사번', '취소'], '수비 팀(홈) 주전');
      tap('3번 발빠른'); put('수비왕');
      eq(lu(), ['일번', '이번', '수비왕', '사번', '삼번*', '후보일*', '발빠른*'], '대수비');
      slSub(); tap('투수 교체');
      tap('타순에 없는 투수 (지명타자)'); put('새투수');
      eq([lu().length, AS.abs[2].runEv.map(function (e) { return e.t + (e.k ? ':' + e.k : '') + ':' + e.name; })], [7, ['SUB:PR:발빠른', 'CS:발빠른', 'SUB:DEF:수비왕', 'SUB:P:새투수']], '투수는 기록에만 · 교체도 타석 뒤 기록에');
      eq(slLineScore(AS.abs), { away: [], home: [0] }, '교체는 이닝별 득점 칸을 만들지 않는다');
      await other('삼진'); await other('삼진'); await other('삼진');   // 원정
      eq([GF.inning, GF.half, GF.batterIdx, AS.batter && AS.batter.name], [2, 'top', 3, '사번'], '2회초는 후보일 → 발빠른 → 수비왕 자리 다음인 사번부터');
      for (var k = 0; k < 4; k++) undoLast();   // 원정 삼진 3 · 투수 교체
      ok(/직전 투수 교체 기록을 취소/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      undoLast();   // 대수비
      eq(lu(), ['일번', '이번', '발빠른', '사번', '삼번*', '후보일*'], '대수비 되돌림 · 새로 넣은 선수는 명단에서도');
      undoLast(); undoLast();   // 도루 실패 · 대주자
      eq([GF.half, GF.outs, names()[0], lu()], ['top', 2, '후보일', ['일번', '이번', '후보일', '사번', '삼번*']], '대주자 되돌림');
      undoLast(); undoLast();   // 후보일 안타 · 대타
      eq([AS.batter && AS.batter.name, lu(), AS.home_lineup[4].isStarter], ['삼번', ['일번', '이번', '삼번', '사번', '후보일*'], false], '대타 되돌림');
    });
  });

  // 흐름 점검 11-06 ⑭ — 교체로 나간 선수 카드가 명단 칸 번호(「5번 타자」)로 나왔다
  test('타자 카드 타순: 교체로 나간 선수는 그 자리 타순 · 들어온 선수도 같은 타순 · 교체 기록 없는 후보는 타순 없음', async function () {
    await isolated(async function () {
      start();
      AS.home_lineup.push({ id: 'rb1', name: '후보일', num: '21', pos: '', bh: '', isStarter: false }, { id: 'rb2', name: '후보이', num: '22', pos: '', bh: '', isStarter: false });
      renderLP();
      var tap = function (t) { var b = Array.prototype.find.call($('slRunPick').querySelectorAll('button'), function (x) { return x.textContent === t; }); ok(b, '버튼 ' + t); b.click(); };
      await other('삼진'); await other('삼진');   // 일번 · 이번 → 삼번 차례
      slSub(); tap('대타 — 지금 타자 대신'); tap('#21 후보일');
      var meta = async function (n) { shellOpenAnalysis('batter'); await T.sleep(50); setBatterView('side', 'home'); setBatterView('scope', 'game'); setBatterView('sel', n); var e = document.querySelector('#batterView .bt-meta'); return e ? e.textContent : null; };
      eq(await meta('삼번'), '3번 타자 · #3', '나간 삼번 = 3번 타자 (명단 칸 5번 아님)');
      eq(await meta('후보일'), '3번 타자 · #21', '들어온 후보일 = 3번 타자');
      eq(await meta('사번'), '4번 타자 · #4', '주전은 그대로');
      eq(await meta('후보이'), '#22', '교체 기록 없는 후보는 타순 없음');
      shellNav('record');
    });
  });

  test('수비 위치 바꾸기: 수비 팀 주전 둘의 자리를 맞바꾸고 기록에 남긴다 · 지우개로 되돌린다', async function () {
    await isolated(async function () {
      start();
      ['유격수', '투수', '포수', '1루수'].forEach(function (p, i) { AS.home_lineup[i].pos = p; });
      renderLP();
      var txt = function () { return Array.prototype.map.call($('slRunPick').querySelectorAll('button'), function (b) { return b.textContent; }); };
      var tap = function (t) { var b = Array.prototype.find.call($('slRunPick').querySelectorAll('button'), function (x) { return x.textContent === t; }); ok(b, '버튼 ' + t); b.click(); };
      var pos = function () { return AS.home_lineup.map(function (p) { return p.pos; }); };
      await other('삼진'); await other('삼진'); await other('삼진');   // 1회초 우리 팀(홈) 공격 끝 → 1회말 홈 수비
      await T.sleep(100);   // 이닝 칸(innSel)은 3아웃 다음 프레임에 1회말로 (core.js gfNextHalf → rAF gfSyncInnSel)
      eq(GF.half, 'bottom', '1회말');
      slSub(); tap('수비 위치 바꾸기 — 주전끼리');
      eq(txt(), ['1번 일번 (유격수)', '2번 이번 (투수)', '3번 삼번 (포수)', '4번 사번 (1루수)', '취소'], '수비 팀(홈) 주전과 지금 자리');
      tap('1번 일번 (유격수)');
      eq([$('slRunPick').getAttribute('aria-label'), txt()], ['일번 (유격수) — 누구와 자리를 바꾸나요?', ['2번 이번 (투수)', '3번 삼번 (포수)', '4번 사번 (1루수)', '취소']], '나머지 주전');
      tap('2번 이번 (투수)');
      ok(!$('slRunPick'), '창 닫힘');
      eq(pos(), ['투수', '유격수', '포수', '1루수'], '두 선수 자리 맞바꿈');
      var ev = AS.abs[2].runEv[0];
      eq([ev.t, ev.k, ev.name, ev.with.name, ev.pa, ev.pb, ev.team, ev.inn, ev.out, ev.pre.half, ev.pre.outs], ['SUB', 'POS', '일번', '이번', '유격수', '투수', 'home', '1회말', null, 'bottom', 0], '마지막 타석 뒤 기록');
      ok(/^수비 위치 · 1회말 일번 → 투수 · 이번 → 유격수$/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      eq([GF.batterIdx, AS.batter && AS.batter.name], [0, '원정일'], '타순 · 타자는 그대로');
      undoLast();
      eq(pos(), ['유격수', '투수', '포수', '1루수'], '되돌림');
      ok(!AS.abs[2].runEv, '기록도 지움');
      ok(/직전 수비 위치 바꾸기 기록을 취소/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
    });
  });

  // 투구 기록(분석 › 투수)의 지금 투수가 교체 · 수비 위치 바꾸기 · 공수 교대를 따라간다 (예전엔 따로 놀아 새 투수 · 상대 타자의 공이 앞 투수에 쌓였다)
  test('투구 기록 투수: 공수 교대 · 투수 교체 · 수비 위치 바꾸기를 따라간다 — 모르는 상대 투수면 비운다 · ↩ 는 바뀌기 전 공부터', async function () {
    await isolated(async function () {
      fresh();
      AS.curTeam = 'home';
      AS.home_lineup = [['일번', '1', '유격수'], ['에이스', '18', '투수'], ['삼번', '3', '포수'], ['구원', '30', '']].map(function (x, i) { return { id: 'pf' + (i + 1), name: x[0], num: x[1], pos: x[2], bh: '', isStarter: i < 3 }; });
      AS.away_lineup = [{ id: 'pa1', name: '원정일', num: '11', pos: '', bh: '', isStarter: true }, { id: 'pa2', name: '원정이', num: '12', pos: '', bh: '', isStarter: true }];
      renderLP();
      AS.pitchers = [{ id: 'pq1', name: '에이스', num: '18', role: null, pitches: [] }];
      window._pitchInnAskedFor = AS.pitchers;   // 경기 첫 공의 이닝 묻기는 tests/pitching-p1.test.js 에서
      selectPitcher('pq1');
      GF.first = 'away'; gfActivate();   // 1회초 원정 공격 · 우리(홈) 수비
      var cur = function () { return AS.currentPitcher ? AS.currentPitcher.name : null; };
      var n = function (nm) { var p = AS.pitchers.find(function (q) { return q.name === nm; }); return p ? p.pitches.length : -1; };
      var txt = function () { return Array.prototype.map.call($('slRunPick').querySelectorAll('button'), function (b) { return b.textContent; }); };
      var tap = function (t) { var b = Array.prototype.find.call($('slRunPick').querySelectorAll('button'), function (x) { return x.textContent === t; }); ok(b, '버튼 ' + t + ' / ' + txt()); b.click(); };
      async function k3() { recordPitch('헛스윙'); recordPitch('헛스윙'); await gap(); recordPitch('헛스윙'); }   // 삼진 → 기록 탭 타석(0.7초 연타 방지)
      await k3(); await k3(); await k3();
      await T.sleep(100);
      eq([GF.half, n('에이스'), cur()], ['bottom', 9, null], '1회말: 상대 투수를 몰라 투구 기록 투수를 비움 (에이스에 우리 타자 공이 쌓이지 않게)');
      AS.pitchers.push({ id: 'pq2', name: '상대투', num: '', role: null, pitches: [] }); selectPitcher('pq2');   // 손으로 상대 투수 등록
      await k3(); await k3(); await k3();
      await T.sleep(100);
      eq([GF.inning, GF.half, n('상대투'), cur()], [2, 'top', 9, '에이스'], '2회초: 우리 수비 → 에이스로');
      undoPitch();   // 에이스는 아직 공이 없다 → 바뀌기 전 마지막 공(상대투 삼진)
      eq([GF.half, GF.outs, n('상대투'), n('에이스'), cur()], ['bottom', 2, 8, 9, '상대투'], '↩: 상대투의 마지막 공을 지우고 1회말 2아웃 · 상대투로 (에이스 옛 공은 그대로)');
      await gap(); recordPitch('헛스윙');
      await T.sleep(100);
      eq([GF.half, cur()], ['top', '에이스'], '다시 삼진 → 2회초 에이스');
      slSub(); tap('투수 교체');
      eq(txt(), ['1번 일번 (유격수)', '2번 에이스 (투수)', '3번 삼번 (포수)', '타순에 없는 투수 (지명타자)', '취소'], '나가는 선수');
      tap('2번 에이스 (투수)'); tap('#30 구원');
      eq([cur(), AS.currentPitcher && AS.currentPitcher.num, AS.pitchers.length], ['구원', '30', 3], '투수 교체 → 투구 기록도 구원 (처음이면 등록)');
      ok(/ · 투구 기록 투수도 바꿈$/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      slSub(); tap('수비 위치 바꾸기 — 주전끼리'); tap('1번 일번 (유격수)'); tap('2번 구원 (투수)');
      eq([AS.home_lineup[0].pos, cur()], ['투수', '일번'], '수비 위치 바꾸기로 일번이 투수 → 투구 기록도 일번');
      undoLast();
      eq(cur(), '구원', '위치 바꾸기 되돌림 → 구원');
      undoLast();
      eq([AS.home_lineup[1].name, cur()], ['에이스', '에이스'], '투수 교체 되돌림 → 에이스');
      AS._pitchAuto = null;
    });
  });

  // 흐름 점검 11-06 ⑧: 경기 운영을 끈 채 상대 투수로 우리 타자 공을 적다가 경기 운영을 켜면 → 1회초 수비 팀(우리) 투수로
  //   예전엔 상대 투수가 그대로 남고, 공수 교대 때 우리 팀 칸(lastP)에도 들어가 경기 내내 안 바뀌었다
  test('경기 운영 켜기: 켜기 전 상대 투수가 남지 않고 수비 팀 투수로 · 공수 교대도 따라간다 · 앞 타석 결과를 물으면 고른 뒤에', async function () {
    var cur = function () { return AS.currentPitcher ? AS.currentPitcher.name : null; };
    function setup() {
      fresh();
      AS.curTeam = 'home';
      AS.home_lineup = [['일번', '1', '유격수'], ['에이스', '18', '투수'], ['삼번', '3', '포수']].map(function (x, i) { return { id: 'gs' + (i + 1), name: x[0], num: x[1], pos: x[2], bh: '', isStarter: true }; });
      AS.away_lineup = [{ id: 'gt1', name: '원정일', num: '11', pos: '', bh: '', isStarter: true }, { id: 'gt2', name: '원정이', num: '12', pos: '', bh: '', isStarter: true }];
      renderLP();
      AS.pitchers = [{ id: 'go1', name: '보육', num: '', role: null, pitches: [] }];
      window._pitchInnAskedFor = AS.pitchers;
      selectPitcher('go1'); selBatter('gs1');
    }
    function startGame() { gfToggle(); $('slRunPick').querySelectorAll('button')[0].click(); }   // 상대 선공 (기본) — 1회초 우리 수비
    await isolated(async function () {
      setup();
      recordPitch('헛스윙'); recordPitch('헛스윙'); await gap(); recordPitch('헛스윙');   // 우리 타자 삼진 — 보육 = 상대 투수
      ok(window.PitchLimit.isOpp(AS.pitchers[0]), '보육 = 상대 투수');
      startGame();
      eq([GF.active, GF.half, cur()], [true, 'top', '에이스'], '1회초: 우리 타순표 투수로 (처음이면 등록) — 예전엔 보육');
      gfNextHalf();
      eq([GF.half, cur()], ['bottom', '보육'], '1회말: 상대 투수 보육');
      gfNextHalf();
      eq([GF.inning, GF.half, cur()], [2, 'top', '에이스'], '2회초: 다시 에이스 — 예전엔 보육이 계속 남았다');
    });
    await isolated(async function () {
      setup();
      recordPitch('볼');   // 결과 없는 타석이 열린 채로 켠다 → 다음 타자로 넘기기 전에 결과를 묻는다
      startGame();
      ok($('pitchEndSheet'), '앞 타석 결과 묻기');
      eq(cur(), '보육', '고르기 전에는 그대로');
      $('pitchEndSheet').querySelector('.pes-btn[data-end]').click();
      eq([cur(), AS.batter && AS.batter.name], ['에이스', '원정일'], '결과를 고르면 1회초 첫 타자 · 우리 투수');
    });
  });

  // 흐름 점검 4 (사용자 결정 11-05): 투구 수 관리를 켜면 기록 탭 B·S 하나 = 공 하나 · 기록 탭으로 끝낸 타석은 결과 공 하나 — 수비 팀 타순표 투수에게 (없으면 등록)
  test('투구 수 관리를 켜면 기록 탭 B·S · 결과도 투구로 센다 — 수비 팀 투수에게 · 지우개 · 삼진 · 투수를 모르면 안내', async function () {
    await isolated(async function () {
      fresh(); gfDeactivate();
      localStorage.setItem('sl_pitch_rule', JSON.stringify({ on: true }));
      AS.home_lineup = [{ id: 'rp1', name: '에이스', num: '18', pos: '투수', bh: '', isStarter: true }, { id: 'rp2', name: '일번', num: '1', pos: '유격', bh: '', isStarter: true }];
      AS.away_lineup = [{ id: 'ro1', name: '원정일', num: '11', pos: '', bh: '', isStarter: true }, { id: 'ro2', name: '원정이', num: '12', pos: '', bh: '', isStarter: true }];
      AS.curTeam = 'away'; renderLP(); selBatter('ro1');   // 원정 공격 = 우리(홈) 수비
      var ace = function () { return AS.pitchers.find(function (p) { return p.name === '에이스'; }); };
      var prs = function () { return ace().pitches.map(function (e) { return e.pr + (e.end ? '→' + e.end : ''); }); };
      chCount('b'); chCount('s'); chCount('s');
      eq([AS.pitchers.length, ace() && ace().num, AS.currentPitcher && AS.currentPitcher.name, prs(), [AS.balls, AS.strikes]],
        [1, '18', '에이스', ['볼', '스트라이크', '스트라이크'], [1, 2]], 'B·S 하나 = 공 하나 · 타순표 투수를 등록하고 고름 · 볼카운트 그대로');
      ok(ace().pitches.every(function (e) { return e.src === 'rec' && e.pt == null && e.zone == null && e.bteam === 'away'; }), '구종 · 코스 없는 기록 탭 공');
      await hit('2루타');
      var ab = AS.abs[0], last = ace().pitches[3];
      eq([prs().length, last.end, last.src, ab.pa, ab.pid, ab.pitches.length, [AS.balls, AS.strikes]], [4, '2루타', 'rec', last.pa, ace().id, 4, [0, 0]], '필드로 끝낸 타석 → 결과 공 하나 · 그 타석과 연결');
      undoLast();
      eq([AS.abs.length, prs(), [AS.balls, AS.strikes]], [0, ['볼', '스트라이크', '스트라이크'], [1, 2]], '지우개 → 결과 공도 지우고 1-2 로');
      if (!AS.batter || AS.batter.id !== 'ro1') selBatter('ro1');
      await gap(); chCount('s');
      eq([AS.abs.length, AS.abs[0] && AS.abs[0].res, prs()], [1, '삼진', ['볼', '스트라이크', '스트라이크', '스트라이크→삼진']], '3스트라이크 → 삼진 타석 · 결과 공을 따로 더하지 않음');
      AS.curTeam = 'home'; renderLP(); selBatter('rp2');   // 우리 공격 — 상대 타순표에 투수가 없다
      chCount('b');
      eq([prs().length, AS.balls], [4, 1], '투수를 모르면 세지 않고 볼카운트만');
      eq($('toastTxt').textContent, '투구 수를 세려면 수비 팀 타순표에 투수를 넣어 주세요', '한 번 안내');
      localStorage.setItem('sl_pitch_rule', JSON.stringify({ on: false }));
      AS.curTeam = 'away'; renderLP(); selBatter('ro2');
      chCount('b');
      eq(prs().length, 4, '투구 수 관리를 끄면 예전대로');
    });
  });

  // 흐름 점검 8: 7회초 끝 후공 리드인데 「7회말 공격 시작」 — 정규 이닝(경기설정 5 · 7 · 9회)부터는 경기 종료를 묻는다
  test('정규 이닝이 끝나면 경기 종료를 묻는다 — 초 끝 후공 리드 · 말 끝 동점은 연장 · 끝내기 · 정규 이닝 전에는 묻지 않음', async function () {
    await isolated(async function () {
      start(); AS.info = { innings: 5 };   // 우리(홈) 선공 · 원정 후공
      var ask = function () { var b = $('gfEndAsk'); return b && b.style.display === 'flex' ? b.querySelector('.gw-sub').textContent : ''; };
      var to = function (inn, half) { GF.inning = half === 'top' ? inn : inn + 1; GF.half = half === 'top' ? 'bottom' : 'top'; gfStepHalf(-1); GF.outs = 2; };   // 그 반 이닝 2아웃으로
      var wait = function () { return T.sleep(150); };
      to(4, 'top'); AS.hs = 1; AS.as = 2;
      await other('삼진'); await wait();
      eq([ask(), GF.inning, GF.half], ['', 4, 'bottom'], '4회초 끝: 정규 이닝 전이라 묻지 않음'); ok(/4회말 공격 시작/.test($('toastTxt').textContent), $('toastTxt').textContent);
      to(5, 'top');
      await other('삼진'); await wait();
      ok(/^5회초 끝 — .+ 2 : 1 승리예요 \(정규 5회\)/.test(ask()), '5회초 끝 · 후공 2:1 → 종료 묻기: ' + ask());
      gfEndAskClose();
      eq([GF.active, GF.inning, GF.half], [true, 5, 'bottom'], '계속 기록 → 5회말 그대로');
      AS.as = 1; GF.outs = 2;
      await other('삼진'); await wait();
      eq([ask(), GF.inning, GF.half], ['', 6, 'top'], '5회말 끝 1:1 동점 → 연장 6회초');
      to(6, 'bottom'); GF.outs = 0;
      await hit('홈런'); await wait();
      ok(/^끝내기 — .+ 2 : 1 승리예요/.test(ask()), '6회말 홈런 → 끝내기: ' + ask());
      gfEndAskClose();
      gfEndConfirm();
      eq(ask(), '경기 운영을 끝내고 경기 리포트를 엽니다.', '경기종료 버튼으로 열면 예전 글');
      gfEndAskClose();
    });
  });

  // 흐름 점검 10 (사용자 결정 11-05): 투구 기록 인플레이 → 「타구 위치를 찍을까요?」 → 예전 '건너뛰기'는 기록 탭 타석을 안 만들어 경기 운영 모드가 멈췄다
  test('투구 기록 인플레이 → 「위치 없이 기록」: 기록 탭 타석이 바로 생겨 아웃 · 주자 · 다음 타자가 넘어간다 · ↩ 는 그 타석도 지운다', async function () {
    await isolated(async function () {
      start();
      AS.pitchers = [{ id: 'po1', name: '상대투', num: '1', role: null, pitches: [] }];
      window._pitchInnAskedFor = AS.pitchers; selectPitcher('po1');
      var skip = function () { var b = $('pitchLinkSheet') && $('pitchLinkSheet').querySelector('[data-act="skip"]'); ok(b && b.textContent === '위치 없이 기록', '버튼: ' + (b && b.textContent)); if (b) b.click(); };
      var bat = function () { return AS.batter && AS.batter.name; };
      await gap(); recordPitch('볼'); recordPitch('플라이 아웃'); skip();
      var a = AS.abs[0];
      eq([AS.abs.length, a && a.res, a && a.x, a && a.pa === AS.pitchers[0].pitches[1].pa, a && a.pitches.length, GF.outs, bat()],
        [1, '플라이 아웃', null, true, 2, 1, '이번'], '위치 없는 타석 · 투구 기록과 연결 · 1아웃 · 다음 타자');
      await gap(); recordPitch('안타'); skip();
      eq([AS.abs.length, AS.abs[1].res, names()[0], bat()], [2, '안타', '이번', '삼번'], '안타 → 1루 이번 · 다음 타자');
      undoPitch();
      eq([AS.abs.length, names()[0], bat(), GF.outs], [1, null, '이번', 1], '↩ 되돌리면 그 타석도 지우고 주자 · 타자도 그 전으로');
    });
  });

  // 흐름 점검 11-06 ⑮: 투수 대신 대타 → 대타는 「투수」 위치를 물려받지 않고, 나간 투수는 다음 수비에 다시 고르지 않는다
  //   예전엔 대타가 투수로 표시되고 투구 기록은 후보로 나간 투수에게 계속 쌓였다
  test('투수 대신 대타: 대타는 투수 위치를 물려받지 않고 · 나간 투수는 다음 수비에 안 고른다 · 투수 교체를 하면 그 투수로', async function () {
    await isolated(async function () {
      fresh();
      AS.curTeam = 'home';
      AS.home_lineup = [['일번', '1', '유격수', true], ['장주원', '18', '투수', true], ['삼번', '3', '포수', true], ['김대타', '25', '', false]].map(function (x, i) { return { id: 'ph' + (i + 1), name: x[0], num: x[1], pos: x[2], bh: '', isStarter: x[3] }; });
      AS.away_lineup = [{ id: 'pz1', name: '원정일', num: '11', pos: '', bh: '', isStarter: true }, { id: 'pz2', name: '원정이', num: '12', pos: '', bh: '', isStarter: true }];
      renderLP();
      AS.pitchers = [{ id: 'pj1', name: '장주원', num: '18', role: null, pitches: [] }];
      window._pitchInnAskedFor = AS.pitchers; selectPitcher('pj1');
      GF.first = 'away'; gfActivate();   // 1회초 우리(홈) 수비
      var cur = function () { return AS.currentPitcher ? AS.currentPitcher.name : null; };
      var tap = function (t) { var b = Array.prototype.find.call($('slRunPick').querySelectorAll('button'), function (x) { return x.textContent === t; }); ok(b, '버튼 ' + t); b.click(); };
      eq(cur(), '장주원', '1회초 장주원');
      gfNextHalf();   // 1회말 우리 공격
      await hit('안타');   // 일번 1루 → 다음 타자 장주원
      eq(AS.batter && AS.batter.name, '장주원', '지금 타자 장주원');
      slSub(); tap('대타 — 지금 타자 대신'); tap('#25 김대타');
      eq([AS.home_lineup[1].name, AS.home_lineup[1].pos, AS.batter && AS.batter.name], ['김대타', '', '김대타'], '대타는 투수 위치를 물려받지 않는다 (예전엔 투수)');
      ok(/다음 수비 전에 투수 교체를 기록해 주세요$/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      gfNextHalf();   // 2회초 우리 수비
      eq([GF.inning, GF.half, cur()], [2, 'top', null], '2회초: 나간 장주원을 다시 고르지 않는다 (예전엔 장주원)');
      slSub(); tap('투수 교체'); tap('2번 김대타');
      $('slRunPick').querySelector('input').value = '구원투'; tap('넣기');
      eq([cur(), AS.home_lineup[1].name, AS.home_lineup[1].pos], ['구원투', '구원투', '투수'], '투수 교체 → 투구 기록도 구원투');
      undoLast(); undoLast();   // 투수 교체 · 대타 되돌림
      eq([AS.home_lineup[1].name, AS.home_lineup[1].pos], ['장주원', '투수'], '되돌리면 장주원이 다시 투수');
      AS._pitchAuto = null;
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
