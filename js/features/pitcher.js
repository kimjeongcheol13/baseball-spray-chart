// 투수 분석 — 투구 기록(투수 탭 입력)을 타석 단위로 다시 묶어서 제구·구종·코스·투구수·상대 타자를 본다
import { esc as _esc } from '../constants.js';
import { buildData, f3, pct, emptyState, josa } from './batdata.js?v=4';
import { exportPitcherXlsx, xlsxButton } from './xlsxreport.js?v=2';

const HIT = ['안타', '2루타', '3루타', '홈런', '타격됨'];
const TB = { '안타': 1, '타격됨': 1, '2루타': 2, '3루타': 3, '홈런': 4 };
const OUTS = { '삼진': 1, '아웃': 1, '병살': 2, '삼중살': 3 };
const BALL = ['볼', '볼넷'];
const END = [...HIT, '삼진', '아웃', '병살', '삼중살', '볼넷'];   // 타석이 끝나는 결과
const ZONES = ['내각 높음', '중앙 높음', '외각 높음', '내각 중간', '중앙 중간', '외각 중간', '내각 낮음', '중앙 낮음', '외각 낮음'];
const FIP_C = 3.10;   // FIP 상수 — 리그 평균에 맞춰야 하지만 아마추어 리그 값이 없어 MLB 수준 값으로 가정
const BUCKETS = [[1, 25], [26, 50], [51, 75], [76, 999]];

let _mode = 'stats';     // stats | input
let _scope = 'season';   // season | game
let _sel = null;         // 선택 투수 이름
let _zoneView = 'plot';  // plot | hits | count

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
  openPitcherView();
}

// ── 데이터 ───────────────────────────────────────────────────
// 투수별 등판 목록: [{ name, num, role, apps: [{ label, d, current, pitches }] }]
function _pitchers() {
  const AS = window.AS || {};
  const map = {};
  const add = (p, g, pitches) => {
    if (!p || !p.name || !pitches.length) return;
    const P = map[p.name] || (map[p.name] = { name: p.name, num: p.num || '', role: p.role || null, apps: [] });
    if (!P.num && p.num) P.num = p.num;
    if (p.role) P.role = p.role;
    P.apps.push({ label: g.label, d: g.d || '', current: !!g.current, opp: g.ta || g.th || '', pitches });
  };
  if (_scope === 'game') {
    (AS.pitchers || []).forEach(p => add(p, { label: '현재 경기', current: true }, p.pitches || []));
    // 등판은 했지만 아직 투구가 없는 투수도 선택할 수 있게
    (AS.pitchers || []).forEach(p => { if (p.name && !map[p.name]) map[p.name] = { name: p.name, num: p.num || '', role: p.role || null, apps: [] }; });
  } else {
    buildData().games.forEach(g => (g.pitchers || []).forEach(p => add(p, g, p.pitches || [])));
  }
  const cur = AS.currentPitcher && AS.currentPitcher.name;
  return Object.values(map).map(P => ({ ...P, n: P.apps.reduce((s, a) => s + a.pitches.length, 0), live: P.name === cur }))
    .sort((a, b) => b.live - a.live || b.n - a.n);
}

// 등판 한 번의 투구 순서를 타석 단위로 묶는다 (볼·스트라이크 카운트를 따라가며)
function _plateAppearances(pitches) {
  const out = [];
  let cur = null;
  const open = batter => { cur = { batter, pitches: [], b: 0, s: 0, reached3B: false, reached2S: false, result: null }; };
  pitches.forEach(p => {
    if (cur && p.batter && cur.batter && p.batter !== cur.batter) { out.push(cur); cur = null; }  // 결과 없이 타자가 바뀜
    if (!cur) open(p.batter || null);
    cur.pitches.push(p);
    if (END.includes(p.result)) {
      cur.result = p.result;
      if (cur.s >= 2) cur.reached2S = true;
      out.push(cur);
      cur = null;
      return;
    }
    if (p.result === '볼') cur.b = Math.min(3, cur.b + 1);
    else if (p.result === '스트라이크' || (p.result === '파울' && cur.s < 2)) cur.s = Math.min(2, cur.s + 1);
    if (cur.b >= 3) cur.reached3B = true;
    if (cur.s >= 2) cur.reached2S = true;
  });
  if (cur) out.push(cur);
  return out;
}

