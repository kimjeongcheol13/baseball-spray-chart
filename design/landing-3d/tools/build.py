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
# (4) load the body before building the scene -- and only once the section is about to come into view (the players and
#     their motion are ~9 MB; the 3D section starts just under the first screen, so this waits for the first scroll)
tpl = sub(tpl, "      three().then(T => this.init(T)).catch(err => console.error('spray-play: three.js failed to load', err));",
               "      const wait = document.createElement('div'); wait.textContent = '선수들 불러오는 중…';\n"
               "      Object.assign(wait.style, { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: INK, opacity: .55 });\n"
               "      this.append(wait); this.waitEl = wait;\n"
               "      const start = () => three().then(T => loadBody(T).then(b => { BODY = b; }, err => console.warn('spray-play: realistic body unavailable, using mannequin', err)).then(() => this.init(T)))\n"
               "        .catch(err => console.error('spray-play: three.js failed to load', err));\n"
               "      if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '25% 0px' }); io.observe(this); }\n"
               "      else start();")
tpl = sub(tpl, "      this.T = THREE;\n", "      this.T = THREE; if (this.waitEl) this.waitEl.remove();\n")
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
# gloves: a shaped glove / catcher's mitt round the real hand (fig.addGlove in glbfig.js); the mannequin fallback keeps a leather ball
# bat: real size, turned from a profile (makeBat in glbfig.js)
tpl = sub(tpl, "      const bat = new THREE.Group(); bat.position.y = -1.3; B.handR.add(bat);\n"
               "      const wood = new THREE.MeshStandardMaterial({ color: 0xB8894F, roughness: .45 });\n"
               "      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.17, .1, 2.3, 16), wood); barrel.position.y = -.35; barrel.castShadow = true; bat.add(barrel);\n"
               "      const grip = new THREE.Mesh(new THREE.CylinderGeometry(.1, .11, .95, 12), new THREE.MeshStandardMaterial({ color: 0x15151A, roughness: .95 })); grip.position.y = 1.25; grip.castShadow = true; bat.add(grip);\n"
               "      const knob = new THREE.Mesh(new THREE.CylinderGeometry(.16, .13, .1, 12), wood); knob.position.y = 1.75; bat.add(knob);\n",
               "      B.handR.add(makeBat(THREE));\n")
tpl = sub(tpl, "const glove = (fig, r) => { const g = new THREE.Group(); g.position.y = -.1; fig.handL.add(g); const a = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), fig.mats.leather); a.scale.set(1, 1.15, .55); a.castShadow = true; g.add(a); const th = new THREE.Mesh(new THREE.SphereGeometry(r * .45, 10, 8), fig.mats.leather); th.position.set(r * .8, -r * .2, 0); th.castShadow = true; g.add(th); };",
               "const glove = (fig, r) => { if (fig.addGlove) return fig.addGlove(r > .5); const g = new THREE.Group(); g.position.y = -.1; fig.handL.add(g); const a = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), fig.mats.leather); a.scale.set(1, 1.15, .55); a.castShadow = true; g.add(a); };")
# heads: the GLB bodies turn toward the point the page has everyone watching (pitcher: once the ball is released)
tpl = sub(tpl, "      const watch = tau < 2.1 ? P.head.getWorldPosition(this.tmp) : this.tmp.copy(ballOrLanding);",
               "      const watch = tau < 2.1 ? P.head.getWorldPosition(this.tmp) : this.tmp.copy(ballOrLanding);\n"
               "      const W8 = this.watchAt || (this.watchAt = watch.clone()); W8.copy(watch); if (!this.watchSet) { this.watchSet = true; const all = () => W8, rel = () => this.released ? W8 : null; [B, C, U, K, ...this.fielders.map(f => f.F)].forEach(f => { f.watch = all; }); P.watch = rel; }")
