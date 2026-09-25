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
// 1/4 해상도 격자에 가우시안 커널을 더해 밀도를 직접 계산하고,
// 가장 몰린 곳을 최대 색으로 정규화한다 (타구가 적고 흩어져 있어도 보이도록)
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

  // --- 밀도 격자 (1/4 해상도) ---
  var SC = 4;
  var W = Math.ceil(S / SC);
  var R = Math.max(6, Math.round(W * 0.09));   // 커널 반경 (격자 칸)
  var R2 = R * R, sig2 = 2 * Math.pow(R / 2.2, 2);
  var dens = new Float32Array(W * W), maxD = 0;
  pts.forEach(function(a) {
    // 기록 필드는 부채꼴로 그려지므로 화면 위치로 변환
    var fp = window._fieldPos ? window._fieldPos(a) : [a.x, a.y];
    var px = fp[0] * W, py = fp[1] * W;
    var x0 = Math.max(0, Math.floor(px - R)), x1 = Math.min(W - 1, Math.ceil(px + R));
    var y0 = Math.max(0, Math.floor(py - R)), y1 = Math.min(W - 1, Math.ceil(py + R));
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        var i = y * W + x, v = dens[i] + Math.exp(-d2 / sig2);
        dens[i] = v;
        if (v > maxD) maxD = v;
      }
    }
  });
  // 가장 몰린 곳 = 최대 색. 타구가 1~2개뿐일 때 과장되지 않게 최소 기준 2
  var norm = Math.max(maxD, 2);

  // --- Apply color LUT ---
  if (!_offCvs) _offCvs = document.createElement('canvas');
  _offCvs.width = W;
  _offCvs.height = W;
  var oCtx = _offCvs.getContext('2d');
  var img = oCtx.createImageData(W, W);
  var d = img.data;
  for (var k = 0; k < dens.length; k++) {
    if (!dens[k]) continue;
    var li = Math.min(255, Math.round(dens[k] / norm * 255)) * 4;
    var o = k * 4;
    d[o]     = _LUT[li];
    d[o + 1] = _LUT[li + 1];
    d[o + 2] = _LUT[li + 2];
    d[o + 3] = _LUT[li + 3];
  }
  oCtx.putImageData(img, 0, 0);

  // --- Scale up to display canvas; blur for smooth gradients (페어 지역 안에만) ---
  var blurPx = Math.max(2, Math.round(S * 0.012));
  ctx.save();
  if (window._fieldGeo && window._conePt && window._fenceR) {
    var g = window._fieldGeo(S), Q = Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(g.cx, g.cy);
    for (var j = 0; j <= 48; j++) {
      var ph = Q + 2 * Q * j / 48, p = window._conePt(g, ph, window._fenceR(g, ph));
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.clip();
  }
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

  // 경기 리셋 시 히트맵 자동 OFF
  if (window.AS && typeof window.AS.on === 'function') {
    window.AS.on('reset', function() {
      _hmOn = false;
      var btn = document.getElementById('hmDensityBtn');
      if (btn) { btn.style.opacity = '0.5'; btn.style.borderColor = ''; btn.style.color = ''; }
      var cvs = document.getElementById('hmCanvas');
      if (cvs) { var ctx = cvs.getContext('2d'); ctx.clearRect(0, 0, cvs.width, cvs.height); }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}
