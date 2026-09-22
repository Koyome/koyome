/* verify-r13-live.js — poll GitHub Pages until round-13 changes are live */
const checks = [
  ['liftGroup', 'https://koyome.github.io/js/entry.js', 'liftGroup'],
  ['icon choices', 'https://koyome.github.io/js/entry.js', 'PIN_ICON_CHOICES'],
  ['sakura icon', 'https://koyome.github.io/js/entry.js', 'sakura'],
  ['css icon picker', 'https://koyome.github.io/css/style.css', '.tm-iconpick'],
  ['css count chip', 'https://koyome.github.io/css/style.css', '.tm-count-bg'],
  ['i18n picker label', 'https://koyome.github.io/js/i18n.js', 'tm_pin_icon'],
  ['hdeco rail', 'https://koyome.github.io/js/hobbies.js', 'slim vertical'],
  ['owner new track', 'https://koyome.github.io/data/content.json', '1790057351694'],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let round = 1; round <= 10; round++) {
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
