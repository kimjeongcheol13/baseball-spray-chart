// 주자 이름 · 득점 · 주루 플레이 · 타순 · 교체 · 되돌리기 — 경기 운영 모드(core.js GF)에서만. core.js 의 진루 규칙 · 아웃 · 이닝 전환은 그대로 두고 함수를 감싼다
//  · GF.runners = [1루, 2루, 3루] 주자 { id, name, num } | null — GF.bases(있다/없다)와 짝. 베이스를 손으로 켜면 누가 나갔는지 고른다(pickOn · 취소하면 이름 없는 주자 null)
//    이름 없는 주자는 이번 이닝 타석 기록을 다시 따라가 채운다(backfill) — 이 기능 전에 시작한 경기도 이름이 나오게
//  · 타석 기록에 항목만 추가 (기존 필드 · 저장 키 그대로):
//      scored = [{ id, name, num }]  이 타석 플레이로 홈인한 주자 (홈런은 타자 포함) — 경기 운영 모드로 적은 타석에만 있다(빈 배열 포함)
//      runEv  = [{ t, id, name, num, from, inn, team, scored, pre }]  이 타석 뒤 · 다음 타석 전의 주루 플레이 · 교체
//               t = SB 도루 · CS 도루 실패 · PO 견제사 (from = 그 주자의 베이스 0~2) · WP 폭투 · PB 포일 (from = null, adv = 진루한 주자의 베이스 —
//               없으면 모두 한 베이스씩 · id · name 은 홈인한 3루 주자) · SUB 교체 (k = PH 대타 · PR 대주자(from = 베이스) · DEF 대수비 · P 투수,
//               id · name = 들어온 선수, out = 나간 선수, team = 그 선수들의 팀, sw = 타순표에서 맞바꾼 자리 · added = 새로 넣은 선수).
//               pre = 그 직전 경기 운영 상태 — 되돌리기용
//      gfPre  = { inning, half, outs, batterIdx, bases, hs?, as? }  그 타석 직전 경기 운영 상태 + 그 타석으로 오른 점수 — 지우개가 되돌린다
//  · 타순은 '주전'만 돈다 ('후보'는 교체로 들어와야 친다) · 이닝이 바뀌면 그 팀 마지막 타석의 다음 타자부터 (core.js gfNextHalf 는 늘 1번부터)
//  · 교체 = 들어온 선수가 타순표에서 나간 선수 자리로 · 나간 선수는 후보로 (그 자리의 타순을 이어받는다)
//  · 병살은 1루 주자(1루가 비었으면 가장 앞 주자)를 지운다 — 0아웃이면 나머지 주자는 한 베이스씩(3루 주자 득점), 1아웃이면 3아웃이라 득점 없음
//    (core.js 는 아웃 계열이면 베이스를 그대로 둔다)
//  · 이닝별 득점(lineScore) = scored · runEv 를 이닝 · 팀별로 더한 값 — scorebook.js 라인스코어 · 공유 링크(info.ls)와 같은 모양
//  · 손으로 바꾼 점수(＋/−)는 누가 · 몇 회인지 몰라 이닝별 득점에 들어가지 않는다

const BASE = ['1루', '2루', '3루'];
const EV = { SB: '도루', CS: '도루 실패', PO: '견제사', WP: '폭투', PB: '포일' };
const KIND = { PH: '대타', PR: '대주자', DEF: '대수비', P: '투수 교체' };
const UNK = Object.freeze({ id: null, name: null, num: null });   // 이름 모르는 주자 (손으로 켠 베이스)
const $ = id => document.getElementById(id);
const nm = r => (r && r.name) || '주자';
const val = v => (typeof v === 'string' || (typeof v === 'number' && isFinite(v)) ? v : null);
const clean = r => ({ id: val(r && r.id), name: r && typeof r.name === 'string' ? r.name : null, num: val(r && r.num) });
const same = (a, b) => !!a && !!b && a.id != null && b.id != null && String(a.id) === String(b.id);

