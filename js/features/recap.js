// 경기 기사 — 기록된 숫자만으로 학부모 · 팀 단톡방에 보낼 짧은 기사를 자동 작성 (AI · 서버 없음, column.js 와 같은 원칙)
// 자리: 경기 리포트(GAME REPORT, core.js showPostGameReport) 공유 줄의 「📰 경기 기사」 → 카드 맨 아래에 기사 · 복사 · 공유
// 구조: 제목 · 부제 → 결과(리드) → 흐름(이닝별 득점이 있을 때만) → 수훈 타자 → 마운드 → 출처
// 규칙: 기록에 없는 것은 쓰지 않는다
//   · 이닝별 득점 합이 최종 점수와 다르면 흐름 문단을 뺀다
//   · 역전승 · 결승타는 경기 운영 모드 득점 기록(scored · runEv)의 합이 점수판 점수와 같을 때만 (순서를 알 때만) — 영봉승 = 이기고 상대 0점
//   · 우리 팀 = 내 팀(tHome · 타석 team 'home'), 상대 = 원정(team 'away') — 경기 리포트(_pgAbs)와 같은 기준
//   · 투수는 공을 받은 타자 팀(투구 bteam)으로 가른다: 상대 타자(away)에게 던진 투수 = 우리 투수. 상대 투수는 마운드 문단에 넣지 않는다
import { HITS, NOAB, BASE, esc } from '../constants.js';
import { josa } from './batdata.js?v=9';

const XBH = ['홈런', '3루타', '2루타'];
const J = (w, a, b) => w + josa(w, a, b);
// 말 + 로/으로: 숫자 0(영) 3(삼) 6(육) → 으로 · 한글은 받침이 있으면 으로, 단 ㄹ 받침은 로(포일로 · 땅볼로)
const ro = s => {
  const c = String(s).slice(-1).charCodeAt(0), j = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : -1;
  return s + (/[036]$/.test(s) ? '으로' : /\d$/.test(s) ? '로' : j >= 0 ? (j && j !== 8 ? '으로' : '로') : josa(s, '으로', '로'));
};
// ['홈런', '2루타'] → 홈런과 2루타 · 셋 이상 → A, B와 C
const listKo = l => (l.length < 2 ? l[0] || '' : [...l.slice(0, -2), J(l[l.length - 2], '과', '와') + ' ' + l[l.length - 1]].join(', '));
const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);

function _dateTxt(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? `${+m[2]}월 ${+m[3]}일` : '';
}

// 타자별 줄
function _lines(abs) {
  const m = new Map();
  abs.forEach(a => {
    const k = a.bid != null ? String(a.bid) : a.bname;
    if (!m.has(k)) m.set(k, { key: k, name: a.bname || '이름 없음', pa: 0, ab: 0, h: 0, rbi: 0, bb: 0, tb: 0, t: Object.create(null) });
    const L = m.get(k);
    L.pa++;
    if (!NOAB.includes(a.res)) L.ab++;
    if (HITS.includes(a.res)) { L.h++; L.tb += BASE[a.res] || 0; }
    if (XBH.includes(a.res)) L.t[a.res] = (L.t[a.res] || 0) + 1;
    if (a.res === '볼넷' || a.res === '사구') L.bb++;
    L.rbi += num(a.rbi);
  });
  return [...m.values()];
}
const _xbhTxt = t => XBH.filter(r => t[r]).map(r => (t[r] > 1 ? `${r} ${t[r]}개` : r));
// 수훈 타자 3명 밖의 2안타 이상: 'A(2안타 1타점), B(2안타)와 C(3안타)도 멀티히트를 기록했다.' — 조사는 이름에 맞춘다
function _multi(l) {
  if (!l.length) return [];
  const w = l.map(x => `${x.name}(${x.h}안타${x.rbi ? ` ${x.rbi}타점` : ''})`);
  if (w.length > 1) w[w.length - 2] += josa(l[l.length - 2].name, '과', '와');
  return [`${w.slice(0, -2).concat(w.length > 1 ? [w[w.length - 2] + ' ' + w[w.length - 1]] : w).join(', ')}도 멀티히트를 기록했다.`];
}

