// 동작 분석 — 시계열 다듬기 (순수 함수). 값이 없는 프레임은 null
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// null 구간을 앞뒤 값으로 잇는다(양 끝은 가장 가까운 값). 값이 하나도 없으면 null
export function fillGaps(values) {
  const out = values.slice(), n = out.length;
  let prev = -1;
  for (let i = 0; i < n; i++) {
    if (!isNum(out[i])) continue;
    if (prev === -1) out.fill(out[i], 0, i);
    else for (let k = prev + 1; k < i; k++) out[k] = out[prev] + (out[i] - out[prev]) * (k - prev) / (i - prev);
    prev = i;
  }
  if (prev === -1) return null;
  out.fill(out[prev], prev + 1, n);
  return out;
}

// 빈 칸(null)이 섞인 각도 열을 이어 붙인다: 값이 있는 칸끼리 ±180 을 넘는 곳을 짧은 쪽으로 잇고, 빈 칸은 그대로 둔다
//  · 빈 칸을 먼저 메우고(fillGaps) 이어 붙이면, 170° 와 -170° 사이의 빈 칸이 0° 를 지나는 먼 길(340°)로 메워져
//    한 프레임에 수백 도를 돈 것처럼 나온다 → 각도는 반드시 이걸로 먼저 이어 붙이고 나서 메운다
export function unwrapGaps(values) {
  const out = values.slice();
  let prev = null;
  for (let i = 0; i < out.length; i++) {
    if (!isNum(out[i])) continue;
    if (prev !== null) { let d = out[i] - prev; d -= 360 * Math.round(d / 360); out[i] = prev + d; }
    prev = out[i];
  }
  return out;
}

// ±180 에서 끊기는 각도를 이어 붙인다 (359 → 1 을 +2 로)
export function unwrapDeg(values) {
  const out = values.slice();
  for (let i = 1; i < out.length; i++) {
    let d = out[i] - out[i - 1];
    d -= 360 * Math.round(d / 360);
    out[i] = out[i - 1] + d;
  }
  return out;
}

// 가우시안 평활(앞뒤 대칭이라 피크 시점이 밀리지 않는다). sigma = 표본 수 단위, 양 끝은 끝 값으로 채운다
export function smooth(values, sigma) {
  if (!(sigma > 0)) return values.slice();
  const r = Math.ceil(sigma * 3), n = values.length, kernel = [];
  for (let k = -r; k <= r; k++) kernel.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const total = kernel.reduce((a, b) => a + b, 0);
  return values.map((_, i) => {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += values[Math.max(0, Math.min(n - 1, i + k))] * kernel[k + r];
    return acc / total;
  });
}

// 중앙 차분 미분. dt = 표본 간격(초)
export function derivative(values, dt) {
  const n = values.length;
  if (n < 2) return values.map(() => 0);
  return values.map((_, i) => {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    return (values[b] - values[a]) / ((b - a) * dt);
  });
}

// [from, to] 구간에서 가장 큰 값의 위치. 구간이 비면 -1
export function argMax(values, from = 0, to = values.length - 1) {
  let best = -1;
  for (let i = Math.max(0, from); i <= Math.min(values.length - 1, to); i++) {
    if (isNum(values[i]) && (best === -1 || values[i] > values[best])) best = i;
  }
  return best;
}

const COMMON_FPS = [24, 25, 30, 50, 60];
export const DEFAULT_FPS = 30;

// 재생하며 받은 프레임 시각(초)들 → 영상 fps. 흔한 값으로 맞추고 60 을 넘으면 60 (분석 표본 수 상한)
export function fpsFromMediaTimes(times) {
  const gaps = [];
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > 1e-4) gaps.push(times[i] - times[i - 1]);
  if (gaps.length < 3) return DEFAULT_FPS;
  gaps.sort((a, b) => a - b);
  const fps = 1 / gaps[Math.floor(gaps.length / 2)];
  if (fps >= 60) return 60;
  return COMMON_FPS.reduce((best, f) => (Math.abs(f - fps) < Math.abs(best - fps) ? f : best), DEFAULT_FPS);
}
