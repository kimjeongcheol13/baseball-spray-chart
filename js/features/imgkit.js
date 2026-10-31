// 이미지 공통 키트 — 오더지 · 리그 기록지(인쇄: PAPER) · 성적 카드 · 선수 리포트(공유: NIGHT)가 같은 색 · 글꼴 · 로고를 쓴다
//  · 글꼴은 둘만: 한글 = Noto Sans KR(제목 900 · 본문 500/700), 숫자 · 영문 라벨 = Oswald. 한글에 자간을 주지 않는다
//  · 한글 웹폰트는 글자 묶음(unicode-range)으로 나뉘어 내려온다. 그 묶음을 받기 전에 그리면 그 글자만 기본 글꼴로 찍힌다('샘플팀'의 '팀')
//    → drawWithFonts: 한 번 그려 쓰인 (글꼴, 글자)를 모으고, 빠진 묶음을 받은 뒤 다시 그린다

export const FONT = {
  kr: '"Noto Sans KR", sans-serif',
  num: '"Oswald", "Noto Sans KR", sans-serif',
};

// 공유 이미지 — 야간 스코어보드 (남색 바탕 · 흰 글씨)
export const NIGHT = {
  bg: '#0A111E', bg2: '#0F1A2C', panel: '#131F33', panel2: '#192841', line: '#24344F', line2: '#33476A',
  tx: '#F4F7FB', tx2: '#A9B6CB', tx3: '#6A7993',
  acc: '#FF5A36',   // 브랜드 · 안타 · 핵심 숫자
  xbh: '#FFB020',   // 2 · 3루타
  hr: '#FFD84A',    // 홈런
  bb: '#4C8DFF',    // 볼넷 · 사구
  out: '#7D8BA3',   // 아웃
  grass: '#11301F', grass2: '#163C27', dirt: '#3B2D21', chalk: 'rgba(255,255,255,0.6)', arc: 'rgba(255,255,255,0.14)',
};

// 공유 이미지 — 어두운 카드형 (분석 화면 css/v2.css 의 --v-* 와 같은 값). 성적 카드 · GAME REPORT 부터 하나씩 NIGHT 에서 옮긴다
export const DARK = {
  bg: '#0A0C11', card: '#141822', card2: '#1C212C', line: 'rgba(255,255,255,0.08)', line2: 'rgba(255,255,255,0.16)',
  tx: '#F4F6FA', tx2: 'rgba(244,246,250,0.74)', tx3: 'rgba(244,246,250,0.52)',
  acc: '#FF5A36', good: '#35D49E', bad: '#FF6B74',
  hit: '#FF5A36', xbh: '#FF9F43', hr: '#F6C343', bb: '#7CB0FF', out: '#8C95A8',   // 결과 색 (분석 화면 결과 구성 막대와 같은 순서)
};

// '#RRGGBB' → 옅은 바탕(꼬리표 · 칩)
export const tint = (hex, a) => 'rgba(' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',') + ',' + a + ')';

// 인쇄 이미지 — 흰 종이 (흑백 인쇄에서도 읽히게 색은 강조에만)
export const PAPER = {
  bg: '#FFFFFF', ink: '#0F172A', ink2: '#475569', ink3: '#94A3B8',
  rule: '#CBD5E1', rule2: '#E2E8F0', band: '#0F172A', zebra: '#F8FAFC', fill: '#F1F5F9',
  acc: '#E5412D', bb: '#2563EB', xbh: '#E08A00', hr: '#B42318', out: '#475569',
  grass: '#DDEDE1', grass2: '#CFE4D5', dirt: '#F1E7D6', chalk: '#0F172A',
};

export const font = (c, weight, size, family) => { c.font = weight + ' ' + size + 'px ' + family; };

