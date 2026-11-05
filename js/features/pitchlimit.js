// 투구 수 관리 — 하루 투구 수 · 의무 휴식일 · 다음 등판 가능일 (경기설정에서 켠 기기만, 기본 꺼짐)
//   기본 규정 = 고교 2025 보도(SPOTV 2025-08-23): 하루 최대 105구 · 1~45 휴식 없음 · 46~60 1일 · 61~75 2일 · 76~90 3일 · 91~105 4일
//   대회 요강과 다를 수 있어 구간 · 최대는 직접 고친다. 휴식 N일 = 던진 다음 날부터 N일 쉬고 그다음 날 등판 (월요일 4일 → 토요일)
//   저장: sl_pitch_rule (이 기기만, 동기화 안 함). 경기 데이터는 읽기만 한다.
//   하루 = 같은 날짜 경기의 합(더블헤더). 같은 투수 = 이름이 같고 번호가 같거나 한쪽이 비어 있음 (core.js addPitcher 와 같은 규칙)
//   경기 날짜 = 경기 정보 날짜(info.date) → 없으면 첫 투구 시각(투구 id = Date.now()) → 저장 시각. 지금 경기 = AS.info.date, 없으면 오늘
//   3일 연속 등판 금지(c3, 켠 때만) = Little League 본부 규정 NOTE 1 "Under no circumstance shall a player pitch in three (3) consecutive days" — 1~20구(휴식 0일)여도 적용
import { esc } from '../constants.js';

const KEY = 'sl_pitch_rule';
export const DEF = { on: false, max: 105, tiers: [[45, 0], [60, 1], [75, 2], [90, 3], [105, 4]] };
// 기본값 고르기 (경기설정 카드 버튼). 중학 · 리틀 = Little League 본부 규정(littleleague.org pitch-count, 14세 이하 휴식표):
//   하루 최대 9~10세 75 · 11~12세 85 · 13~16세 95, 휴식 1~20 0일 · 21~35 1 · 36~50 2 · 51~65 3 · 66 이상 4 · 3일 연속 등판 금지
//   고교(2025 보도)는 3일 연속 규정을 확인 못 해 끈다
const LL = [[20, 0], [35, 1], [50, 2], [65, 3]];
export const PRESETS = {
  hs:   { label: '고교',         max: 105, tiers: DEF.tiers,       c3: false },
  ms:   { label: '중학',         max: 95,  tiers: [...LL, [95, 4]], c3: true },
  ll12: { label: '리틀 11~12세', max: 85,  tiers: [...LL, [85, 4]], c3: true },
  ll10: { label: '리틀 9~10세',  max: 75,  tiers: [...LL, [75, 4]], c3: true },
};
const DAY = '일월화수목금토';
const int = (v, lo, hi) => { v = Math.floor(Number(v)); return isFinite(v) && v >= lo && v <= hi ? v : null; };

// ── 규정 ─────────────────────────────────────────────────────
export function norm(r) {
  r = r && typeof r === 'object' ? r : {};
  const tiers = (Array.isArray(r.tiers) ? r.tiers : [])
    .map(t => Array.isArray(t) ? [int(t[0], 1, 300), int(t[1], 0, 30)] : [null, null])
    .filter(t => t[0] != null && t[1] != null)
    .sort((a, b) => a[0] - b[0])
    .filter((t, i, a) => !i || t[0] !== a[i - 1][0]);
  return { on: r.on === true, max: int(r.max, 1, 300) || DEF.max, tiers: tiers.length ? tiers : DEF.tiers.map(t => t.slice()), c3: r.c3 === true };
}
export function getRule() { try { return norm(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return norm(null); } }
export function setRule(patch) {
  const r = norm({ ...getRule(), ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {}
  return r;
}
// 이 투구 수면 쉬어야 하는 날 수 (마지막 구간을 넘으면 마지막 구간 값)
export function restFor(n, r) {
  if (!(n > 0)) return 0;
  for (const [to, rest] of r.tiers) if (n <= to) return rest;
  return r.tiers[r.tiers.length - 1][1];
}

// ── 날짜 (YYYY-MM-DD 문자열) ─────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export function dayOf(ms) { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function addDays(s, k) {
  const m = ISO.exec(s); if (!m) return null;
  const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3] + k));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function fmt(s) {
  const m = ISO.exec(s || ''); if (!m) return '';
  return `${+m[2]}-${m[3]}(${DAY[new Date(Date.UTC(+m[1], m[2] - 1, +m[3])).getUTCDay()]})`;
}
const okDate = s => typeof s === 'string' && ISO.test(s);
function liveDate() { const A = window.AS || {}; return A.info && okDate(A.info.date) ? A.info.date : dayOf(Date.now()); }
// 저장 경기(SLGames.loadGames 항목)의 날짜
function gameDate(g) {
  const info = g.data && g.data.info;
  if (info && okDate(info.date)) return info.date;
  let first = Infinity;
  (g.pitchers || []).forEach(p => (p.pitches || []).forEach(x => { if (typeof x.id === 'number' && x.id >= 1e11 && x.id < first) first = x.id; }));
  if (first < Infinity) return dayOf(first);
  return isFinite(g.first) ? dayOf(g.first) : g.ms > 0 && isFinite(g.ms) ? dayOf(g.ms) : null;
}

