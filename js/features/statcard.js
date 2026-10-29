// 성적 카드 3종(개인 · 팀 · 시즌) + GAME REPORT 공유 이미지 — 방송 그래픽 스타일(야간 스코어보드). core.js 의 _drawCard · pgExport 를 바꿔 낀다
//  · 무엇을 그릴지는 core.js 그대로 읽는다 (_cardPlayers · _cardStats · _cardAbText · _cardInn · _cardDate · _cardFmt · _readSavedGames · _isPull · _isCtr)
//    선수 고르기 · 타석 고르기 · 배지 규칙 · 승무패 · 지표 계산은 core 의 _drawPersonalCard / _drawTeamCard / _drawSeasonCard 와 같다. 그리기만 새로
//  · 효과 없음: 빛 번짐 · 그림자 · 흐린 큰 숫자 · 잔디 줄무늬 없이 평평한 남색 + 가는 선. 맨 위는 TV 스코어 버그, 로고는 꼬리에 한 번
//  · 간격: 모든 칸의 왼쪽 = X · 칸 안 여백 PAD · 칸 사이 G (8 의 배수). 선 굵기는 셋만 — L1 테두리 · L2 줄 · L3 칸 안 가는 선
//  · 구장은 Statcast 식: 옅은 페어 지역 · 펜스 호 · 파울라인 · 내야 호 · 다이아몬드 · 거리 점선 호. 점은 결과 색 + 바탕색 테
//  · 크기는 그대로: 개인 · 시즌 540×960(9:16), 팀 540×540(1:1) → 2배 PNG (#cardPreviewCanvas)
//  · core 는 _drawCard 를 전역 이름으로 부른다(열기 · 종류 바꾸기 · 선수 바꾸기 · 글꼴 로드 뒤) → window._drawCard 를 바꾸면 모두 새 그림

import { FONT, NIGHT as N, font, fitFont, spacing, rr, wordmark, drawWithFonts } from './imgkit.js?v=1';
import { WOBA_W } from '../constants.js';

const $ = id => document.getElementById(id);
const SCALE = 2, W = 540, X = 24, CW = W - X * 2, PAD = 16, G = 16, FOOT = 48, TAU = Math.PI * 2;
// 스코어 버그 자리 · 높이, 타석 한 줄 높이, 칸 모서리
const SB_Y = 24, SB = 48, RH = 32, RAD = 6;
// 선 굵기 셋: 테두리 · 줄 · 칸 안 가는 선
const L1 = 1.5, L2 = 1, L3 = .5;
// 글자 크기 단계: 큰 제목(선수 이름) · 큰 숫자 줄(한 줄 성적)
const HERO = 56, BIG = 36, BIGU = 17;
// 구장 규격 색(공통 규격 문서: 페어 지역 · 파울라인)
const FAN = 'rgba(255,255,255,0.035)', FOUL = 'rgba(255,255,255,0.5)';

// 결과 → 색 종류: hr 홈런 · xbh 2·3루타 · hit 안타 · bb 볼넷 · 사구 · out 그 밖(아웃 · 희생 · 실책 · 야수선택 …)
const kind = r => r === '홈런' ? 'hr' : r === '2루타' || r === '3루타' ? 'xbh' : (window.CARD_HITS || []).indexOf(r) !== -1 ? 'hit' : r === '볼넷' || r === '사구' ? 'bb' : 'out';
const COL = { hit: N.acc, xbh: N.xbh, hr: N.hr, bb: N.bb, out: N.out };
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
// 글자를 세로 가운데에 놓을 기준선 보정 (번호 원 · 버그 칸)
const mid = (c, t) => { const m = c.measureText(t); return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2; };
// 가로 · 세로 선 (굵기 L1 · L2 · L3)
const rule = (c, x, y, w, lw) => { c.fillStyle = N.line; c.fillRect(x, y - lw / 2, w, lw); };
const vrule = (c, x, y, h, lw) => { c.fillStyle = N.line; c.fillRect(x - lw / 2, y, lw, h); };
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
const tokens = (list, n, u, gap, nw, uw) => list.reduce((a, t, i) => a.concat([
  [String(t[0]), nw || '700', n, FONT.num, t[2] || N.tx, n * .06], [t[1], uw || '500', u, FONT.kr, N.tx2, i < list.length - 1 ? gap : 0]]), []);

// ── 바탕 · 꼬리 ────────────────────────────────────────
// 캔버스 크기 · 화면 맞춤(높이 60% 안) · 평평한 남색. sc = 배율(카드 2배 · GAME REPORT 는 내보낼 폭 / 540)
function begin(cv, H, sc = SCALE) {
  cv.width = W * sc; cv.height = H * sc;
  cv.style.width = '100%'; cv.style.height = 'auto'; cv.style.maxWidth = 'calc(60vh * ' + (W / H).toFixed(4) + ')'; cv.style.margin = '0 auto';
  const c = cv.getContext('2d');
  c.setTransform(sc, 0, 0, sc, 0, 0); c.textBaseline = 'alphabetic'; c.letterSpacing = '0px';
  c.fillStyle = N.bg; c.fillRect(0, 0, W, H);
  return c;
}
// 꼬리 띠: 로고(왼쪽, 카드에 한 번) · 계정(오른쪽)
function footer(c, H) {
  const y = H - FOOT;
  c.fillStyle = N.bg2; c.fillRect(0, y, W, FOOT);
  rule(c, 0, y, W, L1);
  wordmark(c, X, y + 29, 13, N.tx, N.acc);
  font(c, '500', 12, FONT.num); txt(c, '@spraylab2026', W - X, y + 29, N.tx2, 'right');
}

