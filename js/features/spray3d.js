// 3D 방향도 — 분석 › 팀 '팀 타구 방향'의 3D 보기 (<spray-field-3d>)
//   three.js 는 랜딩과 같은 vendor 파일. team.js 가 3D 를 처음 누를 때만 이 모듈을 불러온다(2D 만 쓰면 내려받지 않음)
//   el.update({ balls: [{ x, y, k, fa, ov }], board: [윗줄, 큰 줄], dist: [좌, 중, 우] })
//     x,y = 저장 좌표(홈 0.5,1 · 펜스 반지름 .97) · k = sbPaint.kindOf (hit | xbh | hr | out, 그 밖은 그리지 않음) · fa = 파울 타구가 파울라인 밖으로 벗어난 각도(°, 없으면 라인 안)
//     ov = 외야석에 찍은 타구가 펜스 뒤로 몇 m 인지(없으면 펜스 안)
//   위치는 2D 방향도와 같은 규칙(core _semiToCone): 각도는 _degToPhi, 거리는 '펜스까지 비율' → 3D 펜스 기준
//   펜스는 dist(좌 · 중 · 우 m)대로 휜다(core _fenceR 와 같은 모양, 실제 m). dist 가 바뀌면 구장을 다시 짓는다 · 없으면 105m 원
//   끌기 = 돌리기 · 두 손가락 / Ctrl+휠 = 확대 · 두 번 누르기 = 처음 시점
//   el.tappable = true(기록 탭)면 짧게 누른 자리를 저장 좌표로 바꿔 'fieldtap' 이벤트(detail { x, y, deg, dist, fa?, ov?, px, py })를 보낸다 · el.mark({ x, y, fa, ov } | null) = 찍은 자리 고리
//   다시 그려도 같은 요소를 옮겨 붙이면 장면을 새로 만들지 않는다(WebGL 컨텍스트 1개)
//   <pitch-zone-3d> (아래) = 투구 코스 3D — 같은 돌리기 · 확대 · 그리기를 물려받고 장면 · 카메라 범위만 다르다
import * as THREE from '../landing/vendor/three.module.js';

const FONT = 'system-ui, sans-serif';
const CAM = { pos: [0, 86, 56], tgt: [0, -2, -58] };   // 중계 화면 시점
const FENCE = 105;
const S2 = Math.SQRT1_2;
const STAND = { off: 9, d: 3.2, n: 9, h0: 1.4, dh: 1.0 };   // 내야 관중석 계단
const BL = { gap: 2.5, d: 4.5, n: 6, h0: 3.6, dh: 1.4 };    // 외야석 계단 (펜스 뒤 gap 부터)
const DUG = { along: 24, len: 15, mid: STAND.off + 0.6, d: 2.2, h: 1.6 };   // 더그아웃: 홈에서 라인 따라 가운데 · 길이 · 라인에서 가운데 · 폭 · 높이
const OV = BL.gap + BL.d * BL.n;                             // 펜스 뒤 외야석 끝까지(m) = 저장 ov 의 최댓값 (core _OV_MAX 와 같은 값)
const EYE = 0.075;                                           // 중앙 백스크린 반각(rad)
const KINDS = ['out', 'hit', 'xbh', 'hr'];                   // 그리는 순서 = 겹칠 때 위로 오는 순서 (2D 와 같음)
const Q = Math.PI / 4;                                       // 좌측 폴 각도 (core _FQ) · 중앙 2Q · 우측 폴 3Q
// 카메라: 처음 시점 · near/far · 확대 반지름 · 위아래 각 범위 · 끌어서 더하는 위아래 각 범위 (k = 105m 구장 대비 크기)
// box = 보는 점(끌어 옮기기 · 확대)이 갈 수 있는 범위 [[x, y, z] 최소, 최대]
const sprayCfg = (k) => ({ cam: { pos: CAM.pos.map((v) => v * k), tgt: CAM.tgt.map((v) => v * k) }, near: 4 * k, far: 900 * k, r: [40 * k, 260 * k], phi: [0.2, 1.45], uPhi: [-0.5, 0.6], box: [[-150 * k, -5 * k, -170 * k], [150 * k, 30 * k, 40 * k]] });

// 방향(phi) → 펜스까지 m. core _fenceR 와 같은 모양(좌 · 우 폴은 짧고 가운데는 깊게)
export function fenceFn(dist) {
  const [lf, cf, rf] = Array.isArray(dist) && dist.length === 3 && dist.every((v) => +v > 0) ? dist.map(Number) : [FENCE, FENCE, FENCE];
  const kl = lf / cf, kr = rf / cf;
  return (phi) => {
    const t = (Math.max(Q, Math.min(3 * Q, phi)) - Q) / (2 * Q);
    return t < 0.5 ? cf * (kl + (1 - kl) * Math.sin(t * Math.PI)) : cf * (kr + (1 - kr) * Math.sin((1 - t) * Math.PI));
  };
}
const ROUND = fenceFn();

// 저장 좌표 → 필드 [x, z] (m, 홈 = 원점 · 중견 = -z). 펜스 너머는 외야석 그 줄 한가운데(기호가 다음 줄 계단에 가리지 않게), 그 밖의 타구는 펜스 안쪽에 놓는다
//   ov = 3D 에서 외야석에 찍은 타구가 펜스 뒤 몇 m 인지(그 자리 그대로) · ov 없는 홈런은 펜스 밖 비율(2D 처럼 최대 6%)을 외야석 깊이(OV)로 늘린다 — 펜스 위 = 첫 줄
//   (core _semiToCone 은 거꾸로 ov 를 펜스 밖 6% 안에 줄여 그린다 → 2D 그림을 읽는 분석 3D(ana3d)도 같은 줄에 놓인다)
// fa > 0 = 파울 타구: 라인 위 자리에서 파울라인 밖으로 fa° 돌린다. 내야 관중석 위면 외야석처럼 그 줄 한가운데
// dy 를 -0 으로 자르는 이유 = core _semiToCone (왼쪽 라인 y = 1 → 오른쪽으로 읽힘)
export function toField(x, y, hr, R = ROUND, fa = 0, ov = 0) {
  const dx = x - 0.5, dy = Math.min(y - 1, -0);
  const deg = (Math.atan2(dy, dx) + Math.PI) * 180 / Math.PI;
  const phi = typeof _degToPhi === 'function' ? _degToPhi(deg) : (45 + deg / 2) * Math.PI / 180;
  const F = R(phi), s0 = F + BL.gap;
  let r = Math.min(Math.hypot(dx, dy) / 0.97, 1.06) * F, p = phi;
  const deep = ov > 0 ? Math.min(ov, OV) : hr && r >= F * 0.999 ? Math.max(0, r / F - 1) / 0.06 * OV : -1;   // 펜스 뒤 m (-1 = 펜스 안)
  if (deep >= 0) r = s0 + BL.d * (Math.min(BL.n - 1, Math.floor(Math.max(0, F + deep - s0) / BL.d)) + 0.5);
  else r = Math.min(r, F - 2);
  if (fa > 0) {
    const along = r * Math.cos(fa * Math.PI / 180), row = Math.floor((r * Math.sin(fa * Math.PI / 180) - STAND.off) / STAND.d);
    const side = row >= 0 && along <= Math.max(R(Q), R(3 * Q)) + 7 ? STAND.off + STAND.d * (Math.min(STAND.n - 1, row) + 0.5) : r * Math.sin(fa * Math.PI / 180);
    r = Math.hypot(along, side); p += (phi < 2 * Q ? -1 : 1) * Math.atan2(side, along);
  }
  return [-r * Math.cos(p), -r * Math.sin(p)];
}
// 필드 [x, z] → 저장 좌표 { x, y, deg, dist, fa?, ov? }. core _coneToSemi 와 같은 식이지만 3D 는 파울 지역 · 관중석도 찍힌다(홈 뒤만 null):
//   x,y,deg 는 파울라인 사이 · 펜스(.97)까지라서(방향 · 거리 통계는 그대로) 파울 지역은 가까운 파울라인 위 + fa = 라인 밖 각도(°),
//   펜스 너머(외야석)는 펜스 위 + ov = 펜스 뒤 m (그리는 쪽만 쓴다)
export function fromField(x, z, R = ROUND) {
  if (z > 0) return null;
  const raw = Math.atan2(-z, -x), phi = Math.max(Q, Math.min(3 * Q, raw));
  const frac = Math.hypot(x, z) / R(phi);
  const deg = typeof _phiToDeg === 'function' ? _phiToDeg(phi) : (phi * 180 / Math.PI - 45) * 2;
  const a = deg * Math.PI / 180 - Math.PI, d = Math.min(frac, 1) * 0.97;
  const s = { x: 0.5 + Math.cos(a) * d, y: 1 + Math.sin(a) * d, deg, dist: d };
  const fa = Math.round(Math.abs(raw - phi) * 1800 / Math.PI) / 10, ov = Math.min(OV, Math.round((frac - 1) * R(phi) * 10) / 10);
  if (fa) s.fa = fa;
  else if (ov > 0) s.ov = ov;
  return s;
}
// 그 자리 높이: 외야석(펜스 뒤 gap 부터) · 내야 관중석(파울라인 밖 STAND.off 부터, 라인 따라 폴 + 7m 까지) · 더그아웃 위면 그 높이, 아니면 땅
const groundY = (x, z, R) => {
  const r = Math.hypot(x, z), phi = Math.atan2(-z, -x), out = Math.max(Q - phi, phi - 3 * Q);
  if (out > 0) {
    const side = r * Math.sin(out), along = r * Math.cos(out), s = side - STAND.off;
    if (Math.abs(along - DUG.along) <= DUG.len / 2 && Math.abs(side - DUG.mid) <= DUG.d / 2) return DUG.h;
    return s < 0 || along > Math.max(R(Q), R(3 * Q)) + 7 ? 0 : STAND.h0 + STAND.dh * Math.min(STAND.n - 1, Math.floor(s / STAND.d));
  }
  const s = r - R(phi) - BL.gap;
  return s < 0 ? 0 : BL.h0 + BL.dh * Math.min(BL.n - 1, Math.floor(s / BL.d));
};

