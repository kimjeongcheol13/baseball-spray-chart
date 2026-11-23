// 동작 분석 — 저장한 기록을 기기 사이에 잇는다(Supabase 표 public.user_motion · sql/18_user_motion.sql)
//  · 로그인은 SprayLab 앱의 것을 그대로 쓴다(같은 사이트라 같은 저장 열쇠의 로그인 정보를 읽는다). 로그인 전에는 아무것도 보내지 않는다
//  · 보내는 것: 숫자 기록(entry)과 다시 보기용 관절 좌표(clip). 영상과 영상 파일 정보는 보내지 않는다 — 다른 기기에서는 「영상 다시 고르기」
//  · 지운 기록은 내용을 비우고 「지움」 표시만 남겨 다른 기기에서도 지운다
//  · 계산(planSync · encodeClip · decodeClip · toCloudEntry · fromCloudRow)은 순수 함수라 테스트로 확인하고, 서버와 주고받는 부분은 얇게 둔다
const SURL = 'https://bsmbrngkpsdmbwoqcrps.supabase.co';
// 공개용(anon) 열쇠 — 앱(js/cloud.js)과 같은 값. 표는 RLS 로 로그인한 본인 행만 열린다
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWJybmdrcHNkbWJ3b3FjcnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTE1OTcsImV4cCI6MjA5NDk4NzU5N30.kVkKSvrXMtVOEtTNEELr8_9bQret60pTngFRsHgY5nk';
const SESSION_KEY = 'sl_cloud_session';   // 앱의 로그인 저장 열쇠(js/cloud.js) — 이름을 바꾸지 않는다
const LIB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';   // 앱(index.html)과 같은 주소
const TABLE = 'user_motion';
const LOCAL_ONLY = ['video', 'hasData', 'cloud'];   // 이 기기에만 의미가 있는 칸 — 올리지 않는다

let client = null, user = null;

// ── 순수 계산 ───────────────────────────────────────────────
// 이 기기에 앱 로그인 정보가 있는가(없으면 서버 도구를 내려받지도 않는다)
export function hasSession(storage = globalThis.localStorage) {
  try { return Boolean(storage && storage.getItem(SESSION_KEY)); } catch (err) { return false; }
}

const bytesToB64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const b64ToBytes = (b64) => { const s = atob(b64), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
const bytesOf = (typed) => new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);

// IndexedDB 의 다시 보기 데이터(숫자 배열 묶음) → 서버에 넣을 수 있는 모양(JSON)
export function encodeClip(clip) {
  return { v: 1, hz: clip.hz, start: clip.start, aspect: clip.aspect, slow: clip.slow, eventIndex: clip.eventIndex ?? null, n: clip.n,
    found: bytesToB64(bytesOf(clip.found)), world: bytesToB64(bytesOf(clip.world)), image: bytesToB64(bytesOf(clip.image)) };
}

// 서버의 모양 → IndexedDB 에 넣을 다시 보기 데이터(id 를 붙인다)
export function decodeClip(row, id) {
  const f32 = (b64) => { const b = b64ToBytes(b64); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
  return { id, hz: row.hz, start: row.start, aspect: row.aspect, slow: row.slow, eventIndex: row.eventIndex, n: row.n,
    found: b64ToBytes(row.found), world: f32(row.world), image: f32(row.image) };
}

// 올릴 숫자 기록: 이 기기에만 의미가 있는 칸을 뺀다
export const toCloudEntry = (entry) => Object.fromEntries(Object.entries(entry).filter(([k]) => !LOCAL_ONLY.includes(k)));

// 서버 행 → 이 기기의 기록. 다시 보기 데이터는 서버에 있으면 쓸 수 있다고 표시하고(불러올 때 받는다), 영상은 없다
export const fromCloudRow = (row) => ({ ...row.entry, id: Number(row.entry_id), hasData: row.has_clip !== null && row.has_clip !== undefined, video: null, cloud: true });

// 이 기기 기록 목록과 서버 행 목록 → 할 일 { upload: [기록](올릴 것 · withClip 표시), add: [기록](받을 것), remove: [id](지울 것) }
//  · 서버에 없는 기록은 올린다. 서버에 있는데 다시 보기 데이터가 빠졌고 이 기기에 있으면 그것도 올린다
//  · 서버에만 있는 기록은 받는다. 서버에서 지움 표시된 기록은 이 기기에서도 지운다
export function planSync(local, rows) {
  const byId = new Map(rows.map((r) => [Number(r.entry_id), r])), mine = new Set(local.map((e) => e.id));
  const upload = [], add = [], remove = [];
  for (const e of local) {
    const r = byId.get(e.id);
    if (!r) upload.push({ entry: e, withClip: Boolean(e.hasData) });
    else if (r.deleted) remove.push(e.id);
    else if (e.hasData && (r.has_clip === null || r.has_clip === undefined)) upload.push({ entry: e, withClip: true });
  }
  for (const r of rows) if (!r.deleted && !mine.has(Number(r.entry_id))) add.push(fromCloudRow(r));
  return { upload, add, remove };
}

// 로그인한 사람을 알아볼 수 있을 만큼만 보이는 이메일(앞 두 글자 · 도메인)
export const maskEmail = (email) => {
  const m = /^([^@]{0,2})[^@]*(@.*)$/.exec(email || '');
  return m ? `${m[1]}…${m[2]}` : '로그인됨';
};

// ── 서버와 주고받기 ────────────────────────────────────────────
function loadLibrary() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement('script'), { src: LIB_URL, async: true });
    s.onload = () => resolve(); s.onerror = () => reject(new Error('서버 도구를 내려받지 못함'));
    document.head.appendChild(s);
  });
}

// 로그인한 사람 → { id, email } | null(로그인 안 함). 서버 도구를 못 받으면 예외
export async function connect() {
  if (!hasSession()) { user = null; return null; }
  await loadLibrary();
  client = client || window.supabase.createClient(SURL, SKEY, { auth: { persistSession: true, storageKey: SESSION_KEY, flowType: 'pkce' } });
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  user = data && data.user ? { id: data.user.id, email: data.user.email || '' } : null;
  return user;
}

export const signedIn = () => Boolean(client && user);

const check = (res) => { if (res && res.error) throw res.error; return res && res.data; };

// 내 기록 행 전부(다시 보기 데이터 본문은 빼고 있는지만)
export async function fetchRows() {
  return check(await client.from(TABLE).select('entry_id, entry, deleted, updated_at, has_clip:clip->n').eq('user_id', user.id)) || [];
}

// 기록 하나를 올린다. clip 이 없으면 서버의 다시 보기 데이터는 건드리지 않는다
export async function uploadEntry(entry, clip = null) {
  const row = { user_id: user.id, entry_id: entry.id, entry: toCloudEntry(entry), deleted: false };
  if (clip) row.clip = encodeClip(clip);
  check(await client.from(TABLE).upsert(row, { onConflict: 'user_id,entry_id' }));
}

// 지웠다는 표시만 남긴다(내용은 비운다)
export async function markDeleted(id) {
  check(await client.from(TABLE).upsert({ user_id: user.id, entry_id: id, entry: {}, clip: null, deleted: true }, { onConflict: 'user_id,entry_id' }));
}

// 서버의 다시 보기 데이터 → IndexedDB 모양 | null
export async function fetchClip(id) {
  const rows = check(await client.from(TABLE).select('clip').eq('user_id', user.id).eq('entry_id', id).limit(1)) || [];
  return rows[0] && rows[0].clip ? decodeClip(rows[0].clip, id) : null;
}
