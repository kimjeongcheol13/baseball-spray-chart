// 코스별 핫/콜드 존 — 스트라이크존 9칸 + 바깥 볼 4칸(위·아래·안·밖)을 SVG로 그린다 (분석 탭 다크 테마)
// 배치는 분석 엑셀 「핫콜드존」 그림(xlsxreport.js)과 같고, 색 기준은 스카우트 탭 코스 칸(_zoneColor)과 같다
import { ZONES_9, esc as _esc } from '../constants.js';
import { calcStats, f3 } from './batdata.js?v=4';

const MIN_AB = 3;   // 색칠 최소 타수 (스카우트 탭과 같은 값)
const ZONE_BALL = ['볼 위', '볼 아래', '볼 내', '볼 외'];

// 타석의 코스: 결과가 난 공(타석 마지막 공) — 타석 코스가 비어 있으면 마지막 투구의 코스
export function zoneOf(a) {
  return a.zone || (a.pitches && a.pitches.length ? a.pitches[a.pitches.length - 1].zone : '') || '';
}

// 발산형 색: 약함(Signal Blue) → 회색 → 강함(Hit Red). 기준 = 이 타자의 전체 타율 (스카우트 탭과 같은 계산)
function _color(avg, base) {
  const lo = [75, 140, 245], mid = [58, 66, 82], hi = [224, 82, 90];
  const t = Math.max(-1, Math.min(1, (avg - base) / Math.max(0.15, base)));
  const to = t < 0 ? lo : hi;
  return `rgb(${mid.map((m, i) => Math.round(m + (to[i] - m) * Math.abs(t))).join(',')})`;
}

// abs = 한 타자의 타석들, base = 그 타자의 전체 타율, pa = 전체 타석 수 → HTML (코스 기록이 없으면 '')
export function hotColdFigure(abs, base, pa) {
  const zs = {};
  [...ZONES_9, ...ZONE_BALL].forEach(z => { zs[z] = calcStats(abs.filter(a => zoneOf(a) === z)); });
  const zoned = Object.values(zs).reduce((n, s) => n + s.pa, 0);
  if (!zoned) return '';

  const L = 86, T = 100, CW = 94, CH = 96, G = 6, SIDE = 62, BAND = 50;
  const R = L + 3 * CW, B = T + 3 * CH;
  // mode: in = 9칸 · h = 위/아래 띠(한 줄) · v = 양옆 띠(세로로 쌓기)
  const cell = (x, y, w, h, z, mode) => {
    const s = zs[z];
    const on = s.ab >= MIN_AB;
    const main = s.ab ? f3(s.avg) : '—';
    const sub = s.pa ? `${s.h}/${s.ab} · ${s.pa}타석` : '기록 없음';
    const cx = x + w / 2, cy = y + h / 2;
    const tip = `<title>${_esc(z)}: ${s.pa}타석 · 타율 ${s.ab ? f3(s.avg) : '—'} (${s.h}/${s.ab})</title>`;
    let txt;
    if (mode === 'in') {
      txt = `<text class="zf-m" x="${cx}" y="${cy - 10}">${main}</text><text class="zf-s" x="${cx}" y="${cy + 17}">${sub}</text>`;
    } else if (mode === 'h') {
      txt = `<text class="zf-l" x="${cx - 100}" y="${cy}">${_esc(z)}</text><text class="zf-m zf-mb" x="${cx}" y="${cy}">${main}</text><text class="zf-s" x="${cx + 94}" y="${cy}">${s.pa ? `${s.h}/${s.ab} · ${s.pa}타석` : '—'}</text>`;
    } else {
      const subs = s.pa ? [`${s.h}/${s.ab}`, `${s.pa}타석`] : ['기록 없음'];
      const top = cy - 14 - subs.length * 8;
      txt = `<text class="zf-l" x="${cx}" y="${top}">${_esc(z)}</text><text class="zf-m zf-mb" x="${cx}" y="${top + 27}">${main}</text>`
        + subs.map((t, i) => `<text class="zf-s" x="${cx}" y="${top + 51 + i * 16}">${t}</text>`).join('');
    }
    return `<g class="zf-c${on ? ' on' : ''}${mode === 'in' ? '' : ' ball'}">${tip}<rect x="${x}" y="${y}" width="${w}" height="${h}"${on ? ` style="fill:${_color(s.avg, base)}"` : ''}/>${txt}</g>`;
  };
  const sep = [1, 2].map(k => `M${L + CW * k} ${T}V${B}M${L} ${T + CH * k}H${R}`).join('');
  const svg = `
    <svg viewBox="0 12 ${R + G + SIDE + 18} ${B + G + BAND + 4}" role="img" aria-label="코스별 핫/콜드 존">
      ${['내각', '중앙', '외각'].map((t, i) => `<text class="zf-ax" x="${L + CW * (i + 0.5)}" y="28">${t}</text>`).join('')}
      ${cell(L, T - G - BAND, 3 * CW, BAND, '볼 위', 'h')}
      ${cell(L, B + G, 3 * CW, BAND, '볼 아래', 'h')}
      ${cell(L - G - SIDE, T, SIDE, 3 * CH, '볼 내', 'v')}
      ${cell(R + G, T, SIDE, 3 * CH, '볼 외', 'v')}
      ${ZONES_9.map((z, i) => cell(L + CW * (i % 3), T + CH * Math.floor(i / 3), CW, CH, z, 'in')).join('')}
      <path class="zf-sep" d="${sep}"/>
      <rect class="zf-box" x="${L}" y="${T}" width="${3 * CW}" height="${3 * CH}"/>
    </svg>`;
  return `
    <figure class="zf">${svg}</figure>
    <div class="sc-zone-key"><span class="k-lo">콜드 (약함)</span><i></i><span class="k-hi">핫 (강함)</span></div>
    <div class="an-hd-note sc-zone-note">결과가 나온 공의 코스 · 색은 이 타자 전체 타율(${f3(base)}) 대비 · ${MIN_AB}타수 미만은 색 없음 · 코스 기록 ${zoned}/${pa}타석<br>기록 화면 기준: 왼쪽 = 내각, 위 = 높음</div>`;
}
