/* probe-hdeco.js — measure hdeco slot screen position at two scroll
   offsets to determine whether position:fixed actually holds. */
const { spawn } = require('child_process');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let msgId = 0;
function send(ws, method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) {
        ws.removeEventListener('message', onMsg);
        m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
(async () => {
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  try {
    let wsUrl;
    for (let i = 0; i < 30 && !wsUrl; i++) {
      try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; }
      catch { await sleep(300); }
    }
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => (ws.onopen = r));
    for (const w of [1440, 390]) {
      const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
      await send(ws, 'Page.enable', {}, sessionId);
      await send(ws, 'Emulation.setDeviceMetricsOverride',
        { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 700 }, sessionId);
      await send(ws, 'Page.navigate', { url: 'http://127.0.0.1:8899/hobbies.html' }, sessionId);
      await sleep(4000);
      const expr = `(() => {
        const s = document.querySelector('.hdeco-slot.filled') || document.querySelector('.hdeco-slot');
        if (!s) return 'NO SLOT';
        const cs = getComputedStyle(s);
        const a = s.getBoundingClientRect();
        window.scrollTo(0, 1200);
        const b = s.getBoundingClientRect();
        window.scrollTo(0, 0);
        return JSON.stringify({ position: cs.position, before: { x: Math.round(a.x), y: Math.round(a.y) },
          afterScroll1200: { x: Math.round(b.x), y: Math.round(b.y) } });
      })()`;
      const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
      console.log(`viewport ${w}:`, r.result.value);
      await send(ws, 'Target.closeTarget', { targetId });
    }
    ws.close();
  } finally { edge.kill(); }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
