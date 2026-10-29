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

  // 이미지에 그린 글자 · 그림의 사각형을 모은다 (그 크기의 캔버스만, 이미지 픽셀 기준) — 겹치거나 밖으로 나간 것을 찾는다
  async function boxes(W, H, mode) {
    var P = CanvasRenderingContext2D.prototype, ft = P.fillText, di = P.drawImage, dl = window._downloadCanvas, out = [], got = false;
    var mine = function (cx) { return cx.canvas.width === W && cx.canvas.height === H; };
    P.fillText = function (t, x, y) {
      if (mine(this)) {
        var m = this.measureText(t), a = this.textAlign, l = a === 'center' ? x - m.width / 2 : (a === 'right' || a === 'end') ? x - m.width : x;
        // 이미지 픽셀로 바꿔 잰다 (statcard.js 는 540 기준 좌표에 배율 변환을 걸고 그린다)
        var M = this.getTransform(), X = function (v) { return M.a * v + M.e; }, Y = function (v) { return M.d * v + M.f; };
        out.push({ k: String(t).trim(), l: X(l), r: X(l + m.width), t: Y(y - m.actualBoundingBoxAscent), b: Y(y + m.actualBoundingBoxDescent) });
      }
      return ft.apply(this, arguments);
    };
    P.drawImage = function (img, x, y) {
      if (mine(this) && arguments.length === 3) out.push({ k: '(필드 그림)', l: x, r: x + img.width, t: y, b: y + img.height });
      return di.apply(this, arguments);
    };
    window._downloadCanvas = function () { got = true; };
    try { pgExport(W, H, mode); for (var i = 0; i < 60 && !got; i++) await T.sleep(50); ok(got, '이미지를 만들지 않음'); }
    finally { P.fillText = ft; P.drawImage = di; window._downloadCanvas = dl; }
    return out.filter(function (b) { return b.k; });
  }

  test('스토리 9:16 · 피드 1:1 이미지: 글자와 필드 그림이 서로 겹치거나 붙지 않고(12px) 이미지 밖으로 나가지 않는다 (코멘트 두 문장 · 세 줄)', async function () {
    var keep = { abs: AS.abs, hs: AS.hs, as: AS.as, th: $('tHome').value, ta: $('tAway').value };
    var pa = function (id, res, deg) { return { id: id, bid: 'b' + id, bname: '타자' + id, bnum: '', team: 'away', inn: '1회초', res: res, rbi: 0, x: deg == null ? null : .3, y: .3, deg: deg == null ? null : deg, dir: deg == null ? null : 'LF' }; };
    try {
      // 코멘트가 가장 긴 조합: 팀 타율 .400 이상 + 승리 문장
      AS.abs = [pa(1, '안타', 30), pa(2, '안타', 120), pa(3, '삼진'), pa(4, '볼넷')]; AS.hs = 7; AS.as = 3;
      $('tHome').value = '우진스나이퍼'; $('tAway').value = '팀에이스';
      await withInfo({ date: '2026-10-07' }, async function () {
        showPostGameReport();
        ok($('pgAITxt').textContent.indexOf('승리') >= 0, '코멘트에 승리 문장이 없음: ' + $('pgAITxt').textContent);
        for (const [W, H, mode] of [[1080, 1920, 'story'], [1080, 1080, 'feed']]) {
          var bx = await boxes(W, H, mode), bad = [];
          bx.forEach(function (b, i) {
            if (b.l < 0 || b.t < 0 || b.r > W || b.b > H) bad.push('밖: ' + b.k + ' ' + JSON.stringify([Math.round(b.t), Math.round(b.b)]));
            bx.slice(i + 1).forEach(function (o) {
              // 가로로 겹치는 두 칸은 위아래로 12px 이상 떨어져야 한다 (붙어 있으면 겹쳐 보인다)
              if (Math.min(b.r, o.r) - Math.max(b.l, o.l) > 1 && Math.min(b.b, o.b) - Math.max(b.t, o.t) > -12) bad.push('겹침: ' + b.k + ' / ' + o.k + ' ' + Math.round(Math.max(b.t, o.t) - Math.min(b.b, o.b)) + 'px');
            });
          });
          ok(bx.length >= 12, mode + ' 글자를 다 모으지 못함: ' + bx.length);
          eq(bad, [], mode + ' ' + W + '×' + H);
        }
      });
    } finally { AS.abs = keep.abs; AS.hs = keep.hs; AS.as = keep.as; $('tHome').value = keep.th; $('tAway').value = keep.ta; }
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
