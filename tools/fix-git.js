/* tools/fix-git.js — scrub any token from .git/config, fix upstream, verify clean */
const { execFileSync } = require('child_process');
const fs = require('fs');
const git = 'C:/Users/杨坤/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd/git.exe';
const cwd = 'C:/Users/Public/koyome-site';
const run = (args) => execFileSync(git, args, { cwd, encoding: 'utf8', stdio: 'pipe' });

const cfgPath = cwd + '/.git/config';
let cfg = fs.readFileSync(cfgPath, 'utf8');
const tokenRe = new RegExp('https://x-access-token:[^@\\s]*@github\\.com', 'g');
const had = tokenRe.test(cfg);
cfg = cfg.replace(tokenRe, 'https://github.com');
fs.writeFileSync(cfgPath, cfg);
console.log('config scrubbed:', had ? 'yes (token removed)' : 'no token found');

try { run(['config', '--unset', 'branch.main.remote']); } catch (e) { }
try { run(['config', '--unset', 'branch.main.merge']); } catch (e) { }
run(['fetch', 'origin']);
run(['branch', '--set-upstream-to=origin/main', 'main']);
console.log('upstream fixed:', run(['rev-parse', '--abbrev-ref', 'main@{upstream}']).trim());

/* sweep whole .git for the token string */
const token = fs.readFileSync(cwd + '/tools/gh-token.txt', 'utf8').trim();
let found = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = d + '/' + f;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (st.size < 5 * 1024 * 1024) {
      try {
        const buf = fs.readFileSync(p);
        if (buf.includes(token) || buf.toString('utf8').includes('x-access-token')) found.push(p);
      } catch (e) { }
    }
  }
})(cwd + '/.git');
console.log('token sweep:', found.length ? found.join(', ') : 'CLEAN');
