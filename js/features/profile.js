import { HITS, NOAB, BASE, WOBA_W, esc as _esc } from '../constants.js';

export function openProfileView() {
  document.querySelectorAll('.savant-view').forEach(v => v.classList.remove('active'));
  document.getElementById('profileView').classList.add('active');
  renderProfilePlayerList();
}

export function renderProfilePlayerList() {
  const el = document.getElementById('profilePlayerList');
  if (!el) return;
  const players = _getAllPlayers();
  if (!players.length) {
    el.innerHTML = '<div class="empty-state">저장된 선수 데이터가 없습니다</div>';
    return;
  }
  // data-key="name||num" 으로 식별, onclick에서 this 전달
  el.innerHTML = players.map(p => {
    const key = _esc(p.name) + '||' + _esc(String(p.num ?? ''));
    return `<button class="profile-player-btn" data-key="${key}" data-name="${_esc(p.name)}"
      onclick="(function(btn){
        btn.closest('.profile-player-list').querySelectorAll('.profile-player-btn').forEach(function(b){b.classList.remove('active');});
        btn.classList.add('active');
        window.selectProfilePlayer('${_esc(String(p.id))}','${_esc(p.name)}','${_esc(String(p.num ?? ''))}',btn);
      })(this)">${_esc(p.name)}<span class="ppb-num">#${_esc(String(p.num ?? ''))}</span></button>`;
  }).join('');
}

export function selectProfilePlayer(id, name, num, btn) {
  // btn이 전달된 경우 active는 이미 renderProfilePlayerList의 onclick에서 처리됨
  // fallback: data-name 으로 버튼을 찾아 active 처리
  if (!btn) {
    const list = document.getElementById('profilePlayerList');
    if (list) {
      list.querySelectorAll('.profile-player-btn').forEach(b => b.classList.remove('active'));
      const found = list.querySelector(`.profile-player-btn[data-name="${name}"]`);
      if (found) found.classList.add('active');
    }
  }
  const data = _aggregatePlayerStats(id, name);
  _renderProfileCard(data);
}

// ── 선수 목록: name 기준 dedup, 최신 저장순 우선 ──────────
function _getAllPlayers() {
  const map = {};

  const _add = p => {
    if (!p || !p.name) return;
    const key = p.name; // name 기준 dedup
    if (!map[key]) map[key] = { id: p.id, name: p.name, num: p.num };
  };

  const AS = window.AS;
  // 현재 경기 라인업
  [...(AS.home_lineup||[]), ...(AS.away_lineup||[])].forEach(_add);

  // 저장 경기 라인업 — 최신순 정렬 후 없을 때만 추가
  const saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
  saves.slice().reverse().forEach(s => {
    try {
      const d = JSON.parse(localStorage.getItem(s.key));
      if (!d) return;
      [...(d.home_lineup||[]), ...(d.away_lineup||[])].forEach(_add);
    } catch(e) {}
  });

  return Object.values(map);
}

function _aggregatePlayerStats(id, name) {
  const allAbs = [];
  const gameStats = [];

  const AS = window.AS;
  const currentAbs = (AS.abs||[]).filter(a => a.bname === name);
  if (currentAbs.length) {
    allAbs.push(...currentAbs);
    gameStats.push({ date: '현재 경기', abs: currentAbs });
  }

  const saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
  saves.forEach(s => {
    try {
      const d = JSON.parse(localStorage.getItem(s.key));
      if (!d || !d.abs) return;
      const pAbs = d.abs.filter(a => a.bname === name);
      if (pAbs.length) {
        allAbs.push(...pAbs);
        gameStats.push({ date: d.d || '날짜 없음', abs: pAbs });
      }
    } catch(e) {}
  });

  return _calcCareerStats(name, allAbs, gameStats);
}

