/**
 * SprayLab — 스프레이 차트 필터 시스템
 * 구종 / 타구 결과 / 좌우투수 / 카운트
 */

// ── 필터 상태 ─────────────────────────────────────────────────
var _SF = {
  pt:    [],   // 구종: ['직구', '슬라이더', ...]
  res:   [],   // 타구 결과: ['안타', '홈런', ...]
  hand:  null, // 투수: 'L' | 'R' | null
  count: null  // 카운트: 'first' | 'pitcher' | 'batter' | 'full' | null
};
// 현재 투수 투구 손 (새 기록에 스탬프)
var _pitcherHand = null;

// ── 필터 판정 ─────────────────────────────────────────────────
function _pass(a) {
  if (_SF.pt.length    && _SF.pt.indexOf(a.pt) < 0)  return false;
  if (_SF.res.length   && _SF.res.indexOf(a.res) < 0) return false;
  if (_SF.hand != null && a.hand !== _SF.hand)        return false;
  if (_SF.count != null) {
    var c = a.count || {}, b = c.b || 0, s = c.s || 0;
    if (_SF.count === 'first'   && !(b === 0 && s === 0))          return false;
    if (_SF.count === 'pitcher' && s < 2)                          return false;
    if (_SF.count === 'batter'  && !(b >= 2 && b > s))            return false;
    if (_SF.count === 'full'    && !(b === 3 && s === 2))          return false;
  }
  return true;
}
function _isActive() {
  return _SF.pt.length > 0 || _SF.res.length > 0 || _SF.hand != null || _SF.count != null;
}
// 외부 노출 (heatmap.js 등에서 사용)
window._sfPass = _pass;

// ── drawDot 패치: 필터 미통과 레코드 스킵 ────────────────────
var _origDrawDot = window.drawDot;
if (_origDrawDot) {
  window.drawDot = function(r) {
    if (_isActive() && !_pass(r)) return;
    _origDrawDot.call(this, r);
  };
}

// ── recHit / recOther 패치: 투수 손 스탬프 ───────────────────
function _stampHand() {
  var abs = window.AS && window.AS.abs;
  if (!abs || !abs.length) return;
  var last = abs[abs.length - 1];
  if (last && last.hand === undefined) last.hand = _pitcherHand;
}
['recHit', 'recOther'].forEach(function(fn) {
  var orig = window[fn];
  if (!orig) return;
  window[fn] = function() {
    orig.apply(this, arguments);
    _stampHand();
  };
});

// ── 배지 업데이트 ─────────────────────────────────────────────
function _updateBadge() {
  var cnt = _SF.pt.length + _SF.res.length + (_SF.hand ? 1 : 0) + (_SF.count ? 1 : 0);
  var badge = document.getElementById('sfBadge');
  var btn   = document.getElementById('sfToggleBtn');
  if (badge) {
    badge.textContent = cnt ? cnt : '';
    badge.style.display = cnt ? 'inline-flex' : 'none';
  }
  if (btn) {
    btn.style.borderColor = cnt ? 'rgba(75,140,245,.7)' : '';
    btn.style.color       = cnt ? '#4b8cf5' : '';
  }
  // 헤드라인 레이블 갱신
  var lbl = document.getElementById('sfActiveLabel');
  if (lbl) lbl.textContent = cnt ? cnt + '개 필터 활성' : '';
}

// ── 패널 열기/닫기 ───────────────────────────────────────────
function _sfOpen() {
  _syncChips();
  document.getElementById('sfPanel').classList.add('sf-open');
  document.getElementById('sfBdrop').style.display = 'block';
}
function _sfClose() {
  document.getElementById('sfPanel').classList.remove('sf-open');
  document.getElementById('sfBdrop').style.display = 'none';
}
window._sfOpen  = _sfOpen;
window._sfClose = _sfClose;

// ── 칩 상태 동기화 ───────────────────────────────────────────
function _syncChips() {
  document.querySelectorAll('#sfPanel .sfc').forEach(function(el) {
    var key = el.dataset.key, val = el.dataset.val;
    var on;
    if (key === 'pt')    on = _SF.pt.indexOf(val)  >= 0;
    if (key === 'res')   on = _SF.res.indexOf(val) >= 0;
    if (key === 'hand')  on = _SF.hand  === val;
    if (key === 'count') on = _SF.count === val;
    el.classList.toggle('sfc-on', !!on);
  });
}

