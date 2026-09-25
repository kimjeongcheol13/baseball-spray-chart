// 경기설정 탭 — 버튼이 부르는 함수(core.js / shell.js / cloud.js)는 그대로 두고,
//   현재 경기 요약 · 경기 전 체크 · 라인업 미리보기 · 구장 정보 · 저장 상태만 덧붙인다 (읽기 전용)
import { esc } from '../constants.js';

const $ = id => document.getElementById(id);
const DEF = { home: '내 팀', away: '원정팀' };

function _saves() {
  try { return JSON.parse(localStorage.getItem('sl_saves') || '[]'); } catch (e) { return []; }
}

// sl_ 키가 차지하는 대략적인 크기 (문자 수 × 2바이트)
function _storageKB() {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('sl_') === 0) n += k.length + (localStorage.getItem(k) || '').length;
    }
  } catch (e) {}
  return (n * 2) / 1024;
}

function _kb(v) { return v >= 1024 ? (v / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(v)) + ' KB'; }

function _names() {
  return {
    th: (($('tHome') || {}).value || '').trim() || DEF.home,
    ta: (($('tAway') || {}).value || '').trim() || DEF.away,
  };
}

function _luLine(label, lu) {
  const list = Array.isArray(lu) ? lu : [];
  const starters = list.filter(p => p && p.isStarter !== false);
  const bench = list.length - starters.length;
  const shown = starters.slice(0, 9).map((p, i, a) => '<span class="st-p">' + (p.num ? '<b>' + esc(String(p.num)) + '</b> ' : '') + esc(p.name || '') + (i < a.length - 1 ? '<span class="st-sep">, </span>' : '') + '</span>').join('');
  const more = starters.length > 9 ? '<span class="st-p st-more"><span class="st-sep"> </span>외 ' + (starters.length - 9) + '명</span>' : '';
  const body = list.length ? shown + more : '<span class="st-p st-none">아직 선수가 없어요</span>';
  const sub = list.length ? list.length + '명' + (bench > 0 ? ' · 교체 ' + bench : '') : '0명';
  return '<div class="set-hint st-lu-row"><b>' + label + ' <small>' + sub + '</small></b> <span>' + body + '</span></div>';
}

function _checks(AS, gfOn, th, ta) {
  const hn = (AS.home_lineup || []).length, an = (AS.away_lineup || []).length;
  const named = th !== DEF.home && ta !== DEF.away;
  return [
    { s: named ? 'ok' : 'warn', l: '팀 이름', d: named ? th + ' vs ' + ta : '기본 이름 그대로예요', act: 'name' },
    { s: hn >= 9 ? 'ok' : hn > 0 ? 'warn' : 'todo', l: '홈 라인업', d: hn >= 9 ? hn + '명 등록' : hn > 0 ? hn + '명 · 9명 이상 권장' : '선수를 추가하세요', act: 'drawer' },
    { s: an >= 9 ? 'ok' : an > 0 ? 'warn' : 'opt', l: '원정 라인업', o: true, d: an >= 9 ? an + '명 등록' : an > 0 ? an + '명 · 9명 이상 권장' : '상대 타자도 기록할 때만', act: 'drawer' },
    { s: gfOn ? 'ok' : 'opt', l: '경기 운영', o: true, d: gfOn ? '켜짐 · 타순·아웃 자동 진행' : '꺼짐 · 누르면 시작', act: 'gf' },
  ];
}

const ICON = { ok: '✓', warn: '!', todo: '○', opt: '○' };

