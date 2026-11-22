// 동작 분석 — 화면 녹화로 가져오기 (js/motion/capture.js)
//  · 실제 화면 공유는 사람이 창에서 골라야 해서 여기서는 그 앞뒤의 계산과, 길이 정보가 없는 영상의 길이를 알아내는 흐름만 본다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;
  var C;
  // 길이를 모르는 영상 흉내: currentTime 을 끝으로 보내면 duration 이 정해지고 durationchange 가 온다
  function fakeVideo(finalDuration) {
    var v = new EventTarget(), time = 0;
    v.duration = Infinity;
    Object.defineProperty(v, 'currentTime', { get: function () { return time; }, set: function (t) {
      time = t;
      if (t > 1e100 && finalDuration !== null) setTimeout(function () { v.duration = finalDuration; time = finalDuration; v.dispatchEvent(new Event('durationchange')); }, 0);
    } });
    return v;
  }

  test('(준비) 화면 녹화 모듈을 불러온다', async function () {
    C = await import('/js/motion/capture.js?v=1');
    ok(C.canCapture && C.chooseMime && C.captureName && C.clock && C.startCapture && C.settleDuration, '모듈 로드');
  });

  test('지원 확인: 화면 공유와 녹화 도구가 둘 다 있어야 한다', async function () {
    var share = { mediaDevices: { getDisplayMedia: function () {} } };
    eq([C.canCapture(share, { MediaRecorder: function () {} }), C.canCapture(share, {}), C.canCapture({ mediaDevices: {} }, { MediaRecorder: function () {} }), C.canCapture({}, { MediaRecorder: function () {} })], [true, false, false, false], 'canCapture');
  });

  test('녹화 형식: 지원하는 첫 형식을 고르고, 하나도 없으면 브라우저 기본값에 맡긴다', async function () {
    eq(C.chooseMime(function () { return true; }), 'video/webm;codecs=vp9', '전부 지원');
    eq(C.chooseMime(function (m) { return m === 'video/webm' || m === 'video/mp4'; }), 'video/webm', 'WebM 먼저');
    eq(C.chooseMime(function (m) { return m === 'video/mp4'; }), 'video/mp4', 'MP4 만');
    eq(C.chooseMime(function () { return false; }), '', '없음');
  });

  test('파일 이름 · 시간 표시', async function () {
    var d = new Date(2026, 10, 2, 9, 5, 7);
    eq(C.captureName(d, 'video/webm;codecs=vp9'), '화면녹화-20261102-090507.webm', 'WebM');
    eq(C.captureName(d, 'video/mp4'), '화면녹화-20261102-090507.mp4', 'MP4');
    eq(C.captureName(d, ''), '화면녹화-20261102-090507.webm', '형식을 모르면 WebM');
    eq([C.clock(0), C.clock(7.9), C.clock(60), C.clock(75.2)], ['0:00', '0:07', '1:00', '1:15'], 'clock');
    ok(C.MIN_CAPTURE_S < C.MAX_CAPTURE_S, '최소 · 최대 길이');
  });

  test('길이 알아내기: 이미 알면 그대로, 모르면 끝으로 보냈다가 처음으로 돌려놓는다', async function () {
    var known = { duration: 4.2, currentTime: 1.5 };
    eq(await C.settleDuration(known), true, '이미 아는 길이');
    eq(known.currentTime, 1.5, '재생 위치를 건드리지 않는다');
    var v = fakeVideo(6.5);
    eq(await C.settleDuration(v), true, '길이를 알아냄');
    eq([v.duration, v.currentTime], [6.5, 0], '길이 · 처음으로 되돌림');
  });
})();
