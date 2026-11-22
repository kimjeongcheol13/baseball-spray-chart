// 동작 분석 — worldLandmarks 를 드래그로 360도 돌려 보는 3D 뼈대 뷰어 (직교 투영 · 캔버스 2D, 외부 라이브러리 없음)
//  · 선만으로는 사람으로 읽히지 않아 팔다리 · 몸통 · 머리에 살을 입히고 관절 점을 찍는다. 먼 쪽은 어둡게 그린다
import { LM, MIN_VISIBILITY } from './landmarks.js?v=1';
import { COLOR, FULL_BONES, boneColor, isSmallJoint, jointLabels, drawLabels } from './overlay.js?v=6';

const BODY_M = 2.2, FILL = 0.85, CENTER_Y = 0.46;   // 몸 높이(m) · 캔버스 높이 대비 · 골반 세로 위치
const FEET = [27, 28, 29, 30, 31, 32];              // 발목 · 뒤꿈치 · 발끝 — 가장 낮은 점을 바닥 높이로 쓴다
const PITCH_MAX = 90, HEAD_R = 0.105, SHADOW_R = 0.42, SHADOW_STEPS = 28, DRAG_DEG_PER_PX = 0.5, KEY_STEP = 15;
const FONT = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 뼈대에 입히는 살(부피) — 마네킹처럼 읽히게 하려는 그림용 굵기(m)다. 선수의 실제 몸 둘레가 아니다(가정값)
const LIMB_M = { '11-13': 0.09, '13-15': 0.07, '12-14': 0.09, '14-16': 0.07, '23-25': 0.15, '25-27': 0.11, '24-26': 0.15, '26-28': 0.11 };
const TORSO_M = 0.24, NECK_M = 0.09, EAR_L = 7, EAR_R = 8;   // 귀 번호(머리 중심을 잡는 데 쓴다)
const BG = [11, 13, 18], FLESH = { lead: '#1d6f58', rear: '#8a5c12', body: '#3a4252', head: '#4a5364' };
const NEAR_Z = -0.35, FAR_Z = 0.45, FAR_LIGHT = 0.5;   // 이 깊이(m)에서 가장 밝고 · 가장 어둡다 · 가장 먼 곳의 밝기

// 깊이 → 밝기 0.5~1 (가까울수록 1). 멀리 있는 팔다리를 어둡게 해 앞뒤를 구분한다
export function depthLight(depth) {
  return clamp(1 - ((depth - NEAR_Z) / (FAR_Z - NEAR_Z)) * (1 - FAR_LIGHT), FAR_LIGHT, 1);
}

// '#rrggbb' 색을 밝기 k(0~1)만큼 남기고 나머지는 배경색으로 섞는다 → 'rgb(r,g,b)'
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
  return `rgb(${c.map((v, i) => Math.round(BG[i] + (v - BG[i]) * k)).join(',')})`;
}

// 세로축(y) 둘레로 yaw, 그다음 가로축(x) 둘레로 pitch 만큼 돌린 점
export function rotatePoint(p, yawDeg, pitchDeg) {
  const cy = Math.cos(rad(yawDeg)), sy = Math.sin(rad(yawDeg)), cp = Math.cos(rad(pitchDeg)), sp = Math.sin(rad(pitchDeg));
  const x = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
  return { x, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
}

// 한 점 → 캔버스 픽셀 + depth(클수록 멀다). 배율은 캔버스 높이로만 정해 프레임이 바뀌어도 일정하다
function projectPoint(p, yawDeg, pitchDeg, width, height) {
  const r = rotatePoint(p, yawDeg, pitchDeg), scale = (FILL * height) / BODY_M;
  return { x: width / 2 + r.x * scale, y: height * CENTER_Y + r.y * scale, depth: r.z };
}

// 관절 33개 → [{ x, y, depth }] · world 가 없으면 null
export function projectPose(world, yawDeg, pitchDeg, width, height) {
  if (!world) return null;
  return world.map((p) => projectPoint(p, yawDeg, pitchDeg, width, height));
}

// 선 하나: 어두운 테두리(선폭 + 3u) 위에 색 선
function casedLine(ctx, a, b, color, width, u, dashed) {
  for (const [stroke, lw] of [[COLOR.casing, width + 3 * u], [color, width]]) {
    ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    ctx.setLineDash(dashed ? [6 * u, 6 * u] : []);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.setLineDash([]);
}

// 바닥 높이(골반 기준 아래로 m): 그 프레임에서 가장 낮은 발 — 발이 바닥에서 뜨거나 묻히지 않게 한다
export const floorY = (world) => Math.max(...FEET.map((i) => world[i].y));

// 발 높이 바닥 격자 선 (회전과 함께 돈다)
function gridLines(yaw, pitch, w, h, floor) {
  const out = [], at = (x, z) => projectPoint({ x, y: floor, z }, yaw, pitch, w, h);
  for (let i = -2; i <= 2; i++) {
    out.push([at(i * 0.5, -1), at(i * 0.5, 1)], [at(-1, i * 0.5), at(1, i * 0.5)]);
  }
  return out;
}

function drawGrid(ctx, yaw, pitch, w, h, u, floor) {
  ctx.strokeStyle = COLOR.line; ctx.lineWidth = u; ctx.setLineDash([]);
  for (const [a, b] of gridLines(yaw, pitch, w, h, floor)) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
}

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, depth: (a.depth + b.depth) / 2 });

