// ---- realistic player ----
// Five Tripo-generated players (T-pose, auto-rigged with Tripo's Mixamo skeleton preset), packed by tools/pack_player.py:
// HELMETS (batter, catcher) and CAPS (alternating over pitcher, umpire, coach and fielders). The Mixamo motion is baked
// once, rig-independent, in `clips_shared.json` (harness/bake.html), and rigClips() turns it into local poses for each
// rig at load time. The page's animation code still writes the mannequin's joint names (shR, elR, hipL, ...): here they
// are invisible proxies, and fig.sync(tau) plays the motion on the real bones, then turns the head toward what the
// page has everyone watching.
// If the body or its motion fails to load, makeFigure() falls back to the procedural mannequin.
let BODY = null, bodyP = null;
const HELMETS = ['player', 'player_helmet2'], CAPS = ['player_cap', 'player_cap2', 'player_cap3'];
const resBlob = async (id) => {
  const R = window.__resources || {}, Bl = window.__resourceBlobs || {}, u = R[id];
  if (!u) throw new Error('missing resource ' + id);
  return Bl[u] || (await fetch(u)).blob();
};
const jsURL = (src) => URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
const toThree = (src) => src.split("} from 'three';").join(`} from '${threeModURL}';`);
function loadBody(THREE) {
  return bodyP || (bodyP = (async () => {
    const [bgu, sku, gl] = await Promise.all(['BufferGeometryUtils', 'SkeletonUtils', 'GLTFLoader'].map(id => resBlob(id).then(b => b.text())));
    const bguURL = jsURL(toThree(bgu)), skuURL = jsURL(toThree(sku));
    const glURL = jsURL(toThree(gl).split("'../utils/BufferGeometryUtils.js'").join(`'${bguURL}'`).split("'../utils/SkeletonUtils.js'").join(`'${skuURL}'`));
    const [{ GLTFLoader }, SU] = await Promise.all([import(glURL), import(skuURL)]);
    const S = JSON.parse(await resBlob('clips_shared.json').then(b => b.text()));
    const one = async (name) => {
      const BD = prepBody(THREE, await new GLTFLoader().parseAsync(await resBlob(name + '.glb').then(b => b.arrayBuffer()), ''), SU);
      BD.clips = rigClips(THREE, S, BD.rig);
      return BD;
    };
    const all = await Promise.all([...HELMETS, ...CAPS].map(one));
    return { helmets: all.slice(0, HELMETS.length), caps: all.slice(HELMETS.length) };
  })());
}

