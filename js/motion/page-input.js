// 동작 분석 화면 — 영상 넣기: 파일 열기 · 구간 · 끌어다 놓기 · 주소 열기 · 화면 녹화
//  · app.js 에서 나눈 파일이다. 같은 모듈은 언제나 같은 ?v= 로 불러야 한 벌만 생긴다(상태가 둘로 갈리지 않게)
import { openChecks } from './framing.js?v=1';
import { estimateFps } from './pose.js?v=9';
import { track } from './usage.js?v=1';
import { videoSig } from './library.js?v=1';
import { startCapture, settleDuration, clock, MAX_CAPTURE_S, MIN_CAPTURE_S } from './capture.js?v=1';
import { parseLink } from './link.js?v=1';
import { MAX_RANGE_S, MIN_RANGE_S, $, el, state, sec, setStatus, options, renderLines } from './page.js?v=2';
import { fitCanvas, setRegion, analyze, clearResult } from './page-core.js?v=1';
import { findMoments_ } from './page-find.js?v=1';
import { finishLoad } from './page-records.js?v=2';

// ── 영상 · 구간 ─────────────────────────────────────────────
export const fileRef = (file) => ({ blob: file, name: file.name, size: file.size, sig: videoSig(file) });

// 영상 요소에 파일을 올린다(분석 상태는 건드리지 않는다)
export function showVideo(blob) {
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(blob);
  el.video.src = state.url;
  el.stageCard.hidden = false;
  el.attachWrap.hidden = true;
}

// 새 영상을 골랐다 — 앞의 분석은 지운다
export function openVideo(file) {
  if (!file) return;
  clearResult();
  state.clip = null; state.restore = null; state.still = null; state.autoRun = false;
  el.momentList.replaceChildren();
  setRegion(null);
  state.file = fileRef(file);
  showVideo(file);
  setStatus('영상을 여는 중…');
}

// 영상을 열 때 촬영 상태(초당 프레임 · 화질)를 점검해 알려 준다(framing.js). 숨긴 영상으로 재서 화면의 영상은 건드리지 않는다
export async function checkOpen() {
  const url = state.url, v = el.video;
  el.openChecks.replaceChildren();
  const probe = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', src: url });
  try {
    await new Promise((resolve, reject) => { probe.addEventListener('loadeddata', resolve, { once: true }); probe.addEventListener('error', reject, { once: true }); });
    const fps = await estimateFps(probe);
    if (url === state.url) renderLines(el.openChecks, openChecks({ fps: fps * options().slow, width: v.videoWidth, height: v.videoHeight }));
  } catch (err) {
    console.warn('[motion] 촬영 상태를 재지 못함', err);
  } finally {
    probe.removeAttribute('src'); probe.load();
  }
}

export function onVideoReady() {
  const v = el.video;
  // 방금 화면 녹화한 영상은 길이 정보가 비어 있다 → 길이를 알아낸 뒤 다시 들어온다
  if (v.duration === Infinity && v.videoWidth) { settleVideo(); return; }
  if (!Number.isFinite(v.duration) || !v.videoWidth) { setStatus('영상 길이를 읽지 못했어요. MP4 · MOV 파일로 다시 시도해 주세요.', true); return; }
  el.stage.style.setProperty('--ar', String(v.videoWidth / v.videoHeight));
  if (state.restore) { finishLoad(); return; }
  state.range = { start: 0, end: Math.min(v.duration, MAX_RANGE_S) };
  renderRange();
  fitCanvas();
  checkOpen();   // 초당 프레임 · 화질을 바로 알려 준다(기다리지 않는다)
  el.stageCard.scrollIntoView({ behavior: 'smooth', block: 'start' });   // 영상 카드가 화면 아래에 있어 열린 줄 모르는 일이 없게
  const runNow = state.autoRun && v.duration <= MAX_RANGE_S;
  state.autoRun = false;
  if (runNow) { analyze(); return; }
  // 분석 구간보다 긴 영상은 스윙 · 투구 순간을 먼저 찾아 본다
  if (v.duration > MAX_RANGE_S) { findMoments_(); return; }
  setStatus(v.duration > MAX_RANGE_S ? `영상이 길어요. 한 번의 동작만 들어가게 「여기부터」 · 「여기까지」로 구간을 잡아 주세요 (최대 ${MAX_RANGE_S}초).` : '구간을 확인하고 「분석 시작」을 눌러 주세요.');
}

export function renderRange() {
  el.rangeText.textContent = `분석 구간 ${sec(state.range.start)} ~ ${sec(state.range.end)}`;
}

// edge = 'start' | 'end' 를 지금 위치로 옮긴다. 구간은 MIN~MAX 길이를 지킨다
export function setRangeEdge(edge) {
  const t = el.video.currentTime, d = el.video.duration, r = state.range;
  if (edge === 'start') {
    r.start = Math.min(t, d - MIN_RANGE_S);
    r.end = Math.min(Math.max(r.end, r.start + MIN_RANGE_S), r.start + MAX_RANGE_S, d);
  } else {
    r.end = Math.max(t, MIN_RANGE_S);
    r.start = Math.max(Math.min(r.start, r.end - MIN_RANGE_S), r.end - MAX_RANGE_S, 0);
  }
  renderRange();
}


