// 투수 분석 — 투구 기록(투수 탭 입력)을 타석 단위로 다시 묶어서 제구·구종·코스·투구수·상대 타자를 본다
import { esc as _esc } from '../constants.js';
import { buildData, f3, pct, emptyState, josa } from './batdata.js?v=9';
import { exportPitcherXlsx, xlsxButton } from './xlsxreport.js?v=27';
import { calcPitching, pitchInfo, isStrikePitch, warnLines, prLabel, END_LABEL, HIT_ENDS, UNKNOWN, FIP_C, groupPA, countOf, outsOfPA } from './pitchcalc.js?v=9';

const ZONES = ['내각 높음', '중앙 높음', '외각 높음', '내각 중간', '중앙 중간', '외각 중간', '내각 낮음', '중앙 낮음', '외각 낮음'];
const BUCKETS = [[1, 25], [26, 50], [51, 75], [76, 999]];
const _isDone = x => !!x.end && x.end !== UNKNOWN;

let _mode = 'stats';     // stats | input
let _scope = 'season';   // season | game
let _sel = null;         // 선택 투수 이름
let _zoneView = 'plot';  // plot | hits | count
let _box = null;         // 코스 '위치'에서 드래그(또는 점 탭)로 고른 구역 — viewBox 좌표 { x0, y0, x1, y1 }
let _boxAll = false;     // 선택 카드의 '공 하나씩' 목록 전체 보기
let _plot = null;        // 지금 그려진 위치 차트: { xy: 위치가 있는 공, apps: 등판 목록 }

// ── 진입 ─────────────────────────────────────────────────────
function _mount() {
  const sec = document.getElementById('anaSecPitcher');
  if (!sec) return null;
  let v = document.getElementById('pitcherView');
  if (!v) {
    v = document.createElement('div');
    v.id = 'pitcherView';
    v.className = 'pc';
    sec.insertBefore(v, sec.firstChild);
    // 옛 '투수 통계' 카드는 스트라이크% 계산이 틀려서 숨김 (renderPitcherStats가 계속 써도 무해)
    const old = document.getElementById('pitcherStats');
    const card = old && old.closest('.stat-card');
    if (card) card.classList.add('pc-legacy-stats');
  }
  sec.classList.toggle('pc-input', _mode === 'input');
  return v;
}

export function openPitcherView() {
  if (!_mount()) return;
  _render();
}

export function setPitcherView(k, v) {
  if (k === 'mode') _mode = v === 'input' ? 'input' : 'stats';
  if (k === 'scope') _scope = v === 'game' ? 'game' : 'season';
  if (k === 'sel') _sel = v || null;
  if (k === 'zone') _zoneView = ['plot', 'hits', 'count'].includes(v) ? v : 'plot';
  if (k !== 'mode') { _box = null; _boxAll = false; }   // 다른 투수·범위·보기로 바꾸면 고른 구역은 비운다
  openPitcherView();
}

// ── 데이터 ───────────────────────────────────────────────────
// 투수별 등판 목록: [{ name, num, role, apps: [{ label, d, current, pitches, all }] }] — all = 그 경기 모든 투수의 투구 목록
function _pitchers() {
  const AS = window.AS || {};
  const map = Object.create(null);
  const add = (p, g, pitches, all) => {
    if (!p || !p.name || !pitches.length) return;
    const P = map[p.name] || (map[p.name] = { name: p.name, num: p.num || '', role: p.role || null, apps: [] });
    if (!P.num && p.num) P.num = p.num;
    if (p.role) P.role = p.role;
    P.apps.push({ label: g.label, d: g.d || '', current: !!g.current, opp: g.ta || g.th || '', pitches, all });
  };
  if (_scope === 'game') {
    const all = (AS.pitchers || []).map(q => q.pitches || []);
    (AS.pitchers || []).forEach(p => add(p, { label: '현재 경기', current: true }, p.pitches || [], all));
    // 등판은 했지만 아직 투구가 없는 투수도 선택할 수 있게
    (AS.pitchers || []).forEach(p => { if (p.name && !map[p.name]) map[p.name] = { name: p.name, num: p.num || '', role: p.role || null, apps: [] }; });
  } else {
    buildData().games.forEach(g => {
      const all = (g.pitchers || []).map(q => q.pitches || []);
      (g.pitchers || []).forEach(p => add(p, g, p.pitches || [], all));
    });
  }
  const cur = AS.currentPitcher && AS.currentPitcher.name;
  return Object.values(map).map(P => ({ ...P, n: P.apps.reduce((s, a) => s + a.pitches.length, 0), live: P.name === cur }))
    .sort((a, b) => b.live - a.live || b.n - a.n);
}

// 타석 묶기 · 지표 계산은 pitchcalc.js 하나만 쓴다 (앱 투수 탭 · 분석 엑셀 · 옛 엑셀 내보내기 공통)
const _calc = calcPitching;

// 등판 기록용 짧은 경기 이름: '9. 10. vs 호서대'
const _short = a => (a.current ? '현재 경기' : [String(a.d || '').replace(/^\d{4}\.\s*/, ''), a.opp ? 'vs ' + a.opp : ''].filter(Boolean).join(' ') || a.label);
const ipTxt = outs => `${Math.floor(outs / 3)}${outs % 3 ? ` ${outs % 3}/3` : ''}`;
const num2 = v => (v == null ? '—' : v.toFixed(2));

