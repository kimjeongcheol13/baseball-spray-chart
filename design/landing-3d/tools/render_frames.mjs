import { createRequire } from 'module';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');
const [,, src, prefix, taus = '1.6,2.56', scale = '1', crop = '', pre = ''] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: +scale });
const logs = []; p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 200)); }); p.on('pageerror', e => logs.push('PAGEERROR ' + String(e).slice(0, 300)));
p.setDefaultTimeout(180000);
await p.goto('file://' + src, { waitUntil: 'load', timeout: 60000 });
await p.waitForFunction(() => { const e = document.querySelector('spray-play'); return e && e.batter && e.fielders; }, null, { timeout: 60000 });
await p.evaluate(() => document.querySelector('spray-play').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(800);
for (const tau of taus.split(',').map(Number)) {
  await p.evaluate(([tau, pre]) => {
    const e = document.querySelector('spray-play');
    e.visible = false;                 // freeze the live loop; we drive frame() ourselves
    e.live.forEach(l => { l.disc.visible = false; l.halo.visible = false; }); e.live = []; e.t0 = 0; e.cycle = -1;  // landing markers keep absolute timestamps; rewinding time would blow up their pop-in scale
    const r = e.renderer.render.bind(e.renderer); e.renderer.render = () => {}; for (let ms = 0; ms < tau * 1000; ms += 40) e.frame(ms); e.renderer.render = r; if (pre) (new Function('e', pre))(e); e.frame(tau * 1000);
  }, [tau, pre]);
  const box = await p.evaluate(() => { const r = document.querySelector('spray-play').getBoundingClientRect(); return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, 1440), height: Math.min(r.height, 900) }; });
  let clip = box; if (crop) { const [cx, cy, cw, ch] = crop.split(',').map(Number); clip = { x: box.x + cx, y: box.y + cy, width: cw, height: ch }; }
  await p.screenshot({ path: `${prefix}_tau${tau}.png`, clip, timeout: 180000 });
}
console.log(logs.join('\n') || 'no console errors'); await b.close();
