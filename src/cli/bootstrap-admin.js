'use strict';
const path=require('node:path');
const {openDatabase}=require('../db/database');
const {createAuth}=require('../auth/service');
const username=process.argv[2];
if(!username){console.error('Usage: npm run admin:bootstrap -- <username>');process.exit(2)}
if(!process.stdin.isTTY){console.error('Interactive terminal required; password is never accepted as a command argument.');process.exit(2)}
function askHidden(prompt){return new Promise(resolve=>{const input=process.stdin;let value='';process.stdout.write(prompt);input.setRawMode(true);input.resume();const onData=chunk=>{for(const ch of chunk.toString()){if(ch==='\u0003'){input.removeListener('data',onData);input.setRawMode(false);process.exit(130)}if(ch==='\r'||ch==='\n'){input.removeListener('data',onData);input.setRawMode(false);input.pause();process.stdout.write('\n');resolve(value)}else if(ch==='\u007f'||ch==='\b')value=value.slice(0,-1);else if(ch>=' ')value+=ch}};input.on('data',onData)})}
(async()=>{let db;try{const data=path.resolve(process.env.PORTAL_DATA_DIR||path.join(__dirname,'../../data'));const database=path.resolve(process.env.PORTAL_DB_PATH||path.join(data,'portal.sqlite'));db=openDatabase(database);const auth=createAuth(db);if(auth.bootstrapExists())throw new Error('Owner account already exists; bootstrap is one-time only.');const password=await askHidden('New password (12+ chars): '),confirm=await askHidden('Confirm password: ');if(password!==confirm)throw new Error('Passwords do not match.');const user=await auth.bootstrap(username,password);console.log('Owner account created:',user.username)}catch(e){console.error('Bootstrap failed:',e.message);process.exitCode=1}finally{if(db)db.close()}})();
