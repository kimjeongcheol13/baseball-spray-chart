// 리그 제출용 기록지 — 이번 경기를 A4 세로 한 장으로: 이닝별 점수(R H E) · 양 팀 타순 × 이닝 칸 · 선수별 합계 · 기록원 서명 칸
//  · 읽기만 한다 (AS.abs · 라인업 · AS.info · runners.js 의 득점 slLineScore · slRunnerStats · core.js _cardStats) — 저장 구조 · 키 변경 없음
//  · 칸 = 중계 문자 약어 (좌안 · 중2 · 우홈 · 중비 · 땅볼 · 삼진 · 4구 …). 방향은 필드를 탭한 타구만. 아웃에 수비 기록(6-3 · 3U · F8 · L6 — fielding.js)이 있으면 그것
//  · 타순 = 지금 주전 순서, 자리마다 교체 기록(runEv SUB)을 거슬러 처음 선수부터. 라인업에 없는 타자는 맨 아래 (첫 타석 순)
//  · 득점 · 도루는 경기 운영 모드로 적은 경기만 (그 밖의 경기는 빈칸 — 0 으로 적지 않는다). E = 상대 타자가 실책으로 나간 수
//  · 이미지 저장 = core.js _downloadCanvas · 인쇄 / PDF = 이 그림 한 장만 (body.ss-printing · css/report.css)
//  · 창은 선수 리포트(.rp) 모양을 그대로 쓴다. 진입: ☰ 메뉴 · 그 밖의 기능(setup.js) · 경기종료 뒤 GAME REPORT 공유 줄(#pgReport — 버튼 추가)
import { HITS } from '../constants.js';
import { FONT, PAPER, font, fitFont, rr, wordmark, drawWithFonts } from './imgkit.js?v=3';

const $ = id => document.getElementById(id);
const teamOf = a => (a && a.team === 'away' ? 'away' : 'home');
const pk = p => (p && p.id != null ? 'i' + p.id : 'n' + (p && p.name));
const ak = a => (a.bid != null ? 'i' + a.bid : 'n' + a.bname);
const innOf = a => parseInt(a && a.inn, 10);

// ── 타석 → 칸 글자 ───────────────────────────────────────────
const ZONE = { __proto__: null, LF: '좌', LC: '좌중', CF: '중', RC: '우중', RF: '우' };
const FIX = { __proto__: null, '내야안타': '내야안', '땅볼 아웃': '땅볼', '삼진': '삼진', '볼넷': '4구', '사구': '사구', '희타': '희번', '희비': '희플', '병살': '병살', '실책': '실책', '야수선택': '야선' };
const ZONED = { __proto__: null, '안타': ['안', '안타'], '2루타': ['2', '2루타'], '3루타': ['3', '3루타'], '홈런': ['홈', '홈런'], '플라이 아웃': ['비', '뜬공'] };

// 내야안타는 버튼으로 적으면 방향 없이 중견 기본값이 들어가므로 FIX 가 먼저
export function cellCode(a) {
  const r = a && a.res;
  if (!r) return '';
  if (a.fp) return a.fp;   // 아웃 수비 기록 — 땅볼 · 뜬공 · 라인드라이브 아웃에만 붙는다
  if (FIX[r]) return FIX[r];
  const z = ZONED[r];
  if (!z) return String(r);
  const d = a.x != null ? ZONE[a.dir] : null;
  return d ? d + z[0] : z[1];
}

// ── 한 팀의 줄: [{ slot, p: { id, name, num }, tag, abs }] ─────────────
const SUBK = { __proto__: null, PH: '대타', PR: '대주자', DEF: '대수비' };
export function sheetRows(abs, lineup, team) {
  abs = Array.isArray(abs) ? abs.filter(Boolean) : [];
  const lu = Array.isArray(lineup) ? lineup.filter(p => p && p.name != null) : [];
  const mine = abs.filter(a => teamOf(a) === team);
  // 들어온 선수 → { 나간 선수, 종류 } (이 팀 교체만 · 투수 교체는 타순과 무관)
  const prev = Object.create(null);
  abs.forEach(a => (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => {
    if (e && e.t === 'SUB' && e.team === team && SUBK[e.k] && e.out && !prev[pk(e)]) prev[pk(e)] = { out: e.out, k: e.k };
  }));
  const rows = [], seen = new Set();
  const add = (p, slot, tag) => {
    const k = pk(p);
    if (seen.has(k)) return;
    seen.add(k);
    rows.push({ slot, p: { id: p.id != null ? p.id : null, name: p.name, num: p.num != null ? p.num : '' }, tag, abs: [] });
  };
  lu.filter(p => p.isStarter !== false).forEach((p, i) => {
    const chain = [{ p, tag: '' }];
    for (let c = prev[pk(p)], n = 0; c && n < 20; c = prev[pk(c.out)], n++) {
      chain[0].tag = SUBK[c.k];   // 앞 선수를 바꿔 들어온 쪽에 종류
      chain.unshift({ p: c.out, tag: '' });
    }
    chain.forEach((c, j) => add(c.p, j ? null : i + 1, c.tag));
  });
  mine.forEach(a => add({ id: a.bid, name: a.bname, num: a.bnum }, null, ''));
  const by = new Map(rows.map(r => [pk(r.p), r]));
  mine.forEach(a => { const r = by.get(ak(a)); if (r) r.abs.push(a); });
  return rows;
}

