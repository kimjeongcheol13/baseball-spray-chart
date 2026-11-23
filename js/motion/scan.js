// 동작 분석 — 긴 영상에서 스윙 · 투구 순간 찾기
//  · 자세 인식 없이 빠르게: 영상을 숨긴 채 빨리 재생하며 아주 작게 줄인 화면끼리 견줘 「움직임이 확 커지는 순간」을 찾는다
//  · 화면이 바뀐 곳(카메라 전환)으로 장면을 나누고 장면 안에서만 찾는다. 화면 전체가 고르게 움직이면(카메라가 따라감) 뺀다
//  · 순수 계산(findMoments)과 영상 읽기(scanVideo)를 나눠, 계산은 테스트로 확인한다
import { frameDiff, isCut } from './track.js?v=3';
import { LM, visible } from './landmarks.js?v=1';

const SCAN_W = 64, SCAN_H = 36;             // 견줄 화면 크기(픽셀)
const SCAN_RATE = 4;                        // 재생 배속
const BASE_DT = 1 / 30;                     // 움직임을 이 시간 간격(초)당 값으로 맞춘다
const SMOOTH_S = 0.25;                      // 움직임 곡선을 이만큼(초) 평균 내 다듬는다
const MIN_GAP_S = 2.0;                      // 후보끼리 이만큼은 떨어져야 다른 동작으로 본다
const BEFORE_S = 1.6, AFTER_S = 1.0;        // 후보 구간: 움직임이 가장 큰 순간 앞 · 뒤로 이만큼
const MIN_SHOT_S = 0.8;
const PROBE_BEFORE_S = 1.2, PROBE_AFTER_S = 0.4;   // 후보를 확인할 때 봉우리 앞 · 뒤로 보는 시간
export const PROBE_STEP_S = 0.15;                  // 확인할 때 이 간격으로 자세를 찾는다
export const MAX_CHECK = 10, MAX_SHOW = 6;        // 확인은 움직임이 큰 후보부터 최대 10개, 보여 주는 것은 6개까지                     // 이보다 짧은 장면은 보지 않는다
const MAX_CANDIDATES = 16;   // 움직임으로 넉넉히 뽑고, 자세 확인(verifyMoment)으로 거른다
const LOCAL_S = 3;                          // 「평소」를 잴 때 앞뒤로 보는 시간(초)
// 기준값 — 실제 영상 두 개로 정했다(아래 findMoments 주석). 값을 바꾸면 테스트 · 실제 영상으로 다시 확인한다
export const SCAN_RULES = { rise: 2.2, minLevel: 0.0012, quiet: 0.0008, focusLow: 0.3, focusHigh: 0.6 };
//  · rise: 앞뒤 3초의 평소 움직임(하위 10%)보다 이 배수 이상 솟아야 후보
//  · minLevel: 그래도 이보다 작은 움직임은 보지 않는다(정지 화면의 잡음) · quiet: 평소 움직임을 이보다 작게 보지 않는다(0 으로 나누지 않게)
//  · focusLow ~ focusHigh: 움직임이 화면 일부에 몰린 정도. focusLow 이하는 거의 버리고(카메라가 움직임), focusHigh 이상은 그대로 쓴다

// 작게 줄인 두 화면에서 움직임이 몰린 정도 → 0(화면 전체가 고르게) ~ 1(한 곳에만)
//  · 바뀐 양이 큰 순서로 위 10% 칸이 전체 바뀐 양에서 차지하는 몫
export function focusOf(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  const cells = [];
  for (let i = 0; i < a.length; i += 4) cells.push(Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]));
  const total = cells.reduce((s, v) => s + v, 0);
  if (!total) return 0;
  cells.sort((x, y) => y - x);
  return cells.slice(0, Math.max(1, Math.round(cells.length * 0.1))).reduce((s, v) => s + v, 0) / total;
}

const quantile = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) * q)] : 0; };
// 몰린 정도 → 움직임에 곱할 무게(0.1 ~ 1)
const focusWeight = (f, r) => Math.max(0.1, Math.min(1, (f - r.focusLow) / (r.focusHigh - r.focusLow)));

