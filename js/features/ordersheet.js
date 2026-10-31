// 오더지(타순표) — 경기 전 심판 · 기록원에게 내는 한 팀의 타순표를 A4 세로 한 장으로: 타순 · 수비 위치 · 선수명 · 등번호, 아래에 후보 선수, 서명 칸
//  · 읽기만 한다 (AS.home_lineup · AS.away_lineup · AS.info · 팀 이름 칸) — 저장 구조 · 키 변경 없음
//  · 주전(isStarter !== false)이 지금 순서대로 타순, 후보는 아래 따로. 주전 9줄 · 후보 5줄이 안 되면 빈 줄을 두어 손으로 적게 한다 (라인업이 비어도 빈 양식이 나온다)
//  · 창 · 그리기 · 이미지 저장 · 인쇄는 리그 기록지(scoresheet.js)와 같은 식 (.rp.ss 창 · core.js _downloadCanvas · body.os-printing · css/report.css)
//  · 진입: ☰ 메뉴 내보내기 · 그 밖의 기능(setup.js) 라인업 · 팀

import { FONT, PAPER, font, fitFont, rr, wordmark, drawWithFonts } from './imgkit.js?v=3';

const $ = id => document.getElementById(id);
// 수비 위치 → 기록지 번호 (6-4-3 의 그 번호)
const POSN = { __proto__: null, '투수': 1, '포수': 2, '1루': 3, '2루': 4, '3루': 5, '유격': 6, '좌익': 7, '중견': 8, '우익': 9 };
// 경기설정 칸에 직접 친 수비 위치(4글자까지) → 위 이름. 그림에만 쓰고 저장 값은 그대로 둔다 ('유격수' 처럼 끝의 '수' 는 posName 이 뗀다)
const ALIAS = { __proto__: null, '1': '투수', '2': '포수', '3': '1루', '4': '2루', '5': '3루', '6': '유격', '7': '좌익', '8': '중견', '9': '우익',
  P: '투수', C: '포수', '1B': '1루', '2B': '2루', '3B': '3루', SS: '유격', LF: '좌익', CF: '중견', RF: '우익', DH: 'DH',
  '투': '투수', '포': '포수', '유': '유격', '좌': '좌익', '중': '중견', '우': '우익', '지': 'DH', '지명': 'DH', '지명타자': 'DH' };
const posName = s => {
  const t = String(s).replace(/\s/g, ''), u = t.toUpperCase();
  return POSN[t] ? t : ALIAS[u] || (t.endsWith('수') && POSN[t.slice(0, -1)] ? t.slice(0, -1) : t);
};