// 텍스처 무늬가 매번 같게 고정 난수
let seed = 7;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// 꼭짓점 위치로 uv 를 다시 만든다: f(x, y, z) → [u, v]
function uvFrom(g, f) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { const [u, v] = f(p.getX(i), p.getY(i), p.getZ(i)); uv[2 * i] = u; uv[2 * i + 1] = v; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
const grassUV = (x, y, z) => [x / 10, z / 10];   // 잔디 10m · 흙 5m 타일
const dirtUV = (x, y, z) => [x / 5, z / 5];
const ringUV = (R) => (x, y, z) => [Math.atan2(-z, x) * R / 4, Math.hypot(x, z) / 3.4];

function label(text, o = {}) {
  const fs = 34, pad = 16;
  const c = document.createElement('canvas'), ctx = c.getContext('2d'), font = `800 ${fs}px ${FONT}`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2, h = fs + pad * 1.3;
  c.width = w; c.height = h;
  ctx.font = font;
  if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 8; }
  ctx.fillStyle = o.fg || '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, pad, h / 2 + 1);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  const s = o.scale || 0.085; sp.scale.set(w * s, h * s, 1); sp.renderOrder = 20;
  return sp;
}

function sectorShape(ri, ro, a0, a1) {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, ro, a0, a1, false);
  sh.absarc(0, 0, ri, a1, a0, true);
  sh.closePath();
  return sh;
}
function ringSector(ri, ro, a0, a1, h) {
  return new THREE.ExtrudeGeometry(sectorShape(ri, ro, a0, a1), { depth: h, bevelEnabled: false, curveSegments: 48 }).rotateX(-Math.PI / 2);
}
// 펜스를 따라 휘는 부채꼴 띠(바닥 모양): 안 · 밖 반지름이 방향(phi)마다 다르다. rIn 이 없으면 홈까지 채운다
//   모양 좌표 (-r cos phi, r sin phi) → rotateX(-90°) 하면 필드 (x, z) = (-r cos phi, -r sin phi)
function fan(rIn, rOut, a0 = Q, a1 = 3 * Q, n = 96) {
  const P = (phi, r) => new THREE.Vector2(-r * Math.cos(phi), r * Math.sin(phi));
  const out = [], inn = [];
  for (let i = 0; i <= n; i++) { const p = a0 + (a1 - a0) * i / n; out.push(P(p, rOut(p))); if (rIn) inn.unshift(P(p, rIn(p))); }
  return new THREE.Shape(rIn ? out.concat(inn) : [new THREE.Vector2(0, 0), ...out]);
}
const fanFloor = (rIn, rOut) => new THREE.ShapeGeometry(fan(rIn, rOut)).rotateX(-Math.PI / 2);
// 펜스를 따라 세운 띠 (반지름 = 펜스 + off, 높이 y0~y1)
function wallStrip(R, off, y0, y1, n = 96) {
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const p = Q + 2 * Q * i / n, r = R(p) + off, x = -r * Math.cos(p), z = -r * Math.sin(p);
    pos.push(x, y0, z, x, y1, z);
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// 가운데가 원점인 w × l 바닥, 높이 h. 그룹 0 = 위·아래, 1 = 옆면 (상자보다 draw call 이 적다)
function slab(w, l, h) {
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, -l / 2); sh.lineTo(w / 2, -l / 2); sh.lineTo(w / 2, l / 2); sh.lineTo(-w / 2, l / 2); sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2);
}

