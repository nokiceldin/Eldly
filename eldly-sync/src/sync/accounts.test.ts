import { PGlite } from '@electric-sql/pglite';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {flatten} from './records';
import {empty} from '../engine';
let db:PGlite;
const owner='11111111-1111-4111-8111-111111111111',friend='22222222-2222-4222-8222-222222222222';
async function asUser(id:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${owner}','nokiceldin@accounts.eldinos.invalid'),('${friend}','henriquesa@accounts.eldinos.invalid');`);
 await db.exec(readFileSync(new URL('../../supabase/schema.sql',import.meta.url),'utf8'));
 const records=Object.entries(flatten({'checkly-data-v1':{...empty(),tasks:[{id:'private-task',title:'Only mine',scheduled:'2026-10-20',original:'2026-10-20',category:'',notes:'',carry:true,important:false,order:0}]}})).map(([record_key,value])=>({record_key,value}));
 await db.query('select eldly_shared_initialize($1::jsonb)',[JSON.stringify(records)]);
 await db.exec(readFileSync(new URL('../../supabase/accounts.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../supabase/activate-accounts.sql',import.meta.url),'utf8'));
},20000);
afterAll(async()=>{await db?.close();});
describe('private account migration and authorization',()=>{
 it('moves all legacy records to owner only and preserves the original recovery copy',async()=>{
  await asUser(owner);const result=await db.query<{data:any}>('select eldinos_account_pull(0) as data');expect(result.rows[0].data.initialized).toBe(true);expect(JSON.stringify(result.rows[0].data)).toContain('Only mine');
  await asUser(friend);const personal=await db.query<{data:any}>('select eldinos_account_pull(0) as data');expect(personal.rows[0].data).toEqual({initialized:false,revision:0,records:[]});
  await db.exec('reset role');const counts=await db.query<{n:number}>('select count(*)::int as n from eldly_shared_records');expect(counts.rows[0].n).toBeGreaterThan(0);
 });
 it('blocks old public RPCs, anonymous access and direct cross-account writes',async()=>{
  await db.exec('set role anon');await expect(db.query('select eldly_shared_pull(0)')).rejects.toThrow();await expect(db.query('select eldinos_account_pull(0)')).rejects.toThrow();await expect(db.query('select * from eldly_shared_records')).rejects.toThrow();
  await asUser(friend);expect((await db.query('select * from eldinos_account_records')).rows).toEqual([]);expect((await db.query('select * from eldinos_accounts')).rows).toHaveLength(1);
  await expect(db.query("insert into eldinos_account_records(user_id,record_key,value,revision) values($1,'[]','{}',1)",[owner])).rejects.toThrow();
 });
 it('keeps separate revisions and isolates initialization and edits',async()=>{
  await asUser(friend);const records=Object.entries(flatten({'checkly-data-v1':{...empty(),sampleLoaded:true,mapping:{version:1,entries:{},habits:[],startedOn:'2026-10-20'}}})).map(([record_key,value])=>({record_key,value}));
  await db.query('select eldinos_account_initialize($1::jsonb)',[JSON.stringify(records)]);
  const changes=[{record_key:'["checkly-data-v1","sound"]',value:{node:'value',value:false}}];await db.query('select eldinos_account_apply($1::jsonb)',[JSON.stringify(changes)]);
  const f=(await db.query<{data:any}>('select eldinos_account_pull(0) as data')).rows[0].data;expect(JSON.stringify(f)).not.toContain('Only mine');expect(f.revision).toBe(2);
  await asUser(owner);const o=(await db.query<{data:any}>('select eldinos_account_pull(0) as data')).rows[0].data;expect(JSON.stringify(o)).toContain('Only mine');expect(o.records.find((r:any)=>r.record_key==='["checkly-data-v1","sound"]').value.value).toBe(true);
 });
 it('denies self-provisioned users and rolls back invalid change sets',async()=>{
  await asUser('33333333-3333-4333-8333-333333333333');await expect(db.query('select eldinos_account_pull(0)')).rejects.toThrow('not provisioned');
  await asUser(friend);const before=(await db.query<{data:any}>('select eldinos_account_pull(0) as data')).rows[0].data;
  await expect(db.query('select eldinos_account_apply($1::jsonb)',[JSON.stringify([{record_key:'["other"]',value:{}}])])).rejects.toThrow();
  expect((await db.query<{data:any}>('select eldinos_account_pull(0) as data')).rows[0].data).toEqual(before);
 });
});
