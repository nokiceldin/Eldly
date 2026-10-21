import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {hash} from 'bcryptjs';
import {createAccountHandler} from './account-service.js';
let db,handler;
const owner='11111111-1111-4111-8111-111111111111',friend='22222222-2222-4222-8222-222222222222';
async function call(action,{method='POST',body={},cookie='',origin='https://app.test'}={}){
 const req={method,query:{action},body,headers:{host:'app.test',origin,cookie,'x-forwarded-for':'127.0.0.1'}};
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
