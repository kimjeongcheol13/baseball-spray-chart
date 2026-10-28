// 오더지(타순표) — 경기 전 심판 · 기록원에게 내는 한 팀의 타순표를 A4 세로 한 장으로: 타순 · 수비 위치 · 선수명 · 등번호, 아래에 후보 선수, 서명 칸
//  · 읽기만 한다 (AS.home_lineup · AS.away_lineup · AS.info · 팀 이름 칸) — 저장 구조 · 키 변경 없음
//  · 주전(isStarter !== false)이 지금 순서대로 타순, 후보는 아래 따로. 주전 9줄 · 후보 5줄이 안 되면 빈 줄을 두어 손으로 적게 한다 (라인업이 비어도 빈 양식이 나온다)
//  · 창 · 그리기 · 이미지 저장 · 인쇄는 리그 기록지(scoresheet.js)와 같은 식 (.rp.ss 창 · core.js _downloadCanvas · body.os-printing · css/report.css)
//  · 진입: ☰ 메뉴 내보내기 · 그 밖의 기능(setup.js) 라인업 · 팀

const $ = id => document.getElementById(id);
// 수비 위치 → 기록지 번호 (6-4-3 의 그 번호)
const POSN = { __proto__: null, '투수': 1, '포수': 2, '1루': 3, '2루': 4, '3루': 5, '유격': 6, '좌익': 7, '중견': 8, '우익': 9 };

// ── 그릴 내용 한 벌 ───────────────────────────────────────────
// g = { team: 'home' | 'away', home_lineup, away_lineup, th, ta, date, venue }
export function orderData(g) {
  const team = g.team === 'away' ? 'away' : 'home';
  const src = team === 'home' ? g.home_lineup : g.away_lineup;
  const lu = (Array.isArray(src) ? src : []).filter(p => p && p.name != null);
  const row = p => ({ name: String(p.name), num: p.num != null && p.num !== '' ? String(p.num) : '', pos: p.pos ? p.pos + (POSN[p.pos] ? ' (' + POSN[p.pos] + ')' : '') : '' });
  const blank = n => Array.from({ length: Math.max(0, n) }, () => ({ name: '', num: '', pos: '' }));
  const starters = lu.filter(p => p.isStarter !== false).map(row), bench = lu.filter(p => p.isStarter === false).map(row);
  return {
    team, side: team === 'home' ? '홈' : '원정',
    name: (team === 'home' ? g.th : g.ta) || '', opp: (team === 'home' ? g.ta : g.th) || '',
    starters: starters.concat(blank(9 - starters.length)), bench: bench.concat(blank(5 - bench.length)),
    date: g.date || '', venue: g.venue || '',
  };
}

// ── 그리기 (논리 794 × 1123 = A4 세로 · 2배 PNG. 선수가 아주 많으면 세로만 늘린다) ──
const C = { paper: '#FFFFFF', ink: '#14192B', ink2: '#4A4F62', rule: '#B9B4A8', fill: '#EFEBE2' };
const F = { disp: '"Black Han Sans","Noto Sans KR",sans-serif', kr: '"Noto Sans KR",sans-serif', mono: '"IBM Plex Mono",monospace' };
const W = 794, H0 = 1123, SCALE = 2, X = 40, CW = W - X * 2;
const COLS = [['타순', 60], ['수비 위치', 130], ['선수명', 0], ['등번호', 100]];   // 0 = 나머지 폭

