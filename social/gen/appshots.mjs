// 앱 화면 찍기: 샘플 모드(가짜 데이터)로 앱을 열어 화면 · 저장 이미지를 social/gen/shots/ 에 JPEG 로 남긴다 → page.html 의 폰 틀이 쓴다
//   node social/gen/appshots.mjs            → 전부
//   node social/gen/appshots.mjs bat pit    → 고른 것만
// 필요: Chrome, ffmpeg (PATH). 앱은 이 저장소를 그대로 띄운다 (빌드 없음)
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { readFile, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), OUT = join(HERE, 'shots');
const ONLY = process.argv.slice(2);
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const PORT = 9354, HTTP = 8734, W = 390, H = 844, DPR = 3;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 샘플 모드엔 투구 기록이 없다 → 이 창에서만 가짜 투구 26타석을 넣는다 (저장 안 함, 프로필도 버림)
const PSEED = `let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = (a, w) => { let t = r() * w.reduce((x, y) => x + y, 0); for (let i = 0; i < a.length; i++) { t -= w[i]; if (t <= 0) return a[i]; } return a[a.length - 1]; };
  const out = []; let id = 1;
  for (let pa = 0; pa < 26; pa++) {
    const batter = (pa % 9 + 1) + '번 타자', inning = (Math.floor(pa / 4) + 1) + '회초'; let b = 0, k = 0;
    for (;;) {
      const pt = pick(['직구', '슬라이더', '커브', '체인지업'], [52, 24, 12, 12]), inZ = r() < 0.55;
      const x = inZ ? 0.3 + r() * 0.4 : (r() < .5 ? 0.05 + r() * 0.2 : 0.75 + r() * 0.2), y = inZ ? 0.3 + r() * 0.4 : 0.1 + r() * 0.8;
      const P = { id: 'sd' + id++, inning, zone: null, zoneX: +x.toFixed(3), zoneY: +y.toFixed(3), pt, batter, ts: '' };
      const res = !inZ ? (r() < .8 ? '볼' : '헛스윙') : pick(['스트라이크', '헛스윙', '파울', 'inplay'], [30, 14, 26, 30]);
      if (res === '볼') { P.result = ++b === 4 ? '볼넷' : '볼'; out.push(P); if (b === 4) break; continue; }
      if (res === '파울') { if (k < 2) k++; P.result = '파울'; out.push(P); continue; }
      if (res !== 'inplay') { P.result = ++k === 3 ? '삼진' : res; out.push(P); if (k === 3) break; continue; }
      P.result = pick(['땅볼 아웃', '플라이 아웃', '라인드라이브 아웃', '안타', '2루타', '홈런'], [34, 26, 8, 22, 7, 3]); out.push(P); break;
    }
  }
  AS.pitchers = [{ id: 'sdp1', name: '예시 투수', num: '19', role: 'SP', pitches: out }]; AS.currentPitcher = AS.pitchers[0];
  setPitcherView('mode', 'stats'); setPitcherView('scope', 'game'); setPitcherView('sel', '예시 투수')`;

// 찍을 것: [이름, 열기 식, 종류] — 'view' = 화면 그대로 · 'tall' = 분석 화면을 아래 끝까지 한 장으로 · 'img' = 식이 돌려준 그림 주소(data:)를 그대로
const SHOTS = [
  ['rec', "shellNav('record')", 'view'],
  ['bat', "shellNav('analysis','batter')", 'tall'],
  ['pit', "shellNav('analysis','pitcher');" + PSEED, 'tall'],
  ['team', "shellNav('analysis','team')", 'tall'],
  ['scout', "shellNav('analysis','scout');await sleep(300);dismissScoutIntro()", 'tall'],
  ['pitrep', "shellNav('analysis','pitcher');" + PSEED + ";await sleep(800);window._downloadCanvas = cv => { window._img = cv.toDataURL('image/png'); };await savePitcherReport();return window._img", 'img'],
  ['report', 'showPostGameReport()', 'view'],
  ['goimport', 'openGameOneImport()', 'view'],
  ['settings', "shellNav('settings')", 'view'],
  ['order', "AS.home_lineup.forEach((p, i) => { p.pos = ['중견', '유격', '1루', '3루', '좌익', '2루', '포수', '우익', 'DH'][i] || ''; });openOrderSheet();await wait(() => (document.getElementById('osImg').src || '').startsWith('data:'));return document.getElementById('osImg').src", 'img'],
  ['sheet', "openScoresheet();await wait(() => document.querySelector('.rp.ss:not([hidden]) img[src^=\"data:\"]'));return document.querySelector('.rp.ss:not([hidden]) img[src^=\"data:\"]').src", 'img'],
  ['card', "exportShareCard();await sleep(1500);return document.getElementById('cardPreviewCanvas').toDataURL('image/png')", 'img'],
];

