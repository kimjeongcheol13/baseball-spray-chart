// 게임원 HTML → 붙여넣기와 같은 평문 · 앱이 저장하는 JSON — js/gameone.js 의 parseGameOneTeam · parseGameOneCareer 가 그대로 읽는다.
// 게임원 중계 함수(netlify/functions/gameone.mjs)와 브라우저 테스트(tests/gameone-team.test.js)가 같이 쓴다. 실제 페이지 모양은 2026-10-29 에 확인했다.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
const txt = s => s.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, k) => ENT[k]).replace(/\s+/g, ' ').trim();
const noComments = html => html.replace(/<!--[\s\S]*?-->/g, '');

// 팀 기록통계 › 타자랭킹 · 투수랭킹: <tbody> 의 줄마다 칸 글자를 탭으로 → '순위\t이름(번호)\t숫자…'
// 주석 처리된 칸(<!--<td>1.000</td>--> 대타 타율 등)이 있어 주석부터 지운다 — 화면 복사 글과 칸 수가 같아진다(타자 30 · 투수 28)
export function rankRows(html) {
  const out = [];
  for (const body of noComments(html).match(/<tbody[\s\S]*?<\/tbody>/g) || []) {
    for (const tr of body.match(/<tr[\s\S]*?<\/tr>/g) || []) out.push((tr.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/g) || []).map(txt).join('\t'));
  }
  return out.join('\n');
}

// 고른 시즌(<option value="2026" selected>) · 팀 이름(<title>)
export const season = html => +((/<option value="(\d{4})"\s*selected/.exec(html) || [])[1]) || null;
export const title = html => txt((/<title>([\s\S]*?)<\/title>/.exec(html) || ['', ''])[1]);

// 선수단: <img … group_code="코드"> 뒤의 <span class="rank">…</span> 이름(번호). 다음 선수 코드를 넘어가지 않는다
export function roster(html) {
  const out = [], re = /group_code="([0-9A-Z]{10,40})"(?:(?!group_code=)[\s\S])*?<span class="rank">[\s\S]*?<\/span>([^<]*)/g;
  for (const m of noComments(html).matchAll(re)) {
    const n = /^(.*\S)\s*\((\d*)\)$/.exec(txt(m[2]));
    if (n) out.push({ name: n[1].slice(0, 20), number: n[2], code: m[1] });
  }
  return out;
}

// 선수 통산(locker/record/sum): 머리(이름 · 투타 · 출신 · 학교) + 타자기록 · 투수기록의 <span class="title">이름</span><span class="score">값</span>.
// 투수 칸은 화면에서 숨겨져 있어 복사엔 빠지지만 HTML 에는 있다
export function career(html) {
  html = noComments(html);
  const head = /font-size:18px[^>]*>([\s\S]*?)<div class="player_info_detail"/.exec(html);
  const lines = head ? head[1].split(/<[^>]*>/).map(txt).filter(Boolean) : [];
  const pairs = s => [...s.matchAll(/<span class="title">([^<]*)<\/span>\s*<span class="score">([^<]*)<\/span>/g)].map(m => txt(m[1]) + ' ' + txt(m[2]));
  const b = html.indexOf('hitter_section'), p = html.indexOf('pitcher_section');
  if (b >= 0) lines.push('타자기록', ...pairs(html.slice(b, p > b ? p : undefined)));
  if (p >= 0) lines.push('투수기록', ...pairs(html.slice(p)));
  return lines.join('\n');
}

// 선수 통산 페이지 하나 → { name, hand, bg, school, bat, pit } · 기록이 없으면 null
//   0경기 쪽은 뺀다 — 투수를 안 하는 선수도 HTML 에 0 으로 찬 투수 칸이 있어 카드에 투수 0 이 뜬다(게임원 화면은 숨김)
export function careerRec(G, html) {
  const c = G.parseGameOneCareer(career(html));
  const bat = c.bat && c.bat.g ? c.bat : null, pit = c.pit && c.pit.g ? c.pit : null;
  return bat || pit ? { name: c.name || '', hand: c.hand, bg: c.bg, school: c.school, bat, pit } : null;
}

