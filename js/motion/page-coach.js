// 동작 분석 화면 — 「훈련 방향 받기」(AI 훈련 코치 · 베타): 버튼 · 동의 창 · 결과 카드 · 과정 보기 · 그림 저장 · 검증 모드
//  · 계산은 coach.js(4단계), AI 는 coach-llm.js(기기 안 web-llm), 스냅숏은 page-export.js currentExport 를 그대로 쓴다
//  · 공개 범위: 일반 모드는 지도자가 승인(coach_approved)한 카드가 있을 때만 버튼을 보인다. 주소에 ?mode=verify 면 초안까지 쓰고 「검증용 초안」을 붙인다
//  · 카드마다 「근거 자세히」, 결과 화면에 「이 앱이 참고한 연구」 — 글은 전부 assets/motion/evidence.json(evidence.js)
//  · 결과는 sl_motion_coach, 검증 기록은 sl_motion_verify(localStorage)에만 둔다. 기록 동기화(sl_motion_log)에 넣지 않아 서버로 가지 않는다
import { summarize } from './metrics.js?v=2';
import { runCoach, checkMeasurements, compareSession, candidatesFor, usableCards, evidenceText, unitText, noPrevReason, SEQUENCE_KEY } from './coach.js?v=3';
import { MODEL, gpuReady, modelCached, loadModel, ask } from './coach-llm.js?v=1';
import { currentExport } from './page-export.js?v=4';
import { loadEvidence, evidenceDetails, mountReferences } from './evidence.js?v=1';
import { loadLog } from './store.js?v=4';
import { state, el, node } from './page.js?v=4';

const RESULT_KEY = 'sl_motion_coach', VERIFY_KEY = 'sl_motion_verify', KEEP = 100;
const TYPE = { bat: 'batting', pitch: 'pitching' };
const VERDICTS = [['right', '맞음'], ['fix', '고칠 필요'], ['wrong', '틀림']];
const ANSWERS = [['pay', '낸다'], ['no', '안 낸다'], ['unsure', '모르겠다']];
const PASS = { n: 15, yes: 3 };
export const verifyMode = () => new URLSearchParams(location.search).get('mode') === 'verify';
const $ = (id) => document.getElementById(id);
let evidence = null; // 불러온 evidence.json (render · savePng · 검증 기록이 쓴다)
const withEvidence = async () => (evidence = await loadEvidence());
const box = $('coachBox'), btn = $('btnCoach'), msg = $('coachMsg'), bar = $('coachProgress'), out = $('coachResult'), dialog = $('coachConsent');

// ── 저장소 (읽기 실패 · 꽉 참은 조용히 넘긴다 — 결과 화면은 그대로 보인다)
const read = (key, empty) => { try { return JSON.parse(localStorage.getItem(key)) || empty; } catch (e) { return empty; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { console.warn('[motion] 코치 결과를 저장하지 못했어요', e); return false; } };
// 지금 분석을 가리키는 열쇠: 종류 · 숫자 · 초당 프레임이 같으면 같은 분석(저장 · 불러오기 뒤에도 그대로)
const sigOf = (r) => `${r.mode}|${Object.values(summarize(r)).join(',')}|${Math.round(r.fps)}`;
function keepResult(sig, saved) {
  const all = read(RESULT_KEY, {});
  all[sig] = saved;
  const keys = Object.keys(all).sort((a, b) => (all[a].at < all[b].at ? 1 : -1));
  for (const k of keys.slice(KEEP)) delete all[k];
  write(RESULT_KEY, all);
}

// ── 카드 파일(assets/motion/drills_*.json) — 판단 기준은 이 파일에 있다
const cardFiles = {};
function cardsFor(mode) {
  cardFiles[mode] ||= fetch(`assets/motion/drills_${TYPE[mode]}.json?v=2`).then((r) => r.json()).then((j) => j.cards || []).catch((e) => { console.warn('[motion] 훈련 카드를 읽지 못했어요', e); delete cardFiles[mode]; return []; });
  return cardFiles[mode];
}

// 결과 화면이 새로 그려질 때마다(숫자 칸이 바뀔 때) 버튼을 보일지 정하고, 이 분석의 지난 코치 결과가 있으면 다시 보여 준다
export async function refreshCoach() {
  const r = state.result;
  out.replaceChildren(); msg.textContent = ''; bar.hidden = true;
  if (!r) { box.hidden = true; return; }
  const cards = usableCards(await cardsFor(r.mode), verifyMode());
  await withEvidence();
  if (state.result !== r) return;
  box.hidden = !cards.length;
  btn.disabled = false;
  const saved = read(RESULT_KEY, {})[sigOf(r)];
  if (saved && !box.hidden) render(saved);
}

// 처음 쓸 때 묻는다 → 'ai' | 'rules' | null(닫음)
function askConsent() {
  $('coachConsentText').textContent = `AI 파일(약 ${MODEL.mb}MB)을 한 번 내려받습니다. 와이파이에서 받는 걸 권합니다. 영상과 숫자는 폰 밖으로 나가지 않습니다.`;
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue || null), { once: true });
    dialog.returnValue = '';
    dialog.showModal();
  });
}

