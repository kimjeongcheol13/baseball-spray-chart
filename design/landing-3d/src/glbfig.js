// ---- realistic body ----
// CC0 MakeHuman base mesh (via naver/anny) with a Mixamo-named 52-bone skeleton, shipped in the bundle as
// `body.glb`. The animation code below still drives the mannequin's joint names (shR, elR, hipL, ...):
// they become invisible proxies, and fig.sync() copies their rotations onto the real bones each frame.
// If anything here fails to load, makeFigure() falls back to the procedural mannequin.
let BODY = null, bodyP = null;
const resBlob = async (id) => {
  const R = window.__resources || {}, Bl = window.__resourceBlobs || {}, u = R[id];
  if (!u) throw new Error('missing resource ' + id);
  return Bl[u] || (await fetch(u)).blob();
};
const jsURL = (src) => URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
const toThree = (src) => src.split("} from 'three';").join(`} from '${threeModURL}';`);
function loadBody(THREE) {
  return bodyP || (bodyP = (async () => {
    const [bgu, sku, gl, glb] = await Promise.all([
      resBlob('BufferGeometryUtils').then(b => b.text()), resBlob('SkeletonUtils').then(b => b.text()),
      resBlob('GLTFLoader').then(b => b.text()), resBlob('body.glb').then(b => b.arrayBuffer())]);
    const bguURL = jsURL(toThree(bgu)), skuURL = jsURL(toThree(sku));
    const glURL = jsURL(toThree(gl).split("'../utils/BufferGeometryUtils.js'").join(`'${bguURL}'`).split("'../utils/SkeletonUtils.js'").join(`'${skuURL}'`));
    const [{ GLTFLoader }, SU] = await Promise.all([import(glURL), import(skuURL)]);
    return prepBody(THREE, await new GLTFLoader().parseAsync(glb, ''), SU);
  })());
}

