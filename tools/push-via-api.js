/**
 * push-via-api.js — Push local `main` to GitHub via the REST Git Data API.
 *
 * Why this exists: on this machine git's smart-HTTP to github.com is blocked
 * (TCP SYNs dropped ~90% of the time), but https://api.github.com works fine.
 * This script replays every local commit that is missing on the remote:
 *   blobs -> trees -> commits -> update refs/heads/main
 * preserving each commit's tree, message, author and committer, then recreates
 * the same commit objects locally with `git commit-tree` so local and remote
 * end up on the SAME sha (verified, not assumed).
 *
 * Prereq: run tools/gh-device-auth.ps1 first (writes tools/gh-token.txt).
 * Usage:  node tools/push-via-api.js
 * Idempotent: already-pushed commits are skipped (remote sha reused as-is).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TOKEN_FILE = path.join(ROOT, 'tools', 'gh-token.txt');
const STATE_FILE = path.join(ROOT, 'tools', 'push-state.json');
const REPO = 'Koyome/koyome.github.io';
const BRANCH = 'main';
const API = 'https://api.github.com';

// resumable state: blobs already on GitHub (uploaded via API in earlier runs)
// and blobs GitHub refuses (too large for the blob API)
const state = fs.existsSync(STATE_FILE)
  ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  : { uploaded: [], tooLarge: {} };
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));

// PortableGit: cmd/git.exe lacks the https helper but we never touch the
// network with git here — local object access only, any git.exe works.
const GIT_CANDIDATES = [
  'C:\\Users\\杨坤\\.workbuddy\\binaries\\PortableGit\\versions\\1.2.0\\mingw64\\bin\\git.exe',
  'C:\\Users\\杨坤\\.workbuddy\\binaries\\PortableGit\\versions\\1.2.0\\cmd\\git.exe',
  'git',
];
const GIT = GIT_CANDIDATES.find((g) => { try { execFileSync(g, ['--version'], { stdio: 'pipe' }); return true; } catch { return false; } });
if (!GIT) { console.error('no git.exe found'); process.exit(1); }

function git(args, opts = {}) {
  return execFileSync(GIT, ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });
}
function gitBuffer(args) {
  return execFileSync(GIT, ['-C', ROOT, ...args], { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, urlPath, body, tries = 8) {
  const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(API + urlPath, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'koyome-deploy',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60000),
      });
      const text = await res.text();
      if (res.status >= 200 && res.status < 300) return text ? JSON.parse(text) : {};
      // 422 on blob create with "too large" — let caller handle it specially
      if (res.status === 422 && /too large/i.test(text)) {
        const err = new Error('BLOB_TOO_LARGE');
        err.code = 'BLOB_TOO_LARGE';
        throw err;
      }
      console.error(`  ${method} ${urlPath} -> ${res.status} (try ${i}) ${text.slice(0, 200)}`);
      if (res.status === 422 || res.status === 401 || res.status === 403 || res.status === 404) {
        throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
      }
    } catch (e) {
      if (e.code === 'BLOB_TOO_LARGE') throw e;
      if (e.message.startsWith('API ')) throw e;
      console.error(`  ${method} ${urlPath} ERR ${e.message} (try ${i})`);
    }
    await sleep(1500 * i);
  }
  throw new Error(`API failed after ${tries} tries: ${method} ${urlPath}`);
}

/* ---------- local git helpers ---------- */