// AI 를 쓸 수 있으면 llm 함수, 아니면 { llm: null, note }
async function prepareAi() {
  if (!(await gpuReady())) return { llm: null, note: '이 기기 · 브라우저는 AI 실행(WebGPU · 16비트 연산)을 지원하지 않아 AI 없이 받았어요.' };
  if (!(await modelCached())) {
    const pick = await askConsent();
    if (pick === null) return null;
    if (pick === 'rules') return { llm: null, note: '「AI 없이 받기」를 골라 규칙으로 받았어요.' };
  }
  bar.hidden = false; bar.value = 0;
  const engine = await loadModel((p) => { bar.value = p; msg.textContent = `AI 파일 준비 중 ${Math.round(p * 100)}% (처음 한 번만 받아요)`; });
  bar.hidden = true;
  return engine ? { llm: ask, note: null } : { llm: null, note: 'AI 를 불러오지 못해(메모리 부족 등) AI 없이 받았어요.' };
}

// alias = 같은 선수로 볼 다른 저장 이름(결과 카드의 「「이름」 기록과 견주기」 버튼). 저장한 기록 이름은 바꾸지 않는다
export async function runCoachNow(alias = []) {
  const r = state.result;
  if (!r) return;
  btn.disabled = true; msg.textContent = '숫자를 모으는 중…';
  try {
    const verify = verifyMode(), got = await currentExport(new Date(), alias), cards = usableCards(await cardsFor(r.mode), verify);
    const all = got.data.sessions, at = all.findIndex((s) => s.session_id === got.currentId);
    const sessions = (at < 0 ? all : all.slice(0, at + 1)).filter((s) => s.motion_type === TYPE[r.mode]);
    const snapshot = { player: { id: got.playerId }, sessions };
    // AI 가 필요한지 먼저 본다 — 다시 찍어야 하거나 맞는 카드가 없으면 모델을 받지 않는다
    const cur = sessions[sessions.length - 1], check = checkMeasurements(cur);
    const needAi = !check.stop && candidatesFor(compareSession(cur, sessions[sessions.length - 2] || null, check.usable), cards).length > 0;
    let ai = { llm: null, note: null };
    if (needAi) { ai = await prepareAi(); if (!ai) { msg.textContent = ''; btn.disabled = false; return; } }
    msg.textContent = ai.llm ? 'AI 가 훈련 카드를 고르는 중…(최대 90초)' : '훈련 카드를 고르는 중…';
    const res = await runCoach({ snapshot, cards, llm: ai.llm });
    if (ai.note) { const s3 = res.steps.find((s) => s.n === 3); if (s3) s3.lines.unshift(ai.note); }
    // 지난 기록이 없으면 왜 없는지(이름 칸 비었음 · 첫 기록을 열었음 · 이름이 다름)를 결과 카드와 2단계에 적는다
    const name = el.player.value.trim(), others = [...new Set(loadLog().filter((e) => e.mode === r.mode).map((e) => (e.name || '').trim()).filter((n) => n && n !== name))];
    const linked = alias.length ? `${alias.map((n) => `「${n}」`).join(', ')} 기록을 같은 선수로 보고 견줬어요(저장한 이름은 그대로예요).` : null;
    const note = sessions.length > 1 ? linked : noPrevReason({ name, motion: r.mode === 'bat' ? '타격' : '투구', others,
      later: at < 0 ? 0 : all.slice(at + 1).filter((s) => s.motion_type === TYPE[r.mode]).length });
    if (note) { const s2 = res.steps.find((s) => s.n === 2); if (s2) s2.lines.splice(1, 0, note); }
    const saved = { at: new Date().toISOString(), verify, snapshot, status: res.status, source: res.source, summary: res.summary, note, alias, others: sessions.length > 1 ? [] : others.slice(0, 5), steps: res.steps,
      picked: res.picked.map((p) => ({ card: p.card, reason: p.reason, numbers: p.numbers_used.map((k) => numberOf(cur, res.findings, k)) })) };
    keepResult(sigOf(r), saved);
    await withEvidence();
    msg.textContent = '';
    render(saved);
  } catch (e) {
    console.warn('[motion] 훈련 방향을 만들지 못했어요', e);
    msg.textContent = '훈련 방향을 만들지 못했어요. 다시 눌러 주세요.';
  }
  btn.disabled = false;
}

