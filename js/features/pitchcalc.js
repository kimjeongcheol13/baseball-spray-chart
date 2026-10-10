// 투구 기록 모델 — 결과 어휘 · 옛 값 읽기 · 볼카운트 · 타석 묶기 · 투수 지표 (DOM 없음)
// 투수 탭(pitcher.js) · 분석 엑셀(xlsxreport.js) · 옛 엑셀 내보내기(core.js) · 투구 입력(core.js recordPitch) · 테스트가 모두 이 파일 하나를 쓴다.
//
// 투구 한 개 (AS.pitchers[].pitches[]) — 저장된 모양
//   v1 (옛 기록, 필드 없음): { id, inning, zone, zoneX, zoneY, pt, result, batter, ts }
//        result 에 타석 결과(안타·삼진·볼넷…)가 섞여 있다 → 읽을 때 LEGACY_END 로 해석한다. 저장값은 절대 고쳐 쓰지 않는다.
//   v2 (새 입력):           위 필드 + { v: 2, pa, bid, pr, end?, nk? }
//        pr     = 투구 자체의 결과 — 이 공이 뭐였는지의 기준값 (볼 · 헛스윙 · 루킹 · 파울 · 타격됨 · 사구)
//                 P1 전에 입력한 '스트라이크'는 헛스윙/루킹을 나누지 않은 값 → 화면 · 엑셀에는 '스트라이크(구분 없음)'. 스트라이크%에서는 셋 다 스트라이크
//        end    = 이 투구로 타석이 끝났을 때만. 값은 END_CHOICES 의 값 + '미상'(모름 — 지표에서는 미기록과 같다). 읽을 때는 end 가 있으면 항상 end 가 우선
//        result = 옛 클라이언트용 보조값 (읽을 때는 pr · end 를 먼저 본다). 끝나지 않은 공은 pr 과 같고(헛스윙 · 루킹은 옛 코드가 아는 '스트라이크'), 타석을 끝낸 공은 옛 코드가 알아보는 결과(legacyResult)로 쓴다
//                 → 이미 배포된 옛 코드가 v2 경기를 열어도 삼진 · 볼넷 · 안타가 맞게 읽힌다 (옛 코드가 모르는 사구 · 실책 · 야수선택 · 희생은 각각 볼넷 · 아웃으로 읽힌다)
//        pa     = 타석 ID (그 타석 첫 투구의 id) · bid = 타자 id
//        nk     = 1 이면 낫아웃 출루 (삼진은 삼진, 아웃은 아니다)
// 타석(PA)은 저장하지 않고 읽을 때 묶는다: v2 는 pa 가 같은 것끼리, v1 은 같은 타자 이름으로 이어지고 결과가 나오면 끊긴다.

// ── 어휘 ─────────────────────────────────────────────────────
// [저장값, 화면 이름, 묶음, 끝난 뒤 타석 결과 시트에 넣을지]  (저장값은 기존 결과 어휘를 그대로 쓰고 새 값만 더했다)
export const END_CHOICES = [
  ['안타', '단타', 'hit', 1], ['2루타', '2루타', 'hit', 1], ['3루타', '3루타', 'hit', 1], ['홈런', '홈런', 'hit', 1],
  ['땅볼 아웃', '땅볼 아웃', 'out', 1], ['플라이 아웃', '뜬공 아웃', 'out', 1], ['라인드라이브 아웃', '라인드라이브 아웃', 'out', 1],
  ['실책', '실책 출루', 'on', 1], ['야수선택', '야수선택', 'on', 1],
  ['희타', '희생번트', 'sac', 1], ['희비', '희생플라이', 'sac', 1],
  ['병살', '병살', 'out', 1], ['삼중살', '삼중살', 'out', 0],
  ['볼넷', '볼넷', 'bb', 1], ['사구', '사구', 'bb', 1], ['삼진', '삼진', 'k', 1],
];
export const UNKNOWN = '미상';
export const END_LABEL = { ...Object.fromEntries(END_CHOICES.map(([v, l]) => [v, l])), '내야안타': '내야안타', '아웃': '아웃', [UNKNOWN]: '모름' };

