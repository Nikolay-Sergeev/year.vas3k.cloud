const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const COOKIE = '__Host-nikolai_calendar';
const LIFETIME = 30 * 24 * 60 * 60;

function createAuth({ authFile, dataDir, origin }) {
  const auth = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  if (!auth.username || !/^[a-f0-9]{32}$/.test(auth.salt) || !/^[a-f0-9]{64}$/.test(auth.hash)) throw Error('Invalid authentication configuration');
  const keyFile = path.join(dataDir, 'session-key');
  try {
    const fd = fs.openSync(keyFile, 'wx', 0o600);
    try { fs.writeFileSync(fd, crypto.randomBytes(32)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const secret = fs.readFileSync(keyFile);
  if (secret.length !== 32) throw Error('Invalid session key');
  // Rotating credentials invalidates existing sessions; the key survives restarts.
  const key = crypto.createHmac('sha256', secret).update(JSON.stringify(auth)).digest();
  const sign = payload => crypto.createHmac('sha256', key).update(payload).digest('base64url');
  const cookie = (value, age) => `${COOKIE}=${value}; Path=/; Max-Age=${age}; Expires=${new Date(Date.now() + age * 1000).toUTCString()}; HttpOnly; Secure; SameSite=Strict`;
  const json = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  };
  const sameSite = req => !(req.headers.origin && req.headers.origin !== origin) && req.headers['sec-fetch-site'] !== 'cross-site';
  function authenticated(req) {
    const value = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!value || value.length > 1024) return false;
    const parts = value.split('.');
    if (parts.length !== 2) return false;
    const signature = Buffer.from(parts[1], 'base64url');
    const expected = Buffer.from(sign(parts[0]), 'base64url');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) return false;
    try {
      const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);
      return data.sub === auth.username && Number.isInteger(data.exp) && data.exp > now && data.exp <= now + LIFETIME;
    } catch { return false; }
  }
  const failures = new Map();
  async function handle(req, res, url) {
    if (url.pathname === '/login' && req.method === 'GET') {
      if (authenticated(req)) { res.writeHead(303, { Location: '/' }); res.end(); }
      else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(path.join(__dirname, 'login.html'))); }
      return true;
    }
    if (url.pathname === '/login.js' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(fs.readFileSync(path.join(__dirname, 'login.js')));
      return true;
    }
    if (!['/api/login', '/api/logout'].includes(url.pathname)) return false;
    if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' }); return true; }
    if (!sameSite(req)) { json(res, 403, { error: 'Cross-site request rejected' }); return true; }
    if (url.pathname === '/api/logout') { json(res, 200, { signedOut: true }, { 'Set-Cookie': cookie('', 0) }); return true; }
    if (!req.headers['content-type']?.startsWith('application/json')) { json(res, 415, { error: 'Expected application/json' }); return true; }
    const now = Date.now();
    for (const [ip, failure] of failures) if (failure.until <= now) failures.delete(ip);
    const ip = req.socket.remoteAddress;
    const failure = failures.get(ip) || { count: 0, until: now + 60000 };
    if (failure.count >= 20) { json(res, 429, { error: 'Too many login attempts. Try again in a minute.' }, { 'Retry-After': '60' }); return true; }
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4096) { json(res, 413, { error: 'Login request is too large' }); return true; }
      chunks.push(chunk);
    }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { json(res, 400, { error: 'Invalid login request' }); return true; }
    const password = typeof input?.password === 'string' ? input.password : '';
    const hash = crypto.scryptSync(password, auth.salt, 32);
    if (input?.username !== auth.username || !crypto.timingSafeEqual(hash, Buffer.from(auth.hash, 'hex'))) {
      failure.count++;
      failures.set(ip, failure);
      json(res, 401, { error: 'Incorrect username or password.' });
      return true;
    }
    failures.delete(ip);
    const expires = Math.floor(Date.now() / 1000) + LIFETIME;
    const payload = Buffer.from(JSON.stringify({ sub: auth.username, exp: expires, nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
    json(res, 200, { signedIn: true }, { 'Set-Cookie': cookie(payload + '.' + sign(payload), LIFETIME) });
    return true;
  }
  function requireAuthentication(req, res) {
    if (authenticated(req)) return true;
    if (req.method === 'GET' && !req.url.startsWith('/api/')) { res.writeHead(303, { Location: '/login' }); res.end(); }
    else json(res, 401, { error: 'Sign in to access your calendar.' });
    return false;
  }
  return { handle, requireAuthentication };
}
module.exports = { createAuth };
