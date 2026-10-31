// 성적 카드 3종(개인 · 팀 · 시즌) + GAME REPORT 공유 이미지 — 어두운 카드형(분석 화면 css/v2.css 와 같은 색 · 둥근 카드). core.js 의 _drawCard · pgExport 를 바꿔 낀다
//  · 무엇을 그릴지는 core.js 그대로 읽는다 (_cardPlayers · _cardStats · _cardAbText · _cardInn · _cardDate · _cardFmt · _readSavedGames · _isPull · _isCtr)
//    선수 고르기 · 타석 고르기 · 배지 규칙 · 승무패 · 지표 계산은 core 의 _drawPersonalCard / _drawTeamCard / _drawSeasonCard 와 같다. 그리기만 새로
//  · 모양: 거의 검은 바탕 + 테두리 없는 둥근 카드(모서리 R) · 맨 위 카드에만 주황 빛 · 라벨은 한글 14px 이상 · 숫자는 Oswald 크게
//  · 간격: 모든 카드의 왼쪽 = X · 카드 안 여백 PAD · 카드 사이 G. 맨 위 줄(카드 밖)은 무엇의 카드인지(점수 · 제목) + 날짜
//  · 구장은 Statcast 식 선 그림: 옅은 페어 지역 · 펜스 호 · 파울라인 · 내야 호 · 다이아몬드 · 거리 점선 호. 점은 결과 색 + 카드색 테
//  · 크기는 그대로: 개인 · 시즌 540×960(9:16), 팀 540×540(1:1) → 2배 PNG (#cardPreviewCanvas)
//  · core 는 _drawCard 를 전역 이름으로 부른다(열기 · 종류 바꾸기 · 선수 바꾸기 · 글꼴 로드 뒤) → window._drawCard 를 바꾸면 모두 새 그림

import { FONT, DARK as D, font, fitFont, rr, drawWithFonts, dCard as card, dPill as pill, dFoot, tint } from './imgkit.js?v=3';
import { WOBA_W } from '../constants.js';

const $ = id => document.getElementById(id);
const SCALE = 2, W = 540, X = 20, CW = W - X * 2, PAD = 20, G = 12, FOOT = 48, TAU = Math.PI * 2;
// 카드 · 타일 모서리, 맨 위 줄 기준선 · 첫 카드 y, 타석 한 줄 높이
const R = 20, TR = 16, TL = 40, TOP = 60, RH = 36;
// 글자 크기 단계: 큰 제목(선수 · 팀 이름) · 큰 숫자 줄(한 줄 성적)
const HERO = 54, BIG = 40, BIGU = 18;
// 구장 선 색: 페어 지역 · 파울라인 · 펜스 · 거리 호
const FAN = 'rgba(255,255,255,0.04)', FOUL = 'rgba(255,255,255,0.45)', FENCE = 'rgba(255,255,255,0.3)', ARC = 'rgba(255,255,255,0.12)';

// 결과 → 색 종류: hr 홈런 · xbh 2·3루타 · hit 안타 · bb 볼넷 · 사구 · out 그 밖(아웃 · 희생 · 실책 · 야수선택 …)
const kind = r => r === '홈런' ? 'hr' : r === '2루타' || r === '3루타' ? 'xbh' : (window.CARD_HITS || []).indexOf(r) !== -1 ? 'hit' : r === '볼넷' || r === '사구' ? 'bb' : 'out';
const COL = { hit: D.hit, xbh: D.xbh, hr: D.hr, bb: D.bb, out: D.out };
// 결과 → 기록 약어. 땅볼 · 뜬공 · 라인드라이브 아웃에 수비 기록(6-3 · F8 — fielding.js a.fp)이 있으면 그것
const CODE = { __proto__: null,
  '안타': '1B', '내야안타': '1B', '2루타': '2B', '3루타': '3B', '홈런': 'HR', '볼넷': 'BB', '사구': 'HBP', '삼진': 'K',
  '땅볼 아웃': 'GO', '플라이 아웃': 'FO', '라인드라이브 아웃': 'LO', '희비': 'SF', '희타': 'SAC', '실책': 'E', '야수선택': 'FC', '병살': 'DP', '삼중살': 'TP',
};
const FPR = ['땅볼 아웃', '플라이 아웃', '라인드라이브 아웃'];
const code = a => (FPR.indexOf(a.res) !== -1 && a.fp) || CODE[a.res] || '';
const fmt = v => window._cardFmt(v);
const stadium = () => window.STADIUMS[window.AS.stadium] || window.STADIUMS.standard;

const txt = (c, t, x, y, color, align) => { c.fillStyle = color; c.textAlign = align || 'left'; c.fillText(t, x, y); };
// 글자를 세로 가운데에 놓을 기준선 보정 (번호 원 · 칩)
const mid = (c, t) => { const m = c.measureText(t); return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2; };
const rule = (c, x, y, w) => { c.fillStyle = D.line; c.fillRect(x, y - .5, w, 1); };
// 소수점 맞춤: '.' 앞은 x 에 오른쪽 맞춤, '.' 부터 왼쪽 맞춤 → 위아래 줄의 .333 · 1.050 이 점에서 맞는다 ('-' 는 칸 가운데)
function dec(c, t, x, y, col) {
  const i = t.indexOf('.');
  if (i < 0) return txt(c, t, x + c.measureText('.00').width / 2, y, col, 'center');
  if (i) txt(c, t.slice(0, i), x, y, col, 'right');
  txt(c, t.slice(i), x, y, col, 'left');
}

// ── 한 줄에 글꼴이 다른 조각: parts = [[글자, 굵기, 크기, 글꼴, 색, 뒤 간격], …] ──
const runW = (c, parts) => parts.reduce((s, p, i) => { font(c, p[1], p[2], p[3]); return s + c.measureText(p[0]).width + (i < parts.length - 1 ? p[5] || 0 : 0); }, 0);
// maxW 를 넘으면 모든 조각을 같은 비율로 줄인 새 조각
function fitParts(c, parts, maxW) {
  const base = parts;
  for (let k = 1; maxW && k > .4 && runW(c, parts) > maxW;) { k -= .03; parts = base.map(p => { const q = p.slice(); q[2] = p[2] * k; q[5] = (p[5] || 0) * k; return q; }); }
  return parts;
}
// 한 줄 그리기 (maxW 에 맞춰 줄임). 그린 폭 반환
function runs(c, parts, x, y, align, maxW) {
  parts = fitParts(c, parts, maxW);
  const w = runW(c, parts);
  let lx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  parts.forEach(p => { font(c, p[1], p[2], p[3]); txt(c, p[0], lx, y, p[4]); lx += c.measureText(p[0]).width + (p[5] || 0); });
  return w;
}
// 숫자(Oswald) + 단위(한글) 묶음: [[4, '타수'], [2, '안타', 색]] → "4타수 2안타"
const tokens = (list, n, u, gap) => list.reduce((a, t, i) => a.concat([
  [String(t[0]), '700', n, FONT.num, t[2] || D.tx, n * .06], [t[1], '500', u, FONT.kr, D.tx2, i < list.length - 1 ? gap : 0]]), []);

