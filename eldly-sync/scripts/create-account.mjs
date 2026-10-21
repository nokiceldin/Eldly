// Server-side operator tool. Never put the database URL or credentials in Vite envs.
// Supply DATABASE_URL and a JSON file via stdin:
// {"username":"...","password":"..."}. No public signup or owner reassignment.
import {neon} from '@neondatabase/serverless';
import {hash} from 'bcryptjs';
import {randomUUID} from 'node:crypto';
let input='';for await(const chunk of process.stdin)input+=chunk;
const {username,password}=JSON.parse(input);
if(typeof username!=='string'||!/^[a-z0-9_]{3,32}$/.test(username)||typeof password!=='string'||password.length<10)throw Error('Use a lowercase username and a password of at least 10 characters.');
if(!process.env.DATABASE_URL)throw Error('Supply the private server DATABASE_URL. Never use a VITE variable.');
const sql=neon(process.env.DATABASE_URL),id=randomUUID();
const passwordHash=await hash(password,12);
await sql.transaction([
 sql.query('insert into myspace_users(id,username,password_hash,app_metadata) values($1,$2,$3,$4::jsonb)',[id,username,passwordHash,JSON.stringify({username,legacy_owner:false})]),
 sql.query('insert into eldinos_accounts(user_id,username,legacy_owner) values($1,$2,false)',[id,username]),
]);
console.log(`Account ${username} is ready. It starts empty; no existing data was copied.`);
