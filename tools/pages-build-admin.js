/* pages-build-admin.js — list recent Pages builds; optionally request a
   rebuild with: node tools/pages-build-admin.js rebuild */
const fs = require('fs');
const token = fs.readFileSync('tools/gh-token.txt', 'utf8').trim();
const H = {
  'User-Agent': 'koyome-tools',
  Accept: 'application/vnd.github+json',
  Authorization: 'Bearer ' + token,
};
const base = 'https://api.github.com/repos/Koyome/koyome.github.io/pages/builds';
(async () => {
  if (process.argv[2] === 'rebuild') {
    const r = await fetch(base, { method: 'POST', headers: H });
    console.log('rebuild HTTP', r.status);
    console.log((await r.text()).slice(0, 200));
    return;
  }
  const r = await fetch(base + '?per_page=10', { headers: H });
  const j = await r.json();
  (Array.isArray(j) ? j : [j]).forEach((b) =>
    console.log((b.commit || '').slice(0, 7), '|', b.status, '|', b.created_at,
      '|', (b.error && b.error.message) || ''));
})().catch((e) => console.log('FAIL', e.message));
