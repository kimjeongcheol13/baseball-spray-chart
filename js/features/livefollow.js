// 학부모 실시간 따라보기 (GameChanger ⑦) — 기록하는 폰이 경기 요약을 올리고, 학부모는 live.html?g=<id> 로 로그인 없이 본다
//   · 서버: sql/16_live_follow.sql — live_put(id, 쓰기 열쇠, 내용) · live_get(id). 표는 직접 못 읽고 못 쓴다
//   · 쓰기 열쇠는 이 기기 localStorage(sl_live)에만 둔다. 링크에는 id 만 → 링크를 받은 사람은 보기만 한다
//   · 15초마다 요약을 만들어 바뀌었을 때만 올린다(서버는 같은 링크 3초에 1번까지). 화면을 떠날 때(숨김) 한 번 더
//   · 이름은 공유 링크와 같게 기본으로 가린다(#등번호 · 김OO — core.js _anonLabel). 「선수 실명 포함」을 켜면 실명
//   · AS · GF 를 읽기만 한다 — 기록 · 저장 구조는 건드리지 않는다
// ponytail: 링크 하나 = 중계를 끌 때까지. 새 경기를 시작해도 같은 링크가 이어서 보여 준다(더블헤더) — 경기마다 나누려면 새 경기 때 끄기
import { HITS, NOAB, esc } from '../constants.js';

const SURL = 'https://bsmbrngkpsdmbwoqcrps.supabase.co';
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbWJybmdrcHNkbWJ3b3FjcnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTE1OTcsImV4cCI6MjA5NDk4NzU5N30.kVkKSvrXMtVOEtTNEELr8_9bQret60pTngFRsHgY5nk';
const LS = 'sl_live';
const EVERY = 15000;
const $ = id => document.getElementById(id);

let _db = null, _timer = null, _last = '', _busy = false, _okAt = 0, _err = '';
const db = () => _db || (_db = window.supabase && window.supabase.createClient
  ? window.supabase.createClient(SURL, SKEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null);
const load = () => { try { const s = JSON.parse(localStorage.getItem(LS) || 'null'); return s && s.id && s.key ? s : null; } catch (e) { return null; } };
const rnd = n => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', b = crypto.getRandomValues(new Uint8Array(n)); return Array.from(b, x => c[x % c.length]).join(''); };
const linkOf = s => new URL('live.html?g=' + s.id, location.href).href;

// ── 학부모에게 보낼 요약 (live.js 가 그린다) ──
export function livePayload(names) {
  const A = window.AS || {}, G = window.GF || {}, abs = (A.abs || []).filter(Boolean);
  const val = id => (($(id) || {}).value || '').trim();
  const lbl = (name, num) => (names ? String(name == null ? '' : name) : window._anonLabel ? window._anonLabel(name, num) : '선수');
  const side = a => (a.team === 'away' ? 'away' : 'home');
  const last = abs[abs.length - 1];
  const st = G.active
    ? { t: `${G.inning}회${G.half === 'top' ? '초' : '말'}`, o: G.outs | 0, b: (G.bases || []).map(x => (x ? 1 : 0)) }
    : { t: last ? String(last.inn || '') : '', o: null, b: null };
  const h = { home: 0, away: 0 };
  abs.forEach(a => { if (HITS.includes(a.res)) h[side(a)]++; });
  const bat = Object.create(null);
  abs.filter(a => side(a) === 'home' && a.bname).forEach(a => {
    const k = a.bid != null ? 'i' + a.bid : 'n' + a.bname;
    const r = bat[k] || (bat[k] = { n: lbl(a.bname, a.bnum), pa: 0, ab: 0, h: 0, rbi: 0 });
    r.pa++; if (!NOAB.includes(a.res)) r.ab++; if (HITS.includes(a.res)) r.h++; r.rbi += a.rbi || 0;
  });
  return {
    v: 1, th: val('tHome'), ta: val('tAway'), hs: +A.hs || 0, as: +A.as || 0, st, h,
    ls: window.slLineScore ? window.slLineScore(abs) : null,
    plays: abs.slice(-8).reverse().map(a => ({ t: String(a.inn || ''), s: side(a), n: lbl(a.bname, a.bnum), r: String(a.res || ''), rbi: a.rbi || 0 })),
    bat: Object.values(bat),
    at: Date.now(),
  };
}

// ── 올리기 ──
function put(s, p) { const d = db(); return d ? d.rpc('live_put', { p_id: s.id, p_key: s.key, p_payload: p }) : Promise.resolve({ error: { code: 'no_client' } }); }
const why = e => {
  const c = e && e.code;
  if (c === 'PGRST202' || c === '42883' || c === 'no_client') return '실시간 중계 서버가 아직 준비 중이에요';
  if (c === '42501') return '이 링크는 이 폰에서 만든 것이 아니라 고칠 수 없어요';
  return '올리지 못했어요 — 인터넷 연결을 확인해 주세요 (계속 다시 시도해요)';
};

export function liveTick(force) {
  const s = load();
  if (!s || !s.on) { liveTimer(false); return Promise.resolve(); }
  const p = livePayload(s.names), j = JSON.stringify(Object.assign({}, p, { at: 0 }));
  if (_busy || (!force && j === _last)) return Promise.resolve();
  _busy = true;
  return put(s, p).then(r => {
    _busy = false;
    if (r && r.error) {
      if (r.error.code === 'PT429') return;   // 너무 잦음 — 다음 차례에 다시
      _err = why(r.error);
      if (r.error.code === '42501' || r.error.code === 'PGRST202' || r.error.code === '42883') { localStorage.removeItem(LS); liveTimer(false); }
    } else { _last = j; _okAt = Date.now(); _err = ''; }
    paint();
  }, e => { _busy = false; _err = why(e); paint(); });
}

export function liveTimer(on) {
  clearInterval(_timer); _timer = null;
  if (on) _timer = setInterval(liveTick, EVERY);
}

function start() {
  const names = !!($('liveNames') || {}).checked;
  const s = { id: rnd(12), key: rnd(32), names, on: true };
  _err = ''; _last = '';
  const btn = $('liveStart'); if (btn) btn.disabled = true;
  return put(s, livePayload(names)).then(r => {
    if (btn) btn.disabled = false;
    if (r && r.error) { _err = why(r.error); paint(); return; }
    localStorage.setItem(LS, JSON.stringify(s));
    _okAt = Date.now(); _last = JSON.stringify(Object.assign({}, livePayload(names), { at: 0 }));
    liveTimer(true); paint();
    if (window.showToast) window.showToast('📡 실시간 중계를 시작했어요 — 링크를 학부모 단톡방에 보내 주세요', false, 3500);
  }, e => { if (btn) btn.disabled = false; _err = why(e); paint(); });
}

function stop() {
  const s = load();
  localStorage.removeItem(LS); liveTimer(false); _err = '';
  if (s) Promise.resolve(put(s, Object.assign(livePayload(s.names), { end: true }))).catch(() => {});   // 학부모 화면에 「중계 끝」 · supabase-js rpc 는 .catch 가 없는 thenable
  paint();
  if (window.showToast) window.showToast('실시간 중계를 껐어요', false, 2500);
}

function share() {
  const s = load(); if (!s) return;
  const url = linkOf(s), val = id => (($(id) || {}).value || '').trim();
  const text = `${val('tHome') || '우리 팀'} vs ${val('tAway') || '상대'} 실시간 점수`;
  if (navigator.share) { navigator.share({ title: 'SprayLab 실시간 중계', text, url }).catch(() => {}); return; }
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
    () => window.showToast && window.showToast('링크를 복사했어요', false, 2000),
    () => { const i = $('liveUrl'); if (i) { i.select(); } });
}

