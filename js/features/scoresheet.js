// 리그 제출용 기록지 — 이번 경기를 A4 세로 한 장으로: 이닝별 점수(R H E) · 양 팀 타순 × 이닝 칸 · 선수별 합계 · 기록원 서명 칸
//  · 읽기만 한다 (AS.abs · 라인업 · AS.info · runners.js 의 득점 slLineScore · slRunnerStats · core.js _cardStats) — 저장 구조 · 키 변경 없음
//  · 칸 = 중계 문자 약어 (좌안 · 중2 · 우홈 · 중비 · 땅볼 · 삼진 · 4구 …). 방향은 필드를 탭한 타구만. 아웃 수비수(6-3)는 아직 기록하지 않는다
//  · 타순 = 지금 주전 순서, 자리마다 교체 기록(runEv SUB)을 거슬러 처음 선수부터. 라인업에 없는 타자는 맨 아래 (첫 타석 순)
//  · 득점 · 도루는 경기 운영 모드로 적은 경기만 (그 밖의 경기는 빈칸 — 0 으로 적지 않는다). E = 상대 타자가 실책으로 나간 수
//  · 이미지 저장 = core.js _downloadCanvas · 인쇄 / PDF = 이 그림 한 장만 (body.ss-printing · css/report.css)
//  · 창은 선수 리포트(.rp) 모양을 그대로 쓴다. 진입: ☰ 메뉴 · 그 밖의 기능(setup.js) · 경기 종료 카드(gfShowEndCard 를 감싸 버튼 추가)
import { HITS } from '../constants.js';

const $ = id => document.getElementById(id);
const teamOf = a => (a && a.team === 'away' ? 'away' : 'home');
const pk = p => (p && p.id != null ? 'i' + p.id : 'n' + (p && p.name));
const ak = a => (a.bid != null ? 'i' + a.bid : 'n' + a.bname);
const innOf = a => parseInt(a && a.inn, 10);

// ── 타석 → 칸 글자 ───────────────────────────────────────────
const ZONE = { __proto__: null, LF: '좌', LC: '좌중', CF: '중', RC: '우중', RF: '우' };
const FIX = { __proto__: null, '내야안타': '내야안', '땅볼 아웃': '땅볼', '삼진': '삼진', '볼넷': '4구', '사구': '사구', '희타': '희번', '희비': '희플', '병살': '병살', '실책': '실책', '야수선택': '야선' };
const ZONED = { __proto__: null, '안타': ['안', '안타'], '2루타': ['2', '2루타'], '3루타': ['3', '3루타'], '홈런': ['홈', '홈런'], '플라이 아웃': ['비', '뜬공'] };

// 내야안타는 버튼으로 적으면 방향 없이 중견 기본값이 들어가므로 FIX 가 먼저
export function cellCode(a) {
  const r = a && a.res;
  if (!r) return '';
  if (FIX[r]) return FIX[r];
  const z = ZONED[r];
  if (!z) return String(r);
  const d = a.x != null ? ZONE[a.dir] : null;
  return d ? d + z[0] : z[1];
}

// ── 한 팀의 줄: [{ slot, p: { id, name, num }, tag, abs }] ─────────────
const SUBK = { __proto__: null, PH: '대타', PR: '대주자', DEF: '대수비' };
export function sheetRows(abs, lineup, team) {
  abs = Array.isArray(abs) ? abs.filter(Boolean) : [];
  const lu = Array.isArray(lineup) ? lineup.filter(p => p && p.name != null) : [];
  const mine = abs.filter(a => teamOf(a) === team);
  // 들어온 선수 → { 나간 선수, 종류 } (이 팀 교체만 · 투수 교체는 타순과 무관)
  const prev = Object.create(null);
  abs.forEach(a => (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => {
    if (e && e.t === 'SUB' && e.team === team && SUBK[e.k] && e.out && !prev[pk(e)]) prev[pk(e)] = { out: e.out, k: e.k };
  }));
  const rows = [], seen = new Set();
  const add = (p, slot, tag) => {
    const k = pk(p);
    if (seen.has(k)) return;
    seen.add(k);
    rows.push({ slot, p: { id: p.id != null ? p.id : null, name: p.name, num: p.num != null ? p.num : '' }, tag, abs: [] });
  };
  lu.filter(p => p.isStarter !== false).forEach((p, i) => {
    const chain = [{ p, tag: '' }];
    for (let c = prev[pk(p)], n = 0; c && n < 20; c = prev[pk(c.out)], n++) {
      chain[0].tag = SUBK[c.k];   // 앞 선수를 바꿔 들어온 쪽에 종류
      chain.unshift({ p: c.out, tag: '' });
    }
    chain.forEach((c, j) => add(c.p, j ? null : i + 1, c.tag));
  });
  mine.forEach(a => add({ id: a.bid, name: a.bname, num: a.bnum }, null, ''));
  const by = new Map(rows.map(r => [pk(r.p), r]));
  mine.forEach(a => { const r = by.get(ak(a)); if (r) r.abs.push(a); });
  return rows;
}

