/* Real-DOM render test: loads each page from the running dev server in a
   browser-like environment (jsdom), lets the site's own scripts run, then
   reports what a visitor actually sees — in English and in 繁體中文. */
const { JSDOM } = require('jsdom');

const BASE = 'http://localhost:8080';
const PAGES = [
  ['index.html', 'home'],
  ['catalog.html', 'catalog'],
  ['entry.html?id=t1', 'entry'],
  ['guestbook.html', 'guestbook'],
  ['admin.html', 'admin'],
];

const LATIN_OK = /^(Koyome|KOYOME\.ME|koyome|EN|FIG|KOYOME|ITEMS|INDEX|SELECTION|Aa|★|·|©|—|→|✕|◡̈|JPG|PNG|node|server\.js|json|public|data|content|assets|src|http|https)$/i;

function load(url, lang) {
  return JSDOM.fromURL(BASE + '/' + url, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = (u, o) => fetch(new URL(u, BASE).toString(), o);
      try { window.localStorage.setItem('koyome_lang', lang); } catch (_) {}
    },
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* strip the parts that are legitimately latin in both languages */
function latinLeftover(text) {
  const words = text.match(/[A-Za-z]{2,}/g) || [];
  return [...new Set(words)].filter((w) => !LATIN_OK.test(w));
}

async function grab(dom) {
  const { document } = dom.window;
  return {
    lang: document.documentElement.lang,
    title: document.title,
    menu: [...document.querySelectorAll('.menu-panel a')].map((a) => a.textContent.trim()),
    active: document.querySelector('.menu-panel a.active')?.textContent.trim() || '-',
    header: document.querySelector('.site-header')?.textContent.replace(/\s+/g, ' ').trim(),
    footer: document.querySelector('.site-footer')?.textContent.replace(/\s+/g, ' ').trim(),
    body: document.body.textContent.replace(/\s+/g, ' ').trim(),
    // page-specific probes
    name: document.getElementById('homeName')?.textContent.trim(),
    tagline: document.getElementById('homeTagline')?.textContent.trim(),
    intro: [...document.querySelectorAll('#homeIntro p')].map((p) => p.textContent.trim()),
    avatar: document.getElementById('portraitImg')?.getAttribute('src'),
    count: document.getElementById('totalCount')?.textContent.trim(),
    cats: [...document.querySelectorAll('.cat-index a span:first-child')].map((s) => s.textContent.trim()),
    rows: [...document.querySelectorAll('.entry-row .t')].map((s) => s.textContent.trim()),
    entryTitle: document.querySelector('#entryHead h1')?.textContent.trim(),
    entryBody: document.querySelector('#entryBody .entry-prose')?.textContent.trim().slice(0, 24),
    gbIntro: document.querySelector('.gb-intro')?.textContent.trim(),
    profNote: document.getElementById('adminNote')?.textContent.trim().slice(0, 30),
    zhFlags: document.querySelectorAll('.zh-flag').length,
    libTitles: [...document.querySelectorAll('.admin-item .t a')].map((a) => a.textContent.trim()),
    labels: [...document.querySelectorAll('label, .section-head .zh, button.btn')].map((e) => e.textContent.trim()),
  };
}

(async () => {
  for (const lang of ['en', 'zh']) {
    console.log('\n' + '='.repeat(58));
    console.log(`  LANGUAGE: ${lang}`);
    console.log('='.repeat(58));
    for (const [url, key] of PAGES) {
      const dom = await load(url, lang);
      await wait(1400);
      const d = await grab(dom);
      const clean = latinLeftover(d.body);
      console.log(`\n--- ${url}  [html lang=${d.lang}]  title: ${d.title}`);
      console.log(`    menu   : ${d.menu.join(' / ')}   (active: ${d.active})`);
      console.log(`    header : ${d.header}`);
      console.log(`    footer : ${d.footer}`);
      if (key === 'home') {
        console.log(`    name   : ${d.name}`);
        console.log(`    tagline: ${d.tagline}`);
        console.log(`    avatar : ${d.avatar}`);
        d.intro.forEach((p, i) => console.log(`    intro${i + 1} : ${p}`));
      }
      if (key === 'catalog') {
        console.log(`    count  : ${d.count}`);
        console.log(`    cats   : ${d.cats.join(' | ')}`);
        console.log(`    rows   : ${d.rows.join(' | ')}`);
      }
      if (key === 'entry') {
        console.log(`    title  : ${d.entryTitle}`);
        console.log(`    body   : ${d.entryBody}…`);
        console.log(`    labels : ${d.labels.slice(0, 6).join(' | ')}`);
      }
      if (key === 'guestbook') console.log(`    intro  : ${d.gbIntro}`);
      if (key === 'admin') {
        console.log(`    note   : ${d.profNote}…`);
        console.log(`    lib    : ${d.libTitles.join(' | ')}   (繁 flags: ${d.zhFlags})`);
        console.log(`    labels : ${d.labels.join(' | ')}`);
      }
      console.log(`    latin left in zh-relevant text: ${clean.length ? clean.join(', ') : 'none'}`);
      dom.window.close();
    }
  }
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
