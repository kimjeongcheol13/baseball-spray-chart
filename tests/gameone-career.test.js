// 게임원 통산 카드(js/features/gocareer.js + js/gameone.js parseGameOneCareer)
//  · 게임원 선수 페이지(이름 · 우투우타 · 비선출 · 학교 / 타자기록 / 투수기록)를 붙여넣으면 숫자를 그대로 읽는다(방어율 7이닝 기준 그대로)
//  · 분석 탭 › 타자 › 시즌 맨 아래 카드 · 이름이 다르면 저장 안 함 · sl_go_career { p: { 선수: … } } · 지우기
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  // 실제 붙여넣기(2026-10-28, 사용자 제공 — 김호인)
  var SAMPLE = ['김호인', '우투우타', '비선출', '대산고등학교', '', '', '타자기록', '',
    '* 경기수68', '* 타율0.615', '* 타석236', '* 타수192', '* 득점111', '* 총안타118', '* 1루타63', '* 2루타27', '* 3루타3', '* 홈런25',
    '* 루타226', '* 타점125', '* 도루30', '* 도루자1', '* 희타0', '* 희비5', '* 볼넷28', '* 고의4구2', '* 사구11', '* 삼진22', '* 병살0',
    '* 장타율1.177', '* 출루율0.665', '* 도루성공률0.968', '* 멀티히트41', '* OPS1.842', '* BB/K1.27', '* 장타/안타0.466', '', '', '',
    '투수기록', '', '* 경기수11', '* 방어율5.33', '* 승1', '* 패0', '* 세0', '* 홀드0', '* 승률1.000', '* 타자112', '* 타수89', '* 투구수156',
    '* 이닝22 ⅓', '* 피안타22', '* 피홈런2', '* 희타0', '* 희비0', '* 볼넷21', '* 고의4구0', '* 사구2', '* 탈삼진34', '* 폭투4', '* 보크0',
    '* 실점26', '* 자책점17', '* WHIP1.93', '* 피안타율0.247', '* 탈삼진율10.66'].join('\n');
  // 실제 붙여넣기 2(2026-10-29): 투수 칸만, '투수기록' 줄 없이
  var PIT_ONLY = ['김호인', '우투우타', '비선출', '대산고등학교', ''].concat(SAMPLE.split('\n').slice(SAMPLE.split('\n').indexOf('투수기록') + 1)).join('\n');
  var KEY = 'sl_1790000950001';
  function P() { return window.SLGameOne.parseGameOneCareer.apply(null, arguments); }
  function card() { return document.getElementById('goCareer'); }
  function stored() { return (JSON.parse(localStorage.getItem('sl_go_career') || '{}').p) || {}; }
  function cells() {
    return Array.prototype.map.call(card().querySelectorAll('.pf-counts div'), function (d) { return d.querySelector('dt').textContent + ' ' + d.querySelector('dd').textContent; });
  }
  // 펼친 뒤 화면에 보이는 버튼을 눌러 본다(가려져 있으면 실패)
  function press(sel) {
    var c = card(); c.querySelector('details').open = true;
    var b = c.querySelector(sel); b.scrollIntoView({ block: 'center' });
    var r = b.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    ok(top === b, sel + ' 가 맨 위 — ' + (top && (top.id || top.className)));
    top.click();
  }
  function paste(text) { var c = card(); c.querySelector('details').open = true; c.querySelector('textarea').value = text; }
  function open(name) { setBatterView('scope', 'season'); setBatterView('sel', name); }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.SLGameOne && typeof window.SLGameOne.parseGameOneCareer === 'function' && window.goCareerSave, '파서 · 카드 로드');
  });

  test('파서: 김호인 페이지 — 머리(이름 · 투타 · 출신 · 학교) · 타자 28칸 · 투수 26칸을 숫자 그대로', function () {
    var r = P(SAMPLE);
    eq([r.name, r.hand, r.bg, r.school], ['김호인', '우투우타', '비선출', '대산고등학교'], '머리');
    eq([Object.keys(r.bat).length, Object.keys(r.pit).length], [28, 26], '칸 수');
    var b = r.bat;
    eq([b.g, b.avg, b.pa, b.ab, b.h, b.s1, b.s2, b.s3, b.hr, b.tb, b.rbi, b.sb, b.cs, b.bb, b.ibb, b.hbp, b.k, b.slg, b.obp, b.ops, b.bbk, b.xbhH],
      [68, 0.615, 236, 192, 118, 63, 27, 3, 25, 226, 125, 30, 1, 28, 2, 11, 22, 1.177, 0.665, 1.842, 1.27, 0.466], '타자(1루타 · 루타 · 도루자 · 장타/안타 등 이름이 겹치는 칸)');
    var p = r.pit;
    eq([p.g, p.era, p.w, p.l, p.sv, p.wpct, p.tbf, p.outs, p.h, p.hr, p.bb, p.k, p.r, p.er, p.whip, p.avg, p.k7],
      [11, 5.33, 1, 0, 0, 1, 112, 67, 22, 2, 21, 34, 26, 17, 1.93, 0.247, 10.66], '투수(이닝 22⅓ = 67아웃 · 승/승률 · 피안타/피안타율 · 탈삼진/탈삼진율)');
  });

  test('파서: 글머리 없이 이름 · 값이 다른 줄 · 앞에 메뉴 글자 · 22 2/3 · 값 - · 투수기록 없음', function () {
    var split = SAMPLE.replace(/^\* /mg, '').replace(/^(\D+?|[123]루타|고의4구)(\d[\d.]*(?: ⅓)?)$/mg, '$1\n$2');
    var a = P('게임원 홈 리그 기록실\n' + split), b = P(SAMPLE);
    eq([a.name, a.bat, a.pit], [b.name, b.bat, b.pit], '같은 결과');
    var c = P('홍길동(12)\n좌투좌타\n타자기록\n경기수: 3\n타율 -\n투수기록\n이닝 22 2/3');
    eq([c.name, c.hand, c.bat, c.pit], ['홍길동', '좌투좌타', { g: 3, avg: null }, { outs: 68 }], '콜론 · - · 2/3');
    eq(P('김호인\n타자기록\n경기수68').pit, null, '투수기록 없으면 null');
    eq([P('').bat, P(null).pit], [null, null], '빈 입력');
  });

  test('파서: 머리글(타자기록 · 투수기록) 없이 — 투수 칸만 · 둘 다 · 양쪽에 다 있는 이름만이면 버림', function () {
    var b = P(SAMPLE), p = P(PIT_ONLY);
    eq([p.name, p.hand, p.school, p.bat, p.pit], ['김호인', '우투우타', '대산고등학교', null, b.pit], '투수 칸만(실제 붙여넣기 2)');
    var both = P(SAMPLE.replace(/^(타자|투수)기록$/mg, ''));
    eq([both.name, both.bat, both.pit], [b.name, b.bat, b.pit], '둘 다 머리글 없이 = 경기수 줄로 나눔');
    eq([P('홍길동\n경기수3\n볼넷2\n사구1').bat, P('홍길동\n경기수3\n볼넷2').pit], [null, null], '타자인지 투수인지 모름');
    eq(P('세종고등학교\n경기수3\n승1').name, '세종고등학교', "'세' · '승'으로 시작하는 머리 줄도 머리로");
    eq([P('우투우타\n타자기록\n경기수3').name, P('비선출\n경기수3\n승1').name], ['', ''], "'우투우타' · '비선출'부터 붙이면 이름 없음");
  });

  test('카드: 분석 탭 › 타자 › 시즌 맨 아래 · 처음엔 안내 + 붙여넣기(접힘)', async function () {
    localStorage.removeItem('sl_go_career');
    var abs = ['안타', '삼진', '홈런'].map(function (res, i) { return { id: i + 1, bid: 77, bname: '김호인', bnum: '7', res: res, inn: (i + 1) + '회' }; })
      .concat([{ id: 9, bid: 78, bname: '다른선수', bnum: '8', res: '볼넷', inn: '1회' }]);
    localStorage.setItem(KEY, JSON.stringify({ key: KEY, ta: '원정', th: '우리팀', hs: 0, as: 0, abs: abs, home_lineup: [], away_lineup: [], zoneHistory: {}, d: '2026. 10. 28.', ts: 1790000950001 }));
    var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]'); saves.push({ key: KEY, label: '원정 vs 우리팀', ts: 1790000950001 });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
    shellOpenAnalysis('batter');
    await T.sleep(50);
    open('김호인');
    var c = card();
    ok(c && c.closest('#batterView'), '타자 화면 안');
    ok(!c.nextElementSibling || !c.nextElementSibling.matches('section.an-card'), '시즌 카드 중 맨 아래');
    eq([c.querySelector('h3').textContent, c.dataset.name, c.dataset.g, c.dataset.pa], ['게임원 통산', '김호인', '1', '3'], '제목 · 선수 · SprayLab 1경기 3타석');
    ok(!c.querySelector('details').open && !c.querySelector('.go-cr-del') && !c.querySelector('.pf-counts'), '접힘 · 지우기 없음 · 숫자 없음');
  });

  test('다른 선수 페이지를 붙이면 저장하지 않고 알려 준다 · 기록이 아닌 글도', function () {
    paste(SAMPLE.replace('김호인', '박다른'));
    press('.go-cr-save');
    ok(card().querySelector('.go-cr-msg').textContent.indexOf('「박다른」') >= 0, '안내 — ' + card().querySelector('.go-cr-msg').textContent);
    paste('안녕하세요');
    press('.go-cr-save');
    ok(card().querySelector('.go-cr-msg').textContent.indexOf('찾지 못했어요') >= 0, '기록 아님');
    // 한 경기 박스스코어 투수 표(2026-10-29 실제 붙여넣기)는 가져오기로 안내
    paste('적시타\n선수\t결과\t이닝\t타자\t타수\t피안타\t피홈런\t희타\t희비\t볼넷\t사구\t삼진\t폭투\t보크\t실점\t자책점\t투구수\t방어율\t시즌\n김영석(18)\t승\t2 ⅓\t17\t14\t8\t0\t0\t1\t2\t0\t2\t0\t0\t4\t2\t0\t6.01\t6.01');
    press('.go-cr-save');
    ok(card().querySelector('.go-cr-msg').textContent.indexOf('게임원 가져오기') >= 0, '박스스코어 표 → 가져오기 안내');
    eq(localStorage.getItem('sl_go_career'), null, '저장 안 함');
  });

  test('붙여넣고 저장 → 저장(sl_go_career.p.김호인) · 카드에 타자 16칸 · 투수 8칸 · 다른 선수 · 다시 열어도 그대로', function () {
    paste(SAMPLE);
    press('.go-cr-save');
    var s = stored()['김호인'];
    ok(s && s.bat.g === 68 && s.pit.outs === 67 && s.at > 0 && s.school === '대산고등학교', '저장 — ' + JSON.stringify(s).slice(0, 80));
    eq(card().querySelector('.go-cr-meta').textContent, '우투우타 · 비선출 · 대산고등학교', '머리');
    eq(cells(), ['경기 68', '타율 .615', '출루율 .665', '장타율 1.177', 'OPS 1.842', '타석 236', '안타 118', '홈런 25',
      '2루타 27', '3루타 3', '타점 125', '득점 111', '도루 30', '볼넷 28', '삼진 22', 'BB/K 1.27',
      '경기 11', '승-패-세 1-0-0', '이닝 22 1/3', '방어율 5.33', 'WHIP 1.93', '탈삼진 34', '볼넷 21', '피안타율 .247'], '칸');
    ok(card().querySelector('.an-note').textContent.indexOf('1경기 3타석') >= 0 && card().querySelector('.go-cr-del'), 'SprayLab 비교 안내 · 지우기');
    open('다른선수');
    ok(!card().querySelector('.pf-counts') && card().dataset.name === '다른선수', '다른 선수는 빈 카드');
    open('김호인');
    eq(cells().length, 24, '다시 열어도 그대로');
  });

  test('투수 칸만 다시 붙여넣으면(머리글 없이) 투수만 바꾸고 타자는 남긴다', function () {
    paste(PIT_ONLY.replace('경기수11', '경기수12'));
    press('.go-cr-save');
    var s = stored()['김호인'];
    eq([s.bat && s.bat.g, s.pit && s.pit.g, s.school], [68, 12, '대산고등학교'], '타자 68 그대로 · 투수 12');
    eq([cells().length, cells()[0], cells()[16]], [24, '경기 68', '경기 12'], '카드');
  });

  test('지우기 → 저장에서 빠지고 빈 카드', function () {
    press('.go-cr-del');
    ok(!('김호인' in stored()) && !card().querySelector('.pf-counts'), '지움');
  });

  // SprayLab 타석 기록이 없는 선수(2026-10-29 요청): 시즌 전체 › 「＋ 게임원 통산」 → 이름은 붙여넣은 글에서
  function tap(b) {
    b.scrollIntoView({ block: 'center' });
    var r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    ok(hit && b.contains(hit), b.className + ' 가 맨 위 — ' + (hit && (hit.id || hit.className)));
    hit.click();
  }
  function addBtn() { return Array.prototype.find.call(document.querySelectorAll('#batterView .bt-link-pill'), function (b) { return b.textContent.indexOf('게임원 통산') >= 0; }); }
  function chipOf(name) { return document.querySelectorAll('#batterView .an-chip[data-name="' + name + '"]'); }

  test('기록 없는 선수: 시즌 전체 › 「＋ 게임원 통산」 → 펼친 새 카드(44px 버튼)', function () {
    setBatterView('scope', 'season');
    var add = addBtn();
    ok(add && add.getBoundingClientRect().height >= 44, '＋ 버튼 44px 이상');
    tap(add);
    var c = card();
    eq([c.dataset.name, c.dataset.pa, c.querySelector('details').open, !!c.querySelector('.pf-counts')], ['', '0', true, false], '새 선수 칸 펼침');
    ok(!document.querySelector('#batterView .an-chip.on'), '고른 칩 없음');
  });

  test('이름 줄 없는 글은 저장 안 함 → 홍길동 페이지 저장 · 칩이 생기고 통산 카드만', function () {
    paste('우투우타\n타자기록\n경기수3\n타율0.500\n타석4');
    press('.go-cr-save');
    ok(card().querySelector('.go-cr-msg').textContent.indexOf('이름을 찾지 못했어요') >= 0, '이름 없음 안내');
    eq(Object.keys(stored()), [], '저장 안 함');
    paste(SAMPLE.replace('김호인', '홍길동'));
    press('.go-cr-save');
    ok(stored()['홍길동'] && stored()['홍길동'].bat.g === 68, '홍길동으로 저장');
    var c = card();
    eq([c.dataset.name, c.dataset.pa, cells().length], ['홍길동', '0', 24], '홍길동 카드');
    ok(c.querySelector('.an-note').textContent.indexOf('아직 이 선수 타석 기록이 없어요') >= 0, 'SprayLab 기록 없음 안내');
    eq(document.querySelectorAll('#batterView .bt-result > *').length, 1, 'SprayLab 카드 없이 통산 카드만');
    ok(chipOf('홍길동').length === 1 && chipOf('홍길동')[0].classList.contains('on'), '칩 생김 · 고름');
    var cr = chipOf('홍길동')[0].getBoundingClientRect(), pr = chipOf('홍길동')[0].parentElement.getBoundingClientRect();
    ok(cr.left >= pr.left - 1 && cr.right <= pr.right + 1, '새 칩이 칩 줄 안에 보임(옆으로 넘김)');
  });

  test('다른 선수 칩 → 다시 홍길동 칩 · 지우면 칩도 없어진다', function () {
    tap(chipOf('김호인')[0]);
    eq([card().dataset.name, card().dataset.pa], ['김호인', '3'], '김호인(SprayLab 3타석)');
    tap(chipOf('홍길동')[0]);
    eq([card().dataset.name, cells().length], ['홍길동', 24], '다시 홍길동');
    press('.go-cr-del');
    ok(!('홍길동' in stored()) && !chipOf('홍길동').length, '저장 · 칩 없어짐');
    ok(!card() || card().dataset.name !== '홍길동', '다른 선수 화면');
  });

  test('「＋」로 SprayLab에 있는 선수(김호인)를 붙이면 그 선수 시즌 화면 맨 아래에 · 칩은 하나', function () {
    tap(addBtn());
    paste(SAMPLE);
    press('.go-cr-save');
    eq([card().dataset.name, card().dataset.pa, cells().length], ['김호인', '3', 24], '김호인 시즌 화면 카드');
    ok(document.querySelector('#batterView .pf-report'), 'SprayLab 시즌 화면');
    eq(chipOf('김호인').length, 1, '칩 하나');
  });

  test('(정리) 이 파일이 만든 저장 경기 · 설정을 지운다', function () {
    localStorage.removeItem(KEY);
    localStorage.setItem('sl_saves', JSON.stringify(JSON.parse(localStorage.getItem('sl_saves') || '[]').filter(function (s) { return s.key !== KEY; })));
    localStorage.removeItem('sl_go_career');
    setBatterView('scope', 'game');
    ok(!localStorage.getItem(KEY), '지움');
  });
})();
