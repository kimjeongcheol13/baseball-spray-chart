// 게임원 팀 기록(js/gameone.js parseGameOneTeam + js/features/gocareer.js)
//  · 팀 페이지 › 기록통계 › 타자랭킹 · 투수랭킹을 전체 선택 → 복사해 붙여넣으면 표에 있는 선수 전원을 저장(sl_go_career.p[이름].ss)
//  · 그 시즌 · 그 팀 경기만이라 통산(bat · pit)과 따로 두고 카드에도 따로 보여 준다 · 통산을 다시 붙여도 · QR 로 받아도 ss 는 남는다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  // 실제 복사 글(2026-10-29, 게임원 팀 페이지를 크롬에서 전체 선택 → 복사) — 선수 이름만 바꿨다(김호인은 기존 통산 테스트와 같은 선수)
  var MENU = ['닫기', 'GAMEONE', '로그인회원가입', '더보기', '', '팀소개', '선수단', '일정·결과', '기록통계', '팀기네스', '', '랭킹'];
  var TABS = ['', '타자랭킹', '투수랭킹', '선수상세기록', '타구방향분석', '', '전체', '리그', '토너먼트', '원외', '전체 : 18게임 승률 : 76% ( 13승4패1무 )', '', '?', '규정타석 0 규정이닝 0'];
  function bh(g) { return '순위\n이름\n타율\t' + g + '\t타석\t타수\t득점\t총안타\t1루타\t2루타\t3루타\t홈런\t루타\t타점\t도루\t도실\n(도루자)\t희타\t희비\t볼넷\t고의\n4구\t사구\t삼진\t병살\t장타율\t출루율\t도루\n성공률\t멀티\n히트\tOPS\tBB/K\t장타/안타'; }
  function ph(g) { return '순위\n이름\n방어율\t' + g + '\t승\t패\t세\t홀드\t승률\t타자\t타수\t투구수\t이닝\t피안타\t피홈런\t희타\t희비\t볼넷\t고의\n4구\t사구\t탈삼진\t폭투\t보크\t실점\t자책점\tWHIP\t피안타율\t탈삼진율'; }
  var BAT_ROWS = [
    '1\t홍길동(20)\t1.000\t4\t1\t1\t2\t1\t1\t0\t0\t0\t1\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t1.000\t1.000\t0.000\t0\t2.000\t0.00\t0.000',
    '2\t이몽룡(27)\t0.667\t11\t38\t24\t17\t16\t13\t1\t1\t1\t22\t14\t5\t0\t0\t2\t10\t0\t2\t0\t0\t0.917\t0.737\t1.000\t5\t1.654\t0.00\t0.188',
    '4\t김호인(97)\t0.605\t14\t53\t43\t24\t26\t12\t5\t0\t9\t58\t35\t5\t1\t0\t1\t7\t1\t2\t4\t0\t1.349\t0.660\t0.833\t9\t2.009\t1.75\t0.538',
    '5\t임꺽정(14)\t0.500\t5\t12\t10\t4\t5\t5\t0\t0\t0\t5\t3\t2\t0\t0\t0\t1\t0\t1\t2\t0\t0.500\t0.583\t1.000\t1\t1.083\t0.50\t0.000',
    '9\t전우치(6)\t0.317\t14\t53\t41\t17\t13\t10\t3\t0\t0\t16\t8\t9\t0\t0\t0\t10\t0\t2\t8\t0\t0.390\t0.472\t1.000\t3\t0.862\t1.25\t0.231',
    '11\t장보고(12)\t0.280\t9\t31\t25\t8\t7\t5\t2\t0\t0\t9\t7\t1\t1\t0\t0\t6\t0\t0\t5\t0\t0.360\t0.419\t0.500\t1\t0.779\t1.20\t0.286',
    '18\t심청(10)\t0.000\t1\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0\t0.000\t0.000\t0.000\t0\t0.000\t0.00\t0'
  ].join('\n');
  var PIT_ROWS = [
    '1\t성춘향(99)\t0.00\t1\t0\t0\t0\t0\t0.00\t4\t3\t0\t1.0\t1\t0\t0\t0\t1\t0\t0\t0\t0\t0\t0\t0\t2.00\t0.333\t0.00',
    '2\t임꺽정(14)\t2.67\t14\t9\t0\t0\t0\t1.000\t255\t213\t0\t55.0\t48\t0\t0\t2\t32\t1\t8\t71\t5\t0\t35\t21\t1.45\t0.225\t9.04',
    '3\t장보고(12)\t3.82\t8\t2\t0\t1\t0\t1.000\t90\t78\t0\t18.1\t22\t0\t0\t1\t8\t0\t3\t15\t1\t0\t13\t10\t1.64\t0.282\t5.73',
    '4\t허균(18)\t12.32\t7\t1\t3\t0\t0\t0.250\t56\t44\t0\t9.2\t15\t0\t0\t0\t9\t0\t3\t11\t3\t0\t19\t17\t2.48\t0.341\t7.97'
  ].join('\n');
  // 화면 고정 칸 때문에 같은 표가 두 번 · 규정 미달 표는 머리만(이 팀은 규정 0)
  var HIT = MENU.concat(['타자랭킹Batting Player Ranking'], TABS, ['도루 1위', '', '6.전우치', '좌익수 | 우투우타', '1 ', '타율 1위', '', '20.홍길동', '二루수 | 우투우타', '1 ', '', '타자랭킹',
    bh('게임수'), BAT_ROWS, bh('게임수'), BAT_ROWS, '타자랭킹 (규정타석 미달)', bh('경기'), bh('경기'), '등록된 정보가 없습니다', '', '', 'TOP', '']).join('\n');
  var PIT = MENU.concat(['투수랭킹Pitching Player Ranking'], TABS, ['다승 1위', '', '14.임꺽정', '등록전 | 우투우타', '0 ', '', '투수랭킹',
    ph('게임수'), PIT_ROWS, ph('게임수'), PIT_ROWS, '투수랭킹 (규정이닝 미달)', ph('경기수'), ph('경기수'), '', '', 'TOP', '']).join('\n');
  // 선수 페이지(통산) — gameone-career.test.js 와 같은 실제 붙여넣기의 앞부분
  var CAREER = ['김호인', '우투우타', '비선출', '대산고등학교', '타자기록', '경기수68', '타율0.615', '타석236', '타수192', '총안타118', '홈런25', '볼넷28', '삼진22', 'OPS1.842'].join('\n');
  var KEY = 'sl_1790000960001';
  var NAMES = ['홍길동', '이몽룡', '김호인', '임꺽정', '전우치', '장보고', '심청', '성춘향', '허균'];
  function P(t) { return window.SLGameOne.parseGameOneTeam(t); }
  function card() { return document.getElementById('goCareer'); }
  function stored() { return (JSON.parse(localStorage.getItem('sl_go_career') || '{}').p) || {}; }
  function cells(root) {
    return Array.prototype.map.call((root || card()).querySelectorAll('.pf-counts div'), function (d) { return d.querySelector('dt').textContent + ' ' + d.querySelector('dd').textContent; });
  }
  function tap(b) {
    b.scrollIntoView({ block: 'center' });
    var r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    ok(hit && b.contains(hit), b.className + ' 가 맨 위 — ' + (hit && (hit.id || hit.className)));
    hit.click();
  }
  function press(sel) { var c = card(); c.querySelector('details').open = true; tap(c.querySelector(sel)); }
  function paste(text) { var c = card(); c.querySelector('details').open = true; c.querySelector('textarea').value = text; }
  function open(name) { setBatterView('scope', 'season'); setBatterView('sel', name); }
  function addBtn() { return Array.prototype.find.call(document.querySelectorAll('#batterView .bt-link-pill'), function (b) { return b.textContent.indexOf('팀 기록') >= 0; }); }
  function chipOf(name) { return document.querySelectorAll('#batterView .an-chip[data-name="' + name + '"]'); }
  function toastTxt() { return document.getElementById('toastTxt').textContent; }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.SLGameOne && typeof window.SLGameOne.parseGameOneTeam === 'function' && window.goCareerSave, '파서 · 카드 로드');
  });

  test('파서: 타자랭킹 — 두 번 복사된 표는 한 번 · 1위 상자 줄 · 끊긴 머리 줄은 건너뜀 · 칸 이름은 통산과 같다', function () {
    var r = P(HIT);
    eq([r.bat.map(function (b) { return b.name; }), r.pit, r.warnings], [NAMES.slice(0, 7), [], []], '타자 7명 · 투수 없음 · 경고 없음');
    var b = r.bat[2];
    eq([b.number, b.g, b.avg, b.pa, b.ab, b.h, b.s1, b.s2, b.s3, b.hr, b.tb, b.rbi, b.sb, b.cs, b.bb, b.ibb, b.hbp, b.k, b.gdp, b.slg, b.obp, b.ops, b.bbk, b.xbhH],
      ['97', 14, 0.605, 53, 43, 26, 12, 5, 0, 9, 58, 35, 5, 1, 7, 1, 2, 4, 0, 1.349, 0.66, 2.009, 1.75, 0.538], '김호인 칸');
    // 선수 페이지 타자기록 28개 이름을 다 넣은 통산 파싱과 칸 이름이 같아야 카드가 같은 함수로 그린다
    var labels = ['경기수', '타율', '타석', '타수', '득점', '총안타', '1루타', '2루타', '3루타', '홈런', '루타', '타점', '도루', '도루자', '희타', '희비', '볼넷', '고의4구', '사구', '삼진', '병살', '장타율', '출루율', '도루성공률', '멀티히트', 'OPS', 'BB/K', '장타/안타'];
    var cb = window.SLGameOne.parseGameOneCareer('타자기록\n' + labels.map(function (l) { return l + '1'; }).join('\n')).bat;
    eq(Object.keys(b).filter(function (k) { return k !== 'name' && k !== 'number'; }).sort(), Object.keys(cb).sort(), '통산 파서와 같은 칸 이름(28개)');
    eq(r.bat[6].xbhH, 0, "타석 0 선수는 마지막 칸이 '0'");
  });

  test("파서: 투수랭킹 — 이닝 '18.1' = 18⅓ · 방어율(7이닝) 다시 계산하면 같다 · 둘을 이어 붙여도", function () {
    var r = P(PIT);
    eq(r.pit.map(function (p) { return [p.name, p.outs]; }), [['성춘향', 3], ['임꺽정', 165], ['장보고', 55], ['허균', 29]], '이닝 → 아웃');
    // 게임원 반올림은 조금 다르다(허균 17자책 9⅔이닝: 12.31 → 게임원 12.32) — 0.01 까지
    r.pit.forEach(function (p) { var e = p.er * 7 / (p.outs / 3); ok(Math.abs(e - p.era) <= 0.0101, p.name + ' 방어율 ' + e.toFixed(3) + ' ≈ ' + p.era); });
    var s = r.pit[1];
    eq([s.g, s.w, s.l, s.sv, s.hld, s.wpct, s.tbf, s.ab, s.np, s.h, s.hr, s.bb, s.hbp, s.k, s.wp, s.r, s.er, s.whip, s.avg, s.k7],
      [14, 9, 0, 0, 0, 1, 255, 213, 0, 48, 0, 32, 8, 71, 5, 35, 21, 1.45, 0.225, 9.04], '임꺽정 칸');
    var labels = ['경기수', '방어율', '승', '패', '세', '홀드', '승률', '타자', '타수', '투구수', '이닝', '피안타', '피홈런', '희타', '희비', '볼넷', '고의4구', '사구', '탈삼진', '폭투', '보크', '실점', '자책점', 'WHIP', '피안타율', '탈삼진율'];
    var cp = window.SLGameOne.parseGameOneCareer('투수기록\n' + labels.map(function (l) { return l + '1'; }).join('\n')).pit;
    eq(Object.keys(s).filter(function (k) { return k !== 'name' && k !== 'number'; }).sort(), Object.keys(cp).sort(), '통산 파서와 같은 칸 이름(26개)');
    var both = P(HIT + '\n' + PIT);
    eq([both.bat.length, both.pit.length], [7, 4], '한 칸에 이어 붙여도');
  });

  test('파서: 선수 페이지 · 박스스코어 표는 0명 · 공백 구분도 · 같은 이름 둘은 빼고 · 숫자 아닌 칸은 경고', function () {
    eq([P(CAREER).bat.length, P('').bat.length, P(null).pit.length], [0, 0, 0], '선수 페이지 · 빈 입력');
    eq(P('선수\t결과\t이닝\t타자\n김영석(18)\t승\t2 ⅓\t17\t14\t8\t0\t0\t1\t2\t0\t2\t0\t0\t4\t2\t0\t6.01\t6.01').pit.length, 0, '박스스코어 투수 표');
    eq(P(BAT_ROWS.replace(/\t/g, ' ')).bat.length, 7, '탭 대신 공백');
    var dup = P(BAT_ROWS + '\n3\t홍길동(55)' + BAT_ROWS.split('\n')[1].slice(BAT_ROWS.split('\n')[1].indexOf(')') + 1));
    ok(dup.bat.length === 6 && !dup.bat.some(function (b) { return b.name === '홍길동'; }) && dup.warnings.length === 2, '홍길동(20) · 홍길동(55) 둘 다 뺌 — ' + dup.warnings.join(' / '));
    var bad = P(PIT_ROWS.replace('18.1', '18.x'));
    ok(bad.pit.length === 3 && /장보고/.test(bad.warnings[0]), '이닝을 못 읽으면 그 줄만 경고');
  });

  test('카드: 시즌 전체 › 「＋ 게임원 통산 · 팀 기록」 → 타자 · 투수 표를 이어 붙여 저장 → 9명 전원 ss · 칩 · 알림', async function () {
    localStorage.removeItem('sl_go_career');
    var abs = ['안타', '삼진', '홈런'].map(function (res, i) { return { id: i + 1, bid: 77, bname: '김호인', bnum: '97', res: res, inn: (i + 1) + '회' }; });
    localStorage.setItem(KEY, JSON.stringify({ key: KEY, ta: '원정', th: '우리팀', hs: 0, as: 0, abs: abs, home_lineup: [], away_lineup: [], zoneHistory: {}, d: '2026. 10. 29.', ts: 1790000960001 }));
    var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]'); saves.push({ key: KEY, label: '원정 vs 우리팀', ts: 1790000960001 });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
    shellOpenAnalysis('batter');
    await T.sleep(50);
    setBatterView('scope', 'season');
    var add = addBtn();
    ok(add && add.getBoundingClientRect().height >= 44, '＋ 버튼(팀 기록) 44px 이상');
    tap(add);
    ok(card().querySelector('.go-cr-how b') && /타자랭킹/.test(card().querySelector('details').textContent), '팀 페이지 안내');
    paste(HIT + '\n' + PIT);
    press('.go-cr-save');
    var s = stored();
    eq(Object.keys(s).sort(), NAMES.slice().sort(), '9명 저장');
    eq([s['김호인'].ss.bat.g, s['김호인'].ss.pit, s['임꺽정'].ss.bat.g, s['임꺽정'].ss.pit.outs, s['허균'].ss.bat, s['허균'].ss.pit.era], [14, undefined, 5, 165, undefined, 12.32], '타자 · 투수 쪽');
    ok(NAMES.every(function (n) { return !s[n].bat && !s[n].pit && s[n].ss.at > 0; }), '통산(bat · pit)은 비워 둠');
    ok(toastTxt().indexOf('타자 7명 · 투수 4명') >= 0, '알림 — ' + toastTxt());
    eq(card().dataset.name, '홍길동', '표 첫 선수를 연다');
    ok(NAMES.every(function (n) { return chipOf(n).length === 1; }), '칩 9개(김호인은 SprayLab 칩 하나)');
  });

  test('카드: 통산 없는 선수 = 「게임원 팀 시즌 기록」만 · 투수도 하는 선수는 타자 16칸 + 투수 8칸 · 지우기', function () {
    open('임꺽정');
    var c = card(), ss = c.querySelector('.go-cr-ss');
    eq(c.querySelector('h3').textContent, '게임원 통산', '카드 제목은 그대로');
    ok(ss && /^게임원 팀 시즌 기록 · \d+월 \d+일 붙여넣음$/.test(ss.querySelector('.go-cr-sub').textContent), '따로 묶은 제목 — ' + (ss && ss.querySelector('.go-cr-sub').textContent));
    eq(cells(ss), ['경기 5', '타율 .500', '출루율 .583', '장타율 .500', 'OPS 1.083', '타석 12', '안타 5', '홈런 0', '2루타 0', '3루타 0', '타점 3', '득점 4', '도루 2', '볼넷 1', '삼진 2', 'BB/K 0.50',
      '경기 14', '승-패-세 9-0-0', '이닝 55', '방어율 2.67', 'WHIP 1.45', '탈삼진 71', '볼넷 32', '피안타율 .225'], '칸');
    eq(cells().length, 24, '통산 숫자는 없음');
    ok(/그 팀 경기만/.test(ss.querySelector('.an-note').textContent), '통산이 아니라는 안내');
    open('장보고');
    ok(cells().indexOf('이닝 18 1/3') >= 0, '18.1 → 18 1/3');
    press('.go-cr-del');
    ok(!('장보고' in stored()) && !chipOf('장보고').length, '지우면 저장 · 칩에서 빠짐');
  });

  test('SprayLab 선수(김호인): 시즌 화면 맨 아래 카드에 팀 시즌 · 통산을 붙여도 ss 는 남고 둘 다 보인다', function () {
    open('김호인');
    var c = card();
    eq([c.dataset.name, c.dataset.pa, cells(c.querySelector('.go-cr-ss'))[1]], ['김호인', '3', '타율 .605'], 'SprayLab 3타석 · 팀 시즌 타율');
    ok(document.querySelector('#batterView .pf-report'), 'SprayLab 시즌 화면');
    paste(CAREER);
    press('.go-cr-save');
    var s = stored()['김호인'];
    eq([s.bat.g, s.ss.bat.g], [68, 14], '통산 68 · 팀 시즌 14 그대로');
    var all = cells(), ss = cells(card().querySelector('.go-cr-ss'));
    eq([all[0], all.length - ss.length, ss[0]], ['경기 68', 16, '경기 14'], '통산 16칸 위 · 팀 시즌 아래');
  });

  test('투수 표만 다시 붙이면 투수 쪽만 바뀌고 타자 쪽은 남는다 · QR 로 받은 통산도 ss 를 지우지 않는다', function () {
    open('김호인');
    paste(PIT.replace('2\t임꺽정(14)\t2.67\t14', '2\t임꺽정(14)\t2.67\t15'));
    press('.go-cr-save');
    var s = stored()['임꺽정'];
    eq([s.ss.bat.g, s.ss.pit.g], [5, 15], '타자 5 그대로 · 투수 15');
    var enc = 'b' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify({ k: '김호인', name: '김호인', bat: { g: 70 } })))));
    var q = location.search;
    history.replaceState(null, '', location.pathname + q + (q ? '&' : '?') + 'goc=' + enc + location.hash);
    goCareerFromLink();
    var h = stored()['김호인'];
    eq([h.bat.g, h.ss.bat.g], [70, 14], 'QR 통산 70 · 팀 시즌 14 그대로');
  });

  // ── 게임원 팀 연결(매일 자동) — 서버 쪽 추출(.github/scripts/gameone_extract.mjs) → JSON → 앱이 받아 넣기 ──
  // 실제 게임원 HTML 모양(2026-10-29 확인)을 줄인 것: 주석 처리된 칸 · 화면 고정 칸 때문에 두 번 그린 표 · 선수단 group_code · 통산 머리 · 숨은 투수 칸
  function rowsHtml(rows) {
    return '<table><thead><tr><th>순위</th><th>이름</th></tr></thead><tbody>' + rows.split('\n').map(function (l) {
      return '<tr>' + l.split('\t').map(function (v, i) {
        return '<td>' + (i === 1 ? '<a href="#">' + v + '</a>' : v) + '</td>' + (i === 5 ? '<!--<td>1.000</td>-->' : '') + (i === 8 ? '<!-- <td>--><!--</td>-->' : '');
      }).join('\n') + '</tr>';
    }).join('\n') + '</tbody></table>';
  }
  function rankHtml(rows) { return '<html><head><title>테스트팀</title></head><body><select><option value="2025">2025</option><option value="2026" selected>2026</option></select>' + rowsHtml(rows) + rowsHtml(rows) + '</body></html>'; }
  var LIST_HTML = [['김호인', '97', 'KHI0000000001'], ['임꺽정', '14', 'LKJ0000000001'], ['심청', '10', 'SC00000000001'], ['홍길동', '20', 'HGD0000000001'], ['홍길동', '55', 'HGD0000000002']]
    .map(function (p) { return '<li><img src="/x.png" group_code="' + p[2] + '"><div><span class="rank">내야수</span> ' + p[0] + '(' + p[1] + ')</div></li>'; }).join('\n');
  function careerHtml(name, bat, pit) {
    function pairs(o) { return Object.keys(o).map(function (k) { return '<li><span class="title">' + k + '</span> <span class="score">' + o[k] + '</span></li>'; }).join(''); }
    return '<div style="font-size:18px;font-weight:700">' + name + '</div><div>우투우타</div><div>비선출</div><div>대산고등학교</div><div class="player_info_detail"></div>' +
      '<div class="hitter_section"><ul>' + pairs(bat) + '</ul></div><div class="pitcher_section" style="display:none"><ul>' + pairs(pit) + '<!--<li><span class="title">경기수</span><span class="score">999</span></li>--></ul></div>';
  }
  var PAGES = { hit: rankHtml(BAT_ROWS), pit: rankHtml(PIT_ROWS), list: LIST_HTML, careers: {
    KHI0000000001: careerHtml('김호인', { '경기수': 66, '타율': '0.615', '타석': 236, '홈런': 25, 'OPS': '1.842' }, { '경기수': 20, '이닝': '22 ⅓', '방어율': '5.33', '자책점': 17 }),
    LKJ0000000001: careerHtml('임꺽정', { '경기수': 30, '타율': '0.400' }, { '경기수': 0, '이닝': '0', '방어율': '0.00' }),
    SC00000000001: careerHtml('심청', { '경기수': 0 }, { '경기수': 0 }),
    HGD0000000001: careerHtml('홍길동', { '경기수': 5 }, {}), HGD0000000002: careerHtml('홍길동', { '경기수': 9 }, {}) } };
  var DATA, realFetch = window.fetch, calls = [], reply;
  function fakeFetch(u) { calls.push(String(u)); return reply(); }
  function json(o, st) { return function () { return Promise.resolve(new Response(JSON.stringify(o), { status: st || 200 })); }; }

  test('서버 추출: 주석 칸 지움 · 두 번 그린 표는 한 번 · 선수단 · 통산(숨은 투수 칸) → 앱이 넣을 JSON', async function () {
    var X = await import('/.github/scripts/gameone_extract.mjs');
    var t = P(X.rankRows(PAGES.hit) + '\n' + X.rankRows(PAGES.pit));
    eq([t.bat.length, t.pit.length, t.warnings], [7, 4, []], '타자 7 · 투수 4 · 경고 없음(주석 칸이 남으면 31칸이라 경고)');
    eq([X.season(PAGES.hit), X.title(PAGES.hit)], [2026, '테스트팀'], '시즌 · 팀 이름');
    eq(X.roster(LIST_HTML).map(function (p) { return p.name + p.number + ':' + p.code; }), ['김호인97:KHI0000000001', '임꺽정14:LKJ0000000001', '심청10:SC00000000001', '홍길동20:HGD0000000001', '홍길동55:HGD0000000002'], '선수단');
    DATA = X.teamData(window.SLGameOne, PAGES, 1790000000000);
    eq(Object.keys(DATA.players).sort(), ['김호인', '임꺽정'], '0경기(심청) · 같은 이름 둘(홍길동)은 통산에서 뺀다');
    eq([DATA.players['임꺽정'].bat.g, DATA.players['임꺽정'].pit], [30, null], '투수 0경기 칸은 뺀다(카드에 투수 0 이 안 뜨게)');
    var k = DATA.players['김호인'];
    eq([k.hand, k.school, k.bat.g, k.bat.ops, k.pit.g, k.pit.outs, k.pit.era], ['우투우타', '대산고등학교', 66, 1.842, 20, 67, 5.33], '김호인 통산 — 투수 999(주석)는 안 읽음');
    eq([DATA.v, DATA.at, DATA.team, DATA.season, DATA.bat.length, DATA.pit.length], [1, 1790000000000, '테스트팀', 2026, 7, 4], '머리');
  });

  test('팀 연결: ＋ 카드에 주소 → 「연결」 → 통산 · 팀 시즌 전원 저장(불러옴) · 칩 · 알림', async function () {
    localStorage.removeItem('sl_go_career');
    localStorage.removeItem('sl_go_team');
    window.fetch = fakeFetch;
    reply = json(DATA);
    setBatterView('scope', 'season');
    tap(addBtn());
    var c = card();
    ok(c.querySelector('.go-cr-sync') && /매일 저절로/.test(c.querySelector('.go-cr-sync').textContent), '연결 칸 · 안내');
    c.querySelector('.go-cr-club').value = 'https://www.gameone.kr/club/info/ranking/hitter?club_idx=14797&season=2026';
    tap(c.querySelector('.go-cr-conn'));
    await T.sleep(150);
    ok(/\/gameone-data\/14797\.json\?t=\d+$/.test(calls[0]), '받는 주소 — ' + calls[0]);
    var s = stored();
    eq([s['김호인'].bat.g, s['김호인'].auto, s['김호인'].ss.bat.g, s['김호인'].ss.team, s['김호인'].ss.season, s['홍길동'].bat, s['홍길동'].ss.bat.g, s['허균'].ss.pit.era],
      [66, 1, 14, '테스트팀', 2026, undefined, 4, 12.32], '통산 · 팀 시즌');
    ok(!('number' in s['김호인'].ss.bat) && !('name' in s['김호인'].ss.bat), '숫자 칸만 남김');
    eq(JSON.parse(localStorage.getItem('sl_go_team')), { club: '14797', team: '테스트팀', at: 1790000000000 }, 'sl_go_team');
    ok(toastTxt().indexOf('테스트팀 — 통산 2명 · 시즌 타자 7명 · 투수 4명') >= 0, '알림 — ' + toastTxt());
    ok(NAMES.every(function (n) { return chipOf(n).length === 1; }), '칩 9개');
    open('김호인');
    c = card();
    ok(/불러옴$/.test(c.querySelector('.an-hd-note').textContent), '통산 머리 — ' + c.querySelector('.an-hd-note').textContent);
    ok(/^게임원 팀 시즌 기록 · 테스트팀 2026시즌 · \d+월 \d+일 불러옴$/.test(c.querySelector('.go-cr-ss .go-cr-sub').textContent), '팀 시즌 머리 — ' + c.querySelector('.go-cr-ss .go-cr-sub').textContent);
  });

  test('앱을 열 때 받기: 같은 데이터면 그대로 · 나중에 붙여넣은 기록은 남기고 · 더 새 데이터면 바꾼다', async function () {
    eq(await goTeamPull(false), { same: 1 }, '같은 날 데이터');
    open('김호인');
    paste(CAREER);
    press('.go-cr-save');
    var older = JSON.parse(JSON.stringify(DATA));
    older.at = Date.now() - 1000;
    older.players['임꺽정'].bat.g = 31;
    reply = json(older);
    var r = await goTeamPull(false);
    var s = stored();
    eq([r.car, s['김호인'].bat.g, s['김호인'].auto, s['임꺽정'].bat.g], [2, 68, undefined, 31], '김호인은 붙여넣은 68 · 임꺽정은 새 31');
    var newer = JSON.parse(JSON.stringify(DATA));
    newer.at = Date.now() + 60000;
    reply = json(newer);
    await goTeamPull(false);
    eq([stored()['김호인'].bat.g, stored()['김호인'].auto], [66, 1], '더 새 데이터는 붙여넣은 것도 바꾼다');
  });

  test('팀 연결: 아직 받는 팀이 아니면(404) 번호만 연결해 둔다 · 인터넷 오류 · 주소 아님', async function () {
    localStorage.removeItem('sl_go_team');
    setBatterView('sel', '');
    tap(addBtn());
    var c = card(), msg = function () { return card().querySelector('.go-cr-sync-msg').textContent; };
    c.querySelector('.go-cr-club').value = 'https://www.gameone.kr/club/?club_idx=';
    tap(c.querySelector('.go-cr-conn'));
    ok(/club_idx=숫자/.test(msg()) && !localStorage.getItem('sl_go_team'), '주소 아님 — ' + msg());
    reply = json({}, 404);
    c.querySelector('.go-cr-club').value = '12345';
    tap(c.querySelector('.go-cr-conn'));
    await T.sleep(150);
    ok(/팀 번호 12345 연결해 두었어요/.test(msg()), '404 — ' + msg());
    eq(JSON.parse(localStorage.getItem('sl_go_team')), { club: '12345' }, '번호만 저장(다음에 열 때 다시 받아 본다)');
    reply = function () { return Promise.reject(new TypeError('Failed to fetch')); };
    tap(card().querySelector('.go-cr-conn'));
    await T.sleep(150);
    ok(/인터넷 연결/.test(msg()), '오류 — ' + msg());
    setBatterView('sel', '');
    tap(addBtn());
    ok(/팀 번호 12345 연결됨 · 아직 받은 기록이 없어요/.test(card().querySelector('.go-cr-sync').textContent), '연결 칸 안내');
  });

  test('팀 연결 링크(?goteam=): 열면 연결 · 받기 · 타자 › 시즌 전체 첫 선수 · 주소에서 지움 · 잘못된 번호 · 404', async function () {
    localStorage.removeItem('sl_go_career');
    localStorage.removeItem('sl_go_team');
    calls.length = 0;
    reply = json(DATA);
    var q = location.search;
    function go(v) { history.replaceState(null, '', location.pathname + q + (q ? '&' : '?') + 'goteam=' + v + location.hash); }
    var msg = function () { return card().querySelector('.go-cr-sync-msg').textContent; };
    go('14797');
    eq(await goTeamFromLink(), true, '링크로 열림');
    ok(location.search.indexOf('goteam') < 0, '주소에서 지움(새로고침해도 다시 안 받음)');
    ok(/\/gameone-data\/14797\.json\?t=\d+$/.test(calls[0]), '받는 주소 — ' + calls[0]);
    eq([JSON.parse(localStorage.getItem('sl_go_team')).club, Object.keys(stored()).length, stored()['김호인'].bat.g], ['14797', 9, 66], '연결 · 9명 · 통산');
    ok(toastTxt().indexOf('테스트팀 — 통산 2명') >= 0, '알림 — ' + toastTxt());
    ok(document.getElementById('batterView').offsetParent !== null && card().dataset.name === '홍길동', '타자 › 시즌 전체 · 표 첫 선수 카드');
    go('abc');
    await goTeamFromLink();
    ok(/팀 번호가 잘못됐어요/.test(msg()) && JSON.parse(localStorage.getItem('sl_go_team')).club === '14797', '잘못된 번호 — 「＋」 카드에 안내 · 연결은 그대로 — ' + msg());
    reply = json({}, 404);
    go('12345');
    await goTeamFromLink();
    ok(/팀 번호 12345 연결해 두었어요/.test(msg()), '404 — ' + msg());
    eq(await goTeamFromLink(), false, '링크 없으면 아무것도 안 함');
  });

  test('(정리) 이 파일이 만든 저장 경기 · 설정을 지운다', function () {
    window.fetch = realFetch;
    localStorage.removeItem('sl_go_team');
    localStorage.removeItem(KEY);
    localStorage.setItem('sl_saves', JSON.stringify(JSON.parse(localStorage.getItem('sl_saves') || '[]').filter(function (s) { return s.key !== KEY; })));
    localStorage.removeItem('sl_go_career');
    if (window.hideToast) hideToast();
    setBatterView('scope', 'game');
    ok(!localStorage.getItem(KEY), '지움');
  });
})();
