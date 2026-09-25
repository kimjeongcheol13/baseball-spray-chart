// 팀 대시보드 — 우리 팀 시즌 성적 · 선수 순위 · 경기 결과 · 흐름 · 이닝/구종/방향
import { HITS, esc as _esc } from '../constants.js';
import { buildData, calcStats, f3, pct, fmt, emptyState, sprayFigure, trendChart, pitchTable } from './batdata.js?v=4';

const QUAL_PA = 5;   // 리더보드(비율 지표) 대상: 5타석 이상

let _scope = 'season';   // season | game
let _side = 'home';      // home | away | all
let _ldr = 'ops';
let _sort = { k: 'pa', dir: -1 };
let _trendKey = 'avg';
let _logAll = false;

const LEADERS = [
  { k: 'ops', l: 'OPS', fmt: 'f3', rate: true },
  { k: 'woba', l: 'wOBA', fmt: 'f3', rate: true },
  { k: 'avg', l: '타율', fmt: 'f3', rate: true },
  { k: 'obp', l: '출루율', fmt: 'f3', rate: true },
  { k: 'hr', l: '홈런', fmt: 'int' },
  { k: 'rbi', l: '타점', fmt: 'int' },
  { k: 'h', l: '안타', fmt: 'int' },
];

const COLS = [
  { k: 'g', l: '경기', fmt: 'int' },
  { k: 'pa', l: '타석', fmt: 'int' },
  { k: 'avg', l: '타율', fmt: 'f3' },
  { k: 'obp', l: '출루율', fmt: 'f3' },
  { k: 'slg', l: '장타율', fmt: 'f3' },
  { k: 'ops', l: 'OPS', fmt: 'f3' },
  { k: 'woba', l: 'wOBA', fmt: 'f3' },
  { k: 'h', l: '안타', fmt: 'int' },
  { k: 'hr', l: '홈런', fmt: 'int' },
  { k: 'rbi', l: '타점', fmt: 'int' },
  { k: 'bbRate', l: '볼넷%', fmt: 'pct' },
  { k: 'kRate', l: '삼진%', fmt: 'pct', lower: true },
];

// ── 진입 · 조작 ──────────────────────────────────────────────
function _mountView() {
  let v = document.getElementById('teamView');
  if (v) return v;
  const sec = document.getElementById('anaSecTeam');
  if (!sec) return null;
  v = document.createElement('div');
  v.id = 'teamView';
  v.className = 'tm';
  v.innerHTML = `
    <div class="savant-view-header">
      <div class="svh-title">팀 대시보드</div>
      <div class="svh-sub">우리 팀 시즌 성적 · 선수 순위 · 경기 흐름</div>
    </div>
    <div class="tm-ctrls" id="teamCtrls"></div>
    <div id="teamContent" class="tm-result"></div>`;
  sec.insertBefore(v, sec.firstChild);
  return v;
}

export function openTeamView() {
  if (!_mountView()) return;
  _render();
}

export function setTeamScope(k, v) {
  if (k === 'scope') _scope = v === 'game' ? 'game' : 'season';
  if (k === 'side') _side = ['home', 'away', 'all'].includes(v) ? v : 'home';
  if (k === 'ldr') _ldr = v;
  if (k === 'trend') _trendKey = v === 'ops' ? 'ops' : 'avg';
  if (k === 'sort') _sort = _sort.k === v ? { k: v, dir: -_sort.dir } : { k: v, dir: v === 'kRate' ? 1 : -1 };
  if (k === 'log') _logAll = !_logAll;
  _render();
}

// ── 데이터 ───────────────────────────────────────────────────
function _activeTeam() {
  try {
    const d = JSON.parse(localStorage.getItem('sl_teams') || 'null');
    return d && d.teams ? d.teams.find(t => t.id === d.activeTeamId) || null : null;
  } catch (e) { return null; }
}

function _sideOf(a) { return a.team === 'away' ? 'away' : 'home'; }

