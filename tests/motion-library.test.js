// 동작 분석 저장 · 불러오기 · 비교 (js/motion/library.js 순수 함수 · store.js updateEntry · db.js IndexedDB)
//  · 프레임 좌표를 숫자 배열로 묶었다 풀면 그대로인지, 목록에 없는 데이터를 지울 대상으로 고르는지, 두 기록 비교 표, IndexedDB 에 넣었다 꺼내기
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var L, D, ST;
  var near = function (v, want, tol, m) { ok(typeof v === 'number' && Math.abs(v - want) <= tol, m + ' — 기대 ' + want + ' ± ' + tol + ', 실제 ' + v); };
  function frame(seed) {
    var w = [], im = [], j;
    for (j = 0; j < 33; j++) { w.push({ x: seed + j * 0.01, y: -j * 0.02, z: j * 0.005, visibility: j % 2 ? 0.25 : 1 }); im.push({ x: 0.3 + j * 0.01, y: 0.2 + seed * 0.1, z: -0.1, visibility: 0.75 }); }
    return { world: w, image: im };
  }
  var entry = function (id, mode, metrics, video) { return { id: id, at: '2026-11-22T00:00:00Z', mode: mode, hand: 'R', metrics: metrics, video: video || null }; };

  test('(준비) 저장 모듈을 불러온다', async function () {
    L = await import('/js/motion/library.js?v=1'); D = await import('/js/motion/db.js?v=1'); ST = await import('/js/motion/store.js?v=2');
    ok(L.packFrames && L.unpackFrames && L.compareRows && D.putClip && ST.updateEntry, '모듈 로드');
  });

  test('프레임 묶기: 묶었다 풀면 좌표가 그대로 · 사람을 못 찾은 프레임은 그대로 비어 있다 · 크기는 프레임당 1KB 남짓', async function () {
    var frames = [frame(0), { world: null, image: null }, frame(0.5)], p = L.packFrames(frames), back = L.unpackFrames(p);
    eq([p.n, Array.from(p.found)], [3, [1, 0, 1]], '찾은 프레임 표시');
    eq(p.world.length, 3 * 33 * 4, '숫자 개수');
    ok(p.world.byteLength + p.image.byteLength <= 3 * 1100, '크기 ' + (p.world.byteLength + p.image.byteLength));
    eq(back[1], { world: null, image: null }, '빈 프레임');
    near(back[2].world[10].x, 0.6, 1e-6, 'world x'); near(back[2].world[10].y, -0.2, 1e-6, 'world y'); near(back[2].world[10].z, 0.05, 1e-6, 'world z');
    near(back[0].world[1].visibility, 0.25, 1e-6, 'visibility'); near(back[2].image[5].y, 0.25, 1e-6, 'image y');
    eq(back[0].world.length, 33, '관절 수');
  });

  test('영상 표식 · 지울 대상: 같은 파일은 같은 표식, 목록에 없는 분석 데이터와 아무도 안 쓰는 영상만 고른다', async function () {
    eq(L.videoSig({ name: 'a.mp4', size: 10, lastModified: 5 }), 'a.mp4|10|5', '표식');
    eq(L.videoSig({ name: 'a.mp4', size: 10 }), 'a.mp4|10|0', '수정 시각이 없는 파일');
    var log = [entry(1, 'bat', {}, { sig: 'v1' }), entry(2, 'bat', {}), entry(3, 'pitch', {}, { sig: 'v1' })];
    eq(L.orphanKeys(log, [1, 2, 9], ['v1', 'v2']), { clips: [9], videos: ['v2'] }, '지울 것');
    eq(L.orphanKeys([], [4], ['v1']), { clips: [4], videos: ['v1'] }, '목록이 비면 전부');
  });

  test('두 기록 비교: 같은 종류는 지표 전부, 타격과 투구는 공통 지표만, 차이는 B − A, 값이 없으면 차이도 없다', async function () {
    var bat = { pelvisPeak: 600, trunkPeak: 900, maxSeparation: 20, stride: 80, leadKnee: 150, trunkTilt: 10, headMove: 5 };
    var bat2 = { pelvisPeak: 650, trunkPeak: 850, maxSeparation: null, stride: 90, leadKnee: 160, trunkTilt: 12, headMove: 4 };
    var rows = L.compareRows(entry(1, 'bat', bat), entry(2, 'bat', bat2));
    eq(rows.map(function (r) { return r.key; }), ['pelvisPeak', 'trunkPeak', 'maxSeparation', 'stride', 'leadKnee', 'trunkTilt', 'headMove'], '지표');
    eq([rows[0].diff, rows[1].diff, rows[2].diff], [50, -50, null], '차이');
    ok(rows[0].label && rows[0].unit === '°/s', '이름 · 단위');
    var pitch = { pelvisPeak: 700, trunkPeak: 1000, maxSeparation: 30, stride: 85, leadKnee: 140, trunkTilt: 20, elbowAtPlant: 90, armAngle: 40 };
    eq(L.compareRows(entry(1, 'bat', bat), entry(2, 'pitch', pitch)).map(function (r) { return r.key; }), ['pelvisPeak', 'trunkPeak', 'maxSeparation', 'stride', 'leadKnee', 'trunkTilt'], '타격 · 투구 공통 지표');
  });

  test('기록 일부만 바꾸기(updateEntry): 그 기록만 바뀌고 순서 · 다른 기록은 그대로', async function () {
    var mem = {}, box = { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = v; } };
    ST.addEntry(entry(1, 'bat', { pelvisPeak: 1 }), box); ST.addEntry(entry(2, 'bat', { pelvisPeak: 2 }), box);
    ok(ST.updateEntry(1, { hasData: true, video: { sig: 'v', name: 'a.mp4', size: 3 } }, box), '저장 실패');
    var list = ST.loadLog(box);
    eq(list.map(function (e) { return [e.id, !!e.hasData, e.metrics.pelvisPeak]; }), [[2, false, 2], [1, true, 1]], '바뀐 목록');
    eq(Object.keys(mem), ['sl_motion_log'], '쓰는 키');
  });

  test('IndexedDB: 분석 데이터와 영상을 넣었다 꺼내고, 목록 · 지우기가 된다', async function () {
    var id = -424242, sig = 'test-video|1|1', packed = L.packFrames([frame(0), { world: null, image: null }]);
    await D.putClip(Object.assign({ id: id, hz: 30, start: 1.5, aspect: 1.78, slow: 1, eventIndex: null }, packed));
    await D.putVideo({ sig: sig, name: 't.mp4', size: 3, blob: new Blob(['abc'], { type: 'video/mp4' }) });
    try {
      var clip = await D.getClip(id), video = await D.getVideo(sig);
      eq([clip.hz, clip.start, clip.n, Array.from(clip.found)], [30, 1.5, 2, [1, 0]], '꺼낸 분석 데이터');
      near(L.unpackFrames(clip)[0].world[4].x, 0.04, 1e-6, '꺼낸 좌표');
      eq([video.name, video.blob.size, await video.blob.text()], ['t.mp4', 3, 'abc'], '꺼낸 영상');
      ok((await D.clipIds()).indexOf(id) >= 0 && (await D.videoSigs()).indexOf(sig) >= 0, '목록에 있다');
      var free = await D.freeBytes();
      ok(free === null || free > 0, '남은 공간 ' + free);
    } finally {
      await D.deleteClip(id); await D.deleteVideo(sig);
    }
    eq([await D.getClip(id), await D.getVideo(sig)], [undefined, undefined], '지운 뒤');
  });
})();
