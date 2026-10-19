// 게임원 투수 시즌 기록 — 분석 탭 › 투수 화면 아래 카드 (투구 기록이 없어도 보인다)
// 게임원 가져오기가 경기 데이터에 남긴 pitchLines(투수 표 — 원정 · 홈)를 저장 경기 전체에서 모아 팀별 · 투수별로 더한다.
//   · 저장 경기 읽기 = SLGames.loadGames (같은 경기 사본은 하나로) — data.pitchLines 가 있는 경기만
//   · 팀 = 그 경기의 원정(ta) · 홈(th) 이름. 게임원 경기는 '홈 = 우리 팀' 이 아니라서 팀을 고른다(기본 = 가장 많이 나온 팀)
//   · 평균자책점 = 자책 × 7 ÷ 이닝 — 게임원 방어율과 같은 7이닝 기준(실제 11개 리그 투수 69명 모두 7이닝 기준과 같았다, 2026-10-19).
//     이닝은 아웃 수로 정확히 센다(게임원은 ⅓ = .33 · ⅔ = .66 으로 잘라 소수 둘째 자리가 조금 다를 수 있다)
//   · WHIP = (피안타 + 볼넷) ÷ 이닝 · 삼진% · 볼넷% = ÷ 상대 타자 · 피안타율 = 피안타 ÷ 타수
//   · 저장된 값은 누가 만들었는지 모르므로(가져오기 · 동기화) 숫자 · 글자만 골라 더한다
// pitcher.js 는 고치지 않는다: openPitcherView 를 감싸 #anaSecPitcher 안 #pitcherView 아래에 카드를 따로 둔다

