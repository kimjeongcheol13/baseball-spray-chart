# AI 훈련 코치 (SprayLab Motion · 베타)

동작 분석(motion.html) 타격 · 투구 결과 화면의 숫자 칸 아래에 있는 「훈련 방향 받기」 버튼.
이번 측정을 같은 선수의 지난 기록과 견주고, 훈련 카드 목록에서 1~2장을 골라 쉬운 말로 설명한다. 카드마다 어떤 연구에 기대는지(근거 수준 · 논문)를 함께 보여 준다 — `docs/EVIDENCE.md`.
**서버, API 키, 외부 AI API 를 쓰지 않는다. 영상과 숫자는 기기 밖으로 나가지 않는다.**

## 1. 흐름

| 단계 | 누가 | 하는 일 |
|---|---|---|
| 0. 스냅숏 | 코드 | 「측정 숫자 내보내기(JSON)」와 같은 함수(`page-export.js` `currentExport`)로 지금 분석 + 같은 선수 · 같은 동작의 지난 기록을 모은다. 이름 대신 익명 ID |
| 1. 측정 점검 | 코드 | 초당 프레임(50 미만이면 회전 속도 제외 · 회전 순서는 120 미만이면 제외) · 흔들림 폭(값의 25% 넘으면 제외) · 못 찾은 순간 · 골반 · 몸통 · 손 피크 시각(없으면 회전 순서 제외) · 신뢰도. 쓸 숫자가 3개 미만이거나 신뢰도 「낮음」이면 **멈추고 다시 찍기 안내** |
| 2. 비교 분석 | 코드 | 지난 기록과 차이(두 기록 흔들림 폭 합보다 크고 5% 이상) · 회전 순서(뒤 부위가 앞 부위보다 2프레임 이상 먼저 가장 빨라졌을 때만 「어긋남」) → 조건이 맞는 카드 = 후보. **참고 범위로는 고르지 않는다**(연구실 장비 값과 휴대폰 값은 장비가 달라 바로 견줄 수 없다). 지난 기록이 없으면 회전 순서만 본다 |
| 3. 훈련 방향 | AI | 후보 안에서만 1~2장 고르기. 출력은 JSON 하나: `{picked:[{card_id, reason(60자), numbers_used:[key]}], summary(80자)}` |
| 4. 검사 | 코드 | 후보 안의 카드인지 · 근거 숫자가 1단계를 통과한 숫자인지 · 글자 수 · 금지 표현(부상 · 예방 · 치료 · 의학 조언, 「정확하다」 단정, 프로 · 국가대표 과장, 연구 · 논문 · 출처 · 효과 · 구속 · 타구 속도 · 배트 속도 — 근거는 AI 가 아니라 카드 데이터에서만 보여 준다) · 「~요.」로 끝난 문장인지(잘린 문장 · 「~다」체 막기) · 영어 낱말이 없는지. 틀리면 이유를 붙여 3단계를 최대 2번 다시. 그래도 틀리거나 90초가 지나면 **규칙 결과** |

규칙 결과(AI 없이) = 후보 중 차이가 큰 순서로 1~2장, 설명은 카드의 `why` 그대로.
단계마다 남긴 문장은 결과 아래 「과정 보기」에서 볼 수 있다.

AI 에게는 카드의 긴 설명(why)을 주지 않고 제목만 준다(주면 그대로 베껴 글자 수를 넘겼다). 출력 모양(JSON schema)으로 카드 id · 숫자 key · 글자 수를 미리 묶는다.

코드: `js/motion/coach.js`(1~4단계, 순수 함수) · `coach-llm.js` · `coach-worker.js`(AI) · `page-coach.js`(화면). 시험: `node tests/run.mjs motion-coach`.

## 2. 훈련 카드

`assets/motion/drills_batting.json` · `assets/motion/drills_pitching.json`. 판단 기준은 코드가 아니라 이 파일에 있다.

```json
{
  "id": "bat_hip_turn",
  "motion_type": "batting",
  "title": "하체부터 돌리기 — 골반 회전",
  "when": [{ "metric": "pelvis_peak_velocity", "is": "lower_than_last" }],
  "why": "왜 이 훈련인지 (AI 없이 받을 때 이 문장이 그대로 나간다)",
  "how": ["2~4단계"],
  "caution": "주의",
  "evidence": { "status": "draft", "level": "mixed", "summary": "연구가 말하는 것 · 말하지 않는 것 (「~요.」)", "refs": ["sinclair2017", "bannister2024"] }
}
```

- `when.metric` = Motion 이 실제로 재는 key(`MOTION_EXPORT.md`) 또는 `rotation_sequence`. 하나라도 맞으면 후보.
- `when.is` = `lower_than_last` · `higher_than_last` · `sequence_off`. 참고 범위(`below_ref` · `above_ref`)는 쓰지 않는다.
- 투구 카드는 팔 · 손목 지표(`throwing_elbow_angle` · `arm_slot_angle`)를 쓰지 않는다.
- `evidence.refs` = `assets/motion/evidence.json` 의 논문 id(그 논문의 `cards` 에도 카드 id 가 있어야 한다). `evidence.level` = `supported`(뒷받침하는 연구 있음) · `mixed`(연구 결과 엇갈림) · `weak`(관련 연구 약함) · `context`(직접 근거 없음 · 확인용). `summary` 는 화면 「근거 자세히」에 그대로 나간다.
- 논문을 넣고 고르는 기준은 `docs/EVIDENCE.md`.

