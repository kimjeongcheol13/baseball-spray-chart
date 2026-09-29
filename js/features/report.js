// 선수 리포트 — 학부모 공유용 세로 이미지(1080×1920, 9:16)
// 선수 → 기간 → 코치 코멘트 → PNG 저장·공유 / 인쇄(PDF)
// 계산·그림은 기존 것을 그대로 쓴다: calcStats · sprayFigure(batdata.js) · hotColdFigure(zonefig.js)
// 저장 경기는 읽기만 한다. 새로 쓰는 키는 sl_report_cmt(선수별 마지막 코치 코멘트, 이 기기에만 · 동기화 안 함) 하나뿐
import { buildData, calcStats, f3, pct, sampleBadge, sprayFigure } from './batdata.js?v=5';
import { hotColdFigure } from './zonefig.js?v=3';

const CMT_KEY = 'sl_report_cmt';
const CMT_MAX = 80;           // 코멘트 최대 글자 (3줄 안쪽)
const RANGES = [1, 3, 5, 10, 0];   // 최근 N경기 · 0 = 전체
const DEF_RANGE = 5;

// 캔버스 — 종이 스코어북 토큰(paper.css)과 같은 값
const W = 1080, H = 1920, M = 64, CW = W - M * 2;
const C = {
  paper: '#F3EDDF', paper2: '#FBF7EE', ink: '#1F2A23', soft: '#55605A', rule: '#C9BFA9',
  red: '#C8322B', blue: '#2C4F8A', hl: '#D9A441', hlSoft: '#FFF4C2', grass: '#3E7A5B',
};
const F = {
  disp: '"Black Han Sans", "Noto Sans KR", sans-serif',
  body: '"Gowun Batang", "Nanum Myeongjo", serif',
  num: '"Oswald", "Noto Sans KR", sans-serif',
  mono: '"IBM Plex Mono", monospace',
};
// 차트 SVG는 이미지로 옮기면 페이지 CSS가 안 먹으므로 종이 테마 스타일(paper.css · analysis.css)을 SVG 안에 넣는다
const SVG_CSS = {
  spray: '.f-grass{fill:#3E7A5B}.f-fence{fill:none;stroke:#1F2A23;stroke-width:.9}.f-line{fill:none;stroke:#FBF7EE;stroke-width:.7}'
    + '.f-arc{fill:none;stroke:#FBF7EE;stroke-width:.6;stroke-dasharray:1.5 1.5;opacity:.55}'
    + '.d-1b,.d-hr{fill:#C8322B;stroke:#1F2A23;stroke-width:.5}.d-xbh{fill:#D9A441;stroke:#1F2A23;stroke-width:.5}.d-out{fill:none;stroke:#1F2A23;stroke-width:1}',
  zone: 'text{text-anchor:middle;dominant-baseline:central;font-family:"Noto Sans KR",sans-serif}'
    + '.zf-ax{font-weight:700;font-size:15px;fill:#55605A}.zf-c rect{fill:none}.zf-c.ball rect{stroke:#C9BFA9;stroke-width:1.5}'
    + '.zf-m{font-weight:700;font-size:26px;fill:#55605A}.zf-mb{font-size:20px}.zf-s{font-weight:500;font-size:12px;fill:#55605A}'
    + '.zf-l{font-weight:700;font-size:12px;fill:#55605A}.zf-c.on .zf-m{fill:#1F2A23}.zf-c.on .zf-s,.zf-c.on .zf-l{fill:#1F2A23}'
    + '.zf-sep{fill:none;stroke:#C9BFA9;stroke-width:1.5}.zf-box{fill:none;stroke:#1F2A23;stroke-width:3}',
};

const $ = id => document.getElementById(id);
const _e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();

function _track(action) {
  try { if (typeof window.gtag === 'function') window.gtag('event', 'player_report', { action }); } catch (e) {}
}

