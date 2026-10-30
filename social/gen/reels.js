// 릴스(1080×1920) — 데이터가 움직이는 영상. seek(t초)로 한 프레임씩 그린다.
// 화면 위 220px · 아래 420px · 오른쪽 140px 은 인스타 버튼에 가려지므로 비운다.
(() => {
  const { K, G } = window;
  const cl = v => Math.max(0, Math.min(1, v));
  const p = (t, a, b) => cl((t - a) / (b - a));
  const eo = x => 1 - Math.pow(1 - x, 3);
  const back = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const $ = id => document.getElementById(id);
  const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };
  const rise = (el, k, d = 60) => { el.style.opacity = k; el.style.transform = `translateY(${(1 - k) * d}px)`; };

  // 공용: 인트로(훅) · 마무리 · 와이프 · 예시 데이터 표시
  const intro = (chip, hook, sub) => `<div class="sc" id="s0">
      <div class="abs" id="i0" style="left:90px;top:600px"><div class="plate"><span>${chip}</span></div></div>
      <div class="abs big" id="i1" style="left:90px;right:150px;top:730px;font-size:136px">${hook}</div>
      <div class="abs" id="i2" style="left:94px;top:1110px;font-size:48px;font-weight:500;color:var(--tx2)">${sub}</div></div>`;
  const outro = (nums, line) => `<div class="sc" id="sZ">
      <div class="abs rnums" id="z0" style="left:90px;right:150px;top:330px">${nums.map(([v, l, u]) => `<div><div class="num" data-v="${v}" data-u="${u || ''}"></div><span>${l}</span></div>`).join('')}</div>
      <div class="abs big" id="z1" style="left:90px;right:150px;top:820px;font-size:100px">${line || '공 하나씩 찍으면<br>이 화면이 남습니다'}</div>
      <div class="abs" id="z2" style="left:90px;top:1160px">${K.mark(84)}<div style="margin-top:22px;font:500 38px/1.3 'Noto Sans KR';color:var(--tx2)">기본 무료 · 설치 없이 웹에서 바로</div></div></div>`;
  const chrome = '<div class="wipe" id="wp"></div><div class="tag rtag">예시 데이터</div>';

  function wipe(t, bounds) {
    const W = bounds.find(b => t > b - .28 && t < b + .28), wp = $('wp');
    if (W == null) { wp.style.display = 'none'; return; }
    wp.style.display = ''; wp.style.left = (-1800 + (t - (W - .28)) / .56 * 3600) + 'px';
  }
  function seekIntro(t) { rise($('i0'), eo(p(t, 0, .45)), 0); $('i0').style.transform = `translateX(${(1 - eo(p(t, 0, .45))) * -700}px)`; rise($('i1'), eo(p(t, .2, .8)), 80); rise($('i2'), eo(p(t, .6, 1.1)), 30); }
  function seekOutro(t, t0) {
    document.querySelectorAll('#z0 [data-v]').forEach((el, i) => {
      const a = eo(p(t, t0 + .2 + i * .15, t0 + 1.1 + i * .15)), v = el.dataset.v, num = parseFloat(v.replace(/^\./, '0.'));
      el.textContent = (v.startsWith('.') ? (num * a).toFixed(3).replace(/^0/, '') : Math.round(num * a)) + el.dataset.u;
      el.parentNode.style.opacity = cl(a * 2);
    });
    rise($('z1'), eo(p(t, t0 + 1.1, t0 + 1.7)), 60); rise($('z2'), eo(p(t, t0 + 1.7, t0 + 2.2)), 30);
  }

  // ── 한 타석 다시 보기 (투수) ─────────────────────────────
  function pa(item, P) {
    const seq = item.pa, T1 = 2.4, P0 = 3.0, DT = .8, T2 = P0 + DT * seq.length + 1.4, T3 = T2 + 3.4, END = T3 + 3.8;
    const html = intro('PITCH BY PITCH', item.hook.replace(', ', ',<br>'), `<b style="color:var(--tx)">${P.name} #${P.num}</b> · ${P.ip}이닝 · ${P.n}구`) + `
      <div class="sc" id="s1">
        <div class="abs" style="left:90px;top:250px"><div class="lab">AT-BAT · 포수 시점</div><div class="big" style="font-size:92px;margin-top:18px">풀카운트 승부</div></div>
        <div class="abs cnt" id="cnt" style="left:90px;top:470px"></div>
        <div class="abs" id="zone" style="left:140px;top:560px;width:760px"></div>
        <div class="abs cap" id="cap" style="left:60px;right:140px;top:1540px"></div>
        <div class="abs kk" id="kk" style="left:0;right:60px;top:700px;text-align:center">K</div></div>
      <div class="sc" id="s2">
        <div class="abs" style="left:90px;top:300px"><div class="lab">ARSENAL · ${P.n}구</div><div class="big" style="font-size:92px;margin-top:18px">이날 던진 공</div></div>
        <div class="abs" id="ars" style="left:90px;right:150px;top:620px">${P.types.map(t => `<div class="arow"><span class="pt">${t.pt}</span><span class="v num" style="color:${K.ptCol(t.pt)}" data-v="${t.use}"></span><div class="tr"><s style="background:${K.ptCol(t.pt)}"></s></div></div>`).join('')}</div></div>
      ${outro([[P.sPct, '스트라이크', '%'], [P.K, '삼진'], [P.fsPct, '초구 S', '%']])}${chrome}`;
    const X = x => Math.min(97, Math.max(3, x * 100)), Y = y => Math.min(121, Math.max(3, y * 124));
    function seek(t) {
      t = Math.min(t, END - .001); wipe(t, [T1, T2, T3]);
      show('s0', t < T1); show('s1', t >= T1 && t < T2); show('s2', t >= T2 && t < T3); show('sZ', t >= T3);
      if (t < T1) return seekIntro(t);
      if (t < T2) {
        const k = Math.floor((t - P0) / DT), shown = seq.slice(0, Math.max(0, Math.min(seq.length, k + 1)));
        const last = shown.length - 1;
        $('zone').innerHTML = K.zone([], { w: 760, boxW: .8 }).replace('</svg>', shown.map((d, i) => {
          const s = back(p(t, P0 + i * DT, P0 + i * DT + .28)), r = 4.6 * s, c = K.ptCol(d.pt), x = X(d.x), y = Y(d.y);
          const glow = i === last ? `<circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="${c}" opacity="${.25 * s}"/>` : '';
          const sh = d.kind === 'ball' ? `<circle cx="${x}" cy="${y}" r="${r - .8}" fill="rgba(6,13,28,.6)" stroke="${c}" stroke-width="1.6"/>` : `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
          return glow + sh + `<text x="${x}" y="${y + 1.9}" font-family="Oswald" font-weight="700" font-size="${5.2 * s}" text-anchor="middle" fill="${d.kind === 'ball' ? c : '#0A111E'}">${i + 1}</text>`;
        }).join('') + '</svg>');
        const L = shown[last];
        const after = !L ? { b: 0, s: 0 } : L.res === '삼진' ? { b: 3, s: 2 } : seq[last + 1] ? seq[last + 1].c : L.c;
        $('cnt').innerHTML = `<span>B${[0, 1, 2].map(i => `<i class="${i < after.b ? 'b' : ''}"></i>`).join('')}</span><span>S${[0, 1].map(i => `<i class="${i < after.s ? 's' : ''}"></i>`).join('')}</span>`;
        if (L) { $('cap').innerHTML = `<span style="color:${K.ptCol(L.pt)}">${L.pt}</span> · ${L.res === '삼진' ? '헛스윙 삼진' : L.res}`; rise($('cap'), eo(p(t, P0 + last * DT, P0 + last * DT + .2)), 30); }
        else $('cap').style.opacity = 0;
        const kt = P0 + (seq.length - 1) * DT + .35, ka = p(t, kt, kt + .25);
        $('kk').style.opacity = ka ? 1 : 0; $('kk').style.transform = `scale(${ka ? 2.2 - 1.2 * eo(ka) : 1}) rotate(-8deg)`;
        $('zone').style.transform = ka > 0 && ka < 1 ? `translateX(${Math.sin(t * 90) * 10 * (1 - ka)}px)` : '';
        return;
      }
      if (t < T3) {
        document.querySelectorAll('#ars .arow').forEach((r, i) => {
          const a = eo(p(t, T2 + .3 + i * .18, T2 + 1.3 + i * .18)), v = +r.querySelector('.v').dataset.v;
          r.style.opacity = cl(a * 3); r.querySelector('s').style.width = (v / P.types[0].use * 100 * a) + '%'; r.querySelector('.v').textContent = Math.round(v * a) + '%';
        });
        return;
      }
      seekOutro(t, T3);
    }
    return { html, seek, dur: END, coverT: 1.6 };
  }

  // ── 타구가 하나씩 떨어지는 스프레이 차트 (타자) ─────────────
  function spray(item, B) {
    const balls = B.bip, N = balls.length, T1 = 2.4, F0 = 2.9, FD = 5.2, DT = FD / N, T2 = F0 + FD + 3.4, END = T2 + 3.8;
    const dn = B.hand === 'L' ? ['밀어친', '가운데', '당겨친'] : ['당겨친', '가운데', '밀어친'];
    const html = intro('SPRAY CHART', item.hook.replace(', ', ',<br>'), `<b style="color:var(--tx)">${B.name} #${B.num}</b> · ${B.hand === 'L' ? '좌' : '우'}타 · ${B.pa}타석`) + `
      <div class="sc" id="s1">
        <div class="abs" style="left:90px;top:250px"><div class="lab">SPRAY CHART · 인플레이 타구</div><div class="big" style="font-size:92px;margin-top:18px" id="ctr"></div></div>
        <div class="abs" id="fld" style="left:40px;top:560px;width:900px"></div>
        <div class="abs dir3" id="dir3" style="left:90px;right:150px;top:1300px">${B.dirs.map((d, i) => `<div><div class="num" data-v="${d.p}"></div><span>${dn[i]}</span></div>`).join('')}</div></div>
      ${outro([[B.all.avg, '타율'], [B.dirs[0].p, dn[0] + ' 타구', '%'], [B.gbPct, '땅볼', '%']])}${chrome}`;
    const wedges = [[-45, -15], [-15, 15], [15, 45]];
    function seek(t) {
      t = Math.min(t, END - .001); wipe(t, [T1, T2]);
      show('s0', t < T1); show('s1', t >= T1 && t < T2); show('sZ', t >= T2);
      if (t < T1) return seekIntro(t);
      if (t < T2) {
        const k = Math.max(0, Math.min(N, Math.floor((t - F0) / DT) + 1));
        $('ctr').innerHTML = `타구 <span class="num" style="color:var(--acc)">${k}</span><span style="color:var(--tx3)"> / ${N}</span>`;
        const sa = eo(p(t, F0 + FD + .3, F0 + FD + 1.1)), best = B.dirs.reduce((m, d, i) => d.p > B.dirs[m].p ? i : m, 0);
        const trails = balls.slice(0, k).map((b, i) => {
          const a = p(t, F0 + i * DT, F0 + i * DT + .3); if (a >= 1) return '';
          const [x, y] = K.fpos(b.ang, Math.min(b.dist, 1.04) * eo(a));
          return `<line x1="50" y1="80" x2="${x}" y2="${y}" stroke="${K.resCol(b.res)}" stroke-width=".5" opacity="${1 - a * .6}"/>`;
        }).join('');
        const done = balls.slice(0, k).filter((b, i) => p(t, F0 + i * DT, F0 + i * DT + .3) >= 1);
        $('fld').innerHTML = K.field(done, { w: 900, r: 1.9, extra: trails, sectors: sa ? [[...wedges[best], `rgba(45,212,160,${.2 * sa})`]] : null });
        const d3 = $('dir3'); d3.style.opacity = sa;
        d3.querySelectorAll('[data-v]').forEach((el, i) => { el.textContent = Math.round(+el.dataset.v * sa) + '%'; el.style.color = i === best ? 'var(--acc)' : ''; });
        return;
      }
      seekOutro(t, T2);
    }
    return { html, seek, dur: END, coverT: 1.6 };
  }

  // ── 9칸 한 칸씩 공개 → 약점 표시 (타자) ─────────────────────
  function grid(item, B, CELL) {
    const order = [4, 0, 8, 2, 6, 1, 7, 3, 5], T1 = 2.4, C0 = 2.9, CD = .34, T2 = C0 + CD * 9 + 3.6, END = T2 + 3.8;
    const lo = B.grid.reduce((m, g, i) => g.v < B.grid[m].v ? i : m, 0), hi = B.grid.reduce((m, g, i) => g.v > B.grid[m].v ? i : m, 0);
    const html = intro('HOT & COLD ZONE', item.hook.replace('에 ', '에<br>'), `<b style="color:var(--tx)">${B.name} #${B.num}</b> · ${B.pa}타석 · 포수 시점`) + `
      <div class="sc" id="s1">
        <div class="abs" style="left:90px;top:250px"><div class="lab">코스별 타율 · 포수 시점</div><div class="big" style="font-size:92px;margin-top:18px" id="gh">9칸 타율</div></div>
        <div class="abs" id="g9" style="left:130px;top:520px">${K.grid9(B.grid, { s: 250, gap: 12 })}</div>
        <div class="abs cap" id="gc" style="left:60px;right:140px;top:1500px"></div></div>
      ${outro([[B.grid[lo].avg, '약점 코스 타율'], [B.grid[hi].avg, '강점 코스 타율'], [B.all.avg, '전체 타율']], '약점을 알면<br>연습이 달라집니다')}${chrome}`;
    function seek(t) {
      t = Math.min(t, END - .001); wipe(t, [T1, T2]);
      show('s0', t < T1); show('s1', t >= T1 && t < T2); show('sZ', t >= T2);
      if (t < T1) return seekIntro(t);
      if (t < T2) {
        const cells = document.querySelectorAll('#g9 .g9'), fin = C0 + CD * 9 + .3, hk = eo(p(t, fin, fin + .4)), lk = eo(p(t, fin + 1.6, fin + 2));
        order.forEach((ci, j) => { const a = back(p(t, C0 + j * CD, C0 + j * CD + .3)), el = cells[ci]; el.style.transform = `scale(${a})`; el.style.opacity = cl(a * 2);
          el.style.filter = hk && ci !== lo && ci !== hi ? `saturate(${1 - .7 * hk}) brightness(${1 - .35 * hk})` : ''; el.style.outline = ''; });
        if (hk) { cells[lo].style.outline = `10px solid #4b8cf5`; cells[lo].style.outlineOffset = '6px'; }
        if (lk) { cells[hi].style.outline = `10px solid #FF5A36`; cells[hi].style.outlineOffset = '6px'; }
        $('gc').innerHTML = lk ? `<span style="color:#FF5A36">강점</span> ${CELL[hi]} ${B.grid[hi].avg}` : hk ? `<span style="color:#4b8cf5">약점</span> ${CELL[lo]} ${B.grid[lo].avg}` : '';
        rise($('gc'), lk ? eo(p(t, fin + 1.6, fin + 1.9)) : eo(p(t, fin, fin + .3)), 30);
        return;
      }
      seekOutro(t, T2);
    }
    return { html, seek, dur: END, coverT: 1.6 };
  }

  // ── 한 경기 → 다섯 경기 → 시즌 (기록이 쌓이는 모습) ─────────
  function season(item, B) {
    const balls = B.bip, N = balls.length, ph = [[1, '1경기', Math.round(N / 14)], [2, '5경기', Math.round(N * 5 / 14)], [3, '시즌 14경기', N]];
    const T1 = 2.4, Q0 = 2.9, QD = 2.1, T2 = Q0 + QD * 3 + 1.2, END = T2 + 3.8;
    const html = intro('SEASON', item.hook.replace(', ', ',<br>'), `<b style="color:var(--tx)">${B.name} #${B.num}</b> · ${B.hand === 'L' ? '좌' : '우'}타 · 인플레이 타구`) + `
      <div class="sc" id="s1">
        <div class="abs" style="left:90px;top:250px"><div class="lab" id="ql">기록이 쌓이면</div><div class="big" style="font-size:120px;margin-top:18px" id="qh"></div></div>
        <div class="abs" id="fld" style="left:40px;top:600px;width:900px"></div>
        <div class="abs cap" id="qc" style="left:60px;right:140px;top:1420px"></div></div>
      ${outro([[B.pa, '타석'], [N, '타구'], [B.all.avg, '타율']], '기록은 탭 몇 번,<br>남는 건 한 시즌')}${chrome}`;
    function seek(t) {
      t = Math.min(t, END - .001); wipe(t, [T1, T2]);
      show('s0', t < T1); show('s1', t >= T1 && t < T2); show('sZ', t >= T2);
      if (t < T1) return seekIntro(t);
      if (t < T2) {
        const q = Math.min(2, Math.max(0, Math.floor((t - Q0) / QD))), prev = q ? ph[q - 1][2] : 0, a = eo(p(t, Q0 + q * QD, Q0 + q * QD + 1.1));
        const n = Math.round(prev + (ph[q][2] - prev) * a);
        $('qh').textContent = ph[q][1]; rise($('qh'), eo(p(t, Q0 + q * QD, Q0 + q * QD + .3)), 30);
        $('fld').innerHTML = K.field(balls.slice(0, n), { w: 900, r: 1.9 });
        $('qc').innerHTML = `타구 <span class="num" style="color:var(--acc)">${n}</span>개`;
        $('qc').style.opacity = 1;
        return;
      }
      seekOutro(t, T2);
    }
    return { html, seek, dur: END, coverT: 1.6 };
  }

  window.REELS = { pa, spray, grid, season };
})();
