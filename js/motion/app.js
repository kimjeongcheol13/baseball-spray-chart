// 동작 분석 화면 (motion.html) — 영상 고르기 → 구간 정하기 → 포즈 뽑기 → 지표 · 그래프 · 저장
//  · 계산은 analyze.js, 엔진은 pose.js, 그림은 overlay.js · chart.js, 저장은 store.js 가 한다. 여기는 화면과 그 사이를 잇기만 한다
//  · 모듈 파일을 고치면 그 파일을 부르는 import 의 ?v= 와 motion.html 의 app.js?v= 를 함께 올린다
import { analyzeMotion } from './analyze.js?v=3';
import { loadLandmarker, estimateFps, samplePoses } from './pose.js?v=5';
import { drawOverlay, COLOR } from './overlay.js?v=6';
import { createChart } from './chart.js?v=6';
import { createSkeleton3D } from './skeleton3d.js?v=4';
import { metricList, eventName, formatValue, sequenceText, summarize, QUALITY_TEXT, noteText, FAIL_TEXT } from './metrics.js?v=2';
import { loadLog, addEntry, removeEntry, updateEntry } from './store.js?v=3';
import { packFrames, unpackFrames, videoSig, orphanKeys, compareRows } from './library.js?v=1';
import { putClip, getClip, deleteClip, clipIds, putVideo, getVideo, deleteVideo, videoSigs, freeBytes } from './db.js?v=1';
import { loopRange, nearestPose, pickRegion } from './view.js?v=3';
import { createDuel } from './duel.js?v=3';
import { createMirror } from './mirror.js?v=1';
import { dropStrays } from './track.js?v=1';

const MAX_RANGE_S = 12;
// 3D 보기 방향: [yaw, pitch, 설명]
const VIEWS = {
  front: [0, 0, '카메라에서 본 모습이에요. 영상과 같은 방향이에요.'],
  side: [90, 0, '옆에서 본 모습이에요. 깊이는 추정이라 가장 부정확한 방향이에요.'],
  top: [0, 90, '위에서 내려다본 모습이에요. 파란 골반선과 빨간 어깨선이 벌어진 각이 분리각이에요.'],
};
const MIN_RANGE_S = 0.3;
const EXPORT_MAX_WIDTH = 1280;
const MODE_TEXT = { bat: '타격', pitch: '투구' };
const ROLE_TEXT = { bat: '타자', pitch: '투수' };
// 저장 목록을 나누는 묶음(이 순서로 보여 준다)
const GROUPS = [['bat', '타자 (타격)'], ['pitch', '투수 (투구)']];
const DOWNLOAD_MB = { lite: 20, full: 24, heavy: 45 };   // 엔진(WASM 약 15MB) + 모델
const HAND_TEXT = { R: '우', L: '좌' };
// 타자는 우타 · 좌타, 투수는 우투 · 좌투
const sideText = (mode, hand) => HAND_TEXT[hand] + (mode === 'pitch' ? '투' : '타');
const TILE_COLOR = { pelvisPeak: COLOR.pelvis, trunkPeak: COLOR.trunk };

const $ = (id) => document.getElementById(id);
const el = {
  setup: $('setup'), file: $('file'), stageCard: $('stageCard'), stage: $('stage'), video: $('video'), overlay: $('overlay'),
  transport: $('transport'), play: $('btnPlay'), prev: $('btnPrev'), next: $('btnNext'), seek: $('seek'), time: $('timeOut'), rate: $('rate'),
  rangeRow: $('rangeRow'), rangeText: $('rangeText'), start: $('btnStart'), end: $('btnEnd'),
  analyze: $('btnAnalyze'), stop: $('btnStop'), progress: $('progress'), status: $('status'),
  results: $('results'), title: $('resultTitle'), quality: $('quality'), notes: $('notes'), tiles: $('tiles'), chart: $('chart'), view3d: $('view3d'), view3dNote: $('view3dNote'), view3dCap: $('view3dCap'), viewVideo: $('viewVideo'), motion: $('btnMotion'), motionRate: $('motionRate'),
  goPlant: $('btnGoPlant'), goMain: $('btnGoMain'), setMain: $('btnSetMain'), autoMain: $('btnAutoMain'),
  save: $('btnSave'), image: $('btnImage'), saveMsg: $('saveMsg'), logList: $('logList'), logEmpty: $('logEmpty'),
  player: $('playerName'), logMsg: $('logMsg'), attachWrap: $('attachWrap'), attach: $('fileAttach'), compareBox: $('compareBox'), compare: $('compare'), pickRow: $('pickRow'), pick: $('btnPick'), pickClear: $('btnPickClear'), pickText: $('pickText'),
  duelBox: $('duelBox'), duelNone: $('duelNone'), duelPlay: $('btnDuel'), duelRate: $('duelRate'), duelTime: $('duelTime'), duelA: $('duelA'), duelB: $('duelB'), duelVideoA: $('duelVideoA'), duelVideoB: $('duelVideoB'), duelVideos: $('duelVideos'), duelNameA: $('duelNameA'), duelNameB: $('duelNameB'),
};
const ctx = el.overlay.getContext('2d');
const mirror = createMirror($('viewVideo'));   // 동작 다시 보기의 「영상 + 선」 화면

