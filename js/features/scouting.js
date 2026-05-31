// Scouting report generator: analyzes weaknesses and generates pitch strategy
const HITS = ['안타','내야안타','2루타','3루타','홈런'];
const NOAB = ['볼넷','사구','희타','희비'];
const BASE = {'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
const OUTS = ['플라이 아웃','땅볼 아웃','삼진','병살'];
const ZONE_LABELS = [
  '높은 안쪽', '높은 중앙', '높은 바깥',
  '중간 안쪽', '중간 중앙', '중간 바깥',
  '낮은 안쪽', '낮은 중앙', '낮은 바깥'
];
const SEVERITY = { HIGH: 'high', MED: 'med', LOW: 'low' };

let _currentReportText = '';

export function openScoutView() {
  document.querySelectorAll('.savant-view').forEach(v => v.classList.remove('active'));
  document.getElementById('scoutView').classList.add('active');
  _currentReportText = '';
  renderScoutPlayerSelect();
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

  _renderScoutReport(playerName, analysis, findings, strategy, allAbs);
  _currentReportText = _buildTextReport(playerName, analysis, findings, strategy);
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
  [...(AS.home_lineup||[]), ...(AS.away_lineup||[])].forEach(p => {
    map[p.name+'_'+p.num] = { id: p.id, name: p.name, num: p.num };
  });
  const saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
  saves.forEach(s => {
    try {
      const d = JSON.parse(localStorage.getItem(s.key));
      if (!d) return;
      [...(d.home_lineup||[]), ...(d.away_lineup||[])].forEach(p => {
        map[p.name+'_'+p.num] = { id: p.id, name: p.name, num: p.num };
      });
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
    if (a.zone && a.zone >= 1 && a.zone <= 9) {
      const idx = a.zone - 1;
      zoneTotal[idx]++;
      if (HITS.includes(a.res)) zoneHits[idx]++;
      if (OUTS.includes(a.res)) zoneOuts[idx]++;
    }
  });

  for (let i = 0; i < 9; i++) {
    const zab = zoneTotal[i] - allAbs.filter(a => a.zone === i+1 && NOAB.includes(a.res)).length;
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
  const sevLabel = s => s === SEVERITY.HIGH ? '주의' : s === SEVERITY.MED ? '참고' : '정보';
  const prioClass = p => p === 'high' ? 'strat-high' : p === 'med' ? 'strat-med' : 'strat-low';

  // Zone grid HTML
  const zoneGrid = analysis.zoneAvg.map((avg, i) => {
    const total = analysis.zoneTotal[i];
    const hits = analysis.zoneHits[i];
    const outs = analysis.zoneOuts[i];
    let bg = 'rgba(255,255,255,0.03)';
    if (total >= 2) {
      if (avg >= 0.350) bg = 'rgba(245,101,101,0.3)';       // danger - red
      else if (avg >= 0.250) bg = 'rgba(246,194,62,0.2)';    // caution - yellow
      else if (avg < 0.150) bg = 'rgba(45,212,160,0.3)';     // weak - green (good for pitcher)
      else bg = 'rgba(75,140,245,0.15)';                     // neutral
    }
    return `<div class="scout-zone" style="background:${bg}">
      <div class="sz-avg">${total > 0 ? f3(avg) : '-'}</div>
      <div class="sz-detail">${hits}H/${outs}O/${total}PA</div>
    </div>`;
  }).join('');

  // Strength zone grid
  const strengthGrid = analysis.zoneAvg.map((avg, i) => {
    const total = analysis.zoneTotal[i];
    let bg = 'rgba(255,255,255,0.03)';
    if (total >= 2 && avg >= 0.300) {
      const intensity = Math.min((avg - 0.200) / 0.300, 1);
      bg = `rgba(245,101,101,${0.1 + intensity * 0.4})`;
    }
    return `<div class="scout-zone" style="background:${bg}">
      <div class="sz-avg">${total > 0 ? f3(avg) : '-'}</div>
      <div class="sz-label">${ZONE_LABELS[i]}</div>
    </div>`;
  }).join('');

  // Weakness zone grid
  const weaknessGrid = analysis.zoneAvg.map((avg, i) => {
    const total = analysis.zoneTotal[i];
    let bg = 'rgba(255,255,255,0.03)';
    if (total >= 2 && avg < 0.250) {
      const intensity = Math.min((0.250 - avg) / 0.250, 1);
      bg = `rgba(45,212,160,${0.1 + intensity * 0.4})`;
    }
    return `<div class="scout-zone" style="background:${bg}">
      <div class="sz-avg">${total > 0 ? f3(avg) : '-'}</div>
      <div class="sz-label">${ZONE_LABELS[i]}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="scout-header">
      <div class="scout-name">${_esc(name)} 스카우팅 리포트</div>
      <button id="scoutExportBtn" class="scout-export-btn" onclick="window.exportScoutReport()">리포트 복사</button>
    </div>

    <div class="scout-overview">
      <div class="so-item"><span class="so-val">${f3(analysis.avg)}</span><span class="so-lbl">AVG</span></div>
      <div class="so-item"><span class="so-val">${pct(analysis.kRate)}</span><span class="so-lbl">K%</span></div>
      <div class="so-item"><span class="so-val">${pct(analysis.bbRate)}</span><span class="so-lbl">BB%</span></div>
      <div class="so-item"><span class="so-val">${f3(analysis.isoP)}</span><span class="so-lbl">ISO</span></div>
      <div class="so-item"><span class="so-val">${analysis.goAo.toFixed(1)}</span><span class="so-lbl">GO/AO</span></div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">🎯 스트라이크존 히트맵</div>
      <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <canvas id="scoutZoneCanvas" width="210" height="210" style="flex-shrink:0;border-radius:8px;border:1px solid var(--border)"></canvas>
        <div style="flex:1;min-width:110px">
          <div style="font-size:10px;color:var(--text3);margin-bottom:6px;font-weight:700">색상 범례</div>
          <div style="display:flex;flex-direction:column;gap:4px;font-size:10px">
            <div><span style="display:inline-block;width:12px;height:12px;background:rgba(220,38,38,0.7);border-radius:3px;margin-right:5px;vertical-align:middle"></span>AVG≥.350 위험</div>
            <div><span style="display:inline-block;width:12px;height:12px;background:rgba(251,146,60,0.6);border-radius:3px;margin-right:5px;vertical-align:middle"></span>AVG≥.250 주의</div>
            <div><span style="display:inline-block;width:12px;height:12px;background:rgba(75,140,245,0.3);border-radius:3px;margin-right:5px;vertical-align:middle"></span>AVG 보통</div>
            <div><span style="display:inline-block;width:12px;height:12px;background:rgba(45,212,160,0.55);border-radius:3px;margin-right:5px;vertical-align:middle"></span>AVG≤.200 취약</div>
            <div><span style="display:inline-block;width:12px;height:12px;background:rgba(100,116,139,0.25);border-radius:3px;margin-right:5px;vertical-align:middle"></span>데이터 부족</div>
          </div>
        </div>
      </div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">🏟️ 타구 분포 (필드 오버레이)</div>
      <canvas id="scoutFieldCanvas" width="240" height="220" style="display:block;margin:0 auto;border-radius:10px"></canvas>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">강점 존 (빨간색 = 높은 타율)</div>
      <div class="scout-zone-grid">${strengthGrid}</div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">약점 존 (초록색 = 낮은 타율)</div>
      <div class="scout-zone-grid">${weaknessGrid}</div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">종합 존 분석</div>
      <div class="scout-zone-grid">${zoneGrid}</div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">타구 방향 성향</div>
      <div class="scout-direction">
        <div class="sd-bar">
          <div class="sd-seg pull" style="flex:${analysis.pullCount||1}">
            <div class="sd-pct">${pct(analysis.pullPct)}</div>
            <div class="sd-avg">${f3(analysis.pullAvg)}</div>
            <div class="sd-lbl">당김</div>
          </div>
          <div class="sd-seg center" style="flex:${analysis.centerCount||1}">
            <div class="sd-pct">${pct(analysis.centerPct)}</div>
            <div class="sd-avg">${f3(analysis.centerAvg)}</div>
            <div class="sd-lbl">중앙</div>
          </div>
          <div class="sd-seg oppo" style="flex:${analysis.oppoCount||1}">
            <div class="sd-pct">${pct(analysis.oppoPct)}</div>
            <div class="sd-avg">${f3(analysis.oppoAvg)}</div>
            <div class="sd-lbl">밀어</div>
          </div>
        </div>
      </div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">카운트별 분석</div>
      <div class="scout-count-grid">
        <div class="sc-item ${analysis.aheadAvg > 0.300 ? 'sc-danger' : 'sc-safe'}">
          <div class="sc-label">투수 유리</div>
          <div class="sc-val">${f3(analysis.aheadAvg)}</div>
          <div class="sc-pa">${analysis.aheadCount}타석</div>
        </div>
        <div class="sc-item ${analysis.evenAvg > 0.300 ? 'sc-danger' : 'sc-neutral'}">
          <div class="sc-label">이븐</div>
          <div class="sc-val">${f3(analysis.evenAvg)}</div>
          <div class="sc-pa">${analysis.evenCount}타석</div>
        </div>
        <div class="sc-item ${analysis.behindAvg > 0.300 ? 'sc-danger' : 'sc-safe'}">
          <div class="sc-label">타자 유리</div>
          <div class="sc-val">${f3(analysis.behindAvg)}</div>
          <div class="sc-pa">${analysis.behindCount}타석</div>
        </div>
      </div>
    </div>

    <div class="scout-section">
      <div class="scout-section-title">분석 결과 (${findings.length}건)</div>
      <div class="scout-findings">
        ${findings.map(f => `
          <div class="scout-finding ${sevClass(f.severity)}">
            <span class="sf-badge">${sevLabel(f.severity)}</span>
            <span class="sf-cat">[${f.category}]</span>
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
  `;

  // 캔버스 그리기 (innerHTML 설정 후 DOM 업데이트 대기)
  requestAnimationFrame(() => {
    _drawScoutZoneCanvas(analysis);
    _drawScoutFieldCanvas(allAbs);
  });
}

// ── 스트라이크존 히트맵 캔버스 ──────────────────
function _drawScoutZoneCanvas(analysis) {
  const c = document.getElementById('scoutZoneCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const cw = W / 3, ch = H / 3;
  ctx.clearRect(0, 0, W, H);

  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3), col = i % 3;
    const x = col * cw, y = row * ch;
    const avg = analysis.zoneAvg[i];
    const total = analysis.zoneTotal[i];

    // 배경색
    let bg;
    if (total < 2) {
      bg = 'rgba(100,116,139,0.2)';
    } else if (avg >= 0.350) {
      bg = 'rgba(220,38,38,0.65)';
    } else if (avg >= 0.300) {
      bg = 'rgba(239,68,68,0.4)';
    } else if (avg >= 0.250) {
      bg = 'rgba(251,146,60,0.5)';
    } else if (avg >= 0.200) {
      bg = 'rgba(75,140,245,0.25)';
    } else {
      bg = 'rgba(45,212,160,0.5)';
    }
    ctx.fillStyle = bg;
    ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);

    // 격자선
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);

    // 텍스트
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${cw * 0.22}px "JetBrains Mono",monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const avgStr = total > 0 ? avg.toFixed(3).replace('0.', '.') : '-';
    ctx.fillText(avgStr, x + cw / 2, y + ch / 2 - 6);

    // PA 수
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${cw * 0.15}px sans-serif`;
    ctx.fillText(total + 'PA', x + cw / 2, y + ch / 2 + 10);
  }
}

// ── 미니 필드 + 타구 분포 캔버스 ──────────────────
function _drawScoutFieldCanvas(allAbs) {
  const c = document.getElementById('scoutFieldCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);

  // 필드 배경
  const cx = W / 2, cy = H * 0.88;
  const R = W * 0.46;

  // 외야 잔디
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(22,40,30,0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(45,212,120,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 내야
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

  // 파울라인
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx - R,cy - 0.05);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx + R,cy - 0.05);ctx.stroke();

  // 타구 점
  const HITS = ['안타','내야안타','2루타','3루타','홈런'];
  const RC = {'안타':'#22c55e','내야안타':'#4ade80','2루타':'#86efac','3루타':'#bbf7d0',
    '홈런':'#fbbf24','플라이 아웃':'#f87171','땅볼 아웃':'#ef4444',
    '삼진':'#6b7280','볼넷':'#60a5fa','사구':'#93c5fd'};

  allAbs.forEach(ab => {
    if (ab.x == null || ab.y == null) return;
    // 저장 좌표는 0~1 범위 (캔버스 크기 440 기준으로 저장됨)
    const px = ab.x * W;
    const py = ab.y * H * (220 / 440);
    const isOut = !HITS.includes(ab.res);
    const col = RC[ab.res] || '#94a3b8';
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
