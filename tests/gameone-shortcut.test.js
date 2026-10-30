// 게임원 가져오기 바로가기(js/features/gameoneimport.js) — 데이터 관리 타일만으로는 처음 온 사람이 못 찾는다
//  · 링크 ?go=1 (랜딩 · 소개 글) → 입력창을 바로 열고 go 는 주소에서 지운다 · 공유 링크 등과 같이 오면 열지 않는다
//  · 기록이 하나도 없는 첫 화면 필드 아래 「게임원 기록 가져오기」(#goStart) — 저장 경기가 생기거나 기록 중이면 숨는다
//  · 링크 · 첫 화면 버튼으로 열면 '복사하는 방법'을 펼쳐 둔다(데이터 관리 타일로 열면 접힌 채 — gameone-import 테스트)
//  · 열기 이벤트(GA4) from = tile | link | empty
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var ROW = '1\t포\t가선수(7)\t3플\t \t좌안\t \t \t \t \t \t \t2\t1\t0\t0\t0\t.500\t.500';
  var HREF = location.pathname;
  function type(id, v) { var el = $(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
  function opened() { return $('goOverlay').classList.contains('show'); }
  async function spy(fn) {
    var ev = [], g0 = window.gtag;
    window.gtag = function (k, n, p) { if (k === 'event' && /^gameone_/.test(n)) ev.push([n, p]); };
    try { await fn(); } finally { window.gtag = g0; }
    return ev;
  }

  test('(준비) 앱 시작 처리가 끝날 때까지 기다린다', async function () {
    await T.sleep(2500);
    ok(window.SLGameOneImport && window.SLGameOneImport._openFromLink, '가져오기 모듈 로드');
    ok(!opened(), '?go=1 없이 열면 입력창은 닫혀 있다');
  });

  test('첫 화면: 저장 경기 · 기록 중 타석이 없으면 필드 아래 버튼 → 누르면 입력창(from empty) · 가져와 저장하면 숨는다', async function () {
    var b = $('goStart');
    ok(b && !b.hidden && b.textContent === '게임원 기록 가져오기', '버튼 보임');
    ok(b.previousElementSibling && b.previousElementSibling.matches('[data-sl-sample-start]'), '샘플 버튼 바로 아래');
    var ev = await spy(async function () {
      document.querySelector('#goOverlay details.go-how').open = false;
      b.click();
      ok(opened(), '입력창 열림');
      ok(document.querySelector('#goOverlay details.go-how').open, '처음 쓰는 사람 — 복사 방법 펼침');
      type('goTa', '가팀'); type('goTh', '나팀'); type('goDate', '2026-10-18'); type('goAway', ROW);
      await T.sleep(300);
      $('goSave').click();
    });
    closeOverlay('loadOverlay');
    eq(ev.map(function (e) { return e[0] + ':' + (e[1].from || e[1].paste); }), ['gameone_import_open:empty', 'gameone_import:tables'], '이벤트');
    ok(b.hidden, '저장 경기가 생기면 숨김');
  });

  test('저장 경기를 지우면 다시 보이고, 기록 중인 타석이 있으면 숨는다 (첫 사용 말풍선이 갱신될 때 같이)', function () {
    var b = $('goStart'), keep = localStorage.getItem('sl_saves'), abs = AS.abs;
    try {
      localStorage.setItem('sl_saves', '[]');
      updateFieldTapHint();
      ok(!b.hidden, '저장 경기 0 → 보임');
      AS.abs = [{ id: 1, bname: '타자', res: '안타' }];
      updateFieldTapHint();
      ok(b.hidden, '기록 중 타석 → 숨김');
    } finally { AS.abs = abs; localStorage.setItem('sl_saves', keep); updateFieldTapHint(); }
    ok(b.hidden, '되돌림');
  });

  test('링크 ?go=1 → 입력창(from link) · 주소에서 go 만 지운다(다른 값 · # 은 그대로) · 공유 링크 · 로그인 돌아오기와 같이 오면 열지 않는다', async function () {
    var ev;
    try {
      closeOverlay('goOverlay');
      history.replaceState(null, '', HREF + '?go=1&utm_source=ig#x');
      document.querySelector('#goOverlay details.go-how').open = false;
      ev = await spy(function () { ok(window.SLGameOneImport._openFromLink() === true, '열었다'); });
      ok(opened() && document.querySelector('#goOverlay details.go-how').open, '입력창 열림 · 복사 방법 펼침');
      eq([location.search, location.hash], ['?utm_source=ig', '#x'], '주소');
      eq(ev, [['gameone_import_open', { from: 'link' }]], '이벤트');
      closeOverlay('goOverlay');
      ok(window.SLGameOneImport._openFromLink() === false && !opened(), 'go 를 지웠으니 다시 부르면 열지 않는다');
      [['?go=1&game=abc', '', '?game=abc'], ['?go=1&code=xyz', '', '?code=xyz'], ['?go=1', '#share=abc', '']].forEach(function (c) {
        history.replaceState(null, '', HREF + c[0] + c[1]);
        ok(window.SLGameOneImport._openFromLink() === false && !opened(), c[0] + c[1] + ': 열지 않음');
        eq(location.search, c[2], c[0] + c[1] + ': go 는 지움');
      });
      history.replaceState(null, '', HREF + '?go=0');
      ok(window.SLGameOneImport._openFromLink() === false && location.search === '?go=0', 'go=1 이 아니면 아무것도 안 한다');
    } finally { history.replaceState(null, '', HREF); closeOverlay('goOverlay'); }
  });

  test('☰ 메뉴 경기 › 게임원 가져오기 (저장 경기가 있어 첫 화면 버튼이 숨어도) → 입력창(from menu · 복사 방법 접힘) · 데이터 관리 타일 이름', async function () {
    ok($('goStart').hidden, '첫 화면 버튼은 숨어 있다');
    shellMenu(true);
    var b = document.querySelector('#slMenu .slm-item[onclick^="openGameOneImport"]');
    ok(b && b.offsetParent !== null && b.getBoundingClientRect().height >= 44, '메뉴에 보임 · 44px — ' + (b && b.getBoundingClientRect().height));
    ok(b.previousElementSibling.getAttribute('onclick') === 'openLoad()' && /게임원 가져오기/.test(b.textContent) && /시즌/.test(b.textContent), '불러오기 바로 아래 — ' + b.textContent);
    document.querySelector('#goOverlay details.go-how').open = false;
    var ev = await spy(async function () { b.click(); await T.sleep(50); });
    ok(opened() && !document.querySelector('#goOverlay details.go-how').open, '입력창 열림 · 복사 방법 접힘');
    ok(!$('slMenu').classList.contains('open'), '메뉴 닫힘');
    eq(ev, [['gameone_import_open', { from: 'menu' }]], '이벤트');
    closeOverlay('goOverlay');
    var tile = document.querySelector('#dataSettingsOverlay .go-tile');
    ok(/게임원 가져오기/.test(tile.textContent) && /팀 주소/.test(tile.textContent), '타일 — ' + tile.textContent);
  });
})();
