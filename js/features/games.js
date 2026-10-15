// 저장 경기 읽기 — 같은 경기를 여러 번 저장한 사본을 경기 하나로 묶고, 마지막 저장본만 쓴다.
// 저장된 데이터는 절대 고쳐 쓰지 않는다(읽을 때만 묶는다). 불러오기 목록 · 분석 탭 전부 · 팀 승패 · 시즌 카드 · 시즌 선수별 성적 · 전체 엑셀이 이 파일 하나를 쓴다.
//
// 왜 필요한가: 예전 saveGame 은 저장 버튼을 누를 때마다 새 항목을 만들었다(2026-09-26 #40 전까지). 한 경기가 14벌이 되기도 했고,
// 화면마다 사본을 다르게 셌다(어떤 화면은 14배로 부풀리고, 어떤 화면은 타석 id 합집합으로 사본 사이에 지운 타석을 되살렸다).
//
// 같은 경기 = 기록한 순간의 시각을 id 로 가진 타석(id ≥ 1e11, Date.now())을 충분히 공유하는 저장본들.
//   · 겹침이 min(3, 작은 쪽 타석 수)개 이상이고, 겹친 타석의 타자가 80% 이상 같아야 한다 — id 하나가 우연히(엑셀을 한꺼번에 가져올 때 id 가 Date.now()+n 이라
//     1ms 안에서 겹칠 수 있다) 같다고 서로 다른 경기를 합치지 않기 위해서다.
//   · 팀 이름 · 저장일(d) · 라인업은 쓰지 않는다 (사본 사이에 바뀐다: d 는 경기일이 아니라 저장일이다).
//   · 투구 id 는 쓰지 않는다 (clearAll 은 타석만 지우고 투구는 남겨서 다음 경기에 같은 투구가 섞인다). 타석이 하나도 없는 항목끼리만 투구 id 로 묶는다.
//   · 진짜 id 가 없는 항목(공유 링크로 저장한 경기는 id 가 0,1,2…)은 타석 내용(팀 · 타자 · 결과 · 이닝 · 위치 · 타점의 순서)이 정확히 같고 3타석 이상일 때만 같은 경기.
//   · 타석이 없는 항목은 합치지 않는다 (각자 경기).
// 마지막 저장본 = 수정 시각 max(data.ts, sl_cloud_mod[key]) 가 가장 큰 것 (같으면 키 문자열이 큰 것).
//   sl_saves 배열 순서는 쓰지 않는다 — 새 기기가 서버에서 받아 온 경기는 서버가 돌려준 순서로 붙어서 기기마다 다르다.
//   수정 시각은 cloud.js 가 서버 updated_at 으로 올리고 받는 기기가 같은 값으로 기록하므로(_localMod) 기기가 달라도 같은 사본이 뽑힌다.

export const REAL_ID = 1e11;   // 2001-09 의 에폭 ms 이상 = Date.now() 로 만든 id. 0,1,2… 같은 인덱스 id 는 진짜 id 가 아니다
const isReal = id => typeof id === 'number' && isFinite(id) && id >= REAL_ID;
const batterOf = a => String(a.bid != null ? a.bid : a.bname);
const r3 = v => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v == null ? '' : v);
const CURRENT = '__current__';