# fielders: tell the GLB body when the page has this fielder running
tpl = sub(tpl, "        const sw = Math.sin(t * 11 + i) * run;", "        const sw = Math.sin(t * 11 + i) * run; F.run = run;")
# ---- scorebook theme (2026-10-17): the landing wears the app's paper / ink / pen look (css/paper.css) ----
# Content first: the hero's words and button, the 3D caption, one sample player's numbers everywhere, the three
# features, three steps with real app screens (no fake video); then the colour map and the fonts at the end.
APP = 'https://kimjeongcheol13.github.io/baseball-spray-chart/'
PAPER, PAPER2, INKC, SOFT, RULE, PEN = '#F3EDDF', '#FBF7EE', '#1F2A23', '#55605A', '#C9BFA9', '#C8322B'
BOX = 'box-sizing:border-box;background:%s;border:1.5px solid %s;border-radius:0' % (PAPER2, INKC)   # the app's card: a ruled box, no shadow
NUM = "font-family:'Oswald','Noto Sans KR',sans-serif;font-variant-numeric:tabular-nums"
BTN = "font-family:'Noto Sans KR',sans-serif;font-weight:700"
SCREENS = ('app_record.jpg', 'app_team.jpg', 'export_report.jpg')   # assets/screens/: the app in its sample-data mode (375 px at 2x) and the player report it exports
rid_uuid = lambda rid: str(uuid.uuid5(uuid.NAMESPACE_URL, 'spraylab-landing-3d/' + rid))
def region(s, start, end, new):           # replace from `start` through the first `end` after it (`start` exactly once)
    assert s.count(start) == 1, (s.count(start), start[:60]); i = s.index(start); j = s.index(end, i) + len(end); return s[:i] + new + s[j:]
# every number on the page belongs to one sample player: 김민준 (#8, 좌타, js/sample.js), 3 games, 15 PA, as the app computes him
KM = dict(avg='.333', obp='.467', slg='.583', ops='1.050', woba='.451', iso='.250', pull=36, ctr=36, oppo=27, bip=11)

# text: body 15px light -> 17px regular, the small spaced labels 11px light -> 13px, compare table 15 -> 17px (before anything moves)
tpl = sub(tpl, 'font-size:15px;line-height:1.7;font-weight:300', 'font-size:17px;line-height:1.7;font-weight:400', 10)
tpl = sub(tpl, 'font-size:15px;font-weight:300;line-height:1"', 'font-size:16px;font-weight:500;line-height:1"', 16)
tpl = sub(tpl, 'display:flex;flex-direction:column;font-size:15px;line-height:1.5', 'display:flex;flex-direction:column;font-size:17px;line-height:1.5', 2)
tpl = sub(tpl, '<div style="font-weight:300">', '<div style="font-weight:400">', 21)
small = lambda m: m.group(0).replace('font-size:11px;letter-spacing:.12em', 'font-size:13px;letter-spacing:.06em').replace('font-weight:300', 'font-weight:400')
tpl, n = re.subn(r'style="[^"]*font-size:11px;letter-spacing:\.12em[^"]*"(?!>(?:Desktop|Mobile) · )', small, tpl); assert n >= 20, n   # not the design-canvas labels unbundle.py drops
tpl = sub(tpl, "fontSize: '11px', letterSpacing: '.12em', fontWeight: 300, color: INK", "fontSize: '13px', letterSpacing: '.04em', fontWeight: 400, color: INK, fontFamily: \"'Oswald','Noto Sans KR',sans-serif\"")

# 1) first screen on paper: one line that adds information + the button (the only button used to be at the very bottom)
for lab, h in (('D1', 900), ('M1', 844)):
    tpl = sub(tpl, 'data-screen-label="%s Hero" style="position:relative;height:%dpx;background:#0E0F14;color:#E7E3DC;overflow:hidden"' % (lab, h),
                   'data-screen-label="%s Hero" style="position:relative;height:%dpx;background:%s;color:%s;overflow:hidden"' % (lab, h, PAPER, INKC))
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" dark="{{ true }}" dot="{{ 2.5 }}"', '<dc-import name="SprayChart" count="{{ 120 }}" dark="{{ false }}" dot="{{ 2.5 }}"')
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" dark="{{ true }}" dot="{{ 7 }}"', '<dc-import name="SprayChart" count="{{ 120 }}" dark="{{ false }}" dot="{{ 7 }}"')
tpl = sub(tpl, 'style="position:absolute;left:260px;top:-40px;width:1500px;height:1125px"></dc-import>',   # off the words, and paper fades in under them
               'style="position:absolute;left:400px;top:0;width:1400px;height:1050px"></dc-import>\n'
               '      <div style="position:absolute;inset:0;background:linear-gradient(90deg,%s 0%%,%s 34%%,rgba(243,237,223,0) 60%%);pointer-events:none"></div>' % (PAPER, PAPER))
