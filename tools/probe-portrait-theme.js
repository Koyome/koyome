/* Probe: reproduce the reported bug flow —
   home page loaded while theme=dark (inline first-paint guard swaps src to
   the dark asset BEFORE header.js runs) -> user toggles to light ->
   portrait must return to the LIGHT asset (not stay on the dark one).
   Before the fix, header.js cached the dark src as data-light-src and the
   portrait stayed on the dark (pale/bluish) variant in light mode. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', 'docs');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html')
  .replace(/<script src="js\/[^"]+"><\/script>/g, '') // strip externals; we inject manually
  .replace(/<link[^>]*>/g, '');

const dom = new JSDOM(html, {
  url: 'http://localhost/index.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.localStorage.setItem('koyome_theme', 'dark');
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  },
});

const { window } = dom;
const { document } = window;

// run header.js inside the page (theme init + swapCutouts)
window.eval(read('js/header.js'));

const img = document.getElementById('portraitImg');
const results = [];
const check = (name, cond) => { results.push([name, cond]); };

check('loaded dark: src is dark variant', img.getAttribute('src').includes('avatar_cutout_dark.webp'));
check('loaded dark: lightSrc cached as LIGHT asset', img.dataset.lightSrc === 'assets/avatar_cutout.webp');

// simulate user clicking the theme toggle to light
document.getElementById('themeBtn').click();
check('after toggle to light: src back to light variant', img.getAttribute('src') === 'assets/avatar_cutout.webp');

// and back to dark again
document.getElementById('themeBtn').click();
check('toggle to dark again: src is dark variant', img.getAttribute('src').includes('avatar_cutout_dark.webp'));

// and once more to light (the exact reported flow end state)
document.getElementById('themeBtn').click();
check('final light: src is light variant', img.getAttribute('src') === 'assets/avatar_cutout.webp');

let fail = 0;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  if (!ok) fail++;
}
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
