// 동작 분석 — 결과를 말로 풀어 주는 곳: 한눈에 보기 문장 · 숫자마다 읽는 법 · 참고 범위(연구에서 잰 값)
//  · 문장은 「무슨 일이 있었는지」만 말한다. 잘했다 · 못했다는 판정은 하지 않는다(카메라 한 대로 잰 값의 정확도를 검증하지 못했다)
//  · 문장을 가르는 경계값(분리각 15° · 35°, 속도비 0.95 · 1.05, 변화 5% · 3°)은 말을 고르기 위한 가정값이다. 평가 기준이 아니다
import { REFERENCE } from './reference.js?v=1';

const SEP_SMALL = 15, SEP_LARGE = 35;         // 분리각: 이보다 작으면 「거의 한 덩어리」 · 크면 「크게 먼저」
const RATIO_SAME = 0.05;                      // 몸통/골반 속도비가 1 ± 이 안이면 「비슷」
const CHANGE_MIN_PCT = 5, CHANGE_MIN_DEG = 3; // 지난 기록과 이만큼은 달라야 변화로 말한다
const num = (v) => typeof v === 'number' && Number.isFinite(v);

// 숫자마다 붙는 한 줄: 크면 · 작으면 무슨 뜻인지
const READ = {
  pelvisPeak: '클수록 하체가 빠르게 돈 거예요. 초당 30프레임 영상에서는 실제보다 낮게 나와요.',
  trunkPeak: '보통 골반보다 커요. 골반보다 작으면 하체 회전이 상체로 덜 넘어간 거예요.',
  maxSeparation: '클수록 골반이 먼저 열리고 어깨가 늦게 따라온 거예요. 작으면 몸이 한 덩어리로 돈 거예요.',
  stride: '클수록 보폭이 넓은 거예요. 내 기록끼리 비슷하게 나오는지 보는 값이에요.',
  leadKnee: '180°에 가까울수록 앞다리를 펴고 버틴 거예요. 작을수록 무릎이 굽은 채예요.',
  trunkTilt: '0°면 꼿꼿이 선 것이고, 클수록 몸이 많이 기운 거예요.',
  headMove: '작을수록 머리가 제자리에 있었던 거예요. 크면 몸이 앞으로 많이 나간 거예요.',
  elbowAtPlant: '작을수록 팔꿈치를 많이 굽힌 채 발이 닿은 거예요. 180°면 팔을 편 채예요.',
  armAngle: '클수록 위에서 던지는 폼, 0°에 가까울수록 옆에서 던지는 폼이에요.',
};
export const readText = (key) => READ[key] || '';

function sequenceLine(seq) {
  const ms = seq.pelvisToTrunkMs, step = Math.round(seq.resolutionMs);
  if (!num(ms)) return { tone: 'info', text: '골반이나 몸통이 가장 빨랐던 순간을 찾지 못해 순서를 말하기 어려워요.' };
  // 골반 → 몸통은 맞지만 손이 몸통보다 먼저면, 아래 「회전 순서」 칸과 말이 어긋나지 않게 그 사실도 같이 말한다
  if (ms > 0 && seq.proximalToDistal === false) return { tone: 'info', text: `골반이 먼저, 몸통이 ${Math.round(ms)}ms 뒤에 가장 빨라졌어요. 다만 손(추정)이 몸통보다 먼저 가장 빨라져서 골반 → 몸통 → 손 순서는 아니었어요.` };
  if (ms > 0) return { tone: 'good', text: `골반이 먼저, 몸통이 ${Math.round(ms)}ms 뒤에 가장 빨라졌어요. 힘이 아래에서 위로 넘어가는 순서예요.` };
  if (ms === 0) return { tone: 'info', text: `골반과 몸통이 같은 프레임에서 가장 빨라졌어요. 이 영상은 ${step}ms 간격까지만 구분돼서 누가 먼저인지 가릴 수 없어요.` };
  return { tone: 'warn', text: `몸통이 골반보다 ${Math.round(-ms)}ms 먼저 가장 빨라졌어요. 보통은 골반이 먼저예요. 상체가 먼저 돌았을 수 있어요.` };
}

function speedLine(m) {
  if (!num(m.pelvisPeak) || !num(m.trunkPeak) || m.pelvisPeak <= 0) return null;
  const ratio = m.trunkPeak / m.pelvisPeak;
  if (ratio >= 1 + RATIO_SAME) return { tone: 'good', text: `몸통이 골반보다 ${ratio.toFixed(1)}배 빠르게 돌았어요. 아래에서 만든 회전이 위로 가면서 빨라진 거예요.` };
  if (ratio <= 1 - RATIO_SAME) return { tone: 'warn', text: `몸통 회전(${Math.round(m.trunkPeak)}°/s)이 골반(${Math.round(m.pelvisPeak)}°/s)보다 느렸어요. 하체 회전이 상체로 덜 넘어갔을 수 있어요.` };
  return { tone: 'info', text: '골반과 몸통의 최고 회전 속도가 비슷했어요. 위로 가면서 빨라지는 폭이 작았어요.' };
}

