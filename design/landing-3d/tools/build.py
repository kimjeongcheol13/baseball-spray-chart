# Rebuild the landing bundle: python3 tools/build.py source/SprayLab_Landing.orig.html src/glbfig.js SprayLab_Landing.glb.html
# Needs the player GLBs in assets/ (tools/pack_player.py) and harness/clips/clips_shared.json (harness/bake.html).
import sys, re, json, gzip, base64, uuid, os
src, figjs, out = sys.argv[1:4]
HERE = os.path.dirname(os.path.abspath(__file__))
J = os.path.join(HERE, '..', 'vendor', 'three-0.184.0', 'examples', 'jsm') + os.sep
ASSETS, CLIPDIR = os.path.join(HERE, '..', 'assets'), os.path.join(HERE, '..', 'harness', 'clips')
html = open(src, encoding='utf-8').read()
def block(kind):
    m = re.search(r'(<script type="__bundler/%s">)(.*?)(</script>)' % kind, html, re.S); return m
mt = block('template'); tpl = json.loads(mt.group(2))
def sub(s, a, b, n=1):
    c = s.count(a); assert c == n, (c, a[:80]); return s.replace(a, b)
# (1) remember the blob URL three.js was imported from, so the addons bind to the same module instance
tpl = sub(tpl, "  const THREE_URL = 'https://unpkg.com/three@0.184.0/build/three.module.js';\n",
               "  const THREE_URL = 'https://unpkg.com/three@0.184.0/build/three.module.js';\n  let threeModURL = THREE_URL;\n")
tpl = sub(tpl, "      return import(URL.createObjectURL(new Blob([mod], { type: 'text/javascript' })));",
               "      return import(threeModURL = URL.createObjectURL(new Blob([mod], { type: 'text/javascript' })));")
# (2)+(3) keep the procedural figure as the fallback, add the GLB figure + dispatcher
tpl = sub(tpl, "  function makeFigure(THREE, o) {", "  function makeMannequin(THREE, o) {")
new = open(figjs, encoding='utf-8').read().rstrip('\n')
new = '\n'.join(('  ' + l if l.strip() else l) for l in new.split('\n')) + '\n\n'
i = tpl.index('  class SprayPlay'); tpl = tpl[:i] + new + tpl[i:]
# (4) load the body before building the scene
tpl = sub(tpl, "      three().then(T => this.init(T)).catch(err => console.error('spray-play: three.js failed to load', err));",
               "      three().then(T => loadBody(T).then(b => { BODY = b; }, err => console.warn('spray-play: realistic body unavailable, using mannequin', err)).then(() => this.init(T)))\n        .catch(err => console.error('spray-play: three.js failed to load', err));")
# (5) pitcher's bones must be current before the ball is read from his hand
tpl = sub(tpl, "      if (tau < 2.1) { P.handR.getWorldPosition(ball.position); ball.visible = true; }",
               "      if (P.sync) P.sync(tau);\n      if (tau < 2.1) { P.handR.getWorldPosition(ball.position); ball.visible = true; }")
# (6) copy every figure's proxy pose onto its bones right before drawing
tpl = sub(tpl, "      this.renderer.render(this.scene, this.camera);",
               "      (this.figs || (this.figs = [this.pitcher, this.batter, this.catcher, this.ump, this.coach, ...this.fielders.map(f => f.F)])).forEach(f => f.sync && f.sync(tau));\n      this.renderer.render(this.scene, this.camera);")
# ball was sized for the mannequin; next to a real-scale body it reads as a volleyball (regulation ball ~7.4 cm)
tpl = sub(tpl, "this.ball.castShadow = true; scene.add(this.ball);", "this.ball.castShadow = true; scene.add(this.ball); if (BODY) this.ball.scale.setScalar(.3);")
# roles let the GLB figures pick their baked Mixamo motion
for who, role in (('pitcher', 'pitcher'), ('batter', 'batter'), ('catcher', 'catcher'), ('ump', 'ump'), ('coach', 'coach')):
    tpl = sub(tpl, "this.%s = makeFigure(THREE, { " % who, "this.%s = makeFigure(THREE, { role: '%s', " % (who, role))
