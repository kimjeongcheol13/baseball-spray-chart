// 종이 스코어북(기록지) 테마 — 공통 셸 + 기록 탭 화면
//   입력·저장·계산은 core.js / record.js / shell.js 그대로 두고, 그 함수만 불러 쓴다 (데이터 구조·저장 좌표 변경 없음).
//   · 헤더 띠: SPRAYLAB + 라인스코어(TEAM | 1~9 | R H E) + 이닝 ◀ ▶ (#innSel 값 그대로)
//       이닝별 득점·실책은 저장하지 않으므로 이닝 칸은 비워 두고 R = 현재 스코어, H = 기록된 안타, E = '–'
//   · 왼쪽 타순표: 행을 누르면 현재 타자(shellSelectBatter) · NOW BATTING · [라인업 편집] = 기존 라인업 서랍
//   · 가운데 필드: 기존 캔버스 3겹과 기하(_fieldGeo·_fieldPx) 그대로, 그리는 색·기호만 바꿈
//       (PNG 내보내기·분석 탭 복사본이 같은 캔버스를 읽으므로 캔버스에 그려야 결과가 같다)
//   · 오른쪽: 볼카운트(chCount) → 기록 도장 K/BB/HBP(recQuick) → 보조 버튼(recOther) → 타석 기록 + 지우개(undoLast)
import { HITS, esc } from '../constants.js';

const $ = id => document.getElementById(id);

// ── 결과 → 약어 · 기호 ───────────────────────────────────────
const ABBR = {
  '안타': '1B', '내야안타': 'IH', '2루타': '2B', '3루타': '3B', '홈런': 'HR',
  '땅볼 아웃': 'G', '플라이 아웃': 'F', '삼진': 'K', '볼넷': 'BB', '사구': 'HBP',
  '희타': 'SH', '희비': 'SF', '병살': 'GDP',
};
const KIND = { '안타': 'hit', '내야안타': 'hit', '2루타': 'xbh', '3루타': 'xbh', '홈런': 'hr', '삼진': 'k', '볼넷': 'bb', '사구': 'hbp' };
const DIR = { LF: '좌익', LC: '좌중간', CF: '중견', RC: '우중간', RF: '우익' };
const kindOf = res => KIND[res] || 'out';
// 방향은 필드를 탭한 타구만 (내야안타 버튼은 방향 없이 중견 기본값이 들어가므로 표시하지 않음)
const abbrOf = a => {
  const s = ABBR[a.res] || a.res || '';
  return a.dir && a.x != null && a.res !== '내야안타' ? `${s}·${DIR[a.dir] || a.dir}` : s;
};

// 범례·타순표용 기호 (필드 캔버스와 같은 모양)
function markSvg(kind, size = 16) {
  const o = `<svg class="sb-mk" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true" focusable="false">`;
  const t = (txt, fs, col, fam = 'Oswald') => `${o}<text x="10" y="${10 + fs * 0.36}" text-anchor="middle" style="font:${fam === 'Oswald' ? 700 : 400} ${fs}px '${fam}',sans-serif;fill:var(${col})">${txt}</text></svg>`;
  switch (kind) {
    case 'hit': return `${o}<circle cx="10" cy="10" r="6.5" style="fill:var(--pen-red);stroke:var(--ink);stroke-width:2"/></svg>`;
    case 'xbh': return `${o}<rect x="5.2" y="5.2" width="9.6" height="9.6" transform="rotate(45 10 10)" style="fill:var(--highlight);stroke:var(--ink);stroke-width:2"/></svg>`;
    case 'hr': return `${o}<circle cx="10" cy="10" r="7.6" style="fill:none;stroke:var(--pen-red);stroke-width:2.4"/><circle cx="10" cy="10" r="3.6" style="fill:var(--pen-red)"/></svg>`;
    case 'k': return t('K', 17, '--pen-red', 'Black Han Sans');
    case 'bb': return '<span class="sb-mk-t bb" aria-hidden="true">BB</span>';
    case 'hbp': return '<span class="sb-mk-t hbp" aria-hidden="true">HBP</span>';
    default: return `${o}<path d="M5 5L15 15M15 5L5 15" style="fill:none;stroke:var(--ink);stroke-width:3.2;stroke-linecap:round"/></svg>`;
  }
}