const REG = { jersey: 0, pants: 1, belt: 2, sock: 3, shoe: 4, skin: 5, hair: 6 };
function prepBody(THREE, gltf, SU) {
  let mesh = null; gltf.scene.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  if (!mesh) throw new Error('body.glb: no skinned mesh');
  const sk = mesh.skeleton, NAME = sk.bones.map(b => b.name.replace(/^mixamorig:?/, ''));
  const idx = (n) => { const i = NAME.indexOf(n); if (i < 0) throw new Error('body.glb: no bone ' + n); return i; };
  // rest pose has identity bone rotations, so bind-space offsets are plain world offsets (metres)
  const bind = (n) => new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[idx(n)].clone().invert());
  const geo = mesh.geometry, pos = geo.attributes.position, nor = geo.attributes.normal, ji = geo.attributes.skinIndex, jw = geo.attributes.skinWeight, N = pos.count;
  const dom = new Array(N);
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < N; i++) {
    let dw = -1; for (let s = 0; s < 4; s++) { const w = jw.getComponent(i, s); if (w > dw) { dw = w; dom[i] = NAME[ji.getComponent(i, s)]; } }
    const y = pos.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const H = y1 - y0;
  const headBox = new THREE.Box3(), hv = new THREE.Vector3();
  for (let i = 0; i < N; i++) if (dom[i] === 'Head') headBox.expandByPoint(hv.fromBufferAttribute(pos, i));
  const skull = { top: headBox.max.y, zc: (headBox.min.z + headBox.max.z) / 2 - .012, rx: (headBox.max.x - headBox.min.x) / 2, face: headBox.max.z };
  // the base mesh is androgynous: flatten the bust so the jersey reads as an athlete's chest
  const lo = bind('Spine1').y, hi = bind('Neck').y - .04, chest = [];
  let zMax = -Infinity;
  for (let i = 0; i < N; i++) if (/^Spine[12]$/.test(dom[i]) && Math.abs(pos.getX(i)) < .17 && pos.getY(i) > lo && pos.getY(i) < hi) { chest.push(i); zMax = Math.max(zMax, pos.getZ(i)); }
  const zc = zMax - .045;
  const moved = chest.filter(i => pos.getZ(i) > zc - .015);
  moved.forEach(i => { const z = pos.getZ(i); if (z > zc) pos.setZ(i, zc + (z - zc) * .35); });
  if (moved.length) {           // fresh normals only where the surface moved (keeps the mesh's UV-seam normals intact)
    const tmp = new THREE.BufferGeometry(); tmp.setAttribute('position', pos); tmp.setIndex(geo.index); tmp.computeVertexNormals();
    const tn = tmp.attributes.normal; moved.forEach(i => nor.setXYZ(i, tn.getX(i), tn.getY(i), tn.getZ(i)));
    pos.needsUpdate = nor.needsUpdate = true;
  }
  // uniform regions: clean cuts by body geometry rather than by blended skin weights
  const waistY = bind('Hips').y + .09, beltH = .014, headY = bind('Head').y;
  const arms = { Left: [bind('LeftArm'), bind('LeftForeArm')], Right: [bind('RightArm'), bind('RightForeArm')] };
  const region = new Uint8Array(N), v = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const n = dom[i]; v.fromBufferAttribute(pos, i); const f = (v.y - y0) / H;
    let r = REG.skin;
    if (/^(Spine\d*|Hips)$/.test(n)) r = v.y > waistY + beltH ? REG.jersey : v.y > waistY - beltH ? REG.belt : REG.pants;
    else if (/Shoulder$/.test(n)) r = REG.jersey;
    else if (/^(Left|Right)Arm$/.test(n)) { const [a, e] = arms[n.startsWith('Left') ? 'Left' : 'Right']; d.subVectors(e, a); r = v.clone().sub(a).dot(d) / d.lengthSq() < .78 ? REG.jersey : REG.skin; }
    else if (/UpLeg$|Leg$/.test(n)) r = f < .26 ? REG.sock : REG.pants;
    else if (/Foot|Toe/.test(n)) r = REG.shoe;
    else if (n === 'Head' && (v.y > skull.top - .085 || (v.z < skull.zc - .035 && v.y > skull.top - .16))) r = REG.hair;
    region[i] = r;
  }
  // jersey print mask (1 = torso, 2 = sleeve) + torso axis for the pinstripes
  const part = new Float32Array(N);
  let tz0 = Infinity, tz1 = -Infinity;
  for (let i = 0; i < N; i++) {
    if (region[i] !== REG.jersey) continue;
    part[i] = /^(Spine\d*|Hips)$/.test(dom[i]) ? 1 : 2;
    if (part[i] === 1 && Math.abs(pos.getX(i)) < .04) { const z = pos.getZ(i); if (z < tz0) tz0 = z; if (z > tz1) tz1 = z; }
  }
  geo.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  const deco = { neckY: bind('Neck').y, waistY, zc: (tz0 + tz1) / 2 };
  // rest pose is an A-pose; the mannequin's zero pose has arms and legs hanging straight down
  const down = new THREE.Vector3(0, -1, 0);
  const drop = (a, b) => new THREE.Quaternion().setFromUnitVectors(bind(b).sub(bind(a)).normalize(), down);
  const R = { L: drop('LeftArm', 'LeftForeArm'), R: drop('RightArm', 'RightForeArm'), LL: drop('LeftUpLeg', 'LeftLeg'), RL: drop('RightUpLeg', 'RightLeg') };
  const k = 5.9 / H;                                           // mannequin units: ~5.9 tall
  const side = (S) => ({
    palm: bind(S + 'HandMiddle1').sub(bind(S + 'Hand')).multiplyScalar(.35),
    knuckle: bind(S + 'HandPinky1').sub(bind(S + 'HandIndex1')).normalize()
  });
  return {
    SU, scene: gltf.scene, mesh, region, R, k, bind, skull, deco, hand: { L: side('Left'), R: side('Right') },
    legS: bind('LeftUpLeg').y * k / 2.85, hipUp: (bind('Hips').y - bind('LeftUpLeg').y) * k
  };
}