// 뼈대 선 → [{ kind: 'bone', a, b, color, flesh, width, volume(px), dashed, depth }]
//  · 3D 좌표는 가려진 관절에도 추정값이 있으므로 선을 빼지 않고 전부 그린다. 불확실한 선(관절이 반쯤 가려짐)은 점선
function boneParts(world, pts, hand, u, scale) {
  const parts = [];
  const add = (a, b, color, width) => {
    const dashed = Math.min(world[a].visibility ?? 1, world[b].visibility ?? 1) < MIN_VISIBILITY;
    const volume = (LIMB_M[`${a}-${b}`] || 0) * scale, flesh = color === COLOR.lead ? FLESH.lead : FLESH.rear;
    parts.push({ kind: 'bone', a: pts[a], b: pts[b], color, flesh, width, volume, dashed, depth: (pts[a].depth + pts[b].depth) / 2 });
  };
  for (const [a, b] of FULL_BONES) add(a, b, boneColor(a, b, hand), (isSmallJoint(a) && isSmallJoint(b) ? 2 : 4) * u);
  add(LM.L_HIP, LM.R_HIP, COLOR.pelvis, 6 * u);
  add(LM.L_SHOULDER, LM.R_SHOULDER, COLOR.trunk, 6 * u);
  return parts;
}

// 관절 33개의 점 → [{ kind: 'joint', p, r, depth }] (확실히 보이는 것만)
function jointParts(world, pts, u) {
  const parts = [];
  world.forEach((p, i) => {
    if ((p.visibility ?? 1) >= MIN_VISIBILITY) parts.push({ kind: 'joint', p: pts[i], r: (isSmallJoint(i) ? 1.8 : 3.2) * u, depth: pts[i].depth - 0.01 });
  });
  return parts;
}

// 몸통(어깨 · 골반 네 점을 잇는 면 + 가운데 기둥) · 목 · 머리. 몸통은 살짝 뒤로 보내 몸통 옆선이 그 위에 그려지게 한다
function bodyParts(pts, scale) {
  const ls = pts[LM.L_SHOULDER], rs = pts[LM.R_SHOULDER], lh = pts[LM.L_HIP], rh = pts[LM.R_HIP];
  const neck = mid(ls, rs), hip = mid(lh, rh), head = mid(pts[EAR_L], pts[EAR_R]);
  return [
    { kind: 'torso', quad: [ls, rs, rh, lh], a: neck, b: hip, volume: TORSO_M * scale, depth: (neck.depth + hip.depth) / 2 + 0.02 },
    { kind: 'neck', a: neck, b: head, volume: NECK_M * scale, depth: (neck.depth + head.depth) / 2 + 0.01 },
    { kind: 'head', p: head, r: HEAD_R * scale, depth: head.depth },
  ];
}

