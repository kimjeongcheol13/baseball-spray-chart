// 분석 › 스카우트 「상대 팀 전체」 = 포켓 카드 (scouting.js _pocketHtml) — 6-4-3 Charts pocket card
//  · 팀 = 경기마다 홈 타석은 th, 원정 타석은 ta 이름으로 묶음 · 처음엔 가장 최근 경기의 원정 팀
//  · 순서 = 그 팀의 가장 최근 경기에서 처음 타석에 선 순서, 그 경기에 없던 타자는 뒤에
//  · 숫자는 그 팀 타석만 (다른 팀의 같은 이름 타자는 섞지 않는다) · 공략 한 줄 = 공략 포인트 중 근거가 가장 큰 것
//  · 이미지 만들기 → 미리보기 + 저장 · 공유
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var t0 = 1790101000000, n = 0;
  function ab(name, res, team) { return { id: t0 + (++n) * 1000, bname: name, team: team || 'away', inn: '1회초', res: res, pitches: [] }; }
  function rows() {
    return [].map.call(document.querySelectorAll('.sc-pk tbody'), function (tb) {
      return [].map.call(tb.querySelector('tr').children, function (c) { return c.textContent.trim(); }).join(' ');
    });
  }
  function plans() { return [].map.call(document.querySelectorAll('.sc-pk .sc-pk-plan'), function (tr) { return tr.textContent.trim(); }); }
  function chips() { return [].map.call(document.querySelectorAll('#scoutPlayerList .an-chip'), function (b) { return b.dataset.name + (b.classList.contains('on') ? '*' : ''); }); }
  var G = [
    { key: 'sl_pk_t1', ta: '청솔', day: 1, abs: [ab('강', '안타'), ab('중', '삼진'), ab('약', '볼넷'), ab('강', '삼진'), ab('강', '땅볼 아웃'), ab('강', '삼진'), ab('강', '안타'), ab('우리', '안타', 'home')] },
    { key: 'sl_pk_t2', ta: '청솔', day: 2, abs: [ab('중', '2루타'), ab('강', '삼진'), ab('신', '땅볼 아웃'), ab('강', '안타'), ab('강', '삼진'), ab('강', '땅볼 아웃'), ab('강', '삼진')] },
    { key: 'sl_pk_t3', ta: '솔빛', day: 3, abs: [ab('강', '홈런')] },
  ];

  test('(준비) 앱 시작 처리가 끝날 때까지 기다리고, 저장 경기 3개를 넣는다', async function () {
    await T.sleep(2500);
    ok(window.shellOpenAnalysis && window.setScoutMode, '스카우트 로드');
    var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
    G.forEach(function (g) {
      var d = { th: '한빛', ta: g.ta, hs: 0, as: 0, ts: t0 + g.day * 86400000, d: '2026. 11. ' + g.day + '.', abs: g.abs, pitchers: [], home_lineup: [], away_lineup: [] };
      localStorage.setItem(g.key, JSON.stringify(d));
      saves.push({ key: g.key, label: g.ta + ' vs 한빛', ts: d.ts });
    });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
    window.AS.abs = [];
    document.getElementById('tHome').value = '한빛'; document.getElementById('tAway').value = '청솔';   // 현재 경기(가장 최근) = 청솔 원정
  });

  test('「상대 팀 전체」: 팀 칩 · 처음엔 최근 경기의 원정 팀 · 최근 경기 타석 순 · 그 팀 타석만으로 숫자', async function () {
    shellOpenAnalysis('scout');
    await T.sleep(50);
    setScoutMode('team');
    var c = chips().filter(function (x) { return /^(청솔|솔빛|한빛)\*?$/.test(x); });
    ok(c.indexOf('청솔*') >= 0 && c.indexOf('솔빛') >= 0 && c.indexOf('한빛') >= 0, '팀 칩 (청솔 선택): ' + c.join(','));
    eq(document.getElementById('scoutPlayerList').getAttribute('aria-label'), '팀 선택', '칩 묶음 이름');
    eq(document.querySelector('.sc-pk h3').textContent, '청솔 포켓 카드', '제목');
    ok(/2경기 · 14타석/.test(document.querySelector('.sc-pk .an-hd-note').textContent), '경기 · 타석 수');
    eq(rows(), ['1 중 2 .500 .500 —', '2 강 10 .300 .300 —', '3 신 1 .000 .000 —', '4 약 1 — 1.000 —'],
      '순서 = 최근 경기(2일) 처음 타석 순 → 그 경기에 없던 약은 뒤 · 타석 · 타율 · 출루율 · 당김(타구 방향 없음 = —)');
    eq(plans(), ['아직 뚜렷한 포인트 없음', '공략삼진을 노릴 만한 타자', '아직 뚜렷한 포인트 없음', '아직 뚜렷한 포인트 없음'],
      '강(10타석 · 삼진 5) = 근거가 가장 큰 공략 한 줄');
  });

  test('다른 팀을 고르면 그 팀 타석만 — 이름이 같은 「강」도 섞지 않는다', function () {
    setScoutTeam('솔빛');
    eq(document.querySelector('.sc-pk h3').textContent, '솔빛 포켓 카드', '제목');
    eq(rows(), ['1 강 1 1.000 1.000 —'], '솔빛 강 = 홈런 하나');
  });

  test('이미지 만들기 → 미리보기 + 저장 · 공유', async function () {
    ok(document.getElementById('scPkFig').hidden, '처음엔 미리보기 없음');
    await exportScoutPocket();
    var img = document.getElementById('scPkImg');
    ok(!document.getElementById('scPkFig').hidden, '미리보기 보임');
    ok(/^data:image\/png/.test(img.src), 'PNG 이미지');
    await new Promise(function (r) { if (img.complete) r(); else img.onload = r; });
    eq([img.naturalWidth, img.naturalHeight], [1080, 300 + 112 + 140], '폭 1080 · 타자 1명 높이');
    var keep = window._downloadCanvas, got = null;
    window._downloadCanvas = function (cv, name) { got = { w: cv.width, name: name }; };
    try { saveScoutPocket(); } finally { window._downloadCanvas = keep; }
    ok(got && got.w === 1080 && /^spraylab_pocket_\d+\.png$/.test(got.name), '저장 = 만든 이미지: ' + JSON.stringify(got));
  });

  test('「선수 한 명」으로 돌아가면 원래 리포트 · 정리', function () {
    try {
      setScoutMode('one');
      eq(document.getElementById('scoutPlayerList').getAttribute('aria-label'), '타자 선택', '칩 묶음 이름');
      ok(!document.querySelector('.sc-pk'), '포켓 카드 없음');
      ok(document.querySelector('#scoutContent .sc-hero'), '선수 리포트');
    } finally {
      G.forEach(function (g) { localStorage.removeItem(g.key); });
      localStorage.setItem('sl_saves', JSON.stringify(JSON.parse(localStorage.getItem('sl_saves') || '[]').filter(function (s) { return !/^sl_pk_t/.test(s.key); })));
    }
  });
})();
