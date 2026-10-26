// 주자 이름 · 득점 · 도루 — 경기 운영 모드(core.js GF)에서만. core.js 의 진루 규칙 · 아웃 · 이닝 전환은 그대로 두고 함수를 감싼다
//  · GF.runners = [1루, 2루, 3루] 주자 { id, name, num } | null — GF.bases(있다/없다)와 짝. 베이스를 손으로 켜면 이름 없는 주자(null)
//  · 타석 기록에 항목만 추가 (기존 필드 · 저장 키 그대로):
//      scored = [{ id, name, num }]  이 타석 플레이로 홈인한 주자 (홈런은 타자 포함) — 경기 운영 모드로 적은 타석에만 있다(빈 배열 포함)
//      runEv  = [{ t: 'SB'|'CS', id, name, num, from, inn, team, scored, pre }]  이 타석 뒤 · 다음 타석 전의 도루 · 도루 실패
//               (pre = 그 직전 경기 운영 상태 — 되돌리기용)
//  · 이닝별 득점(lineScore) = scored · runEv 를 이닝 · 팀별로 더한 값 — scorebook.js 라인스코어 · 공유 링크(info.ls)와 같은 모양
//  · 손으로 바꾼 점수(＋/−)는 누가 · 몇 회인지 몰라 이닝별 득점에 들어가지 않는다

const BASE = ['1루', '2루', '3루'];
const UNK = Object.freeze({ id: null, name: null, num: null });   // 이름 모르는 주자 (손으로 켠 베이스)
const $ = id => document.getElementById(id);
const nm = r => (r && r.name) || '주자';
const val = v => (typeof v === 'string' || (typeof v === 'number' && isFinite(v)) ? v : null);
const clean = r => ({ id: val(r && r.id), name: r && typeof r.name === 'string' ? r.name : null, num: val(r && r.num) });

// 진루 — core.js gfUpdateBases 와 같은 규칙 (한쪽을 바꾸면 다른 쪽도). b = [1루, 2루, 3루] 주자 | null, bat = 타자. 홈인은 앞 주자부터
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
    default: return { bases: [r1, r2, r3], scored: [] };   // 아웃 계열 — 베이스 그대로 (core.js 와 같이 단순화)
  }
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

// 도루 성공(ok) · 실패 — i = 출발 베이스(0~2)
function steal(ok, i) {
  const g = G(), R = runners(), A = window.AS, last = A.abs[A.abs.length - 1];
  if (!last) { window.showToast('타석 기록이 하나 이상 있어야 도루를 적을 수 있어요', false); return; }
  const r = R[i] || UNK;
  const pre = { inning: g.inning, half: g.half, outs: g.outs, batterIdx: g.batterIdx, bases: g.bases.slice(), runners: R.slice() };
  const ev = Object.assign({ t: ok ? 'SB' : 'CS' }, clean(r), { from: i, inn: inn(), team: atk(), scored: ok && i === 2, pre });
  (last.runEv = Array.isArray(last.runEv) ? last.runEv : []).push(ev);
  g.bases[i] = false; R[i] = null;
  let end = false;
  if (ok && i === 2) window.chSc(ev.team === 'home' ? 'h' : 'a', 1);
  else if (ok) { g.bases[i + 1] = true; R[i + 1] = r === UNK ? null : r; }
  else if (++g.outs >= 3) {   // core.js gfAfterRecord 의 3아웃 처리와 같이
    g.outs = 0; g.bases = [false, false, false]; g.runners = [null, null, null];
    window.gfNextHalf(); end = true;
  }
  window.updateAll();
  window.gfUpdateBar();
  if (!end) window.showToast(`${ok ? '도루' : '도루 실패'} · ${nm(r)} ${BASE[i]}→${i === 2 ? '홈' : BASE[i + 1]}${ok && i === 2 ? ' (득점)' : ''}`, true, 3000);
}

