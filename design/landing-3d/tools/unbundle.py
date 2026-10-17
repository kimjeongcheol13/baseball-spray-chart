# Turn the self-contained design bundle into a real, deployable landing page:
#   python3 tools/unbundle.py SprayLab_Landing.glb.html ../..
# writes <root>/landing.html, <root>/js/landing/*, <root>/assets/landing/*
#
# - every bundled asset becomes a plain file (fonts load per unicode-range, files cache separately)
# - window.__resources maps the runtime's resource names to those files, so nothing comes from a CDN
# - the design canvas (grey board, "Desktop · 1440" labels, both artboards at once) becomes one page:
#   one artboard by viewport width (mobile below 1024px), scaled to fit the screen
import sys, re, json, gzip, base64, os

src, root = sys.argv[1], sys.argv[2]
V = '1'                                     # ?v= cache version for scripts (bump when they change)
html = open(src, encoding='utf-8').read()
blk = lambda k: json.loads(re.search(r'<script type="__bundler/%s">(.*?)</script>' % k, html, re.S).group(1))
manifest, ext, tpl = blk('manifest'), blk('ext_resources'), blk('template')

EXT = {
    'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'js/landing/vendor/react.production.min.js',
    'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'js/landing/vendor/react-dom.production.min.js',
    'three.module': 'js/landing/vendor/three.module.js', 'three.core': 'js/landing/vendor/three.core.js',
    './SprayChart.dc.html': 'js/landing/SprayChart.dc.html',
    'GLTFLoader': 'js/landing/vendor/GLTFLoader.js', 'BufferGeometryUtils': 'js/landing/vendor/BufferGeometryUtils.js',
    'SkeletonUtils': 'js/landing/vendor/SkeletonUtils.js',
    **{n + '.glb': 'assets/landing/' + n + '.glb' for n in ('player', 'player_helmet2', 'player_cap', 'player_cap2', 'player_cap3', 'player_ump', 'glove', 'mitt', 'mask')},
    'clips_shared.json': 'assets/landing/clips_shared.json',
    **{n: 'assets/landing/' + n for n in ('app_record.jpg', 'app_brief.jpg', 'app_scout.jpg')},   # SCREENS in tools/build.py
}
SCRIPTS = {'text/javascript', 'application/javascript'}
by_uuid = {e['uuid']: e['id'] for e in ext}
paths = {}
for u, e in manifest.items():
    if u in by_uuid:
        rid = by_uuid[u]
        if rid not in EXT: sys.exit('unmapped resource id: ' + rid)
        paths[u] = EXT[rid]
    elif e['mime'] == 'font/woff2':
        paths[u] = 'assets/landing/fonts/%s.woff2' % u
    elif e['mime'] in SCRIPTS and u in tpl:
        paths[u] = 'js/landing/%s.js' % ('dc-runtime' if len(base64.b64decode(e['data'])) > 2000 else 'ds-bundle')
    else:
        sys.exit('unhandled asset %s (%s)' % (u, e['mime']))

def sub(a, b, n=1):
    global tpl
    c = tpl.count(a)
    assert c == n, (c, a[:90])
    tpl = tpl.replace(a, b)

# 1) asset references -> files
for u, p in paths.items():
    if u not in tpl: continue
    if manifest[u]['mime'] in SCRIPTS: tpl = tpl.replace('src="%s"' % u, 'src="%s?v=%s"' % (p, V))
    tpl = tpl.replace(u, p)

# 2) canvas -> page
sub('<html><head>', '<html lang="ko"><head>')
res = {rid: EXT[rid] for rid in EXT if any(e['id'] == rid for e in ext)}
head = '''<html lang="ko"><head>
<script>
// resource names the runtime asks for -> files next to this page (absolute, so blob modules can import them)
(function () { var m = %s, r = {}; for (var k in m) r[k] = new URL(m[k], location.href).href; window.__resources = r; })();
window.slFrame = function () { return matchMedia('(max-width: 1023px)').matches ? 'mobile' : 'desktop'; };
</script>
<title>SprayLab — 타석 하나 찍으면 차트가 그려진다</title>
<meta name="description" content="사회인야구 타석을 기록하면 스프레이차트가 그려집니다. 무료 · 가입 없음 · 설치 없음.">
<meta name="theme-color" content="#0E0F14">
<link rel="icon" href="player-logo.png" type="image/png">
<link rel="apple-touch-icon" href="player-logo.png">
<link rel="canonical" href="https://kimjeongcheol13.github.io/baseball-spray-chart/landing.html">
<meta property="og:title" content="SprayLab — 타석 하나 찍으면 차트가 그려진다">
<meta property="og:description" content="사회인야구 타석을 기록하면 스프레이차트가 그려집니다. 무료 · 가입 없음 · 설치 없음.">
<meta property="og:image" content="https://kimjeongcheol13.github.io/baseball-spray-chart/player-logo.png">
<meta property="og:url" content="https://kimjeongcheol13.github.io/baseball-spray-chart/landing.html">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">''' % json.dumps(res, ensure_ascii=False)
sub('<html lang="ko"><head>', head)
sub('  <meta name="design_doc_mode" content="canvas">\n', '')
sub('body{margin:0;background:#C6C1B8}', 'body{margin:0;background:#E7E3DC}')
sub('<div style="min-height:100vh;background:#C6C1B8;padding:80px;display:flex;gap:120px;align-items:flex-start;font-family:',
    '<div id="sl-page" style="min-height:100vh;background:#E7E3DC;display:flex;justify-content:center;align-items:flex-start;font-family:')