// ── 바탕 · 꼬리 ────────────────────────────────────────
// 캔버스 크기 · 화면 맞춤(높이 60% 안) · 바탕색. sc = 배율(카드 2배 · GAME REPORT 는 내보낼 폭 / 540)
function begin(cv, H, sc = SCALE) {
  cv.width = W * sc; cv.height = H * sc;
  cv.style.width = '100%'; cv.style.height = 'auto'; cv.style.maxWidth = 'calc(60vh * ' + (W / H).toFixed(4) + ')'; cv.style.margin = '0 auto';
  const c = cv.getContext('2d');
  c.setTransform(sc, 0, 0, sc, 0, 0); c.textBaseline = 'alphabetic'; c.letterSpacing = '0px';
  c.fillStyle = D.bg; c.fillRect(0, 0, W, H);
  return c;
}
// 꼬리: 로고(왼쪽, 카드에 한 번) · 계정(오른쪽). 띠 · 선 없이 바탕 위에 (imgkit dFoot)
const footer = (c, H) => dFoot(c, W, H - 19, X);

// ── 부품 ─────────────────────────────────────────────
// 카드 · 꼬리표 · 옅은 바탕은 imgkit (dCard · dPill · tint)
const title = (c, t, x, y) => { font(c, '700', 18, FONT.kr); txt(c, t, x, y, D.tx); };
// 맨 위 줄 오른쪽 날짜 (숫자만이면 Oswald, '2026년 10월 29일' 은 한글 글꼴)
function date(c, t) { font(c, '500', 16, /[가-힣]/.test(t) ? FONT.kr : FONT.num); txt(c, t, W - X, TL, D.tx2, 'right'); return c.measureText(t).width; }
// 맨 위 줄: 주황 제목 + 날짜 (팀 · 시즌 · GAME REPORT)
function eyebrow(c, t, d) { date(c, d); font(c, '700', 16, FONT.kr); txt(c, t, X, TL, D.acc); }
// 맨 위 줄(개인): [우리 팀 3 : 2 상대] [승] … 날짜. 점수가 없으면(0:0) "우리 팀 vs 상대". ours = 왼쪽이 우리 팀(승 · 패 꼬리표)
function scoreLine(c, t1, t2, s1, s2, ours) {
  const dw = date(c, window._cardDate()), has = s1 || s2;
  const parts = has
    ? [[t1, '700', 17, FONT.kr, s1 >= s2 ? D.tx : D.tx2, 10], [String(s1), '700', 24, FONT.num, s1 >= s2 ? D.tx : D.tx2, 7], [':', '500', 18, FONT.num, D.tx3, 7],
       [String(s2), '700', 24, FONT.num, s2 >= s1 ? D.tx : D.tx2, 10], [t2, '700', 17, FONT.kr, s2 >= s1 ? D.tx : D.tx2]]
    : [[t1, '700', 17, FONT.kr, D.tx, 8], ['vs', '500', 15, FONT.num, D.tx3, 8], [t2, '700', 17, FONT.kr, D.tx]];
  const r = has && ours ? (s1 > s2 ? ['승', D.good] : s1 < s2 ? ['패', D.bad] : ['무', D.out]) : null;
  const w = runs(c, parts, X, TL, 'left', CW - dw - (r ? 56 : 0) - 16);
  if (r) pill(c, r[0], X + w + 12, TL - 7, r[1], tint(r[1], .16));
}
// 지표 타일: 줄마다 네 칸(둥근 타일) · 라벨 위 · 값 아래. 값은 한 크기(가장 긴 값에 맞춤). hi = 첫 줄의 주황 값 칸. 그린 높이 반환
function kpis(c, x, y, w, h, rows, hi, fill) {
  const gap = 10, tw = (w - gap * 3) / 4;
  let z = h < 76 ? 28 : 32;
  rows.forEach(r => r.forEach(v => { z = Math.min(z, fitFont(c, v[1], '700', z, FONT.num, tw - 32, 16)); }));
  rows.forEach((r, j) => r.forEach((v, i) => {
    const tx = x + (tw + gap) * i, ty = y + (h + gap) * j;
    rr(c, tx, ty, tw, h, TR); c.fillStyle = fill || D.card; c.fill();
    fitFont(c, v[0], '500', 14, FONT.kr, tw - 28, 11); txt(c, v[0], tx + 16, ty + 26, D.tx2);
    font(c, '700', z, FONT.num); txt(c, v[1], tx + 16, ty + h - 13, v[1] === '-' ? D.tx3 : !j && i === hi ? D.acc : D.tx);
  }));
  return rows.length * (h + gap) - gap;
}
const slash = s => [['타율', fmt(s.avg)], ['출루율', fmt(s.obp)], ['장타율', fmt(s.slg)], ['OPS', fmt(s.ops)]];

// 타구 점: 결과 색 원 + 카드색 테 1.5px(겹쳐도 갈라 보이게) · 아웃 = 회색 빈 고리 · 홈런 = 조금 크게 + 바깥 가는 고리
function mark(c, x, y, r, k, num) {
  if (k === 'hr') { r *= 1.12; c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.strokeStyle = D.hr; c.lineWidth = 1; c.stroke(); }
  c.beginPath(); c.arc(x, y, r + 1.5, 0, TAU); c.fillStyle = D.card; c.fill();
  c.beginPath();
  if (k === 'out') { c.arc(x, y, r - .75, 0, TAU); c.strokeStyle = D.out; c.lineWidth = 1.5; c.stroke(); }
  else { c.arc(x, y, r, 0, TAU); c.fillStyle = COL[k]; c.fill(); }
  if (num == null) return;
  const t = String(num);
  font(c, '600', Math.round(r * 1.15), FONT.num);
  txt(c, t, x, y + mid(c, t), k === 'out' ? D.tx2 : k === 'hit' || k === 'bb' ? D.tx : D.bg, 'center');
}
// 범례(카드 아래 두 모서리 — 구장 홈 옆은 비어 있다): 왼쪽 ● 안타 ● 장타 · 오른쪽 ◉ 홈런 ○ 아웃. b = 기준선
function legend(c, x, w, b) {
  const side = (it, lx, align) => {
    font(c, '500', 14, FONT.kr);
    const ws = it.map(v => c.measureText(v[0]).width), tot = ws.reduce((s, v) => s + v + 34, -16);
    let cx = align === 'right' ? lx - tot : lx;
    it.forEach((v, i) => { mark(c, cx + 6, b - 5, 5, v[1]); font(c, '500', 14, FONT.kr); txt(c, v[0], cx + 18, b, D.tx2); cx += ws[i] + 34; });
  };
  side([['안타', 'hit'], ['장타', 'xbh']], x + PAD, 'left');
  side([['홈런', 'hr'], ['아웃', 'out']], x + w - PAD, 'right');
}

