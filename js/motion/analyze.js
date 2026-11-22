// 동작 분석 — 포즈 프레임 → 야구 지표 (순수 함수 · 화면 · 저장 · MediaPipe 를 모른다)
//  · 입력 frames[i] = { world, image } : world = 골반 중심 3D 좌표(미터, 추정), image = 화면 좌표(0~1). 못 찾은 프레임은 둘 다 null
//  · fps = 실제 시간 기준 초당 표본 수 (슬로모션 영상이면 표본 수 × 배속)
//  · 한 대의 카메라로 추정한 3D 라서 모든 값은 추정치다. 같은 위치에서 찍은 내 영상끼리 비교하는 용도
import { LM, sides, visible } from './landmarks.js?v=1';
import { dist, mid, wrapDeg, jointAngle, yawDeg, tiltFromVertical, elevationDeg } from './geometry.js?v=1';
import { fillGaps, unwrapDeg, smooth, derivative, argMax } from './signal.js?v=1';

const WINDOW_BEFORE_S = 0.5;    // 임팩트 · 릴리스 앞 이만큼에서 회전 피크를 찾는다
const WINDOW_AFTER_S = 0.15;
const STRIDE_LOOKBACK_S = 1.0;  // 앞발 착지는 이 구간 안에서 찾는다
const SMOOTH_S = 0.02;          // 평활 폭(실제 시간 초)
const MIN_FRAMES = 8;
const MIN_VALID_RATIO = 0.5;
const PLANT_MIN_SPEED = 0.5;    // 앞발이 이보다 느리게만 움직였으면(다리 길이/초) 내딛지 않은 것으로 본다
const PLANT_STOP_RATIO = 0.2;   // 앞발 속도가 최대의 이 비율 아래로 떨어지면 착지
const MIN_ROTATION = 150;       // 골반 · 몸통 피크가 둘 다 이보다 느리면(°/s) 스윙 · 투구가 없는 구간으로 본다
const TORSO = [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP];

const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const fail = (reason, extra = {}) => ({ ok: false, reason, ...extra });

// 프레임마다 값을 뽑아(없으면 null) 빈 곳을 잇고 평활한 시계열. 값이 하나도 없으면 null
function smoothSeries(frames, pick, sigma, unwrap = false) {
  const filled = fillGaps(frames.map(pick));
  if (!filled) return null;
  return smooth(unwrap ? unwrapDeg(filled) : filled, sigma);
}

// 골반선 · 어깨선의 수평 방향(도)과 각속도(도/초)
function rotationSeries(frames, sigma, dt) {
  const yaw = (a, b) => (f) => (visible(f.world, a, b) ? yawDeg(f.world[a], f.world[b]) : null);
  const pelvisYaw = smoothSeries(frames, yaw(LM.L_HIP, LM.R_HIP), sigma, true);
  const trunkYaw = smoothSeries(frames, yaw(LM.L_SHOULDER, LM.R_SHOULDER), sigma, true);
  if (!pelvisYaw || !trunkYaw) return null;
  return { pelvisYaw, trunkYaw, pelvisVel: derivative(pelvisYaw, dt), trunkVel: derivative(trunkYaw, dt) };
}

// 손 속도(m/초, 골반 기준) — 투구는 던지는 손목, 타격은 두 손목의 가운데
function handSpeedSeries(frames, mode, side, sigma, dt) {
  const hand = (f) => {
    const rear = visible(f.world, side.rear.wrist) ? f.world[side.rear.wrist] : null;
    if (mode === 'pitch') return rear;
    const lead = visible(f.world, side.lead.wrist) ? f.world[side.lead.wrist] : null;
    return rear && lead ? mid(rear, lead) : rear || lead;
  };
  const axis = (k) => smoothSeries(frames, (f) => { const p = hand(f); return p ? p[k] : null; }, sigma);
  const x = axis('x'), y = axis('y'), z = axis('z');
  if (!x || !y || !z) return null;
  const vx = derivative(x, dt), vy = derivative(y, dt), vz = derivative(z, dt);
  return vx.map((_, i) => Math.hypot(vx[i], vy[i], vz[i]));
}

// 타깃 쪽으로 도는 방향(+1 | -1): 구간 동안 골반이 실제로 돈 쪽
function rotationDirection(rot, win, main) {
  const net = rot.pelvisYaw[main] - rot.pelvisYaw[win.from];
  if (Math.abs(net) > 1) return Math.sign(net);
  const abs = rot.pelvisVel.map(Math.abs);
  return Math.sign(rot.pelvisVel[argMax(abs, win.from, win.to)]) || 1;
}

