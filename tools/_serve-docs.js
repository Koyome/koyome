/* throwaway static server for docs/ (used by shot-r11.js visual probes) */
const http = require('http'), fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'docs');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let f = path.join(PUB, decodeURIComponent(u.pathname));
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8901, () => console.log('up'));
