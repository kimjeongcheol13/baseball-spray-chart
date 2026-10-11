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

  // P0 투구 기록(v2): 타석은 pa 로 묶고, 공의 정체(pr)와 타석 결과(end)를 따로 본다 — 옛 클라이언트용 result 로 세지 않는다
  test('투수 코스(v2 기록): 사구는 사구 · 볼이 아님(스트라이크%) · 인플레이 아웃은 "타격됨 → 땅볼 아웃" · 카운트는 pa 묶음으로', async function () {
    var S = { pitchers: AS.pitchers, cp: AS.currentPitcher, ap: $('app-page').style.display };
    var v2 = function (id, pa, batter, pt, pr, result, end, x, y) { var p = { id: id, v: 2, pa: pa, bid: 'v2' + batter, batter: batter, inning: '1회초', zone: null, zoneX: x, zoneY: y, pt: pt, pr: pr, result: result, ts: '' }; if (end) p.end = end; return p; };
    try {
      AS.pitchers = [{ id: 'pk2', name: '브이투투수', num: '8', role: null, pitches: [
        v2(1781000000001, 1781000000001, '가타자', '직구', '볼', '볼', null, 0.30, 0.30),
        v2(1781000000002, 1781000000001, '가타자', '커브', '파울', '파울', null, 0.32, 0.32),
        v2(1781000000003, 1781000000001, '가타자', '커브', '사구', '볼넷', '사구', 0.70, 0.70),
        v2(1781000000004, 1781000000004, '나타자', '직구', '타격됨', '아웃', '땅볼 아웃', 0.72, 0.72)
      ] }];
      AS.currentPitcher = AS.pitchers[0];
      shellNav('analysis', 'pitcher');
      setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '브이투투수'); setPitcherView('zone', 'plot');
      drag(65, 78, 80, 95);
      var c = card();
      eq(c.title, '고른 구역 · 2구', '고른 공 수');
      eq(c.rows, ['직구 0-0 카운트 타격됨 → 땅볼 아웃', '커브 1-1 카운트 사구'], '공의 결과 · 던지기 직전 카운트 (옛 result 의 볼넷 · 아웃이 아니라)');
      var kp = Array.prototype.map.call(document.querySelectorAll('#pcPick .pc-pick-kpis > div'), function (d) { return d.querySelector('span').textContent + ' ' + d.querySelector('small').textContent; });
      eq(kp[0], '스트라이크% 1/2', '사구는 스트라이크가 아니다'); eq(kp[2], '피안타 인플레이 1', '인플레이 1 · 피안타 0');
      var seq = document.querySelectorAll('#pcPick .pc-seq')[1];
      eq(Array.prototype.map.call(seq.querySelectorAll('.pq b'), function (b) { return b.textContent; }), ['B', 'F', '사구'], '가타자 타석의 공 순서 (pa 로 묶음)');
      document.querySelector('#pcPick .pc-pick-x').click();
    } finally {
      AS.pitchers = S.pitchers; AS.currentPitcher = S.cp;
      setPitcherView('scope', 'season');
      try { shellNav('record'); } catch (e) {}
      $('app-page').style.display = S.ap;
    }
  });

  // 카드의 아웃 · 주자 줄: outs · runners 가 있는 공만 세고, 없는 공(일반 모드 · 예전 기록)은 '기록 없음'
  function sitRow(label) {
    var r = Array.prototype.find.call(document.querySelectorAll('#pcPick .pc-pick-row'), function (el) { return el.firstElementChild.textContent === label; });
    return r ? Array.prototype.map.call(r.querySelectorAll('.pc-pick-chips i'), function (i) { var b = i.querySelector('b'); return (i.firstChild.textContent + ' ' + (b ? b.textContent : '')).trim(); }) : null;
  }
  test('투수 코스: 고른 공의 아웃 · 주자 (경기 운영 모드 기록만) · 없으면 기록 없음', async function () {
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
      eq(card().title, '고른 구역 · 5구', '전체');
      eq(sitRow('아웃'), ['0아웃 1', '1아웃 2', '기록 없음 2'], '아웃 줄');
      eq(sitRow('주자'), ['주자 없음 1', '1·3루 2', '득점권 2', '기록 없음 2'], '주자 줄');
      var lines = Array.prototype.map.call(document.querySelectorAll('#pcPick .pc-pick-list small'), function (el) { return el.textContent; });
      ok(lines.some(function (t) { return t.indexOf('1회초 · 1아웃 1·3루 · 가타자 상대') === 0; }), '공 하나씩에 아웃·주자: ' + lines.join(' / '));
      ok(lines.some(function (t) { return t.indexOf('1회초 · 0아웃 주자 없음 · ') === 0; }), '주자 없음 표시');

      // 아웃·주자가 하나도 없는 구역 → 한 줄 안내
      drag(55, 66, 90, 100);
      eq(card().title, '고른 구역 · 2구', '기록 없는 두 공');
      eq(sitRow('아웃'), null, '아웃 줄 없음');
      eq(sitRow('아웃 · 주자'), ['기록 없음 — 경기 운영 모드에서 기록한 공만 나와요'], '안내');
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
