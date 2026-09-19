/* tools/test-static.js — Simulate GitHub Pages:
   serve public/ with a PLAIN static file server (no /api/*),
   then render every page in jsdom (both languages) and verify
   content comes from data/*.json and admin falls back cleanly. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PUB = path.join(__dirname, '..', 'docs');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(PUB, p);
  /* no API here — anything under /api/ 404s, like GitHub Pages */
  if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const load = (base, u, lang) => JSDOM.fromURL(base + '/' + u, {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = (a, o) => fetch(new URL(a, base).toString(), o);
    try { w.localStorage.setItem('koyome_lang', lang); } catch (e) { }
  },
});

server.listen(8899, async () => {
  const BASE = 'http://127.0.0.1:8899';
  let failures = 0;
  const check = (label, cond, detail) => {
    console.log((cond ? 'PASS ' : 'FAIL ') + label + (detail ? ' — ' + detail : ''));
    if (!cond) failures++;
  };

  try {
    for (const lang of ['en', 'zh']) {
      /* home */
      let dom = await load(BASE, 'index.html', lang);
      await new Promise((r) => setTimeout(r, 1500));
      let d = dom.window.document;
      check(`home ${lang} name`, d.getElementById('homeName').textContent.includes('Koyome'), d.getElementById('homeName').textContent);
      check(`home ${lang} tagline`, (d.getElementById('homeTagline').textContent || '').length > 3, d.getElementById('homeTagline').textContent.slice(0, 30));
      check(`home ${lang} sigil`, d.querySelectorAll('.sigil-svg polygon').length === 2);
      dom.window.close();

      /* catalog */
      dom = await load(BASE, 'catalog.html', lang);
      await new Promise((r) => setTimeout(r, 1500));
      d = dom.window.document;
      const rows = d.querySelectorAll('.entry-row, .cat-group a, main a[href*="entry.html"]');
      check(`catalog ${lang} entries`, rows.length >= 4, rows.length + ' links');
      const catText = d.body.textContent;
      check(`catalog ${lang} categories localized`,
        lang === 'en' ? catText.includes('Essays') : catText.includes('隨筆'));
      dom.window.close();

      /* entry detail */
      dom = await load(BASE, 'entry.html?id=t1', lang);
      await new Promise((r) => setTimeout(r, 1500));
      d = dom.window.document;
      const h1 = d.querySelector('h1');
      check(`entry ${lang} title`, h1 && (lang === 'en' ? h1.textContent === 'Night Radio' : h1.textContent === '深夜電台'), h1 && h1.textContent);
      check(`entry ${lang} body`, d.body.textContent.includes(lang === 'en' ? 'lighthouse' : '燈塔'));
      dom.window.close();

      /* image entry: relative asset path must resolve */
      dom = await load(BASE, 'entry.html?id=i1', lang);
      await new Promise((r) => setTimeout(r, 1500));
      d = dom.window.document;
      const img = d.querySelector('.media-item img, img[src*="seed-01"]');
      check(`entry ${lang} image src relative`, img && !img.getAttribute('src').startsWith('/'), img && img.getAttribute('src'));
      dom.window.close();

      /* guestbook */
      dom = await load(BASE, 'guestbook.html', lang);
      await new Promise((r) => setTimeout(r, 1500));
      d = dom.window.document;
      check(`guestbook ${lang} list`, d.querySelectorAll('.gb-item').length >= 1, d.querySelectorAll('.gb-item').length + ' items');
      dom.window.close();

      /* admin renders library from baked json */
      dom = await load(BASE, 'admin.html', lang);
      await new Promise((r) => setTimeout(r, 1800));
      d = dom.window.document;
      check(`admin ${lang} library`, d.querySelectorAll('.admin-item').length >= 4, d.querySelectorAll('.admin-item').length + ' items');
      check(`admin ${lang} profile filled`, d.getElementById('pName').value === 'Koyome');
      dom.window.close();
    }

    /* guestbook POST fallback → localStorage, no error */
    const dom = await load(BASE, 'guestbook.html', 'en');
    await new Promise((r) => setTimeout(r, 1500));
    const d = dom.window.document;
    d.getElementById('gbName').value = 'StaticTester';
    d.getElementById('gbText').value = 'hello from static mode';
    d.getElementById('gbForm').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 1200));
    const names = [...d.querySelectorAll('.gb-name')].map((n) => n.textContent);
    check('guestbook static post', names.includes('StaticTester'), names.join(', '));
    check('guestbook static msg ok', d.getElementById('gbMsg').textContent.length > 0, d.getElementById('gbMsg').textContent);
    dom.window.close();
  } catch (e) {
    console.log('FAIL exception —', e.message);
    failures++;
  }

  server.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL STATIC-MODE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
});
