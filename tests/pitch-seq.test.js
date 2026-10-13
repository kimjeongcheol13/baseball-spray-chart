// 투구 단위 결과 · 카운트 파생 · 타석 동기화 · 정합성 경고 · 마이그레이션 · 엑셀 열 검증 (core.js pitch-seq · schema-migrate, xlsxreport.js)
//  · 결과 버튼(setPitchResult) → B·S 자동 계산(카운트판 B·S 읽기 전용) → 4볼/3스트라이크 자동 기록
//  · 타석 구종·코스·B-S = 마지막 공(seq 최대)에서 파생 · 로그 없는 타석은 수기값 그대로
//  · 구버전 저장 데이터: seq = 저장 순서, result = 옛 한글값 매핑(없으면 null), sl_schema_ver 1회 변환 · 투수 탭 자체 로그는 그대로
//  · 엑셀(타자): 투구 기록 '타석 내 순번'·'투구 결과', 타석 기록 '확인 필요' — 타석 구종·코스·B-S 가 마지막 공 행과 같다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;

  function snapLS() { var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }
  function restoreLS(o) {
    var now = []; for (var i = 0; i < localStorage.length; i++) now.push(localStorage.key(i));
    now.forEach(function (k) { if (!(k in o)) localStorage.removeItem(k); });
    Object.keys(o).forEach(function (k) { if (localStorage.getItem(k) !== o[k]) localStorage.setItem(k, o[k]); });
  }
  function save() {
    var s = $('innSel');
    return { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, team: AS.curTeam, batter: AS.batter, bf: AS.batterFilter,
      b: AS.balls, s: AS.strikes, o: AS.outs, pitchers: AS.pitchers, cp: AS.currentPitcher, pl: AS.pitchLog, cps: AS.currentPitches,
      pt: AS.pt, zone: AS.zone, inn: s ? s.selectedIndex : 0, curGame: AS.curGame, autoKey: window._autoKey, saved: window._gameSaved,
      curSave: window._curSaveKey, ls: snapLS() };
  }
  function restore(S) {
    clearTimeout(window._autoTimer);
    AS.abs = S.abs; AS.home_lineup = S.hl; AS.away_lineup = S.al; AS.curTeam = S.team; AS.batter = S.batter; AS.batterFilter = S.bf;
    AS.balls = S.b; AS.strikes = S.s; AS.outs = S.o; AS.pitchers = S.pitchers; AS.currentPitcher = S.cp; AS.pitchLog = S.pl; AS.currentPitches = S.cps;
    AS.pt = S.pt; AS.zone = S.zone; AS.pendingQuickRes = null; AS.pending = null; AS.curGame = S.curGame; window._autoKey = S.autoKey; window._gameSaved = S.saved;
    window._curSaveKey = S.curSave;
    var s = $('innSel'); if (s) s.selectedIndex = S.inn;
    restoreLS(S.ls);
    try { closeOverlay('editRecOverlay'); } catch (e) {}
    try { _clearFieldTapPrompt(); renderLP(); renderRecs(); renderCount(); renderPitcherRoster(); renderPitchLog(); } catch (e) {}
    try { shellNav('record'); } catch (e) {}
  }
  function setup() {
    ok(!(typeof GF !== 'undefined' && GF && GF.active), '경기 운영 모드가 꺼진 상태에서 검사');
    AS.curTeam = 'home';
    AS.home_lineup = [{ id: 'ps1', name: '정합타자', num: '7', pos: '', bh: '', isStarter: true }, { id: 'ps2', name: '다음타자', num: '8', pos: '', bh: '', isStarter: true }];
    AS.away_lineup = [];
    AS.abs = []; AS.batter = null; AS.balls = 0; AS.strikes = 0; AS.outs = 0;
    AS.pitchers = []; AS.currentPitcher = null; AS.pitchLog = []; AS.currentPitches = []; AS.pendingQuickRes = null;
    window._curSaveKey = null;
    var s = $('innSel'); if (s) s.selectedIndex = 0;
    selBatter('ps1');
    eq(AS.batter && AS.batter.id, 'ps1', '타자 선택');
  }
  function run(name, fn) {
    test(name, async function () {
      var S = save(), sync0 = window.cloudAutoSyncRecord, cs0 = window.cloudSave;
      window.cloudAutoSyncRecord = function () {}; window.cloudSave = function () {};
      try { setup(); await T.sleep(750); await fn(); } finally { restore(S); window.cloudAutoSyncRecord = sync0; window.cloudSave = cs0; }
    });
  }
  // 기록 탭 코스 캔버스 탭 흉내: 구종 + 코스 → logPitchAction
  function pitch(pt, zone, result) {
    AS.pt = pt; AS.zone = zone || '중앙 중간'; AS.zoneX = 0.5; AS.zoneY = 0.5;
    logPitchAction();
    if (result) setPitchResult(result);
  }
  // 기록 뒤 셸이 다음 타순으로 넘기므로 같은 타자로 다시 (selBatter 는 같은 타자를 누르면 해제라 먼저 비운다)
  function useBatter() { if (!AS.batter || AS.batter.id !== 'ps1') { AS.batter = null; selBatter('ps1'); } }
  var seqs = function (ps) { return ps.map(function (p) { return p.seq; }); };
  var ress = function (ps) { return ps.map(function (p) { return p.result; }); };

  test('카운트 계산: 파울은 2스트라이크 뒤 그대로 · 루킹·헛스윙·strike 모두 스트라이크 · 인플레이·미기록은 그대로', function () {
    var c = _pCount([{ result: 'called_strike' }, { result: 'foul' }, { result: 'foul' }, { result: 'foul' }, { result: 'ball' }, { result: null }, { result: 'strike' }, { result: 'in_play' }]);
    eq([c.b, c.s, c.known, c.missing], [1, 3, 7, 1], '최종 카운트 · 결과 있는 공 · 미기록');
    eq(c.pre.map(function (x) { return x.b + '-' + x.s; }), ['0-0', '0-1', '0-2', '0-2', '0-2', '1-2', '1-2', '1-3'], '각 공 직전 카운트');
  });

  run('기록 탭: 결과 버튼 → B·S 자동(카운트판 B·S 읽기 전용) → 4번째 볼에 볼넷 자동 기록, 타석 구종·코스·B-S = 마지막 공', async function () {
    pitch('직구', '내각 높음');
    eq(AS.currentPitches[0].seq, 1, '순번'); eq(AS.currentPitches[0].result, null, '결과 안 누르면 null (기본값 강제 없음)');
    var bar = document.querySelector('#mobPitchModal .pr-bar') || document.querySelector('.pr-bar');
    ok(bar && !bar.hidden, '결과 버튼 줄 표시');
    var btns = bar.querySelectorAll('.pr-btn');
    eq([].map.call(btns, function (b) { return b.textContent; }), ['볼', '루킹', '스윙', '파울', '인플레이'], '버튼 5개');
    eq(AS.balls + '-' + AS.strikes, '0-0', '결과 없으면 수기 카운트 그대로');
    chCount('b'); chCount('b'); eq(AS.balls, 2, '결과 없을 땐 카운트판 B 가 그대로 동작');
    setPitchResult('ball');
    eq(AS.currentPitches[0].result, 'ball', '결과 저장'); eq(AS.balls + '-' + AS.strikes, '1-0', '결과로 다시 계산 (손으로 누른 B 는 버려짐)');
    chCount('b'); chCount('s');
    eq(AS.balls + '-' + AS.strikes, '1-0', '결과가 있으면 카운트판 B·S 는 읽기 전용');
    ok(document.querySelector('#countBoard').classList.contains('cnt-auto'), '카운트판 자동 표시');
    pitch('슬라이더', '외각 낮음', 'called_strike');
    pitch('슬라이더', '외각 낮음', 'swinging_strike');
    pitch('직구', '중앙 높음', 'foul');
    eq(AS.balls + '-' + AS.strikes, '1-2', '2스트라이크 뒤 파울은 그대로');
    pitch('커브', '볼 아래', 'ball');
    setPitchResult('ball');   // 같은 버튼 다시 → 미기록
    eq(AS.currentPitches[4].result, null, '같은 버튼 다시 누르면 null'); eq(AS.balls + '-' + AS.strikes, '1-2', '카운트도 되돌아감');
    setPitchResult('ball');
    pitch('커브', '볼 아래', 'ball');
    eq(AS.balls + '-' + AS.strikes, '3-2', '풀카운트'); eq(AS.abs.length, 0, '아직 기록 없음');
    pitch('포크볼', '외각 낮음', 'ball');
    eq(AS.abs.length, 1, '4번째 볼 → 볼넷 자동 기록');
    var a = AS.abs[0];
    eq(a.res, '볼넷', '결과'); eq(seqs(a.pitches), [1, 2, 3, 4, 5, 6, 7], '타석 내 순번 1..7');
    eq(ress(a.pitches), ['ball', 'called_strike', 'swinging_strike', 'foul', 'ball', 'ball', 'ball'], '투구 결과');
    eq([a.pt, a.zone, a.count.b, a.count.s], ['포크볼', '외각 낮음', 3, 2], '타석 구종·코스·B-S = 마지막 공(포크볼 · 3-2 직전)');
    eq(a.pitches.map(function (p) { return p.balls + '-' + p.strikes; }), ['0-0', '1-0', '1-1', '1-2', '1-2', '2-2', '3-2'], '공마다 직전 카운트도 결과 순서로');
    eq(_pWarn(a), [], '정합성 경고 없음');
    eq(AS.currentPitches.length, 0, '이번 타석 투구 비움'); eq(AS.balls + '-' + AS.strikes, '0-0', '카운트 초기화');
    ok(!document.querySelector('#countBoard').classList.contains('cnt-auto'), '다음 타석은 다시 수기 모드');
    ok([].every.call(document.querySelectorAll('.pr-bar'), function (b) { return b.hidden; }), '결과 버튼 줄 숨김');
    eq(AS.batter && AS.batter.id, 'ps2', '다음 타자');

    // 되돌리기: 결과가 있던 타석은 마지막 공을 뺀 투구가 이번 타석으로 돌아오고 B·S 도 결과로 다시 계산
    undoLast();
    eq(AS.abs.length, 0, '기록 취소'); eq(AS.batter && AS.batter.id, 'ps1', '그 타자로');
    eq(AS.currentPitches.length, 6, '마지막 공을 뺀 6구 복귀'); eq(AS.balls + '-' + AS.strikes, '3-2', '3-2 복귀(자동)');
  });

  run('기록 탭: 3번째 스트라이크(루킹·스윙)는 삼진 자동 기록 · 인플레이는 기록하지 않고 필드 안내만', async function () {
    pitch('직구', '중앙 중간', 'called_strike');
    pitch('직구', '중앙 중간', 'foul');
    pitch('슬라이더', '외각 낮음', 'swinging_strike');
    eq(AS.abs.length, 1, '삼진 기록'); eq(AS.abs[0].res, '삼진', '결과'); eq([AS.abs[0].count.b, AS.abs[0].count.s], [0, 2], '0-2 직전'); eq(AS.abs[0].pt, '슬라이더', '마지막 공 구종');
    await T.sleep(750);
    pitch('체인지업', '외각 낮음', 'in_play');
    eq(AS.abs.length, 1, '인플레이만으로는 기록 안 함'); eq(AS.currentPitches.length, 1, '공은 남음');
  });

  run('정합성 경고: 인플레이 결과인데 마지막 공이 인플레이 아님 · 볼넷인데 볼 < 4 · 볼넷/삼진인데 마지막 공 인플레이 — 저장은 그대로', async function () {
    pitch('직구', '중앙 중간', 'ball');
    recOther('땅볼 아웃');
    eq(AS.abs.length, 1, '저장은 막지 않음');
    eq(_pWarn(AS.abs[0]), ['땅볼 아웃인데 마지막 공이 볼'], '인플레이인데 마지막 공 볼');
    await T.sleep(750);
    pitch('직구', '중앙 중간', 'in_play');
    recOther('볼넷');
    eq(_pWarn(AS.abs[1]), ['볼넷인데 볼 0개', '볼넷인데 마지막 공이 인플레이'], '볼넷 경고 두 개');
    await T.sleep(750);
    pitch('직구', '중앙 중간'); pitch('커브', '외각 낮음', 'swinging_strike');
    recOther('삼진');
    eq(_pWarn(AS.abs[2]), ['삼진인데 스트라이크 1개 · 결과 미기록 1구'], '삼진인데 스트라이크 < 3 (미기록 공 수 함께)');
    // 기록 화면 표시
    renderRecs();
    var t = $('recList').textContent;
    ok((t.match(/확인 필요/g) || []).length === 3, '타석 목록에 확인 필요 3개 — ' + t);
    // 결과 없는 로그·로그 없는 타석: 수기 B-S 로 삼진·볼넷만 본다
    eq(_pWarn({ res: '삼진', count: { b: 0, s: 0 }, pitches: [] }), ['삼진인데 B-S 0-0 (2스트라이크 아님)'], '수기 0-0 삼진');
    eq(_pWarn({ res: '볼넷', count: { b: 3, s: 1 }, pitches: [{ pt: '직구', result: null }] }), [], '수기 3-1 볼넷은 정상');
    eq(_pWarn({ res: '안타', count: { b: 0, s: 0 }, pitches: [] }), [], '로그 없는 인플레이 타석은 판단 안 함');
  });

  run('수정 창: 투구 로그가 있는 타석은 구종·코스가 마지막 공 값으로 읽기 전용 — 바꿔 저장해도 마지막 공 값 유지 · 로그 없는 타석은 그대로 수정', async function () {
    // 수정 저장은 지금 열린 경기 항목에 바로 쓴다 — 테스트용 저장 항목(끝나면 localStorage 통째로 되돌림)
    localStorage.setItem('sl_900000000009', JSON.stringify({ th: '정합', ta: '상대', abs: [], ts: 1 }));
    localStorage.setItem('sl_saves', JSON.stringify((JSON.parse(localStorage.getItem('sl_saves') || '[]')).concat([{ key: 'sl_900000000009', label: '테스트', ts: 1 }])));
    window._curSaveKey = 'sl_900000000009';
    pitch('직구', '중앙 중간', 'ball'); pitch('포크볼', '외각 낮음', 'swinging_strike');
    recOther('희타');
    var a = AS.abs[0];
    openEditRec(a.id);
    ok($('editPt').disabled && $('editZone').disabled, '구종·코스 읽기 전용');
    eq([$('editPt').value, $('editZone').value], ['포크볼', '외각 낮음'], '마지막 공 값 표시');
    ok(!$('editLogInfo').hidden && /B-S/.test($('editLogInfo').textContent) && /확인 필요/.test($('editLogInfo').textContent), '자동 B-S · 확인 필요 표시 — ' + $('editLogInfo').textContent);
    $('editPt').value = '직구'; $('editRes').value = '땅볼 아웃';
    saveEditRec();
    eq([a.res, a.pt, a.zone], ['땅볼 아웃', '포크볼', '외각 낮음'], '결과만 바뀌고 구종·코스는 마지막 공');
    eq(JSON.parse(localStorage.getItem('sl_900000000009')).abs[0].pt, '포크볼', '저장값도 마지막 공');
    await T.sleep(750);
    AS.pt = '커브'; AS.zone = '내각 낮음';
    recOther('삼진');   // 투구 로그 없는 타석
    var b = AS.abs[1];
    eq([b.pt, b.zone, b.pitches.length], ['커브', '내각 낮음', 0], '로그 없는 타석은 수기값');
    openEditRec(b.id);
    ok(!$('editPt').disabled, '로그 없으면 수정 가능');
    $('editPt').value = '체인지업';
    saveEditRec();
    eq(b.pt, '체인지업', '수기 수정 반영');
  });

  run('투수 탭 연동: 한글 결과는 enum 으로(스트라이크 → strike) · 카운트·경고는 strike 를 스트라이크로 · 투수 탭 자체 로그는 한글 그대로', async function () {
    AS.pitchers = [{ id: 'psp', name: '연동투수', num: '1', role: null, pitches: [] }];
    selectPitcher('psp');
    AS.pitcherPt = '직구'; AS.pitcherZone = '중앙 중간';
    recordPitch('스트라이크'); recordPitch('볼'); recordPitch('스트라이크'); recordPitch('스트라이크');
    eq(AS.abs.length, 1, '삼진 기록'); var a = AS.abs[0];
    eq(ress(a.pitches), ['strike', 'ball', 'strike', 'strike'], 'enum 매핑'); eq(seqs(a.pitches), [1, 2, 3, 4], '순번');
    eq([a.count.b, a.count.s], [1, 2], 'B-S = 마지막 공 직전 1-2'); eq(_pWarn(a), [], '경고 없음');
    eq(AS.pitchers[0].pitches.map(function (p) { return p.result; }), ['스트라이크', '볼', '스트라이크', '삼진'], '투수 탭 로그는 그대로');
  });

  // 구버전 저장 데이터 (seq · result enum 없음). 투수 탭 연동 공은 result 에 한글
  function legacyGame() {
    return {
      th: '정합', ta: '상대', hs: 1, as: 0, d: '2026. 10. 1.', ts: 1790000000000,
      home_lineup: [{ id: 'lg1', name: '구버전타자', num: '3' }], away_lineup: [],
      pitchers: [{ id: 'lgp', name: '구투수', pitches: [{ id: 1, result: '볼', pt: '직구', zone: '볼 외', batter: '구버전타자' }] }],
      abs: [
        // ① 수기 입력이 어긋난 타석: 타석은 '직구 중앙 중간 0-0', 마지막 공은 '포크볼 외각 낮음 2-2' (결과 없음 → B-S 는 수기값 유지)
        { id: 101, bid: 'lg1', bname: '구버전타자', res: '삼진', pt: '직구', zone: '중앙 중간', count: { b: 0, s: 0, o: 1 }, inn: '1회말',
          pitches: [{ zone: '외각 낮음', pt: '슬라이더', balls: 0, strikes: 0 }, { zone: '외각 낮음', pt: '포크볼', balls: 2, strikes: 2 }] },
        // ② 투수 탭 연동(한글 결과): 볼넷 — 수기 B-S 0-0 이었지만 결과로 3-1
        { id: 102, bid: 'lg1', bname: '구버전타자', res: '볼넷', pt: null, zone: null, count: { b: 0, s: 0, o: 2 }, inn: '3회말',
          pitches: [{ pt: '직구', zone: '볼 위', result: '볼' }, { pt: '직구', zone: '중앙 중간', result: '스트라이크' }, { pt: '커브', zone: '볼 아래', result: '볼' },
            { pt: '직구', zone: '볼 내', result: '볼' }, { pt: '슬라이더', zone: '볼 외', result: '볼넷' }] },
        // ③ 투수 탭 연동: 안타 (파울 포함) · 알 수 없는 값은 null
        { id: 103, bid: 'lg1', bname: '구버전타자', res: '안타', pt: '직구', zone: '중앙 중간', count: { b: 0, s: 0, o: 0 }, inn: '5회말',
          pitches: [{ pt: '체인지업', zone: '외각 낮음', result: '파울' }, { pt: '직구', zone: '중앙 높음', result: '이상한값' }, { pt: '직구', zone: '내각 높음', result: '안타' }] },
        // ④ 투구 로그 없는 타석: 그대로
        { id: 104, bid: 'lg1', bname: '구버전타자', res: '플라이 아웃', pt: '커브', zone: '외각 중간', count: { b: 1, s: 1, o: 0 }, inn: '7회말', pitches: [] },
      ],
    };
  }

  test('마이그레이션: 구버전 저장 경기 1회 변환 — seq·result 부여, 타석 구종·코스(·결과 있으면 B-S)는 마지막 공, 이전 값 백업, 두 번째는 건너뜀', async function () {
    var ls = snapLS(), warn0 = console.warn, warned = [];
    console.warn = function () { warned.push([].slice.call(arguments).join(' ')); };
    try {
      localStorage.setItem('sl_900000000001', JSON.stringify(legacyGame()));
      localStorage.setItem('sl_auto_ps_mig', JSON.stringify(legacyGame()));
      localStorage.setItem('sl_saves', JSON.stringify((JSON.parse(ls.sl_saves || '[]')).concat([{ key: 'sl_900000000001', label: '정합 vs 상대', ts: 1790000000000 }])));
      localStorage.removeItem('sl_schema_ver'); localStorage.removeItem('sl_migr_v2');
      var r = _pMigrateStored();
      ok(r && r.games >= 2 && !r.fail, '변환 결과 ' + JSON.stringify(r));
      eq(localStorage.getItem('sl_schema_ver'), '2', '스키마 버전');
      ['sl_900000000001', 'sl_auto_ps_mig'].forEach(function (k) {
        var d = JSON.parse(localStorage.getItem(k)), A = d.abs;
        eq(seqs(A[0].pitches), [1, 2], k + ' ① seq 저장 순서'); eq(ress(A[0].pitches), [null, null], '① result null');
        eq([A[0].pt, A[0].zone, A[0].count], ['포크볼', '외각 낮음', { b: 0, s: 0, o: 1 }], '① 구종·코스 = 마지막 공, 결과 없으니 B-S 는 수기값');
        eq(_pWarn(A[0]), ['삼진인데 B-S 0-0 (2스트라이크 아님)'], '① 확인 필요');
        eq(ress(A[1].pitches), ['ball', 'strike', 'ball', 'ball', 'ball'], '② 한글 → enum (볼넷 = ball)');
        eq([A[1].pt, A[1].zone, A[1].count], ['슬라이더', '볼 외', { b: 3, s: 1, o: 2 }], '② B-S 3-1 (아웃은 그대로)');
        eq(_pWarn(A[1]), [], '② 정상');
        eq(ress(A[2].pitches), ['foul', null, 'in_play'], '③ 파울·알 수 없는 값(null)·안타');
        eq([A[2].pt, A[2].zone, A[2].count.b, A[2].count.s], ['직구', '내각 높음', 0, 1], '③ 마지막 공 · 0-1');
        eq([A[3].pt, A[3].zone, A[3].count, A[3].pitches], ['커브', '외각 중간', { b: 1, s: 1, o: 0 }, []], '④ 로그 없는 타석 그대로');
        eq(d.pitchers[0].pitches[0].result, '볼', '투수 탭 자체 로그는 그대로');
      });
      ok(warned.some(function (w) { return w.indexOf('이상한값') >= 0; }), '알 수 없는 값은 콘솔 경고');
      var bak = JSON.parse(localStorage.getItem('sl_migr_v2'));
      var b1 = bak.list.find(function (x) { return x.k === 'sl_900000000001' && x.id === 101; });
      eq([b1.pt, b1.zone], ['직구', '중앙 중간'], '덮어쓴 이전 값 백업');
      eq(_pMigrateStored(), null, '두 번째 실행은 버전으로 건너뜀');
      localStorage.removeItem('sl_schema_ver');
      var r2 = _pMigrateStored();
      eq([r2.games, r2.overwritten], [0, 0], '다시 돌려도 바뀌는 것 없음(멱등)');
    } finally { console.warn = warn0; restoreLS(ls); }
  });

  test('시작 뒤 들어온 구버전 경기(가져오기 등)도 분석·엑셀이 읽을 때 마지막 공 기준 — 저장값은 읽기만', async function () {
    var ls = snapLS();
    try {
      localStorage.setItem('sl_900000000002', JSON.stringify(legacyGame()));
      localStorage.setItem('sl_saves', JSON.stringify((JSON.parse(ls.sl_saves || '[]')).concat([{ key: 'sl_900000000002', label: '정합 vs 상대', ts: 1790000000000 }])));
      var raw = localStorage.getItem('sl_900000000002');
      var B = await import('/js/features/batdata.js?v=8');
      var g = B.buildData().games.find(function (x) { return x.key === 'sl_900000000002'; });
      eq([g.abs[0].pt, g.abs[1].count.b, g.abs[1].count.s], ['포크볼', 3, 1], '읽은 값은 마지막 공 기준');
      eq(localStorage.getItem('sl_900000000002'), raw, '저장값은 그대로(경기를 열어 저장할 때 반영)');
    } finally { restoreLS(ls); }
  });

  // 무압축(STORE) xlsx → { 시트 이름: [[셀 값…]…] }
  async function readXlsx(blob) {
    var u8 = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(u8.buffer), files = {}, i = 0, dec = new TextDecoder();
    while (i + 30 <= u8.length && dv.getUint32(i, true) === 0x04034b50) {
      var size = dv.getUint32(i + 18, true), nl = dv.getUint16(i + 26, true), xl = dv.getUint16(i + 28, true);
      var name = dec.decode(u8.subarray(i + 30, i + 30 + nl));
      files[name] = u8.subarray(i + 30 + nl + xl, i + 30 + nl + xl + size);
      i += 30 + nl + xl + size;
    }
    var P = new DOMParser(), out = {};
    var wb = P.parseFromString(dec.decode(files['xl/workbook.xml']), 'application/xml');
    [].forEach.call(wb.getElementsByTagName('sheet'), function (sh, k) {
      var x = P.parseFromString(dec.decode(files['xl/worksheets/sheet' + (k + 1) + '.xml']), 'application/xml');
      out[sh.getAttribute('name')] = [].map.call(x.getElementsByTagName('row'), function (row) {
        var r = [];
        [].forEach.call(row.getElementsByTagName('c'), function (c) {
          var col = c.getAttribute('r').replace(/\d+/g, ''), ci = 0;
          for (var j = 0; j < col.length; j++) ci = ci * 26 + col.charCodeAt(j) - 64;
          var t = c.getElementsByTagName('t')[0], v = c.getElementsByTagName('v')[0];
          r[ci - 1] = t ? t.textContent : v ? +v.textContent : '';
        });
        return r;
      });
    });
    return out;
  }

  run('엑셀(타자): 투구 기록에 타석 내 순번·투구 결과, 타석 기록에 확인 필요 — 기존 열 위치 그대로 · 타석 구종·코스·B-S = 마지막 공 행', async function () {
    useBatter(); pitch('직구', '내각 높음', 'called_strike'); pitch('슬라이더', '외각 낮음', 'ball'); pitch('포크볼', '외각 낮음', 'in_play');
    AS.pending = { x: 0.5, y: 0.3, deg: 90, dir: 'CF', ft: 300 }; AS.rbi = 0; recHit('안타');
    await T.sleep(750);
    useBatter(); pitch('직구', '중앙 중간', 'ball'); pitch('커브', '볼 아래');   // 결과 미기록 공 섞임
    recOther('땅볼 아웃');
    await T.sleep(750);
    useBatter(); AS.pt = '체인지업'; AS.zone = '외각 중간'; recOther('삼진');   // 로그 없는 타석 (수기 0-0 → 확인 필요)
    var B = await import('/js/features/batdata.js?v=8'), X = await import('/js/features/xlsxreport.js?v=10');
    var blob = null, u0 = URL.createObjectURL;
    URL.createObjectURL = function (b) { blob = b; return u0.call(URL, b); };
    try { X.exportBatterXlsx(B.playerData(B.buildData(), '정합타자')); } finally { URL.createObjectURL = u0; }
    ok(blob, '엑셀 파일 생성');
    var wb = await readXlsx(blob);
    var rec = wb['타석 기록'], pit = wb['투구 기록'];
    eq(rec[0].slice(0, 18), ['번호', '경기', '이닝', '결과', '구종', '코스', '방향', '거리(ft)', '타구속도', '발사각', '타구 유형', 'B-S', '아웃', '타점', '투구 수', '타구 X', '타구 Y', '확인 필요'], '타석 기록 머리글 (기존 17열 + 확인 필요)');
    eq(pit[0].slice(0, 14), ['순번', '경기', '타석 번호', '이닝', '구종', '코스', 'B-S', '투수', '위치 기록', '위치 X', '위치 Y', '타석 결과', '타석 내 순번', '투구 결과'], '투구 기록 머리글 (기존 12열 + 2열)');
    var cur = rec.slice(1).filter(function (r) { return r[1] === '현재 경기'; });
    eq(cur.length, 3, '이번 경기 3타석');
    cur.forEach(function (r) {
      var ps = pit.slice(1).filter(function (p) { return p[2] === r[0]; });
      var last = ps.reduce(function (m, p) { return !m || (+p[12] || 0) > (+m[12] || 0) ? p : m; }, null);
      eq([r[4], r[5], r[11]], [last[4], last[5], last[6]], r[0] + '번 타석 구종·코스·B-S = 마지막 공 행');
    });
    eq(cur.map(function (r) { return r[3]; }), ['안타', '땅볼 아웃', '삼진'], '결과');
    eq(cur.map(function (r) { return r[17] || ''; }), ['', '땅볼 아웃인데 마지막 공이 결과 미기록', '삼진인데 B-S 0-0 (2스트라이크 아님)'], '확인 필요 열');
    var p1 = pit.slice(1).filter(function (p) { return p[2] === cur[0][0]; });
    eq(p1.map(function (p) { return [p[12], p[13], p[6]]; }), [[1, '루킹', '0-0'], [2, '볼', '0-1'], [3, '인플레이', '1-1']], '순번 · 결과 · 공마다 B-S');
    var p3 = pit.slice(1).filter(function (p) { return p[2] === cur[2][0]; });
    eq(p3.map(function (p) { return [p[4], p[12] === undefined ? '' : p[12], p[13] === undefined ? '' : p[13]]; }), [['체인지업', '', '']], '로그 없는 타석은 결정구 1행 · 순번·결과 빈 칸');
    ok(wb['리포트'].some(function (r) { return r.some(function (v) { return /확인 필요 2타석/.test(String(v)); }); }), '리포트 메모에 확인 필요 타석 수');
  });
})();
