// 경기설정 탭 — 경기 정보 · 데이터 · 타순표 편집 · 구장 규격
//   경기 정보(AS.info = { date, venue, side, innings }): 저장 경기·자동저장에 함께 저장 (없던 옛 경기는 기본값)
//   구장: 기존 STADIUMS 4개 + 리틀야구(61·70·61) + 직접 입력(sl_stadium_custom) — 거리를 바꾸면 기록 필드 펜스와 추정 비거리(ft)에 반영
//   버튼은 기존 함수(core.js · shell.js · cloud.js)를 그대로 부른다
import { esc } from '../constants.js';

const $ = id => document.getElementById(id);
const _AS = () => window.AS || {};
const _gfOn = () => typeof GF !== 'undefined' && GF && GF.active;

// ── 구장 ─────────────────────────────────────────────────────
const CUSTOM_KEY = 'sl_stadium_custom';
const PRESETS = [
  ['standard', '사회인야구 표준'], ['little', '리틀야구'], ['gochuk', '고척'], ['jamsil', '잠실'], ['local', '지방'], ['custom', '직접 입력'],
];
function _customDist() {
  try { const c = JSON.parse(localStorage.getItem(CUSTOM_KEY)); if (c && c.lf && c.cf && c.rf) return c; } catch (e) {}
  return { lf: 90, cf: 120, rf: 90 };
}
function _extendStadiums() {
  const S = window.STADIUMS;
  if (!S) return;
  const b = S.standard || {};
  // 리틀야구: 베이스 60ft(18.29m) · 투수판 46ft(14.02m) — 필드 그림의 내야 크기에만 쓰임
  if (!S.little) S.little = { name: '리틀', emoji: '', cfDist: 70, lfDist: 61, rfDist: 61, grass: b.grass, dirt: b.dirt, if: b.if, dome: false, base: 18.29, mound: 14.02 };
  const c = _customDist();
  S.custom = Object.assign(S.custom || {}, { name: '직접', emoji: '', cfDist: c.cf, lfDist: c.lf, rfDist: c.rf, grass: b.grass, dirt: b.dirt, if: b.if, dome: false });
}
if (typeof window !== 'undefined') _extendStadiums();   // 모듈을 읽자마자 (저장된 구장이 little/custom이면 첫 그림부터 맞게)

function _st() { const S = window.STADIUMS || {}; return S[_AS().stadium] || S.standard || { lfDist: 90, cfDist: 120, rfDist: 90 }; }

function stPickStadium(id) {
  if (window.setStadium) window.setStadium(id);
  render();
}
function stSetDist(k, v) {
  const st = _st();
  const c = { lf: st.lfDist, cf: st.cfDist, rf: st.rfDist };
  const n = Math.round(Number(v));
  if (!isFinite(n) || n <= 0) { render(); return; }
  c[k] = Math.max(30, Math.min(200, n));
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(c)); } catch (e) {}
  _extendStadiums();
  stPickStadium('custom');
}

// 작은 필드 미리보기 (SVG) — 기록 필드와 같은 기하(_fieldGeo · _fenceR)
function _preview() {
  if (typeof _fieldGeo !== 'function') return '';
  const g = _fieldGeo(100), Q = _FQ, P = (ph, r) => _conePt(g, ph, r), F = ph => _fenceR(g, ph), st = g.st;
  const xy = p => p[0].toFixed(1) + ',' + p[1].toFixed(1);
  const arc = (off, rev) => { const o = []; for (let i = 0; i <= 36; i++) { const ph = rev ? 3 * Q - 2 * Q * i / 36 : Q + 2 * Q * i / 36; o.push(xy(P(ph, F(ph) - off))); } return o.join(' '); };
  const home = xy([g.cx, g.cy]);
  const m = g.m, bm = (st.base || 27.43) * m, md = P(2 * Q, (st.mound || 18.44) * m);
  const b1 = P(3 * Q, bm), b2 = P(2 * Q, bm * Math.SQRT2), b3 = P(Q, bm);
  const lbl = (ph, k, t) => { const p = P(ph, F(ph) * k); return `<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}">${t}</text>`; };
  return `<svg class="st-prev-svg" viewBox="0 0 100 100" role="img" aria-label="필드 미리보기: 좌 ${st.lfDist}m · 중 ${st.cfDist}m · 우 ${st.rfDist}m">
    <polygon class="g" points="${home} ${arc(0)}"/>
    <polygon class="w" points="${arc(0)} ${arc(2.2, true)}"/>
    <circle class="d" cx="${md[0].toFixed(1)}" cy="${md[1].toFixed(1)}" r="${(29 * (st.base || 27.43) / 27.43 * m).toFixed(1)}" clip-path="url(#stPrevClip)"/>
    <clipPath id="stPrevClip"><polygon points="${home} ${arc(0)}"/></clipPath>
    <polygon class="ig" points="${home} ${xy(b1)} ${xy(b2)} ${xy(b3)}"/>
    <polyline class="f" points="${arc(0)}"/>
    <polyline class="l" points="${xy(P(Q, F(Q)))} ${home} ${xy(P(3 * Q, F(3 * Q)))}"/>
    ${lbl(Q + 0.12, 0.8, st.lfDist)}${lbl(2 * Q, 0.8, st.cfDist)}${lbl(3 * Q - 0.12, 0.8, st.rfDist)}
  </svg>`;
}

