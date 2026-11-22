// 동작 분석 — 영상 위에 그리는 뼈대 · 관절 각도 · 요약 패널 (화면 표시와 이미지 저장이 같은 함수를 쓴다)
import { LM, MIN_VISIBILITY, sides, visible } from './landmarks.js?v=1';
import { jointAngle } from './geometry.js?v=1';

export const COLOR = {
  pelvis: '#4b8cf5', trunk: '#ef5a5a', lead: '#2dd4a0', rear: '#f59e0b',
  bone: '#ffffff', casing: 'rgba(11,13,18,.9)', ink: '#ffffff', ink2: 'rgba(255,255,255,.72)', panel: 'rgba(11,13,18,.8)', line: 'rgba(255,255,255,.14)',
};
const DRAW_MIN_VISIBILITY = 0.1;   // 이보다 낮으면 그리지 않는다. 그 위 ~ MIN_VISIBILITY 는 「추정」으로 점선 · 옅게 그린다
//  · 스윙 · 투구 중에는 팔이 몸이나 배트에 자주 가려진다. 0.3 에서 끊었더니 팔이 통째로 빠져 뼈대가 끊겨 보였다
const UNSURE_ALPHA = 0.7;
// 선 굵기 · 점 크기는 화면 크기가 아니라 「화면 속 선수의 크기」에 맞춘다(중계 화면의 작은 선수에게 굵은 선은 몸을 다 덮는다)
const TORSO_REF = 0.25, SCALE_MIN = 0.7, SCALE_MAX = 1.5;   // 몸통 길이가 짧은 변의 25% 일 때를 1 배로
// 선수가 작게 보이면 얼굴 · 손가락 · 발끝의 잔점이 한 덩어리로 뭉친다 → 머리는 원 하나, 손 · 발은 선 하나로 줄인다
const DETAIL_MIN_TORSO = 0.2;                                 // 화면에 보이는 몸통 길이(짧은 변 대비)가 이보다 크면 관절 33개를 모두 그린다
const FACE_MIN_EARS = 0.07;                                   // 화면에 보이는 두 귀 사이(짧은 변 대비)가 이보다 넓어야 얼굴 점 11개를 그린다. 옆얼굴 · 작은 얼굴은 원 하나
const FACE_MAX = 10;                                          // 관절 번호 0~10 = 얼굴
const HEAD_BY_TORSO = 0.2;                                    // 줄여 그릴 때 머리 원의 반지름(몸통 길이 대비)
const CORE_BONES = [[11, 13], [13, 15], [12, 14], [14, 16], [15, 19], [16, 20], [11, 23], [12, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
const CORE_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const EAR_L = 7, EAR_R = 8;
const FONT = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";

// 이 프레임에 붙일 관절 각도 표 → [{ key, joint(관절 번호), text, color, x, y }] (x · y 는 화면 비율 0~1). 안 보이는 관절은 뺀다
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
    if (deg !== null) out.push({ key, joint: b, text: `${name} ${Math.round(deg)}°`, color, x: frame.image[b].x, y: frame.image[b].y });
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

// 선을 어두운 테두리 위에 한 번 더 그린다 — 흰 유니폼 · 밝은 잔디 · 어두운 관중석 어디서나 보이게. 추정(dashed)은 점선 · 옅게
function casedLine(ctx, x1, y1, x2, y2, color, width, u, dashed) {
  ctx.save();
  if (dashed) { ctx.globalAlpha = UNSURE_ALPHA; ctx.setLineDash([width * 1.6, width * 1.8]); }
  for (const [stroke, lw] of [[COLOR.casing, width + Math.max(2 * u, width * 0.7)], [color, width]]) {
    ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();
}

// 화면 속 몸통 길이(어깨 중점 ↔ 골반 중점, 픽셀) · 어깨나 골반을 못 찾았으면 0
function torsoPx(lm, w, h) {
  const need = [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP];
  if (need.some((i) => !lm[i])) return 0;
  const sx = (lm[need[0]].x + lm[need[1]].x) / 2, sy = (lm[need[0]].y + lm[need[1]].y) / 2, hx = (lm[need[2]].x + lm[need[3]].x) / 2, hy = (lm[need[2]].y + lm[need[3]].y) / 2;
  return Math.hypot((sx - hx) * w, (sy - hy) * h);
}

// 선수 크기에 맞춘 배율(선 굵기 · 점 크기에 곱한다)과 세부를 그릴지 → { k, detail(손가락 · 발끝), face(얼굴 점) }
//  · zoom: 이 그림이 나중에 몇 배로 키워져 보이는지(「영상 + 선」 화면은 선수 주변만 잘라 키운다)
export function bodyScale(lm, w, h, zoom = 1) {
  const ratio = torsoPx(lm, w, h) / Math.min(w, h);
  if (!ratio) return { k: 1, detail: true, face: true };
  const a = lm[EAR_L], b = lm[EAR_R], ears = a && b ? Math.hypot((a.x - b.x) * w, (a.y - b.y) * h) / Math.min(w, h) : 0;
  const detail = ratio * zoom >= DETAIL_MIN_TORSO;
  return { k: Math.max(SCALE_MIN, Math.min(SCALE_MAX, ratio / TORSO_REF)), detail, face: detail && ears * zoom >= FACE_MIN_EARS };
}

function drawSkeleton(ctx, w, h, lm, hand, u, zoom) {
  const { k, detail, face } = bodyScale(lm, w, h, zoom), ku = k * u;
  const line = (a, b, style, width) => { if (style) casedLine(ctx, lm[a].x * w, lm[a].y * h, lm[b].x * w, lm[b].y * h, style.color, width, u, style.dashed); };
  const fixed = (a, b, color) => { const s = boneStyle(a, b, hand, lm); return s && { color, dashed: s.dashed }; };
  ctx.lineCap = 'round';
  for (const [a, b] of detail ? FULL_BONES : CORE_BONES) {
    if (!face && Math.max(a, b) <= FACE_MAX) continue;
    line(a, b, boneStyle(a, b, hand, lm), (isSmallJoint(a) && isSmallJoint(b) ? 2 : 3) * ku);
  }
  line(LM.L_HIP, LM.R_HIP, fixed(LM.L_HIP, LM.R_HIP, COLOR.pelvis), 5 * ku);
  line(LM.L_SHOULDER, LM.R_SHOULDER, fixed(LM.L_SHOULDER, LM.R_SHOULDER, COLOR.trunk), 5 * ku);
  if (!face) drawHead(ctx, w, h, lm, ku);
  drawJoints(ctx, w, h, lm, ku, detail, face);
}

// 줄여 그릴 때의 머리: 두 귀의 가운데에 원 하나
function drawHead(ctx, w, h, lm, ku) {
  const a = lm[EAR_L], b = lm[EAR_R];
  if (!a || !b || Math.min(a.visibility ?? 1, b.visibility ?? 1) < DRAW_MIN_VISIBILITY) return;
  const x = ((a.x + b.x) / 2) * w, y = ((a.y + b.y) / 2) * h, r = Math.max(4 * ku, torsoPx(lm, w, h) * HEAD_BY_TORSO);
  for (const [stroke, lw] of [[COLOR.casing, 4.5 * ku], [COLOR.bone, 2.2 * ku]]) {
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }
}

// 관절 점(확실히 보이는 것만). 어두운 테두리 안에 흰 점. 줄여 그릴 때는 어깨 · 팔꿈치 · 손목 · 골반 · 무릎 · 발목만
function drawJoints(ctx, w, h, lm, ku, detail, face) {
  lm.forEach((p, i) => {
    if ((p.visibility ?? 1) < MIN_VISIBILITY || (!detail && !CORE_JOINTS.includes(i)) || (!face && i <= FACE_MAX)) return;
    const r = (isSmallJoint(i) ? 1.5 : 2.3) * ku;
    ctx.fillStyle = COLOR.casing; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, r + 1.2 * ku, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOR.bone; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2); ctx.fill();
  });
}

// 몸이 차지하는 가로 범위(화면 비율) → { left, right } · 각도 표를 몸 밖에 놓는 데 쓴다
export function bodySpan(points) {
  const xs = CORE_JOINTS.map((i) => points[i]).filter((p) => p && (p.visibility ?? 1) >= DRAW_MIN_VISIBILITY).map((p) => p.x);
  return xs.length ? { left: Math.min(...xs), right: Math.max(...xs) } : null;
}

// 각도 표가 놓일 자리 → [{ ...label, px, py(관절 픽셀), bx, by, bw, bh(표 상자) }]
//  · 표는 몸의 가로 범위(body) 바깥에 놓는다: 몸 왼쪽 관절은 왼쪽 바깥, 오른쪽 관절은 오른쪽 바깥. 자리가 없으면 반대쪽
//  · 같은 쪽 표끼리 겹치면 아래로 민다
export function placeLabels(labels, w, h, u, widthOf, body = null) {
  if (!labels.length) return [];
  const span = body || { left: Math.min(...labels.map((l) => l.x)), right: Math.max(...labels.map((l) => l.x)) };
  const center = (span.left + span.right) / 2, gap = 12 * u, bh = 20 * u, edge = 2 * u;
  const placed = labels.map((l) => {
    const bw = widthOf(l.text) + 22 * u, leftX = span.left * w - gap - bw, rightX = span.right * w + gap;
    const fits = { left: leftX >= edge, right: rightX + bw <= w - edge }, wantLeft = l.x < center;
    const onLeft = wantLeft ? fits.left || !fits.right : !fits.right && fits.left;
    const bx = Math.max(edge, Math.min(w - bw - edge, onLeft ? leftX : rightX));
    return { ...l, px: l.x * w, py: l.y * h, bx, by: l.y * h - bh / 2, bw, bh, onLeft };
  });
  for (const side of [true, false]) {
    let floor = edge;
    for (const p of placed.filter((q) => q.onLeft === side).sort((a, b) => a.by - b.by)) {
      p.by = Math.max(edge, Math.min(h - bh - edge, Math.max(p.by, floor)));
      floor = p.by + bh + 3 * u;
    }
  }
  return placed;
}

// 관절 각도 표를 w × h 안에 그린다: 관절에 작은 고리, 거기서 몸 밖의 표까지 가는 선. 3D · 잘라 보여 주는 화면도 좌표만 바꿔 이 함수를 쓴다
export function drawLabels(ctx, w, h, labels, u, body = null) {
  ctx.font = `600 ${11 * u}px ${FONT}`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (const l of placeLabels(labels, w, h, u, (text) => ctx.measureText(text).width, body)) {
    const ax = l.onLeft ? l.bx + l.bw : l.bx, ay = l.by + l.bh / 2;
    ctx.setLineDash([]); ctx.lineCap = 'round';
    for (const [stroke, lw] of [[COLOR.casing, 3 * u], [l.color, 1.2 * u]]) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(l.px, l.py); ctx.stroke(); }
    ctx.fillStyle = COLOR.casing; ctx.beginPath(); ctx.arc(l.px, l.py, 4.2 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = l.color; ctx.beginPath(); ctx.arc(l.px, l.py, 2.8 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOR.panel; pill(ctx, l.bx, l.by, l.bw, l.bh);
    ctx.fillStyle = l.color; ctx.beginPath(); ctx.arc(l.bx + 9 * u, ay, 3 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLOR.ink; ctx.fillText(l.text, l.bx + 16 * u, ay + 0.5 * u);
  }
}

// hud = { title, rows: [{ label, value, unit, color }], footer, side: 'left' | 'right'(기본) } — 위쪽 구석의 요약 패널
function drawHud(ctx, w, hud, u) {
  const pw = Math.min(w * 0.5, 176 * u), pad = 10 * u, rowH = 21 * u;
  const ph = pad * 2 + 16 * u + hud.rows.length * rowH + (hud.footer ? 18 * u : 0);
  const x = hud.side === 'left' ? 8 * u : w - pw - 8 * u, y = 8 * u;
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

// 요약 패널을 놓을 쪽: 선수가 화면 오른쪽에 있으면 왼쪽 위, 아니면 오른쪽 위 — 패널이 선수를 가리지 않게
export function hudSideFor(frames) {
  let sum = 0, n = 0;
  for (const f of frames) if (f && f.image) { sum += (f.image[LM.L_HIP].x + f.image[LM.R_HIP].x) / 2; n += 1; }
  return n && sum / n > 0.55 ? 'left' : 'right';
}

// ctx 에 w × h 크기로 그린다. frame 이 없으면 뼈대 없이 패널만, hud 가 없으면 뼈대만, missing 이면 「사람을 못 찾음」 안내, labels 가 false 면 관절 각도 표 없이 선과 점만
//  · zoom: 이 그림을 나중에 몇 배로 키워 보여 주는지(세부를 그릴지 정하는 데만 쓴다)
export function drawOverlay(ctx, w, h, { frame = null, hand = 'R', hud = null, mark = false, missing = false, labels = true, zoom = 1 } = {}) {
  const u = Math.max(1, Math.min(w, h) / 360);
  ctx.clearRect(0, 0, w, h);
  if (frame && frame.image) {
    drawSkeleton(ctx, w, h, frame.image, hand, u, zoom);
    if (labels) drawLabels(ctx, w, h, jointLabels(frame, hand), u, bodySpan(frame.image));
  }
  if (missing) drawMissing(ctx, w, h, u);
  if (hud) drawHud(ctx, w, hud, u);
  if (mark) drawMark(ctx, w, h, u);
}
