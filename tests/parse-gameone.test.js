// 게임원 파서(js/gameone.js) 케이스 — tests/parse-gameone.html 을 그대로 CI 에서 돌린다
//  · 케이스는 parse-gameone.html 한 곳에만 둔다(브라우저로 바로 열어 표로 보는 페이지). 여기서는 그 페이지를 iframe 으로 띄워 판정만 읽는다
//  · 페이지가 끝나면 body[data-status] = pass | fail, 케이스마다 .case[data-ok] = 1 | 0 을 남긴다
(function () {
  var T = window.__T, ok = T.ok, test = T.test;
  var doc = null;

  test('(준비) tests/parse-gameone.html 을 띄우고 판정이 나올 때까지 기다린다', async function () {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;height:600px;border:0';
    f.src = '/tests/parse-gameone.html';
    document.body.appendChild(f);
    for (var i = 0; i < 100; i++) {
      await T.sleep(50);
      var d = f.contentDocument;
      if (d && d.body && d.body.getAttribute('data-status')) { doc = d; break; }
    }
    ok(doc, '판정이 5초 안에 나오지 않음(파서 스크립트 로드 실패 또는 페이지 예외) — 요약: '
      + ((f.contentDocument && f.contentDocument.getElementById('summary') || {}).textContent || '(없음)'));
    ok(f.contentWindow.SLGameOne && typeof f.contentWindow.SLGameOne.parseGameOne === 'function', '파서(js/gameone.js) 로드');
  });

  test('파서 · 점수표 · 좌표 변환 케이스 전부 통과 (타구 왕복 포함)', function () {
    ok(doc, '(준비) 실패');
    var cases = doc.querySelectorAll('.case[data-ok]');
    ok(cases.length >= 20, '케이스 수 — 기대 20개 이상, 실제 ' + cases.length);
    var bad = Array.prototype.filter.call(cases, function (c) { return c.getAttribute('data-ok') !== '1'; }).map(function (c) {
      var name = (c.querySelector('h3') || {}).textContent || '(이름 없음)';
      var errs = Array.prototype.map.call(c.querySelectorAll('.errs li'), function (li) { return li.textContent; });
      return name + '\n      ' + errs.join('\n      ');
    });
    ok(!bad.length, '실패한 케이스 ' + bad.length + '개:\n    ' + bad.join('\n    '));
    ok(doc.body.getAttribute('data-status') === 'pass', '요약 — ' + doc.getElementById('summary').textContent);
  });
})();