// ── 투수별 날짜별 투구 수 ─────────────────────────────────────
export const same = (a, b) => a.name === b.name && (!a.num || !b.num || String(a.num) === String(b.num));
// 상대 투수 = 우리 타자에게 던진 공(bteam 'home')이 상대 타자에게 던진 공('away')보다 많은 투수 (recap.js 마운드 문단과 같은 규칙) — 경기마다 따로 본다
//   타자 팀을 모르는 공(타자를 안 고르고 적은 공 · 옛 기록)만 있으면 우리 투수로 본다
export function isOpp(p) {
  let a = 0, h = 0;
  ((p && p.pitches) || []).forEach(x => { if (x && x.bteam === 'away') a++; else if (x && x.bteam === 'home') h++; });
  return h > a;
}
// list = [{ date, pitchers }] → [{ name, num, days: { 날짜: 투구 수 } }] (상대 투수는 뺀다)
export function history(list) {
  const out = [];
  list.forEach(({ date, pitchers }) => {
    if (!okDate(date)) return;
    (pitchers || []).forEach(p => {
      const n = (p && Array.isArray(p.pitches)) ? p.pitches.length : 0;
      if (!n || !p.name || isOpp(p)) return;
      let h = out.find(x => same(x, p));
      if (!h) out.push(h = { name: p.name, num: p.num ? String(p.num) : '', days: {} });
      else if (!h.num && p.num) h.num = String(p.num);
      h.days[date] = (h.days[date] || 0) + n;
    });
  });
  return out;
}
// 날짜 T 기준 상태: today(그날 투구 수) · rest(그날 기준 휴식) · block(앞 경기 휴식이 끝나 등판 가능한 날, T 이후일 때만) · next(다음 등판 가능일)
//   r.c3(3일 연속 등판 금지): c3 = 어제 · 그제 던져서 오늘 못 던짐(block = 내일) · n3 = 어제 · 오늘 던져서 내일 못 던짐(next = 모레)
export function status(h, T, r) {
  let block = null, last = null;
  Object.keys(h.days).forEach(d => {
    if (d > T) return;   // 앞으로의 날짜(잘못 적은 경기 날짜)는 무시
    if (!last || d > last) last = d;
    if (d < T) { const f = addDays(d, restFor(h.days[d], r) + 1); if (f > T && (!block || f > block)) block = f; }
  });
  const today = h.days[T] || 0, rest = restFor(today, r);
  const y1 = h.days[addDays(T, -1)] > 0, y2 = h.days[addDays(T, -2)] > 0;
  const b3 = r.c3 && y1 && y2 ? addDays(T, 1) : null;
  const c3 = !!b3 && !block;   // 휴식일로도 막혀 있으면(그 날은 늘 내일 이후) 휴식일로 본다
  if (c3) block = b3;
  let next = today ? addDays(T, rest + 1) : block;
  if (block && next && block > next) next = block;
  const n3 = !!(r.c3 && today && y1 && next < addDays(T, 2));
  if (n3) next = addDays(T, 2);
  return { today, rest, last, lastN: last ? h.days[last] : 0, block, next, left: r.max - today, c3, n3 };
}

// 저장 경기(지금 경기 제외)는 sl_saves 가 바뀔 때만 다시 읽는다 — 공 하나마다 전체 경기를 읽지 않게
let _cache = { sig: null, list: [] };
function _others() {
  let sig = null;
  try { sig = localStorage.getItem('sl_saves') || ''; } catch (e) {}
  if (sig !== _cache.sig || sig === null) {
    let games = [];
    try { games = window.SLGames ? window.SLGames.loadGames({ withCurrent: true }).filter(g => !g.live) : []; } catch (e) {}
    _cache = { sig, list: games.map(g => ({ date: gameDate(g), pitchers: g.pitchers })) };
  }
  return _cache.list;
}
// 지금 경기에 있는 공(같은 투구 id)은 다른 경기에서 뺀다 — 저장 경기를 불러와 이어 던지면 저장본 + 지금 경기로 두 번 셌다 (games.js 도 투구 id 로 중복을 뺀다)
function _all() {
  const cur = (window.AS || {}).pitchers || [], ids = new Set();
  cur.forEach(p => (p.pitches || []).forEach(x => { if (x && x.id != null) ids.add(x.id); }));
  const others = _others().map(g => ({ date: g.date, pitchers: (g.pitchers || []).map(p => ({ ...p, pitches: (p.pitches || []).filter(x => !(x && x.id != null && ids.has(x.id))) })) }));
  return history([...others, { date: liveDate(), pitchers: cur }]);
}
const _who = p => (p.num ? '#' + p.num + ' ' : '') + p.name;

