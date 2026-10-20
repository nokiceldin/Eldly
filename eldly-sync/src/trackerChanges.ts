import type { Habit } from './mapping';
/** Apply only this editor's changed trackers; preserve other devices' additions. */
export function mergeTrackerChanges(before:readonly Habit[],edited:readonly Habit[],latest:readonly Habit[]):Habit[]{
 const prior=new Map(before.map(h=>[h.id,h])),requested=new Map(edited.map(h=>[h.id,h])),current=new Map(latest.map(h=>[h.id,h]));
 for(const id of new Set([...prior.keys(),...requested.keys()])){
  const old=prior.get(id),next=requested.get(id);if(JSON.stringify(old)===JSON.stringify(next))continue;
  const remote=current.get(id);
  if(JSON.stringify(remote)!==JSON.stringify(old)&&JSON.stringify(remote)!==JSON.stringify(next))throw Error('This tracker changed on another device. Close and reopen trackers before editing it again.');
  if(next)current.set(id,next);else current.delete(id);
 }
 return [...current.values()];
}
export function validGoalTarget(target:number,maximum:boolean,kind:string){return Number.isFinite(target)&&(maximum?target>=0:target>0)&&(kind!=='check'||Number.isInteger(target)&&target<=7);}