// 득점한 타석 (홈인한 주자의 그 전 마지막 타석) — 경기 운영 모드의 scored · runEv 로
export function scoredSet(abs) {
  abs = Array.isArray(abs) ? abs : [];
  const out = new Set();
  const mark = (x, team, i) => {
    for (let j = i; j >= 0; j--) {
      const b = abs[j];
      if (b && teamOf(b) === team && (x.id != null && b.bid != null ? String(x.id) === String(b.bid) : x.name != null && x.name === b.bname)) { out.add(b); return; }
    }
  };
  abs.forEach((a, i) => {
    if (!a) return;
    (Array.isArray(a.scored) ? a.scored : []).forEach(x => { if (x) mark(x, teamOf(a), i); });
    (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => { if (e && e.t !== 'SUB' && e.scored) mark(e, teamOf(e), i); });
  });
  return out;
}

// ── 그릴 내용 한 벌 ───────────────────────────────────────────
// g = { abs, home_lineup, away_lineup, info, hs, as, th, ta, date, venue }
export function sheetData(g) {
  const abs = (Array.isArray(g.abs) ? g.abs : []).filter(Boolean);
  const info = g.info && typeof g.info === 'object' ? g.info : {};
  const ls = info.ls && typeof info.ls === 'object' ? info.ls : (window.slLineScore ? window.slLineScore(abs) : null);
  const known = abs.some(a => Array.isArray(a.scored));   // 득점 · 도루를 아는 경기 (경기 운영 모드)
  const i1 = abs.find(a => innOf(a) === 1);
  const first = i1 ? teamOf(i1) : 'away';
  let n = [5, 7, 9].includes(+info.innings) ? +info.innings : 7;
  abs.forEach(a => { const i = innOf(a); if (i > n && i <= 15) n = i; });
  if (ls) ['away', 'home'].forEach(t => { const L = Array.isArray(ls[t]) ? ls[t].length : 0; if (L > n && L <= 15) n = L; });
  const sc = scoredSet(abs);
  const teams = (first === 'home' ? ['home', 'away'] : ['away', 'home']).map(t => {
    const mine = abs.filter(a => teamOf(a) === t), opp = abs.filter(a => teamOf(a) !== t);
    const rows = sheetRows(abs, t === 'home' ? g.home_lineup : g.away_lineup, t).map(r => {
      const s = window._cardStats(r.abs), rs = known && window.slRunnerStats ? window.slRunnerStats(abs, r.p) : null;
      return Object.assign(r, {
        cells: Array.from({ length: n }, (_, k) => r.abs.filter(a => innOf(a) === k + 1).map(a => ({ code: cellCode(a), hit: HITS.includes(a.res), walk: a.res === '볼넷' || a.res === '사구', rbi: +a.rbi || 0, scored: sc.has(a) }))),
        tot: [s.ab, s.h, s.rbi, rs ? rs.r : '', s.bb, s.hbp, s.so, rs ? rs.sb : ''],
      });
    });
    const tot = rows.length ? rows[0].tot.map((_, c) => rows.some(r => r.tot[c] === '') ? '' : rows.reduce((s, r) => s + r.tot[c], 0)) : [];
    const L = ls && Array.isArray(ls[t]) ? ls[t] : [];
    return {
      team: t, side: t === 'home' ? '홈' : '원정', name: (t === 'home' ? g.th : g.ta) || (t === 'home' ? '홈' : '원정'), first: t === first,
      rows, tot,
      line: Array.from({ length: n }, (_, k) => (L[k] == null ? '' : String(L[k]))),
      r: +(t === 'home' ? g.hs : g.as) || 0,
      h: mine.length ? mine.filter(a => HITS.includes(a.res)).length : '',
      e: opp.length ? opp.filter(a => a.res === '실책').length : '',
    };
  });
  return { n, teams, date: g.date || '', venue: g.venue || '' };
}

