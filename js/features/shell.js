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

  // 왼쪽 라인업 패널(홈/원정 탭 · 명단 · 선수 추가 입력부) → 라인업 서랍
  const lp = document.querySelector('.pnl-left');
  const ldBody = $('lineupDrawerBody');
  if (lp && ldBody) {
    [':scope > .tabs', ':scope > .pnl-hd', ':scope > #lpList', ':scope > .add-row'].forEach((sel) => {
      _move(lp.querySelector(sel), ldBody);
    });
  }

  // 현재 타자 칩: 기존 #batterDisp를 버튼 안으로 옮김 (selBatter가 계속 내용을 갱신)
  const bar = document.querySelector('.pnl-center .batter-bar');
  const disp = $('batterDisp');
  if (bar && disp && !$('curBatterChip')) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.id = 'curBatterChip';
    chip.className = 'cur-batter-chip';
    chip.setAttribute('aria-haspopup', 'dialog');
    chip.setAttribute('aria-controls', 'lineupDrawer');
    chip.onclick = () => shellDrawer(true);
    bar.insertBefore(chip, bar.firstChild);
    chip.appendChild(disp);
    const meta = document.createElement('span');
    meta.className = 'cbc-meta';
    meta.innerHTML = '<span class="cbc-next" id="cbcNext"></span><span class="cbc-open">라인업 ▾</span>';
    chip.appendChild(meta);
  }
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

// ── 라인업 서랍 ─────────────────────────────────────────────
function shellDrawer(open) {
  const d = $('lineupDrawer'), bd = $('lineupDrawerBackdrop'), chip = $('curBatterChip');
  if (!d) return;
  d.classList.toggle('open', !!open);
  d.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (bd) bd.classList.toggle('open', !!open);
  if (chip) chip.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    try { if (window.renderLP) window.renderLP(); } catch (e) {}
    const cur = d.querySelector('.player-row.active');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
}

// ── 현재 타자 / 타순 ────────────────────────────────────────
const _gfOn = () => typeof GF !== 'undefined' && GF.active;
const _lineup = () => { try { return window.getActiveLineup ? window.getActiveLineup() || [] : []; } catch (e) { return []; } };

// selBatter()는 같은 선수를 다시 누르면 해제(토글)하므로 먼저 비우고 지정
function _selectBatter(id) {
  if (!window.selBatter || typeof AS === 'undefined') return;
  AS.batter = null;
  window.selBatter(id);
  // 자동 이동으로 바뀐 타자는 필드를 그 타자로 거르지 않음 (최근 기록 링이 보이도록)
  AS.batterFilter = false;
  const fb = $('filterBtn');
  if (fb) fb.classList.remove('btn-primary');
  try { if (window.safeRender) window.safeRender(); } catch (e) {}
}

function _updateChipNext() {
  const el = $('cbcNext');
  if (!el) return;
  const lu = _lineup();
  const cur = typeof AS !== 'undefined' ? AS.batter : null;
  const i = cur ? lu.findIndex((p) => String(p.id) === String(cur.id)) : -1;
  const next = i >= 0 && lu.length > 1 ? lu[(i + 1) % lu.length] : null;
  el.textContent = next ? '다음 ' + (next.num ? '#' + next.num + ' ' : '') + next.name : '';
}

// 기록 후 다음 타순으로 (경기 운영 모드는 기존 gfNextBatter가 처리)
function _advanceBatter() {
  if (_gfOn() || typeof AS === 'undefined' || !AS.batter) return;
  const lu = _lineup();
  const i = lu.findIndex((p) => String(p.id) === String(AS.batter.id));
  if (i < 0 || lu.length < 2) return;
  _selectBatter(lu[(i + 1) % lu.length].id);
}