// 진루 — core.js gfUpdateBases 와 같은 규칙 (한쪽을 바꾸면 다른 쪽도 · 병살만 여기서 더 한다). b = [1루, 2루, 3루] 주자 | null, bat = 타자,
// outs = 그 타석 전 아웃. 홈인은 앞 주자부터
export function advance(res, b, bat, outs) {
  const [r1, r2, r3] = b;
  const on = [r3, r2, r1].filter(Boolean);
  switch (res) {
    case '홈런': return { bases: [null, null, null], scored: on.concat(bat) };
    case '3루타': return { bases: [null, null, bat], scored: on };
    case '2루타': return { bases: [null, bat, r1], scored: [r3, r2].filter(Boolean) };
    case '안타': case '내야안타': return { bases: [bat, r1, r2], scored: r3 ? [r3] : [] };
    case '볼넷': case '사구':   // 밀려나는 주자만
      return { bases: [bat, r1 || r2, r1 && r2 ? r2 : r3], scored: r1 && r2 && r3 ? [r3] : [] };
    case '희비': return { bases: [r1, r2, null], scored: r3 ? [r3] : [] };
    case '병살': {   // 타자 + 주자 한 명 — 1루 주자(6-4-3), 1루가 비었으면 가장 앞 주자
      const out = r1 ? 0 : r3 ? 2 : 1, n = b.map((r, i) => (i === out ? null : r));
      if (outs) return { bases: n, scored: [] };   // 1아웃 병살 = 3아웃 (포스 아웃으로 끝나 득점 없음)
      return { bases: [null, n[0], n[1]], scored: n[2] ? [n[2]] : [] };   // 0아웃이면 나머지 주자는 한 베이스씩
    }
    default: return { bases: [r1, r2, r3], scored: [] };   // 아웃 계열 — 베이스 그대로 (core.js 와 같이 단순화)
  }
}

// 폭투 · 포일로 한 베이스 간 주자의 베이스 (앞 주자부터) — go 중에서 실제로 갈 수 있는 주자만: 앞 주자가 남으면 바로 뒤 주자는 못 간다
export function wpMoves(b, go) {
  const occ = b.map(Boolean), m = [];
  for (let k = 2; k >= 0; k--) if (b[k] && go.includes(k) && (k === 2 || !occ[k + 1])) { m.push(k); occ[k] = false; if (k < 2) occ[k + 1] = true; }
  return m;
}

// 주루 플레이 · 교체 뒤 베이스 — t · i 는 runEv 와 같다, e = 그 runEv (폭투 · 포일의 adv, 대주자로 들어온 선수)
export function runMove(t, i, b, e) {
  const n = b.slice();
  if (t === 'WP' || t === 'PB') {   // 진루한 주자만 (adv 가 없으면 모두) · 3루 주자는 홈인
    wpMoves(b, e && Array.isArray(e.adv) ? e.adv : [0, 1, 2]).forEach(k => { n[k] = null; if (k < 2) n[k + 1] = b[k]; });
    return n;
  }
  if (t === 'SUB') { if (e && e.k === 'PR' && n[i]) n[i] = clean(e); return n; }   // 대주자만 베이스 주자가 바뀐다
  n[i] = null;
  if (t === 'SB' && i < 2) n[i + 1] = b[i];
  return n;
}

// 이닝별 득점 { away: [...], home: [...] } — 칸 = 득점(공격한 이닝) · null(공격 안 함). 경기 운영 모드로 적은 타석이 없으면 null
export function lineScore(abs) {
  if (!Array.isArray(abs) || !abs.some(a => a && Array.isArray(a.scored))) return null;
  const ls = { away: [], home: [] };
  const add = (team, inn, n) => {
    const i = parseInt(inn, 10) - 1;
    if (!(i >= 0 && i < 30)) return;
    const row = ls[team === 'away' ? 'away' : 'home'];
    while (row.length <= i) row.push(null);
    row[i] = Math.min(99, (row[i] || 0) + n);
  };
  abs.forEach(a => {
    if (!a) return;
    if (Array.isArray(a.scored)) add(a.team, a.inn, a.scored.length);   // 경기 운영 모드가 아닐 때 적은 타석은 득점을 모른다
    (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => { if (e && e.t !== 'SUB') add(e.team, e.inn, e.scored ? 1 : 0); });   // 교체는 수비 팀일 수도 있어 칸을 만들지 않는다
  });
  return ls;
}

// 선수 한 명의 득점 · 도루 · 도루 실패 (id 로, id 가 없으면 이름으로)
export function runnerStats(abs, p) {
  const me = x => !!x && (x.id != null && p.id != null ? String(x.id) === String(p.id) : x.name != null && x.name === p.name);
  let r = 0, sb = 0, cs = 0;
  (abs || []).forEach(a => {
    if (!a) return;
    (Array.isArray(a.scored) ? a.scored : []).forEach(x => { if (me(x)) r++; });
    (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => {
      if (!me(e)) return;
      if (e.t === 'SB') sb++; else if (e.t === 'CS') cs++;
      if (e.scored) r++;
    });
  });
  return { r, sb, cs };
}

// 되돌리기용 상태에서 되살릴 때 — 비어 있는 베이스의 주자는 버리고 필드 모양을 고정한다 (새로고침 복구는 core.js _enhanceRecovery 가 같은 규칙으로)
export function cleanRunners(list, bases) {
  return [0, 1, 2].map(i => {
    const r = Array.isArray(list) ? list[i] : null;
    return bases && bases[i] && r && typeof r === 'object' ? clean(r) : null;
  });
}

