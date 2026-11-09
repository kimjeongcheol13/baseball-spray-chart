// 종이 기록지 옮기기 (데이터 관리 › 가져오기 › 종이 기록지 옮기기, 2026-11-09)
// 게임원에 없는 팀(리틀 · 고교 · 대학)이 종이 기록지를 보면서 타순 줄 · 이닝 칸에 옮겨 적어 새 경기로 저장한다.
// 여기에는 입력 화면만 있다. 표를 게임원 타자 표와 같은 탭 구분 글로 바꿔 가져오기 창의 숨은 칸(#goAway · #goHome · #goScore)에 넣으면
// 기존 파서(js/gameone.js) → 미리보기 → 저장(gameoneimport.js)이 그대로 돈다. 창은 게임원 가져오기 창의 '기록지 모드'(openGameOneImport('sheet')).
// 파서가 읽는 형식 (parseGameOne 에 넣어 확인):
//   한 줄 = 타순 ⇥ 수비위치 ⇥ 이름(등번호) ⇥ 1회 ⇥ … ⇥ N회 ⇥ 타수 ⇥ 안타 ⇥ 타점 ⇥ 득점 ⇥ 도루 ⇥ 타율 ⇥ 시즌타율   (⇥ = 탭)
//   · 이름 뒤 (번호) 괄호가 있어야 선수 줄 — 번호는 비워도 된다('홍길동()') · 머리글 줄은 필요 없다
//   · 빈 이닝 칸 = 그 이닝 타석 없음 · 한 이닝 두 타석은 '/' · 교체 선수 = 같은 타순 번호로 한 줄 더
//   · 끝의 숫자 칸은 7개까지 성적 칸으로 읽는다 → 7칸을 늘 채워('-' = 없음) 이닝 칸에 잘못 적은 숫자가 성적으로 읽히지 않게 한다
// 점수 = 표 아래 「득점」 줄(이닝별) → 이닝별 점수표 글('Team 1 2 … R' + 팀 줄 2개, parseGameOneScoreboard)
// 타점 = 줄 끝 「타점」 칸(선수별 합계) → 가져오기가 그 선수의 안타 · 희비 타석 등에 나눠 넣는다(_spreadRbi)
// 사용 기록(GA4): 열기 scoresheet_entry_open · 저장 scoresheet_entry_save — gameoneimport.js 가 기록지 모드일 때 보낸다(숫자만)

const $ = id => document.getElementById(id);
const DRAFT = 'sl_sheet_draft';   // 적던 표 — 새로 고치거나 창을 닫아도 남는다. 저장하면 지운다
// 값 = 게임원 수비위치 표기(gameoneimport.js POS 가 앱 포지션으로 바꾼다)
const POS = [['', '위치'], ['투', '투'], ['포', '포'], ['1', '1루'], ['2', '2루'], ['3', '3루'], ['유', '유'], ['좌', '좌'], ['중', '중'], ['우', '우'], ['지', 'DH']];
const MAX_INN = 15;
const _esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const _cell = v => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s === '-' ? '' : s; };
const _int = v => (/^\d+$/.test(_cell(v)) ? +_cell(v) : null);
const _row = o => ({ o: String(o), pos: '', name: '', cells: [], rbi: '' });
const _blank = () => ({ n: 7, away: { rows: Array.from({ length: 9 }, (_, i) => _row(i + 1)), runs: [] }, home: { rows: Array.from({ length: 9 }, (_, i) => _row(i + 1)), runs: [] } });
let _n = 7, _tab = 'away', _clearing = false;

// 한 팀 표 → 타자 표 글. 이름도 칸도 빈 줄은 뺀다. 이름 없이 칸만 적은 줄은 'N번'으로 넣는다(조용히 빠지지 않게).
// 타순 순서로(같으면 적은 순서) 내보내 교체 선수가 선발 바로 아래에 온다. runs = 그 팀 득점 합계(득점 줄을 적었을 때만) —
// ponytail: 선수별 득점 칸이 없어 합계를 첫 줄 득점 칸에 싣는다(가져오기는 득점을 팀 합계로만 쓴다 — 점수표 R 과 달라 뜨는 경고를 막는다). 선수별 득점을 받게 되면 줄마다 넣는다
export function sheetToText(side, n, runs) {
  return side.rows.map((r, i) => ({ r, i, o: _int(r.o) || i + 1 }))
    .filter(x => _cell(x.r.name) || x.r.cells.some(_cell))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map(({ r, o }, k) => {
      const nm = _cell(r.name) || o + '번', rbi = _int(r.rbi);
      return [o, r.pos || '', /\(\d*\)$/.test(nm) ? nm : nm + '()', ...Array.from({ length: n }, (_, j) => _cell(r.cells[j])),
        '-', '-', rbi == null ? '-' : rbi, k === 0 && runs != null ? runs : '-', '-', '-', '-'].join('\t');
    }).join('\n');
}

