// 동작 분석 — 무거운 데이터(프레임 좌표 · 영상 파일)를 브라우저의 IndexedDB(sl_motion)에 둔다. 이 DB 를 여는 곳은 이 파일뿐이다
//  · localStorage(전체 5MB · 경기 기록 sl_saves 와 같이 씀)에 넣으면 경기 기록 저장을 막을 수 있어서 따로 둔다. 서버로는 아무것도 보내지 않는다
//  · clips: { id(기록 id), hz, start, aspect, slow, eventIndex, n, found, world, image } · videos: { sig, name, size, blob }
const NAME = 'sl_motion', VERSION = 1, CLIPS = 'clips', VIDEOS = 'videos';
let opening = null;

function open() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(CLIPS)) req.result.createObjectStore(CLIPS, { keyPath: 'id' });
        if (!req.result.objectStoreNames.contains(VIDEOS)) req.result.createObjectStore(VIDEOS, { keyPath: 'sig' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { opening = null; reject(req.error); };
    });
  }
  return opening;
}

// 한 저장소에 요청 하나를 보내고, 거래가 끝난 뒤 그 결과를 돌려준다
async function run(store, mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode), req = work(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(tx.error || req.error);
  });
}

export const putClip = (clip) => run(CLIPS, 'readwrite', (s) => s.put(clip));
export const getClip = (id) => run(CLIPS, 'readonly', (s) => s.get(id));
export const deleteClip = (id) => run(CLIPS, 'readwrite', (s) => s.delete(id));
export const clipIds = () => run(CLIPS, 'readonly', (s) => s.getAllKeys());
export const putVideo = (video) => run(VIDEOS, 'readwrite', (s) => s.put(video));
export const getVideo = (sig) => run(VIDEOS, 'readonly', (s) => s.get(sig));
export const deleteVideo = (sig) => run(VIDEOS, 'readwrite', (s) => s.delete(sig));
export const videoSigs = () => run(VIDEOS, 'readonly', (s) => s.getAllKeys());

// 이 사이트가 더 쓸 수 있는 저장 공간(바이트). 브라우저가 알려 주지 않으면 null
export async function freeBytes() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  const { quota, usage } = await navigator.storage.estimate();
  return typeof quota === 'number' && typeof usage === 'number' ? quota - usage : null;
}
