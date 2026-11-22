// 동작 분석 — 회전 속도 그래프 (SVG). 임팩트 · 릴리스를 0 으로 둔 실제 시간(ms) 축, 타깃 쪽 회전이 +
//  · 한 축(°/s)에 골반 · 몸통 두 선. 손 속도는 단위가 달라 선으로 그리지 않는다
//  · 값은 색이 아니라 글자로도 읽힌다: 범례 · 피크 값 표시 · 가리키면 나오는 값 · 표로 보기
import { COLOR } from './overlay.js?v=7';

const NS = 'http://www.w3.org/2000/svg';
const SERIES = [
  { key: 'pelvisVel', peak: 'pelvisPeak', name: '골반', color: COLOR.pelvis },
  { key: 'trunkVel', peak: 'trunkPeak', name: '몸통', color: COLOR.trunk },
];
const BEFORE_S = 0.6, AFTER_S = 0.25;
const HEIGHT = 230, PAD = { l: 46, r: 16, t: 26, b: 34 };
const TABLE_ROWS = 24;

// 그래프에 넣을 프레임 범위(임팩트 앞 0.6초 ~ 뒤 0.25초)
export function chartRange(result) {
  const n = result.series.pelvisVel.length, main = result.events.main;
  return { from: Math.max(0, main - Math.round(BEFORE_S * result.fps)), to: Math.min(n - 1, main + Math.round(AFTER_S * result.fps)) };
}

