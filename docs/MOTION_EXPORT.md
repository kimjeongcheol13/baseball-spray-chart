# SprayLab Motion — 측정 숫자 JSON 내보내기 (schema 1.0)

동작 분석(motion.html) 결과 화면의 「숫자로 보기」 아래 **측정 숫자 내보내기(JSON)** 버튼이 만드는 파일의 설명이다.
훈련 방향 에이전트(Python, 따로 만든다)가 이 파일을 입력으로 읽는다.

- 파일은 브라우저에서 바로 내려받는다. 서버로는 아무것도 보내지 않는다.
- 들어가는 것: 앱이 이미 계산한 숫자, 흔들림 폭(±), 참고 범위, 단계 시각, 회전 순서.
- 들어가지 않는 것: 영상, 프레임 이미지, 썸네일, 프레임별 관절 좌표, 선수 이름.
- 코드: `js/motion/export.js`(순수 함수), `js/motion/page-export.js`(버튼 · 저장소 읽기). 테스트: `tests/motion-export.test.js`.
- 파일 이름: `spraylab-motion_{익명ID}_{YYYYMMDD-HHmm}.json` (이 기기 시각).

## 무엇이 들어가나

- **지금 화면의 분석** + 저장한 기록 중 **선수 이름 칸이 같은 기록**(타격 · 투구 모두)을 `recorded_at` 오래된 순으로 넣는다.
  이름 앞뒤 공백은 무시한다. 이름 칸이 비어 있으면 이름 없이 저장한 기록끼리 묶인다(여러 사람이 섞일 수 있다).
- 지금 분석이 이미 저장한 기록과 같으면(종류 · 좌우 · 구간 · 숫자가 같음) 한 번만 들어간다. 아직 저장하지 않았으면 `session_id: "unsaved"` 로 들어간다.
- 저장한 기록은 `sl_motion_log`(localStorage)에서 읽는다. 단계 시각은 이 기기 IndexedDB(`sl_motion` · `clips`)에 남은 관절 좌표로 지금 코드가 다시 찾는다.
  좌표가 이 기기에 없는 기록(숫자만 저장, 다른 기기에서 넘어와 아직 안 받은 것)은 `phases: []`, `duration_s: null` 이다. 좌표를 받으러 서버에 가지 않는다.

## 필드

| 필드 | 형식 | 설명 |
|---|---|---|
| `schema_version` | string | `"1.0"`. 필드를 바꾸면 올린다. |
| `exported_at` | ISO 8601 (UTC) | 내보낸 시각. |
| `app.name` | string | `"SprayLab Motion"` |
| `app.version` | string \| null | motion.html 이 부르는 `app.js?v=` 번호. |
| `player.id` | string | 익명 ID(`p` + 16진수 8자리). 이 기기에서 선수 이름마다 한 번 만들고 다시 쓴다(`sl_motion_export_ids`). 다른 기기 · 브라우저에서는 다른 ID 가 된다. |
| `player.bats` / `player.throws` | `"R"` \| `"L"` \| null | 가장 최근 타격 · 투구 기록의 좌우. 그 종류의 기록이 없으면 null. |
| `sessions[]` | array | 기록 하나 = session 하나. 오래된 순. |
| `session_id` | string | 저장 기록 id(저장 시각 ms). 저장 전이면 `"unsaved"`. |
| `recorded_at` | ISO 8601 | 기록을 저장한 시각(저장 전이면 내보낸 시각). 영상을 찍은 시각이 아니다. |
| `motion_type` | `"batting"` \| `"pitching"` \| `"unknown"` | |
| `hand` | `"R"` \| `"L"` | 이 기록의 좌우(우타 · 우투 = R). schema 예시에 없던 필드. |
| `quality` | `"high"` \| `"mid"` \| `"low"` | 앱의 신뢰도. `low` 기록의 숫자는 참고만. schema 예시에 없던 필드. |
| `video.fps` | number | 실제 시간 기준 초당 프레임(슬로모션이면 배속을 곱한 값). |
| `video.width` / `height` | number \| null | 지금 화면에 영상이 열려 있을 때만. 저장 기록은 null. |
| `video.duration_s` | number \| null | 분석 구간 길이(실제 시간 초). 좌표가 없으면 null. |
| `video.view` | `"unknown"` | 촬영 방향(옆 · 정면)은 앱이 판정하지 않는다. |
| `phases[]` | `{ name, time_s }` | 분석 구간 첫 프레임부터의 실제 시간(초). 찾지 못한 순간은 `time_s: null`. |
| `metrics[]` | 아래 표 | 값은 정수로 반올림해 저장된 값. 잴 수 없으면 `value: null`. |
| `metrics[].uncertainty` | number \| null | 흔들림 폭(±, 값과 같은 단위). 아래 「흔들림 폭」. |
| `metrics[].phase` | string \| null | 그 값을 잰 순간. 구간 안 최댓값 · 두 순간 사이 값이면 null. |
| `metrics[].ref_range` | `[low, high]` \| null | 연구 평균 ± 표준편차. |
| `metrics[].ref_source` | string \| null | 출처 이름 + 주소. |
| `sequence.order` | `["pelvis","trunk","hand"]` 등 | 최고 속도에 닿은 차례(이른 것부터). 찾지 못한 부위는 빠진다. |
| `sequence.estimated` | `true` | 카메라 한 대로 추정한 순서라 늘 true. `hand` 는 손목 위치로 추정한 값. |

