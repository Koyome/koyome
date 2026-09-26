/* probe-deco.js — rasterise the R24 decorative line-art SVGs in headless Edge
   and report ink coverage, accent share and bounding box, so the shapes can be
   sanity-checked without eyeballing them.
   usage: node tools/probe-deco.js   */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const TOOLS = path.join(ROOT, 'tools');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9351;
const PORT = 8917;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
               '.json': 'application/json', '.svg': 'image/svg+xml' };

const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = u.startsWith('/tools/') ? path.join(TOOLS, u.slice(7)) : path.join(DOCS, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await sleep(300); }
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

const shot = async (ws, sessionId) =>
  (await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId)).data;

async function motionSingle(ws, sessionId, base, name, reduce) {
  await send(ws, 'Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
  }, sessionId);
  await send(ws, 'Page.navigate', { url: `${base}/tools/_deco-motion.html?n=${name}` }, sessionId);
  await sleep(1800);
  const a = await shot(ws, sessionId);
  await sleep(2600);
  const b = await shot(ws, sessionId);
  return a !== b;
}

async function inlineMediaCheck(ws, sessionId, name, reduce) {
  await send(ws, 'Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }],
  }, sessionId);
  return (await send(ws, 'Runtime.evaluate', {
    expression: `(async () => {
        const t = await (await fetch('/assets/${name}.svg')).text();
        const host = document.createElement('div');
        host.innerHTML = t;
        document.body.appendChild(host);
        await new Promise((r) => setTimeout(r, 400));
        const el = host.querySelector('.k-term');
        return { reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
                 anim: getComputedStyle(el).animationName };
      })()`,
    awaitPromise: true, returnByValue: true,
  }, sessionId)).result.value;
}

async function motionAudit(ws, sessionId, base) {
  /* A deco referenced through <img> must animate; under prefers-reduced-motion
     it must freeze into the composed still. */
  return [
    { name: 'deco_armillary', moved: await motionSingle(ws, sessionId, base, 'deco_armillary', false) },
    { name: 'deco_phases', moved: await motionSingle(ws, sessionId, base, 'deco_phases', false) },
  ];
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${PORT}`;
  try {
    const ws = new WebSocket(await getWsUrl());
    await new Promise((r) => (ws.onopen = r));
    const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
    await send(ws, 'Page.enable', {}, sessionId);
    await send(ws, 'Runtime.enable', {}, sessionId);
    await send(ws, 'Page.navigate', { url: `http://127.0.0.1:${PORT}/tools/_deco-check.html` }, sessionId);
    await sleep(1600);
    const res = await send(ws, 'Runtime.evaluate',
      { expression: 'runCheck()', awaitPromise: true, returnByValue: true }, sessionId);
    const rows = (res.result.value || res.exceptionDetails ? res.result.value : []);
    let bad = 0;
    for (const r of rows) {
      if (r.error) { console.log('FAIL', r.name, r.error); bad++; continue; }
      const [x0, y0, x1, y1] = r.box;
      const issues = [];
      if (r.cov < 1) issues.push('almost empty');
      if (r.cov > 35) issues.push('too dense');
      if (x0 <= 0 || y0 <= 0 || x1 >= 399 || y1 >= 399) issues.push('touches edge');
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (Math.abs(cx - 200) > 26 || Math.abs(cy - 200) > 40) issues.push('off-centre');
      /* a shaded render shows many luminance/alpha steps; flat line art few */
      if (r.tones < 24) issues.push('少层次 tones=' + r.tones);
      if (issues.length) bad++;
      console.log(`${issues.length ? 'WARN' : 'ok  '} ${r.name.padEnd(22)} cover ${String(r.cov).padStart(5)}%  accent ${String(r.accentPct).padStart(5)}%  tones ${String(r.tones).padStart(4)}  box ${JSON.stringify(r.box)}${issues.length ? '  <- ' + issues.join(', ') : ''}`);
    }
    await send(ws, 'Emulation.setEmulatedMedia', { features: [] }, sessionId);
    console.log(bad ? `\n${bad} design(s) flagged` : '\nall designs within tolerance');

    /* the still row must read new -> full,递增，otherwise the mask machinery is wrong */
    const row = await send(ws, 'Runtime.evaluate',
      { expression: 'runPhases()', awaitPromise: true, returnByValue: true }, sessionId);
    const cov = row.result.value || [];
    let mono = cov.length === 9;
    for (let i = 1; i < cov.length; i++) if (cov[i] < cov[i - 1] - 0.4) mono = false;
    console.log(`${mono ? 'ok  ' : 'FAIL'} phases row new->full: ${JSON.stringify(cov)}`);
    if (!mono) bad++;

    console.log('\n-- motion (transform/opacity only, via <img>) --');
    for (const r of await motionAudit(ws, sessionId, base)) {
      console.log(`${r.moved ? 'ok  ' : 'FAIL'} ${r.name.padEnd(16)} animates inside <img>`);
      if (!r.moved) bad++;
    }
    /* does the internal media query actually work once the SVG is inlined? */
    console.log('\n-- prefers-reduced-motion inside the SVG document --');
    for (const reduce of [false, true]) {
      const r = await inlineMediaCheck(ws, sessionId, 'deco_phases', reduce);
      const want = reduce ? 'none' : 'koyo-mod';
      console.log(`${r.anim === want ? 'ok  ' : 'FAIL'} reduce=${String(reduce).padEnd(5)} host media=${r.reduce} computed animation-name=${r.anim}`);
      if (r.anim !== want) bad++;
    }

    /* the still variants must be frozen even though no media query can reach
       them - this is the fallback a reduced-motion visitor actually gets */
    console.log('\n-- baked still variants are frozen --');
    await send(ws, 'Emulation.setEmulatedMedia', { features: [] }, sessionId);
    for (const n of ['deco_armillary_still', 'deco_phases_still']) {
      const moved = await motionSingle(ws, sessionId, base, n, false);
      console.log(`${moved ? 'FAIL' : 'ok  '} ${n.padEnd(24)} no frame change over 2.6s`);
      if (moved) bad++;
    }
    if (bad) console.log(`\nTOTAL flagged: ${bad}`);
    if (res.exceptionDetails) console.log('EXC', JSON.stringify(res.exceptionDetails).slice(0, 400));
  } catch (e) {
    console.log('ERR', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e);
  } finally {
    edge.kill();
    srv.close();
    process.exit(0);
  }
})();
