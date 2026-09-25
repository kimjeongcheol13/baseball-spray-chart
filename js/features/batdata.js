// 분석 탭 공용 — 기록 모으기 · 타격 지표 계산 · 스프레이/흐름/구종 표 렌더 (비교 · 프로필 · 스카우트 · 팀)
import { HITS, NOAB, BASE, WOBA_W, esc as _esc } from '../constants.js';

// ── 데이터 ────────────────────────────────────────────────────
function _read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

// 저장 경기(오래된 순) + 현재 경기. 같은 타석(id)이 두 번 세어지지 않게 한다
// (현재 경기를 저장했거나 저장 경기를 불러온 경우 같은 id가 양쪽에 있음)
function _loadGames() {
  const AS = window.AS || {};
  const saves = (_read('sl_saves') || []).slice().sort((x, y) => (x.ts || 0) - (y.ts || 0));
  const raw = [];
  saves.forEach(s => {
    const d = _read(s.key);
    if (d) raw.push({
      label: _gameLabel(d, s), abs: d.abs || [], lineups: [...(d.home_lineup || []), ...(d.away_lineup || [])],
      key: s.key, d: d.d || '', ts: d.ts || s.ts || 0, th: d.th || '', ta: d.ta || '', hs: +d.hs || 0, as: +d.as || 0,
      pitchers: d.pitchers || [],
    });
  });
  const val = id => ((document.getElementById(id) || {}).value || '').trim();
  raw.push({
    label: '현재 경기', abs: AS.abs || [], lineups: [...(AS.home_lineup || []), ...(AS.away_lineup || [])], current: true,
    th: val('tHome'), ta: val('tAway'), hs: +AS.hs || 0, as: +AS.as || 0,
    pitchers: AS.pitchers || [],
  });

  const seen = new Set();
  const seenP = new Set();   // 투구 기록도 같은 방식으로 중복 제거
  const uniq = (set, x) => {
    if (!x || x.id == null) return !!x;
    if (set.has(x.id)) return false;
    set.add(x.id);
    return true;
  };
  return raw.map(g => ({
    ...g,
    abs: g.abs.filter(a => uniq(seen, a)),
    pitchers: (g.pitchers || []).map(p => ({ ...p, pitches: (p.pitches || []).filter(x => uniq(seenP, x)) })),
  }));
}

function _gameLabel(d, s) {
  const opp = d.th && d.ta ? `${d.th} vs ${d.ta}` : (s.label || '경기');
  return d.d ? `${d.d} ${opp}` : opp;
}

export function buildData() {
  const games = _loadGames();
  const map = {};
  const add = (name, num, bats) => {
    if (!name) return null;
    if (!map[name]) map[name] = { name, num: num ?? '', bats: {}, pa: 0 };
    if ((map[name].num === '' || map[name].num == null) && num != null) map[name].num = num;
    if (bats) map[name].bats[bats] = (map[name].bats[bats] || 0) + 1;
    return map[name];
  };
  // 최신 경기 라인업이 번호를 먼저 정하도록 역순
  games.slice().reverse().forEach(g => g.lineups.forEach(p => p && add(p.name, p.num, p.bats || p.ba)));
  const all = [];
  games.forEach(g => g.abs.forEach(a => {
    const p = add(a.bname, a.bnum, a.bats);
    if (p) p.pa++;
    all.push(a);
  }));
  const players = Object.values(map).sort((x, y) => y.pa - x.pa || String(x.name).localeCompare(String(y.name), 'ko'));
  return { games, players, pool: calcStats(all) };
}

