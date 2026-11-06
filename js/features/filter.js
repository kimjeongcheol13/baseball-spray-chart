/**
 * SprayLab — 스프레이 차트 필터 시스템
 * 구종 / 타구 결과 / 좌우투수 / 카운트 / 주자 상황
 */

// ── 필터 상태 ─────────────────────────────────────────────────
var _SF = {
  pt:    [],   // 구종: ['직구', '슬라이더', ...]
  res:   [],   // 타구 결과: ['안타', '홈런', ...]
  hand:  null, // 투수: 'L' | 'R' | null
  count: null, // 카운트: 'first' | 'pitcher' | 'batter' | 'full' | null
  sit:   null  // 주자 상황: 'risp' | 'on' | 'empty' | 'two' | null
};
// 현재 투수 투구 손 (새 기록에 스탬프)
var _pitcherHand = null;

// ── 필터 판정 ─────────────────────────────────────────────────
// 그 타석 직전 주자 · 아웃 = 경기 운영 모드로 적은 타석(gfPre)만 안다 (coachnotes.js 와 같은 판정). 2아웃은 볼카운트로 적은 아웃(count.o)도 본다
function _sitOk(a) {
  var p = a.gfPre, b = p && Array.isArray(p.bases) ? p.bases : null;
  if (_SF.sit === 'two') return (p && p.outs != null ? p.outs : a.count && a.count.o) === 2;
  if (!b) return false;
  if (_SF.sit === 'risp')  return !!(b[1] || b[2]);
  if (_SF.sit === 'on')    return !!(b[0] || b[1] || b[2]);
  if (_SF.sit === 'empty') return !(b[0] || b[1] || b[2]);
  return true;
}
function _pass(a) {
  var L = a && a.pa != null && window.PitchLink ? window.PitchLink.of(a) : null;   // P2: 투구 기록과 연결된 타구 → 그 기록의 카운트 · 구종 · 투수 손
  var pt = (L && L.pt) || a.pt, hand = (L && L.hand) || a.hand;
  if (_SF.pt.length    && _SF.pt.indexOf(pt) < 0)     return false;
  if (_SF.res.length   && _SF.res.indexOf(a.res) < 0) return false;
  if (_SF.hand != null && hand !== _SF.hand)          return false;
  if (_SF.count != null) {
    var c = L ? L.count : (a.count || {}), b = c.b || 0, s = c.s || 0;
    if (_SF.count === 'first'   && !(b === 0 && s === 0))          return false;
    if (_SF.count === 'pitcher' && s < 2)                          return false;
    if (_SF.count === 'batter'  && !(b >= 2 && b > s))            return false;
    if (_SF.count === 'full'    && !(b === 3 && s === 2))          return false;
  }
  if (_SF.sit != null && !_sitOk(a)) return false;
  return true;
}
// 공유 링크에 실을 수 있는 조건 — 주자 상황은 빠진다 (링크의 타석에 gfPre 가 없어 받는 쪽에서 판정할 수 없음)
function _isSharable() {
  return _SF.pt.length > 0 || _SF.res.length > 0 || _SF.hand != null || _SF.count != null;
}
function _isActive() { return _isSharable() || _SF.sit != null; }
// 외부 노출 (heatmap.js·spray.js 등에서 사용)
window._sfPass = _pass;
window._sfCount = function() { return _SF.pt.length + _SF.res.length + (_SF.hand ? 1 : 0) + (_SF.count ? 1 : 0) + (_SF.sit ? 1 : 0); };

// ── 공유 링크 (core.js _shareGameBuild · loadSharedGame): 지금 필터를 싣고, 받은 필터를 켠다 ──
var _SF_HAND = { L: '좌투수 상대', R: '우투수 상대' }, _SF_CNT = { first: '초구', pitcher: '투수 유리', batter: '타자 유리', full: '풀카운트' };
function _sfLabel() {
  return _SF.pt.concat(_SF.res, _SF.hand ? [_SF_HAND[_SF.hand]] : [], _SF.count ? [_SF_CNT[_SF.count]] : []).join(' · ');
}
window._sfLabel = function() { return _isSharable() ? _sfLabel() : ''; };
window._sfState = function() { return _isSharable() ? { pt: _SF.pt.slice(), res: _SF.res.slice(), hand: _SF.hand, count: _SF.count } : null; };
// 받은 값은 형식이 맞는 것만 (짧은 문자열 목록 · L/R · 카운트 이름) — 필터 객체가 아니면 주자 상황만 끄고 '' 를 돌려준다
window._sfSetState = function(s) {
  _SF.sit = null;   // 링크의 타석엔 gfPre 가 없어, 켜 두면 점이 다 사라진다 — 링크에 필터가 없어도 끈다
  if (!s || typeof s !== 'object') { _syncChips(); _updateBadge(); return ''; }
  var list = function(a) { return Array.isArray(a) ? a.filter(function(v) { return typeof v === 'string' && v.length <= 12; }).slice(0, 20) : []; };
  _SF.pt = list(s.pt); _SF.res = list(s.res);
  _SF.hand = s.hand === 'L' || s.hand === 'R' ? s.hand : null;
  _SF.count = ['first', 'pitcher', 'batter', 'full'].indexOf(s.count) >= 0 ? s.count : null;
  _syncChips(); _updateBadge();
  return window._sfLabel();
};
// 타석의 투수 손 — _pass 와 같은 판정 (투구 기록과 연결된 타구는 그 기록의 손). 공유 링크에 싣는다
window._sfHand = function(a) {
  var L = a && a.pa != null && window.PitchLink ? window.PitchLink.of(a) : null;
  return (L && L.hand) || (a && a.hand);
};