export function drawOrder(cv, d) {
  const top = 146, foot = 110, fixed = (24 + 22) * 2 + 18, n = d.starters.length + d.bench.length;
  const rh = Math.max(20, Math.min(44, Math.floor((H0 - top - foot - fixed) / n)));
  const H = Math.max(H0, top + foot + fixed + n * rh);
  cv.width = W * SCALE; cv.height = H * SCALE;
  const c = cv.getContext('2d');
  c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  c.textBaseline = 'alphabetic';
  c.fillStyle = C.paper; c.fillRect(0, 0, W, H);
  const font = (w, s, f) => { c.font = w + ' ' + s + 'px ' + f; };
  const text = (t, x, y, col, al) => { c.fillStyle = col; c.textAlign = al || 'left'; c.fillText(t, x, y); };
  const fit = (t, w, s, f, maxW, min) => { let z = s; do { font(w, z, f); if (c.measureText(t).width <= maxW) break; z -= 0.5; } while (z > (min || 7)); };
  const hl = (x1, x2, y, col, lw) => { c.fillStyle = col; c.fillRect(x1, y - (lw || 1) / 2, x2 - x1, lw || 1); };
  const vl = (x, y1, y2, col) => { c.fillStyle = col; c.fillRect(x - 0.5, y1, 1, y2 - y1); };
  const box = (x, y, w, h) => { c.strokeStyle = C.ink; c.lineWidth = 1.5; c.strokeRect(x, y, w, h); };
  const field = (lbl, val, x0, x1, y) => {   // 밑줄 칸 (빈칸은 손으로 적는다)
    font('600', 11, F.mono); text(lbl, x0, y, C.ink2);
    const lx = x0 + c.measureText(lbl).width + 8;
    hl(lx, x1, y + 4, C.ink);
    if (val) { fit(val, '700', 14, F.kr, x1 - lx - 8, 9); text(val, lx + 4, y, C.ink); }
  };

  // 머리: 제목 · 대회 / 경기일 / 구장 · 우리 팀 / 상대 팀
  font('400', 30, F.disp); text('오더지', X, 52, C.ink);
  font('600', 11, F.mono); if ('letterSpacing' in c) c.letterSpacing = '2px';
  text('SPRAYLAB · LINEUP CARD', W - X, 30, C.ink2, 'right');
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  [['대회', ''], ['경기일', d.date], ['구장', d.venue]].forEach((f, i) => field(f[0], f[1], X + (CW / 3) * i, X + (CW / 3) * (i + 1) - 14, 84));
  field('팀 (' + d.side + ')', d.name, X, X + CW / 2 - 14, 112);
  field('상대 팀', d.opp, X + CW / 2, W - X, 112);
  hl(X, W - X, 129, C.ink, 3);

  // 표: 띠 · 머리 줄 · 선수 줄 (타순 번호는 주전 표만)
  const rest = CW - COLS.reduce((s, k) => s + k[1], 0), xs = [X];
  COLS.forEach((k, i) => xs.push(xs[i] + (k[1] || rest)));
  const table = (y, title, rows, numbered) => {
    const T0 = y;
    c.fillStyle = C.ink; c.fillRect(X, y, CW, 24);
    font('400', 15, F.disp); text(title, X + 10, y + 18, C.paper);
    y += 24;
    c.fillStyle = C.fill; c.fillRect(X, y, CW, 22);
    font('700', 11, F.kr);
    COLS.forEach((k, i) => text(k[0], (xs[i] + xs[i + 1]) / 2, y + 15, C.ink2, 'center'));
    y += 22;
    const R0 = y;
    rows.forEach((r, i) => {
      hl(X, W - X, y, C.rule);
      const cy = y + rh / 2 + 5;
      if (numbered) { font('600', 15, F.mono); text(String(i + 1), (xs[0] + xs[1]) / 2, cy, C.ink, 'center'); }
      fit(r.pos, '700', 14, F.kr, xs[2] - xs[1] - 12, 9); text(r.pos, (xs[1] + xs[2]) / 2, cy, C.ink, 'center');
      fit(r.name, '700', 16, F.kr, xs[3] - xs[2] - 20, 9); text(r.name, xs[2] + 12, cy, C.ink);
      font('600', 15, F.mono); text(r.num, (xs[3] + xs[4]) / 2, cy, C.ink, 'center');
      y += rh;
    });
    for (let i = 1; i < COLS.length; i++) vl(xs[i], R0 - 22, y, C.rule);
    box(X, T0, CW, y - T0);
    return y;
  };
  const y = table(top, '타순  ·  ' + d.side + (d.name ? '  ' + d.name : ''), d.starters, true);
  table(y + 18, '후보 선수', d.bench, false);

  // 발: 약어 · 서명 칸
  const FY = H - foot + 30;
  font('500', 10, F.kr);
  text('수비 위치 (번호) — 투수 1 · 포수 2 · 1루 3 · 2루 4 · 3루 5 · 유격 6 · 좌익 7 · 중견 8 · 우익 9   ·   빈칸은 손으로 적어 주세요', X, FY, C.ink2);
  font('700', 12, F.kr);
  ['감독', '주장', '기록원 확인'].forEach((s, i) => {
    const x0 = X + (CW / 3) * i, x1 = x0 + CW / 3 - 18;
    text(s, x0, FY + 40, C.ink);
    hl(x0 + c.measureText(s).width + 8, x1, FY + 44, C.ink);
  });
  return c;
}

// ── 창 ──────────────────────────────────────────────────────
let _cv = null, _ret = null, _seq = 0, _team = 'home';
const _fail = () => { if (window.showToast) window.showToast('오더지를 그리지 못했어요', false); };

