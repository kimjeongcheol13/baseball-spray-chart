// 기록 탭 — 입력 흐름(필드 탭 팝업·즉시 기록 버튼·저장)은 core.js 그대로 두고, 그 둘레를 새로 짠다
//   이닝 ◀ ▶ · B·S·O 카운트 · 현재 타자 카드(오늘 기록·시즌·다음 타자) · 필드 밖 결과 버튼 · 최근 기록 3개 + 되돌리기
import { HITS, esc as _esc } from '../constants.js';
import { buildData, playerData, calcStats, f3 } from './batdata.js?v=4';

const $ = id => document.getElementById(id);
const SHORT = {
  '안타': ['안타', '1b'], '내야안타': ['내야안타', '1b'], '2루타': ['2루타', 'xbh'], '3루타': ['3루타', 'xbh'], '홈런': ['홈런', 'hr'],
  '볼넷': ['볼넷', 'bb'], '사구': ['사구', 'bb'], '삼진': ['삼진', 'k'], '희타': ['희생번트', 'out'], '희비': ['희생플라이', 'out'],
  '땅볼 아웃': ['땅볼', 'out'], '플라이 아웃': ['뜬공', 'out'], '병살': ['병살', 'out'],
};
const DIR = { LF: '좌익', LC: '좌중간', CF: '중견', RC: '우중간', RF: '우익' };
const POS = { P: '투수', C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수', DH: '지명' };

let _season = null;      // { name → st } 저장 경기 기준 시즌 성적 캐시 (기록할 때마다 새로)
let _seasonAt = 0;

// ── 마운트 ───────────────────────────────────────────────────
function _mount() {
  const center = document.querySelector('.pnl-center');
  const fw = center && center.querySelector('.field-wrap');
  if (!center || !fw || $('recTop')) return;
  document.body.classList.add('rec-v2');

  // 이닝: 선택 상자 양옆에 ◀ ▶ (초/말을 한 칸씩)
  const inn = $('innSel');
  if (inn && !inn.parentElement.classList.contains('rv-inn')) {
    const box = document.createElement('div');
    box.className = 'rv-inn';
    inn.before(box);
    box.innerHTML = '<button type="button" class="rv-inn-b" aria-label="이전 이닝" onclick="recStepInning(-1)">◀</button>';
    box.appendChild(inn);
    box.insertAdjacentHTML('beforeend', '<button type="button" class="rv-inn-b" aria-label="다음 이닝" onclick="recStepInning(1)">▶</button>');
  }

  // 필드 위: 카운트 + 현재 타자 카드
  const top = document.createElement('div');
  top.id = 'recTop';
  top.className = 'rv-top';
  const bar = center.querySelector('.batter-bar');
  (bar || fw).before(top);

  // 필드 아래(스크롤 영역): 필드 밖 결과 추가 버튼 + 최근 기록
  const below = document.createElement('div');
  below.id = 'recBelow';
  below.className = 'rv-below';
  const qb = $('quickBar');
  (qb || fw).after(below);

  // 기록 직후 잠깐 보이는 미니 스프레이(core _showMiniSprayAfterRecord)를 필드 자리 바로 아래로
  const mini = $('miniSprayWrap');
  if (mini) fw.after(mini);

  _hookLegacy();
  renderRecordPanel();
}

export function renderRecordPanel() {
  const top = $('recTop'), below = $('recBelow');
  if (!top || !below) return;
  top.innerHTML = _countHtml() + _batterHtml();
  below.innerHTML = _moreHtml() + _recentHtml();
}

// ── 이닝 ─────────────────────────────────────────────────────
export function recStepInning(d) {
  const s = $('innSel');
  if (!s) return;
  const i = Math.max(0, Math.min(s.options.length - 1, s.selectedIndex + d));
  if (i === s.selectedIndex) return;
  s.selectedIndex = i;
  const disp = $('innDisp');
  if (disp) disp.textContent = s.value;
  s.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── 카운트 ───────────────────────────────────────────────────
function _countHtml() {
  const AS = window.AS || {};
  const gf = typeof window.GF !== 'undefined' && window.GF && window.GF.active;
  const dots = (n, max, cls) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on ' + cls : ''}"></i>`).join('');
  const outs = gf ? (window.GF.outs || 0) : (AS.outs || 0);
  return `
    <div class="rv-count" role="group" aria-label="볼카운트">
      <button type="button" class="rv-cg" onclick="chCount('b')" aria-label="볼 ${AS.balls || 0}, 누르면 +1"><span>B</span>${dots(AS.balls || 0, 3, 'b')}</button>
      <button type="button" class="rv-cg" onclick="chCount('s')" aria-label="스트라이크 ${AS.strikes || 0}, 누르면 +1"><span>S</span>${dots(AS.strikes || 0, 2, 's')}</button>
      ${gf
        ? `<span class="rv-cg ro" title="경기 운영 모드가 아웃을 자동으로 셉니다"><span>O</span>${dots(outs, 2, 'o')}</span>`
        : `<button type="button" class="rv-cg" onclick="chCount('o')" aria-label="아웃 ${outs}, 누르면 +1"><span>O</span>${dots(outs, 2, 'o')}</button>`}
      <small>누르면 +1</small>
      <button type="button" class="rv-reset" onclick="resetCount()">초기화</button>
    </div>`;
}

// ── 현재 타자 카드 ───────────────────────────────────────────
function _seasonOf(name) {
  if (!_season || Date.now() - _seasonAt > 1500) {
    _season = {};
    _seasonAt = Date.now();
    try { _season._data = buildData(); } catch (e) { _season._data = null; }
  }
  if (!_season._data) return null;
  if (!_season[name]) _season[name] = playerData(_season._data, name).st;
  return _season[name];
}

function _lineup() {
  try { return (window.getActiveLineup && window.getActiveLineup()) || []; } catch (e) { return []; }
}

function _batterHtml() {
  const AS = window.AS || {};
  const b = AS.batter;
  const lu = _lineup();
  if (!b) {
    return `
      <div class="rv-bat empty">
        <div><b>타자를 선택하세요</b><small>라인업에서 지금 타석에 선 선수를 고르면 기록을 시작할 수 있어요</small></div>
        <button type="button" class="rv-open" onclick="shellDrawer(true)">라인업 열기</button>
      </div>`;
  }
  const i = lu.findIndex(p => String(p.id) === String(b.id));
  const next = i >= 0 && lu.length > 1 ? lu[(i + 1) % lu.length] : null;
  const today = (AS.abs || []).filter(a => String(a.bid) === String(b.id) || (!a.bid && a.bname === b.name));
  const t = calcStats(today);
  const s = _seasonOf(b.name);
  const bats = b.bats || b.bh;
  const meta = [i >= 0 ? `${i + 1}번` : '', POS[b.pos] || b.pos || '', bats === 'L' ? '좌타' : bats === 'R' ? '우타' : '', AS.curTeam === 'away' ? '원정' : '홈'].filter(Boolean).join(' · ');
  const line = t.pa ? `${t.ab}타수 ${t.h}안타${t.rbi ? ` ${t.rbi}타점` : ''}${t.bb + t.hbp ? ` ${t.bb + t.hbp}사사구` : ''}` : '첫 타석';
  const ns = next ? _seasonOf(next.name) : null;
  return `
    <div class="rv-bat">
      <div class="rv-bat-row">
        <button type="button" class="rv-who" onclick="shellDrawer(true)" aria-label="라인업 열기">
          <span class="rv-ey"><i></i>지금 타석</span>
          <span class="rv-nm">${_esc(b.name)}${b.num !== '' && b.num != null ? `<small>#${_esc(b.num)}</small>` : ''}<em>▾</em></span>
          <span class="rv-meta">${_esc(meta)}</span>
        </button>
        <div class="rv-ssn"><small>시즌 ${s ? s.pa : 0}타석</small><b>${s && s.ab ? f3(s.avg) : '—'}</b></div>
      </div>
      <div class="rv-today">
        <small>오늘</small><b>${line}</b>
        <span class="rv-chips an-rchips">${today.map(a => { const [tx, c] = SHORT[a.res] || [a.res, 'out']; return `<i class="r-${c}">${_esc(tx)}</i>`; }).join('')}</span>
      </div>
      <div class="rv-order">
        <button type="button" onclick="recStepBatter(-1)"${lu.length > 1 ? '' : ' disabled'}>◀ 이전</button>
        <span class="rv-next">${next ? `<small>다음</small>${lu.indexOf(next) + 1}번 ${_esc(next.name)}${ns && ns.ab ? ` <em>${f3(ns.avg)}</em>` : ''}` : ''}</span>
        <button type="button" onclick="recStepBatter(1)"${lu.length > 1 ? '' : ' disabled'}>다음 ▶</button>
      </div>
    </div>`;
}

export function recStepBatter(d) {
  const AS = window.AS || {};
  const lu = _lineup();
  if (lu.length < 2) return;
  const i = AS.batter ? lu.findIndex(p => String(p.id) === String(AS.batter.id)) : -1;
  const n = lu[((i < 0 ? 0 : i + d) % lu.length + lu.length) % lu.length];
  if (window.shellSelectBatter) window.shellSelectBatter(n.id);
  renderRecordPanel();
}

// ── 필드 밖 결과 (삼진·볼넷·사구는 기존 즉시 기록 버튼, 나머지 추가) ──
function _moreHtml() {
  const btn = (res, l) => `<button type="button" onclick="recOther('${res}')">${l}</button>`;
  return `
    <div class="rv-more" role="group" aria-label="그 밖의 결과">
      ${btn('희타', '희생번트')}${btn('희비', '희생플라이')}${btn('병살', '병살')}${btn('내야안타', '내야안타')}
    </div>`;
}

// ── 최근 기록 ────────────────────────────────────────────────
function _recentHtml() {
  const AS = window.AS || {};
  const list = (AS.abs || []).slice(-3).reverse();
  const row = a => {
    const [tx, c] = SHORT[a.res] || [a.res, 'out'];
    const extra = [a.dir ? DIR[a.dir] || a.dir : '', a.rbi ? `${a.rbi}타점` : ''].filter(Boolean).join(' · ');
    return `<li><small>${_esc(a.inn || '')}</small><b>${_esc(a.bname || '')}</b><i class="r-${c}">${_esc(tx)}</i><span>${_esc(extra)}</span></li>`;
  };
  return `
    <section class="rv-recent an-rchips">
      <header>
        <h3>최근 기록</h3>
        ${list.length ? '<button type="button" class="rv-undo" onclick="undoLast()">↩ 되돌리기</button>' : ''}
        <button type="button" class="rv-all" onclick="shellRecSheet(true)">전체 ${(AS.abs || []).length}타석 ›</button>
      </header>
      ${list.length ? `<ol>${list.map(row).join('')}</ol>` : '<p class="rv-none">아직 기록이 없어요. 필드를 누르거나 위 버튼으로 첫 타석을 기록해 보세요.</p>'}
    </section>`;
}

// ── 기존 흐름에 연결 ─────────────────────────────────────────
// updateAll(기록·삭제·되돌리기 후) · renderCount(카운트) · renderLP(타자 선택) 뒤에 다시 그린다
function _hookLegacy() {
  ['updateAll', 'renderCount', 'renderLP'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig._rv) return;
    const wrapped = function () {
      const r = orig.apply(this, arguments);
      if (fn === 'updateAll') _season = null;   // 새 기록이 생겼으니 시즌 캐시도 새로
      try { renderRecordPanel(); } catch (e) { console.warn('[record] render', e); }
      return r;
    };
    wrapped._rv = true;
    window[fn] = wrapped;
  });

  // 필드 크기: core의 _fieldFS는 필드 아래 형제 요소 높이를 모두 빼서 한 화면에 맞춘다.
  // 필드 밖 추가 버튼·최근 기록(#recBelow)은 스크롤로 보므로 계산에서 뺀다.
  const origFS = window._fieldFS;
  if (typeof origFS === 'function' && !origFS._rv) {
    const wrappedFS = function (w) {
      const below = $('recBelow');
      const prev = below ? below.style.display : null;
      if (below && window.innerWidth <= 720) below.style.display = 'none';
      try { return origFS.apply(this, arguments); } finally { if (below) below.style.display = prev; }
    };
    wrappedFS._rv = true;
    window._fieldFS = wrappedFS;
  }
}

function _init() {
  _mount();
  // 필드 크기를 새 배치 기준으로 다시 계산
  requestAnimationFrame(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) {} });
}

if (typeof window !== 'undefined') {
  window.renderRecordPanel = renderRecordPanel;
  window.recStepInning = recStepInning;
  window.recStepBatter = recStepBatter;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_init, 0));
  else setTimeout(_init, 0);
}
