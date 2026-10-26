// 분석 · 경기설정 그림의 3D 보기 — 타자 · 비교 · 스카우트 '타구 방향'(sprayFigure) · 투수 '코스'(위치 · 분포 · 피안타) · 타자 '본 공 위치'(svg.pc-plot)
//   · 경기설정 '구장 규격' 미리보기
//   그림은 각 탭이 지금처럼 2D 로 그린다. 이 모듈은 그 카드 머리에 2D | 3D 를 붙이고, 3D 면 2D 그림을 숨기고 바로 뒤에 3D 요소를 둔다
//   3D 에 넘기는 값은 그려진 2D 에서 읽는다: 타구 = 점 위치를 저장 좌표로 되돌림(core _coneToSemi 와 같은 식, 홈런은 펜스 밖까지)
//   · 코스 = 그림 좌표 그대로 + 2D 점 색(--pz-*) + 지금 고른 구역(.on · .picking · .pz-sel) · 분포 · 피안타 = 칸의 data-n · data-h · 글자
//   · 구장 규격 = 지금 구장 거리(core _fieldGeo().st)
//   투수 코스 3D 에서 끌어 고른 구역은 2D 와 같은 pitcher.js 로 넘긴다(setPitchPick({ a, b })) → 2D 가 다시 그린 것을 3D 가 읽는다
//   고른 보기는 이 기기에 기억(sl_ana_3d) — 모든 카드가 같이 바뀐다. three.js(spray3d.js)는 3D 를 처음 켤 때만 불러온다
//   WebGL 장면은 종류별로 모아 두고 다시 쓴다(탭을 다시 그려도 새로 만들지 않는다). 보이는 탭(분석 · 경기설정)의 그림만 붙인다
const KEY = 'sl_ana_3d';
let on = false;
try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
let ready = false, loading = false;
const pool = { 'spray-field-3d': [], 'pitch-zone-3d': [] };

const SPRAY_K = { 'd-1b': 'hit', 'd-xbh': 'xbh', 'd-hr': 'hr', 'd-out': 'out' };

// 점 하나의 그림 좌표(0~100). circle = 중심 · rect = 가운데 · path(마름모 'Mx y-r…') = 첫 점 + r
function _xy(el) {
  if (el.tagName === 'circle') return [+el.getAttribute('cx'), +el.getAttribute('cy')];
  if (el.tagName === 'rect') return [+el.getAttribute('x') + +el.getAttribute('width') / 2, +el.getAttribute('y') + +el.getAttribute('height') / 2];
  const m = /^M\s*([-\d.]+)[ ,]([-\d.]+)l([\d.]+)/.exec(el.getAttribute('d') || '');
  return m ? [+m[1], +m[2] + +m[3]] : null;
}

// 그림 좌표(필드 1 = 100) → 저장 좌표. _coneToSemi 와 같지만 홈런이 펜스 밖(최대 1.06)에 놓이게 거리를 1 로 자르지 않는다
// 파울라인 밖에 그려진 점(3D 에서 찍은 파울 타구)은 라인 위 + fa(라인 밖 각도°) — 반올림으로 생기는 0.5° 아래는 라인 위로 본다
function _toSemi(px, py) {
  const g = _fieldGeo(1), dx = px - g.cx, dy = py - g.cy, raw = Math.atan2(-dy, -dx);
  const phi = Math.max(_FQ, Math.min(3 * _FQ, raw)), fa = Math.abs(raw - phi) * 180 / Math.PI;
  const d = Math.min(Math.hypot(dx, dy) / _fenceR(g, phi), 1.06) * 0.97, ang = _phiToDeg(phi) * Math.PI / 180 - Math.PI;
  return { x: 0.5 + Math.cos(ang) * d, y: 1 + Math.sin(ang) * d, fa: fa > 0.5 ? fa : 0 };
}
const _dist = () => { const st = _fieldGeo(1).st; return [st.lfDist, st.cfDist, st.rfDist]; };

