// 테스트 공용 도구. 각 *.test.js 가 window.__T.test(이름, 함수)로 등록하면, 모든 파일이 로드된 뒤(load 이벤트) 등록 순서대로 실행한다.
// T.last(...)로 등록한 것은 전부 끝난 뒤 마지막에 실행(예: 외부 요청 0건 확인). 결과는 base64 로 DOM 에 게시 — run.mjs 가 읽어 간다.
(function () {
  var tests = [], lasts = [];
  var T = window.__T = {
    test: function (name, fn) { tests.push({ name: name, fn: fn }); },
    last: function (name, fn) { lasts.push({ name: name, fn: fn }); },
    $: function (id) { return document.getElementById(id); },
    ok: function (c, m) { if (!c) throw new Error(m); },
    eq: function (a, b, m) { var x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(m + ' — 기대 ' + y + ', 실제 ' + x); },
    ls: function (k) { return JSON.parse(localStorage.getItem(k)); },
    sleep: function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  };

  // ── 하네스 자체 점검: 외부 요청 차단 장치가 실제로 거부·기록하고, 전체 실행 동안 외부로 나가려던 요청이 0건인지 ──
  T.test('차단 장치 점검: 외부 fetch/XHR 는 거부되고 기록된다', async function () {
    var before = window.__netAttempts.length, rejected = false, threw = false;
    try { await fetch('https://example.invalid/x'); } catch (e) { rejected = true; }
    T.ok(rejected, '외부 fetch 가 거부되지 않음');
    try { new XMLHttpRequest().open('GET', 'https://example.invalid/y'); } catch (e) { threw = true; }
    T.ok(threw, '외부 XHR 이 거부되지 않음');
    T.eq(window.__netAttempts.length, before + 2, '시도 기록');
    window.__netAttempts.length = before;   // 점검용 시도 2건만 지운다(다른 테스트가 남긴 기록은 유지)
  });
  T.last('(마지막) 테스트 전체에서 외부로 나가려던 요청 0건', async function () {
    T.eq(window.__netAttempts, [], '외부 요청 시도');
  });

  async function main() {
    var results = [], all = tests.concat(lasts);
    for (var i = 0; i < all.length; i++) {
      try { await all[i].fn(); results.push({ name: all[i].name, ok: true }); }
      catch (e) { results.push({ name: all[i].name, ok: false, err: String(e && e.message || e) }); }
    }
    return results;
  }
  function publish(payload) {
    var bytes = new TextEncoder().encode(JSON.stringify(payload)), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var el = document.createElement('pre'); el.id = 't-result'; el.setAttribute('data-b64', btoa(bin)); document.body.appendChild(el);
  }
  window.addEventListener('load', function () {
    main().then(function (r) { publish({ results: r }); }, function (e) { publish({ fatal: String(e && e.message || e) }); });
  });
})();
