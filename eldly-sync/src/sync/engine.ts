import { scopedKey, scopeEpoch, accountScope, isPersonalOwner } from "../accountScope";
import { supabase, cloudNamespace } from './client';
import { apply, acknowledge, diff, flatten, inflate, type Change, type Records } from './records';
import { snapshot, restore, validateSnapshot, retainSnapshot, pruneLocalHistory, type Snapshot } from './local';
import { empty } from '../engine';
import { cacheCoinPolicy,cacheGiftBalance,type CoinPolicy } from '../coinControl';
type State = {version:1; mirror: Records; baseline: Records; pending: Change[]; revision:number};
export type Pull = {initialized:boolean; revision:number; reset?:boolean; records:{record_key:string;value:unknown;deleted:boolean}[];coinPolicy?:CoinPolicy|null;giftBalance?:number};
const KEY = `eldly-shared-sync-v2:${cloudNamespace}`;
export function enrolled() { return localStorage.getItem(scopedKey(KEY)) !== null; }
function retainedRecords(records: Records): Records {
  return flatten(retainSnapshot(inflate(records) as Snapshot, false));
}
function retainState(state: State): State {
  const mirror = retainedRecords(state.mirror);
  const merged = retainedRecords(apply(state.mirror, state.pending));
  const pending = state.pending.flatMap(change => {
    const path = JSON.parse(change.key) as string[];
    if (path[0] === 'packly-v1' || (path[1] === 'journal' && !isPersonalOwner())) return [];
    if (!['tasks', 'overrides', 'routines'].includes(path[1])) return [change];
    if (path.length === 2 && change.key in merged) return [{ ...change, value: merged[change.key], deleted: false }];
    const taskKey = JSON.stringify(path.slice(0, 3));
    return taskKey in merged || (change.deleted && taskKey in mirror) ? [change] : [];
  });
  return { ...state, mirror, pending, baseline: retainedRecords(state.baseline) };
}
function rebaseAfterPruning(state: State, mirror: Records): Change[] {
  const local = apply(state.mirror, state.pending);
  const historyKey = '["checkly-data-v1","taskHistoryFrom"]';
  const week = (mirror[historyKey] as { value?: string } | undefined)?.value;
  const localWeek = (local[historyKey] as { value?: string } | undefined)?.value;
  return state.pending.filter(change => {
    const path = JSON.parse(change.key) as string[];
    if (!['tasks', 'overrides', 'routines'].includes(path[1]) || path.length < 3) return true;
    const group = JSON.stringify(path.slice(0, 3));
    if (group in mirror) return true;
    if (group in state.mirror) return false;
    const carry = local[JSON.stringify([...path.slice(0, 3), 'carriedFromHistory'])] as { value?: boolean } | undefined;
    return !(carry?.value && week && localWeek && week >= localWeek);
  });
}
function read(): State {
  const raw = localStorage.getItem(scopedKey(KEY));
  if (!raw) throw Error('Choose your starting data first.');
  const state = JSON.parse(raw);
  if (state.version !== 1) throw Error('Sync data needs a newer Eldinos version.');
  return retainState({ ...state, baseline: flatten(state.baseline) });
}
function write(s: State) {
  const key = scopedKey(KEY);
  const raw = JSON.stringify({ ...s, baseline: inflate(s.baseline) });
  if (localStorage.getItem(key) !== raw) localStorage.setItem(key, raw);
}
export async function pull(revision=0):Promise<Pull> {
  const {data,error}=await supabase!.rpc('eldly_shared_pull',{after_revision:revision});
  if(error) throw Error(error.message); if(!data || typeof data.initialized !== 'boolean' || !Number.isSafeInteger(data.revision) || !Array.isArray(data.records)) throw Error('Invalid cloud response.'); return data;
}
export function capture() {
  pruneLocalHistory();
  if(!enrolled()) return;
  const s=read(), current=flatten(snapshot()), changes=diff(s.baseline,current);
  if(!changes.length) { write(s); return; }
  const byKey = new Map(s.pending.map(c=>[c.key,c])); changes.forEach(c=>byKey.set(c.key,c));
  write({...s,baseline:current,pending:[...byKey.values()]});
}
export function start(remote:Pull) {
  if(!remote.initialized) throw Error('The shared checklist has not been initialized.');
  const mirror=apply({},remote.records.map(r=>({key:r.record_key,value:r.value,deleted:r.deleted})));
  const local=snapshot(), decoded=inflate(mirror);
  if(!validateSnapshot(local) || !validateSnapshot(decoded)) throw Error('Saved data is incompatible. Export a backup before continuing.');
  // The old device copy remains recoverable, never automatically re-uploaded.
  const backup=scopedKey('eldly-before-shared-v2');
  if(!localStorage.getItem(backup)) localStorage.setItem(backup,JSON.stringify({version:1,data:local}));
  restore(decoded);
  if('coinPolicy' in remote)cacheCoinPolicy(remote.coinPolicy||null);
  if('giftBalance' in remote)cacheGiftBalance(remote.giftBalance||0);
  const retained = retainedRecords(mirror);
  write({version:1,mirror:retained,baseline:retained,pending:[],revision:remote.revision});
}
export function hasLocalData() { return Object.keys(snapshot()).length > 0; }
export async function initialize(useLocal:boolean) {
  const epoch=scopeEpoch();
  const value=useLocal?snapshot():retainSnapshot({'checkly-data-v1':{...empty(),sampleLoaded:true}});
  if(!validateSnapshot(value)) throw Error('Local data is invalid; export it before continuing.');
  // Server-side lock + initialized flag ensure only the first device imports.
  const {error}=await supabase.rpc('eldly_shared_initialize', {records:Object.entries(flatten(value)).map(([record_key,value])=>({record_key,value}))});
  if(error) throw Error(error.message);
  // A competing device may have initialized first. Always use the winner.
  if(epoch!==scopeEpoch())throw Error("Account changed. Initialization stopped.");
  const remote=await pull();
  if(epoch!==scopeEpoch())throw Error("Account changed. Initialization stopped.");
  start(remote);
}
export async function synchronize():Promise<number> {
  // Serialize tabs so one tab cannot acknowledge another tab's unsent edits.
  const epoch=scopeEpoch();
  const assertScope=()=>{if(scopeEpoch()!==epoch)throw Error("Account changed. Sync stopped.");};
  const run=async()=>{
    assertScope();
    capture();
    let s=read();
    const remote=await pull(s.revision);
    assertScope(); capture(); s=read();
    if('coinPolicy' in remote)cacheCoinPolicy(remote.coinPolicy||null);
    if('giftBalance' in remote)cacheGiftBalance(remote.giftBalance||0);
    const mirror=apply(remote.reset ? {} : s.mirror,remote.records.map(r=>({key:r.record_key,value:r.value,deleted:r.deleted})));
    if (remote.reset) s.pending = rebaseAfterPruning(s, mirror);
    const merged=apply(mirror,s.pending), decoded=inflate(merged);
    if(!validateSnapshot(decoded)) throw Error('Conflicting data could not be merged. Your edits are safe on this device; retry or export a backup.');
    restore(decoded);
    s=retainState({...s,mirror,baseline:merged,revision:remote.revision}); write(s);
    // One atomic change set: another device never sees half of a new task.
    const sent=s.pending;
    if(sent.length){
      const {error}=await supabase!.rpc('eldly_shared_apply',{base_revision:remote.revision,changes:sent.map(c=>({record_key:c.key,value:c.value??null,deleted:!!c.deleted}))});
      if(error) throw Error(error.message);
      assertScope(); capture(); const latest=read();
      write({...latest,pending:acknowledge(latest.pending,sent)});
      // Do not advance the cursor until the committed changes are pulled.
    }
    return read().pending.length;
  };
  return navigator.locks ? navigator.locks.request(`eldinos-sync:${accountScope()||'legacy'}`,run) : run();
}

export function syncSummary(){try{const s=read();return {revision:s.revision,pending:s.pending.length};}catch{return {revision:0,pending:0};}}
