#!/usr/bin/env node
// 동기화 하네스 러너 — 의존성 없음. 사용법: node tests/run.mjs   (Chrome/Edge 필요, 경로는 CHROME 환경변수로 지정 가능)
//  · 임시 정적 서버(127.0.0.1)가 저장소를 서빙하되 index.html 의 supabase CDN 태그만 tests/stub-supabase.js 로 바꾸고 tests/harness.js + 테스트 파일 1개를 덧붙인다
//  · 테스트 파일마다 브라우저를 따로 띄운다(새 프로필 · 새 페이지). 가상 시간 예산이 파일마다 따로 적용되고, 한 파일이 남긴 로그인 · localStorage · 타이머가 다음 파일로 새지 않는다.
//    파일은 JOBS 개(기본 2)씩 동시에 돈다(JOBS=1 이면 하나씩. 크롬을 많이 띄울수록 빨라지지 않는다 — 부하가 큰 컴퓨터에서 4개는 2개보다 느렸다). 앱의 타이머(디바운스 3초 · 10초 등)는 그대로 기다린다 — 시계를 건너뛰지 않는다
//  · 브라우저는 127.0.0.1 외 모든 호스트 이름 해석 차단(--host-resolver-rules) → 스텁되지 않은 요청은 실서버에 닿을 수 없다(fail-closed). 외부 요청 0건 검사는 모든 파일 페이지에서 돈다
//  · fail-closed: 어떤 파일이든 예산 초과 · 결과 없음 · 하네스 오류 · 등록된 테스트 0개 · 강제 종료면 이유를 출력하고 종료 코드 1. 테스트가 하나라도 실패해도 1
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const CDN_SUPABASE = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^"]*"><\/script>/;

// 가상 시간 예산(ms) — 파일 하나가 쓸 수 있는 양. 파일의 sleep 이 이 안에 다 돌아야 한다. 넘으면 브라우저가 결과 게시 전에 멈추므로 "예산 초과"로 실패시킨다(실제 시간은 파일당 몇 초)
const BUDGET_MS = 600000;
const WARN_RATIO = 0.8;     // 예산의 이 비율을 넘으면 통과해도 경고만 한다(곧 예산이 모자라진다는 신호)
const WALL_MS = 120000;     // 파일 하나의 실제 시간 상한(넘으면 강제 종료 → 실패)

const testFiles = () => fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js')).sort();