// ── 경기 정보 ────────────────────────────────────────────────
function _today() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function gameInfo() { return Object.assign({ date: '', venue: '', side: 'home', innings: 9 }, _AS().info || {}); }
function stSetInfo(k, v) {
  const A = _AS();
  const i = gameInfo();
  if (k === 'innings') v = [5, 7, 9].indexOf(+v) >= 0 ? +v : 9;
  if (k === 'side') v = v === 'away' ? 'away' : 'home';
  if (k === 'venue') v = String(v || '').trim().slice(0, 20);
  i[k] = v;
  if (!i.date) i.date = _today();
  A.info = i;
  // 저장 안 됨 표시 · 자동저장 · 라인스코어 다시 그림은 기존 updateAll 흐름으로
  try { if (window.updateAll) window.updateAll(); } catch (e) {}
  render();
}
function stTeamName(which, v) { if (window.shellTeamName) window.shellTeamName(which, v); }

// ── 타순표 편집 ──────────────────────────────────────────────
let _extra = 0;   // [지명타자 · 대타 추가]로 늘린 빈 행 수
const _lineup = () => { try { return (window.getActiveLineup && window.getActiveLineup()) || []; } catch (e) { return []; } };
const _find = id => _lineup().find(p => String(p.id) === String(id));
const _refreshLineup = () => { try { if (window.renderLP) window.renderLP(); if (window.renderMob) window.renderMob(); } catch (e) {} };

function stEdit(id, f, v) {
  const p = _find(id);
  if (!p) return;
  if (f === 'name') {
    // 기존 renamePlayer와 같은 처리: 이미 기록된 타석의 이름도 함께 바꿈 (비우면 원래 이름 유지)
    const nm = String(v || '').trim().slice(0, 8);
    if (!nm || nm === p.name) { render(); return; }
    p.name = nm;
    const A = _AS();
    (A.abs || []).forEach(a => { if (String(a.bid) === String(id)) a.bname = nm; });
    _refreshLineup();
    try { if (window.updateAll) window.updateAll(); } catch (e) {}
  } else if (f === 'pos') {
    p.pos = String(v || '').trim().slice(0, 4);
    _refreshLineup();
  } else if (f === 'bh') {
    p.bh = ['R', 'L', 'S'].indexOf(v) >= 0 ? v : '';
    _refreshLineup();
  }
  render();
}
// 빈 행에 이름을 쓰면 선수 추가 (기존 addPlayer 입력칸을 채워서 그대로 호출)
function stAdd(v, pos, bh) {
  const nm = String(v || '').trim().slice(0, 10);
  if (!nm) return;
  const n = $('pName'), num = $('pNum');
  if (!n || !window.addPlayer) return;
  n.value = nm;
  if (num) num.value = '';
  window.addPlayer();
  const lu = _lineup(), p = lu[lu.length - 1];
  if (p && p.name === nm) { if (pos) p.pos = pos; if (bh) p.bh = bh; }
  if (_extra > 0 && lu.length > 9) _extra = Math.max(0, _extra - 1);
  _refreshLineup();
  render();
  // 다음 빈 행으로 바로 이어서 입력
  requestAnimationFrame(() => { const e = document.querySelector('#stLu .st-row.empty .st-in.nm'); if (e) e.focus(); });
}
function stAddExtra() {
  _extra++;
  render();
  requestAnimationFrame(() => { const e = document.querySelectorAll('#stLu .st-row.empty .st-in.nm'); if (e.length) e[e.length - 1].focus(); });
}
function stTeam(t) {
  // 입력칸에 포커스가 남아 있으면 render가 타순표를 건너뛰므로(입력 보호) 팀을 바꿀 땐 먼저 풀어 줌
  const a = document.activeElement;
  if (a && a.closest && a.closest('#stLu') && a.blur) a.blur();
  if (window.swLineupTab) window.swLineupTab(t);
  render();
}

