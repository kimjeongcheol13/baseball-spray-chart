// 선수 비교 — 두 타자를 같은 기준(내 기록 전체)으로 나란히 놓고 분석
import { HITS, NOAB, BASE, WOBA_W, esc as _esc } from '../constants.js';

let _a = null;          // 선택된 선수 이름 (A / B)
let _b = null;
let _trendKey = 'avg';  // 경기별 흐름 지표: avg | ops
let _cache = null;      // { games, players, pool } — 뷰를 열 때마다 새로 만든다

// 핵심 지표 (우위 집계 대상) — BABIP은 운 요소가 커서 집계에서 뺀다
const GROUPS = [
  { title: '종합 생산성', desc: 'wOBA: 볼넷·안타·장타에 가치를 다르게 매긴 종합 타격 지표', rows: [
    { k: 'woba', label: 'wOBA', fmt: 'f3', max: 0.6, tally: true },
    { k: 'ops', label: 'OPS', fmt: 'f3', max: 1.4, tally: true },
  ] },
  { title: '컨택 · 출루', desc: 'BABIP은 인플레이 타구의 안타 비율 — 운의 영향이 커서 우위 집계에서 제외', rows: [
    { k: 'avg', label: '타율', fmt: 'f3', max: 0.5, tally: true },
    { k: 'obp', label: '출루율', fmt: 'f3', max: 0.6, tally: true },
    { k: 'babip', label: 'BABIP', fmt: 'f3', max: 0.6 },
  ] },
  { title: '파워', desc: 'ISO = 장타율 − 타율 · 순수 장타력', rows: [
    { k: 'slg', label: '장타율', fmt: 'f3', max: 0.9, tally: true },
    { k: 'iso', label: 'ISO', fmt: 'f3', max: 0.4, tally: true },
    { k: 'xbhRate', label: '장타/타석', fmt: 'pct', max: 0.25 },
  ] },
  { title: '선구안', desc: '볼넷%는 볼넷만(사구 제외) · 삼진%는 낮을수록 좋음', rows: [
    { k: 'bbRate', label: '볼넷%', fmt: 'pct', max: 0.25, tally: true },
    { k: 'kRate', label: '삼진%', fmt: 'pct', max: 0.4, lower: true, tally: true },
  ] },
];

const MIX = [
  { k: 'mix1b', label: '단타' },
  { k: 'mixXbh', label: '2·3루타' },
  { k: 'mixHr', label: '홈런' },
  { k: 'mixBb', label: '볼넷·사구' },
  { k: 'mixK', label: '삼진', lower: true },
  { k: 'mixOut', label: '범타', lower: true },
];