// 길이 정보가 없는 영상의 길이를 알아낸다. 그 사이 다른 영상을 열었으면 아무것도 하지 않는다
export async function settleVideo() {
  const url = state.url, found = await settleDuration(el.video);
  if (url !== state.url) return;
  if (found) onVideoReady(); else setStatus('영상 길이를 읽지 못했어요. 다시 녹화하거나 MP4 · MOV 파일로 시도해 주세요.', true);
}

// ── 화면 녹화로 가져오기 (capture.js) ────────────────────────
export const CAPTURE_TEXT = {
  idle: `① 주소를 붙여넣고 새 탭에서 연 다음, ② 를 눌러 그 탭을 고르세요. 장면을 재생하고 돌아와 「녹화 끝내기」를 누르면 돼요(최대 ${MAX_CAPTURE_S}초 · 영상은 이 기기 안에서만 처리).`,
  opened: '영상을 새 탭에 열었어요. 이 화면으로 돌아와 ② 를 누르고, 뜨는 창에서 그 탭을 골라 주세요.',
  badLink: '주소를 읽지 못했어요. https:// 로 시작하는 영상 주소를 붙여넣어 주세요.',
  blocked: '브라우저가 새 탭을 막았어요. 주소창 옆의 팝업 차단을 풀거나, 영상을 직접 다른 탭에 열어 주세요.',
  unsupported: '화면 녹화로 가져오기는 PC 의 크롬 · 엣지에서만 돼요. 휴대폰에서는 화면 녹화 기능으로 찍은 영상 파일을 골라 주세요.',
  recording: '녹화 중이에요. 고른 탭에서 장면을 재생한 뒤 돌아와 「녹화 끝내기」를 눌러 주세요. 영상을 크게(전체 화면) 틀수록 정확해요.',
  cancelled: '녹화를 취소했어요.',
  failed: '화면 녹화를 시작하지 못했어요. 브라우저의 화면 공유 권한을 확인해 주세요.',
  empty: '녹화된 장면이 없어요. 다시 시도해 주세요.',
  busy: '분석이 끝난 뒤에 녹화할 수 있어요.',
};
export const CAPTURE_LABEL = '② 화면 녹화로 가져오기';

// ① 붙여넣은 주소의 영상을 새 탭에 연다(유튜브는 주소에 든 시작 시간부터). 화면을 받는 것은 ② 화면 녹화가 한다
export function openLink() {
  track('motion_link_open');
  const link = parseLink(el.linkUrl.value);
  if (!link) { el.captureMsg.textContent = CAPTURE_TEXT.badLink; return; }
  const tab = window.open(link.url, '_blank');
  if (!tab) { el.captureMsg.textContent = CAPTURE_TEXT.blocked; return; }
  tab.opener = null;
  el.capture.classList.add('next');
  el.captureMsg.textContent = CAPTURE_TEXT.opened;
}

export function resetCapture(message) {
  state.capture = null;
  el.capture.textContent = CAPTURE_LABEL;
  el.capture.classList.remove('recording', 'next');
  el.captureMsg.textContent = message;
}

export function onCaptured(file, seconds) {
  track('motion_video_open', { source: 'capture' });
  if (seconds < MIN_CAPTURE_S) { resetCapture(CAPTURE_TEXT.empty); return; }
  resetCapture(`녹화한 ${clock(seconds)} 길이의 영상을 열었어요. 선수가 작게 나오면 「선수 고르기」로 감싸 주세요.`);
  openVideo(file);
}

// 버튼 하나로 시작 · 끝내기를 한다
export async function toggleCapture() {
  if (state.capture) { state.capture.stop(); return; }
  if (state.busy) { el.captureMsg.textContent = CAPTURE_TEXT.busy; return; }
  try {
    state.capture = await startCapture({
      onTick: (s) => { el.capture.textContent = `■ 녹화 끝내기 (${clock(s)})`; },
      onDone: onCaptured,
      onFail: () => resetCapture(CAPTURE_TEXT.empty),
    });
    el.capture.textContent = '■ 녹화 끝내기 (0:00)';
    el.capture.classList.add('recording');
    el.captureMsg.textContent = CAPTURE_TEXT.recording;
  } catch (err) {
    if (err && err.name !== 'NotAllowedError') console.warn('[motion] 화면 녹화를 시작하지 못함', err);
    resetCapture(err && err.name === 'NotAllowedError' ? CAPTURE_TEXT.cancelled : CAPTURE_TEXT.failed);
  }
}

// 끌어다 놓은 영상을 연다. 분석 중에는 받지 않는다
export function onDropFile(file) {
  track('motion_video_open', { source: 'drop' });
  if (state.busy) { el.dropMsg.textContent = '분석이 끝난 뒤에 다른 영상을 열 수 있어요.'; return; }
  el.dropMsg.textContent = `「${file.name}」을 열었어요.`;
  openVideo(file);
  state.autoRun = true;   // 12초 이하면 영상이 준비되는 대로 분석까지 한다(onVideoReady)
}