// ── 샘플: 가상 선수 1명 (메모리 전용 · 저장하지 않음) ─────────────
// 좌표는 저장 형식 그대로(홈 = (0.5, 1), deg 0 = 3루 파울라인, 펜스 반지름 0.97)
function _samplePos(deg, dist) {
  const ang = deg * Math.PI / 180 - Math.PI;
  const dirs = [['LF', 36], ['LC', 66], ['CF', 90], ['RC', 114], ['RF', 150]];
  const dir = dirs.reduce((b, d) => (Math.abs(d[1] - deg) < Math.abs(b[1] - deg) ? d : b))[0];
  return { x: 0.5 + Math.cos(ang) * dist, y: 1 + Math.sin(ang) * dist, deg, dir };
}
function _sampleGames() {
  const TEAM = 'SprayLab 리틀';
  const OPP = ['한빛 유소년', '새솔 리틀', '푸른 BC', '동산 유소년', '미래 리틀', '청솔 BC'];
  // [경기, 결과, 방향(deg), 거리, 코스, 타점]
  const PA = [
    [0, '안타', 58, .55, '내각 중간', 1], [0, '삼진', null, 0, '외각 낮음'], [0, '땅볼 아웃', 40, .30, '내각 낮음'], [0, '볼넷', null, 0, '볼 외'],
    [1, '2루타', 30, .80, '내각 높음', 1], [1, '플라이 아웃', 95, .70, '중앙 높음'], [1, '안타', 88, .50, '중앙 중간'], [1, '삼진', null, 0, '볼 아래'], [1, '땅볼 아웃', 70, .28, '중앙 낮음'],
    [2, '안타', 115, .52, '외각 중간'], [2, '사구', null, 0, '볼 내'], [2, '땅볼 아웃', 50, .32, '외각 낮음'], [2, '3루타', 125, .88, '중앙 중간', 2], [2, '희타', 98, .10, '중앙 높음'],
    [3, '삼진', null, 0, '외각 낮음'], [3, '내야안타', 65, .27, '중앙 낮음'], [3, '플라이 아웃', 45, .66, '내각 높음'], [3, '볼넷', null, 0, '볼 위'], [3, '안타', 36, .56, '내각 중간'],
    [4, '땅볼 아웃', 105, .30, '외각 중간'], [4, '2루타', 20, .84, '내각 중간', 1], [4, '삼진', null, 0, '외각 중간'], [4, '땅볼 아웃', 80, .26, '외각 낮음'],
    [5, '안타', 75, .54, '중앙 중간', 1], [5, '플라이 아웃', 140, .68, '외각 높음'], [5, '볼넷', null, 0, '볼 외'], [5, '삼진', null, 0, '중앙 높음'], [5, '땅볼 아웃', 60, .30, '내각 낮음'],
  ];
  const day = 864e5, now = Date.now();
  const lineup = [{ id: 'sample7', name: '김하늘', num: '7', bh: 'R' }];
  return OPP.map((ta, gi) => ({
    sample: true, key: 'sample_' + gi, th: TEAM, ta, ts: now - (OPP.length - 1 - gi) * 7 * day,
    home_lineup: lineup, away_lineup: [],
    abs: PA.filter(p => p[0] === gi).map((p, i) => ({
      id: 'sample_' + gi + '_' + i, bid: 'sample7', bname: '김하늘', bnum: '7', bats: 'R', team: 'home',
      res: p[1], zone: p[4], rbi: p[5] || 0, inn: String(i * 2 + 1), pitches: [],
      ...(p[2] != null ? _samplePos(p[2], p[3]) : { x: null, y: null, deg: null, dir: null }),
    })),
  }));
}
const SAMPLE_CMT = '타구를 좌중간으로 강하게 보내는 장면이 늘었어요. 바깥쪽 낮은 공은 아직 약해서 다음 주에 집중해서 연습합니다.';

// ── 선수 묶기 ─────────────────────────────────────────────────
// 기본 = 팀명 + 이름 (팀명은 띄어쓰기·대소문자 무시).
// 같은 팀 라인업에 같은 이름이 등번호가 다르게 동시에 있었던 경기가 있으면 두 사람이라는 증거 → 그 팀·이름만 등번호로 나눈다.
// 증거가 없으면 번호가 달라도 한 사람으로 본다 (유소년은 등번호가 자주 바뀜). 선수 ID(bid)는 경기마다 새로 만들어져 쓸 수 없다.
function _sides(g) {
  if (g.sample) return { home: g.home_lineup, away: g.away_lineup };
  if (g.current) { const S = window.AS || {}; return { home: S.home_lineup || [], away: S.away_lineup || [] }; }
  let d = null;
  try { d = JSON.parse(localStorage.getItem(g.key)); } catch (e) {}
  return { home: (d && d.home_lineup) || [], away: (d && d.away_lineup) || [] };
}

function _groupPlayers(games) {
  const split = new Set();
  games.forEach(g => {
    const sd = _sides(g);
    [['home', g.th], ['away', g.ta]].forEach(([side, team]) => {
      const nums = {};
      (sd[side] || []).forEach(p => {
        if (!p || !p.name || p.num == null || p.num === '') return;
        (nums[p.name] = nums[p.name] || new Set()).add(String(p.num));
      });
      Object.keys(nums).forEach(n => { if (nums[n].size > 1) split.add(_norm(team) + '|' + n); });
    });
  });

  const map = {};
  games.forEach((g, gi) => (g.abs || []).forEach(a => {
    if (!a || !a.bname) return;
    const team = (a.team === 'away' ? g.ta : g.th) || '';
    const base = _norm(team) + '|' + a.bname;
    const num = a.bnum != null && a.bnum !== '' ? String(a.bnum) : '';
    const key = split.has(base) ? base + '#' + (num || '?') : base;
    const p = map[key] || (map[key] = { key, name: a.bname, team: '', num: '', split: split.has(base), items: [], gset: new Set(), last: -1 });
    p.items.push({ a, gi });
    p.gset.add(gi);
    if (gi >= p.last) { p.last = gi; if (team) p.team = team; if (num) p.num = num; }
  }));
  return Object.values(map).sort((x, y) => y.items.length - x.items.length || String(x.name).localeCompare(String(y.name), 'ko'));
}

