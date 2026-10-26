import {it,expect} from 'vitest';
import {newTrip,makeConfiguredTrip,defaultItems,sharedItems,suggestedQuantity,normalizeTrip,type State,type TripDetails} from './data';
import {validPackingState,cleanPackingReferences} from './schema';
import {importPacking} from './import';
import {validateSnapshot} from '../sync/local';
const details:TripDetails={type:'tennis',startDate:'2026-10-27',returnDate:'2026-11-02',durationDays:7,departure:'',destination:'Chicago',climate:'mild',laundry:false,reminderMinutes:[]};
const state=():State=>{const t=makeConfiguredTrip('Tennis','tennis',details);return {trips:[t],activeId:t.id,theme:'system',sound:false};};
it('accepts real trip, default-list, feedback and template exports and creates independent imported trips',()=>{
 const s=state(),t=s.trips[0];s.templates=[{id:'template',name:'Bag',type:'tennis',items:t.items,categories:t.categories,quantities:t.quantities!,critical:t.critical!,lastMinute:t.lastMinute!}];s.defaultLists={tennis:s.templates[0]};
 s.feedback=[{itemId:t.items[0].id,name:t.items[0].name,packedQuantity:2,idealQuantity:1,rating:'too-many',tripType:'tennis',days:7,climate:'mild',laundry:false,createdAt:1}];
 expect(validPackingState(s)).toBe(true);let i=0;const next=importPacking(JSON.parse(JSON.stringify(s)),s,()=>`import-${++i}`);
 expect(next.trips).toHaveLength(2);expect(next.templates).toHaveLength(2);expect(next.trips[1].id).not.toBe(t.id);expect(next.trips[1].statuses).toEqual(t.statuses);expect(s.trips).toHaveLength(1);expect(validPackingState(next)).toBe(true);
 expect(importPacking([newTrip('Legacy')],s).trips).toHaveLength(2);
});
it('rejects malformed nested imports before altering existing state or importing partial data',()=>{
 const current=state(),original=JSON.stringify(current);
 const changes=[(s:any)=>s.trips[0].items[0].name=null,(s:any)=>s.trips[0].items[0].categoryId='missing',(s:any)=>s.trips[0].categories.push(s.trips[0].categories[0]),(s:any)=>s.trips[0].items.push(s.trips[0].items[0]),(s:any)=>s.trips[0].statuses[s.trips[0].items[0].id]='bad',(s:any)=>s.trips[0].queue.push('missing'),(s:any)=>s.trips[0].position=-1,(s:any)=>s.trips[0].quantities[s.trips[0].items[0].id]=1.5,(s:any)=>s.trips[0].critical=['missing'],(s:any)=>s.trips[0].verified={[s.trips[0].items[0].id]:'yes'},(s:any)=>s.trips[0].details.startDate='2026-02-31',(s:any)=>s.trips[0].details.reminderMinutes=['bad'],(s:any)=>s.templates=[{id:'broken'}],(s:any)=>s.feedback=[{itemId:'x'}],(s:any)=>s.observations=[{itemId:'x',type:'tennis',unused:'yes',date:1}],(s:any)=>s.wishlist=[{name:null,type:'tennis',date:1}],(s:any)=>s.activeId='missing'];
 for(const change of changes){const bad=JSON.parse(original);change(bad);expect(validPackingState(bad)).toBe(false);expect(()=>importPacking(bad,current)).toThrow();expect(JSON.stringify(current)).toBe(original);}
});
it('uses the same nested schema for cloud snapshots and safely cleans legacy deleted-item references',()=>{
 const s=state(),t=s.trips[0],removed=t.items[0].id;t.position=1;t.items=t.items.filter(i=>i.id!==removed);t.statuses[removed]='packed';t.quantities![removed]=2;t.verified={[removed]:true};
 const clean=cleanPackingReferences(s);expect(validPackingState(s)).toBe(false);expect(validPackingState(clean)).toBe(true);expect(clean.trips[0].position).toBe(0);expect(clean.trips[0].statuses[removed]).toBeUndefined();expect(validateSnapshot({'packly-v1':s})).toBe(true);
 const broken=structuredClone(clean);broken.trips[0].items[0].name=null as any;expect(validateSnapshot({'packly-v1':broken})).toBe(false);
});
it('gives equivalent English and Swedish items equal quantities across trip types, climate and laundry',()=>{
 const pairs=[['Kallingar','Underwear'],['Vanliga strumpor','Regular socks'],['Tennis strumpor','Tennis socks'],['T-shirt','Tennis T-shirts'],['Tshirt','T-shirts'],['Shorts','Tennis shorts'],['Tröja','Sweater'],['Mjukisbyxor','Sweatpants'],['Skjorta','Shirt']];
 for(const [sv,en] of pairs){const a=defaultItems.find(i=>i.name===sv)!,b=sharedItems.find(i=>i.name===en)!;for(const type of ['normal','tennis','match'] as const)for(const climate of ['warm','mild','cold'] as const)for(const laundry of [true,false])for(const days of [1,3,7,14])expect(suggestedQuantity(a,{...details,type,climate,laundry},days)).toBe(suggestedQuantity(b,{...details,type,climate,laundry},days));}
});
it('preserves quantity types after renaming, custom quantities and learned feedback',()=>{
 const t=state().trips[0],socks=t.items.find(i=>i.name==='Tennis strumpor')!;
 const renamed={...socks,name:'My lucky pairs'};expect(suggestedQuantity(renamed,details,7)).toBe(suggestedQuantity(socks,details,7));
 const old={...socks,name:'Renamed legacy item'};delete old.quantityType;expect(normalizeTrip({...t,items:[old],queue:[old.id]}).items[0].quantityType).toBe('socks');
 expect(suggestedQuantity(renamed,details,7,[{itemId:socks.id,name:'Old name',packedQuantity:10,idealQuantity:4,rating:'too-many',tripType:'tennis',days:7,climate:'mild',laundry:false,createdAt:1}])).toBe(4);
});
