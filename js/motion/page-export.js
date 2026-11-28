// 동작 분석 화면 — 「측정 숫자 내보내기(JSON)」 버튼: 지금 분석 + 같은 선수의 저장한 기록을 파일 하나로 내려받는다
//  · 서버로는 아무것도 보내지 않는다. 단계 시각은 이 기기 IndexedDB 에 있는 관절 좌표로 다시 찾는다(다른 기기에서 온 좌표는 받으러 가지 않는다)
import { track } from './usage.js?v=1';
import { analyzeMotion } from './analyze.js?v=5';
import { roundSpread } from './spread.js?v=2';
import { summarize } from './metrics.js?v=2';
import { loadLog } from './store.js?v=4';
import { unpackFrames } from './library.js?v=1';
import { getClip } from './db.js?v=1';
import { samePlayer, savedMatch, playerIdFor, buildExport, exportFileName } from './export.js?v=2';
import { el, state } from './page.js?v=4';

// 저장한 기록의 단계 시각용: 이 기기에 남은 관절 좌표로 다시 분석 → detail | null
async function savedDetail(e) {
  if (!e.hasData) return null;
  try {
    const clip = await getClip(e.id);
    if (!clip) return null;
    const frames = unpackFrames(clip);
    return { result: analyzeMotion({ frames, mode: e.mode, hand: e.hand, fps: clip.hz * clip.slow, aspect: clip.aspect, eventIndex: clip.eventIndex }), n: frames.length };
  } catch (err) {
    console.warn('[motion] 내보낼 기록의 좌표를 읽지 못했어요', err);
    return null;
  }
}

const appVersion = () => { const s = document.querySelector('script[src*="motion/app.js"]'); return s ? new URL(s.src).searchParams.get('v') : null; };

// 지금 분석 + 같은 선수의 저장 기록 → { data(buildExport 결과), currentId(지금 분석의 session_id), playerId } | null
//  · AI 훈련 코치(page-coach.js)도 이 스냅숏을 쓴다
export async function currentExport(now = new Date()) {
  const r = state.result, c = state.clip;
  if (!r || !c) return null;
  const name = el.player.value.trim();
  const cur = { id: 'unsaved', at: now.toISOString(), name, mode: r.mode, hand: r.hand, fps: r.fps, quality: r.quality.level, order: r.metrics.sequence.order,
    metrics: summarize(r), spread: roundSpread(state.spread), range: { start: c.start, end: c.start + c.frames.length / c.hz } };
  const saved = samePlayer(loadLog(), name), match = savedMatch(saved, cur), entries = match ? saved : saved.concat(cur), details = {};
  for (const e of saved) if (e !== match) details[e.id] = await savedDetail(e);
  details[match ? match.id : cur.id] = { result: r, n: c.frames.length, width: el.video.videoWidth || null, height: el.video.videoHeight || null };
  const playerId = playerIdFor(name);
  return { data: buildExport({ entries, details, playerId, version: appVersion(), now }), currentId: String(match ? match.id : cur.id), playerId };
}

export async function exportJson() {
  const now = new Date(), got = await currentExport(now);
  if (!got) return;
  track('motion_export', { mode: state.result.mode });
  const { data, playerId: id } = got;
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.href = url; a.download = exportFileName(id, now); a.click();
  URL.revokeObjectURL(url);
  document.getElementById('exportMsg').textContent = `측정 숫자 ${data.sessions.length}개 기록을 내보냈어요(${a.download}). 선수 이름 대신 익명 ID 만 들어가요.`;
}
