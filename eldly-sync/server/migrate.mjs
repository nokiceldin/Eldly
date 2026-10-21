import {readFileSync} from 'node:fs';
import {neon} from '@neondatabase/serverless';
const url=(process.env.DATABASE_URL||readFileSync('/tmp/myspace-neon-url','utf8').trim());
const sql=neon(url);
const backup=JSON.parse(readFileSync(process.argv[2],'utf8'));
const existing=await sql.query("select to_regclass('public.myspace_users') as name");
if(existing[0].name){const rows=await sql.query('select count(*)::int as n from myspace_users');if(rows[0].n)throw Error('Target already contains users; refusing to overwrite.');}
const schema=readFileSync(new URL('./schema.sql',import.meta.url),'utf8').replace(/^begin;|^commit;/gm,'');
const statements=[];let statement='',dollar=false;
for(let i=0;i<schema.length;i++){
 if(schema.slice(i,i+2)==='$$'){dollar=!dollar;statement+='$$';i++;continue;}
 if(schema[i]===';'&&!dollar){if(statement.trim())statements.push(statement);statement='';}else statement+=schema[i];
}
if(statement.trim())statements.push(statement);
await sql.transaction(statements.map(s=>sql.query(s)));
const queries=[];
for(const account of backup.accounts){
 const auth=backup.auth.find(u=>u.id===account.user_id);if(!auth)throw Error('Missing credentials');
 queries.push(sql.query('insert into myspace_users(id,username,password_hash,app_metadata) values($1,$2,$3,$4::jsonb)',[auth.id,account.username,auth.password_hash,JSON.stringify({...auth.app_metadata,legacy_owner:account.legacy_owner})]));
 queries.push(sql.query('insert into eldinos_accounts(user_id,username,legacy_owner,created_at) values($1,$2,$3,$4)',[account.user_id,account.username,account.legacy_owner,account.created_at]));
}
for(const s of backup.state)queries.push(sql.query('insert into eldinos_account_state(user_id,revision,initialized) values($1,$2,$3)',[s.user_id,s.revision,s.initialized]));
// One transaction imports all owners, credentials, states and records together.
queries.push(sql.query(`insert into eldinos_account_records(user_id,record_key,value,deleted,revision) select user_id,record_key,value,deleted,revision from jsonb_to_recordset($1::jsonb) as r(user_id uuid,record_key text,value jsonb,deleted boolean,revision bigint)`,[JSON.stringify(backup.records)]));
await sql.transaction(queries);
const actual=await sql.query('select user_id,record_key,value,deleted,revision from eldinos_account_records order by user_id,record_key');
const canonical=rows=>JSON.stringify(rows.map(r=>({user_id:r.user_id,record_key:r.record_key,value:r.value,deleted:r.deleted,revision:Number(r.revision)})).sort((a,b)=>a.user_id.localeCompare(b.user_id)||a.record_key.localeCompare(b.record_key)));
if(canonical(actual)!==canonical(backup.records))throw Error('Migration verification failed');
console.log('Verified exact migration:',actual.length,'records;',backup.accounts.length,'private accounts.');