// ── 투구 기록 화면: 카운트 줄 아래 한 줄 (core.js renderPitchCount) ──
export function barHtml() {
  const r = getRule(), P = (window.AS || {}).currentPitcher;
  if (!r.on || !P || !P.name || isOpp(P)) return '';
  const T = liveDate(), h = _all().find(x => same(x, P));
  const s = h ? status(h, T, r) : { today: 0, rest: 0, block: null, next: null, left: r.max };
  let t, warn = false;
  if (s.block && s.today === 0) { warn = true; t = s.c3 ? `⚠ 3일 연속 등판 금지 — 어제 · 그제 던졌어요 · ${fmt(s.block)}부터 등판 가능` : `⚠ 휴식 중 — ${fmt(s.block)}부터 등판 가능 (${fmt(s.last)} ${s.lastN}구)`; }
  else {
    t = `오늘 ${s.today}구 / 최대 ${r.max}`;
    if (s.today > r.max) { warn = true; t += ` · ${s.today - r.max}구 넘음`; }
    else if (s.today) t += ` · 휴식 ${s.rest}일 → ${fmt(s.next)}부터` + (s.n3 && !s.c3 ? ' (3일 연속 금지)' : '');
    if (s.block && s.today) { warn = true; t = (s.c3 ? '⚠ 3일 연속 등판 · ' : '⚠ 휴식 중 등판 · ') + t; }
  }
  return `<div class="pcnt-limit${warn ? ' warn' : ''}">${esc(t)}</div>`;
}

// ── 공 하나 기록한 뒤 (core.js recordPitch): 구간이 바뀌거나 최대에 가까우면 알림 ──
export function onPitch() {
  const r = getRule(), P = (window.AS || {}).currentPitcher;
  if (!r.on || !P || !P.name || isOpp(P) || typeof window.showToast !== 'function') return;
  const T = liveDate(), h = _all().find(x => same(x, P));
  if (!h) return;
  const s = status(h, T, r), n = s.today, who = _who(P);
  let m = null;
  if (n === 1 && s.block) m = s.c3 ? `⚠ ${who} 어제 · 그제도 던졌어요 — 3일 연속 등판 금지 (오늘은 쉬어야 해요)` : `⚠ ${who} 휴식 중이에요 — ${fmt(s.block)}부터 등판 가능 (${fmt(s.last)} ${s.lastN}구)`;
  else if (n === 1 && s.n3) m = `${who} 어제도 던졌어요 — 내일은 쉬어야 해요 (3일 연속 등판 금지) · ${fmt(s.next)}부터`;
  else if (n === r.max + 1) m = `⚠ ${who} 오늘 ${n}구 — 하루 최대 ${r.max}구를 넘었어요`;
  else if (n === r.max) m = `${who} 오늘 ${n}구 — 하루 최대예요 · 휴식 ${s.rest}일`;
  else if (n < r.max && restFor(n, r) > restFor(n - 1, r)) m = `${who} 오늘 ${n}구 — 이제 휴식 ${s.rest}일 (${fmt(s.next)}부터 등판)`;
  else if (r.max - n === 10) m = `${who} 오늘 ${n}구 — 하루 최대까지 10구 남았어요`;
  if (m) window.showToast(m, false, 5000);
}