// 득점한 타석 (홈인한 주자의 그 전 마지막 타석) — 경기 운영 모드의 scored · runEv 로
export function scoredSet(abs) {
  abs = Array.isArray(abs) ? abs : [];
  const out = new Set();
  const mark = (x, team, i) => {
    for (let j = i; j >= 0; j--) {
      const b = abs[j];
      if (b && teamOf(b) === team && (x.id != null && b.bid != null ? String(x.id) === String(b.bid) : x.name != null && x.name === b.bname)) { out.add(b); return; }
    }
  };
  abs.forEach((a, i) => {
    if (!a) return;
    (Array.isArray(a.scored) ? a.scored : []).forEach(x => { if (x) mark(x, teamOf(a), i); });
    (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => { if (e && e.t !== 'SUB' && e.scored) mark(e, teamOf(e), i); });
  });
  return out;
}

// ── 그릴 내용 한 벌 ───────────────────────────────────────────
// g = { abs, home_lineup, away_lineup, info, hs, as, th, ta, date, venue }
export function sheetData(g) {
  const abs = (Array.isArray(g.abs) ? g.abs : []).filter(Boolean);
  const info = g.info && typeof g.info === 'object' ? g.info : {};
  const ls = info.ls && typeof info.ls === 'object' ? info.ls : (window.slLineScore ? window.slLineScore(abs) : null);
  const known = abs.some(a => Array.isArray(a.scored));   // 득점 · 도루를 아는 경기 (경기 운영 모드)
  const i1 = abs.find(a => innOf(a) === 1);
  const first = i1 ? teamOf(i1) : 'away';
  let n = [5, 7, 9].includes(+info.innings) ? +info.innings : 7;
  abs.forEach(a => { const i = innOf(a); if (i > n && i <= 15) n = i; });
  if (ls) ['away', 'home'].forEach(t => { const L = Array.isArray(ls[t]) ? ls[t].length : 0; if (L > n && L <= 15) n = L; });
  const sc = scoredSet(abs);
  const teams = (first === 'home' ? ['home', 'away'] : ['away', 'home']).map(t => {
    const mine = abs.filter(a => teamOf(a) === t), opp = abs.filter(a => teamOf(a) !== t);
    const rows = sheetRows(abs, t === 'home' ? g.home_lineup : g.away_lineup, t).map(r => {
      const s = window._cardStats(r.abs), rs = known && window.slRunnerStats ? window.slRunnerStats(abs, r.p) : null;
      return Object.assign(r, {
        cells: Array.from({ length: n }, (_, k) => r.abs.filter(a => innOf(a) === k + 1).map(a => ({ code: cellCode(a), hit: HITS.includes(a.res), walk: a.res === '볼넷' || a.res === '사구', rbi: +a.rbi || 0, scored: sc.has(a) }))),
        tot: [s.ab, s.h, s.rbi, rs ? rs.r : '', s.bb, s.hbp, s.so, rs ? rs.sb : ''],
      });
    });
    const tot = rows.length ? rows[0].tot.map((_, c) => rows.some(r => r.tot[c] === '') ? '' : rows.reduce((s, r) => s + r.tot[c], 0)) : [];
    const L = ls && Array.isArray(ls[t]) ? ls[t] : [];
    return {
      team: t, side: t === 'home' ? '홈' : '원정', name: (t === 'home' ? g.th : g.ta) || (t === 'home' ? '홈' : '원정'), first: t === first,
      rows, tot,
      line: Array.from({ length: n }, (_, k) => (L[k] == null ? '' : String(L[k]))),
      r: +(t === 'home' ? g.hs : g.as) || 0,
      h: mine.length ? mine.filter(a => HITS.includes(a.res)).length : '',
      e: opp.length ? opp.filter(a => a.res === '실책').length : '',
    };
  });
  return { n, teams, date: g.date || '', venue: g.venue || '' };
}

