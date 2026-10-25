// A single-process server: writes and ETag checks are synchronous and atomic.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validate } = require('./schema.cjs');
const { createAuth } = require('./auth.cjs');

const dataDir = process.env.DATA_DIR || '/data';
const publicDir = path.resolve(process.env.PUBLIC_DIR || './build');
const origin = process.env.APP_ORIGIN || 'https://calendar.nikolai-server.lan';
const file = path.join(dataDir, 'calendar.json');
fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true, mode: 0o700 });
// Refuse to start with missing/corrupt data. Import deliberately before first start.
validate(JSON.parse(fs.readFileSync(file, 'utf8')));
const auth = createAuth({ authFile: process.env.AUTH_FILE || '/run/secrets/calendar_auth', dataDir, origin });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const etag = bytes => '"' + crypto.createHash('sha256').update(bytes).digest('hex') + '"';
const reply = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};
function persist(bytes, previous) {
  const backup = path.join(dataDir, 'backups', `${Date.now()}-${crypto.randomUUID()}.json`);
  fs.writeFileSync(backup, previous, { mode: 0o600, flag: 'wx' });
  const temp = file + '.tmp';
  const fd = fs.openSync(temp, 'w', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
  const dir = fs.openSync(dataDir, 'r');
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
  const backups = fs.readdirSync(path.join(dataDir, 'backups')).filter(n => n.endsWith('.json')).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - 100))) fs.unlinkSync(path.join(dataDir, 'backups', old));
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz' && req.method === 'GET') {
      validate(JSON.parse(fs.readFileSync(file, 'utf8')));
      return reply(res, 200, { status: 'ok', version: '1.4.0' });
    }
    if (url.pathname.startsWith('/theme/') && ['GET', 'HEAD'].includes(req.method)) {
      const target = path.resolve(publicDir, '.' + decodeURIComponent(url.pathname));
      if (!target.startsWith(path.join(publicDir, 'theme') + path.sep)) return reply(res, 404, { error: 'Not found' });
      let bytes;
      try { bytes = fs.readFileSync(target); } catch { return reply(res, 404, { error: 'Not found' }); }
      const type = { '.css': 'text/css', '.ttf': 'font/ttf', '.txt': 'text/plain' }[path.extname(target)];
      if (!type) return reply(res, 404, { error: 'Not found' });
      res.writeHead(200, { 'Content-Type': type });
      res.end(req.method === 'HEAD' ? undefined : bytes);
      return;
    }
    if (await auth.handle(req, res, url)) return;
    if (!auth.requireAuthentication(req, res)) return;
    if (url.pathname === '/api/calendar') {
      if (req.method === 'GET') {
        const bytes = fs.readFileSync(file);
        res.writeHead(200, { 'Content-Type': 'application/json', ETag: etag(bytes) });
        return res.end(bytes);
      }
      if (req.method !== 'PUT') return reply(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, PUT' });
      if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') return reply(res, 403, { error: 'Cross-site write rejected' });
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(res, 415, { error: 'Expected application/json' });
      if (!req.headers['if-match']) return reply(res, 428, { error: 'If-Match required' });
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) return reply(res, 413, { error: 'Calendar exceeds 2 MB' });
        chunks.push(chunk);
      }
      let document;
      try { document = JSON.parse(Buffer.concat(chunks).toString('utf8')); validate(document); }
      catch (err) { return reply(res, 400, { error: err.message }); }
      const bytes = Buffer.from(JSON.stringify(document, null, 2) + '\n');
      const previous = fs.readFileSync(file);
      // A retry after a lost response may safely acknowledge the identical document.
      if (!bytes.equals(previous) && req.headers['if-match'] !== etag(previous)) return reply(res, 412, { error: 'Another device saved changes. Export your draft, then reload.' });
      if (!bytes.equals(previous)) persist(bytes, previous);
      return reply(res, 200, { saved: true }, { ETag: etag(bytes) });
    }
    if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, { error: 'Method not allowed' });
    const pathname = decodeURIComponent(url.pathname);
    const target = path.resolve(publicDir, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(publicDir + path.sep)) return reply(res, 404, { error: 'Not found' });
    let bytes;
    try { bytes = fs.readFileSync(target); } catch { return reply(res, 404, { error: 'Not found' }); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (err) {
    console.error('Request failed:', err.message);
    if (!res.headersSent) reply(res, 500, { error: 'Server could not complete the request. Your previous calendar is preserved.' });
    else res.end();
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
