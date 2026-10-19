// 게임원 박스스코어 붙여넣기 → 새 경기로 저장 (데이터 관리 › 가져오기 › 게임원)
// 파서는 js/gameone.js (window.SLGameOne). 저장은 엑셀 가져오기(core.js importExcelAsGame)와 같은 경로:
//   sl_<타임스탬프> 키 · _gameDataOk 검증 · sl_saves 항목 추가 · cloudSave · 불러오기 목록 열기. 기존 저장 형식은 그대로다.
// 정한 것 (2026-10-15):
//   · 새 경기로 저장 — 기록 중인 경기는 건드리지 않는다
//   · 원정 표 · 홈 표 칸 2개 — 원정 = 'N회초', 홈 = 'N회말' (10회 이상은 '연장'), 점수 = 각 표의 득점 합계
//   · 홈런 위치는 펜스 밖 그대로 (파서 값 그대로 — 그리는 쪽이 펜스 1.06배까지 표시, 핫존 집계는 가장 깊은 칸)
//   · 타석 타점은 0 — 게임원 표에는 타석별 타점이 없다(선수별 합계만). 미리보기에 안내한다
//     예외(2026-10-19): 홈런 [2R 97M] 표기가 있으면 그 홈런 타석은 타점 2 · 비거리 97m(ft 로 저장).
//     괄호 없는 홈런은 1타점 — 홈런은 타자 본인이 반드시 홈인하므로 최소 1타점은 확실하다(몇 점 홈런인지는 표에 없다)
//   · unknown 타석(결과를 모름)과 교체·주루 사건뿐인 칸은 저장하지 않고 미리보기에 보여 준다
//   · 이닝별 점수표(선택 칸): 점수 = 표의 R, 팀 이름이 비어 있으면 표의 이름. 이닝별 득점은 경기 정보에 info.ls = { away: [...], home: [...] } 로
//     새로 둔다(기존 필드는 그대로) — 경기 정보는 저장 · 불러오기 · 복구를 따라다니고, 기록 화면 라인스코어(scorebook.js)가 이닝 칸에 그린다.
//     공유 링크도 info.ls 를 싣는다(core.js _shareGameBuild — 다른 경기 정보와 함께) · 받는 쪽은 _restoreLsFromPayload 가 걸러 받는다
//   · 같은 경기 다시 가져오기 (2026-10-18): 날짜 · 팀 · 점수가 같은 저장 경기가 있으면 미리보기에 알리고 저장 전에 한 번 묻는다(막지는 않는다) — findSameGames
//   · 붙여넣기 실수 (2026-10-18): 한 칸에 표 두 개(_secondTable) · 원정 · 홈 칸에 같은 표(report.shared)도 같은 방식으로 알리고 묻는다
//   · 페이지 통째 붙여넣기 (2026-10-19): 휴대폰 '전체 선택 → 복사' 덩어리를 어느 칸에 넣어도 점수표 · 원정 · 홈 칸으로 나눠 채운다(_autoSplit)
//   · 투수 표(선택 칸, 2026-10-19): 위 표 = 원정 투수, 아래 표 = 홈 투수. 투수 표 순서대로 '상대 타자' 수만큼 상대 팀 타석을 잘라
//     타석마다 a.pitcher(투수 이름)를 넣는다 — 기존 필드(기록 탭 타자 상세 「투수별 요약」 · 엑셀 투수 칸이 '직접 적힌 투수'로 읽는다).
//     상대 타자 수 합이 상대 팀 타석 수와 다르면 붙이지 않고 알린다.
//     투수 성적은 경기 데이터에 pitchLines = { away: [...], home: [...] } 로 새로 둔다(기존 필드는 그대로, 2026-10-19 A안) —
//     분석 탭 › 투수의 '게임원 투수 시즌 기록'(gopitchseason.js)이 저장 경기 전체에서 모은다. 다시 저장해도 saveGame 이 이전 필드를 이어 쓴다
//   · 사용 기록(GA4, 2026-10-19): 입력창 열기 gameone_import_open · 저장 gameone_import — 숫자 · 방식만 싣는다(선수 · 팀 이름 · 기록 글자는 싣지 않는다).
//     pa 타석 수 · paste 'page'(통째 붙여넣기를 나눔) | 'tables' · scoreboard 이닝별 점수표 0/1 · pitch 'none' | 'saved' | 'partial' | 'linked'
//     · skipped 모르는 기록 타석 수 · warned 경고를 보고도 저장 0/1

