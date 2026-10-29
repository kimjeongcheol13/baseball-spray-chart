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
//     2026-10-30: 표의 선수별 타점 합계 − 홈런 타점 = 남은 타점을 그 선수 타석에 나눠 넣는다(어느 타석인지는 추정) — _spreadRbi.
//     타점은 타석마다 a.rbi 를 더해 세는 곳이 많아(시즌 · 순위 · 리포트 · 엑셀 …) 여기서 채우면 모두 맞는다. 기록 수정 창에서 고칠 수 있다
//   · unknown 타석(결과를 모름)과 교체·주루 사건뿐인 칸은 저장하지 않고 미리보기에 보여 준다
//   · 이닝별 점수표(선택 칸): 점수 = 표의 R, 팀 이름이 비어 있으면 표의 이름. 이닝별 득점은 경기 정보에 info.ls = { away: [...], home: [...] } 로
//     새로 둔다(기존 필드는 그대로) — 경기 정보는 저장 · 불러오기 · 복구를 따라다니고, 기록 화면 라인스코어(scorebook.js)가 이닝 칸에 그린다.
//     공유 링크도 info.ls 를 싣는다(core.js _shareGameBuild — 다른 경기 정보와 함께) · 받는 쪽은 _restoreLsFromPayload 가 걸러 받는다
//   · 같은 경기 다시 가져오기 (2026-10-18): 날짜 · 팀 · 점수가 같은 저장 경기가 있으면 미리보기에 알리고 저장 전에 한 번 묻는다(막지는 않는다) — findSameGames
//     2026-10-30: 그 경기에 넣을 타점이 있으면 미리보기에 「기존 경기에 타점만 채우기」 — 새 경기를 만들지 않고 타석 타점만 옮긴다(planRbiFill).
//     예전 가져오기(#292 전)는 타석 타점이 0(홈런만)이라 시즌 타점이 빠져 있었다. 위치 · 다른 칸은 그대로(「타구 위치 확인」에서 옮긴 자리 유지)
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
//   · 바로가기 (2026-10-19): 데이터 관리 타일만으로는 처음 온 사람이 못 찾는다
//     - 링크 index.html?go=1 (랜딩 · 소개 글) → 앱을 열고 입력창을 바로 연다. go 는 주소에서 지운다(새로 고쳐도 다시 열리지 않게).
//       공유 링크 · 가져오기 링크 · 로그인 돌아오기(game · gid · team · import · code · #share=)와 같이 오면 열지 않는다(그쪽이 먼저)
//     - 기록이 하나도 없는 첫 화면(저장 경기 0 · 기록 중 타석 0) 필드 아래 「게임원 기록 가져오기」(#goStart). 샘플 버튼과 같은 방식으로
//       첫 사용 말풍선(updateFieldTapHint)이 갱신될 때 다시 판단한다(core.js 는 고치지 않는다)
//   · 보정 (2026-10-19): 타구 점마다 estimated = 파서 confidence 'low'(안 · 플 · 땅처럼 폭이 넓은 결과 · R · 미확인 토큰 섞임 등).
//     저장 직후 「타구 위치 확인」(gameonefix.js)을 한 번 연다 — 필드를 탭하거나 점을 끌어 옮기면 좌표 · 방향 · 거리가 바뀌고 estimated = false.
//     estimated 가 없는 예전 기록 · 직접 찍은 기록 = 직접 입력으로 본다. 통계 계산은 estimated 와 무관
//     - 링크 · 첫 화면 버튼으로 열면 '복사하는 방법'을 펼쳐 둔다(처음 쓰는 사람). 열기 이벤트에 from = 'tile'(데이터 관리) | 'link'(?go=1) | 'empty'(첫 화면 버튼)

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