// ── 칩 토글 ──────────────────────────────────────────────────
function _sfChip(el) {
  var key = el.dataset.key, val = el.dataset.val;
  var single = el.dataset.single === '1';
  if (key === 'pt' || key === 'res') {
    var arr = _SF[key];
    var idx = arr.indexOf(val);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(val);
  } else {
    // single-select (hand, count)
    _SF[key] = (_SF[key] === val) ? null : val;
  }
  _syncChips();
}
window._sfChip = _sfChip;

// ── 적용 & 초기화 ────────────────────────────────────────────
function _sfApply() {
  _sfClose();
  _updateBadge();
  if (window.safeRender) window.safeRender();
}
function _sfReset() {
  _SF.pt = []; _SF.res = []; _SF.hand = null; _SF.count = null;
  _syncChips();
  _updateBadge();
  _sfClose();
  if (window.safeRender) window.safeRender();
}
window._sfApply = _sfApply;
window._sfReset = _sfReset;

// ── 투수 손 토글 ─────────────────────────────────────────────
function _setHand(h, el) {
  _pitcherHand = (_pitcherHand === h) ? null : h;
  document.querySelectorAll('.ph-chip').forEach(function(c) { c.classList.remove('on'); });
  if (_pitcherHand) el.classList.add('on');
}
window._setHand = _setHand;

