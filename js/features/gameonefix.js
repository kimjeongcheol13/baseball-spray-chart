// 게임원 가져오기 보정 — 「타구 위치 확인」 (2026-10-19)
// 게임원 기록 표기(좌안 · 중플 · 3땅 …)는 방향이 거칠어 가져오기가 찍는 좌표는 대표 지점이다(js/gameone.js — 파서는 고치지 않는다).
// 가져오기 저장 직후 이 화면을 한 번 연다: 필드 위에 가져온 타구 점을 그리고, 필드를 탭하거나 점을 끌어 실제 자리로 옮긴다.
//  · 점선 테두리 = estimated(가져오기 때 파서 confidence 'low'). 끌어 옮기면 x · y · deg · dir · ft 를 기록 탭 필드 탭(core onFClick)과
//    같은 식으로 다시 정하고 estimated = false. 홈런은 ft 를 그대로 둔다(비거리 기록 [2R 97M] 이 있을 수 있다)
//  · 탭만 하고 끌지 않은 점 · 건드리지 않은 점은 그대로(estimated 유지). 옮길 때마다 바로 저장 — '나중에 할게'로 닫아도 옮긴 점은 남는다
//  · 타자별(이전 / 다음) · 전체 보기. 같은 자리에 겹친 점(같은 표기 → 같은 대표 지점)은 화면에서만 둥글게 벌려 그린다(저장 좌표는 그대로)
//  · 탭으로 찍기(2026-10-20): '지금 찍을 공'(노란 테두리 · 위 안내)을 하나 정해 두고, 필드 빈 곳을 탭하면 그 공을 그 자리로 옮긴 뒤
//    다음 대략 위치 공으로 넘어간다(그 타자 공이 끝나면 다음 타자로). 점을 탭하면 그 공을 고르고(옮기지는 않음), 끌기는 그대로.
//    게임원 기록에는 떨어진 자리가 없어서 정확한 위치는 경기를 본 사람이 찍어야 한다 — 끌기보다 탭이 휴대폰에서 빠르다
//  · 지금 열린 경기(_curSaveKey)면 AS.abs 를 바로 고치고 _saveEditImmediate(타석 기록 수정과 같은 저장),
//    아니면 저장된 경기(localStorage)를 고쳐 다시 저장하고 닫을 때 cloudSave 한 번
//  · 필드 · 점 그림 = 기록 탭과 같은 것(scorebook.js window.sbPaint), 기하 = core.js(_fieldGeo · _semiToCone · _coneToSemi)
//  · 분석 탭은 대략 위치를 점선으로 그린다 — 팀 방향도(dashboard.js drawDashField → team.js) · 타자 · 스카우트 스프레이 차트(batdata.js sprayFigure).
//    그 옆 '위치 확인'이 이 화면을 다시 연다(gameOneFixFrom).
//    GA4 gameone_fix = 닫을 때 숫자만(이름 없음)

const $ = id => document.getElementById(id);
const _esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DIR = d => (d < 54 ? 'LF' : d < 78 ? 'LC' : d < 102 ? 'CF' : d < 126 ? 'RC' : 'RF');   // core onFClick 과 같은 경계
const HIT = 24;   // 끌기 시작 판정 반지름(px) — 손가락으로 지름 44px 이상
const TAP = 10;   // 이만큼(px) 안 움직이고 뗀 것 = 탭
const DIR_KO = { LF: '좌익', LC: '좌중간', CF: '중견', RC: '우중간', RF: '우익' };
const _has = a => !!a && typeof a.x === 'number' && typeof a.y === 'number' && isFinite(a.x) && isFinite(a.y);
const _track = (name, params) => { try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (e) {} };

let S = null;   // 열려 있는 동안의 상태

function _curKey() { try { return typeof _curSaveKey !== 'undefined' ? _curSaveKey : null; } catch (e) { return null; } }
function _read(key) {
  try { const d = JSON.parse(localStorage.getItem(key)); return d && typeof d === 'object' && Array.isArray(d.abs) ? d : null; } catch (e) { return null; }
}
// 담장 거리(ft) — core onFClick · 가져오기(buildGameOneGame)와 같은 식
function _wallFt(stadium) {
  const all = window.STADIUMS || {}, st = all[stadium] || all.standard || { lfDist: 90, cfDist: 120, rfDist: 90 };
  const lf = Math.round(st.lfDist * 3.281), cf = Math.round(st.cfDist * 3.281), rf = Math.round(st.rfDist * 3.281);
  return { LF: lf, LC: Math.round((lf + cf) / 2), CF: cf, RC: Math.round((cf + rf) / 2), RF: rf };
}