// ── 경기 운영 모드 연결 ──────────────────────────────────────
const G = () => window.GF;
function runners() {
  const g = G();
  if (!Array.isArray(g.runners) || g.runners.length !== 3) g.runners = [null, null, null];
  return g.runners;
}
// 베이스가 빈 칸의 주자는 지운다 — gfActivate · 3아웃 · 베이스 토글 · 복구가 GF.bases 만 바꿔도 맞춰진다
function sync() { const g = G(), R = runners(); for (let i = 0; i < 3; i++) if (!g.bases[i]) R[i] = null; }

function paint() {
  const g = G();
  if (!g) return;
  const R = runners();
  ['gfbB1', 'gfbB2', 'gfbB3'].forEach((id, i) => { const el = $(id); if (el) el.title = BASE[i] + ' 주자' + (g.bases[i] ? ' ' + nm(R[i]) : ''); });
  let el = $('gfbRunners');
  if (!el) {
    const bases = document.querySelector('#gfBar .gfb-bases');
    if (!bases) return;
    el = document.createElement('div');
    el.id = 'gfbRunners'; el.className = 'gfb-runners'; el.setAttribute('aria-live', 'polite');
    bases.after(el);
  }
  const txt = [0, 1, 2].filter(i => g.bases[i]).map(i => BASE[i] + ' ' + nm(R[i])).join(' · ');
  if (el.textContent !== txt) el.textContent = txt;   // 바뀔 때만 (aria-live 가 같은 내용을 다시 읽지 않게)
}

function inn() { const s = $('innSel'); return (s && s.value) || (window.gfInnStr ? window.gfInnStr() : ''); }
const atk = () => (G().half === 'top' ? 'home' : 'away');   // 공격 팀 (core.js gfAfterRecord 와 같이: 초 = 홈팀 공격)
const fld = () => (atk() === 'home' ? 'away' : 'home');      // 수비 팀
const LU = team => (team === 'away' ? window.AS.away_lineup : window.AS.home_lineup);
const starters = lu => lu.filter(p => p && p.isStarter !== false);

// 이름 모르는 주자(이 기능 전에 시작한 경기 · 되돌린 타석 등) — 이번 이닝 타석 · 주루 플레이 기록을 처음부터 다시 따라가 채운다.
// 따라간 베이스 모양이 지금 GF.bases 와 같을 때만 (손으로 켠 베이스가 섞이면 그대로 '주자'). skip = 방금 넣어 아직 진루 전인 타석
function backfill(skip) {
  const g = G(), R = runners();
  if (![0, 1, 2].some(i => g.bases[i] && !R[i])) return;
  const cur = inn(), team = atk();
  let b = [null, null, null];
  window.AS.abs.forEach(a => {
    if (!a || a === skip) return;
    if (a.inn === cur && (a.team || 'home') === team) b = advance(a.res, b, clean({ id: a.bid, name: a.bname, num: a.bnum }), a.gfPre ? a.gfPre.outs : 0).bases;
    (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => { if (e && e.inn === cur && e.team === team) b = runMove(e.t, e.from, b, e); });   // 3아웃 뒤 첫 주루 플레이는 앞 이닝 타석에 붙어 있다
  });
  if (b.some((r, i) => !!r !== !!g.bases[i])) return;
  b.forEach((r, i) => { if (!R[i] && r && r.name) R[i] = r; });
}

const preOf = () => { const g = G(); return { inning: g.inning, half: g.half, outs: g.outs, batterIdx: g.batterIdx, bases: g.bases.slice(), runners: runners().slice() }; };
function lastAb(what) {
  const A = window.AS, last = A.abs[A.abs.length - 1];
  if (!last) window.showToast(`타석 기록이 하나 이상 있어야 ${what} 적을 수 있어요`, false);
  return last;
}
function pushEv(last, ev) { (last.runEv = Array.isArray(last.runEv) ? last.runEv : []).push(ev); }