function _calcCareerStats(name, allAbs, gameStats) {
  const pa = allAbs.length;
  const ab = allAbs.filter(a => !NOAB.includes(a.res)).length;
  const h = allAbs.filter(a => HITS.includes(a.res)).length;
  // bb = 볼넷만 (사구 제외) — wOBA/OBP 이중계산 방지
  const bb = allAbs.filter(a => a.res === '볼넷').length;
  const hbp = allAbs.filter(a => a.res === '사구').length;
  const k = allAbs.filter(a => a.res === '삼진').length;
  const hr = allAbs.filter(a => a.res === '홈런').length;
  const xbh = allAbs.filter(a => ['2루타','3루타','홈런'].includes(a.res)).length;
  const rbi = allAbs.reduce((s, a) => s + (a.rbi||0), 0);
  const tb = allAbs.reduce((s, a) => s + (BASE[a.res]||0), 0);
  const sf = allAbs.filter(a => a.res === '희비').length;

  const avg = ab ? h / ab : 0;
  // 표준 OBP: (H + BB + HBP) / (AB + BB + HBP + SF)
  const obp = (ab + bb + hbp + sf) ? (h + bb + hbp) / (ab + bb + hbp + sf) : 0;
  const slg = ab ? tb / ab : 0;
  const ops = obp + slg;
  const babip = (ab - k - hr + sf) ? (h - hr) / (ab - k - hr + sf) : 0;
  const kRate = pa ? k / pa : 0;
  const bbRate = pa ? bb / pa : 0; // 볼넷% (사구 제외)
  const isoP = slg - avg;

  const dabs = allAbs.filter(a => a.deg != null);
  const pull = dabs.filter(a => a.deg < 72).length;
  const center = dabs.filter(a => a.deg >= 72 && a.deg <= 108).length;
  const oppo = dabs.length - pull - center;

  // wOBA (constants.js WOBA_W 통일)
  const singles = allAbs.filter(a => a.res === '안타' || a.res === '내야안타').length;
  const doubles = allAbs.filter(a => a.res === '2루타').length;
  const triples = allAbs.filter(a => a.res === '3루타').length;
  const wobaDen = ab + bb + hbp + sf;
  const woba = wobaDen ?
    (WOBA_W.bb*bb + WOBA_W.hbp*hbp + WOBA_W.s1*singles + WOBA_W.s2*doubles + WOBA_W.s3*triples + WOBA_W.hr*hr) / wobaDen : 0;

  const trend = gameStats.map(g => {
    const gab = g.abs.filter(a => !NOAB.includes(a.res)).length;
    const gh = g.abs.filter(a => HITS.includes(a.res)).length;
    return { date: g.date, avg: gab ? gh/gab : 0, pa: g.abs.length };
  });

  return { name, pa, ab, h, bb, hbp, k, hr, xbh, rbi, tb, avg, obp, slg, ops, babip, kRate, bbRate, isoP, woba, pull, center, oppo, dabs: dabs.length, trend, games: gameStats.length };
}

