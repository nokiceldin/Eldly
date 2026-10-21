import { add, localDay, monday } from './engine';
import { emptyMapping, mappingStart, type MappingData, type XPRule, type MappingEntry } from './mapping';

export const POINT_LABELS:Record<string,string>={tennis:'Tennis',fitness:'Fitness',recovery:'Recovery',praying:'Prayer',sleep:'Sleep',reading:'Reading',journaling:'Journaling','no-phone':'No phone · first 15 min',homework:'Homework',coaching:'Coaching',porn:'Porn',goyslop:'Goyslop','screen-time':'Phone use'};
const caps:Record<string,number>={tennis:30,fitness:20,recovery:8};
export function entryPoints(id:string,e:MappingEntry|undefined,rule?:XPRule):number {
 if(!e)return 0;
 if(rule){
  const minutes=e.kind==='duration'||e.kind==='phone'?e.minutes:e.kind==='sleep'?e.nightMinutes+e.dayMinutes:undefined;
  const units=rule.basis==='hour'?(minutes??0)/60:rule.basis==='count'?(e.kind==='prayer'?e.count:e.kind==='check'?1:0):e.kind==='phone'?(e.minutes===undefined?0:1):e.kind==='duration'||e.kind==='sleep'?(minutes&&minutes>0?1:0):1;
  return Math.round(rule.amount*units*10)/10;
 }
 if(id==='praying')return e.kind==='prayer'?Math.min(5,e.count)*1.5:0;
 if(id==='sleep')return e.kind==='sleep'&&e.nightMinutes+e.dayMinutes>480?5:0;
 if(id==='screen-time'){
  const minutes=e.kind==='phone'?e.minutes:e.kind==='duration'?e.minutes:undefined;
  return minutes===undefined?0:minutes<120?2:minutes<180?1:0;
 }
 const done=e.kind==='check'||e.kind==='duration'&&e.minutes>0;
 if(!done)return 0;
 return ({tennis:5,fitness:5,recovery:2,reading:3,journaling:3,'no-phone':2,homework:4,coaching:1,porn:-8,goyslop:-4} as Record<string,number>)[id]||0;
}
export interface PointsWeek {from:string;to:string;total:number;breakdown:Record<string,number>;current:boolean;partial:boolean}
/** Derived from tracking, so changing or removing a log never awards duplicate points. */
export function pointsHistory(mapping:MappingData=emptyMapping(),today=localDay()):PointsWeek[]{
 const start=mappingStart(mapping);
 if(start>today)return [];
 const weeks:PointsWeek[]=[];
 for(let from=monday(start);from<=today;from=add(from,7)){
  const to=add(from,6),breakdown:Record<string,number>={};
  for(let day=from;day<=to&&day<=today;day=add(day,1)){
   if(day<start)continue;
   for(const [id,entry] of Object.entries(mapping.entries[day]||{}))breakdown[id]=(breakdown[id]||0)+entryPoints(id,entry,mapping.habits?.find(h=>h.id===id)?.xp);
  }
  for(const id of Object.keys(breakdown)){
   const rule=mapping.habits?.find(h=>h.id===id)?.xp;
   const cap=rule?rule.weeklyCap:caps[id];
   if(cap!==undefined)breakdown[id]=Math.sign(breakdown[id])*Math.min(cap,Math.abs(breakdown[id]));
  }
  weeks.push({from,to,total:Object.values(breakdown).reduce((a,b)=>a+b,0),breakdown,current:from===monday(today),partial:from<start});
 }
 return weeks;
}
export function pointsStats(mapping:MappingData=emptyMapping(),today=localDay()){
 const weeks=pointsHistory(mapping,today),completed=weeks.filter(w=>!w.current&&!w.partial);
 return {weeks,total:weeks.reduce((n,w)=>n+w.total,0),current:weeks.find(w=>w.current)?.total||0,average:completed.length?completed.reduce((n,w)=>n+w.total,0)/completed.length:null,best:completed.length?completed.reduce((a,b)=>b.total>a.total?b:a):null};
}
export const formatPoints=(n:number)=>Number.isInteger(n)?String(n):String(Math.round(n*10)/10);
