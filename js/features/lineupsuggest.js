// 타순 추천 — 우리 팀(홈 라인업) 주전을 저장 경기 + 지금 경기의 우리 팀 타석(team 'home')으로 현대식(The Book) 순서로 제안한다
//  · wOBA 상위 3명 → 그중 출루율 최고 = 1번, 나머지 둘 중 장타력(ISO) 높은 쪽 = 4번 · 다른 쪽 = 2번, 4위 = 3번, 5위부터 = 5번~
//  · 10타석 미만 주전은 추천에서 빼고 지금 순서대로 뒤에(기록 부족) · 후보(isStarter false)는 맨 뒤에 지금 순서대로
//  · 같은 선수 = 이름이 같고 번호가 같거나 한쪽이 비어 있음 · 지표는 batdata.js calcStats (WOBA_W 공유)
//  · 「적용」을 눌러야 AS.home_lineup 순서가 바뀐다 (선수 객체 · 저장 구조는 그대로, 순서만) · 같은 창에서 「되돌리기」
import { esc } from '../constants.js';
import { buildData, calcStats, f3 } from './batdata.js?v=9';

export const MIN_PA = 10;
const same = (p, a) => a.bname === p.name && (!p.num || !a.bnum || String(p.num) === String(a.bnum));

// lineup = 라인업 배열, abs = 우리 팀 타석 → { rows: [{ p, st, why }] (주전 새 순서), bench: [후보] }
export function suggest(lineup, abs) {
  const starters = lineup.filter(p => p && p.isStarter !== false), bench = lineup.filter(p => p && p.isStarter === false);
  const rows = starters.map(p => ({ p, st: calcStats(abs.filter(a => same(p, a))) }));
  const ok = rows.filter(r => r.st.pa >= MIN_PA).sort((x, y) => y.st.woba - x.st.woba);   // 같으면 지금 순서 (안정 정렬)
  let order = ok.map(r => ({ ...r, why: 'wOBA 순' }));
  if (ok.length >= 3) {
    const t3 = ok.slice(0, 3), lead = t3.reduce((b, r) => (r.st.obp > b.st.obp ? r : b));
    const [clean, two] = t3.filter(r => r !== lead).sort((x, y) => y.st.iso - x.st.iso);
    order = [{ ...lead, why: '상위 3명 중 출루율 최고' }, { ...two, why: '상위 3명' }];
    if (ok[3]) order.push({ ...ok[3], why: '4번째로 좋은 타자' });
    order.push({ ...clean, why: '상위 3명 중 장타력 최고' });
    order.push(...ok.slice(4).map(r => ({ ...r, why: 'wOBA 순' })));
  }
  rows.filter(r => r.st.pa < MIN_PA).forEach(r => order.push({ ...r, why: `기록 부족 (${r.st.pa}타석) · 지금 순서` }));
  return { rows: order, bench };
}

function _ourAbs() {
  const out = [];
  try { buildData().games.forEach(g => (g.abs || []).forEach(a => { if (a && (a.team || 'home') === 'home') out.push(a); })); } catch (e) {}
  return out;
}
function _redraw() {
  try { window.renderLP(); window.renderMob(); } catch (e) {}
  try { window.scheduleAutoSave(); } catch (e) {}
}
// 순서만 바꾼다 — 같은 배열을 제자리에서 (다른 곳이 들고 있는 참조도 그대로)
function _setOrder(list) { const L = window.AS.home_lineup; L.splice(0, L.length, ...list); _redraw(); }

function _close() { const ov = document.getElementById('lsSheet'); if (ov) ov.remove(); }
export function open() {
  _close();
  const L = (window.AS && window.AS.home_lineup) || [];
  const { rows, bench } = suggest(L, _ourAbs());
  const enough = rows.filter(r => r.st.pa >= MIN_PA).length;
  const ov = document.createElement('div');
  ov.id = 'lsSheet'; ov.className = 'overlay show pes-ov';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'lsSheetT');
  const li = (r, i) => `<li><span class="ls-n">${i + 1}</span><b>${esc((r.p.num ? '#' + r.p.num + ' ' : '') + r.p.name)}</b>`
    + `<span class="ls-st">${r.st.pa >= MIN_PA ? `출루 ${f3(r.st.obp)} · 장타 ${f3(r.st.slg)} · wOBA ${f3(r.st.woba)}` : ''}</span><em>${esc(r.why)}</em></li>`;
  const body = !rows.length ? '<p class="pes-sub">홈 라인업에 주전이 없어요. 선수를 추가하면 추천할 수 있어요.</p>'
    : `<p class="pes-sub">우리 팀 지난 기록(저장 경기 + 지금 경기)으로 정한 순서예요. 기록 ${MIN_PA}타석 이상인 주전 ${enough}명을 현대식(최고 타자 2·4번)으로 놓았어요.</p>`
      + `<ol class="ls-list">${rows.map(li).join('')}</ol>`
      + (bench.length ? `<p class="pes-sub">후보 ${bench.length}명은 그 뒤에 지금 순서대로.</p>` : '');
  const can = enough >= 2;
  ov.innerHTML = `<div class="modal pes"><h3 id="lsSheetT">타순 추천</h3>${body}`
    + (can ? '<button type="button" class="pes-btn ls-act" data-act="apply">이 순서로 적용</button>' : (rows.length ? `<p class="pes-sub">기록 ${MIN_PA}타석 이상인 주전이 2명 이상이어야 추천할 수 있어요.</p>` : ''))
    + '<button type="button" class="pes-cancel" data-act="close">닫기</button></div>';
  let before = null;
  ov.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) { if (ev.target === ov) _close(); return; }
    if (b.dataset.act === 'close') return _close();
    if (b.dataset.act === 'apply') {
      before = L.slice();
      try { window.swLineupTab('home'); } catch (e) {}   // 원정 탭을 보고 있었으면 바뀐 홈 라인업이 보이게
      _setOrder([...rows.map(r => r.p), ...bench]);
      b.dataset.act = 'undo'; b.textContent = '↩ 되돌리기 (원래 순서로)';
      const d = ov.querySelector('.ls-done');
      if (d) d.textContent = '적용했어요 — 홈 라인업 순서가 바뀌었어요.';
      else b.insertAdjacentHTML('beforebegin', '<p class="pes-sub ls-done" role="status">적용했어요 — 홈 라인업 순서가 바뀌었어요.</p>');
    } else if (b.dataset.act === 'undo' && before) {
      _setOrder(before); before = null;
      const d = ov.querySelector('.ls-done'); if (d) d.textContent = '원래 순서로 되돌렸어요.';
      b.dataset.act = 'apply'; b.textContent = '이 순서로 적용';
    }
  });
  ov.addEventListener('keydown', ev => { if (ev.key === 'Escape') _close(); });
  document.body.appendChild(ov);
  const f = ov.querySelector('button'); if (f) f.focus();
}

if (typeof window !== 'undefined') {
  window.LineupSuggest = { MIN_PA, suggest, open };
  window.lsOpen = open;
}