// ── 부품 ─────────────────────────────────────────────
const panel = (c, x, y, w, h) => { rr(c, x, y, w, h, RAD); c.fillStyle = N.bg2; c.fill(); c.strokeStyle = N.line; c.lineWidth = L1; c.stroke(); };
// 칸 머리: 영문 대문자 제목(작게 · 흐리게) + 아래 줄. 오른쪽 내용은 부르는 쪽이 같은 기준선 y + 26 에
function head(c, y, t) {
  font(c, '600', 11, FONT.num); spacing(c, 2); txt(c, t, X + PAD, y + 26, N.tx2); spacing(c, 0);
  rule(c, X + PAD, y + 40, CW - PAD * 2, L2);
}
// 상태 꼬리표(MULTI HIT · HOME RUN · NO AT-BATS): 납작한 직사각형 + 영문 대문자. x = 오른쪽 끝(align 'center' 면 가운데) · cy = 가운데. 폭 반환
function tag(c, t, x, cy, fill, col, align) {
  font(c, '700', 11, FONT.num); spacing(c, 1);
  const w = c.measureText(t).width + 15, h = 20, lx = align === 'center' ? x - w / 2 : x - w;
  rr(c, lx, cy - h / 2, w, h, 2); c.fillStyle = fill; c.fill();
  txt(c, t, lx + w / 2 + .5, cy + mid(c, t), col, 'center'); spacing(c, 0);
  return w;
}
// 스코어 버그 틀: 칸 폭 ws(합 = CW) · 칸 바탕 fills · 칸 사이 가는 선 · ours 칸 왼쪽에 주황 띠(우리 팀). 칸 왼쪽 x 들 반환
function bug(c, ws, fills, ours) {
  const xs = [];
  c.save(); rr(c, X, SB_Y, CW, SB, RAD); c.clip();
  ws.reduce((x, w, i) => { xs.push(x); c.fillStyle = fills[i]; c.fillRect(x, SB_Y, w, SB); if (i) vrule(c, x, SB_Y, SB, L3); return x + w; }, X);
  if (ours >= 0) { c.fillStyle = N.acc; c.fillRect(xs[ours], SB_Y, 3, SB); }
  c.restore();
  rr(c, X, SB_Y, CW, SB, RAD); c.strokeStyle = N.line2; c.lineWidth = L1; c.stroke();
  return xs;
}
// 경기 버그: [우리 팀 | 점수] [상대 | 점수] [날짜]. 이긴 점수는 흰색 · 진 점수는 흐리게 · 점수가 없으면(0:0) '-'
function gameBug(c, t1, t2, s1, s2, ours) {
  const sw = 52, dw = 96, tw = (CW - sw * 2 - dw) / 2, cy = SB_Y + SB / 2, has = s1 || s2;
  const xs = bug(c, [tw, sw, tw, sw, dw], [N.panel, N.panel2, N.panel, N.panel2, N.panel], ours);
  [[t1, s1, s1 >= s2], [t2, s2, s2 >= s1]].forEach((r, i) => {
    fitFont(c, r[0], '700', 15, FONT.kr, tw - PAD * 2, 10); txt(c, r[0], xs[i * 2] + PAD, cy + mid(c, r[0]), N.tx);
    const v = has ? String(r[1]) : '-';
    font(c, '700', 24, FONT.num); txt(c, v, xs[i * 2 + 1] + sw / 2, cy + mid(c, '0'), has ? (r[2] ? N.tx : N.tx2) : N.tx3, 'center');
  });
  font(c, '600', 13, FONT.num); txt(c, window._cardDate(), xs[4] + dw / 2, cy + mid(c, '0'), N.tx2, 'center');
}
// 지표 띠: 줄마다 네 칸(가는 선으로 나눔) · 라벨 위 · 값 아래. 값은 한 기준선 · 한 크기(가장 긴 값에 맞춤). hi = 첫 줄의 주황 값 칸
// 라벨: 영문은 Oswald 자간, 한글(팀 타율 · 안타 …)은 Noto 자간 없이. 줄 높이 72 미만이면 값은 24 까지
function strip(c, x, y, w, rh, rows, hi) {
  panel(c, x, y, w, rh * rows.length);
  const cw = w / 4;
  let z = rh < 72 ? 24 : 30;
  rows.forEach(r => r.forEach(v => { z = Math.min(z, fitFont(c, v[1], '700', z, FONT.num, cw - PAD * 2, 16)); }));
  rows.forEach((r, j) => {
    const ry = y + rh * j;
    if (j) rule(c, x + PAD, ry, w - PAD * 2, L2);
    r.forEach((v, i) => {
      const cx = x + cw * i;
      if (i) vrule(c, cx, ry + 12, rh - 24, L3);
      const kr = /[가-힣]/.test(v[0]);
      font(c, kr ? '500' : '600', 11, kr ? FONT.kr : FONT.num); spacing(c, kr ? 0 : 1.5); txt(c, v[0], cx + PAD, ry + 20, N.tx3); spacing(c, 0);
      font(c, '700', z, FONT.num); txt(c, v[1], cx + PAD, ry + rh - 13, v[1] === '-' ? N.tx3 : !j && i === hi ? N.acc : N.tx);
    });
  });
}
const slash = s => [['AVG', fmt(s.avg)], ['OBP', fmt(s.obp)], ['SLG', fmt(s.slg)], ['OPS', fmt(s.ops)]];

