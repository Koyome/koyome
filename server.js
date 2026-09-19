/* ============================================================
   Koyome.me — a quiet corner of the web
   Pure Node.js: static hosting + content / media / guestbook /
   profile APIs (zero dependencies)
   Run: node server.js  →  http://localhost:8080
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'content.json');
const GUESTBOOK_FILE = path.join(DATA_DIR, 'guestbook.json');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');
const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');
const PORT = process.env.PORT || 80;
const BODY_LIMIT = 200 * 1024 * 1024; // 200MB (base64 upload limit)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};

const DEFAULT_PROFILE = {
  name: 'Koyome',
  nameZh: 'Koyome',
  tagline: 'welcome — make yourself at home.',
  taglineZh: '歡迎——就把這裡當成自己的家。',
  intro: "Koyome here — this is my own small corner of the internet.\n\nI keep the words worth re-reading, the pictures worth looking at twice, and the videos I don't want to forget. Nothing here is finished, and nothing here is in a hurry.\n\nHave a look around — stay as long as you like.",
  introZh: '我是 Koyome，這裡是我在網路上的一小塊地。\n\n值得重讀的文字、值得多看兩眼的畫面，還有不想忘記的影片，我都放在這裡。這裡的東西都還沒完成，也沒有任何東西在趕路。\n\n隨便逛逛——想待多久都可以。',
  avatar: '/assets/avatar.jpg',
};

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const loadContent = () => {
  const list = readJson(DATA_FILE, []);
  return Array.isArray(list) ? list : [];
};
const saveContent = (list) => writeJson(DATA_FILE, list);
const loadGuestbook = () => {
  const list = readJson(GUESTBOOK_FILE, []);
  return Array.isArray(list) ? list : [];
};
const saveGuestbook = (list) => writeJson(GUESTBOOK_FILE, list);
const loadProfile = () => ({ ...DEFAULT_PROFILE, ...readJson(PROFILE_FILE, {}) });
const saveProfile = (p) => writeJson(PROFILE_FILE, p);

const str = (v, n) => String(v == null ? '' : v).slice(0, n);

/** Save a dataURL as a real file under assets/, return its public path */
function saveDataUrl(dataUrl, originalName) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl || '');
  if (!m) return null;
  const extMap = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/avif': '.avif', 'image/svg+xml': '.svg',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
  };
  const ext = extMap[m[1]] || path.extname(originalName || '').toLowerCase() || '.bin';
  const safe = String(originalName || 'file')
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, '_')
    .replace(/\.[^.]*$/, '');
  const name = `${Date.now()}_${(safe || 'file').slice(0, 40)}${ext}`;
  const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ASSETS_DIR, name), buf);
  return `assets/${name}`;
}

/** media type from a dataURL mime prefix */
function mediaTypeOf(dataUrl) {
  return /^data:video\//.test(dataUrl || '') ? 'video' : 'image';
}

