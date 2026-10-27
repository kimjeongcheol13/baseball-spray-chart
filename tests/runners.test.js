// 주자 이름 · 득점 · 도루 (js/features/runners.js) — 경기 운영 모드에서 실제 recHit · recOther · recSB · undoLast 를 그대로 돌린다
//  · 타석 결과대로 주자 이름이 베이스를 따라가고, 홈인한 주자가 그 타석의 scored 에 남는다
//  · 도루 · 도루 실패는 마지막 타석의 runEv 에 남고, 되돌리기는 도루부터 (점수 · 주자 · 아웃 · 끝난 이닝까지)
//  · 이닝별 득점(slLineScore) · 선수별 득점 · 도루(slRunnerStats) · 새로고침 뒤 주자 이름 복구
//  · 이름 없는 주자(이 기능 전에 시작한 경기)는 이번 이닝 타석 기록으로 채운다
//  · 이닝이 바뀌면 타순을 이어 가고, 지우개는 주자 · 아웃 · 점수 · 타자까지 되돌린다 · 병살 · 폭투 · 포일 · 견제사
//  · 병살은 0아웃이면 나머지 주자 진루(3루 주자 득점) · 폭투 · 포일은 진루한 주자를 고른다 · 교체(대타 · 대주자 · 대수비 · 투수) · 타순은 주전만
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var F = ['abs', 'home_lineup', 'away_lineup', 'hs', 'as', 'zoneHistory', 'pitchers', 'currentPitcher', 'pitchLog', 'currentPitches', 'info', 'curGame', 'batter', 'balls', 'strikes', 'outs', 'curTeam', 'pendingQuickRes'];
  var GK = ['active', 'inning', 'half', 'outs', 'batterIdx', 'bases', 'runners'];

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

  test('손으로 켠 베이스는 누가 나갔는지 고른다 — 실책으로 나간 타자 · 희타로 옮긴 주자 · 취소하면 이름 없는 주자', async function () {
    await isolated(async function () {
      start();
      var txt = function () { return Array.prototype.map.call($('slRunPick').querySelectorAll('button'), function (b) { return b.textContent; }); };
      var tap = function (t) { Array.prototype.find.call($('slRunPick').querySelectorAll('button'), function (b) { return b.textContent === t; }).click(); };
      await hit('안타'); await other('실책');   // core.js 는 실책에 주자를 옮기지 않는다
      eq([GF.bases, names()], [[true, false, false], ['일번', null, null]], '실책 뒤 베이스 그대로');
      gfToggleBase(1);
      eq(txt(), ['1루 일번 → 2루', '타자 이번 (실책)', '3번 삼번', '4번 사번', '취소'], '2루 후보: 아래 주자 · 마지막 타자 · 베이스에 없는 주전');
      tap('1루 일번 → 2루');
      ok(!$('slRunPick'), '닫힘'); eq([GF.bases, names()], [[false, true, false], [null, '일번', null]], '1루 주자가 2루로');
      gfToggleBase(0); tap('타자 이번 (실책)');
      eq($('gfbRunners').textContent, '1루 이번 · 2루 일번', '실책으로 나간 타자');
      await other('희타');   // 삼번 희타 — 주자는 손으로 옮긴다
      gfToggleBase(2);
      eq(txt(), ['2루 일번 → 3루', '1루 이번 → 3루', '타자 삼번 (희타)', '4번 사번', '취소'], '3루 후보');
      tap('2루 일번 → 3루'); gfToggleBase(1); tap('1루 이번 → 2루');
      eq([GF.bases, names(), $('gfbRunners').textContent], [[false, true, true], [null, '이번', '일번'], '2루 이번 · 3루 일번'], '희타로 한 베이스씩');
      gfToggleBase(0); $('slRunPick').querySelector('.x').click(); gfUpdateBar();   // 막대는 다음 프레임에 그린다 — 여기서는 바로
      eq([GF.bases[0], names()[0], $('gfbRunners').textContent], [true, null, '1루 주자 · 2루 이번 · 3루 일번'], '취소하면 이름 없는 주자');
      gfToggleBase(0);
      ok(!$('slRunPick') && !GF.bases[0], '끌 때는 묻지 않는다');
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
      eq(txt(), ['대타 — 지금 타자 대신', '대주자 — 베이스 주자 대신', '대수비 — 수비 선수 바꾸기', '투수 교체', '취소'], '교체 종류');
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
