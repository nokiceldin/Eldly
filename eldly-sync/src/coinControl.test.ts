import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {empty,type Data} from './engine';
import {pointsHistory} from './points';
import {coinHistory,coinWallet} from './rewards';
import {cacheCoinPolicy,readCoinPolicy,type CoinConfig,type CoinPolicy} from './coinControl';
import {setAccountScope} from './accountScope';
const config=(amount:number,target=1,goal=0):CoinConfig=>({habits:[{id:'tennis',label:'Tennis',kind:'check',color:'blue',xp:{amount,basis:'entry',weeklyCap:20},goal:{target,maximum:false,from:'2026-10-19'}}],goalPlans:[],coinBonusPlans:[{id:'bonus',from:'1900-01-01',goal,record:0}]});
const policy:CoinPolicy={starts_on:'2026-10-26',legacy:config(5),periods:[{from:'2026-11-02',config:config(8,2,3),reviewer:'friend'}]};
const data=():Data=>({...empty(),mapping:{version:1 as const,startedOn:'2026-10-19',habits:[{id:'tennis',label:'Tennis',kind:'check' as const,color:'blue' as const,xp:{amount:1000,basis:'entry' as const},goal:{target:.01,maximum:false,from:'2026-10-19'}},{id:'fake',label:'Unapproved',kind:'check' as const,color:'blue' as const,xp:{amount:1000,basis:'entry' as const}}],entries:{'2026-10-19':{tennis:{kind:'check' as const}},'2026-10-26':{tennis:{kind:'check' as const}},'2026-11-02':{tennis:{kind:'check' as const},fake:{kind:'check' as const}},'2026-11-03':{tennis:{kind:'check' as const}},'2026-11-04':{tennis:{kind:'check' as const}}}},coinBonusPlans:[{id:'cheat',from:'1900-01-01',goal:1000000,record:1000000}]});
beforeEach(()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});vi.stubGlobal('window',new EventTarget());setAccountScope('account-a');});
afterEach(()=>{vi.unstubAllGlobals();setAccountScope('guest');});
it('freezes legacy rules, holds unapproved weeks at zero and uses only peer-approved rates and caps',()=>{
 const weeks=pointsHistory(data().mapping,'2026-11-09',policy);
 expect(weeks.map(w=>w.total)).toEqual([5,0,20,0]);expect(weeks[2].breakdown.fake).toBeUndefined();
 const coinWeeks=coinHistory(data(),'2026-11-09',policy);expect(coinWeeks[2]).toMatchObject({baseTotal:20,goalBonus:3,recordBonus:0,total:23});expect(coinWeeks[1].total).toBe(0);
});
it('does not let self-edited goals, bonuses or new trackers bypass a rule approval',()=>{
 const d=data();d.mapping!.entries={'2026-11-02':{tennis:{kind:'check'},fake:{kind:'check'}}};
 const week=coinHistory(d,'2026-11-09',policy).find(w=>w.from==='2026-11-02');expect(week).toMatchObject({baseTotal:8,goalBonus:0,total:8});
});
it('keeps the policy separate from imported personal data and scoped to the signed-in account',()=>{
 cacheCoinPolicy(policy);expect(readCoinPolicy()).toEqual(policy);expect(coinWallet(data(),'2026-11-09').earned).toBe(28);
 setAccountScope('account-b');expect(readCoinPolicy()).toBeNull();setAccountScope('guest');expect(readCoinPolicy()).toBeNull();setAccountScope('account-a');expect(readCoinPolicy()).toEqual(policy);
});
it('applies a later approval only to its future week, keeping prior coin totals unchanged',()=>{
 const next={...policy,periods:[...policy.periods,{from:'2026-11-09',config:config(2),reviewer:'friend'}]};
 expect(pointsHistory(data().mapping,'2026-11-09',next).slice(0,3)).toEqual(pointsHistory(data().mapping,'2026-11-09',policy).slice(0,3));
});
it('adds private gift credits to spendable balance without changing tracker earnings or weekly records',async()=>{
 const {cacheGiftBalance}=await import('./coinControl');const d=data();const before=coinWallet(d,'2026-11-09'),history=coinHistory(d,'2026-11-09');cacheGiftBalance(25.01);expect(coinWallet(d,'2026-11-09')).toEqual({...before,balance:before.balance+25.01});expect(coinHistory(d,'2026-11-09')).toEqual(history);setAccountScope('another-account');expect(coinWallet(d,'2026-11-09').balance).toBe(before.balance);setAccountScope('account-a');cacheGiftBalance(0);expect(coinWallet(d,'2026-11-09')).toEqual(before);
});
it('shows the applied partner rate rather than editable local drafts and updates when a new policy arrives',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-03T12:00:00'));try{const {displayCoinData}=await import('./coinControl');cacheCoinPolicy(policy);const d=data();expect(d.mapping!.habits![0].xp!.amount).toBe(1000);expect(displayCoinData(d).mapping!.habits![0].xp!.amount).toBe(8);expect(displayCoinData(d).mapping!.habits![1].xp!.amount).toBe(0);cacheCoinPolicy({...policy,periods:[{from:'2026-11-02',config:config(12),reviewer:'friend'}]});expect(displayCoinData(d).mapping!.habits![0].xp!.amount).toBe(12);expect(d.mapping!.habits![0].xp!.amount).toBe(1000);}finally{vi.useRealTimers();}
});
it('shows negative approved rates and subtracts them from tracking totals',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-03T12:00:00'));
 try{
  const negative=config(-100);delete negative.habits[0].xp!.weeklyCap;
  const next={...policy,periods:[{from:'2026-11-02',config:negative,reviewer:'friend'}]};cacheCoinPolicy(next);
  const {displayCoinData}=await import('./coinControl');expect(displayCoinData(data()).mapping!.habits![0].xp!.amount).toBe(-100);
  expect(pointsHistory(data().mapping,'2026-11-03',next).find(w=>w.from==='2026-11-02')!.total).toBe(-200);
 }finally{vi.useRealTimers();}
});
