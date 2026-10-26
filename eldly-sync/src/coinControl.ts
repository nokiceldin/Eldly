import { accountScope,scopedKey,isGuest } from './accountScope';
import {HABITS,type Habit } from './mapping';
import type { Data } from './engine';
import type { WeeklyGoalPlan } from './goals';
import type { CoinBonusPlan } from './coinBonuses';
export type CoinConfig={habits:Habit[];goalPlans:WeeklyGoalPlan[];coinBonusPlans:CoinBonusPlan[]};
export type CoinPolicy={starts_on:string;legacy:CoinConfig;periods:{from:string;config:CoinConfig;reviewer:string}[]};
export const COIN_CONTROL_EVENT='myspace-coin-control';
export function readCoinPolicy():CoinPolicy|null{
 if(!accountScope()||isGuest()||typeof localStorage==='undefined')return null;
 try{return JSON.parse(localStorage.getItem(scopedKey('coin-control-v1'))||'null');}catch{return null;}
}
export function cacheCoinPolicy(value:CoinPolicy|null){
 if(!accountScope()||isGuest())return;
 const key=scopedKey('coin-control-v1'),next=JSON.stringify(value);
 if(localStorage.getItem(key)===next)return;
 localStorage.setItem(key,next);
 if(typeof window!=='undefined')window.dispatchEvent(new Event(COIN_CONTROL_EVENT));
}
const pending:CoinConfig={habits:[],goalPlans:[],coinBonusPlans:[{id:'pending',from:'1900-01-01',goal:0,record:0}]};
export function configForWeek(policy:CoinPolicy|null,week:string):CoinConfig|null{
 if(!policy)return null;
 if(week<policy.starts_on)return policy.legacy;
 return [...policy.periods].filter(p=>p.from<=week).sort((a,b)=>b.from.localeCompare(a.from))[0]?.config||pending;
}
export function coinDataForWeek<T extends Pick<Data,'mapping'|'goalPlans'|'coinBonusPlans'>>(data:T,week:string,policy=readCoinPolicy()):T{
 const config=configForWeek(policy,week);if(!config)return data;
 return {...data,mapping:{...(data.mapping||{version:1 as const,entries:{}}),habits:config.habits},goalPlans:config.goalPlans,coinBonusPlans:config.coinBonusPlans};
}

export function giftBalance(){if(!accountScope()||isGuest()||typeof localStorage==='undefined')return 0;try{const value=Number(localStorage.getItem(scopedKey('celebration-coins-v1'))||0);return Number.isFinite(value)&&value>=0?value:0;}catch{return 0;}}
export function cacheGiftBalance(value:number){if(!accountScope()||isGuest()||!Number.isFinite(value)||value<0)return;const key=scopedKey('celebration-coins-v1'),next=String(value);if(localStorage.getItem(key)===next)return;localStorage.setItem(key,next);if(typeof window!=='undefined')window.dispatchEvent(new Event(COIN_CONTROL_EVENT));}

export function displayCoinData<T extends Pick<Data,'mapping'|'goalPlans'|'coinBonusPlans'>>(data:T):T{
 const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));const week=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const control=readCoinPolicy();if(!control)return data;const config=configForWeek(control,week);
 if(!data.mapping)return data;const raw=data.mapping.habits??HABITS;
 return {...data,coinBonusPlans:config?.coinBonusPlans||[],mapping:{...data.mapping!,habits:raw.map(h=>({...h,xp:config?.habits.find(a=>a.id===h.id)?.xp||{amount:0,basis:'entry'}}))}};
}
