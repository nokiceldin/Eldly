import {ledgerWeeks} from '../shared/coin-ledger';
import type { Data } from './engine';
import { localDay } from './engine';
import {readCoinPolicy,giftBalance,type CoinPolicy} from './coinControl';
export type Reward={id:string;title:string;cost:number;archived?:boolean};
export type RewardPurchase={id:string;rewardId:string;title:string;cost:number;at:string;refunded?:boolean};
export const validCost=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0&&n<=1000000000;
const title=(s:unknown)=>typeof s==='string'&&s.trim().length>0&&s.length<=100;
export function validRewards(d:Pick<Data,'rewards'|'rewardPurchases'|'mainRewardId'>){
 const rewards=d.rewards??[],purchases=d.rewardPurchases??[];
 return (d.mainRewardId===undefined||typeof d.mainRewardId==='string')&&Array.isArray(rewards)&&Array.isArray(purchases)&&new Set(rewards.map(r=>r?.id)).size===rewards.length&&new Set(purchases.map(p=>p?.id)).size===purchases.length&&rewards.every(r=>r&&typeof r.id==='string'&&title(r.title)&&validCost(r.cost)&&(r.archived===undefined||typeof r.archived==='boolean'))&&purchases.every(p=>p&&typeof p.id==='string'&&typeof p.rewardId==='string'&&title(p.title)&&validCost(p.cost)&&typeof p.at==='string'&&Number.isFinite(Date.parse(p.at))&&(p.refunded===undefined||typeof p.refunded==='boolean'));
}
export function coinHistory(data:Pick<Data,'mapping'|'goalPlans'|'coinBonusPlans'>,today=localDay(),policy:CoinPolicy|null=readCoinPolicy()){
 return ledgerWeeks(data,today,policy);
}
export function coinStats(data:Pick<Data,'mapping'|'goalPlans'|'coinBonusPlans'>,today=localDay()){
 const weeks=coinHistory(data,today),completed=weeks.filter(w=>!w.current&&!w.partial);
 return {weeks,total:Math.round(weeks.reduce((n,w)=>n+w.total,0)*10)/10,current:weeks.find(w=>w.current)?.total||0,average:completed.length?completed.reduce((n,w)=>n+w.total,0)/completed.length:null,best:completed.length?completed.reduce((a,b)=>b.recordScore>a.recordScore?b:a):null};
}
export function coinWallet(data:Pick<Data,'mapping'|'goalPlans'|'coinBonusPlans'|'rewardPurchases'>,today=localDay()){
 const earned=coinStats(data,today).total;
 const spent=(data.rewardPurchases||[]).filter(p=>!p.refunded).reduce((n,p)=>n+p.cost,0);
 return {earned,spent,balance:Math.round((earned+giftBalance()-spent)*100)/100};
}
export function buyReward(data:Data,id:string,today=localDay()):Data{
 const reward=data.rewards?.find(r=>r.id===id&&!r.archived);
 if(!reward||!validCost(reward.cost))throw Error('This reward is no longer available.');
 if(data.rewardPurchases?.some(p=>p.rewardId===id&&!p.refunded))throw Error('You already bought this reward.');
 if(coinWallet(data,today).balance<reward.cost)throw Error('Keep earning — you need more coins for this reward.');
 return {...data,rewardPurchases:[...(data.rewardPurchases||[]),{id:crypto.randomUUID(),rewardId:id,title:reward.title,cost:reward.cost,at:new Date().toISOString()}]};
}
export function undoReward(data:Data,id:string):Data{
 return {...data,rewardPurchases:(data.rewardPurchases||[]).map(p=>p.id===id?{...p,refunded:true}:p)};
}

export function activeRewards(data:Pick<Data,'rewards'|'rewardPurchases'|'mainRewardId'>){
 const bought=new Set((data.rewardPurchases||[]).filter(p=>!p.refunded).map(p=>p.rewardId));
 const active=(data.rewards||[]).filter(r=>!r.archived&&!bought.has(r.id));
 return [...active.filter(r=>r.id===data.mainRewardId),...active.filter(r=>r.id!==data.mainRewardId)];
}
