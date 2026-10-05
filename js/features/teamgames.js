// 팀장용 "팀 경기" — 팀원이 올린 경기 목록 + 읽기 전용 보기.
// 데이터는 cloud.js(_slLoadTeamGames · 실시간 INSERT → _slTeamGameInsert)가 넘겨준다. 여기서는 메모리에서 그리기만 한다:
// localStorage · 서버에 아무것도 쓰지 않고, 경기 보기도 AS · 저장 경로(loadSharedGame 등 updateAll 을 부르는 길)를 거치지 않는다.
import { MAX_HITS, esc } from '../constants.js';
import { calcStats, f3 } from './batdata.js?v=5';

let _team = null, _rows = [], _fresh = [];   // _fresh = 실시간으로 들어온 새 경기(최신이 앞). 창을 닫으면 비운다
let _state = 'idle';                         // idle | loading | ok | err
let _view = null, _shown = [], _on = false;  // 보고 있는 행(null 이면 목록) · 마지막으로 그린 목록 · 창이 열려 있는지

const t = v => esc(v == null ? '' : v);   // 화면에 들어가는 값은 전부 이 함수를 거친다(팀원 · 팀 · 상대 · 타자 이름 …)
const _key = r => r.user_id + '|' + r.game_key;
// 팀원 이름 = 가입할 때 정한 "팀에서 쓸 이름"(team_members.display_name, sql/12 — cloud.js 가 행에 붙여 준다). 구글 계정 이름은 쓰지 않는다.
// 이름이 없으면(12 이전에 가입 · 이름 조회 실패) 임시로 계정 id 끝 4자리. 화면에 넣을 때는 t() 로 이스케이프된다
const _who = r => (r.display_name ? String(r.display_name) : '팀원 ' + String(r.user_id).slice(-4));
// 타석은 내 팀(home) 타자만 — 앱 전체가 th/home 을 내 팀으로 쓴다. 팀 구분이 없는 옛 타석은 home
const _mine = d => (Array.isArray(d && d.abs) ? d.abs : []).filter(a => a && (a.team || 'home') === 'home').slice(0, MAX_HITS);
const _avg = s => (s.ab ? f3(s.avg) : '-');

function _list() {
  const seen = new Set(), out = [];
  _fresh.map(r => ({ r, n: true })).concat(_rows.map(r => ({ r, n: false }))).forEach(x => {
    const k = _key(x.r);
    if (!seen.has(k)) { seen.add(k); out.push(x); }
  });
  return out.slice(0, 50);
}

function _listHtml() {
  if (_state === 'loading') return '<p class="tg-msg">불러오는 중…</p>';
  if (_state === 'err') return '<p class="tg-msg">목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요</p>';
  _shown = _list();
  if (!_shown.length) return '<p class="tg-msg">아직 팀원이 올린 경기가 없어요</p>';
  return '<ul class="tg-list">' + _shown.map((x, i) => {
    const d = x.r.data || {}, abs = _mine(d);
    return '<li><button type="button" class="tg-row" data-act="open" data-i="' + i + '">' +
      '<span class="tg-r1"><b>' + t(_who(x.r)) + '</b>' + (x.n ? '<span class="tg-new">NEW</span>' : '') + '<span class="tg-d">' + t(x.r.date || d.d) + '</span></span>' +
      '<span class="tg-r2"><span>vs ' + t(d.ta || '상대') + '</span><span>' + abs.length + '타석</span><span>AVG ' + _avg(calcStats(abs)) + '</span></span>' +
      '</button></li>';
  }).join('') + '</ul>';
}

