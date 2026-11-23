// 동작 분석 — 사용 기록(GA4): 어떤 기능을 실제로 쓰는지 알려고 남긴다
//  · 보내는 것: 기능 이름과 종류(타격/투구 · 신뢰도 · 찾은 개수 같은 짧은 값)뿐. 선수 이름 · 영상 · 관절 좌표 · 지표 숫자는 보내지 않는다
//  · 앱과 같은 GA4 계정 · 같은 익명 식별자(spraylab_uid)를 쓴다. 앱의 js/analytics.js 는 소개 페이지용 이벤트까지 보내서 따로 둔다
//  · 배포 주소(github.io)에서만, 자동화 브라우저(시험 · 봇)에서는 아무것도 보내지 않는다
const GA_ID = 'G-M0XVPN7YC1';
const UID_KEY = 'spraylab_uid';
let ready = false;

export const usageAllowed = (host = location.hostname, webdriver = navigator.webdriver) => /\.github\.io$/.test(host) && !webdriver;

// 익명 식별자: 앱이 이미 만들어 두었으면 그것을, 없으면 새로 만든다(저장 못 하는 브라우저면 없이)
function anonymousId() {
  try {
    let id = localStorage.getItem(UID_KEY);
    if (!id && crypto.randomUUID) { id = crypto.randomUUID(); localStorage.setItem(UID_KEY, id); }
    return id;
  } catch (err) {
    return null;
  }
}

// 페이지를 열 때 한 번
export function startUsage() {
  if (ready || !usageAllowed()) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  const id = anonymousId();
  window.gtag('config', GA_ID, id ? { user_id: id } : {});
  ready = true;
  track('motion_view');
}

// 기능을 썼을 때 · params 는 짧은 글자 · 숫자 · 참거짓만
export function track(name, params = {}) {
  if (ready && typeof window.gtag === 'function') window.gtag('event', name, params);
}
