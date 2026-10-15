// 게임원 박스스코어 붙여넣기 → 새 경기로 저장 (데이터 관리 › 가져오기 › 게임원)
// 파서는 js/gameone.js (window.SLGameOne). 저장은 엑셀 가져오기(core.js importExcelAsGame)와 같은 경로:
//   sl_<타임스탬프> 키 · _gameDataOk 검증 · sl_saves 항목 추가 · cloudSave · 불러오기 목록 열기. 기존 저장 형식은 그대로다.
// 정한 것 (2026-10-15):
//   · 새 경기로 저장 — 기록 중인 경기는 건드리지 않는다
//   · 원정 표 · 홈 표 칸 2개 — 원정 = 'N회초', 홈 = 'N회말' (10회 이상은 '연장'), 점수 = 각 표의 득점 합계
//   · 홈런 위치는 펜스 밖 그대로 (파서 값 그대로 — 그리는 쪽이 펜스 1.06배까지 표시, 핫존 집계는 가장 깊은 칸)
//   · 타석 타점은 0 — 게임원 표에는 타석별 타점이 없다(선수별 합계만). 미리보기에 안내한다
//   · unknown 타석(결과를 모름)과 교체·주루 사건뿐인 칸은 저장하지 않고 미리보기에 보여 준다
//   · 이닝별 점수표(선택 칸): 점수 = 표의 R, 팀 이름이 비어 있으면 표의 이름. 이닝별 득점은 경기 정보에 info.ls = { away: [...], home: [...] } 로
//     새로 둔다(기존 필드는 그대로) — 경기 정보는 저장 · 불러오기 · 복구를 따라다니고, 기록 화면 라인스코어(scorebook.js)가 이닝 칸에 그린다.
//     공유 링크도 info.ls 를 싣는다(core.js _shareGameBuild — 다른 경기 정보와 함께) · 받는 쪽은 _restoreLsFromPayload 가 걸러 받는다

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
 * 원정 · 홈 붙여넣기 (+ 이닝별 점수표) → { game, report }
 *   game   = 저장할 경기 데이터 (core.js 엑셀 가져오기와 같은 모양: key · hs · as · th · ta · home_lineup · away_lineup · abs · zoneHistory · d · ts · info)
 *   report = 미리보기용 { away, home, pa, unknownTokens, ls, lsWarnings } — 팀별 { players, pa, batted, low, nonBatted, skipped:[{name,inning,raw}], noPA, noInning, runs, rbi }
 *            ls = 이닝별 점수표를 썼으면 { away, home } (parseGameOneScoreboard 의 팀 줄), 아니면 null
 * now · stadiums · stadium 을 받아 순수하게 만든다 (테스트용)
 */
export function buildGameOneGame({ awayText = '', homeText = '', scoreText = '', th = '', ta = '', date = '', now = Date.now(), stadiums = window.STADIUMS || {}, stadium = '' } = {}) {
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

  // 이닝별 점수표: 윗줄 = 원정(초), 아랫줄 = 홈(말). 입력한 팀 이름과 반대로 맞으면 바꾼다
  const tTh = String(th || '').trim(), tTa = String(ta || '').trim();
  report.ls = null; report.lsWarnings = [];
  if (String(scoreText).trim()) {
    const sb = _P().parseGameOneScoreboard(scoreText);
    report.lsWarnings = sb.warnings.slice();
    if (sb.teams.length >= 2) {
      let [aw, hm] = sb.teams;
      if ((tTh && aw.name === tTh) || (tTa && hm.name === tTa)) [aw, hm] = [hm, aw];
      report.ls = { away: aw, home: hm };
      if (sb.teams.length > 2) report.lsWarnings.push(`팀 줄이 ${sb.teams.length}개 있어 앞의 2개만 씁니다`);
      ['away', 'home'].forEach(t => {
        if (report[t].players && report[t].runs !== report.ls[t].r) {
          report.lsWarnings.push(`${t === 'away' ? '원정' : '홈'} 득점: 이닝별 점수표 R ${report.ls[t].r} · 타자 표 합계 ${report[t].runs} — 점수는 이닝별 점수표를 씁니다`);
        }
      });
    } else if (sb.teams.length === 1) report.lsWarnings.push('팀 줄을 1개만 찾았습니다 — 원정 · 홈 두 줄이 다 있어야 씁니다');
  }
  const ls = report.ls;

  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const d = (dm ? new Date(+dm[1], +dm[2] - 1, +dm[3]) : new Date(now)).toLocaleDateString('ko-KR');
  const game = {
    key: 'sl_' + now, hs: ls ? ls.home.r : report.home.runs, as: ls ? ls.away.r : report.away.runs,
    th: tTh || (ls && ls.home.name.slice(0, 20)) || '홈팀', ta: tTa || (ls && ls.away.name.slice(0, 20)) || '원정팀',
    home_lineup: lineups.home, away_lineup: lineups.away, abs, zoneHistory: {}, d, ts: now,
  };
  const info = {};
  if (dm) info.date = date;
  if (ls) info.ls = { away: ls.away.innings, home: ls.home.innings };
  if (Object.keys(info).length) game.info = info;
  return { game, report };
}

