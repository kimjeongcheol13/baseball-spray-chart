// 게임원 중계 — 앱(GitHub Pages)이 게임원 주소를 넣으면 그때 이 함수가 게임원을 대신 읽어 JSON 으로 돌려준다(Netlify Functions)
//   GET /api/gameone?club=팀번호[&season=2026] → 팀 시즌 타자 · 투수 + 선수단 전원 통산 (gameone_extract.mjs teamData 와 같은 모양)
//   GET /api/gameone?player=선수코드          → 그 선수 통산 { v, at, name, hand, bg, school, bat, pit }
//  · 앱이 직접 못 읽는 이유: 게임원은 CORS 헤더가 없고, 옛 보안 연결(DHE · 작은 키)만 받아 Supabase(Deno)도 못 붙는다.
//    Node 는 이 연결에만 SECLEVEL=0 으로 받는다. 공개 기록 페이지를 읽기만 하고 보내는 것은 없다.
//  · 정해 둔 게임원 페이지 4개만 · 숫자 · 코드 모양을 확인한 값만 부른다(아무 주소나 대신 여는 중계가 되지 않게)
//  · 배포는 netlify.toml 주석 참고(CLI 로만)
import https from 'node:https';
import G from '../../js/gameone.js';
import { rankRows, roster, uniqueRoster, careerRec, teamData } from '../gameone_extract.mjs';

const APP = 'https://kimjeongcheol13.github.io';
const UA = 'SprayLab/1.0 (+https://kimjeongcheol13.github.io/baseball-spray-chart/)';
// 한 번에 게임원 연결 4개까지(선수 통산을 4개씩) — 연결은 다시 쓴다
const agent = new https.Agent({ keepAlive: true, maxSockets: 4, ciphers: 'DEFAULT@SECLEVEL=0' });

function get(p) {
  return new Promise((ok, no) => {
    const req = https.get('https://www.gameone.kr' + p, { agent, headers: { 'User-Agent': UA }, timeout: 15000 }, r => {
      if (r.statusCode !== 200) { r.resume(); return no(new Error(p + ' → ' + r.statusCode)); }
      let b = '';
      r.setEncoding('utf8');
      r.on('data', d => { b += d; });
      r.on('end', () => ok(b));
    });
    req.on('timeout', () => req.destroy(new Error(p + ' → timeout')));
    req.on('error', no);
  });
}

async function team(club, season) {
  const q = `club_idx=${club}${season ? `&season=${season}` : ''}`;
  const [hit, pit, list] = await Promise.all([get(`/club/info/ranking/hitter?${q}`), get(`/club/info/ranking/pitcher?${q}`), get(`/club/info/player?club_idx=${club}`)]);
  const careers = {};
  await Promise.all(uniqueRoster(roster(list)).map(p => get(`/locker/record/sum?group_code=${p.code}`).then(h => { careers[p.code] = h; }, () => {})));
  return teamData(G, { hit, pit, list, careers }, Date.now());
}

export default async req => {
  const u = new URL(req.url), club = u.searchParams.get('club') || '', player = u.searchParams.get('player') || '', season = u.searchParams.get('season') || '';
  const out = (o, status = 200) => new Response(JSON.stringify(o), {
    status,
    headers: { 'Access-Control-Allow-Origin': APP, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store' }
  });
  try {
    if (/^\d{1,7}$/.test(club) && /^(\d{4})?$/.test(season)) {
      const d = await team(club, season);
      return d.bat.length + d.pit.length + Object.keys(d.players).length ? out(d) : out({ error: 'empty' }, 404);
    }
    if (/^[0-9A-Z]{10,40}$/.test(player)) {
      const c = careerRec(G, await get(`/locker/record/sum?group_code=${player}`));
      return c ? out(Object.assign({ v: 1, at: Date.now() }, c)) : out({ error: 'empty' }, 404);
    }
    return out({ error: 'bad request' }, 400);
  } catch (e) {
    console.log(String(e && e.message || e));
    return out({ error: 'gameone' }, 502);
  }
};

export const config = { path: '/api/gameone' };
