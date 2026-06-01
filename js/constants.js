export const MAX_HITS = 300;

export const HITS = ['안타','내야안타','2루타','3루타','홈런'];
export const NOAB = ['볼넷','사구','희타','희비'];
export const BASE = {'안타':1,'내야안타':1,'2루타':2,'3루타':3,'홈런':4};

export const RC = {
  '안타':'#2dd4a0','내야안타':'#5eead4','2루타':'#4b8cf5',
  '3루타':'#f6c23e','홈런':'#f56565','플라이 아웃':'#374151','땅볼 아웃':'#2a3040'
};

export const PT_TYPES = ['직구','슬라이더','커브','체인지업','포크볼','커터'];
export const PT_COLORS = ['#4b8cf5','#f6c23e','#a78bfa','#2dd4a0','#fb923c','#8892a4'];

export const ZONES_9 = [
  '내각 높음','중앙 높음','외각 높음',
  '내각 중간','중앙 중간','외각 중간',
  '내각 낮음','중앙 낮음','외각 낮음'
];

export const DIR_LABELS = {pull:'당겨치기', center:'센터', oppo:'밀어치기'};

export const RESULT_ICONS = {
  '볼':'🟢','스트라이크':'🟡','파울':'🟣','안타':'🟢',
  '2루타':'🔵','3루타':'🟡','홈런':'🔴'
};

export const SWIPE_ICONS = {
  '안타':'🟢 안타','땅볼 아웃':'⬛ 아웃','볼넷':'🟣 볼넷','삼진':'🔴 삼진'
};

export const PITCH_RESULT_COLORS = {
  '볼':'#2dd4a0','스트라이크':'#f6c23e','파울':'#a78bfa',
  '안타':'#2dd4a0','2루타':'#4b8cf5','3루타':'#f6c23e','홈런':'#f56565','타격됨':'#f56565'
};

// Severity levels for enhanced AI insights
export const SEVERITY = { info: 'info', warn: 'warn', critical: 'critical', positive: 'pos' };

export const PITCH_STRATEGIES = {
  pull_heavy: { zone: '외각', pitch: '슬라이더/커브', reason: '당겨치기 편중 타자 — 외각 변화구 공략' },
  oppo_heavy: { zone: '내각', pitch: '직구/커터', reason: '밀어치기 타자 — 내각 강공 유효' },
  high_k: { zone: '낮음', pitch: '포크볼/체인지업', reason: '삼진 비율 높음 — 낙차 구종으로 마무리' },
  good_eye: { zone: '스트라이크 존', pitch: '직구/커터', reason: '선구안 좋은 타자 — 존 안 승부' },
  power: { zone: '외각 낮음', pitch: '슬라이더', reason: '장타력 높은 타자 — 외각 낮은 변화구' }
};

/** HTML 이스케이프 — compare/profile/scouting/insights 공용 */
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
