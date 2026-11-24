// 동작 분석 — 기록 잇기 (js/motion/sync.js): 할 일 정하기 · 좌표 묶음 바꾸기 · 올릴 칸 · 받은 행 · 이메일 가리기 · 기록 합치기(store.js)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var S, ST;
  var entry = function (id, o) { return Object.assign({ id: id, at: '2026-11-2' + (id % 10) + 'T00:00:00Z', mode: 'bat', hand: 'R', metrics: { pelvisPeak: id }, hasData: false, video: null }, o || {}); };
  var row = function (id, o) { return Object.assign({ entry_id: String(id), entry: { id: id, at: '2026-11-20T00:00:00Z', mode: 'bat', hand: 'R', metrics: { pelvisPeak: id } }, deleted: false, has_clip: null }, o || {}); };
  var memStore = function (init) { var m = {}; if (init) m.sl_motion_log = JSON.stringify(init); return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); } }; };

  test('(준비) 기록 잇기 · 저장 모듈을 불러온다 (서버 요청 없이)', async function () {
    S = await import('/js/motion/sync.js?v=3'); ST = await import('/js/motion/store.js?v=4');
    ok(S.planSync && S.encodeClip && S.decodeClip && S.toCloudEntry && S.fromCloudRow && S.hasSession && ST.mergeEntries, '모듈 로드');
  });

  test('할 일: 서버에 없는 것은 올리고 · 서버에만 있는 것은 받고 · 지움 표시는 이 기기에서도 지운다', async function () {
    var local = [entry(1, { hasData: true }), entry(2), entry(3, { hasData: true }), entry(4, { hasData: true })];
    var rows = [row(2), row(3, { deleted: true }), row(4, { has_clip: null }), row(5, { has_clip: 90 }), row(6, { deleted: true })];
    var p = S.planSync(local, rows);
    eq(p.upload.map(function (u) { return [u.entry.id, u.withClip]; }), [[1, true], [4, true]], '올릴 것(1 은 없음 · 4 는 좌표만 빠짐)');
    eq(p.remove, [3], '서버에서 지운 것');
    eq(p.add.map(function (e) { return [e.id, e.hasData, e.cloud, e.video]; }), [[5, true, true, null]], '받을 것(6 은 지움 표시라 받지 않음)');
    eq(S.planSync([], []), { upload: [], add: [], remove: [], patch: [] }, '둘 다 비었을 때');
  });

  test('올릴 칸 · 받은 행: 영상 정보와 이 기기 표시는 올리지 않는다', async function () {
    var e = entry(7, { hasData: true, video: { sig: 'a.mp4|1|2', name: 'a.mp4', size: 1 }, cloud: true, name: '김타자' });
    var c = S.toCloudEntry(e);
    eq([c.video, c.hasData, c.cloud, c.name, c.id], [undefined, undefined, undefined, '김타자', 7], 'toCloudEntry');
    eq(S.fromCloudRow(row(8, { has_clip: 0 })).hasData, true, '좌표가 있으면(관절 수 0 이어도 값이 있으면) 다시 볼 수 있음');
  });

  test('좌표 묶음: 서버 모양으로 바꿨다가 되돌리면 그대로', async function () {
    var n = 3, world = new Float32Array(n * 33 * 4), image = new Float32Array(n * 33 * 4), i;
    for (i = 0; i < world.length; i++) { world[i] = i * 0.25 - 7.5; image[i] = Math.sin(i); }
    var clip = { id: 9, hz: 30, start: 1.5, aspect: 1.77, slow: 1, eventIndex: null, n: n, found: Uint8Array.from([1, 0, 1]), world: world, image: image };
    var enc = S.encodeClip(clip);
    ok(typeof enc.world === 'string' && typeof enc.found === 'string' && JSON.parse(JSON.stringify(enc)).n === 3, 'JSON 으로 보낼 수 있다');
    var dec = S.decodeClip(JSON.parse(JSON.stringify(enc)), 9);
    eq([dec.id, dec.hz, dec.start, dec.aspect, dec.slow, dec.eventIndex, dec.n], [9, 30, 1.5, 1.77, 1, null, 3], '나머지 값');
    eq(Array.from(dec.found), [1, 0, 1], 'found');
    ok(dec.world instanceof Float32Array && dec.world.length === world.length && dec.world.every(function (v, k) { return v === world[k]; }), 'world 숫자가 그대로');
    ok(dec.image.every(function (v, k) { return v === image[k]; }), 'image 숫자가 그대로');
  });

  test('로그인 확인 · 이메일 가리기', async function () {
    eq([S.hasSession(memStore()), S.hasSession({ getItem: function () { return '{"a":1}'; } }), S.hasSession({ getItem: function () { throw new Error('x'); } })], [false, true, false], 'hasSession');
    eq([S.maskEmail('kim1234@gmail.com'), S.maskEmail('a@b.c'), S.maskEmail('')], ['ki…@gmail.com', 'a…@b.c', '로그인됨'], 'maskEmail');
  });

  test('기록 합치기: 받은 기록을 날짜순으로 넣고, 같은 id 는 이 기기 것을 둔다 · 최대 200개', async function () {
    var st = memStore([entry(3, { at: '2026-11-23T00:00:00Z' }), entry(1, { at: '2026-11-21T00:00:00Z' })]);
    ok(ST.mergeEntries([entry(2, { at: '2026-11-22T00:00:00Z' }), entry(3, { at: '2026-11-25T00:00:00Z', metrics: { pelvisPeak: 999 } }), { id: 0 }], st), '저장 성공');
    var list = ST.loadLog(st);
    eq(list.map(function (e) { return e.id; }), [3, 2, 1], '날짜순');
    eq(list[0].metrics.pelvisPeak, 3, '같은 id 는 이 기기 것');
    var many = []; for (var k = 1; k <= 210; k++) many.push(entry(1000 + k, { at: new Date(Date.UTC(2026, 0, 1) + k * 1e6).toISOString() }));
    var st2 = memStore(); ST.mergeEntries(many, st2);
    eq(ST.loadLog(st2).length, 200, '200개까지');
  });
})();
