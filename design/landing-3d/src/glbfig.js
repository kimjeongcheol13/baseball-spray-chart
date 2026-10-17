// ---- realistic player ----
// Six Tripo-generated players (T-pose, auto-rigged with Tripo's Mixamo skeleton preset), packed by tools/pack_player.py:
// HELMETS (batter, catcher), CAPS (alternating over pitcher, coach and fielders) and UMPIRE (navy polo, chest protector,
// grey slacks; worn as generated, no recolour or lettering). The Mixamo motion is baked
// once, rig-independent, in `clips_shared.json` (harness/bake.html), and rigClips() turns it into local poses for each
// rig at load time. The page's animation code still writes the mannequin's joint names (shR, elR, hipL, ...): here they
// are invisible proxies, and fig.sync(tau) plays the motion on the real bones, then turns the head toward what the
// page has everyone watching.
// If the body or its motion fails to load, makeFigure() falls back to the procedural mannequin.
let BODY = null, bodyP = null;
const HELMETS = ['player', 'player_helmet2'], CAPS = ['player_cap', 'player_cap2', 'player_cap3'], UMPIRE = 'player_ump';
// Tripo-generated gear (tools/pack_player.py ... .5), top at +y. Which side is which was checked by rendering each from +z / -z
// (Tripo does not keep one convention). `rot` turns it into the frame it is fitted in, `mirror` flips x, `size` is its real height (m).
//   glove / mitt: fitted in the left hand's glove frame (X thumb, Y fingers, pocket on the palm side = -Z for the left hand)
//     glove: pocket on -z but thumb on -x, i.e. a right-hand glove: mirrored in x
//     mitt:  pocket on +z, thumb on -x (a left-hand mitt): a half turn about y
//   mask: fitted on the face (bind pose: the face looks along +z); the cage is on +z, so it is not turned
const PROPS = { glove: { size: .33, rot: [0, 0, 0], mirror: true }, mitt: { size: .34, rot: [0, Math.PI, 0] }, mask: { size: .30, rot: [0, 0, 0] } };
// a prop clone, turned (and mirrored) and scaled to `size` metres x u, its box's bottom centre on the origin
function fitProp(THREE, P, u) {
  const m = P.mirror ? -1 : 1, inner = P.scene.clone(true); inner.rotation.set(...P.rot); inner.scale.set(m, 1, 1);
  const holder = new THREE.Group(); holder.add(inner); holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner), k = P.size * u / (box.max.y - box.min.y);
  inner.scale.set(m * k, k, k); inner.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
  holder.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { holder, depth: (box.max.z - box.min.z) * k };
}
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
    const prop = async (name) => {                         // optional: without it the procedural gear is used
      try { return (await new GLTFLoader().parseAsync(await resBlob(name + '.glb').then(b => b.arrayBuffer()), '')).scene; } catch (e) { return null; }
    };
    const [all, props] = await Promise.all([Promise.all([...HELMETS, ...CAPS, UMPIRE].map(one)), Promise.all(Object.keys(PROPS).map(prop))]);
    Object.keys(PROPS).forEach((k, i) => { PROPS[k].scene = props[i]; });
    return { helmets: all.slice(0, HELMETS.length), caps: all.slice(HELMETS.length, -1), ump: all[all.length - 1] };
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
  const gloveFrame = (S) => {
    const h = bind(S + 'Hand'), Y = bind(S + 'HandMiddle1').sub(h).normalize(), X = bind(S + 'HandIndex1').sub(bind(S + 'HandPinky1'));
    X.addScaledVector(Y, -X.dot(Y)).normalize(); const Z = new THREE.Vector3().crossVectors(X, Y);
    const mid = bind(S + 'HandIndex1').add(bind(S + 'HandPinky1')).multiplyScalar(.5).sub(h);
    return { q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)), at: h.addScaledVector(X, mid.dot(X)), p: Math.sign(bind(S + 'HandThumb3').sub(bind(S + 'Hand')).dot(Z)) || 1 };
  };
  const side = (S) => ({
    glove: gloveFrame(S),
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

// Fielder's glove or catcher's mitt, in metres, in the glove's own frame: X toward the thumb, Y along the fingers (0 at the
// wrist bone), the pocket on the palm side (z sign p, which depends on the hand). Built to swallow the player's real hand:
// stalls run past the fingertips and the shell is thicker than the hand. Parts are merged into one leather and one lace
// mesh per kind (2 draw calls per glove).
const GEAR = {};
function makeGlove(THREE, mitt, p) {
  const L = GEAR.leather || (GEAR.leather = new THREE.MeshStandardMaterial({ color: 0x8A5428, roughness: .6 }));
  const D = GEAR.lace || (GEAR.lace = new THREE.MeshStandardMaterial({ color: 0x3E2414, roughness: .72 }));
  const key = (mitt ? 'mitt' : 'glove') + p;
  if (!GEAR[key]) {
    const parts = { L: [], D: [] }, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const add = (geo, k, x, y, z, rz = 0, sx = 1, sy = 1, sz = 1) =>
      parts[k].push(geo.toNonIndexed().applyMatrix4(m4.compose(new THREE.Vector3(x, y, z * p), q.setFromEuler(e.set(0, 0, rz)), new THREE.Vector3(sx, sy, sz))));
    const ball = () => new THREE.SphereGeometry(1, 18, 12);
    add(new THREE.CylinderGeometry(.045, .047, .035, 16), 'D', 0, -.005, 0, 0, 1.25, 1, .78);            // wrist band round the opening
    if (mitt) {
      add(ball(), 'L', 0, .12, 0, 0, .13, .14, .065);                                                     // thick padded round body
      add(new THREE.TorusGeometry(.122, .032, 8, 32), 'D', 0, .12, .01, 0, 1, 1.08, 1);                  // laced rim
      add(ball(), 'D', 0, .125, .05, 0, .085, .09, .022);                                                 // darker pocket
      add(new THREE.CapsuleGeometry(.03, .06, 4, 10), 'L', .11, .065, .01, -.6);                          // thumb pad
    } else {
      add(ball(), 'L', 0, .095, 0, 0, .078, .11, .038);                                                   // back and heel of the hand
      add(ball(), 'L', .045, .06, .012, 0, .042, .055, .032);                                             // heel pad over the thumb's root
      add(ball(), 'L', 0, .11, .022, 0, .062, .075, .02);                                                 // pocket
      [[.04, .095, -.06], [.013, .105, -.02], [-.014, .095, .02], [-.04, .08, .07]].forEach(([x, len, rz]) =>   // finger stalls, fanned
        add(new THREE.CapsuleGeometry(.021, len, 4, 10), 'L', x, .17 + len / 2, 0, rz));
      add(new THREE.CapsuleGeometry(.027, .075, 4, 10), 'L', .072, .11, .014, -.45);                     // thumb stall
      add(new THREE.BoxGeometry(.045, .075, .008), 'D', .058, .2, .012, -.3);                             // laced web between thumb and index
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
    GEAR[key] = { L: merge(parts.L), D: merge(parts.D) };
  }
  const g = new THREE.Group();
  for (const [k, mat] of [['L', L], ['D', D]]) { const m = new THREE.Mesh(GEAR[key][k], mat); m.castShadow = true; g.add(m); }
  return g;
}

// A wood bat at real size (84 cm, 6.6 cm barrel, 2.7 cm handle) in scene units, for the mannequin's hand frame:
// the knob sits 12 cm past the top hand on +y, the barrel runs down -y. Turned from a profile; grip tape on the handle.
function makeBat(THREE) {
  if (!GEAR.bat) {
    const M = 5.9 / 1.75, top = .119;                         // scene units per metre; knob end above the hand (m)
    const prof = [[0, .84], [.024, .835], [.031, .825], [.0335, .80], [.033, .62], [.028, .54], [.019, .45], [.0145, .38], [.0135, .30],
      [.0135, .03], [.0145, .018], [.03, .012], [.03, .004], [.02, 0], [0, 0]];   // [radius, distance from the knob end] in m
    const pts = prof.map(([r, d]) => new THREE.Vector2(r * M, (top - d) * M));   // barrel end first, so the faces point outward
    GEAR.bat = {
      wood: new THREE.LatheGeometry(pts, 24), tape: new THREE.CylinderGeometry(.0152 * M, .015 * M, .23 * M, 16).translate(0, (top - .025 - .115) * M, 0),
      woodM: new THREE.MeshStandardMaterial({ color: 0xC9A06A, roughness: .42 }), tapeM: new THREE.MeshStandardMaterial({ color: 0x17171C, roughness: .9 })
    };
  }
  const B = GEAR.bat, g = new THREE.Group();
  for (const [geo, mat] of [[B.wood, B.woodM], [B.tape, B.tapeM]]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); }
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
    // set (hands together at the chest) -> leg lift, stride, release at 2.10 s in both -> follow-through ->
    // fielding stance where he landed, watching the play -> the clip's own walk back to the rubber -> come set again
    pitcher(t) {
      const SET = .45, END = 2.9, BACK = 3.2, HOLD = 5.8, COME = 7.4;
      const ready = (tt, out) => {                         // ready crouch, moved to where the follow-through left him
        sample('pitch', END, Bp); const ox = Bp[B * 4], oz = Bp[B * 4 + 2];
        sample('fidle', tt % ((C.fidle.n - 1) / C.fidle.fps), out);
        out[B * 4] += ox - C.fidle.h[0] / 1000; out[B * 4 + 2] += oz - C.fidle.h[2] / 1000;   // hips (h is in mm)
      };
      fig.readyW = t < END ? 0 : t < HOLD ? smooth01((t - END - .2) / .6) : t < COME ? 1 - smooth01((t - HOLD) / .4) : 0;
      if (t < SET) sample('pitch', SET, O);
      else if (t < END) sample('pitch', t, O);
      else if (t < HOLD) { ready(t - END, O); sample('pitch', END, A); mix(A, O, smooth01((t - END) / .6), O); }
      else if (t < COME) { ready(t - END, A); sample('pitch', BACK + (t - HOLD) / (COME - HOLD) * (5.2 - BACK), Bp); mix(A, Bp, smooth01((t - HOLD) / .5), O); }
      else { sample('pitch', 5.2, A); sample('pitch', SET, Bp); mix(A, Bp, smooth01((t - COME) / .6), O); }
    },
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
      fig.readyW = (1 - wRun) * (1 - wC);
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
  // the away side (SEOUL) and the umpire model wear their generated clothes as is; home and coach are recoloured
  const tone = new THREE.Color(o.skin ?? 0xC98C68), ref = new THREE.Color(0xC98C68);   // the page's skin palette, relative to its first tone
  const skin = new THREE.Vector3(...['r', 'g', 'b'].map(c => Math.min(1.15, Math.max(.45, 1 + (tone[c] / ref[c] - 1) * .6))));
  mesh.material = playerMaterial(THREE, BD.mesh.material, { ...kit, keep: kit.keep || kit.name === 'SEOUL' }, n, BD, skin);
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
  if (kit.mask && PROPS.mask.scene) {                       // catcher / umpire mask: top on the forehead (12 cm above the eyes), cage 4.5 cm in front of the nose
    const { holder, depth } = fitProp(THREE, PROPS.mask, u), g = new THREE.Group(); g.add(holder);
    inBone('Head', g, V(0, sc.eyeY + .12 * u - PROPS.mask.size * u, sc.face + .045 * u - depth / 2));
  } else if (kit.mask) {                                   // fallback: bars curving round the face + two uprights
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
  fig.addGlove = (mitt) => {                               // on the left hand, around the real hand
    const G = BD.hand.L.glove, P = PROPS[mitt ? 'mitt' : 'glove'];
    if (P.scene) {
      // the real hand is shrunk (and its fingers more) so none of it shows through the glove; the glove undoes the hand's scale
      const HS = .6; bones.LeftHand.scale.setScalar(HS);
      for (const f of ['Index1', 'Middle1', 'Ring1', 'Pinky1', 'Thumb2']) bones['LeftHand' + f]?.scale.setScalar(.35);
      const { holder } = fitProp(THREE, P, u); holder.position.set(0, -.03 * u, G.p * (mitt ? .02 : .05) * u);   // hand toward the back of the glove
      const g = new THREE.Group(); g.add(holder); inBone('LeftHand', g, G.at, G.q); g.scale.setScalar(1 / HS);
      return;
    }
    const g = makeGlove(THREE, mitt, G.p); g.scale.setScalar(u); inBone('LeftHand', g, G.at, G.q);
  };
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
  // Ready stance (fielders; the pitcher after his follow-through). The clip's crouch is shallow (hips 0.84 m, hands by the
  // hips, arms only ~0.44 m long), so the hips sink 13 cm with the feet kept planted (leg IK), the back leans 20 deg more and
  // both hands go out in front of the knees (arm IK). Every glove then turns so its pocket opens toward what the player is
  // watching, its fingers following the forearm (down for a fielder, up for the catcher).
  const B = bones, MS = 5.9 / 1.75 * s, UP = new THREE.Vector3(0, 1, 0);
  const LgInv = BD.restQ('LeftHand').invert().multiply(BD.hand.L.glove.q.clone()).invert();   // hand bone frame from the glove frame
  const sp = new THREE.Vector3(), ep = new THREE.Vector3(), wp = new THREE.Vector3(), tp = new THREE.Vector3(), e2 = new THREE.Vector3(), tg = new THREE.Vector3();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), qd = new THREE.Quaternion(), mb = new THREE.Matrix4();
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
  const feet = ['Left', 'Right'].map(S => ({ up: B[S + 'UpLeg'], mid: B[S + 'Leg'], end: B[S + 'Foot'], p: new THREE.Vector3(), q: new THREE.Quaternion() }));
  const rotWorld = (bone, q) => { bone.parent.getWorldQuaternion(pq); bone.getWorldQuaternion(hq); bone.quaternion.copy(pq.invert().multiply(q.multiply(hq))); bone.updateWorldMatrix(false, true); };
  const setWorldQ = (bone, q) => { bone.parent.getWorldQuaternion(pq); bone.quaternion.copy(pq.invert().multiply(q)); bone.updateWorldMatrix(false, true); };
  const reach = (up, mid, end, target, w) => {             // two-bone IK toward `target` (by w), the middle joint kept on its side
    up.updateWorldMatrix(true, true); up.getWorldPosition(sp); mid.getWorldPosition(ep); end.getWorldPosition(wp);
    const a = sp.distanceTo(ep), b = ep.distanceTo(wp); tp.copy(wp).lerp(target, w);
    const d = Math.max(1e-4, Math.min(sp.distanceTo(tp), (a + b) * .999)), dir = v1.subVectors(tp, sp).normalize();
    const along = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
    const pole = v2.subVectors(ep, sp); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    e2.copy(sp).addScaledVector(dir, along).addScaledVector(pole, h);
    rotWorld(up, q1.setFromUnitVectors(v2.subVectors(ep, sp).normalize(), e2.sub(sp).normalize()));
    mid.getWorldPosition(ep); end.getWorldPosition(wp);
    rotWorld(mid, q1.setFromUnitVectors(v2.subVectors(wp, ep).normalize(), tp.copy(sp).addScaledVector(dir, d).sub(ep).normalize()));
  };
  const hw = new THREE.Vector3(), rq = new THREE.Quaternion();
  const ahead = (x, y, z) => tg.set(x * MS, y * MS, z * MS).applyQuaternion(rq).add(hw);   // metres from the ground under the hips, root axes
  const ready = (w) => {
    feet.forEach(f => { f.end.getWorldPosition(f.p); f.end.getWorldQuaternion(f.q); });
    root.getWorldQuaternion(rq); B.Hips.getWorldPosition(hw); hw.y = root.getWorldPosition(v1).y;   // the pitcher's stance is a stride off his root
    B.Hips.getWorldPosition(v1); v1.y -= .13 * MS * w; B.Hips.parent.worldToLocal(v1); B.Hips.position.copy(v1); B.Hips.updateWorldMatrix(false, true);
    rotWorld(B.Spine, q1.setFromAxisAngle(v2.set(1, 0, 0).applyQuaternion(rq), .35 * w));   // lean forward
    feet.forEach(f => { reach(f.up, f.mid, f.end, f.p, 1); setWorldQ(f.end, f.q); });
    reach(B.LeftArm, B.LeftForeArm, B.LeftHand, ahead(.14, .58, .45), w);      // glove hand: in front of the knees, left of centre
    reach(B.RightArm, B.RightForeArm, B.RightHand, ahead(-.1, .6, .45), w);    // bare hand beside it
  };
  const aim = (point, w, tilt) => {                       // pocket toward `point` (tilted up by `tilt`), fingers along the forearm
    const hand = B.LeftHand; hand.updateWorldMatrix(true, false); hand.getWorldPosition(wp); B.LeftForeArm.getWorldPosition(ep);
    Z.subVectors(point, wp); Z.y = Math.max(Z.y, 0) * .3 + tilt * Z.length(); Z.normalize();
    Y.subVectors(wp, ep).normalize(); Y.addScaledVector(Z, -Y.dot(Z));
    if (Y.lengthSq() < .04) Y.copy(UP).addScaledVector(Z, -UP.dot(Z));    // forearm pointing at the target: fingers up
    Y.normalize(); Z.multiplyScalar(BD.hand.L.glove.p); X.crossVectors(Y, Z);    // glove frame: X thumb, Y fingers, pocket = p * Z
    qd.setFromRotationMatrix(mb.makeBasis(X, Y, Z)).multiply(LgInv);           // the hand's world turn that gives that glove frame
    hand.getWorldQuaternion(hq); hq.slerp(qd, w); hand.parent.getWorldQuaternion(pq);
    hand.quaternion.copy(pq.invert().multiply(hq));
  };
  const gloved = o.role === 'fielder' || o.role === 'pitcher' || o.role === 'catcher';
  fig.sync = (tau) => {                                    // first call comes from the page's frame, after it has placed the figure
    if (!play || tau === undefined) return;
    play(tau);
    const at = fig.watch && fig.watch();
    if (gloved) {
      const rw = o.role === 'catcher' ? 0 : fig.readyW || 0, aw = o.role === 'catcher' ? 1 : rw;
      if (rw > .01) ready(rw);
      if (aw > .01 && at) aim(at, aw, o.role === 'catcher' ? .15 : .4);
    }
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
  if (o.role === 'ump') return makeFigureGLB(THREE, { ...o, kit: { ...o.kit, keep: true } }, BODY.ump);   // its own protector, under the mask
  return makeFigureGLB(THREE, o, o.role === 'batter' ? BODY.helmets[0] : o.role === 'catcher' ? BODY.helmets[1] : BODY.caps[capTurn++ % BODY.caps.length]);
}
