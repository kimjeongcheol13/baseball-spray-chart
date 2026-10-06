#!/usr/bin/env node
// 폰 테스트용 미리보기 서버 — 이 브랜치를 같은 와이파이의 폰에서 열어 본다 (배포 없이). 사용법: node tests/lan-preview.mjs [포트=8080]
//  · 저장소를 읽기 전용으로 서빙한다. local/ · .git/ · .github/ · 점(.)으로 시작하는 경로는 서빙하지 않는다 (실명 데이터가 네트워크에 노출되지 않게).
//  · 폰에서 나가는 외부 요청을 막는다: index.html 의 supabase CDN 태그 자리에 tests/stub-supabase.js(가짜 supabase + 외부 fetch/XHR/beacon/WebSocket 차단)를 끼우고,
//    Sentry 태그를 빼고, js/analytics.js(GA4)를 빈 함수로 바꾼다 → 서버(Supabase)·GA·Sentry 에 아무것도 올라가지 않는다. 로그인 버튼은 가짜 서버에만 닿는다.
//  · 막힌 시도는 이 터미널에 [차단] 으로 찍힌다 (정상이라면 하나도 없다 — 로그인하지 않으면 서버 전송 자체가 없다).
//  · 폰은 이 PC 와 따로 저장소(localStorage)를 쓴다 — 접속 주소가 다른 출처라서 GitHub Pages 의 기존 기록이 보이지도 건드려지지도 않는다.
//  · 서비스 워커는 http(비보안) 주소에서는 등록되지 않아 캐시가 남지 않는다. 코드를 고치고 새로고침하면 바로 반영된다.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.argv[2] || process.env.PORT || 8080);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const CDN_SUPABASE = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^"]*"><\/script>/;
const SENTRY = /<script\s+src="https:\/\/js\.sentry-cdn\.com\/[^"]*"[^>]*><\/script>/;
const DENY = /^\/(local|\.git|\.github|\.claude|social|sql|docs)(\/|$)|\/\./;

// 막힌 외부 요청을 이 서버로 알린다 (같은 출처라서 stub 이 통과시킨다)
const REPORT = `<script>(function(){var a=window.__netAttempts;if(!a)return;var p=a.push.bind(a);a.push=function(x){try{fetch('/__net?u='+encodeURIComponent(x));}catch(e){}return p(x);};})();</script>`;

function page() {
  let h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (!CDN_SUPABASE.test(h)) throw new Error('index.html 에서 supabase CDN <script> 를 찾지 못했다 — 미리보기 서버 갱신 필요');
  return h.replace(CDN_SUPABASE, '<script src="/tests/stub-supabase.js"></script>' + REPORT).replace(SENTRY, '');
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const send = (code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
    if (url.pathname === '/__net') { console.log('[차단] 외부 요청 시도 →', url.searchParams.get('u')); return send(204, 'text/plain', ''); }
    if (url.pathname === '/' || url.pathname === '/index.html') return send(200, MIME['.html'], page());
    if (url.pathname === '/js/analytics.js') return send(200, MIME['.js'], 'window.dataLayer=[];window.gtag=function(){};');   // GA4 로 아무것도 보내지 않는다
    const rel = decodeURIComponent(url.pathname);
    if (DENY.test(rel)) return send(404, 'text/plain', 'not found');
    const f = path.resolve(ROOT, '.' + rel);
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return send(404, 'text/plain', 'not found');
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`SprayLab 미리보기 서버 (${ROOT})\n  이 PC:  http://localhost:${PORT}/`);
  ips.forEach((ip) => console.log(`  폰:     http://${ip}:${PORT}/`));
  if (!ips.length) console.log('  (LAN 주소를 찾지 못했다 — 와이파이에 연결돼 있는지 확인)');
  console.log('끝내려면 Ctrl+C. 서버(Supabase) · GA · Sentry 로는 아무것도 나가지 않는다 — 막힌 시도가 있으면 [차단] 으로 표시된다.');
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `포트 ${PORT} 가 이미 쓰이고 있다 — node tests/lan-preview.mjs 8081` : e); process.exit(1); });
