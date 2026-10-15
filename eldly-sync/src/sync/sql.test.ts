import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { flatten } from './records';
import { empty } from '../engine';
let db:PGlite;
async function query(sql:string,args:unknown[]=[]){return db.query<any>(sql,args);}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec('create role anon; create role authenticated; create table public.unrelated_private(secret text); insert into unrelated_private values(\'kept private\');');
 await db.exec(await readFile(new URL('../../supabase/schema.sql',import.meta.url),'utf8'));
 // Running the migration twice must preserve data and policies.
 await db.exec(await readFile(new URL('../../supabase/schema.sql',import.meta.url),'utf8'));
 await db.exec('set role anon');
},20000);
afterAll(async()=>{await db?.close();});
describe('public shared SQL / RLS',()=>{
 it('initializes only once, without an account',async()=>{
  const records=Object.entries(flatten({'checkly-data-v1':empty()})).map(([record_key,value])=>({record_key,value}));
  expect((await query('select eldly_shared_initialize($1::jsonb) as ok',[JSON.stringify(records)])).rows[0].ok).toBe(true);
  expect((await query('select eldly_shared_initialize($1::jsonb) as ok',[JSON.stringify(records)])).rows[0].ok).toBe(false);
  const data=(await query('select eldly_shared_pull(0) as data')).rows[0].data;expect(data.initialized).toBe(true);expect(data.records.length).toBe(records.length);
 });
 it('grants only the shared tables, keeps RLS on and denies unrelated reads',async()=>{
  const tables=(await query("select relname,relrowsecurity from pg_class where relname in ('eldly_shared_state','eldly_shared_records')")).rows;
  expect(tables.every(t=>t.relrowsecurity)).toBe(true);
  await expect(query('select * from public.unrelated_private')).rejects.toThrow('permission denied');
  await expect(query("update eldly_shared_state set initialized=false")).rejects.toThrow('permission denied');
  await expect(query("insert into eldly_shared_records(dataset,record_key,value) values ('other','[]','{}')")).rejects.toThrow();
  await expect(query("insert into eldly_shared_records(record_key,value) values ('[\"unrelated\"]','{}')")).rejects.toThrow();
 });
 it('supports anonymous CRUD and exposes deletes to incremental readers',async()=>{
  const key=JSON.stringify(['checkly-data-v1','example']);
  await query('insert into eldly_shared_records(record_key,value) values($1,$2::jsonb)',[key,JSON.stringify({node:'value',value:'A'})]);
  await query('update eldly_shared_records set value=$2::jsonb where record_key=$1',[key,JSON.stringify({node:'value',value:'B'})]);
  const before=(await query('select eldly_shared_pull(0) as data')).rows[0].data.revision;
  await query('delete from eldly_shared_records where record_key=$1',[key]);
  const data=(await query('select eldly_shared_pull($1) as data',[before])).rows[0].data;
  expect(data.revision).toBeGreaterThan(before);expect(data.records).toEqual([{record_key:key,value:null,deleted:true}]);
 });
 it('rolls back an entire change set if any record is invalid',async()=>{
  const before=(await query('select eldly_shared_pull(0) as data')).rows[0].data;
  const changes=[{record_key:'["checkly-data-v1","example"]',value:{node:'value',value:3}},{record_key:'["unrelated"]',value:{}}];
  await expect(query('select eldly_shared_apply($1::jsonb)',[JSON.stringify(changes)])).rejects.toThrow();
  expect((await query('select eldly_shared_pull(0) as data')).rows[0].data).toEqual(before);
 });
});
