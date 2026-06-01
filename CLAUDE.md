# CLAUDE.md

## 프로젝트
SprayLab — 아마추어 야구용 스프레이 차트 웹앱  
URL: kimjeongcheol13.github.io/baseball-spray-chart/

## 스택
- 바닐라 JS / HTML / CSS
- GitHub Pages 배포
- LocalStorage (서버 없음)

## 규칙
- 완성형 코드만 (설명 최소화)
- 모르면 추측하지 말고 질문
- 모바일 우선 고려

## 작업 요청 형식
종류: 기능추가|버그수정|코드개선  
상황:  
목표:  
코드: (선택)

---

## 지표 공식

**공유 가중치 (WOBA_W)** — `js/constants.js`
```js
export const WOBA_W = { bb: 0.69, hbp: 0.72, s1: 0.89, s2: 1.27, s3: 1.62, hr: 2.10 };
```

**wOBA**
```
분자: WOBA_W.bb*bb + WOBA_W.hbp*hbp + WOBA_W.s1*1B + WOBA_W.s2*2B + WOBA_W.s3*3B + WOBA_W.hr*HR
분모: AB + BB + HBP + SF
```

**OBP**
```
분자: H + BB + HBP
분모: AB + BB + HBP + SF
```

**주의**
- `bb` = 볼넷만 (`a.res === '볼넷'`) — 사구 미포함
- `hbp` = 사구만 (`a.res === '사구'`)
- compare / profile / scouting 모두 `WOBA_W` 공유
- `bbRate` = `bb / pa` (볼넷%만, 사구 제외)
