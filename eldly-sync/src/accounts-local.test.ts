import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {setAccountScope} from './accountScope';
import {load,persist,validate} from './storage';
import {empty,seed,localDay,syncChecklyHomework} from './engine';
import {getHabits,setMappingEntry,validateMapping,type MappingData} from './mapping';
import {getMetrics,metricStats,humanValue} from './progress';
const map=new Map<string,string>();
beforeEach(()=>{map.clear();vi.stubGlobal('localStorage',{getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)});vi.stubGlobal('window',new EventTarget());});
afterEach(()=>{setAccountScope('test');vi.unstubAllGlobals();});
it('keeps owner, friend and guest caches separate and never loads the legacy cache anonymously',()=>{
 map.set('checkly-data-v1',JSON.stringify({...empty(),tasks:[{id:'private',title:'private',scheduled:localDay(),original:localDay(),category:'',notes:'',carry:true,important:false,order:0}]}));
 setAccountScope('guest');expect(load().tasks).toEqual([]);expect(load().categories).toEqual([]);expect(getHabits(load().mapping)).toEqual([]);
 setAccountScope('owner',true);const owned={...load(),categories:['owner-only']};persist(owned);
 setAccountScope('friend');expect(load().categories).toEqual([]);persist({...load(),categories:['friend-only']});expect(seed(load(),localDay()).routines).toEqual([]);
 setAccountScope('owner',true);expect(load().categories).toEqual(['owner-only']);
 setAccountScope('guest');expect(load().categories).toEqual([]);expect(map.has('checkly-data-v1')).toBe(true);
});
it('supports personal tracker definitions and units without adding owner trackers or homework',()=>{
 const mapping:MappingData={version:1,startedOn:localDay(),habits:[{id:'custom-run',label:'Running',kind:'duration',color:'blue'},{id:'custom-water',label:'Water',kind:'prayer',color:'purple'}],entries:{}};
 const logged=setMappingEntry(mapping,localDay(),'custom-water',{kind:'prayer',count:4});
 expect(validateMapping(logged)).toBe(true);expect(getMetrics(logged)).toEqual(['custom-run','custom-water']);expect(metricStats(logged,'custom-water',{from:localDay(),to:localDay()}).total).toBe(4);expect(humanValue(4,'custom-water',logged)).toBe('4');expect(syncChecklyHomework({...empty(),mapping:logged},localDay()).mapping).toEqual(logged);
 const archived={...logged,habits:logged.habits!.map(h=>({...h,archived:true}))};expect(validateMapping(archived)).toBe(true);expect(getHabits(archived)).toEqual([]);expect(archived.entries).toEqual(logged.entries);
});
