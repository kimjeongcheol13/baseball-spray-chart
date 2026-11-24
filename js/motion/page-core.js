// 동작 분석 화면 — 재생 · 프레임 · 그리기 · 선수 고르기 · 분석 · 다시 계산
//  · app.js 에서 나눈 파일이다. 같은 모듈은 언제나 같은 ?v= 로 불러야 한 벌만 생긴다(상태가 둘로 갈리지 않게)
import { track } from './usage.js?v=1';
import { analyzeMotion } from './analyze.js?v=5';
import { estimateSpread } from './spread.js?v=2';
import { loadLandmarker, estimateFps, samplePoses } from './pose.js?v=9';
import { drawOverlay, hudSideFor, COLOR } from './overlay.js?v=7';
import { formatValue, sequenceText, FAIL_TEXT } from './metrics.js?v=2';
import { loopRange, nearestPose, pickRegion } from './view.js?v=3';
import { dropStrays } from './track.js?v=3';
import { NO_WRAPPED_TEXT, ROLE_TEXT, DOWNLOAD_MB, $, el, ctx, mirror, state, sec, options, setStatus, setBusy } from './page.js?v=3';
import { renderRange } from './page-input.js?v=2';
import { renderResult } from './page-results.js?v=1';
import { MB } from './page-records.js?v=6';

// ── 재생 · 프레임 ───────────────────────────────────────────
// 지금 영상 위치에 해당하는 프레임 번호. 분석 구간 밖이면 null
export function currentIndex() {
  const c = state.clip;
  if (!c) return null;
  if (!el.video.videoWidth) return state.still;   // 영상 없이 불러온 기록: 고른 프레임을 그대로 보여 준다
  const i = Math.floor((el.video.currentTime - c.start) * c.hz);
  return i >= 0 && i < c.frames.length ? i : null;
}

export function seekToFrame(i) {
  const c = state.clip;
  if (c && !el.video.videoWidth) { state.still = i; tick(); return; }
  if (c && i !== null) el.video.currentTime = c.start + (i + 0.5) / c.hz;
}

export function stepFrame(dir) {
  const hz = state.clip ? state.clip.hz : 30;
  el.video.pause();
  el.video.currentTime = Math.max(0, Math.min(el.video.duration, el.video.currentTime + dir / hz));
}

export function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  el.overlay.width = Math.round(el.stage.clientWidth * dpr);
  el.overlay.height = Math.round(el.stage.clientHeight * dpr);
  draw();
}

// 요약 패널을 놓을 쪽(선수 반대편). 같은 분석에서는 한 번만 구한다
export function hudSide() {
  if (!state.clip) return 'right';
  if (!state.clip.hudSide) state.clip.hudSide = hudSideFor(state.clip.frames);
  return state.clip.hudSide;
}

export function hudOf(result) {
  const m = result.metrics;
  return {
    title: `${ROLE_TEXT[result.mode]} 분석${result.quality.level === 'low' ? ' · 신뢰도 낮음' : ''}`,
    rows: [
      { label: '골반 피크', value: formatValue(m.pelvisPeak), unit: '°/s', color: COLOR.pelvis },
      { label: '몸통 피크', value: formatValue(m.trunkPeak), unit: '°/s', color: COLOR.trunk },
      { label: '최대 분리각', value: formatValue(m.maxSeparation), unit: '°' },
    ],
    footer: `순서 ${sequenceText(m.sequence.order)}`,
    side: hudSide(),
  };
}

export function overlayScene() {
  const i = currentIndex();
  const frame = state.busy ? state.liveFrame : i === null ? null : state.clip.frames[i];
  return { frame, missing: !!frame && !frame.world, hand: state.result ? state.result.hand : options().hand, hud: state.result && !state.busy ? hudOf(state.result) : null };
}

export function draw() {
  if (!el.overlay.width) return;
  drawOverlay(ctx, el.overlay.width, el.overlay.height, overlayScene());
  drawPick();
}

// 분석할 선수 영역(또는 끌고 있는 네모)을 점선으로 보여 준다
export function drawPick() {
  const w = el.overlay.width, h = el.overlay.height, box = state.drag ? pickRegion(state.drag.a, state.drag.b, w / h, 0) : state.region;
  // 분석이 끝난 뒤에는 고른 자리의 네모를 그리지 않는다(선수와 선을 가린다). 다시 고르는 중에는 보여 준다
  if (!box || (state.result && !state.picking && !state.drag)) return;
  const u = Math.max(1, Math.min(w, h) / 360);
  ctx.save();
  ctx.setLineDash([7 * u, 5 * u]);
  for (const [color, width] of [[COLOR.casing, 4 * u], [COLOR.ink, 2 * u]]) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.strokeRect(box.x * w, box.y * h, box.w * w, box.h * h); }
  ctx.restore();
}

