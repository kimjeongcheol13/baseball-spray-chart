// 샘플 데이터 모드(js/sample.js) 검증 — 실제 저장소(sl_ 키)를 건드리지 않는지 · 열거까지 같은 시각으로 보이는지 · 지우면 정확히 원래대로 돌아오는지.
// 리로드는 하지 않는다: 하네스 페이지 안에서 sample.js 를 새로 평가(가짜 location · confirm)해, 플래그가 켜진 상태의 "다시 열린 페이지"를 흉내 낸다.
//  · 켜진 인스턴스는 window.localStorage 를 Proxy 로 바꾸므로, 끝나면 원래 접근자를 되돌린다 (다른 테스트에 영향 없음)
//  · REAL = Proxy 가 가리기 전의 진짜 Storage — 실제 키가 어떻게 바뀌었는지는 항상 REAL 로 본다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var DESC = Object.getOwnPropertyDescriptor(window, 'localStorage');
  var REAL = DESC.get.call(window);
  var SRC = null;
  var CONFIRM_NOTE = '샘플 모드에서 직접 기록한 내용도 함께 삭제됩니다';

  async function load(noProxy) {   // sample.js 새 인스턴스. 가짜 reload · confirm 으로 호출 기록을 남긴다. noProxy = Proxy 를 못 쓰는 브라우저 흉내
    if (SRC === null) SRC = await (await fetch('/js/sample.js')).text();
    var f = { reloads: 0, confirms: [], answer: true };
    var saved = window.slSample;
    new Function('location', 'confirm', 'Proxy', SRC)({ reload: function () { f.reloads++; } }, function (m) { f.confirms.push(m); return f.answer; }, noProxy ? undefined : Proxy);
    f.api = window.slSample;
    window.slSample = saved;
    return f;
  }
  function restore() { Object.defineProperty(window, 'localStorage', DESC); }
  function snap() {   // 키 순서는 저장소가 정하므로(지웠다 다시 쓰면 바뀜) 정렬해서 비교한다
    var ks = [], o = {}, i;
    for (i = 0; i < REAL.length; i++) ks.push(REAL.key(i));
    ks.sort().forEach(function (k) { o[k] = REAL.getItem(k); });
    return o;
  }
  function slReal() {   // 실제 저장소의 sl_ 키 중 샘플 칸 · 플래그를 뺀 것
    var o = snap(), r = {};
    Object.keys(o).forEach(function (k) { if (k.indexOf('sl_') === 0 && k !== 'sl_sample_on' && k.indexOf('sl_sample__') !== 0) r[k] = o[k]; });
    return r;
  }
  function sampleKeys() { return Object.keys(snap()).filter(function (k) { return k === 'sl_sample_on' || k.indexOf('sl_sample__') === 0; }); }
  function fresh(extra) {   // 실제 저장소: 설정 키 + 비 sl_ 키만 있는 "데이터 없음" 상태
    REAL.clear();
    if (window.AS) { window.AS.abs = []; window.AS.home_lineup = []; window.AS.away_lineup = []; }
    REAL.setItem('sl_stadium', 'jamsil'); REAL.setItem('sl_ftu_done', '1'); REAL.setItem('other_lib', 'x');
    Object.keys(extra || {}).forEach(function (k) { REAL.setItem(k, extra[k]); });
  }
  async function enterAndReopen() {   // 시작 버튼 → (리로드) → 샘플 모드로 다시 열린 페이지
    var a = await load();
    ok(a.api.enter(), 'enter() 가 시작하지 않음');
    var b = await load();
    ok(b.api.isOn(), '플래그가 켜져 있는데 샘플 모드가 아님');
    return { enter: a, on: b };
  }
  function keysByLoop() { var o = []; for (var i = 0; i < localStorage.length; i++) o.push(localStorage.key(i)); return o.sort(); }
  function keysByForIn() { var o = []; for (var k in localStorage) { if (Object.prototype.hasOwnProperty.call(localStorage, k)) o.push(k); } return o.sort(); }

  test('샘플: 데이터 없음(설정 키만) → enter() 는 샘플 칸만 만들고 실제 키는 한 글자도 안 바뀐다', async function () {
    try {
      fresh(); var s0 = snap();
      var a = await load();
      ok(!a.api.isOn(), '플래그 없이 켜져 있음');
      ok(a.api.enter(), 'enter() 거절됨');
      eq(a.reloads, 1, '리로드 횟수');
      var s1 = snap();
      Object.keys(s0).forEach(function (k) { eq(s1[k], s0[k], '실제 키 변경: ' + k); });
      Object.keys(s1).forEach(function (k) { if (!(k in s0)) ok(k === 'sl_sample_on' || k.indexOf('sl_sample__') === 0, '실제 칸에 새 키: ' + k); });
      eq(s1['sl_sample_on'], '1', '플래그');
      eq(sampleKeys().length, 1 + 1 + 3, '플래그 + sl_saves + 경기 3개');
    } finally { restore(); REAL.clear(); }
  });

  test('샘플: 내 경기가 있으면(sl_saves · 자동저장 · 클라우드 세션) enter() 는 아무것도 만들지 않는다', async function () {
    try {
      var cases = [{ sl_saves: '[{"key":"sl_1779002911000","label":"a","ts":1}]' }, { sl_autosave: '{"data":{"abs":[]}}' }, { sl_cloud_session: '{"x":1}' }, { sl_1779002911000: '{"abs":[]}' }];
      for (var i = 0; i < cases.length; i++) {
        fresh(cases[i]); var s0 = snap();
        var a = await load();
        eq(a.api.enter(), false, 'enter() 가 내 데이터 위에서 시작됨: ' + Object.keys(cases[i])[0]);
        eq(a.reloads, 0, '리로드');
        eq(snap(), s0, '실제 저장소가 바뀜: ' + Object.keys(cases[i])[0]);
      }
      fresh({ sl_saves: '[]' });   // 경기를 모두 지운 뒤 남는 빈 목록은 데이터가 아니다
      var b = await load();
      ok(b.api.enter(), '빈 sl_saves 에서 시작하지 못함');
    } finally { restore(); REAL.clear(); }
  });

  test('샘플 모드: 3경기 · 타자 9명 · 실제 저장 형식(키 형식 · 필드)', async function () {
    try {
      fresh(); await enterAndReopen();
      var saves = JSON.parse(localStorage.getItem('sl_saves'));
      eq(saves.length, 3, '경기 수');
      var names = {}, total = 0;
      saves.forEach(function (s) {
        ok(window._isSaveKey(s.key), '경기 키가 앱의 키 형식이 아님: ' + s.key);
        ok(typeof s.label === 'string' && s.ts > 0, '목록 항목 필드');
        var g = JSON.parse(localStorage.getItem(s.key));
        eq(g.key, s.key, '본문 key');
        ok(g.abs.length >= 36 && g.abs.length <= 46, '경기당 타석 수: ' + g.abs.length);
        eq(g.home_lineup.length, 9, '라인업 9명');
        var ids = {}; g.abs.forEach(function (a) { ids[a.bid] = 1; names[a.bname] = 1; total++; });
        eq(Object.keys(ids).length, 9, '경기당 타자 수');
        g.abs.forEach(function (a) {
          ok(['안타', '내야안타', '2루타', '3루타', '홈런', '플라이 아웃', '땅볼 아웃', '삼진', '볼넷', '사구'].indexOf(a.res) >= 0, '알 수 없는 결과: ' + a.res);
          ok(a.team === 'home' && a.bnum && a.bats, '타석 필드');
          if (['볼넷', '사구', '삼진'].indexOf(a.res) >= 0) eq(a.deg, null, a.res + ' 에 방향이 있음');
          else { ok(a.deg >= 0 && a.deg <= 180 && a.y <= 1 && Math.hypot(a.x - .5, a.y - 1) <= .971 && a.ft > 0 && a.dir, '타구 좌표(홈 기준 반지름 .97 반원): ' + a.res + ' ' + a.x + ',' + a.y); ok(['땅볼', '라인드라이브', '플라이볼'].indexOf(a.launchType) >= 0, 'launchType'); }
        });
      });
      eq(Object.keys(names).length, 9, '전체 타자 수');
      ok(total > 100 && total < 140, '전체 타석: ' + total);
    } finally { restore(); REAL.clear(); }
  });

  test('샘플 모드: key(i) · length · for…in · Object.keys · 프로퍼티 접근이 모두 같은 키 목록을 보여준다 (접두사 · 플래그 숨김)', async function () {
    try {
      fresh(); await enterAndReopen();
      var saves = JSON.parse(localStorage.getItem('sl_saves'));
      var want = ['other_lib', 'sl_ftu_done', 'sl_saves', 'sl_stadium'].concat(saves.map(function (s) { return s.key; })).sort();
      eq(keysByLoop(), want, 'key(i) 순회');
      eq(localStorage.length, want.length, 'length');
      eq(keysByForIn(), want, 'for…in + hasOwnProperty');
      eq(Object.keys(localStorage).sort(), want, 'Object.keys');
      eq(localStorage.sl_stadium, 'jamsil', '프로퍼티 읽기');
      eq(localStorage['sl_saves'], localStorage.getItem('sl_saves'), '대괄호 읽기');
      eq(typeof localStorage.getItem, 'function', '메서드');
      eq(localStorage.key(want.length), null, '범위 밖 key()');
      ok(!('sl_sample_on' in localStorage), '플래그가 보임');
      eq(localStorage.getItem('sl_sample_on'), null, '플래그 읽힘');
    } finally { restore(); REAL.clear(); }
  });

  test('샘플 모드: 앱의 실제 순회 코드(populateCompareSelects · storageManager.getUsage)가 샘플 경기를 본다', async function () {
    try {
      fresh(); await enterAndReopen();
      populateCompareSelects();
      var opts = document.getElementById('cmpGame1').options.length;
      eq(opts, 1 + 3, '경기 비교 선택지(기본 + 3경기)');
      var u = storageManager.getUsage();
      var want = 0; keysByLoop().forEach(function (k) { want += k.length + (localStorage.getItem(k) || '').length; });
      eq(u.bytes, want * 2, 'getUsage 가 보는 크기');
    } finally { restore(); REAL.clear(); }
  });

  test('샘플 모드: 쓰기는 전부 샘플 칸으로 — 실제 sl_ 키는 한 글자도 안 바뀐다 (경기 저장 · 자동저장 · 팀 · 삭제 · clear)', async function () {
    try {
      fresh(); var s0 = slReal(); await enterAndReopen();
      var K = 'sl_샘플vs새경기_261010_abc';
      localStorage.setItem(K, '{"abs":[]}');
      localStorage.setItem('sl_saves', JSON.stringify(JSON.parse(localStorage.getItem('sl_saves')).concat([{ key: K, label: 'x', ts: 1 }])));
      localStorage.setItem('sl_autosave', '{"data":{"abs":[1]}}');
      localStorage.setItem('sl_auto_game1', '{"abs":[1]}');
      localStorage.setItem('sl_teams', '[{"id":1}]');
      eq(localStorage.getItem(K), '{"abs":[]}', '샘플 모드에서 쓴 값이 읽힘');
      localStorage.removeItem(K);
      eq(localStorage.getItem(K), null, 'removeItem');
      localStorage.sl_future_key = 'v';   // 프로퍼티 쓰기
      eq(localStorage.getItem('sl_future_key'), 'v', '프로퍼티 쓰기');
      eq(slReal(), s0, '실제 sl_ 키가 바뀜');
      localStorage.clear();
      eq(slReal(), s0, 'clear() 가 실제 sl_ 키를 건드림');
      eq(keysByLoop(), ['other_lib'], 'clear() 뒤에는 sl_ 키가 안 보이고 비 sl_ 키만 남는다');
      eq(REAL.getItem('other_lib'), 'x', '비 sl_ 키는 건드리지 않음');
    } finally { restore(); REAL.clear(); }
  });

  test('샘플 모드: 설정 키는 샘플 칸 → 실제 순으로 읽는다 (바꾼 값이 반영되고, 지우면 가려지고, 실제 값은 그대로)', async function () {
    try {
      fresh(); await enterAndReopen();
      eq(localStorage.getItem('sl_stadium'), 'jamsil', '샘플 칸에 없으면 실제 값');
      localStorage.setItem('sl_stadium', 'gochuk');
      eq(localStorage.getItem('sl_stadium'), 'gochuk', '샘플 모드에서 바꾼 설정이 반영되지 않음');
      eq(REAL.getItem('sl_stadium'), 'jamsil', '실제 설정이 바뀜');
      localStorage.removeItem('sl_stadium');
      eq(localStorage.getItem('sl_stadium'), null, '지운 설정이 실제 값으로 되돌아 보임');
      ok(keysByLoop().indexOf('sl_stadium') < 0, '지운 설정이 열거됨');
      eq(REAL.getItem('sl_stadium'), 'jamsil', '실제 설정이 지워짐');
      localStorage.setItem('sl_stadium', 'jamsil2');
      eq(localStorage.getItem('sl_stadium'), 'jamsil2', '다시 설정');
      eq(localStorage.getItem('sl_ftu_done'), '1', '다른 설정은 실제 값을 읽음');
      localStorage.setItem('sl_ftu_done', '2'); eq(REAL.getItem('sl_ftu_done'), '1', 'ftu 실제 값');
    } finally { restore(); REAL.clear(); }
  });

  test('샘플 모드: 클라우드 세션 · 팀 코드는 항상 비어 있고 쓰기는 버려진다 (샘플이 서버로 나갈 길이 없다)', async function () {
    try {
      fresh(); await enterAndReopen();
      ['sl_cloud_session', 'sl_cloud_uid', 'sl_cloud_mod', 'sl_cloud_session-code-verifier', 'sl_team_code'].forEach(function (k) {
        localStorage.setItem(k, 'zzz');
        eq(localStorage.getItem(k), null, k + ' 가 읽힘');
        eq(REAL.getItem(k), null, k + ' 가 실제 칸에 써짐');
        eq(REAL.getItem('sl_sample__' + k), null, k + ' 가 샘플 칸에 써짐');
      });
      eq(typeof window.getTeamCode === 'function' ? window.getTeamCode() : '', '', '팀 코드 읽기');
    } finally { restore(); REAL.clear(); }
  });

  test('삭제: 확인 창은 한 번 · 문구에 "직접 기록한 내용도 함께 삭제" · 취소하면 그대로 · 확인하면 샘플 칸·플래그만 지우고 실제 저장소는 시작 전과 똑같다', async function () {
    try {
      fresh(); var s0 = snap();
      var r = await enterAndReopen();
      localStorage.setItem('sl_autosave', '{"data":{"abs":[1]}}');   // 샘플 모드에서 직접 기록
      localStorage.setItem('sl_stadium', 'gochuk');
      var withSample = snap();
      var b = r.on; b.answer = false;
      eq(b.api.exit(), false, '취소했는데 진행됨');
      eq(b.confirms.length, 1, '확인 창 횟수(취소)');
      eq(b.reloads, 0, '취소 시 리로드');
      eq(snap(), withSample, '취소했는데 저장소가 바뀜');
      b.answer = true;
      eq(b.api.exit(), true, '확인했는데 진행 안 됨');
      eq(b.confirms.length, 2, '확인 창은 누를 때마다 한 번');
      ok(b.confirms[1].indexOf(CONFIRM_NOTE) >= 0, '확인 문구에 안내 없음: ' + b.confirms[1]);
      eq(b.reloads, 1, '확인 후 리로드');
      eq(sampleKeys(), [], '샘플 칸 · 플래그가 남음');
      eq(snap(), s0, '삭제 후 실제 저장소가 시작 전과 다름');
    } finally { restore(); REAL.clear(); }
  });

  test('샘플 모드가 꺼져 있으면 아무것도 가로채지 않는다 (일반 사용자 동작 불변)', async function () {
    try {
      fresh(); var before = Object.getOwnPropertyDescriptor(window, 'localStorage');
      var a = await load();
      ok(!a.api.isOn(), '켜져 있음');
      eq(Object.getOwnPropertyDescriptor(window, 'localStorage').get === before.get, true, 'localStorage 접근자가 바뀜');
      eq(window.localStorage === REAL, true, 'localStorage 가 Proxy');
    } finally { restore(); REAL.clear(); }
  });

  test('가로챌 수 없는 환경이면(Proxy 없음) 샘플 모드로 열리지 않고 샘플 칸을 지운다 · 실제 데이터는 그대로', async function () {
    try {
      fresh(); await enterAndReopen();   // 플래그 + 샘플 칸 있음
      restore();
      var s0 = slReal();
      ok(sampleKeys().length > 0, '준비');
      var c = await load(true);
      eq(c.api.isOn(), false, '못 가로채는데 샘플 모드');
      eq(sampleKeys(), [], '샘플 칸이 남음');
      eq(slReal(), s0, '실제 sl_ 키가 바뀜');
      eq(c.api.enter(), false, 'Proxy 없이 시작됨');
    } finally { restore(); REAL.clear(); }
  });

  test('기록 중(메모리에 타석 또는 이름 있는 선수)이면 enter() 는 시작하지 않는다 · 필드를 탭해 생긴 "타자 1" 자리표시자만 있으면 시작한다', async function () {
    try {
      var cases = [
        ['타석', function () { window.AS.abs = [{ id: 1, res: '안타' }]; }],
        ['이름 있는 홈 선수', function () { window.AS.home_lineup = [{ id: 1, name: '김철수', num: '7' }]; }],
        ['이름 있는 원정 선수', function () { window.AS.away_lineup = [{ id: 1, name: '박영희', num: '9' }]; }],
        ['자리표시자 + 이름 있는 선수', function () { window.AS.home_lineup = [{ id: 1, name: '타자 1' }, { id: 2, name: '김철수' }]; }]
      ];
      for (var i = 0; i < cases.length; i++) {
        fresh(); cases[i][1]();
        var a = await load();
        eq(a.api.enter(), false, '기록 중인데 시작됨: ' + cases[i][0]);
        eq(a.reloads, 0, '리로드: ' + cases[i][0]);
        eq(sampleKeys(), [], '샘플 칸 생성: ' + cases[i][0]);
      }
      fresh(); window.AS.home_lineup = [{ id: 1, name: '타자 1', num: '1', pos: '', bh: '', isStarter: true }];
      var b = await load();
      ok(b.api.enter(), '자리표시자만 있는데 거절됨');
    } finally { restore(); fresh(); REAL.clear(); }
  });
})();
