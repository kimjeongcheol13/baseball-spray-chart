(() => {
  const THREE_URL = 'https://unpkg.com/three@0.184.0/build/three.module.js';
  let threeModURL = THREE_URL;
  let threeP;
  const three = () => threeP || (threeP = (async () => {
    const R = window.__resources;
    if (R && R['three.module'] && R['three.core']) {
      const txt = await (await fetch(R['three.module'])).text();
      const mod = txt.split('./three.core.js').join(R['three.core']);
      return import(threeModURL = URL.createObjectURL(new Blob([mod], { type: 'text/javascript' })));
    }
    return import(THREE_URL);
  })());
  const U2FT = 330 / 540, D2R = Math.PI / 180;
  const INK = '#0B0B0E', RED = 0xE0343F, CHALK = 0xF4F1EA;   // INK: the element's own DOM labels (the page recolours them); CHALK: everything drawn on the turf
  const track = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; let u = (t - t0) / (t1 - t0); u = u * u * (3 - 2 * u); return v0 + (v1 - v0) * u; }
    }
    return keys[keys.length - 1][1];
  };
  const lerp = (a, b, u) => a + (b - a) * u;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  const FONT = "'Pretendard Variable', Pretendard, Archivo, sans-serif";

  const BOX = [-3.1, .4], DECK = [[-31, 19], [31, 19]], BAG = [62.9, -62.9];   // the batter's spot in the box; on-deck circles (third-base side first: the batting team's); where the runner stops
  const RUN0 = 3.05, RUN1 = 3.45, ARR = 7.2, JOG0 = 4.3, JOG1 = 7.4;           // tau: the hitter breaks for first (swing -> run blend) and gets there; the next batter's jog to the box
  const runS = (t, L, t0, t1, ta, td) => {                                       // distance covered from t0 to t1: speed up for ta s, hold, slow down for td s
    const T = t1 - t0, V = L / (T - ta / 2 - td / 2), u = t - t0;
    return u <= 0 ? 0 : u >= T ? L : u < ta ? V * u * u / (2 * ta) : u < T - td ? V * (u - ta / 2) : L - V * (T - u) * (T - u) / (2 * td);
  };
  const lerpA = (a, b, u) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * u;
  const SKIN = [0xC98C68, 0xB97A55, 0x8D5A3B, 0xE2B592, 0x6B4330, 0xD9A37F, 0xA36A48];
  const HAIR = [0x1A1512, 0x2B1D14, 0x120E0C, 0x3A2A1C, 0x221A16];
  const HOME = { name: 'SPRAYLAB', jersey: 0xF1EDE4, pants: 0xF1EDE4, pinstripe: 0xC9C2B4, accent: 0xC8303A, cap: 0xC8303A, socks: 0xC8303A, belt: 0xC8303A, cleats: 0x15151A, trim: 0xC8303A };
  const AWAY = { name: 'SEOUL', jersey: 0xA8A9AF, pants: 0xA8A9AF, pinstripe: null, accent: 0x1F2740, cap: 0x1F2740, socks: 0x1F2740, belt: 0x1F2740, cleats: 0x15151A, trim: 0x1F2740, gear: 0x1F2740 };
  const UMP = { name: '', jersey: 0x24272F, pants: 0x6E6F75, pinstripe: null, accent: 0x24272F, cap: 0x15151A, socks: 0x15151A, belt: 0x15151A, cleats: 0x15151A, trim: 0x15151A, gear: 0x15151A };

  function genDots(pullLeft, count) {
    let s = 20260414;
    const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    const seed = [[-28, 300, 'hit', .14], [12, 150, 'out', .05], [-20, 470, 'xbh', .34], [30, 330, 'out', .3]];
    const out = [];
    for (let i = 0; i < 120; i++) {
      let a, d, t, lift;
      if (i < 4) { [a, d, t, lift] = seed[i]; }
      else {
        const u = rnd();
        a = u < .58 ? -44 + rnd() * 40 : u < .83 ? -16 + rnd() * 32 : 4 + rnd() * 40;
        const v = rnd();
        t = v < .26 ? 'hit' : v < .36 ? 'xbh' : 'out';
        d = t === 'hit' ? 170 + rnd() * 210 : t === 'xbh' ? 370 + rnd() * 155 : (rnd() < .5 ? 70 + rnd() * 150 : 260 + rnd() * 260);
        lift = t === 'hit' ? .07 + rnd() * .13 : t === 'xbh' ? .26 + rnd() * .16 : .05;
      }
      d = Math.min(d, 525) * U2FT;
      const rad = (pullLeft ? a : -a) * D2R;
      out.push({ a, d, t, lift, i, x: d * Math.sin(rad), z: -d * Math.cos(rad), on: i < count });
    }
    return out;
  }

  function canvasTex(THREE, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function jerseyTex(THREE, kit, number) {
    return canvasTex(THREE, 512, 512, (g, W, H) => {
      g.fillStyle = hex(kit.jersey); g.fillRect(0, 0, W, H);
      // fabric weave
      g.fillStyle = 'rgba(0,0,0,.035)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
      if (kit.pinstripe) { g.strokeStyle = hex(kit.pinstripe); g.lineWidth = 1.5; for (let x = 10; x < W; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } }
      // shoulder/neck shading
      const sh = g.createLinearGradient(0, 0, 0, H * .22); sh.addColorStop(0, 'rgba(0,0,0,.22)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(0, 0, W, H * .22);
      if (kit.name) {
        // placket + buttons (front centre, u = .5)
        g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2, H * .1); g.lineTo(W / 2, H); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
        for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(W / 2, H * (.2 + i * .14), 4.5, 0, 7); g.fill(); g.stroke(); }
        // chest wordmark
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `800 ${kit.name.length > 6 ? 38 : 46}px ${FONT}`;
        g.lineWidth = 7; g.strokeStyle = hex(kit.jersey); g.strokeText(kit.name, W / 2, H * .37);
        g.fillStyle = hex(kit.accent); g.fillText(kit.name, W / 2, H * .37);
        // back number at the seam (u = 0 / 1), drawn on both edges so it wraps
        g.font = `800 160px ${FONT}`;
        [0, W].forEach(x => { g.lineWidth = 10; g.strokeStyle = hex(kit.jersey); g.strokeText(String(number), x, H * .42); g.fillStyle = hex(kit.accent); g.fillText(String(number), x, H * .42); });
      }
    });
  }
  function capTex(THREE, kit) {
    return canvasTex(THREE, 256, 128, (g, W, H) => {
      g.fillStyle = hex(kit.cap); g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const x = (i / 6) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      if (kit.name) { g.fillStyle = hex(kit.jersey); g.font = `800 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kit.name[0], W * .25, H * .36); }
    });
  }

  function makeMannequin(THREE, o) {
    const kit = o.kit, skin = o.skin, hair = o.hair;
    const G = () => new THREE.Group();
    const M = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .88, ...x });
    const mats = {
      jersey: new THREE.MeshStandardMaterial({ map: jerseyTex(THREE, kit, o.number ?? 7), roughness: .92 }),
      sleeve: M(kit.jersey, { roughness: .92 }), pants: M(kit.pants, { roughness: .92 }),
      skin: M(skin, { roughness: .58 }), hair: M(hair, { roughness: .7 }),
      cap: new THREE.MeshStandardMaterial({ map: capTex(THREE, kit), roughness: .55 }), capPlain: M(kit.cap, { roughness: .55 }),
      socks: M(kit.socks), cleats: M(kit.cleats, { roughness: .4, metalness: .05 }), belt: M(kit.belt, { roughness: .45 }),
      gear: M(kit.gear ?? kit.cap, { roughness: .5 }), leather: M(0x7A4A23, { roughness: .65 }), dark: M(0x15151A, { roughness: .5 }),
      eye: M(0xF2F2F2, { roughness: .2 }), pupil: M(0x15110E, { roughness: .2 }), mouth: M(0x7A3B38, { roughness: .8 })
    };
    const put = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    const cyl = (rt, rb, h, s = 18) => new THREE.CylinderGeometry(rt, rb, h, s);
    const sph = (r, a = 20, b = 14) => new THREE.SphereGeometry(r, a, b);
    const root = G(); const hips = G(); hips.position.y = 2.95; root.add(hips);
    // pelvis
    const pelvis = put(sph(.52, 20, 14), mats.pants, hips, 0, -.05, 0); pelvis.scale.set(1, .62, .78);
    const belt = put(new THREE.TorusGeometry(.5, .05, 8, 32), mats.belt, hips, 0, .22, 0); belt.rotation.x = Math.PI / 2; belt.scale.z = .78;
    // torso: lathe profile (radius, height above hips), seam at the back so the chest sits at u = .5
    const torso = G(); hips.add(torso);
    const prof = [[.5, .18], [.47, .45], [.5, .75], [.58, 1.05], [.62, 1.35], [.6, 1.55], [.42, 1.72], [.2, 1.78]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = put(new THREE.LatheGeometry(prof, 32, Math.PI, Math.PI * 2), mats.jersey, torso); body.scale.z = .74;
    // deltoids + neck
    put(sph(.27, 16, 12), mats.sleeve, torso, -.68, 1.52, 0); put(sph(.27, 16, 12), mats.sleeve, torso, .68, 1.52, 0);
    put(cyl(.15, .17, .32), mats.skin, torso, 0, 1.9, .02);
    // head
    const head = G(); head.position.y = 2.38; torso.add(head);
    const skull = put(sph(.37, 24, 18), mats.skin, head); skull.scale.set(.95, 1.1, 1);
    put(sph(.07, 10, 8), mats.skin, head, -.36, -.02, .02); put(sph(.07, 10, 8), mats.skin, head, .36, -.02, .02);
    [-1, 1].forEach(s => {
      put(sph(.055, 10, 8), mats.eye, head, s * .13, .03, .32).scale.set(1, .8, .6);
      put(sph(.03, 8, 6), mats.pupil, head, s * .13, .03, .355);
      const brow = put(new THREE.BoxGeometry(.13, .025, .04), mats.hair, head, s * .13, .13, .34); brow.rotation.z = s * -.15;
    });
    const nose = put(new THREE.ConeGeometry(.05, .14, 8), mats.skin, head, 0, -.04, .38); nose.rotation.x = Math.PI / 2 + .3;
    put(new THREE.BoxGeometry(.14, .02, .03), mats.mouth, head, 0, -.17, .34);
    // hair (back + sides)
    const hairCap = put(new THREE.SphereGeometry(.385, 24, 14, 0, Math.PI * 2, 0, Math.PI * .62), mats.hair, head, 0, .03, -.03); hairCap.scale.set(.98, 1.1, 1.02);
    if (kit.helmet) {
      put(new THREE.SphereGeometry(.47, 24, 14, 0, Math.PI * 2, 0, Math.PI * .58), mats.capPlain, head, 0, .04, 0);
      const brim = put(new THREE.CircleGeometry(.58, 24, 0, Math.PI), M(kit.cap, { roughness: .5, side: THREE.DoubleSide }), head, 0, .02, .1); brim.rotation.x = Math.PI / 2;
      put(new THREE.BoxGeometry(.12, .34, .36), mats.capPlain, head, (o.flap ?? 1) * .44, -.1, .04);
    } else if (kit.mask) {
      put(new THREE.SphereGeometry(.5, 24, 14), mats.gear, head, 0, .02, 0);
      put(new THREE.TorusGeometry(.3, .025, 6, 20), mats.dark, head, 0, -.04, .46);
      put(new THREE.TorusGeometry(.17, .02, 6, 14), mats.dark, head, 0, -.04, .49);
      put(new THREE.BoxGeometry(.02, .5, .02), mats.dark, head, 0, -.04, .48);
    } else {
      put(new THREE.SphereGeometry(.43, 24, 12, 0, Math.PI * 2, 0, Math.PI * .52), mats.cap, head, 0, .07, 0);
      const brim = put(new THREE.CircleGeometry(.56, 24, 0, Math.PI), M(kit.cap, { roughness: .5, side: THREE.DoubleSide }), head, 0, .05, .12); brim.rotation.x = Math.PI / 2;
    }
    const arm = (x) => {
      const sh = G(); sh.position.set(x, 1.5, 0); torso.add(sh);
      put(cyl(.2, .18, .5), mats.sleeve, sh, 0, -.28, 0);
      put(cyl(.15, .13, .55), mats.skin, sh, 0, -.72, 0);
      const el = G(); el.position.y = -.98; sh.add(el);
      put(sph(.14, 12, 10), mats.skin, el);
      put(cyl(.13, .1, .9), mats.skin, el, 0, -.45, 0);
      const hand = G(); hand.position.y = -.95; el.add(hand);
      put(sph(.15, 12, 10), mats.skin, hand, 0, -.08, 0).scale.set(.75, 1.1, .45);
      return { sh, el, hand };
    };
    const leg = (x) => {
      const hip = G(); hip.position.set(x, -.1, 0); hips.add(hip);
      put(cyl(.28, .21, 1.35), mats.pants, hip, 0, -.68, 0);
      const knee = G(); knee.position.y = -1.42; hip.add(knee);
      put(sph(.21, 12, 10), mats.pants, knee);
      put(cyl(.2, .14, 1.15), mats.pants, knee, 0, -.55, 0);
      put(cyl(.14, .13, .3), mats.socks, knee, 0, -1.23, 0);
      const shoe = put(new THREE.BoxGeometry(.3, .2, .86), mats.cleats, knee, 0, -1.44, .18); shoe.geometry.translate(0, 0, 0);
      put(new THREE.BoxGeometry(.32, .06, .9), mats.dark, knee, 0, -1.52, .18);
      if (kit.guards) put(new THREE.BoxGeometry(.4, 1.35, .26), mats.gear, knee, 0, -.75, .24);
      return { hip, knee };
    };
    if (kit.protector) { const p = put(new THREE.BoxGeometry(1.15, 1.25, .3), mats.gear, torso, 0, .95, .42); p.geometry = new THREE.CapsuleGeometry(.55, .55, 6, 12); p.scale.set(1, 1, .5); }
    const R = arm(-.72), L = arm(.72), lR = leg(-.3), lL = leg(.3);
    return { root, hips, torso, head, shR: R.sh, elR: R.el, handR: R.hand, shL: L.sh, elL: L.el, handL: L.hand, hipR: lR.hip, kneeR: lR.knee, hipL: lL.hip, kneeL: lL.knee, mats, phase: Math.random() * 6.28 };
  }

  // ---- the ballpark round the field (ft, like the field): a bowl of stands following the slab's outline -- padded front wall,
  //      ROWS stepped rows and a back parapet; in the outfield the rows start behind and above the fence -- with a seated crowd
  //      (two instanced meshes, seeded so the stills match the live frame), and a dugout under the stands on each side between
  //      home and the base. Returns each dugout's frame (local x along the line, +z away from the field, y 0 at field level).
  function ballpark(THREE, scene, { R, FOUL, BACK, pt, tFence }) {
    const ROWS = 14, D = 3, RISE = 1.35, STEP = 5, DG = [15, 60], c = new THREE.Vector2(0, -110);   // c: inside the field, for "outward"
    const v2 = (x, z) => new THREE.Vector2(x, z), out = (n, p) => (n.dot(p.clone().sub(c)) < 0 ? n.negate() : n);
    const sides = {};
    [1, -1].forEach(sg => {
      const A = v2(...pt(0, BACK, sg)), P = v2(...pt(tFence, FOUL, sg)), L = A.distanceTo(P), e = P.clone().sub(A).divideScalar(L), list = [];
      for (let s = 0; s < L - 1; s += STEP) list.push({ x: A.x + e.x * s, z: A.y + e.y * s, sg, s });
      sides[sg] = { A, P, L, e, n: out(v2(-e.y, e.x), A), list };
    });
    // the outline in order round the field: fence (left pole -> right pole), first-base line in, the arc behind home, third-base line out
    const pts = [], push = (q) => { const l = pts[pts.length - 1]; if (!l || Math.hypot(l.x - q.x, l.z - q.z) > .01) pts.push(q); };
    const arc = (r, a0, a1, of) => { const n = Math.ceil(Math.abs(a1 - a0) * r / 6); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; push({ x: r * Math.cos(a), z: r * Math.sin(a), of }); } };
    arc(R, Math.atan2(sides[-1].P.y, sides[-1].P.x), Math.atan2(sides[1].P.y, sides[1].P.x), 1);
    sides[1].list.slice().reverse().forEach(push);
    arc(BACK, Math.PI / 4, Math.PI * 3 / 4, 0);
    sides[-1].list.forEach(push);
    const N = pts.length, segN = pts.map((p, j) => { const q = pts[(j + 1) % N]; return out(v2(q.z - p.z, p.x - q.x).normalize(), v2(p.x, p.z)); });
    const miter = pts.map((p, i) => { const a = segN[(i + N - 1) % N], b = segN[i], m = a.clone().add(b).normalize(); return m.multiplyScalar(1 / Math.max(.3, m.dot(b))); });
    const dug = (j) => { const p = pts[j], q = pts[(j + 1) % N]; return p.sg && p.sg === q.sg && Math.min(p.s, q.s) >= DG[0] - .01 && Math.max(p.s, q.s) <= DG[1] + .01; };
    const prof = (p) => {                                  // [offset from the field's edge, height, part] per profile point
      const f0 = p.of ? 1.5 : 0, h0 = p.of ? 9.6 : 7, top = h0 + (ROWS - 1) * RISE + 3.5, P = [[f0, -2.2, 0], [f0, h0, 1]];
      for (let r = 0; r < ROWS; r++) { P.push([f0 + (r + 1) * D, h0 + r * RISE, 2]); if (r < ROWS - 1) P.push([f0 + (r + 1) * D, h0 + (r + 1) * RISE, 1]); }
      P.push([f0 + ROWS * D, top, 3], [f0 + ROWS * D + 1, top, 3], [f0 + ROWS * D + 1, -2.2, 4]);
      return P;
    };
    // part of the edge ending at a profile point: 1 riser · 2 tread (seats) · 3 parapet · 4 back; the front wall (0) is the first edge
    const COL = [0x1A2B44, 0x3B4049, 0x26344A, 0x2A2F38, 0x161A21].map(h => new THREE.Color(h)), GREENWALL = new THREE.Color(0x1C2E25);
    const P3 = pts.map(prof), at = (i, o) => [pts[i].x + miter[i].x * o, pts[i].z + miter[i].y * o];
    const pos = [], col = [];
    for (let j = 0; j < N; j++) {
      const i1 = (j + 1) % N, A = P3[j], B = P3[i1];
      for (let k = 0; k < A.length - 1; k++) {
        if (k === 0 && dug(j)) continue;                   // the dugout's opening
        const C = k === 0 ? (pts[j].of ? GREENWALL : COL[0]) : COL[A[k + 1][2]];
        const v = [[j, A[k]], [i1, B[k]], [i1, B[k + 1]], [j, A[k + 1]]].map(([i, q]) => { const [x, z] = at(i, q[0]); return [x, q[1], z]; });
        [0, 1, 2, 0, 2, 3].forEach(t => { pos.push(...v[t]); col.push(C.r, C.g, C.b); });
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals(); const nrm = geo.attributes.normal;
    let up = 0; for (let i = 0; i < nrm.count; i += 6) up += nrm.getY(i);    // treads should face up: else flip the winding (the loop's direction)
    if (up < 0) { const p = geo.attributes.position.array; for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; } geo.computeVertexNormals(); }
    const stands = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); scene.add(stands);
    // the crowd: about 60 % of the seats, every row
    let seed = 1907; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const GREY = new THREE.Color(0x6E7078), SHIRT = [0xC8303A, 0xF1EDE4, 0x1F2740, 0x2D3A55, 0xE9C94C, 0x6E6F75, 0x3D7A4F, 0xB85C2A, 0x202024, 0xC8303A, 0xF1EDE4];
    const seats = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3(), S = new THREE.Vector3();
    for (let r = 0; r < ROWS; r++) {
      let carry = rnd() * 2.2;
      for (let j = 0; j < N; j++) {
        const i1 = (j + 1) % N, oa = (pts[j].of ? 1.5 : 0) + (r + .55) * D, ob = (pts[i1].of ? 1.5 : 0) + (r + .55) * D;
        const [ax, az] = at(j, oa), [bx, bz] = at(i1, ob), ha = (pts[j].of ? 9.6 : 7) + r * RISE, hb = (pts[i1].of ? 9.6 : 7) + r * RISE, len = Math.hypot(bx - ax, bz - az);
        const face = Math.atan2(-segN[j].x, -segN[j].y);
        for (let s = carry; s < len; s += 2.2) {
          if (rnd() < .6) { const u = s / len; seats.push([ax + (bx - ax) * u, ha + (hb - ha) * u, az + (bz - az) * u, face + (rnd() - .5) * .5, .9 + rnd() * .2, SHIRT[Math.floor(rnd() * SHIRT.length)], SKIN[Math.floor(rnd() * SKIN.length)]]); }
          carry = s + 2.2 - len;
        }
      }
    }
    [[new THREE.CylinderGeometry(.85, .6, 1.9, 4, 1, true).rotateY(Math.PI / 4).scale(1, 1, .55).translate(0, .95, .1), 5], [new THREE.SphereGeometry(.34, 5, 3).scale(1, 1.15, 1).translate(0, 2.28, .12), 6]].forEach(([g, ci]) => {   // bodies (shirts), heads (skin)
      const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial(), seats.length), C = new THREE.Color();
      seats.forEach((s, i) => { m.setMatrixAt(i, m4.compose(V.set(s[0], s[1], s[2]), q.setFromAxisAngle(Y, s[3]), S.set(s[4], s[4], s[4]))); m.setColorAt(i, C.setHex(s[ci]).lerp(GREY, .3).multiplyScalar(.62)); });
      scene.add(m);
    });
    // dugouts: floor 2.6 ft under the field, roof under the first row; the field's own edge is their front wall up to a lip and a rail
    const lam = (h) => new THREE.MeshLambertMaterial({ color: h });
    const box = (g, mat, x0, x1, y0, y1, z0, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.add(m); return m; };
    return [-1, 1].map(sg => {
      const sd = sides[sg], L = DG[1] - DG[0], h = L / 2, mid = (DG[0] + DG[1]) / 2, g = new THREE.Group(), team = sg < 0 ? 'SPRAYLAB' : 'SEOUL';
      const z = new THREE.Vector3(sd.n.x, 0, sd.n.y), x = new THREE.Vector3().crossVectors(Y, z);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, Y, z)); g.position.set(sd.A.x + sd.e.x * mid, 0, sd.A.y + sd.e.y * mid);
      const wall = lam(0x232A36), dark = lam(0x161A21), trim = lam(sg < 0 ? 0xA8262F : 0x1F2740);
      box(g, lam(0x2A2C30), -h, h, -2.8, -2.6, 0, 9.4);                       // floor
      box(g, wall, -h, h, -2.6, 6, 8.9, 9.4); [-h - .5, h].forEach(x0 => box(g, wall, x0, x0 + .5, -2.6, 6, 0, 9.4));   // back and end walls
      box(g, dark, -h - .6, h + .6, 6, 6.95, -.8, 9.4);                        // roof, under the first row of seats
      box(g, trim, -h, h, -2.6, .4, .05, .6);                                  // front lip, a little above the field
      box(g, trim, -h + 1.5, h - 1.5, -2.6, -1.2, 7.2, 8.9);                   // bench along the back wall
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, L, 8).rotateZ(Math.PI / 2), dark); rail.position.set(0, .95, .35); g.add(rail);
      for (let x0 = -h; x0 <= h + .01; x0 += L / 6) box(g, dark, x0 - .06, x0 + .06, .4, .95, .29, .41);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(L * .5, .8), new THREE.MeshBasicMaterial({ map: canvasTex(THREE, 1024, 64, (c, W, H) => {
        c.fillStyle = '#161A21'; c.fillRect(0, 0, W, H); c.font = `800 46px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = sg < 0 ? '#E0343F' : '#F1EDE4'; c.fillText(team, W / 2, H * .55);
      }), toneMapped: false }));
      sign.position.set(0, 6.47, -.81); sign.rotation.y = Math.PI; g.add(sign);
      scene.add(g); g.updateMatrixWorld(true);
      return { sg, team, at: (lx, ly, lz) => g.localToWorld(new THREE.Vector3(lx, ly, lz)), face: Math.atan2(-z.x, -z.z) };
    });
  }

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
    // batter: the page places and turns him (side-on in the box: root turned a half turn), fig.mode says which part he plays --
    // 'hit': stance, swing, then the clip's follow-through blends into Running as he breaks for first, and into the ready loop on
    // the bag; 'deck': stance in the on-deck circle, a jog to the box, set again by the cycle's end. Cadence follows ground speed.
    if (role === 'batter') {
      if (!(C.idle && C.swing && C.run && C.jog && C.fidle)) return null;
      const dur = (id) => (C[id].n - 1) / C[id].fps;
      let last = null, px = 0, pz = 0, mps = 0, ph = 0;
      return (t) => {
        let dt = last === null ? 0 : t - last; if (dt < 0) dt += 8; dt = Math.min(dt, .25); last = t;
        const p = fig.root.position; if (dt > 0) mps += (Math.hypot(p.x - px, p.z - pz) / dt / (5.9 / 1.8) - mps) * Math.min(1, dt * 12); px = p.x; pz = p.z;
        if (fig.mode === 'deck') {
          sample('idle', IDLE(t), O);
          const w = smooth01((t - JOG0) / .3) * (1 - smooth01((t - JOG1 + .45) / .5));
          if (w > .002) { ph += dt * Math.min(1.4, Math.max(.9, mps / 2)); sample('jog', ph % dur('jog'), Bp); mix(O, Bp, w, O); } else ph = 0;
        } else if (t < SW - .25) sample('idle', IDLE(t), O);
        else if (t < SW) { sample('idle', IDLE(t), A); sample('swing', 0, Bp); mix(A, Bp, smooth01((t - SW + .25) / .25), O); }
        else if (t < RUN0) sample('swing', t - SW, O);
        else {
          ph += dt * Math.min(1.6, Math.max(.9, mps / 3.7));
          sample('swing', Math.min(t - SW, 2.2), A); sample('run', ph % dur('run'), Bp); mix(A, Bp, smooth01((t - RUN0) / (RUN1 - RUN0)), O);
          const w = smooth01((t - ARR + .2) / .5);            // on the bag: the ready loop
          if (w > .002) { sample('fidle', (t - ARR) % dur('fidle'), Bp); mix(O, Bp, w, O); }
        }
        apply();
      };
    }
    // in the dugouts: at the rail (the fielders' ready loop: a crouch, hands on the knees) or on the bench (a fixed pose, see makeFigureGLB)
    if (role === 'rail') { if (!C.fidle) return null; const ph0 = Math.random() * 4, d = (C.fidle.n - 1) / C.fidle.fps; return (t) => { sample('fidle', (t + ph0) % d, O); apply(); }; }
    if (role === 'bench') return () => fig.seat();
    if (!TL[role] || (role === 'pitcher' && !C.pitch) || (role !== 'pitcher' && !C[role === 'coach' ? 'fidle' : role])) return null;
    let base = null, yaw0 = null;
    return (t) => {
      if (base === null && t < 1.8) base = fig.root.position.clone();     // page root offsets (pitcher's stride) are zero here; the mocap carries its own
      if (yaw0 === null) yaw0 = fig.root.rotation.y;
      if (base) fig.root.position.copy(base);
      fig.root.rotation.y = yaw0;
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
    const far = o.role === 'fielder' || o.role === 'coach' || o.role === 'rail' || o.role === 'bench' || !o.role;   // small on screen: skip the costly skinned shadow pass
    mesh.castShadow = !far; mesh.receiveShadow = true; mesh.frustumCulled = false;   // skinned poses leave the bind bounds
    let cull = o.role === 'rail' || o.role === 'bench' ? 1 : 0;   // the dugout players barely move: bound their pose once (after a render) and cull them off-screen
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
    // On the bench: thighs forward, shins down, hands on the thighs, a slight lean. Each bone's rest orientation is turned in body
    // axes by its own entry (or its parent's), once, here, while the root is still unturned; fig.seat() puts it back every frame
    // (under the head turn). sitDrop: how far the pose lifted the feet, for the page to lower him onto the bench.
    if (o.role === 'bench') {
      const Rx = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
      const toward = (a, b, x, y, z) => new THREE.Quaternion().setFromUnitVectors(BD.bind(b).sub(BD.bind(a)).normalize(), new THREE.Vector3(x, y, z).normalize());
      const turn = { Spine: Rx(.12), LeftUpLeg: Rx(.08 - Math.PI / 2), RightUpLeg: Rx(.08 - Math.PI / 2), LeftLeg: Rx(.05), RightLeg: Rx(.05),
        LeftArm: toward('LeftArm', 'LeftForeArm', .18, -.9, .35), RightArm: toward('RightArm', 'RightForeArm', -.18, -.9, .35),
        LeftForeArm: toward('LeftForeArm', 'LeftHand', -.1, -.65, .75), RightForeArm: toward('RightForeArm', 'RightHand', .1, -.65, .75) };
      const pose = (b, up) => { const n = b.name.replace(/^mixamorig:?/, ''), q = turn[n] || up; if (bones[n] === b) setWorldQ(b, q.clone().multiply(BD.restQ(n))); b.children.forEach(ch => ch.isBone && pose(ch, q)); };
      root.updateMatrixWorld(true); const y0 = B.LeftFoot.getWorldPosition(v1).y;
      pose(B.Hips, new THREE.Quaternion()); fig.sitDrop = B.LeftFoot.getWorldPosition(v1).y - y0;
      const seat = mesh.skeleton.bones.map(b => [b, b.quaternion.clone()]);
      fig.seat = () => seat.forEach(([b, q]) => b.quaternion.copy(q));
    }
    fig.hipsAt = (v) => B.Hips.getWorldPosition(v);
    const gloved = o.role === 'fielder' || o.role === 'pitcher' || o.role === 'catcher';
    fig.sync = (tau) => {                                    // first call comes from the page's frame, after it has placed the figure
      if (!play || tau === undefined) return;
      play(tau);
      if (cull && ++cull > 2) { cull = 0; mesh.computeBoundingSphere(); mesh.boundingSphere.radius *= 1.3; mesh.frustumCulled = true; }
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

  class SprayPlay extends HTMLElement {
    static get observedAttributes() { return ['hand', 'count', 'motion']; }
    constructor() {
      super();
      this.rot = { yaw: 0, pitch: 0, vy: 0, vp: 0, drag: false, lastDrag: -1e9, zoom: 1, panX: 0, panZ: 0 };
      this.live = []; this.cycle = -1; this.landed = false; this.released = false; this.visible = true; this.t0 = null;
    }
    get hand() { return this.getAttribute('hand') || 'right'; } set hand(v) { if (v != null) this.setAttribute('hand', String(v)); }
    get count() { return Number(this.getAttribute('count') ?? 60); } set count(v) { if (v != null) this.setAttribute('count', String(v)); }
    get motion() { return this.getAttribute('motion') !== 'false'; } set motion(v) { this.setAttribute('motion', String(v)); }
    get cam() { return this.getAttribute('cam') || 'cycle'; }   // 'cycle': close for the pitch, wide for the flight and the record · 'close': stays at the plate
    attributeChangedCallback() { if (this.T) this.rebuildDots(); }
    connectedCallback() {
      if (this.mounted) return; this.mounted = true;
      Object.assign(this.style, { display: 'block', position: 'relative', width: '100%', height: '100%', minHeight: '240px', aspectRatio: '4 / 3', touchAction: 'pan-y', cursor: 'grab', userSelect: 'none', webkitUserSelect: 'none' });
      const ui = document.createElement('div');
      Object.assign(ui.style, { position: 'absolute', inset: 0, pointerEvents: 'none', fontSize: '13px', letterSpacing: '.06em', fontWeight: 400, color: INK, lineHeight: 1 });
      const ph = document.createElement('div');
      Object.assign(ph.style, { position: 'absolute', left: 0, bottom: 0, display: 'flex', gap: '16px' });
      this.phEls = ['투구', '타격', '기록'].map(s => { const e = document.createElement('span'); e.textContent = s; e.style.transition = 'font-weight .25s'; ph.appendChild(e); return e; });
      const stat = document.createElement('div');
      Object.assign(stat.style, { position: 'absolute', right: 0, bottom: 0, fontVariantNumeric: 'tabular-nums' });
      const tag = document.createElement('div');
      Object.assign(tag.style, { position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', transform: 'translate(14px,-50%)', opacity: 0, transition: 'opacity .35s', letterSpacing: '.04em' });
      ui.append(ph, stat, tag); this.append(ui);
      this.statEl = stat; this.tagEl = tag;
      // one pointer drags: turn (and tilt, with a mouse). On touch, `touch-action: pan-y` leaves vertical swipes to the page, so one
      // finger turns the field and scrolling still works; two fingers zoom. The free mode (setFree, the "3D 조작" button on touch
      // devices) takes every touch instead: one finger turns and tilts, two fingers zoom and move the view, the camera holds still.
      const pts = new Map(), two = () => { const [a, b] = pts.values(); return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
      this.addEventListener('pointerdown', e => {
        if (e.target.closest && e.target.closest('.sp-ctl')) return;   // the mode button
        const R = this.rot; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { this.setPointerCapture(e.pointerId); } catch (_) {}
        if (pts.size === 2) { const g = two(); R.drag = false; R.vy = R.vp = 0; R.pinch = { d: g.d, x: g.x, y: g.y, z: R.zoom }; return; }
        R.drag = true; R.px = e.clientX; R.py = e.clientY; R.vy = 0; R.vp = 0; R.touch = e.pointerType === 'touch'; R.home = false;
        this.style.cursor = 'grabbing';
      });
      this.addEventListener('pointermove', e => {
        const R = this.rot, p = pts.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY;
        if (R.pinch && pts.size >= 2) {
          const g = two(); R.zoom = clamp(R.pinch.z * g.d / R.pinch.d, .5, 4);
          if (this.free) {   // the two fingers' middle drags the view: the field follows the fingers
            const k = this.panK || .2, dx = g.x - R.pinch.x, dy = g.y - R.pinch.y, th = R.yaw * D2R, c = Math.cos(th), s = Math.sin(th);
            R.panX = clamp(R.panX - (c * dx + s * dy) * k, -250, 250); R.panZ = clamp(R.panZ + (s * dx - c * dy) * k, -320, 80);
          }
          R.pinch.x = g.x; R.pinch.y = g.y; R.lastDrag = performance.now(); return;
        }
        if (!R.drag) return;
        const dx = e.clientX - R.px, dy = R.touch && !this.free ? 0 : e.clientY - R.py; R.px = e.clientX; R.py = e.clientY;   // outside the free mode a finger's up / down is the page's scroll
        R.vy = -dx * 0.4; R.vp = dy * 0.25; R.yaw += R.vy; R.pitch = clamp(R.pitch + R.vp, -30, this.free ? 70 : 45);   // the free mode can look down from above
      });
      const up = e => {
        const R = this.rot; pts.delete(e.pointerId); if (pts.size < 2) R.pinch = null;
        if (pts.size === 1) { const [q] = pts.values(); R.drag = true; R.px = q.x; R.py = q.y; R.vy = R.vp = 0; return; }   // one finger left after a pinch: turn from here
        if (!R.drag) return; R.drag = false; R.lastDrag = performance.now(); this.style.cursor = 'grab';
      };
      this.addEventListener('pointerup', up); this.addEventListener('pointercancel', up);
      // pan-y would let the browser scroll the page with a two-finger move (and cancel the pinch): keep two-finger touches here
      const two2 = e => { if (e.touches.length > 1) e.preventDefault(); };
      this.addEventListener('touchstart', two2, { passive: false }); this.addEventListener('touchmove', two2, { passive: false });
      // Ctrl + wheel zooms (a trackpad pinch arrives as one too); a plain wheel stays the page's scroll
      this.addEventListener('wheel', e => {
        if (!e.ctrlKey) return; e.preventDefault();
        const R = this.rot; R.zoom = clamp(R.zoom * Math.exp(-e.deltaY * (e.deltaMode ? 40 : 1) * .002), .5, 4); R.lastDrag = performance.now();   // deltaMode 1 = lines (Firefox)
      }, { passive: false });
      const wait = document.createElement('div'); wait.textContent = '선수들 불러오는 중…';
      Object.assign(wait.style, { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: INK, opacity: .55 });
      this.append(wait); this.waitEl = wait;
      const start = () => three().then(T => loadBody(T).then(b => { BODY = b; }, err => console.warn('spray-play: realistic body unavailable, using mannequin', err)).then(() => this.init(T)))
        .catch(err => console.error('spray-play: three.js failed to load', err));
      if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '25% 0px' }); io.observe(this); }
      else start();
    }
    // free mode (touch devices): the 3D takes every touch until "완료", or until it scrolls out of view; leaving glides back to the framing
    setFree(on) {
      const R = this.rot; this.free = on; R.home = !on; R.vy = R.vp = 0; R.lastDrag = performance.now();
      Object.assign(this.style, { touchAction: on ? 'none' : 'pan-y', outline: on ? '2px solid rgba(224,52,63,.9)' : '', outlineOffset: on ? '-2px' : '' });
      if (this.ctl) Object.assign(this.ctl.style, { background: on ? '#E0343F' : 'rgba(11,13,18,.62)', borderColor: on ? '#E0343F' : 'rgba(255,255,255,.28)' }), this.ctl.textContent = on ? '완료' : '3D 조작';
      if (this.tip) { clearTimeout(this.tipT); this.tip.style.opacity = on ? 1 : 0; if (on) this.tipT = setTimeout(() => { this.tip.style.opacity = 0; }, 2600); }
    }
    disconnectedCallback() { cancelAnimationFrame(this.raf); this.ro && this.ro.disconnect(); this.io && this.io.disconnect(); this.renderer && this.renderer.dispose(); }

    init(THREE) {
      this.T = THREE; if (this.waitEl) this.waitEl.remove();
      const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
      Object.assign(renderer.domElement.style, { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' });
      this.prepend(renderer.domElement);
      const scene = this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(36, 4 / 3, 1, 4000);
      // studio environment for soft ambient + fabric/skin highlights
      const env = new THREE.Scene(); env.background = new THREE.Color(0xC9C4BB);
      const panel = (w, h, x, y, z, ry, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; m.lookAt(0, 0, 0); env.add(m); };
      panel(60, 30, -40, 60, 40, 0, 0xFFFFFF); panel(40, 40, 50, 40, -30, 0, 0xFFF4E8); panel(200, 200, 0, -40, 0, 0, 0x6F6B64);
      const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, .04).texture; scene.environmentIntensity = .55; pm.dispose();
      scene.add(new THREE.HemisphereLight(0xFFFFFF, 0x8A857C, .35));
      const sun = new THREE.DirectionalLight(0xFFF3E6, 2.4);
      sun.position.set(-120, 220, 140); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 5; sun.shadow.blurSamples = 10;
      Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 700 });
      sun.shadow.bias = -0.0003; sun.target.position.set(0, 0, -30); scene.add(sun, sun.target);
      const fill = new THREE.DirectionalLight(0xDCE6FF, .5); fill.position.set(150, 80, -60); scene.add(fill);

      // ---- the field: night-game turf, skinned infield, chalk -- painted once into a texture on the ground slab (ft: home at the
      //      origin, the outfield toward -z, fence at 330), plus a sharper decal round home for the close shot and a low outfield wall
      const chalk = new THREE.Color(CHALK), flat = { toneMapped: false };   // painted colours stay as painted
      const R = 330, FOUL = 12, BACK = 45, ps = R * Math.SQRT1_2;         // fence · foul ground outside the lines at the poles · beside and behind home
      const tFence = Math.sqrt(R * R - FOUL * FOUL);                        // along the foul line, where FOUL ft outside it meets the fence
      const pt = (t, w, side) => [side * (t + w) / Math.SQRT2, (w - t) / Math.SQRT2];   // t ft along a foul line, w ft outside it
      const ground = (moveTo, lineTo, arc) => {                             // the slab outline, for THREE.Shape and the canvas alike
        const [x0, z0] = pt(tFence, FOUL, -1), [x1, z1] = pt(tFence, FOUL, 1), [x2, z2] = pt(0, BACK, 1), [x3, z3] = pt(0, BACK, -1);
        moveTo(x0, z0); arc(R, Math.atan2(z0, x0), Math.atan2(z1, x1)); lineTo(x2, z2); arc(BACK, Math.atan2(z2, x2), Math.atan2(z3, x3));   // foul ground tapers from the backstop to the poles
      };
      const GRASS = '#27612F', GRASS2 = '#2D6E3A', DIRT = '#80533A', LINE = '#F4F1EA';
      const paint = (ctx, s) => {                                           // field coordinates in ft; the caller's transform maps them to pixels
        ctx.save();
        const circle = (x, z, r) => { ctx.beginPath(); ctx.arc(x, z, r, 0, 7); ctx.fill(); };
        const ring = (r0, r1) => { ctx.beginPath(); ctx.arc(0, 0, r1, 0, 7); ctx.moveTo(r0, 0); ctx.arc(0, 0, r0, 7, 0, true); ctx.fill(); };
        ctx.beginPath(); ground((x, z) => ctx.moveTo(x, z), (x, z) => ctx.lineTo(x, z), (r, a0, a1) => ctx.arc(0, 0, r, a0, a1, false)); ctx.closePath(); ctx.clip();
        ctx.fillStyle = GRASS; ctx.fillRect(-R, -R, 2 * R, 2 * R);
        ctx.fillStyle = GRASS2; for (let r = 20; r < R; r += 40) ring(r, r + 20);   // mowing arcs
        ctx.fillStyle = DIRT; ring(R - 14, R);                                         // warning track
        ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-ps, -ps); ctx.arc(0, 0, R, 225 * D2R, 315 * D2R); ctx.closePath(); ctx.clip();   // fair ground only:
        circle(0, -60.5, 95); ctx.restore();                                           // the skin, 95 ft round the rubber
        ctx.strokeStyle = DIRT; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(63.6, -63.6); ctx.lineTo(0, 0); ctx.lineTo(-63.6, -63.6); ctx.stroke();   // running lanes
        const d = 4 * Math.SQRT2; ctx.fillStyle = GRASS;                              // infield grass, 4 ft inside the base lines
        ctx.beginPath(); ctx.moveTo(0, -d); ctx.lineTo(63.6 - d, -63.6); ctx.lineTo(0, -127.3 + d); ctx.lineTo(-63.6 + d, -63.6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = DIRT; [[63.6, -63.6], [0, -127.3], [-63.6, -63.6]].forEach(([x, z]) => circle(x, z, 8)); circle(0, -59, 9.6); circle(0, 0, 13);   // bases, mound, home
        ctx.save(); ctx.globalAlpha = .55; DECK.forEach(([x, z]) => circle(x, z, 2.6)); ctx.restore();   // on-deck circles
        const tile = document.createElement('canvas'); tile.width = tile.height = 128; const tc = tile.getContext('2d'), id = tc.createImageData(128, 128);   // grain: a 16 ft noise tile
        let seed = 7; for (let i = 3; i < id.data.length; i += 4) { seed = (seed * 1664525 + 1013904223) % 4294967296; id.data[i] = seed / 4294967296 * 40; }   // seeded, so the stills match the live frame
        tc.putImageData(id, 0, 0); const grain = ctx.createPattern(tile, 'repeat'); grain.setTransform(new DOMMatrix().scale(16 / 128));
        ctx.fillStyle = grain; ctx.fillRect(-R, -R, 2 * R, R + BACK);
        ctx.strokeStyle = LINE; ctx.lineWidth = Math.max(.34, 2.5 / s);               // chalk: 4 in, or 2.5 px when the texture is coarser
        ctx.beginPath(); ctx.moveTo(ps, -ps); ctx.lineTo(0, 0); ctx.lineTo(-ps, -ps); ctx.stroke();   // foul lines
        ctx.strokeRect(1.2, -3, 4, 6); ctx.strokeRect(-5.2, -3, 4, 6); ctx.strokeRect(-1.8, 3, 3.6, 8);   // batter's boxes, catcher's box
        const v = ctx.createRadialGradient(0, -60, 95, 0, -60, R); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.58)');
        ctx.fillStyle = v; ctx.fillRect(-R, -R, 2 * R, 2 * R);                           // the lights fall off toward the fence
        ctx.restore();
      };
      const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
      const S = 4, turf = tex(2048, 1600, ctx => { ctx.setTransform(S, 0, 0, -S, 256 * S, 64 * S); paint(ctx, S); });   // x -256..256, z 64..-336 at 4 px/ft
      turf.repeat.set(1 / 512, 1 / 400); turf.offset.set(.5, 336 / 400);          // the slab's top-face UVs are the shape's own (x, z)
      const shape = new THREE.Shape(); ground((x, z) => shape.moveTo(x, z), (x, z) => shape.lineTo(x, z), (r, a0, a1) => shape.absarc(0, 0, r, a0, a1, false));
      const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false }), [new THREE.MeshBasicMaterial({ map: turf, ...flat }), new THREE.MeshBasicMaterial({ color: 0x12171C, ...flat })]);
      slab.rotation.x = Math.PI / 2; scene.add(slab);
      const DW = 88, DS = 1536 / DW, decal = tex(1536, 1536, ctx => {           // 88 ft round (0, -8) at 17 px/ft, fading out toward its edge
        ctx.setTransform(DS, 0, 0, DS, DW / 2 * DS, (DW / 2 + 8) * DS); paint(ctx, DS);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'destination-in';
        const g = ctx.createRadialGradient(768, 768, 540, 768, 768, 768); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1536, 1536);
      });
      const home = new THREE.Mesh(new THREE.PlaneGeometry(DW, DW), new THREE.MeshBasicMaterial({ map: decal, transparent: true, depthWrite: false, ...flat }));
      home.rotation.x = -Math.PI / 2; home.position.set(0, .05, -8); home.renderOrder = -1; scene.add(home);   // under the shadows and markers
      const [fx, fz] = pt(tFence, FOUL, 1), fa = Math.atan2(fz, fx);                    // the outfield wall along the fence arc, with its yellow cap
      const wallGeo = (h) => new THREE.CylinderGeometry(R, R, h, 96, 1, true, Math.PI / 2 - fa, 2 * fa + Math.PI);
      const wall = new THREE.Mesh(wallGeo(8), new THREE.MeshBasicMaterial({ color: 0x1C2E25, side: THREE.DoubleSide, ...flat })); wall.position.y = 4; scene.add(wall);
      const cap = new THREE.Mesh(wallGeo(.4), new THREE.MeshBasicMaterial({ color: 0xE9C94C, side: THREE.DoubleSide, ...flat })); cap.position.y = 8.2; scene.add(cap);
      const park = ballpark(THREE, scene, { R, FOUL, BACK, pt, tFence });
      const baseMat = new THREE.MeshBasicMaterial({ color: CHALK });
      [[63.6, -63.6], [0, -127.3], [-63.6, -63.6]].forEach(([x, z]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, .18, 1.3), baseMat); b.position.set(x, .1, z); b.rotation.y = Math.PI / 4; scene.add(b); });
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.4, .1, 1.4), baseMat); plate.position.set(0, .06, 0); plate.rotation.y = Math.PI / 4; scene.add(plate);
      const rubber = new THREE.Mesh(new THREE.BoxGeometry(2, .12, .5), baseMat); rubber.position.set(0, .2, -60.5); scene.add(rubber);
      const mound = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.6, .14, 32), new THREE.MeshBasicMaterial({ color: DIRT, ...flat })); mound.position.set(0, .07, -59); scene.add(mound);
      const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.ShadowMaterial({ opacity: .4 }));
      shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.y = .16; shadowPlane.receiveShadow = true; scene.add(shadowPlane);

      const faintMat = new THREE.LineBasicMaterial({ color: chalk, transparent: true, opacity: .18 });   // distance rings: a chart overlay, not paint
      const Y = .2;
      const line = (pts, mat) => { const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], Y, p[1]))); scene.add(new THREE.Line(g, mat)); };
      const arc = (r, a0, a1, n = 64, cx = 0, cz = 0) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * D2R; return [cx + r * Math.sin(a), cz - r * Math.cos(a)]; });
      [100, 200, 300].forEach(r => line(arc(r, -45, 45, 64), faintMat));

      const glove = (fig, r) => { if (fig.addGlove) return fig.addGlove(r > .5); const g = new THREE.Group(); g.position.y = -.1; fig.handL.add(g); const a = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), fig.mats.leather); a.scale.set(1, 1.15, .55); a.castShadow = true; g.add(a); };
      const P = this.pitcher = makeFigure(THREE, { role: 'pitcher', kit: AWAY, skin: SKIN[0], hair: HAIR[0], number: 18 }); P.root.position.set(0, .2, -60.5); scene.add(P.root); glove(P, .42);
      const B = this.batter = makeFigure(THREE, { role: 'batter', kit: { ...HOME, helmet: true }, flap: 1, skin: SKIN[2], hair: HAIR[1], number: 27 }); B.root.position.set(-3.1, 0, .4); B.root.rotation.y = Math.PI / 2; scene.add(B.root);
      B.handR.add(makeBat(THREE));
      const C = this.catcher = makeFigure(THREE, { role: 'catcher', kit: { ...AWAY, mask: true, protector: true, guards: true }, skin: SKIN[3], hair: HAIR[2], number: 2 }); C.root.position.set(0, 0, 5.2); C.root.rotation.y = Math.PI; scene.add(C.root);
      C.hips.position.y = 1.1; C.hipL.rotation.x = C.hipR.rotation.x = -1.75; C.kneeL.rotation.x = C.kneeR.rotation.x = 2.2; C.torso.rotation.x = .35; C.hipL.position.x = .55; C.hipR.position.x = -.55;
      C.shL.rotation.x = -1.4; C.elL.rotation.x = -.3; C.shR.rotation.x = -.9; C.elR.rotation.x = -1.6; glove(C, .55);
      const U = this.ump = makeFigure(THREE, { role: 'ump', kit: { ...UMP, mask: true }, skin: SKIN[1], hair: HAIR[3], number: 0 }); U.root.position.set(1.1, 0, 7.9); U.root.rotation.y = Math.PI; scene.add(U.root);
      U.hips.position.y = 2.0; U.hipL.rotation.x = U.hipR.rotation.x = -1.15; U.kneeL.rotation.x = U.kneeR.rotation.x = 1.5; U.torso.rotation.x = .55; U.hipL.position.x = .5; U.hipR.position.x = -.5;
      U.shL.rotation.x = U.shR.rotation.x = -.95; U.elL.rotation.x = U.elR.rotation.x = -.35;
      const K = this.coach = makeFigure(THREE, { role: 'coach', kit: { ...HOME, jersey: 0xC8303A, pinstripe: null, accent: 0xF1EDE4, name: 'SPRAYLAB' }, skin: SKIN[4], hair: HAIR[4], number: 31 }); K.root.position.set(-58, 0, -14); K.root.rotation.y = Math.PI / 2; scene.add(K.root);
      K.torso.rotation.x = .12; K.shL.rotation.x = -1.0; K.elL.rotation.x = -1.25; K.shL.rotation.z = -.35;
      const tablet = new THREE.Group(); tablet.position.set(0, -.15, .35); tablet.rotation.x = -1.05; K.handL.add(tablet);
      const tb = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, .06), K.mats.dark); tb.castShadow = true; tablet.add(tb);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(.88, 1.26, .02), new THREE.MeshBasicMaterial({ color: 0xE7E3DC })); screen.position.z = .035; tablet.add(screen);
      this.coachFace = Math.PI / 2;
      this.fielders = [[70, -65, 3], [30, -135, 12], [-30, -135, 6], [-70, -65, 5], [-130, -230, 24], [0, -290, 8], [130, -230, 44]].map(([x, z, n], i) => {
        const F = makeFigure(THREE, { role: 'fielder', kit: AWAY, skin: SKIN[(i + 1) % SKIN.length], hair: HAIR[i % HAIR.length], number: n });
        F.root.position.set(x, 0, z); F.root.rotation.y = Math.atan2(-x, -z);
        F.hipL.position.x = .45; F.hipR.position.x = -.45; glove(F, .38); scene.add(F.root);
        return { F, home: new THREE.Vector3(x, 0, z), face: F.root.rotation.y };
      });
      // with the realistic players: the next batter (the two take turns: one hits and runs to first while the other comes up from
      // the on-deck circle), and five players in each dugout -- three at the rail, two on the bench. Created after the fielders,
      // so everyone else keeps the cap model they had.
      this.extras = [];
      if (BODY) {
        const B2 = makeFigure(THREE, { role: 'batter', kit: { ...HOME, helmet: true }, flap: 1, skin: SKIN[5], hair: HAIR[2], number: 9 }); B2.handR.add(makeBat(THREE)); scene.add(B2.root);
        this.batters = [B, B2].map(F => {   // each bat gets its own materials: a dropped one fades out
          const bat = F.handR.children[F.handR.children.length - 1];
          bat.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; } });
          return { F, bat };
        });
        this.extras.push(B2);
        park.forEach(d => [[-13, 1.5, 'rail'], [-3.5, 1.6, 'rail'], [8.5, 1.5, 'rail'], [-9, 7.9, 'bench'], [14, 7.9, 'bench']].forEach(([x, z, role]) => {
          const n = this.extras.length, F = makeFigure(THREE, { role, kit: d.team === 'SPRAYLAB' ? HOME : AWAY, skin: SKIN[(n * 3) % SKIN.length], hair: HAIR[n % HAIR.length], number: [11, 23, 5, 36, 15, 4, 29, 17, 51, 7][n % 10] });
          F.root.position.copy(d.at(x, -2.6 - (F.sitDrop || 0), z)); F.root.rotation.y = d.face; scene.add(F.root); this.extras.push(F);
        }));
      }

      this.ball = new THREE.Mesh(new THREE.SphereGeometry(.45, 16, 12), new THREE.MeshStandardMaterial({ color: 0xF7F4EE, roughness: .5 }));
      this.ball.castShadow = true; scene.add(this.ball); if (BODY) this.ball.scale.setScalar(.3);
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(65 * 3), 3));
      this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: .9 })); this.trail.visible = false; scene.add(this.trail);
      const ring = (ri, ro, color, op) => { const m = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = .22; m.visible = false; scene.add(m); return m; };
      this.contact = ring(.9, 1.0, chalk, 1); this.ripple = ring(.9, 1.0, RED, .8); this.tap = ring(3.6, 3.9, chalk, 1);
      this.pool = Array.from({ length: 8 }, () => {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: RED })); disc.rotation.x = -Math.PI / 2; disc.position.y = .24; disc.visible = false;
        const halo = new THREE.Mesh(new THREE.CircleGeometry(4.5, 24), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: .14 })); halo.rotation.x = -Math.PI / 2; halo.position.y = .21; halo.visible = false;
        scene.add(disc, halo); return { disc, halo };
      });
      this.dotsGroup = new THREE.Group(); scene.add(this.dotsGroup);
      this.rebuildDots();
      this.relPos = new THREE.Vector3(); this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3(); this.camTarget = new THREE.Vector3();

      const resize = () => {
        const w = this.clientWidth || 4, h = this.clientHeight || 3; renderer.setSize(w, h, false); this.camera.aspect = w / h;
        // framing from the page's CSS, per layout: `--zoom` (lens zoom) and `--shift: x y` (lens shift, fractions of the view; + moves the scene right / up)
        const cs = getComputedStyle(this), [sx = 0, sy = 0] = cs.getPropertyValue('--shift').trim().split(/\s+/).map(Number);
        this.camera.zoom = parseFloat(cs.getPropertyValue('--zoom')) || 1;
        if (sx || sy) this.camera.setViewOffset(w, h, -sx * w, sy * h, w, h); else this.camera.clearViewOffset();
        this.camera.updateProjectionMatrix();
      };
      this.ro = new ResizeObserver(resize); this.ro.observe(this); resize();
      if ('IntersectionObserver' in window) { this.io = new IntersectionObserver(es => { this.visible = es[0].isIntersecting; if (!this.visible && this.free) this.setFree(false); }, { rootMargin: '200px' }); this.io.observe(this); }
      if (matchMedia('(pointer: coarse)').matches) {   // touch devices: a button for the free mode, and a one-line hint when it starts
        const pill = { position: 'absolute', zIndex: 5, padding: '0 16px', minHeight: '44px', minWidth: '44px', borderRadius: '999px', border: '1px solid rgba(255,255,255,.28)',
          background: 'rgba(11,13,18,.62)', color: '#fff', font: "700 13px/1 " + FONT, letterSpacing: '.01em', backdropFilter: 'blur(10px)', webkitBackdropFilter: 'blur(10px)' };
        const btn = this.ctl = document.createElement('button'); btn.type = 'button'; btn.className = 'sp-ctl'; btn.textContent = '3D 조작';
        Object.assign(btn.style, pill, { top: '10px', right: '10px', cursor: 'pointer' });
        btn.addEventListener('click', () => this.setFree(!this.free));
        const tip = this.tip = document.createElement('span'); tip.className = 'sp-tip'; tip.textContent = '한 손가락: 돌리기·기울이기 · 두 손가락: 확대·이동';
        Object.assign(tip.style, pill, { display: 'flex', alignItems: 'center', left: '50%', top: '62px', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontWeight: 600, pointerEvents: 'none', opacity: 0, transition: 'opacity .3s' });
        this.append(btn, tip);
      }
      const loop = (t) => { this.raf = requestAnimationFrame(loop); if (this.visible) this.frame(t); };
      this.raf = requestAnimationFrame(loop);
    }

    rebuildDots() {
      const THREE = this.T, g = this.dotsGroup, ink = new THREE.Color(CHALK);
      while (g.children.length) g.remove(g.children[0]);
      const pullLeft = this.hand !== 'left', count = clamp(this.count, 0, 120);
      const dots = this.dots = genDots(pullLeft, count);
      const red = new THREE.MeshBasicMaterial({ color: RED });
      const halo = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: .14 });
      const outM = new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: .4, side: THREE.DoubleSide });
      const xbhM = new THREE.MeshBasicMaterial({ color: ink, side: THREE.DoubleSide });
      const trailM = new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: .12 });
      const disc = new THREE.CircleGeometry(1.6, 24), haloG = new THREE.CircleGeometry(4.5, 24), outG = new THREE.RingGeometry(1.25, 1.6, 24), xbhG = new THREE.RingGeometry(1.6, 2.0, 24);
      const flat = (geo, mat, x, z, y) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(m); };
      dots.filter(p => p.on).forEach(p => {
        if (p.t === 'out') { flat(outG, outM, p.x, p.z, .2); return; }
        flat(haloG, halo, p.x, p.z, .19); flat(disc, red, p.x, p.z, .2);
        if (p.t !== 'xbh') return;
        flat(xbhG, xbhM, p.x, p.z, .2);
        const peak = Math.max(6, p.d * p.lift * .9), pts = [];
        for (let k = 0; k <= 24; k++) { const u = k / 24; pts.push(new THREE.Vector3(p.x * u, 2.6 * (1 - u) + peak * 4 * u * (1 - u) + .3, p.z * u)); }
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), trailM));
      });
      const future = dots.filter(p => p.t !== 'out' && !p.on);
      this.hits = future.length ? future : dots.filter(p => p.t !== 'out');
      this.basePA = count; this.baseHits = dots.filter(p => p.on && p.t !== 'out').length;
      this.pullLeft = pullLeft;
      this.target = this.hits[0];
    }
    tagFor(p) {
      const type = p.t === 'xbh' ? (p.d > 305 ? '3루타' : '2루타') : '안타';
      const left = this.pullLeft ? p.a < -15 : p.a > 15, right = this.pullLeft ? p.a > 15 : p.a < -15;
      return `${type} · ${left ? '좌익' : right ? '우익' : '중앙'}`;
    }
    // turn a figure's head toward a world point (eased, clamped)
    look(fig, world, k = .18, maxYaw = 1.2) {
      const l = fig.root.worldToLocal(this.tmp2.copy(world));
      let yaw = Math.atan2(l.x, l.z) - fig.torso.rotation.y;
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      const pitch = clamp(-Math.atan2(l.y - 5.3, Math.hypot(l.x, l.z)), -.55, .6);
      fig.head.rotation.y += (clamp(yaw, -maxYaw, maxYaw) - fig.head.rotation.y) * k;
      fig.head.rotation.x += (pitch - fig.head.rotation.x) * k;
    }
    breathe(fig, t) { fig.torso.scale.y = 1 + .012 * Math.sin(t * 1.7 + fig.phase); fig.torso.scale.x = 1 + .006 * Math.sin(t * 1.7 + fig.phase); }
    // the at-bat, realistic players only (the mocap animates the bodies, see clipPlayer): the hitter drops the bat after the swing
    // and runs to first; the other batter waits in the on-deck circle, jogs to the box during the run and is set by the cycle's end.
    // Then they swap: the box is the same at both ends of the cycle, and the runner's jump to the on-deck circle is off-screen.
    atBat(tau, cyc) {
      const THREE = this.T, [H, N] = cyc % 2 ? [this.batters[1], this.batters[0]] : this.batters, F = H.F, G = N.F;
      if (this.atBatCyc !== cyc) {                         // new at-bat: the old runner goes on deck with his bat back in his hands
        this.atBatCyc = cyc; this.runFrom = null; this.drop = null;
        G.handR.add(N.bat); N.bat.position.set(0, 0, 0); N.bat.quaternion.identity(); N.bat.scale.set(1, 1, 1); N.bat.visible = true;
        N.bat.traverse(m => { if (m.isMesh) m.material.opacity = 1; });
      }
      F.mode = 'hit'; G.mode = 'deck';
      if (tau < RUN0) { F.root.position.set(BOX[0], 0, BOX[1]); F.root.rotation.y = Math.PI; }
      else {
        if (!this.runFrom) {                               // run from where the swing left his hips, so the body doesn't snap back to the box
          F.hipsAt(this.tmp); const sx = this.tmp.x, sz = this.tmp.z, dx = BAG[0] - sx, dz = BAG[1] - sz, L = Math.hypot(dx, dz);
          this.runFrom = { ox: sx - BOX[0], oz: sz - BOX[1], ux: dx / L, uz: dz / L, L };
        }
        const r = this.runFrom, w = clamp((tau - RUN0) / (RUN1 - RUN0), 0, 1), s = runS(tau, r.L, RUN0, ARR, .9, .55);
        F.root.position.set(BOX[0] + r.ox * w + r.ux * s, 0, BOX[1] + r.oz * w + r.uz * s);
        F.root.rotation.y = lerpA(Math.PI, Math.atan2(r.ux, r.uz), w * w * (3 - 2 * w));
      }
      if (tau >= RUN0 + .05 && !this.drop) {                // the bat leaves his hands and falls flat beside the plate
        this.scene.attach(H.bat); const p = H.bat.position;
        this.drop = { p0: p.clone(), q0: H.bat.quaternion.clone(), p1: new THREE.Vector3(p.x - .9, .12, p.z + 1.3), q1: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(.8, 0, .6)) };
      }
      if (this.drop) {
        const d = this.drop, u = clamp((tau - RUN0 - .05) / .42, 0, 1), op = 1 - clamp((tau - 6.6) / .7, 0, 1);
        H.bat.position.set(lerp(d.p0.x, d.p1.x, u), lerp(d.p0.y, d.p1.y, u * u), lerp(d.p0.z, d.p1.z, u)); H.bat.quaternion.slerpQuaternions(d.q0, d.q1, u);
        H.bat.visible = op > 0; H.bat.traverse(m => { if (m.isMesh) m.material.opacity = op; });
      }
      const [dx, dz] = DECK[0], jx = BOX[0] - dx, jz = BOX[1] - dz, u = runS(tau, 1, JOG0, JOG1, .45, .45);
      G.root.position.set(dx + jx * u, 0, dz + jz * u);
      G.root.rotation.y = lerpA(Math.PI, Math.atan2(jx, jz), tau < JOG0 + 1 ? clamp((tau - JOG0) / .35, 0, 1) : 1 - clamp((tau - JOG1 + .3) / .6, 0, 1));
    }

    frame(now) {
      const t = now / 1000, Tc = 8;
      if (this.t0 === null) this.t0 = t;
      const el = t - this.t0, tau = el % Tc, cyc = Math.floor(el / Tc);
      if (cyc !== this.cycle) {
        this.cycle = cyc; this.landed = false; this.released = false; this.Lt = null;
        if (this.live.length >= 8) { this.live.forEach(l => { l.disc.visible = false; l.halo.visible = false; }); this.live = []; }
        this.target = this.hits[(cyc * 7 + 3) % this.hits.length];
        this.trail.visible = false; this.tap.visible = false; this.ripple.visible = false;
        const tg = this.target; let best = 1e9;
        this.fielders.forEach(f => { const d = Math.hypot(f.home.x - tg.x, f.home.z - tg.z); if (d < best) { best = d; this.chaser = f; } });
      }
      const tg = this.target, P = this.pitcher, B = this.batter, K = this.coach, C = this.catcher, U = this.ump;
      const dur = 1.1 + tg.d / 350, Lend = 2.55 + dur;

      // pitcher: set → leg lift → stride → release (2.1) → follow-through → reset
      P.shR.rotation.x = track(tau, [[1.0, 0], [1.9, 2.6], [2.1, 0.6], [2.2, -1.2], [2.9, -1.0], [4.5, 0]]);
      P.shR.rotation.z = track(tau, [[1.0, 0], [1.9, -0.5], [2.2, 0.2], [4.5, 0]]);
      P.elR.rotation.x = track(tau, [[1.0, -0.3], [1.9, -1.4], [2.1, -0.6], [2.2, -0.1], [4.5, -0.3]]);
      P.shL.rotation.x = track(tau, [[1.0, -0.2], [1.6, -1.3], [2.1, -0.5], [2.3, 0.5], [4.5, -0.2]]);
      P.elL.rotation.x = track(tau, [[1.0, -0.9], [1.6, -0.9], [2.3, -0.3], [4.5, -0.9]]);
      P.hipL.rotation.x = track(tau, [[1.0, 0], [1.6, -1.6], [1.9, -1.3], [2.15, -0.35], [2.9, -0.25], [4.5, 0]]);
      P.kneeL.rotation.x = track(tau, [[1.0, .1], [1.6, 1.7], [2.15, 0.25], [4.5, .1]]);
      P.hipR.rotation.x = track(tau, [[1.9, 0], [2.25, 0.55], [2.9, 0.5], [4.5, 0]]);
      P.torso.rotation.x = track(tau, [[1.0, 0.05], [1.6, -0.2], [2.0, 0.1], [2.2, 0.7], [2.9, 0.6], [4.5, 0.05]]);
      P.torso.rotation.y = track(tau, [[1.0, 0], [1.9, 0.5], [2.2, -0.4], [4.5, 0]]);
      P.hips.rotation.y = track(tau, [[1.0, 0], [1.9, 0.3], [2.1, -0.3], [4.5, 0]]);
      P.root.position.z = -60.5 + track(tau, [[1.9, 0], [2.25, 3.0], [4.5, 3.0], [6.0, 0]]);
      P.root.position.y = .2 + track(tau, [[1.9, 0], [2.25, -0.35], [4.5, -0.3], [6.0, 0]]);

      // batter: stance (bat waggle) → load → swing (contact 2.55) → follow-through → reset
      const waggle = tau < 2.2 ? Math.sin(t * 2.2) * .08 : 0;
      B.torso.rotation.y = track(tau, [[2.2, 0], [2.45, -0.35], [2.56, 0.25], [2.85, 2.0], [3.4, 2.0], [4.8, 0]]);
      B.hips.rotation.y = track(tau, [[2.3, 0], [2.5, -0.1], [2.56, 0.5], [2.85, 1.2], [3.4, 1.2], [4.8, 0]]);
      B.shR.rotation.x = track(tau, [[2.45, -0.5], [2.57, -1.5], [2.85, -1.5], [4.8, -0.5]]) + waggle;
      B.elR.rotation.x = track(tau, [[2.45, -2.3], [2.57, -0.2], [2.85, -0.4], [4.8, -2.3]]);
      B.shR.rotation.z = track(tau, [[2.45, 0.45], [2.57, 0.15], [4.8, 0.45]]);
      B.shL.rotation.x = track(tau, [[2.45, -0.7], [2.57, -1.45], [2.85, -1.4], [4.8, -0.7]]) + waggle;
      B.elL.rotation.x = track(tau, [[2.45, -2.0], [2.57, -0.3], [2.85, -0.5], [4.8, -2.0]]);
      B.shL.rotation.z = -0.5;
      B.hipL.rotation.x = track(tau, [[2.25, -0.1], [2.45, -0.5], [2.57, -0.35], [4.8, -0.1]]);
      B.kneeL.rotation.x = .35; B.kneeR.rotation.x = .3; B.hipR.rotation.x = -.15;
      B.torso.rotation.x = .12;
      if (this.batters) this.atBat(tau, cyc);

      // ball
      const ball = this.ball;
      if (P.sync) P.sync(tau);
      if (tau < 2.1) { P.handR.getWorldPosition(ball.position); ball.visible = true; }
      else if (tau < 2.55) {
        if (!this.released) { this.released = true; P.handR.getWorldPosition(this.relPos); }
        const u = (tau - 2.1) / .45;
        ball.position.set(lerp(this.relPos.x, .3, u), lerp(this.relPos.y, 2.7, u) - 1.2 * u * u + 1.2 * u, lerp(this.relPos.z, .4, u)); ball.visible = true;
      } else {
        const u = Math.min(1, (tau - 2.55) / dur), peak = Math.max(6, tg.d * tg.lift * .9);
        const pos = (uu) => this.tmp.set(lerp(.3, tg.x, uu), lerp(2.7, .45, uu) + peak * 4 * uu * (1 - uu), lerp(.4, tg.z, uu));
        if (u < 1) { ball.position.copy(pos(u)); ball.visible = true; }
        else { ball.visible = false; if (!this.landed) { this.landed = true; this.Lt = tau; const slot = this.pool[this.live.length]; if (slot) { slot.disc.position.set(tg.x, .24, tg.z); slot.halo.position.set(tg.x, .21, tg.z); slot.disc.visible = slot.halo.visible = true; this.live.push({ ...slot, at: t }); } } }
        const arr = this.trail.geometry.attributes.position.array, N = 64;
        for (let k = 0; k <= N; k++) { const p = pos(u * k / N); arr[k * 3] = p.x; arr[k * 3 + 1] = p.y; arr[k * 3 + 2] = p.z; }
        this.trail.geometry.attributes.position.needsUpdate = true; this.trail.geometry.computeBoundingSphere();
        this.trail.visible = true; this.trail.material.opacity = tau < 7.0 ? .9 : Math.max(0, .9 * (1 - (tau - 7.0) / .8));
      }
      const ballOrLanding = ball.visible ? ball.position : this.tmp2.set(tg.x, 0, tg.z);
      // eyes: everyone watches the pitcher, then the ball
      const watch = tau < 2.1 ? P.head.getWorldPosition(this.tmp) : this.tmp.copy(ballOrLanding);
      const W8 = this.watchAt || (this.watchAt = watch.clone()); W8.copy(watch); if (!this.watchSet) { this.watchSet = true; const all = () => W8, rel = () => this.released ? W8 : null; [B, C, U, K, ...this.fielders.map(f => f.F), ...this.extras].forEach(f => { f.watch = all; }); P.watch = rel; }
      this.look(B, tau < 2.1 ? P.head.getWorldPosition(this.tmp) : watch, .2, 1.3);
      this.look(C, watch); this.look(U, watch); this.look(K, watch, .12);
      this.look(P, tau < 2.1 ? C.head.getWorldPosition(this.tmp) : watch, .15);
      [B, C, U, K, P].forEach(f => this.breathe(f, t));

      if (tau >= 2.5 && tau < 3.0) { const k = (tau - 2.5) / .5; this.contact.visible = true; this.contact.position.set(.3, .22, .4); this.contact.scale.setScalar(1 + 4 * k); this.contact.material.opacity = 1 - k; } else this.contact.visible = false;

      // fielders: ready stance, nearest one jogs toward the landing spot and back
      this.fielders.forEach((f, i) => {
        const F = f.F; this.breathe(F, t);
        let move = 0, run = 0;
        if (f === this.chaser) {
          move = track(tau, [[2.75, 0], [Lend + .4, 1], [6.0, 1], [7.7, 0]]);
          run = (tau > 2.75 && tau < Lend + .4) || (tau > 6.0 && tau < 7.7) ? 1 : 0;
        }
        const dx = tg.x - f.home.x, dz = tg.z - f.home.z, dd = Math.hypot(dx, dz), stop = Math.max(0, dd - 3) / (dd || 1);
        F.root.position.set(f.home.x + dx * stop * move, 0, f.home.z + dz * stop * move);
        const targetFace = run ? Math.atan2(move < 1 && tau < 6 ? dx : -dx, move < 1 && tau < 6 ? dz : -dz) : f.face;
        let dy = targetFace - F.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); F.root.rotation.y += dy * .12;
        const sw = Math.sin(t * 11 + i) * run; F.run = run;
        F.hipL.rotation.x = lerp(-.45, -.9 * sw, run); F.hipR.rotation.x = lerp(-.45, .9 * sw, run);
        F.kneeL.rotation.x = lerp(.7, .9 + .5 * Math.max(0, -sw), run); F.kneeR.rotation.x = lerp(.7, .9 + .5 * Math.max(0, sw), run);
        F.shL.rotation.x = lerp(-.35 + .05 * Math.sin(t * 1.3 + i), .8 * sw, run); F.shR.rotation.x = lerp(-.35, -.8 * sw, run);
        F.elL.rotation.x = lerp(-.6, -1.4, run); F.elR.rotation.x = lerp(-.6, -1.4, run);
        F.torso.rotation.x = lerp(.32, .22, run); F.hips.position.y = 2.95 + (run ? Math.abs(Math.sin(t * 11 + i)) * .18 : 0);
        this.look(F, watch, .15, 1.0);
      });

      // landing, record
      let rec = false;
      if (this.Lt !== null) {
        const k = Math.min(1, (tau - this.Lt) / .9);
        this.ripple.visible = k < 1; this.ripple.position.set(tg.x, .22, tg.z); this.ripple.scale.setScalar(1 + 26 * k); this.ripple.material.opacity = (1 - k) * .8;
        rec = tau >= this.Lt + .35 && tau < 7.2;
        this.tap.visible = rec; this.tap.position.set(tg.x, .22, tg.z);
        const dl = tau - this.Lt;
        K.shR.rotation.x = track(dl, [[.3, -0.3], [.6, -1.1], [.9, -1.0], [1.1, -1.15], [1.3, -1.0], [2.6, -1.0], [3.2, -0.3]]);
        K.elR.rotation.x = track(dl, [[.3, -0.4], [.6, -1.3], [.9, -1.15], [1.1, -1.35], [1.3, -1.15], [2.6, -1.15], [3.2, -0.4]]);
        if (dl > .5 && dl < 3.0) { const tp = K.handL.getWorldPosition(this.tmp); this.look(K, tp, .2); }
        const face = Math.atan2(tg.x - K.root.position.x, tg.z - K.root.position.z);
        this.coachFace += (face - this.coachFace) * .06;
      } else { K.shR.rotation.x = -0.3; K.elR.rotation.x = -0.4; this.coachFace += (Math.PI / 2 - this.coachFace) * .04; }
      K.root.rotation.y = this.coachFace;
      this.live.forEach(l => { const pop = Math.max(0, 1 - (t - l.at) / .45); l.disc.scale.setScalar(1 + 1.6 * pop); l.halo.scale.setScalar(1 + pop); });

      // camera: high-home close-up for the pitch, pulls back to the whole field for the flight and the record
      const R = this.rot;
      if (!R.drag) {
        R.yaw += R.vy; R.pitch = clamp(R.pitch + R.vp, -30, this.free ? 70 : 45); R.vy *= .94; R.vp *= .88;
        if (Math.abs(R.vy) < .003) R.vy = 0; if (Math.abs(R.vp) < .003) R.vp = 0;
      }
      if (R.home) {   // leaving the free mode: glide back to the page's framing
        R.zoom += (1 - R.zoom) * .12; R.pitch *= .88; R.panX *= .88; R.panZ *= .88;
        if (Math.abs(R.zoom - 1) < .005 && Math.abs(R.pitch) < .05 && Math.abs(R.panX) + Math.abs(R.panZ) < .05) { R.zoom = 1; R.pitch = R.panX = R.panZ = 0; R.home = false; }
      }
      const idle = this.free ? 0 : clamp((now - R.lastDrag - 900) / 2400, 0, 1);
      const sway = this.motion ? idle * 5 * Math.sin(el * .2) : 0;   // from the element's own start, so the first frame matches the still
      const wide = this.cam === 'close' ? 0 : this.free ? this.wideHeld : (this.wideHeld = track(tau, [[2.55, 0], [3.9, 1], [7.1, 1], [7.95, 0]]));   // the free mode holds the shot
      const nar = Math.max(0, 4 / 3 / this.camera.aspect - 1);   // 0 for a 4:3 box, ~.67 for the phone's 4:5: frame a little nearer home, look down more when wide
      this.camTarget.set(lerp(-1, 0, wide), lerp(3.5, 0, wide), lerp(-28 + 9 * nar, -140, wide));
      if (R.zoom > 1) this.camTarget.lerp(this.tmp.set(lerp(-1, 0, wide), lerp(3, 0, wide), lerp(3, -140, wide)), Math.min(1, R.zoom - 1));   // a zoom closes in on (and turns round) the players at the plate; the field's middle when wide
      let fx = 0, fz = 0;
      if (this.batters && wide < 1) {                      // the close shot turns to follow the runner up the line and comes back for the next batter
        const p = this.batters[cyc % 2].F.root.position, f = track(tau, [[3.1, 0], [4.4, 1], [7.35, 1], [7.95, 0]]) * (1 - wide);
        fx = (p.x - BOX[0]) * Math.min(1, .72 + .5 * nar) * f; fz = (p.z - BOX[1]) * .5 * f;   // a narrow phone frame follows all the way
      }
      this.camTarget.x += R.panX; this.camTarget.z += R.panZ;
      const rho = lerp(72, 500 * (1 + .9 * nar), wide) / R.zoom; this.panK = 2 * rho * Math.tan(this.camera.fov * D2R / 2) / this.camera.zoom / (this.clientHeight || 1);   // world units per px at the target
      const phi = clamp(lerp(15, 42 + 30 * nar, wide) + R.pitch, 5, 85) * D2R, theta = (R.yaw + sway) * D2R;
      this.camera.position.set(this.camTarget.x + rho * Math.sin(theta) * Math.cos(phi), this.camTarget.y + rho * Math.sin(phi), this.camTarget.z + rho * Math.cos(theta) * Math.cos(phi));
      this.camTarget.x += fx; this.camTarget.z += fz;   // a pan, not a truck: the camera stays behind the plate (sliding it along would walk it into the stands)
      this.camera.lookAt(this.camTarget);

      // ui
      const ph = tau < 2.55 ? 0 : rec ? 2 : 1;
      this.phEls.forEach((e, i) => { e.style.fontWeight = i === ph ? 800 : 300; });
      const pa = this.basePA + this.live.length, hits = this.baseHits + this.live.length;
      this.statEl.textContent = `타석 ${pa} · 안타 ${hits} · 타율 ${(hits / pa).toFixed(3).replace(/^0/, '')}`;
      if (rec) { const v = this.tmp.set(tg.x, .3, tg.z).project(this.camera); this.tagEl.style.left = ((v.x + 1) / 2 * this.clientWidth) + 'px'; this.tagEl.style.top = ((1 - v.y) / 2 * this.clientHeight) + 'px'; this.tagEl.textContent = this.tagFor(tg); this.tagEl.style.opacity = 1; }
      else this.tagEl.style.opacity = 0;

      (this.figs || (this.figs = [this.pitcher, this.batter, this.catcher, this.ump, this.coach, ...this.fielders.map(f => f.F), ...this.extras])).forEach(f => f.sync && f.sync(tau));
      this.renderer.render(this.scene, this.camera);
    }
  }
  if (!customElements.get('spray-play')) customElements.define('spray-play', SprayPlay);
})();
