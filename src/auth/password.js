'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const PARAMS=Object.freeze({N:1<<15,r:8,p:1,keyLength:64});
async function hashPassword(password){
 if(typeof password!=='string'||password.length<12||Buffer.byteLength(password,'utf8')>1024)throw new Error('Password must be 12–1024 bytes.');
 const salt=crypto.randomBytes(16),hash=await scrypt(password,salt,PARAMS.keyLength,{...PARAMS,maxmem:64*1024*1024});
 return {password_hash:hash.toString('hex'),password_salt:salt.toString('hex'),password_params_json:JSON.stringify(PARAMS)};
}
async function verifyPassword(password,row){
 if(typeof password!=='string'||!row)return false;
 try{const p=JSON.parse(row.password_params_json),hash=await scrypt(password,Buffer.from(row.password_salt,'hex'),p.keyLength,{N:p.N,r:p.r,p:p.p,maxmem:64*1024*1024}),stored=Buffer.from(row.password_hash,'hex');return stored.length===hash.length&&crypto.timingSafeEqual(stored,hash)}catch{return false}
}
module.exports={hashPassword,verifyPassword};