// 구간 안에서 가장 빠른 순간. 타깃 쪽 회전이 없었으면 null
function peakIn(values, win) {
  const i = argMax(values, win.from, win.to);
  return i >= 0 && values[i] > 0 ? i : null;
}

// i 번째 근처(±2 프레임)에서 필요한 관절이 다 보이는 프레임
function poseNear(frames, i, space, indexes) {
  for (const d of [0, -1, 1, -2, 2]) {
    const f = frames[i + d];
    if (f && visible(f[space], ...indexes)) return f[space];
  }
  return null;
}

// 화면 좌표의 점 — 가로세로 비율을 곱해 x · y 가 같은 단위가 되게 한다
const imagePoint = (lm, aspect) => ({ x: lm.x * aspect, y: lm.y, z: 0 });

function legLength(frames, space, leg, aspect) {
  const pt = space === 'image' ? (lm) => imagePoint(lm, aspect) : (lm) => lm;
  return median(frames.filter((f) => visible(f[space], leg.hip, leg.knee, leg.ankle))
    .map((f) => dist(pt(f[space][leg.hip]), pt(f[space][leg.knee])) + dist(pt(f[space][leg.knee]), pt(f[space][leg.ankle]))));
}

// 앞발 착지 프레임: 화면에서 앞 발목이 가장 빨리 움직인 뒤 멈춘 순간. 내딛지 않았거나 못 찾으면 null
function findPlant(frames, side, main, fps, aspect, sigma) {
  const leg = legLength(frames, 'image', side.lead, aspect);
  const pick = (k) => (f) => (visible(f.image, side.lead.ankle) ? imagePoint(f.image[side.lead.ankle], aspect)[k] : null);
  const x = smoothSeries(frames, pick('x'), sigma), y = smoothSeries(frames, pick('y'), sigma);
  if (!leg || !x || !y) return null;
  const vx = derivative(x, 1 / fps), vy = derivative(y, 1 / fps);
  const speed = vx.map((_, i) => Math.hypot(vx[i], vy[i]) / leg);
  const from = Math.max(0, main - Math.round(STRIDE_LOOKBACK_S * fps));
  const fastest = argMax(speed, from, main);
  if (fastest < 0 || speed[fastest] < PLANT_MIN_SPEED) return null;
  for (let i = fastest + 1; i <= main; i++) if (speed[i] < speed[fastest] * PLANT_STOP_RATIO) return i;
  return null;
}

// 두 발목 사이 수평 거리의 최대(다리 길이 대비 %)
function strideRatio(frames, side, from, to) {
  const leg = legLength(frames, 'world', side.lead);
  let best = null;
  for (let i = from; i <= to; i++) {
    const w = frames[i].world;
    if (!visible(w, side.lead.ankle, side.rear.ankle)) continue;
    const a = w[side.lead.ankle], b = w[side.rear.ankle], d = Math.hypot(a.x - b.x, a.z - b.z);
    if (best === null || d > best) best = d;
  }
  return leg && best !== null ? (best / leg) * 100 : null;
}

// 착지(없으면 구간 시작) → 임팩트 사이 머리가 움직인 거리(다리 길이 대비 %)
function headMove(frames, side, from, main, aspect) {
  const a = poseNear(frames, from, 'image', [LM.NOSE]), b = poseNear(frames, main, 'image', [LM.NOSE]);
  const leg = legLength(frames, 'image', side.lead, aspect);
  if (!a || !b || !leg) return null;
  return (dist(imagePoint(a[LM.NOSE], aspect), imagePoint(b[LM.NOSE], aspect)) / leg) * 100;
}

function postureMetrics(frames, mode, side, ev, win, aspect) {
  const { lead, rear } = side;
  const at = (i, idx) => (i === null ? null : poseNear(frames, i, 'world', idx));
  const knee = at(ev.main, [lead.hip, lead.knee, lead.ankle]);
  const torso = at(ev.main, TORSO);
  const out = {
    stride: strideRatio(frames, side, win.from, win.to),
    leadKnee: knee ? jointAngle(knee[lead.hip], knee[lead.knee], knee[lead.ankle]) : null,
    trunkTilt: torso ? tiltFromVertical(mid(torso[LM.L_HIP], torso[LM.R_HIP]), mid(torso[LM.L_SHOULDER], torso[LM.R_SHOULDER])) : null,
  };
  if (mode === 'pitch') {
    const arm = at(ev.plant, [rear.shoulder, rear.elbow, rear.wrist]);
    const slot = at(ev.main, [rear.shoulder, rear.wrist]);
    out.elbowAtPlant = arm ? jointAngle(arm[rear.shoulder], arm[rear.elbow], arm[rear.wrist]) : null;
    out.armAngle = slot ? elevationDeg(slot[rear.shoulder], slot[rear.wrist]) : null;
  } else {
    out.headMove = headMove(frames, side, ev.plant ?? win.from, ev.main, aspect);
  }
  return out;
}