// only = 테스트 파일 하나(러너가 쓰는 방식). 생략하면 전부 한 페이지에 끼운다(손으로 열어 볼 때만)
function testPage(only) {
  let h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (!CDN_SUPABASE.test(h)) throw new Error('index.html 에서 supabase CDN <script> 를 찾지 못했다 — 하네스 갱신 필요');
  if (!h.includes('</body>')) throw new Error('index.html 에 </body> 가 없다');
  // 공용 하네스 → 테스트 파일 순서로 끼운다
  const tags = ['harness.js', ...(only ? [only] : testFiles())].map((f) => `<script src="/tests/${f}"></script>`).join('');
  // 앱보다 먼저 도는 <head> 첫 스크립트 — 테스트 페이지가 다시 로드되지 않게 한다(앱 코드는 그대로 두고 환경만 정리):
  //  1) 서비스워커를 등록하지 않는다. 테스트 서버(127.0.0.1)에서는 sw.js 가 실제로 설치되고, 그 controllerchange 로 앱(index.html)이 location.reload 를 불러
  //     모든 실행이 시작 직후 한 번 다시 로드됐다. 테스트와 무관한 캐시도 끼어든다(sw.js 는 이 하네스의 검사 대상이 아니다)
  //  2) 가시성 변경 이벤트를 앱에 전달하지 않는다. 서비스워커 컨트롤러가 없으면 앱이 가시성이 visible 이 될 때 location.reload 를 부르는데,
  //     헤드리스 창이 여러 개일 때 가시성이 바뀔 수 있다
  // 그래도 다시 로드되면 harness.js 가 알아채 실패시킨다(조용히 넘어가지 않는다)
  const guard = `<script>if (navigator.serviceWorker) navigator.serviceWorker.register = function () { return new Promise(function () {}); };`
    + ` window.addEventListener('visibilitychange', function (e) { e.stopImmediatePropagation(); }, true);</script>`;
  if (!/<head[^>]*>/.test(h)) throw new Error('index.html 에 <head> 가 없다');
  return h.replace(/<head[^>]*>/, (m) => m + guard).replace(CDN_SUPABASE, '<script src="/tests/stub-supabase.js"></script>').replace('</body>', tags + '</body>');
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

const allFiles = testFiles();
if (!allFiles.length) { console.error('✘ tests/*.test.js 가 하나도 없다'); process.exit(1); }
// 인자로 이름 일부를 주면 그 파일만 돈다: node tests/run.mjs teams menu  (맞는 파일이 하나도 없으면 실패 — 조용히 0개를 돌리지 않는다)
const want = process.argv.slice(2);
const files = want.length ? allFiles.filter((f) => want.some((w) => f.includes(w))) : allFiles;
if (!files.length) { console.error(`✘ 인자 ${JSON.stringify(want)} 에 맞는 테스트 파일이 없다 (있는 파일: ${allFiles.join(', ')})`); process.exit(1); }
const chrome = findChrome();

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const f = url.searchParams.get('f');
      if (f !== null && !allFiles.includes(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': MIME['.html'] });
      return res.end(testPage(f));
    }
    const f = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// 파일 하나를 새 브라우저(새 프로필)에서 돌린다 → { file, fail } (돌리지 못함 — 이유) 또는 { file, results, vms }
async function runFile(file) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-test-'));
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=800,600', `--user-data-dir=${profile}`,   // 창 크기 고정: 1024px 이상이면 "팀 경기"가 대시보드로 열려 목록 테스트가 환경에 따라 달라지는 걸 막는다
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', `--virtual-time-budget=${BUDGET_MS}`, '--enable-logging=stderr', '--v=0',
    ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []), '--dump-dom', `http://127.0.0.1:${port}/?f=${encodeURIComponent(file)}`];
  const child = spawn(chrome, args);
  let out = '', err = '', killed = false;
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (err += d));
  child.on('error', () => {});
  const killer = setTimeout(() => { killed = true; child.kill(); }, WALL_MS);
  const code = await new Promise((r) => child.on('close', r));
  clearTimeout(killer);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}

  const m = out.match(/id="t-result" data-b64="([^"]+)"/);
  if (!m) {
    // 결과가 없는데 브라우저가 스스로 정상 종료(코드 0)했고 진행 표시가 있으면 → 가상 시간 예산이 먼저 바닥난 것(fail-closed)
    const tag = (out.match(/<pre id="t-progress"[^>]*>/) || [''])[0];
    const attr = (k) => { const a = tag.match(new RegExp(' data-' + k + '="([^"]*)"')); return a ? a[1] : null; };
    if (tag && code === 0 && !killed) {
      const at = Math.round(Number(attr('vms')) / 1000), cur = decodeURIComponent(attr('cur') || '');
      return { file, fail: `가상 시간 예산 초과 (예산 ${BUDGET_MS / 1000}s 를 다 썼다) — 마지막 진행 표시: 테스트 ${attr('done')}/${attr('total')}개를 끝낸 시점(가상 ${at}s)${cur ? ', 그때 시작한 테스트: ' + cur : ''}
    → 이 파일의 sleep 을 줄이거나 파일을 나누세요(BUDGET_MS 를 늘리기 전에). 한 테스트가 끝나지 않고 멈춘 경우엔 그 테스트를 확인` };
    }
    const log = err.split('\n').filter((l) => /CONSOLE/.test(l)).slice(-10).join('\n') || '(없음)';
    return { file, fail: `결과를 읽지 못했다(브라우저 종료 코드 ${code}${killed ? `, 실제 시간 ${WALL_MS / 1000}초 초과로 강제 종료` : ''}). 콘솔 로그:\n${log}` };
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')); } catch (e) { return { file, fail: '결과를 해석하지 못했다: ' + e.message }; }
  if (payload.fatal) return { file, fail: '하네스 오류: ' + payload.fatal };
  if (!Array.isArray(payload.results)) return { file, fail: '결과 형식이 올바르지 않다' };
  // 하네스 자체 점검(shared)만 있고 이 파일의 테스트가 하나도 없으면 — 파일이 로드되지 않았거나(문법 오류 등) 등록을 못 한 것
  if (!payload.results.some((r) => !r.shared)) return { file, fail: '등록된 테스트가 없다(파일이 로드되지 않았거나 문법 오류) — 콘솔: ' + (err.split('\n').filter((l) => /CONSOLE/.test(l)).slice(-3).join(' | ') || '(없음)') };
  return { file, results: payload.results, vms: payload.vms };
}

