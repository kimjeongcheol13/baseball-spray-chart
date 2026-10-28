// 아웃 수비 기록 (js/features/fielding.js · core.js recHit) — 타구 위치로 추정 · 저장 토스트 [수비 고치기] · 「타석 기록 수정」 수비 줄 ·
//  기록 목록 · 리그 기록지 칸 · 공유 링크(싣기 · 받을 때 형식 확인)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var F = ['abs', 'home_lineup', 'away_lineup', 'hs', 'as', 'batter', 'curTeam', 'pending', 'rbi', 'pt', 'zone', 'info'];

  async function isolated(fn) {
    var store = {}, a = {}, cs = window.cloudAutoSyncRecord;
    for (var i = 0; i < localStorage.length; i++) store[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    F.forEach(function (k) { a[k] = AS[k]; });
    window.cloudAutoSyncRecord = function () {};
    try { await fn(); }
    finally {
      ['fpOverlay', 'editRecOverlay', 'shareQROv'].forEach(function (id) { var o = $(id); if (o) o.classList.remove('show'); });
      document.querySelectorAll('.overlay.show').forEach(function (o) { o.classList.remove('show'); });
      hideToast();
      storageManager.cancelPendingAutosave(); clearTimeout(_autoTimer); localStorage.clear();
      Object.keys(store).forEach(function (k) { localStorage.setItem(k, store[k]); });
      F.forEach(function (k) { AS[k] = a[k]; });
      window.cloudAutoSyncRecord = cs;
      var p = $('slRunPick'); if (p) p.remove();
      try { updateAll(); } catch (e) {}
    }
  }
  function game() {
    AS.abs = []; AS.hs = 0; AS.as = 0; AS.info = null; AS.rbi = 0; AS.pt = null; AS.zone = null;
    AS.away_lineup = [{ id: 'k1', name: '김유격', num: '6', pos: '', bh: '', isStarter: true }];
    AS.home_lineup = [];
    AS.curTeam = 'away'; AS.batter = AS.away_lineup[0];
  }
  // 필드를 탭한 것처럼 자리를 잡고 결과 버튼을 누른다 (core recHit) — 연타 방지(0.7초)를 넘기도록 먼저 기다린다
  async function hit(res, deg, ft) { await T.sleep(750); AS.pending = { x: .4, y: .4, deg: deg, dir: 'LC', ft: ft }; AS.rbi = 0; recHit(res); return AS.abs[AS.abs.length - 1]; }
  var pad = function (n) { document.querySelector('#fpPad [data-n="' + n + '"]').click(); };
  var shown = function (id) { return $(id).classList.contains('show'); };

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    for (var i = 0; i < 100 && typeof window.slFpGuess !== 'function'; i++) await T.sleep(50);
    ok(typeof window.slFpGuess === 'function', 'fielding.js 가 올라오지 않음');
  });

  test('추정: 땅볼 = 잡은 야수-1루(1루수는 3U) · 뜬공 F · 라인드라이브 L — 방향(30 좌익선 · 90 중견 · 150 우익선) · 거리(ft)로', function () {
    var g = window.slFpGuess;
    eq([g('땅볼 아웃', 50, 110), g('땅볼 아웃', 75, 110), g('땅볼 아웃', 100, 110), g('땅볼 아웃', 135, 110)], ['5-3', '6-3', '4-3', '3U'], '내야 넷');
    eq([g('땅볼 아웃', 90, 55), g('땅볼 아웃', 70, 15)], ['1-3', '2-3'], '투수 앞 · 포수 앞');
    eq([g('플라이 아웃', 40, 280), g('플라이 아웃', 90, 300), g('플라이 아웃', 140, 250)], ['F7', 'F8', 'F9'], '외야 셋');
    eq([g('플라이 아웃', 80, 120), g('플라이 아웃', 60, 30), g('라인드라이브 아웃', 100, 110), g('라인드라이브 아웃', 60, 200)], ['F6', 'F2', 'L4', 'L7'], '내야 뜬공 · 포수 뜬공 · 직선타');
    eq([g('안타', 75, 110), g('삼진', 75, 110), g('땅볼 아웃', null, 110), g('플라이 아웃', 90)], [null, null, null, 'F4'], '아웃이 아니면 · 방향이 없으면 없음 · 거리가 없으면 내야로');
  });

  test('기록: 땅볼 아웃을 적으면 타석에 6-3 · 토스트 [수비 고치기] → 번호판으로 4-3 · 기록 목록 · 타석 기록에 보인다', async function () {
    await isolated(async function () {
      game();
      var a = await hit('땅볼 아웃', 75, 110);
      eq(a.fp, '6-3', '추정');
      ok($('toastTxt').textContent.indexOf('땅볼 아웃 6-3') >= 0, '저장 토스트: ' + $('toastTxt').textContent);
      eq($('toastFp').style.display, '', '[수비 고치기] 보임');
      ok($('toast').classList.contains('toast-fp-on'), '버튼 둘 → 휴대폰에서 버튼 줄을 글자 아래로 (toast-fp-on)');
      $('toastFp').click();
      ok(shown('fpOverlay'), '번호판이 열림');
      eq($('fpVal').textContent, '6-3', '지금 값');
      $('fpBack').click(); $('fpBack').click();
      eq($('fpVal').textContent, '없음', '두 번 지우면 비움');
      pad(4); pad(3);
      eq($('fpVal').textContent, '4-3', '4 → 3');
      $('fpOk').click();
      ok(!shown('fpOverlay'), '저장하면 닫힘');
      eq(a.fp, '4-3', '타석에 반영');
      ok($('recList').textContent.indexOf('4-3') >= 0, '기록 목록 줄에 4-3');
      eq(window.sbPaint.abbrOf(a), '4-3', '타석 기록(종이 기록지) 줄 약어');
      var b = await hit('안타', 75, 110);
      ok(!b.fp, '안타에는 수비 기록 없음');
      eq($('toastFp').style.display, 'none', '안타 토스트에는 [수비 고치기] 없음');
      ok(!$('toast').classList.contains('toast-fp-on'), '안타 토스트는 원래 배치');
    });
  });

  test('번호판: 1루수 혼자 3U · 뜬공은 번호 하나(누르면 바뀜) · 취소하면 그대로', async function () {
    await isolated(async function () {
      game();
      var a = await hit('땅볼 아웃', 135, 110);
      eq(a.fp, '3U', '1루 쪽 땅볼');
      $('toastFp').click();
      eq($('fpVal').textContent, '3U', '지금 값');
      ok(!$('fpU').hidden && $('fpU').getAttribute('aria-pressed') === 'true', '혼자 아웃 눌림');
      $('fpBack').click();
      eq($('fpVal').textContent, '3', '지우면 U 부터');
      $('fpU').click();
      eq($('fpVal').textContent, '3U', '혼자 아웃 다시');
      pad(1);
      eq($('fpVal').textContent, '3-1', '번호를 더 누르면 U 는 빠지고 3-1');
      ok($('fpU').disabled, '번호가 둘이면 혼자 아웃 못 누름');
      $('fpCancel').click();
      eq(a.fp, '3U', '취소하면 그대로');
      var f = await hit('플라이 아웃', 90, 300);
      eq(f.fp, 'F8', '중견수 뜬공');
      $('toastFp').click();
      ok($('fpU').hidden, '뜬공에는 혼자 아웃 없음');
      pad(7); pad(9);
      eq($('fpVal').textContent, 'F9', '뜬공은 마지막에 누른 번호 하나');
      $('fpOk').click();
      eq(f.fp, 'F9', '저장');
    });
  });

  test('「타석 기록 수정」: 수비 줄 · 결과를 바꾸면 다시 추정(뜬공 ↔ 라인드라이브는 야수 그대로) · 저장해야 반영 · Esc 는 번호판만 · 아웃이 아니면 지움', async function () {
    await isolated(async function () {
      game();
      var a = await hit('땅볼 아웃', 75, 110);
      openEditRec(a.id);
      ok(shown('editRecOverlay') && !$('editFpRow').hidden, '수비 줄 보임');
      eq($('editFpBtn').textContent, '6-3 · 고치기', '지금 값');
      var setRes = function (v) { $('editRes').value = v; $('editRes').dispatchEvent(new Event('change')); };
      setRes('플라이 아웃');
      eq($('editFpBtn').textContent, 'F6 · 고치기', '뜬공으로 바꾸면 다시 추정');
      setRes('라인드라이브 아웃');
      eq($('editFpBtn').textContent, 'L6 · 고치기', '라인드라이브로 바꾸면 야수 그대로');
      $('editFpBtn').click();
      ok(shown('fpOverlay'), '번호판');
      pad(8);
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      ok(!shown('fpOverlay') && shown('editRecOverlay'), 'Esc: 번호판만 닫히고 수정 창은 남는다');
      eq($('editFpBtn').textContent, 'L6 · 고치기', 'Esc 는 고른 값을 버림');
      $('editFpBtn').click(); pad(8); $('fpOk').click();
      eq($('editFpBtn').textContent, 'L8 · 고치기', '번호판 저장 → 수비 줄');
      eq(a.fp, '6-3', '수정 창을 저장하기 전에는 타석 그대로');
      saveEditRec();
      eq([a.res, a.fp], ['라인드라이브 아웃', 'L8'], '수정 창 저장');
      openEditRec(a.id);
      $('editFpBtn').click(); pad(9); $('fpOk').click();
      closeOverlay('editRecOverlay');   // 수정 창 취소
      eq(a.fp, 'L8', '수정 창을 취소하면 그대로');
      openEditRec(a.id);
      setRes('안타');
      ok($('editFpRow').hidden, '안타면 수비 줄 숨김');
      saveEditRec();
      ok(!('fp' in a), '아웃이 아닌 결과로 저장하면 수비 기록을 지운다');
    });
  });

  test('리그 기록지 칸: 수비 기록이 있으면 그것(6-3 · F8 · L6) · 없으면 예전 약어', async function () {
    var m = await import('/js/features/scoresheet.js?v=4');
    var c = function (res, fp) { return m.cellCode({ res: res, fp: fp, x: .3, dir: 'LC' }); };
    eq([c('땅볼 아웃', '6-3'), c('플라이 아웃', 'F8'), c('라인드라이브 아웃', 'L6'), c('땅볼 아웃', '3U')], ['6-3', 'F8', 'L6', '3U'], '수비 기록');
    eq([c('땅볼 아웃'), c('플라이 아웃')], ['땅볼', '좌중비'], '수비 기록 없는 예전 타석');
  });

  test('리그 기록지 맨 아래: 약어 세 줄(수비 줄 포함) 다음 서명 줄 — 간격은 예전 두 줄일 때와 같고 그림 안에 들어간다', async function () {
    var m = await import('/js/features/scoresheet.js?v=4');
    var d = m.sheetData({ abs: [{ id: 1, bid: 'k1', bname: '김유격', bnum: '6', team: 'away', inn: '1회초', res: '땅볼 아웃', fp: '6-3' }],
      away_lineup: [{ id: 'k1', name: '김유격', num: '6' }], home_lineup: [], info: null, hs: 0, as: 0, th: '', ta: '' });
    var cv = document.createElement('canvas'), at = {}, fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y) { at[String(t).slice(0, 4)] = y; return fill.apply(this, arguments); };   // 글자 줄의 기준선 y
    try { m.drawSheet(cv, d); } finally { CanvasRenderingContext2D.prototype.fillText = fill; }
    var leg = [at['칸 — '], at['득점한 '], at['수비 —']], sig = at['기록원'];
    ok(leg.every(function (y) { return y > 0; }) && sig > 0, '약어 줄 · 서명 줄 찾음: ' + JSON.stringify(Object.keys(at).filter(function (k) { return /칸|득점|수비|기록|—/.test(k); }).map(function (k) { return [k, at[k]]; })));
    eq([leg[1] - leg[0], leg[2] - leg[1]], [15, 15], '약어 줄 간격 15');
    ok(sig - leg[2] >= 30, '마지막 약어 줄과 서명 사이 ' + (sig - leg[2]) + ' — 예전(두 줄 · 31)만큼 떨어져야 한다');
    ok(sig + 4 <= cv.height - 10, '서명 밑줄이 그림 아래 끝에서 10 이상 안쪽: ' + sig + ' / ' + cv.height);
  });

  test('공유 링크: 수비 기록을 싣고, 받을 때는 형식이 맞는 것만 (6-3 · 3U · F8 · L6)', async function () {
    await isolated(async function () {
      game();
      await hit('땅볼 아웃', 75, 110); await hit('플라이 아웃', 90, 300); await hit('안타', 75, 110);
      var push = window.pushSharedLink, payload = null;
      window.pushSharedLink = function (pl) { payload = pl; };   // 서버로 보내지 않고 payload 만 잡는다
      try { shareGameLink(); } finally { window.pushSharedLink = push; }
      ok(payload && payload.abs, 'payload 없음');
      eq(payload.abs.map(function (x) { return x.fp; }), ['6-3', 'F8', undefined], '보내는 쪽');
      var back = _restoreAbsFromPayload(JSON.parse(JSON.stringify(payload.abs)).concat([{ r: '땅볼 아웃', fp: '<b>' }, { r: '땅볼 아웃', fp: '3U' }, { r: '땅볼 아웃', fp: '6-3-0' }, { r: '플라이 아웃', fp: 'F10' }]));
      eq(back.map(function (x) { return x.fp; }), ['6-3', 'F8', undefined, undefined, '3U', undefined, undefined], '받는 쪽');
    });
  });
})();
