// 분석 탭 — 경기 분석 대시보드 (예전 '스프레이' 서브탭 자리)
//   대상(팀 전체 / 선수) · 범위(이번 경기 / 시즌 누적)
//   왼쪽: 4대 지표 + 표본 경고 · 가운데: 누적 타구 방향도(5구역) · 오른쪽: 박스스코어 · 타석 결과 막대 · 세부 지표 · Excel/리포트
//   계산은 batdata.js calcStats 그대로 (wOBA · BABIP · K% · BB% = CLAUDE.md 공식, WOBA_W 공유)
//   필드는 기록 탭과 같은 그리기(scorebook.js sbPaint) · 방향 구간은 기록 탭과 같은 경계(LF <54 · LC <78 · CF <102 · RC <126 · RF)
import { HITS, esc } from '../constants.js';
import { buildData, calcStats, f3, pct } from './batdata.js?v=4';

const $ = id => document.getElementById(id);

let _scope = 'game';    // game | season
let _team = 'home';     // home | away
let _who = null;        // null = 팀 전체, 아니면 선수 이름

const ZONES = [
  { k: 'LF', l: '좌', full: '좌익', a: 0, b: 54 },
  { k: 'LC', l: '좌중', full: '좌중간', a: 54, b: 78 },
  { k: 'CF', l: '중', full: '중견', a: 78, b: 102 },
  { k: 'RC', l: '우중', full: '우중간', a: 102, b: 126 },
  { k: 'RF', l: '우', full: '우익', a: 126, b: 181 },
];
const _PHI = [45, 63, 81, 99, 117, 135];   // 화면 각도(°): core _FZ_PHI와 같은 구간 경계

const ICON = {
  img: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  sheet: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  report: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  filter: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
};

// ── 데이터 ───────────────────────────────────────────────────
const _teamOf = a => (a.team === 'away' ? 'away' : 'home');
const _val = (id, d) => { const el = $(id); return (el && String(el.value || '').trim()) || d; };

function _source() {
  const AS = window.AS || {};
  const all = _scope === 'game' ? (AS.abs || []) : buildData().games.flatMap(g => g.abs);
  const pass = window._sfPass || (() => true);   // 상세 필터(filter.js)와 같은 판정
  return all.filter(a => _teamOf(a) === _team && pass(a));
}

// 선수 목록: 이번 경기는 라인업 순서, 시즌은 타석 많은 순
function _players(list) {
  const AS = window.AS || {};
  const lu = (_team === 'away' ? AS.away_lineup : AS.home_lineup) || [];
  const m = new Map();
  list.forEach(a => { if (a.bname) m.set(a.bname, (m.get(a.bname) || 0) + 1); });
  const order = n => { const i = lu.findIndex(p => p && p.name === n); return i < 0 ? 999 : i; };
  return [...m.entries()].map(([name, pa]) => ({ name, pa, o: order(name) }))
    .sort((x, y) => (_scope === 'game' ? x.o - y.o : 0) || y.pa - x.pa || x.name.localeCompare(y.name, 'ko'));
}

function _deg(a) {
  if (a.deg != null) return a.deg;
  const dx = a.x - 0.5, dy = Math.min(a.y - 1, 0);
  return (Math.atan2(dy, dx) + Math.PI) * 180 / Math.PI;
}
const _zoneIdx = a => { const d = _deg(a); return ZONES.findIndex(z => d >= z.a && d < z.b); };

function _gameMeta() {
  const th = _val('tHome', '내 팀'), ta = _val('tAway', '원정팀');
  if (_scope === 'season') {
    const n = buildData().games.filter(g => g.abs.length).length;
    return `시즌 누적 · ${n}경기`;
  }
  let d = '';
  try { if (typeof _curSaveKey !== 'undefined' && _curSaveKey) d = (JSON.parse(localStorage.getItem(_curSaveKey)) || {}).d || ''; } catch (e) {}
  if (!d) d = new Date().toLocaleDateString('ko-KR');
  return `${d} · ${th} vs ${ta}`;
}