// 오늘의 선수 bid — GAME REPORT(core.js _pgMvp)와 똑같이: 루타 + 타점이 가장 큰 타자, 안타 1개 이상.
// 점수가 같으면 _pgMvp 처럼 bid 를 키로 쓴 객체 순서(숫자 bid 는 작은 순, 나머지는 처음 나온 순)
function _mvpBid(abs) {
  const m = Object.create(null);
  abs.forEach(a => {
    const e = m[a.bid] || (m[a.bid] = { bid: a.bid, s: 0, h: 0 });
    e.s += (BASE[a.res] || 0) + (a.rbi || 0);
    if (HITS.includes(a.res)) e.h++;
  });
  const arr = Object.values(m).sort((x, y) => y.s - x.s);
  return arr.length && arr[0].h > 0 ? arr[0].bid : null;
}

// 이름 가리기 — 공유 링크와 같은 규칙(core.js _anonSharePayload: 등번호 있으면 #번호, 없으면 성OO · 겹치면 구분) + " 선수"
// 라인업(hl · al)을 같이 넘겨 공유 링크와 같은 표기가 나오게 한다. 투수는 따로(pit) 센다
function _anon(src) {
  const abs = src.abs || [], ps = src.pitchers || [];
  const lp = arr => (Array.isArray(arr) ? arr : []).map(p => ({ id: p.id, n: p.name, no: p.num }));
  const pay = { hl: lp(src.hl), al: lp(src.al),
    abs: abs.map(a => ({ bid: a.bid, bn: a.bname != null ? String(a.bname) : '', bno: a.bnum, t: a.team })),
    pitchers: ps.map(p => ({ id: p.id, nm: p.name, no: p.num })) };
  const lab = (n, no) => (no != null && no !== 0 && String(no).trim() ? '#' + String(no).trim() : String(n || '').trim() ? String(n).trim()[0] + 'OO' : '선수');
  let out = null;
  try { if (typeof window !== 'undefined' && typeof window._anonSharePayload === 'function') out = window._anonSharePayload(pay); } catch (e) {}
  // 투수 기록엔 보통 등번호가 없다 — 등번호 없는 투수가 라인업에 같은 이름 한 명뿐이면 타자와 같은 표기로.
  // 예전엔 같은 사람이 타선에선 「#6 선수」, 마운드에선 「박OO 선수」로 갈렸다 (흐름 점검 11-06 ⑬). 타석에 적힌 투수(a.pitcher)도 같은 표기로
  const lu = pay.hl.map((p, i) => [p.n, out ? out.hl[i].n : lab(p.n, p.no)]).concat(pay.al.map((p, i) => [p.n, out ? out.al[i].n : lab(p.n, p.no)]));
  const asBat = n => { const m = lu.filter(x => x[0] === n); return m.length === 1 ? m[0][1] : null; };
  const hasNo = no => no != null && no !== 0 && String(no).trim() !== '';
  const pit = ps.map((p, i) => ((!hasNo(p.num) && asBat(p.name)) || (out ? out.pitchers[i].nm : lab(p.name, p.num))) + ' 선수');
  const pitOf = n => { const i = ps.findIndex(p => p.name === n); return i >= 0 ? pit[i] : (asBat(n) || lab(n, null)) + ' 선수'; };
  return Object.assign({}, src, {
    abs: abs.map((a, i) => Object.assign({}, a, { bname: (out ? out.abs[i].bn : lab(a.bname, a.bnum)) + ' 선수' }, a.pitcher ? { pitcher: pitOf(a.pitcher) } : {})),
    pitchers: ps.map((p, i) => Object.assign({}, p, { name: pit[i] })),
  });
}