// 주루 플레이 — t 는 runEv 와 같다 (SB · CS · PO 는 i 베이스의 주자 · 폭투 · 포일은 adv = 진루한 주자의 베이스). 마지막 타석의 runEv 에 남는다
function runEvent(t, i, adv) {
  const g = G(), R = runners(), last = lastAb('주루 플레이를');
  if (!last) return;
  const all = t === 'WP' || t === 'PB';
  const b = g.bases.map((on, k) => (on ? R[k] || UNK : null));
  const go = all ? wpMoves(b, adv || [0, 1, 2]) : null;
  const scored = all ? go.includes(2) : t === 'SB' && i === 2;
  const r = (all ? (scored ? b[2] : null) : b[i]) || UNK;   // 기록에 남는 주자 — 폭투 · 포일은 홈인한 3루 주자
  const ev = Object.assign({ t }, clean(r), { from: all ? null : i, inn: inn(), team: atk(), scored, pre: preOf() }, all ? { adv: go } : null);
  pushEv(last, ev);
  const nb = runMove(t, i, b, ev);
  g.bases = nb.map(x => !!x); g.runners = nb.map(x => (x && x !== UNK ? x : null));
  if (scored) window.chSc(ev.team === 'home' ? 'h' : 'a', 1);
  let end = false;
  if ((t === 'CS' || t === 'PO') && ++g.outs >= 3) {   // core.js gfAfterRecord 의 3아웃 처리와 같이
    g.outs = 0; g.bases = [false, false, false]; g.runners = [null, null, null];
    window.gfNextHalf(); end = true;
  }
  window.updateAll();
  window.gfUpdateBar();
  if (end) return;
  const every = all && go.length === b.filter(Boolean).length;
  const what = every ? '주자 한 베이스씩' + (scored ? ' · 홈인 ' + nm(r) : '')
    : all ? go.map(k => `${BASE[k]} ${nm(b[k])}${k === 2 ? ' 홈인' : ' → ' + BASE[k + 1]}`).join(' · ')
    : t === 'PO' ? `${nm(r)} (${BASE[i]})` : `${nm(r)} ${BASE[i]}→${i === 2 ? '홈' : BASE[i + 1]}${scored ? ' (득점)' : ''}`;
  window.showToast(`${EV[t]} · ${what}`, true, 3000);
}

// 고르기 창 (도루 주자 · 폭투 진루 주자 · 교체) — 하나만 열린다
function closePick() { const b = $('slRunPick'); if (b) b.remove(); }
function sheet(title) {
  closePick();
  const box = document.createElement('div');
  box.id = 'slRunPick'; box.className = 'sl-runpick'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', title);
  const p = document.createElement('p');
  p.textContent = title;
  box.appendChild(p);
  box.addEventListener('keydown', e => { if (e.key === 'Escape') closePick(); });
  return box;
}
function btn(box, text, fn, cls) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = text; b.onclick = fn;
  if (cls) b.className = cls;
  box.appendChild(b);
  return b;
}
function show(box) {
  btn(box, '취소', closePick, 'x');
  document.body.appendChild(box);
  box.querySelector('button, input').focus();
}

function pick(t, cands) {
  const R = runners(), box = sheet({ SB: '누가 도루했나요?', CS: '누가 잡혔나요?', PO: '견제에 누가 잡혔나요?' }[t]);
  cands.forEach(i => btn(box, `${BASE[i]} ${nm(R[i])}` + (t === 'PO' ? '' : ` → ${i === 2 ? '홈' : BASE[i + 1]}`), () => { closePick(); runEvent(t, i); }));
  show(box);
}

// 폭투 · 포일 — 주자가 둘 이상이면 진루한 주자를 고른다 (모두 고른 채로 열림). 앞 주자가 남으면 바로 뒤 주자는 못 간다
function pickAdv(t) {
  const g = G(), R = runners(), on = [2, 1, 0].filter(k => g.bases[k]), sel = new Set(on), bt = {};
  const box = sheet(`${EV[t]} — 누가 진루했나요?`);
  box.classList.add('multi');
  const fix = () => {
    on.forEach(k => {
      const stuck = k < 2 && g.bases[k + 1] && !sel.has(k + 1);
      if (stuck) sel.delete(k);
      bt[k].disabled = stuck;
      bt[k].setAttribute('aria-pressed', String(sel.has(k)));
    });
    ok.disabled = !sel.size;
  };
  on.forEach(k => {
    bt[k] = btn(box, `${BASE[k]} ${nm(R[k])} → ${k === 2 ? '홈' : BASE[k + 1]}`, () => { if (sel.has(k)) sel.delete(k); else sel.add(k); fix(); }, 'tg');
  });
  const ok = btn(box, '확인', () => { closePick(); runEvent(t, null, on.filter(k => sel.has(k))); }, 'ok');
  fix();
  show(box);
}

