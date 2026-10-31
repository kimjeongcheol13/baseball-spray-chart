// 선수 프로필 — 한 타자의 통산 기록을 팀 내 위치·상황별·경기별로 깊게 본다
import { HITS, esc as _esc } from '../constants.js';
import { buildData, playerData, calcStats, f3, pct, fmt, sampleBadge, josa, emptyState, sprayFigure, trendChart, pitchTable, playerChips } from './batdata.js?v=9';
import { hotColdFigure } from './zonefig.js?v=7';
import { mixFigure } from './mixfig.js?v=5';
import { goCareerCard } from './gocareer.js?v=8';

let _sel = null;        // 선택된 선수 이름
let _trendKey = 'avg';  // 경기별 흐름 지표: avg | ops
let _logAll = false;    // 경기 로그 전체 보기
let _data = null;       // buildData() 결과 — 뷰를 열 때마다 새로 만든다

const QUAL_PA = 5;      // 팀 내 순위 대상: 5타석 이상

// 팀 내 순위 지표 (Savant 백분위 막대)
const RANKS = [
  { k: 'woba', label: 'wOBA', fmt: 'f3' },
  { k: 'avg', label: '타율', fmt: 'f3' },
  { k: 'obp', label: '출루율', fmt: 'f3' },
  { k: 'slg', label: '장타율', fmt: 'f3' },
  { k: 'iso', label: 'ISO', fmt: 'f3' },
  { k: 'bbRate', label: '볼넷%', fmt: 'pct' },
  { k: 'kRate', label: '삼진%', fmt: 'pct', lower: true },
];

const MIX = [
  { k: 'mix1b', label: '단타', c: '1b' },
  { k: 'mixXbh', label: '2·3루타', c: 'xbh' },
  { k: 'mixHr', label: '홈런', c: 'hr' },
  { k: 'mixBb', label: '볼넷·사구', c: 'bb' },
  { k: 'mixK', label: '삼진', c: 'k' },
  { k: 'mixOut', label: '범타', c: 'out' },
];

// 경기 로그 결과 약어
const SHORT = { __proto__: null,
  '안타': ['안', '1b'], '내야안타': ['내안', '1b'], '2루타': ['2루', 'xbh'], '3루타': ['3루', 'xbh'], '홈런': ['홈런', 'hr'],
  '볼넷': ['볼넷', 'bb'], '사구': ['사구', 'bb'], '삼진': ['삼진', 'k'], '희타': ['희타', 'out'], '희비': ['희비', 'out'],
  '땅볼 아웃': ['땅', 'out'], '플라이 아웃': ['뜬', 'out'], '병살': ['병살', 'out'], '라인드라이브 아웃': ['라인', 'out'], '삼중살': ['삼중', 'out'], '실책': ['실책', 'out'], '야수선택': ['야선', 'out'],
};

