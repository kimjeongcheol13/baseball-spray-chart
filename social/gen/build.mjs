// 인스타 게시물 풀 만들기: social/gen/page.html 을 헤드리스 크롬으로 찍어 social/pool/ 에 JPEG·MP4, social/manifest.json 을 쓴다
//   node social/gen/build.mjs            → 전부
//   node social/gen/build.mjs c1 r2      → 고른 것만 (manifest 는 항상 전체로 다시 씀)
//   --fast                               → 릴스는 표지만 (영상 생략, 확인용)
// 필요: Chrome, ffmpeg (PATH)
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), POOL = join(HERE, '..', 'pool'), PAGE = pathToFileURL(join(HERE, 'page.html')).href;
const args = process.argv.slice(2), FAST = args.includes('--fast'), ONLY = args.filter(a => !a.startsWith('--'));
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const PORT = 9353, FPS = 30;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const prof = mkdtempSync(join(tmpdir(), 'slg-'));
const child = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', '--allow-file-access-from-files', 'about:blank']);

async function target() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) return r.json(); } catch (e) {}
    await sleep(200);
  }
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

async function open(c, q, w, h) {
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: PAGE + q });
  for (let i = 0; i < 100; i++) { await sleep(100); if (await c.ev("document.readyState === 'complete' && !!window.META").catch(() => false)) break; }
  await c.ev('document.fonts.ready.then(() => true)');
  await sleep(200);
}
const shot = async (c, w, h, fmt = 'jpeg') => Buffer.from((await c.send('Page.captureScreenshot', { format: fmt, quality: fmt === 'jpeg' ? 92 : undefined, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } })).data, 'base64');

try {
  mkdirSync(POOL, { recursive: true });
  const c = client((await target()).webSocketDebuggerUrl);
  await open(c, '?id=c1', 1080, 1350);
  const META = await c.ev('window.META');
  const out = [];
  for (const m of META) {
    const files = [], rec = { ...m };
    delete rec.n; delete rec.theme;
    if (m.format === 'reel') {
      await open(c, `?id=${m.id}`, 1080, 1920);
      const dur = await c.ev('window.DUR'), cover = await c.ev('window.COVER_T');
      rec.seconds = Math.round(dur * 10) / 10;
      rec.cover = `${m.id}_cover.jpg`;
      if (!ONLY.length || ONLY.includes(m.id)) {
        await c.ev(`window.seek(${cover})`); await sleep(80);
        writeFileSync(join(POOL, rec.cover), await shot(c, 1080, 1920));
        if (!FAST) {
          const dir = mkdtempSync(join(tmpdir(), 'slf-')), N = Math.round(dur * FPS);
          for (let f = 0; f < N; f++) { await c.ev(`window.seek(${f / FPS})`); writeFileSync(join(dir, String(f).padStart(5, '0') + '.jpg'), await shot(c, 1080, 1920)); }
          const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, '%05d.jpg'), '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', join(POOL, m.id + '.mp4')], { stdio: 'inherit' });
          rmSync(dir, { recursive: true, force: true });
          if (r.status !== 0) throw new Error('ffmpeg failed: ' + m.id);
        }
        console.log('reel', m.id, rec.seconds + 's');
      }
      files.push(`${m.id}.mp4`);
    } else {
      for (let s = 0; s < m.n; s++) {
        const name = `${m.id}_${s + 1}.jpg`;
        if (!ONLY.length || ONLY.includes(m.id)) { await open(c, `?id=${m.id}&s=${s}`, 1080, 1350); writeFileSync(join(POOL, name), await shot(c, 1080, 1350)); }
        files.push(name);
      }
      console.log(m.format, m.id, files.length + '장');
    }
    rec.files = files;
    out.push(rec);
  }
  writeFileSync(join(HERE, '..', 'manifest.json'), JSON.stringify({
    note: '인스타 자동 게시 풀. 순서대로 한 회차에 하나. 파일은 social/pool/ (raw.githubusercontent.com/kimjeongcheol13/baseball-spray-chart/main/social/pool/<파일>). 숫자는 전부 가상 데이터.',
    start: '2026-11-03', items: out,
  }, null, 2) + '\n');
  console.log('manifest', out.length, 'items');
  c.close();
} finally {
  child.kill();
}
