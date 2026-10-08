/* SprayLab — 샘플 데이터 모드
 * 첫 진입(데이터 없음) 사용자가 "샘플 데이터로 둘러보기"를 누르면 가상 팀 1개 · 타자 9명 · 3경기를 샘플 칸에 저장하고 앱을 다시 연다.
 * 기존 코드는 고치지 않는다: 샘플 모드가 켜져 있을 때만 window.localStorage 를 Proxy 로 바꿔 sl_ 키를 샘플 칸(sl_sample__ 접두사)으로 보낸다.
 *   · 쓰기: sl_ 키는 항상 샘플 칸으로. 샘플 모드 중 실제 sl_ 키에는 쓰기 0건 (sl_ 가 아닌 키는 그대로 통과)
 *   · 읽기: 설정 키 = 샘플 칸에 값 있으면 샘플, 없으면 실제 / 경기 데이터 키 = 샘플 칸만 / 클라우드 인증 키 = 항상 비어 있음
 *   · key(i) · length · for…in · 프로퍼티 접근도 같은 시각(샘플 칸 기준)으로 보인다
 *   · 클라우드: 세션 · 팀 코드가 항상 비어 있어 로그인 전과 같고, 로그인 · 공유 링크 업로드는 막는다
 * 켜기/끄기는 플래그(sl_sample_on)를 바꾸고 새로고침한다. 꺼져 있으면 아무것도 설치하지 않는다.
 * 새 키: sl_sample_on, sl_sample__* (모두 이 파일에서만 만든다)
 */
