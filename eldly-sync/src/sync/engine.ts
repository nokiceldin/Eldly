import { supabase } from './client';
import { apply, acknowledge, diff, flatten, inflate, type Change, type Records } from './records';
import { snapshot, restore, validateSnapshot } from './local';
type State = {version:1; mirror: Records; baseline: Records; pending: Change[]; revision:number};
export type Pull = {revision:number; records:{record_key:string;value:unknown;deleted:boolean}[]};
const stateKey = (id:string) => `eldly-cloud-v1:${id}`;
export function enrolled(id:string) { return localStorage.getItem("eldly-device-owner") === id && localStorage.getItem(stateKey(id)) !== null; }
function read(id:string):State { const raw=localStorage.getItem(stateKey(id)); if(!raw) throw Error('Choose your starting data first.'); const state=JSON.parse(raw); if(state.version!==1) throw Error('Sync data needs a newer Eldly version.'); return state; }
function write(id:string,s:State) { localStorage.setItem(stateKey(id),JSON.stringify(s)); }
export async function pull(revision=0):Promise<Pull> {
  const {data,error}=await supabase!.rpc('eldly_pull',{after_revision:revision});
  if(error) throw Error(error.message); if(!data || !Number.isSafeInteger(data.revision) || !Array.isArray(data.records)) throw Error('Invalid cloud response.'); return data;
}
export function capture(id:string) {
  if(!enrolled(id)) return;
  const s=read(id), current=flatten(snapshot()), changes=diff(s.baseline,current);
  if(!changes.length) return;
  const byKey = new Map(s.pending.map(c=>[c.key,c])); changes.forEach(c=>byKey.set(c.key,c));
  write(id,{...s,baseline:current,pending:[...byKey.values()]});
}
export function start(id:string,remote:Pull,useDevice:boolean) {
  const mirror=apply({},remote.records.map(r=>({key:r.record_key,value:r.value,deleted:r.deleted})));
  const local=snapshot();
  if(!validateSnapshot(local)) throw Error('Export and repair your local data before starting sync.');
  // Keep a recoverable copy before replacing anything on this device.
  localStorage.setItem(`eldly-before-cloud:${id}`,JSON.stringify({version:1,data:local}));
  const baseline=useDevice?flatten(local):mirror;
  const decoded=inflate(baseline);
  if(!validateSnapshot(decoded)) throw Error('Cloud data is incompatible; local data was kept.');
  if(!useDevice) restore(decoded);
  write(id,{version:1,mirror,baseline,pending:useDevice?diff(mirror,baseline):[],revision:remote.revision});
  localStorage.setItem("eldly-device-owner",id);
}
export async function synchronize(id:string):Promise<number> {
  // Serialize tabs so one tab cannot acknowledge another tab's unsent edits.
  const run=async()=>{
    capture(id);
    let s=read(id);
    const remote=await pull(s.revision);
    capture(id); s=read(id);
    const mirror=apply(s.mirror,remote.records.map(r=>({key:r.record_key,value:r.value,deleted:r.deleted})));
    const merged=apply(mirror,s.pending), decoded=inflate(merged);
    if(!validateSnapshot(decoded)) throw Error('Conflicting data could not be merged. Your edits are safe on this device; retry or export a backup.');
    restore(decoded);
    s={...s,mirror,baseline:merged,revision:remote.revision}; write(id,s);
    // Small batches keep requests within database limits.
    const sent=s.pending.slice(0,400);
    if(sent.length){
      const {error}=await supabase!.rpc('eldly_apply',{changes:sent.map(c=>({record_key:c.key,value:c.value??null,deleted:!!c.deleted}))});
      if(error) throw Error(error.message);
      capture(id); const latest=read(id);
      write(id,{...latest,pending:acknowledge(latest.pending,sent)});
      // Do not advance the cursor until the committed changes are pulled.
    }
    return read(id).pending.length;
  };
  return navigator.locks ? navigator.locks.request('eldly-cloud-sync',run) : run();
}
