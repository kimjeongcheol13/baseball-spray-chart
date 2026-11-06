// 필드 캔버스 크기 바꾸기 — 앱으로 돌아올 때(visibilitychange) · 새 경기 시작 뒤(startFromWizard)도 initCanvas · resize 와 같게
//   backing = FS × DPR, CSS = FS px, 컨텍스트 배율 = DPR. 예전엔 이 두 길만 backing = FS 로 바꿔 폰(DPR 2~3)에서 필드가 흐렸고,
//   FS 가 같아져 resize · ResizeObserver 도 건너뛰어 새로고침 전엔 안 돌아왔다 (흐름 점검 11-05 ⑦)
//   · 테스트 창은 DPR 1 이라 그대로는 안 보인다 → 테스트 동안만 DPR 을 2 로 둔다 (core.js var DPR)
//   · 앱으로 돌아올 때(visibilitychange) 길은 러너가 그 이벤트를 막아(run.mjs — 다시 로드 방지) 여기서 못 돈다. 같은 줄로 고쳤고 PR 에 헤드리스 Chrome DPR 2 로 잰 값이 있다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var IDS = ['fldCanvas', 'hitCanvas', 'ovrCanvas'];

  async function ready() {
    await sleep(2500);   // 앱 시작 작업(마지막 경기 열기 등)이 끝난 뒤
    if ($('landing-page').style.display !== 'none') { showApp(); await sleep(300); }
    var nw = _fieldFS($('cwrap'));
    ok(nw > 0, '전제: 필드 칸 크기를 잴 수 있어야 함 — ' + nw);
    return nw;
  }
  // 크기가 바뀐 것처럼: FS 를 틀리게, CSS 크기도 틀리게 둔다
  function skew(nw) { FS = nw + 37; IDS.forEach(function (id) { $(id).style.width = $(id).style.height = '999px'; }); }
  function check(nw, msg) {
    eq(FS, nw, msg + ': FS = 필드 칸 크기');
    IDS.forEach(function (id) {
      var c = $(id);
      eq([c.width, c.height, c.style.width, c.style.height], [nw * 2, nw * 2, nw + 'px', nw + 'px'], msg + ': ' + id + ' backing = FS×DPR · CSS = FS');
    });
    eq([fCtx.getTransform().a, hCtx.getTransform().a, oCtx.getTransform().a], [2, 2, 2], msg + ': 컨텍스트 배율 = DPR');
  }
  // 원래대로: DPR 되돌리고 같은 길(resize)로 다시 맞춘다
  async function restore(dpr) {
    DPR = dpr; FS = -1;
    var raf = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); };
    try { window.dispatchEvent(new Event('resize')); await sleep(100); } finally { window.requestAnimationFrame = raf; }
  }

  test('필드 캔버스: 새 경기 시작 뒤 크기를 다시 재도 DPR · CSS 크기 · 배율이 맞다', async function () {
    var nw = await ready(), dpr = DPR;
    var keep = { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, hs: AS.hs, as: AS.as, zh: AS.zoneHistory, p: AS.pitchers, info: AS.info, g: AS.curGame, b: AS.batter,
      ck: window._curSaveKey, gs: window._gameSaved, ak: window._autoKey, th: $('tHome').value, ta: $('tAway').value };
    var store = {}, raf = window.requestAnimationFrame;
    for (var i = 0; i < localStorage.length; i++) store[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    try {
      window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); };   // 가상 시간에선 rAF 가 제때 안 온다
      openGameWizard(true);
      $('gwHome').value = '캔버스홈'; $('gwAway').value = '캔버스원정';
      DPR = 2; skew(nw);
      startFromWizard();
      await sleep(100);
      check(nw, '새 경기 뒤');
    } finally {
      window.requestAnimationFrame = raf;
      try { storageManager.cancelPendingAutosave(); clearTimeout(_autoTimer); } catch (e) {}
      localStorage.clear(); Object.keys(store).forEach(function (k) { localStorage.setItem(k, store[k]); });
      AS.abs = keep.abs; AS.home_lineup = keep.hl; AS.away_lineup = keep.al; AS.hs = keep.hs; AS.as = keep.as; AS.zoneHistory = keep.zh; AS.pitchers = keep.p; AS.info = keep.info; AS.curGame = keep.g; AS.batter = keep.b;
      window._curSaveKey = keep.ck; window._gameSaved = keep.gs; window._autoKey = keep.ak; $('tHome').value = keep.th; $('tAway').value = keep.ta;
      try { closeGameWizard(); } catch (e) {}
      await restore(dpr);
    }
  });
})();