// ── 진입 ──────────────────────────────────────────────────────
export function openProfileView() {
  document.querySelectorAll('.savant-view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('profileView');
  if (view) view.classList.add('active');
  _data = buildData();
  const names = _data.players.map(p => p.name);
  if (!names.includes(_sel)) _sel = null;
  if (!_sel) {
    // 기록 탭에서 선택 중인 타자가 있으면 그 선수, 아니면 타석이 가장 많은 선수
    const cur = window.AS && window.AS.batter && window.AS.batter.name;
    const withPa = _data.players.filter(p => p.pa > 0);
    _sel = (withPa.find(p => p.name === cur) || withPa[0] || {}).name || null;
  }
  renderProfilePlayerList();
  _renderProfile();
}

export function renderProfilePlayerList() {
  const el = document.getElementById('profilePlayerList');
  if (!el) return;
  if (!_data) _data = buildData();
  const ps = _data.players;
  if (!ps.length) { el.innerHTML = ''; return; }
  el.innerHTML = playerChips(ps, _sel, 'selectProfilePlayer');
  const on = el.querySelector('.an-chip.on');
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}

export function selectProfilePlayer(name) {
  _sel = name || null;
  _logAll = false;
  document.querySelectorAll('#profilePlayerList .an-chip').forEach(b => {
    const on = b.dataset.name === _sel;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  _renderProfile();
}

export function setProfileTrend(key) {
  _trendKey = key === 'ops' ? 'ops' : 'avg';
  _renderProfile();
  if (_onEmbed) _onEmbed();
}

export function toggleProfileLog() {
  _logAll = !_logAll;
  _renderProfile();
  if (_onEmbed) _onEmbed();
}

// ── 타자 탭(시즌 화면)에 끼워 넣기 — 분석 서브탭 7→5: 프로필 내용은 타자 탭 [시즌]으로 간다 ──
//   아래 함수들은 기존 카드 함수를 그대로 부른다 (계산 · 문구 그대로). 프로필 서브탭 화면(openProfileView)도 그대로 남아 있다
let _onEmbed = null;     // 흐름 지표 · 경기 로그 버튼을 누른 뒤 타자 탭을 다시 그리는 함수 (batter.js가 등록)
let _embedName = null;   // 타자 탭에서 보고 있는 선수 — 바뀌면 경기 로그 '전체 보기'를 접는다
export function onProfileChange(fn) { _onEmbed = typeof fn === 'function' ? fn : null; }
// 히어로에 붙일 것: wOBA · wOBA+(전체=100) · 유형 태그 · 표본 배지
export function profileHeroBits(P, pool) {
  const s = P.st;
  return {
    woba: s.pa ? s.woba : null,
    idx: pool.woba > 0 && s.pa ? Math.round(s.woba / pool.woba * 100) : null,
    tags: s.pa ? _types(s, pool) : [],
    smp: s.pa ? sampleBadge(s.pa) : null,
  };
}
// 분석 요약 문장 (팀 내 1위 문장에 쓰는 순위표까지 계산)
export function profileInsights(P, data) {
  _data = data;
  return _insightList(P, data.pool, _rankTable(P));
}
// 방향별 성적 표 (타구 방향 카드 아래)
export function profileDirTable(P) { return _dirTable(P); }
// 시즌 화면 카드: 팀 내 위치 · 코스별 핫/콜드 존 · 타석 결과 구성 + 상황별 · 경기별 누적 흐름 · 경기 로그 · 구종별 + 누적 기록
export function profileSeasonHtml(P, data) {
  _data = data;
  if (_embedName !== P.name) { _embedName = P.name; _logAll = false; }
  return `
    ${_rankCard(P, _rankTable(P))}
    <section class="an-card">
      <header class="an-hd"><h3>코스별 핫/콜드 존</h3><span class="an-hd-note">타석 결과가 나온 공 기준 · 타율</span></header>
      ${hotColdFigure(P.abs, P.st.avg, P.st.pa) || '<div class="an-note">코스(존)가 기록된 타석이 없어요. 기록할 때 존을 함께 누르면 코스별 핫/콜드 존이 나와요.</div>'}
    </section>
    <div class="pf-2col">
      ${_mixCard(P, data.pool)}
      ${_splitCard(P)}
    </div>
    <section class="an-card">
      <header class="an-hd">
        <h3>경기별 누적 흐름</h3>
        <div class="an-seg" role="tablist" aria-label="흐름 지표">
          <button role="tab" class="${_trendKey === 'avg' ? 'on' : ''}" aria-selected="${_trendKey === 'avg'}" onclick="setProfileTrend('avg')">타율</button>
          <button role="tab" class="${_trendKey === 'ops' ? 'on' : ''}" aria-selected="${_trendKey === 'ops'}" onclick="setProfileTrend('ops')">OPS</button>
        </div>
      </header>
      ${trendChart([{ name: P.name, cls: 'a', trend: P.trend }], _trendKey, 'N번째 출전 경기까지의 누적 기록 · 최근 15경기')}
    </section>
    ${_gameLog(P)}
    ${_pitchAndCounts(P)}
    ${goCareerCard(P.name, P.games, P.st.pa)}`;
}

// ── 렌더 ─────────────────────────────────────────────────────
function _renderProfile() {
  const el = document.getElementById('profileContent');
  if (!el) return;
  if (!_data) _data = buildData();
  if (!_data.players.length) {
    el.innerHTML = emptyState('아직 기록된 타자가 없어요', '기록 탭에서 타석 결과를 입력하면 선수별 프로필이 만들어져요.');
    return;
  }
  if (!_sel) {
    el.innerHTML = emptyState('선수를 선택하세요', '위 목록에서 선수를 누르면 통산 기록과 분석이 나와요.');
    return;
  }
  const P = playerData(_data, _sel);
  if (!P.st.pa) {
    el.innerHTML = _hero(P, _data.pool) + emptyState('아직 이 선수의 타석 기록이 없어요', '라인업에는 있지만 기록된 타석이 없어요.');
    return;
  }
  const ranks = _rankTable(P);
  el.innerHTML = `
    ${_hero(P, _data.pool)}
    <div class="pf-report"><button type="button" class="pf-report-btn" data-name="${_esc(P.name)}" onclick="openPlayerReport({ name: this.dataset.name })">🧾 이 선수 리포트 만들기 <small>학부모 공유용 이미지</small></button></div>
    ${_insights(P, _data.pool, ranks)}
    ${_rankCard(P, ranks)}
    <section class="an-card">
      <header class="an-hd"><h3>타구 방향</h3><span class="an-hd-note">${P.bats === 'L' ? '좌타' : '우타'} 기준 당김/밀어 자동 판정</span></header>
      <div class="pf-spray">
        ${sprayFigure(P)}
        ${_dirTable(P)}
      </div>
      <div class="an-spray-key">
        <span><i class="k-1b"></i>단타</span><span><i class="k-xbh"></i>2·3루타</span><span><i class="k-hr"></i>홈런</span><span><i class="k-out"></i>아웃</span>
      </div>
    </section>
    <section class="an-card">
      <header class="an-hd"><h3>코스별 핫/콜드 존</h3><span class="an-hd-note">타석 결과가 나온 공 기준 · 타율</span></header>
      ${hotColdFigure(P.abs, P.st.avg, P.st.pa) || '<div class="an-note">코스(존)가 기록된 타석이 없어요. 기록할 때 존을 함께 누르면 코스별 핫/콜드 존이 나와요.</div>'}
    </section>
    <div class="pf-2col">
      ${_mixCard(P, _data.pool)}
      ${_splitCard(P)}
    </div>
    <section class="an-card">
      <header class="an-hd">
        <h3>경기별 누적 흐름</h3>
        <div class="an-seg" role="tablist" aria-label="흐름 지표">
          <button role="tab" class="${_trendKey === 'avg' ? 'on' : ''}" aria-selected="${_trendKey === 'avg'}" onclick="setProfileTrend('avg')">타율</button>
          <button role="tab" class="${_trendKey === 'ops' ? 'on' : ''}" aria-selected="${_trendKey === 'ops'}" onclick="setProfileTrend('ops')">OPS</button>
        </div>
      </header>
      ${trendChart([{ name: P.name, cls: 'a', trend: P.trend }], _trendKey, 'N번째 출전 경기까지의 누적 기록 · 최근 15경기')}
    </section>
    ${_gameLog(P)}
    ${_pitchAndCounts(P)}
  `;
}

function _hero(P, pool) {
  const s = P.st;
  const smp = s.pa ? sampleBadge(s.pa) : null;
  const meta = [P.num !== '' && P.num != null ? '#' + _esc(P.num) : '', P.bats === 'L' ? '좌타' : P.bats === 'R' ? '우타' : P.bats === 'S' ? '스위치' : '', `${P.games}경기 ${s.pa}타석`].filter(Boolean).join(' · ');
  const idx = pool.woba > 0 && s.pa ? Math.round(s.woba / pool.woba * 100) : null;
  const tags = s.pa ? _types(s, pool) : [];
  const tile = (k, label) => {
    const d = s[k] - pool[k];
    const same = Math.abs(d) < 0.0005;
    return `
      <div class="pf-kpi">
        <span class="pf-kpi-lbl">${label}</span>
        <b>${f3(s[k])}</b>
        <small class="${same ? '' : d > 0 ? 'up' : 'down'}">${same ? '전체와 같음' : `${d > 0 ? '▲' : '▼'} ${f3(Math.abs(d))}`}</small>
      </div>`;
  };
  return `
    <section class="pf-hero">
      <div class="pf-id">
        <div class="pf-name">${_esc(P.name)}</div>
        <div class="pf-meta">${meta}</div>
        <div class="pf-tags">
          ${tags.map(t => `<span class="pf-tag">${t}</span>`).join('')}
          ${smp ? `<span class="an-badge ${smp.cls}">${smp.txt}</span>` : ''}
        </div>
      </div>
      ${s.pa ? `
      <div class="pf-main">
        <div class="pf-big">${f3(s.woba)}<small>wOBA</small></div>
        ${idx != null ? `<div class="pf-idx" title="내 기록 전체 평균 wOBA를 100으로 둔 값"><b>${idx}</b><small>wOBA+<br>전체=100</small></div>` : ''}
      </div>
      <div class="pf-kpis">
        ${tile('avg', '타율')}${tile('obp', '출루율')}${tile('slg', '장타율')}${tile('ops', 'OPS')}
      </div>
      <div class="pf-kpi-note">▲▼ = 내 기록 전체 평균(${f3(pool.avg)} / ${f3(pool.obp)} / ${f3(pool.slg)}) 대비</div>` : ''}
    </section>`;
}

// 타자 유형 태그: 전체 평균 대비 뚜렷한 특징만 (최대 2개)
function _types(s, pool) {
  if (s.pa < 10) return [];
  const out = [];
  if (s.iso >= pool.iso + 0.08 && s.iso >= 0.15) out.push('파워형');
  if (s.avg >= pool.avg + 0.05 && s.kRate <= pool.kRate) out.push('컨택형');
  if (s.bbRate >= pool.bbRate + 0.04) out.push('선구안형');
  if (s.dn >= 5 && s.pull / s.dn >= 0.55) out.push('풀히터');
  else if (s.dn >= 5 && s.oppo / s.dn >= 0.4) out.push('밀어치기형');
  if (s.kRate >= pool.kRate + 0.08) out.push('삼진 많음');
  return out.slice(0, 2);
}

// ── 팀 내 순위 ────────────────────────────────────────────────
function _rankTable(P) {
  const qual = _data.players.filter(p => p.pa >= QUAL_PA).map(p => (p.name === P.name ? P.st : playerData(_data, p.name).st));
  const n = qual.length;
  const mine = P.st.pa >= QUAL_PA;
  return {
    n, mine,
    rows: RANKS.map(r => {
      const v = P.st[r.k];
      const better = qual.filter(x => (r.lower ? x[r.k] < v : x[r.k] > v)).length;
      const worse = qual.filter(x => (r.lower ? x[r.k] > v : x[r.k] < v)).length;
      const ties = n - better - worse - (mine ? 1 : 0);
      // 백분위: 나보다 못한 선수 비율 (동률은 절반) — 1~99로 표시
      const p = n > 1 ? (worse + ties / 2) / (n - (mine ? 1 : 0)) : 0.5;
      return { ...r, v, rank: better + 1, pctl: Math.max(1, Math.min(99, Math.round(p * 100))) };
    }),
  };
}

// 발산형 색: 낮음(Signal Blue) → 중간(회색) → 높음(Hit Red)
function _pctColor(p) {
  const lo = [137, 155, 183], mid = [251, 247, 238], hi = [223, 139, 131];   // 종이 팔레트 (펜 파랑 · 종이 · 펜 빨강)
  const t = Math.abs(p - 50) / 50;
  const to = p < 50 ? lo : hi;
  const c = mid.map((m, i) => Math.round(m + (to[i] - m) * t));
  return `rgb(${c.join(',')})`;
}

function _rankCard(P, R) {
  let body;
  if (R.n < 3) body = `<div class="an-note">${QUAL_PA}타석 이상 선수가 3명 이상 있어야 팀 내 순위가 나와요. (지금 ${R.n}명)</div>`;
  else if (!R.mine) body = `<div class="an-note">${QUAL_PA}타석 이상 기록되면 팀 내 순위에 들어가요. (지금 ${P.st.pa}타석)</div>`;
  else body = `
    <div class="pf-ranks">
      ${R.rows.map(r => `
        <div class="pf-rank" title="${r.label} ${fmt(r.v, r.fmt)} · ${R.n}명 중 ${r.rank}위 (백분위 ${r.pctl})">
          <span class="pf-rank-lbl">${r.label}${r.lower ? '<small>낮을수록 좋음</small>' : ''}</span>
          <span class="pf-rank-track">
            <i style="width:${r.pctl}%;background:${_pctColor(r.pctl)}"></i>
            <b style="left:${r.pctl}%;background:${_pctColor(r.pctl)}">${r.pctl}</b>
          </span>
          <span class="pf-rank-v">${fmt(r.v, r.fmt)}<small>${r.rank}/${R.n}위</small></span>
        </div>`).join('')}
    </div>
    <div class="pf-rank-scale"><span>팀 내 하위</span><span>평균</span><span>팀 내 상위</span></div>`;
  return `
    <section class="an-card">
      <header class="an-hd"><h3>팀 내 위치</h3><span class="an-hd-note">${QUAL_PA}타석 이상 ${R.n}명 기준 백분위</span></header>
      ${body}
    </section>`;
}

// ── 방향별 성적 ──────────────────────────────────────────────
function _dirTable(P) {
  const dirs = [
    { l: '당김', c: 'pull', f: a => window._isPull && window._isPull(a) },
    { l: '센터', c: 'ctr', f: a => window._isCtr && window._isCtr(a) },
    { l: '밀어', c: 'oppo', f: a => window._isOppo && window._isOppo(a) },
  ];
  const bip = P.abs.filter(a => a.deg != null);
  if (!bip.length) return '';
  const rows = dirs.map(d => {
    const list = bip.filter(d.f);
    const h = list.filter(a => HITS.includes(a.res)).length;
    const xbh = list.filter(a => a.res === '2루타' || a.res === '3루타' || a.res === '홈런').length;
    return { ...d, n: list.length, h, xbh, avg: list.length ? h / list.length : 0 };
  });
  return `
    <table class="pf-dir">
      <caption>방향별 성적 <small>(안타 ÷ 타구)</small></caption>
      <thead><tr><th scope="col">방향</th><th scope="col">타구</th><th scope="col">안타</th><th scope="col">장타</th><th scope="col">타구 타율</th></tr></thead>
      <tbody>${rows.map(r => `
        <tr><th scope="row"><i class="an-sw ${r.c}"></i>${r.l}</th><td>${r.n}</td><td>${r.h}</td><td>${r.xbh}</td><td><b>${r.n ? f3(r.avg) : '—'}</b></td></tr>`).join('')}
      </tbody>
    </table>`;
}

// ── 타석 결과 구성 ───────────────────────────────────────────
// 이 선수 = 굵은 누적 막대 · 내 기록 전체 = 얇은 기준 막대, 아래 표에 비율과 횟수
function _mixCard(P, pool) {
  const s = P.st;
  const cnt = { mix1b: s.s1, mixXbh: s.s2 + s.s3, mixHr: s.hr, mixBb: s.bb + s.hbp, mixK: s.k, mixOut: s.pa - s.s1 - s.s2 - s.s3 - s.hr - s.bb - s.hbp - s.k };
  return `
    <section class="an-card">
      <header class="an-hd"><h3>타석 결과 구성</h3><span class="an-hd-note">타석 = 100%</span></header>
      ${mixFigure(MIX, [{ name: P.name, st: s, cnt }, { name: '내 기록 전체', tname: '전체', st: pool, ref: true }])}
    </section>`;
}

// ── 상황별 (볼카운트 · 이닝) ────────────────────────────────
function _splitCard(P) {
  const withCount = P.abs.filter(a => a.count && a.count.s != null);
  const inn = a => { const m = String(a.inn || '').match(/\d+/); return m ? +m[0] : (String(a.inn || '').includes('연장') ? 10 : null); };
  const withInn = P.abs.filter(a => inn(a) != null);
  const groups = [];
  if (withCount.length) groups.push({ t: '볼카운트', rows: [
    { l: '0~1스트라이크', abs: withCount.filter(a => a.count.s < 2) },
    { l: '2스트라이크', abs: withCount.filter(a => a.count.s >= 2) },
    { l: '볼 3개', abs: withCount.filter(a => a.count.b >= 3) },
  ] });
  if (withInn.length) groups.push({ t: '이닝', rows: [
    { l: '1~3회', abs: withInn.filter(a => inn(a) <= 3) },
    { l: '4~6회', abs: withInn.filter(a => inn(a) >= 4 && inn(a) <= 6) },
    { l: '7회 이후', abs: withInn.filter(a => inn(a) >= 7) },
  ] });
  const body = groups.length ? `
    <table class="pf-split">
      <thead><tr><th scope="col">상황</th><th scope="col">타석</th><th scope="col">타율</th><th scope="col">출루율</th><th scope="col">삼진%</th></tr></thead>
      ${groups.map(g => `
        <tbody>
          <tr class="pf-split-g"><th colspan="5" scope="rowgroup">${g.t}</th></tr>
          ${g.rows.map(r => { const c = calcStats(r.abs); return c.pa ? `
          <tr><th scope="row">${r.l}</th><td>${c.pa}</td><td><b>${c.ab ? f3(c.avg) : '—'}</b></td><td>${f3(c.obp)}</td><td>${pct(c.kRate)}</td></tr>` : `
          <tr class="pf-split-none"><th scope="row">${r.l}</th><td colspan="4">기록 없음</td></tr>`; }).join('')}
        </tbody>`).join('')}
    </table>` : '<div class="an-note">볼카운트·이닝 기록이 있는 타석이 없어요.</div>';
  return `
    <section class="an-card">
      <header class="an-hd"><h3>상황별 성적</h3><span class="an-hd-note">결과가 나온 순간의 카운트 기준</span></header>
      ${body}
    </section>`;
}

// ── 경기 로그 ────────────────────────────────────────────────
function _gameLog(P) {
  const games = P.gameList.slice().reverse();
  const show = _logAll ? games : games.slice(0, 8);
  const row = g => {
    const c = calcStats(g.abs);
    const res = g.abs.map(a => { const [t, cls] = SHORT[a.res] || [a.res, 'out']; return `<i class="r-${cls}" title="${_esc(a.res)}${a.inn ? ' · ' + _esc(a.inn) : ''}">${_esc(t)}</i>`; }).join('');
    const line = [`${c.pa}타석`, `${c.h}/${c.ab}`, c.hr ? `${c.hr}홈런` : '', c.rbi ? `${c.rbi}타점` : ''].filter(Boolean).join(' · ');
    return `
      <li>
        <div class="pf-log-top">
          <span class="pf-log-g">${g.current ? '<span class="pf-live">현재</span>' : ''}${_esc(g.label)}</span>
          <span class="pf-log-st">${_esc(line)}</span>
        </div>
        <div class="pf-log-res">${res}</div>
      </li>`;
  };
  return `
    <section class="an-card">
      <header class="an-hd"><h3>경기 로그</h3><span class="an-hd-note">최근 경기부터 · 안타/타수</span></header>
      <ol class="pf-log">${show.map(row).join('')}</ol>
      ${games.length > 8 ? `<button type="button" class="pf-more" onclick="toggleProfileLog()">${_logAll ? '최근 8경기만 보기' : `전체 ${games.length}경기 보기`}</button>` : ''}
    </section>`;
}

// 구종별 타율 + 누적 기록: 넓은 화면에서 나란히 (구종 기록이 없으면 누적 기록만)
function _pitchAndCounts(P) {
  const pt = pitchTable([{ name: P.name, cls: 'a', pitch: P.pitch }]);
  return pt ? `<div class="pf-2col pf-pt-row">${pt}${_counts(P)}</div>` : _counts(P);
}

// ── 누적 기록 ────────────────────────────────────────────────
function _counts(P) {
  const s = P.st;
  const items = [
    ['경기', P.games], ['타석', s.pa], ['타수', s.ab], ['안타', s.h], ['2루타', s.s2], ['3루타', s.s3],
    ['홈런', s.hr], ['타점', s.rbi], ['루타', s.tb], ['볼넷', s.bb], ['사구', s.hbp], ['삼진', s.k],
    ['희생', s.sf + s.sh], ['BABIP', f3(s.babip)], ['장타/타석', pct(s.xbhRate)], ['볼넷/삼진', s.k ? (s.bb / s.k).toFixed(2) : s.bb ? '—' : '0.00'],
  ];
  return `
    <section class="an-card">
      <header class="an-hd"><h3>누적 기록</h3></header>
      <dl class="pf-counts">${items.map(([l, v]) => `<div><dt>${l}</dt><dd>${_esc(v)}</dd></div>`).join('')}</dl>
    </section>`;
}

// ── 자동 분석 코멘트 (숫자 근거를 같이 보여준다) ─────────────
function _insights(P, pool, R) {
  const nm = _esc(P.name);
  const { out, warn } = _insightList(P, pool, R);
  if (!out.length) return warn ? `<section class="an-card an-insight"><header class="an-hd"><h3>분석 요약</h3></header>${warn}</section>` : '';
  return `
    <section class="an-card an-insight">
      <header class="an-hd"><h3>${nm}${josa(P.name, '은', '는')} 이런 타자예요</h3></header>
      <ul>${out.map(t => `<li>${t}</li>`).join('')}</ul>
      ${warn}
    </section>`;
}
// 한 줄 = 결론 문장 + 그 아래 작은 근거 숫자
const _ln = (t, ev) => `${t}<small class="an-ev">${ev}</small>`;
// 문장 목록 + 표본 경고 (위 카드와 타자 탭이 같이 쓴다)
//   결론 먼저, 눈에 띄는 것만: 평범한 값(평균 수준 최근 폼 · 고른 방향 · 보통 2스트라이크)은 말하지 않는다.
//   팀 내 1위는 따로 줄을 만들지 않고 같은 지표 문장에 붙인다
function _insightList(P, pool, R) {
  const s = P.st;
  const out = [];
  const top = new Set(R.mine && R.n >= 3 ? R.rows.filter(r => r.rank === 1).map(r => r.k) : []);
  const rk = `${R.n}명 중 1위`;
  const rate = k => k === 'bbRate' || k === 'kRate';
  const v = (st, k) => (rate(k) ? pct(st[k]) : f3(st[k]));

  // 강점·약점: 전체 평균 대비 차이를 영역별 기준 폭으로 나눠 비교
  const areas = [
    { k: 'avg', l: '타율', u: 0.05, good: '공을 <b>잘 맞혀요</b>', team: '팀에서 <b>타율이 가장 높아요</b>', bad: '<b>타율이 아쉬워요</b>' },
    { k: 'obp', l: '출루율', u: 0.05, good: '<b>잘 나가는</b> 타자예요', team: '팀에서 <b>가장 잘 나가는</b> 타자예요', bad: '<b>출루가 아쉬워요</b>' },
    { k: 'iso', l: 'ISO', u: 0.05, good: '<b>한 방</b>이 있어요', team: '팀에서 <b>장타력이 가장 좋아요</b>', bad: '<b>장타가 잘 안 나와요</b>' },
    { k: 'bbRate', l: '볼넷', u: 0.03, good: '볼을 <b>잘 골라요</b>', team: '팀에서 <b>볼넷을 가장 잘 얻어요</b>', bad: '<b>볼넷이 적어요</b>' },
    { k: 'kRate', l: '삼진', u: 0.05, lower: true, good: '삼진을 <b>잘 안 당해요</b>', team: '팀에서 <b>삼진을 가장 적게</b> 당해요', bad: '<b>삼진이 많은</b> 편이에요' },
  ].map(x => ({ ...x, d: ((s[x.k] - pool[x.k]) * (x.lower ? -1 : 1)) / x.u }));
  const best = areas.filter(x => x.d >= 1).sort((x, y) => y.d - x.d)[0];
  const worst = areas.filter(x => x.d <= -1).sort((x, y) => x.d - y.d)[0];
  const said = new Set();
  const area = (x, t) => { said.add(x.k); out.push(_ln(`${t}.`, `${x.l} ${v(s, x.k)} · ${top.has(x.k) ? rk : `전체 ${v(pool, x.k)}`}`)); };
  if (best) area(best, top.has(best.k) ? best.team : best.good);

  if (pool.woba > 0) {
    const d = Math.round((s.woba / pool.woba - 1) * 100);
    const t = Math.abs(d) < 5 ? '공격 기여는 전체 평균과 <b>비슷해요</b>.' : `공격 기여가 전체 평균보다 <b>${Math.abs(d)}% ${d > 0 ? '커요' : '작아요'}</b>.`;
    out.push(_ln(t, `wOBA ${f3(s.woba)} · 전체 ${f3(pool.woba)}${top.has('woba') ? ` · ${rk}` : ''}`));
  }

  // 강점 말고도 팀 1위인 지표 (약점으로 잡힌 지표는 빼서 서로 어긋나는 말을 하지 않는다)
  areas.filter(x => top.has(x.k) && !said.has(x.k) && x !== worst).slice(0, 2).forEach(x => area(x, x.team));
  if (worst) area(worst, worst.bad);

  // 최근 폼: 최근 3경기 vs 통산 — OPS 차이 0.1 이상일 때만
  if (P.gameList.length >= 4) {
    const recent = calcStats(P.gameList.slice(-3).flatMap(g => g.abs));
    const d = recent.ops - s.ops;
    if (Math.abs(d) >= 0.1) out.push(_ln(d > 0 ? '최근 3경기 <b>타격감이 좋아요</b>.' : '최근 3경기는 <b>주춤해요</b>.', `최근 3경기 OPS ${f3(recent.ops)} · 통산 ${f3(s.ops)}`));
  }

  // 방향: 타구 15개 이상에서 한 방향이 55% 이상일 때만 (무작위 1/3씩이면 15개에서 약 4%만 여기 걸린다)
  if (s.dn >= 15) {
    const [n, c, t] = [['당겨치기', s.pull, '당겨 치는'], ['센터', s.center, '가운데로 보내는'], ['밀어치기', s.oppo, '밀어 치는']].sort((x, y) => y[1] - x[1])[0];
    if (c / s.dn >= 0.55) out.push(_ln(`<b>${t} 타구</b>가 많아요.`, `타구 ${s.dn}개 중 ${n} ${c}개 (${Math.round(c / s.dn * 100)}%)`));
  }

  // 2스트라이크: 타율 .300 이상이면 강점, 삼진 40% 이상이거나 타율 .150 미만이면 약점
  const two = P.abs.filter(a => a.count && a.count.s >= 2);
  if (two.length >= 5) {
    const c = calcStats(two);
    const t = c.ab && c.avg >= 0.3 ? '2스트라이크에 몰려도 <b>잘 버텨요</b>.' : c.kRate >= 0.4 || (c.ab >= 5 && c.avg < 0.15) ? '2스트라이크에 몰리면 <b>약해요</b>.' : '';
    if (t) out.push(_ln(t, `2스트라이크 ${c.pa}타석 · 타율 ${c.ab ? f3(c.avg) : '—'} · 삼진 ${pct(c.kRate)}`));
  }

  const warn = s.pa < 30
    ? `<p class="an-warn">⚠ ${s.pa < 10 ? '타석 수가 아주 적어서' : '타석 수가 적어서'}(${s.pa}타석) 몇 타석만 더 쌓여도 지표가 크게 바뀔 수 있어요. 경향을 보는 참고용으로 활용하세요.</p>`
    : '';
  return { out, warn };
}

if (typeof window !== 'undefined') {
  window.openProfileView = openProfileView;
  window.selectProfilePlayer = selectProfilePlayer;
  window.renderProfilePlayerList = renderProfilePlayerList;
  window.setProfileTrend = setProfileTrend;
  window.toggleProfileLog = toggleProfileLog;
}
