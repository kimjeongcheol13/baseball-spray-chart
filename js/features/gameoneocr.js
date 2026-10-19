// 게임원 앱 스크린샷으로 가져오기 — 사진 → 글자 읽기(Tesseract.js, 휴대폰 안에서 · 사진은 밖으로 나가지 않음) → 원정 · 홈 타자 표 칸에 글로 채움
//  · 게임원 앱은 글자 복사가 막혀 있어(2026-10-19 확인) 사진만 된다. 채운 뒤 미리보기 · 저장은 붙여넣기와 같은 길(gameoneimport.js)
//  · 읽는 표 2가지 — 2026-10-19 실제 앱(박스 스코어 › 기록 › 팀 탭) 캡처로 확인
//      경기기록 = 타순 · 타자명 · 포지션 · 1회 … 7회     칸 표기는 웹과 같다(중플 · 우안,도루 · 4구)
//      타자     = 타순 · 타자명 · 포지션 · 타수 · 안타 · 타점 · 홈런 · 사사구 · 도루 · 득점 · 삼진 · 타율
//        → 같이 고르면 타수 · 타점 · 득점 · 도루 · 타율을 줄 끝에 붙이고(웹 복사와 같은 꼴), 타수 · 안타 · 사사구 · 삼진으로 읽은 칸을 맞춰 본다
//  · 칸 나누기: 어두운 점으로 글줄(가로 띠) → 글 덩어리(세로 틈) → 머리글 글자 위치에 붙인다. 덩어리마다 한 줄 OCR(PSM 7)
//    머리글이 없는 장(아래로 내려 찍은 장)은 같은 폭 사진의 머리글 위치를 쓴다. 그래서 첫 장에는 머리글이 보여야 한다
//  · Tesseract.js 5.1.1(jsdelivr) 는 처음 누를 때만 불러온다. 한국어 글자 모델은 assets/ocr/kor.traineddata(tessdata_fast, Apache-2.0) 를 직접 둔다
const TESS = {
  src: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  lang: 'assets/ocr/', cache: 'sl_ocr_kor_fast_v1', workerPath: null, corePath: null, psm: '7',
};
const INK = 165;                     // 이보다 어두우면 글자 점 (앱 회색 글자 #888 ≈ 136 포함, 줄 구분선 #e5e5e5 제외)
const POS_APP = { __proto__: null, P: '투', C: '포', '1B': '1', '2B': '2', '3B': '3', SS: '유', LF: '좌', CF: '중', RF: '우', DH: '지' };
const STAT_HEAD = { __proto__: null, '타수': 'ab', '안타': 'h', '타점': 'rbi', '홈런': 'hr', '사사구': 'bb', '도루': 'sb', '득점': 'r', '삼진': 'so', '타율': 'avg' };
const NAME_RE = /^(.*?)\(?(\d{1,3})\)$/;
const HITS = ['안타', '내야안타', '2루타', '3루타', '홈런'], NOT_AB = ['볼넷', '사구', '희비'];

const $ = id => document.getElementById(id);
const _norm = s => String(s || '').replace(/\s+/g, '');
function _track(name, params) { try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (e) { /* 통계 실패는 무시 */ } }

