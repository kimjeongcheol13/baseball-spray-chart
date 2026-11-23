// 동작 분석 화면 — 결과 화면: 숫자 칸 · 한눈에 보기 · 참고 범위 · 3D 방향
//  · app.js 에서 나눈 파일이다. 같은 모듈은 언제나 같은 ?v= 로 불러야 한 벌만 생긴다(상태가 둘로 갈리지 않게)
import { separationStill, rivalEvents } from './spread.js?v=2';
import { createChart } from './chart.js?v=7';
import { createSkeleton3D } from './skeleton3d.js?v=6';
import { metricList, eventName, formatValue, sequenceText, QUALITY_TEXT, noteText } from './metrics.js?v=2';
import { loadLog } from './store.js?v=4';
import { loopRange } from './view.js?v=3';
import { summaryLines, readText, referenceLine } from './insight.js?v=3';
import { REFERENCE_NOTE, REFERENCE_SOURCES } from './reference.js?v=1';
import { VIEWS, ROLE_TEXT, sideText, TILE_COLOR, $, el, mirror, state, node } from './page.js?v=1';
import { seekToFrame, sync3d, drawMirror } from './page-core.js?v=1';

// ── 결과 화면 ───────────────────────────────────────────────
export function renderResult() {
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

export function renderNotes(r) {
  const notes = r.quality.notes.map((k) => noteText(k, r.quality));
  if (r.events.plant === null) notes.push('앞발 착지 순간을 찾지 못했어요. 착지 기준 값은 비워 뒀어요.');
  el.notes.replaceChildren(...notes.map((t) => node('li', '', t)));
}

export function setView3d(name) {
  const [yaw, pitch, text] = VIEWS[name];
  if (state.view3d) state.view3d.setView(yaw, pitch);
  el.view3dCap.textContent = text;
}


// 지난 기록 대비 문구. 비교할 기록이나 값이 없으면 ''
export function deltaText(prev, key, value) {
  const before = prev && prev.metrics[key];
  if (typeof before !== 'number' || typeof value !== 'number') return '';
  const d = Math.round(value) - before;
  return `지난 기록 ${before} · ${d > 0 ? '+' : ''}${d}`;
}

export function tile(m, value, prev, r) {
  const box = node('div', 'mo-tile'), label = node('div', 'mo-tile-label'), val = node('div', 'mo-tile-value', formatValue(value));
  if (TILE_COLOR[m.key]) { const dot = node('i'); dot.style.background = TILE_COLOR[m.key]; label.append(dot); }
  label.append(node('span', '', m.label));
  const spread = state.spread && state.spread[m.key];
  // 흔들림 폭이 1 이상이면 「± 폭」을 단위 앞에 붙인다
  val.append(node('small', '', (typeof spread === 'number' && spread >= 0.5 ? ` ± ${Math.round(spread)} ` : '') + m.unit));
  box.append(label, val);
  const delta = deltaText(prev, m.key, value);
  if (delta) box.append(node('div', 'mo-tile-delta', delta));
  box.append(node('div', 'mo-tile-help', m.help));
  if (readText(m.key)) box.append(node('div', 'mo-tile-read', readText(m.key)));
  const ref = referenceLine(r.mode, m.key, value, r.quality.level, spread);
  if (ref) { const tag = node('div', 'mo-tile-ref', ref.text); if (ref.position) tag.dataset.position = ref.position; box.append(tag); }
  return box;
}

export function sequenceTile(seq) {
  const box = node('div', 'mo-tile wide'), label = node('div', 'mo-tile-label');
  label.append(node('span', '', '회전 순서 (최고 속도에 닿은 차례)'));
  box.append(label, node('div', 'mo-tile-value', sequenceText(seq.order)));
  const gap = seq.pelvisToTrunkMs === null ? '' : `골반 → 몸통 ${Math.round(seq.pelvisToTrunkMs)}ms · `;
  const verdict = seq.proximalToDistal === null ? '피크를 찾지 못한 부위가 있어요' : seq.proximalToDistal ? '골반부터 차례로 나왔어요' : '골반 → 몸통 → 손 순서가 아니에요';
  box.append(node('div', 'mo-tile-help', `${gap}${verdict} · 이 영상은 ${Math.round(seq.resolutionMs)}ms 간격까지만 구분돼요`));
  return box;
}

// 믿기 어려운 부분(spread.js) → insight.js 가 쓰는 모양. 프레임 번호는 영상 시각(초)으로 바꾼다
export function cautionOf(r) {
  const rivals = rivalEvents(r), c = state.clip;
  return { rivals: rivals && c ? rivals.map((k) => c.start + k / c.hz) : null, still: separationStill(r) };
}

export function renderTiles(r) {
  const prev = loadLog().find((e) => e.mode === r.mode && e.hand === r.hand) || null;
  el.insights.replaceChildren(...summaryLines(r, prev, state.spread || {}, cautionOf(r)).map((l) => { const li = node('li', '', l.text); li.dataset.tone = l.tone; return li; }));
  el.tiles.replaceChildren(...metricList(r.mode).map((m) => tile(m, r.metrics[m.key], prev, r)), sequenceTile(r.metrics.sequence));
  renderReferenceNote(r.mode);
}

// 참고 범위가 누구를 어떻게 잰 값이고 왜 그대로 견주면 안 되는지 + 출처 링크
export function renderReferenceNote(mode) {
  const sources = REFERENCE_SOURCES[mode] || [];
  el.refNote.replaceChildren(REFERENCE_NOTE[mode] || '', ...sources.flatMap((s, i) => {
    const a = node('a', '', s.label);
    a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
    return [i ? ', ' : ' 출처: ', a];
  }));
}