// Jersey print, projected in the shader from the bind-pose (pre-skinning) position: the wordmark, back number,
// placket and pinstripes sit on the cloth and follow every pose. Same artwork rules as the mannequin's jerseyTex.
function jerseyMaterial(THREE, kit, number, dc) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72 });
  const tex = (w, h, draw) => { const t = canvasTex(THREE, w, h, draw); t.premultiplyAlpha = true; return t; };
  const named = !!kit.name, n = String(number);
  const ink = (g, text, x, y, px, lw) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${px}px ${FONT}`; g.lineJoin = 'round';
    g.lineWidth = lw; g.strokeStyle = hex(kit.jersey); g.strokeText(text, x, y); g.fillStyle = hex(kit.accent); g.fillText(text, x, y);
  };
  const logo = named ? tex(512, 128, (g, W, H) => ink(g, kit.name, W / 2, H * .54, kit.name.length > 6 ? 82 : 100, 14)) : null;
  const num = named ? tex(256, 256, (g, W, H) => ink(g, n, W / 2, H * .55, n.length > 1 ? 190 : 210, 16)) : null;
  const U = {
    uLogo: { value: logo }, uNum: { value: num }, uDeco: { value: named ? 1 : 0 },
    uLogoR: { value: new THREE.Vector4(0, dc.neckY - .13, .3, .3 / 4) },        // centre x, centre y, width, height (m)
    uNumR: { value: new THREE.Vector4(0, dc.neckY - .2, .2, .2) },
    uPin: { value: new THREE.Color(kit.pinstripe ?? 0) }, uPinOn: { value: kit.pinstripe ? 1 : 0 },
    uTorsoZ: { value: dc.zc }, uWaist: { value: dc.waistY }
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPart;\nvarying vec3 vBP;\nvarying vec3 vBN;\nvarying float vPart;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvBN = objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBP = position; vPart = aPart;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uLogo, uNum; uniform vec4 uLogoR, uNumR; uniform vec3 uPin; uniform float uPinOn, uDeco, uWaist, uTorsoZ;
varying vec3 vBP; varying vec3 vBN; varying float vPart;
vec4 slDecal(sampler2D t, vec4 r, vec2 p, float flip) {
  vec2 uv = vec2(.5 + flip * (p.x - r.x) / r.z, .5 + (p.y - r.y) / r.w);
  if (uv.x <= 0. || uv.x >= 1. || uv.y <= 0. || uv.y >= 1.) return vec4(0.);
  return texture2D(t, uv);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vPart > .5 && vPart < 1.5) {
  vec3 bp = vBP;
  if (uPinOn > .5) {                                       // pinstripes around the torso (~44 around), faded out when tiny on screen
    float s = atan(bp.x, bp.z - uTorsoZ) * 7.;
    float aa = fwidth(s), f = abs(fract(s + .5) - .5);
    float l = (1. - smoothstep(.04, .04 + aa * 1.5, f)) * (1. - smoothstep(.25, .5, aa));
    diffuseColor.rgb = mix(diffuseColor.rgb, uPin, l * .9);
  }
  if (vBN.z > .25) {                                       // front: placket, buttons, chest wordmark
    float ax = fwidth(bp.x) * 1.5 + 1e-4;
    diffuseColor.rgb *= 1. - .16 * (1. - smoothstep(.003, .003 + ax, abs(bp.x)));
    for (int i = 0; i < 6; i++) {
      float d = length(vec2(bp.x, bp.y - (uWaist + .06 + float(i) * .068)));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.85), .6 * (1. - smoothstep(.0038, .0038 + ax, d)));
    }
    if (uDeco > .5) { vec4 t = slDecal(uLogo, uLogoR, bp.xy, 1.); diffuseColor.rgb = diffuseColor.rgb * (1. - t.a) + t.rgb; }
  } else if (vBN.z < -.25 && uDeco > .5) {                 // back number (mirrored: seen from behind, +x is on the viewer's left)
    vec4 t = slDecal(uNum, uNumR, bp.xy, -1.); diffuseColor.rgb = diffuseColor.rgb * (1. - t.a) + t.rgb;
  }
}`);
  };
  mat.customProgramCacheKey = () => 'sl-jersey-1';
  return mat;
}