// ── 렌더 ─────────────────────────────────────────────────────
function _render() {
  const v = document.getElementById('pitcherView');
  if (!v) return;
  const seg = (k, cur, opts) => `<div class="an-seg" role="tablist">${opts.map(([val, l]) => `<button role="tab" class="${cur === val ? 'on' : ''}" aria-selected="${cur === val}" onclick="setPitcherView('${k}','${val}')">${l}</button>`).join('')}</div>`;
  const head = `
    <div class="savant-view-header">
      <div class="svh-title">투수</div>
      <div class="svh-sub">투구 기록으로 보는 제구 · 구종 · 코스 · 체력</div>
    </div>
    <div class="pc-mode">${seg('mode', _mode, [['stats', '분석'], ['input', '투구 기록']])}</div>`;

  _plot = null;   // 위치 차트를 그리면 _zoneCard가 다시 채운다
  if (_mode === 'input') {
    _autoSelect();
    v.innerHTML = head + _liveCard();
    return;
  }

  const ps = _pitchers();
  if (!ps.find(p => p.name === _sel)) _sel = (ps.find(p => p.n) || ps[0] || {}).name || null;
  const chips = ps.map(p => `
    <button type="button" class="an-chip${p.name === _sel ? ' on' : ''}" role="radio" aria-checked="${p.name === _sel}" data-name="${_esc(p.name)}" onclick="setPitcherView('sel',this.dataset.name)">
      <b>${_esc(p.name)}</b>${p.num ? `<span>#${_esc(p.num)}</span>` : ''}<small>${p.live ? '등판 중 · ' : ''}${p.n}구</small>
    </button>`).join('');

  let body;
  if (!ps.length) {
    body = emptyState(_scope === 'game' ? '이번 경기에 등록된 투수가 없어요' : '아직 투구 기록이 없어요',
      '위의 "투구 기록"에서 투수를 등록하고 공 하나하나의 구종·코스·결과를 기록하면 분석이 나와요.');
  } else {
    const P = ps.find(p => p.name === _sel);
    body = P && P.n ? _stats(P) : emptyState('이 투수의 투구 기록이 아직 없어요', '"투구 기록"에서 투수를 선택하고 공을 기록해 주세요.');
  }
  v.innerHTML = head + `
    <div class="pc-ctrls">${seg('scope', _scope, [['season', '시즌 전체'], ['game', '이번 경기']])}</div>
    ${ps.length ? `<div class="an-pick" role="radiogroup" aria-label="투수 선택">${chips}</div>` : ''}
    <div class="pc-result">${body}</div>`;
  _bindPlot();
}

// 불러온 경기(저장 목록 · 자동저장 복구)는 core.js 가 currentPitcher 를 비워 두어, 투수가 있는데도 "등록하거나 선택하세요" 안내만 보이고
// 투구 기록이 사라진 것처럼 보였다(그래서 다시 등록하면 0구짜리 빈 칸이 늘었다) → 투구 기록 화면을 열 때 마지막으로 공을 던진 투수(없으면 마지막 등록)를 골라 둔다
function _autoSelect() {
  const AS = window.AS || {};
  const ps = AS.pitchers || [];
  if (AS.currentPitcher || !ps.length || typeof window.selectPitcher !== 'function') return;
  const last = p => { const q = p.pitches || []; return q.length ? Number(q[q.length - 1].id) || 0 : 0; };   // 마지막 공의 id(= 기록 시각) · id 가 없는 옛 공은 0
  const thrown = ps.filter(p => (p.pitches || []).length);
  const P = thrown.length ? thrown.reduce((a, b) => (last(b) >= last(a) ? b : a)) : ps[ps.length - 1];
  window.selectPitcher(P.id);   // → renderPitcherStats → (_hookLegacy) 이 화면을 다시 그린다. currentPitcher 가 채워졌으니 다시 들어오지 않는다
}

// 투구 기록 모드: 현재 투수의 이번 경기 요약만 (입력 UI는 기존 패널을 그대로 씀)
function _liveCard() {
  const AS = window.AS || {};
  const P = AS.currentPitcher;
  if (!P) return '<div class="pc-live pc-live-empty">아래에서 투수를 등록하거나 선택하면 투구 기록을 시작할 수 있어요.</div>';
  const S = _calc([{ pitches: P.pitches || [], current: true }]);   // 지금 기록 중인 타석은 '결과 미기록'으로 세지 않는다
  const k = (l, val) => `<div><span>${l}</span><b>${val}</b></div>`;
  return `
    <section class="pc-live">
      <div class="pc-live-who"><small>등판 중</small><b>${P.num ? '#' + _esc(P.num) + ' ' : ''}${_esc(P.name)}</b></div>
      <div class="pc-live-kpis">
        ${k('투구', S.n)}${k('이닝', ipTxt(S.outs))}${k('스트라이크', pct(S.sPct))}${k('삼진', S.k)}${S.hbp ? k('볼넷·사구', `${S.bb}·${S.hbp}`) : k('볼넷', S.bb)}${k('피안타', S.h)}
      </div>
      ${warnLines(S).map(t => `<p class="an-warn">⚠ ${_esc(t)}</p>`).join('')}${_fixBtn(S)}
    </section>`;
}

function _stats(P) {
  const S = _calc(P.apps);
  return `
    ${_hero(P, S)}
    ${_warnCard(S)}
    ${_insights(P, S)}
    <div class="pc-2col">
      ${_mixCard(S)}
      ${_zoneCard(S, P)}
    </div>
    <div class="pc-2col">
      ${_countCard(S)}
      ${_bucketCard(P)}
    </div>
    ${_battersCard(S)}
    ${_scope === 'season' ? _appsCard(P) : ''}
    ${xlsxButton('exportPitcherExcel', `${_scope === 'game' ? '이번 경기' : '시즌 전체'} 투구 · 구종별 투구 위치 · 코스 분포 · 타구 허용 · 원본 기록`)}
  `;
}

// 결과 미기록 · 카운트 이상 경고 — 분석 엑셀 리포트에도 같은 문구(warnLines)가 들어간다
function _warnCard(S) {
  const w = warnLines(S);
  if (!w.length) return '';
  return `
    <section class="an-card an-insight pc-warn" role="alert">
      ${w.map(t => `<p class="an-warn">⚠ ${_esc(t)}</p>`).join('')}${_fixBtn(S)}
    </section>`;
}
// 결과 미기록 타석 채우기 (core.js openPitchFix — 이번 경기 + 저장된 경기)
const _fixBtn = S => (S.unrec.length ? `<button type="button" class="pc-fix-btn" onclick="openPitchFix()">결과 미기록 타석 채우기 ›</button>` : '');

function _hero(P, S) {
  const ROLE = { __proto__: null, SP: '선발', RP: '계투', CP: '마무리' };
  const meta = [P.num ? '#' + _esc(P.num) : '', P.role ? _esc(ROLE[P.role] || P.role) : '', `${P.apps.length}경기`, `${S.n}구`, `상대 ${S.pa}타석`].filter(Boolean).join(' · ');
  const kpi = (l, val, sub, tip) => `<div class="pc-kpi"${tip ? ` title="${tip}"` : ''}><span>${l}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `
    <section class="pc-hero">
      <div class="pc-id">
        <div class="pc-eyebrow">${_scope === 'game' ? '이번 경기' : '시즌'} 투구 분석</div>
        <div class="pc-name">${_esc(P.name)}${P.live ? '<span class="pc-live-tag">등판 중</span>' : ''}</div>
        <div class="pc-meta">${meta}</div>
      </div>
      <div class="pc-ip"><b>${ipTxt(S.outs)}</b><small>이닝</small></div>
      <div class="pc-kpis">
        ${kpi('스트라이크%', pct(S.sPct), `${S.strikes}/${S.n}구`, '볼·볼넷·사구를 뺀 모든 공 (파울·인플레이 포함)')}
        ${kpi('초구 S%', pct(S.fsPct), '', '타자에게 던진 첫 공이 스트라이크(파울·인플레이 포함)인 비율')}
        ${kpi('삼진%', pct(S.kRate), `${S.k}개`)}
        ${kpi('볼넷%', pct(S.bbRate), `${S.bb}개${S.hbp ? ` · 사구 ${S.hbp}` : ''}`)}
        ${kpi('피안타율', S.ab ? f3(S.avg) : '—', `${S.h}/${S.ab}`)}
        ${kpi('WHIP', num2(S.whip), '', '이닝당 볼넷+피안타')}
        ${kpi('FIP', num2(S.fip), 'C=3.10 가정', 'FIP = (13×피홈런 + 3×(볼넷+사구) − 2×삼진) ÷ 이닝 + 상수. 상수는 리그 평균에 맞춰야 하는데 아마추어 리그 값이 없어 3.10으로 가정했어요 (참고용)')}
        ${kpi('타자당 투구', S.ppa ? S.ppa.toFixed(1) : '—', '')}
      </div>
    </section>`;
}

// ── 구종 구성 ────────────────────────────────────────────────
function _byPitch(S) {
  const by = Object.create(null);
  S.pitches.forEach(p => {
    const k = p.pt || '미기록';
    const o = by[k] || (by[k] = { pt: k, n: 0, s: 0, h: 0, k: 0, bip: 0, bb: 0 });
    o.n++;
    const i = pitchInfo(p);
    if (i.strike) o.s++;
    if (i.hit) o.h++;
    if (i.k) o.k++;
    if (i.bb) o.bb++;
    if (i.inPlay) o.bip++;
  });
  return Object.values(by).sort((a, b) => b.n - a.n);
}

function _mixCard(S) {
  const rows = _byPitch(S);
  const top = Math.max(...rows.map(r => r.n));
  return `
    <section class="an-card">
      <header class="an-hd"><h3>구종 구성</h3><span class="an-hd-note">결정 = 그 공으로 끝난 타석</span></header>
      <table class="pc-mix">
        <thead><tr><th scope="col">구종</th><th scope="col">비율</th><th scope="col">S%</th><th scope="col">삼진</th><th scope="col">피안타</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr${r.pt === '미기록' ? ' class="thin"' : ''}>
            <th scope="row">${_esc(r.pt)}</th>
            <td class="pc-mix-use"><span class="pc-bar"><i style="width:${r.n / top * 100}%"></i></span><b>${Math.round(r.n / S.n * 100)}%</b><small>${r.n}</small></td>
            <td>${pct(r.s / r.n)}</td>
            <td>${r.k}</td>
            <td>${r.h}${r.bip ? `<small>/${r.bip}</small>` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="an-hd-note pc-note">피안타 옆 작은 숫자 = 인플레이 타구 수 · 이 표의 S%는 구종별 스트라이크 비율</div>
    </section>`;
}

// ── 코스 ─────────────────────────────────────────────────────
function _cls(p) {
  const i = pitchInfo(p);
  if (i.ball) return 'ball';
  if (i.hit) return 'hit';
  if (i.k) return 'k';
  if (i.inPlay) return 'out';
  return 'strike';
}
// 투구 결과 글자: 공 자체의 결과 + (그 공으로 타석이 끝났으면) 타석 결과
function _resTxt(p) {
  const e = pitchInfo(p).end, r = p.pr || p.result, l = prLabel(p);
  return e && e !== r ? `${l} → ${END_LABEL[e] || e}` : l;
}

function _zoneCard(S, P) {
  const xy = S.pitches.filter(p => p.zoneX != null && p.zoneY != null);
  const zoned = S.pitches.filter(p => ZONES.includes(p.zone));
  const view = _zoneView === 'plot' && !xy.length ? 'count' : _zoneView;
  const seg = `<div class="an-seg" role="tablist">${[['plot', '위치'], ['count', '분포'], ['hits', '피안타']].map(([k, l]) => `<button role="tab" class="${view === k ? 'on' : ''}" aria-selected="${view === k}" onclick="setPitcherView('zone','${k}')">${l}</button>`).join('')}</div>`;
  let body;
  if (!xy.length && !zoned.length) body = '<div class="an-note">코스가 기록된 공이 없어요. 투구 기록에서 코스를 눌러 주세요.</div>';
  else if (view === 'plot') {
    const order = { ball: 0, strike: 1, out: 2, k: 3, hit: 4 };
    _plot = { xy, apps: P.apps };
    const dots = xy.map((p, i) => [p, i]).sort(([a], [b]) => order[_cls(a)] - order[_cls(b)]).map(([p, i]) => {
      const c = _cls(p);
      const x = (p.zoneX * 100).toFixed(1), y = (p.zoneY * 120).toFixed(1);
      const tip = `<title>${_esc(p.pt || '구종 미기록')} · ${_esc(_resTxt(p))}${p.batter ? ' · ' + _esc(p.batter) : ''}</title>`;
      return c === 'hit'
        ? `<path class="pz-${c}" data-i="${i}" d="M${x} ${+y - 3.6}l3.6 3.6-3.6 3.6-3.6-3.6z">${tip}</path>`
        : `<circle class="pz-${c}" data-i="${i}" cx="${x}" cy="${y}" r="${c === 'ball' ? 2.4 : 2.8}">${tip}</circle>`;
    }).join('');
    // 스트라이크존: 기록 캔버스와 같은 비율 (x .22~.78 · y .15~.85)
    const zx = 22, zw = 56, zy = 18, zh = 84;
    body = `
      <div class="pc-plot-ax"><span>← 몸쪽</span><span>바깥쪽 →</span></div>
      <svg class="pc-plot" id="pcPlot" viewBox="0 0 100 120" role="img" aria-label="투구 위치 ${xy.length}구 · 드래그해서 구역 선택">
        <rect class="pz-box" x="${zx}" y="${zy}" width="${zw}" height="${zh}" rx="1"/>
        <path class="pz-grid" d="M${zx + zw / 3} ${zy}v${zh}M${zx + zw * 2 / 3} ${zy}v${zh}M${zx} ${zy + zh / 3}h${zw}M${zx} ${zy + zh * 2 / 3}h${zw}"/>
        <path class="pz-plate" d="M42 114h16l-2 4h-12z"/>
        ${dots}
        <rect class="pz-sel" x="0" y="0" width="0" height="0" style="display:none"/>
      </svg>
      <div class="pc-plot-key"><span><i class="k-strike"></i>스트라이크·파울</span><span><i class="k-ball"></i>볼</span><span><i class="k-out"></i>인플레이 아웃</span><span><i class="k-k"></i>삼진</span><span><i class="k-hit"></i>피안타</span></div>
      <div class="an-hd-note pc-note">포수 쪽에서 본 위치 · 클릭 위치가 기록된 ${xy.length}구</div>
      <div class="pc-pick" id="pcPick" aria-live="polite"></div>`;
  } else {
    const cells = ZONES.map(z => {
      const list = zoned.filter(p => p.zone === z);
      const h = list.filter(p => pitchInfo(p).hit).length;
      return { z, n: list.length, h };
    });
    const maxN = Math.max(1, ...cells.map(c => c.n));
    body = `
      <div class="sc-zone" data-view="${view}">
        <div class="sc-zone-top"><span>몸쪽</span><span>가운데</span><span>바깥쪽</span></div>
        <div class="sc-zone-side"><span>높음</span><span>중간</span><span>낮음</span></div>
        <div class="sc-zone-grid">${cells.map(c => {
          const a = view === 'count' ? c.n / maxN : c.n ? c.h / c.n : 0;
          const bg = view === 'count' ? `rgba(44,79,138,${(0.08 + a * 0.47).toFixed(2)})` : c.n >= 3 ? `rgba(200,50,43,${(0.08 + a * 0.47).toFixed(2)})` : 'transparent';   // 종이 팔레트 · 잉크 글자 대비 유지
          const main = view === 'count' ? (c.n ? `${Math.round(c.n / zoned.length * 100)}%` : '—') : c.n ? `${c.h}/${c.n}` : '—';
          const sub = view === 'count' ? (c.n ? `${c.n}구` : '') : c.n ? '피안타/투구' : '';
          return `<div class="sc-zc${c.n ? '' : ' thin'}" style="background:${bg}" title="${c.z}: ${c.n}구 · 피안타 ${c.h}" data-n="${c.n}" data-h="${c.h}"><b>${main}</b><small>${sub}</small></div>`;
        }).join('')}</div>
      </div>
      <div class="an-hd-note pc-note">${view === 'count' ? '색이 진할수록 많이 던진 코스' : '색이 진할수록 많이 맞은 코스 · 3구 미만은 색 없음'} · 존 안으로 기록된 ${zoned.length}구</div>`;
  }
  return `
    <section class="an-card">
      <header class="an-hd"><h3>코스</h3>${seg}</header>
      ${body}
    </section>`;
}

// ── 코스 구역 선택 ──────────────────────────────────────────
// 위치 차트를 드래그(또는 점을 탭)하면 그 구역 공들을 어떻게 · 어떤 상황에서 던졌는지 카드로 보여준다
//  · 공 카드: "직구 → 안타" · 던지기 직전 전광판(B · S · O 점 + 주자 그림) · 이 타석 흐름
//  · 4구 이상이면 위에 결과 막대 + 한 줄 요약(구종 · 카운트 · 피안타 · 삼진 · 아웃·주자)
const PICK_N = 5;     // 요약이 있을 때 공 카드 기본 표시 개수
const PICK_SUM = 4;   // 이 개수부터 요약을 보여준다
const _inZone = p => p.zoneX >= 0.22 && p.zoneX <= 0.78 && p.zoneY >= 0.15 && p.zoneY <= 0.85;   // 기록 캔버스의 존 (위 _zoneCard와 같은 비율)
const _inBox = (p, b) => { const x = p.zoneX * 100, y = p.zoneY * 120; return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; };
const _innTxt = v => (v == null || v === '' ? '' : /^\d+$/.test(String(v)) ? `${v}회` : String(v));
// 던지기 직전 아웃·주자 (core.js recordPitch 의 outs · runners — 경기 운영 모드에서만 저장, 아니면 null · 예전 기록엔 없음)
const _outsTxt = p => (p.outs === 0 || p.outs === 1 || p.outs === 2 ? `${p.outs}아웃` : '');
// 공 카드의 던지기 직전 아웃: 경기 운영 모드에서 저장한 값, 없으면 투구 기록으로 센 값(est) — 둘 다 없으면 null
const _outOf = (p, c) => (p.outs === 0 || p.outs === 1 || p.outs === 2 ? { n: p.outs, est: false } : c && c.oc != null ? { n: c.oc, est: true } : null);
const _outLabel = o => (o ? `${o.n}아웃${o.est ? '(투구 기록)' : ''}` : '');
const _runTxt = p => {
  const r = p.runners;
  if (!Array.isArray(r) || r.length !== 3) return '';
  const on = [1, 2, 3].filter((_, i) => r[i]);
  return !on.length ? '주자 없음' : on.length === 3 ? '만루' : on.join('·') + '루';
};

// 공 하나하나의 상황: 몇 번째 등판 · 그 경기 몇 번째 공 · 어느 타석의 몇 구째 · 던지기 직전 카운트
// (타석 묶기 · 카운트는 투구 기록 계산 하나 — pitchcalc.js groupPA · countOf. 옛 기록(v1)도 같은 규칙으로 읽는다)
function _pitchCtx(apps) {
  const m = new Map();
  apps.forEach((a, ai) => {
    // 던지기 직전 아웃(투구 기록 기준): 이 경기 모든 투수의 끝난 타석 가운데 같은 이닝 · 이 공보다 먼저 끝난 것의 아웃 합
    // (투수 탭 O 점 · 3아웃 이닝 넘김과 같은 규칙 — pitchcalc outsOfPA. 도루 실패 · 견제사처럼 타석 밖 아웃은 투구 기록에 없다)
    const done = [];
    (a.all || [a.pitches]).forEach(ps => groupPA(ps).forEach(x => {
      const last = x.pitches[x.pitches.length - 1];
      if (x.end && last && last.inning) done.push({ id: Number(last.id), inn: last.inning, o: outsOfPA(x) });
    }));
    const outsBefore = p => {
      if (!p.inning) return null;
      const o = done.reduce((t, d) => t + (d.inn === p.inning && d.id < Number(p.id) ? d.o : 0), 0);
      return o <= 2 ? o : null;   // 3 이상 = 기록이 어긋났다 — 추정하지 않는다
    };
    let no = 0;
    groupPA(a.pitches).forEach(pa => {
      pa.pitches.forEach((p, k) => {
        const c = countOf(pa.pitches.slice(0, k));
        m.set(p, { a, ai, no: ++no, pa, k, b: Math.min(3, c.b), s: Math.min(2, c.s), oc: outsBefore(p) });
      });
    });
  });
  return m;
}
// 공 카드 · 이 타석 흐름의 결과 글자: 그 공으로 타석이 끝났으면 타석 결과(땅볼 아웃 · 사구 · 볼넷 …), 아니면 공의 정체(볼 · 스트라이크 · 파울)
const _pqTxt = q => { const e = pitchInfo(q).end; return e ? (END_LABEL[e] || e) : (q.pr || q.result); };

// 차트를 다시 그릴 때마다(투구 기록 · 투수 변경) 이벤트를 붙이고, 고른 구역이 있으면 다시 보여준다
function _bindPlot() {
  const svg = document.getElementById('pcPlot');
  if (!svg || !_plot) return;
  let start = null;
  const at = e => {
    const m = svg.getScreenCTM && svg.getScreenCTM();
    if (!m) return null;
    const q = svg.createSVGPoint();
    q.x = e.clientX; q.y = e.clientY;
    const r = q.matrixTransform(m.inverse());
    return [Math.max(0, Math.min(100, r.x)), Math.max(0, Math.min(120, r.y))];
  };
  const boxOf = (a, b) => ({ x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) });
  svg.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    start = at(e);
    if (!start) return;
    e.preventDefault();
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
  });
  svg.addEventListener('pointermove', e => {
    const p = start && at(e);
    if (p) _showBox(boxOf(start, p));
  });
  svg.addEventListener('pointerup', e => {
    if (!start) return;
    const p = at(e) || start, a = start;
    start = null;
    _pickAt(a, p);
  });
  svg.addEventListener('pointercancel', () => { start = null; _applyPick(false); });
  _applyPick(false);
}

