/**
 * OCR Lineup Import — SprayLab
 * Uses Tesseract.js (CDN, lazy-loaded) for client-side Korean OCR
 */

(function(){
  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────
  var _team = 'home';          // 'home' | 'away'
  var _parsedPlayers = [];     // [{order, name, pos, num, bh}]
  var _tessReady = false;
  var _tessLoading = false;

  // ─────────────────────────────────────────────
  // Position normalization
  // ─────────────────────────────────────────────
  var POS_MAP = {
    '투':  '투수', '투수': '투수', 'P':  '투수', 'SP': '투수', 'RP': '투수',
    '포':  '포수', '포수': '포수', 'C':  '포수',
    '1':   '1루',  '1루': '1루',  '일루': '1루',  '1B': '1루',
    '2':   '2루',  '2루': '2루',  '이루': '2루',  '2B': '2루',
    '3':   '3루',  '3루': '3루',  '삼루': '3루',  '3B': '3루',
    '유':  '유격', '유격': '유격', 'SS': '유격', '쇼트': '유격',
    '좌':  '좌익', '좌익': '좌익', 'LF': '좌익', '레프트': '좌익',
    '중':  '중견', '중견': '중견', 'CF': '중견', '센터': '중견',
    '우':  '우익', '우익': '우익', 'RF': '우익', '라이트': '우익',
    'DH':  'DH',   '지명': 'DH',  '지명타자': 'DH',
  };

  function normalizePos(raw) {
    if (!raw) return '';
    var s = raw.trim().toUpperCase();
    // exact
    if (POS_MAP[s]) return POS_MAP[s];
    // check starts-with Korean
    var kr = raw.trim();
    for (var k in POS_MAP) {
      if (kr.startsWith(k)) return POS_MAP[k];
    }
    // check uppercase
    for (var k2 in POS_MAP) {
      if (s.startsWith(k2.toUpperCase())) return POS_MAP[k2];
    }
    return raw.trim();
  }

  // ─────────────────────────────────────────────
  // OCR text parser
  // ─────────────────────────────────────────────
  // Matches a Korean name: 2-4 Hangul characters
  var KO_NAME_RE = /[가-힣]{2,4}/g;
  // Header keywords to skip
  var SKIP_WORDS = ['타순','위치','성명','배번','선발','라인업','lineup','line','홈','원정','팀','team'];

  function parseOcrText(text) {
    var lines = text.split(/\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var players = [];

    lines.forEach(function(line) {
      var lc = line.toLowerCase();
      // skip header lines
      if (SKIP_WORDS.some(function(w){ return lc.includes(w); })) return;

      // extract Korean name(s)
      var names = line.match(KO_NAME_RE);
      if (!names || !names.length) return;

      // Pick longest Korean sequence as name (avoids single-char position abbreviations)
      var name = names.reduce(function(a,b){ return b.length >= a.length ? b : a; }, '');
      if (name.length < 2) return;

      // extract numbers (jersey number = last 1-3 digit sequence; first number = batting order)
      var nums = line.match(/\d+/g) || [];
      var order = null, num = '';
      if (nums.length === 1) {
        // ambiguous: could be order or jersey
        var n = parseInt(nums[0]);
        if (n >= 1 && n <= 9) { order = n; }
        else { num = nums[0]; }
      } else if (nums.length >= 2) {
        order = parseInt(nums[0]);
        // last distinct number is jersey
        num = nums[nums.length - 1];
        if (num === nums[0]) num = nums.length > 1 ? nums[1] : '';
      }

      // extract position: any word before or after name that maps to a position
      var posRaw = '';
      // try to find position token (non-number, non-name part)
      var tokens = line.split(/\s+/);
      tokens.forEach(function(tok) {
        if (!tok) return;
        // skip if it's the name or a pure number
        if (tok === name || /^\d+$/.test(tok)) return;
        var norm = normalizePos(tok);
        if (norm && norm !== tok) { posRaw = norm; }
      });
      // also try single-char position prefix before name
      if (!posRaw) {
        var idx = line.indexOf(name);
        if (idx > 0) {
          var before = line.substring(0, idx).replace(/\d/g,'').trim();
          if (before) posRaw = normalizePos(before);
        }
      }

      players.push({
        order: order,
        name: name,
        pos: posRaw || '',
        num: num || '',
        bh: ''
      });
    });

    // Sort by order if available
    players.sort(function(a,b){
      if (a.order && b.order) return a.order - b.order;
      return 0;
    });

    return players;
  }

  // ─────────────────────────────────────────────
  // Tesseract.js loader
  // ─────────────────────────────────────────────
  function loadTesseract(cb) {
    if (window.Tesseract) { cb(); return; }
    if (_tessLoading) { var t = setInterval(function(){ if(window.Tesseract){clearInterval(t);cb();} }, 200); return; }
    _tessLoading = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = function(){ _tessLoading = false; _tessReady = true; cb(); };
    s.onerror = function(){ _tessLoading = false; alert('Tesseract.js 로딩 실패. 인터넷 연결을 확인하세요.'); };
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────
  // UI helpers
  // ─────────────────────────────────────────────
  function setStatus(msg, pct) {
    var el = document.getElementById('ocrStatusText');
    var bar = document.getElementById('ocrProgressBar');
    var wrap = document.getElementById('ocrStatus');
    if (wrap) wrap.style.display = 'block';
    if (el) el.textContent = msg;
    if (bar && pct != null) bar.style.width = pct + '%';
  }

  function hideStatus() {
    var wrap = document.getElementById('ocrStatus');
    if (wrap) wrap.style.display = 'none';
  }

  function renderPlayerList(players) {
    var wrap = document.getElementById('ocrResultWrap');
    var list = document.getElementById('ocrPlayerList');
    var applyBtn = document.getElementById('ocrApplyBtn');
    var rawBtn = document.getElementById('ocrRawToggleBtn');
    if (!list) return;

    if (!players.length) {
      list.innerHTML = '<div style="color:#ef4444;font-size:12px;padding:8px">인식된 선수가 없습니다. 원문 보기로 수동 수정해보세요.</div>';
      if (wrap) wrap.style.display = 'block';
      if (rawBtn) rawBtn.style.display = 'block';
      return;
    }

    var posOptions = ['','투수','포수','1루','2루','3루','유격','좌익','중견','우익','DH'];
    var bhOptions = [['','타석'],['R','우타'],['L','좌타'],['S','스위치']];

    list.innerHTML = players.map(function(p, i) {
      var posOpts = posOptions.map(function(o){ return '<option value="'+o+'"'+(o===p.pos?' selected':'')+'>'+( o||'포지션')+'</option>'; }).join('');
      var bhOpts = bhOptions.map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===p.bh?' selected':'')+'>'+o[1]+'</option>'; }).join('');
      return '<div style="display:flex;align-items:center;gap:5px;padding:4px 0;border-bottom:1px solid #1e1e2a" data-idx="'+i+'">'
        + '<span style="font-size:10px;color:#434c5e;min-width:16px;font-weight:700">'+(p.order||i+1)+'</span>'
        + '<input style="flex:1;min-width:0;background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#c9d1d9;font-size:12px;padding:4px 6px" value="'+escHtml(p.name)+'" data-field="name" data-idx="'+i+'" oninput="window._ocrUpdatePlayer(this)">'
        + '<input style="width:38px;background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#c9d1d9;font-size:12px;padding:4px 4px;text-align:center" value="'+escHtml(p.num)+'" placeholder="#" data-field="num" data-idx="'+i+'" oninput="window._ocrUpdatePlayer(this)">'
        + '<select style="background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#9ca3af;font-size:11px;padding:3px 2px" data-field="pos" data-idx="'+i+'" onchange="window._ocrUpdatePlayer(this)">'+posOpts+'</select>'
        + '<select style="background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#9ca3af;font-size:11px;padding:3px 2px" data-field="bh" data-idx="'+i+'" onchange="window._ocrUpdatePlayer(this)">'+bhOpts+'</select>'
        + '<button onclick="window._ocrRemovePlayer('+i+')" style="background:none;border:none;color:#6b7280;font-size:16px;cursor:pointer;padding:0 2px;line-height:1">✕</button>'
        + '</div>';
    }).join('');

    if (wrap) wrap.style.display = 'block';
    if (applyBtn) applyBtn.style.display = 'block';
    if (rawBtn) rawBtn.style.display = 'block';
  }

  function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─────────────────────────────────────────────
  // Public API (attached to window)
  // ─────────────────────────────────────────────
  window.ocrModalOpen = function() {
    // detect which team panel is active (lpSel)
    var lpSel = document.getElementById('lpSel');
    _team = (lpSel && lpSel.value === 'away') ? 'away' : 'home';
    _ocrUpdateTeamBtns();

    var modal = document.getElementById('ocrModal');
    if (modal) { modal.style.display = 'block'; document.body.style.overflow = 'hidden'; }
    // reset state
    _parsedPlayers = [];
    ['ocrImgWrap','ocrStatus','ocrResultWrap','ocrRawWrap'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.style.display='none';
    });
    ['ocrApplyBtn','ocrRawToggleBtn'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.style.display='none';
    });
    var fi = document.getElementById('ocrFileInput'); if(fi) fi.value='';
  };

  window.ocrModalClose = function() {
    var modal = document.getElementById('ocrModal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
  };

  window.ocrSetTeam = function(t) {
    _team = t;
    _ocrUpdateTeamBtns();
  };

  function _ocrUpdateTeamBtns() {
    var hBtn = document.getElementById('ocrTeamHome');
    var aBtn = document.getElementById('ocrTeamAway');
    if (!hBtn || !aBtn) return;
    if (_team === 'home') {
      hBtn.style.borderColor = '#4b8cf5'; hBtn.style.color = '#4b8cf5'; hBtn.style.background = '#0f1729';
      aBtn.style.borderColor = '#2a2a3a'; aBtn.style.color = '#6b7280'; aBtn.style.background = '#111118';
    } else {
      aBtn.style.borderColor = '#4b8cf5'; aBtn.style.color = '#4b8cf5'; aBtn.style.background = '#0f1729';
      hBtn.style.borderColor = '#2a2a3a'; hBtn.style.color = '#6b7280'; hBtn.style.background = '#111118';
    }
  }

  window.ocrHandleFile = function(file) {
    if (!file) return;
    // show preview
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = document.getElementById('ocrPreviewImg');
      var wrap = document.getElementById('ocrImgWrap');
      if (img) img.src = e.target.result;
      if (wrap) wrap.style.display = 'block';
    };
    reader.readAsDataURL(file);

    // hide previous results
    ['ocrResultWrap','ocrRawWrap'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.style.display='none';
    });
    ['ocrApplyBtn','ocrRawToggleBtn'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.style.display='none';
    });

    setStatus('Tesseract.js 로딩 중...', 5);

    loadTesseract(function(){
      setStatus('이미지 분석 중...', 15);
      Tesseract.recognize(file, 'kor+eng', {
        logger: function(m) {
          if (m.status === 'recognizing text') {
            setStatus('글자 인식 중... ' + Math.round(m.progress*100) + '%', 15 + Math.round(m.progress*80));
          }
        }
      }).then(function(result) {
        setStatus('파싱 중...', 97);
        var rawText = result.data.text;
        // store raw text
        var rawArea = document.getElementById('ocrRawText');
        if (rawArea) rawArea.value = rawText;
        // parse
        _parsedPlayers = parseOcrText(rawText);
        hideStatus();
        renderPlayerList(_parsedPlayers);
      }).catch(function(err) {
        setStatus('오류: ' + err.message, 100);
      });
    });
  };

  window.ocrToggleRaw = function() {
    var wrap = document.getElementById('ocrRawWrap');
    if (!wrap) return;
    wrap.style.display = (wrap.style.display === 'none' || !wrap.style.display) ? 'block' : 'none';
  };

  window.ocrReparse = function() {
    var rawArea = document.getElementById('ocrRawText');
    if (!rawArea) return;
    _parsedPlayers = parseOcrText(rawArea.value);
    renderPlayerList(_parsedPlayers);
  };

  window._ocrUpdatePlayer = function(el) {
    var idx = parseInt(el.getAttribute('data-idx'));
    var field = el.getAttribute('data-field');
    if (isNaN(idx) || !field || !_parsedPlayers[idx]) return;
    _parsedPlayers[idx][field] = el.value;
  };

  window._ocrRemovePlayer = function(idx) {
    _parsedPlayers.splice(idx, 1);
    renderPlayerList(_parsedPlayers);
  };

  window.ocrApply = function() {
    if (!_parsedPlayers.length) return;

    // switch to the correct team panel
    var lpSel = document.getElementById('lpSel');
    if (lpSel) {
      lpSel.value = _team;
      if (typeof renderLP === 'function') renderLP();
      if (typeof renderMob === 'function') renderMob();
    }

    var added = 0;
    _parsedPlayers.forEach(function(p) {
      if (!p.name) return;
      // fill inputs and call addPlayer
      var pName = document.getElementById('pName');
      var pNum  = document.getElementById('pNum');
      var pPos  = document.getElementById('pPos');
      var pBH   = document.getElementById('pBH');
      if (pName) pName.value = p.name;
      if (pNum)  pNum.value  = p.num || '';
      if (pPos)  pPos.value  = p.pos || '';
      if (pBH)   pBH.value   = p.bh  || '';
      if (typeof addPlayer === 'function') addPlayer();
      added++;
    });

    ocrModalClose();
    // brief toast
    _ocrToast(added + '명 선수가 라인업에 추가됐습니다!');
  };

  function _ocrToast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#4b8cf5;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:700;z-index:99999;pointer-events:none;box-shadow:0 4px 20px rgba(75,140,245,.4)';
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .5s'; }, 2000);
    setTimeout(function(){ document.body.removeChild(t); }, 2600);
  }

})();
