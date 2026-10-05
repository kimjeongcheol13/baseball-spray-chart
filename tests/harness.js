// 테스트 공용 도구. 러너(run.mjs)는 테스트 파일마다 페이지를 따로 띄우므로, 이 페이지에는 *.test.js 하나만 들어 있다.
// 각 파일이 window.__T.test(이름, 함수)로 등록하면, 파일이 로드된 뒤(load 이벤트) 등록 순서대로 실행한다.
// T.last(...)로 등록한 것은 전부 끝난 뒤 마지막에 실행. 결과는 base64 로 DOM 에 게시 — run.mjs 가 읽어 간다.
(function () {
  // 테스트 도중 페이지가 다시 로드되면(앱의 location.reload) 처음부터 다시 돌아 결과를 믿을 수 없다. window.name 은 새로고침 뒤에도 남으므로
  // 두 번째 로드를 알아채 fatal 로 끝낸다(fail-closed). 가장 흔한 원인은 러너가 막아 둔다(run.mjs 의 visibilitychange 차단)
  var reloaded = window.name === '__sl_harness';
  window.name = '__sl_harness';
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

  // ── 하네스 자체 점검: 외부 요청 차단 장치가 실제로 거부·기록하고, 실행 동안 외부로 나가려던 요청이 0건인지 ──
  // 이 둘은 모든 파일 페이지에서 돈다(shared). 러너가 같은 이름의 결과를 하나로 합쳐 세고, 어느 페이지에서든 실패하면 실패로 본다
  function shared(list, name, fn) { list.push({ name: name, fn: fn, shared: true }); }
  shared(tests, '차단 장치 점검: 외부 fetch/XHR 는 거부되고 기록된다', async function () {
    var before = window.__netAttempts.length, rejected = false, threw = false;
    try { await fetch('https://example.invalid/x'); } catch (e) { rejected = true; }
    T.ok(rejected, '외부 fetch 가 거부되지 않음');
    try { new XMLHttpRequest().open('GET', 'https://example.invalid/y'); } catch (e) { threw = true; }
    T.ok(threw, '외부 XHR 이 거부되지 않음');
    T.eq(window.__netAttempts.length, before + 2, '시도 기록');
    window.__netAttempts.length = before;   // 점검용 시도 2건만 지운다(다른 테스트가 남긴 기록은 유지)
  });
  shared(lasts, '(마지막) 테스트 전체에서 외부로 나가려던 요청 0건', async function () {
    T.eq(window.__netAttempts, [], '외부 요청 시도');
  });

  // 진행 표시(#t-progress): 가상 시간 예산을 넘기면 브라우저가 결과(#t-result)를 게시하기 전에 DOM 을 덤프한다.
  // 러너(run.mjs)가 이 표시를 읽어 "예산 초과(어느 테스트에서 멈췄는지)"로 실패시킨다 — 조용히 "결과를 읽지 못했다"로 끝나지 않게
  function mark(done, total, cur) {
    var el = document.getElementById('t-progress');
    if (!el) { el = document.createElement('pre'); el.id = 't-progress'; document.body.appendChild(el); }
    el.setAttribute('data-done', done); el.setAttribute('data-total', total);
    el.setAttribute('data-vms', Math.round(performance.now()));   // 가상 시간(ms)
    el.setAttribute('data-cur', encodeURIComponent(cur || ''));
  }
  async function main() {
    var results = [], all = tests.concat(lasts);
    for (var i = 0; i < all.length; i++) {
      mark(i, all.length, all[i].name);
      var sh = all[i].shared ? { shared: true } : {};
      try { await all[i].fn(); results.push(Object.assign({ name: all[i].name, ok: true }, sh)); }
      catch (e) { results.push(Object.assign({ name: all[i].name, ok: false, err: String(e && e.message || e) }, sh)); }
    }
    mark(all.length, all.length, '');
    return results;
  }
  function publish(payload) {
    var bytes = new TextEncoder().encode(JSON.stringify(payload)), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var el = document.createElement('pre'); el.id = 't-result'; el.setAttribute('data-b64', btoa(bin)); document.body.appendChild(el);
    // 결과를 게시했으니 남은 타이머 · 애니메이션 프레임을 모두 끊는다. 크롬은 가상 시간 예산을 다 소진한 뒤에야 DOM 을 덤프하는데,
    // 앱의 반복 타이머가 남아 있으면 남은 예산(수백 초)을 헛돌아 실제 시간만 늘어난다. 이미 게시한 결과에는 영향이 없다
    for (var t = setTimeout(function () {}, 0); t >= 0; t--) { clearTimeout(t); clearInterval(t); }
    for (var r = requestAnimationFrame(function () {}); r >= 0; r--) cancelAnimationFrame(r);
  }
  window.addEventListener('load', function () {
    if (reloaded) { publish({ fatal: '테스트 도중 페이지가 다시 로드됐다(앱의 location.reload 호출 — 가시성 변경 · 서비스워커 컨트롤러 변경 등). 처음부터 다시 도는 결과는 믿을 수 없어 중단한다' }); return; }
    main().then(function (r) { publish({ results: r, vms: Math.round(performance.now()) }); }, function (e) { publish({ fatal: String(e && e.message || e) }); });
  });
})();