// 피크 순서. 이상적인 순서는 골반 → 몸통 → 손(몸 중심에서 바깥으로)
function sequenceOf(ev, fps) {
  const parts = [['pelvis', ev.pelvisPeak], ['trunk', ev.trunkPeak], ['hand', ev.handPeak]].filter(([, i]) => i !== null);
  const order = parts.slice().sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const complete = parts.length === 3;
  return {
    order,
    proximalToDistal: complete ? ev.pelvisPeak <= ev.trunkPeak && ev.trunkPeak <= ev.handPeak : null,
    pelvisToTrunkMs: ev.pelvisPeak !== null && ev.trunkPeak !== null ? ((ev.trunkPeak - ev.pelvisPeak) / fps) * 1000 : null,
    resolutionMs: 1000 / fps,
  };
}

function assessQuality(valid, win, fps, metrics) {
  const inWin = valid.slice(win.from, win.to + 1);
  const windowValid = inWin.filter(Boolean).length / inWin.length;
  const noRotation = Math.max(metrics.pelvisPeak || 0, metrics.trunkPeak || 0) < MIN_ROTATION;
  const notes = [];
  if (noRotation) notes.push('noRotation');
  if (fps < 60) notes.push('lowFps');
  if (windowValid < 0.9) notes.push('lowVisibility');
  const level = noRotation || windowValid < 0.7 ? 'low' : notes.length ? 'mid' : 'high';
  return { level, notes, windowValid, validRatio: valid.filter(Boolean).length / valid.length };
}

// mode = 'bat' | 'pitch' · hand = 'R' | 'L' · aspect = 영상 가로/세로 · eventIndex = 임팩트 · 릴리스 프레임을 직접 정할 때
export function analyzeMotion({ frames, mode, hand, fps, aspect = 1, eventIndex = null }) {
  const n = frames.length, side = sides(hand);
  if (n < MIN_FRAMES) return fail('short');
  const valid = frames.map((f) => visible(f.world, ...TORSO));
  if (valid.filter(Boolean).length / n < MIN_VALID_RATIO) return fail('noPose');

  const sigma = Math.max(1, SMOOTH_S * fps), dt = 1 / fps;
  const rot = rotationSeries(frames, sigma, dt);
  const handSpeed = handSpeedSeries(frames, mode, side, sigma, dt);
  if (!rot || !handSpeed) return fail('noPose');

  const auto = argMax(handSpeed, 2, n - 3);
  const main = eventIndex === null ? auto : Math.max(0, Math.min(n - 1, eventIndex));
  const win = { from: Math.max(0, main - Math.round(WINDOW_BEFORE_S * fps)), to: Math.min(n - 1, main + Math.round(WINDOW_AFTER_S * fps)) };
  const dir = rotationDirection(rot, win, main);
  // 타깃 쪽 회전을 + 로 맞춘 시계열
  const pelvisVel = rot.pelvisVel.map((v) => v * dir), trunkVel = rot.trunkVel.map((v) => v * dir);
  const separation = rot.pelvisYaw.map((p, i) => wrapDeg(p - rot.trunkYaw[i]) * dir);

  const events = {
    main, auto: eventIndex === null,
    plant: findPlant(frames, side, main, fps, aspect, sigma),
    pelvisPeak: peakIn(pelvisVel, win), trunkPeak: peakIn(trunkVel, win), handPeak: argMax(handSpeed, win.from, win.to),
  };
  const sepPeak = argMax(separation, win.from, main);
  const metrics = {
    pelvisPeak: events.pelvisPeak === null ? null : pelvisVel[events.pelvisPeak],
    trunkPeak: events.trunkPeak === null ? null : trunkVel[events.trunkPeak],
    maxSeparation: sepPeak >= 0 ? Math.max(0, separation[sepPeak]) : null,
    sequence: sequenceOf(events, fps),
    ...postureMetrics(frames, mode, side, events, win, aspect),
  };
  return { ok: true, mode, hand, fps, window: win, series: { pelvisVel, trunkVel, separation, handSpeed }, events, metrics, quality: assessQuality(valid, win, fps, metrics) };
}