// 글자가 maxW 안에 들어올 때까지 줄인 크기로 c.font 를 맞춘다 (그 크기를 돌려줌)
export function fitFont(c, t, weight, size, family, maxW, min) {
  let z = size;
  font(c, weight, z, family);
  while (z > (min || 8) && c.measureText(t).width > maxW) { z -= 0.5; font(c, weight, z, family); }
  return z;
}

export const spacing = (c, px) => { if ('letterSpacing' in c) c.letterSpacing = px + 'px'; };

export function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// 로고: 베이스(마름모) + SPRAYLAB. (x, y) = 글자 기준선 왼쪽. 그린 폭을 돌려준다
export function wordmark(c, x, y, size, color, acc) {
  const d = size * 0.34, cy = y - size * 0.36;
  c.save();
  c.fillStyle = acc; c.beginPath();
  c.moveTo(x + d, cy - d); c.lineTo(x + d * 2, cy); c.lineTo(x + d, cy + d); c.lineTo(x, cy); c.closePath(); c.fill();
  font(c, '700', size, FONT.num); spacing(c, size * 0.12);
  c.fillStyle = color; c.textAlign = 'left'; c.fillText('SPRAYLAB', x + d * 2 + size * 0.32, y);
  const w = d * 2 + size * 0.32 + c.measureText('SPRAYLAB').width;
  spacing(c, 0);
  c.restore();
  return w;
}

// ── 어두운 카드형 부품 (DARK — 성적 카드 · 투수 이미지가 같이 쓴다) ──
// 카드: 둥근 네모(테두리 없음, 모서리 20). glow = 오른쪽 위 주황 빛(맨 위 카드 — 분석 화면 첫 카드와 같다)
export function dCard(c, x, y, w, h, glow, fill) {
  rr(c, x, y, w, h, 20); c.fillStyle = fill || DARK.card; c.fill();
  if (!glow) return;
  const g = c.createRadialGradient(x + w, y, 0, x + w, y, Math.hypot(w, h) * .6);
  g.addColorStop(0, 'rgba(255,90,54,0.2)'); g.addColorStop(1, 'rgba(255,90,54,0)');
  c.fillStyle = g; c.fill();
}
// 둥근 꼬리표(멀티히트 · 승 · 카운트): x = align 쪽 끝('center' 면 가운데) · cy = 가운데. 폭 반환
export function dPill(c, t, x, cy, fg, bg, align, size = 14, family = FONT.kr) {
  font(c, '700', size, family);
  const m = c.measureText(t), w = m.width + size * 1.6, h = size * 2, lx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  rr(c, lx, cy - h / 2, w, h, h / 2); c.fillStyle = bg; c.fill();
  c.fillStyle = fg; c.textAlign = 'center'; c.fillText(t, lx + w / 2, cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  return w;
}
// 꼬리: 로고(왼쪽, 한 번) · 계정(오른쪽). 띠 · 선 없이 바탕 위에. y = 기준선
export function dFoot(c, W, y, X) {
  wordmark(c, X, y, 15, DARK.tx, DARK.acc);
  font(c, '500', 15, FONT.num); c.fillStyle = DARK.tx3; c.textAlign = 'right'; c.fillText('@spraylab2026', W - X, y);
}

// draw() 는 같은 캔버스에 처음부터 다 그리는 동기 함수 (cv.width 를 다시 맞추는 것부터)
export async function drawWithFonts(cv, draw) {
  const c = cv.getContext('2d'), used = new Map(), fill = c.fillText;
  c.fillText = function (t) { used.set(this.font, (used.get(this.font) || '') + t); return fill.apply(this, arguments); };
  try { draw(); } finally { delete c.fillText; }
  const fs = document.fonts;
  if (!fs || !fs.load) return;
  const miss = [...used].filter(([f, t]) => { try { return !fs.check(f, t); } catch (e) { return false; } });
  if (!miss.length) return;
  await Promise.race([Promise.all(miss.map(([f, t]) => fs.load(f, t).catch(() => null))), new Promise(r => setTimeout(r, 2500))]);
  draw();
}