// ── 분석할 선수 고르기 ───────────────────────────────────────
export function setRegion(region) {
  state.region = region; state.drag = null;
  setPicking(false);
  el.pickClear.hidden = !region;
  el.pickText.textContent = region ? '네모 안의 선수만 분석해요.' : '여러 사람이 나오는 영상이면 분석할 선수를 골라 주세요. 고르지 않으면 가장 크게 찍힌 사람을 분석해요.';
  draw();
}

export function setPicking(on) {
  state.picking = on;
  el.stage.classList.toggle('picking', on);
  el.pick.textContent = on ? '고르기 취소' : state.region ? '선수 다시 고르기' : '선수 고르기';
}

export function startPicking() {
  if (state.picking) { state.drag = null; setPicking(false); draw(); return; }
  el.video.pause();
  setPicking(true);
  setStatus('영상에서 분석할 선수를 눌러 주세요. 끌어서 네모로 감싸면 더 정확해요.');
}

// 누른 자리를 영상 기준 비율(0~1)로
export function stagePoint(e) {
  const r = el.overlay.getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
}

export function onPickDown(e) {
  if (!state.picking) return;
  el.overlay.setPointerCapture(e.pointerId);
  state.drag = { a: stagePoint(e), b: stagePoint(e) };
  draw();
}

export function onPickMove(e) {
  if (!state.drag) return;
  state.drag.b = stagePoint(e);
  draw();
}

export function onPickUp(e) {
  if (!state.drag) return;
  const { a } = state.drag, b = stagePoint(e), v = el.video;
  setRegion(pickRegion(a, b, v.videoWidth / v.videoHeight));
  setStatus(state.clip ? '선수를 골랐어요. 「분석 시작」을 다시 눌러 주세요.' : '선수를 골랐어요. 구간을 확인하고 「분석 시작」을 눌러 주세요.');
}

// 영상 위치가 바뀔 때마다: 그림 · 위치 막대 · 시각 · 그래프의 재생선
export function tick() {
  const v = el.video;
  draw();
  if (Number.isFinite(v.duration) && v.duration > 0) el.seek.value = String(v.currentTime / v.duration);
  el.time.textContent = sec(v.currentTime);
  if (state.chart) state.chart.setCursor(currentIndex());
  if (state.loop && v.currentTime >= state.loop.to) v.currentTime = state.loop.from;   // 동작 재생: 구간 끝에서 처음으로
  sync3d();
  drawMirror();
}

// 3D 뷰어에 지금 영상 위치의 프레임을 넘긴다. 분석 구간 밖이면 마지막 프레임을 그대로 둔다
export function sync3d() {
  const i = currentIndex();
  if (!state.view3d || !state.result || i === null) return;
  const k = nearestPose(state.clip.frames, i);
  state.view3d.setFrame(state.clip.frames[k === null ? i : k], state.result.hand);
  el.view3dNote.textContent = k === null || k === i ? '' : `이 프레임은 사람을 못 찾아 가장 가까운 프레임(${k > i ? '+' : ''}${k - i})을 보여 줘요`;
}

// 「영상 + 선」 화면: 지금 영상 프레임에서 선수 주변만 잘라 크게 그리고, 그 위에 같은 프레임의 선을 겹친다(mirror.js)
export function drawMirror() {
  const clip = state.clip, i = currentIndex();
  if (state.result && clip) mirror.draw(el.video, i === null ? null : clip.frames[i], state.result.hand);
}

// 동작 재생: 준비 동작부터 마무리까지를 고른 속도로 되풀이한다. 다시 누르면 멈춘다
export function toggleMotion() {
  const c = state.clip, v = el.video;
  if (!state.result || !c) return;
  if (state.loop && !v.paused) { v.pause(); return; }
  const r = loopRange(state.result, c.frames.length);
  state.loop = { from: c.start + r.from / c.hz, to: c.start + (r.to + 1) / c.hz };
  v.currentTime = state.loop.from;
  v.playbackRate = Number(el.motionRate.value);
  el.rate.value = el.motionRate.value;
  v.play().catch((e) => { console.warn('[motion] 동작 재생 실패', e); state.loop = null; setStatus('영상을 재생하지 못했어요.', true); });
}

export const renderMotionButton = () => { el.motion.textContent = state.loop && !el.video.paused ? '■ 멈춤' : '▶ 동작 재생'; };

export function playLoop() {
  if (el.video.paused || el.video.ended) return;
  tick();
  requestAnimationFrame(playLoop);
}

export function togglePlay() {
  if (!el.video.paused) { el.video.pause(); return; }
  el.video.play().catch((e) => { console.warn('[motion] 재생 실패', e); setStatus('영상을 재생하지 못했어요.', true); });
}