// ── 그리기 (논리 794 × 1123 = A4 세로 · 2배 PNG) ──────────────────
const C = { paper: '#FFFFFF', ink: '#14192B', ink2: '#4A4F62', rule: '#B9B4A8', fill: '#EFEBE2', red: '#D8352F', blue: '#2456D9' };
const F = { disp: '"Black Han Sans","Noto Sans KR",sans-serif', kr: '"Noto Sans KR",sans-serif', mono: '"IBM Plex Mono",monospace' };
const W = 794, H0 = 1123, SCALE = 2, X = 28, CW = W - X * 2;
const TOT = ['타수', '안타', '타점', '득점', '4구', '사구', '삼진', '도루'];
const SLOT = 26, NAME = 112, TW = 27;

export function drawSheet(cv, d) {
  const n = d.n, nT = d.teams.length;
  const lines = d.teams.reduce((s, t) => s + Math.max(1, t.rows.length) + 1, 0);   // 선수 줄 + 합계 줄
  const top = 206, foot = 78, fixed = nT * (24 + 20 + 14);   // 띠 + 머리 줄 + 사이
  const rh = Math.max(16, Math.min(28, Math.floor((H0 - top - foot - fixed) / lines)));
  const H = Math.max(H0, top + foot + fixed + lines * rh);
  cv.width = W * SCALE; cv.height = H * SCALE;
  const c = cv.getContext('2d');
  c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  c.textBaseline = 'alphabetic';
  c.fillStyle = C.paper; c.fillRect(0, 0, W, H);
  const font = (w, s, f) => { c.font = w + ' ' + s + 'px ' + f; };
  const text = (t, x, y, col, al) => { c.fillStyle = col; c.textAlign = al || 'left'; c.fillText(t, x, y); };
  const fit = (t, w, s, f, maxW, min) => { let z = s; do { font(w, z, f); if (c.measureText(t).width <= maxW) break; z -= 0.5; } while (z > (min || 7)); };
  const hl = (x1, x2, y, col, lw) => { c.fillStyle = col; c.fillRect(x1, y - (lw || 1) / 2, x2 - x1, lw || 1); };
  const vl = (x, y1, y2, col, lw) => { c.fillStyle = col; c.fillRect(x - (lw || 1) / 2, y1, lw || 1, y2 - y1); };
  const box = (x, y, w, h) => { c.strokeStyle = C.ink; c.lineWidth = 1.5; c.strokeRect(x, y, w, h); };

  // 머리: 제목 · 대회 / 경기일 / 구장 (빈칸은 손으로 적는다)
  font('400', 30, F.disp); text('경기 기록지', X, 52, C.ink);
  font('600', 11, F.mono); if ('letterSpacing' in c) c.letterSpacing = '2px';
  text('SPRAYLAB · SCORE SHEET', W - X, 30, C.ink2, 'right');
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  [['대회', ''], ['경기일', d.date], ['구장', d.venue]].forEach((f, i) => {
    const x0 = X + (CW / 3) * i, x1 = x0 + CW / 3 - 14, y = 84;
    font('600', 11, F.mono); text(f[0], x0, y, C.ink2);
    const lx = x0 + c.measureText(f[0]).width + 8;
    hl(lx, x1, y + 4, C.ink);
    if (f[1]) { fit(f[1], '700', 14, F.kr, x1 - lx - 8, 9); text(f[1], lx + 4, y, C.ink); }
  });
  hl(X, W - X, 101, C.ink, 3);

  // 이닝별 점수 (R H E)
  const LT = 114, LH = 26, NW = 170, RW = 40, iwL = (CW - NW - RW * 3) / n;
  c.fillStyle = C.ink; c.fillRect(X, LT, CW, LH);
  font('600', 12, F.mono);
  text('팀', X + 10, LT + 17, C.paper);
  for (let k = 0; k < n; k++) text(String(k + 1), X + NW + iwL * (k + 0.5), LT + 17, C.paper, 'center');
  ['R', 'H', 'E'].forEach((s, j) => text(s, X + NW + iwL * n + RW * (j + 0.5), LT + 17, C.paper, 'center'));
  d.teams.forEach((t, i) => {
    const y = LT + LH * (i + 1);
    if (i) hl(X, W - X, y, C.rule);
    font('600', 10, F.mono); text(t.side + (t.first ? ' · 선공' : ''), X + 10, y + 17, C.ink2);
    const sw = c.measureText(t.side + (t.first ? ' · 선공' : '')).width;
    fit(t.name, '700', 14, F.kr, NW - sw - 26, 9); text(t.name, X + 18 + sw, y + 18, C.ink);
    font('600', 14, F.mono);
    t.line.forEach((v, k) => text(v, X + NW + iwL * (k + 0.5), y + 18, C.ink, 'center'));
    font('700', 16, F.mono); text(String(t.r), X + NW + iwL * n + RW * 0.5, y + 19, C.ink, 'center');
    font('600', 14, F.mono);
    text(String(t.h), X + NW + iwL * n + RW * 1.5, y + 18, C.ink, 'center');
    text(String(t.e), X + NW + iwL * n + RW * 2.5, y + 18, C.ink, 'center');
  });
  const LB = LT + LH * (nT + 1);
  for (let k = 0; k <= n; k++) vl(X + NW + iwL * k, LT + LH, LB, k ? C.rule : C.ink);
  vl(X + NW + iwL * n + RW, LT + LH, LB, C.rule); vl(X + NW + iwL * n + RW * 2, LT + LH, LB, C.rule);
  box(X, LT, CW, LB - LT);

  // 팀마다: 띠 · 머리 줄 · 선수 줄 · 합계
  const IX = X + SLOT + NAME, TX = W - X - TW * TOT.length, iw = (TX - IX) / n;
  let y = top;
  d.teams.forEach(t => {
    c.fillStyle = C.ink; c.fillRect(X, y, CW, 24);
    font('400', 15, F.disp); text(t.side + '  ' + t.name, X + 10, y + 18, C.paper);
    font('600', 11, F.mono); text((t.first ? '선공 · ' : '후공 · ') + '득점 ' + t.r, W - X - 10, y + 16, C.paper, 'right');
    const T0 = y; y += 24;
    c.fillStyle = C.fill; c.fillRect(X, y, CW, 20);
    font('700', 10, F.kr);
    text('타순', X + SLOT / 2, y + 14, C.ink2, 'center'); text('선수', X + SLOT + 8, y + 14, C.ink2);
    for (let k = 0; k < n; k++) text((k + 1) + '회', IX + iw * (k + 0.5), y + 14, C.ink2, 'center');
    TOT.forEach((s, j) => text(s, TX + TW * (j + 0.5), y + 14, C.ink2, 'center'));
    y += 20;
    const R0 = y;
    if (!t.rows.length) {
      font('700', 11, F.kr); text('기록 없음 — 이 팀 타석은 적지 않았어요', IX + 8, y + rh / 2 + 4, C.ink2);
      y += rh;
    }
    t.rows.forEach(r => {
      hl(X, W - X, y, C.rule, r.slot != null ? 1 : 0.5);
      if (r.slot != null) { font('600', 12, F.mono); text(String(r.slot), X + SLOT / 2, y + rh / 2 + 4, C.ink, 'center'); }
      const nm = (r.p.num !== '' && r.p.num != null ? '#' + r.p.num + ' ' : '') + r.p.name;
      const nx = X + SLOT + (r.slot != null ? 6 : 12);
      let room = NAME - (r.slot != null ? 10 : 16);
      if (r.tag) {
        font('700', 9, F.kr); const tw = c.measureText(r.tag).width;
        text(r.tag, X + SLOT + NAME - 4, y + rh / 2 + 3, C.ink2, 'right'); room -= tw + 4;
      }
      fit(nm, '700', 12, F.kr, room, 8); text(nm, nx, y + rh / 2 + 4, C.ink);
      r.cells.forEach((cs, k) => {
        if (!cs.length) return;
        const cx = IX + iw * (k + 0.5), fs = Math.min(13, (rh - 4) / cs.length);
        cs.forEach((p, j) => {
          fit(p.code, '700', fs, F.kr, iw - 8, 6);
          text(p.code, cx, y + (rh - fs * cs.length) / 2 + fs * (j + 0.82), p.hit ? C.red : p.walk ? C.blue : C.ink, 'center');
        });
        if (cs.some(p => p.scored)) { c.fillStyle = C.red; c.beginPath(); c.arc(IX + iw * k + 5, y + 5, 2.4, 0, Math.PI * 2); c.fill(); }
        const rbi = cs.reduce((s, p) => s + p.rbi, 0);
        if (rbi) { font('700', 8, F.mono); text(String(rbi), IX + iw * (k + 1) - 3, y + 9, C.red, 'right'); }
      });
      font('600', 12, F.mono);
      r.tot.forEach((v, j) => text(String(v), TX + TW * (j + 0.5), y + rh / 2 + 4, C.ink, 'center'));
      y += rh;
    });
    hl(X, W - X, y, C.ink);
    font('700', 11, F.kr); text('합계', X + SLOT / 2 + NAME / 2, y + rh / 2 + 4, C.ink, 'center');
    font('700', 12, F.mono);
    t.tot.forEach((v, j) => text(String(v), TX + TW * (j + 0.5), y + rh / 2 + 4, C.ink, 'center'));
    y += rh;
    vl(X + SLOT, R0 - 20, y - rh, C.rule); vl(IX, R0 - 20, y, C.ink);
    for (let k = 1; k < n; k++) vl(IX + iw * k, R0 - 20, y, C.rule);
    vl(TX, R0 - 20, y, C.ink);
    for (let j = 1; j < TOT.length; j++) vl(TX + TW * j, R0 - 20, y, C.rule);
    box(X, T0, CW, y - T0);
    y += 14;
  });

  // 발: 약어 · 서명 칸
  const FY = H - foot + 14;
  font('500', 10, F.kr);
  text('칸 — 좌 · 좌중 · 중 · 우중 · 우 = 타구 방향   안 안타 · 2 2루타 · 3 3루타 · 홈 홈런 · 비 뜬공 · 4구 볼넷 · 희번 희생번트 · 희플 희생플라이 · 야선 야수선택', X, FY, C.ink2);
  c.fillStyle = C.red; c.beginPath(); c.arc(X + 3, FY + 11.5, 2.4, 0, Math.PI * 2); c.fill();   // 칸에 찍는 점과 같은 모양
  text('득점한 타석 · 칸 오른쪽 위 빨간 숫자 = 타점 · E = 실책으로 내보낸 타자 수 · 득점 · 도루 빈칸 = 경기 운영 모드로 적지 않은 경기', X + 10, FY + 15, C.ink2);
  font('700', 12, F.kr);
  ['기록원', '원정 감독', '홈 감독'].forEach((s, i) => {
    const x0 = X + (CW / 3) * i, x1 = x0 + CW / 3 - 18;
    text(s, x0, FY + 46, C.ink);
    hl(x0 + c.measureText(s).width + 8, x1, FY + 50, C.ink);
  });
  return c;
}

