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
# ---- page polish (2026-10-17 review) ----
# phones: the 3D box was 342x256 (players a few px tall); a 4:5 box keeps the camera's vertical view, so the close-up gets
# ~1.7x bigger; the wide shot backs off and looks down more so the whole field still fits the narrower box
tpl = sub(tpl, 'hint-size="342px,256px" style="width:342px;height:256px"></x-import>', 'hint-size="342px,428px" style="width:342px;height:428px"></x-import>')
tpl = sub(tpl, "      this.camTarget.set(lerp(-1, 0, wide), lerp(3.5, 0, wide), lerp(-28, -140, wide));\n"
               "      const rho = lerp(72, 500, wide), phi = clamp(lerp(15, 42, wide) + R.pitch, 5, 85) * D2R,",
               "      const nar = Math.max(0, 4 / 3 / this.camera.aspect - 1);   // 0 for a 4:3 box, ~.67 for the phone's 4:5: frame a little nearer home, look down more when wide\n"
               "      this.camTarget.set(lerp(-1, 0, wide), lerp(3.5, 0, wide), lerp(-28 + 9 * nar, -140, wide));\n"
               "      const rho = lerp(72, 500 * (1 + .9 * nar), wide), phi = clamp(lerp(15, 42 + 30 * nar, wide) + R.pitch, 5, 85) * D2R,")
# first screen: one line on what it is + the button (before, the only button was at the very bottom of the page);
# the nav's "차트 열기" opens the app too (it used to scroll to that bottom button). unbundle.py / pagebundle.py point data-cta at the app.
CTA = '<a href="#" data-cta="hero" style="display:inline-flex;align-items:center;height:%dpx;padding:0 %dpx;border-radius:%dpx;background:#E7E3DC;color:#0B0B0E;font-size:16px;font-weight:700">차트 열기</a>'
tpl = sub(tpl, '        <div>차트가 그려진다.</div>\n      </div>\n      <div style="position:absolute;left:0;right:0;bottom:32px;',
               '        <div>차트가 그려진다.</div>\n      </div>\n'
               '      <div style="position:absolute;left:40px;top:432px;display:flex;flex-direction:column;align-items:flex-start;gap:28px">\n'
               '        <div style="font-size:20px;line-height:1.6;font-weight:400;text-shadow:0 0 18px #0E0F14">사회인야구 타석을 기록하면 스프레이차트가 그려집니다.</div>\n'
               '        <div style="display:flex;align-items:center;gap:20px">' + CTA % (56, 40, 28) + '<div style="font-size:13px;letter-spacing:.06em;font-weight:400">무료 · 가입 없음 · 설치 없음</div></div>\n'
               '      </div>\n      <div style="position:absolute;left:0;right:0;bottom:32px;')
tpl = sub(tpl, '        <div>차트가 그려진다.</div>\n      </div>\n      <div style="position:absolute;left:0;right:0;bottom:24px;',
               '        <div>차트가 그려진다.</div>\n      </div>\n'
               '      <div style="position:absolute;left:20px;right:20px;top:268px;display:flex;flex-direction:column;align-items:flex-start;gap:18px">\n'
               '        <div style="font-size:16px;line-height:1.6;font-weight:400;word-break:keep-all">사회인야구 타석을 기록하면 스프레이차트가 그려집니다.</div>\n'
               '        <div style="display:flex;align-items:center;gap:14px">' + CTA % (52, 30, 26) + '<div style="font-size:13px;letter-spacing:.04em;font-weight:400">무료 · 가입 없음</div></div>\n'
               '      </div>\n      <div style="position:absolute;left:0;right:0;bottom:24px;')
