#!/usr/bin/env node
// 동기화 하네스 러너 — 의존성 없음. 사용법: node tests/run.mjs   (Chrome/Edge 필요, 경로는 CHROME 환경변수로 지정 가능)
//  · 임시 정적 서버(127.0.0.1)가 저장소를 서빙하되 index.html 의 supabase CDN 태그만 tests/stub-supabase.js 로 바꾸고 tests/sync.test.js 를 덧붙인다
//  · 브라우저는 새 프로필 + 127.0.0.1 외 모든 호스트 이름 해석 차단(--host-resolver-rules) → 스텁되지 않은 요청은 실서버에 닿을 수 없다(fail-closed)
//  · 결과를 못 읽거나 실패가 하나라도 있으면 종료 코드 1
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const CDN_SUPABASE = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^"]*"><\/script>/;

function testPage() {
  let h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (!CDN_SUPABASE.test(h)) throw new Error('index.html 에서 supabase CDN <script> 를 찾지 못했다 — 하네스 갱신 필요');
  if (!h.includes('</body>')) throw new Error('index.html 에 </body> 가 없다');
  // 공용 하네스 → tests/*.test.js(이름순) 순서로 끼운다
  const files = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js')).sort();
  const tags = ['harness.js', ...files].map((f) => `<script src="/tests/${f}"></script>`).join('');
  return h.replace(CDN_SUPABASE, '<script src="/tests/stub-supabase.js"></script>').replace('</body>', tags + '</body>');
}

function findChrome() {
  const c = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const hit = c.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Chrome/Edge 를 찾지 못했다 — CHROME 환경변수에 실행 파일 경로를 지정');
  return hit;
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/' || url.pathname === '/index.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(testPage()); }
    const f = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-test-'));
const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--virtual-time-budget=300000', '--enable-logging=stderr', '--v=0',
  ...((process.getuid && process.getuid() === 0) || process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []), '--dump-dom', `http://127.0.0.1:${port}/`];
const child = spawn(findChrome(), args);
let out = '', err = '';
child.stdout.on('data', (d) => (out += d));
child.stderr.on('data', (d) => (err += d));
const killer = setTimeout(() => child.kill(), 120000);
const code = await new Promise((r) => child.on('close', r));
clearTimeout(killer);
server.close();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}

const m = out.match(/data-b64="([^"]+)"/);
if (!m) {
  console.error('✘ 결과를 읽지 못했다(브라우저 종료 코드 ' + code + '). 콘솔 로그:');
  console.error(err.split('\n').filter((l) => /CONSOLE/.test(l)).slice(-20).join('\n') || '(없음)');
  process.exit(1);
}
const payload = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
if (payload.fatal) { console.error('✘ 하네스 오류: ' + payload.fatal); process.exit(1); }
let failed = 0;
for (const r of payload.results) {
  if (!r.ok) failed++;
  console.log((r.ok ? '✔ ' : '✘ ') + r.name + (r.ok ? '' : '\n    → ' + r.err));
}
console.log(`\n${payload.results.length - failed} 통과 / ${failed} 실패`);
process.exit(failed ? 1 : 0);