// 근거 숫자 한 줄에 쓸 값: 이번 값 · 단위 · 지난 값 (카드는 지난 기록과만 견줘서 고른다 — 참고 범위는 쓰지 않는다)
function numberOf(cur, findings, key) {
  if (key === SEQUENCE_KEY) { const f = findings.find((x) => x.key === key); return { key, label: '회전 순서', text: f ? f.value : '' }; }
  const m = cur.metrics.find((x) => x.key === key) || { label: key }, f = findings.find((x) => x.key === key && x.last !== undefined);
  return { key, label: m.label, text: `${m.value}${unitText(m.unit)}${m.uncertainty ? ` ± ${m.uncertainty}` : ''}${f ? ` · 지난 기록 ${f.last}` : ''}` };
}

// ── 결과 카드
function render(saved) {
  const card = node('article', 'mo-coach-card'), when = new Date(saved.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (saved.verify) card.append(node('p', 'mo-coach-draft', '검증용 초안 — 지도자 확인 전이에요'));
  card.append(node('p', 'mo-coach-summary', saved.summary));
  if (saved.note) card.append(node('p', 'mo-drill-note', saved.note));
  // 이름만 달라 못 견줬으면: 같은 선수인 저장 이름을 눌러 그 기록과 견준다(그 이름이 지금 이름보다 앞서 저장한 기록과만 견줘진다)
  if (saved.others && saved.others.length) {
    const pick = node('div', 'mo-actions');
    pick.append(...saved.others.map((n) => { const b = node('button', 'mo-btn', `「${n}」 기록과 견주기`); b.type = 'button'; b.addEventListener('click', () => runCoachNow([n])); return b; }));
    card.append(node('p', 'mo-hint', '같은 선수라면 아래 이름을 눌러 그 기록과 견줘요. 저장한 이름은 바뀌지 않아요.'), pick);
  }
  for (const p of saved.picked) {
    const sec = node('section', 'mo-drill'), ol = node('ol');
    ol.append(...p.card.how.map((t) => node('li', '', t)));
    sec.append(node('h4', '', p.card.title), node('p', 'mo-drill-why', p.reason), ol, node('p', 'mo-drill-note', `주의 · ${p.card.caution}`),
      node('p', 'mo-drill-note', `근거 · ${evidenceText(p.card)}`), evidenceDetails(p.card, evidence || { papers: [] }));
    if (saved.verify) sec.append(verdictRow(p.card.id));
    card.append(sec);
  }
  const nums = saved.picked.flatMap((p) => p.numbers).filter((n, i, a) => a.findIndex((x) => x.key === n.key) === i);
  if (nums.length) { const ul = node('ul', 'mo-coach-nums'); ul.append(...nums.map((n) => node('li', '', `${n.label} ${n.text}`))); card.append(node('h4', 'mo-coach-sub', '근거 숫자'), ul); }
  card.append(node('p', 'mo-coach-foot', '훈련은 지도자와 상의하세요.'),
    node('p', 'mo-hint', `${saved.source === 'ai' ? '기기 안 AI 가 카드 중에서 골랐어요' : saved.source === 'rules' ? 'AI 없이 규칙으로 골랐어요' : '훈련 카드를 고르기 전에 멈췄어요'} · ${when}`));
  const how = node('details', 'mo-guide mo-coach-steps'), sum = node('summary', '', '과정 보기');
  how.append(sum, ...saved.steps.map((s) => { const d = node('div', 'mo-coach-step'); const ul = node('ul'); ul.append(...s.lines.map((t) => node('li', '', t))); d.append(node('b', '', `${s.n}. ${s.title}`), ul); return d; }));
  const acts = node('div', 'mo-actions'), png = node('button', 'mo-btn', '그림으로 저장');
  png.type = 'button'; png.addEventListener('click', () => savePng(saved));
  acts.append(png);
  out.replaceChildren(card, how, acts);
  if (saved.verify) out.append(verifyPanel(saved));
}

// ── 검증 모드: 지도자 확인 · 선수 응답 · 검증 기록
const draft = { checks: {}, answer: null };
function verdictRow(cardId) {
  const row = node('div', 'mo-verdict'), memo = node('input', 'mo-input');
  memo.type = 'text'; memo.maxLength = 80; memo.placeholder = '한 줄 메모 (선택)'; memo.setAttribute('aria-label', '지도자 메모');
  memo.addEventListener('input', () => { (draft.checks[cardId] ||= {}).memo = memo.value.trim(); });
  row.append(node('span', 'mo-verdict-label', '지도자 확인'));
  for (const [v, label] of VERDICTS) {
    const b = node('button', 'mo-btn', label);
    b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { (draft.checks[cardId] ||= {}).verdict = v; for (const x of row.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b)); });
    row.append(b);
  }
  row.append(memo);
  return row;
}