// 순서 바꾸기 (기존 dropPlayer와 같은 배열 이동)
function _move(fromId, toIdx) {
  const lu = _lineup();
  const fi = lu.findIndex(p => String(p.id) === String(fromId));
  if (fi < 0) return;
  toIdx = Math.max(0, Math.min(lu.length - 1, toIdx));
  if (fi === toIdx) return;
  const m = lu.splice(fi, 1)[0];
  lu.splice(toIdx, 0, m);
  _refreshLineup();
  render();
}
function _dragInit() {
  const box = $('stLu');
  if (!box || box._drag) return;
  box._drag = true;
  let drag = null;
  box.addEventListener('pointerdown', e => {
    const h = e.target.closest('.st-drag');
    if (!h) return;
    const row = h.closest('.st-row');
    if (!row || !row.dataset.id) return;
    e.preventDefault();
    h.setPointerCapture(e.pointerId);
    drag = { id: row.dataset.id, h, to: null };
    row.classList.add('dragging');
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el && el.closest && el.closest('#stLu .st-row[data-id]');
    box.querySelectorAll('.drop-to').forEach(r => r.classList.remove('drop-to'));
    if (row) { row.classList.add('drop-to'); drag.to = +row.dataset.i; }
  });
  const end = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    box.querySelectorAll('.drop-to, .dragging').forEach(r => r.classList.remove('drop-to', 'dragging'));
    if (d.to != null) _move(d.id, d.to);
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  // 키보드: 핸들에서 ↑ ↓
  box.addEventListener('keydown', e => {
    const h = e.target.closest('.st-drag');
    if (!h || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const row = h.closest('.st-row');
    const i = +row.dataset.i + (e.key === 'ArrowUp' ? -1 : 1);
    _move(row.dataset.id, i);
    requestAnimationFrame(() => { const r = document.querySelector(`#stLu .st-row[data-i="${Math.max(0, Math.min(_lineup().length - 1, i))}"] .st-drag`); if (r) r.focus(); });
  });
  // 입력: 이름은 Enter/포커스 이탈, 포지션·타석은 change
  box.addEventListener('change', e => {
    const inp = e.target.closest('.st-in');
    if (!inp) return;
    const row = inp.closest('.st-row');
    if (row.dataset.id) stEdit(row.dataset.id, inp.dataset.f, inp.value);
    else if (inp.dataset.f === 'name') stAdd(inp.value, (row.querySelector('.st-in.pos') || {}).value, (row.querySelector('.st-in.bh') || {}).value);
  });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.st-in')) e.target.blur(); });
}

const ICON = {
  grip: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  load: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 7h6l2 2h10v10H3z"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M7 5v14l12-7z"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20V8M7 13l5-5 5 5M5 4h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
};

// ── 렌더 ─────────────────────────────────────────────────────
function _hdrHtml() {
  return `<div class="ad-hd"><h1 class="ad-title">경기 설정</h1></div>
    <div class="st-hbtn">
      <button type="button" class="sb-mini" onclick="openLoad()">${ICON.load}지난 경기 불러오기</button>
      <button type="button" class="sb-mini st-go" onclick="stSaveAndStart()">${ICON.play}저장하고 기록 시작</button>
    </div>`;
}

function _infoHtml() {
  const i = gameInfo();
  const th = (($('tHome') || {}).value || '').trim(), ta = (($('tAway') || {}).value || '').trim();
  const gf = _gfOn();
  return `<header class="sb-card-hd"><h2>경기 정보</h2></header>
    <div class="st-form">
      <label class="st-f"><span>DATE · 날짜</span><input type="date" class="st-u" value="${esc(i.date || _today())}" onchange="stSetInfo('date',this.value)"></label>
      <label class="st-f"><span>BALLPARK · 구장</span><input type="text" class="st-u" value="${esc(i.venue)}" maxlength="20" placeholder="예: 목동 보조구장" onchange="stSetInfo('venue',this.value)"></label>
      <div class="st-2">
        <label class="st-f"><span>MY TEAM · 내 팀</span><input type="text" class="st-u" value="${esc(th)}" maxlength="6" placeholder="내 팀" oninput="stTeamName('home',this.value)"></label>
        <label class="st-f"><span>OPPONENT · 상대팀</span><input type="text" class="st-u" value="${esc(ta)}" maxlength="6" placeholder="원정팀" oninput="stTeamName('away',this.value)"></label>
      </div>
      <fieldset class="st-f st-side"><legend>HOME / AWAY · 내 팀은</legend>
        <label><input type="radio" name="stSide" value="home"${i.side !== 'away' ? ' checked' : ''} onchange="stSetInfo('side','home')">홈 <small>(말 공격)</small></label>
        <label><input type="radio" name="stSide" value="away"${i.side === 'away' ? ' checked' : ''} onchange="stSetInfo('side','away')">원정 <small>(초 공격)</small></label>
      </fieldset>
      <div class="st-f"><span id="stInnLbl">INNINGS · 이닝</span>
        <div class="sb-seg st-inn" role="group" aria-labelledby="stInnLbl">${[5, 7, 9].map(n => `<button type="button" aria-pressed="${i.innings === n}" onclick="stSetInfo('innings',${n})">${n}회</button>`).join('')}</div>
      </div>
    </div>
    <div class="st-gf">
      <button type="button" class="sb-btn${gf ? ' on' : ''}" onclick="stGf()">${gf ? '경기 운영 끄기' : '경기 운영 시작'}</button>
      ${gf ? '<button type="button" class="sb-btn st-danger" onclick="gfEndConfirm()">경기 종료</button>' : ''}
      <p>경기 운영을 켜면 타순·아웃·이닝·주자가 자동으로 넘어갑니다. (자동 진행은 내 팀이 초 공격이라고 가정)</p>
    </div>`;
}

function _kb() {
  let n = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('sl_') === 0) n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) {}
  const kb = n * 2 / 1024;
  return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(kb)) + ' KB';
}
function _dataHtml() {
  const logged = !!(window._cloudIsLoggedIn && window._cloudIsLoggedIn());
  const sync = (($('saveInd') || {}).textContent || '').trim();
  let saves = 0;
  try { saves = JSON.parse(localStorage.getItem('sl_saves') || '[]').length; } catch (e) {}
  return `<header class="sb-card-hd"><h2>데이터</h2></header>
    <div class="st-data">
      <p class="st-note">기록은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우거나 기기를 바꾸면 사라지니 백업 파일을 내보내 두세요.</p>
      <p class="st-meta">저장된 경기 ${saves}개 · 사용량 약 ${_kb()}</p>
      <p class="st-sync"><b>동기화</b>${logged ? `로그인됨 · ${esc(sync || '대기 중')}` : '로그인 안 함 · 이 기기에만 저장'}<button type="button" class="sb-mini" onclick="openCloudOverlay()">클라우드</button></p>
      <div class="st-2b">
        <button type="button" class="sb-btn" onclick="exportAllGames()">${ICON.down}백업 내보내기</button>
        <label class="sb-btn st-file">${ICON.up}백업 불러오기<input type="file" accept=".json,.spray,text/plain" onchange="importGames(this)" aria-label="백업 파일 선택"></label>
      </div>
      <button type="button" class="sb-btn st-danger" onclick="clearAll()">${ICON.trash}이 경기 기록 지우기</button>
    </div>`;
}

