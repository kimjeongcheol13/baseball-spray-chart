// 동작 분석 — 두 기록 나란히 보기: 임팩트 · 릴리스를 같은 순간에 맞춰, 기록마다 「영상 + 선」과 3D 뼈대를 함께 되풀이 재생한다
//  · side = { frames, main(임팩트 · 릴리스 프레임), fps(실제 시간 기준 초당 장 수), hz(영상 시간 기준 초당 장 수), start(구간 시작 영상 시각),
//             slow(슬로모션 배수), hand, video(영상 요소 | null) }
//  · 촬영 속도가 달라도 실제 시간으로 맞춘다: 시계 t(임팩트 기준 실제 초)를 하나 두고, 영상은 배속 × 슬로모션 배수로 틀어 같은 속도로 흐르게 한다
import { createSkeleton3D } from './skeleton3d.js?v=5';
import { createMirror } from './mirror.js?v=1';
import { LOOP_BEFORE_S, LOOP_AFTER_S, nearestPose } from './view.js?v=3';

const clampIndex = (side, i) => Math.max(0, Math.min(side.frames.length - 1, i));

// t 순간에 보여 줄 프레임 번호(가까이에 사람을 찾은 프레임이 없으면 null)
export function duelIndex(side, t) {
  return nearestPose(side.frames, clampIndex(side, side.main + Math.round(t * side.fps)));
}
// 영상 시각 → 그 영상 프레임의 번호
export const videoIndex = (side, time) => clampIndex(side, Math.floor((time - side.start) * side.hz));
// t 순간의 영상 시각(프레임 가운데)
export const videoTime = (side, t) => side.start + (clampIndex(side, side.main + Math.round(t * side.fps)) + 0.5) / side.hz;
// 실제 시간 기준 rate 배속으로 보이게 하는 영상 재생 속도(브라우저 한계 0.0625~16 안)
export const playRate = (rate, slow) => Math.max(0.0625, Math.min(16, rate * slow));
// 되풀이 구간의 프레임 범위
const loopFrames = (side) => ({ from: clampIndex(side, side.main - Math.round(LOOP_BEFORE_S * side.fps)), to: clampIndex(side, side.main + Math.round(LOOP_AFTER_S * side.fps)) });

// sides[k] 가 null 이면(숫자만 저장된 기록) 그 자리에는 안내만 그리고, 나머지 한쪽은 그대로 보여 준다
// panels[k] = { mirror(영상 + 선 캔버스), view(3D 캔버스) } · onTime(t) · missingText = 데이터가 없는 쪽에 쓸 안내
//  → { toggle()(재생 중이면 true), setRate(배속), setView(yaw, pitch), destroy() }. 처음에는 임팩트 · 릴리스 순간(t = 0)에 멈춰 있다
export function createDuel(sides, panels, onTime, missingText) {
  const live = sides.map((s, k) => (s ? k : -1)).filter((k) => k >= 0);
  const views = sides.map((s, k) => (s ? createSkeleton3D(panels[k].view) : null));
  const mirrors = sides.map((s, k) => {
    const m = createMirror(panels[k].mirror);
    if (s) { const r = loopFrames(s); m.setScope(s.frames, r.from, r.to); }
    return m;
  });
  const blanks = sides.map((s, k) => (s ? null : createMirror(panels[k].view)));   // 데이터가 없는 쪽의 3D 자리에도 안내를 쓴다
  let t = 0, rate = 0.25, raf = 0, last = 0;

  // 재생 중이고 영상이 있으면 영상이 실제로 보여 주는 프레임을 따른다(선이 영상과 어긋나지 않게). 아니면 시계를 따른다
  const indexOf = (s) => (s.video && raf ? videoIndex(s, s.video.currentTime) : clampIndex(s, s.main + Math.round(t * s.fps)));
  const showMissing = () => sides.forEach((s, k) => { if (!s) { mirrors[k].note(missingText); blanks[k].note(missingText); } });
  const show = () => {
    for (const k of live) {
      const s = sides[k], i = indexOf(s), near = nearestPose(s.frames, i);
      views[k].setFrame(near === null ? null : s.frames[near], s.hand);
      if (s.video) mirrors[k].draw(s.video, s.frames[i], s.hand); else mirrors[k].note('영상이 저장돼 있지 않아요 (뼈대만 보여요)');
    }
    showMissing();
    onTime(t);
  };
  const videos = live.map((k) => sides[k]).filter((s) => s.video);
  const seekAll = () => { for (const s of videos) s.video.currentTime = videoTime(s, t); };
  const setRates = () => { for (const s of videos) s.video.playbackRate = playRate(rate, s.slow); };
  const onSeeked = () => { if (!raf) show(); };
  const step = (now) => {
    t += ((now - last) / 1000) * rate;
    last = now;
    if (t > LOOP_AFTER_S) { t = -LOOP_BEFORE_S; seekAll(); }
    show();
    raf = requestAnimationFrame(step);
  };
  const pause = () => { cancelAnimationFrame(raf); raf = 0; for (const s of videos) s.video.pause(); };

  for (const s of videos) s.video.addEventListener('seeked', onSeeked);
  seekAll();
  show();
  return {
    toggle() {
      if (raf) { pause(); show(); return false; }
      seekAll(); setRates();
      for (const s of videos) s.video.play().catch((e) => console.warn('[motion] 비교 영상 재생이 막혔어요', e));
      last = performance.now();
      raf = requestAnimationFrame(step);
      return true;
    },
    setRate(r) { rate = r; setRates(); },
    setView(yaw, pitch) { for (const v of views) if (v) v.setView(yaw, pitch); },
    destroy() { pause(); for (const s of videos) s.video.removeEventListener('seeked', onSeeked); for (const v of views) if (v) v.destroy(); },
  };
}
