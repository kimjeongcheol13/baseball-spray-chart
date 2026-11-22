// 동작 분석 화면 (motion.html) — 영상 고르기 → 구간 정하기 → 포즈 뽑기 → 지표 · 그래프 · 저장
//  · 계산은 analyze.js, 엔진은 pose.js, 그림은 overlay.js · chart.js, 저장은 store.js 가 한다. 여기는 화면과 그 사이를 잇기만 한다
//  · 모듈 파일을 고치면 그 파일을 부르는 import 의 ?v= 와 motion.html 의 app.js?v= 를 함께 올린다
import { analyzeMotion } from './analyze.js?v=1';
import { loadLandmarker, estimateFps, samplePoses } from './pose.js?v=1';
import { drawOverlay, COLOR } from './overlay.js?v=1';
import { createChart } from './chart.js?v=1';
import { metricList, eventName, formatValue, sequenceText, summarize, QUALITY_TEXT, NOTE_TEXT, FAIL_TEXT } from './metrics.js?v=1';
import { loadLog, addEntry, removeEntry } from './store.js?v=1';

const MAX_RANGE_S = 12;
const MIN_RANGE_S = 0.3;
const EXPORT_MAX_WIDTH = 1280;
const MODE_TEXT = { bat: '타격', pitch: '투구' };
const HAND_TEXT = { R: '우', L: '좌' };
const TILE_COLOR = { pelvisPeak: COLOR.pelvis, trunkPeak: COLOR.trunk };

const $ = (id) => document.getElementById(id);
const el = {
  setup: $('setup'), file: $('file'), stageCard: $('stageCard'), stage: $('stage'), video: $('video'), overlay: $('overlay'),
  transport: $('transport'), play: $('btnPlay'), prev: $('btnPrev'), next: $('btnNext'), seek: $('seek'), time: $('timeOut'), rate: $('rate'),
  rangeRow: $('rangeRow'), rangeText: $('rangeText'), start: $('btnStart'), end: $('btnEnd'),
  analyze: $('btnAnalyze'), stop: $('btnStop'), progress: $('progress'), status: $('status'),
  results: $('results'), title: $('resultTitle'), quality: $('quality'), notes: $('notes'), tiles: $('tiles'), chart: $('chart'),
  goPlant: $('btnGoPlant'), goMain: $('btnGoMain'), setMain: $('btnSetMain'), autoMain: $('btnAutoMain'),
  save: $('btnSave'), image: $('btnImage'), saveMsg: $('saveMsg'), logList: $('logList'), logEmpty: $('logEmpty'),
};
const ctx = el.overlay.getContext('2d');

// clip = 뽑아 둔 포즈 { frames, start, hz, stalled } · result = analyzeMotion 결과 · liveFrame = 분석 도중 방금 읽은 프레임
const state = { url: null, range: { start: 0, end: 0 }, clip: null, result: null, chart: null, busy: false, stopping: false, liveFrame: null };

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
  for (const part of [el.setup, el.transport, el.rangeRow]) part.inert = busy;
  el.analyze.disabled = busy;
  el.stop.hidden = el.progress.hidden = !busy;
  if (!busy) state.liveFrame = null;
}

// ── 영상 · 구간 ─────────────────────────────────────────────
function openVideo(file) {
  if (!file) return;
  if (state.url) URL.revokeObjectURL(state.url);
  clearResult();
  state.clip = null;
  state.url = URL.createObjectURL(file);
  el.video.src = state.url;
  el.stageCard.hidden = false;
  setStatus('영상을 여는 중…');
}

function onVideoReady() {
  const v = el.video;
  if (!Number.isFinite(v.duration) || !v.videoWidth) { setStatus('영상 길이를 읽지 못했어요. MP4 · MOV 파일로 다시 시도해 주세요.', true); return; }
  el.stage.style.setProperty('--ar', String(v.videoWidth / v.videoHeight));
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
  const i = Math.floor((el.video.currentTime - c.start) * c.hz);
  return i >= 0 && i < c.frames.length ? i : null;
}

function seekToFrame(i) {
  const c = state.clip;
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
    title: `${MODE_TEXT[result.mode]} 분석`,
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
  return { frame, hand: state.result ? state.result.hand : options().hand, hud: state.result && !state.busy ? hudOf(state.result) : null };
}

function draw() {
  if (el.overlay.width) drawOverlay(ctx, el.overlay.width, el.overlay.height, overlayScene());
}