// ── 경기설정 카드 (setup.js) ──────────────────────────────────
function _statusHtml(r) {
  const T = liveDate(), from = addDays(T, -14);
  const rows = _all().map(h => ({ h, s: status(h, T, r) })).filter(x => x.s.last && x.s.last >= from);
  if (!rows.length) return `<p class="pl-empty">최근 14일 안에 투구 기록이 있는 투수가 없어요. 투수 탭에서 공을 기록하면 여기 나와요.</p>`;
  // 쉬어야 하는 투수 = 다음 등판일이 오늘(오늘 던졌으면 내일) 뒤 — 오늘 45구(휴식 0일)는 빨간 '내일부터'가 아니라 '오늘 N구 더'
  const wait = s => !!s.next && s.next > (s.today ? addDays(T, 1) : T);
  rows.sort((a, b) => wait(b.s) - wait(a.s) || (b.s.last > a.s.last ? 1 : b.s.last < a.s.last ? -1 : 0));
  return `<ul class="pl-list">${rows.slice(0, 12).map(({ h, s }) => {
    const w = wait(s);
    return `<li><b>${esc(_who(h))}</b><span>${esc(fmt(s.last))} ${s.lastN}구</span><em class="${w ? 'no' : 'ok'}">${w ? esc(fmt(s.next)) + '부터' : s.today ? `오늘 ${Math.max(0, s.left)}구 더` : '오늘 가능'}</em></li>`;
  }).join('')}</ul>`;
}
export function cardHtml() {
  const r = getRule();
  const on = `<label class="pl-on"><input type="checkbox"${r.on ? ' checked' : ''} onchange="plOn(this.checked)"><span><b>투구 수 알림 · 휴식일</b><small>리틀 · 중고교 · 대학 팀용 · 이 기기에만 저장</small></span></label>`;
  if (!r.on) return `<header class="sb-card-hd"><h2>투구 수 관리</h2></header>${on}
    <p class="st-note">켜면 투구 기록 화면에 오늘 투구 수와 휴식일이 나오고, 휴식 구간이 바뀔 때 알려 줘요.</p>`;
  const tier = ([to, rest], i) => `<tr><td><label>~ <input type="number" inputmode="numeric" min="1" max="300" value="${to}" onchange="plTier(${i},0,this.value)" aria-label="${i + 1}번째 구간 투구 수"> 구</label></td>`
    + `<td><label><input type="number" inputmode="numeric" min="0" max="30" value="${rest}" onchange="plTier(${i},1,this.value)" aria-label="${i + 1}번째 구간 휴식일"> 일</label></td></tr>`;
  return `<header class="sb-card-hd"><h2>투구 수 관리</h2></header>${on}
    <div class="st-dists pl-max"><label class="st-d"><span>하루 최대</span><input type="number" inputmode="numeric" min="1" max="300" value="${r.max}" onchange="plSet(this.value)" aria-label="하루 최대 투구 수"><em>구</em></label></div>
    <table class="pl-tiers"><thead><tr><th>투구 수</th><th>휴식</th></tr></thead><tbody>${r.tiers.map(tier).join('')}</tbody></table>
    <label class="pl-on pl-c3"><input type="checkbox"${r.c3 ? ' checked' : ''} onchange="plC3(this.checked)"><span><b>3일 연속 등판 금지</b><small>이틀 연속 던지면 다음 날은 쉬어요 (적게 던져도) · 리틀 · 중학 규정</small></span></label>
    <div class="pl-pre" role="group" aria-label="기본값 고르기"><span class="pl-pre-l">기본값</span>${Object.keys(PRESETS).map(k => {
      const p = PRESETS[k], on = p.max === r.max && JSON.stringify(p.tiers) === JSON.stringify(r.tiers) && p.c3 === r.c3;
      return `<button type="button" class="sb-mini${on ? ' on' : ''}" aria-pressed="${on}" onclick="plReset('${k}')">${p.label}</button>`;
    }).join('')}</div>
    <p class="st-note">고교는 2025-08 보도, 중학(13~16세) · 리틀은 Little League 본부 규정이에요. 대회 요강과 다를 수 있으니 꼭 확인하고 고쳐 쓰세요. 휴식 N일 = 던진 다음 날부터 N일 쉬고 그다음 날 등판.</p>
    <h3 class="pl-h">투수 휴식 현황 · ${esc(fmt(liveDate()))} 기준</h3>
    <div id="plStatus">${_statusHtml(r)}</div>`;
}
function _redraw() {
  const el = document.getElementById('stPitch');
  if (el) el.innerHTML = cardHtml();
  try { if (typeof window.renderPitchCount === 'function') window.renderPitchCount(); } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.PitchLimit = { DEF, PRESETS, norm, getRule, setRule, restFor, addDays, fmt, isOpp, history, status, barHtml, onPitch, cardHtml };
  window.plOn = on => { setRule({ on: !!on }); _redraw(); };
  window.plSet = v => { const n = int(v, 1, 300); if (n) setRule({ max: n }); _redraw(); };
  window.plTier = (i, k, v) => {
    const r = getRule(), t = r.tiers.map(x => x.slice());
    const n = int(v, k ? 0 : 1, k ? 30 : 300);
    if (t[i] && n != null) { t[i][k] = n; setRule({ tiers: t }); }
    _redraw();
  };
  window.plReset = k => { const p = PRESETS[k] || PRESETS.hs; setRule({ max: p.max, tiers: p.tiers.map(t => t.slice()), c3: p.c3 }); _redraw(); };
  window.plC3 = on => { setRule({ c3: !!on }); _redraw(); };
}