// 타구 점: 결과 색 원 + 바탕색 테 1.5px(겹쳐도 갈라 보이게) · 아웃 = 회색 빈 고리 · 홈런 = 조금 크게 + 바깥 가는 고리. 빛 번짐 없음
function mark(c, x, y, r, k, num) {
  if (k === 'hr') { r *= 1.12; c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.strokeStyle = N.hr; c.lineWidth = 1; c.stroke(); }
  c.beginPath(); c.arc(x, y, r + 1.5, 0, TAU); c.fillStyle = N.bg; c.fill();
  c.beginPath();
  if (k === 'out') { c.arc(x, y, r - .75, 0, TAU); c.strokeStyle = N.out; c.lineWidth = 1.5; c.stroke(); }
  else { c.arc(x, y, r, 0, TAU); c.fillStyle = COL[k]; c.fill(); }
  if (num == null) return;
  const t = String(num);
  font(c, '600', Math.round(r * 1.1), FONT.num);
  txt(c, t, x, y + mid(c, t), k === 'out' ? N.tx2 : k === 'xbh' || k === 'hr' ? N.bg : N.tx, 'center');
}
// 범례 한 줄(오른쪽 끝 rx · 칸 머리 기준선 b): ● 안타 ● 장타 ● 홈런 ○ 아웃
function legend(c, rx, b) {
  const it = [['안타', 'hit'], ['장타', 'xbh'], ['홈런', 'hr'], ['아웃', 'out']];
  font(c, '500', 11, FONT.kr);
  const ws = it.map(v => c.measureText(v[0]).width);
  let x = rx - ws.reduce((s, w) => s + w + 28, -12);
  it.forEach((v, i) => { mark(c, x + 6, b - 4, 3.5, v[1]); font(c, '500', 11, FONT.kr); txt(c, v[0], x + 16, b, N.tx3); x += ws[i] + 28; });
}

// ── 스프레이 차트 (Statcast 식) ─────────────────────────────
// 옅은 페어 지역 · 내야 호 · 거리 점선 호 · 다이아몬드 · 파울라인 · 펜스(가장 굵은 선) · 작은 베이스 · 홈
// 각도 · 거리 옮기기는 core.js 와 같다 (_conePt · _fenceR · _semiToCone — 저장 각도 0~180° → 90° 부채꼴, 거리는 "펜스까지 비율")
// S = 중앙 펜스까지(px). mode: 'num' 번호 원(개인) · 'dot' 작은 점(시즌) · 없으면 빈 구장(빈 상태)
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
  c.strokeStyle = N.line2; c.lineWidth = 1;
  c.beginPath(); c.arc(md[0], md[1], 29 * base / 27.43 * m, 0, TAU); c.stroke();
  c.strokeStyle = N.arc; c.setLineDash([3, 4]);
  dists.forEach(d => { c.beginPath(); c.arc(cx, cy, d * m, Math.PI + Q, Math.PI + 3 * Q); c.stroke(); });
  c.setLineDash([]);
  c.restore();
  c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = FOUL;
  c.lineWidth = 1; c.beginPath(); c.moveTo(bs[0][0], bs[0][1]); c.lineTo(bs[1][0], bs[1][1]); c.lineTo(bs[2][0], bs[2][1]); c.stroke();
  c.lineWidth = 1.5; c.beginPath(); c.moveTo(lp[0], lp[1]); c.lineTo(cx, cy); c.lineTo(rp[0], rp[1]); c.stroke();
  c.strokeStyle = N.line2; c.lineWidth = 2; c.beginPath(); fenceLine(false); c.stroke();
  // 베이스(45° 돌린 작은 네모) · 홈(오각형)
  c.fillStyle = N.tx;
  bs.forEach(p => { c.save(); c.translate(p[0], p[1]); c.rotate(Math.PI / 4); c.fillRect(-2.5, -2.5, 5, 5); c.restore(); });
  c.beginPath(); c.moveTo(cx, cy + 1.5); c.lineTo(cx + 3, cy - 1); c.lineTo(cx + 3, cy - 3.5); c.lineTo(cx - 3, cy - 3.5); c.lineTo(cx - 3, cy - 1); c.closePath(); c.fill();
  c.restore();
  if (!mode) return;   // 빈 상태 그림: 거리 · 타구 없이
  // 거리 글자: 펜스(폴 바깥 · 중앙 위) · 거리 호(왼쪽 파울라인 바깥)
  font(c, '500', 10, FONT.num);
  const ct = pt(2 * Q, S + 8);
  txt(c, st.lfDist + 'm', lp[0] - 6, lp[1] + 4, N.tx3, 'right');
  txt(c, st.cfDist + 'm', ct[0], ct[1], N.tx3, 'center');
  txt(c, st.rfDist + 'm', rp[0] + 6, rp[1] + 4, N.tx3, 'left');
  dists.forEach(d => { const p = pt(Q, d * m); txt(c, d + 'm', p[0] - 6, p[1] + 3, N.tx3, 'right'); });
  // 점: 아웃 먼저, 홈런을 맨 위에
  const order = ['out', 'bb', 'hit', 'xbh', 'hr'];
  abs.map((a, i) => ({ a, i, k: kind(a.res) })).filter(p => p.a.x != null && p.a.y != null)
    .sort((p, q) => order.indexOf(p.k) - order.indexOf(q.k))
    .forEach(p => {
      const xy = window._semiToCone(g, p.a.x, p.a.y, p.a.fa, p.a.ov);
      if (mode === 'dot') mark(c, xy[0], xy[1], p.k === 'out' ? 3.5 : 4.5, p.k);
      else mark(c, xy[0], xy[1], 10, p.k, p.i + 1);   // 번호 = 타석 칸 번호
    });
}
// 스프레이 칸: 머리(제목 · 범례) · 칸에 꽉 차는 구장 (S = 높이 · 폭 중 작은 쪽, 폭에 걸리면 세로 가운데)
// x · w 를 주면 그 자리(GAME REPORT 피드의 왼쪽 칸), t 가 없으면 머리 없이 구장만
function sprayPanel(c, y, h, t, abs, mode, x = X, w = CW) {
  panel(c, x, y, w, h);
  if (t) { head(c, y, t); legend(c, x + w - PAD, y + 26); }
  const st = stadium(), k = Math.max(st.lfDist, st.rfDist) / st.cfDist, top = y + (t ? 40 + 24 : PAD + 14), bot = y + h - PAD - 4;
  const Sh = bot - top, S = Math.min(Sh, (w / 2 - PAD - 32) / (k * Math.SQRT1_2));   // 32 = 폴 옆 거리 글자
  field(c, x + w / 2, bot - (Sh - S) / 2, S, abs, mode);
}

