import {defaultRule} from './coin-config.js';
export function currentFriendConfig(raw,policy,week){
 const active=!policy?raw:week<policy.starts_on?policy.legacy:[...policy.periods].filter(p=>p.from<=week).sort((a,b)=>b.from.localeCompare(a.from))[0]?.config;
 return {...raw,habits:raw.habits.map(h=>{const approved=active?.habits.find(a=>a.id===h.id);return {...h,xp:approved?.xp||{amount:0,basis:'entry'},goal:approved?.goal??h.goal,previousGoals:approved?.previousGoals??h.previousGoals};}),goalPlans:active?.goalPlans||[],coinBonusPlans:active?.coinBonusPlans||[{id:'pending',from:'1900-01-01',goal:0,record:0}]};
}
export function coinChanges(before,after){
 const changes=[];
 const describe=r=>`${r.amount} coins / ${r.basis==='hour'?'hour':r.basis==='count'?'time':'day'}${r.weeklyCap===undefined?' · no weekly cap':` · max ${r.weeklyCap}/week`}${r.dailyCountCap?` · max ${r.dailyCountCap}/day`:''}${r.threshold?` · ${r.threshold.comparison} ${r.threshold.minutes/60}h`:''}${r.secondary?` · ${r.secondary.amount} below ${r.secondary.belowMinutes/60}h`:''}`;
 for(const h of after.habits){const prior=before.habits.find(a=>a.id===h.id);if(prior&&JSON.stringify(prior.goal)!==JSON.stringify(h.goal))changes.push(`${h.label} goal: ${prior.goal?`${prior.goal.maximum?'at most':'at least'} ${prior.goal.target}`:'none'} → ${h.goal?`${h.goal.maximum?'at most':'at least'} ${h.goal.target}`:'none'}`);if(prior&&JSON.stringify(prior.xp)!==JSON.stringify(h.xp))changes.push(`${h.label}: ${describe(prior.xp||defaultRule(h.id))} → ${describe(h.xp)}`);}
 const oldTargets=before.goalPlans.at(-1)?.targets||{},newTargets=after.goalPlans.at(-1)?.targets||{};for(const [id,target] of Object.entries(newTargets))if(oldTargets[id]!==target)changes.push(`${id.replaceAll('-',' ')} goal: ${oldTargets[id]??'none'} → ${target}`);
 const a=before.coinBonusPlans.at(-1)||{goal:0,record:0},b=after.coinBonusPlans.at(-1)||{goal:0,record:0};
 if(a.goal!==b.goal)changes.push(`Coins per weekly goal: ${a.goal} → ${b.goal}`);
 if(a.record!==b.record)changes.push(`Record-week bonus: ${a.record} → ${b.record}`);
 return changes;
}