tpl = sub(tpl, "const F = makeFigure(THREE, { kit: AWAY,", "const F = makeFigure(THREE, { role: 'fielder', kit: AWAY,")
# gloves: a shaped glove / catcher's mitt (makeGlove in glbfig.js) instead of the mannequin's leather ball
tpl = sub(tpl, "const glove = (fig, r) => { const g = new THREE.Group(); g.position.y = -.1; fig.handL.add(g); const a = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), fig.mats.leather); a.scale.set(1, 1.15, .55); a.castShadow = true; g.add(a); const th = new THREE.Mesh(new THREE.SphereGeometry(r * .45, 10, 8), fig.mats.leather); th.position.set(r * .8, -r * .2, 0); th.castShadow = true; g.add(th); };",
               "const glove = (fig, r) => fig.handL.add(makeGlove(THREE, r, r > .5));")
# heads: the GLB bodies turn toward the point the page has everyone watching (pitcher: once the ball is released)
tpl = sub(tpl, "      const watch = tau < 2.1 ? P.head.getWorldPosition(this.tmp) : this.tmp.copy(ballOrLanding);",
               "      const watch = tau < 2.1 ? P.head.getWorldPosition(this.tmp) : this.tmp.copy(ballOrLanding);\n"
               "      const W8 = this.watchAt || (this.watchAt = watch.clone()); W8.copy(watch); if (!this.watchSet) { this.watchSet = true; const all = () => W8, rel = () => this.released ? W8 : null; [B, C, U, K, ...this.fielders.map(f => f.F)].forEach(f => { f.watch = all; }); P.watch = rel; }")
# fielders: tell the GLB body when the page has this fielder running
tpl = sub(tpl, "        const sw = Math.sin(t * 11 + i) * run;", "        const sw = Math.sin(t * 11 + i) * run; F.run = run;")
# resources: body + three.js addons, gzip+base64 like the rest of the manifest
mm = block('manifest'); manifest = json.loads(mm.group(2))
me = block('ext_resources'); ext = json.loads(me.group(2))
PLAYERS = ('player', 'player_helmet2', 'player_cap', 'player_cap2', 'player_cap3')   # must match HELMETS + CAPS in src/glbfig.js
add = [(n + '.glb', os.path.join(ASSETS, n + '.glb'), 'model/gltf-binary') for n in PLAYERS] + [('clips_shared.json', os.path.join(CLIPDIR, 'clips_shared.json'), 'application/json'), ('GLTFLoader', J + 'loaders/GLTFLoader.js', 'text/javascript'),
       ('BufferGeometryUtils', J + 'utils/BufferGeometryUtils.js', 'text/javascript'), ('SkeletonUtils', J + 'utils/SkeletonUtils.js', 'text/javascript')]
for rid, path, mime in add:
    u = str(uuid.uuid5(uuid.NAMESPACE_URL, 'spraylab-landing-3d/' + rid)); raw = open(path, 'rb').read()
    manifest[u] = {'mime': mime, 'compressed': True, 'data': base64.b64encode(gzip.compress(raw, 9, mtime=0)).decode()}
    ext.append({'id': rid, 'uuid': u}); print(f'+ {rid:20s} {len(raw)/1e3:8.1f} KB raw')
enc = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</script', '<\\/script')
# rebuild from the end so earlier offsets stay valid
parts = sorted([(mt, json.dumps(tpl, ensure_ascii=False).replace('</script', '<\\/script')), (mm, enc(manifest)), (me, enc(ext))], key=lambda p: -p[0].start(2))
for m, txt in parts: html = html[:m.start(2)] + txt + html[m.end(2):]
open(out, 'w', encoding='utf-8').write(html)
print('out bytes', len(html.encode()) / 1e6, 'MB')
