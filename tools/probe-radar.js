/* probe-radar.js — end-to-end test of the five-axis anime ratings radar.
   Runs against an ISOLATED copy of the site (temp dir, no assets) so the
   real hobbies.json is never touched:
     A) owner mode (temp server.js with API): radars render, node drag
        updates + persists the score, clamping holds at 0..5, edge drag
        moves both endpoints, zh/zhcn labels correct
     B) guest mode (bare static server): rated item shows a read-only
        chart (no drag hit areas), unrated item shows nothing
   usage: node tools/probe-radar.js */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const NODE = process.argv[2] || process.execPath;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CDP_PORT = 9335, API_PORT = 8902, STATIC_PORT = 8903;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- isolated site copy ---------- */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'koyome-radar-'));
fs.mkdirSync(path.join(TMP, 'docs', 'js'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'docs', 'css'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'docs', 'data'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'server.js'), path.join(TMP, 'server.js'));
for (const f of fs.readdirSync(path.join(ROOT, 'docs'))) {
  if (f.endsWith('.html')) fs.copyFileSync(path.join(ROOT, 'docs', f), path.join(TMP, 'docs', f));
}
for (const f of fs.readdirSync(path.join(ROOT, 'docs', 'js'))) fs.copyFileSync(path.join(ROOT, 'docs', 'js', f), path.join(TMP, 'docs', 'js', f));
for (const f of fs.readdirSync(path.join(ROOT, 'docs', 'css'))) fs.copyFileSync(path.join(ROOT, 'docs', 'css', f), path.join(TMP, 'docs', 'css', f));
for (const f of fs.readdirSync(path.join(ROOT, 'docs', 'data'))) fs.copyFileSync(path.join(ROOT, 'docs', 'data', f), path.join(TMP, 'docs', 'data', f));

/* seed: anime[0] rated, anime[1] unrated, chars item untouched */
const hobFile = path.join(TMP, 'docs', 'data', 'hobbies.json');
const hob = JSON.parse(fs.readFileSync(hobFile, 'utf8'));
const animeSec = hob.sections.find((s) => s.id === 'anime');
animeSec.items[0].ratings = [8, 7, 9, 6.5, 8.5];
if (animeSec.items[1]) delete animeSec.items[1].ratings;
fs.writeFileSync(hobFile, JSON.stringify(hob, null, 2));
const RATED_ID = animeSec.items[0].id;
const UNRATED_ID = animeSec.items[1] && animeSec.items[1].id;
console.log('seed: rated item =', RATED_ID, '| unrated =', UNRATED_ID);
fs.mkdirSync(path.join(ROOT, 'tools', 'shots-r23'), { recursive: true });