// ── 필드 (캔버스): 기록 탭과 같은 필드 + 5구역 점선 + 구역별 타구 수 ──
function drawDashField(ctx, S, list) {
  const P = window.sbPaint;
  if (!P || typeof _fieldGeo !== 'function') return;
  const T = P.tok(), u = S / 575;
  P.field(ctx, S, T);
  const g = _fieldGeo(S), F = phi => _fenceR(g, phi), at = (phi, r) => _conePt(g, phi, r);
  // 구역 경계 점선 (--paper, 6 6, 투명도 .55)
  ctx.save();
  ctx.setLineDash([6 * u, 6 * u]); ctx.lineWidth = Math.max(1.5, 2 * u); ctx.strokeStyle = T.paper; ctx.globalAlpha = 0.55;
  _PHI.slice(1, -1).forEach(d => { const ph = d * Math.PI / 180, p = at(ph, F(ph)); ctx.beginPath(); ctx.moveTo(g.cx, g.cy); ctx.lineTo(p[0], p[1]); ctx.stroke(); });
  ctx.restore();
  // 타구 기호 (아웃 → 안타 순으로 겹침)
  const R = Math.max(4, Math.min(8, 7 * u));
  const rank = { out: 0, hit: 1, xbh: 2, hr: 3 };
  list.filter(a => a.x != null && a.y != null)
    .map(a => ({ a, k: P.kindOf(a.res) }))
    .sort((x, y) => (rank[x.k] || 0) - (rank[y.k] || 0))
    .forEach(({ a, k }) => { const q = _semiToCone(g, a.x, a.y); P.mark(ctx, k, q[0], q[1], R, T); });
  // 구역별 타구 수 (Oswald 26px, --paper)
  const cnt = _zoneCounts(list);
  ctx.save();
  ctx.font = `600 ${Math.max(16, Math.round(26 * u))}px Oswald, sans-serif`;
  ctx.fillStyle = T.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ZONES.forEach((z, i) => {
    const ph = (_PHI[i] + _PHI[i + 1]) / 2 * Math.PI / 180, p = at(ph, F(ph) * 0.7);
    ctx.fillText(String(cnt[i]), p[0], p[1]);
  });
  ctx.restore();
}

function _zoneCounts(list) {
  const c = [0, 0, 0, 0, 0];
  list.forEach(a => { if (a.x == null || a.y == null) return; const i = _zoneIdx(a); if (i >= 0) c[i]++; });
  return c;
}

let _fieldList = [];
function _paintScreenField() {
  const cv = $('adField');
  if (!cv) return;
  const box = cv.parentElement;
  const w = (box.clientWidth || 320) - 20;
  // 데스크톱·태블릿: 스크롤 맨 위 기준으로 방향도 + 범례 + 비율 띠가 한 화면에 들어오게
  let maxH = w;
  if (window.innerWidth > 720) {
    const view = $('analysisView'), nav = $('savantNav');
    const top = box.getBoundingClientRect().top + (view ? view.scrollTop : 0);
    const below = 14 + 44 + 58 + 16;   // 안쪽 여백 · 범례 · 비율 띠 · 카드 아래
    maxH = Math.max(320, window.innerHeight - (nav ? nav.getBoundingClientRect().height : 54) - top - below);
  }
  const S = Math.floor(Math.min(w, maxH));
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = S * dpr; cv.height = S * dpr;
  cv.style.width = S + 'px'; cv.style.height = S + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawDashField(ctx, S, _fieldList);
}

// ── 렌더 ─────────────────────────────────────────────────────
function _mount() {
  const sec = document.querySelector('#anaBody .ana-sec[data-sub="spray"]');
  if (!sec) return null;
  let v = $('anaDash');
  if (!v) {
    v = document.createElement('div');
    v.id = 'anaDash';
    v.className = 'ad';
    sec.insertBefore(v, sec.firstChild);
  }
  return v;
}

