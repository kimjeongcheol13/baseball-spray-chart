// 학부모 실시간 따라보기 화면 (live.html?g=<id>) — 로그인 없이 20초마다 live_get(id) 을 다시 읽어 그린다 (sql/16 · features/livefollow.js)
//   · 앱(index.html)을 띄우지 않는 가벼운 페이지. supabase-js 없이 REST rpc 로 바로 읽는다
//   · 화면이 숨겨지면 멈추고, 다시 보이면 바로 읽는다. 중계가 끝나면(end) 더 묻지 않는다
//   · 경기가 끝나면(fin) 최종 점수를 두고 1분마다만 본다 — 같은 링크로 다음 경기가 이어서 나온다
const SURL = 'https://bsmbrngkpsdmbwoqcrps.supabase.co';
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWJybmdrcHNkbWJ3b3FjcnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTE1OTcsImV4cCI6MjA5NDk4NzU5N30.kVkKSvrXMtVOEtTNEELr8_9bQret60pTngFRsHgY5nk';
const EVERY = 20000, FIN_EVERY = 60000, STALE = 15 * 60e3;

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hm = t => new Date(t).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
const msg = (h, s) => `<section class="lv-card lv-msg"><h1>${esc(h)}</h1><p>${esc(s)}</p></section>`;

function bases(b) {
  if (!Array.isArray(b)) return '';
  const sq = (x, y, on, n) => `<rect x="${x}" y="${y}" width="12" height="12" transform="rotate(45 ${x + 6} ${y + 6})" class="${on ? 'on' : ''}"><title>${n}${on ? ' 주자 있음' : ''}</title></rect>`;
  return `<svg class="lv-bases" viewBox="0 0 56 40" role="img" aria-label="주자: ${['1루', '2루', '3루'].filter((_, i) => b[i]).join(' · ') || '없음'}">${sq(36, 20, b[0], '1루')}${sq(22, 6, b[1], '2루')}${sq(8, 20, b[2], '3루')}</svg>`;
}

function lineTable(p) {
  const ls = p.ls, n = Math.max(ls ? Math.max(ls.away.length, ls.home.length) : 0, 0);
  const cells = row => Array.from({ length: n }, (_, i) => `<td>${row && row[i] != null ? esc(row[i]) : ''}</td>`).join('');
  const h = p.h || {};
  return `<div class="lv-ls-wrap"><table class="lv-ls">
    <thead><tr><th scope="col"></th>${Array.from({ length: n }, (_, i) => `<th scope="col">${i + 1}</th>`).join('')}<th scope="col" class="r">R</th><th scope="col">H</th></tr></thead>
    <tbody>
      <tr><th scope="row">${esc(p.ta || '원정')}</th>${cells(ls && ls.away)}<td class="r">${esc(p.as)}</td><td>${esc(h.away || 0)}</td></tr>
      <tr><th scope="row">${esc(p.th || '홈')}</th>${cells(ls && ls.home)}<td class="r">${esc(p.hs)}</td><td>${esc(h.home || 0)}</td></tr>
    </tbody></table></div>`;
}