// ── 타석 칸 ───────────────────────────────────────────
// 한 열(5줄까지): 번호 원(결과 색, 구장 번호와 같음) · 이닝 · 결과 글 · 타점 · 결과 약어(오른쪽 끝 맞춤). more = 마지막 줄에 "외 N타석"
function abRows(c, x, y, w, list, no, more) {
  list.forEach((a, i) => {
    const ry = y + i * RH, cy = ry + RH / 2, b = cy + 5;
    if (i) rule(c, x, ry, w, L2);
    if (more && i === 4) {
      mark(c, x + 10, cy, 10, 'out', '+');
      runs(c, [['외 ', '500', 13, FONT.kr, N.tx2], [String(more), '700', 15, FONT.num, N.tx, 1], ['타석', '500', 13, FONT.kr, N.tx2]], x + 30, b);
      return;
    }
    const k = kind(a.res);
    mark(c, x + 10, cy, 10, k, no + i);
    const inn = window._cardInn(a.inn), d = /^(\d+)회$/.exec(inn);
    if (d) runs(c, [[d[1], '600', 14, FONT.num, N.tx2, 1], ['회', '500', 11, FONT.kr, N.tx3]], x + 30, b);
    else { font(c, '500', 12, FONT.kr); txt(c, inn, x + 30, b, N.tx3); }
    font(c, '600', 13, FONT.num); txt(c, code(a), x + w, b, k === 'out' ? N.tx2 : COL[k], 'right');
    let rx = x + w - 40;
    if (a.rbi) rx -= runs(c, [[String(a.rbi), '700', 14, FONT.num, N.tx, 1], ['타점', '500', 11, FONT.kr, N.tx3]], rx, b, 'right') + 8;
    const t = window._cardAbText(a), tx0 = x + 60;
    fitFont(c, t, '700', 15, FONT.kr, rx - tx0, 10); txt(c, t, tx0, b, N.tx);
  });
}
// 타석 칸 높이 (줄 수에 맞춰) — 남는 높이는 스프레이 칸이 가져간다
const abH = n => 40 + Math.max(1, Math.min(5, n)) * RH + 8;
function abPanel(c, y, h, abs) {
  panel(c, X, y, CW, h);
  head(c, y, 'AT-BATS');
  runs(c, [[String(abs.length), '600', 13, FONT.num, N.tx, 2], ['타석', '500', 11, FONT.kr, N.tx3]], W - X - PAD, y + 26, 'right');
  const top = y + 40, ix = X + PAD, iw = CW - PAD * 2;
  if (abs.length <= 5) { abRows(c, ix, top, iw, abs, 1, 0); return; }
  const cw = (iw - 24) / 2, more = abs.length > 10 ? abs.length - 9 : 0;
  abRows(c, ix, top, cw, abs.slice(0, 5), 1, 0);
  abRows(c, ix + cw + 24, top, cw, abs.slice(5, 10), 6, more);
  vrule(c, ix + cw + 12, top + 8, 5 * RH - 16, L3);
}

// ── 빈 상태 ───────────────────────────────────────────
// 흐린 빈 구장 · 꼬리표 · 안내 두 줄 · 빈 지표 띠 — 큰 빈 종이 대신 카드가 될 모양을 보여 준다
// 구장은 칸 폭을 거의 채우는 크기(칸 밖은 자름), 남는 높이는 위 · 구장 아래 · 안내 아래 · 맨 아래 네 틈에 같게 나눈다
function empty(c, y0, y1, label, main, sub) {
  const h = y1 - y0, st = stadium(), k = Math.max(st.lfDist, st.rfDist) / st.cfDist, MSG = 96, STR = 72;
  panel(c, X, y0, CW, h);
  const S = Math.max(120, Math.min(h - PAD * 2 - MSG - STR - 96, (CW / 2 - 8) / (k * Math.SQRT1_2))), g = Math.max(0, (h - PAD * 2 - S - MSG - STR) / 4);
  const fy = y0 + PAD + g + S, my = fy + g;
  c.save(); rr(c, X, y0, CW, h, RAD); c.clip(); c.globalAlpha = .5; field(c, W / 2, fy, S, [], null); c.restore();
  tag(c, label, W / 2, my + 10, N.panel2, N.tx2, 'center');
  fitFont(c, main, '900', 26, FONT.kr, CW - 48, 16); txt(c, main, W / 2, my + 64, N.tx, 'center');
  font(c, '500', 14, FONT.kr); txt(c, sub, W / 2, my + 92, N.tx2, 'center');
  strip(c, X + PAD, y1 - PAD - g - STR, CW - PAD * 2, STR, [[['AVG', '-'], ['OBP', '-'], ['SLG', '-'], ['OPS', '-']]], -1);
}
// 야구공 그림 (빈 칸 표시): 원 + 실밥 두 줄 (선만)
function ball(c, x, y, r) {
  c.save(); c.strokeStyle = N.tx3; c.lineWidth = L1;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  c.beginPath(); c.arc(x - r * 1.35, y, r * .95, -.62, .62); c.stroke();
  c.beginPath(); c.arc(x + r * 1.35, y, r * .95, Math.PI - .62, Math.PI + .62); c.stroke();
  c.restore();
}