// 득점 줄 → 이닝별 점수표 글. 두 팀 다 비어 있으면 '' (점수표 없이 저장 = 0 : 0)
export function sheetScoreText(d) {
  const runs = t => Array.from({ length: d.n }, (_, j) => { const v = _int(d[t].runs[j]); return v == null ? '' : v; });
  const a = runs('away'), h = runs('home'), sum = r => r.reduce((s, v) => s + (v || 0), 0);
  if (!a.concat(h).some(v => v !== '')) return '';
  return [['Team', ...a.map((_, j) => j + 1), 'R'], ['원정팀', ...a, sum(a)], ['홈팀', ...h, sum(h)]].map(l => l.join('\t')).join('\n');
}

// ── 화면 ── 표(DOM)가 곧 상태다: _read 로 읽고 _render 로 다시 그린다
function _tableHtml(t, side) {
  const inn = Array.from({ length: _n }, (_, j) => j);
  const inp = (cls, label, v, more) => `<input class="${cls}" aria-label="${label}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${_esc(v)}" ${more || ''}>`;
  const num = 'inputmode="numeric" maxlength="2"';
  const body = side.rows.map(r => '<tr>'
    + `<td>${inp('go-sh-o', '타순', r.o, num)}</td>`
    + `<td><select class="go-sh-p" aria-label="수비 위치">${POS.map(([v, l]) => `<option value="${v}"${v === r.pos ? ' selected' : ''}>${l}</option>`).join('')}</select></td>`
    + `<td>${inp('go-sh-n', '타자명', r.name, 'maxlength="12" placeholder="이름"')}</td>`
    + inn.map(j => `<td>${inp('go-sh-c', (j + 1) + '회', r.cells[j], 'maxlength="24"')}</td>`).join('')
    + `<td>${inp('go-sh-r', '타점', r.rbi, num)}</td></tr>`).join('');
  return `<table class="go-sh" data-team="${t}"${t === _tab ? '' : ' hidden'}>`
    + `<thead><tr><th scope="col">타순</th><th scope="col">위치</th><th scope="col">타자명</th>${inn.map(j => `<th scope="col">${j + 1}</th>`).join('')}<th scope="col">타점</th></tr></thead>`
    + `<tbody>${body}</tbody>`
    + `<tfoot><tr><th scope="row">득점</th><td colspan="2"></td>${inn.map(j => `<td>${inp('go-sh-s', (j + 1) + '회 득점', side.runs[j], num)}</td>`).join('')}<td></td></tr></tfoot></table>`;
}
function _render(d) {
  _n = Math.max(1, Math.min(MAX_INN, +d.n || 7));
  $('goSheetGrid').innerHTML = _tableHtml('away', d.away) + _tableHtml('home', d.home);
  scoresheetTab(_tab);
}
function _read() {
  const d = { n: _n }, val = (tr, c) => tr.querySelector(c).value;
  ['away', 'home'].forEach(t => {
    const tb = document.querySelector(`#goSheetGrid table[data-team="${t}"]`);
    d[t] = {
      rows: [...tb.tBodies[0].rows].map(tr => ({ o: val(tr, '.go-sh-o'), pos: val(tr, '.go-sh-p'), name: val(tr, '.go-sh-n'), cells: [...tr.querySelectorAll('.go-sh-c')].map(i => i.value), rbi: val(tr, '.go-sh-r') })),
      runs: [...tb.querySelectorAll('.go-sh-s')].map(i => i.value),
    };
  });
  return d;
}