// d = live_get 결과 { payload, at } | null · stale = 마지막 읽기가 실패해 지난 값을 보여 줄 때
export function liveHtml(d, now, offline) {
  if (!d || !d.payload) return msg('중계를 찾을 수 없어요', '중계가 끝났거나 3일이 지나 링크가 만료됐어요.');
  const p = d.payload, at = Date.parse(d.at) || p.at || now, st = p.st || {};
  const state = p.end || p.fin ? '<span class="lv-tag end">경기 끝</span>' : '<span class="lv-tag on">● 실시간</span>';
  const note = offline ? '연결이 끊겼어요 — 다시 시도하는 중'
    : !p.end && !p.fin && now - at > STALE ? '기록하는 폰에서 한동안 소식이 없어요' : '';
  const next = p.fin && !p.end && !offline ? '다음 경기가 시작되면 이 링크에서 이어서 보여요' : '';
  const where = p.fin ? '<div class="lv-now"><b>최종 점수</b></div>'
    : st.t ? `<div class="lv-now"><b>${esc(st.t)}</b>${st.o != null ? ` <span>${esc(st.o)}아웃</span>` : ''}${bases(st.b)}</div>` : '';
  const plays = (p.plays || []).map(x => `<li><span class="lv-inn">${esc(x.t)}</span><b>${esc(x.n)}</b> <span class="lv-res">${esc(x.r)}</span>${x.rbi ? ` <span class="lv-rbi">${esc(x.rbi)}타점</span>` : ''}<small>${esc(x.s === 'away' ? p.ta || '원정' : p.th || '홈')}</small></li>`).join('');
  const bat = (p.bat || []).map(x => `<tr><th scope="row">${esc(x.n)}</th><td>${esc(x.pa)}</td><td>${esc(x.h)}</td><td>${esc(x.rbi)}</td></tr>`).join('');
  return `
    <header class="lv-top"><span class="lv-brand">SprayLab 실시간 중계</span>${state}</header>
    <section class="lv-card lv-score" aria-label="점수">
      <div class="lv-team"><span>${esc(p.ta || '원정')}</span><b>${esc(p.as)}</b></div>
      <div class="lv-team"><span>${esc(p.th || '홈')}</span><b>${esc(p.hs)}</b></div>
      ${where}
    </section>
    ${note ? `<p class="lv-note" role="status">${esc(note)}</p>` : ''}${next ? `<p class="lv-note fin">${esc(next)}</p>` : ''}
    <section class="lv-card">${lineTable(p)}</section>
    ${plays ? `<section class="lv-card"><h2>최근 타석</h2><ol class="lv-plays">${plays}</ol></section>` : ''}
    ${bat ? `<section class="lv-card"><h2>${esc(p.th || '우리 팀')} 타자</h2><table class="lv-bat"><thead><tr><th scope="col">선수</th><th scope="col">타석</th><th scope="col">안타</th><th scope="col">타점</th></tr></thead><tbody>${bat}</tbody></table></section>` : ''}
    <footer class="lv-foot">마지막 업데이트 ${esc(hm(at))}${p.end ? '' : p.fin ? ' · 1분마다 다음 경기를 확인' : ' · 20초마다 자동으로 새로 고침'}<br><a href="landing.html">SprayLab</a>으로 기록하고 있어요</footer>`;
}

function get(id) {
  return fetch(SURL + '/rest/v1/rpc/live_get', {
    method: 'POST', cache: 'no-store',
    headers: { apikey: SKEY, Authorization: 'Bearer ' + SKEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: id }),
  }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
}

function boot(root) {
  const id = new URLSearchParams(location.search).get('g') || '';
  if (!/^[A-Za-z0-9]{10,32}$/.test(id)) { root.innerHTML = msg('링크가 올바르지 않아요', '받은 링크를 다시 눌러 주세요.'); return; }
  let last = null, t = null;
  const run = () => {
    clearTimeout(t);
    get(id).then(d => { last = d; root.innerHTML = liveHtml(d, Date.now()); }, () => {
      root.innerHTML = last ? liveHtml(last, Date.now(), true) : msg('연결이 안 돼요', '인터넷 연결을 확인해 주세요. 잠시 뒤 다시 시도해요.');
    }).then(() => {
      const p = last && last.payload;
      if (p) document.title = `${p.ta || '원정'} ${p.as} : ${p.hs} ${p.th || '홈'} · SprayLab 실시간`;
      if (!document.hidden && !(p && p.end) && !(last && !p)) t = setTimeout(run, p && p.fin ? FIN_EVERY : EVERY);
    });
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(t); else run(); });
  run();
}

const root = typeof document !== 'undefined' && document.getElementById('lvRoot');
if (root) boot(root);