const ICON = {
  prev: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M9 1.5L3 6l6 4.5z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M3 1.5L9 6l-6 4.5z" fill="currentColor"/></svg>',
  eraser: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16.5 3.5l4 4L10 18H6l-2.5-2.5z"/><path d="M11.5 8.5l4 4"/><path d="M10 18h10"/></svg>',
  down: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M1.5 3.5L6 8.5l4.5-5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

// ── 이모지 금지: 기존 문구(core 문자열·HTML)는 그대로 두고 화면에 나갈 때만 걸러냄 ──
const _EMO = /\p{Extended_Pictographic}\uFE0F?\s?|\uFE0F/gu;
const _noEmoji = t => String(t).replace(_EMO, '').replace(/^\s+/, '');
function _stripEmojiIn(root) {
  if (!root || !document.createTreeWalker) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hit = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { _EMO.lastIndex = 0; if (_EMO.test(n.nodeValue)) hit.push(n); }
  hit.forEach(n => { n.nodeValue = _noEmoji(n.nodeValue); });
}
function _cleanLegacy() {
  ['slMenu', 'lineupDrawer', 'recList'].forEach(id => _stripEmojiIn($(id)));
  // 라인업 서랍의 ✏️ 버튼 → 선 아이콘
  document.querySelectorAll('#lpList .p-edit').forEach(b => { if (!b.querySelector('svg')) b.innerHTML = ICON.pencil; });
}

// ── 상태 읽기 ────────────────────────────────────────────────
const _AS = () => window.AS || {};
const _gfOn = () => typeof GF !== 'undefined' && GF && GF.active;
const _lineup = () => { try { return (window.getActiveLineup && window.getActiveLineup()) || []; } catch (e) { return []; } };
const _val = (id, d) => { const el = $(id); const v = el ? String(el.value != null && el.tagName === 'INPUT' ? el.value : el.textContent).trim() : ''; return v || d; };
const _isBatter = (a, p) => String(a.bid) === String(p.id) || (!a.bid && a.bname === p.name);
function _inn() {
  const s = $('innSel');
  const v = s ? s.value : '';
  const m = /^(\d+)회(초|말)$/.exec(v);
  return m ? { n: +m[1], top: m[2] === '초', v, label: `${m[1]}회 ${m[2]}` } : { n: 0, top: true, v, label: v || '—' };
}

// ── 디자인 토큰 (캔버스용: 고대비 모드는 body 클래스로 변수만 바뀜) ──
let _T = null, _Tat = 0;
function tok(force) {
  if (!force && _T && performance.now() - _Tat < 1000) return _T;
  const cs = getComputedStyle(document.body);
  const g = (n, d) => cs.getPropertyValue(n).trim() || d;
  _T = {
    paper: g('--paper', '#F3EDDF'), paper2: g('--paper-2', '#FBF7EE'), ink: g('--ink', '#1F2A23'),
    grass: g('--grass', '#3E7A5B'), dirt: g('--dirt', '#D3A670'), mound: g('--mound', '#BF915C'),
    red: g('--pen-red', '#C8322B'), blue: g('--pen-blue', '#2C4F8A'), hl: g('--highlight', '#D9A441'),
  };
  _Tat = performance.now();
  return _T;
}

// ── 필드 캔버스: 종이 스코어북 색·선 (기하는 core _fieldGeo 그대로 → 구장별 펜스·저장 좌표 유지) ──
// 치수는 명세의 720 폭 기준 값을 캔버스 크기에 맞춰 환산 (u = 1 명세 px)
const _unit = S => S / 575;
function paperDrawField() {
  if (typeof fCtx === 'undefined' || !fCtx || typeof FS === 'undefined' || FS <= 0) return;
  const T = tok(true), ctx = fCtx, S = FS, u = _unit(S);
  const g = _fieldGeo(S), st = g.st, Q = _FQ, m = g.m, cx = g.cx, cy = g.cy;
  const P = (phi, r) => _conePt(g, phi, r), F = phi => _fenceR(g, phi);
  const fenceAt = (off, rev) => {
    for (let i = 0; i <= 72; i++) {
      const ph = rev ? 3 * Q - 2 * Q * i / 72 : Q + 2 * Q * i / 72, p = P(ph, F(ph) - off);
      ctx.lineTo(p[0], p[1]);
    }
  };
  const fair = () => { ctx.beginPath(); ctx.moveTo(cx, cy); fenceAt(0); ctx.closePath(); };
  const md = P(2 * Q, 18.44 * m), b = 27.43 * m, b1 = P(3 * Q, b), b2 = P(2 * Q, b * Math.SQRT2), b3 = P(Q, b);
  const w0 = P(Q, F(Q));

  ctx.save();
  ctx.clearRect(0, 0, S, S);
  // 파울 지역 = 카드 종이색 (PNG로 내보내도 같은 배경)
  ctx.fillStyle = T.paper2; ctx.fillRect(0, 0, S, S);
  // 페어 지역 잔디
  fair(); ctx.fillStyle = T.grass; ctx.fill();

  ctx.save(); fair(); ctx.clip();
  // 잔디 무늬: --paper 28px 호 3개, 투명도 .10
  ctx.globalAlpha = 0.10; ctx.strokeStyle = T.paper; ctx.lineWidth = 28 * u;
  [0.42, 0.6, 0.78].forEach(k => { ctx.beginPath(); ctx.arc(cx, cy, g.R * k, Math.PI, 2 * Math.PI); ctx.stroke(); });
  ctx.globalAlpha = 1;
  // 내야 흙 (마운드 중심 29m) → 내야 잔디 → 베이스라인 흙 20px → 홈 주변 흙
  ctx.beginPath(); ctx.arc(md[0], md[1], 29 * m, 0, Math.PI * 2); ctx.fillStyle = T.dirt; ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(b3[0], b3[1]); ctx.closePath();
  ctx.fillStyle = T.grass; ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = 20 * u; ctx.strokeStyle = T.dirt; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 4.5 * m, 0, Math.PI * 2); ctx.fillStyle = T.dirt; ctx.fill();
  ctx.restore();

  // 워닝트랙 16px
  ctx.beginPath(); ctx.moveTo(w0[0], w0[1]); fenceAt(0); fenceAt(16 * u, true); ctx.closePath();
  ctx.fillStyle = T.dirt; ctx.fill();
  // 마운드 + 투수판
  ctx.beginPath(); ctx.arc(md[0], md[1], Math.max(2.9 * m, 8 * u), 0, Math.PI * 2); ctx.fillStyle = T.mound; ctx.fill();
  ctx.fillStyle = T.paper; ctx.fillRect(md[0] - 3.5 * u, md[1] - 1 * u, 7 * u, 2 * u);
  // 파울라인 --paper 3px
  const lp = P(Q, F(Q)), rp = P(3 * Q, F(3 * Q));
  ctx.strokeStyle = T.paper; ctx.lineWidth = Math.max(1.5, 3 * u); ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(lp[0], lp[1]); ctx.lineTo(cx, cy); ctx.lineTo(rp[0], rp[1]); ctx.stroke();
  // 펜스 --ink 3px
  ctx.beginPath(); ctx.moveTo(w0[0], w0[1]); fenceAt(0);
  ctx.strokeStyle = T.ink; ctx.lineWidth = Math.max(2, 3 * u); ctx.lineJoin = 'round'; ctx.stroke();
  // 베이스: --paper 12×12 45° + --ink 1.2px
  const bs = Math.max(7, 12 * u), blw = Math.max(1, 1.2 * u);
  [b1, b2, b3].forEach(p => {
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = T.paper; ctx.fillRect(-bs / 2, -bs / 2, bs, bs);
    ctx.lineWidth = blw; ctx.strokeStyle = T.ink; ctx.strokeRect(-bs / 2, -bs / 2, bs, bs);
    ctx.restore();
  });
  // 홈 플레이트
  const h = bs * 0.5;
  ctx.beginPath(); ctx.moveTo(cx, cy + h); ctx.lineTo(cx + h, cy); ctx.lineTo(cx + h, cy - h); ctx.lineTo(cx - h, cy - h); ctx.lineTo(cx - h, cy); ctx.closePath();
  ctx.fillStyle = T.paper; ctx.fill(); ctx.lineWidth = blw; ctx.strokeStyle = T.ink; ctx.stroke();

  // 거리 라벨 (Oswald 15px) — 잔디 위 대비 4.5:1 이상이 되도록 --paper-2
  const fz = Math.max(11, Math.round(15 * u));
  ctx.font = `600 ${fz}px Oswald, 'Noto Sans KR', sans-serif`;
  ctx.fillStyle = T.paper2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = '1px'; } catch (e) {}
  const lt = P(Q + 0.1, F(Q + 0.1) * 0.84), ct = P(2 * Q, F(2 * Q) * 0.86), rt = P(3 * Q - 0.1, F(3 * Q - 0.1) * 0.84);
  ctx.fillText(st.lfDist + 'm', lt[0], lt[1]); ctx.fillText(st.cfDist + 'm', ct[0], ct[1]); ctx.fillText(st.rfDist + 'm', rt[0], rt[1]);
  try { ctx.letterSpacing = '0px'; } catch (e) {}

  // 보기 옵션 (기존 sl_field_overlays): 방향 레이블 · 거리 링
  const ov = typeof _fieldOv !== 'undefined' ? _fieldOv : {};
  if (ov.dir) {
    ctx.font = `700 ${Math.max(11, Math.round(13 * u))}px 'Gowun Batang', 'Nanum Myeongjo', serif`;
    ctx.fillStyle = T.paper2;
    [[27, '당겨치기'], [90, '센터'], [153, '밀어치기']].forEach(([deg, txt]) => { const ph = _degToPhi(deg), p = P(ph, F(ph) * 0.6); ctx.fillText(txt, p[0], p[1]); });
  }
  if (ov.arcs) {
    ctx.save(); fair(); ctx.clip();
    ctx.setLineDash([6 * u, 6 * u]); ctx.strokeStyle = T.paper; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.font = `500 ${Math.max(10, Math.round(12 * u))}px Oswald, sans-serif`; ctx.fillStyle = T.paper2; ctx.textAlign = 'left';
    [0.41, 0.66, 0.82].map(k => Math.round(st.cfDist * k)).forEach(mm => {
      const r = mm * m; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI); ctx.stroke();
      const tp = P(2 * Q - 0.18, r); ctx.globalAlpha = 1; ctx.fillText(mm + 'm', tp[0] + 3, tp[1] - 3); ctx.globalAlpha = 0.55;
    });
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// 타구 기호 (캔버스) — ● 안타 / ◆ 장타 / ◎ 홈런 / ✕ 아웃
function drawMark(ctx, kind, x, y, R, T) {
  const k = R / 9;   // 명세 선 두께는 r9 기준
  ctx.save();
  if (kind === 'hit') {
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = T.red; ctx.fill(); ctx.lineWidth = Math.max(1.2, 2 * k); ctx.strokeStyle = T.ink; ctx.stroke();
  } else if (kind === 'xbh') {
    const s = R * 1.6;
    ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = T.hl; ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.lineWidth = Math.max(1.2, 2 * k); ctx.strokeStyle = T.ink; ctx.strokeRect(-s / 2, -s / 2, s, s);
  } else if (kind === 'hr') {
    ctx.beginPath(); ctx.arc(x, y, R * 1.05, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.5, 2.4 * k); ctx.strokeStyle = T.red; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, 5 * k), 0, Math.PI * 2); ctx.fillStyle = T.red; ctx.fill();
  } else {
    // ✕: 잉크(#1F2A23)와 잔디(#3E7A5B) 대비가 3:1에 못 미쳐 종이색 테두리를 한 겹 깔아 줌
    const d = R * 0.72;
    const x2 = () => { ctx.beginPath(); ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d); ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d); };
    ctx.lineCap = 'round';
    x2(); ctx.lineWidth = Math.max(2, 3.2 * k) + 2.4; ctx.strokeStyle = T.paper2; ctx.globalAlpha = 0.75; ctx.stroke();
    ctx.globalAlpha = 1;
    x2(); ctx.lineWidth = Math.max(2, 3.2 * k); ctx.strokeStyle = T.ink; ctx.stroke();
  }
  ctx.restore();
}
const _markR = () => Math.max(5, Math.min(9, 9 * _unit(FS)));

