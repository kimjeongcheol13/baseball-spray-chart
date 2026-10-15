// 게임원 박스스코어 붙여넣기 → 새 경기로 저장 (데이터 관리 › 가져오기 › 게임원)
// 파서는 js/gameone.js (window.SLGameOne). 저장은 엑셀 가져오기(core.js importExcelAsGame)와 같은 경로:
//   sl_<타임스탬프> 키 · _gameDataOk 검증 · sl_saves 항목 추가 · cloudSave · 불러오기 목록 열기. 기존 저장 형식은 그대로다.
// 정한 것 (2026-10-15):
//   · 새 경기로 저장 — 기록 중인 경기는 건드리지 않는다
//   · 원정 표 · 홈 표 칸 2개 — 원정 = 'N회초', 홈 = 'N회말' (10회 이상은 '연장'), 점수 = 각 표의 득점 합계
//   · 홈런 위치는 펜스 밖 그대로 (파서 값 그대로 — 그리는 쪽이 펜스 1.06배까지 표시, 핫존 집계는 가장 깊은 칸)
//   · 타석 타점은 0 — 게임원 표에는 타석별 타점이 없다(선수별 합계만). 미리보기에 안내한다
//   · unknown 타석(결과를 모름)과 교체·주루 사건뿐인 칸은 저장하지 않고 미리보기에 보여 준다

// 게임원 수비위치 → 앱 포지션 (lineup pos). 예시에서 확인한 건 二 · 유 · 중 — 나머지는 같은 표기 관례로 맞춘 값, 모르면 빈 칸
const POS = {
  __proto__: null,
  '一': '1루', '二': '2루', '三': '3루', '1': '1루', '2': '2루', '3': '3루',
  '유': '유격', '좌': '좌익', '중': '중견', '우': '우익', '포': '포수', '투': '투수', '지': 'DH', '지명': 'DH', 'DH': 'DH',
};
const _P = () => window.SLGameOne;
const _num = v => (typeof v === 'number' && isFinite(v) ? v : 0);

// 타석 순서 복원: 표는 타순별 행이라, 이닝 안에서는 앞 이닝 마지막 타자 다음 타순부터 돌아가며 친다.
// 정렬 = 이닝 → 같은 이닝 몇 번째 타석인지(round, '/' 두 번째 = 1) → 시작 타순부터의 거리 → 행 순서.
// 타순이 없는 행이 있으면 복원하지 않고 이닝 · round · 행 순서로만 둔다
function _orderSide(entries) {
  const N = Math.max(0, ...entries.map(e => e.slot || 0));
  const byInn = new Map();
  entries.forEach(e => { if (!byInn.has(e.inning)) byInn.set(e.inning, []); byInn.get(e.inning).push(e); });
  const cyclic = N > 0 && entries.every(e => e.slot);
  let start = 1;
  const out = [];
  [...byInn.keys()].sort((a, b) => a - b).forEach(inn => {
    const es = byInn.get(inn);
    const dist = e => (cyclic ? (e.slot - start + N) % N : 0);
    es.sort((a, b) => a.round - b.round || dist(a) - dist(b) || a.row - b.row);
    if (cyclic) start = es[es.length - 1].slot % N + 1;
    out.push(...es);
  });
  return out;
}

/**
 * 원정 · 홈 붙여넣기 → { game, report }
 *   game   = 저장할 경기 데이터 (core.js 엑셀 가져오기와 같은 모양: key · hs · as · th · ta · home_lineup · away_lineup · abs · zoneHistory · d · ts · info)
 *   report = 미리보기용 { away, home, pa, unknownTokens } — 팀별 { players, pa, batted, low, nonBatted, skipped:[{name,inning,raw}], noPA, noInning, runs, rbi }
 * now · stadiums · stadium 을 받아 순수하게 만든다 (테스트용)
 */