// 영상 위치가 바뀔 때마다: 그림 · 위치 막대 · 시각 · 그래프의 재생선
function tick() {
  const v = el.video;
  draw();
  if (Number.isFinite(v.duration) && v.duration > 0) el.seek.value = String(v.currentTime / v.duration);
  el.time.textContent = sec(v.currentTime);
  if (state.chart) state.chart.setCursor(currentIndex());
}

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
    setStatus('분석 엔진을 불러오는 중… (처음 한 번만 받아요 · 약 20MB)');
    const landmarker = await loadLandmarker(opt.model);
    const hz = await estimateFps(el.video);
    setStatus('동작을 읽는 중…');
    const sampled = await samplePoses(el.video, landmarker, { start: range.start, end: range.end, hz, onProgress, shouldStop: () => state.stopping });
    if (sampled.stopped) { setStatus('분석을 중단했어요.'); return; }
    state.clip = { frames: sampled.frames, start: range.start, hz, stalled: sampled.stalled };
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
  setStatus(`동작을 읽는 중… ${done} / ${total} 프레임`);
  draw();
}

// 뽑아 둔 포즈로 지표를 계산해 화면에 올린다. eventIndex = 임팩트 · 릴리스를 직접 정한 프레임(null 이면 자동)
function compute(eventIndex) {
  const c = state.clip, opt = options();
  if (!c) return;
  const result = analyzeMotion({ frames: c.frames, mode: opt.mode, hand: opt.hand, fps: c.hz * opt.slow, aspect: el.video.videoWidth / el.video.videoHeight, eventIndex });
  if (!result.ok) { clearResult(); setStatus(FAIL_TEXT[result.reason] || '분석하지 못했어요.', true); return; }
  state.result = result;
  setStatus(`분석 끝 · ${c.frames.length} 프레임 · 실제 시간 기준 초당 ${result.fps} 장`);
  renderResult();
  seekToFrame(result.events.main);
}

function clearResult() {
  state.result = null;
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  el.results.hidden = true;
  el.saveMsg.textContent = '';
  draw();
}

// ── 결과 화면 ───────────────────────────────────────────────
function renderResult() {
  const r = state.result, ev = eventName(r.mode), how = r.events.auto ? '추정' : '직접 지정';
  el.title.textContent = `3. ${MODE_TEXT[r.mode]} 분석 결과 (${HAND_TEXT[r.hand]})`;
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
}

function renderNotes(r) {
  const notes = r.quality.notes.map((k) => NOTE_TEXT[k]);
  if (state.clip.stalled) notes.push(`영상에서 ${state.clip.stalled}장을 제때 읽지 못했어요. 값이 흔들릴 수 있으니 다시 분석해 보세요.`);
  if (r.events.plant === null) notes.push('앞발 착지 순간을 찾지 못했어요. 착지 기준 값은 비워 뒀어요.');
  el.notes.replaceChildren(...notes.map((t) => node('li', '', t)));
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
function save() {
  const r = state.result;
  if (!r) return;
  const entry = { id: Date.now(), at: new Date().toISOString(), mode: r.mode, hand: r.hand, fps: r.fps, quality: r.quality.level, order: r.metrics.sequence.order, metrics: summarize(r) };
  const ok = addEntry(entry);
  el.saveMsg.textContent = ok ? '저장했어요. 다음 분석부터 이 기록과 비교해요.' : '저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.';
  el.save.disabled = ok;
  renderLog();
}

function logItem(e) {
  const li = node('li'), main = node('div', 'mo-log-main'), del = node('button', 'mo-btn', '지우기');
  const m = e.metrics, when = new Date(e.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  main.append(node('b', '', `${MODE_TEXT[e.mode]} · ${HAND_TEXT[e.hand]} · ${when}`),
    node('span', '', `골반 ${formatValue(m.pelvisPeak)}°/s · 몸통 ${formatValue(m.trunkPeak)}°/s · 분리각 ${formatValue(m.maxSeparation)}° · ${sequenceText(e.order)}`));
  del.type = 'button';
  del.setAttribute('aria-label', `${when} 기록 지우기`);
  del.addEventListener('click', () => { if (window.confirm('이 기록을 지울까요?')) { removeEntry(e.id); renderLog(); } });
  li.append(main, del);
  return li;
}

function renderLog() {
  const list = loadLog();
  el.logEmpty.hidden = list.length > 0;
  el.logList.replaceChildren(...list.map(logItem));
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
  el.video.addEventListener('play', () => { el.play.textContent = '멈춤'; playLoop(); });
  el.video.addEventListener('pause', () => { el.play.textContent = '재생'; tick(); });
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
  el.save.addEventListener('click', save);
  el.image.addEventListener('click', saveImage);
  new ResizeObserver(fitCanvas).observe(el.stage);
}

bind();
renderLog();