// 구장(움직이지 않는 부분). 색은 시안에서 LightCraft 로 보정한 값. R = 방향별 펜스 거리 → 외야 · 펜스 · 외야석 · 전광판이 그 모양을 따른다
function build(R) {
  const LP = R(Q), RP = R(3 * Q), CF = R(2 * Q), k = Math.max(LP, CF, RP) / FENCE;
  const scene = new THREE.Scene();
  scene.background = canvasTex(4, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#191e2c'); g.addColorStop(0.55, '#11151c'); g.addColorStop(1, '#12151C');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }, false);
  scene.fog = new THREE.Fog('#11151c', 240 * k, 430 * k);

  const grassTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#347046'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 3000; k++) { x.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)'; x.fillRect(rng() * w, rng() * h, 2, 2); }
  });
  const dirtTex = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#986e45'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 1400; k++) { x.fillStyle = rng() < 0.5 ? 'rgba(255,236,210,.07)' : 'rgba(40,20,5,.09)'; x.fillRect(rng() * w, rng() * h, 1.5, 1.5); }
  });
  // 타일 1장 = 좌석 8개 × 4줄 (4m × 3.4m). 흰 좌석이라 구역 색을 입힌다
  const seatTex = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#b4b9c4'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    for (let r = 0; r < 4; r++) for (let s = 0; s < 8; s++) x.fillRect(s * 16 + 2, r * 32 + 8, 12, 15);
  });
  const glowTex = canvasTex(128, 128, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,248,230,1)'); g.addColorStop(0.18, 'rgba(255,240,205,.55)'); g.addColorStop(1, 'rgba(255,240,205,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }, false);

  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, ...extra });
  const M = {
    ground: std('#161a22', { roughness: 1 }),
    grass: std('#c7fce2', { map: grassTex }),
    band: std('#b1e6c9', { map: grassTex }),
    foul: std('#a7dabe', { map: grassTex }),
    dirt: std('#ffffff', { map: dirtTex }),
    track: std('#bfc5d8', { map: dirtTex }),
    line: std('#F4F1EA', { roughness: 0.6 }),
    wall: std('#1f4a37', { roughness: 0.85, side: THREE.DoubleSide }),
    cap: std('#E8C45A', { roughness: 0.5, side: THREE.DoubleSide }),
    seatLow: std('#545c70', { map: seatTex, roughness: 0.85 }),
    seatHigh: std('#3f4657', { map: seatTex, roughness: 0.85 }),
    seatRed: std('#833740', { map: seatTex, roughness: 0.85 }),
    riser: std('#1f242e'),
    rim: std('#8f97a8', { roughness: 0.7 }),
    eye: std('#17261e', { roughness: 1 }),
    dugout: std('#0c0f14', { roughness: 1 }),
    roof: std('#353c4a', { roughness: 0.8 }),
    tower: std('#3A4050', { roughness: 0.6, metalness: 0.3 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#f5f1e6', emissive: '#fff3d6', emissiveIntensity: 1.6 }),
    board: std('#0B0D12', { roughness: 0.4 }),
  };
  const add = (g, m, o = {}) => {
    const mesh = new THREE.Mesh(g, m);
    if (o.y) mesh.position.y = o.y;
    mesh.castShadow = !!o.cast; mesh.receiveShadow = o.receive !== false;
    scene.add(mesh); return mesh;
  };

  add(new THREE.CircleGeometry(300 * k, 64).rotateX(-Math.PI / 2), M.ground, { y: -0.06 });

  // 파울 지역: 관중석 앞 짧은 트랙까지 잔디 (양쪽 띠는 월드 좌표 uv 라 무늬가 이어진다)
  const L = Math.max(LP, RP) + 7, dF = STAND.off, dT = 1.6;
  [[-1, -3 * Math.PI / 4], [1, 3 * Math.PI / 4]].forEach(([sgn, rot]) => {
    [[0, dF - dT, M.foul, grassUV], [dF - dT, dF, M.track, dirtUV]].forEach(([a, b, mat, uv]) => {
      const mid = (a + b) / 2;
      const g = new THREE.BoxGeometry(b - a, 0.04, L).rotateY(rot).translate(sgn * (L / 2 + mid) * S2, -0.03, -(L / 2 - mid) * S2);
      add(uvFrom(g, uv), mat);
    });
  });
  add(uvFrom(new THREE.ShapeGeometry(sectorShape(0.01, dF - dT, Math.PI * 1.25, Math.PI * 1.75), 24).rotateX(-Math.PI / 2), grassUV), M.foul, { y: -0.01 });
  add(uvFrom(new THREE.ShapeGeometry(sectorShape(dF - dT, dF, Math.PI * 1.25, Math.PI * 1.75), 24).rotateX(-Math.PI / 2), dirtUV), M.track, { y: -0.01 });

  // 페어 지역 + 워닝 트랙 + 2D 와 같은 동심원 잔디 띠
  add(uvFrom(fanFloor(null, R), grassUV), M.grass);
  add(uvFrom(fanFloor((p) => R(p) - 5.5, R), dirtUV), M.track, { y: 0.02 });
  [38, 57, 76, 95].forEach((r) => {   // 105m 구장의 띠 자리를 펜스 비율로
    add(uvFrom(fanFloor((p) => R(p) * r / FENCE, (p) => R(p) * Math.min(r + 9.5, 99.5) / FENCE), grassUV), M.band, { y: 0.01 });
  });

  // 내야 흙: 파울라인을 따라 홈에서 마운드 중심 29m 호까지
  const tD = (18.4 + Math.sqrt(18.4 ** 2 + 2 * (29 ** 2 - 18.4 ** 2))) / 2;
  const dirt = new THREE.Shape();
  dirt.moveTo(0, 0); dirt.lineTo(-tD, tD);
  dirt.absarc(0, 18.4, 29, Math.atan2(tD - 18.4, -tD), Math.atan2(tD - 18.4, tD), true);
  dirt.lineTo(0, 0);
  add(uvFrom(new THREE.ShapeGeometry(dirt, 48).rotateX(-Math.PI / 2), dirtUV), M.dirt, { y: 0.03 });
  add(uvFrom(new THREE.CircleGeometry(4, 32).rotateX(-Math.PI / 2), dirtUV), M.dirt, { y: 0.03 });
  const inGrass = new THREE.Shape([[0, 4.6], [14.8, 19.4], [0, 34.2], [-14.8, 19.4]].map(([x, y]) => new THREE.Vector2(x, y)));
  add(uvFrom(new THREE.ShapeGeometry(inGrass).rotateX(-Math.PI / 2), grassUV), M.grass, { y: 0.05 });
  add(uvFrom(new THREE.CylinderGeometry(2.6, 3.2, 0.35, 32), dirtUV), M.dirt, { cast: true }).position.set(0, 0.2, -18.4);
  add(new THREE.BoxGeometry(0.6, 0.06, 0.16), M.line).position.set(0, 0.4, -18.4);

  // 파울라인 · 베이스 · 홈플레이트
  [[-1, LP], [1, RP]].forEach(([sgn, len]) => {
    const ln = add(new THREE.BoxGeometry(0.22, 0.03, len), M.line, { y: 0.07 });
    ln.position.x = sgn * (len / 2) * S2; ln.position.z = -(len / 2) * S2; ln.rotation.y = sgn * 3 * Math.PI / 4;
  });
  [[19.4, -19.4], [0, -38.8], [-19.4, -19.4]].forEach(([x, z]) => {
    const b = add(new THREE.BoxGeometry(1.1, 0.16, 1.1), M.line, { cast: true });
    b.position.set(x, 0.1, z); b.rotation.y = Math.PI / 4;
  });
  add(new THREE.BoxGeometry(0.9, 0.05, 0.9), M.line, { y: 0.07 }).rotation.y = Math.PI / 4;

  // 외야 펜스 + 노란 홈런 라인 + 파울 폴
  add(wallStrip(R, 0, 0, 3.2), M.wall, { cast: true });
  add(wallStrip(R, 0.1, 3.06, 3.34), M.cap);
  [[-1, LP], [1, RP]].forEach(([sgn, r]) => { add(new THREE.CylinderGeometry(0.25, 0.25, 16, 12), M.cap, { cast: true }).position.set(sgn * r * S2, 8, -r * S2); });

  // 내야 관중석: 파울라인을 따라 계단 + 홈 뒤 둥근 구역(아래 4줄은 붉은 좌석)
  for (let i = 0; i < STAND.n; i++) {
    const di = STAND.off + STAND.d * i, h = STAND.h0 + STAND.dh * i, seat = i < 4 ? M.seatLow : M.seatHigh;
    [[-1, -3 * Math.PI / 4], [1, 3 * Math.PI / 4]].forEach(([sgn, rot]) => {
      const mid = di + STAND.d / 2;
      const g = uvFrom(slab(STAND.d, L, h), (x, y, z) => [z / 4, x / 3.4]);
      g.rotateY(rot).translate(sgn * (L / 2 + mid) * S2, 0, -(L / 2 - mid) * S2);
      add(g, [seat, M.riser], { cast: true });
    });
    add(uvFrom(ringSector(di, di + STAND.d, Math.PI * 1.25, Math.PI * 1.75, h), ringUV(di + STAND.d / 2)), [i < 4 ? M.seatRed : seat, M.riser], { cast: true });
  }
  const top = STAND.h0 + STAND.dh * (STAND.n - 1), back = STAND.off + STAND.d * STAND.n;
  [[-1, -3 * Math.PI / 4], [1, 3 * Math.PI / 4]].forEach(([sgn, rot]) => {
    add(new THREE.BoxGeometry(0.6, 1.4, L).rotateY(rot).translate(sgn * (L / 2 + back - 0.3) * S2, top + 0.7, -(L / 2 - back + 0.3) * S2), M.rim, { cast: true });
  });
  add(ringSector(back - 0.6, back, Math.PI * 1.25, Math.PI * 1.75, 1.4), M.rim, { y: top });
  [-1, 1].forEach((sgn) => {   // 더그아웃
    add(slab(DUG.d, DUG.len, DUG.h).rotateY(sgn * 3 * Math.PI / 4).translate(sgn * (DUG.along + DUG.mid) * S2, 0, -(DUG.along - DUG.mid) * S2), [M.roof, M.dugout]);
  });

  // 외야석(펜스 뒤를 따라 휜다) + 가운데 어두운 백스크린
  for (let i = 0; i < BL.n; i++) {
    const h = BL.h0 + BL.dh * i, ri = (p) => R(p) + BL.gap + BL.d * i, ro = (p) => ri(p) + BL.d;
    [[Q - 0.09, 2 * Q - EYE, M.seatHigh], [2 * Q - EYE, 2 * Q + EYE, M.eye], [2 * Q + EYE, 3 * Q + 0.09, M.seatHigh]].forEach(([a0, a1, seat]) => {
      const g = new THREE.ExtrudeGeometry(fan(ri, ro, a0, a1, 48), { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2);
      add(uvFrom(g, ringUV(CF + BL.gap + BL.d * (i + 0.5))), [seat, M.riser], { cast: true });
    });
  }
  const BACK = CF + BL.gap + BL.d * BL.n;   // 가운데 외야석 뒤끝 (105m 구장 = 134.5)

  // 조명탑(빛 번짐 포함) — 외야 쪽은 외야석 뒤, 중계 화면 안에 들어오는 높이
  const tb = (BACK + 7.2) / Math.hypot(72, 122);
  [[-98, 24, 42], [98, 24, 42], [-72 * tb, -122 * tb, 28], [72 * tb, -122 * tb, 28]].forEach(([x, z, h]) => {
    add(new THREE.CylinderGeometry(0.5, 0.9, h, 10), M.tower).position.set(x, h / 2, z);
    const head = add(new THREE.BoxGeometry(9, 4, 1.2), M.lamp);
    head.position.set(x, h + 1, z); head.lookAt(0, 0, -45);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff1d2', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    glow.scale.set(16, 16, 1); glow.position.set(x, h + 1, z); scene.add(glow);
  });
  // 전광판 (글자는 update 의 board 로 그린다)
  const bz = BACK + 7.5;
  add(new THREE.BoxGeometry(40, 14, 1.4), M.board, { cast: true }).position.set(0, 18, -bz);
  [-12, 12].forEach((x) => add(new THREE.BoxGeometry(1.2, 11, 1.2), M.tower).position.set(x, 5.5, -bz - 0.6));
  const boardTex = canvasTex(1024, 340, () => {}, false);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(37.5, 12.4), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false, fog: false }));
  face.position.set(0, 18.2, -bz + 0.75); scene.add(face);

  // 빛: 차가운 밤하늘 + 조명탑 쪽 따뜻한 주광
  scene.add(new THREE.HemisphereLight('#cfd8ee', '#161a22', 0.85));
  scene.add(new THREE.AmbientLight('#ffffff', 0.15));
  const sun = new THREE.DirectionalLight('#fff4e2', 2.2);
  sun.position.set(-90 * k, 150 * k, 60 * k); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -175 * k; sc.right = 175 * k; sc.top = 175 * k; sc.bottom = -175 * k; sc.near = 20 * k; sc.far = 420 * k;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.2;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#9fb4ff', 0.5); fill.position.set(120, 60, -80); scene.add(fill);

  // 펜스 거리 (좌 · 중 · 우) 글자
  [[Q + 0.12, 4.6, LP], [2 * Q, 5.6, CF], [3 * Q - 0.12, 4.6, RP]].forEach(([phi, y, d]) => {
    const s = label(Math.round(d) + 'm', { fg: 'rgba(255,255,255,.95)', scale: 0.065, shadow: true }), r = R(phi) - 1;
    s.position.set(-r * Math.cos(phi), y, -r * Math.sin(phi)); scene.add(s);
  });

  return { scene, boardTex, k };
}

