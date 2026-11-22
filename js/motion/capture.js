// 동작 분석 — 화면 녹화로 영상 가져오기 (유튜브처럼 파일이 없는 영상용)
//  · 주소만으로 영상을 받아 오려면 서버가 필요하고 서비스 약관에도 걸린다. 그래서 사용자가 다른 탭에서 튼 영상을
//    브라우저의 화면 공유로 받아 이 기기 안에서 녹화하고, 그 파일을 평소처럼 연다. 녹화한 영상은 기기 밖으로 나가지 않는다
//  · PC 크롬 · 엣지처럼 getDisplayMedia + MediaRecorder 가 있는 브라우저에서만 된다(휴대폰 브라우저에는 없다)

export const MAX_CAPTURE_S = 60;   // 이 시간이 지나면 저절로 끝낸다(파일이 너무 커지지 않게)
export const MIN_CAPTURE_S = 1;    // 이보다 짧으면 분석할 장면이 없다고 본다
const BITRATE = 8_000_000, TICK_MS = 250, SLICE_MS = 1000, SETTLE_MS = 8000, FAR = 1e101;
// 녹화 형식: 길이 정보를 뒤에서 채우는 방법이 잘 알려진 WebM 을 먼저 쓴다
const MIME_ORDER = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];

export const canCapture = (nav = navigator, win = window) => Boolean(nav.mediaDevices && nav.mediaDevices.getDisplayMedia && win.MediaRecorder);

// 브라우저가 지원하는 첫 형식 → '' 이면 브라우저 기본값에 맡긴다
export const chooseMime = (isSupported) => MIME_ORDER.find((m) => isSupported(m)) || '';

const two = (n) => String(n).padStart(2, '0');
// 녹화 파일 이름: 화면녹화-20261122-153045.webm
export function captureName(date, mime) {
  const day = `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`, time = `${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
  return `화면녹화-${day}-${time}.${(mime || '').startsWith('video/mp4') ? 'mp4' : 'webm'}`;
}

// 초 → '0:07'
export const clock = (seconds) => `${Math.floor(seconds / 60)}:${two(Math.floor(seconds % 60))}`;

// 화면 공유를 받아 녹화를 시작한다 → { stop() }
//  · 사용자가 공유 창에서 취소하면 예외(NotAllowedError)를 던진다
//  · 끝나면 onDone(file, 초). 「공유 중지」를 누르거나 MAX_CAPTURE_S 가 지나도 끝난다. 녹화된 것이 없으면 onFail()
export async function startCapture({ onTick, onDone, onFail }) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 60, max: 60 } }, audio: false });
  const mime = chooseMime((m) => MediaRecorder.isTypeSupported(m));
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: BITRATE } : { videoBitsPerSecond: BITRATE });
  const chunks = [], started = performance.now(), elapsed = () => (performance.now() - started) / 1000;
  let finished = false;

  const timer = setInterval(() => { if (elapsed() >= MAX_CAPTURE_S) stop(); else if (onTick) onTick(elapsed()); }, TICK_MS);
  function stop() {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    if (recorder.state !== 'inactive') recorder.stop(); else finish();
  }
  function finish() {
    const seconds = elapsed(), type = recorder.mimeType || mime || 'video/webm', blob = new Blob(chunks, { type });
    for (const track of stream.getTracks()) track.stop();
    if (!blob.size) { if (onFail) onFail(); return; }
    onDone(new File([blob], captureName(new Date(), type), { type }), seconds);
  }
  recorder.addEventListener('dataavailable', (e) => { if (e.data && e.data.size) chunks.push(e.data); });
  recorder.addEventListener('stop', finish);
  recorder.addEventListener('error', stop);
  for (const track of stream.getVideoTracks()) track.addEventListener('ended', stop);
  recorder.start(SLICE_MS);
  return { stop };
}

// 방금 녹화한 영상은 길이 정보가 비어 있다(duration 이 무한대). 끝으로 한 번 보내 브라우저가 길이를 알아내게 한다
//  → 길이를 알아냈으면 true (재생 위치는 처음으로 돌려놓는다) · 시간 안에 못 알아냈으면 false
export function settleDuration(video) {
  return new Promise((resolve) => {
    if (Number.isFinite(video.duration)) { resolve(true); return; }
    const events = ['durationchange', 'timeupdate', 'seeked'];
    const end = (found) => {
      for (const name of events) video.removeEventListener(name, check);
      clearTimeout(timer);
      if (found) video.currentTime = 0;
      resolve(found);
    };
    const check = () => { if (Number.isFinite(video.duration)) end(true); };
    const timer = setTimeout(() => end(false), SETTLE_MS);
    for (const name of events) video.addEventListener(name, check);
    video.currentTime = FAR;
  });
}
