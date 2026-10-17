// Drive the scene to given taus and crop around the chasing fielder (or a fielder index) at high DPI.
import { createRequire } from 'module';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');
const [,, src, prefix, taus = '', scale = '4', who = 'chaser', half = '70'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: +scale }); p.setDefaultTimeout(240000);
const logs = []; p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 200)); }); p.on('pageerror', e => logs.push('PAGEERROR ' + String(e).slice(0, 300)));
await p.goto('file://' + src, { waitUntil: 'load' });
await p.waitForFunction(() => { const e = document.querySelector('spray-play'); return e && e.fielders; });
await p.evaluate(() => document.querySelector('spray-play').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(800);
const info = await p.evaluate(() => { const e = document.querySelector('spray-play'); e.visible = false; e.live.forEach(l => { l.disc.visible = false; l.halo.visible = false; }); e.live = []; e.t0 = 0; e.cycle = -1;
  const r = e.renderer.render.bind(e.renderer); e.renderer.render = () => {}; e.frame(0); e.renderer.render = r;
  return { d: e.target.d, Lend: 2.55 + 1.1 + e.target.d / 350, chaser: e.fielders.indexOf(e.chaser) }; });
console.log('INFO', JSON.stringify(info));
let last = 0;
for (const tau of taus.split(',').filter(Boolean).map(Number)) {
  const box = await p.evaluate(([tau, last, who, half]) => {
    const e = document.querySelector('spray-play'), r = e.renderer.render.bind(e.renderer); e.renderer.render = () => {};
    for (let ms = last * 1000; ms < tau * 1000; ms += 40) e.frame(ms); e.renderer.render = r; e.frame(tau * 1000);
    const F = who === 'chaser' ? e.chaser.F : e.fielders[+who].F, v = F.root.getWorldPosition(new e.T.Vector3());
    if (half > 200) {   // follow cam for inspection only: re-render this frame from near the fielder
      const c = e.camera.clone(); c.position.set(v.x + 9, v.y + 6, v.z + 14); c.lookAt(v.x, v.y + 2.6, v.z); e.renderer.render(e.scene, c);
      const R = e.getBoundingClientRect(); return { x: R.x + R.width / 2 - 260, y: R.y + R.height / 2 - 260, width: 520, height: 520, run: F.run };
    }
    v.y += 2.9; v.project(e.camera);
    const R = e.getBoundingClientRect(), x = R.x + (v.x + 1) / 2 * R.width, y = R.y + (1 - v.y) / 2 * R.height;
    return { x: Math.max(0, x - half), y: Math.max(0, y - half), width: 2 * half, height: 2 * half, run: F.run };
  }, [tau, last, who, +half]);
  last = tau;
  await p.screenshot({ path: `${prefix}_tau${tau}.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  console.log('tau', tau, 'run', box.run);
}
console.log(logs.slice(0, 6).join('\n') || 'no console errors'); await b.close();