// ── 픽셀 → 글줄 · 글 덩어리 ──
// img = { width, height, data(RGBA) }. 글줄 = 어두운 점이 있는 가로 띠, 글자 높이의 1/4 보다 좁은 틈은 이어 붙인다(한글 받침 · 쉼표)
function inkMask(img) {
  const { width: w, height: h, data: d } = img, m = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < m.length; i++, p += 4) m[i] = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) < INK ? 1 : 0;
  return m;
}
function _runs(count, min, gap) {
  const out = []; let s = -1;
  for (let i = 0; i <= count.length; i++) {
    const on = i < count.length && count[i] >= min;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { out.push([s, i]); s = -1; }
  }
  const merged = [];
  out.forEach(r => { const l = merged[merged.length - 1]; if (l && r[0] - l[1] <= gap(l, r)) l[1] = r[1]; else merged.push(r.slice()); });
  return merged;
}
function findLines(m, w, h) {
  const rows = new Array(h).fill(0);
  for (let y = 0; y < h; y++) { let c = 0; for (let x = 0, o = y * w; x < w; x++) c += m[o + x]; rows[y] = c; }
  const raw = _runs(rows, 1, () => 2), hs = raw.map(r => r[1] - r[0]).filter(v => v >= 8).sort((a, b) => a - b);
  const th = hs.length ? hs[hs.length >> 1] : 20;
  // 화면 끝까지 가는 가로선(구분선 · 표 테두리)은 글줄이 아니다 — 폭의 60% 넘게 칠해진 1~3px 띠
  return _runs(rows, 1, () => Math.max(3, th * 0.25)).filter(r => r[1] - r[0] >= Math.max(6, th * 0.35) || rows.slice(r[0], r[1]).every(c => c < w * 0.6))
    .filter(r => r[1] - r[0] >= 6).map(r => ({ y0: r[0], y1: r[1] }));
}
function findClusters(m, w, line) {
  const cols = new Array(w).fill(0), lh = line.y1 - line.y0;
  for (let y = line.y0; y < line.y1; y++) for (let x = 0, o = y * w; x < w; x++) cols[x] += m[o + x];
  return _runs(cols, 1, () => Math.max(4, lh * 0.55)).filter(r => r[1] - r[0] >= 3).map(r => ({ x0: r[0], x1: r[1], cx: (r[0] + r[1]) / 2 }));
}

// ── 머리글 → 칸 위치 ──
// cells = [{ cx, text }] (한 줄). 회 칸(1회 …) · 타자 표 칸(타수 …) · 타순 · 타자명 · 포지션의 가운데 x
function readHeader(cells) {
  const cols = [], innX = [];
  cells.forEach(c => {
    const t = _norm(c.text);
    let m;
    if (/^타순$/.test(t)) cols.push({ key: 'order', cx: c.cx });
    else if (/^타자명?$|^자명$/.test(t)) cols.push({ key: 'name', cx: c.cx });
    else if (/^포지?션$/.test(t)) cols.push({ key: 'pos', cx: c.cx });
    else if ((m = /^(\d{1,2})[회외희호최]$/.exec(t))) innX.push({ n: +m[1], cx: c.cx });
    else if (STAT_HEAD[t]) cols.push({ key: STAT_HEAD[t], cx: c.cx });
  });
  // 회 칸은 같은 간격 — 못 읽은 회는 읽은 회들로 직선을 맞춰 채운다(1회 ~ 읽은 마지막 회)
  if (innX.length >= 2) {
    const n = innX.length, sx = innX.reduce((s, p) => s + p.n, 0), sy = innX.reduce((s, p) => s + p.cx, 0);
    const sxx = innX.reduce((s, p) => s + p.n * p.n, 0), sxy = innX.reduce((s, p) => s + p.n * p.cx, 0);
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n, last = Math.max(...innX.map(p => p.n));
    if (b > 0) for (let k = 1; k <= last; k++) cols.push({ key: 'inn' + k, cx: (innX.find(p => p.n === k) || { cx: a + b * k }).cx });
  } else innX.forEach(p => cols.push({ key: 'inn' + p.n, cx: p.cx }));
  const kind = cols.some(c => c.key.startsWith('inn')) ? 'inning' : cols.some(c => c.key === 'ab' || c.key === 'h') ? 'stats' : null;
  return kind && cols.some(c => c.key === 'name') ? { kind, cols: cols.sort((p, q) => p.cx - q.cx) } : null;
}

// 한 줄의 덩어리들을 칸 이름에 붙인다 — 가장 가까운 칸, 칸 간격의 60% 안쪽만. 같은 칸 덩어리는 이어 붙임
function assignRow(cells, cols) {
  const gaps = cols.slice(1).map((c, i) => c.cx - cols[i].cx).sort((a, b) => a - b), tol = (gaps.length ? gaps[gaps.length >> 1] : 100) * 0.6;
  const row = {};
  cells.forEach(c => {
    let best = null;
    cols.forEach(k => { const d = Math.abs(k.cx - c.cx); if (d <= tol && (!best || d < best.d)) best = { key: k.key, d }; });
    // 이름은 머리글보다 넓어 가운데가 어긋날 수 있다 — '(숫자)' 로 끝나면 이름 칸
    if (/\(\d+\)?$|\d\)$/.test(_norm(c.text))) best = { key: 'name' };
    if (best && _norm(c.text)) row[best.key] = (row[best.key] ? row[best.key] : '') + _norm(c.text);
  });
  return row;
}