// ── 순수 로직 ────────────────────────────────────────────────
// entries = [{ key, g(경기 데이터), ms(수정 시각), entry?(sl_saves 항목), current? }]
// → [{ key(마지막 저장본), copies(키 목록, 오래된 순), members, last }]  (경기 순서 = 가장 이른 저장본 시각)
export function groupGames(entries) {
  const n = entries.length;
  const par = entries.map((_, i) => i);
  const find = i => (par[i] === i ? i : (par[i] = find(par[i])));
  const union = (a, b) => { par[find(a)] = find(b); };

  const info = entries.map(e => {
    const g = e.g || {};
    const abs = Array.isArray(g.abs) ? g.abs : [];
    const strong = new Map();
    abs.forEach(a => { if (a && isReal(a.id) && !strong.has(a.id)) strong.set(a.id, batterOf(a)); });
    const pitches = [];
    (Array.isArray(g.pitchers) ? g.pitchers : []).forEach(p => (p && Array.isArray(p.pitches) ? p.pitches : []).forEach(x => { if (x) pitches.push(x); }));
    const pstrong = new Map();
    if (!abs.length) pitches.forEach(x => { if (isReal(x.id) && !pstrong.has(x.id)) pstrong.set(x.id, String(x.batter == null ? '' : x.batter)); });
    return { abs, strong, pstrong };
  });

  // 같은 id 를 공유하는 쌍을 세어, 규칙을 만족하면 합친다
  const link = (idMaps) => {
    const byId = new Map();
    idMaps.forEach((m, i) => m.forEach((_, id) => { let l = byId.get(id); if (!l) byId.set(id, (l = [])); l.push(i); }));
    const pair = new Map();
    byId.forEach((list, id) => {
      for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
        const a = list[x], b = list[y], k = a * n + b;
        let p = pair.get(k); if (!p) pair.set(k, (p = { a, b, n: 0, same: 0 }));
        p.n++; if (idMaps[a].get(id) === idMaps[b].get(id)) p.same++;
      }
    });
    pair.forEach(p => {
      const need = Math.min(3, idMaps[p.a].size, idMaps[p.b].size);
      if (p.n >= need && p.same / p.n >= 0.8) union(p.a, p.b);
    });
  };
  link(info.map(x => x.strong));                                                    // 타석 id
  link(info.map(x => (x.abs.length ? new Map() : x.pstrong)));                       // 타석이 없는 항목끼리만 투구 id

  // 진짜 id 가 하나도 없는 항목: 내용이 정확히 같을 때만
  const fpOwner = new Map();
  entries.forEach((e, i) => {
    const x = info[i];
    if (x.strong.size || x.abs.length < 3) return;
    const g = e.g || {};
    const fp = JSON.stringify([g.th, g.ta, x.abs.map(a => [batterOf(a), a.res, a.inn, a.team, r3(a.x), r3(a.y), a.rbi || 0])]);
    if (fpOwner.has(fp)) union(i, fpOwner.get(fp)); else fpOwner.set(fp, i);
  });

  const groups = new Map();
  entries.forEach((e, i) => { const r = find(i); let l = groups.get(r); if (!l) groups.set(r, (l = [])); l.push(i); });
  const byLast = (a, b) => (a.ms - b.ms) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);   // 수정 시각 → 키 (어느 기기에서나 같은 순서)
  return [...groups.values()].map(idx => {
    const members = idx.map(i => entries[i]).sort(byLast);
    const last = members[members.length - 1];
    return { key: last.key, copies: members.filter(m => !m.current).map(m => m.key), members, last };
  }).sort((p, q) => {
    const pf = Math.min(...p.members.map(m => (m.current ? Infinity : m.ms))), qf = Math.min(...q.members.map(m => (m.current ? Infinity : m.ms)));
    return (pf - qf) || (p.key < q.key ? -1 : p.key > q.key ? 1 : 0);
  });
}

// ── 읽기 ─────────────────────────────────────────────────────
function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }

function parseMs(v) {
  if (window._slParseTs) { const t = window._slParseTs(v); return typeof t === 'number' ? t : 0; }   // cloud.js: 숫자 · 로케일 문자열('2026. 5. 17. 오후 4:28:31') 모두
  if (typeof v === 'number' && isFinite(v) && v > 0) return v;
  const p = typeof v === 'string' ? Date.parse(v) : NaN;
  return isFinite(p) ? p : 0;
}
// 수정 시각: cloud.js _localMod 와 같은 값 = max(경기 ts, sl_cloud_mod[key]). 서버 updated_at 도 같은 시계라서 기기가 달라도 같다
function modifiedMs(key, g, entry, mods) {
  let ts = 0;
  if (window._slTsInfo) { const t = window._slTsInfo(g, entry, key); ts = t && t.reliable ? t.ts : 0; }
  else ts = parseMs(g && g.ts) || parseMs(entry && entry.ts) || (/^sl_(\d{12,14})$/.test(key) ? Number(RegExp.$1) : 0);
  const m = mods ? Number(mods[key]) : 0;
  return Math.max(ts, isFinite(m) && m > 0 ? m : 0);
}

