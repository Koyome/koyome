/* verify-r12-live.js — poll GitHub Pages until round-12 changes are live */
const checks = [
  ['entry deck renderer', 'https://koyome.github.io/js/entry.js', 'function renderDeck'],
  ['entry upin link', 'https://koyome.github.io/js/entry.js', 'function upinLink'],
  ['entry spot icons', 'https://koyome.github.io/js/entry.js', 'SPOT_ICONS'],
  ['css pin badge', 'https://koyome.github.io/css/style.css', '.tm-badge'],
  ['css deck', 'https://koyome.github.io/css/style.css', '.deck-card.deck-exit'],
  ['css no centre disc', 'https://koyome.github.io/css/style.css', 'R12: the solid label disc'],
  ['i18n deck hint', 'https://koyome.github.io/js/i18n.js', 'deck_hint'],
  ['hdeco tiers', 'https://koyome.github.io/js/hobbies.js', 'VW < 1400'],
  ['owner chibi d2', 'https://koyome.github.io/data/hobbies.json', '1790000924231_8A1F7EDBC6D90CFC195897B8792BE06B'],
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