// 게임원 수비위치 → 앱 포지션 (lineup pos). 실제 30경기(2026-10-19)에서 나온 표기는 一 二 三 유 좌 중 우 포 투 지 미 11개뿐.
// 미 = 수비하지 않은 대타 → 빈 칸. 1 · 2 · 3 · 지명 · DH 는 처음 받은 예시 형식(탭 3칸)용으로 남겨 둔다
const POS = {
  __proto__: null,
  '一': '1루', '二': '2루', '三': '3루', '1': '1루', '2': '2루', '3': '3루',
  '유': '유격', '좌': '좌익', '중': '중견', '우': '우익', '포': '포수', '투': '투수', '지': 'DH', '지명': 'DH', 'DH': 'DH', '미': '',
};
const _P = () => window.SLGameOne;
const _track = (name, params) => { try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (e) {} };
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

// 한 칸에 표 두 개(두 팀)를 붙여넣었는지. 게임원 표에서 교체 선수가 어디에 오는지(제 타순 아래 · 표 맨 아래) 몰라도 맞는 신호만 쓴다:
//   sep     — 선수 행 사이에 합계 · 머리글 줄이 있다 = 표가 끝나고 새 표가 시작됐다
//             (실제 PC 웹 복사는 '합 계 …' · '선수 1 2 … 타수 …', 처음 받은 예시는 '합계' · '타순 위치 선수명 …')
//   restart — 타순이 처음부터 다시 도는 묶음이 2개 이상: 타순이 줄어드는 곳에서 끊은 묶음 가운데 서로 다른 타순이
//             max(5, 마지막 타순 − 2)개 이상인 묶음. 교체 선수가 제 타순 아래에 오면 타순이 줄지 않고,
//             표 맨 아래에 모여도 7자리 이상(9번 타순 기준) 바뀌지 않는 한 그런 묶음이 되지 않는다
// → 두 번째 표가 시작하는 선수 { name, number, line, why } 또는 null. players[].line = 붙여넣은 글의 줄 번호(1~, parseGameOne)
function _secondTable(text, players) {
  const lines = String(text).split(/\r\n|\r|\n/);
  for (let i = 1; i < players.length; i++) {
    for (let k = players[i - 1].line; k < players[i].line - 1; k++) {
      if (/합\s*계|선수|타순/.test(lines[k] || '')) return { name: players[i].name, number: players[i].number, line: players[i].line, why: 'sep' };
    }
  }
  const N = Math.max(0, ...players.map(p => p.order || 0)), need = Math.max(5, N - 2), full = [];
  let start = 0, prev = null;
  const close = end => { if (new Set(players.slice(start, end).map(p => p.order).filter(o => o != null)).size >= need) full.push(start); };
  players.forEach((p, i) => {
    if (p.order == null) return;
    if (prev != null && p.order < prev) { close(i); start = i; }
    prev = p.order;
  });
  close(players.length);
  if (full.length < 2) return null;
  const p = players[full[1]];
  return { name: p.name, number: p.number, line: p.line, why: 'restart' };
}

/**
 * 원정 · 홈 붙여넣기 (+ 이닝별 점수표) → { game, report }
 *   game   = 저장할 경기 데이터 (core.js 엑셀 가져오기와 같은 모양: key · hs · as · th · ta · home_lineup · away_lineup · abs · zoneHistory · d · ts · info)
 *   report = 미리보기용 { away, home, pa, unknownTokens, ls, lsWarnings, shared } — 팀별 { players, pa, batted, low, nonBatted, skipped:[{name,inning,raw}], noPA, noInning, runs, rbi, split, keys }
 *            split = 한 칸에 표가 두 개면 두 번째 표 첫 선수 { name, number, line, why }(_secondTable), 아니면 null · keys = 선수 '이름|등번호'
 *            shared = 원정 · 홈 칸 둘 다에 있는 선수 ['이름(등번호)'…] (같은 표를 두 칸에 붙여넣은 경우만, 아니면 [])
 *            ls = 이닝별 점수표를 썼으면 { away, home } (parseGameOneScoreboard 의 팀 줄), 아니면 null
 * now · stadiums · stadium 을 받아 순수하게 만든다 (테스트용)
 */
