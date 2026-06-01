/**
 * SprayLab — 타격 성향 AI 인사이트 (규칙 기반)
 *
 * 분석 항목: 당겨치기 / 밀어치기 / 땅볼 / 뜬공 / 변화구 약점 / 강한 타구
 * - 복잡한 모델 없음. 기존 a.abs 데이터만 단일 패스로 집계.
 * - 새 규칙 추가: _analyze() 안에 블록 하나 push 하면 끝.
 *
 * 데이터 필드: a.res(결과) a.pt(구종) a.zone(코스) a.deg(방향각)
 *             a.ft(추정거리) a.count(카운트) a.hand(투수손)
 */

var _HITS  = ['안타', '내야안타', '2루타', '3루타', '홈런'];
var _XBH   = ['2루타', '3루타', '홈런'];
var _BREAK = ['커브', '슬라이더', '체인지업', '포크볼', '커터']; // 변화구

function _isHit(r)  { return _HITS.indexOf(r) >= 0; }
function _inside(z) { return !!z && z.indexOf('내각') >= 0; }
function _outside(z){ return !!z && z.indexOf('외각') >= 0; }
function _avg3(v)   { return v.toFixed(3).replace('0.', '.'); }

// ── 핵심 분석 (단일 패스, 가벼운 계산) ───────────────────────
function _analyze(abs) {
  var out = [];
  if (!abs || abs.length < 3) return out;

  // 방향 있는 타구
  var bd   = abs.filter(function(a) { return a.deg != null; });
  var pull = bd.filter(function(a) { return a.deg < 72; });
  var oppo = bd.filter(function(a) { return a.deg > 108; });
  var pullR = bd.length ? pull.length / bd.length : 0;
  var oppoR = bd.length ? oppo.length / bd.length : 0;

  // 땅볼 / 뜬공 (인플레이 아웃 기준)
  var gb  = abs.filter(function(a) { return a.res === '땅볼 아웃' || a.res === '병살'; }).length;
  var fb  = abs.filter(function(a) { return a.res === '플라이 아웃'; }).length;
  var bip = gb + fb;
  var gbR = bip ? gb / bip : 0;

  // ── 1. 당겨치는 성향 ──
  if (bd.length >= 3 && pullR >= 0.6) {
    var pHit = pull.filter(function(a) { return _isHit(a.res); }).length;
    if (pHit / pull.length >= 0.5)
      out.push({ type: 'pos',  icon: '↩️', text: '당겨치는 성향이 강하며 타구 질도 우수함 (' + Math.round(pullR * 100) + '%)' });
    else
      out.push({ type: 'warn', icon: '↩️', text: '당겨치는 성향이 강함 (' + Math.round(pullR * 100) + '%) — 바깥쪽 변화구에 취약 가능' });
  }

  // ── 2. 밀어치는 성향 ──
  if (bd.length >= 3 && oppoR >= 0.3) {
    var oHit = oppo.filter(function(a) { return _isHit(a.res); }).length;
    var oXbh = oppo.filter(function(a) { return _XBH.indexOf(a.res) >= 0; }).length;
    if (oXbh > 0 || oHit / oppo.length >= 0.5)
      out.push({ type: 'pos', icon: '↪️', text: '밀어치는 타구 질이 우수함 (' + Math.round(oppoR * 100) + '%)' });
    else
      out.push({ type: 'neu', icon: '↪️', text: '밀어치는 비율이 높음 (' + Math.round(oppoR * 100) + '%)' });
  }

  // ── 3. 땅볼 성향 (+ 코스 상관) ──
  if (bip >= 3 && gbR >= 0.6) {
    var inAbs = abs.filter(function(a) { return _inside(a.zone); });
    var inGb  = inAbs.filter(function(a) { return a.res === '땅볼 아웃' || a.res === '병살'; }).length;
    if (inAbs.length >= 2 && inGb / inAbs.length >= 0.5)
      out.push({ type: 'warn', icon: '⬇️', text: '몸쪽 공에서 땅볼 비율이 높음 (' + Math.round(inGb / inAbs.length * 100) + '%)' });
    else
      out.push({ type: 'warn', icon: '⬇️', text: '땅볼 타구 비율이 높음 (' + Math.round(gbR * 100) + '%) — 타구 각도 개선 필요' });
  }

  // ── 4. 뜬공 성향 (+ 코스 상관) ──
  if (bip >= 3 && gbR <= 0.35) {
    var outAbs = abs.filter(function(a) { return _outside(a.zone); });
    var outFb  = outAbs.filter(function(a) { return a.res === '플라이 아웃'; }).length;
    if (outAbs.length >= 2 && outFb / outAbs.length >= 0.5)
      out.push({ type: 'neu', icon: '⬆️', text: '바깥쪽 공을 띄우는 경향 (' + Math.round(outFb / outAbs.length * 100) + '%)' });
    else
      out.push({ type: 'pos', icon: '⬆️', text: '뜬공 타구 비율이 높음 (' + Math.round((1 - gbR) * 100) + '%)' });
  }

  // ── 5. 변화구 약점 / 강점 ──
  var brk = abs.filter(function(a) { return _BREAK.indexOf(a.pt) >= 0; });
  if (brk.length >= 3) {
    var bK   = brk.filter(function(a) { return a.res === '삼진'; }).length;
    var bHit = brk.filter(function(a) { return _isHit(a.res); }).length;
    var bKr  = bK / brk.length;
    var bAvg = bHit / brk.length;
    if (bKr >= 0.4)
      out.push({ type: 'warn', icon: '🌀', text: '변화구에 약점 — 삼진율 ' + Math.round(bKr * 100) + '%' });
    else if (bAvg <= 0.2)
      out.push({ type: 'warn', icon: '🌀', text: '변화구 대처 미흡 — 안타율 ' + _avg3(bAvg) });
    else if (bAvg >= 0.4)
      out.push({ type: 'pos',  icon: '🌀', text: '변화구 공략 능숙 — 안타율 ' + _avg3(bAvg) });
  }

  // ── 6. 강한 타구 경향 ──
  var ftAbs = abs.filter(function(a) { return typeof a.ft === 'number' && a.deg != null; });
  if (ftAbs.length >= 3) {
    var hard  = ftAbs.filter(function(a) { return a.ft >= 230 || _XBH.indexOf(a.res) >= 0; }).length;
    var hardR = hard / ftAbs.length;
    var avgFt = Math.round(ftAbs.reduce(function(s, a) { return s + a.ft; }, 0) / ftAbs.length);
    if (hardR >= 0.4)
      out.push({ type: 'pos', icon: '💪', text: '강한 타구 생산력 우수 (평균 ' + avgFt + 'ft)' });
    else if (avgFt < 180)
      out.push({ type: 'neu', icon: '🎯', text: '타구 비거리가 짧은 편 (평균 ' + avgFt + 'ft) — 컨택 위주' });
  }

  return out;
}

