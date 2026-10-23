import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {hash,compare} from 'bcryptjs';
import {createAccountHandler} from './account-service.js';
let db,handler;
const owner='11111111-1111-4111-8111-111111111111',friend='22222222-2222-4222-8222-222222222222';
async function call(action,{method='POST',body={},cookie='',origin='https://app.test',ip='127.0.0.1'}={}){
 const req={method,query:{action},body,headers:{host:'app.test',origin,cookie,'x-forwarded-for':ip}};
 const result={statusCode:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
 await handler(req,result);return result;
}
beforeAll(async()=>{
 db=new PGlite();await db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
 handler=createAccountHandler({query:async(q,p)=>(await db.query(q,p)).rows});
 for(const [id,name,legacy] of [[owner,'owner',true],[friend,'friend',false]]){
  await db.query('insert into myspace_users values($1,$2,$3,$4,true)',[id,name,await hash('testing-password',4),JSON.stringify({legacy_owner:legacy})]);
  await db.query('insert into eldinos_accounts(user_id,username,legacy_owner) values($1,$2,$3)',[id,name,legacy]);
  await db.query('select myspace_account_initialize($1,$2)',[id,JSON.stringify([{record_key:'[]',value:{node:'object'}},{record_key:'["checkly-data-v1"]',value:{node:'object'}},{record_key:'["checkly-data-v1","private"]',value:{node:'value',value:name}}])]);
 }
},20000);
afterAll(async()=>{await db?.close();});
it('signs in with private secure cookies and separates the accounts even when a caller supplies another user ID',async()=>{
 const login=await call('login',{body:{email:'friend@accounts.eldinos.invalid',password:'testing-password'}});
 expect(login.statusCode).toBe(200);expect(login.headers['Set-Cookie']).toContain('HttpOnly; Secure; SameSite=Lax');expect(login.body.user).not.toHaveProperty('password_hash');
 const cookie=login.headers['Set-Cookie'].split(';')[0];
 const pull=await call('rpc',{cookie,body:{name:'eldinos_account_pull',args:{after_revision:0,user_id:owner}}});
 expect(pull.statusCode).toBe(200);expect(JSON.stringify(pull.body)).toContain('friend');expect(JSON.stringify(pull.body)).not.toContain('owner');
 const second=await call('login',{body:{email:'friend@accounts.eldinos.invalid',password:'testing-password'}});
 await call('logout',{cookie});expect((await call('session',{method:'GET',cookie})).body.user).toBeNull();
 expect((await call('session',{method:'GET',cookie:second.headers['Set-Cookie'].split(';')[0]})).body.user.id).toBe(friend);
});
it('rejects unauthenticated requests, cross-site writes and incorrect passwords',async()=>{
 expect((await call('rpc',{body:{name:'eldinos_account_pull'}})).statusCode).toBe(401);
 expect((await call('login',{origin:'https://evil.test'})).statusCode).toBe(403);
 const wrong=await call('login',{body:{email:'owner@accounts.eldinos.invalid',password:'wrong'}});expect(wrong.statusCode).toBe(400);expect(wrong.body.code).toBe('invalid_credentials');
});
it('adds and removes data atomically within only the signed-in account',async()=>{
 const login=await call('login',{body:{email:'owner@accounts.eldinos.invalid',password:'testing-password'}});const cookie=login.headers['Set-Cookie'].split(';')[0];
 const key='["checkly-data-v1","qa"]';
 const rpc=changes=>call('rpc',{cookie,body:{name:'eldinos_account_apply',args:{changes}}});
 expect((await rpc([{record_key:key,value:{node:'value',value:'temporary'}}])).statusCode).toBe(200);
 expect((await db.query('select value from eldinos_account_records where user_id=$1 and record_key=$2',[owner,key])).rows[0].value.value).toBe('temporary');
 expect((await rpc([{record_key:key,deleted:true}])).statusCode).toBe(200);
 expect((await db.query('select deleted from eldinos_account_records where user_id=$1 and record_key=$2',[owner,key])).rows[0].deleted).toBe(true);
 const before=(await db.query('select revision from eldinos_account_state where user_id=$1',[owner])).rows[0].revision;
 expect((await rpc([{record_key:'["other-account"]',value:{node:'value',value:1}}])).statusCode).toBe(400);
 expect((await db.query('select revision from eldinos_account_state where user_id=$1',[owner])).rows[0].revision).toBe(before);
 expect((await db.query('select * from eldinos_account_records where user_id=$1 and record_key=$2',[friend,key])).rows).toHaveLength(0);
});
it('registers a normalized non-owner account, persists only a password hash and resumes saved data after a fresh login',async()=>{
 const body={username:'  New_Friend  ',password:'my-friend-password',avatarId:'cedar',legacy_owner:true,app_metadata:{legacy_owner:true},user_id:owner};
 expect((await call('register',{body:{...body,avatarId:'custom'}})).statusCode).toBe(400);
 const registered=await call('register',{body});
 expect(registered.statusCode).toBe(201);
 expect(registered.body.user.app_metadata).toEqual({username:'new_friend',legacy_owner:false});
 expect(registered.body.user).not.toHaveProperty('password_hash');
 expect((await db.query('select avatar_preset from myspace_profiles where user_id=$1',[registered.body.user.id])).rows[0].avatar_preset).toBe(body.avatarId||'original');
 const id=registered.body.user.id,cookie=registered.headers['Set-Cookie'].split(';')[0];
 const stored=(await db.query('select * from myspace_users where id=$1',[id])).rows[0];
 expect(stored.password_hash).not.toBe(body.password);expect(await compare(body.password,stored.password_hash)).toBe(true);
 expect(registered.headers['Set-Cookie']).toContain('HttpOnly; Secure; SameSite=Lax');
 expect((await call('session',{method:'GET',cookie})).body.user.id).toBe(id);
 const rpc=(cookie,name,args)=>call('rpc',{cookie,body:{name,args}});
 expect((await rpc(cookie,'eldinos_account_pull',{after_revision:0})).body.data).toEqual({initialized:false,revision:0,records:[],coinPolicy:null});
 const records=[{record_key:'[]',value:{node:'object'}},{record_key:'["checkly-data-v1"]',value:{node:'object'}}];
 expect((await rpc(cookie,'eldinos_account_initialize',{records})).statusCode).toBe(200);
 const record={record_key:'["checkly-data-v1","my-task"]',value:{node:'value',value:'Friend task'}};
 expect((await rpc(cookie,'eldinos_account_apply',{changes:[record],user_id:owner})).statusCode).toBe(200);
 await call('logout',{cookie});
 const login=await call('login',{body:{email:'NEW_FRIEND@accounts.eldinos.invalid',password:body.password}});
 expect(login.statusCode).toBe(200);expect(login.body.user.id).toBe(id);
 const reopened=await rpc(login.headers['Set-Cookie'].split(';')[0],'eldinos_account_pull',{after_revision:0});
 expect(reopened.body.data.records).toContainEqual({...record,deleted:false});
 expect((await db.query('select * from eldinos_account_records where user_id=$1 and record_key=$2',[owner,record.record_key])).rows).toHaveLength(0);
});
it('rejects taken usernames case-insensitively without creating partial accounts or replacing a password',async()=>{
 const counts=async()=> (await db.query('select (select count(*) from myspace_users) as users,(select count(*) from eldinos_accounts) as accounts,(select count(*) from myspace_sessions) as sessions')).rows[0];
 const before=await counts();
 const result=await call('register',{body:{username:' OWNER ',password:'different-password'}});
 expect(result.statusCode).toBe(409);expect(result.body.code).toBe('username_taken');expect(result.headers['Set-Cookie']).toBeUndefined();
 expect(await counts()).toEqual(before);
 expect((await call('login',{body:{email:'owner',password:'testing-password'}})).statusCode).toBe(200);
});
it('rejects invalid registration input, cross-site writes and non-POST registration',async()=>{
 for(const body of [{username:'ab',password:'long-password'},{username:'bad@name',password:'long-password'},{username:'valid_name',password:'short'},{username:'valid_name',password:'a'.repeat(73)},{username:'valid_name',password:'🙂'.repeat(19)},{username:'valid_name',password:12345678}]){
  expect((await call('register',{body})).statusCode).toBe(400);
 }
 expect((await call('register',{origin:'https://evil.test',body:{username:'cross_site',password:'long-password'}})).statusCode).toBe(403);
 expect((await call('register',{method:'GET'})).statusCode).not.toBe(201);
 expect((await db.query("select * from myspace_users where username in ('valid_name','cross_site')")).rows).toHaveLength(0);
});
it('rolls back registration if workspace creation fails',async()=>{
 await db.exec("alter table eldinos_accounts add constraint test_registration_failure check(username <> 'rollback_friend')");
 try{
  const result=await call('register',{body:{username:'rollback_friend',password:'long-password'}});
  expect(result.statusCode).toBe(400);expect(result.headers['Set-Cookie']).toBeUndefined();
  expect((await db.query("select * from myspace_users where username='rollback_friend'")).rows).toHaveLength(0);
 }finally{await db.exec('alter table eldinos_accounts drop constraint test_registration_failure');}
});
it('limits registration attempts across usernames without adding a user verification step',async()=>{
 const ip='192.0.2.10';
 await db.query("insert into myspace_login_attempts(attempt_key,attempts) values(encode(sha256('register|192.0.2.10'::bytea),'hex'),15)");
 const result=await call('register',{ip,body:{username:'limited_friend',password:'long-password'}});
 expect(result.statusCode).toBe(429);expect(result.body.code).toBe('registration_rate_limit');
 expect((await db.query("select * from myspace_users where username='limited_friend'")).rows).toHaveLength(0);
});
it('protects social endpoints with the existing session and origin checks and ignores forged identities',async()=>{
 expect((await call('social',{method:'GET'})).statusCode).toBe(401);
 expect((await call('social',{origin:'https://evil.test',body:{action:'visit'}})).statusCode).toBe(403);
 const login=await call('login',{body:{email:'friend',password:'testing-password'}}),cookie=login.headers['Set-Cookie'].split(';')[0];
 const visit=await call('social',{cookie,body:{action:'visit',timezone:'UTC',user_id:owner,streak:1000,day:'2099-01-01'}});
 expect(visit.statusCode).toBe(200);expect(visit.body.profile).toMatchObject({id:friend,username:'friend',streak:1});
 const forged=await call('social',{cookie,body:{action:'save_avatar',userId:owner,avatarId:'cedar'}});
 expect(forged.statusCode).toBe(200);expect(forged.body.profile.id).toBe(friend);expect((await db.query('select avatar from myspace_profiles where user_id=$1',[owner])).rows).toEqual([]);
 expect((await call('social',{cookie,body:{action:'goal_events',events:['fake']}})).statusCode).toBe(400);
});
