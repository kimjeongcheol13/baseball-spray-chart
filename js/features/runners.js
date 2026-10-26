// 주자 이름 · 득점 · 주루 플레이 · 타순 · 되돌리기 — 경기 운영 모드(core.js GF)에서만. core.js 의 진루 규칙 · 아웃 · 이닝 전환은 그대로 두고 함수를 감싼다
//  · GF.runners = [1루, 2루, 3루] 주자 { id, name, num } | null — GF.bases(있다/없다)와 짝. 베이스를 손으로 켜면 이름 없는 주자(null)
//    이름 없는 주자는 이번 이닝 타석 기록을 다시 따라가 채운다(backfill) — 이 기능 전에 시작한 경기도 이름이 나오게
//  · 타석 기록에 항목만 추가 (기존 필드 · 저장 키 그대로):
//      scored = [{ id, name, num }]  이 타석 플레이로 홈인한 주자 (홈런은 타자 포함) — 경기 운영 모드로 적은 타석에만 있다(빈 배열 포함)
//      runEv  = [{ t, id, name, num, from, inn, team, scored, pre }]  이 타석 뒤 · 다음 타석 전의 주루 플레이
//               t = SB 도루 · CS 도루 실패 · PO 견제사 (from = 그 주자의 베이스 0~2) · WP 폭투 · PB 포일 (from = null, 주자 모두 한 베이스씩 —
//               id · name 은 홈인한 3루 주자). pre = 그 직전 경기 운영 상태 — 되돌리기용
//      gfPre  = { inning, half, outs, batterIdx, bases, hs?, as? }  그 타석 직전 경기 운영 상태 + 그 타석으로 오른 점수 — 지우개가 되돌린다
//  · 이닝이 바뀌면 그 팀 마지막 타석의 다음 타자부터 (core.js gfNextHalf 는 늘 1번부터)
//  · 병살은 1루 주자(1루가 비었으면 가장 앞 주자)를 지운다 (core.js 는 아웃 계열이면 베이스를 그대로 둔다)
//  · 이닝별 득점(lineScore) = scored · runEv 를 이닝 · 팀별로 더한 값 — scorebook.js 라인스코어 · 공유 링크(info.ls)와 같은 모양
//  · 손으로 바꾼 점수(＋/−)는 누가 · 몇 회인지 몰라 이닝별 득점에 들어가지 않는다

const BASE = ['1루', '2루', '3루'];
const EV = { SB: '도루', CS: '도루 실패', PO: '견제사', WP: '폭투', PB: '포일' };
const UNK = Object.freeze({ id: null, name: null, num: null });   // 이름 모르는 주자 (손으로 켠 베이스)
const $ = id => document.getElementById(id);
const nm = r => (r && r.name) || '주자';
const val = v => (typeof v === 'string' || (typeof v === 'number' && isFinite(v)) ? v : null);
const clean = r => ({ id: val(r && r.id), name: r && typeof r.name === 'string' ? r.name : null, num: val(r && r.num) });

// 진루 — core.js gfUpdateBases 와 같은 규칙 (한쪽을 바꾸면 다른 쪽도 · 병살만 여기서 더 한다). b = [1루, 2루, 3루] 주자 | null, bat = 타자. 홈인은 앞 주자부터
export function advance(res, b, bat) {
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
    case '병살': {   // 타자 + 주자 한 명 — 1루 주자(6-4-3), 1루가 비었으면 가장 앞 주자. 나머지 주자는 그대로
      const out = r1 ? 0 : r3 ? 2 : 1;
      return { bases: b.map((r, i) => (i === out ? null : r)), scored: [] };
    }
    default: return { bases: [r1, r2, r3], scored: [] };   // 아웃 계열 — 베이스 그대로 (core.js 와 같이 단순화)
  }
}