tpl = sub(tpl, 'style="position:absolute;left:-40px;top:330px;width:680px;height:510px"', 'style="position:absolute;left:-40px;top:380px;width:680px;height:510px"')
tpl = sub(tpl, 'border:1px solid #E7E3DC"></div>장타', 'border:1px solid %s"></div>장타' % INKC, 2)
tpl = sub(tpl, 'border:1px solid rgba(231,227,220,.45)"></div>아웃', 'border:1px solid %s"></div>아웃' % INKC, 2)
SUB = '사회인야구 코치가 더그아웃에서 탭 한 번. 타구 위치부터 타율·OPS·방향 분포까지 자동으로 남는다.'
cta = lambda h, px: '<a href="#" data-cta="hero" style="display:inline-flex;align-items:center;height:%dpx;padding:0 %dpx;background:%s;color:%s;font-size:16px;%s">차트 열기</a>' % (h, px, INKC, PAPER, BTN)
tpl = sub(tpl, '        <div>차트가 그려진다.</div>\n      </div>\n      <div style="position:absolute;left:0;right:0;bottom:32px;',
               '        <div>차트가 그려진다.</div>\n      </div>\n'
               '      <div style="position:absolute;left:40px;top:432px;max-width:600px;display:flex;flex-direction:column;align-items:flex-start;gap:28px">\n'
               '        <div style="font-size:20px;line-height:1.7;word-break:keep-all">' + SUB + '</div>\n'
               '        <div style="display:flex;align-items:center;gap:20px">' + cta(56, 40) + '<div style="font-size:14px;letter-spacing:.04em;color:%s">무료 · 가입 없음 · 설치 없음</div></div>\n' % SOFT +
               '      </div>\n      <div style="position:absolute;left:0;right:0;bottom:32px;')
tpl = sub(tpl, '        <div>차트가 그려진다.</div>\n      </div>\n      <div style="position:absolute;left:0;right:0;bottom:24px;',
               '        <div>차트가 그려진다.</div>\n      </div>\n'
               '      <div style="position:absolute;left:20px;right:20px;top:262px;display:flex;flex-direction:column;align-items:flex-start;gap:18px">\n'
               '        <div style="font-size:16px;line-height:1.7;word-break:keep-all">' + SUB + '</div>\n'
               '        <div style="display:flex;align-items:center;gap:14px">' + cta(52, 30) + '<div style="font-size:13px;letter-spacing:.04em;color:%s">무료 · 가입 없음</div></div>\n' % SOFT +
               '      </div>\n      <div style="position:absolute;left:0;right:0;bottom:24px;')
tpl, n = re.subn(r'      <div style="position:absolute;left:0;right:0;bottom:\d+px;text-align:center;[^"]*">Scroll ↓</div>\n', '', tpl); assert n == 2, n   # the button invites now
PILL = '<a href="#" data-cta="nav"><span style="display:inline-flex;align-items:center;height:36px;padding:0 16px;border:1.5px solid currentColor;letter-spacing:.02em;%s">차트 열기</span></a>' % BTN
tpl = sub(tpl, '<a href="#d-cta">차트 열기</a>', PILL)
tpl = sub(tpl, '<a href="#m-cta">차트 열기</a>', PILL)