function _mount() {
  if ($('osView')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div id="osView" class="rp ss" role="dialog" aria-modal="true" aria-labelledby="osTitle" hidden>
  <div class="rp-panel">
    <header class="rp-hd">
      <h2 id="osTitle">오더지</h2>
      <button type="button" class="rp-x" id="osClose" aria-label="닫기">✕</button>
    </header>
    <div class="rp-body">
      <div class="rp-field"><span class="rp-lbl">어느 팀 타순표인가요?</span>
        <div class="rp-seg" id="osTeam"><button type="button" data-team="home">홈</button><button type="button" data-team="away">원정</button></div>
      </div>
      <figure class="rp-prev ss-prev">
        <img id="osImg" alt="오더지 미리보기">
        <figcaption class="rp-help">라인업 탭의 주전 순서가 타순이에요. 빈 줄은 인쇄한 뒤 손으로 적으면 됩니다. 저장·공유가 안 되는 브라우저(카톡 안 등)에서는 위 이미지를 길게 눌러 저장하세요.</figcaption>
      </figure>
    </div>
    <footer class="rp-act">
      <button type="button" class="rp-btn primary" id="osSave" disabled>이미지 저장 · 공유</button>
      <button type="button" class="rp-btn" id="osPrint" disabled>인쇄 / PDF</button>
    </footer>
  </div>
</div>`);
  $('osClose').onclick = closeOrderSheet;
  $('osView').addEventListener('click', e => { if (e.target.id === 'osView') closeOrderSheet(); });
  $('osView').addEventListener('keydown', e => { if (e.key === 'Escape') closeOrderSheet(); });
  $('osTeam').addEventListener('click', e => {
    const b = e.target.closest('button[data-team]');
    if (!b || b.dataset.team === _team) return;
    _team = b.dataset.team;
    _render().catch(_fail);
  });
  $('osSave').onclick = () => { if (_cv) window._downloadCanvas(_cv, 'spraylab_order_' + Date.now() + '.png'); };
  $('osPrint').onclick = () => {
    if (!_cv) return;
    const b = document.body, off = () => { b.classList.remove('os-printing'); window.removeEventListener('afterprint', off); };
    b.classList.add('os-printing');
    window.addEventListener('afterprint', off);
    window.print();
  };
}

// 경기일: 경기 정보(YYYY-MM-DD) → 저장 항목의 날짜 → 빈칸 (scoresheet.js 와 같은 규칙)
function _date(info) {
  if (info && typeof info.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(info.date)) return info.date.replace(/-/g, '.');
  try { const s = JSON.parse(localStorage.getItem(window._curSaveKey)); if (s && typeof s.d === 'string') return s.d; } catch (e) {}
  return '';
}

async function _fonts() {
  if (!document.fonts || !document.fonts.load) return;
  const all = Promise.all(['400 30px "Black Han Sans"', '700 14px "Noto Sans KR"', '600 12px "IBM Plex Mono"'].map(f => document.fonts.load(f).catch(() => null)));
  await Promise.race([all, new Promise(r => setTimeout(r, 1500))]);
}

async function _render() {
  const seq = ++_seq, A = window.AS || {}, info = A.info || {};
  $('osSave').disabled = $('osPrint').disabled = true;
  $('osTeam').querySelectorAll('button').forEach(b => { const on = b.dataset.team === _team; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  const d = orderData({
    team: _team, home_lineup: A.home_lineup, away_lineup: A.away_lineup,
    th: ($('tHome') || {}).value, ta: ($('tAway') || {}).value, date: _date(info), venue: typeof info.venue === 'string' ? info.venue : '',
  });
  await _fonts();
  if (seq !== _seq) return;
  const cv = document.createElement('canvas');
  drawOrder(cv, d);
  _cv = cv;
  $('osImg').src = cv.toDataURL('image/png');
  $('osSave').disabled = $('osPrint').disabled = false;
}

// 처음엔 라인업 탭에서 보고 있던 팀
export function openOrderSheet() {
  _mount();
  const v = $('osView');
  _team = window.AS && window.AS.curTeam === 'away' ? 'away' : 'home';
  _cv = null;
  $('osImg').removeAttribute('src');
  if (v.hidden) {
    _ret = document.activeElement;
    v.hidden = false;
    document.documentElement.classList.add('rp-open');
  }
  setTimeout(() => { try { $('osClose').focus(); } catch (e) {} }, 30);
  _render().catch(_fail);
}

export function closeOrderSheet() {
  const v = $('osView');
  if (!v || v.hidden) return;
  v.hidden = true;
  _seq++;
  document.documentElement.classList.remove('rp-open');
  try { if (_ret && _ret.focus) _ret.focus(); } catch (e) {}
}

window.openOrderSheet = openOrderSheet;
window.closeOrderSheet = closeOrderSheet;
