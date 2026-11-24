// 동작 분석 화면 — 저장 · 불러오기 · 기록 목록 · 비교 · 나란히 보기 · 내 기록 추이 · 이미지 저장
//  · app.js 에서 나눈 파일이다. 같은 모듈은 언제나 같은 ?v= 로 불러야 한 벌만 생긴다(상태가 둘로 갈리지 않게)
import { roundFraming } from './framing.js?v=1';
import { track } from './usage.js?v=1';
import { analyzeMotion } from './analyze.js?v=5';
import { roundSpread } from './spread.js?v=2';
import { drawOverlay } from './overlay.js?v=7';
import { eventName, formatValue, sequenceText, summarize, QUALITY_TEXT } from './metrics.js?v=2';
import { loadLog, addEntry, removeEntry, updateEntry } from './store.js?v=4';
import { syncSaved, syncRemoved, clipFor, videoFor } from './page-sync.js?v=3';
import { shiftRange } from './cut.js?v=1';
import { packFrames, unpackFrames, orphanKeys, compareRows } from './library.js?v=1';
import { putClip, getClip, deleteClip, clipIds, putVideo, getVideo, deleteVideo, videoSigs, freeBytes } from './db.js?v=1';
import { createDuel } from './duel.js?v=6';
import { TREND_METRICS, trendGroups, trendPoints, trendSummary, drawTrend } from './trend.js?v=1';
import { EXPORT_MAX_WIDTH, ROLE_TEXT, GROUPS, sideText, $, el, mirror, state, node, options, setStatus } from './page.js?v=3';
import { fileRef, showVideo, renderRange } from './page-input.js?v=2';
import { fitCanvas, overlayScene, compute, clearResult } from './page-core.js?v=1';

// ── 저장 · 이미지 ───────────────────────────────────────────
export const MB = (bytes) => Math.max(1, Math.round(bytes / 1e6));

