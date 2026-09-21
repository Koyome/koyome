/* shot-r11.js — R11 visual verification: drive headless Edge over CDP,
   screenshot pages at mobile/desktop sizes, light & dark themes.
   usage: node tools/shot-r11.js <outDir> <specJson>
   spec: [{url, theme:'light'|'dark', w, h, wait, name}] */
const fs = require('fs');
const { spawn } = require('child_process');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
const [outDir, specFile] = process.argv.slice(2);
const specs = JSON.parse(fs.readFileSync(specFile, 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      return j.webSocketDebuggerUrl;
    } catch { await sleep(300); }
  }
  throw new Error('edge CDP not reachable');
}

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
  const edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => (ws.onopen = r));

    for (const s of specs) {
      const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
      await send(ws, 'Page.enable', {}, sessionId);
      await send(ws, 'Emulation.setDeviceMetricsOverride',
        { width: s.w, height: s.h, deviceScaleFactor: 2, mobile: s.w < 700 }, sessionId);
      // preset theme before any page script runs
      await send(ws, 'Page.addScriptToEvaluateOnNewDocument', {
        source: `try{localStorage.setItem("koyome_theme","${s.theme}")}catch(_){}`,
      }, sessionId);
      await send(ws, 'Page.navigate', { url: s.url }, sessionId);
      await sleep(s.wait || 3500);
      if (s.scrollY) {
        await send(ws, 'Runtime.evaluate', { expression: `window.scrollTo(0, ${s.scrollY})` }, sessionId);
        await sleep(900);
      }
      const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId);
      fs.writeFileSync(`${outDir}/${s.name}.png`, Buffer.from(shot.data, 'base64'));
      console.log('OK', s.name);
      await send(ws, 'Target.closeTarget', { targetId });
    }
    ws.close();
  } finally {
    edge.kill();
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
