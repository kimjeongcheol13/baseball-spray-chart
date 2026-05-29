/**
 * SprayLab — 렌더링 성능 최적화
 *
 * 최적화 항목:
 *  1. safeRender rAF 중복 제거  — 동일 JS 틱 내 다중 호출 → 1회만 실행
 *  2. _showNearDot 스로틀       — mousemove/touchmove 최대 60fps 제한
 *  3. getBoundingClientRect 캐시 — 150ms 내 재쿼리 방지 (강제 레이아웃 억제)
 *  4. 가시 타구 리스트 캐시     — AS.abs filter 재계산 방지
 *
 * 기존 구조·함수 변경 없음. 전부 래핑 패치만 사용.
 */
(function () {
  'use strict';

  // ── 공유: 가시 타구 리스트 캐시 ──────────────────────────────
  // _showNearDot와 safeRender 양쪽에서 참조
  var _visList = null;
  var _visKey  = '';

  function _makeKey() {
    var as = window.AS;
    if (!as) return '';
    return as.abs.length
      + '|' + (as.batterFilter ? (as.batter ? as.batter.id : 'bf') : '')
      + '|' + (as.teamFilter || '');
  }

  function _getVis() {
    var as = window.AS;
    if (!as) return [];
    var k = _makeKey();
    if (_visList && k === _visKey) return _visList;
    // core.js _showNearDot 와 동일한 필터 조건
    var list = as.abs;
    if (as.batterFilter && as.batter)
      list = list.filter(function (a) { return a.bid === as.batter.id; });
    if (as.teamFilter)
      list = list.filter(function (a) { return (a.team || 'home') === as.teamFilter; });
    _visList = list.filter(function (a) { return a.x != null; });
    _visKey  = k;
    return _visList;
  }

  function _invalidate() { _visList = null; }

  // ── 1. safeRender rAF 중복 제거 ──────────────────────────────
  // updateAll() 등에서 동기적으로 여러 번 호출돼도 rAF 1번만 예약
  function _patchSafeRender() {
    var orig = window.safeRender;
    if (typeof orig !== 'function') return;
    var _p = false;
    window.safeRender = function () {
      if (_p) return;
      _p = true;
      _invalidate();                                  // 렌더 직전 캐시 무효화
      requestAnimationFrame(function () { _p = false; });
      orig.apply(this, arguments);
    };
  }

  // ── 2-4. _showNearDot: 스로틀 + rect 캐시 + 리스트 캐시 ─────
  function _patchShowNearDot() {
    var orig = window._showNearDot;
    if (typeof orig !== 'function') return;

    var _fC    = null;
    var _rect  = null, _rectT = 0;
    var _lastT = 0;

    // getBoundingClientRect 캐시 (150ms TTL)
    function _getRect() {
      if (!_fC) _fC = document.getElementById('fldCanvas');
      if (!_fC) return null;
      var now = performance.now();
      if (_rect && now - _rectT < 150) return _rect;
      _rect  = _fC.getBoundingClientRect();
      _rectT = now;
      return _rect;
    }

    // 스크롤·리사이즈 시 rect 무효화
    window.addEventListener('scroll', function () { _rect = null; }, { passive: true });
    window.addEventListener('resize', function () { _rect = null; _invalidate(); }, { passive: true });

    window._showNearDot = function (cx, cy) {
      // ① 스로틀: 16ms (~60fps) 미만 호출 무시
      var now = performance.now();
      if (now - _lastT < 16) return;
      _lastT = now;

      if (!window.AS) return;

      // ② fldCanvas 초기화 전이면 원본으로 폴백
      if (!_fC) _fC = document.getElementById('fldCanvas');
      if (!_fC || !_fC.width) { orig.call(this, cx, cy); return; }

      // ③ 캐시된 rect
      var r = _getRect();
      if (!r) return;

      var FS = _fC.width;
      var x  = (cx - r.left) * (FS / r.width);
      var y  = (cy - r.top)  * (FS / r.height);

      // ④ 캐시된 가시 리스트로 nearest-dot 탐색
      var vis  = _getVis();
      var THR  = Math.max(30, FS * 0.07);
      var THR2 = THR * THR;
      var best = null, bestD = Infinity;
      for (var i = 0, n = vis.length; i < n; i++) {
        var a  = vis[i];
        var dx = x - a.x * FS, dy = y - a.y * FS;
        var d2 = dx * dx + dy * dy;
        if (d2 < bestD && d2 < THR2) { bestD = d2; best = a; }
      }

      if (best) { if (window.showHitDetail)  window.showHitDetail(best, cx, cy); }
      else       { if (window.closeHitDetail) window.closeHitDetail(); }
    };
  }

  // ── 초기화 ───────────────────────────────────────────────────
  // heatmap._init() 도 DOMContentLoaded에서 safeRender를 패치하므로
  // 이 모듈은 app.js에서 heatmap.js 보다 나중에 import → 항상 최상위 래퍼가 됨
  function _init() {
    _patchSafeRender();
    // _patchShowNearDot 제거: 원본 _showNearDot이 showHitDetail을 직접 호출하도록
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
}());
