// 동작 분석 화면 — 기록 잇기(sync.js)를 화면에 연결한다: 열 때 맞추기 · 저장 · 지우기 · 다시 보기 데이터 받기
import { hasSession, connect, signedIn, fetchRows, uploadEntry, markDeleted, fetchClip, planSync, maskEmail } from './sync.js?v=1';
import { loadLog, mergeEntries, removeEntry } from './store.js?v=4';
import { getClip, putClip } from './db.js?v=1';
import { el } from './page.js?v=1';
import { renderLog, pruneLibrary } from './page-records.js?v=1';
import { track } from './usage.js?v=1';

const TEXT = {
  off: '「SprayLab 앱」에서 로그인하면 저장한 기록이 휴대폰 · 컴퓨터 사이에 이어져요(숫자와 관절 좌표만 · 영상은 보내지 않아요).',
  busy: '다른 기기와 기록을 맞추는 중…',
  fail: '다른 기기와 기록을 맞추지 못했어요. 이 기기에는 그대로 저장돼 있고, 다음에 열 때 다시 맞춰요.',
};

function showSync(text, withLink = false) {
  el.syncMsg.replaceChildren(text);
  if (!withLink) return;
  const a = Object.assign(document.createElement('a'), { href: 'index.html', textContent: ' 앱에서 로그인하기 →' });
  el.syncMsg.append(a);
}

// 페이지를 열 때: 로그인했으면 받을 것은 받고, 지울 것은 지우고, 올릴 것은 올린다
export async function startSync() {
  if (!hasSession()) { showSync(TEXT.off, true); return; }
  showSync(TEXT.busy);
  try {
    const user = await connect();
    if (!user) { showSync(TEXT.off, true); return; }
    const plan = planSync(loadLog(), await fetchRows());
    if (plan.add.length) mergeEntries(plan.add);
    for (const id of plan.remove) removeEntry(id);
    if (plan.add.length || plan.remove.length) { renderLog(); await pruneLibrary(); }
    for (const u of plan.upload) await uploadEntry(u.entry, u.withClip ? await getClip(u.entry.id).catch(() => null) : null);
    showSync(`${maskEmail(user.email)} 로 로그인됨 · 기록 ${loadLog().length}개가 다른 기기와 이어져 있어요. 영상은 기기마다 「영상 다시 고르기」로 붙여요.`);
    track('motion_sync', { added: plan.add.length, removed: plan.remove.length, uploaded: plan.upload.length });
  } catch (err) {
    console.warn('[motion] 다른 기기와 기록을 맞추지 못함', err);
    showSync(TEXT.fail);
  }
}

// 방금 저장한 기록을 올린다(로그인했을 때만)
export async function syncSaved(id) {
  if (!signedIn()) return;
  const e = loadLog().find((x) => x.id === id);
  if (!e) return;
  try { await uploadEntry(e, e.hasData ? await getClip(id) : null); } catch (err) { console.warn('[motion] 기록을 올리지 못함', err); showSync(TEXT.fail); }
}

// 지운 기록을 다른 기기에서도 지우게 표시한다(로그인했을 때만)
export async function syncRemoved(id) {
  if (!signedIn()) return;
  try { await markDeleted(id); } catch (err) { console.warn('[motion] 지운 것을 알리지 못함', err); showSync(TEXT.fail); }
}

// 다시 보기 데이터: 이 기기에 없고 다른 기기에서 온 기록이면 서버에서 받아 이 기기에 넣는다 → 데이터 | null
export async function clipFor(e) {
  const local = await getClip(e.id);
  if (local || !e.cloud || !e.hasData || !signedIn()) return local || null;
  const clip = await fetchClip(e.id);
  if (clip) await putClip(clip);
  return clip;
}
