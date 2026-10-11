// 투구 기록 P2 — 타구 ↔ 투구 기록 연결. 실제 index.html 의 recordPitch · 필드 탭(onFClick) · recHit/recOther · 엑셀 · 필터를 그대로 돌린다.
//  · 연결은 사용자가 고른 것만 (투구 화면 "필드에서 위치 찍기", 기록 탭 "연결", 같은 타자 타석을 한쪽에서 끝내 다른 쪽이 따라 닫힌 것) — 시간이 가깝다고 붙이지 않는다
//  · 연결은 타구 기록에 a.pa · a.pid 두 칸만. 투수 · 카운트 · 구종은 투구 기록에서 읽는다 (복사 없음)
//  · 「타구 허용」: 연결 열(명시 연결 / 직접 입력 / 추정(시간순)), 명시 연결만으로 만든 구종별 · 카운트별 표
//  · 타구 결과에 라인드라이브 아웃 · 실책 · 야수선택 · 삼중살 추가 (타수 O · 안타 X · 출루 X)
// 가상 데이터만 쓴다.
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$, sleep = T.sleep;
  var PC = function () { return window.PitchCalc; };

  function clean() { ['pitchEndSheet', 'pitchInnSheet', 'pitchFixSheet', 'pitchLinkSheet', 'abLinkSheet'].forEach(function (id) { var e = $(id); if (e) e.remove(); }); document.querySelectorAll('.overlay.show').forEach(function (o) { if (o.id === 'hitOverlay') closeHit(); }); }
  function fresh() {
    clean(); _clearFieldTapPrompt();
    AS.pitchers = []; AS.currentPitcher = null; AS.pitchLog = []; AS.batter = null; AS.pitchNewPA = false; AS._pitchInnAuto = null; AS._pendLink = null;
    AS.abs = []; AS.curTeam = 'home'; AS.home_lineup = [{ id: 'a', name: '가', num: '1' }, { id: 'b', name: '나', num: '2' }, { id: 'c', name: '다', num: '3' }]; AS.away_lineup = [];
    $('innSel').value = '1회초'; if (window.GF) GF.active = false;
    window._pitchInnAskedFor = AS.pitchers; renderLP();
  }
  function pitcher(id, name, hand) { var p = { id: id, name: name, num: '1', role: 'SP', hand: hand || 'R', pitches: [] }; AS.pitchers.push(p); AS.currentPitcher = p; return p; }
  function pick(id) { if (!(AS.batter && AS.batter.id === id)) selBatter(id); }   // 타구를 저장하면 앱이 다음 타자로 넘기므로, 같은 타자를 다시 누르면 선택이 풀린다
  function rec() { for (var i = 0; i < arguments.length; i++) recordPitch(arguments[i]); }
  // 앱의 연타 방지(recHit · recOther 는 0.7초 안에 다시 부르면 무시)를 넘기도록 저장 전에 기다린다
  var gap = function () { return sleep(750); };
  async function tapField() { await gap(); var r = { left: 0, top: 0, width: FS, height: FS }; onFClick({ clientX: FS / 2, clientY: FS * 0.35, rect: r, sx: 1, sy: 1 }); }
  async function hit(res, pos) { await gap(); AS.pending = pos || { x: 0.45, y: 0.35, deg: 85, dir: 'CF', ft: 280 }; recHit(res); }
  async function other(res) { await gap(); recOther(res); }
  function lastAb() { return AS.abs[AS.abs.length - 1]; }
  function stubDownload() {
    var oc = URL.createObjectURL, ok_ = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function () { return 'blob:stub'; }; HTMLAnchorElement.prototype.click = function () {};
    return function () { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok_; };
  }

  test('(준비) 앱 시작 작업이 끝날 때까지 기다린다', async function () { await sleep(2500); ok(true); });

  // ═══ ① 투구 화면 → 필드에서 위치 찍기 ═══
  test('① 인플레이로 끝나면 "타구 위치를 찍을까요?" → 필드를 탭하면 그 결과로 타구가 저장되고 연결된다 (a.pa · a.pid 만)', async function () {
    fresh(); var p = pitcher(11, '투수A'); pick('a');
    rec('볼', '헛스윙', '땅볼 아웃');
    var sh = $('pitchLinkSheet'); ok(sh, '연결 시트가 안 뜸'); ok(!sh.querySelector('[data-act="ab"]'), '찍어 둔 타구가 없으면 "방금 찍은 타구" 버튼 없음');
    sh.querySelector('[data-act="field"]').click();
    ok(!$('pitchLinkSheet'), '시트 닫힘'); eq(AS.pendingQuickRes, '땅볼 아웃', '필드 탭 = 이 결과로 저장');
    await tapField();
    var a = lastAb(); ok(a, '타구가 안 생김');
    eq([a.res, a.bid, a.pa, a.pid], ['땅볼 아웃', 'a', p.pitches[0].pa, 11], '결과 · 타자 · 연결');
    ok(a.x != null && a.y != null, '위치 있음'); ok(!('count' in a && a.count && a.count.linked), '카운트 등은 복사하지 않음');
    var L = PitchLink.of(a); eq([L.pitcher, L.count.b, L.count.s, L.end, L.pitches.length], ['투수A', 1, 1, '땅볼 아웃', 3], '연결 읽기: 투수 · 맞기 전 카운트 1-1 · 결과 · 공 수');
    clean();
  });
  test('① 새 타구 결과: 라인드라이브 아웃 · 실책 · 야수선택 · 삼중살도 그대로 저장되고, 타자 지표에선 타수 O · 안타 X · 출루 X', async function () {
    fresh(); pitcher(12, '투수B');
    var res = ['라인드라이브 아웃', '실책', '야수선택', '삼중살'], ids = ['a', 'b', 'c', 'a'];
    for (var i = 0; i < res.length; i++) {
      if (!(AS.batter && AS.batter.id === ids[i])) selBatter(ids[i]);
      rec(res[i]); $('pitchLinkSheet').querySelector('[data-act="field"]').click(); await tapField(); clean();
    }
    eq(AS.abs.map(function (a) { return a.res; }), res, '타구 결과');
    ok(AS.abs.every(function (a) { return a.pa != null; }), '모두 연결');
    var B = await import('/js/features/batdata.js?v=6'); var S = B.calcStats(AS.abs);
    eq([S.pa, S.ab, S.h, S.obp], [4, 4, 0, 0], '타수 4 · 안타 0 · 출루율 0');
    var opts = Array.prototype.map.call($('editRes').options, function (o) { return o.value; });
    ok(res.every(function (r) { return opts.indexOf(r) >= 0; }), '타석 수정 결과 목록에도 있음');
  });
  test('① 타석 중에 기록 탭에서 같은 타자 인플레이 타구를 먼저 찍으면 "투구 기록 타석도 닫고 연결할까요?" — 닫고 연결: 그 공에 결과 · 공을 보태지 않음 · 답한 뒤 다음 타자로 (사용자 결정 2026-10-11)', async function () {
    fresh(); var p = pitcher(13, '투수C'); pick('a');
    await hit('2루타', { x: 0.5, y: 0.3, deg: 90, dir: 'CF', ft: 300 });   // 타석 전에 찍은 타구 (연결 대상 아님)
    clean(); var old = lastAb();
    pick('a'); rec('볼'); await hit('안타', { x: 0.4, y: 0.3, deg: 80, dir: 'LC', ft: 280 }); var mine = lastAb();   // 타석 중에 찍은 타구
    var sh = $('abLinkSheet'); ok(sh && /닫고 연결/.test(sh.textContent), '닫고 연결 확인: ' + (sh ? sh.textContent.replace(/\s+/g, ' ') : '없음'));
    ok(!$('pitchEndSheet'), '다음 타자로 넘어가며 뜨는 "타석 결과는?" 창과 겹치지 않음 (넘기기는 답한 뒤)');
    ok(PC().openPA(p.pitches), '묻는 동안 투구 타석은 진행 중'); eq(mine.pa, undefined, '묻는 동안 연결 없음');
    sh.querySelector('[data-act="link"]').click();
    eq([mine.pa, mine.pid, old.pa], [p.pitches[0].pa, 13, undefined], '이 타석 중 타구만 연결');
    eq([p.pitches.length, p.pitches[0].end], [1, '안타'], '투수 탭: 공 1개 그대로, 그 공에 결과');
    var L = PitchLink.of(mine); eq([L.pitcher, L.count.b, L.count.s, L.end], ['투수C', 0, 0, '안타'], '연결 읽기');
    eq(AS.batter && AS.batter.id, 'b', '답한 뒤 다음 타자로'); ok(!$('pitchEndSheet'), '타석이 닫혀 결과를 다시 묻지 않음');
    clean();
  });
  test('① 기록 탭에서 먼저 찍은 타구에 "그대로 두기" → 투구 타석은 진행 중 · 투구 화면에서 끝내면 [방금 찍은 타구와 연결]', async function () {
    fresh(); var p = pitcher(16, '투수J'); AS.home_lineup = [{ id: 'b', name: '나', num: '2' }]; renderLP(); pick('b');   // 타순이 한 명이면 다음 타자로 넘어가지 않는다
    rec('볼'); await hit('안타');
    $('abLinkSheet').querySelector('[data-act="no"]').click();
    var mine = lastAb();
    ok(PC().openPA(p.pitches), '그대로 두면 투구 타석은 진행 중'); eq(mine.pa, undefined, '연결 없음');
    rec('안타');
    var sh = $('pitchLinkSheet'), btn = sh && sh.querySelector('[data-act="ab"]'); ok(btn, '"방금 찍은 타구와 연결" 버튼'); ok(/안타/.test(btn.textContent), btn.textContent);
    btn.click();
    eq([mine.pa, mine.pid], [p.pitches[1].pa, 16], '그 타구와 연결');
    eq([AS.currentPitches.length, AS._pitchEndInn, AS._pitchEndOuts], [0, null, null], '필드에서 찍지 않으니 기록 탭 대기 없음');
    clean();
  });
  test('① 투수 탭 볼넷 · 삼진으로 끝난 타석: 기록 탭 타석이 바로 생기고 그 투구 타석과 연결 (묻지 않음)', async function () {
    fresh(); var p = pitcher(15, '투수G'); pick('a'); await gap();
    rec('볼', '헛스윙', '볼', '볼', '볼');
    var w = lastAb(); ok(!$('pitchLinkSheet') && !$('abLinkSheet'), '묻지 않음');
    eq([w.bid, w.res, w.pa, w.pid], ['a', '볼넷', p.pitches[0].pa, 15], '볼넷 타석 · 연결');
    var L = PitchLink.of(w); eq([L.pitcher, L.count.b, L.count.s, L.pitches.length], ['투수G', 3, 1, 5], '연결 읽기: 마지막 공 직전 3-1 · 5구');
    await gap(); rec('헛스윙', '루킹', '헛스윙');
    var k = lastAb(); eq([k.bid, k.res, k.pa, k.pid], ['b', '삼진', p.pitches[5].pa, 15], '다음 타자 삼진 · 연결');
  });
  test('① 건너뛰기 → 연결 없음 · 위치 찍기를 고른 뒤 다른 타자를 찍으면 연결하지 않는다', async function () {
    fresh(); pitcher(14, '투수D'); pick('a'); rec('플라이 아웃');
    $('pitchLinkSheet').querySelector('[data-act="skip"]').click(); ok(!AS._pendLink && !AS.pendingQuickRes, '대기 없음');
    pick('b'); rec('안타'); $('pitchLinkSheet').querySelector('[data-act="field"]').click();
    pick('c'); await tapField(); clean();
    eq([lastAb().bid, lastAb().pa], ['c', undefined], '다른 타자의 타구에는 연결 안 붙음');
  });

  // ═══ ② 기록 탭에서 먼저 ═══
  test('② 기록 탭에서 타구를 찍으면, 같은 타자의 방금 끝난 인플레이 투구 타석과 "연결" 확인 → 연결 · 결과가 다르면 경고', async function () {
    fresh(); var p = pitcher(21, '투수E'); pick('a'); rec('볼', '땅볼 아웃'); $('pitchLinkSheet').querySelector('[data-act="skip"]').click();
    await hit('안타', { x: 0.3, y: 0.4, deg: 60, dir: 'LC', ft: 200 });
    var sh = $('abLinkSheet'); ok(sh, '연결 확인이 안 뜸');
    ok(/투수E/.test(sh.textContent) && /결과가 달라요/.test(sh.textContent), '내용: ' + sh.textContent.replace(/\s+/g, ' '));
    sh.querySelector('[data-act="link"]').click();
    eq([lastAb().pa, lastAb().pid, lastAb().res], [p.pitches[0].pa, 21, '안타'], '연결 (각 기록의 결과는 그대로)');
  });
  test('② 묻지 않는 경우: 그 타자의 가장 최근 투구 타석이 인플레이가 아님 · 이미 연결됨 · 타구가 삼진 · "연결하지 않음"', async function () {
    fresh(); pitcher(22, '투수F'); pick('a'); rec('헛스윙', '헛스윙', '헛스윙');   // 삼진
    pick('a'); await hit('안타', { x: 0.3, y: 0.4, deg: 60, dir: 'LC', ft: 200 }); ok(!$('abLinkSheet'), '최근 타석이 삼진이면 안 물음'); clean();
    pick('b'); rec('안타'); $('pitchLinkSheet').querySelector('[data-act="field"]').click(); await tapField(); clean();
    await hit('안타', { x: 0.6, y: 0.4, deg: 110, dir: 'RC', ft: 200 }); ok(!$('abLinkSheet'), '이미 연결된 타석이면 안 물음'); clean();
    await gap(); pick('c'); rec('희비');   // 기록 탭 '즉시 기록'과 같은 결과 → 시트 없이 기록 탭 타석이 바로 생기고 연결된다
    ok(!$('pitchLinkSheet') && !$('abLinkSheet'), '위치를 찍지 않는 결과는 묻지 않음'); eq([lastAb().bid, lastAb().res, lastAb().pa != null], ['c', '희비', true], '자동 타석 · 연결');
    await other('삼진'); ok(!$('abLinkSheet'), '타구가 삼진이면 안 물음');
    pick('b'); rec('땅볼 아웃'); $('pitchLinkSheet').querySelector('[data-act="skip"]').click();
    await other('희비'); var sh = $('abLinkSheet'); ok(sh, '희비 타구(recOther)도 물음'); sh.querySelector('[data-act="no"]').click();
    eq(lastAb().pa, undefined, '연결하지 않음');
  });

  // ═══ 읽는 쪽 ═══
  test('스프레이 필터: 연결된 타구는 카운트 · 구종 · 투수 손을 투구 기록에서 읽는다 (타구 기록의 칸은 그대로)', async function () {
    fresh(); pitcher(31, '좌투수', 'L'); pick('a'); AS.pitcherPt = '슬라이더';
    rec('헛스윙', '루킹'); AS.pitcherPt = '커브'; rec('안타'); $('pitchLinkSheet').querySelector('[data-act="field"]').click(); await tapField(); clean();
    var a = lastAb(); a.count = { b: 0, s: 0 }; a.hand = 'R'; a.pt = '직구';   // 타구 기록에 적힌 값은 다르게
    var chip = function (key, val) { window._sfChip({ dataset: { key: key, val: val } }); };   // 필터 칩을 누른 것과 같은 함수
    var pass = function (key, val) { _sfReset(); chip(key, val); var r = window._sfPass(a); _sfReset(); return r; };
    eq(pass('count', 'pitcher'), true, '2스트라이크(투구 기록 0-2)');
    eq(pass('count', 'first'), false, '초구 아님 (타구 기록에는 0-0 이라고 적혀 있어도)');
    eq(pass('pt', '커브'), true, '구종 = 맞은 공 커브'); eq(pass('pt', '직구'), false, '타구 기록의 직구가 아니라');
    eq(pass('hand', 'L'), true, '투수 손 = 좌투');
  });
  test('기록 탭 타자 상세 「투수별 요약」 · 타자 엑셀 투수 칸: 연결이 있으면 그 투수, 시간순은 "(추정)"', async function () {
    fresh(); var A = pitcher(41, '먼저투수'); pick('a'); rec('안타'); $('pitchLinkSheet').querySelector('[data-act="field"]').click(); await tapField(); clean();
    var linked = lastAb();
    pitcher(42, '나중투수'); pick('a'); rec('볼');   // 시간상 더 가까운 다른 투수의 공
    eq(PitchLink.of(linked).pitcher, '먼저투수', '연결 읽기는 시간과 상관없음');
    var X = await import('/js/features/xlsxreport.js?v=9');
    var est = { id: Date.now(), bid: 'a', bname: '가', res: '플라이 아웃', inn: '1회초', team: 'home', x: 0.5, y: 0.4, pitches: [{ zone: '중앙 중간', pt: '직구' }] };
    AS.abs.push(est);
    var restore = stubDownload(), sheets;
    var B = await import('/js/features/batdata.js?v=6');
    try { sheets = X.exportBatterXlsx(B.playerData(B.buildData(), '가')); } finally { restore(); }
    var pit = sheets.find(function (s) { return s.name === '투구 기록'; }); ok(pit, '투구 기록 시트'); var col = [];
    for (var r = 1; r < 50; r++) { var row = pit.rows.get(r); if (!row) break; col.push(row.get(7) && row.get(7).v); }
    ok(col.indexOf('먼저투수') >= 0, '연결된 타구 = 먼저투수: ' + JSON.stringify(col));
    ok(col.some(function (v) { return /\(추정\)$/.test(v || ''); }), '시간순 연결은 (추정): ' + JSON.stringify(col));
    AS.abs.pop();
  });
  test('「타구 허용」 시트: 연결 열(명시 연결 / 직접 입력 / 추정(시간순)) · 구종별 · 카운트별 표는 명시 연결만', async function () {
    fresh(); var p = pitcher(51, '허용투수'); pick('a');
    AS.pitcherPt = '직구'; rec('볼', '안타'); $('pitchLinkSheet').querySelector('[data-act="field"]').click(); await tapField(); clean();
    pick('b'); AS.pitcherPt = '슬라이더'; rec('헛스윙', '루킹', '땅볼 아웃'); $('pitchLinkSheet').querySelector('[data-act="field"]').click(); await tapField(); clean();
    pick('c'); rec('볼'); $('pitchLinkSheet') && $('pitchLinkSheet').remove();
    var t = Date.now(); AS.abs.push({ id: t, bid: 'c', bname: '다', res: '2루타', inn: '1회초', team: 'home', x: 0.7, y: 0.5, deg: 120, dir: 'RC' });   // 시간순(추정)
    AS.abs.push({ id: t + 1, bid: 'a', bname: '가', res: '플라이 아웃', inn: '1회초', team: 'home', x: 0.4, y: 0.6, deg: 70, dir: 'LC', pitcher: '허용투수' });   // 직접 입력
    var X = await import('/js/features/xlsxreport.js?v=9');
    var P = { name: '허용투수', num: '1', role: 'SP', apps: [{ label: '현재 경기', current: true, pitches: p.pitches }] };
    var restore = stubDownload(), sheets;
    try { sheets = X.exportPitcherXlsx(P, PC().calcPitching(P.apps), PC().calcPitching); } finally { restore(); }
    var sh = sheets.find(function (s) { return s.name === '타구 허용'; }); ok(sh, '시트');
    var cell = function (r, c) { var row = sh.rows.get(r); return row && row.get(c) ? row.get(c).v : undefined; };
    var how = []; for (var r = 5; r < 9; r++) how.push(cell(r, 12));
    eq(how.slice().sort(), ['명시 연결', '명시 연결', '직접 입력', '추정(시간순)'].sort(), '연결 열');
    ok(/명시 연결 2 · 직접 입력 1 · 추정\(시간순\) 1/.test(cell(1, 0)), '머리글: ' + cell(1, 0));
    ok(/연결된 타구 2개/.test(cell(30, 0)) && /추정 2개는 넣지 않았어요/.test(cell(30, 0)), '표 제목: ' + cell(30, 0));
    var pts = [cell(32, 0), cell(33, 0)].sort(); eq(pts, ['슬라이더', '직구'], '구종별 = 맞은 공 (명시 연결 2개만)');
    var r0 = 34; while (cell(r0, 0) !== '카운트(B-S)' && r0 < 40) r0++;
    eq([cell(r0 + 1, 0), cell(r0 + 2, 0)], ['0-2', '1-0'], '카운트별 = 맞기 전 카운트');
  });

  // ═══ 위치 좌표 재사용 ═══
  test('기록 탭 9칸 존 버튼 + 구종으로 넣은 공은 직전 캔버스 좌표를 물려받지 않는다', function () {
    fresh(); pick('a'); AS.currentPitches = [];
    AS.zoneX = 0.31; AS.zoneY = 0.62; AS.zone = '내각 낮음'; AS.pt = '직구'; logPitchAction();   // 캔버스로 찍은 공
    var cell = document.createElement('div'); cell.className = 'zone-cell'; cell.dataset.z = '중앙 높음';   // 9칸 존 버튼 (새 기록 화면에는 숨어 있어 같은 모양으로 만든다)
    _pendingZoneEl = cell; confirmZonePitch('체인지업');
    var ps = AS.currentPitches; eq([ps.length, ps[1].x, ps[1].y, ps[1].pt], [2, null, null, '체인지업'], '두 번째 공은 좌표 없음');
    AS.currentPitches = [];
  });

  test('① 건너뛰기: 이 타석의 공은 기록 탭 "이번 타석 투구"에서도 비운다 (다음 타자 타석에 붙지 않게)', async function () {
    fresh(); pitcher(17, '투수K'); pick('a');
    rec('볼', '헛스윙', '플라이 아웃');
    $('pitchLinkSheet').querySelector('[data-act="skip"]').click();
    eq([AS.currentPitches.length, AS.balls, AS.strikes, AS._pitchEndInn, AS._pitchEndOuts], [0, 0, 0, null, null], '대기 없음');
    pick('b'); await hit('안타');
    eq([lastAb().bid, lastAb().pitches.length], ['b', 0], '다음 타자 타구에 앞 타석의 공이 붙지 않음');
    clean();
  });

  test('(정리) 이 파일이 만든 상태를 비운다', function () { fresh(); AS.home_lineup = []; renderLP(); _sfReset && _sfReset(); ok(true); });
})();
