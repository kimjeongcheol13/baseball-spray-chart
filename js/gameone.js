/**
 * 게임원(gameone.kr) 박스스코어 → 타석 · 타구 위치 파서 (UI 미연결 · 순수 함수)
 *
 * 입력: 게임원 박스스코어 타자 테이블을 드래그 복사해 붙여넣은 평문.
 *       행 = 타순 · 수비위치 · 선수명(등번호) · 1~N회 셀 · 타수 · 안타 · 타점 · 득점 · 도루 · 타율 · 시즌타율
 *       실제 PC 웹 복사(2026-10-19, 게임원 박스스코어 30경기를 Chromium 으로 그려 표를 선택한 텍스트로 확인):
 *         첫 칸이 '1지홍길동(5)' 처럼 타순 · 수비위치 · 이름이 붙어 온다(한 칸 안의 span 3개). 처음 받은 예시처럼 탭 3칸으로 와도 읽는다
 *         교체 선수는 같은 타순 번호로 선발 바로 아래 줄 · 머리글 '선수 1 2 … 타수 …' · 합계 '합 계 …' · 10회 이상 칸은 숨김이라 복사되지 않는다
 *       탭 구분이면 빈 이닝 칸이 살아 있어 이닝을 정확히 안다. 공백 구분이면 빈 칸이 사라지므로 inning = null (warnings 에 남김)
 * 셀 문법: '/' = 같은 이닝의 타석 2개(순서대로) · ',' = 한 타석 안의 사건 묶음(타구 토큰은 보통 마지막)
 *          타구 토큰 = 방향 접두어 + 결과 접미어. 둘 중 하나라도 모르면 'unknown' 으로 남긴다(버리지 않는다)
 *
 * 저장 형식은 바꾸지 않는다: 매핑표 각도·깊이를 기존 저장 좌표(x, y, deg, dir — 기록 탭과 같은 식)로 바꿔 넣기만 한다(toStoredCoords).
 * 붙여넣은 텍스트만 처리(사이트 접속·크롤링 없음), 외부 라이브러리 없음.
 * 일반 <script> 로 불러 window.SLGameOne 으로 쓴다 — file:// 로 연 tests/parse-gameone.html 에서도 동작. Node 에서는 require 로도 된다.
 */
