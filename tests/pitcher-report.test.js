// 분석 → 투수 → 투수 리포트 이미지 검증 (js/features/pitcher.js _reportBtn / savePitcherReport)
//  · 맨 위 카드 바로 아래 버튼(44px) · 1080×1350 PNG · 카운트별 구종 막대가 카드와 같은 첫 구종 색 · 위치 없는 투수도 저장됨
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var pz = function (batter, pt, result, x, y) { return { id: 'pr' + Math.random(), inning: '1회초', zone: null, zoneX: x, zoneY: y, pt: pt, result: result, batter: batter, ts: '' }; };
  function px(cv, x, y) { var d = cv.getContext('2d').getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; }
  function near(cv, rgb) {
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, n = 0;
    for (var i = 0; i < d.length; i += 4) if (Math.abs(d[i] - rgb[0]) < 12 && Math.abs(d[i + 1] - rgb[1]) < 12 && Math.abs(d[i + 2] - rgb[2]) < 12) n++;
    return n;
  }

  test('투수 리포트: 버튼 위치 · 1080×1350 · 카운트별 구종 막대 색 · 구종 색 점 · 위치 없는 투수도 저장', async function () {
    var S = { pitchers: AS.pitchers, cp: AS.currentPitcher, ap: $('app-page').style.display, dl: window._downloadCanvas };
    var open = function (pitches) {
      AS.pitchers = [{ id: 'pr1', name: '리포트투수', num: '19', role: null, pitches: pitches }];
      AS.currentPitcher = AS.pitchers[0];
      shellNav('analysis', 'pitcher');
      setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '리포트투수');
    };
    var cv = null, name = '';
    window._downloadCanvas = function (c, n) { cv = c; name = n; };
    try {
      open([
        // 카운트별 구종 테스트와 같은 13구: 전체 첫 칸 = 직구 · 2스트라이크 = 슬라이더 100%
        pz('가타자', '직구', '볼', .3, .3), pz('가타자', '슬라이더', '스트라이크', .7, .8), pz('가타자', '직구', '볼', .35, .3), pz('가타자', '커브', '파울', .5, .85), pz('가타자', '슬라이더', '삼진', .75, .8),
        pz('나타자', '직구', '스트라이크', .5, .4), pz('나타자', '직구', '헛스윙', .55, .35), pz('나타자', '슬라이더', '볼', .8, .85), pz('나타자', '슬라이더', '안타', .65, .7),
        pz('다타자', '커브', '볼', .45, .9), pz('다타자', '', '볼', .5, .5), pz('다타자', '직구', '볼', .2, .3), pz('다타자', '직구', '볼넷', .25, .2)
      ]);
      var btn = document.querySelector('#pitcherView .pc-rep-save');
      ok(btn, '리포트 버튼');
      ok(btn.previousElementSibling && btn.previousElementSibling.classList.contains('pc-hero'), '맨 위 카드 바로 아래');
      ok(btn.getBoundingClientRect().height >= 44, '버튼 44px');

      await savePitcherReport();
      ok(cv, '저장 캔버스');
      eq([cv.width, cv.height], [1080, 1350], '인스타 피드 4:5');
      ok(/^spraylab_pitcherreport_\d+\.png$/.test(name), '파일 이름 ' + name);
      // 막대: x = (24 + 96 + 6) × 2 · 전체 줄 y = (240 + 14) × 2 · 2스트라이크 줄 y = (240 + 4 × 30 + 14) × 2
      var close = function (a, b) { return Math.abs(a[0] - b[0]) < 8 && Math.abs(a[1] - b[1]) < 8 && Math.abs(a[2] - b[2]) < 8; };
      ok(close(px(cv, 252, 508), [75, 140, 245]), '전체 줄 첫 칸 = 직구 파랑 ' + px(cv, 252, 508));
      ok(close(px(cv, 252, 748), [246, 194, 62]), '2스트라이크 줄 = 슬라이더 노랑 ' + px(cv, 252, 748));
      ok(near(cv, [167, 139, 250]) > 300, '커브 보라 (막대 · 범례 · 점) ' + near(cv, [167, 139, 250]));

      // 위치가 없는 투수: 리포트는 그대로 저장 (위치 칸만 안내 문구)
      cv = null;
      open([pz('가타자', '직구', '볼', null, null), pz('가타자', '직구', '볼넷', null, null)]);
      await savePitcherReport();
      ok(cv && cv.width === 1080, '위치 없는 투수도 저장');
      ok(close(px(cv, 252, 508), [75, 140, 245]), '막대는 그대로');
    } finally {
      window._downloadCanvas = S.dl;
      AS.pitchers = S.pitchers; AS.currentPitcher = S.cp;
      setPitcherView('scope', 'season');
      try { window.hideToast && hideToast(); } catch (e) {}
      try { shellNav('record'); } catch (e) {}
      $('app-page').style.display = S.ap;
    }
  });
})();