function thickLine(ctx, a, b, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function dot(ctx, p, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
}

// 한 조각을 그린다. 밝기 k 는 깊이에서 나온다(먼 것은 어둡게)
function drawPart(ctx, part, u) {
  const k = depthLight(part.depth);
  if (part.kind === 'bone') {
    if (part.volume) thickLine(ctx, part.a, part.b, shade(part.flesh, k), part.volume);
    casedLine(ctx, part.a, part.b, shade(part.color, k), part.width, u, part.dashed);
  } else if (part.kind === 'joint') {
    dot(ctx, part.p, part.r + 1.4 * u, COLOR.casing); dot(ctx, part.p, part.r, shade(COLOR.bone, k));
  } else if (part.kind === 'torso') {
    const color = shade(FLESH.body, k);
    thickLine(ctx, part.a, part.b, color, part.volume);
    ctx.fillStyle = color; ctx.beginPath();
    part.quad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath(); ctx.fill();
  } else if (part.kind === 'neck') {
    thickLine(ctx, part.a, part.b, shade(FLESH.body, k), part.volume);
  } else {
    dot(ctx, part.p, part.r + 1.5 * u, COLOR.casing); dot(ctx, part.p, part.r, shade(FLESH.head, k));
  }
}

// 발밑 그림자: 두 발목 가운데를 중심으로 한 바닥 위의 원(회전과 함께 납작해진다)
function drawShadow(ctx, world, yaw, pitch, w, h, floor) {
  const cx = (world[LM.L_ANKLE].x + world[LM.R_ANKLE].x) / 2, cz = (world[LM.L_ANKLE].z + world[LM.R_ANKLE].z) / 2;
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath();
  for (let i = 0; i < SHADOW_STEPS; i++) {
    const t = (i / SHADOW_STEPS) * Math.PI * 2, p = projectPoint({ x: cx + Math.cos(t) * SHADOW_R, y: floor, z: cz + Math.sin(t) * SHADOW_R }, yaw, pitch, w, h);
    if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  }
  ctx.closePath(); ctx.fill();
}

function drawEmpty(ctx, w, h, u) {
  ctx.fillStyle = COLOR.ink2; ctx.font = `700 ${14 * u}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('이 프레임은 사람을 찾지 못했어요', w / 2, h / 2);
}

// 캔버스 실제 픽셀 크기를 CSS 크기 × dpr 로 맞추고 그림 좌표는 CSS 픽셀로 쓴다 → { w, h }
function fitCanvas(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

function render(canvas, state) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { w, h } = fitCanvas(canvas, ctx), u = Math.max(1, Math.min(w, h) / 360);
  ctx.clearRect(0, 0, w, h);
  const world = state.frame && state.frame.world;
  if (!world) { drawEmpty(ctx, w, h, u); return; }
  ctx.lineCap = 'round';
  const floor = floorY(world);
  drawGrid(ctx, state.yaw, state.pitch, w, h, u, floor);
  drawShadow(ctx, world, state.yaw, state.pitch, w, h, floor);
  const pts = projectPose(world, state.yaw, state.pitch, w, h), scale = (FILL * h) / BODY_M;
  // 먼 조각부터 그려 가까운 팔다리가 먼 쪽을 가리게 한다
  const parts = [...bodyParts(pts, scale), ...boneParts(world, pts, state.hand, u, scale), ...jointParts(world, pts, u)].sort((p, q) => q.depth - p.depth);
  for (const part of parts) drawPart(ctx, part, u);
  // 팔꿈치 · 무릎 각도 표를 돌려 본 위치에 붙인다(각도 값은 방향을 돌려도 같다)
  drawLabels(ctx, w, h, jointLabels(state.frame, state.hand).map((l) => ({ ...l, x: pts[l.joint].x / w, y: pts[l.joint].y / h })), u);
}

// 캔버스에 3D 뼈대 뷰어를 붙인다 → { setFrame(frame, hand), setView(yaw, pitch), getView(), destroy() }
export function createSkeleton3D(canvas) {
  const state = { frame: null, hand: 'R', yaw: 0, pitch: 0 };
  let drag = null;
  const draw = () => render(canvas, state);
  const setView = (yaw, pitch) => { state.yaw = yaw; state.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch)); draw(); };
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (!drag) return;
    setView(state.yaw + (e.clientX - drag.x) * DRAG_DEG_PER_PX, state.pitch + (e.clientY - drag.y) * DRAG_DEG_PER_PX);
    drag = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => { drag = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); };
  const onKey = (e) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir) { e.preventDefault(); setView(state.yaw + dir * KEY_STEP, state.pitch); }
  };
  canvas.style.touchAction = 'none'; canvas.tabIndex = 0;
  const events = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['keydown', onKey]];
  for (const [name, fn] of events) canvas.addEventListener(name, fn);
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  draw();
  return {
    setFrame(frame, hand) { state.frame = frame; state.hand = hand === 'L' ? 'L' : 'R'; draw(); },
    setView,
    getView: () => ({ yaw: state.yaw, pitch: state.pitch }),
    destroy() { for (const [name, fn] of events) canvas.removeEventListener(name, fn); observer.disconnect(); },
  };
}
