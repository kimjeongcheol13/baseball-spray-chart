// 동작 분석 — 분석한 구간만 작게 다시 만든다(다른 기기로 보낼 영상)
//  · 원본(수십~수백 MB)을 그대로 올리면 무료 저장 공간(1GB)이 금방 찬다. 분석한 몇 초만 짧은 변 720px 로 다시 녹화해 1~3MB 로 줄인다
//  · 숨긴 영상 요소를 제 속도로 재생하며 캔버스에 그리고, 그 캔버스를 브라우저의 녹화기(MediaRecorder)로 녹화한다 — 구간 길이만큼 걸린다
//  · 녹화한 영상의 0초가 원본의 몇 초인지(offset)를 함께 돌려준다. 받은 기기는 관절 좌표의 시간을 이만큼 당겨 영상과 맞춘다
import { chooseMime } from './capture.js?v=1';

export const CUT = {
  maxShort: 720,          // 짧은 변(px)이 이보다 크면 줄인다
  bitrate: 2_500_000,     // 초당 비트 — 720p 동작 영상에서 관절이 뭉개지지 않는 정도
  maxBytes: 8_000_000,    // 이보다 커지지 않게 비트를 낮춘다(서버 한 파일 한도 10MB 보다 여유 있게)
  pad: 0.3,               // 구간 앞뒤로 이만큼(초) 더 담는다(받은 기기에서 처음 · 끝 장면이 잘리지 않게)
  fps: 60,                // 캔버스에서 받아 가는 최대 초당 프레임
};

const even = (v) => Math.max(2, Math.round(v / 2) * 2);   // 녹화기가 홀수 크기를 싫어한다

// 원본 크기 → 다시 만들 크기(짧은 변 maxShort 이하 · 짝수)
export function outputSize(w, h, maxShort = CUT.maxShort) {
  const k = Math.min(1, maxShort / Math.min(w, h));
  return { width: even(w * k), height: even(h * k) };
}

// 구간 길이(초) → 초당 비트(maxBytes 를 넘지 않게)
export const bitrateFor = (seconds, rules = CUT) => Math.round(Math.min(rules.bitrate, (rules.maxBytes * 8 * 0.9) / Math.max(seconds, 0.1)));

// 분석 구간 → 다시 만들 구간(앞뒤 pad · 영상 길이 안으로)
export const cutRange = (range, duration, pad = CUT.pad) => ({ start: Math.max(0, range.start - pad), end: Math.min(duration, range.end + pad) });

