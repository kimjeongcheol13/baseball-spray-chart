// 동작 분석 — 내 기록 추이: 같은 선수 · 같은 종류(타격/투구 · 좌우)의 기록을 날짜순으로 이어 그린다 (SVG)
//  · 남과 견주는 것보다 「지난번의 나」와 견주는 것이 같은 조건이라 믿을 만하다. 그래서 기록을 쌓는 이유가 되는 화면
//  · 흔들림 폭(±)이 있는 기록은 세로 막대로 폭을 함께 그린다. 처음과 최근의 차이가 두 폭을 넘을 때만 「달라졌다」고 말한다
import { COLOR } from './overlay.js?v=7';

const NS = 'http://www.w3.org/2000/svg';
const H = 200, MIN_W = 280, DEFAULT_W = 640, PAD = { l: 44, r: 14, t: 14, b: 30 };
export const TREND_METRICS = [
  { key: 'pelvisPeak', name: '골반 회전 피크', unit: '°/s', color: COLOR.pelvis },
  { key: 'trunkPeak', name: '몸통 회전 피크', unit: '°/s', color: COLOR.trunk },
  { key: 'maxSeparation', name: '최대 분리각', unit: '°', color: '#c3c9d4' },
];
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const NO_NAME = '이름 없음';

// 기록 → 묶음 열쇠(같은 선수 · 같은 종류 · 같은 좌우)
export const groupKey = (e) => [e.mode, e.hand, (e.name || '').trim()].join('|');

// 기록 목록 → 추이를 그릴 수 있는 묶음(기록 2개 이상) [{ key, mode, hand, name, count }] (기록 많은 순)
export function trendGroups(entries) {
  const map = new Map();
  for (const e of entries) {
    const k = groupKey(e), g = map.get(k) || { key: k, mode: e.mode, hand: e.hand, name: (e.name || '').trim() || NO_NAME, count: 0 };
    g.count += 1; map.set(k, g);
  }
  return [...map.values()].filter((g) => g.count >= 2).sort((a, b) => b.count - a.count);
}

// 한 묶음의 한 지표 → 날짜순 점 [{ at, value, spread, quality }] (값이 없는 기록은 뺀다)
export function trendPoints(entries, key, metric) {
  return entries
    .filter((e) => groupKey(e) === key && e.metrics && num(e.metrics[metric]))
    .map((e) => ({ at: e.at, value: e.metrics[metric], spread: e.spread && num(e.spread[metric]) ? e.spread[metric] : null, quality: e.quality }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

// 처음 → 최근 한 줄 요약 · 신뢰도 낮은 기록은 요약에서 뺀다(그래프에는 옅게 남긴다)
export function trendSummary(points, unit) {
  const usable = points.filter((p) => p.quality !== 'low');
  if (usable.length < 2) return '신뢰도 보통 이상인 기록이 2개 이상 쌓이면 처음과 최근을 견줘 드려요.';
  const a = usable[0], b = usable[usable.length - 1], d = Math.round(b.value - a.value), margin = (a.spread || 0) + (b.spread || 0);
  const head = `처음 ${Math.round(a.value)} → 최근 ${Math.round(b.value)}${unit} (${d > 0 ? '+' : ''}${d})`;
  if (!a.spread && !b.spread) return `${head}. 예전 기록에는 흔들림 폭(±)이 없어, 달라졌는지 판단하지 않았어요.`;
  return Math.abs(d) > margin
    ? `${head}. 두 기록의 흔들림 폭(±${Math.round(margin)})보다 커서 달라졌다고 볼 수 있어요.`
    : `${head}. 두 기록의 흔들림 폭(±${Math.round(margin)}) 안이라 달라졌다고 보기 어려워요.`;
}

function el(name, attrs, text) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  return e;
}
const shortDate = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}.${d.getDate()}`; };

// 세로 축 범위: 점과 폭을 모두 담고 위아래로 10% 여유
export function valueRange(points) {
  const lo = Math.min(...points.map((p) => p.value - (p.spread || 0))), hi = Math.max(...points.map((p) => p.value + (p.spread || 0)));
  const pad = Math.max(1, (hi - lo) * 0.1);
  return { lo: Math.max(0, lo - pad), hi: hi + pad };
}

// points 를 SVG 하나로 그린다 → <svg> (가로는 기록 순서대로 같은 간격 — 날짜 간격이 들쭉날쭉해도 읽기 쉽게)
//  · width: 실제로 보일 폭(px). 그 폭 그대로 그려야 휴대폰에서 글자가 작아지지 않는다
export function drawTrend(points, metric, width = DEFAULT_W) {
  const W = Math.max(MIN_W, Math.round(width) || DEFAULT_W);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'mo-trend-svg', role: 'img', 'aria-label': `${metric.name} 기록 추이 ${points.length}개` });
  if (!points.length) return svg;
  const { lo, hi } = valueRange(points), iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw), y = (v) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  for (let k = 0; k <= 3; k++) {
    const v = lo + ((hi - lo) * k) / 3, yy = y(v);
    svg.append(el('line', { x1: PAD.l, x2: W - PAD.r, y1: yy, y2: yy, class: 'mo-ch-grid' }), el('text', { x: PAD.l - 6, y: yy + 4, 'text-anchor': 'end', class: 'mo-ch-tick' }, String(Math.round(v))));
  }
  svg.append(el('polyline', { points: points.map((p, i) => `${x(i)},${y(p.value)}`).join(' '), class: 'mo-ch-line', stroke: metric.color }));
  points.forEach((p, i) => {
    const g = el('g', { opacity: p.quality === 'low' ? 0.4 : 1 });
    if (p.spread) g.append(el('line', { x1: x(i), x2: x(i), y1: y(p.value - p.spread), y2: y(p.value + p.spread), stroke: metric.color, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.55 }));
    g.append(el('circle', { cx: x(i), cy: y(p.value), r: 4.5, fill: metric.color, class: 'mo-ch-dot' }), el('title', {}, `${shortDate(p.at)} · ${Math.round(p.value)}${p.spread ? ` ± ${p.spread}` : ''}${metric.unit}${p.quality === 'low' ? ' · 신뢰도 낮음' : ''}`));
    svg.append(g);
    // 날짜는 기록이 많으면 처음 · 끝 · 몇 개만
    if (points.length <= 8 || i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 6) === 0) svg.append(el('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', class: 'mo-ch-tick' }, shortDate(p.at)));
  });
  return svg;
}
