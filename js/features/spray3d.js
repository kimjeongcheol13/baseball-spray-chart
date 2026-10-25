// 3D 방향도 — 분석 › 팀 '팀 타구 방향'의 3D 보기 (<spray-field-3d>)
//   three.js 는 랜딩과 같은 vendor 파일. team.js 가 3D 를 처음 누를 때만 이 모듈을 불러온다(2D 만 쓰면 내려받지 않음)
//   el.update({ balls: [{ x, y, k }], board: [윗줄, 큰 줄], dist: [좌, 중, 우] })
//     x,y = 저장 좌표(홈 0.5,1 · 펜스 반지름 .97) · k = sbPaint.kindOf (hit | xbh | hr | out, 그 밖은 그리지 않음)
//   위치는 2D 방향도와 같은 규칙(core _semiToCone): 각도는 _degToPhi, 거리는 '펜스까지 비율' → 3D 펜스(105m) 기준
//   끌기 = 돌리기 · 두 손가락 / Ctrl+휠 = 확대 · 두 번 누르기 = 처음 시점
//   다시 그려도 같은 요소를 옮겨 붙이면 장면을 새로 만들지 않는다(WebGL 컨텍스트 1개)
//   <pitch-zone-3d> (아래) = 투구 코스 3D — 같은 돌리기 · 확대 · 그리기를 물려받고 장면 · 카메라 범위만 다르다
import * as THREE from '../landing/vendor/three.module.js';

const FONT = 'system-ui, sans-serif';
const CAM = { pos: [0, 86, 56], tgt: [0, -2, -58] };   // 중계 화면 시점
const FENCE = 105;
const S2 = Math.SQRT1_2;
const STAND = { off: 9, d: 3.2, n: 9, h0: 1.4, dh: 1.0 };   // 내야 관중석 계단
const BL = { r0: 107.5, d: 4.5, n: 6, h0: 3.6, dh: 1.4 };   // 외야석 계단
const EYE = 0.075;                                           // 중앙 백스크린 반각(rad)
const KINDS = ['out', 'hit', 'xbh', 'hr'];                   // 그리는 순서 = 겹칠 때 위로 오는 순서 (2D 와 같음)
// 카메라: 처음 시점 · near/far · 확대 반지름 · 위아래 각 범위 · 끌어서 더하는 위아래 각 범위
const SPRAY_CFG = { cam: CAM, near: 4, far: 900, r: [40, 260], phi: [0.2, 1.45], uPhi: [-0.5, 0.6] };

// 저장 좌표 → 필드 [x, z] (m, 홈 = 원점 · 중견 = -z). 펜스 밖 홈런은 외야석 계단 한가운데, 그 밖의 타구는 펜스 안쪽에 놓는다
export function toField(x, y, hr) {
  const dx = x - 0.5, dy = Math.min(y - 1, 0);
  const deg = (Math.atan2(dy, dx) + Math.PI) * 180 / Math.PI;
  const phi = typeof _degToPhi === 'function' ? _degToPhi(deg) : (45 + deg / 2) * Math.PI / 180;
  let r = Math.min(Math.hypot(dx, dy) / 0.97, 1.06) * FENCE;
  if (hr && r > FENCE) r = BL.r0 + BL.d * (Math.min(BL.n - 1, Math.floor(Math.max(0, r - BL.r0) / BL.d)) + 0.5);
  else r = Math.min(r, FENCE - 2);
  return [-r * Math.cos(phi), -r * Math.sin(phi)];
}
const groundY = (x, z) => {
  const r = Math.hypot(x, z);
  return r < BL.r0 ? 0 : BL.h0 + BL.dh * Math.min(BL.n - 1, Math.floor((r - BL.r0) / BL.d));
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
// 가운데가 원점인 w × l 바닥, 높이 h. 그룹 0 = 위·아래, 1 = 옆면 (상자보다 draw call 이 적다)
function slab(w, l, h) {
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, -l / 2); sh.lineTo(w / 2, -l / 2); sh.lineTo(w / 2, l / 2); sh.lineTo(-w / 2, l / 2); sh.closePath();
  return new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2);
}

