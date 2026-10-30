// 게시물 목록 — 순서 = 게시 순서 (루틴이 회차마다 다음 것을 쓴다)
// 숫자는 전부 data.js 의 가짜 데이터에서 계산한다. 사람 이름 대신 별명·등번호만 쓴다.
(() => {
  const { G, S, K } = window;
  const sum = xs => xs.reduce((a, b) => a + b, 0);

  // ── 등장인물 (가짜) ───────────────────────────────────
  const P1 = G.pitcher(217, {
    name: '에이스', num: 17, team: '샘플 블루스', opp: 'vs 샘플 레즈', date: '10.26', pa: 25,
    aim: { '직구': [.52, .36], '슬라이더': [.74, .7], '커브': [.48, .82], '체인지업': [.32, .72] },
    mix: c => (!c.b && !c.s) ? [['직구', 6], ['슬라이더', 1.5], ['커브', 2]] : c.s === 2 ? [['슬라이더', 6], ['직구', 2], ['커브', 1.5], ['체인지업', 1]]
      : c.b > c.s ? [['직구', 7], ['체인지업', 2], ['슬라이더', 1]] : [['직구', 4], ['슬라이더', 3], ['커브', 2], ['체인지업', 1]],
  });
  const P2 = G.pitcher(70, {
    name: '베테랑', num: 21, team: '샘플 블루스', opp: 'vs 샘플 이글스', date: '10.19', pa: 27, fatigue: .35, spread: .5,
    aim: { '직구': [.5, .4], '포크볼': [.5, .85], '커브': [.45, .8] },
    mix: c => c.s === 2 ? [['포크볼', 5], ['직구', 3], ['커브', 2]] : [['직구', 6], ['커브', 2], ['포크볼', 1.5]],
  });
  const B1 = G.batter(172, { name: '캡틴', num: 7, hand: 'R', pa: 72, pull: .64, gb: .55, hot: Array(9).fill(1) });
  const B2 = G.batter(533, { name: '거포', num: 24, hand: 'R', pa: 110, pull: .42, gb: .42, hot: [1.5, 1.2, 1, 1.3, 1.1, .9, 1, .8, .3] });
  const B3 = G.batter(143, { name: '막내', num: 11, hand: 'L', pa: 80, pull: .5, gb: .45, hot: Array(9).fill(1), first: 1.7, firstSwing: .75 });
  const TEAM = G.team(500, [
    { l: '#2 유격수', pull: .45, gb: .5, hand: 'R' }, { l: '#5 2루수', pull: .4, gb: .55, hand: 'L' }, { l: '#7 중견수', pull: .5, gb: .45, hand: 'R' },
    { l: '#10 포수', pull: .6, gb: .4, hand: 'R', power: .7 }, { l: '#13 1루수', pull: .65, gb: .35, hand: 'R', power: .8 }, { l: '#19 좌익수', pull: .55, gb: .45, hand: 'L' },
    { l: '#24 3루수', pull: .6, gb: .5, hand: 'R' }, { l: '#27 우익수', pull: .5, gb: .5, hand: 'L' }, { l: '#33 지명', pull: .55, gb: .45, hand: 'R' },
  ]);

  const sl1 = { a: P1.share(P1.m0, '슬라이더'), b: P1.share(P1.m2, '슬라이더') };
  const sl2S = P1.ps.filter(p => p.pt === '슬라이더' && p.c.s === 2), low2S = sl2S.filter(p => p.y > .6).length, out2S = sl2S.filter(p => !(p.x > .25 && p.x < .75 && p.y > .18 && p.y < .82)).length;
  const times = (a, b) => (b / a).toFixed(1).replace(/\.0$/, '');
  const dirName = h => h === 'L' ? ['밀어친', '가운데', '당겨친'] : ['당겨친', '가운데', '밀어친'];
  const b2w = B2.grid[8], b2h = B2.grid.reduce((m, g, i) => g.v > B2.grid[m].v ? i : m, 0);
  const CELL = ['몸쪽 높은', '가운데 높은', '바깥쪽 높은', '몸쪽 가운데', '한가운데', '바깥쪽 가운데', '몸쪽 낮은', '가운데 낮은', '바깥쪽 낮은'];
  const obpRank = [...TEAM].sort((a, b) => b.obpV - a.obpV), slgRank = [...TEAM].sort((a, b) => b.slgV - a.slgV);
  const bk = P2.buckets, sOf = xs => G.pct(xs.filter(p => p.kind !== 'ball').length, xs.length), early = sOf(P2.ps.slice(0, 50)), late = sOf(P2.ps.slice(50));

  window.ITEMS = [
    {
      id: 'c1', format: 'carousel', theme: 'field', type: 'B', topic: '카운트별 구종 — 2스트라이크 결정구',
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
      id: 'r1', format: 'reel', theme: 'night', type: 'B', topic: '풀카운트 승부 한 타석 — 공 하나씩 다시 보기',
      hook: '풀카운트, 마지막 공은?', reel: 'pa', subject: 'P1', pa: P1.fullK[1] || P1.fullK[0],
      facts: [`가상의 투수 '에이스' 풀카운트 승부 ${(P1.fullK[1] || P1.fullK[0]).length}구`, `순서: ${(P1.fullK[1] || P1.fullK[0]).map(p => `${p.pt} ${p.res}`).join(' → ')}`, '마지막은 슬라이더 헛스윙 삼진'],
    },
    {
      id: 'i1', format: 'image', theme: 'night', type: 'C', topic: '경기 전 단톡방에 올리는 투수 리포트 한 장',
      hook: '상대 팀 에이스, 이 한 장이면 정리 끝', slides: () => [window.R1.broadcast(P1)],
      facts: [`가상의 투수 '에이스' ${P1.ip}이닝 ${P1.n}구`, `스트라이크 ${P1.sPct}% · 초구 스트라이크 ${P1.fsPct}%`, `삼진 ${P1.K} · 볼넷 ${P1.BB}`, `구종 비율: ${P1.types.map(t => `${t.pt} ${t.use}%`).join(', ')}`],
    },
    {
      id: 'c2', format: 'carousel', theme: 'field', type: 'A', topic: '고르게 친다고 생각했는데 타구가 한쪽으로 쏠림',
      hook: '저는 제가 고르게 치는 줄 알았습니다',
      facts: [`가상의 우타자 '캡틴' 인플레이 타구 ${B1.bip.length}개`, `당겨친 타구 ${B1.dirs[0].p}% · 가운데 ${B1.dirs[1].p}% · 밀어친 타구 ${B1.dirs[2].p}%`, `당겨친 타구 중 땅볼 ${B1.dirs[0].gb}%`, `타율 ${B1.all.avg}`],
      slides: () => [
        S.cover({ chip: '타자 데이터 · 타구 방향', page: '1 / 4', h1: `타구 <em>${B1.dirs[0].p}%</em>가<br>왼쪽으로 갔습니다`, sub: '저는 제가 고르게 치는 줄 알았거든요', visTop: 560,
          vis: `<div style="display:flex;justify-content:center">${K.field(B1.bip, { w: 820, r: 1.9, sectors: [[-45, -15, 'rgba(45,212,160,.16)']] })}</div>`, next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '타자 데이터 · 타구 방향', page: '2 / 4', h1: `인플레이 타구 ${B1.bip.length}개`, h1Style: 'font-size:88px', sub: `우타자 · ${B1.pa}타석 · 타율 ${B1.all.avg}`, visTop: 500,
          vis: `<div style="display:flex;justify-content:center">${K.field(B1.bip, { w: 620, r: 2.1 })}</div>${S.legendRes()}<div style="margin-top:30px">${S.nums(B1.dirs.map((d, i) => [d.p, dirName('R')[i] + ' 타구', '%']))}</div>`, next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '타자 데이터 · 타구 종류', page: '3 / 4', h1: `당겨친 타구는<br>땅볼이 <em>${B1.dirs[0].gb}%</em>`, h1Style: 'font-size:92px', sub: '방향마다 땅볼 비율', visTop: 620,
          vis: S.bars(B1.dirs.map((d, i) => ({ l: dirName('R')[i] + ' 타구', sub: `${d.n}개 중 안타 ${d.h}`, v: d.gb / 100, t: d.gb + '%', hi: i === 0 }))), next: '넘겨서 더 보기 →' }),
        S.cta({ chip: 'SprayLab', page: '4 / 4', steps: ['타구가 떨어진 곳을 탭 한 번', '방향 · 땅볼 비율이 자동으로', '시즌이 쌓이면 습관이 보입니다'] }),
      ],
    },
    {
      id: 'r2', format: 'reel', theme: 'field', type: 'B', topic: '한 타자의 타구가 하나씩 떨어지는 스프레이 차트',
      hook: `타구 ${B1.bip.length}개, 어디로 갔을까?`, reel: 'spray', subject: 'B1',
      facts: [`가상의 우타자 '캡틴' 인플레이 타구 ${B1.bip.length}개`, `당겨친 타구 ${B1.dirs[0].p}%`, `가운데 ${B1.dirs[1].p}% · 밀어친 타구 ${B1.dirs[2].p}%`],
    },
    {
      id: 'i2', format: 'image', theme: 'paper', type: 'B', topic: '코스별 타율 9칸 — 약점 코스',
      hook: `${CELL[8]} 공 타율 ${b2w.avg}`,
      slides: () => [S.cover({ chip: '타자 데이터 · 코스별 타율', h1: `${CELL[8]} 공<br>타율 <em>${b2w.avg}</em>`, h1Style: 'font-size:96px', sub: `가상의 우타자 '거포' · ${B2.pa}타석 · 포수 시점`, visTop: 520,
        vis: `<div style="display:flex;justify-content:center">${K.grid9(B2.grid, { s: 180, gap: 10, mark: 8 })}</div><div class="leg" style="margin-top:22px"><span>칸마다 안타/타수</span><span style="color:#4b8cf5">■ 차가움</span><span style="color:#FF5A36">■ 뜨거움</span></div>` })],
      facts: [`가상의 우타자 '거포' ${B2.pa}타석`, `${CELL[8]} 코스 타율 ${b2w.avg} (${b2w.h}/${b2w.ab})`, `가장 강한 코스: ${CELL[b2h]} ${B2.grid[b2h].avg}`, `전체 타율 ${B2.all.avg}`],
    },
    {
      id: 'c3', format: 'carousel', theme: 'paper', type: 'C', topic: '라인업 짤 때 감 대신 출루율·장타율 보기',
      hook: '라인업, 감 말고 출루율부터',
      facts: ['가상의 팀 9명, 한 사람당 48타석', `출루율 1·2위: ${obpRank[0].l} ${obpRank[0].b.obp}, ${obpRank[1].l} ${obpRank[1].b.obp}`, `장타율 1위: ${slgRank[0].l} ${slgRank[0].b.slg}`],
      slides: () => [
        S.cover({ chip: '팀 데이터 · 라인업', page: '1 / 4', h1: '라인업,<br>감 말고 <em>출루율</em>부터', sub: '주말마다 타순 정할 때 꺼내 보는 숫자', visTop: 600,
          vis: S.bars(obpRank.map((t, i) => ({ l: t.l, v: (t.obpV - .25) / .2, t: t.b.obp, hi: i < 2 }))).replace('class="bl"', 'class="bl sm"'), visTop: 560, next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '팀 데이터 · 라인업', page: '2 / 4', h1: '한눈에 보는 9명', h1Style: 'font-size:88px', sub: '출루율 높은 순 · 한 사람당 48타석', visTop: 520,
          vis: S.table(['선수', '타율', '출루율', '장타율', '삼진%'], obpRank.map(t => [t.l, t.b.all.avg, `<b>${t.b.obp}</b>`, t.b.slg, t.b.kPct + '%']), [0, 1]), next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '팀 데이터 · 라인업', page: '3 / 4', h1: `중심 타선은<br><em>장타율</em>로`, h1Style: 'font-size:92px', sub: '장타율 높은 순 · 3·4·5번 후보', visTop: 600,
          vis: S.bars(slgRank.map((t, i) => ({ l: t.l, v: (t.slgV - .18) / .2, t: t.b.slg, hi: i < 3 }))).replace('class="bl"', 'class="bl sm"'), visTop: 560, next: '넘겨서 더 보기 →' }),
        S.cta({ chip: 'SprayLab', page: '4 / 4', h1: '기록만 하면<br>표는 알아서', steps: ['경기마다 타석 결과를 탭', '출루율 · 장타율 · 삼진%가 선수별로', '라인업 카드도 이미지로 바로'] }),
      ],
    },
    {
      id: 'r3', format: 'reel', theme: 'night', type: 'B', topic: '9칸 코스별 타율을 한 칸씩 공개하며 약점 찾기',
      hook: '9칸 중에 약점은 어디?', reel: 'grid', subject: 'B2',
      facts: [`가상의 우타자 '거포' ${B2.pa}타석`, `약점: ${CELL[8]} 공 타율 ${b2w.avg}`, `강점: ${CELL[b2h]} 공 타율 ${B2.grid[b2h].avg}`],
    },
    {
      id: 'c4', format: 'carousel', theme: 'sun', type: 'B', topic: '초구를 쳤을 때 vs 2스트라이크까지 갔을 때 타율',
      hook: '초구는 무조건 본다는 분들께',
      facts: [`가상의 좌타자 '막내' ${B3.pa}타석`, `초구를 쳐서 끝난 타석 타율 ${B3.first.avg} (${B3.first.h}/${B3.first.ab})`, `2스트라이크까지 간 타석 타율 ${B3.twoS.avg} (${B3.twoS.h}/${B3.twoS.ab})`, `전체 타율 ${B3.all.avg}`],
      slides: () => [
        S.cover({ chip: '타자 데이터 · 카운트별 타율', page: '1 / 3', h1: `초구를 치면<br>타율 <em>${B3.first.avg}</em>`, sub: '초구는 무조건 지켜본다는 분들께', visTop: 640,
          vis: S.compare({ l: '2스트라이크까지 가면', v: B3.twoS.avg }, { l: '초구를 쳤을 때', v: B3.first.avg }), next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '타자 데이터 · 카운트별 타율', page: '2 / 3', h1: '카운트가 불리할수록<br>타율이 내려갑니다', h1Style: 'font-size:84px', sub: `타석이 끝난 카운트 기준 · ${B3.pa}타석`, visTop: 600,
          vis: S.bars([['초구', B3.first], ['볼이 많을 때', B3.ahead], ['1스트라이크 불리', B3.behind], ['2스트라이크', B3.twoS]].map(([l, x], i) => ({ l, sub: `${x.h}/${x.ab}`, v: x.v / .5, t: x.avg, hi: i === 0 }))), next: '넘겨서 더 보기 →' }),
        S.cta({ chip: 'SprayLab', page: '3 / 3', steps: ['타석마다 볼·스트라이크를 탭', '카운트별 타율이 자동으로', '내가 언제 잘 치는지 숫자로'] }),
      ],
    },
    {
      id: 'i3', format: 'image', theme: 'paper', type: 'C', topic: '투수 리포트 — 깔끔한 표 버전',
      hook: '구종 · 비율 · 위치를 한 장에', slides: () => [window.R1.clean(P2)],
      facts: [`가상의 투수 '베테랑'(#21) ${P2.ip}이닝 ${P2.n}구`, `구종: ${P2.types.map(t => `${t.pt} ${t.use}%`).join(', ')}`, `스트라이크 ${P2.sPct}% · 삼진 ${P2.K}`],
    },
    {
      id: 'r4', format: 'reel', theme: 'sun', type: 'D', topic: '한 경기 → 다섯 경기 → 시즌, 기록이 쌓이는 모습',
      hook: `1경기 ${Math.round(B3.bip.length / 14)}개, 14경기면?`, reel: 'season', subject: 'B3',
      facts: [`가상의 좌타자 '막내' 시즌 ${B3.pa}타석`, `인플레이 타구 ${B3.bip.length}개가 쌓이는 과정`, '기록은 경기마다 탭 몇 번'],
    },
    {
      id: 'c5', format: 'carousel', theme: 'night', type: 'C', topic: '투구수가 늘면 떨어지는 스트라이크% — 교체 타이밍',
      hook: '교체 타이밍, 투구수 구간으로 보기',
      facts: [`가상의 투수 '베테랑' ${P2.n}구`, `구간별 스트라이크%: ${bk.map(b => `${b.l} ${b.s}%`).join(', ')}`, `50구까지 스트라이크 ${early}% → 51구부터 ${late}%`],
      slides: () => [
        S.cover({ chip: '투수 데이터 · 교체 타이밍', page: '1 / 3', h1: `50구를 넘기면<br>스트라이크 <em>${early}% → ${late}%</em>`, h1Style: 'font-size:90px', sub: '투구수 구간별 스트라이크% (볼이 아닌 공)', visTop: 620,
          vis: S.bars(bk.map((b, i) => ({ l: b.l, sub: `${b.n}구`, v: b.s / 100, t: b.s + '%', hi: i === bk.length - 1 }))), next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '투수 데이터 · 교체 타이밍', page: '2 / 3', h1: '공이 점점<br>존을 벗어납니다', h1Style: 'font-size:92px', sub: '처음 25구 vs 76구부터 · 포수 시점', visTop: 560,
          vis: `<div style="display:flex;gap:40px;justify-content:center">${[[P2.ps.slice(0, 25), bk[0]], [P2.ps.slice(75), bk.at(-1)]].map(([xs, b]) => `<div style="text-align:center"><div class="zl">${b.l}</div>${K.zone(xs, { w: 400, r: 3.2, glow: true })}<div class="zv">스트라이크 <b>${b.s}%</b></div></div>`).join('')}</div>`, next: '넘겨서 더 보기 →' }),
        S.cta({ chip: 'SprayLab', page: '3 / 3', h1: '교체 타이밍,<br>숫자로 정하기', steps: ['투구마다 위치를 탭', '투구수 구간별 스트라이크%가 자동으로', '다음 경기 투수 운영에 그대로'] }),
      ],
    },
    {
      id: 'c6', format: 'carousel', theme: 'field', type: 'D', topic: '기록 하나로 나오는 것들 — 기능 소개',
      hook: '탭 몇 번 하면 이런 게 나옵니다',
      facts: ['스프레이 차트(타구 방향)', '코스별 타율 9칸', '카운트별 구종 · 구종별 위치(투수)', '팀 단톡방용 리포트 이미지'],
      slides: () => [
        S.cover({ chip: 'SprayLab · 기능', page: '1 / 5', h1: '탭 몇 번이면<br><em>이런 게</em> 나옵니다', sub: '사회인야구 기록 앱 SprayLab', visTop: 610,
          vis: `<div class="mini4">${[K.field(B1.bip.slice(0, 30), { w: 400, r: 2.2 }), K.grid9(B2.grid, { s: 74, gap: 5 }), K.zone(P1.ps.slice(0, 50), { w: 230, r: 3 }), S.nums([[P1.sPct, '스트라이크', '%'], [P1.K, '삼진', '']])].map(x => `<div>${x}</div>`).join('')}</div>`, next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '1 · 스프레이 차트', page: '2 / 5', h1: '타구가 간 곳이<br>그대로 남습니다', h1Style: 'font-size:90px', sub: '방향 · 거리 · 결과까지', visTop: 520,
          vis: `<div style="display:flex;justify-content:center">${K.field(B3.bip, { w: 820, r: 1.9 })}</div>${S.legendRes()}`, next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '2 · 코스별 타율', page: '3 / 5', h1: '어느 코스에<br>강한지 9칸으로', h1Style: 'font-size:90px', sub: '포수 시점 · 칸마다 안타/타수', visTop: 540,
          vis: `<div style="display:flex;justify-content:center">${K.grid9(B2.grid, { s: 180, gap: 10 })}</div>`, next: '넘겨서 더 보기 →' }),
        S.cover({ chip: '3 · 투구 분석', page: '4 / 5', h1: '투수는 구종 ·<br>위치 · 카운트까지', h1Style: 'font-size:90px', sub: '상대 투수 분석도 같은 화면에서', visTop: 560,
          vis: `<div style="display:flex;gap:50px;align-items:center;justify-content:center">${K.zone(P1.ps, { w: 420, r: 2.4, glow: true })}<div>${S.stack([{ l: '초구', ...P1.m0 }, { l: '2스트라이크', ...P1.m2 }]).replace('class="stk"', 'class="stk narrow"')}</div></div>`, next: '넘겨서 더 보기 →' }),
        S.cta({ chip: 'SprayLab', page: '5 / 5', h1: '기록은 탭,<br>분석은 자동' }),
      ],
    },
  ];
  window.SUBJ = { P1, P2, B1, B2, B3, TEAM, CELL };
})();
