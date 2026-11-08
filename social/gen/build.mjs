// 인스타 게시물 풀 만들기: social/gen/page.html 을 헤드리스 크롬으로 찍어 social/pool/ 에 JPEG·MP4, social/manifest.json 을 쓴다
//   node social/gen/build.mjs            → 전부
//   node social/gen/build.mjs c1 r2      → 고른 것만 (manifest 는 항상 전체로 다시 씀)
//   --fast                               → 릴스는 표지만 (영상 생략, 확인용)
// 필요: Chrome, ffmpeg (PATH). 음성이 있는 릴스(says)는 edge-tts 7.3.1+ — 다른 것이 PATH 앞에 있으면 EDGE_TTS=<edge-tts 경로>
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), POOL = join(HERE, '..', 'pool'), PAGE = pathToFileURL(join(HERE, 'page.html')).href;
const args = process.argv.slice(2), FAST = args.includes('--fast'), ONLY = args.filter(a => !a.startsWith('--'));
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const PORT = 9353, FPS = 30, TTS = process.env.EDGE_TTS || 'edge-tts', VOICE = 'ko-KR-InJoonNeural';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 고른 것만 만들 때 안 만든 릴스는 음성 없이 길이를 재서 짧게 나온다(11-04 r1 40.4→30.4) → 전 manifest 의 길이를 그대로 쓴다
const MF = join(HERE, '..', 'manifest.json'), OLD = existsSync(MF) ? Object.fromEntries(JSON.parse(readFileSync(MF, 'utf8')).items.map(x => [x.id, x])) : {};

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
// 음성: 문장마다 mp3 → 길이(초)
function speak(dir, says, voice) {
  return says.map((t, i) => {
    const f = join(dir, `v${i}.mp3`);
    // 음성 서버가 가끔 응답을 안 준다(11-04 두 번 — 소켓 시간 초과) → 세 번까지
    let r; for (let k = 0; k < 3 && !(r && r.status === 0 && existsSync(f)); k++) r = spawnSync(TTS, ['--voice', voice || VOICE, '--rate=+8%', '--text', t, '--write-media', f], { encoding: 'utf8' });
    if (r.status !== 0 || !existsSync(f)) throw new Error('edge-tts failed: ' + t + ' ' + (r.stderr || r.error || '').toString().slice(-300));
    const d = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout;
    if (!(d > 0)) throw new Error('no audio: ' + t);
    return { f, d };
  });
}
// 가끔 headless Chrome 이 찍기 응답을 영영 안 준다(11-01 r1 162번째 장면에서 35분 멈춤) → 20초 넘으면 다시 찍는다
const shot = async (c, w, h, fmt = 'jpeg') => {
  for (let k = 0; k < 3; k++) {
    const r = await Promise.race([c.send('Page.captureScreenshot', { format: fmt, quality: fmt === 'jpeg' ? 92 : undefined, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } }), sleep(20000).then(() => null)]);
    if (r) return Buffer.from(r.data, 'base64');
    console.log('찍기 응답 없음 → 다시', k + 1);
  }
  throw new Error('captureScreenshot: 3번 다 응답 없음');
};

try {
  mkdirSync(POOL, { recursive: true });
  const c = client((await target()).webSocketDebuggerUrl);
  await open(c, '?id=c1', 1080, 1350);
  const META = await c.ev('window.META');
  const out = [];
  for (const m of META) {
    const files = [], rec = { ...m };
    delete rec.n; delete rec.theme; delete rec.voice; delete rec.off; if (!rec.says) delete rec.says;
    if (m.format === 'reel') {
      // 음성이 있으면 장면 길이 = 음성 길이 + 쉼 (첫 화면 2.6초 이상, 마지막 화면은 끝까지 보이게 +1.6초)
      const vdir = m.says && !FAST && (!ONLY.length || ONLY.includes(m.id)) ? mkdtempSync(join(tmpdir(), 'slv-')) : null;
      const voice = vdir ? speak(vdir, m.says, m.voice) : null;
      const durs = voice && voice.map((v, i) => +(i === 0 ? Math.max(2.6, v.d + .7) : i === voice.length - 1 ? v.d + 1.9 : Math.max(2.2, v.d + .55)).toFixed(2));
      await open(c, `?id=${m.id}${durs ? '&d=' + durs.join(',') : ''}`, 1080, 1920);
      const dur = await c.ev('window.DUR'), cover = await c.ev('window.COVER_T');
      rec.seconds = (ONLY.length && !ONLY.includes(m.id) && OLD[m.id]?.seconds) || Math.round(dur * 10) / 10;
      rec.cover = `${m.id}_cover.jpg`;
      if (!ONLY.length || ONLY.includes(m.id)) {
        await c.ev(`window.seek(${cover})`); await sleep(80);
        writeFileSync(join(POOL, rec.cover), await shot(c, 1080, 1920));
        if (!FAST) {
          const dir = mkdtempSync(join(tmpdir(), 'slf-')), N = Math.round(dur * FPS);
          for (let f = 0; f < N; f++) { await c.ev(`window.seek(${f / FPS})`); writeFileSync(join(dir, String(f).padStart(5, '0') + '.jpg'), await shot(c, 1080, 1920)); }
          // 음성: 장면이 시작하고 0.15초 뒤(첫 문장은 0.3초)에 문장을 하나씩 얹는다
          const at = [];
          if (voice) { const cues = await c.ev('window.CUES'); if (cues.length !== voice.length) throw new Error(`${m.id}: says ${voice.length} ≠ 구간 ${cues.length}`); cues.forEach((t, i) => at.push(Math.round((t + (i ? .15 : .3)) * 1000))); }
          const ain = voice ? voice.flatMap(v => ['-i', v.f]) : [];
          const mix = voice ? ['-filter_complex', voice.map((_, i) => `[${i + 1}]adelay=${at[i]}:all=1[a${i}]`).join(';') + ';' + voice.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${voice.length}:normalize=0,apad[a]`, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', '-shortest'] : [];
          const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, '%05d.jpg'), ...ain, ...mix, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', join(POOL, m.id + '.mp4')], { stdio: 'inherit' });
          rmSync(dir, { recursive: true, force: true });
          if (vdir) rmSync(vdir, { recursive: true, force: true });
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
    if (!m.off) out.push(rec);   // off: 파일만 남기고 게시 순서에서는 뺀다
  }
  const days = await c.ev('window.DAYS'), prereg = await c.ev('window.PREREG');
  for (const id of Object.values(days).flat()) if (!out.some(x => x.id === id)) throw new Error('날짜표에 없는 id: ' + id);
  writeFileSync(MF, JSON.stringify({
    note: '인스타 자동 게시 풀. days[오늘 KST 날짜] 의 id 를 적힌 순서대로 올린다(없으면 쉬는 날). prereg.weekdays(0 = 월 … 6 = 일)의 캐러셀 캡션에는 사전등록 줄을 넣는다. 파일은 social/pool/ (raw.githubusercontent.com/kimjeongcheol13/baseball-spray-chart/main/social/pool/<파일>). 숫자는 전부 가상 데이터, 단톡방 대화는 지어낸 상황극.',
    prereg, days, items: out,
  }, null, 2) + '\n');
  console.log('manifest', out.length, 'items');
  c.close();
} finally {
  child.kill();
}