// ── 개인 카드 (9:16) ─────────────────────────────────────
function personal(cv) {
  const H = 960, c = begin(cv, H), AS = window.AS, bot = H - FOOT - G;
  const p = window._cardPlayers().filter(q => String(q.id) === String(window._cardBid))[0];
  const hn = ($('tHome') || {}).value || '홈', an = ($('tAway') || {}).value || '원정';
  if (!p) {
    gameBug(c, hn, an, AS.hs, AS.as, -1);
    empty(c, SB_Y + SB + G, bot, 'NO AT-BATS', '아직 기록된 타석이 없어요', '타석을 기록하면 선수 카드가 만들어져요');
    footer(c, H);
    return;
  }
  const abs = AS.abs.filter(a => String(a.bid) === String(p.id)), s = window._cardStats(abs);
  const isHome = p.team !== 'away';
  const myT = isHome ? hn : an, opT = isHome ? an : hn, myS = isHome ? AS.hs : AS.as, opS = isHome ? AS.as : AS.hs;
  gameBug(c, myT, opT, myS, opS, 0);

  // 번호 · 팀(작게) + 배지 → 이름 → 한 줄 성적(숫자는 결과 색: 안타 주황 · 홈런 노랑 · 볼넷 · 사구 파랑)
  const ly = SB_Y + SB + 32;
  const badge = s.hr ? 'HOME RUN' : s.h >= 3 ? '3 HITS' : s.h >= 2 ? 'MULTI HIT' : null;
  const bw = badge ? tag(c, badge, W - X, ly - 4, s.hr ? N.hr : N.acc, N.bg) + 12 : 0;
  const num = p.num != null && p.num !== '' ? String(p.num) : '', team = [[myT, '500', 13, FONT.kr, N.tx2]];
  runs(c, num ? [['NO.' + num, '600', 13, FONT.num, N.tx, 6], ['·', '500', 13, FONT.kr, N.tx3, 6]].concat(team) : team, X, ly, 'left', CW - bw);
  fitFont(c, p.name, '900', HERO, FONT.kr, CW, 30); txt(c, p.name, X, ly + 64, N.tx);
  const line = [[s.ab, '타수'], [s.h, '안타', s.h ? N.acc : null]];
  if (s.hr) line.push([s.hr, '홈런', N.hr]);
  if (s.rbi) line.push([s.rbi, '타점']);
  if (s.bb) line.push([s.bb, '볼넷', N.bb]);
  if (s.hbp) line.push([s.hbp, '사구', N.bb]);
  runs(c, tokens(line, BIG, BIGU, 16), X, ly + 116, 'left', CW);

  // 슬래시 라인 · 스프레이(남는 높이 전부) · 타석
  const ty = ly + 132, lh = abH(abs.length), ay = bot - lh, sy = ty + 72 + G;
  strip(c, X, ty, CW, 72, [slash(s)], 3);
  sprayPanel(c, sy, ay - G - sy, 'SPRAY CHART', abs, 'num');
  abPanel(c, ay, lh, abs);
  footer(c, H);
}

