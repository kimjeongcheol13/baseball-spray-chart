// 리그 제출용 기록지 — 이번 경기를 A4 세로 한 장으로: 이닝별 점수(R H E) · 양 팀 타순 × 이닝 칸 · 선수별 합계 · 기록원 서명 칸
//  · 읽기만 한다 (AS.abs · 라인업 · AS.info · runners.js 의 득점 slLineScore · slRunnerStats · core.js _cardStats) — 저장 구조 · 키 변경 없음
//  · 칸 = 중계 문자 약어 (좌안 · 중2 · 우홈 · 중비 · 땅볼 · 삼진 · 4구 …). 방향은 필드를 탭한 타구만. 아웃에 수비 기록(6-3 · 3U · F8 · L6 — fielding.js)이 있으면 그것
//  · 타순 = 지금 주전 순서, 자리마다 교체 기록(runEv SUB)을 거슬러 처음 선수부터. 라인업에 없는 타자는 맨 아래 (첫 타석 순)
//  · 득점 · 도루는 경기 운영 모드로 적은 경기만 (그 밖의 경기는 빈칸 — 0 으로 적지 않는다). E = 상대 타자가 실책으로 나간 수
//  · 이미지 저장 = core.js _downloadCanvas · 인쇄 / PDF = 이 그림 한 장만 (body.ss-printing · css/report.css)
//  · 창은 선수 리포트(.rp) 모양을 그대로 쓴다. 진입: ☰ 메뉴 · 그 밖의 기능(setup.js) · 경기종료 뒤 GAME REPORT 공유 줄(#pgReport — 버튼 추가)
import { HITS } from '../constants.js';
import { FONT, PAPER, font, fitFont, spacing, rr, wordmark, drawWithFonts } from './imgkit.js?v=1';

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
//  · 머리(로고 · 제목 · 칸 상자) / 이닝별 점수(R H E) / 팀마다 표 / 발(약어 세 줄 · 서명 상자). 발은 아래 끝에 붙이고 줄 높이를 늘려 표가 발까지 닿게 한다
//  · 팀 표는 9줄이 안 되면 빈 줄(손으로 적는다). 타석이 하나도 없는 팀은 띠에 '타석 기록 없음' 알약
//  · 색 · 글꼴은 imgkit.js 의 PAPER · FONT 만 — 칸 글자: 안타 = acc, 4구 · 사구 = bb, 그 밖 = out
const W = 794, H0 = 1123, SCALE = 2, X = 32, CW = W - X * 2;
const TOT = ['타수', '안타', '타점', '득점', '4구', '사구', '삼진', '도루'];
const SLOT = 28, NAME = 124, TW = 26, MINR = 9;
const BOX = 46, LT = 184, LBAND = 24, LROW = 28, TOP = 278, FOOT = 150, BAND = 26, HEAD = 22, GAP = 14, LX = 34;
const snap = v => Math.round(v * 2) / 2;   // 2배 PNG 에서 선이 두 픽셀에 번지지 않게

// 9줄이 안 되는 팀은 빈 줄을 붙인다 — 타순 번호는 마지막 타순 다음부터 9까지 (타순을 모르는 팀은 번호 없이)
function padRows(rows) {
  const m = rows.reduce((s, r) => (r.slot > s ? r.slot : s), 0), num = !rows.length || m > 0;
  return rows.concat(Array.from({ length: Math.max(0, MINR - rows.length) }, (_, i) => ({ slot: num && m + i + 1 <= MINR ? m + i + 1 : null, blank: true })));
}

