// 동작 다시 보기 「영상 + 선」 화면이 검은 채로 남던 것을 막는다 (mirror.js · page-core.js 는 그대로 두고 app.js 에서 덧붙인다)
//  · 영상 없이 불러온 기록(다른 기기에서 영상 없이 넘어온 기록 등): mirror.draw 가 영상 크기를 몰라 아무것도 그리지 않았다
//    → 같은 비율의 빈 캔버스를 영상 대신 넘겨, 검은 바탕에 선 · 관절 각도만 그린다(3D 뼈대와 같은 프레임)
//  · 안드로이드 크롬에서 다른 앱에 갔다 오면 칸이 검게 되고 다시 재생해도 그대로였다(2026-11-28 사용자 제보)
//    → 브라우저가 캔버스 그리기 판을 버린 것(context lost)으로 보고, 그리기 전마다 확인해 버려졌으면 새 캔버스로 바꿔 다시 그린다
//    → 화면이 다시 보일 때 · 크기가 바뀔 때(회전 · 주소창)도 다시 그린다
import { createMirror } from './mirror.js?v=2';
import { loopRange } from './view.js?v=3';
import { mirror, state } from './page.js?v=4';
import { drawMirror } from './page-core.js?v=2';

const blank = document.createElement('canvas');
const canvasNow = () => document.getElementById('viewVideo');
const lost = () => { const g = canvasNow().getContext('2d'); return !g || (g.isContextLost ? g.isContextLost() : false); };
let watch = null;

function wrap(draw) {
  mirror.draw = (video, frame, hand) => {
    if (lost()) { renew(); return mirror.draw(video, frame, hand); }
    if (video.videoWidth || !state.clip || !state.clip.aspect) return draw(video, frame, hand);
    const h = 720, w = Math.round(h * state.clip.aspect);
    if (blank.width !== w || blank.height !== h) { blank.width = w; blank.height = h; }
    blank.videoWidth = w; blank.videoHeight = h;   // mirror.draw 는 영상의 videoWidth · videoHeight 만 본다
    return draw(blank, frame, hand);
  };
}

// 그리기 판을 잃은 캔버스를 같은 모양의 새 캔버스로 바꾸고, 잘라 낼 범위도 다시 정한다
function renew() {
  const old = canvasNow(), fresh = old.cloneNode(false);
  old.replaceWith(fresh);
  const m = createMirror(fresh);
  Object.assign(mirror, m);
  wrap(m.draw);
  if (state.result && state.clip) { const l = loopRange(state.result, state.clip.frames.length); mirror.setScope(state.clip.frames, l.from, l.to); }
  watch.disconnect(); watch.observe(fresh);
}

export function startMirrorStill() {
  wrap(mirror.draw);
  watch = new ResizeObserver(() => drawMirror());
  watch.observe(canvasNow());
  // 다시 보일 때: 브라우저가 그리기 판을 되살리는 데 조금 걸릴 수 있어 한 번 더
  const again = () => { drawMirror(); setTimeout(drawMirror, 500); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) again(); });
  window.addEventListener('pageshow', again);
}
