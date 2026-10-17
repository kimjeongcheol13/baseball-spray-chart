# 랜딩 페이지 + 3D 선수 작업 폴더

## 지금 배포되는 랜딩 (2026-10-17, "C안 · 시네마틱 스포츠테크")

`landing.html`은 더 이상 디자인 도구 캔버스를 변환한 것이 아니라 **손으로 쓴 페이지**다(`next/landing.src.html`).
Blast·Hudl 같은 스포츠테크 랜딩 문법으로 — 검은 바탕에 화면 가득한 3D 장면, 굵은 Pretendard 제목, 데이터 칩, 폰 프레임 안의 실제 앱 화면 —
흰 "사용법"·"비교" 섹션이 사이에 들어간다. 첫 화면과 "필드" 칸 두 군데에 움직이는 `<spray-play>` 3D가 들어 있고(모델은 한 번만 받아 둘이 나눠 씀,
화면 밖에 있는 쪽은 그리지 않음), 첫 화면은 3D가 그려지기 전까지 같은 장면의 정지 그림(`img/hero_close.jpg`)을 보여 주다가 사라진다.

빌드 순서:

```bash
cd design/landing-3d
python tools/build_landing.py                                 # next/landing.src.html + src/spray-play.js(+src/glbfig.js) → ../../landing.html, js/landing/spray-play.js, assets/landing/img/
python tools/build_landing.py --single SprayLab_Landing.page.html   # 전부 인라인한 한 파일(바탕화면 복사본용, 약 16MB)
```

- 3D 요소 `<spray-play>`의 진짜 소스는 `src/spray-play.js`(장면·필드·카메라·공·마커)와 `src/glbfig.js`(선수)다. 빌드가 `src/spray-play.js`의 `//@glbfig` 줄 자리에 `glbfig.js`를 끼워 `js/landing/spray-play.js`를 만든다 — 생성물은 직접 고치지 말 것. 둘 중 하나를 바꾸면 `build_landing.py`의 `V`(`?v=`)를 올린다.
  (2026-10-17 전까지는 디자인 도구 번들 `SprayLab_Landing.glb.html`에서 스크립트를 꺼내 썼다. `tools/build.py`·`tools/unbundle.py`는 이제 그 번들 미리보기와 3D 자원(`js/landing/vendor/`, `assets/landing/*.glb`·`clips_shared.json`)을 다시 풀 때만 쓴다.)
