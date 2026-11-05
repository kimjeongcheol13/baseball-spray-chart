// 경기 후 코치 메모 — GAME REPORT(core.js _pgBuild) 인사이트 칸에 기록된 숫자만으로 최대 3줄 (column.js 와 같은 원칙: 표본이 적으면 쓰지 않는다)
//  · 우리 팀 = 상대(team 'away')가 아닌 타석, 상대 = team 'away' 타석 — 우리 팀 타석이 없으면 전부 우리 팀으로 (core.js _pgAbs 와 같은 기준)
//  · 득점권 · 2아웃은 경기 운영 모드로 적은 타석(gfPre: 직전 주자 · 아웃)만, 2스트라이크는 볼카운트를 눌러 적은 타석(count.s)만 센다
//  · 선두타자 = 이닝마다 그 팀 첫 타석 (경기 운영 모드면 gfPre 의 이닝 · 초말, 아니면 타석의 이닝 칸)
//  · 순서대로 조건이 맞는 것 3개: 득점권 → 2스트라이크 → 선두타자 출루 → 2아웃 타점 → (우리 투수) 상대 선두타자 출루 → 볼넷 · 사구 허용
import { HITS } from '../constants.js';

const ON = [...HITS, '볼넷', '사구', '실책', '야수선택'];
const hits = l => l.filter(a => HITS.includes(a.res)).length;
const rbiOf = l => l.reduce((s, a) => s + (a.rbi || 0), 0);
const risp = a => !!(a.gfPre && Array.isArray(a.gfPre.bases) && (a.gfPre.bases[1] || a.gfPre.bases[2]));
const outsOf = a => (a.gfPre && [0, 1, 2].includes(a.gfPre.outs) ? a.gfPre.outs : a.count && [0, 1, 2].includes(a.count.o) ? a.count.o : null);
const innKey = a => (a.gfPre && a.gfPre.inning != null ? a.gfPre.inning + '-' + a.gfPre.half : a.inn || '');

function leadoffs(abs) {
  const seen = new Set(), out = [];
  abs.forEach(a => { const k = innKey(a); if (k && !seen.has(k)) { seen.add(k); out.push(a); } });
  return out;
}

export function coachNotes(all) {
  all = Array.isArray(all) ? all : [];
  const mine = all.filter(a => a.team !== 'away');
  const us = mine.length ? mine : all, them = mine.length ? all.filter(a => a.team === 'away') : [];
  const out = [], add = (lbl, val) => out.push({ cls: 'coach', lbl: '📋 ' + lbl, val });

  const r = us.filter(risp);
  if (r.length >= 3) add('득점권', `${r.length}타석 ${hits(r)}안타` + (rbiOf(us) ? ` · 타점 ${rbiOf(r)}` : ''));   // 타점을 안 적는 팀은 '타점 0'이 틀린 말이 되어 뺀다
  const t = us.filter(a => a.count && a.count.s >= 2);
  if (t.length >= 4) add('2스트라이크 뒤', `${t.length}타석 ${hits(t)}안타 · 삼진 ${t.filter(a => a.res === '삼진').length}`);
  const l = leadoffs(us);
  if (l.length >= 3) add('선두타자 출루', `${l.filter(a => ON.includes(a.res)).length} / ${l.length}이닝`);
  const r2 = rbiOf(us.filter(a => outsOf(a) === 2));
  if (r2 >= 2) add('2아웃 뒤 타점', `${r2} (전체 ${rbiOf(us)})`);
  const ol = leadoffs(them);
  if (ol.length >= 3) add('투수 · 상대 선두타자 출루', `${ol.filter(a => ON.includes(a.res)).length} / ${ol.length}이닝`);
  const bb = them.filter(a => a.res === '볼넷' || a.res === '사구').length;
  if (bb >= 3) add('투수 · 볼넷 · 사구 허용', `${bb}개`);
  return out.slice(0, 3);
}

if (typeof window !== 'undefined') window.slCoachNotes = coachNotes;
