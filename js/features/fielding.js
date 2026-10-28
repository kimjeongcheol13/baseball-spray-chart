// 아웃 수비 기록 — 땅볼 6-3 · 1루수 혼자 3U · 뜬공 F8 · 라인드라이브 L6 (타석 a.fp)
//  · 기록할 때 타구 위치(deg · ft)로 잡은 야수를 추정한다 — core.js recHit 이 window.slFpGuess 로 부른다
//  · 고치기: 저장 토스트의 [수비 고치기](방금 기록한 타석) · 「타석 기록 수정」 창의 수비 줄 → 번호판(1~9)
//  · 보이는 곳: 저장 토스트 · 기록 목록(core renderRecs) · 타석 기록(scorebook.js) · 리그 기록지 칸(scoresheet.js)
//  · 수비 표기는 이 세 아웃에만. 결과를 다른 것으로 고치면 지운다
const $ = id => document.getElementById(id);

const KIND = { __proto__: null, '땅볼 아웃': 'G', '플라이 아웃': 'F', '라인드라이브 아웃': 'L' };
const POS = ['', '투수', '포수', '1루수', '2루수', '3루수', '유격수', '좌익수', '중견수', '우익수'];
export const fpKind = res => KIND[res] || null;

// 타구 위치 → 잡은 야수 번호. deg: 30 좌익선 · 90 중견 · 150 우익선(실제 각도의 4/3), ft: 홈에서 거리
//  · 홈 바로 앞 = 포수, 마운드 둘레 가운데 = 투수, 뜬공 · 라인드라이브가 150ft 넘으면 외야 셋, 나머지는 내야 넷
// ponytail: 기본 수비 위치 기준 — 시프트 · 전진 수비는 모른다. 틀리면 번호판으로 고친다
function _fielder(deg, ft, air) {
  if (ft < (air ? 45 : 25)) return 2;
  if (ft < 80 && deg > 75 && deg < 105) return 1;
  if (air && ft >= 150) return deg < 70 ? 7 : deg <= 110 ? 8 : 9;
  return deg < 61 ? 5 : deg < 90 ? 6 : deg < 121 ? 4 : 3;
}
export function fpGuess(res, deg, ft) {
  const k = fpKind(res);
  if (!k || deg == null || !isFinite(deg)) return null;
  const f = _fielder(+deg, ft == null || !isFinite(ft) ? 120 : +ft, k !== 'G');
  return k === 'G' ? (f === 3 ? '3U' : f + '-3') : k + f;
}

// ── 번호판 ─────────────────────────────────────────────────
let _p = null;   // { kind, d: [야수 번호], u: 혼자 아웃, done(값 — 비우면 '') }
const _val = p => !p.d.length ? '' : p.kind === 'G' ? p.d.join('-') + (p.u ? 'U' : '') : p.kind + p.d[0];

export function fpPick(kind, cur, sub, done) {
  _mount();
  const m = (kind === 'G' ? /^([1-9](?:-[1-9]){0,3})(U?)$/ : /^[FL]([1-9])$/).exec(cur || '');
  _p = { kind, d: m ? m[1].split('-').map(Number) : [], u: !!(m && m[2]), done };
  $('fpSub').textContent = sub || '';
  $('fpHelp').textContent = kind === 'G'
    ? '공을 잡은 야수 → 받은 야수 순서로 누르세요 (예: 유격수 땅볼 6 → 3). 1루수가 혼자 잡아 밟으면 3 → 혼자 아웃.'
    : '공을 잡은 야수를 누르세요.';
  $('fpU').hidden = kind !== 'G';
  _draw();
  window.openOverlay('fpOverlay');
  setTimeout(() => { try { $('fpOk').focus(); } catch (e) {} }, 30);
}
function _draw() {
  const v = _val(_p);
  $('fpVal').textContent = v || '없음';
  $('fpU').disabled = _p.d.length !== 1;   // 혼자 아웃은 번호 하나 뒤에만
  $('fpU').setAttribute('aria-pressed', String(_p.u));
  $('fpBack').disabled = !v;
  document.querySelectorAll('#fpPad [data-n]').forEach(b => b.setAttribute('aria-pressed', String(_p.kind !== 'G' && _p.d[0] === +b.dataset.n)));
}
function _num(n) {
  if (_p.kind !== 'G') _p.d = [n];
  else { _p.u = false; if (_p.d.length < 4) _p.d.push(n); }
  _draw();
}
function _close(save) {
  const p = _p;
  _p = null;
  window.closeOverlay('fpOverlay');
  if (save && p) p.done(_val(p));
}