// ── 렌더링 ────────────────────────────────────────────────────
function _renderTendencies(bAbs) {
  var el = document.getElementById('tendencyList');
  if (!el) return;
  var ins = _analyze(bAbs || []);
  if (!ins.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">3타석 이상 기록하면 성향을 분석합니다</div>';
    return;
  }
  var col = { pos: '#2dd4a0', warn: '#f6c23e', neu: '#4b8cf5' };
  el.innerHTML = ins.map(function(x, i) {
    return '<div class="ai-card ai-' + x.type + '" style="display:flex;align-items:flex-start;gap:8px;'
      + 'padding:9px 10px;background:var(--bg-raised);border-radius:8px;border-left:3px solid '
      + col[x.type] + ';margin-bottom:5px;animation-delay:' + (i * 50) + 'ms">'
      + '<span class="ai-icon">' + x.icon + '</span>'
      + '<span class="ai-text">' + x.text + '</span></div>';
  }).join('');
}

// ── 카드 DOM 주입 (#aiInsightCard 바로 아래) ─────────────────
function _build() {
  if (document.getElementById('tendencyCard')) return;
  var aiCard = document.getElementById('aiInsightCard');
  if (!aiCard) return;
  var card = document.createElement('div');
  card.className = 'stat-card';
  card.id = 'tendencyCard';
  card.innerHTML =
    '<div class="sc-title">🎯 타격 성향 분석 '
    + '<span style="font-size:9px;color:var(--text3);font-weight:400;margin-left:4px">(규칙 기반 자동)</span></div>'
    + '<div id="tendencyList"><div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">'
    + '3타석 이상 기록하면 성향을 분석합니다</div></div>';
  aiCard.parentElement.insertBefore(card, aiCard.nextSibling);

  // DOMContentLoaded 이후에 패치 — 이 시점에 renderAIInsights가 정의되어 있음
  var orig = window.renderAIInsights;
  if (typeof orig === 'function') {
    window.renderAIInsights = function(bAbs) {
      orig.apply(this, arguments);
      _renderTendencies(bAbs);
    };
  }

  if (window.AS && window.AS.batter && window.AS.abs) {
    _renderTendencies(window.AS.abs.filter(function(a) { return a.bid === window.AS.batter.id; }));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _build);
} else {
  _build();
}
