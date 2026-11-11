// 방문 수 보내기(js/analytics.js 끝 블록) 확인 — 브라우저 없이 node 로: node tests/visit-ping.mjs
//   github.io 에서 하루 한 번만 · localhost · 자동화 브라우저는 안 보냄 · 실패하면 다음에 다시
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert';
const code = fs.readFileSync(new URL('../js/analytics.js', import.meta.url), 'utf8');
async function run({ host, path = '/baseball-spray-chart/index.html', webdriver = false, coarse = true, store = {}, ok = true }) {
  const calls = []; const ls = { ...store };
  const ctx = {
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); } },
    crypto: { randomUUID: () => '0b1e4c3a-1d2e-4f5a-8b9c-0d1e2f3a4b5c' },
    document: { createElement: () => ({}), head: { appendChild() {} } },
    window: {}, location: { hostname: host, pathname: path, search: '' }, URLSearchParams,
    navigator: { webdriver }, matchMedia: () => ({ matches: coarse }),
    fetch: (u, o) => { calls.push({ u, o }); return Promise.resolve({ ok }); },
  };
  ctx.dataLayer = []; vm.runInNewContext(code, ctx); await new Promise(r => setTimeout(r, 10));
  return { calls, ls };
}
let r = await run({ host: 'kimjeongcheol13.github.io' });
assert.equal(r.calls.length, 1); const b = JSON.parse(r.calls[0].o.body);
assert.deepEqual(b, { p_uid: '0b1e4c3a-1d2e-4f5a-8b9c-0d1e2f3a4b5c', p_kind: 'am' });
assert.match(r.ls.sl_visit_day, /^\d{4}-\d{2}-\d{2}$/);
assert.equal((await run({ host: 'kimjeongcheol13.github.io', store: r.ls })).calls.length, 0, 'same day → no send');
assert.equal((await run({ host: 'localhost' })).calls.length, 0, 'localhost → no send');
assert.equal((await run({ host: 'kimjeongcheol13.github.io', webdriver: true })).calls.length, 0, 'webdriver → no send');
r = await run({ host: 'kimjeongcheol13.github.io', path: '/baseball-spray-chart/landing.html', coarse: false, ok: false });
assert.equal(JSON.parse(r.calls[0].o.body).p_kind, 'ld'); assert.equal(r.ls.sl_visit_day, undefined, 'failure → retry next time');
console.log('visit-check 6/6 OK');
