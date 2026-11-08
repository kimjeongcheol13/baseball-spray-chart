// 카운트별 표(팀 「카운트별 타격」 · 스카우트 「카운트별 결과」): 볼카운트를 안 적은 타석은 빼고 몇 타석 뺐는지 적는다
//  · 기록 탭은 카운트를 안 눌러도 0-0 으로 저장한다 → 0-0 이고 공 기록 · 투구 연결이 없으면 「카운트 모름」
//  · 말이 안 되는 카운트(0~1스트라이크 삼진 · 0~2볼 볼넷)도 뺀다 · 공을 적은 0-0 타석(진짜 초구)은 이븐에 남는다
// 가상 데이터만 쓴다.
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var t0 = 1790002000000;
  function ab(i, res, count, extra) { return Object.assign({ id: t0 + i * 1000, bname: '강', team: 'home', inn: '1회말', res: res, count: count, pitches: [] }, extra || {}); }
  function card(h) {
    return [].find.call(document.querySelectorAll('.an-card'), function (s) { var t = s.querySelector('h3'); return t && t.textContent === h && s.offsetParent !== null; });
  }
  var DATA = function () {
    return [
      ab(1, '안타', { b: 0, s: 0, o: 0 }),                                   // 카운트 안 적음 → 뺀다
      ab(2, '삼진', { b: 0, s: 0, o: 0 }),                                   // 0-0 삼진 → 뺀다
      ab(3, '볼넷', { b: 1, s: 1, o: 0 }),                                   // 1볼 볼넷 → 뺀다
      ab(4, '삼진', { b: 1, s: 2, o: 0 }),                                   // 투수 유리 · 2스트라이크
      ab(5, '땅볼 아웃', { b: 2, s: 1, o: 0 }),                              // 타자 유리
      ab(6, '안타', { b: 0, s: 0, o: 0 }, { pitches: [{ pt: '직구' }] }),   // 공을 적은 초구 → 이븐
    ];
  };

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.setTeamScope && window.shellOpenAnalysis && window.generateScoutReport, '팀 · 스카우트 탭 로드');
  });

  test('팀 「카운트별 타격」: 안 적은 0-0 · 말이 안 되는 카운트는 빼고, 뺀 타석 수를 적는다', async function () {
    window.AS.abs = DATA(); window.AS.pitchers = [];
    shellOpenAnalysis('team');
    await T.sleep(50);
    setTeamScope('scope', 'game'); setTeamScope('side', 'home');
    var c = card('카운트별 타격'); ok(c, '카드');
    var pa = [].map.call(c.querySelectorAll('tbody tr'), function (tr) { return tr.querySelector('td').textContent.trim(); });
    eq(pa, ['1', '1', '1', '1'], '타자 유리 · 이븐 · 투수 유리 · 2스트라이크 타석 (예전엔 이븐 4)');
    ok(/볼카운트를 안 적은 3타석은 뺐어요/.test(c.textContent), '뺀 타석 수: ' + c.textContent.replace(/\s+/g, ' ').slice(-60));
  });

  test('팀: 볼카운트를 적은 타석이 하나도 없으면 「기록된 타석이 없어요」', async function () {
    window.AS.abs = [ab(1, '안타', { b: 0, s: 0, o: 0 }), ab(2, '삼진', { b: 0, s: 0, o: 1 })];
    setTeamScope('side', 'home');
    var c = card('카운트별 타격'); ok(c, '카드');
    ok(/볼카운트가 기록된 타석이 없어요/.test(c.textContent), c.textContent.replace(/\s+/g, ' ').trim());
  });

  test('스카우트 「카운트별 결과」: 같은 규칙', async function () {
    window.AS.abs = DATA();
    shellOpenAnalysis('scout');
    await T.sleep(50);
    generateScoutReport('강');
    var c = card('카운트별 결과'); ok(c, '카드');
    var got = [].map.call(c.querySelectorAll('.sc-count'), function (el) { return el.querySelector('.sc-count-hd b').textContent + ' ' + el.querySelector('dd').textContent; });
    eq(got, ['투수 유리 1', '이븐 1', '타자 유리 1', '2스트라이크 1'], '칸별 타석');
    ok(/볼카운트를 안 적은 3타석은 뺐어요/.test(c.textContent), '뺀 타석 수');
    window.AS.abs = [];
  });
})();
