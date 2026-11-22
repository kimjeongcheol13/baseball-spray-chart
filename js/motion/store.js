// 동작 분석 — 저장한 기록(sl_motion_log). 이 키를 읽고 쓰는 곳은 이 파일뿐이다
//  · 영상 · 프레임 좌표는 저장하지 않는다. 지표 숫자만 남긴다(기록 하나에 약 300바이트)
const KEY = 'sl_motion_log';
const MAX_ENTRIES = 30;

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

export function removeEntry(id, storage = localStorage) {
  return writeLog(loadLog(storage).filter((e) => e.id !== id), storage);
}

// 같은 종류(타격/투구 · 좌우)의 바로 앞 기록 — 「지난 기록 대비」 비교용
export function previousEntry(list, entry) {
  const i = list.findIndex((e) => e.id === entry.id);
  return list.slice(i + 1).find((e) => e.mode === entry.mode && e.hand === entry.hand) || null;
}
