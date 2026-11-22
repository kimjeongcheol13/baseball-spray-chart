// 동작 분석 — 영상 위에 그리는 뼈대 · 관절 각도 · 요약 패널 (화면 표시와 이미지 저장이 같은 함수를 쓴다)
import { LM, MIN_VISIBILITY, sides, visible } from './landmarks.js?v=1';
import { jointAngle } from './geometry.js?v=1';

export const COLOR = {
  pelvis: '#4b8cf5', trunk: '#ef5a5a', lead: '#2dd4a0', rear: '#f59e0b',
  bone: '#ffffff', casing: 'rgba(11,13,18,.9)', ink: '#ffffff', ink2: 'rgba(255,255,255,.72)', panel: 'rgba(11,13,18,.8)', line: 'rgba(255,255,255,.14)',
};
const DRAW_MIN_VISIBILITY = 0.3;
const FONT = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";

// 이 프레임에 붙일 관절 각도 표 → [{ key, text, color, x, y }] (x · y 는 화면 비율 0~1). 안 보이는 관절은 뺀다
export function jointLabels(frame, hand) {
  if (!frame || !frame.world || !frame.image) return [];
  const { lead, rear } = sides(hand);
  const defs = [
    ['leadElbow', '앞팔꿈치', COLOR.lead, lead.shoulder, lead.elbow, lead.wrist],
    ['rearElbow', '뒷팔꿈치', COLOR.rear, rear.shoulder, rear.elbow, rear.wrist],
    ['leadKnee', '앞무릎', COLOR.lead, lead.hip, lead.knee, lead.ankle],
    ['rearKnee', '뒷무릎', COLOR.rear, rear.hip, rear.knee, rear.ankle],
  ];
  const out = [];
  for (const [key, name, color, a, b, c] of defs) {
    if (!visible(frame.world, a, b, c)) continue;
    const deg = jointAngle(frame.world[a], frame.world[b], frame.world[c]);
    if (deg !== null) out.push({ key, text: `${name} ${Math.round(deg)}°`, color, x: frame.image[b].x, y: frame.image[b].y });
  }
  return out;
}

function pill(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
}

// MediaPipe 관절 33개를 잇는 선 전부(골반선 23-24 · 어깨선 11-12 는 색이 달라 따로 그린다)
export const FULL_BONES = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],                      // 얼굴
  [11, 13], [13, 15], [12, 14], [14, 16],                                                      // 팔
  [15, 17], [15, 19], [15, 21], [17, 19], [16, 18], [16, 20], [16, 22], [18, 20],              // 손
  [11, 23], [12, 24],                                                                          // 몸통 옆선
  [23, 25], [25, 27], [24, 26], [26, 28],                                                      // 다리
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],                                  // 발
];
const FACE_MAX = 10;                                // 0~10 = 얼굴
const SMALL_FROM = { hand: 17, handTo: 22, foot: 29 };   // 손가락 · 발 끝은 가는 선 · 작은 점

// 팔다리 · 손 · 발은 앞(투수 쪽) Teal · 뒤 Amber — 관절 표의 점 색과 같다. 얼굴 · 몸통 옆선은 흰색
export function boneColor(a, b, hand) {
  const torso = (a === LM.L_SHOULDER && b === LM.L_HIP) || (a === LM.R_SHOULDER && b === LM.R_HIP);
  if (torso || Math.max(a, b) <= FACE_MAX) return COLOR.bone;
  const leadIsLeft = hand !== 'L', isLeft = a % 2 === 1;   // MediaPipe 번호: 왼쪽 관절은 홀수, 오른쪽은 짝수
  return isLeft === leadIsLeft ? COLOR.lead : COLOR.rear;
}

// 손가락 · 발 끝 · 얼굴처럼 작은 부위인가 (가는 선 · 작은 점으로 그린다)
export const isSmallJoint = (i) => i <= FACE_MAX || (i >= SMALL_FROM.hand && i <= SMALL_FROM.handTo) || i >= SMALL_FROM.foot;

