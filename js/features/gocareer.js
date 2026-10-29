// 게임원 통산 카드 — 분석 탭 › 타자 › 시즌 맨 아래 (profile.js profileSeasonHtml 이 부른다)
// 게임원 선수 페이지(이름 · 투타 · 타자기록 · 투수기록)를 붙여넣으면 이 기기에 그 선수 이름으로 저장해 SprayLab 기록 아래에 보여 준다.
//   · 읽기 = js/gameone.js parseGameOneCareer — 게임원 숫자를 그대로 옮긴다(방어율 · 탈삼진율은 게임원의 7이닝 기준)
//   · 저장 = sl_go_career { p: { [SprayLab 선수 이름]: { at, name, hand, bg, school, bat, pit } } }
//     경기 키를 훑는 코드(d.abs 배열 확인)에 걸리지 않게 p 한 겹으로 감싼다
//   · 붙여넣은 이름이 이 선수와 다르면 저장하지 않는다(이름 줄이 없으면 확인 없이 저장)
//   · 타자 · 투수 중 한쪽만 붙여넣으면 그쪽만 바꾸고 다른 쪽은 남긴다
//   · 팀 기록통계(타자랭킹 · 투수랭킹) 페이지를 붙여넣으면 = parseGameOneTeam — 표에 있는 선수 전원을 이름으로 ss: { at, bat, pit } 에 넣는다.
//     그 팀 · 그 시즌 경기만이라 통산(bat · pit)과 따로 두고 따로 보여 준다
//   · 게임원 주소로 가져오기: 팀 페이지 주소(club_idx=) → 팀 선수 전원 통산 + 그 시즌 팀 기록, 선수 페이지 주소(group_code=) → 그 선수 통산.
//     앱은 게임원을 직접 못 읽어(CORS · 옛 보안 연결) 넣는 그때 중계(netlify/functions/gameone.mjs)가 대신 읽는다. 같은 자리(bat · pit · ss)에 넣고
//     auto 표시(「불러옴」). 마지막으로 가져온 팀 = sl_go_team { club, season, team, at } — 다음에 칸에 미리 채워 둔다

const KEY = 'sl_go_career';
const TEAM = 'sl_go_team';
const RELAY = 'https://spraylab-gameone.netlify.app/api/gameone';
const _esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const _nm = s => String(s || '').replace(/\s+/g, '');
const _i = v => (v == null ? '—' : String(v));
const _f2 = v => (typeof v !== 'number' ? '—' : v.toFixed(2));
const _f3 = v => (typeof v !== 'number' ? '—' : v.toFixed(3).replace(/^0\./, '.'));
const _ip = o => (typeof o !== 'number' ? '—' : `${Math.floor(o / 3)}${o % 3 ? ` ${o % 3}/3` : ''}`);   // 투수 화면 이닝 표기와 같게

function _all() {
  try { const o = JSON.parse(localStorage.getItem(KEY)); return o && o.p && typeof o.p === 'object' ? o.p : {}; } catch (e) { return {}; }
}
function _put(p) { localStorage.setItem(KEY, JSON.stringify({ p })); }
function _team() {
  try { const t = JSON.parse(localStorage.getItem(TEAM)); return t && /^\d{1,7}$/.test(t.club) ? t : null; } catch (e) { return null; }
}
const _md = at => { const d = new Date(+at); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };

const _dl = items => `<dl class="pf-counts">${items.map(([l, v]) => `<div><dt>${l}</dt><dd>${_esc(v)}</dd></div>`).join('')}</dl>`;