# 2) the 3D play: one sentence, and its live counter says it counts this game (not the sample player)
tpl = sub(tpl, '투수가 던지고 타자가 친다. 공이 떨어진 자리를 더그아웃의 코치가 한 번 탭하면 그 타석이 그대로 차트에 남는다. 필드를 잡고 돌려볼 수 있다.',
               '공이 떨어진 자리를 코치가 한 번 탭하면 그 타석이 그대로 차트에 남는다. 필드를 잡고 돌려볼 수 있다.', 2)
tpl = sub(tpl, "this.statEl.textContent = `타석 ${pa} · 안타 ${hits} · 타율", "this.statEl.textContent = `이번 경기 · 타석 ${pa} · 안타 ${hits} · 타율")
# phones: the 3D box was 342x256 (players a few px tall); a 4:5 box keeps the camera's vertical view, so the close-up gets
# ~1.7x bigger; the wide shot backs off and looks down more so the whole field still fits the narrower box
tpl = sub(tpl, 'hint-size="342px,256px" style="width:342px;height:428px"></x-import>' if False else 'hint-size="342px,256px" style="width:342px;height:256px"></x-import>', 'hint-size="342px,428px" style="width:342px;height:428px"></x-import>')
tpl = sub(tpl, "      this.camTarget.set(lerp(-1, 0, wide), lerp(3.5, 0, wide), lerp(-28, -140, wide));\n"
               "      const rho = lerp(72, 500, wide), phi = clamp(lerp(15, 42, wide) + R.pitch, 5, 85) * D2R,",
               "      const nar = Math.max(0, 4 / 3 / this.camera.aspect - 1);   // 0 for a 4:3 box, ~.67 for the phone's 4:5: frame a little nearer home, look down more when wide\n"
               "      this.camTarget.set(lerp(-1, 0, wide), lerp(3.5, 0, wide), lerp(-28 + 9 * nar, -140, wide));\n"
               "      const rho = lerp(72, 500 * (1 + .9 * nar), wide), phi = clamp(lerp(15, 42 + 30 * nar, wide) + R.pitch, 5, 85) * D2R,")

# 3) the scrolling numbers are the sample player's season (they were .500 / .341 / 56% from nowhere)
tpl = sub(tpl, 'tabular-nums">.500</div>', 'tabular-nums">%s</div>' % KM['avg'], 2)
tpl = sub(tpl, 'tabular-nums">.341</div>', 'tabular-nums">%s</div>' % KM['ops'], 2)
tpl = sub(tpl, 'line-height:1">wOBA</div>', 'line-height:1">OPS</div>', 2)
tpl = sub(tpl, 'tabular-nums">56%</div>', 'tabular-nums">%d%%</div>' % KM['pull'], 2)
tpl = sub(tpl, '{{ sceneLabelD }}', '김민준 · 시즌 15타석 · {{ sceneLabelD }}')
tpl = sub(tpl, '{{ sceneLabelM }}', '김민준 · 시즌 15타석 · {{ sceneLabelM }}')

# 4) features: 자동 계산 -> his season line in a ruled box (OPS = OBP + SLG, ISO = SLG - AVG as batdata.js computes them);
#    방향 분포 -> the chart plus his pull / centre / opposite split; 공유 QR -> a real QR that opens the app
def statbox(big):
    pad, px = ('18px 20px', 44) if big else ('12px 14px', 30)
    cell = lambda i, k, v: ('<div style="padding:%s;border-top:1.5px solid %s;%s"><div style="font-size:12px;letter-spacing:.14em;color:%s;font-family:\'Oswald\',sans-serif;font-weight:600">%s</div>'
                            '<div style="font-size:%dpx;line-height:1.1;font-weight:500;%s">%s</div></div>') % (pad, INKC, 'border-left:1.5px solid %s' % INKC if i % 3 else '', SOFT, k, px, NUM, v)
    cells = ''.join(cell(i, k, v) for i, (k, v) in enumerate((('AVG', KM['avg']), ('OBP', KM['obp']), ('SLG', KM['slg']), ('OPS', KM['ops']), ('wOBA', KM['woba']), ('ISO', KM['iso']))))
    return ('<div style="%s;%swidth:%dpx">' % (BOX, 'justify-self:center;' if big else '', 560 if big else 342)
            + '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:%s"><div style="font-size:%dpx;font-weight:700">김민준 <span style="font-weight:400;color:%s">#8 · 좌타</span></div>'
              '<div style="font-size:12px;letter-spacing:.14em;color:%s;font-family:\'Oswald\',\'Noto Sans KR\',sans-serif;font-weight:600">시즌 · 15타석</div></div>' % ('16px 20px' if big else '12px 14px', 20 if big else 17, SOFT, SOFT)
            + '<div style="display:grid;grid-template-columns:repeat(3,1fr)">%s</div>' % cells
            + '<div style="padding:%s;border-top:1.5px solid %s;font-size:14px;line-height:1.6;color:%s">OPS = 출루율 + 장타율, ISO = 장타율 − 타율. 타석을 기록할 때마다 다시 계산된다.</div></div>' % ('14px 20px' if big else '12px 14px', INKC, SOFT))
