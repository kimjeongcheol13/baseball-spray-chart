// 스카우팅 칼럼 — 기록된 숫자만으로 문단이 이어지는 상대 타자 칼럼을 자동 작성 (AI·서버 없음)
// 구조: 제목·부제 → 도입 → 강점 → 약점 → 카운트 운영 → 전망 → 한계 밝히기
// 규칙: 표본 기준(MIN_ZONE_AB · MIN_SPLIT)에 못 미치는 코스·구종·카운트는 문장에 넣지 않는다.
//       기록으로 확인되지 않는 해석은 쓰지 않고, 추정은 마지막 주석에 추정이라고 밝힌다.
import { HITS, NOAB, ZONES_9 } from '../constants.js';
import { calcStats, f3, pct, josa as _josaPick, sprayFigure } from './batdata.js?v=5';

const MIN_ZONE_AB = 3;   // 코스·구종 판단 최소 타수 (scouting.js 와 동일)
const MIN_SPLIT = 5;     // 카운트 판단 최소 타석 (scouting.js 와 동일)
const RECENT_GAMES = 5;  // 최근 흐름 = 마지막 N경기
const XBH = ['2루타', '3루타', '홈런'];

// 코스 이름 → 문장 속 수식어 (ZONES_9 순서: 행 높음/중간/낮음 · 열 내각/중앙/외각)
const ZONE_ADJ = ['몸쪽 높은', '가운데 높은', '바깥쪽 높은', '몸쪽 중간 높이', '한가운데', '바깥쪽 중간 높이', '몸쪽 낮은', '가운데 낮은', '바깥쪽 낮은'];

// 받침에 따라 조사 붙이기: J('슬라이더','을') → 슬라이더를, J('체인지업','을') → 체인지업을
function J(w, t) {
  w = String(w);
  if (t === '로') {
    const c = w.trim().slice(-1).charCodeAt(0);
    const jong = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : 0;
    return w + (jong && jong !== 8 ? '으로' : '로');
  }
  const pair = { '은': ['은', '는'], '을': ['을', '를'], '이': ['이', '가'], '과': ['과', '와'] }[t];
  return w + _josaPick(w, pair[0], pair[1]);
}

// 같은 뜻의 문장 여러 개 중 하나를 선수 이름으로 고른다 (선수마다 말투가 조금씩 달라지도록, 같은 선수는 항상 같은 문장)
function picker(name) {
  let h = 7;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list => list[(h = (h * 1103515245 + 12345) >>> 0) % list.length];
}

const isPull = a => !!(window._isPull && window._isPull(a));

// 이름 나열: ['커브'] → 커브 · ['커브','체인지업'] → 커브와 체인지업 · 셋 이상 → 커브, 체인지업과 포크볼
const _listKo = names => (names.length === 1 ? names[0] : [...names.slice(0, -2), J(names[names.length - 2], '과')].join(', ') + ' ' + names[names.length - 1]);

// ── 사실 모으기 ───────────────────────────────────────────────
function _facts(P, data) {
  const abs = P.abs;
  const st = P.st;
  const pool = data.pool;
  const zones = ZONES_9.map((z, i) => {
    const za = abs.filter(a => a.zone === z);
    return { z, adj: ZONE_ADJ[i], label: `${ZONE_ADJ[i]} 코스`, abs: za, ...calcStats(za) };
  });
  const pts = [...new Set(abs.map(a => a.pt).filter(Boolean))].map(pt => ({ pt, ...calcStats(abs.filter(a => a.pt === pt)) }));
  const cnt = abs.filter(a => a.count && a.count.s != null && a.count.b != null);
  const twoAbs = cnt.filter(a => a.count.s >= 2);
  const kBy = list => {
    const m = {};
    list.filter(a => a.res === '삼진' && a.pt).forEach(a => { m[a.pt] = (m[a.pt] || 0) + 1; });
    return Object.entries(m).sort((x, y) => y[1] - x[1]);
  };
  // 최근 흐름: 마지막 N경기 vs 그 전
  const gl = P.gameList || [];
  const recentAbs = gl.slice(-RECENT_GAMES).flatMap(g => g.abs);
  const earlyAbs = gl.slice(0, Math.max(0, gl.length - RECENT_GAMES)).flatMap(g => g.abs);
  // 공격 지수 순위 (10타석 이상 타자끼리)
  const byName = {};
  data.games.forEach(g => g.abs.forEach(a => { if (a.bname) (byName[a.bname] = byName[a.bname] || []).push(a); }));
  const ranked = Object.entries(byName).map(([n, l]) => ({ n, s: calcStats(l) })).filter(x => x.s.pa >= 10).sort((x, y) => y.s.woba - x.s.woba);

  return {
    st, pool, zones, pts,
    two: calcStats(twoAbs), twoK: kBy(twoAbs),
    ahead: calcStats(cnt.filter(a => a.count.s > a.count.b)),
    even: calcStats(cnt.filter(a => a.count.s === a.count.b)),
    behind: calcStats(cnt.filter(a => a.count.b > a.count.s)),
    go: abs.filter(a => a.res === '땅볼 아웃' || a.res === '병살').length,
    fo: abs.filter(a => a.res === '플라이 아웃' || a.res === '희비').length,
    recent: calcStats(recentAbs), recentK: kBy(recentAbs), early: calcStats(earlyAbs), lastN: Math.min(RECENT_GAMES, gl.length),
    rank: ranked.findIndex(x => x.n === P.name) + 1, rankN: ranked.length,
    xbhPull: abs.filter(a => XBH.includes(a.res) && isPull(a)).length,
    xbhPullIn: abs.filter(a => XBH.includes(a.res) && isPull(a) && a.zone && a.zone.startsWith('내각')).length,
    zoned: abs.filter(a => a.zone).length, pted: abs.filter(a => a.pt).length,
  };
}