// ── 창 ──────────────────────────────────────────────────────
let _cv = null, _ret = null, _seq = 0;

function _mount() {
  if ($('ssView')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div id="ssView" class="rp ss" role="dialog" aria-modal="true" aria-labelledby="ssTitle" hidden>
  <div class="rp-panel">
    <header class="rp-hd">
      <h2 id="ssTitle">리그 기록지</h2>
      <button type="button" class="rp-x" id="ssClose" aria-label="닫기">✕</button>
    </header>
    <div class="rp-body">
      <div class="rp-empty" id="ssEmpty" hidden>
        <b>아직 기록된 타석이 없어요</b>
        <span>기록 탭에서 타석 결과를 입력하면 기록지를 만들 수 있어요.</span>
      </div>
      <figure class="rp-prev ss-prev" id="ssPrev">
        <img id="ssImg" alt="경기 기록지 미리보기">
        <figcaption class="rp-help">저장·공유가 안 되는 브라우저(카톡 안 등)에서는 위 이미지를 길게 눌러 저장하세요.</figcaption>
      </figure>
    </div>
    <footer class="rp-act" id="ssAct">
      <button type="button" class="rp-btn primary" id="ssSave" disabled>이미지 저장 · 공유</button>
      <button type="button" class="rp-btn" id="ssPrint" disabled>인쇄 / PDF</button>
    </footer>
  </div>
</div>`);
  $('ssClose').onclick = closeScoresheet;
  $('ssView').addEventListener('click', e => { if (e.target.id === 'ssView') closeScoresheet(); });
  $('ssView').addEventListener('keydown', e => { if (e.key === 'Escape') closeScoresheet(); });
  $('ssSave').onclick = () => { if (_cv) window._downloadCanvas(_cv, 'spraylab_scoresheet_' + Date.now() + '.png'); };
  $('ssPrint').onclick = () => {
    if (!_cv) return;
    const b = document.body, off = () => { b.classList.remove('ss-printing'); window.removeEventListener('afterprint', off); };
    b.classList.add('ss-printing');
    window.addEventListener('afterprint', off);
    window.print();
  };
}

// 경기일: 경기 정보(YYYY-MM-DD) → 저장 항목의 날짜 → 빈칸
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
  const seq = ++_seq, A = window.AS, info = A.info || {};
  $('ssSave').disabled = $('ssPrint').disabled = true;
  const d = sheetData({
    abs: A.abs, home_lineup: A.home_lineup, away_lineup: A.away_lineup, info, hs: A.hs, as: A.as,
    th: ($('tHome') || {}).value, ta: ($('tAway') || {}).value, date: _date(info), venue: typeof info.venue === 'string' ? info.venue : '',
  });
  await _fonts();
  if (seq !== _seq) return;
  const cv = document.createElement('canvas');
  drawSheet(cv, d);
  _cv = cv;
  $('ssImg').src = cv.toDataURL('image/png');
  $('ssSave').disabled = $('ssPrint').disabled = false;
}

export function openScoresheet() {
  _mount();
  const v = $('ssView'), has = !!(window.AS && Array.isArray(window.AS.abs) && window.AS.abs.length);
  _cv = null;
  $('ssImg').removeAttribute('src');
  $('ssEmpty').hidden = has; $('ssPrev').hidden = !has; $('ssAct').hidden = !has;
  if (v.hidden) {
    _ret = document.activeElement;
    v.hidden = false;
    document.documentElement.classList.add('rp-open');
  }
  setTimeout(() => { try { $('ssClose').focus(); } catch (e) {} }, 30);
  if (has) _render().catch(() => { if (window.showToast) window.showToast('기록지를 그리지 못했어요', false); });
}

export function closeScoresheet() {
  const v = $('ssView');
  if (!v || v.hidden) return;
  v.hidden = true;
  _seq++;
  document.documentElement.classList.remove('rp-open');
  try { if (_ret && _ret.focus) _ret.focus(); } catch (e) {}
}

// 경기 종료 카드: [닫기] [기록지] [저장 & 요약]
const _end = window.gfShowEndCard;
if (typeof _end === 'function') {
  window.gfShowEndCard = function () {
    const r = _end.apply(this, arguments), s = document.querySelector('#gfeCard .gfe-btn-save');
    if (s && !document.querySelector('#gfeCard .ss-end')) s.insertAdjacentHTML('beforebegin', '<button class="gfe-btn gfe-btn-close ss-end" onclick="gfEndClose();openScoresheet()">기록지</button>');
    return r;
  };
}

window.openScoresheet = openScoresheet;
window.closeScoresheet = closeScoresheet;
