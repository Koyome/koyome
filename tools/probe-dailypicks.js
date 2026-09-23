/* probe-dailypicks.js — load the real homepage in jsdom (static mode, like
   GitHub Pages), mock the date, and print TODAY'S PICKS for several days.
   Verifies: pool covers all sections, picks vary day to day. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PUB = path.join(__dirname, '..', 'docs');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/js/gb-config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end('window.GB_CLOUD = { url: "", anonKey: "" };');
    return;
  }
  const file = path.join(PUB, p);
  if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const RealDate = Date;
function fakeDate(y, m, d) {
  return class extends RealDate {
    constructor(...a) {
      if (a.length === 0) super(y, m - 1, d, 12, 0, 0);
      else super(...a);
    }
    static now() { return new RealDate(y, m - 1, d, 12, 0, 0).getTime(); }
  };
}

const load = (base, y, m, d) => JSDOM.fromURL(base + '/index.html', {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(w) {
    w.fetch = (a, o) => fetch(new URL(a, base).toString(), o);
    w.Date = fakeDate(y, m, d);
  },
});

server.listen(8891, async () => {
  const BASE = 'http://127.0.0.1:8891';
  const days = [[2026, 9, 23], [2026, 9, 24], [2026, 9, 25], [2026, 9, 26], [2026, 9, 27], [2026, 9, 28], [2026, 9, 29], [2026, 9, 30]];
  for (const [y, m, d] of days) {
    const dom = await load(BASE, y, m, d);
    await new Promise((r) => setTimeout(r, 1800));
    const doc = dom.window.document;
    const cards = [...doc.querySelectorAll('.hh-card')];
    const names = cards.map((c) => {
      const img = c.querySelector('img');
      return (img ? (img.getAttribute('src') || '').split('/').pop().slice(0, 18) : '?');
    });
    const daily = doc.getElementById('hhDaily');
    console.log(`${y}-${m}-${d}: ${cards.length} cards, daily label ${daily && !daily.hidden ? 'shown' : 'HIDDEN'}`);
    console.log('   ' + names.join(' | '));
    dom.window.close();
  }
  server.close();
  process.exit(0);
});
