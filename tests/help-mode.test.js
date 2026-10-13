// 안내 모드(core.js toggleHelpMode · _helpModeClick) — 경기설정 · 분석 탭에서도 설명이 뜨는지
//  · 설명 창 · 표시는 body 바로 아래 (예전엔 #app-page 안이라 경기설정 · 분석 탭에서 0×0으로 안 보였다)
//  · 경기설정 탭(setup.js) 항목은 설명만 뜨고 동작은 막힌다 · 하단 탭은 기록 탭처럼 설명만
//  · 분석 탭(anahelp.js): 제목 있는 카드는 모두 설명이 붙고, 서브탭은 바뀌면서 설명이 뜬다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;

  function tip() { var t = $('helpModeTooltip'), r = t.getBoundingClientRect(); return t.classList.contains('show') && r.width > 0 && r.height > 0 ? $('hmtTitle').textContent : null; }
  async function withHelp(fn) {
    var ap = $('app-page').style.display;
    try {
      if (!window._helpModeActive) toggleHelpMode();
      await fn();
    } finally {
      if (window._helpModeActive) toggleHelpMode();
      closeHelpModeTooltip();
      shellNav('record');
      $('app-page').style.display = ap;
    }
  }

  test('안내 모드: 표시 · 설명 창이 body 바로 아래 — 경기설정 탭에서 하단 탭을 누르면 설명이 보이고 탭은 그대로', async function () {
    // 옮기는 건 scorebook.js 마운트(DOMContentLoaded 뒤 setTimeout 0)라 하네스가 테스트를 시작하는 load 보다 늦을 수 있다
    //   (측정: load 와의 간격 30~45ms — CPU 가 바쁘면 load 가 먼저 온다) → 최대 2초 기다린 뒤 같은 검사
    for (var w = 0; w < 2000 && !($('helpModeTooltip').parentElement === document.body && $('helpModeIndicator').parentElement === document.body); w += 20) await sleep(20);
    ok($('helpModeTooltip').parentElement === document.body, '설명 창이 body 바로 아래가 아님: ' + $('helpModeTooltip').parentElement.id);
    ok($('helpModeIndicator').parentElement === document.body, '표시가 body 바로 아래가 아님: ' + $('helpModeIndicator').parentElement.id);
    await withHelp(async function () {
      shellNav('settings');
      await sleep(30);
      document.querySelector('#savantNav .savant-nav-btn[data-tab="record"]').click();
      ok(/기록/.test(tip() || ''), '하단 탭 설명이 보여야 함 — 실제 ' + tip());
      eq(document.querySelector('#savantNav .savant-nav-btn.active').dataset.tab, 'settings', '탭은 그대로');
      ok($('helpModeTooltip').querySelector('.hmt-off'), '안내 모드 끄기 버튼');
    });
  });

  test('안내 모드: 경기설정 탭 항목은 설명만 뜨고 동작은 막힌다 (이닝 버튼 · 기록 지우기)', async function () {
    var inn0 = gameInfo().innings, abs0 = (AS.abs || []).length, confirmed = 0, conf = window.confirm;
    window.confirm = function () { confirmed++; return false; };
    try {
      await withHelp(async function () {
        shellNav('settings');
        renderSetup();
        await sleep(30);
        ok(document.querySelectorAll('#stNew [data-help]').length >= 30, '설명 붙은 항목 수: ' + document.querySelectorAll('#stNew [data-help]').length);
        var b = Array.prototype.find.call(document.querySelectorAll('#stInfo .st-inn button'), function (x) { return +x.textContent.replace(/\D/g, '') !== inn0; });
        b.click();
        eq(tip(), '이닝', '이닝 설명');
        eq(gameInfo().innings, inn0, '이닝은 그대로');
        closeHelpModeTooltip();
        document.querySelector('#stData .st-danger').click();
        eq(tip(), '이 경기 기록 지우기', '지우기 설명');
        eq(confirmed, 0, '지우기 확인창이 뜨지 않음');
        eq((AS.abs || []).length, abs0, '기록 그대로');
      });
    } finally { window.confirm = conf; }
  });

  test('안내 모드: 분석 탭 — 서브탭 화면 · 제목 있는 카드에 모두 설명 (새 카드는 js/features/anahelp.js CARD에 추가)', async function () {
    var miss = [];
    await withHelp(async function () {
      // batter:season = 타자 탭 [시즌 전체] (예전 프로필 카드가 여기로 옮겨짐)
      var subs = ['batter', 'batter:season', 'pitcher', 'compare', 'scout', 'team'];
      var bare = function (sub, sec) {
        return Array.prototype.filter.call(sec.querySelectorAll('section.sb-card, section.an-card'), function (c) {
          var h = c.querySelector('h2, h3');
          return h && h.textContent.trim() && !c.hasAttribute('data-help');
        }).map(function (c) { return sub + ': ' + c.querySelector('h2, h3').textContent.trim(); });
      };
      for (var i = 0; i < subs.length; i++) {
        var sub = subs[i].split(':')[0];
        shellNav('analysis', sub);
        if (subs[i] === 'batter:season') { await sleep(30); setBatterView('scope', 'season'); }
        var sec = document.querySelector('#analysisView .ana-sec[data-sub="' + sub + '"]'), left = [];
        // 카드는 탭마다 그리는 시점이 달라(팀 탭은 늦게) 다 그려질 때까지 잠깐 기다린다
        for (var k = 0; k < 40; k++) { await sleep(25); left = bare(subs[i], sec); if (!left.length && k >= 2) break; }
        ok(sec.hasAttribute('data-help'), subs[i] + ' 화면 설명');
        miss = miss.concat(left);
      }
      setBatterView('scope', 'game');
    });
    eq(miss, [], '설명 없는 카드');
  });

  test('안내 모드: 분석 서브탭은 바뀌면서 그 서브탭 설명이 뜬다', async function () {
    await withHelp(async function () {
      shellNav('analysis', 'batter');
      await sleep(30);
      document.querySelector('#anaSubnav .ana-sub[data-sub="team"]').click();
      eq(document.querySelector('#anaSubnav .ana-sub.on').dataset.sub, 'team', '서브탭 바뀜');
      eq(tip(), '팀', '서브탭 설명');
    });
  });
})();