PILL = '<a href="#" data-cta="nav"><span style="display:inline-flex;align-items:center;height:34px;padding:0 16px;border-radius:17px;border:1px solid rgba(231,227,220,.55);letter-spacing:.04em;font-weight:500">차트 열기</span></a>'
tpl = sub(tpl, '<a href="#d-cta">차트 열기</a>', PILL)
tpl = sub(tpl, '<a href="#m-cta">차트 열기</a>', PILL)
# text: body copy 15px light -> 17px regular, the small spaced labels 11px light -> 13px regular, compare table 15 -> 17px
tpl = sub(tpl, 'font-size:15px;line-height:1.7;font-weight:300', 'font-size:17px;line-height:1.7;font-weight:400', 10)
tpl = sub(tpl, 'font-size:15px;font-weight:300;line-height:1.7', 'font-size:17px;font-weight:400;line-height:1.7', 10)
tpl = sub(tpl, 'font-size:15px;font-weight:300;line-height:1"', 'font-size:16px;font-weight:500;line-height:1"', 16)
tpl = sub(tpl, 'display:flex;flex-direction:column;font-size:15px;line-height:1.5', 'display:flex;flex-direction:column;font-size:17px;line-height:1.5', 2)
tpl = sub(tpl, '<div style="font-weight:300">', '<div style="font-weight:400">', 21)
small = lambda m: m.group(0).replace('font-size:11px;letter-spacing:.12em', 'font-size:13px;letter-spacing:.06em').replace('font-weight:300', 'font-weight:400')
tpl, n = re.subn(r'style="[^"]*font-size:11px;letter-spacing:\.12em[^"]*"(?!>(?:Desktop|Mobile) · )', small, tpl); assert n == 25, n   # not the design-canvas labels unbundle.py drops
tpl = sub(tpl, "fontSize: '11px', letterSpacing: '.12em', fontWeight: 300, color: INK", "fontSize: '13px', letterSpacing: '.06em', fontWeight: 400, color: INK")
# taps: every nav / footer link at least 44x44 on screen (they were 21x16 .. 69x16; 48 because the phone board is drawn
# at ~0.96); the nav's "·" separators make way for it, and its side columns size to their content so the logo isn't crowded
tpl = sub(tpl, 'body{margin:0;background:#C6C1B8}',
          'body{margin:0;background:#C6C1B8}\n'
          'nav a,footer a{display:inline-flex;align-items:center;justify-content:center;min-width:48px;min-height:48px}\n'
          'nav{grid-template-columns:auto 1fr auto!important}nav>div:nth-child(2){justify-self:center}\n'
          'nav>div:first-child{gap:0!important}nav>div:first-child>span{display:none}')

# ---- page polish 2 (2026-10-17): features show what they do, the numbers say what they count, real app screens, links ----
APP = 'https://kimjeongcheol13.github.io/baseball-spray-chart/'
SCREENS = ('app_record.jpg', 'app_brief.jpg', 'app_scout.jpg')   # assets/screens/: the app in its sample-data mode at 375px, the "샘플 데이터" bar cropped off
rid_uuid = lambda rid: str(uuid.uuid5(uuid.NAMESPACE_URL, 'spraylab-landing-3d/' + rid))
def region(s, start, end, new):           # replace from `start` through the first `end` after it (`start` exactly once)
    assert s.count(start) == 1, (s.count(start), start[:60]); i = s.index(start); j = s.index(end, i) + len(end); return s[:i] + new + s[j:]
CARD = 'box-sizing:border-box;background:#F6F3EE;border:1px solid rgba(11,11,14,.12);border-radius:20px;box-shadow:0 24px 48px rgba(11,11,14,.08)'
# 자동 계산: an example stat line (OPS = OBP + SLG, ISO = SLG - AVG, as batdata.js computes them) instead of a third copy of the spray chart
def stats(big):
    cells = ''.join('<div><div style="font-size:13px;letter-spacing:.06em;opacity:.6">%s</div><div style="font-size:%dpx;font-weight:700;letter-spacing:-.02em;line-height:1.15;font-variant-numeric:tabular-nums">%s</div></div>' % (k, 44 if big else 30, v)
                    for k, v in (('AVG', '.312'), ('OBP', '.398'), ('SLG', '.487'), ('OPS', '.885'), ('wOBA', '.381'), ('ISO', '.175')))
    return ('<div style="%s;%swidth:%dpx;padding:%s;display:flex;flex-direction:column;gap:%dpx">' % (CARD, 'justify-self:center;' if big else '', 560 if big else 342, '36px 40px' if big else '24px', 28 if big else 20)
            + '<div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-size:%dpx;font-weight:800">7번 타자</div><div style="font-size:13px;letter-spacing:.06em;opacity:.6">예시 · 52타석</div></div>' % (22 if big else 18)
            + '<div style="display:grid;grid-template-columns:repeat(3,1fr);row-gap:%dpx;column-gap:16px">%s</div>' % (28 if big else 20, cells)
            + '<div style="font-size:14px;line-height:1.6;opacity:.7">OPS = 출루율 + 장타율, ISO = 장타율 − 타율. 타석을 기록할 때마다 다시 계산된다.</div></div>')
