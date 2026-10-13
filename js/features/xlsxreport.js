// 분석 엑셀 — 선수 한 명의 기록을 차트가 들어간 .xlsx 로 내보낸다
//   타자: 리포트 · 타구 차트 · 투구 위치 · 핫콜드존 · 타석 기록 · 투구 기록
//   투수: 리포트 · 구종별 투구위치 · 코스 분포 · 타구 허용 · 투구 기록
// SheetJS 무료판은 차트·셀 서식을 쓰지 못해서, xlsx(OOXML)를 직접 만들고 무압축 ZIP으로 묶는다 (외부 라이브러리 없음).
// 차트는 '기록' 시트의 칸을 그대로 가리킨다 → 엑셀에서 필터(▼)로 행을 숨기면 차트도 남은 기록만 그린다 (피벗+슬라이서 대신).
import { HITS, PT_TYPES, PT_COLORS, ZONES_9, WOBA_W } from '../constants.js';
import { buildData, calcStats, batsTag } from './batdata.js?v=10';

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
// 던지기 직전 아웃·주자 (core.js recordPitch 의 outs · runners — 경기 운영 모드에서만 저장, 아니면 null · 예전 기록엔 없음 → 빈 칸)
const _ptOuts = p => (p.outs === 0 || p.outs === 1 || p.outs === 2 ? p.outs : '');
const _ptRunners = p => {
  const r = p.runners;
  if (!Array.isArray(r) || r.length !== 3) return '';
  const on = [1, 2, 3].filter((_, i) => r[i]);
  return !on.length ? '주자 없음' : on.length === 3 ? '만루' : on.join('·') + '루';
};

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
// 타구 유형 이름 통일(4단계): 발사각 입력값 · 결과 이름 → 땅볼 · 라이너 · 플라이
const BT_NAME = { __proto__: null, '땅볼': '땅볼', '라인드라이브': '라이너', '라이너': '라이너', '플라이볼': '플라이', '플라이': '플라이' };
// 시트 한 열의 데이터 범위(2행 ~ n+1행) — 수식용 절대 주소
const _rng = (sheet, c, n) => `${qs(sheet)}!$${colL(c)}$2:$${colL(c)}$${Math.max(2, n + 1)}`;
// 비율 행(4단계 · 필터 연동): 각 [집계] 열에서 보이는 행 합(SUBTOTAL 109) ÷ 전체 합, 마지막 칸 = 전체 합. cached = 필터 없을 때 값
function _shareRow(refs, cached, total) {
  const sum = refs.map(r => `SUBTOTAL(109,${r})`).join('+');
  return [...refs.map((r, i) => ({ f: `IFERROR(SUBTOTAL(109,${r})/(${sum}),"")`, v: cached[i] })), { f: sum, v: total }];
}

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
  tdW: { border: 1, align: 'left', wrap: 1 },
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
    this.hiddenCols = {};    // c → true: 숨긴 열(지우지 않음 — 열 위치 그대로 · 엑셀에서 '숨기기 취소'로 다시 보임)
    this.hts = {};           // r → 높이(pt)
    this.merges = [];
    this.charts = [];        // { spec, r, c }
    this.images = [];        // { img: { bytes, w, h }, r, c } — PNG 그림
    this.freeze = 0;         // 고정할 위쪽 행 수
    this.filter = null;      // [r0, c0, r1, c1]
    this.print = 'portrait'; // 차트 시트는 한 장에 맞춰 인쇄 · 'landscape' · 'data'(맞춤 없음) · 'dataW'(너비만 한 장)
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
  hide(c) { this.hiddenCols[c] = true; return this; }
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
        // 수식 셀 { f, v }: 엑셀이 열 때 다시 계산하고(calcPr fullCalcOnLoad), v 는 계산 전에 보일 값
        if (v && typeof v === 'object' && v.f) return typeof v.v === 'number' && isFinite(v.v) ? `<c ${a}><f>${xe(v.f)}</f><v>${r4(v.v)}</v></c>` : `<c ${a} t="str"><f>${xe(v.f)}</f><v>${xe(v.v == null ? '' : v.v)}</v></c>`;
        if (typeof v === 'number') return isFinite(v) ? `<c ${a}><v>${v}</v></c>` : `<c ${a}/>`;
        if (v == null || v === '') return `<c ${a}/>`;
        return `<c ${a} t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
      }).join('');
      const h = this.hts[r];
      return `<row r="${r + 1}"${h ? ` ht="${h}" customHeight="1"` : ''}>${cs}</row>`;
    }).join('');
    const cols = [...new Set([...Object.keys(this.cols), ...Object.keys(this.hiddenCols)].map(Number))].sort((a, b) => a - b)
      .map(c => `<col min="${c + 1}" max="${c + 1}" width="${this.cols[c] || 9}" customWidth="1"${this.hiddenCols[c] ? ' hidden="1"' : ''}/>`).join('');
    const pane = this.freeze ? `<pane ySplit="${this.freeze}" topLeftCell="A${this.freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${this.freeze + 1}" sqref="A${this.freeze + 1}"/>` : '';
    const fit = this.print !== 'data';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${fit ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : ''}<sheetViews><sheetView workbookViewId="0"${this.print === 'data' ? '' : ' showGridLines="0"'}${this.first ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="16.5"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${body}</sheetData>${this.filter ? `<autoFilter ref="${cref(this.filter[0], this.filter[1])}:${cref(this.filter[2], this.filter[3])}"/>` : ''}${this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${this.print === 'landscape' ? 'landscape' : 'portrait'}"${fit ? ` fitToWidth="1" fitToHeight="${this.print === 'dataW' ? 0 : 1}"` : ''}/>${drawingRid ? `<drawing r:id="${drawingRid}"/>` : ''}</worksheet>`;
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

// 산점도: series = [{ name, x:{ref,vals}, y:{ref,vals}, kind:'dot'|'line', color, sym, size, width, legend, hollow, labels }]
//   hollow = 속 빈 마커(테두리만) · labels[i] = i번째 점 옆에 붙일 글자(점마다 c:dLbl — 행이 필터로 숨으면 그 점과 함께 안 보인다)
function _dLblsXml(labels) {
  const one = (t, i) => `<c:dLbl><c:idx val="${i}"/><c:layout/><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${_txt(700, 0, '374151')}</a:pPr><a:r><a:rPr lang="ko-KR" sz="700"><a:solidFill><a:srgbClr val="374151"/></a:solidFill><a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/></a:rPr><a:t>${xe(t)}</a:t></a:r></a:p></c:rich></c:tx><c:dLblPos val="r"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbl>`;
  return `<c:dLbls>${labels.map((t, i) => (t == null || t === '' ? '' : one(t, i))).join('')}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${_txPr(700, 0, '374151')}<c:dLblPos val="r"/><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`;
}
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
      : s.hollow
        ? `<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="${s.sym || 'circle'}"/><c:size val="${s.size || 6}"/><c:spPr><a:noFill/><a:ln w="15875"><a:solidFill><a:srgbClr val="${_dark(s.color)}"/></a:solidFill></a:ln></c:spPr></c:marker>`
        : `<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="${s.sym || 'circle'}"/><c:size val="${s.size || 6}"/><c:spPr><a:solidFill><a:srgbClr val="${s.color}"><a:alpha val="85000"/></a:srgbClr></a:solidFill><a:ln w="6350"><a:solidFill><a:srgbClr val="${_dark(s.color)}"/></a:solidFill></a:ln></c:spPr></c:marker>`;
    const lbl = !line && Array.isArray(s.labels) && s.labels.some(t => t != null && t !== '') ? _dLblsXml(s.labels) : '';
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${xe(s.name)}</c:v></c:tx>${spPr}${lbl}<c:xVal>${_numRef(s.x)}</c:xVal><c:yVal>${_numRef(s.y)}</c:yVal><c:smooth val="0"/></c:ser>`;
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
  files.push(['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((sh, i) => `<sheet name="${xe(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${names ? `<definedNames>${names}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`]);
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
// ── 타자 「주요 분석」(4단계): 규칙 기반 줄 — 표본 기준을 넘는 줄만, 수치만 나열(평가어 없음), 줄 끝 n = 그 줄의 표본 ──
const INS_MIN = { pa: 10, zoned: 10, dir: 5, dirTop: 0.5, twoS: 5 };
const INS_NOTE = `표본 기준 — 볼넷·삼진: ${INS_MIN.pa}타석 이상 · 결정구 코스: 코스 기록 ${INS_MIN.zoned}타석 이상 · 방향: 방향 기록 ${INS_MIN.dir}개 이상이고 한 구역이 ${INS_MIN.dirTop * 100}% 이상 · `
  + `2스트라이크: B-S 자동 계산 타석 중 2스트라이크까지 간 타석 ${INS_MIN.twoS}개 이상. 기준에 못 미치는 줄은 넣지 않았어요.`;
