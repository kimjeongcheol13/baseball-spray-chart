# 한국어 글자 모델 (게임원 앱 스크린샷 가져오기용)

- 파일: `kor.traineddata` — [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) `main` 의 `kor.traineddata` 그대로 (2026-10-19 받음)
- sha256: `6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2`
- 라이선스: Apache License 2.0 (`LICENSE`)
- 쓰는 곳: `js/features/gameoneocr.js` — Tesseract.js 5.1.1 이 이 폴더를 `langPath` 로 읽는다. 사진은 휴대폰 안에서만 읽는다
- tessdata_best(12.5MB)도 실제 앱 캡처 5장에서 같은 결과였고 더 느려서 fast(1.7MB)를 쓴다
