// 동작 분석 — AI 훈련 코치 엔진 (순수 함수 · 화면 · 저장소 · 모델을 모른다. AI 는 llm(messages) → 글자 로 넘겨받는다)
//  · 입력 = 스냅숏(export.js buildExport 와 같은 모양: { player, sessions }) — 마지막 session 이 지금 기록, 앞은 같은 선수 · 같은 동작의 지난 기록
//  · 4단계: 1) 측정 점검  2) 비교 분석 → 후보 카드  3) AI 가 후보 안에서 1~2장 고르기  4) 검사(틀리면 3단계로 최대 2번) → 실패 · 90초 초과면 규칙 결과
//  · 판단 기준(어떤 숫자면 어떤 훈련)은 코드가 아니라 assets/motion/drills_*.json 카드에 있다. 여기서는 카드의 when 을 읽기만 한다
//  · 단계마다 사람이 읽을 문장을 steps 에 남긴다(화면의 「과정 보기」)

export const COACH_RULES = {
  minFps: 50,          // 이보다 적으면 회전 속도 · 피크 간격은 쓰지 않는다 — framing.js FRAMING_RULES.minFps 와 같은 값(30fps 는 11~18% 낮게 나왔다)
  maxRelSpread: 0.25,  // 흔들림 폭(±)이 값의 이 비율을 넘으면 그 지표는 쓰지 않는다 (가정값 — 현장 검증 때 조정)
  minUsable: 3,        // 쓸 수 있는 지표가 이보다 적으면 멈추고 다시 찍기 안내
  minChange: 0.05,     // 지난 기록과 이 비율(5%)은 달라야 변화로 본다 — insight.js CHANGE_MIN_PCT 와 같다. 흔들림 폭 합보다도 커야 한다
  maxPick: 2, maxRetries: 2, timeoutMs: 90000, reasonMax: 60, summaryMax: 80,
};
const RATE_KEYS = ['pelvis_peak_velocity', 'trunk_peak_velocity', 'pelvis_to_trunk_peak_gap'];
export const SEQUENCE_KEY = 'rotation_sequence';
export const RETAKE = '폰을 고정하고, 선수 전신이 처음부터 끝까지 보이게, 초당 60프레임 이상(또는 슬로모션)으로 다시 찍어 주세요.';
const PHASE_TEXT = { foot_strike: '앞발 착지', contact: '임팩트', ball_release: '릴리스', pelvis_peak: '골반 피크', trunk_peak: '몸통 피크', hand_peak: '손 피크' };
const UNIT_TEXT = { 'deg/s': '°/s', deg: '°', pct_leg_length: '%', ms: 'ms' };
const IS_TEXT = { below_ref: '참고 범위보다 낮음', above_ref: '참고 범위보다 높음', lower_than_last: '지난 기록보다 낮아짐', higher_than_last: '지난 기록보다 높아짐', sequence_off: '회전 순서가 어긋남' };
// 4단계에서 막는 표현: 부상 예방 · 치료 · 의학 조언, 「정확하다」 같은 단정, 프로 · 국가대표 같은 과장
// 글자 수 한도에 걸려 중간에 잘린 문장 · 「~다」체를 막는다: 앱 말투대로 「~요.」로 끝나야 한다
const ENDED = /요[.!?]?$/;
// 영어 낱말(「피크 velocity」처럼 key 를 그대로 옮긴 것)을 막는다. 단위 °/s · ms 는 괜찮다
const hasEnglish = (t) => /[A-Za-z]{2,}/.test(t.replace(/°\/s|ms/g, ''));
export const FORBIDDEN = /부상|예방|치료|재활|통증|진단|처방|의학|의사|병원|정확|틀림없|확실|반드시|무조건|프로(?!그램)|국가대표|메이저|최고 수준/;

