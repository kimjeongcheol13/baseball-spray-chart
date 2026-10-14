# Single-file page build for strict hosts (claude.ai artifacts): same page-mode edits as unbundle.py, assets stay inside
#   python3 tools/pagebundle.py SprayLab_Landing.glb.html SprayLab_Landing.page.html https://kimjeongcheol13.github.io/baseball-spray-chart/
import sys, re, json
src, out = sys.argv[1], sys.argv[2]
app = sys.argv[3] if len(sys.argv) > 3 else './'
html = open(src, encoding='utf-8').read()
m = re.search(r'(<script type="__bundler/template">)(.*?)(</script>)', html, re.S)
tpl = json.loads(m.group(2))
def sub(a, b, n=1):
    global tpl
    c = tpl.count(a); assert c == n, (c, a[:90]); tpl = tpl.replace(a, b)
sub('<html><head>', '''<html lang="ko"><head>
<script>window.slFrame = function () { return matchMedia('(max-width: 1023px)').matches ? 'mobile' : 'desktop'; };</script>
<title>SprayLab 랜딩</title>
<meta name="description" content="사회인야구 타석을 기록하면 스프레이차트가 그려집니다. 무료 · 가입 없음 · 설치 없음.">''')
sub('  <meta name="design_doc_mode" content="canvas">\n', '')
sub('body{margin:0;background:#C6C1B8}', 'body{margin:0;background:#E7E3DC}')
sub('<div style="min-height:100vh;background:#C6C1B8;padding:80px;display:flex;gap:120px;align-items:flex-start;font-family:',
    '<div id="sl-page" style="min-height:100vh;background:#E7E3DC;display:flex;justify-content:center;align-items:flex-start;font-family:')
sub('  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:300">Desktop · 1440</div>\n', '')
sub('  <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:300">Mobile · 390</div>\n', '')
sub('<div style="flex:none;display:flex;flex-direction:column;gap:20px">', '<div style="flex:none">', 2)
sub('  state = { sceneD: 0, sceneM: 0 };',
    "  state = { sceneD: 0, sceneM: 0, frame: window.slFrame() };\n"
    "  componentDidMount() { this.slMq = matchMedia('(max-width: 1023px)'); this.slOn = () => this.setState({ frame: window.slFrame() }); this.slMq.addEventListener('change', this.slOn); }\n"
    "  componentWillUnmount() { if (this.slMq) this.slMq.removeEventListener('change', this.slOn); }")
sub("    const f = this.props.frames ?? 'both';", '    const f = this.state.frame;')
tgt = '' if app == './' else ' target="_blank" rel="noopener"'
sub('<a href="#" style="display:inline-flex;align-items:center;height:56px;padding:0 40px;', '<a href="%s"%s style="display:inline-flex;align-items:center;height:56px;padding:0 40px;' % (app, tgt))
sub('<a href="#" style="display:inline-flex;align-items:center;height:56px;padding:0 36px;', '<a href="%s"%s style="display:inline-flex;align-items:center;height:56px;padding:0 36px;' % (app, tgt))
sub('<a href="#">GitHub</a>', '<a href="https://github.com/kimjeongcheol13/baseball-spray-chart" target="_blank" rel="noopener">GitHub</a>', 2)
# strict hosts refuse fetch() of blob: URLs; read the bundled Blob directly (falls back to fetch elsewhere)
sub("      const txt = await (await fetch(R['three.module'])).text();",
    "      const RB = window.__resourceBlobs || {};\n      const txt = RB[R['three.module']] ? await RB[R['three.module']].text() : await (await fetch(R['three.module'])).text();")
sub('</body>', '''<script>
(function () {
  function fit() {
    var w = document.documentElement.clientWidth, d = document.getElementById('desktop'), m = document.getElementById('mobile');
    if (d) { var z = String(Math.min(1.25, w / 1440)); if (d.style.zoom !== z) d.style.zoom = z; }
    if (m) { var y = String(Math.max(.8, Math.min(1.4, w / 390))); if (m.style.zoom !== y) m.style.zoom = y; }
  }
  function soon() { fit(); requestAnimationFrame(fit); setTimeout(fit, 150); }
  addEventListener('resize', soon); addEventListener('load', soon);
  var n = 0, t = setInterval(function () { fit(); if (++n > 40) clearInterval(t); }, 125);
})();
</script>
</body>''')
enc = json.dumps(tpl, ensure_ascii=False).replace('</script', '<\\/script')
html = html[:m.start(2)] + enc + html[m.end(2):]
assert html.count('<title>Bundled Page</title>') == 1
html = html.replace('<title>Bundled Page</title>', '<title>SprayLab 랜딩</title>')   # gallery name (scanned from the first 8 KB)
open(out, 'w', encoding='utf-8').write(html); print('page bundle', round(len(html.encode()) / 1e6, 2), 'MB')