// 파일을 JOBS 개씩 동시에 돌린다(결과는 파일 순서로 모은다)
const jobs = Math.max(1, Number(process.env.JOBS) || Math.min(2, files.length));
const outcomes = new Array(files.length);
let next = 0;
await Promise.all(Array.from({ length: Math.min(jobs, files.length) }, async () => {
  while (next < files.length) { const i = next++; outcomes[i] = await runFile(files[i]); }
}));
server.close();

// ── 보고 ──
const sec = (ms) => Math.round(ms / 1000);
let passed = 0, failed = 0, broken = 0, sumVms = 0, maxVms = 0, maxFile = '';
const shared = new Map();   // 하네스 자체 점검: 이름 → 모든 파일 페이지의 결과를 합친 것(하나라도 실패하면 실패)
for (const o of outcomes) {
  if (o.fail) { broken++; console.log(`── ${o.file}  ✘ 실행하지 못함`); console.log('  ' + o.fail.split('\n').join('\n  ')); continue; }
  const own = o.results.filter((r) => !r.shared);
  console.log(`── ${o.file}  (${own.length}개 · 가상 시간 ${sec(o.vms)}s / 예산 ${BUDGET_MS / 1000}s)`);
  if (o.vms > BUDGET_MS * WARN_RATIO) console.log(`  ⚠ 예산의 ${Math.round(WARN_RATIO * 100)}% 를 넘었다 — 곧 예산 초과가 된다`);
  sumVms += o.vms;
  if (o.vms > maxVms) { maxVms = o.vms; maxFile = o.file; }
  for (const r of own) {
    if (r.ok) passed++; else failed++;
    console.log((r.ok ? '✔ ' : '✘ ') + r.name + (r.ok ? '' : '\n    → ' + r.err));
  }
  for (const r of o.results.filter((x) => x.shared)) {
    const s = shared.get(r.name) || { ok: true, errs: [] };
    if (!r.ok) { s.ok = false; s.errs.push(`[${o.file}] ${r.err}`); }
    shared.set(r.name, s);
  }
}
if (shared.size) {
  console.log(`── 하네스 공통 점검 (모든 파일 페이지에서 실행, 이름이 같으면 하나로 센다)`);
  for (const [name, s] of shared) {
    if (s.ok) passed++; else failed++;
    console.log((s.ok ? '✔ ' : '✘ ') + name + (s.ok ? '' : '\n    → ' + s.errs.join('\n    → ')));
  }
}
const ran = outcomes.filter((o) => !o.fail).length;
console.log(`\n${passed} 통과 / ${failed} 실패  (파일 ${ran}/${files.length}개 · 가상 시간 합계 ${sec(sumVms)}s · 파일별 최대 ${sec(maxVms)}s${maxFile ? ' (' + maxFile + ')' : ''} / 예산 ${BUDGET_MS / 1000}s = ${Math.round((100 * maxVms) / BUDGET_MS)}%)`);
if (broken) console.error(`✘ 실행하지 못한 파일 ${broken}개 — 위 이유를 확인하세요(통과 수에 들어가지 않는다)`);
process.exit(failed || broken ? 1 : 0);
