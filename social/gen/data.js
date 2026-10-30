// 인스타 게시물용 가짜 데이터 (고정 난수 — 같은 seed면 같은 그림)
// 앱과 같은 규칙: 카운트는 던지기 직전 · 2S 파울은 카운트 그대로 · 스트라이크% = 볼이 아닌 공
(() => {
  const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pickW = (r, w) => { let x = r() * w.reduce((a, b) => a + b[1], 0); for (const [k, v] of w) { if ((x -= v) < 0) return k; } return w[0][0]; };
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const avg3 = (h, ab) => ab ? (h / ab).toFixed(3).replace(/^0/, '') : '—';
  const COL = { '직구': '#4b8cf5', '슬라이더': '#f6c23e', '커브': '#a78bfa', '체인지업': '#2dd4a0', '포크볼': '#fb923c', '커터': '#7c8898' };
  const inZone = (x, y) => x > .25 && x < .75 && y > .18 && y < .82;

  // ── 투수 한 경기 ──────────────────────────────────────
  // o.mix(c) → [[구종, 가중치]...] · o.aim[구종] = [x, y] · o.spread · o.pa
  function pitcher(seed, o) {
    const r = rng(seed), ps = [], pas = [];
    let K = 0, BB = 0, H = 0, outs = 0;
    for (let b = 0; b < o.pa; b++) {
      let B = 0, S = 0; const pa = [];
      for (;;) {
        const pt = pickW(r, o.mix({ b: B, s: S })), A = o.aim[pt], sp = (o.spread || .62) + (o.fatigue || 0) * ps.length / 100;
        const x = Math.min(.97, Math.max(.03, A[0] + (r() - .5) * sp)), y = Math.min(.97, Math.max(.03, A[1] + (r() - .5) * sp));
        const z = inZone(x, y), q = r();
        let res;
        if (z) res = q < .3 ? '스트라이크' : q < .45 ? '헛스윙' : q < .7 ? '파울' : (r() < .3 ? '안타' : '아웃');
        else res = q < .7 ? '볼' : q < .85 ? '헛스윙' : q < .95 ? '파울' : '아웃';
        const c = { b: B, s: S };
        if (res === '볼') { B++; if (B === 4) res = '볼넷'; }
        else if (res === '스트라이크' || res === '헛스윙') { S++; if (S === 3) res = '삼진'; }
        else if (res === '파울') { if (S < 2) S++; }
        const p = { pt, x, y, res, c, i: ps.length, kind: res === '볼' || res === '볼넷' ? 'ball' : res === '안타' ? 'hit' : 'strike' };
        ps.push(p); pa.push(p);
        if (res === '삼진') { K++; outs++; break; }
        if (res === '볼넷') { BB++; break; }
        if (res === '안타') { H++; break; }
        if (res === '아웃') { outs++; break; }
      }
      pas.push(pa);
    }
    const n = ps.length, sOf = xs => pct(xs.filter(p => p.kind !== 'ball').length, xs.length);
    const types = Object.keys(o.aim).map(pt => {
      const xs = ps.filter(p => p.pt === pt);
      return { pt, col: COL[pt], n: xs.length, use: pct(xs.length, n), s: sOf(xs), k: xs.filter(p => p.res === '삼진').length, h: xs.filter(p => p.res === '안타').length, xy: xs };
    }).filter(t => t.n).sort((a, b) => b.n - a.n);
    const mix = f => { const xs = ps.filter(p => f(p.c)); return { n: xs.length, segs: types.map(t => { const k = xs.filter(p => p.pt === t.pt).length; return { pt: t.pt, col: t.col, n: k, p: pct(k, xs.length) }; }).filter(g => g.n) }; };
    const share = (m, pt) => (m.segs.find(g => g.pt === pt) || { p: 0 }).p;
    const ab = o.pa - BB;
    // 투구수 구간 (25구씩)
    const buckets = [[1, 25], [26, 50], [51, 75], [76, 999]].map(([a, b2]) => { const xs = ps.filter(p => p.i + 1 >= a && p.i + 1 <= b2); return { l: b2 > 900 ? `${a}구~` : `${a}~${b2}구`, n: xs.length, s: sOf(xs), bb: xs.filter(p => p.res === '볼넷').length }; }).filter(x => x.n >= 5);
    return {
      ...o, n, pa: pas.length, K, BB, H, ab, avg: avg3(H, ab), ip: `${Math.floor(outs / 3)}${outs % 3 ? '.' + outs % 3 : ''}`,
      sPct: sOf(ps), fsPct: sOf(pas.map(a => a[0])), kPct: pct(K, pas.length), whip: ((BB + H) / (outs / 3)).toFixed(2),
      ps, pas, types, buckets,
      m0: mix(c => !c.b && !c.s), mBall: mix(c => c.b > c.s && c.s < 2), mOther: mix(c => c.b <= c.s && c.s < 2 && (c.b || c.s)), m2: mix(c => c.s >= 2), mAll: mix(() => true), share,
      fullK: pas.filter(a => a.length >= 6 && a.at(-1).res === '삼진' && a.at(-1).c.b === 3 && a.at(-1).c.s === 2),
    };
  }

  // ── 타자 시즌 (여러 경기) ─────────────────────────────
  // o.pull: 당겨친 타구 비율 · o.hand 'R'|'L' · o.hot[9] 칸별 안타 확률 배율 · o.gb 땅볼 비율 · o.pa
  function batter(seed, o) {
    const r = rng(seed), pas = [];
    for (let k = 0; k < o.pa; k++) {
      let B = 0, S = 0; const pitches = []; let end = null;
      for (;;) {
        const x = Math.min(.97, Math.max(.03, .5 + (r() - .5) * .9)), y = Math.min(.97, Math.max(.03, .5 + (r() - .5) * .9));
        const z = inZone(x, y), c = { b: B, s: S };
        const cell = z ? Math.min(2, Math.floor((y - .18) / .64 * 3)) * 3 + Math.min(2, Math.floor((x - .25) / .5 * 3)) : -1;
        const swing = z ? (S === 2 ? .85 : !B && !S ? o.firstSwing ?? .45 : .7) : (S === 2 ? .4 : .25);
        const q = r(); let ev;
        if (q > swing) ev = z ? '스트라이크' : '볼';
        else { const w = r(); ev = w < (z ? .18 : .4) ? '헛스윙' : w < (z ? .5 : .75) ? '파울' : '인플레이'; }
        pitches.push({ x, y, c, ev });
        if (ev === '볼') { if (++B === 4) { end = { res: '볼넷' }; break; } }
        else if (ev === '스트라이크' || ev === '헛스윙') { if (++S === 3) { end = { res: '삼진', cell }; break; } }
        else if (ev === '파울') { if (S < 2) S++; }
        else {
          const hm = (cell >= 0 ? o.hot[cell] : .55) * (S === 2 ? (o.twoS ?? .8) : 1) * (!c.b && !c.s ? (o.first ?? 1) : 1);
          const side = r() < o.pull ? -1 : r() < .55 ? 0 : 1, sgn = o.hand === 'L' ? -1 : 1;
          const ang = sgn * (side === -1 ? -16 - r() * 28 : side === 0 ? (r() - .5) * 30 : 16 + r() * 26);
          const t = r() < o.gb ? '땅볼' : r() < .45 ? '라인드라이브' : '뜬공';
          const hit = r() < (t === '라인드라이브' ? .62 : t === '땅볼' ? .24 : .2) * hm * 1.25;
          const dist = t === '땅볼' ? .22 + r() * .3 : t === '라인드라이브' ? .5 + r() * .35 : .55 + r() * .45;
          const hr = hit && t === '뜬공' && dist > .93 && r() < (o.power ?? .4);
          const res = !hit ? '아웃' : hr ? '홈런' : dist > .78 && r() < .45 ? '2루타' : '안타';
          end = { res, cell, ang, dist: hr ? Math.max(dist, 1.02) : Math.min(dist, .98), t, side };
          break;
        }
      }
      pas.push({ pitches, ...end, first: pitches.length === 1, reached2S: pitches.some(p => p.c.s === 2) });
    }
    const isAB = p => p.res !== '볼넷', isH = p => ['안타', '2루타', '홈런'].includes(p.res);
    const line = xs => { const ab = xs.filter(isAB), h = ab.filter(isH); return { pa: xs.length, ab: ab.length, h: h.length, avg: avg3(h.length, ab.length), v: ab.length ? h.length / ab.length : 0 }; };
    const bip = pas.filter(p => p.ang != null);
    const dirs = [-1, 0, 1].map(s => { const xs = bip.filter(p => p.side === s); return { n: xs.length, p: pct(xs.length, bip.length), gb: pct(xs.filter(p => p.t === '땅볼').length, xs.length), h: xs.filter(isH).length }; });
    // 세 방향 % 합이 반올림 때문에 101·99가 되지 않게: 내림한 뒤 나머지가 큰 쪽부터 1씩
    if (bip.length) { const raw = dirs.map(d => d.n / bip.length * 100); let k = 100; dirs.forEach((d, i) => { d.p = Math.floor(raw[i]); k -= d.p; }); raw.map((r, i) => [r % 1, i]).sort((a, b) => b[0] - a[0]).slice(0, k).forEach(([, i]) => dirs[i].p++); }
    const grid = Array.from({ length: 9 }, (_, i) => line(pas.filter(p => p.cell === i && isAB(p))));
    const tb = pas.filter(isH).reduce((a, p) => a + (p.res === '홈런' ? 4 : p.res === '2루타' ? 2 : 1), 0);
    return {
      ...o, pas, bip, dirs, grid, all: line(pas),
      slg: avg3(tb, pas.filter(isAB).length), obp: avg3(pas.filter(p => isH(p) || p.res === '볼넷').length, pas.length),
      kPct: pct(pas.filter(p => p.res === '삼진').length, pas.length), bbPct: pct(pas.filter(p => p.res === '볼넷').length, pas.length),
      first: line(pas.filter(p => p.first)), twoS: line(pas.filter(p => p.reached2S)),
      ahead: line(pas.filter(p => p.pitches.at(-1).c.b > p.pitches.at(-1).c.s && !p.reached2S)), behind: line(pas.filter(p => p.pitches.at(-1).c.b <= p.pitches.at(-1).c.s && p.pitches.at(-1).c.s === 1)),
      hr: pas.filter(p => p.res === '홈런').length, gbPct: pct(bip.filter(p => p.t === '땅볼').length, bip.length),
    };
  }

  // ── 팀 (타순 짜기용) ──────────────────────────────────
  function team(seed, rows) {
    return rows.map((o, i) => { const b = batter(seed + i * 101, { pa: 48, hot: o.hot || Array(9).fill(1), ...o }); return { ...o, b, obpV: +('0' + b.obp), slgV: +('0' + b.slg) }; });
  }

  window.G = { rng, pitcher, batter, team, COL, pct, avg3 };
})();
