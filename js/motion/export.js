// 동작 분석 — 측정 숫자 JSON 내보내기 (순수 함수 · 화면 · 저장소 접근은 page-export.js)
//  · 따로 만들 훈련 방향 에이전트(Python)가 읽는 파일이다. 필드 설명은 docs/MOTION_EXPORT.md
//  · 넣는 것: 이미 계산해 둔 숫자 · 흔들림 폭(±) · 참고 범위 · 단계 시각 · 회전 순서. 넣지 않는 것: 영상 · 프레임 이미지 · 관절 좌표 · 선수 이름
//  · key 는 한번 정하면 바꾸지 않는다(에이전트가 이 이름으로 읽는다). 새 지표는 key 를 새로 더한다
import { metricList } from './metrics.js?v=2';
import { REFERENCE, REFERENCE_SOURCES } from './reference.js?v=1';

export const SCHEMA_VERSION = '1.0';
const ID_KEY = 'sl_motion_export_ids';   // 선수 이름 → 익명 ID (이 기기에만 둔다. 파일에는 ID 만 나간다)

// 앱 지표 이름 → 내보내기 key · 단위 · 잰 순간(phase). phase 가 함수면 동작 종류에 따라 다르다
const MAIN = { bat: 'contact', pitch: 'ball_release' };
const DEF = {
  pelvisPeak: { key: 'pelvis_peak_velocity', unit: 'deg/s', phase: null },
  trunkPeak: { key: 'trunk_peak_velocity', unit: 'deg/s', phase: null },
  maxSeparation: { key: 'max_hip_shoulder_separation', unit: 'deg', phase: null },
  stride: { key: 'stride_length', unit: 'pct_leg_length', phase: null },
  leadKnee: { key: 'lead_knee_angle', unit: 'deg', phase: (mode) => MAIN[mode] },
  trunkTilt: { key: 'trunk_tilt', unit: 'deg', phase: (mode) => MAIN[mode] },
  headMove: { key: 'head_displacement', unit: 'pct_leg_length', phase: null },
  elbowAtPlant: { key: 'throwing_elbow_angle', unit: 'deg', phase: () => 'foot_strike' },
  armAngle: { key: 'arm_slot_angle', unit: 'deg', phase: () => 'ball_release' },
};
export const EXPORT_KEYS = Object.fromEntries(Object.entries(DEF).map(([k, d]) => [k, d.key]));
const MOTION_TYPE = { bat: 'batting', pitch: 'pitching' };
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const round3 = (v) => Math.round(v * 1000) / 1000;

// 참고 범위의 출처 이름 + 주소 (reference.js 가 출처 목록을 만드는 순서와 같게 찾는다)
function sourceText(mode, source) {
  const keys = [...new Set(Object.values(REFERENCE[mode] || {}).map((r) => r.source))], s = (REFERENCE_SOURCES[mode] || [])[keys.indexOf(source)];
  return s ? `${s.label} ${s.url}` : source;
}

// 같은 선수의 기록(이름 앞뒤 공백은 같은 이름 · 이름 없는 기록은 이름 없는 기록끼리). 타격 · 투구 모두
export const samePlayer = (entries, name) => entries.filter((e) => (e.name || '').trim() === (name || '').trim());

// 지금 분석과 같은 저장 기록 | null — 저장 · 불러오기 뒤에는 종류 · 구간 · 숫자가 저장된 것과 똑같다
export const savedMatch = (entries, cur) => entries.find((e) => e.mode === cur.mode && e.hand === cur.hand && e.range && cur.range
  && e.range.start === cur.range.start && e.range.end === cur.range.end && JSON.stringify(e.metrics) === JSON.stringify(cur.metrics)) || null;

// 선수 이름 → 이 기기의 익명 ID (처음 보는 이름이면 새로 만든다). 저장소를 못 쓰면 이번에만 쓰는 ID
export function playerIdFor(name, storage = localStorage, random = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  const key = (name || '').trim(), fresh = () => 'p' + random().toString(16).padStart(8, '0');
  let map = {};
  try { map = JSON.parse(storage.getItem(ID_KEY) || '{}') || {}; } catch (e) { map = {}; }
  if (map[key]) return map[key];
  map[key] = fresh();
  try { storage.setItem(ID_KEY, JSON.stringify(map)); } catch (e) { console.warn('[motion] 익명 ID 를 저장하지 못했어요', e); }
  return map[key];
}

// 기록 하나 → session · detail = 관절 좌표로 다시 찾은 순간들 { result(analyzeMotion), n, width, height } | null
export function sessionOf(e, detail) {
  const r = detail && detail.result && detail.result.ok ? detail.result : null, fps = r ? r.fps : e.fps;
  const t = (i) => (num(i) && num(fps) ? round3(i / fps) : null);   // 분석 구간 첫 프레임부터 실제 시간(초)
  const ev = r ? r.events : {};
  const phases = r ? [['foot_strike', ev.plant], [MAIN[e.mode] || 'main_event', ev.main], ['pelvis_peak', ev.pelvisPeak], ['trunk_peak', ev.trunkPeak], ['hand_peak', ev.handPeak]]
    .map(([name, i]) => ({ name, time_s: t(i) })) : [];
  const metrics = metricList(e.mode).map((m) => {
    const d = DEF[m.key], ref = (REFERENCE[e.mode] || {})[m.key], v = e.metrics[m.key], u = e.spread && e.spread[m.key];
    return { key: d.key, label: m.label, value: num(v) ? v : null, unit: d.unit, uncertainty: num(u) ? u : null, phase: d.phase ? d.phase(e.mode) : null,
      ref_range: ref ? [ref.low, ref.high] : null, ref_source: ref ? sourceText(e.mode, ref.source) : null };
  });
  const gap = r ? r.metrics.sequence.pelvisToTrunkMs : null;
  metrics.push({ key: 'pelvis_to_trunk_peak_gap', label: '골반 → 몸통 피크 간격', value: num(gap) ? Math.round(gap) : null, unit: 'ms', uncertainty: null, phase: null, ref_range: null, ref_source: null });
  return {
    session_id: String(e.id), recorded_at: e.at, motion_type: MOTION_TYPE[e.mode] || 'unknown', hand: e.hand || null, quality: e.quality || null,
    video: { fps: num(fps) ? round3(fps) : null, width: (detail && detail.width) || null, height: (detail && detail.height) || null,
      duration_s: r && num(detail.n) ? round3(detail.n / fps) : null, view: 'unknown' },
    phases, metrics,
    sequence: { order: Array.isArray(e.order) ? e.order.slice() : [], estimated: true },
  };
}

// entries = 같은 선수의 기록(지금 분석이 아직 저장 전이면 id 'unsaved' 로 함께) · details = { [id]: detail }
export function buildExport({ entries, details = {}, playerId, version = null, now = new Date() }) {
  const list = entries.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const last = (mode) => { const e = list.filter((x) => x.mode === mode).pop(); return e ? e.hand : null; };
  return {
    schema_version: SCHEMA_VERSION,
    exported_at: now.toISOString(),
    app: { name: 'SprayLab Motion', version },
    player: { id: playerId, bats: last('bat'), throws: last('pitch') },
    sessions: list.map((e) => sessionOf(e, details[e.id] || null)),
  };
}

// spraylab-motion_{익명ID}_{YYYYMMDD-HHmm}.json (이 기기 시각)
export function exportFileName(playerId, now = new Date()) {
  const p = (v) => String(v).padStart(2, '0');
  return `spraylab-motion_${playerId}_${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}