// 타구 기호: 범례(scorebook markSvg)와 같은 모양 — 안타 빨간 원 · 장타 마름모 · 홈런 고리+점 · 아웃 ×. 바닥에 납작하게
//   종류마다 [모양, 색 이름, 높이, 돌림각들] — 색은 앱 토큰(sbPaint.tok: red · hl · paper)
function markParts() {
  const disc = (r, n) => new THREE.CylinderGeometry(r, r, 0.1, n);
  return {
    out: [[new THREE.BoxGeometry(3.1, 0.3, 0.6), 'paper', 0.15, [Math.PI / 4, -Math.PI / 4]]],
    hit: [[disc(1.85, 40), 'paper', 0.1], [disc(1.5, 40), 'red', 0.14]],
    xbh: [[disc(2.55, 4), 'paper', 0.1], [disc(2.1, 4), 'hl', 0.14]],
    hr: [[new THREE.TorusGeometry(1.9, 0.42, 10, 36).rotateX(Math.PI / 2), 'red', 0.45], [disc(0.85, 24), 'red', 0.14]],
  };
}

class SprayField3D extends HTMLElement {
  connectedCallback() {
    if (this._canvas) { if (this._ready) this._loop(); return; }   // 다시 붙음: 새로 만들지 않고 이어서 그린다
    Object.assign(this.style, { display: 'block', width: '100%', height: '100%', position: 'relative', overflow: 'hidden', cursor: 'grab', touchAction: 'pan-y' });   // pan-y: 휴대폰에서 한 손가락 세로 끌기는 페이지 스크롤
    this._canvas = document.createElement('canvas');
    Object.assign(this._canvas.style, { width: '100%', height: '100%', display: 'block' });
    this.appendChild(this._canvas);
    const vig = document.createElement('div');   // 비네트 (시안 보정)
    Object.assign(vig.style, { position: 'absolute', inset: '0', pointerEvents: 'none', background: 'radial-gradient(ellipse 75% 70% at 50% 48%, transparent 55%, rgba(5,7,10,.45) 100%)' });
    this.appendChild(vig);
    try { this._init(); } catch (e) {   // WebGL 이 없는 기기 · 브라우저
      console.error('[spray-field-3d]', e);
      this.style.cursor = '';
      this.innerHTML = '<p class="ad-none">이 기기에서는 3D 를 볼 수 없어요. 2D 로 봐 주세요.</p>';
    }
  }
  disconnectedCallback() { cancelAnimationFrame(this._frame); }