// samples = [{ t(영상 시각), level(시간당 움직임), focus, cut(이 샘플에서 화면이 바뀜) }] → 후보 [{ peak, start, end, score, shotFrom, shotTo }] (시각 순)
//  · 장면마다: 움직임에 몰림 무게를 곱해 0.25초로 다듬고, 앞뒤 3초의 평소(하위 10%)보다 rise 배 넘게 솟은 봉우리를 고른다
//  · 실제 영상(2026-11-23): 야구장 연습 영상은 스윙 때 평소의 3~4배로 솟았고, 중계 영상의 투구 장면은 움직임이 작지만 몰림이 0.58~0.86,
//    클로즈업 · 카메라가 따라가는 장면은 움직임이 크지만 몰림이 0.34~0.41 이었다
export function findMoments(samples, duration, rules = SCAN_RULES) {
  const shots = [];
  let cur = [];
  for (const s of samples) {
    if (s.cut && cur.length) { shots.push(cur); cur = []; }
    if (!s.cut) cur.push(s);
  }
  if (cur.length) shots.push(cur);
  const found = [];
  for (const shot of shots) {
    const from = shot[0].t, to = shot[shot.length - 1].t;
    if (to - from < MIN_SHOT_S) continue;
    const lv = shot.map((s) => s.level * focusWeight(s.focus, rules));
    const sm = shot.map((s) => { let sum = 0, n = 0; shot.forEach((o, j) => { if (Math.abs(o.t - s.t) <= SMOOTH_S / 2) { sum += lv[j]; n += 1; } }); return sum / n; });
    const peaks = [];
    sm.forEach((v, i) => {
      if (v < rules.minLevel || (i > 0 && sm[i - 1] > v) || (i < sm.length - 1 && sm[i + 1] >= v)) return;
      const near = sm.filter((_, j) => Math.abs(shot[j].t - shot[i].t) <= LOCAL_S), score = v / Math.max(rules.quiet, quantile(near, 0.1));
      if (score >= rules.rise) peaks.push({ i, score });
    });
    // 높은 것부터 고르고, 이미 고른 것과 너무 가까우면 버린다
    peaks.sort((a, b) => b.score - a.score);
    const kept = [];
    for (const p of peaks) if (kept.every((k) => Math.abs(shot[k.i].t - shot[p.i].t) >= MIN_GAP_S)) kept.push(p);
    for (const p of kept) {
      const peak = shot[p.i].t, start = Math.max(0, from, peak - BEFORE_S), end = Math.min(duration, to, peak + AFTER_S);
      // focus: 봉우리 근처(±0.25초)에서 움직임이 몰린 정도 — 확인할 순서를 정하는 데 쓴다
      const around = shot.filter((o) => Math.abs(o.t - peak) <= SMOOTH_S), focus = around.reduce((a, o) => a + o.focus, 0) / around.length;
      if (end - start >= MIN_SHOT_S) found.push({ peak, start, end, score: p.score, focus, shotFrom: from, shotTo: to });
    }
  }
  return found.sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES).sort((a, b) => a.peak - b.peak);
}

// ── 후보 확인: 사람이 온전히 보이고 손이 빠르게 움직였나 ─────────────
//  · 움직임만으로 고른 후보에는 클로즈업 · 공이 날아가는 화면 · 카메라 앞을 지나가는 사람이 섞인다(실제 영상 17개 중 9개)
//  · 후보마다 앞뒤 몇 장면에서 자세를 찾아, 몸통(어깨 · 골반)이 보이는 사람이 있고 손목이 몸통 길이에 견줘 빠르게 움직였는지 본다
export const VERIFY_RULES = { minFrames: 3, minSpeed: 4, minSize: 0.05, maxSize: 0.28 };
//  · minFrames: 몸통(어깨 · 골반)이 보인 장면 수 · minSpeed: 손목 빠르기(몸통 길이/초)
//  · minSize ~ maxSize: 몸통 길이(화면 높이 대비). 너무 작으면 잡음이 크고, 너무 크면 선수 클로즈업이다
//  · 실제 영상 17개 순간(2026-11-23): 스윙 · 투구는 빠르기 5~24 · 크기 0.13~0.25, 클로즈업은 크기 0.31~0.38,
//    카메라 앞을 지나간 사람 · 공이 날아가는 화면은 몸통이 3장면 미만으로 보였다
//  · 한 사람을 고정 카메라로 찍은 영상은 잘 맞았다(스윙 4/4 통과 · 아닌 장면 5/5 탈락). 여러 사람이 나오는 중계 영상은 엔진이 그때그때
//    다른 사람을 잡아 투구 4곳 중 2곳만 통과했다 → 선수를 고른 네모(region)로 다시 찾게 안내한다
const PAIR_S = 0.31;   // 손 빠르기를 잴 때 견주는 두 장면의 최대 간격(초)
const torsoLength = (p, aspect) => Math.hypot(((p[LM.L_SHOULDER].x + p[LM.R_SHOULDER].x) / 2 - (p[LM.L_HIP].x + p[LM.R_HIP].x) / 2) * aspect, (p[LM.L_SHOULDER].y + p[LM.R_SHOULDER].y) / 2 - (p[LM.L_HIP].y + p[LM.R_HIP].y) / 2);