// 표 → 가져오기 창의 숨은 칸 → 기존 미리보기. 칸을 고칠 때마다 돌아서 「새 경기로 저장」은 늘 지금 표를 저장한다
function _sync() {
  const d = _read(), ov = $('goOverlay');
  // 게임원 모드로 연 창의 붙여넣기 칸은 건드리지 않는다 — 표 칸에 커서를 둔 채 창을 닫으면, 다음에 게임원 모드로 열 때 그 칸에서 change 가 늦게 온다
  if (!ov || !ov.classList.contains('go-sheet-on')) return d;
  const score = sheetScoreText(d), set = (id, v) => { const el = $(id); if (el) el.value = v; };
  const total = t => (score ? d[t].runs.reduce((s, v) => s + (_int(v) || 0), 0) : null);
  const away = sheetToText(d.away, d.n, total('away')), home = sheetToText(d.home, d.n, total('home'));
  set('goAway', away); set('goHome', home); set('goScore', score); set('goPitch', '');
  const msg = $('goSheetMsg');
  if (msg) msg.textContent = (away || home) && !score ? '「득점」 줄이 비어 있어요 — 이대로 저장하면 점수가 0 : 0 으로 들어갑니다' : '';
  if (window.gameOnePreview) window.gameOnePreview();
  return d;
}
function _changed() {
  if (_clearing) return;
  const d = _sync();
  try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) {}
}

export function scoresheetTab(t) {
  _tab = t === 'home' ? 'home' : 'away';
  document.querySelectorAll('#goSheetGrid table').forEach(tb => { tb.hidden = tb.dataset.team !== _tab; });
  document.querySelectorAll('#goSheet [data-sheet-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.sheetTab === _tab)));
}

// + 줄 추가(보고 있는 팀 · 다음 타순 번호로 — 교체 선수면 번호를 선발과 같게 고친다) · + 이닝 추가(두 팀 같이)
export function scoresheetAdd(what) {
  const d = _read();
  if (what === 'inn') d.n = Math.min(MAX_INN, d.n + 1);
  else d[_tab].rows.push(_row(Math.max(0, ...d[_tab].rows.map(r => _int(r.o) || 0)) + 1));
  _render(d);
  _changed();
}

export function scoresheetPreview() {
  _changed();
  const p = $('goPrev');
  if (p && p.scrollIntoView) p.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function openScoresheetEntry() {
  const grid = $('goSheetGrid');
  if (!grid || typeof window.openGameOneImport !== 'function') return;
  if (!grid.firstChild) {   // 처음 열 때 · 저장한 뒤: 적던 표가 있으면 이어서, 없거나 깨졌으면 빈 표
    try { const d = JSON.parse(localStorage.getItem(DRAFT)); if (d.away.rows.length && d.home.rows.length) _render(d); } catch (e) { grid.innerHTML = ''; }
    if (!grid.firstChild) _render(_blank());
  }
  window.openGameOneImport('sheet');
  _sync();   // 창을 열 때 모드가 바뀌면 숨은 칸이 비워진다 → 표에서 다시 채운다
}

// 저장이 끝나면 gameoneimport.js 가 부른다 — 적던 표를 지우고 다음에 빈 표로 연다
export function clearScoresheetEntry() {
  const grid = $('goSheetGrid'), msg = $('goSheetMsg');
  // 커서가 있던 칸이 사라지면서 change 가 한 번 더 온다(크롬) — 그걸로 보관본 · 숨은 칸을 다시 채우지 않게 막아 두고 비운다
  _clearing = true;
  try { if (grid) grid.innerHTML = ''; } finally { _clearing = false; }
  try { localStorage.removeItem(DRAFT); } catch (e) {}
  if (msg) msg.textContent = '';
  _tab = 'away';
}

if (typeof window !== 'undefined') {
  window.SLSheetEntry = { sheetToText, sheetScoreText };
  window.openScoresheetEntry = openScoresheetEntry;
  window.clearScoresheetEntry = clearScoresheetEntry;
  window.scoresheetTab = scoresheetTab;
  window.scoresheetAdd = scoresheetAdd;
  window.scoresheetPreview = scoresheetPreview;
  const grid = $('goSheetGrid');
  if (grid) { grid.addEventListener('input', _changed); grid.addEventListener('change', _changed); }
}