function prepBody(THREE, gltf, SU) {
  let mesh = null; gltf.scene.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  if (!mesh) throw new Error('player.glb: no skinned mesh');
  gltf.scene.updateMatrixWorld(true);
  const sk = mesh.skeleton, NAME = sk.bones.map(b => b.name.replace(/^mixamorig:?/, ''));
  const idx = (n) => { const i = NAME.indexOf(n); if (i < 0) throw new Error('player.glb: no bone ' + n); return i; };
  const bind = (n) => new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[idx(n)].clone().invert());   // bind-pose position (model units)
  const restQ = (n) => sk.bones[idx(n)].getWorldQuaternion(new THREE.Quaternion());                         // bind-pose bone orientation
  const geo = mesh.geometry, pos = geo.attributes.position, ji = geo.attributes.skinIndex, jw = geo.attributes.skinWeight, N = pos.count;
  geo.computeBoundingBox();
  const H = geo.boundingBox.max.y - geo.boundingBox.min.y, u = H / 1.75;   // u: one "metre" of the gear below, for a 1.75 m player
  // per vertex: dominant bone, and how much it follows the head (helmet colour is picked from this in the shader)
  const head = new Float32Array(N), headBox = new THREE.Box3(), chest = { z: -Infinity }, v = new THREE.Vector3();
  const HEAD = new Set(['Head', 'HeadTop_End'].map(idx));
  for (let i = 0; i < N; i++) {
    let dw = -1, dn = 0;
    for (let s = 0; s < 4; s++) {
      const j = ji.getComponent(i, s), w = jw.getComponent(i, s);
      if (HEAD.has(j)) head[i] += w;
      if (w > dw) { dw = w; dn = j; }
    }
    v.fromBufferAttribute(pos, i);
    if (HEAD.has(dn)) headBox.expandByPoint(v);
    if (/^Spine[12]$/.test(NAME[dn]) && Math.abs(v.x) < .05 * u) chest.z = Math.max(chest.z, v.z);
  }
  geo.setAttribute('aHead', new THREE.BufferAttribute(head, 1));
  const skull = { top: headBox.max.y, zc: (headBox.min.z + headBox.max.z) / 2, rx: (headBox.max.x - headBox.min.x) / 2, face: headBox.max.z };
  // face and torso landmarks from the mesh, measured up from the chin so a cap brim or helmet visor doesn't count:
  // eyes ~11.5 cm above the chin, the face front is the nose / cheek band just below them
  let chinY = Infinity; const face = { z1: -Infinity }, torso = { z0: Infinity, z1: -Infinity };
  for (let i = 0; i < N; i++) { v.fromBufferAttribute(pos, i); if (head[i] > .5 && v.z > skull.zc && Math.abs(v.x) < .03 * u) chinY = Math.min(chinY, v.y); }
  const eyeY = chinY + .115 * u;
  for (let i = 0; i < N; i++) {
    v.fromBufferAttribute(pos, i);
    if (head[i] > .5 && v.y > eyeY - .06 * u && v.y < eyeY - .02 * u && Math.abs(v.x) < .03 * u) face.z1 = Math.max(face.z1, v.z);
    if (head[i] < .1 && v.y > bind('Spine1').y && v.y < bind('Neck').y - .05 * u && Math.abs(v.x) < .04 * u) { torso.z0 = Math.min(torso.z0, v.z); torso.z1 = Math.max(torso.z1, v.z); }
  }
  Object.assign(skull, { eyeY, face: face.z1, zc: face.z1 - .09 * u });   // the mask's bars curve round a ~9 cm face radius
  // rest pose is a T-pose; the mannequin's zero pose has arms and legs hanging straight down
  const down = new THREE.Vector3(0, -1, 0);
  const drop = (a, b) => new THREE.Quaternion().setFromUnitVectors(bind(b).sub(bind(a)).normalize(), down);
  const side = (S) => ({
    palm: bind(S + 'HandMiddle1').sub(bind(S + 'Hand')).multiplyScalar(.35),
    knuckle: bind(S + 'HandPinky1').sub(bind(S + 'HandIndex1')).normalize(),
    drop: drop(S + 'Arm', S + 'ForeArm'), rest: restQ(S + 'Hand')
  });
  const rig = {}; sk.bones.forEach((b, i) => { rig[NAME[i]] = b; });
  const fwd = (n) => new THREE.Vector3(0, 0, 1).applyQuaternion(restQ(n).invert());   // the face's +z in a bone's own frame
  return { SU, scene: gltf.scene, mesh, rig, k: 5.9 / H, u, bind, restQ, skull, chest, neckY: bind('Neck').y, torsoZ: (torso.z0 + torso.z1) / 2, headFwd: fwd('Head'), hand: { L: side('Left'), R: side('Right') } };
}

