import {it,expect} from 'vitest';
import {sleepEntry,splitSleepMinutes} from './sleepEntry';
import {validateMapping,setMappingEntry} from './mapping';
import {entryPoints} from './points';
it('preserves exact saved minutes when opening and saving existing sleep, including custom trackers',()=>{
 for(const [night,day] of [[485,25],[510,0],[0,45],[1440,0]]){
  const n=splitSleepMinutes(night),d=splitSleepMinutes(day),entry=sleepEntry(n.hours,n.minutes,d.hours,d.minutes)!;
  expect(entry).toEqual({kind:'sleep',nightMinutes:night,dayMinutes:day});
  const data=setMappingEntry({version:1,habits:[{id:'my-sleep',label:'Rest',kind:'sleep',color:'blue'}],entries:{}},'2026-10-28','my-sleep',entry);
  expect(validateMapping(data)).toBe(true);
 }
 expect(entryPoints('my-sleep',sleepEntry('8','15','','')!,{amount:10,basis:'hour'})).toBe(82.5);
});
it('accepts minute-only naps and explicit zero, and rejects invalid or excessive totals',()=>{
 expect(sleepEntry('','','','30')).toEqual({kind:'sleep',nightMinutes:0,dayMinutes:30});
 expect(sleepEntry('0','','','')).toEqual({kind:'sleep',nightMinutes:0,dayMinutes:0});
 for(const fields of [['','','',''],['8','60','',''],['8','-1','',''],['8.5','0','',''],['24','1','',''],['20','0','5','0']])expect(sleepEntry(...fields as [string,string,string,string])).toBeNull();
});