// ── 그리기 (논리 794 × 1123 = A4 세로 · 2배 PNG. 줄이 아주 많으면 세로만 늘린다) ──────────
//  · 머리(로고 · 제목 + 칸 상자) / 이닝별 점수(R H E) / 팀마다 표 / 발(약어 세 줄 · 서명 상자). 발은 아래 끝에 붙이고 줄 높이를 늘려 표가 발까지 닿게 한다
//  · 이닝 칸 = 스코어북: 위에 마름모(홈 = 아래), 아래에 칸 약어. 타자가 그 타석에 간 베이스까지 굵은 선, 홈인한 타석(홈런 포함)은 마름모를 칠한다 · 빈 칸에도 옅은 마름모
//    아웃 순번(1 · 2 · 3)은 적지 않는다 — 타석 순서가 줄을 건너 남아 있지 않고 주자 아웃(견제사 · 도루자 · 병살의 주자)은 칸에 없어 틀린 번호가 된다
//  · 이닝별 점수의 팀 · 이닝 · R H E 세로줄 = 팀 표의 선수 · 이닝 · 합계 세로줄. 팀 표는 9줄이 안 되면 빈 줄(손으로 적는다), 타석이 없는 팀은 띠에 '타석 기록 없음'
//  · 선 굵기는 셋만: 테두리 · 구역 2 / 줄 1 / 칸 안 가는 선 0.5. 안쪽 여백 12 · 사이 8 · 16. 숫자는 일의 자리를 세로로 맞춘다
//  · 글자는 인쇄에서 읽히게 11.5 이상(약어 줄이 길면 그 줄만 10 까지) · 영문 장식 이름표(SCORE SHEET)는 없다
//  · 색 · 글꼴은 imgkit.js 의 PAPER · FONT 만 — 칸 글자: 안타 = acc, 4구 · 사구 = bb, 그 밖 = out. 득점 마름모 = acc
const W = 794, H0 = 1123, SCALE = 2, X = 32, CW = W - X * 2, P = 12;
const TOT = ['타수', '안타', '타점', '득점', '4구', '사구', '삼진', '도루'];
const SLOT = 28, NAME = 124, JN = 28, TW = 28, MINR = 9;   // JN: 선수 칸 안 등번호 자리 (오른쪽 맞춤)
const BOX = 48, LT = 120, LBAND = 26, LROW = 30, TOP = 222, FOOT = 172, BAND = 26, HEAD = 22, GAP = 16, LX = 44, LSTEP = 16;
const HEAVY = [2, PAPER.ink], ROW = [1, PAPER.rule], HAIR = [0.5, PAPER.rule];   // 선 굵기 셋 [굵기, 색]
const snap = v => Math.round(v * 2) / 2;   // 2배 PNG 에서 선이 두 픽셀에 번지지 않게

// 9줄이 안 되는 팀은 빈 줄을 붙인다 — 타순 번호는 마지막 타순 다음부터 9까지 (타순을 모르는 팀은 번호 없이)
function padRows(rows) {
  const m = rows.reduce((s, r) => (r.slot > s ? r.slot : s), 0), num = !rows.length || m > 0;
  return rows.concat(Array.from({ length: Math.max(0, MINR - rows.length) }, (_, i) => ({ slot: num && m + i + 1 <= MINR ? m + i + 1 : null, blank: true })));
}

// 칸 → 타자가 그 타석에 간 베이스 (0 아웃 · 1 · 2 · 3 · 4 홈런). cellCode 글자로 읽는다 — 안타는 끝 글자(안 · 2 · 3 · 홈), 4구 · 사구 · 실책 · 야선은 1루
export const reach = p => (p.hit ? (/홈(런)?$/.test(p.code) ? 4 : /3(루타)?$/.test(p.code) ? 3 : /2(루타)?$/.test(p.code) ? 2 : 1) : p.walk || p.code === '실책' || p.code === '야선' ? 1 : 0);

