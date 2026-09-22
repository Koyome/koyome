/* check-pages-build.js — GitHub Pages latest build status (token from
   tools/gh-token.txt, never printed) */
const fs = require('fs');
const token = fs.readFileSync('tools/gh-token.txt', 'utf8').trim();
fetch('https://api.github.com/repos/Koyome/koyome.github.io/pages/builds?per_page=3', {
  headers: {
    'User-Agent': 'koyome-tools',
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + token,
  },
})
  .then(async (r) => {
    console.log('HTTP', r.status);
    const j = await r.json();
    (Array.isArray(j) ? j : [j]).forEach((b) =>
      console.log('status:', b.status, '| commit:', (b.commit || '').slice(0, 7),
        '| created:', b.created_at, '| updated:', b.updated_at,
        '| error:', b.error && b.error.message));
  })
  .catch((e) => console.log('FETCH FAIL', e.message));