// core drawDot 대체: 필터 조건(filter.js _sfPass)과 '가장 최근 기록' 표시(shell.js)는 같게 유지
function paperDot(r) {
  if (!r || !r.x || typeof hCtx === 'undefined' || !hCtx) return;
  if (window._sfPass && !window._sfPass(r)) return;
  const [x, y] = _fieldPx(r), T = tok(), R = _markR();
  drawMark(hCtx, kindOf(r.res), x, y, R, T);
  const abs = _AS().abs || [];
  if (r === abs[abs.length - 1]) {
    hCtx.save();
    hCtx.beginPath(); hCtx.arc(x, y, R + 5, 0, Math.PI * 2);
    hCtx.lineWidth = 2.5; hCtx.strokeStyle = T.hl; hCtx.stroke();
    hCtx.restore();
  }
}

// 기록 직후 미니 스프레이 (core _drawMiniSpray 대체, 같은 기하)
function paperMiniSpray(canvas, abs) {
  if (!canvas) return;
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 130, dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!abs || !abs.length) return;
  const T = tok(), g = _fieldGeo(w, h);
  ctx.beginPath(); ctx.moveTo(g.cx, g.cy);
  for (let i = 0; i <= 40; i++) { const ph = _FQ + 2 * _FQ * i / 40, p = _conePt(g, ph, _fenceR(g, ph)); ctx.lineTo(p[0], p[1]); }
  ctx.closePath();
  ctx.fillStyle = T.grass; ctx.fill(); ctx.strokeStyle = T.ink; ctx.lineWidth = 1.5; ctx.stroke();
  abs.forEach(a => {
    if (a.x == null || a.y == null) return;
    const q = _semiToCone(g, a.x, a.y);
    drawMark(ctx, kindOf(a.res), q[0], q[1], 3.4, T);
  });
}

