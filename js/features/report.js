// 선수 리포트 — 학부모 공유용 세로 이미지(1080×1920, 9:16)
// 선수 → 기간 → 코치 코멘트 → PNG 저장·공유 / 인쇄(PDF)
// 계산은 기존 것을 그대로 쓴다: calcStats(batdata.js) · 코스 = zoneOf(zonefig.js) · 필드 좌표 = window._fieldPos(core.js)
// 그림은 캔버스에 직접 그린다 (이미지 공통 키트 imgkit.js — 흰 종이 PAPER · Noto Sans KR · Oswald)
// 저장 경기는 읽기만 한다. 새로 쓰는 키는 sl_report_cmt(선수별 마지막 코치 코멘트, 이 기기에만 · 동기화 안 함) 하나뿐
import { buildData, calcStats, f3, pct, sampleBadge } from './batdata.js?v=9';
import { zoneOf } from './zonefig.js?v=7';
import { HITS, ZONES_9 } from '../constants.js';
import { FONT, PAPER as P, font, fitFont, spacing, rr, wordmark, drawWithFonts } from './imgkit.js?v=1';

const CMT_KEY = 'sl_report_cmt';
const CMT_MAX = 80;           // 코멘트 최대 글자 (3줄 안쪽)
const RANGES = [1, 3, 5, 10, 0];   // 최근 N경기 · 0 = 전체
const DEF_RANGE = 5;

// 캔버스 — 인쇄도 하는 흰 종이(PAPER). 글꼴은 둘만: 한글 = Noto Sans KR · 숫자/영문 라벨 = Oswald
const W = 1080, H = 1920, M = 60, CW = W - M * 2;
const KR = FONT.kr, NUM = FONT.num;
const PW = (CW - 20) / 2, FW = PW - 40;   // 그림 칸 폭 · 그 안 그림 폭(1배)
const MIN_AB = 3;   // 코스 칸 색칠 최소 타수 — zonefig.js(분석 · 스카우트 탭)와 같은 값
const ZONE_BALL = ['볼 위', '볼 아래', '볼 내', '볼 외'];

const $ = id => document.getElementById(id);
const _e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();

function _track(action) {
  try { if (typeof window.gtag === 'function') window.gtag('event', 'player_report', { action }); } catch (e) {}
}

// ── 샘플: 가상 선수 1명 (메모리 전용 · 저장하지 않음) ─────────────
// 좌표는 저장 형식 그대로(홈 = (0.5, 1), deg 0 = 3루 파울라인, 펜스 반지름 0.97)
function _samplePos(deg, dist) {
  const ang = deg * Math.PI / 180 - Math.PI;
  const dirs = [['LF', 36], ['LC', 66], ['CF', 90], ['RC', 114], ['RF', 150]];
  const dir = dirs.reduce((b, d) => (Math.abs(d[1] - deg) < Math.abs(b[1] - deg) ? d : b))[0];
  return { x: 0.5 + Math.cos(ang) * dist, y: 1 + Math.sin(ang) * dist, deg, dir };
}
function _sampleGames() {
  const TEAM = 'SprayLab 리틀';
  const OPP = ['한빛 유소년', '새솔 리틀', '푸른 BC', '동산 유소년', '미래 리틀', '청솔 BC'];
  // [경기, 결과, 방향(deg), 거리, 코스, 타점]
  const PA = [
    [0, '안타', 58, .55, '내각 중간', 1], [0, '삼진', null, 0, '외각 낮음'], [0, '땅볼 아웃', 40, .30, '내각 낮음'], [0, '볼넷', null, 0, '볼 외'],
    [1, '2루타', 30, .80, '내각 높음', 1], [1, '플라이 아웃', 95, .70, '중앙 높음'], [1, '안타', 88, .50, '중앙 중간'], [1, '삼진', null, 0, '볼 아래'], [1, '땅볼 아웃', 70, .28, '중앙 낮음'],
    [2, '안타', 115, .52, '외각 중간'], [2, '사구', null, 0, '볼 내'], [2, '땅볼 아웃', 50, .32, '외각 낮음'], [2, '3루타', 125, .88, '중앙 중간', 2], [2, '희타', 98, .10, '중앙 높음'],
    [3, '삼진', null, 0, '외각 낮음'], [3, '내야안타', 65, .27, '중앙 낮음'], [3, '플라이 아웃', 45, .66, '내각 높음'], [3, '볼넷', null, 0, '볼 위'], [3, '안타', 36, .56, '내각 중간'],
    [4, '땅볼 아웃', 105, .30, '외각 중간'], [4, '2루타', 20, .84, '내각 중간', 1], [4, '삼진', null, 0, '외각 중간'], [4, '땅볼 아웃', 80, .26, '외각 낮음'],
    [5, '안타', 75, .54, '중앙 중간', 1], [5, '플라이 아웃', 140, .68, '외각 높음'], [5, '볼넷', null, 0, '볼 외'], [5, '삼진', null, 0, '중앙 높음'], [5, '땅볼 아웃', 60, .30, '내각 낮음'],
  ];
  const day = 864e5, now = Date.now();
  const lineup = [{ id: 'sample7', name: '김하늘', num: '7', bh: 'R' }];
  return OPP.map((ta, gi) => ({
    sample: true, key: 'sample_' + gi, th: TEAM, ta, ts: now - (OPP.length - 1 - gi) * 7 * day,
    home_lineup: lineup, away_lineup: [],
    abs: PA.filter(p => p[0] === gi).map((p, i) => ({
      id: 'sample_' + gi + '_' + i, bid: 'sample7', bname: '김하늘', bnum: '7', bats: 'R', team: 'home',
      res: p[1], zone: p[4], rbi: p[5] || 0, inn: String(i * 2 + 1), pitches: [],
      ...(p[2] != null ? _samplePos(p[2], p[3]) : { x: null, y: null, deg: null, dir: null }),
    })),
  }));
}
const SAMPLE_CMT = '타구를 좌중간으로 강하게 보내는 장면이 늘었어요. 바깥쪽 낮은 공은 아직 약해서 다음 주에 집중해서 연습합니다.';

// ── 타구 분석 (순수 함수 · 저장값은 읽기만 한다) ───────────────
// 방향: 앱의 당김·센터·밀어와 같은 경계(72° · 108°)를 쓰되 좌·우타와 상관없이 필드 기준이다. 좌 = 3루 쪽(deg < 72) · 우 = 1루 쪽(deg > 108).
//       방향이 있는 타구(deg 가 있는 것)만 센다 — 위쪽 "타구 N개" · 당김/센터/밀어와 같은 모집단이다.
// 유형: launchType(타구 각도를 직접 입력한 타구)이 MIN_TYPE 개 이상이면 그것으로, 아니면 아웃 타구(땅볼 아웃 · 플라이 아웃)만으로 센다.
//       안타 · 장타는 유형을 입력하지 않았으면 모르는 것으로 두고 땅볼/뜬공으로 짐작해 넣지 않는다.
const MIN_TYPE = 5;   // 유형 비율을 보여 주려면 필요한 최소 타구 수
// 한 줄 요약 문턱 — 근거는 ruleSummary 위 주석. 한 곳에서만 조정한다
const MIN_SUM = 15;    // 요약을 말하려면 필요한 최소 타구 수 (내야안타 제외)
const SUM_CELL_N = 5;  // 규칙 1: 방향×유형 한 칸의 최소 개수
const SUM_CELL = 0.45; // 규칙 1: 그 한 칸이 유형을 아는 타구에서 차지하는 최소 비율
const SUM_SIDE = 0.65; // 규칙 2: 한 방향이 차지하는 최소 비율
const SUM_TYPE = 0.70; // 규칙 3: 한 유형이 차지하는 최소 비율
const SIDE_TXT = ['좌측', '중앙', '우측'];
const TYPE_TXT = { __proto__: null, 땅볼: '땅볼', 라인드라이브: '라인드라이브', 플라이볼: '뜬공' };
const _sideOf = a => (a.deg < 72 ? 0 : a.deg > 108 ? 2 : 1);

export function dirSplit(abs) {
  const c = [0, 0, 0];
  let n = 0;
  (abs || []).forEach(a => { if (a && a.deg != null) { c[_sideOf(a)]++; n++; } });
  return { n, left: c[0], center: c[1], right: c[2] };
}