// 손으로 켠 베이스 — 누가 나갔는지 고른다 (실책 · 야수선택 · 낫아웃 · 희타 · 진루타처럼 core.js 가 주자를 옮기지 않는 플레이).
// 아래 베이스 주자를 고르면 그 주자가 옮겨 간다 · 이번 이닝 마지막 타자 · 공격 팀 주전(베이스에 없는 선수) · 취소하면 예전처럼 이름 없는 '주자'
function pickOn(k) {
  const g = G(), R = runners(), team = atk(), cur = inn(), box = sheet(`${BASE[k]}에 누가 나갔나요?`);
  const put = (r, from) => { closePick(); if (from != null) { g.bases[from] = false; R[from] = null; } R[k] = r; window.gfUpdateBar(); };
  for (let i = k - 1; i >= 0; i--) if (g.bases[i]) btn(box, `${BASE[i]} ${nm(R[i])} → ${BASE[k]}`, () => put(R[i], i));
  const off = id => !R.some(r => same(r, { id }));
  const last = window.AS.abs.slice().reverse().find(a => a && a.inn === cur && (a.team || 'home') === team);
  const bat = last && off(last.bid) ? clean({ id: last.bid, name: last.bname, num: last.bnum }) : null;
  if (bat) btn(box, `타자 ${nm(bat)} (${last.res})`, () => put(bat));
  window.gfGetLineup().forEach((p, i) => { if (p && off(p.id) && !same(p, bat)) btn(box, `${i + 1}번 ${p.name}`, () => put(clean(p))); });
  show(box);
}

// 지금 타자 · 되돌린 타자를 고른다 — core.js undoLast 가 그 타석의 앞 공을 되살렸으면 지킨다 (shell.js 되돌리기와 같이) · 대타는 볼카운트를 이어받는다
function setBatter(id) {
  const A = window.AS, cp = A.currentPitches;
  A.batter = null; window.selBatter(id);
  A.currentPitches = cp;
}

// 되돌린 뒤 공격 팀 탭 · 타자를 GF 에 맞춘다 — 끝난 이닝을 되돌렸으면 core.js gfNextHalf 처럼 팀 탭부터. bid = 되살린 타석의 타자
function restoreBatter(half, bid) {
  const g = G(), A = window.AS;
  if (g.half !== half) {
    const t = atk();
    A.curTeam = t === 'home' ? 'away' : 'home';   // swLineupTab 은 같은 팀이면 아무것도 안 한다
    window.swLineupTab(t);
  }
  const lu = window.gfGetLineup();
  const pl = (bid != null && lu.find(p => p && String(p.id) === String(bid))) || (lu.length ? lu[g.batterIdx % lu.length] : null);
  if (!pl || (A.batter && String(A.batter.id) === String(pl.id))) return;
  setBatter(pl.id);
}

// ── 교체 ─────────────────────────────────────────────────
// 교체 버튼 (scorebook.js — 경기 운영 모드에서만 보인다): 종류 → 나가는 선수 → 들어오는 선수(후보 · 새 이름)
function subStart() {
  const g = G(), R = runners(), A = window.AS;
  if (!g || !g.active || !lastAb('교체를')) return;
  const box = sheet('어떤 교체인가요?');
  btn(box, '대타 — 지금 타자 대신', () => {
    if (!A.batter) { closePick(); window.showToast('지금 타자가 없어요 — 타순표에서 타자를 고른 뒤 교체해 주세요', false); return; }
    subIn('PH', atk(), A.batter);
  });
  btn(box, '대주자 — 베이스 주자 대신', () => {
    const on = [0, 1, 2].filter(k => g.bases[k]);
    if (!on.length) { closePick(); window.showToast('베이스에 주자가 없어요', false); return; }
    if (on.length === 1) { subIn('PR', atk(), R[on[0]] || UNK, on[0]); return; }
    const b2 = sheet('누구 대신 뛰나요?');
    on.forEach(k => btn(b2, `${BASE[k]} ${nm(R[k])}`, () => subIn('PR', atk(), R[k] || UNK, k)));
    show(b2);
  });
  btn(box, '대수비 — 수비 선수 바꾸기', () => subOut('DEF'));
  btn(box, '투수 교체', () => subOut('P'));
  show(box);
}

// 대수비 · 투수 — 수비 팀 주전 중에서 나가는 선수 (투수는 타순에 없을 수도: 지명타자)
function subOut(k) {
  const team = fld(), box = sheet(`${KIND[k]} — 누가 나가나요?`);
  starters(LU(team)).forEach((p, i) => btn(box, `${i + 1}번 ${p.name}${p.pos ? ' (' + p.pos + ')' : ''}`, () => subIn(k, team, p)));
  if (k === 'P') btn(box, '타순에 없는 투수 (지명타자)', () => subIn(k, team, null));
  show(box);
}