// clip = 뽑아 둔 포즈 { frames, start, hz, aspect(영상 가로/세로), missing(사람을 못 찾은 장 수), strays(엉뚱한 곳에 잡혀 뺀 장 수) }
// region = 분석할 선수 영역(화면 비율 네모 · 없으면 화면 전체) · picking = 선수를 고르는 중 · drag = 끌고 있는 네모의 두 점
// file = 지금 영상 { blob, name, size, sig } · restore = 불러오는 중인 기록 { range, eventIndex } · still = 영상 없이 볼 때 고른 프레임 · compare = 비교할 기록 id 들 · result = analyzeMotion 결과 · liveFrame = 분석 도중 방금 읽은 프레임
const state = { url: null, range: { start: 0, end: 0 }, clip: null, result: null, chart: null, view3d: null, busy: false, stopping: false, liveFrame: null, readStart: 0, loop: null, file: null, restore: null, still: null, compare: [], duel: null, duelToken: 0, region: null, picking: false, drag: null };

function node(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const sec = (t) => `${t.toFixed(2)}초`;

function options() {
  const f = new FormData(el.setup);
  return { mode: f.get('mode'), hand: f.get('hand'), slow: Number(f.get('slow')), model: f.get('model') };
}

function setStatus(text, bad = false) {
  el.status.textContent = text;
  el.status.classList.toggle('bad', bad);
}

function setBusy(busy) {
  state.busy = busy;
  state.stopping = false;
  for (const part of [el.setup, el.transport, el.rangeRow, el.pickRow]) part.inert = busy;
  el.analyze.disabled = busy;
  el.stop.hidden = el.progress.hidden = !busy;
  if (!busy) state.liveFrame = null;
}

// ── 영상 · 구간 ─────────────────────────────────────────────
const fileRef = (file) => ({ blob: file, name: file.name, size: file.size, sig: videoSig(file) });

// 영상 요소에 파일을 올린다(분석 상태는 건드리지 않는다)
function showVideo(blob) {
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(blob);
  el.video.src = state.url;
  el.stageCard.hidden = false;
  el.attachWrap.hidden = true;
}

// 새 영상을 골랐다 — 앞의 분석은 지운다
function openVideo(file) {
  if (!file) return;
  clearResult();
  state.clip = null; state.restore = null; state.still = null;
  setRegion(null);
  state.file = fileRef(file);
  showVideo(file);
  setStatus('영상을 여는 중…');
}

function onVideoReady() {
  const v = el.video;
  if (!Number.isFinite(v.duration) || !v.videoWidth) { setStatus('영상 길이를 읽지 못했어요. MP4 · MOV 파일로 다시 시도해 주세요.', true); return; }
  el.stage.style.setProperty('--ar', String(v.videoWidth / v.videoHeight));
  if (state.restore) { finishLoad(); return; }
  state.range = { start: 0, end: Math.min(v.duration, MAX_RANGE_S) };
  renderRange();
  fitCanvas();
  setStatus(v.duration > MAX_RANGE_S ? `영상이 길어요. 한 번의 동작만 들어가게 「여기부터」 · 「여기까지」로 구간을 잡아 주세요 (최대 ${MAX_RANGE_S}초).` : '구간을 확인하고 「분석 시작」을 눌러 주세요.');
}

function renderRange() {
  el.rangeText.textContent = `분석 구간 ${sec(state.range.start)} ~ ${sec(state.range.end)}`;
}

// edge = 'start' | 'end' 를 지금 위치로 옮긴다. 구간은 MIN~MAX 길이를 지킨다
function setRangeEdge(edge) {
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

// ── 재생 · 프레임 ───────────────────────────────────────────
// 지금 영상 위치에 해당하는 프레임 번호. 분석 구간 밖이면 null
function currentIndex() {
  const c = state.clip;
  if (!c) return null;
  if (!el.video.videoWidth) return state.still;   // 영상 없이 불러온 기록: 고른 프레임을 그대로 보여 준다
  const i = Math.floor((el.video.currentTime - c.start) * c.hz);
  return i >= 0 && i < c.frames.length ? i : null;
}

function seekToFrame(i) {
  const c = state.clip;
  if (c && !el.video.videoWidth) { state.still = i; tick(); return; }
  if (c && i !== null) el.video.currentTime = c.start + (i + 0.5) / c.hz;
}

function stepFrame(dir) {
  const hz = state.clip ? state.clip.hz : 30;
  el.video.pause();
  el.video.currentTime = Math.max(0, Math.min(el.video.duration, el.video.currentTime + dir / hz));
}

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  el.overlay.width = Math.round(el.stage.clientWidth * dpr);
  el.overlay.height = Math.round(el.stage.clientHeight * dpr);
  draw();
}

function hudOf(result) {
  const m = result.metrics;
  return {
    title: `${ROLE_TEXT[result.mode]} 분석${result.quality.level === 'low' ? ' · 신뢰도 낮음' : ''}`,
    rows: [
      { label: '골반 피크', value: formatValue(m.pelvisPeak), unit: '°/s', color: COLOR.pelvis },
      { label: '몸통 피크', value: formatValue(m.trunkPeak), unit: '°/s', color: COLOR.trunk },
      { label: '최대 분리각', value: formatValue(m.maxSeparation), unit: '°' },
    ],
    footer: `순서 ${sequenceText(m.sequence.order)}`,
  };
}

function overlayScene() {
  const i = currentIndex();
  const frame = state.busy ? state.liveFrame : i === null ? null : state.clip.frames[i];
  return { frame, missing: !!frame && !frame.world, hand: state.result ? state.result.hand : options().hand, hud: state.result && !state.busy ? hudOf(state.result) : null };
}

function draw() {
  if (!el.overlay.width) return;
  drawOverlay(ctx, el.overlay.width, el.overlay.height, overlayScene());
  drawPick();
}

// 분석할 선수 영역(또는 끌고 있는 네모)을 점선으로 보여 준다
function drawPick() {
  const w = el.overlay.width, h = el.overlay.height, box = state.drag ? pickRegion(state.drag.a, state.drag.b, w / h, 0) : state.region;
  if (!box) return;
  const u = Math.max(1, Math.min(w, h) / 360);
  ctx.save();
  ctx.setLineDash([7 * u, 5 * u]);
  for (const [color, width] of [[COLOR.casing, 4 * u], [COLOR.ink, 2 * u]]) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.strokeRect(box.x * w, box.y * h, box.w * w, box.h * h); }
  ctx.restore();
}

