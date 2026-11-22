// 동작 분석 — 지표 이름 · 단위 · 설명 (화면 · 저장 · 이미지가 같은 정의를 쓴다)
const EVENT = { bat: '임팩트', pitch: '릴리스' };

const ROTATION = [
  { key: 'pelvisPeak', label: '골반 회전 피크', unit: '°/s', help: '골반이 타깃 쪽으로 가장 빠르게 돈 순간의 속도' },
  { key: 'trunkPeak', label: '몸통 회전 피크', unit: '°/s', help: '어깨선이 가장 빠르게 돈 순간의 속도' },
  { key: 'maxSeparation', label: '최대 분리각', unit: '°', help: '골반이 어깨보다 먼저 돌아 생긴 꼬임의 최대치' },
];

const BY_MODE = {
  bat: [
    { key: 'stride', label: '스트라이드 폭', unit: '%', help: '두 발 사이 거리 · 다리 길이 대비' },
    { key: 'leadKnee', label: '임팩트 앞무릎', unit: '°', help: '임팩트 때 앞다리가 펴진 정도 (180° = 완전히 폄)' },
    { key: 'trunkTilt', label: '임팩트 몸통 기울기', unit: '°', help: '골반 → 어깨 선이 수직에서 기운 각' },
    { key: 'headMove', label: '머리 이동', unit: '%', help: '착지 → 임팩트 사이 머리가 움직인 거리 · 다리 길이 대비' },
  ],
  pitch: [
    { key: 'stride', label: '스트라이드 폭', unit: '%', help: '두 발 사이 거리 · 다리 길이 대비' },
    { key: 'leadKnee', label: '릴리스 앞무릎', unit: '°', help: '릴리스 때 앞다리가 펴진 정도 (180° = 완전히 폄)' },
    { key: 'trunkTilt', label: '릴리스 몸통 기울기', unit: '°', help: '골반 → 어깨 선이 수직에서 기운 각' },
    { key: 'elbowAtPlant', label: '착지 팔꿈치', unit: '°', help: '앞발이 닿는 순간 던지는 팔 팔꿈치 각' },
    { key: 'armAngle', label: '릴리스 팔 높이', unit: '°', help: '어깨 → 손목 선이 수평 위로 올라간 각' },
  ],
};

const PART = { pelvis: '골반', trunk: '몸통', hand: '손(추정)' };

export const eventName = (mode) => EVENT[mode] || EVENT.bat;
export const metricList = (mode) => ROTATION.concat(BY_MODE[mode] || BY_MODE.bat);
export const formatValue = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '–');

// ['pelvis','trunk','hand'] → '골반 › 몸통 › 손(추정)'
export const sequenceText = (order) => (order && order.length ? order.map((k) => PART[k]).join(' › ') : '–');

// 저장 · 비교에 쓰는 숫자만 뽑는다 { key: 반올림한 값 | null }
export function summarize(result) {
  const out = {};
  for (const m of metricList(result.mode)) {
    const v = result.metrics[m.key];
    out[m.key] = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
  }
  return out;
}

export const QUALITY_TEXT = { high: '신뢰도 높음', mid: '신뢰도 보통', low: '신뢰도 낮음' };
export const NOTE_TEXT = {
  noRotation: '빠른 회전 동작을 찾지 못했어요. 스윙 · 투구가 들어간 구간인지 확인해 주세요. 이 경우 회전 순서는 의미가 없어요.',
  jumpy: '관절 위치가 순간적으로 튄 프레임이 있어 계산에서 뺐어요. 회전 속도는 참고만 해 주세요.',
  tooFast: '회전 속도가 사람 몸으로 나오기 어려울 만큼 크게 나왔어요. 인식이 흔들린 결과일 가능성이 커서 신뢰도를 「낮음」으로 뒀어요.',
  lowFps: '초당 60프레임보다 느린 영상이라 피크 값이 실제보다 낮게 나오고, 순서는 한 프레임 차이까지만 구분돼요.',
  lowVisibility: '몸이 가려지거나 화면 밖으로 나간 프레임이 있어요. 전신이 계속 보이게 찍으면 더 정확해요.',
};
// 신뢰도 안내 문구. 사람을 놓친 비율처럼 숫자가 있는 것은 실제 값을 넣어 준다
export function noteText(key, quality) {
  if (key !== 'lowVisibility' && key !== 'jumpy') return NOTE_TEXT[key];
  if (key === 'jumpy') return `임팩트 · 릴리스 앞뒤 프레임의 ${Math.round(quality.jumpRatio * 100)}%에서 골반 · 어깨 위치가 순간적으로 튀어 계산에서 뺐어요(30%를 넘으면 신뢰도가 「낮음」이에요). 회전 속도는 참고만 해 주세요.`;
  const pct = Math.round((1 - quality.windowValid) * 100);
  return `임팩트 · 릴리스 앞뒤 프레임의 ${pct}%에서 사람을 찾지 못했어요(30%를 넘으면 신뢰도가 「낮음」이에요). 선수가 작게 찍혔거나 앞에 가리는 것이 있으면 생겨요.`;
}

export const FAIL_TEXT = {
  short: '분석 구간이 너무 짧아요. 준비 자세부터 마무리까지 들어가게 구간을 잡아 주세요.',
  noPose: '영상에서 사람을 찾지 못했어요. 한 사람의 전신이 보이는 영상인지 확인해 주세요.',
};