function _bat(b) {
  return `
    <h4 class="go-cr-h">타자</h4>
    ${_dl([['경기', _i(b.g)], ['타율', _f3(b.avg)], ['출루율', _f3(b.obp)], ['장타율', _f3(b.slg)], ['OPS', _f3(b.ops)], ['타석', _i(b.pa)], ['안타', _i(b.h)], ['홈런', _i(b.hr)],
      ['2루타', _i(b.s2)], ['3루타', _i(b.s3)], ['타점', _i(b.rbi)], ['득점', _i(b.r)], ['도루', _i(b.sb)], ['볼넷', _i(b.bb)], ['삼진', _i(b.k)], ['BB/K', _f2(b.bbk)]])}`;
}
function _pit(p) {
  return `
    <h4 class="go-cr-h">투수</h4>
    ${_dl([['경기', _i(p.g)], ['승-패-세', `${_i(p.w)}-${_i(p.l)}-${_i(p.sv)}`], ['이닝', _ip(p.outs)], ['방어율', _f2(p.era)], ['WHIP', _f2(p.whip)], ['탈삼진', _i(p.k)], ['볼넷', _i(p.bb)], ['피안타율', _f3(p.avg)]])}`;
}
// 팀 기록 페이지에서 받은 시즌 기록 — 통산과 따로(그 팀 · 그 시즌 경기만이라)
function _ss(s) {
  const who = s.team ? ` · ${_esc(s.team)}${s.season ? ` ${+s.season}시즌` : ''}` : '';
  return `
    <div class="go-cr-ss">
      <p class="go-cr-sub">게임원 팀 시즌 기록${who} · ${_md(s.at)} ${s.auto ? '불러옴' : '붙여넣음'}</p>
      ${s.bat ? _bat(s.bat) : ''}
      ${s.pit ? _pit(s.pit) : ''}
      <div class="an-note">게임원 팀 기록통계 숫자예요. 통산이 아니라 ${s.auto ? '그' : '붙여넣은'} 시즌 · 그 팀 경기만이에요.</div>
    </div>`;
}

