/* verify-r11-live.js — poll GitHub Pages until round-11 changes are live */
const checks = [
  ['index compass defs', 'https://koyome.github.io/index.html', 'id="hhFace"'],
  ['css sigil vars', 'https://koyome.github.io/css/style.css', '--sigil-tri'],
  ['css orbit mobile', 'https://koyome.github.io/css/style.css', 'min(60vw, 250px)'],
  ['deco mobile filter', 'https://koyome.github.io/js/deco.js', "si === 0"],
  ['entry starfield perf', 'https://koyome.github.io/js/entry.js', 'dtDraw += dt'],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let round = 1; round <= 12; round++) {
    let allOk = true;
    for (const [name, url, needle] of checks) {
      try {
        const r = await fetch(url + '?_=' + Date.now(), { cache: 'no-store' });
        const t = await r.text();
        const ok = r.status === 200 && t.includes(needle);
        if (!ok) allOk = false;
        console.log(`round ${round} ${ok ? 'OK  ' : 'WAIT'} ${name} (HTTP ${r.status})`);
      } catch (e) {
        allOk = false;
        console.log(`round ${round} ERR  ${name}: ${e.message}`);
      }
    }
    if (allOk) { console.log('ALL LIVE'); return; }
    await sleep(15000);
  }
  console.log('TIMEOUT — not all checks live yet');
})();