function _calc(apps) {
  const pitches = apps.flatMap(a => a.pitches);
  const pas = apps.flatMap(a => _plateAppearances(a.pitches));
  const done = pas.filter(x => x.result);
  const n = pitches.length;
  const strikes = pitches.filter(p => !BALL.includes(p.result)).length;
  const r = res => done.filter(x => x.result === res).length;
  const h = done.filter(x => HIT.includes(x.result)).length;
  const hr = r('홈런'), k = r('삼진'), bb = r('볼넷');
  const outs = done.reduce((s, x) => s + (OUTS[x.result] || 0), 0);
  const ab = done.length - bb;
  const tb = done.reduce((s, x) => s + (TB[x.result] || 0), 0);
  const ip = outs / 3;
  const first = pas.filter(x => x.pitches.length);
  return {
    n, strikes, pa: done.length, h, hr, k, bb, outs, ab, tb,
    sPct: n ? strikes / n : 0,
    fsPct: first.length ? first.filter(x => !BALL.includes(x.pitches[0].result)).length / first.length : 0,
    kRate: done.length ? k / done.length : 0,
    bbRate: done.length ? bb / done.length : 0,
    avg: ab ? h / ab : 0,
    slg: ab ? tb / ab : 0,
    whip: ip ? (bb + h) / ip : null,
    fip: ip >= 1 ? (13 * hr + 3 * bb - 2 * k) / ip + FIP_C : null,
    ppa: done.length ? done.reduce((s, x) => s + x.pitches.length, 0) / done.length : 0,
    r3b: pas.length ? pas.filter(x => x.reached3B).length / pas.length : 0,
    twoS: pas.filter(x => x.reached2S),
    pas, done, pitches,
  };
}

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

  if (_mode === 'input') {
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
}

// 투구 기록 모드: 현재 투수의 이번 경기 요약만 (입력 UI는 기존 패널을 그대로 씀)
function _liveCard() {
  const AS = window.AS || {};
  const P = AS.currentPitcher;
  if (!P) return '<div class="pc-live pc-live-empty">아래에서 투수를 등록하거나 선택하면 투구 기록을 시작할 수 있어요.</div>';
  const S = _calc([{ pitches: P.pitches || [] }]);
  const k = (l, val) => `<div><span>${l}</span><b>${val}</b></div>`;
  return `
    <section class="pc-live">
      <div class="pc-live-who"><small>등판 중</small><b>${P.num ? '#' + _esc(P.num) + ' ' : ''}${_esc(P.name)}</b></div>
      <div class="pc-live-kpis">
        ${k('투구', S.n)}${k('이닝', ipTxt(S.outs))}${k('스트라이크', pct(S.sPct))}${k('삼진', S.k)}${k('볼넷', S.bb)}${k('피안타', S.h)}
      </div>
    </section>`;
}