  update(d) {
    this._dist = d.dist || [];
    this._R = fenceFn(this._dist);
    this._balls = (d.balls || []).filter((b) => KINDS.includes(b.k)).map((b) => ({ k: b.k, p: toField(b.x, b.y, b.k === 'hr', this._R, b.fa, b.ov) }));
    this._board = d.board || ['', ''];
    this._got = true;
    if (this._ready) this._apply();
  }
  // 찍은 자리 고리 (기록 탭: 결과 팝업이 열려 있는 동안). p = 저장 좌표 { x, y } | null
  mark(p) {
    this._pin = p || null;
    if (this._ready) this._setPin();
  }
  // 저장 좌표 → 이 요소 안의 화면 px { px, py } (키보드 입력의 팝업 자리 — scorebook _kb3d). 화면 밖(돌려 둔 시점 · 깊은 파울 관중석)이면 가까운 가장자리로, 준비 전 · 카메라 뒤면 null
  screenAt(p) {
    if (!this._ready || !p) return null;
    const v = this._settled(p).project(this._camera);
    const r = this.getBoundingClientRect();
    if (!r.width || !r.height || v.z > 1) return null;
    const cl = (t) => Math.max(-1, Math.min(1, t));
    return { px: (cl(v.x) + 1) / 2 * r.width, py: (1 - cl(v.y)) / 2 * r.height };
  }
  // 저장 좌표의 3D 점을, 카메라가 보는 점까지 다 미끄러져 간 뒤(_tgt → _tgtTo)의 시점으로 지금 카메라에 투영할 수 있게 남은 이동량만큼 되돌린 점
  //   (카메라는 보는 점과 같이 움직이고 방향은 그대로라서, 다 간 뒤의 투영 = 지금 카메라로 (점 − 남은 이동량) 투영) — 방향키 연타에 follow 가 겹쳐 쌓이지 않는다
  _settled(p) {
    const [x, z] = toField(p.x, p.y, false, this._R, p.fa, p.ov);
    return new THREE.Vector3(x, groundY(x, z, this._R), z).sub(this._tgtTo).add(this._tgt);
  }
  // 저장 좌표의 자리가 화면 밖이면(돌려 둔 시점 · 깊은 파울 관중석) 그 자리가 보이게 보는 점을 옮긴다 — 키보드 커서(scorebook _kb3d). 옮겼으면 true
  //   카메라는 보는 점과 같이 움직이므로, 화면 안쪽(IN)에 지금 보이는 땅 점 E 를 그 자리 P 로 옮기면 P 가 거기에 온다 (_loop 가 미끄러져 간다)
  follow(p) {
    if (!this._ready || !p) return false;
    const M = 0.8, IN = 0.6;   // 여백 M 밖이면 안쪽 IN 까지 들여온다
    const P = this._settled(p), v = P.clone().project(this._camera);
    if (v.z <= 1 && Math.abs(v.x) <= M && Math.abs(v.y) <= M) return false;
    const cl = (t) => Math.max(-IN, Math.min(IN, t));
    const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(cl(v.x), cl(v.y)), this._camera);
    const E = rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -P.y), new THREE.Vector3());
    if (!E) return false;
    this._moveTgt(P.sub(E).setY(0));
    return true;
  }

  get _cfg() { return this._sc || sprayCfg(1); }
  _setup() {
    this._R = this._R || fenceFn(this._dist);
    this._built = String(this._dist || []);
    const { scene, boardTex, k } = build(this._R);
    this._scene = scene; this._boardTex = boardTex; this._sc = sprayCfg(k);
    this._parts = markParts();
    const mat = () => new THREE.MeshStandardMaterial({ roughness: 0.9, emissiveIntensity: 0.35 });   // 납작한 원이 번들거리지 않게 무광
    this._mats = { red: mat(), hl: mat(), paper: new THREE.MeshStandardMaterial({ roughness: 0.5 }) };
    this._marks = null; this._pinMesh = null;
  }
  // 구장 거리가 바뀌면 장면을 버리고 다시 짓는다 (구장을 바꿀 때만 — 드물다)
  _rebuild() {
    this._scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      [].concat(o.material || []).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    if (this._scene.background && this._scene.background.dispose) this._scene.background.dispose();
    this._setup();
    const C = this._cfg;
    this._camera.near = C.near; this._camera.far = C.far; this._camera.updateProjectionMatrix();
    this._resetCam();
    this._renderer.shadowMap.needsUpdate = true;
  }
  // 화면 좌표 → 평면과 만나는 3D 점 (없으면 null)
  _hit(e, plane) {
    const r = this._canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, this._camera);
    return rc.ray.intersectPlane(plane, new THREE.Vector3());
  }
  // 짧게 누름: 누른 자리 → 저장 좌표 → 'fieldtap' (파울 지역 = 파울라인 위 + fa · 외야석 = 펜스 위 + ov, fromField)
  // 관중석은 땅보다 높아서 땅 평면만 보면 실제보다 멀리 잡힌다 → 그 자리 계단 높이(groundY) 평면으로 몇 번 다시 맞춘다
  _tap(e) {
    if (!this.tappable) return;
    let p = this._hit(e, new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    for (let i = 0; i < 3 && p; i++) p = this._hit(e, new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY(p.x, p.z, this._R))) || p;
    const s = p && fromField(p.x, p.z, this._R);
    if (!s) return;
    const r = this.getBoundingClientRect();
    this.dispatchEvent(new CustomEvent('fieldtap', { detail: { ...s, px: e.clientX - r.left, py: e.clientY - r.top } }));
  }
  // 끌기를 돌리기 대신 쓸 때 true (pitch-zone-3d 의 구역 고르기). ph = down · move · up · cancel
  _grab() { return false; }

  _init() {
    const renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // 구장은 움직이지 않으니 그림자는 한 번만 굽는다
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    this._renderer = renderer;
    // 브라우저가 WebGL 을 끊었다 되살리면(오래 열어 둔 탭 · 다른 탭이 GPU 를 많이 쓸 때) three.js 가 자원은 다시 올리지만
    // 여기서는 바뀐 게 있을 때만 그리므로 까만 화면으로 남는다 → 그림자를 다시 굽고 한 번 다시 그린다
    this._canvas.addEventListener('webglcontextrestored', () => { renderer.shadowMap.needsUpdate = true; this._dirty = true; });
    this._setup();
    const C = this._cfg;
    this._camera = new THREE.PerspectiveCamera(36, 1, C.near, C.far);
    this._tgt = new THREE.Vector3(); this._tgtTo = new THREE.Vector3(); this._sph = new THREE.Spherical(); this._cur = new THREE.Spherical();
    this._resetCam(); this._cur.copy(this._sph); this._tgt.copy(this._tgtTo);
    this._ready = true;
    if (this._got) this._apply();

    // 손가락(포인터) 하나 = 돌리기, 둘 = 집어서 확대 + 옮기기(지도처럼). 오른쪽 · 가운데 버튼 · Shift 끌기 = 옮기기
    // 거의 안 움직이고 뗀 하나 = 누름(_tap) · _grab 이 받으면 그쪽이 끌기를 쓴다
    const pts = new Map(); let drag = null, pinch = null, tap = null, own = null;
    const duo = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), m: { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 } }; };
    this.addEventListener('pointerdown', (e) => {
      if (e.button > 2) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.setPointerCapture(e.pointerId);
      if (pts.size === 1 && !e.button && !e.shiftKey && this._grab(e, 'down')) { own = e.pointerId; return; }
      this.style.cursor = 'grabbing';
      if (pts.size === 2) { drag = null; pinch = duo(); tap = null; }
      else if (pts.size === 1) { drag = { x: e.clientX, y: e.clientY, pan: e.button > 0 || e.shiftKey }; tap = e.button ? null : { x: e.clientX, y: e.clientY, id: e.pointerId }; }
    });
    this.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (own === e.pointerId) { this._grab(e, 'move'); return; }
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 6) tap = null;
      if (pinch && pts.size === 2) {
        const t = duo();
        if (t.d > 0) this._zoom(pinch.d / t.d, t.m);
        this._pan(t.m.clientX - pinch.m.clientX, t.m.clientY - pinch.m.clientY);
        pinch = t; return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y, [u0, u1] = this._cfg.uPhi; drag = { ...drag, x: e.clientX, y: e.clientY };
      if (drag.pan) { this._pan(dx, dy); return; }
      this._userTheta -= dx * 0.005; this._userPhi = Math.max(u0, Math.min(u1, this._userPhi - dy * 0.004));
    });
    this.addEventListener('contextmenu', (e) => e.preventDefault());   // 오른쪽 끌기 = 옮기기
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId); pinch = null;
      if (own === e.pointerId) { own = null; this._grab(e, e.type === 'pointerup' ? 'up' : 'cancel'); return; }
      if (tap && tap.id === e.pointerId && e.type === 'pointerup' && !pts.size) this._tap(e);
      tap = null;
      const rest = [...pts.values()][0]; drag = rest ? { ...rest } : null;   // 남은 손가락으로 이어서 돌린다(튀지 않게)
      if (!rest) this.style.cursor = 'grab';
    };
    this.addEventListener('pointerup', up); this.addEventListener('pointercancel', up);
    // 두 손가락: 집는 동안 페이지가 스크롤 · 확대되지 않게 (한 손가락은 그대로 스크롤)
    const two = (e) => { if (e.touches.length > 1) e.preventDefault(); };
    this.addEventListener('touchstart', two, { passive: false }); this.addEventListener('touchmove', two, { passive: false });
    // Ctrl+휠(트랙패드 집기도 이렇게 온다) = 마우스 밑 점을 향해 확대. 그냥 휠은 페이지 스크롤
    this.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return; e.preventDefault();
      this._zoom(Math.exp(e.deltaY * (e.deltaMode ? 40 : 1) * 0.002), e);   // deltaMode 1 = 줄 단위(Firefox)
    }, { passive: false });
    this.addEventListener('dblclick', (e) => this._dbl(e));
    new ResizeObserver(() => this._resize()).observe(this); this._resize();
    this._loop();
  }

  _resetCam() {
    const cam = this._cfg.cam;
    this._tgtTo.set(...cam.tgt);
    this._sph.setFromVector3(new THREE.Vector3(...cam.pos).sub(this._tgtTo));
    this._userTheta = 0; this._userPhi = 0; this._dirty = true;
  }
  _dbl() { this._resetCam(); }
  // 확대 · 축소. at(화면 좌표)이 있으면 그 밑 점을 향해 — 손가락 · 마우스 밑에 있던 것이 그 자리에 남는다
  _zoom(k, at) {
    const [r0, r1] = this._cfg.r, r = this._sph.radius, nr = Math.max(r0, Math.min(r1, r * k));
    const p = at && this._hit(at, this._focus());
    if (p) this._moveTgt(p.sub(this._tgtTo).multiplyScalar(1 - nr / r));
    this._sph.radius = nr; this._dirty = true;
  }
  // 끌어 옮기기: 화면 픽셀 → 지금 거리에서의 m 만큼 카메라 오른쪽 · 위 방향으로
  _pan(dx, dy) {
    const s = 2 * this._cur.radius * Math.tan(this._camera.fov * Math.PI / 360) / (this.clientHeight || 1), m = this._camera.matrixWorld.elements;
    this._moveTgt(new THREE.Vector3(m[0], m[1], m[2]).multiplyScalar(-dx * s).addScaledVector(new THREE.Vector3(m[4], m[5], m[6]), dy * s));
  }
  _moveTgt(v) {
    const [a, b] = this._cfg.box, t = this._tgtTo.add(v);
    t.set(...[0, 1, 2].map((i) => Math.max(a[i], Math.min(b[i], t.getComponent(i)))));
    this._dirty = true;
  }
  _focus() { return new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); }   // 확대할 때 손가락 밑 점을 찾는 면: 구장 = 땅

  _apply() {
    if (this._built !== String(this._dist || [])) this._rebuild();
    const T = (window.sbPaint && window.sbPaint.tok()) || {};
    [['red', T.red || '#C8322B'], ['hl', T.hl || '#D9A441']].forEach(([k, c]) => { this._mats[k].color.set(c); this._mats[k].emissive.set(c); });
    this._mats.paper.color.set(T.paper || '#F3EDDF');   // 범례의 잉크색 × 는 밤 잔디에서 안 보여 종이색으로
    this._setMarks(); this._setBoard(); this._setPin();
    this._dirty = true;
  }
  _setPin() {
    if (this._pinMesh) this._scene.remove(this._pinMesh);
    if (this._pin) {
      this._pinMesh = this._pinMesh || new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.32, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      const [x, z] = toField(this._pin.x, this._pin.y, false, this._R, this._pin.fa, this._pin.ov);
      this._pinMesh.position.set(x, groundY(x, z, this._R) + 0.35, z); this._scene.add(this._pinMesh);
    }
    this._dirty = true;
  }

  // 종류·부품마다 InstancedMesh 하나 → 시즌 누적 수백 개도 draw call 8개
  _setMarks() {
    if (this._marks) { this._scene.remove(this._marks); this._marks.children.forEach((m) => m.dispose()); }
    const g = this._marks = new THREE.Group();
    const balls = KINDS.flatMap((k) => this._balls.filter((b) => b.k === k));
    // 겹친 기호가 깜빡이지 않게 6mm 씩 층을 둔다 (40개마다 바닥으로 — ponytail: 41개째부터 같은 높이, 정확히 겹칠 때만 깜빡임)
    balls.forEach((b, i) => { b.y = groundY(b.p[0], b.p[1], this._R) + (i % 40) * 0.006; });
    const m4 = new THREE.Matrix4(), rot = new THREE.Matrix4();
    KINDS.forEach((k) => {
      const list = balls.filter((b) => b.k === k);
      if (!list.length) return;
      this._parts[k].forEach(([geo, col, dy, rots = [0]]) => {
        const im = new THREE.InstancedMesh(geo, this._mats[col], list.length * rots.length);
        list.forEach((b, i) => rots.forEach((a, j) => im.setMatrixAt(i * rots.length + j, m4.makeTranslation(b.p[0], b.y + dy, b.p[1]).multiply(rot.makeRotationY(a)))));
        im.receiveShadow = true;
        g.add(im);
      });
    });
    this._scene.add(g);
  }

  _setBoard() {
    const tex = this._boardTex, c = tex.image, x = c.getContext('2d'), w = c.width, h = c.height, [top, big] = this._board;
    const fit = (t, px) => { x.font = `800 ${px}px ${FONT}`; const tw = x.measureText(t).width; if (tw > w * 0.9) x.font = `800 ${Math.floor(px * w * 0.9 / tw)}px ${FONT}`; };
    x.fillStyle = '#0d1219'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(120,160,210,.06)';
    for (let gx = 0; gx < w; gx += 6) for (let gy = 0; gy < h; gy += 6) x.fillRect(gx, gy, 3, 3);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    fit(top, 84); x.fillStyle = '#FF6B74'; x.fillText(top, w / 2, h * 0.24);
    fit(big, 150); x.fillStyle = '#ffffff'; x.fillText(big, w / 2, h * 0.67);
    tex.needsUpdate = true;
  }


  _loop() {
    cancelAnimationFrame(this._frame);
    const cur = this._cur;
    const tick = () => {
      if (!this.isConnected) return;
      this._frame = requestAnimationFrame(tick);
      const r = this._sph.radius;
      const [p0, p1] = this._cfg.phi, phi = Math.max(p0, Math.min(p1, this._sph.phi + this._userPhi));
      const theta = this._sph.theta + this._userTheta;
      const moving = Math.abs(r - cur.radius) > r * 1e-3 || Math.abs(phi - cur.phi) > 1e-4 || Math.abs(theta - cur.theta) > 1e-4 || this._tgt.distanceTo(this._tgtTo) > r * 1e-4;
      if (!moving && !this._dirty) return;   // 바뀐 게 없으면 그리지 않는다
      this._dirty = false;
      cur.radius += (r - cur.radius) * 0.08;
      cur.phi += (phi - cur.phi) * 0.08;
      cur.theta += (theta - cur.theta) * 0.08;
      this._tgt.lerp(this._tgtTo, 0.08);
      this._camera.position.setFromSpherical(cur).add(this._tgt);
      if (this._cfg.floor != null) this._camera.position.y = Math.max(this._cfg.floor, this._camera.position.y);   // 땅 밑으로 내려가지 않게
      this._camera.lookAt(this._tgt);
      this._renderer.render(this._scene, this._camera);
    };
    tick();
  }

  _resize() {
    const w = this.clientWidth, h = this.clientHeight;
    if (!w || !h) return;
    this._renderer.setSize(w, h, false);
    // 좁은 화면은 카메라를 관중석 뒤로 빼지 않고 화각을 넓힌다
    this._camera.aspect = w / h; this._camera.fov = 2 * Math.atan(Math.tan(Math.PI / 10) * Math.max(1, 1.6 / (w / h))) * 180 / Math.PI;
    this._camera.updateProjectionMatrix();
    this._dirty = true;
  }
}
if (!customElements.get('spray-field-3d')) customElements.define('spray-field-3d', SprayField3D);

