// SprayLab Shell — 하단 탭 3개(기록 / 분석 / 경기설정) + 분석 서브탭
// 기존 패널·뷰는 새로 만들지 않고 DOM 노드를 옮겨서 재사용한다 (ID·핸들러 유지).

const ANA_SUBS = ['spray', 'batter', 'pitcher', 'compare', 'profile', 'scout', 'team'];
// 기존 swTab 이름 → 분석 서브탭
const SWTAB_TO_SUB = { batter: 'batter', pitcher: 'pitcher', stat: 'team', chart: 'team', team: 'team' };

let _tab = 'record';
let _sub = 'spray';

const $ = (id) => document.getElementById(id);

function _move(node, parent) {
  if (node && parent && node.parentElement !== parent) parent.appendChild(node);
}

// ── 초기 DOM 재배치 ──────────────────────────────────────────
function _mount() {
  // 오른쪽 패널의 타자/투수/팀통계/차트/팀 대시보드 → 분석 서브탭
  _move($('pnl-batter'), $('anaSecBatter'));
  _move($('pnl-pitcher'), $('anaSecPitcher'));
  _move($('pnl-stat'), $('anaSecTeam'));
  _move($('pnl-team'), $('anaSecTeam'));
  _move($('pnl-chart'), $('anaSecTeam'));

  // 기존 프로필/비교/스카우트 뷰 → 분석 서브탭 (독립 오버레이 해제)
  [['profileView', 'anaSecProfile'], ['compareView', 'anaSecCompare'], ['scoutView', 'anaSecScout']].forEach(([v, s]) => {
    const el = $(v);
    if (!el) return;
    el.classList.remove('savant-view', 'active');
    el.classList.add('ana-embed');
    _move(el, $(s));
  });

  // 스프레이 보기 전용 컨트롤 (타자 필터 / 팀 필터 / 히트맵 / 상세 필터)
  const ctrls = $('anaSprayCtrls');
  ['filterBtn', 'teamFilterBtn', 'hotColdBtn'].forEach((id) => _move($(id), ctrls));
  const sfBtn = $('sfToggleBtn');
  if (sfBtn) _move(sfBtn.parentElement, ctrls);

  // 구장 선택 → 경기설정
  const st = $('slStBar');
  if (st) { st.style.display = ''; _move(st, $('setStadiumSlot')); }
}

// ── 스프레이: 기록 필드 캔버스 3겹을 그대로 복사 ────────────
function _mirrorSpray() {
  const dst = $('anaSprayCanvas');
  const base = $('fldCanvas');
  if (!dst || !base || !base.width) return;
  if (dst.width !== base.width || dst.height !== base.height) {
    dst.width = base.width;
    dst.height = base.height;
  }
  const ctx = dst.getContext('2d');
  ctx.clearRect(0, 0, dst.width, dst.height);
  ['fldCanvas', 'hitCanvas', 'ovrCanvas'].forEach((id) => {
    const c = $(id);
    if (c && c.width) ctx.drawImage(c, 0, 0, dst.width, dst.height);
  });
  const lg = document.querySelector('.pnl-center .spray-legend');
  const out = $('anaSprayLegend');
  if (lg && out) out.innerHTML = lg.innerHTML;
}

function _refreshSpray() {
  try { if (window.safeRender) window.safeRender(); } catch (e) {}
  requestAnimationFrame(() => requestAnimationFrame(_mirrorSpray));
}

// ── 분석 서브탭 ──────────────────────────────────────────────
function _renderSub(sub) {
  try {
    switch (sub) {
      case 'spray': _refreshSpray(); break;
      case 'batter': if (window.updBatterStat) window.updBatterStat(); break;
      case 'pitcher': if (window.renderPitcherStats) window.renderPitcherStats(); break;
      case 'team':
        if (window.updStats) window.updStats();
        if (window.updCharts) window.updCharts();
        if (window.renderTeamDashboard) window.renderTeamDashboard();
        break;
      case 'profile': if (window.openProfileView) window.openProfileView(); break;
      case 'compare': if (window.openCompareView) window.openCompareView(); break;
      case 'scout':
        if (window.openScoutView) window.openScoutView();
        try {
          if (localStorage.getItem('sl_scout_intro_seen') !== '1' && window.showScoutIntro) window.showScoutIntro();
        } catch (e) {}
        break;
    }
  } catch (e) { console.warn('[shell] render', sub, e); }
  // open*View()는 모든 .savant-view의 active를 지우므로 분석 뷰를 다시 켠다
  if (_tab === 'analysis') {
    const v = $('analysisView');
    if (v) v.classList.add('active');
  }
}