const HIT = ['안타', '내야안타', '2루타', '3루타', '홈런'];
export const HIT_ENDS = HIT;
const TB = { '안타': 1, '내야안타': 1, '2루타': 2, '3루타': 3, '홈런': 4 };
const OUTS = { '삼진': 1, '아웃': 1, '땅볼 아웃': 1, '플라이 아웃': 1, '라인드라이브 아웃': 1, '희타': 1, '희비': 1, '병살': 2, '삼중살': 3 };
const IN_PLAY = [...HIT, '땅볼 아웃', '플라이 아웃', '라인드라이브 아웃', '아웃', '병살', '삼중살', '실책', '야수선택', '희타', '희비'];
const VALID_END = new Set([...END_CHOICES.map(c => c[0]), '내야안타', '아웃', UNKNOWN]);
// v1 에서 result 로 저장된 타석 결과 → 타석 결과  ('타격됨' = 옛 UI 의 인플레이 → 안타로 읽는다. 투수 탭이 지금까지 그렇게 셌다)
const LEGACY_END = {
  '안타': '안타', '타격됨': '안타', '2루타': '2루타', '3루타': '3루타', '홈런': '홈런', '내야안타': '내야안타',
  '삼진': '삼진', '아웃': '아웃', '병살': '병살', '삼중살': '삼중살', '볼넷': '볼넷', '사구': '사구',
  '땅볼 아웃': '땅볼 아웃', '플라이 아웃': '플라이 아웃', '희타': '희타', '희비': '희비',
};
// 끝내는 입력 → 그 투구 자체의 결과 pr (그 밖의 타석 결과는 인플레이 = '타격됨')
const PITCH_OF_END = { '삼진': '스트라이크', '볼넷': '볼', '사구': '사구' };
// 타석 결과 → 옛 클라이언트가 알아보는 result. 옛 투수 탭이 아는 값은 안타 · 2루타 · 3루타 · 홈런 · 삼진 · 볼넷 · 아웃 · 병살 · 삼중살 뿐이다.
//   사구 → 볼넷 (옛 코드는 '사구'를 몰라서 타석이 안 끝난 스트라이크처럼 읽는다 — 볼넷으로 읽히는 쪽이 덜 틀린다: 타수에서 빠진다)
//   실책 · 야수선택 · 희생번트 · 희생플라이 → 아웃 (옛 코드에 같은 뜻이 없다: 타수는 맞고 이닝이 조금 틀린다)
const LEGACY_RESULT = {
  '안타': '안타', '내야안타': '안타', '2루타': '2루타', '3루타': '3루타', '홈런': '홈런',
  '볼넷': '볼넷', '사구': '볼넷', '삼진': '삼진',
  '땅볼 아웃': '아웃', '플라이 아웃': '아웃', '라인드라이브 아웃': '아웃', '아웃': '아웃', '병살': '병살', '삼중살': '삼중살',
  '실책': '아웃', '야수선택': '아웃', '희타': '아웃', '희비': '아웃',
};
// 타석 결과(end) → 옛 호환 result. 모르는 값 · '미상'(모름)이면 null — 그 공의 result 는 그대로 둔다 (옛 코드가 타석이 안 끝난 것으로 읽는 게 맞다)
export const legacyResult = end => LEGACY_RESULT[end] || null;

// 투구 자체의 결과(pr, 없으면 옛 result) → 화면 · 엑셀 이름
const PR_LABEL = { '스트라이크': '스트라이크(구분 없음)' };   // P1 전 입력은 헛스윙/루킹을 나누지 않았다
export const prLabel = p => { const r = p && (p.pr || p.result); return PR_LABEL[r] || r || ''; };
// 이닝이 비어 있는 옛 기록은 '미기록'
export const innLabel = v => (v ? String(v) : '미기록');
// 이 앱이 아는 기록 형식. 더 새 버전 앱이 만든 투구(v 가 더 크거나 모르는 결과값)를 만나면 화면 · 엑셀이 새로고침을 권한다 — 조용히 잘못 읽지 않게
export const SCHEMA_V = 2;
const KNOWN_PR = new Set(['볼', '스트라이크', '헛스윙', '루킹', '파울', '타격됨', '사구']);
export const isNewerData = pitches => (pitches || []).some(p => p && ((Number(p.v) || 0) > SCHEMA_V
  || (p.end != null && !VALID_END.has(p.end)) || (p.v >= 2 && p.pr != null && !KNOWN_PR.has(p.pr))));

