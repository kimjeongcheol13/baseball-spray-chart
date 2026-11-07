// 인터넷이 없거나 신호가 아주 약한 야구장에서 앱 열기 (파일럿 준비 11-07)
//   · sw.js: HTML 이 3초 안에 안 오면 전에 연 같은 주소를 먼저 보여 준다. 다른 주소로 바꿔치지 않는다
//   · index.html _slSwWarm: 앱을 여는 데 쓴 파일 중 SW 캐시에 없는 것만 다시 요청해 담는다. 전날 한 번만 열어도 다음 날 뜨게
//   러너는 서비스 워커를 막아 둔다(run.mjs) → sw.js 는 가짜 self · caches · fetch 로 직접 돌리고, 실제 설치는 PR 때 손으로 쟀다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep;
  var PAGE = location.origin + '/index.html?app=1', ROOT_HTML = new URL('./index.html', location.href).href;

  async function loadSw(fetchStub, cached) {
    var src = await (await fetch('sw.js')).text(), on = {}, store = {};
    Object.keys(cached || {}).forEach(function (u) { store[u] = new Response(cached[u]); });
    var key = function (r) { return typeof r === 'string' ? new URL(r, location.href).href : r.url; };
    var cache = {
      put: function (r, res) { store[key(r)] = res; return Promise.resolve(); },
      match: function (r) { return Promise.resolve(store[key(r)]); },
      keys: function () { return Promise.resolve([]); }
    };
    var caches = {
      open: function () { return Promise.resolve(cache); },
      match: function (r, o) {
        var u = key(r), hit = store[u] || (o && o.ignoreSearch && store[Object.keys(store).filter(function (k) { return k.split('?')[0] === u.split('?')[0]; })[0]]);
        return Promise.resolve(hit && hit.clone());
      }
    };
    new Function('self', 'caches', 'fetch', src)({ addEventListener: function (t, f) { on[t] = f; }, skipWaiting: function () {}, clients: {} }, caches, fetchStub);
    return { on: on, store: store };
  }
  // 주소창 이동과 같은 HTML 요청을 흘려보낸다. got.text = 페이지가 받은 내용
  function open(sw, url) {
    var got = { text: null, kept: [] };
    sw.on.fetch({
      request: new Request(url, { headers: { accept: 'text/html' } }),
      waitUntil: function (p) { got.kept.push(p); },
      respondWith: function (p) { p.then(function (r) { return r.text(); }).then(function (t) { got.text = t; }); }
    });
    return got;
  }
  function later() { var d = {}; d.promise = new Promise(function (r) { d.resolve = r; }); return d; }

  test('약한 신호: HTML 이 3초 안에 안 오면 전에 연 같은 주소를 보여 주고, 늦게 온 최신본은 캐시에 담는다', async function () {
    var net = later(), sw = await loadSw(function () { return net.promise; }, (function () { var c = {}; c[PAGE] = '어제 화면'; return c; })());
    var got = open(sw, PAGE);
    await sleep(2000);
    eq(got.text, null, '3초 전에는 네트워크를 기다린다');
    await sleep(1500);
    eq(got.text, '어제 화면', '3초가 지나면 같은 주소 캐시');
    eq(got.kept.length, 1, '늦은 응답을 받을 때까지 SW 가 살아 있게 한다');
    net.resolve(new Response('오늘 화면', { status: 200 }));
    await got.kept[0]; await sleep(50);
    eq(await sw.store[PAGE].clone().text(), '오늘 화면', '다음에 열 때 쓸 최신본');
  });

  test('약한 신호: ?app=1 이 지워진 주소로만 담겨 있어도 같은 페이지면 3초 뒤 보여 준다', async function () {
    var c = {}; c[location.origin + '/index.html'] = '어제 화면';
    var sw = await loadSw(function () { return new Promise(function () {}); }, c);
    var got = open(sw, PAGE);
    await sleep(3500);
    eq(got.text, '어제 화면', '? 만 다른 같은 페이지');
  });

  test('약한 신호: 전에 안 연 주소는 3초가 지나도 앱 화면으로 바꿔치지 않고 네트워크를 기다린다', async function () {
    var net = later(), sw = await loadSw(function () { return net.promise; }, (function () { var c = {}; c[ROOT_HTML] = '앱 화면'; return c; })());
    var got = open(sw, location.origin + '/landing.html');
    await sleep(3500);
    eq(got.text, null, '아직 기다린다');
    net.resolve(new Response('랜딩', { status: 200 }));
    await sleep(50);
    eq(got.text, '랜딩', '네트워크 응답');
  });

  test('신호가 괜찮으면 네트워크 응답, 인터넷이 없으면 바로 캐시', async function () {
    var c = {}; c[PAGE] = '어제 화면';
    var sw = await loadSw(function () { return Promise.resolve(new Response('오늘 화면', { status: 200 })); }, c);
    var got = open(sw, PAGE);
    await sleep(50);
    eq(got.text, '오늘 화면', '네트워크 응답');

    var off = await loadSw(function () { return Promise.reject(new TypeError('offline')); }, (function () { var d = {}; d[ROOT_HTML] = '앱 화면'; return d; })());
    var g2 = open(off, PAGE);
    await sleep(50);
    eq(g2.text, '앱 화면', '인터넷 없음: 3초 기다리지 않고 index.html');
  });

  test('파일 담기: SW 가 없으면 안 돌고, 캐시에 없는 파일만 다시 요청한다. API 호출 · 통계는 다시 부르지 않는다', async function () {
    ok(typeof window._slSwWarm === 'function', 'index.html 에 _slSwWarm');
    var sw = navigator.serviceWorker, keep = {
      fetch: window.fetch,
      entries: performance.getEntriesByType,
      caches: Object.getOwnPropertyDescriptor(window, 'caches')
    };
    var o = location.origin, asked = [], ctl = null, E = function (t, n) { return { initiatorType: t, name: n }; };
    var list = [
      E('script', o + '/js/core.js?v=1'), E('script', o + '/js/app.js?v=1'), E('link', o + '/css/a.css?v=1'), E('css', 'https://fonts.gstatic.com/a.woff2'),
      E('img', o + '/player-logo.png'), E('script', 'https://cdnjs.cloudflare.com/x.min.js'),
      E('script', 'https://www.googletagmanager.com/gtag/js?id=G'), E('fetch', 'https://x.supabase.co/rest/v1/games'),
      E('xmlhttprequest', o + '/api'), E('beacon', 'https://region1.google-analytics.com/g/collect')
    ];
    try {
      Object.defineProperty(sw, 'controller', { configurable: true, get: function () { return ctl; } });
      Object.defineProperty(window, 'caches', { configurable: true, value: { match: function (u) { return Promise.resolve(u === o + '/js/app.js?v=1' ? {} : undefined); } } });
      performance.getEntriesByType = function () { return list; };
      window.fetch = function (u, opt) { asked.push([u.replace(location.href.split('#')[0], 'PAGE'), opt && opt.headers && opt.headers.Accept || '']); return Promise.resolve(new Response('')); };
      window._slSwWarm();
      await sleep(30);
      eq(asked, [], 'SW 가 페이지를 잡기 전에는 요청 없음');
      ctl = {};
      window._slSwWarm();
      await sleep(30);
      eq(asked.map(function (a) { return a[0]; }).sort(), [
        'PAGE', o + '/css/a.css?v=1', o + '/js/core.js?v=1', o + '/player-logo.png', 'https://cdnjs.cloudflare.com/x.min.js', 'https://fonts.gstatic.com/a.woff2'
      ].sort(), '캐시에 없는 파일과 이 페이지만');
      eq(asked.filter(function (a) { return a[0] === 'PAGE'; })[0][1], 'text/html', '이 페이지는 HTML 요청으로 (SW 가 HTML 길로 담게)');
    } finally {
      delete sw.controller;
      if (keep.caches) Object.defineProperty(window, 'caches', keep.caches); else delete window.caches;
      performance.getEntriesByType = keep.entries;
      window.fetch = keep.fetch;
    }
  });
})();