// 이 화면이 다룰 경기 목록과 범위 설명
function _scopeGames(data, team) {
  if (_scope === 'game') {
    const AS = window.AS || {};
    const cur = data.games.find(g => g.current) || {};
    return { games: [{ ...cur, abs: AS.abs || [], label: '현재 경기' }], note: '진행 중인 현재 경기', live: true };
  }
  const saved = data.games.filter(g => !g.current);
  const keys = team && Array.isArray(team.games) ? new Set(team.games.map(g => g.key).filter(Boolean)) : null;
  const linked = keys && keys.size ? saved.filter(g => keys.has(g.key)) : null;
  const games = linked && linked.length ? linked : saved;
  const cur = data.games.find(g => g.current && g.abs.length);
  const note = linked && linked.length
    ? `'${team.name}' 팀에 연결된 ${games.length}경기`
    : `저장된 경기 전체 ${games.length}경기`;
  // 저장 안 된 현재 경기 타석도 시즌 성적에는 넣는다 (승패에는 넣지 않음)
  return { games: cur ? [...games, cur] : games, note: note + (cur ? ' + 진행 중인 경기' : ''), live: false };
}

function _collect(games) {
  const abs = [];
  const map = {};
  const perGame = games.map(g => {
    const mine = g.abs.filter(a => _side === 'all' || _sideOf(a) === _side);
    abs.push(...mine);
    const seen = new Set();
    mine.forEach(a => {
      if (!a.bname) return;
      const p = map[a.bname] || (map[a.bname] = { name: a.bname, num: a.bnum ?? '', abs: [], games: 0 });
      if (p.num === '' && a.bnum != null) p.num = a.bnum;
      p.abs.push(a);
      if (!seen.has(a.bname)) { seen.add(a.bname); p.games++; }
    });
    return { ...g, mine };
  });
  const players = Object.values(map).map(p => ({ ...p, st: calcStats(p.abs) }))
    .map(p => ({ ...p, row: { ...p.st, g: p.games } }));
  return { abs, perGame, players, st: calcStats(abs) };
}

function _result(g) {
  if (g.current) return null;
  const us = _side === 'away' ? g.as : g.hs, them = _side === 'away' ? g.hs : g.as;
  if (_side === 'all') return null;
  return { us, them, r: us > them ? 'W' : us < them ? 'L' : 'D' };
}

// ── 렌더 ─────────────────────────────────────────────────────
function _render() {
  const ctrl = document.getElementById('teamCtrls');
  const el = document.getElementById('teamContent');
  if (!el || !ctrl) return;
  const data = buildData();
  const team = _activeTeam();
  const S = _scopeGames(data, team);
  const T = _collect(S.games);

  const seg = (k, cur, opts) => `<div class="an-seg" role="tablist">${opts.map(([v, l]) => `<button role="tab" class="${cur === v ? 'on' : ''}" aria-selected="${cur === v}" onclick="setTeamScope('${k}','${v}')">${l}</button>`).join('')}</div>`;
  ctrl.innerHTML = `
    ${seg('scope', _scope, [['season', '시즌 전체'], ['game', '이번 경기']])}
    ${seg('side', _side, [['home', '홈(우리)'], ['away', '원정'], ['all', '양 팀']])}
    <span class="tm-scope-note">${_esc(S.note)}</span>`;

  if (!T.abs.length) {
    el.innerHTML = _hero(team, S, T) + emptyState(
      _scope === 'game' ? '이번 경기에 기록된 타석이 없어요' : '아직 기록된 타석이 없어요',
      _scope === 'game' ? '기록 탭에서 타석을 입력하면 실시간으로 집계돼요.' : '경기를 기록하고 저장하면 팀 시즌 성적이 쌓여요.',
    ) + _exportCard(team);
    return;
  }

  el.innerHTML = `
    ${_hero(team, S, T)}
    ${_kpis(T)}
    ${_insights(T, S)}
    <div class="tm-2col">
      ${_leaderCard(T)}
      ${_gamesCard(T, S)}
    </div>
    ${_rosterCard(T)}
    ${S.live ? '' : _runsCard(T)}
    ${S.live ? '' : `
    <section class="an-card">
      <header class="an-hd">
        <h3>팀 누적 흐름</h3>
        ${seg('trend', _trendKey, [['avg', '타율'], ['ops', 'OPS']])}
      </header>
      ${trendChart([{ name: '팀', cls: 'a', trend: _teamTrend(T) }], _trendKey, 'N번째 경기까지의 팀 누적 기록 · 최근 15경기')}
    </section>`}
    <div class="tm-2col">
      ${_inningCard(T)}
      ${_countCard(T)}
    </div>
    <section class="an-card">
      <header class="an-hd"><h3>팀 타구 방향</h3><span class="an-hd-note">좌·우타별로 당김/밀어 판정 후 합산</span></header>
      <div class="tm-spray">${sprayFigure({ name: '팀', st: T.st, abs: T.abs })}</div>
      <div class="an-spray-key">
        <span><i class="k-1b"></i>단타</span><span><i class="k-xbh"></i>2·3루타</span><span><i class="k-hr"></i>홈런</span><span><i class="k-out"></i>아웃</span>
      </div>
    </section>
    ${pitchTable([{ name: '팀', cls: 'a', pitch: _pitchMap(T.abs) }])}
    ${_exportCard(team)}
  `;
}

