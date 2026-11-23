// 동작 분석 — 저장한 기록(sl_motion_log). 이 키를 읽고 쓰는 곳은 이 파일뿐이다
//  · 여기에는 목록(선수 이름 · 지표 숫자 · 다시 보기 데이터가 있는지)만 둔다 — 기록 하나에 약 0.5KB. 프레임 좌표 · 영상은 db.js(IndexedDB)
const KEY = 'sl_motion_log';
const MAX_ENTRIES = 200;   // 넘으면 가장 오래된 기록부터 빠진다(그 기록의 좌표 · 영상은 app.js pruneLibrary 가 정리)

// 저장된 기록 배열(최신이 앞). 저장소를 못 읽거나 내용이 깨졌으면 빈 배열
export function loadLog(storage = localStorage) {
  let raw;
  try { raw = storage.getItem(KEY); } catch (e) { console.warn('[motion] 기록을 읽지 못했어요', e); return []; }
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((e) => e && e.id && e.metrics) : [];
  } catch (e) { console.warn('[motion] 저장된 기록 형식이 올바르지 않아요', e); return []; }
}

function writeLog(list, storage) {
  try { storage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { console.warn('[motion] 기록을 저장하지 못했어요', e); return false; }
}

// entry = { id, at, mode, hand, fps, quality, sequence, metrics } → 저장 성공 여부
export function addEntry(entry, storage = localStorage) {
  return writeLog([entry].concat(loadLog(storage)).slice(0, MAX_ENTRIES), storage);
}

// 다른 기기에서 받은 기록을 넣는다(같은 id 는 이 기기 것을 둔다). 날짜가 최신인 것부터 다시 줄 세운다 → 저장 성공 여부
export function mergeEntries(entries, storage = localStorage) {
  const list = loadLog(storage), have = new Set(list.map((e) => e.id));
  const merged = list.concat(entries.filter((e) => e && e.id && e.metrics && !have.has(e.id)));
  merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return writeLog(merged.slice(0, MAX_ENTRIES), storage);
}

export function removeEntry(id, storage = localStorage) {
  return writeLog(loadLog(storage).filter((e) => e.id !== id), storage);
}

// 기록 하나의 일부 값만 바꾼다(다시 보기 데이터를 저장한 뒤 표시를 붙일 때) → 저장 성공 여부
export function updateEntry(id, patch, storage = localStorage) {
  return writeLog(loadLog(storage).map((e) => (e.id === id ? { ...e, ...patch } : e)), storage);
}

// 같은 종류(타격/투구 · 좌우)의 바로 앞 기록 — 「지난 기록 대비」 비교용
export function previousEntry(list, entry) {
  const i = list.findIndex((e) => e.id === entry.id);
  return list.slice(i + 1).find((e) => e.mode === entry.mode && e.hand === entry.hand) || null;
}
