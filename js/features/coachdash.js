// 코치용 팀 대시보드 — "팀 경기"(teamgames.js)가 가진 행(서버 user_games 최근 50경기: 팀원 + 팀장 본인의 팀 경기)을 선수별 · 기록자별로 모아 그린다.
// 읽기 전용: 메모리에서 계산해 문자열로 돌려줄 뿐 localStorage · 서버 · 앱의 현재 경기(AS)에 아무것도 쓰지 않는다. 화면에 들어가는 값은 전부 t() 를 거친다.
//
// 선수 = 경기 라인업의 타자(우리 팀 = home). 경기를 올린 팀원(기록자)과 다르다.
// 선수 묶기(B): bid 는 라인업을 만들 때마다 새로 발급돼 경기 간에 쓸 수 없고, bnum 은 비우면 "추가한 순서"로 자동 부여돼 실제 등번호가 아닌 경우가 많다.
//   → 이름 기준으로 묶되(앱의 다른 화면 batdata.js buildData 와 같다), 한 경기 안에 같은 이름의 서로 다른 타자(bid 가 다름)가 있으면 그 이름만 번호로 나눈다.
//   한계: 다른 경기에 걸친 동명이인 · 개명 · 표기 차이(공백 · 오타)는 못 잡는다. 화면에 "이름이 같으면 한 선수로 봅니다"를 적는다.
// 같은 경기가 자동저장본(sl_auto_) · 저장본(sl_)으로 여러 행에 올라와 있으면 한 경기로 센다: 같은 기록자의 행끼리 타석 id 를 하나라도 공유하면 같은 경기다
//   (타석 id 는 기록 시각이라 복사본은 같다. 작은 정수 id 는 공유 경기 복원이 붙인 순번이라 연결에 쓰지 않는다).
import { MAX_HITS, esc } from '../constants.js';
import { calcStats, f3, pct } from './batdata.js?v=5';

const LOW_PA = 10, RECENT_G = 3, STALE_DAYS = 7, TREND_STEP = 0.05, K_GAP = 0.15, K_MIN_PA = 6, MAX_NOTES = 3, DAY = 86400000;
const t = v => esc(v == null ? '' : v);
// 앱이 자동으로 채우는 임시 이름(core.js 새 타자 "타자 1" · 공유 경기 복원 "공유" · "선수") + 안내 문구 "이름" · 빈 이름
const TEMP_NAME = /^(타자\s*\d*|이름|선수|공유)$/;
const clean = v => String(v == null ? '' : v).trim();
const isTemp = n => !n || TEMP_NAME.test(n);
const numOf = v => (v == null || v === '' || v === 0 || v === '0' ? '' : clean(v));
const bidOf = v => (v == null || v === '' || v === -1 || v === '-1' ? null : String(v));
const ms = v => Date.parse(v) || 0;
const absOf = d => (Array.isArray(d && d.abs) ? d.abs : []).filter(a => a && typeof a === 'object');
const isHome = a => (a.team || 'home') === 'home';       // 팀 구분이 없는 옛 타석은 home
const linkable = id => id != null && id !== '' && (typeof id === 'string' || Number(id) >= 1e9);
const keyOf = (split, name, num) => (split.has(name) ? name + '#' + num : name);

function gameTime(r) {           // 경기 날짜(ko-KR "2026. 10. 3.") → 없으면 수정 시각. 같은 날 순서는 lastAt 이 가른다
  const m = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/.exec(String(r.date || (r.data && r.data.d) || ''));
  return m ? new Date(+m[1], m[2] - 1, +m[3]).getTime() : ms(r.updated_at);
}
const byTime = (a, b) => a.time - b.time || a.lastAt - b.lastAt;

function recorderName(r) { return r.mine ? '나(팀장)' : (r.display_name ? String(r.display_name) : '팀원 ' + String(r.user_id).slice(-4)); }