// ── 스프레이 차트 (Statcast 식) ─────────────────────────────
// 옅은 페어 지역 · 내야 호 · 거리 점선 호 · 다이아몬드 · 파울라인 · 펜스(가장 굵은 선) · 작은 베이스 · 홈
// 각도 · 거리 옮기기는 core.js 와 같다 (_conePt · _fenceR · _semiToCone — 저장 각도 0~180° → 90° 부채꼴, 거리는 "펜스까지 비율")
// S = 중앙 펜스까지(px). mode: 'num' 번호 원(개인) · 'dot' 작은 점(시즌) · 'mini' 거리 글자 없이 점만 · 없으면 빈 구장(빈 상태)
function field(c, cx, cy, S, abs, mode) {
  const st = stadium(), g = { cx, cy, R: S, kl: st.lfDist / st.cfDist, kr: st.rfDist / st.cfDist }, m = S / st.cfDist, Q = window._FQ;
  const pt = (phi, r) => window._conePt(g, phi, r), fence = phi => window._fenceR(g, phi);
  const fenceLine = join => { for (let i = 0; i <= 72; i++) { const ph = Q + 2 * Q * i / 72, p = pt(ph, fence(ph)); i || join ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } };
  const base = st.base || 27.43, b = base * m, md = pt(2 * Q, (st.mound || 18.44) * m);
  const bs = [pt(3 * Q, b), pt(2 * Q, b * Math.SQRT2), pt(Q, b)], lp = pt(Q, fence(Q)), rp = pt(3 * Q, fence(3 * Q));
  // 거리 호: 30m(작은 구장 20m) 마다, 짧은 쪽 폴보다 반 칸 안쪽까지
  const step = st.cfDist >= 100 ? 30 : 20, dists = [];
  for (let d = step; d < Math.min(st.lfDist, st.rfDist) - step / 2; d += step) dists.push(d);
  c.save();
  c.beginPath(); c.moveTo(cx, cy); fenceLine(true); c.closePath(); c.fillStyle = FAN; c.fill();
  c.save(); c.clip();
  // 내야 잔디 경계(마운드 중심 29m 원 — 페어 지역 안만 보인다)
  c.strokeStyle = D.line2; c.lineWidth = 1;
  c.beginPath(); c.arc(md[0], md[1], 29 * base / 27.43 * m, 0, TAU); c.stroke();
  c.strokeStyle = ARC; c.setLineDash([3, 4]);
  dists.forEach(d => { c.beginPath(); c.arc(cx, cy, d * m, Math.PI + Q, Math.PI + 3 * Q); c.stroke(); });
  c.setLineDash([]);
  c.restore();
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = FOUL;
  c.lineWidth = 1; c.beginPath(); c.moveTo(bs[0][0], bs[0][1]); c.lineTo(bs[1][0], bs[1][1]); c.lineTo(bs[2][0], bs[2][1]); c.stroke();
  c.lineWidth = 1.5; c.beginPath(); c.moveTo(lp[0], lp[1]); c.lineTo(cx, cy); c.lineTo(rp[0], rp[1]); c.stroke();
  c.strokeStyle = FENCE; c.lineWidth = 2; c.beginPath(); fenceLine(false); c.stroke();
  // 베이스(45° 돌린 작은 네모) · 홈(오각형)
  c.fillStyle = D.tx;
  bs.forEach(p => { c.save(); c.translate(p[0], p[1]); c.rotate(Math.PI / 4); c.fillRect(-2.5, -2.5, 5, 5); c.restore(); });
  c.beginPath(); c.moveTo(cx, cy + 1.5); c.lineTo(cx + 3, cy - 1); c.lineTo(cx + 3, cy - 3.5); c.lineTo(cx - 3, cy - 3.5); c.lineTo(cx - 3, cy - 1); c.closePath(); c.fill();
  c.restore();
  if (!mode) return;   // 빈 상태 그림: 거리 · 타구 없이
  // 거리 글자: 펜스(폴 바깥 · 중앙 위) · 거리 호(왼쪽 파울라인 바깥) — 작은 구장(mini, GAME REPORT 창)은 빼고 점만
  if (mode !== 'mini') {
    font(c, '500', 13, FONT.num);
    const ct = pt(2 * Q, S + 9);
    txt(c, st.lfDist + 'm', lp[0] - 7, lp[1] + 5, D.tx3, 'right');
    txt(c, st.cfDist + 'm', ct[0], ct[1], D.tx3, 'center');
    txt(c, st.rfDist + 'm', rp[0] + 7, rp[1] + 5, D.tx3, 'left');
    dists.forEach(d => { const p = pt(Q, d * m); txt(c, d + 'm', p[0] - 7, p[1] + 4, D.tx3, 'right'); });
  }
  // 점: 아웃 먼저, 홈런을 맨 위에
  const order = ['out', 'bb', 'hit', 'xbh', 'hr'];
  abs.map((a, i) => ({ a, i, k: kind(a.res) })).filter(p => p.a.x != null && p.a.y != null)
    .sort((p, q) => order.indexOf(p.k) - order.indexOf(q.k))
    .forEach(p => {
      const xy = window._semiToCone(g, p.a.x, p.a.y, p.a.fa, p.a.ov);
      if (mode === 'mini') mark(c, xy[0], xy[1], p.k === 'out' ? 2.5 : 3, p.k);
      else if (mode === 'dot') mark(c, xy[0], xy[1], p.k === 'out' ? 4 : 5, p.k);
      else mark(c, xy[0], xy[1], 11, p.k, p.i + 1);   // 번호 = 타석 칸 번호
    });
}
// 스프레이 카드: 제목(왼쪽 위) · 범례(아래 두 모서리) · 카드에 꽉 차는 구장 (S = 높이 · 폭 중 작은 쪽, 폭에 걸리면 세로 가운데)
// 구장은 부채꼴이라 위 · 아래 모서리가 비어 있어 제목 · 범례가 구장 높이를 덜 먹는다
// x · w 를 주면 그 자리(GAME REPORT 피드의 왼쪽 칸), t 가 없으면 제목 · 범례 없이 구장만
function sprayPanel(c, y, h, t, abs, mode, x = X, w = CW) {
  card(c, x, y, w, h);
  if (t) { title(c, t, x + PAD, y + 36); legend(c, x, w, y + h - PAD); }
  const st = stadium(), k = Math.max(st.lfDist, st.rfDist) / st.cfDist, top = y + PAD + 22, bot = y + h - PAD - 4;
  const Sh = bot - top, S = Math.min(Sh, (w / 2 - PAD - 36) / (k * Math.SQRT1_2));   // 36 = 폴 옆 거리 글자
  field(c, x + w / 2, bot - (Sh - S) / 2, S, abs, mode);
}