function _hdrHtml() {
  const seg = (val, l) => `<button type="button" aria-pressed="${_scope === val}" onclick="setAnaDash('scope','${val}')">${l}</button>`;
  return `<div class="ad-hd"><h1 class="ad-title">경기 분석</h1><span class="ad-meta">${esc(_gameMeta())}</span></div>
    <div class="ad-hctrl">
      <div class="sb-seg ad-scope" role="group" aria-label="범위">${seg('game', '이번 경기')}${seg('season', '시즌 누적')}</div>
      <button type="button" class="sb-mini" onclick="adSaveImage()">${ICON.img}이미지로 저장</button>
    </div>`;
}

let _hdrLast = '';
function _renderHdr() {
  const mid = document.querySelector('#analysisView .sb-vhdr .sb-hdr-mid');
  if (!mid) return;
  const h = _hdrHtml();
  if (h !== _hdrLast || !mid.innerHTML) { mid.innerHTML = h; _hdrLast = h; }
}

function _bar(st) {
  // 타석 결과 잉크 막대: 안타 --pen-red / 삼진 --ink / 땅볼 --dirt / 뜬공 비움 / 볼넷·사구 --pen-blue / 기타
  const n = r => st.list.filter(a => r.includes(a.res)).length;
  const parts = [
    ['hit', '안타', st.h],
    ['k', '삼진', st.k],
    ['go', '땅볼', n(['땅볼 아웃', '병살'])],
    ['fo', '뜬공', n(['플라이 아웃', '희비'])],
    ['bb', '볼넷·사구', st.bb + st.hbp],
  ];
  const known = parts.reduce((s, p) => s + p[2], 0);
  parts.push(['etc', '기타', Math.max(0, st.pa - known)]);
  const seg = parts.filter(p => p[2]).map(([c, l, v]) => `<i class="r-${c}" style="flex:${v}" title="${l} ${v}"></i>`).join('');
  return `<div class="ad-bar" role="img" aria-label="${parts.filter(p => p[2]).map(p => p[1] + ' ' + p[2]).join(', ') || '기록 없음'}">${seg}</div>
    <ul class="ad-bar-lg">${parts.filter(p => p[2] || p[0] !== 'etc').map(([c, l, v]) => `<li><i class="r-${c}"></i>${l}<b>${v}</b></li>`).join('')}</ul>`;
}