export function drawSheet(cv, d) {
  const n = d.n, all = d.teams.map(t => padRows(t.rows));
  const lines = all.reduce((s, rows) => s + rows.length + 1, 0);   // 선수 줄 + 합계 줄
  const fixed = d.teams.length * (BAND + HEAD + GAP) - GAP;
  const rh = Math.max(18, (H0 - TOP - FOOT - fixed) / lines);
  const H = Math.max(H0, Math.ceil(TOP + FOOT + fixed + lines * rh));
  cv.width = W * SCALE; cv.height = H * SCALE;
  const c = cv.getContext('2d');
  c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = PAPER.bg; c.fillRect(0, 0, W, H);
  const text = (t, x, y, col, al) => { c.fillStyle = col; c.textAlign = al || 'left'; c.fillText(t, x, y); };
  const num = (v, cx, y, col) => text(String(v), cx + c.measureText('0').width / 2, y, col, 'right');   // 일의 자리를 cx 에 (한 자리 · 두 자리가 같은 세로줄)
  const hl = (x1, x2, y, k) => { c.fillStyle = k[1]; c.fillRect(x1, snap(y) - (k[0] < 1 ? 0 : k[0] / 2), x2 - x1, k[0]); };
  const vl = (x, y1, y2, k) => { c.fillStyle = k[1]; c.fillRect(snap(x) - (k[0] < 1 ? 0 : k[0] / 2), y1, k[0], y2 - y1); };
  const frame = (x, y, w, h) => { c.strokeStyle = HEAVY[1]; c.lineWidth = HEAVY[0]; rr(c, x, y, w, h, 6); c.stroke(); };
  // 칸 상자: 위에 작은 이름(조용히), 아래에 값 (값이 없으면 손으로 적는 빈칸)
  const field = (lbl, val, x, y, w, isNum) => {
    c.strokeStyle = ROW[1]; c.lineWidth = ROW[0]; rr(c, x + 0.5, y + 0.5, w - 1, BOX - 1, 6); c.stroke();
    font(c, '500', 12, FONT.kr); text(lbl, x + P, y + 18, PAPER.ink2);
    if (val) { fitFont(c, val, isNum ? '600' : '700', isNum ? 19 : 17, isNum ? FONT.num : FONT.kr, w - P * 2, 11); text(val, x + P, y + 40, PAPER.ink); }
  };
  // 마름모 (x, y) 가운데 · r 반지름. b = 간 베이스, run = 홈인 — 옅은 마름모 위에 간 길만 굵게 / 홈인은 옅게 칠하고 테두리 (안의 약어가 보이게 · 흑백 인쇄에서도 회색 칸 + 테두리)
  //  box = 안에 쓸 약어의 상자 [x, y, w, h] — 약어가 마름모 밖으로 넘치면 선은 그 상자를 비켜 간다 (글자에서 1 띄움)
  const diamond = (x, y, r, b, run, box) => {
    const pt = [[x, y + r], [x + r, y], [x, y - r], [x - r, y]];   // 홈 · 1루 · 2루 · 3루
    const path = k => { c.beginPath(); c.moveTo(x, y + r); for (let i = 1; i <= k; i++) c.lineTo(pt[i % 4][0], pt[i % 4][1]); };
    if (run) { path(4); c.save(); c.globalAlpha = 0.18; c.fillStyle = PAPER.acc; c.fill(); c.restore(); }
    c.save();
    if (box) { c.beginPath(); c.rect(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4); c.rect(box[0], box[1], box[2], box[3]); c.clip('evenodd'); }
    path(4); c.lineWidth = HAIR[0]; c.strokeStyle = HAIR[1]; c.stroke();
    if (b || run) {   // 홈 꼭짓점에서 시작하는 한 줄 (둥근 끝 · 둥근 꺾임) — 1루타는 마름모 오른쪽 아래 변
      c.lineCap = c.lineJoin = 'round';
      path(run ? 4 : b); c.lineWidth = 2; c.strokeStyle = run ? PAPER.acc : PAPER.ink; c.stroke();
    }
    c.restore();
  };

  // 머리: 로고 · 문서 이름 / 제목 + 대회 · 경기일 · 구장 (상자 왼쪽 = 이닝 칸 왼쪽)
  const IX = X + SLOT + NAME, TX = W - X - TW * TOT.length, iw = (TX - IX) / n, RW = (W - X - TX) / 3;
  wordmark(c, X, 40, 14, PAPER.ink, PAPER.acc);
  fitFont(c, '경기 기록지', '900', 32, FONT.kr, IX - X - 8, 20); text('경기 기록지', X - 1, 92, PAPER.ink);
  const bw = (W - X - IX - 16) / 3;
  [['대회', ''], ['경기일', d.date, 1], ['구장', d.venue]].forEach((f, i) => field(f[0], f[1], IX + (bw + 8) * i, 56, bw, f[2]));

  // 이닝별 점수 (R H E) — 어두운 띠에 이닝 번호, R H E 칸은 옅은 바탕
  const LB = LT + LBAND + LROW * d.teams.length;
  c.save(); rr(c, X, LT, CW, LB - LT, 6); c.clip();
  c.fillStyle = PAPER.band; c.fillRect(X, LT, CW, LBAND);
  c.fillStyle = PAPER.fill; c.fillRect(TX, LT + LBAND, W - X - TX, LB - LT - LBAND);
  c.restore();
  font(c, '500', 12, FONT.kr); text('팀', X + P, LT + 18, PAPER.rule);
  font(c, '600', 13, FONT.num);
  for (let k = 0; k < n; k++) num(k + 1, IX + iw * (k + 0.5), LT + 18, PAPER.bg);
  ['R', 'H', 'E'].forEach((s, j) => text(s, TX + RW * (j + 0.5), LT + 18, PAPER.bg, 'center'));
  d.teams.forEach((t, i) => {
    const y = LT + LBAND + LROW * i, cy = y + LROW / 2 + 6;
    if (i) hl(X, W - X, y, ROW);
    font(c, '500', 12, FONT.kr); text(t.side, X + P, cy - 0.5, PAPER.ink2);
    fitFont(c, t.name, '700', 16, FONT.kr, IX - X - P * 2 - 32, 10); text(t.name, X + P + 32, cy, PAPER.ink);
    font(c, '600', 17, FONT.num);
    t.line.forEach((v, k) => num(v, IX + iw * (k + 0.5), cy + 0.5, PAPER.ink));
    font(c, '700', 19, FONT.num); num(t.r, TX + RW * 0.5, cy + 1, PAPER.ink);
    font(c, '600', 17, FONT.num); num(t.h, TX + RW * 1.5, cy + 0.5, PAPER.ink); num(t.e, TX + RW * 2.5, cy + 0.5, PAPER.ink);
  });
  for (let k = 1; k < n; k++) vl(IX + iw * k, LT + LBAND, LB, HAIR);
  vl(TX + RW, LT + LBAND, LB, HAIR); vl(TX + RW * 2, LT + LBAND, LB, HAIR);
  vl(IX, LT + LBAND, LB, HEAVY); vl(TX, LT + LBAND, LB, HEAVY);
  frame(X, LT, CW, LB - LT);

  // 칸 = 기록지처럼 큰 마름모 하나 (높이 = 줄 높이의 84% · 정사각형을 45° 돌린 것), 약어는 마름모 가운데에서 조금 아래
  //  · 글자 크기는 한 장에 하나(CF) — 인쇄에서 읽히는 크기가 먼저라 마름모보다 넓으면 넘치고, 선이 글자 상자를 비켜 간다 · 칸 경계를 넘을 때만 줄인다
  const dr = Math.max(4, Math.min(rh * 0.42, iw / 2 - 2)), TO = 0.07, CF = 11.5;   // 반지름 · 글자 가운데를 내리는 비율 · 칸 글자 크기

  // 팀마다: 띠 · 머리 줄 · 선수 줄(한 줄 걸러 옅은 바탕) · 합계
  let y = TOP;
  d.teams.forEach((t, ti) => {
    const rows = all[ti], R0 = y + BAND + HEAD, ry = i => snap(R0 + i * rh), ty = ry(rows.length), y1 = ry(rows.length + 1);
    c.save(); rr(c, X, y, CW, y1 - y, 6); c.clip();
    c.fillStyle = PAPER.band; c.fillRect(X, y, CW, BAND);
    c.fillStyle = PAPER.fill; c.fillRect(X, y + BAND, CW, HEAD); c.fillRect(X, ty, CW, y1 - ty);
    c.fillStyle = PAPER.zebra;
    rows.forEach((r, i) => { if (i % 2) c.fillRect(X, ry(i), CW, ry(i + 1) - ry(i)); });
    c.restore();

    // 띠: 원정 · 팀 이름 (· 타석 기록 없음) / 선공 · 득점 3 — 팀 이름은 이닝별 점수의 팀 이름과 같은 세로줄
    font(c, '700', 17, FONT.num); const rw = c.measureText(String(t.r)).width;
    text(String(t.r), W - X - P, y + 19, PAPER.bg, 'right');
    font(c, '500', 12, FONT.kr); const side = (t.first ? '선공' : '후공') + ' · 득점 ', sdw = c.measureText(side).width;
    text(side, W - X - P - rw, y + 18, PAPER.rule, 'right');
    text(t.side, X + P, y + 18, PAPER.rule);
    const nx = X + P + 32, note = '타석 기록 없음 · 빈 줄은 손으로';
    font(c, '700', 12, FONT.kr); const pw = t.rows.length ? 0 : c.measureText(note).width + 18;
    fitFont(c, t.name, '700', 15, FONT.kr, W - X - P - rw - sdw - 16 - nx - (pw ? pw + 8 : 0), 10); text(t.name, nx, y + 18.5, PAPER.bg);
    if (pw) {   // 상태를 알리는 알약 — 이 팀 타석이 하나도 없다
      const px = nx + c.measureText(t.name).width + 8;
      c.fillStyle = PAPER.ink2; rr(c, px, y + 4, pw, 18, 9); c.fill();
      font(c, '700', 12, FONT.kr); text(note, px + pw / 2, y + 17.5, PAPER.bg, 'center');
    }

    // 머리 줄 (이름표는 작고 옅게)
    const hy = y + BAND + 15.5;
    font(c, '500', 12, FONT.kr);
    text('타순', X + SLOT / 2, hy, PAPER.ink2, 'center'); text('선수', X + SLOT + JN + 6, hy, PAPER.ink2);
    TOT.forEach((s, j) => text(s, TX + TW * (j + 0.5), hy, PAPER.ink2, 'center'));
    font(c, '600', 12, FONT.num);
    text('#', X + SLOT + JN, hy, PAPER.ink2, 'right');
    for (let k = 0; k < n; k++) num(k + 1, IX + iw * (k + 0.5), hy, PAPER.ink2);

    // 선수 줄: 타순 · 등번호 · 이름 · 이닝 칸(마름모 + 약어 · 오른쪽 위 타점) · 합계
    rows.forEach((r, i) => {
      const top = R0 + i * rh, cy = top + rh / 2 + 5, my = top + rh / 2;
      if (i) hl(X, W - X, top, r.slot != null ? ROW : HAIR);   // 교체로 들어온 선수 줄 위는 가는 선 (같은 타순)
      for (let k = 0; k < n; k++) if (r.blank || !r.cells[k].length) diamond(IX + iw * (k + 0.5), my, dr, 0, false);
      if (r.slot != null) { font(c, '600', 15, FONT.num); num(r.slot, X + SLOT / 2, cy + 0.5, r.blank ? PAPER.ink3 : PAPER.ink); }
      if (r.blank) return;
      let room = NAME - JN - 6 - P;
      if (r.tag) {
        font(c, '500', 11.5, FONT.kr); const tw = c.measureText(r.tag).width;
        text(r.tag, IX - 8, cy - 0.5, PAPER.ink2, 'right'); room -= tw + 6;
      }
      if (r.p.num !== '' && r.p.num != null) { font(c, '500', 13, FONT.num); text(String(r.p.num), X + SLOT + JN, cy, PAPER.ink2, 'right'); }
      fitFont(c, r.p.name, '700', 14.5, FONT.kr, room, 10); text(r.p.name, X + SLOT + JN + 6, cy, PAPER.ink);
      r.cells.forEach((cs, k) => {
        const sw = iw / cs.length;   // 한 이닝에 두 번 나오면 칸을 나눈다
        cs.forEach((p, j) => {
          const cx = IX + iw * k + sw * (j + 0.5), b = reach(p), pr = Math.min(dr, sw / 2 - 2);
          fitFont(c, p.code, '700', CF, FONT.kr, sw - 6, 7);   // 넘쳐도 칸 경계는 넘지 않게 (한 이닝 두 타석 · 긴 약어만 줄어든다)
          const m = c.measureText(p.code), bl = my + pr * TO + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;   // 실제 글자 상자의 가운데를 마름모 가운데(조금 아래)에
          diamond(cx, my, pr, b, p.scored || b === 4, [cx - m.width / 2 - 1, bl - m.actualBoundingBoxAscent - 1, m.width + 2, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + 2]);
          text(p.code, cx, bl, p.hit ? PAPER.acc : p.walk ? PAPER.bb : PAPER.out, 'center');
        });
        const rbi = cs.reduce((s, p) => s + p.rbi, 0);
        if (rbi) { font(c, '600', 11.5, FONT.num); text(String(rbi), IX + iw * (k + 1) - 3, top + 11.5, PAPER.acc, 'right'); }
      });
      font(c, '500', 15, FONT.num);
      r.tot.forEach((v, j) => num(v, TX + TW * (j + 0.5), cy + 0.5, PAPER.ink));
    });

    // 합계 줄: 이닝 칸에는 그 이닝 득점 (이닝별 점수와 같은 값)
    const tcy = ty + (y1 - ty) / 2 + 5;
    font(c, '700', 13, FONT.kr); text('합계', X + SLOT + JN + 6, tcy, PAPER.ink);
    font(c, '600', 14, FONT.num); t.line.forEach((v, k) => num(v, IX + iw * (k + 0.5), tcy + 0.5, PAPER.ink2));
    font(c, '700', 15, FONT.num); t.tot.forEach((v, j) => num(v, TX + TW * (j + 0.5), tcy + 0.5, PAPER.ink));

    // 선: 머리 줄 아래 = 줄, 칸 사이 = 가는 선, 선수 | 이닝 | 합계 · 합계 줄 위 = 구역
    hl(X, W - X, R0, ROW);
    vl(X + SLOT, y + BAND, ty, HAIR);
    for (let k = 1; k < n; k++) vl(IX + iw * k, y + BAND, y1, HAIR);
    for (let j = 1; j < TOT.length; j++) vl(TX + TW * j, y + BAND, y1, HAIR);
    hl(X, W - X, ty, HEAVY);
    vl(IX, y + BAND, y1, HEAVY); vl(TX, y + BAND, y1, HEAVY);
    frame(X, y, CW, y1 - y);
    y = y1 + GAP;
  });

  // 발 (아래 끝): 약어 네 줄(사이 16) · 서명 상자(마지막 약어 줄과 서명 이름 사이 34). 약어는 [이름] + 설명 (설명이 길면 그 줄만 10 까지 줄인 크기로)
  const SY = H - 32 - BOX, L3 = SY - LSTEP;
  const legend = (lbl, parts, ly) => {   // parts = [글자, 색] 또는 [null, 그리기(x, ly), 폭]
    font(c, '700', 11.5, FONT.kr); text(lbl, X, ly, PAPER.ink2);
    const x0 = X + LX, wide = () => parts.reduce((s, p) => s + (p[0] == null ? p[2] : c.measureText(p[0]).width), 0);
    let z = 11.5;
    for (font(c, '500', z, FONT.kr); z > 10 && wide() > W - X - x0; ) { z -= 0.25; font(c, '500', z, FONT.kr); }
    let x = x0;
    parts.forEach(p => { if (p[0] == null) p[1](x, ly); else text(p[0], x, ly, p[1]); x += p[0] == null ? p[2] : c.measureText(p[0]).width; });
  };
  const g = PAPER.ink2, ico = (b, run) => [null, (x, ly) => diamond(x + 7, ly - 4, 7, b, run), 19];   // 칸과 같은 마름모 (득점 = 옅게 칠함 + 테두리)
  legend('방향', [['좌 · 좌중 · 중 · 우중 · 우 = 타구 방향 (좌중안 = 좌중간 안타)    E = 실책으로 내보낸 타자 수', g]], L3 - LSTEP * 3);
  legend('칸', [['안 안타 · 2 2루타 · 3 3루타 · 홈 홈런 · 비 뜬공 · 4구 볼넷 · 희번 희생번트 · 희플 희생플라이 · 야선 야수선택', g]], L3 - LSTEP * 2);
  legend('표시', [ico(0, true), ['득점  ', g], ico(1, false), ['타자가 간 베이스 · 위 숫자 타점 · 글자색 ', g], ['안타', PAPER.acc], [' · ', g], ['4구 · 사구', PAPER.bb],
    [' · 득점 · 도루 빈칸 = 경기 운영 모드로 적지 않은 경기', g]], L3 - LSTEP);
  legend('수비', [['1 투수 · 2 포수 · 3 1루 · 4 2루 · 5 3루 · 6 유격 · 7 좌익 · 8 중견 · 9 우익    6-3 유격수 땅볼 1루 송구 · 3U 1루수 혼자 · F8 중견수 뜬공 · L6 유격수 직선타', g]], L3);
  const sw2 = (W - X - IX - 8) / 2;   // 서명 상자 왼쪽도 제목 · 이닝 칸 세로줄에
  [['기록원', X, IX - X - 8], ['원정 감독', IX, sw2], ['홈 감독', IX + sw2 + 8, sw2]].forEach(([s, x, w]) => {
    field(s, '', x, SY, w);
    font(c, '500', 12, FONT.kr); text('(서명)', x + w - P, SY + BOX - 10, PAPER.ink3, 'right');
  });
  return c;
}