// abs = 이 선수 타석, st = calcStats(abs), o = { sw: 스위치, assumed: 좌/우타 미지정(우타 가정), zoneOf: 타석 마지막 공 코스 }
function _batterInsights(abs, st, o) {
  const out = [];
  const pc = v => (v * 100).toFixed(1) + '%';
  const nd = (n, d) => `${n}/${d} (${pc(d ? n / d : 0)})`;
  // 결과 나눔: 안타 · 볼넷 · 사구(있을 때) · 삼진 · 아웃·기타(희생 · 실책 포함)
  const split = s => [`안타 ${s.h}`, `볼넷 ${s.bb}`, s.hbp ? `사구 ${s.hbp}` : '', `삼진 ${s.k}`, `아웃·기타 ${s.pa - s.h - s.bb - s.hbp - s.k}`].filter(Boolean).join(' · ');
  // a. 볼넷% · 삼진% (볼넷 = 볼넷만, 사구 제외 — bbRate 와 같은 기준)
  if (st.pa >= INS_MIN.pa) {
    const gap = st.bbRate - st.kRate;
    out.push(`볼넷 ${nd(st.bb, st.pa)} · 삼진 ${nd(st.k, st.pa)} — ${gap ? `${gap > 0 ? '볼넷' : '삼진'}이 ${(Math.abs(gap) * 100).toFixed(1)}%p 많음` : '같음'} · n = ${st.pa}타석`);
  }
  // b. 결정구(타석 마지막 공) 중 존 밖(볼 위 · 아래 · 안 · 밖) 비율과 그 타석 결과
  const zAbs = abs.filter(a => ZONES_13.includes(o.zoneOf(a)));
  if (zAbs.length >= INS_MIN.zoned) {
    const outZ = zAbs.filter(a => ZONE_BALL.includes(o.zoneOf(a)));
    out.push(`결정구 존 밖 ${nd(outZ.length, zAbs.length)}${outZ.length ? ` — 그 타석 결과: ${split(calcStats(outZ))}` : ''} · n = ${zAbs.length} 코스 기록 타석`);
  }
  // c. 방향 쏠림: 가장 많은 구역이 하나이고 50% 이상일 때만. 스위치는 필드 기준 좌/중/우
  const dTot = o.sw ? st.fn : st.dn;
  if (dTot >= INS_MIN.dir) {
    const dl = o.sw ? [['좌', st.fl], ['중', st.fc], ['우', st.fr]] : [['당겨치기', st.pull], ['센터', st.center], ['밀어치기', st.oppo]];
    const mx = Math.max(...dl.map(x => x[1])), tops = dl.filter(x => x[1] === mx);
    if (tops.length === 1 && mx / dTot >= INS_MIN.dirTop) {
      out.push(`타구 방향 ${tops[0][0]} 쏠림 — ${dl.map(([l, v]) => `${l} ${nd(v, dTot)}`).join(' · ')}${o.sw ? ' (스위치: 필드 기준)' : o.assumed ? ' (우타 가정)' : ''} · n = ${dTot} 방향 기록`);
    }
  }
  // d. 2스트라이크 이후 타석 결과 — 모든 공에 결과가 있어 B-S 가 자동 계산된 타석만(마지막 공 직전 스트라이크 2)
  const pCount = window._pCount;
  if (typeof pCount === 'function') {
    const auto = abs.filter(a => Array.isArray(a.pitches) && a.pitches.length && pCount(a.pitches).complete);
    const two = auto.filter(a => { const c = pCount(a.pitches); return c.pre[c.pre.length - 1].s >= 2; });
    if (two.length >= INS_MIN.twoS) {
      const s = calcStats(two);
      out.push(`2스트라이크 이후 타석 결과: ${split(s)}${s.ab ? ` (타율 ${_f3(s.avg)} = ${s.h}/${s.ab})` : ''} · n = ${two.length}타석 (B-S 자동 계산 ${auto.length}타석 중)`);
    }
  }
  return out;
}
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
  const bats = batsTag(P.bats).txt;   // 우타 · 좌타 · 스위치 · 방향 미분류 · 우타 가정(bh 모름 → 우타로 계산) — 3단계
  const dirOf = a => (window._dirLbl ? window._dirLbl(a.dir) : a.dir || '');   // 필드 기준 5구역(좌 · 좌중 · 중 · 우중 · 우) — 좌표에서 계산
  const sw = P.bats === 'S';   // 스위치: 당겨/센터/밀어 대신 필드 기준 좌/중/우
  // 경기 단위 경고(초/말 섞임 · 같은 이닝 3타석 이상)는 경기마다 그 선수 타석으로 계산
  const gWarn = Object.create(null);
  P.gameList.forEach(g => { const m = window._gameWarnMap ? window._gameWarnMap(g.abs) : {}; Object.keys(m).forEach(k => { gWarn[k] = m[k]; }); });
  const zoneOf = a => a.zone || (a.pitches && a.pitches.length ? a.pitches[a.pitches.length - 1].zone : '') || '';

  // 구종 목록 (타석 마지막 공 기준, 많은 순)
  const ptCount = Object.create(null);
  rows.forEach(({ a }) => { if (a.pt) ptCount[a.pt] = (ptCount[a.pt] || 0) + 1; });
  const pts = Object.keys(ptCount).sort((x, y) => ptCount[y] - ptCount[x]);

  const { sheet: bg, lines } = _outlineSheet(['field', 'zone']);

  // ── 타석 기록 (필터 = 슬라이서 대신) ──
  const rec = new Sheet('타석 기록');
  rec.print = 'data'; rec.freeze = 1;
  // 구종·코스·B-S: 투구 로그가 있으면 마지막 공에서 파생된 값(batdata 가 읽을 때 core.js _pSyncAb 로 맞춘 a.pt · a.zone · a.count)
  // 확인 필요: core.js _abWarn 정합성 경고(삼진인데 스트라이크 < 3 · 초/말 섞임 등) — 기존 열 뒤에 붙여 기존 열 위치는 그대로
  // 추정 거리(m): 찍은 위치로 계산한 값(측정값 아님) — 저장은 ft, 표시만 m (× 0.3048, 반올림)
  const H = ['번호', '경기', '이닝', '결과', '구종', '코스', '방향', '추정 거리(m)', '타구속도', '발사각', '타구 유형', 'B-S', '아웃', '타점', '투구 수', '타구 X', '타구 Y', '확인 필요'];
  const W = [6, 26, 6, 10, 9, 10, 9, 10, 8, 7, 11, 6, 6, 6, 7, 8, 8, 30];
  const warnOf = a => (window._abWarn ? window._abWarn(a, gWarn) : window._pWarn ? window._pWarn(a) : []);
  // 타구 유형(내보낼 때만 계산 · 저장 안 함 — 4단계): 직접 넣은 값(발사각 입력) 우선, 없으면 결과 이름에서(땅볼 · 플라이 · 라이너/라인드라이브)
  // 이름은 땅볼 · 라이너 · 플라이로 맞춘다(발사각 입력값 '라인드라이브' · '플라이볼'도 같은 이름으로)
  const btypeOf = a => {
    const u = String(a.launchType || '').trim();
    if (u) return BT_NAME[u] || u;
    const n = String(a.res || '');
    return /땅볼/.test(n) ? '땅볼' : /라이너|라인드라이브/.test(n) ? '라이너' : /플라이/.test(n) ? '플라이' : '';
  };
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
      a.ft != null && a.ft !== '' && isFinite(a.ft) ? Math.round(a.ft * 0.3048) : '', a.ev != null ? +a.ev : '', a.launchAngle != null ? +a.launchAngle : '', btypeOf(a),
      cnt, a.count && a.count.o != null ? a.count.o : '', a.rbi || 0, (a.pitches || []).length,
      xy[i] ? r4(xy[i][0]) : '', xy[i] ? r4(xy[i][1]) : '', warnOf(a).join(' / '),
    ], ['td', 'tdL', 'td', 'tdB', 'td', 'td', 'td', 'td', 'td1', 'td', 'td', 'td', 'td', 'td', 'td', 'tdC', 'tdC', 'tdL']);
  });
  // 값이 하나도 없는 열은 숨긴다(지우지 않음 — 열 위치 그대로 · 엑셀 '숨기기 취소'로 보임): 타구속도 · 발사각 · 타구 유형
  [[8, a => a.ev], [9, a => a.launchAngle], [10, btypeOf]].forEach(([c, f]) => {
    if (rows.every(({ a }) => { const v = f(a); return v == null || v === ''; })) rec.hide(c);
  });
  // 차트용 열: 결과별 · 구종별 X/Y — 해당하는 행에만 값이 있다. labels = 점 옆 타석 번호(4단계)
  let hc = H.length;
  const resSer = RES_GROUPS.map(g => {
    const pick = i => (xy[i] && _resGroup(rows[i].a.res) === g.k ? xy[i] : null);
    const x = rec.column(0, hc, `[차트] ${g.label} X`, rows.map((_, i) => (pick(i) ? pick(i)[0] : null)), 'thAux', 'tdC');
    const y = rec.column(0, hc + 1, `[차트] ${g.label} Y`, rows.map((_, i) => (pick(i) ? pick(i)[1] : null)), 'thAux', 'tdC');
    rec.width(hc, 9).width(hc + 1, 9);
    hc += 2;
    return { name: g.label, x, y, color: g.color, sym: g.sym, size: g.size, n: rows.filter((_, i) => pick(i)).length, labels: rows.map((_, i) => (pick(i) ? String(i + 1) : null)) };
  });
  const ptSer = pts.map((pt, k) => {
    const pick = i => (xy[i] && rows[i].a.pt === pt ? xy[i] : null);
    const x = rec.column(0, hc, `[차트] ${pt} X`, rows.map((_, i) => (pick(i) ? pick(i)[0] : null)), 'thAux', 'tdC');
    const y = rec.column(0, hc + 1, `[차트] ${pt} Y`, rows.map((_, i) => (pick(i) ? pick(i)[1] : null)), 'thAux', 'tdC');
    rec.width(hc, 9).width(hc + 1, 9);
    hc += 2;
    return { name: pt, x, y, color: _ptColor(pt, k), sym: 'circle', size: 7, n: rows.filter((_, i) => pick(i)).length, labels: rows.map((_, i) => (pick(i) ? String(i + 1) : null)) };
  });
  // [집계] 열(4단계): 1 = 해당하는 타석. 「타구 차트」 요약표가 SUBTOTAL 로 보이는 행(필터 통과)만 센다
  const recAgg = (label, f) => {
    const c = hc++;
    rec.set(0, c, `[집계] ${label}`, 'thAux').width(c, 8);
    rows.forEach(({ a }, i) => { if (f(a)) rec.set(i + 1, c, 1, 'tdC'); });
    return _rng('타석 기록', c, rows.length);
  };
  const W_ = window;
  const dirAgg = (sw
    ? [['좌', a => !!W_._fieldSide && W_._fieldSide(a.deg) === 'L'], ['중', a => !!W_._fieldSide && W_._fieldSide(a.deg) === 'C'], ['우', a => !!W_._fieldSide && W_._fieldSide(a.deg) === 'R']]
    : [['당김', a => !!W_._isPull && W_._isPull(a)], ['센터', a => !!W_._isCtr && W_._isCtr(a)], ['밀어', a => !!W_._isOppo && W_._isOppo(a)]]
  ).map(([l, f]) => recAgg(l, f));
  const ltAgg = ['땅볼', '라이너', '플라이'].map(l => recAgg('발사각 ' + l, a => BT_NAME[String(a.launchType || '').trim()] === l));
  rec.filter = [0, 0, rows.length, hc - 1];

  // ── 투구 기록 (상대한 공) ──
  const pit = new Sheet('투구 기록');
  pit.print = 'data'; pit.freeze = 1;
  // 타석 내 순번 = 투구 seq(1부터) · 투구 결과 = 볼/루킹/헛스윙/파울/인플레이 · 스트라이크(구분 모름 = 투수 탭 연동) · 미기록(null)
  // 투구 로그 없는 타석의 결정구 1구(타석 구종·코스로 만든 행)는 둘 다 빈 칸
  const PH = ['순번', '경기', '타석 번호', '이닝', '구종', '코스', 'B-S', '투수', '위치 기록', '위치 X', '위치 Y', '타석 결과', '타석 내 순번', '투구 결과'];
  const PW = [6, 26, 8, 6, 9, 10, 6, 10, 10, 8, 8, 10, 8, 14];
  const resOf = p => (p.synth ? '' : !p.result ? '미기록' : p.result === 'strike' ? '스트라이크(구분 모름)' : ((window.P_RESULT_LBL || {})[p.result] || p.result));
  pit.line(0, 0, PH, 'th');
  PW.forEach((w, i) => pit.width(i, w));
  const plist = [];
  const abFlat = _abFlatMap();
  rows.forEach(({ a, game }, i) => {
    const ps = a.pitches && a.pitches.length ? a.pitches : (a.zone || a.pt ? [{ zone: a.zone, pt: a.pt, last: true, synth: true }] : []);
    const abP = ps.length ? _abPitcher(a, abFlat.get(a.id) || []).name : '';
    ps.forEach((p, j) => {
      const pos = _pitchXY(p.x, p.y, p.zone, (a.id || i) % 100000 + j * 7919);
      plist.push({ p, a, game, ab: i + 1, pos, seq: plist.length + 1, last: j === ps.length - 1, abP });
    });
  });
  // 2026-06-07 이전 기록은 공마다 카운트·투수가 없다 → 타석 마지막 공은 타석 카운트(a.count), 투수는 타석 단위 연결로 채운다
  const cntOf = o => (o.p.balls != null ? `${o.p.balls}-${o.p.strikes}`
    : o.last && o.a.count && o.a.count.b != null ? `${o.a.count.b}-${o.a.count.s ?? ''}` : '');
  const pNameOf = o => o.p.pitcher || o.abP || '';
  plist.forEach((o, i) => {
    const { p, a } = o;
    pit.line(i + 1, 0, [
      o.seq, o.game, o.ab, a.inn || '', p.pt || '', p.zone || '', cntOf(o),
      pNameOf(o), o.pos ? (o.pos.exact ? '정확' : '코스만') : '', o.pos ? r4(o.pos.x) : '', o.pos ? r4(o.pos.y) : '', a.res || '',
      p.synth ? '' : (p.seq != null ? p.seq : ''), resOf(p),
    ], ['td', 'tdL', 'td', 'td', 'td', 'td', 'td', 'td', 'td', 'tdC', 'tdC', 'td', 'td', 'td']);
  });
  const pNoCnt = plist.filter(o => !cntOf(o)).length, pNoName = plist.filter(o => !pNameOf(o)).length;
  const pPts = [...new Set(plist.map(o => o.p.pt || '미기록'))].sort((x, y) => plist.filter(o => (o.p.pt || '미기록') === y).length - plist.filter(o => (o.p.pt || '미기록') === x).length);
  let pc = PH.length;
  const ptOf = o => o.p.pt || '미기록';
  // 구종마다 두 시리즈(4단계): 정확한 위치 = 채운 원(범례에 구종), 코스만 = 속 빈 원(범례 숨김 — 아래 '코스만' 범례 하나로 설명)
  const pitchSer = pPts.map((pt, k) => {
    const color = _ptColor(pt, k);
    const ser = exact => {
      const pick = o => (o.pos && !!o.pos.exact === exact && ptOf(o) === pt ? o.pos : null);
      const nm = exact ? pt : `${pt} 코스만`;
      const x = pit.column(0, pc, `[차트] ${nm} X`, plist.map(o => (pick(o) ? pick(o).x : null)), 'thAux', 'tdC');
      const y = pit.column(0, pc + 1, `[차트] ${nm} Y`, plist.map(o => (pick(o) ? pick(o).y : null)), 'thAux', 'tdC');
      pit.width(pc, 9).width(pc + 1, 9);
      pc += 2;
      return { name: exact ? pt : `${pt} · 코스만`, x, y, color, sym: 'circle', size: 7, hollow: !exact, legend: exact, n: plist.filter(pick).length };
    };
    const ex = ser(true), zo = ser(false);
    return { name: pt, color, ex, zo, n: ex.n + zo.n };
  });
  const zoLegend = { name: '코스만(칸 안 임의 위치)', x: pit.column(0, pc, '[차트] 코스만 범례 X', [], 'thAux', 'tdC'), y: pit.column(0, pc + 1, '[차트] 코스만 범례 Y', [], 'thAux', 'tdC'),
    color: '9AA3B2', sym: 'circle', size: 7, hollow: true };
  pit.width(pc, 9).width(pc + 1, 9);
  pc += 2;
  const hasZo = pitchSer.some(t => t.zo.n);
  const typeSeries = (t, legend) => [{ ...t.ex, legend }, ...(t.zo.n ? [{ ...t.zo, legend: false }] : [])];
  // [집계] 열(4단계): 1 = 해당하는 공. 「투구 위치」 「구종별 공」 표가 SUBTOTAL 로 보이는 행만 센다
  const pitAgg = (label, f) => {
    const c = pc++;
    pit.set(0, c, `[집계] ${label}`, 'thAux').width(c, 8);
    plist.forEach((o, i) => { if (f(o)) pit.set(i + 1, c, 1, 'tdC'); });
    return _rng('투구 기록', c, plist.length);
  };
  const ptAgg = pPts.map(pt => ({
    pt, all: pitAgg(pt, o => ptOf(o) === pt), zoned: pitAgg(`${pt} 코스`, o => ptOf(o) === pt && ZONES_13.includes(o.p.zone)),
    inZ: pitAgg(`${pt} 존 안`, o => ptOf(o) === pt && ZONES_9.includes(o.p.zone)),
  }));
  pit.filter = [0, 0, Math.max(1, plist.length), pc - 1];

  // ── 리포트 ──
  const rep = new Sheet('리포트');
  const games = P.gameList.length;
  const first = P.gameList[0] && P.gameList[0].label, last = P.gameList[games - 1] && P.gameList[games - 1].label;
  for (let i = 0; i < 12; i++) rep.width(i, 10.5);
  _header(rep, `${P.name} 타격 분석 리포트`,
    [P.num !== '' && P.num != null ? '등번호 ' + P.num : '', bats, `${games}경기 ${st.pa}타석`, `생성 ${_today()}`].filter(Boolean).join('  ·  '), 11);
  _kpis(rep, 4, 0, [['타율', st.avg, 'kpi3'], ['출루율', st.obp, 'kpi3'], ['장타율', st.slg, 'kpi3'], ['OPS', st.ops, 'kpi3'], ['wOBA', st.woba, 'kpi3'], ['BABIP', st.babip, 'kpi3']]);
  let r = 7;
  rep.set(r, 0, '■ 시즌 누적 기록', 'sec');
  r = _table(rep, r + 1, 0, ['경기', '타석', '타수', '안타', '2루타', '3루타', '홈런', '타점', '볼넷', '사구', '삼진', '희생'],
    [[games, st.pa, st.ab, st.h, st.s2, st.s3, st.hr, st.rbi, st.bb, st.hbp, st.k, st.sf + st.sh]], 'td') + 1;
  rep.set(r, 0, '■ 비율 지표', 'sec');
  const dn = st.dn || 0, fn = st.fn || 0;
  // 방향 3칸: 당겨/센터/밀어(타자 기준) — 스위치는 필드 기준 좌/중/우
  const dirH = sw ? ['좌%', '중%', '우%'] : ['당겨%', '센터%', '밀어%'];
  const dirV = sw ? [fn ? st.fl / fn : '', fn ? st.fc / fn : '', fn ? st.fr / fn : '', fn] : [dn ? st.pull / dn : '', dn ? st.center / dn : '', dn ? st.oppo / dn : '', dn];
  r = _table(rep, r + 1, 0, ['삼진%', '볼넷%', '장타%', 'ISO', ...dirH, '방향 기록'],
    [[st.kRate, st.bbRate, st.xbhRate, st.iso, ...dirV]],
    ['tdP', 'tdP', 'tdP', 'td3', 'tdP', 'tdP', 'tdP', 'td']) + 1;
  if (pts.length) {
    rep.set(r, 0, '■ 구종별 성적', 'sec');
    rep.set(r, 3, '타석 마지막 공 기준', 'note');
    r = _table(rep, r + 1, 0, ['구종', '타석', '타수', '안타', '장타', '홈런', '삼진', '볼넷', '타율', '출루율', '장타율'],
      pts.map(pt => { const s = calcStats(rows.filter(o => o.a.pt === pt).map(o => o.a)); return [pt, s.pa, s.ab, s.h, s.s2 + s.s3 + s.hr, s.hr, s.k, s.bb, s.avg, s.obp, s.slg]; }),
      ['tdB', 'td', 'td', 'td', 'td', 'td', 'td', 'td', 'td3', 'td3', 'td3']) + 1;
  }
  // 투수별 성적(4단계): 투수가 연결된 타석만(「투구 기록」 투수 열과 같은 기준 — 직접 기록 → 같은 경기 투수 탭 시간순). 하나도 없으면 생략
  const byP = new Map();
  rows.forEach(({ a }) => {
    const nm = _abPitcher(a, abFlat.get(a.id) || []).name;
    if (nm) { if (!byP.has(nm)) byP.set(nm, []); byP.get(nm).push(a); }
  });
  if (byP.size) {
    const pRows = [...byP].map(([nm, abs]) => [nm, calcStats(abs)]).sort((x, y) => y[1].pa - x[1].pa);
    rep.set(r, 0, '■ 투수별 성적', 'sec');
    rep.set(r, 3, `투수가 연결된 ${pRows.reduce((s, x) => s + x[1].pa, 0)}타석 / 전체 ${st.pa}타석`, 'note');
    r = _table(rep, r + 1, 0, ['투수', '타석', '타수', '안타', '삼진', '볼넷', '타율'],
      pRows.map(([nm, s]) => [nm, s.pa, s.ab, s.h, s.k, s.bb, s.ab ? s.avg : '']),
      ['tdB', 'td', 'td', 'td', 'td', 'td', 'td3']) + 1;
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
  if (!P.bats) notes.push('좌/우타 미지정 → 우타로 가정해 당겨/센터/밀어를 계산했어요(「우타 가정」). 경기설정 라인업에서 타석(우타/좌타)을 고르면 바로 바뀌어요.');
  if (sw) notes.push('스위치 타자는 타석마다 치는 쪽이 달라(투수 손 기록 없음) 당겨/밀어로 나누지 않고 필드 기준 좌/중/우로 보여 줘요.');
  notes.push('방향 = 찍은 타구 위치의 각도로 나눈 필드 5구역(좌 <54° · 좌중 54~72° · 중 72~108° · 우중 108~126° · 우). 당겨/센터/밀어는 이 구역과 좌/우타로 계산 · 추정 거리(m)는 찍은 위치로 계산한 값이에요(측정값 아님).');
  const nWarn = rows.filter(({ a }) => warnOf(a).length).length;
  if (nWarn) notes.push(`「타석 기록」 확인 필요 ${nWarn}타석 — 결과 · 볼카운트 · 마지막 공 결과 · 이닝 기록이 서로 맞지 않아요(예: 삼진인데 스트라이크 2개, 한 경기에서 초/말 섞임). 저장은 그대로 두고 표시만 했어요. 「확인 필요」 열에서 필터로 모아 볼 수 있어요.`);
  if (pNoCnt || pNoName) notes.push(`「투구 기록」 B-S 빈 칸 ${pNoCnt}구 · 투수 빈 칸 ${pNoName}구 — 2026년 6월 7일 업데이트 전에 기록한 공은 공마다 카운트·투수가 저장되지 않았고, 투수 탭에서 투수를 고르지 않고 기록한 공도 투수가 비어요. 타석 마지막 공은 타석 카운트로, 투수는 같은 경기 투수 탭 기록으로 채울 수 있는 만큼 채웠어요.`);
  _bullets(rep, r, 0, notes);
  if (first && last && first !== last) rep.set(1, 0, [P.num !== '' && P.num != null ? '등번호 ' + P.num : '', bats, `${games}경기 ${st.pa}타석`, `${first} ~ ${last}`, `생성 ${_today()}`].filter(Boolean).join('  ·  '), 'sub');

  // ── 타구 차트 ──
  const spr = new Sheet('타구 차트');
  spr.print = 'landscape';
  for (let i = 0; i < 20; i++) spr.width(i, 10);
  const nXY = xy.filter(Boolean).length;
  _header(spr, `${P.name} 타구 분포`, `타구 ${nXY}개 · ${bats} · 점 = 타구가 떨어진 자리 (기록 화면에서 찍은 위치)`, 13);
  if (nXY && lines.field) {
    const fieldX = [0, 1], fieldY = _fieldRange(lines);
    spr.chart({ type: 'scatter', title: '결과별 타구', w: 510, h: 470, x: fieldX, y: fieldY,
      series: [lines.field, lines.infield, ...resSer.filter(s => s.n)] }, 4, 0);
    if (ptSer.some(s => s.n)) {
      spr.chart({ type: 'scatter', title: '구종별 타구 (마지막 공)', w: 510, h: 470, x: fieldX, y: fieldY,
        series: [lines.field, lines.infield, ...ptSer.filter(s => s.n)] }, 4, 7);
    }
    let rr = 27;
    // 요약표는 수식(SUBTOTAL)이라 「타석 기록」 필터를 따라 다시 계산된다(4단계) — 처음 값은 필터 없는 전체
    spr.set(rr, 0, '■ 타구 방향', 'sec');
    rr = _table(spr, rr + 1, 0, [...(sw ? ['좌', '중', '우'] : ['당겨치기', '센터', '밀어치기']), '방향 기록'],
      [_shareRow(dirAgg, dirV.slice(0, 3), dirV[3])], ['tdP', 'tdP', 'tdP', 'td']) + 1;
    const lt = Object.create(null);
    rows.forEach(({ a }) => { const k = BT_NAME[String(a.launchType || '').trim()]; if (k) lt[k] = (lt[k] || 0) + 1; });
    const ltN = Object.values(lt).reduce((s, v) => s + v, 0);
    spr.set(rr, 0, '■ 결과별 타구 수', 'sec');
    rr = _table(spr, rr + 1, 0, ['단타', '2·3루타', '홈런', '아웃'],
      [[1, 2, 3, 0].map(k => ({ f: `SUBTOTAL(102,${resSer[k].x.ref})`, v: resSer[k].n }))], 'td') + 1;
    if (ltN) {
      spr.set(rr, 0, '■ 타구 유형 (발사각 입력 타석)', 'sec');
      rr = _table(spr, rr + 1, 0, ['땅볼', '라이너', '플라이', '입력 수'],
        [_shareRow(ltAgg, ['땅볼', '라이너', '플라이'].map(k => (lt[k] || 0) / ltN), ltN)], ['tdP', 'tdP', 'tdP', 'td']) + 1;
    }
    spr.set(rr, 0, '• 「타석 기록」 시트에서 필터(▼)를 걸면 이 차트와 위 표(타구 방향 · 결과별 타구 수 · 타구 유형)가 같이 바뀌어요.', 'note');
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
      series: [lines.zgrid, lines.zbox, ...pitchSer.filter(t => t.n).flatMap(t => typeSeries(t, true)), ...(hasZo ? [zoLegend] : [])] }, 4, 0);
    let rr = 4;
    loc.set(rr, 7, '■ 구종별 공', 'sec');
    // 수식(SUBTOTAL) — 「투구 기록」 필터를 따라 다시 계산(4단계). 처음 값은 필터 없는 전체
    const allSum = ptAgg.map(a => `SUBTOTAL(109,${a.all})`).join('+');
    const pr = ptAgg.map(({ pt, all, zoned, inZ }) => {
      const ps = plist.filter(o => ptOf(o) === pt);
      const iz = ps.filter(o => ZONES_9.includes(o.p.zone)).length, zN = ps.filter(o => ZONES_13.includes(o.p.zone)).length;
      return [pt, { f: `SUBTOTAL(109,${all})`, v: ps.length }, { f: `IFERROR(SUBTOTAL(109,${all})/(${allSum}),"")`, v: ps.length / plist.length },
        { f: `IFERROR(SUBTOTAL(109,${inZ})/SUBTOTAL(109,${zoned}),"")`, v: zN ? iz / zN : '' }];
    });
    rr = _table(loc, rr + 1, 7, ['구종', '공', '비율', '존 안%'], pr, ['tdB', 'td', 'tdP', 'tdP']) + 1;
    _bullets(loc, rr, 7, [
      '채운 원 = 정확한 위치를 찍은 공 · 속 빈 원 = 「코스만」(칸만 기록 → 그 칸 안에 임의로 흩어 찍음, 정확한 위치 아님).',
      '타석 도중 투구를 따로 기록하지 않았다면 마지막 공(결정구) 1개만 있어요.',
      '「투구 기록」 시트에서 필터(▼)를 걸면 이 차트들과 「구종별 공」 표가 같이 바뀌어요.',
    ]);
    const multi = pitchSer.filter(t => t.n);
    if (multi.length > 1) {
      const r0 = 28;
      loc.set(r0, 0, '■ 구종별로 나눠 보기', 'sec');
      multi.forEach((t, i) => {
        loc.chart({ type: 'scatter', title: `${t.name} (${t.n}구)`, w: 290, h: 300, x: [0, 1], y: [0, 1],
          series: [lines.zgrid, lines.zbox, ...typeSeries(t, false)] }, r0 + 1 + Math.floor(i / 4) * 15, (i % 4) * 4);
      });
    }
  } else {
    loc.set(4, 0, '투구 코스가 기록된 공이 없어요. 기록 탭에서 코스(존)를 찍으면 차트가 채워져요.', 'note');
  }

  // ── 핫콜드존 ──
  const hz = new Sheet('핫콜드존');
  _header(hz, `${P.name} 코스별 핫/콜드 존`, `${bats} · 타율 기준 · 타석 마지막 공 코스 · 색 = 이 선수 전체 타율(${_f3(st.avg)}) 대비`, 6);
  const zs = {};
  ZONES_13.forEach(z => { zs[z] = calcStats(rows.filter(o => zoneOf(o.a) === z).map(o => o.a)); });
  const zoned = ZONES_13.reduce((s, z) => s + zs[z].pa, 0);
  // 스트라이크존 그림 (앱 스카우트 탭 코스 칸과 같은 기준: 3타수 이상만 색, 선수 전체 타율 대비)
  const png = _zonePng(z => {
    const s = zs[z];
    if (s.ab >= MIN_ZONE_AB) return { fill: _hotCold(s.avg, st.avg), main: _f3(s.avg), sub: `${s.h}/${s.ab} · ${s.pa}타석` };
    return { fill: null, main: s.ab ? `${s.h}/${s.ab}` : '—', sub: s.pa ? `${s.pa}타석 · ${MIN_ZONE_AB}타수 미만` : '기록 없음' };   // 3타수 미만: 타율 대신 안타/타수(4단계)
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
      if (s.ab < MIN_ZONE_AB) return { text: `${z}\n${s.ab ? `${s.h}/${s.ab}` : '—'}\n${s.pa}타석`, style: 'zna' };   // 3타수 미만: 안타/타수만
      return { text: `${z}\n${_f3(s.avg)}\n${s.h}/${s.ab} · ${s.pa}타석`, style: band(s) };
    });
    hz.line(rr + 1, 0, ['색상 범례', '콜드 (−.075↓)', '평균 (±.025)', '핫 (+.075↑)'], ['axis', 'h1', 'h3', 'h5']).height(rr + 1, 24);
    rr += 3;
  }
  hz.set(rr, 0, '■ 주요 분석', 'sec');
  const ins = _batterInsights(rows.map(o => o.a), st, { sw, assumed: !P.bats, zoneOf });
  rr = _bullets(hz, rr + 1, 0, ins.length ? ins : ['아래 표본 기준을 넘는 항목이 아직 없어요.']);
  hz.set(rr, 0, INS_NOTE, 'note');
  rr += 2;
  hz.set(rr, 0, '■ 코스별 기록', 'sec');
  _table(hz, rr + 1, 0, ['코스', '타석', '타수', '안타', '장타', '타율', '장타율'],
    ZONES_13.map(z => { const s = zs[z]; return [z, s.pa, s.ab, s.h, s.s2 + s.s3 + s.hr, s.ab ? s.avg : '', s.ab ? s.slg : '']; }),
    ['tdB', 'td', 'td', 'td', 'td', 'td3', 'td3']);
  hz.width(5, 15).width(6, 15);

  // 데이터 설명(4단계) — 새 시트는 맨 뒤(기존 시트 순서 그대로)
  let evUnit = 'km/h';
  try { if (localStorage.getItem('sl_ev_unit') === 'mph') evUnit = 'mph'; } catch (e) { /* 저장소 못 읽음 → 기본값 */ }
  const dict = _batterDictSheet({ P, st, games, first, last, bats, evUnit, hidden: Object.keys(rec.hiddenCols).map(c => H[c]) });
  const sheets = [rep, spr, loc, hz, rec, pit, bg, dict];
  _save(buildXlsx(sheets), _fileName(P.name, '타자분석'));
  _toast(`📊 ${P.name} 분석 엑셀 저장 (차트 포함)`);
  if (typeof window.gtag === 'function') window.gtag('event', 'export_analysis_xlsx', { kind: 'batter', pa: st.pa });
  return sheets;
}

