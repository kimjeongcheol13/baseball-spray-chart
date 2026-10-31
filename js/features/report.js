// 선수 리포트 — 학부모 공유용 세로 이미지(1080×1920, 9:16)
// 선수 → 기간 → 코치 코멘트 → PNG 저장·공유 / 인쇄(PDF)
// 계산은 기존 것을 그대로 쓴다: calcStats(batdata.js) · 코스 = zoneOf(zonefig.js) · 필드 좌표 = window._fieldPos(core.js)
// 그림은 캔버스에 직접 그린다 (이미지 공통 키트 imgkit.js — 흰 종이 PAPER · Noto Sans KR · Oswald)
// 저장 경기는 읽기만 한다. 새로 쓰는 키는 sl_report_cmt(선수별 마지막 코치 코멘트, 이 기기에만 · 동기화 안 함) 하나뿐
import { buildData, calcStats, f3, pct, sampleBadge } from './batdata.js?v=9';
import { zoneOf } from './zonefig.js?v=7';
import { HITS, ZONES_9 } from '../constants.js';
import { FONT, DARK as D, font, fitFont, rr, wordmark, drawWithFonts, dCard, dPill, tint } from './imgkit.js?v=3';

const CMT_KEY = 'sl_report_cmt';
const CMT_MAX = 80;           // 코멘트 최대 글자 (3줄 안쪽)
const RANGES = [1, 3, 5, 10, 0];   // 최근 N경기 · 0 = 전체
const DEF_RANGE = 5;

// 캔버스 — 어두운 카드형(imgkit DARK · 분석 화면 · 성적 카드와 같은 색). 글꼴은 둘만: 한글 = Noto Sans KR · 숫자/영문 라벨 = Oswald
const W = 1080, H = 1920, X = 40, CW = W - X * 2, PAD = 32;   // 카드 바깥 여백 · 카드 안 여백
const FIELD = 'rgba(255,255,255,0.035)', ZONE_LINE = 'rgba(244,246,250,0.6)';   // 구장 페어 지역 · 존 테두리
const KR = FONT.kr, NUM = FONT.num;
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
// 코스 칸 색: 이 선수 타율보다 낮으면 파랑 · 높으면 주황 쪽 (기준과 폭은 zonefig.js 와 같다 — 색만 어두운 카드 팔레트)
function _heat(avg, base) {
  const t = Math.max(-1, Math.min(1, (avg - base) / Math.max(0.15, base)));
  return _mix(D.card, t < 0 ? D.bb : D.acc, Math.abs(t) * 0.45);
}

// 카드: imgkit 카드(540 기준 · 모서리 20)를 2배로 — 이 이미지는 1080 그대로 그린다(글자 26px 이상 = 성적 카드 13px × 2)
const _card = (c, x, y, w, h, glow) => { c.save(); c.scale(2, 2); dCard(c, x / 2, y / 2, w / 2, h / 2, glow); c.restore(); };
// 카드 머리: 제목(왼쪽) · 설명(오른쪽, 흐리게) — y = 기준선
function _title(c, t, x, y, meta, right) {
  _t(c, t, x, y, '700', 30, KR, D.tx);
  if (meta) _t(c, meta, right, y, '500', 26, KR, D.tx3, 'right');
}

// 타구 기호 (성적 카드와 같은 Statcast 식): 색 점 + 카드색 테 · 아웃 = 회색 빈 고리 · 홈런 = 조금 큰 점 + 바깥 가는 고리
// (게임원에서 가져온 대략 위치도 예전 이미지처럼 같은 기호 — 이미지에는 점선 설명 자리가 없다)
const MARK = { '1b': D.hit, xbh: D.xbh, hr: D.hr }, TAU = Math.PI * 2;
function _mark(c, t, x, y) {
  let r = t === 'out' ? 7 : 9;
  if (t === 'hr') { r *= 1.12; c.beginPath(); c.arc(x, y, r + 4, 0, TAU); c.strokeStyle = D.hr; c.lineWidth = 1.5; c.stroke(); }
  c.beginPath(); c.arc(x, y, r + 2, 0, TAU); c.fillStyle = D.card; c.fill();
  c.beginPath();
  if (t === 'out') { c.arc(x, y, r - 1, 0, TAU); c.strokeStyle = D.out; c.lineWidth = 2; c.stroke(); }
  else { c.arc(x, y, r, 0, TAU); c.fillStyle = MARK[t]; c.fill(); }
}

