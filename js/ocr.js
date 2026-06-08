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
    // L→4 OCR 오독 보정
    '4F':'좌익','1F':'좌익','IF':'좌익',
    '중견':'중견','중':'중견','CF':'중견',
    '우익':'우익','우':'우익','RF':'우익',
    'DH':'DH','지명':'DH','지명타자':'DH',
  };

  function normalizePos(raw) {
    if (!raw) return '';
    // 영숫자만 추출해서 검색 (소문자도 대문자로)
    var clean = raw.replace(/[^A-Za-z0-9가-힣]/g,'');
    var t = clean.trim(), u = t.toUpperCase();
    if (!t) return '';
    if (POS_MAP[t]) return POS_MAP[t];
    if (POS_MAP[u]) return POS_MAP[u];
    // 앞부분 일치 (DHA→DH, PA→P 등 뒤에 노이즈 붙은 경우)
    for (var k in POS_MAP) {
      if (u.startsWith(k.toUpperCase())) return POS_MAP[k];
    }
    // 마지막 1자 제거 후 재시도 (PA→P, DHA→DH)
    if (t.length > 1) {
      var shorter = u.slice(0, -1);
      if (POS_MAP[shorter]) return POS_MAP[shorter];
    }
    return clean.trim();
  }

  // ─── OCR.space API ────────────────────────────
  var OCR_API = 'https://api.ocr.space/parse/image';
  var OCR_KEY = 'helloworld'; // 무료 데모 키 (월 500회)

  // 이미지를 800px 이하로 리사이즈 후 base64 변환 (1MB 제한 대응)
  function _resizeToBase64(file, cb) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      var MAX = 1400;
      var scale = img.width > MAX ? MAX / img.width : 1;
      var w = Math.round(img.width * scale);
      var h = Math.round(img.height * scale);
      var cvs = document.createElement('canvas');
      cvs.width = w; cvs.height = h;
      var ctx = cvs.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = 'high';
      // 대비·선명도 향상으로 OCR 인식률 개선
      ctx.filter = 'contrast(1.3) brightness(1.05) saturate(0)';
      ctx.drawImage(img, 0, 0, w, h);
      ctx.filter = 'none';
      URL.revokeObjectURL(url);
      cb(cvs.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = function(){ URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  function _fetchOcr(base64, engine, useTable) {
    var fd = new FormData();
    fd.append('base64Image', base64);
    fd.append('language', 'kor');
    fd.append('isOverlayRequired', 'false');
    fd.append('detectOrientation', 'true');
    fd.append('scale', 'true');
    fd.append('isTable', useTable ? 'true' : 'false');
    fd.append('OCREngine', String(engine));
    return fetch(OCR_API, { method:'POST', headers:{'apikey':OCR_KEY}, body:fd })
      .then(function(r){ return r.json(); })
      .then(function(data){
        return (data.ParsedResults && data.ParsedResults[0] && data.ParsedResults[0].ParsedText) || '';
      })
      .catch(function(){ return ''; });
  }

  // 일반 텍스트(isTable=false) 결과에서 선수 이름 앞에 오는 포지션 코드 추출
  function _findPosInPlainText(plainText, playerName) {
    var lines = plainText.split(/\r?\n/);
    var key = playerName.slice(0, 2); // 이름 앞 2글자로 검색
    for (var i = 0; i < lines.length; i++) {
      var idx = lines[i].indexOf(key);
      if (idx < 0) continue;
      var before = lines[i].substring(0, idx).trim();
      var tokens = before.split(/[\s\t]+/);
      for (var j = tokens.length - 1; j >= 0; j--) {
        var tok = tokens[j].replace(/[^A-Za-z0-9가-힣]/g, '');
        if (!tok) continue;
        var p = normalizePos(tok);
        if (p && p !== tok) return p;
      }
    }
    return '';
  }

  function runOcrSpace(file, doneCb) {
    setStatus('이미지 준비 중...', 10);
    _resizeToBase64(file, function(base64) {
      if (!base64) { doneCb(new Error('이미지 로딩 실패'), null, null); return; }
      setStatus('OCR 분석 중...', 30);

      // ① 표모드(Engine2) + ② 일반모드(Engine1) 병렬 실행
      // 표모드가 놓친 포지션을 일반모드 텍스트에서 이름 앞 단어로 보완
      Promise.all([
        _fetchOcr(base64, 2, true),   // 표 구조 파싱용 (주력)
        _fetchOcr(base64, 1, false)   // 평문 파싱용 (포지션 보완)
      ])
        .then(function(texts) {
          setStatus('결과 합산 중...', 88);
          var tableText = texts[0], plainText = texts[1];
          var players = parseOcrText(tableText);

          // 포지션 없는 선수 → 평문 텍스트에서 이름 앞 단어로 포지션 추출
          players = players.map(function(p) {
            if (p.name && !p.pos) {
              var found = _findPosInPlainText(plainText, p.name);
              if (found) return Object.assign({}, p, { pos: found });
            }
            return p;
          });

          doneCb(null, tableText, players);
        })
        .catch(function(e){ doneCb(new Error('네트워크 오류: ' + e.message), null, null); });
    });
  }

  // ─── Text parser ──────────────────────────────
  var SKIP_RE = /^(타순|위치|성명|배.?번|선발|라인업|lineup|line.?up|gyeryong|감독|코치|vs\b)/i;

  // 선수 이름으로 쓸 수 없는 한국어 단어 차단 목록
  var BLOCKED = {
    // 구장 및 OCR 오독 변형 (구장→구정, 구당, 구일 등)
    '구장':1,'구정':1,'구당':1,'구일':1,'구간':1,'구청':1,
    '감독':1,'코치':1,'타순':1,'위치':1,'성명':1,'배번':1,
    '선발':1,'팀명':1,'홈팀':1,'원정':1,'주심':1,'선심':1,'루심':1,
    '경기':1,'날짜':1,'시간':1,'기록':1,'점수':1,'구단':1,'심판':1,'라인업':1,
    '상대':1,'팀장':1,'대표':1,'작성':1,'확인':1,'서명':1,'기타':1,
  };

  // 셀 노이즈 제거 (: ! 등 뒤따라오는 노이즈)
  function _cleanCell(s) {
    return (s||'').replace(/[←↵↩⏎＜—–{}()\[\]™®©°_~`^*%#@!$&=+\\:;,]/g,' ').replace(/\s+/g,' ').trim();
  }

  // 셀 배열 → 선수 정보 (타입 기반, 컬럼 인덱스 불의존)
  function _parseCells(cells) {
    var name='', pos='', order=null, allNums=[];

    // 첫 셀이 숫자인지 확인 (타순 열 존재 여부 판단)
    var firstClean = _cleanCell(cells[0] || '');
    var firstIsNum = /^\d+$/.test(firstClean);

    cells.forEach(function(raw) {
      var cell = _cleanCell(raw);
      if (!cell) return;

      // 한글 이름 후보 — {2,3} 사용 (4자 매칭 시 OCR 노이즈 포함 방지)
      var koM = cell.match(/[가-힣]{2,3}/g);
      if (koM) {
        koM.forEach(function(m) {
          if (!POS_MAP[m] && !BLOCKED[m] && m.length > name.length) name = m;
        });
      }

      // 포지션 판별 — 이 셀이 포지션으로 인식되면 숫자를 타순/배번에 쓰지 않음
      // (2B, 1B, 3BA 등 포지션 코드의 숫자가 타순으로 오인식되는 버그 방지)
      var cellIsPos = false;
      if (!pos) {
        var eng = cell.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
        var pn = normalizePos(eng);
        if (pn && pn !== eng) { pos = pn; cellIsPos = true; }
      }
      if (!pos) {
        var kor = cell.replace(/[^가-힣]/g,'');
        var pn2 = normalizePos(kor);
        if (pn2 && pn2 !== kor) { pos = pn2; cellIsPos = true; }
      }

      // 숫자 수집 — 포지션 셀의 숫자는 제외
      if (!cellIsPos) {
        var ns = cell.match(/\d+/g);
        if (ns) ns.forEach(function(n){ allNums.push(parseInt(n)); });
      }
    });

    if (!name) return null;

    var num = '';
    if (!firstIsNum && allNums.length === 1) {
      // 첫 셀이 포지션 → 타순 열 없음 → 숫자는 배번(jersey)
      // 타순은 sequential fill이 채워줌
      num = String(allNums[0]);
      order = null;
    } else {
      // 첫 셀이 숫자 → 타순 + 배번 구분
      allNums.forEach(function(n) {
        if (n >= 1 && n <= 9 && order === null) order = n;
        else if (n > 0 && !num) num = String(n);
      });
    }

    return { order:order, name:name, pos:pos||'', num:num||'', bh:'' };
  }

  function parseOcrText(rawText) {
    var lines = rawText.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var players = [];

    lines.forEach(function(line) {
      var firstToken = line.split(/[\t|]/)[0].trim();
      // 헤더/메타 행 스킵
      if (SKIP_RE.test(firstToken)) return;
      // 숫자만인 행 스킵 (빈 데이터 행)
      if (/^\d{1,2}\s*$/.test(line.replace(/\t/g,''))) return;
      // 영문+숫자만인 행 스킵 (GYERYONG, LINE-UP 등)
      if (/^[A-Z0-9\s\-–:.\/]+$/.test(line) && !/[가-힣]/.test(line)) return;

      var sep = line.indexOf('\t') >= 0 ? '\t' : (line.indexOf('|') >= 0 ? '|' : null);
      var cells = sep ? line.split(sep) : [line];
      var player = _parseCells(cells);
      if (player) players.push(player);
    });

    // ── 1. 이름 없는 항목 제거 ───────────────────
    players = players.filter(function(p){ return p.name && p.name.length >= 2; });

    // ── 2. 타순 명시된 선수 먼저 슬롯 배치 ────────
    var slots = {};
    players.forEach(function(p) {
      if (p.order != null && p.order >= 1 && p.order <= 9 && !slots[p.order]) {
        slots[p.order] = p;
      }
    });

    // ── 3. 타순 없는 선수 → 빈 슬롯에 등장 순서대로 ─
    // (OCR 행 순서 = 라인업 순서이므로 등장 순서 유지)
    var nullPlayers = players.filter(function(p){ return p.order == null; });
    var emptySlots = [];
    for (var i = 1; i <= 9; i++) { if (!slots[i]) emptySlots.push(i); }
    nullPlayers.forEach(function(p, idx) {
      if (idx < emptySlots.length) {
        p.order = emptySlots[idx];
        slots[p.order] = p;
      }
    });

    // ── 4. 슬롯 1~9 결과 반환 ────────────────────
    var result = [];
    for (var i = 1; i <= 9; i++) {
      result.push(slots[i] || { order:i, name:'', pos:'', num:'', bh:'' });
    }
    return result;
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
      var isEmpty = !p.name;
      var rowStyle = isEmpty
        ? 'display:flex;align-items:center;gap:4px;padding:5px 0;border-bottom:1px solid #1e1e2a;opacity:0.45'
        : 'display:flex;align-items:center;gap:4px;padding:5px 0;border-bottom:1px solid #1e1e2a';
      var po=posOpts.map(function(o){ return '<option value="'+o+'"'+(o===p.pos?' selected':'')+'>'+(o||'포지션')+'</option>'; }).join('');
      var bo=bhOpts.map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===p.bh?' selected':'')+'>'+ o[1]+'</option>'; }).join('');
      return '<div style="'+rowStyle+'">'
        +'<span style="font-size:10px;color:#434c5e;min-width:18px;text-align:center;font-weight:700">'+p.order+'</span>'
        +'<input style="flex:1;min-width:0;background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#c9d1d9;font-size:12px;padding:4px 6px" value="'+esc(p.name)+'" placeholder="이름" data-field="name" data-idx="'+i+'" oninput="window._ocrUp(this)">'
        +'<input style="width:36px;background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#c9d1d9;font-size:12px;padding:4px 3px;text-align:center" value="'+esc(p.num)+'" placeholder="#" data-field="num" data-idx="'+i+'" oninput="window._ocrUp(this)">'
        +'<select style="background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#9ca3af;font-size:11px;padding:3px 1px" data-field="pos" data-idx="'+i+'" onchange="window._ocrUp(this)">'+po+'</select>'
        +'<select style="background:#0d1117;border:1px solid #2a2a3a;border-radius:6px;color:#9ca3af;font-size:11px;padding:3px 1px" data-field="bh" data-idx="'+i+'" onchange="window._ocrUp(this)">'+bo+'</select>'
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

      runOcrSpace(file, function(err, rawText, merged) {
        if(err){ setStatus('OCR 오류: '+err.message, 100); return; }
        finish(merged || parseOcrText(rawText), rawText);
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
