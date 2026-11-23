// 동작 분석 화면 — 긴 영상에서 스윙 · 투구 순간 찾기(scan.js)를 화면에 잇는다
//  · app.js 에서 나눈 파일이다. 같은 모듈은 언제나 같은 ?v= 로 불러야 한 벌만 생긴다(상태가 둘로 갈리지 않게)
import { track } from './usage.js?v=1';
import { loadLandmarker, probeWindows } from './pose.js?v=9';
import { scanVideo, findMoments, checkOrder, verifyMoment, probeWindow, rangeAround, PROBE_STEP_S, MAX_CHECK, MAX_SHOW } from './scan.js?v=1';
import { $, el, state, node, sec, options, setStatus, setBusy } from './page.js?v=1';
import { renderRange } from './page-input.js?v=1';
import { onProgress } from './page-core.js?v=1';

// ── 스윙 · 투구 순간 찾기 (scan.js) ─────────────────────────────
// 1) 숨긴 영상으로 빨리 훑어 움직임이 솟은 후보를 뽑고 2) 움직임이 큰 후보부터 자세를 찾아 사람이 빠르게 움직였는지 확인한다
export async function findMoments_() {
  if (state.busy || !state.url) return;
  const url = state.url, region = state.region, model = options().model;
  el.momentList.replaceChildren();
  setBusy(true);
  try {
    setStatus('스윙 · 투구 순간을 찾는 중… 영상을 빠르게 훑고 있어요');
    const scanned = await scanVideo(url, { region, onProgress: (p) => { el.progress.value = p * 0.4; }, shouldStop: () => state.stopping });
    if (!scanned || url !== state.url) return;
    const order = checkOrder(findMoments(scanned.samples, scanned.duration)).slice(0, MAX_CHECK);
    if (!order.length) { setStatus('움직임이 크게 바뀌는 순간을 찾지 못했어요. 「여기부터」 · 「여기까지」로 직접 구간을 잡아 주세요.'); return; }
    setStatus(`후보 ${order.length}곳에서 사람이 움직였는지 확인하는 중… (처음이면 분석 엔진을 내려받아요)`);
    const landmarker = await loadLandmarker(model);
    const probe = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', src: url });
    await new Promise((resolve, reject) => { probe.addEventListener('loadeddata', resolve, { once: true }); probe.addEventListener('error', reject, { once: true }); });
    const aspect = probe.videoWidth / probe.videoHeight;
    const frames = await probeWindows(probe, landmarker, order.map(probeWindow), { region, step: PROBE_STEP_S, onProgress: (k, n) => { el.progress.value = 0.4 + (0.6 * k) / n; }, shouldStop: () => state.stopping });
    probe.removeAttribute('src'); probe.load();
    if (!frames || url !== state.url) return;
    const found = order.map((m, k) => ({ m, v: verifyMoment(frames[k], aspect) })).filter((x) => x.v.ok && x.v.at !== null)
      .sort((a, b) => b.v.speed - a.v.speed).slice(0, MAX_SHOW).map((x) => ({ at: x.v.at, range: rangeAround(x.m, x.v.at) })).sort((a, b) => a.at - b.at);
    renderMoments(found);
    track('motion_find', { found: found.length, checked: order.length, picked: Boolean(region) });
  } catch (err) {
    console.warn('[motion] 스윙 · 투구 순간을 찾지 못함', err);
    setStatus('스윙 · 투구 순간을 찾지 못했어요. 「여기부터」 · 「여기까지」로 직접 구간을 잡아 주세요.', true);
  } finally {
    setBusy(false);
    if (state.stopping) setStatus('찾기를 멈췄어요.');
  }
}

export function renderMoments(found) {
  if (!found.length) { setStatus('사람이 빠르게 움직인 순간을 찾지 못했어요. 선수가 작거나 가려졌으면 「선수 고르기」로 감싼 뒤 다시 찾거나, 직접 구간을 잡아 주세요.'); return; }
  el.momentText.textContent = '찾은 순간을 누르면 그 앞뒤로 구간을 잡아요. 다른 선수를 보려면 「선수 고르기」 뒤 다시 찾아 주세요.';
  el.momentList.replaceChildren(...found.map((f, k) => {
    const b = node('button', 'mo-btn', `${k + 1}. ${sec(f.at)}`);
    b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', `${sec(f.at)} 순간을 분석 구간으로`);
    b.addEventListener('click', () => useMoment(f, b));
    return b;
  }));
  // 여러 사람이 나오는 영상(중계 등)은 엔진이 그때그때 다른 사람을 잡아 순간을 놓치기 쉽다 → 선수를 고르고 다시 찾게 안내한다
  const tip = state.region ? '' : ' 여러 사람이 나오는 영상이면 「선수 고르기」로 선수를 감싼 뒤 다시 찾으면 더 정확해요.';
  setStatus(`스윙 · 투구로 보이는 순간 ${found.length}곳을 찾았어요. 눌러서 구간을 고른 뒤 「분석 시작」을 눌러 주세요.${tip}`);
  useMoment(found[0], el.momentList.firstChild);
}

// 찾은 순간 하나를 분석 구간으로 쓴다
export function useMoment(f, button) {
  if (button !== el.momentList.firstChild || state.range.start !== f.range.start) track('motion_moment_pick');
  for (const b of el.momentList.children) b.setAttribute('aria-pressed', String(b === button));
  state.range = { ...f.range };
  renderRange();
  el.video.currentTime = f.at;
}