// 경기 박스스코어(팀 club/info/schedule/boxscore · 리그 league/schedule/content/boxscore, 2026-10-30 확인 — 두 페이지 모양이 같다)
//   → 페이지를 통째 복사한 것과 같은 평문. 앱 가져오기 칸에 그대로 넣으면 splitGameOnePage 가 점수표 · 원정 · 홈 · 투수 표로 나눈다.
//   경기 정보 줄(<caption> '리그 / 10.25(11:00) / 구장') · 팀 이름(<h3>) · 표 줄마다 칸 글자를 탭으로.
//   첫 칸의 span(타순 · 위치 · 이름)은 붙인다 — 화면 복사와 같은 '1二홍길동(51)'.
//   숨긴 10~12회 칸도 넣는다(화면 복사엔 빠진다) — 연장 이닝 기록까지 들어간다
export function boxText(html) {
  const s = noComments(html).replace(/<script[\s\S]*?<\/script>/g, ''), i = s.indexOf('scon_boxscore');
  if (i < 0) return '';
  const cell = c => txt(c.replace(/>\s+</g, '><'));
  return [...s.slice(i).matchAll(/<caption[^>]*>([\s\S]*?)<\/caption>|<h3[^>]*>([\s\S]*?)<\/h3>|<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map(m => (m[3] != null ? (m[3].match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/g) || []).map(cell).join('\t') : txt(m[1] != null ? m[1] : m[2])))
    .join('\n');
}

// 팀 일정 › 경기결과(club/info/schedule/result, 2026-10-30 확인) 한 쪽(15경기) → { season, pages, games }
//   줄마다 '10월25일(일) 13:30' · 분류(리그 · 대회) · 구장 · team1 = 원정(박스스코어 점수표 윗줄) · team2 = 홈 의 이름 · 점수 · 콜드승 · 몰수승 · BOX SCORE 링크(game_idx)
//   pages = 아래 쪽 번호(page=N) 중 가장 큰 것. 날짜에 연도가 없어 앱이 season 을 붙인다
export function schedule(html) {
  const s = noComments(html), games = [];
  for (const tr of s.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const d = /<td><strong>(\d{1,2})월\s*(\d{1,2})일<\/strong>([^<]*)<\/td>/.exec(tr);
    if (!d) continue;
    const td = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(txt);
    const side = [...tr.matchAll(/<div class="team[12][^"]*">([\s\S]*?)<span class="score">([^<]*)<\/span>/g)].map(m => ({
      name: txt((/<span class="team_name">([\s\S]*?)<\/span>/.exec(m[1]) || ['', ''])[1]),
      r: /^\d+$/.test(m[2].trim()) ? +m[2].trim() : null,
      note: txt((/<span class="exp_win">([\s\S]*?)<\/span>/.exec(m[1]) || ['', ''])[1]),
    }));
    if (side.length !== 2) continue;
    const g = /schedule\/boxscore\?club_idx=\d+&(?:amp;)?game_idx=(\d{1,9})/.exec(tr), t = /(\d{1,2}:\d{2})/.exec(d[3]);
    games.push({
      game: g ? +g[1] : null, md: `${d[1].padStart(2, '0')}-${d[2].padStart(2, '0')}`, time: t ? t[1] : '', lig: td[1] || '', venue: td[2] || '',
      away: side[0].name, as: side[0].r, home: side[1].name, hs: side[1].r, note: side[0].note || side[1].note,
    });
  }
  const pages = Math.max(1, ...[...s.matchAll(/[?&]page=(\d{1,3})(?!\d)/g)].map(m => +m[1]));
  return { season: season(html), pages, games };
}

// 선수단 → 저장 이름(key). 같은 이름이 둘이면 「이름 #번호」로 나눈다(저장이 이름 기준이라 · parseGameOneTeam 과 같은 규칙). 번호가 없으면 통산을 받지 않는다
export const rosterKeys = ro => ro.flatMap(p => ro.filter(q => q.name === p.name).length < 2 ? [{ ...p, key: p.name }] : p.number ? [{ ...p, key: `${p.name} #${p.number}` }] : []);

// 받은 페이지들 → 앱(js/features/gocareer.js)이 그대로 넣는 JSON. G = js/gameone.js
//   pages = { hit, pit, list, careers: { [선수 코드]: 통산 HTML } }
//   → { v, at, team, season, bat: [팀 시즌 타자 줄], pit: [팀 시즌 투수 줄], players: { [이름 · 동명이인은 이름 #번호]: { hand, bg, school, bat, pit } } }
export function teamData(G, { hit, pit, list, careers }, at) {
  const t = G.parseGameOneTeam(rankRows(hit) + '\n' + rankRows(pit)), players = {}, ro = roster(list);
  for (const p of rosterKeys(ro)) {
    const c = careers[p.code] && careerRec(G, careers[p.code]);
    if (c) players[p.key] = { hand: c.hand, bg: c.bg, school: c.school, bat: c.bat, pit: c.pit };
  }
  // 시즌 표에 한 명만 나와도 선수단에 같은 이름이 둘이면 「이름 #번호」로 — 그 선수의 통산과 시즌이 한 칩에 모이게
  const dup = new Set(ro.filter(p => ro.filter(q => q.name === p.name).length > 1).map(p => p.name));
  const fix = r => (dup.has(r.name) && r.number ? { ...r, name: `${r.name} #${r.number}` } : r);
  return { v: 1, at, team: title(hit), season: season(hit), bat: t.bat.map(fix), pit: t.pit.map(fix), players };
}
