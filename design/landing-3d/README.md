# 랜딩 3D 선수 (GLB) 작업 백업

Claude Design으로 내보낸 랜딩 페이지(`source/SprayLab_Landing.orig.html`)에 들어 있는 `<spray-play>` 3D 장면의
절차적 마네킹 12명(투수·타자·포수·심판·코치 + 야수 7명)을 사실적인 사람 GLB 몸으로 바꾼 작업이다.
앱(`index.html`, `js/`, `css/`)과는 무관한 디자인 작업 폴더이고, 배포 대상이 아니다.

- 결과물: `SprayLab_Landing.glb.html` (6.0MB, 브라우저로 바로 열림). 원본 4.87MB.
- 미리보기: `previews/compare_glb.png`(마네킹 vs GLB), `previews/jersey_print.png`(등번호·로고), `previews/mocap_preview.png`(Mixamo 동작), `previews/fielder_sheet.png`(야수 대기·달리기·받기·복귀)

## 무엇을 바꿨나

- 몸: CC0 사람 몸 + Mixamo 이름 뼈대 52개. 유니폼·벨트·양말은 정점 색, 헬멧·모자·마스크·보호대·스파이크는 뼈에 붙인 메시.
- 동작: 기존 애니메이션 코드는 그대로다. 마네킹 관절 이름(`shR`, `elR`, `hipL` …)을 보이지 않는 대리 관절로 두고
  `fig.sync()`가 매 프레임 그 회전을 실제 뼈로 옮긴다. 손은 실제 손뼈에 붙어 배트·글러브·공이 따라간다.
- 유니폼 프린트: 등번호·가슴 로고·단추줄·핀스트라이프를 셰이더에서 묶음 포즈(스키닝 전) 좌표로 투영한다.
- 투수·타자·포수·심판·야수 7명은 Mixamo 모션캡처 동작으로 움직인다(아래). 코치만 기존 마네킹 키프레임 그대로다.
- 공 크기 0.6배(사람 몸 기준). GLB 로딩이 실패하면 기존 마네킹으로, 동작 데이터가 없으면 마네킹 키프레임으로 자동 대체된다.
- 원본 템플릿에 대한 패치는 `tools/build.py` 안에 전부 있다(각 패치는 정확히 1회 매칭을 assert).

## 다시 빌드

```bash
cd design/landing-3d
python3 tools/build.py source/SprayLab_Landing.orig.html src/glbfig.js SprayLab_Landing.glb.html
```

리소스 id는 결정적(uuid5)이라 같은 입력이면 같은 결과가 나온다.
`src/glbfig.js`가 실제로 고칠 코드이고, 빌드 시 템플릿의 `makeFigure` 자리에 들어간다.

## 배포용 페이지 만들기 (`/landing.html`)

```bash
cd design/landing-3d
python3 tools/unbundle.py SprayLab_Landing.glb.html ../..
```

번들(한 파일 6MB)을 실제 페이지로 푼다. 저장소 루트의 `landing.html`, `js/landing/`(런타임·React·three.js·애드온, `?v=` 버전),
`assets/landing/`(폰트 95개·몸 GLB·동작 데이터)를 쓴다. 바뀌는 점:

- 디자인 캔버스(회색 판, "Desktop · 1440" 라벨, 두 시안 동시 표시)를 걷어내고, 화면 폭 1024px 미만이면 모바일 시안,
  이상이면 데스크톱 시안 하나만 그린다(기준선을 넘으면 바로 전환). 시안 폭을 CSS `zoom`으로 화면에 맞춘다
  (데스크톱 최대 1.25배, 모바일 0.8–1.4배).
- `window.__resources`가 런타임이 찾는 리소스 이름을 이 파일들로 연결해서 외부 CDN을 쓰지 않는다.
- 폰트는 `unicode-range`대로 필요한 글자 묶음만 받는다(첫 화면 기준 95개 중 13개).
- "차트 열기" 버튼 → 앱(`./`), GitHub 링크 → 저장소. **Instagram 링크는 주소 미정이라 `#` 그대로.**
- `sw.js`는 수정하지 않았다(HTML 네트워크 우선, 나머지 stale-while-revalidate 규칙이 그대로 적용된다).
- 스크립트를 바꾸면 `tools/unbundle.py`의 `V`를 올린다.

## 렌더 확인 (헤드리스 Chromium)

```bash
node tools/render_frames.mjs "$PWD/SprayLab_Landing.glb.html" out "1.6,2.56" 3 "440,570,300,330"
# 인자: 파일, 출력 접두어, 애니메이션 시각(초, 8초 주기의 tau), 배율, 클립(x,y,w,h, 장면 기준)
```

이 스크립트는 Claude Code 클라우드 환경의 Playwright(`/opt/node-tools`)와 Chromium(`/opt/pw-browsers`) 경로를 쓴다.
다른 환경에서는 맨 위 두 경로만 바꾸면 된다.

애니메이션 시간을 0으로 되돌려 원하는 프레임을 그린다. 되돌리기 전에 착지 표시(`e.live`)를 비우지 않으면
절대 시각을 가진 착지 원이 화면 전체를 빨갛게 덮는다. 이건 테스트 방식의 문제이고, 실제 페이지에서는 생기지 않는다.

## Mixamo 동작

사용 클립(사용자가 Mixamo에서 받은 FBX, 30fps, Without Skin)과 쓰는 구간:

| 역할 | 클립 | 구간 | 페이지 시간(tau, 8초 주기)에 맞춘 방식 |
|---|---|---|---|
| 투수 | Baseball Pitching | 0–5.2초 | 클립 시간 = tau. 오른손 속도 정점이 2.10초로 페이지의 공 놓는 순간(2.1)과 같다. 끝나면 첫 자세로 섞어 복귀 |
| 타자 | Baseball Idle → Baseball Hit_2 | 대기 0–1.5초, 스윙 0–2.2초 | 대기 반복 → 1.22초 스윙 시작 → 손 속도 정점(1.33초)이 타격 순간 2.55에 오게 맞춤 → 마무리 유지(1루로 뛰는 2.4초 이후는 자름) → 대기로 복귀 |
| 포수 | Baseball Catcher | 0–0.9초(앉은 자세) | 8초에 두 번 천천히 왕복 |
| 심판 | Baseball Umpire | 0–0.6초(대기 자세) | 위와 같음 |
| 야수 7명 | Goalkeeper Idle / Running / Goalkeeper Catch / Jogging | 대기·달리기·조깅은 전체 반복, 받기 0–0.9초(골반 수평 이동 고정) | 위치·방향은 페이지 코드가 정한다. 페이지가 넘기는 `F.run`으로 달리기를 섞고, 도착하면 받기 자세로 들어가 유지, tau 6초부터는 조깅으로 복귀. 발걸음 속도는 실제 이동 속도에 맞춰 0.9–1.6배 |

- 리타깃팅: `harness/retarget.js`. 뼈마다 원본 기본자세 대비 월드 회전 변화를 적용하되, 먼저 대상 뼈 방향을
  원본 기본자세(T자) 방향에 맞춘다(우리 몸은 A자). three.ws의 Mixamo 샘플(경례·환호)과 위 8개 클립으로 확인했다.
- 굽기: `harness/bake.html`이 위 구간을 30fps로 샘플링해 뼈 52개 로컬 회전(int16)과 골반 위치(mm)를
  `clips.json`으로 낸다(183KB, 압축 80KB). 페이지는 이 데이터만 재생하고 FBX 로더는 번들에 넣지 않는다.
- 방향: 투수는 그대로 홈(+z)을 향해 던진다. 타자는 루트를 90° 더 돌려 앞어깨가 투수를 향하게 한다.
  투수의 앞쪽 이동은 모션캡처 쪽을 쓰고, 페이지 코드의 이동 오프셋은 덮어쓴다.
- 배트: 모션캡처 타자일 때만 오른손 기준을 바꿔, 손잡이가 주먹을 손가락 마디선 방향으로 지나가게 했다.
- 페이지 패치: `makeFigure` 호출 5곳(투수·타자·포수·심판·야수)에 `role`을 붙이고, `sync(tau)`로 페이지 시간을, 야수 루프에서 `F.run`을 넘긴다(`tools/build.py`).
- 야수 확인: `node tools/render_chaser.mjs 파일 접두어 "1.5,3.4,4.85" 1 chaser 999`는 공을 쫓는 야수 근처로 카메라를 옮겨 그 프레임만 다시 그린다(확인용, 페이지에는 영향 없음).

### 다시 굽기

1. Mixamo FBX(위 표의 9개)를 `harness/clips/`에 넣는다. 파일명은 `Baseball_Pitching.fbx`처럼 Mixamo 이름 그대로다.
2. 이 폴더를 정적 서버로 띄우고(`python3 -m http.server`) `harness/bake.html`을 열면 콘솔에 `BAKE {...}`가 찍힌다.
   그 JSON을 `harness/clips/clips.json`으로 저장한다(`harness/analyze.html`, `harness/traj.html`은 구간을 고를 때 쓴 분석 페이지).
3. `tools/build.py`를 다시 돌린다. `clips.json`이 있으면 자동으로 번들에 들어간다.

- Mixamo FBX와 `clips.json`은 Adobe 약관상 원본 재배포가 제한될 수 있어 커밋하지 않는다(`harness/clips/`는 gitignore).
  결과물 HTML에는 제품 사용 목적으로 구운 데이터가 들어 있다.

## 출처 / 라이선스

- `assets/body.glb`: three.ws 저장소(Apache-2.0)의 `public/avatars/parametric-base.glb`에서 표정 morph 306개와
  눈·치아·혀 메시를 제거한 것(6.8MB → 1.16MB, `tools/strip_glb.py`). 원 데이터는 MakeHuman/MPFB2 기본 메시를
  naver/anny가 재포장한 **CC0 1.0** 자료다(`assets/LICENSE-CC0.md`). 저작자 표시 의무는 없다.
- `vendor/three-0.184.0/`: three.js 0.184.0 애드온(GLTFLoader, SkeletonUtils, BufferGeometryUtils, FBXLoader 등), **MIT**(`LICENSE`).
  번들에 들어 있는 three.js 코어와 같은 버전이다(바이트 단위로 일치 확인).
- 랜딩 디자인 원본은 SprayLab 작업물이다.

## 확인하지 못한 것

- 실제 휴대폰 성능: 스키닝 메시 12개(+모바일 아트보드 12개)를 그린다. 헤드리스 소프트웨어 렌더러로만 확인했다.
- 연속 재생: 정지 프레임으로만 확인했다. 동작이 바뀌는 구간이 자연스러운지는 브라우저에서 직접 봐야 한다.