// ── 투구 코스 3D (<pitch-zone-3d>) — 분석 › 투수 '코스'(위치 · 분포 · 피안타) · 타자 '본 공 위치'의 3D 보기 ──
//   위치: el.update({ pts: [{ x, y, k, on, n }], cols: { k: '#색' }, pick, picking, sel }) — n = 타석 리플레이의 던진 순서(공 위 번호)
//     x,y = 2D 그림 좌표(가로 0~100 · 세로 0~120, 존 x 22~78 · y 18~102) · k = 2D 점의 종류(strike · ball · hit …), 색은 2D 와 같은 값
//     pick = 투수 코스처럼 구역을 고를 수 있는 그림 → 그림 안을 끌면(누르면) 'zonepick' 이벤트(detail { a: [x, y], b: [x, y] }, 2D 와 같은 좌표)
//     picking · on · sel = 2D 에서 지금 고른 구역(pitcher.js 가 그린 것) — 구역 밖 공은 흐리게, 구역은 흰 테두리
//   분포 · 피안타: el.update({ grid: { view: 'count' | 'hits', cells: [{ n, h, t }] × 9 } }) — 존 9칸마다 기둥(값만큼 투수 쪽으로 길다) + 2D 칸 글자
//   포수 뒤 시점. 공은 존 앞면(홈플레이트 앞변, z 0)에 놓는다 — 기록에 깊이 · 궤적은 없어서 그리지 않는다
const ZS = 0.432 / 56;                     // 그림 1칸(m): 존 폭 56칸 = 홈플레이트 43.2cm
const ZLO = 0.46, ZH = 84 * ZS;            // 존 아래 높이 · 존 높이(m)
const zoneAt = (x, y) => [(x - 50) * ZS, ZLO + (102 - y) * ZS];
const ZONE_CFG = { cam: { pos: [0, 1.05, 1.15], tgt: [0, 0.66, 0] }, near: 0.02, far: 80, r: [0.18, 24], phi: [0.15, 1.66], uPhi: [-1.1, 0.4], box: [[-2.5, 0.05, -19], [2.5, 3, 3]], floor: 0.04 };
const ZONE_GRID_CFG = { ...ZONE_CFG, cam: { pos: [0.7, 1.3, 1.15], tgt: [0, 0.8, -0.2] } };   // 기둥 길이가 보이게 비스듬히
const BAR = { count: '#4f8df5', hits: '#e5484d' };

