// 분석 탭 그림의 3D 보기 — 타자 · 비교 · 스카우트 '타구 방향'(sprayFigure) · 투수 '코스' · 타자 '본 공 위치'(svg.pc-plot)
//   그림은 각 탭이 지금처럼 2D(SVG)로 그린다. 이 모듈은 그 카드 머리에 2D | 3D 를 붙이고, 3D 면 SVG 를 숨기고 바로 뒤에 3D 요소를 둔다
//   3D 에 넘기는 점은 그려진 SVG 에서 읽는다: 타구 = 점 위치를 저장 좌표로 되돌림(core _coneToSemi 와 같은 식, 홈런은 펜스 밖까지)
//   · 코스 = 그림 좌표 그대로 + 2D 점 색(--pz-*)
//   고른 보기는 이 기기에 기억(sl_ana_3d) — 모든 카드가 같이 바뀐다. three.js(spray3d.js)는 3D 를 처음 켤 때만 불러온다
//   WebGL 장면은 종류별로 모아 두고 다시 쓴다(탭을 다시 그려도 새로 만들지 않는다)
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
function _toSemi(px, py) {
  const g = _fieldGeo(1), dx = px - g.cx, dy = py - g.cy;
  const phi = Math.max(_FQ, Math.min(3 * _FQ, Math.atan2(-dy, -dx)));
  const d = Math.min(Math.hypot(dx, dy) / _fenceR(g, phi), 1.06) * 0.97, ang = _phiToDeg(phi) * Math.PI / 180 - Math.PI;
  return { x: 0.5 + Math.cos(ang) * d, y: 1 + Math.sin(ang) * d };
}

export function sprayData(fig) {
  const balls = [];
  fig.querySelectorAll('svg > :is(circle, rect, path)').forEach((el) => {
    const k = SPRAY_K[[...el.classList].find((c) => SPRAY_K[c])];
    const p = k && _xy(el);
    if (p) balls.push({ ..._toSemi(p[0] / 100, p[1] / 100), k });
  });
  const cap = fig.querySelector('figcaption');
  const name = cap ? [...cap.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '';
  const st = _fieldGeo(1).st;
  return { balls, board: [name, `안타 ${balls.filter((b) => b.k !== 'out').length} · 타구 ${balls.length}`], dist: [st.lfDist, st.cfDist, st.rfDist] };
}

export function zoneData(svg) {
  const pts = [], cols = {}, cs = getComputedStyle(svg);
  svg.querySelectorAll(':scope > :is(circle, path)').forEach((el) => {
    const c = [...el.classList].find((n) => /^[pb]z-/.test(n) && n !== 'pz-plate' && n !== 'pz-grid');
    const p = c && _xy(el);
    if (!p) return;
    const k = c.slice(3);
    pts.push({ x: p[0], y: p[1], k });
    if (!cols[k]) cols[k] = cs.getPropertyValue('--pz-' + k).trim() || '#ffffff';
  });
  return { pts, cols };
}

function _seg() {
  return `<div class="an-seg an-3d-seg" role="group" aria-label="2D · 3D 보기">${[['2d', '2D'], ['3d', '3D']].map(([v, l]) =>
    `<button type="button" aria-pressed="${(v === '3d') === on}" onclick="ana3dView('${v}')">${l}</button>`).join('')}</div>`;
}

function scan() {
  const sec = document.querySelector('#anaBody .ana-sec.on');
  if (!sec) return;
  const items = [
    ...[...sec.querySelectorAll('.an-card figure.an-spray')].filter((f) => f.querySelector(':scope > svg')).map((f) => ({ svg: f.querySelector(':scope > svg'), tag: 'spray-field-3d', data: () => sprayData(f) })),
    ...[...sec.querySelectorAll('.an-card svg.pc-plot')].map((s) => ({ svg: s, tag: 'pitch-zone-3d', data: () => zoneData(s) })),
  ];
  items.forEach(({ svg }) => {
    const card = svg.closest('.an-card'), hd = card.querySelector(':scope > .an-hd');
    card.classList.toggle('an-is-3d', on && ready);   // 불러오는 동안은 2D 그대로
    const seg = hd && hd.querySelector('.an-3d-seg');
    if (hd && !seg) hd.insertAdjacentHTML('beforeend', _seg());
    else if (seg) seg.querySelectorAll('button').forEach((b, i) => { const p = String((i === 1) === on); if (b.getAttribute('aria-pressed') !== p) b.setAttribute('aria-pressed', p); });
  });
  const used = new Set();
  if (on && ready) {
    const n = { 'spray-field-3d': 0, 'pitch-zone-3d': 0 };
    items.forEach(({ svg, tag, data }) => {
      let box = svg.nextElementSibling;
      if (!box || !box.classList.contains('an-3d-box')) {
        box = document.createElement('div');
        box.className = 'an-3d-box' + (tag === 'pitch-zone-3d' ? ' is-zone' : '');
        svg.after(box);
      }
      const list = pool[tag], el = list[n[tag]] || (list[n[tag]] = document.createElement(tag));
      n[tag]++; used.add(el);
      if (el.parentNode !== box) box.appendChild(el);
      const d = data(), key = JSON.stringify(d);
      if (el._key !== key) { el._key = key; el.update(d); }
    });
  }
  Object.values(pool).flat().forEach((el) => { if (!used.has(el) && el.isConnected) el.remove(); });   // 안 쓰는 장면은 떼어 그리기를 멈춘다
  if (on && !ready && !loading && items.length) {
    loading = true;
    import('./spray3d.js?v=2').then(() => { loading = false; ready = true; scan(); }).catch(() => {
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
  const av = document.getElementById('analysisView');
  if (!av) return;
  // 탭이 카드를 다시 그리거나(innerHTML) 하위 탭을 바꾸면(.on) 다시 붙인다. 스스로 바꾼 것도 다시 오지만 두 번째는 바뀌는 게 없다
  new MutationObserver(scan).observe(av, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  scan();
}

window.ana3dView = ana3dView;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _watch); else _watch();
