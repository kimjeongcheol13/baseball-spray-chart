// 타자 — 경기 중 "지금 타석에 선 타자" 브리핑: 오늘 기록 · 시즌/최근 폼 · 오늘 타석별 공 순서 · 본 공 위치 · 공략 메모
//   [시즌 전체]는 예전 프로필 서브탭 내용까지 (분석 서브탭 7→5): 맨 위 리포트 버튼 · 팀 내 위치 · 코스별 핫/콜드 존 ·
//   타석 결과 구성 · 상황별 · 경기별 누적 흐름 · 경기 로그 · 구종별 · 누적 기록 — 카드는 profile.js 함수를 그대로 부른다
//   히어로에 wOBA+ · 유형 태그, 분석 요약(프로필)과 '이런 타자예요'(타자 메모)는 한 카드로
import { HITS, esc as _esc } from '../constants.js';
import { buildData, playerData, calcStats, f3, pct, josa, emptyState, sprayFigure, playerChips, batsBadge } from './batdata.js?v=10';
import { exportBatterXlsx, xlsxButton } from './xlsxreport.js?v=14';
import { profileHeroBits, profileInsights, profileDirTable, profileSeasonHtml, onProfileChange } from './profile.js?v=21';

let _side = null;       // home | away (null = 기록 중인 팀)
let _sel = null;        // 보고 있는 타자 이름
let _pinned = false;    // 사용자가 다른 타자를 골랐으면 true (기록 중 타자를 따라가지 않음)
let _spray = 'today';   // today | season
let _scope = null;      // game | season (null = 라인업이 있으면 이번 경기, 비어 있으면 시즌 전체)
let _plot = 'today';

const SHORT = { __proto__: null,
  '안타': ['안타', '1b'], '내야안타': ['내야안타', '1b'], '2루타': ['2루타', 'xbh'], '3루타': ['3루타', 'xbh'], '홈런': ['홈런', 'hr'],
  '볼넷': ['볼넷', 'bb'], '사구': ['사구', 'bb'], '삼진': ['삼진', 'k'], '희타': ['희타', 'out'], '희비': ['희비', 'out'],
  '땅볼 아웃': ['땅볼', 'out'], '플라이 아웃': ['뜬공', 'out'], '병살': ['병살', 'out'],
};
const PT_SHORT = { __proto__: null, '직구': '직', '슬라이더': '슬', '커브': '커', '체인지업': '체', '포크볼': '포', '커터': '컷', '싱커': '싱', '스플리터': '스플', '스위퍼': '스위' };
const Z_SHORT = z => String(z || '').replace('내각', '몸쪽').replace('외각', '바깥쪽').replace('중앙 중간', '한가운데').replace('중앙', '가운데');

// ── 진입 · 조작 ──────────────────────────────────────────────
function _mount() {
  const sec = document.getElementById('anaSecBatter');
  if (!sec) return null;
  let v = document.getElementById('batterView');
  if (!v) {
    v = document.createElement('div');
    v.id = 'batterView';
    v.className = 'bt';
    sec.insertBefore(v, sec.firstChild);
  }
  return v;
}

export function openBatterView() {
  if (!_mount()) return;
  const live = window.AS && window.AS.batter;
  if (!_pinned && live) { _sel = live.name; _side = window.AS.curTeam || 'home'; }
  _render();
}

export function setBatterView(k, v) {
  const live = window.AS && window.AS.batter;
  if (k === 'sel') { _sel = v || null; _pinned = !live || live.name !== _sel; }
  if (k === 'live') { _pinned = false; }
  if (k === 'side') { _side = v === 'away' ? 'away' : 'home'; _pinned = true; _sel = null; }   // 다른 팀을 보면 기록 중 타자를 따라가지 않음
  if (k === 'scope') { _scope = v === 'season' ? 'season' : 'game'; _spray = _plot = _scope === 'season' ? 'season' : 'today'; }
  if (k === 'spray') _spray = v === 'season' ? 'season' : 'today';
  if (k === 'plot') _plot = v === 'season' ? 'season' : 'today';
  openBatterView();
}