// 읽은 한 장 → { kind, rows: [{ order, name, number, pos, inn: {1: '중플'}, stats: {ab…} }] }
function toRows(kind, lines) {
  const rows = [];
  lines.forEach(r => {
    const nm = NAME_RE.exec((r.name || '').replace(/[()]/g, m => m === '(' ? '(' : ')'));
    if (!nm || !nm[2]) return;
    const name = nm[1].replace(/[^가-힣A-Za-z]/g, '');
    const row = { order: /^\d{1,2}$/.test(r.order || '') ? +r.order : null, name, number: nm[2], pos: r.pos || '', inn: {}, stats: null };
    if (kind === 'inning') Object.keys(r).forEach(k => { if (k.startsWith('inn')) row.inn[+k.slice(3)] = r[k]; });
    else {
      row.stats = {};
      Object.keys(STAT_HEAD).forEach(h => { const k = STAT_HEAD[h], v = r[k]; row.stats[k] = v != null && /^\.?\d+(\.\d+)?$/.test(v) ? (k === 'avg' ? v : +v) : null; });
    }
    rows.push(row);
  });
  return rows;
}

// 여러 장을 합친다 — 같은 선수(타순 + 등번호)가 겹쳐 찍히면 한 번만. 타순 순서로(위아래로 나눠 찍은 장 순서와 상관없이)
function mergeShots(shots) {
  const inn = [], st = [], seen = { inning: {}, stats: {} };
  shots.forEach(s => s.rows.forEach(r => {
    const key = (r.order == null ? '' : r.order) + '|' + r.number;
    if (seen[s.kind][key]) { const o = seen[s.kind][key]; if (s.kind === 'inning') Object.keys(r.inn).forEach(k => { if (!o.inn[k]) o.inn[k] = r.inn[k]; }); return; }
    seen[s.kind][key] = r; (s.kind === 'inning' ? inn : st).push(r);
  }));
  const byOrder = (a, b) => (a.order == null ? 99 : a.order) - (b.order == null ? 99 : b.order);
  inn.sort(byOrder); st.sort(byOrder);
  // 타자 표 줄을 경기기록 줄에 붙인다(등번호 → 없으면 타순 + 이름)
  inn.forEach(r => { r.stats = (st.find(s => s.number === r.number && (s.order === r.order || s.name === r.name)) || {}).stats || null; });
  const lost = st.filter(s => !inn.some(r => r.stats === s.stats));
  return { rows: inn, statsOnly: lost };
}

// 붙여넣기 칸에 넣을 글 — 웹 복사와 같은 탭 구분 꼴: 타순 · 위치 · 이름(번호) · 1 … N회 · (타수 안타 타점 득점 도루 타율)
function toText(merged) {
  const n = Math.max(0, ...merged.rows.map(r => Math.max(0, ...Object.keys(r.inn).map(Number))));
  return merged.rows.map(r => {
    const cells = [r.order == null ? '' : String(r.order), POS_APP[r.pos] || '', `${r.name}(${r.number})`];
    for (let k = 1; k <= n; k++) cells.push(r.inn[k] || '');
    if (r.stats) ['ab', 'h', 'rbi', 'r', 'sb', 'avg'].forEach(k => cells.push(r.stats[k] == null ? '-' : String(r.stats[k])));
    return cells.join('\t');
  }).join('\n');
}