// ── 타석 카드 ─────────────────────────────────────────
// 한 열(5줄까지): 번호 원(결과 색, 구장 번호와 같음) · 이닝 · 결과 글 · 타점 · 결과 약어 칩(오른쪽 끝). more = 마지막 줄에 "외 N타석"
function abRows(c, x, y, w, list, no, more) {
  list.forEach((a, i) => {
    const ry = y + i * RH, cy = ry + RH / 2, b = cy + 6;
    if (i) rule(c, x, ry, w);
    if (more && i === 4) {
      mark(c, x + 11, cy, 11, 'out', '+');
      runs(c, [['외 ', '500', 15, FONT.kr, D.tx2], [String(more), '700', 17, FONT.num, D.tx, 1], ['타석', '500', 15, FONT.kr, D.tx2]], x + 32, b);
      return;
    }
    const k = kind(a.res);
    mark(c, x + 11, cy, 11, k, no + i);
    const inn = window._cardInn(a.inn), d = /^(\d+)회$/.exec(inn);
    if (d) runs(c, [[d[1], '600', 16, FONT.num, D.tx2, 1], ['회', '500', 14, FONT.kr, D.tx3]], x + 32, b);
    else { fitFont(c, inn, '500', 14, FONT.kr, 34, 10); txt(c, inn, x + 32, b, D.tx3); }
    let rx = x + w;
    const t = code(a);
    if (t) {
      font(c, '600', 15, FONT.num);
      const cw = c.measureText(t).width + 16, col = k === 'out' ? D.out : COL[k];
      rr(c, rx - cw, cy - 12, cw, 24, 12); c.fillStyle = tint(col, .16); c.fill();
      txt(c, t, rx - cw / 2, cy + mid(c, '0'), k === 'out' ? D.tx2 : col, 'center');
      rx -= cw + 10;
    }
    if (a.rbi) rx -= runs(c, [[String(a.rbi), '700', 16, FONT.num, D.tx, 1], ['타점', '500', 14, FONT.kr, D.tx3]], rx, b, 'right') + 10;
    const s = window._cardAbText(a), tx0 = x + 70;
    fitFont(c, s, '700', 16, FONT.kr, rx - tx0, 10); txt(c, s, tx0, b, D.tx);
  });
}
// 타석 카드 높이 (줄 수에 맞춰) — 남는 높이는 스프레이 카드가 가져간다
const abH = n => 52 + Math.max(1, Math.min(5, n)) * RH + 12;
function abPanel(c, y, h, abs) {
  card(c, X, y, CW, h);
  title(c, '타석', X + PAD, y + 36);
  runs(c, [[String(abs.length), '600', 17, FONT.num, D.tx, 2], ['타석', '500', 14, FONT.kr, D.tx3]], W - X - PAD, y + 36, 'right');
  const top = y + 52, ix = X + PAD, iw = CW - PAD * 2;
  if (abs.length <= 5) { abRows(c, ix, top, iw, abs, 1, 0); return; }
  const cw = (iw - 24) / 2, more = abs.length > 10 ? abs.length - 9 : 0;
  abRows(c, ix, top, cw, abs.slice(0, 5), 1, 0);
  abRows(c, ix + cw + 24, top, cw, abs.slice(5, 10), 6, more);
}

// ── 빈 상태 ───────────────────────────────────────────
// 흐린 빈 구장 · 꼬리표 · 안내 두 줄 · 빈 지표 타일 — 큰 빈 종이 대신 카드가 될 모양을 보여 준다
// 구장은 카드 폭을 거의 채우는 크기(카드 밖은 자름), 남는 높이는 위 · 구장 아래 · 안내 아래 · 맨 아래 네 틈에 같게 나눈다
function empty(c, y0, y1, label, main, sub) {
  const h = y1 - y0, st = stadium(), k = Math.max(st.lfDist, st.rfDist) / st.cfDist, MSG = 100, STR = 76;
  card(c, X, y0, CW, h);
  const S = Math.max(120, Math.min(h - PAD * 2 - MSG - STR - 96, (CW / 2 - 8) / (k * Math.SQRT1_2))), g = Math.max(0, (h - PAD * 2 - S - MSG - STR) / 4);
  const fy = y0 + PAD + g + S, my = fy + g;
  c.save(); rr(c, X, y0, CW, h, R); c.clip(); c.globalAlpha = .5; field(c, W / 2, fy, S, [], null); c.restore();
  pill(c, label, W / 2, my + 12, D.tx2, D.card2, 'center');
  fitFont(c, main, '900', 26, FONT.kr, CW - 48, 16); txt(c, main, W / 2, my + 66, D.tx, 'center');
  font(c, '500', 15, FONT.kr); txt(c, sub, W / 2, my + 94, D.tx2, 'center');
  kpis(c, X + PAD, y1 - PAD - g - STR, CW - PAD * 2, STR, [[['타율', '-'], ['출루율', '-'], ['장타율', '-'], ['OPS', '-']]], -1, D.card2);
}
// 야구공 그림 (빈 칸 표시): 원 + 실밥 두 줄 (선만)
function ball(c, x, y, r) {
  c.save(); c.strokeStyle = D.tx3; c.lineWidth = 1.5;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  c.beginPath(); c.arc(x - r * 1.35, y, r * .95, -.62, .62); c.stroke();
  c.beginPath(); c.arc(x + r * 1.35, y, r * .95, Math.PI - .62, Math.PI + .62); c.stroke();
  c.restore();
}

