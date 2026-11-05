// 플레이 읽어 주기 (js/features/speak.js) — 타석을 기록하면 결과를 소리로
//  · 기본 꺼짐, 켜면 updateAll 뒤 '타석 하나가 방금 늘었을 때'만 읽는다 (불러오기 · 여러 개 가져오기 · 되돌리기는 읽지 않음)
//  · 경기설정 › 그 밖의 기능 › 경기에 켜기 칸 (44px)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var KEY = 'sl_speak';
  // 진짜 음성 대신 읽은 글만 모은다 (인스턴스에 덮어쓰고 끝나면 지운다)
  function spy() {
    var said = [], S = window.speechSynthesis;
    S.speak = function (u) { said.push(u.text + '|' + u.lang); };
    S.cancel = function () {};
    return { said: said, done: function () { delete S.speak; delete S.cancel; } };
  }
  var id = Date.now() - 1000;
  var ab = function (o) { return Object.assign({ id: ++id, bid: 'b1', bname: '김지훈', team: 'home', res: '2루타', rbi: 2 }, o || {}); };

  test('읽어 주기: 읽는 글 — 이름 · 결과 · 타점, 희타 · 희비는 풀어서', function () {
    var L = window.slSpeak.line;
    eq(L(ab()), '김지훈, 2루타, 2타점');
    eq(L(ab({ res: '희타', rbi: 0 })), '김지훈, 희생번트');
    eq(L(ab({ res: '희비', rbi: 1 })), '김지훈, 희생플라이, 1타점');
    eq(L(ab({ bname: '', res: '삼진', rbi: 0 })), '타자, 삼진');
  });

  test('읽어 주기: 켜져 있을 때 방금 기록한 타석 하나만 읽는다', function () {
    var keep = AS.abs, k0 = localStorage.getItem(KEY), sp = spy();
    try {
      AS.abs = keep.slice(); updateAll();
      localStorage.removeItem(KEY);
      AS.abs.push(ab()); updateAll();
      eq(sp.said.length, 0, '꺼져 있으면 읽지 않음');
      localStorage.setItem(KEY, '1');
      AS.abs.push(ab({ bname: '이도윤', res: '안타', rbi: 0 })); updateAll();
      eq(sp.said[0], '이도윤, 안타|ko-KR', '한국어로 읽음');
      updateAll();
      eq(sp.said.length, 1, '같은 타석은 다시 읽지 않음');
      AS.abs.pop(); updateAll();
      eq(sp.said.length, 1, '되돌리기(줄어듦)는 읽지 않음');
      AS.abs.push(ab({ res: '볼넷', rbi: 0 }), ab({ res: '홈런', rbi: 1 })); updateAll();
      eq(sp.said.length, 1, '한 번에 여러 개(불러오기 · 가져오기)는 읽지 않음');
      AS.abs.push(ab({ id: 1e12, res: '삼진', rbi: 0 })); updateAll();
      eq(sp.said.length, 1, '방금 만든 게 아닌 타석(옛 기록)은 읽지 않음');
      AS.abs.push(ab({ res: '홈런', rbi: 3 })); updateAll();
      eq(sp.said[1], '김지훈, 홈런, 3타점|ko-KR', '다음 기록은 다시 읽음');
    } finally {
      sp.done(); AS.abs = keep; updateAll();
      if (k0 == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, k0);
    }
  });

  test('읽어 주기: 경기설정 › 그 밖의 기능에 켜기 칸 — 켜면 저장되고 안내를 읽음', function () {
    var k0 = localStorage.getItem(KEY), sp = spy();
    try {
      window.renderSetup();
      var box = $('slSpeakOn');
      ok(box && box.closest('#stMore'), '그 밖의 기능 카드에 켜기 칸');
      eq(getComputedStyle(box.closest('label')).minHeight, '44px', '누르는 칸 44px');
      box.checked = true; box.dispatchEvent(new Event('change'));
      eq(localStorage.getItem(KEY), '1', '켜짐 저장');
      eq(sp.said[0], '기록 읽어 주기를 켰어요|ko-KR', '켤 때 한 번 읽음 (iOS 음성 풀기)');
      box.checked = false; box.dispatchEvent(new Event('change'));
      eq(localStorage.getItem(KEY), null, '끄면 지움');
    } finally {
      sp.done();
      if (k0 == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, k0);
    }
  });
})();