// 뼈대 선 하나의 모양 → { color, dashed } · 그릴 수 없을 만큼 안 보이면 null
//  · 인식이 불확실한 선(관절이 반쯤 가려짐)은 점선으로 그려 확실한 선과 구분한다
export function boneStyle(a, b, hand, lm) {
  const vis = Math.min(lm[a] ? lm[a].visibility ?? 1 : 0, lm[b] ? lm[b].visibility ?? 1 : 0);
  if (vis < DRAW_MIN_VISIBILITY) return null;
  return { color: boneColor(a, b, hand), dashed: vis < MIN_VISIBILITY };
}

// 선을 어두운 테두리 위에 한 번 더 그린다 — 흰 유니폼 · 밝은 잔디 · 어두운 관중석 어디서나 보이게
function casedLine(ctx, x1, y1, x2, y2, color, width, u, dashed) {
  for (const [stroke, lw] of [[COLOR.casing, width + 3 * u], [color, width]]) {
    ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    ctx.setLineDash(dashed ? [6 * u, 6 * u] : []);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawSkeleton(ctx, w, h, lm, hand, u) {
  const line = (a, b, style, width) => { if (style) casedLine(ctx, lm[a].x * w, lm[a].y * h, lm[b].x * w, lm[b].y * h, style.color, width, u, style.dashed); };
  const fixed = (a, b, color) => { const s = boneStyle(a, b, hand, lm); return s && { color, dashed: s.dashed }; };
  ctx.lineCap = 'round';
  for (const [a, b] of FULL_BONES) line(a, b, boneStyle(a, b, hand, lm), (isSmallJoint(a) && isSmallJoint(b) ? 2 : 3) * u);
  line(LM.L_HIP, LM.R_HIP, fixed(LM.L_HIP, LM.R_HIP, COLOR.pelvis), 5 * u);
  line(LM.L_SHOULDER, LM.R_SHOULDER, fixed(LM.L_SHOULDER, LM.R_SHOULDER, COLOR.trunk), 5 * u);
  drawJoints(ctx, w, h, lm, u);
}

// 관절 33개의 점(확실히 보이는 것만). 어두운 테두리 안에 흰 점
function drawJoints(ctx, w, h, lm, u) {
  lm.forEach((p, i) => {
    if ((p.visibility ?? 1) < MIN_VISIBILITY) return;
    const r = (isSmallJoint(i) ? 1.6 : 2.6) * u;
    ctx.fillStyle = COLOR.casing; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, r + 1.4 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOR.bone; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2); ctx.fill();
  });
}

function drawLabels(ctx, w, h, labels, u) {
  ctx.font = `700 ${11 * u}px ${FONT}`;
  ctx.textBaseline = 'middle';
  const center = labels.reduce((s, l) => s + l.x, 0) / (labels.length || 1);
  for (const l of labels) {
    const px = l.x * w, py = l.y * h, tw = ctx.measureText(l.text).width, bw = tw + 22 * u, bh = 20 * u;
    ctx.fillStyle = COLOR.casing; ctx.beginPath(); ctx.arc(px, py, 6.5 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = l.color; ctx.beginPath(); ctx.arc(px, py, 4.5 * u, 0, Math.PI * 2); ctx.fill();
    const left = l.x < center ? px - 10 * u - bw : px + 10 * u;
    const bx = Math.max(2 * u, Math.min(w - bw - 2 * u, left)), by = Math.max(2 * u, Math.min(h - bh - 2 * u, py - bh / 2));
    ctx.fillStyle = COLOR.panel; pill(ctx, bx, by, bw, bh);
    ctx.fillStyle = l.color; ctx.beginPath(); ctx.arc(bx + 9 * u, by + bh / 2, 3 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOR.ink; ctx.fillText(l.text, bx + 16 * u, by + bh / 2 + 0.5 * u);
  }
}

// hud = { title, rows: [{ label, value, unit, color }], footer } — 오른쪽 위 요약 패널
function drawHud(ctx, w, hud, u) {
  const pw = Math.min(w * 0.5, 176 * u), pad = 10 * u, rowH = 21 * u;
  const ph = pad * 2 + 16 * u + hud.rows.length * rowH + (hud.footer ? 18 * u : 0);
  const x = w - pw - 8 * u, y = 8 * u;
  ctx.fillStyle = COLOR.panel; ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 10 * u); ctx.fill();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.ink; ctx.font = `800 ${11 * u}px ${FONT}`; ctx.fillText(hud.title, x + pad, y + pad + 6 * u);
  hud.rows.forEach((r, i) => {
    const cy = y + pad + 16 * u + rowH * i + rowH / 2;
    ctx.fillStyle = r.color || COLOR.ink2; ctx.beginPath(); ctx.arc(x + pad + 3 * u, cy, 3 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOR.ink2; ctx.font = `600 ${10 * u}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(r.label, x + pad + 11 * u, cy);
    ctx.textAlign = 'right';
    ctx.font = `600 ${9 * u}px ${FONT}`; const uw = r.unit ? ctx.measureText(r.unit).width + 3 * u : 0;
    if (r.unit) ctx.fillText(r.unit, x + pw - pad, cy + 1 * u);
    ctx.fillStyle = COLOR.ink; ctx.font = `800 ${15 * u}px ${FONT}`; ctx.fillText(r.value, x + pw - pad - uw, cy);
  });
  if (hud.footer) {
    const fy = y + ph - pad - 5 * u;
    ctx.strokeStyle = COLOR.line; ctx.lineWidth = u; ctx.beginPath(); ctx.moveTo(x + pad, fy - 10 * u); ctx.lineTo(x + pw - pad, fy - 10 * u); ctx.stroke();
    ctx.fillStyle = COLOR.ink2; ctx.font = `600 ${9.5 * u}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(hud.footer, x + pad, fy, pw - pad * 2);
  }
  ctx.textAlign = 'left';
}

function drawMark(ctx, w, h, u) {
  const text = 'SPRAYLAB MOTION · 추정치', bh = 20 * u;
  ctx.font = `800 ${10 * u}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.panel; pill(ctx, 8 * u, h - bh - 8 * u, ctx.measureText(text).width + 20 * u, bh);
  ctx.fillStyle = COLOR.ink2; ctx.fillText(text, 18 * u, h - 8 * u - bh / 2 + 0.5 * u);
}

// 분석 구간 안인데 사람을 못 찾은 프레임에 영상 가운데 띄우는 안내
function drawMissing(ctx, w, h, u) {
  const text = '이 프레임은 사람을 찾지 못했어요', bh = 28 * u;
  ctx.font = `700 ${12 * u}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const bw = ctx.measureText(text).width + 28 * u;
  ctx.fillStyle = COLOR.panel; pill(ctx, (w - bw) / 2, (h - bh) / 2, bw, bh);
  ctx.fillStyle = COLOR.ink; ctx.fillText(text, w / 2, h / 2 + 0.5 * u);
  ctx.textAlign = 'left';
}

// ctx 에 w × h 크기로 그린다. frame 이 없으면 뼈대 없이 패널만, hud 가 없으면 뼈대만, missing 이면 「사람을 못 찾음」 안내
export function drawOverlay(ctx, w, h, { frame = null, hand = 'R', hud = null, mark = false, missing = false } = {}) {
  const u = Math.max(1, Math.min(w, h) / 360);
  ctx.clearRect(0, 0, w, h);
  if (frame && frame.image) {
    drawSkeleton(ctx, w, h, frame.image, hand, u);
    drawLabels(ctx, w, h, jointLabels(frame, hand), u);
  }
  if (missing) drawMissing(ctx, w, h, u);
  if (hud) drawHud(ctx, w, hud, u);
  if (mark) drawMark(ctx, w, h, u);
}