export function buildGameOneGame({ awayText = '', homeText = '', scoreText = '', pitchText = '', th = '', ta = '', date = '', now = Date.now(), stadiums = window.STADIUMS || {}, stadium = '' } = {}) {
  const st = stadiums[stadium] || stadiums.standard || { lfDist: 90, cfDist: 120, rfDist: 90 };
  const lf = Math.round(st.lfDist * 3.281), cf = Math.round(st.cfDist * 3.281), rf = Math.round(st.rfDist * 3.281);
  const wallFt = { LF: lf, LC: Math.round((lf + cf) / 2), CF: cf, RC: Math.round((cf + rf) / 2), RF: rf };   // core.js onFClick 과 같은 담장 거리
  const lineups = { home: [], away: [] }, report = { pa: 0, unknownTokens: [] }, seenTok = Object.create(null);
  const all = [];
  let nid = 0;

  ['away', 'home'].forEach(team => {
    const text = team === 'away' ? awayText : homeText;
    const r = { players: 0, pa: 0, batted: 0, low: 0, nonBatted: 0, skipped: [], noPA: 0, noInning: 0, runs: 0, rbi: 0, hrRbi: 0, hrMin: 0, split: null, keys: [] };
    report[team] = r;
    if (!String(text).trim()) return;
    const res = _P().parseGameOne(text);
    r.split = _secondTable(text, res.players);
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
        const e = { a, lp, slot: p.order, round, row, inning: a.inning == null ? Infinity : a.inning, team };
        // 모르는 기록 · 타격방해는 저장하지 않지만 타석이라 순서에는 넣는다(drop) — 투수의 '상대 타자' 수에 들어간다
        if (a.type === 'unknown') { r.skipped.push({ name: p.name, inning: a.inning, raw: a.raw }); e.drop = true; entries.push(e); return; }
        if (a.result == null) { r.noPA++; if (/타격방해/.test(a.raw)) { e.drop = true; entries.push(e); } return; }   // 교체 · 주루 사건뿐 — 타석이 아니다
        entries.push(e);
      });
    });
    r.players = lineups[team].length;
    r.keys = Object.keys(seen);
    _orderSide(entries).forEach(e => {
      const a = e.a;
      if (e.drop) { all.push(e); return; }
      r.pa++;
      if (a.type === 'batted') { r.batted++; if (a.confidence === 'low') r.low++; } else r.nonBatted++;
      if (a.inning == null) r.noInning++;
      if (a.rbi != null) r.hrRbi += a.rbi;
      else if (a.result === '홈런') r.hrMin++;
      all.push(e);
    });
  });

  // 원정(초) → 홈(말) 순으로 이닝마다 섞는다. 이닝을 모르는 타석은 맨 뒤
  const half = { away: 0, home: 1 };
  const sorted = all.map((e, i) => ({ e, i })).sort((p, q) => p.e.inning - q.e.inning || half[p.e.team] - half[q.e.team] || p.i - q.i).map(x => x.e);
  // 투수 표 → 타석마다 투수 이름 (위 표 = 원정 투수 → 홈 타석, 아래 표 = 홈 투수 → 원정 타석, 둘 다 경기 순서)
  report.pitch = null; report.pitchWarnings = [];
  if (String(pitchText).trim()) {
    const P = _P().parseGameOnePitchers(pitchText);
    report.pitchWarnings = P.warnings.slice();
    if (P.tables.length >= 2) {
      report.pitch = { away: P.tables[0], home: P.tables[1], linked: { away: false, home: false } };
      if (P.tables.length > 2) report.pitchWarnings.push(`투수 표가 ${P.tables.length}개 있어 앞의 2개만 씁니다`);
      ['away', 'home'].forEach(pt => {
        const list = report.pitch[pt].pitchers, opp = sorted.filter(e => e.team === (pt === 'away' ? 'home' : 'away'));
        const tbf = list.reduce((n, x) => n + x.tbf, 0);
        if (!opp.length) return;
        if (tbf !== opp.length) {
          report.pitchWarnings.push(`${pt === 'away' ? '원정' : '홈'} 투수 표의 상대 타자 합 ${tbf} ≠ ${pt === 'away' ? '홈' : '원정'} 타석 ${opp.length} — 이 팀 타석에는 투수를 붙이지 않았습니다`);
          return;
        }
        let k = 0;
        list.forEach(x => { for (let i = 0; i < x.tbf; i++) opp[k++].pitcher = x.name; });
        report.pitch.linked[pt] = true;
      });
    } else report.pitchWarnings.push(P.tables.length ? '투수 표를 1개만 찾았습니다 — 원정 · 홈 두 표가 다 있어야 씁니다' : '투수 표 머리글(선수 결과 이닝 …)을 찾지 못했습니다');
  }

  const abs = sorted.filter(e => !e.drop).map(({ a, lp, team, pitcher }) => {
    const inn = a.inning == null ? '' : a.inning > 9 ? '연장' : a.inning + '회' + (team === 'away' ? '초' : '말');
    const loc = a.type === 'batted';
    return {
      id: now + nid++, bid: lp.id, bname: lp.name, bnum: lp.num, team, res: a.result, pt: null, zone: null, rbi: a.rbi != null ? a.rbi : a.result === '홈런' ? 1 : 0,
      x: loc ? a.x : null, y: loc ? a.y : null, deg: loc ? a.angle : null, dir: loc ? a.dir : null,
      ft: loc ? (a.distance ? Math.round(a.distance * 3.281) : Math.round(a.depth * (wallFt[a.dir] || 370))) : null, inn, ts: '', pitches: [],
      ...(pitcher ? { pitcher } : {}),
    };
  });
  report.pa = abs.length;
  // 원정 · 홈 칸에 같은 선수(이름 + 등번호): 2명 이상(한쪽이 1명뿐이면 그 1명)이면 같은 표를 두 칸에 붙여넣은 것으로 본다 — 동명이인 한 명은 넘어간다
  const homeKeys = new Set(report.home.keys);
  const both = report.away.keys.filter(k => homeKeys.has(k)).map(k => { const [n, num] = k.split('|'); return n + '(' + num + ')'; });
  report.shared = both.length && both.length >= Math.min(2, report.away.players, report.home.players) ? both : [];

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
  if (report.pitch) {
    const keep = x => ({ name: x.name, number: x.number, result: x.result, outs: x.outs, tbf: x.tbf, ab: x.ab, h: x.h, hr: x.hr, sh: x.sh, sf: x.sf, bb: x.bb, hbp: x.hbp, k: x.k, wp: x.wp, bk: x.bk, r: x.r, er: x.er, np: x.np });
    game.pitchLines = { away: report.pitch.away.pitchers.map(keep), home: report.pitch.home.pitchers.map(keep) };
  }
  const info = {};
  if (dm) info.date = date;
  if (ls) info.ls = { away: ls.away.innings, home: ls.home.innings };
  if (Object.keys(info).length) game.info = info;
  return { game, report };
}

