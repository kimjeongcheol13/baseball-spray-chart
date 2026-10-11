// 분석 → 투수 → 코스 '위치' 구역 선택 검증 (js/features/pitcher.js _bindPlot / _pickHtml)
//  · 차트를 드래그하면 그 구역의 공만 골라 공 카드("구종 → 결과" · 던지기 직전 전광판 · 이 타석 흐름)로 보여준다
//  · 카운트는 공 순서로 다시 센 '던지기 직전' 값, 4구 이상이면 위에 한 줄 요약
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
  function all(sel, f) { return Array.prototype.map.call(document.querySelectorAll(sel), f); }
  function card() {
    var b = document.querySelector('#pcPick .pc-pick-hd b'), sub = document.querySelector('#pcPick .pc-pick-hd small'), facts = {};
    all('#pcPick .pc-facts div', function (el) { facts[el.querySelector('dt').textContent] = el.querySelector('dd').textContent; });
    return {
      title: b ? b.textContent : null,
      sub: sub ? sub.textContent : null,
      on: document.querySelectorAll('#pcPlot [data-i].on').length,
      // 공 카드 한 장 = "구종 → 결과 | 전광판(던지기 직전 …)"
      rows: all('#pcPick .pc-pc', function (el) {
        var hd = el.querySelector('.pc-pc-hd');
        return hd.querySelector('b').textContent + ' → ' + hd.querySelector('em').textContent + ' | ' + el.querySelector('.pc-sb').getAttribute('aria-label');
      }),
      facts: facts
    };
  }
  var pz = function (pt, result, x, y) { return { id: 'pk' + Math.random(), inning: '1회초', zone: null, zoneX: x, zoneY: y, pt: pt, result: result, batter: '가타자', ts: '' }; };

  test('투수 코스: 드래그한 구역의 공 카드 · 던지기 직전 카운트 · 탭 · 요약 · 해제 · 다시 그려도 유지', async function () {
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

      // 오른쪽 아래(공 3 · 4)만 드래그 → 공 카드 2장, 요약 없음
      drag(65, 78, 80, 95);
      var c = card();
      eq(c.title, '고른 공 2개', '고른 공 수'); eq(c.on, 2, '차트에서 강조된 점');
      eq(c.rows, ['슬라이더 → 삼진 | 던지기 직전 1볼 2스트라이크', '직구 → 파울 | 던지기 직전 1볼 1스트라이크'], '최근 공부터 · 던지기 직전 카운트');
      eq(c.facts, {}, '3구 이하는 요약 없음');
      eq(all('#pcPick .pc-pc:first-child .pc-flow-p', function (el) { return el.textContent; }),
        ['직구 볼', '커브 스트라이크', '직구 파울', '슬라이더 삼진'], '이 타석 흐름 (줄임말 없이)');
      eq(document.querySelector('#pcPick .pc-pc .pc-flow-p.cur').textContent, '슬라이더 삼진', '이 공 강조');

      // 새 공이 기록돼 다시 그려져도(구역 밖 공) 선택 유지
      AS.pitchers[0].pitches.push(pz('직구', '볼', 0.20, 0.20));
      openPitcherView();
      eq(card().title, '고른 공 2개', '다시 그려도 유지');

      // 점 하나 탭 → 그 공만
      drag(30, 36, 30, 36);
      c = card();
      eq([c.title, c.sub], ['고른 공 1개', '스트라이크존 안'], '탭한 공'); eq(c.rows, ['직구 → 볼 | 던지기 직전 0볼 0스트라이크'], '초구 볼');

      // 빈 곳 탭 → 해제
      drag(95, 5, 95, 5);
      eq(card().title, null, '빈 곳 탭 = 해제');

      // 전체 드래그 → 4구 이상이라 한 줄 요약
      drag(0, 0, 100, 120);
      c = card();
      eq(c.title, '고른 공 5개', '전체 드래그');
      eq(c.facts['구종'], '주로 직구 — 5구 중 3구 (커브 1 · 슬라이더 1)', '요약: 구종');
      eq(c.facts['삼진'], '1개 — 슬라이더 1', '요약: 삼진');
      eq(c.rows.length, 5, '공 카드 5장');
      // ✕ 로 해제
      document.querySelector('#pcPick .pc-pick-x').click();
      eq(card().title, null, '✕ = 해제'); eq(card().on, 0, '강조 해제');
    } finally {
      AS.pitchers = S.pitchers; AS.currentPitcher = S.cp;
      setPitcherView('scope', 'season');
      try { shellNav('record'); } catch (e) {}
      $('app-page').style.display = S.ap;
    }
  });

  // 아웃 · 주자: outs · runners 가 있는 공만 전광판에 O 점 · 주자 그림, 요약에 '아웃·주자' 줄. 없는 공(일반 모드 · 예전 기록)은 안 그리고 아래 한 줄 안내
  test('투수 코스: 고른 공의 아웃 · 주자 (경기 운영 모드 기록만) · 없으면 그리지 않고 안내', async function () {
    var S = { pitchers: AS.pitchers, cp: AS.currentPitcher, ap: $('app-page').style.display };
    var sit = function (p, o, r) { p.outs = o; p.runners = r; return p; };
    try {
      AS.pitchers = [{ id: 'pk2', name: '상황투수', num: '8', role: null, pitches: [
        sit(pz('직구', '볼', 0.30, 0.30), 0, [false, false, false]),
        sit(pz('직구', '스트라이크', 0.40, 0.40), 1, [true, false, true]),
        sit(pz('커브', '파울', 0.50, 0.50), 1, [true, false, true]),
        sit(pz('직구', '볼', 0.60, 0.60), null, null),
        pz('슬라이더', '볼', 0.70, 0.70)   // 필드 자체가 없는 예전 기록
      ] }];
      AS.currentPitcher = AS.pitchers[0];
      shellNav('analysis', 'pitcher');
      setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '상황투수'); setPitcherView('zone', 'plot');

      drag(0, 0, 100, 120);
      var c = card();
      eq(c.title, '고른 공 5개', '전체');
      eq(c.rows, [
        '슬라이더 → 볼 | 던지기 직전 2볼 2스트라이크',
        '직구 → 볼 | 던지기 직전 1볼 2스트라이크',
        '커브 → 파울 | 던지기 직전 1볼 1스트라이크 · 1아웃 · 1·3루',
        '직구 → 스트라이크 | 던지기 직전 1볼 0스트라이크 · 1아웃 · 1·3루',
        '직구 → 볼 | 던지기 직전 0볼 0스트라이크 · 0아웃 · 주자 없음'
      ], '전광판: 기록된 공만 아웃 · 주자');
      eq(c.facts['아웃·주자'], '주자 있을 때 2구 · 득점권 2구 (기록된 3구 중)', '요약: 아웃·주자');
      eq(document.querySelectorAll('#pcPick .pc-sb .sb-o').length, 3, 'O 점은 기록된 3장만');
      eq(document.querySelectorAll('#pcPick .pc-dia rect.on').length, 4, '1·3루 두 장 = 주자 4칸');
      ok(document.querySelector('#pcPick .pc-pick-foot'), '기록 없는 공이 있으면 안내');

      // 아웃·주자가 하나도 없는 두 공 → O · 주자 그림 없음, 안내만
      drag(55, 66, 90, 100);
      c = card();
      eq(c.title, '고른 공 2개', '기록 없는 두 공');
      eq([document.querySelectorAll('#pcPick .pc-sb .sb-o').length, document.querySelectorAll('#pcPick .pc-dia').length], [0, 0], 'O · 주자 그림 없음');
      ok(document.querySelector('#pcPick .pc-pick-foot'), '안내');
    } finally {
      AS.pitchers = S.pitchers; AS.currentPitcher = S.cp;
      setPitcherView('scope', 'season');
      try { shellNav('record'); } catch (e) {}
      $('app-page').style.display = S.ap;
    }
  });

  // 투수 엑셀 「투구 기록」 시트: 이닝 뒤에 아웃 · 주자 열, 값이 없는 공은 빈 칸 + 리포트에 빈 칸 수 안내
  // (xlsxreport 는 무압축 ZIP 이라 내려받을 Blob 의 글자를 그대로 읽어 확인한다)
  test('투수 엑셀: 투구 기록 시트에 아웃 · 주자 열 (경기 운영 모드 기록만, 나머지는 빈 칸)', async function () {
    var S = { pitchers: AS.pitchers, cp: AS.currentPitcher }, cou = URL.createObjectURL, clk = HTMLAnchorElement.prototype.click, blob = null;
    var sit = function (p, o, r) { p.outs = o; p.runners = r; return p; };
    try {
      AS.pitchers = [{ id: 'pk3', name: '엑셀투수', num: '7', role: null, pitches: [
        sit(pz('직구', '볼', 0.30, 0.30), 0, [false, false, false]),
        sit(pz('커브', '스트라이크', 0.40, 0.40), 2, [true, false, true]),
        pz('직구', '볼', 0.50, 0.50)   // 예전 기록
      ] }];
      AS.currentPitcher = AS.pitchers[0];
      setPitcherView('scope', 'game'); setPitcherView('sel', '엑셀투수');
      URL.createObjectURL = function (b) { blob = b; return 'blob:sl-test'; };
      HTMLAnchorElement.prototype.click = function () {};
      exportPitcherExcel();
      ok(blob, '엑셀 Blob');
      var text = await blob.text();
      var cells = []; text.replace(/<t xml:space="preserve">([^<]*)<\/t>/g, function (_, t) { cells.push(t); });
      var h = cells.indexOf('순번');
      while (h >= 0 && cells[h + 1] !== '경기') h = cells.indexOf('순번', h + 1);
      eq(cells.slice(h, h + 9), ['순번', '경기', '이닝', '아웃', '주자', '타자', '구종', '코스', '결과'], '투구 기록 머리글');
      ok(cells.indexOf('1·3루') >= 0 && cells.indexOf('주자 없음') >= 0, '주자 값');
      ok(/<v>2<\/v><\/c><c [^>]*t="inlineStr"><is><t xml:space="preserve">1·3루<\/t>/.test(text), '2아웃 · 1·3루가 같은 줄');
      ok(cells.some(function (t) { return t.indexOf('아웃·주자 빈 칸 1구') >= 0; }), '리포트 안내: 빈 칸 1구');
    } finally {
      URL.createObjectURL = cou; HTMLAnchorElement.prototype.click = clk;
      AS.pitchers = S.pitchers; AS.currentPitcher = S.cp;
      setPitcherView('scope', 'season');
    }
  });
})();