def dirbar(w):
    lab = lambda p, t: '<span><b style="font-weight:500;font-size:17px;%s">%d%%</b> %s</span>' % (NUM, p, t)
    return ('<div style="display:flex;flex-direction:column;gap:12px;width:%dpx">' % w
            + '<div style="display:flex;height:14px;border:1.5px solid %s;background:%s"><div style="width:%d%%;background:%s"></div><div style="width:%d%%;background:%s"></div><div style="flex:1;background:%s"></div></div>' % (INKC, PAPER2, KM['pull'], PEN, KM['ctr'], INKC, RULE)
            + '<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:15px;gap:12px;white-space:nowrap">' + lab(KM['pull'], '당겨치기') + lab(KM['ctr'], '센터') + lab(KM['oppo'], '밀어치기') + '</div>'
            + '<div style="font-size:13px;color:%s;text-align:right">김민준 · 인플레이 타구 %d개 기준</div></div>' % (SOFT, KM['bip']))
import qrcode, qrcode.image.svg
qr = qrcode.make(APP, image_factory=qrcode.image.svg.SvgPathImage, border=0).to_string(encoding='unicode')
qr = re.sub(r'width="[^"]*" height="[^"]*"', 'width="100%" height="100%" shape-rendering="crispEdges"', qr, count=1).replace('<path ', '<path fill="%s" ' % INKC, 1)
def qrbox(big):
    side = 200 if big else 160
    return ('<div style="%s;%swidth:%dpx;padding:%s;display:flex;%sgap:%dpx">' % (BOX, 'justify-self:center;' if big else '', 560 if big else 342, '28px' if big else '20px', 'align-items:center;' if big else 'flex-direction:column;', 32 if big else 20)
            + '<div style="flex:none;box-sizing:border-box;width:%dpx;height:%dpx;background:#fff;border:1.5px solid %s;padding:12px">%s</div>' % (side, side, INKC, qr)
            + '<div style="display:flex;flex-direction:column;gap:10px"><div style="font-size:%dpx;font-weight:700;line-height:1.4">휴대폰 카메라로<br>찍어 보세요</div>' % (20 if big else 17)
            + '<div style="font-size:15px;line-height:1.7;color:%s">이 QR은 실제로 SprayLab을 연다. 팀원에게 기록을 넘길 때도 QR 하나면 된다.</div></div></div>' % SOFT)
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 20 }}" hint-size="560px,420px" style="width:560px;height:420px;justify-self:center"></dc-import>', statbox(True))
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" dot="{{ 9 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 14 }}" hint-size="342px,256px" style="width:342px;height:256px"></dc-import>', statbox(False))
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 4 }}" hint-size="560px,420px" style="width:560px;height:420px;justify-self:center"></dc-import>',
               '<div style="justify-self:center;display:flex;flex-direction:column;align-items:center;gap:8px"><dc-import name="SprayChart" count="{{ 120 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 4 }}" hint-size="560px,420px" style="width:560px;height:420px"></dc-import>' + dirbar(480) + '</div>')
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" dot="{{ 9 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 21 }}" hint-size="342px,256px" style="width:342px;height:256px"></dc-import>',
               '<dc-import name="SprayChart" count="{{ 120 }}" dot="{{ 9 }}" zoom="{{ 1 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 21 }}" hint-size="342px,256px" style="width:342px;height:256px"></dc-import>' + dirbar(342))
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 60 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 11 }}" hint-size="560px,420px" style="width:560px;height:420px;justify-self:center"></dc-import>', qrbox(True))
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 60 }}" dot="{{ 9 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 5 }}" hint-size="342px,256px" style="width:342px;height:256px"></dc-import>', qrbox(False))
# phones: the other 342 px charts drew wider than their box (the fan's left edge fell off the screen): zoom 1.3 -> 1
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ sceneCountM }}" dot="{{ 7 }}"', '<dc-import name="SprayChart" count="{{ sceneCountM }}" dot="{{ 7 }}" zoom="{{ 1 }}"')
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" dark="{{ true }}" dot="{{ 9 }}" glow', '<dc-import name="SprayChart" count="{{ 120 }}" dark="{{ true }}" dot="{{ 9 }}" zoom="{{ 1 }}" glow')

