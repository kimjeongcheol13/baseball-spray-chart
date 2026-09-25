// 스카우팅 리포트 — 상대 타자를 어떻게 잡을지: 공략 포인트 · 코스 · 구종 · 카운트 · 수비 위치
import { HITS, esc as _esc } from '../constants.js';
import { buildData, playerData, calcStats, f3, pct, sampleBadge, emptyState, sprayFigure, playerChips } from './batdata.js?v=5';

// 저장 코스 이름 (기록 탭 존 선택과 같은 문자열) — 행: 높음/중간/낮음, 열: 내각(몸쪽)/중앙/외각(바깥쪽)
const ZONES = [
  '내각 높음', '중앙 높음', '외각 높음',
  '내각 중간', '중앙 중간', '외각 중간',
  '내각 낮음', '중앙 낮음', '외각 낮음',
];
const ZONE_SHORT = ZONES.map(z => (z === '중앙 중간' ? '한가운데' : z.replace('내각', '몸쪽').replace('외각', '바깥쪽').replace('중앙', '가운데')));
const MIN_ZONE_AB = 3;   // 코스·구종 판단 최소 타수
const MIN_SPLIT = 5;     // 카운트 판단 최소 타석

let _sel = null;
let _zoneMode = 'avg';   // 코스 칸 표시: avg | pa
let _data = null;
let _reportText = '';

const SHORT = {
  '안타': ['안타', '1b'], '내야안타': ['내야안타', '1b'], '2루타': ['2루타', 'xbh'], '3루타': ['3루타', 'xbh'], '홈런': ['홈런', 'hr'],
  '볼넷': ['볼넷', 'bb'], '사구': ['사구', 'bb'], '삼진': ['삼진', 'k'], '희타': ['희타', 'out'], '희비': ['희비', 'out'],
  '땅볼 아웃': ['땅볼', 'out'], '플라이 아웃': ['뜬공', 'out'], '병살': ['병살', 'out'],
};