// ── 팀 카드 (1:1) ──────────────────────────────────────
function team(cv) {
  const H = 540, c = begin(cv, H), AS = window.AS, bot = H - FOOT - G;
  const hn = ($('tHome') || {}).value || '홈', an = ($('tAway') || {}).value || '원정';

  // 오늘의 타자 (안타 → 루타 → 타점 순, 다섯 명)
  const players = window._cardPlayers().map(p => ({ p, s: window._cardStats(AS.abs.filter(a => String(a.bid) === String(p.id))) }))
    .filter(o => o.s.h > 0 || o.s.rbi > 0)
    .sort((a, b) => b.s.h - a.s.h || b.s.tb - a.s.tb || b.s.rbi - a.s.rbi).slice(0, 5);

  // 라인 스코어(스코어 버그 모양): 머리 줄 + 두 팀 줄. 안타는 오른쪽 맞춤 · AVG · OPS 는 소수점 맞춤 · 득점은 칸 가운데
  // 이긴 팀 = 왼쪽 주황 띠 + 흰 점수, 진 팀 점수는 흐리게
  const hs = window._cardStats(AS.abs.filter(a => (a.team || 'home') === 'home'));
  const as = window._cardStats(AS.abs.filter(a => a.team === 'away'));
  // 머리 줄(시즌 카드의 SEASON RECORD 줄과 같은 모양): GAME RECORD · 날짜 · 팀 기록
  font(c, '600', 11, FONT.num); spacing(c, 2); txt(c, 'GAME RECORD', X, SB_Y + 16, N.tx2); spacing(c, 0);
  runs(c, [[window._cardDate(), '500', 12, FONT.num, N.tx2, 10], ['팀 기록', '500', 12, FONT.kr, N.tx3]], W - X, SB_Y + 16, 'right');
  const y = SB_Y + 32, hh = 28, rh = 48, sw = 64, bh = hh + rh * 2, rc = X + CW - sw / 2;
  font(c, '600', 20, FONT.num);
  const fw = c.measureText('.000').width, dw = c.measureText('0').width;
  const opt = X + CW - sw - PAD - fw, apt = opt - fw - 24 - dw, hx = apt - dw - 24;
  const win = [AS.hs > AS.as, AS.as > AS.hs];
  c.save(); rr(c, X, y, CW, bh, RAD); c.clip();
  c.fillStyle = N.panel; c.fillRect(X, y, CW, bh);
  c.fillStyle = N.bg2; c.fillRect(X, y, CW, hh);
  c.fillStyle = N.panel2; c.fillRect(X + CW - sw, y + hh, sw, rh * 2);
  vrule(c, X + CW - sw, y, bh, L3);
  win.forEach((w, i) => { if (w) { c.fillStyle = N.acc; c.fillRect(X, y + hh + rh * i, 3, rh); } });
  c.restore();
  rr(c, X, y, CW, bh, RAD); c.strokeStyle = N.line2; c.lineWidth = L1; c.stroke();
  rule(c, X, y + hh, CW, L2); rule(c, X, y + hh + rh, CW, L2);
  font(c, '500', 11, FONT.kr); txt(c, '팀', X + PAD, y + 18, N.tx3); txt(c, '안타', hx, y + 18, N.tx3, 'right'); txt(c, '득점', rc, y + 18, N.tx3, 'center');
  font(c, '600', 11, FONT.num); txt(c, 'AVG', apt + fw, y + 18, N.tx3, 'right'); txt(c, 'OPS', opt + fw, y + 18, N.tx3, 'right');
  [[hn, hs, AS.hs], [an, as, AS.as]].forEach((r, i) => {
    const cy = y + hh + rh * i + rh / 2;
    fitFont(c, r[0], '700', 17, FONT.kr, hx - 48 - X - PAD, 11); txt(c, r[0], X + PAD, cy + mid(c, r[0]), N.tx);
    font(c, '600', 20, FONT.num);
    const b = cy + mid(c, '0'), v = [r[1].pa ? fmt(r[1].avg) : '-', r[1].pa ? fmt(r[1].ops) : '-'];
    txt(c, String(r[1].h), hx, b, N.tx, 'right');
    dec(c, v[0], apt, b, v[0] === '-' ? N.tx3 : N.tx);
    dec(c, v[1], opt, b, v[1] === '-' ? N.tx3 : N.tx);
    font(c, '700', 28, FONT.num); txt(c, String(r[2]), rc, cy + mid(c, '0'), win[i] || AS.hs === AS.as ? N.tx : N.tx2, 'center');
  });

  // 오늘의 타자 표: 순위 · 번호 · 이름 | 타수 · 안타 · 홈런 · 타점 (숫자 칸 오른쪽 맞춤 · 0 은 흐리게)
  const py = y + bh + G, ph = bot - py, ix = X + PAD, iw = CW - PAD * 2;
  panel(c, X, py, CW, ph);
  head(c, py, 'TOP HITTERS');
  font(c, '600', 11, FONT.num); spacing(c, 2); const tw = c.measureText('TOP HITTERS').width; spacing(c, 0);
  font(c, '500', 11, FONT.kr); txt(c, '오늘의 타자', ix + tw + 8, py + 26, N.tx3);
  const colX = [ix + iw - 144, ix + iw - 96, ix + iw - 48, ix + iw];
  ['타수', '안타', '홈런', '타점'].forEach((l, j) => txt(c, l, colX[j], py + 26, N.tx3, 'right'));
  const top = py + 40, rh2 = (py + ph - 8 - top) / 5;
  if (!players.length) {
    const cy = (top + py + ph) / 2;
    ball(c, W / 2, cy - 20, 16);
    font(c, '700', 16, FONT.kr); txt(c, '아직 안타 기록이 없어요', W / 2, cy + 24, N.tx2, 'center');
  }
  players.forEach((o, i) => {
    const ry = top + rh2 * i, b = ry + rh2 / 2 + 6, s = o.s, p = o.p;
    if (i) rule(c, ix, ry, iw, L2);
    font(c, '600', 13, FONT.num); txt(c, '0' + (i + 1), ix, b, N.tx3);
    const v = [[s.ab, N.tx], [s.h, N.acc], [s.hr, N.hr], [s.rbi, N.tx]];
    font(c, '600', 18, FONT.num); v.forEach((t, j) => txt(c, String(t[0]), colX[j], b, t[0] ? t[1] : N.tx3, 'right'));
    if (p.num != null && p.num !== '') { font(c, '500', 13, FONT.num); txt(c, '#' + p.num, ix + 56, b, N.tx3, 'right'); }
    fitFont(c, p.name, '700', 16, FONT.kr, colX[0] - 40 - ix - 64, 10); txt(c, p.name, ix + 64, b, N.tx);
  });
  // 다섯 명이 안 되면 남은 순위 칸은 흐리게 비워 둔다 (칸이 꺼져 보이지 않게)
  for (let i = players.length; players.length && i < 5; i++) {
    const ry = top + rh2 * i, b = ry + rh2 / 2 + 6;
    rule(c, ix, ry, iw, L2);
    font(c, '600', 13, FONT.num); txt(c, '0' + (i + 1), ix, b, N.line2);
    c.fillStyle = N.line2; c.fillRect(ix + 64, b - 5, 24, 1.5);
  }
  footer(c, H);
}

