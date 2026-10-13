// 키보드 Tab 도돌이표 — 화면에 보이는 칸만 차례로 돌고, 마지막 칸 다음은 맨 앞 「타구 입력으로 건너뛰기」로 (Shift+Tab 은 거꾸로)
//   배경: 닫힌 창(타구 결과 · 타석 수정 · 데이터 관리 · 클라우드 · 로그인 등)은 투명(opacity 0)하게, 시트(최근 기록 메뉴 · 필터 · 저장 방법 등)는
//   화면 밖으로 밀어 둔 채 문서에 남아 있다. 브라우저 Tab 은 이것들도 들르므로 「타석 기록」 다음 Tab 이 보이지 않는 버튼 수십 개로 들어가
//   포커스가 사라진 것처럼 보였고, 끝까지 가면 주소창으로 빠져 새로고침해야 다시 Tab 을 쓸 수 있었다
//   · 창 여닫기 코드는 그대로 둔다 — Tab 키만 가로채 "보이는 칸" 중 다음 칸으로 옮긴다
//   · 다른 코드가 이미 Tab 을 처리했으면(preventDefault) · 한글 조합 중이면 손대지 않는다(브라우저 기본 동작)

const SEL = 'a[href],area[href],button,input:not([type="hidden"]),select,textarea,iframe,summary,[tabindex],[contenteditable=""],[contenteditable="true"]';

function _off(r) { return r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth; }

// 안 보이는 칸: display none · visibility hidden · 감싼 상자가 투명(opacity 0 — 닫힌 창)
//   자기 자신만 투명한 칸(마우스를 올리면 보이는 「수정」 · 꾸민 버튼 위에 덮은 파일 선택 칸)은 누를 수 있는 칸이라 남긴다
function _shown(el) {
  if (el.checkVisibility) { if (!el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true })) return false; }
  else if (!el.getClientRects().length || getComputedStyle(el).visibility !== 'visible') return false;
  for (let x = el.parentElement; x; x = x.parentElement) if (getComputedStyle(x).opacity === '0') return false;
  return true;
}

// 화면 밖으로 밀어 둔 고정(position: fixed) 시트 안의 칸 — 스크롤로도 닿지 않는다
//   시트째 화면 밖이거나, 칸 자체가 화면 밖인데 사이에 스크롤되는 상자가 없을 때. 스크롤 상자 안에서 아래에 가려진 칸은 Tab 이 스크롤해 보여 주므로 남긴다
function _parked(el) {
  let scroller = false;
  for (let x = el; x && x !== document.documentElement; x = x.parentElement) {
    const cs = getComputedStyle(x);
    if (x !== el && /auto|scroll/.test(cs.overflowY + cs.overflowX) && (x.scrollHeight > x.clientHeight || x.scrollWidth > x.clientWidth)) scroller = true;
    if (cs.position === 'fixed') return _off(x.getBoundingClientRect()) || (!scroller && _off(el.getBoundingClientRect()));
  }
  return false;
}

function _tabbable(el) {
  if (el.matches(':disabled') || el.closest('[inert]')) return false;
  const t = el.getAttribute('tabindex');
  if (t !== null ? parseInt(t, 10) < 0 : (el.tabIndex < 0 && !el.isContentEditable)) return false;
  // 라디오 묶음은 한 칸(선택된 것, 없으면 첫 번째)
  if (el.type === 'radio' && el.name && !el.checked) {
    const g = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
    if (Array.prototype.some.call(g, r => r.checked) || g[0] !== el) return false;
  }
  if (!_shown(el)) return false;
  // 건너뛰기 링크는 평소 화면 위에 숨어 있다가 포커스를 받으면 내려온다 → 화면 밖이어도 칸으로 친다
  return el.classList.contains('skip-link') || !_parked(el);
}

// 포커스가 없을 때(본문)는 마지막으로 누른 자리에서 시작 — 브라우저 기본 동작과 같게. 포커스가 생기면 지운다
//   (showApp 이 본문에 포커스를 주어 시작점을 문서 처음으로 되돌리는 것도 그대로 유지)
let _from = null;
document.addEventListener('pointerdown', (e) => { _from = e.target; }, true);
document.addEventListener('focusin', () => { _from = null; }, true);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing || e.keyCode === 229) return;
  const all = document.querySelectorAll(SEL), back = e.shiftKey;
  let a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) a = _from && _from.isConnected ? _from : null;
  // 지금 칸 바로 다음(이전) 칸부터 찾는다. 지금 칸이 목록에 없으면(본문 · 누른 자리) 문서 순서로 그 뒤(앞)부터
  let i = a ? Array.prototype.indexOf.call(all, a) : -1;
  if (i < 0) {
    i = back ? all.length : -1;
    if (a) for (let k = 0; k < all.length; k++) {
      const p = a.compareDocumentPosition(all[k]);
      if (p & Node.DOCUMENT_POSITION_FOLLOWING || p & Node.DOCUMENT_POSITION_CONTAINED_BY) { i = back ? k : k - 1; break; }
    }
  }
  const n = all.length, step = back ? -1 : 1;
  for (let c = 1; c <= n; c++) {
    const el = all[(((i + step * c) % n) + n) % n];   // 끝을 넘으면 처음으로(도돌이표)
    if (el === a || !_tabbable(el)) continue;
    el.focus();
    if (document.activeElement === el) { e.preventDefault(); return; }
  }
  // 보이는 칸이 하나도 없으면 브라우저 기본 동작
});
