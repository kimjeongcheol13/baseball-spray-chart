// 같은 경기 중복 정리(로그인 때 한 번)가 서로 다른 경기를 지우지 않는지 — 실제 js/cloud.js 를 가짜 서버에 붙여 돌린다.
// 배경: 정리는 타석 id 가 겹치면 같은 경기로 묶고, 다른 사본의 부분집합(타석 id ⊆ · 타석 수 ≤ · 투구 수 ≤)이면 지운다.
//       그런데 공유 링크로 저장한 경기는 타석 id 가 0,1,2… 순번이라, 서로 다른 두 공유 경기(10타석 · 8타석)에서
//       8타석 쪽이 "부분집합"이 되어 목록 · 이 기기 · 서버에서 지워졌다.
// 파일 이름순으로 맨 뒤에 돈다 (앞선 테스트의 로그인 상태를 먼저 비운다).
(function () {
  var T = window.__T, srv = window.__srv, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;
  function g(th, ta, abs) { return { th: th, ta: ta, hs: 1, as: 0, d: '2026. 9. 1.', ts: '2026. 9. 1. 오후 3:00:00', abs: abs, pitchers: [], home_lineup: [], away_lineup: [] }; }
  function abs(ids, names, res) { return ids.map(function (id, i) { return { id: id, bid: null, bname: names[i % names.length], bnum: (i % 9) + 1, res: res[i % res.length], inn: '1회초', team: 'home', x: 0.4, y: 0.4 }; }); }
  function range(a, n) { var r = []; for (var i = 0; i < n; i++) r.push(a + i); return r; }
  function seed(list) {
    localStorage.clear();
    list.forEach(function (x) { localStorage.setItem(x.key, JSON.stringify(x.data)); });
    localStorage.setItem('sl_saves', JSON.stringify(list.map(function (x, i) { return { key: x.key, label: x.data.th + ' vs ' + x.data.ta, ts: i + 1 }; })));
  }
  function loginAndSettle() {
    return new Promise(function (resolve) {
      srv.signIn();
      var n = 0, last = -1, quiet = 0;
      (function poll() { var len = srv.log.length; if (len > 0 && len === last) quiet++; else { quiet = 0; last = len; } if (quiet >= 100 || ++n > 800) resolve(); else setTimeout(poll, 10); })();
    });
  }
  var booted = null;
  async function start() { if (!booted) booted = sleep(2000); await booted; srv.signOut(); await sleep(1000); srv.reset(); }
  var listKeys = function () { return JSON.parse(localStorage.getItem('sl_saves') || '[]').map(function (s) { return s.key; }).sort(); };
  var serverKeys = function () { return srv.user_games.map(function (r) { return r.game_key; }).sort(); };

  test('서로 다른 공유 링크 경기 두 개(타석 id 0..9 · 0..7)는 둘 다 남는다 — 목록 · 이 기기 · 서버', async function () {
    await start();
    seed([{ key: 'sl_shared_a', data: g('A팀', 'B팀', abs(range(0, 10), ['가', '나', '다'], ['안타', '삼진'])) },
          { key: 'sl_shared_b', data: g('C팀', 'D팀', abs(range(0, 8), ['라', '마'], ['볼넷', '땅볼 아웃'])) }]);
    await loginAndSettle();
    eq(listKeys(), ['sl_shared_a', 'sl_shared_b'], '목록'); ok(localStorage.getItem('sl_shared_b'), '이 기기의 C팀 vs D팀');
    eq(serverKeys(), ['sl_shared_a', 'sl_shared_b'], '서버');
  });
  test('실제 기록 id 가 겹쳐도 그 타석의 타자가 다르면 같은 기록으로 보지 않는다 (엑셀 가져오기가 같은 시각을 쓴 경우)', async function () {
    await start();
    var T0 = 1780700000000;
    seed([{ key: 'sl_' + (T0 + 1), data: g('홈', '원정', abs(range(T0, 6), ['가', '나'], ['안타'])) },
          { key: 'sl_' + (T0 + 2), data: g('홈', '원정', abs(range(T0, 4), ['다', '라'], ['삼진'])) }]);
    await loginAndSettle();
    eq(listKeys(), ['sl_' + (T0 + 1), 'sl_' + (T0 + 2)].sort(), '둘 다 남음');
  });
  test('진짜 사본(같은 실제 id · 같은 타자, 타석이 더 적은 쪽)은 그대로 정리된다', async function () {
    await start();
    var T0 = 1780800000000, full = abs(range(T0, 6), ['가', '나'], ['안타']);
    seed([{ key: 'sl_' + (T0 + 1), data: g('홈', '원정', full) }, { key: 'sl_auto_' + (T0 + 2), data: g('홈', '원정', full.slice(0, 4)) }]);
    await loginAndSettle();
    eq(listKeys(), ['sl_' + (T0 + 1)], '목록'); eq(localStorage.getItem('sl_auto_' + (T0 + 2)), null, '사본은 지워짐');
  });
  test('(정리) 로그아웃하고 이 파일이 만든 상태를 비운다', async function () { srv.signOut(); await sleep(1000); srv.reset(); localStorage.clear(); eq(srv.user, null, '로그아웃'); });
})();
