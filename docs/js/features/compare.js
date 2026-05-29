// Player comparison: side-by-side radar chart and stat table
const HITS = ['안타','내야안타','2루타','3루타','홈런'];
const NOAB = ['볼넷','사구','희타','희비'];
const BASE = {'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};

let _selectedPlayer1 = null;
let _selectedPlayer2 = null;

export function openCompareView() {
  document.querySelectorAll('.savant-view').forEach(v => v.classList.remove('active'));
  document.getElementById('compareView').classList.add('active');
  _selectedPlayer1 = null;
  _selectedPlayer2 = null;
  renderComparePlayerSelects();
}

export function renderComparePlayerSelects() {
  const sel1 = document.getElementById('compareSelect1');
  const sel2 = document.getElementById('compareSelect2');
  if (!sel1 || !sel2) return;

  const players = _getAllPlayers();
  if (!players.length) {
    sel1.innerHTML = '<option value="">선수 없음</option>';
    sel2.innerHTML = '<option value="">선수 없음</option>';
    return;
  }

  const opts = '<option value="">선수 선택</option>' +
    players.map(p => `<option value="${_esc(p.name)}">#${p.num} ${_esc(p.name)}</option>`).join('');
  sel1.innerHTML = opts;
  sel2.innerHTML = opts;

  sel1.onchange = () => { _selectedPlayer1 = sel1.value || null; };
  sel2.onchange = () => { _selectedPlayer2 = sel2.value || null; };
}

export function runPlayerCompare() {
  const sel1 = document.getElementById('compareSelect1');
  const sel2 = document.getElementById('compareSelect2');
  const name1 = (sel1 && sel1.value) || _selectedPlayer1;
  const name2 = (sel2 && sel2.value) || _selectedPlayer2;

  if (!name1 || !name2) {
    const el = document.getElementById('compareContent');
    if (el) el.innerHTML = '<div class="empty-state">두 선수를 모두 선택하세요</div>';
    return;
  }
  if (name1 === name2) {
    const el = document.getElementById('compareContent');
    if (el) el.innerHTML = '<div class="empty-state">서로 다른 선수를 선택하세요</div>';
    return;
  }

  const stats1 = _aggregateStats(name1);
  const stats2 = _aggregateStats(name2);
  _renderComparison(stats1, stats2);
}

function _getAllPlayers() {
  const map = {};
  const AS = window.AS;
  [...(AS.home_lineup||[]), ...(AS.away_lineup||[])].forEach(p => {
    map[p.name+'_'+p.num] = { id: p.id, name: p.name, num: p.num };
  });
  const saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
  saves.forEach(s => {
    try {
      const d = JSON.parse(localStorage.getItem(s.key));
      if (!d) return;
      [...(d.home_lineup||[]), ...(d.away_lineup||[])].forEach(p => {
        map[p.name+'_'+p.num] = { id: p.id, name: p.name, num: p.num };
      });
    } catch(e) {}
  });
  return Object.values(map);
}

function _aggregateStats(name) {
  const allAbs = [];

  // Current game
  const AS = window.AS;
  const currentAbs = (AS.abs||[]).filter(a => a.bname === name);
  if (currentAbs.length) allAbs.push(...currentAbs);

  // Saved games
  const saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
  saves.forEach(s => {
    try {
      const d = JSON.parse(localStorage.getItem(s.key));
      if (!d || !d.abs) return;
      const pAbs = d.abs.filter(a => a.bname === name);
      if (pAbs.length) allAbs.push(...pAbs);
    } catch(e) {}
  });

  const pa = allAbs.length;
  const ab = allAbs.filter(a => !NOAB.includes(a.res)).length;
  const h = allAbs.filter(a => HITS.includes(a.res)).length;
  const bb = allAbs.filter(a => a.res === '볼넷' || a.res === '사구').length;
  const k = allAbs.filter(a => a.res === '삼진').length;
  const hr = allAbs.filter(a => a.res === '홈런').length;
  const xbh = allAbs.filter(a => ['2루타','3루타','홈런'].includes(a.res)).length;
  const rbi = allAbs.reduce((s, a) => s + (a.rbi||0), 0);
  const tb = allAbs.reduce((s, a) => s + (BASE[a.res]||0), 0);
  const sf = allAbs.filter(a => a.res === '희비').length;
  const hbp = allAbs.filter(a => a.res === '사구').length;

  const avg = ab ? h / ab : 0;
  const obp = (ab + bb + sf) ? (h + bb) / (ab + bb + sf) : 0;
  const slg = ab ? tb / ab : 0;
  const ops = obp + slg;
  const babip = (ab - k - hr + sf) ? (h - hr) / (ab - k - hr + sf) : 0;
  const kRate = pa ? k / pa : 0;
  const bbRate = pa ? bb / pa : 0;
  const isoP = slg - avg;

  // wOBA
  const wBB = 0.69, wHBP = 0.72, w1B = 0.87, w2B = 1.22, w3B = 1.56, wHR = 1.95;
  const singles = allAbs.filter(a => a.res === '안타' || a.res === '내야안타').length;
  const doubles = allAbs.filter(a => a.res === '2루타').length;
  const triples = allAbs.filter(a => a.res === '3루타').length;
  const woba = (ab + bb + sf + hbp) ?
    (wBB*bb + wHBP*hbp + w1B*singles + w2B*doubles + w3B*triples + wHR*hr) / (ab + bb + sf + hbp) : 0;

  // Direction
  const dabs = allAbs.filter(a => a.deg != null);
  const pull = dabs.filter(a => a.deg < 72).length;
  const center = dabs.filter(a => a.deg >= 72 && a.deg <= 108).length;
  const oppo = dabs.length - pull - center;

  return { name, pa, ab, h, bb, k, hr, xbh, rbi, tb, avg, obp, slg, ops, babip, kRate, bbRate, isoP, woba, pull, center, oppo, dabs: dabs.length, sf, hbp };
}

function _renderComparison(s1, s2) {
  const el = document.getElementById('compareContent');
  if (!el) return;

  const f3 = v => v.toFixed(3).replace('0.','.');
  const pct = v => Math.round(v * 100) + '%';

  const rows = [
    { label: '타석 (PA)', v1: s1.pa, v2: s2.pa, fmt: 'int' },
    { label: '타수 (AB)', v1: s1.ab, v2: s2.ab, fmt: 'int' },
    { label: '안타 (H)', v1: s1.h, v2: s2.h, fmt: 'int' },
    { label: '홈런 (HR)', v1: s1.hr, v2: s2.hr, fmt: 'int' },
    { label: '장타 (XBH)', v1: s1.xbh, v2: s2.xbh, fmt: 'int' },
    { label: '타점 (RBI)', v1: s1.rbi, v2: s2.rbi, fmt: 'int' },
    { label: '타율 (AVG)', v1: s1.avg, v2: s2.avg, fmt: 'f3' },
    { label: '출루율 (OBP)', v1: s1.obp, v2: s2.obp, fmt: 'f3' },
    { label: '장타율 (SLG)', v1: s1.slg, v2: s2.slg, fmt: 'f3' },
    { label: 'OPS', v1: s1.ops, v2: s2.ops, fmt: 'f3' },
    { label: 'wOBA', v1: s1.woba, v2: s2.woba, fmt: 'f3' },
    { label: 'BABIP', v1: s1.babip, v2: s2.babip, fmt: 'f3' },
    { label: 'ISO', v1: s1.isoP, v2: s2.isoP, fmt: 'f3' },
    { label: 'K%', v1: s1.kRate, v2: s2.kRate, fmt: 'pct', lower: true },
    { label: 'BB%', v1: s1.bbRate, v2: s2.bbRate, fmt: 'pct' },
    { label: '볼넷 (BB)', v1: s1.bb, v2: s2.bb, fmt: 'int' },
    { label: '삼진 (K)', v1: s1.k, v2: s2.k, fmt: 'int', lower: true },
  ];

  const fmtVal = (v, fmt) => {
    if (fmt === 'f3') return f3(v);
    if (fmt === 'pct') return pct(v);
    return String(v);
  };

  const tableRows = rows.map(r => {
    const better1 = r.lower ? r.v1 < r.v2 : r.v1 > r.v2;
    const better2 = r.lower ? r.v2 < r.v1 : r.v2 > r.v1;
    const equal = r.v1 === r.v2;
    const cls1 = !equal && better1 ? ' class="compare-better"' : '';
    const cls2 = !equal && better2 ? ' class="compare-better"' : '';
    return `<tr><td${cls1}>${fmtVal(r.v1, r.fmt)}</td><td class="compare-label">${r.label}</td><td${cls2}>${fmtVal(r.v2, r.fmt)}</td></tr>`;
  }).join('');

  el.innerHTML = `
    <div class="compare-header">
      <div class="compare-player p1">${_esc(s1.name)}</div>
      <div class="compare-vs">VS</div>
      <div class="compare-player p2">${_esc(s2.name)}</div>
    </div>

    <div class="compare-radar-wrap">
      <canvas id="compareRadarCanvas" width="300" height="300" style="width:100%;max-width:300px;max-height:300px;display:block;margin:0 auto"></canvas>
      <div class="compare-legend">
        <span class="legend-dot" style="background:#4b8cf5"></span>${_esc(s1.name)}
        <span class="legend-dot" style="background:#2dd4a0;margin-left:16px"></span>${_esc(s2.name)}
      </div>
    </div>

    <table class="compare-table">
      <thead><tr><th>${_esc(s1.name)}</th><th></th><th>${_esc(s2.name)}</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <div class="compare-direction-section">
      <div class="compare-direction-title">타구 방향 비교</div>
      <div class="compare-direction-row">
        <div class="compare-dir-col">
          ${_dirBar(s1)}
        </div>
        <div class="compare-dir-col">
          ${_dirBar(s2)}
        </div>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    _drawRadarChart('compareRadarCanvas', s1, s2);
  });
}

function _dirBar(stats) {
  const tot = stats.dabs || 1;
  return `
    <div class="dir-label">${_esc(stats.name)}</div>
    <div class="direction-bar compact">
      <div class="dir-seg pull" style="flex:${stats.pull||1}">${Math.round(stats.pull/tot*100)}%</div>
      <div class="dir-seg center" style="flex:${stats.center||1}">${Math.round(stats.center/tot*100)}%</div>
      <div class="dir-seg oppo" style="flex:${stats.oppo||1}">${Math.round(stats.oppo/tot*100)}%</div>
    </div>
  `;
}

export function _drawRadarChart(canvasId, s1, s2) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const SIZE = 300;
  c.width = SIZE * dpr; c.height = SIZE * dpr;
  c.style.width = SIZE + 'px'; c.style.height = SIZE + 'px';
  ctx.scale(dpr, dpr);

  const cx = SIZE / 2, cy = SIZE / 2;
  const radius = 110;
  const labels = ['AVG', 'OBP', 'SLG', 'K%', 'BB%', 'ISO'];
  const axes = 6;
  const angleStep = (Math.PI * 2) / axes;
  const startAngle = -Math.PI / 2; // Start from top

  // Normalization maxima for each axis
  const maxVals = [0.400, 0.500, 0.700, 0.400, 0.200, 0.300];

  // Normalize values (K% is inverted: lower is better)
  const norm = (val, idx) => {
    const clamped = Math.min(val, maxVals[idx]);
    const ratio = clamped / maxVals[idx];
    return idx === 3 ? (1 - ratio) : ratio; // Invert K%
  };

  const vals1 = [s1.avg, s1.obp, s1.slg, s1.kRate, s1.bbRate, s1.isoP];
  const vals2 = [s2.avg, s2.obp, s2.slg, s2.kRate, s2.bbRate, s2.isoP];

  // Background
  ctx.fillStyle = '#0e1018';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Grid rings (hexagons)
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0];
  rings.forEach(r => {
    ctx.beginPath();
    for (let i = 0; i < axes; i++) {
      const angle = startAngle + i * angleStep;
      const x = cx + Math.cos(angle) * radius * r;
      const y = cy + Math.sin(angle) * radius * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  });

  // Axis lines
  for (let i = 0; i < axes; i++) {
    const angle = startAngle + i * angleStep;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Axis labels
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7c8898';
  for (let i = 0; i < axes; i++) {
    const angle = startAngle + i * angleStep;
    const lx = cx + Math.cos(angle) * (radius + 18);
    const ly = cy + Math.sin(angle) * (radius + 18);
    ctx.fillText(labels[i], lx, ly);
  }

  // Draw player polygon
  const _drawPoly = (vals, color, fillAlpha) => {
    ctx.beginPath();
    for (let i = 0; i < axes; i++) {
      const angle = startAngle + i * angleStep;
      const r = norm(vals[i], i) * radius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Fill
    const rgb = _hexToRgb(color);
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${fillAlpha})`;
    ctx.fill();

    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dots
    for (let i = 0; i < axes; i++) {
      const angle = startAngle + i * angleStep;
      const r = norm(vals[i], i) * radius;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  };

  _drawPoly(vals1, '#4b8cf5', 0.15);
  _drawPoly(vals2, '#2dd4a0', 0.15);
}

function _hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Expose to window for onclick handlers
if (typeof window !== 'undefined') {
  window.openCompareView = openCompareView;
  window.renderComparePlayerSelects = renderComparePlayerSelects;
  window.runPlayerCompare = runPlayerCompare;
}
