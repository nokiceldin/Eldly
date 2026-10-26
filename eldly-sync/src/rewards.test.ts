import { afterEach, describe, expect, it, vi } from 'vitest';
import { empty } from './engine';
import { buyReward, coinHistory, coinWallet, undoReward, validRewards } from './rewards';
import { validate } from './storage';
import { flatten, inflate } from './sync/records';
const today='2026-11-02';
function data(){return {...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',habits:[{id:'custom-run',label:'Running',kind:'check' as const,color:'blue' as const,xp:{amount:5,basis:'entry' as const},goal:{target:1,maximum:false,from:'2026-10-19'}}],entries:{'2026-10-19':{'custom-run':{kind:'check' as const}},'2026-10-26':{'custom-run':{kind:'check' as const}},'2026-10-27':{'custom-run':{kind:'check' as const}}}},rewards:[{id:'shoes',title:'New tennis shoes',cost:10}]};}
afterEach(()=>vi.useRealTimers());
describe('coins, weekly bonuses and rewards',()=>{
 it('awards three per achieved goal and twenty only for a strictly better completed weekly record',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(today+'T12:00:00'));
  const d=data(),weeks=coinHistory(d,today);
  expect(weeks[0]).toMatchObject({baseTotal:5,goalBonus:3,recordBonus:0,total:8});
  expect(weeks[1]).toMatchObject({baseTotal:10,goalBonus:3,recordBonus:20,total:33});
  expect(coinWallet(d,today)).toEqual({earned:41,spent:0,balance:41});
  expect(coinWallet(d,today)).toEqual(coinWallet(d,today)); // Reopening the recap cannot mint coins.
 });
 it('does not award bonuses during a week, for partial weeks, empty weeks or tied records',()=>{
  const d=data();expect(coinHistory(d,'2026-10-27')[1]).toMatchObject({goalBonus:0,recordBonus:0});
  d.mapping.startedOn='2026-10-20';expect(coinHistory(d,today)[0]).toMatchObject({goalBonus:0,recordBonus:0});
  const tied=data();delete (tied.mapping.entries['2026-10-27'] as any)['custom-run'];expect(coinHistory(tied,today)[1].recordBonus).toBe(0);
  const blank={...data(),mapping:{...data().mapping,entries:{}}};expect(coinWallet(blank,today).earned).toBe(0);
 });
 it('uses the goal active that week and counts each distinct goal',()=>{
  const d=data();const h=d.mapping.habits[0];
  d.mapping.habits=[{...h,previousGoals:[{target:1,maximum:false,from:'2026-10-19'}],goal:{target:3,maximum:false,from:'2026-10-26'}} as any,{...h,id:'custom-read',label:'Reading'}];
  (d.mapping.entries['2026-10-19'] as any)['custom-read']={kind:'check'};
  expect(coinHistory(d,today)[0].goalBonus).toBe(6);
  expect(coinHistory(d,today)[1].goalBonus).toBe(0);
 });
 it('counts blank elapsed days as zero for maximum goals, including a blank full week',()=>{
  const d=data();d.mapping.entries={} as any;d.mapping.habits[0].goal={target:0,maximum:true,from:'2026-10-19'};
  expect(coinHistory(d,today)[0]).toMatchObject({baseTotal:0,goalBonus:3,recordBonus:0});
 });
 it('uses the owner’s original weekly goals for bonuses',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(today+'T12:00:00'));
  const d={...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',entries:{'2026-10-19':{praying:{kind:'prayer' as const,count:7}}}}};
  const week=coinHistory(d,today)[0];
  expect(week.goalsMet.map(g=>g.id)).toEqual(['praying','porn','goyslop','screen-time']);
  expect(week.goalBonus).toBe(12);
 });
 it('spends available coins once and keeps earned history unchanged, with an explicit undo',()=>{
  const d=data(),bought=buyReward(d,'shoes',today);
  expect(coinWallet(bought,today)).toEqual({earned:41,spent:10,balance:31});
  expect(()=>buyReward(bought,'shoes',today)).toThrow('already bought');
  bought.rewards![0].cost=100; // The receipt preserves the original purchase price.
  expect(coinWallet(bought,today).spent).toBe(10);
  expect(coinWallet(undoReward(bought,bought.rewardPurchases![0].id),today).balance).toBe(41);
  expect(coinHistory(bought,today)).toEqual(coinHistory(d,today));
 });
 it('blocks unaffordable or missing rewards and permits exact balances',()=>{
  const d=data();d.rewards[0].cost=42;expect(()=>buyReward(d,'shoes',today)).toThrow('more coins');
  d.rewards[0].cost=41;expect(coinWallet(buyReward(d,'shoes',today),today).balance).toBe(0);
  expect(()=>buyReward(d,'missing',today)).toThrow('no longer available');
 });
 it('validates rewards and receipts and preserves them through cloud serialization',()=>{
  const d=buyReward(data(),'shoes',today);expect(validate(d)).toBe(true);
  const restored=inflate(flatten({'checkly-data-v1':d})) as any;
  expect(restored['checkly-data-v1'].rewardPurchases).toEqual(d.rewardPurchases);
  expect(coinWallet(restored['checkly-data-v1'],today)).toEqual(coinWallet(d,today));
  expect(validRewards({...d,rewards:[{id:'bad',title:'Bad',cost:-1}]})).toBe(false);
  expect(validRewards({...d,rewardPurchases:[{...d.rewardPurchases![0],cost:NaN}]})).toBe(false);
  expect(validRewards({rewards:'bad' as any})).toBe(false);
 });
});
it('preserves earnings for recorded zero phone time in the original duration format',()=>{
 const d={...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',entries:{'2026-10-19':{'screen-time':{kind:'duration' as const,minutes:0}}}}};
 expect(coinHistory(d,'2026-10-26',null)[0]).toMatchObject({baseTotal:2,goalBonus:9,total:11});
});
