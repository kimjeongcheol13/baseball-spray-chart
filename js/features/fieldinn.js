// 포지션별 수비 이닝 — 팀 대시보드 카드 (유소년 출전 공정성: 누가 어느 자리에서 몇 이닝 뛰었나)
//   선발 수비 위치(라인업 pos) + 경기 운영 모드 교체(runEv SUB, runners.js)로 센다. 저장 데이터는 읽기만 한다.
//   · 저장 라인업은 경기가 끝난 모습 → 교체를 거꾸로 되돌려(sw.os · sw.is, runners.js undoSub 와 같다) 선발을 찾는다
//   · 들어온 선수 자리 = 투수 교체면 투수, 아니면 그 선수의 라인업 위치(대타 · 대주자는 subApply 가 나간 선수 자리를 넣어 둔다) → 없으면 나간 선수 자리
//   · 수비 이닝 = 상대가 공격한 이닝마다 아웃 3개. 수비 중 교체는 그때 아웃 수(pre.outs)에서 나누고, 공격 중 교체는 다음 수비 이닝부터
// ponytail: 마지막 이닝도 아웃 3개로 센다(끝내기 · 콜드로 덜 한 이닝 포함) · 교체 없이 자리만 바꾼 이동은 기록이 없어 못 센다 —
//           이동 버튼을 붙이면 그 기록을 subs 와 같은 타임라인(eff)에 넣으면 된다
import { esc } from '../constants.js';
import { loadGames } from './games.js?v=1';

const POS = [['P', '투수'], ['C', '포수'], ['1B', '1루'], ['2B', '2루'], ['3B', '3루'], ['SS', '유격'], ['LF', '좌익'], ['CF', '중견'], ['RF', '우익']];
const ALIAS = {
  P: ['투수', '투', 'P', 'SP', 'RP', '1'], C: ['포수', '포', 'C', '2'], '1B': ['1루', '1루수', '1B', '3'], '2B': ['2루', '2루수', '2B', '4'],
  '3B': ['3루', '3루수', '3B', '5'], SS: ['유격', '유격수', '유', 'SS', '6'], LF: ['좌익', '좌익수', '좌', 'LF', '7'],
  CF: ['중견', '중견수', '중', 'CF', '8'], RF: ['우익', '우익수', '우', 'RF', '9'], DH: ['DH', '지명', '지명타자'],
};
const CODE = Object.create(null);
Object.keys(ALIAS).forEach(k => ALIAS[k].forEach(s => { CODE[s] = k; }));
// '' = 안 적음 · DH = 수비 안 함 · ETC = 알 수 없는 글자
const norm = s => { const t = String(s || '').replace(/\s/g, '').toUpperCase(); return t ? CODE[t] || 'ETC' : ''; };

const side = a => (a && a.team === 'away' ? 'away' : 'home');
const innNo = a => { const p = a && a.gfPre; if (p && +p.inning > 0) return +p.inning; const m = String((a && a.inn) || '').match(/\d+/); return m ? +m[0] : null; };
const halfOf = a => (a && a.gfPre && (a.gfPre.half === 'top' || a.gfPre.half === 'bottom') ? a.gfPre.half : /초/.test((a && a.inn) || '') ? 'top' : /말/.test((a && a.inn) || '') ? 'bottom' : null);
const key = p => (p.id != null ? 'i' + p.id : 'n' + p.name);
const same = (p, r) => !!p && !!r && (r.id != null && p.id != null ? String(p.id) === String(r.id) : !!r.name && p.name === r.name);

// 그 팀이 수비하는 쪽(초 · 말) — 타석 하나라도 초 · 말을 알면 그것으로, 모르면 홈 = 후공(초에 수비)
function fieldHalf(abs, team) {
  for (const a of abs) { const h = halfOf(a); if (h) return (side(a) === team) === (h === 'top') ? 'bottom' : 'top'; }
  return team === 'home' ? 'top' : 'bottom';
}

