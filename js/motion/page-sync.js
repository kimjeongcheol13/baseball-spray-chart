// 동작 분석 화면 — 기록 잇기(sync.js)를 화면에 연결한다: 열 때 맞추기 · 저장 · 지우기 · 다시 보기 데이터 · 영상 받기
import { hasSession, connect, signedIn, fetchRows, uploadEntry, markDeleted, fetchClip, planSync, maskEmail, uploadVideo, fetchVideo, unsentVideos } from './sync.js?v=3';
import { cutVideo, canCut } from './cut.js?v=1';
import { loadLog, mergeEntries, removeEntry, updateEntry } from './store.js?v=4';
import { getClip, putClip, getVideo, putVideo } from './db.js?v=1';
import { el, state } from './page.js?v=3';
import { renderLog, pruneLibrary } from './page-records.js?v=4';
import { track } from './usage.js?v=1';

const SEND_KEY = 'sl_motion_send_video';   // 「영상도 다른 기기로 보내기」를 껐는지(이 기기에서만 기억)
const MB1 = (bytes) => (bytes / 1e6).toFixed(1);
const TEXT = {
  off: '「SprayLab 앱」에서 로그인하면 저장한 기록이 휴대폰 · 컴퓨터 사이에 이어져요. 영상은 로그인한 뒤 저장할 때 고를 수 있어요.',
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
    for (const p of plan.patch) updateEntry(p.id, { cloudVideo: p.cloudVideo });
    if (plan.add.length || plan.remove.length || plan.patch.length) { renderLog(); await pruneLibrary(); }
    showSendVideo();
    for (const u of plan.upload) await uploadEntry(u.entry, u.withClip ? await getClip(u.entry.id).catch(() => null) : null);
    showSync(`${maskEmail(user.email)} 로 로그인됨 · 기록 ${loadLog().length}개가 다른 기기와 이어져 있어요. 「영상도 다른 기기로 보내기」를 켜고 저장한 기록은 영상(분석한 구간만)도 함께 보여요.`);
    track('motion_sync', { added: plan.add.length, removed: plan.remove.length, uploaded: plan.upload.length });
    offerOldVideos();
  } catch (err) {
    console.warn('[motion] 다른 기기와 기록을 맞추지 못함', err);
    showSync(TEXT.fail);
  }
}

// 「영상도 다른 기기로 보내기」 칸: 로그인했고 이 브라우저가 영상을 다시 만들 수 있을 때만 보인다. 끈 것은 이 기기에서 기억한다
function showSendVideo() {
  if (!el.sendVideoWrap) return;
  el.sendVideoWrap.hidden = !(signedIn() && canCut());
  try { el.sendVideo.checked = localStorage.getItem(SEND_KEY) !== '0'; } catch (err) { /* 기억 못 해도 기본은 켜짐 */ }
}
export function rememberSendVideo() {
  try { localStorage.setItem(SEND_KEY, el.sendVideo.checked ? '1' : '0'); } catch (err) { /* 무시 */ }
}
const wantVideo = () => Boolean(el.sendVideoWrap && !el.sendVideoWrap.hidden && el.sendVideo.checked);

// 방금 저장한 기록을 올린다(로그인했을 때만). 숫자 · 좌표를 먼저 올리고, 영상을 보내기로 했으면 분석 구간을 다시 만들어 뒤따라 올린다
export async function syncSaved(id) {
  if (!signedIn()) return;
  const e = loadLog().find((x) => x.id === id);
  if (!e) return;
  try { await uploadEntry(e, e.hasData ? await getClip(id) : null); } catch (err) { console.warn('[motion] 기록을 올리지 못함', err); showSync(TEXT.fail); return; }
  const file = state.file;
  if (!wantVideo() || !file || !e.range) return;
  const before = el.saveMsg.textContent;
  el.saveMsg.textContent = `${before} 영상을 다른 기기로 보내는 중…(분석한 구간만)`;
  try {
    const cut = await cutVideo(file.blob, e.range);
    const cloudVideo = await uploadVideo(id, cut);
    updateEntry(id, { cloudVideo });
    await uploadEntry({ ...e, cloudVideo }, null);
    el.saveMsg.textContent = `${before} 영상(${MB1(cloudVideo.size)}MB · 분석한 구간만)도 다른 기기로 보냈어요.`;
    track('motion_video_sent', { type: cloudVideo.type });
    renderLog();
  } catch (err) {
    console.warn('[motion] 영상을 보내지 못함', err);
    el.saveMsg.textContent = `${before} 영상은 다른 기기로 보내지 못했어요(기록과 좌표는 보냈어요).`;
  }
}

