// 경기설정 탭 — 경기 정보 · 데이터 · 타순표 편집 · 구장 규격
//   경기 정보(AS.info = { date, venue, side, innings }): 저장 경기·자동저장에 함께 저장 (없던 옛 경기는 기본값)
//   구장: 기존 STADIUMS 4개 + 리틀야구(61·70·61) + 직접 입력(sl_stadium_custom) — 거리를 바꾸면 기록 필드 펜스와 추정 비거리(ft)에 반영
//         새 사용자 기본값 = 리틀야구 · 경기마다 구장을 경기 정보(info.stadium)에 저장하고 불러올 때 되살림
//   버튼은 기존 함수(core.js · shell.js · cloud.js)를 그대로 부른다
import { esc } from '../constants.js';

const $ = id => document.getElementById(id);
const _AS = () => window.AS || {};
// 안내 모드(core.js _helpModeClick): [data-help]를 누르면 동작 대신 설명 — 기록 탭처럼 경기설정 탭에도 붙임 (문구는 고정 문자열만)
const H = (t, d) => ` data-help-title="${t}" data-help="${d}"`;
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

// 구장 기본값: 구장을 고른 적 없는(sl_stadium 없음) 새 사용자는 리틀야구(61·70·61).
//   이미 쓰던 사용자(core _isReturningUser — 첫 기록을 했거나 저장 경기가 있음)는 지금처럼 표준(core 기본값 그대로).
//   새 사용자로 판단하면 setStadium 으로 sl_stadium 에 'little'을 남긴다 — 안 남기면 첫 기록 뒤 '쓰던 사용자'가 되어 다음 실행에 표준으로 바뀐다
function _defaultStadium() {
  try { if (localStorage.getItem('sl_stadium')) return; } catch (e) { return; }
  if (typeof _isReturningUser !== 'function' || _isReturningUser()) return;
  if (window.setStadium) window.setStadium('little');
}
// 경기별 구장: 경기 정보(AS.info)에 stadium(구장 id)을 함께 둔다 — info 는 이미 저장 경기 · 자동저장에 들어가고 불러올 때 되살아난다
//   · 구장을 바꾸면 info.stadium 도 바꿈 · 저장/자동저장 직전에 비어 있으면 지금 구장으로 채움 (불러온 경기 값은 덮지 않음)
//   · 불러온 경기에 stadium 이 있으면 그 구장으로, 없으면(이 기능 전에 저장한 경기) 지금 구장 그대로
//   · 직접 입력(custom)은 id 만 저장 — 거리는 그때의 직접 입력값(sl_stadium_custom)
function _stadiumOk(id) { const S = window.STADIUMS; return typeof id === 'string' && !!S && Object.prototype.hasOwnProperty.call(S, id); }
function _infoStadium(id) {
  const A = _AS();
  if (id === undefined && A.info && A.info.stadium) return;
  const s = id === undefined ? A.stadium : id;
  if (_stadiumOk(s)) A.info = Object.assign({}, A.info || {}, { stadium: s });
}
function _applyInfoStadium() {
  const A = _AS(), id = A.info && A.info.stadium;
  if (_stadiumOk(id) && id !== A.stadium && window.setStadium) window.setStadium(id);
}
// 공유 링크로 받은 직접 입력 구장(info.stadium 'custom' + info.dist { lf, cf, rf } — core.js 가 30~200 정수로 걸러 둠):
// 이 기기의 직접 입력 거리를 그 값으로 바꾸고 알린다(정한 것 2026-10-18 — 기기마다 하나뿐이라 받는 쪽 값은 덮어쓴다).
// 알림은 공유 경기를 연 안내(core.js loadSharedGame 이 500ms 뒤에 띄움) 다음에, 그 안내를 지우지 않고 뒤에 이어 붙인다. 이미 같은 거리면 아무것도 안 한다
function _applySharedDist() {
  const A = _AS(), i = A.info || {}, d = i.dist, cur = _customDist();
  if (i.stadium !== 'custom' || !d || (cur.lf === d.lf && cur.cf === d.cf && cur.rf === d.rf)) return;
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify({ lf: d.lf, cf: d.cf, rf: d.rf })); } catch (e) {}
  _extendStadiums();
  if (A.stadium === 'custom' && window.setStadium) window.setStadium('custom');   // 이미 직접 입력이면 _applyInfoStadium 이 건너뛰므로 여기서 다시 그림
  setTimeout(() => {
    const t = $('toast'), prev = t && t.classList.contains('show') ? (($('toastTxt') || {}).textContent || '') : '';
    if (window.showToast) window.showToast((prev ? prev + ' · ' : '') + `직접 입력 구장 거리를 좌 ${d.lf} · 중 ${d.cf} · 우 ${d.rf}m로 바꿨어요`, false, 8000);
  }, 600);
}

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
      <button type="button" class="sb-mini" onclick="openLoad()"${H('지난 경기 불러오기', '이 기기에 저장한 경기 목록을 열어 <b>이어서 기록</b>하거나 다시 봅니다.')}>${ICON.load}지난 경기 불러오기</button>
      <button type="button" class="sb-mini st-go" onclick="stSaveAndStart()"${H('저장하고 기록 시작', '지금 경기를 <b>저장</b>하고 <b>기록 탭</b>으로 넘어갑니다.')}>${ICON.play}저장하고 기록 시작</button>
    </div>`;
}

function _infoHtml() {
  const i = gameInfo();
  const th = (($('tHome') || {}).value || '').trim(), ta = (($('tAway') || {}).value || '').trim();
  const gf = _gfOn();
  return `<header class="sb-card-hd"><h2>경기 정보</h2></header>
    <div class="st-form">
      <label class="st-f"${H('날짜', '경기 날짜입니다. 분석 탭 경기 요약에 표시됩니다.')}><span>날짜</span><input type="date" class="st-u" value="${esc(i.date || _today())}" onchange="stSetInfo('date',this.value)"></label>
      <label class="st-f"${H('구장', '경기한 구장 이름(최대 20자)입니다. 분석 탭 경기 요약에 표시됩니다.')}><span>구장</span><input type="text" class="st-u" value="${esc(i.venue)}" maxlength="20" placeholder="예: 목동 보조구장" onchange="stSetInfo('venue',this.value)"></label>
      <div class="st-2">
        <label class="st-f"${H('내 팀', '우리 팀 이름(최대 6자)입니다. 기록 탭 점수판에도 바로 바뀝니다.')}><span>내 팀</span><input type="text" class="st-u" value="${esc(th)}" maxlength="6" placeholder="내 팀" oninput="stTeamName('home',this.value)"></label>
        <label class="st-f"${H('상대팀', '상대 팀 이름(최대 6자)입니다. 기록 탭 점수판에도 바로 바뀝니다.')}><span>상대팀</span><input type="text" class="st-u" value="${esc(ta)}" maxlength="6" placeholder="원정팀" oninput="stTeamName('away',this.value)"></label>
      </div>
      <fieldset class="st-f st-side"${H('홈 / 원정', '내 팀이 <b>홈(말 공격)</b>인지 <b>원정(초 공격)</b>인지 고릅니다.')}><legend>내 팀은</legend>
        <label><input type="radio" name="stSide" value="home"${i.side !== 'away' ? ' checked' : ''} onchange="stSetInfo('side','home')">홈 <small>(말 공격)</small></label>
        <label><input type="radio" name="stSide" value="away"${i.side === 'away' ? ' checked' : ''} onchange="stSetInfo('side','away')">원정 <small>(초 공격)</small></label>
      </fieldset>
      <div class="st-f"${H('이닝', '정규 이닝 수(5 · 7 · 9회)입니다. 기록 탭 점수판의 이닝 칸 수가 바뀝니다.')}><span id="stInnLbl">이닝</span>
        <div class="sb-seg st-inn" role="group" aria-labelledby="stInnLbl">${[5, 7, 9].map(n => `<button type="button" aria-pressed="${i.innings === n}" onclick="stSetInfo('innings',${n})">${n}회</button>`).join('')}</div>
      </div>
    </div>
    <div class="st-gf">
      <button type="button" class="sb-btn${gf ? ' on' : ''}" onclick="stGf()"${H('경기 운영', '켜면 <b>타순 · 아웃 · 이닝 · 주자</b>가 자동으로 넘어갑니다. (자동 진행은 내 팀이 초 공격이라고 가정)')}>${gf ? '경기 운영 끄기' : '경기 운영 시작'}</button>
      ${gf ? `<button type="button" class="sb-btn st-danger" onclick="gfEndConfirm()"${H('경기 종료', '경기를 끝내고 <b>최종 요약(경기 리포트)</b>을 엽니다. 누르면 한 번 더 확인합니다.')}>경기 종료</button>` : ''}
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
  try { saves = window.SLGames ? window.SLGames.loadGames({ withCurrent: false }).length : JSON.parse(localStorage.getItem('sl_saves') || '[]').length; } catch (e) {}   // 같은 경기의 사본은 하나로
  return `<header class="sb-card-hd"><h2>데이터</h2></header>
    <div class="st-data">
      <p class="st-note">기록은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우거나 기기를 바꾸면 사라지니 백업 파일을 내보내 두세요.</p>
      <p class="st-meta">저장된 경기 ${saves}개 · 사용량 약 ${_kb()}</p>
      <p class="st-sync"><b>동기화</b>${logged ? `로그인됨 · ${esc(sync || '대기 중')}` : '로그인 안 함 · 이 기기에만 저장'}<button type="button" class="sb-mini" onclick="openCloudOverlay()"${H('클라우드', '로그인하면 경기를 <b>클라우드</b>에 저장해 다른 기기에서도 불러올 수 있습니다.')}>클라우드</button></p>
      <div class="st-2b">
        <button type="button" class="sb-btn" onclick="exportAllGames()"${H('백업 내보내기', '이 기기에 저장된 <b>경기 전체</b>를 백업 파일(.json)로 내려받습니다.')}>${ICON.down}백업 내보내기</button>
        <label class="sb-btn st-file"${H('백업 불러오기', '내보내 둔 <b>백업 파일</b>을 골라 경기를 되살립니다.')}>${ICON.up}백업 불러오기<input type="file" accept=".json,.spray,text/plain" onchange="importGames(this)" aria-label="백업 파일 선택"></label>
      </div>
      <button type="button" class="sb-btn st-danger" onclick="clearAll()"${H('이 경기 기록 지우기', '지금 경기의 <b>타석 기록을 모두</b> 지웁니다. 누르면 한 번 더 확인합니다.')}>${ICON.trash}이 경기 기록 지우기</button>
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
          <input class="st-in pos" data-f="pos" value="${esc(p.pos || '')}" maxlength="4" list="stPosList" placeholder="수비" aria-label="${lbl} 포지션">
          ${bhSel(p.bh, lbl)}
          <button type="button" class="st-drag" aria-label="${lbl} ${esc(p.name)} 순서 바꾸기 (끌거나 ↑↓ 키)">${ICON.grip}</button></li>`
      : `<li class="st-row empty"><span class="n">${i + 1}</span>
          <input class="st-in nm" data-f="name" value="" maxlength="8" placeholder="이름" aria-label="${lbl} 이름 (입력하면 추가)">
          <input class="st-in pos" data-f="pos" value="" maxlength="4" list="stPosList" placeholder="수비" aria-label="${lbl} 포지션">
          ${bhSel('', lbl)}
          <span class="st-drag ph" aria-hidden="true"></span></li>`);
  }
  return `<header class="sb-card-hd"><h2>타순표</h2>
      <div class="sb-seg" role="group" aria-label="편집할 팀"${H('편집할 팀', '고칠 타순표를 <b>내 팀 / 상대팀</b> 중에서 고릅니다.')}>
        <button type="button" aria-pressed="${team === 'home'}" onclick="stTeam('home')">${esc(th)}</button>
        <button type="button" aria-pressed="${team === 'away'}" onclick="stTeam('away')">${esc(ta)}</button>
      </div></header>
    <div class="st-lu-h" aria-hidden="true"><span>타순</span><span>이름</span><span>수비</span><span>타석</span><span></span></div>
    <ol class="st-lu-list">${rows.join('')}</ol>
    <datalist id="stPosList">${['투수', '포수', '1루', '2루', '3루', '유격', '좌익', '중견', '우익', 'DH'].map(x => `<option value="${x}">`).join('')}</datalist>
    <footer class="st-lu-ft">
      <button type="button" class="sb-btn" onclick="stAddExtra()"${H('지명타자 · 대타 추가', '9번 아래에 <b>빈 줄</b>을 하나 더 만듭니다. 이름을 쓰면 선수가 추가됩니다.')}>＋ 지명타자 · 대타 추가</button>
      <button type="button" class="sb-mini" onclick="shellDrawer(true)"${H('삭제 · 후보 · 등번호', '라인업 창을 열어 <b>선수 삭제 · 후보 · 등번호</b>를 고칩니다.')}>삭제 · 후보 · 등번호</button>
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
    <div class="st-pres" role="radiogroup" aria-label="구장 규격"${H('구장 고르기', '자주 쓰는 구장 규격입니다. 숫자는 <b>좌 · 중 · 우</b> 펜스 거리(m)입니다.')}>${PRESETS.map(item).join('')}</div>
    <div class="st-prev">${_preview()}</div>
    <div class="st-dists"${H('펜스 거리', '거리를 바꾸면 <b>직접 입력</b>으로 저장되고 기록 탭 필드에 바로 반영됩니다. 홈런 여부는 기록할 때 직접 고릅니다.')}>${inp('lf', '좌', st.lfDist)}${inp('cf', '중', st.cfDist)}${inp('rf', '우', st.rfDist)}</div>
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
  sheet: '<path d="M6 4h12v17H6z"/><path d="M9.5 2.5h5v3h-5zM6 10h12M6 15h12M10.5 5.5V21"/>',
  order: '<path d="M5 4h14v17H5z"/><path d="M8 8.5h1M11 8.5h5M8 12.5h1M11 12.5h5M8 16.5h1M11 16.5h5"/>',
  data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
  feedback: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  home: '<path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5"/>',
};

function _moreHtml() {
  const ico = k => `<i class="st-more-i" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${MORE_ICON[k]}</svg></i>`;
  const b = (fn, t, s, k, d) => `<button type="button" class="st-more-b" onclick="${fn}"${H(t, d)}>${ico(k)}<span class="st-more-t"><b>${t}</b><small>${s}</small></span></button>`;
  return `<header class="sb-card-hd"><h2>그 밖의 기능</h2></header>
    <div class="st-more">
      <div><h3>경기</h3>${b('openGameWizard()', '새 경기 시작', '팀 이름 · 라인업 새로', 'newGame', '팀 이름 · 라인업을 새로 정하고 <b>새 경기</b>를 시작합니다.')}${b('showSaveSheet()', '경기 저장', '불러오기 목록 · 클라우드', 'save', '이 경기를 저장합니다. 저장한 경기는 <b>지난 경기 불러오기</b> 목록에 남고, 로그인하면 클라우드에도 저장됩니다.')}${b('showPostGameReport()', '경기 리포트', '이번 경기 요약', 'report', '이번 경기 기록을 <b>한 장 요약</b>으로 봅니다.')}${b("shellNav('record');shellRecSheet(true)", '최근 기록', '수정 · 삭제', 'recent', '기록 탭으로 가서 <b>최근 타석 기록</b>을 엽니다. 잘못 찍은 타석을 고치거나 지웁니다.')}</div>
      <div><h3>라인업 · 팀</h3>${b('applyLastLineup()', '지난 경기 라인업', '그대로 가져오기', 'lastLu', '가장 최근에 저장한 경기의 <b>라인업</b>을 그대로 가져옵니다.')}${b('ocrModalOpen()', '사진 / CSV로 입력', '라인업 한 번에', 'photo', '라인업 <b>사진</b>이나 <b>CSV 파일</b>로 선수를 한 번에 입력합니다.')}${b('openOrderSheet()', '오더지', '타순표 · 이미지 · 인쇄', 'order', '경기 전에 내는 <b>타순표</b>(타순 · 수비 위치 · 이름 · 등번호 · 후보)를 A4 한 장으로 만듭니다. 이미지로 저장하거나 인쇄할 수 있어요.')}${b('openTeamShare()', '팀 만들기', '팀원과 기록 공유 · 로그인 필요', 'team', '로그인한 뒤 <b>팀을 만들거나 팀 코드로 참가</b>해 팀원과 기록을 공유합니다.')}</div>
      <div><h3>내보내기 · 공유</h3>${b('shareGameLink()', '경기 공유', 'QR · 링크', 'share', '이 경기를 <b>링크 · QR 코드</b>로 공유합니다.')}${b('exportSprayPNG()', '스프레이차트 PNG', '필드 이미지', 'spray', '기록 탭 <b>필드(스프레이차트)</b>를 PNG 이미지로 저장합니다.')}${b('exportShareCard()', '성적 카드 이미지', 'SNS 공유용', 'card', '이번 경기 기록을 <b>SNS 공유용 카드 이미지</b>로 만듭니다.')}${b('openScoresheet()', '리그 기록지', '제출용 · 이미지 · 인쇄', 'sheet', '이번 경기를 <b>리그 제출용 기록지</b>(이닝별 점수 · 타순 × 이닝 칸 · 합계)로 만듭니다. 이미지로 저장하거나 인쇄할 수 있어요.')}${b('exportCurrentGameToExcel()', '엑셀 내보내기', '이번 경기 타석 전체', 'excel', '이번 경기 <b>타석 기록 전체</b>를 엑셀 파일로 내보냅니다.')}</div>
      <div><h3>데이터 · 도움말</h3>${b("openOverlay('dataSettingsOverlay')", '데이터 관리', '가져오기 · 전체 내보내기', 'data', '경기 데이터 <b>가져오기 · 전체 내보내기</b> 창을 엽니다.')}${b('showHelpMenu()', '사용 방법', '기능 안내', 'help', '기능별 <b>사용 안내</b>를 엽니다.')}${b('fieldFeedbackOpen()', '피드백 보내기', '버그 · 제안', 'feedback', '버그나 제안을 <b>개발자에게</b> 보냅니다.')}${b('goLanding()', '처음 화면으로', '기록은 그대로 유지', 'home', '첫 화면으로 돌아갑니다. <b>기록은 그대로</b> 남습니다.')}</div>
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
        <div class="stx-l"><section class="sb-card" id="stInfo" aria-label="경기 정보"${H('경기 정보', '<b>날짜 · 구장 · 팀 이름 · 홈/원정 · 이닝</b>을 정합니다. 경기와 함께 저장됩니다.')}></section><section class="sb-card" id="stData" aria-label="데이터"${H('데이터', '기록은 <b>이 브라우저에만</b> 저장됩니다. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 백업 파일을 내보내 두세요.')}></section></div>
        <section class="sb-card stx-c" id="stLu" aria-label="타순표"${H('타순표', '<b>이름 · 포지션 · 타석(우/좌/양)</b>을 바로 고칩니다. 빈 줄에 이름을 쓰면 선수가 추가되고, 오른쪽 손잡이를 끌면 타순이 바뀝니다.')}></section>
        <section class="sb-card stx-r" id="stStad" aria-label="구장 규격"${H('구장 규격', '펜스 거리(좌 · 중 · 우, m)를 고릅니다. 기록 탭 <b>필드 펜스</b>와 <b>타구 추정 비거리</b>에 바로 반영됩니다.')}></section>
      </div>
      <section class="sb-card stx-more" id="stMore" aria-label="그 밖의 기능"${H('그 밖의 기능', '저장 · 리포트 · 라인업 · 공유 · 내보내기 · 도움말 기능을 모아 둔 곳입니다.')}></section>`;
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
  // 경기별 구장 (_infoStadium · _applyInfoStadium) — 위 경기 정보 연결보다 바깥에서 감싼다
  //   구장 변경 → info.stadium · 저장/자동저장 직전 → 빈 info.stadium 채움 · 불러온 뒤(저장 경기 · 자동저장 복구) → 그 경기 구장 적용
  const ss = window.setStadium;
  if (typeof ss === 'function' && !ss._stStad) {
    const w = function (id) { const r = ss.apply(this, arguments); if (_AS().stadium === id) _infoStadium(id); return r; };
    w._stStad = true;
    window.setStadium = w;
  }
  if (typeof storageManager !== 'undefined' && storageManager && !storageManager._stStad) {
    const o = storageManager.scheduleAutosave.bind(storageManager);
    storageManager.scheduleAutosave = function () { _infoStadium(); return o.apply(null, arguments); };
    storageManager._stStad = true;
  }
  const sg = window.saveGame;
  if (typeof sg === 'function' && !sg._stStad) {
    const w = function () { _infoStadium(); return sg.apply(this, arguments); };
    w._stStad = true;
    window.saveGame = w;
  }
  // loadSharedGame: 공유 링크로 받은 경기도 내 경기를 열 때와 같게 그 경기 구장으로(공유 데이터의 info.stadium) — 직접 입력이면 거리부터(_applySharedDist)
  ['restoreGame', 'archRecoverAutosave', 'loadSharedGame'].forEach(fn => {
    const o = window[fn];
    if (typeof o !== 'function' || o._stStad) return;
    const w = function () { const r = o.apply(this, arguments); if (fn === 'loadSharedGame') _applySharedDist(); _applyInfoStadium(); return r; };
    w._stStad = true;
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
  // 시작 때 이미 열린 경기(위 연결 전에 불러왔을 수 있음)의 구장 적용 → 구장을 고른 적 없는 새 사용자는 리틀야구
  _applyInfoStadium();
  _defaultStadium();
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