// ── 헤더 띠 ─────────────────────────────────────────────────
const _brand = sub => `<div class="sb-brand"><b>SPRAYLAB</b><small>${sub}</small></div>`;

function _lsHtml() {
  const AS = _AS(), cur = _inn();
  const th = _val('tHome', '내 팀'), ta = _val('tAway', '원정팀');
  const hits = t => (AS.abs || []).filter(a => (a.team || 'home') === t && HITS.includes(a.res)).length;
  const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const head = `<tr><th scope="col" class="t">TEAM</th>${cols.map(n => `<th scope="col"${cur.n === n ? ' class="cur"' : ''}>${n}</th>`).join('')}<th scope="col" class="r">R</th><th scope="col">H</th><th scope="col">E</th></tr>`;
  const row = (name, t, runs) => `<tr><th scope="row" class="t">${esc(name)}</th>${cols.map(n => `<td${cur.n === n ? ' class="cur"' : ''}></td>`).join('')}`
    + `<td class="r">${runs}</td><td>${hits(t)}</td><td class="e" aria-label="실책 기록 안 함">–</td></tr>`;
  // R 칸은 44px 터치 타겟이 안 나와서 점수 수정은 옆 버튼으로 (기존 스코어 수정 팝오버)
  return `<div class="sb-ls-wrap"><table class="sb-ls"><caption class="sb-sr">라인스코어 — 이닝별 득점은 기록하지 않아 비워 둡니다</caption>`
    + `<thead>${head}</thead><tbody>${row(th, 'home', AS.hs || 0)}${row(ta, 'away', AS.as || 0)}</tbody></table></div>`
    + `<button type="button" class="sb-score-btn" onclick="shellScore(true)" aria-label="스코어 수정">${ICON.pencil}<span>점수</span></button>`;
}

function _innHtml() {
  const cur = _inn();
  const big = cur.n ? `${cur.n}회` : esc(cur.v || '—');
  const small = cur.n ? (cur.top ? 'TOP·초' : 'BOT·말') : 'EXTRA';
  return `<div class="sb-inn" role="group" aria-label="이닝">
      <button type="button" class="sb-inn-b" onclick="recStepInning(-1)" aria-label="이전 이닝">${ICON.prev}</button>
      <div class="sb-inn-v" aria-live="polite"><b>${big}</b><small>${small}</small></div>
      <button type="button" class="sb-inn-b" onclick="recStepInning(1)" aria-label="다음 이닝">${ICON.next}</button>
    </div>`;
}