- 페이지 소스는 `next/landing.src.html`(글·CSS·구조), 이미지는 `next/img/`(앱 화면 2배 캡처 `app_*.jpg`, 앱이 내보낸 리포트 `report.jpg`, 3D를 찍은 `hero_close.jpg`·`cta_bg.jpg`), QR은 빌드 때 SVG로 본문에 들어 있다.
- 숫자는 전부 샘플 선수 김민준(#8, 15타석)의 것이다(.333 / .467 / .583 · OPS 1.050 · wOBA .451 · ISO .250 · 당김 36 / 센터 36 / 밀어 27%). 3D의 카운터만 "이번 경기".
- 3D 요소는 인라인 스타일로 자기 크기를 정하므로 페이지 CSS가 `!important`로 absolute·inset을 덮어쓴다. 첫 화면에서는 요소의 자체 라벨(투구·타격·기록, 카운터)을 숨기고, "필드" 칸에서는 흰색으로 보여 준다.
- 공유 미리보기: head의 `og:`·`twitter:` 메타와 `img/og.jpg`(1200×630, 첫 화면을 그대로 찍은 것), 파비콘 `img/icon-32/192.png`(앱의 player-logo). 상단 바는 fixed이고 40px 넘게 내리면 `.nav.scrolled`(반투명+블러, 60px)로 바뀐다.
- 정지 그림 4장(`hero_close.jpg` 2732×1536 데스크톱 첫 화면, `hero_close_m.jpg` 750×1400 폰 첫 화면, `cta_bg.jpg` 2400×1350, `og.jpg` 1200×630 글 포함)은 `tools/shoot_stills.py`가 헤드리스 Chromium(Playwright)으로 3D의 첫 프레임(tau 0.05, 카메라 흔들림 0)을 찍어 `#0B0D12` 위에 합성한 것이라 페이드 때 장면이 이어진다. 필드나 카메라를 바꾸면 다시 돌린다(`--check`를 붙이면 정지 그림과 3D 첫 프레임의 평균 픽셀차를 찍어 준다 — 2026-10-17 기준 데스크톱 0.7, 폰 1.0).
- 필드(2026-10-17): 종이 모형 같던 회색 판 대신 야간 중계 화면 느낌 — 잔디(깎은 줄무늬, 펜스 쪽으로 어두워짐)·흙 내야(투수판 중심 95ft 스킨, 4ft 안쪽 잔디 다이아몬드, 베이스·마운드·홈 주변 흙, 파울선 바깥 3ft 주로)·분필선(파울선·타석·포수석)·경고 트랙·노란 띠를 두른 외야 펜스·홈 뒤 45ft까지의 파울 지역. 전부 `src/spray-play.js`의 `paint()`가 캔버스에 한 번 그려 바닥 판의 텍스처(4px/ft)로 쓰고, 홈 주변 88ft는 같은 그림을 17px/ft로 그린 데칼을 덧씌워 근접 샷에서도 선이 또렷하다. 3D 마커·거리 원호·아웃 고리는 잉크색 대신 분필색.
- 카메라 역할(2026-10-17): 첫 화면의 `<spray-play cam="close">`는 홈 뒤 근접 샷에 머물러 타자·포수·투수가 계속 크게 보이고(드래그 회전은 그대로), "필드" 칸(`cam` 없음 = `cycle`)만 투구 뒤 넓은 샷으로 빠져 차트가 쌓이는 걸 보여 준다.
- 글꼴은 Pretendard(jsDelivr 동적 서브셋 `<link>`). 외부 의존은 그것뿐이다.
- 검토 과정의 다른 시안: `next/index.html`(A안 흰 배경 제품 랜딩), `next/hero-b.html`(B안 다크 테크), `next/index-c.html`(C안 정지 그림 버전). 레퍼런스 보드와 전후 비교는 `harness/clips/report/`(gitignore).
- 아래 내용(3D 선수 제작, 동작, 장비, 옛 캔버스 변환 `unbundle.py`의 페이지 편집)은 그대로 유효한 기록이다. `unbundle.py`의 페이지 변환 부분은 이제 `legacy/landing.html`에만 쓰인다.

---

## 3D 선수 (GLB) 작업 기록

Claude Design으로 내보낸 랜딩 페이지(`source/SprayLab_Landing.orig.html`)에 들어 있는 `<spray-play>` 3D 장면의
절차적 마네킹 12명(투수·타자·포수·심판·코치 + 야수 7명)을 사실적인 사람 GLB 몸으로 바꾼 작업이다.
앱(`index.html`, `js/`, `css/`)과는 무관한 디자인 작업 폴더다.

- 결과물: `SprayLab_Landing.glb.html` (6.0MB, 브라우저로 바로 열림). 원본 4.87MB.
- 미리보기: `previews/compare_glb.png`(마네킹 vs GLB), `previews/jersey_print.png`(등번호·로고), `previews/mocap_preview.png`(Mixamo 동작), `previews/fielder_sheet.png`(야수 대기·달리기·받기·복귀)

## 지금 쓰는 선수: Tripo 생성 모델 (2026-10-16)

아래 "무엇을 바꿨나"의 CC0 몸(정점 색 유니폼)은 마네킹처럼 보여서, 실사 텍스처 선수로 바꿨다.

- 모델 6개, 모두 Tripo Studio(정철님 계정)에서 같은 절차로 만들었다: 이미지 생성(T자 자세·빈손) → 3D 생성(HD) →
  Retopology 삼각형 2만 → Auto Rig(Humanoid, 스켈레톤 프리셋 Mixamo) → GLB(텍스처 2k, 뼈대 포함). 크레딧 1명당 약 110.
  - 헬멧: `player`(타자), `player_helmet2`(포수, 넓은 어깨)
  - 모자: `player_cap`(마른 체형), `player_cap2`(다부진 체형·수염), `player_cap3`(키 크고 마른 체형) — 투수·코치·야수 7명이 만들어지는 순서대로 돌아가며 쓴다.
  - 심판: `player_ump`(남색 깃 폴로·가슴 보호대·회색 슬랙스·검정 구두·검정 모자). 생성된 옷 그대로 쓰고 색·글자를 바꾸지 않는다.
  - 목록은 `src/glbfig.js`의 HELMETS·CAPS·UMPIRE와 `tools/build.py`의 PLAYERS가 같아야 한다.
- `tools/pack_player.py 받은.glb assets/<이름>.glb`: 텍스처는 JPEG 1024(색)/512(노멀)/256(금속·거칠기), 정점 데이터는
  KHR_mesh_quantization(노멀 int8·UV uint16·뼈 번호 uint8·가중치 uint8 합 255·인덱스 uint16, 위치는 float 유지)으로 줄인다.
  three의 GLTFLoader가 추가 라이브러리 없이 읽는다. 8.2–8.8MB → 1.16–1.24MB.
- 동작: `harness/bake.html`(인자 없음)이 Mixamo FBX 9개를 리그와 무관한 형태로 한 번 굽는다(`harness/clips/clips_shared.json`, gitignore,
  배포본 437KB): 뼈마다 기본 자세 대비 월드 회전 변화, 첫 자식 방향, 엉덩이 이동(엉덩이 높이 단위).
  페이지가 불러올 때 `rigClips()`가 리그마다 로컬 자세로 바꾼다(`harness/retarget.js`와 같은 계산).
  검증: `bake.html?body=../assets/<이름>.glb`로 그 리그에 직접 구운 결과를 `clips/clips_<이름>.json`으로 저장하고
  `harness/check_shared.html?rig=<이름>`을 열면 클립별 최대 차이를 보여준다(player·player_cap 모두 뼈 0.007°, 엉덩이 0.5mm — int16 반올림 수준, PASS).
  `Baseball_Hit_2.fbx`는 Mixamo에서 받은 `Baseball Hit (2).fbx`다.
- 화면(`src/glbfig.js`): 모델 자체 PBR 재질에 팀 색만 셰이더로 바꾼다. 남색(저지·헬멧, 헬멧·모자는 머리 뼈 가중치로 구분)과 흰색(바지)을 키트 색으로, 명도 비율은 유지한다.
  원정(SEOUL: 투수·포수·야수)은 생성된 남색 그대로, 홈(타자: 흰 저지+빨간 핀스트라이프·빨간 헬멧, 코치: 빨간 저지)은 바꾼다. 심판은 전용 모델이라 그대로.
  - 등번호·가슴 글자·모자/헬멧 앞 글자(SPRAYLAB은 SL, SEOUL은 S): 캔버스 텍스처를 바인드 자세 좌표로 투영해 원래 남색 천에만 찍는다. 심판은 없음.
  - 선수마다 키 ±4%(등번호로 고정), 피부톤은 페이지의 SKIN 팔레트를 기준색 대비 비율로 피부 픽셀에만 곱한다.
  - 시선: 모션 위에 목 40%·머리 70%만큼 페이지가 모두에게 보게 하는 지점(투구 전 투수, 그 뒤 공·낙하 지점)으로 돌린다. 최대 약 60°, 등 뒤는 돌리지 않는다. 투수는 공을 놓은 뒤부터.
  - 장비: 마스크는 턱에서 11.5cm 위를 눈높이로 잡아 얼굴 반경 9cm로 감싼다. 포수 가슴·정강이 보호대는 유광 검정, 무릎 덮개.
  - 글러브·미트·마스크: Tripo로 제품 사진(정면) → 3D → Retopology(글러브·미트 6천, 마스크 1.2만 삼각형) → GLB로 만든 실물 소품
    (`assets/glove.glb`·`mitt.glb`·`mask.glb`, `pack_player.py ... .5`로 텍스처 절반, 각 0.35–0.42MB). 위는 +y지만 앞뒤·좌우는 모델마다 달라서
    `harness/propview.html`(→ `window.__frames`)로 각 소품을 +z/-z/+x에서 렌더해 확인했다: 글러브는 포켓 -z·엄지 -x(오른손용 모양) → x 반전, 미트는 포켓 +z·엄지 -x → y축 반바퀴, 마스크는 철망 +z → 그대로.
    글러브·미트는 바인드 자세의 실제 왼손 뼈로 잡은 틀(엄지 쪽 X, 손가락 Y, 손바닥 쪽 포켓)에 끼우고, 진짜 손은 뼈 크기를 줄여(손 0.6, 손가락 0.35) 안에 숨긴다.
    대기 자세(야수, 그리고 투수가 던진 뒤 수비 자세): 클립의 웅크림이 얕아(엉덩이 0.84m, 손은 엉덩이 옆, 팔 길이 약 0.44m) 글러브가 무릎 앞에 닿지 않는다.
    그래서 엉덩이를 13cm 내리고(다리 2관절 IK로 발은 제자리), 등을 20° 더 숙이고, 팔 IK로 두 손을 무릎 앞(엉덩이 아래 지면 기준 앞 45cm·높이 0.6m, 글러브 손은 왼쪽 14cm, 맨손은 오른쪽 10cm)에 모은다.
    투수는 착지한 자리에서 수비 자세를 하므로 기준을 발판이 아니라 엉덩이 아래로 잡는다. 뛰거나 공을 잡는 동안(readyW)은 모션 그대로.
    글러브 든 손: 손목을 돌려 포켓이 보고 있는 지점(공·홈)을 향하게 하고(야수는 위로 22° 열어서), 손가락은 팔뚝 방향을 따른다 — 야수는 아래, 포수는 위(포수는 항상, 야수는 대기 중, 투수는 수비 자세 동안).
    마스크는 위쪽이 눈 12cm 위(이마), 철망이 코 4.5cm 앞에 오게 머리 뼈에 붙인다. 파일이 없으면 이전 절차적 글러브(`makeGlove`)·철망 마스크로 대체.
  - 방망이(`makeBat`): 실제 치수로 깎은 회전체(길이 84cm, 배럴 지름 6.6cm, 손잡이 2.7cm, 노브) + 손잡이 그립 테이프. 노브는 윗손에서 12cm.
  - 공은 실제 크기(지름 약 7.4cm). 타자는 팔로스루를 잠깐(4.6초까지) 멈췄다가 1.8초에 걸쳐 대기 자세로 돌아간다.
  - 투수: 세트(클립 0.45초, 두 손을 모은 자세)로 기다리다 → 다리 들기·스트라이드·릴리스(2.1초)·팔로스루(2.9초까지) →
    착지한 자리에서 수비 준비 자세(야수 대기 동작, 엉덩이 위치를 착지점에 고정)로 공을 본다 → 5.8초부터 클립의 마운드 복귀 걸음(3.2–5.2초) → 7.4초부터 다시 세트.
    원래는 던진 뒤 클립 끝까지 걸어다니다 똑바로 선 채 2.2초 동안 시작 자세로 미끄러지듯 돌아갔다.
  - 야수·코치는 화면에서 작아서 그림자 맵 대신 발밑 부드러운 원 그림자를 쓴다(스키닝 그림자 패스 비용 절약).
  - 손(방망이·글러브·태블릿)과 마스크·보호대는 바인드 자세 좌표로 놓고 뼈의 기본 회전을 풀어 붙인다. 코치는 야수 대기 동작을 쓴다.
  - 모델이나 동작 데이터가 없으면 절차적 마네킹으로 대체된다.
- 빌드는 그대로(`tools/build.py` → `tools/unbundle.py`). 배포 파일은 `assets/landing/`의 선수 GLB 6개·소품 3개와 `clips_shared.json`(합 8.8MB, 원래 몸은 1.5MB).
- 성능(데스크톱 Chrome, 390px 모바일 아트보드, 매 프레임 GPU 동기화, 같은 실행에서 번갈아 측정): 원래 7.0·16.6ms, 지금 6.8·8.4ms(중앙값), 그리기 호출 233 → 190–264.
  값이 실행마다 흔들리지만 원래보다 무겁지 않다. 실제 휴대폰에서는 재지 않았다.
- 한계: 같은 모델을 쓰는 선수끼리는 얼굴이 같다(키·피부톤은 다름). 팀 로고 그림은 없고 글자만 있다.
- 라이선스: Tripo 무료 플랜 생성물은 공개되며 CC BY 4.0으로 안내된다(상업 사용 범위는 출처마다 다르게 설명 — Tripo 약관 확인 필요). 출처 표기: "3D player model generated with Tripo AI".

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
- "차트 열기" 버튼(첫 화면·위 메뉴·맨 아래) → 앱(`./`), GitHub 링크 → 저장소, Instagram → instagram.com/spraylab2026(새 탭).
- 공유 미리보기 제목(`og:title`)은 "SprayLab — 타석 하나 찍으면 차트가 그려진다"(`tools/unbundle.py`).
- `sw.js`는 수정하지 않았다(HTML 네트워크 우선, 나머지 stale-while-revalidate 규칙이 그대로 적용된다).
- 스크립트를 바꾸면 `tools/unbundle.py`의 `V`를 올린다.

### 페이지 다듬기 (2026-10-17, `tools/build.py`의 "page polish")

- 첫 화면: 제목 아래 설명 한 줄 + "차트 열기" 버튼(전에는 버튼이 페이지 맨 아래에만 있었다). 위 메뉴의 "차트 열기"도 앱으로 가는 버튼(전에는 맨 아래로 스크롤).
  새 버튼은 `data-cta`로 표시하고 `unbundle.py`·`pagebundle.py`가 앱 주소를 넣는다.
- 글씨: 본문 15px 가는 글씨(300) → 17px 보통(400), 작은 영문 라벨 11px → 13px, 비교표 15 → 17px. 큰 제목은 그대로.
- 누르는 곳: 위 메뉴·아래 링크 최소 48×48(휴대폰 대지가 약 0.96배로 그려져 화면에서 46px 이상). 메뉴의 "·"는 뺐다.
- 휴대폰 3D: 342×256 → 342×428(4:5). 세로 시야각이 같아서 가까운 장면의 선수가 약 1.7배 커지고, 좁아진 만큼 가까운 장면은 홈 쪽으로 약 2m(장면 단위 6), 먼 장면은 더 멀리·더 위에서 본다(4:3 데스크톱은 그대로).
- 3D 늦게 불러오기: 선수·소품 GLB와 동작(약 9MB)을 3D 칸이 화면 아래 4분의 1 화면 거리까지 오면 받는다. 전에는 열자마자(0.34초) 받았다. 받는 동안 "선수들 불러오는 중…".

### 페이지 다듬기 2 (2026-10-17, `tools/build.py`의 "page polish 2")

- 기능 그림: 세 기능이 모두 같은 부채꼴 차트였다. 자동 계산 → 예시 지표 카드(AVG·OBP·SLG·OPS·wOBA·ISO, OPS = OBP + SLG, ISO = SLG − AVG는 `js/features/batdata.js` 계산식 그대로),
  방향 분포 → 차트는 두고 아래에 당겨치기·센터·밀어치기 막대(예시 56/27/17%, 앞 섹션의 "당겨치기 56%"와 같은 값), 공유 QR → 앱 주소로 실제 열리는 QR(빌드 때 파이썬 `qrcode`로 SVG 생성).
- 숫자 띠: 1장 · 7개(선수 리포트에 그려지는 지표, `report.js`) · 3방향(당김·센터·밀어) · 전원(팀 대시보드, 예전 "25"는 앱 어디에도 없는 수) · 1번(QR 스캔).
  데스크톱은 옆으로 넘기던 줄(세 번째 카드가 화면 끝에서 잘림)을 5칸 한 줄로 바꿨다. 휴대폰은 옆으로 넘기기 그대로.
- 데모: 가짜 영상(차트 + "0:24 / 1:24" 막대) 대신 실제 앱 화면 3장(기록·분석·스카우트). `assets/screens/app_*.jpg` — 앱의 "샘플 데이터로 둘러보기"(가상 선수 9명·3경기, `js/sample.js`)를
  375px 휴대폰 크기로 찍고 맨 위 "샘플 데이터" 띠를 잘라 540px JPEG로 줄였다(각 약 77KB). 번들에는 `SCREENS`로 들어가고 `unbundle.py`가 `assets/landing/`에 푼다. 앱 화면이 바뀌면 다시 찍는다.

### 미리보기 링크용 한 파일 (claude.ai 아티팩트)

```bash
python3 tools/pagebundle.py SprayLab_Landing.glb.html SprayLab_Landing.page.html https://kimjeongcheol13.github.io/baseball-spray-chart/
```

외부 파일을 막는 호스트용으로, 위와 같은 페이지 변환을 한 파일 번들 그대로 적용한다("차트 열기"는 앱 주소로 새 탭).
결과 파일은 재생성 가능하므로 커밋하지 않는다(`.gitignore`).

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
