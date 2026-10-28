// 성적 카드 3종(개인 · 팀 · 시즌) — 새 디자인(야간 스코어보드). core.js 의 _drawCard 를 바꿔 낀다
//  · 무엇을 그릴지는 core.js 그대로 읽는다 (_cardPlayers · _cardStats · _cardAbText · _cardInn · _cardDate · _cardFmt · _readSavedGames · _isPull · _isCtr)
//    선수 고르기 · 타석 고르기 · 배지 규칙 · 승무패 · 지표 계산은 core 의 _drawPersonalCard / _drawTeamCard / _drawSeasonCard 와 같다. 그리기만 새로
//  · 남색 바탕 + 은은한 빛 · 한글 Noto Sans KR · 숫자와 영문 Oswald · 잔디 부채꼴 · 결과 색(안타 · 장타 · 홈런 · 볼넷 · 아웃 = imgkit NIGHT)
//  · 크기는 그대로: 개인 · 시즌 540×960(9:16), 팀 540×540(1:1) → 2배 PNG (#cardPreviewCanvas)
//  · core 는 _drawCard 를 전역 이름으로 부른다(열기 · 종류 바꾸기 · 선수 바꾸기 · 글꼴 로드 뒤) → window._drawCard 를 바꾸면 모두 새 그림

import { FONT, NIGHT as N, font, fitFont, spacing, rr, wordmark, drawWithFonts } from './imgkit.js?v=1';
import { WOBA_W } from '../constants.js';

const $ = id => document.getElementById(id);
const SCALE = 2, W = 540, X = 28, CW = W - X * 2, FOOT = 46, RH = 34, TAU = Math.PI * 2;
// 글자 크기 단계: 큰 제목(선수 · 팀 이름) · 큰 숫자 줄(한 줄 성적 · 전적) — 개인 · 시즌이 같은 크기
const HERO = 68, BIG = 48, BIGU = 23;

// 키트 색 → rgba (빛 · 반투명 칸)
const rgba = (hex, a) => 'rgba(' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',') + ',' + a + ')';
// 결과 → 색 종류: hr 홈런 · xbh 2·3루타 · hit 안타 · bb 볼넷 · 사구 · out 그 밖(아웃 · 희생 · 실책 · 야수선택 …)
const kind = r => r === '홈런' ? 'hr' : r === '2루타' || r === '3루타' ? 'xbh' : (window.CARD_HITS || []).indexOf(r) !== -1 ? 'hit' : r === '볼넷' || r === '사구' ? 'bb' : 'out';
const COL = { hit: N.acc, xbh: N.xbh, hr: N.hr, bb: N.bb, out: N.out };
const fmt = v => window._cardFmt(v);
const stadium = () => window.STADIUMS[window.AS.stadium] || window.STADIUMS.standard;

const txt = (c, t, x, y, color, align) => { c.fillStyle = color; c.textAlign = align || 'left'; c.fillText(t, x, y); };
// 글자를 세로 가운데에 놓을 기준선 보정 (숫자 원 · 표 칸)
const mid = (c, t) => { const m = c.measureText(t); return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2; };

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
const tokens = (list, n, u, gap, nw, uw) => list.reduce((a, t, i) => a.concat([
  [String(t[0]), nw || '700', n, FONT.num, t[2] || N.tx, n * .06], [t[1], uw || '700', u, FONT.kr, N.tx2, i < list.length - 1 ? gap : 0]]), []);