// frames = [{ t, image }] (화면 비율 좌표) · aspect = 영상 가로/세로 → { ok, speed(몸통 길이/초), seen(몸통이 보인 장면 수), size(몸통 길이 · 화면 높이 대비), at(손이 가장 빨랐던 시각) }
export function verifyMoment(frames, aspect, rules = VERIFY_RULES) {
  const seen = (frames || []).filter((f) => f.image && visible(f.image, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP));
  if (seen.length < rules.minFrames) return { ok: false, speed: 0, seen: seen.length, size: 0, at: null };
  const L = seen.map((f) => torsoLength(f.image, aspect)).sort((a, b) => a - b)[Math.floor(seen.length / 2)] || 1;
  // 손 빠르기: 0.3초 안의 두 장면 사이 손목 이동 / 시간. 바로 옆 장면끼리만 보면 빠른 팔이 두 장면 사이에 지나가 버릴 때 작게 나온다
  let speed = 0, at = null;
  for (let i = 0; i < seen.length; i++) for (let k = i + 1; k < seen.length && seen[k].t - seen[i].t <= PAIR_S; k++) {
    const a = seen[i], b = seen[k], dt = Math.max(1e-3, b.t - a.t);
    for (const w of [LM.L_WRIST, LM.R_WRIST]) {
      if (!visible(a.image, w) || !visible(b.image, w)) continue;
      const v = Math.hypot((b.image[w].x - a.image[w].x) * aspect, b.image[w].y - a.image[w].y) / dt / L;
      if (v > speed) { speed = v; at = (a.t + b.t) / 2; }
    }
  }
  return { ok: speed >= rules.minSpeed && L >= rules.minSize && L <= rules.maxSize, speed, seen: seen.length, size: L, at };
}

// 확인할 순서: 움직임이 한곳에 몰린 후보(스윙 · 투구 장면)부터, 같으면 더 크게 솟은 것부터
//  · 움직임 크기만으로 순서를 매기면 클로즈업 · 카메라 이동처럼 크게 움직인 장면이 앞서서, 중계 영상의 투구 장면(몰림 0.86)이 확인 순서에서 빠졌다
export const checkOrder = (moments) => moments.slice().sort((a, b) => (b.focus >= FOCUS_FIRST) - (a.focus >= FOCUS_FIRST) || b.score - a.score);
const FOCUS_FIRST = 0.5;

// 후보 하나를 확인할 구간(움직임 봉우리 앞을 넓게 — 봉우리가 공을 친 뒤 움직임에 잡히는 일이 있다)
export const probeWindow = (m) => ({ from: Math.max(m.shotFrom, m.peak - PROBE_BEFORE_S), to: Math.min(m.shotTo, m.peak + PROBE_AFTER_S) });
// 확인된 순간 → 분석 구간(그 장면 안에서 손이 가장 빨랐던 순간 앞 1.6초 · 뒤 1초)
export const rangeAround = (m, at) => ({ start: Math.max(m.shotFrom, at - BEFORE_S), end: Math.min(m.shotTo, at + AFTER_S) });

// 영상 하나를 숨겨 둔 영상 요소로 빨리 재생하며 샘플을 모은다 → { samples, duration } · 중단하면 null
//  · url: 같은 영상의 주소(화면의 영상 요소는 건드리지 않는다) · region: 선수를 고른 네모(있으면 그 부분만 본다)
export async function scanVideo(url, { region = null, onProgress, shouldStop } = {}) {
  const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', src: url });
  const canvas = Object.assign(document.createElement('canvas'), { width: SCAN_W, height: SCAN_H }), ctx = canvas.getContext('2d', { willReadFrequently: true });
  await new Promise((resolve, reject) => { video.addEventListener('loadeddata', resolve, { once: true }); video.addEventListener('error', () => reject(new Error('영상을 읽지 못함')), { once: true }); });
  const duration = video.duration, samples = [];
  const grab = () => {
    const w = video.videoWidth, h = video.videoHeight, r = region || { x: 0, y: 0, w: 1, h: 1 };
    ctx.drawImage(video, r.x * w, r.y * h, r.w * w, r.h * h, 0, 0, SCAN_W, SCAN_H);
    return ctx.getImageData(0, 0, SCAN_W, SCAN_H).data;
  };
  let prev = null, prevT = null;
  const take = (t) => {
    const now = grab();
    if (prev) {
      const diff = frameDiff(prev, now), dt = Math.max(t - prevT, 1e-3);
      samples.push({ t, level: (diff * BASE_DT) / dt, focus: focusOf(prev, now), cut: isCut(diff) });
    }
    prev = now; prevT = t;
    if (onProgress) onProgress(Math.min(1, t / duration));
  };
  try {
    if (typeof video.requestVideoFrameCallback === 'function' && Number.isFinite(duration)) {
      await new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; video.pause(); resolve(); } };
        const onFrame = (_, meta) => {
          if (done) return;
          if (shouldStop && shouldStop()) { finish(); return; }
          take(meta.mediaTime);
          video.requestVideoFrameCallback(onFrame);
        };
        video.addEventListener('ended', finish, { once: true });
        video.playbackRate = SCAN_RATE;
        video.requestVideoFrameCallback(onFrame);
        video.play().catch(finish);
      });
    }
    if (shouldStop && shouldStop()) return null;
    return { samples, duration };
  } finally {
    video.removeAttribute('src'); video.load();
  }
}