# 5) the number strip (5 / 3 / 25 / 1 with no units) and the fake video become one section: three steps, each with a real
#    screen of the app (sample-data mode, 375 px at 2x) and, for 공유, the player report the app exports
STEPS = (('01', '기록', '공이 떨어진 자리를 탭한다. 타순표에서 타자를 고르면 끝.', 'app_record.jpg', '기록 화면'),
         ('02', '분석', '타율·OPS·wOBA, 선수 순위, 경기 흐름이 바로 계산된다.', 'app_team.jpg', '팀 대시보드'),
         ('03', '공유', '선수 리포트 PNG, 차트 이미지, QR 링크로 팀원에게.', 'export_report.jpg', '앱이 내보낸 선수 리포트'))
def step(n, t, c, f, alt, w):
    return ('<div style="%sdisplay:flex;flex-direction:column;gap:20px">' % ('flex:none;width:%dpx;scroll-snap-align:start;' % w if w else '')
            + '<div style="display:flex;align-items:baseline;gap:14px"><span style="font-size:40px;line-height:1;font-weight:500;color:%s;%s">%s</span><span style="font-size:26px;line-height:1;font-family:\'Black Han Sans\',sans-serif">%s</span></div>' % (PEN, NUM, n, t)
            + '<div style="font-size:16px;line-height:1.7;color:%s;min-height:3.4em">%s</div>' % (SOFT, c)
            + '<img src="%s" alt="SprayLab %s" loading="lazy" style="width:100%%;height:auto;display:block;border:1.5px solid %s;background:%s">' % (rid_uuid(f), alt, INKC, PAPER2) + '</div>')
