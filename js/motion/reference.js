// 동작 분석 — 참고 범위: 연구에서 잰 선수들의 평균 ± 표준편차 (2026-11-22 에 논문 본문에서 읽은 값만 넣었다 · 2026-11-28 다시 확인 — docs/EVIDENCE.md)
//  · 넣는 기준: 평균과 표준편차가 함께 실려 있고, 재는 대상이 우리 지표와 같은 것만. 출처 없이 숫자를 넣지 않는다
//  · 넣지 않은 것
//     - 프로 타자의 회전 속도: Escamilla 2009 는 표준편차까지 확인(성인 12명 = 대학 6 + 프로 6: 골반 678±87 · 몸통 857±53°/s)했지만 대학 · 프로가 섞이고 프로만의 값이 아니라 넣지 않았다
//     - 투구 몸통 회전: 연구마다 값이 400°/s 가까이 다르다(프로 742 ± 221 대 대학 · 프로 1155 ± 71). 재는 방식이 달라 하나를 고를 근거가 없다
//     - 투구 분리각: 논문 값은 「앞발 착지 순간」의 값이고 우리 지표는 「최대」라서 같은 것이 아니다
//     - 타격 분리각(Taguchi 2023 33.4±4.4°): 테이크백 구간 비틀림이라 우리 「최대 분리각」과 정의가 달라 뺐다(2026-11-28)
//  · 이 값들은 연구실 장비(카메라 여러 대 · 초당 250~480프레임 또는 몸에 붙인 센서)로 잰 것이다.
//    휴대폰 영상 한 대로 잰 우리 값과 그대로 견줄 수 있는지는 검증하지 못했다 → 화면에서도 등급이 아니라 참고로만 보여 준다
const range = (mean, sd) => ({ low: Math.round(mean - sd), high: Math.round(mean + sd) });

export const REFERENCE = {
  bat: {
    pelvisPeak: { ...range(643.0, 49.7), unit: '°/s', source: 'punchihewa2020' },   // 대학 동아리 타자 8명 · 티 배팅 · 센서
    trunkPeak: { ...range(973.9, 248.0), unit: '°/s', source: 'punchihewa2020' },
  },
  pitch: {
    // 프로 투수 157명 · 카메라 8대 480Hz · 직구 8~12개 중 가장 빠른 공. 논문 표 1의 골반 열림 78명 680±93 · 닫힘 79명 666±93(차이 없음)을
    // 합친 값(가중 평균 672.96 · 합친 표준편차 92.97). 전에는 열림 그룹 값만 썼다
    pelvisPeak: { ...range(673, 93), unit: '°/s', source: 'dowling2022' },
  },
};

const SOURCE = {
  punchihewa2020: { label: 'Punchihewa 외 2020 (Sensors)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7766213/' },
  dowling2022: { label: 'Dowling 외 2022 (Orthop J Sports Med)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9720809/' },
};
const sourcesOf = (mode) => [...new Set(Object.values(REFERENCE[mode]).map((r) => r.source))].map((k) => SOURCE[k]);
export const REFERENCE_SOURCES = { bat: sourcesOf('bat'), pitch: sourcesOf('pitch') };

const CAUTION = '연구실 장비로 잰 값이에요. 장비가 다르면 평균부터 크게 달라져서 연구자들도 장비마다 기준을 따로 만들라고 권해요. 등급이 아니라 참고로만 보고, 내 지난 기록과 견줘 주세요.';
export const REFERENCE_NOTE = {
  bat: `참고 범위는 대학 동아리 타자 8명이 티 배팅을 할 때 몸에 붙인 센서로 잰 평균 ± 표준편차예요. 분리각은 연구마다 재는 구간이 달라 넣지 않았어요. ${CAUTION}`,
  pitch: `참고 범위는 프로 투수 157명이 가장 빠른 직구를 던질 때 잰 평균 ± 표준편차예요. 몸통 회전과 분리각은 연구마다 재는 방식이 달라 넣지 않았어요. ${CAUTION}`,
};
