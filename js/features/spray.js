// 스프레이 차트 — 타구 위치를 필드 위에: 대상(팀/선수) · 범위(이번 경기/시즌) · 결과 필터 · 점/구역 보기
import { HITS, esc as _esc } from '../constants.js';
import { buildData, calcStats, f3, pct, emptyState } from './batdata.js?v=4';

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
function _field(abs) {
  const fp = window._fieldPos;
  if (!fp) return '';
  // 각도를 파울라인 바로 안쪽으로: deg 0에서 sin(-π)의 반올림 오차로 y가 정확히 1이 되면 반대편(180°)으로 계산됨
  const at = (deg, dist) => {
    const ang = Math.max(0.5, Math.min(179.5, deg)) * Math.PI / 180 - Math.PI;
    const p = fp({ x: 0.5 + Math.cos(ang) * dist, y: 1 + Math.sin(ang) * dist });
    return [p[0] * 100, p[1] * 100];
  };
  const P = (deg, dist) => at(deg, dist).map(v => v.toFixed(2)).join(',');
  const arc = (dist, a = 0, b = 180, step = 4) => { const o = []; for (let d = a; d <= b + 1e-9; d += step) o.push(P(Math.min(d, b), dist)); return o; };
  const home = P(90, 0);
  const st = (window.STADIUMS || {})[(window.AS || {}).stadium] || { lfDist: 90, cfDist: 120, rfDist: 90 };

  // 내야 다이아몬드: 1·3루는 파울라인 위(펜스까지의 약 30%), 2루는 중앙
  const b1 = at(180, 0.3), b2 = at(90, 0.33), b3 = at(0, 0.3), hp = at(90, 0);
  const diamond = [hp, b1, b2, b3].map(p => p.map(v => v.toFixed(2)).join(',')).join(' ');

  let layer = '';
  if (_view === 'zones') {
    const tot = abs.length || 1;
    const cells = [];
    DIRS.forEach(d => DEPTHS.forEach(z => {
      const list = abs.filter(a => { const g = _geo(a); return g.deg >= d.a && g.deg < (d.b === 180 ? 181 : d.b) && g.frac >= z.a && g.frac < z.b; });
      cells.push({ d, z, list });
    }));
    const max = Math.max(1, ...cells.map(c => c.list.length));
    layer = cells.map(({ d, z, list }) => {
      const r1 = z.a, r2 = Math.min(z.b, 1.0);
      const pts = [...arc(r2 * 0.97, d.a, d.b, 3), ...arc(Math.max(r1, 0.001) * 0.97, d.a, d.b, 3).reverse()];
      const share = list.length / tot;
      const h = list.filter(a => HITS.includes(a.res)).length;
      const mid = at((d.a + d.b) / 2, ((r1 + r2) / 2) * 0.97);
      const alpha = list.length ? 0.12 + 0.7 * (list.length / max) : 0;
      return `<polygon class="sp-cell" points="${pts.join(' ')}" style="fill:rgba(75,140,245,${alpha.toFixed(2)})"><title>${d.l} ${z.l}: 타구 ${list.length}개 (${pct(share)}) · 안타 ${h}</title></polygon>`
        + (list.length ? `<text class="sp-cell-t" x="${mid[0].toFixed(1)}" y="${(mid[1] + 1.3).toFixed(1)}">${Math.round(share * 100)}%</text>` : '');
    }).join('');
  } else {
    const order = { out: 0, '1b': 1, xbh: 2, hr: 3 };
    layer = abs.slice().sort((a, b) => order[TYPE(a)] - order[TYPE(b)]).map(a => {
      const p = fp(a);
      const x = (p[0] * 100).toFixed(1), y = (p[1] * 100).toFixed(1), t = TYPE(a);
      const tip = `<title>${_esc(a.bname || '')} · ${_esc(a.res)}${a.inn ? ' · ' + _esc(a.inn) : ''}</title>`;
      if (t === 'hr') return `<path class="d-hr" d="M${x} ${+y - 2.6}l2.6 2.6-2.6 2.6-2.6-2.6z">${tip}</path>`;
      if (t === 'xbh') return `<rect class="d-xbh" x="${+x - 1.7}" y="${+y - 1.7}" width="3.4" height="3.4" rx=".6">${tip}</rect>`;
      return `<circle class="d-${t}" cx="${x}" cy="${y}" r="${t === 'out' ? 1.5 : 1.8}">${tip}</circle>`;
    }).join('');
  }
  const lbl = (deg, dist, txt) => { const p = at(deg, dist); return `<text class="sp-dist" x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}">${txt}</text>`; };
  return `
    <svg class="sp-field" viewBox="-2 6 104 94" role="img" aria-label="스프레이 차트 · 타구 ${abs.length}개">
      <polygon class="sp-grass" points="${home} ${arc(0.97).join(' ')}"/>
      <polygon class="sp-warn" points="${arc(0.97).join(' ')} ${arc(0.9).reverse().join(' ')}"/>
      <polygon class="sp-dirt" points="${home} ${arc(0.42).join(' ')}"/>
      <polygon class="sp-inf" points="${diamond}"/>
      <polyline class="sp-fence" points="${arc(0.97).join(' ')}"/>
      <polyline class="sp-line" points="${P(0, 0.97)} ${home} ${P(180, 0.97)}"/>
      ${lbl(8, 0.86, st.lfDist + 'm')}${lbl(90, 0.88, st.cfDist + 'm')}${lbl(172, 0.86, st.rfDist + 'm')}
      ${layer}
    </svg>`;
}

// ── 렌더 ─────────────────────────────────────────────────────
function _render() {
  const v = document.getElementById('sprayView');
  if (!v) return;
  const src = _source();
  const scoped = _filterWho(src);
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
      <div class="sp-res" role="group" aria-label="결과 필터">
        ${RES.map(([k, l]) => `<button type="button" class="sp-rc k-${k}${_res[k] ? ' on' : ''}" aria-pressed="${_res[k]}" onclick="setSprayView('res','${k}')"><i></i>${l}<small>${counts[k]}</small></button>`).join('')}
      </div>
    </div>`;

  if (!bip.length) {
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

if (typeof window !== 'undefined') {
  window.openSprayView = openSprayView;
  window.setSprayView = setSprayView;
}