// ── 리포트 데이터 ─────────────────────────────────────────────
function _ymd(ts, full) {
  const d = new Date(ts);
  const y = full ? String(d.getFullYear()) : String(d.getFullYear()).slice(2);
  const pad = v => (full ? String(v).padStart(2, '0') : String(v));
  return `${y}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function _reportData(p, games, range, sample) {
  const all = [...p.gset].sort((x, y) => x - y);
  const use = range ? all.slice(-range) : all;
  const set = new Set(use);
  const abs = p.items.filter(x => set.has(x.gi)).map(x => x.a);
  const ts = use.map(gi => games[gi].ts || (games[gi].current ? Date.now() : 0)).filter(Boolean);
  const from = ts.length ? _ymd(Math.min(...ts)) : '', to = ts.length ? _ymd(Math.max(...ts)) : '';
  return {
    name: p.name, num: p.num, team: p.team, sample,
    rangeLabel: range ? `최근 ${range}경기` : '전체 기간',
    dates: from && from !== to ? `${from} – ${to}` : from,
    games: use.length, abs, st: calcStats(abs),
  };
}

// ── 그림: 기존 SVG → 이미지 ───────────────────────────────────
function _svgImage(html, css, w) {
  const m = /<svg[\s\S]*?<\/svg>/.exec(html || '');
  if (!m) return Promise.resolve(null);
  const vb = (/viewBox="([^"]+)"/.exec(m[0]) || [])[1];
  const v = vb ? vb.split(/[\s,]+/).map(Number) : [0, 0, 1, 1];
  const h = Math.round(w * v[3] / v[2]);
  const svg = m[0]
    .replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"`)
    .replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`);
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res({ img, w, h });
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function _charts(R) {
  const colW = (CW - 16) / 2;
  const P = { name: R.name, abs: R.abs, st: R.st };
  let spray = '', zone = '';
  try { spray = sprayFigure(P); } catch (e) { spray = ''; }
  try { zone = R.st.pa ? hotColdFigure(R.abs, R.st.avg, R.st.pa) : ''; } catch (e) { zone = ''; }
  return Promise.all([_svgImage(spray, SVG_CSS.spray, colW), _svgImage(zone, SVG_CSS.zone, colW)]);
}

// ── 캔버스 그리기 ─────────────────────────────────────────────
const _font = (w, px, fam) => `${w} ${px}px ${fam}`;

function _text(ctx, t, x, y, font, color, align = 'left') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, x, y);
}

// 한 글자씩 재서 줄바꿈 (띄어쓰기가 있으면 그 자리에서)
function _wrap(ctx, text, max) {
  const out = [];
  String(text).split('\n').forEach(par => {
    let line = '';
    for (const ch of par) {
      const t = line + ch;
      if (line && ctx.measureText(t).width > max) {
        const sp = line.lastIndexOf(' ');
        if (ch !== ' ' && sp > 0) { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; }
        else { out.push(line); line = ch === ' ' ? '' : ch; }
      } else line = t;
    }
    out.push(line);
  });
  return out.filter((l, i, a) => l.trim() || (i > 0 && i < a.length - 1));
}

// 글자 사이 간격을 직접 벌려서 그리기 (ctx.letterSpacing 미지원 브라우저 대비)
function _spaced(ctx, t, x, y, gap) {
  let cx = x;
  for (const ch of t) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + gap; }
  return cx - gap - x;
}
function _spacedWidth(ctx, t, gap) {
  let w = 0;
  for (const ch of t) w += ctx.measureText(ch).width + gap;
  return w - gap;
}

function _stamp(ctx, t, cx, cy, color, px, rot) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.font = _font(600, px, F.mono);
  const gap = px * 0.2, tw = _spacedWidth(ctx, t, gap);
  const bw = tw + px * 1.6, bh = px * 2.1;
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  _spaced(ctx, t, -tw / 2, 1, gap);
  ctx.restore();
  return bw;
}

function _draw(ctx, R, img) {
  const s = R.st;
  ctx.fillStyle = C.paper2; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.strokeRect(24, 24, W - 48, H - 48);

  // 1. 헤더
  _text(ctx, '선수 리포트', M, 110, _font(700, 30, F.body), C.soft);
  if (R.sample) _stamp(ctx, 'SAMPLE · 가상 선수', W - M - 190, 98, C.red, 22, -0.035);
  ctx.font = _font(400, 100, F.disp);
  let name = R.name;
  while (ctx.measureText(name).width > CW - 200 && name.length > 1) name = name.slice(0, -1);
  if (name !== R.name) name += '…';
  _text(ctx, name, M, 226, _font(400, 100, F.disp), C.ink);
  const nw = ctx.measureText(name).width;
  if (R.num) _text(ctx, '#' + R.num, M + nw + 22, 222, _font(600, 60, F.num), C.red);
  let y = 226;
  if (R.team) { y += 58; _text(ctx, R.team, M, y, _font(700, 38, F.body), C.ink); }
  y += 50;
  const meta = [R.rangeLabel, R.dates, `${R.games}경기 ${s.pa}타석`].filter(Boolean).join('  ·  ');
  _text(ctx, meta, M, y, _font(700, 29, F.body), C.soft);
  y += 34;
  ctx.fillStyle = C.ink; ctx.fillRect(M, y, CW, 5);
  y += 5 + 26;

  // 2. 표본 안내
  const smp = sampleBadge(s.pa);
  if (smp) {
    ctx.fillStyle = C.hlSoft; ctx.fillRect(M, y, CW, 58);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(M + 1, y + 1, CW - 2, 56);
    const msg = (smp.cls === 'low' ? '표본이 매우 적어 참고용이에요' : '표본이 적어 참고용이에요') + ` · ${s.pa}타석 기준`;
    _text(ctx, msg, W / 2, y + 40, _font(700, 28, F.body), C.ink, 'center');
    y += 58 + 18;
  }

  // 3. 핵심 스탯 — 큰 숫자 4개
  const tiles = [['타율', s.avg], ['출루율', s.obp], ['장타율', s.slg], ['OPS', s.ops]];
  const tw = (CW - 16 * 3) / 4, th = 156;
  tiles.forEach(([l, v], i) => {
    const x = M + i * (tw + 16);
    ctx.fillStyle = C.paper; ctx.fillRect(x, y, tw, th);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, tw - 2, th - 2);
    _text(ctx, l, x + tw / 2, y + 44, _font(700, 28, F.body), C.soft, 'center');
    _text(ctx, s.pa ? f3(v) : '—', x + tw / 2, y + 130, _font(600, 76, F.num), C.ink, 'center');
  });
  y += th + 20;

  // 기록 줄
  const cnt = [['타석', s.pa], ['안타', s.h], ['2루타', s.s2], ['3루타', s.s3], ['홈런', s.hr], ['타점', s.rbi], ['볼넷', s.bb], ['삼진', s.k]];
  const cw = CW / cnt.length, ch = 104;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(M + 1, y + 1, CW - 2, ch - 2);
  cnt.forEach(([l, v], i) => {
    const x = M + i * cw;
    if (i) { ctx.fillStyle = C.rule; ctx.fillRect(x, y + 14, 1.5, ch - 28); }
    _text(ctx, l, x + cw / 2, y + 38, _font(700, 24, F.body), C.soft, 'center');
    _text(ctx, String(v), x + cw / 2, y + 88, _font(600, 46, F.num), C.ink, 'center');
  });
  y += ch + 46;

  // 작은 줄: wOBA · 삼진% · 볼넷%
  const small = [['wOBA', s.pa ? f3(s.woba) : '—'], ['삼진%', s.pa ? pct(s.kRate) : '—'], ['볼넷%', s.pa ? pct(s.bbRate) : '—']];
  const parts = [];
  small.forEach(([l, v], i) => {
    if (i) parts.push(['   ·   ', _font(700, 30, F.body), C.rule]);
    parts.push([l + ' ', _font(700, 28, F.body), C.soft]);
    parts.push([v, _font(600, 34, F.num), C.ink]);
  });
  const pw = parts.reduce((w, [t, f]) => { ctx.font = f; return w + ctx.measureText(t).width; }, 0);
  let px = (W - pw) / 2;
  parts.forEach(([t, f, c]) => { _text(ctx, t, px, y, f, c); ctx.font = f; px += ctx.measureText(t).width; });
  y += 36;
  _text(ctx, 'wOBA = 볼넷·단타·장타의 가치를 한 숫자로 합친 출루 지표', W / 2, y, _font(700, 21, F.body), C.soft, 'center');
  y += 34;

  // 4·5. 스프레이차트 + 핫존 (좌우)
  const colW = (CW - 16) / 2, x1 = M, x2 = M + colW + 16;
  const dn = s.dn || 0;
  const nPts = R.abs.filter(a => a.x != null && a.y != null).length;
  _text(ctx, '타구 방향', x1, y + 30, _font(700, 32, F.body), C.ink);
  _text(ctx, `타구 ${nPts}개`, x1 + colW, y + 30, _font(700, 22, F.body), C.soft, 'right');
  _text(ctx, '코스별 타율', x2, y + 30, _font(700, 32, F.body), C.ink);
  y += 44;
  ctx.fillStyle = C.ink; ctx.fillRect(x1, y, colW, 2); ctx.fillRect(x2, y, colW, 2);
  y += 12;
  const cy = y;

  // 스프레이
  let sy = cy;
  if (img[0]) { ctx.drawImage(img[0].img, x1, sy, img[0].w, img[0].h); sy += img[0].h + 14; }
  else { sy += 14; }
  if (dn) {
    const seg = [[s.pull, C.red, '당김'], [s.center, C.grass, '센터'], [s.oppo, C.blue, '밀어']];
    let sx = x1;
    seg.forEach(([n, c]) => {
      if (!n) return;
      const w = colW * n / dn;
      ctx.fillStyle = c; ctx.fillRect(sx, sy, w - 2, 36);
      if (w > 60) _text(ctx, Math.round(n / dn * 100) + '%', sx + w / 2, sy + 27, _font(600, 22, F.num), C.paper2, 'center');
      sx += w;
    });
    sy += 36 + 32;
    _text(ctx, `당김 ${s.pull}`, x1, sy, _font(700, 22, F.body), C.red);
    _text(ctx, `센터 ${s.center}`, x1 + colW / 2, sy, _font(700, 22, F.body), C.grass, 'center');
    _text(ctx, `밀어 ${s.oppo}`, x1 + colW, sy, _font(700, 22, F.body), C.blue, 'right');
  } else {
    sy += 26;
    _text(ctx, '방향 기록 없음', x1 + colW / 2, sy, _font(700, 22, F.body), C.soft, 'center');
  }
  sy += 42;
  // 기호 범례
  const keys = [['1b', '단타'], ['xbh', '2·3루타'], ['hr', '홈런'], ['out', '아웃']];
  ctx.font = _font(700, 21, F.body);
  const kw = keys.reduce((w, [, l]) => w + 26 + ctx.measureText(l).width + 18, -18);
  let kx = x1 + (colW - kw) / 2;
  keys.forEach(([k, l]) => {
    const mx = kx + 9, my = sy - 8;
    ctx.lineWidth = 2; ctx.strokeStyle = C.ink;
    ctx.beginPath();
    if (k === '1b') { ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fillStyle = C.red; ctx.fill(); ctx.stroke(); }
    else if (k === 'xbh') { ctx.fillStyle = C.hl; ctx.fillRect(mx - 8, my - 8, 16, 16); ctx.strokeRect(mx - 8, my - 8, 16, 16); }
    else if (k === 'hr') { ctx.moveTo(mx, my - 10); ctx.lineTo(mx + 10, my); ctx.lineTo(mx, my + 10); ctx.lineTo(mx - 10, my); ctx.closePath(); ctx.fillStyle = C.red; ctx.fill(); ctx.stroke(); }
    else { ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.stroke(); }
    ctx.font = _font(700, 21, F.body);
    _text(ctx, l, kx + 26, sy, _font(700, 21, F.body), C.soft);
    kx += 26 + ctx.measureText(l).width + 18;
  });
  sy += 10;

  // 핫존
  let zy = cy;
  if (img[1]) {
    ctx.drawImage(img[1].img, x2, zy, img[1].w, img[1].h);
    zy += img[1].h + 10;
    const gw = 200, gx = x2 + (colW - gw) / 2;
    const grd = ctx.createLinearGradient(gx, 0, gx + gw, 0);
    grd.addColorStop(0, '#899BB7'); grd.addColorStop(0.5, C.paper2); grd.addColorStop(1, '#DF8B83');
    ctx.fillStyle = grd; ctx.fillRect(gx, zy, gw, 16);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.strokeRect(gx, zy, gw, 16);
    _text(ctx, '약함', gx - 12, zy + 15, _font(700, 21, F.body), C.blue, 'right');
    _text(ctx, '강함', gx + gw + 12, zy + 15, _font(700, 21, F.body), C.red, 'left');
    zy += 16 + 34;
    _text(ctx, '칸 숫자 = 그 코스 타율', x2 + colW / 2, zy, _font(700, 20, F.body), C.soft, 'center');
    zy += 28;
    _text(ctx, `색 = 이 선수 타율(${s.ab ? f3(s.avg) : '—'}) 대비 · 3타수 미만은 색 없음`, x2 + colW / 2, zy, _font(700, 18, F.body), C.soft, 'center');
    zy += 10;
  } else {
    const bh = 420;
    ctx.setLineDash([8, 6]); ctx.strokeStyle = C.rule; ctx.lineWidth = 2; ctx.strokeRect(x2 + 1, zy + 1, colW - 2, bh);
    ctx.setLineDash([]);
    _text(ctx, '코스(존) 기록이 없어요', x2 + colW / 2, zy + bh / 2, _font(700, 26, F.body), C.soft, 'center');
    zy += bh;
  }
  y = Math.max(sy, zy) + 30;

  // 6. 코치 코멘트 (푸터와 겹치지 않게 남은 높이만큼만)
  const fy = H - 150;
  const cmt = String(R.cmt || '').trim();
  if (cmt) {
    ctx.font = _font(700, 34, F.body);
    const room = Math.max(1, Math.min(3, Math.floor((fy - 28 - y - 64) / 50)));
    let lines = _wrap(ctx, cmt, CW - 40);
    if (lines.length > room) { lines = lines.slice(0, room); lines[room - 1] = lines[room - 1].replace(/.$/, '…'); }
    const bh = 60 + lines.length * 50;
    ctx.fillStyle = C.red; ctx.fillRect(M, y, 6, bh);
    _text(ctx, '코치 코멘트', M + 26, y + 34, _font(700, 26, F.body), C.red);
    lines.forEach((l, i) => _text(ctx, l, M + 26, y + 82 + i * 50, _font(700, 34, F.body), C.ink));
  }

  // 7. 푸터: 로고 + 태그라인 도장 / 생성일 · 주소
  ctx.fillStyle = C.ink; ctx.fillRect(M, fy, CW, 3);
  _text(ctx, 'SPRAYLAB', M, fy + 70, _font(400, 48, F.disp), C.ink);
  ctx.font = _font(400, 48, F.disp);
  const lw = ctx.measureText('SPRAYLAB').width;
  const sw = 20;
  ctx.font = _font(600, sw, F.mono);
  const stampW = _spacedWidth(ctx, 'YOUR SWING, VISUALIZED', sw * 0.2) + sw * 1.6;
  _stamp(ctx, 'YOUR SWING, VISUALIZED', M + lw + 28 + stampW / 2, fy + 52, C.red, sw, -0.035);
  _text(ctx, '생성 ' + _ymd(Date.now(), true), W - M, fy + 66, _font(700, 24, F.body), C.soft, 'right');
  _text(ctx, 'kimjeongcheol13.github.io/baseball-spray-chart', M, fy + 110, _font(500, 18, F.mono), C.soft);
  if (R.sample) _text(ctx, '샘플 · 실제 기록 아님', W - M, fy + 110, _font(700, 20, F.body), C.red, 'right');
}

// 캔버스에 쓸 글꼴을 미리 불러온다 (한글 웹폰트는 글자 범위별로 나뉘어 있어 실제 글자로 요청). 오프라인이면 기본 글꼴로 그린다
function _fonts(text) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const t = text + '0123456789.%·#–—…';
  const jobs = [_font(400, 100, F.disp), _font(700, 30, F.body), _font(600, 60, F.num), _font(500, 20, F.mono), _font(600, 20, F.mono)]
    .map(f => document.fonts.load(f, t).catch(() => {}));
  return Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, 2500))]);
}

// ── 상태 · 화면 ───────────────────────────────────────────────
const S = { sample: false, key: null, range: DEF_RANGE, cmt: '' };
let _games = [], _players = [], _sampleP = null, _sampleG = null;
let _chartCache = { id: '', img: [null, null] };
let _canvas = null, _seq = 0, _ready = false, _cmtTimer = 0, _returnFocus = null;

function _cmtRead() {
  try { return JSON.parse(localStorage.getItem(CMT_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function _cmtWrite(key, text) {
  try {
    const all = _cmtRead();
    if (text) all[key] = text; else delete all[key];
    localStorage.setItem(CMT_KEY, JSON.stringify(all));
  } catch (e) {}
}

function _mount() {
  if ($('rpView')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div id="rpView" class="rp" role="dialog" aria-modal="true" aria-labelledby="rpTitle" hidden>
  <div class="rp-panel">
    <header class="rp-hd">
      <h2 id="rpTitle">선수 리포트</h2>
      <button type="button" class="rp-x" id="rpClose" aria-label="닫기">✕</button>
    </header>
    <div class="rp-body" id="rpBody">
      <div class="rp-sample-note" id="rpSampleNote" hidden>
        <b>SAMPLE</b> 가상 선수로 만든 미리보기예요. 내 기록에는 저장되지 않아요.
        <button type="button" class="rp-link" id="rpToMine" hidden>내 기록으로 만들기</button>
      </div>
      <div class="rp-empty" id="rpEmpty" hidden>
        <b>아직 기록된 타석이 없어요</b>
        <span>기록 탭에서 타석 결과를 입력하면 선수 리포트를 만들 수 있어요.</span>
        <button type="button" class="rp-btn" id="rpTrySample">샘플로 미리보기</button>
      </div>
      <div id="rpForm">
        <div class="rp-field" id="rpPlayerField">
          <label for="rpPlayer">선수</label>
          <select id="rpPlayer" class="rp-select"></select>
          <small class="rp-help" id="rpPlayerHelp"></small>
        </div>
        <div class="rp-field">
          <span class="rp-lbl" id="rpRangeLbl">기간</span>
          <div class="rp-seg" id="rpRange" role="radiogroup" aria-labelledby="rpRangeLbl">
            ${RANGES.map(n => `<button type="button" role="radio" data-n="${n}">${n ? `최근 ${n}경기` : '전체'}</button>`).join('')}
          </div>
        </div>
        <div class="rp-field">
          <label for="rpCmt">코치 코멘트 <small>(선택 · 3줄까지)</small></label>
          <textarea id="rpCmt" class="rp-cmt" rows="3" maxlength="${CMT_MAX}" placeholder="예) 타구 방향이 좋아졌어요. 다음 주엔 변화구 대처를 연습합니다."></textarea>
          <small class="rp-help" id="rpCmtN"></small>
        </div>
        <figure class="rp-prev">
          <div class="rp-prev-box"><img id="rpImg" alt=""><span class="rp-loading" id="rpLoading">리포트 그리는 중…</span></div>
          <figcaption class="rp-help">저장·공유가 안 되는 브라우저(카톡 안 등)에서는 위 이미지를 길게 눌러 저장하세요.</figcaption>
        </figure>
      </div>
    </div>
    <footer class="rp-act" id="rpAct">
      <button type="button" class="rp-btn primary" id="rpSave" disabled>이미지 저장 · 공유</button>
      <button type="button" class="rp-btn" id="rpPrint" disabled>인쇄 / PDF</button>
    </footer>
  </div>
</div>`);

  $('rpClose').onclick = closePlayerReport;
  $('rpView').addEventListener('click', e => { if (e.target.id === 'rpView') closePlayerReport(); });
  $('rpView').addEventListener('keydown', e => { if (e.key === 'Escape') closePlayerReport(); });
  $('rpPlayer').onchange = e => { S.key = e.target.value; _loadCmt(); _render(); };
  $('rpRange').onclick = e => {
    const b = e.target.closest('button[data-n]');
    if (!b) return;
    S.range = +b.dataset.n;
    _syncRange();
    _render();
  };
  $('rpCmt').addEventListener('input', e => {
    // 3줄까지만
    const v = e.target.value.split('\n').slice(0, 3).join('\n');
    if (v !== e.target.value) e.target.value = v;
    S.cmt = v;
    _cmtCount();
    if (!S.sample && S.key) _cmtWrite(S.key, v.trim());
    clearTimeout(_cmtTimer);
    _cmtTimer = setTimeout(_render, 350);
  });
  $('rpSave').onclick = _save;
  $('rpPrint').onclick = _print;
  $('rpTrySample').onclick = () => { _track('sample'); _open({ sample: true }); };
  $('rpToMine').onclick = () => _open({});
}