// 지금 영상을 IndexedDB 에 둔다(같은 영상은 한 번만) → { ref(기록에 남길 { sig, name, size }) | null, why(못 넣은 이유) }
export async function saveVideo() {
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
export async function saveHeavy(id, r, c) {
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
export async function pruneLibrary() {
  try {
    const drop = orphanKeys(loadLog(), await clipIds(), await videoSigs());
    await Promise.all([...drop.clips.map(deleteClip), ...drop.videos.map(deleteVideo)]);
  } catch (e) {
    console.warn('[motion] 저장 데이터를 정리하지 못했어요', e);
  }
}

export async function save() {
  const r = state.result, c = state.clip;
  if (!r || !c) return;
  const entry = { id: Date.now(), at: new Date().toISOString(), name: el.player.value.trim(), mode: r.mode, hand: r.hand, fps: r.fps, quality: r.quality.level,
    order: r.metrics.sequence.order, metrics: summarize(r), spread: roundSpread(state.spread), framing: roundFraming(state.framing), range: { start: c.start, end: c.start + c.frames.length / c.hz }, hasData: false, video: null };
  if (!addEntry(entry)) { el.saveMsg.textContent = '저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'; return; }
  track('motion_save', { mode: entry.mode, quality: entry.quality });
  el.save.disabled = true;
  el.saveMsg.textContent = '다시 보기용 데이터를 저장하는 중…';
  const heavy = await saveHeavy(entry.id, r, c);
  updateEntry(entry.id, heavy.patch);
  el.saveMsg.textContent = heavy.text;
  await pruneLibrary();
  renderLog();
  syncSaved(entry.id);   // 로그인했으면 다른 기기로도(page-sync.js)
}

export async function removeLogEntry(e) {
  if (!window.confirm('이 기록을 지울까요? 함께 저장한 다시 보기 데이터도 지워져요.')) return;
  removeEntry(e.id);
  state.compare = state.compare.filter((id) => id !== e.id);
  renderLog();
  await pruneLibrary();
  syncRemoved(e.id);
}

// 저장한 기록을 다시 연다: 프레임 좌표로 지표 · 그래프 · 3D 를 되살리고, 영상이 있으면 영상도 올린다
export async function loadEntry(e) {
  if (state.busy) return;
  track('motion_load');
  let clip, video = null;
  try {
    clip = await clipFor(e);   // 다른 기기에서 온 기록이면 서버에서 받아 온다
    if (clip) video = await videoFor(e, () => { el.logMsg.textContent = '다른 기기에서 보낸 영상을 받는 중…'; });
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
  const frames = unpackFrames(clip), offset = video ? video.offset : 0;   // 다른 기기에서 받은 영상은 분석 구간만 담겨 있어 시간을 그만큼 당긴다
  state.clip = { frames, start: clip.start - offset, hz: clip.hz, aspect: clip.aspect, missing: frames.filter((f) => !f.world).length };
  state.restore = { range: shiftRange(e.range, offset), eventIndex: clip.eventIndex, name: e.name };
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

// 영상 없이 불러온 기록(다른 기기에서 영상 없이 넘어왔거나, 이 기기에 영상을 넣지 못한 기록)일 때 화면 위에 띄우는 말
export const NO_VIDEO_TEXT = '영상 없이 넘어온 기록이라 뼈대만 보여요 · 아래 안내를 봐 주세요';
export const NO_VIDEO_HELP = '영상을 찍은 기기(휴대폰 등)에서 동작 분석을 열고 「이 기기 영상 … 다른 기기로 보내기」를 누른 뒤 이 페이지를 새로고침하면 영상도 보여요. 영상 파일이 이 기기에 있으면 「영상 다시 고르기」로 바로 붙일 수도 있어요.';

// 불러온 기록을 화면에 올린다(영상이 준비됐거나, 영상 없이 볼 때)
export function finishLoad() {
  const { range, eventIndex, name } = state.restore, v = el.video, hasVideo = !!v.videoWidth;
  state.restore = null;
  state.range = { ...range };
  renderRange();
  fitCanvas();
  compute(eventIndex);
  el.attachWrap.hidden = hasVideo;
  el.noVideo.hidden = hasVideo;
  el.noVideo.textContent = hasVideo ? '' : NO_VIDEO_TEXT;
  const who = name ? `「${name}」 ` : '';
  if (!hasVideo) setStatus(`${who}기록을 불러왔어요. 영상이 없어 뼈대만 보여요. ${NO_VIDEO_HELP}`);
  else if (v.duration + 0.05 < range.end) setStatus('고른 영상이 저장할 때의 구간보다 짧아요. 다른 영상일 수 있어요.', true);
  else setStatus(`${who}기록을 불러왔어요. 영상과 분석을 함께 볼 수 있어요.`);
  el.stageCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 영상 없이 불러온 기록에 영상을 다시 붙인다
export function attachVideo(file) {
  const r = state.result;
  if (!file || !r || !state.clip) return;
  state.restore = { range: state.range, eventIndex: r.events.auto ? null : r.events.main, name: el.player.value.trim() };
  state.file = fileRef(file);
  state.still = null;
  showVideo(file);
}

export const whenText = (e) => new Date(e.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const titleOf = (e) => `[${ROLE_TEXT[e.mode]}] ${e.name ? e.name + ' · ' : ''}${sideText(e.mode, e.hand)} · ${whenText(e)}`;

// 비교할 기록을 고르거나 뺀다(두 개까지 — 세 번째를 고르면 가장 먼저 고른 것이 빠진다)
export function toggleCompare(id, on) {
  const list = loadLog(), mode = (list.find((e) => e.id === id) || {}).mode;
  const same = state.compare.filter((x) => x !== id && (list.find((e) => e.id === x) || {}).mode === mode);
  const mixed = on && same.length < state.compare.filter((x) => x !== id).length;
  state.compare = on ? same.concat(id).slice(-2) : state.compare.filter((x) => x !== id);
  if (on && state.compare.length === 2) track('motion_compare');
  el.logMsg.textContent = mixed ? '타자는 타자끼리, 투수는 투수끼리 비교해요. 앞서 고른 다른 종류의 기록은 해제했어요.' : '';
  renderLog();
}

export function logItem(e) {
  const li = node('li'), main = node('div', 'mo-log-main'), acts = node('div', 'mo-log-acts'), m = e.metrics;
  main.append(node('b', '', titleOf(e)),
    node('span', '', `골반 ${formatValue(m.pelvisPeak)}°/s · 몸통 ${formatValue(m.trunkPeak)}°/s · 분리각 ${formatValue(m.maxSeparation)}° · ${sequenceText(e.order)}`),
    node('span', '', e.hasData ? (e.video ? `다시 보기 가능 · 영상 포함(${MB(e.video.size)}MB)` : e.cloudVideo ? '다시 보기 가능 · 영상은 불러올 때 받아요' : '다시 보기 가능 · 영상 없음') : '숫자만 저장됨'));
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

export function compareCell(text, cls) { return node('td', cls || '', text); }

// 고른 두 기록의 지표를 나란히 보여 준다. A = 먼저 고른 기록, B = 나중에 고른 기록, 차이 = B − A
export function renderCompare(list) {
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

export function stopDuel() {
  if (state.duel) { state.duel.destroy(); state.duel = null; }
  for (const v of el.duelVideos.querySelectorAll('video')) { URL.revokeObjectURL(v.src); v.remove(); }
  el.duelPlay.textContent = '▶ 나란히 재생';
}

// 저장한 영상을 비교용 영상 요소로 올린다(화면에는 보이지 않는다 — 「영상 + 선」 캔버스가 이 영상을 그린다). 영상이 없거나 못 열면 null
export function duelVideo(blob) {
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
export async function duelSide(e) {
  const clip = e.hasData ? await clipFor(e) : null;
  if (!clip) return null;
  const frames = unpackFrames(clip);
  const r = analyzeMotion({ frames, mode: e.mode, hand: e.hand, fps: clip.hz * clip.slow, aspect: clip.aspect, eventIndex: clip.eventIndex });
  if (!r.ok) return null;
  const stored = await videoFor(e);
  return { frames, main: r.events.main, fps: r.fps, hz: clip.hz, start: clip.start - (stored ? stored.offset : 0), slow: clip.slow, hand: e.hand, video: await duelVideo(stored && stored.blob) };
}

// 다시 보기 데이터가 없는 기록이 있으면 무엇이 없고 어떻게 하면 되는지 알린다
export function duelWarning(entries, sides) {
  const missing = entries.map((e, k) => (sides[k] ? null : `${'AB'[k]} 기록(${titleOf(e)})`)).filter(Boolean);
  if (!missing.length) return '';
  const what = missing.length === 2 ? '두 기록 모두' : `${missing[0]}은`;
  return `${what} 숫자만 저장돼 있어 영상과 뼈대를 보여 줄 수 없어요. 다시 보기 기능이 생기기 전에 저장한 기록이에요. 그 선수의 영상을 다시 분석해서 저장하면 여기서 영상으로 비교할 수 있어요.`;
}

// 두 기록을 나란히 올린다: 기록마다 「영상 + 선」과 3D 뼈대. 임팩트 · 릴리스 순간에 맞춰 함께 움직인다
//  · 한쪽에만 다시 보기 데이터가 있어도 그쪽은 보여 주고, 없는 쪽 자리에는 안내를 쓴다
export async function renderDuel(a, b) {
  const token = ++state.duelToken;
  stopDuel();
  let sides = [null, null];
  try { sides = await Promise.all([duelSide(a), duelSide(b)]); } catch (e) { console.warn('[motion] 나란히 보기 데이터를 읽지 못했어요', e); }
  if (token !== state.duelToken) { stopDuel(); return; }   // 읽는 사이 다른 기록을 골랐다
  const any = !!(sides[0] || sides[1]);
  el.duelNone.textContent = duelWarning([a, b], sides);
  el.duelNone.hidden = !el.duelNone.textContent;
  el.duelBox.hidden = !any;
  if (!any) { stopDuel(); return; }
  el.duelNameA.textContent = `A · ${titleOf(a)}`;
  el.duelNameB.textContent = `B · ${titleOf(b)}`;
  const event = eventName(a.mode);
  state.duel = createDuel(sides, [{ mirror: el.duelVideoA, view: el.duelA }, { mirror: el.duelVideoB, view: el.duelB }],
    (t) => { el.duelTime.textContent = `${event} 기준 ${t > 0 ? '+' : ''}${Math.round(t * 1000)}ms`; }, '숫자만 저장된 기록이에요');
  state.duel.setRate(Number(el.duelRate.value));
}

export function toggleDuel() {
  if (state.duel) el.duelPlay.textContent = state.duel.toggle() ? '■ 멈춤' : '▶ 나란히 재생';
}

export function renderLog() {
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
  renderTrend(list);
}

// ── 내 기록 추이 (trend.js) ─────────────────────────────────────
// 고를 수 있는 선수 · 종류 묶음과 지표를 채우고 그래프를 그린다. 고른 것은 다시 그려도 유지한다
export function renderTrend(list) {
  const groups = trendGroups(list);
  el.trendBox.hidden = !groups.length;
  el.trendEmpty.hidden = !list.length || groups.length > 0;
  if (!groups.length) return;
  const keepGroup = groups.some((g) => g.key === el.trendGroup.value) ? el.trendGroup.value : groups[0].key, keepMetric = el.trendMetric.value || TREND_METRICS[0].key;
  el.trendGroup.replaceChildren(...groups.map((g) => { const o = node('option', '', `${g.name} · ${ROLE_TEXT[g.mode]} · ${sideText(g.mode, g.hand)} (${g.count}개)`); o.value = g.key; return o; }));
  el.trendMetric.replaceChildren(...TREND_METRICS.map((m) => { const o = node('option', '', m.name); o.value = m.key; return o; }));
  el.trendGroup.value = keepGroup; el.trendMetric.value = keepMetric;
  drawTrendNow(list);
}

export function drawTrendNow(list = loadLog()) {
  const metric = TREND_METRICS.find((m) => m.key === el.trendMetric.value) || TREND_METRICS[0], points = trendPoints(list, el.trendGroup.value, metric.key);
  el.trendChart.replaceChildren(drawTrend(points, metric, el.trendChart.clientWidth));
  el.trendText.textContent = points.length ? trendSummary(points, metric.unit) : '이 지표가 기록된 것이 없어요.';
}

// 지금 프레임 + 뼈대 + 요약 패널을 한 장의 PNG 로 내려받는다
export function saveImage() {
  track('motion_image');
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