function _patchBatterFlow() {
  const origAfter = window.gfAfterRecord;
  if (typeof origAfter === 'function') {
    window.gfAfterRecord = function () {
      const r = origAfter.apply(this, arguments);
      _advanceBatter();
      return r;
    };
  }

  // 되돌리기: 기록을 지우고 그 타석의 타자로 돌아감
  const origUndo = window.undoLast;
  if (typeof origUndo === 'function') {
    window.undoLast = function () {
      const last = typeof AS !== 'undefined' && AS.abs.length ? AS.abs[AS.abs.length - 1] : null;
      const r = origUndo.apply(this, arguments);
      if (last && !_gfOn() && (last.team || 'home') === AS.curTeam && _lineup().some((p) => String(p.id) === String(last.bid))) {
        _selectBatter(last.bid);
      }
      return r;
    };
  }

  // 최근 기록 항목에 되돌리기 버튼
  const origRecs = window.renderRecs;
  if (typeof origRecs === 'function') {
    window.renderRecs = function () {
      const r = origRecs.apply(this, arguments);
      _markLatestRec();
      _updateRecCount();
      return r;
    };
  }

  const origLP = window.renderLP;
  if (typeof origLP === 'function') {
    window.renderLP = function () {
      const r = origLP.apply(this, arguments);
      _updateChipNext();
      return r;
    };
  }

  // 필드: 가장 최근 기록을 파란 링으로 표시
  const origDot = window.drawDot;
  if (typeof origDot === 'function') {
    window.drawDot = function (r) {
      const out = origDot.apply(this, arguments);
      _ringLatest(r);
      return out;
    };
  }
}

function _latest() {
  return typeof AS !== 'undefined' && AS.abs && AS.abs.length ? AS.abs[AS.abs.length - 1] : null;
}

function _markLatestRec() {
  const last = _latest();
  const list = $('recList');
  if (!last || !list) return;
  const del = list.querySelector('.rec-del[onclick="delRec(' + last.id + ')"]');
  const item = del && del.closest('.rec-item');
  if (!item || item.querySelector('.rec-undo')) return;
  item.classList.add('rec-latest');
  const btn = document.createElement('button');
  btn.className = 'rec-undo';
  btn.type = 'button';
  btn.textContent = '↶ 되돌리기';
  btn.title = '가장 최근 기록 취소 (Ctrl+Z)';
  btn.onclick = (e) => { e.stopPropagation(); window.undoLast(); };
  (item.querySelector('.rec-info') || item).appendChild(btn);
}

function _ringLatest(r) {
  const last = _latest();
  if (!r || r !== last || !r.x || typeof hCtx === 'undefined' || !hCtx || typeof FS === 'undefined') return;
  if (window._sfPass && !window._sfPass(r)) return;
  const [x, y] = typeof _fieldPx === 'function' ? _fieldPx(r) : [r.x * FS, r.y * FS];
  hCtx.save();
  hCtx.beginPath();
  hCtx.arc(x, y, 11, 0, Math.PI * 2);
  hCtx.strokeStyle = '#4b8cf5';
  hCtx.lineWidth = 2.5;
  hCtx.stroke();
  hCtx.restore();
}

