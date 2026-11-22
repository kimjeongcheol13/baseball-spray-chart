// 동작 분석 — MediaPipe Pose 33개 관절 번호와 야구용 묶음 (앞/뒤 = 투수 쪽 / 포수 쪽)
//  · 우타 · 우투 는 왼쪽 몸이 앞(투수 쪽 · 내딛는 다리), 오른쪽이 뒤(던지는 팔). 좌타 · 좌투 는 반대
export const LM = {
  NOSE: 0, L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14, L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24, L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28, L_FOOT: 31, R_FOOT: 32,
};

// 화면에 그리는 뼈대(관절 번호 쌍). 골반선 · 어깨선은 색이 달라 따로 그린다(overlay.js)
export const BONES = [
  [LM.L_SHOULDER, LM.L_ELBOW], [LM.L_ELBOW, LM.L_WRIST], [LM.R_SHOULDER, LM.R_ELBOW], [LM.R_ELBOW, LM.R_WRIST],
  [LM.L_SHOULDER, LM.L_HIP], [LM.R_SHOULDER, LM.R_HIP],
  [LM.L_HIP, LM.L_KNEE], [LM.L_KNEE, LM.L_ANKLE], [LM.R_HIP, LM.R_KNEE], [LM.R_KNEE, LM.R_ANKLE],
  [LM.L_ANKLE, LM.L_FOOT], [LM.R_ANKLE, LM.R_FOOT],
];

const LEFT = { shoulder: LM.L_SHOULDER, elbow: LM.L_ELBOW, wrist: LM.L_WRIST, hip: LM.L_HIP, knee: LM.L_KNEE, ankle: LM.L_ANKLE };
const RIGHT = { shoulder: LM.R_SHOULDER, elbow: LM.R_ELBOW, wrist: LM.R_WRIST, hip: LM.R_HIP, knee: LM.R_KNEE, ankle: LM.R_ANKLE };

// hand = 'R'(우타 · 우투) | 'L'(좌타 · 좌투) → { lead, rear } 관절 번호 묶음
export function sides(hand) {
  return hand === 'L' ? { lead: RIGHT, rear: LEFT } : { lead: LEFT, rear: RIGHT };
}

// 이 값보다 덜 보이는 관절은 계산 · 그리기에서 뺀다 (MediaPipe visibility 0~1)
export const MIN_VISIBILITY = 0.5;

export function visible(landmarks, ...indexes) {
  return !!landmarks && indexes.every((i) => landmarks[i] && (landmarks[i].visibility ?? 1) >= MIN_VISIBILITY);
}
