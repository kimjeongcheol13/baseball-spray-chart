# CLAUDE.md — SprayLab 개발 규칙

한국 아마추어 야구용 스프레이차트/타석 기록 웹앱
URL: kimjeongcheol13.github.io/baseball-spray-chart/

## Stack
- Vanilla JS / HTML / CSS, 빌드 없음, 서버 없음
- GitHub Pages 배포, 저장은 localStorage
- 외부: LZ-String, QRCode.js, XLSX.js, Canvas 2D, Supabase(선택 동기화, `_sb` null 가드), Kakao SDK, Formspree, GA4
- JS는 js/, 스타일은 css/(탭별 분리)에 있다. 파일 위치는 직접 찾는다.

## Rules
- 기존 JS 로직/데이터 구조는 수정하지 않는다. 추가 또는 최소 패치만 한다.
- 서버/빌드/프레임워크 도입이 필요하면 구현 전에 이유를 먼저 보고한다.
- 모르면 추측하지 말고 질문한다.
- 모바일 수정은 @media (max-width: 720px) 안에서만. 데스크톱 스타일은 건드리지 않는다.
- 터치 타겟은 최소 44×44px.
- JS 수정 시 script 태그의 ?v= 버전을 올린다.
- sw.js 수정 시 캐시명 버전을 올리고, activate에서 현재 캐시는 제외한 뒤 삭제한다.
- localStorage 키는 sl_ 접두사. 기존 키 이름은 바꾸지 않는다.

## 지표 공식
공유 가중치 (WOBA_W) — js/constants.js
export const WOBA_W = { bb: 0.69, hbp: 0.72, s1: 0.89, s2: 1.27, s3: 1.62, hr: 2.10 };

wOBA
분자: WOBA_W.bb*bb + WOBA_W.hbp*hbp + WOBA_W.s1*1B + WOBA_W.s2*2B + WOBA_W.s3*3B + WOBA_W.hr*HR
분모: AB + BB + HBP + SF

OBP
분자: H + BB + HBP
분모: AB + BB + HBP + SF

주의
- bb = 볼넷만 (a.res === '볼넷') — 사구 미포함
- hbp = 사구만 (a.res === '사구')
- compare / profile / scouting 모두 WOBA_W 공유
- bbRate = bb / pa (볼넷%만, 사구 제외)

## 완료 보고
수정한 파일 / 변경 요약 3줄 / 확인 방법
