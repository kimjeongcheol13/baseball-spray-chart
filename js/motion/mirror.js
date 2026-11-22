// 동작 분석 — 「영상 + 선」 화면: 영상에서 선수 주변만 잘라 크게 그리고 같은 프레임의 선 · 관절 점 · 각도 표를 겹친다
//  · 동작 다시 보기와 두 기록 나란히 보기가 같은 그리기를 쓴다
import { drawOverlay, drawLabels, jointLabels } from './overlay.js?v=6';
import { cropBox } from './view.js?v=3';

const LAYER_MAX_SIDE = 960;   // 선만 그려 두는 보조 캔버스의 긴 변
const FONT = "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";

// canvas 에 그리는 도구 → { setScope(frames, from, to), draw(video, frame, hand), note(text) }
export function createMirror(canvas) {
  const layer = document.createElement('canvas');
  let scope = null, box = null;

  // 캔버스 픽셀 크기를 화면 크기에 맞춘다. 크기가 바뀌면 잘라 낼 네모를 다시 정한다
  function fit() {
    const dpr = window.devicePixelRatio || 1, cw = Math.round(canvas.clientWidth * dpr), ch = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; box = null; }
    return { dpr, cw, ch };
  }

  function drawLines(m, video, frame, hand, rect, dpr) {
    const ls = Math.min(1, LAYER_MAX_SIDE / Math.max(video.videoWidth, video.videoHeight)), lw = Math.round(video.videoWidth * ls), lh = Math.round(video.videoHeight * ls);
    if (layer.width !== lw || layer.height !== lh) { layer.width = lw; layer.height = lh; }
    drawOverlay(layer.getContext('2d'), lw, lh, { frame, hand, labels: false });
    m.drawImage(layer, box.x * lw, box.y * lh, box.w * lw, box.h * lh, rect.dx, rect.dy, rect.dw, rect.dh);
    // 각도 표는 잘린 화면 기준 좌표로 바꿔 직접 그린다(잘리지 않고, 글자 크기도 화면에 맞는다)
    const labels = jointLabels(frame, hand).map((l) => ({ ...l, x: (l.x - box.x) / box.w, y: (l.y - box.y) / box.h })).filter((l) => l.x >= 0 && l.x <= 1 && l.y >= 0 && l.y <= 1);
    m.save(); m.translate(rect.dx, rect.dy);
    drawLabels(m, rect.dw, rect.dh, labels, dpr * Math.max(0.9, Math.min(canvas.clientWidth, canvas.clientHeight) / 360));
    m.restore();
  }

  return {
    // 잘라 낼 범위를 정할 프레임들(frames[from..to] 의 관절을 모두 감싸는 네모)
    setScope(frames, from, to) { scope = { frames, from, to }; box = null; },
    // 지금 영상 프레임을 그린다. frame 이 없으면(사람을 못 찾은 프레임) 영상만
    draw(video, frame, hand) {
      if (!scope || !video.videoWidth || !canvas.clientWidth) return;
      const { dpr, cw, ch } = fit(), m = canvas.getContext('2d');
      if (!box) box = cropBox(scope.frames, scope.from, scope.to, (cw / ch) / (video.videoWidth / video.videoHeight));
      const sw = box.w * video.videoWidth, sh = box.h * video.videoHeight, scale = Math.min(cw / sw, ch / sh);
      const rect = { dw: sw * scale, dh: sh * scale, dx: (cw - sw * scale) / 2, dy: (ch - sh * scale) / 2 };
      m.clearRect(0, 0, cw, ch);
      m.drawImage(video, box.x * video.videoWidth, box.y * video.videoHeight, sw, sh, rect.dx, rect.dy, rect.dw, rect.dh);
      if (frame && frame.image) drawLines(m, video, frame, hand, rect, dpr);
    },
    // 영상이 없을 때 가운데에 안내 글자만
    note(text) {
      const { dpr, cw, ch } = fit(), m = canvas.getContext('2d');
      m.clearRect(0, 0, cw, ch);
      m.fillStyle = 'rgba(255,255,255,.72)'; m.font = `700 ${13 * dpr}px ${FONT}`; m.textAlign = 'center'; m.textBaseline = 'middle';
      m.fillText(text, cw / 2, ch / 2);
    },
  };
}