// ── 데이터 설명 시트(4단계 · 타자 엑셀 맨 뒤) ─────────────────
// 시트·열 뜻과 단위, 좌표계, 용어, wOBA 가중치(코드 값 그대로), 확인 필요 7종, 앱 정보
const APP_URL = 'https://kimjeongcheol13.github.io/baseball-spray-chart/';
// 앱에 따로 정한 버전 번호가 없어 화면 스크립트(core.js)와 이 모듈의 ?v= 빌드 번호를 적는다
function _appBuild() {
  const v = s => { const m = /[?&]v=(\d+)/.exec(s || ''); return m ? m[1] : '?'; };
  let core = '';
  try { const el = document.querySelector('script[src*="js/core.js"]'); core = el ? el.getAttribute('src') : ''; } catch (e) { /* 문서 없음 */ }
  return `core v${v(core)} · 엑셀 모듈 v${v(import.meta.url)}`;
}
function _nowStamp() {
  const d = new Date();
  return `${_today()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
// o = { P, st, games, first, last, bats, hidden: 숨긴 열 이름[], evUnit }
function _batterDictSheet(o) {
  const sh = new Sheet('데이터 설명');
  sh.print = 'dataW';   // 인쇄: 가로 한 장 너비에 맞춤(세로는 여러 장)
  [12, 20, 64, 24].forEach((w, i) => sh.width(i, w));
  _header(sh, `${o.P.name} 엑셀 — 데이터 설명`, '시트 · 열 이름의 뜻과 단위, 좌표, 용어, 계산 기준', 3);
  let r = 4;
  const sec = (title, rows) => {
    sh.set(r, 0, '■ ' + title, 'sec');
    r = _table(sh, r + 1, 0, ['구분', '이름', '뜻', '단위 · 값'], rows, ['tdB', 'tdW', 'tdW', 'tdW']) + 1;
  };
  const W = WOBA_W, w2 = v => v.toFixed(2);
  const num = o.P.num !== '' && o.P.num != null ? `등번호 ${o.P.num}` : '등번호 없음';
  sec('이 파일', [
    ['앱', 'SprayLab', '한국 아마추어 야구 스프레이차트 · 타석 기록 웹앱', APP_URL],
    ['앱 버전', '빌드 번호', '앱에 따로 정한 버전 번호가 없어 화면 스크립트 빌드 번호(?v=)를 적었어요', _appBuild()],
    ['생성일', '내보낸 시각', '이 기기 시계 기준', _nowStamp()],
    ['선수', o.P.name, `리포트 부제목의 '${num}' = 경기설정 라인업의 '#번' 칸 값. 칸을 비우고 선수를 추가하면 라인업 순서 번호가 자동으로 들어가 실제 등번호와 다를 수 있어요`, num],
    ['기간', o.first && o.last ? (o.first === o.last ? o.first : `${o.first} ~ ${o.last}`) : '', '경기 날짜 순(날짜를 못 읽으면 저장 시각 순) · 한 경기 안은 이닝 순', `${o.games}경기 · ${o.st.pa}타석`],
    ['좌/우타', o.bats, '경기설정 라인업의 타석(우타/좌타/스위치) 값. 미지정이면 우타로 가정해 당겨/밀어를 계산', ''],
  ]);
  sec('시트', [
    ['1', '리포트', '누적 기록 · 비율 지표 · 구종별 성적 · 투수별 성적 · 경기별 기록', '내보낼 때 계산한 고정 값'],
    ['2', '타구 차트', '찍은 타구 위치(결과별 · 구종별)와 방향 · 결과 · 타구 유형 요약표', '「타석 기록」 필터를 따름'],
    ['3', '투구 위치', '상대한 공의 위치(구종별)와 구종별 공 표', '「투구 기록」 필터를 따름'],
    ['4', '핫콜드존', '코스(13칸)별 타율 그림 · 주요 분석 · 코스별 기록', '내보낼 때 계산한 고정 값'],
    ['5', '타석 기록', '타석 한 줄 = 한 행. 필터(▼)를 걸면 2번 시트가 같이 바뀜', ''],
    ['6', '투구 기록', '공 한 개 = 한 행. 필터(▼)를 걸면 3번 시트가 같이 바뀜', ''],
    ['7', '차트 배경', '경기장 윤곽 · 스트라이크존 선 좌표(차트 그리기용)', '수정하지 마세요'],
    ['8', '데이터 설명', '이 시트', ''],
  ]);
  sec('「리포트」 지표', [
    ['비율', '타율', '안타 ÷ 타수', '.000'],
    ['비율', '출루율', '(안타 + 볼넷 + 사구) ÷ (타수 + 볼넷 + 사구 + 희생플라이)', '.000'],
    ['비율', '장타율', '루타 ÷ 타수', '.000'],
    ['비율', 'OPS', '출루율 + 장타율', '.000'],
    ['비율', 'wOBA', '(볼넷·사구·단타·2루타·3루타·홈런 × 아래 가중치의 합) ÷ (타수 + 볼넷 + 사구 + 희생플라이)', '.000'],
    ['비율', 'BABIP', '(안타 − 홈런) ÷ (타수 − 삼진 − 홈런 + 희생플라이)', '.000'],
    ['비율', '삼진% · 볼넷%', '삼진 ÷ 타석 · 볼넷 ÷ 타석(볼넷만 — 사구 제외)', '%'],
    ['비율', '장타% · ISO', '(2루타 + 3루타 + 홈런) ÷ 타석 · 장타율 − 타율', '% · .000'],
    ['비율', '당겨% · 센터% · 밀어%', '방향이 있는 타구 중 비율(좌/우타 기준). 스위치 타자는 필드 기준 좌% · 중% · 우%', '% · 분모 = 방향 기록'],
    ['표', '구종별 성적', '타석 마지막 공(결정구)의 구종으로 나눈 성적', ''],
    ['표', '투수별 성적', '투수가 연결된 타석만. 연결 = 타석·공에 직접 적힌 투수 → 없으면 같은 경기 투수 탭 기록 중 이 타자에게 던진 시각이 가장 가까운 공의 투수', '연결 안 된 타석은 빠짐'],
  ]);
  sec('wOBA 가중치', [
    ['가중치', 'WOBA_W', `볼넷 ${w2(W.bb)} · 사구 ${w2(W.hbp)} · 단타 ${w2(W.s1)} · 2루타 ${w2(W.s2)} · 3루타 ${w2(W.s3)} · 홈런 ${w2(W.hr)}`, '앱 코드(js/constants.js) 값 그대로'],
    ['출처', '', '코드에 출처 표기가 없어요. 앱 안 비교 · 프로필 · 스카우트 화면과 같은 값', ''],
  ]);
  const hid = o.hidden.length ? ` (이 파일에서 숨긴 열: ${o.hidden.join(' · ')})` : '';
  sec('「타석 기록」 열', [
    ['열', '번호', '이 파일 안 타석 번호(기간 순). 차트 점 옆 숫자와 같음', ''],
    ['열', '경기', '경기 이름(날짜 · 상대)', ''],
    ['열', '이닝', '기록한 이닝', '예: 3회말'],
    ['열', '결과', '타석 결과', ''],
    ['열', '구종 · 코스', '타석 마지막 공(결정구)의 구종 · 코스. 투구 로그가 있으면 마지막 공에서 자동', '코스 13칸 = 9칸 + 볼 위 · 아래 · 내 · 외'],
    ['열', '방향', '찍은 타구 위치의 각도로 나눈 필드 5구역: 좌 <54° · 좌중 54~72° · 중 72~108° · 우중 108~126° · 우 ≥126° (0° = 3루 파울라인, 90° = 가운데, 180° = 1루 파울라인)', '좌 · 좌중 · 중 · 우중 · 우'],
    ['열', '추정 거리(m)', '찍은 위치와 구장 펜스 거리로 계산한 추정값(측정값 아님). 저장은 ft, 표시는 × 0.3048 반올림', 'm'],
    ['열', '타구속도', `입력한 숫자 그대로(변환 없이 저장). 단위는 앱의 EV 단위 설정 — 기록할 때 설정이 달랐다면 섞일 수 있어요. 값이 하나도 없으면 열을 숨겨요${hid}`, `이 기기 설정: ${o.evUnit}`],
    ['열', '발사각', '입력한 발사각. 값이 하나도 없으면 열을 숨겨요', '°'],
    ['열', '타구 유형', '발사각을 넣었으면 앱이 정한 유형(10° 미만 땅볼 · 25° 미만 라이너 · 그 이상 플라이)을 우선, 없으면 결과 이름에서(땅볼 · 플라이 · 라이너/라인드라이브가 들어간 결과). 내보낼 때만 계산 — 저장 안 함', '땅볼 · 라이너 · 플라이 · 빈 칸'],
    ['열', 'B-S', '타석 마지막 공을 던지기 직전 볼-스트라이크. 모든 공에 투구 결과가 있으면 자동 계산, 아니면 기록 화면 카운트판 값', '볼-스트라이크'],
    ['열', '아웃 · 타점', '기록 당시 아웃 수 · 타점', ''],
    ['열', '투구 수', '이 타석에 기록된 공 수(투구 로그 길이). 0이어도 타석 구종 · 코스가 있으면 「투구 기록」에 결정구 1구 행이 생겨요', '개'],
    ['열', '타구 X · 타구 Y', '아래 「좌표」 참고', '0 ~ 1'],
    ['열', '확인 필요', '아래 「확인 필요」 문구. 저장은 그대로 두고 표시만', ''],
    ['보조 열', '[차트] … X · Y', '차트용 좌표. 결과별 · 구종별로 해당 타석에만 값이 있어요', '수정하지 마세요'],
    ['보조 열', '[집계] …', '1 = 해당 타석. 「타구 차트」 표가 SUBTOTAL 수식으로 필터에 보이는 행만 세요', '1 · 빈 칸'],
  ]);
  sec('「투구 기록」 열', [
    ['열', '순번', '이 파일 안 공 순번', ''],
    ['열', '경기 · 이닝', '그 공이 나온 경기 · 이닝', ''],
    ['열', '타석 번호', '「타석 기록」 번호와 같음', ''],
    ['열', '구종 · 코스', '그 공의 구종 · 코스', ''],
    ['열', 'B-S', '그 공을 던지기 직전 볼-스트라이크. 2026-06-07 이전 기록은 공마다 카운트가 없어 타석 마지막 공만 타석 카운트로 채움', '볼-스트라이크'],
    ['열', '투수', '공에 적힌 투수 → 없으면 「투수별 성적」과 같은 방법으로 연결', ''],
    ['열', '위치 기록', '정확 · 코스만 (아래 「용어」)', ''],
    ['열', '위치 X · 위치 Y', '아래 「좌표」 참고', '0 ~ 1'],
    ['열', '타석 결과', '이 공이 속한 타석의 결과', ''],
    ['열', '타석 내 순번', '타석 안에서 몇 번째 공인지. 투구 로그 없이 타석 구종 · 코스로 만든 결정구 1구 행은 빈 칸', '1부터'],
    ['열', '투구 결과', '볼 · 루킹 · 헛스윙 · 파울 · 인플레이 · 스트라이크(구분 모름) · 미기록. 결정구 1구 행은 빈 칸', ''],
    ['보조 열', '[차트] 구종 X · Y', '정확한 위치 공(채운 원)', '수정하지 마세요'],
    ['보조 열', '[차트] 구종 코스만 X · Y', '코스만 공(속 빈 원)', '수정하지 마세요'],
    ['보조 열', '[차트] 코스만 범례 X · Y', '범례 「코스만(칸 안 임의 위치)」 표시용 — 비어 있음', '수정하지 마세요'],
    ['보조 열', '[집계] 구종 · 코스 · 존 안', '1 = 해당 공. 「투구 위치」 표가 SUBTOTAL 수식으로 필터에 보이는 행만 세요', '1 · 빈 칸'],
  ]);
  sec('좌표', [
    ['타구', '타구 X', '기록 화면 필드 그림의 가로 위치. 왼쪽 = 3루 쪽, 오른쪽 = 1루 쪽, 홈플레이트 ≈ 0.5', '0 ~ 1'],
    ['타구', '타구 Y', '세로 위치. 아래 → 위, 홈플레이트 ≈ 0.035, 위로 갈수록 외야. 구장 펜스 거리에 맞춘 그림 좌표라 앱에 저장된 값과 숫자가 달라요', '약 0 ~ 1'],
    ['투구', '위치 X', '기록 화면 투구 칸의 가로 위치. 왼쪽 = 내각(기록 화면 기준)', '0 ~ 1 · 스트라이크존 0.22 ~ 0.78'],
    ['투구', '위치 Y', '세로 위치. 아래 0 → 위 1, 위 = 높음', '0 ~ 1 · 스트라이크존 0.15 ~ 0.85'],
  ]);
  sec('용어', [
    ['위치 기록', '정확', '기록 화면에서 공 위치를 직접 찍은 공 — 위치 X · Y = 찍은 자리(차트 채운 원)', ''],
    ['위치 기록', '코스만', '코스 칸만 고른 공 — 위치 X · Y = 그 칸 안의 임의 위치(차트 속 빈 원). 실제 위치 아님. 다시 내보내도 같은 자리', ''],
    ['투구 결과', '미기록', '그 공의 결과(볼 · 스트라이크 등)를 고르지 않은 공', ''],
    ['투구 결과', '스트라이크(구분 모름)', '투수 탭에서 「스트라이크」로 기록 — 루킹/헛스윙 구분 없음', ''],
    ['구종', '미기록', '구종을 고르지 않은 공(「투구 위치」 범례)', ''],
    ['좌/우타', '우타 가정', '좌/우타 미지정 → 우타로 가정해 당겨/밀어 계산', ''],
    ['좌/우타', '스위치 · 방향 미분류', '스위치 타자는 당겨/밀어에서 빼고 필드 기준 좌/중/우로만 표시', ''],
    ['핫콜드존', '3타수 미만', `타율 대신 안타/타수만, 색 없음. ${MIN_ZONE_AB}타수 이상 칸만 타율과 색(이 선수 전체 타율 대비)`, ''],
  ]);
  sec('확인 필요 (7종)', [
    ['1', '삼진인데 스트라이크 n개', '모든 공에 결과가 있는데 스트라이크가 3개 미만. 결과가 없으면 수기 B-S로: 「삼진인데 B-S x-y (2스트라이크 아님)」', ''],
    ['2', '볼넷인데 볼 n개', '모든 공에 결과가 있는데 볼이 4개 미만. 결과가 없으면 수기 B-S로: 「볼넷인데 B-S x-y (3볼 아님)」', ''],
    ['3', '(결과)인데 마지막 공이 …', '안타 · 아웃류 · 희생 · 실책 등 인플레이 결과인데 마지막 공 결과가 인플레이가 아님', ''],
    ['4', '삼진/볼넷인데 마지막 공이 인플레이', '삼진 · 볼넷인데 마지막 공 결과가 인플레이', ''],
    ['5', '투구 결과 일부 누락', '일부 공에만 결과가 있음 → B-S 자동 계산을 하지 않고 카운트판 값 유지', 'n구 중 m구 미기록'],
    ['6', '초/말 섞임', '같은 경기에서 이 선수 타석에 초와 말이 섞임 — 수가 적은 쪽 타석에 표시(같으면 모두)', ''],
    ['7', '같은 이닝 3타석 이상', '같은 경기 같은 이닝에 이 선수 타석이 3개 이상 — 그 타석 모두 표시', ''],
    ['참고', 'B-S x-y (나올 수 없는 카운트)', '투구 로그가 없는 타석의 카운트판 값이 볼 4 이상 또는 스트라이크 3 이상. 카운트판 0-0은 안 쓴 것으로 보고 판단하지 않음', ''],
  ]);
  sec('「주요 분석」 기준', [
    ['규칙', '볼넷 · 삼진', `볼넷 ÷ 타석과 삼진 ÷ 타석, 차이(%p)`, `n = 타석 · ${INS_MIN.pa} 이상`],
    ['규칙', '결정구 존 밖', '코스가 기록된 타석 중 마지막 공이 볼 위 · 아래 · 내 · 외인 비율과 그 타석 결과', `n = 코스 기록 타석 · ${INS_MIN.zoned} 이상`],
    ['규칙', '방향 쏠림', `한 구역이 ${INS_MIN.dirTop * 100}% 이상(가장 많은 구역이 하나일 때)만`, `n = 방향 기록 · ${INS_MIN.dir} 이상`],
    ['규칙', '2스트라이크 이후', '모든 공에 결과가 있어 B-S가 자동 계산된 타석 중 2스트라이크까지 간 타석의 결과', `n = 해당 타석 · ${INS_MIN.twoS} 이상`],
    ['공통', '', '기준에 못 미치는 줄은 넣지 않아요. 평가 없이 수치만 적어요', ''],
  ]);
  sec('필터', [
    ['따름', '「타구 차트」', '「타석 기록」에 필터를 걸면 두 차트와 타구 방향 · 결과별 타구 수 · 타구 유형 표(SUBTOTAL 수식)가 같이 바뀌어요', ''],
    ['따름', '「투구 위치」', '「투구 기록」에 필터를 걸면 차트들과 구종별 공 표(SUBTOTAL 수식)가 같이 바뀌어요', ''],
    ['안 따름', '「리포트」 「핫콜드존」', '내보낼 때 계산한 고정 값 — 필터를 걸어도 바뀌지 않아요', ''],
  ]);
  return sh;
}

// ── 타석 ↔ 투수 연결 ─────────────────────────────────────────
// 타자 타석 기록(a)에는 투수 이름이 직접 들어 있지 않은 경우가 많다:
//   · 타자 패널에서 존을 클릭해 공을 기록하면 a.pitches[i].pitcher 에 그때 선택된 투수가 들어가지만
//   · 투수 패널(recordPitch)로 기록한 공은 AS.pitchers[].pitches 에만 쌓이고 타석에는 남지 않는다.
// 그래서 직접 적힌 투수가 없으면 같은 경기 투수 기록에서 그 타자에게 던진 공 중
// 타석 저장 시각(a.id)과 가장 가까운 공의 투수로 연결한다 (기록 탭 타자 상세 「투수별 요약」과 같은 기준).
// 타구를 먼저 찍고 투구를 나중에 기록한 경우도 AB_PITCH_SLACK 안이면 연결한다.
const AB_PITCH_SLACK = 5 * 60 * 1000;
// → { name, pitch } (pitch = 시간순으로 연결된 투수 기록의 공, 직접 적힌 경우는 null)
function _abPitcher(a, flat) {
  const direct = String(a.pitcher || '').trim();
  if (direct) return { name: direct, pitch: null };
  const ps = Array.isArray(a.pitches) ? a.pitches : [];
  for (let i = ps.length - 1; i >= 0; i--) {
    const n = String((ps[i] && ps[i].pitcher) || '').trim();
    if (n) return { name: n, pitch: null };
  }
  const t = +a.id;
  if (!isFinite(t) || !a.bname) return { name: '', pitch: null };
  let best = null, bestD = Infinity;
  flat.forEach(x => {
    if (x.batter !== a.bname) return;
    const d = x.id <= t ? t - x.id : x.id - t;
    if (x.id > t && d > AB_PITCH_SLACK) return;
    if (d < bestD) { bestD = d; best = x; }
  });
  return best ? { name: best.name, pitch: best.p } : { name: '', pitch: null };
}
// 타석 id → 그 경기 투수 기록의 공 목록 (_abPitcher 의 flat) — 타자 엑셀 「투구 기록」 투수 칸용
function _abFlatMap() {
  const m = new Map();
  buildData().games.forEach(g => {
    const flat = [];
    (g.pitchers || []).forEach(p => {
      if (!p || !p.name) return;
      (p.pitches || []).forEach(x => { if (x && isFinite(+x.id)) flat.push({ id: +x.id, name: p.name, batter: x.batter || '', p: x }); });
    });
    (g.abs || []).forEach(a => { if (a && a.id != null) m.set(a.id, flat); });
  });
  return m;
}
// P(투수 탭의 { name, apps }) 가 상대한 타석 중 타구 위치가 있는 것: [{ a, game, pitch }]
// 이번 경기만 보는 중(apps 가 전부 현재 경기)이면 현재 경기와, 그 경기를 이미 저장해 둔 사본(같은 투구 id)만 본다.
export function pitcherAbs(P, games) {
  const apps = (P && P.apps) || [];
  const onlyCur = apps.length > 0 && apps.every(ap => ap.current);
  const ids = new Set(apps.flatMap(ap => (ap.pitches || []).map(x => x && x.id).filter(v => v != null)));
  const inScope = g => !onlyCur || g.current || (g.pitchers || []).some(p => (p.pitches || []).some(x => x && ids.has(x.id)));
  const out = [];
  (games || []).forEach(g => {
    if (!g || !inScope(g)) return;
    const flat = [];
    (g.pitchers || []).forEach(p => {
      if (!p || !p.name) return;
      (p.pitches || []).forEach(x => { if (x && isFinite(+x.id)) flat.push({ id: +x.id, name: p.name, batter: x.batter || '', p: x }); });
    });
    (g.abs || []).forEach(a => {
      if (!a || a.x == null || a.y == null) return;
      const m = _abPitcher(a, flat);
      if (m.name === P.name) out.push({ a, game: g.label, pitch: m.pitch });
    });
  });
  return out;
}

// ── 투수 리포트 ──────────────────────────────────────────────
// P = { name, num, role, apps:[{ label, pitches }] }, S = pitcher.js _calc(P.apps), calc = _calc
export function exportPitcherXlsx(P, S, calc) {
  if (!P || !S || !S.n) { _toast('이 투수의 투구 기록이 없어요'); return; }
  const ROLE = { __proto__: null, SP: '선발', RP: '계투', CP: '마무리' };
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
  const H = ['순번', '경기', '이닝', '아웃', '주자', '타자', '구종', '코스', '결과', '위치 기록', '위치 X', '위치 Y'];
  [6, 26, 6, 6, 9, 10, 9, 10, 9, 10, 8, 8].forEach((w, i) => rec.width(i, w));
  rec.line(0, 0, H, 'th');
  plist.forEach((o, i) => {
    const { p } = o;
    rec.line(i + 1, 0, [o.seq, o.app.label, p.inning || '', _ptOuts(p), _ptRunners(p), p.batter || '', p.pt || '', p.zone || '', p.result || '',
      o.pos ? (o.pos.exact ? '정확' : '코스만') : '', o.pos ? r4(o.pos.x) : '', o.pos ? r4(o.pos.y) : ''],
    ['td', 'tdL', 'td', 'td', 'td', 'td', 'td', 'td', 'tdB', 'td', 'tdC', 'tdC']);
  });
  const noSit = plist.filter(o => _ptOuts(o.p) === '').length;
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
    [P.num ? '등번호 ' + P.num : '', P.role ? ROLE[P.role] || P.role : '', `${P.apps.length}경기`, `${S.n}구`, `상대 ${S.pa}타자`, `생성 ${_today()}`].filter(Boolean).join('  ·  '), 11);
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
    '「투구 기록」 시트에서 필터(▼)를 걸면 「구종별 투구위치」 차트도 같이 바뀌어요. 예: 결과 = 안타, 이닝 = 5, 주자 = 1·3루.',
  ];
  if (S.n < 50) notes.unshift(`표본이 적어요 (${S.n}구) — 수치는 참고용으로 봐 주세요.`);
  if (noSit) notes.push(`「투구 기록」 아웃·주자 빈 칸 ${noSit}구 — 아웃·주자(던지기 직전)는 경기 운영 모드에서 기록한 공만 저장돼요. 일반 모드로 기록했거나 2026년 10월 11일 업데이트 전에 기록한 공은 추정하지 않고 비워 뒀어요.`);
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

  // ── 타구 허용 (타자 기록 중 이 투수가 상대한 타석 — 직접 적힌 투수 또는 투구 기록과 시간순 연결) ──
  const hit = new Sheet('타구 허용');
  hit.print = 'landscape';
  for (let i = 0; i < 16; i++) hit.width(i, 10);
  const allowed = pitcherAbs(P, buildData().games);
  _header(hit, `${P.name} 타구 허용 분포`, `타구 ${allowed.length}개 · 타자 기록 중 이 투수가 상대한 타석 (투구 기록과 시간순으로 연결)`, 13);
  if (allowed.length && lines.field) {
    const axy = allowed.map(({ a }) => { const p = window._fieldPos(a); return [p[0], 1 - p[1]]; });
    const c0 = 8;
    hit.line(4, c0, ['경기', '타자', '결과', '구종', 'X', 'Y'], 'th');
    [22, 9, 9, 8, 7, 7].forEach((w, i) => hit.width(c0 + i, w));
    allowed.forEach(({ a, game, pitch }, i) => hit.line(5 + i, c0, [game, a.bname || '', a.res || '', a.pt || (pitch && pitch.pt) || '', r4(axy[i][0]), r4(axy[i][1])], ['tdL', 'td', 'tdB', 'td', 'tdC', 'tdC']));
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
    hit.set(4, 0, '이 투수에게 연결된 타구 위치 기록이 없어요. 기록 탭에서 투수를 선택해 투구를 기록하고, 같은 타자의 타구를 그라운드에 찍으면 채워져요.', 'note');
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
