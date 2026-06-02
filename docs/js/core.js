// ═══ SprayLab Core ═══
// ─────────────────────────────────────────────────────────
// 카카오톡 인앱 브라우저 감지 — 강제 이동 대신 경고 배너 표시
// ─────────────────────────────────────────────────────────
(function detectKakaoBrowser() {
  var ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('kakaotalk') > -1) {
    // 강제 이동 X — 데이터 손실 방지를 위해 배너만 표시
    document.addEventListener('DOMContentLoaded', function() {
      var banner = document.getElementById('kakao-warn');
      if (banner) banner.style.display = 'block';
      // 앱 페이지 상단 여백 추가
      var appPage = document.getElementById('app-page');
      if (appPage) appPage.style.paddingTop = '70px';
    });
  }
})();

function kakaoExportThenOpen() {
  var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
  if (saves.length === 0) {
    if (confirm('저장된 경기가 없습니다.\nChrome으로 이동할까요?')) kakaoOpenOnly();
    return;
  }
  var data = {};
  saves.forEach(function(s) { var r = localStorage.getItem(s.key); if (r) data[s.key] = JSON.parse(r); });
  var jsonStr = JSON.stringify({version:1, type:'all', saves:saves, data:data}, null, 2);
  var today = new Date().toLocaleDateString('ko-KR').replace(/\./g,'').replace(/\s/g,'');
  var fileName = 'SprayLab_백업_' + today + '.json';
  var blob = new Blob([jsonStr], {type:'application/json'});

  if (navigator.share) {
    var file = new File([blob], fileName, {type:'application/json'});
    var sd = {title:'SprayLab 경기 데이터 백업', text:saves.length + '개 경기'};
    if (navigator.canShare && navigator.canShare({files:[file]})) sd.files = [file];
    navigator.share(sd)
      .then(function() { setTimeout(kakaoOpenOnly, 1200); })
      .catch(function(err) { if (err.name !== 'AbortError') showDataModal(jsonStr, fileName); });
    return;
  }
  showDataModal(jsonStr, fileName);
}

function kakaoOpenOnly() {
  var url = window.location.href.split('?')[0];
  if (/android/i.test(navigator.userAgent)) {
    window.location.href = 'intent://' + url.replace(/https?:\/\//i,'') + '#Intent;scheme=https;package=com.android.chrome;end';
  } else {
    window.location.href = url + '?open=browser';
  }
}

function showDataModal(jsonStr, fileName) {
  var old = document.getElementById('_dataModal');
  if (old) old.remove();

  var ov = document.createElement('div');
  ov.id = '_dataModal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:999999;display:flex;flex-direction:column;padding:14px;gap:8px;font-family:sans-serif;box-sizing:border-box;';

  var box = document.createElement('div');
  box.style.cssText = 'background:#111118;border-radius:14px;padding:16px;flex:1;display:flex;flex-direction:column;border:1px solid #252532;min-height:0;';

  var t = document.createElement('div');
  t.style.cssText = 'color:#4b8cf5;font-size:15px;font-weight:800;margin-bottom:8px;flex-shrink:0;';
  t.textContent = '📋 데이터 복사 후 공유';

  var d = document.createElement('div');
  d.style.cssText = 'color:#7c8898;font-size:12px;line-height:1.7;margin-bottom:10px;flex-shrink:0;';
  d.innerHTML = '<span style="color:#f6c23e">①</span> 아래 <strong style="color:#eef0f8">전체 복사</strong> 버튼 클릭<br>'
    + '<span style="color:#f6c23e">②</span> 카카오톡 <strong style="color:#eef0f8">나에게 보내기</strong>에 붙여넣기 전송<br>'
    + '<span style="color:#f6c23e">③</span> Chrome에서 앱 열기 → 불러오기 → <strong style="color:#2dd4a0">붙여넣기 가져오기</strong>';

  var ta = document.createElement('textarea');
  ta.readOnly = true;
  ta.value = jsonStr;
  ta.style.cssText = 'flex:1;background:#07090f;color:#8892a4;font-size:9px;border:1px solid #252532;border-radius:8px;padding:10px;resize:none;font-family:monospace;min-height:0;width:100%;box-sizing:border-box;';

  var copyBtn = document.createElement('button');
  copyBtn.style.cssText = 'margin-top:10px;padding:13px;background:#4b8cf5;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer;flex-shrink:0;width:100%;';
  copyBtn.textContent = '📋 전체 복사';
  copyBtn.onclick = function() {
    var done = function() {
      copyBtn.textContent = '✅ 복사됨! — 카카오 나에게 보내기에 붙여넣으세요';
      copyBtn.style.background = '#2dd4a0';
      copyBtn.style.color = '#07090f';
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).then(done).catch(function() { ta.select(); document.execCommand('copy'); done(); });
    } else {
      ta.select(); document.execCommand('copy'); done();
    }
  };

  var closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'margin-top:6px;padding:11px;background:none;border:1px solid #252532;border-radius:9px;font-size:12px;color:#7c8898;cursor:pointer;flex-shrink:0;width:100%;';
  closeBtn.textContent = '✕ 닫기';
  closeBtn.onclick = function() { ov.remove(); };

  box.appendChild(t); box.appendChild(d); box.appendChild(ta); box.appendChild(copyBtn); box.appendChild(closeBtn);
  ov.appendChild(box);
  document.body.appendChild(ov);
}


// ───── PAGE ROUTING ─────
function showApp(){
  // 히어로 캔버스 애니메이션 루프 중단
  if(window._cancelHeroAnim){window._cancelHeroAnim();window._cancelHeroAnim=null;}
  document.getElementById('landing-page').style.display='none';
  var isMob=window.innerWidth<=720;
  var ap=document.getElementById('app-page');
  ap.style.display='flex';
  if(isMob){ap.style.overflowY='hidden';ap.style.height='100svh';}else{ap.style.overflowY='';ap.style.height='';}
  document.body.style.overflowY='hidden';
  document.body.style.overflowX='hidden';
  initApp();
  ftuCheck();
  // Show savant bottom nav
  var nav=document.getElementById('savantNav');
  if(nav)nav.style.display='flex';
}
function goHome(){
  // 앱 내에 있으면 홈 화면(welcom)으로 복귀
  showAppWelcome();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ① FTU 온보딩 위저드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ftuCheck(){
  if(localStorage.getItem('sl_ftu_done')){showAppWelcome();return;}
  var ov=document.getElementById('ftuOverlay');
  ov.classList.remove('hidden');
  _ftuSetStep(0);
  setTimeout(ftuDrawField,80);
}
function _ftuSetStep(n){
  for(var i=0;i<3;i++){
    document.getElementById('ftuStep'+i).style.display=i===n?'':'none';
    var d=document.getElementById('ftuD'+i);
    if(d)d.classList.toggle('on',i<=n);
  }
}
function ftuDrawField(){
  var cv=document.getElementById('ftuFieldCanvas');
  if(!cv)return;
  var ctx=cv.getContext('2d');
  var w=cv.width,h=cv.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#0d1117';
  ctx.fillRect(0,0,w,h);
  var cx=w/2,by=h-6,r=Math.min(w,h)*0.9;
  // outfield arc
  ctx.beginPath();
  ctx.arc(cx,by,r,Math.PI*1.1,Math.PI*1.9);
  ctx.strokeStyle='rgba(75,140,245,.4)';
  ctx.lineWidth=1.5;
  ctx.stroke();
  // infield foul lines
  ctx.beginPath();
  ctx.moveTo(cx,by);
  ctx.lineTo(cx-r*0.7,by-r*0.7);
  ctx.moveTo(cx,by);
  ctx.lineTo(cx+r*0.7,by-r*0.7);
  ctx.strokeStyle='rgba(75,140,245,.25)';
  ctx.lineWidth=1;
  ctx.stroke();
  // diamond
  var ds=h*0.26;
  ctx.beginPath();
  ctx.moveTo(cx,by-ds*1.95);
  ctx.lineTo(cx+ds,by-ds*0.98);
  ctx.lineTo(cx,by-0.1);
  ctx.lineTo(cx-ds,by-ds*0.98);
  ctx.closePath();
  ctx.strokeStyle='rgba(75,140,245,.55)';
  ctx.lineWidth=1.5;
  ctx.stroke();
  ctx.fillStyle='rgba(75,140,245,.06)';
  ctx.fill();
  // home plate
  ctx.beginPath();
  ctx.arc(cx,by-2,4,0,Math.PI*2);
  ctx.fillStyle='rgba(75,140,245,.7)';
  ctx.fill();
}
function ftuStep1(){
  var nm=(document.getElementById('ftuTeamInp').value||'').trim();
  if(nm){AS.th=nm;var el=document.getElementById('tHome');if(el)el.value=nm;}
  _ftuSetStep(1);
  setTimeout(function(){document.getElementById('ftuPlayerName').focus();},120);
}
function ftuAddPlayer(){
  var nm=(document.getElementById('ftuPlayerName').value||'').trim();
  if(!nm)return;
  var num=(document.getElementById('ftuPlayerNum').value||'').trim();
  if(!AS.home_lineup)AS.home_lineup=[];
  var p={id:Date.now(),name:nm,num:num||(AS.home_lineup.length+1)+'',pos:'',bh:'',isStarter:true};
  AS.home_lineup.push(p);
  if(typeof renderLP==='function')renderLP();
  if(typeof renderMob==='function')renderMob();
  if(AS.home_lineup.length===1&&typeof selBatter==='function')selBatter(p.id);
  document.getElementById('ftuPlayerAdded').style.display='block';
  var nb=document.getElementById('ftuStep1Next');
  nb.style.opacity='1';nb.style.pointerEvents='';
}
function ftuStep2(){
  _ftuSetStep(2);
  setTimeout(ftuDrawField,80);
}
function ftuFieldTap(ev){
  var cv=document.getElementById('ftuFieldCanvas');
  if(!cv)return;
  var rect=cv.getBoundingClientRect();
  var scaleX=cv.width/rect.width,scaleY=cv.height/rect.height;
  var x=(ev.clientX-rect.left)*scaleX,y=(ev.clientY-rect.top)*scaleY;
  var ctx=cv.getContext('2d');
  ctx.beginPath();
  ctx.arc(x,y,7,0,Math.PI*2);
  ctx.fillStyle='rgba(75,140,245,.9)';
  ctx.fill();
  ctx.strokeStyle='#fff';
  ctx.lineWidth=1.5;
  ctx.stroke();
  var fb=document.getElementById('ftuFinishBtn');
  fb.style.opacity='1';fb.style.pointerEvents='';
  document.getElementById('ftuTapHint').textContent='✓ 탭 완료! 이제 시작할 수 있어요';
}
function ftuDone(){
  localStorage.setItem('sl_ftu_done','1');
  var ov=document.getElementById('ftuOverlay');
  ov.style.opacity='0';
  setTimeout(function(){ov.classList.add('hidden');ov.style.opacity='';showAppWelcome();},320);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ② 탭 모드 토글 (모바일: 경기중 / 경기후)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var _tabMode='game';
function setTabMode(mode,el){
  _tabMode=mode;
  document.querySelectorAll('.tmb-btn').forEach(function(b){b.classList.remove('on');});
  if(el)el.classList.add('on');
  var gameTabs=['tab-rec','tab-batter'];
  var postTabs=['tab-stat','tab-chart','tab-pitcher','tab-team'];
  if(mode==='game'){
    postTabs.forEach(function(id){var t=document.getElementById(id);if(t)t.style.display='none';});
    gameTabs.forEach(function(id){var t=document.getElementById(id);if(t)t.style.display='';});
    var cur=document.querySelector('.pnl-right .tabs .tab.on');
    if(cur&&postTabs.indexOf(cur.id)>=0){
      var recTab=document.getElementById('tab-rec');
      if(recTab)swTab('rec',recTab);
    }
  }else{
    postTabs.forEach(function(id){var t=document.getElementById(id);if(t)t.style.display='';});
    gameTabs.forEach(function(id){var t=document.getElementById(id);if(t)t.style.display='';});
    var statTab=document.getElementById('tab-stat');
    if(statTab)swTab('stat',statTab);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ③ 데이터 백업 안내
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var _gameSaved=true;
var _saveReminderShown=false;
var _saveReminderTimer=null;
function checkSaveReminder(){
  if(_saveReminderShown||_gameSaved)return;
  if(AS.abs&&AS.abs.length>=5){
    _saveReminderShown=true;
    showToast('💾 지금 저장하세요! (저장 버튼 또는 Ctrl+S)',false,true);
  }
}
function _startSaveReminderTimer(){
  clearTimeout(_saveReminderTimer);
  _saveReminderTimer=setTimeout(function(){
    if(!_gameSaved&&AS.abs&&AS.abs.length>0&&!_saveReminderShown){
      _saveReminderShown=true;
      showToast('💾 10분 경과 — 지금 저장하세요!',false,true);
    }
  },10*60*1000);
}
// 경기 시작 시 타이머 시작 (openGameWizard 이후 호출 포인트에서도 동작하도록 전역 감지)
document.addEventListener('DOMContentLoaded',function(){
  window.addEventListener('beforeunload',function(e){
    if(!_gameSaved&&AS&&AS.abs&&AS.abs.length>0){
      var msg='저장되지 않은 타석 기록이 있습니다. 페이지를 떠나면 데이터가 사라질 수 있습니다.';
      e.preventDefault();
      e.returnValue=msg;
      return msg;
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UI 정리: 더보기 드롭다운 / 하단 탭 / 분석 패널
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toggleMoreMenu(){
  var m=document.getElementById('moreMenu');
  var btn=document.getElementById('moreMenuBtn');
  if(!m)return;
  var isOpen=m.style.display==='flex';
  m.style.display=isOpen?'none':'flex';
  if(btn)btn.classList.toggle('btn-primary',!isOpen);
  if(!isOpen){
    setTimeout(function(){document.addEventListener('click',_closeMoreMenuOutside,{once:true});},0);
  }
}
function closeMoreMenu(){
  var m=document.getElementById('moreMenu');
  var btn=document.getElementById('moreMenuBtn');
  if(m)m.style.display='none';
  if(btn)btn.classList.remove('btn-primary');
}
function _closeMoreMenuOutside(e){
  var wrap=document.getElementById('moreMenuWrap');
  if(wrap&&!wrap.contains(e.target))closeMoreMenu();
}

function swIbTab(id,btn){
  document.querySelectorAll('.ib-tab').forEach(function(b){b.classList.remove('on');});
  document.querySelectorAll('.ib-tab-pnl').forEach(function(p){p.classList.remove('on');});
  if(btn)btn.classList.add('on');
  var pnl=document.getElementById('ib-pnl-'+id);
  if(pnl)pnl.classList.add('on');
}

function toggleAnalysisPanel(){
  var layout=document.querySelector('.app-layout');
  var panel=document.querySelector('.pnl-right');
  var btn=document.getElementById('analysisPanelBtn');
  if(!layout||!panel)return;
  var collapsed=layout.classList.toggle('panel-collapsed');
  panel.classList.toggle('panel-collapsed',collapsed);
  if(btn)btn.classList.toggle('btn-primary',!collapsed);
  // initCanvas() 대신 직접 리사이즈 (이벤트 핸들러 중복 등록 방지)
  setTimeout(function(){
    var w=document.getElementById('cwrap');
    if(!w)return;
    FS=w.clientWidth;
    ['fldCanvas','hitCanvas','ovrCanvas'].forEach(function(id){
      var c=document.getElementById(id);
      if(c){c.width=FS;c.height=FS;}
    });
    drawField();
    safeRender();
  },280);
}
function goLanding(){
  hideAppWelcome();
  document.getElementById('app-page').style.display='none';
  document.getElementById('landing-page').style.display='block';
  document.body.style.overflowY='';
  document.body.style.overflowX='';
  var nav=document.getElementById('savantNav');
  if(nav)nav.style.display='none';
  window.scrollTo(0,0);
}

// ───── LANDING SCRIPTS ─────
(function(){
  const canvas=document.getElementById('heroCanvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  let W,H,dots=[];
  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;dots=[]}
  resize();window.addEventListener('resize',resize);
  function makeDots(){
    for(let i=0;i<55;i++){
      const cx=W/2,cy=H*0.75;
      const ang=(Math.random()*Math.PI)-Math.PI;
      const r=Math.random()*Math.min(W,H)*0.45+20;
      dots.push({x:cx+Math.cos(ang)*r,y:cy+Math.sin(ang)*r,vx:(Math.random()-.5)*.18,vy:(Math.random()-.5)*.18,r:Math.random()*4+2,color:['#4b8cf5','#2dd4a0','#f56565','#f6c23e','#a78bfa'][Math.floor(Math.random()*5)],alpha:Math.random()*.5+.15,pulse:Math.random()*Math.PI*2,speed:Math.random()*.025+.01});
    }
  }
  makeDots();
  function drawBg(){
    const cx=W/2,cy=H*.75,R=Math.min(W,H)*.44;
    const g=ctx.createRadialGradient(cx,cy*.8,0,cx,cy*.8,R*1.1);
    g.addColorStop(0,'rgba(75,140,245,.03)');g.addColorStop(1,'transparent');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-R,cy);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+R,cy);ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy,R*.9,-Math.PI,0);ctx.strokeStyle='rgba(255,255,255,.05)';ctx.stroke();
    ctx.setLineDash([3,8]);ctx.strokeStyle='rgba(255,255,255,.04)';
    [[Math.PI*.72],[Math.PI*.28]].forEach(([a])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a+Math.PI)*R,cy+Math.sin(a+Math.PI)*R);ctx.stroke()});
    ctx.setLineDash([]);
  }
  let af;
  function draw(){
    ctx.clearRect(0,0,W,H);drawBg();
    dots.forEach(d=>{
      d.x+=d.vx;d.y+=d.vy;d.pulse+=d.speed;
      if(d.x<0||d.x>W)d.vx*=-1;if(d.y<0||d.y>H)d.vy*=-1;
      const al=d.alpha*(0.7+Math.sin(d.pulse)*.3);
      ctx.beginPath();ctx.arc(d.x,d.y,d.r*2.4,0,Math.PI*2);
      ctx.strokeStyle=d.color+(Math.floor(al*20).toString(16).padStart(2,'0'));ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
      ctx.fillStyle=d.color+(Math.floor(al*200).toString(16).padStart(2,'0'));ctx.fill();
    });
    af=requestAnimationFrame(draw);
  }
  window._cancelHeroAnim=function(){cancelAnimationFrame(af);af=null;};
  draw();

  const mc=document.getElementById('mockCanvas');
  if(mc){
    const mctx=mc.getContext('2d');
    const S=220,cx=S/2,cy=S,R=S*.93;
    const bg=mctx.createRadialGradient(cx,cy,0,cx,cy,R);
    bg.addColorStop(0,'#0a1a0c');bg.addColorStop(.55,'#081508');bg.addColorStop(1,'#050e07');
    mctx.beginPath();mctx.arc(cx,cy,R,-Math.PI,0);mctx.lineTo(cx,cy);mctx.closePath();mctx.fillStyle=bg;mctx.fill();
    mctx.beginPath();mctx.arc(cx,cy,R,-Math.PI,0);mctx.arc(cx,cy,R*.88,0,-Math.PI,true);mctx.closePath();mctx.fillStyle='#150e06';mctx.fill();
    mctx.beginPath();mctx.arc(cx,cy,S*.41,-Math.PI,0);mctx.lineTo(cx,cy);mctx.closePath();mctx.fillStyle='#1a1106';mctx.fill();
    mctx.beginPath();mctx.arc(cx,cy,S*.33,-Math.PI,0);mctx.lineTo(cx,cy);mctx.closePath();mctx.fillStyle='#0b1a0d';mctx.fill();
    mctx.strokeStyle='rgba(255,255,255,.15)';mctx.lineWidth=1;
    mctx.beginPath();mctx.moveTo(cx,cy);mctx.lineTo(cx-R,cy);mctx.stroke();
    mctx.beginPath();mctx.moveTo(cx,cy);mctx.lineTo(cx+R,cy);mctx.stroke();
    mctx.beginPath();mctx.arc(cx,cy,R*.88,-Math.PI,0);mctx.strokeStyle='rgba(255,255,255,.08)';mctx.lineWidth=1;mctx.stroke();
    mctx.fillStyle='rgba(255,255,255,.5)';
    mctx.beginPath();mctx.moveTo(cx,cy-6);mctx.lineTo(cx+5,cy-2);mctx.lineTo(cx+5,cy+3);mctx.lineTo(cx-5,cy+3);mctx.lineTo(cx-5,cy-2);mctx.closePath();mctx.fill();
    [[0.42,0.55,'#2dd4a0',5],[0.6,0.38,'#4b8cf5',5],[0.35,0.72,'#374151',4],[0.55,0.65,'#374151',4],[0.48,0.42,'#f6c23e',5],[0.7,0.5,'#2dd4a0',5],[0.3,0.48,'#f56565',6],[0.52,0.3,'#2dd4a0',5],[0.38,0.62,'#374151',4]].forEach(([px,py,col,r])=>{
      const x=px*S,y=py*S;
      mctx.beginPath();mctx.arc(x,y,r,0,Math.PI*2);mctx.fillStyle=col+'bb';mctx.fill();mctx.strokeStyle=col;mctx.lineWidth=1.2;mctx.stroke();
    });
  }

  function animCount(el,target,dur=1800){
    const s=performance.now();
    const big=target>100;
    function step(n){const p=Math.min((n-s)/dur,1);const e=1-Math.pow(1-p,3);const v=Math.floor(e*target);el.textContent=big?v.toLocaleString('ko-KR'):v;if(p<1)requestAnimationFrame(step);else el.textContent=big?target.toLocaleString('ko-KR'):target;}
    requestAnimationFrame(step);
  }
  const cio=new IntersectionObserver(en=>{en.forEach(e=>{if(e.isIntersecting){e.target.querySelectorAll('[data-target]').forEach(el=>animCount(el,parseInt(el.dataset.target)));cio.unobserve(e.target)}})},{threshold:.5});
  const hs=document.getElementById('heroStats');if(hs)cio.observe(hs);

  const io=new IntersectionObserver(en=>{en.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.15});
  document.querySelectorAll('.fade-up').forEach(el=>io.observe(el));

  window.addEventListener('scroll',()=>{
    const n=document.getElementById('mainNav');
    if(n)n.style.background=window.scrollY>60?'rgba(7,9,15,.95)':'rgba(7,9,15,.8)';
  });
})();

// ───── APP STATE ─────
const AS={
  hs:0,as:0,
  curTeam:'home',
  home_lineup:[],
  away_lineup:[],
  batter:null,
  abs:[],
  pt:null,
  zone:null,
  rbi:0,
  pending:null,
  zoneHistory:{},
  balls:0,strikes:0,outs:0,
  batterFilter:false,
  teamFilter:null,
  showHotCold:false,
  currentPitches:[],
  zoneX:null,zoneY:null,
  advFilter:null,
  pitchers:[],
  currentPitcher:null,
  pitcherZone:null,
  pitcherPt:null,
  pitcherRole:null,
  pitchLog:[],
  recFilterBid:null,
  pendingQuickRes:null
};
// feature 모듈(profile.js, compare.js, scouting.js)이 window.AS로 접근하므로 노출
window.AS = AS;

const MAX_HITS = 300;
let saveTimer;
let FS=440,fCtx,hCtx,oCtx,fC,hC,oC,appInited=false;
let _nearbyHitId=null,_nearbyCloseTimer=null;
let _FORCE_SHOW_HITDETAIL_DEBUG=false;

const OB=[
  {icon:'🏟️',step:'STEP 1 · 타구 기록',title:'필드를 터치해\n타구 위치를 기록하세요',desc:'공이 떨어진 위치를 탭하면 결과 입력 창이 자동으로 나타납니다.\n<b>상단 퀵버튼</b>으로 더욱 빠르게 기록할 수 있어요.',highlight:'안타 · 2루타 · 아웃 · 삼진 · 볼넷'},
  {icon:'▶',step:'STEP 2 · 경기 운영 모드',title:'타순·아웃카운트·이닝이\n자동으로 진행됩니다',desc:'<b>▶ 경기운영</b> 버튼을 탭하면 기록할 때마다 타순이 자동으로 넘어갑니다.\n3아웃 시 이닝이 전환되고, 종료 시 최종 요약 카드가 표시됩니다.',highlight:'경기운영 버튼 → 자동 타순 · 아웃카운트 · 이닝 전환'},
  {icon:'📊',step:'STEP 3 · 패턴 분석',title:'타격 패턴을\n자동으로 분석합니다',desc:'타자 탭 하단에서 <b>📊 패턴 분석</b>을 확인하세요.\n2타석 이상 기록하면 당겨치기 성향·삼진 패턴·강점 코스를 자동 감지합니다.',highlight:'타율 트렌드 · 방향 편중 · 약점 코스 자동 감지'},
  {icon:'✅',step:'STEP 4 · 저장하기',title:'경기 종료 후\n[저장]을 눌러 보관하세요',desc:'기록된 데이터는 기기에 자동 보관됩니다.\n경기가 끝나면 <b>[저장]</b> 버튼으로 영구 저장하세요.',highlight:'가입 불필요 · 클라우드 미사용 · 완전 무료'},
  {icon:'📊',step:'STEP 5 · 자동 분석',title:'기록은 통계와 차트로\n자동 분석됩니다',desc:'타율 · 출루율 · 장타율이 자동 계산되고,\n타구 방향과 <b>약점 패턴</b>을 시각화해 보여줍니다.',highlight:'AVG · OBP · SLG · OPS 자동 계산'},
];
let obIdx=0;
function obNext(){
  obIdx++;
  if(obIdx>=OB.length){
    localStorage.setItem('sl_ob3','1');
    document.getElementById('obOverlay').style.display='none';
    return;
  }
  const o=OB[obIdx];
  document.getElementById('obIcon').textContent=o.icon;
  document.getElementById('obStep').textContent=o.step;
  document.getElementById('obTitle').innerHTML=o.title.replace(/\n/g,'<br>');
  document.getElementById('obDesc').innerHTML=o.desc.replace(/\n/g,'<br>');
  const hl=document.getElementById('obHighlight');
  if(hl){hl.textContent=o.highlight||'';hl.style.display=o.highlight?'block':'none';}
  for(let i=0;i<5;i++)document.getElementById('d'+i).classList.toggle('on',i===obIdx);
  document.getElementById('obBtn').textContent=obIdx===OB.length-1?'시작하기 →':'다음 →';
}
function obSkip(){
  if(document.getElementById('obNoShow')&&document.getElementById('obNoShow').checked){
    localStorage.setItem('sl_ob3','1');
  }
  document.getElementById('obOverlay').style.display='none';
}
/* ===== TOOLTIP JS ===== */
let ttHideTimer;
function showTT(el,title,body){
  clearTimeout(ttHideTimer);
  const box=document.getElementById('ttBox');
  box.innerHTML='<b>'+title+'</b>'+(body?'\n'+body:'');
  box.classList.add('vis');
  const r=el.getBoundingClientRect();
  let top=r.top-10;
  let left=r.left+r.width/2;
  box.style.transform='translateX(-50%)';
  box.style.top='';box.style.bottom='';box.style.left='';
  if(top-120<8){top=r.bottom+8;box.style.top=top+'px';}else{box.style.bottom=(window.innerHeight-r.top+8)+'px';}
  box.style.left=Math.max(8,Math.min(left,window.innerWidth-140))+'px';
}
function hideTT(){ttHideTimer=setTimeout(()=>document.getElementById('ttBox').classList.remove('vis'),120);}

/* ===== INTERACTIVE TOUR JS ===== */
const TOUR=[
  {sel:'.pnl-left', title:'① 타자 선택', desc:'라인업에서 이름을 탭해 현재 타자를 선택합니다.\n선수가 없으면 이름·등번호를 입력하고 <b>+</b> 버튼으로 추가하세요.', card:'right', cursor:true},
  {sel:'#cwrap', title:'② 필드 탭', desc:'타자가 친 공이 <b>떨어진 위치를 탭</b>하세요.\n탭하면 결과 입력 팝업이 자동으로 나타납니다.\n⚡ 상단 <b>퀵버튼 바</b>로 필드 탭 없이 바로 기록도 가능합니다.', card:'right', cursor:true},
  {sel:null, title:'③ 결과 입력', desc:'팝업에서 타격 결과를 선택하세요:\n<b>안타 / 2루타 / 3루타 / 홈런 / 아웃 / 볼넷 / 삼진</b>\n\n스와이프로 빠르게: <kbd>→</kbd> 안타 &nbsp;<kbd>←</kbd> 아웃 &nbsp;<kbd>↑</kbd> 볼넷 &nbsp;<kbd>↓</kbd> 삼진', card:'center', cursor:false},
  {sel:'.pnl-right .tabs', title:'④ 통계 확인', desc:'오른쪽 패널에서 자동 계산된 통계를 확인하세요.\n• <b>타자</b> 탭 — 개인 타율·OBP·패턴 분석\n• <b>팀통계</b> 탭 — 팀 전체 타율·방향 분포\n• <b>차트</b> 탭 — 스프레이차트 PNG 내보내기', card:'left', cursor:true},
  {sel:null, title:'⑤ 저장', desc:'경기가 끝나면 상단 툴바의 <b>[저장]</b> 버튼을 꼭 눌러주세요.\n기기에 영구 저장됩니다 — 가입·클라우드 불필요.\n⌨️ <b>Ctrl+S</b> 로도 빠르게 저장할 수 있어요.', card:'center', cursor:false},
  {sel:null, title:'⑥ 공유', desc:'<b>🔗 공유</b> 버튼을 탭하면 QR코드와 링크가 생성됩니다.\n팀원이 링크를 열면 배너로 자동 안내됩니다.\n<b>차트</b> 탭 → 개인(9:16)·팀(1:1) 성적카드 PNG 저장 후 SNS 공유', card:'center', cursor:false},
];
let tourIdx=0,tourActive=false;

function startTour(){
  tourActive=true;
  tourIdx=0;
  document.getElementById('tourOv').classList.add('on');
  tourGo(tourIdx);
}

function tourNext(){
  tourIdx++;
  if(tourIdx>=TOUR.length){tourSkip();return;}
  tourGo(tourIdx);
}

function tourSkip(){
  tourActive=false;
  document.getElementById('tourOv').classList.remove('on');
  const spot=document.getElementById('tourSpot');
  spot.style.cssText='';
  const card=document.getElementById('tourCard');
  card.classList.remove('vis');
  hideTourCursor();
}

function tourGo(idx){
  const step=TOUR[idx];
  const card=document.getElementById('tourCard');
  const spot=document.getElementById('tourSpot');
  const cursor=document.getElementById('tourCursor');
  const ring=document.getElementById('tourRing');

  // Progress
  document.getElementById('tourProgTxt').textContent=(idx+1)+' / '+TOUR.length;
  document.getElementById('tourProgFill').style.width=((idx+1)/TOUR.length*100)+'%';

  // Content
  card.classList.remove('vis');
  document.getElementById('tourTitle').textContent=step.title;
  document.getElementById('tourDesc').innerHTML=step.desc.replace(/\n/g,'<br>');
  document.getElementById('tourNextBtn').textContent=idx===TOUR.length-1?'완료 ✓':'다음 →';

  const el=step.sel?document.querySelector(step.sel):(step.sels?document.querySelector(step.sels):null);

  if(!el||step.sel===null){
    // Center card, no spotlight
    spot.style.cssText='display:none';
    cursor.style.opacity='0';
    ring.style.opacity='0';
    card.style.top='50%';
    card.style.left='50%';
    card.style.transform='translate(-50%,-50%)';
    setTimeout(()=>{card.style.transform='translate(-50%,-48%)';card.classList.add('vis');},40);
    return;
  }

  const pad=step.sel==='.pnl-left'||step.sel==='.pnl-right .tabs'?6:8;
  const r=el.getBoundingClientRect();
  const sw=window.innerWidth,sh=window.innerHeight;

  // Spotlight
  spot.style.display='block';
  spot.style.top=(r.top-pad)+'px';
  spot.style.left=(r.left-pad)+'px';
  spot.style.width=(r.width+pad*2)+'px';
  spot.style.height=(r.height+pad*2)+'px';

  // Cursor/ring on center of element
  if(step.cursor){
    const cx=r.left+r.width/2,cy=r.top+r.height/2;
    cursor.style.opacity='1';
    cursor.style.left=(cx-13)+'px';
    cursor.style.top=(cy-13)+'px';
    cursor.className='tCursorAnim';
    ring.style.opacity='1';
    ring.style.left=(cx-20)+'px';
    ring.style.top=(cy-20)+'px';
    ring.style.width='40px';ring.style.height='40px';
    ring.className='tRingPulse';
  } else {
    cursor.style.opacity='0';
    ring.style.opacity='0';
  }

  // Card position (prefer step.card direction, fallback if no space)
  const cw=Math.min(300,sw*0.88),ch=220;
  const margin=16;
  let top,left;
  const pos=step.card||'right';

  if(pos==='right'&&r.right+cw+margin<sw){left=r.right+margin;top=Math.min(r.top,sh-ch-margin);}
  else if(pos==='left'&&r.left-cw-margin>0){left=r.left-cw-margin;top=Math.min(r.top,sh-ch-margin);}
  else if(pos==='top'&&r.top-ch-margin>0){top=r.top-ch-margin;left=Math.max(margin,Math.min(r.left+r.width/2-cw/2,sw-cw-margin));}
  else if(pos==='bottom'&&r.bottom+ch+margin<sh){top=r.bottom+margin;left=Math.max(margin,Math.min(r.left+r.width/2-cw/2,sw-cw-margin));}
  else{
    // fallback: pick side with most room
    const spaces={right:sw-r.right,left:r.left,top:r.top,bottom:sh-r.bottom};
    const best=Object.entries(spaces).sort((a,b)=>b[1]-a[1])[0][0];
    if(best==='right'){left=r.right+margin;top=Math.min(Math.max(margin,r.top),sh-ch-margin);}
    else if(best==='left'){left=Math.max(margin,r.left-cw-margin);top=Math.min(Math.max(margin,r.top),sh-ch-margin);}
    else if(best==='top'){top=Math.max(margin,r.top-ch-margin);left=Math.max(margin,Math.min(r.left+r.width/2-cw/2,sw-cw-margin));}
    else{top=Math.min(sh-ch-margin,r.bottom+margin);left=Math.max(margin,Math.min(r.left+r.width/2-cw/2,sw-cw-margin));}
  }
  top=Math.max(margin,top);
  left=Math.max(margin,Math.min(left,sw-cw-margin));

  card.style.transform='';
  card.style.width=cw+'px';
  card.style.top=top+'px';
  card.style.left=left+'px';
  setTimeout(()=>card.classList.add('vis'),40);
}

function hideTourCursor(){
  document.getElementById('tourCursor').style.opacity='0';
  document.getElementById('tourRing').style.opacity='0';
}

function showHelpMenu(){
  showHelpModal();
}

function showTutorial(){
  obIdx=0;
  const o=OB[0];
  document.getElementById('obIcon').textContent=o.icon;
  document.getElementById('obStep').textContent=o.step;
  document.getElementById('obTitle').innerHTML=o.title.replace(/\n/g,'<br>');
  document.getElementById('obDesc').innerHTML=o.desc.replace(/\n/g,'<br>');
  const hl=document.getElementById('obHighlight');
  if(hl){hl.textContent=o.highlight||'';hl.style.display=o.highlight?'block':'none';}
  for(let i=0;i<5;i++)document.getElementById('d'+i).classList.toggle('on',i===0);
  document.getElementById('obBtn').textContent='다음 →';
  if(document.getElementById('obNoShow'))document.getElementById('obNoShow').checked=false;
  document.getElementById('obOverlay').style.display='flex';
}

function initApp(){
  if(appInited)return;appInited=true;
  initCanvas();drawDonut();
  // Debug: force-show hit detail card to verify visibility (temporary)
  try{
    if(_FORCE_SHOW_HITDETAIL_DEBUG){
      const hc=document.getElementById('hitDetailCard');
      if(hc){
        hc.innerHTML='<button class="hdc-close" onclick="closeHitDetail()">✕</button><div class="hdc-res" style="color:#2dd4a0">DEBUG MODE</div><div class="hdc-player">강제 표시 중</div><div class="hdc-row">🧭 좌표/이벤트 디버깅</div>';
        hc.style.display='block'; hc.style.left='16px'; hc.style.top='80px'; hc.style.zIndex='99999'; hc.style.pointerEvents='auto';
        console.log('[debug] hitDetailCard forced visible for debug');
      }
    }
  }catch(e){}
  // 온보딩: sl_ob3 키가 없으면 신규/업데이트 사용자로 간주해 안내 표시
  if(!localStorage.getItem('sl_ob3')){
    document.getElementById('obOverlay').style.display='flex';
  }
  localStorage.setItem('sl_visited','1');
  document.getElementById('innSel').addEventListener('change',()=>document.getElementById('innDisp').textContent=document.getElementById('innSel').value);
  refreshZoneDisplay();
  initOfflineDetection();
}

function chSc(t,d){if(t==='h'){AS.hs=Math.max(0,AS.hs+d);document.getElementById('scH').textContent=AS.hs}else{AS.as=Math.max(0,AS.as+d);document.getElementById('scA').textContent=AS.as}}

function swLineupTab(team) {
  if(AS.curTeam === team) return;
  AS.curTeam = team;
  document.getElementById('subtab-home').classList.toggle('on', team==='home');
  document.getElementById('subtab-away').classList.toggle('on', team==='away');
  document.getElementById('lineupTitle').textContent = team==='home' ? '홈팀 명단' : '원정팀 명단';
  renderLP();
  renderMob();
}

function getActiveLineup() {
  return AS.curTeam === 'home' ? AS.home_lineup : AS.away_lineup;
}

function addPlayer(){
  const n=document.getElementById('pName').value.trim();
  const num=document.getElementById('pNum').value.trim()||(getActiveLineup().length+1)+'';
  const pos=(document.getElementById('pPos')||{}).value||'';
  if(!n)return;
  const bh=(document.getElementById('pBH')||{}).value||'';
  const p={id:Date.now(),name:n,num,pos,bh,isStarter:true};
  getActiveLineup().push(p);
  document.getElementById('pName').value='';
  document.getElementById('pNum').value='';
  if(document.getElementById('pPos'))document.getElementById('pPos').value='';
  if(document.getElementById('pBH'))document.getElementById('pBH').value='';
  renderLP();
  renderMob();
  if(getActiveLineup().length===1)selBatter(p.id);
}

function selBatter(id){
  const targetLineup = getActiveLineup();
  const clicked=targetLineup.find(p=>String(p.id)===String(id))||null;
  // 같은 선수 다시 누르면 필터 해제 (toggle)
  if(AS.batter&&String(AS.batter.id)===String(id)){
    AS.batter=null;AS.batterFilter=false;
  } else {
    AS.batter=clicked;AS.batterFilter=!!clicked;
  }
  const fb=document.getElementById('filterBtn');
  if(fb)fb.classList.toggle('btn-primary',AS.batterFilter);
  renderLP();
  renderMob();
  const d=document.getElementById('batterDisp');
  if(AS.batter) d.innerHTML=`<span class="batter-display">#${AS.batter.num} ${AS.batter.name}<span style="font-size:10px;color:var(--text3);font-weight:400"> (${AS.curTeam==='home'?'홈':'원정'})</span></span>`;
  else d.innerHTML='<span class="batter-empty">← 타자를 선택하세요</span>';
  closeHitDetail();
  // 새 타자 선택 시 인게임 코스 초기화 (에러 방지용 try-catch)
  try{AS.currentPitches=[];AS.zone=null;AS.pt=null;AS.zoneX=null;AS.zoneY=null;
  if(typeof _ibZoneDots!=='undefined')_ibZoneDots=[];
  if(typeof ibZoneRedraw==='function')ibZoneRedraw();
  if(AS.currentPitcher)AS.currentPitcher._batterLog=[];}catch(e){}
  // 타자 선택 시 타자 탭으로 자동 전환 + 오른쪽 패널 표시
  if(AS.batter){
    var _bt=document.getElementById('tab-batter');
    if(_bt)swTab('batter',_bt);
    // 모바일: 오른쪽 패널 표시
    var _layout=document.querySelector('.app-layout');
    var _rp=document.querySelector('.pnl-right');
    if(_layout&&_rp&&_layout.classList.contains('panel-collapsed')){
      _layout.classList.remove('panel-collapsed');
      _rp.classList.remove('panel-collapsed');
    }
  }
  safeRender();updateHotCold();updBatterStat();
}

function delPlayer(id,e){
  e.stopPropagation();
  if(AS.curTeam === 'home') {
    AS.home_lineup=AS.home_lineup.filter(p=>String(p.id)!==String(id));
  } else {
    AS.away_lineup=AS.away_lineup.filter(p=>String(p.id)!==String(id));
  }
  if(AS.batter&&String(AS.batter.id)===String(id)) AS.batter = null;
  renderLP();
  renderMob();
  selBatter(null);
}

function renderLP(){
  const targetLineup = getActiveLineup();
  const el=document.getElementById('lpList');
  document.getElementById('lpCount').textContent=targetLineup.length+'명';
  if(!targetLineup.length){el.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);font-size:11px">아래에서 선수를 추가하세요 ↓</div>';return;}
  const noab=['볼넷','사구','희타','희비'],hits=['안타','내야안타','2루타','3루타','홈런'];
  el.innerHTML=targetLineup.map((p,idx)=>{
    const pAbs=AS.abs.filter(a=>a.bid===p.id);
    const oab=pAbs.filter(a=>!noab.includes(a.res)).length;
    const h=pAbs.filter(a=>hits.includes(a.res)).length;
    const av=oab?(h/oab).toFixed(3).replace('0.','.'):'.---';
    const on=AS.batter&&AS.batter.id===p.id;
    const posHtml=p.pos?`<span class="pos-badge">${p.pos}</span>`:'';
    const bhLabels={'R':'우타','L':'좌타','S':'스위치'};
    const bhHtml=p.bh?`<span class="bh-badge bh-${p.bh}">${bhLabels[p.bh]||p.bh}</span>`:'';
    const sCls=(p.isStarter!==false)?'on':'';
    const sTxt=(p.isStarter!==false)?'주전':'후보';
    return`<div class="player-row${on?' active':''}" draggable="true" onclick="selBatter('${p.id}')" ondragstart="dragStart(event,'${p.id}')" ondragover="dragOver(event)" ondrop="dropPlayer(event,'${p.id}')" ondragleave="this.classList.remove('drag-over')" ondragend="document.querySelectorAll('.player-row').forEach(r=>{r.classList.remove('drag-over');r.style.opacity=''})" style="user-select:none">
      <span class="drag-handle" onclick="event.stopPropagation()">⠿</span>
      <span class="p-num">${idx+1}</span>
      <div class="p-avatar">${p.name[0]}</div>
      <div class="p-info">
        <div class="p-name">${p.name}${posHtml}${bhHtml}</div>
        <div class="p-mini">${oab>0?oab+'AB '+av:'기록없음'}</div>
      </div>
      <button class="starter-btn ${sCls}" onclick="toggleStarter('${p.id}',event)">${sTxt}</button>
      <button class="p-del" onclick="delPlayer('${p.id}',event)">✕</button>
    </div>`;
  }).join('');
}

function renderMob(){
  const targetLineup = getActiveLineup();
  const b=document.getElementById('mobBar');if(!b)return;
  b.innerHTML=targetLineup.map(p=>{
    const on=AS.batter&&AS.batter.id===p.id;
    return`<div class="mob-chip${on?' on':''}" onclick="selBatter('${p.id}')">#${p.num} ${p.name}</div>`;
  }).join('');
}

function selChip(el,k,v){
  el.closest('.chips').querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');
  AS[k]=v;
}

// ───── 투구 추적 코어 엔진 ─────
var _pendingZoneEl=null;
function clickZone(el){
  document.querySelectorAll('.zone-cell,.zone-ball-btn').forEach(function(c){c.classList.remove('pending');});
  el.classList.add('pending');
  _pendingZoneEl=el;
  var picker=document.getElementById('ptPickerArea');
  var lbl=document.getElementById('ptPickerZone');
  if(picker&&lbl){
    picker.querySelectorAll('.chip').forEach(function(c){c.classList.toggle('on',c.textContent.trim()===AS.pt);});
    lbl.textContent=el.dataset.z;
    picker.style.display='';
  }
}
function confirmZonePitch(pt){
  if(!_pendingZoneEl)return;
  AS.zone=_pendingZoneEl.dataset.z;
  AS.pt=pt;
  document.querySelectorAll('#ptGroup .chip').forEach(function(c){c.classList.toggle('on',c.textContent.trim()===pt);});
  logPitchAction();
  hidePtPicker();
}
function hidePtPicker(){
  var picker=document.getElementById('ptPickerArea');
  if(picker)picker.style.display='none';
  if(_pendingZoneEl){_pendingZoneEl.classList.remove('pending');_pendingZoneEl=null;}
}
function selZone(el){clickZone(el);}

function logPitchAction(){
  if(!AS.zone||!AS.pt)return;
  if(!AS.zoneHistory[AS.zone])AS.zoneHistory[AS.zone]=[];
  var symMap={'커브':'Ｃ','커터':'CT','직구':'Ｆ','슬라이더':'Ｓ','체인지업':'CH','포크볼':'FK'};
  var symbol=symMap[AS.pt]||'•';
  AS.zoneHistory[AS.zone].push({pt:AS.pt,symbol:symbol});
  AS.currentPitches.push({zone:AS.zone,pt:AS.pt,x:AS.zoneX||null,y:AS.zoneY||null});
  refreshZoneDisplay();
}

function refreshZoneDisplay(){
  document.querySelectorAll('.zone-cell,.zone-ball-btn').forEach(function(cell){
    var zoneName=cell.dataset.z;if(!zoneName)return;
    var history=AS.zoneHistory[zoneName]||[];
    if(cell.classList.contains('zone-cell')){
      if(history.length>0){
        var last=history[history.length-1];
        cell.innerHTML='<div style="font-size:9px;font-weight:800;color:var(--blue);text-align:center;line-height:1.2;padding-top:1px">'+last.symbol+'<br><span style="font-size:8px;color:var(--text2);font-family:var(--mono)">'+history.length+'</span></div>';
      }else{cell.innerHTML='';}
    }else{
      var orig=cell.getAttribute('data-orig');
      if(!orig){orig=cell.textContent.trim();cell.setAttribute('data-orig',orig);}
      cell.textContent=history.length?(orig+' '+history.length):orig;
      cell.style.opacity=history.length?'1':'';
    }
  });
}

function initCanvas(){
  const w=document.getElementById('cwrap');
  FS=w.clientWidth||w.offsetWidth||440;
  [fC,hC,oC]=['fldCanvas','hitCanvas','ovrCanvas'].map(id=>{const c=document.getElementById(id);c.width=FS;c.height=FS;return c;});
  fCtx=fC.getContext('2d');hCtx=hC.getContext('2d');oCtx=oC.getContext('2d');
  fC.style.touchAction='none';
  fC.style.userSelect='none';
  drawField();
  // Retry draw on next frame in case layout wasn't ready
  requestAnimationFrame(function(){
    var nw=w.clientWidth||w.offsetWidth;
    if(nw&&nw!==FS){FS=nw;[fC,hC,oC].forEach(function(c){c.width=FS;c.height=FS;});drawField();safeRender();}
    else if(FS<=0){FS=nw||440;[fC,hC,oC].forEach(function(c){c.width=FS;c.height=FS;});drawField();}
  });
  new ResizeObserver(function(){var nw=w.clientWidth;if(!nw||nw===FS)return;FS=nw;[fC,hC,oC].forEach(function(c){c.width=FS;c.height=FS;});drawField();safeRender();}).observe(w);

  let _lastTouch=0,_touchStartX=0,_touchStartY=0;
  let _lastPointerX=null,_lastPointerY=null;
  fC.onclick=function(e){if(Date.now()-_lastTouch<600)return;onFClick(e);};
  fC.ondblclick=function(e){if(Date.now()-_lastTouch<600)return;onFClick(e);};
  fC.addEventListener('touchstart',function(e){
    e.preventDefault();
    if(e.touches.length>0){_touchStartX=e.touches[0].clientX;_touchStartY=e.touches[0].clientY;}
    closeHitDetail();
  },{passive:false});
  fC.addEventListener('touchmove',function(e){
    e.preventDefault();
    if(e.touches.length!==1)return;
    const t=e.touches[0];
    _lastPointerX=t.clientX; _lastPointerY=t.clientY;
    _showNearDot(t);
  },{passive:false});
  fC.addEventListener('touchend',function(e){
    if(!e.changedTouches||e.changedTouches.length===0)return;
    const _t=e.changedTouches[0];
    if(Math.abs(_t.clientX-_touchStartX)>16||Math.abs(_t.clientY-_touchStartY)>16){
      closeHitDetail();return;
    }
    e.preventDefault();
    _lastTouch=Date.now();
    const r=fC.getBoundingClientRect();
    const eventObj={clientX:_t.clientX,clientY:_t.clientY,rect:r,sx:FS/r.width,sy:FS/r.height};
    onFClick(eventObj);
  },{passive:false});
  fC.addEventListener('mousemove',function(e){_lastPointerX=e.clientX; _lastPointerY=e.clientY; _showNearDot(e);});
  fC.addEventListener('pointermove',function(e){_lastPointerX=e.clientX; _lastPointerY=e.clientY; _showNearDot(e);});
  const wheelHandler=function(e){
    try{
      const rect=fC.getBoundingClientRect();
      const cx = _lastPointerX!=null? _lastPointerX : (e.clientX!=null? e.clientX : rect.left + rect.width/2);
      const cy = _lastPointerY!=null? _lastPointerY : (e.clientY!=null? e.clientY : rect.top + rect.height/2);
      const eventObj={clientX:cx, clientY:cy, rect:rect, sx:FS/rect.width, sy:FS/rect.height, offsetX:cx-rect.left, offsetY:cy-rect.top};
      if(_lastPointerX==null && (e.clientX==null || e.clientY==null)) console.log('[debug] wheel fallback to canvas center', {cx,cy});
      _showNearDot(eventObj);
    }catch(err){
      _showNearDot({clientX:_lastPointerX!=null? _lastPointerX : e.clientX, clientY:_lastPointerY!=null? _lastPointerY : e.clientY, offsetX:e.offsetX, offsetY:e.offsetY});
    }
  };
  fC.addEventListener('wheel',wheelHandler,{passive:true});
  w.addEventListener('pointermove',function(e){_lastPointerX=e.clientX; _lastPointerY=e.clientY; _showNearDot(e);});
  w.addEventListener('wheel',wheelHandler,{passive:true});
  fC.addEventListener('mouseleave',closeHitDetail);
  // document-level fallback: catches mousemove even when invisible overlay steals events
  document.addEventListener('pointermove',function(e){
    if(!fC)return;
    var r=fC.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){
      closeHitDetail();return;
    }
    _showNearDot(e.clientX,e.clientY);
  },{passive:true});
}

function _getNearestHit(src){
  const r=fC.getBoundingClientRect();
  const rawX = src.offsetX!=null ? src.offsetX : (src.clientX-r.left);
  const rawY = src.offsetY!=null ? src.offsetY : (src.clientY-r.top);
  const x = rawX*(FS/r.width);
  const y = rawY*(FS/r.height);
  let visList=AS.abs.filter(a=>a.x!=null);
  if(AS.batterFilter&&AS.batter) visList=visList.filter(a=>a.bid===AS.batter.id);
  if(AS.teamFilter) visList=visList.filter(a=>(a.team||'home')===AS.teamFilter);
  const THR=Math.max(40,FS*0.1);
  let closest=null, closestD=Infinity;
  visList.forEach(a=>{const d=Math.hypot(x-a.x*FS,y-a.y*FS); if(d<THR && d<closestD){closestD=d; closest=a;}});
  return closest?{hit:closest,x:x,y:y}:null;
}

function _showNearDot(event){
  if(!hCtx)return;
  const nearest=_getNearestHit(event);
  if(nearest){
    clearTimeout(_nearbyCloseTimer);
    try{console.log('[debug] nearest hit', nearest.hit.id, nearest);}catch(e){}
    // if same hit already shown, just refresh ring; otherwise show detail
    if(_nearbyHitId!==nearest.hit.id){
      _nearbyHitId=nearest.hit.id;
      try{
        const rect=fC.getBoundingClientRect();
        const cx = (event && event.clientX!=null)? event.clientX : (rect.left + nearest.hit.x * rect.width);
        const cy = (event && event.clientY!=null)? event.clientY : (rect.top + nearest.hit.y * rect.height);
        console.log('[debug] showHitDetail using coords', {cx,cy});
        showHitDetail(nearest.hit, cx, cy);
        // ensure card is on top for debug cases
        try{const hc=document.getElementById('hitDetailCard'); if(hc) hc.style.zIndex='99999';}catch(e){}
      }catch(e){
        showHitDetail(nearest.hit,event.clientX,event.clientY);
      }
    }
    // visual debug ring on overlay canvas
    try{
      if(oCtx){
        if(typeof _debugRingTimer!=='undefined' && _debugRingTimer)clearTimeout(_debugRingTimer);
        oCtx.clearRect(0,0,FS,FS);
        oCtx.beginPath();
        oCtx.arc(nearest.hit.x*FS, nearest.hit.y*FS, 14, 0, Math.PI*2);
        oCtx.strokeStyle='rgba(45,212,160,0.95)'; oCtx.lineWidth=3; oCtx.stroke();
        oC.classList.add('show');
        _debugRingTimer=setTimeout(function(){
          if(oCtx){ oCtx.clearRect(0,0,FS,FS); if(AS.showHotCold&&AS.batter){_drawHotColdOnCtx(); oC&&oC.classList.add('show');}else{oC&&oC.classList.remove('show');}}
        },900);
      }
    }catch(e){}
  } else {
    // delay closing so brief wheel/pointer noise doesn't immediately hide the card
    clearTimeout(_nearbyCloseTimer);
    _nearbyCloseTimer=setTimeout(function(){ _nearbyHitId=null; closeHitDetail(); }, 300);
  }
}

function drawField(){
  const ctx=fCtx,S2=FS,cx=S2/2,cy=S2;ctx.clearRect(0,0,S2,S2);
  const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,S2);bg.addColorStop(0,'#1f4d24');bg.addColorStop(.55,'#193f1d');bg.addColorStop(1,'#112b14');
  ctx.beginPath();ctx.arc(cx,cy,S2*.97,-Math.PI,0);ctx.lineTo(cx,cy);ctx.closePath();ctx.fillStyle=bg;ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,S2*.97,-Math.PI,0);ctx.arc(cx,cy,S2*.89,0,-Math.PI,true);ctx.closePath();ctx.fillStyle='#4a2e10';ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,S2*.41,-Math.PI,0);ctx.lineTo(cx,cy);ctx.closePath();ctx.fillStyle='#7d5028';ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,S2*.33,-Math.PI,0);ctx.lineTo(cx,cy);ctx.closePath();ctx.fillStyle='#2a6b30';ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-S2*.97,cy);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+S2*.97,cy);ctx.stroke();
  ctx.setLineDash([3,5]);ctx.strokeStyle='rgba(255,255,255,0.18)';ctx.lineWidth=1;
  [[Math.PI*.72],[Math.PI*.28]].forEach(([a])=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a+Math.PI)*S2*.97,cy+Math.sin(a+Math.PI)*S2*.97);ctx.stroke();});
  ctx.setLineDash([]);
  ctx.beginPath();ctx.arc(cx,cy,S2*.89,-Math.PI,0);ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=1;ctx.stroke();
  const br=S2*.42;[[cx,cy-br*.65],[cx-br*.46,cy-br*.33],[cx+br*.46,cy-br*.33]].forEach(([bx,by])=>{ctx.save();ctx.translate(bx,by);ctx.rotate(Math.PI/4);ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(-5.5,-5.5,11,11);ctx.restore();});
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.beginPath();ctx.moveTo(cx,cy-7);ctx.lineTo(cx+6,cy-2);ctx.lineTo(cx+6,cy+3);ctx.lineTo(cx-6,cy+3);ctx.lineTo(cx-6,cy-2);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy-S2*.32,7,0,Math.PI*2);ctx.fillStyle='#7d5028';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.font=`bold ${Math.floor(S2*.025)}px 'JetBrains Mono',monospace`;ctx.textAlign='center';
  ctx.fillText('LF',cx-S2*.32,cy-S2*.58);ctx.fillText('CF',cx,cy-S2*.72);ctx.fillText('RF',cx+S2*.32,cy-S2*.58);
  const dl=Math.floor(S2*.019);ctx.font=`700 ${dl}px 'Noto Sans KR',sans-serif`;
  ctx.fillStyle='rgba(245,101,101,.85)';ctx.fillText('당겨치기',cx-S2*.23,cy-S2*.37);
  ctx.fillStyle='rgba(45,212,160,.85)';ctx.fillText('센터',cx,cy-S2*.45);
  ctx.fillStyle='rgba(75,140,245,.85)';ctx.fillText('밀어치기',cx+S2*.23,cy-S2*.37);
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1;
  const bps=[[cx,cy],[cx-br*.46,cy-br*.33],[cx,cy-br*.65],[cx+br*.46,cy-br*.33],[cx,cy]];
  ctx.beginPath();bps.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));ctx.stroke();
  // ── 거리 링 50m/80m/100m (CF 400ft≈122m → FS*.97 기준) ──
  ctx.setLineDash([3,6]);ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;
  ctx.fillStyle='rgba(255,255,255,0.38)';ctx.font=Math.floor(S2*.022)+'px sans-serif';ctx.textAlign='left';
  [50,80,100].forEach(function(m){var r=S2*m/122;ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI,0);ctx.stroke();ctx.fillText(m+'m',cx+r*.35+2,cy-r*.93+4);});
  ctx.setLineDash([]);
}

var _ftLabelTimer;
function onFClick(e){
  // 팝업 열린 상태에서 field 클릭 이벤트 차단
  if(document.querySelector('.overlay.show'))return;
  let x,y;const rect=e.rect||fC.getBoundingClientRect();const sx=e.sx||(FS/rect.width),sy=e.sy||(FS/rect.height);
  x=(e.clientX-rect.left)*sx;y=(e.clientY-rect.top)*sy;
  const cx=FS/2,cy=FS,dx=x-cx,dy=y-cy,dist=Math.sqrt(dx*dx+dy*dy);
  if(dy>0||dist>FS*.97)return;
  closeHitDetail();
  oCtx.clearRect(0,0,FS,FS);
  if(AS.showHotCold&&AS.batter)_drawHotColdOnCtx();
  oCtx.beginPath();oCtx.arc(x,y,10,0,Math.PI*2);oCtx.fillStyle='rgba(255,255,255,.2)';oCtx.fill();
  oCtx.beginPath();oCtx.arc(x,y,4.5,0,Math.PI*2);oCtx.fillStyle='#fff';oCtx.fill();
  oC.classList.add('show');
  const ang=Math.atan2(dy,dx);const deg=(ang+Math.PI)*180/Math.PI;
  let dir;if(deg<54)dir='LF';else if(deg<78)dir='LC';else if(deg<102)dir='CF';else if(deg<126)dir='RC';else dir='RF';
  var _wallFt={LF:330,LC:375,CF:400,RC:375,RF:330};
  const estFt=Math.round(dist/FS*(_wallFt[dir]||370));
  // ── 클릭 위치 거리 말풍선 (2초 후 자동 소거) ──
  clearTimeout(_ftLabelTimer);
  var _estM=Math.round(estFt*0.3048);
  oCtx.save();oCtx.font='bold '+Math.floor(FS*.042)+'px monospace';oCtx.fillStyle='rgba(255,255,255,.9)';oCtx.textAlign='left';
  oCtx.fillText(_estM+'m',Math.min(x+14,FS-46),Math.max(y-14,14));oCtx.restore();
  _ftLabelTimer=setTimeout(function(){
    oCtx.clearRect(0,0,FS,FS);if(AS.showHotCold&&AS.batter)_drawHotColdOnCtx();
    oCtx.beginPath();oCtx.arc(x,y,10,0,Math.PI*2);oCtx.fillStyle='rgba(255,255,255,.2)';oCtx.fill();
    oCtx.beginPath();oCtx.arc(x,y,4.5,0,Math.PI*2);oCtx.fillStyle='#fff';oCtx.fill();
  },2000);
  AS.pending={x:x/FS,y:y/FS,deg,dir,ft:estFt};
  // Quick-button hit: position captured → record immediately without overlay
  if(AS.pendingQuickRes){
    var res=AS.pendingQuickRes;
    _clearFieldTapPrompt();
    AS.rbi=0;document.getElementById('rbiVal').textContent='0';
    recHit(res);
    return;
  }
  AS.rbi=0;document.getElementById('rbiVal').textContent='0';
  document.getElementById('hitSub').textContent=`방향: ${dir} · ${Math.round(estFt*0.3048)}m (${estFt}ft)`;
  openOverlay('hitOverlay');
}

function recHit(res){
  if(!AS.batter){showToast('타자를 먼저 선택하세요',false,false);closeHit();return;}
  if(AS.abs.length >= MAX_HITS){ AS.abs.shift(); showToast('⚠️ 최대 '+MAX_HITS+'개 초과 — 가장 오래된 기록이 삭제되었습니다',false,true); }
  const r={id:Date.now(),bid:AS.batter.id,bname:AS.batter.name,bnum:AS.batter.num,team:AS.curTeam,res,pt:AS.pt,zone:AS.zone,rbi:AS.rbi,x:AS.pending.x,y:AS.pending.y,deg:AS.pending.deg,dir:AS.pending.dir,ft:AS.pending.ft,inn:document.getElementById('innSel').value,ts:new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),count:{b:AS.balls,s:AS.strikes,o:AS.outs},pitches:[...AS.currentPitches]};
AS.currentPitches=[];
  AS.abs.push(r);closeHit();updateAll();showToast(`#${r.bnum} ${r.bname} — ${res}${r.rbi>0?' ('+r.rbi+'타점)':''}`,true);
  gfAfterRecord(res,r.rbi);
}
function recOther(res){
  if(!AS.batter){showToast('타자를 먼저 선택하세요',false,false);return;}
  if(AS.abs.length >= MAX_HITS){ AS.abs.shift(); showToast('⚠️ 최대 '+MAX_HITS+'개 초과 — 가장 오래된 기록이 삭제되었습니다',false,true); }
  // 내야안타: 방향 분석에 포함되도록 기본값 설정 (CF 방향 90도)
  var _infieldDeg=res==='내야안타'?90:null;
  var _infieldDir=res==='내야안타'?'CF':null;
  var _infieldX=res==='내야안타'?0.5:null;
  var _infieldY=res==='내야안타'?0.55:null;
  const r={id:Date.now(),bid:AS.batter.id,bname:AS.batter.name,bnum:AS.batter.num,team:AS.curTeam,res,pt:AS.pt,zone:AS.zone,rbi:0,x:_infieldX,y:_infieldY,deg:_infieldDeg,dir:_infieldDir,ft:null,inn:document.getElementById('innSel').value,ts:new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),count:{b:AS.balls,s:AS.strikes,o:AS.outs},pitches:[...AS.currentPitches]};
AS.currentPitches=[];
  AS.abs.push(r);updateAll();showToast(`#${r.bnum} ${r.bname} — ${res}`,true);
  gfAfterRecord(res,0);
}
function recSB(ok){showToast(ok?'도루 성공':'도루 실패',false);}
function toggleInputBar(){var ib=document.querySelector('.input-bar');var btn=document.getElementById('ibToggleBtn');if(!ib)return;var open=ib.classList.toggle('open');if(btn)btn.textContent=open?'▲ 투구·결과 입력 닫기':'▼ 투구·결과 입력';}
(function initLpResize(){
  var handle=document.getElementById('lpResizeHandle');
  var al=document.querySelector('.app-layout');
  if(!handle||!al)return;
  function setW(w){
    w=Math.min(320,Math.max(180,Math.round(w)));
    al.style.setProperty('--lp-w',w+'px');
    localStorage.setItem('sl_lp_w',w);
  }
  handle.addEventListener('mousedown',function(e){
    if(window.innerWidth<721)return;
    var startX=e.clientX;
    var startW=al.getBoundingClientRect().left+parseInt(getComputedStyle(document.querySelector('.pnl-left')).width)||180;
    startW=parseInt(getComputedStyle(document.querySelector('.pnl-left')).width)||180;
    handle.classList.add('dragging');
    function onMove(e){setW(startW+e.clientX-startX);}
    function onUp(){handle.classList.remove('dragging');document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);}
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
    e.preventDefault();
  });
  var saved=+localStorage.getItem('sl_lp_w');
  if(saved>=180&&saved<=320&&window.innerWidth>=721)setW(saved);
})();
function chRbi(d){AS.rbi=Math.max(0,AS.rbi+d);document.getElementById('rbiVal').textContent=AS.rbi;}

const RC={'안타':'#22c55e','내야안타':'#4ade80','2루타':'#86efac','3루타':'#bbf7d0','홈런':'#fbbf24','플라이 아웃':'#f87171','땅볼 아웃':'#ef4444','삼진':'#6b7280','볼넷':'#60a5fa','사구':'#93c5fd','희타':'#fb923c','희비':'#fb923c','병살':'#dc2626'};
function drawDot(r){if(!r.x)return;const x=r.x*FS,y=r.y*FS;const col=RC[r.res]||'#94a3b8';const out=r.res.includes('아웃')||r.res==='삼진';hCtx.beginPath();hCtx.arc(x,y,out?3:4.5,0,Math.PI*2);hCtx.fillStyle=col+'cc';hCtx.fill();hCtx.strokeStyle=col;hCtx.lineWidth=1.2;hCtx.stroke();if(!out){hCtx.beginPath();hCtx.arc(x,y,7.5,0,Math.PI*2);hCtx.strokeStyle=col+'44';hCtx.lineWidth=1.5;hCtx.stroke();}}

function safeRender(){
  requestAnimationFrame(()=>{
    if(!hCtx)return;
    hCtx.clearRect(0,0,FS,FS);
    let list=AS.abs;
    if(AS.batterFilter&&AS.batter)list=list.filter(a=>a.bid===AS.batter.id);
    if(AS.teamFilter)list=list.filter(a=>(a.team||'home')===AS.teamFilter);
    list.forEach(a=>{if(a.x)drawDot(a);});
    drawHotZoneOverlay(); // ovrCanvas 초기화 후 핫존 블롭 그리기
    updateHotCold();      // 그 다음 핫/콜드 존 그리기 (덮어씌우기 방지)
  });
}

function updateAll(){renderLP();renderMob();renderRecs();updStats();safeRender();updBatterStat();if(document.getElementById('pnl-chart')&&document.getElementById('pnl-chart').classList.contains('on'))updCharts();scheduleAutoSave();_gameSaved=false;checkSaveReminder();}
function renderRecs(){
  const el=document.getElementById('recList');
  const allPlayers=[...AS.home_lineup,...AS.away_lineup].filter(p=>AS.abs.some(a=>a.bid===p.id));
  const rpnLabel=document.getElementById('rpnLabel');
  if(rpnLabel){
    if(!AS.recFilterBid){rpnLabel.textContent='전체'+(allPlayers.length?' ('+allPlayers.length+'명)':'');}
    else{const p=allPlayers.find(p=>p.id===AS.recFilterBid);rpnLabel.textContent=p?'#'+p.num+' '+p.name:'전체';}
  }
  const list=AS.recFilterBid?AS.abs.filter(a=>a.bid===AS.recFilterBid):AS.abs;
  document.getElementById('recCnt').textContent=list.length+'개 기록';
  if(!list.length){el.innerHTML='<div style="text-align:center;padding:28px 0;color:var(--text3);font-size:11px">'+(AS.recFilterBid?'이 선수의 기록이 없습니다':'필드를 탭해 타석을 기록하세요 →')+'</div>';return;}
  const BC={'안타':'b-hit','내야안타':'b-hit','2루타':'b-2b','3루타':'b-3b','홈런':'b-hr','볼넷':'b-walk','사구':'b-hbp','삼진':'b-k','플라이 아웃':'b-out','땅볼 아웃':'b-out','희타':'b-other','희비':'b-other','병살':'b-out'};
  var _ub=document.getElementById('toolbarUndoBtn');if(_ub)_ub.disabled=!AS.abs.length;
  el.innerHTML=[...list].reverse().map(a=>`<div class="rec-item" draggable="true" ondragstart="recDragStart(event,${a.id})" ondragover="recDragOver(event,${a.id})" ondrop="recDrop(event,${a.id})" ondragleave="recDragLeave(event)" ondragend="recDragEnd()"><span class="rec-drag-handle" ondragstart="event.stopPropagation()" onclick="event.stopPropagation()">⠿</span><span class="badge ${BC[a.res]||'b-other'}">${a.res}</span><div class="rec-info"><div class="rec-player">#${a.bnum} ${a.bname} (${a.team==='home'?'홈':'원정'})</div><div class="rec-detail">${a.inn}${a.pt?' · '+a.pt:''}${a.zone?' · '+a.zone:''}${a.dir?' · '+a.dir:''}${a.rbi>0?' · '+a.rbi+'타점':''} · ${a.ts}</div></div><button class="rec-edit" onclick="openEditRec(${a.id})">✏️ 수정</button><button class="rec-del" onclick="delRec(${a.id})">✕</button></div>`).join('');
}
var _dragRecId=null;
function recDragStart(e,id){_dragRecId=id;e.dataTransfer.effectAllowed='move';setTimeout(()=>e.target.classList.add('dragging'),0);}
function recDragOver(e,id){e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.rec-item').forEach(el=>el.classList.remove('drag-over'));if(id!==_dragRecId)e.currentTarget.classList.add('drag-over');}
function recDragLeave(e){e.currentTarget.classList.remove('drag-over');}
function recDrop(e,targetId){
  e.preventDefault();
  if(!_dragRecId||_dragRecId===targetId)return;
  const si=AS.abs.findIndex(a=>a.id===_dragRecId);
  const ti=AS.abs.findIndex(a=>a.id===targetId);
  if(si===-1||ti===-1)return;
  const [item]=AS.abs.splice(si,1);
  AS.abs.splice(ti,0,item);
  _dragRecId=null;
  updateAll();
}
function recDragEnd(){_dragRecId=null;document.querySelectorAll('.rec-item').forEach(el=>{el.classList.remove('dragging','drag-over');});}
function shiftRecPlayer(dir){
  const allPlayers=[...AS.home_lineup,...AS.away_lineup].filter(p=>AS.abs.some(a=>a.bid===p.id));
  if(!allPlayers.length)return;
  const ids=[null,...allPlayers.map(p=>p.id)];
  let idx=ids.indexOf(AS.recFilterBid);
  if(idx===-1)idx=0;
  idx=(idx+dir+ids.length)%ids.length;
  AS.recFilterBid=ids[idx];
  renderRecs();
}
function delRec(id){AS.abs=AS.abs.filter(a=>a.id!==id);updateAll();}
function undoLast(){
  if(!AS.abs.length)return;
  AS.abs.pop();
  if(AS.zoneHistory&&Object.keys(AS.zoneHistory).length){
    var _zk=Object.keys(AS.zoneHistory).pop();
    if(_zk)delete AS.zoneHistory[_zk];
  }
  updateAll();
  hideToast();
  showToast('직전 타구를 취소했습니다',false);
}
function clearAll(){if(!confirm('모든 타석 기록을 삭제할까요?'))return;AS.abs=[];AS.zoneHistory={};AS.currentPitches=[];hidePtPicker();refreshZoneDisplay();updateAll();}

function updStats(){
  const abs=AS.abs,hits=['안타','내야안타','2루타','3루타','홈런'],base={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4},noab=['볼넷','사구','희타','희비'];
  const oab=abs.filter(a=>!noab.includes(a.res)).length,h=abs.filter(a=>hits.includes(a.res)).length;
  const reach=abs.filter(a=>[...hits,'볼넷','사구'].includes(a.res)).length;
  const tb=abs.reduce((s,a)=>s+(base[a.res]||0),0),rbi=abs.reduce((s,a)=>s+a.rbi,0);
  const avg=oab?h/oab:null,obp=abs.length?reach/abs.length:null,slg=oab?tb/oab:null;
  const ops=(obp!=null&&slg!=null)?obp+slg:null;
  document.getElementById('sAVG').textContent=avg!=null?avg.toFixed(3).replace('0.','.'):'.---';
  document.getElementById('sOBP').textContent=obp!=null?obp.toFixed(3).replace('0.','.'):'.---';
  document.getElementById('sSLG').textContent=slg!=null?slg.toFixed(3).replace('0.','.'):'.---';
  document.getElementById('sOPS').textContent=ops!=null?ops.toFixed(3).replace('0.','.'):'.---';
  document.getElementById('sAB').textContent=oab;document.getElementById('sH').textContent=h;document.getElementById('sRBI').textContent=rbi;
  const fd=abs.filter(a=>a.deg!=null),tot=fd.length||1;
  const pull=fd.filter(a=>a.deg<72).length,ctr=fd.filter(a=>a.deg>=72&&a.deg<=108).length,oppo=fd.filter(a=>a.deg>108).length;
  const pp=Math.round(pull/tot*100),pc=Math.round(ctr/tot*100),po=Math.round(oppo/tot*100);
  document.getElementById('dPull').textContent=pp+'%';document.getElementById('dCtr').textContent=pc+'%';document.getElementById('dOppo').textContent=po+'%';
  document.getElementById('bPull').style.height=Math.max(3,pp*.44)+'px';document.getElementById('bCtr').style.height=Math.max(3,pc*.44)+'px';document.getElementById('bOppo').style.height=Math.max(3,po*.44)+'px';
  drawDonut();renderPsTable();const _advAbs=AS.advFilter?abs.filter(a=>a.team===AS.advFilter):abs;renderExtStats(_advAbs);renderPitchTypeTable(_advAbs);renderZonePitchCross(_advAbs);renderResultDist(abs);renderSeasonStats();renderWeaknessAlerts(abs);
}

function renderExtStats(abs){
  const hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
  const pa=abs.length;
  const bb=abs.filter(a=>a.res==='볼넷').length;
  const hbp=abs.filter(a=>a.res==='사구').length;
  const sf=abs.filter(a=>a.res==='희비').length;
  const ab=abs.filter(a=>!noab.includes(a.res)).length;
  const s1=abs.filter(a=>['안타','내야안타'].includes(a.res)).length;
  const s2=abs.filter(a=>a.res==='2루타').length;
  const s3=abs.filter(a=>a.res==='3루타').length;
  const hr=abs.filter(a=>a.res==='홈런').length;
  const k=abs.filter(a=>a.res==='삼진').length;
  const h=hits.reduce((n,r)=>n+abs.filter(a=>a.res===r).length,0);
  const wNum=0.69*bb+0.72*hbp+0.89*s1+1.27*s2+1.62*s3+2.10*hr;
  const wDen=ab+bb+sf+hbp;
  const woba=wDen?wNum/wDen:null;
  const babipDen=ab-k-hr+sf;
  const babip=babipDen>0?(h-hr)/babipDen:null;
  const bbpct=pa?bb/pa*100:null;
  const kpct=pa?k/pa*100:null;
  const fmt3=v=>v!=null?v.toFixed(3).replace('0.','.'):'.---';
  const fmtPct=v=>v!=null?v.toFixed(1)+'%':'--%';
  document.getElementById('sWOBA').textContent=fmt3(woba);
  document.getElementById('sBABIP').textContent=fmt3(babip);
  document.getElementById('sBBpct').textContent=fmtPct(bbpct);
  document.getElementById('sKpct').textContent=fmtPct(kpct);
}

function renderPitchTypeTable(abs){
  const el=document.getElementById('pitchTypeTable');if(!el)return;
  const pts=['직구','커브','슬라이더','체인지업','포크볼','커터'];
  const hits=['안타','내야안타','2루타','3루타','홈런'];
  const rows=pts.map(pt=>{
    const pa=abs.filter(a=>a.pt===pt);
    if(!pa.length)return null;
    const h=pa.filter(a=>hits.includes(a.res)).length;
    const k=pa.filter(a=>a.res==='삼진').length;
    const hr=pa.filter(a=>a.res==='홈런').length;
    return{pt,n:pa.length,h,k,hr,avg:h/pa.length,kpct:k/pa.length};
  }).filter(Boolean);
  if(!rows.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">투구 구종 기록 없음</div>';return;}
  el.innerHTML='<table class="pitch-tbl"><thead><tr><th>구종</th><th>PA</th><th>H</th><th>K</th><th>HR</th><th>H%</th><th>K%</th></tr></thead><tbody>'+
    rows.map(r=>`<tr><td>${r.pt}</td><td>${r.n}</td><td style="color:#2dd4a0">${r.h}</td><td style="color:#f56565">${r.k}</td><td style="color:#f6c23e">${r.hr}</td><td>${(r.avg*100).toFixed(0)}%</td><td>${(r.kpct*100).toFixed(0)}%</td></tr>`).join('')+
    '</tbody></table>';
}

function renderZonePitchCross(abs){
  const el=document.getElementById('zonePitchCross');if(!el)return;
  const zones=['내각 높음','중앙 높음','외각 높음','내각 중간','중앙 중간','외각 중간','내각 낮음','중앙 낮음','외각 낮음'];
  const zoneShort={'내각 높음':'내↑','중앙 높음':'중↑','외각 높음':'외↑','내각 중간':'내→','중앙 중간':'중→','외각 중간':'외→','내각 낮음':'내↓','중앙 낮음':'중↓','외각 낮음':'외↓'};
  const pts=['직구','커브','슬라이더','체인지업','포크볼','커터'];
  const hits=['안타','내야안타','2루타','3루타','홈런'];
  const matrix={};
  zones.forEach(z=>{pts.forEach(pt=>{matrix[z+'|'+pt]={n:0,h:0};});});
  abs.forEach(ab=>{
    const ps=ab.pitches&&ab.pitches.length?ab.pitches:(ab.zone&&ab.pt?[{zone:ab.zone,pt:ab.pt,res:ab.res}]:[]);
    ps.forEach((p,i)=>{
      if(!p.zone||!p.pt||!zones.includes(p.zone)||!pts.includes(p.pt))return;
      const key=p.zone+'|'+p.pt;
      if(!matrix[key])return;
      matrix[key].n++;
      if(i===ps.length-1&&hits.includes(ab.res))matrix[key].h++;
    });
  });
  const usedPts=pts.filter(pt=>zones.some(z=>(matrix[z+'|'+pt]||{}).n>0));
  if(!usedPts.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">코스+구종 기록 없음</div>';return;}
  let html='<table class="cross-tbl"><thead><tr><th>코스</th>'+usedPts.map(pt=>`<th>${pt.slice(0,2)}</th>`).join('')+'</tr></thead><tbody>';
  html+=zones.map(z=>{
    const row=usedPts.map(pt=>{
      const d=matrix[z+'|'+pt];
      if(!d||!d.n)return'<td></td>';
      const rate=d.h/d.n;
      const cls=rate>=0.4?'cross-cell-hit':rate>0?'cross-cell-mix':'cross-cell-out';
      return`<td class="${cls}" title="${d.h}H/${d.n}">${d.n}</td>`;
    }).join('');
    return`<tr><td>${zoneShort[z]||z}</td>${row}</tr>`;
  }).join('');
  html+='</tbody></table><div style="font-size:8px;color:var(--text3);margin-top:4px">숫자=투구수 · 🟢=안타율≥40% · 🟡=안타있음 · 🔴=안타없음</div>';
  el.innerHTML=html;
}

function renderSeasonStats(){
  var games=[];
  var hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
  var BM={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
  for(var i=0;i<localStorage.length;i++){
    var key=localStorage.key(i);
    if(!key||!key.startsWith('sl_')||key.startsWith('sl_auto_'))continue;
    try{
      var d=JSON.parse(localStorage.getItem(key));
      if(d&&Array.isArray(d.abs)&&d.abs.length){
        var ab=d.abs.filter(function(a){return!noab.includes(a.res);}).length;
        var h=d.abs.filter(function(a){return hits.includes(a.res);}).length;
        var rbi=d.abs.reduce(function(s,a){return s+a.rbi;},0);
        var bb=d.abs.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
        var tb=d.abs.reduce(function(s,a){return s+(BM[a.res]||0);},0);
        var hr=d.abs.filter(function(a){return a.res==='홈런';}).length;
        var obp=d.abs.length?(h+bb)/d.abs.length:0;
        var slg=ab?tb/ab:0;
        // 저장 시각 파싱 (월 추출용)
        var tsNum=0;
        try{if(d.ts&&typeof d.ts==='number')tsNum=d.ts;else if(d.ts)tsNum=new Date(d.ts).getTime();}catch(e){}
        var month=tsNum?new Date(tsNum).getMonth()+1:0;
        // 컨디션 (공유 payload 또는 저장 데이터에서)
        var cond=d.cond||{};
        games.push({key:key,ts:tsNum,month:month,ab:ab,h:h,rbi:rbi,bb:bb,hr:hr,tb:tb,avg:ab?h/ab:0,obp:obp,slg:slg,ops:obp+slg,pa:d.abs.length,weather:cond.weather||'',field:cond.field||''});
      }
    }catch(e){}
  }
  games.sort(function(a,b){return a.ts-b.ts;});
  var el=document.getElementById('seasonSummary');
  if(!el)return;
  if(!games.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">저장된 경기가 없습니다</div>';return;}

  // ── 시즌 누적 합산 ──
  var totAB=games.reduce(function(s,g){return s+g.ab;},0);
  var totH=games.reduce(function(s,g){return s+g.h;},0);
  var totRBI=games.reduce(function(s,g){return s+g.rbi;},0);
  var totHR=games.reduce(function(s,g){return s+g.hr;},0);
  var totPA=games.reduce(function(s,g){return s+g.pa;},0);
  var totBB=games.reduce(function(s,g){return s+g.bb;},0);
  var totTB=games.reduce(function(s,g){return s+g.tb;},0);
  var sAvg=totAB?totH/totAB:0;
  var sObp=totPA?(totH+totBB)/totPA:0;
  var sSlg=totAB?totTB/totAB:0;
  var sOps=sObp+sSlg;

  var fmt=function(v){return '.'+Math.round(v*1000).toString().padStart(3,'0');};

  // ── 월별 집계 ──
  var monthMap={};
  games.forEach(function(g){
    if(!g.month)return;
    if(!monthMap[g.month])monthMap[g.month]={ab:0,h:0};
    monthMap[g.month].ab+=g.ab;monthMap[g.month].h+=g.h;
  });
  var monthKeys=Object.keys(monthMap).sort(function(a,b){return a-b;});
  var monthHTML='';
  if(monthKeys.length>1){
    monthHTML='<div style="font-size:9px;color:var(--text3);margin:8px 0 4px;letter-spacing:.8px;text-transform:uppercase">월별 타율</div>'
      +'<div class="season-month-grid">'
      +monthKeys.map(function(m){
        var d=monthMap[m];
        var avg=d.ab?d.h/d.ab:0;
        var col=avg>=0.3?'var(--green)':avg>=0.25?'var(--yellow)':'var(--red)';
        return '<div class="month-cell">'
          +'<div class="mc-m">'+m+'월</div>'
          +'<div class="mc-v" style="color:'+col+'">'+fmt(avg)+'</div>'
          +'<div class="mc-ab">'+d.h+'H/'+d.ab+'AB</div>'
          +'</div>';
      }).join('')+'</div>';
  }

  // ── 날씨·구장별 성적 (컨디션 태그가 있는 경우) ──
  var condGames=games.filter(function(g){return g.weather||g.field;});
  var condHTML='';
  if(condGames.length){
    var wMap={};
    condGames.forEach(function(g){
      var w=g.weather||'기타';
      if(!wMap[w])wMap[w]={ab:0,h:0};
      wMap[w].ab+=g.ab;wMap[w].h+=g.h;
    });
    condHTML='<div style="font-size:9px;color:var(--text3);margin:8px 0 4px;letter-spacing:.8px;text-transform:uppercase">날씨별 타율</div>'
      +Object.entries(wMap).map(function(e){
        var avg=e[1].ab?e[1].h/e[1].ab:0;
        return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:3px">'
          +'<span style="color:var(--text2)">'+e[0]+'</span>'
          +'<span style="font-family:var(--mono);font-weight:700;color:var(--text)">'+fmt(avg)+'</span>'
          +'</div>';
      }).join('');
  }

  el.innerHTML='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px">'
    +'<div class="stat-it"><div class="stat-v" style="font-size:15px">'+fmt(sAvg)+'</div><div class="stat-l">시즌AVG</div></div>'
    +'<div class="stat-it"><div class="stat-v" style="font-size:15px">'+fmt(sOps)+'</div><div class="stat-l">OPS</div></div>'
    +'<div class="stat-it"><div class="stat-v-sm">'+totH+'안타</div><div class="stat-l">'+totHR+'HR · '+totRBI+'타점</div></div>'
    +'<div class="stat-it"><div class="stat-v-sm">'+games.length+'경기</div><div class="stat-l">'+totAB+'타수</div></div>'
    +'</div>'
    +monthHTML
    +condHTML;

  // ── 최근 8경기 타율 추이 차트 ──
  var recent=games.slice(-8);
  var cvs=document.getElementById('recentTrend');
  if(!cvs||recent.length<2)return;
  var dpr=window.devicePixelRatio||1;
  cvs.width=(cvs.offsetWidth||280)*dpr;cvs.height=100*dpr;
  cvs.style.height='100px';
  var ctx=cvs.getContext('2d');
  ctx.scale(dpr,dpr);
  var W=cvs.offsetWidth||280,H=100,pad=14;
  var avgs=recent.map(function(g){return g.avg;});
  var minA=Math.max(0,Math.min.apply(null,avgs)-0.04);
  var maxA=Math.min(1,Math.max.apply(null,avgs)+0.04);
  var range=maxA-minA||0.1;
  var toX=function(i){return pad+(W-pad*2)*i/(recent.length-1);};
  var toY=function(v){return H-pad-(v-minA)/range*(H-pad*2);};

  // 그리드
  ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;
  [0.25,0.5,0.75].forEach(function(r){var y=toY(minA+range*r);ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();});

  // 시즌 평균 점선
  var sAvgY=toY(sAvg);
  ctx.setLineDash([3,4]);ctx.strokeStyle='rgba(75,140,245,.3)';
  ctx.beginPath();ctx.moveTo(pad,sAvgY);ctx.lineTo(W-pad,sAvgY);ctx.stroke();
  ctx.setLineDash([]);

  // 그라디언트 면적
  var grad=ctx.createLinearGradient(0,pad,0,H);
  grad.addColorStop(0,'rgba(75,140,245,0.3)');grad.addColorStop(1,'rgba(75,140,245,0)');
  ctx.beginPath();ctx.moveTo(toX(0),toY(avgs[0]));
  avgs.forEach(function(v,i){if(i>0)ctx.lineTo(toX(i),toY(v));});
  ctx.lineTo(toX(avgs.length-1),H-pad);ctx.lineTo(toX(0),H-pad);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();

  // 라인
  ctx.beginPath();ctx.strokeStyle='#4b8cf5';ctx.lineWidth=2.2;ctx.lineJoin='round';
  avgs.forEach(function(v,i){i===0?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v));});
  ctx.stroke();

  // 도트 + 레이블
  avgs.forEach(function(v,i){
    ctx.beginPath();ctx.arc(toX(i),toY(v),3.5,0,Math.PI*2);
    ctx.fillStyle='#4b8cf5';ctx.fill();
    ctx.strokeStyle='#07090f';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#8892a4';ctx.font='8px sans-serif';ctx.textAlign='center';
    var lbl=fmt(v);
    ctx.fillText(lbl,toX(i),toY(v)-7);
  });
}

function renderResultDist(abs){
  var el=document.getElementById('resultDistBar');
  if(!el)return;
  var total=abs.length||1;
  var cats=[
    {label:'안타 (1루타)',res:['안타','내야안타'],color:'#4b8cf5'},
    {label:'장타 (2·3·HR)',res:['2루타','3루타','홈런'],color:'#f56565'},
    {label:'볼넷/사구',res:['볼넷','사구'],color:'#a78bfa'},
    {label:'삼진',res:['삼진'],color:'#fb923c'},
    {label:'아웃',res:['플라이 아웃','땅볼 아웃','병살'],color:'#374151'}
  ];
  el.innerHTML=cats.map(function(c){
    var n=abs.filter(function(a){return c.res.includes(a.res);}).length;
    var pct=Math.round(n/total*100);
    return '<div style="display:flex;align-items:center;gap:6px">'
      +'<div style="width:72px;font-size:10px;color:var(--text2);flex-shrink:0">'+c.label+'</div>'
      +'<div style="flex:1;background:var(--bg-raised);border-radius:4px;height:10px;overflow:hidden">'
      +'<div style="width:'+pct+'%;height:100%;background:'+c.color+';border-radius:4px;transition:width .4s ease"></div>'
      +'</div>'
      +'<div style="width:32px;font-size:10px;color:var(--text2);text-align:right;flex-shrink:0">'+n+' ('+pct+'%)</div>'
      +'</div>';
  }).join('');
}

var _hzMode=null;
function toggleHotZoneOverlay(mode){
  _hzMode=(_hzMode===mode)?null:mode;
  ['hit','out','hr'].forEach(function(m){
    var btn=document.getElementById('hz'+m.charAt(0).toUpperCase()+m.slice(1)+'Btn');
    if(btn)btn.style.opacity=(_hzMode===m)?'1':'0.5';
  });
  // ovrCanvas show/hide
  var oC=document.getElementById('ovrCanvas');
  if(oC)oC.classList.toggle('show',!!_hzMode);
  drawHotZoneOverlay();
}
function drawHotZoneOverlay(){
  var cvs=document.getElementById('ovrCanvas');
  if(!cvs)return;
  var ctx=cvs.getContext('2d');
  var W=cvs.width,H=cvs.height;
  ctx.clearRect(0,0,W,H);
  if(!_hzMode)return;
  var hits=['안타','내야안타','2루타','3루타','홈런'],xbh=['2루타','3루타','홈런'];
  var filter={
    hit:function(a){return hits.includes(a.res);},
    out:function(a){return ['플라이 아웃','땅볼 아웃','삼진','병살'].includes(a.res);},
    hr:function(a){return xbh.includes(a.res);}
  };
  var pts=AS.abs.filter(function(a){return a.x&&a.y&&filter[_hzMode](a);});
  if(!pts.length)return;
  var color={hit:'rgba(45,212,160,',out:'rgba(245,101,101,',hr:'rgba(251,146,60,'};
  var c=color[_hzMode];
  var r=Math.max(20,W*0.07);
  pts.forEach(function(a){
    var px=a.x*W,py=a.y*H;
    var grd=ctx.createRadialGradient(px,py,0,px,py,r);
    grd.addColorStop(0,c+'0.18)');grd.addColorStop(1,c+'0)');
    ctx.fillStyle=grd;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
  });
}

function drawDonut(){
  const c=document.getElementById('donut');if(!c)return;const ctx=c.getContext('2d');
  const dpr=window.devicePixelRatio||1;c.width=72*dpr;c.height=72*dpr;c.style.width='72px';c.style.height='72px';ctx.scale(dpr,dpr);
  const cts={'안타':0,'2루타':0,'3루타':0,'홈런':0,'아웃':0};
  AS.abs.forEach(a=>{if(['안타','내야안타'].includes(a.res))cts['안타']++;else if(a.res==='2루타')cts['2루타']++;else if(a.res==='3루타')cts['3루타']++;else if(a.res==='홈런')cts['홈런']++;else if(a.res.includes('아웃')||a.res==='병살')cts['아웃']++;});
  const cols=['#2dd4a0','#4b8cf5','#f6c23e','#f56565','#374151'],keys=Object.keys(cts),tot=Object.values(cts).reduce((a,b)=>a+b,0);
  const cx=36,cy=36,r=28,ir=16;ctx.clearRect(0,0,72,72);
  if(!tot){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle='#1e2535';ctx.lineWidth=r-ir;ctx.stroke();}
  else{let st=-Math.PI/2;keys.forEach((k,i)=>{const sl=(cts[k]/tot)*Math.PI*2;if(!sl)return;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,st,st+sl);ctx.closePath();ctx.fillStyle=cols[i];ctx.fill();st+=sl;});ctx.beginPath();ctx.arc(cx,cy,ir,0,Math.PI*2);ctx.fillStyle='#18181f';ctx.fill();}
  const ids=['lp1','lp2','lp3','lp4','lp5'];keys.forEach((k,i)=>{const pct=tot?Math.round(cts[k]/tot*100):0;document.getElementById(ids[i]).textContent=pct+'%';});
}

function calcMVP(){
  var allLP=[...AS.home_lineup,...AS.away_lineup];
  if(!allLP.length)return null;
  var NOAB=['볼넷','사구','희타','희비'],HITS=['안타','내야안타','2루타','3루타','홈런'],BASE={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
  var best=null,bestScore=-1;
  allLP.forEach(function(p){
    var pa=AS.abs.filter(function(a){return a.bid===p.id;});if(!pa.length)return;
    var oab=pa.filter(function(a){return!NOAB.includes(a.res);}).length;
    var h=pa.filter(function(a){return HITS.includes(a.res);}).length;
    var reach=pa.filter(function(a){return HITS.includes(a.res)||a.res==='볼넷'||a.res==='사구';}).length;
    var tb=pa.reduce(function(s,a){return s+(BASE[a.res]||0);},0);
    var rbi=pa.reduce(function(s,a){return s+a.rbi;},0);
    var hr=pa.filter(function(a){return a.res==='홈런';}).length;
    var avg=oab?h/oab:0,obp=pa.length?reach/pa.length:0,slg=oab?tb/oab:0;
    var score=avg*30+obp*25+slg*20+rbi*10+hr*8+h*5;
    if(score>bestScore){bestScore=score;best={p:p,avg:avg,obp:obp,slg:slg,rbi:rbi,hr:hr,h:h,oab:oab,score:Math.round(score)};}
  });
  return best;
}
function showMVP(){
  var w=document.getElementById('mvpCardWrap');if(!w)return;
  var mv=calcMVP();
  if(!mv){w.style.display='none';return;}
  w.style.display='';
  var content=document.getElementById('mvpContent');
  var p=mv.p;
  var reasons=[];
  if(mv.hr>0)reasons.push('홈런 '+mv.hr+'개');
  if(mv.rbi>0)reasons.push('타점 '+mv.rbi+'점');
  if(mv.h>0)reasons.push('안타 '+mv.h+'개');
  reasons.push('타율 '+mv.avg.toFixed(3).replace('0.','.')+' / OPS '+(mv.obp+mv.slg).toFixed(3).replace('0.','.'));
  content.innerHTML='<div class="mvp-card">'
    +'<div class="mvp-badge">MVP · '+mv.score+'pts</div>'
    +'<div class="mvp-name">#'+p.num+' '+p.name+(p.pos?' <span style="font-size:11px;color:var(--text3)">('+p.pos+')</span>':'')+'</div>'
    +'<div class="mvp-reason">'+reasons.join(' · ')+'</div>'
    +'<div style="margin-top:6px;display:flex;gap:10px">'
    +'<span style="font-size:10px;color:var(--text3)">AVG <strong style="color:var(--text)">'+mv.avg.toFixed(3).replace('0.','.')+'</strong></span>'
    +'<span style="font-size:10px;color:var(--text3)">OBP <strong style="color:var(--text)">'+mv.obp.toFixed(3).replace('0.','.')+'</strong></span>'
    +'<span style="font-size:10px;color:var(--text3)">SLG <strong style="color:var(--text)">'+mv.slg.toFixed(3).replace('0.','.')+'</strong></span>'
    +'</div></div>';
}

function renderPsTable(){
  const targetLineup = getActiveLineup();
  const el=document.getElementById('psTable');if(!targetLineup.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">선수를 추가하세요</div>';return;}
  const noab=['bold','볼넷','사구','희타','희비'],hits=['안타','내야안타','2루타','3루타','홈런'];
  el.innerHTML=targetLineup.map(p=>{const pAbs=AS.abs.filter(a=>a.bid===p.id);const oab=pAbs.filter(a=>!noab.includes(a.res)).length;const h=pAbs.filter(a=>hits.includes(a.res)).length;const av=oab?(h/oab).toFixed(3).replace('0.','.'):'.---';const rbi=pAbs.reduce((s,a)=>s+a.rbi,0);return`<div class="ps-row"><div class="ps-num">${p.num}</div><div class="ps-name">${p.name}</div><div class="ps-avg">${av}</div><div class="ps-ab">${h}H/${oab}AB${rbi>0?' '+rbi+'타점':''}</div></div>`;}).join('');
}

var _tabOrder=['rec','batter','stat','chart','pitcher'];
function swTab(name,el){
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('on');});
  document.querySelectorAll('.tab-pnl').forEach(function(p){p.classList.remove('on');});
  if(el)el.classList.add('on');
  document.getElementById('pnl-'+name).classList.add('on');
  if(window.innerWidth<=720){
    var body=document.querySelector('.tab-body');
    var idx=_tabOrder.indexOf(name);
    if(body&&idx>=0)body.scrollTo({left:idx*body.clientWidth,behavior:'smooth'});
  }
  if(name==='stat')updStats();
  if(name==='batter')updBatterStat();
  if(name==='chart')updCharts();
  if(name==='pitcher')renderPitcherStats();
}
(function(){
  var body=document.querySelector('.tab-body');
  if(!body)return;
  var _st=null;
  body.addEventListener('scroll',function(){
    clearTimeout(_st);
    _st=setTimeout(function(){
      if(window.innerWidth>720)return;
      var idx=Math.round(body.scrollLeft/body.clientWidth);
      idx=Math.max(0,Math.min(_tabOrder.length-1,idx));
      var name=_tabOrder[idx];
      document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('on');});
      var tab=document.getElementById('tab-'+name);
      if(tab)tab.classList.add('on');
      document.querySelectorAll('.tab-pnl').forEach(function(p){p.classList.remove('on');});
      document.getElementById('pnl-'+name).classList.add('on');
      if(name==='stat')updStats();
      if(name==='batter')updBatterStat();
      if(name==='chart')updCharts();
      if(name==='pitcher')renderPitcherStats();
    },150);
  },{passive:true});
})();

function updCharts(){
  renderCountHeatmap(AS.abs);
  drawInningChart(AS.abs);
  drawAvgTrend(AS.abs);
  populateCompareSelects();
}

function renderCountHeatmap(abs){
  const el=document.getElementById('countHeatmap');if(!el)return;
  const COUNTS=['0-0','1-0','2-0','3-0','0-1','1-1','2-1','3-1','0-2','1-2','2-2','3-2'];
  const hits=['안타','내야안타','2루타','3루타','홈런'];
  const counts={};
  COUNTS.forEach(c=>{counts[c]={h:0,out:0,walk:0,k:0,total:0};});
  abs.forEach(a=>{
    const b=(a.count&&a.count.b!=null)?a.count.b:null;
    const s=(a.count&&a.count.s!=null)?a.count.s:null;
    if(b===null||s===null)return;
    const key=b+'-'+s;
    if(!counts[key])return;
    counts[key].total++;
    if(hits.includes(a.res)||a.res==='볼넷'||a.res==='사구'){counts[key].h++;counts[key].walk=(counts[key].walk||0)+1;}
    else if(a.res==='삼진')counts[key].k++;
    else if(a.res.includes('아웃')||a.res==='병살')counts[key].out++;
  });
  const total=abs.length||1;
  el.innerHTML='<div class="count-heatmap">'+COUNTS.map(c=>{
    const d=counts[c];
    let bg='var(--bg-raised)',border='var(--border2)';
    if(d.total){
      const hr=d.h/d.total,or=d.out/d.total,kr=d.k/d.total;
      if(hr>=0.5){bg='rgba(45,212,160,.3)';border='#2dd4a0'}
      else if(hr>0&&hr>=or){bg='rgba(45,212,160,.15)';border='rgba(45,212,160,.4)'}
      else if(d.k>d.out){bg='rgba(246,194,62,.15)';border='rgba(246,194,62,.4)'}
      else{bg='rgba(245,101,101,.15)';border='rgba(245,101,101,.35)'}
    }
    const resStr=d.total?`${d.h}출 ${d.out}아 ${d.k}삼`:'기록없음';
    var outcomeLabel=d.total?`🟢${d.h} 🔴${d.out} K${d.k}`:'—';
    return`<div class="cnt-hm-cell" style="background:${bg};border:1.5px solid ${border};padding:5px 2px" title="${c}카운트: ${d.total}타석"><span class="cnt-hm-key" style="font-size:10px;font-weight:700">${c}</span><span style="font-family:var(--mono);font-size:12px;font-weight:800;color:var(--text)">${d.total||'—'}</span><span class="cnt-hm-res" style="font-size:8px;color:var(--text);opacity:.85">${outcomeLabel}</span></div>`;
  }).join('')+'</div>';
}

function drawInningChart(abs){
  const c=document.getElementById('inningChart');if(!c)return;
  const dpr=window.devicePixelRatio||1;
  const W=c.parentElement.clientWidth-24||220,H=80;
  c.width=W*dpr;c.height=H*dpr;c.style.width=W+'px';c.style.height=H+'px';
  const ctx=c.getContext('2d');ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const INNS=['1회초','1회말','2회초','2회말','3회초','3회말','4회초','4회말','5회초','5회말','6회초','6회말','7회초','7회말','8회초','8회말','9회초','9회말','연장'];
  const noab=['볼넷','사구','희타','희비'];
  const hits=['안타','내야안타','2루타','3루타','홈런'];
  const used=INNS.filter(inn=>abs.some(a=>a.inn===inn));
  if(!used.length){ctx.fillStyle='#374151';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText('기록 없음',W/2,H/2);return;}
  const data=used.map(inn=>{
    const ia=abs.filter(a=>a.inn===inn);
    const ab=ia.filter(a=>!noab.includes(a.res)).length;
    const h=ia.filter(a=>hits.includes(a.res)).length;
    return{inn,ab,h};
  });
  const maxAB=Math.max(...data.map(d=>d.ab),1);
  const barW=Math.floor((W-20)/used.length);
  const maxH=H-24;
  data.forEach((d,i)=>{
    const x=10+i*barW+2;const bw=barW-4;
    const abH=Math.round(d.ab/maxAB*maxH);const hH=Math.round(d.h/maxAB*maxH);
    ctx.fillStyle='rgba(75,140,245,.35)';ctx.fillRect(x,H-20-abH,bw,abH);
    ctx.fillStyle='#2dd4a0';ctx.fillRect(x,H-20-hH,bw,hH);
    ctx.fillStyle='#374151';ctx.font=`${Math.min(8,barW-2)}px sans-serif`;ctx.textAlign='center';
    const label=d.inn.replace('회','').replace('초','↑').replace('말','↓');
    ctx.fillText(label,x+bw/2,H-6);
    if(d.ab>0){ctx.fillStyle='#7c8898';ctx.font='8px sans-serif';ctx.fillText(d.ab,x+bw/2,H-20-abH-2);}
  });
}

var _trendData=[];
function drawAvgTrend(abs){
  const c=document.getElementById('avgTrendChart');if(!c)return;
  _trendData=[];
  const dpr=window.devicePixelRatio||1;
  const W=c.parentElement.clientWidth-24||220,H=80;
  c.width=W*dpr;c.height=H*dpr;c.style.width=W+'px';c.style.height=H+'px';
  const ctx=c.getContext('2d');ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const noab=['볼넷','사구','희타','희비'];
  const hits=['안타','내야안타','2루타','3루타','홈런'];
  const pts=[];let cumAB=0,cumH=0;
  abs.forEach(a=>{
    if(!noab.includes(a.res))cumAB++;
    if(hits.includes(a.res))cumH++;
    if(cumAB>0){pts.push(cumH/cumAB);_trendData.push({avg:cumH/cumAB,cumAB,cumH,ab:a});}
  });
  if(pts.length<2){ctx.fillStyle='#374151';ctx.font='11px sans-serif';ctx.textAlign='center';ctx.fillText('타석 2개 이상 필요',W/2,H/2);_trendData=[];return;}
  const pad=8;const cW=W-pad*2;const cH=H-pad*2;
  const minV=0,maxV=1;
  const toX=i=>pad+i/(pts.length-1)*cW;
  const toY=v=>pad+(1-(v-minV)/(maxV-minV))*cH;
  _trendData.forEach((d,i)=>{d.px=toX(i);d.py=toY(d.avg);});
  // Grid lines
  [0,.2,.4,.6,.8,1.0].forEach(v=>{
    const y=toY(v);ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();
    ctx.fillStyle='#374151';ctx.font='7px sans-serif';ctx.textAlign='left';
    ctx.fillText('.'+Math.round(v*1000).toString().padStart(3,'0'),0,y+3);
  });
  // Area fill
  ctx.beginPath();ctx.moveTo(toX(0),toY(pts[0]));
  pts.forEach((v,i)=>{if(i>0)ctx.lineTo(toX(i),toY(v));});
  ctx.lineTo(toX(pts.length-1),H-pad);ctx.lineTo(toX(0),H-pad);ctx.closePath();
  ctx.fillStyle='rgba(75,140,245,.12)';ctx.fill();
  // Line
  ctx.beginPath();ctx.moveTo(toX(0),toY(pts[0]));
  pts.forEach((v,i)=>{if(i>0)ctx.lineTo(toX(i),toY(v));});
  ctx.strokeStyle='#4b8cf5';ctx.lineWidth=1.8;ctx.stroke();
  // Last point
  const lx=toX(pts.length-1),ly=toY(pts[pts.length-1]);
  ctx.beginPath();ctx.arc(lx,ly,3,0,Math.PI*2);
  ctx.fillStyle='#4b8cf5';ctx.fill();
  // Last value label
  ctx.fillStyle='#eef0f8';ctx.font='bold 9px sans-serif';ctx.textAlign='right';
  const finalAvg=pts[pts.length-1].toFixed(3).replace('0.','.');
  ctx.fillText(finalAvg,W-pad-2,ly-4);
  // Interaction
  _initTrendInteraction(c);
}
function _initTrendInteraction(c){
  const RES_COL={'안타':'#2dd4a0','내야안타':'#5eead4','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565','볼넷':'#a78bfa','사구':'#fb923c','삼진':'#6b7280','플라이 아웃':'#4b5563','땅볼 아웃':'#374151','희타':'#94a3b8','희비':'#94a3b8','병살':'#991b1b'};
  function getNear(mx){let best=null,bestD=Infinity;_trendData.forEach(d=>{const dd=Math.abs(mx-d.px);if(dd<bestD){bestD=dd;best=d;}});return bestD<45?best:null;}
  function showTip(mx,my){
    const tip=document.getElementById('trendTip');if(!tip)return;
    const d=getNear(mx);
    if(!d){tip.style.display='none';return;}
    const ab=d.ab,avgStr=d.avg.toFixed(3).replace('0.','.'),rCol=RES_COL[ab.res]||'var(--text2)';
    const dirK={'LF':'당겨치기','LC':'좌중간','CF':'센터','RC':'우중간','RF':'밀어치기'};
    tip.innerHTML='<div class="tt-avg">'+avgStr+'</div>'
      +'<div class="tt-row">#'+d.cumAB+'번째 타수 · '+(ab.bname||'?')+'</div>'
      +'<div class="tt-row" style="color:'+rCol+'">→ '+ab.res+'</div>'
      +(ab.pt?'<div class="tt-row">구종: '+ab.pt+'</div>':'')
      +(ab.dir?'<div class="tt-row">방향: '+(dirK[ab.dir]||ab.dir)+'</div>':'')
      +'<div class="tt-row">누적 '+d.cumH+'안타 / '+d.cumAB+'타수</div>'
      +(ab.inn?'<div class="tt-row" style="color:var(--text3)">'+ab.inn+'</div>':'');
    tip.style.display='block';
    const tipW=tip.offsetWidth||130,tipH=tip.offsetHeight||90;
    let tx=mx+10,ty=Math.max(2,my-tipH/2);
    if(tx+tipW>c.offsetWidth-4)tx=mx-tipW-10;
    if(tx<2)tx=2;
    tip.style.left=tx+'px';tip.style.top=ty+'px';
  }
  function hideTip(){const tip=document.getElementById('trendTip');if(tip)tip.style.display='none';}
  c.onmousemove=function(e){showTip(e.offsetX,e.offsetY);};
  c.onmouseleave=hideTip;
  c.style.cursor='crosshair';
  c.ontouchstart=function(e){e.preventDefault();};
  c.ontouchmove=function(e){e.preventDefault();const r=c.getBoundingClientRect(),t=e.touches[0];showTip(t.clientX-r.left,t.clientY-r.top);};
  c.ontouchend=function(){setTimeout(hideTip,1800);};
}

function openOverlay(id){document.getElementById(id).classList.add('show');}
function closeOverlay(id){document.getElementById(id).classList.remove('show');if(id==='hitOverlay'){closeHitDetail();AS.pending=null;if(oCtx){oCtx.clearRect(0,0,FS,FS);if(AS.showHotCold&&AS.batter){_drawHotColdOnCtx();oC&&oC.classList.add('show');}else{oC&&oC.classList.remove('show');}}}}
function closeHit(){closeOverlay('hitOverlay');}

let _tt;
function showToast(msg,showUndo=true,autoHide=true){const t=document.getElementById('toast');document.getElementById('toastTxt').textContent=msg;document.getElementById('toastUndo').style.display=showUndo?'':'none';t.classList.add('show');clearTimeout(_tt);if(autoHide)_tt=setTimeout(hideToast,6000);}
function hideToast(){document.getElementById('toast').classList.remove('show');}

function saveGame(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    const key='sl_'+Date.now();
    const data={key,hs:AS.hs,as:AS.as,th:document.getElementById('tHome').value,ta:document.getElementById('tAway').value,home_lineup:AS.home_lineup,away_lineup:AS.away_lineup,abs:AS.abs,zoneHistory:AS.zoneHistory,d:new Date().toLocaleDateString('ko-KR'),ts:Date.now(),cond:getGameCond(),pitchers:AS.pitchers};
    const saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
    saves.push({key,label:_gameTitle(data.th,data.ta,data.ts)+' '+data.hs+':'+data.as,ts:data.ts});
    localStorage.setItem('sl_saves',JSON.stringify(saves));
    localStorage.setItem(key,JSON.stringify(data));
    if(window.cloudSave)cloudSave(key,data,saves[saves.length-1].label,data.ts);
    _gameSaved=true;
    showToast('경기 저장 완료 ✓',false);
    triggerSavePulse();
    setTimeout(showGameSummary, 400);
  }, 300);
}

function openLoad(){
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  var el=document.getElementById('saveList');
  if(!saves.length){
    el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">저장된 경기가 없습니다</div>';
  }else{
    el.innerHTML=[...saves].reverse().map(function(s){
      return '<div class="load-item">' +
        '<div class="load-item-body" onclick="restoreGame(\'' + s.key + '\')">' +
          '<div class="load-item-title">' + s.label + '</div>' +
          '<div class="load-item-date">' + _fmtTs(s.ts) + '</div>' +
        '</div>' +
        '<div class="load-item-actions">' +
          // 💡 일반 '다운로드' 대신 전용 '앱 파일 내보내기' 형태로 UI 전면 패치
          '<button class="li-btn" onclick="renameGame(\'' + s.key + '\')" title="이름 변경">✏️</button>' +
          '<button class="li-btn" onclick="exportGameToExcel(\'' + s.key + '\')" style="color:var(--blue)">📊 엑셀</button>' +
          '<button class="li-btn share-btn" onclick="shareGame(\'' + s.key + '\')" style="color:var(--green)">내보내기</button>' +
          '<button class="li-btn load-btn" onclick="restoreGame(\'' + s.key + '\')">불러오기</button>' +
          '<button class="li-btn del-btn" onclick="deleteGame(\'' + s.key + '\')">삭제</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  openOverlay('loadOverlay');
}

function deleteGame(key){
  if(!confirm('이 저장 기록을 삭제할까요?'))return;
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  saves=saves.filter(function(s){return s.key!==key;});
  localStorage.setItem('sl_saves',JSON.stringify(saves));
  localStorage.removeItem(key);
  if(window.cloudDelete)cloudDelete(key);
  openLoad();
  showToast('삭제되었습니다',false);
}

// ───── [진짜 앱 데이터 변환 장치] 내장 저장소 다운로드 폴더 출력 ─────
function shareGame(key){
  var d=JSON.parse(localStorage.getItem(key));
  if(!d)return;
  var exportObj={version:1,type:'single',saves:[{key:key,label:(d.th||'홈팀')+' vs '+(d.ta||'원정팀'),ts:d.ts}],data:{}};
  exportObj.data[key]=d;
  var jsonStr=JSON.stringify(exportObj,null,2);
  var blob=new Blob([jsonStr],{type:'application/json'});
  var safe=function(s){return (s||'').replace(/[\/\:*?"<>|\s]/g,'_');};
  var fileName=safe(d.th||'홈팀')+'_vs_'+safe(d.ta||'원정팀')+'_'+safe(d.d||'경기')+'.json';
  var shareTitle='SprayLab: '+(d.th||'홈팀')+' '+d.hs+':'+d.as+' '+(d.ta||'원정팀');
  if(navigator.share){
    var file=new File([blob],fileName,{type:'application/json'});
    var canShareFiles=!!(navigator.canShare&&navigator.canShare({files:[file]}));
    navigator.share(canShareFiles
      ?{title:shareTitle,text:shareTitle,files:[file]}
      :{title:shareTitle,text:shareTitle}
    ).catch(function(err){if(err.name!=='AbortError')downloadBlob(blob,fileName);});
  }else{
    downloadBlob(blob,fileName);
  }
}

function exportAllGames(){
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  if(!saves.length){showToast('저장된 경기가 없습니다',false);return;}
  var data={};
  saves.forEach(function(s){var raw=localStorage.getItem(s.key);if(raw)data[s.key]=JSON.parse(raw);});
  var jsonStr=JSON.stringify({version:1,type:'all',saves:saves,data:data},null,2);
  var blob=new Blob([jsonStr],{type:'application/json'});
  var today=new Date().toLocaleDateString('ko-KR').replace(/\./g,'').replace(/\s/g,'');
  var fileName='SprayLab_전체백업_'+today+'.json';
  var shareTitle='SprayLab 전체 경기 백업 ('+saves.length+'개)';
  if(navigator.share){
    var file=new File([blob],fileName,{type:'application/json'});
    var canShareFiles=!!(navigator.canShare&&navigator.canShare({files:[file]}));
    navigator.share(canShareFiles
      ?{title:shareTitle,text:shareTitle,files:[file]}
      :{title:shareTitle,text:shareTitle}
    ).catch(function(err){if(err.name!=='AbortError')downloadBlob(blob,fileName);});
  }else{
    downloadBlob(blob,fileName);
  }
}

function downloadBlob(blob, fileName) {
  var ua = navigator.userAgent.toLowerCase();
  var isKakao = ua.indexOf('kakaotalk') > -1;
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isKakao) {
    // 카카오톡: 다운로드 불가 → 복사 모달
    var r = new FileReader();
    r.onload = function(e) {
      try { showDataModal(atob(e.target.result.split(',')[1]), fileName); }
      catch(ex) { showDataModal(e.target.result, fileName); }
    };
    r.readAsDataURL(blob);
    return;
  }

  if (navigator.share) {
    var file = new File([blob], fileName, {type: blob.type || 'application/json'});
    var sd = {title: 'SprayLab', text: fileName};
    if (navigator.canShare && navigator.canShare({files:[file]})) sd.files = [file];
    navigator.share(sd)
      .catch(function(err) { if (err.name !== 'AbortError') _doDownload(blob, fileName, isIOS); });
    return;
  }

  _doDownload(blob, fileName, isIOS);
}

function _doDownload(blob, fileName, isIOS) {
  if (isIOS) {
    var r = new FileReader();
    r.onloadend = function() {
      try { var json = atob(r.result.split(',')[1]); showDataModal(json, fileName); }
      catch(e) { showDataModal(r.result, fileName); }
    };
    r.readAsDataURL(blob);
    return;
  }
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = fileName; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  showToast('파일 저장: ' + fileName, false);
  setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

function importFromPaste() {
  var text = (document.getElementById('paste-json') || {}).value;
  if (!text || !text.trim()) { showToast('붙여넣을 내용이 없습니다', false); return; }
  _doImportText(text);
  document.getElementById('paste-json').value = '';
  document.getElementById('paste-area').style.display = 'none';
}

function _doImportText(text) {
  try {
    if (text.trim()[0] !== '{') { showToast('SprayLab 데이터가 아닙니다', false); return; }
    var obj = JSON.parse(text);
    if (!obj || !obj.saves || !obj.data) { showToast('올바른 SprayLab 파일이 아닙니다', false); return; }
    var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
    var existingKeys = new Set(saves.map(function(s) { return s.key; }));
    var added = 0;
    obj.saves.forEach(function(s) {
      if (s && s.key && !existingKeys.has(s.key)) {
        saves.push(s);
        if (obj.data[s.key]){
          localStorage.setItem(s.key, JSON.stringify(obj.data[s.key]));
          if(window.cloudSave)cloudSave(s.key,obj.data[s.key],s.label,s.ts);
        }
        added++;
      }
    });
    localStorage.setItem('sl_saves', JSON.stringify(saves));
    openLoad();
    showToast(added > 0 ? added + '개 경기를 가져왔습니다' : '이미 있는 경기입니다', false);
  } catch(err) {
    showToast('데이터 형식이 올바르지 않습니다', false);
  }
}

function importGames(input) {
  var file = input.files[0]; if (!file) return;
  var name = file.name.toLowerCase();
  if (name.endsWith('.mht') || name.endsWith('.mhtml')) {
    alert('선택하신 파일은 웹페이지 저장 파일(.mht)입니다.\n\nSprayLab 앱에서 [공유] 또는 [전체 내보내기] 버튼으로 만든 .json 파일을 선택해주세요.');
    input.value = ''; return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    _doImportText(e.target.result);
    input.value = '';
  };
  reader.onerror = function() { showToast('파일 읽기 실패', false); };
  reader.readAsText(file, 'utf-8');
}


function restoreGame(key){
  const d=JSON.parse(localStorage.getItem(key));if(!d)return;
  AS.curGame=d.ts||key.replace('sl_',''); // Fix: 자동저장 key를 이 게임에 고정
  document.getElementById('tHome').value=d.th||'홈팀';document.getElementById('tAway').value=d.ta||'원정팀';
  AS.hs=d.hs||0;AS.as=d.as||0;document.getElementById('scH').textContent=AS.hs;document.getElementById('scA').textContent=AS.as;
  AS.home_lineup=d.home_lineup || d.lineup || [];
  AS.away_lineup=d.away_lineup || [];
  // 구 데이터 호환: team 필드 없는 abs는 'home' 처리
  AS.abs=(d.abs||[]).map(function(a){return a.team?a:Object.assign({},a,{team:'home'});});
  AS.zoneHistory=d.zoneHistory || {};
  AS.pitchers=d.pitchers||[];AS.currentPitcher=null;
  // pitchLog 복원: 모든 투수의 pitches 배열에서 재구성
  AS.pitchLog=[];
  AS.pitchers.forEach(function(p){if(p.pitches)p.pitches.slice().reverse().forEach(function(e){AS.pitchLog.push(e);});});
  AS.pitchLog.sort(function(a,b){return(b.id||0)-(a.id||0);});
  // 투수 목록 UI 갱신
  if(typeof renderPitcherRoster==='function')renderPitcherRoster();
  if(typeof renderPitchLog==='function')setTimeout(renderPitchLog,50);
  AS.batter=null;AS.balls=0;AS.strikes=0;AS.outs=0;AS.batterFilter=false;AS.showHotCold=false;AS.teamFilter=null;AS.advFilter=null;
  var afBtns=document.querySelectorAll('#advStatFilter .sf-btn');if(afBtns.length){afBtns.forEach(function(b,i){b.classList.toggle('on',i===0);});}
  closeOverlay('loadOverlay');
  refreshZoneDisplay();renderCount();
  var fb=document.getElementById('filterBtn');if(fb)fb.classList.remove('btn-primary');
  var hb=document.getElementById('hotColdBtn');if(hb)hb.classList.remove('btn-primary');
  var tb=document.getElementById('teamFilterBtn');if(tb){tb.textContent='전체';tb.classList.remove('btn-primary');}
  _gameSaved=true;_saveReminderShown=false;_startSaveReminderTimer();
  updateAll();
  showToast('경기 불러오기 완료',false);
}


// ─── COUNT BOARD ───
function chCount(type){
  if(type==='b')AS.balls=(AS.balls+1)%4;
  else if(type==='s')AS.strikes=(AS.strikes+1)%3;
  else if(type==='o')AS.outs=(AS.outs+1)%3;
  renderCount();
}
function resetCount(){AS.balls=0;AS.strikes=0;AS.outs=0;renderCount();}
function renderCount(){
  [{id:'cntBalls',n:AS.balls,cls:'lit-b'},{id:'cntStrikes',n:AS.strikes,cls:'lit-s'},{id:'cntOuts',n:AS.outs,cls:'lit-o'}].forEach(function(s){
    var el=document.getElementById(s.id);if(!el)return;
    el.querySelectorAll('.cnt-dot').forEach(function(dot,i){dot.classList.toggle(s.cls,i<s.n);});
  });
}

// ─── BATTER FILTER ───
function toggleBatterFilter(){
  AS.batterFilter=!AS.batterFilter;
  document.getElementById('filterBtn').classList.toggle('btn-primary',AS.batterFilter);
  safeRender();
}
function cycleTeamFilter(){
  const btn=document.getElementById('teamFilterBtn');
  if(AS.teamFilter===null){AS.teamFilter='home';if(btn){btn.textContent='홈';btn.classList.add('btn-primary');}}
  else if(AS.teamFilter==='home'){AS.teamFilter='away';if(btn)btn.textContent='원정';}
  else{
    AS.teamFilter=null;
    // 전체로 돌아올 때 타자 필터도 해제
    AS.batter=null;AS.batterFilter=false;
    const fb=document.getElementById('filterBtn');if(fb)fb.classList.remove('btn-primary');
    const d=document.getElementById('batterDisp');if(d)d.innerHTML='<span class="batter-empty">← 타자를 선택하세요</span>';
    if(btn){btn.textContent='전체';btn.classList.remove('btn-primary');}
  }
  safeRender();
}

// ─── HOT/COLD ZONES ───
function toggleHotCold(){
  AS.showHotCold=!AS.showHotCold;
  document.getElementById('hotColdBtn').classList.toggle('btn-primary',AS.showHotCold);
  updateHotCold();
}
function updateHotCold(){
  if(!oCtx)return;
  oCtx.clearRect(0,0,FS,FS);
  if(!AS.showHotCold){oC.classList.remove('show');return;}
  if(AS.batter){_drawHotColdOnCtx();}
  else{_drawFieldHeatmap();}
  oC.classList.add('show');
}
// 선택 타자의 구역별 안타율 (기존)
function _drawHotColdOnCtx(){
  if(!AS.batter)return;
  var bAbs=AS.abs.filter(function(a){return a.bid===AS.batter.id&&a.x!=null;});
  if(!bAbs.length)return;
  var cx=FS/2,cy=FS,ANGS=5,DISTS=3;
  var counts={},hits={};
  for(var aa=0;aa<ANGS;aa++)for(var dd=0;dd<DISTS;dd++){counts[aa+'_'+dd]=0;hits[aa+'_'+dd]=0;}
  var HITS=['안타','내야안타','2루타','3루타','홈런'];
  bAbs.forEach(function(ab){
    var x=ab.x*FS,y=ab.y*FS,dx=x-cx,dy=y-cy;
    var ang=((Math.atan2(dy,dx)+Math.PI)*180/Math.PI);
    var dist=Math.sqrt(dx*dx+dy*dy)/FS;
    var ai=Math.min(4,Math.floor(ang/36));
    var di=dist<0.35?0:dist<0.65?1:2;
    var k=ai+'_'+di;
    counts[k]++;
    if(HITS.includes(ab.res))hits[k]++;
  });
  var maxC=Math.max.apply(null,Object.values(counts).concat([1]));
  for(var a=0;a<ANGS;a++){
    for(var d=0;d<DISTS;d++){
      var k=a+'_'+d,n=counts[k];if(!n)continue;
      var hitRate=hits[k]/n,intensity=n/maxC;
      var r,g,b;
      if(hitRate>=0.5){r=45;g=212;b=160;}
      else if(hitRate>=0.25){r=246;g=194;b=62;}
      else{r=245;g=101;b=101;}
      var alpha=0.1+intensity*0.35;
      var a1=(a*36)*Math.PI/180-Math.PI;
      var a2=((a+1)*36)*Math.PI/180-Math.PI;
      var r1=(d===0?0.08:d===1?0.35:0.65)*FS;
      var r2=(d===0?0.35:d===1?0.65:0.97)*FS;
      oCtx.beginPath();
      oCtx.arc(cx,cy,r2,a1,a2);
      oCtx.arc(cx,cy,r1,a2,a1,true);
      oCtx.closePath();
      oCtx.fillStyle='rgba('+r+','+g+','+b+','+alpha+')';
      oCtx.fill();
    }
  }
}
// 전체 타구 밀집도 히트맵 (타자 미선택 시)
function _drawFieldHeatmap(){
  var list=AS.abs.filter(function(a){return a.x!=null;});
  if(AS.teamFilter)list=list.filter(function(a){return (a.team||'home')===AS.teamFilter;});
  if(!list.length)return;
  var cx=FS/2,cy=FS,ANGS=9,DISTS=3;
  var counts={};
  for(var aa=0;aa<ANGS;aa++)for(var dd=0;dd<DISTS;dd++)counts[aa+'_'+dd]=0;
  list.forEach(function(ab){
    var dx=ab.x*FS-cx,dy=ab.y*FS-cy;
    var ang=(Math.atan2(dy,dx)+Math.PI)*180/Math.PI; // 0~360
    if(ang>180)return; // 하반부 제외
    var dist=Math.sqrt(dx*dx+dy*dy)/FS;
    var ai=Math.min(ANGS-1,Math.floor(ang/(180/ANGS)));
    var di=dist<0.35?0:dist<0.65?1:2;
    counts[ai+'_'+di]++;
  });
  var maxC=Math.max.apply(null,Object.values(counts).concat([1]));
  for(var a=0;a<ANGS;a++){
    for(var d=0;d<DISTS;d++){
      var n=counts[a+'_'+d];if(!n)continue;
      var intensity=n/maxC;
      var r,g,b;
      if(intensity<0.25){r=75;g=140;b=245;}       // 파랑(콜드)
      else if(intensity<0.55){r=246;g=194;b=62;}  // 노랑(보통)
      else{r=245;g=101;b=101;}                    // 빨강(핫)
      var alpha=0.1+intensity*0.42;
      var a1=(a*(180/ANGS))*Math.PI/180-Math.PI;
      var a2=((a+1)*(180/ANGS))*Math.PI/180-Math.PI;
      var r1=(d===0?0.08:d===1?0.35:0.65)*FS;
      var r2=(d===0?0.35:d===1?0.65:0.97)*FS;
      oCtx.beginPath();
      oCtx.arc(cx,cy,r2,a1,a2);
      oCtx.arc(cx,cy,r1,a2,a1,true);
      oCtx.closePath();
      oCtx.fillStyle='rgba('+r+','+g+','+b+','+alpha+')';
      oCtx.fill();
    }
  }
  // 범례
  var ly=18,lx=FS-8;
  [['🔴 집중',245,101,101],['🟡 보통',246,194,62],['🔵 분산',75,140,245]].forEach(function(item){
    oCtx.fillStyle='rgba('+item[1]+','+item[2]+','+item[3]+',.85)';
    oCtx.font='bold 10px Noto Sans KR,sans-serif';
    oCtx.textAlign='right';
    oCtx.fillText(item[0],lx,ly);
    ly+=14;
  });
}

// ─── DRAG REORDER ───
var _dragId=null;
function dragStart(e,id){_dragId=id;e.dataTransfer.effectAllowed='move';e.currentTarget.style.opacity='0.5';}
function dragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';e.currentTarget.classList.add('drag-over');}
function dropPlayer(e,targetId){
  e.preventDefault();
  document.querySelectorAll('.player-row').forEach(function(r){r.classList.remove('drag-over');r.style.opacity='';});
  if(!_dragId||String(_dragId)===String(targetId)){_dragId=null;return;}
  var lu=getActiveLineup();
  var fi=lu.findIndex(function(p){return String(p.id)===String(_dragId);});
  var ti=lu.findIndex(function(p){return String(p.id)===String(targetId);});
  if(fi<0||ti<0){_dragId=null;return;}
  var moved=lu.splice(fi,1)[0];lu.splice(ti,0,moved);
  _dragId=null;renderLP();
}

// ─── STARTER TOGGLE ───
function toggleStarter(id,e){
  e.stopPropagation();
  var p=getActiveLineup().find(function(p){return String(p.id)===String(id);});
  if(p)p.isStarter=!(p.isStarter!==false);
  renderLP();
}

// ─── PER-BATTER STAT ───
var _NOAB=['볼넷','사구','희타','희비'],_HITS=['안타','내야안타','2루타','3루타','홈런'],_BASE={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
// 구종 컬러맵 (전역 공유)
var _PT_COL={'직구':'#e53935','싱커':'#ff7043','커터':'#795548','체인지업':'#43a047','스플리터':'#2e7d32','포크볼':'#aeea00','스크류볼':'#7cb9a8','커브':'#29b6f6','너클커브':'#7b1fa2','슬로우커브':'#1565c0','슬라이더':'#fdd835','스위퍼':'#ffc400','슬러브':'#4e6b8c','너클볼':'#006994','이퓨스볼':'#555555','팜볼':'#888888'};
var _PT_ABR={'직구':'F','싱커':'SK','커터':'CT','체인지업':'CH','스플리터':'SP','포크볼':'FK','스크류볼':'SC','커브':'C','너클커브':'KC','슬로우커브':'LC','슬라이더':'S','스위퍼':'SW','슬러브':'SL','너클볼':'KN','이퓨스볼':'EP','팜볼':'PB'};
function updBatterStat(){
  var ph=document.getElementById('batter-analysis-placeholder');
  var pc=document.getElementById('batter-analysis-content');
  if(!ph||!pc)return;
  if(!AS.batter){ph.style.display='';pc.style.display='none';return;}
  ph.style.display='none';pc.style.display='';
  var b=AS.batter;
  var bhLbl={'R':'우타','L':'좌타','S':'스위치'};
  document.getElementById('bsName').textContent='#'+b.num+' '+b.name+(b.pos?' ('+b.pos+')':'')+(b.bh?' ['+( bhLbl[b.bh]||b.bh)+']':'');
  var bAbs=AS.abs.filter(function(a){return a.bid===b.id;});
  var oab=bAbs.filter(function(a){return!_NOAB.includes(a.res);}).length;
  var h=bAbs.filter(function(a){return _HITS.includes(a.res);}).length;
  var reach=bAbs.filter(function(a){return _HITS.includes(a.res)||a.res==='볼넷'||a.res==='사구';}).length;
  var tb=bAbs.reduce(function(s,a){return s+(_BASE[a.res]||0);},0);
  var rbi=bAbs.reduce(function(s,a){return s+a.rbi;},0);
  document.getElementById('bsAVG').textContent=oab?(h/oab).toFixed(3).replace('0.','.'):'.---';
  document.getElementById('bsOBP').textContent=bAbs.length?(reach/bAbs.length).toFixed(3).replace('0.','.'):'.---';
  document.getElementById('bsSLG').textContent=oab?(tb/oab).toFixed(3).replace('0.','.'):'.---';
  document.getElementById('bsAB').textContent=oab;
  document.getElementById('bsH').textContent=h;
  document.getElementById('bsRBI').textContent=rbi;
  var fd=bAbs.filter(function(a){return a.deg!=null;}),tot=fd.length||1;
  var pull=fd.filter(function(a){return a.deg<72;}).length;
  var ctr=fd.filter(function(a){return a.deg>=72&&a.deg<=108;}).length;
  var oppo=fd.filter(function(a){return a.deg>108;}).length;
  var pp=Math.round(pull/tot*100),pc2=Math.round(ctr/tot*100),po=Math.round(oppo/tot*100);
  document.getElementById('bdPull').textContent=pp+'%';document.getElementById('bdCtr').textContent=pc2+'%';document.getElementById('bdOppo').textContent=po+'%';
  document.getElementById('bdPullBar').style.height=Math.max(3,pp*.44)+'px';document.getElementById('bdCtrBar').style.height=Math.max(3,pc2*.44)+'px';document.getElementById('bdOppoBar').style.height=Math.max(3,po*.44)+'px';
  var types={'안타':0,'2루타':0,'3루타':0,'홈런':0,'아웃':0,'볼넷/사구':0};
  bAbs.forEach(function(a){
    if(['안타','내야안타'].includes(a.res))types['안타']++;
    else if(a.res==='2루타')types['2루타']++;
    else if(a.res==='3루타')types['3루타']++;
    else if(a.res==='홈런')types['홈런']++;
    else if(a.res.includes('아웃')||a.res==='병살'||a.res==='삼진')types['아웃']++;
    else if(a.res==='볼넷'||a.res==='사구')types['볼넷/사구']++;
  });
  var typeColors={'안타':'#2dd4a0','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565','아웃':'#374151','볼넷/사구':'#a78bfa'};
  var tlist=document.getElementById('bsTypeList');
  tlist.innerHTML=Object.entries(types).filter(function(e){return e[1]>0;}).map(function(e){
    var pct=bAbs.length?Math.round(e[1]/bAbs.length*100):0;
    return'<div style="display:flex;align-items:center;gap:5px;padding:3px 0;border-bottom:1px solid var(--border);font-size:11px"><div style="width:8px;height:8px;border-radius:50%;background:'+typeColors[e[0]]+'"></div><span style="flex:1">'+e[0]+'</span><span style="font-family:var(--mono);font-size:12px;font-weight:700">'+e[1]+'</span><span style="color:var(--text3);font-size:10px">'+pct+'%</span></div>';
  }).join('')||'<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">기록 없음</div>';
  var zoneOrder=['내각 높음','중앙 높음','외각 높음','내각 중간','중앙 중간','외각 중간','내각 낮음','중앙 낮음','외각 낮음'];
  var ballZones=['볼 위','볼 내','볼 외','볼 아래'];
  var zonePitches={};
  zoneOrder.concat(ballZones).forEach(function(z){zonePitches[z]=[];});
  bAbs.forEach(function(ab){
    var ps=ab.pitches&&ab.pitches.length?ab.pitches:(ab.zone&&ab.pt?[{zone:ab.zone,pt:ab.pt}]:[]);
    ps.forEach(function(p,idx){
      if(!p.zone)return;
      if(!zonePitches[p.zone])zonePitches[p.zone]=[];
      zonePitches[p.zone].push({pt:p.pt,result:idx===ps.length-1?ab.res:null});
    });
  });
  function zoneHR(z){var pp=zonePitches[z]||[];var n=pp.length,h=pp.filter(function(p){return _HITS.includes(p.result);}).length;return{n:n,h:h,rate:n?h/n:0};}
  var maxZ=Math.max.apply(null,zoneOrder.concat(ballZones).map(function(z){return(zonePitches[z]||[]).length;}).concat([1]));
  var heatEl=document.getElementById('bsZoneHeat');
  if(heatEl){
    heatEl.style.width='90px';
    heatEl.innerHTML=zoneOrder.map(function(z){
      var zd=zoneHR(z);var bg='transparent',col='var(--text3)';
      if(zd.n>0){if(zd.rate>=0.4){bg='rgba(45,212,160,'+(0.2+zd.n/maxZ*.4)+')';col='#2dd4a0';}else{bg='rgba(245,101,101,'+(0.15+zd.n/maxZ*.4)+')';col='#f56565';}}
      var tips=zd.n?(zonePitches[z].map(function(p){return(p.pt||'?')+(p.result?'('+p.result+')':'');}).join(' ')):'';
      var ptCts={};(zonePitches[z]||[]).forEach(function(p){if(p.pt)ptCts[p.pt]=(ptCts[p.pt]||0)+1;});
      var ptTagsHtml=Object.keys(ptCts).map(function(pt){var c=_PT_COL[pt]||'#7c8898';return'<span class="zh-pt" style="background:'+c+'33;color:'+c+'">'+(_PT_ABR[pt]||pt.slice(0,2))+(ptCts[pt]>1?ptCts[pt]:'')+'</span>';}).join('');
      var _zpBase=(zonePitches[z]||[]).map(function(p){return{pt:p.pt||'',result:p.result||''};});
      var _zpLog=(AS.pitchLog||[]).filter(function(p){return p.batter===b.name&&p.zone===z;}).map(function(p){return{pt:p.pt||'',result:p.result||'',inning:p.inning||''};});
      var zpJ=JSON.stringify(_zpBase.length?_zpBase:_zpLog);
      return'<div class="zh-cell" title="'+z+': '+tips+'" onclick="_showPzCard(event,'+JSON.stringify(z)+','+zpJ+')" style="background:'+bg+';color:'+col+';flex-direction:column;gap:0;padding:1px;cursor:'+(zd.n?'pointer':'default')+'">'+(zd.n?'<span style="font-size:9px;font-weight:800">'+zd.n+'</span><span style="font-size:7px">'+Math.round(zd.rate*100)+'%</span><div class="zh-pt-row">'+ptTagsHtml+'</div>':'')+'</div>';
    }).join('');
  }
  var bzEl=document.getElementById('bsBallZone');
  if(bzEl){
    var bzNames={'볼 위':'위볼','볼 내':'내볼','볼 외':'외볼','볼 아래':'아래볼'};
    bzEl.innerHTML=ballZones.map(function(z){
      var zd=zoneHR(z);var col=zd.n?(zd.rate>=0.4?'#2dd4a0':'#f56565'):'var(--text3)';
      return'<div style="font-size:9px;color:'+col+'">'+bzNames[z]+(zd.n?' '+zd.n:'')+'</div>';
    }).join('');
  }
  var seqEl=document.getElementById('bsPitchSeq');
  var ptColors={'직구':'#4b8cf5','커터':'#7c8898','커브':'#a78bfa','슬라이더':'#f6c23e','체인지업':'#2dd4a0','포크볼':'#fb923c'};
  var ptSym={'직구':'F','싱커':'SK','커터':'CT','커브':'C','슬라이더':'S','체인지업':'CH','포크볼':'FK','스플리터':'SP','스크류볼':'SC','너클커브':'KC','슬로우커브':'LC','스위퍼':'SW','슬러브':'SL','너클볼':'KN','이퓨스볼':'EP','팜볼':'PB'};
  var resColors={'안타':'#2dd4a0','내야안타':'#5eead4','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565','삼진':'#f56565','볼넷':'#a78bfa','사구':'#fb923c','플라이 아웃':'#374151','땅볼 아웃':'#374151','병살':'#374151'};
  if(seqEl){
    if(!bAbs.length){seqEl.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:6px">기록 없음</div>';}
    else{
      seqEl.innerHTML=bAbs.map(function(ab,idx){
        var ps=ab.pitches&&ab.pitches.length?ab.pitches:(ab.zone&&ab.pt?[{zone:ab.zone,pt:ab.pt}]:[]);
        var rCol=resColors[ab.res]||'#7c8898';
        var zShort=function(z){if(!z)return'?';var p=z.split(' ');return p.map(function(w){return w[0];}).join('');};
        var pitchHtml=ps.map(function(p,i){
          var sym=ptSym[p.pt]||'?';var col=_PT_COL[p.pt]||ptColors[p.pt]||'#7c8898';var isLast=i===ps.length-1;
          var _jz=JSON.stringify(p.zone||'?'),_jp=JSON.stringify(p.pt||''),_jr=JSON.stringify(isLast?ab.res:'—'),_ji=JSON.stringify(ab.inn||'');
          return'<span onclick="_showPzCard(event,'+_jz+',[{pt:'+_jp+',result:'+_jr+',inning:'+_ji+'}])" style="cursor:pointer;display:inline-block;padding:1px 4px;border-radius:3px;margin:1px;font-size:9px;font-weight:700;font-family:var(--mono);background:'+col+'22;color:'+col+';border:1px solid '+col+'55'+(isLast?';outline:1px solid '+col:'')+'">'+sym+' '+zShort(p.zone)+(isLast?'★':'')+'</span>';
        }).join('<span style="color:var(--text3);font-size:8px">→</span>');
        return'<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:10px"><div style="margin-bottom:2px"><span style="color:var(--text3);font-size:9px">'+(idx+1)+'타석</span> <span style="color:'+rCol+';font-weight:800">'+ab.res+'</span> <span style="color:var(--text3);font-size:9px">'+ab.inn+'</span></div><div style="line-height:1.6">'+(pitchHtml||'<span style="color:var(--text3)">코스 기록 없음</span>')+'</div></div>';
      }).join('');
    }
  }
  // 구종별 타율 카드
  var ptTypesEl=document.getElementById('bsPitchTypes');
  if(ptTypesEl){
    var allPts={};
    var _ptColMap=_PT_COL;
    bAbs.forEach(function(ab){
      var ps=ab.pitches&&ab.pitches.length?ab.pitches:(ab.zone&&ab.pt?[{pt:ab.pt}]:[]);
      if(!ps.length)return;
      var lp=ps[ps.length-1];if(!lp||!lp.pt)return;
      var pt=lp.pt;if(!allPts[pt])allPts[pt]={n:0,k:0,h:0,hr:0};
      allPts[pt].n++;
      if(ab.res==='삼진')allPts[pt].k++;
      if(_HITS.includes(ab.res))allPts[pt].h++;
      if(ab.res==='홈런')allPts[pt].hr++;
    });
    var entries=Object.entries(allPts).sort(function(a,b){return b[1].n-a[1].n;});
    ptTypesEl.innerHTML=entries.length?entries.map(function(e){
      var pt=e[0],st=e[1],col=_ptColMap[pt]||'#7c8898';
      var avg=st.n?(st.h/st.n).toFixed(3).replace('0.','.'):'.---';
      return'<div style="display:flex;align-items:center;gap:5px;padding:3px 0;border-bottom:1px solid var(--border);font-size:11px">'
        +'<div style="width:7px;height:7px;border-radius:50%;background:'+col+';flex-shrink:0"></div>'
        +'<span style="flex:1;color:var(--text2)">'+pt+'</span>'
        +'<span style="color:var(--text3);font-size:9px">'+st.n+'구</span>'
        +'<span style="font-family:var(--mono);font-weight:700;min-width:32px;text-align:right;color:'+col+'">'+avg+'</span>'
        +(st.k?'<span style="font-size:9px;color:#94a3b8;margin-left:2px">K'+st.k+'</span>':'')
        +(st.hr?'<span style="font-size:9px;color:#f56565;margin-left:2px">HR'+st.hr+'</span>':'')
        +'</div>';
    }).join(''):'<div style="font-size:11px;color:var(--text3);text-align:center;padding:6px">구종 기록 없음</div>';
  }
  renderAIInsights(bAbs);
  // 저장된 투구 위치 캔버스
  var bsPitchCvs=document.getElementById('bsPitchCanvas');
  if(bsPitchCvs&&typeof _drawZoneCanvas==='function'){
    var allDots=[];
    bAbs.forEach(function(ab){
      if(ab.pitches)ab.pitches.forEach(function(p,pi){
        if(p.x!=null&&p.y!=null)allDots.push({
          cx:p.x,cy:p.y,result:p.pt||'스트라이크',
          pitchType:p.pt||'',zone:p.zone||'',
          abResult:pi===ab.pitches.length-1?ab.res:'—',
          inn:ab.inn||''
        });
      });
    });
    _drawZoneCanvas(bsPitchCvs,allDots,false);
    // 투구 점 hover/touch 시 카드 팝업
    bsPitchCvs._dots=allDots;
    bsPitchCvs.style.cursor=allDots.length?'crosshair':'default';
    var _bsNear=function(e,touch){
      var dots=bsPitchCvs._dots;if(!dots||!dots.length)return null;
      var rect=bsPitchCvs.getBoundingClientRect();
      var src=touch||e;
      var px=(src.clientX-rect.left)/rect.width,py=(src.clientY-rect.top)/rect.height;
      var nearest=null,minD=0.08;
      dots.forEach(function(d){var dist=Math.sqrt(Math.pow(d.cx-px,2)+Math.pow(d.cy-py,2));if(dist<minD){minD=dist;nearest=d;}});
      return nearest;
    };
    bsPitchCvs.onmousemove=function(e){
      var n=_bsNear(e);
      if(n){this.style.cursor='pointer';_showPzCard(e,n.zone||'?',[{pt:n.pitchType,result:n.abResult,inning:n.inn}]);}
      else{this.style.cursor='crosshair';_hidePzCard();}
    };
    bsPitchCvs.onmouseleave=function(){_hidePzCard();};
    bsPitchCvs.ontouchmove=function(e){
      e.preventDefault();
      var t=e.touches[0],n=_bsNear(null,t);
      if(n)_showPzCard({target:this,clientX:t.clientX,clientY:t.clientY},n.zone||'?',[{pt:n.pitchType,result:n.abResult,inning:n.inn}]);
    };
    bsPitchCvs.ontouchend=function(){_hidePzCard();};
  }
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(AS.pendingQuickRes)_clearFieldTapPrompt();closeHit();closeOverlay('loadOverlay');closeOverlay('editRecOverlay');}
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undoLast();}
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTO-SAVE ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var _autoTimer=null,_autoKey=null,_lastAutoLen=0;
function scheduleAutoSave(){
  clearTimeout(_autoTimer);
  _autoTimer=setTimeout(_doAutoSave,10000);
  var ind=document.getElementById('saveInd');
  if(ind){ind.textContent='저장 대기…';ind.className='save-ind';}
}
function _doAutoSave(){
  if(!AS.abs.length)return;
  var key='sl_auto_'+(AS.curGame||Date.now());
  _autoKey=key;
  var data=JSON.stringify({
    abs:AS.abs,hs:AS.hs,as:AS.as,ts:Date.now(),
    th:document.getElementById('tHome')?document.getElementById('tHome').value:'홈팀',
    ta:document.getElementById('tAway')?document.getElementById('tAway').value:'원정팀',
    home_lineup:AS.home_lineup,away_lineup:AS.away_lineup,
    zoneHistory:AS.zoneHistory,pitchers:AS.pitchers,
    d:new Date().toLocaleDateString('ko-KR'),cond:getGameCond()
  });
  var ind=document.getElementById('saveInd');
  try{
    localStorage.setItem(key,data);
    _lastAutoLen=data.length;
    _pruneOldAutoSaves(key);
    _checkStorageQuota();
    // 자동저장은 로컬만 저장 (클라우드는 수동 저장 시에만 동기화)
    if(ind){ind.textContent='자동저장 ✓';ind.className='save-ind ok';}
    setTimeout(function(){if(ind)ind.textContent='';},2500);
  }catch(e){
    if(ind){ind.textContent='저장 실패!';ind.className='save-ind fail';}
    if(e.name==='QuotaExceededError'){
      _pruneOldAutoSaves(null);
      try{localStorage.setItem(key,data);if(ind){ind.textContent='자동저장 ✓';ind.className='save-ind ok';}}catch(e2){}
    }
  }
}
function _checkStorageQuota(){
  try{
    var total=0;
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      total+=(k.length+(localStorage.getItem(k)||'').length)*2;
    }
    var mb=total/1024/1024;
    if(mb>4){
      var ind=document.getElementById('saveInd');
      if(ind){ind.textContent='⚠️ 저장 용량 '+mb.toFixed(1)+'MB';ind.className='save-ind fail';}
      showToast('⚠️ 저장 공간 '+mb.toFixed(1)+'MB 사용 중 — 오래된 경기를 삭제해 주세요',false,true);
    }
  }catch(e){}
}
function _pruneOldAutoSaves(keepKey){
  var keys=[];
  for(var i=0;i<localStorage.length;i++){
    var k=localStorage.key(i);
    if(k&&k.startsWith('sl_auto_'))keys.push(k);
  }
  keys.sort();
  while(keys.length>3){
    var old=keys.shift();
    if(old!==keepKey)localStorage.removeItem(old);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOBILE FAB / QUICK-RECORD OVERLAY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function openQR(){
  var ov=document.getElementById('qrOv');
  if(!ov)return;
  var nameEl=document.getElementById('qrBname');
  if(nameEl)nameEl.textContent=(AS.batter&&AS.batter.name)||'타자를 선택하세요';
  var statEl=document.getElementById('qrBstat');
  if(statEl&&AS.batter){
    var bAbs=AS.abs.filter(function(a){return a.bid===AS.batter.id;});
    var hits=['안타','내야안타','2루타','3루타','홈런'];
    var h=bAbs.filter(function(a){return hits.includes(a.res);}).length;
    var ab=bAbs.filter(function(a){return !['볼넷','사구','희타','희비'].includes(a.res);}).length;
    statEl.textContent=ab>0?h+'H / .'+Math.round(h/ab*1000).toString().padStart(3,'0'):'—';
  }
  var innSel=document.getElementById('qrInn');
  if(innSel&&innSel.options.length===0){
    for(var i=1;i<=12;i++){var o=document.createElement('option');o.value=i;o.textContent=i+'회';innSel.appendChild(o);}
  }
  if(innSel)innSel.value=AS.inning||1;
  ov.style.display='flex';
  document.body.style.overflowY='hidden';
}
function closeQR(){
  var ov=document.getElementById('qrOv');
  if(ov)ov.style.display='none';
  document.body.style.overflowY='';
}
function qrQuickHit(res){
  if(!AS.batter){showToast('타자를 먼저 선택하세요');return;}
  var rmap={
    '안타':{res:'안타',ft:'GB',deg:45,dir:'center',x:0.55,y:0.6},
    '2루타':{res:'2루타',ft:'LD',deg:30,dir:'right',x:0.7,y:0.45},
    '3루타':{res:'3루타',ft:'FB',deg:-30,dir:'left',x:0.3,y:0.35},
    '홈런':{res:'홈런',ft:'FB',deg:0,dir:'center',x:0.5,y:0.15}
  };
  var defaults=rmap[res]||{res:res,ft:'GB',deg:0,dir:'center',x:0.5,y:0.5};
  var W=500,H=500;
  var ab={
    id:Date.now(),
    bid:AS.batter.id,bname:AS.batter.name,bnum:AS.batter.num,
    team:AS.curTeam,
    res:defaults.res,pt:AS.pt||'직구',zone:AS.zone||5,rbi:AS.rbi||0,
    x:defaults.x*W,y:defaults.y*H,
    deg:defaults.deg,dir:defaults.dir,ft:defaults.ft,
    inn:AS.inning||1,ts:Date.now(),
    count:{b:AS.balls,s:AS.strikes,o:AS.outs},
    pitches:AS.currentPitches.slice()
  };
  AS.abs.push(ab);
  updateAll();
  scheduleAutoSave();
  showToast(res+' 기록됨');
  closeQR();
}
function qrOther(res){
  if(!AS.batter){showToast('타자를 먼저 선택하세요');return;}
  recOther(res);
  closeQR();
}
function qrField(){
  closeQR();
  showToast('필드를 탭해서 타구 위치를 기록하세요');
}

// ── QR 더보기 토글 ──
function toggleQRMore(){
  var sec=document.getElementById('qrSecondary');
  var btn=document.getElementById('qrMoreToggle');
  if(!sec)return;
  var isOpen=sec.style.display==='grid';
  sec.style.display=isOpen?'none':'grid';
  if(btn){
    btn.classList.toggle('open',!isOpen);
    btn.textContent=isOpen?'＋ 2루타 · 홈런 · 병살 더보기':'－ 접기';
  }
}

// ── 경기 컨디션 태그 (사회인야구 특화) ──
var _gameCond={w:'',f:''};
function toggleCond(el,key,val){
  if(_gameCond[key]===val){
    _gameCond[key]='';
    el.classList.remove('on');
  } else {
    // 같은 키의 다른 칩 해제
    var strip=document.getElementById('qrCondStrip');
    if(strip){
      strip.querySelectorAll('.cond-chip').forEach(function(c){
        var oc=c.getAttribute('onclick')||'';
        if(oc.indexOf("'"+key+"'")!==-1) c.classList.remove('on');
      });
    }
    _gameCond[key]=val;
    el.classList.add('on');
  }
}
function getGameCond(){return {weather:_gameCond.w,field:_gameCond.f};}

// ── 공유 QR 모달 ──
var _shareURL='';
function showShareQR(url){
  _shareURL=url;
  var wrap=document.getElementById('shareQRWrap');
  var ov=document.getElementById('shareQROv');
  if(!ov){alert('공유 모달을 찾을 수 없습니다. 페이지를 새로고침 해주세요.');return;}

  // URL 표시
  var urlEl=document.getElementById('shareQRUrl');
  if(urlEl)urlEl.textContent=url;

  // QR 코드 생성
  if(wrap){
    wrap.innerHTML='';
    if(typeof QRCode!=='undefined'){
      try{
        new QRCode(wrap,{text:url,width:180,height:180,colorDark:'#eef0f8',colorLight:'#141c2e',correctLevel:QRCode.CorrectLevel.M});
      }catch(e){
        wrap.innerHTML='<div style="font-size:11px;color:var(--text3);padding:12px;text-align:center">QR 생성 실패<br>아래 링크를 복사해 공유하세요</div>';
      }
    } else {
      wrap.innerHTML='<div style="font-size:11px;color:var(--text3);padding:12px;text-align:center">아래 링크를 복사해 공유하세요</div>';
    }
  }

  // 모달 열기 — classList 방식 + inline style 양쪽 보장
  ov.classList.add('show');
  ov.style.display='flex';
}
function closeShareQR(){
  var ov=document.getElementById('shareQROv');
  if(!ov)return;
  ov.classList.remove('show');
  ov.style.display='none';
}
function copyShareURL(){
  if(!_shareURL)return;
  var doCopy=function(){
    if(navigator.clipboard&&window.isSecureContext){
      navigator.clipboard.writeText(_shareURL)
        .then(function(){showToast('링크 복사됨! 카카오톡·단톡에 붙여넣기 하세요',false);})
        .catch(function(){_fallbackCopy(_shareURL);});
    }else{
      _fallbackCopy(_shareURL);
    }
  };
  doCopy();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PNG EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function exportSprayPNG(){
  var fld=document.getElementById('fldCanvas');
  var hit=document.getElementById('hitCanvas');
  if(!fld||!hit){showToast('캔버스를 찾을 수 없습니다');return;}
  var out=document.createElement('canvas');
  out.width=fld.width;out.height=fld.height;
  var ctx=out.getContext('2d');
  ctx.drawImage(fld,0,0);
  ctx.drawImage(hit,0,0);
  var dpr=window.devicePixelRatio||1;
  ctx.save();
  ctx.font=(14*dpr)+'px sans-serif';
  ctx.fillStyle='rgba(255,255,255,0.7)';
  ctx.textAlign='right';
  ctx.fillText('Baseball Spray Chart',out.width-8*dpr,out.height-8*dpr);
  ctx.restore();
  _downloadCanvas(out,'spray_chart_'+Date.now()+'.png');
}
function exportShareCard(){
  var W=800,H=450;
  var out=document.createElement('canvas');
  out.width=W;out.height=H;
  var ctx=out.getContext('2d');
  ctx.fillStyle='#1a1f2e';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#e8eaf6';
  ctx.font='bold 22px sans-serif';
  ctx.fillText('경기 요약',24,44);
  ctx.font='bold 36px sans-serif';
  ctx.fillStyle='#7c9cfc';
  ctx.fillText(AS.hs+' : '+AS.as,24,90);
  var homeAbs=AS.abs.filter(function(a){return a.team==='home';});
  var awayAbs=AS.abs.filter(function(a){return a.team==='away';});
  function calcLine(abArr){
    var hits=['안타','내야안타','2루타','3루타','홈런'];
    var nobb=['볼넷','사구','희생번트','희생플라이'];
    var h=abArr.filter(function(a){return hits.includes(a.res);}).length;
    var ab=abArr.filter(function(a){return !nobb.includes(a.res);}).length;
    var bb=abArr.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
    var avg=ab>0?h/ab:0;
    return {h:h,ab:ab,bb:bb,avg:avg};
  }
  var hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
  function calcFull(abArr){
    var h=abArr.filter(function(a){return hits.includes(a.res);}).length;
    var ab=abArr.filter(function(a){return !noab.includes(a.res);}).length;
    var bb=abArr.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
    var tb=abArr.reduce(function(s,a){var bm={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};return s+(bm[a.res]||0);},0);
    var pa=abArr.length;
    var obp=pa?(h+bb)/pa:0, slg=ab?tb/ab:0;
    return {h:h,ab:ab,avg:ab?h/ab:0,ops:obp+slg};
  }
  var hs3=calcFull(homeAbs), as3=calcFull(awayAbs);
  var fmt=function(v){return '.'+Math.round(v*1000).toString().padStart(3,'0');};
  ctx.font='bold 15px sans-serif'; ctx.fillStyle='#e8eaf6'; ctx.textAlign='left';
  ctx.fillText('홈  AVG '+fmt(hs3.avg)+'  OPS '+fmt(hs3.ops)+'  '+hs3.h+'H/'+hs3.ab+'AB', 24, 130);
  ctx.fillText('원정 AVG '+fmt(as3.avg)+'  OPS '+fmt(as3.ops)+'  '+as3.h+'H/'+as3.ab+'AB', 24, 155);
  // direction
  var allAbs=AS.abs, fd=allAbs.filter(function(a){return a.deg!=null;}), tot=fd.length||1;
  var pullP=Math.round(fd.filter(function(a){return a.deg<72;}).length/tot*100);
  var ctrP=Math.round(fd.filter(function(a){return a.deg>=72&&a.deg<=108;}).length/tot*100);
  var oppoP=100-pullP-ctrP;
  ctx.font='13px sans-serif'; ctx.fillStyle='#8892a4';
  ctx.fillText('방향: 당겨 '+pullP+'%  중앙 '+ctrP+'%  밀어 '+oppoP+'%', 24, 178);
  var fld=document.getElementById('fldCanvas');
  var hit=document.getElementById('hitCanvas');
  if(fld&&hit){
    var side=Math.min(H-40,260);
    ctx.save();
    ctx.beginPath();
    ctx.arc(W-side/2-20,H/2,side/2,0,Math.PI*2);
    ctx.clip();
    ctx.drawImage(fld,W-side-20,20,side,side);
    ctx.drawImage(hit,W-side-20,20,side,side);
    ctx.restore();
  }
  ctx.font='12px sans-serif';
  ctx.fillStyle='rgba(255,255,255,0.4)';
  ctx.textAlign='right';
  ctx.fillText('Baseball Spray Chart',W-12,H-12);
  _downloadCanvas(out,'game_summary_'+Date.now()+'.png');
}
function _downloadCanvas(canvas,name){
  canvas.toBlob(function(blob){
    if(!blob)return;
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[new File([blob],name,{type:'image/png'})]})){
      navigator.share({files:[new File([blob],name,{type:'image/png'})],title:'Baseball Spray Chart'}).catch(function(){});
    }else{
      var a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=name;
      a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
    }
  },'image/png');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PERFORMANCE: RAF-DEDUPED RENDER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var _rafPending=false;
function safeRenderOpt(){
  if(_rafPending)return;
  _rafPending=true;
  requestAnimationFrame(function(){
    _rafPending=false;
    renderHits();
  });
}

// Tab swipe handled via CSS scroll-snap on .tab-body (see mobile CSS)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KEYBOARD SHORTCUTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.addEventListener('keydown',function(e){
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)return;
  var k=e.key;
  if(k==='q'||k==='Q'){
    var ov=document.getElementById('qrOv');
    if(ov&&ov.style.display==='flex')closeQR();else openQR();
    return;
  }
  var tabMap={'1':'rec','2':'batter','3':'stat','4':'chart'};
  if(tabMap[k]){
    var btn=document.getElementById('tab-'+tabMap[k]);
    if(btn)btn.click();
  }
});

// ─── 심화지표/구종/교차분석 팀 필터 ───
function setAdvFilter(team,el){
  AS.advFilter=team;
  document.querySelectorAll('#advStatFilter .sf-btn').forEach(function(b){b.classList.remove('on');});
  el.classList.add('on');
  var fabs=team?AS.abs.filter(function(a){return a.team===team;}):AS.abs;
  renderExtStats(fabs);renderPitchTypeTable(fabs);renderZonePitchCross(fabs);
}

// ─── 타석 기록 수정 ───
var _editRbi=0;
function openEditRec(id){
  var ab=AS.abs.find(function(a){return a.id===id;});
  if(!ab)return;
  document.getElementById('editRecId').value=id;
  document.getElementById('editInn').value=ab.inn||'1회초';
  document.getElementById('editRes').value=ab.res||'안타';
  document.getElementById('editPt').value=ab.pt||'';
  document.getElementById('editZone').value=ab.zone||'';
  document.getElementById('editDir').value=ab.dir||'';
  _editRbi=ab.rbi||0;
  document.getElementById('editRbiVal').textContent=_editRbi;
  openOverlay('editRecOverlay');
}
function chEditRbi(d){_editRbi=Math.max(0,_editRbi+d);document.getElementById('editRbiVal').textContent=_editRbi;}
function saveEditRec(){
  var id=parseInt(document.getElementById('editRecId').value);
  var ab=AS.abs.find(function(a){return a.id===id;});
  if(!ab)return;
  ab.inn=document.getElementById('editInn').value;
  ab.res=document.getElementById('editRes').value;
  ab.pt=document.getElementById('editPt').value||null;
  ab.zone=document.getElementById('editZone').value||null;
  const dirVal=document.getElementById('editDir').value;
  const dirDeg={'LF':36,'LC':66,'CF':90,'RC':114,'RF':150};
  ab.dir=dirVal||null;
  ab.deg=dirVal?dirDeg[dirVal]||null:null;
  ab.rbi=_editRbi;
  closeOverlay('editRecOverlay');
  updateAll();
  // 수정 내용을 localStorage에 즉시 영구 반영
  _saveEditImmediate();
}

function _saveEditImmediate(){
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  if(!saves.length){
    // 저장된 게임이 없으면 새 저장 생성
    saveGame();
    return;
  }
  // 가장 최근 저장 항목을 현재 AS 상태로 덮어씀
  var latest=saves[saves.length-1];
  var existing=JSON.parse(localStorage.getItem(latest.key)||'null');
  if(!existing){saveGame();return;}
  existing.abs=AS.abs;
  existing.hs=AS.hs;existing.as=AS.as;
  existing.home_lineup=AS.home_lineup;existing.away_lineup=AS.away_lineup;
  existing.zoneHistory=AS.zoneHistory;
  existing.pitchers=AS.pitchers||[];
  existing.ts=Date.now();
  localStorage.setItem(latest.key,JSON.stringify(existing));
  latest.ts=existing.ts;
  localStorage.setItem('sl_saves',JSON.stringify(saves));
  if(window.cloudSave)cloudSave(latest.key,existing,latest.label,existing.ts);
  triggerSavePulse();
  showToast('타석 기록 수정 완료 — 저장됨 ✓',false);
}

// ───── [백업 서브루틴] URL 다이렉트 스트림 복구 시스템 ─────
(function checkImportUrl() {
  var urlParams = new URLSearchParams(window.location.search);
  var importData = urlParams.get('import');
  if (importData) {
    try {
      var decodedJson = decodeURIComponent(atob(importData));
      var obj = JSON.parse(decodedJson);
      if (obj.saves && obj.data) {
        var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
        var existingKeys = new Set(saves.map(function(s) { return s.key; }));
        var targetKey = obj.saves[0].key;
        if (!existingKeys.has(targetKey)) {
          saves.push(obj.saves[0]);
          localStorage.setItem('sl_saves', JSON.stringify(saves));
          if (obj.data[targetKey]) localStorage.setItem(targetKey, JSON.stringify(obj.data[targetKey]));
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(function() {
          if(typeof initApp === 'function') initApp();
          restoreGame(targetKey);
        }, 400);
      }
    } catch (e) {}
  }
})();

// ─────────────────────────────────────────────────────────
// 타구 상세 카드
// ─────────────────────────────────────────────────────────
const RC_COLOR={'안타':'#2dd4a0','내야안타':'#5eead4','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565','볼넷':'#a78bfa','사구':'#f97316','삼진':'#6b7280','플라이 아웃':'#4b5563','땅볼 아웃':'#374151','희타':'#94a3b8','희비':'#94a3b8','병살':'#991b1b'};
const DIR_KO={'LF':'당겨치기','LC':'좌중간','CF':'센터','RC':'우중간','RF':'밀어치기'};

function showHitDetail(ab, clientX, clientY) {
  const el=document.getElementById('hitDetailCard'); if(!el)return;
  const col=RC_COLOR[ab.res]||'#94a3b8';
  const teamLbl=ab.team==='home'
    ?(document.getElementById('tHome')||{value:'홈'}).value
    :(document.getElementById('tAway')||{value:'원정'}).value;
  let rows='';
  if(ab.inn) rows+=`<div class="hdc-row">📍 <span>${ab.inn} · ${teamLbl}</span></div>`;
  if(ab.dir) rows+=`<div class="hdc-row">↗ <span>${DIR_KO[ab.dir]||ab.dir}${ab.ft?' · '+ab.ft+'ft':''}</span></div>`;
  // 카운트 (볼·스트라이크·아웃)
  if(ab.count!=null){
    const c=ab.count;
    rows+=`<div class="hdc-row">🔢 <span>${c.o}아웃 ${c.b}볼 ${c.s}스트라이크</span></div>`;
  }
  if(ab.rbi>0) rows+=`<div class="hdc-row">🏅 <span style="color:#f6c23e">${ab.rbi}타점</span></div>`;
  if(ab.pt||ab.zone!=null) rows+=`<div class="hdc-row">🎯 <span>${[ab.pt,ab.zone!=null?'존 '+ab.zone:''].filter(Boolean).join(' · ')}</span></div>`;
  if(ab.ts) rows+=`<div class="hdc-row">🕐 <span>${ab.ts}</span></div>`;
  el.innerHTML=`
    <button class="hdc-close" onclick="closeHitDetail()">✕</button>
    <div class="hdc-res" style="color:${col}">${ab.res}</div>
    <div class="hdc-player">#${ab.bnum||''} ${ab.bname}</div>
    ${rows}
  `;
  el.style.display='block';
  const W=Math.max(el.offsetWidth,170), H=Math.max(el.offsetHeight,130);
  let left=clientX+14, top=clientY-20;
  if(left+W>window.innerWidth-8) left=clientX-W-14;
  if(top+H>window.innerHeight-8) top=window.innerHeight-H-8;
  if(top<8) top=8; if(left<8) left=8;
  el.style.left=left+'px'; el.style.top=top+'px';
}

function closeHitDetail(){
  const el=document.getElementById('hitDetailCard'); if(el)el.style.display='none';
}

let _btTipTimer=null;
function showBtnTip(btn,title,desc){
  clearTimeout(_btTipTimer);
  const el=document.getElementById('btnTooltip'); if(!el)return;
  el.innerHTML=`<div class="btt-title">${title}</div><div class="btt-desc">${desc}</div>`;
  el.style.display='block';
  const r=btn.getBoundingClientRect();
  const W=Math.max(el.offsetWidth,180);
  let left=r.left, top=r.bottom+6;
  if(left+W>window.innerWidth-8) left=window.innerWidth-W-8;
  if(left<8) left=8;
  el.style.left=left+'px'; el.style.top=top+'px';
}
function hideBtnTip(){
  const el=document.getElementById('btnTooltip'); if(el)el.style.display='none';
}
function hideBtnTipDelay(){
  _btTipTimer=setTimeout(hideBtnTip,1200);
}

// ─────────────────────────────────────────────────────────
// 저장 경기 이름 바꾸기
// ─────────────────────────────────────────────────────────
function renameGame(key) {
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  var s=saves.find(function(s){return s.key===key;}); if(!s)return;
  var newName=prompt('경기 이름 변경:', s.label);
  if(newName===null||!newName.trim())return;
  s.label=newName.trim();
  localStorage.setItem('sl_saves',JSON.stringify(saves));
  // 클라우드 label 업데이트
  if(window.cloudSave){
    var gd=JSON.parse(localStorage.getItem(key)||'null');
    if(gd)cloudSave(key,gd,s.label,s.ts);
  }
  openLoad();
  showToast('이름이 변경되었습니다',false);
}

// ─────────────────────────────────────────────────────────
// 전체 경기 합치기 엑셀 내보내기
// ─────────────────────────────────────────────────────────
function exportAllGamesToExcel() {
  if (typeof XLSX === 'undefined') { showToast('Excel 라이브러리 로딩 중...', false); return; }
  var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
  if (!saves.length) { showToast('저장된 경기가 없습니다', false); return; }
  var allGames = saves.map(function(s){ return JSON.parse(localStorage.getItem(s.key)); }).filter(Boolean);

  var NOAB=['볼넷','사구','희타','희비'], HITS=['안타','내야안타','2루타','3루타','홈런'];
  var BASE={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
  var DIRLBL={'LF':'당겨치기','LC':'좌중간','CF':'센터','RC':'우중간','RF':'밀어치기'};
  function fmt(v){if(v===null||v===undefined)return'-';return v.toFixed(3).replace(/^0\./,'.');}
  function tavg(list){var oab=list.filter(function(a){return!NOAB.includes(a.res);}).length,h=list.filter(function(a){return HITS.includes(a.res);}).length;return oab?fmt(h/oab):'-';}

  // === Sheet 1: 경기 목록 ===
  var gameRows=[['#','날짜','홈팀','홈점수','원정팀','원정점수','총타석','홈타율','원정타율']];
  allGames.forEach(function(d,i){
    var abs=d.abs||[];
    gameRows.push([i+1,d.d||'',d.th||'홈팀',d.hs||0,d.ta||'원정팀',d.as||0,abs.length,
      tavg(abs.filter(function(a){return a.team==='home';})),
      tavg(abs.filter(function(a){return a.team==='away';}))]);
  });

  // === Sheet 2: 통합 선수별 통계 ===
  var pmap={};
  allGames.forEach(function(d){
    var allLP=(d.home_lineup||d.lineup||[]).map(function(p){return{p:p,t:'home'};})
      .concat((d.away_lineup||[]).map(function(p){return{p:p,t:'away'};}));
    var normAbs=(d.abs||[]).map(function(a){return a.team?a:Object.assign({},a,{team:'home'});});
    allLP.forEach(function(item){
      var pa=normAbs.filter(function(a){return a.bid===item.p.id;});
      if(!pa.length)return;
      var key=(item.p.name||'')+'|'+(item.p.num||'');
      if(!pmap[key])pmap[key]={name:item.p.name||'',num:item.p.num||'',games:0,pa:0,oab:0,h:0,dbl:0,tpl:0,hr:0,bb:0,hbp:0,sac:0,k:0,rbi:0,tb:0,reach:0,fdN:0,pull:0,ctr:0,oppo:0};
      var m=pmap[key]; m.games++;
      m.pa+=pa.length;
      m.oab+=pa.filter(function(a){return!NOAB.includes(a.res);}).length;
      m.h+=pa.filter(function(a){return HITS.includes(a.res);}).length;
      m.dbl+=pa.filter(function(a){return a.res==='2루타';}).length;
      m.tpl+=pa.filter(function(a){return a.res==='3루타';}).length;
      m.hr+=pa.filter(function(a){return a.res==='홈런';}).length;
      m.bb+=pa.filter(function(a){return a.res==='볼넷';}).length;
      m.hbp+=pa.filter(function(a){return a.res==='사구';}).length;
      m.sac+=pa.filter(function(a){return a.res==='희타'||a.res==='희비';}).length;
      m.k+=pa.filter(function(a){return a.res==='삼진';}).length;
      m.rbi+=pa.reduce(function(s,a){return s+a.rbi;},0);
      m.tb+=pa.reduce(function(s,a){return s+(BASE[a.res]||0);},0);
      m.reach+=pa.filter(function(a){return HITS.includes(a.res)||a.res==='볼넷'||a.res==='사구';}).length;
      var fd=pa.filter(function(a){return a.deg!=null;});
      m.fdN+=fd.length; m.pull+=fd.filter(function(a){return a.deg<72;}).length;
      m.ctr+=fd.filter(function(a){return a.deg>=72&&a.deg<=108;}).length;
      m.oppo+=fd.filter(function(a){return a.deg>108;}).length;
    });
  });
  var aggRows=[['선수','번호','경기수','타석','타수','안타','2루타','3루타','홈런','볼넷','사구','희생','삼진','타점','타율','출루율','장타율','당겨치기%','센터%','밀어치기%']];
  Object.keys(pmap).sort(function(a,b){return pmap[b].pa-pmap[a].pa;}).forEach(function(k){
    var m=pmap[k],t=m.fdN||1;
    aggRows.push([m.name,m.num,m.games,m.pa,m.oab,m.h,m.dbl,m.tpl,m.hr,m.bb,m.hbp,m.sac,m.k,m.rbi,
      fmt(m.oab?m.h/m.oab:null),fmt(m.pa?m.reach/m.pa:null),fmt(m.oab?m.tb/m.oab:null),
      Math.round(m.pull/t*100)+'%',Math.round(m.ctr/t*100)+'%',Math.round(m.oppo/t*100)+'%']);
  });

  // === Sheet 3: 전체 타석 기록 ===
  var allAbRows=[['경기날짜','홈팀','원정팀','이닝','팀','선수','번호','결과','방향','타점','거리(ft)','구종','존','시간']];
  allGames.forEach(function(d){
    var th=d.th||'홈팀',ta=d.ta||'원정팀';
    (d.abs||[]).forEach(function(a){
      var team=a.team||'home';
      allAbRows.push([d.d||'',th,ta,a.inn||'',team==='home'?th:ta,a.bname||'',a.bnum||'',a.res||'',
        a.dir?(DIRLBL[a.dir]||a.dir):'',a.rbi||0,a.ft||'',a.pt||'',a.zone||'',a.ts||'']);
    });
  });

  // === Sheet 4: 투수 분석 (전체 경기) ===
  var allPitcherRows=[['경기','투수명','포지션','총투구수','직구%','슬라이더%','커브%','체인지업%','포크볼%','기타%','볼%','스트라이크%','피안타','탈삼진']];
  allGames.forEach(function(d){
    (d.pitchers||[]).forEach(function(p){
      var pitches=p.pitches||[];
      var total=pitches.length||1;
      var ptCount={};
      pitches.forEach(function(px){ptCount[px.pt]=(ptCount[px.pt]||0)+1;});
      var ptTotal=Object.values(ptCount).reduce(function(a,b){return a+b;},0);
      var ball=pitches.filter(function(px){return px.result==='볼';}).length;
      var strike=pitches.filter(function(px){return['스트라이크','파울','헛스윙'].includes(px.result);}).length;
      var hit=pitches.filter(function(px){return['안타','2루타','3루타','홈런','내야안타'].includes(px.result);}).length;
      var k=pitches.filter(function(px){return px.result==='삼진';}).length;
      allPitcherRows.push([
        d.d||'',p.name,p.role||'',total,
        +((ptCount['직구']||0)/total*100).toFixed(1),
        +((ptCount['슬라이더']||0)/total*100).toFixed(1),
        +((ptCount['커브']||0)/total*100).toFixed(1),
        +((ptCount['체인지업']||0)/total*100).toFixed(1),
        +((ptCount['포크볼']||0)/total*100).toFixed(1),
        +((total-ptTotal)/total*100).toFixed(1),
        +(ball/total*100).toFixed(1),
        +(strike/total*100).toFixed(1),
        hit,k
      ]);
    });
  });

  var wb=XLSX.utils.book_new();
  var ws1=XLSX.utils.aoa_to_sheet(gameRows); ws1['!cols']=[{wch:4},{wch:12},{wch:10},{wch:6},{wch:10},{wch:6},{wch:6},{wch:8},{wch:8}];
  var ws2=XLSX.utils.aoa_to_sheet(aggRows); ws2['!cols']=[{wch:10},{wch:5},{wch:7},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:7},{wch:7},{wch:7},{wch:9},{wch:7},{wch:9}];
  var ws3=XLSX.utils.aoa_to_sheet(allAbRows); ws3['!cols']=[{wch:10},{wch:8},{wch:8},{wch:8},{wch:8},{wch:10},{wch:5},{wch:10},{wch:8},{wch:5},{wch:7},{wch:8},{wch:4},{wch:7}];
  var ws4=XLSX.utils.aoa_to_sheet(allPitcherRows); ws4['!cols']=[{wch:10},{wch:10},{wch:8},{wch:8},{wch:7},{wch:8},{wch:6},{wch:8},{wch:7},{wch:6},{wch:6},{wch:8},{wch:6},{wch:6}];
  XLSX.utils.book_append_sheet(wb, ws1, '경기목록');
  XLSX.utils.book_append_sheet(wb, ws2, '통합선수별통계');
  XLSX.utils.book_append_sheet(wb, ws3, '전체타석기록');
  XLSX.utils.book_append_sheet(wb, ws4, '투수분석');

  var d=new Date(),ds=d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2);
  XLSX.writeFile(wb, 'SprayLab_전체경기_'+ds+'.xlsx');
  showToast(allGames.length+'개 경기 엑셀 저장 완료', false);
}

// ─────────────────────────────────────────────────────────
// 전체 리포트 내보내기 (시트4개: 프로필·비교·스카우팅·투수)
// ─────────────────────────────────────────────────────────
function exportFullReport() {
  if (typeof XLSX === 'undefined') { showToast('Excel 라이브러리 로딩 중...', false); return; }
  var saves = JSON.parse(localStorage.getItem('sl_saves') || '[]');
  var allGames = saves.map(function(s){ return JSON.parse(localStorage.getItem(s.key)); }).filter(Boolean);
  // 현재 경기도 포함
  if(AS.abs && AS.abs.length) {
    allGames.push({th:document.getElementById('tHome').value||'홈팀',ta:document.getElementById('tAway').value||'원정팀',
      hs:AS.hs,as:AS.as,abs:AS.abs,home_lineup:AS.home_lineup,away_lineup:AS.away_lineup,
      pitchers:AS.pitchers||[],d:'현재경기',ts:Date.now()});
  }

  var NOAB=['볼넷','사구','희타','희비'],HITS=['안타','내야안타','2루타','3루타','홈런'];
  var BASE={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
  var OUTS=['플라이 아웃','땅볼 아웃','삼진','병살'];
  var ZONE_LABELS=['높은 안쪽','높은 중앙','높은 바깥','중간 안쪽','중간 중앙','중간 바깥','낮은 안쪽','낮은 중앙','낮은 바깥'];
  var PT_LABELS=['직구','슬라이더','커브','체인지업','싱커','커터','스플리터','기타'];
  function f3(v){if(v==null||isNaN(v))return '-';return v.toFixed(3).replace(/^0\./,'.');}
  function fpct(v){if(v==null||isNaN(v))return '-';return Math.round(v*100)+'%';}

  // ── 선수별 통산 집계 ──
  var pmap={};
  allGames.forEach(function(d){
    var allLP=(d.home_lineup||d.lineup||[]).map(function(p){return p;})
      .concat(d.away_lineup||[]);
    var normAbs=(d.abs||[]).map(function(a){return a.team?a:Object.assign({},a,{team:'home'});});
    allLP.forEach(function(p){
      if(!p||!p.name)return;
      var key=p.name+'||'+String(p.num??'');
      if(!pmap[key])pmap[key]={name:p.name,num:p.num,games:0,pa:0,ab:0,h:0,dbl:0,tpl:0,hr:0,bb:0,hbp:0,sf:0,k:0,rbi:0,tb:0,reach:0,
        fdN:0,pull:0,ctr:0,oppo:0,
        zH:Array(9).fill(0),zO:Array(9).fill(0),zT:Array(9).fill(0),
        ahead:0,aheadH:0,aheadAB:0,behind:0,behindH:0,behindAB:0,even:0,evenH:0,evenAB:0,
        fly:0,ground:0};
      var m=pmap[key];
      var pa=normAbs.filter(function(a){return a.bname===p.name;});
      if(!pa.length)return;
      m.games++;
      m.pa+=pa.length;
      m.ab+=pa.filter(function(a){return!NOAB.includes(a.res);}).length;
      m.h+=pa.filter(function(a){return HITS.includes(a.res);}).length;
      m.dbl+=pa.filter(function(a){return a.res==='2루타';}).length;
      m.tpl+=pa.filter(function(a){return a.res==='3루타';}).length;
      m.hr+=pa.filter(function(a){return a.res==='홈런';}).length;
      m.bb+=pa.filter(function(a){return a.res==='볼넷';}).length;
      m.hbp+=pa.filter(function(a){return a.res==='사구';}).length;
      m.sf+=pa.filter(function(a){return a.res==='희비';}).length;
      m.k+=pa.filter(function(a){return a.res==='삼진';}).length;
      m.rbi+=pa.reduce(function(s,a){return s+(a.rbi||0);},0);
      m.tb+=pa.reduce(function(s,a){return s+(BASE[a.res]||0);},0);
      m.reach+=pa.filter(function(a){return HITS.includes(a.res)||a.res==='볼넷'||a.res==='사구';}).length;
      var fd=pa.filter(function(a){return a.deg!=null;});
      m.fdN+=fd.length;
      m.pull+=fd.filter(function(a){return a.deg<72;}).length;
      m.ctr+=fd.filter(function(a){return a.deg>=72&&a.deg<=108;}).length;
      m.oppo+=fd.filter(function(a){return a.deg>108;}).length;
      pa.forEach(function(a){
        if(a.zone>=1&&a.zone<=9){var zi=a.zone-1;m.zT[zi]++;if(HITS.includes(a.res))m.zH[zi]++;if(OUTS.includes(a.res))m.zO[zi]++;}
        if(a.count){var b=a.count.b||0,s2=a.count.s||0;var notNoAB=!NOAB.includes(a.res),isH=HITS.includes(a.res);
          if(s2>b){m.ahead++;if(notNoAB)m.aheadAB++;if(isH)m.aheadH++;}
          else if(b>s2){m.behind++;if(notNoAB)m.behindAB++;if(isH)m.behindH++;}
          else{m.even++;if(notNoAB)m.evenAB++;if(isH)m.evenH++;}}
        if(a.res==='플라이 아웃')m.fly++;
        if(a.res==='땅볼 아웃')m.ground++;
      });
    });
  });

  var players=Object.values(pmap).sort(function(a,b){return b.pa-a.pa;});

  // ── Sheet 1: 선수별 통산 성적 ──
  var hdr1=['이름','번호','경기수','타석','타수','안타','2루타','3루타','홈런','타점','볼넷','삼진','타율','출루율','장타율','OPS','wOBA','BABIP','ISO','K%','BB%','당김%','중앙%','밀어%'];
  // wOBA 가중치 — renderExtStats 및 constants.js WOBA_W 통일
  var wBB=0.69,wHBP=0.72,w1B=0.89,w2B=1.27,w3B=1.62,wHR=2.10;
  var profileRows=[hdr1];
  players.forEach(function(m){
    var t=m.fdN||1,denom=m.ab+m.bb+m.hbp+m.sf,
      avg=m.ab?m.h/m.ab:0,
      // 표준 OBP: (H+BB+HBP)/(AB+BB+HBP+SF)
      obp=(m.ab+m.bb+m.hbp+m.sf)?(m.h+m.bb+m.hbp)/(m.ab+m.bb+m.hbp+m.sf):0,
      slg=m.ab?m.tb/m.ab:0,ops=obp+slg,
      singles=m.h-m.dbl-m.tpl-m.hr,
      woba=denom?(wBB*m.bb+wHBP*m.hbp+w1B*singles+w2B*m.dbl+w3B*m.tpl+wHR*m.hr)/denom:0,
      babip=(m.ab-m.k-m.hr+m.sf)?(m.h-m.hr)/(m.ab-m.k-m.hr+m.sf):0,
      isoP=slg-avg;
    profileRows.push([m.name,m.num,m.games,m.pa,m.ab,m.h,m.dbl,m.tpl,m.hr,m.rbi,m.bb,m.k,
      f3(avg),f3(obp),f3(slg),f3(ops),f3(woba),f3(babip),f3(isoP),
      fpct(m.pa?m.k/m.pa:0),fpct(m.pa?m.bb/m.pa:0),
      fpct(m.pull/t),fpct(m.ctr/t),fpct(m.oppo/t)]);
  });

  // ── Sheet 2: 선수 비교 (항목 행, 선수 열) ──
  var compareItems=[
    ['항목'].concat(players.map(function(m){return '#'+m.num+' '+m.name;}))
  ];
  var metrics=[
    {k:'AVG',fn:function(m){return m.ab?m.h/m.ab:0},f:f3},
    {k:'OBP',fn:function(m){return(m.ab+m.bb+m.hbp+m.sf)?(m.h+m.bb+m.hbp)/(m.ab+m.bb+m.hbp+m.sf):0},f:f3},
    {k:'SLG',fn:function(m){return m.ab?m.tb/m.ab:0},f:f3},
    {k:'OPS',fn:function(m){var ob=(m.ab+m.bb+m.hbp+m.sf)?(m.h+m.bb+m.hbp)/(m.ab+m.bb+m.hbp+m.sf):0,sl=m.ab?m.tb/m.ab:0;return ob+sl;},f:f3},
    {k:'ISO',fn:function(m){var sl=m.ab?m.tb/m.ab:0,av=m.ab?m.h/m.ab:0;return sl-av;},f:f3},
    {k:'K%',fn:function(m){return m.pa?m.k/m.pa:0},f:fpct},
    {k:'BB%',fn:function(m){return m.pa?m.bb/m.pa:0},f:fpct},
    {k:'PULL%',fn:function(m){return m.fdN?m.pull/m.fdN:0},f:fpct},
    {k:'OPPO%',fn:function(m){return m.fdN?m.oppo/m.fdN:0},f:fpct},
    {k:'PA',fn:function(m){return m.pa;},f:String}
  ];
  metrics.forEach(function(mt){
    var vals=players.map(function(m){return mt.fn(m);});
    var maxV=Math.max.apply(null,vals.map(function(v){return isNaN(v)?-Infinity:v;}));
    var row=[mt.k];
    vals.forEach(function(v){row.push(mt.f(v)+((!isNaN(v)&&v===maxV&&players.length>1)?'★':''));});
    compareItems.push(row);
  });

  // ── Sheet 3: 스카우팅 리포트 ──
  var scoutHdr=['이름','PA','삼진율','볼넷율','ISO','GO/AO','당김%','중앙%','밀어%'];
  for(var zi=0;zi<9;zi++)scoutHdr.push('존'+(zi+1)+'AVG');
  scoutHdr.push('유리카운트AVG','불리카운트AVG','이븐카운트AVG','약점존(아웃>70%)','위험존(AVG>.350)','전략요약');
  var scoutRows=[scoutHdr];
  players.forEach(function(m){
    var fly=m.fly,ground=m.ground,goao=fly?(ground/fly):ground;
    var zoneAvgArr=m.zT.map(function(t,i){if(t<1)return null;var zab=t-0/*bb in zone not tracked*/;return m.zH[i]/t;});
    var weakZones=[],dangerZones=[];
    m.zT.forEach(function(t,i){
      if(t>=3){var outR=m.zO[i]/t;if(outR>0.7)weakZones.push(ZONE_LABELS[i]);}
      if(t>=3&&m.zH[i]/t>0.35)dangerZones.push(ZONE_LABELS[i]);
    });
    var strategy=[];
    if(m.pa?m.k/m.pa>0.25:false)strategy.push('삼진율높음→체이스유도');
    if(m.pull/Math.max(m.fdN,1)>0.5)strategy.push('당구많음→바깥쪽공략');
    if(m.behindAB&&m.behindH/m.behindAB<0.15)strategy.push('불리카운트약함→초구스트라이크');
    if(goao>1.5)strategy.push('땅볼타자→낮은존싱커');
    var row=[m.name,m.pa,fpct(m.pa?m.k/m.pa:0),fpct(m.pa?m.bb/m.pa:0),
      f3(m.ab?(m.tb/m.ab-(m.h/m.ab)):0),goao.toFixed(2),
      fpct(m.fdN?m.pull/m.fdN:0),fpct(m.fdN?m.ctr/m.fdN:0),fpct(m.fdN?m.oppo/m.fdN:0)];
    zoneAvgArr.forEach(function(v){row.push(v!==null?f3(v):'-');});
    row.push(m.aheadAB?f3(m.aheadH/m.aheadAB):'-',
      m.behindAB?f3(m.behindH/m.behindAB):'-',
      m.evenAB?f3(m.evenH/m.evenAB):'-',
      weakZones.join(', ')||'-',dangerZones.join(', ')||'-',
      strategy.join(' / ')||'-');
    scoutRows.push(row);
  });

  // ── Sheet 4: 투수 분석 ──
  var pitcherMap={};
  allGames.forEach(function(d){
    (d.pitchers||[]).forEach(function(pt){
      if(!pt||!pt.name)return;
      var key=pt.name+'||'+String(pt.num??'');
      if(!pitcherMap[key])pitcherMap[key]={name:pt.name,num:pt.num,role:pt.role||'',
        total:0,ball:0,strike:0,hits:0,k:0,
        ptCount:{},zCount:Array(9).fill(0),res:{}};
      var pm=pitcherMap[key];
      (pt.pitches||[]).forEach(function(pitch){
        pm.total++;
        if(pitch.result==='B')pm.ball++;else pm.strike++;
        if(pitch.pt){pm.ptCount[pitch.pt]=(pm.ptCount[pitch.pt]||0)+1;}
        if(pitch.zone>=1&&pitch.zone<=9)pm.zCount[pitch.zone-1]++;
        if(pitch.result&&pitch.result!=='B'){pm.res[pitch.result]=(pm.res[pitch.result]||0)+1;}
      });
    });
  });

  var ptHdr=['투수명','번호','포지션','총투구수','직구%','슬라이더%','커브%','체인지업%','싱커%','커터%','스플리터%'];
  for(var zz=0;zz<9;zz++)ptHdr.push('존'+(zz+1)+'투구');
  ptHdr.push('볼%','스트라이크%','결과분포');
  var pitcherRows=[ptHdr];
  Object.values(pitcherMap).sort(function(a,b){return b.total-a.total;}).forEach(function(pm){
    var t=pm.total||1;
    var row=[pm.name,pm.num,pm.role,pm.total];
    ['직구','슬라이더','커브','체인지업','싱커','커터','스플리터'].forEach(function(pt){
      row.push(pm.ptCount[pt]?fpct(pm.ptCount[pt]/t):'-');
    });
    pm.zCount.forEach(function(c){row.push(c||0);});
    row.push(fpct(pm.ball/t),fpct(pm.strike/t));
    var resDist=Object.keys(pm.res).map(function(r){return r+':'+pm.res[r];}).join(' ');
    row.push(resDist||'-');
    pitcherRows.push(row);
  });

  // ── 시트 생성 & 헤더 볼드 ──
  var wb=XLSX.utils.book_new();
  function mkSheet(rows,name,colWidths){
    var ws=XLSX.utils.aoa_to_sheet(rows);
    if(colWidths)ws['!cols']=colWidths.map(function(w){return{wch:w};});
    // 1행 헤더 볼드
    var hdrLen=rows[0].length;
    for(var c=0;c<hdrLen;c++){
      var addr=XLSX.utils.encode_cell({r:0,c:c});
      if(ws[addr])ws[addr].s={font:{bold:true}};
    }
    XLSX.utils.book_append_sheet(wb,ws,name);
  }
  mkSheet(profileRows,'선수별통산성적',[10,5,5,5,5,5,5,5,5,5,5,5,7,7,7,7,7,7,7,6,6,7,7,7]);
  mkSheet(compareItems,'선수비교',[12].concat(players.map(function(){return 12;})));
  mkSheet(scoutRows,'스카우팅리포트',[10,5,7,7,7,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,20,20,30]);
  mkSheet(pitcherRows,'투수분석',[10,5,8,8,7,7,7,7,7,7,7,7,5,5,5,5,5,5,5,5,5,7,7,20]);

  var ds=(function(){var n=new Date();return n.getFullYear()+('0'+(n.getMonth()+1)).slice(-2)+('0'+n.getDate()).slice(-2);})();
  XLSX.writeFile(wb,'SprayLab_통계_'+ds+'.xlsx');
  showToast('전체 리포트 저장 완료 (선수'+players.length+'명·투수'+Object.keys(pitcherMap).length+'명)',false);
}

// ─────────────────────────────────────────────────────────
// 엑셀 파일 → 새 경기로 추가 (Import as saved game)
// ─────────────────────────────────────────────────────────
function downloadGameTemplate() {
  if (typeof XLSX === 'undefined') { showToast('로딩 중...', false); return; }
  var wb=XLSX.utils.book_new();
  var sumData=[
    ['항목','홈팀(홈)','원정팀(원정)'],
    ['점수',0,0]
  ];
  var ws1=XLSX.utils.aoa_to_sheet(sumData); ws1['!cols']=[{wch:14},{wch:14},{wch:14}];
  var abData=[
    ['이닝','팀','선수','번호','결과','방향','타점','거리(ft)','구종','존','시간'],
    ['1회초','홈','김정철','7','안타','LF',1,280,'직구',5,'14:30'],
    ['1회초','홈','이민준','12','삼진','',0,'','','',''],
    ['1회말','원정','박성현','3','홈런','CF',2,380,'','','']
  ];
  var ws2=XLSX.utils.aoa_to_sheet(abData); ws2['!cols']=[{wch:8},{wch:8},{wch:10},{wch:5},{wch:10},{wch:8},{wch:5},{wch:7},{wch:8},{wch:4},{wch:7}];
  var note=[
    ['※ 작성 안내'],
    ['팀: 홈 또는 원정  (경기요약 시트의 팀명과 일치시키면 팀명 자동 적용)'],
    ['결과: 안타 내야안타 2루타 3루타 홈런 볼넷 사구 삼진 플라이 아웃 땅볼 아웃 희타 희비 병살'],
    ['방향: LF LC CF RC RF  (볼넷·삼진 등은 빈칸)'],
    ['이 시트는 무시됩니다. 경기요약·타석기록 시트만 읽습니다.']
  ];
  var ws3=XLSX.utils.aoa_to_sheet(note); ws3['!cols']=[{wch:70}];
  XLSX.utils.book_append_sheet(wb, ws1, '경기요약');
  XLSX.utils.book_append_sheet(wb, ws2, '타석기록');
  XLSX.utils.book_append_sheet(wb, ws3, '작성안내');
  XLSX.writeFile(wb, 'spraylab_game_template.xlsx');
  showToast('서식 파일 다운로드 완료', false);
}

function importExcelAsGame(input) {
  var file=input.files[0]; if(!file)return;
  if(typeof XLSX==='undefined'){showToast('Excel 라이브러리 로딩 중...', false);input.value='';return;}
  var reader=new FileReader();
  reader.onload=function(e){
    try {
      var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});

      // 1) 경기요약 시트에서 팀명·점수 추출
      var th='홈팀',ta='원정팀',hs=0,gameAs=0,gameDate=new Date().toLocaleDateString('ko-KR');
      var sumSN=wb.SheetNames.find(function(n){return n.replace(/\s/g,'').includes('요약')||n.toLowerCase().includes('summary');});
      if(sumSN){
        var srows=XLSX.utils.sheet_to_json(wb.Sheets[sumSN],{header:1,defval:''});
        // row 0: ['항목','홈팀(홈)','원정팀(원정)']
        if(srows[0]&&srows[0][1]){th=String(srows[0][1]).replace(/\(홈\)/g,'').trim()||'홈팀';}
        if(srows[0]&&srows[0][2]){ta=String(srows[0][2]).replace(/\(원정\)/g,'').trim()||'원정팀';}
        var scRow=srows.find(function(r){return String(r[0]).includes('점수');});
        if(scRow){hs=parseInt(scRow[1])||0; gameAs=parseInt(scRow[2])||0;}
      }

      // 2) 타석기록 시트 찾기
      var abSN=wb.SheetNames.find(function(n){return n.replace(/\s/g,'').includes('타석');});
      if(!abSN){
        // fallback: try 전체타석기록
        abSN=wb.SheetNames.find(function(n){return n.includes('기록');});
      }
      if(!abSN){showToast('"타석기록" 시트를 찾을 수 없습니다', false);input.value='';return;}

      var rows=XLSX.utils.sheet_to_json(wb.Sheets[abSN],{header:1,defval:''});

      // 헤더 행 탐색
      var hIdx=-1;
      for(var i=0;i<Math.min(rows.length,5);i++){
        if(rows[i].some(function(c){return String(c).trim()==='결과';})){hIdx=i;break;}
      }
      if(hIdx===-1){showToast('"결과" 헤더 행을 찾을 수 없습니다', false);input.value='';return;}

      var headers=rows[hIdx].map(function(h){return String(h).trim();});
      function colOf(aliases){
        for(var i=0;i<aliases.length;i++){
          var idx=headers.findIndex(function(h){return h===aliases[i]||h.replace(/\s/g,'')===aliases[i].replace(/\s/g,'');});
          if(idx!==-1)return idx;
        }
        return -1;
      }
      var C={
        inn:colOf(['이닝']),
        team:colOf(['팀']),
        bname:colOf(['선수','선수이름']),
        bnum:colOf(['번호','등번호']),
        res:colOf(['결과']),
        dir:colOf(['방향']),
        rbi:colOf(['타점']),
        ft:colOf(['거리(ft)','거리','ft']),
        pt:colOf(['구종']),
        zone:colOf(['존','zone']),
        ts:colOf(['시간'])
      };
      if(C.bname===-1||C.res===-1){showToast('"선수"·"결과" 컬럼이 필요합니다',false);input.value='';return;}

      var dirDeg={'LF':36,'LC':66,'CF':90,'RC':114,'RF':150,'당겨치기':36,'좌중간':66,'센터':90,'우중간':114,'밀어치기':150};
      var noLocSet={'볼넷':1,'사구':1,'삼진':1};
      var validRes={'안타':1,'내야안타':1,'2루타':1,'3루타':1,'홈런':1,'볼넷':1,'사구':1,'삼진':1,'플라이 아웃':1,'땅볼 아웃':1,'희타':1,'희비':1,'병살':1};
      var validInn={'1회초':1,'1회말':1,'2회초':1,'2회말':1,'3회초':1,'3회말':1,'4회초':1,'4회말':1,'5회초':1,'5회말':1,'6회초':1,'6회말':1,'7회초':1,'7회말':1,'8회초':1,'8회말':1,'9회초':1,'9회말':1,'연장':1};

      var homeLP=[],awayLP=[],absArr=[];
      var homeSet={},awaySet={},added=0,skipped=0;
      var _plrId=Date.now();

      // 팀명 → home/away 매핑 (경기요약의 팀명과 비교)
      function teamNorm(raw){
        var s=raw.trim();
        if(s===th||s==='홈'||s.toLowerCase()==='home'||s==='H')return 'home';
        if(s===ta||s==='원정'||s.toLowerCase()==='away'||s==='A')return 'away';
        // 최초 등장 기준
        return 'home';
      }

      rows.slice(hIdx+1).forEach(function(row){
        if(!row||row.every(function(c){return c===''||c===null||c===undefined;}))return;
        var bname=C.bname>=0?String(row[C.bname]||'').trim():'';
        var res=C.res>=0?String(row[C.res]||'').trim():'';
        if(!bname||!res)return;
        if(!validRes[res]){skipped++;return;}

        var teamRaw=C.team>=0?String(row[C.team]||'').trim():'홈';
        var team=teamNorm(teamRaw);
        var bnum=C.bnum>=0?String(row[C.bnum]||'').trim():'';
        var inn=C.inn>=0?String(row[C.inn]||'').trim():'1회초';
        if(!validInn[inn])inn='1회초';
        var rbi=C.rbi>=0?(parseInt(row[C.rbi])||0):0;
        var ft=C.ft>=0?(parseFloat(row[C.ft])||0):0;
        var dirStr=C.dir>=0?String(row[C.dir]||'').trim():'';
        var pt=C.pt>=0?String(row[C.pt]||'').trim():'';
        var zone=C.zone>=0?(parseInt(row[C.zone])||null):null;
        var ts=C.ts>=0?String(row[C.ts]||'').trim():'';

        // 선수 찾거나 생성
        var lineup=team==='home'?homeLP:awayLP;
        var set=team==='home'?homeSet:awaySet;
        var pkey=bname+'|'+bnum;
        if(!set[pkey]){
          set[pkey]={id:++_plrId,name:bname,num:bnum,pos:'',bh:''};
          lineup.push(set[pkey]);
        }
        var player=set[pkey];

        // 위치 계산
        var deg=null,dir=null,x=null,y=null;
        if(!noLocSet[res]&&dirStr&&dirDeg[dirStr]!==undefined){
          deg=dirDeg[dirStr];
          if(deg<54)dir='LF'; else if(deg<78)dir='LC'; else if(deg<102)dir='CF'; else if(deg<126)dir='RC'; else dir='RF';
          var dp=(ft>50?ft:280)/450;
          var ang=deg*Math.PI/180-Math.PI;
          x=Math.min(0.97,Math.max(0.03,0.5+dp*Math.cos(ang)));
          y=Math.min(0.97,Math.max(0.01,1.0+dp*Math.sin(ang)));
        }

        absArr.push({id:Date.now()+added,bid:player.id,bname:player.name,bnum:player.num,team:team,res:res,pt:pt||null,zone:zone,rbi:rbi,x:x,y:y,deg:deg,dir:dir,ft:ft>0?ft:(deg!==null?280:null),inn:inn,ts:ts,pitches:[]});
        added++;
      });

      input.value='';
      if(!added){showToast('가져올 타석 데이터가 없습니다'+(skipped>0?' (오류 '+skipped+'개)':''),false);return;}

      // 새 경기로 저장
      var key='sl_'+Date.now();
      var nowTs=Date.now();
      var gameData={key,hs,as:gameAs,th,ta,home_lineup:homeLP,away_lineup:awayLP,abs:absArr,zoneHistory:{},d:gameDate,ts:nowTs};
      var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
      var lbl=th+' '+hs+':'+gameAs+' '+ta+' ('+gameDate+')';
      saves.push({key,label:lbl,ts:nowTs});
      localStorage.setItem('sl_saves',JSON.stringify(saves));
      localStorage.setItem(key,JSON.stringify(gameData));
      if(window.cloudSave)cloudSave(key,gameData,lbl,gameData.ts);
      openLoad();
      showToast(added+'개 타석 기록 → 새 경기로 저장됨'+(skipped>0?' (건너뜀 '+skipped+'개)':''),false);
    }catch(err){
      console.error(err);
      showToast('파일 읽기 오류: '+err.message,false);
      input.value='';
    }
  };
  reader.readAsArrayBuffer(file);
}

// ─────────────────────────────────────────────────────────
// 엑셀 내보내기 (통계 Export)
// ─────────────────────────────────────────────────────────
function exportGameToExcel(key) {
  var d = JSON.parse(localStorage.getItem(key));
  if (!d) { showToast('데이터를 찾을 수 없습니다', false); return; }
  _doExportToExcel(d);
}

function exportCurrentGameToExcel() {
  if (!AS.abs.length) { showToast('기록된 타석이 없습니다', false); return; }
  _doExportToExcel({
    th: document.getElementById('tHome').value,
    ta: document.getElementById('tAway').value,
    hs: AS.hs, as: AS.as,
    home_lineup: AS.home_lineup,
    away_lineup: AS.away_lineup,
    abs: AS.abs,
    pitchers: AS.pitchers || [],
    d: new Date().toLocaleDateString('ko-KR')
  });
}

function _doExportToExcel(data) {
  if (typeof XLSX === 'undefined') { showToast('Excel 라이브러리 로딩 중... 잠시 후 다시 시도하세요', false); return; }
  var th = data.th || '홈팀', ta = data.ta || '원정팀';
  var abs = (data.abs||[]).map(function(a){return a.team?a:Object.assign({},a,{team:'home'});});
  var allLP = (data.home_lineup||data.lineup||[]).map(function(p){return{p:p,team:'home'};})
    .concat((data.away_lineup||[]).map(function(p){return{p:p,team:'away'};}));

  var noab=['볼넷','사구','희타','희비'], hits=['안타','내야안타','2루타','3루타','홈런'];
  var base={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
  var dirLabel={'LF':'당겨치기','LC':'좌중간','CF':'센터','RC':'우중간','RF':'밀어치기'};

  function ps(pid) {
    var pa=abs.filter(function(a){return a.bid===pid;});if(!pa.length)return null;
    var oab=pa.filter(function(a){return!noab.includes(a.res);}).length;
    var h=pa.filter(function(a){return hits.includes(a.res);}).length;
    var dbl=pa.filter(function(a){return a.res==='2루타';}).length;
    var tpl=pa.filter(function(a){return a.res==='3루타';}).length;
    var hr=pa.filter(function(a){return a.res==='홈런';}).length;
    var bb=pa.filter(function(a){return a.res==='볼넷';}).length;
    var hbp=pa.filter(function(a){return a.res==='사구';}).length;
    var sac=pa.filter(function(a){return a.res==='희타'||a.res==='희비';}).length;
    var k=pa.filter(function(a){return a.res==='삼진';}).length;
    var rbi=pa.reduce(function(s,a){return s+a.rbi;},0);
    var tb=pa.reduce(function(s,a){return s+(base[a.res]||0);},0);
    var reach=pa.filter(function(a){return hits.includes(a.res)||a.res==='볼넷'||a.res==='사구';}).length;
    var fd=pa.filter(function(a){return a.deg!=null;});
    var tot=fd.length||1;
    var pull=fd.filter(function(a){return a.deg<72;}).length;
    var ctr=fd.filter(function(a){return a.deg>=72&&a.deg<=108;}).length;
    var oppo=fd.filter(function(a){return a.deg>108;}).length;
    return {
      pa:pa.length,oab:oab,h:h,dbl:dbl,tpl:tpl,hr:hr,bb:bb,hbp:hbp,sac:sac,k:k,rbi:rbi,tb:tb,
      avg:oab?h/oab:null, obp:pa.length?reach/pa.length:null, slg:oab?tb/oab:null,
      pull:Math.round(pull/tot*100), ctr:Math.round(ctr/tot*100), oppo:Math.round(oppo/tot*100)
    };
  }

  function fmt(v){if(v===null||v===undefined)return'-';return v.toFixed(3).replace(/^0\./,'.');}

  function teamStat(teamAbs){
    var oab=teamAbs.filter(function(a){return!noab.includes(a.res);}).length;
    var h=teamAbs.filter(function(a){return hits.includes(a.res);}).length;
    var reach=teamAbs.filter(function(a){return hits.includes(a.res)||a.res==='볼넷'||a.res==='사구';}).length;
    var tb=teamAbs.reduce(function(s,a){return s+(base[a.res]||0);},0);
    var rbi=teamAbs.reduce(function(s,a){return s+a.rbi;},0);
    var hr=teamAbs.filter(function(a){return a.res==='홈런';}).length;
    var bb=teamAbs.filter(function(a){return a.res==='볼넷';}).length;
    var k=teamAbs.filter(function(a){return a.res==='삼진';}).length;
    return {pa:teamAbs.length,oab:oab,h:h,rbi:rbi,hr:hr,bb:bb,k:k,avg:oab?h/oab:null,obp:teamAbs.length?reach/teamAbs.length:null,slg:oab?tb/oab:null};
  }

  // === Sheet 1: 경기 요약 ===
  var hst=teamStat(abs.filter(function(a){return a.team==='home';}));
  var ast=teamStat(abs.filter(function(a){return a.team==='away';}));
  var sumRows=[
    ['항목', th+'(홈)', ta+'(원정)'],
    ['점수', data.hs||0, data.as||0],
    ['타석(PA)', hst.pa, ast.pa],
    ['타수(AB)', hst.oab, ast.oab],
    ['안타(H)', hst.h, ast.h],
    ['홈런(HR)', hst.hr, ast.hr],
    ['볼넷(BB)', hst.bb, ast.bb],
    ['삼진(K)', hst.k, ast.k],
    ['타점(RBI)', hst.rbi, ast.rbi],
    ['타율(AVG)', fmt(hst.avg), fmt(ast.avg)],
    ['출루율(OBP)', fmt(hst.obp), fmt(ast.obp)],
    ['장타율(SLG)', fmt(hst.slg), fmt(ast.slg)]
  ];

  // === Sheet 2: 선수별 통계 ===
  var statRows=[['선수','번호','팀','타석','타수','안타','2루타','3루타','홈런','볼넷','사구','희생','삼진','타점','타율','출루율','장타율','당겨치기%','센터%','밀어치기%']];
  allLP.forEach(function(item){
    var st=ps(item.p.id); if(!st) return;
    statRows.push([item.p.name||'',item.p.num||'',item.team==='home'?th:ta,
      st.pa,st.oab,st.h,st.dbl,st.tpl,st.hr,st.bb,st.hbp,st.sac,st.k,st.rbi,
      fmt(st.avg),fmt(st.obp),fmt(st.slg),st.pull+'%',st.ctr+'%',st.oppo+'%']);
  });

  // === Sheet 3: 타석 기록 ===
  var abRows=[['이닝','팀','선수','번호','결과','방향','타점','거리(ft)','구종','존','시간']];
  abs.forEach(function(a){
    abRows.push([a.inn||'',a.team==='home'?th:ta,a.bname||'',a.bnum||'',a.res||'',
      a.dir?(dirLabel[a.dir]||a.dir):'',a.rbi||0,a.ft||'',a.pt||'',a.zone||'',a.ts||'']);
  });

  var wb=XLSX.utils.book_new();
  var ws1=XLSX.utils.aoa_to_sheet(sumRows);
  ws1['!cols']=[{wch:14},{wch:12},{wch:12}];
  var ws2=XLSX.utils.aoa_to_sheet(statRows);
  ws2['!cols']=[{wch:10},{wch:5},{wch:8},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:6},{wch:7},{wch:7},{wch:7},{wch:10},{wch:7},{wch:10}];
  var ws3=XLSX.utils.aoa_to_sheet(abRows);
  ws3['!cols']=[{wch:8},{wch:8},{wch:10},{wch:5},{wch:10},{wch:8},{wch:5},{wch:7},{wch:8},{wch:4},{wch:7}];
  XLSX.utils.book_append_sheet(wb, ws1, '경기요약');
  XLSX.utils.book_append_sheet(wb, ws2, '선수별통계');
  XLSX.utils.book_append_sheet(wb, ws3, '타석기록');

  // === Sheet 4: 투수 분석 ===
  var pitcherRows=[['투수명','포지션','총투구수','직구%','슬라이더%','커브%','체인지업%','포크볼%','기타%','볼%','스트라이크%','피안타','탈삼진']];
  (data.pitchers||[]).forEach(function(p){
    var pitches=p.pitches||[];
    var total=pitches.length||1;
    var ptCount={};
    pitches.forEach(function(px){ptCount[px.pt]=(ptCount[px.pt]||0)+1;});
    var ptTotal=Object.values(ptCount).reduce(function(a,b){return a+b;},0);
    var ball=pitches.filter(function(px){return px.result==='볼';}).length;
    var strike=pitches.filter(function(px){return['스트라이크','파울','헛스윙'].includes(px.result);}).length;
    var hit=pitches.filter(function(px){return['안타','2루타','3루타','홈런','내야안타'].includes(px.result);}).length;
    var k=pitches.filter(function(px){return px.result==='삼진';}).length;
    pitcherRows.push([
      p.name, p.role||'', total,
      +((ptCount['직구']||0)/total*100).toFixed(1),
      +((ptCount['슬라이더']||0)/total*100).toFixed(1),
      +((ptCount['커브']||0)/total*100).toFixed(1),
      +((ptCount['체인지업']||0)/total*100).toFixed(1),
      +((ptCount['포크볼']||0)/total*100).toFixed(1),
      +((total-ptTotal)/total*100).toFixed(1),
      +(ball/total*100).toFixed(1),
      +(strike/total*100).toFixed(1),
      hit, k
    ]);
  });
  var ws4=XLSX.utils.aoa_to_sheet(pitcherRows);
  ws4['!cols']=[{wch:10},{wch:8},{wch:8},{wch:7},{wch:8},{wch:6},{wch:8},{wch:7},{wch:6},{wch:6},{wch:8},{wch:6},{wch:6}];
  XLSX.utils.book_append_sheet(wb, ws4, '투수분석');

  var safe=function(s){return(s||'').replace(/[\/\:*?"<>|\s]/g,'_');};
  XLSX.writeFile(wb, safe(th)+'_vs_'+safe(ta)+'_'+(data.d||'').replace(/\./g,'').replace(/\s/g,'')+'_SprayLab.xlsx');
  showToast('엑셀 파일 저장 완료', false);
}

// ─────────────────────────────────────────────────────────
// 엑셀 가져오기 / 서식 다운로드
// ─────────────────────────────────────────────────────────
function downloadExcelTemplate() {
  if (typeof XLSX === 'undefined') {
    var csv = '﻿이닝,팀,선수이름,등번호,결과,방향,타점,거리(ft)\n1회초,홈,김정철,7,안타,LF,1,280\n1회초,홈,이민준,12,삼진,,,\n1회말,원정,박성현,3,홈런,CF,2,380\n';
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    downloadBlob(blob, 'spraylab_template.csv');
    showToast('서식 CSV 다운로드 완료', false);
    return;
  }
  var wb = XLSX.utils.book_new();
  var data = [
    ['SprayLab 타석 기록 서식 — 이 행은 삭제하세요'],
    ['결과: 안타  내야안타  2루타  3루타  홈런  볼넷  사구  삼진  플라이 아웃  땅볼 아웃  희타  희비  병살'],
    ['방향: LF(당겨치기)  LC(좌중간)  CF(센터)  RC(우중간)  RF(밀어치기)  ※볼넷/삼진 등은 빈칸'],
    ['팀: 홈 또는 원정'],
    [],
    ['이닝','팀','선수이름','등번호','결과','방향','타점','거리(ft)'],
    ['1회초','홈','김정철','7','안타','LF',1,280],
    ['1회초','홈','이민준','12','삼진','',0,''],
    ['1회말','원정','박성현','3','홈런','CF',2,380]
  ];
  var ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:8},{wch:6},{wch:10},{wch:6},{wch:12},{wch:12},{wch:6},{wch:8}];
  XLSX.utils.book_append_sheet(wb, ws, '타석기록');
  XLSX.writeFile(wb, 'spraylab_template.xlsx');
  showToast('서식 파일 다운로드 완료', false);
}

function importExcel(input) {
  var file = input.files[0]; if (!file) return;
  if (typeof XLSX === 'undefined') { showToast('Excel 라이브러리 로딩 중... 잠시 후 다시 시도하세요', false); input.value=''; return; }
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = new Uint8Array(e.target.result);
      var wb = XLSX.read(data, {type:'array'});
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

      // 헤더 행 찾기 (이닝 컬럼이 있는 행)
      var hIdx = -1;
      for (var i = 0; i < Math.min(rows.length, 10); i++) {
        if (rows[i].some(function(c){ return String(c).replace(/\s/g,'').includes('이닝'); })) { hIdx=i; break; }
      }
      if (hIdx === -1) { showToast('"이닝" 헤더 행을 찾을 수 없습니다', false); input.value=''; return; }

      var headers = rows[hIdx].map(function(h){ return String(h).trim(); });
      function colOf(aliases) {
        for (var i=0; i<aliases.length; i++) {
          var idx = headers.findIndex(function(h){ return h===aliases[i]||h.replace(/\s/g,'')===aliases[i].replace(/\s/g,''); });
          if (idx !== -1) return idx;
        }
        return -1;
      }
      var C = {
        inn:  colOf(['이닝']),
        team: colOf(['팀']),
        bname:colOf(['선수이름','선수']),
        bnum: colOf(['등번호','번호']),
        res:  colOf(['결과']),
        dir:  colOf(['방향']),
        rbi:  colOf(['타점']),
        ft:   colOf(['거리(ft)','거리','ft','피트']),
        deg:  colOf(['각도','deg','DEG'])
      };
      if (C.bname === -1 || C.res === -1) { showToast('"선수이름"·"결과" 컬럼이 필요합니다', false); input.value=''; return; }

      var dirDeg = {'LF':36,'LC':66,'CF':90,'RC':114,'RF':150,'당겨치기':36,'좌중간':66,'센터':90,'우중간':114,'밀어치기':150};
      var noLocSet = {'볼넷':1,'사구':1,'삼진':1};
      var validRes = {'안타':1,'내야안타':1,'2루타':1,'3루타':1,'홈런':1,'볼넷':1,'사구':1,'삼진':1,'플라이 아웃':1,'땅볼 아웃':1,'희타':1,'희비':1,'병살':1};
      var validInn = {'1회초':1,'1회말':1,'2회초':1,'2회말':1,'3회초':1,'3회말':1,'4회초':1,'4회말':1,'5회초':1,'5회말':1,'6회초':1,'6회말':1,'7회초':1,'7회말':1,'8회초':1,'8회말':1,'9회초':1,'9회말':1,'연장':1};

      var added=0, skipped=0;
      var curInn = document.getElementById('innSel').value;

      rows.slice(hIdx+1).forEach(function(row) {
        if (!row || row.every(function(c){ return c==='' || c===null || c===undefined; })) return;
        var bname = C.bname>=0 ? String(row[C.bname]||'').trim() : '';
        var res   = C.res>=0   ? String(row[C.res]||'').trim()   : '';
        if (!bname || !res) return;
        if (!validRes[res]) { skipped++; return; }

        var teamRaw = C.team>=0 ? String(row[C.team]||'').trim() : '홈';
        var team = (teamRaw==='홈'||teamRaw==='home'||teamRaw.toUpperCase()==='H') ? 'home' : 'away';
        var bnum  = C.bnum>=0  ? String(row[C.bnum]||'').trim()  : '';
        var rbi   = C.rbi>=0   ? (parseInt(row[C.rbi])||0) : 0;
        var ft    = C.ft>=0    ? (parseFloat(row[C.ft])||0) : 0;
        var degOv = C.deg>=0   ? (parseFloat(row[C.deg])||null) : null;
        var dirStr= C.dir>=0   ? String(row[C.dir]||'').trim()   : '';
        var inn   = C.inn>=0   ? String(row[C.inn]||'').trim()   : '';
        if (!validInn[inn]) inn = curInn;

        // 선수 찾거나 추가
        var lineup = team==='home' ? AS.home_lineup : AS.away_lineup;
        var player = lineup.find(function(p){ return p.name===bname||(bnum&&p.num===bnum&&p.num!==''); });
        if (!player) {
          player = {id:'xl'+Date.now()+Math.random().toString(36).slice(2,6), name:bname, num:bnum, pos:'', bh:''};
          lineup.push(player);
        }

        // 위치 계산
        var deg=null, dir=null, x=null, y=null;
        if (!noLocSet[res]) {
          if (degOv!==null) deg=degOv;
          else if (dirDeg[dirStr]!==undefined) deg=dirDeg[dirStr];
          if (deg!==null) {
            if (deg<54) dir='LF'; else if (deg<78) dir='LC'; else if (deg<102) dir='CF'; else if (deg<126) dir='RC'; else dir='RF';
            var distPx = (ft>50?ft:280)/450;
            var ang = deg*Math.PI/180 - Math.PI;
            x = Math.min(0.97, Math.max(0.03, 0.5 + distPx*Math.cos(ang)));
            y = Math.min(0.97, Math.max(0.01, 1.0 + distPx*Math.sin(ang)));
          }
        }

        if (AS.abs.length >= MAX_HITS) AS.abs.shift();
        AS.abs.push({id:Date.now()+added, bid:player.id, bname:player.name, bnum:player.num, team:team, res:res, pt:null, zone:null, rbi:rbi, x:x, y:y, deg:deg, dir:dir, ft:ft>0?ft:(deg!==null?280:null), inn:inn, ts:'', pitches:[]});
        added++;
      });

      input.value='';
      if (added>0) {
        updateAll(); closeOverlay('loadOverlay');
        showToast(added+'개 타석 기록을 가져왔습니다'+(skipped>0?' ('+skipped+'개 건너뜀)':''), false);
      } else {
        showToast('가져올 데이터가 없습니다'+(skipped>0?' (결과값 오류 '+skipped+'개)':''), false);
      }
    } catch(err) {
      console.error(err);
      showToast('파일 읽기 오류: '+err.message, false);
      input.value='';
    }
  };
  reader.readAsArrayBuffer(file);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED GAME LOADER (runs on page load)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_loadSharedGame();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 재방문 랜딩 스킵: 공유 링크가 아닌 재방문이면 바로 앱 홈으로
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function autoSkipLanding(){
  var sp=new URLSearchParams(location.search);
  var hasShare=sp.has('game')||sp.has('team')||(location.hash&&location.hash.includes('#share='));
  // 모바일(터치 기기 + 화면 너비 1024px 미만)만 랜딩 스킵
  // 노트북/데스크톱은 항상 랜딩 페이지 표시
  var isMobile=('ontouchstart' in window||navigator.maxTouchPoints>0)&&window.innerWidth<1024;
  if(!hasShare && isMobile && localStorage.getItem('sl_visited')==='1'){
    showApp();
  }
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE 2: WEAKNESS DETECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderWeaknessAlerts(abs){
  var el=document.getElementById('weaknessList');
  if(!el)return;
  var alerts=[];
  var dataInsufficient=[];
  var hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
  var pts=['직구','커브','슬라이더','체인지업','포크볼','커터'];
  var zones=['내각 높음','중앙 높음','외각 높음','내각 중간','중앙 중간','외각 중간','내각 낮음','중앙 낮음','외각 낮음'];

  // 전체 타석 부족 체크
  var totalAB=abs.filter(function(a){return !noab.includes(a.res);}).length;
  if(totalAB<3){
    el.innerHTML='<div style="background:rgba(67,76,94,.15);border-radius:8px;padding:10px;text-align:center">'
      +'<div style="font-size:12px;color:var(--text2);font-weight:700">데이터 부족</div>'
      +'<div style="font-size:10px;color:var(--text3);margin-top:3px">최소 3타석 필요 (현재 '+totalAB+'타석)</div>'
      +'</div>';
    return;
  }

  // ① 코스별 아웃률 70% 이상 + 최소 3타석
  zones.forEach(function(z){
    var za=abs.filter(function(a){return a.zone===z;});
    if(za.length<3){
      if(za.length>0)dataInsufficient.push(z+' ('+za.length+'타석)');
      return;
    }
    var zout=za.filter(function(a){return !hits.includes(a.res)&&a.res!=='볼넷'&&a.res!=='사구';}).length;
    var rate=zout/za.length;
    if(rate>=0.7)alerts.push({
      level:'warn',icon:'⚠️',
      msg:'"'+z+' 아웃률 '+Math.round(rate*100)+'% ('+za.length+'타석 중 '+zout+'아웃) — '+z+' 대처 연습 권장"'
    });
  });

  // ② 구종별 삼진률 60% 이상 + 최소 3타석
  pts.forEach(function(pt){
    var pa=abs.filter(function(a){return a.pt===pt;});
    if(pa.length<3){
      return;
    }
    var k=pa.filter(function(a){return a.res==='삼진';}).length;
    var kpct=k/pa.length;
    if(kpct>=0.6)alerts.push({
      level:'danger',icon:'⚠️',
      msg:'"'+pt+' 삼진률 '+Math.round(kpct*100)+'% ('+pa.length+'타석 중 '+k+'삼진) — '+pt+' 약점 의심"'
    });
  });

  // ③ 당겨/밀어 편중 80% 이상
  var fd=abs.filter(function(a){return a.deg!=null;});
  if(fd.length>=5){
    var pull=fd.filter(function(a){return a.deg<72;}).length/fd.length;
    var oppo=fd.filter(function(a){return a.deg>108;}).length/fd.length;
    if(pull>=0.8)alerts.push({level:'warn',icon:'⚠️',msg:'"당겨치기 편중 '+Math.round(pull*100)+'% — 외각 공 대처 및 밀어치기 연습 권장"'});
    else if(oppo>=0.8)alerts.push({level:'warn',icon:'⚠️',msg:'"밀어치기 편중 '+Math.round(oppo*100)+'% — 내각 공 당겨치기 연습 권장"'});
  }

  // ④ 연속 무안타 스트릭
  var recAbs=[].concat(abs).reverse();
  var streak=0;
  for(var i=0;i<recAbs.length;i++){
    if(!hits.includes(recAbs[i].res)&&recAbs[i].res!=='볼넷'&&recAbs[i].res!=='사구')streak++;
    else break;
  }
  if(streak>=4)alerts.push({level:'warn',icon:'⚠️',msg:'"최근 '+streak+'타석 연속 무안타 — 배팅 폼 점검 권장"'});

  var html='';
  if(!alerts.length){
    html='<div style="background:rgba(45,212,160,.08);border:1px solid rgba(45,212,160,.2);border-radius:8px;padding:10px;text-align:center">'
      +'<div style="font-size:13px;color:#2dd4a0;font-weight:800">✅ 약점 없음</div>'
      +'<div style="font-size:10px;color:var(--text3);margin-top:3px">현재 기록 범위 내 특이 패턴 없음</div>'
      +'</div>';
  }else{
    html=alerts.map(function(a){
      var bg=a.level==='danger'?'rgba(245,101,101,.1)':'rgba(251,146,60,.08)';
      var bdr=a.level==='danger'?'rgba(245,101,101,.25)':'rgba(251,146,60,.2)';
      return '<div style="background:'+bg+';border:1px solid '+bdr+';border-radius:8px;padding:10px;margin-bottom:6px">'
        +'<div style="font-size:11px;font-weight:700;color:var(--text);line-height:1.5">'+a.icon+' '+a.msg+'</div>'
        +'</div>';
    }).join('');
  }

  // 데이터 부족 항목 회색 카드
  if(dataInsufficient.length){
    html+='<div style="background:rgba(67,76,94,.12);border:1px solid rgba(67,76,94,.2);border-radius:8px;padding:8px 10px;margin-top:4px">'
      +'<div style="font-size:10px;color:var(--text3);font-weight:700">데이터 부족 — 최소 3타석 필요</div>'
      +'<div style="font-size:9px;color:var(--text3);margin-top:3px">'+dataInsufficient.slice(0,4).join(' · ')+(dataInsufficient.length>4?' 외 '+(dataInsufficient.length-4)+'개':'')+'</div>'
      +'</div>';
  }
  el.innerHTML=html;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE 3: SHARE LINK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function shareGameLink(){
  var payload={
    v:1,
    hs:AS.hs,as:AS.as,
    ht:document.getElementById('tHome').value||'홈팀',
    at:document.getElementById('tAway').value||'원정팀',
    ts:Date.now(),
    cond:getGameCond(),
    abs:(AS.abs||[]).map(function(a){return{r:a.res,d:a.deg,p:a.pt,z:a.zone,i:a.inn,b:a.rbi,x:a.x?Math.round(a.x*1000)/1000:null,y:a.y?Math.round(a.y*1000)/1000:null,t:a.team};})
  };
  var url;
  try{
    var json=JSON.stringify(payload);
    var encoded=typeof LZString!=='undefined'
      ? 'z'+LZString.compressToEncodedURIComponent(json)
      : 'b'+btoa(unescape(encodeURIComponent(json)));
    var base=location.origin+location.pathname;
    url=base+'?game='+encoded;
  }catch(e){
    url=location.href;
  }
  // URL이 4KB 초과 시 경고 — 일부 메신저에서 링크가 깨질 수 있음
  if(url.length>4096){
    showToast('⚠️ 공유 URL이 깁니다 ('+Math.round(url.length/1024*10)/10+'KB) — 카카오톡 전송 시 파일 공유를 권장합니다',false,true);
  }
  showShareQR(url);
}
function _fallbackCopy(text){
  var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');showToast('링크 복사됨!');}catch(e){prompt('링크를 복사하세요:',text);}
  document.body.removeChild(ta);
}
var _sharedPayload=null;
function _loadSharedGame(){
  // ?game= 파라미터 우선, 레거시 #share= 도 지원
  var encoded='';
  var sp=new URLSearchParams(location.search);
  if(sp.has('game')){
    encoded=sp.get('game');
  }else if(location.hash&&location.hash.includes('#share=')){
    encoded=location.hash.replace('#share=','');
  }
  if(!encoded)return;
  try{
    var json;
    if(encoded.charAt(0)==='z'&&typeof LZString!=='undefined'){
      json=LZString.decompressFromEncodedURIComponent(encoded.slice(1));
    }else{
      var raw=encoded.charAt(0)==='b'?encoded.slice(1):encoded;
      json=decodeURIComponent(escape(atob(raw)));
    }
    var payload=JSON.parse(json);
    if(!payload||!payload.abs)return;
    _sharedPayload=payload;
    _showSharedBanner(payload);
  }catch(e){console.log('share load failed',e);}
}

function _showSharedBanner(payload){
  var ht=payload.ht||'홈팀',at=payload.at||'원정팀';
  var cnt=payload.abs?payload.abs.length:0;
  var banner=document.getElementById('sharedBanner');
  var desc=document.getElementById('sharedBannerDesc');
  if(desc)desc.textContent=ht+' vs '+at+' · '+cnt+'타석 데이터';
  if(banner)banner.classList.add('show');
}

function loadSharedGame(){
  if(!_sharedPayload)return;
  var payload=_sharedPayload;
  AS.hs=payload.hs||0;AS.as=payload.as||0;
  var tH=document.getElementById('tHome');if(tH)tH.value=payload.ht||'홈팀';
  var tA=document.getElementById('tAway');if(tA)tA.value=payload.at||'원정팀';
  AS.abs=payload.abs.map(function(a,i){return{
    id:i,bid:-1,bname:'공유',bnum:0,team:a.t||'home',
    res:a.r,pt:a.p,zone:a.z,rbi:a.b||0,
    x:a.x,y:a.y,deg:a.d,dir:a.d?'center':null,ft:null,
    inn:a.i||'1회초',ts:new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),
    count:{b:0,s:0,o:0},pitches:[]
  };});
  history.replaceState(null,'',location.pathname);
  dismissSharedBanner();
  showApp();
  hideAppWelcome();
  setTimeout(function(){updateAll();showToast('공유된 경기 데이터를 불러왔습니다 (읽기 전용)');},500);
}

function saveSharedGameLocal(){
  if(!_sharedPayload)return;
  var payload=_sharedPayload;
  var abs=payload.abs.map(function(a,i){return{
    id:i,bid:-1,bname:'공유',bnum:0,team:a.t||'home',
    res:a.r,pt:a.p,zone:a.z,rbi:a.b||0,
    x:a.x,y:a.y,deg:a.d,dir:null,ft:null,
    inn:a.i||'1회초',ts:'',count:{b:0,s:0,o:0},pitches:[]
  };});
  var key='sl_'+Date.now();
  var d={
    key,hs:payload.hs||0,as:payload.as||0,
    th:payload.ht||'홈팀',ta:payload.at||'원정팀',
    home_lineup:[],away_lineup:[],
    abs:abs,zoneHistory:{},
    d:new Date().toLocaleDateString('ko-KR'),ts:Date.now()
  };
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  var lbl=d.d+' '+d.th+' '+d.hs+':'+d.as+' '+d.ta;
  saves.push({key,label:lbl,ts:d.ts});
  localStorage.setItem('sl_saves',JSON.stringify(saves));
  localStorage.setItem(key,JSON.stringify(d));
  if(window.cloudSave)cloudSave(key,d,lbl,d.ts);
  dismissSharedBanner();
  showToast('내 기기에 저장 완료 ✓',false);
  history.replaceState(null,'',location.pathname);
}

function dismissSharedBanner(){
  var banner=document.getElementById('sharedBanner');
  if(banner)banner.classList.remove('show');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE 4: PLAYER SEASON PROFILE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function openPlayerProfile(){
  var el=document.getElementById('playerProfileContent');
  if(!el)return;
  var hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
  var players={};
  // current game
  AS.abs.forEach(function(a){
    var key=a.bname+'#'+a.bnum;
    if(!players[key])players[key]={name:a.bname,num:a.bnum,ab:0,h:0,rbi:0,bb:0,tb:0,pa:0,k:0,hr:0};
    var p=players[key];p.pa++;
    if(!noab.includes(a.res))p.ab++;
    if(hits.includes(a.res))p.h++;
    if(a.res==='볼넷'||a.res==='사구')p.bb++;
    if(a.res==='삼진')p.k++;
    if(a.res==='홈런')p.hr++;
    if(a.rbi)p.rbi+=a.rbi;
    var bm={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
    p.tb+=(bm[a.res]||0);
  });
  // saved games
  for(var i=0;i<localStorage.length;i++){
    var key2=localStorage.key(i);
    if(!key2||!key2.startsWith('sl_')||key2.startsWith('sl_auto_'))continue;
    try{
      var d=JSON.parse(localStorage.getItem(key2));
      if(!d||!d.abs)continue;
      d.abs.forEach(function(a){
        var pk=a.bname+'#'+a.bnum;
        if(!players[pk])players[pk]={name:a.bname,num:a.bnum,ab:0,h:0,rbi:0,bb:0,tb:0,pa:0,k:0,hr:0};
        var p=players[pk];p.pa++;
        if(!noab.includes(a.res))p.ab++;
        if(hits.includes(a.res))p.h++;
        if(a.res==='볼넷'||a.res==='사구')p.bb++;
        if(a.res==='삼진')p.k++;
        if(a.res==='홈런')p.hr++;
        if(a.rbi)p.rbi+=a.rbi;
        var bm={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};
        p.tb+=(bm[a.res]||0);
      });
    }catch(e){}
  }
  var list=Object.values(players).filter(function(p){return p.ab>=1;});
  list.sort(function(a,b){return(b.ab?b.h/b.ab:0)-(a.ab?a.h/a.ab:0);});
  if(!list.length){el.innerHTML='<div style="text-align:center;color:var(--text3);padding:24px">기록이 없습니다</div>';openOverlay('playerProfileOverlay');return;}
  el.innerHTML='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">'
    +'<thead><tr style="border-bottom:1px solid var(--border);color:var(--text3)">'
    +'<th style="padding:6px 4px;text-align:left">선수</th><th style="padding:6px 4px">PA</th><th style="padding:6px 4px">AB</th><th style="padding:6px 4px">H</th><th style="padding:6px 4px">HR</th><th style="padding:6px 4px">RBI</th><th style="padding:6px 4px">AVG</th><th style="padding:6px 4px">OBP</th><th style="padding:6px 4px">OPS</th></tr></thead>'
    +'<tbody>'+list.map(function(p){
      var avg=p.ab?p.h/p.ab:0,obp=p.pa?(p.h+p.bb)/p.pa:0,slg=p.ab?p.tb/p.ab:0,ops=obp+slg;
      var f3=function(v){return v.toFixed(3).replace('0.','.'); };
      var opsColor=ops>=0.9?'#2dd4a0':ops>=0.75?'#4b8cf5':ops>=0.6?'#f6c23e':'var(--text3)';
      return '<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:6px 4px;font-weight:700">#'+p.num+' '+p.name+'</td>'
        +'<td style="padding:6px 4px;text-align:center;color:var(--text2)">'+p.pa+'</td>'
        +'<td style="padding:6px 4px;text-align:center;color:var(--text2)">'+p.ab+'</td>'
        +'<td style="padding:6px 4px;text-align:center;color:#2dd4a0;font-weight:700">'+p.h+'</td>'
        +'<td style="padding:6px 4px;text-align:center;color:#f56565">'+p.hr+'</td>'
        +'<td style="padding:6px 4px;text-align:center">'+p.rbi+'</td>'
        +'<td style="padding:6px 4px;text-align:center;font-weight:700">'+f3(avg)+'</td>'
        +'<td style="padding:6px 4px;text-align:center">'+f3(obp)+'</td>'
        +'<td style="padding:6px 4px;text-align:center;font-weight:800;color:'+opsColor+'">'+f3(ops)+'</td>'
        +'</tr>';
    }).join('')+'</tbody></table></div>';
  openOverlay('playerProfileOverlay');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE 5: GAME COMPARISON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function populateCompareSelects(){
  var s1=document.getElementById('cmpGame1'),s2=document.getElementById('cmpGame2');
  if(!s1||!s2)return;
  var keys=[];
  for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.startsWith('sl_')&&!k.startsWith('sl_auto_'))keys.push(k);}
  keys.sort().reverse();
  var opts=keys.map(function(k){
    try{var d=JSON.parse(localStorage.getItem(k));if(!d||!d.abs)return '';var ts=d.ts?new Date(d.ts).toLocaleDateString('ko-KR'):'?';
    var ht=d.th||d.homeTeam||'홈',at=d.ta||d.awayTeam||'원정';
    return '<option value="'+k+'">'+ht+'vs'+at+' ('+ts+')</option>';}catch(e){return '';}
  }).join('');
  var def='<option value="">선택</option>';
  s1.innerHTML=def+opts;s2.innerHTML=def+opts;
}
function runGameCompare(){
  var k1=document.getElementById('cmpGame1').value,k2=document.getElementById('cmpGame2').value;
  var el=document.getElementById('cmpResult');
  if(!k1||!k2||k1===k2){el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center">두 경기를 선택하세요</div>';return;}
  try{
    var d1=JSON.parse(localStorage.getItem(k1)),d2=JSON.parse(localStorage.getItem(k2));
    var hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
    function calc(abs){
      var ab=abs.filter(function(a){return !noab.includes(a.res);}).length;
      var h=abs.filter(function(a){return hits.includes(a.res);}).length;
      var bb=abs.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
      var tb=abs.reduce(function(s,a){var bm={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};return s+(bm[a.res]||0);},0);
      var k=abs.filter(function(a){return a.res==='삼진';}).length;
      var hr=abs.filter(function(a){return a.res==='홈런';}).length;
      var pa=abs.length,avg=ab?h/ab:0,obp=pa?(h+bb)/pa:0,slg=ab?tb/ab:0;
      return {ab:ab,h:h,bb:bb,k:k,hr:hr,rbi:abs.reduce(function(s,a){return s+a.rbi;},0),avg:avg,ops:obp+slg};
    }
    var c1=calc(d1.abs),c2=calc(d2.abs);
    var f3=function(v){return v.toFixed(3).replace('0.','.'); };
    var row=function(label,v1,v2,fmt){
      fmt=fmt||function(v){return v;};
      var s1=fmt(v1),s2=fmt(v2);
      var w1=v1>v2?'color:#2dd4a0;font-weight:800':'color:var(--text2)',w2=v2>v1?'color:#2dd4a0;font-weight:800':'color:var(--text2)';
      return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 4px;'+w1+'">'+s1+'</td><td style="padding:5px 4px;font-size:10px;color:var(--text3);text-align:center">'+label+'</td><td style="padding:5px 4px;text-align:right;'+w2+'">'+s2+'</td></tr>';
    };
    var ts1=d1.ts?new Date(d1.ts).toLocaleDateString('ko-KR'):'경기1',ts2=d2.ts?new Date(d2.ts).toLocaleDateString('ko-KR'):'경기2';
    el.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:12px">'
      +'<thead><tr><th style="padding:6px 4px;color:var(--accent);text-align:left">'+ts1+'</th><th style="padding:6px 4px;color:var(--text3);text-align:center;font-size:10px">지표</th><th style="padding:6px 4px;color:var(--accent);text-align:right">'+ts2+'</th></tr></thead><tbody>'
      +row('AVG',c1.avg,c2.avg,f3)
      +row('OPS',c1.ops,c2.ops,f3)
      +row('안타',c1.h,c2.h)
      +row('홈런',c1.hr,c2.hr)
      +row('타점',c1.rbi,c2.rbi)
      +row('삼진',c2.k,c1.k)
      +'</tbody></table>';
  }catch(e){el.innerHTML='<div style="font-size:11px;color:var(--red)">불러오기 실패</div>';}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE A: 퀵버튼 바 (상단 고정)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const _QUICK_HITS=['안타','2루타','3루타','홈런'];
function recQuick(res){
  if(!AS.batter){showToast('타자를 먼저 선택하세요',false,false);return;}
  if(_QUICK_HITS.includes(res)){
    AS.pendingQuickRes=res;
    _showFieldTapPrompt(res);
    return;
  }
  recOther(res);
}
function _showFieldTapPrompt(res){
  var hint=document.getElementById('fieldHint');
  if(hint){hint._origText=hint.textContent;hint.textContent='👆 공이 떨어진 위치를 필드에서 탭하세요 (취소: ESC)';}
  var fw=document.querySelector('.field-wrap');
  if(fw){fw.classList.add('field-tap-pending');}
}
function _clearFieldTapPrompt(){
  AS.pendingQuickRes=null;
  var hint=document.getElementById('fieldHint');
  if(hint&&hint._origText){hint.textContent=hint._origText;delete hint._origText;}
  var fw=document.querySelector('.field-wrap');
  if(fw){fw.classList.remove('field-tap-pending');}
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE B: 스와이프 제스처 (hitOverlay)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function initSwipeGesture(){
  var SWIPE_MIN=50; // px threshold
  var sx=0,sy=0,active=false;

  function getTarget(){return document.getElementById('hitModal');}

  function onStart(x,y){sx=x;sy=y;active=true;}

  function onEnd(x,y){
    if(!active)return;
    active=false;
    var dx=x-sx,dy=y-sy;
    if(Math.abs(dx)<SWIPE_MIN&&Math.abs(dy)<SWIPE_MIN)return;
    var res;
    if(Math.abs(dx)>Math.abs(dy)){
      res=dx>0?'안타':'땅볼 아웃';
    }else{
      res=dy<0?'볼넷':'삼진';
    }
    // 스와이프 피드백 애니메이션
    var fb=document.getElementById('swipeFeedback');
    if(fb){
      var icons={'안타':'🟢 안타','땅볼 아웃':'⬛ 아웃','볼넷':'🟣 볼넷','삼진':'🔴 삼진'};
      var bgs={'안타':'rgba(45,212,160,.25)','땅볼 아웃':'rgba(67,76,94,.3)','볼넷':'rgba(167,139,250,.25)','삼진':'rgba(245,101,101,.25)'};
      fb.textContent=icons[res]||res;
      fb.style.background=bgs[res]||'rgba(75,140,245,.2)';
      fb.classList.add('show');
      setTimeout(function(){fb.classList.remove('show');},300);
    }
    setTimeout(function(){
      if(document.getElementById('hitOverlay').classList.contains('show')){
        if(res==='안타'||res==='땅볼 아웃'){recHit(res);}
        else{
          // 볼넷/삼진: pending 위치 있으면 recHit 불가 → recOther로 처리
          if(AS.pending){closeHit();}
          recOther(res);
        }
      }
    },320);
  }

  document.addEventListener('DOMContentLoaded',function(){
    // 이벤트는 overlay에 위임하여 기존 onclick 버튼에 간섭하지 않음
    var ov=document.getElementById('hitOverlay');
    if(!ov)return;
    ov.addEventListener('touchstart',function(e){
      if(e.target.tagName==='BUTTON')return;
      var t=e.touches[0];onStart(t.clientX,t.clientY);
    },{passive:true});
    ov.addEventListener('touchend',function(e){
      if(e.target.tagName==='BUTTON'){active=false;return;}
      var t=e.changedTouches[0];onEnd(t.clientX,t.clientY);
    },{passive:true});
    ov.addEventListener('mousedown',function(e){
      if(e.target.tagName==='BUTTON')return;
      onStart(e.clientX,e.clientY);
    });
    ov.addEventListener('mouseup',function(e){
      if(e.target.tagName==='BUTTON'){active=false;return;}
      onEnd(e.clientX,e.clientY);
    });
  });
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE C: 투수 탭
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function selPitcherRole(el,role){
  document.querySelectorAll('#pitcherRoleChips .chip').forEach(function(c){c.classList.remove('on');});
  el.classList.add('on');
  AS.pitcherRole=role;
}

function addPitcher(){
  var name=document.getElementById('pitcherName').value.trim();
  var num=document.getElementById('pitcherNum').value.trim();
  if(!name){showToast('투수 이름을 입력하세요',false,false);return;}
  var p={id:Date.now(),name:name,num:num,role:AS.pitcherRole||null,pitches:[]};
  AS.pitchers.push(p);
  selectPitcher(p.id);
  document.getElementById('pitcherName').value='';
  document.getElementById('pitcherNum').value='';
  document.querySelectorAll('#pitcherRoleChips .chip').forEach(function(c){c.classList.remove('on');});
  AS.pitcherRole=null;
  renderPitcherRoster();
}

function selectPitcher(id){
  AS.currentPitcher=AS.pitchers.find(function(p){return p.id===id;})||null;
  renderPitcherRoster();
  var lbl=document.getElementById('currentPitcherLabel');
  if(lbl)lbl.textContent=AS.currentPitcher?(AS.currentPitcher.num?'#'+AS.currentPitcher.num+' ':'')+AS.currentPitcher.name:'미선택';
  renderPitcherStats();
}

function renderPitcherRoster(){
  var el=document.getElementById('pitcherRoster');
  if(!el)return;
  if(!AS.pitchers.length){el.innerHTML='<div style="font-size:11px;color:var(--text3)">투수를 등록하세요</div>';return;}
  var roleColors={SP:'#4b8cf5',RP:'#a78bfa',CP:'#2dd4a0'};
  el.innerHTML=AS.pitchers.map(function(p){
    var on=AS.currentPitcher&&AS.currentPitcher.id===p.id;
    var roleHtml=p.role?('<span style="font-size:8px;padding:1px 4px;border-radius:3px;background:'+roleColors[p.role]+'33;color:'+roleColors[p.role]+';margin-left:3px">'+p.role+'</span>'):'';
    return '<button class="pitcher-tag'+(on?' on':'')+'" onclick="selectPitcher('+p.id+')">'
      +(p.num?'#'+p.num+' ':'')+p.name+roleHtml
      +' <span style="font-size:9px;color:inherit;opacity:.7">('+p.pitches.length+'구)</span>'
      +'</button>';
  }).join('');
}

function selPitcherZone(el){
  document.querySelectorAll('.zone-mini-cell').forEach(function(c){c.classList.remove('on');});
  el.classList.add('on');
  AS.pitcherZone=el.getAttribute('data-z');
}

function selPitcherPt(el,pt){
  document.querySelectorAll('#pitcherPtChips .chip').forEach(function(c){c.classList.remove('on');});
  el.classList.add('on');
  AS.pitcherPt=pt;
}

function recordPitch(result){
  if(!AS.currentPitcher){showToast('투수를 먼저 선택하세요',false,false);return;}
  var hitResults=['안타','2루타','3루타','홈런'];
  var entry={
    id:Date.now(),
    inning:document.getElementById('innSel')?document.getElementById('innSel').value:null,
    zone:AS.pitcherZone,
    zoneX:AS.pitcherZoneX||null,
    zoneY:AS.pitcherZoneY||null,
    pt:AS.pitcherPt,
    result:result,
    batter:AS.batter?AS.batter.name:null,
    ts:new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})
  };
  if(!AS.currentPitcher._batterLog)AS.currentPitcher._batterLog=[];
  AS.currentPitcher._batterLog.push(entry);
  AS.currentPitcher.pitches.push(entry);
  AS.pitchLog.unshift(entry);
  renderPitchLog();
  renderPitcherStats();
  scheduleAutoSave();
  // 피드백
  var icons={'볼':'🟢','스트라이크':'🟡','파울':'🟣','안타':'🟢','2루타':'🔵','3루타':'🟡','홈런':'🔴'};
  showToast((icons[result]||'⚾')+(AS.pitcherPt?' '+AS.pitcherPt:'')+' '+result,false,true);
}

function loadPitchEntry(pt, zone, zoneX, zoneY){
  if(pt){
    AS.pitcherPt=pt;
    document.querySelectorAll('#pitcherPtChips .chip').forEach(function(c){
      c.classList.toggle('on',c.textContent.trim()===pt);
    });
  }
  if(zone){
    AS.pitcherZone=zone;
    AS.pitcherZoneX=zoneX||null;
    AS.pitcherZoneY=zoneY||null;
    var lbl=document.getElementById('pitcherZoneLabel');
    if(lbl)lbl.textContent=zone;
    var cvs=document.getElementById('pitcherZoneCanvas');
    if(cvs&&zoneX!=null&&zoneY!=null){
      _drawZoneCanvas(cvs,[{cx:zoneX,cy:zoneY,result:'스트라이크'}],true);
    }
  }
  showToast((pt||'')+(zone?' · '+zone:'')+'  입력 설정 완료',false,true);
}

function renderPitchLog(){
  var el=document.getElementById('pitchLog');
  if(!el)return;
  var log=AS.currentPitcher?AS.currentPitcher.pitches.slice().reverse().slice(0,15):AS.pitchLog.slice(0,15);
  if(!log.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">투구를 기록하면 여기에 표시됩니다</div>';return;}
  var resColor={'볼':'#2dd4a0','스트라이크':'#f6c23e','파울':'#a78bfa','안타':'#2dd4a0','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565','타격됨':'#f56565'};
  el.innerHTML=log.map(function(p){
    var col=resColor[p.result]||'#94a3b8';
    var ptE=JSON.stringify(p.pt||'');
    var zoneE=JSON.stringify(p.zone||'');
    var zx=p.zoneX!=null?p.zoneX:'null';
    var zy=p.zoneY!=null?p.zoneY:'null';
    return '<div class="pitch-entry" style="cursor:pointer" onclick="loadPitchEntry('+ptE+','+zoneE+','+zx+','+zy+')" title="클릭하면 입력값 복원">'
      +'<div class="pe-result" style="background:'+col+'"></div>'
      +'<span style="font-size:10px;color:var(--text2);flex:1">'+(p.inning?'<span style="color:var(--text3);font-size:9px">'+p.inning+'</span> ':'')+(p.pt||'—')+(p.zone?' · '+p.zone:'')+' → <strong style="color:'+col+'">'+p.result+'</strong></span>'
      +'<span style="font-size:9px;color:var(--text3)">'+p.ts+'</span>'
      +'</div>';
  }).join('');
}

function renderPitcherStats(){
  var el=document.getElementById('pitcherStats');
  if(!el)return;
  if(!AS.currentPitcher||!AS.currentPitcher.pitches.length){
    el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">위에서 투수를 추가하세요 ↑</div>';
    return;
  }
  var pitches=AS.currentPitcher.pitches;
  var total=pitches.length;
  var hitResults=['안타','2루타','3루타','홈런','타격됨'];
  var strikes=pitches.filter(function(p){return p.result==='스트라이크'||hitResults.includes(p.result)||p.result==='파울';}).length;
  var balls=pitches.filter(function(p){return p.result==='볼';}).length;
  var hits2=pitches.filter(function(p){return ['안타','2루타','3루타','홈런','타격됨'].includes(p.result);}).length;
  var strikePct=total?Math.round(strikes/total*100):0;

  // 기본 통계
  var html='<div class="pitcher-stat-grid">'
    +'<div class="ps-it"><div class="ps-v">'+total+'</div><div class="ps-l">총 투구수</div></div>'
    +'<div class="ps-it"><div class="ps-v" style="color:#f6c23e">'+strikePct+'%</div><div class="ps-l">스트라이크율</div></div>'
    +'<div class="ps-it"><div class="ps-v" style="color:#f56565">'+hits2+'</div><div class="ps-l">피타격</div></div>'
    +'</div>';

  // 구종 비율 도넛
  var ptTypes=Object.keys(_PT_COL);
  var ptColors=ptTypes.map(function(pt){return _PT_COL[pt];});
  var ptCounts=ptTypes.map(function(pt){return pitches.filter(function(p){return p.pt===pt;}).length;});
  var ptUsed=ptTypes.filter(function(pt,i){return ptCounts[i]>0;});
  var ptCountsUsed=ptCounts.filter(function(c){return c>0;});

  html+='<div style="margin-bottom:8px"><div style="font-size:9px;color:var(--text3);margin-bottom:5px;letter-spacing:.8px;text-transform:uppercase">구종 비율</div>'
    +'<div style="display:flex;align-items:center;gap:10px">'
    +'<canvas id="pitcherDonut" width="80" height="80" style="flex-shrink:0"></canvas>'
    +'<div style="flex:1">';
  ptUsed.forEach(function(pt,i){
    var idx=ptTypes.indexOf(pt);
    var pct=total?Math.round(ptCountsUsed[i]/total*100):0;
    html+='<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;font-size:10px">'
      +'<div style="width:7px;height:7px;border-radius:50%;background:'+ptColors[idx]+';flex-shrink:0"></div>'
      +'<span style="flex:1;color:var(--text2)">'+pt+'</span>'
      +'<span style="font-family:var(--mono);color:var(--text)">'+pct+'%</span>'
      +'</div>';
  });
  html+='</div></div></div>';

  // 코스별 히트맵
  var zones9=['내각 높음','중앙 높음','외각 높음','내각 중간','중앙 중간','외각 중간','내각 낮음','중앙 낮음','외각 낮음'];
  html+='<div style="margin-bottom:8px"><div style="font-size:9px;color:var(--text3);margin-bottom:4px;letter-spacing:.8px;text-transform:uppercase">코스별 피안타/삼진 히트맵</div>'
    +'<div style="display:flex;align-items:center;gap:3px">'
    +'<div style="font-size:8px;color:var(--text3);line-height:2.6;text-align:right"><div>높</div><div>중</div><div>낮</div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;width:90px">';
  zones9.forEach(function(z){
    var zp=pitches.filter(function(p){return p.zone===z;});
    var zHit=zp.filter(function(p){return ['안타','2루타','3루타','홈런','타격됨'].includes(p.result);}).length;
    var zStr=zp.filter(function(p){return p.result==='스트라이크'||p.result==='파울';}).length;
    var n=zp.length;
    var bg='var(--bg-raised)';
    var txt='';
    if(n){
      var hitRate=zHit/n;
      bg=hitRate>=0.4?'rgba(245,101,101,.5)':hitRate>0?'rgba(246,194,62,.35)':'rgba(45,212,160,.3)';
      txt=n;
    }
    var zpJson=JSON.stringify(zp.map(function(p){return{pt:p.pt||'',result:p.result,inning:p.inning||''};}));
    html+='<div style="aspect-ratio:1;border-radius:3px;background:'+bg+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:var(--mono);color:var(--text);border:1px solid var(--border2);cursor:'+(n?'pointer':'default')+'" title="'+z+'" onclick="_showPzCard(event,'+JSON.stringify(z)+','+zpJson+')">'+txt+'</div>';
  });
  html+='</div>'
    +'<div style="font-size:8px;color:var(--text3);line-height:2.6;margin-left:2px"><div>내</div><div>중</div><div>외</div></div>'
    +'</div>'
    +'<div style="font-size:8px;color:var(--text3);margin-top:3px">🔴=피안타≥40% 🟡=피안타있음 🟢=피안타없음</div>'
    +'</div>';

  // 전략 텍스트
  var strategy=[];
  var hitAbs2=pitches.filter(function(p){return['안타','2루타','3루타','홈런','타격됨'].includes(p.result);});
  var kAbs=pitches.filter(function(p){return p.result==='삼진';});
  if(total>0){
    if(strikePct>=65)strategy.push('✓ 스트라이크율 '+strikePct+'% — 제구 안정적.');
    else if(strikePct<50)strategy.push('⚠ 스트라이크율 '+strikePct+'% — 초구 스트라이크 집중 필요.');
    if(kAbs.length>=2)strategy.push('✓ 삼진 '+kAbs.length+'개 — 결정구 효과적.');
    var hitRate=Math.round(hitAbs2.length/total*100);
    if(hitRate>30)strategy.push('⚠ 피안타율 '+hitRate+'% — 구위·코스 조정 필요.');
    if(ptUsed.length){var topI=ptCountsUsed.indexOf(Math.max.apply(null,ptCountsUsed));strategy.push('주력구: '+ptUsed[topI]+' ('+Math.round(ptCountsUsed[topI]/total*100)+'%).');}
  }
  if(strategy.length)html+='<div style="margin-top:6px;font-size:9px;line-height:1.8;color:var(--text2)">'+strategy.join('<br>')+'</div>';

  el.innerHTML=html;

  // 도넛 차트 그리기
  var c=document.getElementById('pitcherDonut');
  if(c&&ptCountsUsed.length){
    var ctx=c.getContext('2d');
    var dpr=window.devicePixelRatio||1;
    c.width=80*dpr;c.height=80*dpr;c.style.width='80px';c.style.height='80px';
    ctx.scale(dpr,dpr);
    var cx=40,cy=40,r=32,ir=18;
    var tot2=ptCountsUsed.reduce(function(a,b){return a+b;},0);
    var st=-Math.PI/2;
    ptUsed.forEach(function(pt,i){
      var idx=ptTypes.indexOf(pt);
      var sl=(ptCountsUsed[i]/tot2)*Math.PI*2;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,st,st+sl);ctx.closePath();
      ctx.fillStyle=ptColors[idx];ctx.fill();
      st+=sl;
    });
    ctx.beginPath();ctx.arc(cx,cy,ir,0,Math.PI*2);ctx.fillStyle='#18181f';ctx.fill();
  }
}

// ── 존 팝업 카드 ──
var _pzCardEl=null;
function _showPzCard(e,zone,pitches){
  _hidePzCard();
  if(!pitches||!pitches.length)return;
  var resCol={'볼':'#2dd4a0','스트라이크':'#f6c23e','파울':'#a78bfa','안타':'#2dd4a0','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565','타격됨':'#f56565','삼진':'#94a3b8','볼넷':'#a78bfa','병살':'#9ca3af','삼중살':'#9ca3af'};
  var rows=pitches.map(function(p,i){
    var col=resCol[p.result]||'#94a3b8';var ptCol=_PT_COL[p.pt]||'#7c8898';
    return'<div style="display:flex;gap:5px;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:10px">'
      +'<span style="color:var(--text3);min-width:12px;text-align:right;font-size:9px">'+(i+1)+'</span>'
      +(p.inning?'<span style="font-size:8px;color:var(--text3);min-width:28px">'+p.inning+'</span>':'')
      +'<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'+ptCol+';flex-shrink:0"></span>'
      +'<span style="flex:1;color:var(--text2)">'+(p.pt||'—')+'</span>'
      +'<span style="color:'+col+';font-weight:700">'+p.result+'</span>'
      +'</div>';
  }).join('');
  var d=document.createElement('div');
  d.id='_pzCard';
  d.style.cssText='position:fixed;z-index:9999;background:#18181f;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 12px;min-width:180px;max-width:220px;max-height:260px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.6);font-family:var(--font)';
  d.innerHTML='<div style="font-size:10px;font-weight:800;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">'+zone+' ('+pitches.length+'구)</div>'+rows;
  document.body.appendChild(d);
  _pzCardEl=d;
  var r=e.target.getBoundingClientRect();
  var left=r.right+6,top=r.top;
  if(left+220>window.innerWidth-8)left=r.left-226;
  if(top+260>window.innerHeight-8)top=window.innerHeight-268;
  d.style.left=Math.max(8,left)+'px';d.style.top=Math.max(8,top)+'px';
  setTimeout(function(){document.addEventListener('click',_hidePzCard,{once:true});},0);
}
function _hidePzCard(){if(_pzCardEl){_pzCardEl.remove();_pzCardEl=null;}}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE D: 성적 카드 PNG (개인 9:16 / 팀 1:1)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var _cardType='personal';

function openCardPreview(){
  _cardType='personal';
  document.getElementById('cptPersonal').classList.add('on');
  document.getElementById('cptTeam').classList.remove('on');
  _drawCard();
  document.getElementById('cardPreviewOv').classList.add('show');
}

function switchCardType(type,el){
  _cardType=type;
  document.querySelectorAll('.cpt-btn').forEach(function(b){b.classList.remove('on');});
  el.classList.add('on');
  _drawCard();
}

function closeCardPreview(){
  document.getElementById('cardPreviewOv').classList.remove('show');
}

function downloadPreviewCard(){
  var c=document.getElementById('cardPreviewCanvas');
  if(!c)return;
  _downloadCanvas(c,'spraylab_card_'+Date.now()+'.png');
}

function _drawCard(){
  if(_cardType==='personal')_drawPersonalCard();
  else _drawTeamCard();
}

function _drawPersonalCard(){
  var cvs=document.getElementById('cardPreviewCanvas');
  if(!cvs)return;
  var W=540,H=960;
  cvs.width=W;cvs.height=H;
  cvs.style.width='100%';cvs.style.maxHeight='500px';cvs.style.objectFit='contain';
  var ctx=cvs.getContext('2d');

  // 배경 (다크 네이비 그라디언트)
  var bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#07090f');bg.addColorStop(0.5,'#0a1628');bg.addColorStop(1,'#07090f');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  // 상단 로고 영역
  ctx.fillStyle='rgba(75,140,245,.08)';
  ctx.fillRect(0,0,W,120);
  ctx.strokeStyle='rgba(75,140,245,.2)';
  ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,120);ctx.lineTo(W,120);ctx.stroke();

  // 로고 텍스트
  ctx.font='bold 22px "Bebas Neue",sans-serif';
  ctx.fillStyle='#4b8cf5';
  ctx.textAlign='center';
  ctx.fillText('SPRAY',W/2-24,52);
  ctx.fillStyle='#2dd4a0';
  ctx.fillText('LAB',W/2+28,52);
  ctx.font='12px "JetBrains Mono",monospace';
  ctx.fillStyle='rgba(255,255,255,.35)';
  ctx.fillText(new Date().toLocaleDateString('ko-KR'),W/2,78);

  // 선수 정보
  var ht=document.getElementById('tHome')?document.getElementById('tHome').value||'홈팀':'팀';
  ctx.font='bold 18px "Noto Sans KR",sans-serif';
  ctx.fillStyle='rgba(255,255,255,.5)';
  ctx.textAlign='center';
  ctx.fillText(ht,W/2,108);

  // 주요 스탯 계산
  var abs=AS.abs;
  var hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
  var ab=abs.filter(function(a){return !noab.includes(a.res);}).length;
  var h=abs.filter(function(a){return hits.includes(a.res);}).length;
  var bb=abs.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
  var tb=abs.reduce(function(s,a){var bm={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};return s+(bm[a.res]||0);},0);
  var hr=abs.filter(function(a){return a.res==='홈런';}).length;
  var rbi=abs.reduce(function(s,a){return s+(a.rbi||0);},0);
  var avg=ab?h/ab:0,obp=abs.length?(h+bb)/abs.length:0,slg=ab?tb/ab:0,ops=obp+slg;
  var fmt3=function(v){return '.'+Math.round(v*1000).toString().padStart(3,'0');};

  // OPS 크게 (중앙)
  ctx.textAlign='center';
  ctx.font='bold 11px "JetBrains Mono",monospace';
  ctx.fillStyle='rgba(255,255,255,.35)';
  ctx.fillText('OPS',W/2,170);
  ctx.font='bold 90px "Bebas Neue",sans-serif';
  var opsCol=ops>=0.9?'#f56565':ops>=0.75?'#2dd4a0':ops>=0.6?'#4b8cf5':'#94a3b8';
  ctx.fillStyle=opsCol;
  ctx.fillText(fmt3(ops).replace('.',''),W/2,255);
  ctx.font='bold 22px "JetBrains Mono",monospace';
  ctx.fillStyle='rgba(255,255,255,.3)';
  ctx.fillText('.',W/2-58,215);

  // AVG / OBP / SLG 3열
  var statItems=[{l:'AVG',v:fmt3(avg)},{l:'OBP',v:fmt3(obp)},{l:'SLG',v:fmt3(slg)}];
  var cols=['#f6c23e','#2dd4a0','#4b8cf5'];
  statItems.forEach(function(s,i){
    var x=90+i*180;
    ctx.fillStyle='rgba(255,255,255,.05)';
    _roundRect(ctx,x-75,278,150,80,10);
    ctx.fill();
    ctx.font='bold 34px "JetBrains Mono",monospace';
    ctx.fillStyle=cols[i];
    ctx.textAlign='center';
    ctx.fillText(s.v,x,323);
    ctx.font='bold 11px "Noto Sans KR",sans-serif';
    ctx.fillStyle='rgba(255,255,255,.4)';
    ctx.fillText(s.l,x,348);
  });

  // HR / RBI / H 박스
  var box2=[{l:'홈런',v:hr},{l:'타점',v:rbi},{l:'안타',v:h}];
  box2.forEach(function(b,i){
    var x=90+i*180;
    ctx.fillStyle='rgba(255,255,255,.03)';
    _roundRect(ctx,x-72,378,144,56,8);ctx.fill();
    ctx.font='bold 28px "JetBrains Mono",monospace';
    ctx.fillStyle='#eef0f8';ctx.textAlign='center';
    ctx.fillText(b.v,x,412);
    ctx.font='10px "Noto Sans KR",sans-serif';
    ctx.fillStyle='rgba(255,255,255,.3)';
    ctx.fillText(b.l,x,428);
  });

  // 방향 분포
  var fd=abs.filter(function(a){return a.deg!=null;});
  var tot=fd.length||1;
  var pullP=Math.round(fd.filter(function(a){return a.deg<72;}).length/tot*100);
  var ctrP=Math.round(fd.filter(function(a){return a.deg>=72&&a.deg<=108;}).length/tot*100);
  var oppoP=100-pullP-ctrP;
  ctx.fillStyle='rgba(255,255,255,.06)';
  _roundRect(ctx,20,450,W-40,100,12);ctx.fill();
  ctx.font='bold 10px "Noto Sans KR",sans-serif';
  ctx.fillStyle='rgba(255,255,255,.4)';ctx.textAlign='center';
  ctx.fillText('타구 방향',W/2,472);
  var dirs=[{l:'당겨치기',v:pullP,col:'#f56565'},{l:'센터',v:ctrP,col:'#2dd4a0'},{l:'밀어치기',v:oppoP,col:'#4b8cf5'}];
  dirs.forEach(function(d,i){
    var x=90+i*180;
    ctx.font='bold 30px "JetBrains Mono",monospace';
    ctx.fillStyle=d.col;ctx.textAlign='center';
    ctx.fillText(d.v+'%',x,516);
    ctx.font='9px "Noto Sans KR",sans-serif';
    ctx.fillStyle='rgba(255,255,255,.35)';
    ctx.fillText(d.l,x,532);
  });

  // 스프레이 차트 미니 (캔버스 복사)
  var fld=document.getElementById('fldCanvas'),hit=document.getElementById('hitCanvas');
  if(fld&&hit){
    var miniSize=200;
    var mx=(W-miniSize)/2,my=570;
    ctx.save();
    ctx.beginPath();ctx.arc(mx+miniSize/2,my+miniSize*0.6,miniSize*0.55,Math.PI,0);ctx.closePath();
    ctx.clip();
    ctx.drawImage(fld,mx,my,miniSize,miniSize);
    ctx.drawImage(hit,mx,my,miniSize,miniSize);
    ctx.restore();
    // 테두리
    ctx.strokeStyle='rgba(75,140,245,.3)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(mx+miniSize/2,my+miniSize*0.6,miniSize*0.55,Math.PI,0);ctx.closePath();ctx.stroke();
  }

  // 하단 워터마크
  ctx.fillStyle='rgba(255,255,255,.08)';
  ctx.fillRect(0,H-60,W,60);
  ctx.font='bold 13px "Noto Sans KR",sans-serif';
  ctx.fillStyle='rgba(75,140,245,.7)';ctx.textAlign='center';
  ctx.fillText('Powered by SprayLab',W/2,H-28);
  ctx.font='10px "JetBrains Mono",monospace';
  ctx.fillStyle='rgba(255,255,255,.2)';
  ctx.fillText('kimjeongcheol13.github.io/baseball-spray-chart',W/2,H-12);

  // 골드 포인트 라인 장식
  ctx.strokeStyle='rgba(246,194,62,.25)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(20,128);ctx.lineTo(W-20,128);ctx.stroke();
  ctx.beginPath();ctx.moveTo(20,H-68);ctx.lineTo(W-20,H-68);ctx.stroke();
}

function _drawTeamCard(){
  var cvs=document.getElementById('cardPreviewCanvas');
  if(!cvs)return;
  var W=540,H=540;
  cvs.width=W;cvs.height=H;
  cvs.style.width='100%';cvs.style.maxHeight='500px';cvs.style.objectFit='contain';
  var ctx=cvs.getContext('2d');

  var bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#09090f');bg.addColorStop(1,'#0d1525');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  var ht=document.getElementById('tHome')?document.getElementById('tHome').value||'홈':' 홈';
  var at=document.getElementById('tAway')?document.getElementById('tAway').value||'원정':'원정';

  // 팀명 + 스코어
  ctx.textAlign='center';
  ctx.font='bold 13px "Noto Sans KR",sans-serif';
  ctx.fillStyle='rgba(255,255,255,.4)';
  ctx.fillText(new Date().toLocaleDateString('ko-KR'),W/2,30);

  ctx.font='bold 20px "Noto Sans KR",sans-serif';
  ctx.fillStyle='#eef0f8';
  ctx.textAlign='left';ctx.fillText(ht,36,72);
  ctx.textAlign='right';ctx.fillText(at,W-36,72);

  ctx.font='bold 60px "Bebas Neue",sans-serif';
  ctx.fillStyle='#2dd4a0';ctx.textAlign='left';ctx.fillText(AS.hs,36,130);
  ctx.fillStyle='rgba(255,255,255,.2)';ctx.textAlign='center';ctx.fillText(':',W/2,130);
  ctx.fillStyle='#f56565';ctx.textAlign='right';ctx.fillText(AS.as,W-36,130);

  ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(20,145);ctx.lineTo(W-20,145);ctx.stroke();

  // 팀 타격 통계
  var homeAbs=AS.abs.filter(function(a){return (a.team||'home')==='home';});
  var awayAbs=AS.abs.filter(function(a){return (a.team||'home')==='away';});
  var hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
  function calc(arr){
    var ab=arr.filter(function(a){return !noab.includes(a.res);}).length;
    var h=arr.filter(function(a){return hits.includes(a.res);}).length;
    var bb=arr.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
    var tb=arr.reduce(function(s,a){var bm={'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};return s+(bm[a.res]||0);},0);
    var obp=arr.length?(h+bb)/arr.length:0,slg=ab?tb/ab:0;
    return {ab:ab,h:h,avg:ab?h/ab:0,obp:obp,slg:slg,ops:obp+slg};
  }
  var hStats=calc(homeAbs),aStats=calc(awayAbs);
  var fmt3=function(v){return '.'+Math.round(v*1000).toString().padStart(3,'0');};
  var statLabels=['AVG','OBP','SLG','OPS'];
  var hVals=[hStats.avg,hStats.obp,hStats.slg,hStats.ops];
  var aVals=[aStats.avg,aStats.obp,aStats.slg,aStats.ops];
  var scols=['#f6c23e','#2dd4a0','#4b8cf5','#a78bfa'];

  statLabels.forEach(function(l,i){
    var x=68+i*103;
    ctx.font='bold 9px "JetBrains Mono",monospace';
    ctx.fillStyle=scols[i];ctx.textAlign='center';
    ctx.fillText(l,x,168);
    ctx.font='bold 16px "JetBrains Mono",monospace';
    ctx.fillStyle='#eef0f8';
    ctx.fillText(fmt3(hVals[i]),x,190);
    ctx.fillStyle='rgba(255,255,255,.3)';
    ctx.fillText(fmt3(aVals[i]),x,208);
  });

  ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(20,220);ctx.lineTo(W-20,220);ctx.stroke();

  // 선수별 성적 리스트 (최대 9명)
  var allLP=[...AS.home_lineup,...AS.away_lineup];
  var hitsArr=['안타','내야안타','2루타','3루타','홈런'];
  var players=allLP.map(function(p){
    var pa=AS.abs.filter(function(a){return a.bid===p.id;});
    var ab=pa.filter(function(a){return !noab.includes(a.res);}).length;
    var h2=pa.filter(function(a){return hitsArr.includes(a.res);}).length;
    return {name:p.name,num:p.num,ab:ab,h:h2,avg:ab?h2/ab:0};
  }).filter(function(p){return p.ab>0;}).sort(function(a,b){return b.avg-a.avg;}).slice(0,9);

  if(players.length){
    ctx.font='bold 9px "Noto Sans KR",sans-serif';
    ctx.fillStyle='rgba(255,255,255,.25)';ctx.textAlign='left';ctx.fillText('선수',20,240);
    ctx.textAlign='right';ctx.fillText('H/AB',W-20,240);ctx.fillText('AVG',W-74,240);

    players.forEach(function(p,i){
      var y=258+i*30;
      ctx.font=(i===0?'bold ':'')+'13px "Noto Sans KR",sans-serif';
      ctx.fillStyle=i===0?'#f6c23e':'#eef0f8';ctx.textAlign='left';
      ctx.fillText('#'+p.num+' '+p.name,20,y);
      ctx.font='12px "JetBrains Mono",monospace';
      ctx.fillStyle='rgba(255,255,255,.4)';ctx.textAlign='right';
      ctx.fillText(p.h+'/'+p.ab,W-20,y);
      ctx.fillStyle=p.avg>=0.3?'#2dd4a0':p.avg>=0.25?'#f6c23e':'#94a3b8';
      ctx.fillText(fmt3(p.avg),W-74,y);
    });
  }else{
    ctx.font='12px "Noto Sans KR",sans-serif';
    ctx.fillStyle='rgba(255,255,255,.2)';ctx.textAlign='center';
    ctx.fillText('선수 기록 없음',W/2,320);
  }

  // 워터마크
  ctx.fillStyle='rgba(75,140,245,.15)';ctx.fillRect(0,H-40,W,40);
  ctx.font='bold 11px "Noto Sans KR",sans-serif';
  ctx.fillStyle='rgba(75,140,245,.6)';ctx.textAlign='center';
  ctx.fillText('Powered by SprayLab',W/2,H-14);
}

function _roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

// exportShareCard를 카드 미리보기로 교체
function exportShareCard(){openCardPreview();}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   앱 홈 화면 (APP WELCOME SCREEN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function showAppWelcome(){
  var el=document.getElementById('appWelcome');
  if(!el)return;
  el.classList.remove('hidden');
  renderAwRecent();
  // 홈으로 돌아왔을 때 복구 배너 재확인
  setTimeout(function(){
    var banner=document.getElementById('archRecoveryBanner');
    if(!banner)return;
    if(storageManager.hasRecovery()&&!(AS.abs&&AS.abs.length>0)){
      banner.classList.remove('arch-rec-hidden');
    }
  },200);
}

function hideAppWelcome(){
  var el=document.getElementById('appWelcome');
  if(el)el.classList.add('hidden');
  // 게임 화면으로 전환 시 복구 배너를 즉시 숨김
  var banner=document.getElementById('archRecoveryBanner');
  if(banner)banner.classList.add('arch-rec-hidden');
}

function renderAwRecent(){
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  var el=document.getElementById('awRecent');
  if(!el)return;
  if(!saves.length){
    el.innerHTML='<div class="aw-empty">아직 저장된 경기가 없습니다.<br>첫 경기를 기록해보세요!</div>';
    return;
  }
  var recent=[...saves].reverse();
  var html='<div class="aw-recent-title">최근 경기</div><div class="aw-recent-scroll">';
  recent.forEach(function(s){
    var raw=localStorage.getItem(s.key);
    if(!raw)return;
    var d=JSON.parse(raw);
    var score=(d.hs||0)+' : '+(d.as||0);
    var title=_escHtml(_gameTitle(d.th,d.ta,d.ts));
    var date=_escHtml(d.d||'');
    html+='<div class="aw-recent-item" onclick="loadRecentGame(\''+s.key+'\')">'
      +'<div class="aw-ri-icon">⚾</div>'
      +'<div class="aw-ri-body"><div class="aw-ri-label">'+title+'</div><div class="aw-ri-date">'+date+'</div></div>'
      +'<div class="aw-ri-score">'+score+'</div>'
      +'<button class="aw-ri-del" onclick="event.stopPropagation();deleteRecentGame(\''+s.key+'\')" title="삭제">✕</button>'
      +'</div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

// ── Savant 탭 전환 (nav 버튼 onclick 핸들러) ──
function switchSavantView(view, btn){
  // 이중 클릭(onclick + initSavantNav 이벤트 리스너) 방지
  if(switchSavantView._lock)return;
  switchSavantView._lock=true;
  setTimeout(function(){delete switchSavantView._lock;},300);

  var nav=document.getElementById('savantNav');
  if(nav)nav.querySelectorAll('.savant-nav-btn').forEach(function(b){b.classList.remove('active');});
  if(btn)btn.classList.add('active');
  var ap=document.getElementById('app-page');

  if(view==='record'||view==='spray'){
    document.querySelectorAll('.savant-view').forEach(function(v){v.classList.remove('active');});
    if(ap)ap.style.display='flex';
    document.body.style.overflowY='hidden';
    if(view==='spray'){
      var sprayTab=(window.AS&&window.AS.batter)?'batter':'stat';
      var sprayEl=document.getElementById('tab-'+sprayTab);
      if(window.swTab&&sprayEl)window.swTab(sprayTab,sprayEl);
      if(window.drawField)window.drawField();
      if(window.safeRender)window.safeRender();
    }
    return;
  }

  // 프로필/비교/스카우트: app-page 숨김, 해당 view 활성화 후 비동기로 데이터 로드
  if(ap)ap.style.display='none';
  document.body.style.overflowY='';
  document.querySelectorAll('.savant-view').forEach(function(v){v.classList.remove('active');});
  var viewEl=document.getElementById(view+'View');if(viewEl)viewEl.classList.add('active');
  // 탭 전환이 즉시 반응하도록 데이터 로드는 다음 태스크로 defer
  var _v=view;
  setTimeout(function(){
    switch(_v){
      case 'profile': if(window.openProfileView)window.openProfileView();break;
      case 'compare': if(window.openCompareView)window.openCompareView();break;
      case 'scout':   if(window.openScoutView)window.openScoutView();break;
    }
  },0);
}

// ── 최근 경기 삭제 ──
function deleteRecentGame(key){
  if(!confirm('이 경기를 삭제할까요?'))return;
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  saves=saves.filter(function(s){return s.key!==key;});
  localStorage.setItem('sl_saves',JSON.stringify(saves));
  localStorage.removeItem(key);
  if(window.cloudDelete)cloudDelete(key);
  renderAwRecent();
}

function loadRecentGame(key){
  hideAppWelcome();
  restoreGame(key);
  showToast('경기를 불러왔습니다 ✓',false);
}

function _escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _gameTitle(th,ta,ts){
  var h=(th||'').trim(),a=(ta||'').trim();
  if((!h||h==='홈팀')&&(!a||a==='원정팀')){
    var dt=typeof ts==='number'?new Date(ts):(ts?new Date(ts):new Date());
    if(isNaN(dt.getTime()))return (ts?String(ts)+' ':'')+'경기';
    return dt.getFullYear()+'.'+(('0'+(dt.getMonth()+1)).slice(-2))+'.'+(('0'+dt.getDate()).slice(-2))+' 경기';
  }
  return (h||'홈팀')+' vs '+(a||'원정팀');
}
function _fmtTs(ts){
  if(!ts)return '';
  var dt=new Date(typeof ts==='number'?ts:ts);
  if(isNaN(dt.getTime()))return typeof ts==='string'?ts:'';
  return dt.getFullYear()+'.'+(('0'+(dt.getMonth()+1)).slice(-2))+'.'+(('0'+dt.getDate()).slice(-2));
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   경기 시작 마법사 (GAME START WIZARD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function openGameWizard(){
  var el=document.getElementById('gameWizard');
  if(!el)return;
  // 이전 경기 팀명 자동완성 힌트
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  if(saves.length){
    var last=localStorage.getItem(saves[saves.length-1].key);
    if(last){
      var ld=JSON.parse(last);
      var hi=document.getElementById('gwHome');
      var ai=document.getElementById('gwAway');
      if(hi&&!hi.value)hi.placeholder=ld.th||'홈팀';
      if(ai&&!ai.value)ai.placeholder=ld.ta||'원정팀';
    }
  }
  el.classList.add('show');
  setTimeout(function(){var h=document.getElementById('gwHome');if(h)h.focus();},200);
}

function closeGameWizard(){
  var el=document.getElementById('gameWizard');
  if(el)el.classList.remove('show');
}

function startFromWizard(){
  var homeInp=document.getElementById('gwHome');
  var awayInp=document.getElementById('gwAway');
  var home=(homeInp&&homeInp.value.trim())||homeInp.placeholder||'홈팀';
  var away=(awayInp&&awayInp.value.trim())||awayInp.placeholder||'원정팀';
  document.getElementById('tHome').value=home;
  document.getElementById('tAway').value=away;
  closeGameWizard();
  hideAppWelcome();
  if(homeInp)homeInp.value='';
  if(awayInp)awayInp.value='';
  // 이전 라인업이 대기 중이면 적용
  if(AS._pendingHomeLineup){
    AS.home_lineup=AS._pendingHomeLineup.slice();
    delete AS._pendingHomeLineup;
  }
  if(AS._pendingAwayLineup){
    AS.away_lineup=AS._pendingAwayLineup.slice();
    delete AS._pendingAwayLineup;
  }
  renderLP();renderMob();
  // Ensure field canvas is drawn after overlays are dismissed
  requestAnimationFrame(function(){
    var w=document.getElementById('cwrap');
    if(!w)return;
    var nw=w.clientWidth||w.offsetWidth;
    if(nw&&nw!==FS){FS=nw;if(fC){fC.width=FS;fC.height=FS;}if(hC){hC.width=FS;hC.height=FS;}if(oC){oC.width=FS;oC.height=FS;}}
    drawField();safeRender();
  });
  _gameSaved=true;_saveReminderShown=false;_startSaveReminderTimer();
  var hasLineup=(AS.home_lineup.length||AS.away_lineup.length);
  showToast(hasLineup?'이전 라인업을 불러왔습니다. 바로 기록하세요':'경기를 시작합니다. 라인업 등록 후 타자를 선택하세요',false);
}

function gwAutoComplete(team,val){
  var listId=team==='home'?'gwHomeAc':'gwAwayAc';
  var list=document.getElementById(listId);
  if(!list)return;
  if(!val.trim()){list.classList.remove('show');return;}
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  var names=new Set();
  saves.forEach(function(s){
    var raw=localStorage.getItem(s.key);
    if(!raw)return;
    var d=JSON.parse(raw);
    var v=val.toLowerCase();
    if(d.th&&d.th.toLowerCase().includes(v))names.add(d.th);
    if(d.ta&&d.ta.toLowerCase().includes(v))names.add(d.ta);
  });
  if(!names.size){list.classList.remove('show');return;}
  list.innerHTML=Array.from(names).slice(0,5).map(function(n){
    return '<div class="gw-ac-item" onmousedown="gwPickTeam(\''+team+'\',this.textContent)">'+_escHtml(n)+'</div>';
  }).join('');
  list.classList.add('show');
}

function gwPickTeam(team,name){
  var id=team==='home'?'gwHome':'gwAway';
  var inp=document.getElementById(id);
  if(inp)inp.value=name;
  var listId=team==='home'?'gwHomeAc':'gwAwayAc';
  var list=document.getElementById(listId);
  if(list)list.classList.remove('show');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   도움말 모달 (FULL HELP MODAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function showHelpModal(){
  var old=document.getElementById('helpMenuPop');
  if(old)old.remove();
  var el=document.getElementById('helpModal');
  if(el)el.classList.add('show');
}

function closeHelpModal(){
  var el=document.getElementById('helpModal');
  if(el)el.classList.remove('show');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   도움말 모드 (INTERACTIVE HELP MODE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
var _helpModeActive=false;
function toggleHelpMode(){
  _helpModeActive=!_helpModeActive;
  document.body.classList.toggle('help-mode',_helpModeActive);
  var btn=document.getElementById('helpModeBtn');
  var ind=document.getElementById('helpModeIndicator');
  if(btn)btn.classList.toggle('active',_helpModeActive);
  if(ind)ind.classList.toggle('show',_helpModeActive);
  if(_helpModeActive){
    showToast('💡 도움말 모드 ON — 궁금한 버튼이나 영역을 탭하세요',false,true);
    document.addEventListener('click',_helpModeClick,true);
  }else{
    closeHelpModeTooltip();
    document.removeEventListener('click',_helpModeClick,true);
  }
}
function _helpModeClick(e){
  var el=e.target.closest('[data-help]');
  if(!el)return;
  e.preventDefault();
  e.stopPropagation();
  showHelpModeTooltip(
    el.getAttribute('data-help-title')||el.getAttribute('title')||'설명',
    el.getAttribute('data-help')
  );
}
function showHelpModeTooltip(title,desc){
  var t=document.getElementById('helpModeTooltip');
  var ti=document.getElementById('hmtTitle');
  var td=document.getElementById('hmtDesc');
  if(!t)return;
  if(ti)ti.textContent=title;
  if(td)td.innerHTML=desc||'';
  t.classList.add('show');
}
function closeHelpModeTooltip(){
  var t=document.getElementById('helpModeTooltip');
  if(t)t.classList.remove('show');
}

function toggleHelpCard(idx){
  var body=document.getElementById('hmc'+idx);
  if(!body)return;
  var header=body.previousElementSibling;
  var isOpen=body.classList.contains('hm-open');
  // 다른 카드 모두 닫기
  for(var i=0;i<7;i++){
    var b=document.getElementById('hmc'+i);
    if(b){
      b.classList.remove('hm-open');
      if(b.previousElementSibling)b.previousElementSibling.classList.remove('hm-open');
    }
  }
  if(!isOpen){body.classList.add('hm-open');if(header)header.classList.add('hm-open');}
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   저장 버튼 피드백 애니메이션
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function triggerSavePulse(){
  var btn=document.querySelector('.btn-primary[onclick="saveGame()"]');
  if(!btn)return;
  btn.classList.remove('save-pulse-anim');
  void btn.offsetWidth;
  btn.classList.add('save-pulse-anim');
  setTimeout(function(){btn.classList.remove('save-pulse-anim');},700);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 패턴 분석 (generateBattingInsights / renderAIInsights)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateBattingInsights(bAbs){
  var insights=[];
  if(bAbs.length<2)return insights;
  var oab=bAbs.filter(function(a){return!_NOAB.includes(a.res);}).length;
  if(!oab)return insights;
  var h=bAbs.filter(function(a){return _HITS.includes(a.res);}).length;
  var avg=h/oab;
  var k=bAbs.filter(function(a){return a.res==='삼진';}).length;
  var bb=bAbs.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
  var xbh=bAbs.filter(function(a){return['2루타','3루타','홈런'].includes(a.res);}).length;
  var fd=bAbs.filter(function(a){return a.deg!=null;}),tot=fd.length||1;
  var pull=fd.filter(function(a){return a.deg<72;}).length;
  var oppo=fd.filter(function(a){return a.deg>108;}).length;
  var pullR=pull/tot,oppoR=oppo/tot;

  // 타율 평가
  if(avg>=0.4)insights.push({type:'pos',icon:'🔥',text:'타율 '+avg.toFixed(3).replace('0.','.')+'로 오늘 폼이 아주 좋습니다!'});
  else if(avg>=0.25)insights.push({type:'neu',icon:'📊',text:'타율 '+avg.toFixed(3).replace('0.','.')+'로 무난한 경기 중입니다.'});
  else if(oab>=3)insights.push({type:'warn',icon:'📉',text:'타율 '+avg.toFixed(3).replace('0.','.')+'로 부진 중. 타이밍 조정이 필요해 보입니다.'});

  // 삼진 비율
  var kRate=k/bAbs.length;
  if(kRate>=0.5&&k>=2)insights.push({type:'warn',icon:'⚡',text:'삼진 비율 '+Math.round(kRate*100)+'% — 스트라이크 존 공략을 재점검하세요.'});

  // 볼넷 선구안
  if(bb>=2)insights.push({type:'pos',icon:'👁️',text:'볼넷 '+bb+'개! 선구안이 뛰어납니다. 참을성 있는 타격입니다.'});

  // 장타력
  if(xbh>=2)insights.push({type:'pos',icon:'💥',text:'장타 '+xbh+'개! 강한 타구를 만들어내고 있습니다.'});

  // 방향 편중
  if(pullR>=0.75&&pull>=3)insights.push({type:'warn',icon:'↩️',text:'타구의 '+Math.round(pullR*100)+'%가 당겨치기 — 반대 방향 공략에 취약할 수 있습니다.'});
  else if(oppoR>=0.65&&oppo>=3)insights.push({type:'pos',icon:'↪️',text:'밀어치기 비율 '+Math.round(oppoR*100)+'% — 밀어치는 능력이 좋습니다.'});

  // 안타 없이 출루
  if(h===0&&bb>=1&&oab>=2)insights.push({type:'neu',icon:'🏃',text:'안타는 없지만 볼넷으로 출루 중. 투수를 괴롭히고 있습니다.'});

  return insights.slice(0,4);
}

function renderAIInsights(bAbs){
  var el=document.getElementById('aiInsightList');
  if(!el)return;
  var insights=generateBattingInsights(bAbs);
  if(!insights.length){
    el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">2타석 이상 기록하면 분석합니다</div>';
    return;
  }
  var typeColors={pos:'#2dd4a0',warn:'#f6c23e',neu:'var(--border2)'};
  el.innerHTML=insights.map(function(ins,i){
    return'<div class="ai-card ai-'+ins.type+'" style="display:flex;align-items:flex-start;gap:8px;padding:9px 10px;background:var(--bg-raised);border-radius:8px;border-left:3px solid '+typeColors[ins.type]+';animation-delay:'+i*60+'ms">'
      +'<span class="ai-icon">'+ins.icon+'</span>'
      +'<span class="ai-text">'+ins.text+'</span>'
      +'</div>';
  }).join('');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 직전 타석 반복 기록
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function recallLastAtBat(){
  if(!AS.batter){showToast('타자를 먼저 선택하세요',true);return;}
  var last=AS.abs.slice().reverse().find(function(a){return a.bid===AS.batter.id;});
  if(!last){showToast('이전 타석 기록이 없습니다',true);return;}
  var inn=document.getElementById('innSel');
  var ab={id:Date.now(),bid:AS.batter.id,bname:AS.batter.name,bnum:AS.batter.num,team:AS.curTeam,
    res:last.res,pt:last.pt||null,zone:last.zone||null,rbi:0,
    x:last.x,y:last.y,deg:last.deg,dir:last.dir,ft:last.ft,
    inn:inn?inn.value:1,ts:new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}),
    count:{b:AS.balls,s:AS.strikes,o:AS.outs},pitches:[]};
  AS.abs.push(ab);
  updateAll();scheduleAutoSave();
  showToast('↩ 반복 기록: '+last.res,false);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 이전 라인업 불러오기
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function applyLastLineup(){
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  if(!saves.length){showToast('저장된 경기가 없습니다',true);return;}
  var last=saves[saves.length-1];
  var raw=localStorage.getItem(last.key);
  if(!raw){showToast('데이터를 불러올 수 없습니다',true);return;}
  var data=JSON.parse(raw);
  if(data.home_lineup&&data.home_lineup.length){
    AS._pendingHomeLineup=data.home_lineup.map(function(p){return Object.assign({},p,{id:Date.now()+Math.random()});});
  }
  if(data.away_lineup&&data.away_lineup.length){
    AS._pendingAwayLineup=data.away_lineup.map(function(p){return Object.assign({},p,{id:Date.now()+Math.random()});});
  }
  var homeCount=(AS._pendingHomeLineup||[]).length;
  var awayCount=(AS._pendingAwayLineup||[]).length;
  showToast('라인업 '+homeCount+'명 + '+awayCount+'명 준비 완료. 기록 시작을 누르세요',false);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 경기 저장 후 요약 모달
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function showGameSummary(){
  var ov=document.getElementById('gameSummaryOv');
  var card=document.getElementById('gameSummaryCard');
  if(!ov||!card)return;
  var abs=AS.abs;
  var oab=abs.filter(function(a){return!_NOAB.includes(a.res);}).length||1;
  var h=abs.filter(function(a){return _HITS.includes(a.res);}).length;
  var bb=abs.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
  var k=abs.filter(function(a){return a.res==='삼진';}).length;
  var rbi=abs.reduce(function(s,a){return s+a.rbi;},0);
  var tb=abs.reduce(function(s,a){return s+(_BASE[a.res]||0);},0);
  var avg=oab>0?h/oab:0;
  var obp=abs.length>0?(h+bb)/abs.length:0;
  var slg=oab>0?tb/oab:0;
  var th=document.getElementById('tHome').value||'홈팀';
  var ta=document.getElementById('tAway').value||'원정팀';
  var mvpAbs={};
  abs.forEach(function(a){if(!mvpAbs[a.bid])mvpAbs[a.bid]={name:a.bname,h:0,rbi:0};if(_HITS.includes(a.res))mvpAbs[a.bid].h++;mvpAbs[a.bid].rbi+=a.rbi;});
  var mvpEntry=Object.values(mvpAbs).sort(function(a,b){return(b.h*2+b.rbi)-(a.h*2+a.rbi);})[0];
  var mvpText=mvpEntry?mvpEntry.name+' ('+(mvpEntry.h)+'안타 '+mvpEntry.rbi+'타점)':'기록 없음';
  card.innerHTML=
    '<div class="gs-title">경기 종료 🎉</div>'
    +'<div class="gs-sub">'+th+' '+AS.hs+' : '+AS.as+' '+ta+'</div>'
    +'<div class="gs-stat-row">'
    +'<div class="gs-stat"><div class="gs-val">'+avg.toFixed(3).replace('0.','.')+'</div><div class="gs-lbl">팀 타율</div></div>'
    +'<div class="gs-stat"><div class="gs-val">'+obp.toFixed(3).replace('0.','.')+'</div><div class="gs-lbl">출루율</div></div>'
    +'<div class="gs-stat"><div class="gs-val">'+slg.toFixed(3).replace('0.','.')+'</div><div class="gs-lbl">장타율</div></div>'
    +'</div>'
    +'<div class="gs-stat-row">'
    +'<div class="gs-stat"><div class="gs-val">'+h+'</div><div class="gs-lbl">안타</div></div>'
    +'<div class="gs-stat"><div class="gs-val">'+rbi+'</div><div class="gs-lbl">타점</div></div>'
    +'<div class="gs-stat"><div class="gs-val">'+k+'</div><div class="gs-lbl">삼진</div></div>'
    +'</div>'
    +(mvpEntry?'<div class="gs-highlight"><div class="gs-hl-text">🏆 오늘의 MVP<br><b>'+_escHtml(mvpText)+'</b></div></div>':'')
    +'<div class="gs-btn-row">'
    +'<button class="gs-btn-ok" onclick="closeGameSummary()">확인</button>'
    +'<button class="gs-btn-share" onclick="closeGameSummary();exportShareCard()">📊 카드 공유</button>'
    +'</div>';
  ov.classList.add('show');
}
function closeGameSummary(){
  var ov=document.getElementById('gameSummaryOv');
  if(ov)ov.classList.remove('show');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FAB 퀵 액션
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var _fabOpen=false;
function fabToggle(){
  _fabOpen=!_fabOpen;
  var pop=document.getElementById('fabPop');
  var btn=document.getElementById('fabBtn');
  if(pop)pop.classList.toggle('open',_fabOpen);
  if(btn)btn.style.transform=_fabOpen?'rotate(45deg)':'';
}
function fabRecord(res){
  if(!AS.batter){showToast('타자를 먼저 선택하세요',true);return;}
  var inn=document.getElementById('innSel');
  var ts=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  var ab={id:Date.now(),bid:AS.batter.id,bname:AS.batter.name,bnum:AS.batter.num,team:AS.curTeam,
    res:res,pt:AS.pt||null,zone:AS.zone||null,rbi:AS.rbi||0,
    x:null,y:null,deg:null,dir:null,ft:null,
    inn:inn?inn.value:1,ts:ts,
    count:{b:AS.balls,s:AS.strikes,o:AS.outs},pitches:[]};
  AS.abs.push(ab);
  updateAll();scheduleAutoSave();
  showToast(res+' 기록됨',true);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GAME FLOW MODE — 경기 운영 모드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var GF={
  active:false,
  inning:1,        // 현재 이닝 번호
  half:'top',      // 'top'=초(홈팀 공격), 'bottom'=말(원정팀 공격)
  outs:0,          // 현재 아웃카운트 0~2
  batterIdx:0,     // 현재 타순 인덱스 (라인업 내)
  bases:[false,false,false] // [1루,2루,3루]
};

// ─── 모드 ON/OFF ───
function gfToggle(){GF.active?gfDeactivate():gfActivate();}

function gfActivate(){
  GF.active=true;
  GF.inning=1;GF.half='top';GF.outs=0;GF.batterIdx=0;
  GF.bases=[false,false,false];
  // 현재 공격팀 첫 타자 자동 선택
  var lu=gfGetLineup();
  if(lu.length) selBatter(lu[0].id);
  gfSyncInnSel();
  var bar=document.getElementById('gfBar');
  if(bar)bar.classList.add('active');
  var btn=document.getElementById('gfToggleBtn');
  if(btn){btn.classList.add('on');btn.textContent='■ 운영중';}
  // 이닝 셀렉터 비활성화 (GF가 자동 관리)
  var ap=document.getElementById('app-page');
  if(ap)ap.classList.add('gf-on');
  gfUpdateBar();
  showToast('경기 운영 모드 시작 — 기록 시 타순·아웃카운트가 자동으로 진행됩니다',false,true);
}

function gfDeactivate(){
  GF.active=false;
  var bar=document.getElementById('gfBar');
  if(bar)bar.classList.remove('active');
  var btn=document.getElementById('gfToggleBtn');
  if(btn){btn.classList.remove('on');btn.textContent='▶ 경기운영';}
  var ap=document.getElementById('app-page');
  if(ap)ap.classList.remove('gf-on');
}

// ─── 유틸 ───
function gfGetLineup(){
  return GF.half==='top'?AS.home_lineup:AS.away_lineup;
}
function gfInnStr(){
  return GF.inning+'회'+(GF.half==='top'?'초':'말');
}
function gfSyncInnSel(){
  var s=document.getElementById('innSel');
  if(!s)return;
  var t=gfInnStr();
  for(var i=0;i<s.options.length;i++){
    if(s.options[i].text===t||s.options[i].value===t){s.value=s.options[i].value;break;}
  }
  var d=document.getElementById('innDisp');
  if(d)d.textContent=t;
}

// ─── 상태 바 갱신 ───
function gfUpdateBar(){
  if(!GF.active)return;
  var inn=document.getElementById('gfbInn');
  if(inn)inn.textContent=gfInnStr();
  var o0=document.getElementById('gfbO0'),o1=document.getElementById('gfbO1');
  if(o0)o0.classList.toggle('on',GF.outs>=1);
  if(o1)o1.classList.toggle('on',GF.outs>=2);
  var b1=document.getElementById('gfbB1'),b2=document.getElementById('gfbB2'),b3=document.getElementById('gfbB3');
  if(b1)b1.classList.toggle('on',GF.bases[0]);
  if(b2)b2.classList.toggle('on',GF.bases[1]);
  if(b3)b3.classList.toggle('on',GF.bases[2]);
  var lu=gfGetLineup();
  var idx=lu.length?GF.batterIdx%lu.length:0;
  var bEl=document.getElementById('gfbBatter');
  if(bEl){
    var p=lu[idx];
    bEl.textContent=p?(idx+1)+'번 #'+p.num+' '+p.name:'타자 없음';
  }
  var sc=document.getElementById('gfbScore');
  if(sc)sc.textContent=AS.hs+':'+AS.as;
}

// ─── 기록 후 자동화 처리 ───
// recHit / recOther 직후 호출
function gfAfterRecord(res,rbi){
  if(!GF.active)return;
  // 베이스 진루 및 득점 계산
  var scored=gfUpdateBases(res,rbi);
  // 득점 스코어 반영
  if(scored>0){
    if(GF.half==='top'){AS.hs+=scored;var h=document.getElementById('scH');if(h)h.textContent=AS.hs;}
    else{AS.as+=scored;var a=document.getElementById('scA');if(a)a.textContent=AS.as;}
  }
  // 아웃 처리
  var outCount=res==='병살'?2:_GF_IS_OUT(res)?1:0;
  if(outCount>0){
    GF.outs+=outCount;
    if(GF.outs>=3){
      GF.outs=0;
      GF.bases=[false,false,false];
      gfNextHalf();
      return; // gfNextHalf에서 타자 처리
    }
  }
  // 다음 타자 이동
  gfNextBatter();
  // UI 갱신 (requestAnimationFrame으로 불필요 중복 렌더 방지)
  requestAnimationFrame(function(){gfUpdateBar();gfSyncInnSel();});
}

function _GF_IS_OUT(res){
  return['삼진','플라이 아웃','땅볼 아웃','희타','희비','병살'].includes(res);
}

// ─── 아웃 & 이닝 전환 ───
function gfNextHalf(){
  if(GF.half==='top'){GF.half='bottom';}
  else{GF.half='top';GF.inning++;}
  GF.batterIdx=0;
  // 공수 전환: 공격팀 탭 자동 전환
  var nextTeam=GF.half==='top'?'home':'away';
  AS.curTeam=nextTeam;
  swLineupTab(nextTeam);
  var lu=gfGetLineup();
  if(lu.length)selBatter(lu[0].id);
  requestAnimationFrame(function(){gfUpdateBar();gfSyncInnSel();});
  var halfTxt=GF.half==='top'?'초':'말';
  setTimeout(function(){
    showToast('3아웃 — '+GF.inning+'회'+halfTxt+' 공격 시작 ⚾',false,true);
  },80);
}

// ─── 다음 타자 ───
function gfNextBatter(){
  var lu=gfGetLineup();
  if(!lu.length)return;
  GF.batterIdx=(GF.batterIdx+1)%lu.length;
  var p=lu[GF.batterIdx];
  if(p)selBatter(p.id);
}

// ─── 베이스 진루 로직 ───
// 반환값: 이번 플레이로 홈인한 득점 수
function gfUpdateBases(res,rbi){
  var b=GF.bases; // [1루,2루,3루]
  var scored=0;

  if(res==='홈런'){
    scored=b.filter(Boolean).length+1; // 주자+타자
    GF.bases=[false,false,false];
    return scored;
  }
  if(res==='3루타'){
    scored=b.filter(Boolean).length;
    GF.bases=[false,false,true];
    return scored;
  }
  if(res==='2루타'){
    if(b[2])scored++;   // 3루 → 홈
    if(b[1])scored++;   // 2루 → 홈
    var r3=b[0];        // 1루 → 3루
    GF.bases=[false,true,r3];
    return scored;
  }
  if(res==='안타'||res==='내야안타'){
    if(b[2])scored++;   // 3루 → 홈
    GF.bases=[true,b[0],b[1]]; // 타자→1루, 1루→2루, 2루→3루
    return scored;
  }
  if(res==='볼넷'||res==='사구'){
    // 밀어내기 볼넷
    if(b[0]&&b[1]&&b[2])scored=1;
    var n3=b[0]&&b[1]?true:b[2];
    var n2=b[0]?true:b[1];
    GF.bases=[true,n2,n3];
    return scored;
  }
  if(res==='희비'){
    // 희생플라이: 3루 주자 홈
    if(b[2]){scored++;GF.bases[2]=false;}
    return scored;
  }
  // 아웃 계열 — 베이스 변화 없음 (사회인야구 단순화)
  return 0;
}

// ─── 경기 종료 ───
function gfEndConfirm(){
  if(confirm('경기를 종료하고 최종 요약을 확인할까요?'))gfEndGame();
}
function gfEndGame(){
  gfDeactivate();
  setTimeout(showPostGameReport,300);
}

// ─── 종료 카드 빌드 ───
function gfShowEndCard(){
  var ov=document.getElementById('gfEndOv');
  var card=document.getElementById('gfeCard');
  if(!ov||!card)return;

  var abs=AS.abs;
  var th=document.getElementById('tHome').value||'홈팀';
  var ta=document.getElementById('tAway').value||'원정팀';
  var date=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});

  // 통계 계산 (_NOAB,_HITS,_BASE 재사용)
  var oab=abs.filter(function(a){return!_NOAB.includes(a.res);}).length||1;
  var h=abs.filter(function(a){return _HITS.includes(a.res);}).length;
  var bb=abs.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
  var k=abs.filter(function(a){return a.res==='삼진';}).length;
  var hr=abs.filter(function(a){return a.res==='홈런';}).length;
  var rbi=abs.reduce(function(s,a){return s+a.rbi;},0);
  var tb=abs.reduce(function(s,a){return s+(_BASE[a.res]||0);},0);
  var avg=oab>0?h/oab:0;
  var obp=abs.length>0?(h+bb)/abs.length:0;
  var slg=oab>0?tb/oab:0;

  // 주요 타구 방향
  var dabs=abs.filter(function(a){return a.deg!=null;});
  var pull=dabs.filter(function(a){return a.deg<72;}).length;
  var ctr=dabs.filter(function(a){return a.deg>=72&&a.deg<=108;}).length;
  var oppo=dabs.filter(function(a){return a.deg>108;}).length;
  var mainDir=dabs.length?(pull>=ctr&&pull>=oppo?'당겨치기':ctr>=oppo?'센터':'밀어치기'):null;

  // MVP 계산
  var mvpMap={};
  abs.forEach(function(a){
    if(!mvpMap[a.bid])mvpMap[a.bid]={name:a.bname,h:0,rbi:0,hr:0};
    if(_HITS.includes(a.res))mvpMap[a.bid].h++;
    mvpMap[a.bid].rbi+=a.rbi;
    if(a.res==='홈런')mvpMap[a.bid].hr++;
  });
  var mvp=Object.values(mvpMap).sort(function(a,b){
    return(b.h*2+b.rbi*1.5+b.hr*3)-(a.h*2+a.rbi*1.5+a.hr*3);
  })[0];

  var comment=_gfComment(h,hr,k,bb,avg,mainDir,AS.hs,AS.as);
  var fmt=function(v){return v.toFixed(3).replace('0.','.');};

  card.innerHTML=
    '<div class="gfe-header">'
    +'<div class="gfe-badge">GAME OVER</div>'
    +'<div class="gfe-title">'+_escHtml(th)+' vs '+_escHtml(ta)+'</div>'
    +'<div class="gfe-score">'+AS.hs+' : '+AS.as+'</div>'
    +'<div class="gfe-teams">'+_escHtml(date)+'</div>'
    +'</div>'
    +'<div class="gfe-divider"></div>'
    +'<div class="gfe-stats">'
    +'<div class="gfe-stat"><div class="gfe-sv">'+fmt(avg)+'</div><div class="gfe-sl">팀 타율</div></div>'
    +'<div class="gfe-stat"><div class="gfe-sv">'+h+'</div><div class="gfe-sl">안타</div></div>'
    +'<div class="gfe-stat"><div class="gfe-sv">'+rbi+'</div><div class="gfe-sl">타점</div></div>'
    +'<div class="gfe-stat"><div class="gfe-sv">'+hr+'</div><div class="gfe-sl">홈런</div></div>'
    +'<div class="gfe-stat"><div class="gfe-sv">'+k+'</div><div class="gfe-sl">삼진</div></div>'
    +'<div class="gfe-stat"><div class="gfe-sv">'+bb+'</div><div class="gfe-sl">볼넷</div></div>'
    +'</div>'
    +(mvp
      ?'<div class="gfe-mvp">'
        +'<div class="gfe-mvp-ttl">🏆 오늘의 MVP</div>'
        +'<div class="gfe-mvp-name">'+_escHtml(mvp.name)+'</div>'
        +'<div class="gfe-mvp-stat">'+mvp.h+'안타 · '+mvp.rbi+'타점'+(mvp.hr>0?' · '+mvp.hr+'홈런':'')+'</div>'
        +'</div>'
      :'')
    +'<div class="gfe-mini"><canvas id="gfeMini" width="110" height="110"></canvas></div>'
    +'<div class="gfe-comment">'+_escHtml(comment)+'</div>'
    +'<div class="gfe-btns">'
    +'<button class="gfe-btn gfe-btn-close" onclick="gfEndClose()">닫기</button>'
    +'<button class="gfe-btn gfe-btn-save" onclick="gfEndClose();saveGame()">💾 저장 & 요약</button>'
    +'</div>';

  ov.classList.add('show');
  // 미니 스프레이 차트는 DOM 삽입 후 requestAnimationFrame으로 그리기
  requestAnimationFrame(function(){requestAnimationFrame(_gfDrawMini);});
}

// ─── 미니 스프레이 차트 ───
function _gfDrawMini(){
  var c=document.getElementById('gfeMini');
  if(!c)return;
  var ctx=c.getContext('2d'),S=110,cx=S/2,cy=S;
  ctx.clearRect(0,0,S,S);
  var bg=ctx.createRadialGradient(cx,cy,0,cx,cy,S);
  bg.addColorStop(0,'#1f4d24');bg.addColorStop(.55,'#193f1d');bg.addColorStop(1,'#0f2010');
  ctx.beginPath();ctx.arc(cx,cy,S*.97,-Math.PI,0);ctx.lineTo(cx,cy);ctx.closePath();
  ctx.fillStyle=bg;ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=0.7;
  var br=S*.42,bps=[[cx,cy],[cx-br*.46,cy-br*.33],[cx,cy-br*.65],[cx+br*.46,cy-br*.33],[cx,cy]];
  ctx.beginPath();bps.forEach(function(p,i){i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]);});ctx.stroke();
  var RC2={'안타':'#2dd4a0','내야안타':'#5eead4','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565'};
  AS.abs.forEach(function(a){
    if(!a.x||!a.y)return;
    var x=a.x*S,y=a.y*S,col=RC2[a.res]||'#94a3b8',out=a.res.includes('아웃');
    ctx.beginPath();ctx.arc(x,y,out?1.8:3,0,Math.PI*2);
    ctx.fillStyle=col+'aa';ctx.fill();
    ctx.strokeStyle=col;ctx.lineWidth=0.7;ctx.stroke();
  });
}

// ─── 한줄 코멘트 생성 (규칙 기반) ───
function _gfComment(h,hr,k,bb,avg,mainDir,hs,as){
  var pool=[];
  if(hr>=2)pool.push('홈런 '+hr+'개! 오늘 타선의 파워가 빛났습니다.');
  else if(hr===1)pool.push('결정적인 홈런 1개가 경기의 흐름을 바꿨습니다.');
  if(avg>=0.40)pool.push('팀 타율 '+Math.round(avg*100)+'% — 오늘은 타선이 뜨거웠습니다!');
  else if(avg>=0.28)pool.push('타율 '+avg.toFixed(3).replace('0.','.')+' — 안정적인 타격 내용이었습니다.');
  else if(avg<0.15&&h>0)pool.push('타선이 고전했지만, 이 데이터로 다음 경기를 준비하세요!');
  if(mainDir==='당겨치기')pool.push('오늘은 당겨치기 타구가 집중됐습니다. 외각 공략이 관건이었습니다.');
  else if(mainDir==='밀어치기')pool.push('밀어치기 비율이 높은 경기 — 반대 방향 공략에 성공했습니다.');
  else if(mainDir==='센터')pool.push('센터 방향 강타가 돋보였습니다. 중심타선이 힘을 발휘했습니다.');
  if(bb>=4)pool.push('볼넷 '+bb+'개 — 선구안이 뛰어난 경기였습니다.');
  if(k>=6)pool.push('삼진 '+k+'개 — 상대 투수 공략이 쉽지 않았습니다.');
  if(hs>as)pool.push('🎉 우리 팀 승리! 오늘의 데이터가 다음 경기의 무기가 됩니다.');
  else if(hs<as)pool.push('아쉬운 패배, 하지만 이 스프레이 데이터로 반드시 설욕하세요!');
  else pool.push('팽팽한 접전! 오늘의 기록이 다음 경기 전략이 됩니다.');
  if(!pool.length)pool.push('오늘 경기가 SprayLab에 기록되었습니다. 다음 경기도 화이팅!');
  return pool[Math.floor(Math.random()*Math.min(2,pool.length))];
}

function gfEndClose(){
  var ov=document.getElementById('gfEndOv');
  if(ov)ov.classList.remove('show');
}

// saveGame 호출 시 GF 상태 함께 저장 (기존 saveGame 오버라이드 없이 확장)
var _origSaveGame=null;
(function(){
  var _orig=saveGame;
  saveGame=function(){
    _orig();
    // GF 상태를 별도 키로 저장 (필요 시 복원)
  };
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 오프라인 감지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function initOfflineDetection(){
  function onOffline(){showToast('오프라인 상태입니다. 데이터는 기기에 안전하게 저장됩니다',true);}
  function onOnline(){showToast('인터넷에 연결되었습니다 ✓',false);}
  window.addEventListener('offline',onOffline);
  window.addEventListener('online',onOnline);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST-GAME REPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function showPostGameReport(){
  var fade=document.getElementById('pgFade');
  var ov=document.getElementById('pgReport');
  var skel=document.getElementById('pgSkeleton');
  var card=document.getElementById('pgCard');
  if(!ov)return;
  // 1) 페이드 인
  fade.classList.add('fading');
  setTimeout(function(){
    ov.style.display='flex';
    fade.classList.remove('fading');
    skel.style.display='flex';
    card.classList.remove('up');
    // 2) 스켈레톤 → 콘텐츠 슬라이드업
    setTimeout(function(){
      _pgBuild();
      skel.style.display='none';
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){card.classList.add('up');});
      });
    },1100);
  },320);
}

function closePgReport(){
  var ov=document.getElementById('pgReport');
  var card=document.getElementById('pgCard');
  if(!ov)return;
  card.classList.remove('up');
  setTimeout(function(){ov.style.display='none';},420);
}

function _pgBuild(){
  var abs=AS.abs;
  var th=document.getElementById('tHome').value||'홈팀';
  var ta=document.getElementById('tAway').value||'원정팀';
  var date=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});

  // 헤더
  document.getElementById('pgTeams').textContent=th+' vs '+ta;
  document.getElementById('pgScore').textContent=AS.hs+' : '+AS.as;
  document.getElementById('pgDate').textContent=date;

  // 통계
  var oab=abs.filter(function(a){return!_NOAB.includes(a.res);}).length||1;
  var h=abs.filter(function(a){return _HITS.includes(a.res);}).length;
  var bb=abs.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
  var k=abs.filter(function(a){return a.res==='삼진';}).length;
  var hr=abs.filter(function(a){return a.res==='홈런';}).length;
  var rbi=abs.reduce(function(s,a){return s+(a.rbi||0);},0);
  var tb=abs.reduce(function(s,a){return s+(_BASE[a.res]||0);},0);
  var avg=h/oab;
  var fmt=function(v){return v.toFixed(3).replace('0.','.');};
  var grid=document.getElementById('pgStatGrid');
  if(grid)grid.innerHTML=[
    {v:fmt(avg),l:'타율'},{v:h,l:'안타'},{v:rbi,l:'타점'},{v:k,l:'삼진'}
  ].map(function(s){return '<div class="pg-sb"><div class="pg-sv">'+s.v+'</div><div class="pg-sl">'+s.l+'</div></div>';}).join('');

  // 방향 분포
  var dabs=abs.filter(function(a){return a.deg!=null;});
  var tot=dabs.length||1;
  var pull=dabs.filter(function(a){return a.deg<72;}).length;
  var ctr=dabs.filter(function(a){return a.deg>=72&&a.deg<=108;}).length;
  var oppo=dabs.length-pull-ctr;
  var pP=Math.round(pull/tot*100),cP=Math.round(ctr/tot*100),oP=100-pP-cP;
  var dp=document.getElementById('pgDP'),dc=document.getElementById('pgDC'),ddo=document.getElementById('pgDO');
  if(dp)dp.style.flex=pP||1;
  if(dc)dc.style.flex=cP||1;
  if(ddo)ddo.style.flex=oP||1;
  var el=document.getElementById('pgDlPull');if(el)el.textContent='당겨 '+pP+'%';
  el=document.getElementById('pgDlCtr');if(el)el.textContent='중앙 '+cP+'%';
  el=document.getElementById('pgDlOppo');if(el)el.textContent='밀어 '+oP+'%';

  // 인사이트 (HOT ZONE / WEAKNESS / MVP)
  var mainDir=dabs.length?(pull>=ctr&&pull>=oppo?'당겨치기':ctr>=oppo?'센터':'밀어치기'):null;
  var dirG=[
    {name:'당겨치기',list:dabs.filter(function(a){return a.deg<72;})},
    {name:'센터',list:dabs.filter(function(a){return a.deg>=72&&a.deg<=108;})},
    {name:'밀어치기',list:dabs.filter(function(a){return a.deg>108;})}
  ];
  var ins=[];

  // HOT ZONE
  var hotZ=null,hotR=-1;
  dirG.forEach(function(g){
    if(g.list.length<3)return;
    var r=g.list.filter(function(a){return _HITS.includes(a.res);}).length/g.list.length;
    if(r>hotR){hotR=r;hotZ={name:g.name,rate:r,n:g.list.length};}
  });
  if(hotZ&&hotR>=0.38)ins.push({cls:'hot',lbl:'🔥 HOT ZONE',val:hotZ.name+' '+Math.round(hotR*100)+'% 안타율 ('+hotZ.n+'타구)'});

  // WEAKNESS
  var weakZ=null,weakR=-1;
  dirG.forEach(function(g){
    if(g.list.length<3)return;
    var outList=g.list.filter(function(a){return!_HITS.includes(a.res)&&!_NOAB.includes(a.res);});
    var r=outList.length/g.list.length;
    if(r>weakR&&r>=0.70){weakR=r;weakZ={name:g.name,rate:r};}
  });
  var kRate=abs.length?k/abs.length:0;
  if(weakZ)ins.push({cls:'weak',lbl:'⚠ WEAKNESS',val:weakZ.name+' 아웃률 '+Math.round(weakZ.rate*100)+'% — 공략 포인트 조정 포인트'});
  else if(kRate>=0.6&&k>=3)ins.push({cls:'weak',lbl:'⚠ WEAKNESS',val:'삼진률 '+Math.round(kRate*100)+'% — 컨택 비율을 높일 여지가 있습니다'});

  // MVP (안타×1 + 2루타×1 추가 + 3루타×2 추가 + 홈런×3 추가 + 타점×1)
  var mvpMap={};
  abs.forEach(function(a){
    if(!mvpMap[a.bid])mvpMap[a.bid]={name:a.bname,score:0,h:0,rbi:0,hr:0};
    var pts=(_BASE[a.res]||0)+(a.rbi||0);
    mvpMap[a.bid].score+=pts;
    if(_HITS.includes(a.res))mvpMap[a.bid].h++;
    mvpMap[a.bid].rbi+=a.rbi||0;
    if(a.res==='홈런')mvpMap[a.bid].hr++;
  });
  var mvpArr=Object.values(mvpMap).sort(function(a,b){return b.score-a.score;});
  if(mvpArr.length&&mvpArr[0].h>0){
    var m=mvpArr[0];
    ins.push({cls:'mvp',lbl:'🏆 MVP',val:_escHtml(m.name)+' — '+m.h+'안타 '+m.rbi+'타점'+(m.hr?' '+m.hr+'홈런':'')});
  }

  var insEl=document.getElementById('pgInsights');
  if(insEl)insEl.innerHTML=ins.length
    ?ins.map(function(i){return'<div class="pg-ins '+i.cls+'"><div class="pg-ins-lbl">'+i.lbl+'</div><div class="pg-ins-val">'+i.val+'</div></div>';}).join('')
    :'<div style="font-size:11px;color:var(--text3);padding:6px">타석이 쌓이면 분석이 표시됩니다</div>';

  // 경기 코멘트
  var xbh=abs.filter(function(a){return['2루타','3루타','홈런'].includes(a.res);}).length;
  var aiLines=[];
  if(dabs.length>=3){
    if(pP>=60)aiLines.push('당겨치기 타구가 '+pP+'%로 집중됐습니다.');
    else if(oP>=55)aiLines.push('밀어치기 비율이 '+oP+'%로 높았습니다.');
    else if(cP>=45)aiLines.push('균형 잡힌 중앙 공략('+cP+'%)이 돋보였습니다.');
  }
  if(avg>=0.40)aiLines.push('팀 타율 '+fmt(avg)+' — 오늘 타선이 뜨겁게 가동됐습니다.');
  else if(avg<0.18&&abs.length>=5)aiLines.push('타율 '+fmt(avg)+' — 이 데이터를 기반으로 다음 경기를 준비하세요.');
  if(xbh>=3)aiLines.push('장타(2루타 이상) '+xbh+'개로 파워 타선이 빛났습니다.');
  if(AS.hs>AS.as)aiLines.push('🎉 우리 팀 승리! 오늘의 스프레이 데이터가 다음 경기의 무기입니다.');
  else if(AS.hs<AS.as)aiLines.push('아쉬운 결과지만, 이 데이터로 반드시 반격하세요.');
  if(!aiLines.length)aiLines.push('SprayLab이 경기를 기록했습니다. 데이터는 쌓일수록 강력해집니다.');
  var aiEl=document.getElementById('pgAITxt');
  if(aiEl)aiEl.textContent=aiLines.slice(0,2).join(' ');

  // 저장 버튼 초기화
  var sb=document.getElementById('pgSaveBtn');
  if(sb){sb.textContent='💾 경기 저장';sb.disabled=false;}

  // 미니 스프레이 차트
  requestAnimationFrame(function(){_pgDrawMini('pgMini',108);});
}

function _pgDrawMini(id,S){
  var c=document.getElementById(id);
  if(!c)return;
  var ctx=c.getContext('2d'),cx=S/2,cy=S;
  ctx.clearRect(0,0,S,S);
  var bg=ctx.createRadialGradient(cx,cy,0,cx,cy,S);
  bg.addColorStop(0,'#1f4d24');bg.addColorStop(.55,'#193f1d');bg.addColorStop(1,'#0f2010');
  ctx.beginPath();ctx.arc(cx,cy,S*.97,-Math.PI,0);ctx.lineTo(cx,cy);ctx.closePath();
  ctx.fillStyle=bg;ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=.8;
  var br=S*.42,bp=[[cx,cy],[cx-br*.46,cy-br*.33],[cx,cy-br*.65],[cx+br*.46,cy-br*.33],[cx,cy]];
  ctx.beginPath();bp.forEach(function(p,i){i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);});ctx.stroke();
  var RC={'안타':'#2dd4a0','내야안타':'#5eead4','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565'};
  AS.abs.forEach(function(a){
    if(!a.x||!a.y)return;
    var col=RC[a.res]||'#94a3b8',out=!_HITS.includes(a.res)&&!_NOAB.includes(a.res);
    ctx.beginPath();ctx.arc(a.x*S,a.y*S,out?1.8:3,0,Math.PI*2);
    ctx.fillStyle=col+'aa';ctx.fill();
    ctx.strokeStyle=col;ctx.lineWidth=.7;ctx.stroke();
  });
}

function pgDoSave(){
  var sb=document.getElementById('pgSaveBtn');
  if(sb){sb.textContent='저장 중...';sb.disabled=true;}
  saveGame();
  setTimeout(function(){if(sb){sb.textContent='✓ 저장 완료';sb.disabled=false;}},600);
}

function pgExport(W,H,mode){
  showToast('이미지 생성 중...',false,true);
  setTimeout(function(){
    var c=document.createElement('canvas');
    c.width=W;c.height=H;
    var ctx=c.getContext('2d');
    var bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#07111f');bg.addColorStop(.5,'#0d1e3a');bg.addColorStop(1,'#07090f');
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // 장식 그리드
    ctx.strokeStyle='rgba(75,140,245,.05)';ctx.lineWidth=1;
    for(var gi=0;gi<W;gi+=W/18){ctx.beginPath();ctx.moveTo(gi,0);ctx.lineTo(gi,H);ctx.stroke();}

    var pad=W*0.08,cx2=W/2,y=0;
    var abs=AS.abs;
    var oab2=abs.filter(function(a){return!_NOAB.includes(a.res);}).length||1;
    var h2=abs.filter(function(a){return _HITS.includes(a.res);}).length;
    var bb2=abs.filter(function(a){return a.res==='볼넷'||a.res==='사구';}).length;
    var k2=abs.filter(function(a){return a.res==='삼진';}).length;
    var rbi2=abs.reduce(function(s,a){return s+(a.rbi||0);},0);
    var avg2=h2/oab2;
    var fmt2=function(v){return v.toFixed(3).replace('0.','.');};
    var th2=document.getElementById('tHome').value||'홈팀';
    var ta2=document.getElementById('tAway').value||'원정팀';
    var date2=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});

    // badge
    y=mode==='story'?H*.09:H*.1;
    ctx.font='bold '+Math.round(W*.022)+'px sans-serif';
    ctx.fillStyle='#f6c23e';ctx.textAlign='center';
    ctx.fillText('GAME REPORT',cx2,y);
    // score
    y+=mode==='story'?H*.09:H*.11;
    ctx.font='bold '+Math.round(W*.14)+'px sans-serif';
    ctx.fillStyle='#f6c23e';
    ctx.fillText(AS.hs+' : '+AS.as,cx2,y);
    // teams
    y+=mode==='story'?H*.055:H*.065;
    ctx.font=Math.round(W*.034)+'px sans-serif';ctx.fillStyle='rgba(255,255,255,.55)';
    ctx.fillText(th2+' vs '+ta2,cx2,y);
    // date
    y+=mode==='story'?H*.038:H*.045;
    ctx.font=Math.round(W*.024)+'px sans-serif';ctx.fillStyle='rgba(255,255,255,.3)';
    ctx.fillText(date2,cx2,y);
    // divider
    y+=mode==='story'?H*.04:H*.048;
    ctx.strokeStyle='rgba(246,194,62,.22)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();
    // stats
    y+=mode==='story'?H*.065:H*.08;
    var stats2=[{v:fmt2(avg2),l:'팀 타율'},{v:h2+'',l:'안타'},{v:rbi2+'',l:'타점'},{v:k2+'',l:'삼진'}];
    var cw=(W-pad*2)/4;
    stats2.forEach(function(s,i){
      var sx=pad+cw*i+cw/2;
      ctx.font='bold '+Math.round(W*.058)+'px sans-serif';ctx.fillStyle='#eef0f8';ctx.textAlign='center';
      ctx.fillText(s.v,sx,y);
      ctx.font=Math.round(W*.022)+'px sans-serif';ctx.fillStyle='rgba(255,255,255,.4)';
      ctx.fillText(s.l,sx,y+Math.round(W*.034));
    });
    // direction bar
    y+=mode==='story'?H*.11:H*.13;
    var dabs2=abs.filter(function(a){return a.deg!=null;});
    var tot2=dabs2.length||1;
    var pull2=dabs2.filter(function(a){return a.deg<72;}).length;
    var ctr2=dabs2.filter(function(a){return a.deg>=72&&a.deg<=108;}).length;
    var oppo2=dabs2.length-pull2-ctr2;
    var bw=W-pad*2,bh=Math.round(H*.012);
    var pw2=Math.round(bw*pull2/tot2),cw2=Math.round(bw*ctr2/tot2),ow2=bw-pw2-cw2;
    ctx.fillStyle='#4b8cf5';_pgRRect(ctx,pad,y,pw2,bh,4);ctx.fill();
    ctx.fillStyle='#2dd4a0';_pgRRect(ctx,pad+pw2+2,y,cw2,bh,4);ctx.fill();
    ctx.fillStyle='#f6c23e';_pgRRect(ctx,pad+pw2+cw2+4,y,ow2,bh,4);ctx.fill();
    y+=bh+Math.round(H*.025);
    ctx.font=Math.round(W*.021)+'px sans-serif';ctx.fillStyle='rgba(255,255,255,.4)';
    ctx.textAlign='left';ctx.fillText('당겨 '+Math.round(pull2/tot2*100)+'%',pad,y);
    ctx.textAlign='center';ctx.fillText('중앙 '+Math.round(ctr2/tot2*100)+'%',cx2,y);
    ctx.textAlign='right';ctx.fillText('밀어 '+Math.round(oppo2/tot2*100)+'%',W-pad,y);
    // 미니 스프레이 차트
    y+=mode==='story'?H*.05:H*.06;
    var mS=Math.round(W*.36),mc=document.createElement('canvas');
    mc.width=mS;mc.height=mS;
    _pgDrawMiniOnCanvas(mc.getContext('2d'),mS);
    ctx.save();
    ctx.beginPath();ctx.arc(cx2,y+mS/2,mS/2,0,Math.PI*2);ctx.clip();
    ctx.drawImage(mc,cx2-mS/2,y);
    ctx.restore();
    y+=mS+Math.round(H*.04);
    // 경기 코멘트
    var aiEl2=document.getElementById('pgAITxt');
    if(aiEl2&&aiEl2.textContent){
      ctx.font=Math.round(W*.027)+'px sans-serif';ctx.fillStyle='rgba(255,255,255,.55)';ctx.textAlign='center';
      _pgWrapText(ctx,aiEl2.textContent,cx2,y,W-pad*2,Math.round(H*.04));
    }
    // 워터마크
    ctx.font=Math.round(W*.018)+'px sans-serif';ctx.fillStyle='rgba(255,255,255,.18)';ctx.textAlign='center';
    ctx.fillText('Powered by SprayLab',cx2,H-Math.round(H*.035));
    _downloadCanvas(c,'spraylab_'+mode+'_'+Date.now()+'.png');
    showToast('이미지 저장 완료 ✓',false);
  },80);
}

function _pgDrawMiniOnCanvas(ctx,S){
  var cx=S/2,cy=S;
  ctx.clearRect(0,0,S,S);
  var bg=ctx.createRadialGradient(cx,cy,0,cx,cy,S);
  bg.addColorStop(0,'#1f4d24');bg.addColorStop(.55,'#193f1d');bg.addColorStop(1,'#0f2010');
  ctx.beginPath();ctx.arc(cx,cy,S*.97,-Math.PI,0);ctx.lineTo(cx,cy);ctx.closePath();
  ctx.fillStyle=bg;ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=Math.max(.7,S/160);
  var br=S*.42,bp=[[cx,cy],[cx-br*.46,cy-br*.33],[cx,cy-br*.65],[cx+br*.46,cy-br*.33],[cx,cy]];
  ctx.beginPath();bp.forEach(function(p,i){i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);});ctx.stroke();
  var RC={'안타':'#2dd4a0','내야안타':'#5eead4','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565'};
  var r=Math.max(2,S/38);
  AS.abs.forEach(function(a){
    if(!a.x||!a.y)return;
    var col=RC[a.res]||'#94a3b8',out=!_HITS.includes(a.res)&&!_NOAB.includes(a.res);
    ctx.beginPath();ctx.arc(a.x*S,a.y*S,out?r*.55:r,0,Math.PI*2);
    ctx.fillStyle=col+'aa';ctx.fill();
    ctx.strokeStyle=col;ctx.lineWidth=.7;ctx.stroke();
  });
}

function _pgRRect(ctx,x,y,w,h,r){
  if(w<=0||h<=0)return;
  r=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function _pgWrapText(ctx,text,x,y,maxW,lineH){
  var words=text.split(' '),line='';
  for(var n=0;n<words.length;n++){
    var test=line+words[n]+' ';
    if(ctx.measureText(test).width>maxW&&n>0){ctx.fillText(line,x,y);line=words[n]+' ';y+=lineH;}
    else line=test;
  }
  if(line.trim())ctx.fillText(line,x,y);
}

// ══════════════════════════════════════════════
// TEAM SYSTEM — 팀 플랫폼
// localStorage key: 'sl_teams'
// teamData = { teams:[], activeTeamId:null }
// team = { id, name, color, stadium, createdAt, games:[] }
// game entry = { key, date, th, ta, hs, as, result:'W'|'L'|'D', mvp:{name,num,h,ab,rbi} }
// Share URL: ?team=z<LZString encoded JSON>
// ══════════════════════════════════════════════

var _TD_KEY='sl_teams';
var _TD={teams:[],activeTeamId:null};
var _tcmColor='#4b8cf5';

function tdLoad(){try{var r=localStorage.getItem(_TD_KEY);if(r)_TD=JSON.parse(r);}catch(e){}if(!_TD.teams)_TD.teams=[];}
function tdSave(){try{localStorage.setItem(_TD_KEY,JSON.stringify(_TD));}catch(e){}}
function tdGetActive(){return _TD.teams.find(function(t){return t.id===_TD.activeTeamId;})||null;}

// ── 팀 생성/관리 ──
function openTeamCreate(){
  tdLoad();
  var m=document.getElementById('teamCreateModal');if(m)m.classList.add('on');
  var n=document.getElementById('tcmName');if(n){n.value='';setTimeout(function(){n.focus();},200);}
  var s=document.getElementById('tcmStadium');if(s)s.value='';
  _tcmColor='#4b8cf5';
  document.querySelectorAll('.tcm-color-dot').forEach(function(d){d.classList.toggle('on',d.dataset.c==='#4b8cf5');});
}
function closeTeamCreate(){var m=document.getElementById('teamCreateModal');if(m)m.classList.remove('on');}
function tcmPickColor(dot){
  _tcmColor=dot.dataset.c;
  document.querySelectorAll('.tcm-color-dot').forEach(function(d){d.classList.remove('on');});
  dot.classList.add('on');
}
function createTeam(){
  var name=(document.getElementById('tcmName').value||'').trim();
  if(!name){showToast('팀명을 입력하세요',true);return;}
  var stadium=(document.getElementById('tcmStadium').value||'').trim();
  tdLoad();
  var team={id:'t'+Date.now(),name:name,color:_tcmColor,stadium:stadium,
    createdAt:new Date().toLocaleDateString('ko-KR'),games:[]};
  _TD.teams.push(team);_TD.activeTeamId=team.id;tdSave();
  closeTeamCreate();renderTeamSelector();renderTeamDashboard();
  showToast('🏟️ '+name+' 팀 생성 완료',false);
}

// ── 팀 셀렉터 (AppWelcome) ──
function renderTeamSelector(){
  tdLoad();
  var sel=document.getElementById('tsbSelect');if(!sel)return;
  if(!_TD.teams.length){sel.innerHTML='<option value="">팀 없음</option>';return;}
  sel.innerHTML='<option value="">팀 선택 안함</option>'
    +_TD.teams.map(function(t){
      return '<option value="'+t.id+'"'+( t.id===_TD.activeTeamId?' selected':'')+'>'+_escHtml(t.name)+'</option>';
    }).join('');
}
function tsbChange(val){tdLoad();_TD.activeTeamId=val||null;tdSave();renderTeamDashboard();}

// ── 경기 → 팀 연결 ──
function _computeMVP(abs){
  if(!abs||!abs.length)return null;
  var hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
  var base={안타:1,내야안타:1,'2루타':2,'3루타':3,'홈런':4};
  var pm={};
  abs.forEach(function(a){
    if(a.team!=='home')return;
    if(!pm[a.bid])pm[a.bid]={name:a.bname,num:a.bnum,h:0,ab:0,rbi:0,tb:0};
    var p=pm[a.bid];
    if(hits.includes(a.res))p.h++;
    if(!noab.includes(a.res))p.ab++;
    p.rbi+=(a.rbi||0);p.tb+=(base[a.res]||0);
  });
  var best=Object.values(pm).filter(function(p){return p.ab>0;}).sort(function(a,b){
    return (b.h/(b.ab||1)*100+b.rbi*12+b.tb*4)-(a.h/(a.ab||1)*100+a.rbi*12+a.tb*4);
  })[0];
  return (best&&best.h>0)?best:null;
}
function linkGameToTeam(key,data){
  tdLoad();var team=tdGetActive();if(!team)return;
  if(team.games.find(function(g){return g.key===key;}))return;
  var hs=data.hs||0,as=data.as||0;
  team.games.push({key:key,date:data.d||new Date().toLocaleDateString('ko-KR'),
    th:data.th||'',ta:data.ta||'',hs:hs,as:as,
    result:hs>as?'W':hs<as?'L':'D',
    mvp:_computeMVP(data.abs||[])});
  tdSave();
}

// ── 팀 대시보드 렌더 ──
function renderTeamDashboard(){
  tdLoad();
  var hdr=document.getElementById('teamPanelHdr');if(!hdr)return;
  var team=tdGetActive();
  // 카드 표시/숨김
  ['teamSeasonCard','teamLeaderboardCard','teamHistoryCard','teamShareCard'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display=team?'':'none';
  });
  if(!team){
    hdr.innerHTML='<div style="text-align:center;padding:20px 0">'
      +'<div style="font-size:13px;color:var(--text3);margin-bottom:12px">팀을 생성하거나 선택하세요</div>'
      +'<button class="btn btn-primary" onclick="openTeamCreate()" style="min-width:140px">+ 팀 만들기</button>'
      +'</div>';
    return;
  }
  hdr.innerHTML='<div class="team-hdr">'
    +'<div class="team-color-circle" style="background:'+team.color+';color:#fff">'+_escHtml(team.name[0])+'</div>'
    +'<div class="team-hdr-info">'
    +'<div class="team-hdr-name">'+_escHtml(team.name)+'</div>'
    +'<div class="team-hdr-meta">'+(team.stadium?'📍'+_escHtml(team.stadium)+' · ':'')+team.createdAt+'</div>'
    +'</div>'
    +'<button class="team-hdr-btn" onclick="openTeamCreate()">+ 팀 추가</button>'
    +'</div>';
  // 시즌 기록
  var games=team.games||[];
  var W=games.filter(function(g){return g.result==='W';}).length;
  var L=games.filter(function(g){return g.result==='L';}).length;
  var D=games.filter(function(g){return g.result==='D';}).length;
  var rs=games.reduce(function(s,g){return s+g.hs;},0);
  var ra=games.reduce(function(s,g){return s+g.as;},0);
  var wp=games.length?(W/games.length*100).toFixed(0)+'%':'—';
  var strip=document.getElementById('teamRecordStrip');
  if(strip)strip.innerHTML=
    '<div class="trs-it"><div class="trs-v" style="color:var(--green)">'+W+'</div><div class="trs-l">승</div></div>'
    +'<div class="trs-it"><div class="trs-v" style="color:var(--red)">'+L+'</div><div class="trs-l">패</div></div>'
    +'<div class="trs-it"><div class="trs-v">'+D+'</div><div class="trs-l">무</div></div>'
    +'<div class="trs-it"><div class="trs-v" style="color:var(--accent)">'+wp+'</div><div class="trs-l">승률</div></div>'
    +'<div class="trs-it"><div class="trs-v" style="font-size:13px">'+rs+'/'+ra+'</div><div class="trs-l">득/실</div></div>';
  var flow=document.getElementById('teamRecentFlow');
  if(flow){
    var r5=games.slice(-5);
    flow.innerHTML=r5.length
      ?r5.map(function(g){return '<div class="flow-dot '+g.result.toLowerCase()+'">'+g.result+'</div>';}).join('')
      :'<span style="font-size:10px;color:var(--text3)">경기 없음</span>';
  }
  renderTeamLeaderboard(_ldrSort||'ops');
  renderGameHistory();
}

// ── 리더보드 ──
var _ldrSort='ops';
function renderTeamLeaderboard(sort){
  _ldrSort=sort;
  document.querySelectorAll('.ldr-tab').forEach(function(t){t.classList.toggle('on',t.dataset.s===sort);});
  var el=document.getElementById('teamLeaderboardBody');if(!el)return;
  tdLoad();var team=tdGetActive();if(!team){el.innerHTML='';return;}
  var hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
  var base={안타:1,내야안타:1,'2루타':2,'3루타':3,'홈런':4};
  var pm={};
  team.games.forEach(function(g){
    var raw=localStorage.getItem(g.key);if(!raw)return;
    var d;try{d=JSON.parse(raw);}catch(e){return;}
    (d.abs||[]).forEach(function(a){
      if(a.team!=='home')return;
      if(!pm[a.bid])pm[a.bid]={name:a.bname,num:a.bnum,h:0,ab:0,bb:0,tb:0,rbi:0,hr:0,gk:new Set()};
      var p=pm[a.bid];p.gk.add(g.key);
      if(hits.includes(a.res))p.h++;
      if(!noab.includes(a.res))p.ab++;
      if(a.res==='볼넷'||a.res==='사구')p.bb++;
      p.tb+=(base[a.res]||0);p.rbi+=(a.rbi||0);
      if(a.res==='홈런')p.hr++;
    });
  });
  var ps=Object.values(pm).filter(function(p){return p.ab>=3;});
  ps.forEach(function(p){
    p.avg=p.ab?p.h/p.ab:0;
    p.obp=(p.ab+p.bb)?(p.h+p.bb)/(p.ab+p.bb):0;
    p.slg=p.ab?p.tb/p.ab:0;
    p.ops=p.obp+p.slg;p.g=p.gk.size;
  });
  var sf={ops:function(a,b){return b.ops-a.ops;},avg:function(a,b){return b.avg-a.avg;},
    hr:function(a,b){return b.hr-a.hr;},rbi:function(a,b){return b.rbi-a.rbi;}};
  ps.sort(sf[sort]||sf.ops);
  var top=ps.slice(0,5);
  if(!top.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:12px">최소 3타석 이상 데이터가 없습니다</div>';return;}
  var vf={ops:function(p){return p.ops.toFixed(3);},avg:function(p){return p.avg.toFixed(3);},
    hr:function(p){return p.hr;},rbi:function(p){return p.rbi;}};
  el.innerHTML=top.map(function(p,i){
    var v=String(vf[sort](p));if(v.length>3&&v.startsWith('0.'))v=v.slice(1);
    return '<div class="ldr-row">'
      +'<div class="ldr-rank">'+(['🥇','🥈','🥉'][i]||i+1)+'</div>'
      +'<div class="ldr-info"><div class="ldr-name">#'+p.num+' '+_escHtml(p.name)+'</div>'
      +'<div class="ldr-detail">'+p.g+'경기 · '+p.ab+'AB · AVG '+p.avg.toFixed(3).replace('0.','.') +'</div></div>'
      +'<div class="ldr-stat">'+v+'</div></div>';
  }).join('');
}

// ── 경기 히스토리 ──
function renderGameHistory(){
  var el=document.getElementById('teamHistoryBody');if(!el)return;
  tdLoad();var team=tdGetActive();
  if(!team||!team.games.length){
    el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:12px">경기를 저장하면 자동으로 기록됩니다</div>';return;
  }
  el.innerHTML=[...team.games].reverse().slice(0,20).map(function(g){
    var rc=g.result==='W'?'w':g.result==='L'?'l':'d';
    var mv=g.mvp?'⭐ #'+g.mvp.num+' '+_escHtml(g.mvp.name||''):'';
    return '<div class="gh-item" onclick="loadTeamGame(\''+g.key+'\')">'
      +'<div class="gh-res '+rc+'">'+g.result+'</div>'
      +'<div class="gh-info"><div class="gh-vs">vs '+_escHtml(g.ta)+'</div>'
      +'<div class="gh-date">'+g.date+'</div>'+(mv?'<div class="gh-mvp">'+mv+'</div>':'')+'</div>'
      +'<div class="gh-score">'+g.hs+':'+g.as+'</div></div>';
  }).join('');
}
function loadTeamGame(key){
  restoreGame(key);enterFocusMode();
  swTab('rec',document.getElementById('tab-rec'));
  showToast('경기를 불러왔습니다 ✓',false);
}

// ── 팀 URL 공유 ──
function shareTeamURL(){
  tdLoad();var team=tdGetActive();
  if(!team){showToast('공유할 팀이 없습니다',true);return;}
  var payload={v:1,type:'team',name:team.name,color:team.color,stadium:team.stadium,
    games:team.games.map(function(g){return {date:g.date,th:g.th,ta:g.ta,hs:g.hs,as:g.as,result:g.result,
      mvpName:g.mvp?g.mvp.name:null};})};
  var json=JSON.stringify(payload);
  var enc=typeof LZString!=='undefined'
    ?'z'+LZString.compressToEncodedURIComponent(json)
    :'b'+btoa(unescape(encodeURIComponent(json)));
  var url=location.origin+location.pathname+'?team='+enc;
  showShareQR(url);
}

// ── URL에서 팀 데이터 로드 ──
(function _loadTeamFromURL(){
  var sp=new URLSearchParams(location.search);
  var enc=sp.get('team');if(!enc)return;
  try{
    var json=enc[0]==='z'&&typeof LZString!=='undefined'
      ?LZString.decompressFromEncodedURIComponent(enc.slice(1))
      :decodeURIComponent(escape(atob(enc[0]==='b'?enc.slice(1):enc)));
    var p=JSON.parse(json);
    if(!p||p.type!=='team')return;
    window._sharedTeamPayload=p;
    var b=document.getElementById('teamSharedBanner');
    if(b){
      document.getElementById('tsbTeamName').textContent=p.name;
      document.getElementById('tsbTeamGames').textContent=(p.games?p.games.length+'경기':'')+'가 공유됨';
      b.style.display='block';
    }
  }catch(e){console.log('team URL parse fail',e);}
})();

function importSharedTeam(){
  var p=window._sharedTeamPayload;if(!p)return;
  tdLoad();
  var team={id:'t'+Date.now(),name:p.name,color:p.color||'#4b8cf5',stadium:p.stadium||'',
    createdAt:new Date().toLocaleDateString('ko-KR'),games:p.games||[]};
  _TD.teams.push(team);_TD.activeTeamId=team.id;tdSave();
  var b=document.getElementById('teamSharedBanner');if(b)b.style.display='none';
  renderTeamSelector();
  showToast('🏟️ '+p.name+' 팀 데이터를 가져왔습니다',false);
}

// ── 역할 스위처 ──
var _role='scorer';
function setRole(r){
  _role=r;
  document.body.className=document.body.className.replace(/\brole-\w+/g,'').trim();
  document.body.classList.add('role-'+r);
  document.querySelectorAll('.role-sw-btn').forEach(function(b){b.classList.toggle('on',b.dataset.r===r);});
  try{localStorage.setItem('sl_role',r);}catch(e){}
}

// ── saveGame 패치: 저장 후 팀에 자동 연결 ──
(function _patchSaveForTeam(){
  var _o=saveGame;
  saveGame=function(){
    _o.apply(this,arguments);
    setTimeout(function(){
      tdLoad();if(!tdGetActive())return;
      var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
      if(!saves.length)return;
      var last=saves[saves.length-1];
      var raw=localStorage.getItem(last.key);if(!raw)return;
      var d;try{d=JSON.parse(raw);}catch(e){return;}
      linkGameToTeam(last.key,{hs:d.hs||0,as:d.as||0,d:d.d||'',th:d.th||'',ta:d.ta||'',abs:d.abs||[]});
    },700);
  };
})();

// ── 초기화 ──
(function _teamInit(){
  tdLoad();
  var savedRole=localStorage.getItem('sl_role')||'scorer';
  setTimeout(function(){
    renderTeamSelector();
    setRole(savedRole);
  },250);
})();

// ══════════════════════════════════════════════
// UI 단순화 + 경기 중 UX 최적화
// ══════════════════════════════════════════════

// ── 더보기 바텀시트 ──
function awMoreOpen(){
  var ov=document.getElementById('awMoreOverlay');
  if(ov){ov.classList.add('on');}
}
function awMoreClose(){
  var ov=document.getElementById('awMoreOverlay');
  if(ov){ov.classList.remove('on');}
}

// ── 집중 모드 (경기 시작 시 자동 진입) ──
function enterFocusMode(){
  document.body.classList.add('game-focus');
}
function exitFocusMode(){
  document.body.classList.remove('game-focus');
}
(function patchFocusMode(){
  var _orig=startFromWizard;
  startFromWizard=function(){
    _orig.apply(this,arguments);
    enterFocusMode();
  };
  var _origShow=showAppWelcome;
  showAppWelcome=function(){
    _origShow.apply(this,arguments);
    exitFocusMode();
  };
  var _origLoad=loadRecentGame;
  loadRecentGame=function(key){
    _origLoad.apply(this,arguments);
    enterFocusMode();
  };
})();

// ── 고급 분석 접기/펼치기 ──
function toggleAdvanced(){
  var sec=document.getElementById('advSection');
  var btn=document.getElementById('advToggleBtn');
  if(!sec)return;
  var isOpen=!sec.classList.contains('closed');
  if(isOpen){
    sec.style.maxHeight=sec.scrollHeight+'px';
    requestAnimationFrame(function(){
      sec.style.maxHeight='0';
      sec.classList.add('closed');
      if(btn){btn.classList.remove('open');btn.querySelector('span:first-child').textContent='▸ 고급 분석 (시즌·약점·AI)';}
    });
  } else {
    sec.classList.remove('closed');
    sec.style.maxHeight=sec.scrollHeight+'px';
    if(btn){btn.classList.add('open');btn.querySelector('span:first-child').textContent='▾ 고급 분석 (시즌·약점·AI)';}
    setTimeout(function(){sec.style.maxHeight='none';},300);
  }
}

// ── FAB: 최근 기록 수정 ──
function fabEditLast(){
  if(!AS.abs.length){showToast('수정할 기록이 없습니다',true);return;}
  var last=AS.abs[AS.abs.length-1];
  openEditRec(last.id);
}

// ── 자동 다음 타자 이동 ──
function autoAdvanceBatter(){
  if(!AS.batter)return;
  var lu=getActiveLineup();
  if(!lu.length)return;
  var idx=lu.findIndex(function(p){return p.id===AS.batter.id;});
  if(idx===-1)return;
  var next=lu[(idx+1)%lu.length];
  if(next&&next.id!==AS.batter.id)selBatter(next.id);
}
(function patchAutoNext(){
  var _orig=fabRecord;
  fabRecord=function(res){
    _orig.apply(this,arguments);
    if(AS.abs.length)setTimeout(autoAdvanceBatter,80);
  };
})();

// ── 최근 경기 카드 강화 (MVP + 요약) ──
var _origRenderAwRecent=renderAwRecent;
renderAwRecent=function(){
  var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
  var el=document.getElementById('awRecent');
  if(!el)return;
  if(!saves.length){
    el.innerHTML='<div class="aw-empty" style="color:var(--text3);font-size:12px;padding:16px 0;text-align:center">아직 저장된 경기가 없습니다.<br>첫 경기를 기록해보세요 ⚾</div>';
    return;
  }
  var recent=[...saves].reverse();
  var html='<div class="aw-recent-title">최근 경기</div><div class="aw-recent-scroll">';
  recent.forEach(function(s){
    var raw=localStorage.getItem(s.key);
    if(!raw)return;
    var d;try{d=JSON.parse(raw);}catch(e){return;}
    var hs=d.hs||0,as=d.as||0;
    var th=_escHtml(d.th||'홈팀');
    var ta=_escHtml(d.ta||'원정팀');
    var date=_escHtml(d.d||'');
    var outcome=hs>as?'WIN':hs<as?'LOSE':'DRAW';
    var outcomeColor=hs>as?'var(--green)':hs<as?'var(--red)':'var(--text3)';
    // MVP 계산
    var mvpHtml='';
    if(d.abs&&d.abs.length){
      var hits=['안타','내야안타','2루타','3루타','홈런'],noab=['볼넷','사구','희타','희비'];
      var pm={};
      d.abs.forEach(function(a){
        if(!pm[a.bid])pm[a.bid]={name:a.bname,num:a.bnum,h:0,ab:0,rbi:0};
        if(hits.includes(a.res))pm[a.bid].h++;
        if(!noab.includes(a.res))pm[a.bid].ab++;
        pm[a.bid].rbi+=(a.rbi||0);
      });
      var best=Object.values(pm).filter(function(p){return p.ab>0;}).sort(function(a,b){
        return (b.h/b.ab+b.rbi*.15)-(a.h/a.ab+a.rbi*.15);
      })[0];
      if(best&&best.h>0){
        var avg=best.ab?(best.h/best.ab).toFixed(3).replace('0.','.'):'---';
        mvpHtml='<div class="aw-ri-mvp">⭐ MVP #'+best.num+' '+_escHtml(best.name)+' · '+avg+(best.rbi>0?' · '+best.rbi+'타점':'')+'</div>';
      }
    }
    html+='<div class="aw-recent-item" onclick="loadRecentGame(\''+s.key+'\')">'
      +'<div class="aw-ri-icon">⚾</div>'
      +'<div class="aw-ri-body">'
      +'<div class="aw-ri-label">'+th+' vs '+ta+'</div>'
      +'<div class="aw-ri-date">'+date+'</div>'
      +mvpHtml
      +'</div>'
      +'<div class="aw-ri-meta">'
      +'<div class="aw-ri-meta-score">'+hs+' : '+as+'</div>'
      +'<div class="aw-ri-meta-result" style="color:'+outcomeColor+'">'+outcome+'</div>'
      +'</div>'
      +'<button class="aw-ri-del" onclick="event.stopPropagation();deleteRecentGame(\''+s.key+'\')" title="삭제">✕</button>'
      +'</div>';
  });
  html+='</div>';
  el.innerHTML=html;
};

// ══════════════════════════════════════════════
// ARCH v1.2.0 — 안정화 + 아키텍처 정리
// ══════════════════════════════════════════════

// ─── storageManager ───────────────────────────
var storageManager=(function(){
  var VERSION='1.2.0';
  var AUTOSAVE_KEY='sl_autosave';
  var _timer=null;
  function _ser(d){try{return JSON.stringify(d);}catch(e){return null;}}
  function _de(s){try{return JSON.parse(s);}catch(e){return null;}}
  return{
    version:VERSION,
    save:function(key,data){
      var raw=_ser(data);if(!raw)return false;
      try{localStorage.setItem(key,raw);return true;}
      catch(e){showToast('⚠️ 저장 공간이 부족합니다. 오래된 경기를 삭제하세요.',false);return false;}
    },
    load:function(key){
      try{var r=localStorage.getItem(key);return r?_de(r):null;}
      catch(e){console.warn('[SM] load error',key,e);return null;}
    },
    scheduleAutosave:function(data,delay){
      clearTimeout(_timer);
      _timer=setTimeout(function(){
        try{localStorage.setItem(AUTOSAVE_KEY,_ser({_v:VERSION,_ts:Date.now(),data:data}));}
        catch(e){}
      },delay===undefined?3000:delay);
    },
    hasRecovery:function(){try{return!!localStorage.getItem(AUTOSAVE_KEY);}catch(e){return false;}},
    getRecovery:function(){return this.load(AUTOSAVE_KEY);},
    clearRecovery:function(){try{localStorage.removeItem(AUTOSAVE_KEY);}catch(e){}},
    cancelPendingAutosave:function(){clearTimeout(_timer);_timer=null;try{localStorage.removeItem(AUTOSAVE_KEY);}catch(e){}},
    getUsage:function(){
      try{
        var t=0;
        for(var k in localStorage){if(Object.prototype.hasOwnProperty.call(localStorage,k))t+=(localStorage.getItem(k)||'').length+k.length;}
        return{bytes:t*2,kb:Math.round(t*2/1024)};
      }catch(e){return{bytes:0,kb:0};}
    }
  };
})();

// ─── undoManager ──────────────────────────────
var undoManager=(function(){
  var MAX=20;
  var _stack=[];
  var _future=[];
  function _snap(){
    return{
      abs:JSON.parse(JSON.stringify(AS.abs||[])),
      zoneHistory:JSON.parse(JSON.stringify(AS.zoneHistory||{})),
      currentPitches:JSON.parse(JSON.stringify(AS.currentPitches||[])),
      hs:AS.hs,
      as:AS.as
    };
  }
  function _apply(s){
    AS.abs=s.abs;
    AS.zoneHistory=s.zoneHistory;
    AS.currentPitches=s.currentPitches;
    if(typeof s.hs==='number'){AS.hs=s.hs;var scH=document.getElementById('scH');if(scH)scH.textContent=s.hs;}
    if(typeof s.as==='number'){AS.as=s.as;var scA=document.getElementById('scA');if(scA)scA.textContent=s.as;}
  }
  function _rerender(){
    try{updStats();}catch(e){console.warn('[Undo] updStats error',e);}
    try{renderRecs();}catch(e){console.warn('[Undo] renderRecs error',e);}
    try{renderLP();}catch(e){console.warn('[Undo] renderLP error',e);}
    try{updBatterStat();}catch(e){}
    safeRender();
  }
  function _ui(){
    var u=document.getElementById('archUndoBtn');
    var r=document.getElementById('archRedoBtn');
    if(u)u.disabled=!_stack.length;
    if(r)r.disabled=!_future.length;
  }
  return{
    push:function(){_future=[];_stack.push(_snap());if(_stack.length>MAX)_stack.shift();},
    undo:function(){
      if(!_stack.length){showToast('더 되돌릴 수 없습니다',false);return;}
      _future.push(_snap());
      _apply(_stack.pop());
      _rerender();
      hideToast();
      _ui();
    },
    redo:function(){
      if(!_future.length){showToast('다시 실행할 항목이 없습니다',false);return;}
      _stack.push(_snap());
      _apply(_future.pop());
      _rerender();
      _ui();
    },
    canUndo:function(){return _stack.length>0;},
    canRedo:function(){return _future.length>0;},
    clear:function(){_stack=[];_future=[];_ui();},
    size:function(){return _stack.length;}
  };
})();

// undoLast는 위에서 정의된 pop 기반 버전 사용

// ─── 기록 조작 전 스냅샷 push ─────────────────
(function _patchRecordOps(){
  // 캔버스 클릭 → 히트 오버레이 경로
  var _rh=recHit;
  recHit=function(res){_rh.apply(this,arguments);};
  // 볼넷·삼진 등 기타 결과 경로
  var _ro=recOther;
  recOther=function(res){_ro.apply(this,arguments);};
  // FAB 빠른 기록 (patchAutoNext가 이미 감싼 버전)
  var _f=fabRecord;
  fabRecord=function(res){undoManager.push();_f.apply(this,arguments);};
  // 삭제 / 전체 삭제
  var _d=delRec;
  delRec=function(id){undoManager.push();_d.apply(this,arguments);};
  var _c=clearAll;
  clearAll=function(){undoManager.push();_c.apply(this,arguments);};
})();

// ─── 에러 경계 (updateAll) ────────────────────
(function _errBoundary(){
  var _orig=updateAll;
  updateAll=function(){
    try{return _orig.apply(this,arguments);}
    catch(e){
      console.error('[SprayLab] updateAll error:',e);
      var el=document.querySelector('.tab-pnl.on');
      if(el&&!el.querySelector('.arch-err')){
        var d=document.createElement('div');
        d.className='arch-err';
        d.innerHTML='⚠ 일시적 오류가 발생했습니다. 새로고침하거나 잠시 후 다시 시도하세요.';
        el.prepend(d);
        setTimeout(function(){d.remove();},5000);
      }
    }
  };
})();

// ─── Autosave 연동 ────────────────────────────
(function _patchAutosave(){
  var _orig=updateAll;
  updateAll=function(){
    var r=_orig.apply(this,arguments);
    if(AS&&AS.abs&&AS.abs.length>0){
      storageManager.scheduleAutosave({
        abs:AS.abs,home_lineup:AS.home_lineup,away_lineup:AS.away_lineup,
        hs:AS.hs,as:AS.as,zoneHistory:AS.zoneHistory,
        pitchers:AS.pitchers||[],
        th:(document.getElementById('tHome')||{}).value||'',
        ta:(document.getElementById('tAway')||{}).value||''
      });
    }
    return r;
  };
})();

// ─── 페이지 숨김 시 즉시 autosave ─────────────
document.addEventListener('visibilitychange',function(){
  if(document.hidden&&AS&&AS.abs&&AS.abs.length>0){
    storageManager.scheduleAutosave({
      abs:AS.abs,home_lineup:AS.home_lineup,away_lineup:AS.away_lineup,
      hs:AS.hs,as:AS.as,zoneHistory:AS.zoneHistory,
      pitchers:AS.pitchers||[],
      th:(document.getElementById('tHome')||{}).value||'',
      ta:(document.getElementById('tAway')||{}).value||''
    },0);
  }
});

// ─── UI 상태 헬퍼 ─────────────────────────────
var uiStates={
  empty:function(el,msg,sub){
    if(!el)return;
    el.innerHTML='<div class="arch-state-empty">'
      +'<div class="arch-state-icon">⚾</div>'
      +'<div class="arch-state-msg">'+(msg||'기록이 없습니다')+'</div>'
      +(sub?'<div class="arch-state-sub">'+sub+'</div>':'')
      +'</div>';
  },
  error:function(el,msg){
    if(!el)return;
    el.innerHTML='<div class="arch-state-error">'
      +'<div class="arch-state-icon">⚠</div>'
      +'<div class="arch-state-msg">'+(msg||'불러오지 못했습니다')+'</div>'
      +'</div>';
  },
  loading:function(el){
    if(!el)return;
    el.innerHTML='<div class="arch-state-loading"><div class="arch-spin"></div></div>';
  }
};

// ─── Autosave 복구 ────────────────────────────
(function _checkRecovery(){
  setTimeout(function(){
    // 앱 페이지가 활성화된 경우에만 복구 배너 표시
    var ap=document.getElementById('app-page');
    if(!ap||ap.style.display!=='flex')return;
    if(!storageManager.hasRecovery())return;
    var rec=storageManager.getRecovery();
    if(!rec||!rec.data||!rec.data.abs||!rec.data.abs.length){storageManager.clearRecovery();return;}
    if(AS.abs&&AS.abs.length>0)return; // 현재 기록 있으면 skip
    var banner=document.getElementById('archRecoveryBanner');
    var sub=document.getElementById('archRecoveryCount');
    if(banner){
      if(sub)sub.textContent=rec.data.abs.length+'타석 기록을 복구할 수 있습니다';
      banner.classList.remove('arch-rec-hidden');
      banner.style.display='block';
    }
  },900);
})();

function archRecoverAutosave(){
  var rec=storageManager.getRecovery();
  if(!rec||!rec.data)return;
  var d=rec.data;
  AS.abs=d.abs||[];
  AS.home_lineup=d.home_lineup||[];
  AS.away_lineup=d.away_lineup||[];
  AS.hs=d.hs||0;AS.as=d.as||0;
  AS.zoneHistory=d.zoneHistory||{};
  AS.pitchers=d.pitchers||[];
  var h=document.getElementById('tHome'),a=document.getElementById('tAway');
  if(h&&d.th)h.value=d.th;
  if(a&&d.ta)a.value=d.ta;
  var banner=document.getElementById('archRecoveryBanner');
  if(banner)banner.style.display='none';
  hideAppWelcome();
  var ap=document.getElementById('app-page');
  if(ap)ap.style.display='flex';
  updateAll();
  // updateAll의 _patchAutosave가 sl_autosave를 다시 스케줄링 → 루프 방지
  storageManager.cancelPendingAutosave();
  // 복구된 데이터를 영구 저장소에 저장해 브라우저 재시작 후에도 안전하게 보호
  _archQuietSave();
  showToast('✓ 마지막 기록을 복구했습니다',false);
}

function _archQuietSave(){
  if(!AS.abs||!AS.abs.length)return;
  try{
    var th=(document.getElementById('tHome')||{}).value||'홈팀';
    var ta=(document.getElementById('tAway')||{}).value||'원정팀';
    var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
    // 기존 저장이 있으면 가장 최근 항목을 복구 데이터로 덮어씀
    if(saves.length){
      var latest=saves[saves.length-1];
      var existing=JSON.parse(localStorage.getItem(latest.key)||'null');
      if(existing){
        existing.abs=AS.abs;existing.hs=AS.hs;existing.as=AS.as;
        existing.home_lineup=AS.home_lineup;existing.away_lineup=AS.away_lineup;
        existing.zoneHistory=AS.zoneHistory;existing.pitchers=AS.pitchers||[];
        existing.ts=Date.now();
        localStorage.setItem(latest.key,JSON.stringify(existing));
        latest.ts=existing.ts;
        localStorage.setItem('sl_saves',JSON.stringify(saves));
        return;
      }
    }
    // 저장 없으면 새로 생성
    var key='sl_rec_'+Date.now();
    var data={key,hs:AS.hs,as:AS.as,th:th,ta:ta,
      home_lineup:AS.home_lineup,away_lineup:AS.away_lineup,
      abs:AS.abs,zoneHistory:AS.zoneHistory,
      d:new Date().toLocaleDateString('ko-KR'),ts:Date.now(),
      pitchers:AS.pitchers||[]};
    saves.push({key,label:'[복구] '+data.d+' '+th+' '+data.hs+':'+data.as+' '+ta,ts:data.ts});
    localStorage.setItem('sl_saves',JSON.stringify(saves));
    localStorage.setItem(key,JSON.stringify(data));
  }catch(e){console.warn('[Recovery] quiet save failed',e);}
}

function archDismissRecovery(){
  storageManager.clearRecovery();
  storageManager.cancelPendingAutosave(); // dismiss 직후 재기록 방지
  var banner=document.getElementById('archRecoveryBanner');
  if(banner){
    banner.style.display='none';
    banner.classList.add('arch-rec-hidden');
  }
}

// ─── 숨겨진 자동저장 스캔 ─────────────────────
function scanHiddenAutosaves(){
  var el=document.getElementById('hiddenAutoList');
  if(!el)return;
  var found=[];
  for(var i=0;i<localStorage.length;i++){
    var k=localStorage.key(i);
    if(!k)continue;
    if(k.startsWith('sl_auto_')||k==='sl_autosave'){
      try{
        var raw=localStorage.getItem(k);
        if(!raw)continue;
        var parsed=JSON.parse(raw);
        var d=k==='sl_autosave'?(parsed.data||parsed):parsed;
        var abCount=(d.abs||[]).length;
        var ptCount=(d.pitchers||[]).length;
        if(abCount>0||ptCount>0){
          found.push({key:k,d:d,abCount:abCount,ptCount:ptCount,ts:d.ts||parsed._ts||0});
        }
      }catch(e){}
    }
  }
  if(!found.length){
    el.innerHTML='<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px">숨겨진 자동저장이 없습니다</div>';
    el.scrollIntoView({behavior:'smooth',block:'nearest'});
    return;
  }
  found.sort(function(a,b){return b.ts-a.ts;});
  el.innerHTML=found.map(function(f){
    var label=(f.d.th&&f.d.ta)?f.d.th+' vs '+f.d.ta:'자동저장';
    var timeStr=f.ts?new Date(f.ts).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'날짜 불명';
    return '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px">'
      +'<div style="flex:1"><div style="font-weight:600;color:var(--text)">'+label+'</div>'
      +'<div style="font-size:9px;color:var(--text3)">'+timeStr+' · '+f.abCount+'타석 · 투수 '+f.ptCount+'명</div></div>'
      +'<button class="btn btn-primary" style="font-size:10px;padding:3px 10px" onclick="recoverHiddenAutosave(\''+f.key+'\')">복구</button>'
      +'</div>';
  }).join('');
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function recoverHiddenAutosave(key){
  try{
    var raw=localStorage.getItem(key);
    if(!raw){showToast('데이터를 찾을 수 없습니다',false);return;}
    var parsed=JSON.parse(raw);
    var d=key==='sl_autosave'?(parsed.data||parsed):parsed;
    AS.abs=d.abs||[];
    AS.home_lineup=d.home_lineup||[];
    AS.away_lineup=d.away_lineup||[];
    AS.hs=d.hs||0;AS.as=d.as||0;
    AS.zoneHistory=d.zoneHistory||{};
    AS.pitchers=d.pitchers||[];
    var h=document.getElementById('tHome'),a=document.getElementById('tAway');
    if(h&&d.th)h.value=d.th;
    if(a&&d.ta)a.value=d.ta;
    closeOverlay('loadOverlay');
    hideAppWelcome();
    var ap=document.getElementById('app-page');
    if(ap)ap.style.display='flex';
    updateAll();
    storageManager.cancelPendingAutosave();
    _archQuietSave();
    showToast('✓ 자동저장에서 복구 완료 ('+AS.abs.length+'타석 · 투수 '+AS.pitchers.length+'명)',false);
  }catch(e){showToast('복구 실패: '+e.message,false);}
}

// ─── Debug Panel ──────────────────────────────
var _dbgMode=false;
var SL=window.SL={
  debug:function(on){
    _dbgMode=on===undefined?!_dbgMode:!!on;
    var p=document.getElementById('archDebugPanel');
    if(p)p.style.display=_dbgMode?'block':'none';
    if(_dbgMode)SL.refresh();
  },
  refresh:function(){
    var p=document.getElementById('archDebugPanel');
    if(!p||!_dbgMode)return;
    var u=storageManager.getUsage();
    var rows={
      'abs 수':(AS.abs||[]).length,
      '타자':AS.batter?AS.batter.name:'없음',
      '홈 선수':(AS.home_lineup||[]).length+'명',
      '원정 선수':(AS.away_lineup||[]).length+'명',
      'undo 스택':undoManager.size()+'단계',
      'autosave':storageManager.hasRecovery()?'있음':'없음',
      '저장공간':u.kb+'KB'
    };
    document.getElementById('archDebugBody').innerHTML=
      Object.entries(rows).map(function(kv){
        return '<div class="arch-dbg-row"><span class="arch-dbg-k">'+kv[0]+'</span><span class="arch-dbg-v">'+kv[1]+'</span></div>';
      }).join('');
  },
  sm:storageManager,
  um:undoManager,
  states:uiStates,
  state:function(){return AS;}
};

// ?debug=1 로 자동 활성화 (localhost 전용)
if(location.hostname==='localhost'&&location.search.includes('debug=1'))setTimeout(function(){SL.debug(true);},600);
document.getElementById('footYear').textContent=new Date().getFullYear();
// 2초마다 자동 갱신
setInterval(function(){if(_dbgMode)SL.refresh();},2000);

// ══════════════════════════════════════════════
// FIELD v1.0 — 현장 베타 안정화
// ══════════════════════════════════════════════

// ─── 1. 고대비 모드 ────────────────────────────
var _hcMode=false;
(function(){
  try{
    if(localStorage.getItem('sl_hc')){
      _hcMode=true;
      document.body.classList.add('high-contrast');
    }
  }catch(e){}
})();

function toggleHighContrast(){
  _hcMode=!_hcMode;
  document.body.classList.toggle('high-contrast',_hcMode);
  try{if(_hcMode)localStorage.setItem('sl_hc','1');else localStorage.removeItem('sl_hc');}catch(e){}
  var btn=document.getElementById('hcToggleBtn');
  if(btn)btn.textContent=_hcMode?'☀ 일반':'☀ 고대비';
  showToast(_hcMode?'☀️ 고대비 모드 ON (야외)':'고대비 모드 OFF',false);
}

// 헤더에 고대비 버튼 주입
(function _injectHcBtn(){
  setTimeout(function(){
    var hdr=document.querySelector('.app-hdr>div:last-child')||document.querySelector('.app-hdr');
    if(!hdr)return;
    var btn=document.createElement('button');
    btn.id='hcToggleBtn';btn.className='btn btn-ghost';
    btn.title='야외 고대비 모드';
    btn.textContent='☀ 고대비';
    btn.onclick=toggleHighContrast;
    hdr.appendChild(btn);
  },300);
})();

// ─── 2. 오프라인 배너 강화 ─────────────────────
(function _fieldOffline(){
  var banner=document.getElementById('fieldOfflineBanner');
  if(!banner)return;
  function _update(){
    var online=navigator.onLine;
    banner.classList.toggle('show',!online);
    document.body.classList.toggle('offline-active',!online);
    var cnt=document.getElementById('fieldOfflineCount');
    if(cnt)cnt.textContent=!online&&AS.abs&&AS.abs.length?'('+AS.abs.length+'타석 기록 중)':'';
    if(!online&&AS.abs&&AS.abs.length>0){
      storageManager.scheduleAutosave({
        abs:AS.abs,home_lineup:AS.home_lineup,away_lineup:AS.away_lineup,
        hs:AS.hs,as:AS.as,zoneHistory:AS.zoneHistory,
        th:(document.getElementById('tHome')||{}).value||'',
        ta:(document.getElementById('tAway')||{}).value||''
      },100);
    }
  }
  window.addEventListener('offline',_update);
  window.addEventListener('online',function(){_update();showToast('인터넷 연결 복구 ✓',false);});
  _update();
})();

// ─── 3. GF 상태 포함 autosave 강화 ─────────────
(function _enhanceAutosave(){
  var _orig=storageManager.scheduleAutosave.bind(storageManager);
  storageManager.scheduleAutosave=function(data,delay){
    var enhanced=Object.assign({},data,{
      gf:{active:GF.active,inning:GF.inning,half:GF.half,outs:GF.outs,
          batterIdx:GF.batterIdx,bases:GF.bases?GF.bases.slice():[false,false,false]}
    });
    _orig(enhanced,delay);
  };
})();

// GF 상태 복구 강화
(function _enhanceRecovery(){
  var _orig=archRecoverAutosave;
  archRecoverAutosave=function(){
    var rec=storageManager.getRecovery();
    var gfData=rec&&rec.data?rec.data.gf:null;
    _orig.apply(this,arguments);
    if(gfData&&gfData.active){
      setTimeout(function(){
        try{
          GF.inning=gfData.inning||1;
          GF.half=gfData.half||'top';
          GF.outs=gfData.outs||0;
          GF.batterIdx=gfData.batterIdx||0;
          GF.bases=gfData.bases||[false,false,false];
          if(typeof gfActivate==='function')gfActivate();
        }catch(e){console.warn('[Recovery] GF 복구 실패',e);}
      },200);
    }
  };
})();

// ─── 4. 데이터 무결성 검사 ─────────────────────
(function _integrityCheck(){
  setTimeout(function(){
    try{
      var raw=localStorage.getItem('sl_saves');
      if(!raw)return;
      var saves=JSON.parse(raw);
      if(!Array.isArray(saves)){localStorage.setItem('sl_saves','[]');return;}
      var valid=saves.filter(function(s){
        if(!s||typeof s.key!=='string')return false;
        try{var d=localStorage.getItem(s.key);return!!d&&Array.isArray(JSON.parse(d).abs);}
        catch(e){return false;}
      });
      if(valid.length<saves.length){
        localStorage.setItem('sl_saves',JSON.stringify(valid));
        console.log('[Integrity] 손상 항목 '+( saves.length-valid.length)+'개 제거');
      }
    }catch(e){console.warn('[Integrity] 검사 실패',e);}
  },2000);
})();

// ─── 5. 연속 클릭 방지 (스팸 가드) ───────────
(function _spamGuard(){
  var _lock=false,_lockTimer=null;
  function _guard(fn){
    return function(){
      if(_lock)return;
      _lock=true;
      clearTimeout(_lockTimer);
      _lockTimer=setTimeout(function(){_lock=false;},700);
      try{fn.apply(this,arguments);}catch(e){_lock=false;throw e;}
    };
  }
  // recHit/recOther는 이미 undoManager 패치됨 — 그 위에 스팸 가드 추가
  var _rh=recHit;recHit=_guard(function(r){_rh.apply(this,arguments);});
  var _ro=recOther;recOther=_guard(function(r){_ro.apply(this,arguments);});
})();

// ─── 6. Ctrl+Z / Ctrl+Y 키보드 단축키 ──────────
document.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key==='z'){
    e.preventDefault();undoLast();
  }
  if(((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==='Z')||
     ((e.ctrlKey||e.metaKey)&&e.key==='y')){
    e.preventDefault();undoManager.redo();
  }
});

// ─── 7. 피드백 시스템 ─────────────────────────
var _ffmTags=[];
function ffmToggle(el){
  el.classList.toggle('on');
  var v=el.dataset.v,i=_ffmTags.indexOf(v);
  if(i>=0)_ffmTags.splice(i,1);else _ffmTags.push(v);
}
function fieldFeedbackOpen(){
  var m=document.getElementById('fieldFeedbackModal');if(!m)return;
  m.classList.add('show');
  var ta=document.getElementById('ffmText');if(ta)ta.value='';
  _ffmTags=[];
  document.querySelectorAll('.ffm-tag').forEach(function(t){t.classList.remove('on');});
}
function fieldFeedbackClose(){
  var m=document.getElementById('fieldFeedbackModal');if(m)m.classList.remove('show');
}
function fieldFeedbackSubmit(){
  var text=(document.getElementById('ffmText')||{}).value||'';
  var tags=_ffmTags.slice();
  var entry={ts:Date.now(),tags:tags,text:text.trim(),
    abs:(AS.abs||[]).length,ver:'1.2.0',ua:navigator.userAgent.slice(0,80)};
  try{
    var list=JSON.parse(localStorage.getItem('sl_feedback')||'[]');
    list.push(entry);if(list.length>50)list=list.slice(-50);
    localStorage.setItem('sl_feedback',JSON.stringify(list));
  }catch(e){}
  var subject='SprayLab 피드백'+(tags.length?' ['+tags.join(',')+']':'');
  var body='[태그] '+(tags.join(', ')||'없음')+'\n\n[내용]\n'+(text.trim()||'(내용 없음)')+'\n\n---\n타석 수: '+entry.abs+'\n버전: '+entry.ver;
  window.open('mailto:jeongcheol13@naver.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body));
  fieldFeedbackClose();
  showToast('메일 앱이 열립니다 ✓',false);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUPABASE 클라우드 동기화
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function(){
  var SURL='https://bsmbrngkpsdmbwoqcrps.supabase.co';
  var SKEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWJybmdrcHNkbWJ3b3FjcnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTE1OTcsImV4cCI6MjA5NDk4NzU5N30.kVkKSvrXMtVOEtTNEELr8_9bQret60pTngFRsHgY5nk';
  var _sb=null;

  function _init(){
    if(_sb)return _sb;
    if(window.supabase&&window.supabase.createClient){
      _sb=window.supabase.createClient(SURL,SKEY);
    }
    return _sb;
  }

  function _setCloudUI(tc){
    // 모달 상태 표시
    var st=document.getElementById('cloudTeamStatus');
    if(st)st.textContent=tc?'현재 팀 코드: '+tc:'팀 코드가 설정되지 않았습니다';
    // 입력창 placeholder
    var inp=document.getElementById('teamCodeInput');
    if(inp)inp.placeholder=tc?'현재: '+tc:'예: tigers2024';
    // 동기화 버튼
    var syncBtn=document.getElementById('cloudSyncBtn');
    if(syncBtn)syncBtn.textContent='☁️ 동기화 — 클라우드에서 가져오기'+(tc?' ('+tc+')':'');
  }

  window.getTeamCode=function(){
    return localStorage.getItem('sl_team_code')||'';
  };

  window.openCloudOverlay=function(){
    _setCloudUI(getTeamCode());
    openOverlay('cloudOverlay');
    // 오버레이 열릴 때 자동으로 연결 상태 확인
    setTimeout(function(){window.cloudTest&&cloudTest();},300);
  };

  window.setTeamCode=function(){
    var inp=document.getElementById('teamCodeInput');
    if(!inp)return;
    var code=(inp.value||'').trim().toLowerCase();
    if(!code){showToast('팀 코드를 입력해 주세요',false);return;}
    localStorage.setItem('sl_team_code',code);
    inp.value='';
    _setCloudUI(code);
    showToast('팀 코드 설정 완료: '+code,false);
    // 팀 코드 설정 후 자동 연결 확인
    setTimeout(function(){window.cloudTest&&cloudTest();},200);
  };

  // 연결 테스트
  window.cloudTest=function(){
    var btn=document.getElementById('cloudTestBtn');
    var st=document.getElementById('cloudConnStatus');
    function setStatus(ok,msg){
      if(st){st.textContent=msg;st.style.color=ok?'var(--green)':ok===null?'var(--yellow)':'var(--red)';}
      if(btn){btn.disabled=false;btn.textContent='🔌 연결 테스트';}
    }
    if(btn){btn.disabled=true;btn.textContent='테스트 중…';}
    if(st){st.textContent='⏳ 연결 확인 중…';st.style.color='var(--text3)';}

    // 1단계: 라이브러리 로딩 확인
    var db=_init();
    if(!db){
      // CDN 로딩 실패 → 재시도
      setStatus(null,'⚠️ Supabase 라이브러리 로딩 중… 잠시 후 다시 시도하세요');
      return;
    }

    // 2단계: DB 접속 확인
    db.from('games').select('id',{count:'exact',head:true}).then(function(r){
      if(r.error){
        var code=r.error.code||'';
        var msg=r.error.message||JSON.stringify(r.error);
        if(code==='42P01'||msg.indexOf('does not exist')>-1){
          setStatus(false,'❌ 테이블 없음 — SQL 설정이 필요합니다 (아래 펼쳐보세요)');
        } else if(code==='42501'||msg.indexOf('permission')>-1||msg.indexOf('policy')>-1){
          setStatus(false,'❌ 접근 권한 없음 — RLS 정책 설정이 필요합니다 (아래 SQL 실행)');
        } else {
          setStatus(false,'❌ 오류: '+msg);
        }
      } else {
        var tc=getTeamCode();
        var countMsg=tc?'팀['+tc+'] 경기 '+(r.count||0)+'개':'팀 코드를 설정하면 동기화 시작';
        setStatus(true,'✅ 연결 성공! '+countMsg);
        if(tc)showToast('✅ 클라우드 연결 확인 — '+countMsg,false);
      }
    });
  };

  window.cloudSave=function(key,data,label,ts){
    if(!_init()||!getTeamCode())return;
    if(typeof navigator!=='undefined'&&!navigator.onLine)return; // 오프라인 시 조기 리턴
    _sb.from('games').upsert({
      team_code:getTeamCode(),game_key:key,game_data:data,label:label||key,ts:ts||Date.now()
    },{onConflict:'team_code,game_key'}).then(function(r){
      if(r.error){
        console.warn('[SprayLab] CloudSave error:',r.error);
        // 로컬 저장이 이미 완료됐으므로 에러 토스트 표시 안 함
      }
    }).catch(function(e){
      console.warn('[SprayLab] CloudSave network error:',e);
      // 네트워크 오류도 조용히 무시 (로컬 저장 성공)
    });
  };

  window.cloudDelete=function(key){
    if(!_init()||!getTeamCode())return;
    _sb.from('games').delete()
      .eq('team_code',getTeamCode()).eq('game_key',key)
      .then(function(r){if(r.error)console.warn('[SprayLab] CloudDelete error:',r.error);});
  };

  // 클라우드 → 로컬 동기화
  window.cloudSync=function(){
    if(!_init()){showToast('☁️ 클라우드 연결 중…',false,true);return;}
    var tc=getTeamCode();
    if(!tc){showToast('먼저 팀 코드를 설정해 주세요',false);openCloudOverlay();return;}
    var btn=document.getElementById('cloudSyncBtn');
    if(btn){btn.disabled=true;btn.textContent='☁️ 동기화 중…';}
    _sb.from('games').select('*').eq('team_code',tc).then(function(r){
      if(btn){btn.disabled=false;btn.textContent='☁️ 동기화 — 클라우드에서 가져오기 ('+tc+')';}
      if(r.error){
        var errMsg=r.error.message||r.error.code||JSON.stringify(r.error);
        var st=document.getElementById('cloudConnStatus');
        if(st){st.textContent='❌ 동기화 실패: '+errMsg;st.style.color='var(--red)';}
        showToast('☁️ 동기화 실패 — '+errMsg+'\n👉 Supabase SQL 설정을 확인하세요',false,true);
        return;
      }
      var rows=r.data||[];
      var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
      var existMap={};saves.forEach(function(s){existMap[s.key]=true;});
      var added=0,updated=0;
      rows.forEach(function(row){
        var k=row.game_key,gd=row.game_data;
        if(!existMap[k]){
          saves.push({key:k,label:row.label||k,ts:row.ts||0});
          localStorage.setItem(k,JSON.stringify(gd));added++;
        } else {
          var local=JSON.parse(localStorage.getItem(k)||'null');
          if(!local||(row.ts&&row.ts>(local.ts||0))){
            localStorage.setItem(k,JSON.stringify(gd));updated++;
          }
        }
      });
      localStorage.setItem('sl_saves',JSON.stringify(saves));
      var msg='☁️ 동기화 완료';
      if(added)msg+=' — '+added+'개 추가';
      if(updated)msg+=', '+updated+'개 업데이트';
      if(!added&&!updated)msg+=' — 이미 최신 상태';
      var st=document.getElementById('cloudConnStatus');
      if(st){st.textContent='✅ '+msg.replace('☁️ ','');st.style.color='var(--green)';}
      showToast(msg,false);
    });
  };

  // 로컬 → 클라우드 전체 업로드
  window.cloudUploadAll=function(){
    if(!_init()){showToast('☁️ 클라우드 연결 중…',false,true);return;}
    var tc=getTeamCode();
    if(!tc){showToast('먼저 팀 코드를 설정해 주세요',false);return;}
    var saves=JSON.parse(localStorage.getItem('sl_saves')||'[]');
    if(!saves.length){showToast('업로드할 경기가 없습니다',false);return;}
    var btn=document.getElementById('cloudUploadAllBtn');
    if(btn){btn.disabled=true;btn.textContent='⬆️ 업로드 중…';}
    var rows=saves.map(function(s){
      var gd=JSON.parse(localStorage.getItem(s.key)||'null');
      if(!gd)return null;
      return{team_code:tc,game_key:s.key,game_data:gd,label:s.label,ts:s.ts||gd.ts||0};
    }).filter(Boolean);
    _sb.from('games').upsert(rows,{onConflict:'team_code,game_key'}).then(function(r){
      if(btn){btn.disabled=false;btn.textContent='⬆️ 전체 업로드 — 내 기기 경기를 클라우드에 올리기';}
      if(r.error){showToast('☁️ 업로드 오류: '+r.error.message,false,true);return;}
      showToast('⬆️ '+rows.length+'개 경기 업로드 완료',false);
    });
  };

  // 페이지 로드 시 팀코드 상태 표시
  window.addEventListener('load',function(){
    setTimeout(function(){
      _init();
      _setCloudUI(getTeamCode());
    },500);
  });
})();

// ─── 8. 리포트 안전 수학 헬퍼 ─────────────────
var safe=window.safe={
  div:function(n,d){return(!d||isNaN(d)||!isFinite(d))?null:n/d;},
  avg:function(n,d){var r=safe.div(n,d);return r===null?'.---':r.toFixed(3).replace('0.','.');},
  pct:function(n,d){var r=safe.div(n,d);return r===null?'--':r.toFixed(1)+'%';},
  nn:function(v,fb){return(v===null||v===undefined||isNaN(v))?fb:v;}
};

// ─── 9. SL 디버그 객체 확장 ──────────────────
if(window.SL){
  SL.feedback={
    list:function(){return JSON.parse(localStorage.getItem('sl_feedback')||'[]');},
    clear:function(){localStorage.removeItem('sl_feedback');console.log('피드백 삭제됨');},
    export:function(){
      var b=new Blob([JSON.stringify(SL.feedback.list(),null,2)],{type:'application/json'});
      var a=document.createElement('a');a.href=URL.createObjectURL(b);
      a.download='sl-feedback-'+Date.now()+'.json';
      document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);},200);
    }
  };
  SL.hc={toggle:toggleHighContrast,state:function(){return _hcMode;}};
}


// ═══ Service Worker Registration ═══
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/baseball-spray-chart/sw.js').then(function(r){
      console.log('SW registered');
      // 업데이트 감지: 새 SW가 설치 대기 중이면 즉시 적용
      r.addEventListener('updatefound',function(){
        var newSW=r.installing;
        if(!newSW)return;
        newSW.addEventListener('statechange',function(){
          if(newSW.state==='installed'&&navigator.serviceWorker.controller){
            // 새 버전 발견 → SW에 즉시 활성화 요청 후 페이지 리로드
            // (localStorage 데이터는 보존됨)
            newSW.postMessage({type:'SKIP_WAITING'});
          }
        });
      });
      // 이미 업데이트 대기 중인 SW 있으면 즉시 적용
      if(r.waiting){
        r.waiting.postMessage({type:'SKIP_WAITING'});
      }
    }).catch(function(e){console.log('SW failed',e);});
    // SW 교체 완료 시 페이지 자동 새로고침 (데이터 보존)
    var _refreshing=false;
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(_refreshing)return;
      _refreshing=true;
      window.location.reload();
    });
  });
}

// ═══ Zone Canvas ═══
if(location.hostname!=='localhost'){
  var _dp=document.getElementById('archDebugPanel');
  if(_dp)_dp.remove();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 자유 클릭 투구 코스 캔버스
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var _ibZoneDots=[];
function _drawZoneCanvas(cvs, dots, isSmall){
  var W=cvs.width, H=cvs.height;
  var ctx=cvs.getContext('2d');
  ctx.clearRect(0,0,W,H);
  // 배경
  ctx.fillStyle='rgba(45,212,160,0.08)';
  ctx.fillRect(0,0,W,H);
  var zx1=W*0.22, zx2=W*0.78, zy1=H*0.15, zy2=H*0.85;
  var dz=(zx2-zx1)/3, dh=(zy2-zy1)/3;
  // 스트라이크존 배경
  ctx.fillStyle='rgba(30,37,53,0.9)';
  ctx.fillRect(zx1,zy1,zx2-zx1,zy2-zy1);
  // 존 그리드 라인
  ctx.strokeStyle='rgba(75,140,245,0.3)'; ctx.lineWidth=0.5;
  for(var i=1;i<3;i++){
    ctx.beginPath();ctx.moveTo(zx1+dz*i,zy1);ctx.lineTo(zx1+dz*i,zy2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(zx1,zy1+dh*i);ctx.lineTo(zx2,zy1+dh*i);ctx.stroke();
  }
  // 존 테두리
  ctx.strokeStyle='#4b8cf5'; ctx.lineWidth=1.5;
  ctx.strokeRect(zx1,zy1,zx2-zx1,zy2-zy1);
  // 볼존 텍스트
  var fs=isSmall?7:8;
  ctx.fillStyle='rgba(45,212,160,0.6)'; ctx.font=fs+'px sans-serif'; ctx.textAlign='center';
  ctx.fillText('볼',W/2,zy1-3);
  ctx.fillText('볼',W/2,zy2+fs+2);
  ctx.save();ctx.translate(zx1-3,H/2);ctx.rotate(-Math.PI/2);ctx.fillText('볼',0,0);ctx.restore();
  ctx.save();ctx.translate(zx2+3,H/2);ctx.rotate(Math.PI/2);ctx.fillText('볼',0,0);ctx.restore();
  // 투구 점 그리기
  dots.forEach(function(d){
    var col={'볼':'#2dd4a0','스트라이크':'#f6c23e','파울':'#a78bfa','안타':'#2dd4a0','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565','타격됨':'#f56565','직구':'#4b8cf5','슬라이더':'#f6c23e','커브':'#a78bfa','체인지업':'#2dd4a0','포크볼':'#fb923c','커터':'#8892a4','preview':'#e2e8f0'}[d.result]||'#f6c23e';
    ctx.beginPath();ctx.arc(d.cx*W,d.cy*H,isSmall?4:5,0,Math.PI*2);
    ctx.fillStyle=col+'cc';ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();
  });
}
function _getZoneFromPos(cx, cy){
  var zx1=0.22, zx2=0.78, zy1=0.15, zy2=0.85;
  if(cx<zx1) return '볼 내';
  if(cx>zx2) return '볼 외';
  if(cy<zy1) return '볼 위';
  if(cy>zy2) return '볼 아래';
  var col=cx<zx1+(zx2-zx1)/3?'내각':cx<zx1+(zx2-zx1)*2/3?'중앙':'외각';
  var row=cy<zy1+(zy2-zy1)/3?'높음':cy<zy1+(zy2-zy1)*2/3?'중간':'낮음';
  return col+' '+row;
}
function _zoneCanvasClick(e, cvs, cb){
  e.preventDefault();
  var rect=cvs.getBoundingClientRect();
  var src=e.touches?e.changedTouches[0]:e;
  var cx=(src.clientX-rect.left)/rect.width;
  var cy=(src.clientY-rect.top)/rect.height;
  cx=Math.max(0,Math.min(1,cx)); cy=Math.max(0,Math.min(1,cy));
  cb(cx,cy);
}
function ibZoneRedraw(){
  var cvs=document.getElementById('ibZoneCanvas');
  if(!cvs)return;
  _drawZoneCanvas(cvs,_ibZoneDots,false);
}
function initIbZoneCanvas(){
  var cvs=document.getElementById('ibZoneCanvas');
  if(!cvs||cvs._init)return; cvs._init=true;
  _drawZoneCanvas(cvs,[],false);
  function handler(e){
    _zoneCanvasClick(e,cvs,function(cx,cy){
      var zone=_getZoneFromPos(cx,cy);
      AS.zone=zone;
      var lbl=document.getElementById('ibZoneLabel');
      if(lbl)lbl.textContent=zone;
      if(AS.pt){
        // 구종 선택된 경우: 누적 기록 + 로그
        AS.zoneX=cx; AS.zoneY=cy;
        _ibZoneDots.push({cx:cx,cy:cy,result:AS.pt});
        logPitchAction();
        _drawZoneCanvas(cvs,_ibZoneDots,false);
      }else{
        // 구종 미선택: 미리보기 점만 표시 (기록 안 함)
        _drawZoneCanvas(cvs,_ibZoneDots.concat([{cx:cx,cy:cy,result:'preview'}]),false);
      }
    });
  }
  cvs.addEventListener('click',handler);
  cvs.addEventListener('touchend',handler,{passive:false});
}
function initPitcherZoneCanvas(){
  var cvs=document.getElementById('pitcherZoneCanvas');
  if(!cvs||cvs._init)return; cvs._init=true;
  _drawZoneCanvas(cvs,[],true);
  function handler(e){
    _zoneCanvasClick(e,cvs,function(cx,cy){
      var zone=_getZoneFromPos(cx,cy);
      AS.pitcherZone=zone;
      AS.pitcherZoneX=cx; AS.pitcherZoneY=cy;
      var lbl=document.getElementById('pitcherZoneLabel');
      if(lbl)lbl.textContent=zone;
      // 현재 점 표시 (결과 선택 전)
      _drawZoneCanvas(cvs,[{cx:cx,cy:cy,result:'스트라이크'}],true);
    });
  }
  cvs.addEventListener('click',handler);
  cvs.addEventListener('touchend',handler,{passive:false});
}
// 투구 기록 후 pitcherZoneCanvas 점 추가
var _origRecordPitch=recordPitch;
// 캔버스 초기화 실행
document.addEventListener('DOMContentLoaded',function(){
  initIbZoneCanvas();
  initPitcherZoneCanvas();
});
// swTab 후에도 초기화
var _origSwTab=swTab;
swTab=function(name,el){
  _origSwTab.apply(this,arguments);
  if(name==='rec')setTimeout(initIbZoneCanvas,50);
  if(name==='pitcher')setTimeout(initPitcherZoneCanvas,50);
};