export function buildGameOneGame({ awayText = '', homeText = '', th = '', ta = '', date = '', now = Date.now(), stadiums = window.STADIUMS || {}, stadium = '' } = {}) {
  const st = stadiums[stadium] || stadiums.standard || { lfDist: 90, cfDist: 120, rfDist: 90 };
  const lf = Math.round(st.lfDist * 3.281), cf = Math.round(st.cfDist * 3.281), rf = Math.round(st.rfDist * 3.281);
  const wallFt = { LF: lf, LC: Math.round((lf + cf) / 2), CF: cf, RC: Math.round((cf + rf) / 2), RF: rf };   // core.js onFClick 과 같은 담장 거리
  const lineups = { home: [], away: [] }, report = { pa: 0, unknownTokens: [] }, seenTok = Object.create(null);
  const all = [];
  let nid = 0;

  ['away', 'home'].forEach(team => {
    const text = team === 'away' ? awayText : homeText;
    const r = { players: 0, pa: 0, batted: 0, low: 0, nonBatted: 0, skipped: [], noPA: 0, noInning: 0, runs: 0, rbi: 0 };
    report[team] = r;
    if (!String(text).trim()) return;
    const res = _P().parseGameOne(text);
    res.unknownTokens.forEach(t => { if (!seenTok[t]) { seenTok[t] = 1; report.unknownTokens.push(t); } });
    const seen = Object.create(null), slotSeen = Object.create(null), entries = [];
    res.players.forEach((p, row) => {
      const key = p.name + '|' + p.number;
      let lp = seen[key];
      if (!lp) {
        lp = seen[key] = { id: 'go' + now.toString(36) + team[0] + lineups[team].length, name: p.name.slice(0, 8), num: p.number, pos: POS[p.position] || '', bh: '',
          isStarter: p.order == null || !slotSeen[p.order] };
        if (p.order != null) slotSeen[p.order] = 1;
        lineups[team].push(lp);
      }
      r.runs += _num(p.stats.r); r.rbi += _num(p.stats.rbi);
      let lastInn = null, round = 0;
      p.atBats.forEach(a => {
        round = a.inning != null && a.inning === lastInn ? round + 1 : 0;
        lastInn = a.inning;
        if (a.type === 'unknown') { r.skipped.push({ name: p.name, inning: a.inning, raw: a.raw }); return; }
        if (a.result == null) { r.noPA++; return; }   // 교체 · 주루 사건뿐 — 타석이 아니다
        entries.push({ a, lp, slot: p.order, round, row, inning: a.inning == null ? Infinity : a.inning, team });
      });
    });
    r.players = lineups[team].length;
    _orderSide(entries).forEach(e => {
      const a = e.a;
      r.pa++;
      if (a.type === 'batted') { r.batted++; if (a.confidence === 'low') r.low++; } else r.nonBatted++;
      if (a.inning == null) r.noInning++;
      all.push(e);
    });
  });

  // 원정(초) → 홈(말) 순으로 이닝마다 섞는다. 이닝을 모르는 타석은 맨 뒤
  const half = { away: 0, home: 1 };
  const sorted = all.map((e, i) => ({ e, i })).sort((p, q) => p.e.inning - q.e.inning || half[p.e.team] - half[q.e.team] || p.i - q.i).map(x => x.e);
  const abs = sorted.map(({ a, lp, team }) => {
    const inn = a.inning == null ? '' : a.inning > 9 ? '연장' : a.inning + '회' + (team === 'away' ? '초' : '말');
    const loc = a.type === 'batted';
    return {
      id: now + nid++, bid: lp.id, bname: lp.name, bnum: lp.num, team, res: a.result, pt: null, zone: null, rbi: 0,
      x: loc ? a.x : null, y: loc ? a.y : null, deg: loc ? a.angle : null, dir: loc ? a.dir : null,
      ft: loc ? Math.round(a.depth * (wallFt[a.dir] || 370)) : null, inn, ts: '', pitches: [],
    };
  });
  report.pa = abs.length;

  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const d = (dm ? new Date(+dm[1], +dm[2] - 1, +dm[3]) : new Date(now)).toLocaleDateString('ko-KR');
  const game = {
    key: 'sl_' + now, hs: report.home.runs, as: report.away.runs, th: String(th || '').trim() || '홈팀', ta: String(ta || '').trim() || '원정팀',
    home_lineup: lineups.home, away_lineup: lineups.away, abs, zoneHistory: {}, d, ts: now,
  };
  if (dm) game.info = { date: date };
  return { game, report };
}

// ── 화면 ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const _esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let _timer = null;

function _inputs() {
  return {
    awayText: ($('goAway') || {}).value || '', homeText: ($('goHome') || {}).value || '',
    ta: ($('goTa') || {}).value || '', th: ($('goTh') || {}).value || '', date: ($('goDate') || {}).value || '',
    stadium: (window.AS || {}).stadium || '',
  };
}

function _sideHtml(label, r) {
  if (!r.players) return '';
  const parts = [`타석 <b>${r.pa}</b>`, `타구 위치 ${r.batted}` + (r.low ? ` <span class="go-low">(대략 ${r.low})</span>` : ''), `볼넷·사구·삼진 ${r.nonBatted}`];
  let h = `<div class="go-side"><div class="go-side-h">${label} · 선수 ${r.players}명 · 득점 ${r.runs}</div><div>${parts.join(' · ')}</div>`;
  if (r.skipped.length) {
    h += `<div class="go-warn">저장 안 함 ${r.skipped.length}타석 (모르는 기록): `
      + r.skipped.map(s => _esc(`${s.name} ${s.inning == null ? '' : s.inning + '회 '}'${s.raw}'`)).join(', ') + '</div>';
  }
  if (r.noInning) h += `<div class="go-warn">이닝을 모르는 타석 ${r.noInning}개 — 표를 게임원에서 드래그해 다시 복사하면(탭 구분) 이닝이 들어갑니다</div>`;
  return h + '</div>';
}