// ── 그릴 내용 한 벌 ───────────────────────────────────────────
// g = { team: 'home' | 'away', home_lineup, away_lineup, th, ta, date, venue }
export function orderData(g) {
  const team = g.team === 'away' ? 'away' : 'home';
  const src = team === 'home' ? g.home_lineup : g.away_lineup;
  const lu = (Array.isArray(src) ? src : []).filter(p => p && p.name != null);
  const row = p => { const ps = p.pos ? posName(p.pos) : ''; return { name: String(p.name), num: p.num != null && p.num !== '' ? String(p.num) : '', pos: ps ? ps + (POSN[ps] ? ' (' + POSN[ps] + ')' : '') : '' }; };
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
//  · 머리(로고 · 제목 + 팀 칸 / 대회 · 경기일 · 구장) / 표 둘(주전 · 후보) / 발(위치 번호 · 서명 상자). 발은 아래 끝에 붙이고, 줄 높이를 늘려 표가 발까지 닿게 한다
//  · 상자 · 표 · 서명의 세로줄을 맞춘다: 왼쪽 끝 · 선수명 칸 왼쪽(= 팀 상자 왼쪽). 수비 위치는 번호 + 이름 (프로 오더지처럼 '6  유격' · 칸 안 세로선 없이)
//  · 글자는 인쇄에서 읽히게 12.5 이상 (이름표 12.5~13 · 값 16~20) · 영문 장식 이름표(LINEUP CARD 등)는 없다
//  · 리그 기록지(scoresheet.js)와 같은 틀: 선 굵기 셋(테두리 2 / 줄 1 / 칸 사이 가는 선 0.5), 안쪽 여백 12 · 사이 8 · 16, 숫자는 일의 자리를 세로로 맞춘다
//  · 색 · 글꼴은 imgkit.js 의 PAPER · FONT 만
const W = 794, H0 = 1123, SCALE = 2, X = 32, CW = W - X * 2, P = 12;
const COLS = [['타순', 56], ['수비 위치', 128], ['선수명', 0], ['등번호', 80], ['교체 · 비고', 216]];   // 0 = 나머지 폭 · 교체 · 비고는 손으로 적는 칸
const BOX = 56, TOP = 192, FOOT = 136, BAND = 30, HEAD = 28, GAP = 16, PN = 36;   // PN: 수비 위치 안 번호 자리 폭
const HEAVY = [2, PAPER.ink], ROW = [1, PAPER.rule], HAIR = [0.5, PAPER.rule];   // 선 굵기 셋 [굵기, 색]
const snap = v => Math.round(v * 2) / 2;   // 2배 PNG 에서 선이 두 픽셀에 번지지 않게

export function drawOrder(cv, d) {
  const n = d.starters.length + d.bench.length, fixed = (BAND + HEAD) * 2 + GAP;
  const rh = Math.max(26, (H0 - TOP - FOOT - fixed) / n);
  const H = Math.max(H0, Math.ceil(TOP + FOOT + fixed + n * rh));
  cv.width = W * SCALE; cv.height = H * SCALE;
  const c = cv.getContext('2d');
  c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  c.textBaseline = 'alphabetic';
  c.fillStyle = PAPER.bg; c.fillRect(0, 0, W, H);
  const text = (t, x, y, col, al) => { c.fillStyle = col; c.textAlign = al || 'left'; c.fillText(t, x, y); };
  const num = (v, cx, y, col) => text(String(v), cx + c.measureText('0').width / 2, y, col, 'right');   // 일의 자리를 cx 에 (한 자리 · 두 자리가 같은 세로줄)
  const hl = (x1, x2, y, k) => { c.fillStyle = k[1]; c.fillRect(x1, snap(y) - (k[0] < 1 ? 0 : k[0] / 2), x2 - x1, k[0]); };
  const vl = (x, y1, y2, k) => { c.fillStyle = k[1]; c.fillRect(snap(x) - (k[0] < 1 ? 0 : k[0] / 2), y1, k[0], y2 - y1); };
  // 칸 상자: 위에 작은 이름(조용히), 아래에 값 (값이 없으면 손으로 적는 빈칸)
  const field = (lbl, val, x, y, w, isNum) => {
    c.strokeStyle = ROW[1]; c.lineWidth = ROW[0]; rr(c, x + 0.5, y + 0.5, w - 1, BOX - 1, 6); c.stroke();
    font(c, '500', 12.5, FONT.kr); text(lbl, x + P, y + 20, PAPER.ink2);
    if (val) { fitFont(c, val, isNum ? '600' : '700', isNum ? 20 : 19, isNum ? FONT.num : FONT.kr, w - P * 2, 12); text(val, x + P, y + 45, PAPER.ink); }
  };
  const rest = CW - COLS.reduce((s, k) => s + k[1], 0), xs = [X];
  COLS.forEach((k, i) => xs.push(xs[i] + (k[1] || rest)));
  const mid = i => (xs[i] + xs[i + 1]) / 2;
  // 상자 세 칸: 왼쪽 끝 ~ 선수명 칸 앞 / 선수명 칸부터 반씩 — 머리 둘째 줄과 서명 줄이 같은 세로줄
  const half = (W - X - xs[2] - 8) / 2, grid3 = [[X, xs[2] - X - 8], [xs[2], half], [xs[2] + half + 8, half]];

  // 머리: 로고 · 문서 이름 / 제목(오더지 + 홈·원정) · 팀 · 상대 팀 / 대회 · 경기일 · 구장
  wordmark(c, X, 40, 14, PAPER.ink, PAPER.acc);
  font(c, '900', 34, FONT.kr); text('오더지', X - 1, 98, PAPER.ink);
  text(d.side, X + c.measureText('오더지').width + 8, 98, PAPER.ink3);
  field('팀 (' + d.side + ')', d.name, grid3[1][0], 56, half);
  field('상대 팀', d.opp, grid3[2][0], 56, half);
  [['대회', ''], ['경기일', d.date, 1], ['구장', d.venue]].forEach((f, i) => field(f[0], f[1], grid3[i][0], 120, grid3[i][1], f[2]));

  // 표: 어두운 띠 · 옅은 머리 줄 · 선수 줄(한 줄 걸러 옅은 바탕) — 타순 번호는 주전 표만
  const table = (y0, title, rows, numbered) => {
    const R0 = y0 + BAND + HEAD, ry = i => snap(R0 + i * rh), y1 = ry(rows.length);
    c.save(); rr(c, X, y0, CW, y1 - y0, 6); c.clip();
    c.fillStyle = PAPER.band; c.fillRect(X, y0, CW, BAND);
    c.fillStyle = PAPER.fill; c.fillRect(X, y0 + BAND, CW, HEAD);
    c.fillStyle = PAPER.zebra;
    rows.forEach((r, i) => { if (i % 2) c.fillRect(X, ry(i), CW, ry(i + 1) - ry(i)); });
    c.restore();
    font(c, '700', 16, FONT.kr); text(title, X + P, y0 + 20.5, PAPER.bg);
    if (numbered && !rows.some(r => r.name)) {   // 상태를 알리는 알약 — 라인업이 비었다 (기록지의 '타석 기록 없음'과 같은 모양)
      const note = '라인업 없음 · 빈 줄은 손으로', px = X + P + c.measureText(title).width + 8;
      font(c, '700', 12.5, FONT.kr); const pw = c.measureText(note).width + 20;
      c.fillStyle = PAPER.ink2; rr(c, px, y0 + 5, pw, 20, 10); c.fill();
      text(note, px + pw / 2, y0 + 19.5, PAPER.bg, 'center');
    }
    // 머리 줄 (이름표는 작고 옅게): 숫자 칸은 가운데, 글자 칸은 왼쪽 여백 12
    const hy = y0 + BAND + 19;
    font(c, '500', 13, FONT.kr);
    text('타순', mid(0), hy, PAPER.ink2, 'center'); text('등번호', mid(3), hy, PAPER.ink2, 'center');
    [1, 2, 4].forEach(i => text(COLS[i][0], xs[i] + P, hy, PAPER.ink2));
    rows.forEach((r, i) => {
      const cy = R0 + i * rh + rh / 2 + 7;
      if (i) hl(X, W - X, R0 + i * rh, ROW);
      if (numbered) { font(c, '600', 21, FONT.num); num(i + 1, mid(0), cy + 1, PAPER.ink); }
      const m = /^(.*) \((\d)\)$/.exec(r.pos), ps = m ? m[1] : r.pos;   // '유격 (6)' → 번호 칸 6 · 이름 유격 ('DH' 는 이름만)
      if (m) { font(c, '600', 20, FONT.num); num(m[2], xs[1] + PN / 2, cy + 1, PAPER.ink); }
      if (ps) { fitFont(c, ps, '700', 17, FONT.kr, xs[2] - xs[1] - PN - P, 11); text(ps, xs[1] + PN + 4, cy, PAPER.ink); }
      if (r.name) { fitFont(c, r.name, '700', 21, FONT.kr, xs[3] - xs[2] - P * 2, 12); text(r.name, xs[2] + P, cy, PAPER.ink); }
      if (r.num) { fitFont(c, r.num, '600', 21, FONT.num, xs[4] - xs[3] - P * 2, 12); num(r.num, mid(3), cy + 1, PAPER.ink); }
    });
    hl(X, W - X, R0, ROW);
    for (let i = 1; i < COLS.length; i++) vl(xs[i], y0 + BAND, y1, HAIR);
    c.strokeStyle = HEAVY[1]; c.lineWidth = HEAVY[0]; rr(c, X, y0, CW, y1 - y0, 6); c.stroke();
    return y1;
  };
  const y = table(TOP, '선발 타순', d.starters, true);
  table(y + GAP, '후보 선수', d.bench, false);

  // 발 (아래 끝): 수비 위치 번호 · 서명 상자
  const SY = H - 32 - BOX, LY = SY - 18;
  font(c, '500', 12.5, FONT.kr); text('수비 위치 번호', X, LY, PAPER.ink2);
  let lx = X + c.measureText('수비 위치 번호').width + P;
  ['투수', '포수', '1루', '2루', '3루', '유격', '좌익', '중견', '우익'].forEach((s, i) => {
    font(c, '600', 14, FONT.num); text(String(i + 1), lx, LY, PAPER.ink); lx += c.measureText(String(i + 1)).width + 3;
    font(c, '500', 12.5, FONT.kr); text(s, lx, LY, PAPER.ink2); lx += c.measureText(s).width + 11;
  });
  font(c, '500', 12.5, FONT.kr); text('빈칸은 손으로 적어 주세요', W - X, LY, PAPER.ink3, 'right');
  ['감독', '주장', '기록원 확인'].forEach((s, i) => {
    const [x, w] = grid3[i];
    field(s, '', x, SY, w);
    font(c, '500', 12.5, FONT.kr); text('(서명)', x + w - P, SY + BOX - 11, PAPER.ink3, 'right');
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
  // Esc 는 문서에서 받는다 — 미리보기 이미지를 누르면 포커스가 창 밖(body)으로 빠진다 (scoresheet.js 와 같음)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('osView').hidden) closeOrderSheet(); });
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

async function _render() {
  const seq = ++_seq, A = window.AS || {}, info = A.info || {};
  $('osSave').disabled = $('osPrint').disabled = true;
  $('osTeam').querySelectorAll('button').forEach(b => { const on = b.dataset.team === _team; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  const d = orderData({
    team: _team, home_lineup: A.home_lineup, away_lineup: A.away_lineup,
    th: ($('tHome') || {}).value, ta: ($('tAway') || {}).value, date: _date(info), venue: typeof info.venue === 'string' ? info.venue : '',
  });
  const cv = document.createElement('canvas');
  await drawWithFonts(cv, () => drawOrder(cv, d));   // 그린 글자의 웹폰트 묶음을 받은 뒤 다시 그린다 ('팀' 만 기본 글꼴로 찍히던 문제)
  if (seq !== _seq) return;
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