// ── 화면 ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const _esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let _timer = null;

function _inputs() {
  return {
    awayText: ($('goAway') || {}).value || '', homeText: ($('goHome') || {}).value || '', scoreText: ($('goScore') || {}).value || '',
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

// 이닝별 점수 미니 표 (원정 위 · 홈 아래, 진행한 이닝까지)
function _lsTable(ls, g) {
  const n = Math.max(ls.away.innings.length, ls.home.innings.length, 1);
  const cols = Array.from({ length: n }, (_, i) => i + 1);
  const row = (name, t) => `<tr><th scope="row">${_esc(name)}</th>${cols.map(i => `<td>${t.innings[i - 1] == null ? '' : _esc(t.innings[i - 1])}</td>`).join('')}<td class="r">${t.r}</td></tr>`;
  return `<div class="go-ls-wrap"><table class="go-ls"><caption>이닝별 점수</caption><thead><tr><th scope="col"><span class="go-sr">팀</span></th>${cols.map(i => `<th scope="col">${i}</th>`).join('')}<th scope="col" class="r">R</th></tr></thead>`
    + `<tbody>${row(g.ta, ls.away)}${row(g.th, ls.home)}</tbody></table></div>`;
}

function _preview() {
  const box = $('goPrev'), btn = $('goSave');
  if (!box || !btn) return;
  const inp = _inputs(), hasBat = !!(inp.awayText.trim() || inp.homeText.trim());
  if (!hasBat && !inp.scoreText.trim()) {
    box.innerHTML = '<div class="go-empty">표를 붙여넣으면 여기에 가져올 내용이 나옵니다</div>';
    btn.disabled = true;
    return;
  }
  let out;
  try { out = buildGameOneGame(Object.assign(inp, { now: Date.now() })); }
  catch (e) { box.innerHTML = '<div class="go-warn">읽지 못했습니다: ' + _esc(e && e.message || e) + '</div>'; btn.disabled = true; return; }
  const { report: R, game: g } = out;
  const lsH = (R.ls ? _lsTable(R.ls, g) : '') + R.lsWarnings.map(w => `<div class="go-warn">${_esc(w)}</div>`).join('');
  let h = _sideHtml('원정', R.away) + _sideHtml('홈', R.home);
  if (!R.away.players && !R.home.players) {
    h = lsH + (hasBat ? '<div class="go-warn">선수 행을 찾지 못했습니다 — 게임원 박스스코어의 타자 표(선수명(등번호)가 있는 행)를 복사해 주세요</div>'
      : '<div class="go-empty">타자 표도 붙여넣어야 저장할 수 있습니다</div>');
  } else {
    h = `<div class="go-score">${_esc(g.ta)} <b>${g.as}</b> : <b>${g.hs}</b> ${_esc(g.th)}</div>` + lsH + h;
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
  setTimeout(() => { const t = $('goScore'); if (t) t.focus(); }, 50);
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
  ['goScore', 'goAway', 'goHome'].forEach(id => { const t = $(id); if (t) t.value = ''; });
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
