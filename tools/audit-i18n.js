/* audit-i18n.js — load the real i18n.js and check dictionary integrity:
   1) all three dicts (en / zh / zhcn) carry the same keys
   2) every literal t('key') / data-i18n="key" in the site resolves in all 3
   3) no empty values
   Read-only. usage: node tools/audit-i18n.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PUB = path.join(__dirname, '..', 'docs');
const src = fs.readFileSync(path.join(PUB, 'js', 'i18n.js'), 'utf8')
  .replace(/\}\)\(window\);\s*$/, '  global.__DICT = DICT;\n})(window);');

const dom = new JSDOM('<!doctype html><html><body></body></html>',
  { url: 'http://localhost/audit/', runScripts: 'dangerously' });
dom.window.eval(src);
const DICT = dom.window.__DICT;
if (!DICT) { console.log('could not extract DICT'); process.exit(1); }

const langs = Object.keys(DICT);
console.log('langs:', langs.join(', '), '| sizes:', langs.map((l) => l + '=' + Object.keys(DICT[l]).length).join(' '));

let issues = 0;
/* 1) key parity */
const base = new Set(Object.keys(DICT.en).filter((k) => !k.startsWith('_')));
for (const l of ['zh', 'zhcn']) {
  const set = new Set(Object.keys(DICT[l]).filter((k) => !k.startsWith('_')));
  for (const k of base) if (!set.has(k)) { console.log('MISSING in ' + l + ':', k); issues++; }
  for (const k of set) if (!base.has(k)) { console.log('EXTRA in ' + l + ':', k); issues++; }
}
/* 3) empty values */
for (const l of langs) for (const [k, v] of Object.entries(DICT[l])) {
  if (typeof v === 'string' && v.trim() === '') { console.log('EMPTY value', l, k); issues++; }
}

/* 2) every literal key used in the site must resolve */
const used = new Map();
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (f !== 'assets' && f !== 'data') walk(p); continue; }
    if (!/\.(html|js)$/.test(f)) continue;
    const t = fs.readFileSync(p, 'utf8');
    const re = /(?:\bt|I18N\.t)\(\s*'([A-Za-z_][\w]*)'\s*\)|data-i18n="([A-Za-z_][\w]*)"/g;
    let m;
    while ((m = re.exec(t))) {
      const k = m[1] || m[2];
      if (!used.has(k)) used.set(k, path.relative(PUB, p));
    }
  }
})(PUB);
console.log('literal keys used in site:', used.size);
for (const [k, where] of used) {
  for (const l of ['en', 'zh', 'zhcn']) {
    if (DICT[l][k] === undefined) { console.log('UNRESOLVED', l, k, '(used in ' + where + ')'); issues++; }
  }
}
console.log(issues ? '\n' + issues + ' ISSUES' : '\nNO ISSUES');
process.exit(issues ? 1 : 0);