head2 = lambda px: '<div style="font-size:%dpx;line-height:1;letter-spacing:-.03em;font-weight:300;word-break:keep-all"><div style="font-weight:800">세 단계면</div><div>끝난다.</div></div>' % px
note2 = '가상 선수 9명 · 3경기 샘플로 찍은 실제 화면이다. 앱에서 &quot;샘플 데이터로 둘러보기&quot;를 누르면 똑같이 볼 수 있다.'
tpl = region(tpl, '<section id="d-demo" data-screen-label="D7 Video"', '</section>\n', '')
tpl = region(tpl, '<section id="m-demo" data-screen-label="M7 Video"', '</section>\n', '')
tpl = region(tpl, '<section data-screen-label="D5 Carousel"', '</section>',
             '<section id="d-demo" data-screen-label="D5 Steps" style="background:%s;padding:160px 120px;display:flex;flex-direction:column;gap:80px">' % PAPER2
             + '<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:80px;align-items:end">' + head2(64) + '<div style="justify-self:end;font-size:17px;line-height:1.7;max-width:36em;color:%s">%s</div></div>' % (SOFT, note2)
             + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:48px">' + ''.join(step(*s, 0) for s in STEPS) + '</div></section>')
tpl = region(tpl, '<section data-screen-label="M5 Carousel"', '</section>',
             '<section id="m-demo" data-screen-label="M5 Steps" style="background:%s;padding:96px 24px;display:flex;flex-direction:column;gap:40px">' % PAPER2
             + head2(40) + '<div style="font-size:16px;line-height:1.7;color:%s">%s</div>' % (SOFT, note2)
             + '<div style="display:flex;gap:20px;overflow-x:auto;scrollbar-width:none;scroll-snap-type:x mandatory;margin:0 -24px;padding:0 24px;scroll-padding-left:24px">' + ''.join(step(*s, 260) for s in STEPS) + '</div></section>')

# 6) the bottom button in the same ink; footer Instagram
tpl = sub(tpl, 'border-radius:28px;background:#0B0B0E;color:#E7E3DC;font-size:15px;font-weight:700">차트 열기</a>', 'border-radius:0;background:%s;color:%s;font-size:16px;%s">차트 열기</a>' % (INKC, PAPER, BTN), 2)
tpl = sub(tpl, '<a href="#">Instagram</a>', '<a href="https://www.instagram.com/spraylab2026/" target="_blank" rel="noopener">Instagram</a>', 2)

# 7) fonts and taps. The app's three families (Gowun Batang text, Black Han Sans display lines, Oswald numbers and small
#    caps) come from Google Fonts (unbundle.py / pagebundle.py add the <link>); the bundled Pretendard CSS goes.
tpl, n = re.subn(r"@font-face\{[^}]*'Pretendard Variable'[^}]*\}", '', tpl); assert n >= 90, n
tpl = re.sub(r'/\*\*\n \* Minified by jsDelivr.*?\*/\n', '', tpl, count=1, flags=re.S)
tpl = tpl.replace("'Pretendard Variable',Pretendard,sans-serif", "'Gowun Batang','Nanum Myeongjo',serif").replace("'Pretendard Variable'", "'Gowun Batang','Nanum Myeongjo',serif")
tpl = sub(tpl, 'body{margin:0;background:#C6C1B8}',
          'body{margin:0;background:#C6C1B8}\n'
          "#desktop,#mobile{font-family:'Gowun Batang','Nanum Myeongjo',serif;background-image:radial-gradient(#D9CFB8 1px,transparent 1px);background-size:18px 18px}\n"
          # the runtime re-serialises inline styles with a space after the colon, so both spellings are matched
          "#sl-page [style*=\"font-weight:800\"],#sl-page [style*=\"font-weight: 800\"]{font-family:'Black Han Sans',sans-serif;font-weight:400!important;letter-spacing:0!important}\n"
          "#sl-page [style*=\"tabular-nums\"]{font-family:'Oswald','Noto Sans KR',sans-serif;font-weight:500}\n"
          "#sl-page [style*=\"text-transform:uppercase\"],#sl-page [style*=\"text-transform: uppercase\"]{font-family:'Oswald','Noto Sans KR',sans-serif;font-weight:500;letter-spacing:.14em}\n"
          'nav a,footer a{display:inline-flex;align-items:center;justify-content:center;min-width:48px;min-height:48px}\n'   # 44 on screen: the phone board is drawn at ~0.96
          'nav{grid-template-columns:auto 1fr auto!important}nav>div:nth-child(2){justify-self:center}\n'
          'nav>div:first-child{gap:0!important}nav>div:first-child>span{display:none}')

# 8) colours: beige -> paper, near-black -> ink, red -> pen red, hairlines -> rule; the 3D field slab, mound and screen too
for a, b in (('#E7E3DC', PAPER), ('#0E0F14', INKC), ('#0B0B0E', INKC), ('#E0343F', PEN), ('#DAD5CC', PAPER2), ('#15161C', INKC),
             ('rgba(11,11,14,.12)', RULE), ('rgba(231,227,220,.55)', 'rgba(243,237,223,.55)'), ('rgba(231,227,220,.45)', 'rgba(243,237,223,.45)'), ('rgba(231,227,220,.25)', 'rgba(243,237,223,.25)'),
             ('RED = 0xE0343F', 'RED = 0xC8322B'), ('color: 0xDAD5CC', 'color: 0xEAE2CF'), ('color: 0xBDB8AF', 'color: 0xC9BFA9'), ('color: 0xD0CBC2', 'color: 0xD3A670'), ('color: 0xE7E3DC', 'color: 0xF3EDDF')):
    tpl = tpl.replace(a, b)

# resources: body + three.js addons + the app screens, gzip+base64 like the rest of the manifest
mm = block('manifest'); manifest = json.loads(mm.group(2))
me = block('ext_resources'); ext = json.loads(me.group(2))
# the chart component is a bundled resource: give it the same paper / ink / pen palette (its light mode is the page's default now)
_sc = next(e['uuid'] for e in ext if e['id'] == './SprayChart.dc.html'); _m = manifest[_sc]
_raw = base64.b64decode(_m['data']); _raw = gzip.decompress(_raw) if _m.get('compressed') else _raw; _txt = _raw.decode('utf-8')
for a, b in (('#E7E3DC', PAPER), ('#0B0B0E', INKC), ('#0E0F14', INKC), ('#E0343F', PEN), ('#DAD5CC', PAPER2), ('#15161C', INKC),
             ('rgba(231,227,220,.32)', 'rgba(243,237,223,.32)'), ('rgba(11,11,14,.3)', 'rgba(31,42,35,.3)'), ('rgba(11,11,14,.6)', 'rgba(31,42,35,.6)'),
             ("'Pretendard Variable',Pretendard,sans-serif", "'Oswald','Noto Sans KR',sans-serif")):   # its distance labels
    _txt = _txt.replace(a, b)
_m['data'] = base64.b64encode(gzip.compress(_txt.encode('utf-8'), 9, mtime=0) if _m.get('compressed') else _txt.encode('utf-8')).decode()
PLAYERS = ('player', 'player_helmet2', 'player_cap', 'player_cap2', 'player_cap3', 'player_ump')   # must match HELMETS + CAPS + UMPIRE in src/glbfig.js
PROPS = ('glove', 'mitt', 'mask')   # must match PROPS in src/glbfig.js
add = [(n + '.glb', os.path.join(ASSETS, n + '.glb'), 'model/gltf-binary') for n in PLAYERS + tuple(p for p in PROPS if os.path.exists(os.path.join(ASSETS, p + '.glb')))] + [('clips_shared.json', os.path.join(CLIPDIR, 'clips_shared.json'), 'application/json'), ('GLTFLoader', J + 'loaders/GLTFLoader.js', 'text/javascript'),
       ('BufferGeometryUtils', J + 'utils/BufferGeometryUtils.js', 'text/javascript'), ('SkeletonUtils', J + 'utils/SkeletonUtils.js', 'text/javascript')] + \
      [(n, os.path.join(ASSETS, 'screens', n), 'image/jpeg') for n in SCREENS]
for rid, path, mime in add:
    u = rid_uuid(rid); raw = open(path, 'rb').read()
    manifest[u] = {'mime': mime, 'compressed': True, 'data': base64.b64encode(gzip.compress(raw, 9, mtime=0)).decode()}
    ext.append({'id': rid, 'uuid': u}); print(f'+ {rid:20s} {len(raw)/1e3:8.1f} KB raw')
enc = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</script', '<\\/script')
# rebuild from the end so earlier offsets stay valid
parts = sorted([(mt, json.dumps(tpl, ensure_ascii=False).replace('</script', '<\\/script')), (mm, enc(manifest)), (me, enc(ext))], key=lambda p: -p[0].start(2))
for m, txt in parts: html = html[:m.start(2)] + txt + html[m.end(2):]
open(out, 'w', encoding='utf-8').write(html)
print('out bytes', len(html.encode()) / 1e6, 'MB')