function _luHtml() {
  const A = _AS(), lu = _lineup(), team = A.curTeam === 'away' ? 'away' : 'home';
  const th = (($('tHome') || {}).value || '').trim() || '내 팀', ta = (($('tAway') || {}).value || '').trim() || '원정팀';
  const n = Math.max(9, lu.length) + _extra;
  const bhSel = (v, lbl) => `<select class="st-in bh" data-f="bh" aria-label="${lbl} 타석 방향"><option value=""${!v ? ' selected' : ''}>—</option><option value="R"${v === 'R' ? ' selected' : ''}>우타</option><option value="L"${v === 'L' ? ' selected' : ''}>좌타</option><option value="S"${v === 'S' ? ' selected' : ''}>양타</option></select>`;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const p = lu[i];
    const lbl = `${i + 1}번`;
    rows.push(p
      ? `<li class="st-row${p.isStarter === false ? ' bench' : ''}" data-id="${esc(String(p.id))}" data-i="${i}"><span class="n">${i + 1}</span>
          <input class="st-in nm" data-f="name" value="${esc(p.name)}" maxlength="8" aria-label="${lbl} 이름">
          <input class="st-in pos" data-f="pos" value="${esc(p.pos || '')}" maxlength="4" list="stPosList" placeholder="POS" aria-label="${lbl} 포지션">
          ${bhSel(p.bh, lbl)}
          <button type="button" class="st-drag" aria-label="${lbl} ${esc(p.name)} 순서 바꾸기 (끌거나 ↑↓ 키)">${ICON.grip}</button></li>`
      : `<li class="st-row empty"><span class="n">${i + 1}</span>
          <input class="st-in nm" data-f="name" value="" maxlength="8" placeholder="이름" aria-label="${lbl} 이름 (입력하면 추가)">
          <input class="st-in pos" data-f="pos" value="" maxlength="4" list="stPosList" placeholder="POS" aria-label="${lbl} 포지션">
          ${bhSel('', lbl)}
          <span class="st-drag ph" aria-hidden="true"></span></li>`);
  }
  return `<header class="sb-card-hd"><h2>타순표</h2>
      <div class="sb-seg" role="group" aria-label="편집할 팀">
        <button type="button" aria-pressed="${team === 'home'}" onclick="stTeam('home')">${esc(th)}</button>
        <button type="button" aria-pressed="${team === 'away'}" onclick="stTeam('away')">${esc(ta)}</button>
      </div></header>
    <div class="st-lu-h" aria-hidden="true"><span>타순</span><span>이름</span><span>POS</span><span>타석</span><span></span></div>
    <ol class="st-lu-list">${rows.join('')}</ol>
    <datalist id="stPosList">${['투수', '포수', '1루', '2루', '3루', '유격', '좌익', '중견', '우익', 'DH'].map(x => `<option value="${x}">`).join('')}</datalist>
    <footer class="st-lu-ft">
      <button type="button" class="sb-btn" onclick="stAddExtra()">＋ 지명타자 · 대타 추가</button>
      <button type="button" class="sb-mini" onclick="shellDrawer(true)">삭제 · 후보 · 등번호</button>
    </footer>`;
}