function _renderProfileCard(data) {
  const el = document.getElementById('profileContent');
  if (!el) return;
  const f3 = v => v.toFixed(3).replace('0.','.');
  const pct = v => Math.round(v * 100) + '%';
  const tot = data.dabs || 1;

  el.innerHTML = `
    <div class="profile-header">
      <div class="profile-name">${_esc(data.name)}</div>
      <div class="profile-meta">${data.games}경기 · ${data.pa}타석</div>
    </div>

    <div class="career-stat-grid">
      <div class="career-card accent-yellow"><div class="cc-val">${f3(data.avg)}</div><div class="cc-lbl">AVG</div></div>
      <div class="career-card accent-green"><div class="cc-val">${f3(data.obp)}</div><div class="cc-lbl">OBP</div></div>
      <div class="career-card accent-blue"><div class="cc-val">${f3(data.slg)}</div><div class="cc-lbl">SLG</div></div>
      <div class="career-card accent-purple"><div class="cc-val">${f3(data.ops)}</div><div class="cc-lbl">OPS</div></div>
    </div>

    <div class="career-stat-grid small">
      <div class="career-card"><div class="cc-val">${f3(data.woba)}</div><div class="cc-lbl">wOBA</div></div>
      <div class="career-card"><div class="cc-val">${f3(data.babip)}</div><div class="cc-lbl">BABIP</div></div>
      <div class="career-card"><div class="cc-val">${f3(data.isoP)}</div><div class="cc-lbl">ISO</div></div>
      <div class="career-card"><div class="cc-val">${pct(data.kRate)}</div><div class="cc-lbl">K%</div></div>
      <div class="career-card"><div class="cc-val">${pct(data.bbRate)}</div><div class="cc-lbl">BB%</div></div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">타구 방향 분포</div>
      <div class="direction-bar">
        <div class="dir-seg pull" style="flex:${data.pull||1}">${Math.round(data.pull/tot*100)}%<br><span>당겨</span></div>
        <div class="dir-seg center" style="flex:${data.center||1}">${Math.round(data.center/tot*100)}%<br><span>중앙</span></div>
        <div class="dir-seg oppo" style="flex:${data.oppo||1}">${Math.round(data.oppo/tot*100)}%<br><span>밀어</span></div>
      </div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">주요 기록</div>
      <div class="profile-records">
        <div class="pr-item"><span class="pr-val">${data.h}</span><span class="pr-lbl">안타</span></div>
        <div class="pr-item"><span class="pr-val">${data.hr}</span><span class="pr-lbl">홈런</span></div>
        <div class="pr-item"><span class="pr-val">${data.rbi}</span><span class="pr-lbl">타점</span></div>
        <div class="pr-item"><span class="pr-val">${data.xbh}</span><span class="pr-lbl">장타</span></div>
        <div class="pr-item"><span class="pr-val">${data.bb}</span><span class="pr-lbl">볼넷</span></div>
        <div class="pr-item"><span class="pr-val">${data.k}</span><span class="pr-lbl">삼진</span></div>
      </div>
    </div>

    ${data.trend.length > 1 ? `
    <div class="profile-section">
      <div class="profile-section-title">경기별 타율 추이</div>
      <canvas id="profileTrendCanvas" width="320" height="120" style="width:100%;max-height:120px"></canvas>
    </div>` : ''}
  `;

  if (data.trend.length > 1) {
    requestAnimationFrame(() => _drawTrendChart(data.trend));
  }
}

function _drawTrendChart(trend) {
  const c = document.getElementById('profileTrendCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = 320, H = 120;
  c.width = W * dpr; c.height = H * dpr;
  c.style.width = W + 'px'; c.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#0e1018';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 0.5;
  [0.2, 0.3, 0.4].forEach(v => {
    const y = H - 10 - (v / 0.5) * (H - 25);
    ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(W - 10, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(v.toFixed(3).replace('0.','.'), 28, y + 3);
  });

  const n = trend.length;
  const xStep = (W - 50) / Math.max(n - 1, 1);

  ctx.beginPath();
  ctx.strokeStyle = '#4b8cf5';
  ctx.lineWidth = 2;
  trend.forEach((t, i) => {
    const x = 35 + i * xStep;
    const y = H - 10 - (t.avg / 0.5) * (H - 25);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  trend.forEach((t, i) => {
    const x = 35 + i * xStep;
    const y = H - 10 - (t.avg / 0.5) * (H - 25);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = t.avg >= 0.3 ? '#2dd4a0' : t.avg >= 0.2 ? '#f6c23e' : '#f56565';
    ctx.fill();

    // X축 레이블 (날짜 또는 경기번호)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    const raw = t.date || '';
    // 날짜 형식(YYYY-MM-DD 또는 YYYY.MM.DD) → MM/DD, 아니면 경기N
    const dateMatch = raw.match(/\d{4}[.\-](\d{1,2})[.\-](\d{1,2})/);
    const lbl = dateMatch ? dateMatch[1] + '/' + dateMatch[2] : (raw === '현재 경기' ? '현재' : `G${i+1}`);
    ctx.fillText(lbl, x, H - 1);
  });
}

// _esc imported from constants.js

if (typeof window !== 'undefined') {
  window.openProfileView = openProfileView;
  window.selectProfilePlayer = selectProfilePlayer;
  window.renderProfilePlayerList = renderProfilePlayerList;
}