// 행 → 경기(중복 제거). 타석이 하나도 없는 행은 경기로 세지 않는다
function toGames(rows) {
  const out = [], byUser = {};
  rows.forEach(r => { if (r && r.data) (byUser[r.user_id] = byUser[r.user_id] || []).push(r); });
  Object.keys(byUser).forEach(u => {
    const rs = byUser[u], par = rs.map((_, i) => i), first = new Map();
    const find = i => (par[i] === i ? i : (par[i] = find(par[i])));
    rs.forEach((r, i) => absOf(r.data).forEach(a => {
      if (!linkable(a.id)) return;
      const k = String(a.id);
      if (first.has(k)) par[find(i)] = find(first.get(k)); else first.set(k, i);
    }));
    const groups = {};
    rs.forEach((r, i) => { if (absOf(r.data).length) (groups[find(i)] = groups[find(i)] || []).push(r); });
    Object.keys(groups).forEach(k => {
      const g = groups[k];
      const rep = g.slice().sort((x, y) => absOf(y.data).length - absOf(x.data).length || ms(y.updated_at) - ms(x.updated_at))[0];
      out.push({
        user: u, mine: !!rep.mine, who: recorderName(rep), lastAt: Math.max.apply(null, g.map(r => ms(r.updated_at))), time: gameTime(rep),
        home: absOf(rep.data).filter(isHome).slice(0, MAX_HITS),
        lineup: Array.isArray(rep.data.home_lineup) ? rep.data.home_lineup.filter(p => p && typeof p === 'object') : [],
      });
    });
  });
  return out.sort(byTime);
}

// 같은 경기 안에 같은 이름의 서로 다른 타자(bid · 라인업 id 가 다름)가 있는 이름 → 그 이름만 번호로 나눈다
function namesakes(games) {
  const split = new Set();
  games.forEach(g => {
    const by = {};
    const add = (n, id) => { if (isTemp(n) || id == null) return; (by[n] = by[n] || new Set()).add(id); };
    g.lineup.forEach(p => add(clean(p.name), bidOf(p.id)));
    g.home.forEach(a => add(clean(a.bname), bidOf(a.bid)));
    Object.keys(by).forEach(n => { if (by[n].size > 1) split.add(n); });
  });
  return split;
}

function collectPlayers(games, split) {
  const map = new Map(); let unnamed = 0;
  const get = (name, num) => {
    const k = keyOf(split, name, num);
    if (!map.has(k)) map.set(k, { key: k, name, num: '', taps: [], games: [], bh: new Set() });
    const p = map.get(k); if (num) p.num = num;     // 경기를 시간순으로 훑으니 마지막(최근) 번호가 남는다
    return p;
  };
  games.forEach(g => {                                // games 는 시간 오름차순
    g.lineup.forEach(p => {
      const n = clean(p.name); if (isTemp(n)) return;
      const bh = clean(p.bh); if (bh) get(n, numOf(p.num)).bh.add(bh);
    });
    const per = new Map();
    g.home.forEach(a => {
      const n = clean(a.bname);
      if (isTemp(n)) { unnamed++; return; }
      const p = get(n, numOf(a.bnum));
      p.taps.push(a);
      if (a.bats === 'L' || a.bats === 'S') p.bh.add(a.bats);   // 타석의 bats 는 기본 'R' 이라 L · S 만 믿는다
      if (!per.has(p)) per.set(p, []);
      per.get(p).push(a);
    });
    per.forEach((taps, p) => p.games.push({ taps }));
  });
  return { list: Array.from(map.values()).filter(p => p.taps.length), unnamed };
}