// 다른 분석 탭으로 이 타자를 넘겨서 연다
export function openBatterIn(sub) {
  if (!_sel || !window.shellSub) return;
  if (sub === 'profile' && window.selectProfilePlayer) window.selectProfilePlayer(_sel);
  if (sub === 'scout' && window.generateScoutReport) window.generateScoutReport(_sel);
  window.shellSub(sub);
}

// 타자 분석 엑셀 (차트 포함) — 고른 타자의 시즌 전체 기록 (이번 경기 포함)
export function exportBatterExcel() {
  if (_sel) exportBatterXlsx(playerData(buildData(), _sel));
}

// ── 데이터 ───────────────────────────────────────────────────
function _lineup(side) {
  const AS = window.AS || {};
  return ((side === 'away' ? AS.away_lineup : AS.home_lineup) || []).filter(p => p && p.name);
}

function _todayAbs(name) {
  return ((window.AS && window.AS.abs) || []).filter(a => a.bname === name);
}

// ── 렌더 ─────────────────────────────────────────────────────
function _render() {
  const v = document.getElementById('batterView');
  if (!v) return;
  const AS = window.AS || {};
  const side = _side || AS.curTeam || 'home';
  const lineup = _lineup(side);
  const live = AS.batter;
  // 시즌 전체: 저장한 모든 경기 + 이번 경기의 타자 (새 경기로 라인업이 비어도 지난 기록이 보이게)
  const scope = _scope || (lineup.length ? 'game' : 'season');
  const data = buildData();
  const season = data.players.filter(p => p.pa > 0);
  if (scope === 'season') {
    if (!season.find(p => p.name === _sel)) _sel = ((live && season.find(p => p.name === live.name)) || season[0] || {}).name || null;
  } else if (!_sel && lineup.length) _sel = lineup[0].name;

  const seg = (k, cur, opts) => `<div class="an-seg" role="tablist">${opts.map(([val, l]) => `<button role="tab" class="${cur === val ? 'on' : ''}" aria-selected="${cur === val}" onclick="setBatterView('${k}','${val}')">${l}</button>`).join('')}</div>`;
  const chips = lineup.map((p, i) => {
    const t = calcStats(_todayAbs(p.name));
    const isLive = live && live.name === p.name;
    return `
      <button type="button" class="bt-chip${p.name === _sel ? ' on' : ''}${isLive ? ' live' : ''}" role="radio" aria-checked="${p.name === _sel}" data-name="${_esc(p.name)}" onclick="setBatterView('sel',this.dataset.name)">
        <em>${i + 1}</em><b>${_esc(p.name)}</b><small>${t.pa ? `${t.h}-${t.ab}` : '—'}</small>${isLive ? '<i title="타석 중"></i>' : ''}
      </button>`;
  }).join('');

  const head = `
    <div class="savant-view-header">
      <div class="svh-title">타자</div>
      <div class="svh-sub">${scope === 'season' ? '시즌 전체 기록 · 팀 내 위치 · 상황별 성적 · 경기 로그' : '지금 타석에 선 타자 브리핑 · 오늘 기록과 시즌 흐름'}</div>
    </div>
    <div class="bt-ctrls">
      ${seg('scope', scope, [['game', '이번 경기'], ['season', '시즌 전체']])}
      ${scope === 'game' ? seg('side', side, [['home', '홈 라인업'], ['away', '원정 라인업']]) : ''}
      ${_pinned && live ? `<button type="button" class="bt-live-btn" onclick="setBatterView('live')">● 기록 중인 타자(${_esc(live.name)})로</button>` : ''}
    </div>
    ${scope === 'season'
      ? (season.length ? `<div class="an-pick bt-pick" role="radiogroup" aria-label="시즌 타자">${playerChips(season, _sel, 'selectBatterSeason')}</div>` : '')
      : (lineup.length ? `<div class="an-pick bt-pick" role="radiogroup" aria-label="타순">${chips}</div>` : '')}
    ${AS.currentPitcher ? `<button type="button" class="bt-link-pill" onclick="shellOpenAnalysis('pitcher')">⚾ ${_esc(AS.currentPitcher.name)} 투구 기록 중 · ${(AS.currentPitcher.pitches || []).length}구</button>` : ''}`;

  if (scope === 'season' && !season.length) {
    v.innerHTML = head + emptyState('아직 기록된 타자가 없어요', '기록 탭에서 타석 결과를 입력하고 경기를 저장하면 시즌 기록이 쌓여요.');
    return;
  }
  if (!lineup.length && !_sel) {
    v.innerHTML = head + emptyState('이번 경기 라인업이 비어 있어요', '지난 경기 타자는 위의 「시즌 전체」에서 볼 수 있어요. 기록 탭에서 선수를 추가하면 여기서 바로 브리핑이 나와요.');
    return;
  }
  if (!_sel) {
    v.innerHTML = head + emptyState('타자를 선택하세요', '위 타순에서 선수를 누르거나, 기록 탭에서 타자를 선택하세요.');
    return;
  }
  const P = playerData(data, _sel);
  const order = lineup.findIndex(p => p.name === _sel);
  const info = lineup[order] || {};
  const today = _todayAbs(_sel);
  // 시즌 전체에서 오늘 타석이 없는 타자면 타구 방향·본 공 위치도 시즌 기록으로
  if (scope === 'season' && !today.length) { _spray = 'season'; _plot = 'season'; }
  const season_ = scope === 'season';
  v.innerHTML = head + `
    <div class="bt-result">
      ${season_ ? `<div class="pf-report"><button type="button" class="pf-report-btn" data-name="${_esc(P.name)}" onclick="openPlayerReport({ name: this.dataset.name })">🧾 이 선수 리포트 만들기 <small>학부모 공유용 이미지</small></button></div>` : ''}
      ${_hero(P, info, order, today, live, data.pool)}
      ${_formCard(P, today)}
      ${season_ && !today.length ? '' : _todayCard(today)}
      <div class="bt-2col">
        ${_plotCard(P, today)}
        ${_sprayCard(P, today, season_)}
      </div>
      ${_memoCard(P, data)}
      ${season_ && P.st.pa ? profileSeasonHtml(P, data) : ''}
      <div class="bt-links bt-links-1">
        <button type="button" class="tm-act" onclick="openBatterIn('scout')"><span class="tm-act-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg></span><b>스카우트 리포트</b><small>공략 코스 · 구종 · 수비 위치</small></button>
      </div>
      ${P.abs.length ? xlsxButton('exportBatterExcel', '시즌 전체 타석 · 요약 · 타구 차트 · 투구 위치 · 핫/콜드 존 · 원본 기록') : ''}
    </div>`;
}