(function () {
  'use strict';

  var FLAG = 'sl_sample_on', PFX = 'sl_sample__', TOMB = '\u0000sample-deleted';
  var REAL;
  try { REAL = window.localStorage; REAL.getItem(FLAG); } catch (e) { return; }   // 저장소를 못 쓰는 브라우저: 기능 없음

  // 설정 키(core.js _SETTINGS_KEYS 중 경기·클라우드 키 제외): 샘플 칸 → 실제 순으로 읽는다
  var THROUGH = {};
  ['sl_uid', 'sl_visited', 'sl_ga_first_record', 'sl_ftu_done', 'sl_menu_moved_seen', 'sl_scout_intro_seen', 'sl_scout_info_closed',
    'sl_lp_w', 'sl_lp_w_mob', 'sl_rp_w', 'sl_ev_unit', 'sl_stadium', 'sl_stadium_custom', 'sl_field_overlays', 'sl_hc', 'sl_feedback', 'sl_report_cmt']
    .forEach(function (k) { THROUGH[k] = 1; });
  var BLOCK_RE = /^sl_cloud_|^sl_team_code$/;   // 클라우드 세션 · 팀 코드: 읽으면 항상 null, 쓰기는 버린다

  // 0 = 그대로 통과(sl_ 아님) / 1 = 차단 / 2 = 설정(샘플→실제) / 3 = 경기 데이터(샘플만)
  function cls(k) {
    if (k.slice(0, 3) !== 'sl_') return 0;
    if (BLOCK_RE.test(k)) return 1;
    return THROUGH[k] ? 2 : 3;
  }

  function isOn() { try { return REAL.getItem(FLAG) === '1'; } catch (e) { return false; } }

  // 실제 저장소에서 "내 데이터"가 있는지: 설정 키를 뺀 sl_ 키 중 내용이 있는 것이 하나라도 있으면 있는 것 (샘플 칸 · 플래그는 제외)
  // 경기를 모두 지우면 sl_saves 가 "[]" 로 남는다 — 그런 빈 값은 데이터가 아니다
  function hasRealData() {
    try {
      for (var i = 0; i < REAL.length; i++) {
        var k = REAL.key(i);
        if (k && k.slice(0, 3) === 'sl_' && k !== FLAG && k.indexOf(PFX) !== 0 && cls(k) !== 2) {
          var v = REAL.getItem(k);
          if (v !== null && v !== '' && v !== '[]' && v !== '{}' && v !== 'null') return true;
        }
      }
    } catch (e) { return true; }   // 읽을 수 없으면 있는 것으로 본다
    return false;
  }

  function canIntercept() {
    try {
      var d = Object.getOwnPropertyDescriptor(window, 'localStorage');
      return typeof Proxy === 'function' && !!d && d.configurable === true;
    } catch (e) { return false; }
  }

  /* ── 저장소 리다이렉트 (샘플 모드일 때만) ──────────────── */
  function logicalKeys() {
    var raw = [], out = [], seen = {}, i, r, lk;
    for (i = 0; i < REAL.length; i++) raw.push(REAL.key(i));
    raw.forEach(function (k) {
      if (k.indexOf(PFX) !== 0) return;
      lk = k.slice(PFX.length);
      if (REAL.getItem(k) !== TOMB && !seen[lk]) { seen[lk] = 1; out.push(lk); }
    });
    raw.forEach(function (k) {
      if (k.indexOf(PFX) === 0 || k === FLAG || seen[k]) return;
      r = cls(k);
      if (r === 0 || (r === 2 && REAL.getItem(PFX + k) === null)) { seen[k] = 1; out.push(k); }
    });
    return out;
  }
  var api = {
    getItem: function (k) {
      k = String(k);
      var c = cls(k);
      if (c === 0) return REAL.getItem(k);
      if (c === 1) return null;
      var v = REAL.getItem(PFX + k);
      if (v !== null) return v === TOMB ? null : v;
      return c === 2 ? REAL.getItem(k) : null;
    },
    setItem: function (k, v) {
      k = String(k);
      var c = cls(k);
      if (c === 0) REAL.setItem(k, v);
      else if (c !== 1) REAL.setItem(PFX + k, String(v));
    },
    removeItem: function (k) {
      k = String(k);
      var c = cls(k);
      if (c === 0) REAL.removeItem(k);
      else if (c === 2 && REAL.getItem(k) !== null) REAL.setItem(PFX + k, TOMB);   // 실제 값을 가리는 표시 (실제 값은 건드리지 않는다)
      else if (c !== 1) REAL.removeItem(PFX + k);
    },
    key: function (i) { var v = logicalKeys()[Number(i)]; return v === undefined ? null : v; },
    clear: function () {   // 샘플 칸만 비운다
      logicalKeys().forEach(function (k) { if (cls(k) !== 0) api.removeItem(k); });
    }
  };
  function special(p) { return typeof p === 'symbol' || p in Storage.prototype || p in Object.prototype; }

  function install() {
    var proxy = new Proxy(REAL, {
      get: function (t, p) {
        if (p === 'length') return logicalKeys().length;
        if (typeof p === 'string' && Object.prototype.hasOwnProperty.call(api, p)) return api[p];
        return special(p) ? Reflect.get(t, p, t) : api.getItem(p);
      },
      set: function (t, p, v) { if (special(p)) return false; api.setItem(p, v); return true; },
      deleteProperty: function (t, p) { if (!special(p)) api.removeItem(p); return true; },
      has: function (t, p) { return special(p) ? p in t : logicalKeys().indexOf(p) >= 0; },
      ownKeys: function () { return logicalKeys(); },
      getOwnPropertyDescriptor: function (t, p) {
        if (special(p) || logicalKeys().indexOf(p) < 0) return undefined;
        return { value: api.getItem(p), writable: true, enumerable: true, configurable: true };
      }
    });
    Object.defineProperty(window, 'localStorage', { configurable: true, enumerable: true, get: function () { return proxy; } });
  }

  function wipe() {   // 샘플 칸 + 플래그만 지운다
    var ks = [], i;
    for (i = 0; i < REAL.length; i++) { var k = REAL.key(i); if (k === FLAG || k.indexOf(PFX) === 0) ks.push(k); }
    ks.forEach(function (k) { REAL.removeItem(k); });
  }

  var ON = isOn();
  if (ON) {
    if (canIntercept()) { try { install(); } catch (e) { ON = false; wipe(); } }
    else { ON = false; wipe(); }   // 가로챌 수 없으면 샘플 모드를 끄고 일반 동작으로 (실제 데이터는 건드리지 않는다)
  }

  /* ── 샘플 데이터 (고정 시드 · 실제 저장 형식 그대로) ───── */
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var TEAM = '샘플팀';   // 팀명 칸이 좁아(기본 '원정팀' 3글자) 길면 스코어보드 R 열이 밀린다
  // [이름, 등번호, 타석, K%, BB%, 장타력, 당겨치기 성향(1=강한 당김 -1=밀어치기), 땅볼%, 라인드라이브%]
  var BAT = [
    ['김민준', '8', 'L', .10, .10, .20, -.1, .50, .27], ['이도현', '3', 'R', .12, .09, .22, .1, .42, .30],
    ['박서준', '24', 'R', .16, .08, .45, .6, .36, .24], ['최지훈', '10', 'R', .22, .12, .75, .8, .30, .20],
    ['정우진', '17', 'L', .15, .07, .40, .2, .40, .27], ['강태양', '5', 'R', .14, .06, .18, .4, .56, .22],
    ['조현우', '33', 'R', .17, .08, .28, -.4, .44, .26], ['윤성민', '21', 'L', .18, .10, .25, .1, .48, .24],
    ['한지호', '99', 'R', .26, .05, .15, .3, .52, .20]
  ];
  var SEED = 20268256;   // 고정 시드: 매번 같은 샘플 (성적 분포가 그럴듯한 값으로 골랐다)
  var OPP = [['한빛팀', 4], ['동산팀', 7], ['미래팀', 2]];   // [상대, 상대 득점]
  var ZONES = ['내각 높음', '중앙 높음', '외각 높음', '내각 중간', '중앙 중간', '외각 중간', '내각 낮음', '중앙 낮음', '외각 낮음'];
  var PITCH = ['직구', '직구', '직구', '슬라이더', '커브', '체인지업', '포크볼', '커터'];
  var FT = { LF: 295, LC: 357, CF: 394, RC: 357, RF: 295 };   // 표준 구장(90·120·90m) 펜스 거리(ft) — core.js onFClick 과 같은 계산

  function pos(deg, dist) {   // 저장 좌표: 홈 = (0.5, 1), deg 0 = 3루 파울라인
    var ang = deg * Math.PI / 180 - Math.PI;
    var dir = deg < 54 ? 'LF' : deg < 78 ? 'LC' : deg < 102 ? 'CF' : deg < 126 ? 'RC' : 'RF';
    return { x: +(0.5 + Math.cos(ang) * dist).toFixed(4), y: +(1 + Math.sin(ang) * dist).toFixed(4), deg: Math.round(deg), dir: dir, ft: Math.round(dist * FT[dir]) };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function buildAtBat(R, b, bid, base, n, inn) {
    var o = { id: base + n, bid: bid, bname: b[0], bnum: b[1], bats: b[2], team: 'home', res: '', pt: null, zone: null, rbi: 0,
      x: null, y: null, deg: null, dir: null, ft: null, inn: inn, ts: '', count: null, pitches: [], ev: null, launchAngle: null, launchType: null };
    var kP = b[3], bbP = b[4], r = R();
    o.pt = PITCH[Math.floor(R() * PITCH.length)];
    o.zone = ZONES[Math.floor(R() * 9)];
    if (r < kP) { o.res = '삼진'; o.count = { b: Math.floor(R() * 3), s: 2, o: 0 }; return o; }
    if (r < kP + bbP) { o.res = '볼넷'; o.count = { b: 3, s: Math.floor(R() * 3), o: 0 }; return o; }
    if (r < kP + bbP + .02) { o.res = '사구'; o.count = { b: Math.floor(R() * 3), s: Math.floor(R() * 2), o: 0 }; return o; }
    // 인플레이 타구: 유형 → 방향 → 거리 → 결과
    var t = R(), type = t < b[7] ? '땅볼' : t < b[7] + b[8] ? '라인드라이브' : '플라이볼';
    var tend = b[6] + (R() - .5) * .5;   // 이번 타구의 당김(+)/밀어(−) 정도
    var pullSide = b[2] === 'L' ? 1 : -1;   // 우타 당김 = 3루쪽(deg 작음), 좌타 = 1루쪽(deg 큼)
    var deg = clamp(90 + pullSide * tend * 42 + (R() - .5) * 100, 10, 170);
    var dist = type === '땅볼' ? .16 + R() * .26 : type === '라인드라이브' ? .42 + R() * .30 : .52 + R() * .42;
    var hitP = type === '땅볼' ? .21 : type === '라인드라이브' ? .62 : .14;
    o.launchType = type;
    o.launchAngle = type === '땅볼' ? Math.round(-8 + R() * 17) : type === '라인드라이브' ? Math.round(11 + R() * 13) : Math.round(26 + R() * 24);
    o.ev = Math.round((type === '땅볼' ? 62 : type === '라인드라이브' ? 84 : 76) + (R() - .5) * 26 + b[5] * 14);
    o.count = { b: Math.floor(R() * 3), s: Math.floor(R() * 3), o: 0 };
    var xr = R();   // 안타 안에서의 종류
    if (type === '플라이볼' && R() < .03 + b[5] * .34) {   // 펜스를 넘긴 타구
      o.res = '홈런'; dist = .86 + R() * .1;
    } else if (R() < hitP + (b[5] - .25) * .12) {
      if (type === '땅볼') o.res = dist < .24 && R() < .35 ? '내야안타' : '안타';
      else if (type === '라인드라이브') o.res = xr < .18 + b[5] * .35 ? '2루타' : xr < .21 + b[5] * .35 ? '3루타' : '안타';
      else o.res = xr < .66 ? '2루타' : xr < .74 ? '3루타' : '안타';
      if (o.res === '2루타' || o.res === '3루타') dist = Math.max(dist, .62 + R() * .2);
      if (o.res === '내야안타') { dist = .2 + R() * .1; deg = 90 + (R() - .5) * 90; }
    } else {
      o.res = type === '땅볼' ? '땅볼 아웃' : '플라이 아웃';
    }
    Object.assign(o, pos(deg, dist));
    return o;
  }

  function buildGames() {
    var games = [], now = Date.now(), day = 864e5;
    OPP.forEach(function (op, gi) {
      var R = rng(SEED + gi * 977);
      var ts = now - [15, 8, 2][gi] * day;
      var dt = new Date(ts), p2 = function (v) { return ('0' + v).slice(-2); };
      var ds = p2(dt.getFullYear() % 100) + p2(dt.getMonth() + 1) + p2(dt.getDate());
      var key = 'sl_' + TEAM + 'vs' + op[0] + '_' + ds + '_sa' + (gi + 1);
      var lineup = BAT.map(function (b, i) { return { id: (gi + 1) * 100 + i + 1, name: b[0], num: b[1], pos: '', bh: b[2], isStarter: true }; });
      var total = [41, 38, 44][gi], abs = [], rbi = 0;
      for (var n = 0; n < total; n++) {
        var bi = n % 9, inn = Math.min(7, 1 + Math.floor(n * 7 / total)) + '회말';
        var a = buildAtBat(R, BAT[bi], lineup[bi].id, ts, n, inn);
        a.ts = ('0' + (13 + Math.floor(n / 14))).slice(-2) + ':' + ('0' + ((n * 4) % 60)).slice(-2);
        if (a.res === '홈런') a.rbi = 1 + (R() < .4 ? 1 : 0);
        else if (a.res === '2루타' || a.res === '3루타') a.rbi = R() < .5 ? 1 : 0;
        else if (a.res === '안타') a.rbi = R() < .3 ? 1 : 0;
        rbi += a.rbi;
        abs.push(a);
      }
      var data = {
        key: key, hs: rbi + 1, as: op[1], th: TEAM, ta: op[0], home_lineup: lineup, away_lineup: [], abs: abs, zoneHistory: {},
        d: dt.toLocaleDateString('ko-KR'), ts: ts, cond: {}, pitchers: [],
        info: { date: dt.getFullYear() + '-' + p2(dt.getMonth() + 1) + '-' + p2(dt.getDate()), venue: '샘플 구장', side: 'home', innings: 7 }
      };
      games.push(data);
    });
    return games;
  }

  // 지금 화면(메모리)에 기록이 없는가: 타석이 없고, 라인업은 비었거나 필드를 탭하면 앱이 만드는 "타자 N" 자리표시자뿐이다
  function memEmpty() {
    var S = window.AS;
    if (!S) return true;
    if (S.abs && S.abs.length) return false;
    return [].concat(S.home_lineup || [], S.away_lineup || []).every(function (p) { return /^타자 ?\d*$/.test((p && p.name) || ''); });
  }
  function offerable() { return !ON && canIntercept() && !hasRealData() && memEmpty(); }

  function enter() {
    if (!offerable()) return false;   // 내 데이터가 있거나 기록 중이면 시작하지 않는다 (호출한 쪽이 이유를 알린다)
    try {
      var saves = [];
      buildGames().forEach(function (g) {
        REAL.setItem(PFX + g.key, JSON.stringify(g));
        saves.push({ key: g.key, label: g.th + ' vs ' + g.ta + ' ' + g.hs + ':' + g.as, ts: g.ts });
      });
      REAL.setItem(PFX + 'sl_saves', JSON.stringify(saves));
      REAL.setItem(FLAG, '1');
    } catch (e) { wipe(); return false; }   // 저장 공간 부족 등: 만든 것만 되돌린다
    location.reload();
    return true;
  }

  var CONFIRM = '샘플 데이터를 지우고 내 데이터로 시작할까요?\n\n샘플 모드에서 직접 기록한 내용도 함께 삭제됩니다.\n내 기록에는 영향이 없습니다.';
  function exit() {
    if (!confirm(CONFIRM)) return false;
    wipe();
    location.reload();
    return true;
  }

  /* ── 화면: 상단 배지 · 시작 버튼 ──────────────────────── */
  function toast(msg) { if (typeof window.showToast === 'function') window.showToast(msg, false); }
  function syncButtons() {
    var show = offerable();
    Array.prototype.forEach.call(document.querySelectorAll('[data-sl-sample-start]'), function (b) { b.hidden = !show; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-sl-sample-start]'), function (b) {
      b.addEventListener('click', function () {
        if (!enter()) { syncButtons(); toast('기록 중인 내용이 있어서 샘플을 열 수 없어요'); }   // 조용히 거절하지 않는다
      });
    });
    syncButtons();
    // 첫 사용 말풍선이 갱신될 때(기록 · 불러오기 · 초기화) 버튼도 같은 시점에 다시 판단한다 (core.js 수정 없음)
    var orig = window.updateFieldTapHint;
    if (typeof orig === 'function') {
      window.updateFieldTapHint = function () { var r = orig.apply(this, arguments); try { syncButtons(); } catch (e) {} return r; };
    }
    if (!ON) return;

    document.body.classList.add('sl-sample-on');
    var bar = document.createElement('div');
    bar.id = 'slSampleBar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span class="sl-sample-badge">샘플 데이터</span><span class="sl-sample-msg">내 기록이 아니에요</span>'
      + '<button type="button" class="sl-sample-exit">샘플 지우고 내 데이터 시작</button>';
    bar.querySelector('.sl-sample-exit').addEventListener('click', exit);
    document.body.insertBefore(bar, document.body.firstChild);

    // 샘플 모드에서는 로그인 · 클라우드 설정 · 링크 공유 업로드를 막는다 (샘플이 서버로 나가거나 내 계정과 섞이지 않게)
    var MSG = '샘플 모드에서는 쓸 수 없어요. 먼저 "샘플 지우고 내 데이터 시작"을 눌러 주세요';
    ['openLoginModal', 'openCloudOverlay'].forEach(function (n) {
      if (typeof window[n] === 'function') window[n] = function () { toast(MSG); };
    });
    if (typeof window.pushSharedLink === 'function') window.pushSharedLink = function (payload, onOk, onFail) { if (onFail) onFail('sample'); };

    // 데스크톱: 랜딩이 떠 있으면 바로 앱으로 (모바일은 core.js 가 이미 건너뜀)
    var lp = document.getElementById('landing-page');
    if (lp && lp.offsetParent !== null && typeof window.showApp === 'function') window.showApp();
  });

  window.slSample = { isOn: function () { return ON; }, enter: enter, exit: exit, hasRealData: hasRealData, canIntercept: canIntercept };
})();