// 같은 경기 찾기: 날짜 · 홈 팀 · 원정 팀 · 점수가 모두 같은 저장 경기 → [{ key, label, g }]
// 게임원 가져오기는 저장할 때마다 타석 id 를 새로 만들어, 저장 경기 읽기(games.js groupGames)가 같은 경기로 묶지 못한다
// → 같은 표를 다시 저장하면 시즌 기록에 두 번 들어간다. 직접 기록한 경기와 겹쳐도 마찬가지라 같이 찾는다. 막지는 않고 알린다
// 날짜 = 경기 정보 날짜(info.date), 없으면 저장일(d, 'YYYY. M. D.'). 홈 · 원정이 바뀐 것(점수도 같이 바뀜)도 같은 경기로 본다 — 직접 기록할 때 우리 팀을 늘 홈에 두는 경우
const _ymd = g => {
  const i = g && g.info;
  if (i && typeof i.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(i.date)) return i.date;
  const m = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/.exec(String((g && g.d) || ''));
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
};
const _tn = s => String(s == null ? '' : s).trim();
export function findSameGames(game, saved) {
  const day = _ymd(game);
  if (!day) return [];
  const th = _tn(game.th), ta = _tn(game.ta), hs = +game.hs, as = +game.as;
  const is = (g, h, a, x, y) => _tn(g.th) === h && _tn(g.ta) === a && +g.hs === x && +g.as === y;
  return saved.filter(({ g }) => g && _ymd(g) === day && (is(g, th, ta, hs, as) || is(g, ta, th, as, hs)));
}