// 남은 타점 나눠 넣기: 타점이 날 수 있는 결과만, 장타 → 안타 → 희비 → 야수선택 · 땅볼 → 볼넷 · 사구 순(같으면 경기 순서)으로
// 한 타석에 1점씩 돌고, 남으면 안타 타석에 더 넣는다(한 타석 최대 3 · 나머지는 1). 이닝별 점수표가 있으면 그 이닝 팀 득점까지만(0점 이닝은 건너뜀).
// 삼진 · 뜬공 · 병살 · 실책은 넣지 않는다. 넣을 곳이 없어 남은 타점 수를 돌려준다(미리보기 안내용)
const RBI_RANK = { '3루타': 0, '2루타': 0, '안타': 1, '내야안타': 1, '희비': 2, '야수선택': 3, '땅볼 아웃': 3, '볼넷': 4, '사구': 4 };
const RBI_HIT = { '3루타': 1, '2루타': 1, '안타': 1, '내야안타': 1 };
function _spreadRbi(rows, ls) {
  let left = 0;
  rows.forEach(w => {
    let need = w.rbi - w.pas.reduce((s, x) => s + x.ab.rbi, 0);
    if (need <= 0) return;
    const c = w.pas.filter(x => x.ab.res in RBI_RANK).map(x => {
      const v = ls && x.inning != null ? ls[x.team].innings[x.inning - 1] : null;
      return { ab: x.ab, cap: Math.min(RBI_HIT[x.ab.res] ? 3 : 1, typeof v === 'number' ? v : 3) };
    }).sort((p, q) => RBI_RANK[p.ab.res] - RBI_RANK[q.ab.res]);
    for (let k = 0; k < 3 && need > 0; k++) c.forEach(o => { if (need > 0 && o.ab.rbi < o.cap) { o.ab.rbi++; need--; } });
    left += need;
  });
  return left;
}

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
export function buildGameOneGame({ awayText = '', homeText = '', scoreText = '', pitchText = '', th = '', ta = '', date = '', venue = '', now = Date.now(), stadiums = window.STADIUMS || {}, stadium = '' } = {}) {
  const st = stadiums[stadium] || stadiums.standard || { lfDist: 90, cfDist: 120, rfDist: 90 };
  const lf = Math.round(st.lfDist * 3.281), cf = Math.round(st.cfDist * 3.281), rf = Math.round(st.rfDist * 3.281);
  const wallFt = { LF: lf, LC: Math.round((lf + cf) / 2), CF: cf, RC: Math.round((cf + rf) / 2), RF: rf };   // core.js onFClick 과 같은 담장 거리
  const lineups = { home: [], away: [] }, report = { pa: 0, unknownTokens: [] }, seenTok = Object.create(null);
  const all = [], rbiRows = [];   // rbiRows: 선수 행마다 { rbi: 표의 타점 합계, pas: 저장할 타석 } — _spreadRbi
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
      const w = { rbi: _num(p.stats.rbi), pas: [] };
      rbiRows.push(w);
      let lastInn = null, round = 0;
      p.atBats.forEach(a => {
        round = a.inning != null && a.inning === lastInn ? round + 1 : 0;
        lastInn = a.inning;
        const e = { a, lp, slot: p.order, round, row, inning: a.inning == null ? Infinity : a.inning, team, w };
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

  const abs = sorted.filter(e => !e.drop).map(({ a, lp, team, pitcher, w }) => {
    const inn = a.inning == null ? '' : a.inning > 9 ? '연장' : a.inning + '회' + (team === 'away' ? '초' : '말');
    const loc = a.type === 'batted';
    const ab = {
      id: now + nid++, bid: lp.id, bname: lp.name, bnum: lp.num, team, res: a.result, pt: null, zone: null, rbi: a.rbi != null ? a.rbi : a.result === '홈런' ? 1 : 0,
      x: loc ? a.x : null, y: loc ? a.y : null, deg: loc ? a.angle : null, dir: loc ? a.dir : null,
      ft: loc ? (a.distance ? Math.round(a.distance * 3.281) : Math.round(a.depth * (wallFt[a.dir] || 370))) : null, inn, ts: '', pitches: [],
      ...(pitcher ? { pitcher } : {}),
      ...(loc ? { estimated: a.confidence === 'low' } : {}),   // 위치 추정(대략) — 「타구 위치 확인」(gameonefix.js)에서 옮기면 false
    };
    w.pas.push({ ab, inning: a.inning, team });
    return ab;
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
  report.rbiLeft = _spreadRbi(rbiRows, ls);   // 남은 타점 나눠 넣기(이닝별 점수표가 있으면 득점한 이닝까지만) · 넣을 곳이 없어 빠진 타점 수

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
  if (String(venue).trim()) info.venue = String(venue).trim().slice(0, 20);   // 페이지 경기 정보 줄의 구장(경기설정 탭 '구장'과 같은 칸 · 20자)
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

// 기존 경기에 타점만 채우기: 다시 붙여넣은 표로 만든 경기(game)의 타석 타점을 같은 경기(old)의 같은 선수(팀 · 이름 · 등번호) 타석에 옮길 계획.
// 그 선수의 타석 수 · 결과 순서가 모두 같고, 아직 손대지 않은 타점(홈런이 아닌 타석은 0 · 홈런은 0 또는 같은 값)일 때만 옮긴다.
// 기록이 다르거나 타점을 이미 고친 선수는 건드리지 않고 이름을 돌려준다 → { sets: [[타석, 타점]…], added, skipped: [이름…] }
export function planRbiFill(game, old) {
  const swap = _tn(old.th) !== _tn(game.th);   // findSameGames 는 홈 · 원정이 바뀐 것도 같은 경기로 본다
  const group = (abs, flip) => {
    const m = new Map();
    abs.forEach(a => {
      const t = flip ? (a.team === 'home' ? 'away' : 'home') : a.team, k = t + '|' + a.bname + '|' + String(a.bnum == null ? '' : a.bnum);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    });
    return m;
  };
  const mine = group(old.abs || [], false), sets = [], skipped = [];
  let added = 0;
  group(game.abs, swap).forEach((list, k) => {
    const cur = mine.get(k) || [], want = list.reduce((s, a) => s + a.rbi, 0), have = cur.reduce((s, a) => s + (a.rbi || 0), 0);
    if (want <= have) return;
    const ok = cur.length === list.length && cur.every((a, i) => a.res === list[i].res && (!a.rbi || (a.res === '홈런' && a.rbi === list[i].rbi)));
    if (!ok) { skipped.push(list[0].bname); return; }
    cur.forEach((a, i) => { if ((a.rbi || 0) !== list[i].rbi) sets.push([a, list[i].rbi]); });
    added += want - have;
  });
  return { sets, added, skipped };
}

// 경기 정보 줄의 월.일(parseGameOneInfo) → 'YYYY-MM-DD'. 페이지에 연도가 없어 올해로 하되, 그 날짜가 오늘보다 뒤면 작년(지난 시즌 경기를 연초에 가져오는 경우).
// 없는 날짜(2.30 등) · 정보 없음 → ''
const _p2 = v => String(v).padStart(2, '0');
export function gameOneInfoDate(info, now = Date.now()) {
  if (!info || !info.month || !info.day) return '';
  const t = new Date(now), today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  for (const y of [t.getFullYear(), t.getFullYear() - 1]) {
    const d = new Date(y, info.month - 1, info.day);
    if (d.getMonth() !== info.month - 1) continue;   // 그해에 없는 날짜(2.30 → 3.2 로 넘어감)
    if (d <= today) return `${y}-${_p2(info.month)}-${_p2(info.day)}`;
  }
  return '';
}

// ── 화면 ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const _today = () => { const n = new Date(); return `${n.getFullYear()}-${_p2(n.getMonth() + 1)}-${_p2(n.getDate())}`; };
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
    ta: ($('goTa') || {}).value || '', th: ($('goTh') || {}).value || '', date: ($('goDate') || {}).value || '', venue: _venue,
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
// 통째 붙여넣기를 나눌 때 경기 날짜 · 원정 · 홈 칸도 채운다(2026-10-21). 비었거나 지난번에 자동으로 채운 칸(data-auto)만 — 사용자가 직접 고치면
// 그 칸의 표시를 지워(input 이벤트, 아래 시작 처리) 고친 값이 우선. 구장은 입력칸이 없어 저장할 때 경기 정보(info.venue)로만 넣는다
let _venue = '';
function _autoFill(id, v) {
  const el = $(id), val = String(v || '').trim().slice(0, 20);
  if (!el || !val || (el.value.trim() && el.dataset.auto !== '1')) return false;
  el.value = val; el.dataset.auto = '1';
  return true;
}
function _autoSplit() {
  for (const id of ['goScore', 'goAway', 'goHome', 'goPitch']) {
    const el = $(id), src = el ? el.value : '', sp = src ? _P().splitGameOnePage(src) : null;
    if (!sp) continue;
    if (sp.score) $('goScore').value = sp.score; else if (id === 'goScore') $('goScore').value = '';
    if ($('goPitch') && (sp.pitch || id === 'goPitch')) $('goPitch').value = sp.pitch;
    $('goAway').value = sp.tables[0].text; $('goHome').value = sp.tables[1].text;
    _usedSplit = true;
    // 팀 이름 = 점수표 첫 열(윗줄 원정 · 아랫줄 홈), 점수표가 없으면 타자 표 위 팀 이름 줄 · 날짜 · 구장 = 페이지 위 경기 정보 줄('리그 / 10.07(20:00) / 구장')
    const sb = sp.score ? _P().parseGameOneScoreboard(sp.score) : null;
    const names = sb && sb.teams.length >= 2 ? [sb.teams[0].name, sb.teams[1].name] : [sp.tables[0].name, sp.tables[1].name];
    _autoFill('goTa', names[0]); _autoFill('goTh', names[1]);
    const info = _P().parseGameOneInfo ? _P().parseGameOneInfo(src) : null, ymd = gameOneInfoDate(info);
    const dated = !!ymd && _autoFill('goDate', ymd);
    _venue = info && info.venue ? info.venue.trim().slice(0, 20) : '';
    const nm = (t, d) => (t.name ? `${d}(${t.name})` : d);
    _splitNote = `박스스코어 페이지를 통째로 붙여넣어 ${sp.score ? '이닝별 점수표 · ' : ''}${nm(sp.tables[0], '원정')} · ${nm(sp.tables[1], '홈')} 타자 표${sp.pitch ? ' · 투수 표' : ''}로 나눴습니다`
      + (sp.tables.length > 2 ? ` — 타자 표가 ${sp.tables.length}개라 앞의 2개만 씁니다` : '') + '. 메뉴 · 요약 글자는 쓰지 않습니다'
      + (dated || _venue ? ` · 경기 정보 줄에서 ${[dated ? `날짜 ${+ymd.slice(5, 7)}월 ${+ymd.slice(8)}일` : '', _venue ? `구장 ${_venue}` : ''].filter(Boolean).join(' · ')}을 넣었습니다` : '');
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
    _venue = '';   // 칸을 다 비웠으면 지난 통째 붙여넣기의 구장도 다음 경기에 남기지 않는다
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
  const dup = R.pa ? findSameGames(g, _savedGames()) : [], iss = R.pa ? _issues(R, dup) : [];
  const fillN = _fillPlans(g, dup).reduce((s, f) => s + f.plan.added, 0);
  if (!R.away.players && !R.home.players) {
    h = lsH + (hasBat ? '<div class="go-warn">선수 행을 찾지 못했습니다 — 게임원 박스스코어의 타자 표(선수명(등번호)가 있는 행)를 복사해 주세요.'
      + ' 전체 선택으로 복사했다면 <b>표를 한 번 누른 뒤</b> 다시 전체 선택해 보세요(리그 페이지는 박스스코어가 안쪽 화면에 따로 있습니다)</div>'
      : '<div class="go-empty">타자 표도 붙여넣어야 저장할 수 있습니다</div>');
  } else {
    h = `<div class="go-score">${_esc(g.ta)} <b>${g.as}</b> : <b>${g.hs}</b> ${_esc(g.th)}</div>`
      + iss.map(i => `<div class="go-warn ${i.cls}">${_esc(i.text)}</div>`).join('')
      + (fillN ? `<button type="button" class="btn btn-ghost go-fill" onclick="fillGameOneRbi()">기존 경기에 타점만 채우기 (${fillN}점)</button>` : '') + lsH + h;
    const rbi = R.away.rbi + R.home.rbi, hr = R.away.hrRbi + R.home.hrRbi, hrMin = R.away.hrMin + R.home.hrMin;
    const hrTxt = [hr ? '홈런 [2R 97M] 같은 기록이 있으면 그 타점' : '', hrMin ? '기록 없는 홈런은 최소 1타점(타자 본인 득점)' : ''].filter(Boolean).join(', ');
    const spread = g.abs.reduce((s, a) => s + a.rbi, 0) - hr - hrMin;
    h += `<div class="go-note">타점: 게임원 표에는 선수별 타점 합계만 있어 ${hrTxt ? hrTxt + '을 넣고, ' : ''}나머지는 그 선수의 안타 · 희비 · 땅볼 · 볼넷 타석에 나눠 넣었습니다`
      + '(어느 타석인지는 추정 — 저장한 뒤 기록 수정에서 고칠 수 있습니다)'
      + (rbi ? ` (표의 타점 합계 ${rbi}${hr + hrMin ? ` · 홈런으로 넣은 타점 ${hr + hrMin}` : ''}${spread ? ` · 나눠 넣은 타점 ${spread}` : ''}`
        + `${R.rbiLeft ? ` · 넣을 타석이 없어 빠진 타점 ${R.rbiLeft}` : ''})` : '') + '.'
      + (R.away.low + R.home.low ? ' "대략"은 안타·뜬공·땅볼처럼 떨어진 자리 폭이 넓어 방향 대표값으로 찍은 타구입니다. 저장한 뒤 「타구 위치 확인」에서 실제 자리로 옮길 수 있습니다.' : '') + '</div>';
    if (R.pitch) h += '<div class="go-note">투수: 투수 성적은 이 경기에 함께 저장되어 분석 탭 › 투수의 「게임원 투수 시즌 기록」에 모입니다.'
      + (R.pitch.linked.away || R.pitch.linked.home ? ' 투수 표 순서대로 상대 타석에 투수를 붙여, 기록 탭 타자 상세 「투수별 요약」과 엑셀 투수 칸에도 나옵니다.' : '') + '</div>';
  }
  box.innerHTML = (_splitNote ? `<div class="go-note go-split">${_esc(_splitNote)}</div>` : '') + h;
  btn.disabled = !R.pa;
  btn.textContent = R.pa ? `${iss.length ? '그래도 ' : ''}새 경기로 저장 (${R.pa}타석)` : '새 경기로 저장';
}

function _schedule() { clearTimeout(_timer); _splitNote = ''; _timer = setTimeout(_preview, 150); }

export function openGameOneImport(from) {
  if (!_P()) { if (window.showToast) window.showToast('게임원 파서를 불러오지 못했습니다 — 새로고침 후 다시 시도해 주세요', false); return; }
  if (window.closeOverlay) window.closeOverlay('dataSettingsOverlay');
  const dt = $('goDate');
  if (dt && !dt.value) { dt.value = _today(); dt.dataset.auto = '1'; }   // 기본값(오늘)도 자동 값 — 페이지 경기 정보 줄의 날짜가 덮는다
  _saved.raw = null;   // 저장 경기를 새로 읽는다(목록은 그대로인데 경기 내용만 바뀐 경우)
  _preview();
  const fresh = from === 'link' || from === 'empty';
  const how = fresh && document.querySelector('#goOverlay details.go-how');
  if (how) how.open = true;   // 링크 · 첫 화면으로 온 사람은 처음 쓰는 사람 — 복사 방법을 펼쳐 둔다
  if (window.openOverlay) window.openOverlay('goOverlay');
  _track('gameone_import_open', { from: fresh ? from : 'tile' });
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
  _resetInputs();
  if (window.closeOverlay) window.closeOverlay('goOverlay');
  if (window.openLoad) window.openLoad();
  if (window.openGameOneFix) window.openGameOneFix(g.key);   // 타구 점이 있으면 「타구 위치 확인」을 불러오기 목록 위에 한 번 연다(나중에 할게로 넘길 수 있음)
  const skipped = R.away.skipped.length + R.home.skipped.length, L = R.pitch && R.pitch.linked;
  _track('gameone_import', {
    pa: g.abs.length, paste: _usedSplit ? 'page' : 'tables', scoreboard: R.ls ? 1 : 0,
    pitch: !L ? 'none' : L.away && L.home ? 'linked' : L.away || L.home ? 'partial' : 'saved', skipped, warned: iss.length ? 1 : 0,
  });
  _usedSplit = false;
  _syncStart();
  toast(`게임원 ${g.abs.length}타석 → 새 경기로 저장됨` + (skipped ? ` (모르는 기록 ${skipped}타석 제외)` : ''));
}

function _resetInputs() {
  ['goScore', 'goAway', 'goHome', 'goPitch'].forEach(id => { const t = $(id); if (t) t.value = ''; });
  // 자동으로 채운 팀 이름 · 날짜는 이 경기 것 — 다음 경기 표를 따로 붙여넣을 때 남지 않게 비우고(날짜는 오늘로) 구장도 지운다. 사용자가 고친 값은 그대로
  ['goTa', 'goTh'].forEach(id => { const t = $(id); if (t && t.dataset.auto === '1') { t.value = ''; delete t.dataset.auto; } });
  const dt = $('goDate');
  if (dt && dt.dataset.auto === '1') dt.value = _today();
  _venue = '';
  _preview();
}

// 같은 경기마다 타점 채우기 계획. 지금 열린 경기(_curSaveKey)면 화면의 AS.abs 를 고친다(gameonefix.js 와 같은 방식)
function _curKey() { try { return typeof _curSaveKey !== 'undefined' ? _curSaveKey : null; } catch (e) { return null; } }
function _fillPlans(g, dup) {
  const cur = _curKey(), S = window.AS;
  return dup.map(d => {
    const live = d.key === cur && !!S && Array.isArray(S.abs);
    return Object.assign({ live, plan: planRbiFill(g, live ? { th: d.g.th, abs: S.abs } : d.g) }, d);
  });
}

// 「기존 경기에 타점만 채우기」: 새 경기를 만들지 않고 같은 경기의 타석 타점만 고쳐 저장한다(열린 경기면 _saveEditImmediate, 아니면 localStorage + cloudSave 한 번)
export function fillGameOneRbi() {
  const toast = m => { if (window.showToast) window.showToast(m, false); };
  _autoSplit();
  let out;
  try { out = buildGameOneGame(Object.assign(_inputs(), { now: Date.now() })); } catch (e) { toast('읽지 못했습니다: ' + (e && e.message || e)); return; }
  _saved.raw = null;
  let games = 0, added = 0;
  const skipped = [];
  for (const f of _fillPlans(out.game, findSameGames(out.game, _savedGames()))) {
    skipped.push(...f.plan.skipped);
    if (!f.plan.sets.length) continue;
    const back = f.plan.sets.map(([a]) => [a, a.rbi]);
    f.plan.sets.forEach(([a, v]) => { a.rbi = v; });
    if (f.live) {
      if (typeof _saveEditImmediate === 'function') _saveEditImmediate();
      if (typeof updateAll === 'function') updateAll();
    } else {
      try { localStorage.setItem(f.key, JSON.stringify(f.g)); }
      catch (e) { back.forEach(([a, v]) => { a.rbi = v; }); toast('저장 공간이 부족해 타점을 채우지 못했습니다'); return; }
      if (window.cloudSave) window.cloudSave(f.key, f.g, f.label, f.g.ts);
    }
    games++; added += f.plan.added;
  }
  _saved.raw = null;
  const sk = [...new Set(skipped)];
  _track('gameone_rbi_fill', { games, added, skipped: sk.length });
  if (!games) { toast('채울 타점이 없습니다' + (sk.length ? ` — 기록이 다르거나 타점을 이미 고친 선수: ${sk.join(', ')}` : '')); _preview(); return; }
  _resetInputs();
  if (window.closeOverlay) window.closeOverlay('goOverlay');
  toast(`기존 경기에 타점 ${added}점을 채웠습니다` + (sk.length ? ` (건너뛴 선수: ${sk.join(', ')} — 기록이 다르거나 타점을 이미 고침)` : ''));
}

// 첫 화면 버튼: 저장 경기도 기록 중인 타석도 없을 때만 (샘플 모드면 샘플 경기가 보여서 숨는다)
function _syncStart() {
  const b = $('goStart');
  if (!b) return;
  let n;
  try { const s = JSON.parse(localStorage.getItem('sl_saves') || '[]'); n = Array.isArray(s) ? s.length : 1; } catch (e) { n = 1; }
  const S = window.AS;
  b.hidden = !!(n || (S && S.abs && S.abs.length));
}

// 링크 ?go=1 → 앱을 열고 입력창을 연다
const _LINK_SKIP = ['game', 'gid', 'team', 'import', 'code'];
function _openFromLink() {
  let sp;
  try { sp = new URLSearchParams(location.search); } catch (e) { return false; }
  if (sp.get('go') !== '1') return false;
  sp.delete('go');
  const q = sp.toString();
  try { history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  if (_LINK_SKIP.some(k => sp.has(k)) || /#share=/.test(location.hash)) return false;
  const lp = $('landing-page');
  if (lp && lp.offsetParent !== null && typeof window.showApp === 'function') window.showApp();   // 데스크톱 랜딩이 떠 있으면 (모바일은 core.js 가 이미 건너뜀)
  openGameOneImport('link');
  return true;
}

if (typeof window !== 'undefined') {
  window.SLGameOneImport = { buildGameOneGame, findSameGames, planRbiFill, gameOneInfoDate, _openFromLink, _syncStart };
  // 원정 · 홈 · 날짜 칸을 사용자가 직접 고치면 자동 표시를 지운다 — 다음 통째 붙여넣기가 덮지 않는다(_autoFill). 값을 코드로 넣을 때는 input 이벤트가 없다
  ['goTa', 'goTh', 'goDate'].forEach(id => { const el = $(id); if (el) el.addEventListener('input', () => { delete el.dataset.auto; }); });
  window.openGameOneImport = openGameOneImport;
  window.saveGameOneImport = saveGameOneImport;
  window.fillGameOneRbi = fillGameOneRbi;
  window.gameOnePreview = _schedule;
  const orig = window.updateFieldTapHint;   // core.js(defer)가 먼저 정한다
  if (typeof orig === 'function' && !orig._go) {
    const wrapped = function () { const r = orig.apply(this, arguments); try { _syncStart(); } catch (e) {} return r; };
    wrapped._go = true;
    window.updateFieldTapHint = wrapped;
  }
  _syncStart();
  const run = () => setTimeout(_openFromLink, 0);   // 다른 시작 처리(DOMContentLoaded)가 끝난 뒤
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
}