// ── 창 ──────────────────────────────────────────────────────
let _cv = null, _ret = null, _seq = 0;

function _mount() {
  if ($('ssView')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div id="ssView" class="rp ss" role="dialog" aria-modal="true" aria-labelledby="ssTitle" hidden>
  <div class="rp-panel">
    <header class="rp-hd">
      <h2 id="ssTitle">리그 기록지</h2>
      <button type="button" class="rp-x" id="ssClose" aria-label="닫기">✕</button>
    </header>
    <div class="rp-body">
      <div class="rp-empty" id="ssEmpty" hidden>
        <svg class="ss-empty-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17H6z"/><path d="M9.5 2.5h5v3h-5zM6 10h12M6 15h12M10.5 5.5V21"/></svg>
        <b>아직 기록된 타석이 없어요</b>
        <span>기록 탭에서 타석 결과를 입력하면 기록지를 만들 수 있어요.</span>
      </div>
      <figure class="rp-prev ss-prev" id="ssPrev">
        <img id="ssImg" alt="경기 기록지 미리보기">
        <figcaption class="rp-help">저장·공유가 안 되는 브라우저(카톡 안 등)에서는 위 이미지를 길게 눌러 저장하세요.</figcaption>
      </figure>
    </div>
    <footer class="rp-act" id="ssAct">
      <button type="button" class="rp-btn primary" id="ssSave" disabled>이미지 저장 · 공유</button>
      <button type="button" class="rp-btn" id="ssPrint" disabled>인쇄 / PDF</button>
    </footer>
  </div>
</div>`);
  $('ssClose').onclick = closeScoresheet;
  $('ssView').addEventListener('click', e => { if (e.target.id === 'ssView') closeScoresheet(); });
  // Esc 는 문서에서 받는다 — 미리보기 이미지 · 창 머리를 누르면 포커스가 창 밖(body)으로 빠진다
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('ssView').hidden) closeScoresheet(); });
  $('ssSave').onclick = () => { if (_cv) window._downloadCanvas(_cv, 'spraylab_scoresheet_' + Date.now() + '.png'); };
  $('ssPrint').onclick = () => {
    if (!_cv) return;
    const b = document.body, off = () => { b.classList.remove('ss-printing'); window.removeEventListener('afterprint', off); };
    b.classList.add('ss-printing');
    window.addEventListener('afterprint', off);
    window.print();
  };
}

// 경기일: 경기 정보(YYYY-MM-DD) → 저장 항목의 날짜 → 빈칸
function _date(info) {
  if (info && typeof info.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(info.date)) return info.date.replace(/-/g, '.');
  try { const s = JSON.parse(localStorage.getItem(window._curSaveKey)); if (s && typeof s.d === 'string') return s.d; } catch (e) {}
  return '';
}

async function _render() {
  const seq = ++_seq, A = window.AS, info = A.info || {};
  $('ssSave').disabled = $('ssPrint').disabled = true;
  const d = sheetData({
    abs: A.abs, home_lineup: A.home_lineup, away_lineup: A.away_lineup, info, hs: A.hs, as: A.as,
    th: ($('tHome') || {}).value, ta: ($('tAway') || {}).value, date: _date(info), venue: typeof info.venue === 'string' ? info.venue : '',
  });
  const cv = document.createElement('canvas');
  await drawWithFonts(cv, () => drawSheet(cv, d));   // 그린 글자의 웹폰트 묶음을 받은 뒤 다시 그린다 ('팀' 만 기본 글꼴로 찍히던 문제)
  if (seq !== _seq) return;
  _cv = cv;
  $('ssImg').src = cv.toDataURL('image/png');
  $('ssSave').disabled = $('ssPrint').disabled = false;
}

export function openScoresheet() {
  _mount();
  const v = $('ssView'), has = !!(window.AS && Array.isArray(window.AS.abs) && window.AS.abs.length);
  _cv = null;
  $('ssImg').removeAttribute('src');
  $('ssEmpty').hidden = has; $('ssPrev').hidden = !has; $('ssAct').hidden = !has;
  v.classList.toggle('ss-none', !has);   // 타석이 없으면 창을 안내 크기로 줄인다 (css/report.css #ssView.ss-none)
  if (v.hidden) {
    _ret = document.activeElement;
    v.hidden = false;
    document.documentElement.classList.add('rp-open');
  }
  setTimeout(() => { try { $('ssClose').focus(); } catch (e) {} }, 30);
  if (has) _render().catch(() => { if (window.showToast) window.showToast('기록지를 그리지 못했어요', false); });
}

export function closeScoresheet() {
  const v = $('ssView');
  if (!v || v.hidden) return;
  v.hidden = true;
  _seq++;
  document.documentElement.classList.remove('rp-open');
  try { if (_ret && _ret.focus) _ret.focus(); } catch (e) {}
}

// 경기종료 뒤 뜨는 GAME REPORT(core.js gfEndGame → showPostGameReport) 공유 줄: [스토리 9:16] [피드 1:1] [리그 기록지]
// 리포트는 그대로 두고 그 위에 연다 (기록지를 닫으면 리포트로 돌아온다)
const _row = document.querySelector('#pgReport .pg-share-row');
if (_row && !$('pgSheetBtn')) _row.insertAdjacentHTML('beforeend', '<button class="pg-sh-btn" id="pgSheetBtn" onclick="openScoresheet()">📋 리그 기록지</button>');

window.openScoresheet = openScoresheet;
window.closeScoresheet = closeScoresheet;
