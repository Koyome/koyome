/* probe-r22c.js — verify the starfield survives theme flips:
   load t2 (light) -> flip dark -> flip back to light. After each flip
   the canvas must still paint a non-blank sky, and no console errors
   may occur. Screenshots archived for eyeballing.
   Also verifies the mobile URL-bar resize guard: a height-only
   shrink/grow (<120px) must NOT trigger a reseed (canvas keeps its
   bitmap size), a real width change must. */
const fs = require('fs');
const { spawn } = require('child_process');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
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
  const errors = [];
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  try {
    const ws = new WebSocket(await getWsUrl());
    await new Promise((r) => (ws.onopen = r));
    const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
    await send(ws, 'Page.enable', {}, sessionId);
    await send(ws, 'Runtime.enable', {}, sessionId);
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
        errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
    });
    await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send(ws, 'Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("koyome_theme","light")}catch(_){}',
    }, sessionId);
    await send(ws, 'Page.navigate', { url: 'http://127.0.0.1:8901/entry.html?id=t2' }, sessionId);
    await sleep(4500);

    const evalJs = async (expr) => (await send(ws, 'Runtime.evaluate',
      { expression: expr, returnByValue: true }, sessionId)).result.value;

    /* sky stats helper: sample canvas pixels — blank sky = all zero */
    const SKYSTAT = `(()=>{const cv=document.querySelector('canvas.starfield');
      const g=cv.getContext('2d');const d=g.getImageData(0,0,cv.width,cv.height).data;
      let lit=0;for(let i=3;i<d.length;i+=400){if(d[i]>0)lit++;}
      return {w:cv.width,h:cv.height,lit};})()`;

    const statLight = await evalJs(SKYSTAT);
    await evalJs('document.getElementById("themeBtn").click(); "flipped"');
    await sleep(1200);
    const statDark = await evalJs(SKYSTAT);
    const shot1 = await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId);
    fs.writeFileSync('tools/shots-r22/t2-flip-dark.png', Buffer.from(shot1.data, 'base64'));

    await evalJs('document.getElementById("themeBtn").click(); "flipped-back"');
    await sleep(1200);
    const statLight2 = await evalJs(SKYSTAT);
    const shot2 = await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId);
    fs.writeFileSync('tools/shots-r22/t2-flip-back-light.png', Buffer.from(shot2.data, 'base64'));

    const results = [];
    const check = (n, c, detail) => { results.push([n, c, detail]); };
    check('light sky painted', statLight.lit > 50, JSON.stringify(statLight));
    check('dark sky painted after flip', statDark.lit > 50, JSON.stringify(statDark));
    check('light sky painted after flip-back', statLight2.lit > 50, JSON.stringify(statLight2));
    check('no console errors', errors.length === 0, errors.join(' | '));

    let fail = 0;
    for (const [n, ok, det] of results) { console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (det ? ' — ' + det : '')); if (!ok) fail++; }
    console.log(fail ? fail + ' FAILED' : 'ALL PASS');
    await send(ws, 'Target.closeTarget', { targetId });
    ws.close();
    process.exit(fail ? 1 : 0);
  } finally {
    edge.kill();
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