const srv = http.createServer((q, s) => {
  const p = join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  readFile(p, (e, b) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' }[extname(p)] || 'application/octet-stream' }); s.end(b); });
}).listen(HTTP);
const prof = mkdtempSync(join(tmpdir(), 'sla-'));
const child = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank']);

async function target() {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) return r.json(); } catch (e) {} await sleep(200); }
  throw new Error('chrome not up');
}
function client(url) {
  const ws = new WebSocket(url); let id = 0; const wait = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
  const ready = new Promise(r => (ws.onopen = r));
  const send = async (method, params = {}) => { await ready; const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); const d = await new Promise(r => wait.set(i, r)); if (d.error) throw new Error(method + ': ' + d.error.message); return d.result; };
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)); return r.result.value; };
  return { send, ev, close: () => ws.close() };
}
const loaded = async c => {
  for (let i = 0; i < 100; i++) { await sleep(150); if (await c.ev("document.readyState === 'complete' && typeof shellNav === 'function'").catch(() => false)) break; }
  await c.ev('document.fonts.ready.then(() => 1)'); await sleep(1500);
};
// 샘플 줄 · 알림을 감추고, 열기 식에서 쓸 wait · sleep 을 둔다
const PREP = `(() => { const b = document.getElementById('slSampleBar'); if (b) b.style.display = 'none';
  const st = document.createElement('style'); st.textContent = '.toast,#toast,.sl-toast{display:none!important}'; document.head.appendChild(st);
  window.sleep = ms => new Promise(r => setTimeout(r, ms));
  window.wait = async f => { for (let i = 0; i < 80 && !f(); i++) await sleep(100); };
  return 1; })()`;

try {
  mkdirSync(OUT, { recursive: true });
  const c = client((await target()).webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{sessionStorage.sl_in_app=1}catch(e){}' });
  await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
  const url = `http://127.0.0.1:${HTTP}/index.html?app=1`;
  await c.send('Page.navigate', { url }); await loaded(c);
  if (!(await c.ev('!!(window.slSample && slSample.isOn())'))) { await c.ev('setTimeout(() => slSample.enter(), 0), 1'); await sleep(1500); await loaded(c); }
  for (const [name, expr, kind] of SHOTS) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    await c.send('Page.navigate', { url }); await loaded(c);
    await c.ev(PREP);
    const got = await c.ev(`(async () => { ${expr}; })()`);
    await sleep(1400);
    if (process.env.DBG) console.log(await c.ev(process.env.DBG));
    let png;
    if (kind === 'img') png = Buffer.from(String(got).split(',')[1], 'base64');
    else {
      await c.ev('window.scrollTo(0, 0)');
      // 안쪽 스크롤 칸(.savant-view)이 있으면 그만큼 화면을 늘려 한 장에 담는다
      const h = kind === 'tall' ? Math.min(H + await c.ev("(v => v ? Math.max(0, v.scrollHeight - v.clientHeight) : 0)(document.querySelector('.savant-view.active'))"), 6000) : H;
      if (h > H) { await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: h, deviceScaleFactor: DPR, mobile: true }); await sleep(900); }
      png = Buffer.from((await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: W, height: h, scale: 1 } })).data, 'base64');
      if (h > H) await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
    }
    const tmp = join(prof, name + '.png'); writeFileSync(tmp, png);
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-q:v', '3', join(OUT, name + '.jpg')]);
    if (r.status !== 0) throw new Error('ffmpeg failed: ' + name);
    console.log('shot', name);
  }
  c.close();
} finally {
  child.kill(); srv.close();
  try { rmSync(prof, { recursive: true, force: true }); } catch (e) {}
}