// ── 칼럼 만들기 ───────────────────────────────────────────────
// 반환: { title, sub, meta, sections: [{ h, paras: [문단...] }], notes: [주석...] }
export function buildColumn(P, data) {
  const F = _facts(P, data);
  const { st, pool } = F;
  const name = P.name;
  const pick = picker(name);
  const batsTxt = P.bats === 'L' ? '좌타' : P.bats === 'S' ? '스위치' : '우타';
  const idx = pool.woba > 0 && st.pa >= 5 ? Math.round((st.woba / pool.woba) * 100) : null;
  const xbh = st.s2 + st.s3 + st.hr;
  const pullP = st.dn ? st.pull / st.dn : 0;
  const pulled = st.dn >= 6 && pullP >= 0.55;   // 수비 이동 근거 (scouting.js 와 같은 기준)
  const pullSide = P.bats === 'L' ? '1루' : '3루';
  const fieldSide = P.bats === 'L' ? '1루·2루수' : '3루·유격수';
  const power = st.ab >= 10 && st.iso >= Math.max(0.2, pool.iso + 0.08);

  // 코스: 강한/약한 코스 (표본 기준 충족 + scouting.js 와 같은 임계)
  const zq = F.zones.filter(z => z.ab >= MIN_ZONE_AB);
  const hot = zq.filter(z => z.avg >= 0.4).sort((a, b) => b.avg - a.avg || b.ab - a.ab);
  const cold = zq.filter(z => z.avg <= 0.15).sort((a, b) => a.avg - b.avg || b.ab - a.ab);
  const H = hot[0], C = cold[0];
  // 구종: 결정구 후보(이 타자 평균보다 확실히 약하고 그 자체로도 잘 막힘) · 위험 구종(확실히 강함)
  const pq = F.pts.filter(p => p.ab >= MIN_ZONE_AB).sort((a, b) => b.pa - a.pa);
  const lowest = pq.slice().sort((a, b) => a.woba - b.woba)[0];
  const killer = lowest && lowest.woba < st.woba - 0.03 && (lowest.avg <= 0.25 || lowest.kRate >= 0.3) ? lowest : null;
  const highest = pq.slice().sort((a, b) => b.woba - a.woba)[0];
  const danger = highest && highest !== killer && (highest.avg >= 0.4 || highest.woba >= st.woba + 0.03) ? highest : null;
  const minor = pq.filter(p => p !== killer && p !== danger && p.ab < 6);

  const sections = [];
  const sec = (h, ...paras) => {
    const ps = paras.map(p => (Array.isArray(p) ? p.filter(Boolean).join(' ') : p)).filter(Boolean);
    if (ps.length) sections.push({ h, paras: ps });
  };

  // 부제 — 가장 크게 갈리는 두 숫자
  const sub = danger && killer ? `${J(danger.pt, '은')} 치고, ${J(killer.pt, '은')} 못 친다`
    : H && C ? `${H.adj} 공은 치고, ${C.adj} 공은 못 친다`
    : C && killer ? `답은 ${C.adj} ${killer.pt}`
    : killer ? `${J(killer.pt, '이')} 답이다`
    : C ? `${C.adj} 공에 답이 있다`
    : power && pulled ? '당겨서 장타를 만드는 타자'
    : H ? `${H.adj} 공은 주면 안 된다`
    : st.pa < 10 ? '아직 표본이 적은 타자'
    : '기록으로 본 공략법';

  // 도입 — 대비되는 숫자 → 시즌 성적 → 질문
  const hooked = !!(danger && killer);
  const rankTxt = st.pa >= 10 && F.rank === 1 ? `${F.rankN}명 가운데 가장 높다` : F.rank === 2 ? `${F.rankN}명 가운데 두 번째로 높다` : F.rank === 3 ? `${F.rankN}명 가운데 세 번째로 높다` : '';
  sec('',
    hooked ? `${danger.pt} 상대 타율 ${f3(danger.avg)}, ${killer.pt} 상대 타율 ${f3(killer.avg)}. ${pick([`${J(name, '을')} 설명하는 데는 이 두 숫자면 충분하다.`, `${J(name, '은')} 이 두 숫자 사이에 있는 타자다.`])}` : '',
    [
      `${hooked ? '성적만 놓고 보면' : J(name, '은')} ${P.games}경기 ${st.pa}타석에서 타율 ${f3(st.avg)}에 출루율 ${f3(st.obp)}, 장타율 ${f3(st.slg)}이다.`,
      st.ab >= 10 && xbh >= 3 ? `${st.ab}타수 동안 장타가 ${xbh}개 나왔으니 ${Math.round(st.ab / xbh)}타수에 한 번꼴이다.` : xbh === 0 && st.ab >= 10 ? `${st.ab}타수 동안 장타는 한 개도 없었다.` : '',
      idx != null ? `기록된 타자 전체 평균을 100으로 놓으면 공격 지수(wOBA¹ 기준)는 ${idx}${rankTxt ? `로, ${rankTxt}` : idx >= 115 ? '. 상대 라인업에서 가장 먼저 표시해 둘 이름이다' : idx < 85 ? '. 평균보다 확실히 약한 타자로, 적극적으로 승부할 만하다' : ''}.` : '',
      st.pa >= 10 && st.bbRate >= pool.bbRate + 0.05 ? `볼넷 비율 ${pct(st.bbRate)}는 전체 평균(${pct(pool.bbRate)})보다 훨씬 높다. 존을 벗어난 공은 잘 참는 타자다.` : '',
    ],
    (C || killer) && (idx == null || idx >= 100) ? pick(['그렇다고 못 잡을 타자는 아니다. 약점이 생각보다 분명하게 드러나 있기 때문이다.', '그런데 이 타자에게는 약점도 분명하다. 기록을 하나씩 뜯어보면 어디로 던져야 할지가 보인다.']) : '',
  );

  // 강점 — 잘 치는 코스 + 그 안타가 어디로 갔는지 + 타구 방향
  if (H || pulled || danger) {
    const hHits = H ? H.abs.filter(a => HITS.includes(a.res)) : [];
    const hPull = hHits.filter(isPull).length;
    const head = [H ? `${H.adj} 공` : danger ? danger.pt : '', pulled ? '당겨치기' : ''].filter(Boolean);
    sec(`강점 — ${head.join(', 그리고 ')}`, [
      H ? `${J(name, '이')} 가장 잘 치는 공은 ${H.adj} 공이다. 이 코스에서 ${H.ab}타수 ${H.h}안타${H.hr ? `, 홈런 ${H.hr}개` : ''}를 쳤고${hHits.length >= 2 && hPull === hHits.length ? `, 안타 ${hHits.length}개가 모두 ${pullSide} 쪽으로 당겨친 타구였다` : hPull >= 2 ? `, 그중 ${hPull}개가 ${pullSide} 쪽으로 당겨친 타구였다` : ''}.` : '',
      hot[1] ? `${hot[1].label}에서도 ${hot[1].ab}타수 ${hot[1].h}안타로 강했다.` : '',
      !H && danger ? `${J(name, '이')} 가장 잘 치는 공은 ${danger.pt}다. ${danger.ab}타수 ${danger.h}안타(${f3(danger.avg)})${danger.hr ? `에 홈런 ${danger.hr}개` : ''}를 때렸다.` : '',
      pulled ? `${H || danger ? '타구 방향도 같은 이야기를 한다. ' : ''}방향이 기록된 타구 ${st.dn}개 가운데 ${st.pull}개(${pct(pullP)})가 당겨친 쪽이었고, 밀어친 타구는 ${st.oppo === 0 ? '하나도 없었다' : st.oppo <= 2 ? `${st.oppo}개뿐이었다` : `${st.oppo}개였다`}.` : '',
      pulled && F.xbhPull >= 2 ? `장타 ${xbh}개 중 ${F.xbhPull}개도 당겨친 쪽에서 나왔다. ${F.xbhPullIn >= 2 ? pick(['몸쪽 공을 끌어당겨 장타를 만드는 타자인 셈이다.', '몸쪽으로 들어온 공을 놓치지 않고 당겨서 멀리 보내는 유형이다.']) : '장타는 당겨서 만드는 타자다.'}` : '',
      pulled ? `수비는 ${fieldSide} 쪽으로 한 발 옮겨 두는 게 맞다.` : '',
    ]);
  }

  // 약점 — 못 치는 코스와 못 치는 구종이 같은 곳을 가리키는지
  if (C || killer) {
    const overlap = C && killer ? C.abs.filter(a => a.pt === killer.pt && !NOAB.includes(a.res)).length : 0;
    sec(`약점 — ${C && killer ? `${C.adj} ${killer.pt}` : C ? C.label : killer.pt}`, [
      C ? `${H ? `반대로 ${J(C.label, '로')} 가면 전혀 다른 타자가 된다.` : `${C.label}에서는 힘을 쓰지 못했다.`} ${C.ab}타수 동안 ${C.h ? `안타는 ${C.h}개뿐이었${C.k ? '고' : '다'}` : `안타가 하나도 없었${C.k ? '고' : '다'}`}${C.k ? `, 그사이 삼진이 ${C.k}개 쌓였다` : ''}.` : '',
      cold[1] ? `${cold[1].label}도 ${cold[1].ab}타수 ${cold[1].h}안타에 그쳤다.` : '',
      killer ? `${C ? '구종으로 보면 차이가 더 분명하다. ' : ''}${danger ? `${J(danger.pt, '을')} 상대로는 ${danger.ab}타수 ${danger.h}안타(${f3(danger.avg)})${danger.hr ? `에 홈런 ${danger.hr}개` : ''}를 때렸지만, ` : ''}${killer.pt}에는 ${killer.ab}타수 ${killer.h}안타(${f3(killer.avg)})에 그쳤${killer.k ? `고 삼진만 ${killer.k}개를 당했다` : '다'}.` : '',
      overlap >= 3 ? `${pick(['흥미로운 건', '눈여겨볼 건'])} 코스와 구종이 같은 곳을 가리킨다는 점이다. ${C.label}에서 나온 ${C.ab}타수 가운데 ${overlap}타수가 ${killer.pt}였다. ${pick(['약점이 하나로 모여 있으니 공략도 단순해진다.', '투수 입장에서는 던질 공이 이미 정해져 있는 셈이다.'])}` : '',
      minor.length ? `${J(_listKo(minor.map(p => p.pt)), '은')} ${minor.length > 1 ? '각각 ' : ''}${minor.map(p => `${p.ab}타수 ${p.h}안타`).join(', ')}로 표본이 작아 판단을 미룬다.` : '',
    ]);
  }

  // 카운트 운영 — 약점까지 가는 길
  if (F.ahead.pa >= MIN_SPLIT && F.behind.pa >= MIN_SPLIT && F.ahead.ab && F.behind.ab) {
    const gap = F.behind.avg - F.ahead.avg;
    const topK = F.twoK[0];
    sec('카운트 운영', [
      gap >= 0.15
        ? `${killer ? '문제는 그 공을 던질 카운트를 만드는 일이다. ' : ''}볼이 먼저 쌓인 타자 유리 카운트에서는 ${F.behind.pa}타석 타율이 ${f3(F.behind.avg)}에 이른다. 그런데 투수가 먼저 스트라이크를 잡으면 ${F.ahead.pa}타석 타율 ${f3(F.ahead.avg)}까지 떨어진다.`
        : gap <= -0.15
          ? `카운트가 몰려도 크게 흔들리지 않는 타자다. 투수 유리 카운트에서 ${F.ahead.pa}타석 타율 ${f3(F.ahead.avg)}, 오히려 타자 유리 카운트(${F.behind.pa}타석)에서 ${f3(F.behind.avg)}로 낮았다.`
          : `카운트에 따른 차이는 크지 않다. 투수 유리 카운트에서 ${F.ahead.pa}타석 타율 ${f3(F.ahead.avg)}, 타자 유리 카운트에서 ${F.behind.pa}타석 타율 ${f3(F.behind.avg)}.`,
      F.two.pa >= MIN_SPLIT && F.two.kRate >= 0.35 ? `2스트라이크 이후로 좁히면 ${F.two.pa}타석에서 삼진이 ${F.two.k}개(${pct(F.two.kRate)})${topK && topK[1] >= 3 ? `였고, 그중 ${topK[1]}개가 ${topK[0]}였다` : '였다'}.` : '',
      F.two.pa >= MIN_SPLIT && F.two.avg >= 0.35 && F.two.ab ? `다만 2스트라이크에서도 ${F.two.ab}타수 ${F.two.h}안타(${f3(F.two.avg)})를 쳤다. 몰린 카운트에서도 쉽게 물러나지 않는다.` : '',
      gap >= 0.15 ? pick(['결국 카운트를 먼저 잡는 쪽이 이긴다.', '먼저 스트라이크를 잡는 것, 그게 이 타자를 상대하는 출발점이다.']) : '',
    ]);
  }

  // 전망 — 최근 흐름 + 정리 + 질문
  const moved = F.recent.pa >= 10 && F.early.pa >= 10 && F.recent.ab && F.early.ab && Math.abs(F.recent.avg - F.early.avg) >= 0.1;
  const down = moved && F.recent.avg < F.early.avg;
  const rk = killer ? (F.recentK.find(x => x[0] === killer.pt) || [0, 0])[1] : 0;
  const guessed = moved && down && rk >= 3;
  sec('전망',
    moved ? [
      `한 가지 변수는 최근 흐름이다. 최근 ${F.lastN}경기에서는 ${F.recent.ab}타수 ${F.recent.h}안타(${f3(F.recent.avg)})로 그 전 경기들(${f3(F.early.avg)})보다 확실히 ${down ? '식었' : '올라왔'}${down && F.recent.kRate - F.early.kRate >= 0.1 ? `고, 삼진 비율도 ${pct(F.early.kRate)}에서 ${pct(F.recent.kRate)}까지 올랐다` : '다'}.`,
      guessed ? `최근 삼진 ${F.recent.k}개 가운데 ${rk}개가 ${killer.pt}였던 걸 보면, 상대 팀들도 같은 약점을 보고 있다는 뜻일 수 있다.` : '',
      `다만 ${F.recent.pa}타석은 작은 표본이라 ${down ? '슬럼프' : '상승세'}라고 단정하긴 이르다.`,
    ] : '',
    C && killer ? [
      `정리하면 답은 분명하다. ${H && danger ? `카운트를 잡으러 ${H.adj} ${J(danger.pt, '을')} 넣는 건 이 타자가 가장 기다리는 공을 주는 일이다. ` : ''}먼저 스트라이크를 잡고, 2스트라이크에서 ${C.adj} ${J(killer.pt, '로')} 끝내는 것. 기록이 가리키는 길은 이것 하나다.`,
      pick([`남는 건 우리 투수에게 그 코스로 ${J(killer.pt, '을')} 떨어뜨릴 제구가 있느냐다.`, '결국 질문은 하나로 좁혀진다. 우리 투수가 그 공을 원하는 곳에 던질 수 있는가.']),
    ] : killer ? [
      `정리하면 승부구는 ${killer.pt}다. ${danger ? `${J(danger.pt, '은')} 카운트를 잡을 때도 아껴야 한다. ` : ''}먼저 스트라이크를 잡고 ${J(killer.pt, '로')} 끝내는 것, 기록이 가리키는 길은 그것이다.`,
    ] : C ? [
      `정리하면 승부는 ${C.label}에서 걸어야 한다. ${H ? `${J(H.label, '은')} 어떤 카운트에서도 피하는 게 맞다. ` : ''}구종별 기록이 더 쌓이면 어떤 공을 그 코스로 던질지도 보일 것이다.`,
    ] : H || pulled ? [
      `아직 뚜렷하게 약한 코스나 구종은 드러나지 않았다. ${H ? `분명한 건 ${J(H.label, '은')} 피해야 한다는 것, ` : '분명한 건 '}${pulled ? `수비를 ${fieldSide} 쪽으로 옮겨 둘 근거는 충분하다는 것이다.` : '표본이 더 쌓여야 한다는 것이다.'} 코스·구종·카운트를 함께 기록할수록 공략 포인트가 선명해진다.`,
    ] : [
      st.pa < 10 ? `${st.pa}타석만으로 결론을 내리긴 이르다. 코스·구종·카운트를 함께 기록해 두면 다음 리포트에서는 공략 포인트가 보일 것이다.` : '아직 뚜렷한 약점이 드러나지 않았다. 코스·구종·카운트를 함께 기록할수록 공략 포인트가 선명해진다.',
    ],
  );

  // ── 그림 — 그 얘기를 하는 섹션 뒤에 붙인다 (표본 기준·색 규칙은 문장과 동일) ──
  const has = h => sections.find(x => (h ? x.h.startsWith(h) : x.h === ''));
  const attach = (prefs, fig) => {
    if (!fig) return;
    const target = prefs.map(has).find(Boolean);
    if (target) (target.figs = target.figs || []).push(fig);
  };
  if (st.dn >= 6) attach(['강점', ''], { kind: 'spray', P });
  if (zq.length) attach([C ? '약점' : H ? '강점' : '', '약점', '강점', ''], {
    kind: 'zone', base: st.avg, zoned: F.zoned, pa: st.pa,
    cells: F.zones.map(z => ({ adj: z.adj, label: z.label, avg: z.avg, ab: z.ab, h: z.h, pa: z.pa, ok: z.ab >= MIN_ZONE_AB })),
  });
  if (F.pts.some(p => p.ab)) attach([killer ? '약점' : danger ? '강점' : '', '약점', '강점', ''], {
    kind: 'pitch', base: st.avg, pted: F.pted, pa: st.pa,
    rows: F.pts.filter(p => p.ab).slice().sort((a, b) => b.pa - a.pa).map(p => ({
      pt: p.pt, avg: p.avg, ab: p.ab, h: p.h, k: p.k, pa: p.pa, ok: p.ab >= MIN_ZONE_AB,
      role: killer && p.pt === killer.pt ? 'attack' : danger && p.pt === danger.pt ? 'avoid' : '',
    })),
  });
  attach(['카운트'], {
    kind: 'count',
    rows: [['투수 유리', '스트라이크 > 볼', F.ahead], ['이븐', '볼 = 스트라이크', F.even], ['타자 유리', '볼 > 스트라이크', F.behind], ['2스트라이크', '스트라이크 2개', F.two]]
      .map(([l, d, c]) => ({ l, d, pa: c.pa, ab: c.ab, avg: c.avg, obp: c.obp, kRate: c.kRate, ok: c.pa >= MIN_SPLIT })),
  });
  if ((P.trend || []).length >= 4) attach(['전망'], {
    kind: 'trend', base: pool.avg, lastN: F.lastN,
    pts: P.trend.map((t, i) => ({ i: i + 1, avg: t.avg, pa: t.pa, label: t.label })),
    recentFrom: Math.max(0, P.trend.length - RECENT_GAMES),
  });

  const notes = [
    `※ 이 리포트는 SprayLab에 기록된 ${P.games}경기 ${st.pa}타석을 바탕으로 자동 작성했다. 코스는 ${F.zoned}타석, 구종은 ${F.pted}타석, 타구 방향은 ${st.dn}타석만 기록돼 있고, ${MIN_ZONE_AB}타수가 안 되는 코스와 구종, ${MIN_SPLIT}타석이 안 되는 카운트는 판단에서 뺐다.${guessed ? ' 상대 팀이 약점을 알아챘다는 부분은 기록으로 확인한 사실이 아니라 추정이다.' : ''} 아마추어 기록 특성상 표본이 작아, 경향을 보여줄 뿐 확정은 아니다.`,
  ];
  if (idx != null) notes.push('¹ wOBA: 볼넷·안타·장타에 서로 다른 점수를 매겨 타자의 공격력을 하나로 나타낸 지표. 여기서는 기록된 타자 전체 평균을 100으로 놓고 비교했다.');

  return {
    title: `${name} 스카우팅 리포트`,
    sub,
    meta: [P.num !== '' && P.num != null ? '#' + P.num : '', batsTxt, `${P.games}경기 ${st.pa}타석`].filter(Boolean).join(' · '),
    sections, notes,
  };
}

