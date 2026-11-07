'use strict';
// Web server for the McModels catalog. View-only: it sends the page, the pack
// list and the preview pictures. It never sends pack files (configs, models,
// textures, zips), and it has no way to browse the folders.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadCatalog } = require('./lib/catalog');

const ROOT = path.resolve(process.env.MCMODELS_ROOT || path.join(__dirname, '..'));
const DIST = path.join(__dirname, 'dist');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};
// Files from dist/ that may be sent. Source maps stay private.
const DIST_EXT = new Set(['.html', '.js', '.css', '.svg']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'",
};

let catalog = null;
let catalogJson = null;
function getCatalog() {
  if (!catalog) {
    catalog = loadCatalog(ROOT);
    catalogJson = JSON.stringify(catalog.data);
  }
  return catalog;
}

function send(res, status, body, type, extra) {
  res.writeHead(status, Object.assign({ 'Content-Type': type || 'text/plain; charset=utf-8' }, SECURITY_HEADERS, extra));
  res.end(body);
}

function streamFile(req, res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    const headers = Object.assign(
      { 'Content-Type': type, 'Content-Length': st.size, ETag: etag, 'Cache-Control': cache, 'Content-Disposition': 'inline' },
      SECURITY_HEADERS
    );
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed', null, { Allow: 'GET, HEAD' });
  }
  let p;
  try {
    p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (err) {
    return send(res, 400, 'Bad request');
  }

  if (p === '/packs.json' || p === '/api/packs') {
    getCatalog();
    return send(res, 200, catalogJson, TYPES['.json'], { 'Cache-Control': 'no-cache' });
  }
  if (p === '/api/health') return send(res, 200, '{"ok":true}', TYPES['.json']);

  // Pictures are looked up by id in a fixed list, so no path from the
  // address bar ever touches the disk.
  if (p.startsWith('/img/')) {
    const file = getCatalog().images.get(p.slice('/img/'.length));
    if (!file) return send(res, 404, 'Not found');
    return streamFile(req, res, file, 'public, max-age=86400');
  }

  if (p.startsWith('/api/')) return send(res, 404, 'Not found');

  // Built website files (only names that exist in dist/, checked by list).
  const name = p.replace(/^\/+/, '');
  if (name && /^[\w./-]+$/.test(name) && !name.includes('..') && DIST_EXT.has(path.extname(name))) {
    const file = path.join(DIST, name);
    if (file.startsWith(DIST + path.sep) && fs.existsSync(file)) {
      return streamFile(req, res, file, name.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    }
  }
  if (path.extname(name)) return send(res, 404, 'Not found');

  // Any other page address loads the app.
  const index = path.join(DIST, 'index.html');
  if (!fs.existsSync(index)) return send(res, 500, 'Website is not built yet. Run: npm run build');
  return streamFile(req, res, index, 'no-cache');
}

function createServer() {
  return http.createServer((req, res) => {
    try {
      handle(req, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, 'Server error');
      else res.destroy();
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use. Close the other window or set PORT to another number.`);
    else console.error(err);
    process.exit(1);
  });
  server.listen(PORT, HOST, () => {
    const c = getCatalog();
    console.log(`McModels catalog: ${c.data.stats.packs} packs, ${c.images.size} pictures`);
    console.log(`Open http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  });
}

module.exports = { createServer };