sub('  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:300">Desktop · 1440</div>\n', '')
sub('  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:300">Mobile · 390</div>\n', '')
sub('<div style="flex:none;display:flex;flex-direction:column;gap:20px">', '<div style="flex:none">', 2)
# one artboard, chosen by viewport and switched live when it crosses the breakpoint
sub('  state = { sceneD: 0, sceneM: 0 };',
    "  state = { sceneD: 0, sceneM: 0, frame: window.slFrame() };\n"
    "  componentDidMount() { this.slMq = matchMedia('(max-width: 1023px)'); this.slOn = () => this.setState({ frame: window.slFrame() }); this.slMq.addEventListener('change', this.slOn); }\n"
    "  componentWillUnmount() { if (this.slMq) this.slMq.removeEventListener('change', this.slOn); }")
sub("    const f = this.props.frames ?? 'both';", '    const f = this.state.frame;')
# links
sub('<a href="#" style="display:inline-flex;align-items:center;height:56px;padding:0 40px;', '<a href="./" style="display:inline-flex;align-items:center;height:56px;padding:0 40px;')
sub('<a href="#" style="display:inline-flex;align-items:center;height:56px;padding:0 36px;', '<a href="./" style="display:inline-flex;align-items:center;height:56px;padding:0 36px;')
sub('<a href="#" data-cta=', '<a href="./" data-cta=', 4)   # first-screen + nav buttons (tools/build.py)
sub('<a href="#">GitHub</a>', '<a href="https://github.com/kimjeongcheol13/baseball-spray-chart" target="_blank" rel="noopener">GitHub</a>', 2)
# fit the fixed-width artboard to the screen (zoom keeps layout height and anchors correct)
fit = '''<script>
(function () {
  function fit() {
    var w = document.documentElement.clientWidth, d = document.getElementById('desktop'), m = document.getElementById('mobile');
    if (d) { var z = String(Math.min(1.25, w / 1440)); if (d.style.zoom !== z) d.style.zoom = z; }
    if (m) { var y = String(Math.max(.8, Math.min(1.4, w / 390))); if (m.style.zoom !== y) m.style.zoom = y; }
  }
  function soon() { fit(); requestAnimationFrame(fit); setTimeout(fit, 150); }
  addEventListener('resize', soon); addEventListener('load', soon);
  var n = 0, t = setInterval(function () { fit(); if (++n > 40) clearInterval(t); }, 125);   // first 5 s while the runtime mounts
})();
</script>
</body>'''
sub('</body>', fit)

# 3) write files
os.makedirs(root, exist_ok=True)
# The deployed landing.html is now written by tools/build_landing.py; this design-canvas page only goes to legacy/ for reference,
# and only the 3D resources (three + addons, GLBs, motion) are written next to the page.
LEGACY = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'legacy'); os.makedirs(LEGACY, exist_ok=True)
open(os.path.join(LEGACY, 'landing.html'), 'w', encoding='utf-8').write(tpl)
KEEP = ('js/landing/vendor/three', 'js/landing/vendor/GLTFLoader', 'js/landing/vendor/BufferGeometryUtils', 'js/landing/vendor/SkeletonUtils', 'assets/landing/')
total = len(tpl.encode())
for u, p in paths.items():
    e = manifest[u]
    if not p.startswith(KEEP) or p.startswith('assets/landing/fonts') or p.startswith('assets/landing/app_'): continue
    raw = base64.b64decode(e['data'])
    if e.get('compressed'): raw = gzip.decompress(raw)
    f = os.path.join(root, p); os.makedirs(os.path.dirname(f), exist_ok=True)
    open(f, 'wb').write(raw); total += len(raw)
print('legacy/landing.html %.0f KB; 3D resources %.2f MB' % (len(tpl.encode()) / 1e3, (total - len(tpl.encode())) / 1e6))