// ── 진입 ──────────────────────────────────────────────────────
export function openCompareView() {
  document.querySelectorAll('.savant-view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('compareView');
  if (view) view.classList.add('active');
  _cache = _build();
  const names = _cache.players.map(p => p.name);
  if (!names.includes(_a)) _a = null;
  if (!names.includes(_b)) _b = null;
  // 처음 열면 타석이 많은 두 선수를 자동 선택 → 바로 결과가 보이게
  const ranked = _cache.players.filter(p => p.pa > 0);
  if (!_a) _a = (ranked.find(p => p.name !== _b) || {}).name || null;
  if (!_b) _b = (ranked.find(p => p.name !== _a) || {}).name || null;
  renderComparePlayerSelects();
  runPlayerCompare();
}

export function renderComparePlayerSelects() {
  const s1 = document.getElementById('compareSelect1');
  const s2 = document.getElementById('compareSelect2');
  if (!s1 || !s2) return;
  if (!_cache) _cache = _build();
  const ps = _cache.players;
  if (!ps.length) {
    s1.innerHTML = s2.innerHTML = '<option value="">선수 없음</option>';
    return;
  }
  const opts = cur => '<option value="">선수 선택</option>' + ps.map(p =>
    `<option value="${_esc(p.name)}"${p.name === cur ? ' selected' : ''}>${_esc(p.name)}${p.num != null && p.num !== '' ? ' #' + _esc(p.num) : ''} · ${p.pa ? p.pa + '타석' : '기록 없음'}</option>`
  ).join('');
  s1.innerHTML = opts(_a);
  s2.innerHTML = opts(_b);
  s1.onchange = () => { _a = s1.value || null; runPlayerCompare(); };
  s2.onchange = () => { _b = s2.value || null; runPlayerCompare(); };
}

export function swapComparePlayers() {
  [_a, _b] = [_b, _a];
  renderComparePlayerSelects();
  runPlayerCompare();
}

export function setCompareTrend(key) {
  _trendKey = key === 'ops' ? 'ops' : 'avg';
  runPlayerCompare();
}

export function runPlayerCompare() {
  const el = document.getElementById('compareResult');
  if (!el) return;
  if (!_cache) _cache = _build();
  const s1 = document.getElementById('compareSelect1');
  const s2 = document.getElementById('compareSelect2');
  if (s1) _a = s1.value || null;
  if (s2) _b = s2.value || null;

  if (!_cache.players.length) {
    el.innerHTML = _empty('아직 기록된 타자가 없어요', '기록 탭에서 타석 결과를 입력하면 여기서 두 선수를 비교할 수 있어요.');
    return;
  }
  if (!_a || !_b) {
    el.innerHTML = _empty('비교할 두 선수를 골라주세요', '위의 A · B 칸에서 선수를 선택하면 바로 분석이 나와요.');
    return;
  }
  if (_a === _b) {
    el.innerHTML = _empty('같은 선수가 선택됐어요', '서로 다른 두 선수를 선택해주세요.');
    return;
  }
  const A = _playerStats(_a);
  const B = _playerStats(_b);
  el.innerHTML = _render(A, B, _cache.pool);
}

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
    if (d) raw.push({ label: _gameLabel(d, s), abs: d.abs || [], lineups: [...(d.home_lineup || []), ...(d.away_lineup || [])] });
  });
  raw.push({ label: '현재 경기', abs: AS.abs || [], lineups: [...(AS.home_lineup || []), ...(AS.away_lineup || [])], current: true });

  const seen = new Set();
  return raw.map(g => ({
    ...g,
    abs: g.abs.filter(a => {
      if (!a || a.id == null) return !!a;
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    }),
  }));
}

function _gameLabel(d, s) {
  const opp = d.th && d.ta ? `${d.th} vs ${d.ta}` : (s.label || '경기');
  return d.d ? `${d.d} ${opp}` : opp;
}

function _build() {
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
  return { games, players, pool: _calc(all) };
}

function _calc(abs) {
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

function _playerStats(name) {
  const info = _cache.players.find(p => p.name === name) || { name, num: '', bats: {} };
  const abs = [];
  const games = [];
  _cache.games.forEach(g => {
    const mine = g.abs.filter(a => a.bname === name);
    if (!mine.length) return;
    abs.push(...mine);
    games.push({ label: g.label, abs: mine });
  });
  // 경기별 누적 흐름
  const acc = [];
  const trend = games.map(g => {
    acc.push(...g.abs);
    const c = _calc(acc);
    return { label: g.label, avg: c.avg, ops: c.ops, pa: g.abs.length };
  });
  // 구종별 (마지막 공 구종 기준)
  const byPt = {};
  abs.forEach(a => { if (a.pt) (byPt[a.pt] = byPt[a.pt] || []).push(a); });
  const pitch = {};
  Object.keys(byPt).forEach(pt => { pitch[pt] = _calc(byPt[pt]); });

  const bc = info.bats || {};
  const bats = (bc.L || 0) > (bc.R || 0) ? 'L' : (bc.R || bc.L) ? 'R' : null;
  return { ...info, bats, games: games.length, abs, trend, pitch, st: _calc(abs) };
}

// ── 포맷 ─────────────────────────────────────────────────────
const f3 = v => (v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, ''));
const pct = v => (v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0) + '%';
const fmt = (v, t) => (t === 'pct' ? pct(v) : t === 'int' ? String(v) : f3(v));

function _sample(pa) {
  if (pa < 10) return { cls: 'low', txt: '표본 매우 적음' };
  if (pa < 30) return { cls: 'mid', txt: '표본 적음' };
  return null;
}