function render() {
  const view = $('settingsView');
  const AS = window.AS;
  if (!view || !AS || !$('stMatch')) return;
  const gfOn = typeof GF !== 'undefined' && GF.active;
  const { th, ta } = _names();
  const abs = (AS.abs || []).length;
  const st = (window.STADIUMS || {})[AS.stadium] || null;

  // ── 현재 경기 ──
  const hero = $('stHero');
  if (hero) hero.classList.toggle('is-live', !!gfOn);
  $('stState').textContent = gfOn ? 'LIVE · 경기 운영 중' : abs ? '기록 중' : '경기 준비';
  $('stMatch').innerHTML =
    '<span class="st-tm"><small>홈</small> <b>' + esc(th) + '</b></span> ' +
    '<span class="st-score"><b>' + (AS.hs || 0) + '</b><i>:</i><b>' + (AS.as || 0) + '</b></span> ' +
    '<span class="st-tm st-tm-r"><small>원정</small> <b>' + esc(ta) + '</b></span>';
  const inn = gfOn && window.gfInnStr ? window.gfInnStr() : (($('innSel') || {}).value || '1회초');
  const outs = gfOn ? GF.outs : (AS.outs || 0);
  $('stMeta').innerHTML = [
    '<span>' + esc(inn) + '</span>',
    '<span>' + outs + '아웃</span>',
    '<span>' + abs + '타석 기록</span>',
    st ? '<span>' + st.emoji + ' ' + esc(st.name) + '</span>' : '',
  ].filter(Boolean).join('<i> · </i>');

  // ── 경기 전 체크 ──
  const cs = _checks(AS, gfOn, th, ta);
  const done = cs.filter(c => c.s === 'ok').length;
  const need = cs.filter(c => !c.o);
  $('stReadyN').textContent = done + '/' + cs.length;
  $('stReadyN').classList.toggle('ok', need.every(c => c.s === 'ok'));
  $('stReady').innerHTML = cs.map(c =>
    '<button type="button" class="set-btn st-chk is-' + c.s + '" data-act="' + c.act + '">' +
    '<i aria-hidden="true">' + ICON[c.s] + '</i><span><b>' + c.l + (c.o ? ' <small class="st-opt">선택</small>' : '') + '</b>' +
    ' <small>' + esc(c.d) + '</small></span></button>'
  ).join('');

  // ── 라인업 미리보기 ──
  $('stLineup').innerHTML = _luLine('홈', AS.home_lineup) + _luLine('원정', AS.away_lineup);

  // ── 구장 ──
  if (st) {
    $('stStInfo').innerHTML = '<span>좌 ' + st.lfDist + 'm</span><i> · </i><span>중 ' + st.cfDist + 'm</span><i> · </i><span>우 ' + st.rfDist + 'm</span>' +
      (st.dome ? '<i> · </i><span>돔</span>' : '') + '<small><span class="st-sep"> — </span>필드 펜스 모양이 구장에 맞춰 바뀌어요</small>';
  }

  // ── 저장 상태 ──
  const saves = _saves();
  const saved = typeof window._gameSaved === 'boolean' ? window._gameSaved : true;
  $('stSaveMeta').innerHTML = abs
    ? '<span class="st-pill ' + (saved ? 'ok' : 'warn') + '">' + (saved ? '저장됨' : '저장 안 됨') + '</span> 이번 경기 ' + abs + '타석 · 저장된 경기 ' + saves.length + '개'
    : '아직 기록이 없어요 · 저장된 경기 ' + saves.length + '개';
  const last = saves[saves.length - 1];
  $('stLoadSub').textContent = last && last.label ? '최근: ' + last.label : '저장한 경기 열기';

  // ── 데이터 ──
  const raw = (($('saveInd') || {}).textContent || '').trim();
  const sync = /[가-힣a-zA-Z]/.test(raw) ? raw : '';
  $('stDataMeta').textContent = '이 기기에 저장된 데이터 약 ' + _kb(_storageKB()) + (sync ? ' · ' + sync : '');
}

let _t = 0;
function _schedule(ms) {
  clearTimeout(_t);
  _t = setTimeout(() => {
    const v = $('settingsView');
    if (v && v.classList.contains('active')) render();
  }, ms == null ? 60 : ms);
}

function _act(e) {
  const b = e.target.closest('.st-chk');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'name') {
    const inp = $('setHome');
    if (inp) {
      inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
      inp.focus();
      if (inp.select) inp.select();
    }
  } else if (a === 'drawer') {
    if (window.shellDrawer) window.shellDrawer(true);
  } else if (a === 'gf') {
    if (window.shellGfToggle) window.shellGfToggle();
  }
  _schedule();
}

function _init() {
  const view = $('settingsView');
  if (!view) return;
  $('stReady').addEventListener('click', _act);
  // 탭이 열릴 때 · 경기설정 안팎에서 무언가를 누른 뒤(시트 닫힘 등) · 팀명 입력 때 다시 그림
  if (window.MutationObserver) {
    new MutationObserver(() => _schedule(0)).observe(view, { attributes: true, attributeFilter: ['class'] });
  }
  document.addEventListener('click', () => _schedule(), true);
  ['setHome', 'setAway'].forEach(id => { const el = $(id); if (el) el.addEventListener('input', () => _schedule(150)); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) _schedule(0); });
  _schedule(0);
}

if (typeof window !== 'undefined') {
  window.renderSettingsPanel = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(_init, 0));
  else setTimeout(_init, 0);
}