# 방향 분포: the spray chart stays (it is the right picture here) with the pull / centre / opposite split under it
def dirbar(w):
    seg = lambda p, c: '<div style="width:%d%%;background:%s"></div>' % (p, c)
    lab = lambda p, t: '<span><b style="font-weight:700;font-variant-numeric:tabular-nums">%d%%</b> %s</span>' % (p, t)
    return ('<div style="display:flex;flex-direction:column;gap:12px;width:%dpx">' % w
            + '<div style="display:flex;height:12px;border-radius:6px;overflow:hidden">' + seg(56, '#E0343F') + seg(27, '#0B0B0E') + seg(17, '#A9A49B') + '</div>'
            + '<div style="display:flex;justify-content:space-between;font-size:15px">' + lab(56, '당겨치기') + lab(27, '센터') + lab(17, '밀어치기') + '<span style="opacity:.55">예시</span></div></div>')
# 공유 QR: a real QR (it opens the app) instead of the spray chart
import qrcode, qrcode.image.svg
qr = qrcode.make(APP, image_factory=qrcode.image.svg.SvgPathImage, border=0).to_string(encoding='unicode')
qr = re.sub(r'width="[^"]*" height="[^"]*"', 'width="100%" height="100%" shape-rendering="crispEdges"', qr, count=1)
def qrcard(big):
    side = 200 if big else 160
    return ('<div style="%s;%swidth:%dpx;padding:%s;display:flex;%sgap:%dpx">' % (CARD, 'justify-self:center;' if big else '', 560 if big else 342, '36px 40px' if big else '24px', 'align-items:center;' if big else 'flex-direction:column;', 36 if big else 20)
            + '<div style="flex:none;box-sizing:border-box;width:%dpx;height:%dpx;background:#fff;border-radius:12px;padding:14px">%s</div>' % (side, side, qr)
            + '<div style="display:flex;flex-direction:column;gap:10px"><div style="font-size:%dpx;font-weight:800;line-height:1.35">휴대폰 카메라로<br>찍어 보세요</div>' % (22 if big else 18)
            + '<div style="font-size:15px;line-height:1.6;opacity:.7">이 QR은 실제로 SprayLab을 연다. 팀원에게 기록을 넘길 때도 QR 하나면 된다.</div></div></div>')
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 20 }}" hint-size="560px,420px" style="width:560px;height:420px;justify-self:center"></dc-import>', stats(True))
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" dot="{{ 9 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 14 }}" hint-size="342px,256px" style="width:342px;height:256px"></dc-import>', stats(False))
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 4 }}" hint-size="560px,420px" style="width:560px;height:420px;justify-self:center"></dc-import>',
               '<div style="justify-self:center;display:flex;flex-direction:column;align-items:center;gap:8px"><dc-import name="SprayChart" count="{{ 120 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 4 }}" hint-size="560px,420px" style="width:560px;height:420px"></dc-import>' + dirbar(480) + '</div>')
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 120 }}" dot="{{ 9 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 21 }}" hint-size="342px,256px" style="width:342px;height:256px"></dc-import>',
               '<dc-import name="SprayChart" count="{{ 120 }}" dot="{{ 9 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 21 }}" hint-size="342px,256px" style="width:342px;height:256px"></dc-import>' + dirbar(342))
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 60 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 11 }}" hint-size="560px,420px" style="width:560px;height:420px;justify-self:center"></dc-import>', qrcard(True))
tpl = sub(tpl, '<dc-import name="SprayChart" count="{{ 60 }}" dot="{{ 9 }}" hand="{{ hand }}" motion="{{ motion }}" phase="{{ 5 }}" hint-size="342px,256px" style="width:342px;height:256px"></dc-import>', qrcard(False))
# the number strip: each number says what it counts (the old 5 / 3 / 25 / 1 had no unit, and the app has no 25 anywhere);
# desktop: five columns that fit, instead of a sideways scroll that cut the third card at the screen edge
tpl = sub(tpl, '<div style="display:flex;gap:64px;overflow-x:auto;scrollbar-width:none;padding:0 120px;scroll-snap-type:x mandatory;scroll-padding-left:120px">',
               '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:40px;padding:0 120px">')