export function drawSheet(cv, d) {
  const n = d.n, all = d.teams.map(t => padRows(t.rows));
  const lines = all.reduce((s, rows) => s + rows.length + 1, 0);   // 선수 줄 + 합계 줄
  const fixed = d.teams.length * (BAND + HEAD + GAP) - GAP;
  const rh = Math.max(18, (H0 - TOP - FOOT - fixed) / lines);
  const H = Math.max(H0, Math.ceil(TOP + FOOT + fixed + lines * rh));
  cv.width = W * SCALE; cv.height = H * SCALE;
  const c = cv.getContext('2d');
  c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  c.textBaseline = 'alphabetic';
  c.fillStyle = PAPER.bg; c.fillRect(0, 0, W, H);
  const text = (t, x, y, col, al) => { c.fillStyle = col; c.textAlign = al || 'left'; c.fillText(t, x, y); };
  const hl = (x1, x2, y, col, lw) => { c.fillStyle = col; c.fillRect(x1, y - (lw || 1) / 2, x2 - x1, lw || 1); };
  const vl = (x, y1, y2, col) => { c.fillStyle = col; c.fillRect(x - 0.5, y1, 1, y2 - y1); };
  const frame = (x, y, w, h, col) => { c.strokeStyle = col; c.lineWidth = 1; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, 6); c.stroke(); };
  const dot = (x, y) => { c.fillStyle = PAPER.acc; c.beginPath(); c.arc(x, y, 2.4, 0, Math.PI * 2); c.fill(); };
  // 칸 상자: 위에 작은 이름, 아래에 값 (값이 없으면 손으로 적는 빈칸)
  const field = (lbl, val, x, y, w, num) => {
    frame(x, y, w, BOX, PAPER.rule);
    font(c, '700', 10, FONT.kr); text(lbl, x + 12, y + 16, PAPER.ink2);
    if (val) { fitFont(c, val, num ? '600' : '700', num ? 16 : 15, num ? FONT.num : FONT.kr, w - 24, 10); text(val, x + 12, y + 37, PAPER.ink); }
  };
  const third = (CW - 24) / 3;

  // 머리: 로고 · 문서 이름 / 제목 / 대회 · 경기일 · 구장
  wordmark(c, X, 40, 13, PAPER.ink, PAPER.acc);
  font(c, '600', 11, FONT.num); spacing(c, 2.2); text('SCORE SHEET', W - X + 2.2, 40, PAPER.ink2, 'right'); spacing(c, 0);
  font(c, '900', 36, FONT.kr); text('경기 기록지', X - 1, 100, PAPER.ink);
  [['대회', ''], ['경기일', d.date, 1], ['구장', d.venue]].forEach((f, i) => field(f[0], f[1], X + (third + 12) * i, 120, third, f[2]));

  // 이닝별 점수 (R H E) — 어두운 띠에 이닝 번호, R H E 칸은 옅은 바탕
  const NW = 184, RW = 42, RX = W - X - RW * 3, iwL = (RX - X - NW) / n, LB = LT + LBAND + LROW * d.teams.length;
  c.save(); rr(c, X, LT, CW, LB - LT, 6); c.clip();
  c.fillStyle = PAPER.band; c.fillRect(X, LT, CW, LBAND);
  c.fillStyle = PAPER.fill; c.fillRect(RX, LT + LBAND, RW * 3, LB - LT - LBAND);
  c.restore();
  font(c, '700', 11, FONT.kr); text('팀', X + 12, LT + 16.5, PAPER.bg);
  font(c, '600', 12, FONT.num);
  for (let k = 0; k < n; k++) text(String(k + 1), X + NW + iwL * (k + 0.5), LT + 17, PAPER.bg, 'center');
  font(c, '700', 12, FONT.num);
  ['R', 'H', 'E'].forEach((s, j) => text(s, RX + RW * (j + 0.5), LT + 17, PAPER.bg, 'center'));
  d.teams.forEach((t, i) => {
    const y = LT + LBAND + LROW * i, cy = y + LROW / 2 + 5;
    if (i) hl(X, W - X, y, PAPER.rule2);
    const lbl = t.side + (t.first ? ' · 선공' : '');
    font(c, '500', 10.5, FONT.kr); text(lbl, X + 12, cy - 0.5, PAPER.ink2);
    const sw = c.measureText(lbl).width;
    fitFont(c, t.name, '700', 14, FONT.kr, NW - sw - 32, 9); text(t.name, X + 20 + sw, cy, PAPER.ink);
    font(c, '600', 15, FONT.num);
    t.line.forEach((v, k) => text(v, X + NW + iwL * (k + 0.5), cy + 0.5, PAPER.ink, 'center'));
    font(c, '700', 17, FONT.num); text(String(t.r), RX + RW * 0.5, cy + 1, PAPER.ink, 'center');
    font(c, '600', 15, FONT.num);
    text(String(t.h), RX + RW * 1.5, cy + 0.5, PAPER.ink, 'center');
    text(String(t.e), RX + RW * 2.5, cy + 0.5, PAPER.ink, 'center');
  });
  vl(X + NW, LT + LBAND, LB, PAPER.ink3);
  for (let k = 1; k < n; k++) vl(X + NW + iwL * k, LT + LBAND, LB, PAPER.rule2);
  vl(RX, LT + LBAND, LB, PAPER.ink3); vl(RX + RW, LT + LBAND, LB, PAPER.rule); vl(RX + RW * 2, LT + LBAND, LB, PAPER.rule);
  frame(X, LT, CW, LB - LT, PAPER.ink);

  // 팀마다: 띠 · 머리 줄 · 선수 줄(한 줄 걸러 옅은 바탕) · 합계
  const IX = X + SLOT + NAME, TX = W - X - TW * TOT.length, iw = (TX - IX) / n;
  // 칸 글자 크기: 가장 긴 약어가 칸에 들어가는 크기 하나로 (한 장 안에서 고르게) — 10 아래로는 그 약어만 더 줄인다
  let cf = 13;
  all.forEach(rows => rows.forEach(r => (r.cells || []).forEach(cs => cs.forEach(p => { cf = Math.min(cf, fitFont(c, p.code, '700', 13, FONT.kr, iw - 12, 10)); }))));
  let y = TOP;
  d.teams.forEach((t, ti) => {
    const rows = all[ti], R0 = y + BAND + HEAD, ry = i => snap(R0 + i * rh), y1 = ry(rows.length + 1);
    c.save(); rr(c, X, y, CW, y1 - y, 6); c.clip();
    c.fillStyle = PAPER.band; c.fillRect(X, y, CW, BAND);
    c.fillStyle = PAPER.fill; c.fillRect(X, y + BAND, CW, HEAD); c.fillRect(X, ry(rows.length), CW, y1 - ry(rows.length));
    c.fillStyle = PAPER.zebra;
    rows.forEach((r, i) => { if (i % 2) c.fillRect(X, ry(i), CW, ry(i + 1) - ry(i)); });
    c.restore();

    // 띠: 원정 · 팀 이름 (· 타석 기록 없음) / 선공 · 득점 3
    font(c, '700', 11, FONT.kr); const side = (t.first ? '선공' : '후공') + ' · 득점 ', sdw = c.measureText(side).width;
    font(c, '700', 15, FONT.num); const rw = c.measureText(String(t.r)).width;
    font(c, '700', 11, FONT.kr); text(side, W - X - 12 - rw, y + 17.5, PAPER.ink3, 'right');
    font(c, '700', 15, FONT.num); text(String(t.r), W - X - 12, y + 18.5, PAPER.bg, 'right');
    font(c, '500', 12, FONT.kr); text(t.side, X + 12, y + 17.5, PAPER.rule);
    const nx = X + 12 + c.measureText(t.side).width + 8, note = '타석 기록 없음 · 빈 줄은 손으로';
    font(c, '700', 10.5, FONT.kr); const pw = t.rows.length ? 0 : c.measureText(note).width + 20;
    fitFont(c, t.name, '700', 14, FONT.kr, W - X - 12 - rw - sdw - 24 - nx - (pw ? pw + 12 : 0), 9); text(t.name, nx, y + 18, PAPER.bg);
    if (pw) {
      const px = nx + c.measureText(t.name).width + 12;
      c.fillStyle = PAPER.ink2; rr(c, px, y + 5, pw, 16, 8); c.fill();
      font(c, '700', 10.5, FONT.kr); text(note, px + pw / 2, y + 16.5, PAPER.bg, 'center');
    }

    // 머리 줄
    const hy = y + BAND + 15;
    font(c, '700', 10, FONT.kr);
    text('타순', X + SLOT / 2, hy, PAPER.ink2, 'center'); text('선수', X + SLOT + 8, hy, PAPER.ink2);
    TOT.forEach((s, j) => text(s, TX + TW * (j + 0.5), hy, PAPER.ink2, 'center'));
    font(c, '600', 11, FONT.num);
    for (let k = 0; k < n; k++) text(String(k + 1), IX + iw * (k + 0.5), hy + 0.5, PAPER.ink2, 'center');

    // 선수 줄
    rows.forEach((r, i) => {
      const top = R0 + i * rh, cy = top + rh / 2 + 4.5;
      if (i) hl(X, W - X, ry(i), r.slot != null ? PAPER.rule : PAPER.rule2);   // 교체로 들어온 선수 줄 위는 옅게 (같은 타순)
      if (r.slot != null) { font(c, '600', 13, FONT.num); text(String(r.slot), X + SLOT / 2, cy + 0.5, r.blank ? PAPER.ink3 : PAPER.ink, 'center'); }
      if (r.blank) return;
      let nx2 = X + SLOT + (r.slot != null ? 8 : 16), room = NAME - (r.slot != null ? 14 : 22);
      if (r.tag) {
        font(c, '700', 9, FONT.kr); const tw = c.measureText(r.tag).width;
        text(r.tag, X + SLOT + NAME - 6, cy - 0.5, PAPER.ink2, 'right'); room -= tw + 5;
      }
      if (r.p.num !== '' && r.p.num != null) {
        font(c, '500', 11, FONT.num); const s = '#' + r.p.num;
        text(s, nx2, cy, PAPER.ink3); const w = c.measureText(s).width + 4; nx2 += w; room -= w;
      }
      fitFont(c, r.p.name, '700', 12.5, FONT.kr, room, 8); text(r.p.name, nx2, cy, PAPER.ink);
      r.cells.forEach((cs, k) => {
        if (!cs.length) return;
        const cx = IX + iw * (k + 0.5), fs = Math.min(cf, (rh - 6) / cs.length);
        cs.forEach((p, j) => {
          fitFont(c, p.code, '700', fs, FONT.kr, iw - 12, 6);   // 양옆 6 — 왼쪽 위 득점 점 · 오른쪽 위 타점 숫자 자리
          text(p.code, cx, top + (rh - fs * cs.length) / 2 + fs * (j + 0.82), p.hit ? PAPER.acc : p.walk ? PAPER.bb : PAPER.out, 'center');
        });
        if (cs.some(p => p.scored)) dot(IX + iw * k + 4.5, top + 4.5);
        const rbi = cs.reduce((s, p) => s + p.rbi, 0);
        if (rbi) { font(c, '600', 9, FONT.num); text(String(rbi), IX + iw * (k + 1) - 4, top + 10, PAPER.acc, 'right'); }
      });
      font(c, '500', 13, FONT.num);
      r.tot.forEach((v, j) => text(String(v), TX + TW * (j + 0.5), cy + 0.5, PAPER.ink, 'center'));
    });

    // 합계 줄
    const ty = ry(rows.length), tcy = ty + (y1 - ty) / 2 + 4.5;
    hl(X, W - X, ty, PAPER.ink3);
    font(c, '700', 11, FONT.kr); text('합계', X + (SLOT + NAME) / 2, tcy, PAPER.ink, 'center');
    font(c, '700', 13, FONT.num);
    t.tot.forEach((v, j) => text(String(v), TX + TW * (j + 0.5), tcy + 0.5, PAPER.ink, 'center'));

    // 세로줄 · 테두리
    hl(X, W - X, R0, PAPER.rule);
    vl(X + SLOT, y + BAND, ty, PAPER.rule2);
    vl(IX, y + BAND, y1, PAPER.ink3);
    for (let k = 1; k < n; k++) vl(IX + iw * k, y + BAND, y1, PAPER.rule);
    vl(TX, y + BAND, y1, PAPER.ink3);
    for (let j = 1; j < TOT.length; j++) vl(TX + TW * j, y + BAND, y1, PAPER.rule2);
    frame(X, y, CW, y1 - y, PAPER.ink);
    y = y1 + GAP;
  });

  // 발 (아래 끝): 약어 세 줄 · 서명 상자. 약어는 [이름] + 설명 (설명이 길면 줄인 크기로) — 서명과는 30 이상 띄운다
  const SY = H - 32 - BOX, L3 = SY - 17;
  const legend = (lbl, parts, ly, mark) => {   // parts = [[글자, 색], …]
    font(c, '700', 10, FONT.kr); text(lbl, X, ly, PAPER.ink);
    const x0 = X + LX + (mark ? 9 : 0), s = parts.map(p => p[0]).join('');
    let z = 10;
    for (font(c, '500', z, FONT.kr); z > 7 && c.measureText(s).width > W - X - x0; ) { z -= 0.25; font(c, '500', z, FONT.kr); }
    if (mark) dot(X + LX + 2.5, ly - 3.5);   // 칸에 찍는 점과 같은 모양
    let x = x0;
    parts.forEach(p => { text(p[0], x, ly, p[1]); x += c.measureText(p[0]).width; });
  };
  const g = PAPER.ink2;
  legend('칸', [['좌 · 좌중 · 중 · 우중 · 우 = 타구 방향    안 안타 · 2 2루타 · 3 3루타 · 홈 홈런 · 비 뜬공 · 4구 볼넷 · 희번 희생번트 · 희플 희생플라이 · 야선 야수선택', g]], L3 - 30);
  legend('표시', [['득점한 타석 · 칸 오른쪽 위 숫자 = 타점 · 글자색 ', g], ['안타', PAPER.acc], [' · ', g], ['4구 · 사구', PAPER.bb], [' · E = 실책으로 내보낸 타자 수 · 득점 · 도루 빈칸 = 경기 운영 모드로 적지 않은 경기', g]], L3 - 15, true);
  legend('수비', [['1 투수 · 2 포수 · 3 1루 · 4 2루 · 5 3루 · 6 유격 · 7 좌익 · 8 중견 · 9 우익    6-3 유격수 땅볼 1루 송구 · 3U 1루수 혼자 · F8 중견수 뜬공 · L6 유격수 직선타', g]], L3);
  ['기록원', '원정 감독', '홈 감독'].forEach((s, i) => {
    const x = X + (third + 12) * i;
    field(s, '', x, SY, third);
    font(c, '500', 10, FONT.kr); text('(서명)', x + third - 12, SY + BOX - 10, PAPER.ink3, 'right');
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
