// 키보드 Tab 도돌이표(js/features/tabloop.js)
//  · 기록 화면: 「타구 입력으로 건너뛰기」 → … → 타석 기록 카드 → 하단 탭 → 다시 「타구 입력으로 건너뛰기」. Shift+Tab 은 거꾸로
//  · 닫힌 창(투명) · 화면 밖에 밀어 둔 시트 안의 버튼은 들르지 않는다. 열린 창의 버튼은 들른다
//  배경: 「타석 기록」 다음 Tab 이 닫힌 창의 보이지 않는 버튼 수십 개로 들어가 포커스가 사라진 것처럼 보였고, 끝까지 가면 주소창으로 빠져
//  새로고침해야 다시 Tab 을 쓸 수 있었다
// 합성 keydown 은 브라우저 기본 이동을 하지 않는다 → 포커스가 움직였다면 tabloop.js 가 옮긴 것이다
// @window 1280,800
// @pointer fine
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  // 닫혀 있을 때 Tab 이 들르면 안 되는 창 · 시트
  var HIDDEN = ['hitOverlay', 'editRecOverlay', 'loadOverlay', 'dataSettingsOverlay', 'goOverlay', 'cloudOverlay', 'loginModal', 'profileModal',
    'toast', 'cardCtxSheet', 'sfPanel', 'saveMethodSheet', 'helpModeTooltip', 'scoutIntroSheet'];

  function name(el) { return el === document.body ? 'body' : el.tagName + (el.id ? '#' + el.id : '') + ' [' + (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20) + ']'; }
  function key(back) {
    var a = document.activeElement || document.body;
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: !!back, bubbles: true, cancelable: true }));
    return document.activeElement;
  }
  function fromStart() { var b = document.body; b.setAttribute('tabindex', '-1'); b.focus(); b.removeAttribute('tabindex'); }
  // 맨 앞에서 Tab 을 눌러 다시 맨 앞으로 돌아올 때까지 들른 칸
  function cycle(back) {
    fromStart();
    var first = key(back), seen = [first];
    for (var i = 0; i < 300; i++) { var a = key(back); if (a === first) return seen; seen.push(a); }
    throw new Error('300번 눌러도 처음 칸으로 돌아오지 않음 — 마지막 ' + name(document.activeElement));
  }
  async function recordScreen() {
    if ($('landing-page').style.display !== 'none') showApp();
    shellNav('record');
    for (var w = 0; w < 200 && !document.querySelector('.sb-pa'); w++) await sleep(10);
    ok(document.querySelector('.sb-pa'), '전제: 타석 기록 카드(.sb-pa)가 있어야 함');
    await sleep(100);
  }
  function lastIn(sel) { var l = document.querySelectorAll(sel + ' button:not(:disabled)'); return l[l.length - 1]; }

  test('Tab 도돌이표: 기록 화면 — 건너뛰기 링크에서 시작해 타석 기록 · 하단 탭을 지나 다시 건너뛰기 링크로', async function () {
    await recordScreen();
    var seen = cycle(false), pa = lastIn('.sb-pa'), nav = Array.prototype.slice.call(document.querySelectorAll('#savantNav .savant-nav-btn'));
    eq(seen[0].id, 'skipToField', '첫 칸');
    ok(seen.indexOf($('fldCanvas')) > 0, '타구 입력 필드를 들러야 함');
    var i = seen.indexOf(pa);
    ok(i > 0, '타석 기록 카드의 마지막 버튼(' + name(pa) + ')을 들러야 함 — 들른 칸: ' + seen.map(name).join(' → '));
    eq(seen.slice(i + 1).map(name), nav.map(name), '타석 기록 다음은 하단 탭만 — 그다음은 처음(건너뛰기 링크)');
    HIDDEN.forEach(function (id) {
      var bad = seen.filter(function (el) { return $(id) && $(id).contains(el); });
      eq(bad.map(name), [], '닫힌 #' + id + ' 안의 칸을 들름');
    });
  });

  test('Tab 도돌이표: Shift+Tab 은 거꾸로 — 건너뛰기 링크에서 마지막 칸(하단 탭)으로', async function () {
    await recordScreen();
    var fwd = cycle(false), back = cycle(true);
    eq(back.map(name), fwd.slice().reverse().map(name), 'Shift+Tab 순서는 Tab 의 거꾸로');
    $('skipToField').focus();
    var nav = document.querySelectorAll('#savantNav .savant-nav-btn');
    eq(name(key(true)), name(nav[nav.length - 1]), '건너뛰기 링크에서 Shift+Tab');
    eq(key(false).id, 'skipToField', '마지막 칸에서 Tab');
  });

  test('Tab 도돌이표: 열린 창(타석 수정)의 칸은 들르고, 닫으면 다시 들르지 않는다', async function () {
    await recordScreen();
    var abs = AS.abs, st = document.createElement('style');
    // 러너(가상 시간 · 화면 그리기 없음)에서는 CSS 전환이 진행되지 않아 열린 창이 투명(opacity 0)한 채 남는다 → 이 창만 전환 없이 바로 바뀌게
    st.textContent = '#editRecOverlay{transition:none!important}';
    document.head.appendChild(st);
    AS.abs = [{ id: 1782000000701, bid: 'p1', bname: '탭타자', bnum: 7, res: '안타', inn: '1회초', team: 'home', rbi: 0, x: 0.5, y: 0.4, deg: 90, dir: 'CF' }];
    try {
      updateAll();
      var op = function () { return getComputedStyle($('editRecOverlay')).opacity; };
      openEditRec(1782000000701);
      eq(op(), '1', '전제: 열린 수정 창이 보여야 함');
      ok(cycle(false).indexOf($('editRes')) >= 0, '열린 수정 창의 결과 선택 칸을 들러야 함');
      closeOverlay('editRecOverlay');
      eq(op(), '0', '전제: 닫힌 수정 창은 투명');
      ok(cycle(false).indexOf($('editRes')) < 0, '닫힌 수정 창의 칸은 들르면 안 됨');
    } finally { closeOverlay('editRecOverlay'); st.remove(); AS.abs = abs; updateAll(); }
  });

  test('Tab 도돌이표: 다른 코드가 이미 처리한 Tab(preventDefault)은 건드리지 않는다', async function () {
    await recordScreen();
    $('skipToField').focus();
    var stop = function (e) { if (e.key === 'Tab') e.preventDefault(); };
    $('skipToField').addEventListener('keydown', stop);
    try { eq(key(false).id, 'skipToField', '포커스가 그대로여야 함'); }
    finally { $('skipToField').removeEventListener('keydown', stop); }
  });
})();