// key = 저장 경기 키. 타구 점이 하나도 없으면 열지 않는다(false)
export function openGameOneFix(key) {
  if (typeof key !== 'string' || !key || !window.sbPaint || typeof _fieldGeo !== 'function') return false;
  const live = key === _curKey();
  const game = live ? window.AS : _read(key);
  if (!game || !Array.isArray(game.abs)) return false;
  const pts = game.abs.filter(_has);
  if (!pts.length) return false;
  const batters = [], by = Object.create(null);   // 경기 순서대로 처음 나온 타자 순
  pts.forEach(a => {
    const k = String(a.bid != null ? a.bid : a.bname);
    if (!by[k]) { by[k] = { name: a.bname || '', num: a.bnum, team: a.team, abs: [] }; batters.push(by[k]); }
    by[k].abs.push(a);
  });
  S = { key, live, game, pts, batters, i: 0, all: false, moved: new Set(), drag: null, tap: null, view: [], geo: null, target: null, taps: 0, msg: '',
    est0: pts.filter(a => a.estimated === true).length, wall: _wallFt(game.stadium || '') };
  // 처음 찍을 공 = 경기 순서로 첫 대략 위치 공. 그 타자부터 보여 준다
  S.target = _order().find(a => a.estimated === true) || null;
  if (S.target) S.i = Math.max(0, _batterOf(S.target));
  if (window.openOverlay) window.openOverlay('goFixOverlay');
  _render();
  return true;
}

function _teamLbl(t) {
  const g = S.game;
  if (S.live) return t === 'away' ? (($('tAway') || {}).value || '원정') : (($('tHome') || {}).value || '홈');
  return t === 'away' ? (g.ta || '원정') : (g.th || '홈');
}
function _visible() { return S.all ? S.pts : S.batters[S.i].abs; }
const _estN = list => list.filter(a => a.estimated === true).length;
// 찍는 순서 = 타자(처음 나온 순) → 그 타자의 타석 순. 타자별 · 전체 보기 둘 다 같은 순서
function _order() { return S.batters.reduce((o, b) => o.concat(b.abs), []); }
function _batterOf(a) { return S.batters.findIndex(b => b.abs.indexOf(a) >= 0); }
// a 다음(없으면 처음부터)의 대략 위치 공 — a 자신은 빼고. 없으면 null
function _nextEst(a) {
  const o = _order(), k = o.indexOf(a), rot = k < 0 ? o : o.slice(k + 1).concat(o.slice(0, k));
  return rot.find(x => x !== a && x.estimated === true) || null;
}
// 지금 찍을 공을 b 로 — 타자별 보기면 그 타자로 넘어간다
function _setTarget(b) {
  S.target = b || null;
  if (b && !S.all) { const k = _batterOf(b); if (k >= 0) S.i = k; }
}
function _targetHtml() {
  const t = S.target;
  if (!t) return S.pts.some(a => a.estimated === true)
    ? '점을 탭해 고른 뒤 필드를 탭하면 그 자리로 옮겨져요'
    : '<b>대략 위치를 모두 찍었어요 ✓</b> 더 고칠 점은 탭해 고른 뒤 필드를 탭하세요';
  const left = _estN(S.pts), dir = DIR_KO[t.dir] ? ` · ${DIR_KO[t.dir]} 쪽` : '';
  return `<b>지금 찍을 공</b> ${_esc(t.bname || '')} · ${_esc(t.inn || '')} · ${_esc(t.res || '')}${dir}`
    + `<small>${S.msg ? _esc(S.msg) : '실제로 떨어진 자리를 탭하세요'}${left ? ` · 남은 대략 ${left}개` : ''}</small>`;
}