### phases

| name | 판정 방식 (`js/motion/analyze.js`) |
|---|---|
| `foot_strike` | 앞발 착지. 임팩트 · 릴리스 전 1초 안에서 화면 속 앞 발목이 가장 빨랐던 뒤 그 속도의 20% 아래로 떨어진 첫 프레임. 앞발이 다리 길이/초 0.5 보다 느리게만 움직였으면 null. 타격 · 투구 공통. |
| `contact` (타격) / `ball_release` (투구) | 손이 가장 빠른 프레임(타격 = 두 손목 가운데, 투구 = 던지는 손목, 골반 기준 3D 속도). 사용자가 「지금 프레임을 임팩트/릴리스로」로 직접 정했으면 그 프레임. 공 · 배트를 보는 것이 아니라 추정이다. |
| `pelvis_peak` / `trunk_peak` | 임팩트 · 릴리스 0.5초 전 ~ 0.15초 뒤 구간에서 골반선 · 어깨선이 타깃 쪽으로 가장 빠르게 돈 프레임. |
| `hand_peak` | 같은 구간에서 손이 가장 빠른 프레임(보통 `contact`/`ball_release` 와 같다). |

### metrics key (바꾸지 않는다)

| key | 앱 이름 | 단위 | phase | 타격 | 투구 | 흔들림 폭 | 참고 범위 |
|---|---|---|---|:-:|:-:|:-:|---|
| `pelvis_peak_velocity` | 골반 회전 피크 | deg/s | null | ○ | ○ | ○ | 타격 593–693 · 투구 580–766 |
| `trunk_peak_velocity` | 몸통 회전 피크 | deg/s | null | ○ | ○ | ○ | 타격 726–1222 · 투구 없음 |
| `max_hip_shoulder_separation` | 최대 분리각 | deg | null | ○ | ○ | ○ | 없음(정의가 달라 뺐다 · docs/EVIDENCE.md) |
| `stride_length` | 스트라이드 폭 | pct_leg_length | null | ○ | ○ | – | 없음 |
| `lead_knee_angle` | 임팩트 · 릴리스 앞무릎 | deg | contact / ball_release | ○ | ○ | – | 없음 |
| `trunk_tilt` | 임팩트 · 릴리스 몸통 기울기 | deg | contact / ball_release | ○ | ○ | – | 없음 |
| `head_displacement` | 머리 이동 | pct_leg_length | null (착지 → 임팩트 사이) | ○ | – | – | 없음 |
| `throwing_elbow_angle` | 착지 팔꿈치 | deg | foot_strike | – | ○ | – | 없음 |
| `arm_slot_angle` | 릴리스 팔 높이 | deg | ball_release | – | ○ | – | 없음 |
| `pelvis_to_trunk_peak_gap` | 골반 → 몸통 피크 간격 | ms | null | ○ | ○ | – | 없음 |

- `pct_leg_length` = 다리 길이(엉덩이 → 무릎 → 발목) 대비 %.
- `stride_length` 는 구간 안 두 발목 사이 수평 거리의 최댓값. `head_displacement` 는 착지(없으면 구간 시작) → 임팩트 사이 코 위치가 움직인 거리.
- `pelvis_to_trunk_peak_gap` = `trunk_peak` − `pelvis_peak` (ms, 음수면 몸통이 먼저). 좌표가 이 기기에 없는 저장 기록은 null(앱이 저장해 두지 않는 값이다). 한 프레임 간격(1000 / fps ms)보다 작은 차이는 가릴 수 없다.

