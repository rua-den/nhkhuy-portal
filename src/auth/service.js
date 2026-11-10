'use strict';
const crypto=require('node:crypto');
const {hashPassword,verifyPassword}=require('./password');
const COOKIE='portal_session',TTL=12*60*60*1000,sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function parseCookies(header=''){const result={};for(const part of header.split(';')){const i=part.indexOf('=');if(i<1)continue;try{result[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}catch{}}return result}
function createAuth(db,{secureCookies=true}={}){
 const attempts=new Map();
 const dummyPassword=hashPassword(crypto.randomBytes(32).toString('hex'));
 const audit=(uid,action)=>db.prepare('INSERT INTO audit_events(actor_user_id,action,target_type,created_at) VALUES(?,?,?,?)').run(uid,action,'auth',new Date().toISOString());
 function retryAfter(key){const v=attempts.get(key);if(!v||!v.until)return 0;const left=v.until-Date.now();if(left<=0){attempts.delete(key);return 0}return Math.ceil(left/1000)}
 function failed(key){const v=attempts.get(key)||{count:0,until:0};v.count++;if(v.count>=5){v.until=Date.now()+Math.min(15*60_000,30_000*2**Math.min(v.count-5,5));v.count=0}attempts.set(key,v);if(attempts.size>2000){for(const [k,x] of attempts)if(x.until&&x.until<Date.now())attempts.delete(k)}}
 function cookie(res,token,maxAge){res.setHeader('Set-Cookie',COOKIE+'='+encodeURIComponent(token)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+maxAge+(secureCookies?'; Secure':''))}
 function clearCookie(res){cookie(res,'',0)}
 function userFor(req){
  const token=parseCookies(req.headers.cookie)[COOKIE];if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const row=db.prepare('SELECT s.id_hash,s.user_id,s.csrf_token_hash,s.expires_at,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=?').get(sha(token));
  if(!row)return null;if(Date.parse(row.expires_at)<=Date.now()){db.prepare('DELETE FROM sessions WHERE id_hash=?').run(row.id_hash);return null}
  return {id:row.user_id,username:row.username,sessionHash:row.id_hash,csrfHash:row.csrf_token_hash};
 }
 async function login(username,password,ip,res){
  const candidate=typeof username==='string'?username.trim().toLowerCase():'';
  const normalized=/^[a-z0-9][a-z0-9._-]{2,31}$/.test(candidate)?candidate:'';
  const key=String(ip||'unknown').slice(0,128),wait=retryAfter(key);if(wait)return {status:429,body:{error:'Unable to sign in. Try again later.'},retryAfter:wait};
  const row=db.prepare('SELECT * FROM users WHERE username=?').get(normalized);
  const valid=await verifyPassword(typeof password==='string'?password:'',row||await dummyPassword);
  if(!valid){failed(key);return {status:401,body:{error:'Invalid username or password.'}}}
  attempts.delete(key);const token=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(32).toString('hex'),now=new Date(),expires=new Date(now.getTime()+TTL).toISOString();
  db.prepare('INSERT INTO sessions(id_hash,user_id,csrf_token_hash,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?)').run(sha(token),row.id,sha(csrf),now.toISOString(),expires,now.toISOString());
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now.toISOString());audit(row.id,'auth.login');cookie(res,token,Math.floor(TTL/1000));
  return {status:200,body:{user:{username:row.username},csrfToken:csrf,expiresAt:expires}};
 }
 function rotateCsrf(user){const token=crypto.randomBytes(32).toString('hex');db.prepare('UPDATE sessions SET csrf_token_hash=?,last_seen_at=? WHERE id_hash=?').run(sha(token),new Date().toISOString(),user.sessionHash);return token}
 function csrfValid(user,token){if(!user||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return false;const a=Buffer.from(sha(token),'hex'),b=Buffer.from(user.csrfHash,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b)}
 function logout(user,res){if(user){db.prepare('DELETE FROM sessions WHERE id_hash=?').run(user.sessionHash);audit(user.id,'auth.logout')}clearCookie(res)}
 async function bootstrap(username,password){
  if(db.prepare('SELECT id FROM users LIMIT 1').get())throw new Error('Owner account already exists.');
  const name=String(username||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(name))throw new Error('Username must be 3–32 lowercase letters, numbers, dot, underscore or hyphen.');
  const p=await hashPassword(password),id=crypto.randomUUID(),now=new Date().toISOString();
  db.prepare('INSERT INTO users(id,username,password_hash,password_salt,password_params_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,name,p.password_hash,p.password_salt,p.password_params_json,now,now);audit(id,'auth.bootstrap');return {id,username:name};
 }
 return {login,userFor,rotateCsrf,csrfValid,logout,bootstrap,bootstrapExists:()=>Boolean(db.prepare('SELECT id FROM users LIMIT 1').get())};
}
module.exports={createAuth,COOKIE,TTL,parseCookies};
