/* probe-anim.js — step every animation in the deco SVGs to explicit timestamps
   and audit the resulting transforms: no teleports, constant rate, closed loop.
   usage: node tools/probe-anim.js [design...]           */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const TOOLS = path.join(ROOT, 'tools');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9377;
const PORT = 8931;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { '.html': 'text/html', '.svg': 'image/svg+xml', '.js': 'text/javascript' };

const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = u.startsWith('/tools/') ? path.join(TOOLS, u.slice(7)) : path.join(DOCS, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function getWsUrl(port) {
  for (let i = 0; i < 40; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; }
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

/* ---- analysis ---------------------------------------------------------- */
function analyse(rec) {
  const pts = rec.samples.map((s) => ({ t: s.t, x: s.m[4], y: s.m[5], m: s.m, op: s.op }));
  const steps = [];
  for (let i = 1; i < pts.length; i++) {
    steps.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const sorted = steps.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const max = Math.max(...steps);
  /* rotation rate, for elements that rotate rather than translate */
  const ang = pts.map((p) => Math.atan2(p.m[1], p.m[0]) * 180 / Math.PI);
  const dAng = [];
  for (let i = 1; i < ang.length; i++) {
    let d = ang[i] - ang[i - 1];
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    dAng.push(d);
  }
  const dSorted = dAng.slice().sort((a, b) => a - b);
  const dMed = dSorted[Math.floor(dSorted.length / 2)] || 0;
  const dMax = Math.max(...dAng.map(Math.abs));
  const loopGap = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
  const opVals = pts.map((p) => p.op);
  return { median, max, ratio: median ? max / median : 0, dMed: +dMed.toFixed(3), dMax: +dMax.toFixed(3),
           loopGap: +loopGap.toFixed(2), opMin: Math.min(...opVals), opMax: Math.max(...opVals) };
}

(async () => {
  const targets = process.argv.slice(2).length ? process.argv.slice(2)
    : ['deco_armillary', 'deco_phases'];
  await new Promise((r) => srv.listen(PORT, r));
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  let bad = 0;
  try {
    const ws = new WebSocket(await getWsUrl(CDP_PORT));
    await new Promise((r) => (ws.onopen = r));
    const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
    await send(ws, 'Page.enable', {}, sessionId);
    await send(ws, 'Runtime.enable', {}, sessionId);
    await send(ws, 'Page.navigate', { url: `http://127.0.0.1:${PORT}/tools/_deco-anim.html` }, sessionId);
    await sleep(1500);
    for (const t of targets) {
      const res = await send(ws, 'Runtime.evaluate', {
        expression: `diag('${t}', 24)`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      const rep = res.result.value;
      if (!rep) { console.log(t, 'NO DATA', JSON.stringify(res).slice(0, 200)); bad++; continue; }
      console.log(`\n== ${rep.name} — ${rep.count} animated element(s)`);
      for (const rec of rep.data) {
        const a = analyse(rec);
        const issues = [];
        /* constant travel: no step may dominate the median by a wide margin */
        if (a.median > 0.15 && a.ratio > 2.4) issues.push(`位移跳变 ${a.max.toFixed(2)} vs 中位 ${a.median.toFixed(2)}`);
        if (Math.abs(a.dMed) > 0.05 && a.dMax > Math.abs(a.dMed) * 1.6 + 0.05)
          issues.push(`转角速率不均 ${a.dMax.toFixed(2)} vs ${a.dMed.toFixed(2)}`);
        if (a.loopGap > 0.6) issues.push(`首尾不闭合 ${a.loopGap}`);
        if (issues.length) bad++;
        console.log(` ${issues.length ? 'FAIL' : 'ok  '} ${rec.cls.replace(/\s+/g, ' ').padEnd(24)} T=${String(rec.dur).padStart(6)}ms  位移 中位${a.median.toFixed(2)}/峰值${a.max.toFixed(2)}  转角 ${a.dMed}/${a.dMax}  loopΔ${a.loopGap}  opacity ${a.opMin}-${a.opMax}${issues.length ? '  <- ' + issues.join('; ') : ''}`);
      }
    }
    console.log(bad ? `\n${bad} animated element(s) flagged` : '\nevery animated element is smooth and closed');
  } catch (e) {
    console.log('ERR', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e);
  } finally {
    edge.kill();
    srv.close();
    process.exit(0);
  }
})();