// 받침 유무로 조사 선택 (한글이 아니면 병기)
function _j(name, withB, noB) {
  const c = String(name).trim().slice(-1).charCodeAt(0);
  if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 ? withB : noB;
  return `${withB}(${noB})`;
}

function _empty(title, sub) {
  return `<div class="cmp-empty"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 19c.8-3 2.8-4.5 5-4.5s4.2 1.5 5 4.5M11 19c.8-3 2.8-4.5 5-4.5s4.2 1.5 5 4.5"/></svg><b>${title}</b><span>${sub}</span></div>`;
}

// ── 렌더 ─────────────────────────────────────────────────────
function _render(A, B, pool) {
  const tally = { a: 0, b: 0, t: 0 };
  GROUPS.forEach(g => g.rows.forEach(r => {
    if (!r.tally) return;
    const w = _winner(A.st[r.k], B.st[r.k], r);
    tally[w === 'a' ? 'a' : w === 'b' ? 'b' : 't']++;
  }));

  return `
    ${_hero(A, B, tally)}
    ${_insights(A, B, pool)}
    <section class="cmp-card">
      <header class="cmp-hd"><h3>지표 맞대결</h3><span class="cmp-hd-note">작은 숫자·세로선 = 내 기록 전체 평균</span></header>
      <div class="cmp-groups">${GROUPS.map(g => `
        <div class="cmp-group">
          <div class="cmp-gtitle">${g.title}</div>
          ${g.rows.map(r => _duel(r, A.st[r.k], B.st[r.k], pool[r.k], true)).join('')}
          <div class="cmp-gdesc">${g.desc}</div>
        </div>`).join('')}</div>
    </section>
    <section class="cmp-card">
      <header class="cmp-hd"><h3>타석 결과 구성</h3><span class="cmp-hd-note">타석 대비 비율</span></header>
      <div class="cmp-mix">${MIX.map(m => _duel({ ...m, fmt: 'pct', max: _mixMax(A.st, B.st, m.k) }, A.st[m.k], B.st[m.k], null, false)).join('')}</div>
    </section>
    <section class="cmp-card">
      <header class="cmp-hd"><h3>누적 기록</h3></header>
      ${_counts(A, B)}
    </section>
    <section class="cmp-card">
      <header class="cmp-hd"><h3>타구 방향</h3><span class="cmp-hd-note">좌·우타 기준 당김/밀어 자동 판정</span></header>
      <div class="cmp-spray-row">
        ${_spray(A, 'a')}
        ${_spray(B, 'b')}
      </div>
      <div class="cmp-spray-key">
        <span><i class="k-1b"></i>단타</span><span><i class="k-xbh"></i>2·3루타</span><span><i class="k-hr"></i>홈런</span><span><i class="k-out"></i>아웃</span>
      </div>
    </section>
    <section class="cmp-card">
      <header class="cmp-hd">
        <h3>경기별 누적 흐름</h3>
        <div class="cmp-seg" role="tablist" aria-label="흐름 지표">
          <button role="tab" class="${_trendKey === 'avg' ? 'on' : ''}" aria-selected="${_trendKey === 'avg'}" onclick="setCompareTrend('avg')">타율</button>
          <button role="tab" class="${_trendKey === 'ops' ? 'on' : ''}" aria-selected="${_trendKey === 'ops'}" onclick="setCompareTrend('ops')">OPS</button>
        </div>
      </header>
      ${_trend(A, B)}
    </section>
    ${_pitchTable(A, B)}
  `;
}

function _winner(v1, v2, r) {
  if (fmt(v1, r.fmt) === fmt(v2, r.fmt)) return 't';
  return (r.lower ? v1 < v2 : v1 > v2) ? 'a' : 'b';
}

