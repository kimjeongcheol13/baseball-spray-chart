// 동작 분석 — 숫자의 흔들림 폭(±) 재기 (순수 함수)
//  · 같은 영상이라도 계산 방법을 조금만 바꾸면 피크 값이 달라진다. 그 폭을 함께 보여 줘야 「지난번보다 빨라졌다」 같은 말을 믿을 수 있다
//  · 바꿔 보는 것 두 가지
//     1) 평활 폭을 0.6배 · 1.6배로(다듬기를 덜 · 더 했을 때)
//     2) 피크가 난 프레임과 그 앞뒤 한 프레임을 하나씩 「못 찾음」으로 바꿔서(피크가 프레임 하나에 기대고 있는지)
//    임팩트 · 릴리스 순간은 처음 계산한 자리로 고정한다. 흔들림 폭 = 처음 값에서 가장 멀어진 거리
//  · 이 폭은 「같은 영상 안」의 흔들림이다. 엔진이 사람을 다르게 잡으면(가려짐 · 흐린 화면) 다시 분석했을 때 이보다 더 달라질 수 있다
import { analyzeMotion } from './analyze.js?v=5';

const SMOOTH_SCALES = [0.6, 1.6];
// 분리각이 동작 내내 이만큼도 안 변하면(°) 몸의 꼬임이 아니라 골반선 · 어깨선이 처음부터 어긋나게 잡힌 값으로 본다
//  · 실제 중계 영상(2026-11-23): 문제 장면을 9번 분석하니 동작 중 변한 폭이 2~8° 였고 분리각이 부호에 따라 28° · 0° 로 갈렸다.
//    정상 투구 장면은 3번 모두 28~37° 변했다 → 두 무리 사이인 15° 로 둔다. 영상 두 장면으로 정한 값이라 더 확인이 필요하다
const SEP_STATIC = 15;
// 손이 가장 빠른 순간 후보: 두 번째 봉우리가 첫 번째의 이 비율 이상이고 이 시간(초) 이상 떨어져 있으면 「후보가 둘」
//  · 같은 영상에서 두 봉우리 비율이 0.86~0.98 이었고, 분석마다 임팩트로 고른 프레임이 62 · 23 으로 바뀌었다
const RIVAL_RATIO = 0.8, RIVAL_GAP_S = 0.3;
const DROP_AROUND = [-1, 0, 1];
export const SPREAD_KEYS = ['pelvisPeak', 'trunkPeak', 'maxSeparation'];
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const EMPTY = { world: null, image: null };

// k 번째 프레임만 「못 찾음」으로 바꾼 프레임 목록
const without = (frames, k) => frames.map((f, i) => (i === k ? EMPTY : f));

// 분리각이 가장 컸던 프레임(analyze.js 와 같은 구간: 창 시작 ~ 임팩트 · 릴리스)
function separationPeak(result) {
  const s = result.series.separation, from = result.window.from, to = result.events.main;
  let best = null;
  for (let i = from; i <= to; i++) if (num(s[i]) && (best === null || s[i] > s[best])) best = i;
  return best;
}

// input = analyzeMotion 에 넣은 값, base = 그 결과 → { pelvisPeak, trunkPeak, maxSeparation } (각각 흔들림 폭 · 잴 수 없으면 null)
export function estimateSpread(input, base) {
  const out = Object.fromEntries(SPREAD_KEYS.map((k) => [k, null]));
  if (!base || !base.ok) return out;
  const fixed = { ...input, eventIndex: base.events.main, smoothScale: 1 }, runs = [];
  for (const smoothScale of SMOOTH_SCALES) runs.push(analyzeMotion({ ...fixed, smoothScale }));
  const peaks = new Set();
  for (const at of [base.events.pelvisPeak, base.events.trunkPeak, separationPeak(base)]) {
    if (at === null || at === undefined) continue;
    for (const d of DROP_AROUND) if (at + d >= 0 && at + d < input.frames.length) peaks.add(at + d);
  }
  for (const k of peaks) runs.push(analyzeMotion({ ...fixed, frames: without(input.frames, k) }));
  for (const key of SPREAD_KEYS) {
    const v0 = base.metrics[key];
    if (!num(v0)) continue;
    const gaps = runs.filter((r) => r.ok && num(r.metrics[key])).map((r) => Math.abs(r.metrics[key] - v0));
    if (gaps.length) out[key] = Math.max(...gaps);
  }
  // 분리각이 동작 내내 그대로면, 그 값은 처음부터 있던 어긋남과 구분되지 않는다 → 폭을 그 어긋남의 크기만큼으로 넓힌다
  const still = separationStill(base);
  if (still && num(base.metrics.maxSeparation)) out.maxSeparation = Math.max(out.maxSeparation || 0, still.offset);
  return out;
}

// 분리각이 동작 내내 거의 그대로였나 → { from, to(그 구간의 최소 · 최대 °), offset(평균 크기) } | null
export function separationStill(result) {
  if (!result || !result.ok) return null;
  const s = result.series.separation.slice(result.window.from, result.events.main + 1).filter(num);
  if (s.length < 3) return null;
  const lo = Math.min(...s), hi = Math.max(...s);
  return hi - lo < SEP_STATIC ? { from: lo, to: hi, offset: s.reduce((a, v) => a + Math.abs(v), 0) / s.length } : null;
}

// 손이 가장 빠른 순간 후보가 둘인가 → [첫째 프레임, 둘째 프레임] | null (자동으로 고른 임팩트 · 릴리스가 분석마다 바뀔 수 있다)
export function rivalEvents(result) {
  if (!result || !result.ok) return null;
  const h = result.series.handSpeed, peaks = [];
  for (let k = 2; k < h.length - 2; k++) if (num(h[k]) && h[k] >= h[k - 1] && h[k] >= h[k + 1] && h[k] >= h[k - 2] && h[k] >= h[k + 2]) peaks.push(k);
  peaks.sort((a, b) => h[b] - h[a]);
  if (peaks.length < 2) return null;
  const first = peaks[0], rival = peaks.find((k) => Math.abs(k - first) >= RIVAL_GAP_S * result.fps);
  return rival !== undefined && h[rival] >= RIVAL_RATIO * h[first] ? [first, rival].sort((a, b) => a - b) : null;
}

// 저장용: 반올림한 흔들림 폭 { key: 정수 | null }
export const roundSpread = (spread) => Object.fromEntries(SPREAD_KEYS.map((k) => [k, num(spread && spread[k]) ? Math.round(spread[k]) : null]));
