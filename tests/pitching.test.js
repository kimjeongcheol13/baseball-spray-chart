// 투구 기록 무결성 검증 (P0) — 실제 index.html 의 recordPitch · selBatter · 투수 탭 · 분석 엑셀 · 공유 링크 코드를 그대로 돌린다.
//  · 카운트: 4볼 → 볼넷 · 3스트라이크 → 삼진 자동 종료, 파울은 2스트라이크에서 카운트 유지, 끝난 타석에는 같은 타자로 공을 더 못 넣는다
//  · 지표: 상대 타석 · 타수 · 피안타율 · 볼넷% · 삼진% · 타자당 투구 — 결과 없는 타석은 분모에서 빠지고 경고가 뜬다
//  · 같은 계산: 앱 투수 탭 = 분석 엑셀 리포트 = 옛 엑셀 내보내기 = 옛 투수 통계 카드
//  · 옛 기록(v1)은 고쳐 쓰지 않고 읽기만 한다 · 공유 링크로 왕복해도 타석 필드가 살아 있다
// 가상 데이터만 쓴다 (실명 데이터는 local/ 에 두고 커밋하지 않는다).
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;
  var PC = function () { return window.PitchCalc; };

  // ── 공통 ──
  function reset() {
    AS.pitchers = []; AS.currentPitcher = null; AS.pitchLog = []; AS.batter = null; AS.pitchNewPA = false;
    AS.pitcherZone = null; AS.pitcherZoneX = null; AS.pitcherZoneY = null; AS.pitcherPt = null;
    var sh = $('pitchEndSheet'); if (sh) sh.remove();
  }
  function pitcher(id, name) {
    var p = { id: id, name: name, num: '1', role: 'SP', pitches: [] };
    AS.pitchers.push(p); AS.currentPitcher = p; return p;
  }
  function batter(id, name) { AS.batter = { id: id, name: name, num: '9' }; }
  function rec() { for (var i = 0; i < arguments.length; i++) recordPitch(arguments[i]); }
  function last(p) { return p.pitches[p.pitches.length - 1]; }
  function ends(p) { return p.pitches.map(function (x) { return x.end || null; }); }
  function calc(p) { return PC().calcPitching([{ pitches: p.pitches }]); }
  var pctTxt = function (v) { return (v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0) + '%'; };
  var f3 = function (v) { return v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, ''); };

  // v1(옛 기록) 투구: result 에 타석 결과가 섞여 있고 pa · v · end 가 없다
  var _id = 5000;
  function v1(batterName, results) {
    return results.map(function (r) { return { id: ++_id, inning: '', zone: null, pt: '직구', result: r, batter: batterName, ts: '10:00' }; });
  }

  // ═══ 케이스 1~4: 카운트와 타석 종료 ═══
  test('볼 → 파울 → 볼 → 볼 → 볼 ⇒ 5구째에서 볼넷, 타석 종료', function () {
    reset(); var p = pitcher(1, '투수'); batter('a', '가');
    rec('볼', '파울', '볼', '볼', '볼');
    eq(p.pitches.length, 5, '투구 수');
    eq(ends(p), [null, null, null, null, '볼넷'], '타석 결과는 5구째에만');
    eq([last(p).pr, last(p).result], ['볼', '볼넷'], '볼넷을 만든 공: 투구 결과 pr 은 볼, 옛 호환 result 는 볼넷');
    eq(new Set(p.pitches.map(function (x) { return x.pa; })).size, 1, '다섯 공이 한 타석(pa)');
    eq(PC().stateOf(p.pitches, AS.batter, false).mode, 'ended', '타석 상태');
    eq(PC().groupPA(p.pitches).length, 1, '묶인 타석 수');
  });
  test('스트라이크 → 파울 → 볼 → 볼 → 스트라이크 ⇒ 5구째에서 삼진', function () {
    reset(); var p = pitcher(1, '투수'); batter('a', '가');
    rec('스트라이크', '파울', '볼', '볼', '스트라이크');
    eq(ends(p), [null, null, null, null, '삼진'], '타석 결과는 5구째에만');
    eq([last(p).pr, last(p).result], ['스트라이크', '삼진'], '삼진을 만든 공: 투구 결과 pr 은 스트라이크, 옛 호환 result 는 삼진');
  });
  test('스트라이크 → 스트라이크 → 파울 → 파울 → 볼 ⇒ 카운트 1-2, 타석 진행 중', function () {
    reset(); var p = pitcher(1, '투수'); batter('a', '가');
    rec('스트라이크', '스트라이크', '파울', '파울', '볼');
    var st = PC().stateOf(p.pitches, AS.batter, false);
    eq([st.mode, st.b, st.s, st.n], ['open', 1, 2, 5], '상태(모드·볼·스트라이크·구수)');
    eq(ends(p), [null, null, null, null, null], '끝난 공 없음');
    ok(PC().openPA(p.pitches), '진행 중인 타석이 있어야 함');
  });
  test('4볼 이후에 볼을 더 입력하려 하면 막힌다 (타자를 바꾸면 새 타석 1-0)', function () {
    reset(); var p = pitcher(1, '투수'); batter('a', '가');
    rec('볼', '볼', '볼', '볼');
    eq(p.pitches.length, 4, '4볼로 끝남'); eq(last(p).end, '볼넷', '볼넷');
    rec('볼'); rec('스트라이크'); rec('파울');
    eq(p.pitches.length, 4, '끝난 타석에 같은 타자로 넣은 공은 저장되지 않아야 함');
    eq(PC().nextPitch(p.pitches, '볼', { batter: { id: 'a', name: '가' }, id: 1 }).blocked, 'ended', 'nextPitch 가 막음');
    ok($('pitchCountBar').textContent.indexOf('다음 타자를 선택하세요') >= 0, '화면이 다음 타자 선택을 안내');
    batter('b', '나'); rec('볼');
    eq(p.pitches.length, 5, '타자를 바꾸면 새 타석의 첫 공');
    var st = PC().stateOf(p.pitches, AS.batter, false);
    eq([st.mode, st.b, st.s, st.n], ['open', 1, 0, 1], '새 타석 1-0');
    ok(last(p).pa !== p.pitches[0].pa, '새 타석 ID');
  });
  test('같은 타자의 다음 타석은 "같은 타자 다음 타석"으로 직접 확인해야 이어진다', function () {
    reset(); var p = pitcher(1, '투수'); batter('a', '가');
    rec('스트라이크', '스트라이크', '스트라이크'); eq(last(p).end, '삼진', '삼진');
    rec('볼'); eq(p.pitches.length, 3, '막힘');
    pitchNextPA(); rec('볼');
    eq(p.pitches.length, 4, '확인 뒤에는 새 타석');
    eq(AS.pitchNewPA, false, '확인은 한 번만 쓰인다');
  });
  test('5볼·4스트라이크는 입력 단계에서 불가능하다 (어떤 순서로 눌러도 카운트가 3볼·2스트라이크를 넘지 않는다)', function () {
    reset(); var p = pitcher(1, '투수');
    var seqs = [['볼', '볼', '볼', '볼', '볼', '볼'], ['스트라이크', '파울', '파울', '스트라이크', '스트라이크', '스트라이크'], ['파울', '파울', '파울', '파울', '볼', '볼', '볼', '볼']];
    seqs.forEach(function (seq, k) {
      p.pitches.length = 0; batter('x' + k, '타자' + k); AS.pitchNewPA = false;
      seq.forEach(function (r) { recordPitch(r); });
      PC().groupPA(p.pitches).forEach(function (x) {
        ok(x.b <= 4 && x.s <= 3 && !x.abnormal, '불가능한 카운트가 저장됨: ' + JSON.stringify(seq));
      });
    });
  });
  test('낫아웃 출루: 삼진은 그대로 세고 아웃으로는 세지 않는다 · 되돌릴 수 있다', function () {
    reset(); var p = pitcher(1, '투수'); batter('a', '가');
    rec('스트라이크', '스트라이크', '스트라이크');
    var c = calc(p); eq([c.k, c.outs, c.pa], [1, 1, 1], '삼진은 아웃 1');
    togglePitchNK();
    c = calc(p); eq([c.k, c.outs, c.ab, c.pa], [1, 0, 1, 1], '낫아웃: 삼진 1 · 아웃 0');
    eq(last(p).nk, 1, 'nk 플래그');
    ok($('pitchCountBar').textContent.indexOf('삼진(아웃)으로 되돌리기') >= 0, '되돌리는 버튼');
    togglePitchNK(); eq(calc(p).outs, 1, '다시 아웃 1');
  });
  test('되돌리기: 마지막 공 하나를 지우고 타석이 다시 진행 중이 된다', function () {
    reset(); var p = pitcher(1, '투수'); batter('a', '가');
    rec('볼', '볼', '볼', '볼'); eq(last(p).end, '볼넷', '볼넷');
    var n = AS.pitchLog.length; undoPitch();
    eq(p.pitches.length, 3, '한 개 지움'); eq(AS.pitchLog.length, n - 1, '투구 로그도 지움');
    var st = PC().stateOf(p.pitches, AS.batter, false);
    eq([st.mode, st.b, st.s], ['open', 3, 0], '3-0 진행 중');
    rec('볼'); eq(last(p).end, '볼넷', '다시 4볼이면 다시 볼넷');
    undoPitch(); undoPitch(); undoPitch(); undoPitch(); undoPitch();
    eq(p.pitches.length, 0, '다 지워도 오류 없음');
  });
  test('코스 입력은 공마다 비워진다 (직전 좌표가 다음 공에 저장되지 않는다)', function () {
    reset(); var p = pitcher(1, '투수'); batter('a', '가');
    AS.pitcherZone = '중앙 중간'; AS.pitcherZoneX = 0.5; AS.pitcherZoneY = 0.5; AS.pitcherPt = '직구';
    recordPitch('볼');
    eq([p.pitches[0].zone, p.pitches[0].zoneX, p.pitches[0].zoneY, p.pitches[0].pt], ['중앙 중간', 0.5, 0.5, '직구'], '첫 공은 찍은 코스');
    AS.pitcherPt = '체인지업'; recordPitch('스트라이크');
    eq([p.pitches[1].zone, p.pitches[1].zoneX, p.pitches[1].zoneY, p.pitches[1].pt], [null, null, null, '체인지업'], '구종만 바꾸고 코스를 안 찍은 공은 코스 미기록');
    AS.pitcherZoneX = 0; AS.pitcherZoneY = 0; AS.pitcherZone = '내각 높음'; recordPitch('파울');
    eq([p.pitches[2].zoneX, p.pitches[2].zoneY], [0, 0], '좌표 0 도 그대로 저장 (null 로 바뀌지 않음)');
    var ids = p.pitches.map(function (x) { return x.id; });
    eq(new Set(ids).size, ids.length, '연속으로 눌러도 투구 id 가 겹치지 않음');
  });

  // ═══ 타자·투수를 바꿀 때 결과 시트 ═══
  function lineup() { AS.curTeam = 'home'; AS.home_lineup = [{ id: 'a', name: '가', num: '1' }, { id: 'b', name: '나', num: '2' }]; }
  test('타자 바꾸기: 앞 타석에 결과가 없으면 시트가 뜨고, 고르기 전에는 닫히지 않는다', function () {
    reset(); lineup(); var p = pitcher(1, '투수'); selBatter('a'); rec('볼', '스트라이크');
    selBatter('b');
    var sh = $('pitchEndSheet'); ok(sh, '시트가 안 뜸');
    eq(AS.batter.id, 'a', '고르기 전에는 타자가 안 바뀜');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); sh.click();
    ok($('pitchEndSheet'), 'Esc · 바깥 클릭으로 닫히면 안 됨');
    var vals = Array.prototype.map.call(sh.querySelectorAll('[data-end]'), function (b) { return b.getAttribute('data-end'); });
    ['안타', '2루타', '3루타', '홈런', '볼넷', '사구', '삼진', '땅볼 아웃', '플라이 아웃', '라인드라이브 아웃', '실책', '야수선택', '희타', '희비', '미상'].forEach(function (v) {
      ok(vals.indexOf(v) >= 0, '선택지에 ' + v + ' 없음');
    });
    sh.querySelector('[data-end="땅볼 아웃"]').click();
    ok(!$('pitchEndSheet'), '고른 뒤에는 닫힘');
    eq(AS.batter.id, 'b', '고른 뒤 타자가 바뀜');
    eq(last(p).end, '땅볼 아웃', '앞 타석의 마지막 공에 결과가 달림');
  });
  test('결과 시트 "모름": end 는 null 이 아니라 "미상" — 지표에서는 미기록과 같다', function () {
    reset(); lineup(); var p = pitcher(1, '투수'); selBatter('a'); rec('볼', '스트라이크', '파울');
    selBatter('b'); $('pitchEndSheet').querySelector('[data-end="미상"]').click();
    eq(last(p).end, '미상', '저장값');
    var c = calc(p); eq([c.pa, c.unrec.length, c.ab], [0, 1, 0], '상대 타석에 안 들어가고 미기록으로 센다');
    ok(PC().warnLines(c)[0].indexOf('결과 미기록 1타석 · 지표 왜곡 가능') === 0, '경고 문구');
    var st = PC().stateOf(p.pitches, AS.batter, false);
    eq([st.mode, st.end, st.blocked], ['ended', '미상', false], '앞 타석은 끝난 것으로 보고, 다음 타자로 새 타석을 시작할 수 있다');
    rec('볼'); eq(PC().groupPA(p.pitches).length, 2, '새 타석');
  });
  test('결과 시트 "타자 바꾸지 않음": 타자 그대로 · 타석은 계속 진행 중', function () {
    reset(); lineup(); var p = pitcher(1, '투수'); selBatter('a'); rec('볼', '스트라이크');
    selBatter('b'); $('pitchEndSheet').querySelector('[data-cancel]').click();
    ok(!$('pitchEndSheet'), '시트 닫힘'); eq(AS.batter.id, 'a', '타자 그대로'); eq(last(p).end, undefined, '결과 안 달림');
    ok(PC().openPA(p.pitches), '타석 진행 중');
  });
  test('같은 타자를 다시 누르면(선택 해제) 시트가 뜨지 않는다 · 타자 없이 시작한 타석은 고른 타자에게 이어 붙는다', function () {
    reset(); lineup(); var p = pitcher(1, '투수'); selBatter('a'); rec('볼');
    selBatter('a'); ok(!$('pitchEndSheet'), '같은 타자 해제에 시트가 뜸'); eq(AS.batter, null, '해제됨');
    rec('볼'); eq(PC().groupPA(p.pitches).length, 1, '해제된 채 기록한 공도 앞 타석(타자 가)에 이어짐');
    selBatter('b'); ok($('pitchEndSheet'), '그 타석은 아직 결과가 없으므로 다른 타자로 바꾸면 시트가 뜸'); $('pitchEndSheet').querySelector('[data-end="삼진"]').click();
    reset(); lineup(); p = pitcher(1, '투수'); rec('볼', '볼');   // 타자 없이 시작
    selBatter('a'); ok(!$('pitchEndSheet'), '타자 없이 시작한 타석은 시트를 요구하지 않음');
    rec('볼'); eq(PC().groupPA(p.pitches).length, 1, '같은 타석으로 이어짐'); eq(PC().groupPA(p.pitches)[0].batter, '가', '타석의 타자는 나중에 고른 타자');
  });
  test('투수를 바꿀 때도 앞 투수의 안 끝난 타석은 결과를 요구한다', function () {
    reset(); lineup(); var p1 = pitcher(1, '투수1'); var p2 = { id: 2, name: '투수2', num: '2', pitches: [] }; AS.pitchers.push(p2);
    selBatter('a'); rec('볼', '볼');
    selectPitcher(2);
    ok($('pitchEndSheet'), '시트가 안 뜸'); eq(AS.currentPitcher.id, 1, '고르기 전에는 투수가 안 바뀜');
    $('pitchEndSheet').querySelector('[data-end="미상"]').click();
    eq(AS.currentPitcher.id, 2, '고른 뒤 투수가 바뀜'); eq(last(p1).end, '미상', '앞 투수 타석에 미상');
  });

  // ═══ 케이스 5: 지표 정의 ═══
  function fixture5() {
    reset(); var p = pitcher(1, '투수');
    p.pitches.push.apply(p.pitches, []);
    var cases = [['a', ['볼', '스트라이크', '볼', '안타']], ['b', ['스트라이크', '볼', '파울', '땅볼 아웃']], ['c', ['볼', '볼', '볼', '볼']], ['d', ['스트라이크', '스트라이크', '볼', '스트라이크']]];
    cases.forEach(function (c) { batter(c[0], '타자' + c[0]); c[1].forEach(function (r) { AS.pitcherPt = r === '볼' ? '슬라이더' : '직구'; recordPitch(r); }); });
    return p;
  }
  test('투수 1명 · 4타석(단타 / 땅볼 아웃 / 볼넷 / 삼진) · 16구 ⇒ 상대 타석 4 · 타수 3 · 피안타율 .333 · 볼넷% 25% · 삼진% 25% · 타자당 투구 4.0', function () {
    var p = fixture5(); var c = calc(p);
    eq(p.pitches.length, 16, '총 투구');
    eq([c.pa, c.ab, c.h, c.bb, c.k], [4, 3, 1, 1, 1], '상대 타석 · 타수 · 피안타 · 볼넷 · 삼진');
    eq([f3(c.avg), pctTxt(c.bbRate), pctTxt(c.kRate), c.ppa.toFixed(1)], ['.333', '25%', '25%', '4.0'], '피안타율 · 볼넷% · 삼진% · 타자당 투구');
    eq([c.outs, c.unrec.length, c.abnormal.length], [2, 0, 0], '아웃 2 · 미기록 0 · 카운트 이상 0');
    eq(PC().warnLines(c), [], '경고 없음');
  });
  test('타수 = 타석 − 볼넷 − 사구 − 희생번트 − 희생플라이 (실책 · 야수선택은 타수에 든다)', function () {
    reset(); var p = pitcher(1, '투수');
    ['사구', '희타', '희비', '실책', '야수선택', '라인드라이브 아웃', '2루타'].forEach(function (r, i) { batter('x' + i, '타자' + i); rec('스트라이크'); recordPitch(r); });
    var c = calc(p);
    eq([c.pa, c.hbp, c.sh, c.sf, c.ab, c.h], [7, 1, 1, 1, 4, 1], '타석 · 사구 · 희타 · 희비 · 타수 · 피안타');
    eq(f3(c.avg), '.250', '피안타율 = 1/4');
    eq(c.outs, 3, '아웃: 희타 1 + 희비 1 + 라인드라이브 아웃 1 (사구 · 실책 · 야수선택은 0)');
  });


  // ═══ 옛 클라이언트 호환: 종료 공의 result 는 옛 코드가 알아보는 값, 공의 정체는 pr, 읽을 때는 end 우선 ═══
  // 옛 투수 탭(origin/main 04133f1 의 js/features/pitcher.js) 계산부를 그대로 옮겨 둔 것 — 배포된 옛 코드가 v2 경기를 열면 어떻게 읽는지 확인하는 용도. 고치지 않는다.
  function legacyPitcherCalc(apps) {
    var HIT = ['안타', '2루타', '3루타', '홈런', '타격됨'], TB = { '안타': 1, '타격됨': 1, '2루타': 2, '3루타': 3, '홈런': 4 };
    var OUTS = { '삼진': 1, '아웃': 1, '병살': 2, '삼중살': 3 }, BALL = ['볼', '볼넷'];
    var END = HIT.concat(['삼진', '아웃', '병살', '삼중살', '볼넷']);
    function plateAppearances(pitches) {
      var out = [], cur = null;
      var open = function (batter) { cur = { batter: batter, pitches: [], b: 0, s: 0, reached3B: false, reached2S: false, result: null }; };
      pitches.forEach(function (p) {
        if (cur && p.batter && cur.batter && p.batter !== cur.batter) { out.push(cur); cur = null; }
        if (!cur) open(p.batter || null);
        cur.pitches.push(p);
        if (END.indexOf(p.result) >= 0) { cur.result = p.result; if (cur.s >= 2) cur.reached2S = true; out.push(cur); cur = null; return; }
        if (p.result === '볼') cur.b = Math.min(3, cur.b + 1);
        else if (p.result === '스트라이크' || (p.result === '파울' && cur.s < 2)) cur.s = Math.min(2, cur.s + 1);
        if (cur.b >= 3) cur.reached3B = true;
        if (cur.s >= 2) cur.reached2S = true;
      });
      if (cur) out.push(cur);
      return out;
    }
    var pitches = apps.reduce(function (a, x) { return a.concat(x.pitches); }, []);
    var pas = apps.reduce(function (a, x) { return a.concat(plateAppearances(x.pitches)); }, []);
    var done = pas.filter(function (x) { return x.result; });
    var r = function (res) { return done.filter(function (x) { return x.result === res; }).length; };
    var h = done.filter(function (x) { return HIT.indexOf(x.result) >= 0; }).length, k = r('삼진'), bb = r('볼넷');
    var outs = done.reduce(function (s, x) { return s + (OUTS[x.result] || 0); }, 0), ab = done.length - bb;
    return { n: pitches.length, pa: done.length, h: h, k: k, bb: bb, outs: outs, ab: ab, avg: ab ? h / ab : 0, kRate: done.length ? k / done.length : 0, bbRate: done.length ? bb / done.length : 0,
      ppa: done.length ? done.reduce(function (s, x) { return s + x.pitches.length; }, 0) / done.length : 0,
      sPct: pitches.length ? pitches.filter(function (p) { return BALL.indexOf(p.result) < 0; }).length / pitches.length : 0 };
  }
  var stored = function (p) { return JSON.parse(JSON.stringify(p.pitches)); };   // 저장 → 다시 읽기(JSON)를 거친 모양

  test('옛 호환: 타석 결과마다 pr(공의 정체) · result(옛 호환) · end 가 정해진 대로 저장된다', function () {
    var want = { '안타': ['타격됨', '안타'], '2루타': ['타격됨', '2루타'], '3루타': ['타격됨', '3루타'], '홈런': ['타격됨', '홈런'],
      '땅볼 아웃': ['타격됨', '아웃'], '플라이 아웃': ['타격됨', '아웃'], '라인드라이브 아웃': ['타격됨', '아웃'], '병살': ['타격됨', '병살'], '삼중살': ['타격됨', '삼중살'],
      '실책': ['타격됨', '아웃'], '야수선택': ['타격됨', '아웃'], '희타': ['타격됨', '아웃'], '희비': ['타격됨', '아웃'],
      '볼넷': ['볼', '볼넷'], '사구': ['사구', '볼넷'], '삼진': ['스트라이크', '삼진'] };
    PC().END_CHOICES.forEach(function (c) { ok(want[c[0]], '표에 없는 결과: ' + c[0]); });
    Object.keys(want).forEach(function (end) {
      reset(); var p = pitcher(1, '투수'); batter('a', '가'); recordPitch(end);
      var x = p.pitches[0];
      eq([x.v, x.pr, x.result, x.end], [2, want[end][0], want[end][1], end], end + ' → v · pr · result · end');
    });
    reset(); var q = pitcher(1, '투수'); batter('a', '가'); rec('볼', '스트라이크', '파울');
    q.pitches.forEach(function (x) { eq([x.pr, x.v], [x.result, 2], '끝나지 않은 공은 result 와 pr 이 같다'); });
  });
  test('읽을 때는 end 가 우선이다 — result 는 옛 클라이언트용 보조값일 뿐', function () {
    var x = { v: 2, pr: '타격됨', result: '안타', end: '플라이 아웃' };   // 일부러 어긋나게
    eq([PC().endOf(x), PC().pitchInfo(x).hit, PC().pitchInfo(x).strike], ['플라이 아웃', false, true], 'end 가 result 보다 우선');
    var y = { v: 2, pr: '스트라이크', result: '삼진', end: '볼넷' };
    eq([PC().endOf(y), PC().pitchInfo(y).k, PC().pitchInfo(y).bb], ['볼넷', false, true], 'end=볼넷 이면 result=삼진이어도 삼진이 아니다');
    eq(PC().kindOf({ v: 2, pr: '스트라이크', result: '안타', end: '안타' }), 'strike', '공의 정체는 pr (result 가 안타여도 스트라이크)');
    eq(PC().endOf({ v: 2, pr: '볼', result: '볼넷' }), null, 'v2 에서 end 없이 result 만 종료값이면 타석을 끝낸 것으로 읽지 않는다');
    eq(PC().endOf({ result: '삼진' }), '삼진', 'v1 은 옛 result 로 읽는다');
  });
  test('결과 시트로 타석을 끝내도 옛 호환 result 가 같이 써지고 pr 은 그대로다 · "모름"은 result 를 건드리지 않는다', function () {
    reset(); lineup(); var p = pitcher(1, '투수'); selBatter('a'); rec('볼', '스트라이크', '파울');
    selBatter('b'); $('pitchEndSheet').querySelector('[data-end="2루타"]').click();
    var x = last(p); eq([x.pr, x.result, x.end], ['파울', '2루타', '2루타'], '파울이던 마지막 공: pr 유지 · result=2루타 · end=2루타');
    eq(PC().pitchInfo(x).strike, true, '공의 정체(파울)는 그대로라서 스트라이크로 센다');
    rec('볼', '볼'); selBatter('a'); $('pitchEndSheet').querySelector('[data-end="미상"]').click();
    x = last(p); eq([x.pr, x.result, x.end], ['볼', '볼', '미상'], '모름: result 는 그대로');
    reset(); lineup(); p = pitcher(1, '투수'); selBatter('a'); rec('볼', '볼');
    selBatter('b'); $('pitchEndSheet').querySelector('[data-end="사구"]').click();
    x = last(p); eq([x.pr, x.result, x.end], ['볼', '볼넷', '사구'], '사구: result 는 옛 코드가 아는 볼넷');
  });
  test('옛 투수 탭이 v2 경기를 열어도 피안타율 · 삼진% · 볼넷% · 타자당 투구가 실제와 맞는다 (단타 / 땅볼 아웃 / 볼넷 / 삼진 · 16구)', function () {
    var p = fixture5(); var o = legacyPitcherCalc([{ pitches: stored(p) }]), c = calc(p);
    eq([o.pa, o.ab, o.h, o.k, o.bb], [4, 3, 1, 1, 1], '옛 코드가 센 타석 · 타수 · 피안타 · 삼진 · 볼넷');
    eq([f3(o.avg), pctTxt(o.kRate), pctTxt(o.bbRate), o.ppa.toFixed(1), pctTxt(o.sPct), o.outs], ['.333', '25%', '25%', '4.0', '50%', 2], '옛 화면 값 = 실제');
    eq([f3(o.avg), pctTxt(o.kRate), pctTxt(o.bbRate), o.ppa.toFixed(1), pctTxt(o.sPct), o.outs], [f3(c.avg), pctTxt(c.kRate), pctTxt(c.bbRate), c.ppa.toFixed(1), pctTxt(c.sPct), c.outs], '새 계산과 같다');
  });
  test('옛 투수 탭: 옛 코드가 모르는 결과는 알려진 만큼만 틀린다 (사구=볼넷 · 실책 · 야수선택 · 희생 = 아웃) — 안타는 안타로 읽힌다', function () {
    reset(); var p = pitcher(1, '투수');
    ['사구', '희타', '희비', '실책', '야수선택', '라인드라이브 아웃', '2루타'].forEach(function (r, i) { batter('x' + i, '타자' + i); rec('스트라이크'); recordPitch(r); });
    var o = legacyPitcherCalc([{ pitches: stored(p) }]), c = calc(p);
    eq([o.pa, o.h, o.k], [7, 1, 0], '옛 화면: 타석 7 · 피안타 1(2루타) · 삼진 0 — 안타 판정은 맞다');
    eq([o.bb, c.bb, c.hbp], [1, 0, 1], '사구는 옛 화면에서 볼넷으로 센다(실제는 사구 1) — 타수에서 빠지는 쪽이라 덜 틀린다');
    eq([o.ab, c.ab, f3(o.avg), f3(c.avg)], [6, 4, '.167', '.250'], '타수: 옛 6(희타 · 희비 · 실책 · 야수선택은 아웃으로 읽혀 타수에 든다) · 실제 4 — 이 범위만 다르다');
    eq([o.outs, c.outs], [5, 3], '아웃: 옛 5(희타 · 희비 · 실책 · 야수선택 · 라인드라이브) · 실제 3');
  });


  // ═══ 케이스 6: 옛 데이터 ═══
  function legacy() {
    return [
      { id: 'L1', name: '옛투수', num: '7', role: 'SP', pitches: [].concat(
        v1('A', ['볼', '스트라이크', '안타']),                       // 결과 있음 (옛 방식: result 에 타석 결과)
        v1('B', ['볼', '볼', '볼', '볼', '볼', '볼']),               // 결과 없음 · 불가능한 카운트(볼 6개)
        v1('C', ['스트라이크', '스트라이크', '스트라이크']),          // 결과 없음 · 스트라이크 3개인데 삼진 아님
        v1('D', ['스트라이크', '삼진']),                              // 결과 있음
        v1('E', ['볼', '파울'])) }                                    // 결과 없음 (카운트는 정상)
    ];
  }
  test('옛 기록(결과 없는 타석 섞임): 크래시 없이 읽히고, 경고가 뜨고, 비율 지표 분모에서 빠진다', function () {
    var P = legacy()[0]; var c = PC().calcPitching([{ pitches: P.pitches }]);
    eq([c.pa, c.unrec.length, c.abnormal.length, c.h, c.k], [2, 3, 2, 1, 1], '상대 타석 2 · 미기록 3 · 카운트 이상 2 · 피안타 1 · 삼진 1');
    eq([c.ab, f3(c.avg), c.ppa], [2, '.500', 2.5], '타수 2 · 피안타율 .500 · 타자당 투구 2.5 (결과 있는 두 타석만)');
    var w = PC().warnLines(c);
    ok(w[0].indexOf('결과 미기록 3타석 · 지표 왜곡 가능') === 0, '미기록 경고: ' + w[0]);
    ok(w[1].indexOf('카운트 이상 2타석') === 0, '카운트 이상 경고: ' + w[1]);
    eq(P.pitches.every(function (x) { return x.v === undefined && x.pa === undefined && x.end === undefined; }), true, '읽기만 하고 옛 데이터에 필드를 쓰지 않음');
    eq(c.n, 16, '투구 수는 그대로');
  });
  test('옛 저장 경기를 불러와도(restoreGame · 분석 buildData) 깨지지 않고 앱 투수 탭에 경고가 뜬다', async function () {
    reset(); var K = 'sl_pitching_legacy_1', t0 = Date.now();
    localStorage.setItem(K, JSON.stringify({ th: '홈', ta: '원정', hs: 0, as: 0, abs: [], d: '2026. 5. 31.', ts: t0, home_lineup: [], away_lineup: [], pitchers: legacy() }));
    localStorage.setItem('sl_saves', JSON.stringify([{ key: K, label: K, ts: t0 }]));
    try {
      restoreGame(K);
      eq(AS.pitchers.length, 1, '투수 불러옴'); eq(AS.pitchers[0].pitches.length, 16, '투구 불러옴');
      setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '옛투수');
      var txt = $('pitcherView').textContent;
      ok(txt.indexOf('결과 미기록 3타석 · 지표 왜곡 가능') >= 0, '앱에 미기록 경고 없음');
      ok(txt.indexOf('카운트 이상 2타석') >= 0, '앱에 카운트 이상 경고 없음');
      setPitcherView('scope', 'season');
      ok($('pitcherView').textContent.indexOf('결과 미기록') >= 0, '시즌 전체(buildData)에서도 경고');
      ok($('pitcherView').textContent.indexOf('상대 2타석') >= 0, '라벨이 상대 타석');
    } finally {
      localStorage.removeItem(K); localStorage.removeItem('sl_saves'); _curSaveKey = null; _gameSaved = true; reset(); setPitcherView('scope', 'season');
    }
  });
  test('v1(옛)과 v2(새)가 섞인 등판: 옛 타석은 옛 규칙으로, 새 타석은 pa 로 묶인다', function () {
    reset(); var p = pitcher(1, '투수'); p.pitches = v1('A', ['볼', '볼']);   // 옛 기록이 이미 있는 경기를 다시 열어 이어서 기록
    batter('b', '나'); rec('스트라이크', '스트라이크', '파울', '스트라이크');
    var g = PC().groupPA(p.pitches);
    eq(g.length, 2, '타석 수'); eq([g[0].v2, g[0].end], [false, null], '옛 타석(결과 없음)'); eq([g[1].v2, g[1].end, g[1].pitches.length], [true, '삼진', 4], '새 타석(삼진 4구)');
  });

  // ═══ 케이스 7: 앱 = 엑셀 = 옛 엑셀 = 옛 카드 ═══
  function kpis() {
    var o = {}; Array.prototype.forEach.call(document.querySelectorAll('#pitcherView .pc-kpi'), function (k) { o[k.querySelector('span').textContent] = k.querySelector('b').textContent; });
    return o;
  }
  test('앱 투수 탭 수치 = 엑셀 리포트 시트 수치 (같은 계산 함수)', async function () {
    var p = fixture5(); reset_view();
    var X = await import('/js/features/xlsxreport.js?v=4');
    var P = { name: p.name, num: p.num, role: p.role, apps: [{ label: '현재 경기', current: true, pitches: p.pitches }] };
    var S = PC().calcPitching(P.apps);
    var restore = stubDownload(); var sheets;
    try { sheets = X.exportPitcherXlsx(P, S, PC().calcPitching); } finally { restore(); }
    var cell = function (sh, r, c) { var row = sh.rows.get(r); return row && row.get(c) ? row.get(c).v : undefined; };
    var rep = sheets[0], k = kpis();
    eq(rep.name, '리포트', '첫 시트');
    var xl = { n: cell(rep, 4, 0), sPct: cell(rep, 4, 2), kRate: cell(rep, 4, 4), bbRate: cell(rep, 4, 6), avg: cell(rep, 4, 8), ppa: cell(rep, 4, 10) };
    eq(k['스트라이크%'], pctTxt(xl.sPct), '스트라이크%'); eq(k['삼진%'], pctTxt(xl.kRate), '삼진%'); eq(k['볼넷%'], pctTxt(xl.bbRate), '볼넷%');
    eq(k['피안타율'], f3(xl.avg), '피안타율'); eq(k['타자당 투구'], xl.ppa.toFixed(1), '타자당 투구');
    eq([k['피안타율'], k['볼넷%'], k['삼진%'], k['타자당 투구'], k['스트라이크%']], ['.333', '25%', '25%', '4.0', '50%'], '정의대로의 값');
    ok(String(cell(rep, 1, 0)).indexOf('상대 4타석') >= 0, '엑셀 머리글이 상대 타석: ' + cell(rep, 1, 0));
    // 구종별 표: 앱 vs 엑셀
    var dom = {}; Array.prototype.forEach.call(document.querySelectorAll('#pitcherView .pc-mix tbody tr'), function (tr) {
      var td = tr.querySelectorAll('td'); dom[tr.querySelector('th').textContent] = { s: td[1].textContent, k: td[2].textContent, h: td[3].childNodes[0].textContent };
    });
    var checked = 0;
    for (var r = 9; r < 14; r++) {
      var pt = cell(rep, r, 0); if (!dom[pt]) continue;
      eq(dom[pt].s, pctTxt(cell(rep, r, 3)), pt + ' S%'); eq(String(dom[pt].k), String(cell(rep, r, 6)), pt + ' 삼진'); eq(String(dom[pt].h), String(cell(rep, r, 5)), pt + ' 피안타'); checked++;
    }
    eq(checked, 2, '구종 2개를 앱과 비교');
    // 투구 기록 시트에 타석 결과 열
    var rs = sheets.filter(function (s) { return s.name === '투구 기록'; })[0];
    eq(cell(rs, 0, 7), '타석 결과', '투구 기록 시트 머리글'); eq([cell(rs, 4, 6), cell(rs, 4, 7)], ['타격됨', '단타'], '안타 공의 결과 · 타석 결과');
    eq(cell(rs, 12, 7), '볼넷', '볼넷 공의 타석 결과');
  });
  function reset_view() { setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '투수'); }
  function stubDownload() {
    var oc = URL.createObjectURL, ok_ = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function () { return 'blob:stub'; }; HTMLAnchorElement.prototype.click = function () {};
    return function () { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok_; };
  }
  test('엑셀 리포트: 결과 미기록 · 카운트 이상 경고가 시트에 같은 문구로 들어간다 · 결과 없는 타석은 분모에서 빠진다', async function () {
    var X = await import('/js/features/xlsxreport.js?v=4');
    var P = { name: '옛투수', num: '7', role: 'SP', apps: [{ label: '5/31', pitches: legacy()[0].pitches }] };
    var S = PC().calcPitching(P.apps); var restore = stubDownload(); var sheets;
    try { sheets = X.exportPitcherXlsx(P, S, PC().calcPitching); } finally { restore(); }
    var rep = sheets[0], w = PC().warnLines(S);
    eq(rep.rows.get(6).get(0).v, '⚠ ' + w[0], '미기록 경고 문구'); eq(rep.rows.get(7).get(0).v, '⚠ ' + w[1], '카운트 이상 문구');
    eq(rep.rows.get(4).get(8).v, 0.5, '피안타율 .500 (1/2)'); eq(rep.rows.get(4).get(10).v, 2.5, '타자당 투구 2.5');
    ok(String(rep.rows.get(1).get(0).v).indexOf('상대 2타석') >= 0, '머리글 상대 2타석');
  });
  test('옛 투수 통계 카드(renderPitcherStats)와 옛 엑셀 내보내기 2곳도 같은 계산을 쓴다', async function () {
    var p = fixture5(); renderPitcherStats(); var c = calc(p);
    var card = $('pitcherStats').textContent;
    ok(card.indexOf(Math.round(c.sPct * 100) + '%') >= 0, '옛 카드 스트라이크율 ' + Math.round(c.sPct * 100) + '%: ' + card.slice(0, 80));
    var hadX = 'XLSX' in window, oldX = window.XLSX, cap = {};
    window.XLSX = { utils: { book_new: function () { return {}; }, aoa_to_sheet: function (rows) { return { _rows: rows }; }, book_append_sheet: function (wb, ws, name) { cap[name] = ws._rows; }, encode_cell: function () { return 'A1'; }, sheet_to_json: function () { return []; } }, writeFile: function () {} };
    try {
      AS.abs = [{ id: 1, bid: 'a', bname: '타자a', bnum: 1, res: '안타', inn: '1회초', team: 'home' }];
      exportCurrentGameToExcel();
      var rows = cap['투수분석']; ok(rows, '경기 엑셀에 투수분석 시트가 없음');
      var h = rows[0], r = rows[1];
      eq([r[h.indexOf('총투구수')], r[h.indexOf('볼%')], r[h.indexOf('스트라이크%')], r[h.indexOf('피안타')], r[h.indexOf('탈삼진')], r[h.indexOf('상대타석')], r[h.indexOf('결과미기록타석')]],
        [16, 50, 50, 1, 1, 4, 0], '경기 엑셀: 투구 · 볼% · 스트라이크% · 피안타 · 탈삼진 · 상대타석 · 미기록');
      // 전체 경기 엑셀 (저장된 경기에서 읽는다)
      var K = 'sl_pitching_export_1', t0 = Date.now();
      localStorage.setItem(K, JSON.stringify({ th: '홈', ta: '원정', hs: 0, as: 0, abs: [{ id: 2, bid: 'a', bname: '타자a', bnum: 1, res: '안타', inn: '1회초', team: 'home' }], d: '2026. 6. 1.', ts: t0, home_lineup: [], away_lineup: [], pitchers: legacy() }));
      localStorage.setItem('sl_saves', JSON.stringify([{ key: K, label: K, ts: t0 }]));
      try {
        exportAllGamesToExcel();
        var rows2 = cap['투수분석']; var h2 = rows2[0], r2 = rows2[rows2.length - 1];
        eq([r2[h2.indexOf('총투구수')], r2[h2.indexOf('피안타')], r2[h2.indexOf('탈삼진')], r2[h2.indexOf('상대타석')], r2[h2.indexOf('결과미기록타석')]], [16, 1, 1, 2, 3], '전체 엑셀(옛 기록): 투구 · 피안타 · 탈삼진 · 상대타석 · 미기록');
      } finally { localStorage.removeItem(K); localStorage.removeItem('sl_saves'); }
    } finally { if (hadX) window.XLSX = oldX; else delete window.XLSX; AS.abs = []; }
  });
  test('옛 "전체 리포트"(exportFullReport · 어디서도 안 부르는 코드)의 볼% · 존 집계 버그가 고쳐졌다', function () {
    var p = fixture5();
    var hadX = 'XLSX' in window, oldX = window.XLSX, cap = {};
    window.XLSX = { utils: { book_new: function () { return {}; }, aoa_to_sheet: function (rows) { return { _rows: rows }; }, book_append_sheet: function (wb, ws, name) { cap[name] = ws._rows; }, encode_cell: function () { return 'A1'; }, sheet_to_json: function () { return []; } }, writeFile: function () {} };
    var K = 'sl_pitching_full_1', t0 = Date.now();
    var P2 = JSON.parse(JSON.stringify(p)); P2.pitches.forEach(function (x, i) { x.zone = i % 2 ? '중앙 중간' : '내각 높음'; });
    localStorage.setItem(K, JSON.stringify({ th: '홈', ta: '원정', hs: 0, as: 0, abs: [{ id: 3, bid: 'a', bname: '타자a', bnum: 1, res: '안타', inn: '1회초', team: 'home' }], d: '2026. 6. 1.', ts: t0, home_lineup: [], away_lineup: [], pitchers: [P2] }));
    localStorage.setItem('sl_saves', JSON.stringify([{ key: K, label: K, ts: t0 }]));
    try {
      exportFullReport();
      var rows = cap['투수분석']; ok(rows, '투수분석 시트가 없음 (exportFullReport 가 중간에 멈춤)');
      var h = rows[0], r = rows[1];
      eq(r[h.indexOf('총투구수')], 16, '총 투구');
      ok(String(r[h.indexOf('볼%')]).indexOf('50') === 0, '볼%가 50% 여야 함 (예전에는 늘 0%): ' + r[h.indexOf('볼%')]);
      ok(String(r[h.indexOf('스트라이크%')]).indexOf('50') === 0, '스트라이크%가 50% 여야 함 (예전에는 늘 100%): ' + r[h.indexOf('스트라이크%')]);
      eq(r[h.indexOf('존1투구')] + r[h.indexOf('존2투구')] + r[h.indexOf('존5투구')], 16, '코스 이름이 존 칸으로 세어짐 (예전에는 늘 0)');
    } finally { localStorage.removeItem(K); localStorage.removeItem('sl_saves'); if (hadX) window.XLSX = oldX; else delete window.XLSX; }
  });

  test('스카우트 탭 "이번 경기 투구 기록" 카드도 같은 판정을 쓴다 (새 기록에서 삼진·피안타가 0 으로 나오지 않는다)', function () {
    reset(); var p = pitcher(1, '투수'); batter('a', '타자a');
    rec('스트라이크', '스트라이크', '스트라이크'); pitchNextPA(); rec('볼', '안타');
    AS.abs = [{ id: 7001, bid: 'a', bname: '타자a', bnum: 1, res: '안타', inn: '1회초', team: 'home' }];
    try {
      openScoutView();
      var txt = document.body.textContent;
      ok(txt.indexOf('투수 탭 기록 · 5구 · 삼진 1 · 피안타 1') >= 0, '스카우트 카드 문구를 못 찾음');
    } finally { AS.abs = []; }
  });

  // ═══ 공유 링크 왕복 ═══
  test('공유 링크: pa · end · nk · batter · bid · inning · zoneX/Y · v 가 shareGameLink → JSON → 복원으로 살아 돌아온다 (옛 기록도)', function () {
    reset(); var p = pitcher(11, '링크투수'); p.hand = 'L';
    AS.pitcherPt = '직구'; AS.pitcherZone = '외각 낮음'; AS.pitcherZoneX = 0.61; AS.pitcherZoneY = 0.74;
    batter('a', '가'); rec('볼'); AS.pitcherZone = '중앙 중간'; AS.pitcherZoneX = 0.5; AS.pitcherZoneY = 0.55; rec('스트라이크', '스트라이크', '스트라이크'); togglePitchNK();
    batter('b', '나'); rec('스트라이크', '볼');
    batter('c', '다'); rec('볼', '볼', '볼', '볼');
    var legacyP = { id: 12, name: '옛링크투수', num: '3', pitches: v1('Z', ['볼', '스트라이크', '안타']) }; AS.pitchers.push(legacyP);
    var orig = JSON.parse(JSON.stringify(AS.pitchers));
    var oldPush = window.pushSharedLink, payload = null;
    window.pushSharedLink = function (pl) { payload = pl; };   // 서버로 보내지 않고 payload 만 잡는다
    try { shareGameLink(); } finally { window.pushSharedLink = oldPush; }
    ok(payload && payload.pitchers, 'shareGameLink 가 payload 를 안 만듦');
    var back = _restorePitchersFromPayload(JSON.parse(JSON.stringify(payload.pitchers)));   // 링크는 JSON 으로 오간다
    var keys = ['id', 'pt', 'result', 'pr', 'zone', 'inning', 'batter', 'ts', 'zoneX', 'zoneY', 'v', 'pa', 'bid', 'end', 'nk'];
    orig.forEach(function (op, i) {
      op.pitches.forEach(function (o, j) {
        var b = back[i].pitches[j];
        keys.forEach(function (k) { eq(b[k] === undefined ? null : b[k], o[k] === undefined ? null : o[k], op.name + ' #' + j + ' ' + k); });
      });
    });
    var c0 = PC().calcPitching([{ pitches: orig[0].pitches }]), c1 = PC().calcPitching([{ pitches: back[0].pitches }]);
    eq([c1.pa, c1.k, c1.bb, c1.outs, c1.ab, c1.unrec.length, c1.pas.length], [c0.pa, c0.k, c0.bb, c0.outs, c0.ab, c0.unrec.length, c0.pas.length], '복원한 뒤에도 같은 지표');
    eq(back[0].pitches.length, 10, '투구 수'); ok(back[0].pitches.some(function (x) { return x.nk === 1; }), '낫아웃 플래그');
    var c2 = PC().calcPitching([{ pitches: back[1].pitches }]); eq([c2.pa, c2.h, c2.unrec.length], [1, 1, 0], '옛 기록도 그대로 읽힘');
    eq(back[0].hand, 'L', '투수 손');
  });

  test('(정리) 이 파일이 만든 상태를 비운다', function () { reset(); setPitcherView('scope', 'season'); eq(AS.pitchers.length, 0, '투수'); });
})();