function _detailHtml(r) {
  const d = r.data || {}, abs = _mine(d);
  return '<button type="button" class="tg-back" data-act="back">← 목록</button>' +
    '<div class="tg-title">' + t(d.th || '홈') + ' vs ' + t(d.ta || '원정') + '<small>' + t(Number(d.hs) || 0) + ' : ' + t(Number(d.as) || 0) + '</small></div>' +
    '<div class="tg-sub">' + t(_who(r)) + ' · ' + t(r.date || d.d) + ' · ' + abs.length + '타석 · AVG ' + _avg(calcStats(abs)) + '</div>' +
    '<div class="tg-ro">읽기 전용 · 이 기기에 저장되지 않아요</div>' +
    '<canvas class="tg-spray" role="img" aria-label="스프레이 차트"></canvas>' +
    '<table class="tg-tbl"><caption class="sb-sr">타석 기록</caption><thead><tr><th scope="col">타자</th><th scope="col">이닝</th><th scope="col">결과</th><th scope="col">타점</th></tr></thead><tbody>' +
    abs.map(a => '<tr><td>' + (a.bnum != null && a.bnum !== '' ? '#' + t(a.bnum) + ' ' : '') + t(a.bname) + '</td><td>' + t(a.inn) + '</td><td>' + t(a.res) + '</td><td>' + t(a.rbi || 0) + '</td></tr>').join('') +
    '</tbody></table>';
}

function _paint() {
  const box = _modal().firstChild;
  box.innerHTML = '<div class="tg-top"><div class="tg-h">팀 경기' + (_team ? ' · ' + t(_team.name) : '') + '</div>' +
    '<button type="button" class="tg-x" data-act="close" aria-label="닫기">✕</button></div>' + (_view ? _detailHtml(_view) : _listHtml());
  if (_view) {
    // 스프레이 = 기록 직후 미니 스프레이(abs 배열만 받아 캔버스에 그린다). 못 그려도 표는 보인다
    try { window._drawMiniSpray(box.querySelector('.tg-spray'), _mine(_view.data)); } catch (e) { console.warn('[TeamGames] spray:', e && e.message); }
  }
}

function _close() {
  _on = false; _view = null; _fresh = [];
  const m = document.getElementById('teamGamesModal');
  if (m) m.classList.remove('show');
}

function _modal() {
  let m = document.getElementById('teamGamesModal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'teamGamesModal';
  m.className = 'overlay';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.setAttribute('aria-label', '팀 경기');
  m.innerHTML = '<div class="modal tg-modal"></div>';
  m.addEventListener('click', e => {
    if (e.target === m) return _close();
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') _close();
    else if (a === 'back') { _view = null; _paint(); }
    else if (a === 'open') { const x = _shown[+b.dataset.i]; if (x) { _view = x.r; _paint(); } }
  });
  m.addEventListener('keydown', e => { if (e.key === 'Escape') _close(); });
  document.body.appendChild(m);
  return m;
}

window.openTeamGames = function () {
  if (typeof window._slLoadTeamGames !== 'function') return;
  const m = _modal();
  _on = true; _view = null; _state = 'loading';
  _paint();
  m.classList.add('show');
  const x = m.querySelector('.tg-x'); if (x) x.focus();
  window._slLoadTeamGames().then(res => {
    if (res.team) _fresh = _fresh.filter(r => r.team_id === res.team.id);   // 해산 뒤 새 팀을 만든 경우 옛 팀의 새 경기가 섞이지 않게
    _team = res.team; _rows = res.rows; _state = 'ok';
  }, e => { console.warn('[TeamGames] load:', e && e.message); _state = 'err'; })
    .then(() => { if (_on && !_view) _paint(); });
};

// cloud.js 의 실시간 INSERT(팀장만 구독)가 부른다. 창이 닫혀 있어도 모아 두었다가 열면 NEW 로 보인다
window._slTeamGameInsert = function (row) {
  if (_fresh.some(r => _key(r) === _key(row))) return;
  _fresh = [row].concat(_fresh).slice(0, 50);
  if (_on && !_view) _paint();
};

// 로그아웃: 남은 팀원 경기를 지우고 창을 닫는다
window._slTeamGamesReset = function () {
  _close(); _team = null; _rows = []; _state = 'idle';
};