// ── 함수 패치: _build() 안에서 DOMContentLoaded 이후 호출 ─────
function _applyPatches() {
  var origDrawDot = window.drawDot;
  if (typeof origDrawDot === 'function') {
    window.drawDot = function(r) {
      if (_isActive() && !_pass(r)) return;
      origDrawDot.call(this, r);
    };
  }
  ['recHit', 'recOther'].forEach(function(fn) {
    var orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function() {
      orig.apply(this, arguments);
      _stampHand();
    };
  });
}

// ── recHit / recOther 패치: 투수 손 스탬프 ───────────────────
function _stampHand() {
  var abs = window.AS && window.AS.abs;
  if (!abs || !abs.length) return;
  var last = abs[abs.length - 1];
  if (last && last.hand === undefined) last.hand = _pitcherHand;
}
// ── 배지 업데이트 ─────────────────────────────────────────────
function _updateBadge() {
  var cnt = window._sfCount();
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
    if (key === 'sit')   on = _SF.sit   === val;
    if (key === 'ov')    on = !!(window._fieldOv && window._fieldOv[val]);
    el.classList.toggle('sfc-on', !!on);
  });
}

// ── 칩 토글 ──────────────────────────────────────────────────
function _sfChip(el) {
  var key = el.dataset.key, val = el.dataset.val;
  var single = el.dataset.single === '1';
  if (key === 'ov') { // 필드 표시 토글: 즉시 적용 + localStorage 저장
    if (window.setFieldOverlay) window.setFieldOverlay(val, !(window._fieldOv && window._fieldOv[val]));
    _syncChips();
    return;
  }
  if (key === 'pt' || key === 'res') {
    var arr = _SF[key];
    var idx = arr.indexOf(val);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(val);
  } else {
    // single-select (hand, count, sit)
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
  _SF.pt = []; _SF.res = []; _SF.hand = null; _SF.count = null; _SF.sit = null;
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
    '  color:#fff;font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer}',
    '@media (max-width:720px){#sfPanel .sfc,#sfPanel .sfp-x,#sfPanel .sfp-reset,#sfPanel .sfp-apply{min-width:44px;min-height:44px}}'
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
        ['삼진','삼진'],['볼넷','볼넷'],['플라이 아웃','플라이'],['땅볼 아웃','땅볼'],['라인드라이브 아웃','라인'],['병살','병살'],['실책','실책'],['야수선택','야선']
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

    // 주자 상황
    + '<div class="sfp-sec"><div class="sfp-lbl">주자 상황</div><div class="sfp-row">'
    + [['risp','득점권'],['on','주자 있음'],['empty','주자 없음'],['two','2아웃']].map(function(pair) {
        return '<button class="sfc" data-key="sit" data-val="' + pair[0] + '" data-single="1" onclick="_sfChip(this)">' + pair[1] + '</button>';
      }).join('')
    + '<span style="font-size:9px;color:var(--text3);align-self:center;margin-left:4px">※ 주자는 경기 운영 모드로 적은 타석만</span>'
    + '</div></div>'

    // 필드 표시 (기본 OFF)
    + '<div class="sfp-sec"><div class="sfp-lbl">필드 표시</div><div class="sfp-row">'
    + [['arcs','거리 호·거리'],['dir','당겨치기/밀어치기'],['ang','15° 각도선'],['legend','범례']].map(function(pair) {
        return '<button class="sfc" data-key="ov" data-val="' + pair[0] + '" onclick="_sfChip(this)">' + pair[1] + '</button>';
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

  // DOMContentLoaded 이후 패치 — 인라인 drawDot/recHit/recOther가 모두 정의된 시점
  _applyPatches();
}

// ── 초기화 ───────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _build);
} else {
  _build();
}
