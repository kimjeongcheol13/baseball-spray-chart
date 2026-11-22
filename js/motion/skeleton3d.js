// 동작 분석 — worldLandmarks 를 드래그로 360도 돌려 보는 3D 뼈대 뷰어 (직교 투영 · 캔버스 2D, 외부 라이브러리 없음)
import { LM, MIN_VISIBILITY } from './landmarks.js?v=1';
import { COLOR, FULL_BONES, boneColor, isSmallJoint, jointLabels, drawLabels } from './overlay.js?v=6';
import { FRAME, clampPitch, attachOrbit } from './orbit.js?v=1';

const FOOT_Y = 0.95, HEAD_R = 0.1;   // 발 높이(골반 기준 아래로 m) · 머리 원 반지름(m)
const FONT = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const rad = (d) => (d * Math.PI) / 180;

// 세로축(y) 둘레로 yaw, 그다음 가로축(x) 둘레로 pitch 만큼 돌린 점
export function rotatePoint(p, yawDeg, pitchDeg) {
  const cy = Math.cos(rad(yawDeg)), sy = Math.sin(rad(yawDeg)), cp = Math.cos(rad(pitchDeg)), sp = Math.sin(rad(pitchDeg));
  const x = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
  return { x, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
}

// 한 점 → 캔버스 픽셀 + depth(클수록 멀다). 배율은 캔버스 높이로만 정해 프레임이 바뀌어도 일정하다
function projectPoint(p, yawDeg, pitchDeg, width, height) {
  const r = rotatePoint(p, yawDeg, pitchDeg), scale = height / FRAME.heightM;
  return { x: width / 2 + r.x * scale, y: height * FRAME.centerY + r.y * scale, depth: r.z };
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

// 발 높이 바닥 격자 선 (회전과 함께 돈다)
function gridLines(yaw, pitch, w, h) {
  const out = [], at = (x, z) => projectPoint({ x, y: FOOT_Y, z }, yaw, pitch, w, h);
  for (let i = -2; i <= 2; i++) {
    out.push([at(i * 0.5, -1), at(i * 0.5, 1)], [at(-1, i * 0.5), at(1, i * 0.5)]);
  }
  return out;
}

function drawGrid(ctx, yaw, pitch, w, h, u) {
  ctx.strokeStyle = COLOR.line; ctx.lineWidth = u; ctx.setLineDash([]);
  for (const [a, b] of gridLines(yaw, pitch, w, h)) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
}

// 그릴 뼈대 선 목록 → [{ a, b, color, width, dashed, depth }] (멀리 있는 것부터 정렬)
//  · 3D 좌표는 가려진 관절에도 추정값이 있으므로 선을 빼지 않고 전부 그린다. 불확실한 선(관절이 반쯤 가려짐)은 점선
function boneSegments(world, pts, hand, u) {
  const segs = [];
  const add = (a, b, color, width) => {
    const dashed = Math.min(world[a].visibility ?? 1, world[b].visibility ?? 1) < MIN_VISIBILITY;
    segs.push({ a: pts[a], b: pts[b], color, width, dashed, depth: (pts[a].depth + pts[b].depth) / 2 });
  };
  for (const [a, b] of FULL_BONES) add(a, b, boneColor(a, b, hand), (isSmallJoint(a) && isSmallJoint(b) ? 2 : 3) * u);
  add(LM.L_HIP, LM.R_HIP, COLOR.pelvis, 5 * u);
  add(LM.L_SHOULDER, LM.R_SHOULDER, COLOR.trunk, 5 * u);
  return segs.sort((p, q) => q.depth - p.depth);
}

// 머리: 코를 중심으로 한 원 — 사람 모양으로 읽히게 한다
function drawHead(ctx, pts, h, u) {
  const r = (HEAD_R * h) / FRAME.heightM, p = pts[LM.NOSE];
  for (const [stroke, lw] of [[COLOR.casing, 5 * u], [COLOR.bone, 2 * u]]) {
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  }
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
  drawGrid(ctx, state.yaw, state.pitch, w, h, u);
  const pts = projectPose(world, state.yaw, state.pitch, w, h);
  for (const s of boneSegments(world, pts, state.hand, u)) casedLine(ctx, s.a, s.b, s.color, s.width, u, s.dashed);
  drawHead(ctx, pts, h, u);
  // 팔꿈치 · 무릎 각도 표를 돌려 본 위치에 붙인다(각도 값은 방향을 돌려도 같다)
  drawLabels(ctx, w, h, jointLabels(state.frame, state.hand).map((l) => ({ ...l, x: pts[l.joint].x / w, y: pts[l.joint].y / h })), u);
}

// 캔버스에 3D 뼈대 뷰어를 붙인다 → { setFrame(frame, hand), setView(yaw, pitch), getView(), destroy() }
export function createSkeleton3D(canvas) {
  const state = { frame: null, hand: 'R', yaw: 0, pitch: 0 };
  const draw = () => render(canvas, state);
  const getView = () => ({ yaw: state.yaw, pitch: state.pitch });
  const setView = (yaw, pitch) => { state.yaw = yaw; state.pitch = clampPitch(pitch); draw(); };
  const detach = attachOrbit(canvas, getView, setView);
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  draw();
  return {
    setFrame(frame, hand) { state.frame = frame; state.hand = hand === 'L' ? 'L' : 'R'; draw(); },
    setView,
    getView,
    destroy() { detach(); observer.disconnect(); },
  };
}
