// 투수 탭 투구 삭제 · 되돌리기 검증 (core.js undoPitch / delPitch / undoLast ↔ 투수 탭 연동)
//  · 최근 투구 로그: ↩ 되돌리기(마지막 공) · 줄마다 ✕ — 기록 탭 볼카운트 · 이번 타석 투구도 같이 되돌린다
//  · 삼진을 되돌린 뒤 다시 삼진을 넣어도 투수 쪽 삼진은 하나 (예전엔 기록 탭 타석만 지워져 투수 쪽 삼진이 두 개가 됐다)
//  · 기록 탭 타석 ✕(delRec): 투수 탭의 그 타석 공 전부 삭제 · 「수정」(saveEditRec): 결과 · 이닝을 투수 쪽 공에 반영
//  · 사구: 투수 탭 버튼 · 투수 분석(타석 종료 · 볼 · 타수 제외 · FIP)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;

  function snapKeys() { var o = {}; for (var i = 0; i < localStorage.length; i++) o[localStorage.key(i)] = 1; return o; }
  function save() {
    var s = $('innSel');
    return { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, team: AS.curTeam, batter: AS.batter, bf: AS.batterFilter,
      b: AS.balls, s: AS.strikes, o: AS.outs, pitchers: AS.pitchers, cp: AS.currentPitcher, pl: AS.pitchLog, cps: AS.currentPitches,
      pt: AS.pitcherPt, pz: AS.pitcherZone, inn: s ? s.selectedIndex : 0, curGame: AS.curGame, autoKey: window._autoKey, saveKey: window._curSaveKey, saved: window._gameSaved, keys: snapKeys(),
      saves: localStorage.getItem('sl_saves') };
  }
  function restore(S) {
    clearTimeout(window._autoTimer);
    AS.abs = S.abs; AS.home_lineup = S.hl; AS.away_lineup = S.al; AS.curTeam = S.team; AS.batter = S.batter; AS.batterFilter = S.bf;
    AS.balls = S.b; AS.strikes = S.s; AS.outs = S.o; AS.pitchers = S.pitchers; AS.currentPitcher = S.cp; AS.pitchLog = S.pl; AS.currentPitches = S.cps;
    AS.pitcherPt = S.pt; AS.pitcherZone = S.pz; AS.pendingQuickRes = null; AS.pending = null; AS.curGame = S.curGame; window._autoKey = S.autoKey; window._curSaveKey = S.saveKey; window._gameSaved = S.saved;
    if (S.saves != null) localStorage.setItem('sl_saves', S.saves);
    var s = $('innSel'); if (s) s.selectedIndex = S.inn;
    Object.keys(snapKeys()).forEach(function (k) { if (!S.keys[k]) localStorage.removeItem(k); });
    try { closeOverlay('editRecOverlay'); } catch (e) {}
    try { _clearFieldTapPrompt(); renderLP(); renderRecs(); renderCount(); renderPitcherRoster(); renderPitchLog(); } catch (e) {}
    try { shellNav('record'); } catch (e) {}
  }
  function setup() {
    ok(!(typeof GF !== 'undefined' && GF && GF.active), '경기 운영 모드가 꺼진 상태에서 검사');
    AS.curTeam = 'home';
    AS.home_lineup = [{ id: 'pu1', name: '첫타자', num: '1', pos: '', bh: '', isStarter: true }, { id: 'pu2', name: '둘째타자', num: '2', pos: '', bh: '', isStarter: true }];
    AS.away_lineup = [];
    AS.abs = []; AS.batter = null; AS.balls = 0; AS.strikes = 0; AS.outs = 0;
    AS.pitchers = []; AS.currentPitcher = null; AS.pitchLog = []; AS.currentPitches = []; AS.pendingQuickRes = null;
    var s = $('innSel'); if (s) s.selectedIndex = 0;
    selBatter('pu1');
    AS.pitchers = [{ id: 'pp1', name: '되돌리기투수', num: '21', role: null, pitches: [] }];
    selectPitcher('pp1');
    AS.pitcherPt = '직구'; AS.pitcherZone = '중앙 중간';
    eq(AS.batter && AS.batter.id, 'pu1', '타자 선택');
  }
  // recHit/recOther 의 연타 방지 가드(0.7초)가 앞 기록을 기억하므로 기다린다 · 클라우드 자동 동기화는 끈다
  function run(name, fn) {
    test(name, async function () {
      var S = save(), sync0 = window.cloudAutoSyncRecord, conf0 = window.confirm;
      window.cloudAutoSyncRecord = function () {};
      try { setup(); await T.sleep(750); await fn(); } finally { restore(S); window.cloudAutoSyncRecord = sync0; window.confirm = conf0; }
    });
  }
  var P = function () { return AS.pitchers[0].pitches; };
  var res = function () { return P().map(function (e) { return e.result; }); };
  var ks = function () { return P().filter(function (e) { return e.result === '삼진'; }).length; };

  run('↩ 되돌리기: 마지막 공을 지우고 볼카운트 · 이번 타석 투구도 한 공 전으로', function () {
    recordPitch('볼'); recordPitch('스트라이크'); recordPitch('볼');
    eq([AS.balls, AS.strikes], [2, 1], '2-1');
    ok(!$('pitchUndoBtn').disabled, '되돌리기 버튼 켜짐');
    eq($('pitchLog').querySelectorAll('.pitch-entry .pitch-del').length, 3, '줄마다 ✕');
    undoPitch();
    eq(res(), ['볼', '스트라이크'], '투수 쪽 2구'); eq([AS.balls, AS.strikes], [1, 1], '1-1 로 복귀'); eq(AS.currentPitches.length, 2, '이번 타석 투구 2구');
    eq(AS.pitchLog.length, 2, '전체 투구 로그도 2구'); eq($('pitchLog').querySelectorAll('.pitch-entry').length, 2, '로그 2줄');
    undoPitch(); undoPitch();
    eq(P().length, 0, '모두 취소'); eq([AS.balls, AS.strikes], [0, 0], '0-0'); eq(AS.currentPitches.length, 0, '이번 타석 투구 없음');
    ok($('pitchUndoBtn').disabled, '지울 공이 없으면 되돌리기 버튼 꺼짐');
    undoPitch();
    eq(P().length, 0, '빈 상태에서 눌러도 오류 없음');
  });

  run('✕: 이번 타석 가운데 공을 지우면 뒤 공들의 카운트를 다시 센다', function () {
    recordPitch('볼'); recordPitch('스트라이크'); recordPitch('볼');
    var first = P()[0].id;
    $('pitchLog').querySelectorAll('.pitch-del')[2].click();   // 로그는 최근 순 → 세 번째 줄이 첫 공
    ok(!P().some(function (e) { return e.id === first; }), '첫 공 삭제');
    eq(res(), ['스트라이크', '볼'], '남은 공'); eq([AS.balls, AS.strikes], [1, 1], '1-1');
    eq(AS.currentPitches.map(function (x) { return [x.result, x.balls, x.strikes]; }), [['스트라이크', 0, 0], ['볼', 0, 1]], '던지기 직전 카운트 다시 계산');
  });

  run('삼진 → 기록 탭 되돌리기(지우개·토스트) → 다시 삼진: 투수 쪽 삼진은 하나', async function () {
    recordPitch('스트라이크'); recordPitch('스트라이크'); recordPitch('스트라이크');
    eq(AS.abs.length, 1, '삼진 타석'); eq(ks(), 1, '투수 쪽 삼진 1');
    eq(AS.batter && AS.batter.id, 'pu2', '다음 타자로');
    undoLast();
    eq(AS.abs.length, 0, '타석 취소'); eq(res(), ['스트라이크', '스트라이크'], '투수 쪽 삼진 공도 취소');
    eq([AS.balls, AS.strikes], [0, 2], '0-2 로 복귀'); eq(AS.batter && AS.batter.id, 'pu1', '그 타자로 복귀');
    eq(AS.currentPitches.length, 2, '그 타석의 앞 공 2구가 이번 타석 투구로 돌아옴');
    await T.sleep(750);
    recordPitch('스트라이크');
    eq(AS.abs.length, 1, '다시 삼진 타석'); eq(AS.abs[0].res, '삼진', '삼진');
    eq(ks(), 1, '투수 쪽 삼진은 여전히 1'); eq(P().length, 3, '투수 쪽 3구');
    eq(AS.abs[0].pitches.length, 3, '타석에도 3구 그대로');
  });

  run('삼진 공을 투수 탭에서 되돌리면 그 타석 기록도 같이 취소', function () {
    recordPitch('볼'); recordPitch('스트라이크'); recordPitch('스트라이크'); recordPitch('스트라이크');
    eq(AS.abs.length, 1, '삼진 타석'); eq(P()[3].result, '삼진', '마지막 공 삼진');
    undoPitch();
    eq(AS.abs.length, 0, '타석도 취소'); eq(res(), ['볼', '스트라이크', '스트라이크'], '투수 쪽 3구');
    eq([AS.balls, AS.strikes], [1, 2], '1-2 로 복귀'); eq(AS.currentPitches.length, 3, '이번 타석 투구 3구'); eq(AS.batter && AS.batter.id, 'pu1', '그 타자로 복귀');
  });

  run('기록 탭에서 끝낸 타석(투수 쪽에 마지막 공 추가)을 되돌리면 그 공도 취소', function () {
    recordPitch('볼'); recordPitch('스트라이크');
    recOther('병살');
    eq(res(), ['볼', '스트라이크', '병살'], '투수 쪽 마지막 공 추가');
    undoLast();
    eq(AS.abs.length, 0, '타석 취소'); eq(res(), ['볼', '스트라이크'], '추가됐던 공도 취소'); eq([AS.balls, AS.strikes], [1, 1], '1-1');
    eq(AS.currentPitches.length, 2, '앞 공 2구 되살림');
  });

  run('안타 → 필드 탭 대기 중에 되돌리면 대기도 취소', function () {
    recordPitch('볼'); recordPitch('안타');
    eq(AS.pendingQuickRes, '안타', '필드 탭 대기');
    undoPitch();
    eq(AS.pendingQuickRes, null, '대기 취소'); eq(res(), ['볼'], '투수 쪽 1구'); eq(AS.currentPitches.length, 1, '이번 타석 1구'); eq([AS.balls, AS.strikes], [1, 0], '1-0');
  });

  run('지난 타석을 끝낸 공을 ✕ 하면 확인 후 그 타석만 지우고 지금 카운트는 그대로', async function () {
    recordPitch('스트라이크'); recordPitch('스트라이크'); recordPitch('스트라이크');
    var k = P()[2].id;
    eq(AS.batter && AS.batter.id, 'pu2', '다음 타자');
    await T.sleep(750);
    recordPitch('볼'); recordPitch('볼'); recordPitch('볼'); recordPitch('볼');
    eq(AS.abs.length, 2, '삼진 · 볼넷'); eq(AS.abs[1].res, '볼넷', '볼넷');
    var asked = 0;
    window.confirm = function () { asked++; return false; };
    delPitch(k);
    eq(asked, 1, '확인 창'); eq(AS.abs.length, 2, '취소하면 그대로'); eq(P().length, 7, '투수 쪽도 그대로');
    window.confirm = function () { asked++; return true; };
    delPitch(k);
    eq(AS.abs.map(function (a) { return a.res; }), ['볼넷'], '삼진 타석만 삭제'); eq(ks(), 0, '투수 쪽 삼진 공 삭제'); eq(P().length, 6, '나머지 공은 그대로');
    eq([AS.balls, AS.strikes], [0, 0], '지금 카운트는 그대로');
  });

  run('끝난 타석의 가운데 공을 ✕ 하면 그 타석 투구 목록에서도 빠진다', function () {
    recordPitch('볼'); recordPitch('볼'); recordPitch('볼'); recordPitch('볼');
    eq(AS.abs.length, 1, '볼넷'); eq(AS.abs[0].pitches.length, 4, '4구');
    delPitch(P()[1].id);
    eq(AS.abs.length, 1, '타석은 그대로'); eq(AS.abs[0].pitches.length, 3, '타석 투구 3구'); eq(P().length, 3, '투수 쪽 3구');
  });

  // ── 기록 탭 타석 ✕ · 수정 → 투수 탭 ──
  function edit(id, res, inn) { openEditRec(id); $('editRes').value = res; if (inn) $('editInn').value = inn; saveEditRec(); }   // 앱의 "타석 기록 수정" 창

  run('기록 탭 ✕: 그 타석의 투수 쪽 공이 전부 지워지고, 다른 타석 공은 그대로', async function () {
    recordPitch('볼'); recordPitch('스트라이크'); recordPitch('스트라이크'); recordPitch('스트라이크');
    eq(AS.abs.length, 1, '첫 타석 삼진');
    await T.sleep(750);
    recordPitch('볼'); recordPitch('볼'); recordPitch('볼'); recordPitch('볼');
    eq(AS.abs.length, 2, '둘째 타석 볼넷'); eq(P().length, 8, '투수 쪽 8구');
    delRec(AS.abs[0].id);
    eq(AS.abs.map(function (a) { return a.res; }), ['볼넷'], '삼진 타석 삭제'); eq(res(), ['볼', '볼', '볼', '볼넷'], '투수 쪽은 볼넷 타석 4구만');
    eq(AS.pitchLog.length, 4, '전체 투구 로그도 4구'); ok(/\(4구\)/.test($('pitcherRoster').textContent), '투수 버튼 4구');
  });

  run('기록 탭 ✕: 기록 탭에서 끝낸 타석(투수 쪽에 덧붙인 마지막 공)도 전부 지운다 · 투수 탭을 안 쓴 타석은 투수 쪽 변화 없음', async function () {
    recordPitch('볼'); recordPitch('스트라이크');
    recOther('병살');
    eq(res(), ['볼', '스트라이크', '병살'], '투수 쪽 3구');
    await T.sleep(750);
    recOther('삼진');   // 둘째 타자: 투수 탭을 안 쓴 타석
    eq(AS.abs.length, 2, '두 타석'); eq(P().length, 3, '투구를 지어내지 않음');
    delRec(AS.abs[1].id);
    eq(P().length, 3, '투수 탭을 안 쓴 타석을 지워도 투수 쪽 그대로');
    delRec(AS.abs[0].id);
    eq(P().length, 0, '병살 타석 공 전부 삭제'); eq(AS.abs.length, 0, '타석 없음');
  });

  run('수정: 결과를 바꾸면 끝낸 공 결과도 바뀌고 · 이닝은 그 타석 공 전부에', function () {
    recordPitch('스트라이크'); recordPitch('스트라이크'); recordPitch('스트라이크');
    var id = AS.abs[0].id;
    edit(id, '땅볼 아웃', '2회초');
    eq(AS.abs[0].res, '땅볼 아웃', '타석 결과'); eq(res(), ['스트라이크', '스트라이크', '아웃'], '투수 쪽 끝낸 공 = 아웃'); eq(ks(), 0, '삼진 0');
    eq(P().map(function (e) { return e.inning; }), ['2회초', '2회초', '2회초'], '이닝 반영');
    eq(AS.abs[0].pitches[2].result, '아웃', '타석 투구 목록의 마지막 공도');
    edit(id, '홈런');
    eq(P()[2].result, '홈런', '다시 홈런으로'); eq(P().length, 3, '공 수 그대로');
  });

  run('수정: 사구로 바꾸면 투수 쪽 끝낸 공도 사구 · 다시 볼넷으로 고치면 볼넷', function () {
    recordPitch('볼'); recordPitch('볼'); recordPitch('볼'); recordPitch('볼');
    var id = AS.abs[0].id;
    eq(P()[3].result, '볼넷', '4번째 공 볼넷');
    edit(id, '사구');
    eq(res(), ['볼', '볼', '볼', '사구'], '끝낸 공 = 사구'); eq(AS.abs[0].pitches[3].result, '사구', '타석 투구 목록도 사구');
    edit(id, '볼넷');
    eq(res(), ['볼', '볼', '볼', '볼넷'], '다시 볼넷'); eq(P().length, 4, '공 수 그대로');
  });

  run('수정: 예전 버전에서 사구로 고치며 지웠던 끝낸 공은 다른 결과로 고치면 같은 공으로 되살린다', function () {
    AS.pitcherPt = '커브'; recordPitch('볼'); recordPitch('볼'); recordPitch('볼');
    AS.pitcherPt = '슬라이더'; AS.pitcherZone = '내각 낮음'; recordPitch('볼');
    var id = AS.abs[0].id, end = P()[3], endId = end.id;
    // 2026-10-13 #151 버전이 남긴 상태: 투수 쪽 끝낸 공은 지워지고, 타석 투구 목록의 그 공은 결과만 사구
    _dropPitch(AS.pitchers[0], end); AS.abs[0].res = '사구'; AS.abs[0].pitches[3].result = '사구';
    eq(res(), ['볼', '볼', '볼'], '예전 상태');
    edit(id, '볼넷');
    eq(res(), ['볼', '볼', '볼', '볼넷'], '끝낸 공 되살림'); eq(P()[3].id, endId, '같은 공(id)');
    eq([P()[3].pt, P()[3].zone, P()[3].abId], ['슬라이더', '내각 낮음', id], '구종 · 코스 · 타석 짝 그대로');
    eq(AS.abs[0].pitches[3].result, '볼넷', '타석 투구 목록도 볼넷');
  });

  run('수정: 끝낸 공이 없는 타석(예전에 기록 탭에서 사구로 끝낸 타석)을 고치면 투수 쪽에 끝낸 공을 보탠다 (뒤 타석 공보다 앞에)', async function () {
    recordPitch('볼'); recordPitch('스트라이크');
    recOther('사구');
    eq(res(), ['볼', '스트라이크', '사구'], '이제는 기록 탭 사구도 투수 쪽 타석을 사구로 닫는다');
    var id = AS.abs[0].id;
    _dropPitch(AS.pitchers[0], P()[2]);   // 사구가 투수 탭에 들어오기 전에 기록한 타석 (끝낸 공 없음)
    await T.sleep(750);
    recordPitch('스트라이크');   // 다음 타자 첫 공
    edit(id, '볼넷');
    eq(res(), ['볼', '스트라이크', '볼넷', '스트라이크'], '그 타석 마지막 공 다음 자리에 볼넷');
    eq(P()[2].abId, id, '타석 짝'); eq(P()[2].batter, '첫타자', '타자'); eq(P()[2].pt, null, '구종은 모름');
    ok(P()[2].id > P()[1].id && P()[2].id < P()[3].id, 'id 도 던진 순서');
    delRec(id);
    eq(res(), ['스트라이크'], '그 타석을 지우면 보탠 공까지 전부 삭제');
  });

  // ── 사구: 투수 탭 버튼 · 투수 분석 ──
  run('투수 탭 사구 버튼: 기록 탭에 사구 타석 · 카운트 초기화 · 다음 타자 · 되돌리면 그 타석도 취소', function () {
    var btns = Array.prototype.filter.call(document.querySelectorAll('#pnl-pitcher .ptr-btn'), function (b) { return b.textContent.trim() === '사구'; });
    eq(btns.length, 2, '사구 버튼 (모바일 패널 · 데스크톱)');
    recordPitch('볼'); recordPitch('스트라이크');
    btns[1].click();
    eq(res(), ['볼', '스트라이크', '사구'], '투수 쪽 3구'); eq(AS.abs.length, 1, '타석 기록'); eq(AS.abs[0].res, '사구', '사구');
    eq(AS.abs[0].pitches.length, 3, '3구 첨부'); eq([AS.balls, AS.strikes], [0, 0], '카운트 초기화'); eq(AS.batter && AS.batter.id, 'pu2', '다음 타자');
    undoPitch();
    eq(AS.abs.length, 0, '타석 취소'); eq(res(), ['볼', '스트라이크'], '사구 공 취소'); eq([AS.balls, AS.strikes], [1, 1], '1-1');
  });

  run('투수 분석: 사구는 타석을 끝내고 · 볼로 세고 · 타수에서 빠지고 · FIP 에 들어간다', async function () {
    var pz = function (r) { return { id: 'hb' + Math.random(), inning: '1회초', zone: null, zoneX: null, zoneY: null, pt: '직구', result: r, batter: '가타자', ts: '' }; };
    // 삼진 3 (1이닝) · 사구 · 볼넷 · 홈런 → 6타석 · 6구
    AS.pitchers = [{ id: 'hb1', name: '사구투수', num: '5', role: null, pitches: ['삼진', '삼진', '삼진', '사구', '볼넷', '홈런'].map(pz) }];
    AS.currentPitcher = AS.pitchers[0];
    shellNav('analysis', 'pitcher');
    setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '사구투수');
    var kpi = {};
    Array.prototype.forEach.call(document.querySelectorAll('#pitcherView .pc-kpi'), function (el) { kpi[el.querySelector('span').textContent] = [el.querySelector('b').textContent, (el.querySelector('small') || {}).textContent || '']; });
    eq(kpi['스트라이크%'][1], '4/6구', '사구 · 볼넷은 볼');
    eq(kpi['피안타율'], ['.250', '1/4'], '타수 4 (6타석 − 볼넷 − 사구)');
    eq(kpi['FIP'][0], '16.10', 'FIP = (13×1 + 3×(1+1) − 2×3) ÷ 1 + 3.10');
    eq(kpi['볼넷%'][1], '1개 · 사구 1', '볼넷% 는 볼넷만, 사구 수는 따로');
    ok(/상대 6타자/.test(document.querySelector('#pitcherView .pc-meta').textContent), '사구도 상대 타자(타석)에 들어감');
    ok(/사구 1/.test(document.querySelector('#pitcherView .pc-bat-who small').textContent), '상대 타자 카드에 사구');
    ok(Array.prototype.some.call(document.querySelectorAll('#pitcherView .pc-bat-res i'), function (i) { return i.textContent === '사구' && i.className === 'r-bb'; }), '결과 칩 사구');
    setPitcherView('mode', 'input');
    ok(/볼넷·사구/.test(document.querySelector('#pitcherView .pc-live').textContent), '등판 중 카드: 볼넷·사구');
    setPitcherView('mode', 'stats');
  });
})();
