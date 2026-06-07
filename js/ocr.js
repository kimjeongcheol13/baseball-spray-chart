/**
 * OCR + Document Lineup Import — SprayLab v2
 * - 사진: Tesseract.js v4 (kor+eng) + 이미지 전처리
 * - 문서: txt / csv / xlsx 직접 파싱
 */

(function(){
  // ─── State ────────────────────────────────────
  var _team = 'home';
  var _parsedPlayers = [];
  var _tessLoading = false;

  // ─── CDN URLs (v4 명시적 경로) ─────────────────
  var TESS_SCRIPT  = 'https://unpkg.com/tesseract.js@4.1.1/dist/tesseract.min.js';
  var TESS_WORKER  = 'https://unpkg.com/tesseract.js@4.1.1/dist/worker.min.js';
  var TESS_CORE    = 'https://unpkg.com/tesseract.js-core@4.0.4/tesseract-core.wasm.js';
  var TESS_LANG    = 'https://tessdata.projectnaptha.com/4.0.0';

  // ─── Position map ─────────────────────────────
  var POS_MAP = {
    '투수':'투수','투':'투수','P':'투수','SP':'투수','RP':'투수',
    '포수':'포수','포':'포수','C':'포수',
    '1루':'1루','1B':'1루','일루':'1루',
    '2루':'2루','2B':'2루','이루':'2루',
    '3루':'3루','3B':'3루','삼루':'3루',
    '유격':'유격','유':'유격','SS':'유격',
    '좌익':'좌익','좌':'좌익','LF':'좌익',
    '중견':'중견','중':'중견','CF':'중견',
    '우익':'우익','우':'우익','RF':'우익',
    'DH':'DH','지명':'DH','지명타자':'DH',
  };

  function normalizePos(raw) {
    if (!raw) return '';
    var trimmed = raw.trim();
    var upper = trimmed.toUpperCase();
    if (POS_MAP[trimmed]) return POS_MAP[trimmed];
    if (POS_MAP[upper])   return POS_MAP[upper];
    for (var k in POS_MAP) {
      if (trimmed.startsWith(k) || upper.startsWith(k.toUpperCase())) return POS_MAP[k];
    }
    return trimmed;
  }

  // ─── Parser: raw text → player list ───────────
  var KO_NAME_RE = /[가-힣]{2,4}/;
  var SKIP_RE    = /타순|위치|성명|배번|선발|라인업|lineup|line.?up|홈팀|원정팀|팀명|team/i;

  function parseOcrText(text) {
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var players = [];

    lines.forEach(function(line) {
      if (SKIP_RE.test(line)) return;

      // must contain a Korean name
      var nameMatch = line.match(/[가-힣]{2,4}/g);
      if (!nameMatch) return;

      // pick the longest Korean chunk that isn't a known position word
      var name = '';
      nameMatch.forEach(function(m) {
        if (POS_MAP[m]) return; // skip position keywords like '투수'
        if (m.length >= (name.length || 2) && m.length <= 4) name = m;
      });
      if (!name) {
        // fallback: longest match regardless
        name = nameMatch.reduce(function(a,b){ return b.length>a.length?b:a; },'');
      }
      if (!name || name.length < 2) return;

      // numbers in line
      var nums = line.match(/\d+/g) || [];
      var order = null, num = '';
      if (nums.length === 1) {
        var n = parseInt(nums[0]);
        if (n >= 1 && n <= 9) order = n; else num = nums[0];
      } else if (nums.length >= 2) {
        order = parseInt(nums[0]);
        num   = nums[nums.length - 1];
        if (num === nums[0] && nums.length > 1) num = nums[1];
      }

      // position: token that isn't name/number
      var posRaw = '';
      line.split(/\s+/).forEach(function(tok) {
        if (!tok || tok === name || /^\d+$/.test(tok)) return;
        var n2 = normalizePos(tok);
        if (n2 && n2 !== tok) posRaw = n2;
      });
      // fallback: chars before name
      if (!posRaw) {
        var idx = line.indexOf(name);
        if (idx > 0) {
          var before = line.substring(0, idx).replace(/\d/g,'').trim();
          if (before) posRaw = normalizePos(before);
        }
      }

      players.push({ order:order, name:name, pos:posRaw||'', num:num||'', bh:'' });
    });

    players.sort(function(a,b){
      if (a.order != null && b.order != null) return a.order - b.order;
      return 0;
    });
    return players;
  }

  // ─── Image preprocessing ──────────────────────
  // 리사이즈 + 그레이스케일 + 대비 강화 → OCR 정확도 향상
  function preprocessImage(file, cb) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      var MAX = 1800;
      var scale = img.width > MAX ? MAX / img.width : 1;
      var w = Math.round(img.width * scale);
      var h = Math.round(img.height * scale);

      var cvs = document.createElement('canvas');
      cvs.width = w; cvs.height = h;
      var ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      // grayscale + contrast
      var id = ctx.getImageData(0, 0, w, h);
      var d  = id.data;
      for (var i = 0; i < d.length; i += 4) {
        var g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
        // contrast factor 1.6, brightness +10
        g = Math.min(255, Math.max(0, (g - 128) * 1.6 + 138));
        d[i] = d[i+1] = d[i+2] = g;
        // alpha unchanged
      }
      ctx.putImageData(id, 0, 0);

      cb(cvs.toDataURL('image/png'));
    };
    img.onerror = function(){ URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  // ─── Tesseract loader ─────────────────────────
  function loadTesseract(cb) {
    if (window.Tesseract) { cb(null); return; }
    if (_tessLoading) {
      var t = setInterval(function(){ if(window.Tesseract){clearInterval(t);cb(null);} }, 300);
      return;
    }
    _tessLoading = true;
    setStatus('OCR 엔진 로딩 중 (최초 1회, 약 3~5초)...', 3);
    var s = document.createElement('script');
    s.src = TESS_SCRIPT;
    s.onload  = function(){ _tessLoading = false; cb(null); };
    s.onerror = function(){ _tessLoading = false; cb(new Error('Tesseract.js 로딩 실패')); };
    document.head.appendChild(s);
  }

  function runTesseract(dataUrl, cb) {
    loadTesseract(function(err) {
      if (err) { cb(err, null); return; }
      setStatus('언어 데이터 로딩 중... (kor+eng)', 10);
      Tesseract.recognize(dataUrl, 'kor+eng', {
        workerPath : TESS_WORKER,
        corePath   : TESS_CORE,
        langPath   : TESS_LANG,
        logger: function(m) {
          if (m.status === 'loading tesseract core')    setStatus('OCR 코어 로딩 중...', 12);
          if (m.status === 'initializing tesseract')    setStatus('OCR 초기화 중...', 20);
          if (m.status === 'loading language traineddata') setStatus('한국어 데이터 로딩 중...', 30);
          if (m.status === 'recognizing text') {
            var pct = 40 + Math.round(m.progress * 55);
            setStatus('글자 인식 중... ' + Math.round(m.progress * 100) + '%', pct);
          }
        }
      }).then(function(r){ cb(null, r.data.text); })
        .catch(function(e){ cb(e, null); });
    });
  }

  // ─── Document parsers ─────────────────────────
  // TXT / CSV: 한 줄에 선수 정보 (탭/콤마/공백 구분)
  function parseTextDoc(text) {
    return parseOcrText(text);  // 같은 파서 재사용
  }

  function parseCsv(text) {
    // CSV: 열 순서 자동 감지 (헤더가 있으면 사용)
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    if (!lines.length) return [];

    // detect delimiter
    var delim = lines[0].includes('\t') ? '\t' : ',';
    var headers = lines[0].split(delim).map(function(h){ return h.trim().toLowerCase(); });

    // find column indices
    var iOrder = _findCol(headers, ['타순','order','no','번호']);
    var iName  = _findCol(headers, ['성명','이름','name','선수']);
    var iPos   = _findCol(headers, ['위치','포지션','pos','position']);
    var iNum   = _findCol(headers, ['배번','등번호','num','#','번호']);
    var iBH    = _findCol(headers, ['타석','타격','bh','bat']);

    var hasHeader = iName >= 0 || iOrder >= 0;
    var startLine = hasHeader ? 1 : 0;

    if (!hasHeader) {
      // no header → fall back to text parser
      return parseOcrText(text);
    }

    var players = [];
    for (var i = startLine; i < lines.length; i++) {
      var cols = lines[i].split(delim).map(function(c){ return c.trim(); });
      var name = iName >= 0 ? cols[iName] : '';
      if (!name || !(/[가-힣]{2,4}/.test(name))) {
        // try OCR text fallback on this line
        var fallback = parseOcrText(lines[i]);
        if (fallback.length) players = players.concat(fallback);
        continue;
      }
      players.push({
        order: iOrder >= 0 ? parseInt(cols[iOrder])||null : null,
        name : name,
        pos  : iPos >= 0 ? normalizePos(cols[iPos]) : '',
        num  : iNum >= 0 ? cols[iNum] : '',
        bh   : iBH  >= 0 ? _normBH(cols[iBH]) : '',
      });
    }
    return players;
  }

  function parseXlsx(arrayBuf) {
    try {
      var wb = XLSX.read(arrayBuf, {type:'array'});
      var ws = wb.Sheets[wb.SheetNames[0]];
      var csv = XLSX.utils.sheet_to_csv(ws, {FS:','});
      return parseCsv(csv);
    } catch(e) {
      return [];
    }
  }

  function _findCol(headers, candidates) {
    for (var ci = 0; ci < candidates.length; ci++) {
      var idx = headers.indexOf(candidates[ci]);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function _normBH(s) {
    if (!s) return '';
    var u = s.toUpperCase().trim();
    if (u==='R'||u==='우타'||u==='우') return 'R';
    if (u==='L'||u==='좌타'||u==='좌') return 'L';
    if (u==='S'||u==='스위치') return 'S';
    return '';
  }

  // ─── UI helpers ───────────────────────────────
  function setStatus(msg, pct) {
    var wrap = document.getElementById('ocrStatus');
    var el   = document.getElementById('ocrStatusText');
    var bar  = document.getElementById('ocrProgressBar');
    if (wrap) wrap.style.display = 'block';
    if (el)  el.textContent = msg;
    if (bar && pct != null) bar.style.width = Math.min(100, pct) + '%';
  }
  function hideStatus() {
    var w = document.getElementById('ocrStatus');
    if (w) w.style.display = 'none';
  }

  function renderPlayerList(players) {
    var wrap    = document.getElementById('ocrResultWrap');
    var list    = document.getElementById('ocrPlayerList');
    var applyBtn= document.getElementById('ocrApplyBtn');
    var rawBtn  = document.getElementById('ocrRawToggleBtn');
    if (!list) return;

    if (!players.length) {
      list.innerHTML = '<div style="color:#ef4444;font-size:12px;padding:8px 4px">인식된 선수가 없습니다.<br>원문 보기에서 텍스트를 직접 확인·수정한 뒤 재파싱해 보세요.</div>';
      if (wrap) wrap.style.display = 'block';
      if (rawBtn) rawBtn.style.display = 'block';
      if (applyBtn) applyBtn.style.display = 'none';
      return;
    }

    var posOpts = ['','투수','포수','1루','2루','3루','유격','좌익','중견','우익','DH'];
    var bhOpts  = [['','타석'],['R','우타'],['L','좌타'],['S','스위치']];

    list.innerHTML = players.map(function(p, i) {
      var po = posOpts.map(function(o){ return '<option value="'+o+'"'+(o===p.pos?' selected':'')+'>'+(o||'포지션')+'</option>'; }).join('');
      var bo = bhOpts.map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===p.bh?' selected':'')+'>'+ o[1]+'</option>'; }).join('');
      return '<div style="display:flex;align-items:center;gap:4px;padding:5px 0;border-bottom:1px solid #1e1e2a">'
        + '<span style="font-size:10px;color:#434c5e;min-width:18px;font-weight:700;text-align:center">'+(p.order||i+1)+'</span>'
        + '<input style="flex:1;min-width:0;background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#c9d1d9;font-size:12px;padding:4px 6px" value="'+esc(p.name)+'" data-field="name" data-idx="'+i+'" oninput="window._ocrUp(this)">'
        + '<input style="width:36px;background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#c9d1d9;font-size:12px;padding:4px 3px;text-align:center" value="'+esc(p.num)+'" placeholder="#" data-field="num" data-idx="'+i+'" oninput="window._ocrUp(this)">'
        + '<select style="background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#9ca3af;font-size:11px;padding:3px 1px" data-field="pos" data-idx="'+i+'" onchange="window._ocrUp(this)">'+po+'</select>'
        + '<select style="background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#9ca3af;font-size:11px;padding:3px 1px" data-field="bh" data-idx="'+i+'" onchange="window._ocrUp(this)">'+bo+'</select>'
        + '<button onclick="window._ocrDel('+i+')" style="background:none;border:none;color:#6b7280;font-size:16px;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0">✕</button>'
        + '</div>';
    }).join('');

    if (wrap)    wrap.style.display = 'block';
    if (applyBtn) applyBtn.style.display = 'block';
    if (rawBtn)  rawBtn.style.display = 'block';
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function resetResultUI() {
    ['ocrImgWrap','ocrStatus','ocrResultWrap','ocrRawWrap'].forEach(function(id){
      var e=document.getElementById(id); if(e) e.style.display='none';
    });
    ['ocrApplyBtn','ocrRawToggleBtn'].forEach(function(id){
      var e=document.getElementById(id); if(e) e.style.display='none';
    });
    var bar = document.getElementById('ocrProgressBar');
    if (bar) bar.style.width = '0%';
  }

  function finishWithPlayers(players, rawText) {
    var rawArea = document.getElementById('ocrRawText');
    if (rawArea && rawText != null) rawArea.value = rawText;
    _parsedPlayers = players;
    hideStatus();
    renderPlayerList(players);
  }

  // ─── Public API ───────────────────────────────
  window.ocrModalOpen = function() {
    var lpSel = document.getElementById('lpSel');
    _team = (lpSel && lpSel.value === 'away') ? 'away' : 'home';
    _ocrSyncTeamBtns();
    var modal = document.getElementById('ocrModal');
    if (modal) { modal.style.display = 'block'; document.body.style.overflow = 'hidden'; }
    _parsedPlayers = [];
    resetResultUI();
    var fi = document.getElementById('ocrFileInput'); if(fi) fi.value='';
  };

  window.ocrModalClose = function() {
    var modal = document.getElementById('ocrModal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
  };

  window.ocrSetTeam = function(t) { _team = t; _ocrSyncTeamBtns(); };

  function _ocrSyncTeamBtns() {
    var hB = document.getElementById('ocrTeamHome');
    var aB = document.getElementById('ocrTeamAway');
    if (!hB || !aB) return;
    var sel = '#4b8cf5', selBg = '#0f1729', unsel = '#2a2a3a', unselC = '#6b7280', unselBg = '#111118';
    if (_team === 'home') {
      hB.style.cssText += ';border-color:'+sel+';color:'+sel+';background:'+selBg;
      aB.style.cssText += ';border-color:'+unsel+';color:'+unselC+';background:'+unselBg;
    } else {
      aB.style.cssText += ';border-color:'+sel+';color:'+sel+';background:'+selBg;
      hB.style.cssText += ';border-color:'+unsel+';color:'+unselC+';background:'+unselBg;
    }
  }

  window.ocrHandleFile = function(file) {
    if (!file) return;
    resetResultUI();
    _parsedPlayers = [];

    var ext = (file.name || '').split('.').pop().toLowerCase();
    var type = file.type || '';

    // ── 이미지 파일 ──────────────────────────────
    if (type.startsWith('image/') || ['jpg','jpeg','png','gif','bmp','webp','heic','heif'].includes(ext)) {
      // 미리보기
      var rd0 = new FileReader();
      rd0.onload = function(e) {
        var pi = document.getElementById('ocrPreviewImg');
        var pw = document.getElementById('ocrImgWrap');
        if (pi) pi.src = e.target.result;
        if (pw) pw.style.display = 'block';
      };
      rd0.readAsDataURL(file);

      setStatus('이미지 전처리 중...', 5);
      preprocessImage(file, function(dataUrl) {
        if (!dataUrl) { setStatus('이미지 로딩 실패', 100); return; }
        setStatus('OCR 엔진 준비 중...', 8);
        runTesseract(dataUrl, function(err, rawText) {
          if (err) { setStatus('오류: ' + err.message, 100); return; }
          setStatus('파싱 중...', 97);
          finishWithPlayers(parseOcrText(rawText), rawText);
        });
      });
      return;
    }

    // ── 텍스트 / CSV ─────────────────────────────
    if (type === 'text/plain' || type === 'text/csv' || ['txt','csv'].includes(ext)) {
      var rd1 = new FileReader();
      rd1.onload = function(e) {
        var text = e.target.result;
        var players = ext === 'csv' ? parseCsv(text) : parseTextDoc(text);
        finishWithPlayers(players, text);
      };
      rd1.readAsText(file, 'UTF-8');
      return;
    }

    // ── Excel ────────────────────────────────────
    if (type.includes('spreadsheet') || type.includes('excel') || ['xlsx','xls'].includes(ext)) {
      if (typeof XLSX === 'undefined') {
        setStatus('Excel 라이브러리 없음', 100); return;
      }
      setStatus('Excel 파일 읽는 중...', 20);
      var rd2 = new FileReader();
      rd2.onload = function(e) {
        var players = parseXlsx(new Uint8Array(e.target.result));
        // generate CSV text for raw view
        var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
        var csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
        finishWithPlayers(players, csv);
      };
      rd2.readAsArrayBuffer(file);
      return;
    }

    // ── 지원 안 하는 형식 ─────────────────────────
    setStatus('지원하지 않는 파일 형식입니다. (이미지/txt/csv/xlsx)', 100);
  };

  window.ocrToggleRaw = function() {
    var w = document.getElementById('ocrRawWrap');
    if (!w) return;
    w.style.display = (w.style.display === 'none' || !w.style.display) ? 'block' : 'none';
  };

  window.ocrReparse = function() {
    var ra = document.getElementById('ocrRawText');
    if (!ra) return;
    _parsedPlayers = parseOcrText(ra.value);
    renderPlayerList(_parsedPlayers);
  };

  window._ocrUp = function(el) {
    var idx = parseInt(el.getAttribute('data-idx'));
    var fld = el.getAttribute('data-field');
    if (isNaN(idx) || !fld || !_parsedPlayers[idx]) return;
    _parsedPlayers[idx][fld] = el.value;
  };
  window._ocrDel = function(idx) {
    _parsedPlayers.splice(idx, 1);
    renderPlayerList(_parsedPlayers);
  };

  window.ocrApply = function() {
    if (!_parsedPlayers.length) return;
    var lpSel = document.getElementById('lpSel');
    if (lpSel) {
      lpSel.value = _team;
      if (typeof renderLP === 'function') renderLP();
      if (typeof renderMob === 'function') renderMob();
    }
    var added = 0;
    _parsedPlayers.forEach(function(p) {
      if (!p.name) return;
      var pName = document.getElementById('pName');
      var pNum  = document.getElementById('pNum');
      var pPos  = document.getElementById('pPos');
      var pBH   = document.getElementById('pBH');
      if (pName) pName.value = p.name;
      if (pNum)  pNum.value  = p.num  || '';
      if (pPos)  pPos.value  = p.pos  || '';
      if (pBH)   pBH.value   = p.bh   || '';
      if (typeof addPlayer === 'function') addPlayer();
      added++;
    });
    ocrModalClose();
    _ocrToast(added + '명이 라인업에 추가됐습니다! 🎉');
  };

  function _ocrToast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#4b8cf5;color:#fff;padding:10px 22px;border-radius:20px;font-size:13px;font-weight:700;z-index:99999;pointer-events:none;box-shadow:0 4px 20px rgba(75,140,245,.4);white-space:nowrap';
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .5s'; }, 2200);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 2800);
  }

})();