(function (root) {
  'use strict';

  // ── 방향 접두어 → 매핑표 각도 (중견 0°, 좌측 음수, 파울라인 ±45°) ──
  // pos: 실책(실) · 내야 뜬공/땅볼일 때 깊이로 쓸 야수 자리(FIELDER_DEPTH) · fence: 좌월·중월·우월 = 같은 각도, 깊이만 펜스 근처 이상(FENCE_DEPTH)
  // 2내·유내(내야안타)는 접두어 2·유 + 접미어 내안 으로 읽는다
  var PREFIX = {
    __proto__: null,
    '좌': { angle: -35, pos: 'OF' }, '좌중': { angle: -17, pos: 'OF' }, '중': { angle: 0, pos: 'OF' },
    '우중': { angle: 17, pos: 'OF' }, '우': { angle: 35, pos: 'OF' },
    '좌월': { angle: -35, pos: 'OF', fence: true }, '중월': { angle: 0, pos: 'OF', fence: true }, '우월': { angle: 35, pos: 'OF', fence: true },
    '3': { angle: -30, pos: 'CI' }, '유': { angle: -12, pos: 'MI' }, '2': { angle: 12, pos: 'MI' }, '1': { angle: 30, pos: 'CI' },
    '투': { angle: 0, pos: 'P' }, '포': { angle: 0, pos: 'C' },
    // 실제 기록에서 본 것(2026-10-19): 좌선 · 우선 = 파울라인 선상(매핑표에 없어 ±40° 근사), 좌전 · 중전 · 우전 = 좌 · 중 · 우 앞(같은 각도 — 깊이는 결과가 정한다)
    '좌선': { angle: -40, pos: 'OF' }, '우선': { angle: 40, pos: 'OF' },
    '좌전': { angle: -35, pos: 'OF' }, '중전': { angle: 0, pos: 'OF' }, '우전': { angle: 35, pos: 'OF' }
  };
  // 수비 번호(기록 [6-4-3] 의 첫 숫자) → 방향 접두어. 방향 없이 온 '병살[6-4-3]' 의 방향을 여기서 정한다
  var FIELDER_PREFIX = { __proto__: null, '1': '투', '2': '포', '3': '1', '4': '2', '5': '3', '6': '유', '7': '좌', '8': '중', '9': '우' };

  // ── 결과 접미어 → 기존 결과 코드(res) · 매핑표 깊이 (0 = 홈플레이트, 1 = 그 방향 펜스) ──
  // wide: 안·플·땅처럼 떨어진 자리 폭이 넓은 결과 → confidence 'low' · memo: 의미 미확인 표시(notes 에 그대로 보존)
  // fielded: 내야 방향(3·유·2·1·투·포)이면 깊이 = 해당 야수 위치(FIELDER_DEPTH) — 유플이 외야에, 포땅이 마운드 뒤에 찍히지 않게.
  //          외야 방향(좌·중·우 …)은 표 깊이 그대로
  // 희플 → '희비'(기존 희생플라이 코드) · 실 → depth null = 해당 야수 위치(FIELDER_DEPTH)
  var SUFFIX = {
    __proto__: null,
    '땅': { res: '땅볼 아웃', depth: 0.25, wide: true, fielded: true },
    '땅R': { res: '땅볼 아웃', depth: 0.25, wide: true, fielded: true, memo: 'R' },
    '내안': { res: '내야안타', depth: 0.30 },
    '안': { res: '안타', depth: 0.55, wide: true },
    '2': { res: '2루타', depth: 0.75 },
    '3': { res: '3루타', depth: 0.85 },
    '월2': { res: '2루타', depth: 0.92 },
    '월홈': { res: '홈런', depth: 1.05 },
    '홈': { res: '홈런', depth: 1.05 },
    '플': { res: '플라이 아웃', depth: 0.65, wide: true, fielded: true },
    '희플': { res: '희비', depth: 0.80 },
    '실': { res: '실책', depth: null },
    // 실제 기록에서 본 것(2026-10-19). 뜻은 게임원 표의 타수 · 안타 칸과 맞춰 확인(우안2 · 중안3 = 안타, 희플출 = 타수 아님 · 타점 1)
    '직': { res: '라인드라이브 아웃', depth: 0.65, wide: true, fielded: true },
    '인플': { res: '플라이 아웃', depth: 0.65, wide: true, fielded: true },           // 인필드 플라이
    '플R': { res: '플라이 아웃', depth: 0.65, wide: true, fielded: true, memo: 'R' },
    '땅실': { res: '실책', depth: 0.25, wide: true, fielded: true },                  // 땅볼 실책
    '플실': { res: '실책', depth: 0.65, wide: true, fielded: true },                  // 뜬공 실책
    '야선': { res: '야수선택', depth: null },
    '병살': { res: '병살', depth: 0.25, wide: true, fielded: true },
    '땅병살': { res: '병살', depth: 0.25, wide: true, fielded: true },
    '안2': { res: '안타', depth: 0.55, wide: true, memo: '2루까지' },                // 안타 + 송구 사이 진루
    '안3': { res: '안타', depth: 0.55, wide: true, memo: '3루까지' },
    '희플출': { res: '희비', depth: 0.80, memo: '출루' },
    '파플': { res: '플라이 아웃', foul: true }                                        // 파울 플라이 — 파울 지역이라 위치 없이 결과만
  };

  // 실책 · 내야 뜬공/땅볼 깊이 = 해당 야수의 평소 수비 위치. 매핑표에 수치가 없어 정한 근사값(표준 구장 중앙 펜스 120m 기준):
  //   포수 0.05(홈 바로 앞) · 투수 0.15(마운드 18.44m ≈ 120m × 0.15) · 1루수·3루수(CI) 0.25(= 땅 깊이)
  //   · 2루수·유격수(MI) 0.30(코너보다 깊게 선다) · 외야수 0.65(= 플 깊이)
  var FIELDER_DEPTH = { __proto__: null, C: 0.05, P: 0.15, CI: 0.25, MI: 0.30, OF: 0.65 };
  // 좌월·중월·우월 접두어의 "펜스 근처 이상" = 매핑표 월2 깊이(0.92)를 하한으로 둔다 (좌월3 처럼 표에 따로 없는 조합용.
  // 좌월홈 = 좌월+홈 = 좌+월홈, 중월2 = 중월+2 = 중+월2 — 어느 쪽으로 읽어도 같은 값)
  var FENCE_DEPTH = 0.92;

  // ── 비타구 토큰: 차트 제외, 타석 결과로만 기록 ──
  // 값이 있으면 타석 결과(기존 결과 코드), null 이면 같은 타석의 사건·교체 메모(notes)
  var NON_BATTED = {
    __proto__: null,
    '4구': '볼넷', '사구': '사구', '삼진': '삼진',
    '폭투': null, '도루': null, '주자아웃': null, '포구실책': null, '대타': null, '대수비': null, '대주자': null,
    // 실제 기록에서 본 것(2026-10-19). 낫아웃 +(출루) · -(아웃) 모두 타자는 삼진. 타격방해는 타수 · 출루율 분모에 들지 않아 결과 없이 둔다
    '낫아웃+': '삼진', '낫아웃-': '삼진', '고의4구': '볼넷',
    '포일': null, '송구실책': null, '도루자': null, '견제사': null, '런다운': null, '보크': null, '리터치': null,
    '주루방해': null, '타격방해': null, '타구맞음': null
  };

  // ── 매핑표 좌표 → 기존 저장 좌표 ──
  // 저장 좌표(core.js "필드 기하" 주석): 홈 = (0.5, 1), deg 0 = 좌측 파울라인 ~ 90 = 중견 ~ 180 = 우측 파울라인, 펜스 = 반지름 0.97.
  // 기록 탭에서 필드를 탭할 때(core.js _coneToSemi)와 같은 식:
  //   phi  = 90 + angle                     화면 부채꼴 각도 (45 = 좌측 폴, 90 = 중견, 135 = 우측 폴)
  //   deg  = phi 를 구간별 선형 변환  [45, 63, 81, 99, 117, 135] → [0, 54, 78, 102, 126, 180]   (core.js _phiToDeg)
  //   dist = depth × 0.97                   (depth 1 = 그 방향 펜스. 구장별 펜스 곡선은 그릴 때 _semiToCone 이 반영)
  //   x    = 0.5 + cos(deg·π/180 − π) × dist
  //   y    = 1   + sin(deg·π/180 − π) × dist
  //   dir  = deg < 54 LF · < 78 LC · < 102 CF · < 126 RC · 그 외 RF   (core.js onFClick 과 같은 경계)
  // 예) 좌 −35° → phi 55 → deg 30 (LF) · 중 0° → deg 90 (CF) · 우중 +17° → phi 107 → deg 112.67 (RC)
  // 펜스 밖(홈런 depth 1.05 → dist 1.0185)은 자르지 않는다 — 그리는 쪽(_semiToCone)이 펜스 1.06배까지 표시한다
  var FZ_PHI = [45, 63, 81, 99, 117, 135], FZ_DEG = [0, 54, 78, 102, 126, 180];   // core.js _FZ_PHI · _FZ_DEG 와 같은 값 (바뀌면 같이)
  var FENCE_R = 0.97;

  function dirOf(deg) {
    return deg < 54 ? 'LF' : deg < 78 ? 'LC' : deg < 102 ? 'CF' : deg < 126 ? 'RC' : 'RF';
  }

  function toStoredCoords(angle, depth) {
    var phi = Math.max(45, Math.min(135, 90 + angle)), i = 0;
    while (i < 4 && phi > FZ_PHI[i + 1]) i++;
    var deg = FZ_DEG[i] + (phi - FZ_PHI[i]) / 18 * (FZ_DEG[i + 1] - FZ_DEG[i]);
    var dist = depth * FENCE_R, ang = deg * Math.PI / 180 - Math.PI;
    return { deg: deg, dist: dist, x: 0.5 + Math.cos(ang) * dist, y: 1 + Math.sin(ang) * dist, dir: dirOf(deg) };
  }

  // ── 토큰 하나 판정 ──
  // → { kind: 'nonBatted', res } | { kind: 'batted', res, angle, depth, wide, memo } | { kind: 'unknown' }
  // fielder = 기록 [6-4-3] 의 첫 수비 번호(없으면 null) — 방향 없이 온 토큰('병살')의 방향
  function classifyToken(tok, fielder) {
    if (tok in NON_BATTED) return { kind: 'nonBatted', res: NON_BATTED[tok] };
    // 인정 2루타: '인' + 2루타 토큰 (인좌선2 · 인우중2 · 인좌월2)
    if (tok.charAt(0) === '인' && tok.length > 2) {
      var g = classifyToken(tok.slice(1));
      if (g.kind === 'batted' && g.res === '2루타') { g.memo = '인정'; return g; }
    }
    if (fielder && FIELDER_PREFIX[fielder] && tok in SUFFIX) return classifyToken(FIELDER_PREFIX[fielder] + tok);   // 병살[6-4-3] → 유 + 병살
    // 방향 접두어 + 결과 접미어: 긴 접두어부터 맞춰 본다 (좌중2 = 좌중 + 2)
    for (var i = Math.min(2, tok.length - 1); i >= 1; i--) {
      var p = PREFIX[tok.slice(0, i)], s = SUFFIX[tok.slice(i)];
      if (!p || !s) continue;
      if (s.foul) return { kind: 'nonBatted', res: s.res };
      // 실, 또는 내야 방향 뜬공·땅볼 → 해당 야수 위치
      var depth = s.depth == null || (s.fielded && p.pos !== 'OF') ? FIELDER_DEPTH[p.pos] : s.depth;
      if (p.fence) depth = Math.max(depth, FENCE_DEPTH);
      return { kind: 'batted', res: s.res, angle: p.angle, depth: depth, wide: !!s.wide, memo: s.memo || null };
    }
    return { kind: 'unknown' };
  }

  function lastIndex(arr, fn) {
    for (var i = arr.length - 1; i >= 0; i--) if (fn(arr[i])) return i;
    return -1;
  }

  // ── 타석 하나(',' 묶음) → atBat ──
  // 결과 토큰 = 마지막 타구 토큰 > 마지막 타석 결과(4구·사구·삼진) > 마지막 미확인 토큰. 셋 다 없으면 사건·교체뿐(type nonBatted, result null)
  // notes = 결과 토큰을 뺀 나머지 토큰(원래 순서) + 메모('R')
  // confidence 'low' = 안·플·땅처럼 폭이 넓은 결과 · unknown · 'R' 포함 · 미확인 토큰이 섞임 · 결과 토큰이 2개 이상
  // 토큰 끝 [..] = 게임원 부가 기록(홈런 [3R 100M] · 수비 [6-4-3] · 교체 [부상X]) → 떼어 notes 에 남기고, 첫 수비 번호는 방향 없는 토큰의 방향으로 쓴다
  var BRACKET_RE = /^(.*?)\[([^\]]*)\]$/;
  // 홈런 부가 기록 [2R 97M] = 2타점 · 비거리 97m (실제 기록에서 선수 타점 칸과 맞춰 확인, 2026-10-19). 공백은 토큰에서 이미 지웠다
  var HR_NOTE_RE = /^\[(?:(\d)R)?(?:(\d{2,3})M)?\]$/;
  function parsePlateAppearance(raw, inning, onUnknown) {
    var extra = [], toks = [], fld = [];
    raw.split(',').forEach(function (t) {
      t = t.replace(/\s+/g, '');
      var m = BRACKET_RE.exec(t), f = null;
      if (m) { t = m[1]; extra.push('[' + m[2] + ']'); f = (/^(\d)/.exec(m[2]) || [])[1] || null; }
      if (t) { toks.push(t); fld.push(f); }
    });
    var cls = toks.map(function (t, i) { return classifyToken(t, fld[i]); });
    cls.forEach(function (c, i) { if (c.kind === 'unknown') onUnknown(toks[i]); });
    var isResult = function (c) { return c.kind === 'batted' || (c.kind === 'nonBatted' && c.res != null); };
    var pi = lastIndex(cls, function (c) { return c.kind === 'batted'; });
    if (pi < 0) pi = lastIndex(cls, isResult);
    if (pi < 0) pi = lastIndex(cls, function (c) { return c.kind === 'unknown'; });

    var main = pi >= 0 ? cls[pi] : { kind: 'nonBatted', res: null };
    var ab = {
      inning: inning, raw: raw, type: main.kind, result: main.kind === 'unknown' ? null : main.res,
      angle: null, depth: null, confidence: 'high', notes: toks.filter(function (t, i) { return i !== pi; }),
      x: null, y: null, dir: null, src: null
    };
    if (main.kind === 'batted') {
      var sc = toStoredCoords(main.angle, main.depth);
      ab.angle = sc.deg; ab.depth = sc.dist; ab.x = sc.x; ab.y = sc.y; ab.dir = sc.dir;
      ab.src = { angle: main.angle, depth: main.depth };
      if (main.memo) ab.notes.push(main.memo);
    }
    ab.notes = ab.notes.concat(extra);
    ab.rbi = null; ab.distance = null;   // 아는 경우만(홈런 [2R 97M]) — 게임원 표에는 타석별 타점이 없다
    if (ab.result === '홈런') extra.forEach(function (x) { var h = HR_NOTE_RE.exec(x); if (h && h[1]) ab.rbi = +h[1]; if (h && h[2]) ab.distance = +h[2]; });
    if (main.kind === 'unknown' || (main.kind === 'batted' && main.wide) || toks.join('').indexOf('R') >= 0
      || cls.some(function (c) { return c.kind === 'unknown'; }) || cls.filter(isResult).length > 1) ab.confidence = 'low';
    return ab;
  }

  var NAME_RE = /^(.*\S)\s*\((\d*)\)$/;          // 선수명(등번호)
  // PC 웹 복사의 붙은 첫 칸: 타순 + 수비위치 한 글자 + 이름 ('1지홍길동' · '6중안황기' · '10우김용현'). 위치 글자는 게임원 표기
  //   (一 二 三 = 1 · 2 · 3루수, 유 · 좌 · 중 · 우 · 포 · 투, 지 = 지명타자, 미 = 수비 안 한 대타 — 실제 30경기에서 이 11개만 나왔다)
  var JOINED_RE = /^(\d+)\s*([一二三유좌중우포투지미])\s*(\S.*)$/;
  var STAT_RE = /^(?:\d+|\d*\.\d+|-)$/;           // 타수 · 안타 · 타점 · 득점 · 도루 · 타율 · 시즌타율 칸
  var STAT_KEYS = ['ab', 'h', 'rbi', 'r', 'sb', 'avg', 'seasonAvg'];

  /**
   * parseGameOne(text) → {
   *   players: [{ order, position, name, number, atBats: [atBat…], stats: { ab, h, rbi, r, sb, avg, seasonAvg }, line }],
   *            line = 붙여넣은 글에서 몇 번째 줄인지(1~) — 한 칸에 표 두 개가 들어갔는지 볼 때 쓴다
   *   unknownTokens: ['…'],   // 매핑표에 없는 토큰 전부 (중복 없이, 처음 나온 순서)
   *   warnings: ['…']         // 선수 행으로 읽지 않은 줄 · 공백 구분이라 이닝을 모르는 행
   * }
   * atBat = { inning, raw, type: 'batted'|'nonBatted'|'unknown', result, angle, depth, confidence: 'high'|'low', notes,
   *           x, y, dir, src, rbi, distance }   // rbi · distance(m) = 홈런 [2R 97M] 처럼 기록에 있을 때만, 아니면 null
   *   result      기존 결과 코드(안타·2루타·땅볼 아웃·희비·볼넷 …). unknown 이거나 사건·교체뿐이면 null
   *   angle·depth 기존 저장 좌표: angle = 저장 deg(0 좌측 파울라인 ~ 90 중견 ~ 180 우측), depth = 저장 반지름(펜스 0.97). 타구가 아니면 null
   *   x·y·dir     기존 기록과 같은 저장 필드(그대로 abs 에 넣을 수 있는 값). src = 변환 전 매핑표 값 { angle, depth }
   *   inning      이닝 번호(1~). 셀이 몇 번째 이닝 칸인지로 정한다 — 초/말은 붙이지 않는다(홈/원정을 알아야 정해진다)
   */
  function parseGameOne(text) {
    var out = { players: [], unknownTokens: [], warnings: [] }, seen = Object.create(null);
    var onUnknown = function (t) { if (!seen[t]) { seen[t] = 1; out.unknownTokens.push(t); } };

    String(text == null ? '' : text).split(/\r\n|\r|\n/).forEach(function (line, k) {
      if (!line.trim()) return;
      var tabbed = line.indexOf('\t') >= 0;
      // 탭 구분: 빈 칸도 칸으로 센다(이닝 위치 보존). 공백 구분: ', ' · ' / ' 를 붙인 뒤 공백 덩어리로 자른다
      var cells = tabbed
        ? line.split('\t').map(function (c) { return c.trim(); })
        : line.replace(/\s*([,\/])\s*/g, '$1').trim().split(/\s+/);

      var ni = -1;
      for (var i = 0; i < Math.min(4, cells.length); i++) if (NAME_RE.test(cells[i])) { ni = i; break; }
      if (ni < 0) { out.warnings.push((k + 1) + '행: 선수명(등번호) 칸이 없어 건너뜀 — ' + line.trim().slice(0, 40)); return; }

      // 끝쪽 성적 칸: 뒤 빈 칸을 걷어낸 뒤 숫자 칸이 이어지는 만큼(최대 7). 그 앞까지가 이닝 칸
      var end = cells.length;
      while (end > ni + 1 && !cells[end - 1]) end--;
      var st = end;
      while (st > ni + 1 && end - st < STAT_KEYS.length && STAT_RE.test(cells[st - 1])) st--;

      var m = NAME_RE.exec(cells[ni]), stats = {};
      STAT_KEYS.forEach(function (key, j) {
        var v = cells[st + j];
        stats[key] = v == null || v === '-' || v === '' || st + j >= end ? null : parseFloat(v);
      });
      var player = {
        order: ni >= 2 && /^\d+$/.test(cells[ni - 2]) ? parseInt(cells[ni - 2], 10) : null,
        position: ni >= 1 ? cells[ni - 1] : '',
        name: m[1], number: m[2], atBats: [], stats: stats, line: k + 1
      };
      var jm = player.order == null && !player.position ? JOINED_RE.exec(m[1]) : null;
      if (jm) { player.order = parseInt(jm[1], 10); player.position = jm[2]; player.name = jm[3]; }
      if (!tabbed) out.warnings.push((k + 1) + '행 ' + player.name + ': 탭 없이 공백으로 구분돼 빈 이닝 칸을 알 수 없음 → inning = null');

      cells.slice(ni + 1, st).forEach(function (cell, j) {
        var inning = tabbed ? j + 1 : null;
        cell.split('/').forEach(function (pa) {
          pa = pa.trim();
          if (pa) player.atBats.push(parsePlateAppearance(pa, inning, onUnknown));
        });
      });
      out.players.push(player);
    });
    return out;
  }

  // ── 이닝별 점수표(스코어보드) ──
  // 게임원 박스스코어 위쪽 표: Team · › · 1~9 · R · H · E · B (2026-10-15 화면 캡처로 확인 — 진행 안 한 이닝은 빈칸).
  // 복사한 텍스트에서 빈 칸 · › 칸이 어떻게 오는지는 아직 확인 못 해서 너그럽게 읽는다:
  //   · 머리글 줄(… 1 2 3 … R …)이 있으면 이닝 칸 수 N = 1부터 이어진 숫자 개수, 끝 칸 = 그 뒤 이름들(R H E B). 없으면 N = 9, 끝 칸 = R H E B
  //   · 팀 줄 = 앞 칸이 팀 이름, 끝 칸들이 정수. 그 앞이 이닝 칸
  //     탭 구분이면 빈 칸도 칸으로 세고 오른쪽 기준으로 N칸을 자른다(› 칸이 끼어도 맞는다). 공백 구분이면 빈 칸이 사라지므로 1회부터 채운다
  //   · 이닝 값: 숫자 = 득점, X = 공격 안 함(9회말 X 등), 빈칸 · '-' = 진행 안 함 → null. 끝쪽 null 은 잘라 둔다
  //   · 이닝 득점 합 ≠ R 이면 warnings (예: 10회 이상이 표에서 가려진 경우)
  // → { teams: [{ name, innings: [득점 | 'X' | null …], r, h, e, b }], warnings }
  var INT_RE = /^\d+$/, BLANK_RE = /^[xX-]$/, ARROW_RE = /^[›>‹<]$/;
  function parseGameOneScoreboard(text) {
    var out = { teams: [], warnings: [] }, N = 9, LABELS = ['R', 'H', 'E', 'B'];
    var lines = String(text == null ? '' : text).split(/\r\n|\r|\n/).filter(function (l) { return l.trim(); });
    lines.some(function (line) {
      var t = line.trim().split(/\s+/), i = t.indexOf('1'), n = 0;
      if (i < 0) return false;
      while (t[i + n] === String(n + 1)) n++;
      if (!n || t[i + n] !== 'R') return false;
      N = n; LABELS = t.slice(i + n);
      return true;
    });
    var K = LABELS.length;
    lines.forEach(function (line) {
      var tabbed = line.indexOf('\t') >= 0;
      var cells = tabbed ? line.split('\t').map(function (c) { return c.trim(); }) : line.trim().split(/\s+/);
      var j = 0, name = [];
      while (j < cells.length && !cells[j]) j++;
      // 팀 이름: 숫자 · X · - 가 아닌 앞 칸 (탭 구분은 한 칸, 공백 구분은 이어지는 낱말을 붙인다)
      while (j < cells.length && cells[j] && !INT_RE.test(cells[j]) && !BLANK_RE.test(cells[j])) {
        if (!ARROW_RE.test(cells[j])) name.push(cells[j]);
        j++;
        if (tabbed) break;
      }
      var rest = cells.slice(j).filter(function (c) { return !ARROW_RE.test(c); });
      while (rest.length && !rest[rest.length - 1]) rest.pop();
      if (!name.length || rest.length < K) return;
      var sum = rest.slice(rest.length - K), inn = rest.slice(0, rest.length - K);
      if (!sum.every(function (v) { return INT_RE.test(v); })) return;
      if (!inn.every(function (v) { return !v || INT_RE.test(v) || BLANK_RE.test(v); })) return;
      if (tabbed && inn.length > N) inn = inn.slice(inn.length - N);
      var innings = inn.map(function (v) { return INT_RE.test(v) ? parseInt(v, 10) : /^[xX]$/.test(v) ? 'X' : null; });
      while (innings.length && innings[innings.length - 1] == null) innings.pop();
      var team = { name: name.join(' '), innings: innings, r: null, h: null, e: null, b: null };
      LABELS.forEach(function (l, q) { var key = l.toLowerCase(); if (key in team && key !== 'name' && key !== 'innings') team[key] = parseInt(sum[q], 10); });
      if (team.r == null) team.r = parseInt(sum[0], 10);
      var s = innings.reduce(function (a, v) { return a + (typeof v === 'number' ? v : 0); }, 0);
      if (s !== team.r) out.warnings.push(team.name + ': 이닝 득점 합 ' + s + ' ≠ R ' + team.r + ' — 10회 이상 연장 이닝이 표에서 가려졌을 수 있습니다(게임원 › 버튼)');
      out.teams.push(team);
    });
    if (!out.teams.length) out.warnings.push('팀 줄(팀 이름 · 이닝 점수 · R H E B)을 찾지 못했습니다');
    return out;
  }

  // ── 박스스코어 페이지 통째 복사 → 점수표 · 타자 표 나누기 ──
  // 휴대폰에서는 표를 골라 긁기 어려워 '전체 선택 → 복사'를 쓰기 쉽다. 그러면 메뉴 · 요약 · 투수 표까지 한 덩어리로 온다(2026-10-19 확인).
  //   점수표 = 'Team 1 2 … R …' 머리글 줄 + 아래 팀 줄 2개
  //   타자 표 = '선수 1 2 … 타수 …' 머리글 줄부터 '합 계' 줄까지 (위쪽 줄 = 팀 이름). 투수 표('선수 결과 이닝 …')는 쓰지 않는다
  //   투수 표 = '선수 결과 이닝 …' 머리글 줄과 그 아래 투수 줄 (위쪽 줄 = 팀 이름) → pitch 에 모아 둔다(parseGameOnePitchers 로 읽는다)
  // → 타자 표가 2개 이상일 때만 { score: 점수표 글 | '', tables: [{ name, text }…], pitch: 투수 표 글 | '' } (페이지 위 → 아래 순서), 아니면 null
  var BAT_HEAD_RE = /^\s*선수\s+1\s+2\s/, PIT_HEAD_RE = /^\s*선수\s+결과\s/, TOTAL_RE = /^\s*합\s*계/, SCORE_HEAD_RE = /^\s*Team\s+(?:\S+\s+)?1\s+2\s.*\sR\s/;
  var PIT_ROW_RE = /^\s*\S.*\(\d*\)\s/;   // 투수 줄: 이름(번호) 다음 칸
  function _teamLine(lines, i) {   // 머리글 i 바로 위의 팀 이름 줄(탭 없는 줄) → 줄 번호 | -1
    var j = i - 1;
    while (j >= 0 && !lines[j].trim()) j--;
    return j >= 0 && lines[j].indexOf('\t') < 0 && !TOTAL_RE.test(lines[j]) ? j : -1;
  }
  function splitGameOnePage(text) {
    var lines = String(text == null ? '' : text).split(/\r\n|\r|\n/), tables = [], score = '', pitch = [];
    for (var i = 0; i < lines.length; i++) {
      if (PIT_HEAD_RE.test(lines[i])) {
        var t = _teamLine(lines, i), e = i + 1;
        while (e < lines.length && PIT_ROW_RE.test(lines[e])) e++;
        pitch.push(lines.slice(t >= 0 ? t : i, e).join('\n'));
        continue;
      }
      if (!score && SCORE_HEAD_RE.test(lines[i])) score = lines.slice(i, i + 3).join('\n');
      if (!BAT_HEAD_RE.test(lines[i])) continue;
      var name = '', j = i - 1, end = i + 1;
      while (j >= 0 && !lines[j].trim()) j--;
      if (j >= 0 && !TOTAL_RE.test(lines[j])) name = lines[j].trim();
      while (end < lines.length && !TOTAL_RE.test(lines[end]) && !BAT_HEAD_RE.test(lines[end]) && !PIT_HEAD_RE.test(lines[end])) end++;
      if (end < lines.length && TOTAL_RE.test(lines[end])) end++;
      tables.push({ name: name, text: lines.slice(i, end).join('\n') });
      i = end - 1;
    }
    return tables.length >= 2 ? { score: score, tables: tables, pitch: pitch.join('\n') } : null;
  }

  // ── 투수 표(투수기록) ──
  // 실제 PC 웹 복사(2026-10-19): 머리글 '선수 결과 이닝 타자 타수 피안타 피홈런 희타 희비 볼넷 사구 삼진 폭투 보크 실점 자책점 투구수 방어율 시즌',
  //   줄 = '이름(번호) 결과(승 · 패 · 세 · 홀 · -) 이닝(3 · 2 ⅔ · 0 ⅓) 타자 …'. 표마다 바로 위 줄 = 팀 이름. 머리글이 있어야 표로 본다
  //   이닝은 아웃 수(outs)로 바꾼다(2 ⅔ → 8). 실제 24경기 투수 103명: 투수 표 순서대로 '타자'(상대 타자) 수만큼 상대 팀 타석을 잘라 붙이면
  //   피안타 · 피홈런 · 볼넷 · 사구 · 삼진이 103명 모두 투수 표와 같았다 — 가져오기가 이 순서로 타석에 투수를 붙인다
  // → { tables: [{ name, pitchers: [{ name, number, result, outs, tbf, ab, h, hr, sh, sf, bb, hbp, k, wp, bk, r, er, np }] }], warnings }
  var PIT_KEYS = ['tbf', 'ab', 'h', 'hr', 'sh', 'sf', 'bb', 'hbp', 'k', 'wp', 'bk', 'r', 'er', 'np'];
  function _outs(v) {
    var m = /^(\d+)?\s*(⅓|⅔|1\/3|2\/3)?$/.exec(String(v == null ? '' : v).trim());
    if (!m || (m[1] == null && !m[2])) return null;
    return (+m[1] || 0) * 3 + (m[2] === '⅓' || m[2] === '1/3' ? 1 : m[2] ? 2 : 0);
  }
  function parseGameOnePitchers(text) {
    var lines = String(text == null ? '' : text).split(/\r\n|\r|\n/), out = { tables: [], warnings: [] }, cur = null;
    lines.forEach(function (line, k) {
      if (PIT_HEAD_RE.test(line)) { var t = _teamLine(lines, k); cur = { name: t >= 0 ? lines[t].trim() : '', pitchers: [] }; out.tables.push(cur); return; }
      if (!cur || !line.trim()) return;
      if (BAT_HEAD_RE.test(line) || TOTAL_RE.test(line)) { cur = null; return; }
      var cells = line.indexOf('\t') >= 0 ? line.split('\t').map(function (c) { return c.trim(); }) : line.trim().split(/\s+/);
      if (line.indexOf('\t') < 0 && /^[⅓⅔]$/.test(cells[3] || '')) cells.splice(2, 2, cells[2] + ' ' + cells[3]);   // 공백 구분: '2 ⅔' 가 두 칸으로 갈라진 것
      var m = NAME_RE.exec(cells[0] || '');
      if (!m) return;
      var outs = _outs(cells[2]), nums = cells.slice(3, 3 + PIT_KEYS.length).map(function (v) { return /^\d+$/.test(v) ? parseInt(v, 10) : NaN; });
      if (outs == null || nums.length < PIT_KEYS.length || nums.some(isNaN)) { out.warnings.push((k + 1) + '행 ' + m[1] + ': 투수 줄로 읽지 못함 — ' + line.trim().slice(0, 40)); return; }
      var p = { name: m[1], number: m[2], result: cells[1], outs: outs };
      PIT_KEYS.forEach(function (key, j) { p[key] = nums[j]; });
      cur.pitchers.push(p);
    });
    return out;
  }

  // ── 경기 정보 줄 ──
  // 박스스코어 페이지 점수표 위의 '리그 / 월.일(시:분) / 구장' 줄 (예: '평일야간 안성리그 / 10.07(20:00) / 안성맞춤야구장').
  // 맨 위 다른 경기 링크 줄('… 2 vs 15 … (10.18)')은 '/' 로 나뉘지 않아 읽지 않는다. 연도는 페이지에 없다 — 가져오기가 정한다
  // → { league, month, day, time, venue } | null
  var INFO_RE = /^\s*([^\/\t]+?)\s*\/\s*(\d{1,2})\.(\d{1,2})\s*(?:\(\s*(\d{1,2}:\d{2})\s*\))?\s*\/\s*([^\/\t]+?)\s*$/;
  function parseGameOneInfo(text) {
    var lines = String(text == null ? '' : text).split(/\r\n|\r|\n/);
    for (var i = 0; i < lines.length; i++) {
      var m = INFO_RE.exec(lines[i]);
      if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) continue;
      return { league: m[1], month: +m[2], day: +m[3], time: m[4] || '', venue: m[5] };
    }
    return null;
  }

  // ── 선수 개인 통산 페이지 ──
  // 게임원 선수 페이지(이름 · 우투우타 · 비선출 · 학교 / 타자기록 / 투수기록)를 복사한 평문.
  // 한 줄에 '경기수68' · '* 경기수 68' · '경기수: 68' 처럼 오거나, 이름 줄 다음 줄에 값만 와도 읽는다.
  // 게임원 숫자를 그대로 옮긴다(다시 계산하지 않음) — 방어율 · 탈삼진율은 게임원의 7이닝 기준.
  // → { name, hand, bg, school, bat: {…} | null, pit: {…} | null } — 모르는 줄은 건너뛴다
  var CAREER_BAT = { '경기수': 'g', '타율': 'avg', '타석': 'pa', '타수': 'ab', '득점': 'r', '총안타': 'h', '1루타': 's1', '2루타': 's2', '3루타': 's3', '홈런': 'hr', '루타': 'tb', '타점': 'rbi', '도루': 'sb', '도루자': 'cs', '희타': 'sh', '희비': 'sf', '볼넷': 'bb', '고의4구': 'ibb', '사구': 'hbp', '삼진': 'k', '병살': 'gdp', '장타율': 'slg', '출루율': 'obp', '도루성공률': 'sbPct', '멀티히트': 'multi', 'OPS': 'ops', 'BB/K': 'bbk', '장타/안타': 'xbhH' };
  var CAREER_PIT = { '경기수': 'g', '방어율': 'era', '승': 'w', '패': 'l', '세': 'sv', '홀드': 'hld', '승률': 'wpct', '타자': 'tbf', '타수': 'ab', '투구수': 'np', '이닝': 'outs', '피안타': 'h', '피홈런': 'hr', '희타': 'sh', '희비': 'sf', '볼넷': 'bb', '고의4구': 'ibb', '사구': 'hbp', '탈삼진': 'k', '폭투': 'wp', '보크': 'bk', '실점': 'r', '자책점': 'er', 'WHIP': 'whip', '피안타율': 'avg', '탈삼진율': 'k7' };
  var CAREER_VAL = /^[:：]?\s*(-|\d[\d,]*(?:\.\d+)?)$/;
  var CAREER_IP = /^[:：]?\s*(\d+)\s*(⅓|⅔|1\/3|2\/3)?$/;
  function careerLabels(map) { return Object.keys(map).sort(function (a, b) { return b.length - a.length; }); }
  function parseGameOneCareer(text) {
    var lines = String(text == null ? '' : text).split(/\r\n|\r|\n/).map(function (l) { return l.replace(/^\s*[*•·\-]\s*/, '').trim(); }).filter(Boolean);
    var out = { name: '', hand: '', bg: '', school: '', bat: null, pit: null };
    var head = [], sec = null, map = null, labels = null, pending = null;
    function put(label, raw) {
      var key = map[label], v;
      if (key === 'outs') { var m = CAREER_IP.exec(raw); if (!m) return false; v = +m[1] * 3 + (m[2] ? (m[2] === '⅔' || m[2] === '2/3' ? 2 : 1) : 0); }
      else { var n = CAREER_VAL.exec(raw); if (!n) return false; v = n[1] === '-' ? null : +n[1].replace(/,/g, ''); }
      (out[sec] || (out[sec] = {}))[key] = v;
      return true;
    }
    lines.forEach(function (l) {
      if (/^타자\s*기록$/.test(l)) { sec = 'bat'; map = CAREER_BAT; labels = careerLabels(map); pending = null; return; }
      if (/^투수\s*기록$/.test(l)) { sec = 'pit'; map = CAREER_PIT; labels = careerLabels(map); pending = null; return; }
      if (!sec) { head.push(l); return; }
      if (pending && put(pending, l)) { pending = null; return; }
      pending = null;
      for (var i = 0; i < labels.length; i++) {
        if (l.indexOf(labels[i]) !== 0) continue;
        var rest = l.slice(labels[i].length).trim();
        if (!rest) { pending = labels[i]; return; }
        if (put(labels[i], rest)) return;
      }
    });
    // 머리 부분: 이름은 '우투우타' 줄 바로 위(앞에 메뉴 글자가 딸려 와도) · 없으면 첫 줄
    var hi = -1;
    head.forEach(function (l, i) {
      if (/^[우좌양]투[우좌양]타$/.test(l)) { if (hi < 0) hi = i; out.hand = out.hand || l; }
      else if (/^비?선출$/.test(l)) out.bg = out.bg || l;
      else if (/(학교|고|대)$/.test(l) && !out.school && i > 0) out.school = l.slice(0, 30);
    });
    out.name = String((hi > 0 ? head[hi - 1] : head[0]) || '').replace(/\s*[(#].*$/, '').slice(0, 20);
    return out;
  }

  var api = {
    parseGameOne: parseGameOne, parseGameOneScoreboard: parseGameOneScoreboard, splitGameOnePage: splitGameOnePage, parseGameOnePitchers: parseGameOnePitchers, parseGameOneInfo: parseGameOneInfo, parseGameOneCareer: parseGameOneCareer, toStoredCoords: toStoredCoords, classifyToken: classifyToken,
    PREFIX: PREFIX, SUFFIX: SUFFIX, NON_BATTED: NON_BATTED, FIELDER_DEPTH: FIELDER_DEPTH, FENCE_DEPTH: FENCE_DEPTH
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.SLGameOne = api; root.parseGameOne = parseGameOne; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