function _render() {
  if (!S) return;
  const b = S.batters[S.i], n = S.batters.length;
  $('gfWho').innerHTML = S.all
    ? `<b>전체 ${S.pts.length}개</b><small>대략 ${_estN(S.pts)} · 옮김 ${S.moved.size}</small>`
    : `<b>${_esc(b.name)}${b.num != null && b.num !== '' ? ` <span>#${_esc(b.num)}</span>` : ''}</b><small>${_esc(_teamLbl(b.team))} · ${S.i + 1}/${n}명 · 대략 ${_estN(b.abs)}</small>`;
  $('gfPrev').disabled = S.all || S.i === 0;
  $('gfNext').disabled = S.all || S.i === n - 1;
  if (S.target && !S.all && S.batters[S.i].abs.indexOf(S.target) < 0) S.target = S.batters[S.i].abs.find(a => a.estimated === true) || null;   // 이전 · 다음 타자로 넘기면 그 타자의 공
  if ($('gfTarget')) $('gfTarget').innerHTML = _targetHtml();
  if ($('gfSkip')) $('gfSkip').disabled = !S.target || !_nextEst(S.target);
  $('gfModeOne').setAttribute('aria-pressed', String(!S.all));
  $('gfModeAll').setAttribute('aria-pressed', String(S.all));
  const list = $('gfList');
  list.hidden = S.all;
  list.innerHTML = S.all ? '' : b.abs.map((a, k) => {
    const st = S.moved.has(a) ? ['moved', '옮김'] : a.estimated === true ? ['est', '대략'] : null;
    return `<li${a === S.target ? ' class="gf-now"' : ''}><span class="gf-n">${k + 1}</span>${_esc(a.inn || '')} · ${_esc(a.res || '')}${st ? `<em class="gf-st gf-${st[0]}">${st[1]}</em>` : ''}</li>`;
  }).join('');
  _draw();
}

// 화면 위치: 저장 좌표 → 부채꼴 화면 좌표. 같은 자리에 겹친 점은 둥글게 벌린다(화면만)
function _layout(g) {
  const vis = _visible(), out = [], grp = Object.create(null);
  vis.forEach((a, k) => {
    const d = S.drag && S.drag.a === a && S.drag.sp;
    const p = _semiToCone(g, d ? d.x : a.x, d ? d.y : a.y, d ? 0 : a.fa, d ? 0 : a.ov);
    const v = { a, x: p[0], y: p[1], n: k + 1 };
    out.push(v);
    if (!d) { const id = Math.round(p[0]) + ',' + Math.round(p[1]); (grp[id] = grp[id] || []).push(v); }
  });
  Object.keys(grp).forEach(id => {
    const vs = grp[id];
    if (vs.length < 2) return;
    const r = Math.min(22, 8 + 2 * vs.length);
    vs.forEach((v, k) => { const t = -Math.PI / 2 + k * 2 * Math.PI / vs.length; v.x += r * Math.cos(t); v.y += r * Math.sin(t); });
  });
  return out;
}