function _mount() {
  if ($('fpOverlay')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div class="overlay" id="fpOverlay">
  <div class="modal fp-modal" role="dialog" aria-modal="true" aria-labelledby="fpTitle">
    <div class="modal-title" id="fpTitle">수비 기록</div>
    <div class="modal-sub" id="fpSub"></div>
    <div class="fp-val" id="fpVal" aria-live="polite"></div>
    <div class="fp-pad" id="fpPad" role="group" aria-label="수비 번호">
      ${POS.slice(1).map((s, i) => `<button type="button" data-n="${i + 1}" aria-label="${i + 1} ${s}"><b>${i + 1}</b><span>${s}</span></button>`).join('')}
    </div>
    <div class="fp-row">
      <button type="button" id="fpU" aria-pressed="false">혼자 아웃 (U)</button>
      <button type="button" id="fpBack" aria-label="한 칸 지우기">⌫ 지우기</button>
    </div>
    <p class="fp-help" id="fpHelp"></p>
    <div class="fp-act">
      <button type="button" class="btn btn-ghost" id="fpCancel">취소</button>
      <button type="button" class="btn btn-primary" id="fpOk">저장</button>
    </div>
  </div>
</div>`);
  $('fpPad').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b && _p) _num(+b.dataset.n); });
  $('fpU').onclick = () => { if (_p && _p.d.length === 1) { _p.u = !_p.u; _draw(); } };
  $('fpBack').onclick = () => { if (!_p) return; if (_p.u) _p.u = false; else _p.d.pop(); _draw(); };
  $('fpCancel').onclick = () => _close(false);
  $('fpOk').onclick = () => _close(true);
  // Esc 는 번호판만 닫는다 — core 의 Esc 는 「타석 기록 수정」 창까지 닫으므로 먼저 받아 멈춘다
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('fpOverlay').classList.contains('show')) { e.stopPropagation(); _close(false); }
  }, true);
}

// ── 저장 토스트: [수비 고치기] — 방금 기록한 타석 ───────────────
const _last = () => { const L = (window.AS && window.AS.abs) || []; return L[L.length - 1]; };
function _toast() {
  const u = $('toastUndo');
  if (!u || $('toastFp')) return;
  u.insertAdjacentHTML('beforebegin', '<button type="button" class="toast-undo toast-fp" id="toastFp" style="display:none">수비 고치기</button>');
  $('toastFp').onclick = () => {
    const a = _last();
    if (window.hideToast) window.hideToast();
    if (!a || !fpKind(a.res)) return;
    fpPick(fpKind(a.res), a.fp, `#${a.bnum} ${a.bname} · ${a.res}`, v => {
      if (v) a.fp = v; else delete a.fp;
      window.updateAll();   // 다시 그리기 + 자동저장 · 클라우드 (기록할 때와 같은 길)
    });
  };
  const show = window.showToast;
  window.showToast = function (msg) {
    const r = show.apply(this, arguments);
    const a = _last();
    // core recHit 의 저장 문구('저장됨 · #번호 이름 결과 수비 …')일 때만
    $('toastFp').style.display = a && a.fp && typeof msg === 'string' && msg.indexOf('저장됨 · ') === 0 && msg.indexOf(a.res + ' ' + a.fp) > 0 ? '' : 'none';
    return r;
  };
}

// ── 「타석 기록 수정」 창: 수비 줄 (저장할 때 반영 — 취소하면 버림) ──
let _ePend = null;
const _editAb = () => { const id = parseInt(($('editRecId') || {}).value); return ((window.AS && window.AS.abs) || []).find(a => a.id === id); };
function _editDraw() {
  const row = $('editFpRow');
  if (!row) return;
  row.hidden = !fpKind($('editRes').value);
  $('editFpBtn').textContent = (_ePend || '없음') + ' · 고치기';
}
function _edit() {
  const res = $('editRes');
  if (!res || $('editFpRow')) return;
  res.parentElement.insertAdjacentHTML('afterend',
    '<div id="editFpRow" hidden><div class="sec-lbl" style="margin-bottom:4px">수비</div><button type="button" class="inp fp-edit" id="editFpBtn"></button></div>');
  res.addEventListener('change', () => {
    const k = fpKind(res.value), pk = _ePend ? (/^[FL]/.test(_ePend) ? _ePend[0] : 'G') : null;
    if (k && pk && pk !== 'G' && k !== 'G') _ePend = k + _ePend.slice(1);   // 뜬공 ↔ 라인드라이브: 잡은 야수는 그대로
    else if (k && pk !== k) { const a = _editAb(); _ePend = a ? fpGuess(res.value, a.deg, a.ft) : null; }
    _editDraw();
  });
  $('editFpBtn').onclick = () => fpPick(fpKind(res.value), _ePend, '타석 기록 수정 · ' + res.value, v => { _ePend = v || null; _editDraw(); });
  const open = window.openEditRec, save = window.saveEditRec;
  window.openEditRec = function (id) {
    const r = open.apply(this, arguments);
    const a = ((window.AS && window.AS.abs) || []).find(x => x.id === id);
    _ePend = (a && a.fp) || null;
    _editDraw();
    return r;
  };
  window.saveEditRec = function () {
    const a = _editAb();
    if (a) { if (_ePend && fpKind($('editRes').value)) a.fp = _ePend; else delete a.fp; }
    return save.apply(this, arguments);
  };
}

window.slFpGuess = fpGuess;
window.fpPick = fpPick;
_toast();
_edit();