const num = (v) => typeof v === 'number' && Number.isFinite(v);
export const unitText = (u) => UNIT_TEXT[u] ?? u;
// 받침이 있으면 이 · 없으면 가
const josa = (word, a, b) => { const c = word.charCodeAt(word.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b; };
const ORDER_TEXT = { pelvis: '골반', trunk: '몸통', hand: '손' };
const orderText = (o) => o.map((k) => ORDER_TEXT[k] || k).join(' → ');

// ── 1단계 · 측정 점검 → { usable: [key], excluded: [{ key, label, why }], stop: null | 이유, lines }
export function checkMeasurements(session, rules = COACH_RULES) {
  const lines = [], excluded = [], usable = [];
  const fps = session.video && session.video.fps, phases = session.phases || [];
  const missing = new Set(phases.filter((p) => !num(p.time_s)).map((p) => p.name));
  lines.push(num(fps) ? `영상은 초당 ${Math.round(fps)}프레임이에요${fps < rules.minFps ? ` — ${rules.minFps}프레임보다 적어 회전 속도는 쓰지 않아요.` : '.'}` : '초당 프레임 수를 몰라요.');
  lines.push((session.video && session.video.view) === 'side' || (session.video && session.video.view) === 'front' ? `촬영 방향: ${session.video.view === 'side' ? '옆' : '정면'}.` : '촬영 방향(옆 · 정면)은 앱이 판정하지 않아 확인하지 못했어요. 매번 같은 자리에서 찍었다고 보고 진행해요.');
  if (!phases.length) lines.push('동작 단계 시각이 없어(숫자만 저장한 기록) 단계 확인은 건너뛰었어요.');
  else if (missing.size) lines.push(`찾지 못한 순간: ${[...missing].map((n) => PHASE_TEXT[n] || n).join(', ')}.`);
  for (const m of session.metrics || []) {
    let why = null;
    if (!num(m.value)) why = '값을 재지 못했어요';
    else if (RATE_KEYS.includes(m.key) && num(fps) && fps < rules.minFps) why = `초당 ${Math.round(fps)}프레임이라 실제보다 낮게 나와요`;
    else if (num(m.uncertainty) && Math.abs(m.value) > 0 && m.uncertainty / Math.abs(m.value) > rules.maxRelSpread) why = `흔들림 폭 ±${m.uncertainty}${unitText(m.unit)}이 값의 ${Math.round((m.uncertainty / Math.abs(m.value)) * 100)}%라 너무 커요`;
    else if (m.phase && missing.has(m.phase)) why = `${PHASE_TEXT[m.phase] || m.phase} 순간을 찾지 못했어요`;
    if (why) excluded.push({ key: m.key, label: m.label, why }); else usable.push(m.key);
  }
  // 회전 순서: 골반 · 몸통 · 손 피크가 다 잡혔고, 그 순간들을 놓치지 않았을 때만
  const seq = session.sequence || {}, seqOk = Array.isArray(seq.order) && seq.order.length === 3 && !['pelvis_peak', 'trunk_peak', 'hand_peak'].some((n) => missing.has(n));
  if (seqOk) usable.push(SEQUENCE_KEY); else excluded.push({ key: SEQUENCE_KEY, label: '회전 순서', why: '골반 · 몸통 · 손 중 가장 빠른 순간을 못 찾은 부위가 있어요' });
  for (const x of excluded) lines.push(`제외: ${x.label} — ${x.why}.`);
  let stop = null;
  if (session.quality === 'low') stop = '앱이 이 기록의 신뢰도를 「낮음」으로 봤어요';
  else if (usable.length < rules.minUsable) stop = `쓸 수 있는 숫자가 ${usable.length}개뿐이에요(${rules.minUsable}개 이상 필요)`;
  lines.push(stop ? `여기서 멈춰요: ${stop}. ${RETAKE}` : `쓸 수 있는 숫자 ${usable.length}개로 다음 단계를 진행해요.`);
  return { usable, excluded, stop, lines };
}

// ── 2단계 · 비교 분석 → findings [{ key, label, is, size, value, unit, ref?, last? }] + 카드 후보 [{ card, findings, score }]
export function compareSession(cur, prev, usable, rules = COACH_RULES) {
  const findings = [], ok = new Set(usable), before = new Map(((prev && prev.metrics) || []).map((m) => [m.key, m]));
  for (const m of cur.metrics || []) {
    if (!ok.has(m.key)) continue;
    const u = num(m.uncertainty) ? m.uncertainty : 0, base = { key: m.key, label: m.label, value: m.value, unit: m.unit };
    if (Array.isArray(m.ref_range)) {
      const [lo, hi] = m.ref_range, width = Math.max(1, hi - lo);
      if (m.value + u < lo) findings.push({ ...base, is: 'below_ref', size: (lo - m.value) / width, ref: m.ref_range });
      else if (m.value - u > hi) findings.push({ ...base, is: 'above_ref', size: (m.value - hi) / width, ref: m.ref_range });
    }
    const p = before.get(m.key);
    if (p && num(p.value)) {
      const diff = m.value - p.value, margin = u + (num(p.uncertainty) ? p.uncertainty : 0);
      if (Math.abs(diff) > margin && Math.abs(diff) >= rules.minChange * Math.max(1, Math.abs(p.value))) {
        findings.push({ ...base, is: diff < 0 ? 'lower_than_last' : 'higher_than_last', size: Math.abs(diff) / Math.max(1, Math.abs(p.value)), last: p.value });
      }
    }
  }
  if (ok.has(SEQUENCE_KEY)) {
    const order = cur.sequence.order, gap = (cur.metrics || []).find((m) => m.key === 'pelvis_to_trunk_peak_gap');
    const trunkFirst = gap && ok.has(gap.key) && num(gap.value) && gap.value < 0;
    if (order[0] !== 'pelvis' || trunkFirst) findings.push({ key: SEQUENCE_KEY, label: '회전 순서', is: 'sequence_off', size: 0.3, value: orderText(order), unit: '' });
  }
  return findings;
}

export function candidatesFor(findings, cards) {
  return cards.map((card) => {
    const hit = findings.filter((f) => (card.when || []).some((w) => w.metric === f.key && w.is === f.is));
    return hit.length ? { card, findings: hit, score: Math.max(...hit.map((f) => f.size)) } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);
}

// 사람이 읽을 한 줄: 「골반 회전 피크가 참고 범위(587~773°/s)보다 낮게 나왔어요(520°/s).」
export function findingText(f) {
  const u = unitText(f.unit), subj = f.label + josa(f.label, '이', '가');
  if (f.is === 'sequence_off') return `회전 순서가 ${f.value} 차례로 나와, 골반부터 차례로 돌지 않았어요.`;
  if (f.is === 'below_ref' || f.is === 'above_ref') return `${subj} 참고 범위(${f.ref[0]}~${f.ref[1]}${u})보다 ${f.is === 'below_ref' ? '낮게' : '높게'} 나왔어요(${f.value}${u}).`;
  return `${subj} 지난 기록 ${f.last}${u} → 이번 ${f.value}${u}로 ${f.is === 'lower_than_last' ? '낮아졌어요' : '높아졌어요'}.`;
}

// ── 3단계 · AI 에게 줄 메시지. feedback = 4단계가 되돌린 이유(있으면)
export function buildMessages(findings, candidates, usable, feedback = null) {
  const system = [
    '너는 아마추어 야구 선수의 훈련 방향을 고르는 도우미다.',
    '반드시 아래 「후보 카드」 안에서만 1~2장을 고른다. 새 훈련을 지어내지 않는다.',
    'reason 은 왜 그 카드를 골랐는지 숫자와 잇는 짧은 한국어 한 문장(40자 안팎, 60자를 넘기지 않는다), summary 는 전체 요약 한국어 한 문장(50자 안팎, 80자를 넘기지 않는다).',
    'numbers_used 에는 「쓸 수 있는 숫자」의 key 만 쓴다.',
    '부상 · 예방 · 치료 · 통증 같은 의학 표현, 「정확하다」 같은 단정, 프로 · 국가대표 같은 비교를 쓰지 않는다. 쉬운 말로, 「~해요」체로 쓴다.',
    '영어 낱말 · key 이름을 문장에 쓰지 않는다. 문장은 짧게 끊고 「~요.」로 끝낸다.',
    '출력은 JSON 하나만: {"picked":[{"card_id":"","reason":"","numbers_used":[""]}],"summary":""}',
    '예시(모양만 참고): {"picked":[{"card_id":"bat_hip_turn","reason":"골반 회전이 참고 범위보다 낮아서 골랐어요.","numbers_used":["pelvis_peak_velocity"]}],"summary":"골반을 먼저 돌리는 연습부터 해 봐요."}',
  ].join('\n');
  const user = JSON.stringify({
    findings: findings.map((f) => ({ key: f.key, text: findingText(f) })),
    // 카드의 why(60자 넘는 설명)는 주지 않는다 — 주면 그대로 베껴 글자 수를 넘겼다
    candidates: candidates.map((c) => ({ card_id: c.card.id, title: c.card.title, matched: c.findings.map((f) => f.key) })),
    usable_keys: usable,
  });
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  if (feedback) messages.push({ role: 'user', content: `앞의 답을 고쳐 다시 JSON 으로만 답해 주세요. 문제: ${feedback}` });
  return messages;
}

// AI 출력 모양(web-llm 이 이 모양으로만 내게 강제한다) — card_id · numbers_used 는 후보 · 쓸 수 있는 숫자로, 글자 수는 4단계 한도로 좁힌다
//  · 글자 수 한도가 없으면 1.5B 모델이 64자 이유를 되돌림 3번 내내 그대로 냈다(2026-11-28 실측)
export function outputSchema(candidates, usable) {
  return {
    type: 'object', required: ['picked', 'summary'],
    properties: {
      picked: { type: 'array', minItems: 1, maxItems: COACH_RULES.maxPick, items: { type: 'object', required: ['card_id', 'reason', 'numbers_used'],
        properties: { card_id: { type: 'string', enum: candidates.map((c) => c.card.id) }, reason: { type: 'string', minLength: 10, maxLength: COACH_RULES.reasonMax }, numbers_used: { type: 'array', minItems: 1, items: { type: 'string', enum: usable } } } } },
      summary: { type: 'string', minLength: 10, maxLength: COACH_RULES.summaryMax },
    },
  };
}

// ── 4단계 · 검사 → [실패 이유] (빈 배열 = 통과)
export function validatePick(out, candidates, usable, rules = COACH_RULES) {
  const errs = [], ids = new Set(candidates.map((c) => c.card.id)), ok = new Set(usable);
  if (!out || typeof out !== 'object' || !Array.isArray(out.picked)) return ['JSON 모양이 아니에요(picked 목록이 없어요)'];
  if (!out.picked.length || out.picked.length > rules.maxPick) errs.push(`카드는 1~${rules.maxPick}장이어야 해요(${out.picked.length}장)`);
  const seen = new Set();
  for (const p of out.picked) {
    if (!p || !ids.has(p.card_id)) { errs.push(`후보에 없는 카드예요: ${p && p.card_id}`); continue; }
    if (seen.has(p.card_id)) errs.push(`같은 카드를 두 번 골랐어요: ${p.card_id}`);
    seen.add(p.card_id);
    if (typeof p.reason !== 'string' || !p.reason.trim()) errs.push(`${p.card_id} 이유가 비었어요`);
    else if ([...p.reason.trim()].length > rules.reasonMax) errs.push(`${p.card_id} 이유가 ${[...p.reason.trim()].length}자예요(${rules.reasonMax}자 이내)`);
    else if (FORBIDDEN.test(p.reason)) errs.push(`${p.card_id} 이유에 쓰면 안 되는 표현이 있어요: 「${p.reason.match(FORBIDDEN)[0]}」`);
    else if (!ENDED.test(p.reason.trim())) errs.push(`${p.card_id} 이유 문장이 끝나지 않았어요(「~요.」로 끝내 주세요)`);
    else if (hasEnglish(p.reason)) errs.push(`${p.card_id} 이유에 영어 낱말이 있어요(한국어로만 써 주세요)`);
    const used = Array.isArray(p.numbers_used) ? p.numbers_used : [];
    if (!used.length) errs.push(`${p.card_id} 근거 숫자가 비었어요`);
    for (const k of used) if (!ok.has(k)) errs.push(`${p.card_id} 근거 숫자 ${k} 는 1단계에서 뺐거나 없는 숫자예요`);
  }
  const s = typeof out.summary === 'string' ? out.summary.trim() : '';
  if (!s) errs.push('요약이 비었어요');
  else if ([...s].length > rules.summaryMax) errs.push(`요약이 ${[...s].length}자예요(${rules.summaryMax}자 이내)`);
  else if (FORBIDDEN.test(s)) errs.push(`요약에 쓰면 안 되는 표현이 있어요: 「${s.match(FORBIDDEN)[0]}」`);
  else if (!ENDED.test(s)) errs.push('요약 문장이 끝나지 않았어요(「~요.」로 끝내 주세요)');
  else if (hasEnglish(s)) errs.push('요약에 영어 낱말이 있어요(한국어로만 써 주세요)');
  return errs;
}

// AI 없이: 후보 중 findings 가 큰 순서로 1~2장, 설명은 카드의 why
export function rulePick(candidates, rules = COACH_RULES) {
  const top = candidates.slice(0, rules.maxPick);
  return {
    picked: top.map((c) => ({ card_id: c.card.id, reason: c.card.why, numbers_used: [...new Set(c.findings.map((f) => f.key))] })),
    summary: top.length ? findingText(top[0].findings.slice().sort((a, b) => b.size - a.size)[0]) : '',
  };
}

const parseJson = (text) => { try { return JSON.parse(String(text).trim().replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { return null; } };

// 전체 실행 → { status: 'ok' | 'retake' | 'none', source: 'ai' | 'rules' | null, picked: [{ card, reason, numbers_used }], summary, findings, check, steps }
//  · llm = async (messages, schema) → 글자 | null(AI 없이). timeout = (ms) → 그만큼 뒤에 끝나는 Promise (시험에서 바꿔 끼운다)
export async function runCoach({ snapshot, cards, llm = null, rules = COACH_RULES, timeout = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const sessions = snapshot.sessions || [], cur = sessions[sessions.length - 1], prev = sessions.length > 1 ? sessions[sessions.length - 2] : null;
  const steps = [], step = (n, title, lines) => steps.push({ n, title, lines });
  const check = checkMeasurements(cur, rules);
  step(1, '측정 점검', check.lines);
  const done = (o) => ({ findings: [], candidates: [], picked: [], summary: '', source: null, check, steps, ...o });
  if (check.stop) return done({ status: 'retake', summary: `${check.stop}. ${RETAKE}` });

  const findings = compareSession(cur, prev, check.usable, rules), candidates = candidatesFor(findings, cards);
  step(2, '비교 분석', [
    prev ? `지난 기록(${String(prev.recorded_at).slice(0, 10)})과 참고 범위에 견줬어요.` : '지난 기록이 없어 참고 범위에만 견줬어요.',
    ...(findings.length ? findings.map(findingText) : ['참고 범위를 벗어나거나 지난 기록과 흔들림 폭(±) 넘게 달라진 숫자가 없어요.']),
    candidates.length ? `조건이 맞는 훈련 카드 ${candidates.length}장: ${candidates.map((c) => `「${c.card.title}」(${c.findings.map((f) => IS_TEXT[f.is]).join(', ')})`).join(' · ')}` : '조건이 맞는 훈련 카드가 없어요.',
  ]);
  if (!candidates.length) return done({ status: 'none', findings, summary: '지금 숫자로는 따로 권할 훈련이 없어요. 같은 조건으로 꾸준히 찍어 지난 기록과 견줘 보세요.' });

  const byId = new Map(candidates.map((c) => [c.card.id, c.card]));
  const finish = (out, source, lines) => {
    step(4, '검사', lines);
    return { status: 'ok', source, findings, candidates, check, steps, summary: out.summary,
      picked: out.picked.map((p) => ({ card: byId.get(p.card_id), reason: p.reason, numbers_used: p.numbers_used })) };
  };
  const rules_ = () => rulePick(candidates, rules);
  if (!llm) {
    step(3, '훈련 방향', ['AI 없이 받기라 규칙으로 골랐어요: 차이가 큰 순서로 카드를 고르고, 설명은 카드에 적힌 문장을 그대로 써요.']);
    return finish(rules_(), 'rules', ['규칙 결과라 AI 검사는 하지 않았어요.']);
  }
  const lines3 = [], lines4 = [], started = Date.now();
  let feedback = null;
  for (let attempt = 0; attempt <= rules.maxRetries; attempt++) {
    const left = rules.timeoutMs - (Date.now() - started);
    if (left <= 0) break;
    let text;
    try {
      text = await Promise.race([llm(buildMessages(findings, candidates, check.usable, feedback), outputSchema(candidates, check.usable)), timeout(left).then(() => { throw new Error('timeout'); })]);
    } catch (e) {
      lines3.push(e.message === 'timeout' ? `${Math.round(rules.timeoutMs / 1000)}초 안에 AI 답이 오지 않았어요.` : `AI 실행이 멈췄어요(${e.message}).`);
      break;
    }
    const out = parseJson(text), errs = validatePick(out, candidates, check.usable, rules);
    lines3.push(`${attempt ? `다시 ${attempt}번째: ` : ''}AI 가 후보 ${candidates.length}장 중 ${out && Array.isArray(out.picked) ? out.picked.map((p) => p && p.card_id).join(', ') : '(읽을 수 없는 답)'} 을 골랐어요.`);
    if (!errs.length) { step(3, '훈련 방향 (AI)', lines3); return finish(out, 'ai', [...lines4, '후보 안의 카드인지, 근거 숫자, 글자 수, 쓰면 안 되는 표현을 확인했어요 — 통과.']); }
    lines4.push(`되돌림 ${attempt + 1}: ${errs.join(' / ')}`);
    feedback = errs.join(' / ');
  }
  step(3, '훈련 방향 (AI)', lines3);
  return finish(rules_(), 'rules', [...lines4, 'AI 결과를 쓰지 못해 규칙 결과로 바꿨어요(차이가 큰 순서 · 카드 설명 그대로).']);
}

// 공개 범위: 일반 모드는 지도자가 승인한 카드만, 검증 모드(?mode=verify)는 초안까지
export const usableCards = (cards, verify) => cards.filter((c) => verify || (c.evidence && c.evidence.status === 'coach_approved'));
export const evidenceText = (card) => (card.evidence && card.evidence.status === 'coach_approved' ? '코치 확인'
  : card.evidence && card.evidence.source && card.evidence.source !== '근거 확인 필요' ? '논문 기반 초안' : '초안 · 근거 확인 필요');