// 한 경기 → { 선수키: { name, num, outs: { P: 3, … } } } · 수비 위치를 하나도 안 적은 경기는 null
export function gameInnings(abs, lineup, team) {
  abs = (Array.isArray(abs) ? abs : []).filter(Boolean);
  const lu = (Array.isArray(lineup) ? lineup : []).filter(Boolean).map(p => ({ ...p }));
  const subs = [];
  abs.forEach(a => (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => { if (e && e.t === 'SUB' && e.team === team) subs.push(e); }));
  const find = r => lu.find(p => same(p, r));
  subs.slice().reverse().forEach(e => {
    const s = e.sw, inP = find(e), op = e.out && find(e.out);
    if (s && inP && op) { op.isStarter = s.os; inP.isStarter = s.is; }
  });
  const st = lu.filter(p => p.isStarter !== false);
  if (!st.some(p => { const c = norm(p.pos); return c && c !== 'ETC'; })) return null;

  const d = fieldHalf(abs, team);
  const eff = e => {   // 교체가 효력을 갖는 때 = 수비 이닝 번호 × 3 + 아웃
    const p = e.pre || {}, h = p.half || halfOf({ inn: e.inn }), i = +p.inning || innNo({ inn: e.inn }) || 1;
    if (h === d) return i * 3 + Math.max(0, Math.min(3, Math.floor(+p.outs || 0)));
    return (d === 'top' && h === 'bottom' ? i + 1 : i) * 3;
  };
  const on = new Map(), segs = [];
  const put = (p, pos, from) => { if (pos && pos !== 'DH') on.set(key(p), { p, pos, from }); };
  const close = (x, to) => { on.delete(key(x.p)); segs.push({ ...x, to }); };
  st.forEach(p => put(p, norm(p.pos) || 'ETC', -Infinity));
  subs.forEach(e => {
    const t = eff(e), inP = find(e) || { id: e.id, name: e.name, num: e.num, pos: '' };
    const cur = e.out ? [...on.values()].find(x => same(x.p, e.out)) : e.k === 'P' ? [...on.values()].find(x => x.pos === 'P') : null;
    if (cur) close(cur, t);
    const was = on.get(key(inP));   // 이미 수비 중인 선수가 다른 자리로 (재출전 · 겹친 기록)
    if (was) close(was, t);
    put(inP, e.k === 'P' ? 'P' : norm(inP.pos) || (cur && cur.pos) || 'ETC', t);
  });
  [...on.values()].forEach(x => close(x, Infinity));

  let inns = [...new Set(abs.filter(a => side(a) !== team).map(innNo).filter(n => n > 0))];
  if (!inns.length) {   // 상대 타석을 안 적은 경기 — 이 경기에 나온 마지막 이닝까지 모두 수비했다고 본다
    const mx = Math.max(0, ...abs.map(innNo).filter(n => n > 0));
    inns = Array.from({ length: mx }, (_, i) => i + 1);
  }
  const out = {};
  segs.forEach(x => {
    const n = inns.reduce((s, i) => s + Math.max(0, Math.min(x.to, i * 3 + 3) - Math.max(x.from, i * 3)), 0);
    if (!n || !x.p.name) return;
    const r = out[x.p.name] || (out[x.p.name] = { name: x.p.name, num: x.p.num ?? '', outs: {} });
    r.outs[x.pos] = (r.outs[x.pos] || 0) + n;
  });
  return out;
}

// 아웃 → '4⅔' (이닝 표기)
export const ipTxt = o => (o ? `${Math.floor(o / 3) || ''}${['', '⅓', '⅔'][o % 3]}` || '0' : '-');

// 팀 대시보드 카드 — 합계 · 경기를 이름 바로 옆에(폰에서 옆으로 밀지 않고 보이게) · games = team.js 의 경기 목록(key · current · abs), team = 'home' | 'away'
export function fieldInnCard(games, team) {
  const recs = new Map(loadGames().map(r => [r.key, r]));
  const lk = team === 'away' ? 'away_lineup' : 'home_lineup';
  const tot = Object.create(null);
  let n = 0;
  (games || []).forEach(g => {
    const lu = g.current ? (window.AS || {})[lk] : ((recs.get(g.key) || {}).data || {})[lk];
    const r = gameInnings(g.abs, lu, team);
    if (!r) return;
    n++;
    Object.values(r).forEach(p => {
      const t = tot[p.name] || (tot[p.name] = { name: p.name, num: p.num, outs: {}, all: 0, g: 0 });
      if (t.num === '' && p.num !== '') t.num = p.num;
      t.g++;
      Object.keys(p.outs).forEach(k => { t.outs[k] = (t.outs[k] || 0) + p.outs[k]; t.all += p.outs[k]; });
    });
  });
  const head = '<header class="an-hd"><h3>포지션별 수비 이닝</h3>';
  if (!n) return `<section class="an-card">${head}</header><div class="an-note">라인업에 수비 위치(투수 · 포수 · 유격 …)를 적으면 선수마다 어느 자리에서 몇 이닝 뛰었는지 여기에 쌓여요. 교체는 경기 운영 모드로 기록한 것만 들어가요.</div></section>`;
  const rows = Object.values(tot).sort((a, b) => b.all - a.all || String(a.name).localeCompare(String(b.name), 'ko'));
  const cols = POS.concat(rows.some(r => r.outs.ETC) ? [['ETC', '기타']] : []);
  return `
    <section class="an-card">
      ${head}<span class="an-hd-note">${n}경기 · 선발 위치 + 경기 운영 모드 교체로 셈 · ⅓ = 아웃 1개 · 교체 없이 자리만 바꾼 것은 안 들어가요</span></header>
      <div class="tm-roster-wrap">
        <table class="tm-roster tm-fieldinn">
          <thead><tr><th scope="col" class="tm-sticky">선수</th><th scope="col">합계</th><th scope="col">경기</th>${cols.map(c => `<th scope="col">${c[1]}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `
            <tr><th scope="row" class="tm-sticky"><b>${esc(r.name)}</b>${r.num !== '' && r.num != null ? `<small>#${esc(r.num)}</small>` : ''}</th>
              <td class="lead">${ipTxt(r.all)}</td><td>${r.g}</td>${cols.map(c => `<td>${ipTxt(r.outs[c[0]] || 0)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}

window.slFieldInnings = Object.assign(gameInnings, { ip: ipTxt });   // 테스트용
