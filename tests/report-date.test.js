// GAME REPORT 날짜 = 경기 날짜(AS.info.date — 리그 기록지와 같은 날) · 이미지 공유 제목 · 워터마크 = SprayLab (core.js _pgDate · pgExport · _downloadCanvas · exportSprayPNG)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var L = function (y, m, d) { return new Date(y, m - 1, d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }); };

  async function withInfo(info, fn) {
    var keep = AS.info; AS.info = info;
    try { await fn(); }
    finally { AS.info = keep; $('pgReport').style.display = 'none'; $('pgCard').classList.remove('up'); }
  }
  // 이미지를 만드는 동안 fillText 로 그린 글자를 모은다 (저장 · 공유는 막는다)
  async function drawn(run) {
    var ft = CanvasRenderingContext2D.prototype.fillText, dl = window._downloadCanvas, out = [], got = false;
    CanvasRenderingContext2D.prototype.fillText = function (t) { out.push(String(t)); return ft.apply(this, arguments); };
    window._downloadCanvas = function () { got = true; };
    var errs = [], onE = function (e) { errs.push(e.message); }; window.addEventListener('error', onE);
    try { run(); for (var i = 0; i < 60 && !got; i++) await T.sleep(50); ok(got, '이미지를 만들지 않음 ' + errs.join(' · ')); }
    finally { window.removeEventListener('error', onE); CanvasRenderingContext2D.prototype.fillText = ft; window._downloadCanvas = dl; }
    return out;
  }

  test('GAME REPORT 날짜: 경기 정보 날짜(2026-10-07)가 있으면 그날 · 없거나 형식이 다르면 오늘', async function () {
    await withInfo({ date: '2026-10-07' }, async function () {
      showPostGameReport();
      eq($('pgDate').textContent, L(2026, 10, 7), '지난 경기를 다시 열어도 그 경기 날짜');
    });
    var n = new Date(), today = L(n.getFullYear(), n.getMonth() + 1, n.getDate());
    for (const info of [null, {}, { date: '' }, { date: '2026.10.07' }]) {
      await withInfo(info, async function () { showPostGameReport(); eq($('pgDate').textContent, today, JSON.stringify(info) + ' → 오늘'); });
    }
  });

  test('GAME REPORT 이미지(피드 1:1)에도 경기 날짜가 그려진다', async function () {
    await withInfo({ date: '2026-10-07' }, async function () {
      var t = await drawn(function () { pgExport(1080, 1080, 'feed'); });
      ok(t.indexOf(L(2026, 10, 7)) >= 0, '피드 이미지에 경기 날짜 없음: ' + t.join(' | '));
    });
  });

  test('이미지 공유 제목 · 스프레이차트 워터마크 = SprayLab (옛 이름 Baseball Spray Chart 없음)', async function () {
    var t = await drawn(function () { exportSprayPNG(); });
    ok(t.indexOf('SprayLab') >= 0 && t.indexOf('Baseball Spray Chart') < 0, '워터마크: ' + t.join(' | '));
    var got = null, shared = new Promise(function (r) { navigator.share = function (d) { got = d; r(); return Promise.resolve(); }; });
    navigator.canShare = function () { return true; };
    try {
      var c = document.createElement('canvas'); c.width = c.height = 4;
      _downloadCanvas(c, 't.png');   // toBlob 은 타이머가 아니라서 기다리는 횟수로 세지 않고 공유 호출을 기다린다
      await Promise.race([shared, T.sleep(20000)]);
    } finally { delete navigator.share; delete navigator.canShare; }
    ok(got, '공유를 부르지 않음');
    eq(got.title, 'SprayLab', '공유 제목');
  });
})();
