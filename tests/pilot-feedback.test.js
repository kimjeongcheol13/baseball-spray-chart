// 파일럿 피드백 페이지(feedback.html · js/pilotfeedback.js) — iframe 으로 띄우고 그 안의 fetch 를 가짜로 바꿔 보낼 값을 본다
//  · 필수 3개(역할 · 가져오기 · 추천)가 비면 보내지 않고 알린다 · 고르면 빨간 표시가 바로 지워진다
//  · 보내는 값 = 한글 키 · 이름 · 연락처 · 브라우저 정보 없음 · 출처 = 주소의 utm_source / utm_campaign
//  · 실패하면 메일 앱으로 보내는 링크 · 스팸 봇 칸(_gotcha)이 차 있으면 보내지 않는다
(function () {
  var T = window.__T, ok = T.ok, eq = T.eq, test = T.test;

  async function load(q) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px;height:800px;border:0';
    f.src = '/feedback.html' + (q || '');
    document.body.appendChild(f);
    for (var i = 0; i < 100 && !(f.contentWindow && f.contentWindow.SLPilotFeedback); i++) await T.sleep(50);
    ok(f.contentWindow.SLPilotFeedback, '페이지 · js/pilotfeedback.js 로드');
    return f;
  }
  function pick(w, name, value) { var el = w.document.querySelector('input[name="' + name + '"][value="' + value + '"]'); el.checked = true; el.dispatchEvent(new w.Event('change', { bubbles: true })); }
  function spy(w, res) {
    var calls = [];
    w.fetch = function (url, opt) { calls.push({ url: url, opt: opt }); return res === 'reject' ? Promise.reject(new Error('net')) : Promise.resolve({ ok: res !== 'bad', status: res === 'bad' ? 500 : 200 }); };
    return calls;
  }

  test('필수 3개가 비면 보내지 않고 무엇이 빠졌는지 알린다 · 고르는 대로 빨간 표시 · 안내가 줄고, 다 고르면 지워진다', async function () {
    var f = await load(), w = f.contentWindow, d = w.document, calls = spy(w, 'ok');
    var sent = await w.SLPilotFeedback.submit();
    eq([sent, calls.length], [false, 0], '보내지 않음');
    eq(d.getElementById('status').textContent, '별표 항목을 골라 주세요: 역할 · 가져오기 · 추천', '안내');
    eq(Array.prototype.map.call(d.querySelectorAll('fieldset.bad'), function (x) { return x.getAttribute('data-name'); }), ['role', 'result', 'nps'], '빨간 칸');
    ok(d.activeElement && d.activeElement.name === 'role', '첫 빠진 칸으로 이동');
    pick(w, 'role', '선수');
    ok(!d.querySelector('fieldset[data-name="role"]').classList.contains('bad'), '고르면 바로 지움');
    eq(d.getElementById('status').textContent, '별표 항목을 골라 주세요: 가져오기 · 추천', '안내도 남은 항목으로');
    pick(w, 'result', '한 번에 됐다'); pick(w, 'nps', '7');
    eq([d.getElementById('status').textContent, d.getElementById('status').className], ['', ''], '다 고르면 안내 지움');
    f.remove();
  });

  test('보내기: 한글 키 · 고른 값 · 출처(utm) — 이름 · 연락처 · 브라우저 정보 없음 → 고맙습니다 화면', async function () {
    var f = await load('?utm_source=kakao&utm_campaign=pilot_gameone&x=1'), w = f.contentWindow, d = w.document, calls = spy(w, 'ok');
    pick(w, 'role', '감독·코치'); pick(w, 'device', '휴대폰'); pick(w, 'result', '몇 번 해 보고 됐다'); pick(w, 'games', '2-5');
    pick(w, 'match', '다 맞았다'); pick(w, 'useful', '스프레이차트'); pick(w, 'useful', '투수 시즌 기록'); pick(w, 'nps', '9'); pick(w, 'again', '매 경기');
    d.getElementById('stuck').value = '  전체 선택이 헷갈림  '; d.getElementById('team').value = '가팀';
    d.getElementById('pfSend').click();
    for (var i = 0; i < 40 && d.getElementById('pfDone').hidden; i++) await T.sleep(25);
    eq(calls.length, 1, '한 번 보냄');
    eq([calls[0].url, calls[0].opt.method, calls[0].opt.headers['Content-Type']], ['https://formspree.io/f/xnjrevge', 'POST', 'application/json'], '앱 「의견 보내기」와 같은 주소');
    eq(JSON.parse(calls[0].opt.body), {
      _subject: 'SprayLab 게임원 파일럿 피드백', 역할: '감독·코치', 기기: '휴대폰', 가져오기: '몇 번 해 보고 됐다', 막힌점: '전체 선택이 헷갈림',
      경기수: '2-5', 정확도: '다 맞았다', 달랐던점: '', 쓸모: '스프레이차트, 투수 시즌 기록', 추천: '9', 계속사용: '매 경기', 바라는점: '', 팀: '가팀', 출처: 'kakao / pilot_gameone'
    }, '보낸 값');
    ok(d.getElementById('pf').hidden && !d.getElementById('pfDone').hidden, '고맙습니다 화면');
    f.remove();
  });

  test('보내기 실패 → 다시 누를 수 있고, 메일 앱으로 보내는 링크(답이 그대로 들어감) · 서버 오류(HTTP 500)도 실패로 본다', async function () {
    var f = await load(), w = f.contentWindow, d = w.document;
    pick(w, 'role', '선수'); pick(w, 'result', '안 됐다'); pick(w, 'nps', '3');
    var calls = spy(w, 'reject');
    eq(await w.SLPilotFeedback.submit(), false, '네트워크 오류');
    var a = d.getElementById('pfMail'), href = a ? decodeURIComponent(a.getAttribute('href')) : '';
    ok(d.getElementById('status').className === 'fail' && href.indexOf('mailto:jeongcheol13@naver.com?subject=SprayLab 게임원 파일럿 피드백') === 0, '메일 링크 — ' + href);
    ok(href.indexOf('[역할] 선수\n[가져오기] 안 됐다\n[추천] 3') > 0 && href.indexOf('[기기]') < 0, '빈 답은 빼고 고른 답만 — ' + href);
    ok(!d.getElementById('pfSend').disabled && !d.getElementById('pf').hidden, '다시 누를 수 있음');
    calls = spy(w, 'bad');
    eq([await w.SLPilotFeedback.submit(), calls.length, d.getElementById('pf').hidden], [false, 1, false], 'HTTP 500 도 실패');
    f.remove();
  });

  test('스팸 봇 칸(_gotcha)이 차 있으면 보내지 않는다(받은 척만)', async function () {
    var f = await load(), w = f.contentWindow, d = w.document, calls = spy(w, 'ok');
    pick(w, 'role', '기타'); pick(w, 'result', '한 번에 됐다'); pick(w, 'nps', '10');
    d.querySelector('input[name="_gotcha"]').value = 'http://spam';
    await w.SLPilotFeedback.submit();
    eq([calls.length, d.getElementById('pfDone').hidden], [0, false], '보내지 않고 고맙습니다 화면');
    f.remove();
  });
})();
