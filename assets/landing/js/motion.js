/* SprayLab 랜딩 — 숫자 모션 (라이브러리 없음 · 이 파일 하나)
 * 화면에 들어오면 1회: 0 → 최종값 카운트업 · 비율 막대 채우기 · 코스 칸 순서대로 · 박스스코어 줄 단위 타이핑
 * 히어로는 카운트업 뒤 7초마다 "타석 1개 추가": 샘플 김민준 타석 순서대로 누적 AVG · OPS · 당김/센터/밀어(%), 15타석 뒤 처음으로
 * 끝난 모습은 마크업 값 그대로다. prefers-reduced-motion: reduce · IntersectionObserver 없음 → 움직이지 않고 마크업 값 그대로
 */
(function () {
  'use strict';
  // 김민준 1~15타석 누적 [AVG, OPS, 당김%, 센터%, 밀어%] — js/sample.js 생성 데이터를 앱의 calcStats(batdata.js)로 계산한 값
  // tests/landing-motion.test.js 가 다시 계산해 이 줄과 비교한다 (한 줄 · JSON 그대로 둘 것)
  var PA = [["1.000","3.000",0,100,0],[".500","1.500",0,100,0],[".333","1.000",0,67,33],[".333","1.167",0,67,33],[".250",".900",25,50,25],[".200",".733",40,40,20],[".200",".829",40,40,20],[".333","1.000",33,50,17],[".286",".873",29,57,14],[".250",".775",38,50,13],[".333","1.121",33,44,22],[".333","1.167",33,44,22],[".300","1.062",30,40,30],[".273",".974",30,40,30],[".333","1.050",36,36,27]];
  var DUR = 900, TICK = 7000, EASE = 'cubic-bezier(.33,1,.68,1)';   // easeOutCubic — 카운트업(ease)과 같은 곡선

  var css = document.createElement('style');
  css.textContent = [
    '.zone b{font-variant-numeric:tabular-nums}',
    '.zone>.mo-nil>*{opacity:.4}',                                  // "—" 칸은 연하게
    '.mo-w{display:inline-block;text-align:right}',                 // 글줄 안 숫자: 최종값 폭으로 고정 (옆 글자가 밀리지 않게)
    '.mo-fill i{transform-origin:0 50%;transition:transform .9s ' + EASE + ',width .3s ease}',
    '.mo-fill.mo-pre i{transform:scaleX(0)}',
    '.mo-z>div{transition:background-color .3s ease}',
    '.mo-z>div>*{transition:opacity .3s ease;transition-delay:inherit}',
    '.zone.mo-pre>div{background-color:rgba(255,255,255,.06)}',
    '.zone.mo-pre>div>*{opacity:0}',
    '.mo-off{visibility:hidden}',                                   // 아직 안 친 글자: 자리는 차지한다 (높이 · 가로 스크롤 그대로)
    '.hero .chip b,.hero .chip b *{transition:color .15s ease}',
    '.hero .chip .mo-hl{color:var(--red-2)}.hero .chip em.mo-hl{color:#fff}'
  ].join('');
  document.head.appendChild(css);

  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  $$('.zone > div').forEach(function (d) { var b = d.querySelector('b'); if (b && b.textContent === '—') d.classList.add('mo-nil'); });
  if (!window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function f3(v) { return v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, ''); }   // 앱 f3 그대로: .333 · 1.050
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function tween(dur, delay, step, done) {   // step(t), t = 0..1 선형
    var t0 = null;
    requestAnimationFrame(function f(now) {
      if (t0 === null) t0 = now + delay;
      var t = Math.min(1, Math.max(0, (now - t0) / dur));
      step(t);
      if (t < 1) requestAnimationFrame(f); else if (done) done();
    });
  }
  // el 의 글자(최종값)를 읽어 지금 0 으로 바꾸고, 시작 함수(delay)를 돌려준다. ".333" · "1.050" = 소수 셋째 자리, "36%" · "10" = 정수
  // 세는 동안은 최종값 글자 폭을 min-width 로 잡아 둔다: 글줄 안 숫자는 옆 글자가, 칸 안 숫자는 칸 너비가 바뀌지 않게
  //  (390px 의 6칸은 "1.050" 이 칸보다 넓어 첫 열을 넓히고 있다 — 0 부터 세면 열 너비가 중간에 바뀐다). 다 세면 푼다
  function counter(el) {
    var txt = el.textContent, m = /^(\d*\.\d+|\d+)(%?)$/.exec(txt), rg = document.createRange();
    if (!m) return function () {};
    var to = +m[1], dec = m[1].indexOf('.') >= 0;
    function show(v) { el.textContent = (dec ? f3(v) : Math.round(v)) + m[2]; }
    function fit() { el.style.minWidth = ''; el.textContent = txt; rg.selectNodeContents(el); el.style.minWidth = rg.getBoundingClientRect().width + 'px'; show(0); }
    if (getComputedStyle(el).display === 'inline') el.classList.add('mo-w');
    fit();
    return function (delay) {
      fit();   // 웹폰트가 그사이 바뀌었을 수 있어 시작할 때 다시 잰다
      tween(DUR, delay, function (t) { show(to * ease(t)); }, function () { el.textContent = txt; el.style.minWidth = ''; el.classList.remove('mo-w'); });
    };
  }
  // 요소가 화면에 30% 들어오면 1회 시작. setup 이 처음 모습을 만들고 시작 함수를 돌려준다 (마크업이 예상과 다르면 아무것도 안 함)
  function when(sel, setup) {
    var el = document.querySelector(sel), go = el && setup(el);
    if (!go) return;
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect(); go();
    }, { threshold: .3 });
    io.observe(el);
  }

  // 1. 히어로: AVG · OPS · 당김·센터·밀어 카운트업 → 7초마다 1타석씩
  when('.hero .chips', function (box) {
    var bs = $$('.chip > b', box), m = bs.length === 3 && /^(\d+) · (\d+) · (\d+)%$/.exec(bs[2].textContent), bar = box.querySelector('.bar');
    if (!m || !bar) return;
    bs[2].innerHTML = '<em>' + m[1] + '</em> · <data>' + m[2] + '</data> · <data>' + m[3] + '</data>%';   // 숫자마다 따로 세려고 나눈다 (글자는 같다)
    var nums = [bs[0], bs[1]].concat($$('em, data', bs[2])), seg = $$('i', bar), go = nums.map(counter), k = PA.length - 1;
    bar.classList.add('mo-fill', 'mo-pre');
    function set(el, txt) {
      if (el.textContent === txt) return;
      el.textContent = txt;
      el.classList.add('mo-hl');
      setTimeout(function () { el.classList.remove('mo-hl'); }, 150);
    }
    return function () {
      bar.classList.remove('mo-pre');
      go.forEach(function (f) { f(0); });
      setTimeout(function () {
        setInterval(function () {
          var r = PA[k = (k + 1) % PA.length];
          nums.forEach(function (el, i) { set(el, String(r[i])); });
          seg[0].style.width = r[2] + '%'; seg[1].style.width = r[3] + '%';   // 밀어는 원래대로 나머지(flex:1)
        }, TICK);
      }, DUR);
    };
  });

  // 2. Auto stats 6칸: 칸마다 80ms 늦게
  when('.panel:not(.paste) > .grid6', function (box) {
    var go = $$('b', box).map(counter);
    return function () { go.forEach(function (f, i) { f(i * 80); }); };
  });

  // 3. 타구 방향: 막대가 0 → 값으로 채워지며 숫자도 함께
  when('.dirbar', function (box) {
    var bar = box.querySelector('.bar'), go = $$('.lbl b', box).map(counter);
    if (!bar) return;
    bar.classList.add('mo-fill', 'mo-pre');
    return function () { bar.classList.remove('mo-pre'); go.forEach(function (f) { f(0); }); };
  });

  // 4. 코스 9분할: 내각 → 외각, 위 → 아래(마크업 순서) 40ms 간격으로 색과 숫자
  when('.zone', function (box) {
    Array.prototype.forEach.call(box.children, function (d, i) { d.style.transitionDelay = i * 40 + 'ms'; });
    box.classList.add('mo-z', 'mo-pre');
    return function () { box.classList.remove('mo-pre'); };
  });

  // 5. Import: 박스스코어 줄마다 400ms 타이핑 → 타석 · 타구 위치 · 홈런 타점 카운트업
  when('.paste', function (box) {
    var pre = box.querySelector('pre'), go = $$('.grid6 b', box).map(counter);
    if (!pre) return;
    var src = pre.textContent, lines = src.split('\n').map(function (ln) {
      var on = document.createElement('span'), off = document.createElement('span');
      off.className = 'mo-off'; off.textContent = ln;
      return { on: on, off: off, ln: ln };
    });
    pre.textContent = '';
    lines.forEach(function (l, i) { if (i) pre.appendChild(document.createTextNode('\n')); pre.appendChild(l.on); pre.appendChild(l.off); });
    return function () {
      (function line(i) {
        if (i === lines.length) { pre.textContent = src; go.forEach(function (f, j) { f(j * 80); }); return; }
        var l = lines[i];
        tween(400, 0, function (t) { var c = Math.round(l.ln.length * t); l.on.textContent = l.ln.slice(0, c); l.off.textContent = l.ln.slice(c); }, function () { line(i + 1); });
      })(0);
    };
  });
})();