function _hero(A, B, t) {
  const side = (P, key) => {
    const s = P.st;
    const smp = _sample(s.pa);
    const meta = [P.num !== '' && P.num != null ? '#' + _esc(P.num) : '', P.bats === 'L' ? '좌타' : P.bats === 'R' ? '우타' : '', `${P.games}경기 ${s.pa}타석`].filter(Boolean).join(' · ');
    return `
      <div class="cmp-side ${key}">
        <div class="cmp-name"><i class="cmp-dot ${key}"></i>${_esc(P.name)}</div>
        <div class="cmp-meta">${meta}</div>
        <div class="cmp-big">${f3(s.woba)}<small>wOBA</small></div>
        <div class="cmp-slash" title="타율 / 출루율 / 장타율">${f3(s.avg)} / ${f3(s.obp)} / ${f3(s.slg)}</div>
        ${smp ? `<span class="cmp-badge ${smp.cls}">${smp.txt}</span>` : ''}
      </div>`;
  };
  const tot = t.a + t.b + t.t || 1;
  return `
    <section class="cmp-hero">
      ${side(A, 'a')}
      <div class="cmp-vs">VS</div>
      ${side(B, 'b')}
      <div class="cmp-tally">
        <div class="cmp-tally-lbl"><b>${t.a}</b><span>핵심 지표 ${tot}개 중 우위${t.t ? ` · 동률 ${t.t}` : ''}</span><b>${t.b}</b></div>
        <div class="cmp-tally-bar" role="img" aria-label="A ${t.a}개, 동률 ${t.t}개, B ${t.b}개">
          ${t.a ? `<i class="a" style="flex:${t.a}"></i>` : ''}${t.t ? `<i class="t" style="flex:${t.t}"></i>` : ''}${t.b ? `<i class="b" style="flex:${t.b}"></i>` : ''}
        </div>
      </div>
    </section>`;
}

function _duel(r, v1, v2, avg, emphasize) {
  const w = emphasize ? _winner(v1, v2, r) : 'n';
  // 기본 척도를 넘는 값이 있으면 척도를 늘려서 막대가 모두 꽉 차지 않게
  const top = Math.max(r.max, v1, v2, avg || 0) * (Math.max(v1, v2, avg || 0) > r.max ? 1.08 : 1);
  const bw = v => Math.max(0, Math.min(1, v / top)) * 100;
  const cls = w === 'a' ? 'win-a' : w === 'b' ? 'win-b' : w === 't' ? 'tie' : '';
  const tip = `${r.label}: A ${fmt(v1, r.fmt)} · B ${fmt(v2, r.fmt)}${avg != null ? ` · 전체 ${fmt(avg, r.fmt)}` : ''}`;
  return `
    <div class="cmp-duel ${cls}" title="${tip}">
      <span class="cmp-v a">${fmt(v1, r.fmt)}</span>
      <span class="cmp-bar a"><i style="width:${bw(v1)}%"></i>${avg != null ? `<em style="right:${bw(avg)}%"></em>` : ''}</span>
      <span class="cmp-lbl">${r.label}${r.lower ? '<small>낮을수록 좋음</small>' : avg != null ? `<small>${fmt(avg, r.fmt)}</small>` : ''}</span>
      <span class="cmp-bar b"><i style="width:${bw(v2)}%"></i>${avg != null ? `<em style="left:${bw(avg)}%"></em>` : ''}</span>
      <span class="cmp-v b">${fmt(v2, r.fmt)}</span>
    </div>`;
}

function _mixMax(s1, s2, k) {
  const m = Math.max(s1[k], s2[k]);
  return m > 0 ? Math.max(m, 0.1) : 1;
}

function _counts(A, B) {
  const items = [
    ['경기', 'games'], ['타석', 'pa'], ['타수', 'ab'], ['안타', 'h'],
    ['2루타', 's2'], ['3루타', 's3'], ['홈런', 'hr'], ['타점', 'rbi'],
    ['볼넷', 'bb'], ['사구', 'hbp'], ['삼진', 'k'], ['희생', 'sac'],
  ];
  const val = (P, k) => (k === 'games' ? P.games : k === 'sac' ? P.st.sf + P.st.sh : P.st[k]);
  const table = list => `
      <table class="cmp-count">
        <thead><tr><th scope="col"><span class="sr">선수</span></th>${list.map(i => `<th scope="col">${i[0]}</th>`).join('')}</tr></thead>
        <tbody>
          <tr><th scope="row"><i class="cmp-dot a"></i><span class="sr">${_esc(A.name)}</span></th>${list.map(i => `<td>${val(A, i[1])}</td>`).join('')}</tr>
          <tr><th scope="row"><i class="cmp-dot b"></i><span class="sr">${_esc(B.name)}</span></th>${list.map(i => `<td>${val(B, i[1])}</td>`).join('')}</tr>
        </tbody>
      </table>`;
  return `<div class="cmp-count-wrap">${table(items.slice(0, 6))}${table(items.slice(6))}</div>`;
}

