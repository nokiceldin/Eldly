import { isPersonalOwner } from "../accountScope";
export type Status = 'todo'|'packed'|'unpacked'|'skipped';
export interface Category { id:string; name:string; emoji:string }
export interface Item {id:string; name:string; categoryId:string}
export type TripType='normal'|'tennis'|'match'|'weekend'|'custom';
export interface TripDetails {type:TripType;startDate:string;durationDays?:number;returnDate:string;departure:string;destination:string;climate:'warm'|'mild'|'cold'|'unknown';laundry:boolean;reminderMinutes:number[];finishedAt?:number}
export interface Feedback {itemId:string;name:string;packedQuantity:number;idealQuantity:number;rating:'too-many'|'right'|'too-few';tripType:TripType;days:number;climate:string;laundry:boolean;createdAt:number}
export interface Template {id:string;name:string;type:TripType;categories:Category[];items:Item[];quantities:Record<string,number>;critical:string[];lastMinute:string[]}
export interface Trip {laundryBagVersion?:1;equipmentVersion?:1;details?:TripDetails;quantities?:Record<string,number>;critical?:string[];lastMinute?:string[];verified?:Record<string,boolean>;reflectionDone?:boolean; id:string; name:string; categories:Category[]; items:Item[]; statuses:Record<string,Status>; queue:string[]; position:number; round:number; phase:'packing'|'round'|'complete'; createdAt:number; updatedAt:number; }
export interface State { defaultLists?:Partial<Record<TripType,Template>>; templates?:Template[]; feedback?:Feedback[]; observations?:{itemId:string;type:TripType;unused:boolean;date:number}[]; wishlist?:{name:string;type:TripType;date:number}[]; trips:Trip[]; activeId:string; theme:'light'|'dark'|'system'; sound:boolean; }
const groups:[string,string,string[]][]=[
 ['tennis','🎾','NYCKEL|Rack|Shorts|T-shirt|Skor|Handduk|Tennis strumpor|Uppvärmnings material|Keps/pannband|Knäskydd|Handledskydd|Underställ|Svettband|Vattenflaska|Dämpare|Bollar|Löparskor (Fys)|Elektrolyter|Shoe laces|Shoe glue'.split('|')],
 ['clothes','👕','Eventuellt badshorts|Shorts|Skor|Tshirt|Jeans|Mjukisbyxor|Keps|Jacka|Tröja|Hoodie|Vanliga strumpor|Kallingar|Skjorta|Bucket hat|Flip Flop|Solglasögon'.split('|')],
 ['tech','💻','Laddare|Klocka|Beats|Airpods och laddare|EU connect adapter|Laddare till hörlurar|Skoldator och laddare|Eventuellt pluggmaterial|Maskin till strängar|Strängar|Massagepistol och laddare|PS4 kanske|Högtalare|Laddare till flyg|Hörlurar för flyg|Powerbank'.split('|')],
 ['health','🧴','Shampoo|Parfym|Deodorant|Kamm|Tandkräm|Tandborste|Tandtråd|Flux|Solkräm|Lindor|Tejp|Krämer|Nessecär|Rakmaskin|Ögonbrynkniv'.split('|')],
 ['travel','🛂','Nack kudde|Pass|Visum|Plånbok|Becknarväska|Nordea kort|Bok|Penna|Journal'.split('|')]
];
const names=['Tennis & Träning','Kläder','Teknik & Utrustning','Hygien & Hälsa','Resa & Viktigt'];
export const defaultCategories:Category[]=groups.map(([id,emoji],i)=>({id,emoji,name:names[i]}));
export const defaultItems:Item[]=groups.flatMap(([id,,items])=>items.map((name,i)=>({id:`${id}-${String(i+1).padStart(2,'0')}`,name,categoryId:id})));
// Shared English starter list. Existing trips and the owner's defaults stay intact.
const sharedGroups:[string,string,string,string[]][]=[
 ['tennis','🎾','Tennis & training','Tennis rackets|Tennis shorts|Tennis T-shirts|Tennis shoes|Tennis socks|Training towel|Warm-up equipment|Cap / headband|Knee support, if needed|Wrist support, if needed|Base layers|Sweatbands|Water bottle|Vibration dampeners|Tennis balls|Running shoes|Electrolytes|Extra grips / overgrips|Racket strings|Shoelaces|Shoe glue|Sports wraps|Sports tape|Massage gun and charger, if needed|Stringing machine, if needed'.split('|')],
 ['clothes','👕','Clothing','Underwear|Regular socks|T-shirts|Shorts|Jeans|Sweatpants|Shirt|Sweater|Hoodie|Jacket|Sleepwear|Everyday shoes|Swimming shorts|Flip-flops|Cap / bucket hat|Sunglasses'.split('|')],
 ['health','🧴','Toiletries & health','Toiletry bag|Toothbrush|Toothpaste|Dental floss|Mouthwash|Shampoo|Body wash|Deodorant|Cologne / perfume|Comb / hairbrush|Sunscreen|Skincare creams|Shaver|Eyebrow razor, if needed|Personal medication, if needed'.split('|')],
 ['tech','📱','Electronics','Phone and charger|Headphones / earbuds and charger|Watch and charger, if needed|Power bank|Travel plug adapter|Headphones for the flight, if separate'.split('|')],
 ['school','📚','School & personal','School laptop and charger|Study materials|Book|Pen|Notebook / journal'.split('|')],
 ['travel','🛂','Travel & essentials','Keys|Wallet|Bank cards|ID / passport|Visa, if needed|Tickets / booking details|Crossbody bag / day bag|Neck pillow'.split('|')],
];
export const sharedCategories:Category[]=sharedGroups.map(([id,emoji,name])=>({id,emoji,name}));
export const sharedItems:Item[]=sharedGroups.flatMap(([categoryId,,,names])=>names.map((name,i)=>({id:`base-${categoryId}-${i+1}`,name,categoryId})));
export function packingDefaults(){return isPersonalOwner()?{items:[...defaultItems,{id:'owner-laundry-bag',name:'Laundry bag',categoryId:'clothes'}],categories:defaultCategories}:{items:sharedItems,categories:sharedCategories};}
// Court essentials for a single match, separate from overnight travel packing.
export const matchItems: Item[] = [
 ...defaultItems.filter(i => ['tennis-01','tennis-02','tennis-03','tennis-04','tennis-05','tennis-06','tennis-07','tennis-08','tennis-09','tennis-10','tennis-11','tennis-13','tennis-14','tennis-15','tennis-16','tennis-18','health-09','health-10','health-11','travel-04'].includes(i.id)),
 { id: 'match-snacks', name: 'Match snacks / energy bars', categoryId: 'tennis' },
 { id: 'match-overgrips', name: 'Extra overgrips', categoryId: 'tennis' },
 { id: 'match-phone', name: 'Phone', categoryId: 'tech' },
];
export const uid=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function newTrip(name:string, source?:Trip):Trip {
 const categories=(source?.categories||packingDefaults().categories).map(c=>({...c}));
 const items=(source?.items||packingDefaults().items).map(i=>({...i}));
 const now=Date.now();
 return {id:uid(),name,categories,items,statuses:{},queue:items.map(i=>i.id),position:0,round:1,phase:'packing',createdAt:now,updatedAt:now};
}
export function tripDays(t:Trip){if(t.details?.durationDays)return Math.max(1,t.details.durationDays);const a=t.details?.startDate,b=t.details?.returnDate;if(!a||!b)return 7;return Math.max(1,Math.round((new Date(b+'T12:00:00').getTime()-new Date(a+'T12:00:00').getTime())/86400000)+1)}
export function suggestedQuantity(item:Item,details:TripDetails, days:number,feedback:Feedback[]=[],history:Trip[]=[]){
 const n=item.name.toLowerCase();let base=1;
 if(details.type==='match') base=['tennis-02','tennis-04','tennis-14','match-snacks','match-overgrips'].includes(item.id)?2:1;
 else {
 if(n==='kallingar'||n==='vanliga strumpor'||n==='tennis strumpor'||['underwear','regular socks','tennis socks'].includes(n))base=days+1;
 else if(n==='tshirt'||n==='t-shirt'||['t-shirts','tennis t-shirts'].includes(n))base=Math.min(days,8);
 else if(n==='shorts'||n==='tennis shorts')base=Math.max(1,Math.ceil(days/3));
 else if(['jeans','mjukisbyxor','hoodie','tröja','skjorta'].includes(n))base=Math.min(3,Math.max(1,Math.ceil(days/5)));
 if(details.laundry&&base>3)base=Math.max(3,Math.ceil(base*.65));
 if(details.type==='tennis'&&item.categoryId==='tennis'&&['shorts','t-shirt','tennis strumpor'].includes(n))base+=Math.ceil(days/4);
 if(details.climate==='cold'&&['shorts','t-shirt'].includes(n))base=Math.max(1,base-1);
 }
 const similar=feedback.filter(f=>f.itemId===item.id&&f.tripType===details.type&&f.laundry===details.laundry&&Math.abs(f.days-days)<=3&&f.climate===details.climate);
 if(similar.length>=1){const samples=similar.slice(-5);base=Math.round(samples.reduce((a,f)=>a+f.idealQuantity,0)/samples.length)}
 if(!similar.length){const samples=history.filter(t=>t.details?.finishedAt&&t.details.type===details.type&&Math.abs(tripDays(t)-days)<=3&&t.statuses[item.id]==='packed').slice(-5).map(t=>t.quantities?.[item.id]||1).sort((a,b)=>a-b);if(samples.length)base=samples[Math.floor(samples.length/2)];}
 return Math.max(1,base);
}
export function makeConfiguredTrip(name:string,type:TripType,details:TripDetails,feedback:Feedback[]=[],template?:Template,history:Trip[]=[]){
 if(type==='match') details={...details,type,durationDays:1,returnDate:details.startDate,laundry:false};
 const defaults=packingDefaults();
 const items=(template?.items||(type==='match'?(isPersonalOwner()?matchItems:matchItems.map(i=>({...i,name:({ 'tennis-01':'Keys','tennis-02':'Tennis rackets','tennis-03':'Tennis shorts','tennis-04':'Tennis T-shirts','tennis-05':'Tennis shoes','tennis-06':'Training towel','tennis-07':'Tennis socks','tennis-08':'Warm-up equipment','tennis-09':'Cap / headband','tennis-10':'Knee support','tennis-11':'Wrist support','tennis-13':'Sweatbands','tennis-14':'Water bottle','tennis-15':'Vibration dampeners','tennis-16':'Tennis balls','tennis-18':'Electrolytes','health-09':'Sunscreen','health-10':'Sports wraps','health-11':'Sports tape','travel-04':'Wallet'} as Record<string,string>)[i.id]||i.name}))):defaults.items.filter(i=>type==='tennis'||type==='custom'||(type==='normal'?i.categoryId!=='tennis':i.categoryId!=='tennis'&&(!['tech-09','tech-10','tech-11','tech-12','tech-13','health-10','health-11'].includes(i.id)))))).map(i=>({...i}));
 const base=newTrip(name);const categories=(template?.categories||defaults.categories).filter(c=>items.some(i=>i.categoryId===c.id)).map(c=>({...c}));const days=details.durationDays|| (details.startDate&&details.returnDate?Math.max(1,Math.round((new Date(details.returnDate).getTime()-new Date(details.startDate).getTime())/86400000)+1):3);
 const quantities=Object.fromEntries(items.map(i=>[i.id,template?.quantities?.[i.id]||suggestedQuantity(i,details,days,feedback,history)]));
 const critical=template?.critical||items.filter(i=>type==='match'?['tennis-01','tennis-02','tennis-05','tennis-14','match-phone'].includes(i.id):['Pass','Plånbok','NYCKEL','Visum','Keys','Wallet','ID / passport','Visa, if needed'].includes(i.name)).map(i=>i.id);
 const lastMinute=template?.lastMinute||items.filter(i=>['NYCKEL','Plånbok','Tandborste','Laddare','Keys','Wallet','Toothbrush','Phone and charger'].includes(i.name)).map(i=>i.id);
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
 const tennisList=t.details?.type==='tennis'||(!t.details&&t.items.some(i=>i.id==='tennis-02'));
 const additions=tennisList&&!t.equipmentVersion&&!t.items.some(i=>i.id.startsWith('base-'))?defaultItems.filter(i=>['tennis-19','tennis-20'].includes(i.id)&&!ids.has(i.id)):[];
 if(isPersonalOwner()&&!t.laundryBagVersion&&!t.details?.finishedAt&&t.details?.type!=='match'&&t.categories.some(c=>c.id==='clothes')&&!t.items.some(i=>i.id==='owner-laundry-bag'||i.name.toLowerCase()==='laundry bag'))additions.push({id:'owner-laundry-bag',name:'Laundry bag',categoryId:'clothes'});
 return {...t,...(isPersonalOwner()?{laundryBagVersion:1 as const}:{}),...(tennisList?{equipmentVersion:1 as const}:{}),items:[...t.items,...additions],...(additions.length&&t.phase==='complete'?{phase:'packing' as const}:{}),quantities:t.quantities||{},critical:t.critical||t.items.filter(i=>['Pass','Plånbok','NYCKEL','Visum','Keys','Wallet','ID / passport','Visa, if needed'].includes(i.name)).map(i=>i.id),lastMinute:t.lastMinute||[],verified:t.verified||{},queue:[...queue,...additions.map(i=>i.id)],position:Math.max(0,Math.min(t.position||0,queue.length)),round:t.round||1,phase:additions.length&&t.phase==='complete'?'packing':t.phase||'packing'};
}
export function validDefaultLists(value:unknown):value is State['defaultLists']{
 if(value===undefined)return true;
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 return Object.entries(value).every(([type,t])=>{
  if(!['normal','tennis','match','weekend','custom'].includes(type)||!t||t.type!==type||!Array.isArray(t.categories)||!Array.isArray(t.items)||t.categories.length>100||t.items.length>2000)return false;
  const categories=new Set(t.categories.map((c:Category)=>c?.id)),items=new Set(t.items.map((i:Item)=>i?.id));
  return categories.size===t.categories.length&&items.size===t.items.length&&t.categories.every((c:Category)=>typeof c?.id==='string'&&typeof c.name==='string'&&c.name.trim()&&typeof c.emoji==='string')&&t.items.every((i:Item)=>typeof i?.id==='string'&&typeof i.name==='string'&&i.name.trim()&&categories.has(i.categoryId))&&t.quantities&&typeof t.quantities==='object'&&Object.values(t.quantities).every(q=>Number.isInteger(q)&&Number(q)>=1&&Number(q)<=999)&&Array.isArray(t.critical)&&Array.isArray(t.lastMinute);
 });
}
