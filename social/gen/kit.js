// 인스타 게시물 공용 그림: 테마 · 스트라이크존 · 구장(타구) · 9칸 · 워드마크
(() => {
  const THEMES = {
    field: { dark: 1, bg: '#0A1310', tx: '#F3F6F4', tx2: '#9DAEA6', tx3: '#5C6E66', acc: '#2dd4a0', hl: '#f6c23e', mute: '#22322B', line: 'rgba(255,255,255,.14)', on: '#0A1310',
      deco: 'radial-gradient(760px 620px at 85% 62%, rgba(45,212,160,.13), transparent 70%), radial-gradient(700px 560px at 0 0, rgba(246,194,62,.06), transparent 70%)' },
    night: { dark: 1, bg: '#060D1C', tx: '#F4F7FB', tx2: '#A9B6CB', tx3: '#64738E', acc: '#FF5A36', hl: '#FF5A36', mute: '#1A2740', line: 'rgba(255,255,255,.14)', on: '#0A111E',
      deco: 'radial-gradient(760px 700px at 30% 62%, rgba(75,140,245,.2), transparent 70%), radial-gradient(600px 400px at 100% 6%, rgba(255,90,54,.15), transparent 70%), repeating-linear-gradient(-58deg, rgba(255,255,255,.022) 0 2px, transparent 2px 26px), linear-gradient(180deg, #0B1832 0%, #060D1C 60%)' },
    paper: { dark: 0, bg: '#F4F3EE', tx: '#121417', tx2: '#5F646C', tx3: '#9A9EA5', acc: '#E04A22', hl: '#E04A22', mute: '#E4E2DB', line: '#E4E2DB', on: '#FFFFFF', card: '#FFFFFF',
      deco: 'radial-gradient(900px 600px at 100% 0, rgba(224,74,34,.06), transparent 70%)' },
    sun: { dark: 1, bg: '#120D06', tx: '#FFF7EA', tx2: '#C9B89A', tx3: '#7A6A50', acc: '#FFB020', hl: '#FFB020', mute: '#2A2114', line: 'rgba(255,240,210,.14)', on: '#1A1204',
      deco: 'radial-gradient(800px 700px at 80% 70%, rgba(255,176,32,.16), transparent 70%), radial-gradient(500px 400px at 0 0, rgba(255,90,54,.08), transparent 70%)' },
  };
  // 밝은 테마에서 노랑·연두가 안 보이지 않게 한 톤 진하게
  const LIGHT_PT = { '직구': '#2F6FE0', '슬라이더': '#D99A00', '커브': '#8B6CF0', '체인지업': '#12A87C', '포크볼': '#EA7A1E', '커터': '#6B7685' };
  let T = THEMES.field;
  const ptCol = pt => (T.dark ? window.G.COL : LIGHT_PT)[pt] || '#c3cad6';

  function useTheme(name) {
    T = THEMES[name];
    const r = document.documentElement.style;
    for (const k of ['bg', 'tx', 'tx2', 'tx3', 'acc', 'hl', 'mute', 'line', 'on']) r.setProperty('--' + k, T[k]);
    r.setProperty('--card', T.card || 'rgba(255,255,255,.05)');
    r.setProperty('--deco', T.deco);
    document.body.dataset.theme = name;
    return T;
  }

  // 스트라이크존 (포수 시점) — 데이터 좌표 0~1, 존 안 = x .25~.75 · y .18~.82 → viewBox 100×124 의 25..75 × 22.3..101.7
  function zone(dots, o = {}) {
    const X = x => Math.min(97, Math.max(3, x * 100)), Y = y => Math.min(121, Math.max(3, y * 124));
    const r = o.r || 2.6, box = T.dark ? 'rgba(255,255,255,.85)' : '#14161A', grid = T.dark ? 'rgba(255,255,255,.16)' : 'rgba(20,22,26,.13)';
    const glow = o.glow ? '<defs><filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' : '';
    const f = o.glow ? ' filter="url(#gl)"' : '';
    const dot = p => {
      const x = X(p.x), y = Y(p.y), c = p.col || ptCol(p.pt);
      if (p.kind === 'hit') return `<path d="M${x} ${y - r * 1.35}L${x + r * 1.35} ${y}L${x} ${y + r * 1.35}L${x - r * 1.35} ${y}Z" fill="${c}" stroke="${T.dark ? '#fff' : '#14161A'}" stroke-width=".7"${f}/>`;
      if (p.kind === 'ball') return `<circle cx="${x}" cy="${y}" r="${r - .5}" fill="none" stroke="${c}" stroke-width="1.1"${f}/>`;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"${f}/>`;
    };
    return `<svg viewBox="0 0 100 124" width="${o.w || 400}" style="display:block;overflow:visible">${glow}
      <rect x="25" y="22.3" width="50" height="79.4" fill="${T.dark ? 'rgba(255,255,255,.035)' : 'rgba(20,22,26,.03)'}"/>
      <path d="M41.67 22.3V101.7M58.33 22.3V101.7M25 48.8H75M25 75.2H75" stroke="${grid}" stroke-width=".5"/>
      <rect x="25" y="22.3" width="50" height="79.4" fill="none" stroke="${box}" stroke-width="${o.boxW || 1}"/>
      ${(o.extra || '')}${dots.map(dot).join('')}
    </svg>`;
  }

  // 구장 (타구 방향) — 홈 (50,80) · 펜스 반지름 70 · 각도 a: 0 = 가운데, 음수 = 왼쪽(3루 쪽)
  const FR = 70, HX = 50, HY = 80;
  const fpos = (a, d) => [HX + Math.sin(a * Math.PI / 180) * d * FR, HY - Math.cos(a * Math.PI / 180) * d * FR];
  function field(balls, o = {}) {
    const [lx, ly] = fpos(-45, 1), [rx, ry] = fpos(45, 1);
    const grass = T.dark ? 'rgba(45,212,160,.07)' : '#E6EEE3', dirt = T.dark ? 'rgba(255,200,140,.07)' : '#EFE6DA', ln = T.dark ? 'rgba(255,255,255,.35)' : 'rgba(20,22,26,.35)';
    const [b1x, b1y] = fpos(45, .3), [b2x, b2y] = fpos(0, .424), [b3x, b3y] = fpos(-45, .3);
    const wedge = (a0, a1, fill) => { const [x0, y0] = fpos(a0, 1), [x1, y1] = fpos(a1, 1); return `<path d="M${HX} ${HY}L${x0} ${y0}A${FR} ${FR} 0 0 1 ${x1} ${y1}Z" fill="${fill}"/>`; };
    const sectors = o.sectors ? o.sectors.map(([a0, a1, fill]) => wedge(a0, a1, fill)).join('') : '';
    const r = o.r || 1.7;
    const dot = p => {
      const [x, y] = fpos(p.ang, Math.min(p.dist, 1.04)), c = p.col || resCol(p.res);
      if (p.res === '아웃') return `<circle cx="${x}" cy="${y}" r="${r * .82}" fill="none" stroke="${c}" stroke-width=".55"/>`;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${T.dark ? '' : 'stroke="#fff" stroke-width=".3"'}/>`;
    };
    return `<svg viewBox="0 4 100 80" width="${o.w || 600}" style="display:block;overflow:visible">
      <path d="M${HX} ${HY}L${lx} ${ly}A${FR} ${FR} 0 0 1 ${rx} ${ry}Z" fill="${grass}"/>
      ${sectors}
      <path d="M${HX} ${HY}L${fpos(-45, .42).join(' ')}A${FR * .42} ${FR * .42} 0 0 1 ${fpos(45, .42).join(' ')}Z" fill="${dirt}"/>
      <path d="M${HX} ${HY}L${lx} ${ly}A${FR} ${FR} 0 0 1 ${rx} ${ry}Z" fill="none" stroke="${ln}" stroke-width=".45"/>
      <path d="M${HX} ${HY}L${b1x} ${b1y}L${b2x} ${b2y}L${b3x} ${b3y}Z" fill="none" stroke="${ln}" stroke-width=".4"/>
      ${[[b1x, b1y], [b2x, b2y], [b3x, b3y]].map(([x, y]) => `<rect x="${x - .9}" y="${y - .9}" width="1.8" height="1.8" transform="rotate(45 ${x} ${y})" fill="${T.dark ? '#E8EDF5' : '#fff'}" stroke="${ln}" stroke-width=".2"/>`).join('')}
      ${o.extra || ''}${balls.map(dot).join('')}
    </svg>`;
  }
  const resCol = res => res === '홈런' ? '#FF5A36' : res === '2루타' ? '#4b8cf5' : res === '안타' ? (T.dark ? '#2dd4a0' : '#12A87C') : (T.dark ? 'rgba(200,210,225,.75)' : '#8B9099');

  // 9칸 (포수 시점) — cells[i] = { avg, ab, v } · 뜨거울수록 빨강, 차가울수록 파랑
  function grid9(cells, o = {}) {
    const S = o.s || 150, G = o.gap || 8, heat = v => {
      const k = Math.max(0, Math.min(1, (v - .1) / .35));
      const c0 = [75, 140, 245], c1 = [255, 90, 54], c = c0.map((x, i) => Math.round(x + (c1[i] - x) * k));
      return `rgba(${c.join(',')},${T.dark ? .25 + .55 * Math.abs(k - .5) * 2 : .18 + .5 * Math.abs(k - .5) * 2})`;
    };
    return `<div style="display:grid;grid-template-columns:repeat(3,${S}px);gap:${G}px">${cells.map((c, i) => `<div class="g9" data-i="${i}" style="height:${S * 1.18}px;background:${heat(c.v)};border-radius:${S * .08}px;display:flex;flex-direction:column;align-items:center;justify-content:center;${o.mark === i ? `outline:${S * .04}px solid var(--tx);outline-offset:${S * .03}px;` : ''}">
      <b style="font:700 ${S * .36}px/1 Oswald;color:var(--tx)">${c.avg}</b><span style="margin-top:${S * .05}px;font:500 ${S * .13}px/1 'Noto Sans KR';color:var(--tx2)">${c.h}/${c.ab}</span></div>`).join('')}</div>`;
  }

  const mark = (size, tx, acc) => `<span style="font:900 ${size}px/1 'Noto Sans KR';letter-spacing:-.02em;color:${tx || 'var(--tx)'}">Spray<span style="color:${acc || 'var(--acc)'}">Lab</span></span>`;

  window.K = { THEMES, useTheme, zone, field, fpos, grid9, mark, ptCol, resCol, get T() { return T; } };
})();
