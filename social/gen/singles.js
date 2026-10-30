// 한 장짜리 투수 리포트 두 가지: 중계 그래픽(어두움) · 깔끔한 표(밝음)
(() => {
  const K = () => window.K;
  const tag = '<div class="tag">예시 데이터</div>';

  function broadcast(P) {
    return `<div class="rb">
      <div class="rb-num">${P.num}</div>
      <div class="rb-top"><div class="plate"><span>PITCHING REPORT</span></div><div class="rb-game"><b>${P.date}</b>&nbsp; ${P.opp}</div></div>
      <div class="rb-name">${P.name}<small>#${P.num}</small></div>
      <div class="rb-sub">${P.team} · <b>${P.ip}</b>이닝 · <b>${P.n}</b>구 · 상대 ${P.pa}타석</div>
      <div class="rb-main">
        <div class="rb-zone"><div class="rb-lab">PITCH LOCATION · 포수 시점</div>${K().zone(P.ps, { w: 450, glow: true, r: 2.1, boxW: .9 })}
          <div class="rb-leg">● 스트라이크 · 파울 · 아웃 &nbsp; ○ 볼 &nbsp; ◆ 안타</div></div>
        <div class="rb-ars">${P.types.map(t => `<div class="rb-row" style="--c:${K().ptCol(t.pt)}"><div class="t"><span class="pt">${t.pt}</span><span class="use">${t.use}<i>%</i></span></div>
          <div class="meta">${t.n}구 · 스트라이크 ${t.s}% · 삼진 ${t.k}</div></div>`).join('')}</div>
      </div>
      <div class="rb-bug">${[['스트라이크', P.sPct, '%'], ['초구 스트라이크', P.fsPct, '%'], ['삼진', P.K, ''], ['볼넷', P.BB, '']].map(([l, v, u]) => `<div><b>${v}${u ? `<i>${u}</i>` : ''}</b><span>${l}</span></div>`).join('')}</div>
      <div class="foot">${K().mark(34)}<span class="nx">@spraylab2026</span></div>${tag}</div>`;
  }

  function clean(P) {
    const max = Math.max(...P.types.map(t => t.use));
    return `<div class="rc">
      <div class="rc-eb"><span><b>PITCHER REPORT</b> · 이번 경기</span><span>${P.date} ${P.opp}</span></div>
      <div class="rc-hd"><h1>${P.name}</h1><span>#${P.num}</span></div>
      <div class="rc-meta">${P.team} · 상대 ${P.pa}타석</div>
      <div class="rc-kpi">${[['이닝', P.ip], ['투구', P.n], ['삼진', P.K], ['스트라이크', P.sPct, '%']].map(([l, v, u]) => `<div><b>${v}${u ? `<i>${u}</i>` : ''}</b><span>${l}</span></div>`).join('')}</div>
      <div class="rc-card"><h2>구종 <small>스트라이크% = 볼이 아닌 공</small></h2>
        <table><thead><tr><th>구종</th><th>비율</th><th>투구</th><th>스트라이크%</th><th>삼진</th><th>피안타</th></tr></thead><tbody>${
          P.types.map(t => `<tr style="--c:${K().ptCol(t.pt)}"><td class="pt"><i></i>${t.pt}</td><td class="use"><div class="ub"><s style="width:${t.use / max * 200}px"></s>${t.use}%</div></td><td>${t.n}</td><td>${t.s}%</td><td>${t.k}</td><td>${t.h}</td></tr>`).join('')}</tbody></table></div>
      <div class="rc-card"><h2>구종별 위치 <small>포수 시점 · ● 스트라이크 ○ 볼 ◆ 안타</small></h2>
        <div class="rc-zones" style="grid-template-columns:repeat(${P.types.length},1fr)">${P.types.map(t => `<div style="--c:${K().ptCol(t.pt)}"><p><i></i>${t.pt} ${t.n}구</p>${K().zone(t.xy, { w: 168 + (4 - P.types.length) * 40, r: 3.6, boxW: 1.2 })}</div>`).join('')}</div></div>
      <div class="foot">${K().mark(32)}<span class="nx">@spraylab2026</span></div>${tag}</div>`;
  }

  window.R1 = { broadcast, clean };
})();