// 구장(움직이지 않는 부분). 색은 시안에서 LightCraft 로 보정한 값
function build() {
  const scene = new THREE.Scene();
  scene.background = canvasTex(4, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#191e2c'); g.addColorStop(0.55, '#11151c'); g.addColorStop(1, '#12151C');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }, false);
  scene.fog = new THREE.Fog('#11151c', 240, 430);

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

  add(new THREE.CircleGeometry(300, 64).rotateX(-Math.PI / 2), M.ground, { y: -0.06 });

  // 파울 지역: 관중석 앞 짧은 트랙까지 잔디 (양쪽 띠는 월드 좌표 uv 라 무늬가 이어진다)
  const L = 112, dF = STAND.off, dT = 1.6;
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
  add(uvFrom(new THREE.CircleGeometry(FENCE, 96, Math.PI / 4, Math.PI / 2).rotateX(-Math.PI / 2), grassUV), M.grass);
  add(uvFrom(new THREE.RingGeometry(99.5, FENCE, 96, 1, Math.PI / 4, Math.PI / 2).rotateX(-Math.PI / 2), dirtUV), M.track, { y: 0.02 });
  [38, 57, 76, 95].forEach((r) => {
    add(uvFrom(new THREE.RingGeometry(r, Math.min(r + 9.5, 99.5), 96, 1, Math.PI / 4, Math.PI / 2).rotateX(-Math.PI / 2), grassUV), M.band, { y: 0.01 });
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
  [-1, 1].forEach((sgn) => {
    const ln = add(new THREE.BoxGeometry(0.22, 0.03, FENCE), M.line, { y: 0.07 });
    ln.position.x = sgn * (FENCE / 2) * S2; ln.position.z = -(FENCE / 2) * S2; ln.rotation.y = sgn * 3 * Math.PI / 4;
  });
  [[19.4, -19.4], [0, -38.8], [-19.4, -19.4]].forEach(([x, z]) => {
    const b = add(new THREE.BoxGeometry(1.1, 0.16, 1.1), M.line, { cast: true });
    b.position.set(x, 0.1, z); b.rotation.y = Math.PI / 4;
  });
  add(new THREE.BoxGeometry(0.9, 0.05, 0.9), M.line, { y: 0.07 }).rotation.y = Math.PI / 4;

  // 외야 펜스 + 노란 홈런 라인 + 파울 폴
  add(new THREE.CylinderGeometry(FENCE, FENCE, 3.2, 96, 1, true, 3 * Math.PI / 4, Math.PI / 2), M.wall, { y: 1.6, cast: true });
  add(new THREE.CylinderGeometry(FENCE + 0.1, FENCE + 0.1, 0.28, 96, 1, true, 3 * Math.PI / 4, Math.PI / 2), M.cap, { y: 3.2 });
  [-1, 1].forEach((sgn) => { add(new THREE.CylinderGeometry(0.25, 0.25, 16, 12), M.cap, { cast: true }).position.set(sgn * FENCE * S2, 8, -FENCE * S2); });

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
    const along = 24, mid = STAND.off + 0.6;
    add(slab(2.2, 15, 1.6).rotateY(sgn * 3 * Math.PI / 4).translate(sgn * (along + mid) * S2, 0, -(along - mid) * S2), [M.roof, M.dugout]);
  });

  // 외야석 + 가운데 어두운 백스크린
  for (let i = 0; i < BL.n; i++) {
    const ri = BL.r0 + BL.d * i, h = BL.h0 + BL.dh * i;
    [[Math.PI / 4 - 0.09, Math.PI / 2 - EYE, M.seatHigh], [Math.PI / 2 - EYE, Math.PI / 2 + EYE, M.eye], [Math.PI / 2 + EYE, 3 * Math.PI / 4 + 0.09, M.seatHigh]].forEach(([a0, a1, seat]) => {
      add(uvFrom(ringSector(ri, ri + BL.d, a0, a1, h), ringUV(ri + BL.d / 2)), [seat, M.riser], { cast: true });
    });
  }

  // 조명탑(빛 번짐 포함) — 외야 쪽은 중계 화면 안에 들어오는 높이
  [[-98, 24, 42], [98, 24, 42], [-72, -122, 28], [72, -122, 28]].forEach(([x, z, h]) => {
    add(new THREE.CylinderGeometry(0.5, 0.9, h, 10), M.tower).position.set(x, h / 2, z);
    const head = add(new THREE.BoxGeometry(9, 4, 1.2), M.lamp);
    head.position.set(x, h + 1, z); head.lookAt(0, 0, -45);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff1d2', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    glow.scale.set(16, 16, 1); glow.position.set(x, h + 1, z); scene.add(glow);
  });
  // 전광판 (글자는 update 의 board 로 그린다)
  add(new THREE.BoxGeometry(40, 14, 1.4), M.board, { cast: true }).position.set(0, 18, -142);
  [-12, 12].forEach((x) => add(new THREE.BoxGeometry(1.2, 11, 1.2), M.tower).position.set(x, 5.5, -142.6));
  const boardTex = canvasTex(1024, 340, () => {}, false);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(37.5, 12.4), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false, fog: false }));
  face.position.set(0, 18.2, -141.25); scene.add(face);

  // 빛: 차가운 밤하늘 + 조명탑 쪽 따뜻한 주광
  scene.add(new THREE.HemisphereLight('#cfd8ee', '#161a22', 0.85));
  scene.add(new THREE.AmbientLight('#ffffff', 0.15));
  const sun = new THREE.DirectionalLight('#fff4e2', 2.2);
  sun.position.set(-90, 150, 60); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -175; sc.right = 175; sc.top = 175; sc.bottom = -175; sc.near = 20; sc.far = 420;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.2;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#9fb4ff', 0.5); fill.position.set(120, 60, -80); scene.add(fill);

  return { scene, boardTex };
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
    this._balls = (d.balls || []).filter((b) => KINDS.includes(b.k)).map((b) => ({ k: b.k, p: toField(b.x, b.y, b.k === 'hr') }));
    this._board = d.board || ['', ''];
    this._dist = d.dist || [];
    this._got = true;
    if (this._ready) this._apply();
  }

  get _cfg() { return SPRAY_CFG; }
  _setup() {
    const { scene, boardTex } = build();
    this._scene = scene; this._boardTex = boardTex;
    this._parts = markParts();
    const mat = () => new THREE.MeshStandardMaterial({ roughness: 0.9, emissiveIntensity: 0.35 });   // 납작한 원이 번들거리지 않게 무광
    this._mats = { red: mat(), hl: mat(), paper: new THREE.MeshStandardMaterial({ roughness: 0.5 }) };
    this._labels = new THREE.Group(); scene.add(this._labels);
  }

  _init() {
    const renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // 구장은 움직이지 않으니 그림자는 한 번만 굽는다
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    this._renderer = renderer;
    this._setup();
    const C = this._cfg;
    this._camera = new THREE.PerspectiveCamera(36, 1, C.near, C.far);
    this._tgt = new THREE.Vector3(); this._sph = new THREE.Spherical(); this._cur = new THREE.Spherical();
    this._resetCam(); this._cur.copy(this._sph);
    this._ready = true;
    if (this._got) this._apply();

    const zoom = (k) => { this._sph.radius = Math.max(C.r[0], Math.min(C.r[1], this._sph.radius * k)); };
    // 손가락(포인터) 하나 = 돌리기, 둘 = 집어서 확대
    const pts = new Map(); let drag = null, pinch = 0;
    const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    this.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.setPointerCapture(e.pointerId); this.style.cursor = 'grabbing';
      if (pts.size === 2) { drag = null; pinch = gap(); } else if (pts.size === 1) drag = { x: e.clientX, y: e.clientY };
    });
    this.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch) { const d = gap(); if (d > 0) zoom(pinch / d); pinch = d; return; }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
      this._userTheta -= dx * 0.005; this._userPhi = Math.max(C.uPhi[0], Math.min(C.uPhi[1], this._userPhi - dy * 0.004));
    });
    const up = (e) => {
      pts.delete(e.pointerId); pinch = 0;
      const rest = [...pts.values()][0]; drag = rest ? { ...rest } : null;   // 남은 손가락으로 이어서 돌린다(튀지 않게)
      if (!rest) this.style.cursor = 'grab';
    };
    this.addEventListener('pointerup', up); this.addEventListener('pointercancel', up);
    // 두 손가락: 집는 동안 페이지가 스크롤 · 확대되지 않게 (한 손가락은 그대로 스크롤)
    const two = (e) => { if (e.touches.length > 1) e.preventDefault(); };
    this.addEventListener('touchstart', two, { passive: false }); this.addEventListener('touchmove', two, { passive: false });
    // Ctrl+휠(트랙패드 집기도 이렇게 온다) = 확대. 그냥 휠은 페이지 스크롤
    this.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return; e.preventDefault();
      zoom(Math.exp(e.deltaY * (e.deltaMode ? 40 : 1) * 0.002));   // deltaMode 1 = 줄 단위(Firefox)
    }, { passive: false });
    this.addEventListener('dblclick', () => this._resetCam());
    new ResizeObserver(() => this._resize()).observe(this); this._resize();
    this._loop();
  }

  _resetCam() {
    const cam = this._cfg.cam;
    this._tgt.set(...cam.tgt);
    this._sph.setFromVector3(new THREE.Vector3(...cam.pos).sub(this._tgt));
    this._userTheta = 0; this._userPhi = 0; this._dirty = true;
  }

  _apply() {
    const T = (window.sbPaint && window.sbPaint.tok()) || {};
    [['red', T.red || '#C8322B'], ['hl', T.hl || '#D9A441']].forEach(([k, c]) => { this._mats[k].color.set(c); this._mats[k].emissive.set(c); });
    this._mats.paper.color.set(T.paper || '#F3EDDF');   // 범례의 잉크색 × 는 밤 잔디에서 안 보여 종이색으로
    this._setMarks(); this._setBoard(); this._setDist();
    this._dirty = true;
  }

  // 종류·부품마다 InstancedMesh 하나 → 시즌 누적 수백 개도 draw call 8개
  _setMarks() {
    if (this._marks) { this._scene.remove(this._marks); this._marks.children.forEach((m) => m.dispose()); }
    const g = this._marks = new THREE.Group();
    const balls = KINDS.flatMap((k) => this._balls.filter((b) => b.k === k));
    // 겹친 기호가 깜빡이지 않게 6mm 씩 층을 둔다 (40개마다 바닥으로 — ponytail: 41개째부터 같은 높이, 정확히 겹칠 때만 깜빡임)
    balls.forEach((b, i) => { b.y = groundY(b.p[0], b.p[1]) + (i % 40) * 0.006; });
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

  // 구장 펜스 거리 (좌 · 중 · 우) — 3D 펜스 모양은 하나라 숫자만 그 구장 것
  _setDist() {
    const key = this._dist.join();
    if (key === this._distKey) return;
    this._distKey = key;
    this._labels.children.slice().forEach((s) => { s.material.map.dispose(); s.material.dispose(); this._labels.remove(s); });
    [[Math.PI / 4 + 0.12, 4.6], [Math.PI / 2, 5.6], [3 * Math.PI / 4 - 0.12, 4.6]].forEach(([phi, y], i) => {
      if (this._dist[i] == null) return;
      const s = label(this._dist[i] + 'm', { fg: 'rgba(255,255,255,.95)', scale: 0.065, shadow: true });
      s.position.set(-104 * Math.cos(phi), y, -104 * Math.sin(phi)); this._labels.add(s);
    });
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
      const moving = Math.abs(r - cur.radius) > 0.01 || Math.abs(phi - cur.phi) > 1e-4 || Math.abs(theta - cur.theta) > 1e-4;
      if (!moving && !this._dirty) return;   // 바뀐 게 없으면 그리지 않는다
      this._dirty = false;
      cur.radius += (r - cur.radius) * 0.08;
      cur.phi += (phi - cur.phi) * 0.08;
      cur.theta += (theta - cur.theta) * 0.08;
      this._camera.position.setFromSpherical(cur).add(this._tgt);
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

// ── 투구 코스 3D (<pitch-zone-3d>) — 분석 › 투수 '코스' · 타자 '본 공 위치'의 3D 보기 ──
//   el.update({ pts: [{ x, y, k }], cols: { k: '#색' } })
//     x,y = 2D 그림 좌표(가로 0~100 · 세로 0~120, 존 x 22~78 · y 18~102) · k = 2D 점의 종류(strike · ball · hit …), 색은 2D 와 같은 값
//   포수 뒤 시점. 공은 존 앞면(홈플레이트 앞변, z 0)에 놓는다 — 기록에 깊이 · 궤적은 없어서 그리지 않는다
const ZS = 0.432 / 56;                     // 그림 1칸(m): 존 폭 56칸 = 홈플레이트 43.2cm
const ZLO = 0.46, ZH = 84 * ZS;            // 존 아래 높이 · 존 높이(m)
const zoneAt = (x, y) => [(x - 50) * ZS, ZLO + (102 - y) * ZS];
const ZONE_CFG = { cam: { pos: [0, 1.05, 1.15], tgt: [0, 0.66, 0] }, near: 0.05, far: 80, r: [0.6, 24], phi: [0.3, 1.66], uPhi: [-1.25, 0.15] };

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

class PitchZone3D extends SprayField3D {
  get _cfg() { return ZONE_CFG; }
  update(d) {
    this._pts = d.pts || []; this._cols = d.cols || {};
    this._got = true;
    if (this._ready) this._apply();
  }
  _setup() {
    this._scene = buildZone();
    this._geo = new THREE.SphereGeometry(0.037, 24, 16);   // 야구공 지름 7.4cm
  }
  _apply() {
    if (this._marks) { this._scene.remove(this._marks); this._marks.children.forEach((m) => { m.material.dispose(); m.dispose(); }); }
    const g = this._marks = new THREE.Group(), m4 = new THREE.Matrix4();
    [...new Set(this._pts.map((p) => p.k))].forEach((k) => {
      const list = this._pts.filter((p) => p.k === k), col = this._cols[k] || '#ffffff';
      const ghost = k === 'ball' || k === 'seen';   // 2D 에서 속 빈 고리 · 흐린 점
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.5, transparent: ghost, opacity: ghost ? 0.55 : 1 });
      const im = new THREE.InstancedMesh(this._geo, mat, list.length);
      list.forEach((p, i) => { const [x, y] = zoneAt(p.x, p.y); im.setMatrixAt(i, m4.makeTranslation(x, y, 0)); });
      g.add(im);
    });
    this._scene.add(g);
    this._dirty = true;
  }
}
if (!customElements.get('pitch-zone-3d')) customElements.define('pitch-zone-3d', PitchZone3D);
