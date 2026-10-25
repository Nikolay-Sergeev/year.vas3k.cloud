// Protect the public HTTP contract using a real process and a temporary disk.
// No upstream tests cover auth, durable writes, or competing client revisions.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

const seed = { selectedYear: 2026, dateCells: { '2026-0-1': { color: 'green', customText: 'Καλή χρονιά 🎉' }, '2025-11-25': { color: 'red' } }, selectedColorTexture: 'green', selectedView: 'Linear' };
test('authenticated calendar persists across restart and rejects lost updates and unsafe writes', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-api-'));
  const salt = crypto.randomBytes(16).toString('hex');
  const password = crypto.randomBytes(24).toString('base64url');
  fs.mkdirSync(path.join(root, 'public'));
  fs.writeFileSync(path.join(root, 'public', 'index.html'), '<h1>Calendar</h1>');
  fs.mkdirSync(path.join(root, 'public', 'theme'));
  fs.writeFileSync(path.join(root, 'public', 'theme', 'tokens.css'), ':root { color-scheme: light; }');
  fs.writeFileSync(path.join(root, 'calendar.json'), JSON.stringify(seed));
  fs.writeFileSync(path.join(root, 'auth.json'), JSON.stringify({username:'nikolai', salt, hash: crypto.scryptSync(password,salt,32).toString('hex')}));
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1'); await once(probe,'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  let child;
  const start = async (ahead = 0) => {
    const clock = path.join(root, 'clock.cjs');
    fs.writeFileSync(clock, `const now=Date.now; Date.now=()=>now()+${ahead};`);
    child = spawn(process.execPath, ['--require', clock, path.join(__dirname, 'index.cjs')], { env: {...process.env, PORT:String(port), DATA_DIR:root, PUBLIC_DIR:path.join(root,'public'), AUTH_FILE:path.join(root,'auth.json')}, stdio:['ignore','ignore','pipe'] });
    let errors=''; child.stderr.on('data',chunk=>{errors+=chunk});
    for (let i=0;i<80;i++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return; } catch {}
      if (child.exitCode !== null) throw Error(errors);
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    throw Error('Server did not start: '+errors);
  };
  const stop = async () => { const exited=once(child,'exit'); child.kill(); await exited; };
  t.after(async () => { if(child?.exitCode===null) await stop(); fs.rmSync(root,{recursive:true,force:true}); });
  let cookie = '';
  const login = (username='nikolai', suppliedPassword=password, extra={}) => fetch(`http://127.0.0.1:${port}/api/login`, {method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify({username,password:suppliedPassword})});
  const get = (route='/api/calendar', init={})=>fetch(`http://127.0.0.1:${port}${route}`,{...init,headers:{Cookie:cookie,...init.headers}});
  const put = (body, tag, extra={})=>get('/api/calendar',{method:'PUT',headers:{'Content-Type':'application/json',...(tag?{'If-Match':tag}:{}),...extra},body:JSON.stringify(body)});
  await start();
  await t.test('sign-in form and password protect the calendar without a browser auth prompt',async()=>{
    const page=await fetch(`http://127.0.0.1:${port}/`,{redirect:'manual'});assert.equal(page.status,303);assert.equal(page.headers.get('location'),'/login');
    const form=await fetch(`http://127.0.0.1:${port}/login`);assert.equal(form.status,200);assert.match(await form.text(),/autocomplete="current-password"/);
    const theme=await fetch(`http://127.0.0.1:${port}/theme/tokens.css`);assert.equal(theme.status,200);assert.equal(theme.headers.get('content-type'),'text/css');
    const traversal=await fetch(`http://127.0.0.1:${port}/theme/%2e%2e%2f%2e%2e%2fauth.json`);assert.equal(traversal.status,404);
    const denied=await fetch(`http://127.0.0.1:${port}/api/calendar`);assert.equal(denied.status,401);assert.equal(denied.headers.get('www-authenticate'),null);
    assert.equal((await login('nikolai','wrong')).status,401);
    assert.equal((await login('nikolai',password,{Origin:'https://evil.example'})).status,403);
    const response=await login();assert.equal(response.status,200);
    const setCookie=response.headers.get('set-cookie');
    assert.match(setCookie,/Max-Age=2592000/);assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Strict/);assert.match(setCookie,/Path=\//);
    const expires=/Expires=([^;]+)/.exec(setCookie)[1];assert.ok(Math.abs(Date.parse(expires)-Date.now()-30*86400000)<2000);
    cookie=setCookie.split(';')[0];
    assert.equal((await get('/')).status,200);
    for(const route of ['/server/index.cjs','/data/calendar.json','/data/session-key']) assert.equal((await get(route)).status,404);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/calendar`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(seed)})).status,401);
  });
  const first=await get();const initialTag=first.headers.get('etag');assert.deepEqual(await first.json(),seed);
  const changed={...seed,dateCells:{...seed.dateCells,'2026-9-25':{color:'pink',customText:'Новый план'}}};
  let savedTag;
  await t.test('atomic save, backup, idempotent retry, and competing browser revisions',async()=>{
    const response=await put(changed,initialTag);assert.equal(response.status,200);savedTag=response.headers.get('etag');assert.notEqual(savedTag,initialTag);
    const retry=await put(changed,initialTag);assert.equal(retry.status,200);assert.equal(retry.headers.get('etag'),savedTag);
    assert.equal((await put({...seed,selectedView:'Classic'},initialTag)).status,412);
    assert.deepEqual(await (await get()).json(),changed);
    const backups=fs.readdirSync(path.join(root,'backups'));assert.equal(backups.length,1);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'backups',backups[0]))),seed);
    await stop();await start();
    assert.deepEqual(await (await get()).json(),changed);
  });
  await t.test('invalid, unversioned, cross-site, and oversized writes preserve the calendar',async()=>{
    assert.equal((await put(seed)).status,428);
    assert.equal((await put(seed,savedTag,{Origin:'https://evil.example'})).status,403);
    assert.equal((await put(seed,savedTag,{'Sec-Fetch-Site':'cross-site'})).status,403);
    for(const bad of [{...seed,dateCells:{'2026-1-30':{color:'green'}}},{...seed,dateCells:{'2026-0-1':{color:'invalid'}}},{...seed,selectedView:'invalid'}, {...seed,dateCells:null}]) assert.equal((await put(bad,savedTag)).status,400);
    assert.equal((await put(seed,savedTag,{'Content-Type':'text/plain'})).status,415);
    assert.equal((await get('/api/calendar',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':savedTag},body:'invalid json'})).status,400);
    assert.equal((await put({...seed,large:'x'.repeat(2*1024*1024)},savedTag)).status,413);
    assert.deepEqual(await (await get()).json(),changed);
  });
  await t.test('remembered session expires after 30 days, rejects tampering, and clears on sign out',async()=>{
    assert.equal((await get('/api/calendar',{headers:{Cookie:cookie+'tampered'}})).status,401);
    await stop();await start(29*86400000);assert.equal((await get()).status,200);
    await stop();await start(30*86400000+1000);assert.equal((await get()).status,401);
    await stop();await start();
    assert.equal((await get('/api/logout',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
    const signedOut=await get('/api/logout',{method:'POST'});assert.equal(signedOut.status,200);
    const cleared=signedOut.headers.get('set-cookie');assert.match(cleared,/Max-Age=0/);
    assert.equal((await get('/api/calendar',{headers:{Cookie:cleared.split(';')[0]}})).status,401);
    const changedSalt=crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(path.join(root,'auth.json'),JSON.stringify({username:'nikolai',salt:changedSalt,hash:crypto.scryptSync(password,changedSalt,32).toString('hex')}));
    await stop();await start();assert.equal((await get()).status,401);assert.equal((await login()).status,200);
  });

});
