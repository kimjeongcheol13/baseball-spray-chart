# Bake the crowd's sprite sheet from seated spectator models (Tripo, harness/crowd/<name>.glb; not committed):
#   python tools/bake_crowd.py fan1 fan2 ...   -> assets/landing/crowd.webp (and next to it a .png for checking)
# Serves the repo root, opens harness/crowd_bake.html?m=... in headless Chromium (Playwright) and saves what it drew.
import sys, os, io, base64, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from PIL import Image
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
names = sys.argv[1:]; assert names, 'usage: bake_crowd.py name ...'
srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(SimpleHTTPRequestHandler, directory=ROOT))
srv.RequestHandlerClass.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = br.new_page(); page.on('pageerror', lambda e: print('page error:', e))
    page.goto('http://127.0.0.1:%d/design/landing-3d/harness/crowd_bake.html?m=%s' % (srv.server_port, ','.join(names)))
    page.wait_for_function('() => !!window.__sheet', timeout=300000)
    sheet = page.evaluate('() => window.__sheet')
im = Image.open(io.BytesIO(base64.b64decode(sheet['url'].split(',', 1)[1]))).convert('RGBA')
out = os.path.join(ROOT, 'assets', 'landing', 'crowd.webp')
im.save(out, quality=88, method=6)
im.save(os.path.join(HERE, '..', 'harness', 'crowd', 'sheet.png'))
print('%s %dx%d (%d x %d cells of %dx%d) %.0f KB' % (out, im.width, im.height, sheet['cols'], sheet['rows'], sheet['cw'], sheet['ch'], os.path.getsize(out) / 1e3))
