// 동작 분석 — 숫자의 흔들림 폭(±) 재기 (순수 함수)
//  · 같은 영상이라도 계산 방법을 조금만 바꾸면 피크 값이 달라진다. 그 폭을 함께 보여 줘야 「지난번보다 빨라졌다」 같은 말을 믿을 수 있다
//  · 바꿔 보는 것 두 가지
//     1) 평활 폭을 0.6배 · 1.6배로(다듬기를 덜 · 더 했을 때)
//     2) 피크가 난 프레임과 그 앞뒤 한 프레임을 하나씩 「못 찾음」으로 바꿔서(피크가 프레임 하나에 기대고 있는지)
//    임팩트 · 릴리스 순간은 처음 계산한 자리로 고정한다. 흔들림 폭 = 처음 값에서 가장 멀어진 거리
//  · 이 폭은 「같은 영상 안」의 흔들림이다. 엔진이 사람을 다르게 잡으면(가려짐 · 흐린 화면) 다시 분석했을 때 이보다 더 달라질 수 있다
import { analyzeMotion } from './analyze.js?v=4';

const SMOOTH_SCALES = [0.6, 1.6];
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
  return out;
}

// 저장용: 반올림한 흔들림 폭 { key: 정수 | null }
export const roundSpread = (spread) => Object.fromEntries(SPREAD_KEYS.map((k) => [k, num(spread && spread[k]) ? Math.round(spread[k]) : null]));