function _stats(P) {
  const S = _calc(P.apps);
  return `
    ${_hero(P, S)}
    ${_insights(P, S)}
    <div class="pc-2col">
      ${_mixCard(S)}
      ${_zoneCard(S)}
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

function _hero(P, S) {
  const ROLE = { SP: '선발', RP: '계투', CP: '마무리' };
  const meta = [P.num ? '#' + _esc(P.num) : '', P.role ? ROLE[P.role] || P.role : '', `${P.apps.length}경기`, `${S.n}구`, `상대 ${S.pa}타자`].filter(Boolean).join(' · ');
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
        ${kpi('스트라이크%', pct(S.sPct), `${S.strikes}/${S.n}구`, '볼·볼넷을 뺀 모든 공 (파울·인플레이 포함)')}
        ${kpi('초구 S%', pct(S.fsPct), '', '타자에게 던진 첫 공이 스트라이크(파울·인플레이 포함)인 비율')}
        ${kpi('삼진%', pct(S.kRate), `${S.k}개`)}
        ${kpi('볼넷%', pct(S.bbRate), `${S.bb}개`)}
        ${kpi('피안타율', S.ab ? f3(S.avg) : '—', `${S.h}/${S.ab}`)}
        ${kpi('WHIP', num2(S.whip), '', '이닝당 볼넷+피안타')}
        ${kpi('FIP', num2(S.fip), 'C=3.10 가정', 'FIP = (13×피홈런 + 3×볼넷 − 2×삼진) ÷ 이닝 + 상수. 상수는 리그 평균에 맞춰야 하는데 아마추어 리그 값이 없어 3.10으로 가정했어요 (참고용)')}
        ${kpi('타자당 투구', S.ppa ? S.ppa.toFixed(1) : '—', '')}
      </div>
    </section>`;
}

