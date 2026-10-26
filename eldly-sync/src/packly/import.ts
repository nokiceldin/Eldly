import {uid,type State} from './data';
import {validPackingState,cleanPackingReferences} from './schema';
export function importPacking(value:unknown,current:State,newId=uid):State{
 const root:any=Array.isArray(value)?{trips:value}:value;
 if(!root||typeof root!=='object')throw Error('Invalid packing backup.');
 const trips=Array.isArray(root.trips)?root.trips:[root];
 const candidate={theme:'system',sound:false,...(Array.isArray(root.trips)?root:{}),trips,activeId:root.activeId??trips[0]?.id};
 if(!validPackingState(candidate))throw Error('Invalid packing backup.');
 const added=trips.map((t:any)=>({...t,id:newId(),name:(t.name+' (imported)').slice(0,200)}));
 const merged={...current,trips:[...current.trips,...added],activeId:added[0].id,defaultLists:{...current.defaultLists,...candidate.defaultLists},feedback:[...(current.feedback||[]),...(candidate.feedback||[])],templates:[...(current.templates||[]),...(candidate.templates||[]).map((t:any)=>({...t,id:newId()}))],observations:[...(current.observations||[]),...(candidate.observations||[])],wishlist:[...(current.wishlist||[]),...(candidate.wishlist||[])]};
 if(!validPackingState(cleanPackingReferences(merged)))throw Error('Packing backup is too large or invalid.');
 return merged;
}
