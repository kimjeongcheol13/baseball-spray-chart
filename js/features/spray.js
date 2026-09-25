// 스프레이 차트 — 타구 위치를 필드 위에: 대상(팀/선수) · 범위(이번 경기/시즌) · 결과 필터 · 상세 필터(filter.js) · 점/구역 보기
import { HITS, esc as _esc } from '../constants.js';
import { buildData, calcStats, f3, pct, emptyState } from './batdata.js?v=5';

let _scope = 'game';     // game | season
let _who = 'all';        // all | home | away | p:<이름>
let _view = 'dots';      // dots | zones
let _res = { '1b': true, xbh: true, hr: true, out: true };

// 방향 구간: 기록 탭과 같은 경계 (저장 각도 기준 LF <54 · LC <78 · CF <102 · RC <126 · RF)
const DIRS = [
  { k: 'LF', l: '좌익', a: 0, b: 54 },
  { k: 'LC', l: '좌중간', a: 54, b: 78 },
  { k: 'CF', l: '중견', a: 78, b: 102 },
  { k: 'RC', l: '우중간', a: 102, b: 126 },
  { k: 'RF', l: '우익', a: 126, b: 180 },
];
// 깊이: 홈에서 펜스까지 비율 (내야 호 = 0.42)
const DEPTHS = [
  { k: 'in', l: '내야', a: 0, b: 0.42 },
  { k: 'mid', l: '외야 앞', a: 0.42, b: 0.75 },
  { k: 'deep', l: '외야 뒤', a: 0.75, b: 1.2 },
];

const TYPE = a => (a.res === '홈런' ? 'hr' : a.res === '2루타' || a.res === '3루타' ? 'xbh' : HITS.includes(a.res) ? '1b' : 'out');

function _mount() {
  const sec = document.querySelector('#anaBody .ana-sec[data-sub="spray"]');
  if (!sec) return null;
  let v = document.getElementById('sprayView');
  if (!v) {
    v = document.createElement('div');
    v.id = 'sprayView';
    v.className = 'sp';
    sec.insertBefore(v, sec.firstChild);
  }
  return v;
}

export function openSprayView() {
  if (!_mount()) return;
  _render();
}

export function setSprayView(k, v) {
  if (k === 'scope') _scope = v === 'season' ? 'season' : 'game';
  if (k === 'who') _who = v || 'all';
  if (k === 'view') _view = v === 'zones' ? 'zones' : 'dots';
  if (k === 'res') {
    _res[v] = !_res[v];
    if (!Object.values(_res).some(Boolean)) _res[v] = true;   // 하나는 남긴다
  }
  _render();
}

// ── 데이터 ───────────────────────────────────────────────────
function _source() {
  const AS = window.AS || {};
  const all = _scope === 'game' ? (AS.abs || []) : buildData().games.flatMap(g => g.abs);
  return all;
}

function _players(all) {
  const m = {};
  all.forEach(a => { if (a.bname) m[a.bname] = (m[a.bname] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ n, c }));
}

function _filterWho(all) {
  if (_who === 'home' || _who === 'away') return all.filter(a => (a.team === 'away' ? 'away' : 'home') === _who);
  if (_who.startsWith('p:')) { const n = _who.slice(2); return all.filter(a => a.bname === n); }
  return all;
}

function _geo(a) {
  const dx = a.x - 0.5, dy = Math.min(a.y - 1, 0);
  const deg = a.deg != null ? a.deg : (Math.atan2(dy, dx) + Math.PI) * 180 / Math.PI;
  const frac = Math.sqrt(dx * dx + dy * dy) / 0.97;
  return { deg, frac };
}