// ── 타순표 · NOW BATTING ─────────────────────────────────────
function _orderHtml() {
  const AS = _AS(), lu = _lineup(), cur = AS.batter;
  const team = AS.curTeam === 'away' ? 'away' : 'home';
  const th = _val('tHome', '내 팀'), ta = _val('tAway', '원정팀');
  const n = Math.max(9, lu.length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const p = lu[i];
    if (!p) {
      rows.push(`<li><button type="button" class="sb-ot-row empty" onclick="sbEditLineup()" aria-label="${i + 1}번 비어 있음 — 라인업 편집 열기"><span class="n">${i + 1}</span><span class="nm">이름</span><span class="ls"></span><span class="mk"></span></button></li>`);
      continue;
    }
    const abs = (AS.abs || []).filter(a => _isBatter(a, p));
    const last = abs[abs.length - 1];
    const on = !!cur && String(cur.id) === String(p.id);
    const lastTxt = last ? abbrOf(last) : '';
    rows.push(`<li><button type="button" class="sb-ot-row${on ? ' cur' : ''}"${on ? ' aria-current="true"' : ''} onclick="sbPickBatter('${esc(String(p.id))}')"`
      + ` aria-label="${i + 1}번 ${esc(p.name)}${lastTxt ? ', 마지막 ' + esc(lastTxt) : ''}${on ? ', 현재 타자' : ''}">`
      + `<span class="n"><i>${i + 1}</i></span><span class="nm">${esc(p.name)}${p.pos ? `<small>${esc(p.pos)}</small>` : ''}</span>`
      + `<span class="ls">${esc(lastTxt)}</span><span class="mk">${abs.map(a => markSvg(kindOf(a.res), 14)).join('')}</span></button></li>`);
  }
  return `<header class="sb-card-hd"><h2>타순표</h2>
      <div class="sb-seg" role="group" aria-label="공격 중인 팀">
        <button type="button" aria-pressed="${team === 'home'}" onclick="sbTeam('home')">${esc(th)}</button>
        <button type="button" aria-pressed="${team === 'away'}" onclick="sbTeam('away')">${esc(ta)}</button>
      </div>
      <button type="button" class="sb-sheet-x" onclick="sbOrderSheet(false)" aria-label="타순표 닫기">${ICON.close}</button>
    </header>
    <div class="sb-ot-h" aria-hidden="true"><span>#</span><span>타자</span><span>결과</span><span>기록</span></div>
    <ol class="sb-ot">${rows.join('')}</ol>`;
}

function _nowInfo() {
  const AS = _AS(), b = AS.batter;
  if (!b) return null;
  const lu = _lineup();
  const i = lu.findIndex(p => String(p.id) === String(b.id));
  const pa = (AS.abs || []).filter(a => _isBatter(a, b)).length;
  return { name: b.name, order: i >= 0 ? i + 1 : null, pa: pa + 1 };
}

function _nowHtml() {
  const x = _nowInfo();
  return `<small class="sb-eyebrow">NOW BATTING</small>`
    + (x ? `<b class="sb-now-nm">${esc(x.name)}</b><span class="sb-now-meta">${x.order ? x.order + '번 · ' : ''}${x.pa}타석째</span>`
      : `<b class="sb-now-nm empty">타자 미선택</b><span class="sb-now-meta">타순표에서 타자 행을 누르세요</span>`)
    + `<button type="button" class="sb-btn" onclick="sbEditLineup()">라인업 편집</button>`;
}

function _nowBarHtml() {
  const x = _nowInfo();
  return `<small class="sb-eyebrow">NOW BATTING</small>`
    + (x ? `<b>${x.order ? x.order + '번 ' : ''}${esc(x.name)}</b><span>${x.pa}타석째</span>` : '<b class="empty">타자 미선택</b>')
    + `<em>타순표 ${ICON.down}</em>`;
}

// ── 필드 카드 하단: 범례 + 요약 ─────────────────────────────
function _fieldFtHtml() {
  const AS = _AS(), abs = AS.abs || [];
  const h = abs.filter(a => HITS.includes(a.res)).length;
  const lg = [['hit', '안타'], ['xbh', '장타'], ['hr', '홈런'], ['out', '아웃'], ['k', '삼진']];
  return `<ul class="sb-legend" aria-label="기호">${lg.map(([k, l]) => `<li>${markSvg(k, 16)}${l}</li>`).join('')}</ul>`
    + `<p class="sb-sum">${esc(_inn().label)} · ${abs.length}타석 · ${h}H</p>`;
}

