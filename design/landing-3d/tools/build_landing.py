# Assemble the deployed landing page: the hand-written page (next/landing.src.html) + the <spray-play> 3D element
# (src/spray-play.js -- the scene -- with src/glbfig.js -- the players -- spliced in at its `//@glbfig` line).
#   python3 tools/build_landing.py                     -> ../../landing.html, js/landing/spray-play.js, assets/landing/img/*
#   python3 tools/build_landing.py --single out.html   -> one file with everything inline (the desktop copy / strict hosts)
# Needs the 3D resources in assets/landing (GLB, clips) + js/landing/vendor (three, addons); tools/unbundle.py wrote them once.
import sys, os, json, base64, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
D3 = os.path.join(HERE, '..'); ROOT = os.path.normpath(os.path.join(D3, '..', '..')); NEXT = os.path.join(D3, 'next')
V = '2'   # ?v= of spray-play.js (bump when src/spray-play.js or src/glbfig.js changes)
RES = {'three.module': 'js/landing/vendor/three.module.js', 'three.core': 'js/landing/vendor/three.core.js',
       'GLTFLoader': 'js/landing/vendor/GLTFLoader.js', 'BufferGeometryUtils': 'js/landing/vendor/BufferGeometryUtils.js', 'SkeletonUtils': 'js/landing/vendor/SkeletonUtils.js',
       **{n + '.glb': 'assets/landing/' + n + '.glb' for n in ('player', 'player_helmet2', 'player_cap', 'player_cap2', 'player_cap3', 'player_ump', 'glove', 'mitt', 'mask')},
       'clips_shared.json': 'assets/landing/clips_shared.json'}
MIME = {'.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'}
single = '--single' in sys.argv

# 1) the element script
js = open(os.path.join(D3, 'src', 'spray-play.js'), encoding='utf-8').read()
fig = open(os.path.join(D3, 'src', 'glbfig.js'), encoding='utf-8').read().rstrip('\n')
fig = '\n'.join(('  ' + l if l.strip() else l) for l in fig.split('\n'))
assert js.count('  //@glbfig\n') == 1; js = js.replace('  //@glbfig\n', fig + '\n')
assert "customElements.define('spray-play'" in js and '</script' not in js

# 2) the page
src = open(os.path.join(NEXT, 'landing.src.html'), encoding='utf-8').read()
assert src.count('<!--PLAY-->') == 1
data_url = lambda p: 'data:%s;base64,%s' % (MIME[os.path.splitext(p)[1]], base64.b64encode(open(p, 'rb').read()).decode())
imgs = sorted(f for f in os.listdir(os.path.join(NEXT, 'img')) if f.endswith(('.jpg', '.png')))
if single:
    out = sys.argv[sys.argv.index('--single') + 1]
    for f in imgs: src = src.replace('assets/landing/img/' + f, data_url(os.path.join(NEXT, 'img', f)))
    res = 'window.__resources = %s;' % json.dumps({k: data_url(os.path.join(ROOT, v)) for k, v in RES.items()})
    play = '<script>%s</script>' % js
else:
    os.makedirs(os.path.join(ROOT, 'assets', 'landing', 'img'), exist_ok=True)
    for f in imgs: shutil.copyfile(os.path.join(NEXT, 'img', f), os.path.join(ROOT, 'assets', 'landing', 'img', f))
    os.makedirs(os.path.join(ROOT, 'js', 'landing'), exist_ok=True)
    open(os.path.join(ROOT, 'js', 'landing', 'spray-play.js'), 'w', encoding='utf-8').write(js)
    out = os.path.join(ROOT, 'landing.html')
    # resource names the element asks for -> files next to the page (absolute, so blob modules can import them)
    res = '(function () { var m = %s, r = {}; for (var k in m) r[k] = new URL(m[k], location.href).href; window.__resources = r; })();' % json.dumps(RES)
    play = '<script src="js/landing/spray-play.js?v=%s"></script>' % V
page = src.replace('<!--PLAY-->', '<script>%s</script>\n%s' % (res, play))
open(out, 'w', encoding='utf-8').write(page)
print('%s %.2f MB%s' % (out, len(page.encode()) / 1e6, '' if single else ' + spray-play.js %.0f KB + %d images' % (len(js) / 1e3, len(imgs))))