export const tally = (records) => { const answered = records.filter((r) => r.answer); return { n: answered.length, yes: answered.filter((r) => r.answer === 'pay').length }; };
const tallyText = () => { const t = tally(read(VERIFY_KEY, [])); return `응답 ${t.n}명 중 '낸다' ${t.yes}명 (통과 기준: ${PASS.n}명 중 ${PASS.yes}명)`; };

function verifyPanel(saved) {
  draft.checks = {}; draft.answer = null;
  const panel = node('div', 'mo-verify'), row = node('div', 'mo-verdict'), count = node('p', 'mo-hint', tallyText()), done = node('p', 'mo-status');
  panel.append(node('h4', 'mo-coach-sub', '선수 응답'), node('p', '', '이 결과를 받으려고 한 달 3만 원을 내시겠어요?'), row);
  for (const [v, label] of ANSWERS) {
    const b = node('button', 'mo-btn', label);
    b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { draft.answer = v; for (const x of row.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b)); });
    row.append(b);
  }
  const acts = node('div', 'mo-actions'), keep = node('button', 'mo-btn primary', '이 검증 기록 저장'), dl = node('button', 'mo-btn', '검증 기록 내보내기');
  keep.type = dl.type = 'button';
  keep.addEventListener('click', () => {
    const list = read(VERIFY_KEY, []), last = saved.snapshot.sessions[saved.snapshot.sessions.length - 1];
    list.push({ at: new Date().toISOString(), player_id: saved.snapshot.player.id, session_id: last.session_id, snapshot: saved.snapshot,
      evidence_version: evidence ? evidence.version : null,
      coach: { status: saved.status, source: saved.source, summary: saved.summary, picked: saved.picked.map((p) => ({ card_id: p.card.id, evidence_level: (p.card.evidence && p.card.evidence.level) || null, reason: p.reason, numbers: p.numbers.map((n) => n.key) })), steps: saved.steps },
      checks: saved.picked.map((p) => ({ card_id: p.card.id, verdict: (draft.checks[p.card.id] || {}).verdict || null, memo: (draft.checks[p.card.id] || {}).memo || '' })),
      answer: draft.answer });
    done.textContent = write(VERIFY_KEY, list) ? `저장했어요(이 기기 검증 기록 ${list.length}개).` : '저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.';
    count.textContent = tallyText();
    keep.disabled = true;
  });
  dl.addEventListener('click', exportVerify);
  acts.append(keep, dl);
  panel.append(acts, count, done);
  return panel;
}

function download(blob, name) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