// 결승점: 반 이닝씩 점수를 더해 이긴 팀이 마지막으로 앞서기 시작한 반 이닝 (이닝별 득점이 다 있을 때만)
function _decider(ls, side, win) {
  const top = side === 'away' ? 'home' : 'away', bot = top === 'home' ? 'away' : 'home';
  const n = Math.max(ls.home.length, ls.away.length), s = { home: 0, away: 0 };
  const lead = () => (s.home > s.away ? 'home' : s.away > s.home ? 'away' : null);
  let dec = null;
  for (let i = 0; i < n; i++) {
    for (const [t, half] of [[top, '초'], [bot, '말']]) {
      const before = lead();
      s[t] += num(ls[t][i]);
      const now = lead();
      if (now === win && before !== win) dec = { inn: i + 1, half };
      else if (now !== win) dec = null;
    }
  }
  return dec;
}

// ── 득점 순서 (경기 운영 모드: 타석의 scored · 주루 플레이 runEv — runners.js) ──
// 타석 순서대로 그 타석으로 들어온 점수, 그 뒤 주루 플레이(폭투 · 포일 · 홈스틸 …) 득점.
// 합이 점수판 점수와 같을 때만 쓴다 — 손으로 바꾼 점수 · 운영 모드 없이 적은 타석이 섞이면 순서를 모르니 null
const _side = a => (a && a.team === 'away' ? 'away' : 'home');
function _timeline(abs, hs, as) {
  if (!abs.some(a => Array.isArray(a.scored))) return null;
  const ev = [];
  abs.forEach(a => {
    if (Array.isArray(a.scored) && a.scored.length) ev.push({ team: _side(a), n: a.scored.length, ab: a });
    (Array.isArray(a.runEv) ? a.runEv : []).forEach(e => { if (e && e.t !== 'SUB' && e.scored) ev.push({ team: e.team === 'away' ? 'away' : 'home', n: 1, run: e }); });
  });
  const tot = { home: 0, away: 0 };
  ev.forEach(e => { tot[e.team] += e.n; });
  return tot.home === hs && tot.away === as ? ev : null;
}
// 가장 크게 뒤졌던 점수 차 · 결승 득점(우리 팀이 마지막으로 앞서 나간 득점 — 그 뒤로 동점 · 역전이 없었다)
function _flow(ev) {
  let h = 0, a = 0, worst = 0, lead = null;
  ev.forEach(e => {
    const was = h > a;
    if (e.team === 'home') h += e.n; else a += e.n;
    if (h - a < worst) worst = h - a;
    if (!was && h > a && e.team === 'home') lead = e;
  });
  return { behind: -worst, lead };
}
// 결승타 말: 적시타 · 2타점 2루타 · 3점 홈런 · 희생플라이 · 밀어내기 볼넷 …
const _hrKind = r => ({ 1: '솔로', 2: '2점', 3: '3점', 4: '만루' }[r] || '');
function _rbiPhrase(a) {
  const r = num(a.rbi);
  switch (a.res) {
    case '홈런': return (_hrKind(r) ? _hrKind(r) + ' ' : '') + '홈런';
    case '안타': return r >= 2 ? r + '타점 적시타' : '적시타';
    case '내야안타': return r >= 2 ? r + '타점 내야안타' : '적시 내야안타';
    case '2루타': case '3루타': return r >= 2 ? `${r}타점 ${a.res}` : '적시 ' + a.res;
    case '희비': return '희생플라이';
    case '희타': return '희생번트';
    case '볼넷': return '밀어내기 볼넷';
    case '사구': return '밀어내기 몸에 맞는 공';
    case '땅볼 아웃': return '타점 땅볼';
    case '플라이 아웃': return '타점 뜬공';
    default: return (r >= 2 ? r + '타점 ' : '') + a.res;
  }
}
// 타점이 붙은 이 결과면 '결승타는 …', 아니면(실책 · 병살 · 폭투 등으로 들어온 결승점) '결승점은 … 들어왔다'
const RBI_RES = [...HITS, '희비', '희타', '볼넷', '사구', '땅볼 아웃', '플라이 아웃', '야수선택'];
const _RUN_PH = { WP: '상대 폭투', PB: '상대 포일', SB: '홈스틸' };
const _AB_PH = { '실책': '상대 실책', '야수선택': '야수선택', '병살': '병살타', '땅볼 아웃': '땅볼', '플라이 아웃': '뜬공' };
// 이닝 숫자: '5회말' → 5 · '연장' → 연장
const _innTxt = inn => { const n = parseInt(inn, 10); return n >= 1 && n <= 30 ? n + '회' : String(inn || '').trim() === '연장' ? '연장' : ''; };

