export type Status = 'todo'|'packed'|'unpacked'|'skipped';
export interface Category { id:string; name:string; emoji:string }
export interface Item {id:string; name:string; categoryId:string}
export type TripType='normal'|'tennis'|'match'|'weekend'|'custom';
export interface TripDetails {type:TripType;startDate:string;durationDays?:number;returnDate:string;departure:string;destination:string;climate:'warm'|'mild'|'cold'|'unknown';laundry:boolean;reminderMinutes:number[];finishedAt?:number}
export interface Feedback {itemId:string;name:string;packedQuantity:number;idealQuantity:number;rating:'too-many'|'right'|'too-few';tripType:TripType;days:number;climate:string;laundry:boolean;createdAt:number}
export interface Template {id:string;name:string;type:TripType;categories:Category[];items:Item[];quantities:Record<string,number>;critical:string[];lastMinute:string[]}
export interface Trip {details?:TripDetails;quantities?:Record<string,number>;critical?:string[];lastMinute?:string[];verified?:Record<string,boolean>;reflectionDone?:boolean; id:string; name:string; categories:Category[]; items:Item[]; statuses:Record<string,Status>; queue:string[]; position:number; round:number; phase:'packing'|'round'|'complete'; createdAt:number; updatedAt:number; }
export interface State { templates?:Template[]; feedback?:Feedback[]; observations?:{itemId:string;type:TripType;unused:boolean;date:number}[]; wishlist?:{name:string;type:TripType;date:number}[]; trips:Trip[]; activeId:string; theme:'light'|'dark'|'system'; sound:boolean; }
const groups:[string,string,string[]][]=[
 ['tennis','🎾','NYCKEL|Rack|Shorts|T-shirt|Skor|Handduk|Tennis strumpor|Uppvärmnings material|Keps/pannband|Knäskydd|Handledskydd|Underställ|Svettband|Vattenflaska|Dämpare|Bollar|Löparskor (Fys)|Elektrolyter'.split('|')],
 ['clothes','👕','Eventuellt badshorts|Shorts|Skor|Tshirt|Jeans|Mjukisbyxor|Keps|Jacka|Tröja|Hoodie|Vanliga strumpor|Kallingar|Skjorta|Bucket hat|Flip Flop|Solglasögon'.split('|')],
 ['tech','💻','Laddare|Klocka|Beats|Airpods och laddare|EU connect adapter|Laddare till hörlurar|Skoldator och laddare|Eventuellt pluggmaterial|Maskin till strängar|Strängar|Massagepistol och laddare|PS4 kanske|Högtalare|Laddare till flyg|Hörlurar för flyg|Powerbank'.split('|')],
 ['health','🧴','Shampoo|Parfym|Deodorant|Kamm|Tandkräm|Tandborste|Tandtråd|Flux|Solkräm|Lindor|Tejp|Krämer|Nessecär|Rakmaskin|Ögonbrynkniv'.split('|')],
 ['travel','🛂','Nack kudde|Pass|Visum|Plånbok|Becknarväska|Nordea kort|Bok|Penna|Journal'.split('|')]
];
const names=['Tennis & Träning','Kläder','Teknik & Utrustning','Hygien & Hälsa','Resa & Viktigt'];
export const defaultCategories:Category[]=groups.map(([id,emoji],i)=>({id,emoji,name:names[i]}));
export const defaultItems:Item[]=groups.flatMap(([id,,items])=>items.map((name,i)=>({id:`${id}-${String(i+1).padStart(2,'0')}`,name,categoryId:id})));
// Court essentials for a single match, separate from overnight travel packing.
export const matchItems: Item[] = [
 ...defaultItems.filter(i => ['tennis-01','tennis-02','tennis-03','tennis-04','tennis-05','tennis-06','tennis-07','tennis-08','tennis-09','tennis-10','tennis-11','tennis-13','tennis-14','tennis-15','tennis-16','tennis-18','health-09','health-10','health-11','travel-04'].includes(i.id)),
 { id: 'match-snacks', name: 'Match snacks / energy bars', categoryId: 'tennis' },
 { id: 'match-overgrips', name: 'Extra overgrips', categoryId: 'tennis' },
 { id: 'match-phone', name: 'Phone', categoryId: 'tech' },
];
export const uid=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function newTrip(name:string, source?:Trip):Trip {
 const categories=(source?.categories||defaultCategories).map(c=>({...c}));
 const items=(source?.items||defaultItems).map(i=>({...i}));
 const now=Date.now();
 return {id:uid(),name,categories,items,statuses:{},queue:items.map(i=>i.id),position:0,round:1,phase:'packing',createdAt:now,updatedAt:now};
}
export function tripDays(t:Trip){if(t.details?.durationDays)return Math.max(1,t.details.durationDays);const a=t.details?.startDate,b=t.details?.returnDate;if(!a||!b)return 7;return Math.max(1,Math.round((new Date(b+'T12:00:00').getTime()-new Date(a+'T12:00:00').getTime())/86400000)+1)}
export function suggestedQuantity(item:Item,details:TripDetails, days:number,feedback:Feedback[]=[]){
 const n=item.name.toLowerCase();let base=1;
 if(details.type==='match') return ['tennis-02','tennis-04','tennis-14','match-snacks','match-overgrips'].includes(item.id)?2:1;
 if(n==='kallingar'||n==='vanliga strumpor'||n==='tennis strumpor')base=days+1;
 else if(n==='tshirt'||n==='t-shirt')base=Math.min(days,8);
 else if(n==='shorts')base=Math.max(1,Math.ceil(days/3));
 else if(['jeans','mjukisbyxor','hoodie','tröja','skjorta'].includes(n))base=Math.min(3,Math.max(1,Math.ceil(days/5)));
 if(details.laundry&&base>3)base=Math.max(3,Math.ceil(base*.65));
 if(details.type==='tennis'&&item.categoryId==='tennis'&&['shorts','t-shirt','tennis strumpor'].includes(n))base+=Math.ceil(days/4);
 if(details.climate==='cold'&&['shorts','t-shirt'].includes(n))base=Math.max(1,base-1);
 const similar=feedback.filter(f=>f.itemId===item.id&&f.tripType===details.type&&f.laundry===details.laundry&&Math.abs(f.days-days)<=3&&f.climate===details.climate);
 if(similar.length>=2){const samples=similar.slice(-5);base=Math.round(samples.reduce((a,f)=>a+f.idealQuantity,0)/samples.length)}
 return Math.max(1,base);
}
export function makeConfiguredTrip(name:string,type:TripType,details:TripDetails,feedback:Feedback[]=[],template?:Template){
 if(type==='match') details={...details,type,durationDays:1,returnDate:details.startDate,laundry:false};
 const items=(template?.items||(type==='match'?matchItems:defaultItems.filter(i=>type==='tennis'||type==='custom'||(type==='normal'?i.categoryId!=='tennis':i.categoryId!=='tennis'&&(!['tech-09','tech-10','tech-11','tech-12','tech-13','health-10','health-11'].includes(i.id)))))).map(i=>({...i}));
 const base=newTrip(name);const categories=(template?.categories||defaultCategories).filter(c=>items.some(i=>i.categoryId===c.id)).map(c=>({...c}));const days=details.durationDays|| (details.startDate&&details.returnDate?Math.max(1,Math.round((new Date(details.returnDate).getTime()-new Date(details.startDate).getTime())/86400000)+1):3);
 const quantities=Object.fromEntries(items.map(i=>[i.id,template?.quantities?.[i.id]||suggestedQuantity(i,details,days,feedback)]));
 const critical=template?.critical||items.filter(i=>type==='match'?['tennis-01','tennis-02','tennis-05','tennis-14','match-phone'].includes(i.id):['Pass','Plånbok','NYCKEL','Visum'].includes(i.name)).map(i=>i.id);
 const lastMinute=template?.lastMinute||items.filter(i=>['NYCKEL','Plånbok','Tandborste','Laddare'].includes(i.name)).map(i=>i.id);
 return {...base,items,categories,queue:items.map(i=>i.id),details,quantities,critical,lastMinute,verified:{}};
}
const first=newTrip('Min nästa resa');
export const initialState:State={trips:[first],activeId:first.id,theme:'system',sound:false,templates:[],feedback:[],observations:[],wishlist:[]};
export const getStatus=(t:Trip,id:string):Status=>t.statuses[id]||'todo';
export const resolved=(s:Status)=>s==='packed'||s==='skipped';
export const completed=(t:Trip)=>t.items.filter(i=>resolved(getStatus(t,i.id))).length;
export const packedCount=(t:Trip)=>t.items.filter(i=>getStatus(t,i.id)==='packed').length;
export const remaining=(t:Trip)=>t.items.filter(i=>!resolved(getStatus(t,i.id)));
export const sortedItems=(t:Trip)=>t.categories.flatMap(c=>t.items.filter(i=>i.categoryId===c.id));
export function normalizeTrip(t:Trip):Trip {
 const ids=new Set(t.items.map(i=>i.id));
 const queue=Array.isArray(t.queue)?t.queue.filter(id=>ids.has(id)):t.items.map(i=>i.id);
 return {...t,quantities:t.quantities||{},critical:t.critical||t.items.filter(i=>['Pass','Plånbok','NYCKEL','Visum'].includes(i.name)).map(i=>i.id),lastMinute:t.lastMinute||[],verified:t.verified||{},queue,position:Math.max(0,Math.min(t.position||0,queue.length)),round:t.round||1,phase:t.phase||'packing'};
}