// 검증 기록 전부(스냅숏 · 코치 결과 · 지도자 확인 · 선수 응답)를 파일 하나로. 선수 이름은 처음부터 없다(익명 ID 만)
function exportVerify() {
  const list = read(VERIFY_KEY, []), now = new Date();
  download(new Blob([JSON.stringify({ schema_version: '1.1', evidence_version: evidence ? evidence.version : null, exported_at: now.toISOString(), app: 'SprayLab Motion · AI 훈련 코치', pass_rule: PASS, tally: tally(list), records: list }, null, 2)], { type: 'application/json' }), `spraylab-verify_${ymd(now)}.json`);
}

// ── 결과 카드 그림(PNG) — 기기 안 캔버스로 만들고 바로 내려받는다(올리지 않는다)
function savePng(saved) {
  const W = 1080, P = 64, c = document.createElement('canvas'), g = c.getContext('2d'), F = (w, s) => `${w} ${s}px -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif`;
  const blocks = [];
  const add = (text, size, color, weight = 400, gap = 10) => blocks.push({ text, size, color, weight, gap });
  add('SPRAYLAB MOTION · 훈련 방향', 26, '#4b8cf5', 700, 18);
  if (saved.verify) add('검증용 초안 — 지도자 확인 전', 26, '#f59e0b', 700, 14);
  add(saved.summary, 38, '#F5F7FA', 700, 28);
  for (const p of saved.picked) {
    add(p.card.title, 34, '#F5F7FA', 700, 10);
    add(p.reason, 28, '#C3C9D4', 400, 12);
    p.card.how.forEach((t, i) => add(`${i + 1}. ${t}`, 26, '#C3C9D4', 400, 8));
    add(`주의 · ${p.card.caution}`, 24, '#8C94A3', 400, 8);
    const names = (p.card.evidence.refs || []).slice(0, 3).map((id) => ((evidence && evidence.papers) || []).find((x) => x.id === id)).filter(Boolean).map((x) => x.short.replace(/\s*\(.*\)\s*$/, ''));
    add(`근거 · ${evidenceText(p.card)}`, 24, '#8C94A3', 400, names.length ? 8 : 26);
    if (names.length) add(`연구 · ${names.join(' · ')}`, 24, '#8C94A3', 400, 26);
  }
  const nums = saved.picked.flatMap((p) => p.numbers).filter((n, i, a) => a.findIndex((x) => x.key === n.key) === i);
  if (nums.length) add(`근거 숫자 · ${nums.map((n) => `${n.label} ${n.text}`).join(' / ')}`, 24, '#8C94A3', 400, 20);
  add('훈련은 지도자와 상의하세요. 카메라 한 대 영상으로 추정한 값이에요.', 24, '#F5F7FA', 600, 0);
  const wrap = (b) => {
    g.font = F(b.weight, b.size);
    const lines = []; let line = '';
    for (const ch of b.text) { if (g.measureText(line + ch).width > W - P * 2 && line) { lines.push(line); line = ch.trimStart(); } else line += ch; }
    if (line) lines.push(line);
    return lines;
  };
  const laid = blocks.map((b) => ({ ...b, lines: wrap(b) }));
  c.width = W; c.height = P * 2 + laid.reduce((h, b) => h + b.lines.length * b.size * 1.45 + b.gap, 0);
  g.fillStyle = '#0B0D12'; g.fillRect(0, 0, W, c.height);
  let y = P;
  for (const b of laid) {
    g.font = F(b.weight, b.size); g.fillStyle = b.color; g.textBaseline = 'top';
    for (const l of b.lines) { g.fillText(l, P, y); y += b.size * 1.45; }
    y += b.gap;
  }
  c.toBlob((blob) => { if (blob) download(blob, `spraylab-coach_${ymd(new Date())}.png`); }, 'image/png');
}

export function startCoach() {
  btn.addEventListener('click', () => runCoachNow());
  if (verifyMode()) document.body.dataset.verify = '1';
  // 결과 화면(숫자 칸)이 새로 그려질 때마다 버튼 · 지난 결과 · 「이 앱이 참고한 연구」를 맞춘다 — page-results.js 를 고치지 않고 따라간다
  new MutationObserver(() => { refreshCoach(); mountReferences($('refNote'), state.result && state.result.mode); }).observe($('tiles'), { childList: true });
}