/** normalize an entry: always carry a media array */
function normalizeEntry(entry) {
  if (!Array.isArray(entry.media)) {
    entry.media = (entry.type === 'image' || entry.type === 'video') && entry.src
      ? [{ type: entry.type, src: entry.src }]
      : [];
  }
  if (entry.media.length && !entry.src) entry.src = entry.media[0].src;
  return entry;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  /* ================= Content API ================= */
  if (url.pathname === '/api/content' && req.method === 'GET') {
    res.writeHead(200, MIME['.json']);
    return res.end(JSON.stringify(loadContent().map(normalizeEntry)));
  }

  if (url.pathname === '/api/content' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req, BODY_LIMIT)).toString('utf8'));
      const entry = {
        id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: ['text', 'image', 'video'].includes(body.type) ? body.type : 'text',
        title: str(body.title, 120) || 'Untitled',
        titleZh: str(body.titleZh, 120),
        category: str(body.category, 40) || 'Uncategorized',
        categoryZh: str(body.categoryZh, 40),
        date: str(body.date, 20) || new Date().toISOString().slice(0, 10),
        featured: !!body.featured,
        desc: str(body.desc, 300),
        descZh: str(body.descZh, 300),
        media: [],
      };

      if (entry.type === 'text') {
        entry.body = str(body.body, 200000);
        entry.bodyZh = str(body.bodyZh, 200000);
        if (!entry.body.trim() && !entry.bodyZh.trim()) {
          return send(res, 400, { error: 'Body text cannot be empty' });
        }
      } else {
        /* multiple uploaded files, or a single source URL */
        if (Array.isArray(body.files) && body.files.length) {
          body.files.forEach((f) => {
            const src = saveDataUrl(f.file, f.filename);
            if (src) entry.media.push({ type: mediaTypeOf(f.file), src });
          });
        }
        const src = String(body.src || '').trim();
        if (src && !entry.media.length) entry.media.push({ type: entry.type, src });
        if (!entry.media.length) return send(res, 400, { error: 'Upload a file or provide a source URL' });
        entry.src = entry.media[0].src;
      }

      const list = loadContent();
      list.unshift(entry);
      saveContent(list);
      return send(res, 200, { ok: true, entry });
    } catch (e) {
      return send(res, e.message === 'payload too large' ? 413 : 400, { error: e.message });
    }
  }

  if (url.pathname === '/api/content' && req.method === 'PUT') {
    /* update an existing entry's text fields; media is managed via /api/media */
    try {
      const id = url.searchParams.get('id');
      const body = JSON.parse((await readBody(req, BODY_LIMIT)).toString('utf8'));
      const list = loadContent();
      const entry = list.find((it) => it.id === id);
      if (!entry) return send(res, 404, { error: 'Entry not found' });

      if (body.title != null) entry.title = str(body.title, 120) || 'Untitled';
      if (body.titleZh != null) entry.titleZh = str(body.titleZh, 120);
      if (body.category != null) entry.category = str(body.category, 40) || 'Uncategorized';
      if (body.categoryZh != null) entry.categoryZh = str(body.categoryZh, 40);
      if (body.date != null) entry.date = str(body.date, 20);
      if (body.featured != null) entry.featured = !!body.featured;
      if (body.desc != null) entry.desc = str(body.desc, 300);
      if (body.descZh != null) entry.descZh = str(body.descZh, 300);
      if (entry.type === 'text') {
        const nextBody = body.body != null ? str(body.body, 200000) : entry.body;
        const nextBodyZh = body.bodyZh != null ? str(body.bodyZh, 200000) : entry.bodyZh;
        if (!String(nextBody || '').trim() && !String(nextBodyZh || '').trim()) {
          return send(res, 400, { error: 'Body text cannot be empty' });
        }
        entry.body = nextBody;
        entry.bodyZh = nextBodyZh;
      }

      saveContent(list);
      return send(res, 200, { ok: true, entry: normalizeEntry(entry) });
    } catch (e) {
      return send(res, e.message === 'payload too large' ? 413 : 400, { error: e.message });
    }
  }

  if (url.pathname === '/api/content' && req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    saveContent(loadContent().filter((it) => it.id !== id));
    return send(res, 200, { ok: true });
  }

  /* ================= Media API (per-entry, multiple) ================= */
  if (url.pathname === '/api/media' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req, BODY_LIMIT)).toString('utf8'));
      const list = loadContent();
      const entry = list.find((it) => it.id === body.id);
      if (!entry) return send(res, 404, { error: 'Entry not found' });
      normalizeEntry(entry);
      if (Array.isArray(body.files)) {
        body.files.forEach((f) => {
          const src = saveDataUrl(f.file, f.filename);
          if (src) entry.media.push({ type: mediaTypeOf(f.file), src });
        });
      }
      if (body.src) {
        const src = String(body.src).trim();
        if (src) entry.media.push({ type: entry.type === 'video' ? 'video' : 'image', src });
      }
      if (!entry.media.length) return send(res, 400, { error: 'Upload a file or provide a source URL' });
      entry.src = entry.media[0].src;
      saveContent(list);
      return send(res, 200, { ok: true, media: entry.media });
    } catch (e) {
      return send(res, e.message === 'payload too large' ? 413 : 400, { error: e.message });
    }
  }

  if (url.pathname === '/api/media' && req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    const index = parseInt(url.searchParams.get('index'), 10);
    const list = loadContent();
    const entry = list.find((it) => it.id === id);
    if (!entry || Number.isNaN(index) || !entry.media || !entry.media[index]) {
      return send(res, 404, { error: 'Media not found' });
    }
    entry.media.splice(index, 1);
    entry.src = entry.media.length ? entry.media[0].src : '';
    saveContent(list);
    return send(res, 200, { ok: true, media: entry.media });
  }

  /* ================= Profile API (homepage) ================= */
  if (url.pathname === '/api/profile' && req.method === 'GET') {
    res.writeHead(200, MIME['.json']);
    return res.end(JSON.stringify(loadProfile()));
  }

  if (url.pathname === '/api/profile' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req, BODY_LIMIT)).toString('utf8'));
      const current = loadProfile();
      const next = {
        name: body.name != null ? str(body.name, 80) : current.name,
        nameZh: body.nameZh != null ? str(body.nameZh, 80) : current.nameZh,
        tagline: body.tagline != null ? str(body.tagline, 200) : current.tagline,
        taglineZh: body.taglineZh != null ? str(body.taglineZh, 200) : current.taglineZh,
        intro: body.intro != null ? str(body.intro, 20000) : current.intro,
        introZh: body.introZh != null ? str(body.introZh, 20000) : current.introZh,
        avatar: current.avatar,
      };
      if (body.avatarFile) {
        const src = saveDataUrl(body.avatarFile, 'avatar');
        if (src) next.avatar = src;
      } else if (body.avatar) {
        next.avatar = str(body.avatar, 300);
      }
      saveProfile(next);
      return send(res, 200, { ok: true, profile: next });
    } catch (e) {
      return send(res, e.message === 'payload too large' ? 413 : 400, { error: e.message });
    }
  }

  /* ================= Guestbook API ================= */
  if (url.pathname === '/api/guestbook' && req.method === 'GET') {
    res.writeHead(200, MIME['.json']);
    return res.end(JSON.stringify(loadGuestbook()));
  }

  if (url.pathname === '/api/guestbook' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8'));
      const name = str(body.name, 40).trim();
      const text = str(body.text, 2000).trim();
      if (!name || !text) return send(res, 400, { error: 'Name and message are required' });
      const msg = {
        id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name, text,
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };
      const list = loadGuestbook();
      list.unshift(msg);
      saveGuestbook(list);
      return send(res, 200, { ok: true, msg });
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
  }

  if (url.pathname === '/api/guestbook' && req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    saveGuestbook(loadGuestbook().filter((it) => it.id !== id));
    return send(res, 200, { ok: true });
  }

  /* ================= Static files ================= */
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<meta charset="utf-8">404 · nothing has grown here yet · 這裡還沒長出東西來 · <a href="/">back home / 回到首頁</a>');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

function listen(port, isFallback) {
  server.once('error', (err) => {
    if (!isFallback && (err.code === 'EACCES' || err.code === 'EADDRINUSE')) {
      console.log(`  port ${port} unavailable (${err.code}) — falling back to 8080`);
      listen(8080, true);
      return;
    }
    throw err;
  });
  server.listen(port, () => {
    console.log('----------------------------------------');
    console.log('  Koyome.me — served from this computer');
    if (port === 80) {
      console.log('  http://Koyome.me            home (add "127.0.0.1 Koyome.me" to your hosts file once)');
      console.log('  http://Koyome.me/admin.html site manager');
    } else {
      console.log(`  http://Koyome.me:${port}            home`);
      console.log(`  http://Koyome.me:${port}/admin.html  site manager`);
    }
    console.log('----------------------------------------');
  });
}

listen(PORT, false);