// ── 개인 카드 (9:16) ─────────────────────────────────────
function personal(cv) {
  const H = 960, c = begin(cv, H), AS = window.AS, bot = H - FOOT;
  const p = window._cardPlayers().filter(q => String(q.id) === String(window._cardBid))[0];
  const hn = ($('tHome') || {}).value || '홈', an = ($('tAway') || {}).value || '원정';
  if (!p) {
    scoreLine(c, hn, an, AS.hs, AS.as, false);
    empty(c, TOP, bot, '타석 없음', '아직 기록된 타석이 없어요', '타석을 기록하면 선수 카드가 만들어져요');
    footer(c, H);
    return;
  }
  const abs = AS.abs.filter(a => String(a.bid) === String(p.id)), s = window._cardStats(abs);
  const isHome = p.team !== 'away';
  const myT = isHome ? hn : an, opT = isHome ? an : hn, myS = isHome ? AS.hs : AS.as, opS = isHome ? AS.as : AS.hs;
  scoreLine(c, myT, opT, myS, opS, true);

  // 맨 위 카드: 번호 · 팀 + 꼬리표 → 이름 → 한 줄 성적(숫자는 결과 색: 안타 주황 · 홈런 노랑 · 볼넷 · 사구 파랑)
  const hh = 184, ix = X + PAD, iw = CW - PAD * 2;
  card(c, X, TOP, CW, hh, true);
  const badge = s.hr ? '홈런' : s.h >= 3 ? '3안타' : s.h >= 2 ? '멀티히트' : null;
  const bw = badge ? pill(c, badge, X + CW - PAD, TOP + 34, s.hr ? D.bg : D.tx, s.hr ? D.hr : D.acc, 'right') + 12 : 0;
  const num = p.num != null && p.num !== '' ? String(p.num) : '', team = [[myT, '500', 16, FONT.kr, D.tx2]];
  runs(c, num ? [['NO.' + num, '600', 17, FONT.num, D.tx, 7], ['·', '500', 16, FONT.kr, D.tx3, 7]].concat(team) : team, ix, TOP + 40, 'left', iw - bw);
  fitFont(c, p.name, '900', HERO, FONT.kr, iw, 30); txt(c, p.name, ix, TOP + 104, D.tx);
  const line = [[s.ab, '타수'], [s.h, '안타', s.h ? D.hit : null]];
  if (s.hr) line.push([s.hr, '홈런', D.hr]);
  if (s.rbi) line.push([s.rbi, '타점']);
  if (s.bb) line.push([s.bb, '볼넷', D.bb]);
  if (s.hbp) line.push([s.hbp, '사구', D.bb]);
  runs(c, tokens(line, BIG, BIGU, 18), ix, TOP + 160, 'left', iw);

  // 지표 타일 · 스프레이(남는 높이 전부) · 타석
  const ty = TOP + hh + G, th = 76, ah = abH(abs.length), ay = bot - ah, sy = ty + th + G;
  kpis(c, X, ty, CW, th, [slash(s)], 3);
  sprayPanel(c, sy, ay - G - sy, '타구 위치', abs, 'num');
  abPanel(c, ay, ah, abs);
  footer(c, H);
}

// ── 팀 카드 (1:1) ──────────────────────────────────────
function team(cv) {
  const H = 540, c = begin(cv, H), AS = window.AS, bot = H - FOOT;
  const hn = ($('tHome') || {}).value || '홈', an = ($('tAway') || {}).value || '원정';

  // 오늘의 타자 (안타 → 루타 → 타점 순, 다섯 명)
  const players = window._cardPlayers().map(p => ({ p, s: window._cardStats(AS.abs.filter(a => String(a.bid) === String(p.id))) }))
    .filter(o => o.s.h > 0 || o.s.rbi > 0)
    .sort((a, b) => b.s.h - a.s.h || b.s.tb - a.s.tb || b.s.rbi - a.s.rbi).slice(0, 5);

  // 라인 스코어 카드: 머리 줄 + 두 팀 줄. 안타는 오른쪽 맞춤 · 타율 · OPS 는 소수점 맞춤 · 득점은 칸 가운데
  // 이긴 팀은 이름 · 점수 밝게, 진 팀은 흐리게
  const hs = window._cardStats(AS.abs.filter(a => (a.team || 'home') === 'home'));
  const as = window._cardStats(AS.abs.filter(a => a.team === 'away'));
  eyebrow(c, '팀 기록', window._cardDate());
  const y = TOP, rh = 52, bh = 44 + rh * 2 + 8, sw = 72, rc = X + CW - PAD - sw / 2 + 8, ix = X + PAD, iw = CW - PAD * 2;
  font(c, '600', 20, FONT.num);
  const fw = c.measureText('.000').width, dw = c.measureText('0').width;
  const opt = X + CW - PAD - sw - fw, apt = opt - fw - 24 - dw, hx = apt - dw - 24;
  const win = [AS.hs > AS.as, AS.as > AS.hs], tie = AS.hs === AS.as;
  card(c, X, y, CW, bh, true);
  font(c, '500', 14, FONT.kr); txt(c, '팀', ix, y + 32, D.tx3); txt(c, '안타', hx, y + 32, D.tx3, 'right'); txt(c, '타율', apt + fw, y + 32, D.tx3, 'right'); txt(c, 'OPS', opt + fw, y + 32, D.tx3, 'right'); txt(c, '득점', rc, y + 32, D.tx3, 'center');
  rule(c, ix, y + 44 + rh, iw);
  [[hn, hs, AS.hs], [an, as, AS.as]].forEach((r, i) => {
    const cy = y + 44 + rh * i + rh / 2, col = win[i] || tie ? D.tx : D.tx2;
    fitFont(c, r[0], '700', 19, FONT.kr, hx - 48 - ix, 11); txt(c, r[0], ix, cy + mid(c, r[0]), col);
    font(c, '600', 20, FONT.num);
    const b = cy + mid(c, '0'), v = [r[1].pa ? fmt(r[1].avg) : '-', r[1].pa ? fmt(r[1].ops) : '-'];
    txt(c, String(r[1].h), hx, b, col, 'right');
    dec(c, v[0], apt, b, v[0] === '-' ? D.tx3 : col);
    dec(c, v[1], opt, b, v[1] === '-' ? D.tx3 : col);
    font(c, '700', 34, FONT.num); txt(c, String(r[2]), rc, cy + mid(c, '0'), win[i] ? D.acc : col, 'center');
  });

  // 오늘의 타자 카드: 순위 · 번호 · 이름 | 타수 · 안타 · 홈런 · 타점 (숫자 칸 오른쪽 맞춤 · 0 은 흐리게)
  const py = y + bh + G, ph = bot - py;
  card(c, X, py, CW, ph);
  title(c, '오늘의 타자', ix, py + 34);
  const colX = [ix + iw - 162, ix + iw - 108, ix + iw - 54, ix + iw];
  font(c, '500', 14, FONT.kr); ['타수', '안타', '홈런', '타점'].forEach((l, j) => txt(c, l, colX[j], py + 34, D.tx3, 'right'));
  const top = py + 46, rh2 = (py + ph - 6 - top) / 5;
  if (!players.length) {
    const cy = (top + py + ph) / 2;
    ball(c, W / 2, cy - 20, 16);
    font(c, '700', 17, FONT.kr); txt(c, '아직 안타 기록이 없어요', W / 2, cy + 26, D.tx2, 'center');
  }
  players.forEach((o, i) => {
    const ry = top + rh2 * i, b = ry + rh2 / 2 + 7, s = o.s, p = o.p;
    if (i) rule(c, ix, ry, iw);
    font(c, '600', 17, FONT.num); txt(c, String(i + 1), ix + 6, b, i ? D.tx3 : D.acc, 'center');
    const v = [[s.ab, D.tx], [s.h, D.hit], [s.hr, D.hr], [s.rbi, D.tx]];
    font(c, '600', 20, FONT.num); v.forEach((t, j) => txt(c, String(t[0]), colX[j], b, t[0] ? t[1] : D.tx3, 'right'));
    if (p.num != null && p.num !== '') { font(c, '500', 15, FONT.num); txt(c, '#' + p.num, ix + 56, b, D.tx3, 'right'); }
    fitFont(c, p.name, '700', 17, FONT.kr, colX[0] - 40 - ix - 66, 10); txt(c, p.name, ix + 66, b, D.tx);
  });
  // 다섯 명이 안 되면 남은 순위 칸은 흐리게 비워 둔다 (칸이 꺼져 보이지 않게)
  for (let i = players.length; players.length && i < 5; i++) {
    const ry = top + rh2 * i, b = ry + rh2 / 2 + 7;
    rule(c, ix, ry, iw);
    font(c, '600', 17, FONT.num); txt(c, String(i + 1), ix + 6, b, D.line2, 'center');
    c.fillStyle = D.line2; c.fillRect(ix + 66, b - 6, 28, 2);
  }
  footer(c, H);
}