// ── 오른쪽: 볼카운트 → 도장 → 보조 버튼 → 타석 기록 ────────
function _sideHtml() {
  const AS = _AS(), gf = _gfOn();
  const outs = gf ? (GF.outs || 0) : (AS.outs || 0);
  const dots = (n, max) => Array.from({ length: max }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('');
  const b = AS.balls || 0, s = AS.strikes || 0;
  const all = AS.abs || [];
  const list = all.slice(-12).reverse();
  return `
    <section class="sb-card sb-count" aria-label="볼카운트">
      <div class="sb-card-hd"><h2>COUNT</h2><button type="button" class="sb-mini" onclick="resetCount()">초기화</button></div>
      <div class="sb-cnt">
        <button type="button" class="sb-cg b" onclick="chCount('b')" aria-label="볼 ${b}, 누르면 +1"><span>B</span>${dots(b, 3)}</button>
        <button type="button" class="sb-cg s" onclick="chCount('s')" aria-label="스트라이크 ${s}, 누르면 +1"><span>S</span>${dots(s, 2)}</button>
        ${gf
          ? `<span class="sb-cg o ro" role="img" aria-label="아웃 ${outs} (경기 운영 모드가 자동으로 셈)"><span>O</span>${dots(outs, 2)}</span>`
          : `<button type="button" class="sb-cg o" onclick="chCount('o')" aria-label="아웃 ${outs}, 누르면 +1"><span>O</span>${dots(outs, 2)}</button>`}
      </div>
    </section>
    <section class="sb-stamps" role="group" aria-label="기록 도장 — 타구 없는 결과">
      <button type="button" class="sb-stamp k" onclick="recQuick('삼진')" aria-label="삼진 기록"><b>K</b><small>삼진</small></button>
      <button type="button" class="sb-stamp bb" onclick="recQuick('볼넷')" aria-label="볼넷 기록"><b>BB</b><small>볼넷</small></button>
      <button type="button" class="sb-stamp hbp" onclick="recQuick('사구')" aria-label="사구 기록"><b>HBP</b><small>사구</small></button>
    </section>
    <section class="sb-aux" role="group" aria-label="그 밖의 결과">
      ${[['희타', 'SH', '희생번트'], ['희비', 'SF', '희생플라이'], ['병살', 'GDP', '병살'], ['내야안타', 'IH', '내야안타']]
        .map(([r, a, l]) => `<button type="button" onclick="recOther('${r}')" aria-label="${l} 기록"><b>${a}</b><span>${l}</span></button>`).join('')}
    </section>
    <section class="sb-card sb-pa" aria-label="타석 기록">
      <div class="sb-card-hd"><h2>타석 기록</h2>
        <button type="button" class="sb-mini sb-eraser" onclick="undoLast()"${all.length ? '' : ' disabled'} aria-label="지우개 — 마지막 타석 되돌리기">${ICON.eraser}지우개</button>
        <button type="button" class="sb-mini" onclick="shellRecSheet(true)" aria-label="전체 ${all.length}타석 보기 · 수정">전체 ${all.length}</button>
      </div>
      ${list.length
        ? `<ol class="sb-pa-list">${list.map((a, k) => `<li><span class="no">${all.length - k}</span><span class="nm">${esc(a.bname || '')}</span><span class="rs k-${kindOf(a.res)}">${esc(abbrOf(a))}</span></li>`).join('')}</ol>`
        : '<p class="sb-none">아직 기록이 없습니다. 필드를 누르거나 도장을 찍어 첫 타석을 기록하세요.</p>'}
    </section>`;
}

// ── 그리기 (여러 번 불려도 프레임당 1번) ─────────────────────
let _raf = 0, _lsInn = null, _lsScroll = 0;
const _ZONES = '#sbHdrMid, #sbOrder, #sbNow, #sbSide';
function render() {
  _raf = 0;
  // 다시 그려도 키보드 포커스 유지 (같은 동작의 버튼으로 되돌림)
  const act = document.activeElement;
  const focusKey = act && act.closest && act.closest(_ZONES) ? act.getAttribute('onclick') : null;
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  const mid = $('sbHdrMid');
  if (mid) mid.innerHTML = _lsHtml() + _innHtml();
  set('sbOrder', _orderHtml());
  set('sbNow', _nowHtml());
  set('sbNowBar', _nowBarHtml());
  set('sbFieldFt', _fieldFtHtml());
  set('sbSide', _sideHtml());
  // 이닝이 바뀌면 현재 이닝 칸이 보이도록 (모바일 가로 스크롤 — 손으로 넘긴 위치는 이닝이 바뀔 때까지 유지)
  const w = document.querySelector('#sbHdrMid .sb-ls-wrap'), c = w && w.querySelector('th.cur'), iv = _inn().v;
  if (w && iv !== _lsInn) {
    _lsInn = iv;
    if (c && w.scrollWidth > w.clientWidth) w.scrollLeft = Math.max(0, c.offsetLeft - w.clientWidth / 2);
  } else if (w && _lsScroll) w.scrollLeft = _lsScroll;
  if (focusKey) {
    const el = Array.prototype.find.call(document.querySelectorAll(_ZONES.split(', ').map(z => z + ' [onclick]').join(', ')), e => e.getAttribute('onclick') === focusKey);
    if (el) try { el.focus({ preventScroll: true }); } catch (e) {}
  }
  _cleanLegacy();
}

function schedule() { if (!_raf) _raf = requestAnimationFrame(render); }

// ── 전역 핸들러 ──────────────────────────────────────────────
function sbPickBatter(id) {
  if (window.shellSelectBatter) window.shellSelectBatter(id);
  else if (window.selBatter) window.selBatter(id);
  sbOrderSheet(false);
  schedule();
}
function sbTeam(t) {
  if (window.swLineupTab) window.swLineupTab(t);
  schedule();
}
function sbEditLineup() {
  sbOrderSheet(false);
  if (window.shellDrawer) window.shellDrawer(true);
}
// 태블릿·모바일: 타순표 = 시트
function sbOrderSheet(open) {
  document.body.classList.toggle('sb-order-open', !!open);
  const bar = $('sbNowBar');
  if (bar) bar.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) { const c = document.querySelector('#sbOrder .sb-ot-row.cur'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }
}

// ── 마운트 ───────────────────────────────────────────────────
function _mountShell() {
  document.body.classList.add('sb');
  // 헤더: 브랜드 · 가운데(라인스코어 + 이닝) · ☰
  const hdr = document.querySelector('.app-hdr');
  if (hdr && !hdr.querySelector('.sb-brand')) {
    hdr.classList.add('sb-hdr');
    hdr.insertAdjacentHTML('afterbegin', _brand('OFFICIAL SCOREBOOK') + '<div class="sb-hdr-mid" id="sbHdrMid"></div>');
    const menu = $('slMenuBtn');
    if (menu) hdr.appendChild(menu);
  }
  // 분석 · 경기설정 뷰에도 같은 헤더 띠 (가운데 내용은 각 단계에서)
  [['analysisView', 'GAME ANALYSIS'], ['settingsView', 'GAME SETUP']].forEach(([id, sub]) => {
    const v = $(id);
    if (v && !v.querySelector('.sb-vhdr')) v.insertAdjacentHTML('afterbegin', `<header class="sb-hdr sb-vhdr">${_brand(sub)}<div class="sb-hdr-mid"></div></header>`);
  });
  // 하단 바인더 탭: 오른쪽 끝 태그라인
  const nav = $('savantNav');
  if (nav && !nav.querySelector('.sb-tagline')) nav.insertAdjacentHTML('beforeend', '<span class="sb-tagline" aria-hidden="true">YOUR SWING, VISUALIZED</span>');
}

function _mountRecord() {
  const al = document.querySelector('.app-layout');
  const lp = document.querySelector('.pnl-left');
  const center = document.querySelector('.pnl-center');
  const fw = center && center.querySelector('.field-wrap');
  if (!al || !lp || !center || !fw || $('sbField')) return;

  // 왼쪽: 타순표 + NOW BATTING (태블릿·모바일에서는 시트)
  lp.insertAdjacentHTML('beforeend', '<section class="sb-card sb-order" id="sbOrder" aria-label="타순표"></section><section class="sb-card sb-now" id="sbNow" aria-label="현재 타자"></section>');
  document.body.insertAdjacentHTML('beforeend', '<div class="sb-order-bd" id="sbOrderBd" onclick="sbOrderSheet(false)"></div>');

  // 가운데: 필드 카드 (field-wrap · 퀵버튼 대기 안내 · 미니 스프레이 · 범례)
  const card = document.createElement('section');
  card.id = 'sbField';
  card.className = 'sb-card sb-field';
  card.setAttribute('aria-label', '타구 기록 필드');
  fw.before(card);
  card.appendChild(fw);
  const mini = $('miniSprayWrap');
  if (mini) card.appendChild(mini);
  const hint = center.querySelector('.field-hint');
  if (hint) card.appendChild(hint);
  card.insertAdjacentHTML('beforeend', '<footer class="sb-field-ft" id="sbFieldFt"></footer>');
  card.insertAdjacentHTML('beforebegin', '<button type="button" class="sb-nowbar" id="sbNowBar" onclick="sbOrderSheet(true)" aria-haspopup="dialog" aria-controls="sbOrder" aria-expanded="false"></button>');

  // 오른쪽: 입력 열
  al.insertAdjacentHTML('beforeend', '<aside class="sb-side" id="sbSide" aria-label="기록 입력"></aside>');
}

function _hook() {
  // 기록·되돌리기(updateAll) · 카운트(renderCount) · 타자 선택(renderLP) · 스코어(chSc) · 경기 운영(gfUpdateBar·gfSyncInnSel) 뒤에 다시 그림
  ['updateAll', 'renderCount', 'renderLP', 'chSc', 'gfUpdateBar', 'gfSyncInnSel'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function' || orig._sb) return;
    const w = function () { const r = orig.apply(this, arguments); schedule(); return r; };
    w._sb = true;
    window[fn] = w;
  });
  // 그리기 3종 교체 (기하·좌표 계산 함수는 core 그대로 호출)
  paperDrawField._sb = paperDot._sb = paperMiniSpray._sb = true;
  window.drawField = paperDrawField;
  window.drawDot = paperDot;
  window._drawMiniSpray = paperMiniSpray;

  // 기록 직후 필드를 2.5초 접고 미니 스프레이를 띄우던 효과(데스크톱): 새 배치에선 필드 카드가 비어 보여서 끔
  // (모바일은 record.js가 이미 끔) — 방금 기록은 필드의 형광펜 링과 오른쪽 타석 기록에서 바로 보인다
  const mini = window._showMiniSprayAfterRecord;
  if (typeof mini === 'function' && !mini._sb) {
    const w = function () {};
    w._sb = true;
    window._showMiniSprayAfterRecord = w;
  }
  // 토스트 문구의 이모지 제거 (인자는 그대로 넘김)
  const toast = window.showToast;
  if (typeof toast === 'function' && !toast._sb) {
    const w = function (msg) { const a = Array.prototype.slice.call(arguments); if (typeof msg === 'string') a[0] = _noEmoji(msg); return toast.apply(this, a); };
    w._sb = true;
    window.showToast = w;
  }
  // 고대비: body 클래스만 바뀌므로 캔버스 색 다시 읽고 다시 그림
  const hc = window.toggleHighContrast;
  if (typeof hc === 'function' && !hc._sb) {
    const w = function () { const r = hc.apply(this, arguments); tok(true); _redraw(); _cleanLegacy(); return r; };
    w._sb = true;
    window.toggleHighContrast = w;
  }

  // 모바일: 필드부터 기록 도장까지 한 화면에 들어오도록 필드 크기 계산 (보조 버튼·타석 기록은 스크롤)
  //   필드 아래 요소들(범례·즉시 지표 줄·볼카운트·도장)의 실제 높이 = 도장 아래 끝 − 필드 영역 아래 끝
  const origFS = window._fieldFS;
  if (typeof origFS === 'function' && !origFS._sb) {
    const f = function (w) {
      if (window.innerWidth > 720) return origFS.apply(this, arguments);
      const p = w.parentElement || w, sc = document.querySelector('.app-layout');
      const pr = p.getBoundingClientRect(), top = pr.top + (sc ? sc.scrollTop : 0);
      const stamps = document.querySelector('#sbSide .sb-stamps');
      const below = stamps ? stamps.getBoundingClientRect().bottom - pr.bottom : 260;
      const nav = $('savantNav'), navH = nav ? nav.getBoundingClientRect().height : 54;
      const pw = p.clientWidth || (window.innerWidth - 40);
      const fs = Math.floor(Math.max(240, Math.min(pw, window.innerHeight - navH - 8 - top - below)));
      w.style.setProperty('width', fs + 'px', 'important');
      w.style.setProperty('height', fs + 'px', 'important');
      w.style.maxWidth = w.style.maxHeight = 'none';
      return fs;
    };
    f._sb = true;
    window._fieldFS = f;
  }

  // 모바일: 필드 위·아래 요소(헤더 · 경기 운영 바 · 타자 바 · 범례 · 지표 줄) 높이가 바뀌면 필드 크기 다시 계산
  // (core는 창 크기가 바뀔 때만 잰다 — 경기 운영을 켜면 운영 바만큼 도장이 화면 밖으로 밀렸다)
  if (window.ResizeObserver) {
    let t = 0;
    const seen = new WeakMap();
    const ro = new ResizeObserver(entries => {
      let changed = false;
      entries.forEach(e => { const h = Math.round(e.contentRect.height); if (seen.get(e.target) !== h) { seen.set(e.target, h); changed = true; } });
      if (!changed || window.innerWidth > 720) return;
      clearTimeout(t);
      t = setTimeout(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 80);
    });
    ['.app-hdr', '#gfBar', '#sbNowBar', '#sbFieldFt', '#liveStatLine'].forEach(sel => { const el = document.querySelector(sel); if (el) ro.observe(el); });
  }

  // 이닝 선택 · 팀 이름 · 스코어 직접 입력
  const inn = $('innSel');
  if (inn) inn.addEventListener('change', schedule);
  ['tHome', 'tAway'].forEach(id => { const el = $(id); if (el) el.addEventListener('input', schedule); });
  ['scH', 'scA'].forEach(id => { const el = $(id); if (el && window.MutationObserver) new MutationObserver(schedule).observe(el, { childList: true, characterData: true, subtree: true }); });

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('sb-order-open')) sbOrderSheet(false); });
}

function _redraw() {
  try { if (window.drawField) window.drawField(); if (window.safeRender) window.safeRender(); } catch (e) {}
}

function _init() {
  document.addEventListener('scroll', e => { if (e.target && e.target.classList && e.target.classList.contains('sb-ls-wrap')) _lsScroll = e.target.scrollLeft; }, true);
  _mountShell();
  _mountRecord();
  _hook();
  render();
  // 새 배치 기준으로 필드 크기 다시 계산 + 웹폰트(Oswald) 로드 뒤 거리 라벨 다시 그림
  requestAnimationFrame(() => { try { window.dispatchEvent(new Event('resize')); } catch (e) {} _redraw(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { tok(true); _redraw(); schedule(); });
}

if (typeof window !== 'undefined') {
  window.sbPickBatter = sbPickBatter;
  window.sbTeam = sbTeam;
  window.sbOrderSheet = sbOrderSheet;
  window.sbEditLineup = sbEditLineup;
  window.sbRender = schedule;
  // record.js(setTimeout 0)가 필드 주변을 먼저 재배치한 뒤에 마운트
  const start = () => setTimeout(_init, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
