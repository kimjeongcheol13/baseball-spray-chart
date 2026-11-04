// 휴대폰 투구 기록 화면: 맨 아래까지 내리면 마지막 카드(투구 기록 · 최근 투구 로그)가 고정된 덩어리(.pitch-dock) 위로 다 보여야 한다
//  · 예전엔 shell.css 의 #anaBody .tab-pnl{padding:0!important} 가 pitcher.css 의 아래 여백(290px)을 0으로 덮어서 로그가 덩어리 뒤에 가려졌다
//  · 투구 수 관리를 켜면 덩어리에 줄이 하나 늘어난다(약 345px) — 켠 상태로 확인한다
// @window 390,844
// @pointer coarse
(function () {
  var T = window.__T, ok = T.ok, test = T.test, $ = T.$;

  test('휴대폰 투구 기록: 맨 아래 카드가 고정 덩어리에 가려지지 않는다 (투구 수 줄 켠 상태)', async function () {
    var keep = { p: AS.pitchers, cp: AS.currentPitcher, rule: localStorage.getItem('sl_pitch_rule') };
    try {
      localStorage.setItem('sl_pitch_rule', JSON.stringify({ on: true }));
      var P = { id: 'pp1', name: '여백투', num: '3', role: null, pitches: [] };
      for (var i = 0; i < 40; i++) P.pitches.push({ id: Date.now() - (40 - i) * 20000, inning: '1회초', pt: '직구', result: '볼', pr: '볼', v: 2 });
      AS.pitchers = [P]; AS.currentPitcher = P;
      shellOpenAnalysis('pitcher'); setPitcherView('mode', 'input'); renderPitchCount();
      await T.sleep(600);
      var pnl = $('pnl-pitcher'), dock = pnl.querySelector('.pitch-dock');
      ok(dock && getComputedStyle(dock).position === 'fixed', '휴대폰에서는 덩어리가 화면 아래에 고정');
      // 맨 아래까지 내린다 (창 · 스크롤되는 조상 모두)
      for (var e = pnl; e; e = e.parentElement) if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight;
      document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
      await T.sleep(300);
      var last = null, lb = -1;
      Array.prototype.forEach.call(pnl.querySelectorAll('*'), function (el) {
        if (dock.contains(el)) return;
        var r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        if (r.bottom > lb) { lb = r.bottom; last = el; }
      });
      ok(last, '덩어리 밖에 보이는 내용이 있어야 한다');
      var d = dock.getBoundingClientRect(), r = last.getBoundingClientRect();
      ok(r.bottom <= d.top, '맨 아래 카드 끝(' + Math.round(r.bottom) + ')이 덩어리 위(' + Math.round(d.top) + ')보다 위에 있어야 한다 · 덩어리 높이 ' + Math.round(d.height));
      var hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 6);
      ok(hit && !dock.contains(hit), '맨 아래 카드 자리의 맨 위 요소가 덩어리가 아니어야 한다: ' + (hit && (hit.id || hit.className)));
    } finally {
      if (keep.rule == null) localStorage.removeItem('sl_pitch_rule'); else localStorage.setItem('sl_pitch_rule', keep.rule);
      AS.pitchers = keep.p; AS.currentPitcher = keep.cp;
      try { setPitcherView('mode', 'analysis'); shellNav('record'); } catch (e) {}
      renderPitchCount();
    }
  });
})();