// ── DOM 생성 ─────────────────────────────────────────────────
function _build() {
  // ① 필터 버튼 (필드 힌트 아래)
  var hint = document.querySelector('.field-hint');
  if (hint) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 12px 2px;box-sizing:border-box';
    row.innerHTML =
      '<button id="sfToggleBtn" onclick="_sfOpen()" style="'
      + 'display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:14px;'
      + 'border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);'
      + 'color:var(--text3);font-size:10px;font-weight:700;font-family:var(--font);'
      + 'cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap">'
      + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">'
      + '<line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/>'
      + '</svg>필터'
      + '<span id="sfBadge" style="display:none;background:#4b8cf5;color:#fff;font-size:9px;'
      + 'border-radius:8px;padding:1px 5px;line-height:1.4"></span></button>'
      + '<span id="sfActiveLabel" style="font-size:9px;color:var(--blue);font-weight:600"></span>';
    hint.parentElement.insertBefore(row, hint.nextSibling);
  }

  // ② 투수 손 칩 (투수 등록 영역 하단)
  var roleChips = document.getElementById('pitcherRoleChips');
  if (roleChips) {
    var handRow = document.createElement('div');
    handRow.style.cssText = 'display:flex;gap:4px;margin-bottom:8px';
    handRow.innerHTML =
      '<span style="font-size:9px;color:var(--text3);align-self:center;margin-right:2px">투구 손</span>'
      + '<button class="chip ph-chip" style="font-size:10px;padding:3px 8px" onclick="_setHand(\'R\',this)">우투</button>'
      + '<button class="chip ph-chip" style="font-size:10px;padding:3px 8px" onclick="_setHand(\'L\',this)">좌투</button>';
    roleChips.parentElement.insertBefore(handRow, roleChips);
  }

  // ③ CSS
  var style = document.createElement('style');
  style.textContent = [
    '#sfBdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1900;display:none}',
    '#sfPanel{position:fixed;bottom:0;left:0;right:0;z-index:1901;background:var(--bg-card,#111118);',
    '  border-radius:16px 16px 0 0;padding:0 0 env(safe-area-inset-bottom,12px);',
    '  transform:translateY(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);',
    '  max-height:80vh;overflow-y:auto;max-width:520px;margin:0 auto}',
    '#sfPanel.sf-open{transform:translateY(0)}',
    '.sfp-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px;',
    '  border-bottom:1px solid var(--border2,#1e2535)}',
    '.sfp-title{font-size:14px;font-weight:800;color:var(--text,#eef0f8)}',
    '.sfp-x{background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0 2px;line-height:1}',
    '.sfp-sec{padding:10px 14px 2px}',
    '.sfp-lbl{font-size:9px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}',
    '.sfp-row{display:flex;flex-wrap:wrap;gap:5px}',
    '.sfc{padding:4px 10px;border-radius:12px;border:1px solid var(--border2,#1e2535);',
    '  background:var(--bg,#07090f);color:var(--text2,#7c8898);font-size:11px;font-weight:600;',
    '  font-family:var(--font);cursor:pointer;transition:all .12s;white-space:nowrap;',
    '  -webkit-tap-highlight-color:transparent}',
    '.sfc-on{background:var(--blue,#4b8cf5);border-color:var(--blue,#4b8cf5);color:#fff}',
    '.sfp-foot{display:flex;gap:8px;padding:12px 14px 6px;border-top:1px solid var(--border2,#1e2535);margin-top:6px}',
    '.sfp-reset{flex:1;padding:9px;border-radius:8px;border:1px solid var(--border2);background:none;',
    '  color:var(--text2);font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer}',
    '.sfp-apply{flex:2;padding:9px;border-radius:8px;border:none;background:var(--blue,#4b8cf5);',
    '  color:#fff;font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer}'
  ].join('');
  document.head.appendChild(style);

  // ④ 패널 HTML
  var panel = document.createElement('div');
  panel.id = 'sfPanel';
  panel.innerHTML =
    '<div class="sfp-hdr">'
    + '<span class="sfp-title">🔽 스프레이 필터</span>'
    + '<button class="sfp-x" onclick="_sfClose()">✕</button>'
    + '</div>'

    // 구종
    + '<div class="sfp-sec"><div class="sfp-lbl">구종</div><div class="sfp-row">'
    + ['직구','커브','슬라이더','체인지업','포크볼','커터'].map(function(v) {
        return '<button class="sfc" data-key="pt" data-val="' + v + '" onclick="_sfChip(this)">' + v + '</button>';
      }).join('')
    + '</div></div>'

    // 타구 결과
    + '<div class="sfp-sec"><div class="sfp-lbl">타구 결과</div><div class="sfp-row">'
    + [
        ['안타','안타'],['2루타','2루타'],['3루타','3루타'],['홈런','홈런'],
        ['삼진','삼진'],['볼넷','볼넷'],['플라이 아웃','플라이'],['땅볼 아웃','땅볼'],['병살','병살']
      ].map(function(pair) {
        return '<button class="sfc" data-key="res" data-val="' + pair[0] + '" onclick="_sfChip(this)">' + pair[1] + '</button>';
      }).join('')
    + '</div></div>'

    // 투수 손
    + '<div class="sfp-sec"><div class="sfp-lbl">투수 손</div><div class="sfp-row">'
    + [['R','우투(R)'],['L','좌투(L)']].map(function(pair) {
        return '<button class="sfc" data-key="hand" data-val="' + pair[0] + '" data-single="1" onclick="_sfChip(this)">' + pair[1] + '</button>';
      }).join('')
    + '<span style="font-size:9px;color:var(--text3);align-self:center;margin-left:4px">※ 투수 등록 시 손 설정 필요</span>'
    + '</div></div>'

    // 카운트
    + '<div class="sfp-sec"><div class="sfp-lbl">카운트</div><div class="sfp-row">'
    + [
        ['first','초구 (0-0)'],['pitcher','투수 유리 (2S)'],
        ['batter','타자 유리 (2B↑)'],['full','풀카운트 (3-2)']
      ].map(function(pair) {
        return '<button class="sfc" data-key="count" data-val="' + pair[0] + '" data-single="1" onclick="_sfChip(this)">' + pair[1] + '</button>';
      }).join('')
    + '</div></div>'

    + '<div class="sfp-foot">'
    + '<button class="sfp-reset" onclick="_sfReset()">초기화</button>'
    + '<button class="sfp-apply" onclick="_sfApply()">적용</button>'
    + '</div>';

  document.body.appendChild(panel);

  // ⑤ 배경 클릭 닫기
  var bdrop = document.createElement('div');
  bdrop.id = 'sfBdrop';
  bdrop.onclick = _sfClose;
  document.body.appendChild(bdrop);
}

// ── 초기화 ───────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _build);
} else {
  _build();
}
