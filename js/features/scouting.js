// Scouting report generator: analyzes weaknesses and generates pitch strategy
const HITS = ['안타','내야안타','2루타','3루타','홈런'];
const NOAB = ['볼넷','사구','희타','희비'];
const BASE = {'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
const OUTS = ['플라이 아웃','땅볼 아웃','삼진','병살'];
const ZONE_LABELS = [
  '내각 높음', '중앙 높음', '외각 높음',
  '내각 중간', '중앙 중간', '외각 중간',
  '내각 낮음', '중앙 낮음', '외각 낮음'
];
const SEVERITY = { HIGH: 'high', MED: 'med', LOW: 'low' };

let _currentReportText = '';
let _lastAnalysis = null;   // openScoutView 재진입 시 canvas 재드로우용
let _lastAllAbs = null;

export function openScoutView() {
  document.querySelectorAll('.savant-view').forEach(v => v.classList.remove('active'));
  document.getElementById('scoutView').classList.add('active');
  _currentReportText = '';
  renderScoutPlayerSelect();
  // 이미 선수가 선택되어 canvas가 생성된 상태라면 view 활성화 후 재드로우
  const sel = document.getElementById('scoutPlayerSelect');
  if (sel && sel.value) {
    setTimeout(() => {
      const c1 = document.getElementById('scoutStrengthCanvas');
      const c2 = document.getElementById('scoutWeaknessCanvas');
      const c3 = document.getElementById('scoutZoneCanvas');
      // canvas가 존재하면 재드로우 (_lastAnalysis 체크 제거)
      if (c1 && _lastAnalysis) {
        _paintZoneHeatmap('scoutStrengthCanvas', _lastAnalysis.zoneAvg, _lastAnalysis.zoneTotal, 'strength');
        _paintZoneHeatmap('scoutWeaknessCanvas', _lastAnalysis.zoneAvg, _lastAnalysis.zoneTotal, 'weakness');
        _paintZoneHeatmap('scoutZoneCanvas', _lastAnalysis.zoneAvg, _lastAnalysis.zoneTotal, 'all');
        _drawDirCanvas(_lastAnalysis);
        if (_lastAllAbs) _drawScoutFieldCanvas(_lastAllAbs);
      }
    }, 50);
  }
}

export function renderScoutPlayerSelect() {
  const sel = document.getElementById('scoutPlayerSelect');
  if (!sel) return;

  const players = _getAllPlayers();
  if (!players.length) {
    sel.innerHTML = '<option value="">선수 없음</option>';
    return;
  }

  sel.innerHTML = '<option value="">선수 선택</option>' +
    players.map(p => `<option value="${_esc(p.name)}">#${p.num} ${_esc(p.name)}</option>`).join('');

  sel.onchange = () => {
    if (sel.value) generateScoutReport(sel.value);
  };
}

export function generateScoutReport(playerName) {
  const allAbs = _gatherPlayerAbs(playerName);
  if (!allAbs.length) {
    const el = document.getElementById('scoutContent');
    if (el) el.innerHTML = '<div class="empty-state">해당 선수의 데이터가 없습니다</div>';
    _currentReportText = '';
    return;
  }

  const analysis = _analyzePlayer(playerName, allAbs);
  const findings = _generateFindings(analysis);
  const strategy = _generateStrategy(analysis, findings);

  // 재진입 시 canvas 재드로우를 위해 캐시
  _lastAnalysis = analysis;
  _lastAllAbs = allAbs;

  _renderScoutReport(playerName, analysis, findings, strategy, allAbs);
  _currentReportText = _buildTextReport(playerName, analysis, findings, strategy);

  // _renderScoutReport 내 setTimeout(50)과 별개로, view가 아직 hidden일 때를 대비한 추가 드로우
  setTimeout(() => {
    if (!_lastAnalysis) return;
    _paintZoneHeatmap('scoutStrengthCanvas', _lastAnalysis.zoneAvg, _lastAnalysis.zoneTotal, 'strength');
    _paintZoneHeatmap('scoutWeaknessCanvas', _lastAnalysis.zoneAvg, _lastAnalysis.zoneTotal, 'weakness');
    _paintZoneHeatmap('scoutZoneCanvas', _lastAnalysis.zoneAvg, _lastAnalysis.zoneTotal, 'all');
  }, 50);
}

export function exportScoutReport() {
  if (!_currentReportText) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(_currentReportText).then(() => {
      const btn = document.getElementById('scoutExportBtn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '복사 완료!';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      }
    });
  } else {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = _currentReportText;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const btn = document.getElementById('scoutExportBtn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '복사 완료!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }
  }
}

function _getAllPlayers() {
  const map = {};
  const AS = window.AS;

  const _add = p => {
    if (!p || !p.name) return;
    if (!map[p.name]) map[p.name] = { id: p.id, name: p.name, num: p.num };
  };

  [...(AS.home_lineup||[]), ...(AS.away_lineup||[])].forEach(_add);

  const saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
  saves.slice().reverse().forEach(s => {
    try {
      const d = JSON.parse(localStorage.getItem(s.key));
      if (!d) return;
      [...(d.home_lineup||[]), ...(d.away_lineup||[])].forEach(_add);
    } catch(e) {}
  });

  return Object.values(map);
}

function _gatherPlayerAbs(name) {
  const allAbs = [];
  const AS = window.AS;
  const currentAbs = (AS.abs||[]).filter(a => a.bname === name);
  if (currentAbs.length) allAbs.push(...currentAbs);

  const saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
  saves.forEach(s => {
    try {
      const d = JSON.parse(localStorage.getItem(s.key));
      if (!d || !d.abs) return;
      const pAbs = d.abs.filter(a => a.bname === name);
      if (pAbs.length) allAbs.push(...pAbs);
    } catch(e) {}
  });
  return allAbs;
}

function _analyzePlayer(name, allAbs) {
  const pa = allAbs.length;
  const ab = allAbs.filter(a => !NOAB.includes(a.res)).length;
  const h = allAbs.filter(a => HITS.includes(a.res)).length;
  const bb = allAbs.filter(a => a.res === '볼넷' || a.res === '사구').length;
  const k = allAbs.filter(a => a.res === '삼진').length;
  const hr = allAbs.filter(a => a.res === '홈런').length;
  const tb = allAbs.reduce((s, a) => s + (BASE[a.res]||0), 0);
  const sf = allAbs.filter(a => a.res === '희비').length;
  const gdp = allAbs.filter(a => a.res === '병살').length;
  const flyout = allAbs.filter(a => a.res === '플라이 아웃').length;
  const groundout = allAbs.filter(a => a.res === '땅볼 아웃').length;

  const avg = ab ? h / ab : 0;
  const obp = (ab + bb + sf) ? (h + bb) / (ab + bb + sf) : 0;
  const slg = ab ? tb / ab : 0;
  const kRate = pa ? k / pa : 0;
  const bbRate = pa ? bb / pa : 0;
  const isoP = slg - avg;
  const goAo = flyout ? groundout / flyout : groundout;

  // Zone analysis (3x3 grid based on zone property 1-9)
  const zoneHits = Array(9).fill(0);
  const zoneOuts = Array(9).fill(0);
  const zoneTotal = Array(9).fill(0);
  const zoneAvg = Array(9).fill(0);

  allAbs.forEach(a => {
    if (a.zone) {
      const idx = ZONE_LABELS.indexOf(a.zone);
      if (idx !== -1) {
        zoneTotal[idx]++;
        if (HITS.includes(a.res)) zoneHits[idx]++;
        if (OUTS.includes(a.res)) zoneOuts[idx]++;
      }
    }
  });

  for (let i = 0; i < 9; i++) {
    const zab = zoneTotal[i] - allAbs.filter(a => a.zone === ZONE_LABELS[i] && NOAB.includes(a.res)).length;
    zoneAvg[i] = zab > 0 ? zoneHits[i] / zab : 0;
  }

  // Direction analysis
  const dabs = allAbs.filter(a => a.deg != null);
  const pull = dabs.filter(a => a.deg < 72);
  const center = dabs.filter(a => a.deg >= 72 && a.deg <= 108);
  const oppo = dabs.filter(a => a.deg >= 108);

  const dirAvg = (arr) => {
    const dab = arr.filter(a => !NOAB.includes(a.res)).length;
    const dh = arr.filter(a => HITS.includes(a.res)).length;
    return dab > 0 ? dh / dab : 0;
  };

  const pullAvg = dirAvg(pull);
  const centerAvg = dirAvg(center);
  const oppoAvg = dirAvg(oppo);
  const pullPct = dabs.length ? pull.length / dabs.length : 0;
  const centerPct = dabs.length ? center.length / dabs.length : 0;
  const oppoPct = dabs.length ? oppo.length / dabs.length : 0;

  // Count-based analysis
  const countStats = {};
  allAbs.forEach(a => {
    if (a.count) {
      const key = `${a.count.b}-${a.count.s}`;
      if (!countStats[key]) countStats[key] = { pa: 0, h: 0, k: 0, bb: 0, ab: 0 };
      countStats[key].pa++;
      if (!NOAB.includes(a.res)) countStats[key].ab++;
      if (HITS.includes(a.res)) countStats[key].h++;
      if (a.res === '삼진') countStats[key].k++;
      if (a.res === '볼넷' || a.res === '사구') countStats[key].bb++;
    }
  });

  // Ahead/behind/even count grouping
  const aheadAbs = allAbs.filter(a => a.count && a.count.s > a.count.b);
  const behindAbs = allAbs.filter(a => a.count && a.count.b > a.count.s);
  const evenAbs = allAbs.filter(a => a.count && a.count.b === a.count.s);

  const countGroupAvg = (arr) => {
    const cab = arr.filter(a => !NOAB.includes(a.res)).length;
    const ch = arr.filter(a => HITS.includes(a.res)).length;
    return cab > 0 ? ch / cab : 0;
  };

  const aheadAvg = countGroupAvg(aheadAbs);
  const behindAvg = countGroupAvg(behindAbs);
  const evenAvg = countGroupAvg(evenAbs);

  // First-pitch result
  const firstPitchSwing = allAbs.filter(a => a.pitches && a.pitches.length > 0 && a.pitches[0] !== 'B');
  const firstPitchHit = firstPitchSwing.filter(a => HITS.includes(a.res));

  // Distance analysis
  const hitAbs = allAbs.filter(a => HITS.includes(a.res) && a.ft);
  const avgDist = hitAbs.length ? hitAbs.reduce((s, a) => s + a.ft, 0) / hitAbs.length : 0;

  return {
    name, pa, ab, h, bb, k, hr, tb, avg, obp, slg, kRate, bbRate, isoP, goAo,
    gdp, flyout, groundout,
    zoneHits, zoneOuts, zoneTotal, zoneAvg,
    pullAvg, centerAvg, oppoAvg, pullPct, centerPct, oppoPct,
    pullCount: pull.length, centerCount: center.length, oppoCount: oppo.length, dabsCount: dabs.length,
    countStats, aheadAvg, behindAvg, evenAvg,
    aheadCount: aheadAbs.length, behindCount: behindAbs.length, evenCount: evenAbs.length,
    firstPitchSwingPct: allAbs.length ? firstPitchSwing.length / allAbs.length : 0,
    avgDist, sf
  };
}

function _generateFindings(a) {
  const findings = [];

  // Rule 1: High strikeout rate
  if (a.kRate > 0.25) {
    findings.push({ severity: SEVERITY.HIGH, category: '삼진', text: `삼진율 ${Math.round(a.kRate*100)}%로 매우 높음. 체이스 유도 가능.` });
  } else if (a.kRate > 0.20) {
    findings.push({ severity: SEVERITY.MED, category: '삼진', text: `삼진율 ${Math.round(a.kRate*100)}%로 평균 이상.` });
  }

  // Rule 2: Low walk rate
  if (a.bbRate < 0.05 && a.pa >= 10) {
    findings.push({ severity: SEVERITY.HIGH, category: '선구안', text: `볼넷율 ${Math.round(a.bbRate*100)}%로 매우 낮음. 적극적인 스트라이크 투구 가능.` });
  } else if (a.bbRate < 0.08) {
    findings.push({ severity: SEVERITY.MED, category: '선구안', text: `볼넷율 ${Math.round(a.bbRate*100)}%로 낮음.` });
  }

  // Rule 3: Low ISO (no power)
  if (a.isoP < 0.100 && a.ab >= 10) {
    findings.push({ severity: SEVERITY.MED, category: '파워', text: `ISO ${a.isoP.toFixed(3)}으로 장타력 부족. 스트라이크존 안에서 대결 가능.` });
  }

  // Rule 4: High ISO (power hitter)
  if (a.isoP > 0.200) {
    findings.push({ severity: SEVERITY.HIGH, category: '파워', text: `ISO ${a.isoP.toFixed(3)}으로 장타력 높음. 존 안 직구 주의.` });
  }

  // Rule 5: Pull-heavy hitter
  if (a.pullPct > 0.50 && a.dabsCount >= 5) {
    findings.push({ severity: SEVERITY.HIGH, category: '방향', text: `당기는 타구 ${Math.round(a.pullPct*100)}%. 바깥쪽 공략 유리.` });
  }

  // Rule 6: Oppo-heavy hitter
  if (a.oppoPct > 0.40 && a.dabsCount >= 5) {
    findings.push({ severity: SEVERITY.MED, category: '방향', text: `밀어치는 타구 ${Math.round(a.oppoPct*100)}%. 몸쪽 공략 고려.` });
  }

  // Rule 7: Worse when behind in count
  if (a.behindAvg < 0.150 && a.behindCount >= 5) {
    findings.push({ severity: SEVERITY.HIGH, category: '카운트', text: `불리한 카운트 타율 ${a.behindAvg.toFixed(3)}. 초반 스트라이크 선취가 핵심.` });
  }

  // Rule 8: Better when ahead in count
  if (a.aheadAvg > 0.350 && a.aheadCount >= 3) {
    findings.push({ severity: SEVERITY.MED, category: '카운트', text: `유리한 카운트 타율 ${a.aheadAvg.toFixed(3)}. 카운트를 내주지 않아야 함.` });
  }

  // Rule 9: Ground ball double play tendency
  if (a.gdp >= 2) {
    findings.push({ severity: SEVERITY.MED, category: '땅볼', text: `병살 ${a.gdp}개. 낮은 공에 땅볼 유도 가능.` });
  }

  // Rule 10: High GO/AO ratio
  if (a.goAo > 1.5 && (a.groundout + a.flyout) >= 5) {
    findings.push({ severity: SEVERITY.MED, category: '타구성격', text: `GO/AO ${a.goAo.toFixed(1)}로 땅볼 타자. 낮은 공 유도 전략.` });
  }

  // Rule 11: Low GO/AO (fly ball hitter)
  if (a.goAo < 0.7 && (a.groundout + a.flyout) >= 5) {
    findings.push({ severity: SEVERITY.LOW, category: '타구성격', text: `GO/AO ${a.goAo.toFixed(1)}로 플라이볼 타자.` });
  }

  // Rule 12: Weak zones (out rate > 70% with >= 3 PA)
  for (let i = 0; i < 9; i++) {
    if (a.zoneTotal[i] >= 3) {
      const outRate = a.zoneOuts[i] / a.zoneTotal[i];
      if (outRate > 0.70) {
        findings.push({ severity: SEVERITY.HIGH, category: '존', text: `${ZONE_LABELS[i]} 존 아웃률 ${Math.round(outRate*100)}% (${a.zoneTotal[i]}타석). 적극 공략 존.` });
      }
    }
  }

  // Rule 13: Strong zones (avg > .350 with >= 3 AB)
  for (let i = 0; i < 9; i++) {
    if (a.zoneTotal[i] >= 3 && a.zoneAvg[i] > 0.350) {
      findings.push({ severity: SEVERITY.HIGH, category: '존', text: `${ZONE_LABELS[i]} 존 타율 ${a.zoneAvg[i].toFixed(3)}. 위험 존 - 피해야 함.` });
    }
  }

  // Rule 14: First pitch aggression
  if (a.firstPitchSwingPct > 0.50 && a.pa >= 5) {
    findings.push({ severity: SEVERITY.MED, category: '접근', text: `초구 스윙률 ${Math.round(a.firstPitchSwingPct*100)}%. 초구 변화구로 카운트 선취 가능.` });
  }

  // Rule 15: Patient hitter
  if (a.firstPitchSwingPct < 0.20 && a.pa >= 5) {
    findings.push({ severity: SEVERITY.LOW, category: '접근', text: `초구 스윙률 ${Math.round(a.firstPitchSwingPct*100)}%. 초구 스트라이크 유도.` });
  }

  // Rule 16: Overall weak average
  if (a.avg < 0.200 && a.ab >= 10) {
    findings.push({ severity: SEVERITY.LOW, category: '전체', text: `통산 타율 ${a.avg.toFixed(3)}. 전반적으로 부진한 타자.` });
  }

  // Rule 17: Pull direction but weak
  if (a.pullPct > 0.40 && a.pullAvg < 0.200 && a.pullCount >= 3) {
    findings.push({ severity: SEVERITY.MED, category: '방향', text: `당기는 방향 타율 ${a.pullAvg.toFixed(3)}로 낮음. 당기게 유도하면 아웃 확률 높음.` });
  }

  // Rule 18: Strong center hitter
  if (a.centerAvg > 0.350 && a.centerCount >= 3) {
    findings.push({ severity: SEVERITY.MED, category: '방향', text: `중앙 방향 타율 ${a.centerAvg.toFixed(3)}. 중앙 라인드라이브 주의.` });
  }

  // Rule 19: Small sample warning
  if (a.pa < 10) {
    findings.push({ severity: SEVERITY.LOW, category: '샘플', text: `총 ${a.pa}타석으로 표본이 적음. 분석 신뢰도 낮음.` });
  }

  // Rule 20: Even count performance
  if (a.evenAvg > 0.300 && a.evenCount >= 3) {
    findings.push({ severity: SEVERITY.LOW, category: '카운트', text: `이븐 카운트 타율 ${a.evenAvg.toFixed(3)}. 이븐에서도 경계 필요.` });
  }

  return findings.sort((a, b) => {
    const order = { high: 0, med: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

function _generateStrategy(analysis, findings) {
  const strategies = [];

  // Zone-based strategies
  const weakZones = [];
  const dangerZones = [];

  for (let i = 0; i < 9; i++) {
    if (analysis.zoneTotal[i] >= 2) {
      if (analysis.zoneAvg[i] < 0.200) weakZones.push(i);
      if (analysis.zoneAvg[i] > 0.350) dangerZones.push(i);
    }
  }

  if (weakZones.length > 0) {
    strategies.push({
      zone: '약점 존 공략',
      detail: weakZones.map(z => ZONE_LABELS[z]).join(', ') + ' 위주로 투구',
      priority: 'high'
    });
  }

  if (dangerZones.length > 0) {
    strategies.push({
      zone: '위험 존 회피',
      detail: dangerZones.map(z => ZONE_LABELS[z]).join(', ') + ' 존 회피',
      priority: 'high'
    });
  }

  // Direction strategy
  if (analysis.pullPct > 0.45) {
    strategies.push({
      zone: '바깥쪽 공략',
      detail: '당기는 타구가 많으므로 바깥쪽 변화구 위주. 안쪽은 주의.',
      priority: 'med'
    });
  }

  // Count strategy
  if (analysis.kRate > 0.20) {
    strategies.push({
      zone: '스트라이크 선취',
      detail: '초구 스트라이크 후 체이스 볼로 삼진 유도.',
      priority: 'high'
    });
  }

  if (analysis.behindAvg < 0.200 && analysis.behindCount >= 3) {
    strategies.push({
      zone: '카운트 유리 유지',
      detail: '불리한 카운트에서 약한 타자. 초반 스트라이크 필수.',
      priority: 'med'
    });
  }

  // Ground ball strategy
  if (analysis.goAo > 1.2) {
    strategies.push({
      zone: '낮은 존 활용',
      detail: '땅볼 타자. 낮은 존 싱커/슬라이더로 병살 유도.',
      priority: 'med'
    });
  }

  // Power strategy
  if (analysis.isoP > 0.180) {
    strategies.push({
      zone: '직구 위치 주의',
      detail: '장타력 높음. 존 안 직구 최소화, 변화구 위주.',
      priority: 'high'
    });
  }

  return strategies;
}

function _renderScoutReport(name, analysis, findings, strategy, allAbs) {
  const el = document.getElementById('scoutContent');
  if (!el) return;

  const f3 = v => v.toFixed(3).replace('0.','.');
  const pct = v => Math.round(v * 100) + '%';
  const sevClass = s => s === SEVERITY.HIGH ? 'finding-high' : s === SEVERITY.MED ? 'finding-med' : 'finding-low';
  const sevLabel = s => s === SEVERITY.HIGH ? '⚠️ 주의' : s === SEVERITY.MED ? '📌 참고' : 'ℹ️ 정보';
  const prioClass = p => p === 'high' ? 'strat-high' : p === 'med' ? 'strat-med' : 'strat-low';

  // 카운트 위험도 배경색
  const countBg = avg => avg > 0.350 ? 'rgba(220,38,38,0.25)' : avg > 0.250 ? 'rgba(251,146,60,0.2)' : 'rgba(45,212,160,0.15)';
  const countColor = avg => avg > 0.350 ? '#f87171' : avg > 0.250 ? '#fb923c' : '#2dd4a0';

  // 최근 타구 10개 (위치 있는 것)
  const recent10 = [...allAbs].reverse().filter(a => a.res).slice(0, 10);
  const RES_COLOR = {'안타':'#22c55e','내야안타':'#4ade80','2루타':'#86efac','3루타':'#bbf7d0',
    '홈런':'#fbbf24','플라이 아웃':'#f87171','땅볼 아웃':'#ef4444',
    '삼진':'#94a3b8','볼넷':'#60a5fa','사구':'#93c5fd','병살':'#dc2626','희타':'#fb923c','희비':'#fb923c'};

  el.innerHTML = `
    <div class="scout-header">
      <div class="scout-name">${_esc(name)} 스카우팅 리포트</div>
      <button id="scoutExportBtn" class="scout-export-btn" onclick="window.exportScoutReport()">리포트 복사</button>
    </div>

    <div class="scout-overview">
      <div class="so-item"><span class="so-val" style="color:#f6c23e">${f3(analysis.avg)}</span><span class="so-lbl">AVG</span></div>
      <div class="so-item"><span class="so-val" style="color:#f56565">${pct(analysis.kRate)}</span><span class="so-lbl">K%</span></div>
      <div class="so-item"><span class="so-val" style="color:#2dd4a0">${pct(analysis.bbRate)}</span><span class="so-lbl">BB%</span></div>
      <div class="so-item"><span class="so-val" style="color:#4b8cf5">${f3(analysis.isoP)}</span><span class="so-lbl">ISO</span></div>
      <div class="so-item"><span class="so-val">${analysis.goAo.toFixed(1)}</span><span class="so-lbl">GO/AO</span></div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">🎯 스트라이크존 히트맵</div>
      <div class="scout-zone-canvases">
        <div class="szc-wrap">
          <div class="szc-label">강점 존</div>
          <canvas id="scoutStrengthCanvas" width="138" height="138"></canvas>
        </div>
        <div class="szc-wrap">
          <div class="szc-label">약점 존</div>
          <canvas id="scoutWeaknessCanvas" width="138" height="138"></canvas>
        </div>
        <div class="szc-wrap">
          <div class="szc-label">종합</div>
          <canvas id="scoutZoneCanvas" width="138" height="138"></canvas>
        </div>
      </div>
      <div class="scout-zone-legend">
        <span class="szl-item" style="background:rgba(220,38,38,0.65)">≥.350 위험</span>
        <span class="szl-item" style="background:rgba(251,146,60,0.5)">≥.250</span>
        <span class="szl-item" style="background:rgba(75,140,245,0.25)">보통</span>
        <span class="szl-item" style="background:rgba(45,212,160,0.5)">≤.200 취약</span>
        <span class="szl-item" style="background:rgba(100,116,139,0.2)">데이터 없음</span>
      </div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">📐 타구 방향 분포</div>
      <canvas id="scoutDirCanvas" width="300" height="60" style="width:100%;max-width:300px;display:block;margin:0 auto;border-radius:8px"></canvas>
      <div class="scout-dir-labels">
        <span style="color:#ef4444">당김 ${pct(analysis.pullPct)} · AVG ${f3(analysis.pullAvg)}</span>
        <span style="color:#2dd4a0">중앙 ${pct(analysis.centerPct)} · AVG ${f3(analysis.centerAvg)}</span>
        <span style="color:#fb923c">밀어 ${pct(analysis.oppoPct)} · AVG ${f3(analysis.oppoAvg)}</span>
      </div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">📊 카운트별 타율</div>
      <div class="scout-count-grid">
        <div class="sc-item" style="background:${countBg(analysis.aheadAvg)}">
          <div class="sc-label">투수 유리</div>
          <div class="sc-val" style="color:${countColor(analysis.aheadAvg)}">${f3(analysis.aheadAvg)}</div>
          <div class="sc-pa">${analysis.aheadCount}PA</div>
        </div>
        <div class="sc-item" style="background:${countBg(analysis.evenAvg)}">
          <div class="sc-label">이븐</div>
          <div class="sc-val" style="color:${countColor(analysis.evenAvg)}">${f3(analysis.evenAvg)}</div>
          <div class="sc-pa">${analysis.evenCount}PA</div>
        </div>
        <div class="sc-item" style="background:${countBg(analysis.behindAvg)}">
          <div class="sc-label">타자 유리</div>
          <div class="sc-val" style="color:${countColor(analysis.behindAvg)}">${f3(analysis.behindAvg)}</div>
          <div class="sc-pa">${analysis.behindCount}PA</div>
        </div>
      </div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">🏟️ 타구 분포 (필드)</div>
      <canvas id="scoutFieldCanvas" width="240" height="220" style="display:block;margin:0 auto;border-radius:10px"></canvas>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">🕐 최근 타석 기록</div>
      <div class="scout-recent-abs">
        ${recent10.length ? recent10.map(a => {
          const col = RES_COLOR[a.res] || '#94a3b8';
          const dirTxt = a.deg != null ? (a.deg < 72 ? '당김' : a.deg <= 108 ? '중앙' : '밀어') : '-';
          const angTxt = a.deg != null ? Math.round(a.deg)+'°' : '';
          return `<div class="sra-item">
            <span class="sra-res" style="color:${col}">${_esc(a.res)}</span>
            <span class="sra-dir">${dirTxt}${angTxt ? ' ' + angTxt : ''}</span>
            <span class="sra-inn">${a.inn||''}</span>
          </div>`;
        }).join('') : '<div class="empty-state" style="padding:8px">타석 기록 없음</div>'}
      </div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">분석 결과 (${findings.length}건)</div>
      <div class="scout-findings">
        ${findings.map(f => `
          <div class="scout-finding ${sevClass(f.severity)}">
            <span class="sf-badge">${sevLabel(f.severity)}</span>
            <span class="sf-cat">[${_esc(f.category)}]</span>
            ${_esc(f.text)}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">투구 전략 제안</div>
      <div class="scout-strategies">
        ${strategy.map(s => `
          <div class="scout-strategy ${prioClass(s.priority)}">
            <div class="ss-title">${_esc(s.zone)}</div>
            <div class="ss-detail">${_esc(s.detail)}</div>
          </div>
        `).join('')}
        ${strategy.length === 0 ? '<div class="empty-state">충분한 데이터가 없어 전략 제안이 어렵습니다.</div>' : ''}
      </div>
    </div>
    ${(() => {
      const log = (window.AS && window.AS.pitchLog || []).filter(p => p.batter === name);
      if (!log.length) return '<div class="scout-section"><div class="scout-section-title">🎯 투수 분석</div><div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">투수 탭에서 투구를 기록하면 분석이 표시됩니다</div></div>';
      const total = log.length;
      const ptCnts = {};
      log.forEach(p => { if (p.pt) ptCnts[p.pt] = (ptCnts[p.pt]||0)+1; });
      const ptBars = Object.entries(ptCnts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([pt,n]) => {
        const c = (window._PT_COL && window._PT_COL[pt])||'#7c8898';
        const pct = Math.round(n/total*100);
        return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;font-size:10px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${c};flex-shrink:0"></span><span style="flex:1;color:var(--text2)">${pt}</span><div style="flex:2;background:rgba(255,255,255,.08);border-radius:2px;height:5px;overflow:hidden"><div style="width:${pct}%;background:${c};height:5px"></div></div><span style="font-family:var(--mono);font-size:9px;min-width:22px;text-align:right;color:var(--text3)">${pct}%</span></div>`;
      }).join('');
      const zH = Array(9).fill(0), zT = Array(9).fill(0);
      log.forEach(p => { const i=ZONE_LABELS.indexOf(p.zone); if(i!==-1){zT[i]++;if(['안타','2루타','3루타','홈런','타격됨'].includes(p.result))zH[i]++;} });
      const zGrid = ZONE_LABELS.map((_,i) => {
        const n=zT[i]; const bg=n<1?'rgba(255,255,255,.05)':zH[i]/n>=0.4?'rgba(239,68,68,.65)':zH[i]>0?'rgba(251,146,60,.45)':'rgba(45,212,160,.40)';
        return `<div style="aspect-ratio:1;border-radius:3px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:var(--mono);color:#fff">${n||''}</div>`;
      }).join('');
      const kCnt = log.filter(p=>p.result==='삼진').length;
      const hitRate = Math.round(log.filter(p=>['안타','2루타','3루타','홈런','타격됨'].includes(p.result)).length/total*100);
      const strat = [kCnt>=2?`✓ 삼진 ${kCnt}개 — 현재 투구 패턴 유효.`:'', hitRate>30?`⚠ 피안타율 ${hitRate}% — 구종·코스 변화 필요.`:'', ptCnts&&Object.keys(ptCnts).length?`주 투구: ${Object.entries(ptCnts).sort((a,b)=>b[1]-a[1])[0][0]}`:'' ].filter(Boolean).join('<br>');
      return `<div class="scout-section"><div class="scout-section-title">🎯 투수 분석 (${total}구)</div><div style="margin-bottom:8px">${ptBars}</div><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">코스별 피안타</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;max-width:108px;margin-bottom:8px">${zGrid}</div>${strat?`<div style="font-size:9px;color:var(--text2);line-height:1.8">${strat}</div>`:''}</div>`;
    })()}
  `;

  // display:none 상태에서 canvas.width=0 방지 → 50ms 후 실행
  setTimeout(() => {
    _paintZoneHeatmap('scoutStrengthCanvas', analysis.zoneAvg, analysis.zoneTotal, 'strength');
    _paintZoneHeatmap('scoutWeaknessCanvas', analysis.zoneAvg, analysis.zoneTotal, 'weakness');
    _paintZoneHeatmap('scoutZoneCanvas', analysis.zoneAvg, analysis.zoneTotal, 'all');
    _drawDirCanvas(analysis);
    _drawScoutFieldCanvas(allAbs);
  }, 50);
}

// ── 타자 존별 타율 히트맵 (독립 draw 함수) ──
function _paintZoneHeatmap(canvasId, zoneAvg, zoneTotal, mode) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  c.width = 138 * dpr; c.height = 138 * dpr;
  c.style.width = '138px'; c.style.height = '138px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const cellW = 138 / 3, cellH = 138 / 3;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const i = row * 3 + col;
      const avg = zoneAvg[i] || 0;
      const total = zoneTotal[i] || 0;
      let bg;
      if (total < 2)       bg = 'rgba(255,255,255,0.05)';
      else if (avg >= 0.350) bg = 'rgba(239,68,68,0.75)';
      else if (avg >= 0.250) bg = 'rgba(251,146,60,0.60)';
      else if (avg >= 0.150) bg = 'rgba(75,140,245,0.45)';
      else                   bg = 'rgba(45,212,160,0.65)';
      ctx.fillStyle = bg;
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${11 * dpr}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = total >= 2 ? avg.toFixed(3).replace('0.', '.') : '-';
      ctx.save(); ctx.scale(1 / dpr, 1 / dpr);
      ctx.fillText(label, (col * cellW + cellW / 2) * dpr, (row * cellH + cellH * 0.45) * dpr);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `${9 * dpr}px sans-serif`;
      ctx.fillText(total + 'PA', (col * cellW + cellW / 2) * dpr, (row * cellH + cellH * 0.72) * dpr);
      ctx.restore();
    }
  }
}

// ── 존 히트맵 캔버스 (3×3) ──
function _drawZoneCanvas(canvasId, analysis, mode) {
  if (!analysis) return; // null 가드
  const c = document.getElementById(canvasId);
  if (!c) return;
  const dpr = window.devicePixelRatio || 1;
  const LOGICAL = 138; // display:none 상태에서도 크기 고정
  c.width = LOGICAL * dpr;
  c.height = LOGICAL * dpr;
  c.style.width = LOGICAL + 'px';
  c.style.height = LOGICAL + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = LOGICAL, H = LOGICAL;
  const cw = W / 3, ch = H / 3;

  ctx.clearRect(0, 0, W, H);
  // 배경
  ctx.fillStyle = 'rgba(14,16,24,0.6)';
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3), col = i % 3;
    const x = col * cw, y = row * ch;
    const avg = analysis.zoneAvg[i];
    const total = analysis.zoneTotal[i];

    let bg;
    if (total < 2) {
      bg = 'rgba(100,116,139,0.2)';
    } else if (mode === 'strength') {
      // 강점존: 타율 높을수록 빨강
      if (avg >= 0.350) bg = 'rgba(220,38,38,0.70)';
      else if (avg >= 0.300) bg = 'rgba(239,68,68,0.45)';
      else if (avg >= 0.250) bg = 'rgba(251,146,60,0.30)';
      else bg = 'rgba(100,116,139,0.15)';
    } else if (mode === 'weakness') {
      // 약점존: 타율 낮을수록 초록
      if (avg < 0.150) bg = 'rgba(45,212,160,0.70)';
      else if (avg < 0.200) bg = 'rgba(45,212,160,0.45)';
      else if (avg < 0.250) bg = 'rgba(45,212,160,0.25)';
      else bg = 'rgba(100,116,139,0.15)';
    } else {
      // 종합
      if (avg >= 0.350) bg = 'rgba(220,38,38,0.65)';
      else if (avg >= 0.300) bg = 'rgba(239,68,68,0.40)';
      else if (avg >= 0.250) bg = 'rgba(251,146,60,0.50)';
      else if (avg >= 0.200) bg = 'rgba(75,140,245,0.25)';
      else bg = 'rgba(45,212,160,0.50)';
    }

    ctx.fillStyle = bg;
    ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);

    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);

    // AVG 텍스트
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `bold ${Math.round(cw * 0.21)}px "JetBrains Mono",monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total > 0 ? avg.toFixed(3).replace('0.','.') : '-', x + cw/2, y + ch/2 - 7);

    // PA 텍스트
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${Math.round(cw * 0.14)}px sans-serif`;
    ctx.fillText(total + 'PA', x + cw/2, y + ch/2 + 9);
  }
}

// ── 타구 방향 바차트 캔버스 ──
function _drawDirCanvas(analysis) {
  const c = document.getElementById('scoutDirCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = 300, H = 60;
  c.width = W * dpr; c.height = H * dpr;
  c.style.width = W + 'px'; c.style.height = H + 'px';
  ctx.scale(dpr, dpr);

  ctx.fillStyle = 'rgba(14,16,24,0.4)';
  ctx.fillRect(0, 0, W, H);

  const total = analysis.pullCount + analysis.centerCount + analysis.oppoCount || 1;
  const segs = [
    { count: analysis.pullCount,   avg: analysis.pullAvg,   color: 'rgba(239,68,68,0.75)',   label: '당김' },
    { count: analysis.centerCount, avg: analysis.centerAvg, color: 'rgba(45,212,160,0.75)',   label: '중앙' },
    { count: analysis.oppoCount,   avg: analysis.oppoAvg,   color: 'rgba(251,146,60,0.75)',   label: '밀어' },
  ];

  const BAR_H = 24, BAR_Y = 14;
  let xOff = 0;
  segs.forEach(seg => {
    const w = Math.max((seg.count / total) * W, seg.count > 0 ? 2 : 0);
    ctx.fillStyle = seg.color;
    ctx.fillRect(xOff, BAR_Y, w - 1, BAR_H);
    if (w > 28) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold 10px "JetBrains Mono",monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(seg.avg.toFixed(3).replace('0.','.'), xOff + w/2, BAR_Y + BAR_H/2 + 4);
    }
    xOff += w;
  });
}

// ── 미니 필드 캔버스 ──
function _drawScoutFieldCanvas(allAbs) {
  const c = document.getElementById('scoutFieldCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H * 0.88;
  const R = W * 0.46;

  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(22,40,30,0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(45,212,120,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const sqR = R * 0.38;
  ctx.beginPath();
  ctx.moveTo(cx, cy - sqR);
  ctx.lineTo(cx + sqR, cy);
  ctx.lineTo(cx, cy + sqR);
  ctx.lineTo(cx - sqR, cy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(180,130,60,0.3)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx - R, cy - 0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx + R, cy - 0.05); ctx.stroke();

  const RES_COL = {'안타':'#22c55e','내야안타':'#4ade80','2루타':'#86efac','3루타':'#bbf7d0',
    '홈런':'#fbbf24','플라이 아웃':'#f87171','땅볼 아웃':'#ef4444',
    '삼진':'#6b7280','볼넷':'#60a5fa','사구':'#93c5fd'};
  const HITS_SET = new Set(['안타','내야안타','2루타','3루타','홈런']);

  allAbs.forEach(ab => {
    if (ab.x == null || ab.y == null) return;
    const px = ab.x * W;
    const py = ab.y * H * (220 / 440);
    const isOut = !HITS_SET.has(ab.res);
    const col = RES_COL[ab.res] || '#94a3b8';
    ctx.beginPath();
    ctx.arc(px, py, isOut ? 2.5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = col + 'cc';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });
}

function _buildTextReport(name, analysis, findings, strategy) {
  const f3 = v => v.toFixed(3);
  const pct = v => Math.round(v * 100) + '%';
  const lines = [];

  lines.push(`========================================`);
  lines.push(`  스카우팅 리포트: ${name}`);
  lines.push(`========================================`);
  lines.push(``);
  lines.push(`[기본 성적]`);
  lines.push(`  타율: ${f3(analysis.avg)} | K%: ${pct(analysis.kRate)} | BB%: ${pct(analysis.bbRate)}`);
  lines.push(`  ISO: ${f3(analysis.isoP)} | GO/AO: ${analysis.goAo.toFixed(1)}`);
  lines.push(`  타석: ${analysis.pa} | 안타: ${analysis.h} | 홈런: ${analysis.hr}`);
  lines.push(``);

  lines.push(`[존별 타율]`);
  for (let row = 0; row < 3; row++) {
    const cells = [];
    for (let col = 0; col < 3; col++) {
      const i = row * 3 + col;
      const t = analysis.zoneTotal[i];
      cells.push(t > 0 ? f3(analysis.zoneAvg[i]).padStart(6) : '  -   ');
    }
    lines.push(`  ${cells.join(' | ')}`);
  }
  lines.push(``);

  lines.push(`[타구 방향]`);
  lines.push(`  당김: ${pct(analysis.pullPct)} (타율 ${f3(analysis.pullAvg)})`);
  lines.push(`  중앙: ${pct(analysis.centerPct)} (타율 ${f3(analysis.centerAvg)})`);
  lines.push(`  밀어: ${pct(analysis.oppoPct)} (타율 ${f3(analysis.oppoAvg)})`);
  lines.push(``);

  lines.push(`[카운트별 타율]`);
  lines.push(`  투수 유리: ${f3(analysis.aheadAvg)} (${analysis.aheadCount}타석)`);
  lines.push(`  이븐:     ${f3(analysis.evenAvg)} (${analysis.evenCount}타석)`);
  lines.push(`  타자 유리: ${f3(analysis.behindAvg)} (${analysis.behindCount}타석)`);
  lines.push(``);

  lines.push(`[분석 결과]`);
  findings.forEach((f, i) => {
    const tag = f.severity === SEVERITY.HIGH ? '[!]' : f.severity === SEVERITY.MED ? '[*]' : '[-]';
    lines.push(`  ${tag} [${f.category}] ${f.text}`);
  });
  lines.push(``);

  lines.push(`[투구 전략]`);
  strategy.forEach(s => {
    lines.push(`  > ${s.zone}: ${s.detail}`);
  });

  lines.push(``);
  lines.push(`========================================`);

  return lines.join('\n');
}

function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Expose to window for onclick handlers
if (typeof window !== 'undefined') {
  window.openScoutView = openScoutView;
  window.renderScoutPlayerSelect = renderScoutPlayerSelect;
  window.generateScoutReport = generateScoutReport;
  window.exportScoutReport = exportScoutReport;
}