export function sprayData(fig) {
  const balls = [];
  fig.querySelectorAll('svg > :is(circle, rect, path)').forEach((el) => {
    const k = SPRAY_K[[...el.classList].find((c) => SPRAY_K[c])];
    const p = k && _xy(el);
    if (p) balls.push({ ..._toSemi(p[0] / 100, p[1] / 100), k });
  });
  const cap = fig.querySelector('figcaption');
  const name = cap ? [...cap.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '';
  return { balls, board: [name, `안타 ${balls.filter((b) => b.k !== 'out').length} · 타구 ${balls.length}`], dist: _dist() };
}

export function zoneData(svg) {
  const pts = [], cols = {}, cs = getComputedStyle(svg);
  svg.querySelectorAll(':scope > :is(circle, path)').forEach((el) => {
    const c = [...el.classList].find((n) => /^[pb]z-/.test(n) && n !== 'pz-plate' && n !== 'pz-grid');
    const p = c && _xy(el);
    if (!p) return;
    const k = c.slice(3);
    pts.push({ x: p[0], y: p[1], k, on: el.classList.contains('on') });
    if (!cols[k]) cols[k] = cs.getPropertyValue('--pz-' + k).trim() || '#ffffff';
  });
  // 고른 구역(pitcher.js _showBox 가 그린 사각형 — 탭이면 둥근 모서리)
  const r = svg.querySelector('.pz-sel'), at = (n) => +r.getAttribute(n) || 0;
  const sel = r && r.style.display !== 'none' && at('width') > 0
    ? { x0: at('x'), y0: at('y'), x1: at('x') + at('width'), y1: at('y') + at('height'), tap: at('rx') > 0 } : null;
  return { pts, cols, pick: svg.id === 'pcPlot', picking: svg.classList.contains('picking'), sel };
}

// 투수 코스 분포 · 피안타 9칸 (pitcher.js _zoneCard)
export function gridData(el) {
  return { grid: { view: el.dataset.view, cells: [...el.querySelectorAll('.sc-zc')].map((c) => ({ n: +c.dataset.n || 0, h: +c.dataset.h || 0, t: (c.querySelector('b') || {}).textContent || '' })) } };
}

// 경기설정 구장 규격: 공 없이 구장만
function stadData(card) {
  const d = _dist(), b = card.querySelector('.st-pre.on b');
  return { balls: [], board: [b ? b.textContent : '구장 규격', `좌 ${d[0]} · 중 ${d[1]} · 우 ${d[2]}m`], dist: d };
}

function _seg(cls) {
  return `<div class="${cls} an-3d-seg" role="group" aria-label="2D · 3D 보기">${[['2d', '2D'], ['3d', '3D']].map(([v, l]) =>
    `<button type="button" aria-pressed="${(v === '3d') === on}" onclick="ana3dView('${v}')">${l}</button>`).join('')}</div>`;
}

const _shown = (id) => { const v = document.getElementById(id); return v && v.classList.contains('active') ? v : null; };

function scan() {
  const items = [], sec = _shown('analysisView') && document.querySelector('#anaBody .ana-sec.on'), set = _shown('settingsView');
  if (sec) {
    sec.querySelectorAll('.an-card figure.an-spray').forEach((f) => { const s = f.querySelector(':scope > svg'); if (s) items.push({ fig: s, tag: 'spray-field-3d', data: () => sprayData(f) }); });
    sec.querySelectorAll('.an-card svg.pc-plot').forEach((s) => items.push({ fig: s, tag: 'pitch-zone-3d', data: () => zoneData(s) }));
    sec.querySelectorAll('.an-card .sc-zone[data-view]').forEach((z) => items.push({ fig: z, tag: 'pitch-zone-3d', data: () => gridData(z) }));
  }
  const st = set && set.querySelector('#stStad .st-prev > svg');
  if (st) items.push({ fig: st, tag: 'spray-field-3d', data: () => stadData(st.closest('#stStad')) });
  items.forEach(({ fig }) => {
    const card = fig.closest('.an-card, .sb-card'), hd = card.querySelector(':scope > :is(.an-hd, .sb-card-hd)');
    card.classList.toggle('an-is-3d', on && ready);   // 불러오는 동안은 2D 그대로
    const seg = hd && hd.querySelector('.an-3d-seg');
    if (hd && !seg) hd.insertAdjacentHTML('beforeend', _seg(card.classList.contains('an-card') ? 'an-seg' : 'sb-seg'));
    else if (seg) seg.querySelectorAll('button').forEach((b, i) => { const p = String((i === 1) === on); if (b.getAttribute('aria-pressed') !== p) b.setAttribute('aria-pressed', p); });
  });
  const used = new Set();
  if (on && ready) {
    const n = { 'spray-field-3d': 0, 'pitch-zone-3d': 0 };
    items.forEach(({ fig, tag, data }) => {
      let box = fig.nextElementSibling;
      if (!box || !box.classList.contains('an-3d-box')) {
        box = document.createElement('div');
        box.className = 'an-3d-box' + (tag === 'pitch-zone-3d' ? ' is-zone' : '');
        fig.after(box);
      }
      const list = pool[tag];
      let el = list[n[tag]];
      if (!el) {
        el = list[n[tag]] = document.createElement(tag);
        // 3D 에서 끌어 고른 구역 → 2D 와 같은 처리(결과 카드 · 고른 표시). 그 결과를 다음 scan 이 다시 읽어 3D 에 보인다
        if (tag === 'pitch-zone-3d') el.addEventListener('zonepick', (e) => { if (window.setPitchPick) window.setPitchPick(e.detail); });
      }
      n[tag]++; used.add(el);
      if (el.parentNode !== box) box.appendChild(el);
      const d = data(), key = JSON.stringify(d);
      if (el._key !== key) { el._key = key; el.update(d); }
    });
  }
  Object.values(pool).flat().forEach((el) => { if (!used.has(el) && el.isConnected) el.remove(); });   // 안 쓰는 장면은 떼어 그리기를 멈춘다
  if (on && !ready && !loading && items.length) {
    loading = true;
    import('./spray3d.js?v=6').then(() => { loading = false; ready = true; scan(); }).catch(() => {
      loading = false; on = false; scan();   // 2D 로 되돌린다(기억한 값은 그대로 — 다음에 열 때 다시 시도)
      if (window.showToast) window.showToast('3D 보기를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.', false);
    });
  }
}

export function ana3dView(v) {
  on = v === '3d';
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
  scan();
}

function _watch() {
  // 탭이 카드를 다시 그리거나(innerHTML) 하위 탭 · 탭을 바꾸면(.on · .active) 다시 붙인다. 스스로 바꾼 것도 다시 오지만 두 번째는 바뀌는 게 없다
  const mo = new MutationObserver(scan);
  ['analysisView', 'settingsView'].forEach((id) => { const v = document.getElementById(id); if (v) mo.observe(v, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); });
  scan();
}

window.ana3dView = ana3dView;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _watch); else _watch();