### 승인 절차

1. 지도자가 검증 모드(아래)로 실제 선수 기록에 카드를 써 보고 [맞음] [고칠 필요] [틀림]과 메모를 남긴다.
2. 검증 기록 파일을 보고 카드 문장 · 조건을 고친다(PR).
3. 지도자가 확인한 카드만 `evidence.status` 를 `coach_approved` 로 바꾸고 `evidence.approved_by`(이름 대신 역할, 예: 「대학팀 코치」) · `evidence.approved_at`(날짜)을 적는다(PR).
4. 카드 파일을 고치면 `drills_*.json` 의 `version` 과 `page-coach.js` 의 `drills_*.json?v=`, importer 의 `?v=` 를 올린다. `evidence.json` 을 고치면 그 `version` 과 `evidence.json?v=` 를 올린다.

**일반 모드는 `coach_approved` 카드가 1장이라도 있어야 버튼이 보이고, 승인 카드만 쓴다.** 지금은 전부 `draft` 라 일반 화면에는 버튼이 없다.

## 3. 검증 모드 (대학팀 현장 검증 · 시연)

주소 끝에 `?mode=verify` — `…/motion.html?mode=verify`

- 초안 카드까지 쓰고 결과 위에 「검증용 초안」을 붙인다.
- 카드마다 지도자 확인 [맞음] [고칠 필요] [틀림] + 한 줄 메모.
- 선수 질문: 「이 결과를 받으려고 한 달 3만 원을 내시겠어요?」 [낸다] [안 낸다] [모르겠다].
- 「이 검증 기록 저장」 → 이 기기 localStorage `sl_motion_verify`. 아래에 「응답 n명 중 '낸다' m명 (통과 기준: 15명 중 3명)」.
- 「검증 기록 내보내기」 → `spraylab-verify_{YYYYMMDD}.json` (스냅숏 · 코치 결과 · 지도자 확인 · 선수 응답 · 그때 쓴 근거 목록 버전 `evidence_version`. 익명 ID 만).
- 카드마다 「근거 자세히」를 열어 지도자가 연구 요약 · 한계를 같이 보고 판단한다.

**선수(미성년이면 보호자)에게 먼저 설명하고 동의를 받은 뒤 쓴다**: 영상을 찍어 이 폰에서만 분석한다는 것, 숫자와 응답을 익명 ID 로 파일에 모아 검증에 쓴다는 것, 원하면 언제든 빼 준다는 것.
검증 기록 파일은 연구 담당자에게만 직접 전달하고, 끝나면 지운다.

## 4. 개인정보

- 네트워크는 **AI 모델 파일 내려받기에만** 쓴다: web-llm 라이브러리(jsDelivr) · 모델 가중치(Hugging Face) · 실행 파일(GitHub raw). 사용자 데이터가 담긴 요청은 없다. 동의 창에서 「AI로 받기」를 누르기 전에는 라이브러리도 받지 않는다.
- AI 는 Web Worker 안에서 돈다. 질문(숫자 · 카드 목록)과 답은 기기 밖으로 나가지 않는다.
- 결과는 `sl_motion_coach`, 검증 기록은 `sl_motion_verify`(localStorage)에만. 기록 동기화(`sl_motion_log`)에 넣지 않아 로그인해도 서버로 가지 않는다.
- 「그림으로 저장」 PNG 는 기기 안 캔버스로 만들어 바로 내려받는다(올리지 않는다).
- 서비스 워커는 모델 파일 주소(huggingface.co · *.hf.co · raw.githubusercontent.com)를 가로채지 않는다. 모델은 web-llm 이 Cache Storage `webllm/*` 에 한 번 넣는다.

## 5. 지원 기기 · AI 없이 모드

- 모델: `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (web-llm 0.2.88 기본 목록에 있는 모델 · 약 880MB · GPU 메모리 약 1.6GB). 더 작은 0.5B(285MB)는 실제로 돌려 보니 한국어 요약이 문장이 되지 않아 뺐다.
- 2026-11-28 실측(노트북 Intel Arc 내장 GPU · Chrome): 처음 받기 약 880MB, 받은 뒤 버튼 → 결과 약 30초. 같은 기록 3번 모두 AI 결과가 4단계를 통과(되돌림 1번 뒤). 문장은 짧고 단순하며 가끔 어색하다 → 그래서 지도자 확인 전에는 초안으로만 쓴다.
- AI 로 받으려면 **WebGPU + 16비트 셰이더(shader-f16)** 가 되는 브라우저: 데스크톱 Chrome · Edge 113+, 안드로이드 Chrome 121+(최근 기기). iPhone Safari 는 iOS 26 이상에서 WebGPU 가 켜져 있을 때만.
- 안 되는 기기(WebGPU 없음 · 소프트웨어 GPU · shader-f16 없음 · 모델 불러오기 실패)는 자동으로 **AI 없이**: 같은 카드 규칙으로 결과를 내고 「과정 보기」 3단계에 이유를 적는다. 이때도 서버는 없다.
- 처음 쓸 때 동의 창: 「AI 파일(약 880MB)을 한 번 내려받습니다. 와이파이에서 받는 걸 권합니다. 영상과 숫자는 폰 밖으로 나가지 않습니다.」 [AI로 받기] [AI 없이 받기]. 한 번 받으면 다음부터는 묻지 않는다.
- 다시 찍기 · 맞는 카드 없음이면 AI 를 부르지 않는다(모델도 받지 않는다).