const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const sameBatter = (p, batter) => (sameId(p.bid, batter.id) || (p.bid == null && p.batter != null && p.batter === batter.name));

// ── 투구 하나 읽기 ───────────────────────────────────────────
// 'ball' | 'hbp' | 'strike' | 'foul' | 'inplay' | null(모르는 값)
export function kindOf(p) {
  const r = p && (p.pr || p.result);   // v2 는 pr(투구 자체의 결과), v1 은 result
  if (r === '볼' || r === '볼넷') return 'ball';
  if (r === '사구') return 'hbp';
  if (r === '스트라이크' || r === '헛스윙' || r === '루킹' || r === '삼진') return 'strike';
  if (r === '파울') return 'foul';
  if (r === '타격됨' || (r in LEGACY_END)) return 'inplay';
  return null;
}
// 이 투구로 끝난 타석의 결과 (없으면 null). v2 는 end 만, v1 은 end(수정 화면이 채운 것) → 옛 result 순.
export function endOf(p) {
  if (!p) return null;
  if (p.end != null) return p.end;
  if (p.v >= 2) return null;
  return LEGACY_END[p.result] || null;
}
// 스트라이크% 기준: 볼·사구를 뺀 모든 공 (파울·인플레이 포함) — 앱·엑셀 모두 같은 정의
export const isStrikePitch = p => { const k = kindOf(p); return k !== 'ball' && k !== 'hbp'; };
export function pitchInfo(p) {
  const end = endOf(p), k = kindOf(p);
  return {
    kind: k, end,
    strike: k !== 'ball' && k !== 'hbp', ball: k === 'ball' || k === 'hbp',
    hit: HIT.includes(end), k: end === '삼진', bb: end === '볼넷',
    inPlay: IN_PLAY.includes(end),
  };
}

// ── 볼카운트 ─────────────────────────────────────────────────
// 2스트라이크 이후 파울은 카운트를 유지한다
function step(c, kind) {
  if (kind === 'ball') return { b: c.b + 1, s: c.s };
  if (kind === 'strike') return { b: c.b, s: c.s + 1 };
  if (kind === 'foul') return { b: c.b, s: c.s < 2 ? c.s + 1 : c.s };
  return c;
}
export const countOf = pitches => pitches.reduce((c, p) => step(c, kindOf(p)), { b: 0, s: 0 });
const autoEnd = c => (c.b >= 4 ? '볼넷' : c.s >= 3 ? '삼진' : null);

// 투구 목록 끝에서 같은 타석(pa)에 속한 v2 투구들
function tailRun(pitches) {
  const last = pitches[pitches.length - 1];
  if (!last || !(last.v >= 2) || last.pa == null) return [];
  const run = [];
  for (let i = pitches.length - 1; i >= 0 && pitches[i].v >= 2 && pitches[i].pa === last.pa; i--) run.unshift(pitches[i]);
  return run;
}
const batterOf = run => ({ bid: (run.find(p => p.bid != null) || {}).bid ?? null, batter: (run.find(p => p.batter) || {}).batter ?? null });

// 아직 끝나지 않은 v2 타석 (없으면 null) — { pa, bid, batter, pitches, b, s }
export function openPA(pitches) {
  const last = pitches[pitches.length - 1];
  if (!last || last.end != null) return null;
  const run = tailRun(pitches);
  if (!run.length) return null;
  const c = countOf(run);
  return { pa: last.pa, ...batterOf(run), pitches: run, b: c.b, s: c.s };
}