// 복사용 텍스트
export function columnText(col) {
  const L = [`■ ${col.title} — ${col.sub}`, col.meta, ''];
  col.sections.forEach(s => {
    if (s.h) L.push(`[${s.h}]`);
    s.paras.forEach(p => L.push(p));
    (s.figs || []).filter(f => f.kind === 'count').forEach(f => {
      L.push('(표) 카운트별 결과 — 구분 / 타석 / 타율 / 출루율 / 삼진%');
      f.rows.forEach(r => L.push(`${r.l}: ${r.pa} / ${r.ab ? f3(r.avg) : '—'} / ${r.pa ? f3(r.obp) : '—'} / ${r.pa ? pct(r.kRate) : '—'}${r.ok ? '' : ' (표본 부족)'}`));
    });
    L.push('');
  });
  col.notes.forEach(n => L.push(n));
  L.push('', 'SprayLab · YOUR SWING, VISUALIZED');
  return L.join('\n');
}

// ── 그림 그리기 (SVG · 표) ────────────────────────────────────
// 색: 공략 = 펜 파랑, 위험 = 펜 빨강, 그 외 = 회색 — 종이 팔레트 (paper.css) 와 같은 값. 글자는 항상 잉크색.
const C_ATK = '#2C4F8A', C_AVD = '#C8322B', C_MUTE = '#8F887B', C_SURF = '#FBF7EE', C_INK = '#1F2A23', C_INK2 = '#55605A', C_LINE = '#D9D2C2';
const _e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 발산형 색: 이 타자 통산 타율(base) 기준으로 약하면 파랑, 강하면 빨강, 가운데는 중립 회색 (scouting.js 코스 카드와 같은 규칙)
function _diverge(avg, base) {
  const lo = [44, 79, 138], hi = [200, 50, 43], mid = [233, 228, 216];
  const span = Math.max(0.15, base);
  const t = Math.max(-1, Math.min(1, (avg - base) / span));
  const to = t < 0 ? lo : hi;
  const c = mid.map((m, i) => Math.round(m + (to[i] - m) * Math.abs(t)));
  return { fill: `rgb(${c.join(',')})`, ink: Math.abs(t) >= 0.8 ? '#FFFFFF' : C_INK };
}