// 주루 플레이 뒤 베이스 — t · i 는 runEv 와 같다
export function runMove(t, i, b) {
  if (t === 'WP' || t === 'PB') return [null, b[0], b[1]];   // 모두 한 베이스씩 (3루 주자 홈인)
  const n = b.slice();
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
    (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => { if (e) add(e.team, e.inn, e.scored ? 1 : 0); });
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

// 이름 모르는 주자(이 기능 전에 시작한 경기 · 되돌린 타석 등) — 이번 이닝 타석 · 주루 플레이 기록을 처음부터 다시 따라가 채운다.
// 따라간 베이스 모양이 지금 GF.bases 와 같을 때만 (손으로 켠 베이스가 섞이면 그대로 '주자'). skip = 방금 넣어 아직 진루 전인 타석
function backfill(skip) {
  const g = G(), R = runners();
  if (![0, 1, 2].some(i => g.bases[i] && !R[i])) return;
  const cur = inn(), team = atk();
  let b = [null, null, null];
  window.AS.abs.forEach(a => {
    if (!a || a === skip) return;
    if (a.inn === cur && (a.team || 'home') === team) b = advance(a.res, b, clean({ id: a.bid, name: a.bname, num: a.bnum })).bases;
    (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => { if (e && e.inn === cur && e.team === team) b = runMove(e.t, e.from, b); });   // 3아웃 뒤 첫 주루 플레이는 앞 이닝 타석에 붙어 있다
  });
  if (b.some((r, i) => !!r !== !!g.bases[i])) return;
  b.forEach((r, i) => { if (!R[i] && r && r.name) R[i] = r; });
}

// 주루 플레이 — t 는 runEv 와 같다 (SB · CS · PO 는 i 베이스의 주자). 마지막 타석의 runEv 에 남는다
function runEvent(t, i) {
  const g = G(), R = runners(), A = window.AS, last = A.abs[A.abs.length - 1];
  if (!last) { window.showToast('타석 기록이 하나 이상 있어야 주루 플레이를 적을 수 있어요', false); return; }
  const all = t === 'WP' || t === 'PB';
  const b = g.bases.map((on, k) => (on ? R[k] || UNK : null));
  const r = (all ? b[2] : b[i]) || UNK;   // 기록에 남는 주자 — 폭투 · 포일은 홈인한 3루 주자
  const scored = all ? !!b[2] : t === 'SB' && i === 2;
  const pre = { inning: g.inning, half: g.half, outs: g.outs, batterIdx: g.batterIdx, bases: g.bases.slice(), runners: R.slice() };
  const ev = Object.assign({ t }, clean(r), { from: all ? null : i, inn: inn(), team: atk(), scored, pre });
  (last.runEv = Array.isArray(last.runEv) ? last.runEv : []).push(ev);
  const nb = runMove(t, i, b);
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
  const what = all ? '주자 한 베이스씩' + (scored ? ' · 홈인 ' + nm(r) : '')
    : t === 'PO' ? `${nm(r)} (${BASE[i]})` : `${nm(r)} ${BASE[i]}→${i === 2 ? '홈' : BASE[i + 1]}${scored ? ' (득점)' : ''}`;
  window.showToast(`${EV[t]} · ${what}`, true, 3000);
}

function closePick() { const b = $('slRunPick'); if (b) b.remove(); }
function pick(t, cands) {
  closePick();
  const R = runners(), box = document.createElement('div');
  box.id = 'slRunPick'; box.className = 'sl-runpick'; box.setAttribute('role', 'dialog');
  const p = document.createElement('p');
  p.textContent = { SB: '누가 도루했나요?', CS: '누가 잡혔나요?', PO: '견제에 누가 잡혔나요?' }[t];
  box.setAttribute('aria-label', p.textContent);
  box.appendChild(p);
  cands.forEach(i => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${BASE[i]} ${nm(R[i])}` + (t === 'PO' ? '' : ` → ${i === 2 ? '홈' : BASE[i + 1]}`);
    b.onclick = () => { closePick(); runEvent(t, i); };
    box.appendChild(b);
  });
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'x'; x.textContent = '취소'; x.onclick = closePick;
  box.appendChild(x);
  box.addEventListener('keydown', e => { if (e.key === 'Escape') closePick(); });
  document.body.appendChild(box);
  box.querySelector('button').focus();
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
  const cp = A.currentPitches;   // core.js undoLast 가 그 타석의 앞 공을 되살렸으면 지킨다 (shell.js 되돌리기와 같이)
  A.batter = null; window.selBatter(pl.id);
  A.currentPitches = cp;
}

// 되돌리기: 마지막 타석 뒤에 주루 플레이가 있으면 그것부터 (그 직전 상태로)
function undoRun(last) {
  const ev = last.runEv.pop();
  if (!last.runEv.length) delete last.runEv;
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

// 이닝이 바뀌면 그 팀 마지막 타석의 다음 타자 — 3아웃을 타자가 당했으면 그다음, 도루 실패 · 견제사로 끝났으면 그때 타석에 있던 타자. 처음이면 1번
function nextIdx(lu, team) {
  const abs = window.AS.abs;
  for (let j = abs.length - 1; j >= 0; j--) {
    const a = abs[j];
    if (!a || (a.team || 'home') !== team) continue;
    const k = lu.findIndex(p => p && (a.bid != null ? String(p.id) === String(a.bid) : p.name === a.bname));
    return k < 0 ? 0 : (k + 1) % lu.length;
  }
  return 0;
}

function wrap(name, make) { const f = window[name]; if (typeof f === 'function') window[name] = make(f); }

wrap('gfUpdateBases', orig => function (res) {
  const g = G(), R = runners(), A = window.AS, last = A.abs[A.abs.length - 1];
  const mine = last && last.res === res ? last : null;   // recHit · recOther 가 방금 넣은 타석
  backfill(mine);
  const bat = mine ? clean({ id: mine.bid, name: mine.bname, num: mine.bnum }) : UNK;
  const mv = advance(res, g.bases.map((on, i) => (on ? R[i] || UNK : null)), bat);
  const n = orig.apply(this, arguments);
  if (res === '병살') g.bases = mv.bases.map(r => !!r);   // core.js 는 병살에도 베이스를 그대로 둔다
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

wrap('recSB', orig => function (ok) {
  const g = G();
  if (!g || !g.active) return orig.apply(this, arguments);   // 경기 운영 모드가 아니면 주자를 모른다 — 예전처럼 안내만
  const c = [0, 1, 2].filter(i => g.bases[i] && (i === 2 || !g.bases[i + 1]));   // 다음 베이스가 빈 주자
  if (!c.length) { window.showToast('도루할 주자가 없어요 — 위 베이스를 눌러 주자를 놓을 수 있어요', false); return; }
  const t = ok ? 'SB' : 'CS';
  if (c.length === 1) runEvent(t, c[0]); else pick(t, c);
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
  if (t !== 'PO') runEvent(t); else if (c.length === 1) runEvent(t, c[0]); else pick(t, c);
};

window.slLineScore = lineScore;
window.slRunnerStats = runnerStats;
if (G() && G().active) window.gfUpdateBar();   // 이 모듈보다 먼저 복구된 경기 운영 상태도 주자 이름을 그린다
