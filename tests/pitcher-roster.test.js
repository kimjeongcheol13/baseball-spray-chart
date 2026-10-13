// 투수 등록 목록 검증 (core.js addPitcher · removePitcher · renderPitcherRoster, pitcher.js _autoSelect)
//  · 같은 투수(이름이 같고 번호가 같거나 한쪽이 비어 있음)를 또 등록하면 새 칸을 만들지 않고 그 투수를 고른다
//  · 투수마다 ✕(삭제) 버튼 — 투구가 있으면 confirm, 지우면 전체 투구 로그도 다시 만든다
//  · 불러온 경기처럼 currentPitcher 가 비어 있으면 투구 기록 화면을 열 때 마지막으로 공을 던진 투수를 골라 둔다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;

  function save() {
    return { p: AS.pitchers, cp: AS.currentPitcher, pl: AS.pitchLog, role: AS.pitcherRole, ap: $('app-page').style.display, saved: _gameSaved };
  }
  function restore(S) {
    AS.pitchers = S.p; AS.currentPitcher = S.cp; AS.pitchLog = S.pl; AS.pitcherRole = S.role; _gameSaved = S.saved;
    $('app-page').style.display = S.ap;
    renderPitcherRoster();
  }
  function add(name, num) { $('pitcherName').value = name; $('pitcherNum').value = num || ''; addPitcher(); }
  function names() { return AS.pitchers.map(function (p) { return (p.num ? '#' + p.num + ' ' : '') + p.name; }); }
  var pitch = function (id, result) { return { id: id, inning: '1회초', zone: null, zoneX: null, zoneY: null, pt: '직구', result: result, batter: null, ts: '' }; };

  test('투수 등록: 같은 투수를 또 등록하면 빈 칸을 만들지 않고 그 투수를 고른다', function () {
    var S = save();
    try {
      AS.pitchers = []; AS.currentPitcher = null; AS.pitchLog = [];
      add('김투수', '18');
      eq(names(), ['#18 김투수'], '첫 등록');
      eq(AS.currentPitcher && AS.currentPitcher.name, '김투수', '등록하면 바로 선택');
      AS.currentPitcher.pitches.push(pitch(1, '스트라이크'));
      add('박계투', '31');
      eq(names(), ['#18 김투수', '#31 박계투'], '다른 투수는 추가');
      eq(AS.currentPitcher.name, '박계투', '새 투수가 선택됨');
      add('김투수', '18');
      eq(names(), ['#18 김투수', '#31 박계투'], '같은 이름·번호 → 추가 안 됨');
      eq(AS.currentPitcher.name, '김투수', '있는 투수를 고른다');
      eq(AS.currentPitcher.pitches.length, 1, '투구 기록은 그대로');
      add('김투수', '');
      eq(names(), ['#18 김투수', '#31 박계투'], '번호 없이 같은 이름 → 추가 안 됨');
      add('김투수', '7');
      eq(names(), ['#18 김투수', '#31 박계투', '#7 김투수'], '같은 이름이라도 번호가 다르면 다른 투수');
      eq($('pitcherName').value, '', '입력칸 비움');
    } finally { restore(S); }
  });

  test('투수 삭제: ✕ 버튼 · 투구가 있으면 확인 · 전체 투구 로그 재구성', function () {
    var S = save(), c0 = window.confirm, asked = [];
    try {
      AS.pitchers = [
        { id: 'pr1', name: '선발', num: '1', role: 'SP', pitches: [pitch(10, '볼'), pitch(20, '스트라이크')] },
        { id: 'pr2', name: '계투', num: '2', role: null, pitches: [] },
        { id: 'pr3', name: '마무리', num: '3', role: 'CP', pitches: [pitch(30, '삼진')] }
      ];
      AS.currentPitcher = AS.pitchers[0]; AS.pitchLog = [];
      renderPitcherRoster();
      var xs = document.querySelectorAll('#pitcherRoster .pitcher-tag-x');
      eq(xs.length, 3, '투수마다 삭제 버튼');
      eq(xs[0].getAttribute('aria-label'), '#1 선발 삭제', '삭제 버튼 이름');
      eq(document.querySelectorAll('#pitcherRoster .pitcher-tag').length, 3, '선택 버튼도 그대로');

      removePitcher('pr2');
      eq(names(), ['#1 선발', '#3 마무리'], '투구 없는 투수는 바로 삭제');
      eq(AS.currentPitcher && AS.currentPitcher.id, 'pr1', '선택은 그대로');

      window.confirm = function (m) { asked.push(m); return false; };
      removePitcher('pr1');
      eq(asked.length, 1, '투구가 있으면 확인');
      ok(/2구/.test(asked[0]), '확인 문구에 투구 수 — 실제 ' + asked[0]);
      eq(names(), ['#1 선발', '#3 마무리'], '취소하면 그대로');

      window.confirm = function () { return true; };
      removePitcher('pr1');
      eq(names(), ['#3 마무리'], '확인하면 삭제');
      eq(AS.pitchLog.map(function (e) { return e.id; }), [30], '전체 투구 로그에서 그 투수의 공이 빠짐');
      ok(!AS.currentPitcher || AS.currentPitcher.id !== 'pr1', '지운 투수는 선택에서 풀림');
      eq(_gameSaved, false, '저장 안 된 변경으로 표시');
      eq(document.querySelectorAll('#pitcherRoster .pitcher-tag-x').length, 1, '목록 갱신');
    } finally { window.confirm = c0; restore(S); }
  });

  test('불러온 경기(선택 없음): 투구 기록 화면을 열면 마지막으로 던진 투수가 선택된다', function () {
    var S = save();
    try {
      AS.pitchers = [
        { id: 'pa1', name: '먼저', num: '11', role: null, pitches: [pitch(100, '볼'), pitch(300, '안타')] },
        { id: 'pa2', name: '나중', num: '22', role: null, pitches: [pitch(200, '스트라이크')] },
        { id: 'pa3', name: '대기', num: '33', role: null, pitches: [] }
      ];
      AS.currentPitcher = null; AS.pitchLog = [];
      $('app-page').style.display = 'flex';
      shellNav('analysis', 'pitcher');
      setPitcherView('mode', 'input');
      eq(AS.currentPitcher && AS.currentPitcher.id, 'pa1', '마지막 공(id 300)을 던진 투수');
      ok(/먼저/.test((document.querySelector('#pitcherView .pc-live') || {}).textContent || ''), '위 요약 카드에 그 투수');
      ok(/먼저/.test($('currentPitcherLabel').textContent), '현재 투수 표시');

      // 아무도 안 던졌으면 마지막 등록
      AS.pitchers.forEach(function (p) { p.pitches = []; });
      AS.currentPitcher = null;
      setPitcherView('mode', 'input');
      eq(AS.currentPitcher && AS.currentPitcher.id, 'pa3', '투구가 없으면 마지막 등록 투수');

      // 이미 선택돼 있으면 바꾸지 않는다
      selectPitcher('pa2');
      setPitcherView('mode', 'input');
      eq(AS.currentPitcher.id, 'pa2', '선택 유지');
    } finally { setPitcherView('mode', 'stats'); restore(S); }
  });
})();
