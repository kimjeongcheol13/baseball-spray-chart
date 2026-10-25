"""Recapture the three SprayLab app shots used on the landing page (night theme, sample mode).

python tools/shoot_app.py          -> writes the 3 JPEGs into next/img/ (then build: tools/build_landing.py) + raw/alt PNGs in %TEMP%/spraylab_appshots
python tools/shoot_app.py --dry    -> raw/alt PNGs + preview JPEGs only (nothing in the repo is touched)
Needs playwright (pip install playwright; python -m playwright install chromium). Serves the repo root itself on a free port.
"""
import functools, http.server, io, sys, tempfile, threading
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
IMG = ROOT / "design/landing-3d/next/img"
OUT = Path(tempfile.gettempdir()) / "spraylab_appshots"; OUT.mkdir(exist_ok=True)
DRY = "--dry" in sys.argv
sys.stdout.reconfigure(encoding="utf-8")   # prints can hold Korean or dashes; the Windows console is cp949
BLOCK = ("sentry-cdn", "googletagmanager", "google-analytics", "kakao", "formspree", "supabase")
FLAGS = ["sl_ftu_done", "sl_menu_moved_seen", "sl_scout_intro_seen", "sl_scout_info_closed", "sl_lineup_banner_closed", "sl_visited"]

# Sample mode puts a fixed amber strip on top (body.sl-sample-on + #slSampleBar). Strip it before the app sizes the
# field (core _fieldFS reads the viewport at init), so the layout is exactly what a user with real data sees.
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


def save_jpg(img, name, size):
    img = img.convert("RGB").resize(size, Image.LANCZOS)
    dst = (OUT / ("preview_" + name)) if DRY else (IMG / name)
    img.save(dst, "JPEG", quality=85, progressive=True, optimize=True)
    print("wrote", dst, size, dst.stat().st_size)


def shot(pg, name):
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(400)
    png = pg.screenshot()
    (OUT / f"raw_{name}.png").write_bytes(png)
    return Image.open(io.BytesIO(png))


def overlays(pg):
    """Anything floating that should not be in a marketing shot (toasts, tips, modals, sheets)."""
    return pg.evaluate("""(() => [...document.querySelectorAll('body *')].filter(e => {
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      return (cs.position === 'fixed' || /toast|tip|modal|overlay|sheet|banner|popup/i.test(e.id + ' ' + e.className))
        && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && r.width > 40 && r.height > 20
        && r.bottom > 0 && r.top < innerHeight && !e.closest('.sb-tabbar, nav');
    }).map(e => e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 50) + ' ' + Math.round(e.getBoundingClientRect().top)))()""")


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

    # 1) open the app (?go=1 skips the landing redirect), mark first-run tips as seen, enter sample mode (reloads)
    pg.goto(BASE + "index.html?go=1")
    pg.wait_for_function("window.slSample")
    pg.wait_for_timeout(1500)
    for k in FLAGS:
        pg.evaluate("k => window.localStorage.setItem(k, '1')", k)
    with pg.expect_navigation():
        assert pg.evaluate("window.slSample.enter()"), "sample mode refused"
    pg.wait_for_load_state("load")
    pg.wait_for_timeout(3500)
    assert pg.evaluate("window.slSample.isOn()")

    # 2) 기록: 타순표 -> 1번 김민준 (same taps as a user; picking from the sheet does not filter the field)
    pg.click("#sbNowBar")
    pg.wait_for_timeout(600)
    pg.locator("#sbOrder .sb-ot-row", has_text="김민준").first.click()
    pg.wait_for_timeout(1200)
    print("record overlays:", overlays(pg))
    rec = shot(pg, "record")
    # alternates for the caller: field filtered to 김민준's balls (old image) / scrolled down to B-S-O + result stamps
    pg.evaluate("toggleBatterFilter()"); pg.wait_for_timeout(600); shot(pg, "record_alt_filtered")
    pg.evaluate("toggleBatterFilter()"); pg.wait_for_timeout(300)
    pg.evaluate("(() => { const L = document.querySelector('.app-layout'), s = document.querySelector('.sb-stamps');"
                " L.scrollTop += s.getBoundingClientRect().bottom - (innerHeight - 62); })()")
    pg.wait_for_timeout(500); shot(pg, "record_alt_scrolled")
    pg.evaluate("document.querySelector('.app-layout').scrollTop = 0")

    # 3) 분석 > 팀 (시즌 전체 is the default scope)
    pg.click(".savant-nav-btn[data-tab=analysis]")
    pg.wait_for_timeout(1500)
    pg.click("#anaSubnav .ana-sub[data-sub=team]")
    pg.wait_for_timeout(1500)
    print("team overlays:", overlays(pg))
    team = shot(pg, "team")

    # 4) 경기설정 scrolled to the end: 팀 만들기 (팀원과 기록 공유) + 내보내기 · 공유 (QR·링크, PNG, 카드, 엑셀) + 데이터 · 도움말.
    #    The exported report/cards stay cream paper by design, so the 03 · 공유 card shows this night-theme screen instead.
    #    Only the end works: anywhere higher, a row shows through the floating "저장하고 기록 시작" bar.
    pg.click(".savant-nav-btn[data-tab=settings]")
    pg.wait_for_timeout(1500)
    pg.evaluate("(() => { const v = document.getElementById('settingsView'); v.scrollTop = v.scrollHeight; })()")
    pg.wait_for_timeout(600)
    print("share overlays:", overlays(pg))
    share = shot(pg, "share")
    br.close()
srv.shutdown()

save_jpg(rec, "app_record.jpg", (630, 1274))
save_jpg(team, "app_team.jpg", (630, 1274))
save_jpg(share, "app_share.jpg", (630, 1274))
