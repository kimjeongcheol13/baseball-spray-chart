// 동작 분석 — 훈련 카드 · 측정 설명의 근거 목록(assets/motion/evidence.json)을 읽고 그린다
//  · 논문 문장 · 숫자 · 라벨(종류 · 방향 · 수준)은 전부 이 파일에서 읽는다. 코드에 박지 않는다 — 기준은 docs/EVIDENCE.md
//  · 못 읽으면 빈 목록으로 넘어간다: 근거 칸만 줄고 나머지 화면은 그대로 돈다
const EMPTY = { version: null, papers: [], levels: {}, kinds: {}, types: {}, directions: {}, sports: {}, measurement_notes: { can_say: [], cannot_say: [] } };
let loading = null;
export function loadEvidence() {
  loading ||= fetch('assets/motion/evidence.json?v=1').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .catch((e) => { console.warn('[motion] 근거 목록을 읽지 못했어요', e); loading = null; return EMPTY; });
  return loading;
}

const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const link = (p) => { const a = make('a', '', p.short); a.href = p.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
const badge = (ev, p) => `${ev.types[p.type] || p.type} · ${ev.directions[p.direction] || p.direction}${p.kind !== 'peer_reviewed' ? ` · ${ev.kinds[p.kind] || p.kind}` : ''}`;

// 결과 카드의 접힌 「근거 자세히」: 카드 요약 → refs 순서대로 논문(링크 · 배지 · 찾은 것 · 한계)
export function evidenceDetails(card, ev) {
  const d = make('details', 'mo-guide mo-evidence'), e = card.evidence || {}, byId = new Map(ev.papers.map((p) => [p.id, p]));
  d.append(make('summary', '', '근거 자세히'));
  if (e.summary) d.append(make('p', 'mo-evidence-sum', e.summary));
  const papers = (e.refs || []).map((id) => byId.get(id)).filter(Boolean);
  if (papers.length) {
    const ul = make('ul', 'mo-evidence-list');
    ul.append(...papers.map((p) => {
      const li = make('li');
      li.append(link(p), make('span', 'mo-evidence-badge', badge(ev, p)), make('p', '', p.finding), make('p', 'mo-evidence-limits', p.limits));
      return li;
    }));
    d.append(ul);
  }
  return d;
}

// 결과 화면 「이 앱이 참고한 연구」: 타격이면 타격 + 측정 정확도, 투구면 투구 + 측정 정확도 · 맨 아래 말해도 되는 것 · 안 되는 것
const SPORTS = { bat: ['batting', 'measurement'], pitch: ['pitching', 'measurement'] };
export function referenceList(mode, ev) {
  const groups = (SPORTS[mode] || []).map((s) => [s, ev.papers.filter((p) => p.sport === s)]).filter(([, ps]) => ps.length);
  const n = groups.reduce((t, [, ps]) => t + ps.length, 0);
  if (!n) return null;
  const d = make('details', 'mo-guide mo-refs');
  d.id = 'refStudies';
  d.append(make('summary', '', `이 앱이 참고한 연구 (${n}편 · ${ev.version} 기준)`));
  for (const [s, ps] of groups) {
    const ul = make('ul');
    ul.append(...ps.map((p) => { const li = make('li'); li.append(link(p), ` — ${p.finding}`); return li; }));
    d.append(make('h5', 'mo-refs-head', ev.sports[s] || s), ul);
  }
  const notes = ev.measurement_notes || {};
  for (const [title, list] of [['측정 정확도 — 말해도 되는 것', notes.can_say], ['측정 정확도 — 말하면 안 되는 것', notes.cannot_say]]) {
    if (!list || !list.length) continue;
    const ul = make('ul');
    ul.append(...list.map((t) => make('li', '', t)));
    d.append(make('h5', 'mo-refs-head', title), ul);
  }
  return d;
}

// #refNote 바로 아래에 붙인다(결과 화면이 다시 그려질 때마다 부른다). 늦게 온 이전 호출은 버린다
let turn = 0;
export async function mountReferences(anchor, mode) {
  const me = ++turn, ev = await loadEvidence();
  if (me !== turn) return;
  document.getElementById('refStudies')?.remove();
  const d = mode && referenceList(mode, ev);
  if (d && anchor) anchor.after(d);
}
