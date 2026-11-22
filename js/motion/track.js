// 동작 분석 — 엉뚱한 곳에 잡힌 뼈대 걸러내기 (순수 함수)
//  · 선수가 화면에서 빠지거나 가려지면 엔진이 관중 · 광고판에서 사람 비슷한 모양을 잡을 때가 있다
//  · 선수는 프레임 사이에 조금씩만 움직이므로, 가장 많이 머문 자리에서 출발해 앞뒤로 따라가며 갑자기 멀리 튀거나 크기가 크게 달라진 뼈대를 버린다
//  · 스윙 · 투구는 제자리 동작이라, 조금씩 미끄러져 그 자리에서 멀리 벗어난 뼈대도 버린다(타자가 뛰어나간 뒤 관중석으로 흘러간 경우)
import { LM, visible } from './landmarks.js?v=1';

const MIN_FOUND = 5;        // 찾은 프레임이 이보다 적으면 걸러내지 않는다
const STEP = 0.6;           // 바로 다음 프레임까지 골반 중심이 움직일 수 있는 거리(몸통 길이의 배수)
const STEP_PER_GAP = 0.25;  // 사이에 못 찾은 프레임 하나마다 더 봐주는 거리
const STEP_MAX = 1.6;       // 그래도 이 이상 떨어져 있으면 다른 것으로 본다
const HOME_REACH = 1.6;     // 가장 많이 머문 자리에서 이보다 멀면(몸통 길이의 배수) 다른 것으로 본다
//   · 몸통 길이(어깨 ~ 골반)는 키의 약 0.3배. 투수가 내딛으며 골반이 움직이는 거리는 몸통 2배쯤이라 가운데에서 ±1배 → 1.6배면 남긴다
//   · 실제 중계 영상에서 타자 몸통이 화면의 0.13, 관중석에 잡힌 뼈대는 0.28(몸통 2.2배) 떨어져 있었다 — 2.5배로 두면 걸러지지 않았다(2026-11-22)
const SIZE_RATIO = 1.8;     // 몸통 길이가 보통 크기의 이 배수(또는 그 역수)를 넘으면 다른 것으로 본다
const EMPTY = { world: null, image: null };
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// 프레임의 골반 중심과 몸통 길이(가로세로 비율을 곱해 x · y 가 같은 단위). 몸통이 안 보이면 null
function body(frame, aspect) {
  const p = frame.image;
  if (!visible(p, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP)) return null;
  const hx = ((p[LM.L_HIP].x + p[LM.R_HIP].x) / 2) * aspect, hy = (p[LM.L_HIP].y + p[LM.R_HIP].y) / 2;
  const sx = ((p[LM.L_SHOULDER].x + p[LM.R_SHOULDER].x) / 2) * aspect, sy = (p[LM.L_SHOULDER].y + p[LM.R_SHOULDER].y) / 2;
  return { x: hx, y: hy, size: Math.hypot(sx - hx, sy - hy) };
}

// anchor 에서 dir(+1 | -1) 쪽으로 따라가며 이어지는 프레임만 keep 에 표시한다. ok[i] = 크기 · 자리가 선수일 수 있는 프레임
function follow(bodies, ok, keep, anchor, dir, size) {
  let last = anchor;
  for (let i = anchor + dir; i >= 0 && i < bodies.length; i += dir) {
    const b = bodies[i];
    if (!b || !ok[i]) continue;
    const reach = Math.min(STEP_MAX, STEP + STEP_PER_GAP * (Math.abs(i - last) - 1)) * size;
    if (Math.hypot(b.x - bodies[last].x, b.y - bodies[last].y) <= reach) { keep[i] = true; last = i; }
  }
}

// frames → { frames(엉뚱한 뼈대는 「못 찾음」으로 바꾼 것), dropped(바꾼 수) }. aspect = 영상 가로/세로
export function dropStrays(frames, aspect) {
  const bodies = frames.map((f) => (f.image ? body(f, aspect) : null)), found = bodies.filter(Boolean);
  if (found.length < MIN_FOUND) return { frames, dropped: 0 };
  const size = median(found.map((b) => b.size)), cx = median(found.map((b) => b.x)), cy = median(found.map((b) => b.y));
  const home = (b) => Math.hypot(b.x - cx, b.y - cy);
  const ok = bodies.map((b) => !!b && b.size < size * SIZE_RATIO && b.size > size / SIZE_RATIO && home(b) <= HOME_REACH * size);
  let anchor = -1, best = Infinity;
  bodies.forEach((b, i) => { if (ok[i] && home(b) < best) { best = home(b); anchor = i; } });
  if (anchor < 0) return { frames, dropped: 0 };
  const keep = frames.map(() => false);
  keep[anchor] = true;
  follow(bodies, ok, keep, anchor, 1, size);
  follow(bodies, ok, keep, anchor, -1, size);
  let dropped = 0;
  const out = frames.map((f, i) => { if (f.image && !keep[i]) { dropped++; return EMPTY; } return f; });
  return { frames: out, dropped };
}
