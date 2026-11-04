"""Recapture the 3 tap-scene frames used on little.html (record tab, sample mode, same setup as shoot_app.py).

python design/landing-3d/tools/shoot_tap.py   -> assets/landing/img/tap_1.jpg (field) · tap_2.jpg (result popup) · tap_3.jpg (saved toast)
Prints the tap point and the 안타 button centre in the 375x758 viewport; little.html's .finger keyframes use them as %
(72.5% / 53.8% and 29.6% / 47.1% for the current shots) — update those if they move. Bump the tap_*.jpg ?v= in little.html.
Needs playwright (pip install playwright; python -m playwright install chromium). Serves the repo root itself on a free port.
"""
import functools, http.server, sys, threading
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
IMG = ROOT / "assets/landing/img"
FX, FY = .854, .419   # tap point as a fraction of #fldCanvas: an empty spot in right field of the sample game
sys.stdout.reconfigure(encoding="utf-8")
BLOCK = ("sentry-cdn", "googletagmanager", "google-analytics", "kakao", "formspree", "supabase")
FLAGS = ["sl_ftu_done", "sl_menu_moved_seen", "sl_scout_intro_seen", "sl_scout_info_closed", "sl_lineup_banner_closed", "sl_visited"]
INIT = """
document.addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style');
  st.textContent = '#slSampleBar{display:none!important}';
  document.head.appendChild(st);
});
new MutationObserver(() => {
  const b = document.body;
  if (b && b.classList.contains('sl-sample-on')) b.classList.remove('sl-sample-on');
}).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def save(pg, n):
    pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(300)
    dst = IMG / f"tap_{n}.jpg"
    Image.open(__import__("io").BytesIO(pg.screenshot())).convert("RGB").resize((630, 1274), Image.LANCZOS) \
        .save(dst, "JPEG", quality=85, progressive=True, optimize=True)
    print("wrote", dst, dst.stat().st_size)


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_port}/"
with sync_playwright() as p:
    br = p.chromium.launch(args=["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = br.new_context(viewport={"width": 375, "height": 758}, device_scale_factor=2, is_mobile=True, has_touch=True,
                         service_workers="block", locale="ko-KR", timezone_id="Asia/Seoul")
    ctx.route("**/*", lambda r: r.abort() if any(k in r.request.url for k in BLOCK) else r.continue_())
    ctx.add_init_script(INIT)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: print("pageerror:", e))
    pg.goto(BASE + "index.html?go=1")
    pg.wait_for_function("window.slSample")
    pg.wait_for_timeout(1500)
    for k in FLAGS:
        pg.evaluate("k => window.localStorage.setItem(k, '1')", k)
    with pg.expect_navigation():
        assert pg.evaluate("window.slSample.enter()"), "sample mode refused"
    pg.wait_for_load_state("load")
    pg.wait_for_timeout(3500)

    # 1) 타순표 -> 1번 김민준, the whole field (not filtered: after saving, the app moves on to the next batter)
    pg.click("#sbNowBar"); pg.wait_for_timeout(600)
    pg.locator("#sbOrder .sb-ot-row", has_text="김민준").first.click(); pg.wait_for_timeout(1200)
    save(pg, 1)
    # 2) tap the field like a finger -> result popup (안타 · 장타 · 땅볼 · 플라이) at that spot
    r = pg.evaluate("(() => { const r = document.getElementById('fldCanvas').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    tx, ty = r[0] + r[2] * FX, r[1] + r[3] * FY
    pg.touchscreen.tap(tx, ty); pg.wait_for_timeout(900)
    save(pg, 2)
    b = pg.locator(".tp-btn.tp-hit").first.bounding_box()
    hx, hy = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
    # 3) 안타 -> saved toast, next batter
    pg.touchscreen.tap(hx, hy); pg.wait_for_timeout(1500)
    save(pg, 3)
    print(f"finger: tap {tx / 375:.1%} {ty / 758:.1%} · 안타 {hx / 375:.1%} {hy / 758:.1%}")
    br.close()
srv.shutdown()