// ── 시즌 성적 카드 (저장된 전체 경기 집계) ─────────────────────
// 당겨 · 센터 · 밀어 비율: 세 칸(라벨 + 숫자) + 한 줄 막대 (가장 큰 쪽 주황). 방향 있는 타구가 없으면 0% · 빈 막대(GAME REPORT)
function dirPanel(c, y, h, dabs) {
  const tot = dabs.length || 1, pull = dabs.filter(window._isPull).length, ctr = dabs.filter(window._isCtr).length, oppo = dabs.length - pull - ctr;
  const n = [pull, ctr, oppo], pct = n.map(v => Math.round(v / tot * 100)), max = Math.max.apply(null, pct) || -1;
  panel(c, X, y, CW, h);
  const ix = X + PAD, iw = CW - PAD * 2;
  ['당겨', '센터', '밀어'].forEach((l, i) => {
    runs(c, [[l, '500', 12, FONT.kr, N.tx3, 8], [pct[i] + '%', '700', 22, FONT.num, pct[i] === max ? N.acc : N.tx]], ix + iw / 3 * i, y + 34, 'left');
  });
  if (!dabs.length) { c.fillStyle = N.line; c.fillRect(ix, y + h - PAD - 6, iw, 6); }
  let bx = ix;
  n.forEach((v, i) => {
    const w = iw * v / tot;
    if (w > 0) { c.fillStyle = pct[i] === max ? N.acc : N.line2; c.fillRect(bx, y + h - PAD - 6, Math.max(w - 2, 1), 6); }
    bx += w;
  });
}
// 시즌 버그: [팀 | 승 · 무 · 패 | 승률]
function seasonBug(c, t, w, d, l, pct) {
  const rw = 156, pw = 112, tw = CW - rw - pw, cy = SB_Y + SB / 2;
  const xs = bug(c, [tw, rw, pw], [N.panel, N.panel2, N.panel], 0);
  fitFont(c, t, '700', 15, FONT.kr, tw - PAD * 2, 10); txt(c, t, xs[0] + PAD, cy + mid(c, t), N.tx);
  font(c, '700', 22, FONT.num); const b = cy + mid(c, '0');
  runs(c, tokens([[w, '승', w ? N.acc : null], [d, '무'], [l, '패']], 22, 12, 10), xs[1] + rw / 2, b, 'center');
  runs(c, [['승률', '500', 11, FONT.kr, N.tx3, 8], [pct, '700', 20, FONT.num, pct === '-' ? N.tx3 : N.tx]], xs[2] + pw / 2, b, 'center');
}
function season(cv) {
  const H = 960, c = begin(cv, H), bot = H - FOOT - G;
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

  seasonBug(c, myTeam || '전체 경기', wins, draws, losses, wins + losses ? fmt(wins / (wins + losses)) : '-');
  const ly = SB_Y + SB + 32;
  font(c, '600', 11, FONT.num); spacing(c, 2); txt(c, 'SEASON RECORD', X, ly, N.tx2); spacing(c, 0);
  runs(c, [[window._cardDate(), '500', 12, FONT.num, N.tx2, 10], ['총', '500', 12, FONT.kr, N.tx3, 4], [String(totalG), '600', 13, FONT.num, N.tx, 2], ['경기', '500', 12, FONT.kr, N.tx3]], W - X, ly, 'right');
  const t = myTeam || '전체 경기';
  fitFont(c, t, '900', HERO, FONT.kr, CW, 30); txt(c, t, X, ly + 64, N.tx);
  if (!totalG) {
    empty(c, ly + 84, bot, 'NO GAMES', '저장된 경기가 없어요', '경기를 저장하면 시즌 기록이 쌓여요');
    footer(c, H);
    return;
  }
  // 지표 2줄 (타석이 없으면 '-')
  const v = x => s.pa ? x : '-', ty = ly + 84;
  strip(c, X, ty, CW, 72, [slash(s).map(r => [r[0], v(r[1])]), [['wOBA', v(fmt(woba))], ['HR', v(String(s.hr))], ['RBI', v(String(s.rbi))], ['PA', v(String(s.pa))]]], 3);
  // 타구 분포(남는 높이 전부) + 방향 비율
  const dabs = allAbs.filter(a => a.deg != null), sy = ty + 144 + G, dh = 72;
  let sh = bot - sy;
  if (dabs.length) { dirPanel(c, bot - dh, dh, dabs); sh -= dh + G; }
  sprayPanel(c, sy, sh, 'SEASON SPRAY', allAbs, 'dot');
  footer(c, H);
}

// ── GAME REPORT 공유 이미지 (스토리 1080×1920 · 피드 1080×1080) ─────────────
// 공유 이미지 모듈이라 여기서 그린다 — 카드의 구장 · 지표 띠 · 방향 막대를 그대로 쓴다. core.js pgExport 를 바꿔 낀다(모달 버튼 onclick)
//  · 계산은 core pgExport 와 같다: 팀 타율 = 안타 / (볼넷 · 사구 · 희생 뺀 타석, 0 이면 1) · 안타 · 타점 · 삼진 · 방향(_isPull · _isCtr) · 타구 = AS.abs 전부
//  · 코멘트는 모달의 #pgAITxt 글 그대로. 모달 안 작은 그림(core _pgDrawMini)은 손대지 않는다

