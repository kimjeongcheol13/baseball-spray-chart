// 플레이 읽어 주기 — 타석을 기록하면 결과를 소리로 읽는다 ("김지훈, 2루타, 2타점"). 브라우저 음성(speechSynthesis) · 서버 없음
// 기본 꺼짐 · 경기설정 › 그 밖의 기능 › 경기에서 켠다 (이 기기에만: localStorage sl_speak)
// 자리: 타석을 남기는 길(필드 탭 · 기타 결과 · 빠른 기록 · 반복 기록 · 투구 탭)은 모두 updateAll() 을 부른다 → 그 한 곳을 감싸서
//   타석이 하나 늘었고 방금(10초 안) 만든 것일 때만 읽는다. 불러오기 · 가져오기(여러 개) · 되돌리기(줄어듦)는 읽지 않는다
const KEY = 'sl_speak';
const WORD = { __proto__: null, '희타': '희생번트', '희비': '희생플라이' };

export const isOn = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
export function setOn(on) {
  try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) {}
  if (on) say('기록 읽어 주기를 켰어요');   // 켜는 탭이 사용자 동작이라 iOS 에서도 음성이 풀린다
}

export function line(a) {
  const rbi = +a.rbi > 0 ? `, ${+a.rbi}타점` : '';
  return `${a.bname || '타자'}, ${WORD[a.res] || a.res}${rbi}`;
}

export function say(text) {
  const S = window.speechSynthesis;
  if (!S || typeof window.SpeechSynthesisUtterance !== 'function') return false;
  const u = new window.SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  const v = (S.getVoices() || []).find(x => /^ko/i.test(x.lang));
  if (v) u.voice = v;
  S.cancel();   // 앞 타석을 아직 읽는 중이면 끊고 새 타석
  S.speak(u);
  return true;
}

// 경기설정 › 그 밖의 기능 › 경기 줄 (setup.js 가 넣는다 · 모양은 투구 수 관리 켜기와 같은 .pl-on)
export const rowHtml = () => `<label class="pl-on sp-on"><input type="checkbox" id="slSpeakOn"${isOn() ? ' checked' : ''} onchange="slSpeakOn(this.checked)"><span><b>🔈 기록 읽어 주기</b><small>타석 결과를 소리로 · 이 기기에만 저장</small></span></label>`;

if (typeof window !== 'undefined') {
  window.slSpeak = { isOn, setOn, line, say };
  window.slSpeakOn = setOn;
  const abs = () => ((window.AS || {}).abs) || [];
  let n = abs().length, lastId = n ? abs()[n - 1].id : null;
  const orig = window.updateAll;
  if (typeof orig === 'function') window.updateAll = function () {
    const r = orig.apply(this, arguments);
    try {
      const L = abs(), a = L[L.length - 1];
      const fresh = a && a.id !== lastId && L.length - n <= 1 && L.length >= n && Math.abs(Date.now() - a.id) < 10000;
      n = L.length; lastId = a ? a.id : null;
      if (fresh && isOn()) say(line(a));
    } catch (e) {}
    return r;
  };
}
