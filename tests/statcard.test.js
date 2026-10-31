// 성적 카드 3종 (js/features/statcard.js) — core.js _drawCard 를 바꿔 낀 새 그림: 개인 · 팀 · 시즌 · 빈 상태 · GAME REPORT 이미지(pgExport)
//  · 글꼴은 Noto Sans KR · Oswald 둘만 (fillText 마다) · 크기(개인 · 시즌 1080×1920, 팀 1080×1080) · 빈 캔버스가 아님 · 데이터 글자(이름 · 상대 · 결과 · 결과 약어 · 배지 · 지표 · 전적)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var CTX = CanvasRenderingContext2D.prototype;
  var pa = function (bid, bname, bnum, team, inn, res, more) { return Object.assign({ id: Math.random(), bid: bid, bname: bname, bnum: bnum, team: team, inn: inn, res: res, rbi: 0, x: null, y: null, dir: null }, more || {}); };

  async function isolated(fn) {
    var a = { abs: AS.abs, hs: AS.hs, as: AS.as, batter: AS.batter }, th = $('tHome').value, ta = $('tAway').value,
      bid = window._cardBid, type = window._cardType, rsg = window._readSavedGames;
    try { await fn(); }
    finally {
      closeCardPreview();
      AS.abs = a.abs; AS.hs = a.hs; AS.as = a.as; AS.batter = a.batter;
      $('tHome').value = th; $('tAway').value = ta;
      window._cardBid = bid; window._cardType = type; window._readSavedGames = rsg;
    }
  }
  // 그리는 동안 fillText 를 모두 기록 (글꼴 · 글자)
  async function drawn(fn) {
    var out = [], orig = CTX.fillText;
    CTX.fillText = function (t) { out.push({ font: this.font, t: String(t), cv: this.canvas }); return orig.apply(this, arguments); };
    try { await fn(); } finally { CTX.fillText = orig; }
    return out;
  }
  // 글꼴 첫 이름이 Noto Sans KR · Oswald 가 아닌 호출
  function badFonts(calls) {
    return calls.filter(function (c) {
      var fam = (/\d(?:\.\d+)?px\s+(.+)$/.exec(c.font) || [])[1] || '';
      var first = fam.split(',')[0].trim().replace(/^["']|["']$/g, '');
      return first !== 'Noto Sans KR' && first !== 'Oswald';
    }).map(function (c) { return c.font + ' «' + c.t + '»'; });
  }
  // 캔버스가 비지 않았는지: 픽셀 색이 여럿이고 밝은 글자 픽셀이 있다
  function painted(cv) {
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, colors = {}, bright = 0, n = 0;
    for (var i = 0; i < d.length; i += 4 * 13) {
      n++; colors[d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ',' + d[i + 3]] = 1;
      if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] > 600) bright++;
    }
    return { colors: Object.keys(colors).length, bright: bright / n };
  }
  function check(cv, w, h, label) {
    eq([cv.width, cv.height], [w, h], label + ' 크기');
    var p = painted(cv);
    // 밝은 픽셀 양은 깔린 글꼴에 따라 다르다(CI 에는 한글 글꼴이 없어 빈 카드가 .0017) → 있기만 하면 된다. 글자 내용은 fillText 로 따로 본다
    ok(p.colors > 60 && p.bright > 0, label + ' 그림이 비었다: ' + JSON.stringify(p));
  }
  var has = function (calls, t) { return calls.some(function (c) { return c.t === t; }); };
  var text = function (calls) { return calls.map(function (c) { return c.t; }).join('|'); };

  test('성적 카드: 개인 · 팀 · 시즌 — 글꼴은 Noto Sans KR · Oswald 만 · 크기 · 데이터 글자', async function () {
    await isolated(async function () {
      $('tHome').value = '테스트팀'; $('tAway').value = '미래팀';
      AS.hs = 5; AS.as = 3; AS.batter = null;
      AS.abs = [
        pa('t1', '김테스트', '7', 'home', '1회초', '안타', { x: 0.3, y: 0.55, dir: 'LF', deg: 40 }),
        pa('t2', '이타자', '12', 'home', '1회초', '땅볼 아웃', { x: 0.55, y: 0.85, dir: 'CF', deg: 95 }),
        pa('t1', '김테스트', '7', 'home', '3회초', '홈런', { x: 0.5, y: 0.04, dir: 'CF', deg: 90, rbi: 2 }),
        pa('a1', '원정일', '1', 'away', '3회말', '2루타', { x: 0.8, y: 0.4, dir: 'RC', deg: 120 }),
        pa('t1', '김테스트', '7', 'home', '5회초', '삼진', { fp: 'F8' }),
        pa('t1', '김테스트', '7', 'home', '7회초', '볼넷'),
      ];
      window._readSavedGames = function () {
        return [
          { th: '테스트팀', ta: '가팀', hs: 5, as: 3, abs: AS.abs.slice() },
          { th: '나팀', ta: '테스트팀', hs: 2, as: 2, abs: [] },
          { th: '테스트팀', ta: '다팀', hs: 1, as: 4, abs: [] },
          { th: '다른팀', ta: '라팀', hs: 9, as: 0, abs: [] },
        ];
      };
      window._cardBid = 't1';
      var cv = $('cardPreviewCanvas');

      var calls = await drawn(async function () { openCardPreview(); await window._drawCard(); });
      ok($('cardPreviewOv').classList.contains('show'), '미리보기 창 열림');
      eq(window._cardType, 'personal', '처음엔 개인 카드');
      check(cv, 1080, 1920, '개인');
      eq(badFonts(calls), [], '개인 카드 글꼴');
      ['김테스트', '미래팀', '테스트팀', '홈런', '좌전 안타', '중월 홈런', '삼진', '볼넷', '타구 위치', '타석', '.667', '@spraylab2026'].forEach(function (t) {
        ok(has(calls, t), '개인 카드에 「' + t + '」 없음 — ' + text(calls).slice(0, 400));
      });
      ok(/3\|타수\|2\|안타\|1\|홈런\|2\|타점\|1\|볼넷/.test(text(calls)), '한 줄 성적 3타수 2안타 1홈런 2타점 1볼넷');
      // 타석 줄 오른쪽 결과 약어 (안타 1B · 홈런 HR · 삼진 K · 볼넷 BB). 수비 기록 a.fp 는 땅볼 · 뜬공 · 라인드라이브 아웃에만 — 삼진에 남은 값은 무시
      ['1B', 'HR', 'K', 'BB'].forEach(function (t) { ok(has(calls, t), '결과 약어 「' + t + '」 없음'); });
      ok(!has(calls, 'F8'), '삼진 줄에 수비 기록이 찍힘');

      calls = await drawn(async function () { switchCardType('team', $('cptTeam')); await window._drawCard(); });
      check(cv, 1080, 1080, '팀');
      eq(badFonts(calls), [], '팀 카드 글꼴');
      ['테스트팀', '미래팀', '팀 기록', '오늘의 타자', '김테스트', '5', '3'].forEach(function (t) { ok(has(calls, t), '팀 카드에 「' + t + '」 없음'); });
      ok(has(calls, _cardDate()), '팀 카드에 날짜 없음');
      eq($('cardPlayerSel').style.display, 'none', '팀 카드에선 선수 고르기 숨김');

      calls = await drawn(async function () { switchCardType('season', $('cptSeason')); await window._drawCard(); });
      check(cv, 1080, 1920, '시즌');
      eq(badFonts(calls), [], '시즌 카드 글꼴');
      ok(/1\|승\|1\|무\|1\|패/.test(text(calls)), '전적 1승 1무 1패 (테스트팀이 낀 3경기만)');
      ['시즌 기록', '시즌 타구', '.500', 'wOBA'].forEach(function (t) { ok(has(calls, t), '시즌 카드에 「' + t + '」 없음'); });
      ok(has(calls, '3') && has(calls, '경기'), '경기 수');
    });
  });

  test('성적 카드: 빈 상태 — 타석 0 · 저장 경기 0 이면 안내 문구를 그린다 (글꼴 · 크기 그대로)', async function () {
    await isolated(async function () {
      AS.abs = []; AS.hs = 0; AS.as = 0; AS.batter = null;
      window._readSavedGames = function () { return []; };
      var cv = $('cardPreviewCanvas');
      var calls = await drawn(async function () { openCardPreview(); await window._drawCard(); });
      check(cv, 1080, 1920, '빈 개인');
      ok(has(calls, '아직 기록된 타석이 없어요') && has(calls, '타석을 기록하면 선수 카드가 만들어져요'), '개인 빈 상태 문구');
      eq(badFonts(calls), [], '빈 개인 글꼴');
      calls = await drawn(async function () { switchCardType('team', $('cptTeam')); await window._drawCard(); });
      check(cv, 1080, 1080, '빈 팀');
      ok(has(calls, '아직 안타 기록이 없어요'), '팀 빈 상태 문구');
      calls = await drawn(async function () { switchCardType('season', $('cptSeason')); await window._drawCard(); });
      check(cv, 1080, 1920, '빈 시즌');
      ok(has(calls, '저장된 경기가 없어요') && has(calls, '경기를 저장하면 시즌 기록이 쌓여요'), '시즌 빈 상태 문구');
      eq(badFonts(calls), [], '빈 시즌 글꼴');
    });
  });

  // GAME REPORT 이미지: pgExport 는 다 그린 캔버스를 _downloadCanvas 로 넘긴다 — 가로채서 크기 · 글꼴 · 글자를 본다
  async function report(W, H, mode) {
    var dl = window._downloadCanvas, cv = null, calls;
    window._downloadCanvas = function (c) { cv = c; };
    try { calls = await drawn(async function () { pgExport(W, H, mode); for (var i = 0; i < 80 && !cv; i++) await T.sleep(50); }); }
    finally { window._downloadCanvas = dl; }
    ok(cv, mode + ' 이미지를 만들지 않음');
    return { cv: cv, calls: calls.filter(function (c) { return c.cv === cv; }) };   // 내보낸 캔버스에 그린 것만 (기다리는 사이 앱의 다른 캔버스 제외)
  }

  test('GAME REPORT 이미지: 스토리 1080×1920 · 피드 1080×1080 — 글꼴 · 점수 · 팀 이름 · 날짜 · 지표 · 코멘트', async function () {
    var keepNote = $('pgAITxt').textContent;
    try {
      await isolated(async function () {
        $('tHome').value = '테스트팀'; $('tAway').value = '미래팀';
        AS.hs = 7; AS.as = 12; AS.batter = null;
        AS.abs = [
          pa('t1', '김테스트', '7', 'home', '1회초', '안타', { x: 0.3, y: 0.55, dir: 'LF', deg: 40 }),
          pa('t1', '김테스트', '7', 'home', '3회초', '홈런', { x: 0.5, y: 0.04, dir: 'CF', deg: 90, rbi: 2 }),
          pa('t2', '이타자', '12', 'home', '5회초', '삼진'),
          pa('t2', '이타자', '12', 'home', '7회초', '볼넷'),
        ];
        var memo = '첫 문장입니다. 둘째 문장은 조금 더 길게 써서 코멘트 칸에서 줄이 나뉘게 합니다.';
        $('pgAITxt').textContent = memo;
        for (const [W, H, mode] of [[1080, 1920, 'story'], [1080, 1080, 'feed']]) {
          var r = await report(W, H, mode);
          check(r.cv, W, H, mode);
          eq(badFonts(r.calls), [], mode + ' 글꼴');
          // 팀 타율 = 안타 2 / (볼넷 뺀 3타석) · 안타 2 · 타점 2 · 삼진 1
          ['경기 리포트', _pgDate(), '테스트팀', '미래팀', '7', '12', '팀 타율', '.667', '삼진', '@spraylab2026'].forEach(function (t) {
            ok(has(r.calls, t), mode + ' 이미지에 「' + t + '」 없음 — ' + text(r.calls).slice(0, 300));
          });
          var all = ' ' + text(r.calls).replace(/\|/g, ' ') + ' ';
          ok(memo.split(' ').every(function (w) { return all.indexOf(' ' + w + ' ') >= 0; }), mode + ' 코멘트를 다 그리지 않음');
        }
        $('pgAITxt').textContent = '';
        check((await report(1080, 1080, 'feed')).cv, 1080, 1080, '피드 (코멘트 없음)');
      });
    } finally { $('pgAITxt').textContent = keepNote; }
  });
})();