function _preview() {
  const box = $('goPrev'), btn = $('goSave');
  if (!box || !btn) return;
  const inp = _inputs();
  if (!inp.awayText.trim() && !inp.homeText.trim()) {
    box.innerHTML = '<div class="go-empty">표를 붙여넣으면 여기에 가져올 내용이 나옵니다</div>';
    btn.disabled = true;
    return;
  }
  let out;
  try { out = buildGameOneGame(Object.assign(inp, { now: Date.now() })); }
  catch (e) { box.innerHTML = '<div class="go-warn">읽지 못했습니다: ' + _esc(e && e.message || e) + '</div>'; btn.disabled = true; return; }
  const { report: R, game: g } = out;
  let h = _sideHtml('원정', R.away) + _sideHtml('홈', R.home);
  if (!R.away.players && !R.home.players) h = '<div class="go-warn">선수 행을 찾지 못했습니다 — 게임원 박스스코어의 타자 표(선수명(등번호)가 있는 행)를 복사해 주세요</div>';
  else {
    h = `<div class="go-score">${_esc(g.ta)} <b>${g.as}</b> : <b>${g.hs}</b> ${_esc(g.th)}</div>` + h;
    const rbi = R.away.rbi + R.home.rbi;
    h += `<div class="go-note">타점: 게임원 표에는 타석별 타점이 없어 0으로 저장됩니다${rbi ? ` (표의 타점 합계 ${rbi})` : ''}.`
      + (R.away.low + R.home.low ? ' "대략"은 안타·뜬공·땅볼처럼 떨어진 자리 폭이 넓어 방향 대표값으로 찍은 타구입니다.' : '') + '</div>';
  }
  box.innerHTML = h;
  btn.disabled = !R.pa;
  btn.textContent = R.pa ? `새 경기로 저장 (${R.pa}타석)` : '새 경기로 저장';
}

function _schedule() { clearTimeout(_timer); _timer = setTimeout(_preview, 150); }

export function openGameOneImport() {
  if (!_P()) { if (window.showToast) window.showToast('게임원 파서를 불러오지 못했습니다 — 새로고침 후 다시 시도해 주세요', false); return; }
  if (window.closeOverlay) window.closeOverlay('dataSettingsOverlay');
  const dt = $('goDate');
  if (dt && !dt.value) { const n = new Date(), p = v => String(v).padStart(2, '0'); dt.value = `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`; }
  _preview();
  if (window.openOverlay) window.openOverlay('goOverlay');
  setTimeout(() => { const t = $('goAway'); if (t) t.focus(); }, 50);
}

export function saveGameOneImport() {
  const toast = m => { if (window.showToast) window.showToast(m, false); };
  let out;
  try { out = buildGameOneGame(Object.assign(_inputs(), { now: Date.now() })); } catch (e) { toast('읽지 못했습니다: ' + (e && e.message || e)); return; }
  const { game: g, report: R } = out;
  if (!g.abs.length) { toast('저장할 타석이 없습니다'); return; }
  if (typeof _gameDataOk === 'function' && !_gameDataOk(g)) { toast('경기 데이터 형식이 올바르지 않아 저장하지 않았습니다'); return; }   // 다른 가져오기 경로와 같은 검증
  const label = g.th + ' ' + g.hs + ':' + g.as + ' ' + g.ta + ' (' + g.d + ')';
  let saves;
  try { saves = JSON.parse(localStorage.getItem('sl_saves') || '[]'); } catch (e) { saves = []; }
  if (!Array.isArray(saves)) saves = [];
  try {
    localStorage.setItem(g.key, JSON.stringify(g));
    saves.push({ key: g.key, label, ts: g.ts });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
  } catch (e) { try { localStorage.removeItem(g.key); } catch (e2) {} toast('저장 공간이 부족해 저장하지 못했습니다'); return; }
  if (window.cloudSave) window.cloudSave(g.key, g, label, g.ts);
  ['goAway', 'goHome'].forEach(id => { const t = $(id); if (t) t.value = ''; });
  _preview();
  if (window.closeOverlay) window.closeOverlay('goOverlay');
  if (window.openLoad) window.openLoad();
  const skipped = R.away.skipped.length + R.home.skipped.length;
  toast(`게임원 ${g.abs.length}타석 → 새 경기로 저장됨` + (skipped ? ` (모르는 기록 ${skipped}타석 제외)` : ''));
}

if (typeof window !== 'undefined') {
  window.SLGameOneImport = { buildGameOneGame };
  window.openGameOneImport = openGameOneImport;
  window.saveGameOneImport = saveGameOneImport;
  window.gameOnePreview = _schedule;
}
