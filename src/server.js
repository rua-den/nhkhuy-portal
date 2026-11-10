'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {openDatabase}=require('./db/database');
const {importLegacyServices}=require('./db/import-legacy-services');
const {createAuth}=require('./auth/service');
const ROOT=path.resolve(__dirname,'..'),DATA_DIR=path.resolve(process.env.PORTAL_DATA_DIR||path.join(ROOT,'data'));
const DB_PATH=path.resolve(process.env.PORTAL_DB_PATH||path.join(DATA_DIR,'portal.sqlite'));
const PUBLIC=path.join(ROOT,'public'),PORT=Number(process.env.PORT||4189),HOST=process.env.HOST||'127.0.0.1';
const DOMAIN=process.env.BASE_DOMAIN||'nhkhuy.run.place',MAX_BODY=32*1024;
const db=openDatabase(DB_PATH);
const legacyPath=fs.existsSync(path.join(DATA_DIR,'services.json'))?path.join(DATA_DIR,'services.json'):path.join(ROOT,'config','services.json');
try{importLegacyServices(db,legacyPath)}catch(error){console.error('Legacy registry import failed:',error.message);process.exit(1)}
const auth=createAuth(db,{secureCookies:process.env.PORTAL_COOKIE_SECURE!=='false'});
function send(res,status,value,type='application/json; charset=utf-8',extra={}){const headers={'content-type':type,'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'",'cache-control':'no-store',...(process.env.PORTAL_COOKIE_SECURE!=='false'?{'strict-transport-security':'max-age=15552000'}:{}),...extra};res.writeHead(status,headers);if(status===204||status===304)return res.end();res.end(type.startsWith('application/json')?JSON.stringify(value):value)}
async function body(req){let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw Object.assign(new Error('Request body too large.'),{status:413});raw+=chunk.toString('utf8')}if(!raw)return {};let value;try{value=JSON.parse(raw)}catch{throw Object.assign(new Error('Invalid JSON body.'),{status:400})}if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('JSON body must be an object.'),{status:400});return value}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host}catch{return false}}
function csrf(req,user){return sameOrigin(req)&&auth.csrfValid(user,req.headers['x-csrf-token'])}
function listServices(){return db.prepare('SELECT metadata_json FROM services WHERE enabled=1 ORDER BY name COLLATE NOCASE').all().map(row=>JSON.parse(row.metadata_json)).map(({id,name,description,url,category,icon})=>({id,name,description,url,category,icon}))}
function allServices(){return db.prepare('SELECT metadata_json FROM services ORDER BY name COLLATE NOCASE').all().map(row=>JSON.parse(row.metadata_json))}
function audit(user,action,targetId){db.prepare('INSERT INTO audit_events(actor_user_id,action,target_type,target_id,created_at) VALUES(?,?,?,?,?)').run(user.id,action,'service',targetId||null,new Date().toISOString())}
function safeId(s){return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s)}
function safePort(n){return Number.isInteger(n)&&n>=1024&&n<=65535}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),pathname=url.pathname;
  if(req.method==='GET'&&pathname==='/api/health')return send(res,200,{status:'ok',service:'nhkhuy-portal',database:'ok'});
  if(req.method==='GET'&&pathname==='/api/auth/status')return send(res,200,{setupRequired:!auth.bootstrapExists()});
  if(req.method==='POST'&&pathname==='/api/auth/login'){
   if(!sameOrigin(req))return send(res,403,{error:'Request rejected.'});
   const x=await body(req),ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').toString().split(',')[0].trim();
   const result=await auth.login(x.username,x.password,ip,res);return send(res,result.status,result.body,'application/json; charset=utf-8',result.retryAfter?{'retry-after':String(result.retryAfter)}:{});
  }
  if(req.method==='GET'&&pathname==='/api/auth/me'){
   const user=auth.userFor(req);if(!user)return send(res,401,{error:'Authentication required.'});
   return send(res,200,{user:{username:user.username},csrfToken:auth.rotateCsrf(user)});
  }
  if(req.method==='POST'&&pathname==='/api/auth/logout'){
   const user=auth.userFor(req);if(!user)return send(res,204,{});if(!csrf(req,user))return send(res,403,{error:'Request rejected.'});auth.logout(user,res);return send(res,204,{});
  }
  if(pathname.startsWith('/api/admin/')){
   const user=auth.userFor(req);if(!user)return send(res,401,{error:'Authentication required.'});
   if(!sameOrigin(req))return send(res,403,{error:'Request rejected.'});
   if(req.method==='GET'&&pathname==='/api/admin/services')return send(res,200,{services:allServices()});
   if(['POST','PATCH','DELETE'].includes(req.method)&&!csrf(req,user))return send(res,403,{error:'Request rejected.'});
   if(req.method==='POST'&&pathname==='/api/admin/services'){
    const x=await body(req),id=String(x.id||'').toLowerCase(),name=String(x.name||'').trim(),port=Number(x.port);
    if(!safeId(id)||!name||!safePort(port))return send(res,400,{error:'Use a lowercase service slug, a name, and a local port from 1024–65535.'});
    if(['9router','wedding','www','api','admin'].includes(id))return send(res,409,{error:'This subdomain is reserved.'});
    if(db.prepare('SELECT id FROM services WHERE id=?').get(id))return send(res,409,{error:'Service already exists.'});
    const service={id,name,description:String(x.description||'').slice(0,180),url:'https://'+id+'.'+DOMAIN,category:String(x.category||'Apps').slice(0,40),icon:'app-window',enabled:true,managedProxy:true,upstream:'127.0.0.1:'+port};
    const now=new Date().toISOString();db.prepare('INSERT INTO services(id,name,description,url,category,icon,enabled,managed_proxy,upstream,metadata_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,name,service.description,service.url,service.category,service.icon,1,1,service.upstream,JSON.stringify(service),now,now);audit(user,'service.create',id);return send(res,201,{service});
   }
   if(req.method==='PATCH'&&pathname.startsWith('/api/admin/services/')){
    const id=decodeURIComponent(pathname.slice('/api/admin/services/'.length));if(!safeId(id))return send(res,400,{error:'Invalid service ID.'});
    const row=db.prepare('SELECT metadata_json FROM services WHERE id=?').get(id);if(!row)return send(res,404,{error:'Service not found.'});
    const x=await body(req),service=JSON.parse(row.metadata_json);if(typeof x.enabled==='boolean')service.enabled=x.enabled;if(x.name!==undefined){const name=String(x.name).trim();if(!name)return send(res,400,{error:'Name is required.'});service.name=name.slice(0,80)}if(x.description!==undefined)service.description=String(x.description).slice(0,180);
    db.prepare('UPDATE services SET name=?,description=?,enabled=?,metadata_json=?,updated_at=? WHERE id=?').run(service.name,service.description||'',service.enabled?1:0,JSON.stringify(service),new Date().toISOString(),id);audit(user,'service.update',id);return send(res,200,{service});
   }
   return send(res,404,{error:'Not found.'});
  }
  if(pathname.startsWith('/api/'))return send(res,404,{error:'Not found.'});\n  if(pathname==='/admin.html'&&!auth.userFor(req)){res.writeHead(302,{'location':'/login.html','cache-control':'no-store','referrer-policy':'no-referrer'});return res.end()}
  let requested;try{requested=decodeURIComponent(pathname)}catch{return send(res,400,'Bad request.','text/plain; charset=utf-8')}
  if(requested==='/')requested='/index.html';
  const file=path.resolve(PUBLIC,'.'+requested);if(file!==PUBLIC&&!file.startsWith(PUBLIC+path.sep))return send(res,403,'Forbidden.','text/plain; charset=utf-8');
  fs.readFile(file,(error,data)=>{if(error)return send(res,404,'Not found.','text/plain; charset=utf-8');const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};send(res,200,data,types[ext]||'application/octet-stream',{'cache-control':ext==='.html'?'no-cache':'public, max-age=3600'})});
 }catch(error){if(res.headersSent){res.destroy();return}const status=Number.isInteger(error.status)?error.status:500;if(status===500)console.error('Request failed:',error.message);send(res,status,{error:status===500?'Internal server error.':error.message})}
});
server.listen(PORT,HOST,()=>console.log('NHKHUY Portal listening on http://'+HOST+':'+PORT));
function shutdown(){server.close(()=>{db.close();process.exit(0)});setTimeout(()=>process.exit(1),5000).unref()}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