function _render() {
  const v = _mount();
  if (!v) return;
  // 다시 그려도 키보드 포커스 유지 (같은 동작의 버튼으로 되돌림)
  const act = document.activeElement;
  const fk = act && act.closest && act.closest('#anaDash, #analysisView .sb-vhdr') ? (act.getAttribute('onclick') || '') + '|' + (act.dataset.name || '') : null;
  const src = _source();
  const ps = _players(src);
  if (_who && !ps.some(p => p.name === _who)) _who = null;
  const target = _who ? src.filter(a => a.bname === _who) : src;
  const st = Object.assign(calcStats(target), { list: target });
  const tst = calcStats(src);
  const teamName = _team === 'away' ? _val('tAway', '원정팀') : _val('tHome', '내 팀');
  const whoLbl = _who || `${teamName} 전체`;
  const nFilter = window._sfCount ? window._sfCount() : 0;
  _fieldList = target;

  _renderHdr();

  const tseg = (val, l) => `<button type="button" aria-pressed="${_team === val}" onclick="setAnaDash('team','${val}')">${esc(l)}</button>`;
  const who = [`<button type="button" role="radio" aria-checked="${!_who}" class="ad-who-b${_who ? '' : ' on'}" onclick="setAnaDash('who','')"><b>팀 전체</b><small>${src.length}타석</small></button>`]
    .concat(ps.map(p => `<button type="button" role="radio" aria-checked="${_who === p.name}" class="ad-who-b${_who === p.name ? ' on' : ''}" data-name="${esc(p.name)}" onclick="setAnaDash('who',this.dataset.name)"><b>${esc(p.name)}</b><small>${p.pa}타석</small></button>`)).join('');
  const big = [['AVG', st.ab ? f3(st.avg) : '—'], ['OBP', st.pa ? f3(st.obp) : '—'], ['SLG', st.ab ? f3(st.slg) : '—'], ['OPS', st.pa ? f3(st.ops) : '—']];

  const zc = _zoneCounts(target), zt = zc.reduce((a, b) => a + b, 0);
  const band = zt
    ? ZONES.map((z, i) => `<div class="ad-band-c${zc[i] === Math.max(...zc) ? ' top' : ''}" style="flex:${Math.max(zc[i], zt * 0.08)}" title="${z.full} ${zc[i]}개"><b>${z.l}</b><span>${Math.round(zc[i] / zt * 100)}%</span></div>`).join('')
    : '<p class="ad-none">방향이 기록된 타구가 없어요. 기록 탭 필드에서 타구 위치를 누르면 쌓여요.</p>';

  const row = (name, s, cls) => `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${esc(name)}</th><td>${s.pa}</td><td>${s.ab}</td><td>${s.h}</td><td>${s.bb}</td><td>${s.k}</td><td>${s.ab ? f3(s.avg) : '—'}</td></tr>`;
  const bsRows = ps.map(p => row(p.name, calcStats(src.filter(a => a.bname === p.name)), p.name === _who ? 'sel' : '')).join('');

  const met = [
    ['wOBA', st.pa ? f3(st.woba) : '—', '가중 출루율 (볼넷·사구·안타 종류별 가중치)'],
    ['BABIP', st.ab ? f3(st.babip) : '—', '인플레이 타구 타율 (홈런·삼진 제외)'],
    ['K%', st.pa ? pct(st.kRate) : '—', '삼진 ÷ 타석'],
    ['BB%', st.pa ? pct(st.bbRate) : '—', '볼넷 ÷ 타석 (사구 제외)'],
  ];

  v.innerHTML = `
    <div class="ad-grid">
      <section class="sb-card ad-target" aria-label="분석 대상">
        <header class="sb-card-hd"><h2>대상</h2><div class="sb-seg" role="group" aria-label="팀">${tseg('home', _val('tHome', '내 팀'))}${tseg('away', _val('tAway', '원정팀'))}</div></header>
        <div class="ad-who" role="radiogroup" aria-label="팀 전체 또는 선수">${who}</div>
        <div class="ad-sel"><small class="sb-eyebrow">${_scope === 'game' ? 'THIS GAME' : 'SEASON'}</small><b>${esc(whoLbl)}</b></div>
        <div class="ad-big">${big.map(([k, val]) => `<div${k === 'OPS' ? ' class="ops"' : ''}><span>${k}</span><b>${val}</b></div>`).join('')}</div>
        <p class="ad-line">${st.ab} AB · ${st.h} H · ${st.bb} BB · ${st.k} K</p>
        <p class="ad-warn">표본 ${st.pa}타석. 타율·OPS는 참고용이며 30타석 이상부터 추세로 읽으세요.</p>
      </section>

      <section class="sb-card ad-field" aria-label="누적 타구 방향도">
        <header class="sb-card-hd"><h2>누적 타구 방향도</h2>
          <button type="button" class="sb-mini${nFilter ? ' on' : ''}" onclick="_sfOpen && _sfOpen()" aria-label="상세 필터${nFilter ? ' ' + nFilter + '개 켜짐' : ''}">${ICON.filter}상세 필터${nFilter ? `<b class="ad-fn">${nFilter}</b>` : ''}</button>
        </header>
        <div class="ad-field-box"><canvas id="adField" role="img" aria-label="${esc(whoLbl)} 타구 방향도: ${ZONES.map((z, i) => z.full + ' ' + zc[i]).join(', ')}"></canvas></div>
        <ul class="sb-legend ad-legend" aria-label="기호">${[['hit', '안타'], ['xbh', '장타'], ['hr', '홈런'], ['out', '아웃']].map(([k, l]) => `<li>${window.sbPaint ? window.sbPaint.markSvg(k, 16) : ''}${l}</li>`).join('')}<li class="ad-legend-n">숫자 = 구역별 타구 수</li></ul>
        <div class="ad-band" aria-label="방향 비율">${band}</div>
      </section>

      <div class="ad-side">
        <section class="sb-card ad-box" aria-label="박스스코어">
          <header class="sb-card-hd"><h2>박스스코어</h2><span class="ad-hd-note">${esc(teamName)}</span></header>
          ${ps.length ? `<div class="ad-bs-wrap"><table class="ad-bs">
            <thead><tr><th scope="col">선수</th><th scope="col">PA</th><th scope="col">AB</th><th scope="col">H</th><th scope="col">BB</th><th scope="col">K</th><th scope="col">AVG</th></tr></thead>
            <tbody>${bsRows}</tbody>
            <tfoot>${row('합계', tst, 'sum')}</tfoot>
          </table></div>` : '<p class="ad-none">기록된 타석이 없어요.</p>'}
        </section>
        <section class="sb-card ad-res" aria-label="타석 결과">
          <header class="sb-card-hd"><h2>타석 결과</h2><span class="ad-hd-note">${esc(whoLbl)} · ${st.pa}타석</span></header>
          ${_bar(st)}
        </section>
        <section class="sb-card ad-met" aria-label="세부 지표">
          <header class="sb-card-hd"><h2>세부 지표</h2><span class="ad-hd-note">${esc(whoLbl)}</span></header>
          <table class="ad-mt"><tbody>${met.map(([k, val, d]) => `<tr><th scope="row">${k}</th><td>${val}</td><td>${d}</td></tr>`).join('')}</tbody></table>
        </section>
        <div class="ad-acts">
          <button type="button" class="sb-btn" onclick="adExcel()">${ICON.sheet}Excel 내보내기</button>
          <button type="button" class="sb-btn" onclick="showPostGameReport()">${ICON.report}리포트 만들기</button>
        </div>
      </div>
    </div>`;
  if (fk) {
    const el = Array.prototype.find.call(document.querySelectorAll('#anaDash [onclick], #analysisView .sb-vhdr [onclick]'), e => (e.getAttribute('onclick') || '') + '|' + (e.dataset.name || '') === fk);
    if (el) try { el.focus({ preventScroll: true }); } catch (e) {}
  }
  requestAnimationFrame(_paintScreenField);
}

