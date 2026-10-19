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

  //@glbfig

  class SprayPlay extends HTMLElement {
    static get observedAttributes() { return ['hand', 'count', 'motion']; }
    constructor() {
      super();
      this.rot = { yaw: 0, pitch: 0, vy: 0, vp: 0, drag: false, lastDrag: -1e9, zoom: 1 };
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
      // finger turns the field and scrolling still works. Two fingers: spread / pinch = zoom, move up / down together = tilt.
      const pts = new Map(), two = () => { const [a, b] = pts.values(); return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, y: (a.y + b.y) / 2 }; };
      this.addEventListener('pointerdown', e => {
        const R = this.rot; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { this.setPointerCapture(e.pointerId); } catch (_) {}
        if (pts.size === 2) { const g = two(); R.drag = false; R.pinch = { d: g.d, y: g.y, z: R.zoom }; return; }
        R.drag = true; R.px = e.clientX; R.py = e.clientY; R.vy = 0; R.vp = 0; R.touch = e.pointerType === 'touch';
        this.style.cursor = 'grabbing';
      });
      this.addEventListener('pointermove', e => {
        const R = this.rot, p = pts.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY;
        if (R.pinch && pts.size >= 2) {
          const g = two(); R.zoom = clamp(R.pinch.z * g.d / R.pinch.d, .6, 3); R.pitch = clamp(R.pitch + (g.y - R.pinch.y) * .25, -30, 45); R.pinch.y = g.y;
          R.lastDrag = performance.now(); return;
        }
        if (!R.drag) return;
        const dx = e.clientX - R.px, dy = R.touch ? 0 : e.clientY - R.py; R.px = e.clientX; R.py = e.clientY;   // a finger's up / down is the page's scroll, not a tilt
        R.vy = -dx * 0.4; R.vp = dy * 0.25; R.yaw += R.vy; R.pitch = clamp(R.pitch + R.vp, -30, 45);
      });
      const up = e => {
        const R = this.rot; pts.delete(e.pointerId); if (pts.size < 2) R.pinch = null;
        if (pts.size === 1) { const [q] = pts.values(); R.drag = true; R.px = q.x; R.py = q.y; R.vy = R.vp = 0; return; }   // one finger left after a pinch: turn from here
        if (!R.drag) return; R.drag = false; R.lastDrag = performance.now(); this.style.cursor = 'grab';
      };
      this.addEventListener('pointerup', up); this.addEventListener('pointercancel', up);
      // pan-y would let the browser scroll the page with a two-finger vertical move (and cancel the pinch): keep two-finger moves here
      this.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
      const wait = document.createElement('div'); wait.textContent = '선수들 불러오는 중…';
      Object.assign(wait.style, { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: INK, opacity: .55 });
      this.append(wait); this.waitEl = wait;
      const start = () => three().then(T => loadBody(T).then(b => { BODY = b; }, err => console.warn('spray-play: realistic body unavailable, using mannequin', err)).then(() => this.init(T)))
        .catch(err => console.error('spray-play: three.js failed to load', err));
      if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '25% 0px' }); io.observe(this); }
      else start();
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
      if ('IntersectionObserver' in window) { this.io = new IntersectionObserver(es => { this.visible = es[0].isIntersecting; }, { rootMargin: '200px' }); this.io.observe(this); }
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
      const W8 = this.watchAt || (this.watchAt = watch.clone()); W8.copy(watch); if (!this.watchSet) { this.watchSet = true; const all = () => W8, rel = () => this.released ? W8 : null; [B, C, U, K, ...this.fielders.map(f => f.F)].forEach(f => { f.watch = all; }); P.watch = rel; }
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
        R.yaw += R.vy; R.pitch = clamp(R.pitch + R.vp, -30, 45); R.vy *= .94; R.vp *= .88;
        if (Math.abs(R.vy) < .003) R.vy = 0; if (Math.abs(R.vp) < .003) R.vp = 0;
      }
      const idle = clamp((now - R.lastDrag - 900) / 2400, 0, 1);
      const sway = this.motion ? idle * 5 * Math.sin(el * .2) : 0;   // from the element's own start, so the first frame matches the still
      const wide = this.cam === 'close' ? 0 : track(tau, [[2.55, 0], [3.9, 1], [7.1, 1], [7.95, 0]]);
      const nar = Math.max(0, 4 / 3 / this.camera.aspect - 1);   // 0 for a 4:3 box, ~.67 for the phone's 4:5: frame a little nearer home, look down more when wide
      this.camTarget.set(lerp(-1, 0, wide), lerp(3.5, 0, wide), lerp(-28 + 9 * nar, -140, wide));
      if (R.zoom > 1) this.camTarget.lerp(this.tmp.set(lerp(-1, 0, wide), lerp(3, 0, wide), lerp(3, -140, wide)), Math.min(1, R.zoom - 1));   // a zoom closes in on (and turns round) the players at the plate; the field's middle when wide
      const rho = lerp(72, 500 * (1 + .9 * nar), wide) / R.zoom, phi = clamp(lerp(15, 42 + 30 * nar, wide) + R.pitch, 5, 85) * D2R, theta = (R.yaw + sway) * D2R;
      this.camera.position.set(this.camTarget.x + rho * Math.sin(theta) * Math.cos(phi), this.camTarget.y + rho * Math.sin(phi), this.camTarget.z + rho * Math.cos(theta) * Math.cos(phi));
      this.camera.lookAt(this.camTarget);

      // ui
      const ph = tau < 2.55 ? 0 : rec ? 2 : 1;
      this.phEls.forEach((e, i) => { e.style.fontWeight = i === ph ? 800 : 300; });
      const pa = this.basePA + this.live.length, hits = this.baseHits + this.live.length;
      this.statEl.textContent = `타석 ${pa} · 안타 ${hits} · 타율 ${(hits / pa).toFixed(3).replace(/^0/, '')}`;
      if (rec) { const v = this.tmp.set(tg.x, .3, tg.z).project(this.camera); this.tagEl.style.left = ((v.x + 1) / 2 * this.clientWidth) + 'px'; this.tagEl.style.top = ((1 - v.y) / 2 * this.clientHeight) + 'px'; this.tagEl.textContent = this.tagFor(tg); this.tagEl.style.opacity = 1; }
      else this.tagEl.style.opacity = 0;

      (this.figs || (this.figs = [this.pitcher, this.batter, this.catcher, this.ump, this.coach, ...this.fielders.map(f => f.F)])).forEach(f => f.sync && f.sync(tau));
      this.renderer.render(this.scene, this.camera);
    }
  }
  if (!customElements.get('spray-play')) customElements.define('spray-play', SprayPlay);
})();
