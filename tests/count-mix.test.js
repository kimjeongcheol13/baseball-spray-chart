// 분석 → 투수 → 카운트별 구종 검증 (js/features/pitcher.js _countMixCard)
//  · 그 공을 던지기 직전 볼-스트라이크로 나눔 · 초구 / 볼이 많을 때 / 그 밖(0-1·1-1) / 2스트라이크 — 겹치지 않고 더하면 전체 · 전체 = 구종 구성 표와 같은 비율
//  · 막대 칸 색 = 구종 · 칸 너비 = 공 수 · 글자가 안 들어가는 좁은 칸(30px 미만)은 % 숨김 · 구종이 하나도 없으면 카드 없음
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var pz = function (batter, pt, result) { return { id: 'cm' + Math.random(), inning: '1회초', zone: null, zoneX: 0.5, zoneY: 0.5, pt: pt, result: result, batter: batter, ts: '' }; };
  function all(root, sel, f) { return Array.prototype.map.call(root.querySelectorAll(sel), f); }

  test('카운트별 구종: 던지기 직전 카운트로 나눈 구종 비율 · 색 · 너비 · 네 줄 합 = 전체', async function () {
    var S = { pitchers: AS.pitchers, cp: AS.currentPitcher, ap: $('app-page').style.display };
    var open = function (pitches) {
      AS.pitchers = [{ id: 'cm1', name: '카운트투수', num: '17', role: null, pitches: pitches }];
      AS.currentPitcher = AS.pitchers[0];
      shellNav('analysis', 'pitcher');
      setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '카운트투수');
    };
    try {
      open([
        // 가타자: 0-0 직구 볼 · 1-0 슬라이더 S · 1-1 직구 볼 · 2-1 커브 파울 · 2-2 슬라이더 삼진
        pz('가타자', '직구', '볼'), pz('가타자', '슬라이더', '스트라이크'), pz('가타자', '직구', '볼'), pz('가타자', '커브', '파울'), pz('가타자', '슬라이더', '삼진'),
        // 나타자: 0-0 직구 S · 0-1 직구 헛스윙 · 0-2 슬라이더 볼 · 1-2 슬라이더 안타
        pz('나타자', '직구', '스트라이크'), pz('나타자', '직구', '헛스윙'), pz('나타자', '슬라이더', '볼'), pz('나타자', '슬라이더', '안타'),
        // 다타자: 0-0 커브 볼 · 1-0 구종 미기록 볼 · 2-0 직구 볼 · 3-0 직구 볼넷
        pz('다타자', '커브', '볼'), pz('다타자', '', '볼'), pz('다타자', '직구', '볼'), pz('다타자', '직구', '볼넷')
      ]);
      var card = $('pcCountMix');
      ok(card, '카운트별 구종 카드');
      ok(card.compareDocumentPosition($('pcReplay')) & Node.DOCUMENT_POSITION_FOLLOWING, '리플레이 위');
      var rows = card.querySelectorAll('.pc-cm-row');
      eq(all(card, '.pc-cm-row', function (r) { return r.getAttribute('aria-label'); }), [
        '전체 13구: 직구 46%, 슬라이더 31%, 커브 15%, 미기록 8%',
        '초구 3구: 직구 67%, 커브 33%',
        '볼이 많을 때 5구: 직구 40%, 슬라이더 20%, 커브 20%, 미기록 20%',
        '그 밖 2구: 직구 100%',
        '2스트라이크 3구: 슬라이더 100%'
      ], '카운트별 비율 (0-1 · 1-1 직구 = 그 밖 · 3-0 = 볼이 많을 때 · 2-2 = 2스트라이크)');
      eq(all(rows[0], '.pc-cm-bar i', function (i) { return i.textContent; }), ['46%', '31%', '15%', '8%'], '칸마다 %');
      var shown = function (i) { return getComputedStyle(i.querySelector('span')).display !== 'none'; };
      ok(all(card, '.pc-cm-bar i', function (i) { return shown(i) === (i.getBoundingClientRect().width >= 30); }).every(Boolean), '30px 이상인 칸만 % 글자');
      eq(all(rows[4], '.pc-cm-bar i', function (i) { return i.textContent; }), ['100%'], '2스트라이크 = 슬라이더 한 칸');
      eq(all(rows[2], '.pc-cm-bar i', function (i) { return getComputedStyle(i).backgroundColor; }),
        ['rgb(75, 140, 245)', 'rgb(246, 194, 62)', 'rgb(167, 139, 250)', 'rgb(195, 202, 214)'], '칸 색 = 구종 (미기록 회색)');
      var w = all(rows[1], '.pc-cm-bar i', function (i) { return i.getBoundingClientRect().width; });
      ok(Math.abs(w[0] / w[1] - 2) < 0.15, '칸 너비 = 공 수 (초구 직구 2 : 커브 1) ' + w.join(' / '));
      eq(all(card, '.pc-cm-row em', function (e) { return e.textContent; }), ['13구', '3구', '5구', '2구', '3구'], '줄마다 공 수 (아래 네 줄 합 = 전체)');
      eq(all(card, '.pc-cm-key li', function (li) { return li.textContent; }), ['직구', '슬라이더', '커브', '미기록'], '범례 = 구종 구성 순서');
      ok(/아래 네 줄을 더하면 전체/.test(card.textContent), '합 안내');

      // 구종 이름은 글자 그대로 · 공이 없는 줄은 —
      open([pz('가타자', '<b>너클</b>', '볼'), pz('가타자', '<b>너클</b>', '볼넷')]);
      card = $('pcCountMix');
      eq(all(card, '.pc-cm-key li', function (li) { return li.textContent; }), ['<b>너클</b>'], '구종 이름 글자 그대로');
      ok(!card.querySelector('.pc-cm-key b, .pc-cm-bar b'), '태그로 해석되지 않음');
      eq(card.querySelectorAll('.pc-cm-row')[3].querySelector('.pc-cm-bar').textContent, '—', '공 없는 줄(그 밖)은 —');

      // 아주 좁은 칸(41구 중 1구)은 % 글자를 숨긴다 · title 에는 남음
      var many = [];
      for (var i = 0; i < 40; i++) many.push(pz('타자' + i, '직구', '안타'));
      many.push(pz('타자x', '커브', '안타'));
      open(many);
      var thin = $('pcCountMix').querySelector('.pc-cm-row .pc-cm-bar i:last-child');
      ok(thin.getBoundingClientRect().width < 30 && !shown(thin), '좁은 칸 % 숨김 ' + thin.getBoundingClientRect().width);
      eq(thin.title, '커브 1구 · 2%', '좁은 칸 title');

      // 구종이 하나도 없으면 카드 없음
      open([pz('가타자', '', '볼'), pz('가타자', '', '스트라이크')]);
      ok(!$('pcCountMix'), '구종 없는 투수는 카드 없음');
    } finally {
      AS.pitchers = S.pitchers; AS.currentPitcher = S.cp;
      setPitcherView('scope', 'season');
      try { shellNav('record'); } catch (e) {}
      $('app-page').style.display = S.ap;
    }
  });
})();