// 읽은 칸으로 센 타수 · 안타 · 사사구 · 삼진 ↔ 타자 표 — 다르면 그 선수 줄에 빠지거나 잘못 읽은 칸이 있다
function checkStats(merged) {
  const P = window.SLGameOne, out = [];
  if (!P) return out;
  merged.rows.forEach(r => {
    if (!r.stats) return;
    const line = ['', '', `${r.name}(${r.number})`].concat(Object.keys(r.inn).length ? Array.from({ length: Math.max(...Object.keys(r.inn).map(Number)) }, (_, i) => r.inn[i + 1] || '') : []).join('\t');
    const abs = ((P.parseGameOne(line).players[0] || {}).atBats || []).filter(a => a.result);
    const got = { ab: abs.filter(a => NOT_AB.indexOf(a.result) < 0).length, h: abs.filter(a => HITS.indexOf(a.result) >= 0).length,
      bb: abs.filter(a => a.result === '볼넷' || a.result === '사구').length, so: abs.filter(a => a.result === '삼진').length };
    const diff = ['ab', 'h', 'bb', 'so'].filter(k => r.stats[k] != null && r.stats[k] !== got[k]);
    if (diff.length) out.push({ order: r.order, name: r.name, number: r.number, diff: diff.map(k => ({ key: k, read: got[k], table: r.stats[k] })) });
  });
  return out;
}

// 타순이 1부터 이어지지 않으면 그 줄이 찍힌 장이 빠진 것 — 빠진 타순들
function orderGaps(rows) {
  const have = new Set(rows.map(r => r.order).filter(o => o != null)), max = Math.max(0, ...have), out = [];
  for (let k = 1; k < max; k++) if (!have.has(k)) out.push(k);
  return out;
}

// ── 한 장 읽기 (recognize = 덩어리 위치 → 글자) → { width, head, lines } ──
async function readShot(img, recognize, onLine) {
  const m = inkMask(img), lines = findLines(m, img.width, img.height), read = [], hs = [];
  let head = null;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i], cl = findClusters(m, img.width, L);
    if (onLine) onLine(i + 1, lines.length);
    if (!cl.length || cl.length > 24) continue;   // 글이 아닌 띠(사진 · 그래프)
    if (cl.length >= 2) hs.push(L.y1 - L.y0);
    const cells = [];
    for (const c of cl) cells.push({ cx: c.cx, text: await recognize(c.x0, L.y0, c.x1, L.y1) });
    const h = readHeader(cells);
    if (h) head = h; else read.push(cells);
  }
  // lh = 글줄 높이(가운데 값). 여러 장을 모아 찍은 화면 · 줄인 사진은 10px 안팎이라 못 읽는다 → 안내용
  hs.sort((a, b) => a - b);
  return { width: img.width, head, lines: read, lh: hs.length ? hs[hs.length >> 1] : 0 };
}
// 읽은 장 → { kind, rows }. 머리글 없는 장(아래로 내려 찍은 장)은 같은 폭 사진의 머리글을 쓴다 — 숫자 칸이 6개 이상인 줄이 있으면 타자 표
function placeShot(shot, heads) {
  let head = shot.head;
  if (!head) {
    const numeric = shot.lines.some(cells => cells.filter(c => /^[\d.]+$/.test(_norm(c.text))).length >= 6);
    const same = heads.filter(h => h.width === shot.width && h.head.kind === (numeric ? 'stats' : 'inning'));
    head = same.length ? same[0].head : null;
  }
  if (!head) return { kind: null, rows: [] };
  return { kind: head.kind, rows: toRows(head.kind, shot.lines.map(cells => assignRow(cells, head.cols))) };
}

// ── Tesseract (처음 한 번만 불러옴) ──
let _wP = null;
function _script(src) {
  return new Promise((ok, no) => {
    if (window.Tesseract) return ok();
    const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => ok(); s.onerror = () => no(new Error('글자 읽기 도구를 불러오지 못했습니다 — 인터넷 연결을 확인해 주세요'));
    document.head.appendChild(s);
  });
}
function _worker() {
  if (!_wP) {
    _wP = _script(TESS.src).then(() => {
      const o = { langPath: new URL(TESS.lang, location.href).href, gzip: false, cachePath: TESS.cache, logger: () => {} };
      if (TESS.workerPath) o.workerPath = TESS.workerPath;
      if (TESS.corePath) o.corePath = TESS.corePath;
      return window.Tesseract.createWorker('kor', 1, o);
    }).then(async w => { await w.setParameters({ tessedit_pageseg_mode: TESS.psm }); return w; });
    _wP.catch(() => { _wP = null; });
  }
  return _wP;
}
// 덩어리 하나를 흰 여백을 둔 작은 canvas 로 잘라 읽는다. 글자 높이가 작으면 40px 쯤으로 키운다
function _crop(src, x0, y0, x1, y1) {
  const lh = y1 - y0, pad = Math.round(lh * 0.35), k = lh < 30 ? 40 / lh : 1;
  const c = document.createElement('canvas'); c.width = Math.round((x1 - x0 + 2 * pad) * k); c.height = Math.round((lh + 2 * pad) * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, Math.max(0, x0 - pad), Math.max(0, y0 - pad), x1 - x0 + 2 * pad, lh + 2 * pad, 0, 0, c.width, c.height);
  return c;
}
async function _load(file) {
  const bmp = await (window.createImageBitmap ? createImageBitmap(file) : new Promise((ok, no) => {
    const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('사진을 열지 못했습니다')); im.src = URL.createObjectURL(file);
  }));
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  return { canvas: c, img: { width: c.width, height: c.height, data: d.data } };
}

