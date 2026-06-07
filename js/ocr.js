/**
 * OCR + Document Lineup Import — SprayLab v3
 * - 사진: Tesseract.js v4 (경로 오버라이드 없음 → CDN 자동 해결)
 * - 문서: txt / csv / xlsx 직접 파싱
 */

(function(){
  var _team = 'home';
  var _parsedPlayers = [];
  var _tessLoading = false;

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
    var t = raw.trim(), u = t.toUpperCase();
    if (POS_MAP[t]) return POS_MAP[t];
    if (POS_MAP[u]) return POS_MAP[u];
    for (var k in POS_MAP) {
      if (t.startsWith(k) || u.startsWith(k.toUpperCase())) return POS_MAP[k];
    }
    return t;
  }

  // ─── Text parser ──────────────────────────────
  var SKIP_RE = /타순|위치|성명|배번|선발|라인업|lineup|line.?up|gyeryong|구장|감독|vs\s/i;

  // OCR 노이즈 문자 제거
  function _cleanOcr(text) {
    return text
      .replace(/[←↵↩⏎＜]/g, ' ')        // 워드 단락 기호
      .replace(/[—–]{2,}/g, ' ')          // 긴 대시
      .replace(/[{}()\[\]™®©°]/g, ' ')    // 괄호류
      .replace(/[_~`^*%#@!$&=+\\]/g, ' ') // 특수문자
      .replace(/\s{2,}/g, ' ');
  }

  function parseOcrText(rawText) {
    var text = _cleanOcr(rawText);
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var players = [];

    lines.forEach(function(line) {
      if (SKIP_RE.test(line)) return;

      // ── 파이프 구분 셀 처리 (| 이 포함된 표 행) ──
      if (line.indexOf('|') >= 0) {
        var cells = line.split(/\|/).map(function(c){ return c.trim(); }).filter(Boolean);
        var name = '', pos = '', num = '', order = null;
        cells.forEach(function(cell) {
          // 한글 이름
          var koM = cell.match(/[가-힣]{2,4}/g);
          if (koM) {
            koM.forEach(function(m) {
              if (!POS_MAP[m] && m.length >= name.length) name = m;
            });
          }
          // 영문 포지션
          var ep = cell.match(/^(DH|SP|RP|SS|LF|CF|RF|1B|2B|3B|C|P)$/i);
          if (ep) { var pn = normalizePos(ep[0].toUpperCase()); if (pn) pos = pn; }
          // 한글 포지션
          if (!pos) {
            var pn2 = normalizePos(cell);
            if (pn2 && pn2 !== cell) pos = pn2;
          }
          // 숫자
          var nm = cell.match(/^\d{1,3}$/);
          if (nm) {
            var n = parseInt(nm[0]);
            if (n >= 1 && n <= 9 && order === null) order = n;
            else if (n > 0) num = nm[0];
          }
        });
        if (name) { players.push({ order:order, name:name, pos:pos, num:num, bh:'' }); }
        return;
      }

      // ── 일반 라인 처리 ─────────────────────────
      var nameMatches = line.match(/[가-힣]{2,4}/g);
      if (!nameMatches) return;

      var name2 = '';
      nameMatches.forEach(function(m) {
        if (!POS_MAP[m] && m.length > name2.length) name2 = m;
      });
      if (!name2 || name2.length < 2) return;

      var nums = line.match(/\d+/g) || [];
      var order2 = null, num2 = '';
      if (nums.length === 1) {
        var nv = parseInt(nums[0]);
        if (nv >= 1 && nv <= 9) order2 = nv; else num2 = nums[0];
      } else if (nums.length >= 2) {
        order2 = parseInt(nums[0]);
        num2 = nums[nums.length - 1];
        if (nums[0] === nums[nums.length-1]) num2 = nums.length>1 ? nums[1] : '';
      }

      var posRaw = '';
      var engPos = line.match(/\b(DH|SP|RP|SS|LF|CF|RF|1B|2B|3B|[CP])\b/);
      if (engPos) posRaw = normalizePos(engPos[0].toUpperCase());
      if (!posRaw) {
        line.split(/\s+/).forEach(function(tok) {
          if (!tok || tok === name2 || /^\d+$/.test(tok)) return;
          var n3 = normalizePos(tok);
          if (n3 && n3 !== tok) posRaw = n3;
        });
      }

      players.push({ order:order2, name:name2, pos:posRaw||'', num:num2||'', bh:'' });
    });

    players.sort(function(a,b){
      if (a.order != null && b.order != null) return a.order - b.order;
      return 0;
    });
    return players;
  }

  // ─── Image preprocessing ──────────────────────
  // 1) 2400px 이상으로 확대 (작은 셀 텍스트 인식률 향상)
  // 2) 표 격자선 제거 (세로/가로 선이 OCR을 방해하는 문제 해결)
  function preprocessImage(file, cb) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      // 항상 2400px 너비로 확대 (작은 사진도 포함)
      var TARGET = 2400;
      var scale = img.width < TARGET ? TARGET / img.width : 1;
      var w = Math.round(img.width * scale);
      var h = Math.round(img.height * scale);

      var cvs = document.createElement('canvas');
      cvs.width = w; cvs.height = h;
      var ctx = cvs.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      // 표 격자선 제거
      _removeTableLines(ctx, w, h);

      cb(cvs.toDataURL('image/png'));
    };
    img.onerror = function(){ URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  // 표 격자선 제거 — 픽셀 밀도 기반 (안티앨리어싱에 강함)
  function _removeTableLines(ctx, w, h) {
    var id = ctx.getImageData(0, 0, w, h);
    var d  = id.data;

    // 그레이스케일
    var gray = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i++) {
      gray[i] = (77*d[i*4] + 150*d[i*4+1] + 29*d[i*4+2]) >> 8;
    }

    // 이진화 (임계값 180 — 안티앨리어싱된 회색 선도 검정으로 처리)
    var bin = new Uint8Array(w * h);
    for (var j = 0; j < gray.length; j++) {
      bin[j] = gray[j] < 180 ? 0 : 255; // 0=검정, 255=흰색
    }

    var PAD = 4;

    // 수직선: 열(column) 내 검정 픽셀 비율이 25% 이상이면 선으로 판단
    for (var x = 0; x < w; x++) {
      var dark = 0;
      for (var y = 0; y < h; y++) { if (bin[y*w+x] === 0) dark++; }
      if (dark / h >= 0.25) {
        for (var y2 = 0; y2 < h; y2++) {
          for (var dx = -PAD; dx <= PAD; dx++) {
            var xx = x+dx; if (xx<0||xx>=w) continue;
            var p = (y2*w+xx)*4;
            d[p]=d[p+1]=d[p+2]=255;
          }
        }
      }
    }

    // 수평선: 행(row) 내 검정 픽셀 비율이 40% 이상이면 선으로 판단
    // (텍스트 행은 40% 미만 — 헤더 배경바만 제거)
    for (var yr = 0; yr < h; yr++) {
      var darkH = 0;
      for (var xr = 0; xr < w; xr++) { if (bin[yr*w+xr] === 0) darkH++; }
      if (darkH / w >= 0.40) {
        for (var xr2 = 0; xr2 < w; xr2++) {
          for (var dy = -PAD; dy <= PAD; dy++) {
            var yy = yr+dy; if (yy<0||yy>=h) continue;
            var p2 = (yy*w+xr2)*4;
            d[p2]=d[p2+1]=d[p2+2]=255;
          }
        }
      }
    }

    ctx.putImageData(id, 0, 0);
  }

  // ─── Tesseract loader (경로 오버라이드 없음) ────
  function loadTesseract(cb) {
    if (window.Tesseract) { cb(null); return; }
    if (_tessLoading) {
      var t = setInterval(function(){ if(window.Tesseract){clearInterval(t);cb(null);} }, 300);
      return;
    }
    _tessLoading = true;
    setStatus('OCR 엔진 로딩 중 (최초 1회)...', 5);
    var s = document.createElement('script');
    // v4 안정 버전 — 경로를 스스로 해결함
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.4/dist/tesseract.min.js';
    s.onload  = function(){ _tessLoading = false; cb(null); };
    s.onerror = function(){
      _tessLoading = false;
      // fallback: unpkg
      var s2 = document.createElement('script');
      s2.src = 'https://unpkg.com/tesseract.js@4.1.4/dist/tesseract.min.js';
      s2.onload  = function(){ cb(null); };
      s2.onerror = function(){ cb(new Error('OCR 라이브러리 로딩 실패. 인터넷 연결을 확인하세요.')); };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  }

  function runTesseract(dataUrl, progressCb, doneCb) {
    loadTesseract(function(err) {
      if (err) { doneCb(err, null); return; }
      setStatus('한국어 언어팩 다운로드 중... (~10MB, 최초 1회)', 12);

      // ★ createWorker — langPath를 jsdelivr로 명시 (tessdata.projectnaptha.com 느림/차단 우회)
      var worker;
      try {
        Tesseract.createWorker('kor+eng', 1, {
          langPath: 'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0',
          logger: function(m) {
            if (m.status === 'loading tesseract core')
              setStatus('OCR 코어 초기화...', 15);
            if (m.status === 'loading language traineddata')
              setStatus('🇰🇷 한국어 데이터 로딩 중... ' + Math.round((m.progress||0)*100) + '% (최초 1회 ~5초)', 15 + Math.round((m.progress||0)*60));
            if (m.status === 'recognizing text')
              setStatus('글자 인식 중... ' + Math.round((m.progress||0)*100) + '%', 75 + Math.round((m.progress||0)*20));
          }
        }).then(function(w) {
          worker = w;
          // PSM 6: 균일 블록 — 표 형태에 적합
          return w.setParameters({ tessedit_pageseg_mode: '6' }).then(function(){ return w.recognize(dataUrl); });
        }).then(function(result) {
          if (worker) worker.terminate();
          doneCb(null, result.data.text);
        }).catch(function(e) {
          if (worker) try{ worker.terminate(); }catch(x){}
          _fallbackRecognize(dataUrl, doneCb);
        });
      } catch(e2) {
        _fallbackRecognize(dataUrl, doneCb);
      }
    });
  }

  // createWorker 실패 시 구형 API 폴백
  function _fallbackRecognize(dataUrl, doneCb) {
    setStatus('OCR 재시도 중...', 30);
    try {
      Tesseract.recognize(dataUrl, 'kor+eng', {
        logger: function(m) {
          if (m.status === 'recognizing text') {
            setStatus('글자 인식 중... ' + Math.round((m.progress||0)*100) + '%', 40 + Math.round((m.progress||0)*55));
          }
        }
      }).then(function(r){ doneCb(null, r.data.text); })
        .catch(function(e){ doneCb(e, null); });
    } catch(e) {
      doneCb(e, null);
    }
  }

  // ─── Document parsers ─────────────────────────
  function parseCsv(text) {
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    if (!lines.length) return [];
    var delim = lines[0].includes('\t') ? '\t' : ',';
    var headers = lines[0].split(delim).map(function(h){ return h.trim().toLowerCase().replace(/\s/g,''); });

    function fc(candidates) {
      for (var i=0;i<candidates.length;i++){ var x=headers.indexOf(candidates[i]); if(x>=0) return x; }
      return -1;
    }
    var iOrder = fc(['타순','order','no','순번']);
    var iName  = fc(['성명','이름','name','선수명','선수']);
    var iPos   = fc(['위치','포지션','pos','position']);
    var iNum   = fc(['배번','등번호','num','#','번호']);
    var iBH    = fc(['타석','타격방향','bh','bat']);

    if (iName < 0) return parseOcrText(text);

    var players = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = lines[i].split(delim).map(function(c){ return c.trim(); });
      var name = cols[iName] || '';
      if (!name) continue;
      players.push({
        order: iOrder>=0 ? parseInt(cols[iOrder])||null : null,
        name : name,
        pos  : iPos>=0  ? normalizePos(cols[iPos]) : '',
        num  : iNum>=0  ? cols[iNum] : '',
        bh   : iBH>=0   ? _normBH(cols[iBH]) : '',
      });
    }
    return players;
  }

  function parseXlsx(arrayBuf) {
    try {
      var wb = XLSX.read(arrayBuf, {type:'array'});
      var ws = wb.Sheets[wb.SheetNames[0]];
      return parseCsv(XLSX.utils.sheet_to_csv(ws, {FS:','}));
    } catch(e) { return []; }
  }

  function _normBH(s) {
    if (!s) return '';
    var u = s.toUpperCase().trim();
    if (u==='R'||u==='우타'||u==='우') return 'R';
    if (u==='L'||u==='좌타'||u==='좌') return 'L';
    if (u==='S'||u==='스위치') return 'S';
    return '';
  }

  // ─── UI ───────────────────────────────────────
  function setStatus(msg, pct) {
    var wrap=document.getElementById('ocrStatus');
    var el=document.getElementById('ocrStatusText');
    var bar=document.getElementById('ocrProgressBar');
    if (wrap) wrap.style.display='block';
    if (el)   el.textContent=msg;
    if (bar && pct!=null) bar.style.width=Math.min(100,pct)+'%';
  }
  function hideStatus() {
    var w=document.getElementById('ocrStatus'); if(w) w.style.display='none';
  }

  function renderPlayerList(players) {
    var wrap    =document.getElementById('ocrResultWrap');
    var list    =document.getElementById('ocrPlayerList');
    var applyBtn=document.getElementById('ocrApplyBtn');
    var rawBtn  =document.getElementById('ocrRawToggleBtn');
    if (!list) return;

    if (!players.length) {
      list.innerHTML='<div style="color:#ef4444;font-size:12px;padding:8px 0">인식된 선수가 없습니다.<br>아래 <b>원문 보기</b>로 OCR 결과를 확인·수정 후 재파싱 해보세요.</div>';
      if (wrap) wrap.style.display='block';
      if (rawBtn) rawBtn.style.display='block';
      if (applyBtn) applyBtn.style.display='none';
      return;
    }

    var posOpts=['','투수','포수','1루','2루','3루','유격','좌익','중견','우익','DH'];
    var bhOpts=[['','타석'],['R','우타'],['L','좌타'],['S','스위치']];

    list.innerHTML=players.map(function(p,i){
      var po=posOpts.map(function(o){ return '<option value="'+o+'"'+(o===p.pos?' selected':'')+'>'+(o||'포지션')+'</option>'; }).join('');
      var bo=bhOpts.map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===p.bh?' selected':'')+'>'+ o[1]+'</option>'; }).join('');
      return '<div style="display:flex;align-items:center;gap:4px;padding:5px 0;border-bottom:1px solid #1e1e2a">'
        +'<span style="font-size:10px;color:#434c5e;min-width:18px;text-align:center;font-weight:700">'+(p.order||i+1)+'</span>'
        +'<input style="flex:1;min-width:0;background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#c9d1d9;font-size:12px;padding:4px 6px" value="'+esc(p.name)+'" data-field="name" data-idx="'+i+'" oninput="window._ocrUp(this)">'
        +'<input style="width:36px;background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#c9d1d9;font-size:12px;padding:4px 3px;text-align:center" value="'+esc(p.num)+'" placeholder="#" data-field="num" data-idx="'+i+'" oninput="window._ocrUp(this)">'
        +'<select style="background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#9ca3af;font-size:11px;padding:3px 1px" data-field="pos" data-idx="'+i+'" onchange="window._ocrUp(this)">'+po+'</select>'
        +'<select style="background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#9ca3af;font-size:11px;padding:3px 1px" data-field="bh" data-idx="'+i+'" onchange="window._ocrUp(this)">'+bo+'</select>'
        +'<button onclick="window._ocrDel('+i+')" style="background:none;border:none;color:#6b7280;font-size:16px;cursor:pointer;padding:0 2px;flex-shrink:0">✕</button>'
        +'</div>';
    }).join('');

    if (wrap) wrap.style.display='block';
    if (applyBtn) applyBtn.style.display='block';
    if (rawBtn) rawBtn.style.display='block';
  }

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function resetUI() {
    ['ocrImgWrap','ocrStatus','ocrResultWrap','ocrRawWrap'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });
    ['ocrApplyBtn','ocrRawToggleBtn'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });
    var bar=document.getElementById('ocrProgressBar'); if(bar) bar.style.width='0%';
  }

  function finish(players, rawText) {
    var ra=document.getElementById('ocrRawText');
    if (ra && rawText!=null) ra.value=rawText;
    _parsedPlayers=players;
    hideStatus();
    renderPlayerList(players);
  }

  // ─── Public ───────────────────────────────────
  window.ocrModalOpen = function() {
    var lpSel=document.getElementById('lpSel');
    _team=(lpSel && lpSel.value==='away')?'away':'home';
    _syncTeamBtns();
    var modal=document.getElementById('ocrModal');
    if (modal){ modal.style.display='block'; document.body.style.overflow='hidden'; }
    _parsedPlayers=[];
    resetUI();
    var fi=document.getElementById('ocrFileInput'); if(fi) fi.value='';
  };

  window.ocrModalClose = function() {
    var modal=document.getElementById('ocrModal');
    if (modal){ modal.style.display='none'; document.body.style.overflow=''; }
  };

  window.ocrSetTeam = function(t){ _team=t; _syncTeamBtns(); };

  function _syncTeamBtns() {
    var hB=document.getElementById('ocrTeamHome'), aB=document.getElementById('ocrTeamAway');
    if (!hB||!aB) return;
    if (_team==='home') {
      hB.style.borderColor='#4b8cf5'; hB.style.color='#4b8cf5'; hB.style.background='#0f1729';
      aB.style.borderColor='#2a2a3a'; aB.style.color='#6b7280'; aB.style.background='#111118';
    } else {
      aB.style.borderColor='#4b8cf5'; aB.style.color='#4b8cf5'; aB.style.background='#0f1729';
      hB.style.borderColor='#2a2a3a'; hB.style.color='#6b7280'; hB.style.background='#111118';
    }
  }

  window.ocrHandleFile = function(file) {
    if (!file) return;
    resetUI();
    _parsedPlayers=[];

    var ext=(file.name||'').split('.').pop().toLowerCase();
    var type=file.type||'';

    // ── 이미지 ────────────────────────────────
    if (type.startsWith('image/') || /^(jpg|jpeg|png|gif|bmp|webp|heic|heif|tiff?)$/.test(ext)) {
      var rd=new FileReader();
      rd.onload=function(e){
        var pi=document.getElementById('ocrPreviewImg'), pw=document.getElementById('ocrImgWrap');
        if(pi) pi.src=e.target.result; if(pw) pw.style.display='block';
      };
      rd.readAsDataURL(file);

      setStatus('이미지 전처리 중...', 5);
      preprocessImage(file, function(dataUrl) {
        if (!dataUrl){ setStatus('이미지 로딩 실패', 100); return; }
        runTesseract(dataUrl, null, function(err, rawText) {
          if (err){ setStatus('OCR 오류: '+err.message, 100); return; }
          setStatus('파싱 중...', 98);
          finish(parseOcrText(rawText), rawText);
        });
      });
      return;
    }

    // ── 텍스트 / CSV ──────────────────────────
    if (type==='text/plain'||type==='text/csv'||ext==='txt'||ext==='csv') {
      var rd2=new FileReader();
      rd2.onload=function(e){ finish(ext==='csv'?parseCsv(e.target.result):parseOcrText(e.target.result), e.target.result); };
      rd2.readAsText(file,'UTF-8');
      return;
    }

    // ── Excel ─────────────────────────────────
    if (type.includes('spreadsheet')||type.includes('excel')||ext==='xlsx'||ext==='xls') {
      if (typeof XLSX==='undefined'){ setStatus('Excel 라이브러리 없음',100); return; }
      setStatus('Excel 읽는 중...', 20);
      var rd3=new FileReader();
      rd3.onload=function(e){
        var buf=new Uint8Array(e.target.result);
        var players=parseXlsx(buf);
        var wb=XLSX.read(buf,{type:'array'});
        var csv=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
        finish(players, csv);
      };
      rd3.readAsArrayBuffer(file);
      return;
    }

    setStatus('지원하지 않는 형식 (이미지/txt/csv/xlsx)', 100);
  };

  window.ocrToggleRaw = function() {
    var w=document.getElementById('ocrRawWrap');
    if (!w) return;
    w.style.display=(w.style.display==='none'||!w.style.display)?'block':'none';
  };

  window.ocrReparse = function() {
    var ra=document.getElementById('ocrRawText'); if(!ra) return;
    _parsedPlayers=parseOcrText(ra.value);
    renderPlayerList(_parsedPlayers);
  };

  window._ocrUp = function(el) {
    var idx=parseInt(el.getAttribute('data-idx')), fld=el.getAttribute('data-field');
    if (!isNaN(idx) && fld && _parsedPlayers[idx]) _parsedPlayers[idx][fld]=el.value;
  };
  window._ocrDel = function(idx) { _parsedPlayers.splice(idx,1); renderPlayerList(_parsedPlayers); };

  window.ocrApply = function() {
    if (!_parsedPlayers.length) return;
    var lpSel=document.getElementById('lpSel');
    if (lpSel){ lpSel.value=_team; if(typeof renderLP==='function')renderLP(); if(typeof renderMob==='function')renderMob(); }
    var added=0;
    _parsedPlayers.forEach(function(p) {
      if (!p.name) return;
      var n=document.getElementById('pName'), nu=document.getElementById('pNum'), po=document.getElementById('pPos'), bh=document.getElementById('pBH');
      if(n) n.value=p.name; if(nu) nu.value=p.num||''; if(po) po.value=p.pos||''; if(bh) bh.value=p.bh||'';
      if (typeof addPlayer==='function') addPlayer();
      added++;
    });
    ocrModalClose();
    _toast(added+'명이 라인업에 추가됐습니다! 🎉');
  };

  function _toast(msg) {
    var t=document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#4b8cf5;color:#fff;padding:10px 22px;border-radius:20px;font-size:13px;font-weight:700;z-index:99999;pointer-events:none;box-shadow:0 4px 20px rgba(75,140,245,.4);white-space:nowrap';
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .5s'; },2200);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },2800);
  }

})();