// 필드: 기록 탭과 같은 좌표 변환(window._fieldPos, 1×1 박스)으로 부채꼴 위에 찍는다
function _spray(P, key) {
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
    <figure class="cmp-spray">
      <figcaption><i class="cmp-dot ${key}"></i>${_esc(P.name)}<span>타구 ${pts.length}개</span></figcaption>
      <svg viewBox="-3 3 106 96" role="img" aria-label="${_esc(P.name)} 스프레이 차트">${field}${dots}</svg>
      ${dn ? `
        <div class="cmp-dir" aria-label="당김 ${s.pull}, 센터 ${s.center}, 밀어 ${s.oppo}">${seg(s.pull, 'pull', '당김')}${seg(s.center, 'ctr', '센터')}${seg(s.oppo, 'oppo', '밀어')}</div>
        <div class="cmp-dir-lbl"><span>당김 ${s.pull}</span><span>센터 ${s.center}</span><span>밀어 ${s.oppo}</span></div>`
        : '<div class="cmp-dir-none">방향 기록 없음</div>'}
    </figure>`;
}

function _trend(A, B) {
  const k = _trendKey;
  const ta = A.trend.slice(-15), tb = B.trend.slice(-15);
  const n = Math.max(ta.length, tb.length);
  if (n < 2) return '<div class="cmp-note">두 경기 이상 기록되면 경기별 흐름이 표시돼요.</div>';

  const W = 320, H = 150, L = 34, R = 40, T = 12, Bm = 22;
  const vmax = Math.max(...ta.map(p => p[k]), ...tb.map(p => p[k]), k === 'ops' ? 0.8 : 0.3);
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
    <svg class="cmp-trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="경기별 누적 ${k === 'ops' ? 'OPS' : '타율'}">
      ${grid}${line(ta, 'a', A.name)}${line(tb, 'b', B.name)}
    </svg>
    <div class="cmp-legend"><span><i class="cmp-dot a"></i>${_esc(A.name)}</span><span><i class="cmp-dot b"></i>${_esc(B.name)}</span><span class="cmp-legend-note">각 선수의 N번째 출전 경기 기준 · 최근 15경기</span></div>`;
}

function _pitchTable(A, B) {
  const pts = [...new Set([...Object.keys(A.pitch), ...Object.keys(B.pitch)])];
  if (!pts.length) return '';
  pts.sort((x, y) => ((B.pitch[y] || {}).pa || 0) + ((A.pitch[y] || {}).pa || 0) - ((B.pitch[x] || {}).pa || 0) - ((A.pitch[x] || {}).pa || 0));
  const cell = s => (s && s.pa ? `<b>${s.ab ? f3(s.avg) : '—'}</b><small>${s.h}/${s.ab} · ${s.pa}타석</small>` : '<small>—</small>');
  return `
    <section class="cmp-card">
      <header class="cmp-hd"><h3>구종별 타율</h3><span class="cmp-hd-note">타석 마지막 공 기준</span></header>
      <table class="cmp-pitch">
        <thead><tr><th scope="col">구종</th><th scope="col"><i class="cmp-dot a"></i>${_esc(A.name)}</th><th scope="col"><i class="cmp-dot b"></i>${_esc(B.name)}</th></tr></thead>
        <tbody>${pts.map(p => `<tr><th scope="row">${_esc(p)}</th><td>${cell(A.pitch[p])}</td><td>${cell(B.pitch[p])}</td></tr>`).join('')}</tbody>
      </table>
    </section>`;
}