function playerRow(p) {
  const st = calcStats(p.taps), n = p.games.length;
  const recent = [].concat.apply([], p.games.slice(-RECENT_G).map(g => g.taps)), before = [].concat.apply([], p.games.slice(0, -RECENT_G).map(g => g.taps));
  const rc = calcStats(recent), bf = calcStats(before);
  let sym = '–', why = '최근 3경기와 비교할 이전 경기가 부족해요';
  if (n > RECENT_G && rc.ab && bf.ab) {
    const d = rc.avg - bf.avg;
    sym = d >= TREND_STEP ? '▲' : d <= -TREND_STEP ? '▼' : '–';
    why = '최근 3경기 타율 ' + f3(rc.avg) + ' · 이전 ' + f3(bf.avg) + ' (차이가 ±' + f3(TREND_STEP) + ' 이상이면 ▲▼)';
  }
  const bats = p.bh.size === 1 && (p.bh.has('R') || p.bh.has('L')) ? Array.from(p.bh)[0] : null;   // 좌우가 입력됐고 하나로 일치(스위치 · 상충은 모름)
  return { key: p.key, name: p.name, num: p.num, g: n, pa: st.pa, st, rc, bf, sym, why, bats, taps: p.taps };
}

function dirStats(items) {         // items = [{ a, bats }] — deg < 72 좌 · > 108 우 · 그 사이 중(core.js _isPull · _isOppo 와 같은 경계)
  const d = { n: 0, left: 0, center: 0, right: 0, pn: 0, pull: 0, pc: 0, oppo: 0 };
  items.forEach(({ a, bats }) => {
    if (a.deg == null || isNaN(+a.deg)) return;
    const side = +a.deg < 72 ? 'left' : +a.deg > 108 ? 'right' : 'center';
    d.n++; d[side]++;
    if (bats === 'R' || bats === 'L') {
      d.pn++;
      const pull = bats === 'R' ? 'left' : 'right', oppo = bats === 'R' ? 'right' : 'left';   // 우타는 좌측이 당겨치기, 좌타는 우측
      if (side === pull) d.pull++; else if (side === oppo) d.oppo++; else d.pc++;
    }
  });
  return d;
}

function agoText(at, now) {
  const m = Math.max(0, Math.floor((now - at) / 60000));
  if (m < 1) return '방금';
  if (m < 60) return m + '분 전';
  if (m < 1440) return Math.floor(m / 60) + '시간 전';
  return Math.floor(m / 1440) + '일 전';
}

// 사실만 쓰는 규칙 기반 문장(추측 금지, 최대 3줄). 선수는 PA 10 미만이면 제외.
//   삼진률: 최근 3경기 삼진률이 팀보다 15%p 이상 높고(최근 6타석 이상) · 타율: 최근 3경기가 이전보다 .050 이상 오르내림 · 기록자: 마지막 기록이 7일 이상 전
function buildNotes(players, team, recorders, now) {
  const rows = players.filter(p => p.pa >= LOW_PA && p.g >= RECENT_G);
  const k = rows.filter(p => p.rc.pa >= K_MIN_PA && p.rc.kRate - team.kRate >= K_GAP).sort((a, b) => (b.rc.kRate - team.kRate) - (a.rc.kRate - team.kRate))
    .map(p => p.name + ' 최근 3경기 삼진률 ' + pct(p.rc.kRate) + ' (팀 ' + pct(team.kRate) + ')');
  const a = players.filter(p => p.pa >= LOW_PA && p.sym !== '–').sort((x, y) => Math.abs(y.rc.avg - y.bf.avg) - Math.abs(x.rc.avg - x.bf.avg))
    .map(p => p.name + ' 최근 3경기 타율 ' + f3(p.rc.avg) + ' (이전 ' + f3(p.bf.avg) + ')');
  const r = recorders.filter(x => !x.mine && now - x.lastAt >= STALE_DAYS * DAY).sort((x, y) => x.lastAt - y.lastAt)
    .map(x => '기록자 ' + x.name + ' · 마지막 기록 ' + agoText(x.lastAt, now));
  const cats = [k, r, a], out = [];
  for (let i = 0; out.length < MAX_NOTES; i++) {   // 종류별로 하나씩 먼저, 남으면 다시 돌며 채운다
    let any = false;
    cats.forEach(c => { if (c[i] != null && out.length < MAX_NOTES) { out.push(c[i]); any = true; } });
    if (!any) break;
  }
  return out;
}