function _hero(P, info, order, today, live, pool) {
  const t = calcStats(today);
  const s = P.st;
  const X = profileHeroBits(P, pool);   // 예전 프로필 히어로의 wOBA+ · 유형 태그 · 표본 배지
  const isLive = live && live.name === P.name;
  const meta = [order >= 0 ? `${order + 1}번 타자` : '', _esc(info.pos || ''), P.num !== '' && P.num != null ? '#' + _esc(P.num) : '', batsBadge(P.bats)].filter(Boolean).join(' · ');
  const line = t.pa
    ? `${t.ab}타수 ${t.h}안타${t.hr ? ` ${t.hr}홈런` : ''}${t.rbi ? ` ${t.rbi}타점` : ''}${t.bb + t.hbp ? ` ${t.bb + t.hbp}사사구` : ''}${t.k ? ` ${t.k}삼진` : ''}`
    : '오늘 아직 타석 없음';
  return `
    <section class="bt-hero${isLive ? ' is-live' : ''}">
      <div class="bt-id">
        <div class="bt-eyebrow">${isLive ? '<span class="bt-dot"></span>지금 타석' : '타자 브리핑'}</div>
        <div class="bt-name">${_esc(P.name)}</div>
        <div class="bt-meta">${meta}</div>
        ${X.tags.length || X.smp ? `<div class="pf-tags">${X.tags.map(g => `<span class="pf-tag">${g}</span>`).join('')}${X.smp ? `<span class="an-badge ${X.smp.cls}">${X.smp.txt}</span>` : ''}</div>` : ''}
      </div>
      <div class="bt-season">
        <small>시즌 ${s.pa}타석</small>
        <b>${f3(s.avg)}</b>
        <span>${f3(s.obp)} / ${f3(s.slg)}</span>
        ${X.woba != null ? `<em class="bt-wplus" title="내 기록 전체 평균 wOBA를 100으로 둔 값">wOBA ${f3(X.woba)}${X.idx != null ? ` · <b>${X.idx}</b> wOBA+` : ''}</em>` : ''}
      </div>
      <div class="bt-today">
        <small>오늘</small>
        <b>${_esc(line)}</b>
        <div class="bt-today-chips an-rchips">${today.map(a => { const [tx, c] = SHORT[a.res] || [a.res, 'out']; return `<i class="r-${c}" title="${_esc(a.inn || '')}">${_esc(tx)}</i>`; }).join('') || ''}</div>
      </div>
    </section>`;
}

