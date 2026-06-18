// Amateur Baseball Savant — Entry Point
// Imports new feature modules and initializes the Savant navigation

import './features/profile.js';
import './features/compare.js';
import './features/scouting.js';
import './features/heatmap.js';
import './features/filter.js';
import './features/insights.js';
import './features/perf.js';

// ── Bottom Navigation ──
function initSavantNav() {
  const nav = document.getElementById('savantNav');
  if (!nav) return;

  nav.addEventListener('click', function(e) {
    const btn = e.target.closest('.savant-nav-btn');
    if (!btn) return;
    const view = btn.dataset.view;
    if (!view) return;

    // Update nav active state
    nav.querySelectorAll('.savant-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Toggle views
    if (view === 'record') {
      // Back to main app view
      document.querySelectorAll('.savant-view').forEach(v => v.classList.remove('active'));
      document.getElementById('app-page').style.display = '';
      return;
    }

    // Hide main app, show savant view
    document.getElementById('app-page').style.display = 'none';
    document.querySelectorAll('.savant-view').forEach(v => v.classList.remove('active'));

    const viewEl = document.getElementById(view + 'View');
    if (viewEl) viewEl.classList.add('active');

    // Initialize view content
    switch(view) {
      case 'profile':
        if (window.openProfileView) window.openProfileView();
        break;
      case 'compare':
        if (window.openCompareView) window.openCompareView();
        break;
      case 'scout':
        if (window.openScoutView) window.openScoutView();
        break;
      case 'spray': {
        document.getElementById('app-page').style.display = '';
        document.querySelectorAll('.savant-view').forEach(v => v.classList.remove('active'));
        // Pair the center spray canvas with batter stats (if batter selected) or team stats
        const _sprayTab = (window.AS && window.AS.batter) ? 'batter' : 'stat';
        const _sprayEl = document.getElementById('tab-' + _sprayTab);
        if (window.swTab && _sprayEl) window.swTab(_sprayTab, _sprayEl);
        // Redraw so hit dots are visible
        if (window.drawField) window.drawField();
        if (window.safeRender) window.safeRender();
        break;
      }
    }
  });
}

// ── Enhanced Filter Bar for Heatmap ──
function initFilterBar() {
  const bar = document.getElementById('sprayFilterBar');
  if (!bar) return;

  bar.addEventListener('click', function(e) {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;

    const group = chip.dataset.group;
    const value = chip.dataset.value;

    if (group) {
      // Radio behavior within group
      bar.querySelectorAll(`.filter-chip[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
    }
    chip.classList.toggle('active');

    applySprayFilters();
  });
}

function applySprayFilters() {
  const bar = document.getElementById('sprayFilterBar');
  if (!bar) return;

  const activeChips = bar.querySelectorAll('.filter-chip.active');
  const filters = {};
  activeChips.forEach(c => {
    const group = c.dataset.group;
    const value = c.dataset.value;
    if (group && value) filters[group] = value;
  });

  // Apply to AS.advFilter
  if (window.AS) {
    if (Object.keys(filters).length === 0) {
      window.AS.advFilter = null;
    } else {
      window.AS.advFilter = filters;
    }
    if (window.safeRender) window.safeRender();
  }
}

// ── Enhanced AI Insights (15-20 rules) ──
function enhancedInsights(bAbs) {
  if (!bAbs || bAbs.length < 2) return [];
  const HITS = ['안타','내야안타','2루타','3루타','홈런'];
  const NOAB = ['볼넷','사구','희타','희비'];
  const insights = [];

  const oab = bAbs.filter(a => !NOAB.includes(a.res)).length;
  if (!oab) return insights;
  const h = bAbs.filter(a => HITS.includes(a.res)).length;
  const avg = h / oab;
  const k = bAbs.filter(a => a.res === '삼진').length;
  const bb = bAbs.filter(a => a.res === '볼넷' || a.res === '사구').length;
  const hr = bAbs.filter(a => a.res === '홈런').length;
  const xbh = bAbs.filter(a => ['2루타','3루타','홈런'].includes(a.res)).length;
  const pa = bAbs.length;
  const rbi = bAbs.reduce((s, a) => s + (a.rbi||0), 0);
  const tb = bAbs.reduce((s, a) => {
    const bm = {'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
    return s + (bm[a.res]||0);
  }, 0);
  const slg = oab ? tb / oab : 0;
  const isoP = slg - avg;
  const kRate = pa ? k / pa : 0;
  const bbRate = pa ? bb / pa : 0;

  // Direction
  const fd = bAbs.filter(a => a.deg != null);
  const tot = fd.length || 1;
  const pull = fd.filter(a => a.deg < 72).length;
  const oppo = fd.filter(a => a.deg > 108).length;
  const center = fd.length - pull - oppo;
  const pullR = pull / tot;
  const oppoR = oppo / tot;
  const centerR = center / tot;

  // Ground ball vs fly ball
  const gb = bAbs.filter(a => a.res === '땅볼 아웃').length;
  const fb = bAbs.filter(a => a.res === '플라이 아웃').length;
  const gbRate = (gb + fb) ? gb / (gb + fb) : 0;

  // ── 1. Batting average assessment
  if (avg >= 0.500 && oab >= 3)
    insights.push({type:'pos', severity:'critical', icon:'🔥', text:'타율 '+avg.toFixed(3).replace('0.','.')+' — 오늘 최고의 컨디션입니다!'});
  else if (avg >= 0.333 && oab >= 3)
    insights.push({type:'pos', severity:'info', icon:'📊', text:'타율 '+avg.toFixed(3).replace('0.','.')+' — 안정적인 타격을 이어가고 있습니다.'});
  else if (avg < 0.150 && oab >= 4)
    insights.push({type:'warn', severity:'critical', icon:'📉', text:'타율 '+avg.toFixed(3).replace('0.','.')+' — 부진 경고. 타이밍 리셋이 필요합니다.'});
  else if (avg < 0.200 && oab >= 3)
    insights.push({type:'warn', severity:'warn', icon:'📉', text:'타율 '+avg.toFixed(3).replace('0.','.')+' — 타격감이 떨어지고 있습니다.'});

  // ── 2. Strikeout rate
  if (kRate >= 0.60 && k >= 3)
    insights.push({type:'warn', severity:'critical', icon:'⚡', text:'삼진율 '+Math.round(kRate*100)+'% — 심각한 수준. 컨택 위주 타격으로 전환하세요.'});
  else if (kRate >= 0.40 && k >= 2)
    insights.push({type:'warn', severity:'warn', icon:'⚡', text:'삼진율 '+Math.round(kRate*100)+'% — 스트라이크존 공략을 재점검하세요.'});

  // ── 3. Walk rate (plate discipline)
  if (bbRate >= 0.20 && bb >= 2)
    insights.push({type:'pos', severity:'info', icon:'👁️', text:'볼넷 비율 '+Math.round(bbRate*100)+'% — 뛰어난 선구안! 참을성 있는 타격.'});
  else if (bb >= 3)
    insights.push({type:'pos', severity:'info', icon:'👁️', text:'볼넷 '+bb+'개 — 출루 능력이 돋보입니다.'});

  // ── 4. Power (ISO)
  if (isoP >= 0.300 && xbh >= 2)
    insights.push({type:'pos', severity:'critical', icon:'💥', text:'ISO '+isoP.toFixed(3)+' — 폭발적인 파워! 장타력이 빛나고 있습니다.'});
  else if (isoP >= 0.150 && xbh >= 1)
    insights.push({type:'pos', severity:'info', icon:'💪', text:'ISO '+isoP.toFixed(3)+' — 적정 수준의 장타력을 보여주고 있습니다.'});

  // ── 5. Home run production
  if (hr >= 2)
    insights.push({type:'pos', severity:'critical', icon:'🏠', text:'홈런 '+hr+'개! 오늘 타선의 핵심 파워 소스입니다.'});

  // ── 6. RBI production
  if (rbi >= 3)
    insights.push({type:'pos', severity:'info', icon:'🏅', text:rbi+'타점 — 주자를 잘 불러들이고 있습니다.'});

  // ── 7. Pull tendency (warning)
  if (pullR >= 0.75 && pull >= 3)
    insights.push({type:'warn', severity:'warn', icon:'↩️', text:'당겨치기 '+Math.round(pullR*100)+'% — 외각 변화구에 취약할 수 있습니다.'});

  // ── 8. Opposite field ability
  if (oppoR >= 0.40 && oppo >= 2)
    insights.push({type:'pos', severity:'info', icon:'↪️', text:'밀어치기 '+Math.round(oppoR*100)+'% — 반대 방향 공략 능력이 우수합니다.'});

  // ── 9. Balanced spray
  if (pullR >= 0.25 && pullR <= 0.45 && centerR >= 0.20 && fd.length >= 4)
    insights.push({type:'pos', severity:'info', icon:'⚖️', text:'균형 잡힌 타구 분포 — 전방향 공략이 가능한 타자입니다.'});

  // ── 10. Ground ball tendency
  if (gbRate >= 0.70 && (gb + fb) >= 3)
    insights.push({type:'warn', severity:'warn', icon:'⬇️', text:'땅볼 비율 '+Math.round(gbRate*100)+'% — 타구 각도를 높일 필요가 있습니다.'});
  else if (gbRate <= 0.30 && (gb + fb) >= 3)
    insights.push({type:'pos', severity:'info', icon:'⬆️', text:'플라이볼 타자 — 타구를 잘 띄우고 있습니다.'});

  // ── 11. Contact without hits
  if (h === 0 && bb >= 1 && oab >= 2)
    insights.push({type:'neu', severity:'info', icon:'🏃', text:'안타는 없지만 볼넷으로 출루 중. 투수를 괴롭히고 있습니다.'});

  // ── 12. Multi-hit game
  if (h >= 3)
    insights.push({type:'pos', severity:'critical', icon:'🌟', text:'멀티히트 게임! '+h+'안타로 타선을 리드하고 있습니다.'});

  // ── 13. K/BB ratio
  if (bb > 0 && k > 0) {
    const kbb = k / bb;
    if (kbb <= 1.0 && pa >= 4)
      insights.push({type:'pos', severity:'info', icon:'🎯', text:'K/BB 비율 '+kbb.toFixed(1)+' — 삼진보다 볼넷이 많은 이상적인 타격 접근.'});
    else if (kbb >= 3.0 && k >= 3)
      insights.push({type:'warn', severity:'warn', icon:'⚠️', text:'K/BB 비율 '+kbb.toFixed(1)+' — 타석에서의 인내심 개선이 필요합니다.'});
  }

  // ── 14. Clutch (RBI with few hits)
  if (rbi >= 2 && h <= 1 && oab >= 3)
    insights.push({type:'pos', severity:'info', icon:'🎪', text:'적은 안타('+h+')로 '+rbi+'타점 — 효율적인 클러치 타격!'});

  // ── 15. Infield hit ability
  const ih = bAbs.filter(a => a.res === '내야안타').length;
  if (ih >= 2)
    insights.push({type:'pos', severity:'info', icon:'💨', text:'내야안타 '+ih+'개 — 빠른 발을 활용한 적극적 타격.'});

  // ── 16. Extra-base hit percentage
  if (h > 0 && xbh / h >= 0.50 && xbh >= 2)
    insights.push({type:'pos', severity:'info', icon:'📈', text:'장타 비율 '+Math.round(xbh/h*100)+'% — 안타의 절반 이상이 장타!'});

  // Sort by severity: critical first, then warn, then info
  const sevOrder = {critical: 0, warn: 1, info: 2};
  insights.sort((a, b) => (sevOrder[a.severity]||2) - (sevOrder[b.severity]||2));

  return insights.slice(0, 6);
}

// Override the existing renderAIInsights if available
document.addEventListener('DOMContentLoaded', function() {
  if (typeof window.generateBattingInsights === 'function') {
    window._origGenerateBattingInsights = window.generateBattingInsights;
    window.generateBattingInsights = function(bAbs) {
      const enhanced = enhancedInsights(bAbs);
      return enhanced.length ? enhanced : window._origGenerateBattingInsights(bAbs);
    };
  }
});

// ── Initialize ──
document.addEventListener('DOMContentLoaded', function() {
  initSavantNav();
  initFilterBar();
});

// Expose
window.applySprayFilters = applySprayFilters;
window.initSavantNav = initSavantNav;