// 끌기 시작 a → 뗀 자리 p (그림 좌표). 3D 보기(ana3d.js · <pitch-zone-3d>)도 setPitchPick({ a, b }) 로 여기를 쓴다
function _pickAt(a, p) {
  if (!_plot) return;
  const b = { x0: Math.min(a[0], p[0]), y0: Math.min(a[1], p[1]), x1: Math.max(a[0], p[0]), y1: Math.max(a[1], p[1]) };
  if (b.x1 - b.x0 < 2.5 && b.y1 - b.y0 < 2.5) {   // 탭: 가까운 점 하나 (겹친 점은 같이)
    const near = _plot.xy.map(q => [q, Math.hypot(q.zoneX * 100 - p[0], q.zoneY * 120 - p[1])]).sort((x, y) => x[1] - y[1])[0];
    const cx = near && near[0].zoneX * 100, cy = near && near[0].zoneY * 120;
    _box = near && near[1] <= 6 ? { x0: cx - 4, y0: cy - 4, x1: cx + 4, y1: cy + 4, tap: true } : null;   // 탭은 점을 둘러싼 원으로
  } else _box = b;
  _boxAll = false;
  _applyPick(true);
}

function _showBox(b) {
  const svg = document.getElementById('pcPlot');
  if (!svg || !_plot) return;
  const r = svg.querySelector('.pz-sel');
  if (r) {
    r.style.display = b ? '' : 'none';
    if (b) [['x', b.x0], ['y', b.y0], ['width', b.x1 - b.x0], ['height', b.y1 - b.y0], ['rx', b.tap ? (b.x1 - b.x0) / 2 : 0]].forEach(([k, v]) => r.setAttribute(k, v.toFixed(1)));
  }
  svg.classList.toggle('picking', !!b);
  svg.querySelectorAll('[data-i]').forEach(el => el.classList.toggle('on', !!b && _inBox(_plot.xy[+el.dataset.i], b)));
}

