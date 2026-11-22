// 동작 분석 — 3D 화면 두 가지(선 뼈대 · 사람 모형)가 같이 쓰는 화면 틀과 돌리기 입력
//  · 두 화면이 같은 배율 · 같은 골반 위치 · 같은 조작을 쓰게 해서, 바꿔 봐도 같은 자리에서 같은 방향으로 보이게 한다

// 화면 틀: 캔버스 높이에 담는 실제 높이(m) · 골반의 세로 위치(위에서부터의 비율)
export const FRAME = { heightM: 2.2 / 0.85, centerY: 0.46 };
export const PITCH_MAX = 90;
const DRAG_DEG_PER_PX = 0.5, KEY_STEP = 15;

export const clampPitch = (pitch) => Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch));

// canvas 를 끌거나 좌우 화살표로 돌리게 한다. getView() → { yaw, pitch } · setView(yaw, pitch). 돌려주는 함수를 부르면 입력을 뗀다
export function attachOrbit(canvas, getView, setView) {
  let drag = null;
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (!drag) return;
    const v = getView();
    setView(v.yaw + (e.clientX - drag.x) * DRAG_DEG_PER_PX, v.pitch + (e.clientY - drag.y) * DRAG_DEG_PER_PX);
    drag = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => { drag = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); };
  const onKey = (e) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const v = getView();
    setView(v.yaw + dir * KEY_STEP, v.pitch);
  };
  canvas.style.touchAction = 'none'; canvas.tabIndex = 0;
  const events = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp], ['keydown', onKey]];
  for (const [name, fn] of events) canvas.addEventListener(name, fn);
  return () => { for (const [name, fn] of events) canvas.removeEventListener(name, fn); };
}
