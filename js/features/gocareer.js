// 게임원 통산 카드 — 분석 탭 › 타자 › 시즌 맨 아래 (profile.js profileSeasonHtml 이 부른다)
// 게임원 선수 페이지(이름 · 투타 · 타자기록 · 투수기록)를 붙여넣으면 이 기기에 그 선수 이름으로 저장해 SprayLab 기록 아래에 보여 준다.
//   · 읽기 = js/gameone.js parseGameOneCareer — 게임원 숫자를 그대로 옮긴다(방어율 · 탈삼진율은 게임원의 7이닝 기준)
//   · 저장 = sl_go_career { p: { [SprayLab 선수 이름]: { at, name, hand, bg, school, bat, pit } } }
//     경기 키를 훑는 코드(d.abs 배열 확인)에 걸리지 않게 p 한 겹으로 감싼다
//   · 붙여넣은 이름이 이 선수와 다르면 저장하지 않는다(이름 줄이 없으면 확인 없이 저장)
//   · 타자 · 투수 중 한쪽만 붙여넣으면 그쪽만 바꾸고 다른 쪽은 남긴다

const KEY = 'sl_go_career';
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

// 통산을 붙여넣은 선수 이름 — 타자 › 시즌 칩에 SprayLab 기록 없는 선수도 띄운다
export function goCareerNames() {
  const a = _all();
  return Object.keys(a).filter(n => a[n] && (a[n].bat || a[n].pit));
}

// name = SprayLab 선수 이름('' = 새 선수 추가: 이름은 붙여넣은 글에서) · games · pa = SprayLab 기록(비교 안내용)
export function goCareerCard(name, games, pa) {
  const c = _all()[name];
  const has = !!(name && c && (c.bat || c.pit));
  const add = !name;
  const d = has && c.at ? new Date(c.at) : null;
  const meta = has ? [c.hand, c.bg, c.school].filter(Boolean).map(_esc).join(' · ') : '';
  return `
    <section class="an-card go-cr" id="goCareer" data-name="${_esc(name)}" data-g="${+games || 0}" data-pa="${+pa || 0}">
      <header class="an-hd"><h3>게임원 통산</h3><span class="an-hd-note">${d ? `${d.getMonth() + 1}월 ${d.getDate()}일 붙여넣음` : '게임원 선수 페이지 기록'}</span></header>
      ${has ? `
        ${meta ? `<p class="go-cr-meta">${meta}</p>` : ''}
        ${c.bat ? _bat(c.bat) : ''}
        ${c.pit ? _pit(c.pit) : ''}
        <div class="an-note">게임원 숫자를 그대로 옮겼어요(방어율은 게임원과 같은 7이닝 기준). ${+pa ? `위 SprayLab 기록은 여기서 기록한 ${+games || 0}경기 ${+pa}타석만이라 숫자가 달라요.` : 'SprayLab에는 아직 이 선수 타석 기록이 없어요.'}</div>`
      : `<div class="an-note">${add ? 'SprayLab에 타석 기록이 없는 선수도 게임원 선수 페이지를 붙여넣으면 통산을 볼 수 있어요. 이름은 붙여넣은 글에서 읽어요.' : '게임원에 이 선수 개인 기록이 있으면 붙여넣어 리그 통산을 같이 볼 수 있어요.'}</div>`}
      <details class="go-cr-paste"${add ? ' open' : ''}>
        <summary>${has ? '게임원 기록 다시 붙여넣기' : '게임원 기록 붙여넣기'}</summary>
        <p class="go-cr-how">크롬 · 사파리로 게임원 선수 페이지를 열고, 이름부터 투수기록 끝까지 길게 눌러 복사한 뒤 아래에 붙여넣으세요. 게임원 <b>앱</b>은 글자 복사가 안 돼요.</p>
        <textarea class="go-cr-ta" rows="5" aria-label="게임원 선수 페이지 붙여넣기" placeholder="${_esc(name || '선수 이름')}&#10;우투우타&#10;타자기록&#10;경기수 …"></textarea>
        <div class="go-cr-acts">
          <button type="button" class="go-cr-save" onclick="goCareerSave(this)">저장</button>
          ${has ? '<button type="button" class="go-cr-del" onclick="goCareerClear(this)">지우기</button>' : ''}
        </div>
        <p class="go-cr-msg" role="status"></p>
      </details>
    </section>`;
}

function _redraw(box) { box.outerHTML = goCareerCard(box.dataset.name, box.dataset.g, box.dataset.pa); }

export function goCareerSave(btn) {
  const box = btn.closest('#goCareer'), msg = box.querySelector('.go-cr-msg');
  const r = window.SLGameOne && window.SLGameOne.parseGameOneCareer(box.querySelector('textarea').value);
  const n = o => (o ? Object.keys(o).length : 0);
  if (!r || n(r.bat) + n(r.pit) < 3) { msg.textContent = '게임원 선수 기록을 찾지 못했어요. 선수 페이지에서 이름부터 기록 끝까지(경기수 …) 복사해 주세요. 한 경기 박스스코어 표는 기록 탭의 「게임원 가져오기」에 넣어요.'; return; }
  const add = !box.dataset.name, name = add ? String(r.name || '').trim() : box.dataset.name;
  if (!name) { msg.textContent = '붙여넣은 글에서 선수 이름을 찾지 못했어요. 선수 이름 줄부터 복사해 주세요.'; return; }
  if (!add && r.name && _nm(r.name) !== _nm(name)) { msg.textContent = `붙여넣은 기록은 「${r.name}」 선수예요. ${name} 선수 페이지를 복사해 주세요.`; return; }
  const all = _all(), old = all[name] || {};
  // 타자 · 투수를 따로 붙여넣어도 앞서 저장한 쪽은 남긴다(새로 붙인 쪽만 바꾼다)
  all[name] = { at: Date.now(), name: r.name || old.name || '', hand: r.hand || old.hand || '', bg: r.bg || old.bg || '', school: r.school || old.school || '', bat: r.bat || old.bat || null, pit: r.pit || old.pit || null };
  try { _put(all); } catch (e) { msg.textContent = '저장 공간이 부족해 저장하지 못했어요.'; return; }
  // 새 선수는 타자 › 시즌에서 그 선수 칩을 골라 연다(칩 줄 끝에 생기므로 보이게 옆으로 넘긴다)
  if (add && window.selectBatterSeason) {
    window.selectBatterSeason(name);
    const on = document.querySelector('#batterView .an-chip.on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else _redraw(box);
}

export function goCareerClear(btn) {
  const box = btn.closest('#goCareer'), all = _all();
  delete all[box.dataset.name];
  try { _put(all); } catch (e) {}
  // SprayLab 기록 없는 선수는 지우면 칩도 없어진다 → 타자 화면을 다시 그린다
  if (box.dataset.pa === '0' && window.setBatterView) window.setBatterView('sel', '');
  else _redraw(box);
}

if (typeof window !== 'undefined') {
  window.goCareerSave = goCareerSave;
  window.goCareerClear = goCareerClear;
}