// 고른 구역: 존 앞면(z 0) 위 흰 테두리 + 옅은 면. 탭(가까운 공 하나)은 공을 두른 원
function selMesh(b) {
  const g = new THREE.Group();
  if (b.tap) {
    const [cx, cy] = zoneAt((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2), r = 0.06;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.005, r, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }));
    ring.position.set(cx, cy, 0.04); g.add(ring);
    return g;
  }
  const [x0, y1] = zoneAt(b.x0, b.y0), [x1, y0] = zoneAt(b.x1, b.y1);   // 그림 y 는 아래로 갈수록 크다
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => new THREE.Vector3(x, y, 0.002))), new THREE.LineBasicMaterial({ color: '#ffffff' })));
  const f = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(x1 - x0, 1e-4), Math.max(y1 - y0, 1e-4)), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
  f.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.001); g.add(f);
  return g;
}

function buildZone() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#11151c');
  scene.fog = new THREE.Fog('#11151c', 9, 34);
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; };
  const flat = (geo) => geo.rotateX(-Math.PI / 2);
  const chalk = new THREE.MeshBasicMaterial({ color: '#e9ecf1' });
  // 땅: 잔디 · 홈 둘레 흙 · 마운드(18.44m) · 투수판
  add(flat(new THREE.PlaneGeometry(90, 90)), new THREE.MeshStandardMaterial({ color: '#2a5c41', roughness: 1 }), 0, 0, -12);
  const dirt = new THREE.MeshStandardMaterial({ color: '#8f6a45', roughness: 1 });
  add(flat(new THREE.CircleGeometry(4, 64)), dirt, 0, 0.004, 0.2);
  add(new THREE.CylinderGeometry(2.74, 2.9, 0.25, 48), dirt, 0, 0.125, -18.44);
  add(new THREE.BoxGeometry(0.61, 0.04, 0.15), chalk, 0, 0.27, -18.44);
  // 분필선: 타석 두 칸(1.22 × 1.83m, 플레이트에서 15cm) · 파울라인
  const line = (x1, z1, x2, z2) => {
    const m = add(new THREE.BoxGeometry(Math.hypot(x2 - x1, z2 - z1), 0.006, 0.05), chalk, (x1 + x2) / 2, 0.008, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  };
  [-1, 1].forEach((s) => {
    const xi = s * 0.366, xo = s * 1.586, z0 = -0.7, z1 = 1.13;
    line(xi, z0, xo, z0); line(xo, z0, xo, z1); line(xo, z1, xi, z1); line(xi, z1, xi, z0);
    line(s * 2.2, 0.432 - 2.2, s * 40, 0.432 - 40);
  });
  // 홈플레이트: 앞변 z 0 · 뒤 꼭짓점이 포수 쪽(+z)
  const h = 0.216, sh = new THREE.Shape();
  sh.moveTo(-h, 0); sh.lineTo(h, 0); sh.lineTo(h, h); sh.lineTo(0, 2 * h); sh.lineTo(-h, h); sh.closePath();
  add(new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f5f6f8', roughness: 0.6, side: THREE.DoubleSide }), 0, 0.012, 0);
  // 스트라이크존: 플레이트 위 상자 테두리 + 앞면 9칸 + 옅은 앞면
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * h, ZH, 2 * h)), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75 }));
  box.position.set(0, ZLO + ZH / 2, h); scene.add(box);
  const g = [];
  [-1, 1].forEach((s) => g.push(s * h / 3, ZLO, 0, s * h / 3, ZLO + ZH, 0));
  [1, 2].forEach((k) => g.push(-h, ZLO + ZH * k / 3, 0, h, ZLO + ZH * k / 3, 0));
  const grid = new THREE.BufferGeometry(); grid.setAttribute('position', new THREE.Float32BufferAttribute(g, 3));
  scene.add(new THREE.LineSegments(grid, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 })));
  add(new THREE.PlaneGeometry(2 * h, ZH), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }), 0, ZLO + ZH / 2, 0);
  // 빛
  scene.add(new THREE.HemisphereLight('#cfd8ee', '#161a22', 1.0));
  const sun = new THREE.DirectionalLight('#fff4e2', 1.8); sun.position.set(-3, 8, 5); scene.add(sun);
  return scene;
}

// 위치 그림에서 한 손가락 끌기: 'pick' = 구역 고르기(2D 와 같음) · 'turn' = 돌리기. 이 기기에 기억
let zoneDrag = 'pick';
try { if (localStorage.getItem('sl_zone3d_drag') === 'turn') zoneDrag = 'turn'; } catch (e) {}
const ZBTN = { minWidth: '44px', height: '44px', padding: '0 10px', border: '1px solid rgba(255,255,255,.25)', borderRadius: '8px', background: 'rgba(12,15,21,.72)', color: '#fff', font: `700 13px ${FONT}`, cursor: 'pointer' };

