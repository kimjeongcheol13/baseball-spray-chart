// 타석 영상 링크 — 경기설정 「경기 영상」(AS.info.video) + 타석 수정 창 「영상 시간」(ab.vt) → 최근 기록 ▶ 1:23 (core.js · features/setup.js)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  function ab(id, vt) { var a = { id: id, bid: 'v' + id, bname: '영상타자', bnum: 9, team: 'home', res: '안타', inn: '1회초', rbi: 0, x: 0.5, y: 0.4, deg: 90 }; if (vt != null) a.vt = vt; return a; }
  function keep() {
    var s = { abs: AS.abs, info: AS.info, sg: window.saveGame, rf: AS.recFilterBid };
    window.saveGame = function () {};   // 수정 저장(_saveEditImmediate)이 저장 목록을 만들지 않게
    AS.recFilterBid = null;
    return function () {
      AS.abs = s.abs; AS.info = s.info; window.saveGame = s.sg; AS.recFilterBid = s.rf;
      try { closeOverlay('editRecOverlay'); } catch (e) {}
      renderRecs();
    };
  }
  function vidLinks() { return [].map.call(document.querySelectorAll('#recList .rec-vid'), function (a) { return [a.textContent, a.getAttribute('href'), a.target]; }); }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window._vtParse && window._vtFmt && window._vidUrl && window.stSetInfo, '영상 함수 로드');
  });

  test('영상 시간 읽기 · 쓰기', function () {
    eq(['1:23', '83', '1:02:03', '1.23', ' 0:05 ', ''].map(_vtParse), [83, 83, 3723, 83, 5, null], '읽기');
    ok(['1:75', 'abc', '1:2:3:4', '-5'].every(function (s) { return Number.isNaN(_vtParse(s)); }), '틀린 형식은 NaN');
    eq([0, 83, 600, 3723].map(_vtFmt), ['0:00', '1:23', '10:00', '1:02:03'], '쓰기');
  });

  test('영상 주소: 유튜브는 그 시간(t=초)부터, http(s) 가 아니면 링크 없음', function () {
    eq(['https://youtu.be/dQw4w9WgXcQ?si=x', 'https://m.youtube.com/live/dQw4w9WgXcQ', YT + '&list=PL1'].map(function (u) { return _vidUrl(u, 83); }),
      [YT + '&t=83s', YT + '&t=83s', YT + '&t=83s'], '유튜브');
    eq(_vidUrl('https://example.com/g.mp4#a', 7), 'https://example.com/g.mp4#t=7', '영상 파일');
    eq(_vidUrl('javascript:alert(1)', 7), '', 'javascript: 주소');
  });

  test('최근 기록: 경기 영상 + 영상 시간이 있는 타석에만 ▶ 버튼', function () {
    var back = keep();
    try {
      AS.abs = [ab(1782000000001, 83), ab(1782000000002)];
      AS.info = { video: YT };
      renderRecs();
      eq(vidLinks(), [['▶ 1:23', YT + '&t=83s', '_blank']], '▶ 버튼');
      AS.info = {};
      renderRecs();
      eq(vidLinks(), [], '경기 영상이 없으면 버튼 없음');
    } finally { back(); }
  });

  test('수정 창: 영상 시간을 채우고 저장 · 틀리면 창을 닫지 않음 · 지우면 빠짐', function () {
    var back = keep();
    try {
      var id = 1782000000003;
      AS.abs = [ab(id, 83)];
      AS.info = { video: YT };
      openEditRec(id);
      eq($('editVt').value, '1:23', '열 때 채움');
      eq($('editVtHint').style.display, 'none', '경기 영상이 있으면 안내 숨김');
      $('editVt').value = '2:05'; saveEditRec();
      eq(AS.abs[0].vt, 125, '저장');
      openEditRec(id); $('editVt').value = '2:99'; saveEditRec();
      eq(AS.abs[0].vt, 125, '틀린 형식은 저장 안 함');
      ok($('editRecOverlay').classList.contains('show'), '틀린 형식인데 창이 닫힘');
      $('editVt').value = ''; saveEditRec();
      ok(!('vt' in AS.abs[0]), '빈칸이면 vt 삭제');
      AS.info = {};
      openEditRec(id);
      ok($('editVtHint').style.display !== 'none', '경기 영상이 없으면 어디에 넣는지 안내');
    } finally { back(); }
  });

  test('경기설정: 경기 영상 주소 — 앞뒤 공백 정리 · https:// 없으면 붙임', function () {
    var back = keep();
    try {
      AS.info = {};
      stSetInfo('video', '  youtu.be/dQw4w9WgXcQ ');
      eq(AS.info.video, 'https://youtu.be/dQw4w9WgXcQ', 'https:// 붙임');
      stSetInfo('video', YT);
      eq(AS.info.video, YT, '그대로');
    } finally { back(); }
  });
})();