// ── 창 ──
function mount() {
  if ($('liveOverlay')) return;
  document.body.insertAdjacentHTML('beforeend', `
<div class="overlay" id="liveOverlay" role="dialog" aria-modal="true" aria-labelledby="liveTitle">
  <div class="modal dm-modal lv-modal">
    <div class="dm-hdr">
      <div class="modal-title" id="liveTitle" style="margin-bottom:0">📡 학부모 실시간 링크</div>
      <button type="button" class="dm-x" onclick="closeOverlay('liveOverlay')" aria-label="닫기">✕</button>
    </div>
    <div class="modal-sub">링크를 받은 사람은 로그인 없이 점수 · 이닝 · 최근 타석을 볼 수 있어요. 기록하는 이 폰이 15초마다 올려요.</div>
    <div id="liveBody"></div>
  </div>
</div>`);
}

function paint() {
  const b = $('liveBody'); if (!b) return;
  const s = load(), t = _okAt ? new Date(_okAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  const err = _err ? `<p class="lv-err" role="alert">${esc(_err)}</p>` : '';
  b.innerHTML = s && s.on ? `
    <label class="lv-lbl" for="liveUrl">학부모에게 보낼 링크</label>
    <input id="liveUrl" class="lv-url" readonly value="${esc(linkOf(s))}" onclick="this.select()">
    <p class="lv-st">● 중계 중${t ? ` · 마지막으로 올림 ${esc(t)}` : ''}${s.names ? ' · 실명' : ' · 이름 가림'}</p>${err}
    <div class="lv-btns"><button type="button" class="btn btn-primary" onclick="slLive.share()">링크 보내기</button><button type="button" class="btn btn-ghost" onclick="slLive.stop()">중계 끄기</button></div>` : `
    <label class="lv-chk"><input type="checkbox" id="liveNames"> 선수 실명 포함 <small>(끄면 #등번호 · 김OO)</small></label>${err}
    <div class="lv-btns"><button type="button" class="btn btn-primary" id="liveStart" onclick="slLive.start()">링크 만들고 중계 시작</button></div>`;
}

export function openLiveFollow() {
  mount(); paint();
  window.openOverlay('liveOverlay');
}

if (typeof window !== 'undefined') {
  window.openLiveFollow = openLiveFollow;
  window.slLive = { start, stop, share, tick: liveTick, payload: livePayload };
  if (load()) liveTimer(true);   // 새로고침 뒤에도 이어서
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && load()) liveTick(); });
}
