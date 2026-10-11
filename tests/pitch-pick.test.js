// 분석 → 투수 → 코스 '위치' 구역 선택 검증 (js/features/pitcher.js _bindPlot / _pickHtml)
//  · 차트를 드래그하면 그 구역의 공만 골라 카드에 보여주고, 카운트는 공 순서로 다시 센 '던지기 직전' 카운트
//  · 점 하나를 탭하면 그 공(겹친 점 포함)만, 빈 곳을 탭하거나 ✕ 를 누르면 선택 해제
//  · 투구가 새로 기록돼 화면이 다시 그려져도 고른 구역은 유지
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;

  // viewBox(0~100 × 0~120) 좌표 → 화면 좌표
  function at(svg, x, y) {
    var m = svg.getScreenCTM(), p = svg.createSVGPoint();
    p.x = x; p.y = y;
    p = p.matrixTransform(m);
    return { clientX: p.x, clientY: p.y };
  }
  function ptr(svg, type, xy) {
    svg.dispatchEvent(new PointerEvent(type, Object.assign({ bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', button: 0 }, xy)));
  }
  function drag(x0, y0, x1, y1) {
    var svg = $('pcPlot');
    ptr(svg, 'pointerdown', at(svg, x0, y0));
    ptr(svg, 'pointermove', at(svg, (x0 + x1) / 2, (y0 + y1) / 2));
    ptr(svg, 'pointerup', at(svg, x1, y1));
  }
  function card() {
    var b = document.querySelector('#pcPick .pc-pick-hd b');
    return {
      title: b ? b.textContent : null,
      on: document.querySelectorAll('#pcPlot [data-i].on').length,
      rows: Array.prototype.map.call(document.querySelectorAll('#pcPick .pc-pick-line'), function (el) { return Array.prototype.map.call(el.children, function (x) { return x.textContent; }).join(' '); })
    };
  }
  var pz = function (pt, result, x, y) { return { id: 'pk' + Math.random(), inning: '1회초', zone: null, zoneX: x, zoneY: y, pt: pt, result: result, batter: '가타자', ts: '' }; };

  test('투수 코스: 드래그한 구역의 공 · 던지기 직전 카운트 · 탭 · 해제 · 다시 그려도 유지', async function () {
    var S = { pitchers: AS.pitchers, cp: AS.currentPitcher, ap: $('app-page').style.display };
    try {
      AS.pitchers = [{ id: 'pk1', name: '구역투수', num: '9', role: null, pitches: [
        pz('직구', '볼', 0.30, 0.30), pz('커브', '스트라이크', 0.36, 0.36), pz('직구', '파울', 0.70, 0.70), pz('슬라이더', '삼진', 0.72, 0.72)
      ] }];
      AS.currentPitcher = AS.pitchers[0];
      shellNav('analysis', 'pitcher');
      setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '구역투수'); setPitcherView('zone', 'plot');
      ok($('pcPlot'), '위치 차트');
      eq(card().title, null, '처음엔 안내만');

      // 오른쪽 아래(공 3 · 4)만 드래그
      drag(65, 78, 80, 95);
      var c = card();
      eq(c.title, '고른 구역 · 2구', '고른 공 수'); eq(c.on, 2, '차트에서 강조된 점');
      eq(c.rows, ['슬라이더 1-2 카운트 삼진', '직구 1-1 카운트 파울'], '최근 공부터 · 던지기 직전 카운트');
      ok(document.querySelectorAll('#pcPick .pc-seq')[0].querySelectorAll('.pq').length === 4, '타석의 공 순서 4개');

      // 새 공이 기록돼 다시 그려져도(구역 밖 공) 선택 유지
      AS.pitchers[0].pitches.push(pz('직구', '볼', 0.20, 0.20));
      openPitcherView();
      eq(card().title, '고른 구역 · 2구', '다시 그려도 유지');

      // 점 하나 탭 → 그 공만
      drag(30, 36, 30, 36);
      c = card();
      eq(c.title, '고른 구역 · 1구', '탭한 공'); eq(c.rows, ['직구 0-0 카운트 볼'], '초구 볼');

      // 빈 곳 탭 → 해제
      drag(95, 5, 95, 5);
      eq(card().title, null, '빈 곳 탭 = 해제');

      // ✕ 로 해제
      drag(0, 0, 100, 120);
      eq(card().title, '고른 구역 · 5구', '전체 드래그');
      document.querySelector('#pcPick .pc-pick-x').click();
      eq(card().title, null, '✕ = 해제'); eq(card().on, 0, '강조 해제');
    } finally {
      AS.pitchers = S.pitchers; AS.currentPitcher = S.cp;
      setPitcherView('scope', 'season');
      try { shellNav('record'); } catch (e) {}
      $('app-page').style.display = S.ap;
    }
  });
})();
