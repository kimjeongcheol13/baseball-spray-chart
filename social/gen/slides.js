// 피드 한 장(1080×1350) 틀 — items.js 가 내용을 채운다
(() => {
  const K = () => window.K;
  const foot = (o) => `<div class="foot">${K().mark(36)}<span class="nx">${o.next || '@spraylab2026'}</span></div>`;
  const top = (o) => `<div class="top"><span class="chip">${o.chip}</span><span class="pg">${o.page || ''}</span></div>`;
  const tag = '<div class="tag">예시 데이터</div>';

  const S = {
    // 표지: 큰 제목 + 그림 한 개
    cover: o => `${top(o)}<h1 class="h1" style="${o.h1Style || ''}">${o.h1}</h1>${o.sub ? `<div class="sub">${o.sub}</div>` : ''}
      <div class="vis" style="top:${o.visTop || 640}px">${o.vis || ''}</div>${foot(o)}${tag}`,

    // 두 숫자 비교 (작은 쪽 → 큰 쪽)
    compare: (a, b) => `<div class="cmp"><div class="col"><div class="l">${a.l}</div><div class="v">${a.v}<i>${a.u || ''}</i></div></div>
      <svg class="arrow" viewBox="0 0 140 60"><path d="M10 30H118M96 10L122 30L96 50" fill="none" stroke="var(--tx3)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div class="col hl"><div class="l">${b.l}</div><div class="v">${b.v}<i>${b.u || ''}</i></div></div></div>`,

    // 쌓은 막대 여러 줄 — rows: [{ l, d, n, segs:[{pt,n,p}] }] · on = 강조할 구종
    stack: (rows, on) => `<div class="stk">${rows.map(r => `<div class="sr"><div class="sl">${r.l}<small>${r.d || ''} · ${r.n}구</small></div><div class="st">${r.segs.map(g => {
      const hi = !on || g.pt === on;
      return `<i style="flex:${g.n};background:${hi ? K().ptCol(g.pt) : 'var(--mute)'};color:${hi ? 'var(--on)' : 'var(--tx3)'}">${g.p >= 13 ? `${g.p >= 22 ? g.pt + ' ' : ''}${g.p}%` : ''}</i>`;
    }).join('')}</div></div>`).join('')}</div>`,

    // 가로 막대 목록 — items: [{ l, v(0~1 길이), t(글자), sub, hi }]
    bars: items => `<div class="bl">${items.map(x => `<div class="br${x.hi ? ' hi' : ''}"><div class="bt"><span>${x.l}${x.sub ? `<small>${x.sub}</small>` : ''}</span><b>${x.t}</b></div><div class="bg2"><s style="width:${Math.max(2, x.v * 100)}%"></s></div></div>`).join('')}</div>`,

    // 표 — head: [..], rows: [[..]], hi: 강조 줄 index 목록
    table: (head, rows, hi = []) => `<table class="tb"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${hi.includes(i) ? 'hi' : ''}">${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`,

    // 큰 숫자 3개 줄
    nums: xs => `<div class="nums">${xs.map(([v, l, u]) => `<div><b>${v}${u ? `<i>${u}</i>` : ''}</b><span>${l}</span></div>`).join('')}</div>`,

    legendRes: () => `<div class="leg"><span><i style="background:${K().resCol('안타')}"></i>안타</span><span><i style="background:${K().resCol('2루타')}"></i>2루타</span><span><i style="background:${K().resCol('홈런')}"></i>홈런</span><span><i class="o" style="border-color:${K().resCol('아웃')}"></i>아웃</span></div>`,
    legendPitch: () => `<div class="leg"><span>● 스트라이크·파울·아웃</span><span>○ 볼</span><span>◆ 안타</span></div>`,

    // 마지막 장: 이렇게 기록 → 앱 주소
    cta: o => `${top(o)}<h1 class="h1" style="font-size:92px">${o.h1 || '찍어두면<br>이렇게 남습니다'}</h1>
      <div class="steps">${(o.steps || ['경기 중에 공 하나, 타구 하나씩 탭', '경기가 끝나면 그림과 숫자가 자동으로', '팀 단톡방에 이미지로 바로 공유']).map((s, i) => `<div><b>${i + 1}</b><span>${s}</span></div>`).join('')}</div>
      <div class="ctabox">${K().mark(72)}<div class="url">kimjeongcheol13.github.io/baseball-spray-chart</div><div class="free">기본 무료 · 설치 없이 웹에서 바로</div></div>`,
  };
  window.S = S;
})();