// ── 시즌 성적 카드 (저장된 전체 경기 집계) ─────────────────────
// 당겨 · 센터 · 밀어 비율. 가장 큰 쪽 주황. 방향 있는 타구가 없으면 0% · 빈 막대(GAME REPORT)
// form: 없으면 가로(카드 폭 그대로) 세 칸(라벨 옆 숫자) + 한 줄 막대 · 'tall' 줄마다 라벨 · 숫자 · 막대(피드 오른쪽, 코멘트 없을 때)
//       'narrow' 세 칸(라벨 아래 숫자) + 한 줄 막대(피드 오른쪽, 코멘트 위)
function dirPanel(c, x, y, w, h, dabs, form) {
  const tot = dabs.length || 1, pull = dabs.filter(window._isPull).length, ctr = dabs.filter(window._isCtr).length, oppo = dabs.length - pull - ctr;
  const n = [pull, ctr, oppo], pct = n.map(v => Math.round(v / tot * 100)), max = Math.max.apply(null, pct) || -1;
  const L = ['당겨', '센터', '밀어'], ix = x + PAD, iw = w - PAD * 2, bar = (bx, by, bw, on) => { rr(c, bx, by, bw, 10, 5); c.fillStyle = on ? D.acc : D.line2; c.fill(); };
  card(c, x, y, w, h);
  if (form === 'tall') {
    const rh = (h - PAD * 2) / 3;
    L.forEach((l, i) => {
      const ry = y + PAD + rh * i, b = ry + rh / 2 - 2;
      font(c, '500', 15, FONT.kr); txt(c, l, ix, b, D.tx2);
      font(c, '700', 22, FONT.num); txt(c, pct[i] + '%', ix + iw, b, pct[i] === max ? D.acc : D.tx, 'right');
      rr(c, ix, b + 9, iw, 8, 4); c.fillStyle = D.card2; c.fill();
      if (n[i]) { rr(c, ix, b + 9, Math.max(iw * n[i] / tot, 8), 8, 4); c.fillStyle = pct[i] === max ? D.acc : D.line2; c.fill(); }
    });
    return;
  }
  L.forEach((l, i) => {
    const cx = ix + iw / 3 * i, col = pct[i] === max ? D.acc : D.tx;
    if (form !== 'narrow') return runs(c, [[l, '500', 15, FONT.kr, D.tx2, 10], [pct[i] + '%', '700', 26, FONT.num, col]], cx, y + 40, 'left');
    font(c, '500', 14, FONT.kr); txt(c, l, cx, y + PAD + 14, D.tx2);
    fitFont(c, pct[i] + '%', '700', 24, FONT.num, iw / 3 - 4, 14); txt(c, pct[i] + '%', cx, y + PAD + 44, col);
  });
  const by = y + h - PAD - 10;
  if (!dabs.length) return bar(ix, by, iw, false);
  let bx = ix;
  n.forEach((v, i) => {
    const bw = iw * v / tot;
    if (bw > 0) bar(bx, by, Math.max(bw - 4, 10), pct[i] === max);
    bx += bw;
  });
}
function season(cv) {
  const H = 960, c = begin(cv, H), bot = H - FOOT;
  // 집계 — core _drawSeasonCard 와 같다: 팀명이 있으면 그 팀이 낀 경기만, 같은 경기 사본은 하나로(_readSavedGames)
  const myTeam = ($('tHome') ? $('tHome').value : '') || '';
  const games = window._readSavedGames();
  const myGames = myTeam ? games.filter(g => (g.th || '').indexOf(myTeam) !== -1 || (g.ta || '').indexOf(myTeam) !== -1) : games;
  const totalG = myGames.length;
  let wins = 0, losses = 0, draws = 0, allAbs = [];
  myGames.forEach(g => {
    const isHome = !myTeam || (g.th || '').indexOf(myTeam) !== -1;
    const myScore = isHome ? Number(g.hs || 0) : Number(g.as || 0), opScore = isHome ? Number(g.as || 0) : Number(g.hs || 0);
    if (myScore > opScore) wins++; else if (myScore < opScore) losses++; else draws++;
    allAbs = allAbs.concat(g.abs || []);
  });
  const s = window._cardStats(allAbs);
  // wOBA — constants.js WOBA_W, 분모 AB+BB+HBP+SF
  const wD = s.ab + s.bb + s.hbp + s.sf;
  const woba = wD ? (WOBA_W.bb * s.bb + WOBA_W.hbp * s.hbp + WOBA_W.s1 * s.s1 + WOBA_W.s2 * s.s2 + WOBA_W.s3 * s.s3 + WOBA_W.hr * s.hr) / wD : 0;
  const pct = wins + losses ? fmt(wins / (wins + losses)) : '-';

  // 맨 위 카드: 경기 수 → 팀 이름 → 승 · 무 · 패 + 승률
  eyebrow(c, '시즌 기록', window._cardDate());
  const hh = 184, ix = X + PAD, iw = CW - PAD * 2, t = myTeam || '전체 경기';
  card(c, X, TOP, CW, hh, true);
  runs(c, [['총', '500', 16, FONT.kr, D.tx2, 5], [String(totalG), '600', 18, FONT.num, D.tx, 2], ['경기', '500', 16, FONT.kr, D.tx2]], ix, TOP + 40, 'left');
  fitFont(c, t, '900', HERO, FONT.kr, iw, 30); txt(c, t, ix, TOP + 104, D.tx);
  const wdl = tokens([[wins, '승', wins ? D.acc : null], [draws, '무'], [losses, '패']], BIG, BIGU, 18);
  wdl[wdl.length - 1][5] = 28;
  runs(c, wdl.concat([['승률', '500', BIGU, FONT.kr, D.tx2, 8], [pct, '700', BIG, FONT.num, pct === '-' ? D.tx3 : D.tx]]), ix, TOP + 160, 'left', iw);
  const ty = TOP + hh + G;
  if (!totalG) {
    empty(c, ty, bot, '경기 없음', '저장된 경기가 없어요', '경기를 저장하면 시즌 기록이 쌓여요');
    footer(c, H);
    return;
  }
  // 지표 2줄 (타석이 없으면 '-')
  const v = x => s.pa ? x : '-';
  const kh = kpis(c, X, ty, CW, 72, [slash(s).map(r => [r[0], v(r[1])]), [['wOBA', v(fmt(woba))], ['홈런', v(String(s.hr))], ['타점', v(String(s.rbi))], ['타석', v(String(s.pa))]]], 3);
  // 타구 분포(남는 높이 전부) + 방향 비율
  const dabs = allAbs.filter(a => a.deg != null), sy = ty + kh + G, dh = 84;
  let sh = bot - sy;
  if (dabs.length) { dirPanel(c, X, bot - dh, CW, dh, dabs); sh -= dh + G; }
  sprayPanel(c, sy, sh, '시즌 타구', allAbs, 'dot');
  footer(c, H);
}

