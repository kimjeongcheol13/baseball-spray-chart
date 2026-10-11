// 타석 결과 구성 그림 (비교 · 프로필 공용) — 줄마다 100% 누적 막대 + 정확한 비율 표(표 머리 = 색 범례)
// 색: 안타 계열 = 앰버 단계(진할수록 장타) · 볼넷·사구 = 틸 · 삼진/범타 = 무채색 → css/analysis.css --mx0~5
import { esc as _esc } from '../constants.js';
import { pct } from './batdata.js?v=6';

// mix: [{ k, label }] 6칸 — 단타 · 2·3루타 · 홈런 · 볼넷·사구 · 삼진 · 범타 순 (색 순서와 같아야 함)
// rows: [{ name, st, mark?: 이름 앞 표시(HTML, 있으면 표에는 이름 대신 이것만), tname?: 표에 쓸 짧은 이름, ref?: 기준 줄(얇은 막대), cnt?: { [k]: 개수 } }]
export function mixFigure(mix, rows) {
  const bar = r => {
    const s = r.st;
    const segs = mix.map((m, i) => {
      const v = s[m.k];
      if (!(v > 0)) return '';
      // 칸이 좁거나 기준 줄(얇은 막대)이면 숫자를 넣지 않는다 (아래 표에 모두 있음)
      return `<i class="mx${i}" style="flex:${v * 100} 1 0" title="${m.label} ${pct(v)}">${!r.ref && v >= 0.12 ? pct(v) : ''}</i>`;
    }).join('');
    const aria = _esc(`${r.name} ${s.pa}타석: ${mix.map(m => `${m.label} ${pct(s[m.k])}`).join(', ')}`);
    return `
      <div class="an-mixrow${r.ref ? ' ref' : ''}">
        <span class="an-mixwho">${r.mark || ''}<b>${_esc(r.name)}</b><small>${s.pa}타석</small></span>
        <span class="an-mixbar" role="img" aria-label="${aria}">${segs}</span>
      </div>`;
  };
  const who = r => (r.mark ? `${r.mark}<span class="sr">${_esc(r.name)}</span>` : `<span class="an-mixtbl-who">${_esc(r.tname || r.name)}</span>`);
  const tr = r => `<tr><th scope="row">${who(r)}</th>${mix.map(m => `<td>${pct(r.st[m.k])}${r.cnt ? `<small>${r.cnt[m.k]}번</small>` : ''}</td>`).join('')}</tr>`;
  const named = rows.some(r => !r.mark);
  return `
    <div class="an-mixbars">${rows.map(bar).join('')}</div>
    <table class="an-mixtbl${named ? ' named' : ''}">
      <thead><tr><th scope="col"><span class="sr">구분</span></th>${mix.map((m, i) => `<th scope="col"><i class="an-mixkey mx${i}"></i>${m.label}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(tr).join('')}</tbody>
    </table>
    <div class="an-mixnote">안타는 진할수록 장타 · 좁은 칸의 숫자는 표에서 확인</div>`;
}
