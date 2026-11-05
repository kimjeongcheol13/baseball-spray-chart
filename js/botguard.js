// 폼 봇 경비 — 앱 「의견 보내기」(core.js fieldFeedbackSubmit) · 파일럿 설문(feedback.html · pilotfeedback.js)이 같이 쓴다
//  · 숨은 칸(trap): 사람 눈에는 안 보이고 봇만 채우는 칸. 차 있으면 봇으로 보고, 받은 척만 하고 보내지 않는다(why 'trap' — 안내 없음)
//  · 너무 빠른 제출: 창(또는 페이지)을 연 뒤 minMs 안에 누르면 보내지 않고 "한 번 더 눌러 주세요" — 사람은 다시 누르면 된다(why 'fast')
//  · 연속 제출: 이 기기에서 보낸 시각을 sl_fb_sent 에 남긴다. 직전에 보낸 지 GAP 안이면(why 'gap'), 1시간에 PER_HOUR 번을 넘으면(why 'hour') 막는다
//  · 이 기기 안에서만 막는다. 우리 화면을 거치지 않고 저장소 주소로 바로 보내는 봇은 sql/15_bot_guard.sql(크기 · 횟수 제한)이 막는다
//  · localStorage 를 못 쓰는 브라우저(사생활 보호 모드 등)에서는 연속 제출 검사만 건너뛴다 — 보내기 자체는 막지 않는다
(function () {
  var KEY = 'sl_fb_sent', GAP = 20000, HOUR = 3600000, PER_HOUR = 5;

  function read(now) {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(a)) return [];
      return a.filter(function (t) { return typeof t === 'number' && t <= now && now - t < HOUR; });
    } catch (e) { return []; }
  }

  // o = { trap: 숨은 칸 값, openedAt: 창을 연 시각(ms, 없으면 빠르기 검사 안 함), minMs: 최소 시간(기본 1500), now: 지금(시험용) }
  // → { ok: true } 또는 { ok: false, why: 'trap' | 'fast' | 'gap' | 'hour', msg: 사람에게 보일 안내('trap' 은 없음) }
  function check(o) {
    o = o || {};
    var now = o.now || Date.now();
    if (o.trap) return { ok: false, why: 'trap' };
    if (o.openedAt && now - o.openedAt < (o.minMs || 1500)) return { ok: false, why: 'fast', msg: '조금만 천천히, 한 번 더 눌러 주세요' };
    var sent = read(now), last = sent[sent.length - 1];
    if (last != null && now - last < GAP) return { ok: false, why: 'gap', msg: '방금 보냈어요. ' + Math.ceil((GAP - (now - last)) / 1000) + '초 뒤에 다시 보낼 수 있어요' };
    if (sent.length >= PER_HOUR) return { ok: false, why: 'hour', msg: '한 시간에 ' + PER_HOUR + '번까지 보낼 수 있어요. 조금 뒤에 다시 보내 주세요' };
    return { ok: true };
  }

  // 보냈다고 남긴다(최근 1시간 것만 남김)
  function mark(now) {
    now = now || Date.now();
    var a = read(now);
    a.push(now);
    try { localStorage.setItem(KEY, JSON.stringify(a.slice(-PER_HOUR))); } catch (e) {}
  }

  window.SLBotGuard = { check: check, mark: mark, KEY: KEY, GAP: GAP, PER_HOUR: PER_HOUR };
})();