// ── 바탕 · 머리 · 꼬리 ───────────────────────────────────
// 캔버스 크기 · 화면 맞춤(높이 60% 안) · 남색 + 오른쪽 위 주황 빛 · 왼쪽 파란 빛
function begin(cv, H) {
  cv.width = W * SCALE; cv.height = H * SCALE;
  cv.style.width = '100%'; cv.style.height = 'auto'; cv.style.maxWidth = 'calc(60vh * ' + (W / H).toFixed(4) + ')'; cv.style.margin = '0 auto';
  const c = cv.getContext('2d');
  c.setTransform(SCALE, 0, 0, SCALE, 0, 0); c.textBaseline = 'alphabetic';
  c.fillStyle = N.bg; c.fillRect(0, 0, W, H);
  const glow = (x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, rgba(N.bg, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  glow(W * .92, 70, 400, rgba(N.acc, .16));
  glow(-60, H * .62, 480, rgba(N.bb, .10));
  return c;
}
// 머리: 로고(왼쪽) · 날짜와 한 줄(오른쪽 끝 맞춤) · 가는 선
function header(c, date, line2) {
  const lw = wordmark(c, X, 56, 22, N.tx, N.acc);
  font(c, '500', 14, FONT.num); spacing(c, 1); txt(c, date, W - X - 1, 42, N.tx2, 'right'); spacing(c, 0);
  if (line2) runs(c, line2, W - X, 66, 'right', CW - lw - 24);
  c.fillStyle = N.line; c.fillRect(X, 84, CW, 1);
}
// 꼬리 띠: 태그라인 · 계정
function footer(c, H) {
  const y = H - FOOT;
  c.fillStyle = rgba(N.bg2, .92); c.fillRect(0, y, W, FOOT);
  c.fillStyle = N.line; c.fillRect(0, y, W, 1);
  c.fillStyle = N.acc; c.fillRect(X, y, 36, 2);
  font(c, '500', 11, FONT.num); spacing(c, 2.5); txt(c, 'YOUR SWING, VISUALIZED', X, y + 28, N.tx3); spacing(c, 0);
  font(c, '600', 13, FONT.num); spacing(c, .5); txt(c, '@spraylab2026', W - X, y + 28, N.tx2, 'right'); spacing(c, 0);
}

// ── 부품 ─────────────────────────────────────────────
const panel = (c, x, y, w, h) => { rr(c, x, y, w, h, 14); c.fillStyle = rgba(N.panel, .88); c.fill(); c.strokeStyle = N.line; c.lineWidth = 1; c.stroke(); };
// 칸 제목: 짧은 주황 막대 + 영문 대문자(Oswald 자간)
function title(c, t, x, y) {
  c.fillStyle = N.acc; c.fillRect(x, y - 11, 3, 12);
  font(c, '600', 13, FONT.num); spacing(c, 2); txt(c, t, x + 10, y, N.tx); spacing(c, 0);
}
// 오른쪽 끝 rx · 가운데 cy 의 알약. solid = 색으로 채움(배지), 아니면 색 테(승률 · 빈 상태). 폭 반환
function pill(c, parts, rx, cy, col, solid) {
  const w = runW(c, parts) + 28, h = 30;
  c.save();
  if (solid) { c.shadowColor = rgba(col, .6); c.shadowBlur = 18; }
  rr(c, rx - w, cy - h / 2, w, h, h / 2); c.fillStyle = solid ? col : rgba(col, .12); c.fill();
  c.restore();
  if (!solid) { rr(c, rx - w, cy - h / 2, w, h, h / 2); c.strokeStyle = col; c.lineWidth = 1.5; c.stroke(); }
  font(c, parts[0][1], parts[0][2], parts[0][3]);
  runs(c, parts, rx - w / 2, cy + mid(c, parts[0][0]), 'center');
  return w;
}
// 영문 대문자 배지 글자 (MULTI HIT · HOME RUN · NO AT-BATS)
const cap = (t, col) => [[t, '700', 13, FONT.num, col]];
// 지표 칸: 라벨(Oswald 자간) + 큰 숫자. hl = 주황으로 채운 핵심 칸
function tile(c, x, y, w, h, label, val, hl, dim) {
  c.save();
  if (hl) { c.shadowColor = rgba(N.acc, .45); c.shadowBlur = 24; c.shadowOffsetY = 6; }
  rr(c, x, y, w, h, 12); c.fillStyle = hl ? N.acc : rgba(dim ? N.bg2 : N.panel, .88); c.fill();
  c.restore();
  if (!hl) { rr(c, x, y, w, h, 12); c.strokeStyle = N.line; c.lineWidth = 1; c.stroke(); }
  font(c, '600', 12, FONT.num); spacing(c, 1.6); txt(c, label, x + 14, y + 24, hl ? rgba(N.tx, .85) : N.tx2); spacing(c, 0);
  fitFont(c, val, '700', 34, FONT.num, w - 28, 16);
  txt(c, val, x + 14, y + h - 15, val === '-' ? (hl ? rgba(N.tx, .6) : N.tx3) : N.tx);
}
const tiles = (c, x, w, y, h, list, hi, dim) => { const gap = 10, tw = (w - gap * 3) / 4; list.forEach((v, i) => tile(c, x + (tw + gap) * i, y, tw, h, v[0], v[1], i === hi, dim)); };
const slash = s => [['AVG', fmt(s.avg)], ['OBP', fmt(s.obp)], ['SLG', fmt(s.slg)], ['OPS', fmt(s.ops)]];

// 타구 표시: 안타 · 장타 · 홈런 = 색 원 + 흰 테(홈런은 빛 번짐 + 바깥 고리) · 볼넷 = 파란 원 · 아웃 = 회색 빈 원. num 이 있으면 가운데 번호
function mark(c, x, y, r, k, num) {
  c.save();
  if (k === 'hr') { c.beginPath(); c.arc(x, y, r + Math.max(2.5, r * .3), 0, TAU); c.strokeStyle = rgba(N.hr, .75); c.lineWidth = Math.max(1, r * .14); c.stroke(); }
  c.beginPath(); c.arc(x, y, r, 0, TAU);
  if (k === 'out') { c.fillStyle = rgba(N.bg, .82); c.fill(); c.strokeStyle = N.out; c.lineWidth = Math.max(1.3, r * .17); c.stroke(); }
  else {
    if (k === 'hr') { c.shadowColor = N.hr; c.shadowBlur = r * 2.4; }
    c.fillStyle = COL[k]; c.fill(); c.shadowBlur = 0;
    c.strokeStyle = N.tx; c.lineWidth = Math.max(1.2, r * .16); c.stroke();
  }
  c.restore();
  if (num == null) return;
  const t = String(num);
  font(c, '600', Math.round(r * 1.15), FONT.num);
  txt(c, t, x, y + mid(c, t), k === 'out' ? N.tx2 : k === 'xbh' || k === 'hr' ? N.bg : N.tx, 'center');
}
// 범례 (세로 · 오른쪽 맞춤): 안타 · 장타 · 홈런 · 아웃
function legend(c, rx, y) {
  [['안타', 'hit'], ['장타', 'xbh'], ['홈런', 'hr'], ['아웃', 'out']].forEach((it, i) => {
    const yy = y + i * 20;
    font(c, '500', 12, FONT.kr); const w = c.measureText(it[0]).width;
    txt(c, it[0], rx, yy + 4.5, N.tx2, 'right');
    mark(c, rx - w - 11, yy, 4.5, it[1]);
  });
}

// ── 스프레이 차트 ────────────────────────────────────────
// 잔디 부채꼴(깎은 결 줄무늬) · 워닝 트랙 · 내야 흙 · 분필 파울라인 · 펜스 · 거리.
// 각도 · 거리 옮기기는 core.js 와 같다 (_conePt · _fenceR · _semiToCone — 저장 각도 0~180° → 90° 부채꼴, 거리는 "펜스까지 비율")
// S = 중앙 펜스까지(px). mode: 'num' 궤적 + 번호(개인) · 'dot' 작은 점(시즌) · 없으면 빈 구장(빈 상태)
function field(c, cx, cy, S, abs, mode) {
  const st = stadium(), g = { cx, cy, R: S, kl: st.lfDist / st.cfDist, kr: st.rfDist / st.cfDist }, m = S / st.cfDist, Q = window._FQ;
  const P = (phi, r) => window._conePt(g, phi, r), fence = phi => window._fenceR(g, phi);
  const fan = k => { c.moveTo(cx, cy); for (let i = 0; i <= 72; i++) { const ph = Q + 2 * Q * i / 72, p = P(ph, fence(ph) * k); c.lineTo(p[0], p[1]); } c.closePath(); };
  const base = st.base || 27.43, b = base * m, md = P(2 * Q, (st.mound || 18.44) * m);
  const bs = [P(3 * Q, b), P(2 * Q, b * Math.SQRT2), P(Q, b)];
  c.save();
  c.beginPath(); fan(1); c.fillStyle = N.grass; c.fill();
  c.save(); c.clip();
  // 깎은 결: 홈에서 퍼지는 줄무늬
  c.fillStyle = N.grass2;
  for (let i = 0; i < 14; i += 2) {
    const p0 = P(Q + 2 * Q * i / 14, S * 1.3), p1 = P(Q + 2 * Q * (i + 1) / 14, S * 1.3);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.closePath(); c.fill();
  }
  // 워닝 트랙 · 내야 흙(마운드 중심 29m) · 내야 잔디 · 마운드 · 홈 둘레
  c.beginPath(); fan(1); fan(.93); c.fillStyle = N.dirt; c.fill('evenodd');
  c.beginPath(); c.arc(md[0], md[1], 29 * base / 27.43 * m, 0, TAU); c.fill();
  const inner = p => [md[0] + (p[0] - md[0]) * .76, md[1] + (p[1] - md[1]) * .76], ig = [[cx, cy]].concat(bs).map(inner);
  c.beginPath(); ig.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = N.grass2; c.fill();
  c.fillStyle = N.dirt;
  c.beginPath(); c.arc(md[0], md[1], Math.max(3, 2.9 * m), 0, TAU); c.fill();
  c.beginPath(); c.arc(cx, cy, Math.max(5, 4 * m), 0, TAU); c.fill();
  c.restore();
  // 파울라인 · 펜스 (분필)
  const lp = P(Q, fence(Q)), rp = P(3 * Q, fence(3 * Q));
  c.strokeStyle = N.chalk; c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = 2; c.beginPath(); c.moveTo(lp[0], lp[1]); c.lineTo(cx, cy); c.lineTo(rp[0], rp[1]); c.stroke();
  c.lineWidth = 2.5; c.beginPath();
  for (let i = 0; i <= 72; i++) { const ph = Q + 2 * Q * i / 72, p = P(ph, fence(ph)); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }
  c.stroke();
  c.strokeStyle = N.arc; c.lineWidth = 1; c.setLineDash([3, 5]);
  c.beginPath(); for (let i = 0; i <= 72; i++) { const ph = Q + 2 * Q * i / 72, p = P(ph, fence(ph) * .6); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }
  c.stroke(); c.setLineDash([]);
  // 베이스 · 홈플레이트
  c.fillStyle = N.tx;
  bs.forEach(p => { c.save(); c.translate(p[0], p[1]); c.rotate(Math.PI / 4); c.fillRect(-3, -3, 6, 6); c.restore(); });
  c.beginPath(); c.moveTo(cx, cy + 2); c.lineTo(cx + 4, cy - 1); c.lineTo(cx + 4, cy - 4); c.lineTo(cx - 4, cy - 4); c.lineTo(cx - 4, cy - 1); c.closePath(); c.fill();
  c.restore();
  if (!mode) return;   // 빈 상태 그림: 거리 · 타구 없이
  // 펜스 거리
  font(c, '500', 11, FONT.num);
  const ct = P(2 * Q, S + 9);
  txt(c, st.lfDist + 'm', lp[0] - 7, lp[1] + 4, N.tx3, 'right');
  txt(c, st.cfDist + 'm', ct[0], ct[1], N.tx3, 'center');
  txt(c, st.rfDist + 'm', rp[0] + 7, rp[1] + 4, N.tx3, 'left');

  const pts = abs.map((a, i) => ({ a, i, k: kind(a.res) })).filter(p => p.a.x != null && p.a.y != null);
  const pos = a => window._semiToCone(g, a.x, a.y, a.fa, a.ov);
  if (mode === 'dot') { // 시즌: 아웃 먼저, 홈런을 맨 위에
    const order = ['out', 'bb', 'hit', 'xbh', 'hr'];
    pts.sort((p, q) => order.indexOf(p.k) - order.indexOf(q.k)).forEach(p => {
      const xy = pos(p.a); mark(c, xy[0], xy[1], p.k === 'out' ? 3.4 : p.k === 'hr' ? 5.6 : 4.6, p.k);
    });
    return;
  }
  // 개인: 홈에서 궤적 → 번호 원 (번호 = 타석 칸 번호)
  pts.forEach(p => {
    const xy = pos(p.a), on = p.k !== 'out';
    c.save(); c.beginPath(); c.moveTo(cx, cy); c.lineTo(xy[0], xy[1]);
    c.strokeStyle = on ? COL[p.k] : N.out; c.globalAlpha = on ? .7 : .5; c.lineWidth = on ? 2.2 : 1.4;
    if (!on) c.setLineDash([4, 4]);
    c.stroke(); c.restore();
  });
  pts.forEach(p => { const xy = pos(p.a); mark(c, xy[0], xy[1], 11, p.k, p.i + 1); });
}
// 스프레이 칸: 제목 · 범례 · 칸에 꽉 차는 구장 (S = 높이 · 폭 중 작은 쪽, 폭에 걸리면 세로 가운데)
function sprayPanel(c, y, h, t, abs, mode) {
  panel(c, X, y, CW, h);
  title(c, t, X + 16, y + 28);
  legend(c, W - X - 16, y + 22);
  const st = stadium(), k = Math.max(st.lfDist, st.rfDist) / st.cfDist, cy0 = y + h - 20;
  const Sh = cy0 - y - 32, S = Math.min(Sh, (CW / 2 - 46) / (k * Math.SQRT1_2));   // 46 = 안쪽 여백 + 폴 옆 거리 글자
  field(c, W / 2, cy0 - (Sh - S) / 2, S, abs, mode);
}

// ── 타석 칸 ───────────────────────────────────────────
// 한 열(5줄까지): 번호 원(결과 색, 필드 번호와 같음) · 이닝 · 결과 · 타점. more = 마지막 줄에 "외 N타석"
function abRows(c, x, y, w, list, no, more) {
  list.forEach((a, i) => {
    const ry = y + i * RH, cy = ry + RH / 2;
    if (i) { c.fillStyle = N.line; c.fillRect(x, ry, w, 1); }
    if (more && i === 4) {
      mark(c, x + 11, cy, 11, 'out', '+');
      runs(c, [['외 ', '500', 14, FONT.kr, N.tx2], [String(more), '700', 16, FONT.num, N.tx, 1], ['타석', '500', 14, FONT.kr, N.tx2]], x + 32, cy + 5.5);
      return;
    }
    mark(c, x + 11, cy, 11, kind(a.res), no + i);
    const inn = window._cardInn(a.inn), d = /^(\d+)회$/.exec(inn);
    if (d) runs(c, [[d[1], '600', 15, FONT.num, N.tx2, 1], ['회', '500', 12, FONT.kr, N.tx3]], x + 32, cy + 5.5);
    else { font(c, '500', 13, FONT.kr); txt(c, inn, x + 32, cy + 5, N.tx3); }
    let rx = x + w;
    if (a.rbi) rx -= runs(c, [[String(a.rbi), '700', 16, FONT.num, N.acc, 2], ['타점', '700', 12, FONT.kr, N.acc]], rx, cy + 5.5, 'right') + 10;
    const t = window._cardAbText(a), tx0 = x + 70;
    fitFont(c, t, '700', 16, FONT.kr, rx - tx0, 11); txt(c, t, tx0, cy + 6, N.tx);
  });
}
// 타석 칸 높이 (줄 수에 맞춰) — 남는 높이는 스프레이 칸이 가져간다
const abH = n => 46 + Math.min(5, n) * RH + 6;
function abPanel(c, y, h, abs) {
  panel(c, X, y, CW, h);
  title(c, 'AT-BATS', X + 16, y + 28);
  runs(c, [[String(abs.length), '700', 15, FONT.num, N.tx, 2], ['타석', '500', 12, FONT.kr, N.tx2]], W - X - 16, y + 28, 'right');
  const top = y + 44, ix = X + 16, iw = CW - 32;
  if (abs.length <= 5) { abRows(c, ix, top, iw, abs, 1, 0); return; }
  const cw = (iw - 24) / 2, more = abs.length > 10 ? abs.length - 9 : 0;
  abRows(c, ix, top, cw, abs.slice(0, 5), 1, 0);
  abRows(c, ix + cw + 24, top, cw, abs.slice(5, 10), 6, more);
  c.fillStyle = N.line; c.fillRect(ix + cw + 12, top + 4, 1, 5 * RH - 8);
}

// ── 빈 상태 ───────────────────────────────────────────
// 흐린 빈 구장 · 알약 · 안내 두 줄 · 빈 지표 칸 — 큰 빈 종이 대신 카드가 될 모양을 보여 준다
// 구장은 칸 폭을 꽉 채우는 크기까지 키우고(칸 밖은 자름), 남는 높이는 위 · 구장 아래 · 안내 아래 · 맨 아래 네 틈에 나눈다
function empty(c, y0, y1, tag, main, sub) {
  const h = y1 - y0, st = stadium(), k = Math.max(st.lfDist, st.rfDist) / st.cfDist;
  panel(c, X, y0, CW, h);
  const S = Math.max(120, Math.min(h - 410, (CW / 2 - 6) / (k * Math.SQRT1_2))), g = Math.max(0, (h - S - 290) / 4);
  const fy = y0 + 22 + g + S, my = fy + 30 + g;
  c.save(); rr(c, X, y0, CW, h, 14); c.clip(); c.globalAlpha = .45; field(c, W / 2, fy, S, [], null); c.restore();
  pill(c, cap(tag, N.tx2), W / 2 + (runW(c, cap(tag)) + 28) / 2, my + 15, N.line2, false);
  fitFont(c, main, '900', 28, FONT.kr, CW - 48, 16); txt(c, main, W / 2, my + 76, N.tx, 'center');
  font(c, '500', 15, FONT.kr); txt(c, sub, W / 2, my + 106, N.tx2, 'center');
  tiles(c, X + 24, CW - 48, y1 - 24 - g - 74, 74, [['AVG', '-'], ['OBP', '-'], ['SLG', '-'], ['OPS', '-']], -1, true);
}
// 야구공 그림 (빈 칸 표시): 흰 테 원 + 주황 실밥 두 줄
function ball(c, x, y, r) {
  c.save();
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = rgba(N.tx, .08); c.fill(); c.strokeStyle = N.tx3; c.lineWidth = 1.5; c.stroke();
  c.strokeStyle = N.acc; c.lineWidth = 1.5;
  c.beginPath(); c.arc(x - r * 1.35, y, r * .95, -.62, .62); c.stroke();
  c.beginPath(); c.arc(x + r * 1.35, y, r * .95, Math.PI - .62, Math.PI + .62); c.stroke();
  c.restore();
}

// ── 개인 카드 (9:16) ─────────────────────────────────────
function personal(cv) {
  const H = 960, c = begin(cv, H), AS = window.AS;
  const p = window._cardPlayers().filter(q => String(q.id) === String(window._cardBid))[0];
  const hn = ($('tHome') || {}).value || '홈', an = ($('tAway') || {}).value || '원정';
  if (!p) {
    header(c, window._cardDate(), null);
    empty(c, 102, H - FOOT - 16, 'NO AT-BATS', '아직 기록된 타석이 없어요', '타석을 기록하면 선수 카드가 만들어져요');
    footer(c, H);
    return;
  }
  const abs = AS.abs.filter(a => String(a.bid) === String(p.id)), s = window._cardStats(abs);
  const isHome = p.team !== 'away';
  const myT = isHome ? hn : an, opT = isHome ? an : hn, myS = isHome ? AS.hs : AS.as, opS = isHome ? AS.as : AS.hs;
  const vs = [['VS', '600', 12, FONT.num, N.tx3, 7], [opT, '700', 14, FONT.kr, N.tx, 10]];
  if (myS || opS) vs.push([myS + ' : ' + opS, '600', 15, FONT.num, N.tx2]);
  header(c, window._cardDate(), vs);

  // 한 줄 성적: 숫자는 결과 색 (안타 주황 · 홈런 노랑 · 볼넷 · 사구 파랑)
  const line = [[s.ab, '타수'], [s.h, '안타', s.h ? N.acc : null]];
  if (s.hr) line.push([s.hr, '홈런', N.hr]);
  if (s.rbi) line.push([s.rbi, '타점']);
  if (s.bb) line.push([s.bb, '볼넷', N.bb]);
  if (s.hbp) line.push([s.hbp, '사구', N.bb]);
  const sum = fitParts(c, tokens(line, BIG, BIGU, 18), CW);
  const nz = fitFont(c, p.name, '900', HERO, FONT.kr, CW, 34), nw = c.measureText(p.name).width;

  // 등번호(흐린 큰 숫자) — 이름 · 한 줄 성적 오른쪽에 빈자리가 있을 때만 · 번호와 팀 · 배지 · 이름
  const num = p.num != null && p.num !== '' ? String(p.num) : '', used = X + Math.max(nw, runW(c, sum));
  font(c, '700', 150, FONT.num);
  if (num && W - X - c.measureText(num).width - 16 > used) txt(c, num, W - X + 4, 266, rgba(N.tx, .06), 'right');
  const badge = s.hr ? 'HOME RUN' : s.h >= 3 ? '3 HITS' : s.h >= 2 ? 'MULTI HIT' : null;
  const bw = badge ? pill(c, cap(badge, s.hr ? N.bg : N.tx), W - X, 113, s.hr ? N.hr : N.acc, true) + 16 : 0;
  const team = [[myT, '700', 15, FONT.kr, N.tx2]];
  runs(c, num ? [['NO.' + num, '600', 15, FONT.num, N.acc, 8], ['·', '700', 15, FONT.kr, N.tx3, 8]].concat(team) : team, X, 119, 'left', CW - bw);
  font(c, '900', nz, FONT.kr); txt(c, p.name, X, 196, N.tx);
  runs(c, sum, X, 258, 'left');

  // 스프레이(남는 높이 전부) · 타석 · 슬래시 라인
  const ty = H - FOOT - 16 - 76, lh = abH(abs.length), ly = ty - 12 - lh, sy = 282;
  sprayPanel(c, sy, ly - 12 - sy, 'SPRAY CHART', abs, 'num');
  abPanel(c, ly, lh, abs);
  tiles(c, X, CW, ty, 76, slash(s), 3);
  footer(c, H);
}

// ── 팀 카드 (1:1) ──────────────────────────────────────
function team(cv) {
  const H = 540, c = begin(cv, H), AS = window.AS;
  const hn = ($('tHome') || {}).value || '홈', an = ($('tAway') || {}).value || '원정';
  header(c, window._cardDate(), [['팀 기록', '700', 14, FONT.kr, N.tx]]);

  // 오늘의 타자 (안타 → 루타 → 타점 순, 다섯 명)
  const players = window._cardPlayers().map(p => ({ p, s: window._cardStats(AS.abs.filter(a => String(a.bid) === String(p.id))) }))
    .filter(o => o.s.h > 0 || o.s.rbi > 0)
    .sort((a, b) => b.s.h - a.s.h || b.s.tb - a.s.tb || b.s.rbi - a.s.rbi).slice(0, 5);

  // 스코어보드: 머리 띠 + 두 팀 줄. 이긴 팀 = 왼쪽 주황 막대 + 주황 점수. 타자 칸이 비면 줄을 키운다
  const hs = window._cardStats(AS.abs.filter(a => (a.team || 'home') === 'home'));
  const as = window._cardStats(AS.abs.filter(a => a.team === 'away'));
  const y = 98, hh = 30, rh = players.length ? 52 : 76, ph = hh + rh * 2;
  panel(c, X, y, CW, ph);
  c.save(); rr(c, X, y, CW, ph, 14); c.clip(); c.fillStyle = rgba(N.panel2, .95); c.fillRect(X, y, CW, hh); c.restore();
  const cx = [X + 18, X + CW * .5, X + CW * .645, X + CW * .79, X + CW - 46];
  font(c, '500', 12, FONT.kr); txt(c, '팀', cx[0], y + 20, N.tx3); txt(c, '안타', cx[1], y + 20, N.tx3, 'center'); txt(c, '득점', cx[4], y + 20, N.tx3, 'center');
  font(c, '600', 12, FONT.num); spacing(c, 1.5); txt(c, 'AVG', cx[2] + .75, y + 20, N.tx3, 'center'); txt(c, 'OPS', cx[3] + .75, y + 20, N.tx3, 'center'); spacing(c, 0);
  [[hn, hs, AS.hs, AS.hs > AS.as], [an, as, AS.as, AS.as > AS.hs]].forEach((r, i) => {
    const ry = y + hh + rh * i, cy = ry + rh / 2;
    if (i) { c.fillStyle = N.line; c.fillRect(X + 1, ry, CW - 2, 1); }
    if (r[3]) { c.fillStyle = N.acc; c.fillRect(X + 1, ry + 10, 4, rh - 20); }
    fitFont(c, r[0], '900', rh > 60 ? 26 : 22, FONT.kr, cx[1] - 34 - cx[0], 12); txt(c, r[0], cx[0], cy + mid(c, r[0]), N.tx);
    const v = [String(r[1].h), r[1].pa ? fmt(r[1].avg) : '-', r[1].pa ? fmt(r[1].ops) : '-'];
    font(c, '600', 20, FONT.num);
    v.forEach((t, j) => txt(c, t, cx[j + 1], cy + mid(c, '0'), t === '-' ? N.tx3 : N.tx, 'center'));
    c.save();
    if (r[3]) { c.shadowColor = rgba(N.acc, .7); c.shadowBlur = 16; }
    font(c, '700', rh > 60 ? 50 : 38, FONT.num); txt(c, String(r[2]), cx[4], cy + mid(c, '0'), r[3] ? N.acc : N.tx, 'center');
    c.restore();
  });

  // 오늘의 타자 칸 (다섯 줄)
  const py = y + ph + 12, phh = H - FOOT - 14 - py;
  panel(c, X, py, CW, phh);
  title(c, 'TOP HITTERS', X + 16, py + 28);
  font(c, '700', 13, FONT.kr); txt(c, '오늘의 타자', W - X - 16, py + 28, N.tx2, 'right');
  const top = py + 42, rh2 = (py + phh - 6 - top) / 5, ix = X + 16, iw = CW - 32;
  if (!players.length) {
    const cy = (top + py + phh) / 2;
    ball(c, W / 2, cy - 22, 18);
    font(c, '700', 17, FONT.kr); txt(c, '아직 안타 기록이 없어요', W / 2, cy + 26, N.tx2, 'center');
  }
  players.forEach((o, i) => {
    const ry = top + rh2 * i, cy = ry + rh2 / 2, s = o.s, p = o.p;
    if (i) { c.fillStyle = N.line; c.fillRect(ix, ry, iw, 1); }
    font(c, '600', 15, FONT.num); txt(c, '0' + (i + 1), ix, cy + 5.5, i ? N.tx3 : N.acc);
    const st = [[s.ab, '타수'], [s.h, '안타', s.h ? N.acc : null]];
    if (s.hr) st.push([s.hr, '홈런', N.hr]);
    if (s.rbi) st.push([s.rbi, '타점']);
    const lw = runs(c, tokens(st, 18, 12, 10, '600', '500'), ix + iw, cy + 6, 'right', 220);
    const nm = (p.num != null && p.num !== '' ? [['#' + p.num, '600', 15, FONT.num, N.tx3, 7]] : []).concat([[p.name, '700', 16, FONT.kr, N.tx]]);
    runs(c, nm, ix + 34, cy + 6, 'left', iw - 34 - lw - 16);
  });
  // 다섯 명이 안 되면 남은 순위 칸은 흐리게 비워 둔다 (칸이 꺼져 보이지 않게)
  for (let i = players.length; players.length && i < 5; i++) {
    const cy = top + rh2 * i + rh2 / 2;
    c.fillStyle = N.line; c.fillRect(ix, top + rh2 * i, iw, 1);
    font(c, '600', 15, FONT.num); txt(c, '0' + (i + 1), ix, cy + 5.5, rgba(N.tx3, .5));
    c.fillStyle = rgba(N.tx3, .3); c.fillRect(ix + 34, cy - 1, 28, 2);
  }
  footer(c, H);
}

// ── 시즌 성적 카드 (저장된 전체 경기 집계) ─────────────────────
// 당겨 · 센터 · 밀어 비율: 세 칸 숫자 + 한 줄 막대 (가장 큰 쪽 주황)
function dirPanel(c, y, h, dabs) {
  const tot = dabs.length, pull = dabs.filter(window._isPull).length, ctr = dabs.filter(window._isCtr).length, oppo = tot - pull - ctr;
  const n = [pull, ctr, oppo], pct = n.map(v => Math.round(v / tot * 100)), max = Math.max.apply(null, pct);
  panel(c, X, y, CW, h);
  const ix = X + 16, iw = CW - 32;
  ['당겨', '센터', '밀어'].forEach((l, i) => {
    runs(c, [[l, '700', 13, FONT.kr, N.tx2, 8], [pct[i] + '%', '700', 22, FONT.num, pct[i] === max ? N.acc : N.tx]],
      [ix, ix + iw / 2, ix + iw][i], y + 38, ['left', 'center', 'right'][i]);
  });
  const by = y + h - 26;
  let bx = ix;
  n.forEach((v, i) => {
    const w = iw * v / tot;
    if (w > 0) { rr(c, bx, by, Math.max(w - 3, 2), 8, 4); c.fillStyle = pct[i] === max ? N.acc : N.line2; c.fill(); }
    bx += w;
  });
}
function season(cv) {
  const H = 960, c = begin(cv, H);
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

  header(c, window._cardDate(), [['총', '700', 13, FONT.kr, N.tx2, 6], [String(totalG), '600', 15, FONT.num, N.tx, 2], ['경기', '700', 13, FONT.kr, N.tx2]]);
  font(c, '600', 13, FONT.num); spacing(c, 2.5); txt(c, 'SEASON RECORD', X, 120, N.acc); spacing(c, 0);
  const t = myTeam || '전체 경기';
  fitFont(c, t, '900', HERO, FONT.kr, CW, 30); txt(c, t, X, 190, N.tx);
  if (!totalG) {
    empty(c, 216, H - FOOT - 16, 'NO GAMES', '저장된 경기가 없어요', '경기를 저장하면 시즌 기록이 쌓여요');
    footer(c, H);
    return;
  }
  // 전적 + 승률
  const pw = wins + losses ? pill(c, [['승률', '700', 13, FONT.kr, N.tx2, 8], [fmt(wins / (wins + losses)), '700', 20, FONT.num, N.tx]], W - X, 246, N.acc, false) + 16 : 0;
  runs(c, tokens([[wins, '승', N.acc], [draws, '무'], [losses, '패']], BIG, BIGU, 20), X, 266, 'left', CW - pw);
  // 지표 2줄 (타석이 없으면 '-')
  const v = x => s.pa ? x : '-';
  tiles(c, X, CW, 290, 76, slash(s).map(r => [r[0], v(r[1])]), 3);
  tiles(c, X, CW, 376, 76, [['wOBA', v(fmt(woba))], ['HR', v(String(s.hr))], ['RBI', v(String(s.rbi))], ['PA', v(String(s.pa))]], -1);
  // 타구 분포(남는 높이 전부) + 방향 비율
  const dabs = allAbs.filter(a => a.deg != null), bottom = H - FOOT - 16, sy = 464;
  let sh = bottom - sy;
  if (dabs.length) { dirPanel(c, bottom - 84, 84, dabs); sh -= 96; }
  sprayPanel(c, sy, sh, 'SEASON SPRAY', allAbs, 'dot');
  footer(c, H);
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
