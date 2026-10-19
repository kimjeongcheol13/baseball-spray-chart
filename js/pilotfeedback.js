// 파일럿 피드백 페이지(feedback.html) — 게임원 가져오기를 써 본 팀에게 받는 1분 설문
//  · 필수 3개(역할 · 가져오기 됐나 · 추천 0~10)만 막고 나머지는 선택
//  · 보내기 = 앱 「의견 보내기」(core.js fieldFeedbackSubmit)와 같은 Formspree 주소 · JSON. 실패하면 메일 앱으로 보내는 링크를 보여 준다
//  · 이름 · 연락처 · 브라우저 정보는 보내지 않는다. 주소의 utm_source · utm_campaign 만 '출처'로 붙인다(어느 부탁 메시지로 왔는지)
//  · 같은 답을 두 번 보내지 않게 보내는 동안 버튼을 끈다 · _gotcha(사람에게 안 보이는 칸)가 차 있으면 보내지 않는다(스팸 봇)
(function () {
  var ENDPOINT = 'https://formspree.io/f/xnjrevge';
  var MAIL = 'jeongcheol13@naver.com';
  var REQ = { role: '역할', result: '가져오기', nps: '추천' };
  var form = document.getElementById('pf'), status = document.getElementById('status'), btn = document.getElementById('pfSend');
  if (!form) return;

  function one(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function many(name) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (el) { return el.value; }); }
  function text(name) { var el = form.elements[name]; return el ? String(el.value || '').trim().slice(0, 1000) : ''; }
  function src() {
    try { var sp = new URLSearchParams(location.search); return [sp.get('utm_source'), sp.get('utm_campaign')].filter(Boolean).join(' / ').slice(0, 80); } catch (e) { return ''; }
  }

  // 답 → Formspree 로 보낼 값 (메일에서 바로 읽히게 한글 키)
  function collect() {
    return {
      _subject: 'SprayLab 게임원 파일럿 피드백',
      역할: one('role'), 기기: one('device'), 가져오기: one('result'), 막힌점: text('stuck'),
      경기수: one('games'), 정확도: one('match'), 달랐던점: text('diff'), 쓸모: many('useful').join(', '),
      추천: one('nps'), 계속사용: one('again'), 바라는점: text('wish'), 팀: text('team').slice(0, 40), 출처: src(),
    };
  }

  // 빠진 필수 항목 이름들 — 빈 배열이면 통과. 빠진 칸은 빨간 테두리 + 안내
  function validate() {
    var miss = [];
    Object.keys(REQ).forEach(function (n) {
      var fs = form.querySelector('fieldset[data-name="' + n + '"]'), bad = !one(n);
      if (fs) fs.classList.toggle('bad', bad);
      if (bad) miss.push(n);
    });
    return miss;
  }

  function mailHref(d) {
    var body = Object.keys(d).filter(function (k) { return k !== '_subject' && d[k]; }).map(function (k) { return '[' + k + '] ' + d[k]; }).join('\n');
    return 'mailto:' + MAIL + '?subject=' + encodeURIComponent(d._subject) + '&body=' + encodeURIComponent(body);
  }
  function done() { form.hidden = true; document.getElementById('pfDone').hidden = false; window.scrollTo(0, 0); }
  function fail(d) {
    status.className = 'fail';
    status.innerHTML = '보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 계속 안 되면 <a id="pfMail" href="#">메일 앱으로 보내기</a>';
    document.getElementById('pfMail').href = mailHref(d);
  }

  var reqShown = false;   // 안내에 '별표 항목' 이 떠 있다 — 고르는 대로 줄이고, 다 고르면 지운다
  function showMiss(miss) {
    reqShown = !!miss.length;
    status.className = miss.length ? 'fail' : '';
    status.textContent = miss.length ? '별표 항목을 골라 주세요: ' + miss.map(function (n) { return REQ[n]; }).join(' · ') : '';
  }

  function submit(ev) {
    if (ev) ev.preventDefault();
    var miss = validate();
    if (miss.length) {
      showMiss(miss);
      var first = form.querySelector('fieldset[data-name="' + miss[0] + '"] input');
      if (first) first.focus();
      return Promise.resolve(false);
    }
    if (form.elements._gotcha && form.elements._gotcha.value) { done(); return Promise.resolve(false); }   // 봇: 받은 척만
    var d = collect();
    btn.disabled = true; btn.textContent = '보내는 중…';
    status.className = ''; status.textContent = '';
    return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(d) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); done(); return true; })
      .catch(function () { fail(d); return false; })
      .then(function (sent) { btn.disabled = false; btn.textContent = '보내기'; return sent; });
  }

  form.addEventListener('submit', submit);
  // 필수 칸을 고르면 그 칸의 빨간 표시를 바로 지우고, 안내도 남은 항목으로 줄인다
  form.addEventListener('change', function (e) {
    var fs = e.target && e.target.closest && e.target.closest('fieldset.bad');
    if (fs && one(fs.getAttribute('data-name'))) fs.classList.remove('bad');
    if (reqShown) showMiss(Object.keys(REQ).filter(function (n) { return !one(n); }));
  });
  window.SLPilotFeedback = { collect: collect, validate: validate, submit: submit, mailHref: mailHref };
})();