// src = { th, ta, hs, as, info: { date, venue, side, ls }, abs, pitchers, ls(경기 운영 모드 득점 — 없으면 null), anon(이름 가리기), hl · al(라인업) }
// 반환: { title, sub, paras: [...], note } · 타석이 하나도 없으면 null
export function buildRecap(src) {
  if (src && src.anon) src = _anon(src);
  const all = (src.abs || []).filter(Boolean);
  if (!all.length) return null;
  const mine = all.filter(a => a.team !== 'away');
  const ours = mine.length ? mine : all;
  const opp = mine.length ? all.filter(a => a.team === 'away') : [];
  const th = src.th || '내 팀', ta = src.ta || '상대 팀', hs = num(src.hs), as = num(src.as), info = src.info || {};
  const res = hs > as ? 'win' : hs < as ? 'loss' : 'tie';
  const score = `${hs}-${as}`;

  // 팀 타격
  const L = _lines(ours);
  const h = L.reduce((s, x) => s + x.h, 0), bb = L.reduce((s, x) => s + x.bb, 0);
  const k = ours.filter(a => a.res === '삼진').length;
  const t = Object.create(null);
  L.forEach(x => XBH.forEach(r => { if (x.t[r]) t[r] = (t[r] || 0) + x.t[r]; }));

  // 수훈 타자: 2안타 이상 · 홈런 · 2타점 이상 — 루타 + 타점 순, 3명까지.
  // 맨 앞(부제 · 첫 문장)은 GAME REPORT 「오늘의 선수」와 같은 사람 (단타 1개뿐이어도)
  // ponytail: bid 없는 타석은 _pgMvp 가 한데 묶어서 맞추지 않는다 — 그때는 예전 순서
  const mb = _mvpBid(ours), top = mb != null ? L.find(x => x.key === String(mb)) : null;
  let stars = L.filter(x => x.h >= 2 || x.t['홈런'] || x.rbi >= 2).sort((a, b) => (b.tb + b.rbi) - (a.tb + a.rbi) || b.h - a.h);
  if (top) stars = [top, ...stars.filter(x => x !== top)];
  stars = stars.slice(0, 3);
  const mvp = stars[0];

  // 득점 순서를 알면(경기 운영 모드 · 합 = 점수) 역전승 · 결승타. 이닝은 운영 모드이거나 이닝이 두 가지 이상 적힌 경기만 (안 바꾼 기본값 1회를 믿지 않는다)
  const ev = _timeline(all, hs, as), fl = ev ? _flow(ev) : null;
  const comeback = res === 'win' && !!fl && fl.behind > 0;
  const innOk = ours.some(a => a.gfPre) || new Set(ours.map(a => _innTxt(a.inn)).filter(Boolean)).size >= 2;
  const pre = inn => (innOk && _innTxt(inn) ? _innTxt(inn) + ' ' : '');
  let win1 = '';
  if (res === 'win' && fl && fl.lead) {
    const e = fl.lead;
    if (e.ab) {
      const a = e.ab, who = a.bname || '이름 없음';
      win1 = num(a.rbi) > 0 && RBI_RES.includes(a.res)
        ? `결승타는 ${pre(a.inn)}${who}의 ${J(_rbiPhrase(a), '이었다', '였다')}.`
        : `결승점은 ${pre(a.inn)}${who} 타석에서 나온 ${ro(_AB_PH[a.res] || a.res)} 들어왔다.`;
    } else if (e.run && _RUN_PH[e.run.t]) win1 = `결승점은 ${pre(e.run.inn)}${ro(_RUN_PH[e.run.t])} 들어왔다.`;
  }

  const title = res === 'win' ? `${th}, ${ta}에 ${score} ${comeback ? '역전승' : as === 0 ? '영봉승' : '승리'}` : res === 'loss' ? `${th}, ${ta}에 ${score} 패배` : `${th}·${ta}, ${score} 무승부`;
  const sub = mvp ? `${mvp.name} ${mvp.ab}타수 ${mvp.h}안타${mvp.rbi ? ` ${mvp.rbi}타점` : ''}${mvp.t['홈런'] ? ` · 홈런 ${mvp.t['홈런']}개` : ''}`
    : h ? `팀 안타 ${h}개` : '';

  const paras = [];
  // 리드
  const when = [_dateTxt(info.date), info.venue ? `${info.venue}에서` : ''].filter(Boolean).join(' ');
  const head = when ? `${when} 열린 경기에서 ` : '';
  const lead = res === 'win' ? (comeback ? `${head}${J(th, '이', '가')} ${ta}에 최대 ${fl.behind}점 차로 끌려가다 ${ro(score)} 역전승했다.` : `${head}${J(th, '이', '가')} ${J(ta, '을', '를')} ${ro(score)} 이겼다.`)
    : res === 'loss' ? `${head}${J(th, '은', '는')} ${ta}에 ${ro(score)} 졌다.`
    : `${head}${J(th, '과', '와')} ${J(ta, '은', '는')} ${ro(score)} 비겼다.`;
  const xb = _xbhTxt(t);
  const bat = h
    ? `${th} 타선은 안타 ${h}개${xb.length ? `(${xb.join(' · ')})` : ''}${bb ? `와 볼넷·사구 ${bb}개를 묶었다.` : '를 쳤다.'}`
    : `${th} 타선은 안타를 치지 못했다${bb ? `(볼넷·사구 ${bb}개)` : ''}.`;
  // 도루: 경기 운영 모드 주루 기록(runEv t 'SB' — runners.js)만. 우리 팀 = team 'away' 가 아닌 주자
  const sb = all.flatMap(a => (Array.isArray(a.runEv) ? a.runEv : []))
    .filter(e => e && e.t === 'SB' && (mine.length ? e.team !== 'away' : true)).length;
  paras.push([lead, bat, sb ? `도루는 ${sb}개를 성공했다.` : '', k >= 5 ? `삼진은 ${k}개였다.` : ''].filter(Boolean).join(' '));

  // 흐름: 이닝별 득점(경기 운영 모드 득점 → 없으면 가져온 이닝별 점수표) 합이 최종 점수와 같을 때만
  const ls = src.ls || (info.ls && typeof info.ls === 'object' ? info.ls : null);
  const row = k2 => (ls && Array.isArray(ls[k2]) ? ls[k2] : []);
  const sum = r => r.reduce((s, v) => s + num(v), 0);
  // 결승타(득점 순서를 알 때)가 있으면 '결승점은 N회말에 나왔다' 대신 그 문장
  const f = [];
  if (ls && sum(row('home')) === hs && sum(row('away')) === as && hs + as > 0) {
    const ins = row('home').map((v, i) => (num(v) > 0 ? `${i + 1}회 ${v}점` : '')).filter(Boolean);
    if (ins.length) f.push(`${J(th, '은', '는')} ${ins.length === 1 ? ins[0] : ins.slice(0, -1).join(', ') + ', ' + ins[ins.length - 1]}을 뽑았다.`);
    if (res !== 'tie' && !win1) {
      const d = _decider({ home: row('home'), away: row('away') }, info.side, res === 'win' ? 'home' : 'away');
      if (d) f.push(`결승점은 ${d.inn}회${d.half}에 나왔다.`);
    }
  }
  if (win1) f.push(win1);
  if (f.length) paras.push(f.join(' '));

  // 수훈 타자
  if (stars.length) {
    paras.push(stars.map((x, i) => {
      const line = `${x.ab}타수 ${x.h}안타${x.rbi ? ` ${x.rbi}타점` : ''}`;
      const xt = _xbhTxt(x.t);
      const inc = xt.length ? `${J(listKo(xt), '을', '를')} 포함해 ` : '';
      return `${i ? '' : '공격에서는 '}${J(x.name, '이', '가')} ${inc}${J(line, '을', '를')} 기록했다${x.bb ? `(볼넷·사구 ${x.bb}개)` : ''}.`;
    }).concat(_multi(L.filter(x => x.h >= 2 && !stars.includes(x)))).join(' '));
  } else if (h) {
    const hitters = L.filter(x => x.h).map(x => x.name);
    paras.push(`안타는 ${listKo(hitters.slice(0, 5))}${hitters.length > 5 ? ` 등 ${hitters.length}명` : ''}${josa(hitters.length > 5 ? '명' : hitters[Math.min(hitters.length, 5) - 1], '이', '가')} 쳤다.`);
  }

  // 마운드: 상대 타자에게 던진 공이 더 많은 투수 = 우리 투수 (등록 순서 = 등판 순서)
  const mound = (src.pitchers || []).map(p => {
    const ps = Array.isArray(p.pitches) ? p.pitches : [];
    const away = ps.filter(x => x && x.bteam === 'away').length, home = ps.filter(x => x && x.bteam === 'home').length;
    return { name: p.name, n: ps.length, ours: away > home };
  }).filter(p => p.ours && p.n > 0);
  // 공을 안 적은 투수도 상대 타석에 그 투수가 적혀 있으면(경기 운영 · 투수 교체) 넣는다 — 예전엔 마무리가 빠져 「2명이 이어 던졌다」 (흐름 점검 11-06 ⑬)
  opp.forEach(a => { if (a.pitcher && !mound.some(p => p.name === a.pitcher)) mound.push({ name: a.pitcher, n: 0, ours: true }); });
  const m = [], pn = p => (p.n ? `${p.name} ${p.n}구` : p.name);
  if (mound.length === 1) m.push(`마운드에서는 ${J(mound[0].name, '이', '가')} ${mound[0].n ? `${mound[0].n}구를 ` : ''}던졌다.`);
  else if (mound.length > 1) m.push(`마운드에서는 ${J(mound.map(pn).join(', '), '으로', '로')} ${mound.length}명이 이어 던졌다.`);
  if (opp.length >= 3) {
    const oh = opp.filter(a => HITS.includes(a.res)).length, ok = opp.filter(a => a.res === '삼진').length;
    m.push(`${ta} 타선은 안타 ${oh}개${ok ? `, 삼진 ${ok}개` : ''}를 기록했다.`);
  }
  if (m.length) paras.push(m.join(' '));

  const note = `SprayLab 기록 기준 — 우리 팀 ${ours.length}타석${opp.length ? ` · 상대 ${opp.length}타석` : ''}. 기록하지 않은 플레이는 기사에 들어가지 않아요.`;
  return { title, sub, paras, note };
}

