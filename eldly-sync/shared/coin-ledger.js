import {defaults,defaultRule,achievedGoals} from './coin-config.js';
import {effectiveData,configAt,weekOf} from './effective-goals.js';
const add=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function entryCoins(id,e,rule){
 if(!e)return 0;
 // Preserve recorded zero screen-time entries from the original duration format.
 if(!rule&&id==='screen-time'&&e.kind==='duration'&&e.minutes===0)return 2;
 rule=rule||defaultRule(id);
 const minutes=e.kind==='duration'||e.kind==='phone'?e.minutes:e.kind==='sleep'?e.nightMinutes+e.dayMinutes:undefined;
 if(rule.threshold&&(minutes===undefined||(rule.threshold.comparison==='over'?minutes<=rule.threshold.minutes:minutes>=rule.threshold.minutes)))return 0;
 const amount=rule.secondary&&minutes!==undefined&&minutes<rule.secondary.belowMinutes?rule.secondary.amount:rule.amount;
 const units=rule.basis==='hour'?(minutes??0)/60:rule.basis==='count'?(e.kind==='prayer'?Math.min(e.count,rule.dailyCountCap??Infinity):e.kind==='check'?1:0):e.kind==='phone'?(e.minutes===undefined?0:1):e.kind==='duration'||e.kind==='sleep'?(minutes&&minutes>0?1:0):1;
 return Math.round(amount*units*10)/10;
}
export function ledgerWeeks(data,today,policy=null){
 const mapping=data.mapping||{entries:{}},start=mapping.startedOn||'2026-10-15';
 const weeks=[];let best=null;
 for(let from=weekOf(start);from<=today;from=add(from,7)){
  const to=add(from,6),current=from===weekOf(today),partial=from<start;
  const effective=effectiveData(data,from,policy),active=configAt(policy,from);
  const habits=effective.mapping?.habits||defaults.map(([id,label,kind])=>({id,label,kind})),breakdown={};
  for(let day=from;day<=to&&day<=today;day=add(day,1)){
   if(day<start)continue;
   for(const [id,entry] of Object.entries(mapping.entries[day]||{})){
    const habit=habits.find(h=>h.id===id);if(active&&!habit)continue;
    if(active&&entry&&habit&&entry.kind!==habit.kind&&!(['recovery','reading','journaling','screen-time'].includes(id)&&entry.kind==='duration'))continue;
    breakdown[id]=(breakdown[id]||0)+entryCoins(id,entry,habit?.xp);
   }
  }
  for(const id of Object.keys(breakdown)){const habit=habits.find(h=>h.id===id),cap=habit?.xp?habit.xp.weeklyCap:active?undefined:defaultRule(id).weeklyCap;if(cap!==undefined)breakdown[id]=Math.sign(breakdown[id])*Math.min(cap,Math.abs(breakdown[id]));}
  const baseTotal=Object.values(breakdown).reduce((a,b)=>a+b,0),eligible=!current&&!partial;
  const goalsMet=eligible?achievedGoals(effective,from,to,true).map(id=>({id,label:habits.find(h=>h.id===id)?.label||({ 'tennis-days':'Tennis days','tennis-hours':'Tennis time'}[id])||id})):[];
  const bonusRates=[...(effective.coinBonusPlans||[])].filter(p=>p.from<=from).sort((a,b)=>b.from.localeCompare(a.from))[0]||{goal:3,record:20};
  const goalBonus=goalsMet.length*bonusRates.goal,recordBonus=eligible&&best!==null&&baseTotal>best&&baseTotal>0?bonusRates.record:0;
  if(eligible)best=best===null?baseTotal:Math.max(best,baseTotal);
  weeks.push({from,to,current,partial,breakdown,bonusRates,baseTotal,goalBonus,recordBonus,goalsMet,total:Math.round((baseTotal+goalBonus+recordBonus)*10)/10});
 }
 return weeks;
}
export function ledgerWallet(data,today,policy=null,gifts=0){
 const earned=Math.round(ledgerWeeks(data,today,policy).reduce((n,w)=>n+w.total,0)*10)/10;
 const spent=(data.rewardPurchases||[]).filter(p=>!p.refunded).reduce((n,p)=>n+p.cost,0);
 return {earned,spent,balance:Math.round((earned+gifts-spent)*100)/100};
}