// 영상 보내기 기능 전에 저장한 기록: 이 기기에 원본 영상이 있으면 「영상 보내기」 버튼을 붙인다(누를 때만 보낸다 — 그때는 보낸다고 약속하지 않았던 기록이라)
function offerOldVideos() {
  const list = unsentVideos(loadLog());
  if (!list.length || !canCut()) return;
  const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'mo-btn', textContent: `이 기기 영상 ${list.length}개 다른 기기로 보내기` });
  const note = document.createElement('span');
  note.textContent = ' 전에 저장한 기록이라 영상은 아직 이 기기에만 있어요(분석한 구간만 줄여 보내요 · 하나에 몇 초).';
  btn.addEventListener('click', () => sendOldVideos(list, btn, note));
  el.syncMsg.append(document.createElement('br'), btn, note);
}

async function sendOldVideos(list, btn, note) {
  btn.disabled = true;
  let sent = 0, failed = 0;
  for (const e of list) {
    note.textContent = ` 보내는 중… ${sent + failed + 1}/${list.length}`;
    try {
      const v = await getVideo(e.video.sig);
      if (!v) { failed++; continue; }
      const cut = await cutVideo(v.blob, e.range);
      const cloudVideo = await uploadVideo(e.id, cut);
      updateEntry(e.id, { cloudVideo });
      await uploadEntry({ ...e, cloudVideo }, null);
      sent++;
    } catch (err) {
      console.warn('[motion] 전에 저장한 영상을 보내지 못함', err);
      failed++;
    }
  }
  track('motion_video_backfill', { sent, failed });
  btn.remove();
  note.textContent = ` 영상 ${sent}개를 보냈어요.${failed ? ` ${failed}개는 보내지 못했어요(이 기기에 영상이 없거나 연결이 끊겼어요).` : ''} 다른 기기에서 페이지를 새로고침하면 보여요.`;
  renderLog();
}

// 「영상 다시 고르기」로 붙여 이 기기에 저장한 영상을 다른 기기로도 보낸다(로그인 · 「영상도 다른 기기로 보내기」 켜짐일 때만) → 알림 문장 | ''
export async function syncAttached(id) {
  const e = loadLog().find((x) => x.id === id), file = state.file;
  if (!wantVideo() || !e || !file || !e.range || e.cloudVideo) return '';
  try {
    const cut = await cutVideo(file.blob, e.range);
    const cloudVideo = await uploadVideo(id, cut);
    updateEntry(id, { cloudVideo });
    await uploadEntry({ ...e, cloudVideo }, null);
    renderLog();
    return `다른 기기로도 보냈어요(${MB1(cloudVideo.size)}MB · 분석한 구간만).`;
  } catch (err) {
    console.warn('[motion] 붙인 영상을 보내지 못함', err);
    return '다른 기기로는 보내지 못했어요.';
  }
}

// 불러올 영상: 이 기기에 저장한 것 → 없으면 다른 기기에서 보낸 것을 받아 이 기기에 넣는다 → { blob, name, size, sig, offset } | null
//  · offset: 받은 영상의 0초가 원래 영상의 몇 초인지. 이 기기에서 저장한 영상은 0
export async function videoFor(e, onFetch) {
  if (e.video) {
    const v = await getVideo(e.video.sig);
    if (v) return { ...v, offset: e.video.offset || 0 };
  }
  if (!e.cloudVideo || !signedIn()) return null;
  try {
    if (onFetch) onFetch();
    const blob = await fetchVideo(e.cloudVideo);
    const ref = { sig: `cloud:${e.id}`, name: '다른 기기에서 받은 영상', size: blob.size, offset: e.cloudVideo.offset || 0 };
    await putVideo({ sig: ref.sig, name: ref.name, size: ref.size, blob });
    updateEntry(e.id, { video: ref });
    e.video = ref;
    return { ...ref, blob };
  } catch (err) {
    console.warn('[motion] 다른 기기의 영상을 받지 못함', err);
    return null;
  }
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