// 사진 여러 장 → { text, rows, checks, statsOnly, shots, files } . 고른 순서는 상관없다(타순으로 줄 세움)
async function readFiles(files, onProgress) {
  const w = await _worker(), list = Array.from(files || []), read = [];
  let psm = TESS.psm;
  for (let i = 0; i < list.length; i++) {
    const { canvas, img } = await _load(list[i]);
    // '한 줄'(PSM 7)로 읽는다. 글자 하나 폭(숫자 한 개)인데 한 글자로 안 나오면(3 → 61) '한 단어'(8) · '한 글자'(10)로 다시
    const run = async (c, want) => {
      if (want !== psm) { await w.setParameters({ tessedit_pageseg_mode: want }); psm = want; }
      return (await w.recognize(c)).data.text;
    };
    const rec = async (x0, y0, x1, y1) => {
      const c = _crop(canvas, x0, y0, x1, y1);
      let t = await run(c, TESS.psm);
      if (x1 - x0 <= (y1 - y0) * 0.9 && _norm(t).length !== 1) {
        for (const p of ['8', '10']) { const u = await run(c, p); if (_norm(u).length === 1) { t = u; break; } }
      }
      return t;
    };
    read.push(await readShot(img, rec, (k, n) => onProgress && onProgress(i, list.length, k, n)));
  }
  const heads = read.filter(s => s.head), shots = read.map(s => placeShot(s, heads)).filter(s => s.kind);
  const merged = mergeShots(shots);
  const small = read.length > 0 && read.every(s => !s.head && s.lh > 0 && s.lh < 16);
  return { text: toText(merged), rows: merged.rows, statsOnly: merged.statsOnly, checks: checkStats(merged), gaps: orderGaps(merged.rows), small, shots: shots.length, files: list.length };
}

// ── 화면 ──
let _side = 'away';
function gameOneShotPick(side) {
  _side = side === 'home' ? 'home' : 'away';
  const f = $('goShotFile'); if (!f) return;
  f.value = ''; f.click();
}
function _msg(html, cls) { const el = $('goShotMsg'); if (el) { el.className = 'go-shot-msg' + (cls ? ' ' + cls : ''); el.innerHTML = html; } }
const _esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY_KO = { ab: '타수', h: '안타', bb: '사사구', so: '삼진' };