function closePick() { const b = $('slRunPick'); if (b) b.remove(); }
function pick(ok, cands) {
  closePick();
  const R = runners(), box = document.createElement('div');
  box.id = 'slRunPick'; box.className = 'sl-runpick'; box.setAttribute('role', 'dialog');
  const p = document.createElement('p');
  p.textContent = ok ? '누가 도루했나요?' : '누가 잡혔나요?';
  box.setAttribute('aria-label', p.textContent);
  box.appendChild(p);
  cands.forEach(i => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${BASE[i]} ${nm(R[i])} → ${i === 2 ? '홈' : BASE[i + 1]}`;
    b.onclick = () => { closePick(); steal(ok, i); };
    box.appendChild(b);
  });
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'x'; x.textContent = '취소'; x.onclick = closePick;
  box.appendChild(x);
  box.addEventListener('keydown', e => { if (e.key === 'Escape') closePick(); });
  document.body.appendChild(box);
  box.querySelector('button').focus();
}

// 되돌리기: 마지막 타석 뒤에 도루가 있으면 그 도루부터 (그 직전 상태로)
function undoRun(last) {
  const ev = last.runEv.pop();
  if (!last.runEv.length) delete last.runEv;
  if (ev.scored) window.chSc(ev.team === 'away' ? 'a' : 'h', -1);
  const g = G(), p = ev.pre;
  if (g && g.active && p && Array.isArray(p.bases)) {
    const half = g.half;
    g.inning = p.inning; g.half = p.half; g.outs = p.outs; g.batterIdx = p.batterIdx;
    g.bases = p.bases.slice(); g.runners = cleanRunners(p.runners, g.bases);
    if (g.half !== half) {   // 도루 실패로 끝난 이닝을 되돌림 — core.js gfNextHalf 처럼 공격 팀 · 그 타순 타자로
      const t = atk(), A = window.AS;
      A.curTeam = t === 'home' ? 'away' : 'home';   // swLineupTab 은 같은 팀이면 아무것도 안 한다
      window.swLineupTab(t);
      const lu = window.gfGetLineup(), pl = lu.length ? lu[g.batterIdx % lu.length] : null;
      if (pl) { A.batter = null; window.selBatter(pl.id); }
    }
    window.gfSyncInnSel();
  }
  window.updateAll();
  window.gfUpdateBar();
  window.showToast(`직전 ${ev.t === 'SB' ? '도루' : '도루 실패'} 기록을 취소했습니다`, false);
}

function wrap(name, make) { const f = window[name]; if (typeof f === 'function') window[name] = make(f); }

wrap('gfUpdateBases', orig => function (res) {
  const g = G(), R = runners(), A = window.AS, last = A.abs[A.abs.length - 1];
  const mine = last && last.res === res ? last : null;   // recHit · recOther 가 방금 넣은 타석
  const bat = mine ? clean({ id: mine.bid, name: mine.bname, num: mine.bnum }) : UNK;
  const mv = advance(res, g.bases.map((on, i) => (on ? R[i] || UNK : null)), bat);
  const n = orig.apply(this, arguments);
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

wrap('gfUpdateBar', orig => function () {
  if (G() && G().active) sync();
  const r = orig.apply(this, arguments);
  paint();
  return r;
});

wrap('recSB', orig => function (ok) {
  const g = G();
  if (!g || !g.active) return orig.apply(this, arguments);   // 경기 운영 모드가 아니면 주자를 모른다 — 예전처럼 안내만
  const c = [0, 1, 2].filter(i => g.bases[i] && (i === 2 || !g.bases[i + 1]));   // 다음 베이스가 빈 주자
  if (!c.length) { window.showToast('도루할 주자가 없어요 — 위 베이스를 눌러 주자를 놓을 수 있어요', false); return; }
  if (c.length === 1) steal(!!ok, c[0]); else pick(!!ok, c);
});

wrap('undoLast', orig => function () {
  const A = window.AS, last = A && A.abs.length ? A.abs[A.abs.length - 1] : null;
  if (last && Array.isArray(last.runEv) && last.runEv.length) return undoRun(last);
  return orig.apply(this, arguments);
});

window.slLineScore = lineScore;
window.slRunnerStats = runnerStats;
if (G() && G().active) window.gfUpdateBar();   // 이 모듈보다 먼저 복구된 경기 운영 상태도 주자 이름을 그린다
