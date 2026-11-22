// 동작 분석 — 벡터 · 각도 계산 (순수 함수). 좌표는 MediaPipe 기준: x 오른쪽 · y 아래 · z 카메라 반대쪽
const DEG = 180 / Math.PI;

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) });
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 });
export const length = (v) => Math.hypot(v.x, v.y, v.z || 0);
export const dist = (a, b) => length(sub(a, b));

// 각도를 (-180, 180] 로 접는다
export function wrapDeg(d) {
  const w = ((d + 180) % 360 + 360) % 360 - 180;
  return w === -180 ? 180 : w;
}

// 관절 b 에서 a-b-c 가 이루는 각(도). 곧게 펴면 180
export function jointAngle(a, b, c) {
  const u = sub(a, b), v = sub(c, b), lu = length(u), lv = length(v);
  if (!lu || !lv) return null;
  const cos = (u.x * v.x + u.y * v.y + u.z * v.z) / (lu * lv);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * DEG;
}

// 위에서 내려다본 선(from → to)의 방향(도). 골반선 · 어깨선의 수평 회전을 잰다
export function yawDeg(from, to) {
  const v = sub(to, from);
  return Math.atan2(v.z, v.x) * DEG;
}

// 아래 점 → 위 점 선이 수직에서 기운 각(도). 똑바로 서면 0
export function tiltFromVertical(bottom, top) {
  const v = sub(top, bottom), l = length(v);
  if (!l) return null;
  return Math.acos(Math.max(-1, Math.min(1, -v.y / l))) * DEG;
}

// from → to 선이 수평 위로 올라간 각(도). 수평 0 · 머리 위 90 · 아래로 음수
export function elevationDeg(from, to) {
  const v = sub(to, from);
  return Math.atan2(-v.y, Math.hypot(v.x, v.z)) * DEG;
}