// 저장 경기 목록 (+ 지금 기록 중인 경기).
//   현재 경기가 저장본과 같은 경기(타석 id 가 겹침)면 그 경기의 가장 새 사본으로 취급한다 — 지금 화면의 상태가 항상 가장 새롭다.
//   그러면 저장본 + 현재 경기가 두 번 세어지지 않고, 현재 화면에서 지운 타석이 저장본에서 되살아나지도 않는다.
// 각 경기: { key, copies, copyCount, current(저장 안 된 현재 경기), live(현재 화면의 상태), data, entry, saved(마지막 저장본), ms, first(가장 이른 저장 시각),
//            abs, pitchers(다른 경기에 같은 투구 id 가 이미 있으면 뺀 것) }
export function loadGames(opts = {}) {
  const withCurrent = opts.withCurrent !== false;
  const saves = read('sl_saves');
  const mods = read('sl_cloud_mod');
  const seen = new Set();
  const entries = [];
  (Array.isArray(saves) ? saves : []).forEach(s => {
    if (!s || typeof s.key !== 'string' || seen.has(s.key)) return;
    const g = read(s.key);
    if (!g || typeof g !== 'object' || Array.isArray(g)) return;
    seen.add(s.key);
    entries.push({ key: s.key, g, entry: s, ms: modifiedMs(s.key, g, s, mods) });
  });
  if (withCurrent) {
    const AS = window.AS || {};
    const val = id => ((document.getElementById(id) || {}).value || '').trim();
    entries.push({ key: CURRENT, current: true, ms: Infinity, entry: null,
      g: { abs: AS.abs || [], pitchers: AS.pitchers || [], home_lineup: AS.home_lineup || [], away_lineup: AS.away_lineup || [], th: val('tHome'), ta: val('tAway'), hs: +AS.hs || 0, as: +AS.as || 0 } });
  }
  const seenP = new Set();   // 같은 투구가 두 경기에 들어 있으면(경기 사이로 투구가 남은 경우) 먼저 나온 경기에서만 센다
  const uniqP = x => { if (!x || x.id == null) return !!x; if (seenP.has(x.id)) return false; seenP.add(x.id); return true; };
  return groupGames(entries).map(grp => {
    const live = grp.last.current === true;
    const savedMembers = grp.members.filter(m => !m.current);
    const saved = savedMembers[savedMembers.length - 1] || null;
    const data = grp.last.g;
    return {
      key: saved ? saved.key : CURRENT, copies: grp.copies, copyCount: grp.copies.length,
      current: live && !saved, live, data, entry: saved ? saved.entry : null, saved: saved ? { key: saved.key, entry: saved.entry, data: saved.g } : null,
      ms: saved ? saved.ms : 0, first: Math.min(...savedMembers.map(m => m.ms), Infinity),
      abs: Array.isArray(data.abs) ? data.abs : [],
      pitchers: (Array.isArray(data.pitchers) ? data.pitchers : []).map(p => ({ ...p, pitches: (Array.isArray(p.pitches) ? p.pitches : []).filter(uniqP) })),
    };
  });
}

// 키가 속한 경기의 모든 저장본 키 (삭제 · 요약용). 없으면 [key]
export function copiesOf(key) {
  const g = loadGames({ withCurrent: false }).find(x => x.copies.includes(key));
  return g ? g.copies : [key];
}

if (typeof window !== 'undefined') window.SLGames = { REAL_ID, groupGames, loadGames, copiesOf };