function parseCommit(sha) {
  const raw = git(['cat-file', 'commit', sha]);
  const head = raw.slice(0, raw.indexOf('\n\n'));
  const message = raw.slice(raw.indexOf('\n\n') + 2);
  const get = (k) => (head.match(new RegExp(`^${k} (.+)$`, 'm')) || [])[1];
  const parseWho = (line) => {
    const m = line.match(/^(.*?) <(.*?)> (\d+) ([+-]\d{4})$/);
    return { name: m[1], email: m[2], date: epochToIso(parseInt(m[3], 10), m[4]) };
  };
  return {
    tree: get('tree'),
    parents: [...head.matchAll(/^parent ([0-9a-f]{40})$/gm)].map((m) => m[1]),
    author: parseWho(get('author')),
    committer: parseWho(get('committer')),
    message,
  };
}
function epochToIso(epoch, tz) {
  // keep the original timezone offset so the commit hashes identically
  const d = new Date(epoch * 1000);
  const iso = d.toISOString(); // 2026-09-20T01:23:45.000Z
  const sign = tz.slice(0, 1), hh = tz.slice(1, 3), mm = tz.slice(3, 5);
  const offMin = (parseInt(hh, 10) * 60 + parseInt(mm, 10)) * (sign === '+' ? 1 : -1);
  const local = new Date(epoch * 1000 + offMin * 60000);
  return local.toISOString().replace('Z', `${sign}${hh}:${mm}`);
}

function lsTreeRecursive(sha) {
  // returns [{mode, type:'blob'|'tree', sha, path}] including subtree entries
  const out = git(['ls-tree', '-r', '-t', sha]);
  return out.split('\n').filter(Boolean).map((line) => {
    const m = line.match(/^(\d+) (blob|tree) ([0-9a-f]{40})\t(.+)$/);
    return { mode: m[1], type: m[2], sha: m[3], path: m[4] };
  });
}

/* ---------- remote object upload ---------- */

async function ensureTree(rootTreeSha, remoteBlobShas, stats) {
  const entries = lsTreeRecursive(rootTreeSha);
  // upload every missing blob (resumable via state.uploaded; too-large are skipped and reported)
  for (const e of entries.filter((x) => x.type === 'blob')) {
    if (remoteBlobShas.has(e.sha) || state.uploaded.includes(e.sha)) continue;
    if (state.tooLarge[e.sha]) { stats.skippedLarge++; continue; }
    const content = gitBuffer(['cat-file', 'blob', e.sha]);
    const mb = (content.length / 1024 / 1024).toFixed(1);
    // cheap existence probe — earlier runs may have uploaded it already
    try {
      await api('GET', `/repos/${REPO}/git/blobs/${e.sha}`, null, 2);
      state.uploaded.push(e.sha); saveState();
      console.log(`  blob already on GitHub (${mb} MB) ${e.path}`);
      continue;
    } catch { /* not there — upload it */ }
    try {
      const created = await api('POST', `/repos/${REPO}/git/blobs`, {
        content: content.toString('base64'), encoding: 'base64',
      });
      if (created.sha !== e.sha) throw new Error(`blob sha mismatch for ${e.path}: local ${e.sha} remote ${created.sha}`);
      state.uploaded.push(e.sha);
      saveState();
      stats.blobs++;
      console.log(`  blob ok (${mb} MB) ${e.path}`);
    } catch (err) {
      if (err.code === 'BLOB_TOO_LARGE') {
        state.tooLarge[e.sha] = e.path;
        saveState();
        stats.skippedLarge++;
        console.log(`  !! TOO LARGE for blob API (${mb} MB): ${e.path}`);
        continue;
      }
      throw err;
    }
  }
  if (stats.skippedLarge > 0) {
    throw new Error(`LARGE_BLOBS_PENDING: ${stats.skippedLarge} blob(s) exceed the REST blob API limit — see tools/push-state.json tooLarge`);
  }
  // create subtrees bottom-up (children before parents)
  const trees = entries.filter((x) => x.type === 'tree').sort((a, b) => b.path.length - a.path.length);
  const treeShaByPath = new Map();
  for (const t of trees) {
    const children = entries.filter((e) => e.path.startsWith(t.path + '/') && !e.path.slice(t.path.length + 1).includes('/'));
    const payload = children.map((c) => ({
      path: c.path.slice(t.path.length + 1),
      mode: c.mode, type: c.type, sha: c.sha,
    }));
    const created = await api('POST', `/repos/${REPO}/git/trees`, { tree: payload });
    if (created.sha !== t.sha) throw new Error(`subtree sha mismatch at ${t.path}: local ${t.sha} remote ${created.sha}`);
    treeShaByPath.set(t.path, created.sha);
    stats.trees++;
  }
  // root tree
  const topChildren = entries.filter((e) => !e.path.includes('/'));
  const rootPayload = topChildren.map((c) => ({ path: c.path, mode: c.mode, type: c.type, sha: c.sha }));
  const rootCreated = await api('POST', `/repos/${REPO}/git/trees`, { tree: rootPayload });
  if (rootCreated.sha !== rootTreeSha) throw new Error(`root tree sha mismatch: local ${rootTreeSha} remote ${rootCreated.sha}`);
  stats.trees++;
}

