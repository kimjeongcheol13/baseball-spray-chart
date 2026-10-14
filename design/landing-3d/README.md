# 랜딩 3D 선수 (GLB) 작업 백업

Claude Design으로 내보낸 랜딩 페이지(`source/SprayLab_Landing.orig.html`)에 들어 있는 `<spray-play>` 3D 장면의
절차적 마네킹 11명(투수·타자·포수·심판·코치·야수)을 사실적인 사람 GLB 몸으로 바꾼 작업이다.
앱(`index.html`, `js/`, `css/`)과는 무관한 디자인 작업 폴더이고, 배포 대상이 아니다.

- 결과물: `SprayLab_Landing.glb.html` (5.7MB, 브라우저로 바로 열림). 원본 4.87MB.
- 미리보기: `previews/compare_glb.png`(마네킹 vs GLB), `previews/jersey_print.png`(등번호·로고)

## 무엇을 바꿨나

- 몸: CC0 사람 몸 + Mixamo 이름 뼈대 52개. 유니폼·벨트·양말은 정점 색, 헬멧·모자·마스크·보호대·스파이크는 뼈에 붙인 메시.
- 동작: 기존 애니메이션 코드는 그대로다. 마네킹 관절 이름(`shR`, `elR`, `hipL` …)을 보이지 않는 대리 관절로 두고
  `fig.sync()`가 매 프레임 그 회전을 실제 뼈로 옮긴다. 손은 실제 손뼈에 붙어 배트·글러브·공이 따라간다.
- 유니폼 프린트: 등번호·가슴 로고·단추줄·핀스트라이프를 셰이더에서 묶음 포즈(스키닝 전) 좌표로 투영한다.
- 공 크기 0.6배(사람 몸 기준). GLB 로딩이 실패하면 기존 마네킹으로 자동 대체된다.
- 원본 템플릿에 대한 패치는 `tools/build.py` 안에 전부 있다(각 패치는 정확히 1회 매칭을 assert).

## 다시 빌드

```bash
cd design/landing-3d
python3 tools/build.py source/SprayLab_Landing.orig.html src/glbfig.js SprayLab_Landing.glb.html
```

리소스 id는 결정적(uuid5)이라 같은 입력이면 같은 결과가 나온다.
`src/glbfig.js`가 실제로 고칠 코드이고, 빌드 시 템플릿의 `makeFigure` 자리에 들어간다.

## 렌더 확인 (헤드리스 Chromium)

```bash
node tools/render_frames.mjs "$PWD/SprayLab_Landing.glb.html" out "1.6,2.56" 3 "440,570,300,330"
# 인자: 파일, 출력 접두어, 애니메이션 시각(초, 8초 주기의 tau), 배율, 클립(x,y,w,h, 장면 기준)
```

이 스크립트는 Claude Code 클라우드 환경의 Playwright(`/opt/node-tools`)와 Chromium(`/opt/pw-browsers`) 경로를 쓴다.
다른 환경에서는 맨 위 두 경로만 바꾸면 된다.

애니메이션 시간을 0으로 되돌려 원하는 프레임을 그린다. 되돌리기 전에 착지 표시(`e.live`)를 비우지 않으면
절대 시각을 가진 착지 원이 화면 전체를 빨갛게 덮는다. 이건 테스트 방식의 문제이고, 실제 페이지에서는 생기지 않는다.

## 다음 작업: Mixamo 동작

- `harness/retarget.js`: Mixamo 클립(T자 기본자세)을 이 몸(A자 기본자세)에 옮기는 리타깃터.
  three.ws 저장소의 Mixamo 샘플(경례, 환호)로 동작을 확인했다.
- `harness/retarget_test.html`: 테스트 페이지. `harness/clips/`에 FBX를 넣고 이 폴더를 정적 서버로 띄운 뒤
  `harness/retarget_test.html?clip=파일.fbx&t=0.5,1.0,1.5`로 연다.
- 남은 일: 투구·타격 FBX를 받아 클립을 미리 변환(굽기)하고, 공 놓는 순간(tau 2.1)과 타격 순간(tau 2.55)에 맞춰
  시간을 매핑한다. 투수의 앞쪽 이동은 기존 코드와 겹치지 않게 정리해야 한다.
- Mixamo 파일은 Adobe 약관상 원본 재배포가 제한되므로 커밋하지 않는다(`harness/clips/`는 gitignore).

## 출처 / 라이선스

- `assets/body.glb`: three.ws 저장소(Apache-2.0)의 `public/avatars/parametric-base.glb`에서 표정 morph 306개와
  눈·치아·혀 메시를 제거한 것(6.8MB → 1.16MB, `tools/strip_glb.py`). 원 데이터는 MakeHuman/MPFB2 기본 메시를
  naver/anny가 재포장한 **CC0 1.0** 자료다(`assets/LICENSE-CC0.md`). 저작자 표시 의무는 없다.
- `vendor/three-0.184.0/`: three.js 0.184.0 애드온(GLTFLoader, SkeletonUtils, BufferGeometryUtils, FBXLoader 등), **MIT**(`LICENSE`).
  번들에 들어 있는 three.js 코어와 같은 버전이다(바이트 단위로 일치 확인).
- 랜딩 디자인 원본은 SprayLab 작업물이다.

## 확인하지 못한 것

- 실제 휴대폰 성능: 스키닝 메시 11개(+모바일 아트보드 11개)를 그린다. 헤드리스 소프트웨어 렌더러로만 확인했다.