export function calcStats(abs) {
  const n = r => abs.filter(a => a.res === r).length;
  const pa = abs.length;
  const ab = abs.filter(a => !NOAB.includes(a.res)).length;
  const h = abs.filter(a => HITS.includes(a.res)).length;
  const s1 = n('안타') + n('내야안타'), s2 = n('2루타'), s3 = n('3루타'), hr = n('홈런');
  const bb = n('볼넷');   // 볼넷만 (사구 제외)
  const hbp = n('사구');
  const k = n('삼진');
  const sf = n('희비'), sh = n('희타');
  const rbi = abs.reduce((s, a) => s + (a.rbi || 0), 0);
  const tb = abs.reduce((s, a) => s + (BASE[a.res] || 0), 0);
  const den = ab + bb + hbp + sf;

  const avg = ab ? h / ab : 0;
  const obp = den ? (h + bb + hbp) / den : 0;
  const slg = ab ? tb / ab : 0;
  const babipDen = ab - k - hr + sf;
  const woba = den ? (WOBA_W.bb * bb + WOBA_W.hbp * hbp + WOBA_W.s1 * s1 + WOBA_W.s2 * s2 + WOBA_W.s3 * s3 + WOBA_W.hr * hr) / den : 0;
  const r = x => (pa ? x / pa : 0);

  const dabs = abs.filter(a => a.deg != null);
  const pull = dabs.filter(a => window._isPull && window._isPull(a)).length;
  const center = dabs.filter(a => window._isCtr && window._isCtr(a)).length;

  return {
    pa, ab, h, s1, s2, s3, hr, bb, hbp, k, sf, sh, rbi, tb,
    avg, obp, slg, ops: obp + slg, iso: slg - avg, woba,
    babip: babipDen > 0 ? (h - hr) / babipDen : 0,
    kRate: r(k), bbRate: r(bb), xbhRate: r(s2 + s3 + hr),
    mix1b: r(s1), mixXbh: r(s2 + s3), mixHr: r(hr), mixBb: r(bb + hbp), mixK: r(k),
    mixOut: r(pa - s1 - s2 - s3 - hr - bb - hbp - k),
    dn: dabs.length, pull, center, oppo: dabs.length - pull - center,
  };
}

export function playerData(data, name) {
  const info = data.players.find(p => p.name === name) || { name, num: '', bats: {} };
  const abs = [];
  const games = [];
  data.games.forEach(g => {
    const mine = g.abs.filter(a => a.bname === name);
    if (!mine.length) return;
    abs.push(...mine);
    games.push({ label: g.label, current: !!g.current, abs: mine });
  });
  // 경기별 누적 흐름
  const acc = [];
  const trend = games.map(g => {
    acc.push(...g.abs);
    const c = calcStats(acc);
    return { label: g.label, avg: c.avg, ops: c.ops, pa: g.abs.length };
  });
  // 구종별 (마지막 공 구종 기준)
  const byPt = {};
  abs.forEach(a => { if (a.pt) (byPt[a.pt] = byPt[a.pt] || []).push(a); });
  const pitch = {};
  Object.keys(byPt).forEach(pt => { pitch[pt] = calcStats(byPt[pt]); });

  const bc = info.bats || {};
  const bats = (bc.L || 0) > (bc.R || 0) ? 'L' : (bc.R || bc.L) ? 'R' : null;
  return { ...info, bats, games: games.length, gameList: games, abs, trend, pitch, st: calcStats(abs) };
}

// ── 포맷 ─────────────────────────────────────────────────────
export const f3 = v => (v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, ''));
export const pct = v => (v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0) + '%';
export const fmt = (v, t) => (t === 'pct' ? pct(v) : t === 'int' ? String(v) : f3(v));

export function sampleBadge(pa) {
  if (pa < 10) return { cls: 'low', txt: '표본 매우 적음' };
  if (pa < 30) return { cls: 'mid', txt: '표본 적음' };
  return null;
}

// 받침 유무로 조사 선택 (한글이 아니면 병기)
export function josa(name, withB, noB) {
  const c = String(name).trim().slice(-1).charCodeAt(0);
  if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 ? withB : noB;
  return `${withB}(${noB})`;
}