// The player's own PBR material, recoloured per team in the shader: the dark navy of the jersey (and of the helmet,
// told apart by its head weight) and the white of the pants are swapped for the kit's colours, keeping the texture's
// folds and shading (luminance ratio). Skin, the red sleeves, belt and shoes are left as generated.
// The chest wordmark and back number are printed onto the jersey's navy cloth, projected from the bind pose (pre-skinning)
// so they follow every pose.
function playerMaterial(THREE, base, kit, number, BD, skin) {
  const mat = base.clone(), u = BD.u, keep = !!kit.keep;
  const named = !!kit.name, n = String(number), fill = keep ? 0xF1EDE4 : kit.accent, edge = keep ? 0xC8303A : kit.jersey;
  const mono = kit.name === 'SPRAYLAB' ? 'SL' : kit.name ? kit.name[0] : '';   // cap / helmet front
  const ink = (g, text, x, y, px, lw) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${px}px ${FONT}`; g.lineJoin = 'round';
    g.lineWidth = lw; g.strokeStyle = hex(edge); g.strokeText(text, x, y); g.fillStyle = hex(fill); g.fillText(text, x, y);
  };
  const logo = named ? canvasTex(THREE, 512, 128, (g, W, H) => ink(g, kit.name, W / 2, H * .54, kit.name.length > 6 ? 82 : 100, 14)) : null;
  const num = named ? canvasTex(THREE, 256, 256, (g, W, H) => ink(g, n, W / 2, H * .55, n.length > 1 ? 190 : 210, 16)) : null;
  const capT = mono ? canvasTex(THREE, 256, 256, (g, W, H) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${mono.length > 1 ? 150 : 200}px ${FONT}`; g.lineJoin = 'round';
    g.lineWidth = 18; g.strokeStyle = hex(keep ? 0xC8303A : kit.jersey === 0xC8303A ? 0xC8303A : kit.cap); g.strokeText(mono, W / 2, H * .56);
    g.fillStyle = hex(keep ? 0xF1EDE4 : 0xF1EDE4); g.fillText(mono, W / 2, H * .56);
  }) : null;
  const lin = (c) => new THREE.Color(c);
  const U = {
    uJersey: { value: lin(kit.jersey) }, uHelmet: { value: lin(kit.helmet ? kit.cap : kit.gear ?? kit.cap) }, uPants: { value: lin(kit.pants) }, uKeep: { value: keep ? 1 : 0 },
    uLogo: { value: logo }, uNum: { value: num }, uDeco: { value: named ? 1 : 0 },
    uLogoR: { value: new THREE.Vector4(0, BD.neckY - .15 * u, .3 * u, .075 * u) }, uNumR: { value: new THREE.Vector4(0, BD.neckY - .23 * u, .2 * u, .2 * u) },   // centre x, y, width, height
    uPin: { value: lin(kit.accent) }, uPinOn: { value: kit.pinstripe ? 1 : 0 }, uTorsoZ: { value: BD.torsoZ }, uChestW: { value: .19 * u },
    uSkin: { value: skin }, uCap: { value: capT }, uCapR: { value: new THREE.Vector4(0, BD.skull.eyeY + .085 * u, .07 * u, .07 * u) }
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aHead;\nvarying float vHead;\nvarying vec3 vBP;\nvarying vec3 vBN;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvBN = objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHead = aHead; vBP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uJersey, uHelmet, uPants, uPin, uSkin; uniform float uKeep, uDeco, uPinOn, uTorsoZ, uChestW; uniform sampler2D uLogo, uNum, uCap; uniform vec4 uLogoR, uNumR, uCapR;
varying float vHead; varying vec3 vBP; varying vec3 vBN;
vec4 slDecal(sampler2D t, vec4 r, vec2 p, float flip) {
  vec2 uv = vec2(.5 + flip * (p.x - r.x) / r.z, .5 + (p.y - r.y) / r.w);
  if (uv.x <= 0. || uv.x >= 1. || uv.y <= 0. || uv.y >= 1.) return vec4(0.);
  return texture2D(t, uv);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb;                                   // linear
  float lum = dot(c, vec3(.2126, .7152, .0722)), mx = max(c.r, max(c.g, c.b)), sat = mx - min(c.r, min(c.g, c.b));
  float navy = smoothstep(.006, .02, c.b - c.r) * (1. - smoothstep(.06, .12, lum)) * (1. - smoothstep(.05, .15, c.r - c.b));
  float white = smoothstep(.2, .4, lum) * (1. - smoothstep(.15, .3, sat / max(mx, 1e-3)));   // bright and nearly grey (relative chroma)
  float hd = smoothstep(.3, .7, vHead);
  float gr = c.g / max(c.r, 1e-3), br = c.b / max(c.r, 1e-3);   // skin: warm, neither the red sleeves nor grey cloth
  float skin = smoothstep(.4, .5, gr) * (1. - smoothstep(.86, .95, gr)) * (1. - smoothstep(.86, .95, br)) * smoothstep(.015, .04, lum);
  c = mix(c, c * uSkin, skin);
  if (uKeep < .5) {
    vec3 team = mix(uJersey, uHelmet, hd);
    float dark = clamp(lum / .022, .25, 1.8), light = mix(.74, 1.08, smoothstep(.004, .05, lum));   // light kits: folds stay, cloth stays white
    c = mix(c, team * mix(dark, light, smoothstep(.15, .5, dot(team, vec3(.2126, .7152, .0722)))), navy);
    c = mix(c, uPants * clamp(lum / .7, .3, 1.25), white * (1. - hd));
  }
  if (uDeco > .5 && vBN.z > .55) { vec4 t = slDecal(uCap, uCapR, vBP.xy, 1.); c = mix(c, t.rgb, t.a * navy * hd); }   // cap / helmet front
  float cloth = navy * (1. - hd);                              // prints go on the jersey cloth only
  if (uPinOn > .5) {                                           // pinstripes round the torso (~44 around), faded out when tiny on screen
    float st = atan(vBP.x, vBP.z - uTorsoZ) * 7., aa = fwidth(st), f = abs(fract(st + .5) - .5);
    float line = (1. - smoothstep(.04, .04 + aa * 1.5, f)) * (1. - smoothstep(.25, .5, aa)) * (1. - smoothstep(uChestW, uChestW * 1.15, abs(vBP.x)));
    c = mix(c, uPin, line * cloth * .55);
  }
  if (uDeco > .5 && cloth > .01) {
    vec4 t = vBN.z > .25 ? slDecal(uLogo, uLogoR, vBP.xy, 1.) : vBN.z < -.25 ? slDecal(uNum, uNumR, vBP.xy, -1.) : vec4(0.);
    c = mix(c, t.rgb, t.a * cloth);
  }
  diffuseColor.rgb = c;
}`);
  };
  mat.customProgramCacheKey = () => 'sl-player-5';
  return mat;
}

// Fielder's glove (palm pocket, four fingers, thumb, laced web, cuff) or, when `mitt`, the catcher's round padded mitt.
// In the mannequin's hand frame: the hand hangs along -y, the palm faces +z, the thumb is on +x.
// The parts are merged into one leather and one lace mesh per glove size (2 draw calls per glove).
const GLOVE = {};
function makeGlove(THREE, r, mitt) {
  const L = GLOVE.leather || (GLOVE.leather = new THREE.MeshStandardMaterial({ color: 0x8A5428, roughness: .62 }));
  const D = GLOVE.lace || (GLOVE.lace = new THREE.MeshStandardMaterial({ color: 0x4A2A14, roughness: .7 }));
  const key = r + (mitt ? 'm' : 'g');
  if (!GLOVE[key]) {
    const parts = { L: [], D: [] }, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const add = (geo, k, x, y, z, rz = 0, sx = 1, sy = 1, sz = 1) =>
      parts[k].push(geo.toNonIndexed().applyMatrix4(m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(0, 0, rz)), new THREE.Vector3(sx, sy, sz))));
    add(new THREE.CylinderGeometry(r * .42, r * .46, r * .32, 16), 'D', 0, -r * .05, 0);                 // cuff round the wrist
    if (mitt) {
      add(new THREE.SphereGeometry(r, 20, 14), 'L', 0, -r * .85, 0, 0, 1, 1.05, .42);                     // padded disc
      add(new THREE.TorusGeometry(r * .92, r * .14, 8, 28), 'D', 0, -r * .85, 0, 0, 1, 1.05, 1);          // laced rim
      add(new THREE.SphereGeometry(r * .32, 12, 9), 'L', r * .85, -r * .55, 0, 0, 1, 1.3, .8);            // thumb pad
    } else {
      add(new THREE.SphereGeometry(r * .62, 16, 12), 'L', 0, -r * .65, 0, 0, 1, 1.05, .5);                 // palm / pocket
      [[-.42, -.06], [-.14, -.02], [.14, .02], [.4, .07]].forEach(([x, a], i) =>                          // four fingers, fanned
        add(new THREE.CapsuleGeometry(r * .16, r * (i === 1 || i === 2 ? .95 : .8), 4, 10), 'L', r * x, -r * 1.45, 0, a, 1, 1, .8));
      add(new THREE.CapsuleGeometry(r * .17, r * .75, 4, 10), 'L', r * .82, -r * .95, 0, -.55, 1, 1, .8);  // thumb
      add(new THREE.BoxGeometry(r * .42, r * .7, r * .06), 'D', r * .6, -r * 1.55, 0, -.25);                // laced web between thumb and index
    }
    const merge = (list) => {
      const g = new THREE.BufferGeometry();
      for (const n of ['position', 'normal']) {
        const out = new Float32Array(list.reduce((s, x) => s + x.attributes[n].array.length, 0)); let o = 0;
        list.forEach(x => { out.set(x.attributes[n].array, o); o += x.attributes[n].array.length; });
        g.setAttribute(n, new THREE.BufferAttribute(out, 3));
      }
      return g;
    };
    GLOVE[key] = { L: merge(parts.L), D: merge(parts.D) };
  }
  const g = new THREE.Group(); g.position.y = -.1;
  for (const [k, mat] of [['L', L], ['D', D]]) { const m = new THREE.Mesh(GLOVE[key][k], mat); m.castShadow = true; g.add(m); }
  return g;
}

// ---- baked Mixamo motion (harness/bake.html): 30 fps local bone rotations (int16) + hips position (mm) ----
// <rigClips> (harness/check_shared.html extracts this function and compares it with bake.html?body=<rig>)
// Same maths as harness/retarget.js, on the shared tracks: a bone's target world rotation is the clip's world delta D,
// times C (turns the rig's rest bone direction onto the clip's rest direction), times the rig's rest orientation T0;
// the local pose divides out the parent's. Hips move by the clip's delta in hip heights times this rig's hip height.
function rigClips(THREE, S, rig) {
  const bytes = (b64) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
  const strip = (n) => n.replace(/^mixamorig:?/, ''), V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion(), I = Q();
  const wp = (b) => b.getWorldPosition(V()), wq = (b) => b.getWorldQuaternion(Q());
  rig.Hips.parent.updateWorldMatrix(true, true);
  const order = []; const visit = (b) => { if (b.isBone && rig[strip(b.name)]) order.push(strip(b.name)); b.children.forEach(visit); }; visit(rig.Hips);
  const T0 = {}; order.forEach(n => { T0[n] = wq(rig[n]); });
  const P0inv = wq(rig.Hips.parent).invert(), hipsT0 = rig.Hips.position.clone(), hipK = wp(rig.Hips).y / rig.Hips.parent.getWorldScale(V()).y;
  const out = {};
  for (const id in S.clips) {
    const c = S.clips[id], at = {}; c.bones.forEach((n, i) => { at[n] = i; });
    const names = order.filter(n => n in at), B = names.length, SB = c.bones.length, sd = new Float32Array(bytes(c.sd)), d = new Int16Array(bytes(c.d)), h = new Int16Array(bytes(c.hips));
    const C = {};
    for (const n of names) {
      C[n] = Q(); const ch = c.child[at[n]], tc = ch && rig[n].children.find(x => x.isBone && strip(x.name) === ch);
      if (tc) C[n].setFromUnitVectors(wp(tc).sub(wp(rig[n])).normalize(), V().fromArray(sd, at[n] * 3));
    }
    for (const n of names) if (C[n].equals(I)) {                // fingers / toes without a child inherit their parent's alignment
      let p = rig[n].parent; while (p && p.isBone && C[strip(p.name)] && C[strip(p.name)].equals(I)) p = p.parent;
      if (p && p.isBone && C[strip(p.name)]) C[n].copy(C[strip(p.name)]);
    }
    const K = names.map(n => C[n].clone().multiply(T0[n])), par = names.map(n => names.indexOf(strip(rig[n].parent.name)));
    const q = new Float32Array(c.n * B * 4), hp = new Float32Array(c.n * 3), W = names.map(Q), D = Q(), L = Q(), p = V();
    for (let f = 0; f < c.n; f++) {
      names.forEach((n, i) => {
        const j = (f * SB + at[n]) * 4;
        W[i].multiplyQuaternions(D.set(d[j], d[j + 1], d[j + 2], d[j + 3]).normalize(), K[i]);
        if (par[i] >= 0) L.copy(W[par[i]]).invert(); else L.copy(P0inv);
        L.multiply(W[i]).toArray(q, (f * B + i) * 4);
      });
      p.set(h[f * 3], h[f * 3 + 1], h[f * 3 + 2]).multiplyScalar(hipK / 10000).applyQuaternion(P0inv).add(hipsT0).multiplyScalar(1000).toArray(hp, f * 3);   // mm
    }
    out[id] = { n: c.n, bones: names, q, h: hp, fps: S.fps };
  }
  return out;
}
// </rigClips>
const smooth01 = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
function clipPlayer(BD, bones, role, fig) {
  const C = BD.clips, names = (C.idle || C.pitch).bones, B = names.length, list = names.map(n => bones[n]);
  const A = new Float32Array(B * 4 + 3), Bp = new Float32Array(B * 4 + 3), O = new Float32Array(B * 4 + 3);
  const sample = (id, t, out) => {
    const c = C[id], x = Math.max(0, Math.min(c.n - 1, t * c.fps)), f0 = Math.floor(x), f1 = Math.min(c.n - 1, f0 + 1), a = x - f0;
    for (let i = 0; i < B; i++) {
      const p = (f0 * B + i) * 4, q = (f1 * B + i) * 4;
      let x0 = c.q[p], y0 = c.q[p + 1], z0 = c.q[p + 2], w0 = c.q[p + 3], x1 = c.q[q], y1 = c.q[q + 1], z1 = c.q[q + 2], w1 = c.q[q + 3];
      if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) { x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1; }
      const X = x0 + (x1 - x0) * a, Y = y0 + (y1 - y0) * a, Z = z0 + (z1 - z0) * a, W = w0 + (w1 - w0) * a, L = Math.hypot(X, Y, Z, W) || 1;
      out[i * 4] = X / L; out[i * 4 + 1] = Y / L; out[i * 4 + 2] = Z / L; out[i * 4 + 3] = W / L;
    }
    for (let k = 0; k < 3; k++) out[B * 4 + k] = (c.h[f0 * 3 + k] + (c.h[f1 * 3 + k] - c.h[f0 * 3 + k]) * a) / 1000;
  };
  const mix = (a, b, w, out) => {
    for (let i = 0; i < B; i++) {
      const j = i * 4, sg = a[j] * b[j] + a[j + 1] * b[j + 1] + a[j + 2] * b[j + 2] + a[j + 3] * b[j + 3] < 0 ? -1 : 1;
      let L = 0; for (let k = 0; k < 4; k++) { out[j + k] = a[j + k] + (sg * b[j + k] - a[j + k]) * w; L += out[j + k] * out[j + k]; }
      L = Math.sqrt(L) || 1; for (let k = 0; k < 4; k++) out[j + k] /= L;
    }
    for (let k = 0; k < 3; k++) out[B * 4 + k] = a[B * 4 + k] + (b[B * 4 + k] - a[B * 4 + k]) * w;
  };
  // timelines on the page's 8 s cycle (tau); every one is continuous across the wrap from 8 back to 0
  const IDLE = (t) => (t * .9375) % 1.5;                 // 5 idle loops per cycle
  const SW = 2.55 - 1.33;                               // swing clip starts so its fastest hand frame lands on contact (tau 2.55)
  const TL = {
    pitcher(t) { if (t <= 5.2) sample('pitch', t, O); else { sample('pitch', 5.2, A); sample('pitch', 0, Bp); mix(A, Bp, smooth01((t - 5.4) / 2.2), O); } },   // release at 2.10 s in both
    batter(t) {
      if (t < SW - .25 || t >= 7.2) sample('idle', IDLE(t), O);
      else if (t < SW) { sample('idle', IDLE(t), A); sample('swing', 0, Bp); mix(A, Bp, smooth01((t - SW + .25) / .25), O); }
      else if (t < 4.6) sample('swing', Math.min(t - SW, 2.2), O);                                   // follow-through, briefly held; the run-out is cut
      else { sample('swing', 2.2, A); sample('idle', IDLE(t), Bp); mix(A, Bp, smooth01((t - 4.6) / 1.8), O); }
    },
    catcher(t) { sample('catcher', .45 * (1 - Math.cos(Math.PI * t / 2)), O); },
    ump(t) { sample('ump', .3 * (1 - Math.cos(Math.PI * t / 2)), O); },
    coach(t) { sample('fidle', t % ((C.fidle.n - 1) / C.fidle.fps), O); }   // the third-base coach stands in the fielders' ready loop
  };
  const apply = () => {
    for (let i = 0; i < B; i++) if (list[i]) list[i].quaternion.set(O[i * 4], O[i * 4 + 1], O[i * 4 + 2], O[i * 4 + 3]);
    bones.Hips.position.set(O[B * 4], O[B * 4 + 1], O[B * 4 + 2]);
  };
  // fielders: the page moves and turns them (root); the mocap only animates the body in place.
  // ready stance loops; the chaser blends into Running out to the ball, fields it (Goalkeeper Catch), and jogs back.
  if (role === 'fielder') {
    if (!(C.fidle && C.run)) return null;
    const dur = (id) => (C[id].n - 1) / C[id].fps;
    const ph = { fidle: Math.random() * dur('fidle'), run: 0, jog: 0 };
    let last = null, wRun = 0, wC = 0, prevRun = 0, catchT = null, px = 0, pz = 0;
    return (t) => {
      let dt = last === null ? 0 : t - last; if (dt < 0) dt += 8; dt = Math.min(dt, .25); last = t;
      const run = fig.run || 0, p = fig.root.position;
      const mps = dt > 0 ? Math.hypot(p.x - px, p.z - pz) / dt / (5.9 / 1.8) : 0; px = p.x; pz = p.z;   // ground speed, m/s (mannequin is ~1.8 m)
      if (prevRun > .5 && run < .5 && t < 6 && C.fcatch) catchT = 0;                            // reached the ball
      if (t >= 6 || run > .5) catchT = null;
      prevRun = run;
      const back = t >= 6 && !!C.jog, rid = back ? 'jog' : 'run';
      ph.fidle += dt;
      ph.run += dt * Math.min(1.6, Math.max(.9, mps / 3.7));                                      // cadence follows speed (capped)
      ph.jog += dt * Math.min(1.4, Math.max(.9, mps / 2.0));
      wRun += ((run > .5 ? 1 : 0) - wRun) * Math.min(1, dt * 8);
      if (catchT !== null) catchT += dt;
      const wT = catchT !== null ? 1 : 0; wC += (wT - wC) * Math.min(1, dt * (wT ? 10 : 5));
      sample('fidle', ph.fidle % dur('fidle'), A);
      if (wC > .002) { sample('fcatch', Math.min(catchT ?? dur('fcatch'), dur('fcatch')), Bp); mix(A, Bp, wC, A); }
      if (wRun > .002) { sample(rid, (back ? ph.jog : ph.run) % dur(rid), Bp); mix(A, Bp, wRun, O); } else O.set(A);
      apply();
    };
  }
  if (!TL[role] || (role === 'batter' && !(C.idle && C.swing)) || (role === 'pitcher' && !C.pitch) || (role !== 'batter' && role !== 'pitcher' && !C[role === 'coach' ? 'fidle' : role])) return null;
  const YAW = { batter: Math.PI / 2 };                  // mocap batter stands side-on; turn him so the front shoulder faces the mound
  let base = null, yaw0 = null;
  return (t) => {
    if (base === null && t < 1.8) base = fig.root.position.clone();     // page root offsets (pitcher's stride) are zero here; the mocap carries its own
    if (yaw0 === null) yaw0 = fig.root.rotation.y;
    if (base) fig.root.position.copy(base);
    fig.root.rotation.y = yaw0 + (YAW[role] || 0);
    TL[role](t);
    apply();
  };
}


function makeFigureGLB(THREE, o, BD) {
  const kit = o.kit, k = BD.k, u = BD.u, G = () => new THREE.Group();
  const n = o.number ?? 7, s = 1 + ((n * 37) % 9 - 4) * .01;   // +-4 % height, fixed per player
  const root = G(), body = BD.SU.clone(BD.scene); body.scale.setScalar(k * s); root.add(body);
  let mesh = null; body.traverse(n => { if (n.isSkinnedMesh && !mesh) mesh = n; });
  const bones = {}; mesh.skeleton.bones.forEach(b => { bones[b.name.replace(/^mixamorig:?/, '')] = b; });
  // the away side (SEOUL) wears the generated navy uniform as is; home, coach and umpire are recoloured
  const tone = new THREE.Color(o.skin ?? 0xC98C68), ref = new THREE.Color(0xC98C68);   // the page's skin palette, relative to its first tone
  const skin = new THREE.Vector3(...['r', 'g', 'b'].map(c => Math.min(1.15, Math.max(.45, 1 + (tone[c] / ref[c] - 1) * .6))));
  mesh.material = playerMaterial(THREE, BD.mesh.material, { ...kit, keep: kit.name === 'SEOUL' }, n, BD, skin);
  const far = o.role === 'fielder' || o.role === 'coach' || !o.role;   // small on screen: skip the costly skinned shadow pass
  mesh.castShadow = !far; mesh.receiveShadow = true; mesh.frustumCulled = false;   // skinned poses leave the bind bounds
  if (far) {
    const blob = new THREE.Mesh(BLOB.geo || (BLOB.geo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2)), BLOB.mat || (BLOB.mat = new THREE.MeshBasicMaterial({
      map: canvasTex(THREE, 64, 64, (g, W) => { const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); r.addColorStop(0, 'rgba(0,0,0,.42)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, W, W); }),
      transparent: true, depthWrite: false })));
    blob.position.y = .18; blob.scale.set(1.4, 1, 1.1); root.add(blob);
  }

  // invisible proxies with the mannequin's joint names and pivots (written by the page, unused by the mocap)
  const rig = G(); rig.visible = false; root.add(rig);
  const hips = G(); hips.position.y = 2.95; rig.add(hips);
  const torso = G(); hips.add(torso);
  const head = G(); head.position.y = 2.38; torso.add(head);
  const arm = (x) => { const sh = G(); sh.position.set(x, 1.5, 0); torso.add(sh); const el = G(); el.position.y = -.98; sh.add(el); return { sh, el }; };
  const leg = (x) => { const hip = G(); hip.position.set(x, -.1, 0); hips.add(hip); const knee = G(); knee.position.y = -1.42; hip.add(knee); return { hip, knee }; };
  const aR = arm(-.72), aL = arm(.72), lR = leg(-.3), lL = leg(.3);

  // Things fixed to a bone are placed in bind-pose world axes, then carried into the bone's own (rotated) frame.
  const inBone = (bone, obj, worldPos, worldQ = new THREE.Quaternion()) => {
    const rq = BD.restQ(bone).invert();
    obj.position.copy(worldPos).sub(BD.bind(bone)).applyQuaternion(rq); obj.quaternion.copy(rq).multiply(worldQ);
    bones[bone].add(obj); return obj;
  };
  // hands: nodes on the hand bones, oriented like the mannequin's hand, so bat / glove / tablet ride along
  const hand = (S) => {
    const Bn = (S === 'L' ? 'Left' : 'Right') + 'Hand', h = G(); h.scale.setScalar(1 / (k * s));
    const H = BD.hand[S], at = BD.bind(Bn).add(H.palm);
    if (S === 'R' && o.role === 'batter') {               // mocap grip: the handle runs through the fist along the knuckle line, knob on the pinky side
      inBone(Bn, h, BD.bind(Bn).add(H.palm.clone().multiplyScalar(2.6)), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), H.knuckle));
    } else inBone(Bn, h, at, H.drop.clone().invert());
    return h;
  };

  // hard gear (bind-pose metres x u)
  const M = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, ...x });
  const mats = { leather: M(0x7A4A23), dark: M(0x15151A, { roughness: .5 }), gear: M(0x1C1E24, { roughness: .32, metalness: .1 }) };
  const put = (bone, geo, mat, worldPos, worldQ) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return inBone(bone, m, worldPos, worldQ); };
  const sc = BD.skull, V = (x, y, z) => new THREE.Vector3(x, y, z);
  if (kit.mask) {                                          // catcher / umpire mask: bars curving round the face + two uprights
    const R = sc.face - sc.zc + .025 * u, ey = sc.eyeY;
    [[.03, .007], [-.012, .005], [-.05, .005], [-.088, .006]].forEach(([dy, r]) => {
      put('Head', new THREE.TorusGeometry(R, r * u, 5, 18, 1.8).rotateZ(Math.PI / 2 - .9).rotateX(Math.PI / 2), mats.dark, V(0, ey + dy * u, sc.zc));
    });
    for (const x of [-.022, .022]) put('Head', new THREE.BoxGeometry(.006 * u, .12 * u, .006 * u), mats.dark, V(x * u, ey - .028 * u, sc.zc + Math.sqrt(R * R - x * x * u * u)));
  }
  if (kit.protector) put('Spine1', new THREE.CapsuleGeometry(.12 * u, .2 * u, 6, 14).scale(1.25, 1, .32), mats.gear, V(0, BD.bind('Spine1').y + .04 * u, BD.chest.z + .015 * u));
  if (kit.guards) for (const S of ['Left', 'Right']) {
    const kn = BD.bind(S + 'Leg'), ft = BD.bind(S + 'Foot');
    put(S + 'Leg', new THREE.CapsuleGeometry(.056 * u, .3 * u, 4, 12).scale(1.1, 1, .8), mats.gear, kn.clone().lerp(ft, .45).add(V(0, 0, .07 * u)));
    put(S + 'Leg', new THREE.SphereGeometry(.075 * u, 14, 10).scale(1, .9, .7), mats.gear, kn.clone().add(V(0, .01 * u, .06 * u)));   // knee cap
  }

  const fig = { root, hips, torso, head, shR: aR.sh, elR: aR.el, handR: hand('R'), shL: aL.sh, elL: aL.el, handL: hand('L'), hipR: lR.hip, kneeR: lR.knee, hipL: lL.hip, kneeL: lL.knee, mats, phase: Math.random() * 6.28 };
  const play = clipPlayer(BD, bones, o.role || 'coach', fig);
  const neck = bones.Neck, headB = bones.Head, want = new THREE.Vector3(), seen = new THREE.Vector3(), hp = new THREE.Vector3(), hq = new THREE.Quaternion(), pq = new THREE.Quaternion(), dq = new THREE.Quaternion(), I = new THREE.Quaternion(), fw = new THREE.Vector3();
  let looked = false;
  const turnTo = (bone, w) => {                            // rotate a bone in world space by w of the rotation that aims the face at `seen`
    bone.updateWorldMatrix(true, false); bone.getWorldPosition(hp); bone.getWorldQuaternion(hq);
    fw.copy(BD.headFwd).applyQuaternion(hq); want.subVectors(seen, hp).normalize();
    const ang = fw.angleTo(want); if (ang < 1e-3) return;
    dq.setFromUnitVectors(fw, want); const lim = Math.min(1, 1.05 / ang) * (1 - smooth01((ang - 1.6) / .9));   // at most ~60 deg, none for targets behind
    dq.slerpQuaternions(I, dq, w * lim);
    bone.parent.getWorldQuaternion(pq); bone.quaternion.premultiply(pq).premultiply(dq).premultiply(pq.invert());
  };
  fig.sync = (tau) => {                                    // first call comes from the page's frame, after it has placed the figure
    if (!play || tau === undefined) return;
    play(tau);
    const at = fig.watch && fig.watch();
    if (!at) { looked = false; return; }
    if (!looked) seen.copy(at); else seen.lerp(at, .25); looked = true;
    turnTo(neck, .4); turnTo(headB, .7);
  };
  return fig;
}
const BLOB = {};
let capTurn = 0;   // capped players take the cap models in turn, in the order the page creates them
function makeFigure(THREE, o) {
  if (!BODY) return makeMannequin(THREE, o);
  return makeFigureGLB(THREE, o, o.role === 'batter' ? BODY.helmets[0] : o.role === 'catcher' ? BODY.helmets[1] : BODY.caps[capTurn++ % BODY.caps.length]);
}