// 들어오는 선수 — 그 팀 후보 또는 새 이름
function subIn(k, team, out, base) {
  const box = sheet(`${KIND[k]} — ${out ? nm(out) + ' 대신 ' : ''}누가 들어오나요?`);
  LU(team).filter(p => p && p.isStarter === false).forEach(p => btn(box, `${p.num ? '#' + p.num + ' ' : ''}${p.name}`, () => { closePick(); subApply(k, team, out, base, p); }));
  const row = document.createElement('div');
  row.className = 'new';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.maxLength = 8; inp.placeholder = '새 선수 이름'; inp.setAttribute('aria-label', '새 선수 이름');
  const go = () => { const n = inp.value.trim(); if (!n) { inp.focus(); return; } closePick(); subApply(k, team, out, base, null, n); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  row.appendChild(inp);
  btn(row, '넣기', go, 'ok');
  box.appendChild(row);
  show(box);
}

// 교체 적용 — 들어온 선수가 타순표의 나간 선수 자리로 (나간 선수는 후보). 대주자는 그 베이스 주자 · 대타는 지금 타자가 된다
function subApply(k, team, out, base, inP, name) {
  const g = G(), A = window.AS, last = lastAb('교체를');
  if (!last) return;
  const lu = LU(team), o = out && out.id != null ? lu.findIndex(p => same(p, out)) : -1;
  let added = false;
  if (!inP) {
    inP = { id: Date.now() + Math.random(), name: String(name).slice(0, 8), num: '', pos: '', bh: '', isStarter: false };   // core.js addPlayer 와 같은 모양
    if (o >= 0) { lu.push(inP); added = true; }   // 타순에 없는 투수는 기록에만
  }
  const ev = Object.assign({ t: 'SUB', k }, clean(inP), { out: out ? clean(out) : null, from: k === 'PR' ? base : null, inn: inn(), team, scored: false, pre: preOf() });
  const i = lu.indexOf(inP);
  if (o >= 0 && i >= 0) {
    const op = lu[o];
    ev.sw = { o, i, os: op.isStarter, is: inP.isStarter, pos: inP.pos };
    if (added) ev.added = true;
    lu[o] = inP; lu[i] = op;
    op.isStarter = false; inP.isStarter = true;
    if (!inP.pos) inP.pos = k === 'P' ? '투수' : op.pos || '';
  }
  pushEv(last, ev);
  if (k === 'PR') runners()[base] = clean(inP);
  if (k === 'PH' && team === atk()) setBatter(inP.id);
  window.renderLP();
  window.updateAll();
  window.gfUpdateBar();
  window.showToast(`${KIND[k]} · ${ev.inn} ${inP.name}${out && out.name ? ` (${out.name} 대신)` : ''}`, true, 3000);
}

function undoSub(ev) {
  const A = window.AS, lu = LU(ev.team), s = ev.sw;
  if (s && lu[s.o] && lu[s.i]) {
    const inP = lu[s.o], op = lu[s.i];
    lu[s.o] = op; lu[s.i] = inP;
    op.isStarter = s.os; inP.isStarter = s.is; inP.pos = s.pos;
    if (ev.added && !A.abs.some(a => a && a.bid != null && String(a.bid) === String(inP.id))) lu.splice(s.i, 1);   // 새로 넣은 선수 — 기록이 없으면 명단에서도
  }
  const g = G();
  if (ev.k === 'PR' && ev.pre && g.bases[ev.from]) runners()[ev.from] = cleanRunners(ev.pre.runners, g.bases)[ev.from];
  if (ev.k === 'PH' && ev.team === atk() && ev.out && ev.out.id != null) setBatter(ev.out.id);
  window.renderLP();
  window.updateAll();
  window.gfUpdateBar();
  window.showToast(`직전 ${KIND[ev.k]} 기록을 취소했습니다`, false);
}

// 되돌리기: 마지막 타석 뒤에 주루 플레이 · 교체가 있으면 그것부터 (그 직전 상태로)
function undoRun(last) {
  const ev = last.runEv.pop();
  if (!last.runEv.length) delete last.runEv;
  if (ev.t === 'SUB') return undoSub(ev);
  if (ev.scored) window.chSc(ev.team === 'away' ? 'a' : 'h', -1);
  const g = G(), p = ev.pre;
  if (g && g.active && p && Array.isArray(p.bases)) {
    const half = g.half;
    g.inning = p.inning; g.half = p.half; g.outs = p.outs; g.batterIdx = p.batterIdx;
    g.bases = p.bases.slice(); g.runners = cleanRunners(p.runners, g.bases);
    if (g.half !== half) restoreBatter(half);   // 도루 실패 · 견제사로 끝난 이닝을 되돌림 — 그 타순 타자로
    window.gfSyncInnSel();
  }
  window.updateAll();
  window.gfUpdateBar();
  window.showToast(`직전 ${EV[ev.t] || '주루 플레이'} 기록을 취소했습니다`, false);
}

// 타석 되돌리기 (core.js undoLast 가 타석을 지운 뒤) — 그 타석 직전 상태(gfPre)로: 이닝 · 아웃 · 타순 · 주자 · 그 타석으로 오른 점수 · 그 타자.
// 주자 이름은 남은 타석으로 다시 채운다(gfUpdateBar → backfill)
function undoAb(p, bid) {
  const g = G(), half = g.half;
  g.inning = p.inning; g.half = p.half; g.outs = p.outs; g.batterIdx = p.batterIdx;
  g.bases = p.bases.slice(); g.runners = [null, null, null];
  if (p.hs) window.chSc('h', -p.hs);
  if (p.as) window.chSc('a', -p.as);
  window.gfSyncInnSel();
  restoreBatter(half, bid);
  window.updateAll();
  window.gfUpdateBar();
  window.showToast('직전 타석을 취소했습니다 — 주자 · 아웃 · 점수도 그 전으로', false);
}

// 이닝이 바뀌면 그 팀 마지막 타석의 다음 타자 — 3아웃을 타자가 당했으면 그다음, 도루 실패 · 견제사로 끝났으면 그때 타석에 있던 타자. 처음이면 1번.
// 그 타자가 그 뒤 교체로 나갔으면 그 자리에 들어온 선수의 타순으로
function nextIdx(lu, team) {
  const abs = window.AS.abs, subs = [];
  abs.forEach(a => (a && Array.isArray(a.runEv) ? a.runEv : []).forEach(e => { if (e && e.t === 'SUB' && e.team === team && e.out) subs.push(e); }));
  for (let j = abs.length - 1; j >= 0; j--) {
    const a = abs[j];
    if (!a || (a.team || 'home') !== team) continue;
    let who = { id: a.bid, name: a.bname }, k = -1;
    for (let n = 0; n <= subs.length; n++) {
      const w = who;
      k = lu.findIndex(p => p && (w.id != null ? String(p.id) === String(w.id) : p.name === w.name));
      const s = k < 0 && subs.find(e => (w.id != null ? same(e.out, w) : e.out.name === w.name));
      if (!s) break;
      who = s;
    }
    return k < 0 ? 0 : (k + 1) % lu.length;
  }
  return 0;
}

function wrap(name, make) { const f = window[name]; if (typeof f === 'function') window[name] = make(f); }

// 타순은 주전만 — 후보는 교체로 들어와 주전이 돼야 친다 (모두 후보로 해 두었으면 예전처럼 명단 전체)
wrap('gfGetLineup', orig => function () {
  const lu = orig.apply(this, arguments) || [], st = starters(lu);
  return st.length ? st : lu;
});

wrap('gfUpdateBases', orig => function (res) {
  const g = G(), R = runners(), A = window.AS, last = A.abs[A.abs.length - 1];
  const mine = last && last.res === res ? last : null;   // recHit · recOther 가 방금 넣은 타석
  backfill(mine);
  const bat = mine ? clean({ id: mine.bid, name: mine.bname, num: mine.bnum }) : UNK;
  const mv = advance(res, g.bases.map((on, i) => (on ? R[i] || UNK : null)), bat, g.outs);
  let n = orig.apply(this, arguments);
  if (res === '병살') { g.bases = mv.bases.map(r => !!r); n = mv.scored.length; }   // core.js 는 병살에 베이스를 그대로 두고 득점 0 — 득점은 core.js 가 이 값만큼 올린다
  g.runners = mv.bases.map((r, i) => (g.bases[i] && r && r !== UNK ? r : null));
  if (mine) {
    mine.scored = mv.scored.map(clean);
    if (mv.scored.length) {
      const t = $('toastTxt');
      window.showToast(`${t ? t.textContent : ''} · 홈인 ${mv.scored.map(nm).join(', ')}`, true, 3000);
    }
  }
  return n;
});

// 타석마다 그 직전 경기 운영 상태를 남긴다(gfPre) — 주자 이름은 남기지 않는다(되돌릴 때 backfill 이 채움)
wrap('gfAfterRecord', orig => function (res) {
  const g = G(), A = window.AS, last = A.abs[A.abs.length - 1];
  if (!(g && g.active && last && last.res === res)) return orig.apply(this, arguments);
  const h = A.hs, a = A.as;
  const pre = { inning: g.inning, half: g.half, outs: g.outs, batterIdx: g.batterIdx, bases: g.bases.slice() };
  const r = orig.apply(this, arguments);
  if (A.hs !== h) pre.hs = A.hs - h;   // 이 타석으로 오른 점수 — 되돌릴 때 이만큼만 뺀다 (그사이 손으로 바꾼 점수는 두고)
  if (A.as !== a) pre.as = A.as - a;
  last.gfPre = pre;
  return r;
});

wrap('gfNextHalf', orig => function () {
  const r = orig.apply(this, arguments);
  const g = G(), lu = window.gfGetLineup(), k = lu.length ? nextIdx(lu, atk()) : 0;
  if (k) { g.batterIdx = k; window.AS.batter = null; window.selBatter(lu[k].id); }   // core.js 가 1번을 고른 뒤 — 바 · 이닝 표시는 core.js 가 다음 프레임에
  return r;
});

wrap('gfUpdateBar', orig => function () {
  if (G() && G().active) { sync(); backfill(); }
  const r = orig.apply(this, arguments);
  paint();
  return r;
});

// 다른 경기를 열면(저장 목록 · 새 경기 · 공유 링크 · 복구) 이전 경기의 경기 운영 상태(이닝 · 아웃 · 주자)를 넘기지 않는다 — 경기 운영 모드를 끈다
// (core.js startFromWizard 의 'GF 초기화'가 하려던 것 — 그쪽은 없는 필드 이름이라 아무것도 안 바뀌었다). 같은 경기를 다시 열면(첫 타석이 같으면) 그대로 ·
// 복구가 그 경기의 경기 운영 상태를 되살리는 건(core.js _enhanceRecovery, 200ms 뒤) 이 다음이라 그대로 된다
const gameId = () => { const A = window.AS, a = A.abs && A.abs[0]; return a ? 'ab:' + a.id : 'g:' + A.curGame; };
['restoreGame', 'startFromWizard', 'loadSharedGame', 'recoverHiddenAutosave', 'archRecoverAutosave'].forEach(n => wrap(n, orig => function () {
  const was = gameId(), r = orig.apply(this, arguments), g = G();
  if (g && gameId() !== was) {
    if (g.active) window.gfDeactivate();
    Object.assign(g, { inning: 1, half: 'top', outs: 0, batterIdx: 0, bases: [false, false, false], runners: [null, null, null] });
    window.gfUpdateBar();   // 숨은 막대의 주자 글자도 비운다 (다시 켜면 1회초부터)
  }
  return r;
}));

wrap('recSB', orig => function (ok) {
  const g = G();
  if (!g || !g.active) return orig.apply(this, arguments);   // 경기 운영 모드가 아니면 주자를 모른다 — 예전처럼 안내만
  const c = [0, 1, 2].filter(i => g.bases[i] && (i === 2 || !g.bases[i + 1]));   // 다음 베이스가 빈 주자
  if (!c.length) { window.showToast('도루할 주자가 없어요 — 위 베이스를 눌러 주자를 놓을 수 있어요', false); return; }
  const t = ok ? 'SB' : 'CS';
  if (c.length === 1) runEvent(t, c[0]); else pick(t, c);
});

// 베이스를 켜면 누가 나갔는지 묻는다 (pickOn) — 끄기 · 기록으로 이름이 채워지는 주자는 예전처럼
wrap('gfToggleBase', orig => function (k) {
  const r = orig.apply(this, arguments), g = G();
  if (g && g.active && g.bases[k]) { sync(); backfill(); if (!runners()[k]) pickOn(k); }
  return r;
});

wrap('undoLast', orig => function () {
  const A = window.AS, last = A && A.abs.length ? A.abs[A.abs.length - 1] : null;
  if (last && Array.isArray(last.runEv) && last.runEv.length) return undoRun(last);
  const r = orig.apply(this, arguments);
  const g = G(), p = last && last.gfPre;
  if (g && g.active && p && Array.isArray(p.bases) && !A.abs.includes(last)) undoAb(p, last.bid);   // 타석이 실제로 지워졌을 때만 · 이 기능 전 타석은 예전처럼
  return r;
});

// 폭투 · 포일 · 견제사 버튼 (scorebook.js — 경기 운영 모드에서만 보인다)
window.slRunPlay = function (t) {
  const g = G();
  if (!g || !g.active || !EV[t]) return;
  const c = [0, 1, 2].filter(i => g.bases[i]);
  if (!c.length) { window.showToast('베이스에 주자가 없어요 — 위 베이스를 눌러 주자를 놓을 수 있어요', false); return; }
  if (t !== 'PO') { if (c.length === 1) runEvent(t); else pickAdv(t); } else if (c.length === 1) runEvent(t, c[0]); else pick(t, c);
};
window.slSub = subStart;

window.slLineScore = lineScore;
window.slRunnerStats = runnerStats;
if (G() && G().active) window.gfUpdateBar();   // 이 모듈보다 먼저 복구된 경기 운영 상태도 주자 이름을 그린다
