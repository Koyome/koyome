/* probe-deck.js — R12 interaction test: the i1 photo deck cycles on
   click (top → back), and a map pin lifts its print to the top. */
const { spawn } = require('child_process');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9335;
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
    const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
    await send(ws, 'Page.enable', {}, sessionId);
    await send(ws, 'Emulation.setDeviceMetricsOverride',
      { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send(ws, 'Page.navigate', { url: 'http://127.0.0.1:8899/entry.html?id=i1' }, sessionId);
    await sleep(4500);

    const evalJs = async (expr) =>
      (await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)).result.value;

    console.log('deck present:', await evalJs(`!!document.querySelector('.deck')`));
    console.log('cards:', await evalJs(`document.querySelectorAll('.deck-card').length`));
    console.log('count before:', await evalJs(`document.querySelector('[data-count]').textContent`));
    console.log('top caption before:', await evalJs(
      `document.querySelector('.deck-cap [data-captext]').textContent.slice(0, 30)`));

    /* click the pile → top print sinks to the back */
    await evalJs(`document.querySelector('.deck-pile').click()`);
    await sleep(1200);
    console.log('count after click:', await evalJs(`document.querySelector('[data-count]').textContent`));
    console.log('top caption after click:', await evalJs(
      `document.querySelector('.deck-cap [data-captext]').textContent.slice(0, 30)`));

    /* map pin → its print jumps to the top (SVG <g> has no .click() —
       dispatch a real bubbling MouseEvent instead) */
    const pinMi = await evalJs(`(document.querySelector('.tm-node')||{}).dataset ? document.querySelector('.tm-node').dataset.mi : 'NONE'`);
    console.log('first map pin links media:', pinMi);
    await evalJs(`document.querySelector('.tm-node').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(1200);
    console.log('count after pin click:', await evalJs(`document.querySelector('[data-count]').textContent`));
    console.log('pins total (tm-node):', await evalJs(`document.querySelectorAll('.tm-node').length`));
    console.log('badges:', await evalJs(`document.querySelectorAll('.tm-badge').length`),
      'icons:', await evalJs(`document.querySelectorAll('.tm-icon').length`),
      'north:', await evalJs(`document.querySelectorAll('.tm-north').length`),
      'scale:', await evalJs(`document.querySelectorAll('.tm-scale').length`));

    /* cycle all the way round — pile must return to the start */
    const n = await evalJs(`document.querySelectorAll('.deck-card').length`);
    for (let i = 0; i < n; i++) { await evalJs(`document.querySelector('.deck-pile').click()`); await sleep(950); }
    console.log('count after full loop:', await evalJs(`document.querySelector('[data-count]').textContent`));

    await send(ws, 'Target.closeTarget', { targetId });
    ws.close();
  } finally { edge.kill(); }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