export function buildBoard(rows, now) {
  now = now || Date.now();
  const games = toGames(rows), split = namesakes(games), col = collectPlayers(games, split);
  const players = col.list.map(playerRow).sort((a, b) => b.pa - a.pa || a.name.localeCompare(b.name, 'ko'));
  const allHome = [].concat.apply([], games.map(g => g.home));
  const team = calcStats(allHome);
  const byUser = {};
  games.forEach(g => {
    const x = byUser[g.user] || (byUser[g.user] = { user: g.user, name: g.who, mine: g.mine, games: 0, lastAt: 0 });
    x.games++; x.lastAt = Math.max(x.lastAt, g.lastAt);
  });
  const recorders = Object.keys(byUser).map(u => byUser[u]).sort((a, b) => b.lastAt - a.lastAt);
  const d = new Date(now), weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7).getTime();   // 이번 주 = 월요일 0시부터
  const items = who => {
    if (who) { const p = players.find(x => x.key === who); return p ? p.taps.map(a => ({ a, bats: p.bats })) : []; }
    const out = []; const named = new Set();
    players.forEach(p => p.taps.forEach(a => { named.add(a); out.push({ a, bats: p.bats }); }));
    allHome.forEach(a => { if (!named.has(a)) out.push({ a, bats: null }); });   // 이름 미입력 타석은 팀 전체에만, 좌우는 모름
    return out;
  };
  return {
    games: games.length, weekGames: games.filter(g => g.lastAt >= weekStart).length, recorders, players, unnamed: col.unnamed, team, now,
    notes: buildNotes(players, team, recorders, now),
    tapsFor: who => items(who).map(x => x.a),
    dirFor: who => dirStats(items(who)),
  };
}

function dirHtml(d) {
  if (!d.n) return '<p class="cd-none">방향이 기록된 타구가 없어요</p>';
  const r = (n, tot) => Math.round(n / tot * 100) + '%';
  let h = '<div class="cd-dir" role="group" aria-label="타구 방향">' +
    [['좌', d.left], ['중', d.center], ['우', d.right]].map(x => '<span>' + x[0] + ' <b>' + r(x[1], d.n) + '</b> <small>' + x[1] + '개</small></span>').join('') + '</div>';
  if (d.pn) {
    h += '<div class="cd-dir cd-dir2" role="group" aria-label="당겨치기 · 밀어치기">' +
      [['당겨치기', d.pull], ['가운데', d.pc], ['밀어치기', d.oppo]].map(x => '<span>' + x[0] + ' <b>' + r(x[1], d.pn) + '</b></span>').join('') + '</div>' +
      '<p class="cd-foot">당겨치기 · 밀어치기는 좌우 타석이 입력된 타자의 타구 ' + d.pn + '개 기준이에요</p>';
  } else h += '<p class="cd-foot">좌우 타석이 입력된 타자가 없어 좌 · 중 · 우로만 보여요</p>';
  return h;
}

