import type { Data } from './engine';
import { localDay } from './engine';
import { pointsHistory } from './points';
import { weeklyGoals } from './goals';
import { personalGoalAt } from './personalGoals';
export type Reward={id:string;title:string;cost:number;archived?:boolean};
export type RewardPurchase={id:string;rewardId:string;title:string;cost:number;at:string;refunded?:boolean};
export const validCost=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0&&n<=1000000000;
const title=(s:unknown)=>typeof s==='string'&&s.trim().length>0&&s.length<=100;
export function validRewards(d:Pick<Data,'rewards'|'rewardPurchases'>){
 const rewards=d.rewards??[],purchases=d.rewardPurchases??[];
 return Array.isArray(rewards)&&Array.isArray(purchases)&&new Set(rewards.map(r=>r?.id)).size===rewards.length&&new Set(purchases.map(p=>p?.id)).size===purchases.length&&rewards.every(r=>r&&typeof r.id==='string'&&title(r.title)&&validCost(r.cost)&&(r.archived===undefined||typeof r.archived==='boolean'))&&purchases.every(p=>p&&typeof p.id==='string'&&typeof p.rewardId==='string'&&title(p.title)&&validCost(p.cost)&&typeof p.at==='string'&&Number.isFinite(Date.parse(p.at))&&(p.refunded===undefined||typeof p.refunded==='boolean'));
}
export function coinHistory(data:Pick<Data,'mapping'|'goalPlans'>,today=localDay()){
 const mapping=data.mapping;
 let best:number|null=null;
 return pointsHistory(mapping,today).map(week=>{
  const eligible=!week.current&&!week.partial&&!!mapping;
  const goalsMet:{id:string;label:string}[]=[];
  if(eligible&&mapping){
   if(data.goalPlans?.length||!mapping.habits){
    goalsMet.push(...weeklyGoals(data as Data,week.from,today).filter(g=>g.eligible&&g.met).map(g=>({id:g.id,label:g.label})));
   }
   for(const habit of mapping.habits||[]){
    const goal=personalGoalAt(habit,week.from);if(!goal)continue;
    if(goalsMet.some(g=>g.id===habit.id))continue;
    const sum=Object.entries(mapping.entries).filter(([day])=>day>=week.from&&day<=week.to).reduce((n,[,row])=>{const e=row[habit.id];return n+(!e?0:e.kind==='check'?1:e.kind==='prayer'?e.count:e.kind==='sleep'?e.nightMinutes+e.dayMinutes:e.minutes||0);},0);
    const actual=habit.kind==='sleep'||habit.kind==='phone'?sum/7:sum;
    if(goal.maximum?actual<=goal.target:actual>=goal.target)goalsMet.push({id:habit.id,label:habit.label});
   }
  }
  const recordBonus=eligible&&best!==null&&week.total>best&&week.total>0?20:0;
  if(eligible)best=best===null?week.total:Math.max(best,week.total);
  const goalBonus=goalsMet.length*3;
  return {...week,baseTotal:week.total,goalBonus,recordBonus,goalsMet,total:Math.round((week.total+goalBonus+recordBonus)*10)/10};
 });
}
export function coinStats(data:Pick<Data,'mapping'|'goalPlans'>,today=localDay()){
 const weeks=coinHistory(data,today),completed=weeks.filter(w=>!w.current&&!w.partial);
 return {weeks,total:Math.round(weeks.reduce((n,w)=>n+w.total,0)*10)/10,current:weeks.find(w=>w.current)?.total||0,average:completed.length?completed.reduce((n,w)=>n+w.total,0)/completed.length:null,best:completed.length?completed.reduce((a,b)=>b.total>a.total?b:a):null};
}
export function coinWallet(data:Pick<Data,'mapping'|'goalPlans'|'rewardPurchases'>,today=localDay()){
 const earned=coinStats(data,today).total;
 const spent=(data.rewardPurchases||[]).filter(p=>!p.refunded).reduce((n,p)=>n+p.cost,0);
 return {earned,spent,balance:Math.round((earned-spent)*10)/10};
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