// 입력 화면용 현재 상태: idle(새 타석) | open(진행 중) | ended(방금 끝남 — blocked 면 타자를 바꿔야 다음 공을 받는다)
export function stateOf(pitches, batter, newPA) {
  const open = openPA(pitches);
  if (open) return { mode: 'open', b: open.b, s: open.s, n: open.pitches.length, batter: open.batter };
  const run = tailRun(pitches), last = run[run.length - 1];
  if (last && last.end != null) {
    return { mode: 'ended', end: last.end, nk: !!last.nk, n: run.length, batter: batterOf(run).batter,
      blocked: !newPA && !!batter && sameBatter(last, batter) };
  }
  return { mode: 'idle', b: 0, s: 0, n: 0, batter: null };
}

// 투구 하나를 받아 저장할 필드를 정한다 (저장은 호출한 쪽).
//   input = '볼' | '헛스윙' | '루킹' | '스트라이크'(구분 없음) | '파울' | 타석 결과 값(END_CHOICES)
//   ctx   = { batter: { id, name } | null, newPA: 같은 타자의 다음 타석임을 사용자가 확인했는지, id: 새 투구 id }
// 돌려주는 값: { fields: { v, pa, bid, pr, result, end? } } 또는 { blocked: 'ended' | 'unknown' }   (result = 옛 호환 값, 위 머리말 참고)
//   · 4번째 볼 → 볼넷, 3번째 스트라이크 → 삼진으로 자동 종료. 끝난 타석에 같은 타자로 공을 더 넣는 것은 막는다 → 5볼 · 4스트라이크가 입력 단계에서 불가능하다.
//   · 타자가 바뀌었는데 앞 타석이 안 끝나 있으면 새 타석으로 시작한다 (앞 타석은 미기록으로 남아 경고에 잡힌다 — 화면은 그 전에 결과를 요구한다)
export function nextPitch(pitches, input, ctx) {
  const batter = ctx.batter || null;
  const open = openPA(pitches);
  let c = { b: 0, s: 0 }, pa = ctx.id, bid = batter ? batter.id : null;
  if (open) {
    const other = batter && open.bid != null && !sameId(open.bid, batter.id);
    if (!other) { c = { b: open.b, s: open.s }; pa = open.pa; if (bid == null) bid = open.bid; }
  } else {
    const run = tailRun(pitches), last = run[run.length - 1];
    if (last && last.end != null && !ctx.newPA && batter && sameBatter(last, batter)) return { blocked: 'ended' };
  }
  let pr, end = null;
  if (input === '볼' || input === '헛스윙' || input === '루킹' || input === '스트라이크' || input === '파울') {
    pr = input;
    end = autoEnd(step(c, kindOf({ pr })));
  } else if (VALID_END.has(input) && input !== UNKNOWN) {
    end = input;
    pr = PITCH_OF_END[end] || '타격됨';
  } else return { blocked: 'unknown' };
  const fields = { v: 2, pa, bid, pr, result: end ? legacyResult(end) : (pr === '헛스윙' || pr === '루킹' ? '스트라이크' : pr) };   // 옛 코드는 헛스윙 · 루킹을 모른다
  if (end) fields.end = end;
  return { fields };
}