tpl = sub(tpl, '<div style="flex:none;width:560px;scroll-snap-align:start;display:flex;flex-direction:column;gap:20px">', '<div style="display:flex;flex-direction:column;gap:20px">', 5)
for old, new in (('1장', '1장'), ('5', '7개'), ('3', '3방향'), ('25', '전원'), ('1', '1번')):
    tpl = sub(tpl, 'font-size:96px;font-weight:700;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums">%s</div>' % old,
                   'font-size:72px;font-weight:700;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums">%s</div>' % new)
    tpl = sub(tpl, 'font-size:56px;font-weight:700;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums">%s</div>' % old,
                   'font-size:56px;font-weight:700;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums">%s</div>' % new)
tpl = sub(tpl, 'AVG·OBP·SLG·wOBA·ISO, 선수마다 한 장.', '타율·출루율·장타율·OPS·wOBA·삼진%·볼넷%, 선수마다 한 장.', 2)   # what report.js draws
tpl = sub(tpl, '당겨치기·센터·밀어치기, 세 구간으로 읽는다.', '당겨치기·센터·밀어치기 비율로 수비 위치까지 정한다.', 2)
tpl = sub(tpl, '로스터 전원의 지표를 한 화면에서 비교한다.', '선수 전원의 성적·순위·경기 흐름을 한 화면에서 본다.', 2)   # team.js
# demo: the fake video (a spray chart over a "0:24 / 1:24" bar) becomes three real screens of the app
SHOTS = (('app_record.jpg', '기록', '필드를 탭하면 타구가 그대로 찍힌다'), ('app_brief.jpg', '분석', '타자마다 오늘·최근·시즌 성적을 한 장에'), ('app_scout.jpg', '스카우트', '상대 타자 공략 포인트를 자동으로 뽑는다'))
fig = lambda f, t, c, w: ('<figure style="margin:0;%sdisplay:flex;flex-direction:column;gap:16px">' % ('flex:none;width:%dpx;scroll-snap-align:start;' % w if w else '')
                          + '<img src="%s" alt="SprayLab %s 화면" loading="lazy" style="width:100%%;height:auto;display:block;border-radius:24px;border:5px solid #2A2B33">' % (rid_uuid(f), t)
                          + '<figcaption style="font-size:17px;line-height:1.5"><b style="font-weight:700">%s</b> — %s</figcaption></figure>' % (t, c))
head = lambda px: '<div style="font-size:%dpx;line-height:1;letter-spacing:-.03em;font-weight:300;word-break:keep-all"><div style="font-weight:800">실제 앱</div><div>화면.</div></div>' % px
note = '<div style="font-size:17px;line-height:1.7;font-weight:400;max-width:36em;text-wrap:pretty%s">가상 선수 9명 · 3경기 샘플로 찍은 실제 화면이다. 앱에서 &quot;샘플 데이터로 둘러보기&quot;를 누르면 똑같이 볼 수 있다.</div>'
tpl = region(tpl, '<div style="position:relative;width:1200px;aspect-ratio:16/9;', '<div>0:24 / 1:24</div>\n        </div>\n      </div>',
             '<div style="display:flex;flex-direction:column;gap:80px">'
             '<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:80px;align-items:end">' + head(64) + note % ';justify-self:end' + '</div>'
             '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:48px">' + ''.join(fig(f, t, c, 0) for f, t, c in SHOTS) + '</div></div>')
tpl = region(tpl, '<div style="position:relative;width:342px;aspect-ratio:16/9;', '<div>0:24 / 1:24</div>\n        </div>\n      </div>',
             '<div style="display:flex;flex-direction:column;gap:40px">' + head(40) + note % ''
             + '<div style="display:flex;gap:20px;overflow-x:auto;scrollbar-width:none;scroll-snap-type:x mandatory;margin:0 -24px;padding:0 24px;scroll-padding-left:24px">'
             + ''.join(fig(f, t, c, 240) for f, t, c in SHOTS) + '</div></div>')
tpl = sub(tpl, '<a href="#">Instagram</a>', '<a href="https://www.instagram.com/spraylab2026/" target="_blank" rel="noopener">Instagram</a>', 2)

# resources: body + three.js addons + the app screens, gzip+base64 like the rest of the manifest
mm = block('manifest'); manifest = json.loads(mm.group(2))
me = block('ext_resources'); ext = json.loads(me.group(2))
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
