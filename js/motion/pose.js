// 동작 분석 — MediaPipe Pose 엔진 불러오기 · 영상에서 포즈 뽑기 (브라우저 전용)
//  · 엔진(Apache-2.0)은 분석을 처음 누를 때만 받는다(코드 + WASM + 모델). 영상은 기기 안에서만 처리하고 어디로도 보내지 않는다
//  · 버전은 고정한다 — 올릴 때는 여기 한 곳만 바꾼다
//  · 기본은 full · VIDEO 모드. 실제 실내 타격장 스윙 42프레임에서 잰 값(2026-11-22): full 이 heavy 보다 관절을 더 잡았고(평균 28.8 대 22.0개)
//    4배 빨랐다. VIDEO 모드의 손목은 IMAGE 모드의 한 프레임 전보다 같은 프레임에 더 가까워 지연이 없었고, 사람을 찾은 프레임도 많았다(29 대 18).
//    검출 기준을 0.3 으로 낮추면 오히려 덜 찾았다(23프레임) — 기본값(0.5)을 둔다
import { DEFAULT_FPS, fpsFromMediaTimes } from './signal.js?v=1';
import { mapToFrame } from './view.js?v=3';
import { chooseInRegion, extentOf, selectTrack } from './track.js?v=2';

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

const REGION_POSES = 3;   // 선수를 고른 네모 안에서는 이만큼까지 사람을 찾게 하고, 그중 감싼 사람을 고른다(track.js selectTrack)

// 엔진 결과에서 한 사람을 골라 프레임 하나로 만든다. pick(landmarks 목록) → 고를 번호
const toFrame = (res, region, pick = () => 0) => {
  const i = res.worldLandmarks && res.worldLandmarks.length ? pick(res.landmarks) : -1;
  return i >= 0 ? { world: res.worldLandmarks[i], image: mapToFrame(res.landmarks[i], region) } : { world: null, image: null };
};

// 프레임마다 모아 둔 사람들 중 감싼 선수를 골라 프레임 목록으로 만든다(좌표는 화면 전체 기준으로 되돌린다)
function pickWrapped(found, region, aspect) {
  const picks = selectTrack(found.map((f) => (f ? f.image : [])), aspect);
  return found.map((f, k) => (picks[k] >= 0 ? { world: f.world[picks[k]], image: mapToFrame(f.image[picks[k]], region) } : { world: null, image: null }));
}

const regionAspect = (video, region) => (region.w * video.videoWidth) / (region.h * video.videoHeight);

// (분석 중 미리 보기용) 네모 안의 사람을 프레임마다 이어서 고르는 함수. 네모가 없으면 엔진이 준 첫 사람
//  · 최종 선택은 모든 프레임을 본 뒤 selectTrack 이 다시 한다
function regionPicker(video, region) {
  if (!region) return () => 0;
  const aspect = regionAspect(video, region);
  let prev = null;
  return (people) => {
    const i = chooseInRegion(people, aspect, prev);
    if (i >= 0) prev = extentOf(people[i], aspect);
    return i;
  };
}

const CROP_MAX_SIDE = 1024, CROP_MAX_SCALE = 3;

// 엔진에 넣을 그림: 영역이 없으면 영상 그대로, 있으면 그 부분만 잘라 키운 캔버스(다시 쓰는 캔버스 하나)
//  · 엔진은 화면에서 가장 크게 잡히는 한 사람만 본다. 여러 사람이 나오는 영상(중계 화면의 투수 · 타자 · 포수)에서는 고른 선수 주변만 넣는다
//  · 화면 높이의 14% 로 찍힌 뒤쪽 타자를 이렇게 지정해 33프레임 중 32프레임에서 찾았다(2026-11-22 측정)
function makeSource(video, region) {
  if (!region) return () => video;
  const sw = region.w * video.videoWidth, sh = region.h * video.videoHeight;
  const scale = Math.min(CROP_MAX_SCALE, CROP_MAX_SIDE / Math.max(sw, sh));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(sw * scale), height: Math.round(sh * scale) });
  const ctx = canvas.getContext('2d');
  return () => { ctx.drawImage(video, region.x * video.videoWidth, region.y * video.videoHeight, sw, sh, 0, 0, canvas.width, canvas.height); return canvas; };
}

const FAST_RATE = 2, SAFE_RATE = 1, MISS_CHECK_AFTER = 20, MISS_LIMIT = 0.05, PLAY_STALL_MS = 3000;