function shellSub(sub) {
  if (ANA_SUBS.indexOf(sub) < 0) sub = 'spray';
  _sub = sub;
  document.querySelectorAll('#anaSubnav .ana-sub').forEach((b) => {
    const on = b.dataset.sub === sub;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('#anaBody .ana-sec').forEach((s) => s.classList.toggle('on', s.dataset.sub === sub));
  const view = $('analysisView');
  if (view) view.scrollTop = 0;
  const btn = document.querySelector('#anaSubnav .ana-sub.on');
  if (btn && btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  // 렌더는 다음 태스크로 (탭 반응 우선)
  setTimeout(() => _renderSub(sub), 0);
}

// ── 경기설정 상태 동기화 ────────────────────────────────────
function _syncSettings() {
  const gfOn = typeof GF !== 'undefined' && GF.active;
  const gfBtn = $('setGfBtn');
  if (gfBtn) {
    gfBtn.textContent = gfOn ? '■ 경기 운영 끄기' : '▶ 경기 운영 시작';
    gfBtn.classList.toggle('on', gfOn);
  }
  const gfEnd = $('setGfEnd');
  if (gfEnd) gfEnd.style.display = gfOn ? '' : 'none';
  [['setHome', 'tHome'], ['setAway', 'tAway']].forEach(([s, t]) => {
    const a = $(s), b = $(t);
    if (a && b && document.activeElement !== a) a.value = b.value;
  });
}

function shellTeamName(which, val) {
  const el = $(which === 'away' ? 'tAway' : 'tHome');
  if (!el) return;
  el.value = val;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function shellGfToggle() {
  if (window.gfToggle) window.gfToggle();
  _syncSettings();
}

// ── 하단 탭 ─────────────────────────────────────────────────
function shellNav(tab, sub) {
  if (['record', 'analysis', 'settings'].indexOf(tab) < 0) tab = 'record';
  _tab = tab;
  document.querySelectorAll('#savantNav .savant-nav-btn').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const ap = $('app-page');
  document.querySelectorAll('.savant-view').forEach((v) => v.classList.remove('active'));

  if (tab === 'record') {
    if (ap) ap.style.display = 'flex';
    document.body.style.overflowY = 'hidden';
    requestAnimationFrame(() => {
      try { if (window.drawField) window.drawField(); if (window.safeRender) window.safeRender(); } catch (e) {}
    });
    return;
  }

  // 분석/경기설정 뷰로 넘어가기 전에 필드 최신 상태 복사 (app-page 숨기기 전)
  if (tab === 'analysis') _mirrorSpray();
  if (ap) ap.style.display = 'none';
  document.body.style.overflowY = '';
  const view = $(tab === 'analysis' ? 'analysisView' : 'settingsView');
  if (view) view.classList.add('active');
  if (tab === 'analysis') shellSub(sub || _sub);
  else _syncSettings();
}

function shellOpenAnalysis(sub) { shellNav('analysis', sub); }

// ── 기존 진입점 호환 ────────────────────────────────────────
function _patchLegacy() {
  // 기존 switchSavantView('spray'|'profile'|'compare'|'scout'|'record') 호출 → 새 탭으로
  window.switchSavantView = function (view) {
    if (view === 'record') shellNav('record');
    else shellNav('analysis', view);
  };
  // 홈 화면으로 나갈 때 분석/설정 뷰가 남지 않도록 기록 탭으로 리셋
  const _origWelcome = window.showAppWelcome;
  if (typeof _origWelcome === 'function') {
    window.showAppWelcome = function () {
      if (_tab !== 'record') shellNav('record');
      return _origWelcome.apply(this, arguments);
    };
  }
}

// 분석 > 스프레이가 열려 있을 때 필터 조작 후 복사본 갱신
document.addEventListener('click', (e) => {
  if (_tab !== 'analysis' || _sub !== 'spray') return;
  if (!e.target.closest('#anaSprayCtrls, #sfPanel')) return;
  setTimeout(_refreshSpray, 60);
  setTimeout(_mirrorSpray, 350);
}, true);

// 기록 탭에서 GF 켜기/끄기 등이 바뀌면 설정 화면 표시도 맞춤
document.addEventListener('visibilitychange', () => { if (_tab === 'settings') _syncSettings(); });

window.shellNav = shellNav;
window.shellSub = shellSub;
window.shellOpenAnalysis = shellOpenAnalysis;
window.shellTeamName = shellTeamName;
window.shellGfToggle = shellGfToggle;
window.shellSyncSettings = _syncSettings;
window.shellMirrorSpray = _mirrorSpray;

function _init() {
  _mount();
  _patchLegacy();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}