// 결과 버그(스토리): 머리 띠 FINAL · 두 팀 줄(이름 + 큰 점수). 이긴 쪽 = 주황 띠 · 밝게, 진 쪽 흐리게, 비기면 둘 다 보통. 높이 반환
function finalBug(c, y, th, ta, hs, as) {
  const hh = 28, rh = 64, sw = 96, h = hh + rh * 2, sx = X + CW - sw, rows = [[th, hs, as], [ta, as, hs]];
  c.save(); rr(c, X, y, CW, h, RAD); c.clip();
  c.fillStyle = N.panel; c.fillRect(X, y, CW, h);
  c.fillStyle = N.bg2; c.fillRect(X, y, CW, hh);
  c.fillStyle = N.panel2; c.fillRect(sx, y + hh, sw, rh * 2);
  rows.forEach((r, i) => { if (r[1] > r[2]) { c.fillStyle = N.acc; c.fillRect(X, y + hh + rh * i, 3, rh); } });
  c.restore();
  rr(c, X, y, CW, h, RAD); c.strokeStyle = N.line2; c.lineWidth = L1; c.stroke();
  rule(c, X, y + hh, CW, L2); rule(c, X, y + hh + rh, CW, L2); vrule(c, sx, y, h, L3);
  font(c, '600', 11, FONT.num); spacing(c, 2); txt(c, 'FINAL', X + PAD, y + 19, N.tx2); spacing(c, 0);
  font(c, '500', 11, FONT.kr); txt(c, '득점', sx + sw / 2, y + 19, N.tx3, 'center');
  rows.forEach((r, i) => {
    const cy = y + hh + rh * i + rh / 2, col = r[1] < r[2] ? N.tx2 : N.tx;
    fitFont(c, r[0], '900', 28, FONT.kr, sx - X - PAD * 2, 12); txt(c, r[0], X + PAD, cy + mid(c, r[0]), col);
    font(c, '700', 48, FONT.num); txt(c, String(r[1]), sx + sw / 2, cy + mid(c, '0'), col, 'center');
  });
  return h;
}
// 한 줄 버그(피드): [홈 이름 | 홈 점수 | 원정 점수 | 원정 이름] — 점수가 가운데서 마주 본다. 이긴 쪽 바깥 끝에 주황 띠
function lineBug(c, y, th, ta, hs, as) {
  const h = 56, sw = 64, tw = (CW - sw * 2) / 2, mx = X + CW / 2, cy = y + h / 2;
  c.save(); rr(c, X, y, CW, h, RAD); c.clip();
  c.fillStyle = N.panel; c.fillRect(X, y, CW, h);
  c.fillStyle = N.panel2; c.fillRect(mx - sw, y, sw * 2, h);
  c.fillStyle = N.acc;
  if (hs > as) c.fillRect(X, y, 3, h);
  if (as > hs) c.fillRect(X + CW - 3, y, 3, h);
  c.restore();
  rr(c, X, y, CW, h, RAD); c.strokeStyle = N.line2; c.lineWidth = L1; c.stroke();
  [mx - sw, mx, mx + sw].forEach(x => vrule(c, x, y, h, L3));
  [[th, hs, as, X + PAD, 'left', mx - sw / 2], [ta, as, hs, X + CW - PAD, 'right', mx + sw / 2]].forEach(r => {
    const col = r[1] < r[2] ? N.tx2 : N.tx;
    fitFont(c, r[0], '900', 18, FONT.kr, tw - PAD * 2, 10); txt(c, r[0], r[3], cy + mid(c, r[0]), col, r[4]);
    font(c, '700', 32, FONT.num); txt(c, String(r[1]), r[5], cy + mid(c, '0'), col, 'center');
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
// 코멘트 칸: 조용한 본문(Noto 500 · 흐린 글자 · 줄 간격 = 글자 + 8). h 를 주면 그 안에 들어가게 글자를 줄이고 세로 가운데,
// h 가 0 이면 줄 수만큼의 높이. y 를 주면 그린다. 칸 높이 반환
function note(c, x, y, w, h, t, size) {
  let z = size, lines;
  for (;;) {
    font(c, '500', z, FONT.kr); lines = wrap(c, t, w - PAD * 2);
    if (!h || z <= 10 || (lines.length - 1) * (z + 8) + z <= h - PAD * 2) break;
    z -= .5;
  }
  const bh = (lines.length - 1) * (z + 8) + z, hh = h || bh + PAD * 2 + 2;
  if (y != null) {
    panel(c, x, y, w, hh);
    font(c, '500', z, FONT.kr);
    lines.forEach((l, i) => txt(c, l, x + PAD, y + (hh - bh) / 2 + z * .88 + i * (z + 8), N.tx2));
  }
  return hh;
}
// 스토리: 머리 줄 · 결과 버그 · 지표 띠 · 방향 막대 · 스프레이(남는 높이 전부) · 코멘트
// 피드: 머리 줄 · 한 줄 버그 · 지표 띠 · 방향 막대 · [구장 | 코멘트]
function gameReport(cv, sc, H, mode) {
  const c = begin(cv, H, sc), AS = window.AS, abs = AS.abs, bot = H - FOOT - G;
  const oab = abs.filter(a => !window._NOAB.includes(a.res)).length || 1;
  const h = abs.filter(a => window._HITS.includes(a.res)).length;
  const k = abs.filter(a => a.res === '삼진').length;
  const rbi = abs.reduce((s, a) => s + (a.rbi || 0), 0);
  const stats = [['팀 타율', (h / oab).toFixed(3).replace('0.', '.')], ['안타', String(h)], ['타점', String(rbi)], ['삼진', String(k)]];
  const th = $('tHome').value || '홈팀', ta = $('tAway').value || '원정팀', dabs = abs.filter(a => a.deg != null);
  const memo = (($('pgAITxt') || {}).textContent || '').trim();
  font(c, '600', 11, FONT.num); spacing(c, 2); txt(c, 'GAME REPORT', X, 40, N.tx2); spacing(c, 0);
  font(c, '500', 12, FONT.kr); txt(c, window._pgDate(), W - X, 40, N.tx2, 'right');
  if (mode === 'story') {
    const ty = 56 + finalBug(c, 56, th, ta, AS.hs, AS.as) + G, sy = ty + (72 + G) * 2;
    strip(c, X, ty, CW, 72, [stats], 0);
    dirPanel(c, ty + 72 + G, 72, dabs);
    let ny = bot + G;
    if (memo) { ny = bot - note(c, X, null, CW, 0, memo, 14); note(c, X, ny, CW, 0, memo, 14); }
    sprayPanel(c, sy, ny - G - sy, 'SPRAY CHART', abs, 'dot');
  } else {
    lineBug(c, 56, th, ta, AS.hs, AS.as);
    strip(c, X, 128, CW, 60, [stats], 0);
    dirPanel(c, 204, 72, dabs);
    const y = 292, nw = memo ? 204 : 0;
    sprayPanel(c, y, bot - y, null, abs, 'dot', X, CW - (nw && nw + G));
    if (memo) note(c, X + CW - nw, y, nw, bot - y, memo, 13);
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
