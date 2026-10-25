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
  fs.writeFileSync(path.join(root, 'calendar.json'), JSON.stringify(seed));
  fs.writeFileSync(path.join(root, 'auth.json'), JSON.stringify({username:'nikolai', salt, hash: crypto.scryptSync(password,salt,32).toString('hex')}));
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1'); await once(probe,'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  let child;
  const start = async () => {
    child = spawn(process.execPath, [path.join(__dirname, 'index.cjs')], { env: {...process.env, PORT:String(port), DATA_DIR:root, PUBLIC_DIR:path.join(root,'public'), AUTH_FILE:path.join(root,'auth.json')}, stdio:['ignore','ignore','pipe'] });
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
  const headers = {Authorization: 'Basic '+Buffer.from('nikolai:'+password).toString('base64')};
  const get = (route='/api/calendar', init={})=>fetch(`http://127.0.0.1:${port}${route}`,{...init,headers:{...headers,...init.headers}});
  const put = (body, tag, extra={})=>get('/api/calendar',{method:'PUT',headers:{'Content-Type':'application/json',...(tag?{'If-Match':tag}:{}),...extra},body:JSON.stringify(body)});
  await start();
  await t.test('static content, calendar, and writes require the password',async()=>{
    for(const route of ['/', '/api/calendar','/server/index.cjs','/data/calendar.json']) {
      const response=await fetch(`http://127.0.0.1:${port}${route}`);assert.equal(response.status,401);assert.match(response.headers.get('www-authenticate'),/Basic/);
    }
    assert.equal((await get('/',{headers:{Authorization:'Basic '+Buffer.from('nikolai:wrong').toString('base64')}})).status,401);
    assert.equal((await get('/')).status,200);
    assert.equal((await get('/server/index.cjs')).status,404);
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
});