function _typeOf(a) {
  if (TYPE_TXT[a.launchType]) return a.launchType;
  if (a.res === '땅볼 아웃') return '땅볼';
  if (a.res === '플라이 아웃') return '플라이볼';
  return null;
}

// basis 'launch' = 입력한 타구 유형 · 'out' = 아웃 타구만 (라인드라이브는 알 수 없어 null)
export function typeMix(abs) {
  const list = (abs || []).filter(a => a);
  const L = list.filter(a => TYPE_TXT[a.launchType]);
  const cnt = (arr, t) => arr.filter(a => _typeOf(a) === t).length;
  if (L.length >= MIN_TYPE) return { basis: 'launch', n: L.length, ground: cnt(L, '땅볼'), line: cnt(L, '라인드라이브'), fly: cnt(L, '플라이볼') };
  const O = list.filter(a => a.res === '땅볼 아웃' || a.res === '플라이 아웃');
  return { basis: 'out', n: O.length, ground: cnt(O, '땅볼'), line: null, fly: cnt(O, '플라이볼') };
}

// 규칙 기반 한 줄 요약 (AI 호출 없음). 위에서부터 먼저 맞는 규칙 하나만 쓴다
//  0) 타구가 MIN_SUM 개 미만                                   → 판단 보류
//  1) 방향 × 유형 한 칸이 유형을 아는 타구의 SUM_CELL 이상(SUM_CELL_N 개 이상) → "우측 땅볼 비중 높음"
//  2) 한 방향이 방향 있는 타구의 SUM_SIDE 이상                  → "우측 타구 비중 높음"
//  3) 한 유형이 유형을 아는 타구의 SUM_TYPE 이상                → "땅볼 비중 높음"
//  4) 그 밖                                                   → 쏠림이 뚜렷하지 않음
// 내야안타는 이 요약의 계산에서만 뺀다: 앱이 내야안타에 방향을 모르는 채 기본값(중앙)을 넣어 "중앙 비중"을 부풀리기 때문이다.
//   (dirSplit · typeMix · 좌·중·우 막대 · 당김/센터/밀어의 모집단은 그대로 — 내야안타를 센다.)
// 문턱의 근거: 쏠림이 전혀 없는 무작위 기록(방향 1/3씩 · 땅볼:뜬공 50:50 · 타구의 30%는 안타라 유형 없음)을 4,000번씩 시뮬레이션했다.
//   예전 값(8개 · 한 칸 30% · 방향 50% · 유형 55%)은 타구 10~30개에서 "비중 높음"이 76~86% 나왔다 — 우연을 경향처럼 보여 주는 것이다.
//   지금 값은 같은 기록에서 타구 15개 약 3% · 20개 약 6% · 25개 약 10% · 30개 약 8% 이고, 14개 이하는 판단 보류다.
//   안타가 많을수록 줄고(안타 50%면 20개에서 약 1%) 모든 타구의 유형을 알면 늘어난다(안타 0%면 20개에서 약 14%).
//   쏠림이 진짜일 때 말하는 정도(같은 모델, 타구 20개 / 30개): 우측 60% 약 46% / 38% · 우측 70% 약 80% / 77% · 땅볼 75% 약 30% / 71%.
//   이 값들은 위 가정(방향 1/3 · 50:50 · 안타 30%) 위의 계산이라 실데이터로 다시 확인해야 한다.
//   재현: tests/report.test.js 의 시드 고정 시뮬레이션 (오탐 상한 · 우측 70% 쏠림을 놓치지 않는지).
export function ruleSummary(abs) {
  const d = (abs || []).filter(a => a && a.deg != null && a.res !== '내야안타');
  if (d.length < MIN_SUM) return { text: `타구 기록이 적어 경향 판단 보류 (${d.length}개)`, detail: '내야안타 제외', rule: 0 };
  const typed = d.map(a => [_sideOf(a), _typeOf(a)]).filter(x => x[1]);
  const top = obj => Object.keys(obj).sort((x, y) => obj[y] - obj[x] || (x < y ? -1 : 1))[0];
  let cell = {}, byType = {};
  typed.forEach(([sd, t]) => { cell[sd + '|' + t] = (cell[sd + '|' + t] || 0) + 1; byType[t] = (byType[t] || 0) + 1; });
  if (typed.length >= MIN_SUM) {
    const k = top(cell), n = cell[k];
    if (n >= SUM_CELL_N && n / typed.length >= SUM_CELL) {
      const [sd, t] = k.split('|');
      return { text: `${SIDE_TXT[sd]} ${TYPE_TXT[t]} 비중 높음`, detail: `유형을 아는 타구 ${typed.length}개 중 ${n}개`, rule: 1 };
    }
  }
  const sc = [0, 0, 0];
  d.forEach(a => sc[_sideOf(a)]++);
  const si = sc.indexOf(Math.max(...sc));
  if (sc[si] / d.length >= SUM_SIDE) return { text: `${SIDE_TXT[si]} 타구 비중 높음`, detail: `내야안타 제외 ${d.length}개 중 ${sc[si]}개`, rule: 2 };
  if (typed.length >= MIN_SUM) {
    const t = top(byType);
    if (byType[t] / typed.length >= SUM_TYPE) return { text: `${TYPE_TXT[t]} 비중 높음`, detail: `유형을 아는 타구 ${typed.length}개 중 ${byType[t]}개`, rule: 3 };
  }
  return { text: '방향·유형 쏠림이 뚜렷하지 않음', detail: `내야안타 제외 ${d.length}개 기준`, rule: 4 };
}

// ── 선수 묶기 ─────────────────────────────────────────────────
// 기본 = 팀명 + 이름 (팀명은 띄어쓰기·대소문자 무시).
// 같은 팀 라인업에 같은 이름이 등번호가 다르게 동시에 있었던 경기가 있으면 두 사람이라는 증거 → 그 팀·이름만 등번호로 나눈다.
// 증거가 없으면 번호가 달라도 한 사람으로 본다 (유소년은 등번호가 자주 바뀜). 선수 ID(bid)는 경기마다 새로 만들어져 쓸 수 없다.
function _sides(g) {
  if (g.sample) return { home: g.home_lineup, away: g.away_lineup };
  if (g.current) { const S = window.AS || {}; return { home: S.home_lineup || [], away: S.away_lineup || [] }; }
  let d = null;
  try { d = JSON.parse(localStorage.getItem(g.key)); } catch (e) {}
  return { home: (d && d.home_lineup) || [], away: (d && d.away_lineup) || [] };
}

function _groupPlayers(games) {
  const split = new Set();
  const posOf = {};   // 팀|이름 → 가장 최근 경기 라인업에 적힌 포지션 (적은 적 없으면 없음)
  games.forEach(g => {
    const sd = _sides(g);
    [['home', g.th], ['away', g.ta]].forEach(([side, team]) => {
      const nums = Object.create(null);
      (sd[side] || []).forEach(p => {
        if (!p || !p.name) return;
        if (p.pos) posOf[_norm(team) + '|' + p.name] = String(p.pos);
        if (p.num == null || p.num === '') return;
        (nums[p.name] = nums[p.name] || new Set()).add(String(p.num));
      });
      Object.keys(nums).forEach(n => { if (nums[n].size > 1) split.add(_norm(team) + '|' + n); });
    });
  });

  const map = {};
  games.forEach((g, gi) => (g.abs || []).forEach(a => {
    if (!a || !a.bname) return;
    const team = (a.team === 'away' ? g.ta : g.th) || '';
    const base = _norm(team) + '|' + a.bname;
    const num = a.bnum != null && a.bnum !== '' ? String(a.bnum) : '';
    const key = split.has(base) ? base + '#' + (num || '?') : base;
    const p = map[key] || (map[key] = { key, name: a.bname, team: '', num: '', pos: posOf[base] || '', split: split.has(base), items: [], gset: new Set(), last: -1 });
    p.items.push({ a, gi });
    p.gset.add(gi);
    if (gi >= p.last) { p.last = gi; if (team) p.team = team; if (num) p.num = num; }
  }));
  return Object.values(map).sort((x, y) => y.items.length - x.items.length || String(x.name).localeCompare(String(y.name), 'ko'));
}