function separationLine(m) {
  if (!num(m.maxSeparation)) return null;
  const v = Math.round(m.maxSeparation);
  if (v < SEP_SMALL) return { tone: 'info', text: `골반과 어깨가 거의 한 덩어리로 돌았어요(분리각 ${v}°).` };
  if (v > SEP_LARGE) return { tone: 'info', text: `골반이 어깨보다 크게 먼저 열렸어요(분리각 ${v}°).` };
  return { tone: 'info', text: `골반이 먼저 열리고 어깨가 뒤따라 돌았어요(분리각 ${v}°).` };
}

// 지난 기록과 가장 크게 달라진 것 하나
function changeLine(m, prev) {
  if (!prev) return { tone: 'info', text: '기록을 저장해 두면 다음부터 같은 종류의 지난 기록과 비교해 드려요.' };
  const found = [];
  for (const [key, name] of [['pelvisPeak', '골반 회전'], ['trunkPeak', '몸통 회전']]) {
    const before = prev.metrics && prev.metrics[key];
    if (!num(before) || before <= 0 || !num(m[key])) continue;
    const pct = Math.round(((m[key] - before) / before) * 100);
    if (Math.abs(pct) >= CHANGE_MIN_PCT) found.push({ size: Math.abs(pct), text: `지난 기록보다 ${name}이 ${Math.abs(pct)}% ${pct > 0 ? '빨라졌어요' : '느려졌어요'}(${before} → ${Math.round(m[key])}°/s).` });
  }
  const sepBefore = prev.metrics && prev.metrics.maxSeparation;
  if (num(sepBefore) && num(m.maxSeparation)) {
    const d = Math.round(m.maxSeparation) - sepBefore;
    if (Math.abs(d) >= CHANGE_MIN_DEG) found.push({ size: Math.abs(d), text: `지난 기록보다 분리각이 ${Math.abs(d)}° ${d > 0 ? '커졌어요' : '작아졌어요'}(${sepBefore}° → ${Math.round(m.maxSeparation)}°).` });
  }
  if (!found.length) return { tone: 'info', text: '지난 기록과 회전 속도 · 분리각이 거의 같아요.' };
  found.sort((a, b) => b.size - a.size);
  return { tone: 'info', text: found[0].text };
}

// 한눈에 보기 문장 → [{ tone: 'good' | 'warn' | 'info', text }]
//  · prev: 같은 종류(타격/투구 · 좌우)의 지난 기록 또는 null
export function summaryLines(result, prev) {
  const m = result.metrics, lines = [];
  if (result.quality.notes.includes('noRotation')) return [{ tone: 'warn', text: '빠른 회전 동작을 찾지 못해서 순서와 속도는 풀이하지 않았어요. 스윙 · 투구가 들어간 구간인지 확인해 주세요.' }];
  if (result.quality.level === 'low') lines.push({ tone: 'warn', text: '신뢰도가 낮아요. 아래 숫자는 참고만 하고, 영상과 순서 위주로 봐 주세요.' });
  lines.push(sequenceLine(m.sequence));
  for (const line of [speedLine(m), separationLine(m), changeLine(m, prev)]) if (line) lines.push(line);
  return lines;
}

// ── 참고 범위 (reference.js) ──────────────────────────────────────────
export const referenceOf = (mode, key) => (REFERENCE[mode] && REFERENCE[mode][key]) || null;

// 값이 참고 범위의 어디인지 → 'below' | 'within' | 'above' | null(값이나 범위가 없음)
export function positionIn(ref, value) {
  if (!ref || !num(value)) return null;
  return value < ref.low ? 'below' : value > ref.high ? 'above' : 'within';
}

const POSITION_TEXT = { below: '범위보다 낮음', within: '범위 안', above: '범위보다 높음' };

// 숫자 옆에 붙는 참고 범위 한 줄 → { text, position } | null
//  · 신뢰도가 낮으면 범위만 보여 주고 위치는 말하지 않는다
export function referenceLine(mode, key, value, quality) {
  const ref = referenceOf(mode, key);
  if (!ref) return null;
  const range = `참고 범위 ${ref.low}~${ref.high}${ref.unit}`, position = quality === 'low' ? null : positionIn(ref, value);
  return { text: position ? `${range} · ${POSITION_TEXT[position]}` : range, position };
}