// ── 자동 분석 코멘트 (숫자 근거를 같이 보여준다) ─────────────
function _insights(A, B, pool) {
  const a = A.st, b = B.st;
  const na = _esc(A.name), nb = _esc(B.name);
  const out = [];

  const dw = a.woba - b.woba;
  if (Math.abs(dw) < 0.015) out.push(`종합 생산성은 <b>거의 같아요</b> (wOBA ${f3(a.woba)} vs ${f3(b.woba)}).`);
  else {
    const P = dw > 0 ? A : B;
    out.push(`종합 생산성은 <b>${_esc(P.name)}</b>${_j(P.name, '이', '가')} ${Math.abs(dw) >= 0.05 ? '확실히' : '조금'} 앞서요 (wOBA ${f3(a.woba)} vs ${f3(b.woba)}).`);
  }

  // 각자 가장 크게 앞서는 영역 (척도가 달라서 영역별 기준 폭으로 나눠 비교)
  const areas = [
    { n: '컨택', k: 'avg', u: 0.05 },
    { n: '출루', k: 'obp', u: 0.05 },
    { n: '파워', k: 'iso', u: 0.05 },
    { n: '선구안', k: 'bbRate', u: 0.03 },
    { n: '삼진 억제', k: 'kRate', u: 0.05, lower: true },
  ].map(x => ({ ...x, d: ((a[x.k] - b[x.k]) * (x.lower ? -1 : 1)) / x.u }));
  const bestA = areas.filter(x => x.d >= 1).sort((x, y) => y.d - x.d)[0];
  const bestB = areas.filter(x => x.d <= -1).sort((x, y) => x.d - y.d)[0];
  const show = x => (x.k === 'bbRate' || x.k === 'kRate' ? `${pct(a[x.k])} vs ${pct(b[x.k])}` : `${f3(a[x.k])} vs ${f3(b[x.k])}`);
  if (bestA && bestB) out.push(`<b>${na}</b>${_j(A.name, '은', '는')} ${bestA.n}(${show(bestA)}), <b>${nb}</b>${_j(B.name, '은', '는')} ${bestB.n}(${show(bestB)})에서 강점을 보여요.`);
  else if (bestA) out.push(`<b>${na}</b>${_j(A.name, '이', '가')} 특히 ${bestA.n}에서 앞서요 (${show(bestA)}).`);
  else if (bestB) out.push(`<b>${nb}</b>${_j(B.name, '이', '가')} 특히 ${bestB.n}에서 앞서요 (${show(bestB)}).`);

  // 타구 방향 성향
  const lean = s => {
    if (s.dn < 3) return null;
    const p = s.pull / s.dn, o = s.oppo / s.dn, c = s.center / s.dn;
    if (p >= 0.5) return `당겨치기 ${Math.round(p * 100)}%`;
    if (o >= 0.4) return `밀어치기 ${Math.round(o * 100)}%`;
    if (c >= 0.5) return `센터 ${Math.round(c * 100)}%`;
    return '전방향 고르게';
  };
  const la = lean(a), lb = lean(b);
  if (la && lb) out.push(`타구 방향: ${na} <b>${la}</b> · ${nb} <b>${lb}</b>.`);

  // 전체 평균 대비
  if (pool.pa >= 30 && pool.woba > 0) {
    const idx = s => Math.round(s.woba / pool.woba * 100);
    out.push(`내 기록 전체 평균 wOBA(${f3(pool.woba)})를 100으로 두면 ${na} <b>${idx(a)}</b>, ${nb} <b>${idx(b)}</b>예요.`);
  }

  const minPa = Math.min(a.pa, b.pa);
  const warn = minPa < 30
    ? `<p class="cmp-warn">⚠ ${minPa < 10 ? '타석 수가 아주 적어서' : '타석 수가 적어서'}(${a.pa} vs ${b.pa}타석) 몇 타석만 더 쌓여도 순위가 바뀔 수 있어요. 경향을 보는 참고용으로 활용하세요.</p>`
    : '';

  return `
    <section class="cmp-card cmp-insight">
      <header class="cmp-hd"><h3>분석 요약</h3></header>
      <ul>${out.map(t => `<li>${t}</li>`).join('')}</ul>
      ${warn}
    </section>`;
}

if (typeof window !== 'undefined') {
  window.openCompareView = openCompareView;
  window.renderComparePlayerSelects = renderComparePlayerSelects;
  window.runPlayerCompare = runPlayerCompare;
  window.swapComparePlayers = swapComparePlayers;
  window.setCompareTrend = setCompareTrend;
}