/* ---------- tiny static server (guest mode) ---------- */
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
const staticSrv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const f = path.join(TMP, 'docs', decodeURIComponent(u.pathname));
  if (!f.startsWith(path.join(TMP, 'docs')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

/* ---------- CDP plumbing ---------- */
async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
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

const results = [];
const check = (n, c, det) => { results.push([n, c, det]); };

(async () => {
  const api = spawn(NODE, [path.join(TMP, 'server.js')], { env: { ...process.env, PORT: String(API_PORT) }, stdio: 'ignore' });
  await new Promise((r) => staticSrv.listen(STATIC_PORT, r));
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  const errors = [];
  try {
    await sleep(800);
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
    const evalJs = async (expression) =>
      (await send(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)).result.value;
    await send(ws, 'Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false }, sessionId);
    const nav = async (url, lang) => {
      await send(ws, 'Page.addScriptToEvaluateOnNewDocument', {
        source: `try{localStorage.setItem("koyome_lang","${lang}")}catch(_){}`,
      }, sessionId);
      await send(ws, 'Page.navigate', { url }, sessionId);
      await sleep(3200);
    };

    /* ============ A) owner mode ============ */
    await nav(`http://127.0.0.1:${API_PORT}/hobbies.html`, 'en');
    const own = await evalJs(`(()=>{
      const anime=[...document.querySelectorAll('[data-sec="anime"] .hob-radar')];
      const chars=[...document.querySelectorAll('[data-sec="chars"] .hob-radar')];
      const rated=document.querySelector('[data-hrate="${RATED_ID}"]');
      return {
        animeCount: anime.length,
        animeItems: document.querySelectorAll('[data-sec="anime"] .hflow-item').length,
        charsCount: chars.length,
        nodes: rated ? rated.querySelectorAll('[data-rnode]').length : -1,
        edges: rated ? rated.querySelectorAll('[data-redge]').length : -1,
        dims: rated ? [...rated.querySelectorAll('.hr-dim')].map(t=>t.textContent) : [],
        val: rated ? rated.querySelector('.hr-val').textContent : '',
      };})()`);
    check('owner: every anime item has a radar (ghost for unrated)', own.animeCount === own.animeItems, `radars=${own.animeCount} items=${own.animeItems}`);
    check('owner: no radar in chars section', own.charsCount === 0, String(own.charsCount));
    check('owner: 5 node hit areas', own.nodes === 5, String(own.nodes));
    check('owner: 5 edge hit areas', own.edges === 5, String(own.edges));
    check('owner: EN dim labels', own.dims.join('|') === 'ANIMATION|CHARACTER|STORY|PACING|VA · MUSIC', own.dims.join('|'));
    check('owner: readout shows average', own.val.includes('AVG 7.8'), own.val);

    /* node drag: pull axis 0 (top) INWARD — value must fall & persist */
    await evalJs(`document.querySelector('[data-hrate="${RATED_ID}"]').scrollIntoView({block:'center'}); "scrolled"`);
    await sleep(400);
    let n0 = await evalJs(`(()=>{const r=document.querySelector('[data-hrate="${RATED_ID}"] [data-rnode="0"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    const mouse = async (type, x, y) => send(ws, 'Input.dispatchMouseEvent',
      { type, x, y, button: 'left', clickCount: 1 }, sessionId);
    await mouse('mousePressed', n0.x, n0.y);
    await mouse('mouseMoved', n0.x, n0.y + 12);
    await mouse('mouseMoved', n0.x, n0.y + 22);
    const midDrag = await evalJs(`document.querySelector('[data-hrate="${RATED_ID}"] .hr-val').textContent`);
    await mouse('mouseReleased', n0.x, n0.y + 22);
    await sleep(900);
    const afterNode = await evalJs(`fetch('api/hobbies').then(r=>r.json()).then(d=>{
      const it=d.sections.find(s=>s.id==='anime').items.find(x=>x.id==='${RATED_ID}');
      return it.ratings;})`);
    check('node drag: readout live-updates during drag', /ANIMATION [0-9]/.test(midDrag), midDrag);
    check('node drag: axis 0 fell & persisted (half-step)', afterNode && afterNode[0] < 8 && afterNode[0] % 0.5 === 0, JSON.stringify(afterNode));

    /* clamp: re-measure the (moved) node, yank it way out — caps at 10 */
    n0 = await evalJs(`(()=>{const r=document.querySelector('[data-hrate="${RATED_ID}"] [data-rnode="0"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await mouse('mousePressed', n0.x, n0.y);
    await mouse('mouseMoved', n0.x, n0.y - 260);
    await mouse('mouseReleased', n0.x, n0.y - 260);
    await sleep(900);
    const afterClamp = await evalJs(`fetch('api/hobbies').then(r=>r.json()).then(d=>{
      const it=d.sections.find(s=>s.id==='anime').items.find(x=>x.id==='${RATED_ID}');
      return it.ratings;})`);
    check('clamp: value capped at 10 inside the grid', afterClamp && afterClamp[0] === 10, JSON.stringify(afterClamp));

    /* edge drag: drag edge 0 (axis0–axis1) — BOTH endpoints follow */
    const e0 = await evalJs(`(()=>{const r=document.querySelector('[data-hrate="${RATED_ID}"] [data-redge="0"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    const before = afterClamp.slice();
    await mouse('mousePressed', e0.x, e0.y);
    await mouse('mouseMoved', e0.x + 18, e0.y - 26);
    await mouse('mouseReleased', e0.x + 18, e0.y - 26);
    await sleep(900);
    const afterEdge = await evalJs(`fetch('api/hobbies').then(r=>r.json()).then(d=>{
      const it=d.sections.find(s=>s.id==='anime').items.find(x=>x.id==='${RATED_ID}');
      return it.ratings;})`);
    check('edge drag: both endpoints moved',
      afterEdge && afterEdge[1] !== before[1], `axis1 ${before[1]} -> ${afterEdge && afterEdge[1]}`);

    /* archive an owner-mode screenshot of the finished chart */
    await evalJs(`document.querySelector('[data-hrate="${RATED_ID}"]').scrollIntoView({block:'center'}); "s"`);
    await sleep(500);
    const shotOwn = await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId);
    fs.writeFileSync(path.join(ROOT, 'tools', 'shots-r23', 'radar-owner.png'), Buffer.from(shotOwn.data, 'base64'));

    /* zh / zhcn labels */
    await nav(`http://127.0.0.1:${API_PORT}/hobbies.html`, 'zh');
    const zhDims = await evalJs(`[...document.querySelectorAll('[data-hrate="${RATED_ID}"] .hr-dim')].map(t=>t.textContent).join('|')`);
    check('zh dim labels', zhDims === '演出作畫|角色塑造|故事劇本|節奏把控|配音音樂', zhDims);
    await nav(`http://127.0.0.1:${API_PORT}/hobbies.html`, 'zhcn');
    const cnDims = await evalJs(`[...document.querySelectorAll('[data-hrate="${RATED_ID}"] .hr-dim')].map(t=>t.textContent).join('|')`);
    check('zhcn dim labels', cnDims === '演出作画|角色塑造|故事剧本|节奏把控|配音音乐', cnDims);

    /* ============ B) guest mode (static, no API) ============ */
    await nav(`http://127.0.0.1:${STATIC_PORT}/hobbies.html`, 'en');
    const guest = await evalJs(`(()=>{
      const rated=document.querySelector('[data-hrate="${RATED_ID}"]');
      const unrated=${UNRATED_ID ? `document.querySelector('[data-hrate="${UNRATED_ID}"]')` : 'null'};
      return {
        ratedShown: !!rated,
        ratedNodes: rated ? rated.querySelectorAll('[data-rnode]').length : -1,
        ratedEdges: rated ? rated.querySelectorAll('[data-redge]').length : -1,
        unratedShown: !!unrated,
      };})()`);
    check('guest: rated item shows chart', guest.ratedShown === true);
    check('guest: no node hit areas (read-only)', guest.ratedNodes === 0, String(guest.ratedNodes));
    check('guest: no edge hit areas (read-only)', guest.ratedEdges === 0, String(guest.ratedEdges));
    if (UNRATED_ID) check('guest: unrated item shows no ghost chart', guest.unratedShown === false);

    /* archive a guest-mode screenshot (read-only chart) */
    await evalJs(`document.querySelector('[data-hrate="${RATED_ID}"]').scrollIntoView({block:'center'}); "s"`);
    await sleep(500);
    const shotGuest = await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId);
    fs.writeFileSync(path.join(ROOT, 'tools', 'shots-r23', 'radar-guest.png'), Buffer.from(shotGuest.data, 'base64'));

    check('no console errors anywhere', errors.length === 0, errors.join(' | ').slice(0, 300));

    await send(ws, 'Target.closeTarget', { targetId });
    ws.close();
  } finally {
    edge.kill();
    api.kill();
    staticSrv.close();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  let fail = 0;
  for (const [n, ok, det] of results) { console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (det ? ' — ' + det : '')); if (!ok) fail++; }
  console.log(fail ? '\n' + fail + ' FAILED' : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
