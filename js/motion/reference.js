// 동작 분석 — 참고 범위: 연구에서 잰 선수들의 평균 ± 표준편차 (2026-11-22 에 논문 본문에서 읽은 값만 넣었다)
//  · 넣는 기준: 평균과 표준편차가 함께 실려 있고, 재는 대상이 우리 지표와 같은 것만. 출처 없이 숫자를 넣지 않는다
//  · 넣지 않은 것
//     - 프로 타자의 회전 속도: 표준편차까지 확인되는 값을 찾지 못했다(Welch 1995 골반 714°/s · Escamilla 2009 몸통 857°/s 는 평균만 확인)
//     - 투구 몸통 회전: 연구마다 값이 400°/s 가까이 다르다(프로 742 ± 221 대 대학 · 프로 1155 ± 71). 재는 방식이 달라 하나를 고를 근거가 없다
//     - 투구 분리각: 논문 값은 「앞발 착지 순간」의 값이고 우리 지표는 「최대」라서 같은 것이 아니다
//  · 이 값들은 연구실 장비(카메라 여러 대 · 초당 250~480프레임 또는 몸에 붙인 센서)로 잰 것이다.
//    휴대폰 영상 한 대로 잰 우리 값과 그대로 견줄 수 있는지는 검증하지 못했다 → 화면에서도 등급이 아니라 참고로만 보여 준다
const range = (mean, sd) => ({ low: Math.round(mean - sd), high: Math.round(mean + sd) });

export const REFERENCE = {
  bat: {
    pelvisPeak: { ...range(643.0, 49.7), unit: '°/s', source: 'punchihewa2020' },   // 대학 동아리 타자 8명 · 티 배팅 · 센서
    trunkPeak: { ...range(973.9, 248.0), unit: '°/s', source: 'punchihewa2020' },
    maxSeparation: { ...range(33.4, 4.4), unit: '°', source: 'taguchi2023' },         // 일본 대학 1부 타자 11명 · 티 배팅 · 카메라 14대 250Hz
  },
  pitch: {
    pelvisPeak: { ...range(680, 93), unit: '°/s', source: 'dowling2022' },            // 프로 투수 78명 · 카메라 8대 480Hz
  },
};

const SOURCE = {
  punchihewa2020: { label: 'Punchihewa 외 2020 (Sensors)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7766213/' },
  taguchi2023: { label: 'Taguchi 외 2023 (Fukushima J Med Sci)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10122975/' },
  dowling2022: { label: 'Dowling 외 2022 (Orthop J Sports Med)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9720809/' },
};
const sourcesOf = (mode) => [...new Set(Object.values(REFERENCE[mode]).map((r) => r.source))].map((k) => SOURCE[k]);
export const REFERENCE_SOURCES = { bat: sourcesOf('bat'), pitch: sourcesOf('pitch') };

const CAUTION = '연구실 장비로 잰 값이라, 휴대폰 영상 한 대로 잰 숫자는 이보다 낮게 나오는 경우가 많아요. 등급이 아니라 참고로만 봐 주세요.';
export const REFERENCE_NOTE = {
  bat: `참고 범위는 대학 타자들이 티 배팅을 할 때 잰 평균 ± 표준편차예요(회전 속도 8명, 분리각 11명). 프로 타자 값은 확인된 것을 찾지 못해 넣지 않았어요. ${CAUTION}`,
  pitch: `참고 범위는 프로 투수 78명의 평균 ± 표준편차예요. 몸통 회전과 분리각은 연구마다 재는 방식이 달라 넣지 않았어요. ${CAUTION}`,
};
