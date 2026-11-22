// 동작 분석 — MediaPipe Pose 엔진 불러오기 · 영상에서 포즈 뽑기 (브라우저 전용)
//  · 엔진(Apache-2.0)은 분석을 처음 누를 때만 받는다(코드 + WASM + 모델). 영상은 기기 안에서만 처리하고 어디로도 보내지 않는다
//  · 버전은 고정한다 — 올릴 때는 여기 한 곳만 바꾼다
//  · 기본은 full · VIDEO 모드. 실제 실내 타격장 스윙 42프레임에서 잰 값(2026-11-22): full 이 heavy 보다 관절을 더 잡았고(평균 28.8 대 22.0개)
//    4배 빨랐다. VIDEO 모드의 손목은 IMAGE 모드의 한 프레임 전보다 같은 프레임에 더 가까워 지연이 없었고, 사람을 찾은 프레임도 많았다(29 대 18).
//    검출 기준을 0.3 으로 낮추면 오히려 덜 찾았다(23프레임) — 기본값(0.5)을 둔다
import { DEFAULT_FPS, fpsFromMediaTimes } from './signal.js?v=1';

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3';
const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';
const MODELS = {
  full: `${MODEL_BASE}/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
  heavy: `${MODEL_BASE}/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task`,
  lite: `${MODEL_BASE}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
};
const SEEK_TIMEOUT_MS = 4000;
const FPS_PROBE_FRAMES = 12;
const FPS_PROBE_TIMEOUT_MS = 1500;

const landmarkers = new Map();   // 모델 이름 → 만들어 둔 엔진(Promise)
let lastTimestamp = 0;           // 엔진에 넘기는 시각은 계속 커져야 한다(다시 분석해도)

async function build(model) {
  const vision = await import(`${VISION}/vision_bundle.mjs`);
  const files = await vision.FilesetResolver.forVisionTasks(`${VISION}/wasm`);
  const options = (delegate) => ({ baseOptions: { modelAssetPath: MODELS[model], delegate }, runningMode: 'VIDEO', numPoses: 1 });
  try {
    return await vision.PoseLandmarker.createFromOptions(files, options('GPU'));
  } catch (e) {
    console.warn('[motion] GPU 로 엔진을 만들지 못해 CPU 로 다시 만든다', e);
    return vision.PoseLandmarker.createFromOptions(files, options('CPU'));
  }
}

// model = 'full' | 'lite'. 실패하면 다음에 다시 받을 수 있게 캐시에서 지운다
export function loadLandmarker(model) {
  if (!MODELS[model]) throw new Error('unknown model: ' + model);
  if (!landmarkers.has(model)) {
    const pending = build(model);
    pending.catch(() => landmarkers.delete(model));
    landmarkers.set(model, pending);
  }
  return landmarkers.get(model);
}

// 잠깐 재생해 프레임 간격을 재서 영상 fps 를 추정한다(못 재면 30). 끝나면 멈춰 둔다
export function estimateFps(video) {
  if (typeof video.requestVideoFrameCallback !== 'function') return Promise.resolve(DEFAULT_FPS);
  return new Promise((resolve) => {
    const times = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.pause();
      resolve(fpsFromMediaTimes(times));
    };
    const onFrame = (now, meta) => {
      if (done) return;
      times.push(meta.mediaTime);
      if (times.length >= FPS_PROBE_FRAMES) finish(); else video.requestVideoFrameCallback(onFrame);
    };
    const timer = setTimeout(finish, FPS_PROBE_TIMEOUT_MS);
    video.requestVideoFrameCallback(onFrame);
    video.play().catch((e) => { console.warn('[motion] fps 추정용 재생이 막혔다', e); finish(); });
  });
}

// 영상을 t 초로 옮기고 그 프레임이 그려질 때까지 기다린다. 제때 못 옮기면 false
function seekTo(video, t) {
  return new Promise((resolve) => {
    const end = (ok) => { clearTimeout(timer); video.removeEventListener('seeked', onSeeked); requestAnimationFrame(() => resolve(ok)); };
    const onSeeked = () => end(true);
    const timer = setTimeout(() => end(false), SEEK_TIMEOUT_MS);
    video.addEventListener('seeked', onSeeked);
    video.currentTime = t;
  });
}

const toFrame = (res) => (res.worldLandmarks && res.worldLandmarks[0]
  ? { world: res.worldLandmarks[0], image: res.landmarks[0] } : { world: null, image: null });

// [start, end] 구간을 초당 hz 장씩 읽어 포즈를 뽑는다 → { frames, stalled(제때 못 옮긴 장 수), stopped }
//  · frames[k] 는 영상 시각 start + (k + 0.5) / hz 의 포즈. onProgress(k + 1, total, frame) · shouldStop() 이 true 면 중단
export async function samplePoses(video, landmarker, { start, end, hz, onProgress, shouldStop }) {
  const total = Math.max(0, Math.floor((end - start) * hz));
  const frames = [];
  let stalled = 0;
  video.pause();
  for (let k = 0; k < total; k++) {
    if (shouldStop && shouldStop()) return { frames, stalled, stopped: true };
    if (!(await seekTo(video, start + (k + 0.5) / hz))) stalled++;
    lastTimestamp += Math.round(1000 / hz);
    const frame = toFrame(landmarker.detectForVideo(video, lastTimestamp));
    frames.push(frame);
    if (onProgress) onProgress(k + 1, total, frame);
  }
  return { frames, stalled, stopped: false };
}