// 영상을 재생하면서 pending 에 든 칸의 프레임이 화면에 나오면 잠깐 멈추고 handle(k, 앞 프레임과의 간격 ms) 을 부른다
//  · 프레임마다 위치를 옮기면 그때마다 앞 키프레임부터 다시 풀어야 해서 느리다. 멈췄다 이어 재생하면 다시 풀 필요가 없다
//  · 2배속으로 시작하고, 멈추기 전에 지나가 버리는 프레임이 5% 를 넘으면 1배속으로 낮춘다
//    (가짜 인식기 30ms · 90프레임으로 잰 값: 0.5배속 8.8초 · 1배속 5.8초 · 2배속 4.2초)
//  · 처리한 칸은 pending 에서 뺀다. 지나가 버린 칸은 pending 에 남는다 → { stopped }
function playAndDetect(video, { start, end, hz, total, pending, handle, shouldStop }) {
  return new Promise((resolve) => {
    let prevT = null, prevK = null, seen = 0, missed = 0, finished = false, watchdog = null;
    const finish = (stopped) => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      video.removeEventListener('ended', onEnded);
      video.pause();
      video.playbackRate = 1;
      resolve({ stopped });
    };
    const onEnded = () => finish(false);
    const arm = () => { clearTimeout(watchdog); watchdog = setTimeout(() => finish(false), PLAY_STALL_MS); };
    const onPresented = (now, meta) => {
      if (finished) return;
      if (shouldStop && shouldStop()) { finish(true); return; }
      const t = meta.mediaTime, k = Math.round((t - start) * hz);   // 프레임 시작 시각 → 칸 번호 (floor 는 소수 오차로 칸을 건너뛴다)
      if (t >= end || k >= total || !pending.size) { finish(false); return; }
      const wanted = pending.has(k);
      if (wanted) {
        video.pause();
        if (prevK !== null) { seen += k - prevK; missed += k - prevK - 1; }
        if (video.playbackRate > SAFE_RATE && seen >= MISS_CHECK_AFTER && missed / seen > MISS_LIMIT) video.playbackRate = SAFE_RATE;
        pending.delete(k);
        handle(k, Math.max(1, Math.round((prevT === null ? 1 / hz : t - prevT) * 1000)));
        prevK = k; prevT = t;
      }
      arm();   // 인식이 오래 걸린 뒤(첫 장은 몇 초)에도 멈춤 감시가 잘못 터지지 않게, 일을 끝낸 다음에 다시 건다
      video.requestVideoFrameCallback(onPresented);
      if (wanted) video.play().catch((e) => { console.warn('[motion] 분석용 재생이 멈췄다', e); finish(false); });
    };
    video.addEventListener('ended', onEnded);
    video.playbackRate = FAST_RATE;
    video.requestVideoFrameCallback(onPresented);
    arm();
    video.play().catch((e) => { console.warn('[motion] 분석용 재생이 막혔다', e); finish(false); });
  });
}

// 위치를 옮겨 가며 keys 의 칸을 한 장씩 읽는다(재생으로 못 읽은 칸 · requestVideoFrameCallback 이 없는 브라우저) → 중단했으면 true
async function seekAndDetect(video, ctx, keys, handle) {
  for (const k of keys) {
    if (ctx.shouldStop && ctx.shouldStop()) return true;
    await seekTo(video, ctx.start + (k + 0.5) / ctx.hz);
    handle(k, Math.round(1000 / ctx.hz));
  }
  return false;
}

// [start, end] 구간을 초당 hz 장씩 읽어 포즈를 뽑는다 → { frames, missing(사람을 못 찾은 장 수), refilled(위치를 옮겨 읽은 장 수), stopped }
//  · frames[k] 는 영상 시각 start + k / hz 부근의 포즈. onProgress(읽은 장 수, 전체, frame) · shouldStop() 이 true 면 중단
//  · region = 분석할 선수 영역({ x, y, w, h } 화면 비율). 주면 그 부분만 엔진에 넣고, 좌표는 화면 전체 기준으로 되돌린다
//  · 사람을 놓친 프레임을 선수 주변만 잘라 다시 찾는 방법은 쓰지 않는다 — 찾은 수는 늘지만(28 → 34/42) 뼈대가 38% 작게 잡히는 등
//    위치가 틀려 값이 더 흔들렸다(2026-11-22 측정). 못 찾은 프레임은 못 찾은 채로 두고 신뢰도에 반영한다
export async function samplePoses(video, landmarker, { start, end, hz, region = null, onProgress, shouldStop }) {
  const total = Math.max(0, Math.floor((end - start) * hz)), frames = new Array(total).fill(null);
  const ctx = { start, end, hz, total, shouldStop }, source = makeSource(video, region), pick = regionPicker(video, region);
  await landmarker.setOptions({ numPoses: region ? REGION_POSES : 1 });
  const found = region ? new Array(total).fill(null) : null;   // 네모 안에서 찾은 사람 전부(끝난 뒤 감싼 사람을 다시 고른다)
  let done = 0, refilled = 0, stopped = false;
  const handle = (k, stepMs) => {
    lastTimestamp += stepMs;
    const res = landmarker.detectForVideo(source(), lastTimestamp);
    if (found) found[k] = { image: res.landmarks || [], world: res.worldLandmarks || [] };
    frames[k] = toFrame(res, region, pick);
    if (onProgress) onProgress(++done, total, frames[k]);
  };
  video.pause();
  if (total && typeof video.requestVideoFrameCallback === 'function') {
    await seekTo(video, start);
    stopped = (await playAndDetect(video, { ...ctx, pending: new Set(frames.keys()), handle })).stopped;
  }
  if (!stopped) {
    const left = [...frames.keys()].filter((k) => !frames[k]);
    refilled = left.length;
    stopped = await seekAndDetect(video, ctx, left, handle);
  }
  const filled = found ? pickWrapped(found, region, regionAspect(video, region)) : frames.map((f) => f || toFrame({}, null));
  // others: 사람은 찾았지만 감싼 선수가 아니라서 비운 프레임 수
  const others = found ? found.filter((f, k) => f && f.image.length && !filled[k].world).length : 0;
  return { frames: filled, missing: filled.filter((f) => !f.world).length, refilled, stopped, others };
}
