import { beforeEach, describe, expect, it, vi } from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());vi.mock('./client',()=>({supabase:{rpc},cloudNamespace:'test'}));
import {capture,enrolled,pull,start,synchronize,initialize} from './engine';
import {apply,flatten,type Records} from './records';
import {empty,onDay,type Data} from '../engine';
import {snapshot,writeLocal} from './local';
let revision=0,cloud:Records={}, history:{revision:number;record_key:string;value:unknown;deleted:boolean}[]=[];
let online=true, duringPush:(()=>void)|null=null;
function device(){const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);},clear:()=>map.clear()};}
const localA=device(),localB=device();
function use(storage:ReturnType<typeof device>){vi.stubGlobal('localStorage',storage);}
beforeEach(()=>{
 revision=0;cloud={};history=[];online=true;duringPush=null;localA.clear();localB.clear();use(localA);vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{locks:{request:async(_name:string,fn:()=>unknown)=>fn()}});
 rpc.mockReset();rpc.mockImplementation(async(name:string,args:any)=>{
  if(!online)return {error:{message:'Offline'}};
  if(name==='eldly_shared_pull')return {data:{initialized:revision>0,revision,records:history.filter(r=>r.revision>args.after_revision)}};
  if(name==='eldly_shared_initialize' && revision>0)return {data:false};
  revision++;for(const c of (args.changes || args.records)){cloud=apply(cloud,[{key:c.record_key,value:c.value,deleted:c.deleted}]);history.push({...c,revision});}
  duringPush?.();duringPush=null;return {data:revision};
 });
});
async function seed(){writeLocal('checkly-data-v1',empty());await initialize(true);while(await synchronize()){}await synchronize();}
describe('durable cloud sync',()=>{
 it('starts from existing data without deleting it and restores a second device',async()=>{
  await seed();const expected=snapshot();use(localB);expect(enrolled()).toBe(false);start(await pull());expect(snapshot()).toEqual(expected);expect(enrolled()).toBe(true);
 });
 it('preserves an offline edit through a reload and uploads on reconnect',async()=>{
  await seed();writeLocal('checkly-data-v1',{...empty(),sound:false});capture();online=false;await expect(synchronize()).rejects.toThrow('Offline');expect(JSON.parse(localStorage.getItem('eldly-shared-sync-v2:test')!).pending.length).toBeGreaterThan(0);
  online=true;await synchronize();await synchronize();expect((snapshot()['checkly-data-v1'] as any).sound).toBe(false);
  use(localB);start(await pull());expect((snapshot()['checkly-data-v1'] as any).sound).toBe(false);
 });
 it('keeps a newer edit made while an upload is in flight',async()=>{
  await seed();writeLocal('checkly-data-v1',{...empty(),sound:false});capture();
  duringPush=()=>{writeLocal('checkly-data-v1',{...empty(),sound:true});capture();};
  expect(await synchronize()).toBeGreaterThan(0);await synchronize();await synchronize();
  use(localB);start(await pull());expect((snapshot()['checkly-data-v1'] as any).sound).toBe(true);
 });
 it('does not import the second device over an initialized shared checklist',async()=>{
  await seed();use(localB);writeLocal('checkly-data-v1',{...empty(),categories:['Older laptop']});
  await initialize(true);
  expect((snapshot()['checkly-data-v1'] as any).categories).not.toEqual(['Older laptop']);
  expect(JSON.parse(localStorage.getItem('eldly-before-shared-v2')!).data['checkly-data-v1'].categories).toEqual(['Older laptop']);
 });
 it('restores existing cloud data without automatically uploading old local data',async()=>{
  await seed();const calls=rpc.mock.calls.length;use(localB);writeLocal('checkly-data-v1',{...empty(),sound:false});start(await pull());
  await synchronize();expect((snapshot()['checkly-data-v1'] as any).sound).toBe(true);
  expect(rpc.mock.calls.slice(calls).some(([name])=>name==='eldly_shared_apply')).toBe(false);
 });
 it('retains local data when remote records are invalid',async()=>{
  await seed();const before=snapshot();history.push({revision:++revision,record_key:JSON.stringify(['checkly-data-v1','version']),value:{node:'value',value:999},deleted:false});
  await expect(synchronize()).rejects.toThrow('Conflicting data');expect(snapshot()).toEqual(before);
 });
 it('shares one Sunday carryover and its later completion without duplicate tasks',async()=>{
  await seed();const d=empty();d.tasks=[{id:'sunday-task',title:'Homework',scheduled:'2026-10-18',original:'2026-10-18',category:'',notes:'',carry:true,important:false,order:0}];
  writeLocal('checkly-data-v1',d);capture();await synchronize();
  use(localB);start(await pull());
  const b=snapshot()['checkly-data-v1'] as Data;
  expect(onDay(b,'2026-10-19','2026-10-19').map(t=>t.id)).toEqual(['sunday-task']);
  writeLocal('checkly-data-v1',{...b,tasks:b.tasks.map(t=>({...t,completed:'2026-10-19'}))});capture();await synchronize();
  use(localA);await synchronize();const a=snapshot()['checkly-data-v1'] as Data;
  expect(a.tasks).toHaveLength(1);expect(onDay(a,'2026-10-18','2026-10-19')[0].completed).toBe('2026-10-19');expect(onDay(a,'2026-10-19','2026-10-19')[0].completed).toBe('2026-10-19');
 });
 it('merges different fields from two devices without resetting either',async()=>{
  await seed();use(localB);start(await pull());
  writeLocal('checkly-data-v1',{...empty(),categories:['Custom']});capture();
  use(localA);writeLocal('checkly-data-v1',{...empty(),sound:false});capture();await synchronize();
  use(localB);await synchronize();await synchronize();
  expect((snapshot()['checkly-data-v1'] as any).sound).toBe(false);expect((snapshot()['checkly-data-v1'] as any).categories).toEqual(['Custom']);
  use(localA);await synchronize();expect((snapshot()['checkly-data-v1'] as any).categories).toEqual(['Custom']);
 });
});
