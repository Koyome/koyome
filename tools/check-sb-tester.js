/* check-sb-tester.js — did the jsdom test leak a StaticTester row into
   the real cloud guestbook? read-only probe. */
const fs = require('fs');
const cfg = fs.readFileSync('docs/js/gb-config.js', 'utf8');
const url = (cfg.match(/https:\/\/[^'"]+/) || [''])[0];
const key = (cfg.match(/sb_publishable_[A-Za-z0-9_-]+/) || [''])[0];
fetch(url + '/rest/v1/guestbook?select=id,name,text,created_at&order=id.desc&limit=10', {
  headers: { apikey: key, Authorization: 'Bearer ' + key },
})
  .then(async (r) => {
    console.log('HTTP', r.status);
    const rows = await r.json();
    rows.forEach((x) => console.log(x.id, '|', x.name, '|', String(x.text).slice(0, 40), '|', x.created_at));
    console.log('StaticTester present:', rows.some((x) => x.name === 'StaticTester'));
  })
  .catch((e) => console.log('FETCH FAIL', e.message));