// ── 진입 ──────────────────────────────────────────────────────
export function openScoutView() {
  document.querySelectorAll('.savant-view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('scoutView');
  if (view) view.classList.add('active');
  _data = buildData();
  const names = _data.players.map(p => p.name);
  if (!names.includes(_sel)) _sel = null;
  if (!_sel) _sel = (_data.players.find(p => p.pa > 0) || {}).name || null;
  renderScoutPlayerSelect();
  _render();
}

export function renderScoutPlayerSelect() {
  const el = document.getElementById('scoutPlayerList');
  if (!el) return;
  if (!_data) _data = buildData();
  el.innerHTML = playerChips(_data.players, _sel, 'generateScoutReport');
  const on = el.querySelector('.an-chip.on');
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}

export function generateScoutReport(name) {
  _sel = name || null;
  document.querySelectorAll('#scoutPlayerList .an-chip').forEach(b => {
    const on = b.dataset.name === _sel;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  _render();
}

export function setScoutZoneMode(mode) {
  _zoneMode = mode === 'pa' ? 'pa' : 'avg';
  _render();
}

export function exportScoutReport() {
  if (!_reportText) return;
  const done = () => {
    const btn = document.getElementById('scoutExportBtn');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '복사 완료!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(_reportText).then(done, () => window.showToast && window.showToast('복사하지 못했어요'));
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = _reportText;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  done();
}

// 인쇄: 스카우트 리포트만 보이도록 body 에 표시 클래스를 잠깐 붙인다
export function exportScoutPDF() {
  const b = document.body;
  const off = () => { b.classList.remove('sc-printing'); window.removeEventListener('afterprint', off); };
  b.classList.add('sc-printing');
  window.addEventListener('afterprint', off);
  window.print();
}

// ── 분석 ─────────────────────────────────────────────────────
function _analyze(P, pool) {
  const abs = P.abs;
  const s = P.st;

  // 코스 (결과가 나온 공의 코스)
  const zones = ZONES.map((z, i) => {
    const list = abs.filter(a => a.zone === z);
    const c = calcStats(list);
    return { i, z, label: ZONE_SHORT[i], pa: c.pa, ab: c.ab, h: c.h, avg: c.avg, slg: c.slg, k: c.k };
  });
  const zoned = zones.reduce((n, z) => n + z.pa, 0);

  // 구종 (결과가 나온 공의 구종)
  const byPt = {};
  abs.forEach(a => { if (a.pt) (byPt[a.pt] = byPt[a.pt] || []).push(a); });
  const pitches = Object.keys(byPt).map(pt => ({ pt, ...calcStats(byPt[pt]) })).sort((x, y) => y.pa - x.pa);

  // 카운트 — 결과가 나온 순간의 볼·스트라이크
  const cnt = abs.filter(a => a.count && a.count.s != null && a.count.b != null);
  const counts = [
    { k: 'pitcher', l: '투수 유리', d: '스트라이크 > 볼', abs: cnt.filter(a => a.count.s > a.count.b) },
    { k: 'even', l: '이븐', d: '볼 = 스트라이크', abs: cnt.filter(a => a.count.s === a.count.b) },
    { k: 'batter', l: '타자 유리', d: '볼 > 스트라이크', abs: cnt.filter(a => a.count.b > a.count.s) },
    { k: 'two', l: '2스트라이크', d: '스트라이크 2개', abs: cnt.filter(a => a.count.s >= 2) },
  ].map(c => ({ ...c, st: calcStats(c.abs) }));

  // 타구 성격: 인플레이 아웃 중 땅볼/뜬공
  const go = abs.filter(a => a.res === '땅볼 아웃' || a.res === '병살').length;
  const fo = abs.filter(a => a.res === '플라이 아웃' || a.res === '희비').length;
  const gdp = abs.filter(a => a.res === '병살').length;
  const dist = abs.filter(a => HITS.includes(a.res) && a.ft).map(a => a.ft);

  // 위협도: 전체 평균 대비 wOBA
  const r = pool.woba > 0 ? s.woba / pool.woba : 1;
  const threat = s.pa < 5 ? { k: 'na', l: '판단 보류', d: '타석이 너무 적어요' }
    : r >= 1.15 ? { k: 'high', l: '위험 타자', d: '전체 평균보다 확실히 강한 타자' }
    : r >= 1.0 ? { k: 'mid', l: '경계', d: '전체 평균 이상' }
    : r >= 0.85 ? { k: 'low', l: '보통', d: '전체 평균보다 조금 약함' }
    : { k: 'easy', l: '공략 가능', d: '전체 평균보다 확실히 약한 타자' };

  return { zones, zoned, pitches, counts, go, fo, gdp, dist, threat, idx: pool.woba > 0 ? Math.round(r * 100) : null };
}

// 공략 포인트: type = attack(공략) · avoid(주의) · field(수비) — 모든 항목에 근거 숫자와 표본을 붙인다
function _plan(P, A, pool) {
  const s = P.st;
  const out = [];
  const add = (type, title, why, n) => out.push({ type, title, why, n });

  // 코스
  const zq = A.zones.filter(z => z.ab >= MIN_ZONE_AB);
  zq.filter(z => z.avg <= 0.15).sort((x, y) => x.avg - y.avg || y.ab - x.ab).slice(0, 2)
    .forEach(z => add('attack', `${z.label} 코스로 승부`, `이 코스 타율 ${f3(z.avg)} (${z.h}/${z.ab})`, z.ab));
  zq.filter(z => z.avg >= 0.4).sort((x, y) => y.avg - x.avg).slice(0, 2)
    .forEach(z => add('avoid', `${z.label} 코스는 피하기`, `이 코스 타율 ${f3(z.avg)} (${z.h}/${z.ab})`, z.ab));

  // 구종
  const pq = A.pitches.filter(p => p.ab >= MIN_ZONE_AB);
  const best = pq.slice().sort((x, y) => x.woba - y.woba)[0];
  // 결정구: 이 타자 평균보다 확실히 약하고, 그 자체로도 잘 막힌 구종만
  if (best && best.woba < s.woba - 0.03 && (best.avg <= 0.25 || best.kRate >= 0.3)) add('attack', `결정구 후보: ${best.pt}`, `${best.pt}에 타율 ${f3(best.avg)}, 삼진 ${pct(best.kRate)} (${best.pa}타석)`, best.pa);
  pq.filter(p => p !== best && p.avg >= 0.4).slice(0, 1)
    .forEach(p => add('avoid', `${p.pt} 조심`, `${p.pt}에 타율 ${f3(p.avg)}, 장타율 ${f3(p.slg)} (${p.pa}타석)`, p.pa));

  // 카운트
  const C = Object.fromEntries(A.counts.map(c => [c.k, c.st]));
  if (C.pitcher.pa >= MIN_SPLIT && C.pitcher.avg <= 0.15) add('attack', '초반 스트라이크로 카운트 선점', `투수 유리 카운트에서 타율 ${f3(C.pitcher.avg)} (${C.pitcher.pa}타석)`, C.pitcher.pa);
  if (C.batter.pa >= MIN_SPLIT && C.batter.avg >= 0.4) add('avoid', '볼 카운트가 몰리면 위험', `타자 유리 카운트에서 타율 ${f3(C.batter.avg)} (${C.batter.pa}타석)`, C.batter.pa);
  if (C.two.pa >= MIN_SPLIT && C.two.kRate >= 0.35) add('attack', '2스트라이크 후 유인구', `2스트라이크에서 삼진 ${pct(C.two.kRate)} (${C.two.pa}타석)`, C.two.pa);
  else if (C.two.pa >= MIN_SPLIT && C.two.avg >= 0.35) add('avoid', '2스트라이크에도 끈질김', `2스트라이크에서 타율 ${f3(C.two.avg)} (${C.two.pa}타석)`, C.two.pa);

  // 선구안 · 파워 (전체 평균 대비)
  if (s.pa >= 10 && s.kRate >= pool.kRate + 0.08) add('attack', '삼진을 노릴 만한 타자', `삼진 ${pct(s.kRate)} · 전체 ${pct(pool.kRate)}`, s.pa);
  if (s.pa >= 10 && s.bbRate <= 0.04) add('attack', '존 안으로 적극 승부', `볼넷 ${pct(s.bbRate)} — 볼을 잘 골라내지 않아요`, s.pa);
  else if (s.pa >= 10 && s.bbRate >= pool.bbRate + 0.05) add('avoid', '볼넷 주의', `볼넷 ${pct(s.bbRate)} · 전체 ${pct(pool.bbRate)} — 존을 벗어나면 참아요`, s.pa);
  if (s.ab >= 10 && s.iso >= Math.max(0.2, pool.iso + 0.08)) add('avoid', '장타 경계', `ISO ${f3(s.iso)} · 전체 ${f3(pool.iso)}`, s.ab);

  // 수비 위치
  if (s.dn >= 6) {
    const pullP = s.pull / s.dn, oppoP = s.oppo / s.dn;
    const side = P.bats === 'L' ? ['1루', '3루'] : ['3루', '1루'];
    if (pullP >= 0.55) add('field', `${side[0]} 쪽(당김)으로 수비 이동`, `타구 ${Math.round(pullP * 100)}%가 당김 방향 (${s.pull}/${s.dn})`, s.dn);
    else if (oppoP >= 0.45) add('field', `${side[1]} 쪽(밀어)으로 수비 이동`, `타구 ${Math.round(oppoP * 100)}%가 밀어치기 방향 (${s.oppo}/${s.dn})`, s.dn);
  }
  const outs = A.go + A.fo;
  if (outs >= 6) {
    const ratio = A.fo ? A.go / A.fo : A.go;
    if (ratio >= 1.5) add('field', '땅볼 타자 — 내야 대비·병살 노리기', `땅볼 아웃 ${A.go} : 뜬공 아웃 ${A.fo}${A.gdp ? ` · 병살 ${A.gdp}` : ''}`, outs);
    else if (ratio <= 0.67) add('field', '뜬공 타자 — 외야 한 발 뒤로', `땅볼 아웃 ${A.go} : 뜬공 아웃 ${A.fo}`, outs);
  }

  const order = { attack: 0, avoid: 1, field: 2 };
  return out.sort((x, y) => order[x.type] - order[y.type]);
}

// ── 렌더 ─────────────────────────────────────────────────────
function _render() {
  const el = document.getElementById('scoutContent');
  if (!el) return;
  if (!_data) _data = buildData();
  _reportText = '';
  if (!_data.players.length) {
    el.innerHTML = emptyState('아직 기록된 타자가 없어요', '기록 탭에서 상대 타자의 타석을 입력하면 공략 리포트가 만들어져요.');
    return;
  }
  if (!_sel) {
    el.innerHTML = emptyState('분석할 타자를 선택하세요', '위 목록에서 타자를 누르면 공략 리포트가 나와요.');
    return;
  }
  const P = playerData(_data, _sel);
  if (!P.st.pa) {
    el.innerHTML = emptyState('아직 이 타자의 타석 기록이 없어요', '라인업에는 있지만 기록된 타석이 없어요.');
    return;
  }
  const pool = _data.pool;
  const A = _analyze(P, pool);
  const plan = _plan(P, A, pool);
  _reportText = _textReport(P, A, plan);

  el.innerHTML = `
    ${_hero(P, A)}
    ${_planCard(P, plan)}
    <div class="sc-2col">
      ${_zoneCard(P, A)}
      ${_pitchCard(P, A)}
    </div>
    ${_countCard(A)}
    <section class="an-card">
      <header class="an-hd"><h3>타구 방향 · 수비 위치</h3><span class="an-hd-note">${P.bats === 'L' ? '좌타' : '우타'} 기준 당김/밀어</span></header>
      <div class="sc-spray">
        ${sprayFigure(P)}
        ${_battedCard(P, A)}
      </div>
      <div class="an-spray-key">
        <span><i class="k-1b"></i>단타</span><span><i class="k-xbh"></i>2·3루타</span><span><i class="k-hr"></i>홈런</span><span><i class="k-out"></i>아웃</span>
      </div>
    </section>
    ${_recentCard(P)}
    ${_pitchLogCard(P)}
    <div class="sc-actions">
      <button type="button" id="scoutExportBtn" class="sc-act" onclick="exportScoutReport()">리포트 텍스트 복사</button>
      <button type="button" class="sc-act" onclick="exportScoutPDF()">인쇄 · PDF 저장</button>
    </div>
  `;
}

function _hero(P, A) {
  const s = P.st;
  const smp = sampleBadge(s.pa);
  const meta = [P.num !== '' && P.num != null ? '#' + _esc(P.num) : '', P.bats === 'L' ? '좌타' : P.bats === 'R' ? '우타' : P.bats === 'S' ? '스위치' : '', `${P.games}경기 ${s.pa}타석`].filter(Boolean).join(' · ');
  const kpi = (l, v) => `<div class="sc-kpi"><span>${l}</span><b>${v}</b></div>`;
  return `
    <section class="sc-hero">
      <div class="sc-id">
        <div class="sc-eyebrow">상대 타자 공략 리포트</div>
        <div class="sc-name">${_esc(P.name)}</div>
        <div class="sc-meta">${meta}</div>
        ${smp ? `<span class="an-badge ${smp.cls}">${smp.txt}</span>` : ''}
      </div>
      <div class="sc-threat ${A.threat.k}">
        <small>위협도</small>
        <b>${A.threat.l}</b>
        <span>${A.idx != null && s.pa >= 5 ? `wOBA+ ${A.idx} · ` : ''}${A.threat.d}</span>
      </div>
      <div class="sc-kpis">
        ${kpi('타율', f3(s.avg))}${kpi('출루율', f3(s.obp))}${kpi('장타율', f3(s.slg))}${kpi('삼진%', pct(s.kRate))}${kpi('볼넷%', pct(s.bbRate))}
      </div>
    </section>`;
}

function _planCard(P, plan) {
  const TAG = { attack: '공략', avoid: '주의', field: '수비' };
  const ICON = {
    attack: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
    avoid: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    field: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21L3 12l9-9 9 9z"/><path d="M12 3v18"/></svg>',
  };
  const low = P.st.pa < 10;
  const body = plan.length
    ? `<ol class="sc-plan">${plan.map(p => `
        <li class="sc-plan-${p.type}">
          <span class="sc-plan-ic">${ICON[p.type]}</span>
          <div><b>${_esc(p.title)}</b><span>${_esc(p.why)}</span></div>
          <em>${TAG[p.type]}</em>
        </li>`).join('')}</ol>`
    : `<div class="an-note">아직 뚜렷한 약점·강점이 보이지 않아요. 코스·구종·카운트를 함께 기록할수록 공략 포인트가 정확해져요.</div>`;
  return `
    <section class="an-card">
      <header class="an-hd"><h3>${_esc(P.name)} 공략 포인트</h3><span class="an-hd-note">공략 → 주의 → 수비 순</span></header>
      ${body}
      ${low ? `<p class="an-warn">⚠ 타석이 ${P.st.pa}개뿐이라 참고용이에요. 경기를 거듭할수록 판단이 정확해져요.</p>` : ''}
    </section>`;
}

// 발산형 색: 타자에게 약함(Signal Blue = 공략) → 회색 → 강함(Hit Red = 위험). 기준 = 이 타자의 통산 타율
function _zoneColor(avg, base) {
  const lo = [137, 155, 183], mid = [251, 247, 238], hi = [223, 139, 131];   // 종이 팔레트 (펜 파랑 · 종이 · 펜 빨강)
  const span = Math.max(0.15, base);
  const t = Math.max(-1, Math.min(1, (avg - base) / span));
  const to = t < 0 ? lo : hi;
  const c = mid.map((m, i) => Math.round(m + (to[i] - m) * Math.abs(t)));
  return `rgb(${c.join(',')})`;
}

function _zoneCard(P, A) {
  const base = P.st.avg;
  const cells = A.zones.map(z => {
    const ok = z.ab >= MIN_ZONE_AB;
    const bg = ok ? _zoneColor(z.avg, base) : 'transparent';
    const main = _zoneMode === 'pa' ? (z.pa || '') : (z.ab ? f3(z.avg) : '');
    const sub = _zoneMode === 'pa' ? (z.pa ? '타석' : '') : (z.ab ? `${z.h}/${z.ab}` : z.pa ? `${z.pa}타석` : '');
    return `<div class="sc-zc${ok ? '' : ' thin'}" style="background:${bg}" title="${z.label}: ${z.pa}타석 · 타율 ${z.ab ? f3(z.avg) : '—'} (${z.h}/${z.ab})"><b>${main || '—'}</b><small>${sub}</small></div>`;
  }).join('');
  return `
    <section class="an-card">
      <header class="an-hd">
        <h3>코스별 결과</h3>
        <div class="an-seg" role="tablist" aria-label="코스 표시">
          <button role="tab" class="${_zoneMode === 'avg' ? 'on' : ''}" aria-selected="${_zoneMode === 'avg'}" onclick="setScoutZoneMode('avg')">타율</button>
          <button role="tab" class="${_zoneMode === 'pa' ? 'on' : ''}" aria-selected="${_zoneMode === 'pa'}" onclick="setScoutZoneMode('pa')">타석</button>
        </div>
      </header>
      ${A.zoned ? `
      <div class="sc-zone">
        <div class="sc-zone-top"><span>몸쪽</span><span>가운데</span><span>바깥쪽</span></div>
        <div class="sc-zone-side"><span>높음</span><span>중간</span><span>낮음</span></div>
        <div class="sc-zone-grid">${cells}</div>
      </div>
      <div class="sc-zone-key">
        <span class="k-lo">공략 코스</span><i></i><span class="k-hi">위험 코스</span>
      </div>
      <div class="an-hd-note sc-zone-note">결과가 나온 공의 코스 · 색은 이 타자 통산 타율(${f3(base)}) 대비 · ${MIN_ZONE_AB}타수 미만은 색 없음 · 코스 기록 ${A.zoned}/${P.st.pa}타석</div>`
      : '<div class="an-note">코스(존)가 기록된 타석이 없어요. 기록할 때 존을 함께 누르면 코스별 결과가 나와요.</div>'}
    </section>`;
}

function _pitchCard(P, A) {
  const body = A.pitches.length ? `
    <table class="sc-pt">
      <thead><tr><th scope="col">구종</th><th scope="col">타석</th><th scope="col">타율</th><th scope="col">장타율</th><th scope="col">삼진%</th></tr></thead>
      <tbody>${A.pitches.map(p => `
        <tr${p.ab < MIN_ZONE_AB ? ' class="thin"' : ''}>
          <th scope="row">${_esc(p.pt)}</th><td>${p.pa}</td><td><b>${p.ab ? f3(p.avg) : '—'}</b></td><td>${p.ab ? f3(p.slg) : '—'}</td><td>${pct(p.kRate)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="an-hd-note sc-zone-note">결과가 나온 공의 구종 · 흐린 줄은 ${MIN_ZONE_AB}타수 미만</div>`
    : '<div class="an-note">구종이 기록된 타석이 없어요.</div>';
  return `
    <section class="an-card">
      <header class="an-hd"><h3>구종별 결과</h3></header>
      ${body}
    </section>`;
}

function _countCard(A) {
  const has = A.counts.some(c => c.st.pa);
  const body = has ? `
    <div class="sc-counts">${A.counts.map(c => `
      <div class="sc-count${c.st.pa < MIN_SPLIT ? ' thin' : ''}">
        <div class="sc-count-hd"><b>${c.l}</b><small>${c.d}</small></div>
        <div class="sc-count-v">${c.st.ab ? f3(c.st.avg) : '—'}<small>타율</small></div>
        <dl>
          <div><dt>타석</dt><dd>${c.st.pa}</dd></div>
          <div><dt>출루율</dt><dd>${c.st.pa ? f3(c.st.obp) : '—'}</dd></div>
          <div><dt>삼진%</dt><dd>${c.st.pa ? pct(c.st.kRate) : '—'}</dd></div>
        </dl>
      </div>`).join('')}
    </div>` : '<div class="an-note">볼카운트가 기록된 타석이 없어요.</div>';
  return `
    <section class="an-card">
      <header class="an-hd"><h3>카운트별 결과</h3><span class="an-hd-note">결과가 나온 순간의 볼·스트라이크 · 흐린 칸은 ${MIN_SPLIT}타석 미만</span></header>
      ${body}
    </section>`;
}

function _battedCard(P, A) {
  const s = P.st;
  const outs = A.go + A.fo;
  const goP = outs ? A.go / outs : 0;
  const avgFt = A.dist.length ? Math.round(A.dist.reduce((x, y) => x + y, 0) / A.dist.length) : null;
  const dirAvg = f => {
    const list = P.abs.filter(a => a.deg != null && f(a));
    const h = list.filter(a => HITS.includes(a.res)).length;
    return list.length ? `${f3(h / list.length)}` : '—';
  };
  return `
    <div class="sc-batted">
      <div class="sc-batted-row">
        <span class="sc-bl">방향별 타구 타율</span>
        <div class="sc-dir3">
          <div><i class="an-sw pull"></i>당김<b>${dirAvg(a => window._isPull(a))}</b><small>${s.pull}개</small></div>
          <div><i class="an-sw ctr"></i>센터<b>${dirAvg(a => window._isCtr(a))}</b><small>${s.center}개</small></div>
          <div><i class="an-sw oppo"></i>밀어<b>${dirAvg(a => window._isOppo(a))}</b><small>${s.oppo}개</small></div>
        </div>
      </div>
      <div class="sc-batted-row">
        <span class="sc-bl">아웃 타구 성격 <small>(땅볼 : 뜬공)</small></span>
        ${outs ? `
        <div class="sc-gofo" role="img" aria-label="땅볼 아웃 ${A.go}, 뜬공 아웃 ${A.fo}">
          ${A.go ? `<i class="go" style="flex:${A.go}">땅볼 ${A.go}</i>` : ''}${A.fo ? `<i class="fo" style="flex:${A.fo}">뜬공 ${A.fo}</i>` : ''}
        </div>
        <small class="sc-gofo-note">${goP >= 0.6 ? '땅볼이 많은 타자' : goP <= 0.4 ? '뜬공이 많은 타자' : '땅볼·뜬공 비슷'}${A.gdp ? ` · 병살 ${A.gdp}` : ''}</small>`
        : '<small class="sc-gofo-note">인플레이 아웃 기록이 없어요</small>'}
      </div>
      ${avgFt ? `<div class="sc-batted-row"><span class="sc-bl">안타 평균 비거리</span><b class="sc-ft">${avgFt}ft</b></div>` : ''}
    </div>`;
}

function _recentCard(P) {
  const list = P.abs.slice(-10).reverse();
  const dir = a => (a.deg == null ? '' : window._isPull(a) ? '당김' : window._isOppo(a) ? '밀어' : '센터');
  return `
    <section class="an-card">
      <header class="an-hd"><h3>최근 타석</h3><span class="an-hd-note">최근 ${list.length}타석 · 최신순</span></header>
      <ol class="sc-recent">${list.map(a => {
        const [t, cls] = SHORT[a.res] || [a.res, 'out'];
        const info = [a.inn, dir(a), a.pt, a.zone ? ZONE_SHORT[ZONES.indexOf(a.zone)] || a.zone : '', a.count && a.count.s != null ? `${a.count.b}-${a.count.s}` : ''].filter(Boolean);
        return `<li><i class="r-${cls}">${_esc(t)}</i><span>${info.map(_esc).join(' · ') || '추가 정보 없음'}</span></li>`;
      }).join('')}</ol>
    </section>`;
}

// 이번 경기 투구 기록 (투수 탭 pitchLog, 현재 경기만)
function _pitchLogCard(P) {
  const log = ((window.AS && window.AS.pitchLog) || []).filter(p => p.batter === P.name);
  if (!log.length) return '';
  const HIT_RES = ['안타', '2루타', '3루타', '홈런', '타격됨'];
  const ptCnt = {};
  log.forEach(p => { if (p.pt) ptCnt[p.pt] = (ptCnt[p.pt] || 0) + 1; });
  const mix = Object.entries(ptCnt).sort((a, b) => b[1] - a[1]);
  const top = mix.length ? mix[0][1] : 1;
  const k = log.filter(p => p.result === '삼진').length;
  const hits = log.filter(p => HIT_RES.includes(p.result)).length;
  return `
    <section class="an-card">
      <header class="an-hd"><h3>이번 경기 투구 기록</h3><span class="an-hd-note">투수 탭 기록 · ${log.length}구 · 삼진 ${k} · 피안타 ${hits}</span></header>
      <div class="sc-mix">${mix.map(([pt, n]) => `
        <div class="sc-mix-row"><span>${_esc(pt)}</span><span class="sc-mix-bar"><i style="width:${n / top * 100}%"></i></span><b>${n}<small>${Math.round(n / log.length * 100)}%</small></b></div>`).join('')}
      </div>
    </section>`;
}

// ── 텍스트 리포트 (복사용) ───────────────────────────────────
function _textReport(P, A, plan) {
  const s = P.st;
  const L = [];
  const TAG = { attack: '[공략]', avoid: '[주의]', field: '[수비]' };
  L.push(`■ ${P.name} 공략 리포트 (SprayLab)`);
  L.push(`${[P.num !== '' && P.num != null ? '#' + P.num : '', P.bats === 'L' ? '좌타' : P.bats === 'R' ? '우타' : P.bats === 'S' ? '스위치' : '', `${P.games}경기 ${s.pa}타석`].filter(Boolean).join(' · ')} · 위협도: ${A.threat.l}`);
  L.push(`타율 ${f3(s.avg)} / 출루율 ${f3(s.obp)} / 장타율 ${f3(s.slg)} · 삼진 ${pct(s.kRate)} · 볼넷 ${pct(s.bbRate)}`);
  L.push('');
  L.push('[공략 포인트]');
  if (plan.length) plan.forEach(p => L.push(`${TAG[p.type]} ${p.title} — ${p.why}`));
  else L.push('- 아직 뚜렷한 포인트 없음');
  if (A.zoned) {
    L.push('');
    L.push('[코스별 타율] (몸쪽 | 가운데 | 바깥쪽)');
    ['높음', '중간', '낮음'].forEach((r, i) => {
      L.push(`${r}: ` + A.zones.slice(i * 3, i * 3 + 3).map(z => (z.ab ? `${f3(z.avg)}(${z.h}/${z.ab})` : '—')).join(' | '));
    });
  }
  const cs = A.counts.filter(c => c.st.pa);
  if (cs.length) {
    L.push('');
    L.push('[카운트별 타율]');
    cs.forEach(c => L.push(`${c.l}: ${c.st.ab ? f3(c.st.avg) : '—'} (${c.st.pa}타석, 삼진 ${pct(c.st.kRate)})`));
  }
  if (s.dn) {
    L.push('');
    L.push(`[타구 방향] 당김 ${Math.round(s.pull / s.dn * 100)}% · 센터 ${Math.round(s.center / s.dn * 100)}% · 밀어 ${Math.round(s.oppo / s.dn * 100)}% (${s.dn}타구)`);
  }
  if (s.pa < 10) L.push('', `※ 표본 ${s.pa}타석 — 참고용`);
  return L.join('\n');
}

if (typeof window !== 'undefined') {
  window.openScoutView = openScoutView;
  window.renderScoutPlayerSelect = renderScoutPlayerSelect;
  window.generateScoutReport = generateScoutReport;
  window.setScoutZoneMode = setScoutZoneMode;
  window.exportScoutReport = exportScoutReport;
  window.exportScoutPDF = exportScoutPDF;
}
