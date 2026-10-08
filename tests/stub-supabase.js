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
  // failRead / failWrite: null | 'reject'(요청 자체가 reject) | {status,code,message} | 함수(rows, 테이블 이름)→위 값
  var srv = window.__srv = { games: [], user_games: [], teams: [], team_members: [], user: null, log: [], failRead: null, failWrite: null, channels: [] };   // channels: cloud.js 가 건 realtime 구독 {name, type, filter, cb}
  srv.reset = function () {
    srv.games = []; srv.user_games = []; srv.teams = []; srv.team_members = []; srv.user = null;
    srv.log = []; srv.failRead = null; srv.failWrite = null; srv.channels = []; srv.rlsDelete = false;
  };
  var authCb = null;   // cloud.js 가 등록한 onAuthStateChange 콜백
  // 로그인한 것처럼 만든다: 세션을 돌려주고 SIGNED_IN 을 알린다(cloud.js 가 시작 동기화를 다시 돌린다)
  srv.signIn = function () {
    srv.user = { id: 'TEST-USER', email: 'test@example.invalid', is_anonymous: false, user_metadata: {} };
    if (!authCb) throw new Error('stub: onAuthStateChange 콜백이 등록되지 않음');
    authCb('SIGNED_IN', { user: srv.user });
  };
  // 로그아웃: 세션을 비우고 SIGNED_OUT 을 알린다(supabase-js 와 같은 순서)
  srv.signOut = function () {
    srv.user = null;
    if (!authCb) throw new Error('stub: onAuthStateChange 콜백이 등록되지 않음');
    authCb('SIGNED_OUT', null);
  };
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function Q(table, op, payload, opts) { this.t = table; this.op = op; this.p = payload; this.o = opts; this.cols = '*'; this.f = {}; this.inF = {}; this.ret = false; }
  Q.prototype.select = function (c) { this.cols = c || '*'; if (this.op !== 'select') this.ret = true; return this; };   // delete().select() = 지운 행을 돌려받는다
  Q.prototype.eq = function (k, v) { this.f[k] = v; return this; };
  Q.prototype.in = function (k, arr) { this.inF[k] = arr; return this; };
  Q.prototype.maybeSingle = Q.prototype.single = function () { this.one = true; return this; };
  Q.prototype.then = function (ok, bad) { return run(this).then(ok, bad); };

  function run(q) {
    return Promise.resolve().then(function () {
      var rows = q.op === 'upsert' || q.op === 'insert' ? (Array.isArray(q.p) ? q.p : [q.p]) : null;
      srv.log.push({ table: q.t, op: q.op, cols: q.cols, rows: rows ? clone(rows) : null, f: clone(q.f), inF: clone(q.inF) });
      var f = q.op === 'select' ? srv.failRead : srv.failWrite;
      if (typeof f === 'function') f = f(rows, q.t);
      if (f === 'reject') throw new TypeError('Failed to fetch');
      if (f) return { data: null, error: { message: f.message, code: f.code || '', details: f.details }, status: f.status, statusText: '' };
      var tbl = srv[q.t];
      if (!Array.isArray(tbl)) throw new Error('stub: 지원하지 않는 테이블 ' + q.t);
      if (q.op === 'select') {
        var cols = q.cols === '*' ? null : q.cols.split(',').map(function (s) { return s.trim(); });
        var out = tbl.filter(function (r) { return Object.keys(q.f).every(function (k) { return r[k] === q.f[k]; }) && Object.keys(q.inF).every(function (k) { return q.inF[k].indexOf(r[k]) >= 0; }); });
        var data = clone(out).map(function (r) { if (!cols) return r; var o = {}; cols.forEach(function (c) { o[c] = r[c]; }); return o; });
        return { data: q.one ? (data[0] || null) : data, error: null, status: 200 };
      }
      if (q.op === 'delete') {
        // RLS 흉내: user_games 는 자기 행(user_id = auth.uid())만 지울 수 있다. 정책이 막으면(srv.rlsDelete) 에러 없이 0행 삭제로 끝난다
        var match = function (r) { return Object.keys(q.f).every(function (k) { return r[k] === q.f[k]; }) && Object.keys(q.inF).every(function (k) { return q.inF[k].indexOf(r[k]) >= 0; }); };
        var mine = function (r) { return q.t !== 'user_games' || r.user_id === (srv.user || {}).id; };
        var gone = srv.rlsDelete ? [] : tbl.filter(function (r) { return match(r) && mine(r); });
        srv[q.t] = tbl.filter(function (r) { return gone.indexOf(r) < 0; });
        var cols2 = q.cols === '*' ? null : q.cols.split(',').map(function (s) { return s.trim(); });
        return { data: q.ret ? clone(gone).map(function (r) { if (!cols2) return r; var o = {}; cols2.forEach(function (c) { o[c] = r[c]; }); return o; }) : null, error: null, status: q.ret ? 200 : 204 };
      }
      if (q.op === 'insert') { rows.forEach(function (r) { tbl.push(clone(r)); }); return { data: null, error: null, status: 201 }; }
      if (!q.o || !q.o.onConflict) throw new Error('stub: upsert 에 onConflict 필요');
      var keys = q.o.onConflict.split(',');
      rows.forEach(function (r) {
        var i = tbl.findIndex(function (x) { return keys.every(function (k) { return x[k] === r[k]; }); });
        if (i >= 0) tbl[i] = clone(r); else tbl.push(clone(r));
      });
      return { data: null, error: null, status: 201 };
    });
  }

  // 서버 쪽 함수(rpc) 흉내 — 목록에 없는 함수는 예외. 호출은 srv.log 에 {table:null, op:'rpc', fn, args} 로 남는다
  function teamsByCode(code) {
    return srv.teams.filter(function (t) { return t.code === code; }).slice(0, 1)
      .map(function (t) { return { id: t.id, name: t.name, is_owner: t.owner_id === (srv.user || {}).id }; });
  }
  // 핸들러는 행 배열을 돌려주거나, {error:{code,message}} 로 서버 예외를 흉내 낸다
  var rpcs = {
    find_team_by_code: function (a) { return teamsByCode(a.p_code); },
    join_team_by_code: function (a) {   // 실제 SQL 은 sql/10: 내 팀이면 is_owner 만 · 이미 이 팀이면 같은 행 · 다른 팀 소속이면 예외 · 아니면 team_members 에 넣는다
      var rows = teamsByCode(a.p_code), uid = (srv.user || {}).id;
      if (!rows.length || rows[0].is_owner) return rows;
      var mine = srv.team_members.filter(function (m) { return m.user_id === uid; })[0];
      if (mine && mine.team_id === rows[0].id) return rows;
      if (mine || srv.teams.some(function (t) { return t.owner_id === uid; })) return { error: { code: 'P0001', message: '이미 다른 팀에 속해 있어요. 탈퇴 후 다시 시도해 주세요' } };
      srv.team_members.push({ team_id: rows[0].id, user_id: uid });
      return rows;
    }
  };

  var client = {
    from: function (t) { return { select: function (c) { return new Q(t, 'select').select(c); }, upsert: function (rows, o) { return new Q(t, 'upsert', rows, o); }, insert: function (rows) { return new Q(t, 'insert', rows); }, delete: function () { return new Q(t, 'delete'); } }; },
    rpc: function (fn, args) {
      return Promise.resolve().then(function () {
        srv.log.push({ table: null, op: 'rpc', fn: fn, args: clone(args || {}) });
        if (!rpcs[fn]) throw new Error('stub: 지원하지 않는 rpc ' + fn);
        var out = rpcs[fn](args || {});
        return out && out.error ? { data: null, error: out.error, status: 400 } : { data: out, error: null, status: 200 };
      });
    },
    auth: {   // 기본은 로그인 안 한 상태(srv.user = null). srv.signIn() 으로 로그인한 것처럼 만든다
      getSession: function () { return Promise.resolve({ data: { session: srv.user ? { user: srv.user } : null } }); },
      onAuthStateChange: function (cb) { authCb = cb; return { data: { subscription: { unsubscribe: function () {} } } }; },
      signOut: function () { srv.signOut(); return Promise.resolve({}); }
    },
    channel: function (name) {   // 구독 콜백을 기억해 두면 테스트가 서버 이벤트를 흉내 낼 수 있다: srv.channels[i].cb({ new: 행 })
      var c = { on: function (type, filter, cb) { srv.channels.push({ name: name, type: type, filter: filter, cb: cb }); return c; }, subscribe: function () { return c; } };
      return c;
    },
    removeChannel: function () {}
  };
  window.supabase = { createClient: function () { return client; } };   // URL·키 인자는 받지도 쓰지도 않는다
})();
