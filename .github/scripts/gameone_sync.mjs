// 게임원 팀 기록 매일 받기 — .github/workflows/gameone-sync.yml 이 돌린다. 사용법: node .github/scripts/gameone_sync.mjs <출력 폴더>
//  · gameone_teams.json 의 팀마다: 타자랭킹 · 투수랭킹 · 선수단 + 선수 전원의 통산 페이지 → <팀 번호>.json (gameone_extract.mjs teamData)
//  · 게임원(www.gameone.kr)은 다른 사이트에서 읽기를 허락하지 않아(CORS 없음) 앱이 직접 못 읽고, 서버도 옛 보안 연결(DHE 1024비트)만 받아
//    Supabase 함수(Deno)는 접속을 못 한다. Node 는 이 요청에만 SECLEVEL=0 으로 받는다 — 공개 기록을 읽기만 하고 보내는 것은 없다.
//  · robots.txt(2026-10-29): User-agent * 에 /club/ · /locker/ 는 막혀 있지 않다. 요청 사이에 쉬어 하루 한 번 팀당 (3 + 선수 수)번만 부른다.
//  · 한 팀이 실패하면 그 팀 파일은 그대로 둔다(워크플로가 어제 파일을 먼저 깔아 둔다). 모든 팀이 실패하면 종료 코드 1
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { roster, teamData } from './gameone_extract.mjs';

const require = createRequire(import.meta.url);
const G = require('../../js/gameone.js');
const OUT = process.argv[2] || 'out';
const TEAMS = JSON.parse(fs.readFileSync(new URL('./gameone_teams.json', import.meta.url), 'utf8')).filter(c => /^\d{1,7}$/.test(String(c)));
const UA = 'SprayLab/1.0 (+https://kimjeongcheol13.github.io/baseball-spray-chart/)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(p) {
  return new Promise((ok, no) => {
    const req = https.get('https://www.gameone.kr' + p, { ciphers: 'DEFAULT@SECLEVEL=0', headers: { 'User-Agent': UA }, timeout: 20000 }, r => {
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

fs.mkdirSync(OUT, { recursive: true });
let done = 0;
for (const club of TEAMS) {
  try {
    const hit = await get(`/club/info/ranking/hitter?club_idx=${club}`);
    const pit = await get(`/club/info/ranking/pitcher?club_idx=${club}`);
    const list = await get(`/club/info/player?club_idx=${club}`);
    const careers = {};
    for (const p of roster(list)) {
      await sleep(400);
      try { careers[p.code] = await get(`/locker/record/sum?group_code=${p.code}`); } catch (e) { console.log(`  ${p.name} 통산 실패: ${e.message}`); }
    }
    const d = teamData(G, { hit, pit, list, careers }, Date.now());
    fs.writeFileSync(path.join(OUT, `${club}.json`), JSON.stringify(d));
    console.log(`${club} ${d.team} ${d.season}시즌 — 시즌 타자 ${d.bat.length} · 투수 ${d.pit.length} · 통산 ${Object.keys(d.players).length}명`);
    done++;
  } catch (e) {
    console.log(`${club} 실패: ${e.message}`);
  }
}
process.exit(done || !TEAMS.length ? 0 : 1);
