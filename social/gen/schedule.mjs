// 매주 요일 칸(SLOTS) → 날짜표. build.mjs 가 쓴다. `node social/gen/schedule.mjs` = 자체 확인
//   fixed   = 직접 적은 날 (items.js DAYS — 이미 올라간 날 포함)
//   oldDays = 전 manifest 의 days — from ~ 오늘(KST)은 이미 정해져 올라갔으니 그대로 둔다
//             (지난 빈 칸에 새 것을 끼우면 영영 안 올라가고, 바꾸면 올린 것을 또 올린다)
//   fmt     = id → 'reel' | 'carousel'
import { pathToFileURL } from 'node:url';

const DAY = 864e5, iso = t => new Date(t).toISOString().slice(0, 10), at = s => Date.parse(s + 'T00:00:00Z');

export function expand(SL, fixed, oldDays, fmt, today) {
  const days = { ...fixed }, gaps = {}, from = at(SL.from), t0 = at(today);
  for (let t = from; t <= t0; t += DAY) if (oldDays[iso(t)]) days[iso(t)] = oldDays[iso(t)];
  const used = new Set(Object.values(days).flat());
  const q = (list, f) => list.filter(id => fmt[id] === f && !used.has(id));
  const Q = { pool: { reel: q(SL.pool, 'reel'), carousel: q(SL.pool, 'carousel') }, new: { reel: q(SL.new, 'reel'), carousel: q(SL.new, 'carousel') } };
  const start = Math.max(from, t0 + DAY), end = start + SL.weeks * 7 * DAY;
  for (let t = start; t < end; t += DAY) {
    const ids = [], miss = [];
    for (const s of SL.week[(new Date(t).getUTCDay() + 6) % 7]) {   // 0 = 월
      const [f, src] = s.split('/'), id = (src === 'pool' && Q.pool[f].shift()) || Q.new[f].shift();
      id ? ids.push(id) : miss.push(f);
    }
    if (ids.length) days[iso(t)] = ids;
    if (miss.length) gaps[iso(t)] = miss;
  }
  const all = Object.values(days).flat(), dup = all.filter((id, i) => all.indexOf(id) !== i);
  if (dup.length) throw new Error('같은 것을 두 번 올림: ' + dup.join(' '));
  return { days, gaps };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const assert = (c, m) => { if (!c) throw new Error('FAIL ' + m); };
  const fmt = { p1: 'reel', p2: 'reel', pc: 'carousel', n1: 'reel', nc: 'carousel', n2: 'reel' };
  const SL = { from: '2026-11-16', weeks: 1, week: [['reel/pool'], ['reel/new', 'carousel/new'], ['reel/pool'], [], [], ['reel/pool', 'carousel/pool'], ['reel/new']], pool: ['p1', 'pc', 'p2'], new: ['n1', 'nc'] };
  let r = expand(SL, { '2026-11-09': ['p1'] }, {}, fmt, '2026-11-08');
  assert(r.days['2026-11-16'][0] === 'p2', '이미 올린 p1 건너뜀');
  assert(r.days['2026-11-17'].join() === 'n1,nc', '화 = 릴스 → 캐러셀');
  assert(!r.days['2026-11-18'] && r.gaps['2026-11-18'].join() === 'reel', '수: 풀·새 릴스 없음 → 빈 칸');
  assert(r.days['2026-11-21'].join() === 'pc' && r.gaps['2026-11-21'].join() === 'reel', '토: 캐러셀만, 릴스 빈 칸');
  assert(r.gaps['2026-11-22'].join() === 'reel', '일: 새 릴스 없음');
  // 11-19 에 새 릴스 n2 추가 후 다시 빌드 — 지난 화(11-17)는 그대로, 빈 칸은 앞으로만 채운다
  r = expand({ ...SL, new: ['n1', 'nc', 'n2'] }, { '2026-11-09': ['p1'] }, r.days, fmt, '2026-11-19');
  assert(r.days['2026-11-17'].join() === 'n1,nc' && !r.days['2026-11-18'], '지난 날은 전 manifest 그대로');
  assert(r.days['2026-11-21'].join() === 'n2,pc', '풀 떨어진 토 릴스 칸 = 새 콘텐츠');
  console.log('schedule ok');
}
