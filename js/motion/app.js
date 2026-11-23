// 동작 분석 화면 (motion.html) — 영상 고르기 → 구간 정하기 → 포즈 뽑기 → 지표 · 그래프 · 저장
//  · 계산은 analyze.js, 엔진은 pose.js, 그림은 overlay.js · chart.js, 저장은 store.js 가 한다
//  · 화면 연결은 영역별로 나눴다: page.js(공통 상태) · page-input.js(영상 넣기) · page-core.js(재생 · 분석) · page-find.js(순간 찾기)
//    · page-results.js(결과) · page-records.js(기록 · 비교 · 추이). 여기는 버튼을 잇고 시작만 한다
//  · 모듈 파일을 고치면 그 파일을 부르는 import 의 ?v= 와 motion.html 의 app.js?v= 를 함께 올린다
import { startSync } from './page-sync.js?v=1';
import { startUsage, track } from './usage.js?v=1';
import { attachDrop } from './drop.js?v=1';
import { canCapture } from './capture.js?v=1';
import { VIEWS, el, state, setStatus } from './page.js?v=1';
import { openVideo, onVideoReady, setRangeEdge, CAPTURE_TEXT, openLink, toggleCapture, onDropFile } from './page-input.js?v=1';
import { currentIndex, seekToFrame, stepFrame, fitCanvas, draw, setRegion, startPicking, onPickDown, onPickMove, onPickUp, tick, toggleMotion, renderMotionButton, playLoop, togglePlay, analyze, compute } from './page-core.js?v=1';
import { setView3d } from './page-results.js?v=1';
import { findMoments_ } from './page-find.js?v=1';
import { save, attachVideo, toggleDuel, renderLog, drawTrendNow, saveImage } from './page-records.js?v=1';

// ── 연결 ───────────────────────────────────────────────────
function bind() {
  el.file.addEventListener('change', () => { track('motion_video_open', { source: 'file' }); openVideo(el.file.files[0]); });
  el.linkBox.hidden = !canCapture();
  el.link.addEventListener('click', openLink);
  el.trendGroup.addEventListener('change', () => { track('motion_trend'); drawTrendNow(); });
  el.trendMetric.addEventListener('change', () => { track('motion_trend'); drawTrendNow(); });
  el.linkUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); openLink(); } });
  el.captureMsg.textContent = canCapture() ? CAPTURE_TEXT.idle : CAPTURE_TEXT.unsupported;
  el.capture.addEventListener('click', toggleCapture);
  attachDrop(document, {
    onFile: onDropFile,
    onReject: () => { el.dropMsg.textContent = '영상 파일(MP4 · MOV 등)만 열 수 있어요.'; },
    onHover: (on) => { el.dropHint.hidden = !on; },
  });
  el.setup.addEventListener('submit', (e) => e.preventDefault());
  // 동작 · 방향 · 촬영 속도를 바꾸면 뽑아 둔 포즈로 바로 다시 계산한다(엔진을 다시 돌리지 않는다)
  // 동작 · 방향 · 촬영 속도를 바꾸면 다시 계산한다. 이름 없는 칸(주소 입력)과 파일 · 모델 고르기는 계산과 무관하다
  el.setup.addEventListener('change', (e) => { if (e.target !== el.file && e.target.name && e.target.name !== 'model' && state.clip) compute(null); else draw(); });
  el.video.addEventListener('loadedmetadata', onVideoReady);
  el.video.addEventListener('error', () => setStatus('이 영상은 열 수 없어요. MP4 · MOV 파일로 다시 시도해 주세요.', true));
  el.video.addEventListener('play', () => { el.play.textContent = '멈춤'; renderMotionButton(); playLoop(); });
  el.video.addEventListener('pause', () => { el.play.textContent = '재생'; state.loop = null; renderMotionButton(); tick(); });
  el.video.addEventListener('seeked', () => { if (!state.busy) tick(); });
  el.play.addEventListener('click', togglePlay);
  el.prev.addEventListener('click', () => stepFrame(-1));
  el.next.addEventListener('click', () => stepFrame(1));
  el.seek.addEventListener('input', () => { el.video.currentTime = Number(el.seek.value) * el.video.duration; });
  el.rate.addEventListener('change', () => { el.video.playbackRate = Number(el.rate.value); });
  el.start.addEventListener('click', () => setRangeEdge('start'));
  el.find.addEventListener('click', findMoments_);
  el.end.addEventListener('click', () => setRangeEdge('end'));
  el.analyze.addEventListener('click', analyze);
  el.stop.addEventListener('click', () => { state.stopping = true; });
  el.goPlant.addEventListener('click', () => seekToFrame(state.result.events.plant));
  el.goMain.addEventListener('click', () => seekToFrame(state.result.events.main));
  el.setMain.addEventListener('click', () => { const i = currentIndex(); if (i === null) setStatus('분석 구간 안의 프레임에서 눌러 주세요.', true); else compute(i); });
  el.autoMain.addEventListener('click', () => compute(null));
  el.motion.addEventListener('click', toggleMotion);
  el.motionRate.addEventListener('change', () => { if (state.loop) { el.video.playbackRate = Number(el.motionRate.value); el.rate.value = el.motionRate.value; } });
  el.save.addEventListener('click', save);
  el.attach.addEventListener('change', () => attachVideo(el.attach.files[0]));
  el.pick.addEventListener('click', startPicking);
  el.pickClear.addEventListener('click', () => { setRegion(null); setStatus(state.clip ? '화면 전체에서 찾도록 되돌렸어요. 「분석 시작」을 다시 눌러 주세요.' : '화면 전체에서 가장 크게 찍힌 사람을 분석해요.'); });
  el.overlay.addEventListener('pointerdown', onPickDown);
  el.overlay.addEventListener('pointermove', onPickMove);
  el.overlay.addEventListener('pointerup', onPickUp);
  el.overlay.addEventListener('pointercancel', () => { state.drag = null; draw(); });
  el.duelPlay.addEventListener('click', toggleDuel);
  el.duelRate.addEventListener('change', () => { if (state.duel) state.duel.setRate(Number(el.duelRate.value)); });
  for (const b of document.querySelectorAll('[data-duel-view]')) b.addEventListener('click', () => { if (state.duel) state.duel.setView(VIEWS[b.dataset.duelView][0], VIEWS[b.dataset.duelView][1]); });
  el.image.addEventListener('click', saveImage);
  for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => setView3d(b.dataset.view));
  new ResizeObserver(fitCanvas).observe(el.stage);
  // 추이 그래프는 보이는 폭 그대로 그리므로 폭이 바뀌면 다시 그린다
  let trendWidth = 0;
  new ResizeObserver(() => { const w = el.trendChart.clientWidth; if (w && w !== trendWidth && !el.trendBox.hidden) { trendWidth = w; drawTrendNow(); } }).observe(el.trendChart);
}

startUsage();
bind();
renderLog();
startSync();   // 로그인했으면 다른 기기와 기록을 맞춘다(page-sync.js)
