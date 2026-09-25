// 분석 엑셀 — 선수 한 명의 기록을 차트가 들어간 .xlsx 로 내보낸다
//   타자: 리포트 · 타구 차트 · 투구 위치 · 핫콜드존 · 타석 기록 · 투구 기록
//   투수: 리포트 · 구종별 투구위치 · 코스 분포 · 타구 허용 · 투구 기록
// SheetJS 무료판은 차트·셀 서식을 쓰지 못해서, xlsx(OOXML)를 직접 만들고 무압축 ZIP으로 묶는다 (외부 라이브러리 없음).
// 차트는 '기록' 시트의 칸을 그대로 가리킨다 → 엑셀에서 필터(▼)로 행을 숨기면 차트도 남은 기록만 그린다 (피벗+슬라이서 대신).
import { HITS, PT_TYPES, PT_COLORS, ZONES_9, WOBA_W } from '../constants.js';
import { buildData, calcStats } from './batdata.js?v=5';

// ── 색 · 분류 ────────────────────────────────────────────────
const C = { navy: '14213D', blue: '4B8CF5', ink2: '6B7280', line: 'D9DEE7', soft: 'F4F6FA', aux: 'EEF1F6' };

// 타구 점: 분석 탭 스프레이 차트와 같은 색·모양 (아웃이 아래, 홈런이 맨 위)
const RES_GROUPS = [
  { k: 'out', label: '아웃', color: '9AA3B2', sym: 'circle', size: 6 },
  { k: '1b', label: '단타', color: '1FA98A', sym: 'circle', size: 7 },
  { k: 'xbh', label: '2·3루타', color: '8B6CF0', sym: 'square', size: 7 },
  { k: 'hr', label: '홈런', color: 'E0525A', sym: 'diamond', size: 9 },
];
const _resGroup = r => (r === '홈런' ? 'hr' : r === '2루타' || r === '3루타' ? 'xbh' : HITS.includes(r) ? '1b' : 'out');

const PT_EXTRA = ['E0525A', '14B8A6', 'EC4899', '84CC16', '0EA5E9', 'D97706', '64748B'];
function _ptColor(pt, i) {
  const k = PT_TYPES.indexOf(pt);
  if (k >= 0) return PT_COLORS[k].slice(1).toUpperCase();
  if (pt === '미기록') return 'B8C0CC';
  return PT_EXTRA[i % PT_EXTRA.length];
}
// 흰 바탕에서 옅은 색(노랑 등)도 보이도록 점 테두리는 한 단계 어둡게
const _dark = hex => hex.match(/../g).map(h => Math.round(parseInt(h, 16) * 0.72).toString(16).padStart(2, '0')).join('').toUpperCase();

// 투구 존: 기록 화면 캔버스와 같은 비율 (왼쪽 = 내각, 위 = 높음)
const ZX1 = 0.22, ZX2 = 0.78, ZY1 = 0.15, ZY2 = 0.85;
const ZONE_BALL = ['볼 위', '볼 아래', '볼 내', '볼 외'];
const ZONES_13 = [...ZONES_9, ...ZONE_BALL];
const PT_HIT = ['안타', '2루타', '3루타', '홈런', '타격됨'];   // 투구 결과 중 피안타 (투수 탭과 같은 기준)
const PT_BALL = ['볼', '볼넷'];