// ── 버튼 ─────────────────────────────────────────────────────
export function setAnaDash(k, val) {
  if (k === 'scope') _scope = val === 'season' ? 'season' : 'game';
  if (k === 'team') { _team = val === 'away' ? 'away' : 'home'; _who = null; }
  if (k === 'who') _who = val || null;
  _render();
}

// Excel: 이번 경기 = 현재 경기 엑셀, 시즌 누적 = 저장 경기 전체 엑셀 (기존 내보내기 그대로)
function adExcel() {
  if (_scope === 'season') { if (window.exportAllGamesToExcel) window.exportAllGamesToExcel(); }
  else if (window.exportCurrentGameToExcel) window.exportCurrentGameToExcel();
}

// 이미지로 저장: 지금 보이는 방향도(대상 · 범위 그대로) + 제목 · 비율 줄 → PNG (다운로드는 core _downloadCanvas)
function adSaveImage() {
  if (!window.sbPaint || typeof _downloadCanvas !== 'function') return;
  const T = window.sbPaint.tok(), S = 1080, top = 132, bot = 84;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S + top + bot;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = T.paper2; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = T.ink; ctx.textBaseline = 'alphabetic';
  ctx.font = "400 46px 'Black Han Sans', sans-serif"; ctx.fillText('SPRAYLAB', 40, 66);
  ctx.fillStyle = T.red; ctx.font = '600 16px Oswald, sans-serif';
  try { ctx.letterSpacing = '3px'; } catch (e) {}
  ctx.fillText('GAME ANALYSIS', 42, 94);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  const who = _who || `${_team === 'away' ? _val('tAway', '원정팀') : _val('tHome', '내 팀')} 전체`;
  ctx.fillStyle = T.ink; ctx.font = "700 24px 'Gowun Batang', 'Nanum Myeongjo', serif"; ctx.textAlign = 'right';
  ctx.fillText(`${who} · ${_gameMeta()}`, S - 40, 90);
  ctx.textAlign = 'left';
  ctx.fillRect(0, top - 6, S, 3);
  ctx.save(); ctx.translate(0, top); drawDashField(ctx, S, _fieldList); ctx.restore();
  ctx.fillRect(0, top + S, S, 3);
  const zc = _zoneCounts(_fieldList), zt = zc.reduce((a, b) => a + b, 0) || 1;
  ctx.font = '600 26px Oswald, sans-serif'; ctx.textAlign = 'center';
  ZONES.forEach((z, i) => ctx.fillText(`${z.full} ${Math.round(zc[i] / zt * 100)}%`, S * (i + 0.5) / 5, top + S + 54));
  _downloadCanvas(cv, `spraylab_analysis_${Date.now()}.png`);
}