// ── 필드 SVG ─────────────────────────────────────────────────
// 기록 탭 drawField와 같은 기하·색 (1×1 박스 → ×100): 구장별 펜스, 27.43m 베이스, 마운드 중심 29m 내야 흙, 워닝트랙
function _geoBox() {
  const st = (window.STADIUMS || {})[(window.AS || {}).stadium] || (window.STADIUMS || {}).standard
    || { lfDist: 90, cfDist: 120, rfDist: 90, grass: ['#1f4d24', '#193f1d', '#112b14'], dirt: '#4a2e10', if: '#7d5028' };
  const kl = st.lfDist / st.cfDist, kr = st.rfDist / st.cfDist;
  const R = Math.min(0.9, 0.47 / (Math.SQRT1_2 * Math.max(kl, kr))) * 100;
  const Q = Math.PI / 4;
  const g = { cx: 50, cy: 96.5, R, kl, kr, m: R / st.cfDist, st, Q };
  g.F = phi => { const t = (phi - Q) / (2 * Q); return t < 0.5 ? R * (kl + (1 - kl) * Math.sin(t * Math.PI)) : R * (kr + (1 - kr) * Math.sin((1 - t) * Math.PI)); };
  g.P = (phi, r) => [g.cx - r * Math.cos(phi), g.cy - r * Math.sin(phi)];
  return g;
}

