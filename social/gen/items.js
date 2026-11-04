// 게시물 목록 — 게시 순서는 맨 아래 ORDER (루틴이 회차마다 다음 것을 쓴다)
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
      id: 'c4', format: 'carousel', theme: 'v2', type: 'F', aud: '사회인', topic: '게임원 기록 그대로 가져오기',
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
      id: 'c6', format: 'carousel', theme: 'v2', type: 'D', aud: '사회인', topic: '기능 총정리 + 기본 무료 안내',
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

  // ── 공감(g) · 팁(t) — story 릴스. 앱 소개만 하던 릴스가 도달 100명 · 좋아요 0 이라 (11-04) 앱은 끝에만 ──
  // 단톡방: [누구, 글] — '나' = 오른쪽, '-' = 가운데 알림, 글이 '<' 로 시작하면 그림. 뒤에서 n개가 이 장면에서 새로 뜬다
  const chat = (msgs, n, hd = '주말 야구단<small>18명</small>') => `<div class="chat"><div class="hd">${hd}</div><div class="bd">${msgs.map(([w, t], i) => {
    const rv = i >= msgs.length - n ? ' rv' : '';
    if (w === '-') return `<div class="sys${rv}">${t}</div>`;
    if (w === '나') return `<div class="msg me${rv}"><div class="bb">${t}</div></div>`;
    return `<div class="msg${rv}"><div class="av">${w[0]}</div><div><div class="nm">${w}</div><div class="bb${t[0] === '<' ? ' im' : ''}">${t}</div></div></div>`;
  }).join('')}</div></div>`;
  const rvShot = (name, c, w = 840) => `<div class="rv">${S.shot(name, c, w)}</div>`;
  const story = (x) => ({ format: 'reel', theme: 'v2', reel: 'story', ...x, says: [x.hookSay, ...x.scenes.map(s => s.say), x.endSay] });
  // 음성은 숫자를 한글로 써야 제대로 읽는다 (0~100)
  const kn = n => { const d = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']; return n === 100 ? '백' : n < 10 ? (d[n] || '영') : (n >= 20 ? d[Math.floor(n / 10)] : '') + '십' + d[n % 10]; };
  const B4 = G.batter(611, { name: '4번', num: 30, hand: 'R', pa: 90, pull: .62, gb: .55, hot: Array(9).fill(1) });
  const pullP = B4.dirs[0].p;
  const G1 = [['총무', '오늘 9시 경기! 다들 오시죠?'], ['에이스', 'ㅇㅇ'], ['막내', '갑니다!']];
  const G1b = [...G1, ['포수형', '아 늦잠… 2회부터 갈게'], ['1번타자', '저 오늘 애 봐야 해서 ㅠㅠ']];
  const G3 = [['4번타자', '나 오늘 몇 타수 몇 안타임?'], ['1번타자', '3타수 1안타?'], ['포수형', '2안타 아니었어?']];

  window.ITEMS.push(
    story({
      id: 'g1', type: 'G', aud: '사회인', topic: '토요일 아침 단톡방 — 오늘도 9번 타자 구합니다 (공감 상황극)',
      hook: '토요일 아침 7시, 단톡방이 울린다', chip: '사회인야구 공감', hookHtml: '토요일 아침 7시,<br>단톡방이<br><em>울린다</em>', sub: '사회인야구 하면 다 아는 그 알림',
      facts: ['단톡방 대화는 지어낸 상황극', '오더지: 라인업만 넣으면 타순 · 수비 위치 · 등번호가 A4 한 장으로', '라인업이 바뀌면 다시 뽑기만 하면 됨', '음성: AI 목소리'],
      hookSay: '토요일 아침 일곱 시, 단톡방이 울립니다.',
      scenes: [
        { l: '07:02', html: chat(G1, 3), say: '오늘 경기, 다들 온다고 합니다.' },
        { l: '07:40', html: chat(G1b, 2), say: '그리고 하나둘 빠지기 시작하죠.' },
        { l: '08:15', html: chat([...G1b, ['총무', '현재 8명…'], ['총무', '9번 타자 구합니다 🙏']], 2), say: '결국 여덟 명. 오늘도 구 번 타자를 구합니다.', sub: '결국 8명. 오늘도 9번 타자를 구합니다' },
        { l: '라인업이 또 바뀌면', html: rvShot('order', [0, 0, 1588, 1270]), say: '라인업이 몇 번을 바뀌어도, 오더지는 탭 몇 번이면 다시 나옵니다.', sub: ['라인업이 몇 번을 바뀌어도', '오더지는 탭 몇 번이면 다시'] },
      ],
      endHtml: '사람은 모자라도<br>기록은 <em>SprayLab</em>', endSay: '사람은 모자라도 기록은 스프레이랩. 기본 무료입니다.',
    }),
    story({
      id: 'g2', type: 'G', aud: '사회인', topic: '타순 8번 받은 날 — 감독님이 보낸 기록 한 장 (공감 상황극)',
      hook: '타순 8번, 납득이 안 될 때', chip: '사회인야구 공감', hookHtml: '타순 <em>8번</em>,<br>납득이<br>안 될 때', sub: '감독님, 저 왜 8번이에요?',
      facts: ['단톡방 대화는 지어낸 상황극', '선수 분석: 기록이 쌓이면 선수마다 시즌 성적(타율 · 출루율 · wOBA)이 정리됨', '그림 속 기록은 예시 데이터', '음성: AI 목소리'],
      hookSay: '타순 팔 번, 납득이 안 될 때.',
      scenes: [
        { l: '경기 전날 밤', html: chat([['나', '감독님 저 왜 8번이에요?'], ['감독', '기록 보여 줄까?']], 2), say: '참다 참다 감독님께 물어봤습니다.' },
        { l: '1분 뒤', html: chat([['나', '감독님 저 왜 8번이에요?'], ['감독', '기록 보여 줄까?'], ['감독', S.shot('bat', [0, 360, 390, 400], 480)]], 1), say: '감독님이 기록 한 장을 보내 주셨습니다.' },
        { l: '3분 뒤', html: chat([['감독', S.shot('bat', [0, 360, 390, 400], 480)], ['나', '…'], ['나', '8번 좋네요 ^^'], ['감독', 'ㅋㅋㅋ 내일 보자']], 3), say: '할 말이 없더군요.' },
      ],
      endHtml: '타순에도<br><em>근거</em>가 필요합니다', endSay: '타순에도 근거가 필요합니다. 스프레이랩, 기본 무료.',
    }),
    story({
      id: 'g3', type: 'G', aud: '사회인', topic: '경기 끝나고 "나 오늘 몇 타수 몇 안타였지?" (공감 상황극)',
      hook: '오늘 나 몇 타수 몇 안타였지?', chip: '사회인야구 공감', hookHtml: '오늘 나<br><em>몇 타수<br>몇 안타</em>였지?', sub: '경기 끝나면 꼭 나오는 질문',
      facts: ['단톡방 대화는 지어낸 상황극', '타구 위치만 찍어 두면 경기 끝나고 선수마다 카드 이미지(타석 결과 · 타구 위치 · 오늘 성적)', '그림 속 기록은 예시 데이터', '음성: AI 목소리'],
      hookSay: '오늘 나, 몇 타수 몇 안타였지?',
      scenes: [
        { l: '경기 끝나고', html: chat(G3, 3), say: '경기 끝나면 꼭 나오는 질문. 아무도 정확히 모릅니다.', sub: ['경기 끝나면 꼭 나오는 질문', '아무도 정확히 모릅니다'] },
        { l: '10분 뒤', html: chat([...G3, ['4번타자', '2회에 친 거 2루타잖아'], ['에이스', '그거 실책이었는데?'], ['-', '논쟁 30분째']], 3), say: '안타였는지 실책이었는지, 기억도 다 다르죠.', sub: ['안타였는지 실책이었는지', '기억도 다 다르죠'] },
        { l: '기록해 뒀다면', html: rvShot('card', [0, 0, 1080, 1180], 700), say: '타구 위치만 찍어 두면, 경기 끝나고 선수마다 카드가 나옵니다.', sub: ['타구 위치만 찍어 두면', '경기 끝나고 선수마다 카드 한 장'] },
      ],
      endHtml: '기억 말고<br><em>기록</em>으로', endSay: '기억 말고 기록으로. 스프레이랩, 기본 무료.',
    }),
    story({
      id: 'g4', type: 'G', aud: '사회인', topic: '오늘 기록은 누가 해요? — 결국 또 총무 (공감 상황극)',
      hook: '오늘 기록은 누가 해요?', chip: '사회인야구 공감', hookHtml: '오늘 <em>기록</em>은<br>누가 해요?', sub: '매주 떠넘기기 1순위',
      facts: ['단톡방 대화는 지어낸 상황극', '기록 화면: 타구가 떨어진 곳을 탭 → 결과 선택', '리그 기록지 A4 한 장이 자동으로(인쇄 가능)', '음성: AI 목소리'],
      hookSay: '오늘 기록은 누가 해요?',
      scenes: [
        { l: '경기 30분 전', html: chat([['총무', '오늘 기록 누가 해요?'], ['-', '17명 읽음 · 답장 없음']], 2), say: '이 말에 다들 읽기만 하고 조용합니다.' },
        { l: '경기 10분 전', html: chat([['총무', '오늘 기록 누가 해요?'], ['-', '17명 읽음 · 답장 없음'], ['총무', '…'], ['총무', '제가 할게요']], 2), say: '결국 또 총무가 합니다.' },
        { l: '폰 하나면', html: rvShot('rec', [0, 200, 390, 400], 700), say: '타구 떨어진 곳을 누르기만 하면, 기록지는 알아서 채워집니다.', sub: ['타구 떨어진 곳을 누르면', '기록지는 알아서 채워집니다'] },
      ],
      endHtml: '기록 담당,<br>이제 <em>폰 하나</em>면', endSay: '기록 담당도 폰 하나면 됩니다. 스프레이랩, 기본 무료.',
    }),
    story({
      id: 't1', type: 'T', tag: '예시 숫자', topic: '타율 5할, 믿어도 될까? — 타수가 적으면 타율이 크게 흔들린다 (기록 읽는 법)',
      hook: '타율 5할, 믿어도 될까?', chip: '기록 읽는 법', hookHtml: '타율 <em>5할</em>,<br>믿어도<br>될까?', sub: '타수부터 보세요',
      facts: ['A: 10타수 5안타 = 타율 .500', 'B: 100타수 30안타 = 타율 .300', '다음 한 타석에 A는 .455~.545(9푼), B는 .297~.307(1푼) 움직임', '타율을 볼 때는 타수를 같이 볼 것', '음성: AI 목소리'],
      hookSay: '타율 오할, 믿어도 될까요?',
      scenes: [
        { l: '두 타자', html: `<div class="vs">${[['A', '10타수 5안타', '.500'], ['B', '100타수 30안타', '.300']].map(([w, l, v]) => `<div class="vc rv"><div class="who">${w}</div><div class="ln">${l}</div><div class="k">타율</div><div class="v">${v}</div></div>`).join('')}</div>`,
          say: '열 타수 다섯 안타면 오할, 백 타수 서른 안타면 삼할입니다.', sub: ['10타수 5안타면 5할', '100타수 30안타면 3할'] },
        { l: '다음 한 타석에', html: [['A · 10타수', .455, .545, '9푼'], ['B · 100타수', .297, .307, '1푼']].map(([w, a, b, d]) => `<div class="rg rv"><div class="t"><span>${w}</span><b>±${d}</b></div><div class="tr"><s style="left:${(a - .25) / .35 * 100}%;right:${100 - (b - .25) / .35 * 100}%"></s></div><div class="ax"><span>.250</span><span>${a.toFixed(3).slice(1)} ~ ${b.toFixed(3).slice(1)}</span><span>.600</span></div></div>`).join(''),
          say: '다음 한 타석에 타율이, 에이는 구 푼, 비는 일 푼 움직입니다.', sub: ['다음 한 타석에 타율이', 'A는 9푼, B는 1푼 움직입니다'] },
        { l: '그래서', html: '<div class="say2 rv" style="margin-top:160px">타율 옆에<br><em>타수</em>부터<br>보세요</div>', say: '그래서 타율을 볼 때는 타수부터 같이 보세요.', sub: ['그래서 타율을 볼 때는', '타수부터 같이 보세요'] },
      ],
      endHtml: '기록은 쌓일수록<br><em>정확</em>해집니다', endSay: '기록은 쌓일수록 정확해집니다. 스프레이랩, 기본 무료.',
    }),
    story({
      id: 't2', type: 'T', tag: '예시 숫자', topic: '타율 똑같은 두 타자, 누가 더 나을까? — 볼넷과 출루율 (기록 읽는 법)',
      hook: '타율 똑같은 두 타자, 누가 더 나을까?', chip: '기록 읽는 법', hookHtml: '타율 <em>똑같은</em><br>두 타자,<br>누가 더 나을까?', hookSize: 112, sub: '볼넷을 세면 답이 나옵니다',
      facts: ['A: 20타수 6안타 볼넷 0 → 타율 .300 · 출루율 .300', 'B: 20타수 6안타 볼넷 5 → 타율 .300 · 출루율 .440', '1루를 밟은 횟수 6번 vs 11번', '출루율 = (안타+볼넷+사구) ÷ (타수+볼넷+사구+희생플라이)', 'SprayLab 은 출루율을 자동 계산', '음성: AI 목소리'],
      hookSay: '타율 똑같은 두 타자, 누가 더 나을까요?',
      scenes: [
        { l: '두 타자', html: `<div class="vs">${['A', 'B'].map((w, i) => `<div class="vc rv"><div class="who">${w}</div><div class="ln">20타수 6안타<br>볼넷 ${i ? 5 : 0}</div><div class="k">타율</div><div class="v">.300</div></div>`).join('')}</div>`,
          say: '두 타자 모두 스무 타수 여섯 안타, 타율 삼할입니다.', sub: ['둘 다 20타수 6안타', '타율 3할'] },
        { l: '출루율', html: `<div class="vs">${[['A', 0, '.300'], ['B', 5, '.440']].map(([w, bb, v], i) => `<div class="vc rv${i ? ' hi' : ''}"><div class="who">${w}</div><div class="ln">20타수 6안타<br>볼넷 ${bb}</div><div class="k">출루율</div><div class="v">${v}</div></div>`).join('')}</div>`,
          say: '그런데 비는 볼넷이 다섯 개. 출루율은 에이 삼할, 비는 사할 사푼입니다.', sub: ['그런데 B는 볼넷 5개', '출루율 A .300 · B .440'] },
        { l: '1루를 밟은 횟수', html: `<div class="vs">${[['A', 6], ['B', 11]].map(([w, v], i) => `<div class="vc rv${i ? ' hi' : ''}"><div class="who">${w}</div><div class="v" style="font-size:200px;margin-top:30px">${v}<span style="font-size:60px">번</span></div></div>`).join('')}</div>`,
          say: '일루를 밟은 횟수로 치면, 여섯 번과 열한 번.', sub: '1루를 밟은 횟수, 6번 vs 11번' },
      ],
      endHtml: '타율만 보면<br><em>볼넷</em>이 안 보입니다', endSay: '출루율은 스프레이랩이 자동으로 계산합니다. 기본 무료.',
    }),
    story({
      id: 't3', type: 'T', tag: '예시 데이터', topic: '당겨치는 타자가 나오면 수비는 어디에? — 타구 방향 보고 수비 위치 정하기 (기록 읽는 법)',
      hook: '이 타자 나오면, 수비 어디 설까?', chip: '기록 읽는 법', hookHtml: '이 타자 나오면<br>수비 <em>어디</em><br>설까?', sub: '타구 방향에 답이 있습니다',
      facts: [`상대 4번 타자(우타, 예시 데이터) 인플레이 타구 ${B4.bip.length}개 중 당겨친 타구 ${pullP}%`, '우타자가 당겨친 타구는 3루 · 유격수 쪽', '3루수 · 유격수를 한 발씩 3루 쪽으로', '상대 타자 타구 방향은 스카우트 탭에서', '음성: AI 목소리'],
      hookSay: '이 타자 나오면, 수비는 어디 설까요?',
      scenes: [
        { l: '상대 4번 타자 · 우타', html: `<div class="rv" style="margin-top:80px">${K.field(B4.bip, { w: 840, r: 2 })}</div>`, say: '상대 사 번 타자의 타구를 모아 보면,', sub: '상대 4번 타자의 타구를 모아 보면' },
        { l: '타구 방향', html: `<div style="margin-top:40px">${K.field(B4.bip, { w: 640, r: 1.8, sectors: [[-45, -15, 'rgba(255,90,54,.22)']] })}</div><div class="dir3" style="margin-top:50px">${B4.dirs.map((d, i) => `<div class="rv"><div class="num"${i ? '' : ' style="color:var(--acc)"'}>${d.p}%</div><span>${['당겨친', '가운데', '밀어친'][i]}</span></div>`).join('')}</div>`,
          say: `당겨친 타구가 ${kn(pullP)} 퍼센트.`, sub: `당겨친 타구가 ${pullP}%` },
        { l: '그래서', html: `<div class="say2 rv" style="margin-top:60px">3루수 · 유격수<br>한 발 <em>3루 쪽</em>으로</div><div class="rv" style="margin-top:60px">${K.field(B4.bip, { w: 640, r: 1.8, sectors: [[-45, -15, 'rgba(255,90,54,.22)']] })}</div>`,
          say: '그러면 삼루수와 유격수를, 한 발씩 삼루 쪽으로.', sub: ['그러면 3루수와 유격수를', '한 발씩 3루 쪽으로'] },
      ],
      endHtml: '수비 위치도<br><em>기록</em>으로', endSay: '상대 타자 타구 방향은 스카우트 탭에서. 스프레이랩, 기본 무료.',
    }),
  );

  // ── 유소년(리틀 · 초등) · 엘리트(중 · 고 · 대학 야구부) — 코치 · 학부모 · 선수에게 (aud) ──
  const PAR = '리틀 야구단 학부모방<small>24명</small>', STAFF = '야구부 코치진<small>4명</small>';
  const CARD = S.shot('card', [0, 0, 1080, 1180], 420);
  window.ITEMS.push(
    story({
      id: 'y1', type: 'G', aud: '유소년', topic: '경기 끝나면 학부모 단톡방 "우리 애 오늘 쳤어요?" — 선수 카드로 답하기 (리틀 · 유소년, 상황극)',
      hook: '우리 애, 오늘 쳤어요?', chip: '리틀 · 유소년 야구', hookHtml: '우리 애,<br>오늘<br><em>쳤어요?</em>', sub: '경기 끝나면 학부모방에 꼭 오는 질문',
      facts: ['단톡방 대화는 지어낸 상황극', '경기 중 타구 위치만 찍으면 경기 끝나고 선수마다 카드 이미지(타석 결과 · 타구 위치 · 오늘 성적)', '단톡방에 이미지로 바로 공유', '그림 속 기록은 예시 데이터', '음성: AI 목소리'],
      hookSay: '우리 애, 오늘 쳤어요?',
      scenes: [
        { l: '경기 끝나고', html: chat([['3번 어머니', '코치님 오늘 저희 애 어땠어요?'], ['3번 어머니', '안타 쳤나요? 😊'], ['7번 아버지', '저희 애는 몇 번 나갔어요?']], 3, PAR), say: '경기가 끝나면 학부모님 질문이 쏟아집니다.', sub: ['경기가 끝나면', '학부모님 질문이 쏟아집니다'] },
        { l: '코치', html: chat([['7번 아버지', '저희 애는 몇 번 나갔어요?'], ['코치', '오늘 선수별 기록입니다!'], ['코치', CARD]], 2, PAR), say: '이제는 선수마다 카드 한 장으로 답합니다.' },
        { l: '1분 뒤', html: chat([['코치', CARD], ['3번 어머니', '와 감사합니다 코치님 ㅠㅠ'], ['7번 아버지', '할머니께도 보내 드렸어요']], 2, PAR), say: '할머니 할아버지께도 바로 보낼 수 있죠.' },
      ],
      endHtml: '경기 끝나면<br>선수마다 <em>카드 한 장</em>', endSay: '경기 끝나면 선수마다 카드 한 장. 스프레이랩, 기본 무료.',
    }),
    story({
      id: 'y2', type: 'G', aud: '엘리트', topic: '오늘 우리 투수 몇 개 던졌죠? — 투구 수 · 구종 기록 (중학 · 고교 야구부, 상황극)',
      hook: '오늘 우리 투수, 몇 개 던졌죠?', chip: '중학 · 고교 야구', hookHtml: '오늘 우리 투수,<br><em>몇 개</em><br>던졌죠?', hookSize: 112, sub: '투구 수, 감으로 세고 계신가요?',
      facts: ['코치진 단톡방 대화는 지어낸 상황극', '공 하나 누를 때마다 투구 수 · 스트라이크% · 초구 스트라이크% · 구종 비율이 쌓임', '경기 끝나면 투수 리포트 이미지 한 장(1080×1350)', '그림 속 기록은 예시 데이터', '음성: AI 목소리'],
      hookSay: '오늘 우리 투수, 몇 개 던졌죠?',
      scenes: [
        { l: '경기 끝나고', html: chat([['감독', '선발 몇 개 던졌어?'], ['코치', '대충 70개 정도요?'], ['감독', '대충?']], 3, STAFF), say: '투구 수를 물으면, 대충이라는 답이 돌아옵니다.', sub: ['투구 수를 물으면', '대충이라는 답이 돌아옵니다'] },
        { l: '공 하나씩 누르면', html: `${rvShot('pit', [0, 372, 390, 210], 840)}<div style="margin-top:28px">${rvShot('pit', [0, 1490, 390, 200], 840)}</div>`, say: '공 하나 누를 때마다, 투구 수와 구종 비율이 쌓입니다.', sub: ['공 하나 누를 때마다', '투구 수와 구종 비율이 쌓입니다'] },
        { l: '경기 끝나면', html: rvShot('pitrep', [0, 0, 1080, 1350], 760), say: '경기가 끝나면 투수 리포트 한 장으로 정리됩니다.', sub: ['경기가 끝나면', '투수 리포트 한 장으로 정리'] },
      ],
      endHtml: '투구 수,<br><em>세지 말고</em> 기록', endSay: '투구 수는 세지 말고 기록하세요. 스프레이랩, 기본 무료.',
    }),
    story({
      id: 'y3', type: 'G', aud: '엘리트', topic: '전력분석원 없어도 상대 타자 분석 — 스카우트 탭 (고교 · 대학 야구부, 상황극)',
      hook: '전력분석원 없어도 상대 분석', chip: '고교 · 대학 야구', hookHtml: '전력분석원<br>없어도<br><em>상대 분석</em>', sub: '내일 상대 4번, 어디로 쳐요?',
      facts: ['코치진 단톡방 대화는 지어낸 상황극', '경기마다 상대 타석까지 기록해 두면 스카우트 탭이 상대 타자별로 정리', '상대 타자 공략 리포트: 타율 · 출루율 · 위협도 · 공략 포인트', '코스별 결과 9칸 · 수비 위치', '그림 속 기록은 예시 데이터', '음성: AI 목소리'],
      hookSay: '전력분석원 없어도, 상대 분석 됩니다.',
      scenes: [
        { l: '경기 전날', html: chat([['감독', '내일 상대 4번 어디로 쳐?'], ['코치', '작년 영상 찾아볼게요…'], ['-', '3시간 뒤']], 3, STAFF), say: '상대 타자 하나 보려고, 영상만 몇 시간.' },
        { l: '스카우트 탭', html: rvShot('scout', [0, 310, 390, 300], 840), say: '경기마다 상대 타석까지 기록해 두면, 스카우트 탭이 정리해 줍니다.', sub: ['상대 타석까지 기록해 두면', '스카우트 탭이 정리해 줍니다'] },
        { l: '코스별 결과', html: rvShot('scout', [0, 1100, 390, 420], 760), say: '공략 포인트와 코스별 결과까지 한눈에.' },
      ],
      endHtml: '경기마다 쌓이는<br><em>우리 팀 전력분석</em>', endSay: '경기마다 쌓이는 우리 팀 전력분석. 스프레이랩, 기본 무료.',
    }),
    story({
      id: 'y4', type: 'G', aud: '엘리트', topic: '내 기록, 내가 쌓는다 — 시즌 성적 · 흐름 · 선수 카드 (엘리트 야구 선수)',
      hook: '내 기록, 내가 쌓는다', chip: '엘리트 야구', hookHtml: '내 기록,<br><em>내가</em><br>쌓는다', sub: '시즌이 끝나도 숫자는 남습니다',
      facts: ['경기마다 타석을 찍어 두면 시즌 성적(타율 · 출루율 · 장타율 · wOBA)이 자동으로', '오늘 · 최근 3경기 · 시즌 흐름 비교', '선수 카드 이미지로 저장', '그림 속 기록은 예시 데이터', '음성: AI 목소리'],
      hookSay: '내 기록, 내가 쌓습니다.',
      scenes: [
        { l: '시즌 성적', html: rvShot('bat', [0, 370, 390, 300], 840), say: '경기마다 타석을 찍어 두면, 시즌 성적이 자동으로 정리됩니다.', sub: ['경기마다 타석을 찍어 두면', '시즌 성적이 자동으로'] },
        { l: '흐름 비교', html: rvShot('bat', [0, 700, 390, 250], 840), say: '오늘, 최근 세 경기, 시즌까지 흐름이 한눈에.', sub: '오늘 · 최근 3경기 · 시즌 흐름' },
        { l: '선수 카드', html: rvShot('card', [0, 0, 1080, 1180], 640), say: '선수 카드 이미지로 저장해 두세요.' },
      ],
      endHtml: '시즌이 끝나도<br><em>기록</em>은 남습니다', endSay: '시즌이 끝나도 기록은 남습니다. 스프레이랩, 기본 무료.',
    }),
  );

  // 게시 순서 — 11-06(금)부터 매일 하나. 릴스 15 · 카드뉴스 5 (사회인 · 유소년 · 엘리트 섞어서), 11-20쯤 숫자 보고 다시 정한다
  // 빠진 것(c1 은 11-03 게시, 이미지 i1~i3 은 도달 1~6명)은 off — 풀 파일만 남기고 manifest 에는 안 넣는다
  const ORDER = ['r1', 'g1', 'y1', 't2', 'c2', 'g3', 'y2', 'r3', 'g2', 't1', 'y3', 'c3', 'g4', 'r2', 'y4', 't3', 'c4', 'r4', 'c5', 'c6'];
  window.ITEMS = [...ORDER.map(id => window.ITEMS.find(x => x.id === id)), ...window.ITEMS.filter(x => !ORDER.includes(x.id)).map(x => ({ ...x, off: true }))];
  window.SUBJ = { P1, B2, B3, CELL };
})();
