# 글자 모델 (게임원 앱 스크린샷 가져오기용)

- `kor.traineddata` — [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) `main` 의 한국어 모델 그대로 (2026-10-19 받음)
  - sha256: `6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2`
- `eng.traineddata` — 같은 저장소의 영어 모델 그대로 (2026-10-20 추가). 포지션(P · RF · 1B …)과 영문 팀 이름만 이걸로 읽는다
  - sha256: `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2`
- 라이선스: Apache License 2.0 (`LICENSE`)
- 쓰는 곳: `js/features/gameoneocr.js` — Tesseract.js 5.1.1 이 이 폴더를 `langPath` 로 읽는다. 사진은 휴대폰 안에서만 읽는다
- tessdata_best(한국어 12.5MB)도 실제 앱 캡처에서 같은 결과였고 더 느려서 fast 를 쓴다. 한국어+영어를 섞은 한 모델(kor+eng)은 한글 칸이 흐려져 쓰지 않는다