function _stadHtml() {
  const cur = _AS().stadium || 'standard', S = window.STADIUMS || {}, st = _st();
  const item = ([id, l]) => {
    const s = S[id] || {};
    const d = s.lfDist ? `${s.lfDist}·${s.cfDist}·${s.rfDist}` : '';
    return `<button type="button" role="radio" aria-checked="${cur === id}" class="st-pre${cur === id ? ' on' : ''}" onclick="stPickStadium('${id}')"><b>${l}</b><span>${d}</span></button>`;
  };
  const inp = (k, l, v) => `<label class="st-d"><span>${l}</span><input type="number" inputmode="numeric" min="30" max="200" step="1" value="${v}" onchange="stSetDist('${k}',this.value)" aria-label="${l} 펜스 거리 (미터)"><em>m</em></label>`;
  return `<header class="sb-card-hd"><h2>구장 규격</h2></header>
    <div class="st-pres" role="radiogroup" aria-label="구장 규격">${PRESETS.map(item).join('')}</div>
    <div class="st-prev">${_preview()}</div>
    <div class="st-dists">${inp('lf', 'LF', st.lfDist)}${inp('cf', 'CF', st.cfDist)}${inp('rf', 'RF', st.rfDist)}</div>
    <p class="st-note">거리를 바꾸면 '직접 입력'으로 저장되고, 기록 탭 필드 펜스와 타구 추정 비거리에 바로 반영됩니다. 홈런 여부는 기록할 때 직접 고릅니다.</p>`;
}

// 그 밖의 기능: 버튼마다 붙이는 선 아이콘 (24×24, stroke)
const MORE_ICON = {
  newGame: '<path d="M12 5v14M5 12h14"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  recent: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  lastLu: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5M9 11h6M9 15h4"/>',
  photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.9-4-5.7"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4"/>',
  spray: '<path d="M12 20L3.5 11.5a12 12 0 0 1 17 0z"/><circle cx="9" cy="10.5" r=".9" fill="currentColor"/><circle cx="13.5" cy="8.5" r=".9" fill="currentColor"/><circle cx="15" cy="12.5" r=".9" fill="currentColor"/>',
  card: '<rect x="3" y="4" width="18" height="16"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-10 10"/>',
  excel: '<rect x="3" y="4" width="18" height="16"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
  feedback: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  home: '<path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5"/>',
};

