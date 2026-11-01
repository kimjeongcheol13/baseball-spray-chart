// 게시물 목록 — 순서 = 게시 순서 (루틴이 회차마다 다음 것을 쓴다)
// 숫자는 전부 data.js 의 가짜 데이터에서 계산한다. 사람 이름 대신 별명·등번호만 쓴다.
(() => {
  const { G, S, K } = window;

  // ── 등장인물 (가짜) ───────────────────────────────────
  const P1 = G.pitcher(217, {
    name: '에이스', num: 17, team: '샘플 블루스', opp: 'vs 샘플 레즈', date: '10.26', pa: 25,
    aim: { '직구': [.52, .36], '슬라이더': [.74, .7], '커브': [.48, .82], '체인지업': [.32, .72] },
    mix: c => (!c.b && !c.s) ? [['직구', 6], ['슬라이더', 1.5], ['커브', 2]] : c.s === 2 ? [['슬라이더', 6], ['직구', 2], ['커브', 1.5], ['체인지업', 1]]
      : c.b > c.s ? [['직구', 7], ['체인지업', 2], ['슬라이더', 1]] : [['직구', 4], ['슬라이더', 3], ['커브', 2], ['체인지업', 1]],
  });
  const B2 = G.batter(533, { name: '거포', num: 24, hand: 'R', pa: 110, pull: .42, gb: .42, hot: [1.5, 1.2, 1, 1.3, 1.1, .9, 1, .8, .3] });
  const B3 = G.batter(143, { name: '막내', num: 11, hand: 'L', pa: 80, pull: .5, gb: .45, hot: Array(9).fill(1), first: 1.7, firstSwing: .75 });

  const sl1 = { a: P1.share(P1.m0, '슬라이더'), b: P1.share(P1.m2, '슬라이더') };
  const sl2S = P1.ps.filter(p => p.pt === '슬라이더' && p.c.s === 2), low2S = sl2S.filter(p => p.y > .6).length, out2S = sl2S.filter(p => !(p.x > .25 && p.x < .75 && p.y > .18 && p.y < .82)).length;
  const times = (a, b) => (b / a).toFixed(1).replace(/\.0$/, '');
  const b2w = B2.grid[8], b2h = B2.grid.reduce((m, g, i) => g.v > B2.grid[m].v ? i : m, 0);
  const CELL = ['몸쪽 높은', '가운데 높은', '바깥쪽 높은', '몸쪽 가운데', '한가운데', '바깥쪽 가운데', '몸쪽 낮은', '가운데 낮은', '바깥쪽 낮은'];
  const fullPA = P1.fullK[1] || P1.fullK[0], lastP = fullPA.at(-1);

  // ── 앱 기능 소개 — 앱 화면은 shots/ (node social/gen/appshots.mjs 가 샘플 모드로 찍는다) ──
  // S.shot(이름, [x, y, w, h]) — 앱 화면은 CSS px(폭 390) 단위, 저장 이미지는 그림 픽셀 단위
  const nx = '넘겨서 더 보기 →';
  // 릴스 장면: 꼬리표 · 앱 화면 · 훑는 칸 a → b · 자막(= 음성)
  const TOUR = [
    { l: '경기 중', shot: 'rec', a: [0, 200, 390], b: [0, 300, 390], say: ['경기 중에는 타구가 떨어진 곳을', '한 번 누르면 됩니다'] },
    { l: '경기 리포트', shot: 'report', a: [0, 40, 390], b: [0, 330, 390], say: ['경기가 끝나면 리포트가 바로 나옵니다', '점수, 팀 타격, 타구 방향까지'] },
    { l: '선수 카드', shot: 'card', a: [0, 0, 1080], b: [0, 620, 1080], say: ['선수마다 카드 한 장', '단톡방에 바로 보내세요'] },
    { l: '리그 기록지', shot: 'sheet', a: [0, 0, 820], b: [0, 0, 1588], say: ['리그 기록지도 A4 한 장으로', '인쇄까지 됩니다'] },
    { l: '선수 분석', shot: 'bat', a: [0, 360, 390], b: [0, 2300, 390], say: ['기록이 쌓이면', '선수마다 시즌 성적이 정리됩니다'] },
  ];
  const SCOUT = [
    { l: '상대 타자 리포트', shot: 'scout', a: [0, 300, 390], b: [0, 340, 390], say: ['상대 타자를 고르면', '위협도와 성적이 한눈에'] },
    { l: '공략 포인트', shot: 'scout', a: [0, 600, 390], b: [0, 650, 390], say: ['공략 포인트를 먼저 알려 줍니다', '결정구, 조심할 카운트까지'] },
    { l: '코스별 결과', shot: 'scout', a: [0, 1100, 390], b: [0, 1140, 390], say: ['코스별 결과를 보고', '어디로 던질지 정하고'] },
    { l: '수비 위치', shot: 'scout', a: [0, 2540, 390], b: [0, 2640, 390], say: ['타구 방향을 보고', '수비 위치까지 정하세요'] },
  ];
  const says = (first, sc, last) => [first, ...sc.map(x => x.say.join(' ') + '.'), last];

  window.ITEMS = [
    {
      id: 'c1', format: 'carousel', theme: 'v2', type: 'F', topic: '경기 하나 기록하면 나오는 다섯 가지',
      hook: '경기 하나 기록하면 이게 다 나옵니다',
      facts: ['경기 리포트(점수 · 팀 타격 · 타구 방향 · 오늘의 선수)', '리그 기록지 A4 한 장(인쇄 가능)', '오더지(타순 · 수비 위치 · 등번호)', '선수별 시즌 분석', '선수 카드 이미지(단톡방 공유)'],
      slides: () => [
        S.app({ chip: 'SprayLab 사용법', page: '1 / 7', h1: '경기 하나 기록하면<br><em>이게 다</em> 나옵니다', sub: '리포트 · 기록지 · 오더지 · 선수 분석 · 선수 카드', vis: S.shot('report', [0, 40, 390, 306]), next: nx }),
        S.app({ chip: '① 경기 리포트', page: '2 / 7', h1: '경기가 끝나면<br>리포트가 바로', sub: '점수 · 팀 타격 · 타구 방향 · 오늘의 선수', vis: S.shot('report', [0, 355, 390, 300]), next: nx }),
        S.app({ chip: '② 리그 기록지', page: '3 / 7', h1: '종이 기록지 그대로<br>A4 한 장', sub: '타석마다 결과 · 이닝별 점수 · 인쇄까지', vis: S.shot('sheet', [0, 0, 1588, 1270]), next: nx }),
        S.app({ chip: '③ 오더지', page: '4 / 7', h1: '라인업만 넣으면<br>오더지 완성', sub: '타순 · 수비 위치 · 등번호 · 후보 선수', vis: S.shot('order', [0, 0, 1588, 1270]), next: nx }),
        S.app({ chip: '④ 선수 분석', page: '5 / 7', h1: '타자마다<br>시즌 성적이 쌓입니다', sub: '타율 · 출루율 · wOBA · 오늘 기록', vis: S.shot('bat', [0, 360, 390, 300]), next: nx }),
        S.app({ chip: '⑤ 선수 카드', page: '6 / 7', h1: '선수마다<br>카드 한 장', sub: '단톡방에 이미지로 바로 공유', vis: S.shot('card', [0, 0, 1080, 1320], 560), next: nx }),
        S.cta({ chip: 'SprayLab', page: '7 / 7', h1: '기록은 탭,<br>정리는 자동', steps: ['경기 중에 타구를 탭 한 번', '경기가 끝나면 리포트 · 기록지가 자동으로', '단톡방에 이미지로 바로 공유'] }),
      ],
    },
    {
      id: 'r1', format: 'reel', theme: 'v2', type: 'F', topic: '경기 끝나면 리포트가 자동으로 — 앱 화면 둘러보기', reel: 'app',
      hook: '경기 끝나면 리포트가 자동으로', chip: 'SprayLab 사용법', hookHtml: '경기 끝나면<br>리포트가<br><em>자동으로</em>', sub: '탭 몇 번이면 정리 끝', introShot: ['report', [0, 40, 390, 172]],
      endHtml: '기록은 탭 몇 번,<br>정리는 <em>SprayLab</em>',
      facts: ['경기 중: 타구가 떨어진 곳을 한 번 탭', '경기 리포트 · 선수 카드 · 리그 기록지 · 선수 분석이 자동으로', '음성: AI 목소리'],
      scenes: TOUR, says: says('경기 끝나면 리포트가 자동으로 나옵니다.', TOUR, '기록은 탭 몇 번, 정리는 스프레이랩. 기본 무료입니다.'),
    },
    {
      id: 'i1', format: 'image', theme: 'v2', type: 'F', topic: '경기 끝나면 선수마다 카드 한 장',
      hook: '오늘 경기, 선수마다 카드 한 장',
      facts: ['경기가 끝나면 선수별 카드 이미지(타석 · 타율 · 출루율 · 장타율 · OPS · 타구 위치 · 타석 결과)', '단톡방 · 스토리에 바로 공유'],
      slides: () => [S.app({ chip: '선수 카드', h1: '오늘 경기,<br>선수마다 <em>카드 한 장</em>', sub: '타석 결과 · 타구 위치 · 오늘 성적', vis: S.shot('card', [0, 0, 1080, 1320], 560) })],
    },
    {
      id: 'c2', format: 'carousel', theme: 'v2', type: 'F', topic: '기록 화면 한 장으로 경기 기록 끝',
      hook: '경기 기록, 화면 한 장이면 끝',
      facts: ['타구가 떨어진 곳을 탭 → 결과 선택', '점수판 · 이닝 · 안타 수 자동', '볼 · 스트라이크 · 아웃도 같은 화면'],
      slides: () => [
        S.app({ chip: 'SprayLab 사용법', page: '1 / 5', h1: '경기 기록,<br>화면 <em>한 장</em>이면 끝', sub: '점수판 · 타순 · 타구 · 볼카운트', vis: S.shot('rec', [0, 40, 390, 306]), next: nx }),
        S.app({ chip: '① 타구', page: '2 / 5', h1: '타구가 떨어진 곳을<br>한 번 누르면 끝', sub: '안타 · 장타 · 홈런 · 아웃이 차트에 쌓입니다', vis: S.shot('rec', [0, 285, 390, 306]), next: nx }),
        S.app({ chip: '② 점수판', page: '3 / 5', h1: '이닝 · 점수 · 안타는<br>알아서 올라갑니다', sub: '경기 운영을 켜면 타순 · 아웃 · 이닝도 자동', vis: S.shot('rec', [0, 50, 390, 215]), next: nx }),
        S.app({ chip: '③ 볼카운트', page: '4 / 5', h1: '볼 · 스트라이크 · 아웃도<br>같은 화면에서', sub: '타자를 고르면 이번 경기 지표도 바로', vis: S.shot('rec', [0, 590, 390, 210]), next: nx }),
        S.cta({ chip: 'SprayLab', page: '5 / 5', h1: '오늘 경기부터<br>바로 써 보세요', steps: ['타석에 선 타자를 고르고', '타구가 떨어진 곳을 탭', '결과를 고르면 나머지는 자동'] }),
      ],
    },
    {
      id: 'r2', format: 'reel', theme: 'v2', type: 'D', topic: '한 경기 → 다섯 경기 → 시즌, 기록이 쌓이는 모습',
      hook: `1경기 ${Math.round(B3.bip.length / 14)}개, 14경기면?`, reel: 'season', subject: 'B3', chip: '기록이 쌓이면',
      says: ['한 경기 타구는 몇 개 안 됩니다.', '한 경기, 다섯 경기, 그리고 시즌 열네 경기. 쌓일수록 습관이 보입니다.', '기록은 탭 몇 번, 남는 건 한 시즌. 스프레이랩.'],
      facts: [`가상의 좌타자 '막내' 시즌 ${B3.pa}타석`, `인플레이 타구 ${B3.bip.length}개가 쌓이는 과정`, '기록은 경기마다 탭 몇 번'],
    },
    {
      id: 'i2', format: 'image', theme: 'v2', type: 'C', topic: '경기 전 단톡방에 올리는 투수 리포트 한 장 (앱에서 저장한 그대로)',
      hook: '상대 투수, 이 한 장이면 정리 끝',
      facts: ['투수 분석 → 「투수 리포트 이미지로 저장」 한 번', '스트라이크% · 초구 S% · 삼진% · 볼넷% · 피안타율', '카운트별 구종 · 구종별 위치', '가상의 투수 · 예시 데이터'],
      slides: () => [`<img src="shots/pitrep.jpg" style="position:absolute;inset:0;width:1080px;height:1350px"><div class="tag" style="bottom:30px;right:auto;left:50%;transform:translateX(-50%)">예시 데이터</div>`],
    },
    {
      id: 'c3', format: 'carousel', theme: 'v2', type: 'F', topic: '분석 탭 둘러보기 — 타자 · 투수 · 팀',
      hook: '기록이 쌓이면 분석은 알아서',
      facts: ['타자: 성적을 문장으로 정리(이런 타자예요)', '투수: 분석 요약 · 구종 구성 · 결정구', '팀: 리더보드 · 경기 결과', '분석 엑셀 · 이미지 저장'],
      slides: () => [
        S.app({ chip: 'SprayLab 분석', page: '1 / 5', h1: '기록이 쌓이면<br>분석은 <em>알아서</em>', sub: '타자 · 투수 · 팀 · 비교 · 스카우트', vis: S.shot('team', [0, 320, 390, 306]), next: nx }),
        S.app({ chip: '① 타자', page: '2 / 5', h1: '이 타자는<br>어떤 타자인가', sub: '숫자를 문장으로 정리해 줍니다', vis: S.shot('bat', [0, 2300, 390, 306]), next: nx }),
        S.app({ chip: '② 투수', page: '3 / 5', h1: '제구 · 결정구 ·<br>맞으면 위험한 공', sub: '투구를 기록하면 투수 분석이 나옵니다', vis: S.shot('pit', [0, 1076, 390, 306]), next: nx }),
        S.app({ chip: '③ 팀', page: '4 / 5', h1: '팀 리더보드와<br>경기 결과', sub: 'OPS · wOBA · 타율 순위', vis: S.shot('team', [0, 1385, 390, 306]), next: nx }),
        S.cta({ chip: 'SprayLab', page: '5 / 5', h1: '분석은<br>기록만 하면 자동', steps: ['경기마다 타석 결과를 탭', '타자 · 투수 · 팀 분석이 자동으로', '분석 엑셀 · 이미지로 내보내기'] }),
      ],
    },
    {
      id: 'r3', format: 'reel', theme: 'v2', type: 'F', topic: '상대 타자 공략, 경기 전 1분 — 스카우트 탭', reel: 'app',
      hook: '상대 타자 공략, 1분이면', chip: '스카우트', hookHtml: '상대 타자<br>공략,<br><em>1분</em>이면', sub: '경기 전 준비는 스카우트 탭에서', introShot: ['scout', [0, 314, 390, 282], 740],
      endHtml: '상대 분석,<br>경기 전 <em>1분</em>',
      facts: ['스카우트 탭: 상대 타자 공략 리포트(위협도 · 성적)', '공략 포인트(결정구 후보 · 주의할 카운트)', '코스별 결과 9칸 · 구종별 · 카운트별', '타구 방향 · 수비 위치', '음성: AI 목소리'],
      scenes: SCOUT, says: says('상대 타자 공략, 경기 전에 일 분이면 됩니다.', SCOUT, '상대 분석은 스카우트 탭에서. 스프레이랩.'),
    },
    {
      id: 'c4', format: 'carousel', theme: 'v2', type: 'F', topic: '게임원 기록 그대로 가져오기',
      hook: '게임원 기록, 그대로 가져오기',
      facts: ['☰ 메뉴 → 게임원 가져오기', '박스스코어 주소(한 경기) · 팀 주소(시즌 경기 한 번에)', '앱 화면은 스크린샷으로 채우기(사진은 휴대폰 밖으로 안 나감)', '가져온 경기는 바로 분석에'],
      slides: () => [
        S.app({ chip: '게임원 가져오기', page: '1 / 5', h1: '게임원 기록,<br><em>그대로</em> 가져오기', sub: '주소만 붙여넣으면 새 경기로 저장', vis: S.shot('goimport', [0, 40, 390, 306], 920, false), next: nx }),
        S.app({ chip: '① 주소 붙여넣기', page: '2 / 5', h1: '박스스코어 주소를<br>넣고 「가져오기」', sub: '한 경기 주소도, 팀 시즌 주소도', vis: S.shot('goimport', [0, 195, 390, 170], 920, false), next: nx }),
        S.app({ chip: '② 앱 화면이라면', page: '3 / 5', h1: '휴대폰 앱 화면은<br>스크린샷으로', sub: '사진은 휴대폰 밖으로 나가지 않아요', vis: S.shot('goimport', [0, 370, 390, 172], 920, false), next: nx }),
        S.app({ chip: '③ 바로 분석', page: '4 / 5', h1: '가져온 경기는<br>바로 분석에', sub: '타자 · 투수 · 팀 성적에 그대로 쌓입니다', vis: S.shot('team', [0, 1730, 390, 306]), next: nx }),
        S.cta({ chip: 'SprayLab', page: '5 / 5', h1: '지난 경기도<br>한 번에', steps: ['☰ 메뉴 → 게임원 가져오기', '주소를 붙여넣고 「가져오기」', '시즌 경기도 한 번에 저장'] }),
      ],
    },
    {
      id: 'i3', format: 'image', theme: 'v2', type: 'B', topic: '코스별 타율 9칸 — 약점 코스',
      hook: `${CELL[8]} 공 타율 ${b2w.avg}`,
      slides: () => [S.cover({ chip: '타자 데이터 · 코스별 타율', h1: `${CELL[8]} 공<br>타율 <em>${b2w.avg}</em>`, h1Style: 'font-size:96px', sub: `가상의 우타자 '거포' · ${B2.pa}타석 · 포수 시점`, visTop: 520,
        vis: `<div style="display:flex;justify-content:center">${K.grid9(B2.grid, { s: 180, gap: 10, mark: 8 })}</div><div class="leg" style="margin-top:22px"><span>칸마다 안타/타수</span><span style="color:#4b8cf5">■ 차가움</span><span style="color:#FF5A36">■ 뜨거움</span></div>` })],
      facts: [`가상의 우타자 '거포' ${B2.pa}타석`, `${CELL[8]} 코스 타율 ${b2w.avg} (${b2w.h}/${b2w.ab})`, `가장 강한 코스: ${CELL[b2h]} ${B2.grid[b2h].avg}`, `전체 타율 ${B2.all.avg}`],
    },
    {
      id: 'r4', format: 'reel', theme: 'v2', type: 'B', topic: '풀카운트 승부 한 타석 — 공 하나씩 다시 보기',
      hook: '풀카운트, 마지막 공은?', reel: 'pa', subject: 'P1', pa: fullPA, chip: '공 하나씩 다시 보기',
      says: ['풀카운트 승부, 마지막 공은 뭐였을까요?', `공 하나씩 다시 봅니다. 마지막 공은 ${lastP.pt}, ${lastP.res === '삼진' ? '헛스윙 삼진' : lastP.res}.`, `이날 가장 많이 던진 공, ${P1.types[0].pt} ${P1.types[0].use}퍼센트.`, '공 하나씩 찍어 두면, 이 화면이 남습니다.'],
      facts: [`가상의 투수 '에이스' 풀카운트 승부 ${fullPA.length}구`, `순서: ${fullPA.map(p => `${p.pt} ${p.res}`).join(' → ')}`, `마지막은 ${lastP.pt} ${lastP.res}`],
    },
    {
      id: 'c5', format: 'carousel', theme: 'v2', type: 'B', topic: '카운트별 구종 — 2스트라이크 결정구',
      hook: '2스트라이크가 되면 던지는 공이 바뀐다',
      facts: [`가상의 투수 '에이스'(#17) 한 경기 ${P1.n}구`, `초구에 슬라이더 비율 ${sl1.a}%`, `2스트라이크에서 슬라이더 비율 ${sl1.b}% (${P1.m2.n}구 중)`, `2스트라이크 슬라이더 ${sl2S.length}구 중 삼진 ${sl2S.filter(p => p.res === '삼진').length}개`],
      slides: () => [
        S.cover({ chip: '투수 데이터 · 카운트별 구종', page: '1 / 4', h1: sl1.a ? `2스트라이크가 되면<br>슬라이더가 <em>${times(sl1.a, sl1.b)}배</em>` : `초구엔 0%,<br>2스트라이크엔 <em>${sl1.b}%</em>`,
          sub: '같은 투수, 같은 경기. 카운트만 바뀌었을 뿐인데', visTop: 600,
          vis: S.compare({ l: '초구', v: sl1.a, u: '%' }, { l: '2스트라이크', v: sl1.b, u: '%' }) + `<div style="margin-top:44px">${S.stack([{ l: '초구', d: '0-0', ...P1.m0 }, { l: '2스트라이크', d: '0-2 ~ 3-2', ...P1.m2 }], '슬라이더')}</div>`,
          next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '투수 데이터 · 카운트별 구종', page: '2 / 4', h1: '카운트마다<br>섞는 공이 다릅니다', h1Style: 'font-size:92px', sub: `던지기 직전 볼-스트라이크 기준 · 전체 ${P1.n}구`, visTop: 560,
          vis: S.stack([{ l: '초구', d: '0-0', ...P1.m0 }, { l: '볼이 많을 때', d: '1-0 2-0 3-0 2-1 3-1', ...P1.mBall }, { l: '그 밖', d: '0-1 1-1', ...P1.mOther }, { l: '2스트라이크', d: '0-2 ~ 3-2', ...P1.m2 }])
            + `<div class="keys">${P1.types.map(t => `<span><i style="background:${K.ptCol(t.pt)}"></i>${t.pt}</span>`).join('')}</div>`, next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '투수 데이터 · 결정구 위치', page: '3 / 4', h1: `2스트라이크 슬라이더<br><em>${sl2S.length}구 중 ${low2S}구</em>가 낮게`, h1Style: 'font-size:88px', sub: `존 밖으로 빠진 공 ${out2S}구 · 포수 시점`, visTop: 520,
          vis: `<div style="display:flex;gap:56px;align-items:center"><div>${K.zone(sl2S, { w: 470, r: 3.4, glow: true })}${S.legendPitch()}</div>
            ${S.nums([[sl2S.length, '던진 공', '구'], [sl2S.filter(p => p.res === '헛스윙' || p.res === '삼진').length, '헛스윙', ''], [sl2S.filter(p => p.res === '삼진').length, '삼진', '']]).replace('class="nums"', 'class="nums v"')}</div>`, next: '넘겨서 더 보기 →' }),
        S.cta({ chip: 'SprayLab', page: '4 / 4', steps: ['투구마다 구종과 위치를 탭', '카운트별 구종 · 위치가 자동으로', '경기 전 단톡방에 이미지로 공유'] }),
      ],
    },
    {
      id: 'c6', format: 'carousel', theme: 'v2', type: 'D', topic: '기능 총정리 + 기본 무료 안내',
      hook: '사회인야구 기록, 이거 하나로',
      facts: ['타구 · 볼카운트 기록(스프레이 차트)', '경기 리포트 · 선수 카드 이미지', '리그 기록지 · 오더지', '타자 · 투수 · 팀 분석 · 스카우트', '게임원 기록 가져오기', '기본 무료 · 설치 없이 웹에서'],
      slides: () => [
        S.app({ chip: 'SprayLab', page: '1 / 3', h1: '사회인야구 기록,<br><em>이거 하나로</em>', sub: '설치 없이 웹에서 · 기본 무료',
          vis: `<div class="mini4 app">${[['rec', [0, 285, 390, 306]], ['report', [0, 40, 390, 306]], ['bat', [0, 360, 390, 306]], ['scout', [0, 300, 390, 306]]].map(([n, c], i) => S.shot(n, c, 440, i === 3)).join('')}</div>`, next: nx }),
        S.app({ chip: '할 수 있는 것', page: '2 / 3', h1: '탭 몇 번으로<br>이만큼', sub: '경기 전 · 경기 중 · 경기 후',
          vis: `<div class="steps" style="position:static;width:100%">${['타구 · 볼카운트 기록 (스프레이 차트)', '경기 리포트 · 선수 카드 이미지', '리그 기록지 · 오더지 A4', '타자 · 투수 · 팀 분석', '상대 타자 스카우트', '게임원 기록 가져오기'].map((x, i) => `<div><b>${i + 1}</b><span>${x}</span></div>`).join('')}</div>`, next: nx }),
        S.cta({ chip: 'SprayLab', page: '3 / 3', h1: '기본 무료,<br>지금 바로', steps: ['휴대폰 브라우저로 주소 열기', '홈 화면에 추가하면 앱처럼', '샘플 데이터로 먼저 둘러보기'] }),
      ],
    },
  ];
  window.SUBJ = { P1, B2, B3, CELL };
})();
