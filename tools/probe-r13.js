/* probe-r13.js — R13 interaction test: (a) pin name-card shows the
   landmark icon picker; (b) a multi-photo pin lifts its whole place
   to the deck's top layers and pages through it. */
const { spawn } = require('child_process');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9336;
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
    const evalJs = async (expr) => {
      const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
      if (r.exceptionDetails) return 'JSERR ' + (r.exceptionDetails.exception || {}).description;
      return r.result.value;
    };

    /* (a) icon picker: owner clicks bare map → name-card with picker */
    console.log('== icon picker ==');
    await evalJs(`document.querySelector('svg[data-map="jeju"]').dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 500, clientY: 400 }))`);
    await sleep(600);
    console.log('picker buttons:', await evalJs(`document.querySelectorAll('.tm-iconpick button').length`));
    console.log('picker icons:', await evalJs(
      `[...document.querySelectorAll('.tm-iconpick button')].map(b=>b.dataset.icon).join(',')`));
    await evalJs(`(document.querySelector('.tm-iconpick button[data-icon="torii"]')||{click(){}}).click()`);
    console.log('torii selected:', await evalJs(
      `(document.querySelector('.tm-iconpick button[data-icon="torii"]')||{}).className`));
    await evalJs(`(document.querySelector('.tm-pinform [data-no]')||{click(){}}).click()`);   /* cancel, no data written */

    /* (b) multi-photo pin paging */
    console.log('== multi-photo pins ==');
    console.log('pins with data-mis:', await evalJs(
      `[...document.querySelectorAll('[data-mis]')].map(n=>n.dataset.mis).join(' | ')`));
    const multi = await evalJs(`(() => {
      const n = [...document.querySelectorAll('[data-mis]')].find(x => x.dataset.mis.includes(','));
      return n ? n.dataset.mis : '';
    })()`);
    console.log('first multi-photo pin owns media:', multi || '(none with >1)');
    if (multi) {
      const clicks = multi.split(',').length + 1;
      for (let i = 0; i < clicks; i++) {
        await evalJs(`(() => {
          const n = [...document.querySelectorAll('[data-mis]')].find(x => x.dataset.mis.includes(','));
          n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        })()`);
        await sleep(700);
        const info = await evalJs(`(() => {
          const top = document.querySelector('.deck-card.deck-top');
          return document.querySelector('[data-count]').textContent + ' topMi=' + top.dataset.mi;
        })()`);
        console.log(`after click ${i + 1}:`, info);
      }
    }
    await send(ws, 'Target.closeTarget', { targetId });
    ws.close();
  } finally { edge.kill(); }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