function _draw() {
  const cv = $('gfCanvas');
  if (!S || !cv) return;
  const W = Math.max(200, Math.min(420, Math.round((cv.parentElement && cv.parentElement.clientWidth) || 300)));
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr); }
  cv.style.width = W + 'px'; cv.style.height = W + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = window.sbPaint, T = P.tok(), g = _fieldGeo(W), R = Math.max(6, Math.min(9, W / 40));
  P.field(ctx, W, T);
  S.geo = { g, W };
  S.view = _layout(g);
  S.view.forEach(v => {
    const a = v.a, drag = S.drag && S.drag.a === a;
    P.mark(ctx, P.kindOf(a.res), v.x, v.y, R, T);
    ctx.save();
    if (a.estimated === true && !(drag && S.drag.sp)) {   // 대략 = 점선 테두리
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1.6; ctx.strokeStyle = T.ink;
      ctx.beginPath(); ctx.arc(v.x, v.y, R + 5, 0, Math.PI * 2); ctx.stroke();
    }
    if (drag) { ctx.setLineDash([]); ctx.lineWidth = 2.5; ctx.strokeStyle = T.hl; ctx.beginPath(); ctx.arc(v.x, v.y, R + 7, 0, Math.PI * 2); ctx.stroke(); }
    else if (a === S.target) {   // 지금 찍을 공 = 노란 두 겹
      ctx.setLineDash([]); ctx.strokeStyle = T.hl;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(v.x, v.y, R + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(v.x, v.y, R + 13, 0, Math.PI * 2); ctx.stroke();
    }
    if (!S.all) {   // 아래 목록 번호
      ctx.setLineDash([]); ctx.font = `700 ${Math.round(R * 1.3)}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = T.paper2; ctx.strokeText(String(v.n), v.x + R + 4, v.y - R - 2);
      ctx.fillStyle = T.ink; ctx.fillText(String(v.n), v.x + R + 4, v.y - R - 2);
    }
    ctx.restore();
  });
}

function _pt(e) {
  const cv = $('gfCanvas'), r = cv.getBoundingClientRect(), k = S.geo.W / (r.width || S.geo.W);
  return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
}
function _hit(p) {
  let best = null, bd = HIT;
  S.view.forEach(v => { const d = Math.hypot(v.x - p.x, v.y - p.y); if (d <= bd) { bd = d; best = v; } });   // 같으면 나중(위에 그린) 점
  return best;
}
function _down(e) {
  if (!S || !S.geo || S.drag) return;
  const p = _pt(e), v = _hit(p);
  e.preventDefault();
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {}
  if (!v) { S.tap = { id: e.pointerId, p, off: false }; return; }   // 빈 곳 = 탭으로 찍기(뗄 때)
  S.drag = { a: v.a, id: e.pointerId, sp: null, dx: v.x - p.x, dy: v.y - p.y };   // 잡은 자리 그대로 끌리게(점이 손가락 밑으로 튀지 않게)
  _draw();
}
function _move(e) {
  if (S && S.tap && e.pointerId === S.tap.id) { const p = _pt(e); if (Math.hypot(p.x - S.tap.p.x, p.y - S.tap.p.y) > TAP) S.tap.off = true; return; }
  if (!S || !S.drag || e.pointerId !== S.drag.id) return;
  e.preventDefault();
  const p = _pt(e), sp = _coneToSemi(S.geo.g, p.x + S.drag.dx, p.y + S.drag.dy);
  if (sp) S.drag.sp = sp;   // 파울 지역 · 펜스 밖이면 마지막 자리에 둔다
  _draw();
}
function _up(e, cancel) {
  if (S && S.tap && e.pointerId === S.tap.id) { const t = S.tap; S.tap = null; if (!cancel && !t.off) _place(_pt(e)); return; }
  if (!S || !S.drag || e.pointerId !== S.drag.id) return;
  const d = S.drag;
  S.drag = null;
  if (d.sp && !cancel) _commit(d.a, d.sp);
  else if (!cancel) S.target = d.a;   // 점을 탭 = 그 공을 지금 찍을 공으로(옮기지는 않음)
  S.msg = '';
  if (d.sp && !cancel && d.a === S.target && S.target.estimated !== true) S.target = S.batters[S.i].abs.find(a => a.estimated === true) || null;   // 끌어서 찍었으면 이 타자의 다음 대략 공
  _render();
}
// 필드 빈 곳을 탭 → 지금 찍을 공을 그 자리로, 다음 대략 위치 공으로 넘어감(그 타자가 끝나면 다음 타자). 파울 지역이면 그대로 + 안내
function _place(p) {
  if (!S.target) { S.msg = ''; _render(); return; }
  const sp = _coneToSemi(S.geo.g, p.x, p.y);
  if (!sp) { S.msg = '파울 지역이에요 — 선 안쪽을 탭하세요'; _render(); return; }
  const t = S.target;
  _commit(t, sp);
  S.taps++; S.msg = '';
  _setTarget(_nextEst(t));
  _render();
}
// 「건너뛰기」 — 지금 공은 대략 위치로 두고 다음 대략 위치 공으로
export function gameOneFixSkip() {
  if (!S || !S.target) return;
  const n = _nextEst(S.target);
  if (n) { S.msg = ''; _setTarget(n); _render(); }
}

function _commit(a, sp) {
  a.x = sp.x; a.y = sp.y; a.deg = sp.deg; a.dir = DIR(sp.deg);
  delete a.fa; delete a.ov;   // 새로 찍은 자리는 파울라인 사이 · 펜스 안(3D 파울 각도 fa · 외야석 깊이 ov 는 버린다)
  if (a.res !== '홈런') a.ft = Math.round(sp.dist * (S.wall[a.dir] || 370));
  a.estimated = false;
  S.moved.add(a);
  if (S.live) { if (typeof _saveEditImmediate === 'function') _saveEditImmediate(); return; }
  try { localStorage.setItem(S.key, JSON.stringify(S.game)); }
  catch (e) { if (window.showToast) window.showToast('저장 공간이 부족해 옮긴 위치를 저장하지 못했습니다', false); }
}

export function gameOneFixStep(d) {
  if (!S || S.all) return;
  S.i = Math.max(0, Math.min(S.batters.length - 1, S.i + d));
  _render();
}
export function gameOneFixAll(on) {
  if (!S) return;
  S.all = !!on;
  _render();
}

// action = 'done'(다 봤어요) | 'later'(나중에 할게 · ✕). 옮긴 점은 이미 저장돼 있다
export function gameOneFixClose(action) {
  if (window.closeOverlay) window.closeOverlay('goFixOverlay');
  if (!S) return;
  const s = S;
  S = null;
  if (s.moved.size) {
    if (s.live) { if (typeof updateAll === 'function') updateAll(); }
    else if (window.cloudSave) {
      let label = '';
      try { const e = (JSON.parse(localStorage.getItem('sl_saves') || '[]') || []).find(x => x && x.key === s.key); label = (e && e.label) || ''; } catch (e) {}
      window.cloudSave(s.key, s.game, label, s.game.ts);
    }
    // 분석 탭이 열려 있으면 지금 하위 탭을 다시 그려 점선 · 안내를 바로 고친다(shellSub — 분석 뷰를 켠 채로). 안 열려 있으면 다음에 열 때 그려진다
    const on = document.querySelector('#anaSubnav .ana-sub.on'), av = $('analysisView');
    if (on && av && av.classList.contains('active') && window.shellSub) window.shellSub(on.dataset.sub);
  }
  _track('gameone_fix', { action: action === 'done' ? 'done' : 'later', pts: s.pts.length, est: s.est0, moved: s.moved.size, left: _estN(s.pts), tap: s.taps });
}

// 분석 탭 '위치 확인'(팀 방향도 범례 · 타자 · 스카우트 스프레이 차트): scope 'game' = 지금 열린 경기만,
// 그 밖('auto') = 지금 열린 경기에 대략 위치가 있으면 그 경기, 없으면 대략 위치가 남은 가장 최근 저장 경기
export function gameOneFixFrom(scope) {
  const est = list => (list || []).some(a => a && a.estimated === true);
  let key = est((window.AS || {}).abs) ? _curKey() : null;
  if (!key && scope !== 'game' && window.SLGames) {
    const g = window.SLGames.loadGames({ withCurrent: false }).filter(x => est(x.abs)).sort((p, q) => q.ms - p.ms)[0];
    key = g ? g.key : null;
  }
  if (key && openGameOneFix(key)) return true;
  if (window.showToast) window.showToast('위치를 확인할 가져온 경기를 찾지 못했어요', false);
  return false;
}

if (typeof window !== 'undefined') {
  window.openGameOneFix = openGameOneFix;
  window.gameOneFixStep = gameOneFixStep;
  window.gameOneFixAll = gameOneFixAll;
  window.gameOneFixClose = gameOneFixClose;
  window.gameOneFixFrom = gameOneFixFrom;
  window.gameOneFixSkip = gameOneFixSkip;
  window.SLGameOneFix = { open: openGameOneFix, state: () => S, view: () => (S ? S.view.map(v => ({ a: v.a, x: v.x, y: v.y, n: v.n })) : []) };
  const cv = $('gfCanvas');
  if (cv) {
    cv.addEventListener('pointerdown', _down);
    cv.addEventListener('pointermove', _move);
    cv.addEventListener('pointerup', e => _up(e, false));
    cv.addEventListener('pointercancel', e => _up(e, true));
  }
  window.addEventListener('resize', () => { if (S) _draw(); });
}
