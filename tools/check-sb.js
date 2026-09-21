/* check-sb.js — probe Supabase guestbook reachability (read-only) */
const fs = require('fs');
const cfg = fs.readFileSync('docs/js/gb-config.js', 'utf8');
const url = (cfg.match(/https:\/\/[^'"]+/) || [''])[0];
const key = (cfg.match(/sb_publishable_[A-Za-z0-9_-]+/) || [''])[0];
fetch(url + '/rest/v1/guestbook?select=id&limit=3', {
  headers: { apikey: key, Authorization: 'Bearer ' + key },
})
  .then(async (r) => {
    console.log('HTTP', r.status);
    console.log((await r.text()).slice(0, 300));
  })
  .catch((e) => console.log('FETCH FAIL', e.message));
