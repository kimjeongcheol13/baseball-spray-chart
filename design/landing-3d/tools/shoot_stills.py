# Re-shoot the landing's still images from the live 3D (its first frame, tau 0.05), so the still -> 3D fade doesn't jump.
#   python tools/shoot_stills.py           -> next/img/hero_close.jpg (desktop hero), hero_close_m.jpg (phone hero), cta_bg.jpg (16:9), og.jpg (1200x630 with the text)
#   python tools/shoot_stills.py --check   -> then reloads and prints the mean pixel difference still vs 3D first frame, desktop and phone (should be <= 10)
# Needs playwright (pip install playwright; python -m playwright install chromium) and a built ../../landing.html (tools/build_landing.py).
# Serves the repo root itself on a free port; writes each image to next/img/ and assets/landing/img/ (the --single build reads next/img/).
import sys, os, io, base64, threading, functools, shutil
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from PIL import Image
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..')); IMG = os.path.join(HERE, '..', 'next', 'img')
BG = (0x0B, 0x0D, 0x12)
FREEZE = "() => { const p = document.getElementById('hero3d'); p.io && p.io.disconnect(); p.visible = false; p.t0 = performance.now() / 1000 - .05; p.frame(performance.now()); }"
SHOTS = [  # name, viewport, dpr, hero height override (the page's min-height would otherwise win), what to save
    ('hero_close.jpg', (1366, 768), 2, None, 'canvas'),
    ('hero_close_m.jpg', (375, 812), 2, None, 'canvas'),
    ('cta_bg.jpg', (1200, 675), 2, 675, 'canvas'),
    ('og.jpg', (1200, 630), 1, 630, 'hero'),
]

srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(SimpleHTTPRequestHandler, directory=ROOT))
srv.RequestHandlerClass.log_message = lambda *a: None
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/landing.html' % srv.server_port

def open_hero(browser, vp, dpr, height):
    ctx = browser.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=dpr)
    page = ctx.new_page(); page.goto(URL)
    if height: page.add_style_tag(content='.hero{height:%dpx!important;min-height:0!important;max-height:none!important}' % height)
    page.wait_for_function("() => !!document.getElementById('hero3d').renderer", timeout=180000)
    page.evaluate(FREEZE); page.wait_for_timeout(1200)   # the page fades its still out once the renderer exists
    return ctx, page

def shoot(browser):
    for name, vp, dpr, height, what in SHOTS:
        ctx, page = open_hero(browser, vp, dpr, height)
        if what == 'canvas':
            data = page.evaluate("() => document.getElementById('hero3d').renderer.domElement.toDataURL('image/png')")
            im = Image.open(io.BytesIO(base64.b64decode(data.split(',', 1)[1]))).convert('RGBA')
            out = Image.new('RGB', im.size, BG); out.paste(im, mask=im.split()[3])
        else:
            out = Image.open(io.BytesIO(page.locator('.hero').screenshot())).convert('RGB')
        out.save(os.path.join(IMG, name), quality=66, optimize=True, progressive=True)   # 66: about half of 86, no visible loss on the players
        shutil.copyfile(os.path.join(IMG, name), os.path.join(ROOT, 'assets', 'landing', 'img', name))   # what the built page shows (build_landing.py copies the same)
        print('%-16s %dx%d' % (name, *out.size)); ctx.close()

def check(browser):
    import numpy as np
    for name, vp, dpr, height, what in SHOTS[:2]:
        ctx, page = open_hero(browser, vp, dpr, height)
        hero = page.locator('.hero')
        page.evaluate("() => { document.querySelector('.hero').classList.remove('live-on'); document.getElementById('hero3d').renderer.domElement.style.visibility = 'hidden'; }"); page.wait_for_timeout(1200)
        a = np.asarray(Image.open(io.BytesIO(hero.screenshot())).convert('RGB'), dtype=float)
        page.evaluate("() => { document.querySelector('.hero').classList.add('live-on'); document.getElementById('hero3d').renderer.domElement.style.visibility = ''; }"); page.wait_for_timeout(1200)
        b = np.asarray(Image.open(io.BytesIO(hero.screenshot())).convert('RGB'), dtype=float)
        print('%-16s still vs 3D first frame: mean |diff| = %.1f (%dx%d)' % (name, np.abs(a - b).mean(), a.shape[1], a.shape[0])); ctx.close()

with sync_playwright() as pw:
    browser = pw.chromium.launch(args=['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    if '--check-only' not in sys.argv: shoot(browser)
    if '--check' in sys.argv or '--check-only' in sys.argv: check(browser)
    browser.close()
srv.shutdown()
