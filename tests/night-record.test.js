// 야간 화면(css/night.css · scorebook.js _night · 필드 머리 2D | 3D)
//  · 기록 · 분석 · 경기설정 모두 body.sb-night(밤 토큰) · 고대비를 켜면 밝은 종이
//  · 캔버스 색(sbPaint.tok)은 밤이면 --fld-*(바닥 = 카드색, 선 · 글자 = 분필색), 고대비를 바꾸면 캐시도 바로 바뀐다
//  · 3D 보기 = 2D 필드와 같은 타구 목록 + 탭(전체 · 안타 · 아웃 · 이번 타자) · 3D 땅을 누르면(fieldtap) 2D 와 같은 onFClick → 결과 팝업이 3D 칸에
//  · 하네스 크롬은 GPU 를 끈다 — 3D 는 그림이 아니라 넘긴 데이터만 본다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var ABS = [
    { bid: 'p1', bname: '가', team: 'home', inning: 1, res: '안타', x: 0.5, y: 0.3 },
    { bid: 'p2', bname: '나', team: 'home', inning: 1, res: '플라이 아웃', x: 0.3, y: 0.5 },
    { bid: 'p1', bname: '가', team: 'home', inning: 2, res: '홈런', x: 0.5, y: 0.02 },
    { bid: 'p3', bname: '다', team: 'home', inning: 2, res: '삼진' }
  ];
  function css(n) { return getComputedStyle(document.body).getPropertyValue(n).trim(); }
  function kinds(e) { return e._balls.map(function (b) { return b.k; }); }
  async function el3d() {
    for (var i = 0; i < 50; i++) { var e = document.querySelector('#sbField3d spray-field-3d'); if (e && e._balls) return e; await T.sleep(100); }
    return null;
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.sbFieldView && window.sbPaint && window.shellNav && $('sbFieldHd'), '기록 화면 · 필드 머리');
  });

  test('기록 탭: body.sb-night · 밤 토큰 · 캔버스는 분필색(--fld-*)', function () {
    ok(document.body.classList.contains('sb-night'), 'sb-night 없음');
    eq(css('--paper'), '#0B0D12', '바탕');
    var t = window.sbPaint.tok(true);
    eq([t.paper, t.ink, t.bg], ['#E9ECF1', '#FFFFFF', '#12151C'], '캔버스 색');
  });

  test('분석 · 경기설정도 밤 — 카드 · 머리 테두리는 흰 잉크가 아니라 옅은 선', async function () {
    shellNav('analysis', 'team');
    await T.sleep(50);
    ok(document.body.classList.contains('sb-night'), '분석 탭인데 종이');
    eq([css('--paper'), window.sbPaint.tok().paper], ['#0B0D12', '#E9ECF1'], '밤 색');
    var card = document.querySelector('#analysisView .an-card');
    ok(card, '분석 카드 없음');
    eq(getComputedStyle(card).borderTopColor, 'rgba(255, 255, 255, 0.12)', '카드 테두리');
    shellNav('settings');
    await T.sleep(50);
    ok(document.body.classList.contains('sb-night'), '경기설정인데 종이');
    eq(getComputedStyle(document.querySelector('#settingsView .sb-vhdr')).borderBottomColor, 'rgba(255, 255, 255, 0.12)', '경기설정 머리 선');
    shellNav('record');
  });

  test('고대비(야외)를 켜면 밤 토큰을 쓰지 않는다', function () {
    toggleHighContrast();
    eq(css('--paper'), '#FFFFFF', '고대비 종이');
    toggleHighContrast();
    eq(css('--paper'), '#0B0D12', '다시 밤');
  });

  test('필드 머리 2D | 3D → 3D 는 위치 있는 타구 · 탭(안타 · 아웃 · 이번 타자) · 전광판', async function () {
    window.AS.abs = ABS.slice();
    window.AS.batter = null;
    window.sbRenderNow();
    eq($('sbFieldHd').querySelector('h2').firstChild.nodeValue, '스프레이 차트', '제목');
    sbFieldView('3d');
    var e = await el3d();
    ok(e, '3D 요소 없음');
    ok($('sbField').classList.contains('is-3d'), 'is-3d');
    eq(getComputedStyle(document.querySelector('#sbField > .field-wrap')).display, 'none', '2D 필드 숨김');
    eq(kinds(e), ['hit', 'out', 'hr'], '전체(삼진은 위치 없음)');
    eq(e._board[1], '안타 2 · 타구 3', '전광판');
    sbField3dTab('hit'); await T.sleep(50);
    eq(kinds(e), ['hit', 'hr'], '안타');
    sbField3dTab('out'); await T.sleep(50);
    eq(kinds(e), ['out'], '아웃');
    sbField3dTab('batter'); await T.sleep(50);
    eq(kinds(e), [], '타자 미선택');
    window.AS.batter = { id: 'p1', name: '가' };
    window.sbRenderNow(); await T.sleep(50);
    eq([kinds(e), / · 가$/.test(e._board[0])], [['hit', 'hr'], true], '이번 타자 — ' + e._board[0]);
    eq([].map.call($('sbFieldHd').querySelectorAll('button'), function (b) { return b.textContent + ':' + b.getAttribute('aria-pressed'); }),
      ['전체:false', '안타:false', '아웃:false', '이번 타자:true', '2D:false', '3D:true'], '머리 버튼');
    sbField3dTab('all');
  });

  test('3D 땅을 누르면 2D 와 같은 기록 흐름 — 저장 좌표 · 결과 팝업이 3D 칸에서 누른 자리 옆 · 취소하면 표시도 지운다', async function () {
    var e = await el3d(), pop = $('tapPop');
    window.AS.batter = { id: 'p1', name: '가' };
    window.AS.pending = null;
    e.dispatchEvent(new CustomEvent('fieldtap', { detail: { x: 0.4, y: 0.5, px: 10, py: 200 } }));
    ok(window._tp && !pop.hidden, '결과 팝업이 안 열림');
    ok(Math.abs(window.AS.pending.x - 0.4) < 0.01 && Math.abs(window.AS.pending.y - 0.5) < 0.01, '저장 좌표 ' + JSON.stringify(window.AS.pending));
    eq(pop.parentNode, $('sbField3d'), '팝업 자리');
    eq(pop.style.left, '34px', '누른 자리 오른쪽(+24) ' + $('sbField3d').clientWidth);
    eq(e._pin, { x: 0.4, y: 0.5, px: 10, py: 200 }, '누른 자리 표시');
    window._tpCancel();
    await T.sleep(0);
    window.sbRenderNow(); await T.sleep(50);
    eq([!!window._tp, e._pin], [false, null], '취소');
    window.AS.pending = null;
  });

  test('3D 보기 중 위치를 찍어야 하면(field-tap-pending) 3D 그대로 점선 테두리, 2D 로 돌아가면 팝업도 2D 필드로', function () {
    var fw = document.querySelector('#sbField > .field-wrap');
    fw.classList.add('field-tap-pending');
    eq(getComputedStyle(fw).display, 'none', '2D 필드가 다시 보임');
    eq([getComputedStyle($('sbField3d')).display, getComputedStyle($('sbField3d')).outlineStyle], ['block', 'dashed'], '3D 상자');
    fw.classList.remove('field-tap-pending');
    sbFieldView('2d');
    eq($('tapPop').parentNode, $('cwrap'), '팝업이 2D 필드로');
    ok(!$('sbField').classList.contains('is-3d'), 'is-3d 남음');
    ok(getComputedStyle(fw).display !== 'none', '2D 필드');
    eq(getComputedStyle($('sbField3d')).display, 'none', '3D 상자 접힘');
    window.AS.abs = []; window.AS.batter = null;
    window.sbRenderNow();
  });
})();
