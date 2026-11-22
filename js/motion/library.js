// 동작 분석 — 저장 · 불러오기 · 비교 계산 (순수 함수)
//  · 분석을 다시 보려면 프레임마다 관절 33개 좌표가 필요하다. JSON 으로는 분석 하나에 0.5MB 를 넘어 숫자 배열(Float32Array)로 묶는다
import { metricList } from './metrics.js?v=2';

const JOINTS = 33, FIELDS = 4;   // 관절마다 x · y · z · visibility

function packPoints(frames, key) {
  const out = new Float32Array(frames.length * JOINTS * FIELDS);
  frames.forEach((f, i) => {
    if (!f[key]) return;
    f[key].forEach((p, j) => out.set([p.x, p.y, p.z || 0, p.visibility ?? 1], (i * JOINTS + j) * FIELDS));
  });
  return out;
}

function unpackPoints(data, i) {
  const out = [];
  for (let j = 0; j < JOINTS; j++) {
    const o = (i * JOINTS + j) * FIELDS;
    out.push({ x: data[o], y: data[o + 1], z: data[o + 2], visibility: data[o + 3] });
  }
  return out;
}

// frames[i] = { world, image } (못 찾은 프레임은 둘 다 null) → { n, found, world, image } 숫자 배열 묶음
export function packFrames(frames) {
  return { n: frames.length, found: Uint8Array.from(frames, (f) => (f.world ? 1 : 0)), world: packPoints(frames, 'world'), image: packPoints(frames, 'image') };
}

export function unpackFrames(packed) {
  return Array.from({ length: packed.n }, (_, i) => (packed.found[i]
    ? { world: unpackPoints(packed.world, i), image: unpackPoints(packed.image, i) } : { world: null, image: null }));
}

// 같은 영상 파일인지 가리는 표식 — 같은 영상에서 여러 번 분석해도 영상은 한 번만 저장한다
export const videoSig = (file) => `${file.name}|${file.size}|${file.lastModified || 0}`;

// 기록 목록에 없는 분석 데이터 · 어느 기록도 쓰지 않는 영상 → 지울 것 { clips: [id], videos: [sig] }
export function orphanKeys(log, clipIds, videoSigs) {
  const ids = new Set(log.map((e) => e.id)), sigs = new Set(log.filter((e) => e.video).map((e) => e.video.sig));
  return { clips: clipIds.filter((id) => !ids.has(id)), videos: videoSigs.filter((sig) => !sigs.has(sig)) };
}

// 두 기록을 나란히 놓은 표 → [{ key, label, unit, a, b, diff(b - a) }]. 두 기록에 모두 있는 지표만(타격 · 투구가 섞이면 공통 지표만)
export function compareRows(a, b) {
  const has = (e, key) => e.metrics && key in e.metrics;
  return metricList(a.mode).filter((m) => has(a, m.key) && has(b, m.key)).map((m) => {
    const va = a.metrics[m.key], vb = b.metrics[m.key];
    return { key: m.key, label: m.label, unit: m.unit, a: va, b: vb, diff: typeof va === 'number' && typeof vb === 'number' ? vb - va : null };
  });
}