function _hero(team, S, T) {
  const side = _side === 'away' ? '원정 팀' : _side === 'all' ? '양 팀 합산' : '';
  const lastTh = [...S.games].reverse().map(g => (_side === 'away' ? g.ta : g.th)).find(Boolean);
  const name = _side === 'home' ? (team && team.name) || lastTh || '우리 팀' : _side === 'away' ? lastTh || '원정 팀' : '양 팀 전체';
  const color = _side === 'home' && team && team.color ? team.color : 'var(--an-accent)';
  const res = S.games.map(_result).filter(Boolean);
  const W = res.filter(r => r.r === 'W').length, L = res.filter(r => r.r === 'L').length, D = res.filter(r => r.r === 'D').length;
  const rs = res.reduce((s, r) => s + r.us, 0), ra = res.reduce((s, r) => s + r.them, 0);
  const wp = W + L ? (W / (W + L)).toFixed(3).replace(/^0/, '') : '—';
  const last5 = res.slice(-5);
  const cur = S.live ? S.games[0] : null;

  let record;
  if (S.live) {
    const us = _side === 'away' ? cur.as : cur.hs, them = _side === 'away' ? cur.hs : cur.as;
    record = _side === 'all' ? '' : `
      <div class="tm-rec">
        <div class="tm-rec-main"><b>${us}</b><span>:</span><b>${them}</b></div>
        <small>진행 중 스코어</small>
      </div>`;
  } else if (res.length) {
    record = `
      <div class="tm-rec">
        <div class="tm-rec-main"><b>${W}</b><small>승</small><b>${L}</b><small>패</small>${D ? `<b>${D}</b><small>무</small>` : ''}</div>
        <small>승률 ${wp} · 득 ${rs} / 실 ${ra} (${rs - ra >= 0 ? '+' : ''}${rs - ra})</small>
      </div>`;
  } else record = _side === 'all' ? '' : '<div class="tm-rec"><small>저장된 경기 결과가 없어요</small></div>';

  return `
    <section class="tm-hero" style="--tm-c:${color}">
      <div class="tm-id">
        <span class="tm-badge">${_esc(String(name).trim()[0] || '팀')}</span>
        <div>
          <div class="tm-name">${_esc(name)}</div>
          <div class="tm-meta">${side ? side + ' · ' : ''}${T.players.length}명 · ${T.st.pa}타석</div>
        </div>
      </div>
      ${record}
      ${!S.live && last5.length ? `
      <div class="tm-flow" aria-label="최근 ${last5.length}경기">
        <small>최근 ${last5.length}경기</small>
        ${last5.map(r => `<i class="${r.r.toLowerCase()}" title="${r.us}:${r.them}">${r.r === 'W' ? '승' : r.r === 'L' ? '패' : '무'}</i>`).join('')}
      </div>` : ''}
    </section>`;
}

