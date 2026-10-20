// 경기 전(기록 0) 상태도 새로고침 뒤 이어지는지 — 라인업 사진을 찍으러 카메라에 다녀온 사이 페이지가 새로 열리면(안드로이드 탭 정리 · 새 버전 적용)
// 복구 슬롯(sl_autosave)이 비어 있어 _openLastGame 이 "가장 최근 저장 경기"(이전 경기)를 열었다.
//  · 새로고침은 하네스가 막으므로, 화면 숨김(pagehide → _scheduleRecoverySave(0))을 보낸 뒤 앱을 막 연 상태(AS 비움)를 만들고 _openLastGame 을 직접 부른다
//  · 빈 새 경기는 6시간 안에 다시 열 때만 이어 준다(그 뒤엔 예전처럼 마지막 저장 경기). 기록이 있는 복구본은 빈 상태로 덮지 않는다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, ls = T.ls, test = T.test, $ = T.$;
  var F = ['abs', 'home_lineup', 'away_lineup', 'hs', 'as', 'zoneHistory', 'pitchers', 'info', 'curGame', 'batter'];
  var PREV = 'sl_1779000000000';
  var AB = [{ id: 1, res: '안타', bname: '가선수', team: 'home', inn: '1회초', x: 0.4, y: 0.4 }];

  async function isolated(fn) {
    var store = {}, a = {}, ck = window._curSaveKey, gs = window._gameSaved, ak = window._autoKey, cs = window.cloudAutoSyncRecord;
    var th = $('tHome').value, ta = $('tAway').value;
    for (var i = 0; i < localStorage.length; i++) store[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    F.forEach(function (k) { a[k] = AS[k]; });
    window.cloudAutoSyncRecord = null;
    try { await fn(); }
    finally {
      storageManager.cancelPendingAutosave(); clearTimeout(_autoTimer); localStorage.clear();
      Object.keys(store).forEach(function (k) { localStorage.setItem(k, store[k]); });
      F.forEach(function (k) { AS[k] = a[k]; });
      window._curSaveKey = ck; window._gameSaved = gs; window._autoKey = ak; window.cloudAutoSyncRecord = cs;
      $('tHome').value = th; $('tAway').value = ta;
      closeGameWizard();
    }
  }
  // 이전 경기(기록 1타석) 하나가 저장돼 있는 기기
  function seedPrev() {
    localStorage.clear();
    localStorage.setItem(PREV, JSON.stringify({ key: PREV, th: '이전홈', ta: '이전원정', hs: 1, as: 0, abs: AB, home_lineup: [{ id: 'h1', name: '가선수', num: '7', pos: '유격' }], away_lineup: [], zoneHistory: {}, pitchers: [], d: '2026. 10. 19.', ts: 1 }));
    localStorage.setItem('sl_saves', JSON.stringify([{ key: PREV, label: '이전 경기', ts: 1 }]));
  }
  // 경기 만들기로 새 경기 시작
  function newGame(home, away) {
    openGameWizard(true);
    $('gwHome').value = home; $('gwAway').value = away;
    startFromWizard();
  }
  // 앱을 막 연 상태(새로고침 직후): 메모리는 비고 화면은 index.html 그대로
  function reopen() {
    AS.abs = []; AS.home_lineup = []; AS.away_lineup = []; AS.hs = 0; AS.as = 0; AS.zoneHistory = {}; AS.pitchers = []; AS.info = null; AS.batter = null;
    AS.curGame = null; window._curSaveKey = null; window._autoKey = null;
    $('tHome').value = '홈팀'; $('tAway').value = '원정팀';
    _openLastGame();
  }
  function hide() { window.dispatchEvent(new Event('pagehide')); }   // 카메라 · 파일 선택으로 화면을 떠남 (core.js: pagehide → _scheduleRecoverySave(0))

  test('새 경기(기록 · 라인업 0)에서 카메라를 다녀오는 사이 새로 열려도 이전 경기가 아니라 그 새 경기로', async function () {
    await isolated(async function () {
      seedPrev(); newGame('새홈', '새원정');
      var id = AS.curGame;
      ok(id && !window._curSaveKey, '전제: 저장 전 새 경기');
      hide();
      var slot = ls('sl_autosave');
      ok(slot && slot.data, '복구 슬롯이 적혀야 함');
      eq([slot.data.newGame, slot.data.th, slot.data.ta], [id, '새홈', '새원정'], '복구 슬롯: 새 경기 · 팀 이름');
      reopen();
      eq([$('tHome').value, $('tAway').value], ['새홈', '새원정'], '팀 이름 = 새 경기');
      ok(window._curSaveKey !== PREV, '이전 경기를 열었음');
      eq(AS.abs.length, 0, '기록 없음');
      eq(AS.curGame, id, '같은 새 경기로 이어짐(다시 새로고침돼도 이어지게)');
      hide(); reopen();
      eq($('tHome').value, '새홈', '두 번째 새로고침 뒤에도 새 경기');
    });
  });

  test('라인업만 넣은 경기(기록 0)도 새로 열리면 라인업 · 팀 이름 그대로', async function () {
    await isolated(async function () {
      seedPrev(); newGame('새홈', '새원정');
      AS.home_lineup = [{ id: 'n1', name: '나선수', num: '11', pos: '중견' }, { id: 'n2', name: '다선수', num: '12', pos: '포수' }];
      hide(); reopen();
      eq(AS.home_lineup.map(function (p) { return p.name; }), ['나선수', '다선수'], '홈 라인업');
      eq($('tHome').value, '새홈', '팀 이름');
      ok(window._curSaveKey !== PREV, '이전 경기를 열었음');
      ok(!ls('sl_saves').some(function (s) { return /^sl_rec_/.test(s.key); }), '기록 없는 경기는 복구 저장 항목을 만들지 않는다');
    });
  });

  test('새 경기를 시작하지 않았으면 예전처럼 마지막 저장 경기 · 6시간 지난 빈 새 경기도 마지막 저장 경기', async function () {
    await isolated(async function () {
      seedPrev(); reopen();
      eq(window._curSaveKey, PREV, '복구할 게 없으면 마지막 저장 경기');
      eq($('tHome').value, '이전홈', '이전 경기 팀 이름');
      seedPrev();
      localStorage.setItem('sl_autosave', JSON.stringify({ _v: '1.2.0', _ts: Date.now() - 7 * 3600 * 1000, data: { newGame: 123, abs: [], home_lineup: [], away_lineup: [], th: '새홈', ta: '새원정' } }));
      reopen();
      eq(window._curSaveKey, PREV, '6시간 지난 빈 새 경기는 이어 주지 않음');
    });
  });

  test('기록이 있는 복구본은 빈 새 경기로 덮지 않는다', async function () {
    await isolated(async function () {
      seedPrev();
      localStorage.setItem('sl_autosave', JSON.stringify({ _v: '1.2.0', _ts: Date.now(), data: { abs: AB, home_lineup: [], away_lineup: [], th: '복구홈', ta: '복구원정', saveKey: null } }));
      AS.abs = []; AS.home_lineup = []; AS.away_lineup = []; AS.pitchers = []; AS.curGame = Date.now(); window._curSaveKey = null;
      hide();
      eq(ls('sl_autosave').data.abs.length, 1, '복구본의 기록이 남아 있어야 함');
      eq(ls('sl_autosave').data.th, '복구홈', '복구본 그대로');
    });
  });
})();