// ── 타구 위치 그림 ────────────────────────────────────────────
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
const FPAD = 40;   // 양옆 = 폴 바깥 거리 글자 자리
const _fieldH = w => { const b = _fieldBox(); return b ? (w - FPAD * 2) * (b.y1 - b.y0) / (b.x1 - b.x0) : w * 0.9; };
// 선으로만 그린 구장 (성적 카드와 같은 모양): 옅은 페어 지역 · 내야 잔디 호 · 거리 점선 호 · 다이아몬드 · 파울라인 · 펜스
function _field(c, abs, x, y, w) {
  const fp = window._fieldPos, bx = _fieldBox();
  if (!bx) return;
  const k = (w - FPAD * 2) / (bx.x1 - bx.x0);
  const px = p => [x + FPAD + (p[0] - bx.x0) * k, y + (p[1] - bx.y0) * k];
  const at = (deg, dist) => px(_fpAt(fp, deg, dist));
  const path = (pts, close) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); if (close) c.closePath(); };
  const fence = [];
  for (let d = 0; d <= 180; d += 3) fence.push(at(d, 0.97));   // 0.97 = core.js 의 펜스 반지름
  const hm = at(90, 0), lp = fence[0], rp = fence[fence.length - 1], cf = at(90, 0.97);
  // 구장 치수(m): 화면 거리 = m × ppm (홈~중앙 펜스 px / 중앙 거리)
  const st = (window.STADIUMS || {})[(window.AS || {}).stadium] || (window.STADIUMS || {}).standard || {};
  const cfD = st.cfDist || 120, ppm = Math.hypot(cf[0] - hm[0], cf[1] - hm[1]) / cfD, bm = st.base || 27.43, b = bm * ppm;
  const dir = p => { const dx = p[0] - hm[0], dy = p[1] - hm[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const uL = dir(lp), uR = dir(rp), up = dir(cf);
  const on = (u, d) => [hm[0] + u[0] * d, hm[1] + u[1] * d];
  const bs = [on(uL, b), [hm[0] + (uL[0] + uR[0]) * b, hm[1] + (uL[1] + uR[1]) * b], on(uR, b)];   // 3루 · 2루 · 1루
  // 거리 호: 30m(작은 구장 20m) 마다, 짧은 쪽 폴보다 반 칸 안쪽까지 (성적 카드와 같은 규칙)
  const step = cfD >= 100 ? 30 : 20, dists = [], short = Math.min(st.lfDist || cfD, st.rfDist || cfD);
  for (let d = step; d < short - step / 2; d += step) dists.push(d);
  path([hm, ...fence], true); c.fillStyle = FIELD; c.fill();
  c.save(); path([hm, ...fence], true); c.clip();
  c.strokeStyle = D.line2; c.lineWidth = 1.5;
  const md = on(up, (st.mound || 18.44) * ppm);
  c.beginPath(); c.arc(md[0], md[1], 29 * bm / 27.43 * ppm, 0, TAU); c.stroke();   // 내야 잔디 경계 (마운드 중심 29m)
  c.setLineDash([4, 6]);
  dists.forEach(d => { c.beginPath(); c.arc(hm[0], hm[1], d * ppm, 0, TAU); c.stroke(); });
  c.setLineDash([]);
  c.restore();
  path(bs); c.strokeStyle = D.line2; c.lineWidth = 1.5; c.stroke();
  path([lp, hm, rp]); c.strokeStyle = D.tx3; c.lineWidth = 2; c.stroke();
  path(fence); c.stroke();
  // 베이스(45° 돌린 작은 네모) · 홈(오각형)
  c.fillStyle = D.tx;
  bs.forEach(p => { path([[p[0], p[1] - 5], [p[0] + 5, p[1]], [p[0], p[1] + 5], [p[0] - 5, p[1]]], true); c.fill(); });
  path([[hm[0], hm[1] + 3], [hm[0] + 5, hm[1] - 1], [hm[0] + 5, hm[1] - 6], [hm[0] - 5, hm[1] - 6], [hm[0] - 5, hm[1] - 1]], true); c.fill();
  // 거리 글자: 펜스(폴 바깥 · 중앙 위) · 거리 호(왼쪽 파울라인 바깥) — 타구 점과 겹치지 않는 자리
  if (st.cfDist) {
    const ct = on(up, cfD * ppm + 10), lab = (t, p, al) => _t(c, t + 'm', p[0], p[1], '500', 26, NUM, D.tx3, al);
    lab(st.lfDist, [lp[0] - 8, lp[1] + 9], 'right'); lab(cfD, ct, 'center'); lab(st.rfDist, [rp[0] + 8, rp[1] + 9], 'left');
    dists.forEach(d => { const p = on(uL, d * ppm); lab(d, [p[0] - 8, p[1] + 8], 'right'); });
  }
  // 타구 (아웃 → 단타 → 장타 → 홈런 순으로 위에 쌓는다)
  const order = { out: 0, '1b': 1, xbh: 2, hr: 3 };
  const pts = abs.filter(a => a.x != null && a.y != null);
  pts.map(a => ({ a, t: a.res === '홈런' ? 'hr' : (a.res === '2루타' || a.res === '3루타') ? 'xbh' : HITS.includes(a.res) ? '1b' : 'out' }))
    .sort((p, q) => order[p.t] - order[q.t])
    .forEach(({ a, t }) => { const p = px(fp(a)); _mark(c, t, p[0], p[1]); });
  if (!pts.length) {
    // 안내 글자 자리만 카드색으로 덮어 선과 겹치지 않게 (펜스와 거리 호 사이)
    const ty = hm[1] + (cf[1] - hm[1]) * 0.56, msg = '타구 위치 기록이 없어요';
    const z = fitFont(c, msg, '700', 26, KR, w - FPAD * 2 - 24, 20), tw = c.measureText(msg).width + 24;
    c.fillStyle = D.card; c.fillRect(hm[0] - tw / 2, ty - 30, tw, 42); c.fillStyle = FIELD; c.fillRect(hm[0] - tw / 2, ty - 30, tw, 42);
    _t(c, msg, hm[0], ty, '700', z, KR, D.tx2, 'center');
  }
}
// 기호 설명 한 줄(가운데): ● 단타 ● 장타 ◎ 홈런 ○ 아웃
function _legend(c, cx, y) {
  const L = [['1b', '단타'], ['xbh', '장타'], ['hr', '홈런'], ['out', '아웃']];
  font(c, '500', 26, KR);
  let x = cx - (L.reduce((n, [, l]) => n + 30 + c.measureText(l).width, 0) + 26 * (L.length - 1)) / 2;
  L.forEach(([t, l]) => {
    _mark(c, t, x + 11, y - 9);
    _t(c, l, x + 30, y, '500', 26, KR, D.tx2);
    x += 30 + c.measureText(l).width + 26;
  });
}

// ── 코스별 타율 (스트라이크존 9칸 + 바깥 볼 4칸) ─────────────────
// 칸 숫자 · 색 기준은 zonefig.js hotColdFigure 와 같다: 칸마다 calcStats · 색 = 이 선수 타율 대비 · MIN_AB 타수 미만은 색 없음
// 칸 높이는 카드에 남는 높이로 (72~112) · 칸 안 = 타율 + 안타/타수 (타석 수는 머리 오른쪽 합계로)
function _zoneGeo(w, h) {
  const side = 56, g = 6, ax = 40, band = 46, cw = Math.floor((w - 2 * (side + g)) / 3);
  const ch = Math.round(Math.max(72, Math.min(112, (h - ax - band * 2 - g * 2) / 3)));
  return { side, g, ax, band, cw, ch, h: ax + band * 2 + g * 2 + ch * 3 };
}
function _zone(c, zs, base, x, y, w, h) {
  const { side, g, ax, band, cw, ch } = _zoneGeo(w, h);
  x = Math.round(x); y = Math.round(y);
  const gx = x + side + g, gy = y + ax + band + g, zw = cw * 3, zh = ch * 3;
  const zoned = Object.values(zs).reduce((n, s) => n + s.pa, 0);
  ['내각', '중앙', '외각'].forEach((t, i) => _t(c, t, gx + cw * (i + 0.5), y + 28, '500', 26, KR, D.tx2, 'center'));
  const balls = [['볼 위', gx, y + ax, zw, band], ['볼 아래', gx, gy + zh + g, zw, band], ['볼 내', x, gy, side, zh], ['볼 외', gx + zw + g, gy, side, zh]];
  const grid = () => {
    c.fillStyle = D.line;
    for (let i = 1; i < 3; i++) { c.fillRect(gx + cw * i - 1, gy, 2, zh); c.fillRect(gx, gy + ch * i - 1, zw, 2); }
    c.strokeStyle = ZONE_LINE; c.lineWidth = 2; c.strokeRect(gx + 1, gy + 1, zw - 2, zh - 2);
  };
  if (!zoned) {
    // 빈 상태: 옅은 칸 + 가운데 안내
    c.fillStyle = D.card2; balls.forEach(b => c.fillRect(b[1], b[2], b[3], b[4]));
    grid();
    c.fillStyle = D.card; c.fillRect(gx + 2, gy + ch + 1, zw - 4, ch - 2);
    const m1 = '코스 기록이 없어요', m2 = '코스를 기록하면 채워져요';
    _t(c, m1, gx + zw / 2, gy + zh / 2 - 4, '700', fitFont(c, m1, '700', 28, KR, zw - 8, 20), KR, D.tx2, 'center');
    _t(c, m2, gx + zw / 2, gy + zh / 2 + 32, '500', fitFont(c, m2, '500', 26, KR, zw - 8, 18), KR, D.tx3, 'center');
    return;
  }
  // 바깥 볼 칸: 옅은 바탕(3타수 이상이면 색) · 기록이 있을 때만 숫자. 옆 칸은 좁아서 글자를 세로로 쌓는다
  balls.forEach(([z, bx, by, bw, bh]) => {
    const s = zs[z], cx = bx + bw / 2, cy = by + bh / 2;
    c.fillStyle = s.ab >= MIN_AB ? _heat(s.avg, base) : D.card2; c.fillRect(bx, by, bw, bh);
    const main = s.ab ? f3(s.avg) : '—', hab = `${s.h}/${s.ab}`;
    if (bw > bh) {
      if (!s.pa) return _t(c, z, cx, cy + 9, '500', 26, KR, D.tx3, 'center');
      return _runs(c, [[z + '  ', '500', 26, KR, D.tx2], [main, '700', 30, NUM, D.tx], ['  ' + hab, '500', 26, NUM, D.tx2]], cx, cy + 10, 'center');
    }
    z.split(' ').forEach((ch1, i) => _t(c, ch1, cx, cy - 58 + i * 30, '500', 26, KR, s.pa ? D.tx2 : D.tx3, 'center'));
    if (!s.pa) return;
    _t(c, main, cx, cy + 22, '700', fitFont(c, main, '700', 30, NUM, bw - 8, 20), NUM, D.tx, 'center');
    _t(c, hab, cx, cy + 56, '500', fitFont(c, hab, '500', 26, NUM, bw - 8, 18), NUM, D.tx2, 'center');
  });
  // 9칸: 타율은 가장 넓은 값 기준 오른쪽 맞춤 → 같은 열에서 소수점이 한 줄에 선다
  const vals = ZONES_9.map(z => (zs[z].ab ? f3(zs[z].avg) : '—'));
  const vz = Math.min(...vals.map(v => fitFont(c, v, '700', ch >= 84 ? 40 : 34, NUM, cw - 14, 26)));
  font(c, '700', vz, NUM);
  const half = Math.max(...vals.map(v => c.measureText(v).width)) / 2;
  ZONES_9.forEach((z, i) => {
    const s = zs[z], on = s.ab >= MIN_AB, cx = gx + cw * (i % 3), cy = gy + ch * Math.floor(i / 3);
    if (on) { c.fillStyle = _heat(s.avg, base); c.fillRect(cx, cy, cw, ch); }
    if (!s.pa) return _t(c, '—', cx + cw / 2, cy + ch / 2 + 10, '500', 30, NUM, D.tx3, 'center');
    _t(c, vals[i], cx + cw / 2 + half, cy + ch * 0.55, '700', vz, NUM, on ? D.tx : D.tx2, 'right');
    _t(c, `${s.h}/${s.ab}`, cx + cw / 2, cy + ch * 0.9, '500', 26, NUM, D.tx2, 'center');
  });
  grid();
}

// 비율 세 칸(방향 · 타구 유형): 머리(제목 · 기준) → [이름 비율%] 세 칸(가장 큰 값은 주황) → 막대
// items = [[이름, 개수 | null(기록 안 함 → '—')]] · 합이 0이면 옅은 빈 막대 + 안내
function _split(c, x, y, w, title, meta, items, empty) {
  _title(c, title, x, y + 30, meta, x + w);
  const tot = items.reduce((t, it) => t + (it[1] || 0), 0), by = y + 106;
  rr(c, x, by, w, 12, 6); c.fillStyle = D.card2; c.fill();
  if (!tot) return _t(c, empty, x, y + 82, '500', 26, KR, D.tx3);
  const pc = items.map(it => (it[1] == null ? null : Math.round(it[1] / tot * 100))), max = Math.max(...pc.map(v => v || 0));
  const lab = it => it[0] + ' ';
  font(c, '500', 26, KR);
  const lw = items.map(it => c.measureText(lab(it)).width);
  const vz = Math.min(...items.map((it, i) => fitFont(c, pc[i] == null ? '—' : pc[i] + '%', '700', 40, NUM, w / 3 - 16 - lw[i], 26)));
  items.forEach((it, i) => _runs(c, [[lab(it), '500', 26, KR, D.tx2], [pc[i] == null ? '—' : pc[i] + '%', '700', vz, NUM, pc[i] == null ? D.tx3 : pc[i] === max ? D.acc : D.tx]], x + w / 3 * i, y + 84));
  let bx = x;
  items.forEach((it, i) => {
    if (!it[1]) return;
    const bw = w * it[1] / tot;
    rr(c, bx, by, Math.max(bw - (bx + bw < x + w - 1 ? 4 : 0), 12), 12, 6); c.fillStyle = pc[i] === max ? D.acc : D.line2; c.fill();
    bx += bw;
  });
}

// ── 한 장 그리기 ──────────────────────────────────────────────
// 위에서부터: 제목 줄 → 맨 위 카드(팀 · 이름 · 기간 · 표본 안내 · 요약) → 큰 숫자 4칸 → 기록 한 줄(6칸) → 타구 위치 | 코스별 타율 → 방향 | 타구 유형 → 코치 코멘트 → 꼬리
// 카드 사이 24 (남으면 넓히고, 코멘트 3줄 + 표본 안내로 모자라면 16) · 그림 두 카드가 남는 높이를 받는다(540~620)
function _draw(c, R) {
  const s = R.st, smp = sampleBadge(s.pa), IX = X + PAD, IW = CW - PAD * 2, END = H - 92;   // END = 꼬리 위 마지막 카드 끝
  c.fillStyle = D.bg; c.fillRect(0, 0, W, H);

  // 1. 제목 줄 (카드 밖): 주황 제목 · 오른쪽 만든 날
  _t(c, '선수 리포트', X, 76, '700', 32, KR, D.acc);
  _t(c, _ymd(Date.now(), true), W - X, 76, '500', 30, NUM, D.tx2, 'right');

  // 2. 높이 나누기
  const cmt = String(R.cmt || '').trim();
  font(c, '500', 30, KR);
  let lines = cmt ? _wrap(c, cmt, IW) : [];
  if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] = lines[2].replace(/.$/, '…'); }
  const div = smp ? 318 : 276, HERO = div + 92, KH = 152, SH = 128, BH = 160, CMH = lines.length ? 96 + lines.length * 46 : 0;
  const nGap = 5 + (CMH ? 1 : 0), fixed = 112 + HERO + KH + SH + BH + CMH;
  let gap = 24, chartH = END - fixed - nGap * gap;
  if (chartH < 540) { gap = 16; chartH = END - fixed - nGap * gap; }
  if (chartH > 620) { gap += Math.min(24, Math.floor((chartH - 620) / nGap)); chartH = END - fixed - nGap * gap; }

  // 3. 맨 위 카드(주황 빛): 팀 · 포지션 (+ 샘플 꼬리표) → 이름 + 등번호 → 기간 · 날짜 · 경기 수 → (표본 안내) → 요약
  const hy = 112;
  _card(c, X, hy, CW, HERO, true);
  const pw = R.sample ? dPill(c, '샘플 · 가상 선수', X + CW - PAD, hy + 56, D.acc, tint(D.acc, 0.16), 'right', 26) + 16 : 0;
  if (R.team || R.pos) {
    font(c, '700', 30, KR);
    const pos = R.pos ? '  ·  ' + R.pos : '';
    const team = _clip(c, R.team || '', IW - pw - c.measureText(pos).width);
    _runs(c, [[team, '700', 30, KR, D.tx], [team ? pos : R.pos, '700', 30, KR, D.tx2]], IX, hy + 66);
  }
  let numW = 0;
  if (R.num) { font(c, '700', 76, NUM); numW = c.measureText('#' + R.num).width + 24; }
  const nz = fitFont(c, R.name, '900', 116, KR, IW - numW, 60);
  const name = _clip(c, R.name, IW - numW);
  _t(c, name, IX, hy + 190, '900', nz, KR, D.tx);
  font(c, '900', nz, KR);
  if (R.num) _t(c, '#' + R.num, IX + c.measureText(name).width + 24, hy + 190, '700', Math.min(76, nz * 0.7), NUM, D.acc);
  const dot = ['  ·  ', '500', 28, KR, D.tx3];
  _runs(c, [[R.rangeLabel, '700', 28, KR, D.tx], dot, ...(R.dates ? [[R.dates, '500', 28, NUM, D.tx2], dot] : []),
    [`${R.games}경기 ${s.pa}타석`, '500', 28, KR, D.tx2]], IX, hy + 248);
  if (smp) _runs(c, [[smp.cls === 'low' ? '표본이 매우 적어 참고용이에요' : '표본이 적어 참고용이에요', '500', 26, KR, D.tx2], [`  ·  ${s.pa}타석 기준`, '500', 26, KR, D.tx3]], IX, hy + 292);
  // 요약 (규칙 기반 · AI 아님) — 근거는 오른쪽에 흐리게, 자리가 모자라면 뺀다
  c.fillStyle = D.line; c.fillRect(IX, hy + div, IW, 2);
  _t(c, '요약', IX, hy + div + 56, '700', 26, KR, D.acc);
  font(c, '700', 32, KR);
  const sumT = _clip(c, R.sum.text, IW - 80), sw0 = c.measureText(sumT).width;
  _t(c, sumT, IX + 80, hy + div + 57, '700', 32, KR, D.tx);
  font(c, '500', 26, KR);
  if (R.sum.detail && IX + 80 + sw0 + 32 + c.measureText(R.sum.detail).width <= IX + IW) _t(c, R.sum.detail, IX + IW, hy + div + 56, '500', 26, KR, D.tx3, 'right');
  let y = hy + HERO + gap;

  // 4. 큰 숫자 4칸 — 타율·장타율은 타수가 0이면(볼넷·사구·희생만) 계산할 수 없으므로 '—' · 네 칸이 같은 크기
  const tiles = [['타율', s.avg, s.ab], ['출루율', s.obp, s.pa], ['장타율', s.slg, s.ab], ['OPS', s.ops, s.pa]];
  const tg = 20, tw = (CW - tg * 3) / 4, vals = tiles.map(([, v, n]) => (n ? f3(v) : '—'));
  const vz = Math.min(...vals.map(v => fitFont(c, v, '700', 64, NUM, tw - 56, 40)));
  tiles.forEach(([l], i) => {
    const tx = X + i * (tw + tg);
    rr(c, tx, y, tw, KH, 32); c.fillStyle = D.card; c.fill();
    _t(c, l, tx + 28, y + 52, '500', 28, KR, D.tx2);
    _t(c, vals[i], tx + 28, y + KH - 28, '700', vz, NUM, vals[i] === '—' ? D.tx3 : i === 3 ? D.acc : D.tx);
  });
  y += KH + gap;

  // 5. 기록 한 줄 (6칸): wOBA · 안타 · 홈런 · 타점 · 볼넷% · 삼진%
  _card(c, X, y, CW, SH);
  const row = [['wOBA', s.pa ? f3(s.woba) : '—'], ['안타', s.h], ['홈런', s.hr], ['타점', s.rbi], ['볼넷%', s.pa ? pct(s.bbRate) : '—'], ['삼진%', s.pa ? pct(s.kRate) : '—']];
  row.forEach(([l, v], i) => {
    const cx = X + CW / row.length * (i + 0.5);
    _t(c, l, cx, y + 50, '500', 26, KR, D.tx2, 'center');
    _t(c, String(v), cx, y + 104, '700', 46, NUM, v === '—' ? D.tx3 : D.tx, 'center');
  });
  y += SH + gap;

  // 6. 그림 두 카드: 타구 위치 | 코스별 타율 — 같은 높이
  const PW = (CW - 24) / 2, x2 = X + PW + 24;
  const nPts = R.abs.filter(a => a.x != null && a.y != null).length;
  const zs = Object.create(null);
  [...ZONES_9, ...ZONE_BALL].forEach(z => { zs[z] = calcStats(R.abs.filter(a => zoneOf(a) === z)); });
  const zoned = Object.values(zs).reduce((n, z) => n + z.pa, 0);
  _card(c, X, y, PW, chartH); _card(c, x2, y, PW, chartH);
  _title(c, '타구 위치', X + PAD, y + 58, `타구 ${nPts}개`, X + PW - PAD);
  _title(c, '코스별 타율', x2 + PAD, y + 58, zoned ? `코스 ${zoned}/${s.pa}타석` : '', x2 + PW - PAD);
  // 구장: 카드 폭에 맞추고(높이가 모자라면 줄임) 머리와 기호 설명 사이 가운데에
  const ft = y + 116, fb = y + chartH - PAD - 46;
  let fw = PW - 40;
  if (_fieldH(fw) > fb - ft) fw = FPAD * 2 + (fw - FPAD * 2) * (fb - ft) / _fieldH(fw);
  _field(c, R.abs, X + (PW - fw) / 2, ft + (fb - ft - _fieldH(fw)) / 2, fw);
  _legend(c, X + PW / 2, y + chartH - PAD);
  // 코스: 머리 아래 ~ 색 단계 줄 위 (칸 높이는 남는 만큼 · 가운데)
  const zt = y + 84, zb = y + chartH - PAD - (zoned ? 44 : 0), zg = _zoneGeo(PW - PAD * 2, zb - zt);
  _zone(c, zs, s.avg, x2 + PAD, zt + (zb - zt - zg.h) / 2, PW - PAD * 2, zb - zt);
  if (zoned) {
    // 색 단계 (그라데이션 대신 5칸) · 기준 타율
    const ly = y + chartH - PAD;
    _t(c, '약함', x2 + PAD, ly, '700', 26, KR, D.bb);
    const gx = x2 + PAD + c.measureText('약함').width + 12;
    [-1, -0.5, 0, 0.5, 1].forEach((t, i) => { c.fillStyle = _mix(D.card, t < 0 ? D.bb : D.acc, Math.abs(t) * 0.45); c.fillRect(gx + i * 28, ly - 19, 28, 18); });
    c.strokeStyle = D.line2; c.lineWidth = 1; c.strokeRect(gx + 0.5, ly - 18.5, 140, 17);
    _t(c, '강함', gx + 152, ly, '700', 26, KR, D.acc);
    _t(c, `기준 ${s.ab ? f3(s.avg) : '—'}`, x2 + PW - PAD, ly, '500', 26, NUM, D.tx3, 'right');
  }
  y += chartH + gap;

  // 7. 방향(당김·센터·밀어 — 타자 기준) | 타구 유형(입력한 유형이 있으면 그것으로, 없으면 아웃 타구만 — 안타는 짐작해서 넣지 않는다)
  _card(c, X, y, CW, BH);
  const hw = (IW - 64) / 2, tm = R.types;
  _split(c, IX, y + PAD, hw, '방향', s.dn ? `타구 ${s.dn}개` : '', s.dn ? [['당김', s.pull], ['센터', s.center], ['밀어', s.oppo]] : [], '방향 기록 없음');
  c.fillStyle = D.line; c.fillRect(X + CW / 2 - 1, y + PAD, 2, BH - PAD * 2);
  _split(c, IX + hw + 64, y + PAD, hw, '타구 유형', tm.n ? (tm.basis === 'launch' ? `입력 ${tm.n}개 기준` : `아웃 타구 ${tm.n}개 기준`) : '',
    tm.n >= MIN_TYPE ? [['땅볼', tm.ground], ['라이너', tm.line], ['뜬공', tm.fly]] : [],
    tm.basis === 'launch' || !tm.n ? '타구 유형 기록이 적어요' : '유형 기록이 적어요');
  y += BH + gap;

  // 8. 코치 코멘트 (3줄까지)
  if (CMH) {
    _card(c, X, y, CW, CMH);
    _title(c, '코치 코멘트', IX, y + 58);
    lines.forEach((l, i) => _t(c, l, IX, y + 112 + i * 46, '500', 30, KR, D.tx));
  }

  // 9. 꼬리: 로고 · 계정 (다른 저장 이미지와 같다)
  wordmark(c, X, H - 40, 30, D.tx, D.acc);
  _t(c, '@spraylab2026', W - X, H - 40, '500', 30, NUM, D.tx3, 'right');
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