function _syncRange() {
  $('rpRange').querySelectorAll('button').forEach(b => {
    const on = +b.dataset.n === S.range;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}
function _cmtCount() { $('rpCmtN').textContent = `${S.cmt.length}/${CMT_MAX}자`; }
function _loadCmt() {
  S.cmt = S.sample ? SAMPLE_CMT : (_cmtRead()[S.key] || '');
  $('rpCmt').value = S.cmt;
  _cmtCount();
}

function _playerLabel(p) {
  return `${p.name}${p.num ? ' #' + p.num : p.split ? ' (번호 없음)' : ''} · ${p.items.length}타석`;
}

// opts: { sample } | { name } (프로필에서 선수 지정) | {}
function _open(opts) {
  _mount();
  S.sample = !!opts.sample;
  if (S.sample) {
    if (!_sampleG) { _sampleG = _sampleGames(); _sampleP = _groupPlayers(_sampleG)[0]; }
  } else {
    const data = buildData();
    _games = data.games;
    _players = _groupPlayers(_games);
    if (opts.name) {
      const hit = _players.find(p => p.name === opts.name);   // 같은 이름이 여럿이면 타석 많은 쪽 (정렬 순)
      if (hit) S.key = hit.key;
    }
    if (!_players.some(p => p.key === S.key)) S.key = _players[0] ? _players[0].key : null;
  }
  S.range = DEF_RANGE;
  _syncRange();

  const hasData = S.sample || _players.length > 0;
  $('rpSampleNote').hidden = !S.sample;
  $('rpToMine').hidden = !(S.sample && _hasMine());
  $('rpEmpty').hidden = hasData;
  $('rpForm').hidden = !hasData;
  $('rpPlayerField').hidden = S.sample;
  $('rpAct').hidden = !hasData;
  if (!S.sample) _fillPlayers();
  _loadCmt();

  const v = $('rpView');
  if (v.hidden) {
    _returnFocus = document.activeElement;
    v.hidden = false;
    document.documentElement.classList.add('rp-open');
  }
  $('rpBody').scrollTop = 0;
  setTimeout(() => { try { $('rpClose').focus(); } catch (e) {} }, 30);
  if (hasData) _render();
}

function _hasMine() {
  try { if ((window.AS && window.AS.abs || []).length) return true; return JSON.parse(localStorage.getItem('sl_saves') || '[]').length > 0; } catch (e) { return false; }
}

function _fillPlayers() {
  // 팀별 묶음 (팀 순서 = 그 팀 타석 합계 많은 순)
  // 팀명은 선수 묶기와 같은 기준(띄어쓰기 무시)으로 모으고, 이름표는 가장 최근 경기의 표기
  const teams = {}, label = {};
  _players.forEach(p => {
    const t = _norm(p.team);
    (teams[t] = teams[t] || []).push(p);
    if (!label[t] || p.last > label[t].last) label[t] = { last: p.last, name: p.team || '팀명 없음' };
  });
  const order = Object.keys(teams).sort((a, b) =>
    teams[b].reduce((n, p) => n + p.items.length, 0) - teams[a].reduce((n, p) => n + p.items.length, 0));
  $('rpPlayer').innerHTML = order.map(t => `<optgroup label="${_e(label[t].name)}">${teams[t].map(p =>
    `<option value="${_e(p.key)}"${p.key === S.key ? ' selected' : ''}>${_e(_playerLabel(p))}</option>`).join('')}</optgroup>`).join('');
  const splitN = _players.filter(p => p.split).length;
  $('rpPlayerHelp').textContent = '같은 팀·같은 이름은 한 선수로 묶어요.' + (splitN ? ' 한 경기에 동명이인이 함께 있던 팀은 등번호로 나눴어요.' : '');
}

function _current() {
  if (S.sample) return { p: _sampleP, games: _sampleG };
  return { p: _players.find(x => x.key === S.key), games: _games };
}

async function _render() {
  const seq = ++_seq;
  const { p, games } = _current();
  if (!p) return;
  _ready = false;
  $('rpSave').disabled = true; $('rpPrint').disabled = true;
  $('rpLoading').hidden = false;
  const R = _reportData(p, games, S.range, S.sample);
  R.cmt = S.cmt;

  const cid = (S.sample ? 'S|' : '') + p.key + '|' + S.range + '|' + p.items.length;
  if (_chartCache.id !== cid) {
    const img = await _charts(R);
    if (seq !== _seq) return;
    _chartCache = { id: cid, img };
  }
  await _fonts([R.name, R.num, R.team, R.rangeLabel, R.dates, R.cmt, '선수 리포트 SAMPLE 가상 선수 타율 출루율 장타율 OPS 타석 안타 2루타 3루타 홈런 타점 볼넷 삼진 wOBA 볼넷·단타·장타의 가치를 한 숫자로 합친 출루 지표 타구 방향 개 코스별 당김 센터 밀어 기록 없음 단타 아웃 약함 강함 칸 숫자 그 코스 색 이 선수 대비 미만은 코스(존) 기록이 없어요 코치 코멘트 생성 샘플 · 실제 기록 아님 표본이 매우 적어 참고용이에요 기준 경기 전체 기간 최근 YOUR SWING, VISUALIZED SPRAYLAB'].join(' '));
  if (seq !== _seq) return;

  const cv = _canvas || (_canvas = document.createElement('canvas'));
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  _draw(ctx, R, _chartCache.img);
  let url = '';
  try { url = cv.toDataURL('image/png'); } catch (e) { url = ''; }
  if (!url) {
    // 차트 이미지 때문에 캔버스를 못 내보내는 브라우저 → 차트 없이 다시 그림
    _draw(ctx, R, [null, null]);
    try { url = cv.toDataURL('image/png'); } catch (e) { url = ''; }
  }
  const img = $('rpImg');
  img.src = url;
  img.alt = `${R.name} 선수 리포트 — ${R.rangeLabel} ${R.games}경기 ${R.st.pa}타석, 타율 ${f3(R.st.avg)} 출루율 ${f3(R.st.obp)} 장타율 ${f3(R.st.slg)}`;
  $('rpLoading').hidden = !!url;
  if (!url) $('rpLoading').textContent = '이 브라우저에서는 리포트 이미지를 만들 수 없어요.';
  _ready = !!url;
  $('rpSave').disabled = !_ready; $('rpPrint').disabled = !_ready;
}

function _fileName() {
  const { p } = _current();
  const n = String((p && p.name) || '선수').replace(/[\\/:*?"<>|\s]/g, '');
  return `SprayLab_리포트_${n}${S.sample ? '_SAMPLE' : ''}_${_ymd(Date.now(), true).replace(/\./g, '')}.png`;
}

function _save() {
  if (!_ready || !_canvas) return;
  _track(S.sample ? 'save_sample' : 'save');
  const name = _fileName();
  const fallback = blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  try {
    _canvas.toBlob(blob => {
      if (!blob) return;
      let file = null;
      try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
      if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: '선수 리포트' }).catch(err => { if (!err || err.name !== 'AbortError') fallback(blob); });
      } else fallback(blob);
    }, 'image/png');
  } catch (e) {
    if (window.showToast) window.showToast('이미지를 저장하지 못했어요 — 미리보기를 길게 눌러 저장하세요', false);
  }
}

function _print() {
  if (!_ready) return;
  _track(S.sample ? 'print_sample' : 'print');
  const b = document.body;
  const off = () => { b.classList.remove('rp-printing'); window.removeEventListener('afterprint', off); };
  b.classList.add('rp-printing');
  window.addEventListener('afterprint', off);
  window.print();
}

export function openPlayerReport(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  _track(o.sample ? 'open_sample' : 'open');
  _open(o);
}

export function closePlayerReport() {
  const v = $('rpView');
  if (!v || v.hidden) return;
  v.hidden = true;
  document.documentElement.classList.remove('rp-open');
  _seq++;
  if (_returnFocus && _returnFocus.focus) { try { _returnFocus.focus(); } catch (e) {} }
}

if (typeof window !== 'undefined') {
  window.openPlayerReport = openPlayerReport;
  window.closePlayerReport = closePlayerReport;
}