// ── 리포트 데이터 ─────────────────────────────────────────────
function _ymd(ts, full) {
  const d = new Date(ts);
  const y = full ? String(d.getFullYear()) : String(d.getFullYear()).slice(2);
  const pad = v => (full ? String(v).padStart(2, '0') : String(v));
  return `${y}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function _reportData(p, games, range, sample) {
  const all = [...p.gset].sort((x, y) => x - y);
  const use = range ? all.slice(-range) : all;
  const set = new Set(use);
  const abs = p.items.filter(x => set.has(x.gi)).map(x => x.a);
  const ts = use.map(gi => games[gi].ts || (games[gi].current ? Date.now() : 0)).filter(Boolean);
  const from = ts.length ? _ymd(Math.min(...ts)) : '', to = ts.length ? _ymd(Math.max(...ts)) : '';
  return {
    name: p.name, num: p.num, team: p.team, pos: p.pos || '', sample,
    rangeLabel: range ? `최근 ${range}경기` : '전체 기간',
    dates: from && from !== to ? `${from} – ${to}` : from,
    games: use.length, abs, st: calcStats(abs),
    dirs: dirSplit(abs), types: typeMix(abs), sum: ruleSummary(abs),
  };
}

// ── 캔버스 그리기 ─────────────────────────────────────────────
function _t(c, t, x, y, w, px, fam, color, align = 'left') {
  font(c, w, px, fam); c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.fillText(t, x, y);
}
// 글자 묶음 [[글자, 굵기, 크기, 글꼴, 색]] 을 한 줄로 이어 그린다 (한글 · 숫자 글꼴 섞기). 그린 폭을 돌려준다
function _runs(c, parts, x, y, align = 'left') {
  const wd = p => { font(c, p[1], p[2], p[3]); return c.measureText(p[0]).width; };
  const tw = parts.reduce((s, p) => s + wd(p), 0);
  let cx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  parts.forEach(p => { const w = wd(p); _t(c, p[0], cx, y, p[1], p[2], p[3], p[4]); cx += w; });
  return tw;
}
// 폭을 넘으면 뒤를 잘라 … (c.font 는 미리 맞춘 상태)
function _clip(c, t, max) {
  t = String(t);
  if (c.measureText(t).width <= max) return t;
  while (t.length > 1 && c.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

// 한 글자씩 재서 줄바꿈 (띄어쓰기가 있으면 그 자리에서)
function _wrap(ctx, text, max) {
  const out = [];
  String(text).split('\n').forEach(par => {
    let line = '';
    for (const ch of par) {
      const t = line + ch;
      if (line && ctx.measureText(t).width > max) {
        const sp = line.lastIndexOf(' ');
        if (ch !== ' ' && sp > 0) { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; }
        else { out.push(line); line = ch === ' ' ? '' : ch; }
      } else line = t;
    }
    out.push(line);
  });
  return out.filter((l, i, a) => l.trim() || (i > 0 && i < a.length - 1));
}

const _rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const _mix = (a, b, t) => { const A = _rgb(a), B = _rgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
// 코스 칸 색: 이 선수 타율보다 낮으면 파랑 · 높으면 강조색 쪽 (기준과 폭은 zonefig.js 와 같다 — 색만 종이 팔레트)
function _heat(avg, base) {
  const t = Math.max(-1, Math.min(1, (avg - base) / Math.max(0.15, base)));
  return _mix(P.bg, t < 0 ? P.bb : P.acc, Math.abs(t) * 0.5);
}

// 가로 비율 막대: parts = [[개수, 바탕색, 글자색]] — 개수 0은 건너뛰고 넓은 칸에만 % 를 쓴다. 합이 0이면 점선 빈 막대
function _bar(c, x, y, w, h, parts, px) {
  const tot = parts.reduce((t, p) => t + p[0], 0);
  if (!tot) {
    c.setLineDash([6, 5]); c.strokeStyle = P.rule; c.lineWidth = 1.5;
    rr(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, h / 2); c.stroke(); c.setLineDash([]);
    return;
  }
  c.save(); rr(c, x, y, w, h, Math.min(7, h / 2)); c.clip();
  let sx = x;
  parts.forEach(([n, bg, fg]) => {
    if (!n) return;
    const pw = w * n / tot;
    c.fillStyle = bg; c.fillRect(sx, y, pw, h);
    if (pw > px * 2.8) _t(c, Math.round(n / tot * 100) + '%', sx + pw / 2, y + h / 2 + px * 0.37, '600', px, NUM, fg, 'center');
    sx += pw;
    c.fillStyle = P.bg; c.fillRect(sx - 1.5, y, 3, h);   // 칸 사이 흰 틈
  });
  c.restore();
}
// 막대 아래 글자: 왼쪽 · 가운데 · 오른쪽 — items = [[이름, 개수]] (개수 null 이면 이름만 옅게)
function _barLabels(c, x, y, w, items) {
  [['left', x], ['center', x + w / 2], ['right', x + w]].forEach(([al, px], i) => {
    const it = items[i];
    if (!it) return;
    _runs(c, it[1] == null ? [[it[0], '500', 18, KR, P.ink3]]
      : [[it[0] + ' ', '500', 18, KR, P.ink2], [String(it[1]), '600', 20, NUM, P.ink]], px, y, al);
  });
}
// 점선 빈 칸 안 안내 글자
function _emptyBar(c, x, y, w, h, msg) {
  _bar(c, x, y, w, h, []);
  _t(c, msg, x + w / 2, y + h / 2 + 6, '500', 17, KR, P.ink3, 'center');
}

// 타구 기호: 단타 = 강조색 원 · 2·3루타 = 주황 네모 · 홈런 = 진홍 마름모 · 아웃 = 빈 원
// (게임원에서 가져온 대략 위치도 예전 이미지처럼 같은 기호 — 이미지에는 점선 설명 자리가 없다)
function _mark(c, t, x, y) {
  c.save();
  if (t === 'xbh') rr(c, x - 7, y - 7, 14, 14, 2.5);
  else {
    c.beginPath();
    if (t === 'hr') { c.moveTo(x, y - 9.5); c.lineTo(x + 9.5, y); c.lineTo(x, y + 9.5); c.lineTo(x - 9.5, y); c.closePath(); }
    else c.arc(x, y, t === 'out' ? 6 : 7.5, 0, Math.PI * 2);
  }
  if (t === 'out') { c.fillStyle = P.bg; c.fill(); c.strokeStyle = P.out; c.lineWidth = 2.2; c.stroke(); }
  else { c.fillStyle = t === 'hr' ? P.hr : t === 'xbh' ? P.xbh : P.acc; c.fill(); c.strokeStyle = P.bg; c.lineWidth = 2; c.stroke(); }
  c.restore();
}

// ── 타구 방향 그림 ────────────────────────────────────────────
// 저장 좌표 → 필드 비율(core.js _fieldPos — 분석 탭 스프레이와 같은 변환 · 구장 펜스 모양) → 이 상자 px
// 각도를 파울라인 바로 안쪽으로 (batdata sprayFigure 와 같은 이유: deg 0 의 반올림 오차)
const _fpAt = (fp, deg, dist) => {
  const ang = Math.max(0.5, Math.min(179.5, deg)) * Math.PI / 180 - Math.PI;
  return fp({ x: 0.5 + Math.cos(ang) * dist, y: 1 + Math.sin(ang) * dist });
};
// 그림 상자 = 펜스 조금 밖(펜스 밖 타구 자리)부터 홈까지 — 구장마다 펜스 모양이 달라 그때그때 잰다
function _fieldBox() {
  const fp = window._fieldPos;
  if (typeof fp !== 'function') return null;
  const b = { x0: 1, x1: 0, y0: 1, y1: _fpAt(fp, 90, 0)[1] + 0.025 };
  for (let d = 0; d <= 180; d += 3) {
    const p = _fpAt(fp, d, 1.03);
    b.x0 = Math.min(b.x0, p[0]); b.x1 = Math.max(b.x1, p[0]); b.y0 = Math.min(b.y0, p[1]);
  }
  return b;
}
const _fieldH = w => { const b = _fieldBox(); return b ? w * (b.y1 - b.y0) / (b.x1 - b.x0) : w * 0.9; };
function _field(c, abs, x, y, w) {
  const fp = window._fieldPos, bx = _fieldBox();
  if (!bx) return;
  const k = w / (bx.x1 - bx.x0), h = _fieldH(w);
  const px = p => [x + (p[0] - bx.x0) * k, y + (p[1] - bx.y0) * k];
  const at = (deg, dist) => px(_fpAt(fp, deg, dist));
  const path = (pts, close) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); if (close) c.closePath(); };
  const fence = [];
  for (let d = 0; d <= 180; d += 3) fence.push(at(d, 0.97));
  const hm = at(90, 0), lp = fence[0], rp = fence[fence.length - 1], cf = at(90, 0.97);
  path([hm, ...fence], true); c.fillStyle = P.grass; c.fill();
  // 내야(장식): 홈에서 파울라인 사이 흙 부채꼴 · 안쪽 잔디 네모 · 마운드 · 베이스
  const un = p => { const dx = p[0] - hm[0], dy = p[1] - hm[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const uL = un(lp), uR = un(rp), b = Math.hypot(cf[0] - hm[0], cf[1] - hm[1]) * 0.25;
  const dia = (u, v) => [hm[0] + (uL[0] * u + uR[0] * v) * b, hm[1] + (uL[1] * u + uR[1] * v) * b];
  c.beginPath(); c.moveTo(hm[0], hm[1]); c.arc(hm[0], hm[1], b * 1.6, Math.atan2(uL[1], uL[0]), Math.atan2(uR[1], uR[0])); c.closePath();
  c.fillStyle = P.dirt; c.fill();
  path([dia(0.13, 0.13), dia(0.87, 0.13), dia(0.87, 0.87), dia(0.13, 0.87)], true); c.fillStyle = P.grass2; c.fill();
  const mo = dia(0.5, 0.5);
  c.beginPath(); c.arc(mo[0], mo[1], b * 0.11, 0, Math.PI * 2); c.fillStyle = P.dirt; c.fill();
  c.lineWidth = 1; c.strokeStyle = P.ink3; c.fillStyle = P.bg;
  [dia(1, 0), dia(1, 1), dia(0, 1)].forEach(p => {
    const s = b * 0.06;
    path([[p[0], p[1] - s], [p[0] + s, p[1]], [p[0], p[1] + s], [p[0] - s, p[1]]], true); c.fill(); c.stroke();
  });
  // 파울라인 · 펜스
  path([lp, hm, rp]); c.strokeStyle = P.chalk; c.lineWidth = 1.6; c.stroke();
  path(fence); c.lineWidth = 2.6; c.stroke();
  // 타구 (아웃 → 단타 → 장타 → 홈런 순으로 위에 쌓는다)
  const order = { out: 0, '1b': 1, xbh: 2, hr: 3 };
  const pts = abs.filter(a => a.x != null && a.y != null);
  pts.map(a => ({ a, t: a.res === '홈런' ? 'hr' : (a.res === '2루타' || a.res === '3루타') ? 'xbh' : HITS.includes(a.res) ? '1b' : 'out' }))
    .sort((p, q) => order[p.t] - order[q.t])
    .forEach(({ a, t }) => { const p = px(fp(a)); _mark(c, t, p[0], p[1]); });
  if (!pts.length) {
    font(c, '700', 20, KR);
    const tw = c.measureText('타구 위치 기록이 없어요').width + 36, cy = y + h * 0.48;
    rr(c, hm[0] - tw / 2, cy - 22, tw, 44, 22); c.fillStyle = P.bg; c.fill();
    _t(c, '타구 위치 기록이 없어요', hm[0], cy + 7, '700', 20, KR, P.ink2, 'center');
  }
  // 범례: 필드 아래 양쪽 빈 모서리에
  const leg = (t, l, lx, ly, right) => {
    font(c, '500', 18, KR);
    const tw = c.measureText(l).width, mx = right ? lx - tw - 16 : lx + 9;
    _mark(c, t, mx, ly - 6);
    _t(c, l, right ? lx : lx + 24, ly, '500', 18, KR, P.ink2, right ? 'right' : 'left');
  };
  leg('1b', '단타', x + 2, y + h - 34, false); leg('xbh', '2·3루타', x + 2, y + h - 6, false);
  leg('hr', '홈런', x + w - 2, y + h - 34, true); leg('out', '아웃', x + w - 2, y + h - 6, true);
}

// ── 코스별 타율 (스트라이크존 9칸 + 바깥 볼 4칸) ─────────────────
// 칸 숫자 · 색 기준은 zonefig.js hotColdFigure 와 같다: 칸마다 calcStats · 색 = 이 선수 타율 대비 · MIN_AB 타수 미만은 색 없음
function _zoneGeo(w) {
  const side = w * 0.112, g = 6, ax = 30, band = w * 0.1;
  const cw = (w - 2 * (side + g)) / 3, ch = cw * 0.9;
  return { side, g, ax, band, cw, ch, h: ax + band * 2 + g * 2 + ch * 3 };
}
const _zoneH = w => _zoneGeo(w).h;
function _zone(c, zs, base, x, y, w) {
  const { side, g, ax, band, cw, ch, h } = _zoneGeo(w);
  const gx = x + side + g, gy = y + ax + band + g, zw = cw * 3, zh = ch * 3, sz = w / FW;
  const zoned = Object.values(zs).reduce((n, s) => n + s.pa, 0);
  ['내각', '중앙', '외각'].forEach((t, i) => _t(c, t, gx + cw * (i + 0.5), y + 20, '700', 18, KR, P.ink2, 'center'));
  if (!zoned) {
    // 빈 상태: 옅은 칸 + 가운데 안내
    c.fillStyle = P.zebra;
    [[gx, y + ax, zw, band], [gx, gy + zh + g, zw, band], [x, gy, side, zh], [gx + zw + g, gy, side, zh]].forEach(b => { rr(c, ...b, 8); c.fill(); });
    c.strokeStyle = P.rule2; c.lineWidth = 1.5;
    for (let i = 0; i <= 3; i++) {
      c.beginPath(); c.moveTo(gx + cw * i, gy); c.lineTo(gx + cw * i, gy + zh); c.stroke();
      c.beginPath(); c.moveTo(gx, gy + ch * i); c.lineTo(gx + zw, gy + ch * i); c.stroke();
    }
    font(c, '700', 20, KR);
    const tw = c.measureText('코스(존) 기록이 없어요').width + 40;
    rr(c, x + w / 2 - tw / 2, gy + zh / 2 - 40, tw, 80, 16); c.fillStyle = P.bg; c.fill();
    _t(c, '코스(존) 기록이 없어요', x + w / 2, gy + zh / 2 - 6, '700', 20, KR, P.ink2, 'center');
    _t(c, '코스를 기록하면 칸이 채워져요', x + w / 2, gy + zh / 2 + 24, '500', 16, KR, P.ink3, 'center');
    return h;
  }
  // 바깥 볼 칸: 옅은 바탕만 · 기록이 있을 때만 숫자
  const ball = (z, bx, by, bw, bh, vert) => {
    const s = zs[z], on = s.ab >= MIN_AB;
    rr(c, bx, by, bw, bh, 8); c.fillStyle = on ? _heat(s.avg, base) : P.zebra; c.fill();
    const cx = bx + bw / 2, cy = by + bh / 2;
    if (!s.pa) { _t(c, z, cx, cy + 6, '500', 16, KR, P.ink3, 'center'); return; }
    const main = s.ab ? f3(s.avg) : '—';
    if (!vert) {
      _runs(c, [[z + '  ', '500', 16, KR, P.ink2], [main, '600', 22 * sz, NUM, P.ink], [`  ${s.h}/${s.ab} · ${s.pa}타석`, '500', 15, KR, P.ink2]], cx, cy + 7, 'center');
    } else {
      _t(c, z, cx, cy - 34, '500', 15, KR, P.ink2, 'center');
      _t(c, main, cx, cy + 2, '600', 20 * sz, NUM, P.ink, 'center');
      _t(c, `${s.h}/${s.ab}`, cx, cy + 26, '500', 16, NUM, P.ink2, 'center');
      _t(c, `${s.pa}타석`, cx, cy + 46, '500', 14, KR, P.ink2, 'center');
    }
  };
  ball('볼 위', gx, y + ax, zw, band, false);
  ball('볼 아래', gx, gy + zh + g, zw, band, false);
  ball('볼 내', x, gy, side, zh, true);
  ball('볼 외', gx + zw + g, gy, side, zh, true);
  // 9칸
  ZONES_9.forEach((z, i) => {
    const s = zs[z], on = s.ab >= MIN_AB, cx = gx + cw * (i % 3), cy = gy + ch * Math.floor(i / 3);
    c.fillStyle = on ? _heat(s.avg, base) : P.bg; c.fillRect(cx, cy, cw, ch);
    if (!s.pa) { _t(c, '—', cx + cw / 2, cy + ch / 2 + 8, '500', 24 * sz, NUM, P.rule, 'center'); return; }
    _t(c, s.ab ? f3(s.avg) : '—', cx + cw / 2, cy + ch * 0.52, '600', 32 * sz, NUM, on ? P.ink : P.ink2, 'center');
    _t(c, `${s.h}/${s.ab} · ${s.pa}타석`, cx + cw / 2, cy + ch * 0.8, '500', 15 * Math.max(sz, 0.9), KR, P.ink2, 'center');
  });
  c.strokeStyle = P.rule; c.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) {
    c.beginPath(); c.moveTo(gx + cw * i, gy); c.lineTo(gx + cw * i, gy + zh); c.stroke();
    c.beginPath(); c.moveTo(gx, gy + ch * i); c.lineTo(gx + zw, gy + ch * i); c.stroke();
  }
  c.strokeStyle = P.ink; c.lineWidth = 3; c.strokeRect(gx, gy, zw, zh);
  return h;
}

// ── 한 장 그리기 ──────────────────────────────────────────────
// 위에서부터: 머리(로고 · 이름 · 팀 · 기간) → 표본 안내 → 큰 숫자 4칸 → 기록 줄 → 요약 → 그림 2칸 → 타구 유형 → 코치 코멘트 → 바닥
// 빈 띠가 생기지 않게: 남는 높이는 숫자 칸 · 블록 사이 간격에 나누고, 모자라면 간격 → 그림 크기 순으로 줄인다
function _draw(c, R) {
  const s = R.st, smp = sampleBadge(s.pa), fy = H - 122;   // fy = 바닥 선
  c.fillStyle = P.bg; c.fillRect(0, 0, W, H);

  // 1. 머리: 로고 · PLAYER REPORT (· 샘플 표시)
  wordmark(c, M, 76, 30, P.ink, P.acc);
  spacing(c, 4);
  font(c, '600', 22, NUM);
  const lbW = c.measureText('PLAYER REPORT').width;
  _t(c, 'PLAYER REPORT', W - M + 4, 74, '600', 22, NUM, P.ink2, 'right');
  spacing(c, 0);
  if (R.sample) {
    const parts = [['SAMPLE', '600', 18, NUM, P.acc], [' · 가상 선수', '700', 18, KR, P.acc]];
    const pw = parts.reduce((n, p) => { font(c, p[1], p[2], p[3]); return n + c.measureText(p[0]).width; }, 0) + 32;
    const px = W - M - lbW - 22 - pw;
    rr(c, px, 50, pw, 34, 17); c.strokeStyle = P.acc; c.lineWidth = 1.5; c.stroke();
    _runs(c, parts, px + 16, 73);
  }
  c.fillStyle = P.band; c.fillRect(M, 98, CW, 3);

  // 이름 + 등번호 (긴 이름은 줄여서 한 줄)
  const nameY = 218;
  let numZ = 0, numW = 0;
  if (R.num) { numZ = 76; font(c, '600', numZ, NUM); numW = c.measureText('#' + R.num).width + 26; }
  const nz = fitFont(c, R.name, '900', 108, KR, CW - numW, 60);
  const name = _clip(c, R.name, CW - numW);
  _t(c, name, M, nameY, '900', nz, KR, P.ink);
  font(c, '900', nz, KR);
  const nw = c.measureText(name).width;
  if (R.num) _t(c, '#' + R.num, M + nw + 22, nameY, '600', Math.min(numZ, nz * 0.8), NUM, P.acc);
  let y = nameY;
  // 팀 · 포지션 (포지션은 라인업에 적었을 때만)
  if (R.team || R.pos) {
    y += 56;
    font(c, '700', 30, KR);
    const pos = R.pos ? '  ·  ' + R.pos : '';
    const team = _clip(c, R.team || '', CW - c.measureText(pos).width);
    _runs(c, [[team, '700', 30, KR, P.ink], [team ? pos : R.pos, '700', 30, KR, P.ink2]], M, y);
  }
  // 기간 칩 · 날짜 · 경기 수
  y += 54;
  font(c, '700', 22, KR);
  const chipW = c.measureText(R.rangeLabel).width + 28;
  rr(c, M, y - 28, chipW, 38, 19); c.fillStyle = P.fill; c.fill();
  _t(c, R.rangeLabel, M + 14, y - 2, '700', 22, KR, P.ink);
  _runs(c, [...(R.dates ? [[R.dates, '500', 24, NUM, P.ink2], ['   ·   ', '500', 22, KR, P.ink3]] : []),
    [`${R.games}경기 ${s.pa}타석`, '500', 24, KR, P.ink2]], M + chipW + 16, y);
  const headEnd = y + 16;

  // 2. 높이 나누기
  const cmt = String(R.cmt || '').trim();
  font(c, '500', 30, KR);
  let lines = cmt ? _wrap(c, cmt, CW - 64) : [];
  if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] = lines[2].replace(/.$/, '…'); }
  const noteH = smp ? 50 : 0, metH = 80, sumH = 64, typeH = 110, cmtH = lines.length ? 92 + lines.length * 46 : 0;
  const zs = Object.create(null);
  [...ZONES_9, ...ZONE_BALL].forEach(z => { zs[z] = calcStats(R.abs.filter(a => zoneOf(a) === z)); });
  const BARS = 124, LEG = 96;
  const chartH = sc => 74 + Math.max(_fieldH(FW * sc) + 18 + BARS, _zoneH(FW * sc) + 18 + LEG) + 24;
  let tileH = 160, stripH = 100, gap = 26, sc = 1;
  const nGap = 5 + (noteH ? 1 : 0) + (cmtH ? 1 : 0);
  const fixed = () => noteH + tileH + 14 + stripH + metH + sumH + typeH + cmtH;
  let free = fy - headEnd - fixed() - chartH(1) - nGap * gap;
  if (free < 0) { gap = Math.max(14, gap + free / nGap); free = fy - headEnd - fixed() - chartH(1) - nGap * gap; }
  while (free < 0 && sc > 0.7) { sc -= 0.01; free = fy - headEnd - fixed() - chartH(sc) - nGap * gap; }
  if (free > 0) {
    const t1 = Math.min(free * 0.25, 24), t2 = Math.min(free * 0.1, 12);
    tileH += t1; stripH += t2; gap += (free - t1 - t2) / nGap;
  }
  y = headEnd + gap;

  // 3. 표본 안내 (가는 띠)
  if (smp) {
    rr(c, M, y, CW, noteH, 12); c.fillStyle = P.fill; c.fill();
    c.beginPath(); c.arc(M + 28, y + 25, 11, 0, Math.PI * 2); c.fillStyle = P.ink2; c.fill();
    _t(c, '!', M + 28, y + 31, '700', 16, NUM, P.bg, 'center');
    _runs(c, [[smp.cls === 'low' ? '표본이 매우 적어 참고용이에요' : '표본이 적어 참고용이에요', '700', 22, KR, P.ink],
      [`  ·  ${s.pa}타석 기준`, '500', 22, KR, P.ink2]], M + 52, y + 33);
    y += noteH + gap;
  }

  // 4. 큰 숫자 4칸 — 타율·장타율은 타수가 0이면(볼넷·사구·희생만) 계산할 수 없으므로 '—'
  const tiles = [['타율', 'AVG', s.avg, s.ab], ['출루율', 'OBP', s.obp, s.pa], ['장타율', 'SLG', s.slg, s.ab], ['OPS', 'OPS', s.ops, s.pa]];
  const tw = (CW - 14 * 3) / 4;
  const vz = Math.min(...tiles.map(([, , v, n]) => fitFont(c, n ? f3(v) : '—', '600', 96, NUM, tw - 40, 50)));
  tiles.forEach(([l, en, v, n], i) => {
    const x = M + i * (tw + 14);
    rr(c, x, y, tw, tileH, 14); c.fillStyle = P.zebra; c.fill(); c.strokeStyle = P.rule2; c.lineWidth = 1.5; c.stroke();
    _t(c, l, x + 20, y + 44, '700', 24, KR, P.ink);
    if (en !== l) { spacing(c, 2); _t(c, en, x + tw - 18, y + 42, '500', 18, NUM, P.ink3, 'right'); spacing(c, 0); }
    _t(c, n ? f3(v) : '—', x + 18, y + tileH - 24, '600', vz, NUM, i === 3 ? P.acc : P.ink);
  });
  y += tileH + 14;

  // 기록 줄 (색 점 = 이미지 공통 색: 안타 · 장타 · 홈런 · 볼넷 · 아웃)
  const cnt = [['타석', s.pa], ['안타', s.h, P.acc], ['2루타', s.s2, P.xbh], ['3루타', s.s3, P.xbh], ['홈런', s.hr, P.hr], ['타점', s.rbi], ['볼넷', s.bb, P.bb], ['삼진', s.k, P.out]];
  const cw = CW / cnt.length;
  c.fillStyle = P.ink; c.fillRect(M, y, CW, 2);
  c.fillStyle = P.rule; c.fillRect(M, y + stripH - 1, CW, 1);
  cnt.forEach(([l, v, dot], i) => {
    const x = M + i * cw, cx = x + cw / 2;
    if (i) { c.fillStyle = P.rule2; c.fillRect(x, y + 18, 1.5, stripH - 36); }
    font(c, '500', 21, KR);
    const lw = c.measureText(l).width + (dot ? 16 : 0);
    if (dot) { c.beginPath(); c.arc(cx - lw / 2 + 5, y + 30, 5, 0, Math.PI * 2); c.fillStyle = dot; c.fill(); }
    _t(c, l, cx - lw / 2 + (dot ? 16 : 0), y + 37, '500', 21, KR, P.ink2);
    _t(c, String(v), cx, y + stripH - 18, '600', 46, NUM, P.ink, 'center');
  });
  y += stripH;
  // 작은 줄: wOBA · 삼진% · 볼넷%
  const sep = ['    ·    ', '500', 24, KR, P.rule];
  _runs(c, [['wOBA  ', '500', 22, NUM, P.ink2], [s.pa ? f3(s.woba) : '—', '600', 32, NUM, P.ink], sep,
    ['삼진%  ', '500', 22, KR, P.ink2], [s.pa ? pct(s.kRate) : '—', '600', 32, NUM, P.ink], sep,
    ['볼넷%  ', '500', 22, KR, P.ink2], [s.pa ? pct(s.bbRate) : '—', '600', 32, NUM, P.ink]], W / 2, y + 44, 'center');
  _t(c, 'wOBA = 볼넷·단타·장타의 가치를 한 숫자로 합친 출루 지표', W / 2, y + 74, '500', 18, KR, P.ink3, 'center');
  y += metH + gap;

  // 5. 한 줄 요약 (규칙 기반 · AI 아님) — 근거 개수는 오른쪽에 작게, 자리가 모자라면 뺀다
  rr(c, M, y, CW, sumH, 14); c.strokeStyle = P.rule; c.lineWidth = 1.5; c.stroke();
  rr(c, M + 14, y + 14, 66, 36, 18); c.fillStyle = P.acc; c.fill();
  _t(c, '요약', M + 47, y + 39, '700', 20, KR, P.bg, 'center');
  font(c, '700', 28, KR);
  const sumT = _clip(c, R.sum.text, CW - 96 - 24);
  _t(c, sumT, M + 96, y + 42, '700', 28, KR, P.ink);
  const sw0 = c.measureText(sumT).width;
  font(c, '500', 18, KR);
  if (R.sum.detail && M + 96 + sw0 + 28 + c.measureText(R.sum.detail).width <= W - M - 20) _t(c, R.sum.detail, W - M - 20, y + 40, '500', 18, KR, P.ink3, 'right');
  y += sumH + gap;

  // 6. 그림 2칸: 타구 방향 | 코스별 타율 — 설명 줄은 칸 아래쪽에 맞춘다
  const chH = chartH(sc), x1 = M, x2 = M + PW + 20, fw = FW * sc;
  [x1, x2].forEach(px => { rr(c, px, y, PW, chH, 16); c.strokeStyle = P.rule2; c.lineWidth = 1.5; c.stroke(); });
  const nPts = R.abs.filter(a => a.x != null && a.y != null).length;
  const zoned = Object.values(zs).reduce((n, z) => n + z.pa, 0);
  _t(c, '타구 방향', x1 + 24, y + 50, '700', 30, KR, P.ink);
  _t(c, `타구 ${nPts}개`, x1 + PW - 24, y + 48, '500', 18, KR, P.ink3, 'right');
  _t(c, '코스별 타율', x2 + 24, y + 50, '700', 30, KR, P.ink);
  if (zoned) _t(c, `코스 기록 ${zoned}/${s.pa}타석`, x2 + PW - 24, y + 48, '500', 18, KR, P.ink3, 'right');
  // 두 칸 높이는 같다 → 낮은 쪽 그림은 남는 높이만큼 키운다 (칸 폭까지)
  const ffw = Math.min(FW, fw * (chH - 98 - 18 - BARS) / _fieldH(fw)), zfw = Math.min(FW, fw * (chH - 98 - 18 - LEG) / _zoneH(fw));
  _field(c, R.abs, x1 + (PW - ffw) / 2, y + 74, ffw);
  _zone(c, zs, s.avg, x2 + (PW - zfw) / 2, y + 74 + (zoned ? 0 : (chH - 98 - _zoneH(zfw)) / 2), zfw);   // 기록이 없으면 칸 가운데에
  // 당김·센터·밀어(타자 기준) · 좌·중·우(필드 기준 — 좌·우타에 따라 뒤집히지 않는 방향)
  const bx = x1 + 20, bw = PW - 40, dn = s.dn || 0, dsp = R.dirs;
  let by = y + chH - 24 - BARS;
  if (dn) {
    _bar(c, bx, by, bw, 26, [[s.pull, P.ink, P.bg], [s.center, P.ink2, P.bg], [s.oppo, P.ink3, P.ink]], 18);
    _barLabels(c, bx, by + 52, bw, [['당김', s.pull], ['센터', s.center], ['밀어', s.oppo]]);
  } else _emptyBar(c, bx, by, bw, 26, '방향 기록 없음');
  by += 70;
  if (dsp.n) {
    _bar(c, bx, by, bw, 22, [[dsp.left, P.ink, P.bg], [dsp.center, P.ink2, P.bg], [dsp.right, P.ink3, P.ink]], 16);
    _barLabels(c, bx, by + 48, bw, [['좌', dsp.left], ['중', dsp.center], ['우', dsp.right]]);
  } else _emptyBar(c, bx, by, bw, 22, '필드 기준 좌·중·우 기록 없음');
  // 색 범례 · 읽는 법
  if (zoned) {
    const ly = y + chH - 24 - LEG, gw = 170, gx = x2 + (PW - gw) / 2;
    const grd = c.createLinearGradient(gx, 0, gx + gw, 0);
    grd.addColorStop(0, _mix(P.bg, P.bb, 0.5)); grd.addColorStop(0.5, P.bg); grd.addColorStop(1, _mix(P.bg, P.acc, 0.5));
    rr(c, gx, ly + 6, gw, 14, 7); c.fillStyle = grd; c.fill(); c.strokeStyle = P.rule; c.lineWidth = 1; c.stroke();
    _t(c, '약함', gx - 12, ly + 20, '700', 18, KR, P.bb, 'right');
    _t(c, '강함', gx + gw + 12, ly + 20, '700', 18, KR, P.acc);
    const n1 = `칸 숫자 = 그 코스 타율 · ${MIN_AB}타수 미만은 색 없음`, n2 = `색 = 이 선수 타율(${s.ab ? f3(s.avg) : '—'}) 대비`;
    _t(c, n1, x2 + PW / 2, ly + 58, '500', fitFont(c, n1, '500', 18, KR, PW - 40, 14), KR, P.ink3, 'center');
    _t(c, n2, x2 + PW / 2, ly + 86, '500', 18, KR, P.ink3, 'center');
  }
  y += chH + gap;

  // 7. 타구 유형: 입력한 타구 유형이 있으면 그것으로, 없으면 아웃 타구(땅볼·플라이)만으로. 안타는 짐작해서 넣지 않는다
  const tm = R.types;
  rr(c, M, y, CW, typeH, 16); c.strokeStyle = P.rule2; c.lineWidth = 1.5; c.stroke();
  _t(c, '타구 유형', M + 24, y + 50, '700', 30, KR, P.ink);
  if (tm.n) _t(c, tm.basis === 'launch' ? `입력 ${tm.n}개 기준` : `아웃 타구 ${tm.n}개 기준`, M + 24, y + 84, '500', 18, KR, P.ink3);
  const tx = M + 250, tbw = CW - 250 - 24;
  if (tm.n >= MIN_TYPE) {
    const parts = [[tm.ground, P.ink, P.bg]];
    if (tm.line != null) parts.push([tm.line, P.ink2, P.bg]);
    parts.push([tm.fly, P.ink3, P.ink]);
    _bar(c, tx, y + 26, tbw, 28, parts, 18);
    _barLabels(c, tx, y + 84, tbw, [['땅볼', tm.ground], tm.line != null ? ['라인드라이브', tm.line] : ['라인드라이브 미입력', null], ['뜬공', tm.fly]]);
  } else {
    _emptyBar(c, tx, y + 26, tbw, 28, tm.basis === 'launch' || !tm.n ? '타구 유형 기록이 적어요' : `아웃 타구 ${tm.n}개 — 유형 기록이 적어요`);
  }
  y += typeH + gap;

  // 8. 코치 코멘트 (3줄까지)
  if (cmtH) {
    rr(c, M, y, CW, cmtH, 16); c.fillStyle = P.zebra; c.fill();
    c.save(); rr(c, M, y, CW, cmtH, 16); c.clip(); c.fillStyle = P.acc; c.fillRect(M, y, 6, cmtH); c.restore();
    _t(c, '코치 코멘트', M + 32, y + 46, '700', 22, KR, P.acc);
    lines.forEach((l, i) => _t(c, l, M + 32, y + 94 + i * 46, '500', 30, KR, P.ink));
  }

  // 9. 바닥: 로고 · 주소 / 생성일 (· 샘플 표시)
  c.fillStyle = P.rule; c.fillRect(M, fy, CW, 1.5);
  wordmark(c, M, fy + 50, 26, P.ink, P.acc);
  _runs(c, [['생성  ', '500', 20, KR, P.ink2], [_ymd(Date.now(), true), '500', 22, NUM, P.ink]], W - M, fy + 49, 'right');
  _t(c, 'kimjeongcheol13.github.io/baseball-spray-chart', M, fy + 86, '500', 18, KR, P.ink3);
  if (R.sample) _t(c, '샘플 · 실제 기록 아님', W - M, fy + 86, '700', 18, KR, P.acc, 'right');
}

// ── 상태 · 화면 ───────────────────────────────────────────────
const S = { sample: false, key: null, range: DEF_RANGE, cmt: '' };
let _games = [], _players = [], _sampleP = null, _sampleG = null;
let _canvas = null, _seq = 0, _ready = false, _cmtTimer = 0, _returnFocus = null;

function _cmtRead() {
  try { return JSON.parse(localStorage.getItem(CMT_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function _cmtWrite(key, text) {
  try {
    const all = _cmtRead();
    if (text) all[key] = text; else delete all[key];
    localStorage.setItem(CMT_KEY, JSON.stringify(all));
  } catch (e) {}
}

function _mount() {
  if ($('rpView')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div id="rpView" class="rp" role="dialog" aria-modal="true" aria-labelledby="rpTitle" hidden>
  <div class="rp-panel">
    <header class="rp-hd">
      <h2 id="rpTitle">선수 리포트</h2>
      <button type="button" class="rp-x" id="rpClose" aria-label="닫기">✕</button>
    </header>
    <div class="rp-body" id="rpBody">
      <div class="rp-sample-note" id="rpSampleNote" hidden>
        <b>SAMPLE</b> 가상 선수로 만든 미리보기예요. 내 기록에는 저장되지 않아요.
        <button type="button" class="rp-link" id="rpToMine" hidden>내 기록으로 만들기</button>
      </div>
      <div class="rp-empty" id="rpEmpty" hidden>
        <b>아직 기록된 타석이 없어요</b>
        <span>기록 탭에서 타석 결과를 입력하면 선수 리포트를 만들 수 있어요.</span>
        <button type="button" class="rp-btn" id="rpTrySample">샘플로 미리보기</button>
      </div>
      <div id="rpForm">
        <div class="rp-field" id="rpPlayerField">
          <label for="rpPlayer">선수</label>
          <select id="rpPlayer" class="rp-select"></select>
          <small class="rp-help" id="rpPlayerHelp"></small>
        </div>
        <div class="rp-field">
          <span class="rp-lbl" id="rpRangeLbl">기간</span>
          <div class="rp-seg" id="rpRange" role="radiogroup" aria-labelledby="rpRangeLbl">
            ${RANGES.map(n => `<button type="button" role="radio" data-n="${n}">${n ? `최근 ${n}경기` : '전체'}</button>`).join('')}
          </div>
        </div>
        <div class="rp-field">
          <label for="rpCmt">코치 코멘트 <small>(선택 · 3줄까지)</small></label>
          <textarea id="rpCmt" class="rp-cmt" rows="3" maxlength="${CMT_MAX}" placeholder="예) 타구 방향이 좋아졌어요. 다음 주엔 변화구 대처를 연습합니다."></textarea>
          <small class="rp-help" id="rpCmtN"></small>
        </div>
        <figure class="rp-prev">
          <div class="rp-prev-box"><img id="rpImg" alt=""><span class="rp-loading" id="rpLoading">리포트 그리는 중…</span></div>
          <figcaption class="rp-help">저장·공유가 안 되는 브라우저(카톡 안 등)에서는 위 이미지를 길게 눌러 저장하세요.</figcaption>
        </figure>
      </div>
    </div>
    <footer class="rp-act" id="rpAct">
      <button type="button" class="rp-btn primary" id="rpSave" disabled>이미지 저장 · 공유</button>
      <button type="button" class="rp-btn" id="rpPrint" disabled>인쇄 / PDF</button>
    </footer>
  </div>
</div>`);

  $('rpClose').onclick = closePlayerReport;
  $('rpView').addEventListener('click', e => { if (e.target.id === 'rpView') closePlayerReport(); });
  $('rpView').addEventListener('keydown', e => { if (e.key === 'Escape') closePlayerReport(); });
  $('rpPlayer').onchange = e => { S.key = e.target.value; _loadCmt(); _render(); };
  $('rpRange').onclick = e => {
    const b = e.target.closest('button[data-n]');
    if (!b) return;
    S.range = +b.dataset.n;
    _syncRange();
    _render();
  };
  $('rpCmt').addEventListener('input', e => {
    // 3줄까지만
    const v = e.target.value.split('\n').slice(0, 3).join('\n');
    if (v !== e.target.value) e.target.value = v;
    S.cmt = v;
    _cmtCount();
    if (!S.sample && S.key) _cmtWrite(S.key, v.trim());
    clearTimeout(_cmtTimer);
    _cmtTimer = setTimeout(_render, 350);
  });
  $('rpSave').onclick = _save;
  $('rpPrint').onclick = _print;
  $('rpTrySample').onclick = () => { _track('sample'); _open({ sample: true }); };
  $('rpToMine').onclick = () => _open({});
}

