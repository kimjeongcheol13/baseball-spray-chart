// 볼카운트 자동 기록 · 투수 탭 ↔ 기록 탭 연동 검증 (core.js chCount / recordPitch / _pitchToRecord / _recordToPitch)
//  · 기록 탭 COUNT: 4볼 → 볼넷, 3스트라이크 → 삼진이 타석 기록(AS.abs)에 들어가고 카운트는 0-0 · 3아웃 → 다음 이닝
//  · 투수 탭(recordPitch): 공 하나하나가 볼카운트·이번 타석 투구(currentPitches)로 이어지고, 4번째 볼/3번째 스트라이크는 볼넷/삼진으로 양쪽에 기록
//  · 기록 탭에서 끝난 타석: 투수 탭에 같은 타자의 열린 타석이 있을 때만 마지막으로 기록된 공에 결과를 달아 닫는다 (공을 보태지 않는다)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, $ = T.$;

  function snapKeys() { var o = {}; for (var i = 0; i < localStorage.length; i++) o[localStorage.key(i)] = 1; return o; }
  function save() {
    var s = $('innSel');
    return { abs: AS.abs, hl: AS.home_lineup, al: AS.away_lineup, team: AS.curTeam, batter: AS.batter, bf: AS.batterFilter,
      b: AS.balls, s: AS.strikes, o: AS.outs, pitchers: AS.pitchers, cp: AS.currentPitcher, pl: AS.pitchLog, cps: AS.currentPitches,
      pt: AS.pitcherPt, pz: AS.pitcherZone, inn: s ? s.selectedIndex : 0, curGame: AS.curGame, autoKey: window._autoKey, saved: window._gameSaved, keys: snapKeys() };
  }
  function restore(S) {
    clearTimeout(window._autoTimer);
    AS.abs = S.abs; AS.home_lineup = S.hl; AS.away_lineup = S.al; AS.curTeam = S.team; AS.batter = S.batter; AS.batterFilter = S.bf;
    AS.balls = S.b; AS.strikes = S.s; AS.outs = S.o; AS.pitchers = S.pitchers; AS.currentPitcher = S.cp; AS.pitchLog = S.pl; AS.currentPitches = S.cps;
    AS.pitcherPt = S.pt; AS.pitcherZone = S.pz; AS.pendingQuickRes = null; AS._pitchEndInn = null; AS._pitchEndOuts = null; AS._pitchInnAuto = null; AS.pending = null; AS.curGame = S.curGame; window._autoKey = S.autoKey; window._gameSaved = S.saved;
    var s = $('innSel'); if (s) s.selectedIndex = S.inn;
    Object.keys(snapKeys()).forEach(function (k) { if (!S.keys[k]) localStorage.removeItem(k); });   // 자동저장·GA 표식 등 테스트가 남긴 키 제거
    try { _clearFieldTapPrompt(); renderLP(); renderRecs(); renderCount(); renderPitcherRoster(); renderPitchLog(); } catch (e) {}
    try { shellNav('record'); } catch (e) {}
  }
  function setup(withPitcher) {
    ok(!(typeof GF !== 'undefined' && GF && GF.active), '경기 운영 모드가 꺼진 상태에서 검사');
    AS.curTeam = 'home';
    AS.home_lineup = [{ id: 'cl1', name: '첫타자', num: '1', pos: '', bh: '', isStarter: true }, { id: 'cl2', name: '둘째타자', num: '2', pos: '', bh: '', isStarter: true }];
    AS.away_lineup = [];
    AS.abs = []; AS.batter = null; AS.balls = 0; AS.strikes = 0; AS.outs = 0;
    AS.pitchers = []; AS.currentPitcher = null; AS.pitchLog = []; AS.currentPitches = []; AS.pendingQuickRes = null;
    var s = $('innSel'); if (s) s.selectedIndex = 0;
    selBatter('cl1');
    eq(AS.batter && AS.batter.id, 'cl1', '타자 선택');
    if (withPitcher) {
      AS.pitchers = [{ id: 'cp1', name: '테스트투수', num: '11', role: null, pitches: [] }];
      selectPitcher('cp1');
      window._pitchInnAskedFor = AS.pitchers;   // P1: 경기 첫 공의 이닝 묻기는 tests/pitching-p1.test.js 에서 따로 본다
      AS.pitcherPt = '직구'; AS.pitcherZone = '중앙 중간';
      eq(AS.currentPitcher && AS.currentPitcher.id, 'cp1', '투수 선택');
    }
  }
  // recHit/recOther 의 연타 방지 가드(0.7초)가 앞 테스트의 기록을 기억하므로 먼저 풀리길 기다린다 · 클라우드 자동 동기화(3초 디바운스)는 끈다
  function run(name, withPitcher, fn) {
    test(name, async function () {
      var S = save(), sync0 = window.cloudAutoSyncRecord;
      window.cloudAutoSyncRecord = function () {};
      try { setup(withPitcher); await T.sleep(750); await fn(); } finally { restore(S); window.cloudAutoSyncRecord = sync0; }
    });
  }
  var P = function () { return AS.pitchers[0].pitches; };

  run('볼카운트: 볼 4개 → 볼넷이 타석 기록에 들어가고 카운트는 0-0, 다음 타자로', false, function () {
    chCount('b'); chCount('b'); chCount('b');
    eq(AS.balls, 3, '3볼'); eq(AS.abs.length, 0, '아직 기록 없음');
    chCount('b');
    eq(AS.abs.length, 1, '볼넷 기록'); eq(AS.abs[0].res, '볼넷', '결과'); eq(AS.abs[0].bname, '첫타자', '타자');
    eq(AS.abs[0].count, { b: 3, s: 0, o: 0 }, '기록 시점 카운트(마지막 공 직전)');
    eq([AS.balls, AS.strikes, AS.outs], [0, 0, 0], '카운트 초기화');
    eq(AS.batter && AS.batter.id, 'cl2', '다음 타자');
  });

  run('지우개: 자동 기록된 볼넷을 되돌리면 3볼 카운트와 그 타자로 돌아온다', false, function () {
    chCount('b'); chCount('b'); chCount('s'); chCount('b'); chCount('b');
    eq(AS.abs.length, 1, '볼넷 기록'); eq(AS.batter && AS.batter.id, 'cl2', '다음 타자');
    undoLast();
    eq(AS.abs.length, 0, '기록 취소'); eq([AS.balls, AS.strikes], [3, 1], '3-1 카운트 복귀'); eq(AS.batter && AS.batter.id, 'cl1', '그 타자로 복귀');
  });

  run('볼카운트: 스트라이크 3개 → 삼진 (아웃은 기존대로 O 버튼이 센다)', false, function () {
    chCount('s'); chCount('b'); chCount('s');
    eq([AS.balls, AS.strikes], [1, 2], '1-2');
    chCount('s');
    eq(AS.abs.length, 1, '삼진 기록'); eq(AS.abs[0].res, '삼진', '결과'); eq(AS.abs[0].count, { b: 1, s: 2, o: 0 }, '기록 시점 카운트');
    eq([AS.balls, AS.strikes, AS.outs], [0, 0, 0], '볼·스트라이크 초기화, 아웃 그대로');
  });

  run('볼카운트: 타자가 없으면 기록하지 않고 카운트는 그대로(3볼) 둔다', false, function () {
    AS.batter = null; renderLP();
    chCount('b'); chCount('b'); chCount('b'); chCount('b');
    eq(AS.abs.length, 0, '기록 없음'); eq(AS.balls, 3, '3볼 유지');
  });

  run('볼카운트: 아웃 3개 → 카운트를 비우고 다음 이닝으로', false, function () {
    var s = $('innSel'); eq(s.value, '1회초', '시작 이닝');
    chCount('b'); chCount('o'); chCount('o');
    eq(AS.outs, 2, '2아웃');
    chCount('o');
    eq([AS.balls, AS.strikes, AS.outs], [0, 0, 0], '카운트 초기화'); eq(s.value, '2회초', '다음 회의 같은 초 (투구 기록과 같은 규칙 · 한 팀만 기록하면 그 팀이 다시 치는 이닝)'); eq(AS.abs.length, 0, '타석 기록은 생기지 않음');
  });

  run('투수 탭: 볼·스트라이크·파울이 기록 탭 볼카운트와 이번 타석 투구로 이어진다', true, function () {
    recordPitch('볼'); recordPitch('스트라이크'); recordPitch('파울'); recordPitch('파울');
    eq([AS.balls, AS.strikes], [1, 2], '1-2 (2S 뒤 파울은 그대로)');
    eq(AS.currentPitches.length, 4, '이번 타석 투구 4구');
    eq(AS.currentPitches[0].result, '볼', '결과 보존'); eq(AS.currentPitches[0].pt, '직구', '구종 보존'); eq(AS.currentPitches[1].balls, 1, '그 공 직전 카운트');
    eq(P().length, 4, '투수 쪽 4구'); eq(AS.abs.length, 0, '타석은 아직');
  });

  run('투수 탭: 투수 버튼의 투구 수가 갱신되고, 모바일 투구 시트에 구종 없는 공이 null 로 보이지 않는다', true, function () {
    AS.pitcherPt = null;
    recordPitch('볼'); recordPitch('스트라이크');
    ok(/\(2구\)/.test($('pitcherRoster').textContent), '투수 버튼 2구 — 실제 ' + $('pitcherRoster').textContent.trim());
    _renderMobPitchLog();
    var t = $('mobPitchLogList').textContent;
    ok(t.indexOf('null') < 0, '모바일 투구 시트에 null — ' + t);
    ok(t.indexOf('구종 —') >= 0 && t.indexOf('볼') >= 0 && t.indexOf('스트라이크') >= 0, '구종 자리표시 · 결과 표시 — ' + t);
  });

  run('투수 탭: 4번째 볼은 볼넷으로 저장되고 타석 기록에도 볼넷이 들어간다 (중복 없음)', true, function () {
    recordPitch('볼'); recordPitch('볼'); recordPitch('볼'); recordPitch('볼');
    eq(P().length, 4, '투수 쪽 4구 (되돌아온 연동으로 늘지 않음)'); eq(P()[3].result, '볼넷', '4번째 공 = 볼넷'); eq(P()[3].batter, '첫타자', '상대 타자');
    eq(AS.abs.length, 1, '타석 기록'); eq(AS.abs[0].res, '볼넷', '볼넷'); eq(AS.abs[0].pitches.length, 4, '타석에 4구 첨부'); eq(AS.abs[0].pitches[3].result, '볼넷', '마지막 공');
    eq([AS.balls, AS.strikes], [0, 0], '카운트 초기화'); eq(AS.currentPitches.length, 0, '이번 타석 투구 비움'); eq(AS.batter && AS.batter.id, 'cl2', '다음 타자');
  });

  run('투수 탭: 3번째 스트라이크는 삼진', true, function () {
    recordPitch('스트라이크'); recordPitch('스트라이크'); recordPitch('스트라이크');
    eq(P().length, 3, '3구'); eq(P()[2].result, '삼진', '삼진'); eq(AS.abs.length, 1, '타석 기록'); eq(AS.abs[0].res, '삼진', '삼진'); eq(AS.abs[0].pitches.length, 3, '3구 첨부');
  });

  run('투수 탭: 안타는 기록 탭으로 가서 필드 탭을 기다리고, 탭하면 그 결과로 기록된다', true, function () {
    shellNav('analysis', 'pitcher');
    eq($('app-page').style.display, 'none', '분석 탭에서 시작');
    recordPitch('볼'); recordPitch('안타');
    eq(AS.pendingQuickRes, '안타', '필드 탭 대기'); eq($('app-page').style.display, 'flex', '기록 탭으로 전환'); eq(AS.abs.length, 0, '위치를 찍기 전엔 기록 없음');
    eq(P().length, 2, '투수 쪽 2구'); eq(AS.currentPitches.length, 2, '이번 타석 투구 유지');
    // 필드 탭 흉내 (onFClick 의 즉시 기록 경로)
    AS.pending = { x: 0.5, y: 0.3, deg: 90, dir: 'CF', ft: 300 }; var res = AS.pendingQuickRes; _clearFieldTapPrompt(); AS.rbi = 0; recHit(res);
    eq(AS.abs.length, 1, '안타 기록'); eq(AS.abs[0].res, '안타', '안타'); eq(AS.abs[0].pitches.length, 2, '2구 첨부'); eq(AS.abs[0].pitches[1].result, '안타', '마지막 공');
    eq(P().length, 2, '투수 쪽 중복 없음'); eq([AS.balls, AS.strikes], [0, 0], '카운트 초기화');
  });

  run('기록 탭에서 타석이 끝나면 투수 탭의 열린 타석을 마지막으로 기록된 공으로 닫는다 (공을 지어내지 않는다)', true, function () {
    recordPitch('볼'); recordPitch('스트라이크');
    recOther('병살');
    eq(AS.abs.length, 1, '타석 기록'); eq(AS.abs[0].res, '병살', '병살'); eq(AS.abs[0].count, { b: 1, s: 1, o: 0 }, '기록 시점 카운트 = 투구 기록의 카운트');
    eq(P().length, 2, '투수 쪽 공 수 그대로'); eq(P()[1].end, '병살', '마지막 공에 타석 결과'); eq(P()[1].result, '병살', '옛 클라이언트용 결과'); eq(P()[1].pt, '직구', '그 공의 구종 그대로');
    eq(PitchCalc.openPA(P()), null, '투수 쪽 타석 닫힘'); eq(AS.pitchLog[0], P()[1], '투구 로그 맨 앞 = 그 공');
  });

  run('타자를 모르는 투수 탭 타석은 기록 탭 타석이 끝나도 닫지 않는다 (누구 타석인지 모르면 건드리지 않는다)', true, function () {
    AS.batter = null; renderLP();
    recordPitch('볼');
    selBatter('cl1'); recOther('삼진');
    eq(AS.abs.length, 1, '타석 기록'); eq(P().length, 1, '투수 쪽 1구'); eq(P()[0].end == null, true, '결과 없음');
    ok(PitchCalc.openPA(P()) != null, '투수 쪽 타석은 열린 채');
  });

  run('투수 탭: 볼넷을 만든 공을 되돌리면 자동으로 만든 타석도 지워지고 그 타자 · 3볼로 돌아온다', true, async function () {
    recordPitch('볼'); recordPitch('볼'); recordPitch('볼'); recordPitch('볼');
    eq(AS.abs.length, 1, '볼넷 기록'); eq(AS.batter && AS.batter.id, 'cl2', '다음 타자');
    undoPitch();
    eq(AS.abs.length, 0, '자동 타석 지움'); eq(P().length, 3, '투수 쪽 3구'); eq([AS.balls, AS.strikes], [3, 0], '3-0');
    eq(AS.currentPitches.length, 3, '이번 타석 투구 3구'); eq(AS.batter && AS.batter.id, 'cl1', '그 타자로 복귀');
    await T.sleep(750);   // 연타 방지 가드(0.7초)
    recordPitch('볼');
    eq(AS.abs.length, 1, '다시 볼넷'); eq(AS.abs[0].bname, '첫타자', '같은 타자'); eq(AS.abs[0].pitches.length, 4, '4구 첨부');
  });

  run('투수 탭: 투구 기록의 카운트가 기록 탭 볼카운트 (헛갈리지 않게 하나)', true, function () {
    recordPitch('볼'); recordPitch('볼');
    eq([AS.balls, AS.strikes], [2, 0], '2-0');
    undoPitch();
    eq([AS.balls, AS.strikes], [1, 0], '되돌리면 1-0'); eq(AS.currentPitches.length, 1, '이번 타석 투구 1구');
  });

  run('투수 탭을 안 쓴 타석에는 투구를 지어내지 않는다', true, function () {
    recOther('삼진');
    eq(AS.abs.length, 1, '타석 기록'); eq(P().length, 0, '투수 쪽 변화 없음');
  });

  run('투수 탭: 타자 미선택이면 타석 기록은 건너뛰고 카운트만 비운다', true, function () {
    AS.batter = null; renderLP();
    recordPitch('볼'); recordPitch('볼'); recordPitch('볼'); recordPitch('볼');
    eq(P()[3].result, '볼넷', '투수 쪽은 볼넷'); eq(AS.abs.length, 0, '타석 기록 없음'); eq([AS.balls, AS.strikes], [0, 0], '카운트 초기화'); eq(AS.currentPitches.length, 0, '이번 타석 투구 비움');
  });

  // ── 투수 탭을 쓰는 이닝: 아웃은 투구 기록 하나 · 3아웃 → 다음 회의 같은 초/말 (사용자 결정 2026-10-11) ──
  function pick(id) { if (!(AS.batter && String(AS.batter.id) === id)) selBatter(id); }   // 타석 기록 뒤 다음 타자로 넘어가 있으면 같은 타자를 또 눌러 선택이 풀리지 않게
  function strikeout() { recordPitch('스트라이크'); recordPitch('스트라이크'); recordPitch('스트라이크'); }

  run('투수 탭을 쓰는 이닝: 기록 탭 O 점 = 투구 기록의 아웃 · O 버튼은 따로 세지 않는다 · 3아웃이면 다음 회의 같은 초로', true, async function () {
    var s = $('innSel');
    strikeout();
    eq(AS.abs.length, 1, '삼진 타석 자동 기록'); eq(AS.abs[0].count.o, 0, '그 타석은 0아웃에서'); eq(AS.outs, 1, 'O 점 = 투구 기록 1아웃');
    chCount('o'); eq(AS.outs, 1, 'O 버튼은 따로 세지 않음 (두 곳에서 세면 이닝이 두 번 넘어간다)');
    await T.sleep(750); pick('cl2'); strikeout();
    eq(AS.abs.length, 2, '두 번째 삼진'); eq(AS.abs[1].count.o, 1, '1아웃에서'); eq(AS.outs, 2, '2아웃');
    await T.sleep(750); pick('cl1'); strikeout();
    eq(AS.abs.length, 3, '세 번째 삼진'); eq([AS.abs[2].inn, AS.abs[2].count.o], ['1회초', 2], '세 번째 타석은 1회초 2아웃에서 (이닝을 넘기기 전에 기록)');
    eq(s.value, '2회초', '다음 회의 같은 초'); eq(AS.outs, 0, '새 이닝 0아웃');
    chCount('o'); eq(AS.outs, 1, '투구 기록이 없는 이닝에서는 O 버튼이 그대로 센다');
  });

  run('투수 탭 인플레이 아웃으로 3아웃: 이닝은 넘어가도 필드에서 찍은 타구는 그 타석의 이닝 · 아웃으로 기록된다', true, async function () {
    var s = $('innSel');
    strikeout(); await T.sleep(750); pick('cl2'); strikeout(); await T.sleep(750); pick('cl1');
    recordPitch('볼'); recordPitch('땅볼 아웃');
    eq(s.value, '2회초', '3아웃 → 다음 회'); eq(AS.pendingQuickRes, '땅볼 아웃', '필드 탭 대기'); eq(AS.abs.length, 2, '위치를 찍기 전엔 기록 없음');
    AS.pending = { x: 0.45, y: 0.55, deg: 100, dir: 'SS', ft: 120 }; var res = AS.pendingQuickRes; _clearFieldTapPrompt(); AS.rbi = 0; recHit(res);
    var a = AS.abs[AS.abs.length - 1];
    eq([a.res, a.bname, a.inn, a.count.o, a.count.b], ['땅볼 아웃', '첫타자', '1회초', 2, 1], '타구는 1회초 2아웃 1볼에서');
    eq(AS.outs, 0, '새 이닝 0아웃'); eq([AS._pitchEndInn, AS._pitchEndOuts], [null, null], '보정 값은 한 번만 쓴다');
  });
})();