// ── GAME REPORT 공유 이미지 (스토리 1080×1920 · 피드 1080×1080) ─────────────
// 공유 이미지 모듈이라 여기서 그린다 — 카드의 구장 · 지표 타일 · 방향 막대를 그대로 쓴다. core.js pgExport 를 바꿔 낀다(모달 버튼 onclick)
//  · 계산은 core pgExport 와 같다: 팀 타율 = 안타 / (볼넷 · 사구 · 희생 뺀 타석, 0 이면 1) · 안타 · 타점 · 삼진 · 방향(_isPull · _isCtr) · 타구 = AS.abs 전부
//  · 코멘트는 모달의 #pgAITxt 글 그대로. 모달 안 작은 그림(_pgDrawMini)은 아래 pgMini 가 같은 선 구장으로

// 결과 카드(스토리): 두 팀 줄(이름 + 큰 점수). 이긴 쪽 = 밝게 + 승 꼬리표 · 주황 점수, 진 쪽 흐리게, 비기면 둘 다 보통. 높이 반환
function finalCard(c, y, th, ta, hs, as) {
  const rh = 76, h = rh * 2 + 16, ix = X + PAD, sx = X + CW - PAD, rows = [[th, hs, as], [ta, as, hs]];
  card(c, X, y, CW, h, true);
  rule(c, ix, y + 8 + rh, CW - PAD * 2);
  rows.forEach((r, i) => {
    const cy = y + 8 + rh * i + rh / 2, won = r[1] > r[2], col = r[1] < r[2] ? D.tx2 : D.tx;
    font(c, '700', 56, FONT.num);
    const nw = sx - c.measureText(String(r[1])).width - 24 - ix - (won ? 52 : 0);
    txt(c, String(r[1]), sx, cy + mid(c, '0'), won ? D.acc : col, 'right');
    fitFont(c, r[0], '900', 30, FONT.kr, nw, 12); txt(c, r[0], ix, cy + mid(c, r[0]), col);
    if (won) pill(c, '승', ix + c.measureText(r[0]).width + 12, cy, D.good, tint(D.good, .16));
  });
  return h;
}
// 한 줄 결과 카드(피드): [홈 이름 | 홈 점수 : 원정 점수 | 원정 이름] — 점수가 가운데서 마주 본다. 이긴 점수 주황 · 진 쪽 흐리게
function lineCard(c, y, h, th, ta, hs, as) {
  const mx = X + CW / 2, cy = y + h / 2, tw = CW / 2 - 64 - PAD;
  card(c, X, y, CW, h, true);
  font(c, '500', 22, FONT.num); txt(c, ':', mx, cy + mid(c, ':'), D.tx3, 'center');
  [[th, hs, as, X + PAD, 'left', mx - 34, 'right'], [ta, as, hs, X + CW - PAD, 'right', mx + 34, 'left']].forEach(r => {
    const col = r[1] < r[2] ? D.tx2 : D.tx;
    fitFont(c, r[0], '900', 20, FONT.kr, tw, 10); txt(c, r[0], r[3], cy + mid(c, r[0]), col, r[4]);
    font(c, '700', 38, FONT.num); txt(c, String(r[1]), r[5], cy + mid(c, '0'), r[1] > r[2] ? D.acc : col, r[6]);
  });
}
// 코멘트 줄 나누기 (띄어쓰기 단위 — core _pgWrapText 와 같은 방식)
function wrap(c, t, maxW) {
  const out = [];
  let line = '';
  t.split(' ').forEach(w => { const s = line ? line + ' ' + w : w; if (line && c.measureText(s).width > maxW) { out.push(line); line = w; } else line = s; });
  if (line) out.push(line);
  return out;
}
// 코멘트 카드: 조용한 본문(Noto 500 · 흐린 글자 · 줄 간격 = 글자 + 10). h 를 주면 그 안에 들어가게 글자를 줄이고 세로 가운데,
// h 가 0 이면 줄 수만큼의 높이. y 를 주면 그린다. 카드 높이 반환
function note(c, x, y, w, h, t, size) {
  let z = size, lines;
  for (;;) {
    font(c, '500', z, FONT.kr); lines = wrap(c, t, w - PAD * 2);
    if (!h || z <= 11 || (lines.length - 1) * (z + 10) + z <= h - PAD * 2) break;
    z -= .5;
  }
  const bh = (lines.length - 1) * (z + 10) + z, hh = h || bh + PAD * 2 + 2;
  if (y != null) {
    card(c, x, y, w, hh);
    font(c, '500', z, FONT.kr);
    lines.forEach((l, i) => txt(c, l, x + PAD, y + (hh - bh) / 2 + z * .88 + i * (z + 10), D.tx2));
  }
  return hh;
}
// 스토리: 맨 위 줄 · 결과 카드 · 지표 타일 · 방향 막대 · 스프레이(남는 높이 전부) · 코멘트
// 피드(1:1): 맨 위 줄 · 한 줄 결과 · 지표 타일 · [구장 | 방향(세로) + 코멘트]
function gameReport(cv, sc, H, mode) {
  const c = begin(cv, H, sc), AS = window.AS, abs = AS.abs, bot = H - FOOT;
  const oab = abs.filter(a => !window._NOAB.includes(a.res)).length || 1;
  const h = abs.filter(a => window._HITS.includes(a.res)).length;
  const k = abs.filter(a => a.res === '삼진').length;
  const rbi = abs.reduce((s, a) => s + (a.rbi || 0), 0);
  const stats = [['팀 타율', (h / oab).toFixed(3).replace('0.', '.')], ['안타', String(h)], ['타점', String(rbi)], ['삼진', String(k)]];
  const th = $('tHome').value || '홈팀', ta = $('tAway').value || '원정팀', dabs = abs.filter(a => a.deg != null);
  const memo = (($('pgAITxt') || {}).textContent || '').trim();
  eyebrow(c, '경기 리포트', window._pgDate());
  if (mode === 'story') {
    const ty = TOP + finalCard(c, TOP, th, ta, AS.hs, AS.as) + G, dy = ty + 80 + G, sy = dy + 84 + G;
    kpis(c, X, ty, CW, 80, [stats], 0);
    dirPanel(c, X, dy, CW, 84, dabs);
    let ny = bot + G;
    if (memo) { ny = bot - note(c, X, null, CW, 0, memo, 16); note(c, X, ny, CW, 0, memo, 16); }
    sprayPanel(c, sy, ny - G - sy, '타구 위치', abs, 'dot');
  } else {
    const lh = 64, ty = TOP + lh + G, y = ty + 72 + G, rw = 188, lw = CW - rw - G, rx = X + lw + G;
    lineCard(c, TOP, lh, th, ta, AS.hs, AS.as);
    kpis(c, X, ty, CW, 72, [stats], 0);
    sprayPanel(c, y, bot - y, null, abs, 'dot', X, lw);
    const dh = memo ? 104 : bot - y;
    dirPanel(c, rx, y, rw, dh, dabs, memo ? 'narrow' : 'tall');
    if (memo) note(c, rx, y + dh + G, rw, bot - y - dh - G, memo, 15);
  }
  footer(c, H);
}
// 먼저 작은 캔버스(1배)에 그려 빠진 글꼴 묶음을 받고(drawWithFonts), 내보낼 캔버스에는 한 번만 그린다 → 저장 · 공유(core _downloadCanvas)
window.pgExport = function (Wpx, Hpx, mode) {
  window.showToast('이미지 생성 중...', false, true);
  setTimeout(() => {
    const H = Math.round(Hpx * W / Wpx), warm = document.createElement('canvas'), cv = document.createElement('canvas');
    drawWithFonts(warm, () => gameReport(warm, 1, H, mode)).then(() => {
      gameReport(cv, Wpx / W, H, mode);
      window._downloadCanvas(cv, 'spraylab_' + mode + '_' + Date.now() + '.png');
      window.showToast('이미지 저장 완료 ✓', false);
    });
  }, 80);
};
// GAME REPORT 창 안 작은 구장(108px) — core _pgDrawMini 를 바꿔 낀다: 저장 이미지와 같은 선 구장, 거리 글자 없이 점만
//  · 고대비(밝은 종이 창)에서는 흰 선이 안 보이므로 그 전 그림 그대로 (scorebook.js 의 종이 필드)
//  · core 가 _pgBuild 바로 뒤에 부르므로 여기서 방향 막대의 가장 큰 칸에 .max (저장 이미지 방향 칸과 같은 강조 · css/night.css)
//  · scorebook.js 가 setTimeout 0 에서 이 함수를 종이 필드로 감싸므로 그 뒤에 바꿔 끼우고, _sb 로 다시 감싸지 않게 한다
setTimeout(() => {
  const prev = window._pgDrawMini;
  const mini = function (id, S) {
    const b = document.body, cv = $(id);
    if (!cv || !b.classList.contains('sb-night') || b.classList.contains('high-contrast')) return prev.apply(this, arguments);
    pgMini(cv, S);
  };
  mini._sb = true;
  window._pgDrawMini = mini;
}, 0);
function pgMini(cv, S) {
  const r = window.devicePixelRatio || 1, c = cv.getContext('2d'), st = stadium(), k = Math.max(st.lfDist, st.rfDist) / st.cfDist;
  cv.width = cv.height = Math.round(S * r); cv.style.width = cv.style.height = S + 'px';
  c.setTransform(r, 0, 0, r, 0, 0);
  const P = 8, R = Math.min(S - P * 2, (S / 2 - P) / (k * Math.SQRT1_2));
  field(c, S / 2, S - P - (S - P * 2 - R) / 2, R, window.AS.abs, 'mini');
  const d = window.AS.abs.filter(a => a.deg != null), n = [d.filter(window._isPull).length, d.filter(window._isCtr).length];
  n.push(d.length - n[0] - n[1]);
  const mx = Math.max.apply(null, n);
  ['pgDP', 'pgDC', 'pgDO'].forEach((s, i) => { const e = $(s); if (e) e.classList.toggle('max', d.length > 0 && n[i] === mx); });
}

// ── core 의 _drawCard 바꿔 끼우기 ─────────────────────────────
// 빠진 웹폰트 묶음을 받은 뒤 다시 그린다(drawWithFonts). 그 사이 종류 · 선수를 바꿨으면 늦게 온 다시 그리기는 건너뛴다
let seq = 0;
window._drawCard = function () {
  const sel = $('cardPlayerSel');
  if (sel) sel.style.display = window._cardType === 'personal' && sel.options.length ? '' : 'none';
  const cv = $('cardPreviewCanvas');
  if (!cv) return Promise.resolve();
  const my = ++seq, t = window._cardType, draw = t === 'personal' ? personal : t === 'season' ? season : team;
  return drawWithFonts(cv, () => { if (my === seq) draw(cv); });
};