// 오늘 · 최근 3경기 · 시즌 비교
function _formCard(P, today) {
  const games = P.gameList.filter(g => !g.current);
  const recent = calcStats(games.slice(-3).flatMap(g => g.abs));
  const rows = [
    ['오늘', calcStats(today)],
    [`최근 ${Math.min(3, games.length)}경기`, recent],
    ['시즌', P.st],
  ].filter(([, st]) => st.pa);
  let badge = '';
  if (games.length >= 4 && recent.pa >= 6) {
    const d = recent.ops - P.st.ops;
    badge = d >= 0.1 ? '<span class="bt-form up">▲ 상승세</span>' : d <= -0.1 ? '<span class="bt-form down">▼ 하락세</span>' : '<span class="bt-form">— 평소대로</span>';
  }
  return `
    <section class="an-card">
      <header class="an-hd"><h3>흐름 비교</h3>${badge || '<span class="an-hd-note">오늘 · 최근 · 시즌</span>'}</header>
      <table class="bt-form-t">
        <thead><tr><th scope="col"></th><th scope="col">타석</th><th scope="col">타율</th><th scope="col">출루율</th><th scope="col">장타율</th><th scope="col">OPS</th><th scope="col">삼진%</th></tr></thead>
        <tbody>${rows.map(([l, st]) => `
          <tr><th scope="row">${l}</th><td>${st.pa}</td><td><b>${st.ab ? f3(st.avg) : '—'}</b></td><td>${f3(st.obp)}</td><td>${st.ab ? f3(st.slg) : '—'}</td><td>${f3(st.ops)}</td><td>${pct(st.kRate)}</td></tr>`).join('')}
        </tbody>
      </table>
      ${badge ? '<div class="an-hd-note bt-note">상승/하락 = 최근 3경기 OPS가 시즌보다 0.100 이상 높거나 낮을 때</div>' : ''}
    </section>`;
}

// 오늘 타석별: 이닝 · 결과 · 방향 · 공 순서
function _todayCard(today) {
  if (!today.length) return `<section class="an-card"><header class="an-hd"><h3>오늘 타석</h3></header><div class="an-note">오늘 이 타자의 타석이 아직 없어요.</div></section>`;
  const dir = a => (window._pullLbl ? window._pullLbl(a) : '');   // 당김/센터/밀어 · 스위치는 좌/중/우 (core.js hit-dir)
  return `
    <section class="an-card">
      <header class="an-hd"><h3>오늘 타석</h3><span class="an-hd-note">공 칩 = 구종·코스 순서 · 마지막 칩이 결과가 난 공</span></header>
      <ol class="bt-pas">${today.map((a, i) => {
        const [tx, c] = SHORT[a.res] || [a.res, 'out'];
        const ps = a.pitches || [];
        const info = [a.inn, dir(a), a.rbi ? `${a.rbi}타점` : '', a.count && a.count.s != null ? `${a.count.b}-${a.count.s}에서` : ''].filter(Boolean).join(' · ');
        return `
          <li>
            <span class="bt-pa-n">${i + 1}</span>
            <div class="bt-pa-main">
              <div class="bt-pa-top"><i class="r-${c}">${_esc(tx)}</i><small>${_esc(info)}</small></div>
              ${ps.length ? `<div class="bt-seq">${ps.map((p, j) => `<span class="${j === ps.length - 1 ? 'last r-' + c : ''}" title="${j + 1}구 · ${_esc(p.pt || '구종 미기록')} · ${_esc(Z_SHORT(p.zone) || '코스 미기록')}${p.balls != null ? ` · ${_esc(p.balls)}-${_esc(p.strikes)}` : ''}">${_esc(PT_SHORT[p.pt] || (p.pt || '?').slice(0, 2))}<small>${_esc(Z_SHORT(p.zone).replace(' ', ''))}</small></span>`).join('')}</div>` : '<div class="bt-seq-none">투구 기록 없음</div>'}
            </div>
          </li>`;
      }).join('')}</ol>
    </section>`;
}