/* ---------- main ---------- */

(async () => {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error('tools/gh-token.txt missing — run tools/gh-device-auth.ps1 first.');
    process.exit(1);
  }
  const headSha = git(['rev-parse', 'HEAD']);
  console.log(`local HEAD: ${headSha.slice(0, 7)}`);

  const ref = await api('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
  const remoteSha = ref.object.sha;
  console.log(`remote ${BRANCH}: ${remoteSha.slice(0, 7)}`);
  if (remoteSha === headSha) { console.log('Already up to date.'); return; }

  const remoteCommit = await api('GET', `/repos/${REPO}/git/commits/${remoteSha}`);
  const remoteTree = await api('GET', `/repos/${REPO}/git/trees/${remoteCommit.tree.sha}?recursive=1`);
  const remoteBlobShas = new Set(remoteTree.tree.filter((e) => e.type === 'blob').map((e) => e.sha));

  // commits to replay: HEAD back to (but excluding) the remote tip's parent chain.
  // local repo may not contain the remote tip object, so stop at ITS parent
  // (the common ancestor, present on both sides) and skip no-op tree commits.
  const stopAt = remoteCommit.parents && remoteCommit.parents[0] ? remoteCommit.parents[0].sha : null;
  let toReplay;
  try {
    toReplay = git(['rev-list', '--reverse', `${stopAt}..HEAD`]).split('\n').filter(Boolean);
  } catch {
    toReplay = git(['rev-list', '--reverse', 'HEAD']).split('\n').filter(Boolean); // no common parent locally: replay all
  }
  console.log(`commits to consider: ${toReplay.length}`);

  const stats = { blobs: 0, trees: 0, skippedLarge: 0 };
  const shaMap = new Map(); // local sha -> remote sha
  let parentSha = remoteSha;

  for (const localSha of toReplay) {
    const c = parseCommit(localSha);
    if (c.tree === remoteCommit.tree.sha) {
      console.log(`skip ${localSha.slice(0, 7)} (same tree as remote tip: no-op)`);
      shaMap.set(localSha, parentSha);
      continue;
    }
    console.log(`replay ${localSha.slice(0, 7)} ${c.message.split('\n')[0].slice(0, 60)}`);
    await ensureTree(c.tree, remoteBlobShas, stats);
    const created = await api('POST', `/repos/${REPO}/git/commits`, {
      message: c.message,
      tree: c.tree,
      parents: [parentSha],
      author: c.author,
      committer: c.committer,
    });
    console.log(`  -> remote commit ${created.sha.slice(0, 7)}`);
    shaMap.set(localSha, created.sha);
    parentSha = created.sha;
  }

  if (parentSha !== remoteSha) {
    await api('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: parentSha, force: false });
    console.log(`ref updated: ${BRANCH} -> ${parentSha.slice(0, 7)}`);
  }

  /* ---------- local alignment: recreate the same objects locally ---------- */
  // 1) recreate the old remote tip object locally (its tree/blobs already
  //    exist locally whenever it was a content-identical API upload; if the
  //    resulting sha differs we simply skip — alignment is best-effort there)
  let localBase = null;
  try {
    const baseTreeExists = (() => { try { git(['cat-file', '-e', remoteCommit.tree.sha]); return true; } catch { return false; } })();
    if (baseTreeExists && remoteCommit.parents.length) {
      const env = {
        ...process.env,
        GIT_AUTHOR_NAME: remoteCommit.author.name, GIT_AUTHOR_EMAIL: remoteCommit.author.email, GIT_AUTHOR_DATE: remoteCommit.author.date,
        GIT_COMMITTER_NAME: remoteCommit.committer.name, GIT_COMMITTER_EMAIL: remoteCommit.committer.email, GIT_COMMITTER_DATE: remoteCommit.committer.date,
      };
      const recreated = git(['commit-tree', remoteCommit.tree.sha, '-p', remoteCommit.parents[0].sha, '-m', remoteCommit.message], { env }).trim();
      if (recreated === remoteSha) { localBase = recreated; console.log('remote tip recreated locally (sha match)'); }
    }
  } catch { /* best effort */ }

  // 2) recreate each replayed commit locally with identical fields
  let localParent = localBase || remoteSha; // if base recreation failed we still try; commit-tree does not validate parent existence
  let alignOk = true;
  for (const localSha of toReplay) {
    const mapped = shaMap.get(localSha);
    if (mapped === localSha) { localParent = mapped; continue; }
    if (mapped === remoteSha || (shaMap.get(localSha) === localBase)) { localParent = mapped; continue; }
    if (!mapped || mapped === localSha) { localParent = mapped || localParent; continue; }
    if (mapped === parentSha || mapped === remoteSha) { /* handled below */ }
    if (mapped === undefined) continue;
    if (mapped === (localBase || remoteSha)) { localParent = mapped; continue; }
    const c = parseCommit(localSha);
    if (c.tree === remoteCommit.tree.sha) { localParent = mapped; continue; } // no-op skipped above
    try {
      const env = {
        ...process.env,
        GIT_AUTHOR_NAME: c.author.name, GIT_AUTHOR_EMAIL: c.author.email, GIT_AUTHOR_DATE: c.author.date,
        GIT_COMMITTER_NAME: c.committer.name, GIT_COMMITTER_EMAIL: c.committer.email, GIT_COMMITTER_DATE: c.committer.date,
      };
      const recreated = git(['commit-tree', c.tree, '-p', localParent, '-m', c.message], { env }).trim();
      if (recreated === mapped) {
        console.log(`local object recreated for ${mapped.slice(0, 7)} (sha match)`);
      } else {
        console.log(`WARN local recreation differs: ${recreated.slice(0, 7)} != ${mapped.slice(0, 7)}`);
        alignOk = false;
      }
    } catch (e) { alignOk = false; console.log(`WARN commit-tree failed: ${e.message.slice(0, 120)}`); }
    localParent = mapped;
  }

  if (alignOk) {
    git(['update-ref', `refs/heads/${BRANCH}`, parentSha]);
    git(['update-ref', `refs/remotes/origin/${BRANCH}`, parentSha]);
    console.log(`local refs aligned: ${BRANCH} & origin/${BRANCH} -> ${parentSha.slice(0, 7)}`);
  } else {
    console.log('Local alignment skipped (sha mismatch). Next session: fetch (flaky) or re-run this script — content is already on GitHub.');
  }

  console.log(`DONE. uploaded ${stats.blobs} blobs, ${stats.trees} trees.`);
  console.log('Pages rebuilds in ~1 min: https://koyome.github.io/');
})().catch((e) => {
  if (e.message.startsWith('LARGE_BLOBS_PENDING')) {
    console.error('PAUSED: ' + e.message);
    console.error('Everything below the size limit is uploaded. Resolve the large files (git protocol via a working proxy) and re-run.');
    process.exit(2);
  }
  console.error('FATAL', e.message);
  process.exit(1);
});