class PitchZone3D extends SprayField3D {
  get _cfg() { return this._grid ? ZONE_GRID_CFG : ZONE_CFG; }
  connectedCallback() {
    super.connectedCallback();
    if (!this._renderer || this._hint) return;
    const t = this._hint = document.createElement('p');
    Object.assign(t.style, { position: 'absolute', left: '10px', right: '64px', bottom: '8px', margin: '0', font: `600 11px ${FONT}`, color: 'rgba(255,255,255,.72)', pointerEvents: 'none' });
    this.appendChild(t);
    // 버튼: 왼쪽 위 = 끌기 고르기 | 돌리기(위치 그림만) · 오른쪽 아래 = 확대 · 축소 · 처음 시점. 누름이 장면의 끌기 · 두 번 누름으로 가지 않게 막는다
    const bar = (css) => { const d = document.createElement('div'); Object.assign(d.style, { position: 'absolute', display: 'flex', gap: '4px', ...css }); this.appendChild(d); return d; };
    const btn = (box, text, title, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = text; b.title = title; b.setAttribute('aria-label', title);
      Object.assign(b.style, ZBTN);
      ['pointerdown', 'dblclick'].forEach((n) => b.addEventListener(n, (e) => e.stopPropagation()));
      b.addEventListener('click', fn);
      box.appendChild(b); return b;
    };
    this._modeBar = bar({ left: '8px', top: '8px' });
    [['pick', '고르기', '끌어서 구역 고르기'], ['turn', '돌리기', '끌어서 돌려 보기']].forEach(([m, txt, title]) => btn(this._modeBar, txt, title, () => {
      zoneDrag = m;
      try { localStorage.setItem('sl_zone3d_drag', m); } catch (e) {}
      this._modeUi();
    }).dataset.m = m);
    const zb = bar({ right: '8px', bottom: '8px', flexDirection: 'column' });
    btn(zb, '+', '확대 (두 손가락 · Ctrl+휠)', () => this._zoom(0.7));
    btn(zb, '−', '축소', () => this._zoom(1 / 0.7));
    btn(zb, '↺', '처음 시점 (빈 곳 두 번 누르기)', () => this._resetCam());
    this._modeUi();
  }
  // 위치 그림(고를 수 있음): 끌기 모드 버튼 · 안내 글 · 끌기가 페이지를 움직이지 않게(2D #pcPlot 의 touch-action: none 과 같음)
  _modeUi() {
    const pick = this._pick && !this._grid;
    if (this._hint) {
      this._hint.hidden = !pick;
      this._hint.textContent = zoneDrag === 'turn' ? '끌면 돌리기 · 공을 누르면 그 공 · 두 번 누르면 가까이' : '끌면 구역 고르기 · 두 손가락 확대·이동 · 공 두 번 누르면 가까이';
    }
    if (this._modeBar) {
      this._modeBar.style.display = pick ? 'flex' : 'none';   // hidden 은 인라인 display: flex 에 져서 고를 수 없는 그림에도 보였다
      this._modeBar.querySelectorAll('button').forEach((b) => {
        const on = b.dataset.m === zoneDrag;
        b.setAttribute('aria-pressed', String(on));
        Object.assign(b.style, on ? { background: '#fff', color: '#11151c' } : { background: ZBTN.background, color: ZBTN.color });
      });
    }
    this.style.touchAction = pick ? 'none' : 'pan-y';
  }
  _focus() { return new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); }   // 공이 놓인 존 앞면
  // 그림 좌표 a 에서 가장 가까운 공(6칸 안). 없으면 null
  _near(a) {
    let best = null, bd = 6;
    this._pts.forEach((p) => { const d = Math.hypot(p.x - a[0], p.y - a[1]); if (d <= bd) { bd = d; best = p; } });
    return best;
  }
  // 두 번 누름: 공 위면 그 공을 가까이(돌린 각도는 그대로), 빈 곳이면 처음 시점
  _dbl(e) {
    const a = !this._grid && this._plotAt(e), p = a && this._near(a);
    if (!p) { this._resetCam(); return; }
    const [x, y] = zoneAt(p.x, p.y);
    this._tgtTo.set(x, y, 0); this._sph.radius = 0.4; this._dirty = true;
  }
  // 돌리기 모드에서 짧게 누름 = 2D 탭처럼 그 자리 공 하나 고르기 (고르기 모드의 누름은 _grab 이 받는다)
  _tap(e) {
    const a = this._pick && !this._grid && this._plotAt(e);
    if (a) this.dispatchEvent(new CustomEvent('zonepick', { detail: { a, b: a } }));
  }
  update(d) {
    const was = !!this._grid;
    this._grid = d.grid || null;
    this._pts = d.pts || []; this._cols = d.cols || {};
    this._pick = !!d.pick; this._picking = !!d.picking; this._sel = d.sel || null;
    this._got = true;
    this._modeUi();
    if (this._ready) { if (was !== !!this._grid) this._resetCam(); this._apply(); }
  }
  _setup() {
    this._scene = buildZone();
    this._geo = new THREE.SphereGeometry(0.037, 24, 16);   // 야구공 지름 7.4cm
  }
  _plotAt(e) {
    const p = this._hit(e, new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
    return p && [p.x / ZS + 50, 102 - (p.y - ZLO) / ZS];
  }
  // 그림 안(0~100 × 0~120)을 누르면 돌리기 대신 구역 고르기. 떼면 'zonepick' — 탭 · 끌기 판단과 결과 카드는 2D 와 같은 pitcher.js 가 한다
  _grab(e, ph) {
    if (ph === 'down') {
      const a = this._pick && !this._grid && zoneDrag === 'pick' && this._plotAt(e);
      if (!a || a[0] < 0 || a[0] > 100 || a[1] < 0 || a[1] > 120) return false;
      this._drag = { a, b: a }; this._apply();
      return true;
    }
    if (!this._drag) return false;
    const b = ph !== 'cancel' && this._plotAt(e);
    if (b) this._drag.b = [Math.max(0, Math.min(100, b[0])), Math.max(0, Math.min(120, b[1]))];
    if (ph === 'move') { this._apply(); return true; }
    const d = this._drag;
    this._drag = null;
    if (ph === 'up') this.dispatchEvent(new CustomEvent('zonepick', { detail: { a: d.a, b: d.b } }));
    this._apply();
    return true;
  }
  _apply() {
    if (this._marks) {
      this._scene.remove(this._marks);
      this._marks.traverse((o) => {
        if (o.isInstancedMesh) o.dispose(); else if (o.geometry) o.geometry.dispose();   // 공 모양(_geo)은 같이 쓰므로 두고 인스턴스만
        [].concat(o.material || []).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
    }
    const g = this._marks = new THREE.Group();
    if (this._grid) this._bars(g); else this._balls(g);
    this._scene.add(g);
    this._dirty = true;
  }
  _balls(g) {
    const m4 = new THREE.Matrix4(), dr = this._drag;
    const box = dr ? { x0: Math.min(dr.a[0], dr.b[0]), y0: Math.min(dr.a[1], dr.b[1]), x1: Math.max(dr.a[0], dr.b[0]), y1: Math.max(dr.a[1], dr.b[1]) } : this._sel;
    const picking = !!dr || this._picking;
    const lit = (p) => !picking || (dr ? p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1 : !!p.on);
    [...new Set(this._pts.map((p) => p.k))].forEach((k) => [true, false].forEach((on) => {
      const list = this._pts.filter((p) => p.k === k && lit(p) === on), col = this._cols[k] || '#ffffff';
      if (!list.length) return;
      const ghost = k === 'ball' || k === 'seen';   // 2D 에서 속 빈 고리 · 흐린 점
      const op = on ? (ghost ? 0.55 : 1) : 0.15;    // 고르는 중: 구역 밖 공은 2D(.picking)처럼 흐리게
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: picking && on ? 0.6 : 0.35, roughness: 0.5, transparent: op < 1, opacity: op, depthWrite: op === 1 });
      const im = new THREE.InstancedMesh(this._geo, mat, list.length);
      list.forEach((p, i) => { const [x, y] = zoneAt(p.x, p.y); im.setMatrixAt(i, m4.makeTranslation(x, y, 0)); });
      g.add(im);
    }));
    // 타석 리플레이: 공 위에 던진 순서 번호(2D 처럼 어두운 글자)
    this._pts.forEach((p) => {
      if (!p.n) return;
      const [x, y] = zoneAt(p.x, p.y), s = label(String(p.n), { fg: '#0a111e', scale: 0.0014 });
      s.position.set(x, y, 0.04); g.add(s);
    });
    if (box) g.add(selMesh(box));
  }
  // 분포 = 칸 투구 수 / 가장 많은 칸 · 피안타 = 피안타 / 투구 (3구 미만은 2D 처럼 색 없음)
  _bars(g) {
    const G = this._grid, cs = (G.cells || []).slice(0, 9), maxN = Math.max(1, ...cs.map((c) => c.n || 0));
    const cw = 0.432 / 3, ch = ZH / 3;
    cs.forEach((c, i) => {
      const x = -0.216 + cw * (i % 3 + 0.5), y = ZLO + ZH - ch * (Math.floor(i / 3) + 0.5);
      const v = G.view === 'hits' ? (c.n >= 3 ? c.h / c.n : null) : (c.n ? c.n / maxN : null);
      const col = v == null ? '#3a4150' : BAR[G.view] || BAR.count, d = v == null ? 0.01 : 0.03 + v * 0.5;
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: v == null ? 0 : 0.2 + 0.35 * v, roughness: 0.6, transparent: true, opacity: v == null ? 0.35 : 0.55 + 0.4 * v, depthWrite: false });
      const m = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.92, ch * 0.92, d), mat);
      m.position.set(x, y, -d / 2); g.add(m);
      if (c.t) { const s = label(c.t, { scale: 0.001, shadow: true }); s.position.set(x, y, 0.01); g.add(s); }
    });
  }
}
if (!customElements.get('pitch-zone-3d')) customElements.define('pitch-zone-3d', PitchZone3D);
