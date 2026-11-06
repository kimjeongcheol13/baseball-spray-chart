// 분석 › 팀 「주자 · 아웃별 번트 · 장타」 (team.js _bxCard) — 6-4-3 Charts 의 번트 · 장타 표
//  · 경기 운영 모드로 적은 타석(gfPre = 그 타석 직전 주자 · 아웃)만 센다 — gfPre 없는 타석은 빠진다
//  · 줄 = 주자 8가지, 열 = 무사 · 1사 · 2사, 칸 = 그 일 수 / 그 상황 타석 (타석 없는 칸은 —)
//  · 번트 = 희생번트(희타) · 장타 = 2루타 · 3루타 · 홈런 · 홈(우리) / 원정 = 그 팀 타석
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var t0 = 1790101000000;
  function ab(i, res, bases, outs, team) {
    return { id: t0 + i * 1000, bname: '타' + i, team: team || 'home', inn: '1회말', res: res, pitches: [],
      gfPre: bases ? { inning: 1, half: 'bottom', outs: outs, batterIdx: 0, bases: bases } : undefined };
  }
  function rows() {
    return [].map.call(document.querySelectorAll('.tm-bx tbody tr'), function (tr) {
      return [].map.call(tr.children, function (c) { return c.textContent.trim(); }).join(' ');
    });
  }
  var E = [false, false, false], R1 = [true, false, false], R12 = [true, true, false], R3 = [false, false, true];

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.setTeamScope && window.shellOpenAnalysis, '팀 탭 로드');
  });

  test('번트: 주자 · 아웃 칸마다 희생번트 수 / 그 상황 타석 · 합계 줄', async function () {
    window.AS.abs = [
      ab(1, '희타', R1, 0), ab(2, '안타', R1, 0), ab(3, '희타', R12, 0),
      ab(4, '2루타', E, 0), ab(5, '홈런', E, 2), ab(6, '3루타', R3, 1),
      ab(7, '희타', null),                       // 경기 운영 모드가 아닌 타석 — 빠진다
      ab(8, '희타', R1, 1, 'away'),              // 상대 타석 — 홈(우리) 표에는 없다
    ];
    window.AS.pitchers = [];
    shellOpenAnalysis('team');
    await T.sleep(50);
    setTeamScope('scope', 'game'); setTeamScope('side', 'home'); setTeamScope('bx', 'bunt');
    eq(document.querySelector('.tm-bx h3').textContent, '주자 · 아웃별 번트 · 장타', '제목');
    eq(rows(), [
      '주자 없음 0/1 — 0/1', '1루 1/2 — —', '2루 — — —', '3루 — 0/1 —',
      '1 · 2루 1/1 — —', '1 · 3루 — — —', '2 · 3루 — — —', '만루 — — —', '합계 2/4 0/1 0/1',
    ], '무사 1루 1/2 · 무사 1·2루 1/1');
    ok(/경기 운영 모드로 적은 6타석만/.test(document.querySelector('.tm-bx').textContent), '센 타석 수 안내');
    eq(document.querySelectorAll('.tm-bx td.on').length, 3, '나온 칸만 강조 (1루 · 1·2루 · 합계 무사)');
  });

  test('장타로 바꾸면 2루타 이상만', function () {
    setTeamScope('bx', 'xbh');
    eq(rows(), [
      '주자 없음 1/1 — 1/1', '1루 0/2 — —', '2루 — — —', '3루 — 1/1 —',
      '1 · 2루 0/1 — —', '1 · 3루 — — —', '2 · 3루 — — —', '만루 — — —', '합계 1/4 1/1 1/1',
    ], '2루타 · 3루타 · 홈런');
  });

  test('원정 = 상대 타석', function () {
    setTeamScope('side', 'away'); setTeamScope('bx', 'bunt');
    eq(rows()[1], '1루 — 1/1 —', '상대 1사 1루 희생번트');
    setTeamScope('side', 'home');
  });

  test('경기 운영 모드 타석이 없으면 안내 · 번트/장타 고르기 없음', function () {
    window.AS.abs = [ab(1, '희타', null)];
    setTeamScope('scope', 'game');
    ok(/경기 운영 모드로 적은 타석이 없어요/.test(document.querySelector('.tm-bx').textContent), '안내 문구');
    ok(!document.querySelector('.tm-bx table') && !document.querySelector('.tm-bx .an-seg'), '표 · 고르기 없음');
  });
})();
