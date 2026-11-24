// 동작 분석 — 영상을 다른 기기로 (js/motion/cut.js · sync.js): 줄일 크기 · 비트 · 구간 · 시간 맞추기 · 파일 자리 · 나중에 온 영상 표시
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var C, S;

  test('(준비) 영상 줄이기 · 기록 잇기 모듈을 불러온다 (서버 요청 없이)', async function () {
    C = await import('/js/motion/cut.js?v=2'); S = await import('/js/motion/sync.js?v=5');
    ok(C.outputSize && C.enoughFrames && C.bitrateFor && C.cutRange && C.offsetFrom && C.shiftClip && C.shiftRange && S.videoPath && S.baseType, '모듈 로드');
  });

  test('줄일 크기: 짧은 변 720 이하 · 짝수 · 작은 영상은 그대로', async function () {
    eq(C.outputSize(1920, 1080), { width: 1280, height: 720 }, '가로 1080p');
    eq(C.outputSize(1080, 1920), { width: 720, height: 1280 }, '세로 1080p');
    eq(C.outputSize(640, 360), { width: 640, height: 360 }, '작으면 그대로');
    eq(C.outputSize(1271, 721), { width: 1270, height: 720 }, '홀수는 짝수로');
  });

  test('비트: 짧은 구간은 기본값 · 긴 구간은 8MB 를 넘지 않게', async function () {
    eq(C.bitrateFor(4), 2500000, '4초');
    var b = C.bitrateFor(40);
    ok(b < 2500000 && (b * 40) / 8 <= 8000000, '40초도 8MB 안: ' + b);
  });

  test('구간: 앞뒤 0.3초 여유 · 영상 길이 안으로', async function () {
    eq(C.cutRange({ start: 2, end: 5 }, 10), { start: 1.7, end: 5.3 }, '가운데');
    eq(C.cutRange({ start: 0.1, end: 9.9 }, 10), { start: 0, end: 10 }, '양 끝');
  });

  test('시간 맞추기: 가운데 값 · 받은 기기에서 좌표 시작 · 구간을 당긴다', async function () {
    eq(C.offsetFrom([]), null, '표본 없음');
    eq(C.offsetFrom([1.7, 1.62, 1.61, 1.6, 1.61]), 1.61, '재생 시작이 늦은 첫 표본에 끌려가지 않는다');
    eq(C.shiftClip({ start: 2.5, hz: 30 }, 1.7).start, 0.8, '좌표 시작');
    var same = { start: 2.5 }; ok(C.shiftClip(same, 0) === same, 'offset 0 이면 그대로');
    var r = C.shiftRange({ start: 2, end: 5 }, 1.7);
    ok(Math.abs(r.start - 0.3) < 1e-9 && Math.abs(r.end - 3.3) < 1e-9, '구간');
    eq(C.shiftRange(null, 1), null, '구간 없음');
  });

  test('파일 자리 · 형식: <내 id>/<기록 id>.webm|mp4 · codecs 는 뗀다', async function () {
    eq(S.videoPath('u-1', 77, 'video/webm;codecs=vp9'), 'u-1/77.webm', 'webm');
    eq(S.videoPath('u-1', 77, 'video/mp4;codecs=avc1'), 'u-1/77.mp4', 'mp4');
    eq([S.baseType('video/mp4'), S.baseType('video/webm;codecs=vp8'), S.baseType('')], ['video/mp4', 'video/webm', 'video/webm'], 'baseType');
  });

  test('나중에 올라온 영상: 이미 받은 기록에 영상 표시를 붙인다 · 이미 있으면 그대로', async function () {
    var cv = { path: 'u/1.webm', type: 'video/webm', size: 1, offset: 1.2 };
    var local = [{ id: 1, metrics: {}, hasData: true }, { id: 2, metrics: {}, cloudVideo: cv }, { id: 3, metrics: {} }];
    var rows = [{ entry_id: '1', entry: { id: 1, cloudVideo: cv }, deleted: false, has_clip: 30 }, { entry_id: '2', entry: { id: 2, cloudVideo: cv }, deleted: false, has_clip: null },
      { entry_id: '3', entry: {}, deleted: true, has_clip: null }];
    var p = S.planSync(local, rows);
    eq(p.patch, [{ id: 1, cloudVideo: cv, dropVideo: false }], 'patch');
    var cv2 = { path: 'u/2-x1.webm', type: 'video/webm', size: 500000 };
    var p2 = S.planSync([{ id: 2, metrics: {}, cloudVideo: cv, video: { sig: 'cloud:2' } }], [{ entry_id: '2', entry: { id: 2, cloudVideo: cv2 }, deleted: false, has_clip: 1 }]);
    eq(p2.patch, [{ id: 2, cloudVideo: cv2, dropVideo: true }], '다시 보낸 영상: 표시를 바꾸고 받아 둔 영상은 버린다');
    eq(p.remove, [3], '지운 것은 patch 하지 않는다');
  });

  test('전에 저장한 기록 중 지금 영상을 보낼 수 있는 것: 이 기기 원본이 있고 아직 안 보낸 것만', async function () {
    var r = { start: 0, end: 3 };
    var log = [{ id: 1, hasData: true, range: r, video: { sig: 'a|1|2' } }, { id: 2, hasData: true, range: r, video: { sig: 'cloud:2' } },
      { id: 3, hasData: true, range: r, video: { sig: 'b|1|2' }, cloudVideo: { path: 'u/3.webm' } }, { id: 4, hasData: true, range: r, video: null }, { id: 5, hasData: false, range: r, video: { sig: 'c' } }];
    eq(S.unsentVideos(log).map(function (e) { return e.id; }), [1], '1 만');
  });

  test('빈 영상: 작은 파일 · 장면 부족을 실패로 보고, 빈 파일이 올라간 기록은 다시 보낼 목록에 넣는다', async function () {
    eq([S.brokenCloudVideo({ size: 110 }), S.brokenCloudVideo({ size: 400000 }), S.brokenCloudVideo(null), S.brokenCloudVideo({})], [true, false, false, false], 'brokenCloudVideo');
    eq([C.enoughFrames(0, 2.7), C.enoughFrames(5, 2.7), C.enoughFrames(13, 2.7), C.enoughFrames(80, 2.7)], [false, false, true, true], 'enoughFrames(초당 5장 이상)');
    eq(S.videoPath('u', 9, 'video/webm', 'abc'), 'u/9-abc.webm', '다시 보낼 때 꼬리표');
    var r = { start: 0, end: 3 };
    var log = [{ id: 1, hasData: true, range: r, video: { sig: 'a' }, cloudVideo: { path: 'u/1.webm', size: 110 } }, { id: 2, hasData: true, range: r, video: { sig: 'b' }, cloudVideo: { path: 'u/2.webm', size: 400000 } }];
    eq(S.unsentVideos(log).map(function (e) { return e.id; }), [1], '빈 파일만 다시');
  });

  test('저장 한도: 100개 · 100MB(sql/20 과 같은 숫자) · 사용량 문장 · 서버가 막은 오류 알아보기', async function () {
    eq(S.VIDEO_QUOTA, { count: 100, bytes: 100000000 }, '한도');
    eq([S.hasRoom({ count: 99, bytes: 5e6 }), S.hasRoom({ count: 100, bytes: 5e6 }), S.hasRoom({ count: 3, bytes: 100000000 }), S.hasRoom(null)], [true, false, false, true], 'hasRoom(모르면 막지 않는다)');
    eq(S.usageText({ count: 8, bytes: 7600000 }), '영상 8개 · 7.6MB / 100MB', 'usageText');
    eq([S.isQuotaError({ statusCode: '403', message: 'x' }), S.isQuotaError({ message: 'new row violates row-level security policy' }), S.isQuotaError(new Error('network')), S.isQuotaError(null)], [true, true, false, false], 'isQuotaError');
  });

  test('올릴 칸: 영상 표시(cloudVideo)는 올리고, 이 기기 영상 정보(video)는 올리지 않는다', async function () {
    var c = S.toCloudEntry({ id: 5, metrics: {}, video: { sig: 'cloud:5', offset: 1 }, cloudVideo: { path: 'u/5.webm' } });
    eq([c.video, c.cloudVideo && c.cloudVideo.path], [undefined, 'u/5.webm'], 'toCloudEntry');
  });
})();