function _field(abs) {
  const fp = window._fieldPos;
  if (!fp) return '';
  const g = _geoBox(), st = g.st, Q = g.Q, m = g.m;
  const xy = p => p.map(v => v.toFixed(2)).join(',');
  const fence = (k, rev) => { const o = []; for (let i = 0; i <= 72; i++) { const ph = rev ? 3 * Q - 2 * Q * i / 72 : Q + 2 * Q * i / 72; o.push(xy(g.P(ph, g.F(ph) * k))); } return o.join(' '); };
  const home = xy([g.cx, g.cy]);
  const fair = `${home} ${fence(1)}`;
  const b = 27.43 * m, md = g.P(2 * Q, 18.44 * m);
  const b1 = g.P(3 * Q, b), b2 = g.P(2 * Q, b * Math.SQRT2), b3 = g.P(Q, b);
  const dc = g.P(2 * Q, b * Math.SQRT1_2), ins = p => [dc[0] + (p[0] - dc[0]) * 0.8, dc[1] + (p[1] - dc[1]) * 0.8];
  const ig = [[g.cx, g.cy], b1, b2, b3].map(ins).map(xy).join(' ');
  let stripes = '';
  for (let r = 6 * m, i = 0; r < g.R * 1.1; r += 6 * m, i++) if (!(i % 2)) stripes += `<circle cx="${g.cx}" cy="${g.cy}" r="${(r + 3 * m).toFixed(2)}" stroke-width="${(6 * m).toFixed(2)}"/>`;
  const base = p => `<rect x="${(p[0] - 1.1).toFixed(2)}" y="${(p[1] - 1.1).toFixed(2)}" width="2.2" height="2.2" transform="rotate(45 ${p[0].toFixed(2)} ${p[1].toFixed(2)})"/>`;
  const lbl = (phi, k, txt) => { const p = g.P(phi, g.F(phi) * k); return `<text class="sp-dist" x="${p[0].toFixed(1)}" y="${(p[1] + 1).toFixed(1)}">${txt}</text>`; };

  let layer = '';
  if (_view === 'zones') {
    // 구역 칸: 저장 좌표(deg·펜스 비율) 기준 → 화면은 _fieldPos로 변환
    const at = (deg, dist) => {
      const ang = Math.max(0.5, Math.min(179.5, deg)) * Math.PI / 180 - Math.PI;
      const p = fp({ x: 0.5 + Math.cos(ang) * dist, y: 1 + Math.sin(ang) * dist });
      return [p[0] * 100, p[1] * 100];
    };
    const arc = (dist, a, b2_, step = 3) => { const o = []; for (let d = a; d <= b2_ + 1e-9; d += step) o.push(xy(at(Math.min(d, b2_), dist))); return o; };
    const tot = abs.length || 1;
    const cells = [];
    DIRS.forEach(d => DEPTHS.forEach(z => {
      const list = abs.filter(a => { const q = _geo(a); return q.deg >= d.a && q.deg < (d.b === 180 ? 181 : d.b) && q.frac >= z.a && q.frac < z.b; });
      cells.push({ d, z, list });
    }));
    const max = Math.max(1, ...cells.map(c => c.list.length));
    layer = cells.map(({ d, z, list }) => {
      const r1 = z.a, r2 = Math.min(z.b, 1.0);
      const pts = [...arc(r2 * 0.97, d.a, d.b), ...arc(Math.max(r1, 0.001) * 0.97, d.a, d.b).reverse()];
      const share = list.length / tot;
      const h = list.filter(a => HITS.includes(a.res)).length;
      const mid = at((d.a + d.b) / 2, ((r1 + r2) / 2) * 0.97);
      const alpha = list.length ? 0.15 + 0.65 * (list.length / max) : 0.04;
      return `<polygon class="sp-cell" points="${pts.join(' ')}" style="fill:rgba(12,20,40,${alpha.toFixed(2)})"><title>${d.l} ${z.l}: 타구 ${list.length}개 (${pct(share)}) · 안타 ${h}</title></polygon>`
        + (list.length ? `<text class="sp-cell-t" x="${mid[0].toFixed(1)}" y="${(mid[1] + 1.3).toFixed(1)}">${Math.round(share * 100)}%</text>` : '');
    }).join('');
  } else {
    const order = { out: 0, '1b': 1, xbh: 2, hr: 3 };
    layer = abs.slice().sort((a, b_) => order[TYPE(a)] - order[TYPE(b_)]).map(a => {
      const p = fp(a);
      const x = (p[0] * 100).toFixed(1), y = (p[1] * 100).toFixed(1), t = TYPE(a);
      const tip = `<title>${_esc(a.bname || '')} · ${_esc(a.res)}${a.inn ? ' · ' + _esc(a.inn) : ''}</title>`;
      if (t === 'hr') return `<path class="d-hr" d="M${x} ${+y - 2.6}l2.6 2.6-2.6 2.6-2.6-2.6z">${tip}</path>`;
      if (t === 'xbh') return `<rect class="d-xbh" x="${+x - 1.7}" y="${+y - 1.7}" width="3.4" height="3.4" rx=".6">${tip}</rect>`;
      return `<circle class="d-${t}" cx="${x}" cy="${y}" r="${t === 'out' ? 1.5 : 1.8}">${tip}</circle>`;
    }).join('');
  }
  const lp = g.P(Q, g.F(Q)), rp = g.P(3 * Q, g.F(3 * Q));
  // 거리 표기는 구역 보기에서 칸 숫자와 겹쳐서 점 보기에서만
  return `
    <svg class="sp-field" viewBox="0 0 100 100" role="img" aria-label="스프레이 차트 · 타구 ${abs.length}개">
      <defs>
        <linearGradient id="spFoul" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${st.grass[2]}"/><stop offset="1" stop-color="${st.grass[1]}"/></linearGradient>
        <radialGradient id="spFair" gradientUnits="userSpaceOnUse" cx="${g.cx}" cy="${g.cy}" r="${g.R.toFixed(2)}"><stop offset="0" stop-color="${st.grass[0]}"/><stop offset=".55" stop-color="${st.grass[1]}"/><stop offset="1" stop-color="${st.grass[2]}"/></radialGradient>
        <clipPath id="spFairClip"><polygon points="${fair}"/></clipPath>
      </defs>
      <rect width="100" height="100" fill="url(#spFoul)"/><rect width="100" height="100" fill="rgba(0,0,0,.38)"/>
      <polygon points="${fair}" fill="url(#spFair)"/>
      <g clip-path="url(#spFairClip)">
        <g class="sp-stripes">${stripes}</g>
        <circle cx="${md[0].toFixed(2)}" cy="${md[1].toFixed(2)}" r="${(29 * m).toFixed(2)}" fill="${st.if}"/>
      </g>
      <polygon points="${fence(1)} ${fence(0.93, true)}" fill="${st.dirt}"/>
      <polygon points="${ig}" fill="${st.grass[0]}"/>
      <circle cx="${md[0].toFixed(2)}" cy="${md[1].toFixed(2)}" r="${(2.9 * m).toFixed(2)}" fill="${st.if}"/>
      <circle cx="${g.cx}" cy="${g.cy}" r="${(4 * m).toFixed(2)}" fill="${st.if}"/>
      <polyline class="sp-fence" points="${fence(1)}"/>
      <polyline class="sp-line" points="${xy(lp)} ${home} ${xy(rp)}"/>
      <polyline class="sp-bline" points="${xy(b1)} ${xy(b2)} ${xy(b3)}"/>
      <g class="sp-bases">${base(b1)}${base(b2)}${base(b3)}</g>
      ${_view === 'zones' ? '' : lbl(Q + 0.1, 0.84, st.lfDist + 'm') + lbl(2 * Q, 0.86, st.cfDist + 'm') + lbl(3 * Q - 0.1, 0.84, st.rfDist + 'm')}
      ${layer}
    </svg>`;
}