// board = buildBoard() 결과, who = 스프레이로 볼 선수 key('' = 팀 전체), note = 위에 붙일 안내(예: 팀장 기록을 못 불러옴)
export function boardHtml(board, who, note) {
  const sel = board.players.some(p => p.key === who) ? who : '';
  const avg = board.team.ab ? f3(board.team.avg) : '-';
  const head = '<p class="cd-meta">이름이 같으면 한 선수로 봅니다 · 최근 50경기 기준</p>' + (note ? '<p class="cd-warn">' + t(note) + '</p>' : '');
  if (!board.games) return head + '<p class="tg-msg">대시보드에 쓸 경기가 없어요 (타석이 있는 경기만 모아요)</p>';
  const sum = [['기록자', board.recorders.length + '명'], ['모인 경기', String(board.games)], ['이번 주 기록된 경기', String(board.weekGames)], ['팀 AVG', avg + '<small>타석 ' + board.team.pa + '</small>']]
    .map(x => '<div class="cd-cell"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('');
  const prow = board.players.map(p => {
    const den = p.st.ab + p.st.bb + p.st.hbp + p.st.sf;
    return '<tr><th scope="row"><b>' + t(p.name) + '</b>' + (p.num ? ' <small>#' + t(p.num) + '</small>' : '') + '</th><td>' + p.g + '</td><td>' + p.pa + '</td>' +
      '<td>' + (p.st.ab ? f3(p.st.avg) : '-') + (p.pa < LOW_PA ? ' <small class="cd-low">표본 적음</small>' : '') + '</td><td>' + (den ? f3(p.st.obp) : '-') + '</td><td>' + pct(p.st.kRate) + '</td>' +
      '<td class="cd-tr' + (p.sym === '▲' ? ' cd-up' : p.sym === '▼' ? ' cd-down' : '') + '" title="' + t(p.why) + '">' + p.sym + '</td></tr>';
  }).join('');
  const players = '<section class="cd-card"><h3>선수별</h3>' + (prow
    ? '<div class="cd-scroll"><table class="cd-tbl"><caption class="sb-sr">선수별 기록</caption><thead><tr><th scope="col">선수</th><th scope="col">G</th><th scope="col">PA</th><th scope="col">AVG</th><th scope="col">OBP</th><th scope="col">K%</th><th scope="col">최근 3경기</th></tr></thead><tbody>' + prow + '</tbody></table></div>'
    : '<p class="cd-none">이름이 입력된 타자의 기록이 없어요</p>') +
    (board.unnamed ? '<p class="cd-foot">이름 미입력 ' + board.unnamed + '타석 (선수별 집계에서 제외, 팀 합계에는 포함)</p>' : '') + '</section>';
  const rec = '<section class="cd-card cd-small"><h3>기록자</h3><table class="cd-tbl"><caption class="sb-sr">기록자</caption><thead><tr><th scope="col">이름</th><th scope="col">올린 경기</th><th scope="col">마지막 기록</th></tr></thead><tbody>' +
    board.recorders.map(r => '<tr><th scope="row">' + t(r.name) + '</th><td>' + r.games + '</td><td' + (board.now - r.lastAt >= STALE_DAYS * DAY ? ' class="cd-stale"' : '') + '>' + t(agoText(r.lastAt, board.now)) + '</td></tr>').join('') +
    '</tbody></table></section>';
  const spray = '<section class="cd-card"><h3>팀 타구 분포</h3><label class="cd-who">보기 <select data-act="who" aria-label="스프레이로 볼 선수">' +
    '<option value=""' + (sel ? '' : ' selected') + '>팀 전체</option>' + board.players.map(p => '<option value="' + t(p.key) + '"' + (p.key === sel ? ' selected' : '') + '>' + t(p.name) + (p.num ? ' #' + t(p.num) : '') + ' · ' + p.pa + '타석</option>').join('') +
    '</select></label><canvas class="cd-spray" role="img" aria-label="타구 스프레이 차트"></canvas>' + dirHtml(board.dirFor(sel)) + '</section>';
  const notes = '<section class="cd-card"><h3>코치 노트</h3>' + (board.notes.length
    ? '<ul class="cd-notes">' + board.notes.map(n => '<li>' + t(n) + '</li>').join('') + '</ul>'
    : '<p class="cd-none">눈에 띄는 변화가 없어요 (타석 10 미만 선수는 제외)</p>') + '</section>';
  return head + '<div class="cd-sum">' + sum + '</div><div class="cd-grid"><div class="cd-main">' + players + '</div><div class="cd-side">' + spray + notes + rec + '</div></div>';
}