export function recapText(r) {
  return [`■ ${r.title}`, ...(r.sub ? [`— ${r.sub}`] : []), '', ...r.paras.flatMap(p => [p, '']), r.note, '', 'SprayLab · YOUR SWING, VISUALIZED'].join('\n');
}

// ── 경기 리포트 화면 ───────────────────────────────────────────
const $ = id => document.getElementById(id);
const _val = (id, d) => (($(id) || {}).value || '').trim() || d;
function _src() {
  const A = window.AS || {};
  return {
    th: _val('tHome', '내 팀'), ta: _val('tAway', '원정팀'), hs: A.hs, as: A.as,
    info: window.gameInfo ? window.gameInfo() : A.info || {},
    abs: A.abs || [], pitchers: A.pitchers || [],
    ls: window.slLineScore ? window.slLineScore(A.abs || []) : null,
    hl: A.home_lineup, al: A.away_lineup, anon: !_names,
  };
}
let _cur = null, _names = false;   // _names: 「선수 실명 포함」 — 기사를 새로 열 때마다 꺼진 채로 (공유 링크와 같게)
function _ga(action) { try { if (typeof window.gtag === 'function') window.gtag('event', 'game_recap', { action }); } catch (e) {} }

// keep = true: 실명 체크만 바꿔 다시 쓰기 (스크롤 · 체크 그대로)
export function openRecap(keep) {
  const card = $('pgCard');
  if (!card) return;
  if (keep !== true) _names = false;
  // ☰ 메뉴에서 열면 경기 리포트부터 띄운다 (기사는 리포트 카드 맨 아래에 붙는다)
  if (!card.classList.contains('up') && typeof window.showPostGameReport === 'function') window.showPostGameReport();
  let box = $('pgRecap');
  if (!box) { box = document.createElement('section'); box.id = 'pgRecap'; box.className = 'pg-ai pg-recap'; box.setAttribute('aria-label', '경기 기사'); card.appendChild(box); }
  _cur = buildRecap(_src());
  box.innerHTML = _cur
    ? `<div class="pg-ai-lbl">📰 경기 기사 <span class="pg-rc-hint">기록된 숫자로만 썼어요</span></div>
       <div class="pg-ai-txt pg-rc-t">${esc(_cur.title)}</div>${_cur.sub ? `<div class="pg-ai-txt pg-rc-s">${esc(_cur.sub)}</div>` : ''}
       ${_cur.paras.map(p => `<div class="pg-ai-txt">${esc(p)}</div>`).join('')}
       <div class="pg-ai-txt pg-rc-n">${esc(_cur.note)}</div>
       <label class="pg-rc-names"><input type="checkbox" id="pgRecapNames"${_names ? ' checked' : ''} onchange="recapNames(this.checked)"> 선수 실명 포함 <span class="pg-rc-hint">끄면 #등번호 · 성OO</span></label>
       <div class="pg-share-row pg-rc-act"><button type="button" class="pg-sh-btn acc" id="pgRecapCopy" onclick="copyRecap()">📋 복사</button>${navigator.share ? '<button type="button" class="pg-sh-btn" onclick="shareRecap()">↗ 보내기</button>' : ''}</div>`
    : '<div class="pg-ai-txt">타석을 기록하면 경기 기사를 쓸 수 있어요.</div>';
  if (keep === true) return;
  if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  _ga('make');
}
export function recapNames(on) { _names = !!on; openRecap(true); }