// 선수 선택 칩 (가로 스크롤) — onclick 은 window 함수 이름
export function playerChips(players, sel, fn) {
  return players.map(p => `
    <button type="button" class="an-chip${p.name === sel ? ' on' : ''}" role="radio" aria-checked="${p.name === sel}"
      data-name="${_esc(p.name)}" onclick="${fn}(this.dataset.name)">
      <b>${_esc(p.name)}</b>${p.num !== '' && p.num != null ? `<span>#${_esc(p.num)}</span>` : ''}<small>${p.pa ? p.pa + '타석' : '기록 없음'}</small>
    </button>`).join('');
}

export function emptyState(title, sub) {
  return `<div class="an-empty"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 19c.8-3 2.8-4.5 5-4.5s4.2 1.5 5 4.5M11 19c.8-3 2.8-4.5 5-4.5s4.2 1.5 5 4.5"/></svg><b>${title}</b><span>${sub}</span></div>`;
}

// 스프레이 필드: 기록 탭과 같은 좌표 변환(window._fieldPos, 1×1 박스)으로 부채꼴 위에 찍는다
export function sprayFigure(P, mark = '') {
  const s = P.st;
  const fp = window._fieldPos;
  const pts = P.abs.filter(a => a.x != null && a.y != null);
  let field = '', dots = '';
  if (fp) {
    const at = (deg, dist) => {
      const ang = deg * Math.PI / 180 - Math.PI;
      const p = fp({ x: 0.5 + Math.cos(ang) * dist, y: 1 + Math.sin(ang) * dist });
      return (p[0] * 100).toFixed(1) + ',' + (p[1] * 100).toFixed(1);
    };
    const arc = dist => { const o = []; for (let d = 0; d <= 180; d += 6) o.push(at(d, dist)); return o; };
    const home = at(90, 0);
    field = `
      <polygon class="f-grass" points="${home} ${arc(0.97).join(' ')}"/>
      <polyline class="f-arc" points="${arc(0.42).join(' ')}"/>
      <polyline class="f-line" points="${at(0, 0.97)} ${home} ${at(180, 0.97)}"/>
      <polyline class="f-fence" points="${arc(0.97).join(' ')}"/>`;
    const order = { out: 0, '1b': 1, xbh: 2, hr: 3 };
    dots = pts.map(a => {
      const t = a.res === '홈런' ? 'hr' : (a.res === '2루타' || a.res === '3루타') ? 'xbh' : HITS.includes(a.res) ? '1b' : 'out';
      return { a, t };
    }).sort((x, y) => order[x.t] - order[y.t]).map(({ a, t }) => {
      const p = fp(a);
      const x = (p[0] * 100).toFixed(1), y = (p[1] * 100).toFixed(1);
      const tip = `<title>${_esc(a.res)}${a.inn ? ' · ' + _esc(a.inn) : ''}</title>`;
      if (t === 'hr') return `<path class="d-hr" d="M${x} ${+y - 3.4}l3.4 3.4-3.4 3.4-3.4-3.4z">${tip}</path>`;
      if (t === 'xbh') return `<rect class="d-xbh" x="${+x - 2.3}" y="${+y - 2.3}" width="4.6" height="4.6" rx="0.8">${tip}</rect>`;
      return `<circle class="d-${t}" cx="${x}" cy="${y}" r="${t === 'out' ? 2 : 2.4}">${tip}</circle>`;
    }).join('');
  }
  const dn = s.dn || 0;
  const seg = (n, c, l) => (n ? `<i class="${c}" style="flex:${n}" title="${l} ${n}개">${Math.round(n / dn * 100)}%</i>` : '');
  return `
    <figure class="an-spray">
      <figcaption>${mark}${_esc(P.name)}<span>타구 ${pts.length}개</span></figcaption>
      <svg viewBox="-3 3 106 96" role="img" aria-label="${_esc(P.name)} 스프레이 차트">${field}${dots}</svg>
      ${dn ? `
        <div class="an-dir" aria-label="당김 ${s.pull}, 센터 ${s.center}, 밀어 ${s.oppo}">${seg(s.pull, 'pull', '당김')}${seg(s.center, 'ctr', '센터')}${seg(s.oppo, 'oppo', '밀어')}</div>
        <div class="an-dir-lbl"><span>당김 ${s.pull}</span><span>센터 ${s.center}</span><span>밀어 ${s.oppo}</span></div>`
        : '<div class="an-dir-none">방향 기록 없음</div>'}
    </figure>`;
}

// 경기별 누적 흐름: series = [{ name, cls, trend }] — 한 축(y)에 같은 지표만
export function trendChart(series, k, note) {
  const ss = series.map(x => ({ ...x, pts: x.trend.slice(-15) }));
  const n = Math.max(...ss.map(x => x.pts.length));
  if (n < 2) return '<div class="an-note">두 경기 이상 기록되면 경기별 흐름이 표시돼요.</div>';

  const W = 320, H = 150, L = 34, R = 40, T = 12, Bm = 22;
  const vmax = Math.max(...ss.flatMap(x => x.pts.map(p => p[k])), k === 'ops' ? 0.8 : 0.3);
  const step = k === 'ops' ? (vmax > 1.6 ? 0.5 : 0.25) : (vmax > 0.6 ? 0.2 : 0.1);
  const top = Math.ceil(vmax / step) * step;
  const X = i => L + (n === 1 ? 0 : i * (W - L - R) / (n - 1));
  const Y = v => T + (1 - v / top) * (H - T - Bm);
  let grid = '';
  for (let v = 0; v <= top + 1e-9; v += step) {
    grid += `<line class="t-grid" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="t-ax" x="${L - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${f3(v)}</text>`;
  }
  const xl = [0, n - 1].concat(n > 4 ? [Math.round((n - 1) / 2)] : []);
  xl.forEach(i => { grid += `<text class="t-ax" x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${i + 1}경기</text>`; });

  const line = (pts, key, name) => {
    if (!pts.length) return '';
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join('');
    const last = pts[pts.length - 1];
    return `<path class="t-line ${key}" d="${d}"/>` + pts.map((p, i) =>
      `<circle class="t-pt ${key}" cx="${X(i).toFixed(1)}" cy="${Y(p[k]).toFixed(1)}" r="3.5"><title>${_esc(name)} · ${i + 1}경기 (${_esc(p.label)}) 누적 ${f3(p[k])}</title></circle>`
    ).join('') + `<text class="t-end" x="${(X(pts.length - 1) + 6).toFixed(1)}" y="${(Y(last[k]) + 3).toFixed(1)}">${f3(last[k])}</text>`;
  };
  return `
    <svg class="an-trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="경기별 누적 ${k === 'ops' ? 'OPS' : '타율'}">
      ${grid}${ss.map(x => line(x.pts, x.cls, x.name)).join('')}
    </svg>
    <div class="an-legend">${ss.length > 1 ? ss.map(x => `<span><i class="cmp-dot ${x.cls}"></i>${_esc(x.name)}</span>`).join('') : ''}<span class="an-legend-note">${note}</span></div>`;
}

// 구종별 타율: series = [{ name, cls, pitch }]
export function pitchTable(series) {
  const pts = [...new Set(series.flatMap(x => Object.keys(x.pitch)))];
  if (!pts.length) return '';
  const tot = p => series.reduce((s, x) => s + ((x.pitch[p] || {}).pa || 0), 0);
  pts.sort((x, y) => tot(y) - tot(x));
  const cell = s => (s && s.pa ? `<b>${s.ab ? f3(s.avg) : '—'}</b><small>${s.h}/${s.ab} · ${s.pa}타석</small>` : '<small>—</small>');
  return `
    <section class="an-card">
      <header class="an-hd"><h3>구종별 타율</h3><span class="an-hd-note">타석 마지막 공 기준</span></header>
      <table class="an-pitch">
        <thead><tr><th scope="col">구종</th>${series.map(x => `<th scope="col">${series.length > 1 ? `<i class="cmp-dot ${x.cls}"></i>${_esc(x.name)}` : '타율'}</th>`).join('')}</tr></thead>
        <tbody>${pts.map(p => `<tr><th scope="row">${_esc(p)}</th>${series.map(x => `<td>${cell(x.pitch[p])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </section>`;
}