function _moreHtml() {
  const ico = k => `<i class="st-more-i" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${MORE_ICON[k]}</svg></i>`;
  const b = (fn, t, s, k) => `<button type="button" class="st-more-b" onclick="${fn}">${ico(k)}<span class="st-more-t"><b>${t}</b><small>${s}</small></span></button>`;
  return `<header class="sb-card-hd"><h2>그 밖의 기능</h2></header>
    <div class="st-more">
      <div><h3>경기</h3>${b('openGameWizard()', '새 경기 시작', '팀 이름 · 라인업 새로', 'newGame')}${b('showSaveSheet()', '경기 저장', '불러오기 목록 · 클라우드', 'save')}${b('showPostGameReport()', '경기 리포트', '이번 경기 요약', 'report')}${b("shellNav('record');shellRecSheet(true)", '최근 기록', '수정 · 삭제', 'recent')}</div>
      <div><h3>라인업 · 팀</h3>${b('applyLastLineup()', '지난 경기 라인업', '그대로 가져오기', 'lastLu')}${b('ocrModalOpen()', '사진 / CSV로 입력', '라인업 한 번에', 'photo')}${b('openTeamCreate()', '팀 만들기', '팀원과 기록 공유', 'team')}</div>
      <div><h3>내보내기 · 공유</h3>${b('shareGameLink()', '경기 공유', 'QR · 링크', 'share')}${b('exportSprayPNG()', '스프레이차트 PNG', '필드 이미지', 'spray')}${b('exportShareCard()', '성적 카드 이미지', 'SNS 공유용', 'card')}${b('exportCurrentGameToExcel()', '엑셀 내보내기', '이번 경기 타석 전체', 'excel')}</div>
      <div><h3>데이터 · 도움말</h3>${b("openOverlay('dataSettingsOverlay')", '데이터 관리', '가져오기 · 전체 내보내기', 'data')}${b('showHelpMenu()', '사용 방법', '기능 안내', 'help')}${b('fieldFeedbackOpen()', '피드백 보내기', '버그 · 제안', 'feedback')}${b('goLanding()', '처음 화면으로', '기록은 그대로 유지', 'home')}</div>
    </div>`;
}

function _mount() {
  const v = $('settingsView');
  if (!v) return null;
  let box = $('stNew');
  if (!box) {
    box = document.createElement('div');
    box.id = 'stNew';
    box.className = 'stx';
    box.innerHTML = `<div class="stx-grid">
        <div class="stx-l"><section class="sb-card" id="stInfo" aria-label="경기 정보"></section><section class="sb-card" id="stData" aria-label="데이터"></section></div>
        <section class="sb-card stx-c" id="stLu" aria-label="타순표"></section>
        <section class="sb-card stx-r" id="stStad" aria-label="구장 규격"></section>
      </div>
      <section class="sb-card stx-more" id="stMore" aria-label="그 밖의 기능"></section>`;
    const old = v.querySelector('.shell-inner.st');
    if (old) old.before(box); else v.appendChild(box);
  }
  return box;
}

export function render() {
  if (!_mount()) return;
  const mid = document.querySelector('#settingsView .sb-vhdr .sb-hdr-mid');
  if (mid && !mid.querySelector('.st-hbtn')) mid.innerHTML = _hdrHtml();
  // 입력 중인 칸은 다시 그리지 않음 (타순표만 예외 처리: 포커스가 있으면 그 카드는 건너뜀)
  const act = document.activeElement;
  const busy = id => act && $(id) && $(id).contains(act) && act.matches('input, select');
  const set = (id, html) => { const el = $(id); if (el && !busy(id)) el.innerHTML = html; };
  set('stInfo', _infoHtml());
  set('stData', _dataHtml());
  set('stLu', _luHtml());
  set('stStad', _stadHtml());
  const more = $('stMore');
  if (more && !more.innerHTML) more.innerHTML = _moreHtml();
  _dragInit();
}

