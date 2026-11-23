// 동작 분석 화면 — 여러 파일이 같이 쓰는 것: 화면 요소(el) · 상태(state) · 상태 줄 · 바쁨 표시 · 글자 상수
//  · app.js 에서 나눈 파일이다. 같은 모듈은 언제나 같은 ?v= 로 불러야 한 벌만 생긴다(상태가 둘로 갈리지 않게)
import { COLOR } from './overlay.js?v=7';
import { createMirror } from './mirror.js?v=2';
import { analyze } from './page-core.js?v=1';
import { save } from './page-records.js?v=1';

export const MAX_RANGE_S = 12;
// 3D 보기 방향: [yaw, pitch, 설명]
export const VIEWS = {
  front: [0, 0, '카메라에서 본 모습이에요. 영상과 같은 방향이에요.'],
  side: [90, 0, '옆에서 본 모습이에요. 깊이는 추정이라 가장 부정확한 방향이에요.'],
  top: [0, 90, '위에서 내려다본 모습이에요. 파란 골반선과 빨간 어깨선이 벌어진 각이 분리각이에요.'],
};
export const MIN_RANGE_S = 0.3;
export const NO_WRAPPED_TEXT = '네모 가운데에서 감싼 선수를 찾지 못했어요(네모 안의 다른 사람은 분석하지 않았어요). 선수가 네모 가운데에 오고 머리부터 발까지 들어가게 다시 감싸 주세요. 카메라에 등을 돌린 구간은 못 찾을 수 있어요.';
export const EXPORT_MAX_WIDTH = 1280;
export const MODE_TEXT = { bat: '타격', pitch: '투구' };
export const ROLE_TEXT = { bat: '타자', pitch: '투수' };
// 저장 목록을 나누는 묶음(이 순서로 보여 준다)
export const GROUPS = [['bat', '타자 (타격)'], ['pitch', '투수 (투구)']];
export const DOWNLOAD_MB = { lite: 20, full: 24, heavy: 45 };   // 엔진(WASM 약 15MB) + 모델
export const HAND_TEXT = { R: '우', L: '좌' };
// 타자는 우타 · 좌타, 투수는 우투 · 좌투
export const sideText = (mode, hand) => HAND_TEXT[hand] + (mode === 'pitch' ? '투' : '타');
export const TILE_COLOR = { pelvisPeak: COLOR.pelvis, trunkPeak: COLOR.trunk };

export const $ = (id) => document.getElementById(id);
export const el = {
  setup: $('setup'), file: $('file'), stageCard: $('stageCard'), stage: $('stage'), video: $('video'), overlay: $('overlay'),
  transport: $('transport'), play: $('btnPlay'), prev: $('btnPrev'), next: $('btnNext'), seek: $('seek'), time: $('timeOut'), rate: $('rate'),
  rangeRow: $('rangeRow'), momentRow: $('momentRow'), momentText: $('momentText'), find: $('btnFind'), momentList: $('momentList'), rangeText: $('rangeText'), start: $('btnStart'), end: $('btnEnd'),
  analyze: $('btnAnalyze'), stop: $('btnStop'), progress: $('progress'), status: $('status'),
  results: $('results'), title: $('resultTitle'), quality: $('quality'), notes: $('notes'), tiles: $('tiles'), insights: $('insights'), refNote: $('refNote'), dropHint: $('dropHint'), dropMsg: $('dropMsg'), capture: $('btnCapture'), captureMsg: $('captureMsg'), linkBox: $('linkBox'), trendBox: $('trendBox'), trendEmpty: $('trendEmpty'), trendGroup: $('trendGroup'), trendMetric: $('trendMetric'), trendChart: $('trendChart'), trendText: $('trendText'), linkUrl: $('linkUrl'), link: $('btnLink'), chart: $('chart'), view3d: $('view3d'), view3dNote: $('view3dNote'), view3dCap: $('view3dCap'), viewVideo: $('viewVideo'), motion: $('btnMotion'), motionRate: $('motionRate'),
  goPlant: $('btnGoPlant'), goMain: $('btnGoMain'), setMain: $('btnSetMain'), autoMain: $('btnAutoMain'),
  save: $('btnSave'), image: $('btnImage'), saveMsg: $('saveMsg'), logList: $('logList'), logEmpty: $('logEmpty'),
  player: $('playerName'), logMsg: $('logMsg'), attachWrap: $('attachWrap'), attach: $('fileAttach'), compareBox: $('compareBox'), compare: $('compare'), pickRow: $('pickRow'), pick: $('btnPick'), pickClear: $('btnPickClear'), pickText: $('pickText'),
  duelBox: $('duelBox'), duelNone: $('duelNone'), duelPlay: $('btnDuel'), duelRate: $('duelRate'), duelTime: $('duelTime'), duelA: $('duelA'), duelB: $('duelB'), duelVideoA: $('duelVideoA'), duelVideoB: $('duelVideoB'), duelVideos: $('duelVideos'), duelNameA: $('duelNameA'), duelNameB: $('duelNameB'),
};
export const ctx = el.overlay.getContext('2d');
export const mirror = createMirror($('viewVideo'));   // 동작 다시 보기의 「영상 + 선」 화면

// clip = 뽑아 둔 포즈 { frames, start, hz, aspect(영상 가로/세로), missing(사람을 못 찾은 장 수), strays(엉뚱한 곳에 잡혀 뺀 장 수) }
// region = 분석할 선수 영역(화면 비율 네모 · 없으면 화면 전체) · picking = 선수를 고르는 중 · drag = 끌고 있는 네모의 두 점
// file = 지금 영상 { blob, name, size, sig } · restore = 불러오는 중인 기록 { range, eventIndex } · still = 영상 없이 볼 때 고른 프레임 · compare = 비교할 기록 id 들 · result = analyzeMotion 결과 · liveFrame = 분석 도중 방금 읽은 프레임
export const state = { spread: null, url: null, range: { start: 0, end: 0 }, clip: null, result: null, chart: null, view3d: null, busy: false, stopping: false, liveFrame: null, readStart: 0, loop: null, file: null, restore: null, still: null, compare: [], capture: null, autoRun: false, duel: null, duelToken: 0, region: null, picking: false, drag: null };

export function node(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
export const sec = (t) => `${t.toFixed(2)}초`;

export function options() {
  const f = new FormData(el.setup);
  return { mode: f.get('mode'), hand: f.get('hand'), slow: Number(f.get('slow')), model: f.get('model') };
}

export function setStatus(text, bad = false) {
  el.status.textContent = text;
  el.status.classList.toggle('bad', bad);
}

export function setBusy(busy) {
  state.busy = busy;
  state.stopping = false;
  for (const part of [el.setup, el.transport, el.rangeRow, el.pickRow, el.momentRow, el.momentList]) part.inert = busy;
  el.analyze.disabled = busy;
  el.stop.hidden = el.progress.hidden = !busy;
  if (!busy) state.liveFrame = null;
}
