// 흐름 점검(11-03)에서 찾은 것 — 실제 함수(gfActivate · recOther · recHit · onFClick · recStepInning · _pgBuild · showGameSummary · 경기설정 타순표)를 그대로 돌린다
//  ① 상대 공격인데 상대 명단이 비면: 타자 없이 · 필드 탭 · 카운트 · 빠른 버튼은 기록 안 함 · 「다음 이닝으로 ▶」 (예전엔 우리 선수 기록으로 들어갔다)
//  ② 경기설정 타순표: 이름을 쓰고 같은 줄 수비 칸을 누르면 그 칸으로 (예전엔 다음 줄 이름 칸으로 가 "8이두리")
//  ③ 경기 운영 타점 = 홈인한 주자 수 (실책 · 병살 제외 · 손으로 넣은 타점 그대로) · 리포트 · 경기 종료 창은 우리 팀 타석만 · 오늘의 선수 같은 사람
//  ④ 경기 운영 중 헤더 ◀ ▶ 는 경기 운영 이닝도 같이 옮긴다 (아웃 · 주자 비움)
//  ⑤ 선공 고르기 → 경기설정 홈/원정 · 점수판 윗줄이 선공 팀 · 경기종료 확인은 앱 창
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var F = ['abs', 'home_lineup', 'away_lineup', 'hs', 'as', 'zoneHistory', 'pitchers', 'currentPitcher', 'pitchLog', 'currentPitches', 'info', 'curGame', 'batter', 'balls', 'strikes', 'outs', 'curTeam', 'pendingQuickRes', 'rbi', 'fin'];
  var GK = ['active', 'inning', 'half', 'first', 'outs', 'batterIdx', 'bases', 'runners'];

  // runners.test.js 와 같은 격리 — 경기 운영 바는 rAF 로 그리므로 테스트 동안만 16ms 타이머로
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
      closeGameSummary();
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
  // 우리 팀(홈) 4명 · 상대 명단(away) — 라인업을 저장하면 첫 선수가 골라져 있다(addPlayer) → 그 상태에서 경기 운영을 켠다
  function start(first, away) {
    fresh();
    AS.curTeam = 'home';
    AS.home_lineup = ['일번', '이번', '삼번', '사번'].map(function (n, i) { return { id: 'fc' + (i + 1), name: n, num: String(i + 1), pos: '', bh: '', isStarter: true }; });
    AS.away_lineup = away || [];
    renderLP();
    selBatter('fc1');
    GF.first = first;
    gfActivate();
  }
  var gap = function () { return T.sleep(750); };   // recHit · recOther 연타 방지(0.7초)
  async function hit(res, rbi) { await gap(); AS.pending = { x: 0.45, y: 0.35, deg: 85, dir: 'CF', ft: 250 }; AS.rbi = rbi || 0; recHit(res); }
  async function other(res) { await gap(); recOther(res); }
  // 헤더 이닝 글자 (scorebook #sbHdrMid — innSel 값을 그린다)
  var hdr = function () { sbRenderNow(); var e = document.querySelector('#sbHdrMid .sb-inn-v'); return e ? e.textContent : null; };
  var AWAY = [{ id: 'fa1', name: '원정일', num: '11', pos: '', bh: '', isStarter: true }];

  test('① 우리 팀 선공 · 상대 명단 없음: 1회말은 타자 없이 — 필드 탭 · 카운트 · 빠른 버튼 기록 안 함 · 「다음 이닝으로 ▶」', async function () {
    await isolated(async function () {
      start('home');
      eq([gfInnStr(), AS.batter && AS.batter.name], ['1회초', '일번'], '전제');
      await other('삼진'); await other('삼진'); await other('삼진');
      await T.sleep(150);   // '3아웃 — …' 알림(80ms 뒤)이 지나간 다음
      eq([gfInnStr(), AS.batter, gfSkip()], ['1회말', null, true], '3아웃 뒤 상대 공격: 우리 타자가 남지 않음');
      eq($('gfbBatter').textContent, '상대 공격 · 기록 안 함', '경기 운영 바');
      var n = AS.abs.length;
      var sp = { x: 0.45, y: 0.35, deg: 85, dist: 0.6 }, p = _semiToCone(_fieldGeo(FS), sp.x, sp.y);
      onFClick({ clientX: p[0], clientY: p[1], rect: { left: 0, top: 0, width: FS, height: FS }, sx: 1, sy: 1, sp: sp });
      await T.sleep(100);
      eq([AS.abs.length, AS.batter, !!window._tp, !!($('batPick') && !$('batPick').hidden)], [n, null, false, false], '필드 탭: 기록 · 타자 고르기 팝업 · \'타자 1\' 없음');
      ok(/상대 타순표에 이름을 넣으면 기록돼요/.test($('toastTxt').textContent), '안내: ' + $('toastTxt').textContent);
      eq(AS.away_lineup.length, 0, '상대 명단에 \'타자 1\'을 만들지 않음');
      chCount('b'); chCount('s');
      eq([AS.balls, AS.strikes], [0, 0], '볼 · 스트라이크 안 셈');
      recQuick('볼넷');
      eq(AS.abs.length, n, '빠른 버튼(도장)도 기록 안 함');
      sbRenderNow();
      eq([$('sbNowBar').hidden, $('sbSkipBar').hidden], [true, false], '폰: 지금 타자 바 대신 넘기기 바');
      ok(/상대 공격/.test($('sbNow').textContent) && $('sbNow').querySelector('[onclick="gfStepHalf(1)"]'), '컴퓨터: 지금 타자 카드에 넘기기 버튼');
      $('sbSkipBar').querySelector('button').click();
      await T.sleep(50);
      sbRenderNow();
      eq([gfInnStr(), hdr(), AS.curTeam, AS.batter && AS.batter.name, gfSkip()], ['2회초', '2회초', 'home', '사번', false], '2회초 · 1회초 마지막 타자 다음');
      eq([$('sbNowBar').hidden, $('sbSkipBar').hidden], [false, true], '넘긴 뒤 지금 타자 바');
      eq(AS.abs.filter(function (a) { return a.team === 'away'; }).length, 0, '상대 타석 0');
    });
  });

  test('① 우리 팀 후공(기본) · 상대 명단 없음: 경기 운영을 켜면 1회초는 타자 없이 · 상대 명단이 있으면 예전처럼', async function () {
    await isolated(async function () {
      start('away');
      eq([gfInnStr(), AS.curTeam, AS.batter, gfSkip()], ['1회초', 'away', null, true], '골라 둔 우리 1번이 남지 않음');
      gfDeactivate();
      start('away', AWAY);
      eq([AS.curTeam, AS.batter && AS.batter.name, gfSkip()], ['away', '원정일', false], '상대 명단이 있으면 상대 1번');
    });
  });

  test('④ 경기 운영 중 헤더 ◀ ▶: 경기 운영 이닝도 같이 옮기고 아웃 · 주자는 비운다', async function () {
    await isolated(async function () {
      start('home', AWAY);
      await hit('안타'); await other('삼진');
      await T.sleep(50);
      eq([GF.outs, GF.bases], [1, [true, false, false]], '전제: 1회초 1아웃 1루');
      recStepInning(1);
      await T.sleep(50);
      eq([gfInnStr(), hdr(), $('innSel').value, GF.outs, GF.bases, AS.curTeam, AS.batter && AS.batter.name], ['1회말', '1회말', '1회말', 0, [false, false, false], 'away', '원정일'], '▶');
      recStepInning(-1);
      await T.sleep(50);
      eq([gfInnStr(), hdr(), AS.curTeam, AS.batter && AS.batter.name], ['1회초', '1회초', 'home', '삼번'], '◀ — 그 팀 마지막 타자 다음');
      recStepInning(-1);
      await T.sleep(50);
      eq(gfInnStr(), '1회초', '1회초 앞은 없다');
    });
  });

  test('③ 경기 운영 타점 = 홈인한 주자 수 — 실책 · 병살로 들어온 점수는 0 · 손으로 넣은 타점은 그대로', async function () {
    await isolated(async function () {
      start('home', AWAY);
      await hit('안타'); await other('볼넷');
      await hit('홈런');
      eq([AS.abs[2].scored.length, AS.abs[2].rbi, AS.hs], [3, 3, 3], '3점 홈런 = 3타점');
      ok(/3타점/.test($('toastTxt').textContent), '알림: ' + $('toastTxt').textContent);
      await hit('3루타');
      await other('희비');
      eq([AS.abs[4].rbi, AS.abs[4].scored.length], [1, 1], '희생플라이 1타점');
      await other('볼넷'); await other('볼넷'); await other('볼넷');
      eq(GF.bases, [true, true, true], '만루');
      await other('실책');
      eq([AS.abs[8].scored.length, AS.abs[8].rbi], [1, 0], '실책으로 들어온 점수는 타점 아님');
      await hit('안타', 2);
      eq(AS.abs[9].rbi, 2, '손으로 넣은 타점 그대로');
    });
  });

  test('③ 경기 리포트 · 경기 종료 창: 우리 팀 타석만 세고 오늘의 선수가 같다', async function () {
    await isolated(async function () {
      fresh();
      var ab = function (id, bid, nm, team, res, rbi) { return { id: id, bid: bid, bname: nm, bnum: '1', team: team, res: res, rbi: rbi, inn: '1회초', pitches: [] }; };
      AS.abs = [
        ab(1, 'h1', '김하나', 'home', '안타', 0), ab(2, 'h1', '김하나', 'home', '안타', 0),
        ab(3, 'h2', '윤여덟', 'home', '홈런', 3), ab(4, 'h3', '정다섯', 'home', '삼진', 0),
        ab(5, 'h3', '정다섯', 'away', '땅볼 아웃', 0), ab(6, 'a1', '상대일', 'away', '플라이 아웃', 0),
      ];
      _pgBuild();
      eq($('pgStatGrid').querySelector('.pg-sv').textContent, '.750', '팀 타율 = 우리 팀 3안타 / 4타수 (상대 타석까지 세면 .500)');
      ok(/윤여덟/.test($('pgInsights').textContent), '리포트 오늘의 선수: ' + $('pgInsights').textContent);
      showGameSummary();
      var t = $('gameSummaryCard').textContent;
      ok(/윤여덟/.test(t) && !/김하나/.test(t), '경기 종료 창 오늘의 선수도 윤여덟: ' + t);
      ok(/\.750/.test(t), '경기 종료 창 팀 타율');
      closeGameSummary();
      AS.abs = [ab(7, 'a1', '상대일', 'away', '안타', 0), ab(8, 'a1', '상대일', 'away', '삼진', 0)];
      eq(_pgAbs().length, 2, '상대 팀만 기록한 경기는 예전처럼 전부');
    });
  });

  test('② 경기설정 타순표: 줄마다 이름 → 같은 줄 수비 칸 → 다음 줄 이름을 눌러도 커서가 누른 칸으로 — 수비가 다음 이름에 붙거나 이름이 빠지지 않는다', async function () {
    await isolated(async function () {
      fresh();
      AS.curTeam = 'home'; AS.home_lineup = []; AS.away_lineup = [];
      renderLP();
      shellNav('settings');
      renderSetup();
      await T.sleep(30);
      // 누르기 = pointerdown 뒤 포커스 (이때 앞 칸이 포커스를 잃어 change → 타순표를 다시 그린다)
      var cell = function (i, f) { return document.querySelectorAll('#stLu .st-row')[i].querySelector('.st-in[data-f="' + f + '"]'); };
      var tap = async function (i, f) { var e = cell(i, f); e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); e.focus(); await T.sleep(60); };
      var P = [['김하나', '8'], ['이두리', '6'], ['박세나', '3']];
      for (var i = 0; i < P.length; i++) {
        await tap(i, 'name');
        ok(document.activeElement === cell(i, 'name'), (i + 1) + '번 이름 칸: ' + (document.activeElement && document.activeElement.getAttribute('aria-label')));
        document.execCommand('insertText', false, P[i][0]);
        await tap(i, 'pos');
        ok(document.activeElement === cell(i, 'pos'), (i + 1) + '번 수비 칸: ' + (document.activeElement && document.activeElement.getAttribute('aria-label')));
        document.execCommand('insertText', false, P[i][1]);
      }
      document.activeElement.blur();
      await T.sleep(30);
      eq(AS.home_lineup.map(function (p) { return p.name + '/' + p.pos; }), ['김하나/8', '이두리/6', '박세나/3'], '이름 · 수비 그대로');
      // Enter 는 예전처럼 다음 줄 이름 칸으로
      var n2 = document.querySelector('#stLu .st-row.empty .st-in.nm');
      n2.focus();
      document.execCommand('insertText', false, '최네오');
      n2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await T.sleep(60);
      eq(AS.home_lineup.map(function (p) { return p.name; }), ['김하나', '이두리', '박세나', '최네오'], '네 번째 선수');
      ok(document.activeElement && document.activeElement.matches('#stLu .st-row.empty .st-in.nm'), 'Enter → 다음 빈 줄 이름 칸');
      document.activeElement.blur();
    });
  });

  test('⑤ 선공 고르기 = 경기설정 홈/원정 · 점수판 윗줄 / 경기종료는 앱 확인 창 (취소 · Esc 면 그대로)', async function () {
    var cf = window.confirm, asked = 0;
    window.confirm = function () { asked++; return true; };
    try {
      await isolated(async function () {
        fresh();
        AS.curTeam = 'home';
        AS.home_lineup = [{ id: 'fc1', name: '일번', num: '1', pos: '', bh: '', isStarter: true }];
        renderLP();
        var nm = function (id, d) { return ($(id).value || '').trim() || d; };
        var top = function () { sbRenderNow(); return document.querySelector('#sbHdrMid .sb-ls tbody th.t').textContent; };
        gfToggle(); $('slRunPick').querySelectorAll('button')[1].click();   // 우리 팀 선공
        eq([GF.active, GF.first, gameInfo().side], [true, 'home', 'away'], '우리 팀 선공 → 경기설정 원정(초 공격)');
        eq(top(), nm('tHome', '내 팀'), '점수판 윗줄 = 우리 팀');
        gfDeactivate();
        gfToggle(); $('slRunPick').querySelectorAll('button')[0].click();   // 상대 선공 (기본)
        eq([GF.first, gameInfo().side], ['away', 'home'], '상대 선공 → 경기설정 홈(말 공격)');
        eq(top(), nm('tAway', '원정팀'), '점수판 윗줄 = 상대 팀');

        gfEndConfirm();
        var box = $('gfEndAsk');
        ok(box && box.style.display === 'flex' && /경기를 종료할까요/.test(box.textContent), '앱 확인 창');
        eq(document.activeElement, box.querySelector('.gw-btn-cancel'), '처음 초점은 「계속 기록」');
        box.querySelector('.gw-btn-cancel').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        eq(box.style.display, 'none', 'Esc → 닫힘');
        gfEndConfirm(); box.querySelector('.gw-btn-cancel').click();
        eq([box.style.display, GF.active, asked], ['none', true, 0], '「계속 기록」 → 경기 운영 그대로 · 브라우저 확인 창 안 뜸');
      });
    } finally { window.confirm = cf; }
  });

  // 흐름 점검 11-06
  test('경기 운영 끔: 상대 타순을 적고 돌아오면 상대 타자가 남지 않는다 — 우리 팀 타석으로 저장되지 않는다', async function () {
    await isolated(async function () {
      fresh();
      AS.curTeam = 'home';
      AS.home_lineup = [{ id: 'fc1', name: '일번', num: '1', pos: '', bh: '', isStarter: true }];
      AS.away_lineup = [];
      renderLP();
      selBatter('fc1');
      swLineupTab('away');
      eq(AS.batter, null, '상대 탭 — 우리 타자 해제');
      $('pName').value = '고일'; $('pNum').value = '7';
      addPlayer();
      eq(AS.batter && AS.batter.name, '고일', '상대 첫 선수를 넣으면 골라진다 (addPlayer)');
      swLineupTab('home');
      eq([AS.batter, AS.batterFilter, $('batterDisp').textContent], [null, false, '타자를 선택하세요'], '돌아오면 타자 없음 · 표시도');
      ok(!$('filterBtn').classList.contains('btn-primary'), '타자 필터 버튼 꺼짐');
      await other('삼진');
      eq(AS.abs.length, 0, '타자 없이는 저장 안 됨');
      selBatter('fc1');
      AS.curTeam = 'away';
      swLineupTab('home');
      eq(AS.batter && AS.batter.id, 'fc1', '이 팀 타자는 그대로');
    });
  });

  test('경기 운영 켬: 상대 명단을 봤다가 공격 팀으로 돌아오면 지금 타순 타자', async function () {
    await isolated(async function () {
      start('home', AWAY);
      await other('삼진');
      eq(AS.batter && AS.batter.id, 'fc2', '다음 타자');
      swLineupTab('away');
      eq(AS.batter, null, '수비 팀 명단을 보는 동안 타자 없음');
      swLineupTab('home');
      eq([AS.curTeam, AS.batter && AS.batter.id, AS.batterFilter], ['home', 'fc2', false], '돌아오면 그 타자 · 필드는 안 거른다');
    });
  });

  test('경기 운영 타석에 그때 수비 팀 투수가 적힌다 — 교체 뒤 · 3아웃 타석 · 공수 교대 뒤 · 투구 기록 투수 우선 · 모르면 안 적음', async function () {
    await isolated(async function () {
      start('home', [{ id: 'fa1', name: '원정일', num: '11', pos: '투수', bh: '', isStarter: true }]);
      AS.home_lineup[0].pos = '투수';
      await hit('안타');
      eq(AS.abs[0].pitcher, '원정일', '1회초 = 상대 타순표 투수');
      AS.away_lineup[0].pos = '';
      AS.away_lineup.push({ id: 'fa2', name: '원정계투', num: '12', pos: '투수', bh: '', isStarter: true });
      await other('삼진');
      eq(AS.abs[1].pitcher, '원정계투', '교체 뒤');
      await other('삼진'); await other('삼진');
      eq([GF.half, AS.abs[3].pitcher], ['bottom', '원정계투'], '3아웃 타석도 그 반 이닝 투수');
      await other('삼진');
      eq(AS.abs[4].pitcher, '일번', '공수 교대 뒤 = 우리 타순표 투수');
      AS.pitchers = [{ id: 1, name: '투구탭', num: '', role: null, pitches: [] }];
      AS.currentPitcher = AS.pitchers[0];
      await other('삼진');
      eq(AS.abs[5].pitcher, '투구탭', '지금 투구 기록 투수가 수비 팀 투수면 그 투수');
    });
    await isolated(async function () {
      start('home', AWAY);
      await other('삼진');
      ok(!('pitcher' in AS.abs[0]), '타순표에 투수가 없고 투구 기록도 없으면 안 적는다');
    });
  });

  // 흐름 점검 11-06 ⑪ (사용자 결정: 후보로 넣기 · 다음 주전으로 넘기기)
  test('주전 9명이면 새로 넣은 선수는 후보 · 지금 타자를 후보로 돌리면 경기 운영 중엔 다음 주전, 아니면 선택 해제', async function () {
    var ev = { stopPropagation: function () {} };
    await isolated(async function () {
      fresh();
      AS.curTeam = 'home';
      AS.home_lineup = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return { id: 'fc' + n, name: '선수' + n, num: String(n), pos: '', bh: '', isStarter: true }; });
      AS.away_lineup = [];
      renderLP();
      $('pName').value = '열번'; $('pNum').value = '10';
      addPlayer();
      eq([AS.home_lineup[9].name, AS.home_lineup[9].isStarter], ['열번', false], '10번째 = 후보');
      AS.home_lineup[0].isStarter = false;
      $('pName').value = '열한번'; $('pNum').value = '11';
      addPlayer();
      eq(AS.home_lineup[10].isStarter, true, '주전이 8명이면 주전으로');
      selBatter('fc3');
      toggleStarter('fc3', ev);
      eq([AS.home_lineup[2].isStarter, AS.batter], [false, null], '경기 운영이 아니면 타자 선택이 풀린다');
      selBatter('fc4');
      toggleStarter('fc5', ev);
      eq(AS.batter && AS.batter.id, 'fc4', '다른 선수를 후보로 돌리면 타자는 그대로');
    });
    await isolated(async function () {
      start('home', AWAY);
      await other('삼진');
      eq(AS.batter && AS.batter.id, 'fc2', '다음 타자');
      toggleStarter('fc2', ev);
      eq(AS.batter && AS.batter.id, 'fc3', '경기 운영 중 지금 타자를 후보로 → 다음 주전');
      await other('삼진');
      eq(AS.batter && AS.batter.id, 'fc4', '그 뒤로도 타순대로');
    });
  });

  // 흐름 점검 11-06 P2 ⑦ — 경기종료 → 저장 → 분석에 「중 · 진행 중」 · 「지금 타석」 · 「투구 기록 중」 · 「등판 중」이 남았다
  test('경기종료 뒤엔 끝난 경기 — 팀 「진행 중」 · 타자 「지금 타석」 · 투수 「등판 중」 없음 · 저장해 다시 열어도 끝 · 새 타석을 치면 다시 진행 중', async function () {
    await isolated(async function () {
      start('home', AWAY);
      AS.pitchers = [{ id: 'fp1', name: '원정투', num: '30', pitches: [{ id: Date.now(), batter: '일번' }] }]; AS.currentPitcher = AS.pitchers[0];
      await hit('안타'); await other('삼진');
      var txt = function (e) { return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
      var look = async function () {
        shellOpenAnalysis('team'); await T.sleep(50); setTeamScope('scope', 'game'); setTeamScope('side', 'home');
        var team = txt(document.querySelector('#teamContent .tm-res')) + ' ' + txt(document.querySelector('#teamContent .tm-g-main small'));
        shellOpenAnalysis('batter'); await T.sleep(50);
        var bat = txt(document.querySelector('#batterView .bt-eyebrow')), pill = /투구 기록 중/.test(txt($('batterView')));
        shellOpenAnalysis('pitcher'); await T.sleep(50); setPitcherView('mode', 'stats');
        var small = Array.prototype.map.call(document.querySelectorAll('#pitcherView .an-chip small'), txt);
        var tag = !!document.querySelector('#pitcherView .pc-live-tag') || small.some(function (t) { return /^등판 중 ·/.test(t); });
        setPitcherView('mode', 'input');   // 투구 기록 모드 — 지금 투수 카드
        var pit = txt(document.querySelector('#pitcherView .pc-live-who small'));
        setPitcherView('mode', 'stats');
        return { team: team, bat: bat, pill: pill, pit: pit, tag: tag };
      };
      var L = await look();
      ok(!gfEnded() && /^중 진행 중/.test(L.team), '경기 중: ' + L.team);
      eq([L.bat, L.pill, L.pit, L.tag], ['지금 타석', true, '등판 중', true], '경기 중: 지금 타석 · 투구 기록 중 · 등판 중');

      gfEndGame(); await T.sleep(400); $('pgReport').style.display = 'none';
      ok(gfEnded(), '경기종료 → 끝난 경기');
      L = await look();
      ok(/^무 경기 끝 · 2타석 1\/2/.test(L.team), '팀 이번 경기 = 승패 · 경기 끝: ' + L.team);
      eq([L.bat, L.pill, L.pit, L.tag], ['타자 브리핑', false, '마지막 투수', false], '지금 타석 · 투구 기록 중 · 등판 중 없음');

      saveGame(true);
      var key = window._curSaveKey, fin = AS.fin;
      eq(JSON.parse(localStorage.getItem(key)).live.fin, fin, '저장 항목에 경기종료 시각');
      restoreGame(key);
      eq([AS.fin, gfEnded()], [fin, true], '목록에서 다시 열어도 끝난 경기');
      _applyLive(undefined);
      eq(AS.fin, null, '경기종료 시각이 없는 경기를 열면 진행 중 (예전처럼)');
      _applyLive({ fin: fin });
      selBatter('fc1'); await hit('안타');
      ok(!gfEnded(), '경기종료 뒤에 친 타석이 생기면 다시 진행 중');
    });
  });

  test('⑫ 경기 운영 3아웃 뒤 투구 화면 이닝 칸 · 아웃 점이 바로 새 반 이닝으로 (첫 공을 기다리지 않는다)', async function () {
    await isolated(async function () {
      start('home', AWAY);
      AS.home_lineup[3].pos = '1';   // 우리 팀 투수 사번 — 1회말 수비 때 투구 화면이 그 투수로 (아웃 점이 보이게)
      var P = { id: 'fp1', name: '원정투', num: '30', role: 'SP', pitches: [] };
      AS.pitchers = [P]; AS.currentPitcher = P; window._pitchInnAskedFor = AS.pitchers;   // 첫 공 이닝 묻기 건너뜀
      var bar = function () { var d = document.querySelector('#pitchCountBar .pcnt-dots'); return [$('pitchInnSel').value, d ? (d.getAttribute('aria-label').match(/아웃 \d/) || [''])[0] : '']; };
      var k3 = async function () { await gap(); recordPitch('헛스윙'); recordPitch('헛스윙'); recordPitch('헛스윙'); await T.sleep(60); };
      await k3(); await k3();
      eq(bar(), ['1회초', '아웃 2'], '2아웃');
      await k3();
      eq(GF.inning + GF.half, '1bottom', '3아웃 → 1회말');
      eq(bar(), ['1회말', '아웃 0'], '투구 화면도 바로 1회말 · 아웃 0');
    });
  });

  test('⑩ 경기설정 팀 이름: 기본 이름(내 팀 · 원정팀)은 흐린 안내 글자 — 눌러서 치면 「내 팀한빛」이 아니라 「한빛」', async function () {
    var h = $('tHome'), w = $('tAway'), hv = h.value, wv = w.value;
    try {
      await isolated(async function () {
        h.value = '내 팀'; w.value = '원정팀';
        shellNav('settings'); renderSetup(); await T.sleep(30);
        var inp = function (k) { return document.querySelector('#stInfo input[placeholder="' + (k === 'home' ? '내 팀' : '원정팀') + '"]'); };
        eq([inp('home').value, inp('home').placeholder, inp('away').value, inp('away').placeholder], ['', '내 팀', '', '원정팀'], '기본 이름은 값이 아니라 안내 글자');
        inp('home').focus(); document.execCommand('insertText', false, '한빛'); await T.sleep(30);
        eq(h.value, '한빛', '치면 그 이름만');
        document.activeElement.blur(); await T.sleep(30);
        h.value = '불꽃'; w.value = '상대팀'; renderSetup(); await T.sleep(30);
        eq([inp('home').value, inp('away').value], ['불꽃', ''], '직접 넣은 이름은 그대로 · 상대팀도 안내 글자');
      });
    } finally { h.value = hv; w.value = wv; }
  });
})();
