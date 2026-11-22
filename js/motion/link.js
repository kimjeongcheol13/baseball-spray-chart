// 동작 분석 — 붙여넣은 영상 주소를 읽어 새 탭에서 열 주소로 바꾼다 (유튜브는 시작 시간까지)
//  · 주소만으로 영상을 가져올 수는 없다(브라우저가 다른 사이트의 영상 화면을 읽지 못하게 막는다).
//    그래서 주소는 「그 영상을 새 탭에 여는 데」만 쓰고, 화면은 화면 녹화(capture.js)로 받는다
const YOUTUBE = /^https?:\/\/(?:(?:www|m|music)\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|live\/|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i;
const START = /[?&#](?:t|start)=([0-9hms]+)/i;

// '90' · '90s' · '1m30s' · '1h2m3s' → 초 (읽지 못하면 0)
export function secondsOf(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(text);
  return m && m[0] ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
}

// 붙여넣은 글자 → { kind: 'youtube' | 'web', url, id?, start? } · 주소가 아니면 null
export function parseLink(text) {
  const raw = (text || '').trim();
  if (!/^https?:\/\/\S+$/i.test(raw)) return null;
  const yt = YOUTUBE.exec(raw);
  if (!yt) return { kind: 'web', url: raw };
  const t = START.exec(raw), start = t ? secondsOf(t[1]) : 0;
  return { kind: 'youtube', id: yt[1], start, url: `https://www.youtube.com/watch?v=${yt[1]}${start ? `&t=${start}s` : ''}` };
}
