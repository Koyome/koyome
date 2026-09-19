/* Static verification for the Koyome site. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PUB = path.join(__dirname, '..', 'docs');
const pages = ['index.html', 'catalog.html', 'entry.html', 'guestbook.html', 'admin.html'];
const js = ['js/i18n.js', 'js/header.js', 'js/data.js', 'js/main.js', 'js/catalog.js', 'js/admin.js', 'js/entry.js', 'js/guestbook.js'];

console.log('=== 1. JS syntax ===');
js.forEach((f) => {
  try {
    execFileSync(process.execPath, ['--check', path.join(PUB, f)], { stdio: 'pipe' });
    console.log('  OK   ', f);
  } catch (e) {
    console.log('  FAIL ', f, String(e.stderr || '').slice(0, 300));
  }
});

console.log('\n=== 2. page references resolve ===');
pages.forEach((p) => {
  const html = fs.readFileSync(path.join(PUB, p), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
    .filter((u) => !/^(https?:|data:|#)/.test(u));
  const missing = refs.filter((u) => !fs.existsSync(path.join(PUB, u.split('?')[0])));
  console.log('  ', p.padEnd(15), refs.length + ' refs', missing.length ? 'MISSING ' + missing.join(', ') : 'all present');
});

console.log('\n=== 3. i18n keys ===');
const i18n = fs.readFileSync(path.join(PUB, 'js/i18n.js'), 'utf8');
const region = i18n.slice(i18n.indexOf('const DICT'), i18n.indexOf('let lang'));
const blocks = region.split(/\/\* -+ (English|繁體中文)/).slice(1);
const definedEn = new Set();
const definedZh = new Set();
for (let i = 0; i < blocks.length; i += 2) {
  const name = blocks[i];
  const body = blocks[i + 1];
  const target = name === 'English' ? definedEn : definedZh;
  [...body.matchAll(/(?:^|[\s,{])([a-z_]+):\s*(?=['"])/gm)].forEach((m) => target.add(m[1]));
}
console.log('  en keys:', definedEn.size, '| zh keys:', definedZh.size);
const onlyEn = [...definedEn].filter((k) => !definedZh.has(k) && k !== '_html');
const onlyZh = [...definedZh].filter((k) => !definedEn.has(k) && k !== '_html');
console.log('  en-only:', onlyEn.join(', ') || 'none');
console.log('  zh-only:', onlyZh.join(', ') || 'none');

const used = new Set();
[...js.filter((f) => f !== 'js/i18n.js'), ...pages].forEach((f) => {
  const txt = fs.readFileSync(path.join(PUB, f), 'utf8');
  [...txt.matchAll(/\bt\(\s*'([a-z_]+)'/g)].forEach((m) => used.add(m[1]));
  [...txt.matchAll(/data-i18n(?:-ph|-html|-aria)?="([a-z_]+)"/g)].forEach((m) => used.add(m[1]));
});
const missingKeys = [...used].filter((k) => !definedEn.has(k));
const unusedKeys = [...definedEn].filter((k) => !used.has(k) && k !== '_html');
console.log('  used keys:', used.size);
console.log('  MISSING (used but undefined):', missingKeys.join(', ') || 'none');
console.log('  unused (defined but not referenced):', unusedKeys.join(', ') || 'none');

console.log('\n=== 4. hardcoded visible text left in markup (outside data-i18n) ===');
pages.forEach((p) => {
  const html = fs.readFileSync(path.join(PUB, p), 'utf8');
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]*data-i18n[^>]*>[\s\S]*?<\/[a-z]+>/g, '')
    .replace(/<(div|span|p|a|em|i|svg|circle|polygon|line|g|figure|figcaption|input|select|option|label|textarea|button|datalist|main|section|header|footer|nav|h1|h2|h3|body|html|head|meta|link|title)[^>]*>/g, ' ')
    .replace(/<[^>]*>/g, ' ');
  const words = (stripped.match(/[A-Za-z]{3,}/g) || []).filter((w) => !/^(DOCTYPE|html|meta|charset|viewport|width|initial|scale|device|utf|http|https|www|svg|xmlns|viewBox|fill|none|stroke|circle|polygon|points|line|class|href|src|text|type|name|id|for|value|data|key|lang|rel|icon|stylesheet|css|js|png|jpg|jpeg|max|min|placeholder|label|multiple|accept|image|video|required|checked|style|display|option|selected|content|title|open|true|false)$/i.test(w));
  console.log('  ', p.padEnd(15), words.length ? [...new Set(words)].join(', ') : 'clean');
});

console.log('\n=== 5. leftovers from removed structures ===');
const files = [...js, ...pages, 'css/style.css'];
['site-nav', 'hero-art', 'hero-rail', 'hero-sub', 'hero-en', 'modal'].forEach((needle) => {
  const hits = files.filter((f) => fs.readFileSync(path.join(PUB, f), 'utf8').includes(needle));
  console.log('  ', needle.padEnd(12), hits.length ? hits.join(', ') : 'none');
});

console.log('\n=== 6. profile / zh fields present ===');
const content = JSON.parse(fs.readFileSync(path.join(PUB, 'data/content.json'), 'utf8'));
console.log('  entries:', content.length, '| with titleZh:', content.filter((e) => e.titleZh).length);
const profile = JSON.parse(fs.readFileSync(path.join(PUB, 'data/profile.json'), 'utf8'));
console.log('  profile keys:', Object.keys(profile).join(', '));
