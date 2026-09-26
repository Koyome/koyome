/* probe-k3d.js — audit the CSS 3D model set in headless Edge: geometry lands
   where the maths says, motion runs, reduced motion freezes it, frame pacing
   stays smooth.  usage: node tools/probe-k3d.js                */
const { spawn } = require('child_process');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9381;
const PAGE = 'file:///C:/Users/Public/koyome-site/tools/k3d-preview.html';
let id = 0;
function send(ws, m, p = {}, s) {
  return new Promise((res, rej) => {
    const i = ++id;
    const on = (ev) => {
      const x = JSON.parse(ev.data);
      if (x.id === i) { ws.removeEventListener('message', on); x.error ? rej(new Error(m + ': ' + x.error.message)) : res(x.result); }
    };
    ws.addEventListener('message', on);
    ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s }));
  });
}

(async () => {
  const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--disable-extensions', '--allow-file-access-from-files',
    'about:blank'], { stdio: 'ignore' });
  let bad = 0;
  try {
    let wsUrl;
    for (let i = 0; i < 40; i++) {
      try { wsUrl = (await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json()).webSocketDebuggerUrl; break; }
      catch { await sleep(300); }
    }
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => (ws.onopen = r));
    const errs = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
        errs.push(m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 160));
      if (m.method === 'Runtime.exceptionThrown')
        errs.push('EXC ' + ((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text || '').slice(0, 200));
    });
    const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
    await send(ws, 'Runtime.enable', {}, sessionId);
    await send(ws, 'Page.enable', {}, sessionId);

    const load = async () => {
      await send(ws, 'Page.navigate', { url: PAGE }, sessionId);
      await sleep(2200);
    };
    await load();
    console.log('console errors:', errs.length ? errs : 'none');
    if (errs.length) bad++;

    /* ---- geometry: baked matrices must place facets on the real solid ---- */
    const geo = await send(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const els = [...document.querySelectorAll('.k3d--crystal .k3d-scene > i')];
        const rs = els.map((e) => {
          const m = getComputedStyle(e).transform.match(/matrix3d\\(([^)]+)\\)/);
          if (!m) return null;
          const v = m[1].split(',').map(Number);
          return { r: Math.hypot(v[12], v[13], v[14]), det: Math.abs(
              v[0]*(v[5]*v[10]-v[6]*v[9]) - v[4]*(v[1]*v[10]-v[2]*v[9]) + v[8]*(v[1]*v[6]-v[2]*v[5])) };
        });
        const ok = rs.filter(Boolean);
        return { n: els.length, parsed: ok.length,
                 rMin: Math.min(...ok.map(o => o.r)), rMax: Math.max(...ok.map(o => o.r)),
                 detMin: Math.min(...ok.map(o => o.det)),
                 uniq: new Set(ok.map(o => o.r.toFixed(2))).size };
      })()`,
      returnByValue: true,
    }, sessionId);
    const g = geo.result.value;
    /* translation column is facet vertex A, so every |A| must equal the circumradius */
    console.log(`geometry: ${g.n} facets, ${g.parsed} matrices parsed, vertex radius ${g.rMin.toFixed(2)}-${g.rMax.toFixed(2)} (want 118 ±0.05), min|det| ${g.detMin.toFixed(3)}`);
    if (g.n !== 20 || g.parsed !== 20 || g.rMax - g.rMin > 0.05
        || Math.abs(g.rMin - 118) > 0.05 || g.detMin < 0.01) {
      console.log('FAIL geometry'); bad++;
    } else console.log('ok   crystal facets sit exactly on the icosahedron');

    /* ---- motion + frame pacing ------------------------------------------ */
    const shot = async () => (await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId)).data;
    const a = await shot();
    await sleep(2200);
    const b = await shot();
    const moved = a !== b;
    console.log(`${moved ? 'ok  ' : 'FAIL'} 3D models animate (two frames 2.2s apart differ)`);
    if (!moved) bad++;

    const fps = await send(ws, 'Runtime.evaluate', {
      expression: `new Promise((res) => {let n = 0; const t0 = performance.now();
        const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
          else res(Math.round(1000 * n / (performance.now() - t0))); };
        requestAnimationFrame(tick); })`,
      awaitPromise: true, returnByValue: true,
    }, sessionId);
    const v = fps.result.value;
    console.log(`${v >= 50 ? 'ok  ' : 'WARN'} frame pacing: ~${v} fps while all four models turn (headless)`);

    /* ---- reduced motion -------------------------------------------------- */
    await send(ws, 'Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    }, sessionId);
    await load();
    const c = await shot();
    await sleep(2200);
    const d = await shot();
    const frozen = c === d;
    console.log(`${frozen ? 'ok  ' : 'FAIL'} frozen under prefers-reduced-motion`);
    if (!frozen) bad++;

    console.log(bad ? `\n${bad} check(s) flagged` : '\n3D set clean');
  } catch (e) {
    console.log('ERR', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e);
  } finally {
    edge.kill();
    process.exit(0);
  }
})();