// ── 분석 ───────────────────────────────────────────────────
export async function analyze() {
  if (state.busy || !el.video.videoWidth) return;
  const opt = options(), range = { ...state.range };
  clearResult();
  setBusy(true);
  try {
    setStatus(`분석 엔진을 불러오는 중… (처음 한 번만 받아요 · 약 ${DOWNLOAD_MB[opt.model]}MB)`);
    const landmarker = await loadLandmarker(opt.model);
    const hz = await estimateFps(el.video);
    setStatus('동작을 읽는 중…');
    state.readStart = performance.now();
    const sampled = await samplePoses(el.video, landmarker, { start: range.start, end: range.end, hz, region: state.region, onProgress, onRetry: () => setStatus('네모 안의 다른 사람이 잡혔어요. 감싼 선수를 다시 찾는 중…'), shouldStop: () => state.stopping });
    if (sampled.stopped) { setStatus('분석을 중단했어요.'); return; }
    // 구간 안에서 화면이 바뀌었으면 가장 긴 장면만 남기고, 구간 표시도 그 장면으로 줄인다
    const shot = sampled.shot || { from: 0, to: sampled.frames.length - 1 }, shotFrames = sampled.frames.slice(shot.from, shot.to + 1);
    if (sampled.cuts) { state.range = { start: range.start + shot.from / hz, end: range.start + (shot.to + 1) / hz }; renderRange(); }
    const aspect = el.video.videoWidth / el.video.videoHeight, kept = dropStrays(shotFrames, aspect);
    state.clip = { frames: kept.frames, start: range.start + shot.from / hz, hz, aspect, missing: kept.frames.filter((f) => !f.world).length, strays: kept.dropped, others: sampled.others || 0, cuts: sampled.cuts || 0 };
  } catch (e) {
    console.error('[motion] 분석 실패', e);
    setStatus('분석 엔진을 불러오거나 실행하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.', true);
    return;
  } finally {
    setBusy(false);
  }
  compute(null);
  if (state.result) track('motion_analyze', { mode: state.result.mode, quality: state.result.quality.level, picked: Boolean(state.region), fps: Math.round(state.result.fps) });
}

export function onProgress(done, total, frame) {
  state.liveFrame = frame;
  el.progress.value = done / total;
  const left = Math.round(((performance.now() - state.readStart) / done) * (total - done) / 1000);
  setStatus(`동작을 읽는 중… ${done} / ${total} 프레임${done >= 5 ? ` · 약 ${left}초 남음` : ''}`);
  draw();
}

// 뽑아 둔 포즈로 지표를 계산해 화면에 올린다. eventIndex = 임팩트 · 릴리스를 직접 정한 프레임(null 이면 자동)
export function compute(eventIndex) {
  const c = state.clip, opt = options();
  if (!c) return;
  const input = { frames: c.frames, mode: opt.mode, hand: opt.hand, fps: c.hz * opt.slow, aspect: c.aspect, eventIndex }, result = analyzeMotion(input);
  if (!result.ok) {
    clearResult();
    // 네모 안에 사람은 있었지만 감싼 선수는 아니었던 경우: 다른 사람을 대신 분석하지 않고 그렇게 알린다
    const wrongPerson = result.reason === 'noPose' && state.region && state.clip.others > 0;
    setStatus(wrongPerson ? NO_WRAPPED_TEXT : FAIL_TEXT[result.reason] || '분석하지 못했어요.', true);
    return;
  }
  state.result = result;
  state.spread = estimateSpread(input, result);   // 숫자마다 흔들림 폭(±) — 화면 · 문장 · 저장에 함께 쓴다
  const strays = c.strays ? ` · 선수와 떨어진 곳에 잡힌 ${c.strays}프레임은 뺐어요` : '';
  // 선수를 고르지 않고 분석하면 화면에서 가장 크게 보이는 사람이 잡힌다 → 다른 사람이 잡혔을 때 할 일을 알려 준다
  const who = state.region ? (c.others ? ` · 네모 안의 다른 사람이 잡힌 ${c.others}프레임은 뺐어요` : '') : ' · 다른 사람이 분석됐으면 「선수 고르기」로 감싼 뒤 다시 분석해 주세요';
  // 구간 안에서 화면이 바뀌었으면(카메라 전환) 가장 긴 장면만 분석했다고 알린다
  const cut = c.cuts ? ` · 구간 안에서 화면이 ${c.cuts}번 바뀌어 가장 긴 장면만 분석했어요(구간도 그 장면으로 줄였어요)` : '';
  setStatus(`분석 끝 · ${c.frames.length} 프레임 중 ${c.frames.length - c.missing}프레임에서 선수를 찾았어요${strays}${who}${cut}`);
  renderResult();
  seekToFrame(result.events.main);
}

export function clearResult() {
  state.result = null; state.spread = null;
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  if (state.view3d) { state.view3d.destroy(); state.view3d = null; }
  state.loop = null;
  el.view3dNote.textContent = '';
  el.results.hidden = true;
  el.saveMsg.textContent = '';
  draw();
}