// ── 버튼 ─────────────────────────────────────────────────────
// 저장하고 기록 시작: 기존 saveGame (저장 뒤 요약창 대신 기록 탭으로 — 새 경기 저장 확인과 같은 _afterSaveCb)
function stSaveAndStart() {
  if (typeof window.saveGame !== 'function') { if (window.shellNav) window.shellNav('record'); return; }
  window._afterSaveCb = function () { if (window.shellNav) window.shellNav('record'); };
  window.saveGame();
}
function stGf() { if (window.shellGfToggle) window.shellGfToggle(); render(); }

// ── 연결 ─────────────────────────────────────────────────────
function _hook() {
  // 자동저장(복구용 sl_autosave)에 경기 정보도 함께 · 복구할 때 되살림 (core의 GF 상태 저장과 같은 방식)
  if (typeof storageManager !== 'undefined' && storageManager && !storageManager._stInfo) {
    const orig = storageManager.scheduleAutosave.bind(storageManager);
    storageManager.scheduleAutosave = function (data, delay) { return orig(Object.assign({}, data, { info: _AS().info || null }), delay); };
    storageManager._stInfo = true;
  }
  const rec = window.archRecoverAutosave;
  if (typeof rec === 'function' && !rec._st) {
    const w = function () {
      let info = null;
      try { const r = storageManager.getRecovery(); info = r && r.data ? r.data.info || null : null; } catch (e) {}
      const out = rec.apply(this, arguments);
      if (info) { _AS().info = info; try { if (window.sbRender) window.sbRender(); } catch (e) {} }
      return out;
    };
    w._st = true;
    window.archRecoverAutosave = w;
  }
  // 새 경기: 경기 정보 초기화 (이닝 수는 리그 규칙이라 이어서 씀)
  const sw = window.startFromWizard;
  if (typeof sw === 'function' && !sw._st) {
    const w = function () {
      const inn = gameInfo().innings;
      const out = sw.apply(this, arguments);
      _AS().info = inn !== 9 ? { innings: inn } : null;
      return out;
    };
    w._st = true;
    window.startFromWizard = w;
  }
  // 경기설정 탭이 열릴 때 · 데이터가 바뀔 때 다시 그림
  const view = $('settingsView');
  if (view && window.MutationObserver) new MutationObserver(() => { if (view.classList.contains('active')) render(); }).observe(view, { attributes: true, attributeFilter: ['class'] });
  ['updateAll', 'renderLP', 'swLineupTab', 'setStadium'].forEach(fn => {
    const o = window[fn];
    if (typeof o !== 'function' || o._st) return;
    const w = function () { const r = o.apply(this, arguments); if (view && view.classList.contains('active')) _later(); return r; };
    w._st = true;
    window[fn] = w;
  });
  // 저장 상태 표시(#saveInd) 바뀌면 데이터 칸 갱신
  const ind = $('saveInd');
  if (ind && window.MutationObserver) new MutationObserver(() => { if (view && view.classList.contains('active')) { const d = $('stData'); if (d) d.innerHTML = _dataHtml(); } }).observe(ind, { childList: true, characterData: true, subtree: true });
}
let _t = 0;
function _later() { clearTimeout(_t); _t = setTimeout(render, 30); }

function _init() {
  _extendStadiums();
  _hook();
  // 앱 시작 때 core가 자동저장을 먼저 되살렸으면(_openLastGame) 경기 정보만 이어 붙임 — 같은 경기(타석 수 같음)일 때만
  try {
    const A = _AS(), r = storageManager.getRecovery(), d = r && r.data;
    if (!A.info && d && d.info && (d.abs || []).length === (A.abs || []).length) A.info = d.info;
  } catch (e) {}
  // 저장된 구장이 리틀/직접이면 확장 뒤 다시 그림
  try { if (window.drawField) window.drawField(); if (window.safeRender) window.safeRender(); } catch (e) {}
  render();
}

if (typeof window !== 'undefined') {
  window.gameInfo = gameInfo;
  window.stSetInfo = stSetInfo;
  window.stTeamName = stTeamName;
  window.stTeam = stTeam;
  window.stAddExtra = stAddExtra;
  window.stPickStadium = stPickStadium;
  window.stSetDist = stSetDist;
  window.stSaveAndStart = stSaveAndStart;
  window.stGf = stGf;
  window.renderSetup = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_init, 0));
  else setTimeout(_init, 0);
}
