// 폼 봇 경비(js/botguard.js) — 앱 「의견 보내기」 창 · 파일럿 설문(feedback.html)
//  · 숨은 칸(_gotcha)이 차 있으면 받은 척만 하고 아무것도 보내지 않는다
//  · 창(페이지)을 연 뒤 너무 빨리 누르면 보내지 않고 "한 번 더 눌러 주세요" — 창은 그대로, 다시 누르면 보내진다
//  · 이 기기에서 방금(20초 안) 보냈거나 1시간에 5번을 넘으면 안내만 — 정상 사용자는 한 번 보내는 데 막히지 않는다
//  · 저장소로 가는 글은 2000자에서 자른다(sql/15 의 크기 제한과 같다)
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test, sleep = T.sleep, $ = T.$;
  var KEY = 'sl_fb_sent';

  var booted = null;
  function boot() { if (!booted) booted = sleep(1500); return booted; }

  // 의견 보내기가 내보내는 두 곳(Supabase feedback 표 · Formspree)을 가짜로 바꿔 무엇이 나갔는지 본다
  function spy() {
    var rec = { form: [], db: [] }, f0 = window.fetch, c0 = window.supabase.createClient;
    window.fetch = function (url, opt) {
      if (String(url).indexOf('formspree.io') >= 0) rec.form.push(JSON.parse(opt.body));
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
    };
    window.supabase.createClient = function () {
      return { from: function (t) { return { insert: function (rows) { rec.db.push({ t: t, rows: rows }); return Promise.resolve({ error: null }); } }; } };
    };
    rec.restore = function () { window.fetch = f0; window.supabase.createClient = c0; };
    return rec;
  }
  function open(text, agoMs) { fieldFeedbackOpen(); $('ffmText').value = text; if (agoMs != null) _ffmOpenedAt = Date.now() - agoMs; }
  function shown() { return $('fieldFeedbackModal').classList.contains('show'); }
  function toast() { return $('toastTxt').textContent; }
  // 창 안 안내 줄 — 아래 알림(toast)은 피드백 창 뒤에 가려지므로 창이 열린 동안의 안내는 여기 나와야 한다(보이는 곳에 있는지까지 본다)
  function say() {
    var el = $('ffmMsg');
    if (!el || el.hidden) return '';
    var r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2);
    return hit === el ? el.textContent : '(가려짐) ' + el.textContent;
  }
  function sent() { return JSON.parse(localStorage.getItem(KEY) || '[]').length; }
  function clean(rec) { if (rec) rec.restore(); fieldFeedbackClose(); hideToast(); localStorage.removeItem(KEY); }

  test('봇 경비: SLBotGuard.check — 숨은 칸 · 너무 빠름 · 방금 보냄(20초) · 1시간 5번 · 깨진 기록은 무시', function () {
    var G = window.SLBotGuard, now = 1800000000000;
    ok(G, 'js/botguard.js 로드');
    localStorage.removeItem(KEY);
    eq(G.check({ trap: 'http://spam', now: now }), { ok: false, why: 'trap' }, '숨은 칸이 차 있음 — 안내 없음');
    eq(G.check({ openedAt: now - 1000, minMs: 1500, now: now }).why, 'fast', '1초 만에 누름');
    eq(G.check({ openedAt: now - 1600, minMs: 1500, now: now }), { ok: true }, '1.6초 뒤면 통과');
    eq(G.check({ now: now }), { ok: true }, '연 시각이 없으면 빠르기 검사 안 함');
    G.mark(now - 5000);
    eq(G.check({ now: now }), { ok: false, why: 'gap', msg: '방금 보냈어요. 15초 뒤에 다시 보낼 수 있어요' }, '5초 전에 보냄');
    eq(G.check({ now: now + 15000 }), { ok: true }, '20초가 지나면 통과');
    localStorage.removeItem(KEY);
    for (var i = 0; i < 5; i++) G.mark(now - 3000000 + i * 60000);
    eq(G.check({ now: now }).why, 'hour', '1시간 안에 5번 보냄');
    eq(G.check({ now: now + 600001 }), { ok: true }, '가장 오래된 것이 1시간을 넘으면 다시 통과');
    eq(sent(), 5, '최근 5개만 남긴다');
    localStorage.setItem(KEY, '{"x":1}');
    eq(G.check({ now: now }), { ok: true }, '깨진 기록은 무시');
    localStorage.setItem(KEY, JSON.stringify([now + 999999]));
    eq(G.check({ now: now }), { ok: true }, '앞날짜 기록은 무시');
    localStorage.removeItem(KEY);
  });

  test('봇 경비 · 의견 보내기: 숨은 칸이 차 있으면 받은 척만 하고 어디에도 보내지 않는다', async function () {
    await boot(); localStorage.removeItem(KEY);
    var rec = spy();
    try {
      open('살 사람 연락 주세요', 60000);
      $('ffmHp').value = 'http://spam.example';
      fieldFeedbackSubmit(); await sleep(100);
      eq([rec.form.length, rec.db.length], [0, 0], 'Formspree · Supabase 둘 다 안 보냄');
      eq([shown(), toast()], [false, '피드백이 전송되었습니다 ✓'], '창 닫고 보낸 척');
      eq(sent(), 0, '보낸 기록도 남기지 않음');
      fieldFeedbackOpen();
      eq($('ffmHp').value, '', '창을 다시 열면 숨은 칸은 비워진다');
    } finally { clean(rec); }
  });

  test('봇 경비 · 의견 보내기: 열자마자 누르면 안내만(창 그대로) → 다시 누르면 보내진다 · 20초 안에 또 보내면 막는다', async function () {
    await boot(); localStorage.removeItem(KEY);
    var rec = spy();
    try {
      open('타구 점이 안 찍혀요');   // 연 시각 = 지금
      ffmToggle(document.querySelector('.ffm-tag[data-v="bug"]'));
      fieldFeedbackSubmit(); await sleep(50);
      eq([rec.form.length, rec.db.length, shown(), say()], [0, 0, true, '조금만 천천히, 한 번 더 눌러 주세요'], '너무 빠름 — 안 보내고 창 안에 안내');
      await sleep(1600);
      fieldFeedbackSubmit();
      eq(say(), '', '보내면 안내 줄은 지운다');
      for (var i = 0; i < 40 && shown(); i++) await sleep(25);
      eq(rec.form.length, 1, 'Formspree 한 번');
      eq([rec.form[0].태그, rec.form[0].내용], ['bug', '타구 점이 안 찍혀요'], 'Formspree 로 간 값');
      eq([rec.db.length, rec.db[0].t, rec.db[0].rows[0].text, rec.db[0].rows[0].tags], [1, 'feedback', '타구 점이 안 찍혀요', ['bug']], 'Supabase feedback 표로 간 값');
      eq([shown(), toast(), sent()], [false, '피드백이 전송되었습니다 ✓', 1], '창 닫고 완료 알림 · 보낸 기록 1');

      open('하나 더요', 60000);
      fieldFeedbackSubmit(); await sleep(50);
      ok(/^방금 보냈어요\. \d+초 뒤에 다시 보낼 수 있어요$/.test(say()), '20초 안에 또 — 창 안 안내: ' + say());
      eq([rec.form.length, rec.db.length, shown()], [1, 1, true], '안 보내고 창 그대로');
      fieldFeedbackClose(); fieldFeedbackOpen();
      eq(say(), '', '창을 다시 열면 안내 줄은 비어 있다');
      fieldFeedbackSubmit();
      eq(say(), '내용을 입력해주세요', '내용 없이 누르면 창 안에도 안내(아래 알림은 창에 가려짐)');
    } finally { clean(rec); }
  });

  test('봇 경비 · 의견 보내기: 저장소로 가는 글은 2000자에서 자른다 · 입력칸도 2000자까지', async function () {
    await boot(); localStorage.removeItem(KEY);
    var rec = spy();
    try {
      eq($('ffmText').getAttribute('maxlength'), '2000', '입력칸 maxlength');
      open('가'.repeat(2500), 60000);
      fieldFeedbackSubmit();
      for (var i = 0; i < 40 && shown(); i++) await sleep(25);
      eq([rec.db.length, rec.db[0].rows[0].text.length], [1, 2000], 'Supabase 로 간 글 2000자');
    } finally { clean(rec); }
  });

  test('봇 경비 · 파일럿 설문: 열자마자 보내면 안내만 → 3초 뒤엔 보내진다 · 같은 기기에서 바로 또 보내면 막는다', async function () {
    localStorage.removeItem(KEY);
    async function load() {
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px;height:800px;border:0';
      f.src = '/feedback.html';
      document.body.appendChild(f);
      for (var i = 0; i < 100 && !(f.contentWindow && f.contentWindow.SLPilotFeedback); i++) await sleep(50);
      ok(f.contentWindow.SLPilotFeedback && f.contentWindow.SLBotGuard, '설문 페이지 · botguard.js 로드');
      return f;
    }
    function fill(w) {
      [['role', '선수'], ['result', '한 번에 됐다'], ['nps', '8']].forEach(function (p) {
        var el = w.document.querySelector('input[name="' + p[0] + '"][value="' + p[1] + '"]'); el.checked = true; el.dispatchEvent(new w.Event('change', { bubbles: true }));
      });
    }
    function spyFetch(w) { var calls = []; w.fetch = function (u, o) { calls.push(u); return Promise.resolve({ ok: true, status: 200 }); }; return calls; }

    var f = await load(), w = f.contentWindow, d = w.document, calls = spyFetch(w);
    try {
      fill(w);
      w.SLPilotFeedback.guard.openedAt = Date.now() - 500;   // 페이지를 연 지 0.5초
      eq([await w.SLPilotFeedback.submit(), calls.length], [false, 0], '너무 빠름 — 안 보냄');
      eq([d.getElementById('status').textContent, d.getElementById('pf').hidden], ['조금만 천천히, 한 번 더 눌러 주세요', false], '안내 · 설문 그대로');
      w.SLPilotFeedback.guard.openedAt = Date.now() - 4000;  // 4초 뒤
      eq([await w.SLPilotFeedback.submit(), calls.length, d.getElementById('pf').hidden], [true, 1, true], '보내고 고맙습니다 화면');
      eq(sent(), 1, '보낸 기록 1');
    } finally { f.remove(); }

    var f2 = await load(), w2 = f2.contentWindow, d2 = w2.document, calls2 = spyFetch(w2);
    try {
      fill(w2);
      w2.SLPilotFeedback.guard.openedAt = Date.now() - 60000;
      eq([await w2.SLPilotFeedback.submit(), calls2.length], [false, 0], '같은 기기에서 바로 또 — 안 보냄');
      ok(/^방금 보냈어요\. \d+초 뒤에 다시 보낼 수 있어요$/.test(d2.getElementById('status').textContent), '안내 — ' + d2.getElementById('status').textContent);
    } finally { f2.remove(); localStorage.removeItem(KEY); }
  });
})();
