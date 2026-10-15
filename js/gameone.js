/**
 * 게임원(gameone.kr) 박스스코어 → 타석 · 타구 위치 파서 (UI 미연결 · 순수 함수)
 *
 * 입력: 게임원 박스스코어 타자 테이블을 드래그 복사해 붙여넣은 평문.
 *       행 = 타순 · 수비위치 · 선수명(등번호) · 1~N회 셀 · 타수 · 안타 · 타점 · 득점 · 도루 · 타율 · 시즌타율
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
  // pos: 실책(실)일 때 깊이로 쓸 야수 자리(FIELDER_DEPTH) · fence: 좌월·중월·우월 = 같은 각도, 깊이만 펜스 근처 이상(FENCE_DEPTH)
  // 2내·유내(내야안타)는 접두어 2·유 + 접미어 내안 으로 읽는다
  var PREFIX = {
    __proto__: null,
    '좌': { angle: -35, pos: 'OF' }, '좌중': { angle: -17, pos: 'OF' }, '중': { angle: 0, pos: 'OF' },
    '우중': { angle: 17, pos: 'OF' }, '우': { angle: 35, pos: 'OF' },
    '좌월': { angle: -35, pos: 'OF', fence: true }, '중월': { angle: 0, pos: 'OF', fence: true }, '우월': { angle: 35, pos: 'OF', fence: true },
    '3': { angle: -30, pos: 'IF' }, '유': { angle: -12, pos: 'IF' }, '2': { angle: 12, pos: 'IF' }, '1': { angle: 30, pos: 'IF' },
    '투': { angle: 0, pos: 'P' }, '포': { angle: 0, pos: 'C' }
  };

  // ── 결과 접미어 → 기존 결과 코드(res) · 매핑표 깊이 (0 = 홈플레이트, 1 = 그 방향 펜스) ──
  // wide: 안·플·땅처럼 떨어진 자리 폭이 넓은 결과 → confidence 'low' · memo: 의미 미확인 표시(notes 에 그대로 보존)
  // 희플 → '희비'(기존 희생플라이 코드) · 실 → depth null = 해당 야수 위치(FIELDER_DEPTH)
  var SUFFIX = {
    __proto__: null,
    '땅': { res: '땅볼 아웃', depth: 0.25, wide: true },
    '땅R': { res: '땅볼 아웃', depth: 0.25, wide: true, memo: 'R' },
    '내안': { res: '내야안타', depth: 0.30 },
    '안': { res: '안타', depth: 0.55, wide: true },
    '2': { res: '2루타', depth: 0.75 },
    '3': { res: '3루타', depth: 0.85 },
    '월2': { res: '2루타', depth: 0.92 },
    '월홈': { res: '홈런', depth: 1.05 },
    '홈': { res: '홈런', depth: 1.05 },
    '플': { res: '플라이 아웃', depth: 0.65, wide: true },
    '희플': { res: '희비', depth: 0.80 },
    '실': { res: '실책', depth: null }
  };

  // 실책 깊이 = 해당 야수의 평소 수비 위치. 매핑표에 수치가 없어 정한 근사값(표준 구장 중앙 펜스 120m 기준):
  //   포수 0.05(홈 바로 앞) · 투수 0.15(마운드 18.44m ≈ 120m × 0.15) · 내야수 0.25(= 땅 깊이) · 외야수 0.65(= 플 깊이)
  var FIELDER_DEPTH = { __proto__: null, C: 0.05, P: 0.15, IF: 0.25, OF: 0.65 };
  // 좌월·중월·우월 접두어의 "펜스 근처 이상" = 매핑표 월2 깊이(0.92)를 하한으로 둔다 (좌월3 처럼 표에 따로 없는 조합용.
  // 좌월홈 = 좌월+홈 = 좌+월홈, 중월2 = 중월+2 = 중+월2 — 어느 쪽으로 읽어도 같은 값)
  var FENCE_DEPTH = 0.92;

  // ── 비타구 토큰: 차트 제외, 타석 결과로만 기록 ──
  // 값이 있으면 타석 결과(기존 결과 코드), null 이면 같은 타석의 사건·교체 메모(notes)
  var NON_BATTED = {
    __proto__: null,
    '4구': '볼넷', '사구': '사구', '삼진': '삼진',
    '폭투': null, '도루': null, '주자아웃': null, '포구실책': null, '대타': null, '대수비': null, '대주자': null
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
  function classifyToken(tok) {
    if (tok in NON_BATTED) return { kind: 'nonBatted', res: NON_BATTED[tok] };
    // 방향 접두어 + 결과 접미어: 긴 접두어부터 맞춰 본다 (좌중2 = 좌중 + 2)
    for (var i = Math.min(2, tok.length - 1); i >= 1; i--) {
      var p = PREFIX[tok.slice(0, i)], s = SUFFIX[tok.slice(i)];
      if (!p || !s) continue;
      var depth = s.depth != null ? s.depth : FIELDER_DEPTH[p.pos];
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
  function parsePlateAppearance(raw, inning, onUnknown) {
    var toks = raw.split(',').map(function (t) { return t.replace(/\s+/g, ''); }).filter(Boolean);
    var cls = toks.map(classifyToken);
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
    if (main.kind === 'unknown' || (main.kind === 'batted' && main.wide) || raw.indexOf('R') >= 0
      || cls.some(function (c) { return c.kind === 'unknown'; }) || cls.filter(isResult).length > 1) ab.confidence = 'low';
    return ab;
  }

  var NAME_RE = /^(.*\S)\s*\((\d*)\)$/;          // 선수명(등번호)
  var STAT_RE = /^(?:\d+|\d*\.\d+|-)$/;           // 타수 · 안타 · 타점 · 득점 · 도루 · 타율 · 시즌타율 칸
  var STAT_KEYS = ['ab', 'h', 'rbi', 'r', 'sb', 'avg', 'seasonAvg'];

  /**
   * parseGameOne(text) → {
   *   players: [{ order, position, name, number, atBats: [atBat…], stats: { ab, h, rbi, r, sb, avg, seasonAvg } }],
   *   unknownTokens: ['…'],   // 매핑표에 없는 토큰 전부 (중복 없이, 처음 나온 순서)
   *   warnings: ['…']         // 선수 행으로 읽지 않은 줄 · 공백 구분이라 이닝을 모르는 행
   * }
   * atBat = { inning, raw, type: 'batted'|'nonBatted'|'unknown', result, angle, depth, confidence: 'high'|'low', notes,
   *           x, y, dir, src }
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
        name: m[1], number: m[2], atBats: [], stats: stats
      };
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

  var api = {
    parseGameOne: parseGameOne, toStoredCoords: toStoredCoords, classifyToken: classifyToken,
    PREFIX: PREFIX, SUFFIX: SUFFIX, NON_BATTED: NON_BATTED, FIELDER_DEPTH: FIELDER_DEPTH, FENCE_DEPTH: FENCE_DEPTH
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.SLGameOne = api; root.parseGameOne = parseGameOne; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