function _syncRange() {
  $('rpRange').querySelectorAll('button').forEach(b => {
    const on = +b.dataset.n === S.range;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}
function _cmtCount() { $('rpCmtN').textContent = `${S.cmt.length}/${CMT_MAX}자`; }
function _loadCmt() {
  S.cmt = S.sample ? SAMPLE_CMT : (_cmtRead()[S.key] || '');
  $('rpCmt').value = S.cmt;
  _cmtCount();
}

function _playerLabel(p) {
  return `${p.name}${p.num ? ' #' + p.num : p.split ? ' (번호 없음)' : ''} · ${p.items.length}타석`;
}

// opts: { sample } | { name } (프로필에서 선수 지정) | {}
function _open(opts) {
  _mount();
  S.sample = !!opts.sample;
  if (S.sample) {
    if (!_sampleG) { _sampleG = _sampleGames(); _sampleP = _groupPlayers(_sampleG)[0]; }
  } else {
    const data = buildData();
    _games = data.games;
    _players = _groupPlayers(_games);
    if (opts.name) {
      const hit = _players.find(p => p.name === opts.name);   // 같은 이름이 여럿이면 타석 많은 쪽 (정렬 순)
      if (hit) S.key = hit.key;
    }
    if (!_players.some(p => p.key === S.key)) S.key = _players[0] ? _players[0].key : null;
  }
  S.range = DEF_RANGE;
  _syncRange();

  const hasData = S.sample || _players.length > 0;
  $('rpSampleNote').hidden = !S.sample;
  $('rpToMine').hidden = !(S.sample && _hasMine());
  $('rpEmpty').hidden = hasData;
  $('rpForm').hidden = !hasData;
  $('rpPlayerField').hidden = S.sample;
  $('rpAct').hidden = !hasData;
  if (!S.sample) _fillPlayers();
  _loadCmt();

  const v = $('rpView');
  if (v.hidden) {
    _returnFocus = document.activeElement;
    v.hidden = false;
    document.documentElement.classList.add('rp-open');
  }
  $('rpBody').scrollTop = 0;
  setTimeout(() => { try { $('rpClose').focus(); } catch (e) {} }, 30);
  if (hasData) _render();
}

function _hasMine() {
  try { if ((window.AS && window.AS.abs || []).length) return true; return JSON.parse(localStorage.getItem('sl_saves') || '[]').length > 0; } catch (e) { return false; }
}

function _fillPlayers() {
  // 팀별 묶음 (팀 순서 = 그 팀 타석 합계 많은 순)
  // 팀명은 선수 묶기와 같은 기준(띄어쓰기 무시)으로 모으고, 이름표는 가장 최근 경기의 표기
  const teams = Object.create(null), label = Object.create(null);
  _players.forEach(p => {
    const t = _norm(p.team);
    (teams[t] = teams[t] || []).push(p);
    if (!label[t] || p.last > label[t].last) label[t] = { last: p.last, name: p.team || '팀명 없음' };
  });
  const order = Object.keys(teams).sort((a, b) =>
    teams[b].reduce((n, p) => n + p.items.length, 0) - teams[a].reduce((n, p) => n + p.items.length, 0));
  $('rpPlayer').innerHTML = order.map(t => `<optgroup label="${_e(label[t].name)}">${teams[t].map(p =>
    `<option value="${_e(p.key)}"${p.key === S.key ? ' selected' : ''}>${_e(_playerLabel(p))}</option>`).join('')}</optgroup>`).join('');
  const splitN = _players.filter(p => p.split).length;
  $('rpPlayerHelp').textContent = '같은 팀·같은 이름은 한 선수로 묶어요.' + (splitN ? ' 한 경기에 동명이인이 함께 있던 팀은 등번호로 나눴어요.' : '');
}

function _current() {
  if (S.sample) return { p: _sampleP, games: _sampleG };
  return { p: _players.find(x => x.key === S.key), games: _games };
}

async function _render() {
  const seq = ++_seq;
  const { p, games } = _current();
  if (!p) return;
  _ready = false;
  $('rpSave').disabled = true; $('rpPrint').disabled = true;
  $('rpLoading').hidden = false;
  const R = _reportData(p, games, S.range, S.sample);
  R.cmt = S.cmt;

  // 한 번 그려 쓰인 글자의 웹폰트 묶음을 받은 뒤 다시 그린다 (imgkit drawWithFonts). 오프라인이면 기본 글꼴로 그린다
  // 그릴 때마다 새 캔버스: 앞선 그리기가 글꼴을 기다렸다 늦게 다시 그려도 저장할 캔버스(_canvas)를 덮지 않는다
  const cv = document.createElement('canvas');
  await drawWithFonts(cv, () => { cv.width = W; cv.height = H; _draw(cv.getContext('2d'), R); });
  if (seq !== _seq) return;
  let url = '';
  try { url = cv.toDataURL('image/png'); } catch (e) { url = ''; }
  _canvas = cv;
  const img = $('rpImg');
  img.src = url;
  img.alt = `${R.name} 선수 리포트 — ${R.rangeLabel} ${R.games}경기 ${R.st.pa}타석, 타율 ${f3(R.st.avg)} 출루율 ${f3(R.st.obp)} 장타율 ${f3(R.st.slg)}`;
  $('rpLoading').hidden = !!url;
  if (!url) $('rpLoading').textContent = '이 브라우저에서는 리포트 이미지를 만들 수 없어요.';
  _ready = !!url;
  $('rpSave').disabled = !_ready; $('rpPrint').disabled = !_ready;
}

// 파일명은 영문만: 한글 파일명을 버리고 'download'로 저장하는 브라우저가 있다
function _fileName() {
  const d = new Date(), p2 = v => String(v).padStart(2, '0');
  return `SprayLab_report${S.sample ? '_SAMPLE' : ''}_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.png`;
}

function _save() {
  if (!_ready || !_canvas) return;
  _track(S.sample ? 'save_sample' : 'save');
  const name = _fileName();
  const fallback = blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  try {
    _canvas.toBlob(blob => {
      if (!blob) return;
      let file = null;
      try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
      if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: '선수 리포트' }).catch(err => { if (!err || err.name !== 'AbortError') fallback(blob); });
      } else fallback(blob);
    }, 'image/png');
  } catch (e) {
    if (window.showToast) window.showToast('이미지를 저장하지 못했어요 — 미리보기를 길게 눌러 저장하세요', false);
  }
}