const KEY = 'sl_go_pteam';   // 마지막으로 고른 팀 (이 기기 편의용)
const FIELDS = ['outs', 'tbf', 'ab', 'h', 'hr', 'bb', 'hbp', 'k', 'r', 'er', 'np'];
const $ = id => document.getElementById(id);
const _esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const _n = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
const _str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// games = SLGames.loadGames() 결과([{ data }]) → [{ name, games, pitchers: [{ name, number, g, w, l, sv, outs, tbf, ab, h, hr, bb, hbp, k, r, er, np }] }]
// 팀 순서 = 경기 수 많은 순(같으면 이름순) · 투수 순서 = 이닝 많은 순
export function collectGoPitching(games) {
  const teams = Object.create(null);
  (Array.isArray(games) ? games : []).forEach(r => {
    const d = r && r.data, pl = d && d.pitchLines;
    if (!pl || typeof pl !== 'object') return;
    [['away', d.ta], ['home', d.th]].forEach(([side, tn]) => {
      const list = Array.isArray(pl[side]) ? pl[side] : null, name = _str(tn, 20);
      if (!list || !list.length || !name) return;
      const t = teams[name] || (teams[name] = { name, games: 0, map: Object.create(null) });
      t.games++;
      const inGame = Object.create(null);   // 한 경기에 두 번 나온 투수(다시 등판)도 경기 수는 1
      list.forEach(x => {
        if (!x || typeof x !== 'object') return;
        const pn = _str(x.name, 20), num = _str(x.number, 4);
        if (!pn) return;
        const k = pn + '|' + num;
        const p = t.map[k] || (t.map[k] = Object.assign({ name: pn, number: num, g: 0, w: 0, l: 0, sv: 0 }, ...FIELDS.map(f => ({ [f]: 0 }))));
        if (!inGame[k]) { inGame[k] = 1; p.g++; }
        if (x.result === '승') p.w++; else if (x.result === '패') p.l++; else if (x.result === '세') p.sv++;
        FIELDS.forEach(f => { p[f] += _n(x[f]); });
      });
    });
  });
  return Object.values(teams)
    .map(t => ({ name: t.name, games: t.games, pitchers: Object.values(t.map).sort((a, b) => b.outs - a.outs || b.tbf - a.tbf) }))
    .sort((a, b) => b.games - a.games || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// 비율 지표 (분모가 0이면 null)
export function goPitchRates(p) {
  const o = p.outs;
  return {
    era: o ? p.er * 21 / o : null,
    whip: o ? (p.h + p.bb) * 3 / o : null,
    kPct: p.tbf ? p.k / p.tbf : null,
    bbPct: p.tbf ? p.bb / p.tbf : null,
    avg: p.ab ? p.h / p.ab : null,
  };
}

const _ip = o => `${Math.floor(o / 3)}${o % 3 ? ` ${o % 3}/3` : ''}`;   // pitcher.js 이닝 표기와 같게
const _f2 = v => (v == null ? '—' : v.toFixed(2));
const _pct = v => (v == null ? '—' : Math.round(v * 100) + '%');
const _avg = v => (v == null ? '—' : v.toFixed(3).replace(/^0/, ''));

let _team = null;
function _savedTeam() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

function _row(p, head) {
  const R = goPitchRates(p);
  return `<tr${head ? ' class="go-ps-total"' : ''}><th scope="row">${head ? '팀 합계' : _esc(p.name) + (p.number ? ` <small>#${_esc(p.number)}</small>` : '')}</th>`
    + `<td>${p.g}</td><td>${p.w}-${p.l}-${p.sv}</td><td>${_ip(p.outs)}</td><td>${_f2(R.era)}</td><td>${_f2(R.whip)}</td>`
    + `<td>${_pct(R.kPct)}</td><td>${_pct(R.bbPct)}</td><td>${_avg(R.avg)}</td><td>${p.tbf}</td></tr>`;
}

export function renderGoPitchSeason() {
  const sec = $('anaSecPitcher');
  if (!sec) return;
  let box = $('goPitchSeason');
  if (!box) { box = document.createElement('div'); box.id = 'goPitchSeason'; sec.appendChild(box); }
  const teams = collectGoPitching(window.SLGames ? window.SLGames.loadGames({ withCurrent: false }) : []);
  if (!teams.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  if (!_team) _team = _savedTeam();
  const t = teams.find(x => x.name === _team) || teams[0];
  const total = Object.assign({ g: t.games, w: 0, l: 0, sv: 0 }, ...FIELDS.map(f => ({ [f]: 0 })));
  t.pitchers.forEach(p => { ['w', 'l', 'sv'].concat(FIELDS).forEach(f => { total[f] += p[f]; }); });
  box.innerHTML = `
    <section class="an-card go-ps">
      <header class="an-hd"><h3>게임원 투수 시즌 기록</h3><span class="an-hd-note">가져온 경기 ${t.games}개</span></header>
      <label class="go-ps-team"><span>팀</span><select onchange="goPitchTeam(this.value)" aria-label="투수 시즌 기록을 볼 팀">${teams.map(x =>
        `<option value="${_esc(x.name)}"${x === t ? ' selected' : ''}>${_esc(x.name)} · ${x.games}경기</option>`).join('')}</select></label>
      <div class="pc-apps-wrap">
        <table class="pc-apps">
          <thead><tr><th scope="col">투수</th><th scope="col">경기</th><th scope="col">승-패-세</th><th scope="col">이닝</th><th scope="col">평균자책</th><th scope="col">WHIP</th><th scope="col">삼진%</th><th scope="col">볼넷%</th><th scope="col">피안타율</th><th scope="col">상대</th></tr></thead>
          <tbody>${t.pitchers.map(p => _row(p)).join('')}${t.pitchers.length > 1 ? _row(total, true) : ''}</tbody>
        </table>
      </div>
      <p class="go-ps-note">게임원에서 투수 표와 함께 가져온 경기만 셉니다. 평균자책점은 게임원과 같은 7이닝 기준이고, 이닝을 아웃 수로 정확히 세어 ⅓이닝이 낀 경우 게임원 숫자와 소수 둘째 자리가 조금 다를 수 있습니다.</p>
    </section>`;
}

export function goPitchTeam(name) {
  _team = String(name);
  try { localStorage.setItem(KEY, _team); } catch (e) {}
  renderGoPitchSeason();
}

if (typeof window !== 'undefined') {
  window.SLGoPitch = { collectGoPitching, goPitchRates, renderGoPitchSeason };
  window.goPitchTeam = goPitchTeam;
  const orig = window.openPitcherView;   // pitcher.js 가 먼저 정한다(app.js 에서 이 파일보다 앞에 import)
  if (typeof orig === 'function' && !orig._gops) {
    const wrapped = function () { const r = orig.apply(this, arguments); try { renderGoPitchSeason(); } catch (e) {} return r; };
    wrapped._gops = true;
    window.openPitcherView = wrapped;
  }
}