function makeFigureGLB(THREE, o, BD) {
  const kit = o.kit, k = BD.k, G = () => new THREE.Group();
  const root = G(), body = BD.SU.clone(BD.scene); body.scale.setScalar(k); root.add(body);
  let mesh = null; body.traverse(n => { if (n.isSkinnedMesh && !mesh) mesh = n; });
  const bones = {}; mesh.skeleton.bones.forEach(b => { bones[b.name.replace(/^mixamorig:?/, '')] = b; });
  // per-figure colours; every other attribute is shared with the base mesh
  const base = BD.mesh.geometry, g = new THREE.BufferGeometry();
  for (const a in base.attributes) g.setAttribute(a, base.attributes[a]);
  g.setIndex(base.index);
  const pal = [kit.jersey, kit.pants, kit.belt, kit.socks, kit.cleats, o.skin, o.hair].map(c => new THREE.Color(c));
  const col = new Float32Array(BD.region.length * 3);
  BD.region.forEach((r, i) => { const c = pal[r]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; });
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  mesh.geometry = g;
  mesh.material = jerseyMaterial(THREE, kit, o.number ?? 7, BD.deco);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;   // skinned poses leave the bind bounds

  // invisible proxies with the mannequin's joint names and pivots (read by look(), written by frame())
  const rig = G(); rig.visible = false; root.add(rig);
  const hips = G(); hips.position.y = 2.95; rig.add(hips);
  const torso = G(); hips.add(torso);
  const head = G(); head.position.y = 2.38; torso.add(head);
  const arm = (x) => { const sh = G(); sh.position.set(x, 1.5, 0); torso.add(sh); const el = G(); el.position.y = -.98; sh.add(el); return { sh, el }; };
  const leg = (x) => { const hip = G(); hip.position.set(x, -.1, 0); hips.add(hip); const knee = G(); knee.position.y = -1.42; hip.add(knee); return { hip, knee }; };
  const aR = arm(-.72), aL = arm(.72), lR = leg(-.3), lL = leg(.3);
  // hands are real nodes on the hand bones, oriented like the mannequin's hand, so bat / glove / tablet ride along
  const hand = (S) => {
    const h = G(); h.position.copy(BD.hand[S].palm); h.quaternion.copy(BD.R[S]).invert(); h.scale.setScalar(1 / k);
    bones[(S === 'L' ? 'Left' : 'Right') + 'Hand'].add(h); return h;
  };
  // relaxed grip so hands read as holding a bat / ball / glove
  for (const S of ['L', 'R']) for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (let j = 1; j <= 3; j++) {
    const b = bones[(S === 'L' ? 'Left' : 'Right') + 'Hand' + f + j];
    if (b) b.quaternion.setFromAxisAngle(BD.hand[S].knuckle, (S === 'L' ? 1 : -1) * CURL * (j === 1 ? .7 : 1));
  }

  // hard gear (metres, in bone space)
  const M = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, ...x });
  const mats = { leather: M(0x7A4A23), dark: M(0x15151A, { roughness: .5 }), gear: M(kit.gear ?? kit.cap, { roughness: .45 }) };
  const at = (bone, worldY, z = 0) => { const p = BD.bind(bone); return [0, worldY - p.y, z - p.z]; };
  const put = (bone, geo, mat, [x, y, z]) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; bones[bone].add(m); return m; };
  const hp = BD.bind('Head'), sc = BD.skull, cy = sc.top - .1;
  const hc = [0, cy - hp.y, sc.zc - hp.z];                                                        // crown centre, head-bone space
  const dome = (r, ry, rz, len, mat) => { const m = put('Head', new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * len), mat, hc); m.scale.set(r, ry, rz); return m; };
  const bill = (r, y, z, mat) => { const m = put('Head', new THREE.CircleGeometry(r, 20, 0, Math.PI), mat, [0, hc[1] + y, hc[2] + z]); m.rotation.x = Math.PI / 2 + .12; return m; };
  if (kit.helmet || kit.mask) {
    const shell = new THREE.MeshPhysicalMaterial({ color: kit.helmet ? kit.cap : (kit.gear ?? kit.cap), roughness: .35, clearcoat: .8, clearcoatRoughness: .2, side: THREE.DoubleSide });
    dome(sc.rx + .016, .112, .112, .52, shell);
    if (kit.helmet) {
      put('Head', new THREE.BoxGeometry(.02, .075, .09), shell, [(o.flap ?? 1) * (sc.rx + .018), hc[1] - .05, hc[2] + .005]);
      bill(.07, -.006, .1, shell);
    } else {                                                                                    // catcher / umpire mask cage
      const fz = sc.face - hp.z + .012, fy = hc[1] - .045;
      put('Head', new THREE.TorusGeometry(.075, .006, 6, 24), mats.dark, [0, fy, fz]);
      put('Head', new THREE.TorusGeometry(.045, .005, 6, 18), mats.dark, [0, fy, fz + .008]);
      put('Head', new THREE.BoxGeometry(.006, .15, .006), mats.dark, [0, fy, fz + .006]);
    }
  } else {
    const capM = M(kit.cap, { roughness: .55, side: THREE.DoubleSide });
    dome(sc.rx + .008, .104, .102, .5, capM);
    bill(.085, .002, .09, capM);
  }
  if (kit.protector) put('Spine1', new THREE.CapsuleGeometry(.13, .14, 6, 14), mats.gear, at('Spine1', 1.2, .105)).scale.set(1.05, 1, .32);
  for (const S of ['Left', 'Right']) {
    put(S + 'Foot', new THREE.CapsuleGeometry(.045, .17, 6, 12).rotateX(Math.PI / 2), M(kit.cleats, { roughness: .35 }), [0, -.045, .075]).scale.set(1, .85, 1);
    if (kit.guards) put(S + 'Leg', new THREE.CapsuleGeometry(.05, .28, 4, 12), mats.gear, [0, -.19, .045]).scale.set(1, 1, .8);
  }

  const fig = { root, hips, torso, head, shR: aR.sh, elR: aR.el, handR: hand('R'), shL: aL.sh, elL: aL.el, handL: hand('L'), hipR: lR.hip, kneeR: lR.knee, hipL: lL.hip, kneeL: lL.knee, mats, phase: Math.random() * 6.28 };
  const Rd = BD.R, Ri = {}; for (const s in Rd) Ri[s] = Rd[s].clone().invert();
  const q = new THREE.Quaternion(), qa = new THREE.Quaternion(), I = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  const hb = bones.Hips, hip0 = hb.position.clone();
  fig.sync = () => {
    hb.position.set(hip0.x, (BD.legS * (hips.position.y - .1) + BD.hipUp) / k, hip0.z);   // longer real legs: keep feet on the ground
    hb.quaternion.setFromEuler(hips.rotation);
    q.setFromEuler(torso.rotation); ['Spine', 'Spine1', 'Spine2'].forEach(n => bones[n].quaternion.slerpQuaternions(I, q, 1 / 3));
    q.setFromEuler(head.rotation); bones.Neck.quaternion.slerpQuaternions(I, q, .35); bones.Head.quaternion.slerpQuaternions(I, q, .65);
    [['L', aL, 'Left'], ['R', aR, 'Right']].forEach(([s, a, B]) => {
      bones[B + 'Arm'].quaternion.setFromEuler(a.sh.rotation).multiply(Rd[s]);
      bones[B + 'ForeArm'].quaternion.copy(Ri[s]).multiply(q.setFromEuler(a.el.rotation)).multiply(Rd[s]);
    });
    [['LL', lL, 'Left', 1], ['RL', lR, 'Right', -1]].forEach(([s, l, B, sg]) => {
      qa.setFromAxisAngle(Z, sg * Math.max(0, Math.abs(l.hip.position.x) - .3) * .5);          // wider stance = hip abduction
      bones[B + 'UpLeg'].quaternion.setFromEuler(l.hip.rotation).multiply(qa).multiply(Rd[s]);
      bones[B + 'Leg'].quaternion.copy(Ri[s]).multiply(q.setFromEuler(l.knee.rotation)).multiply(Rd[s]);
    });
  };
  fig.sync();
  return fig;
}
const CURL = 1.1;
function makeFigure(THREE, o) { return BODY ? makeFigureGLB(THREE, o, BODY) : makeMannequin(THREE, o); }