// ── 분석할 선수 고르기 ───────────────────────────────────────
function setRegion(region) {
  state.region = region; state.drag = null;
  setPicking(false);
  el.pickClear.hidden = !region;
  el.pickText.textContent = region ? '네모 안의 선수만 분석해요.' : '여러 사람이 나오는 영상이면 분석할 선수를 골라 주세요. 고르지 않으면 가장 크게 찍힌 사람을 분석해요.';
  draw();
}

function setPicking(on) {
  state.picking = on;
  el.stage.classList.toggle('picking', on);
  el.pick.textContent = on ? '고르기 취소' : state.region ? '선수 다시 고르기' : '선수 고르기';
}

function startPicking() {
  if (state.picking) { state.drag = null; setPicking(false); draw(); return; }
  el.video.pause();
  setPicking(true);
  setStatus('영상에서 분석할 선수를 눌러 주세요. 끌어서 네모로 감싸면 더 정확해요.');
}

// 누른 자리를 영상 기준 비율(0~1)로
function stagePoint(e) {
  const r = el.overlay.getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
}

function onPickDown(e) {
  if (!state.picking) return;
  el.overlay.setPointerCapture(e.pointerId);
  state.drag = { a: stagePoint(e), b: stagePoint(e) };
  draw();
}

function onPickMove(e) {
  if (!state.drag) return;
  state.drag.b = stagePoint(e);
  draw();
}

function onPickUp(e) {
  if (!state.drag) return;
  const { a } = state.drag, b = stagePoint(e), v = el.video;
  setRegion(pickRegion(a, b, v.videoWidth / v.videoHeight));
  setStatus(state.clip ? '선수를 골랐어요. 「분석 시작」을 다시 눌러 주세요.' : '선수를 골랐어요. 구간을 확인하고 「분석 시작」을 눌러 주세요.');
}