// 게임원 주소 칸(「＋」 새 선수 카드 맨 위) — 팀 · 선수 페이지 주소를 넣고 「가져오기」. 마지막 팀 주소를 미리 채워 둔다(다시 누르면 새 기록)
function _sync() {
  const t = _team();
  return `
    <div class="go-cr-sync">
      <p class="go-cr-sub">게임원 주소로 가져오기</p>
      <p class="go-cr-how">게임원 <b>팀</b> 페이지 주소를 넣으면 팀 선수 전원의 통산과 그 시즌 팀 기록을, <b>선수</b> 페이지 주소를 넣으면 그 선수 통산을 바로 가져와요.${t && t.at ? ` 마지막으로 가져온 팀: ${_esc(t.team || `팀 번호 ${t.club}`)} · ${_md(t.at)}` : ''}</p>
      <div class="go-cr-acts">
        <input type="url" class="go-cr-club" aria-label="게임원 팀 또는 선수 페이지 주소" placeholder="https://www.gameone.kr/club/?club_idx=…" value="${t ? `https://www.gameone.kr/club/?club_idx=${t.club}${t.season ? `&amp;season=${t.season}` : ''}` : ''}">
        <button type="button" class="go-cr-conn" onclick="goTeamConnect(this)">가져오기</button>
      </div>
      <p class="go-cr-msg go-cr-sync-msg" role="status"></p>
    </div>`;
}

// 통산 · 팀 기록을 붙여넣은 선수 이름 — 타자 › 시즌 칩에 SprayLab 기록 없는 선수도 띄운다
export function goCareerNames() {
  const a = _all();
  return Object.keys(a).filter(n => a[n] && (a[n].bat || a[n].pit || a[n].ss));
}

// name = SprayLab 선수 이름('' = 새 선수 추가: 이름은 붙여넣은 글에서) · games · pa = SprayLab 기록(비교 안내용)
export function goCareerCard(name, games, pa) {
  const c = _all()[name];
  const has = !!(name && c && (c.bat || c.pit));
  const s = name && c && c.ss && (c.ss.bat || c.ss.pit) ? c.ss : null;
  const add = !name;
  const d = has && c.at ? new Date(c.at) : null;
  const meta = has ? [c.hand, c.bg, c.school].filter(Boolean).map(_esc).join(' · ') : '';
  return `
    <section class="an-card go-cr" id="goCareer" data-name="${_esc(name)}" data-g="${+games || 0}" data-pa="${+pa || 0}">
      <header class="an-hd"><h3>게임원 통산</h3><span class="an-hd-note">${d ? `${d.getMonth() + 1}월 ${d.getDate()}일 ${c.auto ? '불러옴' : '붙여넣음'}` : '게임원 선수 페이지 기록'}</span></header>
      ${add ? _sync() : ''}
      ${has ? `
        ${meta ? `<p class="go-cr-meta">${meta}</p>` : ''}
        ${c.bat ? _bat(c.bat) : ''}
        ${c.pit ? _pit(c.pit) : ''}
        <div class="an-note">게임원 숫자를 그대로 옮겼어요(방어율은 게임원과 같은 7이닝 기준). ${+pa ? `위 SprayLab 기록은 여기서 기록한 ${+games || 0}경기 ${+pa}타석만이라 숫자가 달라요.` : 'SprayLab에는 아직 이 선수 타석 기록이 없어요.'}</div>
        <div class="go-cr-acts go-cr-send"><button type="button" class="go-cr-qrbtn" aria-expanded="false" onclick="goCareerQR(this)">📱 폰으로 보내기 (QR)</button></div>
        <div class="go-cr-qr" hidden></div>`
      : `<div class="an-note">${add ? 'SprayLab에 타석 기록이 없는 선수도 게임원 선수 페이지를 붙여넣으면 통산을 볼 수 있어요. 이름은 붙여넣은 글에서 읽어요.' : '게임원에 이 선수 개인 기록이 있으면 붙여넣어 리그 통산을 같이 볼 수 있어요.'}</div>`}
      ${s ? _ss(s) : ''}
      <details class="go-cr-paste"${add ? ' open' : ''}>
        <summary>${has ? '게임원 기록 다시 붙여넣기' : '게임원 기록 붙여넣기'}</summary>
        <p class="go-cr-how">크롬 · 사파리로 게임원 선수 페이지를 열고, 이름부터 투수기록 끝까지 길게 눌러 복사한 뒤 아래에 붙여넣으세요. 게임원 <b>앱</b>은 글자 복사가 안 돼요.</p>
        <p class="go-cr-how"><b>팀 전원 한 번에:</b> 게임원 팀 페이지 › 기록통계 › 타자랭킹(투수랭킹)에서 전체 선택 → 복사해 붙여넣으세요. 그 시즌 · 그 팀 경기만이라 통산과 따로 보여요.</p>
        <textarea class="go-cr-ta" rows="5" aria-label="게임원 선수 페이지 붙여넣기" placeholder="${_esc(name || '선수 이름')}&#10;우투우타&#10;타자기록&#10;경기수 …"></textarea>
        <div class="go-cr-acts">
          <button type="button" class="go-cr-save" onclick="goCareerSave(this)">저장</button>
          ${has || s ? '<button type="button" class="go-cr-del" onclick="goCareerClear(this)">지우기</button>' : ''}
        </div>
        <p class="go-cr-msg" role="status"></p>
      </details>
    </section>`;
}

function _redraw(box) { box.outerHTML = goCareerCard(box.dataset.name, box.dataset.g, box.dataset.pa); }
// 통산만 있는 선수 칩은 칩 줄 끝에 생긴다 → 고른 칩이 보이게 옆으로 넘긴다
function _showChip() {
  const on = document.querySelector('#batterView .an-chip.on');
  if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// 팀 기록 페이지: 표에 있는 선수 전원을 이름으로 — 통산(bat · pit)은 그대로 두고 ss 에만. 타자 · 투수 표를 따로 붙여도 다른 쪽은 남긴다
function _saveTeam(box, t, msg) {
  const all = _all(), at = Date.now(), rows = [['bat', t.bat], ['pit', t.pit]];
  rows.forEach(([k, list]) => list.forEach(r => {
    if (/^__/.test(r.name)) return;
    const o = all[r.name] || (all[r.name] = {});
    o.ss = Object.assign({}, o.ss && !o.ss.auto ? o.ss : null, { at, [k]: r });   // 불러온(auto) 기록 위에 붙이면 새로 시작
  }));
  try { _put(all); } catch (e) { msg.textContent = '저장 공간이 부족해 저장하지 못했어요.'; return; }
  if (window.showToast) window.showToast(`게임원 팀 기록 저장 — 타자 ${t.bat.length}명 · 투수 ${t.pit.length}명`, false);
  // 새 칩이 생기므로 타자 화면을 다시 그린다(새 선수 칸이면 표 첫 선수를 연다)
  if (window.selectBatterSeason) { window.selectBatterSeason(box.dataset.name || (t.bat[0] || t.pit[0]).name); _showChip(); }
  else _redraw(box);
}

export function goCareerSave(btn) {
  const box = btn.closest('#goCareer'), msg = box.querySelector('.go-cr-msg'), text = box.querySelector('textarea').value;
  const u = _goUrl(text);
  if (u) { _fromUrl(box, u, msg, btn); return; }   // 글 대신 게임원 주소(링크)를 붙여넣었으면 가져온다
  const t = window.SLGameOne && window.SLGameOne.parseGameOneTeam(text);
  if (t && t.bat.length + t.pit.length) { _saveTeam(box, t, msg); return; }
  const r = window.SLGameOne && window.SLGameOne.parseGameOneCareer(text);
  const n = o => (o ? Object.keys(o).length : 0);
  if (!r || n(r.bat) + n(r.pit) < 3) { msg.textContent = '게임원 선수 기록을 찾지 못했어요. 선수 페이지에서 이름부터 기록 끝까지(경기수 …), 팀 기록통계 페이지는 전체 선택해 복사해 주세요. 한 경기 박스스코어 표는 기록 탭의 「게임원 가져오기」에 넣어요.'; return; }
  _saveCareer(box, r, msg, false);
}

// 통산 한 사람 저장(붙여넣기 · 선수 주소로 가져오기 같이). auto = 주소로 가져옴(「불러옴」)
function _saveCareer(box, r, msg, auto) {
  const add = !box.dataset.name, name = add ? String(r.name || '').trim() : box.dataset.name;
  if (!name) { msg.textContent = '붙여넣은 글에서 선수 이름을 찾지 못했어요. 선수 이름 줄부터 복사해 주세요.'; return; }
  // 동명이인 「김철수 #7」 카드 = 게임원 이름 「김철수」 (번호는 팀 기록에서 나눈 것)
  if (!add && r.name && _nm(r.name) !== _nm(name).replace(/#\d+$/, '')) { msg.textContent = `${auto ? '이 주소는' : '붙여넣은 기록은'} 「${r.name}」 선수예요. ${name} 선수 페이지를 ${auto ? '넣어' : '복사해'} 주세요.`; return; }
  const all = _all(), old = all[name] || {};
  // 타자 · 투수를 따로 붙여넣어도 앞서 저장한 쪽은 남긴다(새로 붙인 쪽만 바꾼다)
  all[name] = { at: Date.now(), name: r.name || old.name || '', hand: r.hand || old.hand || '', bg: r.bg || old.bg || '', school: r.school || old.school || '', bat: r.bat || old.bat || null, pit: r.pit || old.pit || null, ss: old.ss };
  if (auto) all[name].auto = 1;
  try { _put(all); } catch (e) { msg.textContent = '저장 공간이 부족해 저장하지 못했어요.'; return; }
  // 새 선수는 타자 › 시즌에서 그 선수 칩을 골라 연다
  if (add && window.selectBatterSeason) { window.selectBatterSeason(name); _showChip(); }
  else _redraw(box);
}

export function goCareerClear(btn) {
  const box = btn.closest('#goCareer'), all = _all();
  delete all[box.dataset.name];
  try { _put(all); } catch (e) {}
  // SprayLab 기록 없는 선수는 지우면 칩도 없어진다 → 타자 화면을 다시 그린다
  if (box.dataset.pa === '0' && window.setBatterView) window.setBatterView('sel', '');
  else _redraw(box);
}

// 폰으로 보내기: 이 기록을 링크(?goc=)에 담아 QR로 — 폰 카메라로 열면 _fromLink 가 폰에 저장한다(기기마다 따로 저장이라)
export function goCareerQR(btn) {
  const box = btn.closest('#goCareer'), wrap = box.querySelector('.go-cr-qr');
  if (!wrap.hidden) { wrap.hidden = true; btn.setAttribute('aria-expanded', 'false'); return; }
  const c = _all()[box.dataset.name];
  if (!c) return;
  wrap.innerHTML = '';
  if (typeof QRCode === 'undefined') {
    wrap.innerHTML = '<p class="go-cr-how">QR 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p>';
  } else {
    // 공유 링크(core.js ?game= · ?team=)와 같은 표기: 'z' + LZString, 없으면 'b' + base64
    const json = JSON.stringify(Object.assign({ k: box.dataset.name }, c));
    const enc = typeof LZString !== 'undefined' ? 'z' + LZString.compressToEncodedURIComponent(json) : 'b' + encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
    const url = location.origin + location.pathname + '?goc=' + enc;
    wrap.dataset.url = url;
    // 흰 바탕 검은 점 — 어두운 바탕 QR은 못 읽는 폰 카메라가 있다
    try { new QRCode(wrap, { text: url, width: 280, height: 280, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.L }); }
    catch (e) { wrap.innerHTML = '<p class="go-cr-how">QR을 만들지 못했어요.</p>'; }
    wrap.insertAdjacentHTML('beforeend', '<p class="go-cr-how">휴대폰 카메라로 찍어 링크를 열면 폰 SprayLab에 이 통산이 저장돼요. 폰에 같은 선수 통산이 있으면 이걸로 바뀌어요.</p>');
  }
  wrap.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
}

// 링크 · 팀 데이터로 받은 기록은 믿지 않는다: 이름 · 글자 길이를 자르고, 숫자(또는 null) 칸만 남긴다
function _nums(x) {
  if (!x || typeof x !== 'object') return null;
  const r = {};
  Object.keys(x).forEach(k => { const v = x[k]; if (/^[a-z0-9]{1,8}$/i.test(k) && (v === null || (typeof v === 'number' && isFinite(v)))) r[k] = v; });
  return Object.keys(r).length ? r : null;
}
function _clean(o) {
  if (!o || typeof o !== 'object') return null;
  const s = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const key = s(o.k || o.name, 40), bat = _nums(o.bat), pit = _nums(o.pit);
  if (!key || /^__/.test(key) || !(bat || pit)) return null;
  return { key, rec: { at: +o.at > 0 ? +o.at : Date.now(), name: s(o.name, 20), hand: s(o.hand, 8), bg: s(o.bg, 8), school: s(o.school, 30), bat, pit } };
}

// QR 링크(?goc=)로 열면 이 기기에 저장하고 분석 › 타자 › 시즌 전체에서 그 선수를 연다
export function goCareerFromLink() {
  let sp;
  try { sp = new URLSearchParams(location.search); } catch (e) { return; }
  const enc = sp.get('goc');
  if (!enc) return;
  sp.delete('goc');
  const q = sp.toString();
  try { history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  const toast = m => { if (window.showToast) window.showToast(m, false); };
  let c = null;
  try {
    const json = enc[0] === 'z' && typeof LZString !== 'undefined' ? LZString.decompressFromEncodedURIComponent(enc.slice(1))
      : enc[0] === 'b' ? decodeURIComponent(escape(atob(enc.slice(1)))) : '';
    c = _clean(JSON.parse(json));
  } catch (e) {}
  if (!c) { toast('게임원 통산 QR을 읽지 못했어요. PC에서 QR을 다시 띄워 찍어 주세요.'); return; }
  const all = _all();
  c.rec.ss = (all[c.key] || {}).ss;   // 폰에서 붙여넣은 팀 시즌 기록은 남긴다(QR 은 통산만 옮긴다)
  all[c.key] = c.rec;
  try { _put(all); } catch (e) { toast('저장 공간이 부족해 저장하지 못했어요.'); return; }
  const lp = document.getElementById('landing-page');
  if (lp && lp.offsetParent !== null && typeof window.showApp === 'function') window.showApp();   // 데스크톱 랜딩이 떠 있으면
  if (window.shellOpenAnalysis) window.shellOpenAnalysis('batter');
  if (window.setBatterView) { window.setBatterView('scope', 'season'); window.setBatterView('sel', c.key); _showChip(); }
  toast(`📱 ${c.key} 게임원 통산을 받았어요`);
}

// 팀 데이터(gameone_extract.mjs teamData) → sl_go_career. 이 기기에서 데이터보다 나중에 붙여넣은 기록은 남긴다
function _applyTeam(d) {
  const all = _all(), at = +d.at, by = {};
  const ss = { at, auto: 1, team: String(d.team || '').slice(0, 40), season: +d.season || null };
  Object.keys(d.players || {}).forEach(n => {
    const c = _clean(Object.assign({}, d.players[n], { k: n, name: n, at }));
    if (!c || +(all[c.key] || {}).at > at) return;
    all[c.key] = Object.assign(c.rec, { auto: 1, ss: (all[c.key] || {}).ss });
  });
  [['bat', d.bat], ['pit', d.pit]].forEach(([k, list]) => (Array.isArray(list) ? list : []).forEach(r => {
    const n = String((r && r.name) || '').trim().slice(0, 40), v = _nums(r);
    if (n && !/^__/.test(n) && v) (by[n] = by[n] || {})[k] = v;
  }));
  Object.keys(by).forEach(n => {
    const o = all[n] || (all[n] = {});
    if (o.ss && +o.ss.at > at) return;
    o.ss = Object.assign({}, ss, { bat: by[n].bat || null, pit: by[n].pit || null });
  });
  _put(all);
  return { car: Object.keys(d.players || {}).length, bat: Object.keys(by).filter(n => by[n].bat).length, pit: Object.keys(by).filter(n => by[n].pit).length, first: Object.keys(by)[0] };
}

// 게임원 주소 → { club, season } · { player } · null. 팀 번호만 넣어도 된다. 여러 줄 · 긴 글(복사한 페이지 속 주소)은 주소로 보지 않는다
function _goUrl(v) {
  v = String(v || '').trim();
  if (/\n/.test(v) || v.length > 400) return null;
  const p = /group_code=([0-9A-Z]{10,40})/.exec(v), c = /club_idx=(\d{1,7})/.exec(v) || /^(\d{1,7})$/.exec(v), s = /[?&]season=(\d{4})/.exec(v);
  return p ? { player: p[1] } : c ? { club: c[1], season: s ? s[1] : '' } : null;
}

// 중계(RELAY)에서 받는다. 못 받으면 { status } — 404 = 게임원에 그 기록이 없음
//   &t= — sw.js 가 GET 을 캐시해 지난번 응답을 먼저 주지 않게
async function _relay(q) {
  try { const r = await fetch(`${RELAY}?${q}&t=${Date.now()}`); return r.ok ? await r.json() : { status: r.status }; } catch (e) { return { status: 0 }; }
}
const _NET = '게임원에서 가져오지 못했어요. 인터넷 연결을 확인하고 잠시 뒤 다시 눌러 주세요.';

// 팀을 지금 게임원에서 받아 넣는다(「가져오기」 · ?goteam= 링크). 돌려주는 값: { msg }(못 받음) · { car, bat, pit, first }
async function _pullTeam(club, season) {
  const d = await _relay(`club=${club}${season ? `&season=${season}` : ''}`);
  if (d.status === 404) return { msg: `게임원에서 팀 번호 ${club} 기록을 찾지 못했어요. 팀 페이지 주소를 확인해 주세요.` };
  if (d.status != null || d.v !== 1 || !(+d.at > 0)) return { msg: _NET };
  let r;
  try { r = _applyTeam(d); } catch (e) { return { msg: '저장 공간이 부족해 저장하지 못했어요.' }; }
  const team = String(d.team || '').slice(0, 40);
  try { localStorage.setItem(TEAM, JSON.stringify({ club, season: season || '', team, at: +d.at })); } catch (e) {}
  if (window.showToast) window.showToast(`${team || '게임원 팀'} — 통산 ${r.car}명 · 시즌 타자 ${r.bat}명 · 투수 ${r.pit}명 불러옴`, false);
  return r;
}

// 주소로 가져오기(주소 칸 「가져오기」 · 붙여넣기 칸에 주소). 팀이면 표 첫 선수(또는 보던 선수)를, 선수면 그 선수를 연다
async function _fromUrl(box, u, msg, btn) {
  btn.disabled = true;
  msg.textContent = u.club ? '게임원에서 팀 선수 전원을 가져오는 중… (10초쯤 걸려요)' : '게임원에서 가져오는 중…';
  if (u.player) {
    const d = await _relay(`player=${u.player}`), c = d.status == null && _clean(Object.assign({}, d, { k: d.name }));
    btn.disabled = false;
    if (c) _saveCareer(box, c.rec, msg, true);
    else msg.textContent = d.status === 404 || d.status == null ? '게임원에서 이 선수 기록을 찾지 못했어요. 선수 페이지 주소를 확인해 주세요.' : _NET;
    return;
  }
  const r = await _pullTeam(u.club, u.season);
  btn.disabled = false;
  if (r.msg) { msg.textContent = r.msg; return; }
  if (window.selectBatterSeason && (box.dataset.name || r.first)) { window.selectBatterSeason(box.dataset.name || r.first); _showChip(); }
  else _redraw(box);
}

// 주소 칸 「가져오기」: 팀 · 선수 페이지 주소 또는 팀 번호
export function goTeamConnect(btn) {
  const box = btn.closest('#goCareer'), msg = box.querySelector('.go-cr-sync-msg'), u = _goUrl(box.querySelector('.go-cr-club').value);
  if (!u) { msg.textContent = '게임원 팀 또는 선수 페이지 주소를 넣어 주세요. 주소에 club_idx= 또는 group_code= 가 있어야 해요.'; return; }
  return _fromUrl(box, u, msg, btn);
}

// 팀 연결 링크(?goteam=팀 번호): 열면 연결 · 받기까지 하고 분석 › 타자 › 시즌 전체를 연다(기기마다 한 번이면 된다)
export async function goTeamFromLink() {
  let sp;
  try { sp = new URLSearchParams(location.search); } catch (e) { return false; }
  const club = sp.get('goteam');
  if (club == null) return false;
  sp.delete('goteam');
  const q = sp.toString();
  try { history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  const lp = document.getElementById('landing-page');
  if (lp && lp.offsetParent !== null && typeof window.showApp === 'function') window.showApp();   // 데스크톱 랜딩이 떠 있으면
  if (window.shellOpenAnalysis) window.shellOpenAnalysis('batter');
  if (window.setBatterView) window.setBatterView('scope', 'season');
  const r = /^\d{1,7}$/.test(club) ? await _pullTeam(club, '') : { msg: '게임원 팀 링크의 팀 번호가 잘못됐어요. 아래에 팀 페이지 주소를 넣어 주세요.' };
  if (!r.msg && r.first && window.selectBatterSeason) { window.selectBatterSeason(r.first); _showChip(); return true; }
  // 못 받았으면 「＋」 카드를 열어 주소 칸에 이유를 보여 준다
  if (window.setBatterView) window.setBatterView('goadd');
  const msg = document.querySelector('#goCareer .go-cr-sync-msg');
  if (msg) msg.textContent = r.msg || '';
  return true;
}

if (typeof window !== 'undefined') {
  window.goCareerSave = goCareerSave;
  window.goCareerClear = goCareerClear;
  window.goCareerQR = goCareerQR;
  window.goCareerFromLink = goCareerFromLink;
  window.goTeamConnect = goTeamConnect;
  window.goTeamFromLink = goTeamFromLink;
  // 다른 시작 처리(DOMContentLoaded)가 끝난 뒤 — gameoneimport ?go= 와 같게
  const run = () => setTimeout(() => { goCareerFromLink(); goTeamFromLink(); }, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
}
