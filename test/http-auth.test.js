'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
const {openDatabase}=require('../src/db/database'),{createAuth}=require('../src/auth/service');
async function freePort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port}
test('HTTP auth flow protects admin APIs and enforces CSRF',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'portal-http-auth-')),port=await freePort();let db,child,logs='';
 try{
  db=openDatabase(path.join(directory,'portal.sqlite'));await createAuth(db,{secureCookies:false}).bootstrap('owner','integration-password-123');db.close();db=null;
  child=spawn(process.execPath,['src/server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),PORTAL_DATA_DIR:directory,PORTAL_COOKIE_SECURE:'false'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
  const base='http://127.0.0.1:'+port;let ready=false;
  for(let i=0;i<50;i++){if(child.exitCode!==null)throw new Error('Portal exited: '+logs);try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  assert.equal(ready,true,'server did not become ready: '+logs);
  const denied=await fetch(base+'/api/admin/services');assert.equal(denied.status,401);
  const badOrigin=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json'},body:JSON.stringify({username:'owner',password:'integration-password-123'})});assert.equal(badOrigin.status,403);
  const publicList=await fetch(base+'/api/services');assert.equal(publicList.status,200);assert.ok((await publicList.json()).length>=2);
  const pageDenied=await fetch(base+'/admin.html',{redirect:'manual'});assert.equal(pageDenied.status,302);assert.equal(pageDenied.headers.get('location'),'/login.html');
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'owner',password:'integration-password-123'})});
  assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=Lax/);
  const me=await fetch(base+'/api/auth/me',{headers:{cookie}});assert.equal(me.status,200);const session=await me.json();assert.equal(session.user.username,'owner');
  const pageAllowed=await fetch(base+'/admin.html',{headers:{cookie},redirect:'manual'});assert.equal(pageAllowed.status,200);
  const admin=await fetch(base+'/api/admin/services',{headers:{cookie}});assert.equal(admin.status,200);const registry=await admin.json();assert.ok(registry.services.length>=2);
  const first=registry.services[0],payload=JSON.stringify({enabled:!first.enabled});
  const noCsrf=await fetch(base+'/api/admin/services/'+first.id,{method:'PATCH',headers:{cookie,'content-type':'application/json'},body:payload});assert.equal(noCsrf.status,403);
  const changed=await fetch(base+'/api/admin/services/'+first.id,{method:'PATCH',headers:{cookie,'content-type':'application/json','x-csrf-token':session.csrfToken},body:payload});assert.equal(changed.status,200);
  const partial=await fetch(base+'/api/admin/services/'+first.id,{method:'PATCH',headers:{cookie,'content-type':'application/json','x-csrf-token':session.csrfToken},body:JSON.stringify({name:'Updated test name'})});assert.equal(partial.status,200);assert.equal((await partial.json()).service.enabled,!first.enabled);
  const logout=await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie,'x-csrf-token':session.csrfToken}});assert.equal(logout.status,204);
  const expired=await fetch(base+'/api/admin/services',{headers:{cookie}});assert.equal(expired.status,401);
 }finally{
  if(child){child.kill('SIGTERM');await new Promise(resolve=>{const timer=setTimeout(resolve,3000);child.once('exit',()=>{clearTimeout(timer);resolve()})})}
  if(db)db.close();fs.rmSync(directory,{recursive:true,force:true});
 }
});