// ── 상단 바: 이닝 · 스코어 · ☰ (B·S·O·자동 저장 표시·투구 버튼은 기록 화면에서 뺌) ──
function _mountHeader() {
  const hdr = document.querySelector('.app-hdr');
  if (!hdr || $('slMenuBtn')) return;

  const inn = $('innSel');
  if (inn) hdr.insertBefore(inn, hdr.firstChild);

  // 스코어: 요약 칩 → 누르면 기존 스코어보드(팀명·±·직접입력)를 팝오버로
  const sb = hdr.querySelector('.scoreboard');
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.id = 'scoreChip';
  chip.className = 'score-chip';
  chip.setAttribute('aria-haspopup', 'dialog');
  chip.setAttribute('aria-expanded', 'false');
  chip.title = '스코어 수정';
  chip.onclick = (e) => { e.stopPropagation(); shellScore(); };
  if (inn) inn.after(chip); else hdr.insertBefore(chip, hdr.firstChild);
  const pop = $('scoreEditor');
  if (sb && pop) _move(sb, pop.querySelector('.se-body'));

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.id = 'slMenuBtn';
  menuBtn.className = 'hdr-menu-btn';
  menuBtn.setAttribute('aria-label', '메뉴');
  menuBtn.setAttribute('aria-haspopup', 'true');
  menuBtn.setAttribute('aria-controls', 'slMenu');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  menuBtn.onclick = (e) => { e.stopPropagation(); shellMenu(); };
  hdr.appendChild(menuBtn);

  // 기존 메뉴·툴바 요소 중 cloud.js / core.js가 ID로 갱신하는 것은 ☰ 안으로 이동
  [['toolbarUndoBtn', 'slmUndoSlot'], ['saveInd', 'slmSyncStatus'], ['authBtn', 'slmAuthSlot'],
   ['teamBadge', 'slmAuthSlot'], ['hcToggleBtn', 'slmViewSlot'], ['helpModeBtn', 'slmViewSlot']].forEach(([id, slot]) => {
    const n = $(id);
    if (!n) return;
    _move(n, $(slot));
    if (n.tagName === 'BUTTON') n.classList.add('slm-item');
  });

  _updateScoreChip();
  ['scH', 'scA'].forEach((id) => {
    const el = $(id);
    if (el && window.MutationObserver) new MutationObserver(_updateScoreChip).observe(el, { childList: true, characterData: true, subtree: true });
  });
  ['tHome', 'tAway'].forEach((id) => { const el = $(id); if (el) el.addEventListener('input', _updateScoreChip); });
}

function _updateScoreChip() {
  const chip = $('scoreChip');
  if (!chip) return;
  const v = (id, d) => { const el = $(id); return el ? (el.value !== undefined && el.tagName === 'INPUT' ? el.value : el.textContent).trim() || d : d; };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const th = v('tHome', '홈'), ta = v('tAway', '원정'), h = v('scH', '0'), a = v('scA', '0');
  chip.innerHTML = '<span class="scc-team">' + esc(th) + '</span><b>' + esc(h) + '</b><span class="scc-sep">:</span><b>' + esc(a) + '</b><span class="scc-team">' + esc(ta) + '</span>';
  chip.setAttribute('aria-label', '스코어 ' + th + ' ' + h + ' 대 ' + ta + ' ' + a + ', 눌러서 수정');
}

// ── 팝오버 (스코어 / ☰) ─────────────────────────────────────
function _setPop(id, btnId, open) {
  const el = $(id), btn = $(btnId), bd = $('slPopBackdrop');
  if (!el) return;
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  const any = ['slMenu', 'scoreEditor'].some((x) => $(x) && $(x).classList.contains('open'));
  if (bd) bd.classList.toggle('open', any);
}
function shellMenu(open) {
  const el = $('slMenu');
  if (!el) return;
  if (open === undefined) open = !el.classList.contains('open');
  if (open) _setPop('scoreEditor', 'scoreChip', false);
  _setPop('slMenu', 'slMenuBtn', open);
}
function shellScore(open) {
  const el = $('scoreEditor');
  if (!el) return;
  if (open === undefined) open = !el.classList.contains('open');
  if (open) _setPop('slMenu', 'slMenuBtn', false);
  _setPop('scoreEditor', 'scoreChip', open);
  if (!open) _updateScoreChip();
}
function shellClosePops() { shellMenu(false); shellScore(false); }

// ☰ → 투구 입력 (구종·코스)
function shellPitchInput() {
  if (window.innerWidth <= 720) { if (window.mobPitchSheetOpen) window.mobPitchSheetOpen(); }
  else if (window.toggleInputBar) window.toggleInputBar();
}