// ── 타석 묶기 ────────────────────────────────────────────────
// 한 번의 등판(투구 순서)을 타석으로 묶는다. 돌려주는 타석:
//   { pa, v2, batter, bid, pitches, end, nk, b, s, reached3B, reached2S, abnormal }
//   end = 타석 결과 (없으면 null = 결과 미기록) · abnormal = 불가능한 카운트(볼 4개 이상인데 4번째 공이 볼넷이 아님 / 스트라이크 3개인데 삼진이 아님)
export function groupPA(pitches) {
  const out = [];
  let cur = null;
  const close = () => { if (cur) { out.push(_finish(cur)); cur = null; } };
  (pitches || []).forEach(p => {
    const v2 = p.v >= 2 && p.pa != null;
    if (cur && (v2 ? (!cur.v2 || cur.pa !== p.pa) : (cur.v2 || (p.batter && cur.batter && p.batter !== cur.batter)))) close();
    if (!cur) cur = { pa: v2 ? p.pa : p.id, v2, batter: null, bid: null, pitches: [], end: null, nk: false };
    cur.pitches.push(p);
    if (!cur.batter && p.batter) cur.batter = p.batter;
    if (cur.bid == null && p.bid != null) cur.bid = p.bid;
    const e = endOf(p);
    if (e != null) { cur.end = e; cur.nk = !!p.nk; close(); }
  });
  close();
  return out;
}
function _finish(x) {
  let c = { b: 0, s: 0 }, r3 = false, r2 = false, abn = false;
  const n = x.pitches.length;
  x.pitches.forEach((p, i) => {
    c = step(c, kindOf(p));
    const last = i === n - 1 && x.end != null;
    if (!last) { if (c.b >= 3) r3 = true; if (c.s >= 2) r2 = true; }
    if (c.b >= 4 && !(i === n - 1 && x.end === '볼넷')) abn = true;
    if (c.s >= 3 && !(i === n - 1 && x.end === '삼진')) abn = true;
  });
  return { ...x, b: c.b, s: c.s, reached3B: r3, reached2S: r2, abnormal: abn };
}

// ── 타구 ↔ 투구 기록 연결 (P2) ───────────────────────────────
// 연결은 타구 기록(타석 a)에 한 번만 적는다: a.pa = 투구 기록 타석 id (그 타석 첫 공의 id), a.pid = 투수 id.
// 투수 · 손 · 카운트 · 구종 · 이닝 · 결과는 여기서 투구 기록을 읽어 돌려준다 — 타구 기록에 복사하지 않는다.
// pitchers = 그 경기의 투수 목록. 못 찾으면 null (연결이 없거나 투구 기록이 지워짐)
export function linkOf(a, pitchers) {
  if (!a || a.pa == null) return null;
  const key = String(a.pa);
  for (const p of pitchers || []) {
    const ps = (p && p.pitches || []).filter(x => x && x.v >= 2 && x.pa != null && String(x.pa) === key);
    if (!ps.length) continue;
    const last = ps[ps.length - 1];
    return { pitcher: p.name || '', pid: p.id, hand: p.hand || null, pa: a.pa, pitches: ps, end: endOf(last), nk: !!last.nk,
      count: countOf(ps.slice(0, -1)), pt: last.pt || null, inning: last.inning || null };
  }
  return null;
}
export const isInPlayEnd = end => IN_PLAY.includes(end);

// ── 아웃 ─────────────────────────────────────────────────────
export const outsOfPA = x => (x.end === '삼진' && x.nk ? 0 : OUTS[x.end] || 0);   // 낫아웃 출루는 0
// 반 이닝(마지막 공의 inning 값이 같은 타석)의 아웃 수 — 투수가 바뀌어도 이어서 센다. lists = 투수별 투구 목록들
export function outsInInning(lists, inning) {
  let n = 0;
  (lists || []).forEach(ps => groupPA(ps).forEach(x => {
    const last = x.pitches[x.pitches.length - 1];
    if (x.end && last && last.inning === inning) n += outsOfPA(x);
  }));
  return n;
}