function _zoneBox(z) {
  const cw = (ZX2 - ZX1) / 3, ch = (ZY2 - ZY1) / 3;
  const i = ZONES_9.indexOf(z);
  if (i >= 0) {
    const c = i % 3, r = Math.floor(i / 3);
    return { cx: ZX1 + cw * (c + 0.5), cy: ZY1 + ch * (r + 0.5), rx: cw * 0.36, ry: ch * 0.36 };
  }
  if (z === '볼 위') return { cx: 0.5, cy: ZY1 / 2, rx: 0.24, ry: 0.045 };
  if (z === '볼 아래') return { cx: 0.5, cy: (1 + ZY2) / 2, rx: 0.24, ry: 0.045 };
  if (z === '볼 내') return { cx: ZX1 / 2, cy: 0.5, rx: 0.07, ry: 0.28 };
  if (z === '볼 외') return { cx: (1 + ZX2) / 2, cy: 0.5, rx: 0.07, ry: 0.28 };
  return null;
}
// 정확한 위치 없이 코스(칸)만 기록된 공은 그 칸 안에 흩어 찍는다 — 같은 기록이면 매번 같은 자리
function _rand(seed) {
  let t = (seed * 2654435761) >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
// 공 하나의 차트 좌표 { x, y (위가 +), exact }
function _pitchXY(x, y, zone, seed) {
  if (x != null && y != null && isFinite(x) && isFinite(y)) return { x: +x, y: 1 - y, exact: true };
  const b = _zoneBox(zone);
  if (!b) return null;
  const rnd = _rand(seed + 1);
  return { x: b.cx + (rnd() * 2 - 1) * b.rx, y: 1 - (b.cy + (rnd() * 2 - 1) * b.ry), exact: false };
}

// ── XML · 셀 주소 ────────────────────────────────────────────
const xe = s => String(s == null ? '' : s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function colL(c) {
  let s = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}
const cref = (r, c) => colL(c) + (r + 1);
const qs = name => `'${String(name).replace(/'/g, "''")}'`;
const r4 = v => Math.round(v * 10000) / 10000;

// ── 셀 서식 ──────────────────────────────────────────────────
const HOT = ['2F5FD0', '7FA3EC', 'C9D8F7', 'F2F2F2', 'F7C9C4', 'EE8579', 'D23B2E'];   // 콜드 → 핫
const SEQ = ['F2F2F2', 'DCE7FB', 'B7CEF7', '86ADF1', '4B8CF5', '2459C7'];              // 적음 → 많음
const _zoneStyle = (fill, dark) => ({ font: { b: 1, sz: 10, color: dark ? 'FFFFFF' : '1F2937' }, fill, border: 2, align: 'center', wrap: 1 });
const STYLE_DEFS = {
  base: {},
  title: { font: { b: 1, sz: 16, color: C.navy } },
  sub: { font: { sz: 10, color: C.ink2 } },
  brand: { font: { b: 1, sz: 9, color: C.blue } },
  sec: { font: { b: 1, sz: 12, color: C.navy } },
  note: { font: { sz: 9, color: C.ink2 } },
  bullet: { font: { sz: 10, color: '1F2937' } },
  th: { font: { b: 1, sz: 10, color: 'FFFFFF' }, fill: C.navy, border: 1, align: 'center', wrap: 1 },
  thAux: { font: { b: 1, sz: 9, color: C.ink2 }, fill: C.aux, border: 1, align: 'center', wrap: 1 },
  td: { border: 1, align: 'center' },
  tdL: { border: 1, align: 'left' },
  tdB: { font: { b: 1 }, border: 1, align: 'left' },
  td3: { border: 1, align: 'center', fmt: '.000' },
  tdP: { border: 1, align: 'center', fmt: '0.0%' },
  td1: { border: 1, align: 'center', fmt: '0.0' },
  tdC: { font: { sz: 9, color: C.ink2 }, border: 1, align: 'center', fmt: '0.000' },
  kpi3: { font: { b: 1, sz: 18, color: C.navy }, fill: C.soft, align: 'center', fmt: '.000' },
  kpiP: { font: { b: 1, sz: 18, color: C.navy }, fill: C.soft, align: 'center', fmt: '0.0%' },
  kpiI: { font: { b: 1, sz: 18, color: C.navy }, fill: C.soft, align: 'center', fmt: '0' },
  kpi1: { font: { b: 1, sz: 18, color: C.navy }, fill: C.soft, align: 'center', fmt: '0.0' },
  kpiL: { font: { sz: 9, color: C.ink2 }, fill: C.soft, align: 'center' },
  axis: { font: { b: 1, sz: 9, color: C.ink2 }, align: 'center' },
  zna: _zoneStyle('FFFFFF', 0),
};
HOT.forEach((f, i) => { STYLE_DEFS['h' + i] = _zoneStyle(f, i === 0 || i === 6); });
SEQ.forEach((f, i) => { STYLE_DEFS['q' + i] = _zoneStyle(f, i >= 4); });

function _stylesXml() {
  const fonts = [], fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const fmts = {};
  const idx = {};
  const fontXml = f => `<font>${f.b ? '<b/>' : ''}${f.i ? '<i/>' : ''}<sz val="${f.sz || 10}"/><color rgb="FF${f.color || '1F2937'}"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font>`;
  const add = (list, x) => { let i = list.indexOf(x); if (i < 0) { list.push(x); i = list.length - 1; } return i; };
  const bline = c => `<left style="thin"><color rgb="FF${c}"/></left><right style="thin"><color rgb="FF${c}"/></right><top style="thin"><color rgb="FF${c}"/></top><bottom style="thin"><color rgb="FF${c}"/></bottom><diagonal/>`;
  add(fonts, fontXml({}));
  const xfs = Object.keys(STYLE_DEFS).map((name, i) => {
    const d = STYLE_DEFS[name];
    idx[name] = i;
    const fontId = add(fonts, fontXml(d.font || {}));
    const fillId = d.fill ? add(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${d.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const borderId = d.border ? add(borders, `<border>${bline(d.border === 2 ? 'FFFFFF' : C.line)}</border>`) : 0;
    let numFmtId = 0;
    if (d.fmt) numFmtId = fmts[d.fmt] || (fmts[d.fmt] = 164 + Object.keys(fmts).length);
    const al = d.align || d.wrap ? `<alignment${d.align ? ` horizontal="${d.align}"` : ''} vertical="center"${d.wrap ? ' wrapText="1"' : ''}/>` : '';
    return `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}${borderId ? ' applyBorder="1"' : ''}${al ? ' applyAlignment="1">' + al + '</xf>' : '/>'}`;
  });
  const nf = Object.keys(fmts);
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${nf.length ? `<numFmts count="${nf.length}">${nf.map(f => `<numFmt numFmtId="${fmts[f]}" formatCode="${xe(f)}"/>`).join('')}</numFmts>` : ''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return { xml, idx };
}
const { xml: STYLES_XML, idx: S } = _stylesXml();

// ── 시트 ─────────────────────────────────────────────────────
class Sheet {
  constructor(name) {
    this.name = name;
    this.rows = new Map();   // r → Map(c → { v, s })
    this.cols = {};          // c → 너비(글자 수)
    this.hts = {};           // r → 높이(pt)
    this.merges = [];
    this.charts = [];        // { spec, r, c }
    this.images = [];        // { img: { bytes, w, h }, r, c } — PNG 그림
    this.freeze = 0;         // 고정할 위쪽 행 수
    this.filter = null;      // [r0, c0, r1, c1]
    this.print = 'portrait'; // 차트 시트는 한 장에 맞춰 인쇄
  }
  set(r, c, v, s) {
    if (!this.rows.has(r)) this.rows.set(r, new Map());
    this.rows.get(r).set(c, { v, s: s == null ? 0 : S[s] });
    return this;
  }
  line(r, c0, vals, s) {
    vals.forEach((v, i) => this.set(r, c0 + i, v, Array.isArray(s) ? s[i] : s));
    return this;
  }
  merge(r0, c0, r1, c1, v, s) {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(r, c, r === r0 && c === c0 ? v : null, s);
    if (r1 > r0 || c1 > c0) this.merges.push(cref(r0, c0) + ':' + cref(r1, c1));
    return this;
  }
  width(c, w) { this.cols[c] = w; return this; }
  height(r, h) { this.hts[r] = h; return this; }
  chart(spec, r, c) { this.charts.push({ spec, r, c }); return this; }
  image(img, r, c) { this.images.push({ img, r, c }); return this; }
  // 세로 한 줄(머리글 + 값) — 차트가 가리킬 범위를 돌려준다
  column(r0, c, header, vals, hs, ds) {
    this.set(r0, c, header, hs);
    vals.forEach((v, i) => { if (v != null && isFinite(v)) this.set(r0 + 1 + i, c, r4(v), ds); });
    return { ref: `${qs(this.name)}!$${colL(c)}$${r0 + 2}:$${colL(c)}$${r0 + 1 + Math.max(1, vals.length)}`, vals };
  }
  xml(drawingRid) {
    const rs = [...this.rows.keys()].sort((a, b) => a - b);
    const body = rs.map(r => {
      const cells = this.rows.get(r);
      const cs = [...cells.keys()].sort((a, b) => a - b).map(c => {
        const { v, s } = cells.get(c);
        const a = `r="${cref(r, c)}"${s ? ` s="${s}"` : ''}`;
        if (typeof v === 'number') return isFinite(v) ? `<c ${a}><v>${v}</v></c>` : `<c ${a}/>`;
        if (v == null || v === '') return `<c ${a}/>`;
        return `<c ${a} t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
      }).join('');
      const h = this.hts[r];
      return `<row r="${r + 1}"${h ? ` ht="${h}" customHeight="1"` : ''}>${cs}</row>`;
    }).join('');
    const cols = Object.keys(this.cols).map(Number).sort((a, b) => a - b)
      .map(c => `<col min="${c + 1}" max="${c + 1}" width="${this.cols[c]}" customWidth="1"/>`).join('');
    const pane = this.freeze ? `<pane ySplit="${this.freeze}" topLeftCell="A${this.freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${this.freeze + 1}" sqref="A${this.freeze + 1}"/>` : '';
    const fit = this.print !== 'data';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${fit ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : ''}<sheetViews><sheetView workbookViewId="0"${this.print === 'data' ? '' : ' showGridLines="0"'}${this.first ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="16.5"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${body}</sheetData>${this.filter ? `<autoFilter ref="${cref(this.filter[0], this.filter[1])}:${cref(this.filter[2], this.filter[3])}"/>` : ''}${this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${this.print === 'landscape' ? 'landscape' : 'portrait'}"${fit ? ' fitToWidth="1" fitToHeight="1"' : ''}/>${drawingRid ? `<drawing r:id="${drawingRid}"/>` : ''}</worksheet>`;
  }
}

// ── 차트 XML ─────────────────────────────────────────────────
const EMU = 9525;   // px → EMU
const _txt = (sz, b, color) => `<a:defRPr sz="${sz}"${b ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/></a:defRPr>`;
const _txPr = (sz, b, color) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${_txt(sz, b, color)}</a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr>`;
function _title(t) {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${_txt(1200, 1, C.navy)}</a:pPr><a:r><a:rPr lang="ko-KR" sz="1200" b="1"><a:solidFill><a:srgbClr val="${C.navy}"/></a:solidFill><a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/></a:rPr><a:t>${xe(t)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
}
function _numRef(d) {
  const pts = d.vals.map((v, i) => (v != null && isFinite(v) ? `<c:pt idx="${i}"><c:v>${r4(v)}</c:v></c:pt>` : '')).join('');
  return `<c:numRef><c:f>${xe(d.ref)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${Math.max(1, d.vals.length)}"/>${pts}</c:numCache></c:numRef>`;
}
function _strRef(d) {
  const pts = d.vals.map((v, i) => `<c:pt idx="${i}"><c:v>${xe(v)}</c:v></c:pt>`).join('');
  return `<c:strRef><c:f>${xe(d.ref)}</c:f><c:strCache><c:ptCount val="${d.vals.length}"/>${pts}</c:strCache></c:strRef>`;
}
function _layout(x, y, w, h) {
  return `<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="${r4(x)}"/><c:y val="${r4(y)}"/><c:w val="${r4(w)}"/><c:h val="${r4(h)}"/></c:manualLayout></c:layout>`;
}
function _valAx(id, cross, pos, min, max, del, fmt) {
  const sc = `<c:scaling><c:orientation val="minMax"/>${max != null ? `<c:max val="${r4(max)}"/>` : ''}${min != null ? `<c:min val="${r4(min)}"/>` : ''}</c:scaling>`;
  return `<c:valAx><c:axId val="${id}"/>${sc}<c:delete val="${del ? 1 : 0}"/><c:axPos val="${pos}"/><c:numFmt formatCode="${fmt || 'General'}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>`;
}
const _frame = `<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:ln></c:spPr>${_txPr(900, 0, '374151')}`;
const _head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/>';

// 산점도: series = [{ name, x:{ref,vals}, y:{ref,vals}, kind:'dot'|'line', color, sym, size, width, legend }]
function _scatterXml(sp) {
  const W = sp.w, H = sp.h;
  const hasLegend = sp.series.some(s => s.legend !== false);
  const top = sp.title ? 40 : 12, bottom = 14, left = 14, right = hasLegend ? 104 : 14;
  const bw = W - left - right, bh = H - top - bottom;
  let [x0, x1] = sp.x, [y0, y1] = sp.y;
  // 가로·세로 1단위가 같은 길이가 되도록 범위를 넓힌다 (경기장·존이 찌그러지지 않게)
  const k = Math.max((x1 - x0) / bw, (y1 - y0) / bh);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  x0 = cx - k * bw / 2; x1 = cx + k * bw / 2; y0 = cy - k * bh / 2; y1 = cy + k * bh / 2;

  const sers = sp.series.map((s, i) => {
    const line = s.kind === 'line';
    const spPr = line
      ? `<c:spPr><a:ln w="${Math.round((s.width || 1.25) * 12700)}" cap="rnd"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>`
      : `<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="${s.sym || 'circle'}"/><c:size val="${s.size || 6}"/><c:spPr><a:solidFill><a:srgbClr val="${s.color}"><a:alpha val="85000"/></a:srgbClr></a:solidFill><a:ln w="6350"><a:solidFill><a:srgbClr val="${_dark(s.color)}"/></a:solidFill></a:ln></c:spPr></c:marker>`;
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${xe(s.name)}</c:v></c:tx>${spPr}<c:xVal>${_numRef(s.x)}</c:xVal><c:yVal>${_numRef(s.y)}</c:yVal><c:smooth val="0"/></c:ser>`;
  }).join('');
  const hidden = sp.series.map((s, i) => (s.legend === false ? `<c:legendEntry><c:idx val="${i}"/><c:delete val="1"/></c:legendEntry>` : '')).join('');
  const legend = hasLegend ? `<c:legend><c:legendPos val="r"/>${hidden}<c:overlay val="0"/>${_txPr(900, 0, '374151')}</c:legend>` : '';
  return `${_head}<c:chart>${sp.title ? _title(sp.title) : '<c:autoTitleDeleted val="1"/>'}<c:plotArea>${_layout(left / W, top / H, bw / W, bh / H)}<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${sers}<c:axId val="5001"/><c:axId val="5002"/></c:scatterChart>${_valAx(5001, 5002, 'b', x0, x1, 1)}${_valAx(5002, 5001, 'l', y0, y1, 1)}<c:spPr><a:solidFill><a:srgbClr val="${sp.bg || 'FFFFFF'}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>${_frame}</c:chartSpace>`;
}

// 가로 막대: cats {ref, vals(문자)}, vals {ref, vals(숫자)}, colors[]
function _barXml(sp) {
  const dpt = (sp.colors || []).map((c, i) => `<c:dPt><c:idx val="${i}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${c}"/></a:solidFill></c:spPr></c:dPt>`).join('');
  const lbl = `<c:dLbls><c:numFmt formatCode="${xe(sp.fmt || '0.0%')}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${_txPr(900, 1, '374151')}<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`;
  const max = Math.max(...sp.vals.vals.filter(v => isFinite(v)), 0.01) * 1.25;
  return `${_head}<c:chart>${_title(sp.title)}<c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${xe(sp.name || '')}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${C.blue}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>${dpt}${lbl}<c:cat>${_strRef(sp.cats)}</c:cat><c:val>${_numRef(sp.vals)}</c:val></c:ser><c:gapWidth val="55"/><c:axId val="6001"/><c:axId val="6002"/></c:barChart><c:catAx><c:axId val="6001"/><c:scaling><c:orientation val="maxMin"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="${C.line}"/></a:solidFill></a:ln></c:spPr>${_txPr(1000, 1, '1F2937')}<c:crossAx val="6002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx><c:valAx><c:axId val="6002"/><c:scaling><c:orientation val="minMax"/><c:max val="${r4(max)}"/><c:min val="0"/></c:scaling><c:delete val="1"/><c:axPos val="t"/><c:numFmt formatCode="0%" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="6001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>${_frame}</c:chartSpace>`;
}

// ── 통합 문서 · ZIP ──────────────────────────────────────────
function _workbookFiles(sheets) {
  const files = [];
  const ov = [];
  let chartN = 0, imageN = 0;
  sheets[0].first = true;
  sheets.forEach((sh, i) => {
    const n = i + 1;
    let rid = null;
    if (sh.charts.length || sh.images.length) {
      rid = 'rId1';
      files.push([`xl/worksheets/_rels/sheet${n}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/></Relationships>`]);
      const anchors = [], rels = [];
      sh.charts.forEach((ch, j) => {
        chartN++;
        const xml = ch.spec.type === 'bar' ? _barXml(ch.spec) : _scatterXml(ch.spec);
        files.push([`xl/charts/chart${chartN}.xml`, xml]);
        ov.push(`<Override PartName="/xl/charts/chart${chartN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
        rels.push(`<Relationship Id="rId${j + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartN}.xml"/>`);
        anchors.push(`<xdr:oneCellAnchor><xdr:from><xdr:col>${ch.c}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ch.r}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${ch.spec.w * EMU}" cy="${ch.spec.h * EMU}"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${j + 2}" name="차트 ${j + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId${j + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`);
      });
      sh.images.forEach((im, k) => {
        imageN++;
        const rId = `rId${sh.charts.length + k + 1}`;
        const cx = im.img.w * EMU, cy = im.img.h * EMU;
        files.push([`xl/media/image${imageN}.png`, im.img.bytes]);
        rels.push(`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${imageN}.png"/>`);
        anchors.push(`<xdr:oneCellAnchor><xdr:from><xdr:col>${im.c}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${im.r}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${100 + k}" name="그림 ${k + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`);
      });
      files.push([`xl/drawings/drawing${n}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors.join('')}</xdr:wsDr>`]);
      files.push([`xl/drawings/_rels/drawing${n}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`]);
      ov.push(`<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
    }
    files.push([`xl/worksheets/sheet${n}.xml`, sh.xml(rid)]);
    ov.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  });
  const names = sheets.map((sh, i) => (sh.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${qs(sh.name)}!$${colL(sh.filter[1])}$${sh.filter[0] + 1}:$${colL(sh.filter[3])}$${sh.filter[2] + 1}</definedName>` : '')).join('');
  files.push(['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((sh, i) => `<sheet name="${xe(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${names ? `<definedNames>${names}</definedNames>` : ''}</workbook>`]);
  files.push(['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((sh, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  files.push(['xl/styles.xml', STYLES_XML]);
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  files.push(['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>SprayLab</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`]);
  files.push(['docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SprayLab</Application></Properties>`]);
  files.push(['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`]);
  files.unshift(['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${ov.join('')}</Types>`]);
  return files;
}

const _crcT = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function _crc(b) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = _crcT[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// 무압축(STORE) ZIP — 아마추어 기록 규모면 파일이 작아서 압축 없이도 충분 (내용 = 글자 또는 Uint8Array)
function _zip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let off = 0;
  files.forEach(([name, text]) => {
    const nb = enc.encode(name), db = typeof text === 'string' ? enc.encode(text) : text, crc = _crc(db);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, db.length, true); lh.setUint32(22, db.length, true);
    lh.setUint16(26, nb.length, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, db.length, true); ch.setUint32(24, db.length, true);
    ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
    parts.push(lh, nb, db);
    central.push(ch, nb);
    off += 30 + nb.length + db.length;
  });
  const size = central.reduce((s, b) => s + b.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function buildXlsx(sheets) { return _zip(_workbookFiles(sheets)); }

function _save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 3000);
}
const _today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const _fileName = (name, kind) => `SprayLab_${String(name).replace(/[\\/:*?"<>|\s]+/g, '_')}_${kind}_${_today().replace(/-/g, '')}.xlsx`;
const _toast = msg => { if (typeof window.showToast === 'function') window.showToast(msg, false); };

// ── 공용 조각 ─────────────────────────────────────────────────
// 경기장 윤곽 (파울라인 · 펜스 / 내야 다이아몬드 · 잔디 경계) — 기록 탭 필드와 같은 좌표 변환
function _fieldOutline() {
  const fp = window._fieldPos;
  const AS = window.AS || {};
  const st = (window.STADIUMS || {})[AS.stadium] || (window.STADIUMS || {}).standard || { cfDist: 120, lfDist: 90, rfDist: 90 };
  const at = (deg, dist) => {
    const ang = Math.max(0.5, Math.min(179.5, deg)) * Math.PI / 180 - Math.PI;
    const p = fp({ x: 0.5 + Math.cos(ang) * dist, y: 1 + Math.sin(ang) * dist });
    return [p[0], 1 - p[1]];
  };
  const arc = dist => { const o = []; for (let d = 0; d <= 180; d += 3) o.push(at(d, dist)); return o; };
  const home = at(90, 0);
  const b1 = at(180, 0.97 * 27.43 / st.rfDist), b2 = at(90, 0.97 * 38.8 / st.cfDist), b3 = at(0, 0.97 * 27.43 / st.lfDist);
  // null = 선 끊기 (차트는 빈 칸에서 선을 끊는다)
  const field = [at(0, 0.97), home, at(180, 0.97), null, ...arc(0.97)];
  const infield = [home, b1, b2, b3, home, null, ...arc(0.42)];
  return { field, infield };
}
// 경기장 윤곽의 세로 범위 (+여백)
function _fieldRange(lines) {
  const ys = [...lines.field.y.vals, ...lines.infield.y.vals].filter(v => v != null);
  return [Math.min(...ys) - 0.03, Math.max(...ys) + 0.03];
}
// 스트라이크존 테두리 + 3×3 칸 선
function _zoneOutline() {
  const y = v => 1 - v;
  const cw = (ZX2 - ZX1) / 3, ch = (ZY2 - ZY1) / 3;
  const box = [[ZX1, y(ZY1)], [ZX2, y(ZY1)], [ZX2, y(ZY2)], [ZX1, y(ZY2)], [ZX1, y(ZY1)]];
  const grid = [
    [ZX1 + cw, y(ZY1)], [ZX1 + cw, y(ZY2)], null, [ZX1 + 2 * cw, y(ZY1)], [ZX1 + 2 * cw, y(ZY2)], null,
    [ZX1, y(ZY1 + ch)], [ZX2, y(ZY1 + ch)], null, [ZX1, y(ZY1 + 2 * ch)], [ZX2, y(ZY1 + 2 * ch)],
  ];
  return { box, grid };
}
// '차트 배경' 시트에 윤곽 좌표를 적고 선 계열을 돌려준다 (필터에 영향받지 않도록 기록 시트와 분리)
function _outlineSheet(kinds) {
  const sh = new Sheet('차트 배경');
  sh.set(0, 0, '차트 배경 좌표 — 경기장 윤곽·스트라이크존 선 (수정하지 마세요)', 'note');
  const out = {};
  let c = 0;
  const put = (key, label, pts, color, width) => {
    const xs = pts.map(p => (p ? p[0] : null)), ys = pts.map(p => (p ? p[1] : null));
    const x = sh.column(1, c, label + ' X', xs, 'thAux', 'tdC');
    const y = sh.column(1, c + 1, label + ' Y', ys, 'thAux', 'tdC');
    sh.width(c, 11).width(c + 1, 11);
    out[key] = { name: label, x, y, kind: 'line', color, width, legend: false };
    c += 2;
  };
  if (kinds.includes('field') && window._fieldPos) {
    const f = _fieldOutline();
    put('field', '경기장', f.field, '6B8F5E', 1.5);
    put('infield', '내야', f.infield, 'C9A66B', 1);
  }
  if (kinds.includes('zone')) {
    const z = _zoneOutline();
    put('zgrid', '존 칸', z.grid, 'B8C2D6', 0.75);
    put('zbox', '스트라이크존', z.box, C.navy, 1.75);
  }
  sh.print = 'data';
  return { sheet: sh, lines: out };
}

// 제목 3줄 (제목 · 부제 · 브랜드)
function _header(sh, title, sub, lastCol) {
  sh.merge(0, 0, 0, lastCol, title, 'title').height(0, 28);
  sh.merge(1, 0, 1, lastCol, sub, 'sub');
  sh.merge(2, 0, 2, lastCol, 'SprayLab · YOUR SWING, VISUALIZED', 'brand');
}
// 표: headers + rows(배열) + 열별 서식
function _table(sh, r, c, headers, rows, styles) {
  sh.line(r, c, headers, 'th');
  rows.forEach((row, i) => sh.line(r + 1 + i, c, row, styles));
  return r + 1 + rows.length;
}
function _bullets(sh, r, c, items) {
  items.forEach((t, i) => sh.set(r + i, c, '• ' + t, 'bullet'));
  return r + items.length;
}
// KPI 타일: [label, value, style] — 타일 하나 = 2칸
function _kpis(sh, r, c, tiles) {
  tiles.forEach(([label, v, st], i) => {
    sh.merge(r, c + i * 2, r, c + i * 2 + 1, v, st);
    sh.merge(r + 1, c + i * 2, r + 1, c + i * 2 + 1, label, 'kpiL');
  });
  sh.height(r, 34).height(r + 1, 18);
}

// 13칸 코스 그리드 (위: 볼 위 / 가운데: 볼 내 · 9칸 · 볼 외 / 아래: 볼 아래)
// cell(z) → { text, style }
function _zoneGrid(sh, r, c, cell) {
  sh.line(r, c + 1, ['내각', '중앙', '외각'], 'axis');
  const put = (rr, cc, z, r1, c1) => {
    const x = cell(z);
    sh.merge(rr, cc, r1 == null ? rr : r1, c1 == null ? cc : c1, x.text, x.style);
  };
  put(r + 1, c + 1, '볼 위', r + 1, c + 3);
  put(r + 2, c, '볼 내', r + 4, c);
  ZONES_9.forEach((z, i) => put(r + 2 + Math.floor(i / 3), c + 1 + (i % 3), z));
  put(r + 2, c + 4, '볼 외', r + 4, c + 4);
  put(r + 5, c + 1, '볼 아래', r + 5, c + 3);
  for (let i = 0; i <= 4; i++) sh.width(c + i, 15);
  sh.height(r + 1, 40).height(r + 5, 40);
  for (let i = 2; i <= 4; i++) sh.height(r + i, 58);
  return r + 6;
}
// ── 스트라이크존 그림 (PNG) ──────────────────────────────────
// 9칸 + 바깥 볼 4칸(위·아래·안·밖)을 색칠한 그림. 엑셀 셀이 아니라 차트처럼 보이도록 캔버스로 그려 넣는다
const MIN_ZONE_AB = 3;   // 핫/콜드 색칠 최소 타수 (스카우트 탭 코스 칸과 같은 값)
const HC_LO = [75, 140, 245], HC_MID = [242, 242, 242], HC_HI = [224, 82, 90];   // Signal Blue → 회색 → Hit Red
const SQ_LO = [242, 242, 242], SQ_HI = [36, 89, 199];
const _mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
// 스카우트 탭 _zoneColor와 같은 계산 (흰 바탕용 가운데 색만 밝게)
function _hotCold(avg, base) {
  const t = Math.max(-1, Math.min(1, (avg - base) / Math.max(0.15, base)));
  return _mix(HC_MID, t < 0 ? HC_LO : HC_HI, Math.abs(t));
}
const ZW = 454, ZH = 522;
// cell(z) → { fill: [r,g,b] | null, main, sub }, key = { lo, hi, loInk, hiInk, stops, notes }
// 캔버스를 못 쓰는 환경이면 null
function _zonePng(cell, key) {
  let cv = null;
  try { cv = document.createElement('canvas'); } catch (e) { return null; }
  const ctx = cv && typeof cv.getContext === 'function' ? cv.getContext('2d') : null;
  if (!ctx || typeof cv.toDataURL !== 'function') return null;
  const K = 2;   // 2배로 그려서 확대해도 선명하게
  cv.width = ZW * K; cv.height = ZH * K;
  ctx.scale(K, K);
  const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const font = (w, px) => `${w} ${px}px ${FONT}`;
  const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  const ink = c => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] < 150 ? '#FFFFFF' : '#1F2937');
  const L = 86, T = 100, CW = 94, CH = 96, G = 6, SIDE = 62, BAND = 50;
  const R = L + 3 * CW, B = T + 3 * CH;

  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, ZW, ZH);
  ctx.strokeStyle = '#' + C.line; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, ZW - 1, ZH - 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = font(700, 11); ctx.fillStyle = '#6B7280';
  ['내각', '중앙', '외각'].forEach((t, i) => ctx.fillText(t, L + CW * (i + 0.5), 26));

  // mode: in = 9칸 · h = 위/아래 띠(한 줄) · v = 양옆 띠(세로로 쌓기)
  const paint = (x, y, w, h, z, mode) => {
    const c = cell(z);
    ctx.fillStyle = c.fill ? hex(c.fill) : '#FFFFFF';
    ctx.fillRect(x, y, w, h);
    if (mode !== 'in') { ctx.strokeStyle = '#' + C.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
    const main = c.fill ? ink(c.fill) : '#374151', sub = c.fill ? ink(c.fill) : '#9AA3B2';
    const cx = x + w / 2, cy = y + h / 2;
    if (mode === 'in') {
      ctx.font = font(800, 20); ctx.fillStyle = main; ctx.fillText(c.main, cx, cy - 9);
      ctx.font = font(400, 11); ctx.fillStyle = sub; ctx.fillText(c.sub, cx, cy + 15);
    } else if (mode === 'h') {
      ctx.font = font(700, 11); ctx.fillStyle = sub; ctx.fillText(z, cx - 96, cy);
      ctx.font = font(800, 17); ctx.fillStyle = main; ctx.fillText(c.main, cx, cy);
      ctx.font = font(400, 11); ctx.fillStyle = sub; ctx.fillText(c.sub, cx + 92, cy);
    } else {
      const subs = String(c.sub).split(' · ');
      const top = cy - 12 - subs.length * 7;
      ctx.font = font(700, 11); ctx.fillStyle = sub; ctx.fillText(z, cx, top);
      ctx.font = font(800, 16); ctx.fillStyle = main; ctx.fillText(c.main, cx, top + 24);
      ctx.font = font(400, 10); ctx.fillStyle = sub;
      subs.forEach((t, i) => ctx.fillText(t, cx, top + 44 + i * 14));
    }
  };
  paint(L, T - G - BAND, 3 * CW, BAND, '볼 위', 'h');
  paint(L, B + G, 3 * CW, BAND, '볼 아래', 'h');
  paint(L - G - SIDE, T, SIDE, 3 * CH, '볼 내', 'v');
  paint(R + G, T, SIDE, 3 * CH, '볼 외', 'v');
  ZONES_9.forEach((z, i) => paint(L + CW * (i % 3), T + CH * Math.floor(i / 3), CW, CH, z, 'in'));
  // 칸 구분선(흰색) + 스트라이크존 테두리(Navy)
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
  ctx.beginPath();
  [1, 2].forEach(k => { ctx.moveTo(L + CW * k, T); ctx.lineTo(L + CW * k, B); ctx.moveTo(L, T + CH * k); ctx.lineTo(R, T + CH * k); });
  ctx.stroke();
  ctx.strokeStyle = '#B8C2D6'; ctx.lineWidth = 0.75;
  ctx.beginPath();
  [1, 2].forEach(k => { ctx.moveTo(L + CW * k, T); ctx.lineTo(L + CW * k, B); ctx.moveTo(L, T + CH * k); ctx.lineTo(R, T + CH * k); });
  ctx.stroke();
  ctx.strokeStyle = '#' + C.navy; ctx.lineWidth = 3;
  ctx.strokeRect(L, T, 3 * CW, 3 * CH);

  // 범례
  const gx = ZW / 2 - 80, gy = 466, gw = 160, gh = 10;
  const grd = ctx.createLinearGradient(gx, 0, gx + gw, 0);
  key.stops.forEach(([t, c]) => grd.addColorStop(t, hex(c)));
  ctx.fillStyle = grd; ctx.fillRect(gx, gy, gw, gh);
  ctx.strokeStyle = '#' + C.line; ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
  ctx.font = font(700, 11);
  ctx.textAlign = 'right'; ctx.fillStyle = key.loInk; ctx.fillText(key.lo, gx - 8, gy + gh / 2);
  ctx.textAlign = 'left'; ctx.fillStyle = key.hiInk; ctx.fillText(key.hi, gx + gw + 8, gy + gh / 2);
  ctx.textAlign = 'center'; ctx.font = font(400, 11); ctx.fillStyle = '#6B7280';
  key.notes.forEach((t, i) => ctx.fillText(t, ZW / 2, 492 + i * 16));

  let bin;
  try { bin = atob(cv.toDataURL('image/png').split(',')[1]); } catch (e) { return null; }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, w: ZW, h: ZH };
}

const _f3 = v => (v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, ''));
const _pct = v => (v * 100).toFixed(1) + '%';

// ── 타자 리포트 ──────────────────────────────────────────────
// P = batdata.playerData() 결과
export function exportBatterXlsx(P) {
  if (!P || !P.abs || !P.abs.length) { _toast('이 선수의 타석 기록이 없어요'); return; }
  const st = P.st;
  const rows = [];
  P.gameList.forEach(g => g.abs.forEach(a => rows.push({ a, game: g.label })));
  const bats = P.bats === 'L' ? '좌타' : P.bats === 'R' ? '우타' : '';
  const dirOf = a => (a.dir ? (window._dirLbl ? window._dirLbl(a.dir, a.bats || P.bats) || a.dir : a.dir) : '');
  const zoneOf = a => a.zone || (a.pitches && a.pitches.length ? a.pitches[a.pitches.length - 1].zone : '') || '';

  // 구종 목록 (타석 마지막 공 기준, 많은 순)
  const ptCount = {};
  rows.forEach(({ a }) => { if (a.pt) ptCount[a.pt] = (ptCount[a.pt] || 0) + 1; });
  const pts = Object.keys(ptCount).sort((x, y) => ptCount[y] - ptCount[x]);

  const { sheet: bg, lines } = _outlineSheet(['field', 'zone']);

  // ── 타석 기록 (필터 = 슬라이서 대신) ──
  const rec = new Sheet('타석 기록');
  rec.print = 'data'; rec.freeze = 1;
  const H = ['번호', '경기', '이닝', '결과', '구종', '코스', '방향', '거리(ft)', '타구속도', '발사각', '타구 유형', 'B-S', '아웃', '타점', '투구 수', '타구 X', '타구 Y'];
  const W = [6, 26, 6, 10, 9, 10, 9, 8, 8, 7, 11, 6, 6, 6, 7, 8, 8];
  rec.line(0, 0, H, 'th');
  W.forEach((w, i) => rec.width(i, w));
  const xy = rows.map(({ a }) => {
    if (a.x == null || a.y == null || !window._fieldPos) return null;
    const p = window._fieldPos(a);
    return [p[0], 1 - p[1]];
  });
  rows.forEach(({ a, game }, i) => {
    const cnt = a.count ? `${a.count.b ?? ''}-${a.count.s ?? ''}` : '';
    rec.line(i + 1, 0, [
      i + 1, game, a.inn || '', a.res || '', a.pt || '', zoneOf(a), dirOf(a),
      a.ft != null ? +a.ft : '', a.ev != null ? +a.ev : '', a.launchAngle != null ? +a.launchAngle : '', a.launchType || '',
      cnt, a.count && a.count.o != null ? a.count.o : '', a.rbi || 0, (a.pitches || []).length,
      xy[i] ? r4(xy[i][0]) : '', xy[i] ? r4(xy[i][1]) : '',
    ], ['td', 'tdL', 'td', 'tdB', 'td', 'td', 'td', 'td', 'td1', 'td', 'td', 'td', 'td', 'td', 'td', 'tdC', 'tdC']);
  });
  // 차트용 열: 결과별 · 구종별 X/Y — 해당하는 행에만 값이 있다
  let hc = H.length;
  const resSer = RES_GROUPS.map(g => {
    const pick = i => (xy[i] && _resGroup(rows[i].a.res) === g.k ? xy[i] : null);
    const x = rec.column(0, hc, `[차트] ${g.label} X`, rows.map((_, i) => (pick(i) ? pick(i)[0] : null)), 'thAux', 'tdC');
    const y = rec.column(0, hc + 1, `[차트] ${g.label} Y`, rows.map((_, i) => (pick(i) ? pick(i)[1] : null)), 'thAux', 'tdC');
    rec.width(hc, 9).width(hc + 1, 9);
    hc += 2;
    return { name: g.label, x, y, color: g.color, sym: g.sym, size: g.size, n: rows.filter((_, i) => pick(i)).length };
  });
  const ptSer = pts.map((pt, k) => {
    const pick = i => (xy[i] && rows[i].a.pt === pt ? xy[i] : null);
    const x = rec.column(0, hc, `[차트] ${pt} X`, rows.map((_, i) => (pick(i) ? pick(i)[0] : null)), 'thAux', 'tdC');
    const y = rec.column(0, hc + 1, `[차트] ${pt} Y`, rows.map((_, i) => (pick(i) ? pick(i)[1] : null)), 'thAux', 'tdC');
    rec.width(hc, 9).width(hc + 1, 9);
    hc += 2;
    return { name: pt, x, y, color: _ptColor(pt, k), sym: 'circle', size: 7, n: rows.filter((_, i) => pick(i)).length };
  });
  rec.filter = [0, 0, rows.length, hc - 1];

  // ── 투구 기록 (상대한 공) ──
  const pit = new Sheet('투구 기록');
  pit.print = 'data'; pit.freeze = 1;
  const PH = ['순번', '경기', '타석 번호', '이닝', '구종', '코스', 'B-S', '투수', '위치 기록', '위치 X', '위치 Y', '타석 결과'];
  const PW = [6, 26, 8, 6, 9, 10, 6, 10, 10, 8, 8, 10];
  pit.line(0, 0, PH, 'th');
  PW.forEach((w, i) => pit.width(i, w));
  const plist = [];
  rows.forEach(({ a, game }, i) => {
    const ps = a.pitches && a.pitches.length ? a.pitches : (a.zone || a.pt ? [{ zone: a.zone, pt: a.pt, last: true }] : []);
    ps.forEach((p, j) => {
      const pos = _pitchXY(p.x, p.y, p.zone, (a.id || i) % 100000 + j * 7919);
      plist.push({ p, a, game, ab: i + 1, pos, seq: plist.length + 1 });
    });
  });
  plist.forEach((o, i) => {
    const { p, a } = o;
    pit.line(i + 1, 0, [
      o.seq, o.game, o.ab, a.inn || '', p.pt || '', p.zone || '', p.balls != null ? `${p.balls}-${p.strikes}` : '',
      p.pitcher || '', o.pos ? (o.pos.exact ? '정확' : '코스만') : '', o.pos ? r4(o.pos.x) : '', o.pos ? r4(o.pos.y) : '', a.res || '',
    ], ['td', 'tdL', 'td', 'td', 'td', 'td', 'td', 'td', 'td', 'tdC', 'tdC', 'td']);
  });
  const pPts = [...new Set(plist.map(o => o.p.pt || '미기록'))].sort((x, y) => plist.filter(o => (o.p.pt || '미기록') === y).length - plist.filter(o => (o.p.pt || '미기록') === x).length);
  let pc = PH.length;
  const pitchSer = pPts.map((pt, k) => {
    const pick = o => (o.pos && (o.p.pt || '미기록') === pt ? o.pos : null);
    const x = pit.column(0, pc, `[차트] ${pt} X`, plist.map(o => (pick(o) ? pick(o).x : null)), 'thAux', 'tdC');
    const y = pit.column(0, pc + 1, `[차트] ${pt} Y`, plist.map(o => (pick(o) ? pick(o).y : null)), 'thAux', 'tdC');
    pit.width(pc, 9).width(pc + 1, 9);
    pc += 2;
    return { name: pt, x, y, color: _ptColor(pt, k), sym: 'circle', size: 7, n: plist.filter(pick).length };
  });
  pit.filter = [0, 0, Math.max(1, plist.length), pc - 1];

  // ── 리포트 ──
  const rep = new Sheet('리포트');
  const games = P.gameList.length;
  const first = P.gameList[0] && P.gameList[0].label, last = P.gameList[games - 1] && P.gameList[games - 1].label;
  for (let i = 0; i < 12; i++) rep.width(i, 10.5);
  _header(rep, `${P.name} 타격 분석 리포트`,
    [P.num !== '' && P.num != null ? '#' + P.num : '', bats, `${games}경기 ${st.pa}타석`, `생성 ${_today()}`].filter(Boolean).join('  ·  '), 11);
  _kpis(rep, 4, 0, [['타율', st.avg, 'kpi3'], ['출루율', st.obp, 'kpi3'], ['장타율', st.slg, 'kpi3'], ['OPS', st.ops, 'kpi3'], ['wOBA', st.woba, 'kpi3'], ['BABIP', st.babip, 'kpi3']]);
  let r = 7;
  rep.set(r, 0, '■ 시즌 누적 기록', 'sec');
  r = _table(rep, r + 1, 0, ['경기', '타석', '타수', '안타', '2루타', '3루타', '홈런', '타점', '볼넷', '사구', '삼진', '희생'],
    [[games, st.pa, st.ab, st.h, st.s2, st.s3, st.hr, st.rbi, st.bb, st.hbp, st.k, st.sf + st.sh]], 'td') + 1;
  rep.set(r, 0, '■ 비율 지표', 'sec');
  const dn = st.dn || 0;
  r = _table(rep, r + 1, 0, ['삼진%', '볼넷%', '장타%', 'ISO', '당겨%', '센터%', '밀어%', '방향 기록'],
    [[st.kRate, st.bbRate, st.xbhRate, st.iso, dn ? st.pull / dn : '', dn ? st.center / dn : '', dn ? st.oppo / dn : '', dn]],
    ['tdP', 'tdP', 'tdP', 'td3', 'tdP', 'tdP', 'tdP', 'td']) + 1;
  if (pts.length) {
    rep.set(r, 0, '■ 구종별 성적', 'sec');
    rep.set(r, 3, '타석 마지막 공 기준', 'note');
    r = _table(rep, r + 1, 0, ['구종', '타석', '타수', '안타', '장타', '홈런', '삼진', '볼넷', '타율', '출루율', '장타율'],
      pts.map(pt => { const s = calcStats(rows.filter(o => o.a.pt === pt).map(o => o.a)); return [pt, s.pa, s.ab, s.h, s.s2 + s.s3 + s.hr, s.hr, s.k, s.bb, s.avg, s.obp, s.slg]; }),
      ['tdB', 'td', 'td', 'td', 'td', 'td', 'td', 'td', 'td3', 'td3', 'td3']) + 1;
  }
  rep.set(r, 0, '■ 경기별 기록', 'sec');
  const acc = [];
  r = _table(rep, r + 1, 0, ['경기', '', '', '타석', '타수', '안타', '홈런', '타점', '볼넷', '삼진', '타율', '누적 타율'],
    P.gameList.map(g => { const s = calcStats(g.abs); acc.push(...g.abs); return [g.label, '', '', s.pa, s.ab, s.h, s.hr, s.rbi, s.bb, s.k, s.ab ? s.avg : '', calcStats(acc).avg]; }),
    ['tdL', 'tdL', 'tdL', 'td', 'td', 'td', 'td', 'td', 'td', 'td', 'td3', 'td3']);
  P.gameList.forEach((_, i) => rep.merge(r - games + i, 0, r - games + i, 2, P.gameList[i].label, 'tdL'));
  rep.merge(r - games - 1, 0, r - games - 1, 2, '경기', 'th');
  r++;
  const notes = [
    `wOBA 가중치: 볼넷 ${WOBA_W.bb.toFixed(2)} · 사구 ${WOBA_W.hbp.toFixed(2)} · 단타 ${WOBA_W.s1.toFixed(2)} · 2루타 ${WOBA_W.s2.toFixed(2)} · 3루타 ${WOBA_W.s3.toFixed(2)} · 홈런 ${WOBA_W.hr.toFixed(2)} (SprayLab 앱과 같은 값)`,
    '타구 위치는 기록자가 화면에서 찍은 자리예요 (측정 장비 값 아님).',
    '「타석 기록」 시트에서 필터(▼)를 걸면 「타구 차트」도 걸러진 타석만 보여줘요. 예: 구종 = 직구, 이닝 = 7회 이후.',
  ];
  if (st.pa < 30) notes.unshift(`표본이 적어요 (${st.pa}타석) — 수치는 참고용으로 봐 주세요.`);
  _bullets(rep, r, 0, notes);
  if (first && last && first !== last) rep.set(1, 0, [P.num !== '' && P.num != null ? '#' + P.num : '', bats, `${games}경기 ${st.pa}타석`, `${first} ~ ${last}`, `생성 ${_today()}`].filter(Boolean).join('  ·  '), 'sub');

  // ── 타구 차트 ──
  const spr = new Sheet('타구 차트');
  spr.print = 'landscape';
  for (let i = 0; i < 20; i++) spr.width(i, 10);
  const nXY = xy.filter(Boolean).length;
  _header(spr, `${P.name} 타구 분포`, `타구 ${nXY}개 · ${bats || '타석'} · 점 = 타구가 떨어진 자리 (기록 화면에서 찍은 위치)`, 13);
  if (nXY && lines.field) {
    const fieldX = [0, 1], fieldY = _fieldRange(lines);
    spr.chart({ type: 'scatter', title: '결과별 타구', w: 510, h: 470, x: fieldX, y: fieldY,
      series: [lines.field, lines.infield, ...resSer.filter(s => s.n)] }, 4, 0);
    if (ptSer.some(s => s.n)) {
      spr.chart({ type: 'scatter', title: '구종별 타구 (마지막 공)', w: 510, h: 470, x: fieldX, y: fieldY,
        series: [lines.field, lines.infield, ...ptSer.filter(s => s.n)] }, 4, 7);
    }
    let rr = 27;
    spr.set(rr, 0, '■ 타구 방향', 'sec');
    rr = _table(spr, rr + 1, 0, ['당겨치기', '센터', '밀어치기', '방향 기록'],
      [[dn ? st.pull / dn : '', dn ? st.center / dn : '', dn ? st.oppo / dn : '', dn]], ['tdP', 'tdP', 'tdP', 'td']) + 1;
    const lt = {};
    rows.forEach(({ a }) => { if (a.launchType) lt[a.launchType] = (lt[a.launchType] || 0) + 1; });
    const ltN = Object.values(lt).reduce((s, v) => s + v, 0);
    spr.set(rr, 0, '■ 결과별 타구 수', 'sec');
    rr = _table(spr, rr + 1, 0, ['단타', '2·3루타', '홈런', '아웃'], [[resSer[1].n, resSer[2].n, resSer[3].n, resSer[0].n]], 'td') + 1;
    if (ltN) {
      spr.set(rr, 0, '■ 타구 유형 (발사각 입력 타석)', 'sec');
      rr = _table(spr, rr + 1, 0, ['땅볼', '라인드라이브', '플라이볼', '입력 수'], [[(lt['땅볼'] || 0) / ltN, (lt['라인드라이브'] || 0) / ltN, (lt['플라이볼'] || 0) / ltN, ltN]], ['tdP', 'tdP', 'tdP', 'td']) + 1;
    }
    spr.set(rr, 0, '• 「타석 기록」 시트에서 필터(▼)를 걸면 이 차트도 같이 바뀌어요.', 'note');
  } else {
    spr.set(4, 0, '타구 위치가 기록된 타석이 없어요. 기록 탭에서 필드를 눌러 타구를 기록하면 차트가 채워져요.', 'note');
  }

  // ── 투구 위치 ──
  const loc = new Sheet('투구 위치');
  loc.print = 'landscape';
  for (let i = 0; i < 16; i++) loc.width(i, 10);
  const nExact = plist.filter(o => o.pos && o.pos.exact).length, nPos = plist.filter(o => o.pos).length;
  _header(loc, `${P.name} 상대 투구 위치`, `공 ${nPos}개 (정확한 위치 ${nExact} · 코스만 ${nPos - nExact}) · 기록 화면 기준: 왼쪽 = 내각, 위 = 높음`, 13);
  if (nPos) {
    loc.chart({ type: 'scatter', title: '구종별 투구 위치', w: 470, h: 440, x: [0, 1], y: [0, 1],
      series: [lines.zgrid, lines.zbox, ...pitchSer.filter(s => s.n)] }, 4, 0);
    let rr = 4;
    loc.set(rr, 7, '■ 구종별 공', 'sec');
    const pr = pPts.map(pt => {
      const ps = plist.filter(o => (o.p.pt || '미기록') === pt);
      const inZ = ps.filter(o => ZONES_9.includes(o.p.zone)).length, zN = ps.filter(o => ZONES_13.includes(o.p.zone)).length;
      return [pt, ps.length, ps.length / plist.length, zN ? inZ / zN : ''];
    });
    rr = _table(loc, rr + 1, 7, ['구종', '공', '비율', '존 안%'], pr, ['tdB', 'td', 'tdP', 'tdP']) + 1;
    _bullets(loc, rr, 7, [
      '「코스만」 = 칸만 기록된 공 → 그 칸 안에 흩어 찍었어요 (정확한 위치 아님).',
      '타석 도중 투구를 따로 기록하지 않았다면 마지막 공(결정구) 1개만 있어요.',
      '「투구 기록」 시트에서 필터(▼)를 걸면 이 차트도 같이 바뀌어요.',
    ]);
    const multi = pitchSer.filter(s => s.n);
    if (multi.length > 1) {
      const r0 = 28;
      loc.set(r0, 0, '■ 구종별로 나눠 보기', 'sec');
      multi.forEach((s, i) => {
        loc.chart({ type: 'scatter', title: `${s.name} (${s.n}구)`, w: 290, h: 300, x: [0, 1], y: [0, 1],
          series: [lines.zgrid, lines.zbox, { ...s, legend: false }] }, r0 + 1 + Math.floor(i / 4) * 15, (i % 4) * 4);
      });
    }
  } else {
    loc.set(4, 0, '투구 코스가 기록된 공이 없어요. 기록 탭에서 코스(존)를 찍으면 차트가 채워져요.', 'note');
  }

  // ── 핫콜드존 ──
  const hz = new Sheet('핫콜드존');
  _header(hz, `${P.name} 코스별 핫/콜드 존`, `타율 기준 · 타석 마지막 공 코스 · 색 = 이 선수 전체 타율(${_f3(st.avg)}) 대비`, 6);
  const zs = {};
  ZONES_13.forEach(z => { zs[z] = calcStats(rows.filter(o => zoneOf(o.a) === z).map(o => o.a)); });
  const zoned = ZONES_13.reduce((s, z) => s + zs[z].pa, 0);
  // 스트라이크존 그림 (앱 스카우트 탭 코스 칸과 같은 기준: 3타수 이상만 색, 선수 전체 타율 대비)
  const png = _zonePng(z => {
    const s = zs[z];
    return { fill: s.ab >= MIN_ZONE_AB ? _hotCold(s.avg, st.avg) : null, main: s.ab ? _f3(s.avg) : '—', sub: s.pa ? `${s.h}/${s.ab} · ${s.pa}타석` : '기록 없음' };
  }, {
    lo: '콜드 (약함)', hi: '핫 (강함)', loInk: '#2F5FD0', hiInk: '#C2323B', stops: [[0, HC_LO], [0.5, HC_MID], [1, HC_HI]],
    notes: [`색 = 이 선수 전체 타율(${_f3(st.avg)}) 대비 · ${MIN_ZONE_AB}타수 미만 칸은 색 없음`, '기록 화면 기준: 왼쪽 = 내각, 위 = 높음'],
  });
  let rr;
  if (png) {
    hz.image(png, 4, 0);
    for (let i = 0; i <= 6; i++) hz.width(i, 15);
    rr = 4 + Math.ceil(png.h / 22) + 1;
  } else {
    // 캔버스를 못 쓰면 셀 표로
    const band = s => {
      if (s.ab < MIN_ZONE_AB) return 'zna';
      const d = s.avg - st.avg;
      return 'h' + (d < -0.15 ? 0 : d < -0.075 ? 1 : d < -0.025 ? 2 : d <= 0.025 ? 3 : d <= 0.075 ? 4 : d <= 0.15 ? 5 : 6);
    };
    rr = _zoneGrid(hz, 4, 0, z => {
      const s = zs[z];
      if (!s.pa) return { text: `${z}\n—`, style: 'zna' };
      return { text: `${z}\n${s.ab ? _f3(s.avg) : '—'}\n${s.h}/${s.ab} · ${s.pa}타석`, style: band(s) };
    });
    hz.line(rr + 1, 0, ['색상 범례', '콜드 (−.075↓)', '평균 (±.025)', '핫 (+.075↑)'], ['axis', 'h1', 'h3', 'h5']).height(rr + 1, 24);
    rr += 3;
  }
  hz.set(rr, 0, '■ 주요 분석', 'sec');
  const cand = ZONES_13.filter(z => zs[z].ab >= MIN_ZONE_AB);
  const byAvg = cand.slice().sort((x, y) => zs[y].avg - zs[x].avg);
  const most = ZONES_13.slice().sort((x, y) => zs[y].pa - zs[x].pa)[0];
  const ins = [];
  if (byAvg.length) ins.push(`가장 강한 코스: ${byAvg[0]} — 타율 ${_f3(zs[byAvg[0]].avg)} (${zs[byAvg[0]].h}/${zs[byAvg[0]].ab})`);
  if (byAvg.length > 1) { const w = byAvg[byAvg.length - 1]; ins.push(`가장 약한 코스: ${w} — 타율 ${_f3(zs[w].avg)} (${zs[w].h}/${zs[w].ab})`); }
  if (zoned) ins.push(`가장 많이 승부한 코스: ${most} — ${zs[most].pa}타석 (${_pct(zs[most].pa / zoned)})`);
  ins.push(`코스가 기록된 타석 ${zoned} / 전체 ${st.pa}타석 · 강약 비교는 ${MIN_ZONE_AB}타수 이상인 코스만`);
  rr = _bullets(hz, rr + 1, 0, ins) + 1;
  hz.set(rr, 0, '■ 코스별 기록', 'sec');
  _table(hz, rr + 1, 0, ['코스', '타석', '타수', '안타', '장타', '타율', '장타율'],
    ZONES_13.map(z => { const s = zs[z]; return [z, s.pa, s.ab, s.h, s.s2 + s.s3 + s.hr, s.ab ? s.avg : '', s.ab ? s.slg : '']; }),
    ['tdB', 'td', 'td', 'td', 'td', 'td3', 'td3']);
  hz.width(5, 15).width(6, 15);

  const sheets = [rep, spr, loc, hz, rec, pit, bg];
  _save(buildXlsx(sheets), _fileName(P.name, '타자분석'));
  _toast(`📊 ${P.name} 분석 엑셀 저장 (차트 포함)`);
  if (typeof window.gtag === 'function') window.gtag('event', 'export_analysis_xlsx', { kind: 'batter', pa: st.pa });
  return sheets;
}

// ── 투수 리포트 ──────────────────────────────────────────────
// P = { name, num, role, apps:[{ label, pitches }] }, S = pitcher.js _calc(P.apps), calc = _calc
export function exportPitcherXlsx(P, S, calc) {
  if (!P || !S || !S.n) { _toast('이 투수의 투구 기록이 없어요'); return; }
  const ROLE = { SP: '선발', RP: '계투', CP: '마무리' };
  const { sheet: bg, lines } = _outlineSheet(['field', 'zone']);
  const plist = [];
  P.apps.forEach(app => app.pitches.forEach((p, j) => {
    const pos = _pitchXY(p.zoneX, p.zoneY, p.zone, (p.id || plist.length) % 100000 + j * 7919);
    plist.push({ p, app, pos, seq: plist.length + 1 });
  }));
  const ptOf = o => o.p.pt || '미기록';
  const cnt = {};
  plist.forEach(o => { cnt[ptOf(o)] = (cnt[ptOf(o)] || 0) + 1; });
  const pts = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x]);

  // ── 투구 기록 ──
  const rec = new Sheet('투구 기록');
  rec.print = 'data'; rec.freeze = 1;
  const H = ['순번', '경기', '이닝', '타자', '구종', '코스', '결과', '위치 기록', '위치 X', '위치 Y'];
  [6, 26, 6, 10, 9, 10, 9, 10, 8, 8].forEach((w, i) => rec.width(i, w));
  rec.line(0, 0, H, 'th');
  plist.forEach((o, i) => {
    const { p } = o;
    rec.line(i + 1, 0, [o.seq, o.app.label, p.inning || '', p.batter || '', p.pt || '', p.zone || '', p.result || '',
      o.pos ? (o.pos.exact ? '정확' : '코스만') : '', o.pos ? r4(o.pos.x) : '', o.pos ? r4(o.pos.y) : ''],
    ['td', 'tdL', 'td', 'td', 'td', 'td', 'tdB', 'td', 'tdC', 'tdC']);
  });
  let hc = H.length;
  const ser = pts.map((pt, k) => {
    const pick = o => (o.pos && ptOf(o) === pt ? o.pos : null);
    const x = rec.column(0, hc, `[차트] ${pt} X`, plist.map(o => (pick(o) ? pick(o).x : null)), 'thAux', 'tdC');
    const y = rec.column(0, hc + 1, `[차트] ${pt} Y`, plist.map(o => (pick(o) ? pick(o).y : null)), 'thAux', 'tdC');
    rec.width(hc, 9).width(hc + 1, 9);
    hc += 2;
    return { name: pt, x, y, color: _ptColor(pt, k), sym: 'circle', size: 7, n: plist.filter(pick).length };
  });
  rec.filter = [0, 0, plist.length, hc - 1];

  // 구종별 요약
  const mix = pts.map(pt => {
    const ps = plist.filter(o => ptOf(o) === pt).map(o => o.p);
    const zN = ps.filter(p => ZONES_13.includes(p.zone)).length;
    return {
      pt, n: ps.length, share: ps.length / S.n, sPct: ps.filter(p => !PT_BALL.includes(p.result)).length / ps.length,
      zPct: zN ? ps.filter(p => ZONES_9.includes(p.zone)).length / zN : '', h: ps.filter(p => PT_HIT.includes(p.result)).length,
      k: ps.filter(p => p.result === '삼진').length,
    };
  });

  // ── 리포트 ──
  const rep = new Sheet('리포트');
  for (let i = 0; i < 16; i++) rep.width(i, 10.5);
  _header(rep, `${P.name} 투구 분석 리포트`,
    [P.num ? '#' + P.num : '', P.role ? ROLE[P.role] || P.role : '', `${P.apps.length}경기`, `${S.n}구`, `상대 ${S.pa}타자`, `생성 ${_today()}`].filter(Boolean).join('  ·  '), 11);
  _kpis(rep, 4, 0, [['투구 수', S.n, 'kpiI'], ['스트라이크%', S.sPct, 'kpiP'], ['삼진%', S.kRate, 'kpiP'], ['볼넷%', S.bbRate, 'kpiP'], ['피안타율', S.ab ? S.avg : '—', 'kpi3'], ['타자당 투구', S.ppa || '—', 'kpi1']]);
  let r = 7;
  rep.set(r, 0, '■ 구종 사용 비율', 'sec');
  const mixTop = r + 1;
  r = _table(rep, r + 1, 0, ['구종', '투구 수', '사용%', '스트라이크%', '존 안%', '피안타', '삼진'],
    mix.map(m => [m.pt, m.n, m.share, m.sPct, m.zPct, m.h, m.k]), ['tdB', 'td', 'tdP', 'tdP', 'tdP', 'td', 'td']) + 1;
  rep.chart({ type: 'bar', title: '구종 사용 비율', name: '사용%', w: 360, h: Math.max(170, 60 + mix.length * 34),
    cats: { ref: `${qs(rep.name)}!$A$${mixTop + 2}:$A$${mixTop + 1 + mix.length}`, vals: mix.map(m => m.pt) },
    vals: { ref: `${qs(rep.name)}!$C$${mixTop + 2}:$C$${mixTop + 1 + mix.length}`, vals: mix.map(m => m.share) },
    colors: mix.map((m, k) => _ptColor(m.pt, k)) }, mixTop, 8);
  r = Math.max(r, mixTop + Math.ceil(Math.max(170, 60 + mix.length * 34) / 22) + 1);
  rep.set(r, 0, '■ 등판 기록', 'sec');
  const apps = P.apps.map(a => { const s = calc([a]); return [a.label, '', '', s.n, s.sPct, s.pa, s.h, s.k, s.bb]; });
  r = _table(rep, r + 1, 0, ['경기', '', '', '투구 수', '스트라이크%', '상대 타자', '피안타', '삼진', '볼넷'], apps,
    ['tdL', 'tdL', 'tdL', 'td', 'tdP', 'td', 'td', 'td', 'td']);
  P.apps.forEach((a, i) => rep.merge(r - apps.length + i, 0, r - apps.length + i, 2, a.label, 'tdL'));
  rep.merge(r - apps.length - 1, 0, r - apps.length - 1, 2, '경기', 'th');
  r++;
  const notes = [
    '스트라이크% = 볼·볼넷을 뺀 모든 공 (파울·인플레이 포함) — SprayLab 투수 탭과 같은 기준.',
    '존 안% = 코스가 기록된 공 중 스트라이크존 9칸에 들어간 비율.',
    '「투구 기록」 시트에서 필터(▼)를 걸면 「구종별 투구위치」 차트도 같이 바뀌어요. 예: 결과 = 안타, 이닝 = 5.',
  ];
  if (S.n < 50) notes.unshift(`표본이 적어요 (${S.n}구) — 수치는 참고용으로 봐 주세요.`);
  _bullets(rep, r, 0, notes);

  // ── 구종별 투구위치 ──
  const loc = new Sheet('구종별 투구위치');
  loc.print = 'landscape';
  for (let i = 0; i < 16; i++) loc.width(i, 10);
  const nPos = plist.filter(o => o.pos).length, nExact = plist.filter(o => o.pos && o.pos.exact).length;
  _header(loc, `${P.name} 구종별 투구 위치`, `공 ${nPos}개 (정확한 위치 ${nExact} · 코스만 ${nPos - nExact}) · 기록 화면 기준: 왼쪽 = 내각, 위 = 높음`, 13);
  const withPos = ser.filter(s => s.n);
  if (withPos.length) {
    loc.chart({ type: 'scatter', title: '전체 투구 위치', w: 470, h: 440, x: [0, 1], y: [0, 1], series: [lines.zgrid, lines.zbox, ...withPos] }, 4, 0);
    let rr = 4;
    loc.set(rr, 7, '■ 구종별 제구', 'sec');
    rr = _table(loc, rr + 1, 7, ['구종', '공', '존 안%', '스트라이크%'], mix.map(m => [m.pt, m.n, m.zPct, m.sPct]), ['tdB', 'td', 'tdP', 'tdP']) + 1;
    _bullets(loc, rr, 7, [
      '「코스만」 = 칸만 기록된 공 → 그 칸 안에 흩어 찍었어요 (정확한 위치 아님).',
      '「투구 기록」 시트에서 필터(▼)를 걸면 이 차트들도 같이 바뀌어요.',
    ]);
    const r0 = 28;
    loc.set(r0, 0, '■ 구종별로 나눠 보기', 'sec');
    withPos.forEach((s, i) => {
      loc.chart({ type: 'scatter', title: `${s.name} (${s.n}구)`, w: 290, h: 300, x: [0, 1], y: [0, 1],
        series: [lines.zgrid, lines.zbox, { ...s, legend: false }] }, r0 + 1 + Math.floor(i / 4) * 15, (i % 4) * 4);
    });
  } else {
    loc.set(4, 0, '코스가 기록된 공이 없어요. 투수 탭의 투구 기록에서 코스를 찍으면 차트가 채워져요.', 'note');
  }

  // ── 코스 분포 ──
  const hz = new Sheet('코스 분포');
  _header(hz, `${P.name} 코스별 투구 분포`, '색 = 던진 공 비율 (진할수록 많이) · 기록 화면 기준: 왼쪽 = 내각', 4);
  const zc = {};
  ZONES_13.forEach(z => {
    const ps = plist.filter(o => o.p.zone === z).map(o => o.p);
    zc[z] = { n: ps.length, h: ps.filter(p => PT_HIT.includes(p.result)).length, s: ps.filter(p => !PT_BALL.includes(p.result)).length };
  });
  const zN = ZONES_13.reduce((s, z) => s + zc[z].n, 0);
  const zMax = Math.max(1, ...ZONES_13.map(z => zc[z].n));
  const png = _zonePng(z => {
    const o = zc[z];
    return { fill: o.n ? _mix(SQ_LO, SQ_HI, 0.15 + 0.85 * o.n / zMax) : null, main: o.n ? _pct(o.n / zN) : '—', sub: o.n ? `${o.n}구 · 피안타 ${o.h}` : '기록 없음' };
  }, {
    lo: '적음', hi: '많음', loInk: '#6B7280', hiInk: '#2459C7', stops: [[0, SQ_LO], [1, SQ_HI]],
    notes: ['색 = 던진 공 수 (가장 많이 던진 칸이 가장 진함)', '기록 화면 기준: 왼쪽 = 내각, 위 = 높음'],
  });
  let rr;
  if (png) {
    hz.image(png, 4, 0);
    for (let i = 0; i <= 4; i++) hz.width(i, 15);
    rr = 4 + Math.ceil(png.h / 22) + 1;
  } else {
    // 캔버스를 못 쓰면 셀 표로
    rr = _zoneGrid(hz, 4, 0, z => {
      const o = zc[z];
      if (!o.n) return { text: `${z}\n—`, style: 'zna' };
      const q = Math.min(5, 1 + Math.floor(o.n / zMax * 4.999));
      return { text: `${z}\n${_pct(o.n / zN)}\n${o.n}구 · 피안타 ${o.h}`, style: 'q' + q };
    });
    hz.line(rr + 1, 0, ['색상 범례', '적음', '중간', '많음'], ['axis', 'q1', 'q3', 'q5']).height(rr + 1, 24);
    rr += 3;
  }
  hz.set(rr, 0, '■ 주요 분석', 'sec');
  const sorted = ZONES_13.slice().sort((x, y) => zc[y].n - zc[x].n);
  const inZ = ZONES_9.reduce((s, z) => s + zc[z].n, 0);
  const hitZ = ZONES_13.slice().sort((x, y) => zc[y].h - zc[x].h)[0];
  const ins = [];
  if (zN) {
    ins.push(`가장 많이 던진 코스: ${sorted[0]} — ${zc[sorted[0]].n}구 (${_pct(zc[sorted[0]].n / zN)})`);
    ins.push(`스트라이크존 9칸에 들어간 공: ${_pct(inZ / zN)} (${inZ}/${zN})`);
    if (zc[hitZ].h) ins.push(`피안타가 가장 많은 코스: ${hitZ} — ${zc[hitZ].h}개`);
  }
  ins.push(`코스가 기록된 공 ${zN} / 전체 ${S.n}구`);
  rr = _bullets(hz, rr + 1, 0, ins) + 1;
  hz.set(rr, 0, '■ 코스별 기록', 'sec');
  _table(hz, rr + 1, 0, ['코스', '공', '비율', '스트라이크%', '피안타'],
    ZONES_13.map(z => [z, zc[z].n, zN ? zc[z].n / zN : '', zc[z].n ? zc[z].s / zc[z].n : '', zc[z].h]), ['tdB', 'td', 'tdP', 'tdP', 'td']);

  // ── 타구 허용 (타자 기록 중 이 투수가 마지막 공을 던진 타석) ──
  const hit = new Sheet('타구 허용');
  hit.print = 'landscape';
  for (let i = 0; i < 16; i++) hit.width(i, 10);
  const allowed = [];
  buildData().games.forEach(g => g.abs.forEach(a => {
    const last = a.pitches && a.pitches.length ? a.pitches[a.pitches.length - 1] : null;
    if (last && last.pitcher === P.name && a.x != null && a.y != null) allowed.push({ a, game: g.label });
  }));
  _header(hit, `${P.name} 타구 허용 분포`, `타구 ${allowed.length}개 · 타자 기록에서 이 투수가 마지막 공을 던진 타석`, 13);
  if (allowed.length && lines.field) {
    const axy = allowed.map(({ a }) => { const p = window._fieldPos(a); return [p[0], 1 - p[1]]; });
    const c0 = 8;
    hit.line(4, c0, ['경기', '타자', '결과', '구종', 'X', 'Y'], 'th');
    [22, 9, 9, 8, 7, 7].forEach((w, i) => hit.width(c0 + i, w));
    allowed.forEach(({ a, game }, i) => hit.line(5 + i, c0, [game, a.bname || '', a.res || '', a.pt || '', r4(axy[i][0]), r4(axy[i][1])], ['tdL', 'td', 'tdB', 'td', 'tdC', 'tdC']));
    let hcc = c0 + 6;
    const hs = RES_GROUPS.map(g => {
      const pick = i => (_resGroup(allowed[i].a.res) === g.k ? axy[i] : null);
      const x = hit.column(4, hcc, `${g.label} X`, allowed.map((_, i) => (pick(i) ? pick(i)[0] : null)), 'thAux', 'tdC');
      const y = hit.column(4, hcc + 1, `${g.label} Y`, allowed.map((_, i) => (pick(i) ? pick(i)[1] : null)), 'thAux', 'tdC');
      hit.width(hcc, 8).width(hcc + 1, 8);
      hcc += 2;
      return { name: g.label, x, y, color: g.color, sym: g.sym, size: g.size, n: allowed.filter((_, i) => pick(i)).length };
    });
    hit.chart({ type: 'scatter', title: '결과별 타구 허용', w: 510, h: 470, x: [0, 1], y: _fieldRange(lines),
      series: [lines.field, lines.infield, ...hs.filter(s => s.n)] }, 4, 0);
  } else {
    hit.set(4, 0, '이 투수가 던진 타석의 타구 위치 기록이 없어요. 기록 탭에서 투수를 선택한 채로 타자의 투구·타구를 기록하면 채워져요.', 'note');
  }

  const sheets = [rep, loc, hz, hit, rec, bg];
  _save(buildXlsx(sheets), _fileName(P.name, '투수분석'));
  _toast(`📊 ${P.name} 투구 분석 엑셀 저장 (차트 포함)`);
  if (typeof window.gtag === 'function') window.gtag('event', 'export_analysis_xlsx', { kind: 'pitcher', n: S.n });
  return sheets;
}

// 분석 탭 카드 아래에 붙이는 버튼 (profile.js · pitcher.js)
export function xlsxButton(fn, sub) {
  return `
    <div class="an-xlsx">
      <button type="button" class="sc-act" onclick="${fn}()">📊 분석 엑셀 받기 (차트 포함)</button>
      <small>${sub}</small>
    </div>`;
}
