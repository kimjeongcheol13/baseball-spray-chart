// 라인업 줄의 ✕(선수 삭제) — 주전/후보 버튼을 덮지 않는다(마우스 화면) · 지운 선수는 토스트의 되돌리기로 되살린다
//  · 예전엔 ✕ 가 행 오른쪽에 떠 있어(absolute · 평소 투명) '주전' 버튼 자리에 있었고, '주전'을 누르면 선수가 확인 없이 지워졌다 (터치는 paper.css pointer: coarse 에서 이미 고침)
// @window 1280,860
// @pointer fine
(function () {
  var T = window.__T, ok = T.ok, test = T.test, $ = T.$;

  test('데스크톱 라인업 줄: ✕ 는 주전 버튼 오른쪽에 따로 있다 (겹치지 않는다)', async function () {
    var keep = { home: AS.home_lineup, cur: AS.curTeam };
    try {
      AS.curTeam = 'home';
      AS.home_lineup = [{ id: 'ov1', name: '김투수', num: '11', pos: '투수', bh: '', isStarter: true }, { id: 'ov2', name: '박포수', num: '22', pos: '', bh: '', isStarter: false }];
      renderLP();
      shellDrawer(true);
      await T.sleep(400);
      var rows = [].filter.call($('lpList').querySelectorAll('.player-row'), function (r) { return r.getBoundingClientRect().width > 0; });
      ok(rows.length === 2, '라인업 줄 2개가 그려져야 한다: ' + rows.length);
      rows.forEach(function (r, i) {
        var s = r.querySelector('.starter-btn').getBoundingClientRect(), d = r.querySelector('.p-del').getBoundingClientRect();
        ok(d.left >= s.right, (i + 1) + '번 줄: ✕(' + Math.round(d.left) + '~' + Math.round(d.right) + ')가 주전 버튼(' + Math.round(s.left) + '~' + Math.round(s.right) + ')을 덮는다');
      });
    } finally {
      try { shellDrawer(false); } catch (e) {}
      AS.home_lineup = keep.home; AS.curTeam = keep.cur;
      renderLP();
    }
  });

  // ✕ 는 확인 없이 지운다 — 토스트의 '되돌리기'로 같은 자리 · 같은 타자로 되살린다
  test('✕ 로 지운 선수는 토스트의 되돌리기로 같은 자리에 돌아오고, 그 선수가 타자였으면 다시 고른다', async function () {
    var keep = { home: AS.home_lineup, cur: AS.curTeam, b: AS.batter };
    try {
      AS.curTeam = 'home';
      AS.home_lineup = [{ id: 'u1', name: '김일번', num: '1', pos: '', bh: '' }, { id: 'u2', name: '박이번', num: '2', pos: '', bh: '' }, { id: 'u3', name: '최삼번', num: '3', pos: '', bh: '' }];
      AS.batter = AS.home_lineup[1];
      renderLP();
      delPlayer('u2', { stopPropagation: function () {} });
      ok(AS.home_lineup.map(function (p) { return p.id; }).join() === 'u1,u3', '지워져야 한다: ' + AS.home_lineup.map(function (p) { return p.id; }));
      ok($('toastTxt').textContent === '박이번 삭제됨', '토스트 문구: ' + $('toastTxt').textContent);
      ok($('toastUndo').style.display !== 'none', '되돌리기 버튼이 보여야 한다');
      $('toastUndo').click();
      ok(AS.home_lineup.map(function (p) { return p.id; }).join() === 'u1,u2,u3', '같은 자리(2번)로 돌아와야 한다: ' + AS.home_lineup.map(function (p) { return p.id; }));
      ok(AS.batter && AS.batter.id === 'u2', '지운 선수가 타자였으면 다시 골라져야 한다: ' + (AS.batter && AS.batter.id));
      ok(!$('toast').classList.contains('show'), '되돌린 뒤 토스트는 닫힌다');
    } finally {
      hideToast();
      AS.home_lineup = keep.home; AS.curTeam = keep.cur; AS.batter = keep.b;
      renderLP();
    }
  });

  test('선수 삭제 뒤 다른 토스트가 뜨면 되돌리기 버튼은 예전처럼 undoLast (선수는 그대로)', async function () {
    var keep = { home: AS.home_lineup, cur: AS.curTeam, b: AS.batter, undo: window.undoLast }, called = 0;
    try {
      AS.curTeam = 'home';
      AS.home_lineup = [{ id: 'v1', name: '김일번', num: '1', pos: '', bh: '' }, { id: 'v2', name: '박이번', num: '2', pos: '', bh: '' }];
      renderLP();
      delPlayer('v1', { stopPropagation: function () {} });
      showToast('안타 기록됨', true);   // 타석 기록 토스트처럼
      window.undoLast = function () { called++; };
      $('toastUndo').click();
      ok(called === 1, 'undoLast 가 불려야 한다: ' + called);
      ok(AS.home_lineup.map(function (p) { return p.id; }).join() === 'v2', '지운 선수는 되살아나지 않는다: ' + AS.home_lineup.map(function (p) { return p.id; }));
    } finally {
      window.undoLast = keep.undo;
      hideToast();
      AS.home_lineup = keep.home; AS.curTeam = keep.cur; AS.batter = keep.b;
      renderLP();
    }
  });
})();