// 본 공 위치: 기록 탭 존 캔버스와 같은 좌표(0~1, 존 x .22~.78 · y .15~.85)
function _plotCard(P, today) {
  const abs = _plot === 'season' ? P.abs : today;
  const pts = [];
  abs.forEach(a => {
    const ps = (a.pitches || []).filter(p => p.x != null && p.y != null);
    ps.forEach((p, j) => pts.push({ p, a, last: j === ps.length - 1 && ps[ps.length - 1] === a.pitches[a.pitches.length - 1] }));
  });
  const cls = a => (HITS.includes(a.res) ? 'hit' : a.res === '삼진' ? 'k' : a.res === '볼넷' || a.res === '사구' ? 'bb' : 'out');
  const dots = pts.sort((x, y) => x.last - y.last).map(({ p, a, last }) => {
    const x = (p.x * 100).toFixed(1), y = (p.y * 120).toFixed(1);
    const tip = `<title>${_esc(p.pt || '구종 미기록')}${last ? ' · 결과 ' + _esc(a.res) : ''}</title>`;
    if (!last) return `<circle class="bz-seen" cx="${x}" cy="${y}" r="2">${tip}</circle>`;
    const c = cls(a);
    return c === 'hit' ? `<path class="bz-hit" d="M${x} ${+y - 3.8}l3.8 3.8-3.8 3.8-3.8-3.8z">${tip}</path>` : `<circle class="bz-${c}" cx="${x}" cy="${y}" r="3.2">${tip}</circle>`;
  }).join('');
  const seg = `<div class="an-seg" role="tablist">${[['today', '오늘'], ['season', '시즌']].map(([k, l]) => `<button role="tab" class="${_plot === k ? 'on' : ''}" aria-selected="${_plot === k}" onclick="setBatterView('plot','${k}')">${l}</button>`).join('')}</div>`;
  const zx = 22, zw = 56, zy = 18, zh = 84;
  return `
    <section class="an-card">
      <header class="an-hd"><h3>본 공 위치</h3>${seg}</header>
      ${pts.length ? `
      <div class="pc-plot-ax"><span>← 몸쪽</span><span>바깥쪽 →</span></div>
      <svg class="pc-plot" viewBox="0 0 100 120" role="img" aria-label="본 공 ${pts.length}구">
        <rect class="pz-box" x="${zx}" y="${zy}" width="${zw}" height="${zh}" rx="1"/>
        <path class="pz-grid" d="M${zx + zw / 3} ${zy}v${zh}M${zx + zw * 2 / 3} ${zy}v${zh}M${zx} ${zy + zh / 3}h${zw}M${zx} ${zy + zh * 2 / 3}h${zw}"/>
        <path class="pz-plate" d="M42 114h16l-2 4h-12z"/>
        ${dots}
      </svg>
      <div class="pc-plot-key"><span><i class="k-seen"></i>본 공</span><span><i class="k-hit"></i>안타</span><span><i class="k-out"></i>아웃</span><span><i class="k-k"></i>삼진</span><span><i class="k-bb"></i>볼넷·사구</span></div>
      <div class="an-hd-note pc-note">색이 있는 점 = 결과가 난 공 · 포수 쪽에서 본 위치 · ${pts.length}구</div>`
      : `<div class="an-note">${_plot === 'today' ? '오늘' : '시즌'} 코스 위치가 기록된 공이 없어요. 기록 탭에서 구종을 고르고 존을 누르면 쌓여요.</div>`}
    </section>`;
}

