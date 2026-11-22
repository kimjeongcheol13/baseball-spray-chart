// 동작 분석 — 두 기록 나란히 보기: 임팩트 · 릴리스를 같은 순간에 맞춰 3D 뼈대 두 개를 함께 되풀이 재생한다 (영상 없이 저장한 좌표만으로)
import { createSkeleton3D } from './skeleton3d.js?v=4';
import { LOOP_BEFORE_S, LOOP_AFTER_S, nearestPose } from './view.js?v=2';

// side = { frames, main(임팩트 · 릴리스 프레임), fps(실제 시간 기준 초당 장 수), hand } · t = 임팩트 기준 실제 시간(초)
//  → 그 순간에 보여 줄 프레임 번호. 촬영 속도가 달라도 실제 시간으로 맞춘다. 가까이에 사람을 찾은 프레임이 없으면 null
export function duelIndex(side, t) {
  const i = Math.max(0, Math.min(side.frames.length - 1, side.main + Math.round(t * side.fps)));
  return nearestPose(side.frames, i);
}

// canvases = [A, B] · sides = [A, B] · onTime(t) = 보여 주는 순간이 바뀔 때마다
//  → { toggle()(재생 중이면 true), setRate(배속), setView(yaw, pitch), destroy() }. 처음에는 임팩트 · 릴리스 순간(t = 0)에 멈춰 있다
export function createDuel(canvases, sides, onTime) {
  const views = canvases.map((c) => createSkeleton3D(c));
  let t = 0, rate = 0.25, raf = 0, last = 0;
  const show = () => {
    sides.forEach((s, k) => { const i = duelIndex(s, t); views[k].setFrame(i === null ? null : s.frames[i], s.hand); });
    onTime(t);
  };
  const step = (now) => {
    t += ((now - last) / 1000) * rate;
    last = now;
    if (t > LOOP_AFTER_S) t = -LOOP_BEFORE_S;
    show();
    raf = requestAnimationFrame(step);
  };
  show();
  return {
    toggle() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; return false; }
      last = performance.now();
      raf = requestAnimationFrame(step);
      return true;
    },
    setRate(r) { rate = r; },
    setView(yaw, pitch) { for (const v of views) v.setView(yaw, pitch); },
    destroy() { cancelAnimationFrame(raf); raf = 0; for (const v of views) v.destroy(); },
  };
}