async function gameOneShotFiles(input) {
  const files = input && input.files ? Array.from(input.files) : [];
  if (!files.length) return;
  const label = _side === 'home' ? '홈' : '원정', t0 = Date.now(), btns = document.querySelectorAll('.go-shot-b');
  btns.forEach(b => { b.disabled = true; });
  _msg(`${label}팀 사진 ${files.length}장 읽는 중… 처음 한 번은 글자 읽기 도구(약 6MB)를 받느라 더 걸립니다`);
  try {
    const r = await api.readFiles(files, (i, n, k, m) => _msg(`${label}팀 사진 읽는 중… ${i + 1}/${n}장 · ${Math.round(100 * k / m)}%`));
    if (!r.rows.length) {
      // 왜 못 읽었는지: 타자 표만 골랐다 · 글자가 너무 작다(모아 찍은 화면 · 줄인 사진) · 머리글 있는 장이 없다
      const why = r.statsOnly.length ? 'stats_only' : r.small ? 'small' : 'no_header';
      _msg({
        stats_only: '「타자」 표(타수 · 안타 …)만 찾았습니다 — 회별 기록은 「경기기록」(1회 2회 …) 표에만 있어요. 그 표 사진도 같이 골라 주세요',
        small: '글자가 너무 작게 찍힌 사진입니다 — 여러 장을 모아 찍은 화면이나 줄인 사진 말고, 앱에서 가로로 찍은 원본 스크린샷을 골라 주세요',
        no_header: '표를 찾지 못했습니다 — 게임원 앱 › 박스 스코어 › 기록에서 「경기기록」(1회 2회 …) 표를 찍어 주세요. 첫 장에는 머리글(타순 · 타자명 · 1회 …)이 보여야 합니다',
      }[why], 'bad');
      _track('gameone_shot', { side: _side, files: files.length, rows: 0, why, ms: Date.now() - t0 });
      return;
    }
    const ta = $(_side === 'home' ? 'goHome' : 'goAway');
    ta.value = r.text;
    if (typeof window.gameOnePreview === 'function') window.gameOnePreview();
    const pa = r.rows.reduce((s, x) => s + Object.keys(x.inn).length, 0), withStats = r.rows.filter(x => x.stats).length;
    let h = `${label}팀 사진 ${r.files}장에서 <b>${r.rows.length}명 · ${pa}칸</b>을 읽어 ${label}팀 칸에 넣었습니다. <b>사진에서 읽은 글자는 틀릴 수 있어요</b> — 아래 미리보기를 앱 화면과 비교하고, 틀린 글자는 칸에서 바로 고친 뒤 저장하세요.`;
    if (withStats) h += r.checks.length
      ? `<div class="go-warn">타자 표와 다른 선수 ${r.checks.length}명 — 빠지거나 잘못 읽은 칸이 있을 수 있습니다:<br>` + r.checks.map(c => `${c.order || ''} ${_esc(c.name)}(${c.number}): ` + c.diff.map(d => `${KEY_KO[d.key]} 읽음 ${d.read} · 표 ${d.table}`).join(', ')).join('<br>') + '</div>'
      : `<div class="go-ok">타자 표의 타수 · 안타 · 사사구 · 삼진과 ${withStats}명 모두 맞습니다.</div>`;
    else h += '<div class="go-note">「타자」 표(타수 · 안타 …)도 같이 고르면 읽은 칸이 맞는지 숫자로 맞춰 봅니다.</div>';
    if (r.gaps.length) h += `<div class="go-warn">타순 ${r.gaps.join(' · ')}번 줄이 사진에 없습니다 — 그 줄이 찍힌 사진을 같이 골라 주세요</div>`;
    if (r.statsOnly.length) h += `<div class="go-warn">타자 표에는 있는데 경기기록에서 못 찾은 선수: ${r.statsOnly.map(s => _esc(s.name) + '(' + s.number + ')').join(' · ')} — 그 줄이 찍힌 사진을 더 골라 주세요</div>`;
    _msg(h, r.checks.length || r.statsOnly.length || r.gaps.length ? 'warn' : 'ok');
    _track('gameone_shot', { side: _side, files: r.files, rows: r.rows.length, pa, stats: withStats, mismatch: r.checks.length + r.statsOnly.length, gaps: r.gaps.length, ms: Date.now() - t0 });
  } catch (e) {
    _msg('읽지 못했습니다: ' + _esc(e && e.message || e) + ' — 다시 골라 주세요', 'bad');
    _track('gameone_shot', { side: _side, files: files.length, rows: -1, ms: Date.now() - t0 });
  } finally {
    btns.forEach(b => { b.disabled = false; });
  }
}

window.gameOneShotPick = gameOneShotPick;
window.gameOneShotFiles = gameOneShotFiles;
// 테스트는 api.readFiles 를 바꿔 끼워 화면만 확인한다(실제 Tesseract 는 CI 에서 못 받음)
const api = window.SLGameOneOcr = { TESS, inkMask, findLines, findClusters, readHeader, assignRow, toRows, mergeShots, toText, checkStats, orderGaps, readShot, placeShot, readFiles, POS_APP };