// ── 화면 ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const _esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let _timer = null;

// 저장 경기 목록 — 미리보기는 글자를 칠 때마다 돌아서, 목록(sl_saves)이 그대로면 읽어 둔 것을 쓴다. 입력창을 열 때 새로 읽는다
let _saved = { raw: null, list: [] };
function _savedGames() {
  let raw = null;
  try { raw = localStorage.getItem('sl_saves'); } catch (e) { return []; }
  if (raw === _saved.raw) return _saved.list;
  let saves = [];
  try { saves = JSON.parse(raw || '[]'); } catch (e) {}
  const list = (Array.isArray(saves) ? saves : []).map(s => {
    if (!s || typeof s.key !== 'string') return null;
    let g = null;
    try { g = JSON.parse(localStorage.getItem(s.key) || 'null'); } catch (e) {}
    return g && typeof g === 'object' ? { key: s.key, label: typeof s.label === 'string' && s.label ? s.label : `${g.th} ${g.hs}:${g.as} ${g.ta}`, g } : null;
  }).filter(Boolean);
  _saved = { raw, list };
  return list;
}
function _sameText(dup) {
  return `이미 저장된 경기와 날짜 · 팀 · 점수가 같습니다: ${dup[0].label}${dup.length > 1 ? ` 외 ${dup.length - 1}개` : ''}`;
}
// 저장 전에 확인할 것: 같은 경기(dup) · 한 칸에 표 두 개 · 두 칸에 같은 표 → [{ cls, text }]. 미리보기에 띄우고, 하나라도 있으면 저장 전에 묻는다
function _issues(R, dup) {
  const out = [];
  if (dup.length) out.push({ cls: 'go-dup', text: `${_sameText(dup)} — 같은 경기를 또 저장하면 시즌 기록에 두 번 들어갑니다` });
  [['away', '원정'], ['home', '홈']].forEach(([t, label]) => {
    const s = R[t].split;
    if (s) out.push({ cls: 'go-two', text: `${label} 칸에 표가 두 개 들어간 것 같습니다: ${s.line}번째 줄 ${s.name}(${s.number})부터 `
      + (s.why === 'sep' ? '합계 · 머리글 줄 다음의 다른 표입니다' : '타순이 처음부터 다시 돕니다') + ' — 한 칸에는 한 팀 표만 붙여넣어 주세요' });
  });
  if (R.shared.length) out.push({ cls: 'go-two', text: `원정 · 홈 칸에 같은 선수가 있습니다: ${R.shared.slice(0, 3).join(' · ')}${R.shared.length > 3 ? ` 외 ${R.shared.length - 3}명` : ''} — 같은 표를 두 칸에 붙여넣었는지 확인해 주세요` });
  return out;
}