// ── 구종 구성 ────────────────────────────────────────────────
function _byPitch(S) {
  const by = {};
  S.pitches.forEach(p => {
    const k = p.pt || '미기록';
    const o = by[k] || (by[k] = { pt: k, n: 0, s: 0, h: 0, k: 0, bip: 0, bb: 0 });
    o.n++;
    if (!BALL.includes(p.result)) o.s++;
    if (HIT.includes(p.result)) o.h++;
    if (p.result === '삼진') o.k++;
    if (p.result === '볼넷') o.bb++;
    if (HIT.includes(p.result) || OUTS[p.result] && p.result !== '삼진') o.bip++;
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
function _cls(res) {
  if (BALL.includes(res)) return 'ball';
  if (HIT.includes(res)) return 'hit';
  if (res === '삼진') return 'k';
  if (OUTS[res]) return 'out';
  return 'strike';
}

function _zoneCard(S) {
  const xy = S.pitches.filter(p => p.zoneX != null && p.zoneY != null);
  const zoned = S.pitches.filter(p => ZONES.includes(p.zone));
  const view = _zoneView === 'plot' && !xy.length ? 'count' : _zoneView;
  const seg = `<div class="an-seg" role="tablist">${[['plot', '위치'], ['count', '분포'], ['hits', '피안타']].map(([k, l]) => `<button role="tab" class="${view === k ? 'on' : ''}" aria-selected="${view === k}" onclick="setPitcherView('zone','${k}')">${l}</button>`).join('')}</div>`;
  let body;
  if (!xy.length && !zoned.length) body = '<div class="an-note">코스가 기록된 공이 없어요. 투구 기록에서 코스를 눌러 주세요.</div>';
  else if (view === 'plot') {
    const order = { ball: 0, strike: 1, out: 2, k: 3, hit: 4 };
    const dots = xy.slice().sort((a, b) => order[_cls(a.result)] - order[_cls(b.result)]).map(p => {
      const c = _cls(p.result);
      const x = (p.zoneX * 100).toFixed(1), y = (p.zoneY * 120).toFixed(1);
      const tip = `<title>${_esc(p.pt || '구종 미기록')} · ${_esc(p.result)}${p.batter ? ' · ' + _esc(p.batter) : ''}</title>`;
      return c === 'hit'
        ? `<path class="pz-${c}" d="M${x} ${+y - 3.6}l3.6 3.6-3.6 3.6-3.6-3.6z">${tip}</path>`
        : `<circle class="pz-${c}" cx="${x}" cy="${y}" r="${c === 'ball' ? 2.4 : 2.8}">${tip}</circle>`;
    }).join('');
    // 스트라이크존: 기록 캔버스와 같은 비율 (x .22~.78 · y .15~.85)
    const zx = 22, zw = 56, zy = 18, zh = 84;
    body = `
      <div class="pc-plot-ax"><span>← 몸쪽</span><span>바깥쪽 →</span></div>
      <svg class="pc-plot" viewBox="0 0 100 120" role="img" aria-label="투구 위치 ${xy.length}구">
        <rect class="pz-box" x="${zx}" y="${zy}" width="${zw}" height="${zh}" rx="1"/>
        <path class="pz-grid" d="M${zx + zw / 3} ${zy}v${zh}M${zx + zw * 2 / 3} ${zy}v${zh}M${zx} ${zy + zh / 3}h${zw}M${zx} ${zy + zh * 2 / 3}h${zw}"/>
        <path class="pz-plate" d="M42 114h16l-2 4h-12z"/>
        ${dots}
      </svg>
      <div class="pc-plot-key"><span><i class="k-strike"></i>스트라이크·파울</span><span><i class="k-ball"></i>볼</span><span><i class="k-out"></i>인플레이 아웃</span><span><i class="k-k"></i>삼진</span><span><i class="k-hit"></i>피안타</span></div>
      <div class="an-hd-note pc-note">포수 쪽에서 본 위치 · 클릭 위치가 기록된 ${xy.length}구</div>`;
  } else {
    const cells = ZONES.map(z => {
      const list = zoned.filter(p => p.zone === z);
      const h = list.filter(p => HIT.includes(p.result)).length;
      return { z, n: list.length, h };
    });
    const maxN = Math.max(1, ...cells.map(c => c.n));
    body = `
      <div class="sc-zone">
        <div class="sc-zone-top"><span>몸쪽</span><span>가운데</span><span>바깥쪽</span></div>
        <div class="sc-zone-side"><span>높음</span><span>중간</span><span>낮음</span></div>
        <div class="sc-zone-grid">${cells.map(c => {
          const a = view === 'count' ? c.n / maxN : c.n ? c.h / c.n : 0;
          const bg = view === 'count' ? `rgba(44,79,138,${(0.08 + a * 0.47).toFixed(2)})` : c.n >= 3 ? `rgba(200,50,43,${(0.08 + a * 0.47).toFixed(2)})` : 'transparent';   // 종이 팔레트 · 잉크 글자 대비 유지
          const main = view === 'count' ? (c.n ? `${Math.round(c.n / zoned.length * 100)}%` : '—') : c.n ? `${c.h}/${c.n}` : '—';
          const sub = view === 'count' ? (c.n ? `${c.n}구` : '') : c.n ? '피안타/투구' : '';
          return `<div class="sc-zc${c.n ? '' : ' thin'}" style="background:${bg}" title="${c.z}: ${c.n}구 · 피안타 ${c.h}"><b>${main}</b><small>${sub}</small></div>`;
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

// ── 카운트 운영 · 투구수 구간 ────────────────────────────────
function _countCard(S) {
  const k2 = S.twoS.filter(x => x.result);
  const kConv = k2.length ? k2.filter(x => x.result === '삼진').length / k2.length : 0;
  const row = (l, d, v, sub) => `<div class="pc-cnt"><div><b>${l}</b><small>${d}</small></div><strong>${v}</strong><em>${sub}</em></div>`;
  return `
    <section class="an-card">
      <header class="an-hd"><h3>카운트 운영</h3><span class="an-hd-note">공 순서로 볼·스트라이크를 다시 셈</span></header>
      <div class="pc-cnts">
        ${row('초구 스트라이크', '첫 공이 스트라이크', pct(S.fsPct), `${S.pas.filter(x => x.pitches.length && !BALL.includes(x.pitches[0].result)).length}/${S.pas.length}타자`)}
        ${row('3볼까지 간 타자', '볼 카운트가 몰림', pct(S.r3b), `${S.pas.filter(x => x.reached3B).length}/${S.pas.length}타자`)}
        ${row('2스트라이크 → 삼진', '2S를 잡은 뒤 삼진으로 끝낸 비율', k2.length ? pct(kConv) : '—', `${k2.filter(x => x.result === '삼진').length}/${k2.length}타석`)}
        ${row('타자당 투구 수', '결과가 난 타석 기준', S.ppa ? S.ppa.toFixed(1) : '—', `${S.pa}타석`)}
      </div>
    </section>`;
}

function _bucketCard(P) {
  const rows = BUCKETS.map(([a, b]) => {
    const pitches = P.apps.flatMap(ap => ap.pitches.filter((_, i) => i + 1 >= a && i + 1 <= b));
    const s = pitches.filter(p => !BALL.includes(p.result)).length;
    return {
      l: b > 900 ? `${a}구~` : `${a}~${b}구`, n: pitches.length,
      s: pitches.length ? s / pitches.length : 0,
      h: pitches.filter(p => HIT.includes(p.result)).length,
      k: pitches.filter(p => p.result === '삼진').length,
      bb: pitches.filter(p => p.result === '볼넷').length,
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
  const by = {};
  S.done.forEach(x => {
    const k = x.batter || '타자 미기록';
    (by[k] = by[k] || []).push(x);
  });
  const SH = { '안타': ['안타', '1b'], '타격됨': ['안타', '1b'], '2루타': ['2루타', 'xbh'], '3루타': ['3루타', 'xbh'], '홈런': ['홈런', 'hr'], '볼넷': ['볼넷', 'bb'], '삼진': ['삼진', 'k'], '아웃': ['아웃', 'out'], '병살': ['병살', 'out'], '삼중살': ['삼중살', 'out'] };
  const rows = Object.entries(by).map(([name, list]) => ({
    name, list,
    h: list.filter(x => HIT.includes(x.result)).length,
    k: list.filter(x => x.result === '삼진').length,
    bb: list.filter(x => x.result === '볼넷').length,
  })).sort((a, b) => b.list.length - a.list.length || b.h - a.h).slice(0, 10);
  if (!rows.length) return '';
  return `
    <section class="an-card">
      <header class="an-hd"><h3>상대 타자</h3><span class="an-hd-note">많이 상대한 순 · 최대 10명</span></header>
      <ol class="pc-bat">${rows.map(r => `
        <li>
          <div class="pc-bat-who"><b>${_esc(r.name)}</b><small>${r.list.length}타석 · 피안타 ${r.h} · 삼진 ${r.k}${r.bb ? ` · 볼넷 ${r.bb}` : ''}</small></div>
          <div class="pc-bat-res">${r.list.slice(-8).map(x => { const [t, c] = SH[x.result] || [x.result, 'out']; return `<i class="r-${c}">${_esc(t)}</i>`; }).join('')}</div>
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
          <thead><tr><th scope="col">경기</th><th scope="col">이닝</th><th scope="col">투구</th><th scope="col">S%</th><th scope="col">피안타</th><th scope="col">삼진</th><th scope="col">볼넷</th></tr></thead>
          <tbody>${apps.map(a => { const c = _calc([a]); return `
            <tr><th scope="row">${a.current ? '<span class="pf-live">현재</span>' : ''}${_esc(_short(a))}</th><td>${ipTxt(c.outs)}</td><td>${c.n}</td><td>${pct(c.sPct)}</td><td>${c.h}</td><td>${c.k}</td><td>${c.bb}</td></tr>`; }).join('')}
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
  const k2 = S.twoS.filter(x => x.result);
  if (k2.length >= 5) {
    const conv = k2.filter(x => x.result === '삼진').length / k2.length;
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
    const sp = l => l.filter(p => !BALL.includes(p.result)).length / l.length;
    const d = sp(late) - sp(early);
    if (d <= -0.1) out.push(`50구 이후 스트라이크%가 <b>${Math.round(-d * 100)}%p 떨어져요</b> (${pct(sp(early))} → ${pct(sp(late))}) — 교체 타이밍 참고.`);
    else if (Math.abs(d) < 0.05) out.push(`50구가 넘어도 제구가 유지돼요 (${pct(sp(early))} → ${pct(sp(late))}).`);
  }
  const warn = S.pa < 15 ? `<p class="an-warn">⚠ 상대 ${S.pa}타자 · ${S.n}구 기록 — 표본이 적어서 참고용이에요.</p>` : '';
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
}