// 영상 위치가 바뀔 때마다: 그림 · 위치 막대 · 시각 · 그래프의 재생선
function tick() {
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
function sync3d() {
  const i = currentIndex();
  if (!state.view3d || !state.result || i === null) return;
  const k = nearestPose(state.clip.frames, i);
  state.view3d.setFrame(state.clip.frames[k === null ? i : k], state.result.hand);
  el.view3dNote.textContent = k === null || k === i ? '' : `이 프레임은 사람을 못 찾아 가장 가까운 프레임(${k > i ? '+' : ''}${k - i})을 보여 줘요`;
}

// 「영상 + 선」 화면: 지금 영상 프레임에서 선수 주변만 잘라 크게 그리고, 그 위에 같은 프레임의 선을 겹친다(mirror.js)
function drawMirror() {
  const clip = state.clip, i = currentIndex();
  if (state.result && clip) mirror.draw(el.video, i === null ? null : clip.frames[i], state.result.hand);
}

// 동작 재생: 준비 동작부터 마무리까지를 고른 속도로 되풀이한다. 다시 누르면 멈춘다
function toggleMotion() {
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

const renderMotionButton = () => { el.motion.textContent = state.loop && !el.video.paused ? '■ 멈춤' : '▶ 동작 재생'; };

function playLoop() {
  if (el.video.paused || el.video.ended) return;
  tick();
  requestAnimationFrame(playLoop);
}

function togglePlay() {
  if (!el.video.paused) { el.video.pause(); return; }
  el.video.play().catch((e) => { console.warn('[motion] 재생 실패', e); setStatus('영상을 재생하지 못했어요.', true); });
}

// ── 분석 ───────────────────────────────────────────────────
async function analyze() {
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
    const sampled = await samplePoses(el.video, landmarker, { start: range.start, end: range.end, hz, region: state.region, onProgress, shouldStop: () => state.stopping });
    if (sampled.stopped) { setStatus('분석을 중단했어요.'); return; }
    const aspect = el.video.videoWidth / el.video.videoHeight, kept = dropStrays(sampled.frames, aspect);
    state.clip = { frames: kept.frames, start: range.start, hz, aspect, missing: kept.frames.filter((f) => !f.world).length, strays: kept.dropped };
  } catch (e) {
    console.error('[motion] 분석 실패', e);
    setStatus('분석 엔진을 불러오거나 실행하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.', true);
    return;
  } finally {
    setBusy(false);
  }
  compute(null);
}

function onProgress(done, total, frame) {
  state.liveFrame = frame;
  el.progress.value = done / total;
  const left = Math.round(((performance.now() - state.readStart) / done) * (total - done) / 1000);
  setStatus(`동작을 읽는 중… ${done} / ${total} 프레임${done >= 5 ? ` · 약 ${left}초 남음` : ''}`);
  draw();
}

// 뽑아 둔 포즈로 지표를 계산해 화면에 올린다. eventIndex = 임팩트 · 릴리스를 직접 정한 프레임(null 이면 자동)
function compute(eventIndex) {
  const c = state.clip, opt = options();
  if (!c) return;
  const result = analyzeMotion({ frames: c.frames, mode: opt.mode, hand: opt.hand, fps: c.hz * opt.slow, aspect: c.aspect, eventIndex });
  if (!result.ok) { clearResult(); setStatus(FAIL_TEXT[result.reason] || '분석하지 못했어요.', true); return; }
  state.result = result;
  const strays = c.strays ? ` · 선수와 떨어진 곳에 잡힌 ${c.strays}프레임은 뺐어요` : '';
  setStatus(`분석 끝 · ${c.frames.length} 프레임 중 ${c.frames.length - c.missing}프레임에서 선수를 찾았어요${strays}`);
  renderResult();
  seekToFrame(result.events.main);
}

function clearResult() {
  state.result = null;
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  if (state.view3d) { state.view3d.destroy(); state.view3d = null; }
  state.loop = null;
  el.view3dNote.textContent = '';
  el.results.hidden = true;
  el.saveMsg.textContent = '';
  draw();
}

// ── 결과 화면 ───────────────────────────────────────────────
function renderResult() {
  const r = state.result, ev = eventName(r.mode), how = r.events.auto ? '추정' : '직접 지정';
  el.title.textContent = `3. ${ROLE_TEXT[r.mode]} 분석 결과 (${sideText(r.mode, r.hand)})`;
  el.quality.textContent = QUALITY_TEXT[r.quality.level];
  el.quality.dataset.level = r.quality.level;
  renderNotes(r);
  renderTiles(r);
  el.goMain.textContent = `${ev} 프레임 보기`;
  el.setMain.textContent = `지금 프레임을 ${ev}로`;
  el.goPlant.disabled = r.events.plant === null;
  el.autoMain.hidden = r.events.auto;
  el.save.disabled = false;
  el.saveMsg.textContent = '';
  el.results.hidden = false;
  if (state.chart) state.chart.destroy();
  state.chart = createChart(el.chart, { result: r, eventLabel: `${ev}(${how})`, onSeek: seekToFrame });
  if (state.view3d) state.view3d.destroy();
  state.view3d = createSkeleton3D(el.view3d);
  setView3d('front');
  const loop = loopRange(r, state.clip.frames.length);
  mirror.setScope(state.clip.frames, loop.from, loop.to);
  sync3d();
  drawMirror();
}

function renderNotes(r) {
  const notes = r.quality.notes.map((k) => noteText(k, r.quality));
  if (r.events.plant === null) notes.push('앞발 착지 순간을 찾지 못했어요. 착지 기준 값은 비워 뒀어요.');
  el.notes.replaceChildren(...notes.map((t) => node('li', '', t)));
}

function setView3d(name) {
  const [yaw, pitch, text] = VIEWS[name];
  if (state.view3d) state.view3d.setView(yaw, pitch);
  el.view3dCap.textContent = text;
}

// 지난 기록 대비 문구. 비교할 기록이나 값이 없으면 ''
function deltaText(prev, key, value) {
  const before = prev && prev.metrics[key];
  if (typeof before !== 'number' || typeof value !== 'number') return '';
  const d = Math.round(value) - before;
  return `지난 기록 ${before} · ${d > 0 ? '+' : ''}${d}`;
}

function tile(m, value, prev) {
  const box = node('div', 'mo-tile'), label = node('div', 'mo-tile-label'), val = node('div', 'mo-tile-value', formatValue(value));
  if (TILE_COLOR[m.key]) { const dot = node('i'); dot.style.background = TILE_COLOR[m.key]; label.append(dot); }
  label.append(node('span', '', m.label));
  val.append(node('small', '', m.unit));
  box.append(label, val);
  const delta = deltaText(prev, m.key, value);
  if (delta) box.append(node('div', 'mo-tile-delta', delta));
  box.append(node('div', 'mo-tile-help', m.help));
  return box;
}

function sequenceTile(seq) {
  const box = node('div', 'mo-tile wide'), label = node('div', 'mo-tile-label');
  label.append(node('span', '', '회전 순서 (최고 속도에 닿은 차례)'));
  box.append(label, node('div', 'mo-tile-value', sequenceText(seq.order)));
  const gap = seq.pelvisToTrunkMs === null ? '' : `골반 → 몸통 ${Math.round(seq.pelvisToTrunkMs)}ms · `;
  const verdict = seq.proximalToDistal === null ? '피크를 찾지 못한 부위가 있어요' : seq.proximalToDistal ? '골반부터 차례로 나왔어요' : '골반 → 몸통 → 손 순서가 아니에요';
  box.append(node('div', 'mo-tile-help', `${gap}${verdict} · 이 영상은 ${Math.round(seq.resolutionMs)}ms 간격까지만 구분돼요`));
  return box;
}

function renderTiles(r) {
  const prev = loadLog().find((e) => e.mode === r.mode && e.hand === r.hand) || null;
  el.tiles.replaceChildren(...metricList(r.mode).map((m) => tile(m, r.metrics[m.key], prev)), sequenceTile(r.metrics.sequence));
}

// ── 저장 · 이미지 ───────────────────────────────────────────
const MB = (bytes) => Math.max(1, Math.round(bytes / 1e6));

// 지금 영상을 IndexedDB 에 둔다(같은 영상은 한 번만) → { ref(기록에 남길 { sig, name, size }) | null, why(못 넣은 이유) }
async function saveVideo() {
  const f = state.file;
  if (!f) return { ref: null, why: '영상 파일을 찾지 못했어요.' };
  const ref = { sig: f.sig, name: f.name, size: f.size };
  try {
    if ((await videoSigs()).includes(f.sig)) return { ref };
    const free = await freeBytes();
    if (free !== null && free < f.size * 1.2) return { ref: null, why: `기기 저장 공간이 모자라 영상(${MB(f.size)}MB)은 넣지 못했어요.` };
    await putVideo({ ...ref, blob: f.blob });
    return { ref };
  } catch (e) {
    console.warn('[motion] 영상을 저장하지 못했어요', e);
    return { ref: null, why: '영상은 저장하지 못했어요.' };
  }
}

// 다시 보기용 데이터(프레임 좌표 + 영상)를 IndexedDB 에 둔다 → { patch(기록에 덧붙일 값), text(알림) }
async function saveHeavy(id, r, c) {
  try {
    await putClip({ id, hz: c.hz, start: c.start, aspect: c.aspect, slow: options().slow, eventIndex: r.events.auto ? null : r.events.main, ...packFrames(c.frames) });
  } catch (e) {
    console.warn('[motion] 다시 보기 데이터를 저장하지 못했어요', e);
    return { patch: {}, text: '숫자는 저장했지만 다시 보기용 데이터는 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.' };
  }
  const video = await saveVideo();
  const text = video.ref ? `저장했어요. 영상(${MB(video.ref.size)}MB)도 이 기기에 함께 넣어 「불러오기」로 다시 볼 수 있어요.`
    : `저장했어요. ${video.why} 불러올 때 같은 영상을 다시 고르면 영상도 보여요.`;
  return { patch: { hasData: true, video: video.ref }, text };
}

// 기록 목록에 없는 분석 데이터 · 영상을 IndexedDB 에서 지운다
async function pruneLibrary() {
  try {
    const drop = orphanKeys(loadLog(), await clipIds(), await videoSigs());
    await Promise.all([...drop.clips.map(deleteClip), ...drop.videos.map(deleteVideo)]);
  } catch (e) {
    console.warn('[motion] 저장 데이터를 정리하지 못했어요', e);
  }
}

async function save() {
  const r = state.result, c = state.clip;
  if (!r || !c) return;
  const entry = { id: Date.now(), at: new Date().toISOString(), name: el.player.value.trim(), mode: r.mode, hand: r.hand, fps: r.fps, quality: r.quality.level,
    order: r.metrics.sequence.order, metrics: summarize(r), range: { start: c.start, end: c.start + c.frames.length / c.hz }, hasData: false, video: null };
  if (!addEntry(entry)) { el.saveMsg.textContent = '저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'; return; }
  el.save.disabled = true;
  el.saveMsg.textContent = '다시 보기용 데이터를 저장하는 중…';
  const heavy = await saveHeavy(entry.id, r, c);
  updateEntry(entry.id, heavy.patch);
  el.saveMsg.textContent = heavy.text;
  await pruneLibrary();
  renderLog();
}

async function removeLogEntry(e) {
  if (!window.confirm('이 기록을 지울까요? 함께 저장한 다시 보기 데이터도 지워져요.')) return;
  removeEntry(e.id);
  state.compare = state.compare.filter((id) => id !== e.id);
  renderLog();
  await pruneLibrary();
}

// 저장한 기록을 다시 연다: 프레임 좌표로 지표 · 그래프 · 3D 를 되살리고, 영상이 있으면 영상도 올린다
async function loadEntry(e) {
  if (state.busy) return;
  let clip, video = null;
  try {
    clip = await getClip(e.id);
    if (clip && e.video) video = await getVideo(e.video.sig);
  } catch (err) {
    console.warn('[motion] 저장한 데이터를 읽지 못했어요', err);
    el.logMsg.textContent = '저장한 데이터를 읽지 못했어요.';
    return;
  }
  if (!clip) { el.logMsg.textContent = '이 기록은 숫자만 저장돼 있어 다시 볼 수 없어요.'; return; }
  el.logMsg.textContent = '';
  el.video.pause();
  clearResult();
  el.setup.elements.mode.value = e.mode; el.setup.elements.hand.value = e.hand; el.setup.elements.slow.value = String(clip.slow);
  const frames = unpackFrames(clip);
  state.clip = { frames, start: clip.start, hz: clip.hz, aspect: clip.aspect, missing: frames.filter((f) => !f.world).length };
  state.restore = { range: e.range, eventIndex: clip.eventIndex, name: e.name };
  state.still = null;
  el.player.value = e.name || '';
  if (video) { state.file = { blob: video.blob, name: video.name, size: video.size, sig: video.sig }; showVideo(video.blob); return; }
  state.file = null;
  if (state.url) { URL.revokeObjectURL(state.url); state.url = null; }
  el.video.removeAttribute('src'); el.video.load();
  el.stage.style.setProperty('--ar', String(clip.aspect));
  el.stageCard.hidden = false;
  finishLoad();
}

// 불러온 기록을 화면에 올린다(영상이 준비됐거나, 영상 없이 볼 때)
function finishLoad() {
  const { range, eventIndex, name } = state.restore, v = el.video, hasVideo = !!v.videoWidth;
  state.restore = null;
  state.range = { ...range };
  renderRange();
  fitCanvas();
  compute(eventIndex);
  el.attachWrap.hidden = hasVideo;
  const who = name ? `「${name}」 ` : '';
  if (!hasVideo) setStatus(`${who}기록을 불러왔어요. 영상은 저장돼 있지 않아 뼈대만 보여요. 「영상 다시 고르기」로 같은 영상을 고르면 영상도 함께 볼 수 있어요.`);
  else if (v.duration + 0.05 < range.end) setStatus('고른 영상이 저장할 때의 구간보다 짧아요. 다른 영상일 수 있어요.', true);
  else setStatus(`${who}기록을 불러왔어요. 영상과 분석을 함께 볼 수 있어요.`);
  el.stageCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 영상 없이 불러온 기록에 영상을 다시 붙인다
function attachVideo(file) {
  const r = state.result;
  if (!file || !r || !state.clip) return;
  state.restore = { range: state.range, eventIndex: r.events.auto ? null : r.events.main, name: el.player.value.trim() };
  state.file = fileRef(file);
  state.still = null;
  showVideo(file);
}

const whenText = (e) => new Date(e.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const titleOf = (e) => `[${ROLE_TEXT[e.mode]}] ${e.name ? e.name + ' · ' : ''}${sideText(e.mode, e.hand)} · ${whenText(e)}`;

// 비교할 기록을 고르거나 뺀다(두 개까지 — 세 번째를 고르면 가장 먼저 고른 것이 빠진다)
function toggleCompare(id, on) {
  const list = loadLog(), mode = (list.find((e) => e.id === id) || {}).mode;
  const same = state.compare.filter((x) => x !== id && (list.find((e) => e.id === x) || {}).mode === mode);
  const mixed = on && same.length < state.compare.filter((x) => x !== id).length;
  state.compare = on ? same.concat(id).slice(-2) : state.compare.filter((x) => x !== id);
  el.logMsg.textContent = mixed ? '타자는 타자끼리, 투수는 투수끼리 비교해요. 앞서 고른 다른 종류의 기록은 해제했어요.' : '';
  renderLog();
}

function logItem(e) {
  const li = node('li'), main = node('div', 'mo-log-main'), acts = node('div', 'mo-log-acts'), m = e.metrics;
  main.append(node('b', '', titleOf(e)),
    node('span', '', `골반 ${formatValue(m.pelvisPeak)}°/s · 몸통 ${formatValue(m.trunkPeak)}°/s · 분리각 ${formatValue(m.maxSeparation)}° · ${sequenceText(e.order)}`),
    node('span', '', e.hasData ? (e.video ? `다시 보기 가능 · 영상 포함(${MB(e.video.size)}MB)` : '다시 보기 가능 · 영상 없음') : '숫자만 저장됨'));
  const pick = node('label', 'mo-check'), box = node('input');
  box.type = 'checkbox'; box.checked = state.compare.includes(e.id);
  box.addEventListener('change', () => toggleCompare(e.id, box.checked));
  pick.append(box, node('span', '', '비교'));
  acts.append(pick);
  if (e.hasData) { const load = node('button', 'mo-btn', '불러오기'); load.type = 'button'; load.addEventListener('click', () => loadEntry(e)); acts.append(load); }
  const del = node('button', 'mo-btn', '지우기');
  del.type = 'button';
  del.setAttribute('aria-label', `${titleOf(e)} 기록 지우기`);
  del.addEventListener('click', () => removeLogEntry(e));
  acts.append(del);
  li.append(main, acts);
  return li;
}

function compareCell(text, cls) { return node('td', cls || '', text); }

// 고른 두 기록의 지표를 나란히 보여 준다. A = 먼저 고른 기록, B = 나중에 고른 기록, 차이 = B − A
function renderCompare(list) {
  const picked = state.compare.map((id) => list.find((e) => e.id === id)).filter(Boolean);
  el.compareBox.hidden = picked.length < 2;
  if (picked.length < 2) { state.duelToken++; stopDuel(); return; }
  const [a, b] = picked, table = node('table'), head = node('tr'), body = node('tbody');
  for (const [text, cls] of [['지표', ''], [`A · ${titleOf(a)}`, 'mo-cmp-a'], [`B · ${titleOf(b)}`, 'mo-cmp-b'], ['차이 (B − A)', '']]) { const th = node('th', cls, text); th.scope = 'col'; head.append(th); }
  for (const row of compareRows(a, b)) {
    const tr = node('tr'), th = node('th', '', `${row.label} (${row.unit})`);
    th.scope = 'row';
    tr.append(th, compareCell(formatValue(row.a)), compareCell(formatValue(row.b)), compareCell(row.diff === null ? '–' : `${row.diff > 0 ? '+' : ''}${Math.round(row.diff)}`));
    body.append(tr);
  }
  const extra = [['회전 순서', sequenceText(a.order), sequenceText(b.order)], ['신뢰도', QUALITY_TEXT[a.quality] || '–', QUALITY_TEXT[b.quality] || '–']];
  for (const [label, va, vb] of extra) { const tr = node('tr'), th = node('th', '', label); th.scope = 'row'; tr.append(th, compareCell(va), compareCell(vb), compareCell('')); body.append(tr); }
  const thead = node('thead'); thead.append(head); table.append(thead, body);
  el.compare.replaceChildren(table, node('p', 'mo-hint', '신뢰도가 낮은 기록의 값은 참고만 해 주세요. 촬영 위치가 다르면 값도 달라져요.'));
  renderDuel(a, b);
}

function stopDuel() {
  if (state.duel) { state.duel.destroy(); state.duel = null; }
  for (const v of el.duelVideos.querySelectorAll('video')) { URL.revokeObjectURL(v.src); v.remove(); }
  el.duelPlay.textContent = '▶ 나란히 재생';
}

// 저장한 영상을 비교용 영상 요소로 올린다(화면에는 보이지 않는다 — 「영상 + 선」 캔버스가 이 영상을 그린다). 영상이 없거나 못 열면 null
function duelVideo(blob) {
  if (!blob) return Promise.resolve(null);
  return new Promise((resolve) => {
    const v = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto' });
    v.addEventListener('loadeddata', () => resolve(v), { once: true });
    v.addEventListener('error', () => { console.warn('[motion] 비교할 영상을 열지 못했어요'); URL.revokeObjectURL(v.src); v.remove(); resolve(null); }, { once: true });
    el.duelVideos.append(v);
    v.src = URL.createObjectURL(blob);
  });
}

// 기록 하나를 나란히 보기용으로 되살린다 → duel.js 의 side · 다시 보기 데이터가 없으면 null
async function duelSide(e) {
  const clip = e.hasData ? await getClip(e.id) : null;
  if (!clip) return null;
  const frames = unpackFrames(clip);
  const r = analyzeMotion({ frames, mode: e.mode, hand: e.hand, fps: clip.hz * clip.slow, aspect: clip.aspect, eventIndex: clip.eventIndex });
  if (!r.ok) return null;
  const stored = e.video ? await getVideo(e.video.sig) : null;
  return { frames, main: r.events.main, fps: r.fps, hz: clip.hz, start: clip.start, slow: clip.slow, hand: e.hand, video: await duelVideo(stored && stored.blob) };
}

// 두 기록을 나란히 올린다(둘 다 다시 보기 데이터가 있을 때): 기록마다 「영상 + 선」과 3D 뼈대. 임팩트 · 릴리스 순간에 맞춰 함께 움직인다
async function renderDuel(a, b) {
  const token = ++state.duelToken;
  stopDuel();
  let sides = [null, null];
  try { sides = await Promise.all([duelSide(a), duelSide(b)]); } catch (e) { console.warn('[motion] 나란히 보기 데이터를 읽지 못했어요', e); }
  if (token !== state.duelToken) { stopDuel(); return; }   // 읽는 사이 다른 기록을 골랐다
  const ready = !!(sides[0] && sides[1]);
  el.duelBox.hidden = !ready;
  el.duelNone.hidden = ready;
  if (!ready) { stopDuel(); return; }
  el.duelNameA.textContent = `A · ${titleOf(a)}`;
  el.duelNameB.textContent = `B · ${titleOf(b)}`;
  const event = eventName(a.mode);
  state.duel = createDuel(sides, [{ mirror: el.duelVideoA, view: el.duelA }, { mirror: el.duelVideoB, view: el.duelB }],
    (t) => { el.duelTime.textContent = `${event} 기준 ${t > 0 ? '+' : ''}${Math.round(t * 1000)}ms`; });
  state.duel.setRate(Number(el.duelRate.value));
}

function toggleDuel() {
  if (state.duel) el.duelPlay.textContent = state.duel.toggle() ? '■ 멈춤' : '▶ 나란히 재생';
}

function renderLog() {
  const list = loadLog();
  state.compare = state.compare.filter((id) => list.some((e) => e.id === id));
  el.logEmpty.hidden = list.length > 0;
  // 타자 · 투수를 따로 묶어 보여 준다
  const groups = [];
  for (const [mode, label] of GROUPS) {
    const items = list.filter((e) => e.mode === mode);
    if (!items.length) continue;
    const ul = node('ul', 'mo-log');
    ul.append(...items.map(logItem));
    groups.push(node('h3', 'mo-log-group', `${label} · ${items.length}개`), ul);
  }
  el.logList.replaceChildren(...groups);
  renderCompare(list);
}

// 지금 프레임 + 뼈대 + 요약 패널을 한 장의 PNG 로 내려받는다
function saveImage() {
  const v = el.video, scale = Math.min(1, EXPORT_MAX_WIDTH / v.videoWidth);
  const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const layer = Object.assign(document.createElement('canvas'), { width: w, height: h });
  drawOverlay(layer.getContext('2d'), w, h, { ...overlayScene(), mark: true });
  const octx = out.getContext('2d');
  octx.drawImage(v, 0, 0, w, h);
  octx.drawImage(layer, 0, 0);
  out.toBlob((blob) => {
    if (!blob) { el.saveMsg.textContent = '이미지를 만들지 못했어요.'; return; }
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `spraylab-motion-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// ── 연결 ───────────────────────────────────────────────────
function bind() {
  el.file.addEventListener('change', () => openVideo(el.file.files[0]));
  el.setup.addEventListener('submit', (e) => e.preventDefault());
  // 동작 · 방향 · 촬영 속도를 바꾸면 뽑아 둔 포즈로 바로 다시 계산한다(엔진을 다시 돌리지 않는다)
  el.setup.addEventListener('change', (e) => { if (e.target !== el.file && e.target.name !== 'model' && state.clip) compute(null); else draw(); });
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
}

bind();
renderLog();
