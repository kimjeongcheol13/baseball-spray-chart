/**
 * SprayLab — 타구 밀도 히트맵 레이어
 * Canvas-based Gaussian density heatmap behind spray dots
 */

let _hmOn = false;
let _offCvs = null; // offscreen accumulation buffer (reused)

// ── Color LUT: density alpha (0-255) → RGBA ──────────────────
// yellow(sparse) → orange → red(dense)
const _LUT = (function() {
  const t = new Uint8ClampedArray(256 * 4);
  for (var i = 0; i < 256; i++) {
    var n = i / 255;
    var r, g, b, a;
    if (n < 0.10) {
      a = 0; r = g = b = 0;                          // transparent
    } else if (n < 0.35) {
      var p = (n - 0.10) / 0.25;
      r = 255; g = 200; b = 0;
      a = Math.round(p * 110);                        // yellow, fade in
    } else if (n < 0.65) {
      var p = (n - 0.35) / 0.30;
      r = 255; g = Math.round(200 - p * 185); b = 0;
      a = Math.round(110 + p * 95);                   // yellow → orange → red
    } else {
      var p = (n - 0.65) / 0.35;
      r = 255; g = Math.round(15 * (1 - p)); b = Math.round(p * 70);
      a = Math.round(205 + p * 50);                   // red → crimson
    }
    t[i * 4]     = r;
    t[i * 4 + 1] = g;
    t[i * 4 + 2] = b;
    t[i * 4 + 3] = Math.min(a, 255);
  }
  return t;
}());

// ── Filtered hit list (mirrors safeRender filters) ───────────
function _getList() {
  var as = window.AS;
  if (!as || !as.abs) return [];
  var list = as.abs;
  if (as.batterFilter && as.batter)
    list = list.filter(function(a) { return a.bid === as.batter.id; });
  if (as.teamFilter)
    list = list.filter(function(a) { return (a.team || 'home') === as.teamFilter; });
  if (as.advFilter) {
    var f = as.advFilter;
    list = list.filter(function(a) {
      if (f.hit && a.res !== f.hit) return false;
      if (f.pitch && a.pt !== f.pitch) return false;
      return true;
    });
  }
  list = list.filter(function(a) { return a.x != null && a.y != null; });
  if (typeof window._sfPass === 'function') list = list.filter(window._sfPass);
  return list;
}

// ── Main render ───────────────────────────────────────────────
function _render() {
  var cvs = document.getElementById('hmCanvas');
  if (!cvs) return;

  // Sync size with field canvas
  var fld = document.getElementById('fldCanvas');
  var S = fld ? fld.width : (cvs.width || 440);
  if (cvs.width !== S || cvs.height !== S) { cvs.width = S; cvs.height = S; }

  var ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  if (!_hmOn) return;

  var pts = _getList();
  if (!pts.length) return;

  // --- Offscreen accumulation at 1/4 resolution (performance) ---
  var SC = 4;
  var W = Math.ceil(S / SC);
  if (!_offCvs) _offCvs = document.createElement('canvas');
  _offCvs.width  = W;
  _offCvs.height = W;

  // willReadFrequently: true tells browser not to GPU-upload this canvas
  var oCtx = _offCvs.getContext('2d', { willReadFrequently: true });
  oCtx.clearRect(0, 0, W, W);

  var R     = Math.max(9, Math.floor(S * 0.10 / SC)); // kernel radius (scaled)
  var baseA = Math.max(0.06, Math.min(0.28, 1.8 / pts.length)); // adaptive alpha

  oCtx.globalCompositeOperation = 'source-over';
  pts.forEach(function(a) {
    var px = a.x * W, py = a.y * W;
    var grd = oCtx.createRadialGradient(px, py, 0, px, py, R);
    grd.addColorStop(0,    'rgba(255,255,255,' + baseA + ')');
    grd.addColorStop(0.45, 'rgba(255,255,255,' + (baseA * 0.38).toFixed(4) + ')');
    grd.addColorStop(1,    'rgba(255,255,255,0)');
    oCtx.fillStyle = grd;
    oCtx.beginPath();
    oCtx.arc(px, py, R, 0, Math.PI * 2);
    oCtx.fill();
  });

  // --- Apply color LUT: read alpha as density → remap to red/orange/yellow ---
  var img = oCtx.getImageData(0, 0, W, W);
  var d = img.data;
  for (var i = 0; i < d.length; i += 4) {
    var density = d[i + 3]; // alpha channel = accumulated density
    if (density < 10) { d[i + 3] = 0; continue; }
    var li = density * 4;
    d[i]     = _LUT[li];
    d[i + 1] = _LUT[li + 1];
    d[i + 2] = _LUT[li + 2];
    d[i + 3] = _LUT[li + 3];
  }
  oCtx.putImageData(img, 0, 0);

  // --- Scale up to display canvas; blur for smooth gradients ---
  var blurPx = Math.max(2, Math.round(S * 0.012));
  ctx.save();
  ctx.globalAlpha = 0.88;
  if ('filter' in ctx) {
    ctx.filter = 'blur(' + blurPx + 'px)';
    ctx.drawImage(_offCvs, 0, 0, S, S);
    ctx.filter = 'none';
  } else {
    ctx.drawImage(_offCvs, 0, 0, S, S);
  }
  ctx.restore();
}

// ── Public toggle ─────────────────────────────────────────────
function toggleHeatmapDensity() {
  _hmOn = !_hmOn;
  var btn = document.getElementById('hmDensityBtn');
  if (btn) {
    btn.style.opacity     = _hmOn ? '1'                       : '0.5';
    btn.style.borderColor = _hmOn ? 'rgba(245,101,101,0.65)'  : '';
    btn.style.color       = _hmOn ? '#f56565'                 : '';
  }
  requestAnimationFrame(_render);
}
window.toggleHeatmapDensity = toggleHeatmapDensity;

// ── Init ──────────────────────────────────────────────────────
function _init() {
  // 1. Insert hmCanvas between fldCanvas and hitCanvas (heatmap stays under dots)
  var fldCvs = document.getElementById('fldCanvas');
  if (!fldCvs) return;
  var hmCvs = document.createElement('canvas');
  hmCvs.id = 'hmCanvas';
  hmCvs.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none';
  fldCvs.insertAdjacentElement('afterend', hmCvs);

  // 2. Add toggle button to the "🔥 핫존 분석" stat card
  var hzBtn = document.getElementById('hzHitBtn');
  if (hzBtn) {
    var btnRow = hzBtn.parentElement;
    if (btnRow) {
      var wrap = document.createElement('div');
      wrap.style.marginTop = '6px';
      wrap.innerHTML =
        '<button class="ex-btn" id="hmDensityBtn" onclick="toggleHeatmapDensity()"'
        + ' style="width:100%;opacity:0.5">🌡️ 타구 밀도 히트맵</button>';
      btnRow.parentElement.insertBefore(wrap, btnRow.nextSibling);
    }
  }

  // 3. Patch safeRender to keep heatmap in sync
  if (typeof window.safeRender === 'function') {
    var _orig = window.safeRender;
    window.safeRender = function() {
      _orig.apply(this, arguments);
      if (_hmOn) requestAnimationFrame(_render);
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}