function _copy(text, done) {
  if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, () => window.showToast && window.showToast('복사하지 못했어요')); return; }
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { if (window.showToast) window.showToast('복사하지 못했어요'); }
  document.body.removeChild(ta);
}
export function copyRecap() {
  if (!_cur) return;
  _copy(recapText(_cur), () => { const b = $('pgRecapCopy'); if (!b) return; b.textContent = '복사 완료!'; setTimeout(() => { b.textContent = '📋 복사'; }, 1500); });
  _ga('copy');
}
export function shareRecap() {
  if (!_cur || !navigator.share) return;
  navigator.share({ title: _cur.title, text: recapText(_cur) }).catch(() => {});
  _ga('share');
}

if (typeof window !== 'undefined') {
  window.SLRecap = { buildRecap, recapText };
  window.openRecap = openRecap;
  window.copyRecap = copyRecap;
  window.shareRecap = shareRecap;
  window.recapNames = recapNames;
  // 공유 줄에 버튼 (scoresheet.js 의 리그 기록지 버튼과 같은 방식)
  const row = document.querySelector('#pgReport .pg-share-row');
  if (row && !$('pgRecapBtn')) row.insertAdjacentHTML('beforeend', '<button class="pg-sh-btn" id="pgRecapBtn" onclick="openRecap()">📰 경기 기사</button>');
  // 리포트를 다시 열면 지난번 기사는 지운다 (그사이 기록이 바뀌었을 수 있다)
  const orig = window.showPostGameReport;
  if (typeof orig === 'function') window.showPostGameReport = function () { const b = $('pgRecap'); if (b) b.remove(); _cur = null; return orig.apply(this, arguments); };
}