// 눈금 최댓값: 1 · 2 · 5 × 10ⁿ 으로 올림
export function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function svg(name, attrs, text) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  return e;
}
function html(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const signed = (ms) => (ms > 0 ? '+' : '') + Math.round(ms);

function scales(result, range, width) {
  const { fps, events, series } = result;
  let lo = 0, hi = 100;
  for (const s of SERIES) for (let i = range.from; i <= range.to; i++) { lo = Math.min(lo, series[s.key][i]); hi = Math.max(hi, series[s.key][i]); }
  const yMax = niceMax(hi), yMin = lo < -0.05 * yMax ? -niceMax(-lo) : 0;
  const ms = (i) => ((i - events.main) / fps) * 1000;
  const x0 = ms(range.from), x1 = ms(range.to);
  return {
    ms, yMin, yMax,
    x: (i) => PAD.l + ((ms(i) - x0) / (x1 - x0 || 1)) * (width - PAD.l - PAD.r),
    xOfMs: (t) => PAD.l + ((t - x0) / (x1 - x0 || 1)) * (width - PAD.l - PAD.r),
    y: (v) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (HEIGHT - PAD.t - PAD.b),
    x0, x1,
  };
}

function drawAxes(g, sc, width, eventLabel) {
  const ticks = [sc.yMax, sc.yMax / 2, 0].concat(sc.yMin < 0 ? [sc.yMin] : []);
  for (const v of ticks) {
    g.append(svg('line', { class: v === 0 ? 'mo-ch-zero' : 'mo-ch-grid', x1: PAD.l, x2: width - PAD.r, y1: sc.y(v), y2: sc.y(v) }));
    g.append(svg('text', { class: 'mo-ch-tick', x: PAD.l - 8, y: sc.y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, String(Math.round(v))));
  }
  const step = sc.x1 - sc.x0 > 500 ? 250 : 100;
  for (let t = Math.ceil(sc.x0 / step) * step; t <= sc.x1; t += step) {
    g.append(svg('text', { class: 'mo-ch-tick', x: sc.xOfMs(t), y: HEIGHT - PAD.b + 16, 'text-anchor': 'middle' }, signed(t)));
  }
  g.append(svg('text', { class: 'mo-ch-tick', x: PAD.l - 8, y: 12, 'text-anchor': 'end' }, '°/s'));
  g.append(svg('text', { class: 'mo-ch-tick', x: width - PAD.r, y: HEIGHT - 4, 'text-anchor': 'end' }, `ms · ${eventLabel} 기준`));
  g.append(svg('line', { class: 'mo-ch-event', x1: sc.xOfMs(0), x2: sc.xOfMs(0), y1: PAD.t - 4, y2: HEIGHT - PAD.b }));
  g.append(svg('text', { class: 'mo-ch-label', x: sc.xOfMs(0), y: 12, 'text-anchor': 'middle' }, eventLabel));
}

function drawSeries(g, result, range, sc) {
  for (const s of SERIES) {
    const pts = [];
    for (let i = range.from; i <= range.to; i++) pts.push(`${sc.x(i).toFixed(1)},${sc.y(result.series[s.key][i]).toFixed(1)}`);
    g.append(svg('polyline', { class: 'mo-ch-line', points: pts.join(' '), stroke: s.color }));
  }
  for (const s of SERIES) {
    const i = result.events[s.peak];
    if (i === null || i < range.from || i > range.to) continue;
    const v = result.series[s.key][i], cx = sc.x(i), cy = sc.y(v);
    // 두 피크가 가까워도 글자가 겹치지 않게 골반 값은 점 왼쪽, 몸통 값은 점 오른쪽에 쓴다
    const left = s.key === 'pelvisVel';
    g.append(svg('circle', { class: 'mo-ch-dot', cx, cy, r: 4.5, fill: s.color }));
    g.append(svg('text', { class: 'mo-ch-label', x: cx + (left ? -9 : 9), y: cy, 'text-anchor': left ? 'end' : 'start', 'dominant-baseline': 'middle' }, `${s.name} ${Math.round(v)}`));
  }
}

function buildLegend() {
  const box = html('div', 'mo-legend');
  for (const s of SERIES) {
    const item = html('span', 'mo-legend-item'), key = html('i', 'mo-legend-key');
    key.style.background = s.color;
    item.append(key, html('span', '', `${s.name} 회전 속도`));
    box.append(item);
  }
  return box;
}

function buildTable(result, range, sc, eventLabel) {
  const details = html('details', 'mo-table'), table = html('table'), head = html('tr'), body = html('tbody');
  details.append(html('summary', '', '표로 보기'));
  for (const t of [`시각 (ms · ${eventLabel} 기준)`, '골반 (°/s)', '몸통 (°/s)', '분리각 (°)']) { const th = html('th', '', t); th.scope = 'col'; head.append(th); }
  const stride = Math.max(1, Math.ceil((range.to - range.from + 1) / TABLE_ROWS));
  for (let i = range.from; i <= range.to; i += stride) {
    const tr = html('tr');
    tr.append(html('td', '', signed(sc.ms(i))), html('td', '', String(Math.round(result.series.pelvisVel[i]))),
      html('td', '', String(Math.round(result.series.trunkVel[i]))), html('td', '', String(Math.round(result.series.separation[i]))));
    body.append(tr);
  }
  const thead = html('thead'); thead.append(head); table.append(thead, body); details.append(table);
  return details;
}

function fillTip(tip, result, sc, i) {
  tip.replaceChildren(html('div', 'mo-tip-time', `${signed(sc.ms(i))} ms`));
  for (const s of SERIES) {
    const row = html('div', 'mo-tip-row'), key = html('i', 'mo-legend-key');
    key.style.background = s.color;
    row.append(key, html('span', '', s.name), html('b', '', `${Math.round(result.series[s.key][i])} °/s`));
    tip.append(row);
  }
  const sep = html('div', 'mo-tip-row');
  sep.append(html('span', '', '분리각'), html('b', '', `${Math.round(result.series.separation[i])}°`));
  tip.append(sep);
}

// root 안에 그래프를 그린다 → { setCursor(프레임 번호), destroy() }. onSeek(프레임 번호) = 그래프를 누른 자리로 영상 이동
export function createChart(root, { result, eventLabel, onSeek }) {
  const range = chartRange(result);
  const plot = html('div', 'mo-plot'), tip = html('div', 'mo-tip');
  tip.hidden = true;
  let sc = null, cursorLine = null, hoverLine = null, cursor = result.events.main, hover = null;

  const place = (line, i) => {
    const inside = i !== null && i >= range.from && i <= range.to;
    line.setAttribute('visibility', inside ? 'visible' : 'hidden');
    if (inside) { line.setAttribute('x1', sc.x(i)); line.setAttribute('x2', sc.x(i)); }
  };
  const showHover = (i) => {
    hover = i;
    place(hoverLine, i);
    tip.hidden = i === null;
    if (i === null) return;
    fillTip(tip, result, sc, i);
    const left = sc.x(i) > plot.clientWidth / 2;
    tip.style.left = left ? '' : `${sc.x(i) + 12}px`;
    tip.style.right = left ? `${plot.clientWidth - sc.x(i) + 12}px` : '';
  };
  const indexAt = (clientX, el) => {
    const r = el.getBoundingClientRect(), t = sc.x0 + ((clientX - r.left - PAD.l) / (r.width - PAD.l - PAD.r)) * (sc.x1 - sc.x0);
    return Math.max(range.from, Math.min(range.to, Math.round(result.events.main + (t / 1000) * result.fps)));
  };

  function render() {
    const width = Math.max(280, plot.clientWidth);
    sc = scales(result, range, width);
    const el = svg('svg', { class: 'mo-chart', width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, role: 'img', tabindex: 0,
      'aria-label': `골반 · 몸통 회전 속도 그래프. 좌우 화살표로 시각을 옮기고 Enter 로 영상을 그 자리로 옮겨요.` });
    drawAxes(el, sc, width, eventLabel);
    drawSeries(el, result, range, sc);
    cursorLine = svg('line', { class: 'mo-ch-cursor', y1: PAD.t, y2: HEIGHT - PAD.b });
    hoverLine = svg('line', { class: 'mo-ch-hover', y1: PAD.t, y2: HEIGHT - PAD.b });
    el.append(cursorLine, hoverLine);
    el.addEventListener('pointermove', (e) => showHover(indexAt(e.clientX, el)));
    el.addEventListener('pointerleave', () => showHover(null));
    el.addEventListener('blur', () => showHover(null));
    el.addEventListener('click', (e) => onSeek(indexAt(e.clientX, el)));
    el.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (d) { e.preventDefault(); showHover(Math.max(range.from, Math.min(range.to, (hover ?? cursor) + d))); }
      if (e.key === 'Enter' && hover !== null) onSeek(hover);
    });
    plot.replaceChildren(el, tip);
    place(cursorLine, cursor);
    showHover(null);
  }

  root.replaceChildren(buildLegend(), plot);
  render();
  root.append(buildTable(result, range, sc, eventLabel));
  const observer = new ResizeObserver(() => { if (Math.max(280, plot.clientWidth) !== Number(plot.firstChild.getAttribute('width'))) render(); });
  observer.observe(plot);

  return {
    setCursor(i) { cursor = i; place(cursorLine, i); },
    destroy() { observer.disconnect(); root.replaceChildren(); },
  };
}
