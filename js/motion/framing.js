// 동작 분석 — 촬영 상태 점검 (순수 함수)
//  · 숫자가 정확해지는 가장 싼 방법은 처음부터 잘 찍는 것이다. 무엇을 고치면 되는지 구체적으로 알려 준다
//  · 영상을 열 때: 초당 프레임 수 · 화질 / 분석한 뒤: 선수 크기 · 화면 밖으로 나간 부위 · 지난 기록과 같은 자리에서 찍었는지
//  · 기준값은 지금까지의 시험에서 정한 것이다(아래 상수 주석). 카메라 흔들림은 아직 보지 않는다
import { LM, visible } from './landmarks.js?v=1';

export const FRAMING_RULES = {
  minFps: 50,          // 초당 이보다 적으면 안내 — 가상 시험에서 30fps 는 회전 속도가 11~18% 낮게 나오고 흔들림 폭(±)이 60fps 의 약 1.6배였다
  minSide: 480,        // 영상 짧은 변(px)이 이보다 작으면 화질 안내
  small: 0.1,          // 몸통 길이가 화면 높이의 이보다 작으면 「작게 찍힘」 — 중계 화면의 투수 · 타자가 0.13~0.15 였다
  large: 0.3,          // 이보다 크면 「너무 가까움」 — 클로즈업이 0.31~0.38 이었다
  cutShare: 0.2,       // 이 비율 넘는 장면에서 부위가 화면 밖이면 안내
  edge: 0.02,          // 화면 가장자리에서 이만큼 안쪽까지를 「밖」으로 본다
  sameSize: 0.2,       // 지난 기록과 선수 크기가 이 비율 넘게 다르면 「다른 거리」
  sameSpot: 0.12,      // 지난 기록과 골반 위치가 이만큼(화면 비율) 넘게 다르면 「다른 자리」
};

const PARTS = [
  { name: '머리가', joints: [LM.NOSE] },
  { name: '발이', joints: [LM.L_ANKLE, LM.R_ANKLE] },
  { name: '손이', joints: [LM.L_WRIST, LM.R_WRIST] },
];
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const round3 = (v) => Math.round(v * 1000) / 1000;

// 분석한 프레임 → { size(몸통 길이 · 화면 높이 대비), cx, cy(골반 중심 · 화면 비율), cut: [{ name, share }] } | null(몸통이 안 보임)
//  · aspect = 영상 가로/세로. 부위가 화면 밖에 있으면 「잘림」으로 센다
//  · 몸에 가려진 것(던지는 손이 몸 뒤로 가는 등)은 세지 않는다 — 정상 동작이고 촬영으로 고칠 수 없다. 처음에 함께 셌더니 투수 손이 31% 로 나왔다
export function framingOf(frames, aspect, rules = FRAMING_RULES) {
  const seen = frames.filter((f) => f.image && visible(f.image, LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP));
  if (!seen.length) return null;
  const mid = (p, a, b) => ({ x: (p[a].x + p[b].x) / 2, y: (p[a].y + p[b].y) / 2 });
  const sizes = [], xs = [], ys = [];
  for (const f of seen) {
    const s = mid(f.image, LM.L_SHOULDER, LM.R_SHOULDER), h = mid(f.image, LM.L_HIP, LM.R_HIP);
    sizes.push(Math.hypot((s.x - h.x) * aspect, s.y - h.y)); xs.push(h.x); ys.push(h.y);
  }
  const outside = (p) => Boolean(p) && (p.x < rules.edge || p.x > 1 - rules.edge || p.y < rules.edge || p.y > 1 - rules.edge);
  const cut = PARTS.map((part) => ({ name: part.name, share: seen.filter((f) => part.joints.some((j) => outside(f.image[j]))).length / seen.length }))
    .filter((c) => c.share > rules.cutShare);
  return { size: median(sizes), cx: median(xs), cy: median(ys), cut };
}

// 저장용(소수 셋째 자리까지, 잘린 부위는 빼고)
export const roundFraming = (f) => (f ? { size: round3(f.size), cx: round3(f.cx), cy: round3(f.cy) } : null);

// 영상을 열 때 알 수 있는 것 → [{ tone, text }] · fps 는 슬로모션 배수를 곱한 실제 초당 프레임 수
export function openChecks({ fps, width, height }, rules = FRAMING_RULES) {
  const out = [];
  if (fps && fps < rules.minFps) out.push({ tone: 'warn', text: `초당 ${Math.round(fps)}프레임 영상이에요. 60프레임 이상(또는 슬로모션)으로 찍으면 회전 속도가 덜 낮게 나오고 흔들림 폭(±)도 줄어요.` });
  if (width && height && Math.min(width, height) < rules.minSide) out.push({ tone: 'warn', text: `화질이 낮아요(${width}×${height}). 관절을 놓치기 쉬워요. 720p 이상으로 찍어 주세요.` });
  return out;
}

// 분석한 뒤 알 수 있는 것 → [{ tone, text }] · prev = 지난 기록의 framing(같은 선수 · 종류) 또는 null
export function framingChecks(framing, prev, rules = FRAMING_RULES) {
  if (!framing) return [];
  const out = [];
  if (framing.size < rules.small) out.push({ tone: 'warn', text: '선수가 작게 찍혔어요. 가까이 가거나 확대해서, 선수가 화면 높이의 절반 이상을 차지하게 찍으면 관절을 덜 놓쳐요.' });
  else if (framing.size > rules.large) out.push({ tone: 'warn', text: '선수가 화면에 너무 꽉 차요. 조금 뒤로 물러나 머리부터 발까지, 배트 · 공까지 들어가게 찍어 주세요.' });
  for (const c of framing.cut) out.push({ tone: 'warn', text: `${c.name} 화면 밖으로 나간 장면이 ${Math.round(c.share * 100)}%예요. 동작 내내 화면 안에 들어오게 조금 넓게 찍어 주세요.` });
  if (prev && prev.size) {
    const ratio = framing.size / prev.size, moved = Math.hypot(framing.cx - prev.cx, framing.cy - prev.cy);
    if (Math.abs(ratio - 1) > rules.sameSize) out.push({ tone: 'warn', text: `지난 기록보다 선수가 ${Math.round(Math.abs(ratio - 1) * 100)}% ${ratio > 1 ? '크게' : '작게'} 찍혔어요. 찍은 거리가 다르면 기록끼리 견주기 어려워요. 같은 자리 · 같은 높이에서 찍어 주세요.` });
    else if (moved > rules.sameSpot) out.push({ tone: 'warn', text: '지난 기록과 선수가 화면에서 다른 자리에 있어요. 카메라 방향이 바뀌었을 수 있어요. 같은 자리 · 같은 방향에서 찍어 주세요.' });
    else out.push({ tone: 'good', text: '지난 기록과 비슷한 거리 · 자리에서 찍었어요. 기록끼리 견주기 좋아요.' });
  }
  if (!out.length) out.push({ tone: 'good', text: '선수 크기와 화면 안 위치가 괜찮아요.' });
  return out;
}
