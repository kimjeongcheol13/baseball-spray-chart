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

// ── 네모 안의 여러 사람 중 사용자가 감싼 사람 고르기 ─────────────
//  · 투수를 감싸도 네모 안에 포수 · 타자 · 심판이 같이 들어온다. 엔진에 한 사람만 찾게 하면 엔진이 고른 사람(정면을 본 포수 등)에
//    붙어 버린다. 그래서 여러 사람을 찾게 한 뒤, 「네모 가운데에 있고 네모 크기에 맞는 사람」을 기준으로 잡고 앞뒤 프레임을 따라간다
//  · 그런 사람이 한 번도 없으면 아무도 고르지 않는다 — 다른 사람을 대신 분석하느니 못 찾았다고 하는 편이 낫다
const EXTENT_JOINTS = [0, 11, 12, 23, 24, 25, 26, 27, 28];   // 코 · 어깨 · 골반 · 무릎 · 발목
const FIT_HEIGHT = 0.8;        // 사람을 딱 맞게 감싸면 네모에 여백이 붙어 키가 네모 높이의 0.8 쯤 된다(view.js pickRegion 의 여백 12% × 2)
const OFF_CENTER = 2;          // 네모 가운데에서 벗어난 거리(네모 높이 대비)에 곱하는 벌점
const OFF_TRACK = 3;           // (분석 중 미리 보기용) 직전에 고른 자리에서 벗어난 거리에 곱하는 벌점
const ANCHOR_REACH = 0.35;     // 기준으로 삼을 사람은 네모 가운데에서 이 안에 있어야 한다
const HEIGHT_MIN = 0.2, HEIGHT_MAX = 1.2;   // 이보다 작거나 큰 것은 엉뚱한 인식으로 본다(네모 높이 대비)
const TRACK_STEP = 0.25, TRACK_PER_GAP = 0.1, TRACK_MAX = 0.7;   // 다음 프레임까지 움직일 수 있는 거리(그 사람 키의 배수)

// 한 사람이 네모 안에서 차지하는 자리 → { x, y(가운데), height } (네모 높이를 1 로 한 단위. aspect = 네모의 가로/세로)
export function extentOf(landmarks, aspect) {
  const pts = EXTENT_JOINTS.map((i) => landmarks[i]).filter(Boolean);
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x * aspect), ys = pts.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, height: Math.max(...ys) - Math.min(...ys) };
}

const offCenter = (e, aspect) => Math.hypot(e.x - aspect / 2, e.y - 0.5);
// 네모에 얼마나 잘 맞는가(클수록 좋다): 키가 네모 크기에 맞고 가운데에 있을수록
const fit = (e, aspect) => -Math.abs(e.height - FIT_HEIGHT) - OFF_CENTER * offCenter(e, aspect);

// (분석 중 미리 보기용) 지금 프레임에서 고를 사람의 번호 → -1 이면 아무도 없음. prev: 직전에 고른 자리 또는 null
export function chooseInRegion(people, aspect, prev = null) {
  let best = -1, bestScore = -Infinity;
  people.forEach((landmarks, i) => {
    const e = extentOf(landmarks, aspect);
    if (!e) return;
    const score = fit(e, aspect) - (prev ? OFF_TRACK * Math.hypot(e.x - prev.x, e.y - prev.y) : 0);
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

// 모든 프레임의 사람들을 보고 프레임마다 고를 번호를 정한다 → [번호 | -1]
//  · framesPeople[k] = 그 프레임에서 찾은 사람들의 관절 목록(네모 기준 좌표)
//  · 가장 잘 맞는 사람을 기준으로 잡고, 거기서 앞뒤로 가장 가까운 사람을 따라간다. 너무 멀리 있거나 크기가 딴판이면 그 프레임은 비운다
export function selectTrack(framesPeople, aspect) {
  const extents = framesPeople.map((people) => (people || []).map((p) => extentOf(p, aspect))), picks = framesPeople.map(() => -1);
  let anchor = null;
  extents.forEach((list, k) => list.forEach((e, i) => {
    if (!e || e.height < HEIGHT_MIN || e.height > HEIGHT_MAX || offCenter(e, aspect) > ANCHOR_REACH) return;
    const score = fit(e, aspect);
    if (!anchor || score > anchor.score) anchor = { k, i, score };
  }));
  if (!anchor) return picks;
  picks[anchor.k] = anchor.i;
  for (const dir of [1, -1]) {
    let last = anchor.k, at = extents[anchor.k][anchor.i];
    for (let k = anchor.k + dir; k >= 0 && k < extents.length; k += dir) {
      const reach = Math.min(TRACK_MAX, TRACK_STEP + TRACK_PER_GAP * (Math.abs(k - last) - 1)) * at.height;
      let best = -1, bestDist = Infinity;
      extents[k].forEach((e, i) => {
        if (!e) return;
        const d = Math.hypot(e.x - at.x, e.y - at.y), ratio = e.height / at.height;
        if (d <= reach && ratio < SIZE_RATIO && ratio > 1 / SIZE_RATIO && d < bestDist) { best = i; bestDist = d; }
      });
      if (best >= 0) { picks[k] = best; last = k; at = extents[k][best]; }
    }
  }
  return picks;
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
