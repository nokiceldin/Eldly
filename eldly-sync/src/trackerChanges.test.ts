import {it,expect} from 'vitest';
import {mergeTrackerChanges,validGoalTarget} from './trackerChanges';
import {validateMapping,type Habit} from './mapping';
const a:Habit={id:'a',label:'A',color:'blue',kind:'check'},b:Habit={id:'b',label:'B',color:'red',kind:'check'};
it('preserves trackers added elsewhere while applying a local edit',()=>{
 expect(mergeTrackerChanges([a],[{...a,label:'Renamed'}],[a,b])).toEqual([{...a,label:'Renamed'},b]);
});
it('rejects a conflicting edit to the same tracker without changing the latest value',()=>{
 const remote={...a,color:'red' as const};expect(()=>mergeTrackerChanges([a],[{...a,label:'Renamed'}],[remote])).toThrow('another device');expect(remote.color).toBe('red');
});
it('allows a zero maximum and rejects fractional days or a zero minimum',()=>{
 expect(validGoalTarget(0,true,'check')).toBe(true);expect(validGoalTarget(0,false,'check')).toBe(false);expect(validGoalTarget(2.5,false,'check')).toBe(false);
 expect(validateMapping({version:1,entries:{},habits:[{...b,goal:{target:0,maximum:true,from:'2026-10-20'}}]})).toBe(true);
});
