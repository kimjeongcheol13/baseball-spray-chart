// 동작 분석 — 「동작 다시 보기」 화면 계산 (순수 함수): 반복 재생할 구간, 선수 주변만 크게 보여 줄 네모
import { MIN_VISIBILITY } from './landmarks.js?v=1';

const LOOP_BEFORE_S = 1.2, LOOP_AFTER_S = 0.5;   // 임팩트 · 릴리스 앞뒤로 이만큼(실제 시간)을 반복 재생한다
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// 반복 재생할 프레임 범위 { from, to } — 준비 동작부터 마무리까지
export function loopRange(result, frameCount) {
  const main = result.events.main;
  return { from: Math.max(0, main - Math.round(LOOP_BEFORE_S * result.fps)), to: Math.min(frameCount - 1, main + Math.round(LOOP_AFTER_S * result.fps)) };
}

// 길이 size(0~1) 짜리 구간을 가운데 center 에 두되 화면(0~1) 밖으로 나가지 않게 한 시작점
const place = (center, size) => clamp01(Math.min(center - size / 2, 1 - size));

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
