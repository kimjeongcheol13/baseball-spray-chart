// 동작 다시 보기 「영상 + 선」 화면이 검은 채로 남던 것을 막는다 (mirror.js · page-core.js 는 그대로 두고 app.js 에서 덧붙인다)
//  · 영상 없이 불러온 기록(다른 기기에서 영상 없이 넘어온 기록 등): mirror.draw 가 영상 크기를 몰라 아무것도 그리지 않았다
//    → 같은 비율의 빈 캔버스를 영상 대신 넘겨, 검은 바탕에 선 · 관절 각도만 그린다(3D 뼈대와 같은 프레임)
//  · 화면 크기가 바뀌면(폰 회전 · 주소창이 접힐 때) 캔버스가 지워진 채 다음 재생까지 남았다 → 크기가 바뀌면 다시 그린다
import { mirror, state } from './page.js?v=3';
import { drawMirror } from './page-core.js?v=1';

export function startMirrorStill() {
  const blank = document.createElement('canvas'), draw = mirror.draw;
  mirror.draw = (video, frame, hand) => {
    if (video.videoWidth || !state.clip || !state.clip.aspect) return draw(video, frame, hand);
    const h = 720, w = Math.round(h * state.clip.aspect);
    if (blank.width !== w || blank.height !== h) { blank.width = w; blank.height = h; }
    blank.videoWidth = w; blank.videoHeight = h;   // mirror.draw 는 영상의 videoWidth · videoHeight 만 본다
    return draw(blank, frame, hand);
  };
  new ResizeObserver(() => drawMirror()).observe(document.getElementById('viewVideo'));
}