// ☰ 항목을 누르면 메뉴 닫기
document.addEventListener('click', (e) => {
  if (e.target.closest('#slMenu button')) setTimeout(() => shellMenu(false), 0);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { shellClosePops(); shellRecSheet(false); } });

// ── 기록 화면 배치: 칩 → 필드 → 결과 버튼 (최근 기록은 ☰ → 최근 기록 시트) ──
function _mountRecordLayout() {
  const fw = document.querySelector('.pnl-center .field-wrap');
  const qb = $('quickBar');
  if (fw && qb) ($('liveStatLine') || fw).after(qb); // 필드 → 지표 줄 → 결과 버튼

  // 기존 타석기록 패널을 "최근 기록" 시트로 사용 (수정·삭제·선수별 보기·순서 변경 그대로)
  const pr = document.querySelector('.pnl-right');
  if (pr && !pr.querySelector('.rec-sheet-hd')) {
    const hd = document.createElement('div');
    hd.className = 'rec-sheet-hd';
    hd.innerHTML = '<span>타석 기록</span><button type="button" class="sl-pop-x" onclick="shellRecSheet(false)" aria-label="닫기">✕</button>';
    pr.insertBefore(hd, pr.firstChild);
  }
  _updateRecCount();
}

function _updateRecCount() {
  const cnt = $('slmRecCount');
  if (cnt && typeof AS !== 'undefined') cnt.textContent = AS.abs && AS.abs.length ? AS.abs.length + '타석' : '';
}

function shellRecSheet(open) {
  document.body.classList.toggle('rec-sheet-open', !!open);
  const bd = $('recSheetBackdrop');
  if (bd) bd.classList.toggle('open', !!open);
}

// ── 기존 진입점 호환 ────────────────────────────────────────
function _patchLegacy() {
  // 기존 switchSavantView('spray'|'profile'|'compare'|'scout'|'record') 호출 → 새 탭으로
  window.switchSavantView = function (view) {
    if (view === 'record') shellNav('record');
    else shellNav('analysis', view);
  };
}

// 분석 > 스프레이가 열려 있을 때 필터 조작 후 복사본 갱신
document.addEventListener('click', (e) => {
  if (_tab !== 'analysis' || _sub !== 'spray') return;
  if (!e.target.closest('#anaSprayCtrls, #sfPanel')) return;
  setTimeout(_refreshSpray, 60);
  setTimeout(_mirrorSpray, 350);
}, true);

// 서랍에서 타자를 고르면 닫기 (버튼·입력·드래그 핸들은 제외)
// selBatter가 클릭 중 목록을 다시 그리므로 캡처 단계에서 판정
document.addEventListener('click', (e) => {
  const row = e.target.closest('#lineupDrawer .player-row');
  if (!row || e.target.closest('button, input, select, .drag-handle')) return;
  setTimeout(() => shellDrawer(false), 120);
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('lineupDrawer') && $('lineupDrawer').classList.contains('open')) shellDrawer(false);
});

// 기록 탭에서 GF 켜기/끄기 등이 바뀌면 설정 화면 표시도 맞춤
document.addEventListener('visibilitychange', () => { if (_tab === 'settings') _syncSettings(); });

window.shellNav = shellNav;
window.shellSub = shellSub;
window.shellOpenAnalysis = shellOpenAnalysis;
window.shellTeamName = shellTeamName;
window.shellGfToggle = shellGfToggle;
window.shellSyncSettings = _syncSettings;
window.shellMirrorSpray = _mirrorSpray;
window.shellDrawer = shellDrawer;
window.shellMenu = shellMenu;
window.shellScore = shellScore;
window.shellClosePops = shellClosePops;
window.shellRecSheet = shellRecSheet;
window.shellPitchInput = shellPitchInput;

function _init() {
  _mount();
  _patchLegacy();
  _patchBatterFlow();
  _updateChipNext();
  _mountHeader();
  _mountRecordLayout();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}
