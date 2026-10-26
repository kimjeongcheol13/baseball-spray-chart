// 첫 사용 흐름 — 입력·저장·계산은 core.js 그대로 두고, 그 앞단의 화면 흐름만 보탠다 (데이터 구조·저장 형식·localStorage 키 변경 없음)
//   ① 타자 없이 필드 탭: "타자를 먼저 선택하세요" 토스트 대신 탭한 자리에 타자 선택 팝업
//      · 고르면 같은 위치로 기존 onFClick 을 이어서 부른다 → 기존 결과 팝업(안타·장타·땅볼·플라이)이 그 자리에 뜬다
//      · 라인업이 비면: 이름 입력 → 기존 addPlayer 로 추가하고 이어서 / [이름 없이 기록] = 기존 '타자 1' 자동 생성 그대로
//      · 경기 운영 모드: 지금 타순 타자를 자동 선택하고 팝업 없이 이어서
//   ② 토스트: 하단 탭을 눌러 탭이 바뀌면 바로 지움 (모바일 위치는 css/shell.css — 하단 탭 바로 위)
//   ③ 빈 라인업 첫 화면: 타순표 빈 '이름' 행을 누르면 그 자리에서 이름 입력 · 저장된 라인업이 없으면 "라인업을 먼저 만들까요?" 배너
//      새 키: sl_lineup_banner_closed (배너를 닫으면 '1' — core _SETTINGS_KEYS · sample.js 설정 키 목록에도 추가)
import { esc } from '../constants.js';

const $ = id => document.getElementById(id);
const _AS = () => window.AS || {};
const _gfOn = () => typeof GF !== 'undefined' && GF && GF.active;
const _lineup = () => { try { return (window.getActiveLineup && window.getActiveLineup()) || []; } catch (e) { return []; } };

// ── ① 필드 탭 → 타자 선택 ───────────────────────────────────
let _pk = null;   // 열려 있을 때 { fx, fy, w } — 탭 위치(필드 캔버스 대비 비율) · 열 때의 필드 폭
const PK_GAP = 24;   // 손가락에 가리지 않도록 탭 지점과 띄우는 거리(px) — core _TP_GAP 과 같음

// 이벤트 → 필드 비율 좌표 + 방향 · 거리 표시. 파울 지역 · 펜스 밖이면 null (기존 onFClick 도 무시하는 자리)
function _tapAt(e) {
  try {
    const rect = e.rect || fC.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
    // 파울 지역 · 펜스 뒤도 같은 흐름(core onFClick 과 같은 _coneToSemiAll) · 3D 는 계산한 저장 좌표(e.sp)를 그대로
    const sp = e.sp || _coneToSemiAll(_fieldGeo(FS), fx * FS, fy * FS);
    if (!sp) return null;
    // 방향 · 추정 거리: core onFClick 과 같은 계산 (표시용)
    const d = sp.deg, dir = d < 54 ? 'LF' : d < 78 ? 'LC' : d < 102 ? 'CF' : d < 126 ? 'RC' : 'RF';
    const st = STADIUMS[_AS().stadium] || STADIUMS.standard;
    const lf = st.lfDist, cf = st.cfDist, rf = st.rfDist;
    const wall = { LF: lf, LC: (lf + cf) / 2, CF: cf, RC: (cf + rf) / 2, RF: rf }[dir];
    return { fx, fy, sp: e.sp || null, sub: `${dir} · ${Math.round(sp.dist * wall)}m` };
  } catch (e) { return null; }
}