// (원본 시각 − 녹화 시각) 표본들 → 가운데 값. 재생이 잠깐 끊긴 표본에 끌려가지 않게 평균 대신 가운데 값
export function offsetFrom(samples) {
  if (!samples.length) return null;
  const s = samples.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// 받은 영상의 0초 = 원본의 offset 초 → 관절 좌표의 시작 시각 · 분석 구간을 그만큼 당긴다(원본에서는 offset = 0 이라 그대로)
export const shiftClip = (clip, offset) => (offset ? { ...clip, start: clip.start - offset } : clip);
export const shiftRange = (range, offset) => (offset && range ? { start: range.start - offset, end: range.end - offset } : range);

// 이보다 작은 영상 파일은 장면이 하나도 없는 빈 파일로 본다(빈 webm 머리말만 110바이트였다)
export const MIN_VIDEO_BYTES = 2000;
// 담은 장면이 이보다 적으면(초당) 실패로 본다 — 탭이 가려져 브라우저가 재생 · 그리기를 멈춘 경우
const MIN_DRAW_FPS = 5, TRIES = 3;
export const enoughFrames = (frames, seconds) => frames >= Math.max(3, Math.floor(seconds * MIN_DRAW_FPS));

export const canCut = (win = window) => Boolean(win.MediaRecorder && win.HTMLCanvasElement && win.HTMLCanvasElement.prototype.captureStream);

const once = (target, name) => new Promise((resolve) => target.addEventListener(name, resolve, { once: true }));
function loaded(video) {
  return new Promise((resolve, reject) => {
    video.addEventListener('loadeddata', resolve, { once: true });
    video.addEventListener('error', () => reject(new Error('영상을 읽지 못함')), { once: true });
  });
}

// 탭이 보일 때까지 기다린다(가려진 탭에서는 크롬이 영상 재생 · 화면 그리기를 멈춰 빈 영상이 된다)
async function whenVisible() {
  while (document.hidden) await once(document, 'visibilitychange');
}

// blob(원본 영상) · range(분석 구간) → { blob, type, offset, width, height, seconds } · 못 만들면 예외
//  · 녹화하는 동안 탭이 가려졌거나 장면을 거의 못 담았으면, 탭이 다시 보일 때 처음부터 다시 한다(최대 TRIES 번)
export async function cutVideo(blob, range) {
  if (!canCut()) throw new Error('이 브라우저는 영상을 다시 만들지 못함');
  let last = null;
  for (let k = 0; k < TRIES; k++) {
    await whenVisible();
    const r = await cutOnce(blob, range);
    if (!r.hidden && enoughFrames(r.frames, r.seconds) && r.blob.size >= MIN_VIDEO_BYTES) return r;
    last = r;
    console.warn('[motion] 영상 구간을 다시 만든다', { hidden: r.hidden, frames: r.frames, bytes: r.blob.size });
  }
  throw new Error(`영상 장면을 담지 못함(담은 장면 ${last ? last.frames : 0}개 · 녹화 중 탭이 가려졌을 수 있음)`);
}

async function cutOnce(blob, range) {
  const url = URL.createObjectURL(blob);
  const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', src: url });
  // 화면에 붙여 두어야 어느 브라우저에서나 프레임을 풀어 준다(보이지는 않게)
  video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.append(video);
  try {
    await loaded(video);
    const span = cutRange(range, video.duration), seconds = span.end - span.start;
    const { width, height } = outputSize(video.videoWidth, video.videoHeight);
    const canvas = Object.assign(document.createElement('canvas'), { width, height }), ctx = canvas.getContext('2d');
    video.currentTime = span.start;
    await once(video, 'seeked');
    const mime = chooseMime((m) => MediaRecorder.isTypeSupported(m));
    const stream = canvas.captureStream(CUT.fps);
    const opts = { videoBitsPerSecond: bitrateFor(seconds) };
    const recorder = new MediaRecorder(stream, mime ? { ...opts, mimeType: mime } : opts);
    const chunks = [], samples = [];
    let frames = 0, hidden = false;
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = once(recorder, 'stop');
    recorder.start();
    ctx.drawImage(video, 0, 0, width, height);
    const t0 = performance.now();
    samples.push(span.start);
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; video.pause(); document.removeEventListener('visibilitychange', onHide); resolve(); } };
      const onHide = () => { if (document.hidden) { hidden = true; finish(); } };   // 가려지면 바로 멈추고 다시 한다
      document.addEventListener('visibilitychange', onHide);
      const draw = (mediaTime) => {
        ctx.drawImage(video, 0, 0, width, height);
        frames++;
        samples.push(mediaTime - (performance.now() - t0) / 1000);
        if (mediaTime >= span.end) finish();
      };
      if (typeof video.requestVideoFrameCallback === 'function') {
        const onFrame = (_, meta) => { if (done) return; draw(meta.mediaTime); if (!done) video.requestVideoFrameCallback(onFrame); };
        video.requestVideoFrameCallback(onFrame);
      } else {
        const tick = () => { if (done) return; draw(video.currentTime); if (!done) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
      video.addEventListener('ended', finish, { once: true });
      video.play().catch(finish);
      setTimeout(finish, (seconds + 5) * 1000);   // 재생이 멈춰 버려도 끝낸다
    });
    recorder.stop();
    await stopped;
    for (const t of stream.getTracks()) t.stop();
    const type = recorder.mimeType || mime || 'video/webm', out = new Blob(chunks, { type });
    return { blob: out, type, offset: offsetFrom(samples), width, height, seconds, frames, hidden };
  } finally {
    video.pause();
    video.removeAttribute('src'); video.load(); video.remove();
    URL.revokeObjectURL(url);
  }
}