const _fig = (kind, body, cap) => `<figure class="sc-col-fig sc-fig-${kind}">${body}<figcaption>${cap}</figcaption></figure>`;

function _zoneSvg(f) {
  const cell = 80, gap = 2, left = 40, top = 20;
  const W = left + cell * 3 + gap * 2, H = top + cell * 3 + gap * 2;
  const cols = ['몸쪽', '가운데', '바깥쪽'], rows = ['높음', '중간', '낮음'];
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="코스별 타율 3×3">`;
  cols.forEach((c, i) => { out += `<text x="${left + cell * i + gap * i + cell / 2}" y="13" text-anchor="middle" class="t-lbl">${c}</text>`; });
  rows.forEach((r, i) => { out += `<text x="${left - 6}" y="${top + cell * i + gap * i + cell / 2 + 4}" text-anchor="end" class="t-lbl">${r}</text>`; });
  f.cells.forEach((z, i) => {
    const x = left + (i % 3) * (cell + gap), y = top + Math.floor(i / 3) * (cell + gap);
    const tip = `<title>${_e(z.label)}: ${z.pa}타석 · 타율 ${z.ab ? f3(z.avg) : '—'} (${z.h}/${z.ab})</title>`;
    if (!z.ok) {
      out += `<g>${tip}<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#F1EDE3"/>` +
        `<text x="${x + cell / 2}" y="${y + cell / 2 + 4}" text-anchor="middle" class="t-sub">${z.pa ? `${z.pa}타석` : '—'}</text></g>`;
      return;
    }
    const c = _diverge(z.avg, f.base);
    out += `<g>${tip}<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${c.fill}"/>` +
      `<text x="${x + cell / 2}" y="${y + cell / 2 + 1}" text-anchor="middle" class="t-num" style="fill:${c.ink}">${f3(z.avg)}</text>` +
      `<text x="${x + cell / 2}" y="${y + cell / 2 + 18}" text-anchor="middle" class="t-sub" style="fill:${c.ink};opacity:.85">${z.h}/${z.ab}</text></g>`;
  });
  out += '</svg>';
  return _fig('zone', out, `<b>코스별 타율</b> · 몸쪽 → 바깥쪽 순 · 파랑 = 이 타자 통산 타율(${f3(f.base)})보다 약한 코스(공략), 빨강 = 강한 코스(위험) · 회색 = ${MIN_ZONE_AB}타수 미만 · 코스 기록 ${f.zoned}/${f.pa}타석`);
}