### 흔들림 폭 (`js/motion/spread.js`)

같은 영상에서 계산 방법을 조금씩 바꿔 다시 계산하고, 처음 값에서 가장 멀어진 거리를 폭으로 쓴다.
1) 평활 폭을 0.6배 · 1.6배로, 2) 골반 피크 · 몸통 피크 · 분리각 최대 프레임과 그 앞뒤 1프레임을 하나씩 「사람 못 찾음」으로 바꿔서. 임팩트 · 릴리스 프레임은 고정.
분리각이 동작 내내 15° 미만으로만 변했으면(골반선 · 어깨선이 처음부터 어긋나게 잡힌 것) 그 평균 크기만큼 폭을 넓힌다.
골반 · 몸통 회전 피크와 분리각에만 있다. 같은 영상 안의 흔들림이라, 다시 찍거나 선수가 가려지면 이보다 더 달라질 수 있다. 예전 기록(흔들림 폭 기능 전)은 null.

### 참고 범위 (`js/motion/reference.js`)

연구실 장비(카메라 여러 대 250~480Hz 또는 몸에 붙인 센서)로 잰 평균 ± 표준편차. 휴대폰 한 대로 잰 값과 그대로 견줄 수 있는지는 검증하지 않았다. 등급 기준으로 쓰지 말 것. AI 훈련 코치도 이 범위로 카드를 고르지 않는다(지난 기록과의 차이로만).

- 타격 골반 · 몸통: Punchihewa 외 2020 (Sensors), 대학 동아리 타자 8명 · 티 배팅 · 센서 — https://pmc.ncbi.nlm.nih.gov/articles/PMC7766213/
- 투구 골반: Dowling 외 2022 (Orthop J Sports Med), 프로 투수 157명(골반 열림 78 · 닫힘 79 합친 값) · 카메라 8대 480Hz — https://pmc.ncbi.nlm.nih.gov/articles/PMC9720809/

### 회전 순서

`pelvis_peak` · `trunk_peak` · `hand_peak` 프레임을 이른 순서로 늘어놓는다. 골반 ≤ 몸통 ≤ 손이면 앱은 「골반부터 차례로」라고 말한다. 타격 · 투구 같은 방식.

## 예시 (가짜 값)

타격 1개(좌표가 없는 저장 기록)와 투구 1개(지금 분석, 저장 전).

