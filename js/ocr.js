/**
 * OCR + Document Lineup Import — SprayLab v7
 * 사진: OCR.space 무료 API (한국어 서버사이드 OCR, Tesseract.js 대체)
 * 문서: txt / csv / xlsx 직접 파싱
 */

(function(){
  var _team = 'home';
  var _parsedPlayers = [];

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

  // ─── OCR.space API ────────────────────────────
  var OCR_API = 'https://api.ocr.space/parse/image';
  var OCR_KEY = 'helloworld'; // 무료 데모 키 (월 500회)

  // 이미지를 800px 이하로 리사이즈 후 base64 변환 (1MB 제한 대응)
  function _resizeToBase64(file, cb) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      var MAX = 900;
      var scale = img.width > MAX ? MAX / img.width : 1;
      var w = Math.round(img.width * scale);
      var h = Math.round(img.height * scale);
      var cvs = document.createElement('canvas');
      cvs.width = w; cvs.height = h;
      var ctx = cvs.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cb(cvs.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = function(){ URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  function runOcrSpace(file, doneCb) {
    setStatus('이미지 준비 중...', 10);
    _resizeToBase64(file, function(base64) {
      if (!base64) { doneCb(new Error('이미지 로딩 실패'), null); return; }
      setStatus('OCR 서버에 전송 중 (한국어)...', 30);

      var fd = new FormData();
      fd.append('base64Image', base64);
      fd.append('language', 'kor');
      fd.append('isOverlayRequired', 'false');
      fd.append('detectOrientation', 'true');
      fd.append('scale', 'true');
      fd.append('isTable', 'true');    // 표 구조 인식 활성화
      fd.append('OCREngine', '2');     // Engine 2 = 최신 엔진, 한국어 정확도 높음

      fetch(OCR_API, {
        method: 'POST',
        headers: { 'apikey': OCR_KEY },
        body: fd
      })
      .then(function(r){ return r.json(); })
      .then(function(data) {
        setStatus('결과 파싱 중...', 90);
        if (data.IsErroredOnProcessing) {
          doneCb(new Error(data.ErrorMessage || 'OCR 처리 오류'), null);
          return;
        }
        if (data.ParsedResults && data.ParsedResults.length > 0) {
          doneCb(null, data.ParsedResults[0].ParsedText || '');
        } else {
          doneCb(new Error('인식 결과 없음'), null);
        }
      })
      .catch(function(e){ doneCb(new Error('네트워크 오류: ' + e.message), null); });
    });
  }

  // ─── Text parser ──────────────────────────────
  var SKIP_RE = /타순|위치|성명|배번|선발|라인업|lineup|line.?up|gyeryong|구장|감독|vs\s/i;

  function _clean(text) {
    return text
      .replace(/[←↵↩⏎＜]/g, ' ')
      .replace(/[—–]{2,}/g, ' ')
      .replace(/[{}()\[\]™®©°]/g, ' ')
      .replace(/[_~`^*%#@!$&=+\\]/g, ' ')
      .replace(/\s{2,}/g, ' ');
  }

  function parseOcrText(rawText) {
    var text = _clean(rawText);
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var players = [];

    // 헤더 행 감지 → 컬럼 인덱스 파악 (탭 구분 테이블 모드)
    var colOrder=-1, colPos=-1, colName=-1, colNum=-1;
    var headerFound = false;
    var dataLines = [];

    lines.forEach(function(line) {
      if (SKIP_RE.test(line) && !headerFound) {
        // 헤더 행 — 컬럼 위치 감지
        var cells = line.split(/[\t|]/).map(function(c){ return c.trim().toLowerCase(); });
        cells.forEach(function(c, i) {
          if (/타순|순번|no\.?$/.test(c)) colOrder = i;
          if (/위치|포지션|pos/.test(c)) colPos = i;
          if (/성명|이름|name/.test(c)) colName = i;
          if (/배번|등번|num/.test(c)) colNum = i;
        });
        headerFound = true;
        return;
      }
      dataLines.push(line);
    });

    // 탭/파이프 구분 셀 파싱
    dataLines.forEach(function(line) {
      if (SKIP_RE.test(line)) return;

      var sep = line.indexOf('\t') >= 0 ? '\t' : '|';
      if (line.indexOf(sep) >= 0) {
        var cells = line.split(sep).map(function(c){ return c.trim(); });
        var name='', pos='', num='', order=null;

        if (colName >= 0 && cells[colName]) {
          var nm = cells[colName].match(/[가-힣]{2,4}/);
          if (nm) name = nm[0];
        }
        if (colPos >= 0 && cells[colPos]) pos = normalizePos(cells[colPos]);
        if (colNum >= 0 && cells[colNum]) num = cells[colNum].match(/\d+/) ? cells[colNum].match(/\d+/)[0] : '';
        if (colOrder >= 0 && cells[colOrder]) order = parseInt(cells[colOrder]) || null;

        // 컬럼 감지 실패 시 → 셀에서 자동 추출
        if (!name) {
          cells.forEach(function(cell) {
            var koM = cell.match(/[가-힣]{2,4}/);
            if (koM && !POS_MAP[koM[0]] && koM[0].length > name.length) name = koM[0];
            var ep = cell.match(/^(DH|SP|RP|SS|LF|CF|RF|1B|2B|3B|C|P)$/i);
            if (ep && !pos) pos = normalizePos(ep[0].toUpperCase());
            if (!pos) { var pn = normalizePos(cell); if (pn && pn !== cell.trim()) pos = pn; }
            var nMatch = cell.match(/^\d{1,3}$/);
            if (nMatch) {
              var nv = parseInt(nMatch[0]);
              if (nv >= 1 && nv <= 9 && order === null) order = nv;
              else if (nv > 0 && !num) num = nMatch[0];
            }
          });
        }
        if (name) players.push({ order:order, name:name, pos:pos||'', num:num||'', bh:'' });
        return;
      }

      // 파이프/탭 없는 일반 행
      var nameMatches = line.match(/[가-힣]{2,4}/g);
      if (!nameMatches) return;
      var name2 = '';
      nameMatches.forEach(function(m) {
        if (!POS_MAP[m] && m.length > name2.length) name2 = m;
      });
      if (!name2 || name2.length < 2) return;

      var nums = line.match(/\d+/g) || [];
      var o2=null, n2='';
      if (nums.length===1){ var v=parseInt(nums[0]); if(v>=1&&v<=9)o2=v; else n2=nums[0]; }
      else if(nums.length>=2){ o2=parseInt(nums[0]); n2=nums[nums.length-1]; }

      var p2='';
      var ep2 = line.match(/\b(DH|SP|RP|SS|LF|CF|RF|1B|2B|3B|[CP])\b/);
      if (ep2) p2 = normalizePos(ep2[0].toUpperCase());
      if (!p2) {
        line.split(/\s+/).forEach(function(tok){
          if(!tok||tok===name2||/^\d+$/.test(tok)) return;
          var pn=normalizePos(tok); if(pn&&pn!==tok) p2=pn;
        });
      }
      players.push({ order:o2, name:name2, pos:p2||'', num:n2||'', bh:'' });
    });

    players.sort(function(a,b){
      if(a.order!=null&&b.order!=null) return a.order-b.order; return 0;
    });
    return players;
  }

  // ─── Document parsers (txt / csv / xlsx) ──────
  function parseCsv(text) {
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    if (!lines.length) return [];
    var delim = lines[0].includes('\t') ? '\t' : ',';
    var headers = lines[0].split(delim).map(function(h){ return h.trim().toLowerCase().replace(/\s/g,''); });
    function fc(cands){ for(var i=0;i<cands.length;i++){var x=headers.indexOf(cands[i]);if(x>=0)return x;} return -1; }
    var iO=fc(['타순','order','no']), iN=fc(['성명','이름','name','선수']), iP=fc(['위치','포지션','pos']), iU=fc(['배번','등번','num','#']), iB=fc(['타석','bh']);
    if (iN<0) return parseOcrText(text);
    var players=[];
    for(var i=1;i<lines.length;i++){
      var cols=lines[i].split(delim).map(function(c){return c.trim();});
      var nm=cols[iN]||''; if(!nm) continue;
      players.push({order:iO>=0?parseInt(cols[iO])||null:null, name:nm, pos:iP>=0?normalizePos(cols[iP]):'', num:iU>=0?cols[iU]:'', bh:iB>=0?_bh(cols[iB]):''});
    }
    return players;
  }
  function parseXlsx(buf){
    try{ var wb=XLSX.read(buf,{type:'array'}); var ws=wb.Sheets[wb.SheetNames[0]]; return parseCsv(XLSX.utils.sheet_to_csv(ws,{FS:','})); }catch(e){ return []; }
  }
  function _bh(s){ if(!s) return ''; var u=s.toUpperCase().trim(); if(u==='R'||u==='우타'||u==='우') return 'R'; if(u==='L'||u==='좌타'||u==='좌') return 'L'; if(u==='S'||u==='스위치') return 'S'; return ''; }

  // ─── UI helpers ───────────────────────────────
  function setStatus(msg, pct) {
    var wrap=document.getElementById('ocrStatus'), el=document.getElementById('ocrStatusText'), bar=document.getElementById('ocrProgressBar');
    if(wrap) wrap.style.display='block'; if(el) el.textContent=msg;
    if(bar&&pct!=null) bar.style.width=Math.min(100,pct)+'%';
  }
  function hideStatus(){ var w=document.getElementById('ocrStatus'); if(w) w.style.display='none'; }

  function renderPlayerList(players) {
    var wrap=document.getElementById('ocrResultWrap'), list=document.getElementById('ocrPlayerList');
    var applyBtn=document.getElementById('ocrApplyBtn'), rawBtn=document.getElementById('ocrRawToggleBtn');
    if(!list) return;
    if(!players.length){
      list.innerHTML='<div style="color:#ef4444;font-size:12px;padding:8px 0">인식된 선수가 없습니다.<br>원문 보기로 텍스트 확인 후 재파싱해보세요.</div>';
      if(wrap) wrap.style.display='block'; if(rawBtn) rawBtn.style.display='block'; if(applyBtn) applyBtn.style.display='none'; return;
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
    if(wrap) wrap.style.display='block'; if(applyBtn) applyBtn.style.display='block'; if(rawBtn) rawBtn.style.display='block';
  }

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function resetUI(){
    ['ocrImgWrap','ocrStatus','ocrResultWrap','ocrRawWrap'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });
    ['ocrApplyBtn','ocrRawToggleBtn'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });
    var bar=document.getElementById('ocrProgressBar'); if(bar) bar.style.width='0%';
  }

  function finish(players, rawText){
    var ra=document.getElementById('ocrRawText'); if(ra&&rawText!=null) ra.value=rawText;
    _parsedPlayers=players; hideStatus(); renderPlayerList(players);
  }

  // ─── Public API ───────────────────────────────
  window.ocrModalOpen = function() {
    var lpSel=document.getElementById('lpSel');
    _team=(lpSel&&lpSel.value==='away')?'away':'home';
    _syncTeam();
    var modal=document.getElementById('ocrModal');
    if(modal){ modal.style.display='block'; document.body.style.overflow='hidden'; }
    _parsedPlayers=[]; resetUI();
    var fi=document.getElementById('ocrFileInput'); if(fi) fi.value='';
  };

  window.ocrModalClose = function(){
    var modal=document.getElementById('ocrModal');
    if(modal){ modal.style.display='none'; document.body.style.overflow=''; }
  };

  window.ocrSetTeam = function(t){ _team=t; _syncTeam(); };

  function _syncTeam(){
    var hB=document.getElementById('ocrTeamHome'), aB=document.getElementById('ocrTeamAway');
    if(!hB||!aB) return;
    if(_team==='home'){
      hB.style.cssText+=';border-color:#4b8cf5;color:#4b8cf5;background:#0f1729';
      aB.style.cssText+=';border-color:#2a2a3a;color:#6b7280;background:#111118';
    } else {
      aB.style.cssText+=';border-color:#4b8cf5;color:#4b8cf5;background:#0f1729';
      hB.style.cssText+=';border-color:#2a2a3a;color:#6b7280;background:#111118';
    }
  }

  window.ocrHandleFile = function(file) {
    if (!file) return;
    resetUI(); _parsedPlayers=[];

    var ext=(file.name||'').split('.').pop().toLowerCase();
    var type=file.type||'';

    // ── 이미지 → OCR.space ────────────────────
    if (type.startsWith('image/')||/^(jpg|jpeg|png|gif|bmp|webp|heic|heif|tiff?)$/.test(ext)) {
      // 미리보기
      var rd=new FileReader();
      rd.onload=function(e){ var pi=document.getElementById('ocrPreviewImg'),pw=document.getElementById('ocrImgWrap'); if(pi)pi.src=e.target.result; if(pw)pw.style.display='block'; };
      rd.readAsDataURL(file);

      runOcrSpace(file, function(err, rawText) {
        if(err){ setStatus('OCR 오류: '+err.message, 100); return; }
        finish(parseOcrText(rawText), rawText);
      });
      return;
    }

    // ── TXT / CSV ─────────────────────────────
    if(type==='text/plain'||type==='text/csv'||ext==='txt'||ext==='csv'){
      var rd2=new FileReader();
      rd2.onload=function(e){ finish(ext==='csv'?parseCsv(e.target.result):parseOcrText(e.target.result), e.target.result); };
      rd2.readAsText(file,'UTF-8'); return;
    }

    // ── Excel ─────────────────────────────────
    if(type.includes('spreadsheet')||type.includes('excel')||ext==='xlsx'||ext==='xls'){
      if(typeof XLSX==='undefined'){ setStatus('Excel 라이브러리 없음',100); return; }
      setStatus('Excel 읽는 중...',20);
      var rd3=new FileReader();
      rd3.onload=function(e){
        var buf=new Uint8Array(e.target.result);
        var ps=parseXlsx(buf);
        var wb=XLSX.read(buf,{type:'array'}); var csv=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
        finish(ps, csv);
      };
      rd3.readAsArrayBuffer(file); return;
    }

    setStatus('지원하지 않는 형식 (이미지/txt/csv/xlsx)', 100);
  };

  window.ocrToggleRaw = function(){
    var w=document.getElementById('ocrRawWrap'); if(!w) return;
    w.style.display=(w.style.display==='none'||!w.style.display)?'block':'none';
  };

  window.ocrReparse = function(){
    var ra=document.getElementById('ocrRawText'); if(!ra) return;
    _parsedPlayers=parseOcrText(ra.value); renderPlayerList(_parsedPlayers);
  };

  window._ocrUp = function(el){
    var idx=parseInt(el.getAttribute('data-idx')), fld=el.getAttribute('data-field');
    if(!isNaN(idx)&&fld&&_parsedPlayers[idx]) _parsedPlayers[idx][fld]=el.value;
  };
  window._ocrDel = function(idx){ _parsedPlayers.splice(idx,1); renderPlayerList(_parsedPlayers); };

  window.ocrApply = function(){
    if(!_parsedPlayers.length) return;
    var lpSel=document.getElementById('lpSel');
    if(lpSel){ lpSel.value=_team; if(typeof renderLP==='function')renderLP(); if(typeof renderMob==='function')renderMob(); }
    var added=0;
    _parsedPlayers.forEach(function(p){
      if(!p.name) return;
      var n=document.getElementById('pName'),nu=document.getElementById('pNum'),po=document.getElementById('pPos'),bh=document.getElementById('pBH');
      if(n)n.value=p.name; if(nu)nu.value=p.num||''; if(po)po.value=p.pos||''; if(bh)bh.value=p.bh||'';
      if(typeof addPlayer==='function') addPlayer(); added++;
    });
    ocrModalClose();
    _toast(added+'명이 라인업에 추가됐습니다! 🎉');
  };

  function _toast(msg){
    var t=document.createElement('div'); t.textContent=msg;
    t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#4b8cf5;color:#fff;padding:10px 22px;border-radius:20px;font-size:13px;font-weight:700;z-index:99999;pointer-events:none;box-shadow:0 4px 20px rgba(75,140,245,.4);white-space:nowrap';
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .5s'; },2200);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },2800);
  }

})();