function _pitchSvg(f) {
  const rowH = 30, top = 20, x0 = 78, maxW = 150, barH = 18, W = 320;
  const H = top + f.rows.length * rowH + 6;
  const scale = Math.max(0.5, ...f.rows.map(r => r.avg));
  const xOf = v => x0 + (v / scale) * maxW;
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="구종별 타율 막대">`;
  const bx = xOf(f.base);
  out += `<line x1="${bx}" y1="${top - 4}" x2="${bx}" y2="${H - 4}" stroke="${C_LINE}" stroke-width="1"/>` +
    `<text x="${bx}" y="${top - 8}" text-anchor="middle" class="t-sub">통산 ${f3(f.base)}</text>` +
    `<line x1="${x0}" y1="${top - 2}" x2="${x0}" y2="${H - 4}" stroke="${C_LINE}" stroke-width="1"/>`;
  f.rows.forEach((r, i) => {
    const y = top + i * rowH + (rowH - barH) / 2;
    const w = Math.max(0, xOf(r.avg) - x0);
    const col = r.role === 'attack' ? C_ATK : r.role === 'avoid' ? C_AVD : C_MUTE;
    const rr = Math.min(4, w);
    const path = w > 0 ? `M${x0} ${y}h${w - rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${barH - rr * 2}a${rr} ${rr} 0 0 1 -${rr} ${rr}h-${w - rr}z` : '';
    const tip = `<title>${_e(r.pt)}: ${r.pa}타석 · 타율 ${f3(r.avg)} (${r.h}/${r.ab})${r.k ? ` · 삼진 ${r.k}` : ''}</title>`;
    out += `<g${r.ok ? '' : ' opacity=".45"'}>${tip}` +
      `<text x="${x0 - 8}" y="${y + barH / 2 + 4}" text-anchor="end" class="t-lbl">${_e(r.pt)}</text>` +
      (path ? `<path d="${path}" fill="${col}"/>` : '') +
      `<text x="${xOf(r.avg) + 6}" y="${y + barH / 2 + 4}" class="t-val">${f3(r.avg)} <tspan class="t-sub">(${r.h}/${r.ab})</tspan></text></g>`;
  });
  out += '</svg>';
  const key = `<div class="sc-col-key"><span><i style="background:${C_ATK}"></i>결정구 후보</span><span><i style="background:${C_AVD}"></i>조심</span><span><i style="background:${C_MUTE}"></i>그 외</span><span>흐린 막대 = ${MIN_ZONE_AB}타수 미만</span></div>`;
  return _fig('pitch', out + key, `<b>구종별 타율</b> · 결과가 나온 공의 구종 · 세로선 = 통산 타율 · 구종 기록 ${f.pted}/${f.pa}타석`);
}

function _countTable(f) {
  const rows = f.rows.map(r => `<tr${r.ok ? '' : ' class="thin"'}><th scope="row">${r.l}<small>${r.d}</small></th><td>${r.pa}</td><td><b>${r.ab ? f3(r.avg) : '—'}</b></td><td>${r.pa ? f3(r.obp) : '—'}</td><td>${r.pa ? pct(r.kRate) : '—'}</td></tr>`).join('');
  const tbl = `<table class="sc-col-tbl"><thead><tr><th scope="col">구분</th><th scope="col">타석</th><th scope="col">타율</th><th scope="col">출루율</th><th scope="col">삼진%</th></tr></thead><tbody>${rows}</tbody></table>`;
  return _fig('count', tbl, `<b>카운트별 결과</b> · 결과가 나온 순간의 볼·스트라이크 · 흐린 줄 = ${MIN_SPLIT}타석 미만`);
}

function _trendSvg(f) {
  const W = 320, H = 160, left = 38, right = 16, top = 16, bottom = 24;
  const pw = W - left - right, ph = H - top - bottom;
  const n = f.pts.length;
  const yMax = Math.max(0.5, Math.ceil((Math.max(...f.pts.map(p => p.avg), f.base) + 0.05) * 10) / 10);
  const xOf = i => left + (n > 1 ? (i / (n - 1)) * pw : pw / 2);
  const yOf = v => top + ph - (v / yMax) * ph;
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="경기별 누적 타율 흐름">`;
  for (let v = 0; v <= yMax + 1e-9; v += 0.1) {
    out += `<line x1="${left}" y1="${yOf(v)}" x2="${W - right}" y2="${yOf(v)}" stroke="${C_LINE}" stroke-width="1"/>` +
      `<text x="${left - 5}" y="${yOf(v) + 3.5}" text-anchor="end" class="t-sub">${v === 0 ? '0' : f3(v)}</text>`;
  }
  if (f.recentFrom > 0 && f.recentFrom < n - 1) out += `<rect x="${xOf(f.recentFrom)}" y="${top}" width="${xOf(n - 1) - xOf(f.recentFrom)}" height="${ph}" fill="${C_ATK}" opacity=".08"/>`;
  out += `<line x1="${left}" y1="${yOf(f.base)}" x2="${W - right}" y2="${yOf(f.base)}" stroke="${C_INK2}" stroke-width="1" stroke-dasharray="4 3"/>` +
    `<text x="${W - right}" y="${yOf(f.base) - 4}" text-anchor="end" class="t-sub">전체 평균 ${f3(f.base)}</text>`;
  out += `<polyline points="${f.pts.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.avg).toFixed(1)}`).join(' ')}" fill="none" stroke="${C_ATK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  f.pts.forEach((p, i) => {
    out += `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.avg).toFixed(1)}" r="4" fill="${C_ATK}" stroke="${C_SURF}" stroke-width="2"><title>${_e(p.label)} 까지 · 누적 타율 ${f3(p.avg)}</title></circle>`;
  });
  const last = f.pts[n - 1];
  out += `<text x="${xOf(n - 1) - 7}" y="${yOf(last.avg) - 8}" text-anchor="end" class="t-val">${f3(last.avg)}</text>`;
  // 가로축 숫자: 마지막 경기부터 거꾸로 같은 간격 (마지막 경기 번호는 항상 표시)
  const step = Math.max(1, Math.ceil(n / 8));
  f.pts.forEach((p, i) => { if ((n - 1 - i) % step === 0) out += `<text x="${xOf(i)}" y="${H - 8}" text-anchor="middle" class="t-sub">${p.i}</text>`; });
  out += '</svg>';
  return _fig('trend', out, `<b>경기별 누적 타율</b> · 가로축 = 경기 순서(1~${n}), 세로축 = 그 경기까지 누적 타율 · 점선 = 기록된 타자 전체 평균 · 색칠 = 최근 ${f.lastN}경기`);
}

function _sprayFig(f) {
  const s = f.P.st;
  return _fig('spray', sprayFigure(f.P), `<b>타구 방향</b> · 방향이 기록된 타구 ${s.dn}개 · 당김 ${s.pull} · 센터 ${s.center} · 밀어 ${s.oppo}`);
}

export function renderColumnFigure(f) {
  try {
    if (f.kind === 'zone') return _zoneSvg(f);
    if (f.kind === 'pitch') return _pitchSvg(f);
    if (f.kind === 'count') return _countTable(f);
    if (f.kind === 'trend') return _trendSvg(f);
    if (f.kind === 'spray') return _sprayFig(f);
  } catch (e) { console.warn('[column] figure', f.kind, e); }
  return '';
}
