import { describe,it,expect,vi,afterEach } from 'vitest';
import { empty } from './engine';
import { getHabits, type Habit } from './mapping';
import { entryPoints, originalCoinRule } from './points';
import { trackerGoals,saveTrackerSettings } from './trackerSettings';
import { weeklyGoals } from './goals';
import { validate } from './storage';
afterEach(()=>vi.useRealTimers());
describe('direct tracker settings',()=>{
 it('shows editable original amounts, caps and conditions without changing their scoring',()=>{
  for(const h of getHabits()){
   const rule=originalCoinRule(h.id);
   const entries=h.kind==='sleep'?[{kind:'sleep',nightMinutes:480,dayMinutes:0},{kind:'sleep',nightMinutes:510,dayMinutes:0}]:h.kind==='phone'?[{kind:'phone',minutes:0},{kind:'phone',minutes:119},{kind:'phone',minutes:120},{kind:'phone',minutes:179},{kind:'phone',minutes:180},{kind:'phone',pickups:9}]:h.kind==='prayer'?[{kind:'prayer',count:2},{kind:'prayer',count:8}]:h.kind==='duration'?[{kind:'duration',minutes:90}]:[{kind:'check'}];
   for(const e of entries)expect(entryPoints(h.id,e as any,rule)).toBe(entryPoints(h.id,e as any));
  }
  expect(originalCoinRule('tennis')).toMatchObject({amount:5,weeklyCap:30});
 });
 it('changes owner tennis coin limits and both goals for this week without rewriting completed goals',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-27T12:00:00'));
  const data=empty(),habit=getHabits().find(h=>h.id==='tennis')!,before=trackerGoals(data,habit,true);
  expect(before.map(g=>g.value)).toEqual(['6','15']);
  const changed=before.map(g=>({...g,value:g.days?'5':'12'}));
  const saved=saveTrackerSettings(data,habit,'Tennis',{amount:7,basis:'entry',weeklyCap:35},changed,before,true);
  expect(validate(saved)).toBe(true);
  expect(weeklyGoals(saved,'2026-10-26').filter(g=>g.habit==='tennis').map(g=>g.target)).toEqual([5,720]);
  expect(weeklyGoals(saved,'2026-10-19').filter(g=>g.habit==='tennis').map(g=>g.target)).toEqual([6,900]);
  expect(saved.mapping?.habits?.find(h=>h.id==='tennis')?.xp).toMatchObject({amount:7,weeklyCap:35});
 });
 it('changes and clears a personal goal while preserving its past target and unrelated data',()=>{
  const habit:Habit={id:'run',label:'Run',kind:'check',color:'blue',goal:{target:3,maximum:false,from:'2026-10-05'}};
  const data={...empty(),mapping:{version:1 as const,habits:[habit],entries:{},startedOn:'2026-10-05'}},before=trackerGoals(data,habit,false,'2026-10-20');
  const saved=saveTrackerSettings(data,habit,'Running',{amount:4,basis:'entry'},[{...before[0],value:''}],before,false,'2026-10-20');
  expect(saved.mapping?.habits?.[0].goal).toBeUndefined();expect(saved.mapping?.habits?.[0].previousGoals?.[0]).toMatchObject({target:3,until:'2026-10-19'});expect(saved.tasks).toBe(data.tasks);expect(validate(saved)).toBe(true);
 });
 it('rejects stale tracker edits and invalid amounts, thresholds or daily caps',()=>{
  const habit=getHabits()[0],data=empty(),goals=trackerGoals(data,habit,true);
  const stale={...data,mapping:{version:1 as const,habits:[{...habit,label:'Changed elsewhere'}],entries:{}}};
  expect(()=>saveTrackerSettings(stale,habit,'Tennis',originalCoinRule('tennis'),goals,goals,true)).toThrow('another device');
  for(const rule of [{amount:NaN,basis:'entry'},{amount:5,basis:'entry',threshold:{comparison:'over',minutes:-2}},{amount:2,basis:'count',dailyCountCap:0}])expect(()=>saveTrackerSettings(data,habit,'Tennis',rule as any,goals,goals,true)).toThrow('limits');
 });
});
