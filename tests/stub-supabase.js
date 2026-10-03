// 테스트 전용 가짜 supabase-js + 외부 요청 차단 장치. 러너(run.mjs)가 index.html 의 supabase CDN 태그 자리에 끼워 넣는다.
// fail-closed: 여기서 흉내 내지 않는 호출(없는 메서드·테이블·onConflict 누락)은 전부 예외로 끝난다.
// 네트워크 요청은 한 건도 나가지 않는다 — 모든 응답은 window.__srv(메모리) 상태에서 만든다.
(function () {
  // ── 외부 요청 차단: 같은 출처 밖으로 가는 fetch/XHR/beacon/WebSocket/EventSource 는 거부하고 기록한다 ──
  var attempts = window.__netAttempts = [];
  function sameOrigin(u) { try { return new URL(String(u), location.href).origin === location.origin; } catch (e) { return false; } }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (u) {
    var url = String(u && u.url || u);
    if (sameOrigin(url)) return realFetch.apply(null, arguments);
    attempts.push('fetch ' + url);
    return Promise.reject(new TypeError('blocked: 테스트 중 외부 요청 금지'));
  };
  var xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) {
    if (!sameOrigin(u)) { attempts.push('xhr ' + u); throw new Error('blocked: 테스트 중 외부 요청 금지'); }
    return xhrOpen.apply(this, arguments);
  };
  navigator.sendBeacon = function (u) { attempts.push('beacon ' + u); return false; };
  ['WebSocket', 'EventSource'].forEach(function (n) {
    window[n] = function (u) { attempts.push(n + ' ' + u); throw new Error('blocked: 테스트 중 외부 요청 금지'); };
  });

  // ── 가짜 서버(메모리) ──
  // failRead / failWrite: null | 'reject'(요청 자체가 reject) | {status,code,message} | 함수(rows)→위 값
  var srv = window.__srv = { games: [], log: [], failRead: null, failWrite: null };
  srv.reset = function () { srv.games = []; srv.log = []; srv.failRead = null; srv.failWrite = null; };
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function Q(table, op, payload, opts) { this.t = table; this.op = op; this.p = payload; this.o = opts; this.cols = '*'; this.f = {}; }
  Q.prototype.select = function (c) { this.cols = c || '*'; return this; };
  Q.prototype.eq = function (k, v) { this.f[k] = v; return this; };
  Q.prototype.then = function (ok, bad) { return run(this).then(ok, bad); };

  function run(q) {
    return Promise.resolve().then(function () {
      var rows = q.op === 'upsert' ? (Array.isArray(q.p) ? q.p : [q.p]) : null;
      srv.log.push({ table: q.t, op: q.op, cols: q.cols, rows: rows ? clone(rows) : null });
      var f = q.op === 'select' ? srv.failRead : srv.failWrite;
      if (typeof f === 'function') f = f(rows);
      if (f === 'reject') throw new TypeError('Failed to fetch');
      if (f) return { data: null, error: { message: f.message, code: f.code || '' }, status: f.status, statusText: '' };
      var tbl = srv[q.t];
      if (!Array.isArray(tbl)) throw new Error('stub: 지원하지 않는 테이블 ' + q.t);
      if (q.op === 'select') {
        var cols = q.cols === '*' ? null : q.cols.split(',').map(function (s) { return s.trim(); });
        var out = tbl.filter(function (r) { return Object.keys(q.f).every(function (k) { return r[k] === q.f[k]; }); });
        return { data: clone(out).map(function (r) { if (!cols) return r; var o = {}; cols.forEach(function (c) { o[c] = r[c]; }); return o; }), error: null, status: 200 };
      }
      if (!q.o || !q.o.onConflict) throw new Error('stub: upsert 에 onConflict 필요');
      var keys = q.o.onConflict.split(',');
      rows.forEach(function (r) {
        var i = tbl.findIndex(function (x) { return keys.every(function (k) { return x[k] === r[k]; }); });
        if (i >= 0) tbl[i] = clone(r); else tbl.push(clone(r));
      });
      return { data: null, error: null, status: 201 };
    });
  }

  var client = {
    from: function (t) { return { select: function (c) { return new Q(t, 'select').select(c); }, upsert: function (rows, o) { return new Q(t, 'upsert', rows, o); } }; },
    auth: {   // 로그인 안 한 상태 고정(cloud.js 시작 동기화는 서버 전송 없이 끝난다)
      getSession: function () { return Promise.resolve({ data: { session: null } }); },
      onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
      signOut: function () { return Promise.resolve({}); }
    },
    channel: function () { var c = { on: function () { return c; }, subscribe: function () { return c; } }; return c; },
    removeChannel: function () {}
  };
  window.supabase = { createClient: function () { return client; } };   // URL·키 인자는 받지도 쓰지도 않는다
})();
