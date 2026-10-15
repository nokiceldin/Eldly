import { beforeEach, describe, expect, it, vi } from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());vi.mock('./client',()=>({supabase:{rpc}}));
import {capture,enrolled,pull,start,synchronize} from './engine';
import {apply,flatten,type Records} from './records';
import {empty} from '../engine';
import {snapshot,writeLocal} from './local';
let revision=0,cloud:Records={}, history:{revision:number;record_key:string;value:unknown;deleted:boolean}[]=[];
let online=true, duringPush:(()=>void)|null=null;
function device(){const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);},clear:()=>map.clear()};}
const user='owner';const localA=device(),localB=device();
function use(storage:ReturnType<typeof device>){vi.stubGlobal('localStorage',storage);}
beforeEach(()=>{
 revision=0;cloud={};history=[];online=true;duringPush=null;localA.clear();localB.clear();use(localA);vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{locks:{request:async(_name:string,fn:()=>unknown)=>fn()}});
 rpc.mockReset();rpc.mockImplementation(async(name:string,args:any)=>{
  if(!online)return {error:{message:'Offline'}};
  if(name==='eldly_pull')return {data:{revision,records:history.filter(r=>r.revision>args.after_revision)}};
  revision++;for(const c of args.changes){cloud=apply(cloud,[{key:c.record_key,value:c.value,deleted:c.deleted}]);history.push({...c,revision});}
  duringPush?.();duringPush=null;return {data:revision};
 });
});
async function seed(){writeLocal('checkly-data-v1',empty());start(user,await pull(),true);while(await synchronize(user)){}await synchronize(user);}
describe('durable cloud sync',()=>{
 it('starts from existing data without deleting it and restores a second device',async()=>{
  await seed();const expected=snapshot();use(localB);expect(enrolled(user)).toBe(false);start(user,await pull(),false);expect(snapshot()).toEqual(expected);expect(enrolled(user)).toBe(true);
 });
 it('preserves an offline edit through a reload and uploads on reconnect',async()=>{
  await seed();writeLocal('checkly-data-v1',{...empty(),sound:false});capture(user);online=false;await expect(synchronize(user)).rejects.toThrow('Offline');expect(JSON.parse(localStorage.getItem('eldly-cloud-v1:owner')!).pending.length).toBeGreaterThan(0);
  online=true;await synchronize(user);await synchronize(user);expect((snapshot()['checkly-data-v1'] as any).sound).toBe(false);
  use(localB);start(user,await pull(),false);expect((snapshot()['checkly-data-v1'] as any).sound).toBe(false);
 });
 it('keeps a newer edit made while an upload is in flight',async()=>{
  await seed();writeLocal('checkly-data-v1',{...empty(),sound:false});capture(user);
  duringPush=()=>{writeLocal('checkly-data-v1',{...empty(),sound:true});capture(user);};
  expect(await synchronize(user)).toBeGreaterThan(0);await synchronize(user);await synchronize(user);
  use(localB);start(user,await pull(),false);expect((snapshot()['checkly-data-v1'] as any).sound).toBe(true);
 });
 it('does not mark a different account as enrolled or automatically queue its data',async()=>{
  await seed();expect(enrolled('another-user')).toBe(false);capture('another-user');expect(localStorage.getItem('eldly-cloud-v1:another-user')).toBeNull();
 });
 it('retains local data when remote records are invalid',async()=>{
  await seed();const before=snapshot();history.push({revision:++revision,record_key:JSON.stringify(['checkly-data-v1','version']),value:{node:'value',value:999},deleted:false});
  await expect(synchronize(user)).rejects.toThrow('Conflicting data');expect(snapshot()).toEqual(before);
 });
 it('merges different fields from two devices without resetting either',async()=>{
  await seed();use(localB);start(user,await pull(),false);
  writeLocal('checkly-data-v1',{...empty(),categories:['Custom']});capture(user);
  use(localA);writeLocal('checkly-data-v1',{...empty(),sound:false});capture(user);await synchronize(user);
  use(localB);await synchronize(user);await synchronize(user);
  expect((snapshot()['checkly-data-v1'] as any).sound).toBe(false);expect((snapshot()['checkly-data-v1'] as any).categories).toEqual(['Custom']);
  use(localA);await synchronize(user);expect((snapshot()['checkly-data-v1'] as any).categories).toEqual(['Custom']);
 });
});