function _sprayCard(P, today, seasonView) {
  const abs = _spray === 'season' ? P.abs : today;
  const seg = `<div class="an-seg" role="tablist">${[['today', '오늘'], ['season', '시즌']].map(([k, l]) => `<button role="tab" class="${_spray === k ? 'on' : ''}" aria-selected="${_spray === k}" onclick="setBatterView('spray','${k}')">${l}</button>`).join('')}</div>`;
  return `
    <section class="an-card">
      <header class="an-hd"><h3>타구 방향</h3>${seg}</header>
      <div class="bt-spray">${sprayFigure({ name: P.name, abs, st: calcStats(abs) })}</div>
      ${seasonView && _spray === 'season' ? profileDirTable(P) : ''}
      <div class="an-spray-key">
        <span><i class="k-1b"></i>단타</span><span><i class="k-xbh"></i>2·3루타</span><span><i class="k-hr"></i>홈런</span><span><i class="k-out"></i>아웃</span>
      </div>
    </section>`;
}

// 분석 요약 — 예전 프로필 '분석 요약'(종합 생산성 · 강점/보완 · 최근 폼 · 방향 · 2스트라이크 · 팀 내 1위) 문장에
//   타자 메모에만 있던 문장(초구 승부 · 구종 강약)을 붙여 한 카드로. 겹치던 메모 문장(wOBA 지수 → 히어로의 wOBA+,
//   타구 방향 · 2스트라이크 → 프로필 문장)은 빼고, 표본 경고는 프로필 문구 하나만
function _memoCard(P, data) {
  const s = P.st;
  if (!s.pa) return '';
  const { out, warn } = profileInsights(P, data);
  const first = P.abs.filter(a => a.pitches && a.pitches.length === 1);
  if (first.length >= 3) {
    const c = calcStats(first);
    out.push(`초구에 승부한 타석 ${c.pa}번 — 타율 <b>${c.ab ? f3(c.avg) : '—'}</b>.`);
  }
  const pts = Object.entries(P.pitch).filter(([, st]) => st.ab >= 3).sort((a, b) => b[1].avg - a[1].avg);
  if (pts.length >= 2) {
    const [bn, bs] = pts[0], [wn, ws] = pts[pts.length - 1];
    if (bs.avg - ws.avg >= 0.15) out.push(`<b>${_esc(bn)}</b>에 강하고(${f3(bs.avg)}), <b>${_esc(wn)}</b>에 약해요(${f3(ws.avg)}).`);
  }
  if (!out.length && !warn) return '';
  return `
    <section class="an-card an-insight">
      <header class="an-hd"><h3>${out.length ? `${_esc(P.name)}${josa(P.name, '은', '는')} 이런 타자예요` : '분석 요약'}</h3><span class="an-hd-note">시즌 기록 기준</span></header>
      ${out.length ? `<ul>${out.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
      ${warn}
    </section>`;
}

// 기록 탭에서 타자를 바꾸거나 타석을 기록하면 core.js가 updBatterStat를 부른다 → 타자 탭이 열려 있으면 새 화면도 갱신
function _hookLegacy() {
  const orig = window.updBatterStat;
  if (typeof orig !== 'function' || orig._bt) return;
  const wrapped = function () {
    try { orig.apply(this, arguments); } catch (e) {}
    if (document.querySelector('#anaBody .ana-sec.on[data-sub="batter"]')) openBatterView();
  };
  wrapped._bt = true;
  window.updBatterStat = wrapped;
}

if (typeof window !== 'undefined') {
  _hookLegacy();
  // 시즌 화면의 프로필 카드 버튼(흐름 지표 타율/OPS · 경기 로그 전체 보기) → 타자 탭이 열려 있으면 다시 그림
  onProfileChange(() => { if (document.querySelector('#anaBody .ana-sec.on[data-sub="batter"]')) openBatterView(); });
  window.openBatterView = openBatterView;
  window.setBatterView = setBatterView;
  window.selectBatterSeason = name => setBatterView('sel', name);
  window.openBatterIn = openBatterIn;
  window.exportBatterExcel = exportBatterExcel;
}
