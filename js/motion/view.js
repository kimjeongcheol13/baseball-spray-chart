// 동작 분석 — 「동작 다시 보기」 화면 계산 (순수 함수): 반복 재생할 구간, 선수 주변만 크게 보여 줄 네모
import { MIN_VISIBILITY } from './landmarks.js?v=1';

export const LOOP_BEFORE_S = 1.2, LOOP_AFTER_S = 0.5;   // 임팩트 · 릴리스 앞뒤로 이만큼(실제 시간)을 반복 재생한다
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// 반복 재생할 프레임 범위 { from, to } — 준비 동작부터 마무리까지
export function loopRange(result, frameCount) {
  const main = result.events.main;
  return { from: Math.max(0, main - Math.round(LOOP_BEFORE_S * result.fps)), to: Math.min(frameCount - 1, main + Math.round(LOOP_AFTER_S * result.fps)) };
}

// i 번째 프레임 앞뒤 reach 안에서 사람을 찾은 가장 가까운 프레임 번호(같은 거리면 앞쪽). 없으면 null
export function nearestPose(frames, i, reach = 5) {
  for (let d = 0; d <= reach; d++) for (const k of [i - d, i + d]) if (frames[k] && frames[k].world) return k;
  return null;
}

// 길이 size(0~1) 짜리 구간을 가운데 center 에 두되 화면(0~1) 밖으로 나가지 않게 한 시작점
const place = (center, size) => clamp01(Math.min(center - size / 2, 1 - size));

const MIN_DRAG = 0.03, MIN_REGION = 0.08, TAP_HEIGHT = 0.5;

// 분석할 선수 영역: 영상 위에서 끌어 그린 네모(a → b, 화면 비율 0~1)에 여유를 더한 것. 그냥 누르기만 했으면(거의 안 끌었으면)
// 누른 자리를 가운데로 화면 높이의 절반짜리 정사각형(픽셀 기준 — aspect = 영상 가로/세로). 화면 밖으로는 나가지 않는다
export function pickRegion(a, b, aspect, margin = 0.12) {
  let w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y);
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  if (w < MIN_DRAG && h < MIN_DRAG) { h = TAP_HEIGHT; w = TAP_HEIGHT / aspect; }
  else { w = Math.max(MIN_REGION, w * (1 + margin * 2)); h = Math.max(MIN_REGION, h * (1 + margin * 2)); }
  w = Math.min(1, w); h = Math.min(1, h);
  return { x: place(cx, w), y: place(cy, h), w, h };
}

// 영역만 잘라 넣어 얻은 관절 좌표(잘린 그림 기준 0~1)를 화면 전체 기준으로 되돌린다
export function mapToFrame(image, region) {
  if (!image || !region) return image;
  return image.map((p) => ({ ...p, x: region.x + p.x * region.w, y: region.y + p.y * region.h, z: (p.z || 0) * region.w }));
}


// frames[from..to] 에서 보이는 관절을 모두 감싸는 네모(화면 비율 0~1)에 여유를 더하고, 가로/세로가 ratio 가 되게 넓힌다
//  · ratio = 네모의 w / h (화면 비율 단위). 화면을 넘으면 넘지 않는 만큼만. 사람이 없으면 화면 전체
export function cropBox(frames, from, to, ratio, margin = 0.15) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (let i = from; i <= to; i++) {
    const image = frames[i] && frames[i].image;
    if (!image) continue;
    for (const p of image) {
      if ((p.visibility ?? 1) < MIN_VISIBILITY) continue;
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
  }
  if (x1 <= x0 || y1 <= y0) return { x: 0, y: 0, w: 1, h: 1 };
  let w = (x1 - x0) * (1 + margin * 2), h = (y1 - y0) * (1 + margin * 2);
  if (w / h < ratio) w = h * ratio; else h = w / ratio;
  w = Math.min(1, w); h = Math.min(1, h);
  return { x: place((x0 + x1) / 2, w), y: place((y0 + y1) / 2, h), w, h };
}