function _kpis(T) {
  const s = T.st;
  const k = (l, v, sub) => `<div class="tm-kpi"><span>${l}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `
    <section class="tm-kpis">
      ${k('타율', f3(s.avg), `${s.h}/${s.ab}`)}
      ${k('출루율', f3(s.obp))}
      ${k('장타율', f3(s.slg))}
      ${k('OPS', f3(s.ops))}
      ${k('wOBA', f3(s.woba))}
      ${k('홈런', s.hr, `장타 ${s.s2 + s.s3 + s.hr}`)}
      ${k('볼넷%', pct(s.bbRate), `${s.bb}개`)}
      ${k('삼진%', pct(s.kRate), `${s.k}개`)}
    </section>`;
}

// ── 리더보드 ─────────────────────────────────────────────────
function _leaderCard(T) {
  const L = LEADERS.find(x => x.k === _ldr) || LEADERS[0];
  const pool = T.players.filter(p => (L.rate ? p.st.pa >= QUAL_PA : true) && (L.rate || p.row[L.k] > 0));
  const top = pool.sort((a, b) => b.row[L.k] - a.row[L.k] || b.st.pa - a.st.pa).slice(0, 5);
  const max = top.length ? Math.max(top[0].row[L.k], 1e-9) : 1;
  return `
    <section class="an-card">
      <header class="an-hd"><h3>리더보드</h3><span class="an-hd-note">${L.rate ? `${QUAL_PA}타석 이상` : '누적'}</span></header>
      <div class="tm-ldr-tabs" role="tablist">${LEADERS.map(x => `<button role="tab" class="${x.k === L.k ? 'on' : ''}" aria-selected="${x.k === L.k}" onclick="setTeamScope('ldr','${x.k}')">${x.l}</button>`).join('')}</div>
      ${top.length ? `<ol class="tm-ldr">${top.map((p, i) => `
        <li>
          <span class="tm-rank r${i + 1}">${i + 1}</span>
          <div class="tm-ldr-who"><b>${_esc(p.name)}</b><small>${p.num !== '' ? '#' + _esc(p.num) + ' · ' : ''}${p.games}경기 ${p.st.pa}타석</small></div>
          <span class="tm-ldr-bar"><i style="width:${p.row[L.k] / max * 100}%"></i></span>
          <b class="tm-ldr-v">${fmt(p.row[L.k], L.fmt)}</b>
        </li>`).join('')}</ol>`
        : `<div class="an-note">${L.rate ? `${QUAL_PA}타석 이상인 선수가 아직 없어요.` : '아직 기록이 없어요.'}</div>`}
    </section>`;
}

// ── 경기 결과 ────────────────────────────────────────────────
function _gamesCard(T, S) {
  const games = T.perGame.filter(g => !g.current || S.live).slice().reverse();
  const show = _logAll ? games : games.slice(0, 6);
  const row = g => {
    const R = _result(g);
    const c = calcStats(g.mine);
    const opp = _side === 'away' ? g.th : g.ta;
    const star = _mvp(g.mine);
    return `
      <li>
        ${R ? `<span class="tm-res ${R.r.toLowerCase()}">${R.r === 'W' ? '승' : R.r === 'L' ? '패' : '무'}</span>` : `<span class="tm-res n">${g.current ? '중' : '—'}</span>`}
        <div class="tm-g-main">
          <b>${opp ? 'vs ' + _esc(opp) : _esc(g.label)}</b>
          <small>${_esc(g.current ? '진행 중' : g.d || '')} · ${c.pa}타석 ${c.h}/${c.ab}${c.hr ? ` · ${c.hr}홈런` : ''}</small>
          ${star ? `<small class="tm-star">★ ${_esc(star.name)} ${star.h}/${star.ab}${star.rbi ? ` · ${star.rbi}타점` : ''}${star.hr ? ` · ${star.hr}홈런` : ''}</small>` : ''}
        </div>
        ${R ? `<span class="tm-score">${R.us}<i>:</i>${R.them}</span>` : g.current ? `<span class="tm-score">${_side === 'away' ? g.as : g.hs}<i>:</i>${_side === 'away' ? g.hs : g.as}</span>` : ''}
      </li>`;
  };
  return `
    <section class="an-card">
      <header class="an-hd"><h3>경기 결과</h3><span class="an-hd-note">최근 경기부터 · ★ = 경기 최고 활약</span></header>
      ${games.length ? `<ol class="tm-games">${show.map(row).join('')}</ol>` : '<div class="an-note">저장된 경기가 없어요.</div>'}
      ${games.length > 6 ? `<button type="button" class="pf-more" onclick="setTeamScope('log')">${_logAll ? '최근 6경기만 보기' : `전체 ${games.length}경기 보기`}</button>` : ''}
    </section>`;
}

// 경기 최고 활약: 2타석 이상 중 wOBA 최고 (동률이면 타점) — 안타가 없으면 뽑지 않음
function _mvp(abs) {
  const by = {};
  abs.forEach(a => { if (a.bname) (by[a.bname] = by[a.bname] || []).push(a); });
  const c = Object.keys(by).map(n => ({ name: n, ...calcStats(by[n]) })).filter(p => p.pa >= 2 && p.h > 0);
  c.sort((a, b) => b.woba - a.woba || b.rbi - a.rbi);
  return c[0] || null;
}

// ── 선수별 기록 (정렬 가능한 표) ─────────────────────────────
function _rosterCard(T) {
  const k = _sort.k;
  const rows = T.players.slice().sort((a, b) => {
    const d = (a.row[k] - b.row[k]) * _sort.dir;
    return d || b.st.pa - a.st.pa;
  });
  const lead = {};
  COLS.forEach(c => {
    const q = T.players.filter(p => p.st.pa >= QUAL_PA);
    if (!q.length) return;
    lead[c.k] = c.lower ? Math.min(...q.map(p => p.row[c.k])) : Math.max(...q.map(p => p.row[c.k]));
  });
  return `
    <section class="an-card">
      <header class="an-hd"><h3>선수별 기록</h3><span class="an-hd-note">열 이름을 누르면 정렬 · 굵은 값 = 팀 1위(${QUAL_PA}타석+)</span></header>
      <div class="tm-roster-wrap">
        <table class="tm-roster">
          <thead><tr>
            <th scope="col" class="tm-sticky">선수</th>
            ${COLS.map(c => `<th scope="col" aria-sort="${k === c.k ? (_sort.dir < 0 ? 'descending' : 'ascending') : 'none'}"><button type="button" class="${k === c.k ? 'on' : ''}" onclick="setTeamScope('sort','${c.k}')">${c.l}${k === c.k ? (_sort.dir < 0 ? ' ▼' : ' ▲') : ''}</button></th>`).join('')}
          </tr></thead>
          <tbody>${rows.map(p => `
            <tr${p.st.pa < QUAL_PA ? ' class="thin"' : ''}>
              <th scope="row" class="tm-sticky"><b>${_esc(p.name)}</b>${p.num !== '' ? `<small>#${_esc(p.num)}</small>` : ''}</th>
              ${COLS.map(c => {
                const v = p.row[c.k];
                const top = p.st.pa >= QUAL_PA && lead[c.k] != null && v === lead[c.k] && (c.fmt !== 'int' || v > 0);
                return `<td${top ? ' class="lead"' : ''}>${fmt(v, c.fmt)}</td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <th scope="row" class="tm-sticky">팀 합계</th>
            ${COLS.map(c => `<td>${c.k === 'g' ? '' : fmt(T.st[c.k], c.fmt)}</td>`).join('')}
          </tr></tfoot>
        </table>
      </div>
    </section>`;
}

// ── 경기별 득실점 ────────────────────────────────────────────
function _runsCard(T) {
  const gs = T.perGame.filter(g => !g.current).map(g => ({ g, R: _result(g) })).filter(x => x.R).slice(-12);
  if (gs.length < 2) return '';
  const W = 320, H = 150, L = 22, R = 6, Tp = 10, B = 22;
  const max = Math.max(1, ...gs.map(x => Math.max(x.R.us, x.R.them)));
  const top = Math.ceil(max / 2) * 2;
  const slot = (W - L - R) / gs.length;
  const bw = Math.min(12, slot * 0.34);
  const Y = v => Tp + (1 - v / top) * (H - Tp - B);
  let grid = '';
  for (let v = 0; v <= top; v += top > 8 ? Math.ceil(top / 4) : 2) {
    grid += `<line class="t-grid" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="t-ax" x="${L - 4}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${v}</text>`;
  }
  const bars = gs.map((x, i) => {
    const cx = L + slot * i + slot / 2;
    const tip = `${_esc(x.g.d || '')} vs ${_esc((_side === 'away' ? x.g.th : x.g.ta) || '')} ${x.R.us}:${x.R.them}`;
    const bar = (v, cls, off) => `<rect class="tm-run ${cls}" x="${(cx + off).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, Y(0) - Y(v)).toFixed(1)}" rx="2"><title>${tip}</title></rect>`;
    return bar(x.R.us, 'for', -bw - 1) + bar(x.R.them, 'against', 1)
      + `<text class="t-ax tm-run-lbl ${x.R.r.toLowerCase()}" x="${cx.toFixed(1)}" y="${H - 7}" text-anchor="middle">${x.R.r === 'W' ? '승' : x.R.r === 'L' ? '패' : '무'}</text>`;
  }).join('');
  const rs = gs.reduce((s, x) => s + x.R.us, 0), ra = gs.reduce((s, x) => s + x.R.them, 0);
  return `
    <section class="an-card">
      <header class="an-hd"><h3>경기별 득점 · 실점</h3><span class="an-hd-note">최근 ${gs.length}경기 · 경기당 득점 ${(rs / gs.length).toFixed(1)} / 실점 ${(ra / gs.length).toFixed(1)}</span></header>
      <svg class="an-trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="경기별 득점과 실점">${grid}${bars}</svg>
      <div class="an-legend"><span><i class="tm-sw for"></i>득점</span><span><i class="tm-sw against"></i>실점</span><span class="an-legend-note">막대 아래 = 승패</span></div>
    </section>`;
}

function _teamTrend(T) {
  const acc = [];
  return T.perGame.filter(g => g.mine.length).map(g => {
    acc.push(...g.mine);
    const c = calcStats(acc);
    return { label: g.label, avg: c.avg, ops: c.ops };
  });
}

// ── 이닝별 · 카운트별 ────────────────────────────────────────
function _innOf(a) {
  const m = String(a.inn || '').match(/\d+/);
  return m ? Math.min(+m[0], 10) : String(a.inn || '').includes('연장') ? 10 : null;
}

function _inningCard(T) {
  const list = T.abs.filter(a => _innOf(a) != null);
  if (!list.length) return `<section class="an-card"><header class="an-hd"><h3>이닝별 타격</h3></header><div class="an-note">이닝이 기록된 타석이 없어요.</div></section>`;
  const inns = Array.from({ length: 10 }, (_, i) => i + 1).map(n => ({ n, st: calcStats(list.filter(a => _innOf(a) === n)) })).filter(x => x.st.pa || x.n <= 9);
  const max = Math.max(0.001, ...inns.map(x => x.st.ops));
  return `
    <section class="an-card">
      <header class="an-hd"><h3>이닝별 타격</h3><span class="an-hd-note">막대 = OPS · 숫자 = 타율</span></header>
      <div class="tm-inns">${inns.map(x => `
        <div class="tm-inn${x.st.pa < 3 ? ' thin' : ''}" title="${x.n === 10 ? '연장' : x.n + '회'} · ${x.st.pa}타석 · 타율 ${f3(x.st.avg)} · OPS ${f3(x.st.ops)}">
          <span class="tm-inn-bar"><i style="height:${x.st.ops / max * 100}%"></i></span>
          <b>${x.st.ab ? f3(x.st.avg) : '—'}</b>
          <small>${x.n === 10 ? '연장' : x.n + '회'}</small>
          <em>${x.st.pa}</em>
        </div>`).join('')}
      </div>
      <div class="an-hd-note tm-inn-note">아래 작은 숫자 = 타석 수 · 흐린 칸은 3타석 미만</div>
    </section>`;
}

function _countCard(T) {
  const cnt = T.abs.filter(a => a.count && a.count.s != null && a.count.b != null);
  if (!cnt.length) return `<section class="an-card"><header class="an-hd"><h3>카운트별 타격</h3></header><div class="an-note">볼카운트가 기록된 타석이 없어요.</div></section>`;
  const rows = [
    ['타자 유리', '볼 > 스트라이크', cnt.filter(a => a.count.b > a.count.s)],
    ['이븐', '볼 = 스트라이크', cnt.filter(a => a.count.b === a.count.s)],
    ['투수 유리', '스트라이크 > 볼', cnt.filter(a => a.count.s > a.count.b)],
    ['2스트라이크', '스트라이크 2개', cnt.filter(a => a.count.s >= 2)],
  ].map(([l, d, abs]) => ({ l, d, st: calcStats(abs) }));
  return `
    <section class="an-card">
      <header class="an-hd"><h3>카운트별 타격</h3><span class="an-hd-note">결과가 나온 순간의 카운트</span></header>
      <table class="pf-split">
        <thead><tr><th scope="col">상황</th><th scope="col">타석</th><th scope="col">타율</th><th scope="col">출루율</th><th scope="col">삼진%</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr><th scope="row">${r.l}<small class="tm-sub">${r.d}</small></th><td>${r.st.pa}</td><td><b>${r.st.ab ? f3(r.st.avg) : '—'}</b></td><td>${r.st.pa ? f3(r.st.obp) : '—'}</td><td>${r.st.pa ? pct(r.st.kRate) : '—'}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>`;
}

function _pitchMap(abs) {
  const by = {};
  abs.forEach(a => { if (a.pt) (by[a.pt] = by[a.pt] || []).push(a); });
  const out = {};
  Object.keys(by).forEach(k => { out[k] = calcStats(by[k]); });
  return out;
}

// ── 분석 요약 ────────────────────────────────────────────────
function _insights(T, S) {
  const s = T.st;
  const out = [];
  const q = T.players.filter(p => p.st.pa >= QUAL_PA);

  if (!S.live) {
    const res = S.games.map(_result).filter(Boolean);
    if (res.length >= 4) {
      const r5 = res.slice(-5);
      const w = r5.filter(r => r.r === 'W').length, l = r5.filter(r => r.r === 'L').length;
      const recent = calcStats(T.perGame.filter(g => !g.current).slice(-5).flatMap(g => g.mine));
      const d = recent.ops - s.ops;
      out.push(`최근 ${r5.length}경기 <b>${w}승 ${l}패</b>, 팀 OPS ${f3(recent.ops)} — ${Math.abs(d) < 0.05 ? '시즌과 비슷한 흐름' : d > 0 ? '<b>시즌보다 좋은 타격감</b>' : '<b>시즌보다 주춤</b>'} (시즌 ${f3(s.ops)}).`);
    }
  }

  const best = q.slice().sort((a, b) => b.st.woba - a.st.woba)[0];
  if (best && q.length >= 2) out.push(`팀 최고 타자는 <b>${_esc(best.name)}</b> (wOBA ${f3(best.st.woba)}, ${best.st.pa}타석).`);

  const traits = [];
  if (s.pa >= 30) {
    if (s.bbRate >= 0.1) traits.push(`볼넷을 잘 얻어요 (볼넷 ${pct(s.bbRate)})`);
    if (s.kRate >= 0.25) traits.push(`삼진이 많은 편이에요 (삼진 ${pct(s.kRate)})`);
    else if (s.kRate <= 0.1) traits.push(`삼진을 잘 안 당해요 (삼진 ${pct(s.kRate)})`);
    if (s.iso >= 0.15) traits.push(`장타력이 있어요 (ISO ${f3(s.iso)})`);
    if (s.dn >= 15 && s.pull / s.dn >= 0.5) traits.push(`당겨치는 타구가 많아요 (${Math.round(s.pull / s.dn * 100)}%)`);
  }
  if (traits.length) out.push(`팀 타격 성향: ${traits.join(' · ')}.`);

  const groups = [['경기 초반(1~3회)', 1, 3], ['중반(4~6회)', 4, 6], ['후반(7회~)', 7, 10]]
    .map(([l, a, b]) => ({ l, st: calcStats(T.abs.filter(x => { const n = _innOf(x); return n != null && n >= a && n <= b; })) }))
    .filter(g => g.st.pa >= 10);
  if (groups.length >= 2) {
    groups.sort((a, b) => b.st.ops - a.st.ops);
    out.push(`<b>${groups[0].l}</b>에 가장 잘 쳐요 (OPS ${f3(groups[0].st.ops)} · ${groups[groups.length - 1].l} ${f3(groups[groups.length - 1].st.ops)}).`);
  }

  const two = calcStats(T.abs.filter(a => a.count && a.count.s >= 2));
  if (two.pa >= 10) out.push(`2스트라이크 이후 팀 타율 <b>${two.ab ? f3(two.avg) : '—'}</b>, 삼진 ${pct(two.kRate)} (${two.pa}타석).`);

  const warn = s.pa < 50 ? `<p class="an-warn">⚠ 팀 전체 ${s.pa}타석 — 경기가 더 쌓이면 흐름이 더 정확해져요.</p>` : '';
  if (!out.length && !warn) return '';
  return `
    <section class="an-card an-insight">
      <header class="an-hd"><h3>분석 요약</h3></header>
      ${out.length ? `<ul>${out.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
      ${warn}
    </section>`;
}

// ── 내보내기 · 팀 관리 ───────────────────────────────────────
function _exportCard(team) {
  const btn = (fn, icon, l, sub) => `<button type="button" class="tm-act" onclick="${fn}"><span class="tm-act-ic">${icon}</span><b>${l}</b><small>${sub}</small></button>`;
  const I = {
    card: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    spray: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21L3 12a12.7 12.7 0 0118 0z"/><circle cx="10" cy="11" r="1"/><circle cx="14" cy="9" r="1"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/></svg>',
    team: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/></svg>',
  };
  return `
    <section class="an-card">
      <header class="an-hd"><h3>내보내기 · 팀 관리</h3></header>
      <div class="tm-acts">
        ${btn('exportShareCard()', I.card, '성적 카드 이미지', 'SNS·카톡 공유용')}
        ${btn('exportSprayPNG()', I.spray, '스프레이차트 PNG', '현재 필드 그대로')}
        ${team ? btn('shareTeamURL()', I.share, '팀 기록 공유', 'URL · QR 코드') : ''}
        ${btn('openTeamCreate()', I.team, team ? '팀 추가' : '팀 만들기', team ? `지금: ${_esc(team.name)}` : '저장 경기가 팀에 자동 연결')}
      </div>
    </section>`;
}

// 팀 만들기 · 공유 팀 가져오기 뒤에 기존 대시보드 갱신 함수가 불린다 → 팀 탭이 열려 있으면 새 화면도 다시 그린다
function _hookLegacy() {
  const orig = window.renderTeamDashboard;
  if (typeof orig !== 'function' || orig._tm) return;
  const wrapped = function () {
    try { orig.apply(this, arguments); } catch (e) {}
    if (document.querySelector('#anaBody .ana-sec.on[data-sub="team"]')) openTeamView();
  };
  wrapped._tm = true;
  window.renderTeamDashboard = wrapped;
}

if (typeof window !== 'undefined') {
  _hookLegacy();
  window.openTeamView = openTeamView;
  window.setTeamScope = setTeamScope;
}