function _print() {
  if (!_ready) return;
  _track(S.sample ? 'print_sample' : 'print');
  const b = document.body;
  const off = () => { b.classList.remove('rp-printing'); window.removeEventListener('afterprint', off); };
  b.classList.add('rp-printing');
  window.addEventListener('afterprint', off);
  window.print();
}

export function openPlayerReport(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  _track(o.sample ? 'open_sample' : 'open');
  _open(o);
}

export function closePlayerReport() {
  const v = $('rpView');
  if (!v || v.hidden) return;
  v.hidden = true;
  document.documentElement.classList.remove('rp-open');
  _seq++;
  if (_returnFocus && _returnFocus.focus) { try { _returnFocus.focus(); } catch (e) {} }
}

// ── 모바일 첫 진입: 모바일은 랜딩을 건너뛰고 바로 기록 화면으로 가므로(core.js autoSkipLanding)
// 첫 사용 말풍선이 보이는 동안만 필드 아래에 샘플 리포트 링크를 둔다. 말풍선 갱신 함수를 감싸 같은 조건으로 켜고 끈다 (core.js 수정 없음)
function _ftuLink() {
  const wrap = document.querySelector('#cwrap') && document.querySelector('#cwrap').closest('.field-wrap');
  if (!wrap) return;
  let el = $('rpFtuLink');
  if (!el) {
    wrap.insertAdjacentHTML('afterend', '<button type="button" id="rpFtuLink" class="rp-ftu" hidden>샘플 선수 리포트 미리보기 →</button>');
    el = $('rpFtuLink');
    el.onclick = () => openPlayerReport({ sample: true });
  }
  let first = false;
  try { first = typeof window._isFirstUse === 'function' && window._isFirstUse(); } catch (e) {}
  el.hidden = !first;
}
document.addEventListener('DOMContentLoaded', () => {
  const orig = window.updateFieldTapHint;
  if (typeof orig !== 'function') return;
  window.updateFieldTapHint = function () {
    const r = orig.apply(this, arguments);
    try { _ftuLink(); } catch (e) {}
    return r;
  };
  _ftuLink();
});

if (typeof window !== 'undefined') {
  window.openPlayerReport = openPlayerReport;
  window.closePlayerReport = closePlayerReport;
}