```json
{
  "schema_version": "1.0",
  "exported_at": "2026-11-28T03:04:00.000Z",
  "app": { "name": "SprayLab Motion", "version": "31" },
  "player": { "id": "p3f9a01c2", "bats": "R", "throws": "R" },
  "sessions": [
    {
      "session_id": "1763600000000",
      "recorded_at": "2026-11-20T01:00:00.000Z",
      "motion_type": "batting",
      "hand": "R",
      "quality": "mid",
      "video": { "fps": 120, "width": null, "height": null, "duration_s": null, "view": "unknown" },
      "phases": [],
      "metrics": [
        { "key": "pelvis_peak_velocity", "label": "골반 회전 피크", "value": 610, "unit": "deg/s", "uncertainty": 40, "phase": null, "ref_range": [593, 693], "ref_source": "Punchihewa 외 2020 (Sensors) https://pmc.ncbi.nlm.nih.gov/articles/PMC7766213/" },
        { "key": "trunk_peak_velocity", "label": "몸통 회전 피크", "value": 820, "unit": "deg/s", "uncertainty": 55, "phase": null, "ref_range": [726, 1222], "ref_source": "Punchihewa 외 2020 (Sensors) https://pmc.ncbi.nlm.nih.gov/articles/PMC7766213/" },
        { "key": "max_hip_shoulder_separation", "label": "최대 분리각", "value": 31, "unit": "deg", "uncertainty": 6, "phase": null, "ref_range": null, "ref_source": null },
        { "key": "stride_length", "label": "스트라이드 폭", "value": 88, "unit": "pct_leg_length", "uncertainty": null, "phase": null, "ref_range": null, "ref_source": null },
        { "key": "lead_knee_angle", "label": "임팩트 앞무릎", "value": 160, "unit": "deg", "uncertainty": null, "phase": "contact", "ref_range": null, "ref_source": null },
        { "key": "trunk_tilt", "label": "임팩트 몸통 기울기", "value": 25, "unit": "deg", "uncertainty": null, "phase": "contact", "ref_range": null, "ref_source": null },
        { "key": "head_displacement", "label": "머리 이동", "value": 12, "unit": "pct_leg_length", "uncertainty": null, "phase": null, "ref_range": null, "ref_source": null },
        { "key": "pelvis_to_trunk_peak_gap", "label": "골반 → 몸통 피크 간격", "value": null, "unit": "ms", "uncertainty": null, "phase": null, "ref_range": null, "ref_source": null }
      ],
      "sequence": { "order": ["pelvis", "trunk", "hand"], "estimated": true }
    },
    {
      "session_id": "unsaved",
      "recorded_at": "2026-11-28T03:04:00.000Z",
      "motion_type": "pitching",
      "hand": "R",
      "quality": "high",
      "video": { "fps": 240, "width": 1920, "height": 1080, "duration_s": 2.4, "view": "unknown" },
      "phases": [
        { "name": "foot_strike", "time_s": 1.5 },
        { "name": "ball_release", "time_s": 1.65 },
        { "name": "pelvis_peak", "time_s": 1.558 },
        { "name": "trunk_peak", "time_s": 1.604 },
        { "name": "hand_peak", "time_s": 1.65 }
      ],
      "metrics": [
        { "key": "pelvis_peak_velocity", "label": "골반 회전 피크", "value": 640, "unit": "deg/s", "uncertainty": 35, "phase": null, "ref_range": [580, 766], "ref_source": "Dowling 외 2022 (Orthop J Sports Med) https://pmc.ncbi.nlm.nih.gov/articles/PMC9720809/" },
        { "key": "trunk_peak_velocity", "label": "몸통 회전 피크", "value": 910, "unit": "deg/s", "uncertainty": 60, "phase": null, "ref_range": null, "ref_source": null },
        { "key": "max_hip_shoulder_separation", "label": "최대 분리각", "value": 38, "unit": "deg", "uncertainty": 7, "phase": null, "ref_range": null, "ref_source": null },
        { "key": "stride_length", "label": "스트라이드 폭", "value": 82, "unit": "pct_leg_length", "uncertainty": null, "phase": null, "ref_range": null, "ref_source": null },
        { "key": "lead_knee_angle", "label": "릴리스 앞무릎", "value": 152, "unit": "deg", "uncertainty": null, "phase": "ball_release", "ref_range": null, "ref_source": null },
        { "key": "trunk_tilt", "label": "릴리스 몸통 기울기", "value": 33, "unit": "deg", "uncertainty": null, "phase": "ball_release", "ref_range": null, "ref_source": null },
        { "key": "throwing_elbow_angle", "label": "착지 팔꿈치", "value": 92, "unit": "deg", "uncertainty": null, "phase": "foot_strike", "ref_range": null, "ref_source": null },
        { "key": "arm_slot_angle", "label": "릴리스 팔 높이", "value": 41, "unit": "deg", "uncertainty": null, "phase": "ball_release", "ref_range": null, "ref_source": null },
        { "key": "pelvis_to_trunk_peak_gap", "label": "골반 → 몸통 피크 간격", "value": 46, "unit": "ms", "uncertainty": null, "phase": null, "ref_range": null, "ref_source": null }
      ],
      "sequence": { "order": ["pelvis", "trunk", "hand"], "estimated": true }
    }
  ]
}
```

## 아직 없는 값 (null 로 나간다)

- `video.view`: 촬영 방향 판정이 앱에 없다 → 늘 `"unknown"`.
- `video.width` / `height`: 저장 기록에는 남기지 않는다(지금 열린 영상만).
- 저장 기록의 `phases` · `duration_s` · `pelvis_to_trunk_peak_gap`: 이 기기에 관절 좌표가 없으면 비어 있다.
- 참고 범위: 투구 몸통 회전 · 투구 분리각 · 자세 지표 전부(근거 있는 값을 찾지 못했다, `reference.js` 주석).
- 흔들림 폭: 자세 지표(스트라이드 · 무릎 · 기울기 · 머리 · 팔꿈치 · 팔 높이)와 피크 간격에는 계산이 없다.