export function openAnaDash() { _render(); }

// ── 연결 ─────────────────────────────────────────────────────
function _hook() {
  // 상세 필터 적용·초기화 뒤 다시 그림 (spray.js와 같은 방식)
  ['_sfApply', '_sfReset'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig._ad) return;
    const w = function () { try { orig.apply(this, arguments); } catch (e) {} if ($('anaDash') && _on()) _render(); };
    w._ad = true;
    window[fn] = w;
  });
  // 지금 열린 서브탭을 #analysisView[data-sub]에 적어 둠 → 헤더의 범위·이미지 버튼은 종합 대시보드에서만 보임
  // (shell.js가 서브탭을 여러 경로로 바꾸므로 .ana-sec.on 변화를 지켜봄) · 분석 탭이 열리면 헤더 제목·대진 갱신
  const view = $('analysisView'), body = $('anaBody');
  const syncSub = () => {
    const on = body && body.querySelector('.ana-sec.on');
    if (view) view.dataset.sub = (on && on.dataset.sub) || 'spray';
    if (view && view.classList.contains('active')) _renderHdr();
  };
  if (window.MutationObserver) {
    if (body) new MutationObserver(syncSub).observe(body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    if (view) new MutationObserver(syncSub).observe(view, { attributes: true, attributeFilter: ['class'] });
  }
  syncSub();
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (_on()) _paintScreenField(); }, 120); });
}
const _on = () => { const v = $('analysisView'); return !!(v && v.classList.contains('active') && (v.dataset.sub || 'spray') === 'spray'); };

function _init() {
  // 서브탭 이름: 스프레이 → 종합 (내용이 스프레이 + 지표 + 박스스코어)
  const b = document.querySelector('#anaSubnav .ana-sub[data-sub="spray"]');
  if (b) b.textContent = '종합';
  _hook();
}

if (typeof window !== 'undefined') {
  // shell.js는 스프레이 서브탭을 열 때 window.openSprayView()를 부른다 → 대시보드로 대체
  window.openSprayView = openAnaDash;
  window.openAnaDash = openAnaDash;
  window.setAnaDash = setAnaDash;
  window.adExcel = adExcel;
  window.adSaveImage = adSaveImage;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_init, 0));
  else setTimeout(_init, 0);
}