function _applyPick(scroll) {
  const card = document.getElementById('pcPick');
  if (!card || !_plot) return;
  _showBox(_box);
  card.classList.toggle('on', !!_box);
  card.innerHTML = _box
    ? _pickHtml(_plot.xy.filter(p => _inBox(p, _box)))
    : '<p class="pc-pick-hint">차트를 <b>드래그</b>해 구역을 고르거나 <b>점을 누르면</b> 그 공들을 어떻게 · 어떤 상황에서 던졌는지 보여줘요.</p>';
  const hd = card.querySelector('.pc-pick-hd');
  if (scroll && hd && hd.scrollIntoView) hd.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function _pickHtml(sel) {
  const n = sel.length;
  const close = '<button type="button" class="pc-pick-x" onclick="setPitchPick(\'clear\')" aria-label="선택 해제">✕</button>';
  const head = (title, sub) => `<div class="pc-pick-hd"><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${close}</div>`;
  if (!n) return head('고른 공 0개', '이 구역에는 기록된 공이 없어요');
  const ctx = _pitchCtx(_plot.apps);
  const C = p => ctx.get(p) || { a: {}, ai: 0, no: 0, pa: { pitches: [p], end: null }, k: 0, b: 0, s: 0 };
  const zin = sel.filter(_inZone).length, strikes = sel.filter(isStrikePitch).length;
  const sub = n === 1 ? (zin ? '스트라이크존 안' : '스트라이크존 밖')
    : [`존 안 ${zin} · 존 밖 ${n - zin}`, n >= PICK_SUM ? `스트라이크 ${pct(strikes / n)}` : ''].filter(Boolean).join(' · ');
  const list = sel.slice().sort((x, y) => C(y).ai - C(x).ai || C(y).no - C(x).no);   // 최근 경기 · 최근 공부터
  const shown = _boxAll || n < PICK_SUM ? list : list.slice(0, PICK_N);
  const outOf = p => _outOf(p, C(p));
  const foot = [
    sel.some(p => { const o = outOf(p); return o && o.est; }) ? '* 아웃은 경기 운영 모드 기록이 없으면 투구 기록(끝난 타석)으로 셌어요 — 도루 실패 · 견제사처럼 타석 밖에서 나온 아웃은 빠져요.' : '',
    sel.some(p => !outOf(p)) ? '아웃은 이닝이 기록된 공만 셀 수 있어요.' : '',
    sel.some(p => !_runTxt(p)) ? '주자는 경기 운영 모드로 기록한 공만 보여요.' : '',
  ].filter(Boolean);
  return `
    ${head(`고른 공 ${n}개`, sub)}
    ${n >= PICK_SUM ? _pickSummary(sel, C) + '<h4>공 하나씩<small>최근 공부터</small></h4>' : ''}
    <ol class="pc-pcs">${shown.map(p => _pitchCard(p, C(p))).join('')}</ol>
    ${list.length > shown.length ? `<button type="button" class="pc-pick-more" onclick="setPitchPick('all')">나머지 ${list.length - shown.length}구 더 보기</button>` : ''}
    ${foot.length ? `<p class="pc-pick-foot">${foot.join(' ')}</p>` : ''}`;
}

// 결과 막대 + 한 줄 요약 (4구 이상)
function _pickSummary(sel, C) {
  const n = sel.length;
  const by = (list, key) => {
    const m = new Map();
    list.forEach(x => { const k = key(x); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const join = rows => rows.map(([l, v]) => `${_esc(l)} ${v}`).join(' · ');
  const ptOf = p => p.pt || '구종 미기록';
  const RES = [['strike', '스트라이크·파울'], ['ball', '볼'], ['out', '인플레이 아웃'], ['k', '삼진'], ['hit', '피안타']]
    .map(([c, l]) => [c, l, sel.filter(p => _cls(p) === c).length]).filter(r => r[2]);
  const facts = [];
  const mix = by(sel, ptOf);
  facts.push(['구종', mix[0][1] * 2 >= n
    ? `주로 <b>${_esc(mix[0][0])}</b> — ${n}구 중 ${mix[0][1]}구${mix.length > 1 ? ` <small>(${join(mix.slice(1))})</small>` : ''}`
    : `여러 구종 — ${join(mix)}`]);
  const cs = sel.map(C);
  const cnt = [['초구', cs.filter(c => !c.b && !c.s).length], ['2스트라이크', cs.filter(c => c.s === 2).length], ['볼이 많을 때', cs.filter(c => c.b > c.s && c.s < 2).length]]
    .filter(r => r[1]).sort((a, b) => b[1] - a[1]);
  if (cnt.length) facts.push(['카운트', cnt.map(([l, v], i) => (i ? `${l} ${v}구` : `<b>${l}</b> ${v}구`)).join(' · ')]);
  const hits = sel.filter(p => pitchInfo(p).hit), ks = sel.filter(p => pitchInfo(p).k);
  if (hits.length) facts.push(['피안타', `<b>${hits.length}개</b> — ${join(by(hits, ptOf))}`]);
  if (ks.length) facts.push(['삼진', `<b>${ks.length}개</b> — ${join(by(ks, ptOf))}`]);
  const known = sel.filter(p => _outsTxt(p) && _runTxt(p));
  if (known.length) {
    const on = known.filter(p => p.runners.some(Boolean)).length, risp = known.filter(p => p.runners[1] || p.runners[2]).length;
    const o2 = known.filter(p => p.outs === 2).length;
    facts.push(['아웃·주자', `주자 있을 때 <b>${on}구</b>${risp ? ` · 득점권 ${risp}구` : ''}${o2 ? ` · 2아웃 ${o2}구` : ''}${known.length < n ? ` <small>(기록된 ${known.length}구 중)</small>` : ''}`]);
  }
  return `
    <div class="pc-pick-bar" aria-hidden="true">${RES.map(([c, , v]) => `<i class="pq-${c}" style="flex:${v}"></i>`).join('')}</div>
    <div class="pc-pick-lg">${RES.map(([c, l, v]) => `<span><i class="pq-dot pq-${c}"></i>${l}<b>${v}</b></span>`).join('')}</div>
    ${n < 10 ? `<p class="pc-pick-thin">표본 ${n}구 — 경향보다는 공 하나하나를 보는 용도예요.</p>` : ''}
    <dl class="pc-facts">${facts.map(([l, t]) => `<div><dt>${l}</dt><dd>${t}</dd></div>`).join('')}</dl>`;
}

// 공 카드: "직구 → 안타" · 언제(경기 · 이닝 · 타자 몇 구째) · 던지기 직전 전광판 · 이 타석 흐름
function _pitchCard(p, c) {
  const cls = _cls(p);
  const game = _scope === 'season' && c.a.label ? _short(c.a) : '';
  const meta = [_innTxt(p.inning), `${p.batter ? p.batter + ' 타석 ' : ''}${c.k + 1}구째`, c.no ? `경기 ${c.no}구째` : ''].filter(Boolean);
  const flow = c.pa.pitches.length > 1 || !c.pa.end
    ? `<div class="pc-flow"><span class="pc-flow-l">이 타석</span>${c.pa.pitches.map(q => `<span class="pc-flow-p${q === p ? ' cur pq-' + _cls(q) : ''}">${_esc(q.pt || '구종?')} ${_esc(_pqTxt(q))}</span>`).join('<i aria-hidden="true">→</i>')}${c.pa.end ? '' : '<i aria-hidden="true">→</i><span class="pc-flow-p todo">결과 없음</span>'}</div>`
    : '';
  return `
    <li class="pc-pc">
      <div class="pc-pc-hd">
        <i class="pq-dot pq-${cls}" aria-hidden="true"></i><b>${_esc(p.pt || '구종 미기록')}</b><span aria-hidden="true">→</span><em class="pq-${cls}">${_esc(_pqTxt(p))}</em>
        ${game ? `<small>${_esc(game)}</small>` : ''}
      </div>
      <div class="pc-pc-meta">${meta.map(_esc).join(' · ')}</div>
      ${_scoreboard(p, c)}
      ${flow}
    </li>`;
}

// 던지기 직전 전광판 (중계 화면처럼 B · S · O 세로 + 주자 다이아몬드)
// B · S 는 공 순서로 다시 센 값, O 는 경기 운영 모드 기록 · 없으면 투구 기록으로 센 값(O*), 주자는 경기 운영 모드 기록만 (없으면 안 그린다)
function _scoreboard(p, c) {
  const dots = (n, max) => Array.from({ length: max }, (_, i) => `<i class="sbdot${i < n ? ' on' : ''}"></i>`).join('');
  const o = _outOf(p, c), outs = _outLabel(o), run = _runTxt(p);
  const label = `던지기 직전 ${[`${c.b}볼 ${c.s}스트라이크`, outs, run].filter(Boolean).join(' · ')}`;
  const base = (x, y, on) => `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" transform="rotate(45 ${x} ${y})"${on ? ' class="on"' : ''}/>`;
  return `
    <div class="pc-sb" role="img" aria-label="${_esc(label)}" title="${_esc(label)}">
      <span class="sb-cap">던지기 직전</span>
      <div class="sb-bso">
        <span class="sb-b"><b>B</b>${dots(c.b, 3)}</span>
        <span class="sb-s"><b>S</b>${dots(c.s, 2)}</span>
        ${o ? `<span class="sb-o"${o.est ? ' title="투구 기록(끝난 타석)으로 센 아웃"' : ''}><b>O${o.est ? '*' : ''}</b>${dots(o.n, 2)}</span>` : ''}
      </div>
      ${run ? `<div class="sb-r"><svg class="pc-dia" viewBox="0 0 38 26" aria-hidden="true">${base(30, 15, p.runners[0])}${base(19, 7, p.runners[1])}${base(8, 15, p.runners[2])}</svg><small>${_esc(run)}</small></div>` : ''}
    </div>`;
}

export function setPitchPick(cmd) {
  if (cmd && cmd.a && cmd.b) { _pickAt(cmd.a, cmd.b); return; }
  if (cmd === 'clear') _box = null;
  if (cmd === 'all') _boxAll = true;
  _applyPick(false);
}

// ── 카운트 운영 · 투구수 구간 ────────────────────────────────
function _countCard(S) {
  const k2 = S.twoS.filter(_isDone);
  const kConv = k2.length ? k2.filter(x => x.end === '삼진').length / k2.length : 0;
  const row = (l, d, v, sub) => `<div class="pc-cnt"><div><b>${l}</b><small>${d}</small></div><strong>${v}</strong><em>${sub}</em></div>`;
  return `
    <section class="an-card">
      <header class="an-hd"><h3>카운트 운영</h3><span class="an-hd-note">공 순서로 볼·스트라이크를 다시 셈</span></header>
      <div class="pc-cnts">
        ${row('초구 스트라이크', '첫 공이 스트라이크', pct(S.fsPct), `${S.pas.filter(x => x.pitches.length && isStrikePitch(x.pitches[0])).length}/${S.pas.length}타석`)}
        ${row('3볼까지 간 타자', '볼 카운트가 몰림', pct(S.r3b), `${S.pas.filter(x => x.reached3B).length}/${S.pas.length}타석`)}
        ${row('2스트라이크 → 삼진', '2S를 잡은 뒤 삼진으로 끝낸 비율', k2.length ? pct(kConv) : '—', `${k2.filter(x => x.end === '삼진').length}/${k2.length}타석`)}
        ${row('타자당 투구 수', '결과가 난 타석 기준', S.ppa ? S.ppa.toFixed(1) : '—', `${S.pa}타석`)}
      </div>
    </section>`;
}

function _bucketCard(P) {
  const rows = BUCKETS.map(([a, b]) => {
    const pitches = P.apps.flatMap(ap => ap.pitches.filter((_, i) => i + 1 >= a && i + 1 <= b));
    const s = pitches.filter(isStrikePitch).length;
    return {
      l: b > 900 ? `${a}구~` : `${a}~${b}구`, n: pitches.length,
      s: pitches.length ? s / pitches.length : 0,
      h: pitches.filter(p => pitchInfo(p).hit).length,
      k: pitches.filter(p => pitchInfo(p).k).length,
      bb: pitches.filter(p => pitchInfo(p).bb).length,
    };
  }).filter(r => r.n);
  return `
    <section class="an-card">
      <header class="an-hd"><h3>투구 수 구간별</h3><span class="an-hd-note">한 경기 안에서 몇 번째 공인지 기준</span></header>
      <table class="pf-split">
        <thead><tr><th scope="col">구간</th><th scope="col">투구</th><th scope="col">S%</th><th scope="col">피안타</th><th scope="col">삼진</th><th scope="col">볼넷</th></tr></thead>
        <tbody>${rows.map(r => `<tr${r.n < 15 ? ' class="pf-split-none"' : ''}><th scope="row">${r.l}</th><td>${r.n}</td><td><b>${pct(r.s)}</b></td><td>${r.h}</td><td>${r.k}</td><td>${r.bb}</td></tr>`).join('')}</tbody>
      </table>
      <div class="an-hd-note pc-note">흐린 줄은 15구 미만 — 경기 후반 제구가 떨어지는지 보는 용도</div>
    </section>`;
}

// ── 상대 타자 ────────────────────────────────────────────────
function _battersCard(S) {
  const by = Object.create(null);
  S.done.forEach(x => {
    const k = x.batter || '타자 미기록';
    (by[k] = by[k] || []).push(x);
  });
  const cls = e => (e === '안타' || e === '내야안타' ? '1b' : e === '2루타' || e === '3루타' ? 'xbh' : e === '홈런' ? 'hr' : e === '볼넷' || e === '사구' ? 'bb' : e === '삼진' ? 'k' : 'out');
  const rows = Object.entries(by).map(([name, list]) => ({
    name, list,
    h: list.filter(x => HIT_ENDS.includes(x.end)).length,
    k: list.filter(x => x.end === '삼진').length,
    bb: list.filter(x => x.end === '볼넷').length,
    hbp: list.filter(x => x.end === '사구').length,
  })).sort((a, b) => b.list.length - a.list.length || b.h - a.h).slice(0, 10);
  if (!rows.length) return '';
  return `
    <section class="an-card">
      <header class="an-hd"><h3>상대 타자</h3><span class="an-hd-note">많이 상대한 순 · 최대 10명</span></header>
      <ol class="pc-bat">${rows.map(r => `
        <li>
          <div class="pc-bat-who"><b>${_esc(r.name)}</b><small>${r.list.length}타석 · 피안타 ${r.h} · 삼진 ${r.k}${r.bb ? ` · 볼넷 ${r.bb}` : ''}${r.hbp ? ` · 사구 ${r.hbp}` : ''}</small></div>
          <div class="pc-bat-res">${r.list.slice(-8).map(x => `<i class="r-${cls(x.end)}">${_esc(END_LABEL[x.end] || x.end)}${x.nk ? '(낫아웃)' : ''}</i>`).join('')}</div>
        </li>`).join('')}
      </ol>
    </section>`;
}

// ── 등판 기록 ────────────────────────────────────────────────
function _appsCard(P) {
  const apps = P.apps.slice().reverse();
  return `
    <section class="an-card">
      <header class="an-hd"><h3>등판 기록</h3><span class="an-hd-note">최근 경기부터</span></header>
      <div class="pc-apps-wrap">
        <table class="pc-apps">
          <thead><tr><th scope="col">경기</th><th scope="col">이닝</th><th scope="col">투구</th><th scope="col">S%</th><th scope="col">피안타</th><th scope="col">삼진</th><th scope="col">볼넷</th><th scope="col">사구</th></tr></thead>
          <tbody>${apps.map(a => { const c = _calc([a]); return `
            <tr><th scope="row">${a.current ? '<span class="pf-live">현재</span>' : ''}${_esc(_short(a))}</th><td>${ipTxt(c.outs)}</td><td>${c.n}</td><td>${pct(c.sPct)}</td><td>${c.h}</td><td>${c.k}</td><td>${c.bb}</td><td>${c.hbp}</td></tr>`; }).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}

// ── 분석 요약 ────────────────────────────────────────────────
function _insights(P, S) {
  const out = [];
  if (S.n >= 20) {
    const tone = S.sPct >= 0.62 ? '<b>제구가 안정적</b>이에요' : S.sPct < 0.55 ? '<b>볼이 많은 편</b>이에요' : '제구는 보통 수준이에요';
    out.push(`스트라이크 ${pct(S.sPct)}, 초구 스트라이크 ${pct(S.fsPct)} — ${tone}.`);
  }
  if (S.pas.length >= 8 && S.r3b >= 0.25) out.push(`타자 <b>${Math.round(S.r3b * 100)}%</b>에게 3볼까지 몰렸어요 — 초반 카운트 싸움이 과제예요.`);
  const k2 = S.twoS.filter(_isDone);
  if (k2.length >= 5) {
    const conv = k2.filter(x => x.end === '삼진').length / k2.length;
    out.push(`2스트라이크를 잡은 타석의 <b>${Math.round(conv * 100)}%</b>를 삼진으로 끝냈어요 (${k2.length}타석).`);
  }
  const mix = _byPitch(S).filter(r => r.pt !== '미기록');
  const kPitch = mix.slice().sort((a, b) => b.k - a.k)[0];
  if (kPitch && kPitch.k >= 2) out.push(`결정구는 <b>${_esc(kPitch.pt)}</b> — 삼진 ${kPitch.k}개 중 ${Math.round(kPitch.k / Math.max(1, S.k) * 100)}%.`);
  const hitPitch = mix.filter(r => r.bip >= 3).sort((a, b) => b.h / b.bip - a.h / a.bip)[0];
  if (hitPitch && hitPitch.h / hitPitch.bip >= 0.4) out.push(`<b>${_esc(hitPitch.pt)}</b>${josa(hitPitch.pt, '은', '는')} 맞으면 안타가 되는 비율이 높아요 (인플레이 ${hitPitch.bip}개 중 안타 ${hitPitch.h}).`);
  // 투구 수에 따른 제구 변화
  const early = P.apps.flatMap(a => a.pitches.slice(0, 25)), late = P.apps.flatMap(a => a.pitches.slice(50));
  if (early.length >= 15 && late.length >= 15) {
    const sp = l => l.filter(isStrikePitch).length / l.length;
    const d = sp(late) - sp(early);
    if (d <= -0.1) out.push(`50구 이후 스트라이크%가 <b>${Math.round(-d * 100)}%p 떨어져요</b> (${pct(sp(early))} → ${pct(sp(late))}) — 교체 타이밍 참고.`);
    else if (Math.abs(d) < 0.05) out.push(`50구가 넘어도 제구가 유지돼요 (${pct(sp(early))} → ${pct(sp(late))}).`);
  }
  const warn = S.pa < 15 ? `<p class="an-warn">⚠ 상대 ${S.pa}타석 · ${S.n}구 기록 — 표본이 적어서 참고용이에요.</p>` : '';
  if (!out.length && !warn) return '';
  return `
    <section class="an-card an-insight">
      <header class="an-hd"><h3>분석 요약</h3></header>
      ${out.length ? `<ul>${out.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
      ${warn}
    </section>`;
}

// 분석 엑셀 (차트 포함) — 화면에 보이는 범위(시즌 전체 / 이번 경기) 그대로
export function exportPitcherExcel() {
  const P = _pitchers().find(p => p.name === _sel);
  if (P) exportPitcherXlsx(P, _calc(P.apps), _calc);
}

// 투구를 기록하거나 투수를 고르면 core.js가 renderPitcherStats를 부른다 → 투수 탭이 열려 있으면 새 화면도 갱신
function _hookLegacy() {
  const orig = window.renderPitcherStats;
  if (typeof orig !== 'function' || orig._pc) return;
  const wrapped = function () {
    try { orig.apply(this, arguments); } catch (e) {}
    if (document.querySelector('#anaBody .ana-sec.on[data-sub="pitcher"]')) openPitcherView();
  };
  wrapped._pc = true;
  window.renderPitcherStats = wrapped;
}

if (typeof window !== 'undefined') {
  _hookLegacy();
  window.openPitcherView = openPitcherView;
  window.setPitcherView = setPitcherView;
  window.exportPitcherExcel = exportPitcherExcel;
  window.setPitchPick = setPitchPick;
}