// ── 투수 지표 ────────────────────────────────────────────────
// apps = [{ pitches, current? }] (등판 한 번 = 한 줄). 앱 투수 탭 · 분석 엑셀 · 옛 엑셀 모두 이 값을 쓴다.
//   상대 타석(pa) = 결과가 기록된 타석 · 타수(ab) = 타석 − 볼넷 − 사구 − 희생번트 − 희생플라이
//   피안타율 = 피안타 / 타수 · 볼넷% = 볼넷 / 타석 · 삼진% = 삼진 / 타석 · 타자당 투구 = 결과가 기록된 타석의 투구 수 / 그 타석 수
//   결과가 없거나 '미상'인 타석은 위 비율의 분모에서 뺀다 (unrec). 지금 기록 중인 타석(inProgress)은 미기록으로 세지 않는다.
//   초구 S% · 3볼까지 간 타자는 타석의 공 순서만 보므로 모든 타석을 센다.
export function calcPitching(apps) {
  const pitches = apps.flatMap(a => a.pitches);
  const pas = [];
  apps.forEach(a => {
    const g = groupPA(a.pitches);
    const tail = g[g.length - 1];
    if (a.current && tail && tail.v2 && tail.end == null) tail.inProgress = true;
    pas.push(...g);
  });
  const done = pas.filter(x => x.end && x.end !== UNKNOWN);
  const unrec = pas.filter(x => (!x.end || x.end === UNKNOWN) && !x.inProgress);
  const abnormal = pas.filter(x => x.abnormal);
  const n = pitches.length;
  const strikes = pitches.filter(isStrikePitch).length;
  const cnt = res => done.filter(x => x.end === res).length;
  const h = done.filter(x => HIT.includes(x.end)).length;
  const hr = cnt('홈런'), k = cnt('삼진'), bb = cnt('볼넷'), hbp = cnt('사구'), sh = cnt('희타'), sf = cnt('희비');
  const outs = done.reduce((s, x) => s + outsOfPA(x), 0);
  const ab = done.length - bb - hbp - sh - sf;
  const tb = done.reduce((s, x) => s + (TB[x.end] || 0), 0);
  const ip = outs / 3;
  const first = pas.filter(x => x.pitches.length);
  return {
    n, strikes, pa: done.length, h, hr, k, bb, hbp, sh, sf, outs, ab, tb,
    sPct: n ? strikes / n : 0,
    fsPct: first.length ? first.filter(x => isStrikePitch(x.pitches[0])).length / first.length : 0,
    kRate: done.length ? k / done.length : 0,
    bbRate: done.length ? bb / done.length : 0,
    avg: ab ? h / ab : 0,
    slg: ab ? tb / ab : 0,
    whip: ip ? (bb + h) / ip : null,
    fip: ip >= 1 ? (13 * hr + 3 * (bb + hbp) - 2 * k) / ip + FIP_C : null,
    ppa: done.length ? done.reduce((s, x) => s + x.pitches.length, 0) / done.length : 0,
    r3b: pas.length ? pas.filter(x => x.reached3B).length / pas.length : 0,
    twoS: pas.filter(x => x.reached2S),
    pas, done, unrec, abnormal, pitches,
    newer: isNewerData(pitches),   // 이 앱보다 새 버전이 만든 기록 → 경고 문구
  };
}
export const FIP_C = 3.10;   // FIP 상수 — 리그 평균에 맞춰야 하지만 아마추어 리그 값이 없어 MLB 수준 값으로 가정

// 앱 · 엑셀 공통 경고 문구
export function warnLines(S) {
  const w = [];
  if (S.newer) w.push('이 앱보다 새 버전에서 만든 기록이 있어요 · 앱을 새로고침(업데이트)한 뒤 다시 보세요 — 지금 숫자는 틀릴 수 있어요');
  if (S.unrec.length) w.push(`결과 미기록 ${S.unrec.length}타석 · 지표 왜곡 가능 (상대 타석·피안타율·볼넷%·삼진%·타자당 투구에서 뺐어요)`);
  if (S.abnormal.length) w.push(`카운트 이상 ${S.abnormal.length}타석 · 볼 4개 이상 또는 스트라이크 3개인데 볼넷·삼진이 아닌 타석 (여러 타석이 합쳐졌거나 결과 입력이 빠졌을 수 있어요)`);
  return w;
}

if (typeof window !== 'undefined') {
  window.PitchCalc = { END_CHOICES, END_LABEL, UNKNOWN, SCHEMA_V, legacyResult, prLabel, innLabel, isNewerData, kindOf, endOf, pitchInfo, isStrikePitch, countOf, openPA, stateOf, nextPitch, groupPA, outsOfPA, outsInInning, linkOf, isInPlayEnd, calcPitching, warnLines };
}