// 고른 뒤: 지금 필드 위치 기준으로 같은 자리를 다시 계산해 기존 onFClick 으로 (타자 선택으로 배치가 바뀌어도 같은 지점)
function _continue(at, orig) {
  let r = fC.getBoundingClientRect();
  if (!r.width) r = { left: 0, top: 0, width: FS, height: FS };   // 3D 보기(2D 필드 숨김)에서 찍은 경우: 캔버스 좌표 그대로
  orig({ clientX: r.left + at.fx * r.width, clientY: r.top + at.fy * r.height, rect: r, sx: FS / r.width, sy: FS / r.height, sp: at.sp });
}
// 타자를 고르면 샘플 버튼 숨김 · NOW BATTING 줄 등으로 필드 크기가 다시 계산될 수 있다 (record/scorebook 의 80ms 지연 resize 포함)
// → 필드 폭이 몇 프레임 그대로일 때 이어서 연다. 먼저 열면 결과 팝업이 옛 크기 자리에 남고 탭 표시가 지워진다
function _afterLayout(cb) {
  const t0 = performance.now();
  let last = -1, same = 0;
  const step = () => {
    const w = $('cwrap'), cur = w ? w.clientWidth : 0, t = performance.now() - t0;
    if (cur === last) same++; else { same = 0; last = cur; }
    if ((t >= 120 && same >= 3) || t >= 500) cb(); else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// selBatter 는 같은 선수를 다시 누르면 해제(토글)하므로 shell.js 의 지정 함수(먼저 비우고 지정)를 쓴다
function _select(id) {
  if (window.shellSelectBatter) window.shellSelectBatter(id);
  else if (window.selBatter) { _AS().batter = null; window.selBatter(id); }
}

// 경기 운영 모드: 공격 팀 라인업의 지금 타순 타자
function _gfAuto() {
  const lu = window.gfGetLineup ? window.gfGetLineup() || [] : [];
  if (!lu.length) return false;
  const team = GF.half === 'top' ? 'home' : 'away';
  if (_AS().curTeam !== team && window.swLineupTab) window.swLineupTab(team);   // 기록은 AS.curTeam 으로 들어가므로 공격 팀에 맞춘다
  _select(lu[GF.batterIdx % lu.length].id);
  return !!_AS().batter;
}

function _pkEl() {
  let el = $('batPick');
  if (el) return el;
  const w = $('cwrap');
  if (!w) return null;
  el = document.createElement('div');
  el.id = 'batPick';
  el.className = 'bat-pick';
  el.setAttribute('role', 'dialog');
  el.hidden = true;
  w.appendChild(el);
  // 팝업 위 움직임이 필드의 '근처 타구 상세' 카드를 띄우지 않도록 (core #tapPop 과 같은 처리)
  el.addEventListener('pointermove', e => e.stopPropagation());
  return el;
}

function _pkHtml(at, lu) {
  const hd = t => `<div class="bp-hd"><b>${t}</b><small>${esc(at.sub)}</small></div>`;
  if (!lu.length) {
    return hd('라인업이 비어 있어요')
      + `<form class="bp-add" data-act="add"><input type="text" maxlength="8" placeholder="선수 이름" aria-label="선수 이름" enterkeyhint="done" autocomplete="off">`
      + `<button type="submit" class="bp-go">추가하고 기록</button></form>`
      + `<button type="button" class="bp-anon" data-act="anon">이름 없이 기록 ›</button>`;
  }
  return hd('타자 선택')
    + `<div class="bp-grid">${lu.map((p, i) => `<button type="button" class="bp-b" data-id="${esc(String(p.id))}" aria-label="${i + 1}번 ${esc(p.name)}"><i>${i + 1}</i><span>${esc(p.name)}</span></button>`).join('')}</div>`;
}

// 배치: core _tpPlace 와 같은 규칙 — 탭 지점 우측 상단, 넘치면 좌/하로 뒤집고, 양쪽 다 안 되면 위/아래 + 가로 클램프
function _pkPlace() {
  const el = $('batPick'), w = $('cwrap');
  if (!_pk || !el || !w) return;
  const W = w.clientWidth, H = w.clientHeight, px = _pk.fx * W, py = _pk.fy * H, pw = el.offsetWidth, ph = el.offsetHeight, G = PK_GAP;
  const clamp = (v, max) => Math.max(0, Math.min(v, max));
  const fitR = px + G + pw <= W, fitL = px - G - pw >= 0, fitT = py - G - ph >= 0, fitB = py + G + ph <= H;
  let left, top;
  if (fitR || fitL) {
    left = fitR ? px + G : px - G - pw;
    top = fitT ? py - G - ph : (fitB ? py + G : clamp(py - ph / 2, H - ph));
  } else {
    left = clamp(px - pw / 2, W - pw);
    top = fitT ? py - G - ph : (fitB ? py + G : clamp(py - G - ph, H - ph));
  }
  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(top) + 'px';
}

function _pkOpen(at, lu, orig) {
  const el = _pkEl();
  if (!el) return false;
  _pk = { fx: at.fx, fy: at.fy, w: $('cwrap').clientWidth, at, orig, t: performance.now() };
  el.setAttribute('aria-label', lu.length ? '타자 선택' : '선수 추가');
  el.classList.toggle('empty', !lu.length);
  el.innerHTML = _pkHtml(at, lu);
  el.hidden = false;
  try { _tpMarker(at.fx * FS, at.fy * FS); } catch (e) {}   // 탭 지점 점선 원 (core 결과 팝업과 같은 표시)
  _pkPlace();
  const p = _pk;
  requestAnimationFrame(() => { if (_pk === p) p.t = performance.now(); });   // core _TP_HOLD 는 그려진 때부터
  // 빈 라인업은 이름칸, 아니면 키보드로 연 경우에만 첫 타자에 포커스 (마우스·터치 탭에서 포커스 링이 뜨지 않게)
  const inp = el.querySelector('input');
  if (inp) inp.focus({ preventScroll: true });
  else if (document.activeElement === fC) { const b = el.querySelector('.bp-b'); if (b) b.focus({ preventScroll: true }); }
  // 키보드 입력 안내(core _kbSay 의 '입력됨')를 덮어쓴다
  setTimeout(() => { const live = $('fldKbLive'); if (live && _pk) live.textContent = lu.length ? '타자를 고르세요' : '라인업이 비어 있어요. 선수 이름을 입력하세요'; }, 60);
  return true;
}

function _pkClose() {
  if (!_pk) return;
  _pk = null;
  const el = $('batPick');
  if (el) { el.hidden = true; el.innerHTML = ''; }
  // 탭 지점 표시 지움 (core _tpCancel 과 같은 처리)
  try {
    oCtx.clearRect(0, 0, FS, FS);
    const A = _AS();
    if (A.showHotCold && A.batter) { _drawHotColdOnCtx(); oC.classList.add('show'); } else oC.classList.remove('show');
  } catch (e) {}
}

// 고른 뒤 이어서 기록: 팝업을 닫고(표시는 결과 팝업이 다시 그림) 기존 흐름으로
function _pkGo(fn, viaKey) {
  const p = _pk;
  if (!p) return;
  _pkClose();
  fn();
  if (!_AS().batter) return;
  _afterLayout(() => {
    if (!_AS().batter || window._tp || document.querySelector('.overlay.show')) return;   // 기다리는 사이 다른 동작이 끼면 그만
    _continue(p.at, p.orig);
    if (viaKey && window._tp) { const b = document.querySelector('#tapPop .tp-btn'); if (b) b.focus(); }
  });
}

function _pkInit() {
  const el = _pkEl();
  if (!el || el._pk) return;
  el._pk = true;
  el.addEventListener('click', e => {
    e.stopPropagation();
    const viaKey = e.detail === 0;   // 키보드(Enter/Space)로 누른 클릭
    const b = e.target.closest('button');
    if (!b || !_pk) return;
    if (b.dataset.id) { const id = b.dataset.id; _pkGo(() => _select(id), viaKey); return; }
    if (b.dataset.act === 'anon') {
      // 기존 동작 그대로: onFClick 의 _ensureBatter 가 '타자 1'을 만들고 이어서 기록
      const p = _pk;
      _pkClose();
      _continue(p.at, p.orig);
    }
  });
  el.addEventListener('submit', e => {
    e.preventDefault();
    const inp = el.querySelector('.bp-add input');
    const nm = String((inp && inp.value) || '').trim().slice(0, 8);
    if (!nm) { if (inp) inp.focus(); return; }
    // 기존 addPlayer 입력칸을 채워서 그대로 호출 (setup.js stAdd 와 같은 방식) — 첫 선수는 addPlayer 가 현재 타자로 지정
    _pkGo(() => {
      const n = $('pName'), num = $('pNum');
      if (!n || !window.addPlayer) return;
      n.value = nm;
      if (num) num.value = '';
      window.addPlayer();
      const lu = _lineup(), p = lu[lu.length - 1];
      if (!_AS().batter && p && p.name === nm) _select(p.id);
    }, false);
  });
  // 팝업 바깥 탭 → 취소 (필드 캔버스 탭은 감싼 onFClick 에서 취소) · 막 열렸을 때 필드를 누른 건 무시 (core _tpFresh)
  document.addEventListener('pointerdown', e => {
    if (!_pk || el.contains(e.target) || e.target === fC) return;
    if (_tpFresh(_pk.t) && el.parentNode && el.parentNode.contains(e.target)) return;
    _pkClose();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _pk) { _pkClose(); if (fC && fC.offsetParent) fC.focus(); } });
  // 필드 크기가 바뀌면 위치가 어긋나므로 취소 (core 결과 팝업과 같은 규칙)
  window.addEventListener('resize', () => setTimeout(() => { const w = $('cwrap'); if (_pk && w && w.clientWidth !== _pk.w) _pkClose(); }, 200));
}

function _hookFieldTap() {
  const orig = window.onFClick;
  if (typeof orig !== 'function' || orig._fr) return;
  const w = function (e) {
    if (_pk) { if (!_tpFresh(_pk.t)) _pkClose(); return; }   // 팝업이 열린 채 필드 탭 = 취소 (결과 팝업과 같은 동작 · 막 열렸으면 무시)
    // 결과 팝업 열림(탭=취소) · 다른 창 열림 · 타자 있음 → 기존 흐름 그대로
    if (window._tp || document.querySelector('.overlay.show') || _AS().batter) return orig.apply(this, arguments);
    const at = _tapAt(e);
    if (!at) return orig.apply(this, arguments);   // 홈 뒤: 기존 처리
    if (_gfOn() && _gfAuto()) {
      const kb = document.activeElement === fC;   // 키보드로 입력했으면 결과 팝업 첫 버튼으로 포커스
      _afterLayout(() => {
        if (!_AS().batter || window._tp || document.querySelector('.overlay.show')) return;
        _continue(at, orig);
        if (kb && window._tp) { const b = document.querySelector('#tapPop .tp-btn'); if (b) b.focus(); }
      });
      return;
    }
    if (!_pkOpen(at, _lineup(), orig)) return orig.apply(this, arguments);
  };
  w._fr = true;
  window.onFClick = w;
}

// ── ② 토스트: 하단 탭을 눌러 탭이 바뀌면 바로 지움 ─────────
// 기록 탭에서 뜬 알림(되돌리기 버튼 포함)이 분석 · 경기설정 탭까지 남아 안내문을 가리고, 다른 탭에서 되돌리기가 눌렸다.
// 사용자가 하단 탭을 누를 때만 지운다 — 저장 뒤 자동 이동 · '필드에서 위치를 탭하세요'처럼 코드가 탭을 옮기며 띄우는 안내는 그대로
function _toastOff() {
  const t = $('toast');
  if (t && t.classList.contains('show')) {
    t.classList.add('toast-cut');   // 사라지는 전환(280ms) 없이 바로
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.remove('toast-cut');
  }
  // 저장 뒤 클라우드 안내(core _showCloudUpsellToast — 인라인 스타일로 켜고 끔): 같은 방식으로 숨김
  const u = $('cloudUpsellToast');
  if (u && u.style.opacity === '1') {
    const tr = u.style.transition;
    u.style.transition = 'none';
    u.style.opacity = '0';
    u.style.transform = 'translateX(-50%) translateY(20px)';
    u.style.pointerEvents = 'none';
    void u.offsetWidth;
    u.style.transition = tr;
  }
}
function _toastInit() {
  const nav = $('savantNav');
  if (!nav || nav._fr) return;
  nav._fr = true;
  // 캡처 단계: 버튼의 onclick(shellNav)보다 먼저 — 지금 탭과 다른 탭을 누를 때만
  nav.addEventListener('click', e => {
    const b = e.target.closest('.savant-nav-btn');
    if (!b || !b.dataset.tab) return;
    const cur = nav.querySelector('.savant-nav-btn.active');
    if (cur && cur.dataset.tab === b.dataset.tab) return;
    _toastOff();
  }, true);
}

// ── ③-a 타순표 빈 '이름' 행: 그 자리에서 이름 입력 ─────────
// 빈 행은 라인업 서랍을 열었다(scorebook sbEditLineup). 이제 행이 입력칸으로 바뀌고, Enter = 추가 후 다음 빈 행으로 이어서.
// 추가는 기존 addPlayer 입력칸을 채워 그대로 호출 (setup.js stAdd 와 같은 방식 — 등번호 = 타순, 첫 선수는 addPlayer 가 현재 타자로)
// 입력 중에는 scorebook render 가 타순표를 건너뛴다(입력칸 보호) → 끝나면 sbRender 로 다시 그림
function _otAdd(nm) {
  const n = $('pName'), num = $('pNum');
  if (!n || !window.addPlayer) return;
  n.value = nm;
  if (num) num.value = '';
  window.addPlayer();
}
function _otOpen(li, i) {
  li.innerHTML = `<div class="sb-ot-row empty fr-ot-edit"><span class="n">${i + 1}</span>`
    + `<input type="text" class="fr-ot-in" data-i="${i}" maxlength="8" placeholder="이름" aria-label="${i + 1}번 이름 — 입력하고 Enter 를 누르면 추가하고 다음 칸으로" enterkeyhint="next" autocomplete="off"></div>`;
  const inp = li.querySelector('input');
  inp.focus({ preventScroll: true });
  if (inp.scrollIntoView) inp.scrollIntoView({ block: 'nearest' });
}
function _otEnd() {
  const a = document.activeElement;
  if (a && a.classList && a.classList.contains('fr-ot-in')) { a.dataset.done = '1'; a.blur(); }
  if (window.sbRender) window.sbRender();
}
function _otCommit(inp, next) {
  if (inp.dataset.done) return;
  inp.dataset.done = '1';
  const nm = String(inp.value || '').trim().slice(0, 8);
  if (!nm) { _otEnd(); return; }
  const li = inp.closest('li'), i = +inp.dataset.i;
  // 다음 빈 행에 먼저 포커스를 옮긴다 (지금 칸을 지우기 전에 → 모바일 키보드가 닫히지 않게)
  const nx = next && li && li.nextElementSibling;
  if (nx && nx.querySelector('.sb-ot-row.empty')) _otOpen(nx, i + 1);
  // 다시 그려질 때까지 이 칸은 넣은 이름으로 보여 준다
  if (li) li.innerHTML = `<div class="sb-ot-row fr-ot-added"><span class="n"><i>${i + 1}</i></span><span class="nm">${esc(nm)}</span><span class="ls"></span><span class="mk"></span></div>`;
  _otAdd(nm);
  if (!document.querySelector('#sbOrder .fr-ot-in')) _otEnd();
}
function _otInit() {
  const box = $('sbOrder');
  if (!box || box._fr) return;
  box._fr = true;
  // 캡처 단계: 빈 행 버튼의 onclick(라인업 서랍)보다 먼저
  box.addEventListener('click', e => {
    const b = e.target.closest('button.sb-ot-row.empty');
    if (!b) return;
    e.stopPropagation();
    e.preventDefault();
    // 타순은 비울 수 없으므로(addPlayer 는 맨 뒤에 붙임) 어느 빈 행을 눌러도 첫 빈 행에서 입력
    const lis = box.querySelectorAll('.sb-ot > li'), i = Math.min(_lineup().length, lis.length - 1);
    if (lis[i] && lis[i].querySelector('button.sb-ot-row.empty')) _otOpen(lis[i], i);
  }, true);
  box.addEventListener('keydown', e => {
    const inp = e.target;
    if (!inp.classList || !inp.classList.contains('fr-ot-in')) return;
    if (e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter 는 글자 확정용
    if (e.key === 'Enter') { e.preventDefault(); _otCommit(inp, true); }
    else if (e.key === 'Escape') { e.stopPropagation(); inp.dataset.done = '1'; _otEnd(); }
  });
  // 다른 곳을 누르면: 쓴 이름이 있으면 추가하고 끝
  box.addEventListener('focusout', e => {
    const inp = e.target;
    if (inp.classList && inp.classList.contains('fr-ot-in') && !inp.dataset.done) _otCommit(inp, false);
  });
}

// ── ③-b 첫 실행 배너: 저장된 라인업이 하나도 없으면 필드 카드 위에 "라인업을 먼저 만들까요?" ──
// [라인업 만들기] = 경기설정 탭 타순표 첫 빈칸 · [닫기] = 다시 안 띄움 (새 키 sl_lineup_banner_closed 하나)
const LU_KEY = 'sl_lineup_banner_closed';
const X_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function _luWanted() {
  try { if (localStorage.getItem(LU_KEY)) return false; } catch (e) { return false; }
  if (window.slSample && window.slSample.isOn && window.slSample.isOn()) return false;
  const A = _AS();
  if ((A.home_lineup || []).length || (A.away_lineup || []).length) return false;   // 지금 경기(복구 · 마지막 경기 포함)에 라인업이 있음
  try { const s = JSON.parse(localStorage.getItem('sl_saves') || '[]'); if (Array.isArray(s) && s.length) return false; } catch (e) {}   // 저장한 경기가 있음
  return true;
}
function _luResize() {
  // 모바일: 필드 크기는 필드 위 요소 높이를 빼서 잰다 → 배너가 생기거나 없어지면 다시 계산
  if (window.innerWidth <= 720) requestAnimationFrame(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) {} });
}
function _luSync() {
  const want = _luWanted();
  let el = $('frLuBanner');
  if (!want) { if (el) { el.remove(); _luResize(); } return; }
  if (el) return;
  const card = $('sbField');
  if (!card) return;
  card.insertAdjacentHTML('beforebegin', `<div class="fr-lu" id="frLuBanner" role="region" aria-label="라인업 안내">`
    + `<p>라인업을 먼저 만들까요?</p>`
    + `<button type="button" class="fr-lu-go">라인업 만들기</button>`
    + `<button type="button" class="fr-lu-x" aria-label="라인업 안내 닫기 (다시 안 보임)">${X_ICON}</button></div>`);
  el = $('frLuBanner');
  el.querySelector('.fr-lu-go').addEventListener('click', () => {
    if (window.shellNav) window.shellNav('settings');
    requestAnimationFrame(() => {
      const f = document.querySelector('#stLu .st-row.empty .st-in.nm');
      if (!f) return;
      if (f.scrollIntoView) f.scrollIntoView({ block: 'center' });
      f.focus({ preventScroll: true });
    });
  });
  el.querySelector('.fr-lu-x').addEventListener('click', () => {
    try { localStorage.setItem(LU_KEY, '1'); } catch (e) {}
    _luSync();
  });
  _luResize();
}
function _luInit() {
  // 라인업이 바뀌는 길(선수 추가 · 삭제 · 팀 전환 · 경기 불러오기 · 새 경기)은 모두 renderLP 를 부른다
  const orig = window.renderLP;
  if (typeof orig === 'function' && !orig._fr) {
    const w = function () { const r = orig.apply(this, arguments); try { _luSync(); } catch (e) {} return r; };
    w._fr = true;
    window.renderLP = w;
  }
  _luSync();
}

function _init() {
  _hookFieldTap();
  _pkInit();
  _toastInit();
  _otInit();
  _luInit();
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_init, 0));
  else setTimeout(_init, 0);
}
