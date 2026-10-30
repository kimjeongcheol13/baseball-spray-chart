// 분석 → 투수 → 타석 리플레이 검증 (js/features/pitcher.js _replayCard / setReplay / saveReplayImage)
//  · 한 타석의 공을 존 위에 던진 순서 번호로 찍고 색은 구종, 옆 목록은 구종 · 결과 · 던지기 직전 카운트
//  · 처음엔 위치가 찍힌 가장 최근 타석 · ‹ › 와 select 로 타석을 바꾼다(포커스 유지) · 위치 없는 공은 목록에만
//  · 코스 공 카드의 「이 타석 리플레이」로 그 타석을 연다 · 이미지 저장 = 1080×1350 PNG
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var pz = function (pt, result, batter, x, y) { return { id: 'rp' + Math.random(), inning: '2회초', zone: null, zoneX: x, zoneY: y, pt: pt, result: result, batter: batter, ts: '' }; };
  function all(sel, f) { return Array.prototype.map.call(document.querySelectorAll(sel), f); }
  function view() {
    var hd = document.querySelector('#pcReplay .pc-rp-hd');
    return {
      who: hd.querySelector('b').textContent, res: hd.querySelector('em').textContent,
      balls: all('#pcReplay .rp-ball text', function (el) { return el.textContent; }),
      rows: all('#pcReplay .pc-rp-seq li', function (li) { return [li.querySelector('.rp-n').textContent, li.querySelector('b').textContent, li.querySelector('span').textContent, li.querySelector('em').textContent].join('|'); }),
      prev: document.querySelector('#pcReplay .pc-rp-prev').disabled, next: document.querySelector('#pcReplay .pc-rp-next').disabled
    };
  }
  // 캔버스에서 이 색(±12)에 가까운 점 수
  function near(cv, rgb) {
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, n = 0;
    for (var i = 0; i < d.length; i += 4) if (Math.abs(d[i] - rgb[0]) < 12 && Math.abs(d[i + 1] - rgb[1]) < 12 && Math.abs(d[i + 2] - rgb[2]) < 12) n++;
    return n;
  }

  test('타석 리플레이: 번호 · 구종 색 · 목록 · 타석 바꾸기 · 공 카드에서 열기 · 이미지 저장', async function () {
    var S = { pitchers: AS.pitchers, cp: AS.currentPitcher, ap: $('app-page').style.display, dl: window._downloadCanvas };
    try {
      AS.pitchers = [{ id: 'rp1', name: '리플투수', num: '11', role: null, pitches: [
        pz('직구', '볼', '가타자', 0.30, 0.30), pz('슬라이더', '스트라이크', '가타자', 0.70, 0.70),
        pz('커브', '파울', '가타자', null, null), pz('슬라이더', '삼진', '가타자', 0.72, 0.80),
        // 두 번째 타석: 위치가 하나도 없다 · 이름에 태그 글자
        pz('직구', '볼', '<b>나</b>', null, null), pz('체인지업', '안타', '<b>나</b>', null, null)
      ] }];
      AS.currentPitcher = AS.pitchers[0];
      shellNav('analysis', 'pitcher');
      setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '리플투수');
      ok($('pcReplay'), '리플레이 카드');

      // 처음: 위치가 찍힌 가장 최근 타석(가타자) — 위치 없는 커브는 존에 없고 목록에만
      var v = view();
      eq([v.who, v.res], ['가타자', '삼진'], '처음엔 위치가 있는 최근 타석');
      eq(v.balls, ['1', '2', '4'], '존 위 번호 = 던진 순서 (위치 없는 3구 빠짐)');
      eq(v.rows, ['1|직구|볼|0-0', '2|슬라이더|스트라이크(구분 없음)|1-0', '3|커브|파울 · 위치 없음|1-1', '4|슬라이더|삼진|1-2'], '목록: 구종 · 결과 · 던지기 직전 카운트');
      var cs = all('#pcReplay .rp-ball circle', function (el) { return getComputedStyle(el).fill; });
      eq(cs, ['rgb(75, 140, 245)', 'rgb(246, 194, 62)', 'rgb(246, 194, 62)'], '색 = 구종 (직구 파랑 · 슬라이더 노랑)');
      ok(document.querySelector('#pcReplay .rp-ball:last-of-type').classList.contains('last'), '타석을 끝낸 공 표시');
      eq([v.prev, v.next], [true, false], '첫 타석: ‹ 꺼짐 · › 켜짐');
      eq(all('#pcReplay .pc-rp-sel option', function (o) { return o.textContent; }), ['2회초 <b>나</b> · 단타 · 2구', '2회초 가타자 · 삼진 · 4구'], 'select: 최근 타석이 위');

      // › → 다음 타석: 공은 없고 안내, 이름의 태그 글자는 글자 그대로
      document.querySelector('#pcReplay .pc-rp-next').click();
      v = view();
      eq([v.who, v.res, v.balls.length, v.next], ['<b>나</b>', '단타', 0, true], '다음 타석 (이름은 글자 그대로)');
      ok(document.activeElement && document.activeElement.classList.contains('pc-rp-sel'), '› 가 꺼지면 포커스는 select 로');
      ok(!document.querySelector('#pcReplay .pc-rp-hd b b'), '이름이 태그로 해석되지 않음');
      ok(/위치가 없는 공 2개는 목록에만/.test($('pcReplay').textContent), '위치 없는 공 안내');

      // select 로 바꾸면 포커스가 select 에 남는다
      var sel = document.querySelector('#pcReplay .pc-rp-sel');
      sel.focus(); sel.value = sel.options[1].value; sel.dispatchEvent(new Event('change', { bubbles: true }));
      eq(view().who, '가타자', 'select 로 고른 타석');
      ok(document.activeElement && document.activeElement.classList.contains('pc-rp-sel'), '다시 그려도 select 포커스 유지');

      // 다른 타석을 보다가 코스 공 카드의 「이 타석 리플레이」 → 그 공의 타석
      document.querySelector('#pcReplay .pc-rp-next').click();
      eq(view().who, '<b>나</b>', '다른 타석으로 옮겨 둠');
      setPitcherView('zone', 'plot');
      setPitchPick({ a: [65, 90], b: [80, 102] });   // 4구 슬라이더(0.72, 0.80) 만
      var go = document.querySelector('#pcPick .pc-rp-go');
      ok(go, '공 카드에 「이 타석 리플레이」');
      go.click();
      eq(view().who, '가타자', '공 카드 → 그 타석 리플레이');

      // 이미지 저장: 1080×1350 · 구종 색 공이 그려진다
      var cv = null, name = '';
      window._downloadCanvas = function (c, n) { cv = c; name = n; };
      await saveReplayImage();
      ok(cv, '저장 캔버스');
      eq([cv.width, cv.height], [1080, 1350], '인스타 피드 4:5');
      ok(/^spraylab_replay_\d+\.png$/.test(name), '파일 이름 ' + name);
      ok(near(cv, [246, 194, 62]) > 500 && near(cv, [75, 140, 245]) > 300, '구종 색 공이 그려짐 ' + near(cv, [246, 194, 62]) + ' / ' + near(cv, [75, 140, 245]));
    } finally {
      window._downloadCanvas = S.dl;
      AS.pitchers = S.pitchers; AS.currentPitcher = S.cp;
      setPitcherView('scope', 'season');
      try { window.hideToast && hideToast(); } catch (e) {}
      try { shellNav('record'); } catch (e) {}
      $('app-page').style.display = S.ap;
    }
  });

  // 3D 보기(ana3d.js → spray3d.js <pitch-zone-3d>): 리플레이도 3D — 공 자리 · 구종 색 · 던진 순서 번호 · 마지막 공 고리
  //  (예전엔 번호 공 <g> 를 못 읽어 빈 3D 존이 됐다) · 하네스 크롬은 GPU 가 없어 넘긴 데이터와 만든 물체만 본다
  test('3D 보기: 리플레이도 3D — 구종 색 · 번호 · 마지막 공 고리 · 타석 바꾸면 따라감', async function () {
    var S = { pitchers: AS.pitchers, cp: AS.currentPitcher, ap: $('app-page').style.display };
    var z3 = function () { return document.querySelector('#pcReplay pitch-zone-3d'); };
    var xy = function () { return all('#pcReplay .rp-ball circle', function (c) { return [+c.getAttribute('cx'), +c.getAttribute('cy')]; }); };
    try {
      AS.pitchers = [{ id: 'rp3', name: '삼디투수', num: '12', role: null, pitches: [
        pz('직구', '볼', '다타자', 0.30, 0.30), pz('커브', '삼진', '다타자', 0.60, 0.60),
        pz('슬라이더', '안타', '라타자', 0.70, 0.50)
      ] }];
      AS.currentPitcher = AS.pitchers[0];
      shellNav('analysis', 'pitcher');
      setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '삼디투수');
      window.ana3dView('3d');
      var z = null;
      for (var i = 0; i < 50 && !(z && z._pts); i++) { await T.sleep(100); z = z3(); }
      ok(z && z._pts, '리플레이 3D 요소');
      var rp = $('pcReplay');
      ok(rp.classList.contains('an-is-3d') && getComputedStyle(rp.querySelector('svg.pc-rp-zone')).display === 'none', '2D 존 대신 3D');
      eq(all('#pcReplay .an-3d-seg button', function (b) { return b.textContent + ':' + b.getAttribute('aria-pressed'); }), ['2D:false', '3D:true'], '머리 버튼');

      // 처음 = 라타자(공 1개)
      var p = xy()[0];
      eq([z._pts, z._cols, z._pick, z._sel], [[{ x: p[0], y: p[1], k: '#f6c23e', on: false, n: 1 }], { '#f6c23e': '#f6c23e' }, false,
        { x0: p[0], y0: p[1], x1: p[0], y1: p[1], tap: true }], '공 자리 · 구종 색 · 번호 · 마지막 공 고리');

      // ‹ → 다타자: 3D 도 그 타석으로
      document.querySelector('#pcReplay .pc-rp-prev').click();
      await T.sleep(0);
      z = z3(); var q = xy();
      eq(z._pts.map(function (o) { return [o.x, o.y, o.k, o.n]; }), [[q[0][0], q[0][1], '#4b8cf5', 1], [q[1][0], q[1][1], '#a78bfa', 2]], '바꾼 타석 (직구 파랑 · 커브 보라)');
      eq([z._sel.x0, z._sel.y0, z._sel.tap], [q[1][0], q[1][1], true], '고리 = 타석을 끝낸 2구');

      // 장면에 넣는 물체: 공마다 번호 글자(스프라이트) 하나
      var got = [];
      z._balls({ add: function (o) { got.push(o); } });
      eq(got.filter(function (o) { return o.isSprite; }).length, 2, '번호 글자 2개');
    } finally {
      window.ana3dView('2d');
      try { localStorage.removeItem('sl_ana_3d'); } catch (e) {}
      AS.pitchers = S.pitchers; AS.currentPitcher = S.cp;
      setPitcherView('scope', 'season');
      try { shellNav('record'); } catch (e) {}
      $('app-page').style.display = S.ap;
    }
  });
})();