// ── 렌더 ─────────────────────────────────────────────────────
function _render() {
  const v = document.getElementById('sprayView');
  if (!v) return;
  const src = _source();
  // 상세 필터(구종·결과·투수 손·카운트): filter.js 패널과 같은 판정을 그대로 쓴다
  const pass = window._sfPass || (() => true);
  const nFilter = window._sfCount ? window._sfCount() : 0;
  const scoped = _filterWho(src).filter(a => pass(a));
  const bip = scoped.filter(a => a.x != null && a.y != null);
  const shown = bip.filter(a => _res[TYPE(a)]);
  const st = calcStats(scoped);

  const seg = (k, cur, opts) => `<div class="an-seg" role="tablist">${opts.map(([val, l]) => `<button role="tab" class="${cur === val ? 'on' : ''}" aria-selected="${cur === val}" onclick="setSprayView('${k}','${val}')">${l}</button>`).join('')}</div>`;
  const ps = _players(src);
  const RES = [['1b', '단타'], ['xbh', '2·3루타'], ['hr', '홈런'], ['out', '아웃']];
  const counts = { '1b': 0, xbh: 0, hr: 0, out: 0 };
  bip.forEach(a => counts[TYPE(a)]++);

  const ctrls = `
    <div class="sp-ctrls">
      ${seg('scope', _scope, [['game', '이번 경기'], ['season', '시즌 전체']])}
      ${seg('view', _view, [['dots', '타구 점'], ['zones', '구역 비율']])}
    </div>
    <div class="sp-ctrls">
      <label class="sp-who"><span>대상</span>
        <select onchange="setSprayView('who',this.value)" aria-label="대상">
          <option value="all"${_who === 'all' ? ' selected' : ''}>양 팀 전체</option>
          <option value="home"${_who === 'home' ? ' selected' : ''}>홈 팀</option>
          <option value="away"${_who === 'away' ? ' selected' : ''}>원정 팀</option>
          ${ps.map(p => `<option value="p:${_esc(p.n)}"${_who === 'p:' + p.n ? ' selected' : ''}>${_esc(p.n)} (${p.c}타석)</option>`).join('')}
        </select>
      </label>
      <button type="button" class="sp-more${nFilter ? ' on' : ''}" onclick="_sfOpen && _sfOpen()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
        상세 필터${nFilter ? `<b>${nFilter}</b>` : ''}
      </button>
      <div class="sp-res" role="group" aria-label="결과 필터">
        ${RES.map(([k, l]) => `<button type="button" class="sp-rc k-${k}${_res[k] ? ' on' : ''}" aria-pressed="${_res[k]}" onclick="setSprayView('res','${k}')"><i></i>${l}<small>${counts[k]}</small></button>`).join('')}
      </div>
    </div>`;

  if (!bip.length) {
    if (nFilter) {
      v.innerHTML = ctrls + emptyState('필터에 맞는 타구가 없어요', `상세 필터 ${nFilter}개가 켜져 있어요. <button type="button" class="an-link-btn" onclick="_sfReset && _sfReset()">필터 초기화</button>`);
      return;
    }
    v.innerHTML = ctrls + emptyState(_scope === 'game' ? '이번 경기에 기록된 타구가 없어요' : '기록된 타구가 없어요', '기록 탭 필드에서 타구 위치를 누르면 여기에 쌓여요.');
    return;
  }

  // 방향 · 깊이 요약
  const dirRows = DIRS.map(d => {
    const list = bip.filter(a => { const g = _geo(a); return g.deg >= d.a && g.deg < (d.b === 180 ? 181 : d.b); });
    const h = list.filter(a => HITS.includes(a.res)).length;
    const x = list.filter(a => ['2루타', '3루타', '홈런'].includes(a.res)).length;
    return { ...d, n: list.length, h, x };
  });
  const dmax = Math.max(1, ...dirRows.map(r => r.n));
  const depth = [
    ['내야', bip.filter(a => _geo(a).frac < 0.42 && a.res !== '홈런').length],
    ['외야 앞', bip.filter(a => { const f = _geo(a).frac; return f >= 0.42 && f < 0.75 && a.res !== '홈런'; }).length],
    ['외야 뒤', bip.filter(a => _geo(a).frac >= 0.75 && a.res !== '홈런').length],
    ['담장 밖', bip.filter(a => a.res === '홈런').length],
  ];
  const ft = bip.filter(a => HITS.includes(a.res) && a.ft).map(a => a.ft);

  v.innerHTML = ctrls + `
    <div class="sp-main">
      <section class="an-card sp-field-card">
        ${_field(shown)}
        <div class="an-spray-key">
          <span><i class="k-1b"></i>단타</span><span><i class="k-xbh"></i>2·3루타</span><span><i class="k-hr"></i>홈런</span><span><i class="k-out"></i>아웃</span>
          ${_view === 'zones' ? '<span class="sp-key-note">칸 숫자 = 전체 타구 중 비율</span>' : ''}
        </div>
      </section>
      <div class="sp-side">
        <section class="sp-kpis">
          <div><span>타구</span><b>${bip.length}</b></div>
          <div><span>안타</span><b>${bip.filter(a => HITS.includes(a.res)).length}</b></div>
          <div><span>타율</span><b>${st.ab ? f3(st.avg) : '—'}</b></div>
          <div><span>장타율</span><b>${st.ab ? f3(st.slg) : '—'}</b></div>
        </section>
        <section class="an-card">
          <header class="an-hd"><h3>방향별</h3><span class="an-hd-note">좌익 → 우익 (필드 기준)</span></header>
          <div class="sp-dirs">${dirRows.map(r => `
            <div class="sp-dir" title="${r.l}: 타구 ${r.n} · 안타 ${r.h} · 장타 ${r.x}">
              <span class="sp-dir-l">${r.l}</span>
              <span class="sp-dir-bar"><i style="width:${r.n / dmax * 100}%"></i></span>
              <span class="sp-dir-v"><b>${r.n}</b><small>${r.n ? `안타 ${r.h}` : ''}</small></span>
            </div>`).join('')}
          </div>
        </section>
        <section class="an-card">
          <header class="an-hd"><h3>타구 깊이</h3>${ft.length ? `<span class="an-hd-note">안타 평균 ${Math.round(ft.reduce((a, b) => a + b, 0) / ft.length)}ft</span>` : ''}</header>
          <div class="sp-depth" role="img" aria-label="${depth.map(d => d[0] + ' ' + d[1]).join(', ')}">
            ${depth.map(([l, n], i) => n ? `<i class="dp${i}" style="flex:${n}" title="${l} ${n}개">${Math.round(n / bip.length * 100)}%</i>` : '').join('')}
          </div>
          <div class="sp-depth-l">${depth.map(([l, n], i) => `<span><i class="dp${i}"></i>${l} ${n}</span>`).join('')}</div>
        </section>
      </div>
    </div>
    <div class="sp-acts">
      <button type="button" class="tm-act" onclick="exportSprayPNG()"><span class="tm-act-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 20h14"/></svg></span><b>PNG 저장</b><small>기록 필드 이미지</small></button>
      <button type="button" class="tm-act" onclick="exportShareCard()"><span class="tm-act-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><b>성적 카드</b><small>SNS·카톡 공유용</small></button>
    </div>`;
}

// 상세 필터 패널의 적용·초기화 뒤 새 화면도 다시 그린다 (패널 버튼은 onclick 문자열로 window 함수를 부름)
function _hookFilter() {
  ['_sfApply', '_sfReset'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig._sp) return;
    const wrapped = function () {
      try { orig.apply(this, arguments); } catch (e) {}
      if (document.getElementById('sprayView')) openSprayView();
    };
    wrapped._sp = true;
    window[fn] = wrapped;
  });
}

if (typeof window !== 'undefined') {
  _hookFilter();
  window.openSprayView = openSprayView;
  window.setSprayView = setSprayView;
}
