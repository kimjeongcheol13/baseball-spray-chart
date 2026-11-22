// 동작 분석 — 영상 위에 그리는 뼈대 · 관절 각도 · 요약 패널 (화면 표시와 이미지 저장이 같은 함수를 쓴다)
import { LM, BONES, MIN_VISIBILITY, sides, visible } from './landmarks.js?v=1';
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

// 뼈대 선 하나의 모양 → { color, dashed } · 그릴 수 없을 만큼 안 보이면 null
//  · 팔다리는 앞(투수 쪽) Teal · 뒤 Amber — 관절 표의 점 색과 같다. 몸통 옆선은 흰색, 골반선 · 어깨선은 따로 그린다
//  · 인식이 불확실한 선(관절이 반쯤 가려짐)은 점선으로 그려 확실한 선과 구분한다
export function boneStyle(a, b, hand, lm) {
  const vis = Math.min(lm[a] ? lm[a].visibility ?? 1 : 0, lm[b] ? lm[b].visibility ?? 1 : 0);
  if (vis < DRAW_MIN_VISIBILITY) return null;
  const torso = (a === LM.L_SHOULDER && b === LM.L_HIP) || (a === LM.R_SHOULDER && b === LM.R_HIP);
  const leadIsLeft = hand !== 'L', isLeft = a % 2 === 1;   // MediaPipe 번호: 왼쪽 관절은 홀수, 오른쪽은 짝수
  return { color: torso ? COLOR.bone : isLeft === leadIsLeft ? COLOR.lead : COLOR.rear, dashed: vis < MIN_VISIBILITY };
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
  for (const [a, b] of BONES) line(a, b, boneStyle(a, b, hand, lm), 3 * u);
  line(LM.L_HIP, LM.R_HIP, fixed(LM.L_HIP, LM.R_HIP, COLOR.pelvis), 5 * u);
  line(LM.L_SHOULDER, LM.R_SHOULDER, fixed(LM.L_SHOULDER, LM.R_SHOULDER, COLOR.trunk), 5 * u);
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

// ctx 에 w × h 크기로 그린다. frame 이 없으면 뼈대 없이 패널만, hud 가 없으면 뼈대만
export function drawOverlay(ctx, w, h, { frame = null, hand = 'R', hud = null, mark = false } = {}) {
  const u = Math.max(1, Math.min(w, h) / 360);
  ctx.clearRect(0, 0, w, h);
  if (frame && frame.image) {
    drawSkeleton(ctx, w, h, frame.image, hand, u);
    drawLabels(ctx, w, h, jointLabels(frame, hand), u);
  }
  if (hud) drawHud(ctx, w, hud, u);
  if (mark) drawMark(ctx, w, h, u);
}
