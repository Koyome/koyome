/* probe-smoke.js — load every page in headless Edge (light + dark, and the
   About page also under prefers-reduced-motion) and report any runtime
   error / uncaught exception / broken render.
   usage: node tools/probe-smoke.js [baseUrl]   (default: local site) */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9336;
const STATIC_PORT = 8904;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

const args = process.argv.slice(2);
let baseUrl = args[0];

const staticSrv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const f = path.join(ROOT, 'docs', decodeURIComponent(u.pathname));
  if (!f.startsWith(path.join(ROOT, 'docs')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(300); }
  }
  throw new Error('CDP unreachable');
}
let msgId = 0;
function send(ws, method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) { ws.removeEventListener('message', onMsg); m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const PAGES = [
  ['index.html', 'home'],
  ['catalog.html', 'catalog'],
  ['entry.html?id=t1', 'entry-t1'],
  ['entry.html?id=t2', 'entry-t2'],
  ['entry.html?id=i1', 'entry-i1'],
  ['entry.html?id=v1', 'entry-v1'],
  ['hobbies.html', 'hobbies'],
  ['guestbook.html', 'guestbook'],
  ['admin.html', 'admin'],
];

(async () => {
  await new Promise((r) => staticSrv.listen(STATIC_PORT, r));
  if (!baseUrl) {
    /* prefer the owner-mode local site if it is up, else the static copy */
    try { await fetch('http://Koyome.me/api/content'); baseUrl = 'http://Koyome.me'; }
    catch { baseUrl = `http://127.0.0.1:${STATIC_PORT}`; }
  }
  console.log('base:', baseUrl);
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  const rows = [];
  try {
    const ws = new WebSocket(await getWsUrl());
    await new Promise((r) => (ws.onopen = r));
    const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
    await send(ws, 'Page.enable', {}, sessionId);
    await send(ws, 'Runtime.enable', {}, sessionId);
    await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    let bucket = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') bucket.push('EXC: ' + (m.params.exceptionDetails.text || '') + ' ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || '').slice(0, 160));
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
        bucket.push('CONSOLE: ' + m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 160));
    });
    const evalJs = async (expression) =>
      (await send(ws, 'Runtime.evaluate', { expression, returnByValue: true }, sessionId)).result.value;

    for (const theme of ['light', 'dark']) {
      for (const [page, name] of PAGES) {
        bucket = [];
        await send(ws, 'Page.addScriptToEvaluateOnNewDocument',
          { source: `try{localStorage.setItem("koyome_theme","${theme}")}catch(_){}` }, sessionId);
        await send(ws, 'Page.navigate', { url: baseUrl + '/' + page }, sessionId);
        await sleep(2600);
        const info = await evalJs(`({
          header: !!document.querySelector('.site-header'),
          nav: document.querySelectorAll('.site-header a, .site-header button').length,
          bodyLen: document.body.textContent.trim().length,
          theme: document.documentElement.dataset.theme
        })`);
        rows.push({ name, theme, errors: bucket.slice(), info });
      }
    }
    /* reduced-motion pass on the About page + a theme flip there */
    bucket = [];
    await send(ws, 'Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);
    await send(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("koyome_theme","light")}catch(_){}' }, sessionId);
    await send(ws, 'Page.navigate', { url: baseUrl + '/entry.html?id=t2' }, sessionId);
    await sleep(2800);
    const hasSky = await evalJs(`!!document.querySelector('canvas.starfield')`);
    await evalJs(`document.getElementById('themeBtn').click(); "flipped"`);
    await sleep(1200);
    const skyLit = await evalJs(`(()=>{const cv=document.querySelector('canvas.starfield');const g=cv.getContext('2d');
      const d=g.getImageData(0,0,cv.width,Math.min(400,cv.height)).data;let lit=0;
      for(let i=3;i<d.length;i+=400){if(d[i]>0)lit++;}return lit;})()`);
    rows.push({ name: 'entry-t2', theme: 'RM-flip', errors: bucket.slice(), info: { hasSky, skyLit, note: 'reduced motion, sky repainted after flip' } });
    await send(ws, 'Target.closeTarget', { targetId });
    ws.close();
  } finally {
    edge.kill();
    staticSrv.close();
  }
  let fail = 0;
  for (const r of rows) {
    const ok = r.errors.length === 0;
    console.log((ok ? 'OK   ' : 'ERR  ') + r.theme + ' ' + r.name + ' | ' + JSON.stringify(r.info) + (ok ? '' : '\n     ' + r.errors.join('\n     ')));
    if (!ok) fail++;
  }
  console.log(fail ? '\n' + fail + ' PAGES REPORTED ERRORS' : '\nNO RUNTIME ERRORS');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