function _inputs() {
  return {
    awayText: ($('goAway') || {}).value || '', homeText: ($('goHome') || {}).value || '', scoreText: ($('goScore') || {}).value || '', pitchText: ($('goPitch') || {}).value || '',
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

// 박스스코어 페이지를 통째로 붙여넣었으면(휴대폰 '전체 선택 → 복사') 이닝별 점수표 · 원정 · 홈 칸으로 나눠 채운다 (splitGameOnePage).
// 페이지 위 타자 표 = 점수표 윗줄 팀 = 원정(초) — 따로 붙여넣을 때와 같은 규칙. 나눈 결과가 칸에 보여서 사용자가 확인 · 고칠 수 있다
let _splitNote = '', _usedSplit = false;   // _usedSplit = 지난 저장 뒤 통째 붙여넣기를 나눈 적이 있다(사용 기록용)
function _autoSplit() {
  for (const id of ['goScore', 'goAway', 'goHome', 'goPitch']) {
    const el = $(id), sp = el && el.value ? _P().splitGameOnePage(el.value) : null;
    if (!sp) continue;
    if (sp.score) $('goScore').value = sp.score; else if (id === 'goScore') $('goScore').value = '';
    if ($('goPitch') && (sp.pitch || id === 'goPitch')) $('goPitch').value = sp.pitch;
    $('goAway').value = sp.tables[0].text; $('goHome').value = sp.tables[1].text;
    _usedSplit = true;
    const nm = (t, d) => (t.name ? `${d}(${t.name})` : d);
    _splitNote = `박스스코어 페이지를 통째로 붙여넣어 ${sp.score ? '이닝별 점수표 · ' : ''}${nm(sp.tables[0], '원정')} · ${nm(sp.tables[1], '홈')} 타자 표${sp.pitch ? ' · 투수 표' : ''}로 나눴습니다`
      + (sp.tables.length > 2 ? ` — 타자 표가 ${sp.tables.length}개라 앞의 2개만 씁니다` : '') + '. 메뉴 · 요약 글자는 쓰지 않습니다';
    return;
  }
}

// 투수 기록 미니 표 (미리보기만 — 투수 성적 합계는 저장하지 않는다). 이닝 = 아웃 수 → '2 ⅔'
const _ip = o => Math.floor(o / 3) + (o % 3 ? (o % 3 === 1 ? ' ⅓' : ' ⅔') : '');
function _pitchTable(P, g) {
  const rows = t => t.pitchers.map(x => `<tr><th scope="row">${_esc(x.name)}</th><td>${x.result === '-' ? '' : _esc(x.result)}</td><td>${_ip(x.outs)}</td><td>${x.tbf}</td><td>${x.h}</td><td>${x.bb + x.hbp}</td><td>${x.k}</td><td>${x.r}/${x.er}</td></tr>`).join('');
  const sec = (pt, label) => `<tbody><tr class="go-pt-team"><th colspan="8">${_esc(label)}${P.linked[pt] ? ' · 상대 타석에 연결' : ''}</th></tr>${rows(P[pt])}</tbody>`;
  return `<div class="go-ls-wrap"><table class="go-ls go-pt"><caption>투수 기록</caption><thead><tr><th scope="col"><span class="go-sr">투수</span></th>`
    + ['결과', '이닝', '상대', '피안타', '사사구', '삼진', '실점/자책'].map(c => `<th scope="col">${c}</th>`).join('') + `</tr></thead>${sec('away', '원정 ' + g.ta)}${sec('home', '홈 ' + g.th)}</table></div>`;
}

function _preview() {
  const box = $('goPrev'), btn = $('goSave');
  if (!box || !btn) return;
  _autoSplit();
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
  const lsH = (R.ls ? _lsTable(R.ls, g) : '') + R.lsWarnings.map(w => `<div class="go-warn">${_esc(w)}</div>`).join('')
    + (R.pitch ? _pitchTable(R.pitch, g) : '') + R.pitchWarnings.map(w => `<div class="go-warn">${_esc(w)}</div>`).join('');
  let h = _sideHtml('원정', R.away) + _sideHtml('홈', R.home);
  const iss = R.pa ? _issues(R, findSameGames(g, _savedGames())) : [];
  if (!R.away.players && !R.home.players) {
    h = lsH + (hasBat ? '<div class="go-warn">선수 행을 찾지 못했습니다 — 게임원 박스스코어의 타자 표(선수명(등번호)가 있는 행)를 복사해 주세요.'
      + ' 전체 선택으로 복사했다면 <b>표를 한 번 누른 뒤</b> 다시 전체 선택해 보세요(리그 페이지는 박스스코어가 안쪽 화면에 따로 있습니다)</div>'
      : '<div class="go-empty">타자 표도 붙여넣어야 저장할 수 있습니다</div>');
  } else {
    h = `<div class="go-score">${_esc(g.ta)} <b>${g.as}</b> : <b>${g.hs}</b> ${_esc(g.th)}</div>`
      + iss.map(i => `<div class="go-warn ${i.cls}">${_esc(i.text)}</div>`).join('') + lsH + h;
    const rbi = R.away.rbi + R.home.rbi, hr = R.away.hrRbi + R.home.hrRbi, hrMin = R.away.hrMin + R.home.hrMin;
    const hrTxt = [hr ? '홈런 [2R 97M] 같은 기록이 있으면 그 타점' : '', hrMin ? '기록 없는 홈런은 최소 1타점(타자 본인 득점)' : ''].filter(Boolean).join(', ');
    h += `<div class="go-note">타점: 게임원 표에는 타석별 타점이 없어 ${hrTxt ? hrTxt + ', 나머지 타석은 ' : ''}0으로 저장됩니다`
      + (rbi ? ` (표의 타점 합계 ${rbi}${hr + hrMin ? ` · 홈런으로 넣은 타점 ${hr + hrMin}` : ''})` : '') + '.'
      + (R.away.low + R.home.low ? ' "대략"은 안타·뜬공·땅볼처럼 떨어진 자리 폭이 넓어 방향 대표값으로 찍은 타구입니다.' : '') + '</div>';
    if (R.pitch) h += '<div class="go-note">투수: 투수 성적은 이 경기에 함께 저장되어 분석 탭 › 투수의 「게임원 투수 시즌 기록」에 모입니다.'
      + (R.pitch.linked.away || R.pitch.linked.home ? ' 투수 표 순서대로 상대 타석에 투수를 붙여, 기록 탭 타자 상세 「투수별 요약」과 엑셀 투수 칸에도 나옵니다.' : '') + '</div>';
  }
  box.innerHTML = (_splitNote ? `<div class="go-note go-split">${_esc(_splitNote)}</div>` : '') + h;
  btn.disabled = !R.pa;
  btn.textContent = R.pa ? `${iss.length ? '그래도 ' : ''}새 경기로 저장 (${R.pa}타석)` : '새 경기로 저장';
}

function _schedule() { clearTimeout(_timer); _splitNote = ''; _timer = setTimeout(_preview, 150); }

export function openGameOneImport() {
  if (!_P()) { if (window.showToast) window.showToast('게임원 파서를 불러오지 못했습니다 — 새로고침 후 다시 시도해 주세요', false); return; }
  if (window.closeOverlay) window.closeOverlay('dataSettingsOverlay');
  const dt = $('goDate');
  if (dt && !dt.value) { const n = new Date(), p = v => String(v).padStart(2, '0'); dt.value = `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`; }
  _saved.raw = null;   // 저장 경기를 새로 읽는다(목록은 그대로인데 경기 내용만 바뀐 경우)
  _preview();
  if (window.openOverlay) window.openOverlay('goOverlay');
  _track('gameone_import_open');
  setTimeout(() => { const t = $('goScore'); if (t) t.focus(); }, 50);
}

export function saveGameOneImport() {
  const toast = m => { if (window.showToast) window.showToast(m, false); };
  _autoSplit();   // 미리보기(150ms 뒤)보다 먼저 눌러도 나눈 칸으로 저장
  let out;
  try { out = buildGameOneGame(Object.assign(_inputs(), { now: Date.now() })); } catch (e) { toast('읽지 못했습니다: ' + (e && e.message || e)); return; }
  const { game: g, report: R } = out;
  if (!g.abs.length) { toast('저장할 타석이 없습니다'); return; }
  if (typeof _gameDataOk === 'function' && !_gameDataOk(g)) { toast('경기 데이터 형식이 올바르지 않아 저장하지 않았습니다'); return; }   // 다른 가져오기 경로와 같은 검증
  _saved.raw = null;
  const iss = _issues(R, findSameGames(g, _savedGames()));
  if (iss.length && !confirm(iss.map(i => '· ' + i.text).join('\n') + '\n\n그래도 새 경기로 저장할까요?')) return;
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
  ['goScore', 'goAway', 'goHome', 'goPitch'].forEach(id => { const t = $(id); if (t) t.value = ''; });
  _preview();
  if (window.closeOverlay) window.closeOverlay('goOverlay');
  if (window.openLoad) window.openLoad();
  const skipped = R.away.skipped.length + R.home.skipped.length, L = R.pitch && R.pitch.linked;
  _track('gameone_import', {
    pa: g.abs.length, paste: _usedSplit ? 'page' : 'tables', scoreboard: R.ls ? 1 : 0,
    pitch: !L ? 'none' : L.away && L.home ? 'linked' : L.away || L.home ? 'partial' : 'saved', skipped, warned: iss.length ? 1 : 0,
  });
  _usedSplit = false;
  toast(`게임원 ${g.abs.length}타석 → 새 경기로 저장됨` + (skipped ? ` (모르는 기록 ${skipped}타석 제외)` : ''));
}

if (typeof window !== 'undefined') {
  window.SLGameOneImport = { buildGameOneGame, findSameGames };
  window.openGameOneImport = openGameOneImport;
  window.saveGameOneImport = saveGameOneImport;
  window.gameOnePreview = _schedule;
}
