// 분석 → 투수 → 구종별 위치 검증 (js/features/pitcher.js _profileCard / saveProfileImage)
//  · 구종마다 작은 존 하나 · 많이 던진 구종부터 · 점 색 = 구종 · 고리 = 볼 · 마름모 = 피안타 · 숫자는 구종 구성 표와 같다
//  · 위치가 없는 구종 · 구종 미기록 공은 빠지고 안내 · 이미지 저장 = 1080×1350 PNG
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var pz = function (pt, result, x, y) { return { id: 'pf' + Math.random(), inning: '1회초', zone: null, zoneX: x, zoneY: y, pt: pt, result: result, batter: '가타자', ts: '' }; };
  function all(root, sel, f) { return Array.prototype.map.call(root.querySelectorAll(sel), f); }
  function near(cv, rgb) {
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, n = 0;
    for (var i = 0; i < d.length; i += 4) if (Math.abs(d[i] - rgb[0]) < 12 && Math.abs(d[i + 1] - rgb[1]) < 12 && Math.abs(d[i + 2] - rgb[2]) < 12) n++;
    return n;
  }

  test('구종별 위치: 구종마다 존 · 점 모양과 색 · 구종 구성과 같은 숫자 · 빠진 공 안내 · 이미지 저장', async function () {
    var S = { pitchers: AS.pitchers, cp: AS.currentPitcher, ap: $('app-page').style.display, dl: window._downloadCanvas };
    var open = function (pitches) {
      AS.pitchers = [{ id: 'pf1', name: '구종투수', num: '18', role: null, pitches: pitches }];
      AS.currentPitcher = AS.pitchers[0];
      shellNav('analysis', 'pitcher');
      setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '구종투수');
    };
    try {
      open([
        pz('직구', '볼', 0.30, 0.30), pz('직구', '안타', 0.50, 0.50), pz('직구', '스트라이크', 0.60, 0.40),
        pz('슬라이더', '삼진', 0.70, 0.80), pz('슬라이더', '볼', 0.75, 0.82),
        pz('커브', '파울', null, null),            // 위치 없음 → 칸 없음
        pz('', '스트라이크', 0.50, 0.50),         // 구종 미기록 → 칸 없음
        pz('<i>너클</i>', '볼', 0.40, 0.60)       // 이름은 글자 그대로
      ]);
      var card = $('pcProfile');
      ok(card, '구종별 위치 카드');
      ok(card.compareDocumentPosition($('pcReplay')) & Node.DOCUMENT_POSITION_FOLLOWING, '리플레이 위');
      var tiles = card.querySelectorAll('.pc-pf-tile');
      eq(all(card, 'figcaption', function (f) { return f.querySelector('b').textContent + '|' + f.querySelector('span').textContent; }),
        ['직구|38% · 3구', '슬라이더|25% · 2구', '<i>너클</i>|13% · 1구'], '많이 던진 구종부터 · 비율 = 전체 8구 기준');
      ok(!card.querySelector('figcaption i'), '구종 이름이 태그로 해석되지 않음');
      eq(all(tiles[0], 'svg > :is(circle, path):not(.pz-grid):not(.pz-plate)', function (el) { return el.getAttribute('class'); }), ['pf-ball', 'pf-on', 'pf-hit'], '직구 점: 볼 고리 · 스트라이크 · 피안타 마름모(위)');
      eq(all(tiles[1], '.pf-on, .pf-ball', function (el) { return el.getAttribute('class'); }), ['pf-ball', 'pf-on'], '슬라이더 점');
      eq([getComputedStyle(tiles[0].querySelector('.pf-on')).fill, getComputedStyle(tiles[0].querySelector('.pf-ball')).stroke, getComputedStyle(tiles[0].querySelector('.pf-ball')).fill,
        getComputedStyle(tiles[1].querySelector('.pf-on')).fill], ['rgb(75, 140, 245)', 'rgb(75, 140, 245)', 'none', 'rgb(246, 194, 62)'], '색 = 구종 (직구 파랑 · 슬라이더 노랑)');
      eq([all(tiles[0], 'small span', function (s) { return s.textContent; }), all(tiles[1], 'small span', function (s) { return s.textContent; })],
        [['S% 67%', '삼진 0', '피안타 1'], ['S% 50%', '삼진 1', '피안타 0']], '구종 구성 표와 같은 숫자');
      ok(/위치나 구종이 없는 공 2개는 점에서 빠짐/.test(card.textContent), '빠진 공 안내');
      ok(card.querySelector('.pc-pf-save').getBoundingClientRect().height >= 44, '저장 버튼 44px');

      // 이미지 저장: 1080×1350 · 구종 색 점
      var cv = null, name = '';
      window._downloadCanvas = function (c, n) { cv = c; name = n; };
      await saveProfileImage();
      ok(cv, '저장 캔버스');
      eq([cv.width, cv.height], [1080, 1350], '인스타 피드 4:5');
      ok(/^spraylab_pitchprofile_\d+\.png$/.test(name), '파일 이름 ' + name);
      ok(near(cv, [75, 140, 245]) > 300 && near(cv, [246, 194, 62]) > 300, '구종 색 점이 그려짐 ' + near(cv, [75, 140, 245]) + ' / ' + near(cv, [246, 194, 62]));

      // 위치가 하나도 없으면 카드 없음
      open([pz('직구', '볼', null, null), pz('커브', '스트라이크', null, null)]);
      ok(!$('pcProfile'), '위치 없는 투수는 카드 없음');
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
