import type {State,Trip,Template} from './data';
const object=(v:any)=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:any,max=200,empty=false)=>typeof v==='string'&&v.length<=max&&(empty||v.trim().length>0);
const id=(v:any)=>text(v,150)&&!['__proto__','constructor','prototype'].includes(v);
const integer=(v:any,min=0,max=1000000)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const time=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=8640000000000000;
const types=['normal','tennis','match','weekend','custom'];
const climates=['warm','mild','cold','unknown'];
const date=(v:any,empty=true)=>typeof v==='string'&&(empty&&v===''||/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v);
const optional=(v:any,check:(v:any)=>boolean)=>v===undefined||check(v);
const list=(v:any,check:(v:any)=>boolean,max=2000)=>Array.isArray(v)&&v.length<=max&&v.every(check);
const unique=(v:any[])=>new Set(v).size===v.length;
function contents(v:any){
 if(!object(v)||!list(v.categories,c=>object(c)&&id(c.id)&&text(c.name)&&text(c.emoji,40),100)||!unique(v.categories.map((c:any)=>c.id)))return false;
 const categories=new Set(v.categories.map((c:any)=>c.id));
 return list(v.items,i=>object(i)&&id(i.id)&&text(i.name)&&categories.has(i.categoryId)&&optional(i.quantityType,x=>['underwear','socks','shirt','shorts','layer','rackets','water','snacks','grips','single'].includes(x)))&&unique(v.items.map((i:any)=>i.id));
}
function references(v:any){
 const ids=new Set(v.items.map((i:any)=>i.id));
 const refs=(a:any)=>list(a,id)&&unique(a)&&a.every((k:string)=>ids.has(k));
 const map=(m:any,test:(v:any)=>boolean)=>object(m)&&Object.entries(m).every(([k,x])=>ids.has(k)&&test(x));
 return optional(v.quantities,q=>map(q,n=>integer(n,1,999)))&&optional(v.critical,refs)&&optional(v.lastMinute,refs)&&optional(v.verified,x=>map(x,b=>typeof b==='boolean'));
}
export function validTemplate(t:any):t is Template{return contents(t)&&id(t.id)&&text(t.name)&&types.includes(t.type)&&references(t)&&object(t.quantities)&&Array.isArray(t.critical)&&Array.isArray(t.lastMinute);}
export function validDefaultLists(value:unknown):value is State['defaultLists']{
 return value===undefined||object(value)&&Object.entries(value as object).every(([type,t]:[string,any])=>types.includes(type)&&t?.type===type&&validTemplate(t));
}
export function validTrip(t:any):t is Trip{
 if(!contents(t)||!id(t.id)||!text(t.name,200,true)||!references(t))return false;
 const ids=new Set(t.items.map((i:any)=>i.id));
 const d=t.details;
 return object(t.statuses)&&Object.entries(t.statuses).every(([k,v])=>ids.has(k)&&['todo','packed','unpacked','skipped'].includes(v as string))&&list(t.queue,id)&&unique(t.queue)&&t.queue.every((k:string)=>ids.has(k))&&integer(t.position,0,t.queue.length)&&integer(t.round,1)&&['packing','round','complete'].includes(t.phase)&&time(t.createdAt)&&time(t.updatedAt)&&optional(t.reflectionDone,x=>typeof x==='boolean')&&optional(t.equipmentVersion,x=>x===1)&&optional(t.laundryBagVersion,x=>x===1)&&optional(d,x=>object(x)&&types.includes(x.type)&&date(x.startDate)&&date(x.returnDate)&&(!x.startDate||!x.returnDate||x.returnDate>=x.startDate)&&text(x.destination,300,true)&&text(x.departure,40,true)&&(x.departure===''||/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(x.departure)&&date(x.departure.slice(0,10),false)&&Number.isFinite(Date.parse(x.departure)))&&climates.includes(x.climate)&&typeof x.laundry==='boolean'&&list(x.reminderMinutes,n=>integer(n,0,525600),100)&&optional(x.durationDays,n=>integer(n,1,3660))&&optional(x.finishedAt,time));
}
export function validPackingState(s:any):s is State{
 return object(s)&&list(s.trips,validTrip,500)&&s.trips.length>0&&unique(s.trips.map((t:any)=>t.id))&&s.trips.some((t:any)=>t.id===s.activeId)&&['light','dark','system'].includes(s.theme)&&typeof s.sound==='boolean'&&validDefaultLists(s.defaultLists)&&optional(s.templates,t=>list(t,validTemplate,200)&&unique(t.map((x:any)=>x.id)))&&optional(s.feedback,f=>list(f,x=>object(x)&&id(x.itemId)&&text(x.name)&&integer(x.packedQuantity,1,999)&&integer(x.idealQuantity,1,999)&&['too-many','right','too-few'].includes(x.rating)&&types.includes(x.tripType)&&integer(x.days,1,3660)&&climates.includes(x.climate)&&typeof x.laundry==='boolean'&&time(x.createdAt),10000))&&optional(s.observations,o=>list(o,x=>object(x)&&id(x.itemId)&&types.includes(x.type)&&typeof x.unused==='boolean'&&time(x.date),10000))&&optional(s.wishlist,w=>list(w,x=>object(x)&&text(x.name)&&types.includes(x.type)&&time(x.date),10000));
}
/** Old clients left references behind after deleting an item. Remove only orphaned references. */
export function cleanPackingReferences<T>(state:T):T{
 if(!object(state))return state;
 const clean=(t:any)=>{
  if(!object(t)||!Array.isArray(t.items))return t;
  const ids=new Set(t.items.map((i:any)=>i?.id)),out={...t};
  for(const key of ['statuses','quantities','verified'])if(object(t[key]))out[key]=Object.fromEntries(Object.entries(t[key]).filter(([k])=>ids.has(k)));
  for(const key of ['critical','lastMinute','queue'])if(Array.isArray(t[key]))out[key]=t[key].filter((k:any)=>ids.has(k));
  if(Array.isArray(out.queue)&&integer(out.position))out.position=t.queue.slice(0,out.position).filter((k:any)=>ids.has(k)).length;
  return out;
 };
 const s=state as any;
 return {...s,...(Array.isArray(s.trips)?{trips:s.trips.map(clean),...(typeof s.activeId==='string'&&s.trips.length&&!s.trips.some((t:any)=>t?.id===s.activeId)?{activeId:s.trips[0]?.id}:{})}:{}),...(Array.isArray(s.templates)?{templates:s.templates.map(clean)}:{}),...(object(s.defaultLists)?{defaultLists:Object.fromEntries(Object.entries(s.defaultLists).map(([k,t])=>[k,clean(t)]))}:{})};
}
